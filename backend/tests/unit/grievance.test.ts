import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../../src/ai/mockProvider.js';
import { loadKnowledge } from '../../src/knowledge/loader.js';
import { KnowledgeRetrievalService } from '../../src/knowledge/retrieval.js';
import { loadConfig } from '../../src/config/env.js';
import { createMemoryRepositories } from '../../src/repositories/memory.js';
import { draftGrievance, preservesFacts } from '../../src/services/grievanceDraft.js';
import type { GrievanceFacts } from '../../src/types/domain.js';
import type { AIProvider } from '../../src/ai/types.js';

const facts: GrievanceFacts = {
  type: 'unpaid_incentive',
  platformOrEmployer: 'Demo Foods',
  incidentDate: '2026-10-10',
  amountRupees: 250,
  whatHappened: 'Incentive of ₹250 for 50 orders was not added.',
  evidenceAvailable: ['Screenshot'],
};
const mk = (provider: AIProvider) => ({
  config: loadConfig({ NODE_ENV: 'test' }),
  provider,
  repos: createMemoryRepositories(),
  knowledge: new KnowledgeRetrievalService(loadKnowledge()),
});

describe('grievance fact preservation', () => {
  it('mock draft keeps the worker facts verbatim in every language', async () => {
    for (const language of ['en', 'hi', 'pa', 'ta'] as const) {
      const r = await draftGrievance(mk(new MockAIProvider()), { language, facts });
      expect(r.draft.finalMessage).toContain('250');
      expect(r.draft.finalMessage).toContain('2026-10-10');
      expect(r.draft.finalMessage).toContain(facts.whatHappened);
      expect(r.usedTemplateFallback).toBe(false);
      expect(r.draft.workerFacts).toEqual(facts);
    }
  });
  it('rejects drafts that invent numbers or drop the amount', () => {
    expect(preservesFacts('I am owed ₹250 from 2026-10-10 and ₹9000 more', facts)).toBe(false);
    expect(preservesFacts('Pay me from 2026-10-10', facts)).toBe(false);
    expect(preservesFacts('Amount 250 on 2026-10-10 for 50 orders', facts)).toBe(true);
  });
  it('falls back to a plain template when the model keeps inventing facts', async () => {
    const liar: AIProvider = {
      name: 'anthropic',
      model: 'liar',
      async generate() {
        return {
          text: JSON.stringify({
            subject: 'S',
            finalMessage: 'They owe ₹250 on 2026-10-10, and also ₹7777 and called me on 9876543210',
            evidenceChecklist: [],
          }),
          provider: 'anthropic',
          model: 'liar',
        };
      },
    };
    const r = await draftGrievance(mk(liar), { language: 'en', facts });
    expect(r.usedTemplateFallback).toBe(true);
    expect(r.draft.finalMessage).not.toContain('7777');
    expect(r.draft.aiGenerated.finalMessage).toBe(false);
  });
  it('only suggests channels from verified records and flags suggested resolution', async () => {
    const r = await draftGrievance(mk(new MockAIProvider()), {
      language: 'en',
      facts: { ...facts, desiredResolution: undefined },
    });
    expect(r.draft.suggestedChannels.every((c) => c.url.startsWith('https://'))).toBe(true);
    expect(r.draft.requestedResolution).toContain('Suggested by KaamSaathi');
  });
});
