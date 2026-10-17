import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { DevOutboxMailer } from '../../src/auth/mailer.js';
import { createResetToken } from '../../src/auth/tokens.js';
import { DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD } from '../../src/config/env.js';
import { FORGOT_PASSWORD_MESSAGE } from '../../src/services/authService.js';
import { H, PASSWORD, agent, demoAgent, entry, makeApp, userAgent } from '../helpers/app.js';

const login = (a: ReturnType<typeof agent>, email: string, password: string, extra = {}) =>
  a
    .post('/api/v1/auth/login')
    .set(H)
    .send({ email, password, ...extra });

const cookieOf = (res: request.Response) => {
  const c = res.headers['set-cookie'] as unknown as string[] | undefined;
  return c?.find((x) => x.startsWith('ks_sid='));
};

/** Pulls the reset token out of the dev outbox email, as a developer would by opening the link. */
const tokenFromOutbox = (mailer: DevOutboxMailer, to: string) =>
  mailer
    .list()
    .find((m) => m.to === to)
    ?.text.match(/token=([A-Za-z0-9_-]{43})/)?.[1];

describe('login', () => {
  it('signs in with valid credentials and returns only minimal profile fields', async () => {
    const { app } = await makeApp();
    const r = await login(agent(app), DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.user).sort()).toEqual(['email', 'id', 'isDemo', 'name']);
    expect(JSON.stringify(r.body)).not.toMatch(/argon|hash|password|sessionVersion/i);
  });

  it('creates a server-side session in an HttpOnly, SameSite=Lax cookie', async () => {
    const { app } = await makeApp();
    const r = await login(agent(app), DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD);
    const c = cookieOf(r)!;
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/SameSite=Lax/);
    expect(c).not.toMatch(/Secure/); // tests run over plain HTTP
    expect(c).not.toMatch(/Expires=/); // no "remember me" => browser-session cookie
    expect(decodeURIComponent(c)).not.toContain(DEFAULT_DEMO_EMAIL); // id only, no data
  });

  it('sets Secure cookies when COOKIE_SECURE=true (behind an HTTPS proxy)', async () => {
    const { app } = await makeApp({ env: { COOKIE_SECURE: 'true' } });
    app.set('trust proxy', 1); // what production does (app.ts)
    const send = (proto: string) =>
      request(app)
        .post('/api/v1/auth/login')
        .set(H)
        .set('X-Forwarded-Proto', proto)
        .send({ email: DEFAULT_DEMO_EMAIL, password: DEFAULT_DEMO_PASSWORD });
    expect(cookieOf(await send('https'))).toMatch(/; Secure/);
    // Over plain HTTP a Secure-only session cookie is never sent at all.
    expect(cookieOf(await send('http'))).toBeUndefined();
  });

  it('"remember me" gives a persistent cookie; otherwise it ends with the browser session', async () => {
    const { app } = await makeApp();
    const remembered = await login(agent(app), DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD, {
      remember: true,
    });
    expect(cookieOf(remembered)).toMatch(/Expires=/);
    const normal = await login(agent(app), DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD);
    expect(cookieOf(normal)).not.toMatch(/Expires=/);
  });

  it('accepts differently-cased or padded email (normalisation)', async () => {
    const { app } = await makeApp();
    const r = await login(agent(app), '  DEMO@WorkWise.AI ', DEFAULT_DEMO_PASSWORD);
    expect(r.status).toBe(200);
  });

  it('wrong password and unknown email get the identical generic response', async () => {
    const { app } = await makeApp();
    const wrong = await login(agent(app), DEFAULT_DEMO_EMAIL, 'Wrong-pass-1');
    const unknown = await login(agent(app), 'nobody@example.test', 'Wrong-pass-1');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email or password.',
    });
    expect(cookieOf(wrong)).toBeUndefined();
  });

  it.each([
    [{}],
    [{ email: DEFAULT_DEMO_EMAIL }],
    [{ password: DEFAULT_DEMO_PASSWORD }],
    [{ email: 'not-an-email', password: 'x' }],
    [{ email: { $ne: null }, password: { $ne: null } }],
    [{ email: DEFAULT_DEMO_EMAIL, password: DEFAULT_DEMO_PASSWORD, role: 'admin' }],
    [{ email: DEFAULT_DEMO_EMAIL, password: 'x'.repeat(200) }],
  ])('malformed login body %# => 400 VALIDATION_ERROR', async (body) => {
    const { app } = await makeApp();
    const r = await agent(app).post('/api/v1/auth/login').set(H).send(body);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('issues a new session id at login (no session fixation)', async () => {
    const { app } = await makeApp();
    const a = agent(app);
    const first = cookieOf(await login(a, DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD));
    const second = cookieOf(await login(a, DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD));
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.split(';')[0]).not.toBe(second!.split(';')[0]);
  });

  it('rejects cross-site login attempts by Origin (CSRF)', async () => {
    const { app } = await makeApp();
    const r = await agent(app)
      .post('/api/v1/auth/login')
      .set(H)
      .set('Origin', 'https://evil.example')
      .send({ email: DEFAULT_DEMO_EMAIL, password: DEFAULT_DEMO_PASSWORD });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('CSRF_REJECTED');
  });

  it('rate-limits repeated login attempts', async () => {
    const { app } = await makeApp({ env: { LOGIN_RATE_LIMIT: '3' } });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++)
      codes.push((await login(agent(app), DEFAULT_DEMO_EMAIL, `Wrong-${i}-pass`)).status);
    expect(codes.slice(0, 3)).toEqual([401, 401, 401]);
    expect(codes[3]).toBe(429);
    // Even the correct password is refused while limited: the limiter cannot be used as an oracle.
    expect((await login(agent(app), DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD)).status).toBe(429);
  });
});

describe('session lifecycle and private routes', () => {
  it('GET /auth/me returns the signed-in user; 401 when signed out', async () => {
    const { app } = await makeApp();
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    const a = await demoAgent(app);
    const me = await a.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: DEFAULT_DEMO_EMAIL, isDemo: true });
  });

  it.each([
    ['get', '/api/v1/earnings/entries'],
    ['get', '/api/v1/earnings/summary'],
    ['get', '/api/v1/earnings/export.csv'],
    ['post', '/api/v1/earnings/entries'],
    ['post', '/api/v1/earnings/explain'],
    ['get', '/api/v1/grievances'],
    ['post', '/api/v1/grievances/draft'],
    ['patch', '/api/v1/grievances/abcdefgh12'],
    ['post', '/api/v1/documents/checklist'],
    ['post', '/api/v1/documents/draft'],
    ['post', '/api/v1/assistant/chat'],
    ['post', '/api/v1/schemes/search'],
    ['delete', '/api/v1/me/data'],
  ] as const)('unauthenticated %s %s => 401 AUTH_REQUIRED', async (method, path) => {
    const { app } = await makeApp();
    const r = await request(app)[method](path).set(H).send({});
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('public endpoints stay public', async () => {
    const { app } = await makeApp();
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    expect((await request(app).get('/api/v1/knowledge/sources')).status).toBe(200);
  });

  it('logout destroys the session server-side: replaying the old cookie fails', async () => {
    const { app } = await makeApp();
    const r = await login(agent(app), DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD);
    const cookie = cookieOf(r)!.split(';')[0]!;
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(200);
    const out = await request(app).post('/api/v1/auth/logout').set(H).set('Cookie', cookie);
    expect(out.status).toBe(204);
    expect(cookieOf(out)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await request(app).get('/api/v1/auth/me').set('Cookie', cookie)).status).toBe(401);
    expect((await request(app).get('/api/v1/earnings/entries').set('Cookie', cookie)).status).toBe(
      401,
    );
  });

  it("switching accounts never shows the previous user's records", async () => {
    const { app } = await makeApp();
    const email = 'switcher@example.test';
    const browser = await userAgent(app, email);
    await browser.post('/api/v1/earnings/entries').set(H).send(entry());
    await browser.post('/api/v1/auth/logout').set(H);
    await login(browser, DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD);
    const demoView = (await browser.get('/api/v1/earnings/entries')).body.entries;
    expect(demoView.every((e: { platform?: string }) => e.platform !== 'TestPlat')).toBe(true);
    await browser.post('/api/v1/auth/logout').set(H);
    await login(browser, email, PASSWORD);
    expect((await browser.get('/api/v1/earnings/entries')).body.entries).toHaveLength(1);
  });

  it('cross-user: one account cannot read, edit or delete another account’s records', async () => {
    const { app } = await makeApp();
    const alice = await userAgent(app);
    const bob = await userAgent(app);
    const id = (await alice.post('/api/v1/earnings/entries').set(H).send(entry())).body.entry.id;
    const g = await alice
      .post('/api/v1/grievances/draft')
      .set(H)
      .send({
        language: 'en',
        saveWithConsent: true,
        facts: {
          type: 'payment_delay',
          platformOrEmployer: 'X',
          whatHappened: 'Late pay.',
          evidenceAvailable: [],
        },
      });
    expect(
      (await bob.patch(`/api/v1/earnings/entries/${id}`).set(H).send({ tips: 1 })).status,
    ).toBe(404);
    expect((await bob.delete(`/api/v1/grievances/${g.body.id}`).set(H)).status).toBe(404);
    expect((await bob.get('/api/v1/grievances')).body.grievances).toEqual([]);
  });
});

describe('registration', () => {
  it('creates a real (non-demo) account and signs it in', async () => {
    const { app } = await makeApp();
    const a = agent(app);
    const r = await a
      .post('/api/v1/auth/register')
      .set(H)
      .send({ name: 'Asha', email: 'Asha@Example.test', password: 'Strong-pass-9' });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ email: 'asha@example.test', isDemo: false });
    expect((await a.get('/api/v1/auth/me')).status).toBe(200);
  });
  it('refuses duplicates (case-insensitive), the demo address, and weak passwords', async () => {
    const { app } = await makeApp();
    await userAgent(app, 'dup@example.test');
    const send = (body: object) => agent(app).post('/api/v1/auth/register').set(H).send(body);
    expect(
      (await send({ name: 'X', email: 'DUP@example.test', password: 'Strong-pass-9' })).status,
    ).toBe(409);
    expect(
      (await send({ name: 'X', email: DEFAULT_DEMO_EMAIL, password: 'Strong-pass-9' })).status,
    ).toBe(409);
    expect((await send({ name: 'X', email: 'w@example.test', password: 'weakpass' })).status).toBe(
      400,
    );
  });
});

describe('forgot / reset password', () => {
  it('responds identically for existing, unknown and demo emails', async () => {
    const { app, ctx } = await makeApp();
    await userAgent(app, 'real@example.test');
    const ask = (email: string) =>
      agent(app).post('/api/v1/auth/forgot-password').set(H).send({ email });
    const [real, unknown, demo] = await Promise.all([
      ask('real@example.test'),
      ask('ghost@example.test'),
      ask(DEFAULT_DEMO_EMAIL),
    ]);
    for (const r of [real, unknown, demo]) {
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ message: FORGOT_PASSWORD_MESSAGE, devOutbox: '/api/v1/dev/outbox' });
    }
    await new Promise((r) => setTimeout(r, 20)); // email is sent in the background
    const sent = (ctx.mailer as DevOutboxMailer).list().map((m) => m.to);
    expect(sent).toEqual(['real@example.test']); // nothing for unknown or demo
  });

  it('resets once with a valid token, then the token is dead and old sessions are signed out', async () => {
    const { app, ctx } = await makeApp();
    const email = 'reset-me@example.test';
    const oldSession = await userAgent(app, email);
    await agent(app).post('/api/v1/auth/forgot-password').set(H).send({ email });
    await new Promise((r) => setTimeout(r, 20));
    const token = tokenFromOutbox(ctx.mailer as DevOutboxMailer, email)!;
    expect(token).toBeDefined();

    const reset = (password: string) =>
      agent(app).post('/api/v1/auth/reset-password').set(H).send({ token, password });
    expect((await reset('Brand-new-pass-2')).status).toBe(200);
    const replay = await reset('Another-pass-3');
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe('RESET_TOKEN_INVALID');

    expect((await login(agent(app), email, PASSWORD)).status).toBe(401);
    expect((await login(agent(app), email, 'Brand-new-pass-2')).status).toBe(200);
    expect((await oldSession.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('rejects expired, unknown and malformed tokens with one message', async () => {
    const { app, ctx } = await makeApp();
    await userAgent(app, 'late@example.test');
    const user = await ctx.repos.users.findByEmail('late@example.test');
    const { token, tokenHash } = createResetToken();
    await ctx.repos.resetTokens.create(user!.id, tokenHash, new Date(Date.now() - 1000));
    const send = (t: string) =>
      agent(app)
        .post('/api/v1/auth/reset-password')
        .set(H)
        .send({ token: t, password: 'Fresh-pass-77' });
    const expired = await send(token);
    const unknown = await send(createResetToken().token);
    expect(expired.status).toBe(400);
    expect(expired.body).toEqual(unknown.body);
    expect((await send('short')).status).toBe(400);
    expect((await login(agent(app), 'late@example.test', 'Fresh-pass-77')).status).toBe(401);
  });

  it('never issues a reset for the demo account', async () => {
    const { app, ctx } = await makeApp();
    await agent(app)
      .post('/api/v1/auth/forgot-password')
      .set(H)
      .send({ email: DEFAULT_DEMO_EMAIL });
    await new Promise((r) => setTimeout(r, 20));
    expect((ctx.mailer as DevOutboxMailer).list()).toEqual([]);
  });

  it('without an email provider (production) it says so for every email, and has no outbox', async () => {
    const { app } = await makeApp({ mailer: null });
    await userAgent(app, 'p@example.test');
    for (const email of ['p@example.test', 'ghost@example.test']) {
      const r = await agent(app).post('/api/v1/auth/forgot-password').set(H).send({ email });
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('EMAIL_NOT_CONFIGURED');
    }
    expect((await request(app).get('/api/v1/dev/outbox')).status).not.toBe(200);
  });

  it('rate-limits forgot-password', async () => {
    const { app } = await makeApp({ env: { AUTH_RATE_LIMIT: '2' } });
    const codes: number[] = [];
    for (let i = 0; i < 3; i++)
      codes.push(
        (await agent(app).post('/api/v1/auth/forgot-password').set(H).send({ email: 'a@b.test' }))
          .status,
      );
    expect(codes).toEqual([200, 200, 429]);
  });
});

describe('demo account restrictions', () => {
  it('each demo login gets its own sandbox: visitors cannot see each other’s entries', async () => {
    const { app } = await makeApp();
    const visitor1 = await demoAgent(app);
    const visitor2 = await demoAgent(app);
    await visitor1
      .post('/api/v1/earnings/entries')
      .set(H)
      .send(entry({ platform: 'Visitor1' }));
    const v2 = (await visitor2.get('/api/v1/earnings/entries')).body.entries;
    expect(v2.some((e: { platform?: string }) => e.platform === 'Visitor1')).toBe(false);
    expect(v2).toHaveLength(7); // fresh fictional seed only
  });

  it('GET /auth/demo publishes the demo credentials only while the demo account is enabled', async () => {
    const on = await makeApp();
    expect((await request(on.app).get('/api/v1/auth/demo')).body).toEqual({
      enabled: true,
      email: DEFAULT_DEMO_EMAIL,
      password: DEFAULT_DEMO_PASSWORD,
    });
    const off = await makeApp({ env: { DEMO_ACCOUNT_ENABLED: 'false' } });
    expect((await request(off.app).get('/api/v1/auth/demo')).body).toEqual({ enabled: false });
  });

  it('cannot log in at all when DEMO_ACCOUNT_ENABLED=false', async () => {
    const { app, ctx } = await makeApp({ env: { DEMO_ACCOUNT_ENABLED: 'false' } });
    expect(await ctx.repos.users.findByEmail(DEFAULT_DEMO_EMAIL)).toBeNull();
    const r = await login(agent(app), DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
