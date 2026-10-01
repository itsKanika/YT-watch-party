import Landing from './Landing';
import Room from './Room';

export default function App() {
  const m = window.location.pathname.match(/^\/room\/([A-Za-z0-9]+)/);
  return m ? <Room roomId={m[1].toUpperCase()} /> : <Landing />;
}
