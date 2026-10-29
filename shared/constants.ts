// Gemeinsame Begriffe für Server, Web und später die nativen Apps.

export const KINDS = {
  moment: { label: 'Moment', hint: 'Etwas, das heute passiert ist', color: '#893172' },
  tagebuch: { label: 'Tagebuch', hint: 'Für dich, für später, für jemanden', color: '#5F3475' },
  geschichte: { label: 'Geschichte', hint: 'Kurz, lang, wahr oder erfunden', color: '#213885' },
  gedicht: { label: 'Gedicht', hint: 'Zeilenumbrüche bleiben erhalten', color: '#B0567E' },
  brief: { label: 'Brief', hint: 'An jemanden, der ihn nie lesen wird', color: '#7A5A3C' },
  gedanke: { label: 'Gedanke', hint: 'Halbfertig ist erlaubt', color: '#4A68C2' },
} as const;
export type Kind = keyof typeof KINDS;
export const KIND_KEYS = Object.keys(KINDS) as Kind[];

// Stimmung: bewusst Worte statt Emojis. Die IDs 1–5 sind die ursprünglichen,
// neue kommen hinten dazu, damit bestehende Texte ihre Stimmung behalten.
export const MOODS = {
  1: { label: 'schwer', color: '#213885' },
  2: { label: 'grau', color: '#868896' },
  3: { label: 'ruhig', color: '#9A8C7A' },
  4: { label: 'gut', color: '#B0567E' },
  5: { label: 'hell', color: '#E6AE2C' },
  6: { label: 'traurig', color: '#4A68C2' },
  7: { label: 'müde', color: '#6F7390' },
  8: { label: 'wütend', color: '#B23A3A' },
  9: { label: 'unruhig', color: '#C27A2C' },
  10: { label: 'einsam', color: '#5A5E7A' },
  11: { label: 'nachdenklich', color: '#5F3475' },
  12: { label: 'dankbar', color: '#3FA874' },
  13: { label: 'erleichtert', color: '#6CB4A8' },
  14: { label: 'verliebt', color: '#D45B8A' },
  15: { label: 'stolz', color: '#893172' },
  16: { label: 'aufgeregt', color: '#F0A23B' },
} as const;
export type Mood = keyof typeof MOODS;
export const MOOD_MAX = 16;

/** Anzeige von schwer nach hell, in drei Gruppen. */
export const MOOD_GROUPS: { label: string; moods: Mood[] }[] = [
  { label: 'Schwer', moods: [1, 6, 10, 8, 9] },
  { label: 'Dazwischen', moods: [7, 2, 3, 11, 13] },
  { label: 'Hell', moods: [12, 4, 14, 15, 16, 5] },
];
export const MOOD_ORDER: Mood[] = MOOD_GROUPS.flatMap((g) => g.moods);

// Resonanz statt Upvotes. Kein Daumen runter: hier wird nichts weggestimmt.
export const RESONANCE = {
  kenn_ich: { label: 'Kenn ich', past: 'kennt das' },
  beruehrt: { label: 'Berührt', past: 'war berührt' },
  stark: { label: 'Stark geschrieben', past: 'findet es stark geschrieben' },
  geschmunzelt: { label: 'Geschmunzelt', past: 'hat geschmunzelt' },
} as const;
export type Resonance = keyof typeof RESONANCE;
export const RESONANCE_KEYS = Object.keys(RESONANCE) as Resonance[];

export const VISIBILITY = {
  public: { label: 'Alle', hint: 'Sichtbar für alle, auch ohne Konto' },
  followers: { label: 'Wer mir folgt', hint: 'Nur für Menschen, die dir folgen' },
  private: { label: 'Nur ich', hint: 'Dein privates Tagebuch' },
} as const;
export type Visibility = keyof typeof VISIBILITY;

// Wie darf geantwortet werden?
export const RESPONSE_MODES = {
  open: { label: 'Gespräch', hint: 'Kommentare willkommen' },
  feedback: { label: 'Werkstatt', hint: 'Ehrliche Kritik ausdrücklich erwünscht' },
  listen: { label: 'Nur zuhören', hint: 'Keine Kommentare, nur Resonanz' },
} as const;
export type ResponseMode = keyof typeof RESPONSE_MODES;

export const LIMITS = {
  title: 140,
  body: 60_000,
  comment: 4_000,
  bio: 280,
  displayName: 40,
  contentWarning: 80,
  roomName: 40,
  roomDescription: 280,
} as const;

export const WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
  return m ? m.length : 0;
}
