import { randomUUID } from 'node:crypto';
import type { EarningsEntry, GrievanceRecord, UserRecord } from '../types/domain.js';
import type {
  EarningsRepository,
  GrievanceRepository,
  Repositories,
  ResetTokenRepository,
  UserRepository,
} from './types.js';

/** Dev/demo/test store. Data is lost on restart, which is also a privacy feature for demos. */
export function createMemoryRepositories(): Repositories {
  const earningsStore = new Map<string, EarningsEntry>();
  const grievanceStore = new Map<string, GrievanceRecord>();
  const now = () => new Date().toISOString();

  const earnings: EarningsRepository = {
    async list(ownerId, range) {
      return [...earningsStore.values()]
        .filter(
          (e) =>
            e.ownerId === ownerId &&
            (!range?.from || e.date >= range.from) &&
            (!range?.to || e.date <= range.to),
        )
        .sort((a, b) =>
          a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1,
        );
    },
    async create(ownerId, input, source) {
      const entry: EarningsEntry = {
        ...input,
        id: randomUUID(),
        ownerId,
        source,
        createdAt: now(),
        updatedAt: now(),
      };
      earningsStore.set(entry.id, entry);
      return entry;
    },
    async update(ownerId, id, patch) {
      const cur = earningsStore.get(id);
      if (!cur || cur.ownerId !== ownerId) return null;
      const next = { ...cur, ...patch, updatedAt: now() };
      earningsStore.set(id, next);
      return next;
    },
    async remove(ownerId, id) {
      const cur = earningsStore.get(id);
      if (!cur || cur.ownerId !== ownerId) return false;
      return earningsStore.delete(id);
    },
    async removeAll(ownerId) {
      let n = 0;
      for (const [id, e] of earningsStore)
        if (e.ownerId === ownerId && earningsStore.delete(id)) n++;
      return n;
    },
  };

  const grievances: GrievanceRepository = {
    async create(ownerId, data) {
      const rec: GrievanceRecord = {
        id: randomUUID(),
        ownerId,
        language: data.language,
        draft: data.draft,
        provider: data.provider,
        status: 'draft',
        createdAt: now(),
        updatedAt: now(),
      };
      grievanceStore.set(rec.id, rec);
      return rec;
    },
    async list(ownerId) {
      return [...grievanceStore.values()]
        .filter((g) => g.ownerId === ownerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async update(ownerId, id, patch) {
      const cur = grievanceStore.get(id);
      if (!cur || cur.ownerId !== ownerId) return null;
      const draft = {
        ...cur.draft,
        ...(patch.subject ? { subject: patch.subject } : {}),
        ...(patch.finalMessage ? { finalMessage: patch.finalMessage } : {}),
      };
      const next: GrievanceRecord = {
        ...cur,
        draft,
        status: patch.status ?? cur.status,
        updatedAt: now(),
      };
      grievanceStore.set(id, next);
      return next;
    },
    async remove(ownerId, id) {
      const cur = grievanceStore.get(id);
      if (!cur || cur.ownerId !== ownerId) return false;
      return grievanceStore.delete(id);
    },
    async removeAll(ownerId) {
      let n = 0;
      for (const [id, g] of grievanceStore)
        if (g.ownerId === ownerId && grievanceStore.delete(id)) n++;
      return n;
    },
  };

  const userStore = new Map<string, UserRecord>();
  const users: UserRepository = {
    async findByEmail(email) {
      return [...userStore.values()].find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      return userStore.get(id) ?? null;
    },
    async create(data) {
      if (await users.findByEmail(data.email)) return null;
      const user: UserRecord = { ...data, id: randomUUID(), sessionVersion: 0, createdAt: now() };
      userStore.set(user.id, user);
      return { ...user };
    },
    async setPassword(id, passwordHash) {
      const u = userStore.get(id);
      if (u) userStore.set(id, { ...u, passwordHash, sessionVersion: u.sessionVersion + 1 });
    },
    async upsertDemo(data) {
      const existing = await users.findByEmail(data.email);
      if (!existing) {
        const user = (await users.create({ ...data, role: 'demo' }))!;
        return { user, created: true };
      }
      const user = { ...existing, ...data, role: 'demo' as const };
      userStore.set(user.id, user);
      return { user: { ...user }, created: false };
    },
    async count() {
      return userStore.size;
    },
  };

  const tokenStore = new Map<string, { userId: string; expiresAt: Date; usedAt?: Date }>();
  const resetTokens: ResetTokenRepository = {
    async create(userId, tokenHash, expiresAt) {
      for (const [h, t] of tokenStore) if (t.userId === userId && !t.usedAt) tokenStore.delete(h);
      tokenStore.set(tokenHash, { userId, expiresAt });
    },
    async consume(tokenHash, at = new Date()) {
      const t = tokenStore.get(tokenHash);
      if (!t || t.usedAt || t.expiresAt <= at) return null;
      t.usedAt = at;
      return t.userId;
    },
  };

  return { earnings, grievances, users, resetTokens, kind: 'memory' };
}
