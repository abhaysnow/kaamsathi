import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { AppContext } from './services/context.js';
import { csrfGuard } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { session } from './middleware/session.js';
import { buildRouter } from './routes/index.js';

export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');
  if (ctx.config.isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || ctx.config.frontendOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-KS-Mode'],
    }),
  );
  // Small body limit: the biggest legitimate payload is a complaint of a few KB.
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser(ctx.config.sessionSecret));
  app.use('/api/v1', generalLimiter(Number(process.env.GENERAL_RATE_LIMIT ?? 300)));
  app.use('/api/v1', session(ctx.config), csrfGuard, buildRouter(ctx));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
