import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LIMITS } from '../../../shared/constants.js';
import { dayKey } from '../../../shared/prompts.js';
import { one, q } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { mediaUrl } from '../lib/media-url.js';
import { notify } from '../lib/notify.js';
import { requireUser } from '../lib/session.js';
import { parse } from '../lib/validate.js';
import { meJson } from './auth.js';

const handleParam = z.object({ handle: z.string().max(40).transform((h) => h.toLowerCase().replace(/^@/, '')) });

/** Tage (Europe/Zurich) mit Anzahl Texten und Wörtern. Für andere nur öffentliche, namentliche Texte. */
async function calendar(userId: string, self: boolean, days = 371) {
  const rows = await q(
    `select to_char((published_at at time zone 'Europe/Zurich')::date, 'YYYY-MM-DD') as day,
            count(*)::int as posts, sum(word_count)::int as words
       from posts
      where author_id = $1 and status = 'published' and published_at > now() - ($2 || ' days')::interval
        and ($3 or (visibility = 'public' and not anonymous))
      group by 1 order by 1`,
    [userId, String(days), self],
  );
  return rows as { day: string; posts: number; words: number }[];
}

export function streakFrom(days: string[], today = dayKey()): number {
  const set = new Set(days);
  const step = (d: string) => new Date(Date.parse(d + 'T12:00:00Z') - 86_400_000).toISOString().slice(0, 10);
  let cur = set.has(today) ? today : step(today);
  let n = 0;
  while (set.has(cur)) {
    n++;
    cur = step(cur);
  }
  return n;
}

export default async function userRoutes(app: FastifyInstance) {
  app.get('/api/users/:handle', async (req) => {
    const { handle } = parse(handleParam, req.params);
    const viewer = req.user?.id ?? null;
    const u = await one(
      `select u.id, u.handle, u.display_name, u.bio, u.avatar_key, u.created_at,
              (select count(*)::int from follows where followee_id = u.id) as followers,
              (select count(*)::int from follows where follower_id = u.id) as following,
              exists (select 1 from follows where follower_id = $2 and followee_id = u.id) as followed,
              exists (select 1 from follows where follower_id = u.id and followee_id = $2) as follows_you,
              exists (select 1 from blocks where blocker_id = $2 and blocked_id = u.id) as blocked
         from users u where u.handle = $1`,
      [handle, viewer],
    );
    if (!u) throw notFound('Dieses Profil gibt es nicht');
    const self = viewer === u.id;
    const stats = await one(
      `select count(*)::int as posts, coalesce(sum(word_count), 0)::int as words
         from posts where author_id = $1 and status = 'published' and ($2 or (visibility = 'public' and not anonymous))`,
      [u.id, self],
    );
    const cal = await calendar(u.id, self);
    return {
      user: {
        handle: u.handle, name: u.display_name, bio: u.bio, avatar: mediaUrl(u.avatar_key), joinedAt: u.created_at,
        followers: u.followers, following: u.following, followed: u.followed, followsYou: u.follows_you, blocked: u.blocked, self,
        stats: { posts: stats.posts, words: stats.words, streak: self ? streakFrom(cal.map((d) => d.day)) : undefined },
      },
      calendar: cal,
    };
  });

  app.put('/api/users/:handle/follow', async (req) => {
    const me = requireUser(req);
    const { handle } = parse(handleParam, req.params);
    const u = await one('select id from users where handle = $1', [handle]);
    if (!u) throw notFound();
    if (u.id === me.id) throw badRequest('Dir selbst folgst du schon – auf Schritt und Tritt.');
    const ins = await q('insert into follows (follower_id, followee_id) values ($1, $2) on conflict do nothing returning 1', [me.id, u.id]);
    if (ins.length) await notify({ userId: u.id, actorId: me.id, type: 'follow' });
    return { followed: true };
  });

  app.delete('/api/users/:handle/follow', async (req) => {
    const me = requireUser(req);
    const { handle } = parse(handleParam, req.params);
    await q('delete from follows where follower_id = $1 and followee_id = (select id from users where handle = $2)', [me.id, handle]);
    return { followed: false };
  });

  // Blockieren: beide sehen sich nicht mehr, Folgen wird in beide Richtungen aufgehoben.
  app.put('/api/users/:handle/block', async (req) => {
    const me = requireUser(req);
    const { handle } = parse(handleParam, req.params);
    const u = await one('select id from users where handle = $1', [handle]);
    if (!u || u.id === me.id) throw notFound();
    await q('insert into blocks (blocker_id, blocked_id) values ($1, $2) on conflict do nothing', [me.id, u.id]);
    await q('delete from follows where (follower_id = $1 and followee_id = $2) or (follower_id = $2 and followee_id = $1)', [me.id, u.id]);
    return { blocked: true };
  });

  app.delete('/api/users/:handle/block', async (req) => {
    const me = requireUser(req);
    const { handle } = parse(handleParam, req.params);
    await q('delete from blocks where blocker_id = $1 and blocked_id = (select id from users where handle = $2)', [me.id, handle]);
    return { blocked: false };
  });

  app.patch('/api/me', async (req) => {
    const me = requireUser(req);
    const body = parse(z.object({
      name: z.string().trim().min(1).max(LIMITS.displayName).optional(),
      bio: z.string().trim().max(LIMITS.bio).optional(),
      avatarKey: z.string().max(200).nullable().optional(),
    }), req.body);
    if (body.avatarKey) {
      const m = await one('select 1 from media where key = $1 and user_id = $2', [body.avatarKey, me.id]);
      if (!m) throw badRequest('Bild nicht gefunden');
    }
    const u = await one(
      `update users set display_name = coalesce($2, display_name), bio = coalesce($3, bio),
              avatar_key = case when $4::boolean then $5 else avatar_key end
        where id = $1 returning id, handle, display_name, email, bio, avatar_key, role, created_at`,
      [me.id, body.name ?? null, body.bio ?? null, body.avatarKey !== undefined, body.avatarKey ?? null],
    );
    return { user: meJson(u) };
  });

  // Alles, was die Seitenleiste und die Navigation brauchen, in einer Anfrage.
  app.get('/api/me/overview', async (req) => {
    const me = requireUser(req);
    const [rooms, counts, cal] = await Promise.all([
      q(`select r.slug, r.name, r.color from room_members m join rooms r on r.id = m.room_id where m.user_id = $1 order by r.name`, [me.id]),
      one(
        `select (select count(*)::int from notifications where user_id = $1 and read_at is null) as unread,
                (select count(*)::int from posts where author_id = $1 and status = 'draft') as drafts,
                (select count(*)::int from bookmarks where user_id = $1) as saved,
                (select count(*)::int from posts where author_id = $1 and status = 'published' and visibility = 'private') as journal`,
        [me.id],
      ),
      calendar(me.id, true, 60),
    ]);
    const today = dayKey();
    const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    return {
      rooms,
      counts,
      streak: streakFrom(cal.map((d) => d.day), today),
      wroteToday: cal.some((d) => d.day === today),
      wordsWeek: cal.filter((d) => d.day >= weekAgo).reduce((a, d) => a + d.words, 0),
      recentDays: cal,
    };
  });
}
