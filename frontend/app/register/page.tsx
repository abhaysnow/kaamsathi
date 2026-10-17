'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, UserPlus } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, api } from '@/lib/api';
import { authErrorKey, registerSchema, type RegisterForm } from '@/lib/authSchemas';
import { AuthLayout, FormAlert, PasswordInput } from '@/components/auth';
import { Field } from '@/components/ui';

export default function RegisterPage() {
  const { t } = useApp();
  const { status, refresh } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  const onSubmit = async (f: RegisterForm) => {
    setError(null);
    try {
      await api('/auth/register', { method: 'POST', body: f });
      if (await refresh()) router.replace('/');
    } catch (e) {
      setError(authErrorKey(e instanceof ApiError ? e.code : undefined));
    }
  };
  const fe = (k?: string) => (k ? t(k) : undefined);

  return (
    <AuthLayout>
      <h1 className="t-page">{t('registerTitle')}</h1>
      <p className="mt-2 text-foreground-muted">{t('registerSub')}</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {error && <FormAlert>{t(error)}</FormAlert>}
        <Field label={t('fullName')} error={fe(errors.name?.message)}>
          <input
            className="input"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>
        <Field label={t('email')} error={fe(errors.email?.message)}>
          <input
            className="input"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
        <Field label={t('password')} error={fe(errors.password?.message)} hint={t('passwordHint')}>
          <PasswordInput
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>
        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden /> {t('creating')}
            </>
          ) : (
            <>
              <UserPlus size={18} aria-hidden /> {t('createAccount')}
            </>
          )}
        </button>
      </form>
      <p className="mt-6 text-center text-foreground-muted">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
