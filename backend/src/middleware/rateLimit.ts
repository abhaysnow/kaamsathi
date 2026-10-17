import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { normalizeEmail } from '../auth/password.js';

const handler = (windowMsg: string) => ({
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: `Too many requests. Please wait ${windowMsg} and try again.`,
    },
  },
});

const ip = (req: Request) => ipKeyGenerator(req.ip ?? '0.0.0.0');
/** Keyed by IP + session owner so one shared network does not lock everyone out of demos. */
const key = (req: Request) => `${ip(req)}|${req.ownerId ?? ''}`;

export const aiLimiter = (max = 20) =>
  rateLimit({ windowMs: 60_000, limit: max, keyGenerator: key, ...handler('a minute') });

export const generalLimiter = (max = 300) =>
  rateLimit({ windowMs: 60_000, limit: max, keyGenerator: key, ...handler('a minute') });

const FIFTEEN_MIN = 15 * 60_000;
const bodyEmail = (req: Request) =>
  typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';

/**
 * Login is limited per IP+email (slows guessing one account) and per IP overall (slows spraying
 * many accounts from one address). Failed and successful attempts both count.
 */
export const loginLimiters = (max: number) => [
  rateLimit({
    windowMs: FIFTEEN_MIN,
    limit: max,
    keyGenerator: (req) => `${ip(req)}|${bodyEmail(req)}`,
    ...handler('15 minutes'),
  }),
  rateLimit({
    windowMs: FIFTEEN_MIN,
    limit: max * 5,
    keyGenerator: ip,
    ...handler('15 minutes'),
  }),
];

/** Forgot-password and reset-password: per IP. */
export const authLimiter = (max: number) =>
  rateLimit({ windowMs: FIFTEEN_MIN, limit: max, keyGenerator: ip, ...handler('15 minutes') });

export const registerLimiter = (max: number) =>
  rateLimit({ windowMs: 60 * 60_000, limit: max, keyGenerator: ip, ...handler('an hour') });
