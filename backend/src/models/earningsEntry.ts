import { Schema, model, type InferSchemaType } from 'mongoose';
import { WORK_CATEGORIES } from '../types/domain.js';

const money = { type: Number, min: 0, max: 1_000_000, default: 0 };

const earningsEntrySchema = new Schema(
  {
    ownerId: { type: String, required: true, maxlength: 80 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    category: { type: String, enum: WORK_CATEGORIES, required: true },
    platform: { type: String, maxlength: 60 },
    hoursWorked: { type: Number, min: 0, max: 24, required: true },
    basePay: money,
    tips: money,
    bonuses: money,
    incentives: money,
    expenses: money,
    deductions: money,
    notes: { type: String, maxlength: 300 },
    source: { type: String, enum: ['user_entered', 'demo_sample'], required: true },
    // Retention: set only for demo-sandbox data; MongoDB's TTL monitor deletes it after this time.
    // Account data has no expiresAt and is kept until the user deletes it (see SECURITY.md).
    expiresAt: { type: Date },
  },
  { timestamps: true },
);
// Every query is owner-scoped, so ownerId leads the compound index.
earningsEntrySchema.index({ ownerId: 1, date: 1 });
earningsEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EarningsEntryDoc = InferSchemaType<typeof earningsEntrySchema>;
export const EarningsEntryModel = model('EarningsEntry', earningsEntrySchema);
