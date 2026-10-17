import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, AIRequest, AIResponse } from './types.js';

/** Server-side only. The key never leaves this process. */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 1 });
  }

  async generate(req: AIRequest, signal?: AbortSignal): Promise<AIResponse> {
    const msg = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      },
      { signal },
    );
    const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    return { text, provider: 'anthropic', model: this.model };
  }
}
