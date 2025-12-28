import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../middleware/validate.js';
import { getSeedForRequest } from '../request-context.js';
import { getStore } from '../data/store.js';
import { sendWhopSandboxError } from '../error.js';

const router = Router();

router.get(
  '/:id',
  validateParams(z.object({ id: z.string().min(1) })),
  (req, res) => {
    const { id } = (req as any).validatedParams as { id: string };
    const store = getStore(getSeedForRequest(req));
    const company = store.companiesById.get(id);
    if (!company) return sendWhopSandboxError(res, 404, 'not_found', 'Company not found');
    return res.json({ data: company });
  },
);

export default router;


