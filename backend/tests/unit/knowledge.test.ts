import { describe, expect, it } from 'vitest';
import { loadKnowledge } from '../../src/knowledge/loader.js';
import {
  filterSchemes,
  KnowledgeRetrievalService,
  tokenize,
} from '../../src/knowledge/retrieval.js';
import { detectEmergency } from '../../src/services/emergency.js';
import { allowedUrls, toCitation } from '../../src/services/citations.js';

const records = loadKnowledge();
const svc = new KnowledgeRetrievalService(records);

describe('knowledge base', () => {
  it('every record has an https source with a check date', () => {
    for (const r of records) {
      expect(r.sources.length).toBeGreaterThan(0);
      for (const s of r.sources) {
        expect(s.url.startsWith('https://')).toBe(true);
        expect(s.linkCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
  it('no record claims to be human reviewed unless it was', () => {
    expect(records.every((r) => r.contentReview === 'pending_human_review')).toBe(true);
  });
  it('citations come from records', () => {
    const c = toCitation(records[0]!);
    expect(c.sources[0]!.url).toBe(records[0]!.sources[0]!.url);
    expect(allowedUrls(records).has('https://eshram.gov.in')).toBe(true);
  });
});

describe('retrieval', () => {
  it('handles romanised Hindi and native script', () => {
    expect(tokenize('Company ne meri payment rok di')).toContain('payment');
    expect(svc.search('Company ne meri payment rok di hai')[0]?.record.id).toBe('payment-dispute');
    expect(svc.search('मुझे दुर्घटना हो गई')[0]?.record.id).toBe('work-accident');
    expect(svc.search('ਮੇਰੀ ਪੈਸੇ ਨਹੀਂ ਮਿਲੇ')[0]?.record.id).toBe('payment-dispute');
  });
  it('returns nothing for unrelated queries (=> could not verify)', () => {
    expect(svc.search('what is the capital of France')).toEqual([]);
    expect(svc.search('')).toEqual([]);
  });
});

describe('scheme filtering', () => {
  it('drops state-specific schemes for other states, keeps national ones', () => {
    const ids = filterSchemes(records, { state: 'Kerala' }).map((m) => m.scheme.id);
    expect(ids).not.toContain('punjab-bocw-welfare');
    expect(ids).toContain('eshram-registration');
  });
  it('includes Punjab construction scheme for Punjab construction workers', () => {
    const ids = filterSchemes(records, { state: 'Punjab', workCategory: 'construction' }).map(
      (m) => m.scheme.id,
    );
    expect(ids).toContain('punjab-bocw-welfare');
  });
  it('excludes by category and age; never says eligible', () => {
    const delivery = filterSchemes(records, { state: 'Punjab', workCategory: 'food_delivery' });
    expect(delivery.map((m) => m.scheme.id)).not.toContain('punjab-bocw-welfare');
    expect(filterSchemes(records, { ageRange: '60_plus' }).map((m) => m.scheme.id)).not.toContain(
      'pm-sym-pension',
    );
    expect(delivery.every((m) => m.label === 'potentially_relevant_verify_eligibility')).toBe(true);
  });
  it('warns when a bank account is missing', () => {
    const m = filterSchemes(records, { hasBankAccount: false }).find(
      (x) => x.scheme.id === 'pm-sym-pension',
    );
    expect(m?.cautions.join(' ')).toContain('bank account');
  });
});

describe('emergency detection', () => {
  it.each(['Mujhe accident ho gaya', 'मुझे दुर्घटना हुई', 'ਮੈਨੂੰ ਹਾਦਸਾ ਹੋ ਗਿਆ'])(
    'detects %s',
    (m) => expect(detectEmergency(m)).toBe(true),
  );
  it('does not fire on normal questions', () =>
    expect(detectEmergency('How do I raise a complaint?')).toBe(false));
});
