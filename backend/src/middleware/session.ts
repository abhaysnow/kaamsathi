import { randomUUID } from 'node:crypto';
import session, { type Store } from 'express-session';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppConfig } from '../config/env.js';
import type { Repositories } from '../repositories/types.js';
import type { UserRecord } from '../types/domain.js';
import { AppError } from '../utils/errors.js';

declare module 'express-session' {
  interface SessionData {
    userId: string;
    /** Must equal the user's current sessionVersion; a password reset bumps it. */
    sessionVersion: number;
    /** Absolute server-side expiry (ms epoch), independent of the cookie lifetime. */
    expiresAt: number;
    /** Demo logins get a private sandbox so visitors sharing the demo login cannot see each other. */
    demoBucket?: string;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set only after the server has validated the session against the database. */
    user?: UserRecord;
    /** Server-derived data owner ("user:<id>" or "demo:<sandbox>"). Never taken from the client. */
    ownerId: string;
    isDemo: boolean;
  }
}

export const SESSION_COOKIE = 'ks_sid';

/**
 * express-session keeps session data server-side (MongoDB via connect-mongo in production, the
 * in-process MemoryStore in local/demo mode). The browser only holds a signed, random session id
 * in an HttpOnly, SameSite=Lax cookie (Secure when COOKIE_SECURE=true). No session is created
 * until login (saveUninitialized: false).
 */
export function sessionMiddleware(config: AppConfig, store?: Store): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    // Defer to the app's trust-proxy setting (TRUST_PROXY_HOPS, see app.ts).
    proxy: undefined,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: config.sessionTtlMs,
    },
  });
}

/**
 * Resolves req.user from the session on every request, and drops the session if it has expired,
 * the user no longer exists, the password was reset since login, or the demo account was
 * disabled. Authorisation never relies on anything the browser claims.
 */
export function loadUser(repos: Repositories, config: AppConfig): RequestHandler {
  return (req, _res, next) => {
    req.ownerId = '';
    req.isDemo = false;
    const s = req.session;
    if (!s?.userId) return next();

    const drop = () => s.destroy(() => next());
    if (!s.expiresAt || s.expiresAt <= Date.now()) return drop();

    repos.users
      .findById(s.userId)
      .then((user) => {
        if (!user || user.sessionVersion !== s.sessionVersion) return drop();
        if (user.role === 'demo' && (!config.demo.enabled || !s.demoBucket)) return drop();
        req.user = user;
        req.isDemo = user.role === 'demo';
        req.ownerId = req.isDemo ? `demo:${s.demoBucket}` : `user:${user.id}`;
        next();
      })
      .catch(next);
  };
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) =>
  req.user ? next() : next(new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'));

/** Starts a fresh session (new id, preventing fixation) for a verified user. */
export function startSession(
  req: Request,
  user: UserRecord,
  config: AppConfig,
  remember: boolean,
): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => {
      if (err) return reject(err);
      const ttl = remember ? config.rememberMeMs : config.sessionTtlMs;
      req.session.userId = user.id;
      req.session.sessionVersion = user.sessionVersion;
      req.session.expiresAt = Date.now() + ttl;
      if (user.role === 'demo') req.session.demoBucket = randomUUID();
      // "Remember me" keeps a persistent cookie; otherwise it is a browser-session cookie.
      if (remember) req.session.cookie.maxAge = ttl;
      else req.session.cookie.expires = undefined;
      req.session.save((e) => (e ? reject(e) : resolve()));
    }),
  );
}

export function endSession(req: Request, res: Response): Promise<void> {
  return new Promise((resolve) => {
    const clear = () => {
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      resolve();
    };
    if (!req.session) return clear();
    req.session.destroy(() => clear());
  });
}
