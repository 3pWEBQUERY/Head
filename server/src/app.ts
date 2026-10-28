import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { pool } from './db.js';
import { HttpError } from './lib/errors.js';
import { authenticate, checkCsrf } from './lib/session.js';
import { storageKind } from './lib/storage.js';
import authRoutes from './routes/auth.js';
import commentRoutes from './routes/comments.js';
import mediaRoutes from './routes/media.js';
import notificationRoutes from './routes/notifications.js';
import postRoutes from './routes/posts.js';
import promptRoutes from './routes/prompts.js';
import roomRoutes from './routes/rooms.js';
import userRoutes from './routes/users.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify({ trustProxy: config.trustProxy, bodyLimit: 512 * 1024, ...opts });

  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: config.maxUploadBytes, files: 1 } });
  await app.register(rateLimit, { max: 600, timeWindow: '5 minutes', allowList: (req) => !req.url.startsWith('/api/') });

  app.decorateRequest('user', null);
  app.decorateRequest('sessionToken', null);
  app.decorateRequest('viaCookie', false);

  app.addHook('onRequest', async (req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (config.production) reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    if (req.url.startsWith('/api/')) {
      reply.header('cache-control', 'no-store');
      await authenticate(req);
      checkCsrf(req);
    } else if (req.url.startsWith('/media/')) {
      // Bilder sind öffentlich; keine Session nötig.
    } else {
      reply.header('content-security-policy', CSP);
    }
  });

  app.setErrorHandler((err: any, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message, code: err.code });
    if (err.statusCode === 429) return reply.code(429).send({ error: 'Kurz durchatmen – zu viele Anfragen. Versuch es gleich nochmal.', code: 'rate_limited' });
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ error: 'Das Bild ist zu gross', code: 'too_large' });
    if (err.validation || err.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' || err.statusCode === 400 || err.statusCode === 415) {
      return reply.code(400).send({ error: 'Ungültige Anfrage', code: 'bad_request' });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'Da ist etwas schiefgelaufen. Wir schauen uns das an.', code: 'internal' });
  });

  app.get('/api/health', async () => {
    await pool.query('select 1');
    return { ok: true, storage: storageKind };
  });

  await app.register(authRoutes);
  await app.register(postRoutes);
  await app.register(commentRoutes);
  await app.register(roomRoutes);
  await app.register(userRoutes);
  await app.register(notificationRoutes);
  await app.register(promptRoutes);
  await app.register(mediaRoutes);

  // Gebaute Web-App (PWA) ausliefern, falls vorhanden.
  const webRoot = path.resolve(process.cwd(), 'dist/web');
  const hasWeb = existsSync(path.join(webRoot, 'index.html'));
  if (hasWeb) {
    await app.register(fastifyStatic, {
      root: webRoot,
      wildcard: false,
      index: false,
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.header('cache-control', 'public, max-age=31536000, immutable');
        else res.header('cache-control', 'no-cache');
      },
    });
    app.get('/*', async (req, reply) => {
      const rel = (req.params as { '*': string })['*'];
      if (rel.startsWith('api/') || rel.startsWith('media/')) return reply.code(404).send({ error: 'Nicht gefunden', code: 'not_found' });
      if (rel && !rel.endsWith('/') && existsSync(path.join(webRoot, rel)) && path.resolve(webRoot, rel).startsWith(webRoot + path.sep)) {
        return reply.sendFile(rel);
      }
      return reply.header('cache-control', 'no-cache').sendFile('index.html');
    });
  }

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'Nicht gefunden', code: 'not_found' });
  });

  return app;
}
