import { z } from 'zod';

export const sourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().startsWith('https://'),
  /** Result of the automated reachability check run by `npm run knowledge:check`. */
  linkStatus: z.enum(['reachable', 'unreachable_from_checker', 'unchecked']),
  linkCheckedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const scopeSchema = z.enum([
  'central_law',
  'state_provision',
  'platform_policy',
  'best_practice',
  'emergency',
]);

const common = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(3),
  /** Plain-language summary written for workers. English master text; the AI localises it. */
  summary: z.string().min(10),
  keywords: z.array(z.string().min(2)).min(3),
  steps: z.array(z.string().min(3)).default([]),
  sources: z.array(sourceSchema).min(1),
  /**
   * Honest provenance: link reachability is automated; the *content* of each summary must be
   * confirmed by a human against the official page. We never mark that as done on our own.
   */
  contentReview: z.enum(['pending_human_review', 'human_reviewed']),
  limitations: z.array(z.string()).default([]),
};

export const rightsRecordSchema = z.object({
  ...common,
  kind: z.literal('rights'),
  scope: scopeSchema,
  topic: z.enum([
    'payment',
    'accident',
    'safety',
    'harassment',
    'suspension',
    'working_conditions',
    'legal_aid',
    'emergency',
    'fraud',
  ]),
  channels: z
    .array(z.object({ name: z.string(), url: z.string().url().optional(), note: z.string() }))
    .default([]),
});

export const schemeRecordSchema = z.object({
  ...common,
  kind: z.literal('scheme'),
  scope: scopeSchema,
  benefit: z.string().min(5),
  eligibility: z.array(z.string()).min(1),
  documents: z.array(z.string()).min(1),
  applicationSteps: z.array(z.string()).min(1),
  applyUrl: z.string().url().startsWith('https://'),
  /** 'ALL' or a list of state names exactly as the worker profile uses them. */
  states: z.union([z.literal('ALL'), z.array(z.string()).min(1)]),
  workerCategories: z.union([z.literal('ALL'), z.array(z.string()).min(1)]),
  /** Hard bounds only where the official criteria state an age band. */
  age: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
  requiresBankAccount: z.boolean().default(false),
  availabilityNote: z.string(),
});

export const knowledgeRecordSchema = z.discriminatedUnion('kind', [
  rightsRecordSchema,
  schemeRecordSchema,
]);
export const knowledgeFileSchema = z.array(knowledgeRecordSchema);

export type KnowledgeSource = z.infer<typeof sourceSchema>;
export type RightsRecord = z.infer<typeof rightsRecordSchema>;
export type SchemeRecord = z.infer<typeof schemeRecordSchema>;
export type KnowledgeRecord = z.infer<typeof knowledgeRecordSchema>;
