import type { KnowledgeRecord } from '../knowledge/schema.js';

export interface Citation {
  id: string;
  title: string;
  kind: 'rights' | 'scheme';
  scope: string;
  contentReview: string;
  limitations: string[];
  sources: Array<{ name: string; url: string; linkStatus: string; linkCheckedOn: string }>;
}

/** Citations come from the curated record, never from model text. */
export function toCitation(r: KnowledgeRecord): Citation {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind,
    scope: r.scope,
    contentReview: r.contentReview,
    limitations: r.limitations,
    sources: r.sources.map((s) => ({ ...s })),
  };
}

export const allowedUrls = (records: KnowledgeRecord[]): Set<string> => {
  const set = new Set<string>();
  for (const r of records) {
    for (const s of r.sources) set.add(s.url);
    if (r.kind === 'scheme') set.add(r.applyUrl);
    if (r.kind === 'rights') for (const c of r.channels) if (c.url) set.add(c.url);
  }
  return set;
};
