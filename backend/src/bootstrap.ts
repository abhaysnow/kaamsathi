import { AnthropicProvider } from './ai/anthropicProvider.js';
import { MockAIProvider } from './ai/mockProvider.js';
import type { AIProvider } from './ai/types.js';
import type { AppConfig } from './config/env.js';
import { loadKnowledge } from './knowledge/loader.js';
import { KnowledgeRetrievalService } from './knowledge/retrieval.js';
import { createMemoryRepositories } from './repositories/memory.js';
import { createMongoRepositories } from './repositories/mongo.js';
import type { AppContext } from './services/context.js';

export function createProvider(config: AppConfig): AIProvider {
  return config.anthropicApiKey
    ? new AnthropicProvider(config.anthropicApiKey, config.anthropicModel)
    : new MockAIProvider();
}

export async function createContext(config: AppConfig): Promise<AppContext> {
  const repos = config.mongoUri
    ? await createMongoRepositories(config.mongoUri)
    : createMemoryRepositories();
  const knowledge = new KnowledgeRetrievalService(
    config.knowledgeDir ? loadKnowledge(config.knowledgeDir) : loadKnowledge(),
  );
  return { config, provider: createProvider(config), repos, knowledge };
}
