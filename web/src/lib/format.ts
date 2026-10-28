const rtf = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });

export function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.round(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.round(diff / 3600)} Std.`;
  const d = Math.round(diff / 86400);
  if (d < 7) return d === 1 ? 'gestern' : `vor ${d} Tagen`;
  return dateShort(iso);
}

export function dateShort(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function dateLong(iso: string) {
  return new Date(iso).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function localDay(d: Date | string = new Date()) {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function dayLabel(day: string) {
  const now = new Date();
  if (day === localDay(now)) return 'Heute';
  if (day === localDay(new Date(now.getTime() - 86400000))) return 'Gestern';
  return new Date(day + 'T12:00:00').toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function inFuture(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  return rtf.format(Math.round(diff / 86400), 'day');
}

/** 1234 → 1’234, 12345 → 12.3k (wie im Entwurf) */
export function fmt(n: number): string {
  return Math.abs(n) >= 10000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? '')).toUpperCase();
}

const AVATAR_COLORS = ['#5F3475', '#213885', '#893172', '#4A68C2', '#7A5A3C', '#1B3075'];
export function colorFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function plural(n: number, one: string, many: string) {
  return `${fmt(n)} ${n === 1 ? one : many}`;
}
