import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api';
import { errorKey } from '@/lib/errors';
import { rupees } from '@/lib/format';
import { tr } from '@/lib/i18n';

describe('errorKey', () => {
  it('maps network failures to the offline message', () => {
    expect(errorKey(new ApiError(0, 'NETWORK', 'offline'))).toBe('errorOffline');
  });
  it('maps rate limits and validation errors to their own messages', () => {
    expect(errorKey(new ApiError(429, 'RATE_LIMITED', 'x'))).toBe('errorRate');
    expect(errorKey(new ApiError(400, 'VALIDATION_ERROR', 'x'))).toBe('errorInput');
  });
  it('treats provider outages and unknown errors as AI unavailable', () => {
    expect(errorKey(new ApiError(503, 'AI_UNAVAILABLE', 'x'))).toBe('errorAi');
    expect(errorKey(new Error('boom'))).toBe('errorAi');
  });
});

describe('tr (UI translations)', () => {
  it('returns the selected language when translated', () => {
    expect(tr('hi', 'nav_earnings')).toBe('कमाई');
    expect(tr('pa', 'nav_earnings')).toBe('ਕਮਾਈ');
  });
  it('falls back to English for missing keys and untranslated languages', () => {
    expect(tr('pa', 'exportCsv')).toBe(tr('en', 'exportCsv'));
    expect(tr('ta', 'send')).toBe('Send');
  });
  it('returns the key itself rather than crashing on unknown keys', () => {
    expect(tr('en', 'no_such_key')).toBe('no_such_key');
  });
});

describe('rupees', () => {
  it('uses Indian digit grouping', () => {
    expect(rupees(123456.5)).toBe('₹1,23,456.5');
  });
});
