import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { LIMITS } from '../../../shared/constants.js';
import { config } from '../config.js';
import { one, q, tx } from '../db.js';
import { badRequest, HttpError } from '../lib/errors.js';
import { resetMail, sendMail } from '../lib/mail.js';
import { mediaUrl } from '../lib/media-url.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { clearSessionCookie, createSession, destroySession, requireUser, setSessionCookie, type SessionUser } from '../lib/session.js';
import { parse } from '../lib/validate.js';

const handle = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9_.]{3,24}$/, '3–24 Zeichen: Buchstaben, Ziffern, Punkt oder Unterstrich');
const password = z.string().min(8, 'Mindestens 8 Zeichen').max(200);
const email = z.string().trim().toLowerCase().email('Bitte eine gültige E-Mail-Adresse');

const RESERVED = new Set(['admin', 'lapis', 'moderator', 'support', 'anonym', 'system', 'api', 'media', 'hilfe']);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function meJson(u: SessionUser) {
  return {
    id: u.id, handle: u.handle, name: u.display_name, email: u.email, bio: u.bio,
    avatar: mediaUrl(u.avatar_key), role: u.role, joinedAt: u.created_at,
  };
}

export default async function authRoutes(app: FastifyInstance) {
  const strict = { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } };

  app.post('/api/auth/register', strict, async (req, reply) => {
    const body = parse(z.object({
      handle,
      name: z.string().trim().min(1, 'Wie sollen wir dich nennen?').max(LIMITS.displayName),
      email,
      password,
      native: z.boolean().optional(),
    }), req.body);
    if (RESERVED.has(body.handle)) throw badRequest('Dieser Name ist reserviert', 'handle_taken');
    const taken = await one('select handle, email from users where handle = $1 or email = $2', [body.handle, body.email]);
    if (taken) {
      throw taken.handle === body.handle
        ? badRequest('Dieser Name ist schon vergeben', 'handle_taken')
        : badRequest('Mit dieser E-Mail gibt es schon ein Konto', 'email_taken');
    }
    const hash = await hashPassword(body.password);
    const user = await tx(async (c) => {
      const u = await one<SessionUser>(
        `insert into users (handle, display_name, email, password_hash) values ($1, $2, $3, $4)
         returning id, handle, display_name, email, bio, avatar_key, role, created_at`,
        [body.handle, body.name, body.email, hash], c,
      );
      await q(`insert into room_members (room_id, user_id) select id, $1 from rooms where slug in ('heute', 'tagebuch')`, [u!.id], c);
      return u!;
    });
    const token = await createSession(user.id, req.headers['user-agent']);
    setSessionCookie(reply, token);
    return { user: meJson(user), token: body.native ? token : undefined };
  });

  app.post('/api/auth/login', strict, async (req, reply) => {
    const body = parse(z.object({ login: z.string().trim().toLowerCase().min(1), password: z.string().min(1), native: z.boolean().optional() }), req.body);
    const row = await one<SessionUser & { password_hash: string }>(
      `select id, handle, display_name, email, bio, avatar_key, role, created_at, password_hash
         from users where email = $1 or handle = $1`,
      [body.login.replace(/^@/, '')],
    );
    if (!row || !(await verifyPassword(body.password, row.password_hash))) {
      throw new HttpError(401, 'E-Mail/Name oder Passwort stimmt nicht', 'bad_credentials');
    }
    const { password_hash, ...user } = row;
    const token = await createSession(user.id, req.headers['user-agent']);
    setSessionCookie(reply, token);
    return { user: meJson(user), token: body.native ? token : undefined };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    if (req.sessionToken) await destroySession(req.sessionToken);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', async (req) => ({ user: req.user ? meJson(req.user) : null }));

  // Passwort vergessen: Antwortet immer gleich, damit niemand herausfindet, welche Adressen ein Konto haben.
  app.post('/api/auth/forgot', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (req) => {
    const body = parse(z.object({ email }), req.body);
    const user = await one<{ id: string; display_name: string; email: string }>('select id, display_name, email from users where email = $1', [body.email]);
    if (user) {
      const recent = await one('select count(*)::int as n from password_resets where user_id = $1 and created_at > now() - interval \'1 hour\'', [user.id]);
      if (recent.n < 3) {
        const token = randomBytes(32).toString('base64url');
        await q('update password_resets set used_at = now() where user_id = $1 and used_at is null', [user.id]);
        await q(`insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')`, [sha256(token), user.id]);
        const link = `${config.publicUrl}/passwort-neu?token=${token}`;
        // Nicht abwarten: sonst verrät die Antwortzeit, ob es das Konto gibt.
        sendMail({ to: user.email, ...resetMail(user.display_name, link) }).catch((e) => req.log.error(e, 'Reset-Mail fehlgeschlagen'));
      }
    }
    return { ok: true };
  });

  app.post('/api/auth/reset', strict, async (req, reply) => {
    const body = parse(z.object({ token: z.string().min(20).max(200), password, native: z.boolean().optional() }), req.body);
    const user = await tx(async (c) => {
      const row = await one<{ user_id: string }>(
        `update password_resets set used_at = now()
          where token_hash = $1 and used_at is null and expires_at > now() returning user_id`,
        [sha256(body.token)], c,
      );
      if (!row) throw badRequest('Dieser Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.', 'reset_invalid');
      await q('update users set password_hash = $2 where id = $1', [row.user_id, await hashPassword(body.password)], c);
      // Überall abmelden – wer das alte Passwort kannte, fliegt raus.
      await q('delete from sessions where user_id = $1', [row.user_id], c);
      await q('update password_resets set used_at = now() where user_id = $1 and used_at is null', [row.user_id], c);
      return one<SessionUser>('select id, handle, display_name, email, bio, avatar_key, role, created_at from users where id = $1', [row.user_id], c);
    });
    const token = await createSession(user!.id, req.headers['user-agent']);
    setSessionCookie(reply, token);
    return { user: meJson(user!), token: body.native ? token : undefined };
  });

  app.post('/api/auth/password', strict, async (req) => {
    const me = requireUser(req);
    const body = parse(z.object({ current: z.string(), next: password }), req.body);
    const row = await one('select password_hash from users where id = $1', [me.id]);
    if (!(await verifyPassword(body.current, row.password_hash))) throw badRequest('Das aktuelle Passwort stimmt nicht', 'bad_credentials');
    await q('update users set password_hash = $2 where id = $1', [me.id, await hashPassword(body.next)]);
    // Alle anderen Sitzungen beenden.
    await q(`delete from sessions where user_id = $1 and token_hash <> encode(sha256(convert_to($2, 'UTF8')), 'hex')`, [me.id, req.sessionToken]);
    return { ok: true };
  });

  app.delete('/api/auth/account', strict, async (req, reply) => {
    const me = requireUser(req);
    const body = parse(z.object({ password: z.string() }), req.body);
    const row = await one('select password_hash from users where id = $1', [me.id]);
    if (!(await verifyPassword(body.password, row.password_hash))) throw badRequest('Das Passwort stimmt nicht', 'bad_credentials');
    await q('delete from users where id = $1', [me.id]);
    clearSessionCookie(reply);
    return { ok: true };
  });

  // Datenexport (DSGVO / revDSG): alles, was jemand geschrieben hat, als JSON.
  app.get('/api/auth/export', async (req, reply) => {
    const me = requireUser(req);
    const [posts, comments, bookmarks, follows, rooms] = await Promise.all([
      q(`select p.id, p.status, p.kind, p.title, p.body, p.mood, p.visibility, p.anonymous, p.content_warning,
                p.response_mode, p.prompt_day, p.word_count, p.unlock_at, p.created_at, p.published_at, r.slug as room
           from posts p left join rooms r on r.id = p.room_id where p.author_id = $1 order by p.created_at`, [me.id]),
      q('select post_id, body, created_at from comments where author_id = $1 and deleted_at is null order by created_at', [me.id]),
      q('select post_id, created_at from bookmarks where user_id = $1', [me.id]),
      q('select u.handle, f.created_at from follows f join users u on u.id = f.followee_id where f.follower_id = $1', [me.id]),
      q('select r.slug, m.joined_at from room_members m join rooms r on r.id = m.room_id where m.user_id = $1', [me.id]),
    ]);
    reply.header('content-disposition', `attachment; filename="lapis-${me.handle}.json"`);
    return { exportedAt: new Date().toISOString(), user: meJson(me), posts, comments, bookmarks, follows, rooms };
  });
}
