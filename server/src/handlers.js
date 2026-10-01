import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { ROLES, extractVideoId } from './rooms.js';
import { saveRoom, loadRoom } from './db.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const GRACE_MS = 15000;
const CONTROL = ['play', 'pause', 'seek', 'change_video'];

export const signToken = (userId, username, roomId) => jwt.sign({ userId, username, roomId }, SECRET, { expiresIn: '7d' });
const verify = (t) => { try { return jwt.verify(t, SECRET); } catch { return null; } };

// Owns all socket event handling; one instance per server.
export class MessageHandler {
  constructor(io, manager) { this.io = io; this.manager = manager; }

  attach(socket) {
    const on = (evt, fn) => socket.on(evt, async (payload = {}, ack) => {
      try { await fn(payload, typeof ack === 'function' ? ack : () => {}); }
      catch (e) { console.error(evt, e); socket.emit('error_message', { message: 'Something went wrong' }); }
    });
    const ctx = () => {
      const room = this.manager.get(socket.data.roomId);
      const me = room?.participants.get(socket.data.userId);
      return room && me ? { room, me } : {};
    };
    const fail = (message) => socket.emit('error_message', { message });

    on('join_room', async ({ roomId, username, token }, ack) => {
      roomId = String(roomId || '').toUpperCase();
      username = String(username || '').trim().slice(0, 24);
      if (!username) return ack({ ok: false, error: 'Username required' });
      const claims = verify(token);
      let room = this.manager.get(roomId);
      if (!room) {
        const saved = await loadRoom(roomId); // persistent rooms: restore after restart
        if (!saved) return ack({ ok: false, error: 'Room not found' });
        room = this.manager.create(null, roomId, saved.video_id);
      }
      const valid = claims && claims.roomId === roomId;
      const userId = valid ? claims.userId : crypto.randomUUID();
      if (room.hostUserId === null) room.hostUserId = userId; // restored room: first joiner hosts
      const existing = room.participants.get(userId);
      if (existing?.socketId && existing.socketId !== socket.id) this.io.sockets.sockets.get(existing.socketId)?.disconnect(true);
      const isNew = !existing;
      const me = room.join(userId, username, socket.id);
      socket.data = { roomId, userId };
      socket.join(roomId);
      ack({
        ok: true, userId, role: me.role, token: signToken(userId, username, roomId),
        state: room.snapshot(), participants: room.list(), chat: room.chat.slice(-50),
        requests: me.canControl ? [...room.requests.values()] : [],
      });
      if (isNew) socket.to(roomId).emit('user_joined', { username, userId, role: me.role, participants: room.list() });
      else this.io.to(roomId).emit('participants_updated', { participants: room.list() });
    });

    on('leave_room', () => this.leave(socket, true));

    // Direct control events: Host / Moderator only (validated server-side).
    for (const type of CONTROL) {
      on(type, (payload) => {
        const { room, me } = ctx();
        if (!room) return;
        if (!me.canControl) return fail('Only the host or a moderator can do that. Send a request instead.');
        this.run(room, type, payload, me);
      });
    }

    on('request_action', ({ type, payload }) => {
      const { room, me } = ctx();
      if (!room || !CONTROL.includes(type)) return;
      if (me.canControl) return this.run(room, type, payload, me);
      if (type === 'change_video' && !extractVideoId(payload?.videoId)) return fail('Invalid YouTube link');
      for (const [k, r] of room.requests) if (r.userId === me.userId && r.type === type) room.requests.delete(k);
      const req = { id: crypto.randomUUID(), userId: me.userId, username: me.username, type, payload: payload || {} };
      room.requests.set(req.id, req);
      this.pushRequests(room);
      socket.emit('request_sent', { type });
    });

    on('resolve_request', ({ requestId, approve }) => {
      const { room, me } = ctx();
      if (!room) return;
      if (!me.canControl) return fail('Not allowed');
      const req = room.requests.get(requestId);
      if (!req) return;
      room.requests.delete(requestId);
      if (approve) this.run(room, req.type, req.payload, me);
      const target = room.participants.get(req.userId);
      if (target?.socketId) this.io.to(target.socketId).emit('request_resolved', { type: req.type, approved: !!approve, by: me.username });
      this.pushRequests(room);
    });

    on('assign_role', ({ userId, role }) => {
      const { room, me } = ctx();
      if (!room) return;
      if (me.role !== ROLES.HOST) return fail('Only the host can assign roles');
      if (![ROLES.MODERATOR, ROLES.PARTICIPANT].includes(role)) return fail('Invalid role');
      const t = room.participants.get(userId);
      if (!t || t.role === ROLES.HOST) return fail('Cannot change that user');
      t.role = role;
      if (role === ROLES.PARTICIPANT) for (const [k, r] of room.requests) if (r.userId === userId) room.requests.delete(k);
      this.io.to(room.id).emit('role_assigned', { userId, username: t.username, role, participants: room.list() });
      this.pushRequests(room);
      if (t.socketId) this.io.to(t.socketId).emit('requests_updated', { requests: t.canControl ? [...room.requests.values()] : [] });
    });

    on('remove_participant', ({ userId }) => {
      const { room, me } = ctx();
      if (!room) return;
      if (me.role !== ROLES.HOST) return fail('Only the host can remove participants');
      const t = room.participants.get(userId);
      if (!t || t.role === ROLES.HOST) return fail('Cannot remove that user');
      const s = t.socketId && this.io.sockets.sockets.get(t.socketId);
      if (s) { s.emit('removed', { message: 'You were removed by the host' }); s.leave(room.id); s.data = {}; }
      clearTimeout(t.timer);
      room.participants.delete(userId);
      for (const [k, r] of room.requests) if (r.userId === userId) room.requests.delete(k);
      this.io.to(room.id).emit('participant_removed', { userId, participants: room.list() });
      this.pushRequests(room);
    });

    on('transfer_host', ({ userId }) => {
      const { room, me } = ctx();
      if (!room) return;
      if (me.role !== ROLES.HOST) return fail('Only the host can transfer host');
      const t = room.participants.get(userId);
      if (!t || t === me) return fail('Invalid user');
      room.setHost(t);
      this.io.to(room.id).emit('role_assigned', { userId, username: t.username, role: ROLES.HOST, participants: room.list() });
      this.pushRequests(room);
    });

    on('chat_message', ({ text }) => {
      const { room, me } = ctx();
      const t = String(text || '').trim().slice(0, 300);
      if (!room || !t) return;
      const msg = { id: crypto.randomUUID(), userId: me.userId, username: me.username, role: me.role, text: t, at: Date.now() };
      room.chat.push(msg); if (room.chat.length > 100) room.chat.shift();
      this.io.to(room.id).emit('chat_message', msg);
    });

    on('reaction', ({ emoji }) => {
      const { room, me } = ctx();
      if (!room || !['👍', '😂', '😮', '❤️', '🔥', '👏'].includes(emoji)) return;
      this.io.to(room.id).emit('reaction', { emoji, username: me.username });
    });

    on('request_sync', (_, ack) => { const { room } = ctx(); if (room) ack({ state: room.snapshot() }); });

    socket.on('disconnect', () => this.leave(socket, false));
  }

  run(room, type, payload, by) {
    if (!room.apply(type, payload)) return;
    this.io.to(room.id).emit('sync_state', { ...room.snapshot(), action: type, by: by.username });
    if (type === 'change_video') saveRoom(room.id, room.state.videoId);
  }

  pushRequests(room) {
    const list = [...room.requests.values()];
    for (const p of room.participants.values()) {
      if (p.canControl && p.socketId) this.io.to(p.socketId).emit('requests_updated', { requests: list });
    }
  }

  // explicit = user clicked leave (immediate); otherwise wait a grace period so refreshes keep the role.
  leave(socket, explicit) {
    const { roomId, userId } = socket.data || {};
    const room = this.manager.get(roomId);
    const p = room?.participants.get(userId);
    if (!p || (!explicit && p.socketId !== socket.id)) return;
    if (explicit) { socket.leave(roomId); socket.data = {}; }
    p.socketId = null;
    clearTimeout(p.timer);
    const remove = () => {
      if (p.socketId) return;
      const wasHost = room.hostUserId === userId;
      room.participants.delete(userId);
      for (const [k, r] of room.requests) if (r.userId === userId) room.requests.delete(k);
      if (wasHost) {
        const next = room.nextHost(userId);
        if (next) room.setHost(next); else room.hostUserId = null;
        if (next) this.io.to(roomId).emit('role_assigned', { userId: next.userId, username: next.username, role: ROLES.HOST, participants: room.list() });
      }
      this.io.to(roomId).emit('user_left', { username: p.username, userId, participants: room.list() });
      this.pushRequests(room);
      if (room.participants.size === 0) room.cleanupTimer = setTimeout(() => this.manager.delete(roomId), 60000);
    };
    if (explicit) remove(); else p.timer = setTimeout(remove, GRACE_MS);
    if (!explicit) this.io.to(roomId).emit('participants_updated', { participants: room.list() });
  }
}
