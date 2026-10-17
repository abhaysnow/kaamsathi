import type { GoogleGenAI } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../../src/ai/geminiProvider.js';
import { createProvider } from '../../src/bootstrap.js';
import { loadConfig } from '../../src/config/env.js';
import { TEST_ENV } from '../helpers/app.js';

const fakeClient = (generateContent: ReturnType<typeof vi.fn>) =>
  ({ models: { generateContent } }) as unknown as GoogleGenAI;

describe('GeminiProvider', () => {
  it('sends the system prompt separately, asks for JSON, and caps output tokens', async () => {
    const generateContent = vi.fn().mockResolvedValue({ text: '{"answer":"ok"}' });
    const signal = new AbortController().signal;
    const p = new GeminiProvider('key', 'gemini-test', fakeClient(generateContent));
    const res = await p.generate(
      {
        feature: 'chat',
        language: 'hi',
        system: 'SYSTEM RULES',
        user: 'USER DATA',
        maxTokens: 321,
        mockContext: { secret: 1 },
      },
      signal,
    );
    expect(res).toEqual({ text: '{"answer":"ok"}', provider: 'gemini', model: 'gemini-test' });
    const arg = generateContent.mock.calls[0]![0];
    expect(arg.model).toBe('gemini-test');
    expect(arg.contents).toEqual([{ role: 'user', parts: [{ text: 'USER DATA' }] }]);
    expect(arg.config).toMatchObject({
      systemInstruction: 'SYSTEM RULES',
      responseMimeType: 'application/json',
      maxOutputTokens: 321,
      abortSignal: signal,
    });
    // Mock-only context is never sent to Google.
    expect(JSON.stringify(arg)).not.toContain('secret');
  });

  it('returns empty text (then schema validation fails cleanly) when Gemini returns no text', async () => {
    const p = new GeminiProvider(
      'key',
      'm',
      fakeClient(vi.fn().mockResolvedValue({ text: undefined })),
    );
    expect(
      (await p.generate({ feature: 'chat', language: 'en', system: '', user: '', maxTokens: 10 }))
        .text,
    ).toBe('');
  });

  it('is used only when GEMINI_API_KEY is set; otherwise the labelled mock', () => {
    expect(createProvider(loadConfig(TEST_ENV)).name).toBe('mock');
    const p = createProvider(
      loadConfig({ ...TEST_ENV, GEMINI_API_KEY: 'k', GEMINI_MODEL: 'gemini-x' }),
    );
    expect(p.name).toBe('gemini');
    expect(p.model).toBe('gemini-x');
  });
});
