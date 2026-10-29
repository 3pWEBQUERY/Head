import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { one, q } from '../db.js';
import { forbidden, unauthorized } from './errors.js';

export const SESSION_COOKIE = 'lapis_session';

export type SessionUser = {
  id: string;
  handle: string;
  display_name: string;
  email: string;
  bio: string;
  avatar_key: string | null;
  role: 'member' | 'moderator' | 'admin';
  created_at: string;
};

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionToken: string | null;
    viaCookie: boolean;
  }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
  await q('insert into sessions (token_hash, user_id, user_agent, expires_at) values ($1, $2, $3, $4)', [
    hash(token), userId, userAgent?.slice(0, 200) ?? null, expires,
  ]);
  return token;
}

export async function destroySession(token: string) {
  await q('delete from sessions where token_hash = $1', [hash(token)]);
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    maxAge: config.sessionDays * 86_400,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

function readToken(req: FastifyRequest): { token: string | null; viaCookie: boolean } {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return { token: auth.slice(7).trim(), viaCookie: false };
  const c = req.cookies[SESSION_COOKIE];
  return { token: c ?? null, viaCookie: Boolean(c) };
}

/** Lädt den Nutzer zur Session. Native Apps schicken `Authorization: Bearer <token>`. */
export async function authenticate(req: FastifyRequest) {
  const { token, viaCookie } = readToken(req);
  req.user = null;
  req.sessionToken = null;
  req.viaCookie = viaCookie;
  if (!token) return;
  const row = await one<SessionUser & { last_seen_at: Date }>(
    `select u.id, u.handle, u.display_name, u.email, u.bio, u.avatar_key, u.role, u.created_at, s.last_seen_at
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hash(token)],
  );
  if (!row) return;
  const { last_seen_at, ...user } = row;
  req.user = user;
  req.sessionToken = token;
  if (Date.now() - new Date(last_seen_at).getTime() > 3_600_000) {
    q('update sessions set last_seen_at = now() where token_hash = $1', [hash(token)]).catch(() => {});
  }
}

/**
 * CSRF-Schutz für Cookie-Sessions: schreibende Anfragen brauchen den Header
 * `x-lapis`. Fremde Seiten können ihn ohne CORS-Freigabe nicht setzen.
 */
export function checkCsrf(req: FastifyRequest) {
  if (!req.viaCookie) return;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  if (req.headers['x-lapis'] !== '1') throw forbidden('Ungültige Anfrage');
}

export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
