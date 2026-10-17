'use client';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calculator,
  Download,
  IndianRupee,
  Info,
  Lightbulb,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAction } from '@/hooks/useAsync';
import { api, apiText } from '@/lib/api';
import { downloadText, rupees, today } from '@/lib/format';
import { WORK_CATEGORIES, type Entry, type Summary } from '@/lib/types';
import {
  EmptyState,
  ErrorBox,
  Field,
  NetChart,
  PageHeader,
  ProviderBadge,
  Spinner,
} from '@/components/ui';

const money = z.number({ error: 'Enter a number' }).min(0).max(1_000_000);
const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(WORK_CATEGORIES),
  platform: z.string().max(60).optional(),
  hoursWorked: z.number({ error: 'Enter hours' }).min(0).max(24),
  basePay: money,
  tips: money,
  bonuses: money,
  incentives: money,
  expenses: money,
  deductions: money,
});
type Form = z.infer<typeof schema>;
type Period = 'day' | 'week' | 'month';

interface Explanation {
  explanation: string;
  tips: string[];
  checkEntries: string[];
  provider: { name: string; model: string; isMock: boolean };
}

const entryNet = (e: Entry) =>
  e.basePay + e.tips + e.bonuses + e.incentives - e.expenses - e.deductions;
const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

function Kpi({
  label: l,
  value,
  accent,
  testId,
}: {
  label: string;
  value: number;
  accent?: boolean;
  testId?: string;
}) {
  return (
    <div className={`card !p-5 ${accent ? '!border-primary/30 !bg-primary-subtle' : ''}`}>
      <dt className="t-support font-medium">{l}</dt>
      <dd className={`t-kpi mt-1.5 ${accent ? 'text-primary' : ''}`} data-testid={testId}>
        {rupees(value)}
      </dd>
    </div>
  );
}

function SourceBadge({ source }: { source: Entry['source'] }) {
  const { t } = useApp();
  return source === 'demo_sample' ? (
    <span className="badge badge-warning">{t('demoSample')}</span>
  ) : (
    <span className="badge badge-primary">{t('userEntered')}</span>
  );
}

export default function EarningsPage() {
  const { t, profile, mode, ready } = useApp();
  const [period, setPeriod] = useState<Period>('week');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today(),
      category: profile.workCategory ?? 'food_delivery',
      hoursWorked: 8,
      basePay: 0,
      tips: 0,
      bonuses: 0,
      incentives: 0,
      expenses: 0,
      deductions: 0,
    },
  });

  // Bumping `version` refetches; stale responses (period/mode changed mid-flight) are dropped.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    Promise.all([
      api<Summary>(`/earnings/summary?period=${period}`),
      api<{ entries: Entry[] }>('/earnings/entries'),
    ])
      .then(([s, e]) => {
        if (!live) return;
        setSummary(s);
        setEntries(e.entries.slice().reverse().slice(0, 10));
        setLoadError(null);
      })
      .catch(() => live && setLoadError('errorOffline'));
    return () => {
      live = false;
    };
  }, [ready, period, mode, version]);

  const save = useAction(async (f: Form) => {
    await api('/earnings/entries', {
      method: 'POST',
      body: { ...f, platform: f.platform || undefined },
    });
    reset({ ...f, basePay: 0, tips: 0, bonuses: 0, incentives: 0, expenses: 0, deductions: 0 });
    setExplanation(null);
    load();
  });
  const del = useAction(async (id: string) => {
    await api(`/earnings/entries/${id}`, { method: 'DELETE' });
    load();
  });
  const exportCsv = useAction(async () => {
    downloadText('kaamsaathi-earnings.csv', await apiText('/earnings/export.csv'), 'text/csv');
  });
  const explain = useAction(async () => {
    setExplanation(
      await api<Explanation>('/earnings/explain', {
        method: 'POST',
        body: { language: profile.language, period },
      }),
    );
  });

  const num = (name: keyof Form) => register(name, { valueAsNumber: true });
  const T = summary?.totals;

  const moneyField = (name: keyof Form, text: string, testId?: string) => (
    <Field label={text} error={errors[name]?.message}>
      <input
        className="input tabular-nums"
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        data-testid={testId}
        aria-invalid={Boolean(errors[name])}
        {...num(name)}
      />
    </Field>
  );

  return (
    <div>
      <PageHeader
        title={t('nav_earnings')}
        subtitle={t('sub_earnings')}
        icon={IndianRupee}
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void exportCsv.run()}
            disabled={exportCsv.loading}
            data-testid="export-csv"
          >
            <Download size={18} aria-hidden />
            {t('exportCsv')}
          </button>
        }
      />

      <div
        role="tablist"
        aria-label={t('nav_earnings')}
        className="mb-6 inline-flex rounded-md border border-border bg-surface p-1"
      >
        {(['day', 'week', 'month'] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            className={`min-h-11 rounded-sm px-4 text-[0.875rem] font-semibold transition-colors ${
              period === p
                ? 'bg-primary text-on-primary'
                : 'text-foreground-muted hover:text-foreground'
            }`}
            onClick={() => setPeriod(p)}
          >
            {t(p === 'day' ? 'today' : p === 'week' ? 'thisWeek' : 'thisMonth')}
          </button>
        ))}
      </div>

      {exportCsv.error && (
        <div className="mb-4">
          <ErrorBox errorKey={exportCsv.error} />
        </div>
      )}
      {loadError && <ErrorBox errorKey={loadError} onRetry={load} />}
      {!summary && !loadError && <Spinner />}

      {T && (
        <section className="space-y-6" data-testid="summary">
          {T.entries === 0 ? (
            <div data-testid="earnings-empty">
              <EmptyState icon={IndianRupee} text={t('empty')} />
            </div>
          ) : (
            <dl className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
              <Kpi label={t('gross')} value={T.gross} testId="gross" />
              <Kpi label={t('expenses')} value={T.expenses} />
              <Kpi label={t('deductions')} value={T.deductions} />
              <Kpi label={t('net')} value={T.net} accent testId="net" />
            </dl>
          )}

          <p className="t-support flex items-start gap-2">
            <Info size={15} aria-hidden className="mt-0.5 shrink-0" />
            {t('formulaNote')}
          </p>

          <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
            {summary.series.length > 0 && (
              <div className="card lg:col-span-7">
                <NetChart series={summary.series} label={t('trend')} />
              </div>
            )}
            <div
              className={`card space-y-4 ${summary.series.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}`}
            >
              <h2 className="t-card">{t('explain')}</h2>
              {summary.anomalies.length > 0 && (
                <ul className="space-y-2">
                  {summary.anomalies.slice(0, 3).map((a) => (
                    <li
                      key={a.entryId + a.reason}
                      className="flex items-start gap-2 text-[0.875rem]"
                    >
                      <Search size={15} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                      <span>
                        <span className="font-semibold">{a.date}</span>: {a.detail}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="btn btn-primary w-full sm:w-auto"
                onClick={() => void explain.run()}
                disabled={explain.loading || T.entries === 0}
              >
                <Calculator size={18} aria-hidden />
                {t('explain')}
              </button>
              {explain.loading && <Spinner />}
              {explain.error && (
                <ErrorBox errorKey={explain.error} onRetry={() => void explain.run()} />
              )}
              {explanation && (
                <div className="panel space-y-2" data-testid="explanation">
                  <p className="whitespace-pre-wrap">{explanation.explanation}</p>
                  {explanation.checkEntries.map((c) => (
                    <p key={c} className="flex gap-2 text-[0.875rem]">
                      <Search size={15} aria-hidden className="mt-0.5 shrink-0" /> {c}
                    </p>
                  ))}
                  {explanation.tips.map((c) => (
                    <p key={c} className="flex gap-2 text-[0.875rem]">
                      <Lightbulb size={15} aria-hidden className="mt-0.5 shrink-0" /> {c}
                    </p>
                  ))}
                  <ProviderBadge provider={explanation.provider} />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 md:gap-6 lg:grid-cols-12">
        <form
          className="card lg:col-span-7"
          onSubmit={handleSubmit((f) => void save.run(f))}
          noValidate
          aria-labelledby="add-h"
        >
          <h2 id="add-h" className="t-section mb-5 flex items-center gap-2">
            <Plus size={20} aria-hidden className="text-primary" />
            {t('addEarnings')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('date')}>
              <input className="input" type="date" {...register('date')} />
            </Field>
            <Field label={t('category')}>
              <select className="input" {...register('category')}>
                {WORK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {label(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('platform')}>
              <input className="input" {...register('platform')} />
            </Field>
            <Field label={t('hours')} error={errors.hoursWorked?.message}>
              <input
                className="input tabular-nums"
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                aria-invalid={Boolean(errors.hoursWorked)}
                {...num('hoursWorked')}
              />
            </Field>
          </div>

          <p className="mt-6 mb-3 text-[0.8125rem] font-semibold tracking-wide text-foreground-muted uppercase">
            {t('gross')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {moneyField('basePay', t('basePay'), 'f-basePay')}
            {moneyField('tips', t('tips'))}
            {moneyField('bonuses', t('bonuses'))}
            {moneyField('incentives', t('incentives'))}
          </div>

          <p className="mt-6 mb-3 text-[0.8125rem] font-semibold tracking-wide text-foreground-muted uppercase">
            {t('expenses')} · {t('deductions')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {moneyField('expenses', `${t('expenses')} (₹)`, 'f-expenses')}
            {moneyField('deductions', `${t('deductions')} (₹)`)}
          </div>

          <div className="mt-6 space-y-3">
            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={save.loading}
              aria-busy={save.loading}
              data-testid="save-entry"
            >
              {t('save')}
            </button>
            {save.error && <ErrorBox errorKey={save.error} />}
          </div>
        </form>

        <section className="card lg:col-span-5" aria-labelledby="entries-h">
          <h2 id="entries-h" className="t-section mb-4">
            {t('entriesTitle')}
          </h2>
          {entries.length === 0 ? (
            <EmptyState text={t('empty')} />
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold tabular-nums">{e.date}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <SourceBadge source={e.source} />
                      <span className="t-support truncate">{label(e.category)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`font-semibold tabular-nums ${entryNet(e) < 0 ? 'text-danger' : ''}`}
                    >
                      {rupees(entryNet(e))}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon text-foreground-muted hover:text-danger"
                      onClick={() => void del.run(e.id)}
                      aria-label={`${t('delete')} ${e.date}`}
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {del.error && <ErrorBox errorKey={del.error} />}
        </section>
      </div>
    </div>
  );
}
