import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

/**
 * CSRF defence for cookie sessions: state-changing requests must carry a custom header. Browsers
 * cannot add custom headers cross-origin without a CORS preflight, and our CORS allow-list only
 * permits the configured frontend origins. SameSite=Lax cookies add a second layer.
 */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.header('x-requested-with') !== 'kaamsaathi') {
    return next(new AppError(403, 'CSRF_REJECTED', 'Missing request header'));
  }
  next();
}
