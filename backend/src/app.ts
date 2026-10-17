import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppContext } from './services/context.js';
import { csrfGuard } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { loadUser, sessionMiddleware } from './middleware/session.js';
import { buildAuthRouter } from './routes/auth.js';
import { buildRouter } from './routes/index.js';

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  // Number of reverse proxies in front of the API (Vercel edge = 1; behind the frontend's proxy = 2).
  // Needed so rate limits see each user's IP and Secure cookies see HTTPS.
  if (ctx.config.trustProxyHops > 0) app.set('trust proxy', ctx.config.trustProxyHops);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || ctx.config.frontendOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
    }),
  );
  // Small body limit: the biggest legitimate payload is a complaint of a few KB.
  app.use(express.json({ limit: '32kb' }));
  app.use(
    '/api/v1',
    sessionMiddleware(ctx.config, ctx.sessionStore),
    loadUser(ctx.repos, ctx.config),
    generalLimiter(Number(process.env.GENERAL_RATE_LIMIT ?? 300)),
    csrfGuard(ctx.config.frontendOrigins),
    buildAuthRouter(ctx),
    buildRouter(ctx),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
