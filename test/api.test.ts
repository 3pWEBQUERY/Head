import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

process.env.DATABASE_URL ??= 'postgres://postgres@localhost:5432/lapis_test';
process.env.UPLOAD_DIR = '.uploads-test';

const { pool } = await import('../server/src/db.js');
const { migrate } = await import('../server/src/migrate.js');
const { buildApp } = await import('../server/src/app.js');

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App;

async function call(method: string, url: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await app.inject({
    method: method as any,
    url,
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    payload: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.statusCode, json: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}

async function register(handle: string) {
  const r = await call('POST', '/api/auth/register', { body: { handle, name: handle.toUpperCase(), email: `${handle}@example.com`, password: 'geheim1234', native: true } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.token as string;
}

before(async () => {
  await pool.query('drop schema public cascade; create schema public;');
  await migrate(() => {});
  app = await buildApp({ logger: false });
});
after(async () => {
  await app.close();
  await pool.end();
});

describe('Lapis API', () => {
  let ana: string, ben: string, cleo: string;

  test('Registrierung, Login und Cookie-CSRF', async () => {
    ana = await register('ana');
    ben = await register('ben');
    cleo = await register('cleo');
    const dup = await call('POST', '/api/auth/register', { body: { handle: 'ana', name: 'x', email: 'neu@example.com', password: 'geheim1234' } });
    assert.equal(dup.json.code, 'handle_taken');

    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { login: 'ANA@example.com', password: 'geheim1234' } });
    assert.equal(login.statusCode, 200);
    const cookie = login.cookies.find((c) => c.name === 'lapis_session')!;
    assert.ok(cookie.httpOnly);
    // Ohne x-lapis-Header wird eine Cookie-Anfrage abgelehnt.
    const noHeader = await app.inject({ method: 'PATCH', url: '/api/me', cookies: { lapis_session: cookie.value }, payload: { bio: 'hi' } });
    assert.equal(noHeader.statusCode, 403);
    const withHeader = await app.inject({ method: 'PATCH', url: '/api/me', cookies: { lapis_session: cookie.value }, headers: { 'x-lapis': '1' }, payload: { bio: 'Schreibt nachts.' } });
    assert.equal(withHeader.statusCode, 200);
    assert.equal(withHeader.json().user.bio, 'Schreibt nachts.');

    const bad = await call('POST', '/api/auth/login', { body: { login: 'ana', password: 'falsch' } });
    assert.equal(bad.status, 401);
  });

  test('Veröffentlichen, Sichtbarkeit und Anonymität', async () => {
    const pub = await call('POST', '/api/posts', { token: ana, body: { kind: 'moment', body: 'Heute hat mir jemand im Bus seinen Platz angeboten.', room: 'heute', mood: 4, publish: true } });
    assert.equal(pub.status, 200);
    const priv = await call('POST', '/api/posts', { token: ana, body: { kind: 'tagebuch', title: 'Nur für mich', body: 'Geheim.', visibility: 'private', room: 'heute', anonymous: true, publish: true } });
    const anon = await call('POST', '/api/posts', { token: ana, body: { kind: 'brief', title: 'An dich', body: 'Ich vermisse dich.', anonymous: true, room: 'briefe', publish: true } });
    const draft = await call('POST', '/api/posts', { token: ana, body: { kind: 'geschichte', title: 'Entwurf', body: 'Es war einmal' } });
    const followers = await call('POST', '/api/posts', { token: ana, body: { kind: 'gedanke', body: 'Nur für Leute, die mir folgen.', visibility: 'followers', publish: true } });

    // Erweiterte Stimmungen 1–16
    assert.equal((await call('POST', '/api/posts', { token: ana, body: { kind: 'moment', body: 'Aufgeregt!', mood: 16, visibility: 'private', publish: true } })).status, 200);
    assert.equal((await call('POST', '/api/posts', { token: ana, body: { kind: 'moment', body: 'Zu viel', mood: 17, publish: true } })).status, 400);
    const empty = await call('POST', '/api/posts', { token: ana, body: { kind: 'moment', body: '   ', publish: true } });
    assert.equal(empty.json.code, 'empty');

    // Gäste sehen nur Öffentliches, anonyme Texte ohne Autor.
    const guest = await call('GET', '/api/posts?scope=all');
    const ids = guest.json.posts.map((p: any) => p.id);
    assert.ok(ids.includes(pub.json.id));
    assert.ok(ids.includes(anon.json.id));
    assert.ok(!ids.includes(priv.json.id));
    assert.ok(!ids.includes(draft.json.id));
    assert.ok(!ids.includes(followers.json.id));
    assert.equal(guest.json.posts.find((p: any) => p.id === anon.json.id).author, null);

    // Private Einträge: kein Raum, nicht anonym, nur im Tagebuch.
    const journal = await call('GET', '/api/posts?journal=1', { token: ana });
    assert.deepEqual(journal.json.posts.map((p: any) => p.id), [priv.json.id]);
    assert.equal(journal.json.posts[0].room, null);
    assert.equal(journal.json.posts[0].anonymous, false);
    assert.equal((await call('GET', `/api/posts/${priv.json.id}`, { token: ben })).status, 404);

    // Profil zeigt anonyme Texte nicht.
    const profile = await call('GET', '/api/posts?author=ana', { token: ben });
    assert.ok(!profile.json.posts.some((p: any) => p.id === anon.json.id));

    // Folgen schaltet „Wer mir folgt“ frei.
    await call('PUT', '/api/users/ana/follow', { token: ben });
    const asFollower = await call('GET', '/api/posts?scope=all', { token: ben });
    assert.ok(asFollower.json.posts.some((p: any) => p.id === followers.json.id));

    // Home-Feed über gefolgte Personen enthält keine anonymen Texte (ben ist nicht in „briefe“).
    const home = await call('GET', '/api/posts?scope=home', { token: ben });
    assert.ok(!home.json.posts.some((p: any) => p.id === anon.json.id));

    const drafts = await call('GET', '/api/drafts', { token: ana });
    assert.equal(drafts.json.posts.length, 1);
    const publish = await call('PATCH', `/api/posts/${draft.json.id}`, { token: ana, body: { kind: 'geschichte', title: 'Entwurf', body: 'Es war einmal ein Fuchs.', publish: true, allowContinuation: true } });
    assert.equal(publish.status, 200);
    const full = await call('GET', `/api/posts/${draft.json.id}`);
    assert.equal(full.json.post.wordCount, 5);
    assert.ok(full.json.post.publishedAt);
  });

  test('Resonanz, Kommentare, Danke, Mitteilungen', async () => {
    const post = await call('POST', '/api/posts', { token: ana, body: { kind: 'gedicht', title: 'Herbst', body: 'Blätter\nfallen leise', publish: true } });
    const id = post.json.id;
    assert.equal((await call('PUT', `/api/posts/${id}/reactions/beruehrt`, { token: ben })).status, 200);
    await call('PUT', `/api/posts/${id}/reactions/beruehrt`, { token: ben });
    await call('PUT', `/api/posts/${id}/reactions/stark`, { token: cleo });
    assert.equal((await call('PUT', `/api/posts/${id}/reactions/upvote`, { token: cleo })).status, 400);
    const p = await call('GET', `/api/posts/${id}`, { token: ben });
    assert.deepEqual(p.json.post.reactions, { beruehrt: 1, stark: 1 });
    assert.deepEqual(p.json.post.myReactions, ['beruehrt']);
    assert.equal((await call('GET', `/api/posts/${id}/reactions`, { token: ben })).status, 403);
    assert.equal((await call('GET', `/api/posts/${id}/reactions`, { token: ana })).json.reactions.length, 2);

    const c1 = await call('POST', `/api/posts/${id}/comments`, { token: ben, body: { body: 'Wunderschön.' } });
    const c2 = await call('POST', `/api/posts/${id}/comments`, { token: cleo, body: { body: 'Finde ich auch', parentId: c1.json.id } });
    const c3 = await call('POST', `/api/posts/${id}/comments`, { token: ana, body: { body: 'Danke euch', parentId: c2.json.id } });
    const list = await call('GET', `/api/posts/${id}/comments`);
    assert.equal(list.json.comments.length, 3);
    // Antworten auf Antworten hängen am Ursprungskommentar.
    assert.equal(list.json.comments.find((c: any) => c.id === c3.json.id).parentId, c1.json.id);
    assert.equal((await call('PUT', `/api/comments/${c1.json.id}/thanks`, { token: ben })).status, 403);
    assert.equal((await call('PUT', `/api/comments/${c1.json.id}/thanks`, { token: ana })).json.thanked, true);

    const notes = await call('GET', '/api/notifications', { token: ana });
    const types = notes.json.notifications.map((n: any) => n.type);
    assert.ok(types.includes('reaction') && types.includes('comment') && types.includes('follow'));
    const benNotes = await call('GET', '/api/notifications', { token: ben });
    assert.ok(benNotes.json.notifications.some((n: any) => n.type === 'thanks'));
    assert.ok(benNotes.json.notifications.some((n: any) => n.type === 'reply'));
    await call('POST', '/api/notifications/read', { token: ana, body: {} });
    assert.equal((await call('GET', '/api/notifications/unread', { token: ana })).json.unread, 0);
  });

  test('Nur zuhören, Leise Stimmen, Suche, Gespeichert', async () => {
    const quiet = await call('POST', '/api/posts', { token: cleo, body: { kind: 'tagebuch', title: 'Schwerer Tag', body: 'Mir geht es heute nicht gut. Der Regen passt.', responseMode: 'listen', contentWarning: 'Traurigkeit', publish: true } });
    const c = await call('POST', `/api/posts/${quiet.json.id}/comments`, { token: ben, body: { body: 'Halt durch' } });
    assert.equal(c.status, 403);

    const leise = await call('GET', '/api/posts?sort=leise', { token: ben });
    assert.ok(leise.json.posts.some((p: any) => p.id === quiet.json.id));
    await call('PUT', `/api/posts/${quiet.json.id}/reactions/kenn_ich`, { token: ben });
    const leise2 = await call('GET', '/api/posts?sort=leise', { token: ana });
    assert.ok(!leise2.json.posts.some((p: any) => p.id === quiet.json.id));

    const s = await call('GET', '/api/posts?q=' + encodeURIComponent('regen'));
    assert.ok(s.json.posts.some((p: any) => p.id === quiet.json.id));

    await call('PUT', `/api/posts/${quiet.json.id}/bookmark`, { token: ana });
    const saved = await call('GET', '/api/posts?saved=1', { token: ana });
    assert.equal(saved.json.posts[0].id, quiet.json.id);
    assert.equal(saved.json.posts[0].bookmarked, true);
    assert.equal((await call('GET', '/api/posts?saved=0', { token: ana })).json.posts.length > 1, true);
  });

  test('Fortsetzungen, Zeitkapsel, Impuls', async () => {
    const story = await call('POST', '/api/posts', { token: ana, body: { kind: 'geschichte', title: 'Kettengeschichte', body: 'Der Leuchtturm war seit Jahren dunkel.', allowContinuation: true, publish: true } });
    const closed = await call('POST', '/api/posts', { token: ana, body: { kind: 'geschichte', title: 'Zu', body: 'Nur ich.', publish: true } });
    const cont = await call('POST', '/api/posts', { token: ben, body: { kind: 'geschichte', title: 'Teil 2', body: 'Bis eines Nachts ein Licht anging.', continuesPostId: story.json.id, publish: true } });
    assert.equal(cont.status, 200);
    assert.equal((await call('POST', '/api/posts', { token: ben, body: { kind: 'geschichte', body: 'x', continuesPostId: closed.json.id, publish: true } })).status, 403);
    const conts = await call('GET', `/api/posts?continues=${story.json.id}`);
    assert.equal(conts.json.posts[0].id, cont.json.id);
    assert.equal(conts.json.posts[0].continues.title, 'Kettengeschichte');

    const soon = new Date(Date.now() + 2 * 3600_000).toISOString();
    const cap = await call('POST', '/api/posts', { token: cleo, body: { kind: 'brief', title: 'An mich in zwei Stunden', body: 'Hallo Zukunft', visibility: 'private', unlockAt: soon, publish: true } });
    const sealed = await call('GET', `/api/posts/${cap.json.id}`, { token: cleo });
    assert.equal(sealed.json.post.sealed, true);
    assert.equal(sealed.json.post.body, '');
    // Versiegelt heisst auch: nicht überschreibbar (der Inhalt ist ja verborgen).
    const overwrite = await call('PATCH', `/api/posts/${cap.json.id}`, { token: cleo, body: { kind: 'brief', body: '', visibility: 'private' } });
    assert.equal(overwrite.status, 403);
    await pool.query(`update posts set unlock_at = now() - interval '1 minute' where id = $1`, [cap.json.id]);
    const n = await call('GET', '/api/notifications', { token: cleo });
    assert.ok(n.json.notifications.some((x: any) => x.type === 'capsule' && x.post.id === cap.json.id));
    assert.equal((await call('GET', `/api/posts/${cap.json.id}`, { token: cleo })).json.post.body, 'Hallo Zukunft');

    const today = await call('GET', '/api/prompts/today', { token: ana });
    assert.ok(today.json.prompt.text.length > 5);
    await call('POST', '/api/posts', { token: ana, body: { kind: 'gedanke', body: 'Antwort auf den Impuls', promptDay: today.json.prompt.day, publish: true } });
    const again = await call('GET', '/api/prompts/today', { token: ana });
    assert.equal(again.json.prompt.responses, 1);
    assert.equal(again.json.prompt.answered, true);
  });

  test('Räume, Profil, Übersicht, Blockieren, Export, Konto löschen', async () => {
    const rooms = await call('GET', '/api/rooms', { token: ana });
    assert.ok(rooms.json.rooms.length >= 8);
    assert.equal(rooms.json.rooms.find((r: any) => r.slug === 'heute').joined, true);
    // Raumkarten zeigen den neuesten Text – aber nie einen mit Inhaltshinweis.
    assert.ok(rooms.json.rooms.find((r: any) => r.slug === 'heute').latest.id > 0);
    assert.ok(rooms.json.rooms.every((r: any) => !r.latest || !/Regen passt/.test(r.latest.excerpt)));
    const created = await call('POST', '/api/rooms', { token: ben, body: { name: 'Nachtschicht Gedanken', description: 'Für alle, die nachts schreiben.' } });
    assert.equal(created.json.slug, 'nachtschicht-gedanken');
    await call('PUT', '/api/rooms/lyrik/membership', { token: ana });
    assert.equal((await call('GET', '/api/rooms/lyrik', { token: ana })).json.room.joined, true);

    const prof = await call('GET', '/api/users/ana', { token: ana });
    assert.ok(prof.json.user.stats.posts > 3);
    assert.equal(prof.json.user.stats.streak, 1);
    const ov = await call('GET', '/api/me/overview', { token: ana });
    assert.equal(ov.json.wroteToday, true);
    assert.ok(ov.json.rooms.some((r: any) => r.slug === 'lyrik'));

    await call('PUT', '/api/users/ana/block', { token: cleo });
    const blockedFeed = await call('GET', '/api/posts?scope=all', { token: cleo });
    assert.ok(!blockedFeed.json.posts.some((p: any) => p.author?.handle === 'ana'));

    const exp = await call('GET', '/api/auth/export', { token: ana });
    assert.ok(exp.json.posts.length > 3);
    assert.match(String(exp.headers['content-disposition']), /lapis-ana\.json/);

    assert.equal((await call('DELETE', '/api/auth/account', { token: cleo, body: { password: 'falsch' } })).status, 400);
    assert.equal((await call('DELETE', '/api/auth/account', { token: cleo, body: { password: 'geheim1234' } })).status, 200);
    assert.equal((await call('GET', '/api/auth/me', { token: cleo })).json.user, null);
  });

  test('Bild-Upload wird zu WebP ohne Metadaten', async () => {
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#213885' } }).png().toBuffer();
    const boundary = '----lapis';
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await app.inject({ method: 'POST', url: '/api/media?purpose=cover', payload, headers: { authorization: `Bearer ${ben}`, 'content-type': `multipart/form-data; boundary=${boundary}` } });
    assert.equal(res.statusCode, 200, res.body);
    const { url, width } = res.json();
    assert.equal(width, 40);
    const img = await app.inject({ method: 'GET', url });
    assert.equal(img.statusCode, 200);
    assert.equal(img.headers['content-type'], 'image/webp');
    const trav = await app.inject({ method: 'GET', url: '/media/..%2F..%2F..%2Fetc%2Fpasswd' });
    assert.equal(trav.statusCode, 404);
    assert.ok(!trav.body.includes('root:'));
    assert.equal((await app.inject({ method: 'GET', url: '/api/gibt-es-nicht' })).statusCode, 404);
  });
});
