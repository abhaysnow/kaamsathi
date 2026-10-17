import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));

/** One response shape for every failure: { error: { code, message, details? } }. No stack traces, ever. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  void _next;
  if (err instanceof AppError) {
    return void res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  const e = err as { type?: string; status?: number };
  if (e.type === 'entity.too.large') {
    return void res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large' } });
  }
  if (e.type === 'entity.parse.failed') {
    return void res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } });
  }
  // Log the error class and route only: messages may contain user text.
  logger.error({ route: req.path, errName: (err as Error)?.name }, 'unhandled error');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
};
