import { Schema, model } from 'mongoose';

const resetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    // SHA-256 of the token; the token itself is never stored.
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);
resetTokenSchema.index({ tokenHash: 1 }, { unique: true });
resetTokenSchema.index({ userId: 1 });
// Expired tokens are removed by MongoDB's TTL monitor.
resetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetTokenModel = model('PasswordResetToken', resetTokenSchema);
