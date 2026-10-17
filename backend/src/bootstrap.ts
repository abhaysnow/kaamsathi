import MongoStore from 'connect-mongo';
import { GeminiProvider } from './ai/geminiProvider.js';
import { MockAIProvider } from './ai/mockProvider.js';
import type { AIProvider } from './ai/types.js';
import { createMailer } from './auth/mailer.js';
import type { AppConfig } from './config/env.js';
import { loadKnowledge } from './knowledge/loader.js';
import { KnowledgeRetrievalService } from './knowledge/retrieval.js';
import { createMemoryRepositories } from './repositories/memory.js';
import { createMongoRepositories } from './repositories/mongo.js';
import { seedDemoUser } from './services/authService.js';
import type { AppContext } from './services/context.js';

export function createProvider(config: AppConfig): AIProvider {
  return config.geminiApiKey
    ? new GeminiProvider(config.geminiApiKey, config.geminiModel)
    : new MockAIProvider();
}

export async function createContext(config: AppConfig): Promise<AppContext> {
  const repos = config.mongoUri
    ? await createMongoRepositories(config.mongoUri)
    : createMemoryRepositories();
  const knowledge = new KnowledgeRetrievalService(
    config.knowledgeDir ? loadKnowledge(config.knowledgeDir) : loadKnowledge(),
  );
  // Sessions live in MongoDB alongside the data (TTL index removes expired ones). Without Mongo,
  // express-session's MemoryStore is used: fine for local demos, never for production (config
  // already refuses production without MONGODB_URI).
  const sessionStore = repos.client
    ? MongoStore.create({
        client: repos.client(),
        collectionName: 'sessions',
        ttl: Math.ceil(config.rememberMeMs / 1000),
      })
    : undefined;
  const ctx: AppContext = {
    config,
    provider: createProvider(config),
    repos,
    knowledge,
    mailer: createMailer(config),
    sessionStore,
  };
  // Idempotent; with in-memory storage this is what makes the demo login exist at all.
  await seedDemoUser(ctx);
  return ctx;
}
