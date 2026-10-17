import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { MockAIProvider } from '../../src/ai/mockProvider.js';
import { loadConfig } from '../../src/config/env.js';
import { loadKnowledge } from '../../src/knowledge/loader.js';
import { KnowledgeRetrievalService } from '../../src/knowledge/retrieval.js';
import { EarningsEntryModel } from '../../src/models/earningsEntry.js';
import { createMongoRepositories } from '../../src/repositories/mongo.js';
import type { Repositories } from '../../src/repositories/types.js';
import { DEMO_RETENTION_MS, GUEST_RETENTION_MS } from '../../src/utils/retention.js';
import { H, entry } from '../helpers/app.js';

/**
 * Same API, real MongoDB (an ephemeral mongod downloaded by mongodb-memory-server). Proves the
 * production repository enforces ownership and resists operator injection, not just the memory one.
 */
let mongod: MongoMemoryServer;
let repos: Repositories;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  repos = await createMongoRepositories(mongod.getUri('kaamsaathi_test'));
  await EarningsEntryModel.syncIndexes();
  const config = loadConfig({ NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40) });
  app = createApp({
    config,
    provider: new MockAIProvider(),
    repos,
    knowledge: new KnowledgeRetrievalService(loadKnowledge()),
  });
}, 120_000);

afterAll(async () => {
  await repos?.close?.();
  await mongod?.stop();
});

describe('MongoDB repository', () => {
  it('creates entries, computes the summary and enforces cross-user isolation', async () => {
    const alice = request.agent(app);
    const bob = request.agent(app);

    const created = await alice.post('/api/v1/earnings/entries').set(H).send(entry());
    expect(created.status).toBe(201);
    const id = created.body.entry.id as string;
    expect(id).toMatch(/^[0-9a-f]{24}$/);

    const sum = await alice.get('/api/v1/earnings/summary?period=day&anchor=2026-10-12');
    expect(sum.status, JSON.stringify(sum.body)).toBe(200);
    expect(sum.body.totals).toMatchObject({ gross: 950, net: 600, entries: 1 });

    expect((await bob.get('/api/v1/earnings/entries')).body.entries).toHaveLength(0);
    expect(
      (await bob.patch(`/api/v1/earnings/entries/${id}`).set(H).send({ basePay: 1 })).status,
    ).toBe(404);
    expect((await bob.delete(`/api/v1/earnings/entries/${id}`).set(H)).status).toBe(404);
    expect((await alice.get('/api/v1/earnings/entries')).body.entries[0].basePay).toBe(800);
  });

  it('rejects NoSQL operator injection in ids and bodies', async () => {
    const eve = request.agent(app);
    expect((await eve.delete('/api/v1/earnings/entries/%7B%22$ne%22:null%7D').set(H)).status).toBe(
      400,
    );
    const r = await eve
      .post('/api/v1/earnings/entries')
      .set(H)
      .send(entry({ ownerId: { $ne: null }, basePay: { $gt: 0 } }));
    expect(r.status).toBe(400);
  });

  it('sets the retention expiry (TTL) per bucket and hides it from the API', async () => {
    const guest = request.agent(app);
    const res = await guest.post('/api/v1/earnings/entries').set(H).send(entry());
    expect(res.body.entry.expiresAt).toBeUndefined();
    const doc = await EarningsEntryModel.findById(res.body.entry.id).lean();
    const ttl = doc!.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(GUEST_RETENTION_MS - 60_000);
    expect(ttl).toBeLessThanOrEqual(GUEST_RETENTION_MS);

    const demo = request.agent(app);
    const d = await demo
      .post('/api/v1/earnings/entries')
      .set(H)
      .set('X-KS-Mode', 'demo')
      .send(entry());
    const demoDoc = await EarningsEntryModel.findById(d.body.entry.id).lean();
    expect(demoDoc!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(DEMO_RETENTION_MS);

    const indexes = await EarningsEntryModel.collection.indexes();
    expect(indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  });

  it('stores complaints only with consent and deletes all my data on request', async () => {
    const w = request.agent(app);
    const facts = {
      type: 'unpaid_incentive',
      platformOrEmployer: 'TestPlat',
      whatHappened: 'Incentive of ₹250 not paid for week of 2026-10-05.',
      evidenceAvailable: ['screenshot'],
    };
    await w.post('/api/v1/grievances/draft').set(H).send({ language: 'en', facts });
    expect((await w.get('/api/v1/grievances')).body.grievances).toHaveLength(0);

    const saved = await w
      .post('/api/v1/grievances/draft')
      .set(H)
      .send({ language: 'en', facts, saveWithConsent: true });
    expect(saved.status).toBe(201);
    expect((await w.get('/api/v1/grievances')).body.grievances).toHaveLength(1);

    await w.post('/api/v1/earnings/entries').set(H).send(entry());
    const del = await w.delete('/api/v1/me/data').set(H);
    expect(del.body.deleted).toEqual({ earnings: 1, grievances: 1 });
    expect((await w.get('/api/v1/grievances')).body.grievances).toHaveLength(0);
  });
});
