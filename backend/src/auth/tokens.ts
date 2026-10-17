import { createHash, randomBytes } from 'node:crypto';

/**
 * Password-reset tokens: 32 random bytes (256 bits) from the OS CSPRNG, sent to the user once.
 * Only the SHA-256 digest is stored, so a database leak does not expose usable tokens. A fast
 * hash is fine here (unlike passwords) because the input has full entropy.
 */
export function createResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** base64url of 32 bytes is exactly 43 characters. */
export const RESET_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
