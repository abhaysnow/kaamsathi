import { z } from 'zod';
import { dateSchema, rupees, text, workCategorySchema } from './common.js';

const base = {
  date: dateSchema,
  category: workCategorySchema,
  platform: text(60).optional(),
  hoursWorked: z.number().finite().min(0).max(24),
  basePay: rupees.default(0),
  tips: rupees.default(0),
  bonuses: rupees.default(0),
  incentives: rupees.default(0),
  expenses: rupees.default(0),
  deductions: rupees.default(0),
  notes: text(300).optional(),
};

export const createEarningsSchema = z.object(base).strict();
export const updateEarningsSchema = z
  .object(base)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');

export const listEarningsQuery = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export const summaryQuery = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
  anchor: dateSchema.optional(),
});

export type CreateEarningsBody = z.infer<typeof createEarningsSchema>;
