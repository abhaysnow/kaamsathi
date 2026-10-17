export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'AI_BAD_OUTPUT'
  | 'CSRF_REJECTED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

/** Errors that are safe to show to API clients. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
