'use client';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  PenLine,
  Plus,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAction } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { downloadText } from '@/lib/format';
import type { GrievanceDraft, GrievanceRecord, Provider } from '@/lib/types';
import {
  EmptyState,
  ErrorBox,
  Field,
  Notice,
  PageHeader,
  ProviderBadge,
  Spinner,
} from '@/components/ui';

const TYPES = [
  'payment_delay',
  'incorrect_deduction',
  'unpaid_incentive',
  'account_suspension',
  'harassment',
  'accident',
  'other',
];
interface DraftRes {
  draft: GrievanceDraft;
  provider: Provider;
  saved: boolean;
  id?: string;
  usedTemplateFallback: boolean;
}
interface Demo {
  grievanceScenario: {
    type: string;
    platformOrEmployer: string;
    whatHappened: string;
    stepsAlreadyTaken: string;
    evidenceAvailable: string[];
    desiredResolution: string;
    amountRupees: number;
  };
}
const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`${step + 1} / ${labels.length}`}>
      {labels.map((l, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li
            key={l}
            className="flex flex-1 items-center gap-2"
            aria-current={current ? 'step' : undefined}
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold ${
                done || current
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-muted text-foreground-muted'
              }`}
            >
              {done ? <Check size={16} aria-hidden /> : i + 1}
            </span>
            <span
              className={`hidden text-[0.875rem] sm:inline ${current ? 'font-semibold' : 'text-foreground-muted'}`}
            >
              {l}
            </span>
            {i < labels.length - 1 && (
              <span className={`h-px flex-1 ${done ? 'bg-primary' : 'bg-border'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function ComplaintsPage() {
  const { t, profile, mode, ready } = useApp();
  const [step, setStep] = useState(0);
  const [type, setType] = useState(TYPES[2]!);
  const [employer, setEmployer] = useState('');
  const [what, setWhat] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [tried, setTried] = useState('');
  const [evidence, setEvidence] = useState('');
  const [wish, setWish] = useState('');
  const [consent, setConsent] = useState(false);
  const [res, setRes] = useState<DraftRes | null>(null);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<GrievanceRecord[]>([]);

  const loadSaved = () =>
    api<{ grievances: GrievanceRecord[] }>('/grievances')
      .then((r) => setSaved(r.grievances))
      .catch(() => undefined);
  useEffect(() => {
    if (ready) void loadSaved();
  }, [ready, mode]);

  const generate = useAction(async () => {
    const out = await api<DraftRes>('/grievances/draft', {
      method: 'POST',
      body: {
        language: profile.language,
        saveWithConsent: consent,
        facts: {
          type,
          platformOrEmployer: employer,
          whatHappened: what,
          incidentDate: date || undefined,
          amountRupees: amount ? Number(amount) : undefined,
          stepsAlreadyTaken: tried || undefined,
          evidenceAvailable: evidence
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          desiredResolution: wish || undefined,
        },
      },
    });
    setRes(out);
    setMessage(out.draft.finalMessage);
    if (out.saved) void loadSaved();
  });

  const loadSample = async () => {
    const d = await api<Demo>('/demo/info');
    const s = d.grievanceScenario;
    setType(s.type);
    setEmployer(s.platformOrEmployer);
    setWhat(s.whatHappened);
    setTried(s.stepsAlreadyTaken);
    setEvidence(s.evidenceAvailable.join(', '));
    setWish(s.desiredResolution);
    setAmount(String(s.amountRupees));
    setStep(2);
  };

  const canNext = step === 0 || (step === 1 && employer.trim() && what.trim()) || step === 2;
  const facts = res?.draft.workerFacts;

  return (
    <div>
      <PageHeader
        title={t('newComplaint')}
        subtitle={t('sub_complaints')}
        icon={PenLine}
        actions={
          mode === 'demo' && !res ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void loadSample()}
              data-testid="load-sample"
            >
              <FlaskConical size={18} aria-hidden />
              {t('loadSample')}
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Notice tone="info">{t('notSent')}</Notice>

          {!res && (
            <form
              className="card space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (step < 2) setStep(step + 1);
                else void generate.run();
              }}
            >
              <Stepper
                step={step}
                labels={[
                  t('complaintType'),
                  t('whatHappened').split('(')[0]!.trim(),
                  t('evidence').split('(')[0]!.trim(),
                ]}
              />

              {step === 0 && (
                <Field label={t('complaintType')}>
                  <select
                    className="input"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    data-testid="c-type"
                  >
                    {TYPES.map((x) => (
                      <option key={x} value={x}>
                        {label(x)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {step === 1 && (
                <div className="space-y-4">
                  <Field label={t('employer')}>
                    <input
                      className="input"
                      value={employer}
                      maxLength={100}
                      onChange={(e) => setEmployer(e.target.value)}
                      data-testid="c-employer"
                    />
                  </Field>
                  <Field label={t('whatHappened')}>
                    <textarea
                      className="input"
                      rows={5}
                      maxLength={1500}
                      value={what}
                      onChange={(e) => setWhat(e.target.value)}
                      data-testid="c-what"
                    />
                  </Field>
                </div>
              )}
              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('incidentDate')}>
                    <input
                      className="input"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </Field>
                  <Field label={t('amount')}>
                    <input
                      className="input tabular-nums"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>
                  <Field label={t('tried')} className="sm:col-span-2">
                    <textarea
                      className="input"
                      rows={2}
                      value={tried}
                      onChange={(e) => setTried(e.target.value)}
                    />
                  </Field>
                  <Field label={t('evidence')} className="sm:col-span-2">
                    <input
                      className="input"
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                    />
                  </Field>
                  <Field label={t('wish')} className="sm:col-span-2">
                    <input
                      className="input"
                      value={wish}
                      onChange={(e) => setWish(e.target.value)}
                    />
                  </Field>
                  <label className="panel flex items-start gap-3 font-medium sm:col-span-2">
                    <input
                      type="checkbox"
                      className="checkbox mt-0.5"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    {t('consent')}
                  </label>
                </div>
              )}

              <div className="flex gap-2 border-t border-border pt-5">
                {step > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStep(step - 1)}
                    aria-label="Back"
                  >
                    <ArrowLeft size={18} aria-hidden />
                  </button>
                )}
                <button
                  className="btn btn-primary flex-1"
                  type="submit"
                  disabled={!canNext || generate.loading}
                  data-testid="c-next"
                >
                  {step < 2 ? (
                    <>
                      Next <ArrowRight size={18} aria-hidden />
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} aria-hidden /> {t('generate')}
                    </>
                  )}
                </button>
              </div>
              {generate.loading && <Spinner />}
              {generate.error && (
                <ErrorBox errorKey={generate.error} onRetry={() => void generate.run()} />
              )}
            </form>
          )}

          {res && facts && (
            <section className="space-y-4" data-testid="draft-result">
              <Notice>
                <p className="font-semibold">{t('draftLabel')}</p>
                <p className="mt-0.5 text-[0.875rem] font-normal">{res.draft.disclaimer}</p>
              </Notice>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="card">
                  <h2 className="t-card flex items-center gap-2">
                    <UserRound size={18} aria-hidden className="text-primary" /> {t('youProvided')}
                  </h2>
                  <dl className="mt-3 space-y-2 text-[0.9375rem]">
                    <div>
                      <dt className="t-support">{t('employer')}</dt>
                      <dd className="font-medium">{facts.platformOrEmployer}</dd>
                    </div>
                    {facts.incidentDate && (
                      <div>
                        <dt className="t-support">{t('incidentDate')}</dt>
                        <dd className="font-medium">{facts.incidentDate}</dd>
                      </div>
                    )}
                    {facts.amountRupees !== undefined && (
                      <div>
                        <dt className="t-support">{t('amount')}</dt>
                        <dd className="font-medium tabular-nums">₹{facts.amountRupees}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="t-support">{t('whatHappened')}</dt>
                      <dd>{facts.whatHappened}</dd>
                    </div>
                  </dl>
                </div>
                <div className="card">
                  <h2 className="t-card flex items-center gap-2">
                    <Sparkles size={18} aria-hidden className="text-info" /> {t('aiSuggested')}
                  </h2>
                  <p className="mt-3 font-semibold">{res.draft.subject}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.9375rem] text-foreground-muted">
                    {res.draft.evidenceChecklist.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                  {res.draft.suggestedChannels.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[0.875rem]">
                      {res.draft.suggestedChannels.map((c) => (
                        <li key={c.url} className="prose-wrap">
                          <a
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {c.name} <ExternalLink size={13} aria-hidden />
                          </a>{' '}
                          <span className="text-foreground-muted">— {c.note}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="card">
                <label className="label" htmlFor="final">
                  Final message
                </label>
                <textarea
                  id="final"
                  data-testid="final-message"
                  className="input"
                  rows={14}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-testid="copy-draft"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(message);
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
                    {copied ? t('copied') : t('copy')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => downloadText('complaint-draft.txt', message)}
                  >
                    <Download size={18} aria-hidden />
                    {t('download')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setRes(null);
                      setCopied(false);
                      setStep(0);
                    }}
                  >
                    <Plus size={18} aria-hidden />
                    {t('newComplaint')}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ProviderBadge provider={res.provider} />
                  {res.usedTemplateFallback && (
                    <span className="t-support">
                      (plain template used: AI draft failed fact check)
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        <section className="card h-fit lg:col-span-4" aria-labelledby="recent-h">
          <h2 id="recent-h" className="t-card">
            {t('recent')}
          </h2>
          {saved.length === 0 ? (
            <div className="mt-3">
              <EmptyState icon={PenLine} text={t('empty')} />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {saved.map((g) => (
                <li key={g.id} className="flex items-start justify-between gap-3 py-3">
                  <span className="font-medium">{g.draft.subject}</span>
                  <span className="badge badge-neutral">{g.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
