'use client';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  IndianRupee,
  Landmark,
  PenLine,
  Sprout,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { LanguageSelect, Logo } from '@/components/Shell';

/** Split layout: brand story on the left (desktop only), the form on the right. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const points = [
    { icon: IndianRupee, key: 'authPoint1' },
    { icon: Landmark, key: 'authPoint2' },
    { icon: PenLine, key: 'authPoint3' },
  ];
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-on-primary lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5 text-[1.0625rem] font-bold">
          <span className="grid size-9 place-items-center rounded-[10px] bg-white/15">
            <Sprout size={20} aria-hidden />
          </span>
          KaamSaathi AI
        </div>
        <div className="max-w-md">
          <p className="mb-4 inline-block rounded-full bg-white/15 px-3 py-1 text-[0.8125rem] font-semibold">
            {t('tagline')}
          </p>
          <h2 className="text-[2.25rem] leading-tight font-bold tracking-tight">
            {t('authTagline')}
          </h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3 text-[1rem] text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white/15">
                  <Icon size={18} aria-hidden />
                </span>
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[0.8125rem] text-white/70">
          Hackathon demo project. Not affiliated with any government body.
        </p>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center justify-between px-4 md:h-[var(--header-height)] md:px-8">
          <span className="lg:invisible">
            <Logo />
          </span>
          <LanguageSelect compact />
        </header>
        <div className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 sm:items-center sm:pt-0">
          <div className="w-full max-w-[26rem]">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Password field with an accessible show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput(props, ref) {
    const { t } = useApp();
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input ref={ref} {...props} type={visible ? 'text' : 'password'} className="input !pr-12" />
        <button
          type="button"
          className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-md text-foreground-muted hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('hidePassword') : t('showPassword')}
          aria-pressed={visible}
          data-testid="toggle-password"
        >
          {visible ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
        </button>
      </div>
    );
  },
);

export function FormAlert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success';
  children: ReactNode;
}) {
  const error = tone === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      data-testid={error ? 'auth-error' : 'auth-success'}
      className={`flex items-start gap-2.5 rounded-md px-4 py-3 font-medium ${
        error ? 'border border-[#f1c4c0] bg-danger-bg text-danger' : 'bg-success-bg text-success'
      }`}
    >
      {error ? (
        <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" />
      )}
      <div>{children}</div>
    </div>
  );
}
