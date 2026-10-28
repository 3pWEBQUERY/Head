import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { api } from '../api';
import { fmt } from '../lib/format';
import { useMe, useOverview, useUnread } from '../lib/queries';
import { useToast } from '../lib/toast';
import { Avatar, Menu, RoomIcon, ThemeToggle } from './bits';
import { BrandMark, IBell, IBookmark, ICompass, IDrafts, IGear, IHome, IJournal, ILogout, IPen, IPlus, IRooms, ISearch, ISpark } from './Icons';

export function AppLayout() {
  const online = useOnline();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Header />
      {!online && <div className="offline-bar" role="status">Du bist offline. Gelesenes bleibt verfügbar, Entwürfe werden lokal gesichert.</div>}
      <Outlet />
      <TabBar />
    </>
  );
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  return async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    // Zwischengespeicherte API-Antworten gehören der abgemeldeten Person.
    try { await caches.delete('lapis-api'); } catch {}
    qc.clear();
    navigate('/');
    toast('Abgemeldet. Bis bald.');
  };
}

function Header() {
  const { me, loading } = useMe();
  const unread = useUnread(Boolean(me));
  const navigate = useNavigate();
  const logout = useLogout();
  const input = useRef<HTMLInputElement>(null);
  const { search } = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(search).get('q') ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = (document.activeElement?.tagName ?? '').toUpperCase();
      if (e.key === '/' && t !== 'INPUT' && t !== 'TEXTAREA' && !(document.activeElement as HTMLElement)?.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="top">
      <div className="top-in">
        <Link className="brand" to="/" aria-label="Lapis Startseite">
          <BrandMark />
          Lapis
        </Link>
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/suche?q=${encodeURIComponent(q.trim())}`); }}>
          <label className="sr" htmlFor="q">Lapis durchsuchen</label>
          <ISearch />
          <input ref={input} id="q" type="search" placeholder="Texte, Räume, Gedanken suchen" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="kbd">/</span>
        </form>
        <div className="top-actions">
          <Link className="btn btn-primary new-post" to="/schreiben" aria-label="Schreiben">
            <IPlus /><span className="btn-label">Schreiben</span>
          </Link>
          {me && (
            <Link className="icon-btn hide-sm" to="/mitteilungen" aria-label={`Mitteilungen${unread.data ? `, ${unread.data} neu` : ''}`}>
              <IBell />
              {!!unread.data && <span className="badge">{unread.data > 99 ? '99+' : unread.data}</span>}
            </Link>
          )}
          <ThemeToggle />
          {me ? (
            <Menu label="Dein Konto" button={<Avatar person={me} />}>
              {(close) => (
                <>
                  <div className="menu-head"><b>{me.name}</b>@{me.handle}</div>
                  <Link to={`/@${me.handle}`} onClick={close}><Avatar person={me} size="xs" /> Profil</Link>
                  <Link to="/tagebuch" onClick={close}><IJournal size={16} /> Mein Tagebuch</Link>
                  <Link to="/entwuerfe" onClick={close}><IDrafts size={16} /> Entwürfe</Link>
                  <Link to="/einstellungen" onClick={close}><IGear size={16} /> Einstellungen</Link>
                  <hr />
                  <button type="button" onClick={() => { close(); logout(); }}><ILogout size={16} /> Abmelden</button>
                </>
              )}
            </Menu>
          ) : !loading && (
            <Link className="btn btn-quiet" to="/anmelden">Anmelden</Link>
          )}
        </div>
      </div>
    </header>
  );
}

function TabBar() {
  const { me } = useMe();
  const unread = useUnread(Boolean(me));
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      <NavLink to="/" end><IHome size={21} />Start</NavLink>
      <NavLink to="/entdecken"><ICompass size={21} />Entdecken</NavLink>
      <NavLink to="/schreiben" className="write" aria-label="Schreiben"><IPen size={20} /></NavLink>
      <NavLink to={me ? '/mitteilungen' : '/impulse'}>
        {me ? <IBell size={21} /> : <ISpark size={21} />}
        {me ? 'Mitteilungen' : 'Impulse'}
        {me && !!unread.data && <span className="badge">{unread.data > 99 ? '99+' : unread.data}</span>}
      </NavLink>
      <NavLink to={me ? `/@${me.handle}` : '/anmelden'}>{me ? <Avatar person={me} size="xs" /> : <IJournal size={21} />}{me ? 'Ich' : 'Anmelden'}</NavLink>
    </nav>
  );
}

function LeftNav() {
  const { me } = useMe();
  const ov = useOverview(Boolean(me));
  const c = ov.data?.counts;
  return (
    <aside className="side left" aria-label="Navigation">
      <nav className="nav">
        <NavLink to="/" end><IHome />Für dich</NavLink>
        <NavLink to="/entdecken"><ICompass />Entdecken</NavLink>
        <NavLink to="/impulse"><ISpark />Impulse</NavLink>
        {me && (
          <>
            <NavLink to="/tagebuch"><IJournal />Mein Tagebuch{!!c?.journal && <span className="count">{fmt(c.journal)}</span>}</NavLink>
            <NavLink to="/gemerkt"><IBookmark />Gemerkt{!!c?.saved && <span className="count">{fmt(c.saved)}</span>}</NavLink>
            <NavLink to="/entwuerfe"><IDrafts />Entwürfe{!!c?.drafts && <span className="count">{fmt(c.drafts)}</span>}</NavLink>
          </>
        )}
      </nav>
      <div className="label nav-label">{me ? 'Deine Räume' : 'Räume'}<Link to="/raeume">Alle</Link></div>
      <nav className="nav">
        {me ? (
          ov.data?.rooms.length ? ov.data.rooms.map((r) => (
            <NavLink key={r.slug} to={`/raum/${r.slug}`}><RoomIcon room={r} /><span className="nav-name">{r.name}</span></NavLink>
          )) : <NavLink to="/raeume"><IRooms />Räume finden</NavLink>
        ) : <NavLink to="/raeume"><IRooms />Alle Räume</NavLink>}
      </nav>
    </aside>
  );
}

export function Shell({ children, right, wide = false }: { children: ReactNode; right?: ReactNode; wide?: boolean }) {
  return (
    <div className={`wrap${right ? '' : ' no-right'}`}>
      <LeftNav />
      <main className={wide ? 'feed wide' : 'feed'} id="main">{children}</main>
      {right && <aside className="side right" aria-label="Kontext">{right}</aside>}
    </div>
  );
}
