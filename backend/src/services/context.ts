import type { AppConfig } from '../config/env.js';
import type { AIProvider } from '../ai/types.js';
import type { KnowledgeRetrievalService } from '../knowledge/retrieval.js';
import type { Repositories } from '../repositories/types.js';

/** Everything services need, injected once. Tests swap in a fake provider and memory repos. */
export interface AppContext {
  config: AppConfig;
  provider: AIProvider;
  repos: Repositories;
  knowledge: KnowledgeRetrievalService;
}
