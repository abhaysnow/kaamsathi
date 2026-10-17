import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { MockAIProvider } from '../../src/ai/mockProvider.js';
import type { AIProvider } from '../../src/ai/types.js';
import { DevOutboxMailer, type Mailer } from '../../src/auth/mailer.js';
import { DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD, loadConfig } from '../../src/config/env.js';
import { loadKnowledge } from '../../src/knowledge/loader.js';
import { KnowledgeRetrievalService } from '../../src/knowledge/retrieval.js';
import { createMemoryRepositories } from '../../src/repositories/memory.js';
import type { Repositories } from '../../src/repositories/types.js';
import { seedDemoUser } from '../../src/services/authService.js';
import type { AppContext } from '../../src/services/context.js';

/** Fast hashing and generous limits so only the rate-limit tests ever hit a limit. */
export const TEST_ENV = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'x'.repeat(40),
  PASSWORD_HASH_PROFILE: 'fast',
  LOGIN_RATE_LIMIT: '1000',
  AUTH_RATE_LIMIT: '1000',
  REGISTER_RATE_LIMIT: '1000',
};

export function makeContext(
  opts: {
    provider?: AIProvider;
    env?: Record<string, string>;
    repos?: Repositories;
    mailer?: Mailer | null;
  } = {},
): AppContext {
  const config = loadConfig({ ...TEST_ENV, ...opts.env });
  return {
    config,
    provider: opts.provider ?? new MockAIProvider(),
    repos: opts.repos ?? createMemoryRepositories(),
    knowledge: new KnowledgeRetrievalService(loadKnowledge()),
    mailer: opts.mailer === undefined ? new DevOutboxMailer() : opts.mailer,
  };
}

export async function makeApp(opts: Parameters<typeof makeContext>[0] = {}) {
  const ctx = makeContext(opts);
  await seedDemoUser(ctx);
  return { app: createApp(ctx), ctx };
}

type App = Awaited<ReturnType<typeof makeApp>>['app'];

/** Each agent keeps its own cookie jar = its own browser. */
export const agent = (app: App) => request.agent(app);
export const H = { 'X-Requested-With': 'kaamsaathi' };
export const PASSWORD = 'Secret-pass-123';

/** A freshly registered (and therefore signed-in) real user. */
export async function userAgent(app: App, email = `w-${randomUUID()}@example.test`) {
  const a = agent(app);
  const r = await a
    .post('/api/v1/auth/register')
    .set(H)
    .send({ name: 'Test Worker', email, password: PASSWORD });
  if (r.status !== 201) throw new Error(`register failed: ${r.status} ${JSON.stringify(r.body)}`);
  return a;
}

/** Signed in as the public demo account. */
export async function demoAgent(app: App) {
  const a = agent(app);
  const r = await a
    .post('/api/v1/auth/login')
    .set(H)
    .send({ email: DEFAULT_DEMO_EMAIL, password: DEFAULT_DEMO_PASSWORD });
  if (r.status !== 200) throw new Error(`demo login failed: ${r.status}`);
  return a;
}

export const entry = (over: Record<string, unknown> = {}) => ({
  date: '2026-10-12',
  category: 'food_delivery',
  platform: 'TestPlat',
  hoursWorked: 8,
  basePay: 800,
  tips: 50,
  bonuses: 0,
  incentives: 100,
  expenses: 300,
  deductions: 50,
  ...over,
});
