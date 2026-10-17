'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FlaskConical, Loader2, LogIn, RotateCcw } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { safeNext } from '@/lib/authPaths';
import { DEMO_CREDENTIALS, authErrorKey, loginSchema, type LoginForm } from '@/lib/authSchemas';
import { AuthLayout, FormAlert, PasswordInput } from '@/components/auth';
import { Field } from '@/components/ui';

interface DemoInfo {
  enabled: boolean;
  email?: string;
  password?: string;
}

function LoginForm() {
  const { t } = useApp();
  const { status, refresh } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [demo, setDemo] = useState<DemoInfo>({ enabled: true, ...DEMO_CREDENTIALS });
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    // Prefilled for judges; the user still has to press "Sign in".
    defaultValues: { ...DEMO_CREDENTIALS, remember: false },
  });

  // The server says whether the demo account exists (and its current credentials).
  useEffect(() => {
    let live = true;
    api<DemoInfo>('/auth/demo')
      .then((d) => {
        if (!live) return;
        setDemo(d);
        setValue('email', d.enabled ? (d.email ?? '') : '');
        setValue('password', d.enabled ? (d.password ?? '') : '');
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [setValue]);

  // Already signed in (server-confirmed): skip the form.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  const fillDemo = () => {
    setValue('email', demo.email ?? DEMO_CREDENTIALS.email, { shouldValidate: true });
    setValue('password', demo.password ?? DEMO_CREDENTIALS.password, { shouldValidate: true });
    setError(null);
  };

  const onSubmit = async (f: LoginForm) => {
    setError(null);
    try {
      await api('/auth/login', { method: 'POST', body: f });
      // Navigate only once the server confirms the new session.
      const user = await refresh();
      if (user) router.replace(next);
      else setError('errorLogin');
    } catch (e) {
      setError(authErrorKey(e instanceof ApiError ? e.code : undefined));
    }
  };

  const fieldError = (k?: string) => (k ? t(k) : undefined);

  return (
    <AuthLayout>
      <h1 className="t-page">{t('signInTitle')}</h1>
      <p className="mt-2 text-foreground-muted">{t('signInSub')}</p>

      {demo.enabled && (
        <section
          aria-labelledby="demo-h"
          className="mt-6 rounded-lg border border-[#f3dfb0] bg-warning-bg p-4"
          data-testid="demo-section"
        >
          <div className="flex items-start gap-3">
            <FlaskConical size={20} aria-hidden className="mt-0.5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <h2 id="demo-h" className="font-semibold text-warning">
                {t('demoAccount')}
              </h2>
              <p className="mt-0.5 text-[0.875rem] text-foreground-muted">{t('demoAccountNote')}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-[0.875rem]">
                <dt className="text-foreground-muted">{t('email')}</dt>
                <dd className="prose-wrap font-mono font-medium">{demo.email}</dd>
                <dt className="text-foreground-muted">{t('password')}</dt>
                <dd className="font-mono font-medium">{demo.password}</dd>
              </dl>
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-3"
                onClick={fillDemo}
                data-testid="fill-demo"
              >
                <RotateCcw size={16} aria-hidden />
                {t('fillDemo')}
              </button>
            </div>
          </div>
        </section>
      )}

      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label={t('signIn')}
      >
        {error && <FormAlert>{t(error)}</FormAlert>}
        <Field label={t('email')} error={fieldError(errors.email?.message)}>
          <input
            className="input"
            type="email"
            autoComplete="username"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            data-testid="login-email"
            {...register('email')}
          />
        </Field>
        <div>
          <Field label={t('password')} error={fieldError(errors.password?.message)}>
            <PasswordInput
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              data-testid="login-password"
              {...register('password')}
            />
          </Field>
          <div className="mt-1 flex justify-end">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center text-[0.875rem] font-semibold text-primary hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
          <input type="checkbox" className="checkbox" {...register('remember')} />
          {t('rememberMe')}
        </label>
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          data-testid="login-submit"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden /> {t('signingIn')}
            </>
          ) : (
            <>
              <LogIn size={18} aria-hidden /> {t('signIn')}
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-foreground-muted">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          {t('createAccount')}
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
