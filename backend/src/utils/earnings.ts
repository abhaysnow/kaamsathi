import type { EarningsEntry } from '../types/domain.js';
import { addDays, monthStart, weekStart } from './dates.js';
import { fromPaise, toPaise } from './money.js';

type Amounts = Pick<
  EarningsEntry,
  'basePay' | 'tips' | 'bonuses' | 'incentives' | 'expenses' | 'deductions' | 'hoursWorked'
>;

/**
 * Formulas (shown to the worker in the UI):
 *   gross = base pay + tips + bonuses + incentives
 *   net   = gross − work-related expenses − recorded deductions
 * Net can be negative. All values come from what the worker typed; nothing is imported.
 */
export function grossPaise(e: Amounts): number {
  return toPaise(e.basePay) + toPaise(e.tips) + toPaise(e.bonuses) + toPaise(e.incentives);
}

export function netPaise(e: Amounts): number {
  return grossPaise(e) - toPaise(e.expenses) - toPaise(e.deductions);
}

export interface Totals {
  entries: number;
  hoursWorked: number;
  basePay: number;
  tips: number;
  bonuses: number;
  incentives: number;
  gross: number;
  expenses: number;
  deductions: number;
  net: number;
  /** Net earnings per hour; null when no hours recorded. */
  netPerHour: number | null;
}

export function computeTotals(entries: Amounts[]): Totals {
  const sum = (pick: (e: Amounts) => number) => entries.reduce((a, e) => a + pick(e), 0);
  const hours = Math.round(sum((e) => e.hoursWorked * 100)) / 100;
  const gross = sum(grossPaise);
  const net = sum(netPaise);
  return {
    entries: entries.length,
    hoursWorked: hours,
    basePay: fromPaise(sum((e) => toPaise(e.basePay))),
    tips: fromPaise(sum((e) => toPaise(e.tips))),
    bonuses: fromPaise(sum((e) => toPaise(e.bonuses))),
    incentives: fromPaise(sum((e) => toPaise(e.incentives))),
    gross: fromPaise(gross),
    expenses: fromPaise(sum((e) => toPaise(e.expenses))),
    deductions: fromPaise(sum((e) => toPaise(e.deductions))),
    net: fromPaise(net),
    netPerHour: hours > 0 ? Math.round(net / hours) / 100 : null,
  };
}

export type Period = 'day' | 'week' | 'month';

export function periodBounds(period: Period, anchor: string): { from: string; to: string } {
  if (period === 'day') return { from: anchor, to: anchor };
  if (period === 'week') {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6) };
  }
  const from = monthStart(anchor);
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return { from, to: d.toISOString().slice(0, 10) };
}

export interface DayPoint {
  date: string;
  gross: number;
  net: number;
}

/** One point per calendar day in [from, to], zero-filled so charts have no gaps. */
export function dailySeries(entries: EarningsEntry[], from: string, to: string): DayPoint[] {
  const byDay = new Map<string, EarningsEntry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const out: DayPoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const t = computeTotals(byDay.get(d) ?? []);
    out.push({ date: d, gross: t.gross, net: t.net });
  }
  return out;
}

export interface Anomaly {
  entryId: string;
  date: string;
  reason: 'negative_net' | 'high_expense_ratio' | 'unusually_high_gross' | 'many_hours';
  detail: string;
}

/**
 * Deterministic "worth a second look" flags. They are hints for the worker to re-check typing
 * mistakes, not accusations about the platform.
 */
export function findAnomalies(entries: EarningsEntry[]): Anomaly[] {
  const out: Anomaly[] = [];
  const grosses = entries.map((e) => fromPaise(grossPaise(e))).sort((a, b) => a - b);
  const median = grosses.length ? grosses[Math.floor(grosses.length / 2)]! : 0;
  for (const e of entries) {
    const gross = fromPaise(grossPaise(e));
    const net = fromPaise(netPaise(e));
    if (net < 0) {
      out.push({ entryId: e.id, date: e.date, reason: 'negative_net', detail: `net ₹${net}` });
    } else if (gross > 0 && e.expenses / gross > 0.5) {
      out.push({
        entryId: e.id,
        date: e.date,
        reason: 'high_expense_ratio',
        detail: `expenses are ${Math.round((e.expenses / gross) * 100)}% of gross`,
      });
    }
    if (entries.length >= 4 && median > 0 && gross > median * 3) {
      out.push({
        entryId: e.id,
        date: e.date,
        reason: 'unusually_high_gross',
        detail: `gross ₹${gross} vs typical ₹${median}`,
      });
    }
    if (e.hoursWorked > 16) {
      out.push({
        entryId: e.id,
        date: e.date,
        reason: 'many_hours',
        detail: `${e.hoursWorked} hours in one day`,
      });
    }
  }
  return out;
}

/** CSV cells starting with = + - @ are prefixed so spreadsheets never run them as formulas. */
export function csvCell(value: string | number | undefined): string {
  let s = value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(entries: EarningsEntry[]): string {
  const header = [
    'date',
    'category',
    'platform',
    'hours',
    'base_pay',
    'tips',
    'bonuses',
    'incentives',
    'gross',
    'expenses',
    'deductions',
    'net',
    'data_source',
    'notes',
  ];
  const rows = entries.map((e) =>
    [
      e.date,
      e.category,
      e.platform,
      e.hoursWorked,
      e.basePay,
      e.tips,
      e.bonuses,
      e.incentives,
      fromPaise(grossPaise(e)),
      e.expenses,
      e.deductions,
      fromPaise(netPaise(e)),
      e.source,
      e.notes,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n') + '\n';
}
