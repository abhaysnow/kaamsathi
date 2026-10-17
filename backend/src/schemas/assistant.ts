import { z } from 'zod';
import { languageSchema, nonEmptyText, workCategorySchema } from './common.js';

export const chatBodySchema = z
  .object({
    message: nonEmptyText(1000),
    language: languageSchema.default('en'),
    /** Short context only; recent turns are capped so a client cannot smuggle huge prompts. */
    history: z
      .array(z.object({ role: z.enum(['user', 'assistant']), content: nonEmptyText(1500) }))
      .max(6)
      .default([]),
    profile: z
      .object({ state: nonEmptyText(60).optional(), workCategory: workCategorySchema.optional() })
      .optional(),
  })
  .strict();

export const explainEarningsBodySchema = z
  .object({
    language: languageSchema.default('en'),
    period: z.enum(['day', 'week', 'month']).default('week'),
    anchor: z.string().optional(),
    question: nonEmptyText(300).optional(),
  })
  .strict();

export const schemeSearchBodySchema = z
  .object({
    language: languageSchema.default('en'),
    state: nonEmptyText(60).optional(),
    workCategory: workCategorySchema.optional(),
    ageRange: z.enum(['under_18', '18_40', '41_59', '60_plus']).optional(),
    hasEShramCard: z.boolean().optional(),
    hasBankAccount: z.boolean().optional(),
    query: nonEmptyText(300).optional(),
  })
  .strict();

export const documentChecklistBodySchema = z
  .object({
    language: languageSchema.default('en'),
    purpose: z.enum([
      'eshram_registration',
      'bocw_registration',
      'bank_account_for_schemes',
      'accident_claim',
      'payment_dispute',
      'other',
    ]),
    otherDescription: nonEmptyText(200).optional(),
  })
  .strict();

export const documentDraftBodySchema = z
  .object({
    language: languageSchema.default('en'),
    kind: z.enum([
      'application_letter',
      'payment_request',
      'work_experience_summary',
      'affidavit_outline',
      'explain_form',
    ]),
    workerName: nonEmptyText(80).optional(),
    details: nonEmptyText(1500),
  })
  .strict();
