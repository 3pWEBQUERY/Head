import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { KINDS } from '../../../shared/constants';
import { ago, fmt } from '../lib/format';
import type { Room } from '../types';
import { IBack } from './Icons';
import { plain } from './Prose';
import { useJoin } from './Sidebar';

export function RoomCard({ room }: { room: Room }) {
  const join = useJoin();
  const l = room.latest;
  return (
    <article className="rcard" style={{ ['--rc' as any]: room.color }} aria-labelledby={`room-${room.slug}`}>
      <div className="rcard-head">
        <span className="rcard-rings" aria-hidden="true"><i /><i /><i /></span>
        <span className="rcard-badge">{room.official ? 'Von Lapis' : 'Aus der Community'}</span>
        <h3 id={`room-${room.slug}`}><Link className="stretch" to={`/raum/${room.slug}`}>{room.name}</Link></h3>
      </div>
      <div className="rcard-body">
        <p className="rcard-desc">{room.description}</p>
        {l ? (
          <Link className="rcard-latest" to={`/text/${l.id}`}>
            <span className="rcard-latest-meta">{KINDS[l.kind]?.label ?? 'Text'} · {ago(l.publishedAt)}</span>
            <span className="rcard-quote">{l.title || plain(l.excerpt)}</span>
          </Link>
        ) : (
          <div className="rcard-latest is-empty">
            <span className="rcard-latest-meta">Noch still hier</span>
            <span className="rcard-quote">Der erste Text gehört dir.</span>
          </div>
        )}
        <div className="rcard-foot">
          <dl className="rcard-stats">
            <div><dt>Mitglieder</dt><dd>{fmt(room.stats.members)}</dd></div>
            <div><dt>diese Woche</dt><dd>{fmt(room.stats.postsWeek)}</dd></div>
          </dl>
          <button type="button" className={`btn btn-sm ${room.joined ? 'btn-quiet' : 'btn-primary'}`} aria-pressed={room.joined} onClick={() => join(room)}>
            {room.joined ? 'Dabei' : 'Beitreten'}
          </button>
        </div>
      </div>
    </article>
  );
}

export function RoomGrid({ rooms }: { rooms: Room[] }) {
  return <div className="room-grid">{rooms.map((r) => <RoomCard key={r.slug} room={r} />)}</div>;
}

/** Zwei Karten pro Seite, wischbar, mit Pfeilen, Punkten und Pfeiltasten. */
export function RoomSlider({ rooms, title = 'Räume' }: { rooms: Room[]; title?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rooms.length / 2));

  // Eine Seite = sichtbare Breite + Spaltenabstand (der Abstand kommt aus dem CSS, mobil ist er kleiner).
  const pageWidth = (el: HTMLElement) => el.clientWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
  const go = useCallback((p: number) => {
    const el = track.current;
    if (!el) return;
    const target = Math.max(0, Math.min(pages - 1, p));
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: target * pageWidth(el), behavior: smooth ? 'smooth' : 'auto' });
  }, [pages]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPage(Math.round(el.scrollLeft / pageWidth(el))));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [rooms.length]);

  if (!rooms.length) return null;
  return (
    <section className="rslider" aria-roledescription="Karussell" aria-label={title}>
      <div className="rslider-head">
        <div className="label">{title}</div>
        <div className="rslider-nav">
          <Link className="rslider-all" to="/raeume">Alle Räume</Link>
          <button type="button" className="icon-btn sm rslider-arrow" aria-label="Vorherige Räume" disabled={page <= 0} onClick={() => go(page - 1)}><IBack size={16} /></button>
          <button type="button" className="icon-btn sm rslider-arrow" aria-label="Nächste Räume" disabled={page >= pages - 1} onClick={() => go(page + 1)}><IBack size={16} style={{ transform: 'scaleX(-1)' }} /></button>
        </div>
      </div>
      <div
        ref={track}
        className="rslider-track"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(page + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(page - 1); }
        }}
      >
        {rooms.map((r, i) => (
          <div key={r.slug} className="rslider-slide" aria-roledescription="Folie" aria-label={`${i + 1} von ${rooms.length}`}>
            <RoomCard room={r} />
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="rslider-dots" role="tablist" aria-label="Seite wählen">
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} type="button" role="tab" aria-selected={page === i} aria-label={`Seite ${i + 1} von ${pages}`} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </section>
  );
}
