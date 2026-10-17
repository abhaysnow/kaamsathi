import { z } from 'zod';
import { GRIEVANCE_TYPES, LANGUAGES, WORK_CATEGORIES } from '../types/domain.js';
import { isValidDateString } from '../utils/dates.js';

export const languageSchema = z.enum(LANGUAGES);
export const workCategorySchema = z.enum(WORK_CATEGORIES);
export const dateSchema = z.string().refine(isValidDateString, 'Use YYYY-MM-DD');

/** Free text is trimmed and length-capped. Control characters are stripped. */
// eslint-disable-next-line no-control-regex -- intentionally strips control characters
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const clean = (s: string) => s.replace(CONTROL_CHARS, '').trim();

export const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max));

export const nonEmptyText = (max: number) =>
  z.string().transform(clean).pipe(z.string().min(1).max(max));

export const rupees = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000)
  .refine((n) => Math.round(n * 100) === Number((n * 100).toFixed(6)), 'At most 2 decimals');

export const objectIdParam = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Invalid id'),
});

export const grievanceTypeSchema = z.enum(GRIEVANCE_TYPES);
