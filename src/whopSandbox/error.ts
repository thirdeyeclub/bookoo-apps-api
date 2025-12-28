import type { Response } from 'express';

export type WhopSandboxError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function sendWhopSandboxError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: WhopSandboxError = {
    error: { code, message, details },
  };
  return res.status(status).json(body);
}


