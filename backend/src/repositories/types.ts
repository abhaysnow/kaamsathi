import type {
  EarningsEntry,
  EarningsInput,
  GrievanceDraftContent,
  GrievanceRecord,
  Language,
  UserRecord,
  UserRole,
} from '../types/domain.js';

/**
 * Every method takes ownerId from the server-side session, never from client input, and every
 * lookup of a single record is scoped by it. That makes cross-user access impossible by
 * construction (no "find by id" without an owner).
 */
export interface EarningsRepository {
  list(ownerId: string, range?: { from?: string; to?: string }): Promise<EarningsEntry[]>;
  create(
    ownerId: string,
    input: EarningsInput,
    source: EarningsEntry['source'],
  ): Promise<EarningsEntry>;
  update(ownerId: string, id: string, patch: Partial<EarningsInput>): Promise<EarningsEntry | null>;
  remove(ownerId: string, id: string): Promise<boolean>;
  removeAll(ownerId: string): Promise<number>;
}

export interface GrievanceRepository {
  create(
    ownerId: string,
    data: {
      language: Language;
      draft: GrievanceDraftContent;
      provider: GrievanceRecord['provider'];
    },
  ): Promise<GrievanceRecord>;
  list(ownerId: string): Promise<GrievanceRecord[]>;
  update(
    ownerId: string,
    id: string,
    patch: { status?: GrievanceRecord['status']; finalMessage?: string; subject?: string },
  ): Promise<GrievanceRecord | null>;
  remove(ownerId: string, id: string): Promise<boolean>;
  removeAll(ownerId: string): Promise<number>;
}

/** Emails passed in are already normalised by the auth service. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Returns null when the email is already registered (unique index). */
  create(data: {
    email: string;
    name: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<UserRecord | null>;
  /** Sets a new hash and bumps sessionVersion so every existing session is invalidated. */
  setPassword(id: string, passwordHash: string): Promise<void>;
  /** Idempotent demo provisioning: create, or reset to the configured hash and demo role. */
  upsertDemo(data: { email: string; name: string; passwordHash: string }): Promise<{
    user: UserRecord;
    created: boolean;
  }>;
  count(): Promise<number>;
}

export interface ResetTokenRepository {
  /** Stores a token hash; any earlier unused token for the same user is discarded. */
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  /**
   * Atomically marks an unexpired, unused token as used and returns its user id. A second call
   * with the same hash (replay) or a call after expiry returns null.
   */
  consume(tokenHash: string, now?: Date): Promise<string | null>;
}

export interface Repositories {
  earnings: EarningsRepository;
  grievances: GrievanceRepository;
  users: UserRepository;
  resetTokens: ResetTokenRepository;
  kind: 'memory' | 'mongo';
  /** Releases connections (no-op for memory). */
  close?: () => Promise<void>;
  /** Native driver client, so the session store reuses the same connection (mongo only). */
  client?: () => import('mongodb').MongoClient;
}
