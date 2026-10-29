import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: SVGProps<SVGSVGElement>) {
  return { width: size, height: size, viewBox: '0 0 18 18', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...props };
}

const make = (d: ReactNode, def = 18) => ({ size = def, ...p }: P) => <svg {...base(size, p)}>{d}</svg>;

export const IHome = make(<path d="M2.75 8 9 2.75 15.25 8v7.25h-4v-4.5h-4.5v4.5h-4Z" />);
export const ICompass = make(<><circle cx="9" cy="9" r="6.25" /><path d="m11.75 6.25-1.5 4-4 1.5 1.5-4Z" /></>);
export const IBookmark = make(<path className="fillable" d="M4.5 2.75h9v12.5L9 12.25l-4.5 3Z" />);
export const IBell = make(<path d="M4.5 12.5V8a4.5 4.5 0 0 1 9 0v4.5l1.25 1.5H3.25Z M7.25 15.75a1.9 1.9 0 0 0 3.5 0" />, 19);
export const IPlus = make(<path d="M9 3.5v11M3.5 9h11" strokeWidth={1.8} />, 14);
export const ISearch = make(<><circle cx="7.75" cy="7.75" r="5.25" /><path d="m11.75 11.75 3.5 3.5" /></>, 16);
export const IPen = make(<><path d="M12.25 2.75 15.25 5.75 6.5 14.5H3.5v-3Z" /><path d="m10.5 4.5 3 3" /></>);
export const IJournal = make(<><path d="M4 2.75h8.5a1.5 1.5 0 0 1 1.5 1.5v11H5.5A1.5 1.5 0 0 1 4 13.75Z" /><path d="M4 13.75a1.5 1.5 0 0 1 1.5-1.5H14M7 6h4" /></>);
export const ISpark = make(<path d="M9 2.5c.4 3.2 1.4 4.6 4.5 5-3.1.6-4.1 1.8-4.5 5-.4-3.2-1.4-4.4-4.5-5 3.1-.4 4.1-1.8 4.5-5ZM14 12.5c.15 1.1.5 1.6 1.5 1.75-1 .2-1.35.65-1.5 1.75-.15-1.1-.5-1.55-1.5-1.75 1-.15 1.35-.65 1.5-1.75Z" />);
export const IDrafts = make(<><path d="M4.5 2.75h6l3 3v9.5h-9Z" /><path d="M10.5 2.75v3h3M7 9.5h4M7 12h2.5" /></>);
export const IRooms = make(<><rect x="2.75" y="2.75" width="5" height="5" rx="1.5" /><rect x="10.25" y="2.75" width="5" height="5" rx="1.5" /><rect x="2.75" y="10.25" width="5" height="5" rx="1.5" /><rect x="10.25" y="10.25" width="5" height="5" rx="1.5" /></>);
export const IComment = make(<path d="M2.5 3.5h11v7.5H7l-3.5 2.5V11h-1Z" strokeWidth={1.4} />, 16);
export const IShare = make(<path d="M8 2v8M5 5l3-3 3 3M3 9v4.5h10V9" strokeWidth={1.4} />, 16);
export const ISave = make(<path className="fillable" d="M4 2.5h8v11L8 10.75 4 13.5Z" strokeWidth={1.4} />, 16);
export const IBack = make(<path d="M11 3.5 5.5 9l5.5 5.5" />);
export const IClose = make(<path d="m4.5 4.5 9 9m0-9-9 9" />);
export const IMore = make(<><circle cx="4" cy="9" r=".6" fill="currentColor" /><circle cx="9" cy="9" r=".6" fill="currentColor" /><circle cx="14" cy="9" r=".6" fill="currentColor" /></>);
export const ICheck = make(<path d="m3.5 9.5 3.5 3.5 7.5-8" />);
export const IImage = make(<><rect x="2.75" y="3.25" width="12.5" height="11.5" rx="2" /><circle cx="6.5" cy="7" r="1.25" /><path d="m3 13 3.5-3.5 2.5 2.5 2-2 4 4" /></>);
export const ILock = make(<><rect x="3.75" y="8" width="10.5" height="7.25" rx="2" /><path d="M6 8V6a3 3 0 0 1 6 0v2" /></>);
export const IMask = make(<><path d="M2.75 6.5c2-1 4.25-1.25 6.25-.25 2-1 4.25-.75 6.25.25-.25 3.25-1.75 5-3.5 5-1.25 0-2-.75-2.75-1.75-.75 1-1.5 1.75-2.75 1.75-1.75 0-3.25-1.75-3.5-5Z" /><path d="M5.75 8.25h1M11.25 8.25h1" /></>);
export const IClock = make(<><circle cx="9" cy="9" r="6.25" /><path d="M9 5.5V9l2.5 1.5" /></>);
export const IUsers = make(<><circle cx="6.75" cy="6.25" r="2.5" /><path d="M2.5 14.75a4.25 4.25 0 0 1 8.5 0" /><path d="M11.75 4a2.5 2.5 0 0 1 0 4.75M13.25 10.75a4.25 4.25 0 0 1 2.25 4" /></>);
export const IGear = make(<><circle cx="9" cy="9" r="2.25" /><path d="M9 2.25v1.5M9 14.25v1.5M15.75 9h-1.5M3.75 9h-1.5M13.77 4.23l-1.06 1.06M5.29 12.71l-1.06 1.06M13.77 13.77l-1.06-1.06M5.29 5.29 4.23 4.23" /></>);
export const ILogout = make(<path d="M7 3H3.75v12H7M11 5.5 14.5 9 11 12.5M14.5 9H7" />);
export const ILink = make(<path d="M7.5 10.5a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 0 0-4.24-4.24l-.7.7M10.5 7.5a3 3 0 0 0-4.24 0L4.14 9.62a3 3 0 0 0 4.24 4.24l.7-.7" />);
export const IEye = make(<><path d="M1.75 9S4.5 3.75 9 3.75 16.25 9 16.25 9 13.5 14.25 9 14.25 1.75 9 1.75 9Z" /><circle cx="9" cy="9" r="2.25" /></>);
export const IFlag = make(<path d="M4 15.5V3m0 0h8.5l-1.5 3 1.5 3H4" />);
export const ITrash = make(<path d="M3 4.75h12M7.25 2.75h3.5M4.5 4.75l.75 10.5h7.5l.75-10.5M7.5 7.5v5M10.5 7.5v5" />);
export const IEdit = make(<path d="M10.5 3.75 14.25 7.5 7 14.75H3.25V11ZM9 5.25 12.75 9" />);
export const IContinue = make(<path d="M3 5.5h7.5a4 4 0 0 1 0 8H6M5.5 10.5 3 13l2.5 2.5" transform="scale(-1 1) translate(-18 0)" />);
export const IDownload = make(<path d="M9 2.75v9M5.5 8.5 9 12l3.5-3.5M3 15.25h12" />);
export const IHeartHand = make(<path d="M9 14.5S3 11 3 6.75A3 3 0 0 1 9 5.5a3 3 0 0 1 6 1.25C15 11 9 14.5 9 14.5Z" />);
export const ISettings = IGear;
export const IInstall = make(<><rect x="4.75" y="1.75" width="8.5" height="14.5" rx="2" /><path d="M9 5.5v5M7 8.5l2 2 2-2M7.75 13.75h2.5" /></>);

/** Zeichen für die vier Arten von Resonanz. */
export function ResonanceGlyph({ kind, size = 16 }: { kind: string; size?: number }) {
  const p = base(size, { strokeWidth: 1.4 });
  switch (kind) {
    case 'kenn_ich': // zwei überlappende Kreise: „mir auch“
      return <svg {...p}><circle className="fillable" cx="7" cy="9" r="4" /><circle className="fillable" cx="11" cy="9" r="4" /></svg>;
    case 'beruehrt': // Herz
      return <svg {...p}><path className="fillable" d="M9 14.5S3 11 3 6.75A3 3 0 0 1 9 5.5a3 3 0 0 1 6 1.25C15 11 9 14.5 9 14.5Z" /></svg>;
    case 'stark': // Federspitze
      return <svg {...p}><path className="fillable" d="M9 2.5 13.5 8 9 15.5 4.5 8Z" /><path d="M9 8v7.5M7.75 8.5h2.5" /></svg>;
    case 'geschmunzelt': // Lächeln
      return <svg {...p}><circle className="fillable" cx="9" cy="9" r="6.25" /><path d="M6.25 10.25c1.5 1.75 4 1.75 5.5 0M6.75 7h.01M11.25 7h.01" strokeWidth={1.6} /></svg>;
    default:
      return null;
  }
}

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <path d="M13 1.5 24.5 10 13 24.5 1.5 10Z" fill="#213885" />
      <path d="M1.5 10h23L13 24.5Z" fill="#5F3475" />
      <path d="M7 10 13 24.5 19 10Z" fill="#893172" />
    </svg>
  );
}
