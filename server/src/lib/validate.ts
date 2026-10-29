import type { z } from 'zod';
import { badRequest } from './errors.js';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    const issue = r.error.issues[0];
    const field = issue?.path.join('.');
    throw badRequest(issue?.message ? (field ? `${field}: ${issue.message}` : issue.message) : 'Ungültige Eingabe', 'invalid');
  }
  return r.data;
}
