import { Schema, model } from 'mongoose';

const grievanceSchema = new Schema(
  {
    ownerId: { type: String, required: true, maxlength: 80 },
    language: { type: String, required: true },
    provider: { type: String, enum: ['anthropic', 'mock'], required: true },
    status: { type: String, enum: ['draft', 'sent_by_worker', 'resolved'], default: 'draft' },
    // Stored only after the worker gave explicit consent (enforced in the service layer).
    draft: { type: Schema.Types.Mixed, required: true },
    // Retention: MongoDB's TTL monitor deletes the record after this time (see SECURITY.md).
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
grievanceSchema.index({ ownerId: 1, createdAt: -1 });
grievanceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GrievanceDraftModel = model('GrievanceDraft', grievanceSchema);
