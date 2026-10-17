import type { ZodType } from 'zod';
import { AppError } from '../utils/errors.js';
import type { AIProvider, AIRequest } from './types.js';

export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no json object');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Calls the provider, parses JSON and validates it. One retry on malformed output. Provider
 * failures (timeouts, outages, 5xx) become a clean 503 so the UI can show a retry state.
 */
export async function generateStructured<T>(
  provider: AIProvider,
  req: AIRequest,
  schema: ZodType<T>,
  timeoutMs: number,
): Promise<{ data: T; provider: AIProvider['name']; model: string }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    let model = provider.model;
    try {
      const res = await provider.generate(req, AbortSignal.timeout(timeoutMs));
      text = res.text;
      model = res.model;
    } catch {
      // Detail is deliberately dropped: provider errors can echo prompt fragments.
      throw new AppError(
        503,
        'AI_UNAVAILABLE',
        'The AI service is not available right now. Please try again.',
      );
    }
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return { data: parsed.data, provider: provider.name, model };
    } catch {
      /* fall through to retry */
    }
  }
  throw new AppError(502, 'AI_BAD_OUTPUT', 'The AI returned an unusable answer. Please try again.');
}
