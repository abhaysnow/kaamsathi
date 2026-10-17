import { z } from 'zod';
import { generateStructured } from '../ai/structured.js';
import { baseSystem, CHECKLIST_SHAPE, DRAFT_SHAPE } from '../ai/prompts.js';
import { untrustedBlock } from '../ai/sanitize.js';
import type { Language } from '../types/domain.js';
import type { AppContext } from './context.js';

/**
 * Checklists are curated, not model-written. Items marked "usually" depend on the office; the UI
 * tells workers to confirm with the issuing office. We never ask for ID numbers in this app.
 */
const CHECKLISTS: Record<string, { title: string; items: string[]; officialUrl?: string }> = {
  eshram_registration: {
    title: 'e-Shram registration',
    items: [
      'Mobile number linked to your Aadhaar (you enter it only on the official site)',
      'Bank account and IFSC details (enter only on the official site)',
      'Details of your work type',
      'Nominee details, if the form asks',
    ],
    officialUrl: 'https://eshram.gov.in',
  },
  bocw_registration: {
    title: 'Construction worker welfare board registration',
    items: [
      'Proof of age and identity as listed by your state board',
      'Proof you worked in construction (e.g. contractor or employer certificate)',
      'Bank account details',
      'Passport-size photographs, if the office asks',
    ],
    officialUrl: 'https://pblabour.gov.in',
  },
  bank_account_for_schemes: {
    title: 'Bank account for scheme benefits',
    items: [
      'Proof of identity and address accepted by your bank',
      'Mobile number for alerts',
      'Photographs, if the bank asks',
    ],
  },
  accident_claim: {
    title: 'After a work accident (records to keep)',
    items: [
      'Hospital bills, prescriptions and discharge papers',
      'Police report copy or number, if one was made',
      'Written message to the platform/employer with date and place',
      'Photos of the place or injuries, if safe',
      'Insurance policy details, if you have any',
    ],
  },
  payment_dispute: {
    title: 'Payment dispute (evidence to gather)',
    items: [
      'Screenshots of earnings and payout screens',
      'Order or trip IDs and dates',
      'Chat or ticket messages and ticket numbers',
      'Bank statement lines showing what was received',
    ],
  },
  other: {
    title: 'General documents',
    items: [
      'Photo ID of your choice',
      'Proof of address',
      'Passport-size photographs',
      'Any previous letters about this matter',
    ],
  },
};

const checklistOut = z.object({
  explanation: z.string().max(900),
  tips: z.array(z.string().max(300)).max(4).default([]),
});
const draftOut = z.object({ title: z.string().max(200), body: z.string().min(1).max(6000) });

export const DRAFT_DISCLAIMER =
  'DRAFT for your review. It is not an official or legal document and is not signed or certified. Check every detail before using it.';

export async function documentChecklist(
  ctx: AppContext,
  p: { language: Language; purpose: string; otherDescription?: string },
) {
  const list = CHECKLISTS[p.purpose] ?? CHECKLISTS.other!;
  const { data, provider, model } = await generateStructured(
    ctx.provider,
    {
      feature: 'document_checklist',
      language: p.language,
      system: baseSystem(p.language),
      user: `${untrustedBlock('retrieved_sources', JSON.stringify(list))}\n${untrustedBlock('untrusted_user_message', p.otherDescription ?? p.purpose)}\n${CHECKLIST_SHAPE}`,
      maxTokens: ctx.config.aiMaxOutputTokens,
      mockContext: {},
    },
    checklistOut,
    ctx.config.aiTimeoutMs,
  );
  return {
    title: list.title,
    items: list.items,
    officialUrl: list.officialUrl,
    explanation: data.explanation,
    tips: data.tips,
    note: 'Ask the issuing office to confirm what they need. Requirements differ by office and can change.',
    provider: { name: provider, model, isMock: provider === 'mock' },
  };
}

export async function documentDraft(
  ctx: AppContext,
  p: { language: Language; kind: string; workerName?: string; details: string },
) {
  const { data, provider, model } = await generateStructured(
    ctx.provider,
    {
      feature: 'document_draft',
      language: p.language,
      system: `${baseSystem(p.language)}\nFor this task: write a plain draft ${p.kind.replace(/_/g, ' ')}. Do not invent facts, names, dates or amounts; use [PLACEHOLDER] instead. Never fake signatures, stamps or official approvals. For an affidavit, produce only an outline for the worker to take to a notary/advocate.`,
      user: `${untrustedBlock('worker_facts', JSON.stringify({ name: p.workerName, details: p.details }))}\n${DRAFT_SHAPE}`,
      maxTokens: ctx.config.aiMaxOutputTokens + 400,
      mockContext: { kind: p.kind, workerName: p.workerName, details: p.details },
    },
    draftOut,
    ctx.config.aiTimeoutMs,
  );
  return {
    ...data,
    disclaimer: DRAFT_DISCLAIMER,
    provider: { name: provider, model, isMock: provider === 'mock' },
  };
}
