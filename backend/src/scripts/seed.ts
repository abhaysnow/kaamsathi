import { loadConfig } from '../config/env.js';
import { loadKnowledge } from '../knowledge/loader.js';

/**
 * Repeatable and side-effect free: validates the curated knowledge files and prints a summary.
 * Knowledge lives in versioned JSON (src/knowledge/data) and is the source of truth; demo data is
 * generated per demo session in memory/DB under a "demo:" owner, so there is nothing to insert here.
 * `--links` re-checks every source URL and prints a table (update linkStatus/linkCheckedOn by hand).
 */
const config = loadConfig();
const records = loadKnowledge(config.knowledgeDir || undefined);
console.log(`OK: ${records.length} knowledge records valid`);
for (const r of records) console.log(` - [${r.kind}] ${r.id} (review: ${r.contentReview})`);

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
