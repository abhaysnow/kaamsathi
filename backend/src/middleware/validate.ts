import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/errors.js';

type Source = 'body' | 'query' | 'params';

/** Parses and replaces the request part with the validated value; unknown keys are rejected by .strict() schemas. */
export const validate =
  <T>(schema: ZodType<T>, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(source === 'body' ? (req.body ?? {}) : req[source]);
    if (!parsed.success) {
      return next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          'Some fields are missing or invalid',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }
    if (source === 'body') req.body = parsed.data;
    else
      Object.defineProperty(req, source, {
        value: parsed.data,
        writable: true,
        configurable: true,
      });
    next();
  };
