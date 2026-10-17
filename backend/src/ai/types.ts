import type { Language } from '../types/domain.js';

export type AIFeature =
  | 'chat'
  | 'explain_earnings'
  | 'scheme_guidance'
  | 'document_checklist'
  | 'document_draft'
  | 'grievance';

export interface AIRequest {
  feature: AIFeature;
  language: Language;
  system: string;
  /** Contains untrusted text only inside delimited, sanitised blocks. */
  user: string;
  maxTokens: number;
  /**
   * Structured facts used ONLY by MockAIProvider to build a deterministic reply. Real providers
   * must ignore it (it is never sent to Anthropic).
   */
  mockContext?: unknown;
}

export interface AIResponse {
  text: string;
  provider: 'anthropic' | 'mock';
  model: string;
}

export interface AIProvider {
  readonly name: 'anthropic' | 'mock';
  readonly model: string;
  generate(req: AIRequest, signal?: AbortSignal): Promise<AIResponse>;
}
