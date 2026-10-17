import { defineConfig } from '@playwright/test';

/**
 * Starts the real backend (mock AI, in-memory store, relaxed rate limits) and the real frontend.
 * No API keys or database needed.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run dev -w backend',
      cwd: '..',
      url: 'http://localhost:4100/api/v1/health',
      env: { PORT: '4100', FRONTEND_ORIGINS: 'http://localhost:3100', GEMINI_API_KEY: '', MONGODB_URI: '', AI_RATE_LIMIT: '1000', GENERAL_RATE_LIMIT: '5000', LOGIN_RATE_LIMIT: '1000', AUTH_RATE_LIMIT: '1000', REGISTER_RATE_LIMIT: '1000', DEMO_ACCOUNT_ENABLED: 'true', NODE_ENV: 'development' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx next dev -p 3100',
      url: 'http://localhost:3100',
      env: { NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4100/api/v1', NEXT_DIST_DIR: '.next-e2e' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
