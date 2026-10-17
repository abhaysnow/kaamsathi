'use client';
import { useState } from 'react';
import {
  Accessibility,
  Briefcase,
  FlaskConical,
  LogOut,
  Lock,
  Settings,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { errorKey } from '@/lib/errors';
import { LANGUAGES, WORK_CATEGORIES, type Lang, type WorkCategory } from '@/lib/types';
import { ErrorBox, Field, Notice, PageHeader } from '@/components/ui';

const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

function Toggle({
  checked,
  onChange,
  text,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  text: string;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-md px-1">
      <span className="font-medium">{text}</span>
      <input
        type="checkbox"
        role="switch"
        className="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function SettingsPage() {
  const { t, profile, setProfile } = useApp();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wipe = async () => {
    if (!window.confirm(`${t('deleteData')}?`)) return;
    try {
      await api('/me/data', { method: 'DELETE' });
      setDeleted(true);
      setError(null);
    } catch (e) {
      setError(errorKey(e));
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={t('nav_settings')} subtitle={t('sub_settings')} icon={Settings} />

      <div className="space-y-4 md:space-y-6">
        <section className="card" aria-labelledby="work-h">
          <h2 id="work-h" className="t-card mb-1 flex items-center gap-2">
            <Briefcase size={18} aria-hidden className="text-primary" /> {t('profile')}
          </h2>
          <p className="t-support mb-4">{t('optional')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('language')}>
              <select
                className="input"
                value={profile.language}
                onChange={(e) => setProfile({ language: e.target.value as Lang })}
              >
                {LANGUAGES.map(([c, n]) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('workType')}>
              <select
                className="input"
                value={profile.workCategory ?? ''}
                onChange={(e) =>
                  setProfile({
                    workCategory: (e.target.value || undefined) as WorkCategory | undefined,
                  })
                }
              >
                <option value="">—</option>
                {WORK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {label(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('state')}>
              <input
                className="input"
                maxLength={60}
                value={profile.state ?? ''}
                onChange={(e) => setProfile({ state: e.target.value || undefined })}
              />
            </Field>
            <Field label={t('platform')}>
              <input
                className="input"
                maxLength={60}
                value={profile.platform ?? ''}
                onChange={(e) => setProfile({ platform: e.target.value || undefined })}
              />
            </Field>
          </div>
          <p className="t-support mt-4 flex items-center gap-2">
            <Lock size={14} aria-hidden /> Saved only in this browser, not on our server.
          </p>
        </section>

        <section className="card" aria-labelledby="a11y-h">
          <h2 id="a11y-h" className="t-card mb-2 flex items-center gap-2">
            <Accessibility size={18} aria-hidden className="text-primary" /> Accessibility
          </h2>
          <div className="divide-y divide-border">
            <Toggle
              checked={profile.largeText}
              onChange={(v) => setProfile({ largeText: v })}
              text={t('largeText')}
            />
            <Toggle
              checked={profile.highContrast}
              onChange={(v) => setProfile({ highContrast: v })}
              text={t('highContrast')}
            />
          </div>
        </section>

        <section className="card space-y-3" aria-labelledby="acct-h">
          <h2 id="acct-h" className="t-card flex items-center gap-2">
            {user?.isDemo ? (
              <FlaskConical size={18} aria-hidden className="text-warning" />
            ) : (
              <UserRound size={18} aria-hidden className="text-primary" />
            )}
            {t('account')}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="t-support">{t('fullName')}</dt>
              <dd className="font-medium">{user?.name}</dd>
            </div>
            <div>
              <dt className="t-support">{t('email')}</dt>
              <dd className="prose-wrap font-medium">{user?.email}</dd>
            </div>
          </dl>
          {user?.isDemo && <Notice icon={FlaskConical}>{t('demoAccountRestricted')}</Notice>}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            <LogOut size={18} aria-hidden /> {t('logout')}
          </button>
        </section>

        <section className="card space-y-3 !border-[#f1c4c0]" aria-labelledby="del-h">
          <h2 id="del-h" className="t-card flex items-center gap-2 text-danger">
            <Trash2 size={18} aria-hidden /> {t('deleteData')}
          </h2>
          <p className="text-foreground-muted">{t('privacy')}</p>
          <button type="button" className="btn btn-danger" onClick={() => void wipe()}>
            <Trash2 size={18} aria-hidden /> {t('deleteData')}
          </button>
          {deleted && <Notice tone="success">{t('deleted')}</Notice>}
          {error && <ErrorBox errorKey={error} />}
        </section>
      </div>
    </div>
  );
}
