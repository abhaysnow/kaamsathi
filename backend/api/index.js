/**
 * Vercel serverless entry point. Imports the compiled app (npm run build → dist/) so Vercel runs
 * plain JavaScript. The context (MongoDB connection, session store, demo seed) is created once per
 * warm instance and reused across requests.
 */
import { createApp } from '../dist/app.js';
import { createContext } from '../dist/bootstrap.js';
import { loadConfig } from '../dist/config/env.js';

let appPromise;

export default async function handler(req, res) {
  try {
    // Inside try: loadConfig() throws synchronously on missing production settings.
    appPromise ??= createContext(loadConfig()).then(createApp);
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    // Startup failed (bad config, database unreachable): log the reason only, retry next request.
    console.error('startup failed:', err instanceof Error ? err.message.split('\n')[0] : 'unknown');
    appPromise = undefined;
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'Service is starting. Please try again.' },
      }),
    );
  }
}
