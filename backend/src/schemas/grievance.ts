import { z } from 'zod';
import {
  dateSchema,
  grievanceTypeSchema,
  languageSchema,
  nonEmptyText,
  rupees,
  text,
} from './common.js';

export const grievanceFactsSchema = z
  .object({
    type: grievanceTypeSchema,
    platformOrEmployer: nonEmptyText(100),
    incidentDate: dateSchema.optional(),
    amountRupees: rupees.optional(),
    whatHappened: nonEmptyText(1500),
    stepsAlreadyTaken: text(800).optional(),
    evidenceAvailable: z.array(nonEmptyText(120)).max(15).default([]),
    desiredResolution: text(400).optional(),
  })
  .strict();

export const grievanceDraftBodySchema = z
  .object({
    language: languageSchema.default('en'),
    facts: grievanceFactsSchema,
    /** Without explicit consent the draft is returned but never stored. */
    saveWithConsent: z.boolean().default(false),
  })
  .strict();

export const grievanceUpdateSchema = z
  .object({
    status: z.enum(['draft', 'sent_by_worker', 'resolved']).optional(),
    finalMessage: nonEmptyText(5000).optional(),
    subject: nonEmptyText(200).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
