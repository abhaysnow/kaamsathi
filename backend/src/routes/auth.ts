import { Router, type Request, type Response } from 'express';
import type { z } from 'zod';
import { DevOutboxMailer } from '../auth/mailer.js';
import { ensureDemoSeed } from '../services/demoData.js';
import { authLimiter, loginLimiters, registerLimiter } from '../middleware/rateLimit.js';
import { endSession, requireAuth, startSession } from '../middleware/session.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from '../schemas/auth.js';
import {
  FORGOT_PASSWORD_MESSAGE,
  authenticate,
  register,
  requestPasswordReset,
  resetPassword,
  toPublicUser,
} from '../services/authService.js';
import type { AppContext } from '../services/context.js';
import { AppError } from '../utils/errors.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: (e?: unknown) => void) => {
    fn(req, res).catch(next);
  };

/** One message for unknown email, wrong password and disabled demo account. */
const INVALID_CREDENTIALS = new AppError(
  401,
  'INVALID_CREDENTIALS',
  'Incorrect email or password.',
);

export function buildAuthRouter(ctx: AppContext): Router {
  const r = Router();
  const { rateLimits } = ctx.config;

  r.post(
    '/auth/login',
    ...loginLimiters(rateLimits.login),
    validate(loginBodySchema),
    wrap(async (req, res) => {
      const body = req.body as z.infer<typeof loginBodySchema>;
      const user = await authenticate(ctx, body.email, body.password);
      if (!user) throw INVALID_CREDENTIALS;
      await startSession(req, user, ctx.config, body.remember);
      // Fill the new demo sandbox now, inside this one request, so parallel page loads cannot
      // both find it empty and seed it twice.
      if (user.role === 'demo') await ensureDemoSeed(ctx, `demo:${req.session.demoBucket}`);
      res.json({ user: toPublicUser(user) });
    }),
  );

  r.post(
    '/auth/register',
    registerLimiter(rateLimits.register),
    validate(registerBodySchema),
    wrap(async (req, res) => {
      const user = await register(ctx, req.body as z.infer<typeof registerBodySchema>);
      await startSession(req, user, ctx.config, false);
      res.status(201).json({ user: toPublicUser(user) });
    }),
  );

  r.post(
    '/auth/logout',
    wrap(async (req, res) => {
      await endSession(req, res);
      res.status(204).end();
    }),
  );

  // Public demonstration credentials, so the login page can prefill them. They are published in
  // the README by design; when the demo account is disabled nothing is revealed.
  r.get('/auth/demo', (_req, res) => {
    const { enabled, email, password } = ctx.config.demo;
    res.json(enabled ? { enabled, email, password } : { enabled: false });
  });

  r.get('/auth/me', requireAuth, (req, res) => {
    res.json({ user: toPublicUser(req.user!) });
  });

  r.post(
    '/auth/forgot-password',
    authLimiter(rateLimits.auth),
    validate(forgotPasswordBodySchema),
    wrap(async (req, res) => {
      await requestPasswordReset(ctx, (req.body as { email: string }).email);
      res.json({
        message: FORGOT_PASSWORD_MESSAGE,
        // Tells the UI where a developer can find the email locally. Never set in production.
        devOutbox: ctx.mailer instanceof DevOutboxMailer ? '/api/v1/dev/outbox' : undefined,
      });
    }),
  );

  r.post(
    '/auth/reset-password',
    authLimiter(rateLimits.auth),
    validate(resetPasswordBodySchema),
    wrap(async (req, res) => {
      const body = req.body as z.infer<typeof resetPasswordBodySchema>;
      await resetPassword(ctx, body.token, body.password);
      // If the caller was signed in, that session is now stale too; clear it.
      await endSession(req, res);
      res.json({
        message: 'Your password has been changed. Please sign in with the new password.',
      });
    }),
  );

  // Local testing of password reset without a real email provider. The route does not exist
  // at all unless the dev outbox is active (never in production).
  if (ctx.mailer instanceof DevOutboxMailer) {
    const outbox = ctx.mailer;
    r.get('/dev/outbox', (_req, res) => {
      res.json({
        notice: 'DEVELOPMENT ONLY — local copy of emails that would have been sent.',
        messages: outbox.list(),
      });
    });
  }

  return r;
}
