import { z } from 'zod';
import { generateStructured } from '../ai/structured.js';
import { baseSystem, SCHEME_SHAPE } from '../ai/prompts.js';
import { untrustedBlock } from '../ai/sanitize.js';
import { filterSchemes, type AgeRange } from '../knowledge/retrieval.js';
import type { Language } from '../types/domain.js';
import { toCitation } from './citations.js';
import type { AppContext } from './context.js';

const guidanceSchema = z.object({
  intro: z.string().max(600),
  items: z
    .array(
      z.object({
        schemeId: z.string(),
        whyRelevant: z.string().max(400),
        nextStep: z.string().max(300),
      }),
    )
    .max(10),
  uncertainty: z.string().max(400),
});

export interface SchemeSearchInput {
  language: Language;
  state?: string;
  workCategory?: string;
  ageRange?: AgeRange;
  hasEShramCard?: boolean;
  hasBankAccount?: boolean;
  query?: string;
}

/**
 * 1) deterministic filter picks candidates and writes the official facts (benefit, eligibility,
 * documents, steps, URL, source); 2) the model only adds a short plain-language "why/next" per
 * candidate, and may reference only candidate ids. Eligibility is never decided by the model.
 */
export async function searchSchemes(ctx: AppContext, input: SchemeSearchInput) {
  let matches = filterSchemes(ctx.knowledge.all(), input);
  if (input.query) {
    const ids = new Set(
      ctx.knowledge
        .search(input.query, { kinds: ['scheme'], limit: 5, minScore: 3 })
        .map((h) => h.record.id),
    );
    if (ids.size) matches = matches.filter((m) => ids.has(m.scheme.id));
  }

  const candidateIds = new Set(matches.map((m) => m.scheme.id));
  const block = JSON.stringify(
    matches.map((m) => ({
      id: m.scheme.id,
      title: m.scheme.title,
      summary: m.scheme.summary,
      reasons: m.reasons,
      cautions: m.cautions,
    })),
  );
  const { data, provider, model } = await generateStructured(
    ctx.provider,
    {
      feature: 'scheme_guidance',
      language: input.language,
      system: baseSystem(input.language),
      user: `${untrustedBlock('retrieved_sources', block)}\n${SCHEME_SHAPE}`,
      maxTokens: ctx.config.aiMaxOutputTokens,
      mockContext: { items: matches.map((m) => ({ schemeId: m.scheme.id, reasons: m.reasons })) },
    },
    guidanceSchema,
    ctx.config.aiTimeoutMs,
  );
  const guidance = new Map(
    data.items.filter((i) => candidateIds.has(i.schemeId)).map((i) => [i.schemeId, i]),
  );

  return {
    intro: data.intro,
    uncertainty: data.uncertainty,
    results: matches.map((m) => {
      const g = guidance.get(m.scheme.id);
      return {
        id: m.scheme.id,
        name: m.scheme.title,
        label: m.label,
        benefit: m.scheme.benefit,
        eligibility: m.scheme.eligibility,
        documents: m.scheme.documents,
        applicationSteps: m.scheme.applicationSteps,
        applyUrl: m.scheme.applyUrl,
        availabilityNote: m.scheme.availabilityNote,
        reasons: m.reasons,
        cautions: m.cautions,
        whyRelevant: g?.whyRelevant,
        nextStep: g?.nextStep,
        citation: toCitation(m.scheme),
        dataNotice:
          'Seeded, source-linked information. Content review pending; confirm on the official site.',
      };
    }),
    provider: { name: provider, model, isMock: provider === 'mock' },
  };
}
