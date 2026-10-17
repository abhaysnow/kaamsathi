/**
 * Retention policy (documented in SECURITY.md):
 * - demo-sandbox data: deleted 24 hours after the last write. It is fictional, and the sandbox is
 *   unreachable once that demo session ends.
 * - account data: kept until the user deletes it (Settings → Delete all my saved data). It is
 *   never expired silently, because it is the worker's own record.
 */
export const DEMO_RETENTION_MS = 24 * 60 * 60 * 1000;

export function expiresAtFor(ownerId: string, now = Date.now()): Date | undefined {
  return ownerId.startsWith('demo:') ? new Date(now + DEMO_RETENTION_MS) : undefined;
}

/** Mongo update fragment: set the expiry for demo data, never add one to account data. */
export const expirySet = (ownerId: string) => {
  const at = expiresAtFor(ownerId);
  return at ? { expiresAt: at } : {};
};
