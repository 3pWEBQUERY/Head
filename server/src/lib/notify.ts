import { q, type Queryable, pool } from '../db.js';

type NotificationType = 'reaction' | 'comment' | 'reply' | 'follow' | 'continuation' | 'capsule' | 'thanks';

/** Legt eine Mitteilung an – nie an sich selbst, und Resonanz nur einmal pro Person und Beitrag. */
export async function notify(
  n: { userId: string; actorId: string | null; type: NotificationType; postId?: number | null; commentId?: number | null; detail?: string | null },
  db: Queryable = pool,
) {
  if (n.actorId && n.actorId === n.userId) return;
  if (n.type === 'reaction' || n.type === 'follow') {
    const dup = await q(
      `select 1 from notifications where user_id = $1 and actor_id = $2 and type = $3 and post_id is not distinct from $4
         and created_at > now() - interval '1 day' limit 1`,
      [n.userId, n.actorId, n.type, n.postId ?? null], db,
    );
    if (dup.length) return;
  }
  await q(
    'insert into notifications (user_id, actor_id, type, post_id, comment_id, detail) values ($1, $2, $3, $4, $5, $6)',
    [n.userId, n.actorId, n.type, n.postId ?? null, n.commentId ?? null, n.detail ?? null], db,
  );
}
