import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Check, Copy, Crown, LogOut, Pause, Play, Send, Shield, UserX, X, Youtube, Volume2 } from 'lucide-react';
import { SERVER_URL, fmt, getSession, setSession, type Person, type Role } from './lib';

declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

interface VState { playState: 'playing' | 'paused'; currentTime: number; videoId: string }
interface Req { id: string; userId: string; username: string; type: string; payload: any }
interface Msg { id: string; username: string; role: Role; text: string; at: number }

const EMOJIS = ['👍', '😂', '😮', '❤️', '🔥', '👏'];
const LABEL: Record<string, string> = { play: 'play', pause: 'pause', seek: 'seek', change_video: 'change the video' };

function loadYT(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((res) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(window.YT); };
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script');
      s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(s);
    }
  });
}

export default function Room({ roomId }: { roomId: string }) {
  const [session, setSess] = useState(() => {
    const s = getSession(roomId);
    if (s) return s;
    const n = new URLSearchParams(window.location.search).get('n');
    return n ? { token: '', username: n } : null;
  });
  if (!session) return <NameGate roomId={roomId} onDone={(username) => setSess({ token: '', username })} />;
  return <RoomView roomId={roomId} username={session.username} token={session.token} />;
}

function NameGate({ roomId, onDone }: { roomId: string; onDone: (n: string) => void }) {
  const [name, setName] = useState('');
  return (
    <main className="site-shell center-screen">
      <form className="dialog" onSubmit={(e) => { e.preventDefault(); name.trim() && onDone(name.trim()); }}>
        <p className="eyebrow">Joining room {roomId}</p>
        <h2>What's your name?</h2>
        <input className="field" autoFocus maxLength={24} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="button dialog-button">Join the room</button>
      </form>
    </main>
  );
}

function RoomView({ roomId, username, token }: { roomId: string; username: string; token: string }) {
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef(token);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const wantRef = useRef<VState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);

  const [meId, setMeId] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [chat, setChat] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [floats, setFloats] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const [fatal, setFatal] = useState('');
  const [joined, setJoined] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [needTap, setNeedTap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vid, setVid] = useState('');

  const me = people.find((p) => p.userId === meId);
  const role: Role = me?.role || 'participant';
  const canControl = role === 'host' || role === 'moderator';

  const toast = useCallback((t: string) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, text: t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3500);
  }, []);

  // Push the server's desired state into the YouTube player.
  const applyState = useCallback((s: VState) => {
    wantRef.current = s;
    setPlaying(s.playState === 'playing');
    setVid(s.videoId);
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    const curVid = p.getVideoData?.().video_id;
    if (curVid !== s.videoId) {
      if (s.playState === 'playing') p.loadVideoById(s.videoId, s.currentTime);
      else p.cueVideoById(s.videoId, s.currentTime);
      return;
    }
    if (Math.abs(p.getCurrentTime() - s.currentTime) > 1.5) p.seekTo(s.currentTime, true);
    if (s.playState === 'playing') p.playVideo(); else p.pauseVideo();
  }, []);

  // Socket wiring
  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    const join = () => socket.emit('join_room', { roomId, username, token: tokenRef.current }, (r: any) => {
      if (!r.ok) return setFatal(r.error || 'Could not join room');
      tokenRef.current = r.token;
      setSession(roomId, { token: r.token, username });
      setMeId(r.userId); setPeople(r.participants); setChat(r.chat || []); setRequests(r.requests || []);
      applyState(r.state); setJoined(true);
    });
    socket.on('connect', join);
    socket.on('sync_state', (s: VState & { action?: string; by?: string }) => {
      applyState(s);
      if (s.action && s.action !== 'tick' && s.by) toast(`${s.by}: ${s.action === 'change_video' ? 'changed the video' : s.action}`);
    });
    socket.on('user_joined', (d: any) => { setPeople(d.participants); toast(`${d.username} joined`); });
    socket.on('user_left', (d: any) => { setPeople(d.participants); toast(`${d.username} left`); });
    socket.on('participants_updated', (d: any) => setPeople(d.participants));
    socket.on('role_assigned', (d: any) => { setPeople(d.participants); toast(`${d.username} is now ${d.role}`); });
    socket.on('participant_removed', (d: any) => setPeople(d.participants));
    socket.on('requests_updated', (d: any) => setRequests(d.requests));
    socket.on('request_sent', (d: any) => toast(`Request to ${LABEL[d.type]} sent to the host/moderators`));
    socket.on('request_resolved', (d: any) => toast(`${d.by} ${d.approved ? 'approved' : 'declined'} your request to ${LABEL[d.type]}`));
    socket.on('chat_message', (m: Msg) => setChat((c) => [...c.slice(-99), m]));
    socket.on('reaction', (d: any) => {
      const id = Math.random();
      setFloats((f) => [...f, { id, emoji: d.emoji, left: 10 + Math.random() * 75 }]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2500);
    });
    socket.on('error_message', (d: any) => toast(d.message));
    socket.on('removed', (d: any) => { sessionStorage.removeItem('wp:' + roomId); setFatal(d.message); socket.disconnect(); });
    return () => { socket.disconnect(); };
  }, [roomId, username, applyState, toast]);

  // YouTube player (created once we know the initial video)
  useEffect(() => {
    if (!joined || !wrapRef.current || playerRef.current) return;
    let dead = false;
    wrapRef.current.innerHTML = '<div id="yt-player"></div>';
    loadYT().then((YT) => {
      if (dead) return;
      playerRef.current = new YT.Player('yt-player', {
        videoId: wantRef.current?.videoId, width: '100%', height: '100%',
        playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 0, iv_load_policy: 3 },
        events: { onReady: () => { readyRef.current = true; wantRef.current && applyState(wantRef.current); } },
      });
    });
    return () => { dead = true; try { playerRef.current?.destroy(); } catch { /* noop */ } playerRef.current = null; readyRef.current = false; };
  }, [joined, applyState]);

  // Poll the player for progress + detect blocked autoplay
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current || !p.getCurrentTime) return;
      if (!dragRef.current) setCur(p.getCurrentTime());
      setDur(p.getDuration?.() || 0);
      const st = p.getPlayerState?.();
      setNeedTap(wantRef.current?.playState === 'playing' && (st === -1 || st === 5 || st === 2));
    }, 500);
    return () => clearInterval(t);
  }, []);

  const emit = (evt: string, payload?: any) => socketRef.current?.emit(evt, payload);
  // Host/Moderator act directly; participants send a request that needs approval.
  const act = (type: string, payload: any = {}) => canControl ? emit(type, payload) : emit('request_action', { type, payload });

  const copy = (v: string) => { navigator.clipboard?.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const link = `${window.location.origin}/room/${roomId}`;
  const leave = () => { emit('leave_room'); sessionStorage.removeItem('wp:' + roomId); window.location.assign('/'); };

  if (fatal) return (
    <main className="site-shell center-screen"><div className="dialog"><h2>{fatal}</h2>
      <button className="button dialog-button" onClick={() => window.location.assign('/')}>Back to home</button></div></main>
  );

  const sorted = [...people].sort((a, b) => ['host', 'moderator', 'participant'].indexOf(a.role) - ['host', 'moderator', 'participant'].indexOf(b.role));

  return (
    <main className="site-shell room-shell">
      <header className="room-head">
        <button className="brand" onClick={() => window.location.assign('/')}><span className="brand-watch">Watch</span><span>Party</span></button>
        <div className="room-code">
          <span>Room <b>{roomId}</b></span>
          <button className="icon-btn" onClick={() => copy(roomId)} title="Copy code">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
          <button className="icon-btn wide" onClick={() => copy(link)}>Copy link</button>
        </div>
        <div className="room-me"><RoleBadge role={role} /> {username}
          <button className="icon-btn" onClick={leave} title="Leave room"><LogOut size={16} /></button></div>
      </header>

      <div className="room-grid">
        <section className="stage">
          <div className="player-box">
            <div className="player-wrap" ref={wrapRef} />
            <div className="player-block" />
            {needTap && <button className="tap-btn" onClick={() => wantRef.current && applyState(wantRef.current)}><Volume2 size={18} /> Tap to join playback</button>}
            <div className="floats">{floats.map((f) => <span key={f.id} style={{ left: f.left + '%' }}>{f.emoji}</span>)}</div>
          </div>

          <div className="controls">
            <button className="button ctl" onClick={() => act(playing ? 'pause' : 'play')}>
              {playing ? <Pause size={18} /> : <Play size={18} />} {canControl ? (playing ? 'Pause' : 'Play') : playing ? 'Request pause' : 'Request play'}
            </button>
            <span className="time">{fmt(cur)}</span>
            <input type="range" className="seek" min={0} max={Math.max(dur, 1)} step={1} value={Math.min(cur, dur || 1)}
              onChange={(e) => { dragRef.current = true; setCur(Number(e.target.value)); }}
              onPointerUp={(e) => { dragRef.current = false; act('seek', { time: Number((e.target as HTMLInputElement).value) }); }}
              onKeyUp={(e) => act('seek', { time: Number((e.target as HTMLInputElement).value) })} />
            <span className="time">{fmt(dur)}</span>
          </div>
          {!canControl && <p className="hint">You're a participant — your actions are sent to the host/moderators for approval.</p>}

          <form className="url-row" onSubmit={(e) => { e.preventDefault(); if (url.trim()) { act('change_video', { videoId: url.trim() }); setUrl(''); } }}>
            <Youtube size={18} />
            <input className="field" placeholder="Paste a YouTube link or video ID" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="button ctl">{canControl ? 'Change video' : 'Request change'}</button>
          </form>
          <p className="hint small">Now playing: {vid}</p>
        </section>

        <aside className="side">
          {canControl && requests.length > 0 && (
            <div className="panel">
              <h3>Pending requests ({requests.length})</h3>
              {requests.map((r) => (
                <div className="req" key={r.id}>
                  <span><b>{r.username}</b> wants to {LABEL[r.type]}{r.type === 'seek' ? ` → ${fmt(r.payload.time)}` : ''}{r.type === 'change_video' ? ` (${String(r.payload.videoId).slice(0, 28)})` : ''}</span>
                  <button className="icon-btn ok" onClick={() => emit('resolve_request', { requestId: r.id, approve: true })}><Check size={15} /></button>
                  <button className="icon-btn no" onClick={() => emit('resolve_request', { requestId: r.id, approve: false })}><X size={15} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="panel">
            <h3>Participants ({people.length})</h3>
            {sorted.map((p) => (
              <div className="person" key={p.userId}>
                <span className={'dot ' + (p.online ? 'on' : '')} />
                <span className="pname">{p.username}{p.userId === meId && ' (you)'}</span>
                <RoleBadge role={p.role} />
                {role === 'host' && p.role !== 'host' && (
                  <span className="pact">
                    <select value={p.role} onChange={(e) => emit('assign_role', { userId: p.userId, role: e.target.value })}>
                      <option value="participant">Participant</option><option value="moderator">Moderator</option>
                    </select>
                    <button className="icon-btn" title="Make host" onClick={() => window.confirm(`Transfer host to ${p.username}?`) && emit('transfer_host', { userId: p.userId })}><Crown size={14} /></button>
                    <button className="icon-btn no" title="Remove" onClick={() => emit('remove_participant', { userId: p.userId })}><UserX size={14} /></button>
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="panel chat">
            <h3>Chat</h3>
            <div className="msgs" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
              {chat.length === 0 && <p className="hint small">No messages yet.</p>}
              {chat.map((m) => <p key={m.id}><b className={'r-' + m.role}>{m.username}</b> {m.text}</p>)}
            </div>
            <div className="emoji-row">{EMOJIS.map((e) => <button key={e} onClick={() => emit('reaction', { emoji: e })}>{e}</button>)}</div>
            <form className="chat-row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { emit('chat_message', { text }); setText(''); } }}>
              <input className="field" placeholder="Say something…" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} />
              <button className="icon-btn send"><Send size={16} /></button>
            </form>
          </div>
        </aside>
      </div>

      <div className="toasts">{toasts.map((t) => <div key={t.id}>{t.text}</div>)}</div>
    </main>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return <span className={'badge b-' + role}>{role === 'host' ? <Crown size={11} /> : role === 'moderator' ? <Shield size={11} /> : null}{role}</span>;
}
