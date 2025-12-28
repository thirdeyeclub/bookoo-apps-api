import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate.js';
import { getSeedForRequest } from '../request-context.js';
import { getStore } from '../data/store.js';
import { paginate, paginationQuerySchema, parseCursor } from '../pagination.js';

const router = Router();

function parseCsv(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.flatMap(parseCsv);
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

router.get(
  '/',
  validateQuery(
    paginationQuerySchema.extend({
      company_id: z.string().min(1),
      product_id: z.string().min(1),
      statuses: z.union([z.string(), z.array(z.string())]).optional(),
    }),
  ),
  (req, res) => {
    const q = (req as any).validatedQuery as {
      company_id: string;
      product_id: string;
      statuses?: string | string[];
      limit?: number;
      cursor?: string;
    };
    const store = getStore(getSeedForRequest(req));
    const statuses = new Set(parseCsv(q.statuses));
    const statusFilter = statuses.size > 0 ? statuses : new Set(['joined', 'left']);
    const filtered = store.members
      .filter((m) => m.company_id === q.company_id && m.product_id === q.product_id)
      .filter((m) => statusFilter.has(m.status));
    const ordered = [...filtered].sort((a, b) =>
      (a.most_recent_action_at || '') > (b.most_recent_action_at || '') ? -1 : 1,
    );
    const limit = q.limit ?? 50;
    const cursor = parseCursor(q.cursor);
    return res.json(paginate(ordered, cursor, limit));
  },
);

export default router;


