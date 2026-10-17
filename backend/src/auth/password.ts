import argon2 from 'argon2';

/**
 * Argon2id via the `argon2` package (libargon2 bindings). "standard" uses the library's
 * defaults (64 MiB, t=3, p=4), which meet OWASP's minimum. "fast" exists only so the test suite
 * does not spend seconds hashing; config refuses it in production.
 */
const PROFILES = {
  standard: { type: argon2.argon2id },
  fast: { type: argon2.argon2id, memoryCost: 4096, timeCost: 2, parallelism: 1 },
} as const;
export type HashProfile = keyof typeof PROFILES;

export function hashPassword(password: string, profile: HashProfile = 'standard'): Promise<string> {
  return argon2.hash(password, PROFILES[profile]);
}

/** Never throws on a malformed hash: a corrupt record must fail closed, not crash login. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;
/**
 * A real hash of a random value, verified when the email is unknown so that "no such user" and
 * "wrong password" take comparable time and cannot be told apart by timing.
 */
export function dummyHash(profile: HashProfile = 'standard'): Promise<string> {
  dummy ??= hashPassword(`dummy-${Math.random()}`, profile);
  return dummy;
}

/** Trim, Unicode-normalise and lowercase so "Demo@WorkWise.ai " and "demo@workwise.ai" match. */
export const normalizeEmail = (email: string) => email.normalize('NFKC').trim().toLowerCase();

/** Kept deliberately simple and explainable to users: length plus a letter and a digit. */
export const PASSWORD_RULES = { min: 8, max: 128 } as const;
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_RULES.min) return `Use at least ${PASSWORD_RULES.min} characters`;
  if (pw.length > PASSWORD_RULES.max) return `Use at most ${PASSWORD_RULES.max} characters`;
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number';
  return null;
}
