import { ApiError } from './api';

/** Maps API failures to a translation key so every screen shows the same clear message. */
export function errorKey(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'errorOffline';
    if (e.code === 'RATE_LIMITED') return 'errorRate';
    if (e.code === 'VALIDATION_ERROR') return 'errorInput';
    return 'errorAi';
  }
  return 'errorAi';
}
