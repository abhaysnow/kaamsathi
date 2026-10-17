'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Megaphone,
  Phone,
  Search,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { api } from '@/lib/api';
import type { Citation, KnowledgeRecord } from '@/lib/types';
import { Citations, EmptyState, ErrorBox, PageHeader, Spinner } from '@/components/ui';

const toCitation = (r: KnowledgeRecord): Citation => ({
  id: r.id,
  title: r.title,
  scope: r.scope,
  contentReview: r.contentReview,
  limitations: r.limitations,
  sources: r.sources,
});

function RightsCard({ r }: { r: KnowledgeRecord }) {
  const { t } = useApp();
  return (
    <article className="card space-y-4" data-testid="rights-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="t-card">{r.title}</h2>
        <span className={`badge ${r.scope === 'emergency' ? 'badge-danger' : 'badge-neutral'}`}>
          {t(`scope_${r.scope}`)}
        </span>
      </div>
      <p className="text-foreground-muted">{r.summary}</p>

      {r.steps.length > 0 && (
        <div>
          <p className="mb-2 text-[0.875rem] font-semibold">{t('whatToDo')}</p>
          <ol className="space-y-2">
            {r.steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-light text-[0.75rem] font-bold text-primary-hover">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {r.channels.length > 0 && (
        <div className="panel">
          <p className="mb-2 flex items-center gap-2 text-[0.875rem] font-semibold">
            <Megaphone size={16} aria-hidden /> {t('whereToRaise')}
          </p>
          <ul className="space-y-1.5 text-[0.9375rem]">
            {r.channels.map((c) => (
              <li key={c.name} className="prose-wrap">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {c.name} <ExternalLink size={13} aria-hidden />
                  </a>
                ) : (
                  <span className="font-semibold">{c.name}</span>
                )}{' '}
                <span className="text-foreground-muted">— {c.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Citations citations={[toCitation(r)]} />
      <Link href="/ask" className="btn btn-secondary btn-sm">
        {t('askAboutThis')} <ArrowRight size={16} aria-hidden />
      </Link>
    </article>
  );
}

export default function RightsPage() {
  const { t } = useApp();
  const [records, setRecords] = useState<KnowledgeRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    api<{ records: KnowledgeRecord[] }>('/knowledge/sources')
      .then((r) => {
        if (!live) return;
        setRecords(r.records.filter((k) => k.kind === 'rights'));
        setError(null);
      })
      .catch(() => live && setError('errorOffline'));
    return () => {
      live = false;
    };
  }, [version]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!records || !q) return records ?? [];
    return records.filter((r) =>
      [r.title, r.summary, r.topic ?? '', ...r.steps].join(' ').toLowerCase().includes(q),
    );
  }, [records, query]);

  return (
    <div>
      <PageHeader title={t('nav_rights')} subtitle={t('sub_rights')} icon={ShieldCheck} />

      <div
        role="note"
        className="mb-6 flex flex-col gap-3 rounded-lg bg-danger px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-center gap-2.5 font-semibold">
          <Siren size={20} aria-hidden className="shrink-0" />
          {t('emergencyHelp')}
        </p>
        <a href="tel:112" className="btn btn-sm bg-white text-danger">
          <Phone size={16} aria-hidden /> {t('call112')}
        </a>
      </div>

      <label className="relative mb-6 block max-w-xl">
        <span className="sr-only">{t('rightsSearch')}</span>
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-foreground-muted"
        />
        <input
          type="search"
          className="input !pl-10"
          placeholder={t('rightsSearch')}
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="rights-search"
        />
      </label>

      {error && <ErrorBox errorKey={error} onRetry={() => setVersion((v) => v + 1)} />}
      {!records && !error && <Spinner />}
      {records && shown.length === 0 && <EmptyState icon={Search} text={t('noResults')} />}
      <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
        {shown.map((r) => (
          <RightsCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}
