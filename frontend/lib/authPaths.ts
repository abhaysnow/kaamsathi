export const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

export const isPublicPath = (path: string) =>
  PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Only same-site relative paths are allowed as a post-login destination. Anything else
 * ("//evil.example", "https://…", "/\\evil", or a public auth page) falls back to the dashboard,
 * so the ?next= parameter cannot be used as an open redirect.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  if (/[\u0000-\u001f]/.test(next)) return '/';
  return isPublicPath(next.split('?')[0]!) ? '/' : next;
}
