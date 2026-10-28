import { countWords, WORDS_PER_MINUTE } from '../../../shared/constants.js';
import { mediaUrl } from './media-url.js';

export const EXCERPT_CHARS = 700;

/**
 * Sichtbarkeit für Betrachter $1 (uuid oder null). Wird in jeder Abfrage
 * benutzt, die Beiträge liefert – hier liegt die einzige Wahrheit dazu.
 */
export const VISIBLE = `
  p.status = 'published'
  and (
    p.visibility = 'public'
    or p.author_id = $1
    or (p.visibility = 'followers' and exists (
      select 1 from follows f where f.follower_id = $1 and f.followee_id = p.author_id))
  )
  and ($1::uuid is null or not exists (
    select 1 from blocks b
     where (b.blocker_id = $1 and b.blocked_id = p.author_id)
        or (b.blocker_id = p.author_id and b.blocked_id = $1)))
`;

export function postSelect(opts: { full?: boolean } = {}) {
  const body = opts.full ? 'p.body' : `left(p.body, ${EXCERPT_CHARS}) as body, length(p.body) > ${EXCERPT_CHARS} as truncated`;
  return `
    select p.id, p.author_id, p.status, p.kind, p.title, ${body}, p.mood, p.visibility, p.anonymous,
           p.content_warning, p.response_mode, p.allow_continuation, p.continues_post_id, p.prompt_day,
           p.cover_key, p.word_count, p.unlock_at, p.created_at, p.updated_at, p.published_at,
           u.handle, u.display_name, u.avatar_key,
           r.slug as room_slug, r.name as room_name, r.color as room_color,
           (select count(*)::int from comments c where c.post_id = p.id and c.deleted_at is null) as comment_count,
           (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb)
              from (select kind, count(*)::int as n from reactions where post_id = p.id group by kind) x) as reactions,
           (select coalesce(array_agg(kind), '{}') from reactions where post_id = p.id and user_id = $1) as my_reactions,
           exists (select 1 from bookmarks bm where bm.post_id = p.id and bm.user_id = $1) as bookmarked,
           (select count(*)::int from posts c2 where c2.continues_post_id = p.id and c2.status = 'published' and c2.visibility = 'public') as continuation_count,
           cp.title as continues_title, cp.anonymous as continues_anonymous, cu.display_name as continues_author
      from posts p
      join users u on u.id = p.author_id
      left join rooms r on r.id = p.room_id
      left join posts cp on cp.id = p.continues_post_id and cp.status = 'published' and cp.visibility = 'public'
      left join users cu on cu.id = cp.author_id
  `;
}

export function serializePost(row: any, viewerId: string | null) {
  const mine = viewerId !== null && row.author_id === viewerId;
  const hideAuthor = row.anonymous && !mine;
  const sealed = row.unlock_at && new Date(row.unlock_at).getTime() > Date.now();
  const reactions = row.reactions ?? {};
  const resonance = Object.values(reactions as Record<string, number>).reduce((a, b) => a + b, 0);
  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    title: row.title,
    body: sealed ? '' : row.body,
    truncated: sealed ? false : Boolean(row.truncated),
    sealed: Boolean(sealed),
    unlockAt: row.unlock_at,
    mood: row.mood,
    visibility: row.visibility,
    anonymous: row.anonymous,
    contentWarning: row.content_warning,
    responseMode: row.response_mode,
    allowContinuation: row.allow_continuation,
    continues: row.continues_post_id
      ? { id: row.continues_post_id, title: row.continues_title ?? null, author: row.continues_anonymous ? null : row.continues_author ?? null }
      : null,
    promptDay: row.prompt_day,
    cover: mediaUrl(row.cover_key),
    coverKey: mine ? row.cover_key : undefined,
    wordCount: row.word_count,
    readingMinutes: Math.max(1, Math.round(row.word_count / WORDS_PER_MINUTE)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    author: hideAuthor ? null : { handle: row.handle, name: row.display_name, avatar: mediaUrl(row.avatar_key) },
    room: row.room_slug ? { slug: row.room_slug, name: row.room_name, color: row.room_color } : null,
    counts: { comments: row.comment_count ?? 0, resonance, continuations: row.continuation_count ?? 0 },
    reactions,
    myReactions: row.my_reactions ?? [],
    bookmarked: Boolean(row.bookmarked),
    mine,
  };
}

export { countWords };
