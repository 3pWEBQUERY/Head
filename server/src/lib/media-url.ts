/** Öffentliche URL einer Datei. Relativ, damit Web und native Apps sie gegen ihre Basis-URL auflösen. */
export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/media/${key}` : null;
}
