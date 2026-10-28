import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';

const app = await buildApp({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
await migrate((m) => app.log.info(m));
await app.listen({ port: config.port, host: config.host });

for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, async () => {
    app.log.info(`${sig} erhalten, fahre herunter`);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
