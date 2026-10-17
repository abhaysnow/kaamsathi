import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

/**
 * CSRF defence for cookie sessions, in three layers:
 * 1. SameSite=Lax session cookie: not sent on cross-site POST/PATCH/DELETE.
 * 2. State-changing requests must carry a custom header, which a cross-origin page cannot add
 *    without a CORS preflight that our allow-list rejects.
 * 3. If the browser sends an Origin header, it must be one of the configured frontend origins.
 */
export const csrfGuard =
  (allowedOrigins: string[]) => (req: Request, _res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.header('x-requested-with') !== 'kaamsaathi') {
      return next(new AppError(403, 'CSRF_REJECTED', 'Missing request header'));
    }
    const origin = req.header('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      return next(new AppError(403, 'CSRF_REJECTED', 'Origin not allowed'));
    }
    next();
  };
