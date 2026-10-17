'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ExternalLink, Loader2, Mail } from 'lucide-react';
import type { z } from 'zod';
import { useApp } from '@/hooks/useApp';
import { API_BASE, ApiError, api } from '@/lib/api';
import { authErrorKey, forgotSchema } from '@/lib/authSchemas';
import { AuthLayout, FormAlert } from '@/components/auth';
import { Field } from '@/components/ui';

type Form = z.infer<typeof forgotSchema>;
interface Res {
  message: string;
  devOutbox?: string;
}

export default function ForgotPasswordPage() {
  const { t } = useApp();
  const [done, setDone] = useState<Res | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = async (f: Form) => {
    setError(null);
    try {
      setDone(await api<Res>('/auth/forgot-password', { method: 'POST', body: f }));
    } catch (e) {
      setError(authErrorKey(e instanceof ApiError ? e.code : undefined));
    }
  };

  return (
    <AuthLayout>
      <h1 className="t-page">{t('forgotTitle')}</h1>
      <p className="mt-2 text-foreground-muted">{t('forgotSub')}</p>

      {done ? (
        <div className="mt-6 space-y-4">
          {/* Same message whether or not the account exists. */}
          <FormAlert tone="success">{done.message}</FormAlert>
          {done.devOutbox && (
            <div
              className="rounded-md border border-dashed border-warning bg-warning-bg p-4 text-[0.875rem]"
              data-testid="dev-outbox"
            >
              <p className="font-semibold text-warning">DEVELOPMENT ONLY</p>
              <p className="mt-1">{t('devOutboxNote')}</p>
              <a
                className="btn btn-secondary btn-sm mt-3"
                href={`${API_BASE}${done.devOutbox.replace(/^\/api\/v1/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('openOutbox')} <ExternalLink size={15} aria-hidden />
              </a>
            </div>
          )}
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {error && <FormAlert>{t(error)}</FormAlert>}
          <Field
            label={t('email')}
            error={errors.email?.message ? t(errors.email.message) : undefined}
          >
            <input
              className="input"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>
          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <Mail size={18} aria-hidden />
            )}
            {isSubmitting ? t('sending') : t('sendLink')}
          </button>
        </form>
      )}

      <Link href="/login" className="btn btn-ghost mt-6 w-full">
        <ArrowLeft size={18} aria-hidden /> {t('backToSignIn')}
      </Link>
    </AuthLayout>
  );
}
