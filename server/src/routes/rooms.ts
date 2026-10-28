import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LIMITS } from '../../../shared/constants.js';
import { one, q } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';
import { requireUser } from '../lib/session.js';
import { parse } from '../lib/validate.js';

const ROOM_COLUMNS = `
  r.id, r.slug, r.name, r.description, r.color, r.guidelines, r.official, r.created_at,
  (select count(*)::int from room_members m where m.room_id = r.id) as members,
  (select count(*)::int from room_members m where m.room_id = r.id and m.joined_at > now() - interval '7 days') as new_members,
  (select count(*)::int from posts p where p.room_id = r.id and p.status = 'published' and p.visibility = 'public'
      and p.published_at > now() - interval '7 days') as posts_week,
  (select count(*)::int from posts p where p.room_id = r.id and p.status = 'published' and p.visibility = 'public') as posts_total,
  exists (select 1 from room_members m where m.room_id = r.id and m.user_id = $1) as joined
`;

function roomJson(r: any) {
  return {
    slug: r.slug, name: r.name, description: r.description, color: r.color, guidelines: r.guidelines,
    official: r.official, createdAt: r.created_at, joined: r.joined,
    stats: { members: r.members, newMembers: r.new_members, postsWeek: r.posts_week, posts: r.posts_total },
  };
}

function slugify(s: string) {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
}

export default async function roomRoutes(app: FastifyInstance) {
  app.get('/api/rooms', async (req) => {
    const rows = await q(`select ${ROOM_COLUMNS} from rooms r order by r.official desc, members desc, r.name`, [req.user?.id ?? null]);
    return { rooms: rows.map(roomJson) };
  });

  app.get('/api/rooms/:slug', async (req) => {
    const { slug } = parse(z.object({ slug: z.string().max(40) }), req.params);
    const r = await one(`select ${ROOM_COLUMNS} from rooms r where r.slug = $2`, [req.user?.id ?? null, slug]);
    if (!r) throw notFound('Diesen Raum gibt es nicht');
    return { room: roomJson(r) };
  });

  app.post('/api/rooms', { config: { rateLimit: { max: 5, timeWindow: '1 day' } } }, async (req) => {
    const me = requireUser(req);
    const body = parse(z.object({
      name: z.string().trim().min(3, 'Mindestens 3 Zeichen').max(LIMITS.roomName),
      description: z.string().trim().min(10, 'Beschreib den Raum in einem Satz').max(LIMITS.roomDescription),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#213885'),
      guidelines: z.array(z.string().trim().min(3).max(120)).max(5).default([]),
    }), req.body);
    const own = await one('select count(*)::int as n from rooms where created_by = $1', [me.id]);
    if (own.n >= 3) throw badRequest('Du kannst höchstens drei Räume eröffnen');
    const slug = slugify(body.name);
    if (slug.length < 2) throw badRequest('Der Name braucht ein paar Buchstaben');
    if (await one('select 1 from rooms where slug = $1', [slug])) throw badRequest('Einen Raum mit diesem Namen gibt es schon');
    const r = await one(
      'insert into rooms (slug, name, description, color, guidelines, created_by) values ($1, $2, $3, $4, $5, $6) returning id, slug',
      [slug, body.name, body.description, body.color, body.guidelines, me.id],
    );
    await q('insert into room_members (room_id, user_id) values ($1, $2)', [r.id, me.id]);
    return { slug: r.slug };
  });

  app.put('/api/rooms/:slug/membership', async (req) => {
    const me = requireUser(req);
    const { slug } = parse(z.object({ slug: z.string().max(40) }), req.params);
    const r = await one('select id from rooms where slug = $1', [slug]);
    if (!r) throw notFound();
    await q('insert into room_members (room_id, user_id) values ($1, $2) on conflict do nothing', [r.id, me.id]);
    return { joined: true };
  });

  app.delete('/api/rooms/:slug/membership', async (req) => {
    const me = requireUser(req);
    const { slug } = parse(z.object({ slug: z.string().max(40) }), req.params);
    await q('delete from room_members where user_id = $1 and room_id = (select id from rooms where slug = $2)', [me.id, slug]);
    return { joined: false };
  });
}
