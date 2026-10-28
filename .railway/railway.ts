// Railway Infrastructure as Code: App, Postgres und Bucket in Europa (Amsterdam).
// Ausrollen: `railway config plan` und danach `railway config apply` (Railway-CLI, im Projekt verlinkt).
import { bucket, defineRailway, github, postgres, project, ref, service } from 'railway/iac';

export default defineRailway(() => {
  const db = postgres('postgres', { region: 'europe-west4' });
  const media = bucket('lapis-media', { region: 'ams' });

  const web = service('lapis', {
    source: github('3pWEBQUERY/Head', { branch: 'main' }),
    build: 'npm run build',
    start: 'npm start',
    healthcheck: '/api/health',
    healthcheckTimeout: 60,
    replicas: { 'europe-west4': 1 },
    env: {
      DATABASE_URL: db.env.DATABASE_URL,
      // Railway Bucket: privat, S3-kompatibel. Die App liest genau diese Namen.
      BUCKET: ref(media, 'BUCKET'),
      ENDPOINT: ref(media, 'ENDPOINT'),
      REGION: ref(media, 'REGION'),
      ACCESS_KEY_ID: ref(media, 'ACCESS_KEY_ID'),
      SECRET_ACCESS_KEY: ref(media, 'SECRET_ACCESS_KEY'),
    },
  });

  return project('lapis', { resources: [db, media, web] });
});
