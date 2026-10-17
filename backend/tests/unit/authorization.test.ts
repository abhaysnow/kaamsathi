import { describe, expect, it } from 'vitest';
import { createMemoryRepositories } from '../../src/repositories/memory.js';

const input = {
  date: '2026-10-12',
  category: 'food_delivery' as const,
  hoursWorked: 1,
  basePay: 1,
  tips: 0,
  bonuses: 0,
  incentives: 0,
  expenses: 0,
  deductions: 0,
};

describe('owner-scoped repositories', () => {
  it("never reads, updates or deletes another owner's entry", async () => {
    const { earnings } = createMemoryRepositories();
    const mine = await earnings.create('guest:a', input, 'user_entered');
    expect(await earnings.list('guest:b')).toEqual([]);
    expect(await earnings.update('guest:b', mine.id, { basePay: 9 })).toBeNull();
    expect(await earnings.remove('guest:b', mine.id)).toBe(false);
    expect((await earnings.list('guest:a'))[0]!.basePay).toBe(1);
  });
  it('demo and guest buckets of the same session are separate', async () => {
    const { earnings } = createMemoryRepositories();
    await earnings.create('demo:s1', input, 'demo_sample');
    expect(await earnings.list('guest:s1')).toEqual([]);
  });
  it('removeAll only deletes own data', async () => {
    const { earnings } = createMemoryRepositories();
    await earnings.create('guest:a', input, 'user_entered');
    await earnings.create('guest:b', input, 'user_entered');
    expect(await earnings.removeAll('guest:a')).toBe(1);
    expect(await earnings.list('guest:b')).toHaveLength(1);
  });
});
