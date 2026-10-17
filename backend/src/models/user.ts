import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    // Stored normalised (trimmed, lowercased); the unique index prevents duplicate accounts.
    email: { type: String, required: true, maxlength: 254, lowercase: true, trim: true },
    name: { type: String, required: true, maxlength: 80 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'demo'], required: true, default: 'user' },
    sessionVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);
userSchema.index({ email: 1 }, { unique: true });

export const UserModel = model('User', userSchema);
