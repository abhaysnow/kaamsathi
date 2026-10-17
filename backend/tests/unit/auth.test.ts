import { describe, expect, it, vi } from 'vitest';
import { DevOutboxMailer, ResendMailer, createMailer } from '../../src/auth/mailer.js';
import {
  hashPassword,
  normalizeEmail,
  passwordProblem,
  verifyPassword,
} from '../../src/auth/password.js';
import { RESET_TOKEN_RE, createResetToken, hashToken } from '../../src/auth/tokens.js';
import { DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD, loadConfig } from '../../src/config/env.js';
import { createMemoryRepositories } from '../../src/repositories/memory.js';
import { authenticate, seedDemoUser, toPublicUser } from '../../src/services/authService.js';
import { TEST_ENV, makeContext } from '../helpers/app.js';

const prodEnv = {
  NODE_ENV: 'production',
  SESSION_SECRET: 'p'.repeat(40),
  COOKIE_SECURE: 'true',
  MONGODB_URI: 'mongodb://db/ks',
};

describe('password hashing (Argon2id)', () => {
  it('hashes with argon2id, never stores the plaintext, and verifies correctly', async () => {
    const hash = await hashPassword('Correct-horse-1', 'fast');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Correct-horse-1');
    expect(await verifyPassword(hash, 'Correct-horse-1')).toBe(true);
    expect(await verifyPassword(hash, 'correct-horse-1')).toBe(false);
  });
  it('salts: the same password hashes differently each time', async () => {
    expect(await hashPassword('Same-pass-1', 'fast')).not.toBe(
      await hashPassword('Same-pass-1', 'fast'),
    );
  });
  it('fails closed on a corrupt hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});

describe('input rules', () => {
  it('normalises email case, spacing and Unicode width', () => {
    expect(normalizeEmail('  Demo@WorkWise.AI ')).toBe('demo@workwise.ai');
    expect(normalizeEmail('ｄｅｍｏ@workwise.ai')).toBe('demo@workwise.ai');
  });
  it('password policy: length plus a letter and a digit', () => {
    expect(passwordProblem('short1')).toMatch(/at least 8/);
    expect(passwordProblem('onlyletters')).toMatch(/letter and one number/);
    expect(passwordProblem('12345678')).toMatch(/letter and one number/);
    expect(passwordProblem('x'.repeat(129) + '1')).toMatch(/at most/);
    expect(passwordProblem(DEFAULT_DEMO_PASSWORD)).toBeNull();
  });
});

describe('reset tokens', () => {
  it('are 256-bit random, URL-safe, and only their hash is kept', () => {
    const a = createResetToken();
    const b = createResetToken();
    expect(a.token).toMatch(RESET_TOKEN_RE);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
  });
  it('are single use, expire, and a new request voids the previous token', async () => {
    const { resetTokens } = createMemoryRepositories();
    const soon = new Date(Date.now() + 60_000);
    await resetTokens.create('u1', 'h1', soon);
    expect(await resetTokens.consume('h1')).toBe('u1');
    expect(await resetTokens.consume('h1')).toBeNull(); // replay

    await resetTokens.create('u1', 'h2', soon);
    expect(await resetTokens.consume('h2', new Date(soon.getTime() + 1))).toBeNull(); // expired

    await resetTokens.create('u1', 'h3', soon);
    await resetTokens.create('u1', 'h4', soon);
    expect(await resetTokens.consume('h3')).toBeNull(); // superseded
    expect(await resetTokens.consume('h4')).toBe('u1');
  });
});

describe('demo account seeding', () => {
  it('is idempotent: one account, demo role, hashed password', async () => {
    const ctx = makeContext();
    const first = await seedDemoUser(ctx);
    const second = await seedDemoUser(ctx);
    expect(first?.created).toBe(true);
    expect(second?.created).toBe(false);
    expect(second?.user.id).toBe(first?.user.id);
    expect(await ctx.repos.users.count()).toBe(1);
    const u = await ctx.repos.users.findByEmail(DEFAULT_DEMO_EMAIL);
    expect(u?.role).toBe('demo');
    expect(u?.passwordHash).not.toContain(DEFAULT_DEMO_PASSWORD);
    expect(toPublicUser(u!)).toEqual({
      id: u!.id,
      email: DEFAULT_DEMO_EMAIL,
      name: expect.any(String),
      isDemo: true,
    });
  });
  it('creates nothing when disabled, and a stale demo record cannot log in', async () => {
    const off = makeContext({ env: { DEMO_ACCOUNT_ENABLED: 'false' } });
    expect(await seedDemoUser(off)).toBeNull();
    expect(await off.repos.users.count()).toBe(0);

    const on = makeContext();
    await seedDemoUser(on);
    const disabledLater = makeContext({ repos: on.repos, env: { DEMO_ACCOUNT_ENABLED: 'false' } });
    expect(await authenticate(disabledLater, DEFAULT_DEMO_EMAIL, DEFAULT_DEMO_PASSWORD)).toBeNull();
  });
});

describe('auth configuration', () => {
  it('demo account defaults to ON in development and OFF in production', () => {
    expect(loadConfig({ NODE_ENV: 'development' }).demo.enabled).toBe(true);
    expect(loadConfig(prodEnv).demo.enabled).toBe(false);
    expect(loadConfig({ ...prodEnv, DEMO_ACCOUNT_ENABLED: 'true' }).demo.enabled).toBe(true);
  });
  it('never enables the dev outbox or fast hashing in production', () => {
    expect(loadConfig(prodEnv).devOutboxEnabled).toBe(false);
    expect(createMailer(loadConfig(prodEnv))).toBeNull();
    expect(() => loadConfig({ ...prodEnv, PASSWORD_HASH_PROFILE: 'fast' })).toThrow(/tests/);
    expect(createMailer(loadConfig(TEST_ENV))).toBeInstanceOf(DevOutboxMailer);
  });
  it('requires credentials when an email provider is chosen', () => {
    expect(() => loadConfig({ ...prodEnv, EMAIL_PROVIDER: 'resend' })).toThrow(/RESEND_API_KEY/);
  });
});

describe('Resend mailer', () => {
  it('sends via the HTTP API and reports failures without echoing the body', async () => {
    const fetchOk = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await new ResendMailer('key', 'KaamSaathi <no-reply@x.test>', fetchOk).send({
      to: 'a@b.test',
      subject: 's',
      text: 't',
    });
    expect(fetchOk).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
    const fetchBad = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    await expect(
      new ResendMailer('key', 'f', fetchBad).send({ to: 'a@b.test', subject: 's', text: 'secret' }),
    ).rejects.toThrow(/^email provider returned 422$/);
  });
});
