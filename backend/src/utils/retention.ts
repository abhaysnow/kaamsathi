/**
 * Retention policy (documented in SECURITY.md):
 * - demo-session data: 24 hours — it is fictional and only needed for a judging session;
 * - guest-session data: 30 days after the last write — the session cookie lives 30 days, after
 *   which nobody can reach the bucket, so keeping it longer would only retain orphaned data.
 */
export const DEMO_RETENTION_MS = 24 * 60 * 60 * 1000;
export const GUEST_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function expiresAtFor(ownerId: string, now = Date.now()): Date {
  return new Date(now + (ownerId.startsWith('demo:') ? DEMO_RETENTION_MS : GUEST_RETENTION_MS));
}
