'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  FileText,
  IndianRupee,
  Landmark,
  MessageCircle,
  PenLine,
  Phone,
  Plus,
  ShieldCheck,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { rupees } from '@/lib/format';
import type { GrievanceRecord, Summary } from '@/lib/types';
import { EmptyState } from '@/components/ui';

const QUICK: Array<{ href: string; key: string; icon: LucideIcon }> = [
  { href: '/ask', key: 'nav_assistant', icon: MessageCircle },
  { href: '/earnings', key: 'qa_earnings', icon: IndianRupee },
  { href: '/rights', key: 'nav_rights', icon: ShieldCheck },
  { href: '/schemes', key: 'nav_schemes', icon: Landmark },
  { href: '/documents', key: 'qa_documents', icon: FileText },
  { href: '/complaints', key: 'qa_complaints', icon: PenLine },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-support">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export default function Home() {
  const { t, mode, ready } = useApp();
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [drafts, setDrafts] = useState<GrievanceRecord[]>([]);

  useEffect(() => {
    if (!ready) return;
    api<Summary>('/earnings/summary?period=week')
      .then(setSummary)
      .catch(() => setSummary(null));
    api<{ grievances: GrievanceRecord[] }>('/grievances')
      .then((r) => setDrafts(r.grievances.slice(0, 3)))
      .catch(() => setDrafts([]));
  }, [ready, mode]);

  const T = summary?.totals;

  return (
    <div className="space-y-8 md:space-y-12">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="badge badge-primary">{t('tagline')}</p>
            {user?.isDemo && <p className="badge badge-warning">{t('demoAccount')}</p>}
          </div>
          {user && (
            <p className="mb-1 text-[1.0625rem] font-semibold text-primary" data-testid="greeting">
              {user.name}
            </p>
          )}
          <h1 className="t-hero">{t('welcome')}</h1>
          <p className="mt-3 text-[1.0625rem] text-foreground-muted">{t('sub_home')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/ask" className="btn btn-primary" data-testid="cta-ask">
            <MessageCircle size={18} aria-hidden />
            {t('askAi')}
          </Link>
          <Link href="/earnings" className="btn btn-secondary">
            <Plus size={18} aria-hidden />
            {t('addEarnings')}
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
        <section className="card lg:col-span-7" aria-labelledby="week-h">
          <div className="flex items-start justify-between gap-3">
            <h2 id="week-h" className="t-card">
              {t('weekNet')}
            </h2>
            <Link
              href="/earnings"
              className="inline-flex min-h-11 items-center gap-1 text-[0.875rem] font-semibold text-primary"
            >
              {t('viewAll')} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          {T && T.entries > 0 ? (
            <>
              <p data-testid="home-net" className="t-kpi mt-2 text-primary">
                <span className="sr-only">{t('net')}: </span>
                {rupees(T.net)}
              </p>
              <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-border pt-4">
                <Stat label={t('gross')} value={rupees(T.gross)} />
                <Stat label={t('expenses')} value={rupees(T.expenses)} />
                <Stat label={t('deductions')} value={rupees(T.deductions)} />
              </dl>
            </>
          ) : (
            <div className="mt-4">
              <EmptyState icon={IndianRupee} text={t('empty')} />
            </div>
          )}
        </section>

        <section className="card flex flex-col lg:col-span-5" aria-labelledby="safety-h">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-warning-bg text-warning">
              <ShieldCheck size={20} aria-hidden />
            </span>
            <h2 id="safety-h" className="t-card">
              {t('safetyTip')}
            </h2>
          </div>
          <p className="mt-3 flex-1 text-foreground-muted">{t('tipText')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="tel:112" className="btn btn-danger btn-sm">
              <Phone size={16} aria-hidden />
              {t('call112')}
            </a>
            <Link href="/rights" className="btn btn-ghost btn-sm">
              {t('nav_rights')} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      <section aria-labelledby="qa-h">
        <h2 id="qa-h" className="t-section mb-4">
          {t('quickActions')}
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
          {QUICK.map(({ href, key, icon: Icon }) => (
            <li key={key}>
              <Link
                href={href}
                className="card card-link flex h-full min-h-28 flex-col justify-between gap-3 !p-4"
              >
                <span className="grid size-10 place-items-center rounded-md bg-primary-light text-primary">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="font-semibold">{t(key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
        <section className="card lg:col-span-5" aria-labelledby="schemes-h">
          <span className="grid size-10 place-items-center rounded-md bg-info-bg text-info">
            <Landmark size={20} aria-hidden />
          </span>
          <h2 id="schemes-h" className="t-card mt-3">
            {t('nav_schemes')}
          </h2>
          <p className="mt-1 text-foreground-muted">{t('sub_schemes')}</p>
          <Link href="/schemes" className="btn btn-secondary btn-sm mt-4">
            {t('findSchemes')} <ArrowRight size={16} aria-hidden />
          </Link>
        </section>

        <section className="card lg:col-span-7" aria-labelledby="recent-h">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-h" className="t-card">
              {t('recent')}
            </h2>
            <Link
              href="/complaints"
              className="inline-flex min-h-11 items-center gap-1 text-[0.875rem] font-semibold text-primary"
            >
              {t('newComplaint')} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          {drafts.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={PenLine} text={t('empty')} />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {drafts.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="font-medium">{d.draft.subject}</span>
                  <span className="badge badge-neutral">{d.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="t-support flex items-center gap-2">
        <Lock size={14} aria-hidden /> {t('privacy')}
      </p>
    </div>
  );
}
