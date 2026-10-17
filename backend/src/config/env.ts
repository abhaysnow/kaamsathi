import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const boolish = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
const optionalBool = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined));
const int = (min: number, max: number, def: number) =>
  z.coerce.number().int().min(min).max(max).default(def);

/** Public demonstration credentials (documented in the README). Never a real account. */
export const DEFAULT_DEMO_EMAIL = 'demo@workwise.ai';
export const DEFAULT_DEMO_PASSWORD = 'WorkerDemo@2026';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGINS: z.string().default('http://localhost:3000'),
  MONGODB_URI: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  AI_TIMEOUT_MS: int(1000, 60000, 20000),
  AI_MAX_OUTPUT_TOKENS: int(100, 4000, 900),
  SESSION_SECRET: z.string().optional().default(''),
  COOKIE_SECURE: boolish,
  SESSION_TTL_HOURS: int(1, 72, 12),
  REMEMBER_ME_DAYS: int(1, 60, 30),
  // Demo account: on by default for local dev/test, OFF by default in production.
  DEMO_ACCOUNT_ENABLED: optionalBool,
  DEMO_ACCOUNT_EMAIL: z.string().email().default(DEFAULT_DEMO_EMAIL),
  DEMO_ACCOUNT_PASSWORD: z.string().min(8).max(128).default(DEFAULT_DEMO_PASSWORD),
  // Password reset email
  APP_BASE_URL: z.string().url().optional(),
  EMAIL_PROVIDER: z.enum(['', 'resend']).default(''),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default(''),
  RESET_TOKEN_TTL_MINUTES: int(5, 120, 30),
  // Rate limits (requests per window, per IP; login is also per email)
  LOGIN_RATE_LIMIT: int(1, 10000, 10),
  AUTH_RATE_LIMIT: int(1, 10000, 5),
  REGISTER_RATE_LIMIT: int(1, 10000, 10),
  /** "fast" lowers Argon2 cost for the test suite only; refused in production. */
  PASSWORD_HASH_PROFILE: z.enum(['standard', 'fast']).default('standard'),
  KNOWLEDGE_DIR: z.string().optional().default(''),
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  frontendOrigins: string[];
  mongoUri: string;
  anthropicApiKey: string;
  anthropicModel: string;
  aiTimeoutMs: number;
  aiMaxOutputTokens: number;
  sessionSecret: string;
  cookieSecure: boolean;
  sessionTtlMs: number;
  rememberMeMs: number;
  demo: { enabled: boolean; email: string; password: string };
  email: { provider: '' | 'resend'; resendApiKey: string; from: string };
  appBaseUrl: string;
  resetTokenTtlMs: number;
  /** Dev-only mailbox that captures reset emails locally. Never enabled in production. */
  devOutboxEnabled: boolean;
  rateLimits: { login: number; auth: number; register: number };
  passwordHashProfile: 'standard' | 'fast';
  knowledgeDir: string;
  isProduction: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const isProduction = parsed.NODE_ENV === 'production';

  // A weak or missing secret in production would let anyone forge session cookies.
  if (isProduction && parsed.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET (>=32 chars) is required when NODE_ENV=production');
  }
  // Refuse a "production" deploy that is really the demo setup: cookies over plain HTTP, or
  // in-memory storage that silently loses workers' records (and sessions) on every restart.
  if (isProduction && !parsed.COOKIE_SECURE) {
    throw new Error('COOKIE_SECURE=true (HTTPS) is required when NODE_ENV=production');
  }
  if (isProduction && !parsed.MONGODB_URI) {
    throw new Error('MONGODB_URI is required when NODE_ENV=production');
  }
  if (isProduction && parsed.PASSWORD_HASH_PROFILE === 'fast') {
    throw new Error('PASSWORD_HASH_PROFILE=fast is only for tests');
  }
  if (parsed.EMAIL_PROVIDER === 'resend' && (!parsed.RESEND_API_KEY || !parsed.EMAIL_FROM)) {
    throw new Error('EMAIL_PROVIDER=resend needs RESEND_API_KEY and EMAIL_FROM');
  }
  const origins = parsed.FRONTEND_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (isProduction && origins.some((o) => o === '*')) {
    throw new Error('FRONTEND_ORIGINS must not be * in production');
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    frontendOrigins: origins,
    mongoUri: parsed.MONGODB_URI,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    anthropicModel: parsed.ANTHROPIC_MODEL,
    aiTimeoutMs: parsed.AI_TIMEOUT_MS,
    aiMaxOutputTokens: parsed.AI_MAX_OUTPUT_TOKENS,
    // Dev/test fallback: ephemeral secret, sessions reset on restart.
    sessionSecret: parsed.SESSION_SECRET || randomBytes(32).toString('hex'),
    cookieSecure: parsed.COOKIE_SECURE,
    sessionTtlMs: parsed.SESSION_TTL_HOURS * 3_600_000,
    rememberMeMs: parsed.REMEMBER_ME_DAYS * 86_400_000,
    demo: {
      enabled: parsed.DEMO_ACCOUNT_ENABLED ?? !isProduction,
      email: parsed.DEMO_ACCOUNT_EMAIL,
      password: parsed.DEMO_ACCOUNT_PASSWORD,
    },
    email: {
      provider: parsed.EMAIL_PROVIDER,
      resendApiKey: parsed.RESEND_API_KEY,
      from: parsed.EMAIL_FROM,
    },
    appBaseUrl: (parsed.APP_BASE_URL ?? origins[0] ?? 'http://localhost:3000').replace(/\/$/, ''),
    resetTokenTtlMs: parsed.RESET_TOKEN_TTL_MINUTES * 60_000,
    devOutboxEnabled: !isProduction && parsed.EMAIL_PROVIDER === '',
    rateLimits: {
      login: parsed.LOGIN_RATE_LIMIT,
      auth: parsed.AUTH_RATE_LIMIT,
      register: parsed.REGISTER_RATE_LIMIT,
    },
    passwordHashProfile: parsed.PASSWORD_HASH_PROFILE,
    knowledgeDir: parsed.KNOWLEDGE_DIR,
    isProduction,
  };
}
