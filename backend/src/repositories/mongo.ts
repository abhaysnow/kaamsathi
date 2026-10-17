import mongoose, { isValidObjectId } from 'mongoose';
import type { EarningsEntry, GrievanceRecord, UserRecord } from '../types/domain.js';
import { EarningsEntryModel } from '../models/earningsEntry.js';
import { GrievanceDraftModel } from '../models/grievanceDraft.js';
import { PasswordResetTokenModel } from '../models/passwordResetToken.js';
import { UserModel } from '../models/user.js';
import { expirySet } from '../utils/retention.js';
import type { Repositories } from './types.js';

type Lean = Record<string, unknown> & { _id: unknown; createdAt: Date; updatedAt: Date };

const toEarnings = (d: Lean): EarningsEntry => {
  const { _id, __v, expiresAt, createdAt, updatedAt, ...rest } = d as Lean & {
    __v?: number;
    expiresAt?: Date;
  };
  void __v;
  void expiresAt;
  return {
    ...(rest as unknown as EarningsEntry),
    id: String(_id),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
};

const toGrievance = (d: Lean): GrievanceRecord => ({
  id: String(d._id),
  ownerId: d.ownerId as string,
  language: d.language as GrievanceRecord['language'],
  provider: d.provider as GrievanceRecord['provider'],
  status: d.status as GrievanceRecord['status'],
  draft: d.draft as GrievanceRecord['draft'],
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

const toUser = (d: Lean): UserRecord => ({
  id: String(d._id),
  email: d.email as string,
  name: d.name as string,
  passwordHash: d.passwordHash as string,
  role: d.role as UserRecord['role'],
  sessionVersion: d.sessionVersion as number,
  createdAt: d.createdAt.toISOString(),
});

const isDuplicateKey = (e: unknown) => (e as { code?: number })?.code === 11000;

/**
 * ids arrive as validated strings; isValidObjectId blocks operator objects ({ $ne: ... }) and
 * every filter uses explicit $eq on the server-derived ownerId.
 */
export async function createMongoRepositories(uri: string): Promise<Repositories> {
  mongoose.set('sanitizeFilter', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  return {
    kind: 'mongo',
    close: () => mongoose.disconnect(),
    client: () => mongoose.connection.getClient(),
    users: {
      async findByEmail(email) {
        const d = await UserModel.findOne({ email: { $eq: email } }).lean();
        return d ? toUser(d as unknown as Lean) : null;
      },
      async findById(id) {
        if (!isValidObjectId(id)) return null;
        const d = await UserModel.findById(id).lean();
        return d ? toUser(d as unknown as Lean) : null;
      },
      async create(data) {
        try {
          const d = await UserModel.create(data);
          return toUser(d.toObject() as unknown as Lean);
        } catch (e) {
          if (isDuplicateKey(e)) return null;
          throw e;
        }
      },
      async setPassword(id, passwordHash) {
        if (!isValidObjectId(id)) return;
        await UserModel.updateOne(
          { _id: { $eq: id } },
          { $set: { passwordHash }, $inc: { sessionVersion: 1 } },
        );
      },
      async upsertDemo(data) {
        const set = { name: data.name, passwordHash: data.passwordHash, role: 'demo' as const };
        const update = () =>
          UserModel.findOneAndUpdate(
            { email: { $eq: data.email } },
            { $set: set },
            { returnDocument: 'after' },
          ).lean();
        const existing = await update();
        if (existing) return { user: toUser(existing as unknown as Lean), created: false };
        try {
          const d = await UserModel.create({ email: data.email, ...set });
          return { user: toUser(d.toObject() as unknown as Lean), created: true };
        } catch (e) {
          // A concurrent seed won the race; the unique index kept it to one account.
          if (!isDuplicateKey(e)) throw e;
          return { user: toUser((await update()) as unknown as Lean), created: false };
        }
      },
      async count() {
        return UserModel.countDocuments();
      },
    },
    resetTokens: {
      async create(userId, tokenHash, expiresAt) {
        // Server-written operators: trusted() keeps sanitizeFilter from neutralising $exists.
        await PasswordResetTokenModel.deleteMany(
          mongoose.trusted({ userId: { $eq: String(userId) }, usedAt: { $exists: false } }),
        );
        await PasswordResetTokenModel.create({ userId, tokenHash, expiresAt });
      },
      async consume(tokenHash, at = new Date()) {
        // One atomic update: two concurrent requests with the same token cannot both succeed.
        const d = await PasswordResetTokenModel.findOneAndUpdate(
          mongoose.trusted({
            tokenHash: { $eq: String(tokenHash) },
            usedAt: { $exists: false },
            expiresAt: { $gt: at },
          }),
          { $set: { usedAt: at } },
        ).lean();
        return d ? String(d.userId) : null;
      },
    },
    earnings: {
      async list(ownerId, range) {
        const filter: Record<string, unknown> = { ownerId: { $eq: ownerId } };
        if (range?.from || range?.to) {
          // sanitizeFilter would otherwise neutralise our own operators. Safe to trust: these
          // operators are written here, and from/to are schema-validated YYYY-MM-DD strings.
          filter.date = mongoose.trusted({
            ...(range.from ? { $gte: String(range.from) } : {}),
            ...(range.to ? { $lte: String(range.to) } : {}),
          });
        }
        const docs = await EarningsEntryModel.find(filter).sort({ date: 1, createdAt: 1 }).lean();
        return docs.map((d) => toEarnings(d as unknown as Lean));
      },
      async create(ownerId, input, source) {
        const doc = await EarningsEntryModel.create({
          ...input,
          ownerId,
          source,
          ...expirySet(ownerId),
        });
        return toEarnings(doc.toObject() as unknown as Lean);
      },
      async update(ownerId, id, patch) {
        if (!isValidObjectId(id)) return null;
        const doc = await EarningsEntryModel.findOneAndUpdate(
          { _id: { $eq: id }, ownerId: { $eq: ownerId } },
          { $set: { ...patch, ...expirySet(ownerId) } },
          { returnDocument: 'after', runValidators: true },
        ).lean();
        return doc ? toEarnings(doc as unknown as Lean) : null;
      },
      async remove(ownerId, id) {
        if (!isValidObjectId(id)) return false;
        const r = await EarningsEntryModel.deleteOne({
          _id: { $eq: id },
          ownerId: { $eq: ownerId },
        });
        return r.deletedCount === 1;
      },
      async removeAll(ownerId) {
        return (await EarningsEntryModel.deleteMany({ ownerId: { $eq: ownerId } })).deletedCount;
      },
    },
    grievances: {
      async create(ownerId, data) {
        const doc = await GrievanceDraftModel.create({
          ...data,
          ownerId,
          ...expirySet(ownerId),
        });
        return toGrievance(doc.toObject() as unknown as Lean);
      },
      async list(ownerId) {
        const docs = await GrievanceDraftModel.find({ ownerId: { $eq: ownerId } })
          .sort({ createdAt: -1 })
          .lean();
        return docs.map((d) => toGrievance(d as unknown as Lean));
      },
      async update(ownerId, id, patch) {
        if (!isValidObjectId(id)) return null;
        const set: Record<string, unknown> = { ...expirySet(ownerId) };
        if (patch.status) set.status = patch.status;
        if (patch.subject) set['draft.subject'] = patch.subject;
        if (patch.finalMessage) set['draft.finalMessage'] = patch.finalMessage;
        const doc = await GrievanceDraftModel.findOneAndUpdate(
          { _id: { $eq: id }, ownerId: { $eq: ownerId } },
          { $set: set },
          { returnDocument: 'after' },
        ).lean();
        return doc ? toGrievance(doc as unknown as Lean) : null;
      },
      async remove(ownerId, id) {
        if (!isValidObjectId(id)) return false;
        const r = await GrievanceDraftModel.deleteOne({
          _id: { $eq: id },
          ownerId: { $eq: ownerId },
        });
        return r.deletedCount === 1;
      },
      async removeAll(ownerId) {
        return (await GrievanceDraftModel.deleteMany({ ownerId: { $eq: ownerId } })).deletedCount;
      },
    },
  };
}
