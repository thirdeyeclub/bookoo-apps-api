import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../middleware/validate.js';
import { getSeedForRequest } from '../request-context.js';
import { getStore } from '../data/store.js';
import { sendWhopSandboxError } from '../error.js';

const router = Router();

router.get(
  '/by-username/:username',
  validateParams(z.object({ username: z.string().min(1) })),
  (req, res) => {
    const { username } = (req as any).validatedParams as { username: string };
    const store = getStore(getSeedForRequest(req));
    const user = store.usersByUsername.get(username);
    if (!user) return sendWhopSandboxError(res, 404, 'not_found', 'User not found');
    return res.json({ data: user });
  },
);

router.get(
  '/:id',
  validateParams(z.object({ id: z.string().min(1) })),
  (req, res) => {
    const { id } = (req as any).validatedParams as { id: string };
    const store = getStore(getSeedForRequest(req));
    const user = store.usersById.get(id);
    if (!user) return sendWhopSandboxError(res, 404, 'not_found', 'User not found');
    return res.json({ data: user });
  },
);

export default router;


