import { useState } from 'react';
import EntryDialog, { type DialogKind } from './EntryDialog';
import {
  ArrowRight,
  Check,
  Clock3,
  LockKeyhole,
  LogIn,
  Menu,
  MessageCircle,
  MonitorPlay,
  Plus,
  Radio,
  Sparkles,
  Users,
  X,
  Youtube,
} from 'lucide-react';


const roomTypes = [
  { icon: Users, title: 'Public room', copy: 'Open to everyone' },
  { icon: LockKeyhole, title: 'Private room', copy: 'Invite only' },
  { icon: Clock3, title: 'Scheduled room', copy: 'Plan ahead' },
];

export default function Landing() {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grain" />

      <header className="site-header">
        <button className="brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="WatchParty home">
          <span className="brand-watch">Watch</span><span>Party</span>
        </button>

        <nav className={mobileMenuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Main navigation">
          <button className="nav-link active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
          <button className="nav-link" onClick={scrollToFeatures}>Features</button>
          <button className="nav-link" onClick={scrollToFeatures}>About</button>

        </nav>

        <button className="menu-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Toggle menu">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> The better way to be together</div>
          <h1 id="hero-title">Press play.<br /><span>Stay together.</span></h1>
          <p>Pick a video, invite your people, and talk through every scene like you are on the same couch.</p>
          <div className="hero-actions room-actions">
            <button className="button button-large" onClick={() => setDialog('started')}>Create a room <ArrowRight size={17} /></button>
            <button className="button button-large button-join" onClick={() => setDialog('joined')}><LogIn size={17} /> Join a room</button>
          </div>
          <div className="hero-proof"><div className="avatar-stack"><span className="avatar avatar-a">A</span><span className="avatar avatar-b">J</span><span className="avatar avatar-c">M</span><span className="avatar avatar-d">K</span></div><span>Made for movie nights, game days, and your people</span></div>
        </div>

        <div className="hero-visual" aria-label="WatchParty room preview">
          <div className="orbit orbit-large" /><div className="orbit orbit-small" />
          <div className="spark spark-one">+</div><div className="spark spark-two">✦</div><div className="spark spark-three">+</div>
          <div className="reference-art">
            <img src="/hero.png" alt="WatchParty room with friends watching together" />
            <div className="reference-shade" />
            <button className="reference-youtube" onClick={() => setDialog('youtube')} aria-label="Watch YouTube together"><Youtube size={17} fill="currentColor" /></button>
          </div>
          <div className="floating-card card-chat"><div className="floating-icon"><MessageCircle size={16} /></div><div><strong>Live reactions</strong><span>That scene!</span></div><span className="reaction-dot">+</span></div>
          <div className="floating-card card-sync"><div className="floating-icon sync-icon"><Radio size={16} /></div><div><strong>Perfectly in sync</strong><span>Everyone is watching</span></div><Check size={15} className="check-icon" /></div>
          <div className="host-card"><div className="host-avatar"><div className="host-hair" /><div className="host-face" /><span className="host-smile" /></div><div><strong>Sam started the room</strong><span>Come watch with us</span></div><span className="host-heart">+</span></div>
          <div className="red-glow" />
        </div>
      </section>

      {/* <section className="feature-strip" id="features">
        <div className="strip-heading"><span className="eyebrow-dot" /><span>The little things that make watching feel shared</span></div>
        <div className="feature-grid">
          <div className="feature-item"><div className="feature-icon"><MonitorPlay size={20} /></div><div><strong>Watch in sync</strong><p>No one has to ask, “where are we?”</p></div></div>
          <div className="feature-item"><div className="feature-icon"><MessageCircle size={20} /></div><div><strong>Talk in real time</strong><p>React, laugh, and talk without leaving.</p></div></div>
          <div className="feature-item"><div className="feature-icon"><Sparkles size={20} /></div><div><strong>Make it yours</strong><p>Bring your usual movie-night energy.</p></div></div>
        </div>
        <div className="room-types"><span className="room-types-label">Create your kind of room</span>{roomTypes.map(({ icon: Icon, title, copy }) => <button className="room-type" key={title} onClick={() => setDialog('started')}><Icon size={17} /><span><strong>{title}</strong><small>{copy}</small></span><Plus size={15} /></button>)}</div>
      </section> */}












<section className="feature-strip" id="features">
  <div className="feature-header">
    <div className="strip-heading">
      <span className="eyebrow-dot" />
      <span>Everything feels better together</span>
    </div>

    <h2>
      Less ,“Can we meet to WATCH THIS ?”
      <br />
      <span>More , wait “ Let's WATCH THIS.”</span>
    </h2>

    <p className="feature-intro">
      A simple space to watch, react, and hang out with your people
      even when you're miles apart.
    </p>
  </div>

  <div className="feature-grid">
    <div className="feature-item feature-primary">
      <div className="feature-icon">
        <MonitorPlay size={24} />
      </div>

      <div className="feature-content">
        <span className="feature-number">01</span>
        <strong>Always in sync</strong>
        <p>
          Everyone watches the same moment. No pausing to ask,
          “where are we?”
        </p>
      </div>

      <div className="feature-arrow">↗</div>
    </div>

    <div className="feature-item">
      <div className="feature-icon">
        <MessageCircle size={24} />
      </div>

      <div className="feature-content">
        <span className="feature-number">02</span>
        <strong>Talk while you watch</strong>
        <p>
          React, laugh, comment, or completely lose it together
          without leaving the room.
        </p>
      </div>

      <div className="feature-arrow">↗</div>
    </div>

    <div className="feature-item">
      <div className="feature-icon">
        <Sparkles size={24} />
      </div>

      <div className="feature-content">
        <span className="feature-number">03</span>
        <strong>Your room, your vibe</strong>
        <p>
          Movie night, random YouTube rabbit hole, or a late-night
          rewatch — make the room yours.
        </p>
      </div>

      <div className="feature-arrow">↗</div>
    </div>
  </div>

  <div className="room-section">
    <div className="room-section-header">
      <div>
        <span className="room-eyebrow">START WITH A VIBE</span>
        <h3>Create your kind of room</h3>
      </div>

      <p>Pick a mood. Invite your people. Press play.</p>
    </div>

    <div className="room-types">
      {roomTypes.map(({ icon: Icon, title, copy }) => (
        <button
          className="room-type"
          key={title}
          onClick={() => setDialog('started')}
        >
          <div className="room-type-icon">
            <Icon size={19} />
          </div>

          <span className="room-type-content">
            <strong>{title}</strong>
            <small>{copy}</small>
          </span>

          <span className="room-type-add">
            <Plus size={17} />
          </span>
        </button>
      ))}
    </div>
  </div>
</section>















      {dialog && <EntryDialog kind={dialog} onClose={() => setDialog(null)} />}
    </main>
  );
}
