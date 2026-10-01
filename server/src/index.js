import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { Server } from 'socket.io';
import { RoomManager } from './rooms.js';
import { MessageHandler, signToken } from './handlers.js';
import { initDb, saveRoom, loadRoom } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const origins = (process.env.CLIENT_URL || 'http://localhost:5173,https://yt-watch-party-nh3y.vercel.app').split(',').map((s) => s.trim());

const app = express();
app.use(cors({ origin: origins }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins, methods: ['GET', 'POST'] } });
const manager = new RoomManager();
const handler = new MessageHandler(io, manager);
io.on('connection', (socket) => handler.attach(socket));

app.get('/health', (_, res) => res.json({ ok: true, rooms: manager.rooms.size }));

// Create a room: the creator gets a token that marks them as Host when they join the socket room.
app.post('/api/rooms', async (req, res) => {
  const username = String(req.body?.username || '').trim().slice(0, 24);
  if (!username) return res.status(400).json({ error: 'Username required' });
  const hostId = crypto.randomUUID();
  const room = manager.create(hostId);
  saveRoom(room.id, room.state.videoId);
  res.json({ roomId: room.id, token: signToken(hostId, username, room.id) });
});

app.get('/api/rooms/:id', async (req, res) => {
  const id = req.params.id.toUpperCase();
  const exists = manager.get(id) || (await loadRoom(id));
  res.status(exists ? 200 : 404).json({ exists: !!exists });
});

// Serve the built React app in production (single-service deploy).
const dist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Periodic drift-correction broadcast to rooms that are playing.
setInterval(() => {
  for (const r of manager.rooms.values()) {
    if (r.state.playState === 'playing') io.to(r.id).emit('sync_state', { ...r.snapshot(), action: 'tick' });
  }
}, 10000);

server.listen(PORT, () => console.log(`Watch Party server on :${PORT}`));
initDb(); // non-blocking: persistence is optional
