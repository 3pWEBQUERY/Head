import type { JSONContent } from '@tiptap/core';

/* Lapis-Textformat ⇄ Editor-Dokument. Ohne JSX, damit es auch serverseitig testbar ist. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineHtml(s: string): string {
  return esc(s)
    .replace(/\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\s)([^*\n]+?)(?<!\s)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?!\s)([^_\n]+?)(?<!\s)_(?!\w)/g, '$1<em>$2</em>');
}

const lineHtml = (block: string) => block.split('\n').map(inlineHtml).join('<br>');

export function toHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.replace(/^\n+|\n+$/g, '')).filter(Boolean);
  if (!blocks.length) return '';
  return blocks.map((b) => {
    if (/^(\*\s*\*\s*\*|-{3,}|⁂)$/.test(b.trim())) return '<hr>';
    const lines = b.split('\n');
    if (lines.every((l) => l.startsWith('>'))) return `<blockquote><p>${lineHtml(lines.map((l) => l.replace(/^>\s?/, '')).join('\n'))}</p></blockquote>`;
    return `<p>${lineHtml(b)}</p>`;
  }).join('');
}

function inlineText(nodes: JSONContent[] = []): string {
  return nodes.map((n) => {
    if (n.type === 'hardBreak') return '\n';
    if (n.type !== 'text' || !n.text) return '';
    const marks = new Set((n.marks ?? []).map((m) => m.type));
    const m = n.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    let core = m[2];
    if (!core) return n.text;
    // Fett+kursiv als **_…_**, damit die Zeichen eindeutig bleiben.
    if (marks.has('italic')) core = marks.has('bold') ? `_${core}_` : `*${core}*`;
    if (marks.has('bold')) core = `**${core}**`;
    return m[1] + core + m[3];
  }).join('');
}

function blockText(n: JSONContent): string {
  switch (n.type) {
    case 'paragraph': return inlineText(n.content).replace(/\s+$/, '');
    case 'horizontalRule': return '***';
    case 'blockquote':
      return (n.content ?? []).map(blockText).filter(Boolean)
        .map((t) => t.split('\n').map((l) => `> ${l}`).join('\n')).join('\n\n');
    default: return (n.content ?? []).map(blockText).join('\n\n');
  }
}

export function fromDoc(doc: JSONContent): string {
  return (doc.content ?? []).map(blockText).filter((b) => b.trim()).join('\n\n');
}
