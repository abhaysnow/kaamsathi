import { z } from 'zod';

/**
 * Client-side checks mirror the server's rules for fast feedback only; the server validates
 * everything again. Messages are translation keys, resolved by the form.
 */
const email = z.string().trim().min(1, 'v_email').max(254, 'v_email').email('v_email');
const newPassword = z
  .string()
  .min(8, 'v_passwordRules')
  .max(128, 'v_passwordRules')
  .regex(/[A-Za-z]/, 'v_passwordRules')
  .regex(/\d/, 'v_passwordRules');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'v_password').max(128, 'v_password'),
  remember: z.boolean(),
});
export const registerSchema = z.object({
  name: z.string().trim().min(1, 'v_name').max(80, 'v_name'),
  email,
  password: newPassword,
});
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password: newPassword });

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;

/** Prefilled on the login page. These are public demonstration credentials (see README). */
export const DEMO_CREDENTIALS = { email: 'demo@workwise.ai', password: 'WorkerDemo@2026' };

/** API error code → translation key for auth screens. */
export function authErrorKey(code: string | undefined): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'errorLogin';
    case 'EMAIL_IN_USE':
      return 'errorEmailInUse';
    case 'RESET_TOKEN_INVALID':
      return 'errorResetToken';
    case 'EMAIL_NOT_CONFIGURED':
      return 'errorEmailNotConfigured';
    case 'RATE_LIMITED':
      return 'errorRate';
    case 'VALIDATION_ERROR':
      return 'errorInput';
    case 'NETWORK':
      return 'errorOffline';
    default:
      return 'errorAi';
  }
}
