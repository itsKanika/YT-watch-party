
export const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'https://yt-watch-party-wy65.onrender.com' : window.location.origin);

export type Role = 'host' | 'moderator' | 'participant';
export interface Person { userId: string; username: string; role: Role; online: boolean }
export interface Session { token: string; username: string }

export const getSession = (roomId: string): Session | null => {
  try { return JSON.parse(sessionStorage.getItem('wp:' + roomId) || 'null'); } catch { return null; }
};
export const setSession = (roomId: string, s: Session) => sessionStorage.setItem('wp:' + roomId, JSON.stringify(s));

export const fmt = (t: number) => {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
};
