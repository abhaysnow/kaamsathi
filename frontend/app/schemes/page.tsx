'use client';
import { useState } from 'react';
import { AlertTriangle, ExternalLink, Landmark, Lock, Search } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAction } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { WORK_CATEGORIES, type Provider, type SchemeResult } from '@/lib/types';
import {
  Citations,
  EmptyState,
  ErrorBox,
  Field,
  PageHeader,
  ProviderBadge,
  Spinner,
} from '@/components/ui';

const STATES = [
  'Punjab',
  'Haryana',
  'Delhi',
  'Uttar Pradesh',
  'Rajasthan',
  'Maharashtra',
  'Gujarat',
  'West Bengal',
  'Tamil Nadu',
  'Telangana',
  'Karnataka',
  'Kerala',
  'Bihar',
  'Other',
];
interface Res {
  intro: string;
  uncertainty: string;
  results: SchemeResult[];
  provider: Provider;
}
const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

function Detail({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <div>
      <p className="mb-1.5 text-[0.875rem] font-semibold">{title}</p>
      <List
        className={`space-y-1 pl-5 text-[0.9375rem] text-foreground-muted ${ordered ? 'list-decimal' : 'list-disc'}`}
      >
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </List>
    </div>
  );
}

function SchemeCard({ s }: { s: SchemeResult }) {
  const { t } = useApp();
  return (
    <article className="card space-y-4" data-testid="scheme-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-info-bg text-info">
            <Landmark size={20} aria-hidden />
          </span>
          <div>
            <h2 className="t-card">{s.name}</h2>
            <p className="badge badge-warning mt-1.5">
              <AlertTriangle size={13} aria-hidden />
              {t('potentially')}
            </p>
          </div>
        </div>
        <a
          className="btn btn-primary btn-sm shrink-0"
          href={s.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('applyOfficial')}
          <ExternalLink size={16} aria-hidden />
        </a>
      </div>

      {s.whyRelevant && <p>{s.whyRelevant}</p>}
      <div className="panel">
        <p className="text-[0.875rem] font-semibold">{t('benefit')}</p>
        <p className="mt-1">{s.benefit}</p>
      </div>

      <details className="group rounded-md border border-border">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">
          {t('eligibility')} · {t('docsNeeded')} · {t('steps')}
        </summary>
        <div className="grid gap-5 border-t border-border p-4 md:grid-cols-3">
          <Detail title={t('eligibility')} items={s.eligibility} />
          <Detail title={t('docsNeeded')} items={s.documents} />
          <Detail title={t('steps')} items={s.applicationSteps} ordered />
        </div>
      </details>

      {s.cautions.map((c) => (
        <p key={c} className="flex gap-2 text-[0.875rem] text-warning">
          <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0" />
          {c}
        </p>
      ))}
      <p className="t-support">{s.availabilityNote}</p>
      <Citations citations={[s.citation]} />
      <p className="t-support">{s.dataNotice}</p>
    </article>
  );
}

export default function SchemesPage() {
  const { t, profile } = useApp();
  const [state, setState] = useState(profile.state ?? 'Punjab');
  const [work, setWork] = useState<string>(profile.workCategory ?? 'food_delivery');
  const [age, setAge] = useState('');
  const [bank, setBank] = useState(true);
  const [res, setRes] = useState<Res | null>(null);

  const search = useAction(async () => {
    setRes(
      await api<Res>('/schemes/search', {
        method: 'POST',
        body: {
          language: profile.language,
          state,
          workCategory: work,
          ageRange: age || undefined,
          hasBankAccount: bank,
        },
      }),
    );
  });

  return (
    <div>
      <PageHeader title={t('nav_schemes')} subtitle={t('sub_schemes')} icon={Landmark} />

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          className="card h-fit space-y-4 lg:sticky lg:top-24 lg:col-span-4"
          onSubmit={(e) => {
            e.preventDefault();
            void search.run();
          }}
        >
          <Field label={t('state')}>
            <select
              className="input"
              value={state}
              onChange={(e) => setState(e.target.value)}
              data-testid="s-state"
            >
              {STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label={t('workType')}>
            <select className="input" value={work} onChange={(e) => setWork(e.target.value)}>
              {WORK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {label(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('age')}>
            <select className="input" value={age} onChange={(e) => setAge(e.target.value)}>
              <option value="">{t('anyAge')}</option>
              <option value="18_40">18–40</option>
              <option value="41_59">41–59</option>
              <option value="60_plus">60+</option>
            </select>
          </Field>
          <label className="flex min-h-11 items-center gap-3 font-medium">
            <input
              type="checkbox"
              className="checkbox"
              checked={bank}
              onChange={(e) => setBank(e.target.checked)}
            />
            {t('hasBank')}
          </label>
          <button
            className="btn btn-primary w-full"
            type="submit"
            disabled={search.loading}
            data-testid="s-search"
          >
            <Search size={18} aria-hidden />
            {t('findSchemes')}
          </button>
          <p className="t-support flex items-start gap-2">
            <Lock size={14} aria-hidden className="mt-0.5 shrink-0" />
            {t('noPII')}
          </p>
        </form>

        <section className="space-y-4 lg:col-span-8" aria-live="polite">
          {search.loading && <Spinner />}
          {search.error && <ErrorBox errorKey={search.error} onRetry={() => void search.run()} />}
          {!res && !search.loading && !search.error && (
            <EmptyState icon={Search} text={t('sub_schemes')} />
          )}
          {res && (
            <>
              <div className="card space-y-2 !bg-primary-subtle">
                <p className="font-medium">{res.intro}</p>
                <p className="t-support">{res.uncertainty}</p>
                <ProviderBadge provider={res.provider} />
              </div>
              {res.results.length === 0 && <EmptyState text={t('noResults')} />}
              {res.results.map((s) => (
                <SchemeCard key={s.id} s={s} />
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
