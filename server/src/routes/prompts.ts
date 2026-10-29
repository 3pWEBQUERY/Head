import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dayKey, promptForDay } from '../../../shared/prompts.js';
import { one, q } from '../db.js';
import { parse } from '../lib/validate.js';

export default async function promptRoutes(app: FastifyInstance) {
  app.get('/api/prompts/today', async (req) => {
    const p = promptForDay(dayKey());
    const r = await one(
      `select count(*)::int as n,
              exists (select 1 from posts where prompt_day = $1 and author_id = $2 and status = 'published') as answered
         from posts where prompt_day = $1 and status = 'published' and visibility = 'public'`,
      [p.day, req.user?.id ?? null],
    );
    return { prompt: { ...p, responses: r.n, answered: r.answered } };
  });

  // Die letzten Impulse – für das Archiv.
  app.get('/api/prompts', async (req) => {
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(60).default(14) }), req.query);
    const today = Date.parse(dayKey() + 'T12:00:00Z');
    const list = Array.from({ length: days }, (_, i) => promptForDay(new Date(today - i * 86_400_000).toISOString().slice(0, 10)));
    const counts = await q(
      `select to_char(prompt_day, 'YYYY-MM-DD') as day, count(*)::int as n from posts
        where prompt_day >= $1 and status = 'published' and visibility = 'public' group by 1`,
      [list[list.length - 1].day],
    );
    const by = new Map(counts.map((c) => [c.day, c.n]));
    return { prompts: list.map((p) => ({ ...p, responses: by.get(p.day) ?? 0 })) };
  });

  app.get('/api/prompts/:day', async (req) => {
    const { day } = parse(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }), req.params);
    const p = promptForDay(day > dayKey() ? dayKey() : day);
    return { prompt: p };
  });
}
