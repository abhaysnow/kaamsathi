import { describe, expect, it } from 'vitest';
import { createEarningsSchema } from '../../src/schemas/earnings.js';
import { chatBodySchema } from '../../src/schemas/assistant.js';
import { grievanceFactsSchema } from '../../src/schemas/grievance.js';
import { loadConfig } from '../../src/config/env.js';
import { isValidDateString } from '../../src/utils/dates.js';

const good = { date: '2026-10-12', category: 'food_delivery', hoursWorked: 8 };

describe('input validation', () => {
  it('accepts minimal earnings and defaults money to 0', () => {
    expect(createEarningsSchema.parse(good).tips).toBe(0);
  });
  it.each([
    [{ ...good, date: '2026-02-30' }],
    [{ ...good, hoursWorked: 30 }],
    [{ ...good, basePay: -1 }],
    [{ ...good, basePay: 1.234 }],
    [{ ...good, category: 'astronaut' }],
    [{ ...good, ownerId: 'someone-else' }],
    [{ ...good, basePay: { $gt: 0 } }],
  ])('rejects bad earnings %#', (body) => {
    expect(createEarningsSchema.safeParse(body).success).toBe(false);
  });
  it('validates dates', () => {
    expect(isValidDateString('2026-10-17')).toBe(true);
    expect(isValidDateString('17-10-2026')).toBe(false);
  });
  it('chat: language selection default, caps and unknown languages', () => {
    expect(chatBodySchema.parse({ message: 'hi' }).language).toBe('en');
    expect(chatBodySchema.safeParse({ message: 'hi', language: 'xx' }).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: 'a'.repeat(1001) }).success).toBe(false);
    expect(chatBodySchema.safeParse({ message: '   ' }).success).toBe(false);
  });
  it('grievance facts strip control chars and require essentials', () => {
    const r = grievanceFactsSchema.parse({
      type: 'payment_delay',
      platformOrEmployer: 'X\u0000Y',
      whatHappened: ' unpaid ',
    });
    expect(r.platformOrEmployer).toBe('XY');
    expect(r.whatHappened).toBe('unpaid');
    expect(grievanceFactsSchema.safeParse({ type: 'payment_delay' }).success).toBe(false);
  });
  it('production config requires a strong session secret', () => {
    const prod = { NODE_ENV: 'production', COOKIE_SECURE: 'true', MONGODB_URI: 'mongodb://db/ks' };
    expect(() => loadConfig(prod)).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ ...prod, SESSION_SECRET: 'x'.repeat(32) })).not.toThrow();
    expect(() =>
      loadConfig({ ...prod, SESSION_SECRET: 'x'.repeat(32), FRONTEND_ORIGINS: '*' }),
    ).toThrow();
  });
  it('production refuses demo-style setups (HTTP cookies, in-memory storage)', () => {
    const base = { NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32) };
    expect(() => loadConfig({ ...base, MONGODB_URI: 'mongodb://db/ks' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadConfig({ ...base, COOKIE_SECURE: 'true' })).toThrow(/MONGODB_URI/);
  });
});
