import { z } from 'zod';
import { generateStructured } from '../ai/structured.js';
import { baseSystem, CHAT_SHAPE } from '../ai/prompts.js';
import { stripUnapprovedUrls, untrustedBlock } from '../ai/sanitize.js';
import type { Language } from '../types/domain.js';
import { computeTotals, periodBounds } from '../utils/earnings.js';
import { todayString } from '../utils/dates.js';
import { allowedUrls, toCitation } from './citations.js';
import type { AppContext } from './context.js';
import { detectEmergency, emergencyText } from './emergency.js';

const chatOutput = z.object({
  answer: z.string().min(1).max(2500),
  followUpQuestions: z.array(z.string().max(200)).max(3).default([]),
  usedSourceIds: z.array(z.string()).max(5).default([]),
  couldNotVerify: z.boolean().default(false),
});

const EARNINGS_INTENT =
  /(kamaya|kitna kama|earn|income|कमाया|कितना कमा|ਕਮਾਇਆ|ਕਿੰਨਾ ਕਮਾ|कमाई|ਕਮਾਈ)/i;

export interface ChatInput {
  message: string;
  language: Language;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  profile?: { state?: string; workCategory?: string };
}

export const DISCLAIMER =
  'KaamSaathi gives general information, not legal advice. Please confirm important details with the official sources shown.';

export async function chat(ctx: AppContext, ownerId: string, input: ChatInput) {
  const emergency = detectEmergency(input.message);
  const hits = ctx.knowledge.search(input.message, { limit: 3 });
  const sources = hits.map((h) => h.record);

  // Earnings questions are answered from the worker's own records (deterministic numbers).
  let earnings;
  if (EARNINGS_INTENT.test(input.message)) {
    const period = /\b(month|mahine|महीने|ਮਹੀਨੇ)\b/i.test(input.message)
      ? 'month'
      : /\b(week|hafte|सप्ताह|ਹਫ਼ਤੇ)\b/i.test(input.message)
        ? 'week'
        : 'day';
    const { from, to } = periodBounds(period, todayString());
    const entries = await ctx.repos.earnings.list(ownerId, { from, to });
    const t = computeTotals(entries);
    earnings = {
      period,
      entries: t.entries,
      gross: t.gross,
      expenses: t.expenses,
      deductions: t.deductions,
      net: t.net,
      hours: t.hoursWorked,
    } as const;
  }

  const sourcesBlock = JSON.stringify(
    sources.map((r) => ({
      id: r.id,
      title: r.title,
      scope: r.scope,
      summary: r.summary,
      steps: r.steps,
      limitations: r.limitations,
    })),
  );
  const history = input.history.map((h) => `${h.role}: ${h.content}`).join('\n');
  const user = [
    untrustedBlock(
      'retrieved_sources',
      sources.length ? sourcesBlock : '[]  (no verified source matched)',
    ),
    earnings ? untrustedBlock('worker_records', JSON.stringify(earnings)) : '',
    history ? untrustedBlock('untrusted_user_message', `Earlier turns:\n${history}`) : '',
    untrustedBlock('untrusted_user_message', input.message),
    CHAT_SHAPE,
  ]
    .filter(Boolean)
    .join('\n');

  const { data, provider, model } = await generateStructured(
    ctx.provider,
    {
      feature: 'chat',
      language: input.language,
      system: baseSystem(input.language),
      user,
      maxTokens: ctx.config.aiMaxOutputTokens,
      mockContext: {
        sources: sources.map((r) => ({
          id: r.id,
          title: r.title,
          summary: r.summary,
          steps: r.steps,
        })),
        earnings,
      },
    },
    chatOutput,
    ctx.config.aiTimeoutMs,
  );

  const retrievedIds = new Set(sources.map((r) => r.id));
  const used = data.usedSourceIds.filter((id) => retrievedIds.has(id));
  const cited = used.length ? sources.filter((r) => used.includes(r.id)) : sources;
  // No evidence and no worker records => always flag, regardless of what the model claimed.
  const couldNotVerify = (sources.length === 0 && !earnings) || data.couldNotVerify;

  return {
    answer: stripUnapprovedUrls(data.answer, allowedUrls(ctx.knowledge.all())),
    followUpQuestions: data.followUpQuestions,
    citations: cited.map(toCitation),
    couldNotVerify,
    emergency: emergency
      ? { show: true, text: emergencyText(input.language), number: '112' }
      : { show: false },
    usedWorkerRecords: Boolean(earnings),
    provider: { name: provider, model, isMock: provider === 'mock' },
    disclaimer: DISCLAIMER,
  };
}
