import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { q } from '../db.js';
import { mediaUrl } from '../lib/media-url.js';
import { requireUser } from '../lib/session.js';
import { parse } from '../lib/validate.js';

/** Zeitkapseln, deren Datum erreicht ist, melden sich bei ihrer Autorin. */
async function openCapsules(userId: string) {
  await q(
    `with due as (
       update posts set capsule_notified = true
        where author_id = $1 and unlock_at is not null and unlock_at <= now() and not capsule_notified and status = 'published'
        returning id)
     insert into notifications (user_id, actor_id, type, post_id) select $1, null, 'capsule', id from due`,
    [userId],
  );
}

export default async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/notifications', async (req) => {
    const me = requireUser(req);
    const { before } = parse(z.object({ before: z.coerce.number().int().positive().optional() }), req.query);
    await openCapsules(me.id);
    const rows = await q(
      `select n.id, n.type, n.detail, n.read_at, n.created_at, n.post_id, n.comment_id,
              a.handle, a.display_name, a.avatar_key,
              p.title as post_title, p.kind as post_kind, left(p.body, 120) as post_excerpt,
              left(c.body, 160) as comment_excerpt
         from notifications n
         left join users a on a.id = n.actor_id
         left join posts p on p.id = n.post_id
         left join comments c on c.id = n.comment_id
        where n.user_id = $1 and ($2::bigint is null or n.id < $2)
        order by n.id desc limit 40`,
      [me.id, before ?? null],
    );
    return {
      notifications: rows.map((n) => ({
        id: n.id, type: n.type, detail: n.detail, read: Boolean(n.read_at), createdAt: n.created_at,
        actor: n.handle ? { handle: n.handle, name: n.display_name, avatar: mediaUrl(n.avatar_key) } : null,
        post: n.post_id ? { id: n.post_id, title: n.post_title, kind: n.post_kind, excerpt: n.post_excerpt } : null,
        comment: n.comment_id ? { id: n.comment_id, excerpt: n.comment_excerpt } : null,
      })),
      hasMore: rows.length === 40,
    };
  });

  app.get('/api/notifications/unread', async (req) => {
    if (!req.user) return { unread: 0 };
    await openCapsules(req.user.id);
    const rows = await q('select count(*)::int as n from notifications where user_id = $1 and read_at is null', [req.user.id]);
    return { unread: rows[0].n };
  });

  app.post('/api/notifications/read', async (req) => {
    const me = requireUser(req);
    const { ids } = parse(z.object({ ids: z.array(z.number().int()).max(200).optional() }), req.body ?? {});
    if (ids?.length) await q('update notifications set read_at = now() where user_id = $1 and id = any($2) and read_at is null', [me.id, ids]);
    else await q('update notifications set read_at = now() where user_id = $1 and read_at is null', [me.id]);
    return { ok: true };
  });
}
