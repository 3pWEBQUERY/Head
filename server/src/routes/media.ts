import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { q } from '../db.js';
import { badRequest } from '../lib/errors.js';
import { mediaUrl } from '../lib/media-url.js';
import { requireUser } from '../lib/session.js';
import { putObject, readLocal, signedUrl, usesBucket } from '../lib/storage.js';
import { parse } from '../lib/validate.js';

const SIZES = { avatar: { w: 512, h: 512, fit: 'cover' as const }, cover: { w: 1800, h: 1800, fit: 'inside' as const } };

export default async function mediaRoutes(app: FastifyInstance) {
  app.post('/api/media', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (req) => {
    const me = requireUser(req);
    const { purpose } = parse(z.object({ purpose: z.enum(['avatar', 'cover']).default('cover') }), req.query);
    const file = await req.file();
    if (!file) throw badRequest('Keine Datei erhalten');
    if (!/^image\/(jpeg|png|webp|gif|heic|heif|avif)$/.test(file.mimetype)) throw badRequest('Nur Bilder (JPG, PNG, WebP, HEIC)');
    const input = await file.toBuffer();
    const size = SIZES[purpose];
    let out: { data: Buffer; info: { width: number; height: number } };
    try {
      // .rotate() wendet die EXIF-Ausrichtung an; Metadaten (inkl. GPS) werden nicht übernommen.
      out = await sharp(input, { limitInputPixels: 60_000_000 })
        .rotate()
        .resize(size.w, size.h, { fit: size.fit, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw badRequest('Dieses Bild konnten wir nicht lesen');
    }
    const key = `${purpose}/${me.id.slice(0, 8)}/${randomBytes(12).toString('base64url')}.webp`;
    await putObject(key, out.data, 'image/webp');
    await q('insert into media (key, user_id, width, height, bytes) values ($1, $2, $3, $4, $5)', [key, me.id, out.info.width, out.info.height, out.data.length]);
    return { key, url: mediaUrl(key), width: out.info.width, height: out.info.height };
  });

  app.get('/media/*', async (req, reply) => {
    const key = (req.params as { '*': string })['*'];
    if (!/^(avatar|cover)\/[a-f0-9-]{8}\/[A-Za-z0-9_-]+\.webp$/.test(key)) return reply.code(404).send();
    if (usesBucket) {
      const url = await signedUrl(key);
      return reply.header('cache-control', 'private, max-age=21600').redirect(url, 302);
    }
    const data = await readLocal(key);
    if (!data) return reply.code(404).send();
    return reply.header('content-type', 'image/webp').header('cache-control', 'public, max-age=31536000, immutable').send(data);
  });
}
