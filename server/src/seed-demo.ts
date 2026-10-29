// Beispielinhalte für Entwicklung und Vorschau-Umgebungen. Nicht in Produktion ausführen.
// Aufruf: npm run seed:demo
import { countWords } from '../../shared/constants.js';
import { dayKey } from '../../shared/prompts.js';
import { config } from './config.js';
import { one, pool, q } from './db.js';
import { hashPassword } from './lib/password.js';
import { migrate } from './migrate.js';

if (config.production && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error('Demo-Daten werden in Produktion nicht angelegt (ALLOW_DEMO_SEED=true erzwingt es).');
  process.exit(1);
}

const people = [
  { handle: 'mira.k', name: 'Mira Keller', bio: 'Schreibt im Zug. Meistens zwischen Olten und Bern.' },
  { handle: 'jonas_schreibt', name: 'Jonas', bio: 'Kurzgeschichten, die zu lang geworden sind.' },
  { handle: 'lea.nachts', name: 'Lea', bio: 'Tagebuch seit 2009. Öffentlich seit gestern.' },
  { handle: 'ruth', name: 'Ruth Baumann', bio: 'Pensionierte Lehrerin. Gedichte über Gärten und Enkel.' },
  { handle: 'demo', name: 'Alex Demo', bio: 'Testkonto. Passwort: lapis-demo' },
];

const H = 3600_000;

const posts: Array<{
  who: string; kind: string; room: string | null; title?: string; body: string; mood?: number; hoursAgo: number;
  anonymous?: boolean; cw?: string; mode?: string; cont?: boolean; prompt?: boolean; visibility?: string;
}> = [
  { who: 'mira.k', kind: 'moment', room: 'heute', mood: 5, hoursAgo: 1.5,
    body: 'Im Bus hat mir ein kleines Mädchen ungefragt erklärt, dass Wolken eigentlich „Himmelsschafe“ sind und dass sie nachts im Stall schlafen. Ich habe den ganzen Weg ins Büro aus dem Fenster geschaut und Schafe gezählt.' },
  { who: 'lea.nachts', kind: 'tagebuch', room: 'tagebuch', title: 'Dienstag, 23:40', mood: 2, hoursAgo: 3, mode: 'listen',
    body: 'Heute wieder dieses Gefühl, dass alle anderen wissen, wie man erwachsen ist, und ich nur so tue.\n\nIch habe die Wäsche nicht gemacht. Ich habe Mama nicht zurückgerufen. Ich habe aber eine Stunde lang mit der Nachbarin über ihre Tomaten geredet, und das war vielleicht das Beste am ganzen Tag.\n\nMorgen rufe ich Mama an. Versprochen. Dir, liebes Tagebuch, und mir.' },
  { who: 'jonas_schreibt', kind: 'geschichte', room: 'kurzgeschichten', title: 'Der Leuchtturmwärter von Brienz', hoursAgo: 7, cont: true, mode: 'feedback',
    body: 'Es gibt keinen Leuchtturm am Brienzersee. Das wusste Elias, als er die Stelle annahm, und er wusste es auch an jedem Abend danach, wenn er die vierundneunzig Stufen hinaufstieg, die es nicht gab.\n\nDie Anzeige war in der Zeitung gewesen, zwischen einem Inserat für Kaninchenfutter und einer Todesanzeige: *Leuchtturmwärter gesucht. Erfahrung nicht nötig. Geduld unbedingt.*\n\n***\n\nAm ersten Abend kam niemand. Am zweiten auch nicht. Am dritten Abend, kurz nach neun, stand eine Frau mit einem nassen Koffer unten am Ufer und rief hinauf: „Ist hier noch offen?“\n\nElias schaute auf das Licht, das er nicht hatte, und sagte: „Für Sie schon.“' },
  { who: 'ruth', kind: 'gedicht', room: 'lyrik', title: 'November im Garten', mood: 3, hoursAgo: 11,
    body: 'Die Astern haben aufgegeben,\nnur eine steht noch, trotzig, lila,\nals hätte niemand ihr gesagt,\ndass jetzt die Zeit zum Gehen ist.\n\nIch lasse sie.\nWer bin ich,\neiner Blume\nden Abschied vorzuschreiben.' },
  { who: 'demo', kind: 'brief', room: 'briefe', title: 'An dich, die ich im Gymnasium nicht verteidigt habe', anonymous: true, hoursAgo: 15,
    body: 'Du sassest immer in der zweiten Reihe am Fenster. Als sie dich in der Pause auslachten, wegen deiner Schuhe, habe ich mitgelacht. Nicht laut. Aber ich habe.\n\nIch weiss nicht, was aus dir geworden ist. Ich hoffe, du hast Menschen gefunden, die dich nie auslachen. Und ich hoffe, du hast das alles längst vergessen – auch wenn ich es nicht kann.\n\nEs tut mir leid. Zwanzig Jahre zu spät, aber es tut mir leid.' },
  { who: 'lea.nachts', kind: 'moment', room: 'heute', mood: 1, hoursAgo: 20, cw: 'Trauer', mode: 'listen',
    body: 'Heute vor einem Jahr ist Opa gestorben. Ich habe seine Lieblingsschokolade gekauft, die mit den ganzen Haselnüssen, und sie auf dem Balkon gegessen. Allein. Es hat geregnet. Es war genau richtig so.' },
  { who: 'mira.k', kind: 'gedanke', room: 'gedankenstrich', hoursAgo: 26,
    body: 'Warum fühlt sich ein Sonntagabend um 18 Uhr eigentlich immer an wie das Ende von etwas, obwohl die Woche noch gar nicht angefangen hat?' },
  { who: 'jonas_schreibt', kind: 'moment', room: 'heute', mood: 4, hoursAgo: 30,
    body: 'Erste Absage vom Verlag bekommen. Aber: Die Lektorin hat drei Sätze persönlich dazugeschrieben. Sie mochte den Anfang. Ich nehme das als Sieg.' },
  { who: 'ruth', kind: 'tagebuch', room: 'tagebuch', title: 'Enkeltag', mood: 5, hoursAgo: 40,
    body: 'Noah (6) hat heute beschlossen, dass er Schriftsteller wird. Sein erstes Buch heisst „Der Dinosaurier, der Angst vor Mäusen hatte“ und besteht bisher aus einem Satz und einer sehr grossen Zeichnung.\n\nIch habe ihm gesagt, dass das ein besserer Anfang ist als die meisten, die ich kenne.' },
  { who: 'mira.k', kind: 'geschichte', room: 'fantastisch', title: 'Die Bibliothek der ungeschriebenen Bücher', hoursAgo: 52, cont: true,
    body: 'In der Bibliothek der ungeschriebenen Bücher ist es nie ganz still. Die Regale flüstern. Jedes Buch hier hätte jemand schreiben können – an einem verregneten Nachmittag, in einem Sommer ohne Pläne, in einem Leben, das ein bisschen anders verlaufen wäre.\n\nAnna arbeitet seit elf Jahren hier. Ihre Aufgabe ist einfach: Sie staubt ab. Und manchmal, wenn ein Buch zu laut wird, legt sie die Hand darauf und sagt leise: „Ich weiss. Ich weiss.“' },
  { who: 'demo', kind: 'gedanke', room: 'heute', hoursAgo: 4, prompt: true,
    body: 'Der Geruch von Bügelwäsche. Meine Mutter hat sonntags immer gebügelt und dabei Radio gehört. Wenn ich heute irgendwo frisch gebügelte Hemden rieche, bin ich sofort wieder acht und liege unter dem Tisch mit einem Comic.' },
  { who: 'demo', kind: 'tagebuch', room: null, title: 'Nur für mich', visibility: 'private', hoursAgo: 2, mood: 3,
    body: 'Das hier liest niemand. Gut so. Heute war okay. Nicht mehr, nicht weniger. Ich glaube, „okay“ ist unterschätzt.' },
];

async function main() {
  await migrate(() => {});
  const pw = await hashPassword('lapis-demo');
  const ids: Record<string, string> = {};
  for (const p of people) {
    const u = await one(
      `insert into users (handle, display_name, email, password_hash, bio) values ($1, $2, $3, $4, $5)
       on conflict (handle) do update set bio = excluded.bio returning id`,
      [p.handle, p.name, `${p.handle.replace(/[^a-z0-9]/g, '')}@demo.lapis`, pw, p.bio],
    );
    ids[p.handle] = u.id;
    await q(`insert into room_members (room_id, user_id) select id, $1 from rooms on conflict do nothing`, [u.id]);
  }
  const existing = await one('select count(*)::int as n from posts');
  if (existing.n > 0) {
    console.log('Es gibt schon Texte – Demo-Beiträge werden nicht erneut angelegt.');
    return;
  }
  const created: number[] = [];
  for (const p of posts) {
    const at = new Date(Date.now() - p.hoursAgo * H);
    const room = p.room ? await one('select id from rooms where slug = $1', [p.room]) : null;
    const r = await one(
      `insert into posts (author_id, room_id, status, kind, title, body, mood, visibility, anonymous, content_warning, response_mode,
                          allow_continuation, prompt_day, word_count, created_at, updated_at, published_at)
       values ($1, $2, 'published', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $14) returning id`,
      [ids[p.who], room?.id ?? null, p.kind, p.title ?? '', p.body, p.mood ?? null, p.visibility ?? 'public', p.anonymous ?? false,
        p.cw ?? null, p.mode ?? 'open', p.cont ?? false, p.prompt ? dayKey() : null, countWords(p.body), at],
    );
    created.push(r.id);
  }
  // Etwas Resonanz und ein paar Antworten, aber nicht überall – „Leise“ soll etwas zeigen.
  const kinds = ['kenn_ich', 'beruehrt', 'stark', 'geschmunzelt'];
  const reactors = Object.values(ids);
  for (const [i, id] of created.entries()) {
    if (i % 4 === 3) continue;
    const post = await one('select author_id, visibility from posts where id = $1', [id]);
    if (post.visibility !== 'public') continue;
    for (const [j, u] of reactors.entries()) {
      if (u === post.author_id || (i + j) % 3 === 0) continue;
      await q('insert into reactions (post_id, user_id, kind) values ($1, $2, $3) on conflict do nothing', [id, u, kinds[(i + j) % 4]]);
    }
  }
  const comments: Array<[number, string, string]> = [
    [2, 'ruth', 'Den letzten Satz habe ich zweimal gelesen. Mehr davon, bitte.'],
    [2, 'mira.k', 'Die Kaninchenfutter-Anzeige! Wunderbar. Einzig: Mich hat kurz verwirrt, ob die Frau Teil seiner Fantasie ist – vielleicht ist genau das Absicht?'],
    [0, 'lea.nachts', 'Himmelsschafe. Das klaue ich mir.'],
    [3, 'jonas_schreibt', '„Wer bin ich, einer Blume den Abschied vorzuschreiben.“ – Gänsehaut.'],
    [7, 'ruth', 'Drei persönliche Sätze von einer Lektorin sind Gold wert. Weitermachen!'],
  ];
  for (const [idx, who, body] of comments) {
    await q('insert into comments (post_id, author_id, body, created_at) values ($1, $2, $3, now() - interval \'30 minutes\')', [created[idx], ids[who], body]);
  }
  await q('insert into follows (follower_id, followee_id) values ($1, $2), ($1, $3), ($4, $1) on conflict do nothing', [ids.demo, ids['mira.k'], ids.ruth, ids['lea.nachts']]);
  console.log(`Demo-Daten angelegt: ${people.length} Personen, ${created.length} Texte. Anmelden mit „demo“ / „lapis-demo“.`);
}

main().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
