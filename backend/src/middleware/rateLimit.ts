import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

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

/** Keyed by IP + session owner so one shared network does not lock everyone out of demos. */
const key = (req: { ip?: string; ownerId?: string }) =>
  `${ipKeyGenerator(req.ip ?? '0.0.0.0')}|${req.ownerId ?? ''}`;

export const aiLimiter = (max = 20) =>
  rateLimit({ windowMs: 60_000, limit: max, keyGenerator: key, ...handler('a minute') });

export const generalLimiter = (max = 300) =>
  rateLimit({ windowMs: 60_000, limit: max, keyGenerator: key, ...handler('a minute') });
