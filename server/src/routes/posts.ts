import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { countWords, KIND_KEYS, LIMITS, RESONANCE_KEYS } from '../../../shared/constants.js';
import { dayKey } from '../../../shared/prompts.js';
import { one, q, tx } from '../db.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { notify } from '../lib/notify.js';
import { postSelect, serializePost, VISIBLE } from '../lib/posts.js';
import { requireUser } from '../lib/session.js';
import { parse } from '../lib/validate.js';

const flag = z.enum(['1', 'true', '0', 'false']).transform((v) => v === '1' || v === 'true').optional();

const feedQuery = z.object({
  scope: z.enum(['home', 'all']).default('all'),
  sort: z.enum(['lesenswert', 'neu', 'leise']).default('neu'),
  room: z.string().max(40).optional(),
  author: z.string().max(40).optional(),
  prompt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kind: z.enum(KIND_KEYS as [string, ...string[]]).optional(),
  q: z.string().trim().max(120).optional(),
  saved: flag,
  journal: flag,
  continues: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const postInput = z.object({
  kind: z.enum(KIND_KEYS as [string, ...string[]]),
  title: z.string().trim().max(LIMITS.title).default(''),
  body: z.string().max(LIMITS.body).default(''),
  mood: z.number().int().min(1).max(5).nullable().optional(),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
  anonymous: z.boolean().default(false),
  contentWarning: z.string().trim().max(LIMITS.contentWarning).nullable().optional(),
  responseMode: z.enum(['open', 'feedback', 'listen']).default('open'),
  allowContinuation: z.boolean().default(false),
  continuesPostId: z.number().int().positive().nullable().optional(),
  promptDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  coverKey: z.string().max(200).nullable().optional(),
  room: z.string().max(40).nullable().optional(),
  unlockAt: z.string().datetime({ offset: true }).nullable().optional(),
  publish: z.boolean().default(false),
});
type PostInput = z.infer<typeof postInput>;

async function resolveInput(input: PostInput, userId: string) {
  const v = { ...input };
  // Privat heisst privat: kein Raum, nicht anonym, keine Fortsetzungen durch andere.
  if (v.visibility === 'private') {
    v.room = null;
    v.anonymous = false;
    v.allowContinuation = false;
  } else {
    v.unlockAt = null;
  }
  // Anonym nur öffentlich – sonst liesse sich über „Wer mir folgt“ auf die Person schliessen.
  if (v.anonymous && v.visibility !== 'public') v.anonymous = false;

  let roomId: number | null = null;
  if (v.room) {
    const room = await one('select id from rooms where slug = $1', [v.room]);
    if (!room) throw badRequest('Diesen Raum gibt es nicht');
    roomId = room.id;
  }
  if (v.unlockAt && new Date(v.unlockAt).getTime() < Date.now() + 3_600_000) {
    throw badRequest('Eine Zeitkapsel muss mindestens eine Stunde in der Zukunft liegen');
  }
  if (v.continuesPostId) {
    const target = await one(`select id, author_id, allow_continuation from posts where id = $1 and status = 'published' and visibility = 'public'`, [v.continuesPostId]);
    if (!target) throw badRequest('Den Text, den du fortsetzen willst, gibt es nicht mehr');
    if (!target.allow_continuation && target.author_id !== userId) throw forbidden('Dieser Text darf nicht fortgesetzt werden');
  }
  if (v.promptDay && v.promptDay > dayKey()) throw badRequest('Dieser Impuls liegt in der Zukunft');
  if (v.coverKey) {
    const m = await one('select 1 from media where key = $1 and user_id = $2', [v.coverKey, userId]);
    if (!m) throw badRequest('Bild nicht gefunden');
  }
  if (v.publish && countWords(v.body) === 0 && countWords(v.title) === 0) {
    throw badRequest('Ein leeres Blatt kann man nicht veröffentlichen', 'empty');
  }
  return { v, roomId };
}

export default async function postRoutes(app: FastifyInstance) {
  app.get('/api/posts', async (req) => {
    const f = parse(feedQuery, req.query);
    const viewer = req.user?.id ?? null;
    const params: unknown[] = [viewer];
    const p = (v: unknown) => `$${params.push(v)}`;
    const where: string[] = [];
    let order = 'p.published_at desc, p.id desc';

    if (f.journal) {
      if (!viewer) return { posts: [], hasMore: false };
      where.push(`p.author_id = $1 and p.status = 'published' and p.visibility = 'private'`);
    } else {
      where.push(VISIBLE);
      // Private Einträge erscheinen nur im eigenen Tagebuch, nie im Feed.
      where.push(`p.visibility <> 'private'`);
    }

    if (f.room) where.push(`r.slug = ${p(f.room)}`);
    if (f.kind) where.push(`p.kind = ${p(f.kind)}`);
    if (f.prompt) where.push(`p.prompt_day = ${p(f.prompt)}`);
    if (f.continues) where.push(`p.continues_post_id = ${p(f.continues)}`);
    if (f.author) {
      where.push(`u.handle = ${p(f.author.toLowerCase().replace(/^@/, ''))}`);
      // Anonyme Texte tauchen nie im Profil auf (ausser für die Person selbst).
      where.push(`(not p.anonymous or p.author_id = $1)`);
    }
    if (f.saved) {
      if (!viewer) return { posts: [], hasMore: false };
      where.push('exists (select 1 from bookmarks b2 where b2.post_id = p.id and b2.user_id = $1)');
      order = '(select created_at from bookmarks b3 where b3.post_id = p.id and b3.user_id = $1) desc';
    }
    if (f.q) {
      const term = p(f.q);
      where.push(`(p.search @@ websearch_to_tsquery('german', ${term}) or p.title ilike '%' || ${term} || '%')`);
    }
    if (f.scope === 'home' && viewer && !f.room && !f.author && !f.saved && !f.journal) {
      const has = await one(
        `select exists (select 1 from room_members where user_id = $1) or exists (select 1 from follows where follower_id = $1) as any`,
        [viewer],
      );
      if (has?.any) {
        // Gefolgte Personen nur mit namentlichen Texten – anonyme kommen ausschliesslich über Räume.
        where.push(`(p.author_id = $1
          or p.room_id in (select room_id from room_members where user_id = $1)
          or (not p.anonymous and p.author_id in (select followee_id from follows where follower_id = $1)))`);
      }
    }

    if (!f.saved) {
      if (f.sort === 'lesenswert') {
        where.push(`p.published_at > now() - interval '45 days'`);
        order = `((select count(*) from reactions x where x.post_id = p.id)
                 + 2 * (select count(*) from comments y where y.post_id = p.id and y.deleted_at is null) + 1)
                 / power(extract(epoch from now() - p.published_at) / 3600 + 2, 1.25) desc, p.id desc`;
      } else if (f.sort === 'leise') {
        // Leise Stimmen: Texte, auf die noch niemand reagiert hat.
        where.push(`p.published_at > now() - interval '21 days'`);
        where.push(`not exists (select 1 from reactions x where x.post_id = p.id)`);
        where.push(`not exists (select 1 from comments y where y.post_id = p.id and y.deleted_at is null)`);
        if (viewer) where.push('p.author_id <> $1');
      }
    }

    const sql = `${postSelect()} where ${where.join(' and ')} order by ${order} limit ${f.limit + 1} offset ${f.offset}`;
    const rows = await q(sql, params);
    return { posts: rows.slice(0, f.limit).map((r) => serializePost(r, viewer)), hasMore: rows.length > f.limit };
  });

  app.get('/api/posts/:id', async (req) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const viewer = req.user?.id ?? null;
    // Entwürfe sieht nur die Autorin / der Autor.
    const row = await one(
      `${postSelect({ full: true })} where p.id = $2 and ((${VISIBLE}) or (p.author_id = $1))`,
      [viewer, id],
    );
    if (!row) throw notFound('Diesen Text gibt es nicht oder er ist nicht für dich sichtbar');
    return { post: serializePost(row, viewer) };
  });

  app.get('/api/drafts', async (req) => {
    const me = requireUser(req);
    const rows = await q(`${postSelect()} where p.author_id = $1 and p.status = 'draft' order by p.updated_at desc limit 100`, [me.id]);
    return { posts: rows.map((r) => serializePost(r, me.id)) };
  });

  app.post('/api/posts', { config: { rateLimit: { max: 40, timeWindow: '1 hour' } } }, async (req) => {
    const me = requireUser(req);
    const { v, roomId } = await resolveInput(parse(postInput, req.body), me.id);
    const post = await tx(async (c) => {
      const row = await one(
        `insert into posts (author_id, room_id, status, kind, title, body, mood, visibility, anonymous, content_warning,
                            response_mode, allow_continuation, continues_post_id, prompt_day, cover_key, word_count, unlock_at, published_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, case when $3 = 'published' then now() end)
         returning id`,
        [me.id, roomId, v.publish ? 'published' : 'draft', v.kind, v.title, v.body, v.mood ?? null, v.visibility, v.anonymous,
          v.contentWarning || null, v.responseMode, v.allowContinuation, v.continuesPostId ?? null, v.promptDay ?? null,
          v.coverKey ?? null, countWords(v.body), v.unlockAt ?? null],
        c,
      );
      if (v.publish) await afterPublish(row!.id, me.id, v, roomId, c);
      return row!;
    });
    return { id: post.id };
  });

  app.patch('/api/posts/:id', async (req) => {
    const me = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const existing = await one('select id, author_id, status, unlock_at > now() as sealed from posts where id = $1', [id]);
    if (!existing) throw notFound();
    if (existing.author_id !== me.id) throw forbidden();
    // Der Inhalt einer versiegelten Kapsel wird nie ausgeliefert – überschreiben würde ihn löschen.
    if (existing.sealed) throw forbidden('Eine versiegelte Zeitkapsel lässt sich erst nach dem Öffnen bearbeiten');
    const { v, roomId } = await resolveInput(parse(postInput, req.body), me.id);
    if (v.continuesPostId === id) throw badRequest('Ein Text kann sich nicht selbst fortsetzen');
    const firstPublish = v.publish && existing.status === 'draft';
    await tx(async (c) => {
      await q(
        `update posts set room_id = $2, status = $3, kind = $4, title = $5, body = $6, mood = $7, visibility = $8, anonymous = $9,
                content_warning = $10, response_mode = $11, allow_continuation = $12, continues_post_id = $13, prompt_day = $14,
                cover_key = $15, word_count = $16, unlock_at = $17, updated_at = now(),
                published_at = case when $3 = 'published' then coalesce(published_at, now()) else published_at end
          where id = $1`,
        [id, roomId, v.publish ? 'published' : existing.status === 'published' ? 'published' : 'draft', v.kind, v.title, v.body,
          v.mood ?? null, v.visibility, v.anonymous, v.contentWarning || null, v.responseMode, v.allowContinuation,
          v.continuesPostId ?? null, v.promptDay ?? null, v.coverKey ?? null, countWords(v.body), v.unlockAt ?? null],
        c,
      );
      if (firstPublish) await afterPublish(id, me.id, v, roomId, c);
    });
    return { id };
  });

  app.post('/api/posts/:id/unpublish', async (req) => {
    const me = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const r = await q(`update posts set status = 'draft', updated_at = now() where id = $1 and author_id = $2 returning id`, [id, me.id]);
    if (!r.length) throw notFound();
    return { ok: true };
  });

  app.delete('/api/posts/:id', async (req) => {
    const me = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const post = await one('select author_id from posts where id = $1', [id]);
    if (!post) throw notFound();
    if (post.author_id !== me.id && me.role === 'member') throw forbidden();
    await q('delete from posts where id = $1', [id]);
    return { ok: true };
  });

  // Resonanz: mehrere Arten pro Person möglich, jede einmal.
  app.put('/api/posts/:id/reactions/:kind', async (req) => {
    const me = requireUser(req);
    const { id, kind } = parse(z.object({ id: z.coerce.number().int().positive(), kind: z.enum(RESONANCE_KEYS as [string, ...string[]]) }), req.params);
    const post = await one(`select p.id, p.author_id from posts p where p.id = $2 and ${VISIBLE}`, [me.id, id]);
    if (!post) throw notFound();
    const ins = await q('insert into reactions (post_id, user_id, kind) values ($1, $2, $3) on conflict do nothing returning kind', [id, me.id, kind]);
    if (ins.length) await notify({ userId: post.author_id, actorId: me.id, type: 'reaction', postId: id, detail: kind });
    return { ok: true };
  });

  app.delete('/api/posts/:id/reactions/:kind', async (req) => {
    const me = requireUser(req);
    const { id, kind } = parse(z.object({ id: z.coerce.number().int().positive(), kind: z.string() }), req.params);
    await q('delete from reactions where post_id = $1 and user_id = $2 and kind = $3', [id, me.id, kind]);
    return { ok: true };
  });

  // Wer hat wie reagiert – nur für die Autorin / den Autor sichtbar.
  app.get('/api/posts/:id/reactions', async (req) => {
    const me = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const post = await one('select author_id from posts where id = $1', [id]);
    if (!post || post.author_id !== me.id) throw forbidden('Nur du siehst, wer auf deinen Text reagiert hat');
    const rows = await q(
      `select r.kind, r.created_at, u.handle, u.display_name, u.avatar_key from reactions r join users u on u.id = r.user_id
        where r.post_id = $1 order by r.created_at desc limit 200`, [id],
    );
    return { reactions: rows.map((r) => ({ kind: r.kind, at: r.created_at, user: { handle: r.handle, name: r.display_name, avatar: r.avatar_key ? `/media/${r.avatar_key}` : null } })) };
  });

  app.put('/api/posts/:id/bookmark', async (req) => {
    const me = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    const post = await one(`select p.id from posts p where p.id = $2 and ${VISIBLE}`, [me.id, id]);
    if (!post) throw notFound();
    await q('insert into bookmarks (user_id, post_id) values ($1, $2) on conflict do nothing', [me.id, id]);
    return { ok: true };
  });

  app.delete('/api/posts/:id/bookmark', async (req) => {
    const me = requireUser(req);
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), req.params);
    await q('delete from bookmarks where user_id = $1 and post_id = $2', [me.id, id]);
    return { ok: true };
  });

  app.post('/api/reports', { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (req) => {
    const me = requireUser(req);
    const body = parse(z.object({
      postId: z.number().int().positive().optional(),
      commentId: z.number().int().positive().optional(),
      reason: z.string().trim().min(3, 'Sag kurz, was los ist').max(500),
    }).refine((b) => b.postId || b.commentId, 'Was möchtest du melden?'), req.body);
    await q('insert into reports (reporter_id, post_id, comment_id, reason) values ($1, $2, $3, $4)', [me.id, body.postId ?? null, body.commentId ?? null, body.reason]);
    return { ok: true };
  });
}

async function afterPublish(postId: number, authorId: string, v: PostInput, roomId: number | null, c: any) {
  if (roomId) {
    await q('insert into room_members (room_id, user_id) values ($1, $2) on conflict do nothing', [roomId, authorId], c);
  }
  if (v.continuesPostId && v.visibility === 'public') {
    const target = await one('select author_id from posts where id = $1', [v.continuesPostId], c);
    if (target) await notify({ userId: target.author_id, actorId: v.anonymous ? null : authorId, type: 'continuation', postId }, c);
  }
}
