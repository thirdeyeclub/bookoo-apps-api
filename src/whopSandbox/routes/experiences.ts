import { Router } from 'express';
import { z } from 'zod';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { getSeedForRequest } from '../request-context.js';
import { getStore } from '../data/store.js';
import { sendWhopSandboxError } from '../error.js';
import { paginate, paginationQuerySchema, parseCursor } from '../pagination.js';

const router = Router();

router.get(
  '/',
  validateQuery(
    paginationQuerySchema.extend({
      company_id: z.string().min(1).optional(),
    }),
  ),
  (req, res) => {
    const q = (req as any).validatedQuery as {
      company_id?: string;
      limit?: number;
      cursor?: string;
    };
    const store = getStore(getSeedForRequest(req));
    const filtered = q.company_id
      ? store.experiences.filter((e) => e.company.id === q.company_id)
      : store.experiences;
    const ordered = [...filtered].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    const limit = q.limit ?? 50;
    const cursor = parseCursor(q.cursor);
    return res.json(paginate(ordered, cursor, limit));
  },
);

router.get(
  '/:id',
  validateParams(z.object({ id: z.string().min(1) })),
  (req, res) => {
    const { id } = (req as any).validatedParams as { id: string };
    const store = getStore(getSeedForRequest(req));
    const exp = store.experiencesById.get(id);
    if (!exp) return sendWhopSandboxError(res, 404, 'not_found', 'Experience not found');
    return res.json({ data: exp });
  },
);

export default router;


