import { z } from 'zod';
import { PASSWORD_RULES, passwordProblem } from '../auth/password.js';
import { RESET_TOKEN_RE } from '../auth/tokens.js';
import { nonEmptyText } from './common.js';

const email = z.string().trim().max(254).email('Enter a valid email address');
/** Login accepts any non-empty password (policy applies when a password is set, not checked). */
const anyPassword = z.string().min(1, 'Enter your password').max(PASSWORD_RULES.max);
const newPassword = z.string().superRefine((pw, ctx) => {
  const problem = passwordProblem(pw);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});

export const loginBodySchema = z
  .object({ email, password: anyPassword, remember: z.boolean().default(false) })
  .strict();
export const registerBodySchema = z
  .object({ name: nonEmptyText(80), email, password: newPassword })
  .strict();
export const forgotPasswordBodySchema = z.object({ email }).strict();
export const resetPasswordBodySchema = z
  .object({ token: z.string().regex(RESET_TOKEN_RE, 'Invalid reset link'), password: newPassword })
  .strict();
