import { localDay } from '../lib/format';
import type { CalendarDay } from '../types';

/** Schreibkalender: eine Spalte pro Woche, Montag oben. */
export function Heatmap({ days, weeks = 26, cell }: { days: CalendarDay[]; weeks?: number; cell?: number }) {
  const by = new Map(days.map((d) => [d.day, d]));
  const today = new Date();
  const todayKey = localDay(today);
  const dow = (today.getDay() + 6) % 7; // 0 = Montag
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = localDay(d);
    const e = by.get(key);
    const future = d > today && key !== todayKey;
    const level = !e ? 0 : e.words >= 1000 ? 4 : e.words >= 400 ? 3 : e.words >= 120 ? 2 : 1;
    const title = future ? undefined : `${d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })}: ${e ? `${e.posts} ${e.posts === 1 ? 'Text' : 'Texte'}, ${e.words} Wörter` : 'nichts geschrieben'}`;
    cells.push(<i key={key} data-l={level} className={key === todayKey ? 'today' : future ? 'future' : undefined} title={title} />);
  }
  return (
    <div className="heat-wrap">
      <div className="heat" style={{ gridTemplateColumns: `repeat(${weeks}, ${cell ? `${cell}px` : '1fr'})` }} role="img" aria-label={`Schreibkalender der letzten ${weeks} Wochen`}>
        {cells}
      </div>
    </div>
  );
}
