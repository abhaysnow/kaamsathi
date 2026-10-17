import { Schema, model } from 'mongoose';

const grievanceSchema = new Schema(
  {
    ownerId: { type: String, required: true, maxlength: 80 },
    language: { type: String, required: true },
    provider: { type: String, enum: ['gemini', 'mock'], required: true },
    status: { type: String, enum: ['draft', 'sent_by_worker', 'resolved'], default: 'draft' },
    // Stored only after the worker gave explicit consent (enforced in the service layer).
    draft: { type: Schema.Types.Mixed, required: true },
    // Retention: set only for demo-sandbox data; MongoDB's TTL monitor deletes it after this time.
    // Account data has no expiresAt and is kept until the user deletes it (see SECURITY.md).
    expiresAt: { type: Date },
  },
  { timestamps: true },
);
grievanceSchema.index({ ownerId: 1, createdAt: -1 });
grievanceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GrievanceDraftModel = model('GrievanceDraft', grievanceSchema);
