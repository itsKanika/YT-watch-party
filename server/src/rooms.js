import crypto from 'crypto';

export const ROLES = { HOST: 'host', MODERATOR: 'moderator', PARTICIPANT: 'participant' };
export const DEFAULT_VIDEO = 'W0DM5lcj6mw';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function extractVideoId(input = '') {
  const s = String(input).trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export class Participant {
  constructor(userId, username, role) {
    this.userId = userId;
    this.username = username;
    this.role = role;
    this.socketId = null;
    this.timer = null; // grace-period timer for reconnects
  }
  get canControl() { return this.role === ROLES.HOST || this.role === ROLES.MODERATOR; }
  toJSON() { return { userId: this.userId, username: this.username, role: this.role, online: !!this.socketId }; }
}

export class Room {
  constructor(id, hostUserId, videoId = DEFAULT_VIDEO) {
    this.id = id;
    this.hostUserId = hostUserId;
    this.participants = new Map();
    this.requests = new Map(); // pending participant requests
    this.chat = [];
    this.state = { playState: 'paused', currentTime: 0, videoId, updatedAt: Date.now() };
    this.cleanupTimer = null;
  }

  // Live playback position, extrapolated while playing.
  position() {
    const s = this.state;
    return s.playState === 'playing' ? s.currentTime + (Date.now() - s.updatedAt) / 1000 : s.currentTime;
  }
  snapshot() {
    return { playState: this.state.playState, currentTime: this.position(), videoId: this.state.videoId };
  }
  list() { return [...this.participants.values()].map((p) => p.toJSON()); }

  join(userId, username, socketId) {
    let p = this.participants.get(userId);
    if (p) { clearTimeout(p.timer); p.username = username || p.username; }
    else {
      p = new Participant(userId, username, userId === this.hostUserId ? ROLES.HOST : ROLES.PARTICIPANT);
      this.participants.set(userId, p);
    }
    p.socketId = socketId;
    clearTimeout(this.cleanupTimer);
    return p;
  }

  apply(type, payload = {}) {
    const s = this.state;
    const now = this.position();
    if (type === 'play') { s.currentTime = now; s.playState = 'playing'; }
    else if (type === 'pause') { s.currentTime = now; s.playState = 'paused'; }
    else if (type === 'seek') { s.currentTime = Math.max(0, Number(payload.time) || 0); }
    else if (type === 'change_video') {
      const id = extractVideoId(payload.videoId);
      if (!id) return false;
      s.videoId = id; s.currentTime = 0; s.playState = 'playing';
    } else return false;
    s.updatedAt = Date.now();
    return true;
  }

  // Picks the next host: a moderator first, otherwise the longest-standing participant.
  nextHost(excludeId) {
    const others = [...this.participants.values()].filter((p) => p.userId !== excludeId);
    return others.find((p) => p.role === ROLES.MODERATOR) || others[0] || null;
  }
  setHost(p) {
    const old = this.participants.get(this.hostUserId);
    if (old && old !== p) old.role = ROLES.MODERATOR;
    p.role = ROLES.HOST;
    this.hostUserId = p.userId;
  }
}

export class RoomManager {
  constructor() { this.rooms = new Map(); }
  newCode() {
    let code;
    do { code = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(''); }
    while (this.rooms.has(code));
    return code;
  }
  create(hostUserId, id = this.newCode(), videoId) {
    const room = new Room(id, hostUserId, videoId);
    this.rooms.set(id, room);
    return room;
  }
  get(id) { return this.rooms.get(String(id || '').toUpperCase()); }
  delete(id) { this.rooms.delete(id); }
}
