import MongoStore from 'connect-mongo';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { EarningsEntryModel } from '../../src/models/earningsEntry.js';
import { UserModel } from '../../src/models/user.js';
import { createMongoRepositories } from '../../src/repositories/mongo.js';
import type { Repositories } from '../../src/repositories/types.js';
import { seedDemoUser } from '../../src/services/authService.js';
import type { AppContext } from '../../src/services/context.js';
import { DEMO_RETENTION_MS } from '../../src/utils/retention.js';
import { H, demoAgent, entry, makeContext, userAgent } from '../helpers/app.js';

/**
 * Same API, real MongoDB (an ephemeral mongod downloaded by mongodb-memory-server), with sessions
 * stored in Mongo through connect-mongo exactly as in production.
 */
let mongod: MongoMemoryServer;
let repos: Repositories;
let ctx: AppContext;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  repos = await createMongoRepositories(mongod.getUri('kaamsaathi_test'));
  await Promise.all([EarningsEntryModel.syncIndexes(), UserModel.syncIndexes()]);
  ctx = makeContext({ repos });
  ctx.sessionStore = MongoStore.create({ client: repos.client!(), collectionName: 'sessions' });
  await seedDemoUser(ctx);
  app = createApp(ctx);
}, 120_000);

afterAll(async () => {
  await (ctx?.sessionStore as MongoStore | undefined)?.close();
  await repos?.close?.();
  await mongod?.stop();
});

describe('MongoDB repository', () => {
  it('demo seeding is idempotent against a real unique index', async () => {
    const again = await seedDemoUser(ctx);
    await Promise.all([seedDemoUser(ctx), seedDemoUser(ctx)]); // concurrent re-runs
    expect(again?.created).toBe(false);
    expect(await UserModel.countDocuments({ email: 'demo@workwise.ai' })).toBe(1);
    const doc = await UserModel.findOne({ email: 'demo@workwise.ai' }).lean();
    expect(doc?.role).toBe('demo');
    expect(doc?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('stores sessions server-side in MongoDB and deletes them on logout', async () => {
    const a = await demoAgent(app);
    const sessions = repos.client!().db().collection('sessions');
    const before = await sessions.countDocuments();
    expect(before).toBeGreaterThan(0);
    await a.post('/api/v1/auth/logout').set(H);
    expect(await sessions.countDocuments()).toBe(before - 1);
  });

  it('creates entries, computes the summary and enforces cross-user isolation', async () => {
    const alice = await userAgent(app);
    const bob = await userAgent(app);

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
    const eve = await userAgent(app);
    expect((await eve.delete('/api/v1/earnings/entries/%7B%22$ne%22:null%7D').set(H)).status).toBe(
      400,
    );
    const r = await eve
      .post('/api/v1/earnings/entries')
      .set(H)
      .send(entry({ ownerId: { $ne: null }, basePay: { $gt: 0 } }));
    expect(r.status).toBe(400);
  });

  it('expires demo-sandbox data (TTL) but never adds an expiry to account data', async () => {
    const worker = await userAgent(app);
    const res = await worker.post('/api/v1/earnings/entries').set(H).send(entry());
    expect(res.body.entry.expiresAt).toBeUndefined();
    await worker.patch(`/api/v1/earnings/entries/${res.body.entry.id}`).set(H).send({ tips: 5 });
    const doc = await EarningsEntryModel.findById(res.body.entry.id).lean();
    expect(doc!.expiresAt).toBeUndefined(); // kept until the worker deletes it

    const demo = await demoAgent(app);
    const d = await demo.post('/api/v1/earnings/entries').set(H).send(entry());
    const demoDoc = await EarningsEntryModel.findById(d.body.entry.id).lean();
    expect(demoDoc!.expiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(DEMO_RETENTION_MS);

    const indexes = await EarningsEntryModel.collection.indexes();
    expect(indexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  });

  it('stores complaints only with consent and deletes all my data on request', async () => {
    const w = await userAgent(app);
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
