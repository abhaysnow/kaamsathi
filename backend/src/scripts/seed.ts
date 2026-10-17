import { loadConfig } from '../config/env.js';
import { loadKnowledge } from '../knowledge/loader.js';
import { createMongoRepositories } from '../repositories/mongo.js';
import { seedDemoUser } from '../services/authService.js';
import type { AppContext } from '../services/context.js';

/**
 * Repeatable: validates the curated knowledge files and provisions the demo account.
 * Demo account: created or updated in place (same email, unique index), never duplicated, and
 * only when DEMO_ACCOUNT_ENABLED allows it (default: on in development, OFF in production).
 * Knowledge lives in versioned JSON (src/knowledge/data) and is the source of truth; demo data is
 * generated per demo session in memory/DB under a "demo:" owner, so there is nothing to insert here.
 * `--links` re-checks every source URL and prints a table (update linkStatus/linkCheckedOn by hand).
 */
const config = loadConfig();
const records = loadKnowledge(config.knowledgeDir || undefined);
console.log(`OK: ${records.length} knowledge records valid`);
for (const r of records) console.log(` - [${r.kind}] ${r.id} (review: ${r.contentReview})`);

if (!config.demo.enabled) {
  console.log('Demo account: disabled by configuration (DEMO_ACCOUNT_ENABLED). Nothing created.');
} else if (!config.mongoUri) {
  console.log('Demo account: in-memory mode, so it is provisioned each time the server starts.');
} else {
  const repos = await createMongoRepositories(config.mongoUri);
  const res = await seedDemoUser({ config, repos } as unknown as AppContext);
  console.log(
    `Demo account ${res?.created ? 'created' : 'updated'}: ${res?.user.email} (role: demo)`,
  );
  await repos.close?.();
}

if (process.argv.includes('--links')) {
  const urls = new Set(records.flatMap((r) => r.sources.map((s) => s.url)));
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      console.log(`${res.status} ${url}`);
    } catch {
      console.log(`ERR ${url}`);
    }
  }
}
