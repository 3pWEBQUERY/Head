import pg from 'pg';
import { config } from './config.js';

// Bigint-IDs als Zahl ausgeben (bigserial bleibt weit unter 2^53).
pg.types.setTypeParser(20, (v) => Number(v));
// Datumsspalten (date) als String belassen.
pg.types.setTypeParser(1082, (v) => v);

const needsSsl = /sslmode=require/.test(config.databaseUrl);

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export type Queryable = Pick<pg.Pool, 'query'> | pg.PoolClient;

export async function q<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Queryable = pool): Promise<T[]> {
  const res = await db.query<T>(text, params as any[]);
  return res.rows;
}

export async function one<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = [], db: Queryable = pool): Promise<T | undefined> {
  const rows = await q<T>(text, params, db);
  return rows[0];
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}
