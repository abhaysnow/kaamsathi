import { dummyHash, hashPassword, normalizeEmail, verifyPassword } from '../auth/password.js';
import { createResetToken, hashToken } from '../auth/tokens.js';
import type { PublicUser, UserRecord } from '../types/domain.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { AppContext } from './context.js';

export const DEMO_NAME = 'Demo Worker (fictional)';

export const toPublicUser = (u: UserRecord): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  isDemo: u.role === 'demo',
});

/**
 * Returns the user only when the password matches. Unknown emails still pay for one Argon2
 * verification so response timing does not reveal which emails are registered. The demo account
 * is refused when demo provisioning is disabled, even if a stale record is still in the database.
 */
export async function authenticate(
  ctx: AppContext,
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const user = await ctx.repos.users.findByEmail(normalizeEmail(email));
  if (!user) {
    await verifyPassword(await dummyHash(ctx.config.passwordHashProfile), password);
    return null;
  }
  if (!(await verifyPassword(user.passwordHash, password))) return null;
  if (user.role === 'demo' && !ctx.config.demo.enabled) return null;
  return user;
}

export async function register(
  ctx: AppContext,
  input: { name: string; email: string; password: string },
): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  // The public demo address can never be claimed as a real account.
  if (email === normalizeEmail(ctx.config.demo.email)) {
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  }
  const user = await ctx.repos.users.create({
    email,
    name: input.name,
    passwordHash: await hashPassword(input.password, ctx.config.passwordHashProfile),
    role: 'user',
  });
  if (!user) throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
  return user;
}

export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for this email, we have sent a link to reset the password. It expires soon and works once.';

/**
 * Always resolves the same way for known, unknown and demo emails. The email is sent in the
 * background (not awaited) so the response time does not depend on whether the account exists.
 */
export async function requestPasswordReset(ctx: AppContext, email: string): Promise<void> {
  if (!ctx.mailer) {
    // Production without a provider: say so honestly (for every email, so nothing leaks).
    throw new AppError(
      503,
      'EMAIL_NOT_CONFIGURED',
      'Password reset by email is not available on this server. Please contact support.',
    );
  }
  const user = await ctx.repos.users.findByEmail(normalizeEmail(email));
  if (!user || user.role === 'demo') return; // demo password is public and fixed

  const { token, tokenHash } = createResetToken();
  await ctx.repos.resetTokens.create(
    user.id,
    tokenHash,
    new Date(Date.now() + ctx.config.resetTokenTtlMs),
  );
  const link = `${ctx.config.appBaseUrl}/reset-password?token=${token}`;
  const minutes = Math.round(ctx.config.resetTokenTtlMs / 60_000);
  void ctx.mailer
    .send({
      to: user.email,
      subject: 'Reset your KaamSaathi password',
      text: `Someone asked to reset the password for this account.\n\nOpen this link within ${minutes} minutes to choose a new password (it works once):\n${link}\n\nIf this was not you, ignore this email; your password stays the same.`,
    })
    // Never log the message or link: it contains a live token.
    .catch(() => logger.error({ mailer: ctx.mailer?.kind }, 'password reset email failed'));
}

/** Single use: consume() marks the token used atomically before the password changes. */
export async function resetPassword(ctx: AppContext, token: string, newPassword: string) {
  const userId = await ctx.repos.resetTokens.consume(hashToken(token));
  const user = userId ? await ctx.repos.users.findById(userId) : null;
  if (!user || user.role === 'demo') {
    throw new AppError(
      400,
      'RESET_TOKEN_INVALID',
      'This reset link is invalid or has expired. Please request a new one.',
    );
  }
  // setPassword bumps sessionVersion: every existing session for this user is signed out.
  await ctx.repos.users.setPassword(
    user.id,
    await hashPassword(newPassword, ctx.config.passwordHashProfile),
  );
}

/**
 * Idempotent: running it again updates the same account (same email, unique index) instead of
 * creating another. Returns null when demo provisioning is disabled by configuration.
 */
export async function seedDemoUser(ctx: AppContext) {
  if (!ctx.config.demo.enabled) return null;
  return ctx.repos.users.upsertDemo({
    email: normalizeEmail(ctx.config.demo.email),
    name: DEMO_NAME,
    passwordHash: await hashPassword(ctx.config.demo.password, ctx.config.passwordHashProfile),
  });
}
