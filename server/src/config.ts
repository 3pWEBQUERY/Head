const env = process.env;

function first(...keys: string[]): string | undefined {
  for (const k of keys) if (env[k]) return env[k];
  return undefined;
}

const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : undefined;

export const config = {
  production: env.NODE_ENV === 'production',
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? '0.0.0.0',
  databaseUrl: env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/lapis',
  publicUrl: (env.PUBLIC_URL ?? railwayDomain ?? 'http://localhost:5173').replace(/\/$/, ''),
  sessionDays: Number(env.SESSION_DAYS ?? 60),
  // Railway Bucket (S3-kompatibel). Unterstützt die Railway-Namen und die AWS-SDK-Vorlage.
  bucket: {
    name: first('BUCKET', 'AWS_S3_BUCKET_NAME', 'S3_BUCKET'),
    endpoint: first('ENDPOINT', 'AWS_ENDPOINT_URL', 'AWS_ENDPOINT_URL_S3', 'S3_ENDPOINT'),
    region: first('REGION', 'AWS_DEFAULT_REGION', 'AWS_REGION', 'S3_REGION') ?? 'auto',
    accessKeyId: first('ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID'),
    secretAccessKey: first('SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY'),
    forcePathStyle: (env.S3_FORCE_PATH_STYLE ?? 'false') === 'true',
  },
  uploadDir: env.UPLOAD_DIR ?? '.uploads',
  maxUploadBytes: Number(env.MAX_UPLOAD_MB ?? 12) * 1024 * 1024,
  trustProxy: env.TRUST_PROXY !== 'false',
};

export const hasBucket = Boolean(config.bucket.name && config.bucket.accessKeyId && config.bucket.secretAccessKey);
