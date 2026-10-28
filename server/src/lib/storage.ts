import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config, hasBucket } from '../config.js';

/**
 * Dateiablage. In Produktion ein Railway Bucket (privat, S3-kompatibel),
 * lokal ein Ordner. Ausgeliefert wird über /media/<key>: beim Bucket per
 * Weiterleitung auf eine signierte URL (Bucket-Egress ist bei Railway kostenlos).
 */
const s3 = hasBucket
  ? new S3Client({
      region: config.bucket.region,
      endpoint: config.bucket.endpoint,
      forcePathStyle: config.bucket.forcePathStyle,
      credentials: { accessKeyId: config.bucket.accessKeyId!, secretAccessKey: config.bucket.secretAccessKey! },
    })
  : null;

const SIGN_SECONDS = 24 * 3600;
const signed = new Map<string, { url: string; until: number }>();

export const storageKind = s3 ? 'bucket' : 'disk';

function localPath(key: string) {
  const p = path.resolve(config.uploadDir, key);
  if (!p.startsWith(path.resolve(config.uploadDir) + path.sep)) throw new Error('Ungültiger Schlüssel');
  return p;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: config.bucket.name, Key: key, Body: body, ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function deleteObject(key: string) {
  signed.delete(key);
  if (s3) await s3.send(new DeleteObjectCommand({ Bucket: config.bucket.name, Key: key }));
  else await rm(localPath(key), { force: true });
}

/** Signierte URL, für 12 Stunden wiederverwendet, damit Browser-Caches greifen. */
export async function signedUrl(key: string): Promise<string> {
  const hit = signed.get(key);
  if (hit && hit.until > Date.now()) return hit.url;
  const url = await getSignedUrl(s3!, new GetObjectCommand({ Bucket: config.bucket.name, Key: key }), { expiresIn: SIGN_SECONDS });
  signed.set(key, { url, until: Date.now() + (SIGN_SECONDS / 2) * 1000 });
  if (signed.size > 5000) signed.delete(signed.keys().next().value!);
  return url;
}

export async function readLocal(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}

export const usesBucket = Boolean(s3);
