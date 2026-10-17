import mongoose, { isValidObjectId } from 'mongoose';
import type { EarningsEntry, GrievanceRecord } from '../types/domain.js';
import { EarningsEntryModel } from '../models/earningsEntry.js';
import { GrievanceDraftModel } from '../models/grievanceDraft.js';
import { expiresAtFor } from '../utils/retention.js';
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
          expiresAt: expiresAtFor(ownerId),
        });
        return toEarnings(doc.toObject() as unknown as Lean);
      },
      async update(ownerId, id, patch) {
        if (!isValidObjectId(id)) return null;
        const doc = await EarningsEntryModel.findOneAndUpdate(
          { _id: { $eq: id }, ownerId: { $eq: ownerId } },
          { $set: { ...patch, expiresAt: expiresAtFor(ownerId) } },
          { new: true, runValidators: true },
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
          expiresAt: expiresAtFor(ownerId),
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
        const set: Record<string, unknown> = { expiresAt: expiresAtFor(ownerId) };
        if (patch.status) set.status = patch.status;
        if (patch.subject) set['draft.subject'] = patch.subject;
        if (patch.finalMessage) set['draft.finalMessage'] = patch.finalMessage;
        const doc = await GrievanceDraftModel.findOneAndUpdate(
          { _id: { $eq: id }, ownerId: { $eq: ownerId } },
          { $set: set },
          { new: true },
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
