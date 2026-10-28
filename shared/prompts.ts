// Ein Impuls pro Tag. Alle sehen am selben Tag denselben – so entstehen
// viele Antworten auf eine Frage. Die Reihenfolge ist fest, damit der Impuls
// eines Datums immer gleich bleibt.

export const PROMPTS: string[] = [
  'Was hast du heute gesehen, das niemand sonst bemerkt hat?',
  'Schreib über ein Geräusch aus deiner Kindheit.',
  'Ein Satz, den du nie gesagt hast, aber hättest sagen sollen.',
  'Beschreibe dein Zimmer so, als wärst du zum ersten Mal darin.',
  'Was wolltest du heute eigentlich tun?',
  'Ein Brief an die Person, die du vor fünf Jahren warst.',
  'Die kleinste gute Sache dieser Woche.',
  'Jemand klingelt um drei Uhr nachts. Wer steht vor der Tür?',
  'Was riecht für dich nach Zuhause?',
  'Schreib über etwas, das du verloren hast – nicht unbedingt einen Gegenstand.',
  'Ein Gespräch, das du im Zug mitgehört hast. Erfunden oder nicht.',
  'Was würdest du tun, wenn heute niemand von dir etwas erwarten würde?',
  'Beschreibe einen Menschen nur über seine Hände.',
  'Wofür bist du heute dankbar, obwohl der Tag schwer war?',
  'Die erste Zeile eines Romans, den du nie schreiben wirst.',
  'Ein Ort, an den du nicht zurückkehren kannst.',
  'Was hat dich heute wütend gemacht? Schreib es raus.',
  'Ein Gedicht mit genau sieben Zeilen.',
  'Was hat dir heute jemand beigebracht, ohne es zu merken?',
  'Schreib aus der Sicht eines Gegenstands auf deinem Tisch.',
  'Ein Moment, in dem du dich richtig verstanden gefühlt hast.',
  'Was ist das Mutigste, das du in letzter Zeit getan hast?',
  'Erzähl von einem Abend, der anders lief als geplant.',
  'Eine Liste: Dinge, die mir gerade Hoffnung machen.',
  'Was würdest du heute einem Menschen sagen, der genau das erlebt, was du gerade erlebst?',
  'Das Wetter heute – als Spiegel deiner Stimmung.',
  'Ein Geheimnis, das eigentlich gar keins ist.',
  'Schreib über ein Lied, das du nicht mehr hören kannst.',
  'Eine Geschichte in genau hundert Wörtern.',
  'Was lässt du heute los?',
  'Beschreibe die Stille in deiner Wohnung.',
  'Ein Brief an jemanden, der nicht mehr da ist.',
  'Was hast du als Kind geglaubt, das nicht stimmte?',
  'Der Moment kurz vor dem Einschlafen.',
  'Ein Streit, aus der Sicht der anderen Person erzählt.',
  'Welche Gewohnheit möchtest du behalten, egal was passiert?',
  'Eine Begegnung mit einem Tier.',
  'Was steht auf deiner inneren Liste von „irgendwann“?',
  'Schreib über ein Foto, das es nicht gibt.',
  'Der beste Rat, den du je ignoriert hast.',
  'Ein Tag aus deinem Leben in zehn Jahren.',
  'Was macht dich weich?',
  'Eine Szene, die nur aus Dialog besteht.',
  'Wo warst du, als du dich zuletzt frei gefühlt hast?',
  'Schreib über Hunger – im wörtlichen oder anderen Sinn.',
  'Ein Kompliment, das du nie vergessen hast.',
  'Was würdest du in einen Brief an Fremde schreiben?',
  'Der Weg, den du jeden Tag gehst – diesmal ganz genau.',
  'Was hat dich heute überrascht?',
  'Eine Erinnerung, bei der du dir nicht sicher bist, ob sie echt ist.',
  'Schreib über das Warten.',
  'Ein Satz von heute, den du festhalten willst.',
  'Was bedeutet „genug“ für dich?',
  'Eine Geschichte, die mit „Eigentlich“ beginnt.',
  'Das letzte Mal, dass du richtig gelacht hast.',
  'Was würdest du gern besser verstehen?',
  'Ein Gedicht über einen ganz gewöhnlichen Dienstag.',
  'Wen vermisst du gerade, ohne es jemandem zu sagen?',
  'Beschreibe eine Farbe für jemanden, der sie nie gesehen hat.',
  'Was hat heute gut getan?',
];

const DAY = 86_400_000;

/** Tag als YYYY-MM-DD in Europe/Zurich, damit der Impuls um Mitternacht wechselt. */
export function dayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function promptForDay(day: string): { day: string; text: string; index: number } {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / DAY);
  const index = ((n % PROMPTS.length) + PROMPTS.length) % PROMPTS.length;
  return { day, text: PROMPTS[index], index };
}
