import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/env.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Server-derived owner key ("guest:<sid>" or "demo:<sid>"). Never taken from the client. */
    ownerId: string;
    isDemo: boolean;
  }
}

const COOKIE = 'ks_sid';

/**
 * Anonymous, server-issued session. This is NOT account authentication: it just gives each
 * browser a private data bucket. The id is random (UUIDv4) and the cookie is signed, HttpOnly,
 * SameSite=Lax. The client may only choose between its own "guest" and "demo" buckets via the
 * X-KS-Mode header; it can never name another user's bucket.
 */
export function session(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    let sid = req.signedCookies?.[COOKIE] as string | undefined;
    if (!sid || !/^[0-9a-f-]{36}$/.test(sid)) {
      sid = randomUUID();
      res.cookie(COOKIE, sid, {
        httpOnly: true,
        signed: true,
        sameSite: 'lax',
        secure: config.cookieSecure,
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });
    }
    req.isDemo = config.allowDemoMode && req.header('x-ks-mode') === 'demo';
    req.ownerId = `${req.isDemo ? 'demo' : 'guest'}:${sid}`;
    next();
  };
}
