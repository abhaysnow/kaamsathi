import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const boolish = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_ORIGINS: z.string().default('http://localhost:3000'),
  MONGODB_URI: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(4000).default(900),
  SESSION_SECRET: z.string().optional().default(''),
  COOKIE_SECURE: boolish,
  ALLOW_DEMO_MODE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
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
  allowDemoMode: boolean;
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
  // in-memory storage that silently loses workers' records on every restart.
  if (isProduction && !parsed.COOKIE_SECURE) {
    throw new Error('COOKIE_SECURE=true (HTTPS) is required when NODE_ENV=production');
  }
  if (isProduction && !parsed.MONGODB_URI) {
    throw new Error('MONGODB_URI is required when NODE_ENV=production');
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
    allowDemoMode: parsed.ALLOW_DEMO_MODE,
    knowledgeDir: parsed.KNOWLEDGE_DIR,
    isProduction,
  };
}
