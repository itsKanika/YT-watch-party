# YouTube Watch Party

Real-time watch rooms: everyone sees the same YouTube video state (play/pause, seek, video), with Host / Moderator / Participant roles enforced on the server.

**Live URL:** `https://<your-app>.onrender.com`  ← paste after deploying

## Stack
- **Frontend:** React + TypeScript + Vite + Tailwind, YouTube IFrame API, `socket.io-client`
- **Backend:** Node.js + Express + **Socket.IO** (WebSockets), JWT for session identity
- **DB (optional, bonus):** Supabase Postgres via `pg` – persists room id + current video so rooms survive restarts. The app works in-memory if `DATABASE_URL` is empty/unreachable.

## Run locally
```bash
# terminal 1
cd server && cp .env.example .env   # fill JWT_SECRET (and DATABASE_URL optionally)
npm install && npm run dev          # http://localhost:4000
# terminal 2
cd client && cp .env.example .env
npm install && npm run dev          # http://localhost:5173
```
Open two browser windows (one normal, one incognito): create a room in one, join with the code in the other.

## Deploy (Render, single web service)
1. Push this repo to GitHub → Render → **New Web Service** (or use `render.yaml`).
2. Build command: `npm run build` · Start command: `npm start`
3. Env vars: `JWT_SECRET`, `DATABASE_URL` (Supabase pooler URL), `CLIENT_URL` = your Render URL.
4. The Node server serves the built React app, so frontend + WebSocket share one origin (no CORS/URL config needed).

## Roles & permissions
| Role | Permissions |
|---|---|
| Host (creator) | play/pause, seek, change video, assign roles, remove participants, transfer host, approve/deny requests |
| Moderator (set by host) | play/pause, seek, change video, approve/deny requests |
| Participant (default) | watch, chat, react; **requests** play/pause/seek/change-video, which Host/Moderators approve or decline |

## Architecture
```
Browser (React + YT IFrame)  <—— Socket.IO / WebSocket ——>  Node server
   custom controls, overlay                                   RoomManager → Room → Participant
   blocks direct clicks on the player                         MessageHandler validates role per event
                                                              Postgres (optional): room id + video
```
- `POST /api/rooms` creates a room and returns a **JWT** `{userId, username, roomId}`; the creator's `userId` is the room's `hostUserId`. Joining with that token restores Host. Refreshing keeps your identity/role (15 s reconnect grace).
- Server is the **single source of truth**: it stores `{playState, currentTime, updatedAt, videoId}`, extrapolates the live position while playing, and broadcasts `sync_state`. Clients apply it (seek only if drift > 1.5 s). A 10 s tick corrects drift; late joiners get the current position on join.
- Every privileged event (`play`, `pause`, `seek`, `change_video`, `assign_role`, `remove_participant`, `transfer_host`, `resolve_request`) is checked on the backend; participants get an error for direct calls.
- Participant flow: `request_action` → server stores a pending request → pushed to Host/Mods (`requests_updated`) → `resolve_request` approve/decline → approved requests run through the normal broadcast path.
- Events implemented: `join_room, leave_room, sync_state, play, pause, seek, change_video, assign_role, remove_participant, user_joined, user_left, role_assigned, participant_removed` + `transfer_host, request_action, resolve_request, chat_message, reaction`.
- Host leaves → host auto-passes to a moderator, else the oldest participant.

## Code structure
- `server/src/rooms.js` – `Participant`, `Room`, `RoomManager` classes (OOP: state, permissions, sync maths)
- `server/src/handlers.js` – `MessageHandler` class (all socket events + validation)
- `server/src/db.js` – optional Postgres persistence · `server/src/index.js` – Express + Socket.IO bootstrap
- `client/src/Room.tsx` – room UI, player sync · `client/src/EntryDialog.tsx` – create/join

## Trade-offs / notes
- Room state is in server memory (single instance). For horizontal scale add the Socket.IO Redis adapter + sticky sessions.
- Browsers may block autoplay with sound; a "Tap to join playback" button appears when that happens.
- Render free tier sleeps after inactivity (first load can take ~30–60 s).
