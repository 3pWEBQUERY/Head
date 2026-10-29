import { Fragment, type ReactNode } from 'react';

/**
 * Bewusst kleines Textformat: Absätze, Zeilenumbrüche, *kursiv*, **fett**,
 * > Zitate, Links und Szenenwechsel (*** oder ---). Kein HTML, kein Markdown-Zoo.
 */
export function Prose({ text, verse = false, className = '' }: { text: string; verse?: boolean; className?: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.replace(/^\n+|\n+$/g, '')).filter(Boolean);
  return (
    <div className={`prose${verse ? ' verse' : ''} ${className}`}>
      {blocks.map((b, i) => {
        if (/^(\*\s*\*\s*\*|-{3,}|⁂)$/.test(b.trim())) return <div key={i} className="scene" aria-hidden="true">· · ·</div>;
        if (b.split('\n').every((l) => l.startsWith('>'))) {
          return <blockquote key={i}>{lines(b.split('\n').map((l) => l.replace(/^>\s?/, '')).join('\n'))}</blockquote>;
        }
        return <p key={i}>{lines(b)}</p>;
      })}
    </div>
  );
}

function lines(s: string): ReactNode {
  const ls = s.split('\n');
  return ls.map((l, i) => (
    <Fragment key={i}>
      {inline(l)}
      {i < ls.length - 1 && <br />}
    </Fragment>
  ));
}

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s<]+[^\s<.,;:!?)\]"'»])/g;

export function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    const t = m[0];
    if (m.index! > last) out.push(s.slice(last, m.index));
    if (t.startsWith('**')) out.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('*') || t.startsWith('_')) out.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    else out.push(<a key={m.index} href={t} target="_blank" rel="noopener noreferrer nofollow ugc">{t.replace(/^https?:\/\/(www\.)?/, '')}</a>);
    last = m.index! + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Klartext für Vorschauen: Formatierungszeichen entfernen. */
export function plain(s: string) {
  return s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, '$1$2').replace(/^>\s?/gm, '').replace(/^(\*\s*\*\s*\*|-{3,})$/gm, '·');
}
