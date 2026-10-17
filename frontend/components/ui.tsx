'use client';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  FlaskConical,
  Inbox,
  Loader2,
  RotateCcw,
  Sparkles,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { rupees } from '@/lib/format';
import type { Citation, Provider } from '@/lib/types';

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <span className="mt-0.5 hidden size-11 shrink-0 place-items-center rounded-md bg-primary-light text-primary sm:grid">
            <Icon size={22} aria-hidden />
          </span>
        )}
        <div>
          <h1 className="t-page">{title}</h1>
          {subtitle && <p className="mt-1 text-foreground-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Mock output is always labelled as such; it must never pass for a live model. */
export function ProviderBadge({ provider }: { provider: Provider }) {
  const { t } = useApp();
  return provider.isMock ? (
    <span data-testid="provider-badge" className="badge badge-warning">
      <FlaskConical size={13} aria-hidden />
      {t('mockBadge')}
    </span>
  ) : (
    <span data-testid="provider-badge" className="badge badge-primary">
      <Sparkles size={13} aria-hidden />
      {t('liveBadge')} · {provider.model}
    </span>
  );
}

export function ErrorBox({ errorKey, onRetry }: { errorKey: string; onRetry?: () => void }) {
  const { t } = useApp();
  const Icon = errorKey === 'errorOffline' ? WifiOff : AlertTriangle;
  return (
    <div
      role="alert"
      data-testid="error-box"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#f1c4c0] bg-danger-bg px-4 py-3 text-danger"
    >
      <span className="flex items-center gap-2.5 font-medium">
        <Icon size={18} aria-hidden className="shrink-0" />
        {t(errorKey)}
      </span>
      {onRetry && (
        <button type="button" className="btn btn-danger btn-sm" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden />
          {t('retry')}
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useApp();
  return (
    <p role="status" className="flex items-center gap-2 text-foreground-muted">
      <Loader2 size={18} className="animate-spin" aria-hidden />
      {label ?? t('loading')}
    </p>
  );
}

export function EmptyState({ icon: Icon = Inbox, text }: { icon?: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center text-foreground-muted">
      <Icon size={22} aria-hidden className="text-foreground-subtle" />
      <p>{text}</p>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 flex items-center gap-1 text-[0.8125rem] font-medium text-danger">
          <AlertTriangle size={14} aria-hidden />
          {error}
        </span>
      ) : (
        hint && <span className="t-support mt-1 block">{hint}</span>
      )}
    </label>
  );
}

export function Notice({
  tone = 'warning',
  icon: Icon = AlertTriangle,
  children,
}: {
  tone?: 'warning' | 'info' | 'success';
  icon?: LucideIcon;
  children: ReactNode;
}) {
  const cls = {
    warning: 'bg-warning-bg text-warning',
    info: 'bg-info-bg text-info',
    success: 'bg-success-bg text-success',
  }[tone];
  return (
    <div role="note" className={`flex items-start gap-2.5 rounded-md px-4 py-3 font-medium ${cls}`}>
      <Icon size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Citations({ citations }: { citations: Citation[] }) {
  const { t } = useApp();
  if (!citations.length) return null;
  return (
    <section
      aria-label={t('sources')}
      data-testid="citations"
      className="mt-4 border-t border-border pt-4"
    >
      <p className="mb-2 text-[0.8125rem] font-semibold tracking-wide text-foreground-muted uppercase">
        {t('sources')}
      </p>
      <ul className="space-y-3">
        {citations.map((c) => (
          <li key={c.id} className="text-[0.875rem]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{c.title}</span>
              <span className="badge badge-neutral">{t(`scope_${c.scope}`)}</span>
            </div>
            <ul className="mt-1 space-y-1">
              {c.sources.map((s) => (
                <li key={s.url} className="prose-wrap">
                  <a
                    className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.name}
                    <ExternalLink size={13} aria-hidden />
                  </a>
                  <span className="t-support">
                    {' '}
                    · {t('verifiedOn')} {s.linkCheckedOn}
                    {s.linkStatus !== 'reachable' ? ' (not reachable by checker)' : ''} ·{' '}
                    {t('reviewPending')}
                  </span>
                </li>
              ))}
            </ul>
            {c.limitations.map((l) => (
              <p key={l} className="t-support mt-1 flex gap-1.5">
                <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0" />
                {l}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

const niceMax = (n: number) => {
  if (n <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / pow) * pow;
};

/**
 * Daily net earnings. Minimal gridlines, labelled axes, and a visually hidden table so screen
 * readers get the exact values rather than a picture.
 */
export function NetChart({
  series,
  label,
}: {
  series: Array<{ date: string; net: number }>;
  label: string;
}) {
  const { t } = useApp();
  const max = niceMax(Math.max(...series.map((s) => Math.abs(s.net))));
  const ticks = [max, max / 2, 0];
  return (
    <figure>
      <figcaption className="t-card mb-3">{label}</figcaption>
      <div aria-hidden className="flex gap-2">
        <div className="flex h-44 flex-col justify-between pb-6 text-right text-[0.75rem] text-foreground-muted tabular-nums">
          {ticks.map((v) => (
            <span
              key={v}
              className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0"
            >
              {rupees(v)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((v) => (
              <div
                key={v}
                className={`border-t ${v === 0 ? 'border-border' : 'border-dashed border-border/70'}`}
              />
            ))}
          </div>
          <div className="relative flex h-44 items-end gap-1.5 sm:gap-3">
            {series.map((s) => (
              <div key={s.date} className="flex h-full flex-1 flex-col items-center justify-end">
                <div className="flex w-full flex-1 items-end justify-center pb-0">
                  <div
                    className={`w-full max-w-10 rounded-t-[6px] ${s.net < 0 ? 'bg-danger' : 'bg-primary'}`}
                    style={{
                      height: `${(Math.abs(s.net) / max) * 100}%`,
                      minHeight: s.net === 0 ? 2 : 4,
                    }}
                  />
                </div>
                <span className="mt-1.5 h-4.5 text-[0.75rem] text-foreground-muted tabular-nums">
                  {s.date.slice(8)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="t-support mt-1 text-center">
        {t('date')} → · {t('net')} (₹) ↑
      </p>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{t('date')}</th>
            <th scope="col">{t('net')}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}>
              <th scope="row">{s.date}</th>
              <td>{rupees(s.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
