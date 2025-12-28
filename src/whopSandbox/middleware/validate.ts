import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ZodError } from 'zod';
import { sendWhopSandboxError } from '../error.js';

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      (req as any).validatedQuery = parsed;
      return next();
    } catch (e) {
      if (e instanceof ZodError) {
        return sendWhopSandboxError(res, 400, 'invalid_query', 'Invalid query parameters', e.flatten());
      }
      return sendWhopSandboxError(res, 400, 'invalid_query', 'Invalid query parameters');
    }
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.params);
      (req as any).validatedParams = parsed;
      return next();
    } catch (e) {
      if (e instanceof ZodError) {
        return sendWhopSandboxError(res, 400, 'invalid_params', 'Invalid path parameters', e.flatten());
      }
      return sendWhopSandboxError(res, 400, 'invalid_params', 'Invalid path parameters');
    }
  };
}

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body);
      (req as any).validatedBody = parsed;
      return next();
    } catch (e) {
      if (e instanceof ZodError) {
        return sendWhopSandboxError(res, 400, 'invalid_body', 'Invalid request body', e.flatten());
      }
      return sendWhopSandboxError(res, 400, 'invalid_body', 'Invalid request body');
    }
  };
}


