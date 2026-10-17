import { pino } from 'pino';

/**
 * Structured logger. Request bodies, prompts, cookies and auth headers are never logged:
 * they can contain personal details (complaints, earnings, names). The redact list is a
 * second line of defence in case someone logs an object by mistake.
 */
export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      '*.password',
      '*.apiKey',
      '*.prompt',
      '*.body',
      '*.message',
      '*.whatHappened',
    ],
    censor: '[REDACTED]',
  },
});
