import type { Request } from 'express';
import { getRequestSeed } from './data/seed.js';

export function getSeedForRequest(req: Request): string {
  const headerSeed = getRequestSeed(req.header('x-whopsandbox-seed'));
  if (headerSeed) return headerSeed;
  const envSeed = getRequestSeed(process.env.WHOP_SANDBOX_SEED);
  if (envSeed) return envSeed;
  return 'default';
}


