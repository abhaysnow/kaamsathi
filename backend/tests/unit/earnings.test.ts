import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  csvCell,
  findAnomalies,
  netPaise,
  periodBounds,
  toCsv,
} from '../../src/utils/earnings.js';
import type { EarningsEntry } from '../../src/types/domain.js';

const e = (o: Partial<EarningsEntry> = {}): EarningsEntry => ({
  id: 'id-12345678',
  ownerId: 'o',
  date: '2026-10-12',
  category: 'food_delivery',
  hoursWorked: 8,
  basePay: 800,
  tips: 50,
  bonuses: 0,
  incentives: 100,
  expenses: 300,
  deductions: 50,
  source: 'user_entered',
  createdAt: '',
  updatedAt: '',
  ...o,
});

describe('earnings math', () => {
  it('gross = base+tips+bonuses+incentives, net = gross-expenses-deductions', () => {
    const t = computeTotals([e()]);
    expect(t.gross).toBe(950);
    expect(t.net).toBe(600);
    expect(t.netPerHour).toBe(75);
  });
  it('avoids float drift', () => {
    expect(
      computeTotals([e({ basePay: 0.1, tips: 0.2, incentives: 0, expenses: 0, deductions: 0 })])
        .gross,
    ).toBe(0.3);
  });
  it('allows negative net and zero hours', () => {
    const t = computeTotals([
      e({ basePay: 100, tips: 0, incentives: 0, expenses: 300, deductions: 0, hoursWorked: 0 }),
    ]);
    expect(t.net).toBe(-200);
    expect(t.netPerHour).toBeNull();
    expect(netPaise(e({ basePay: 1, tips: 0, incentives: 0, expenses: 2, deductions: 0 }))).toBe(
      -100,
    );
  });
  it('sums multiple entries', () => {
    expect(computeTotals([e(), e()]).net).toBe(1200);
    expect(computeTotals([]).net).toBe(0);
  });
  it('period bounds: Monday-start week and month end', () => {
    expect(periodBounds('week', '2026-10-17')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(periodBounds('month', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodBounds('day', '2026-10-17')).toEqual({ from: '2026-10-17', to: '2026-10-17' });
  });
  it('flags negative net and high expense ratio', () => {
    const a = findAnomalies([
      e({ id: 'neg-0001', expenses: 2000 }),
      e({ id: 'hi-00001', expenses: 600, deductions: 0 }),
    ]);
    expect(a.map((x) => x.reason)).toEqual(['negative_net', 'high_expense_ratio']);
  });
  it('csv neutralises formula injection and escapes quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(-5)).toBe('-5');
    expect(toCsv([e({ platform: '=cmd' })])).toContain("'=cmd");
  });
});
