import { z } from 'zod';
import { generateStructured } from '../ai/structured.js';
import { baseSystem, GRIEVANCE_SHAPE } from '../ai/prompts.js';
import { untrustedBlock } from '../ai/sanitize.js';
import type { GrievanceDraftContent, GrievanceFacts, Language } from '../types/domain.js';
import { AppError } from '../utils/errors.js';
import type { AppContext } from './context.js';

const out = z.object({
  subject: z.string().min(1).max(200),
  finalMessage: z.string().min(1).max(5000),
  evidenceChecklist: z.array(z.string().max(200)).max(10).default([]),
});

export const GRIEVANCE_DISCLAIMER =
  'This is a DRAFT. Nothing has been sent. Please read, edit and send it yourself. It is not legal advice.';

const TOPIC_BY_TYPE: Record<GrievanceFacts['type'], string[]> = {
  payment_delay: ['payment'],
  incorrect_deduction: ['payment'],
  unpaid_incentive: ['payment'],
  account_suspension: ['suspension'],
  harassment: ['harassment'],
  accident: ['accident'],
  other: ['working_conditions', 'payment'],
};

const DEFAULT_EVIDENCE: Record<GrievanceFacts['type'], string[]> = {
  payment_delay: [
    'Screenshots of earnings/payout screens',
    'Order or trip IDs and dates',
    'Ticket numbers and replies',
  ],
  incorrect_deduction: [
    'Screenshot showing the deduction',
    'Earlier statements without the deduction',
    'Ticket numbers and replies',
  ],
  unpaid_incentive: [
    'Screenshot of the incentive offer and its conditions',
    'Proof you met the conditions',
    'Ticket numbers and replies',
  ],
  account_suspension: [
    'Screenshot of the suspension notice',
    'Any warning messages',
    'Pending payment details',
  ],
  harassment: [
    'Dated notes of each incident',
    'Messages or call records, if safe to keep',
    'Names of witnesses, if any',
  ],
  accident: ['Medical bills and papers', 'Police report copy or number, if any', 'Photos, if safe'],
  other: ['Messages or screenshots about the issue', 'Dates and names involved'],
};

/** Every multi-digit number in `text`, normalised (commas removed). */
const numbersIn = (text: string) =>
  (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((n) => n.replace(/,/g, ''))
    .filter((n) => n.length >= 2);

/**
 * Fact-preservation check. The draft must (a) contain the worker's amount and date when given and
 * (b) contain no multi-digit number (amounts, dates, phone numbers) that the worker did not supply.
 * Failing drafts are rejected and replaced by a plain template — facts are never "improved".
 */
export function preservesFacts(message: string, facts: GrievanceFacts): boolean {
  const allowedText = [
    facts.whatHappened,
    facts.stepsAlreadyTaken,
    facts.desiredResolution,
    facts.platformOrEmployer,
    facts.incidentDate,
    facts.amountRupees,
    ...facts.evidenceAvailable,
  ]
    .filter((v) => v !== undefined)
    .join(' ');
  const allowed = new Set(numbersIn(allowedText));
  if (facts.incidentDate) for (const part of facts.incidentDate.split('-')) allowed.add(part);
  if (facts.amountRupees !== undefined && !message.includes(String(facts.amountRupees)))
    return false;
  if (facts.incidentDate && !message.includes(facts.incidentDate)) return false;
  return numbersIn(message).every((n) => allowed.has(n));
}

/** Deterministic, English-only template used when the model's draft fails verification. */
export function templateMessage(f: GrievanceFacts): { subject: string; finalMessage: string } {
  const lines = ['Respected Sir/Madam,', '', `I work with ${f.platformOrEmployer}.`];
  if (f.incidentDate) lines.push(`The issue relates to ${f.incidentDate}.`);
  if (f.amountRupees !== undefined) lines.push(`The amount involved is ₹${f.amountRupees}.`);
  lines.push('', 'What happened, in my words:', f.whatHappened);
  if (f.stepsAlreadyTaken) lines.push('', 'What I have already tried:', f.stepsAlreadyTaken);
  if (f.evidenceAvailable.length) lines.push('', `I can share: ${f.evidenceAvailable.join(', ')}.`);
  lines.push(
    '',
    'My request:',
    f.desiredResolution ?? 'Please look into this and let me know the outcome.',
    '',
    'Thank you for your time.',
    '',
    'Regards,',
    '[PLACEHOLDER: your name]',
  );
  return {
    subject: `Request regarding ${f.type.replace(/_/g, ' ')}`,
    finalMessage: lines.join('\n'),
  };
}

function buildTimeline(f: GrievanceFacts): string[] {
  const tl: string[] = [];
  if (f.incidentDate)
    tl.push(
      `${f.incidentDate}: ${f.whatHappened.slice(0, 160)}${f.whatHappened.length > 160 ? '…' : ''}`,
    );
  else
    tl.push(
      `Date not provided: ${f.whatHappened.slice(0, 160)}${f.whatHappened.length > 160 ? '…' : ''}`,
    );
  if (f.stepsAlreadyTaken) tl.push(`Later: ${f.stepsAlreadyTaken}`);
  return tl;
}

export async function draftGrievance(
  ctx: AppContext,
  p: { language: Language; facts: GrievanceFacts },
) {
  const { facts, language } = p;
  const system = `${baseSystem(language)}\nFor this task: draft a polite, factual complaint letter. Use the worker's own wording for events. Do not add dates, amounts, names, conversations or accusations that are not in <worker_facts>.`;
  const user = `${untrustedBlock('worker_facts', JSON.stringify(facts))}\n${GRIEVANCE_SHAPE}`;
  const req = {
    feature: 'grievance' as const,
    language,
    system,
    user,
    maxTokens: ctx.config.aiMaxOutputTokens + 400,
    mockContext: { facts },
  };

  let generated: z.infer<typeof out> | undefined;
  let provider: 'gemini' | 'mock' = ctx.provider.name;
  let model = ctx.provider.model;
  let attempts = 0;
  while (attempts < 2 && !generated) {
    attempts++;
    const r = await generateStructured(ctx.provider, req, out, ctx.config.aiTimeoutMs);
    provider = r.provider;
    model = r.model;
    if (preservesFacts(r.data.finalMessage, facts)) generated = r.data;
  }
  const usedFallback = !generated;
  const finalParts = generated ?? { ...templateMessage(facts), evidenceChecklist: [] as string[] };

  const channels = ctx.knowledge
    .all()
    .filter((r) => r.kind === 'rights' && TOPIC_BY_TYPE[facts.type].includes(r.topic))
    .flatMap((r) => (r.kind === 'rights' ? r.channels : []))
    .filter((c): c is { name: string; url: string; note: string } => Boolean(c.url));

  const draft: GrievanceDraftContent = {
    subject: finalParts.subject,
    workerFacts: facts,
    timeline: buildTimeline(facts),
    evidenceChecklist: finalParts.evidenceChecklist.length
      ? finalParts.evidenceChecklist
      : DEFAULT_EVIDENCE[facts.type],
    requestedResolution:
      facts.desiredResolution ??
      'Please review the issue and respond. (Suggested by KaamSaathi — you did not specify one.)',
    suggestedChannels: channels,
    finalMessage: finalParts.finalMessage,
    aiGenerated: {
      subject: !usedFallback,
      finalMessage: !usedFallback,
      evidenceChecklist: !usedFallback && finalParts.evidenceChecklist.length > 0,
    },
    disclaimer: GRIEVANCE_DISCLAIMER,
  };
  if (draft.finalMessage.length === 0)
    throw new AppError(502, 'AI_BAD_OUTPUT', 'Could not create a draft.');
  return {
    draft,
    provider: { name: provider, model, isMock: provider === 'mock' },
    usedTemplateFallback: usedFallback,
  };
}
