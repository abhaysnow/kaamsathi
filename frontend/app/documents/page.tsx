'use client';
import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ListChecks,
  Lock,
  PenLine,
  Check,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAction } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { downloadText } from '@/lib/format';
import type { Provider } from '@/lib/types';
import { ErrorBox, Field, Notice, PageHeader, ProviderBadge, Spinner } from '@/components/ui';

const PURPOSES = [
  'eshram_registration',
  'bocw_registration',
  'bank_account_for_schemes',
  'accident_claim',
  'payment_dispute',
  'other',
];
const KINDS = [
  'application_letter',
  'payment_request',
  'work_experience_summary',
  'affidavit_outline',
  'explain_form',
];
interface Checklist {
  title: string;
  items: string[];
  officialUrl?: string;
  explanation: string;
  note: string;
  provider: Provider;
}
interface Draft {
  title: string;
  body: string;
  disclaimer: string;
  provider: Provider;
}
const label = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');

export default function DocumentsPage() {
  const { t, profile } = useApp();
  const [purpose, setPurpose] = useState(PURPOSES[0]!);
  const [kind, setKind] = useState(KINDS[1]!);
  const [details, setDetails] = useState('');
  const [name, setName] = useState('');
  const [list, setList] = useState<Checklist | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  const checklist = useAction(async () =>
    setList(
      await api<Checklist>('/documents/checklist', {
        method: 'POST',
        body: { language: profile.language, purpose },
      }),
    ),
  );
  const makeDraft = useAction(async () => {
    const d = await api<Draft>('/documents/draft', {
      method: 'POST',
      body: { language: profile.language, kind, details, workerName: name || undefined },
    });
    setDraft(d);
    setBody(d.body);
    setCopied(false);
  });

  return (
    <div>
      <PageHeader title={t('nav_documents')} subtitle={t('sub_documents')} icon={FileText} />
      <p className="t-support -mt-3 mb-6 flex items-center gap-2">
        <Lock size={14} aria-hidden /> {t('noPII')}
      </p>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <section className="card space-y-4" aria-labelledby="cl-h">
          <h2 id="cl-h" className="t-section flex items-center gap-2">
            <ListChecks size={20} aria-hidden className="text-primary" />
            {t('docChecklist')}
          </h2>
          <Field label="Purpose">
            <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void checklist.run()}
            disabled={checklist.loading}
          >
            {t('generate')}
          </button>
          {checklist.loading && <Spinner />}
          {checklist.error && (
            <ErrorBox errorKey={checklist.error} onRetry={() => void checklist.run()} />
          )}
          {list && (
            <div data-testid="checklist" className="space-y-3 border-t border-border pt-4">
              <h3 className="t-card">{list.title}</h3>
              <p className="text-foreground-muted">{list.explanation}</p>
              <ul className="space-y-2">
                {list.items.map((i) => (
                  <li key={i} className="flex gap-2.5">
                    <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0 text-success" />
                    {i}
                  </li>
                ))}
              </ul>
              <p className="t-support">{list.note}</p>
              <div className="flex flex-wrap items-center gap-3">
                {list.officialUrl && (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={list.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Official site <ExternalLink size={15} aria-hidden />
                  </a>
                )}
                <ProviderBadge provider={list.provider} />
              </div>
            </div>
          )}
        </section>

        <section className="card space-y-4" aria-labelledby="dr-h">
          <h2 id="dr-h" className="t-section flex items-center gap-2">
            <PenLine size={20} aria-hidden className="text-primary" />
            {t('docDraft')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((p) => (
                  <option key={p} value={p}>
                    {label(p)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name (optional)">
              <input
                className="input"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Details">
            <textarea
              className="input"
              rows={4}
              maxLength={1500}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void makeDraft.run()}
            disabled={makeDraft.loading || !details.trim()}
          >
            {t('generate')}
          </button>
          {makeDraft.loading && <Spinner />}
          {makeDraft.error && (
            <ErrorBox errorKey={makeDraft.error} onRetry={() => void makeDraft.run()} />
          )}
          {draft && (
            <div className="space-y-3 border-t border-border pt-4" data-testid="doc-draft">
              <Notice>
                <p className="font-semibold">{t('draftLabel')}</p>
                <p className="mt-0.5 text-[0.875rem] font-normal">{draft.disclaimer}</p>
              </Notice>
              <Field label={draft.title}>
                <textarea
                  className="input"
                  rows={10}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(body);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                  {copied ? t('copied') : t('copy')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => downloadText('draft.txt', body)}
                >
                  <Download size={16} aria-hidden />
                  {t('download')}
                </button>
                <ProviderBadge provider={draft.provider} />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
