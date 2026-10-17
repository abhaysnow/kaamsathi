import type { KnowledgeRecord, SchemeRecord } from './schema.js';

/**
 * Romanised / transliterated words workers commonly type, mapped to the English keywords used
 * in the knowledge base. Native-script words (Devanagari, Gurmukhi…) are matched directly via
 * each record's keyword list, so only Latin-script variants need a map.
 */
const TRANSLIT: Record<string, string[]> = {
  bhugtan: ['payment'],
  paisa: ['payment'],
  paise: ['payment'],
  kamaya: ['earnings'],
  shikayat: ['complaint'],
  shikayat_: ['complaint'],
  durghatna: ['accident'],
  haadsa: ['accident'],
  chot: ['injury'],
  yojana: ['scheme'],
  yojna: ['scheme'],
  sarkari: ['scheme'],
  bima: ['insurance'],
  ilaj: ['health'],
  vakil: ['legal'],
  dhokha: ['fraud'],
  dhamki: ['threat'],
  suraksha: ['safety'],
  mazdoor: ['construction'],
  majdoor: ['construction'],
  pension: ['pension'],
  rok: ['withheld'],
  band: ['suspended'],
  block: ['suspended'],
};

const STOP = new Set([
  'the',
  'a',
  'an',
  'is',
  'to',
  'of',
  'in',
  'my',
  'me',
  'i',
  'and',
  'for',
  'how',
  'can',
  'what',
  'do',
  'on',
  'ko',
  'ka',
  'ki',
  'ke',
  'hai',
  'mein',
  'se',
  'ne',
  'kya',
  'ab',
]);

export function tokenize(input: string): string[] {
  const raw = input.toLowerCase().match(/[\p{L}\p{M}\p{N}-]+/gu) ?? [];
  const out = new Set<string>();
  for (const w of raw) {
    if (STOP.has(w) || w.length < 2) continue;
    out.add(w);
    for (const t of TRANSLIT[w] ?? []) out.add(t);
  }
  return [...out];
}

export interface ScoredRecord {
  record: KnowledgeRecord;
  score: number;
}

export interface SearchOptions {
  kinds?: Array<KnowledgeRecord['kind']>;
  limit?: number;
  /** Minimum score; below this we say "could not verify" instead of guessing. */
  minScore?: number;
}

export class KnowledgeRetrievalService {
  constructor(private readonly records: KnowledgeRecord[]) {}

  all(): KnowledgeRecord[] {
    return this.records;
  }

  byId(id: string): KnowledgeRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /** Transparent keyword scoring: keyword hit = 3, title hit = 2, summary hit = 1. */
  search(query: string, opts: SearchOptions = {}): ScoredRecord[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const { kinds, limit = 3, minScore = 3 } = opts;
    const scored: ScoredRecord[] = [];
    for (const record of this.records) {
      if (kinds && !kinds.includes(record.kind)) continue;
      const kw = record.keywords.map((k) => k.toLowerCase());
      const title = record.title.toLowerCase();
      const summary = record.summary.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (
          kw.some(
            (k) => k === t || (t.length >= 4 && k.includes(t)) || (k.length >= 4 && t.includes(k)),
          )
        )
          score += 3;
        if (title.includes(t)) score += 2;
        if (t.length >= 4 && summary.includes(t)) score += 1;
      }
      if (score >= minScore) scored.push({ record, score });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export type AgeRange = 'under_18' | '18_40' | '41_59' | '60_plus';
const AGE_BOUNDS: Record<AgeRange, [number, number]> = {
  under_18: [0, 17],
  '18_40': [18, 40],
  '41_59': [41, 59],
  '60_plus': [60, 120],
};

export interface SchemeFilter {
  state?: string;
  workCategory?: string;
  ageRange?: AgeRange;
  hasBankAccount?: boolean;
}

export interface SchemeMatch {
  scheme: SchemeRecord;
  /** Never "eligible": only the official portal can confirm that. */
  label: 'potentially_relevant_verify_eligibility';
  reasons: string[];
  cautions: string[];
}

/**
 * Deterministic exclusion filter. A scheme is dropped only when a hard, stated bound clearly
 * rules the worker out (wrong state, wrong category, age band does not overlap). Everything
 * else is returned as "Potentially relevant — verify eligibility". AI never decides this.
 */
export function filterSchemes(records: KnowledgeRecord[], f: SchemeFilter): SchemeMatch[] {
  const matches: SchemeMatch[] = [];
  for (const r of records) {
    if (r.kind !== 'scheme') continue;
    const reasons: string[] = [];
    const cautions: string[] = [];

    if (r.states !== 'ALL') {
      if (!f.state)
        cautions.push(`Only for: ${r.states.join(', ')}. Tell us your state to confirm.`);
      else if (!r.states.some((s) => s.toLowerCase() === f.state!.toLowerCase())) continue;
      else reasons.push(`Available for ${f.state}`);
    }
    if (r.workerCategories !== 'ALL') {
      if (!f.workCategory)
        cautions.push('Meant for specific kinds of work. Tell us your work type to confirm.');
      else if (!r.workerCategories.includes(f.workCategory)) continue;
      else reasons.push('Matches your type of work');
    }
    if (r.age && f.ageRange) {
      const [lo, hi] = AGE_BOUNDS[f.ageRange];
      const overlaps = (r.age.min ?? 0) <= hi && (r.age.max ?? 200) >= lo;
      if (!overlaps) continue;
      cautions.push(
        'Your age band overlaps the stated range; exact age rules are on the official site.',
      );
    }
    if (r.requiresBankAccount && f.hasBankAccount === false) {
      cautions.push('Needs a bank account, which you said you do not have yet.');
    }
    if (reasons.length === 0) reasons.push('General scheme for unorganised workers');
    matches.push({
      scheme: r,
      label: 'potentially_relevant_verify_eligibility',
      reasons,
      cautions,
    });
  }
  return matches;
}
