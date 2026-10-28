import { KINDS, KIND_KEYS } from '../../../shared/constants';

export type Sort = 'lesenswert' | 'neu' | 'leise';

export const SORTS: { key: Sort; label: string; hint: string }[] = [
  { key: 'lesenswert', label: 'Lesenswert', hint: 'Was gerade Menschen erreicht' },
  { key: 'neu', label: 'Neu', hint: 'Frisch geschrieben' },
  { key: 'leise', label: 'Leise', hint: 'Texte, auf die noch niemand reagiert hat' },
];

export function SortTabs({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  return (
    <div className="seg" role="tablist" aria-label="Sortierung">
      {SORTS.map((s) => (
        <button key={s.key} role="tab" type="button" title={s.hint} aria-selected={value === s.key} onClick={() => onChange(s.key)}>{s.label}</button>
      ))}
    </div>
  );
}

export function KindFilter({ value, onChange }: { value: string | undefined; onChange: (k: string | undefined) => void }) {
  return (
    <div className="kinds" role="group" aria-label="Nach Form filtern">
      <button type="button" className="chip" aria-pressed={!value} onClick={() => onChange(undefined)}>Alles</button>
      {KIND_KEYS.map((k) => (
        <button key={k} type="button" className="chip" aria-pressed={value === k} style={{ ['--tc' as any]: KINDS[k].color }} onClick={() => onChange(value === k ? undefined : k)}>
          <i className="sw" />{KINDS[k].label}
        </button>
      ))}
    </div>
  );
}

/** Merkt sich Sortierung pro Ansicht (nur Komfort, lokal). */
export function remembered<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(`lapis-${key}`) as T) || fallback; } catch { return fallback; }
}
export function remember(key: string, v: string) {
  try { localStorage.setItem(`lapis-${key}`, v); } catch {}
}
