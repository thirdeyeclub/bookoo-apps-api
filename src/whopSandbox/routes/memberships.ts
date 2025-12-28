import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../middleware/validate.js';
import { getSeedForRequest } from '../request-context.js';
import { getStore } from '../data/store.js';
import { paginate, paginationQuerySchema, parseCursor } from '../pagination.js';

const router = Router();

router.get(
  '/',
  validateQuery(
    paginationQuerySchema.extend({
      company_id: z.string().min(1),
      user_id: z.string().min(1),
    }),
  ),
  (req, res) => {
    const q = (req as any).validatedQuery as {
      company_id: string;
      user_id: string;
      limit?: number;
      cursor?: string;
    };
    const store = getStore(getSeedForRequest(req));
    const filtered = store.members.filter(
      (m) => m.company_id === q.company_id && m.user.id === q.user_id,
    );
    const ordered = [...filtered].sort((a, b) => (a.joined_at || '') > (b.joined_at || '') ? -1 : 1);
    const limit = q.limit ?? 50;
    const cursor = parseCursor(q.cursor);
    return res.json(paginate(ordered, cursor, limit));
  },
);

export default router;


