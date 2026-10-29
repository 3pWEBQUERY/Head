import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Funktioniert aus server/src (tsx) und aus dist/node/server/src (Build).
const candidates = [path.resolve(here, '../migrations'), path.resolve(process.cwd(), 'server/migrations')];

async function migrationsDir(): Promise<string> {
  for (const dir of candidates) {
    try {
      await readdir(dir);
      return dir;
    } catch {}
  }
  throw new Error('Migrationsordner nicht gefunden');
}

export async function migrate(log: (msg: string) => void = console.log): Promise<void> {
  const dir = await migrationsDir();
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const c = await pool.connect();
  try {
    // Advisory Lock, damit parallel startende Instanzen nicht gleichzeitig migrieren.
    await c.query('select pg_advisory_lock(727274)');
    await c.query('create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())');
    const done = new Set((await c.query<{ name: string }>('select name from schema_migrations')).rows.map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(path.join(dir, f), 'utf8');
      await c.query('begin');
      try {
        await c.query(sql);
        await c.query('insert into schema_migrations (name) values ($1)', [f]);
        await c.query('commit');
        log(`migration ${f} angewendet`);
      } catch (e) {
        await c.query('rollback');
        throw e;
      }
    }
  } finally {
    await c.query('select pg_advisory_unlock(727274)').catch(() => {});
    c.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
