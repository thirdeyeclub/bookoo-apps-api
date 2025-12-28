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
      company_id: z.string().min(1),
      route: z.string().min(1).optional(),
    }),
  ),
  (req, res) => {
    const q = (req as any).validatedQuery as {
      company_id: string;
      route?: string;
      limit?: number;
      cursor?: string;
    };
    const store = getStore(getSeedForRequest(req));
    const filtered = store.products.filter((p) => p.company_id === q.company_id);
    const filtered2 = q.route ? filtered.filter((p) => p.route === q.route) : filtered;
    const ordered = [...filtered2].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
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
    const product = store.productsById.get(id);
    if (!product) return sendWhopSandboxError(res, 404, 'not_found', 'Product not found');
    return res.json({ data: product });
  },
);

export default router;


