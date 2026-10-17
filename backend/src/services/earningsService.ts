import { z } from 'zod';
import { generateStructured } from '../ai/structured.js';
import { baseSystem, EXPLAIN_SHAPE } from '../ai/prompts.js';
import { untrustedBlock } from '../ai/sanitize.js';
import type { EarningsEntry, Language } from '../types/domain.js';
import {
  computeTotals,
  dailySeries,
  findAnomalies,
  periodBounds,
  type Period,
} from '../utils/earnings.js';
import { todayString } from '../utils/dates.js';
import type { AppContext } from './context.js';

export async function buildSummary(
  ctx: AppContext,
  ownerId: string,
  period: Period,
  anchor = todayString(),
) {
  const { from, to } = periodBounds(period, anchor);
  const entries = await ctx.repos.earnings.list(ownerId, { from, to });
  const series = period === 'day' ? [] : dailySeries(entries, from, to);
  return {
    period,
    from,
    to,
    totals: computeTotals(entries),
    series,
    anomalies: findAnomalies(entries),
    sources: [...new Set(entries.map((e) => e.source))],
    formulas: {
      gross: 'base pay + tips + bonuses + incentives',
      net: 'gross − work-related expenses − recorded deductions',
    },
    dataNotice: 'All figures come from entries typed by the worker. No platform data is imported.',
    entries,
  };
}

const explainSchema = z.object({
  explanation: z.string().min(1).max(1500),
  tips: z.array(z.string().max(300)).max(3).default([]),
  checkEntries: z.array(z.string().max(300)).max(3).default([]),
});

function biggestCost(entries: EarningsEntry[]) {
  const tot = computeTotals(entries);
  const costs = [
    { item: 'expenses', amount: tot.expenses },
    { item: 'deductions', amount: tot.deductions },
  ].sort((a, b) => b.amount - a.amount);
  return costs[0] && costs[0].amount > 0 ? costs[0] : undefined;
}

/**
 * The LLM only *narrates* numbers computed here. It receives aggregates (no notes, no ids) and is
 * told to copy them verbatim.
 */
export async function explainEarnings(
  ctx: AppContext,
  ownerId: string,
  p: { language: Language; period: Period; anchor?: string; question?: string },
) {
  const s = await buildSummary(ctx, ownerId, p.period, p.anchor);
  const flags = s.anomalies.map((a) => ({ date: a.date, detail: a.detail }));
  const worker_records = JSON.stringify({
    period: s.period,
    from: s.from,
    to: s.to,
    totals: s.totals,
    flags,
  });
  const user = `${untrustedBlock('worker_records', worker_records)}\n${untrustedBlock('untrusted_user_message', p.question ?? 'Explain my net earnings.')}\n${EXPLAIN_SHAPE}`;
  const { data, provider, model } = await generateStructured(
    ctx.provider,
    {
      feature: 'explain_earnings',
      language: p.language,
      system: baseSystem(p.language),
      user,
      maxTokens: ctx.config.aiMaxOutputTokens,
      mockContext: {
        period: s.period,
        totals: s.totals,
        flags,
        biggestCost: biggestCost(s.entries),
      },
    },
    explainSchema,
    ctx.config.aiTimeoutMs,
  );
  return {
    ...data,
    totals: s.totals,
    period: s.period,
    from: s.from,
    to: s.to,
    provider: { name: provider, model, isMock: provider === 'mock' },
  };
}
