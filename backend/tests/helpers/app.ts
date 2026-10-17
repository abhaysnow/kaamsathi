import request from 'supertest';
import { createApp } from '../../src/app.js';
import { MockAIProvider } from '../../src/ai/mockProvider.js';
import type { AIProvider } from '../../src/ai/types.js';
import { loadConfig } from '../../src/config/env.js';
import { loadKnowledge } from '../../src/knowledge/loader.js';
import { KnowledgeRetrievalService } from '../../src/knowledge/retrieval.js';
import { createMemoryRepositories } from '../../src/repositories/memory.js';

export function makeApp(opts: { provider?: AIProvider; env?: Record<string, string> } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40), ...opts.env });
  const ctx = {
    config,
    provider: opts.provider ?? new MockAIProvider(),
    repos: createMemoryRepositories(),
    knowledge: new KnowledgeRetrievalService(loadKnowledge()),
  };
  return { app: createApp(ctx), ctx };
}

/** Each agent keeps its own cookie jar = its own anonymous worker. */
export const agent = (app: ReturnType<typeof makeApp>['app']) => request.agent(app);
export const H = { 'X-Requested-With': 'kaamsaathi' };

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
