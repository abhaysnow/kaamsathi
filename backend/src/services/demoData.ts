import type { EarningsInput } from '../types/domain.js';
import { addDays, todayString } from '../utils/dates.js';
import type { AppContext } from './context.js';

/** All fictional. Demo owners are namespaced ("demo:<sid>") so this can never mix with real data. */
export function demoEntries(today = todayString()): EarningsInput[] {
  const plan = [
    { base: 820, tips: 60, bonus: 0, inc: 150, exp: 310, ded: 40, h: 9 },
    { base: 760, tips: 40, bonus: 0, inc: 0, exp: 290, ded: 55, h: 8.5 },
    { base: 900, tips: 80, bonus: 100, inc: 200, exp: 330, ded: 35, h: 10 },
    { base: 640, tips: 20, bonus: 0, inc: 0, exp: 300, ded: 120, h: 8 },
    { base: 870, tips: 70, bonus: 0, inc: 150, exp: 320, ded: 45, h: 9.5 },
    { base: 540, tips: 0, bonus: 0, inc: 0, exp: 280, ded: 90, h: 7 },
    { base: 950, tips: 90, bonus: 0, inc: 250, exp: 340, ded: 60, h: 10.5 },
  ];
  return plan.map((p, i) => ({
    date: addDays(today, i - 6),
    category: 'food_delivery',
    platform: 'Demo Foods (fictional)',
    hoursWorked: p.h,
    basePay: p.base,
    tips: p.tips,
    bonuses: p.bonus,
    incentives: p.inc,
    expenses: p.exp,
    deductions: p.ded,
    notes: 'Fictional demo entry',
  }));
}

export const DEMO_GRIEVANCE_SCENARIO = {
  type: 'unpaid_incentive' as const,
  platformOrEmployer: 'Demo Foods (fictional)',
  whatHappened:
    'The app showed a weekly incentive of ₹250 for completing 50 orders. I completed the orders but the incentive was not added to my payout.',
  stepsAlreadyTaken: 'I raised a ticket in the app and have not received a reply.',
  evidenceAvailable: [
    'Screenshot of incentive offer',
    'Screenshot of weekly payout',
    'Ticket number',
  ],
  desiredResolution: 'Please review the incentive and credit it if it is due.',
  amountRupees: 250,
};

export const DEMO_QUESTIONS = [
  'Maine aaj kitna kamaya?',
  'Mujhe payment kam kyu mila?',
  'Mere area mein kaunsi government scheme mil sakti hai?',
  'Company ne meri payment rok di hai, ab kya karun?',
  'Mujhe accident ho gaya. Ab mujhe kya karna chahiye?',
  'How can I raise a complaint against a platform?',
];

const inFlight = new Map<string, Promise<void>>();

/**
 * Seeds a demo sandbox once. Called during demo login (before the response, so no later request
 * can race it, even on another serverless instance) and lazily as a fallback. Concurrent calls in
 * one process share a single seeding run instead of each seeing "empty" and seeding again.
 */
export function ensureDemoSeed(ctx: AppContext, ownerId: string): Promise<void> {
  if (!ownerId.startsWith('demo:')) return Promise.resolve();
  const running = inFlight.get(ownerId);
  if (running) return running;
  const run = (async () => {
    if ((await ctx.repos.earnings.list(ownerId)).length > 0) return;
    for (const e of demoEntries()) await ctx.repos.earnings.create(ownerId, e, 'demo_sample');
  })().finally(() => inFlight.delete(ownerId));
  inFlight.set(ownerId, run);
  return run;
}
