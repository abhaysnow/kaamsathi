import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeFileSchema, type KnowledgeRecord } from './schema.js';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');

/**
 * Loads every *.json file in the knowledge directory and validates it against the schema.
 * To update guidance, edit or add a JSON file — no code change. A malformed record fails the
 * server at startup rather than being silently served to workers.
 */
export function loadKnowledge(dir: string = DEFAULT_DIR): KnowledgeRecord[] {
  const records: KnowledgeRecord[] = [];
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const raw: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const parsed = knowledgeFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid knowledge file ${file}: ${parsed.error.message}`);
    }
    records.push(...parsed.data);
  }
  const ids = new Set<string>();
  for (const r of records) {
    if (ids.has(r.id)) throw new Error(`Duplicate knowledge id: ${r.id}`);
    ids.add(r.id);
  }
  return records;
}
