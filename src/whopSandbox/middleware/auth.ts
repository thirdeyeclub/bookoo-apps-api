import type { NextFunction, Request, Response } from 'express';
import { sendWhopSandboxError } from '../error.js';

function hasBearerAuth(req: Request): boolean {
  const raw = req.header('authorization') || '';
  return /^Bearer\s+.+/i.test(raw.trim());
}

export function requireBearerAuth(req: Request, res: Response, next: NextFunction) {
  if (!hasBearerAuth(req)) {
    return sendWhopSandboxError(res, 401, 'unauthorized', 'Missing Authorization: Bearer <token>');
  }
  return next();
}


