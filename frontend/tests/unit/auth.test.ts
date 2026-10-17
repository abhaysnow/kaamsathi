import { describe, expect, it } from 'vitest';
import { isPublicPath, safeNext } from '@/lib/authPaths';
import {
  DEMO_CREDENTIALS,
  authErrorKey,
  loginSchema,
  registerSchema,
  resetSchema,
} from '@/lib/authSchemas';

const issues = (r: { success: boolean; error?: { issues: Array<{ message: string }> } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.message);

describe('login form validation', () => {
  it('accepts the prefilled demo credentials as-is', () => {
    expect(loginSchema.safeParse({ ...DEMO_CREDENTIALS, remember: false }).success).toBe(true);
  });
  it('flags missing or malformed fields with translatable messages', () => {
    expect(issues(loginSchema.safeParse({ email: '', password: '', remember: false }))).toEqual(
      expect.arrayContaining(['v_email', 'v_password']),
    );
    expect(
      issues(loginSchema.safeParse({ email: 'nope', password: 'x', remember: false })),
    ).toEqual(['v_email']);
  });
});

describe('new-password rules match the server', () => {
  it.each(['short1', 'onlyletters', '12345678'])('rejects %s', (pw) => {
    expect(resetSchema.safeParse({ password: pw }).success).toBe(false);
  });
  it('accepts a compliant password and requires a name on registration', () => {
    expect(resetSchema.safeParse({ password: 'Strong-pass-9' }).success).toBe(true);
    expect(
      issues(registerSchema.safeParse({ name: ' ', email: 'a@b.test', password: 'Strong-pass-9' })),
    ).toEqual(['v_name']);
  });
});

describe('post-login redirect safety', () => {
  it.each([
    [null, '/'],
    ['/earnings', '/earnings'],
    ['/earnings?period=week', '/earnings?period=week'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    ['/\\evil.example', '/'],
    ['/login', '/'],
    ['/reset-password?token=x', '/'],
  ])('safeNext(%s) => %s', (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
  it('knows which pages are public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/forgot-password')).toBe(true);
    expect(isPublicPath('/earnings')).toBe(false);
    expect(isPublicPath('/loginx')).toBe(false);
  });
});

describe('auth error messages', () => {
  it('maps server codes to user-facing translation keys', () => {
    expect(authErrorKey('INVALID_CREDENTIALS')).toBe('errorLogin');
    expect(authErrorKey('RATE_LIMITED')).toBe('errorRate');
    expect(authErrorKey('NETWORK')).toBe('errorOffline');
    expect(authErrorKey('SOMETHING_ELSE')).toBe('errorAi');
  });
});
