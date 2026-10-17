import { GoogleGenAI } from '@google/genai';
import type { AIProvider, AIRequest, AIResponse } from './types.js';

/**
 * Google Gemini through the official @google/genai SDK. Server-side only: the key never leaves
 * this process. Every feature asks for exactly one JSON object, so responses are requested as
 * application/json; the caller still validates them with Zod.
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    client?: GoogleGenAI,
  ) {
    this.client = client ?? new GoogleGenAI({ apiKey });
  }

  async generate(req: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [{ text: req.user }] }],
      config: {
        systemInstruction: req.system,
        responseMimeType: 'application/json',
        maxOutputTokens: req.maxTokens,
        temperature: 0.3,
        abortSignal: signal,
      },
    });
    return { text: res.text ?? '', provider: 'gemini', model: this.model };
  }
}
