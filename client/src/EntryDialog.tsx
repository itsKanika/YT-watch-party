import { useState } from 'react';
import { ArrowRight, LogIn, Sparkles, X, Youtube } from 'lucide-react';
import { SERVER_URL, setSession } from './lib';

export type DialogKind = 'started' | 'joined' | 'youtube';

export default function EntryDialog({ kind, onClose }: { kind: DialogKind; onClose: () => void }) {
  const joining = kind === 'joined';
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) return setError('Enter your name');
    setBusy(true);
    try {
      if (joining) {
        let id = code.trim();
        const m = id.match(/room\/([A-Za-z0-9]+)/); // accept pasted links too
        if (m) id = m[1];
        id = id.toUpperCase();
        if (!id) throw new Error('Enter a room code');
        const r = await fetch(`${SERVER_URL}/api/rooms/${id}`);
        if (!r.ok) throw new Error('Room not found');
        sessionStorage.removeItem('wp:' + id);
        window.location.assign('/room/' + id + '?n=' + encodeURIComponent(username.trim()));
      } else {
        const r = await fetch(`${SERVER_URL}/api/rooms`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim() }),
        });
        if (!r.ok) throw new Error('Could not create room');
        const d = await r.json();
        setSession(d.roomId, { token: d.token, username: username.trim() });
        window.location.assign('/room/' + d.roomId);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="dialog" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="dialog-mark">{joining ? <LogIn size={20} /> : kind === 'youtube' ? <Youtube size={20} /> : <Sparkles size={20} />}</div>
        <p className="eyebrow">{joining ? 'Welcome to the room' : 'Your next watch party'}</p>
        <h2>{joining ? 'Enter your room code.' : 'Ready when you are.'}</h2>
        <p className="dialog-copy">{joining ? 'Paste the room code or link your host shared with you.' : 'You become the host and can hand out roles to everyone who joins.'}</p>
        <input className="field" placeholder="Your name" value={username} maxLength={24} onChange={(e) => setUsername(e.target.value)} autoFocus />
        {joining && <input className="field" placeholder="Room code e.g. K7M2QX" value={code} onChange={(e) => setCode(e.target.value)} />}
        {error && <p className="form-error">{error}</p>}
        <button className="button dialog-button" disabled={busy}>{busy ? 'Please wait…' : joining ? 'Join the room' : 'Create my room'} <ArrowRight size={16} /></button>
      </form>
    </div>
  );
}
