import { Router } from 'express';
import { z } from 'zod';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { getSeedForRequest } from '../request-context.js';
import { getStore } from '../data/store.js';
import { sendWhopSandboxError } from '../error.js';
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

function parseIso(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

router.get(
  '/',
  validateQuery(
    paginationQuerySchema.extend({
      company_id: z.string().min(1),
      product_ids: z.union([z.string(), z.array(z.string())]).optional(),
      statuses: z.union([z.string(), z.array(z.string())]).optional(),
      created_after: z.string().optional(),
      order: z.enum(['paid_at', 'created_at']).optional(),
      direction: z.enum(['asc', 'desc']).optional(),
    }),
  ),
  (req, res) => {
    const q = (req as any).validatedQuery as {
      company_id: string;
      product_ids?: string | string[];
      statuses?: string | string[];
      created_after?: string;
      order?: 'paid_at' | 'created_at';
      direction?: 'asc' | 'desc';
      limit?: number;
      cursor?: string;
    };
    const store = getStore(getSeedForRequest(req));

    const productIds = new Set(parseCsv(q.product_ids));
    const statuses = new Set(parseCsv(q.statuses));
    const createdAfter = q.created_after ? parseIso(q.created_after) : null;
    if (q.created_after && !createdAfter) {
      return sendWhopSandboxError(res, 400, 'invalid_query', 'created_after must be an ISO date');
    }

    const filtered = store.payments
      .filter((p) => p.company_id === q.company_id)
      .filter((p) => (productIds.size > 0 ? productIds.has(p.product.id) : true))
      .filter((p) => (statuses.size > 0 ? statuses.has(p.status) : true))
      .filter((p) => (createdAfter ? p.created_at >= createdAfter : true));

    const orderKey = q.order ?? 'paid_at';
    const direction = q.direction ?? 'desc';
    const ordered = [...filtered].sort((a, b) => {
      const av = (a as any)[orderKey] || '';
      const bv = (b as any)[orderKey] || '';
      if (av === bv) return a.id < b.id ? -1 : 1;
      const cmp = av < bv ? -1 : 1;
      return direction === 'asc' ? cmp : -cmp;
    });

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
    const payment = store.paymentsById.get(id);
    if (!payment) return sendWhopSandboxError(res, 404, 'not_found', 'Payment not found');
    return res.json({ data: payment });
  },
);

export default router;


