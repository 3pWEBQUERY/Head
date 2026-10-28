import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LIMITS } from '../../../shared/constants.js';
import { one, q } from '../db.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { mediaUrl } from '../lib/media-url.js';
import { notify } from '../lib/notify.js';
import { VISIBLE } from '../lib/posts.js';
import { requireUser } from '../lib/session.js';
import { parse } from '../lib/validate.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

async function visiblePost(viewer: string | null, id: number) {
  return one(`select p.id, p.author_id, p.anonymous, p.response_mode from posts p where p.id = $2 and ${VISIBLE}`, [viewer, id]);
}

export default async function commentRoutes(app: FastifyInstance) {
  app.get('/api/posts/:id/comments', async (req) => {
    const { id } = parse(idParam, req.params);
    const viewer = req.user?.id ?? null;
    const post = await visiblePost(viewer, id);
    if (!post) throw notFound();
    const rows = await q(
      `select c.id, c.parent_id, c.body, c.thanked, c.created_at, c.edited_at, c.deleted_at, c.author_id,
              u.handle, u.display_name, u.avatar_key
         from comments c join users u on u.id = c.author_id
        where c.post_id = $1
          and ($2::uuid is null or not exists (select 1 from blocks b where b.blocker_id = $2 and b.blocked_id = c.author_id))
        order by c.created_at asc limit 1000`,
      [id, viewer],
    );
    const comments = rows.map((c) => {
      const byAuthor = c.author_id === post.author_id;
      // Bei anonymen Texten bleibt auch die Verfasserin in den Kommentaren anonym.
      const hide = byAuthor && post.anonymous && c.author_id !== viewer;
      return {
        id: c.id,
        parentId: c.parent_id,
        body: c.deleted_at ? '' : c.body,
        deleted: Boolean(c.deleted_at),
        thanked: c.thanked,
        createdAt: c.created_at,
        editedAt: c.edited_at,
        byAuthor,
        mine: viewer === c.author_id,
        author: c.deleted_at || hide ? null : { handle: c.handle, name: c.display_name, avatar: mediaUrl(c.avatar_key) },
      };
    });
    return { comments, canModerate: viewer === post.author_id };
  });

  app.post('/api/posts/:id/comments', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } }, async (req) => {
    const me = requireUser(req);
    const { id } = parse(idParam, req.params);
    const body = parse(z.object({
      body: z.string().trim().min(1, 'Schreib etwas').max(LIMITS.comment),
      parentId: z.number().int().positive().nullable().optional(),
    }), req.body);
    const post = await visiblePost(me.id, id);
    if (!post) throw notFound();
    if (post.response_mode === 'listen' && post.author_id !== me.id) {
      throw forbidden('Bei diesem Text wird nur zugehört – Resonanz geht, Kommentare nicht');
    }
    let parent: any = null;
    if (body.parentId) {
      parent = await one('select id, author_id, parent_id from comments where id = $1 and post_id = $2 and deleted_at is null', [body.parentId, id]);
      if (!parent) throw badRequest('Auf diesen Kommentar kann man nicht mehr antworten');
    }
    // Eine Ebene Antworten reicht: Antworten auf Antworten hängen am Ursprung.
    const parentId = parent ? parent.parent_id ?? parent.id : null;
    const row = await one('insert into comments (post_id, author_id, parent_id, body) values ($1, $2, $3, $4) returning id', [id, me.id, parentId, body.body]);
    const actor = post.anonymous && me.id === post.author_id ? null : me.id;
    await notify({ userId: post.author_id, actorId: me.id, type: 'comment', postId: id, commentId: row!.id });
    if (parent && parent.author_id !== post.author_id) {
      await notify({ userId: parent.author_id, actorId: actor, type: 'reply', postId: id, commentId: row!.id });
    }
    return { id: row!.id };
  });

  app.patch('/api/comments/:id', async (req) => {
    const me = requireUser(req);
    const { id } = parse(idParam, req.params);
    const { body } = parse(z.object({ body: z.string().trim().min(1).max(LIMITS.comment) }), req.body);
    const r = await q('update comments set body = $3, edited_at = now() where id = $1 and author_id = $2 and deleted_at is null returning id', [id, me.id, body]);
    if (!r.length) throw notFound();
    return { ok: true };
  });

  // Löschen dürfen: wer geschrieben hat, und wem der Text gehört (Schutz für persönliche Beiträge).
  app.delete('/api/comments/:id', async (req) => {
    const me = requireUser(req);
    const { id } = parse(idParam, req.params);
    const c = await one('select c.author_id, p.author_id as post_author from comments c join posts p on p.id = c.post_id where c.id = $1', [id]);
    if (!c) throw notFound();
    if (c.author_id !== me.id && c.post_author !== me.id && me.role === 'member') throw forbidden();
    await q('update comments set deleted_at = now() where id = $1', [id]);
    return { ok: true };
  });

  // „Danke“ – die Autorin bedankt sich für einen Kommentar.
  app.put('/api/comments/:id/thanks', async (req) => {
    const me = requireUser(req);
    const { id } = parse(idParam, req.params);
    const c = await one('select c.id, c.author_id, c.post_id, c.thanked, p.author_id as post_author, p.anonymous from comments c join posts p on p.id = c.post_id where c.id = $1 and c.deleted_at is null', [id]);
    if (!c) throw notFound();
    if (c.post_author !== me.id) throw forbidden('Bedanken kann sich nur, wer den Text geschrieben hat');
    const next = !c.thanked;
    await q('update comments set thanked = $2 where id = $1', [id, next]);
    if (next) await notify({ userId: c.author_id, actorId: c.anonymous ? null : me.id, type: 'thanks', postId: c.post_id, commentId: id });
    return { thanked: next };
  });
}
