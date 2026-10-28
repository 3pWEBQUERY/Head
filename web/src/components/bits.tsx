import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { KINDS, MOODS } from '../../../shared/constants';
import { colorFor, initials } from '../lib/format';
import { applyTheme, useTheme } from '../lib/theme';
import type { Person, RoomRef } from '../types';
import { IMask } from './Icons';

export function Avatar({ person, size = '', className = '' }: { person: Person | null; size?: '' | 'xs' | 'sm' | 'lg' | 'xl'; className?: string }) {
  if (!person) {
    return <span className={`avatar anon ${size} ${className}`} aria-label="Anonym"><IMask size={size === 'xs' ? 12 : size === 'sm' ? 14 : 18} /></span>;
  }
  return (
    <span className={`avatar ${size} ${className}`} style={{ background: person.avatar ? undefined : colorFor(person.handle) }} aria-hidden="true">
      {person.avatar ? <img src={person.avatar} alt="" loading="lazy" /> : initials(person.name)}
    </span>
  );
}

const LIGHT_ROOM = new Set(['#CCCACC', '#ECDFD2', '#E6AE2C']);
export function RoomIcon({ room, size = '' }: { room: RoomRef; size?: '' | 'xs' | 'lg' | 'xl' }) {
  return (
    <span className={`ci ${size}`} style={{ background: room.color, color: LIGHT_ROOM.has(room.color) ? '#081849' : undefined }} aria-hidden="true">
      {room.name[0]}
    </span>
  );
}

export function KindTag({ kind }: { kind: keyof typeof KINDS }) {
  return <span className="kind" style={{ ['--tc' as any]: KINDS[kind].color }}>{KINDS[kind].label}</span>;
}

export function MoodTag({ mood }: { mood: keyof typeof MOODS }) {
  const m = MOODS[mood];
  return (
    <span className="flag" title={`Stimmung: ${m.label}`}>
      <i className="mood-dot" style={{ ['--mc' as any]: m.color }} />
      {m.label}
    </span>
  );
}

export function ThemeToggle() {
  const [theme] = useTheme();
  const dark = theme === 'dark';
  return (
    <button className="tg" type="button" role="switch" aria-checked={dark} aria-label="Dunkles Design" onClick={() => applyTheme(dark ? 'light' : 'dark')}>
      <span className="tg-layer tg-day" aria-hidden="true">
        <i className="ring r1" /><i className="ring r2" /><i className="ring r3" />
        <i className="cloud c1" /><i className="cloud c2" /><i className="cloud c3" /><i className="cloud c4" /><i className="cloud c5" />
      </span>
      <span className="tg-layer tg-night" aria-hidden="true">
        <i className="ring r1" /><i className="ring r2" /><i className="ring r3" />
        <i className="star x" style={{ left: 10, top: 7 }} />
        <i className="star s" style={{ left: 24, top: 9 }} />
        <i className="star m" style={{ left: 15, top: 21 }} />
        <i className="star s" style={{ left: 29, top: 24 }} />
        <i className="star x" style={{ left: 30, top: 14 }} />
        <i className="star s" style={{ left: 6, top: 25 }} />
      </span>
      <span className="knob" aria-hidden="true">
        <span className="sun" />
        <span className="moon"><i className="crater cr1" /><i className="crater cr2" /><i className="crater cr3" /></span>
      </span>
    </button>
  );
}

/** Klick ausserhalb und Escape schliessen. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
}

export function Menu({ button, children, label }: { button: ReactNode; children: (close: () => void) => ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useDismiss(open, close);
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {button}
      </button>
      {open && <div className="menu" role="menu">{children(close)}</div>}
    </div>
  );
}

export function Dialog({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="dialog-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>,
    document.body,
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Spinner() {
  return <div className="loading"><div className="spinner" aria-label="Lädt" /></div>;
}

export function Skeletons({ n = 3 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div className="skeleton" key={i} aria-hidden="true">
          <i style={{ width: '38%' }} /><i style={{ width: '72%', height: 18 }} /><i style={{ width: '92%' }} /><i style={{ width: '64%' }} />
        </div>
      ))}
    </>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
