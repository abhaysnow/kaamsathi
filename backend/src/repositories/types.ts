import type {
  EarningsEntry,
  EarningsInput,
  GrievanceDraftContent,
  GrievanceRecord,
  Language,
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

export interface Repositories {
  earnings: EarningsRepository;
  grievances: GrievanceRepository;
  kind: 'memory' | 'mongo';
  /** Releases connections (no-op for memory). */
  close?: () => Promise<void>;
}
