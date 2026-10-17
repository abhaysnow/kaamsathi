'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react';
import type { z } from 'zod';
import { useApp } from '@/hooks/useApp';
import { ApiError, api } from '@/lib/api';
import { authErrorKey, resetSchema } from '@/lib/authSchemas';
import { AuthLayout, FormAlert, PasswordInput } from '@/components/auth';
import { Field } from '@/components/ui';

type Form = z.infer<typeof resetSchema>;

function ResetForm() {
  const { t } = useApp();
  const params = useSearchParams();
  // Read once, then drop the token from the address bar so it does not stay in history.
  const [token] = useState(() => {
    const tok = params.get('token') ?? '';
    if (tok && typeof window !== 'undefined')
      window.history.replaceState(null, '', '/reset-password');
    return tok;
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'resetMissing');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(resetSchema), defaultValues: { password: '' } });

  const onSubmit = async (f: Form) => {
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: f.password } });
      setDone(true);
    } catch (e) {
      setError(authErrorKey(e instanceof ApiError ? e.code : undefined));
    }
  };

  return (
    <AuthLayout>
      <h1 className="t-page">{t('resetTitle')}</h1>
      <p className="mt-2 text-foreground-muted">{t('resetSub')}</p>
      {done ? (
        <div className="mt-6 space-y-4">
          <FormAlert tone="success">{t('resetDone')}</FormAlert>
          <Link href="/login" className="btn btn-primary w-full">
            {t('signIn')}
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {error && <FormAlert>{t(error)}</FormAlert>}
          <Field
            label={t('newPassword')}
            error={errors.password?.message ? t(errors.password.message) : undefined}
            hint={t('passwordHint')}
          >
            <PasswordInput
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isSubmitting || !token}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <KeyRound size={18} aria-hidden />
            )}
            {t('savePassword')}
          </button>
          {!token && (
            <Link href="/forgot-password" className="btn btn-secondary w-full">
              {t('forgotTitle')}
            </Link>
          )}
        </form>
      )}
      <Link href="/login" className="btn btn-ghost mt-6 w-full">
        <ArrowLeft size={18} aria-hidden /> {t('backToSignIn')}
      </Link>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
