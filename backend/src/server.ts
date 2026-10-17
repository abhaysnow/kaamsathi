import { createApp } from './app.js';
import { createContext } from './bootstrap.js';
import { loadConfig } from './config/env.js';
import { logger } from './utils/logger.js';

const config = loadConfig();
const ctx = await createContext(config);
createApp(ctx).listen(config.port, () => {
  logger.info(
    { port: config.port, ai: ctx.provider.name, storage: ctx.repos.kind },
    ctx.provider.name === 'mock'
      ? 'KaamSaathi API up (MOCK AI provider — no GEMINI_API_KEY)'
      : 'KaamSaathi API up',
  );
  if (ctx.repos.kind === 'memory') logger.warn('Using in-memory storage: data is lost on restart');
});
