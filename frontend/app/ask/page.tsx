'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  FileText,
  IndianRupee,
  Landmark,
  Mic,
  MessageCircle,
  PenLine,
  Phone,
  Scale,
  SendHorizontal,
  ShieldCheck,
  Square,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAction } from '@/hooks/useAsync';
import { useSpeech } from '@/hooks/useSpeech';
import { api } from '@/lib/api';
import type { ChatResponse } from '@/lib/types';
import { Citations, ErrorBox, PageHeader, ProviderBadge, Spinner } from '@/components/ui';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  meta?: ChatResponse;
}
const QUICK: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'earnings', icon: IndianRupee },
  { key: 'safety', icon: ShieldCheck },
  { key: 'rights', icon: Scale },
  { key: 'schemes', icon: Landmark },
  { key: 'documents', icon: FileText },
  { key: 'complaints', icon: PenLine },
];

/** Follow-up chips fill the input via a custom event so the worker can edit before sending. */
function FollowUps({ questions }: { questions: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          className="btn btn-secondary btn-sm !rounded-full"
          onClick={() => window.dispatchEvent(new CustomEvent('ks:prefill', { detail: q }))}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function AssistantMessage({ content, meta }: { content: string; meta: ChatResponse }) {
  const { t, profile } = useApp();
  const speech = useSpeech();
  return (
    <div className="card max-w-3xl !p-5" data-testid="assistant-msg">
      {meta.emergency.show && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-danger px-4 py-3 font-semibold text-white"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={18} aria-hidden className="shrink-0" />
            {t('emergency')}: {meta.emergency.text}
          </span>
          <a href="tel:112" className="btn btn-sm border-white/40 bg-white text-danger">
            <Phone size={16} aria-hidden /> 112
          </a>
        </div>
      )}
      {meta.couldNotVerify && (
        <p className="badge badge-warning mb-3">
          <AlertTriangle size={13} aria-hidden /> {t('notVerified')}
        </p>
      )}
      <p className="prose-wrap whitespace-pre-wrap">{content}</p>
      <Citations citations={meta.citations} />
      {meta.followUpQuestions.length > 0 && <FollowUps questions={meta.followUpQuestions} />}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <ProviderBadge provider={meta.provider} />
        {speech?.canSpeak && (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => speech.speak(content, profile.language)}
            >
              <Volume2 size={16} aria-hidden /> {t('speak')}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => speech.stopSpeaking()}
            >
              <Square size={14} aria-hidden /> {t('stop')}
            </button>
          </>
        )}
      </div>
      <p className="t-support mt-2">{meta.disclaimer}</p>
    </div>
  );
}

function Chat() {
  const { t, profile } = useApp();
  const params = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // Deep link from the home "Safety" card pre-fills the question; the worker still presses Send.
  const [text, setText] = useState(() => (params.get('q') === 'safety' ? t('q_safety') : ''));
  const [listening, setListening] = useState(false);
  const last = useRef('');
  const speech = useSpeech();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { run, loading, error } = useAction(async (message: string, history: Msg[]) => {
    const res = await api<ChatResponse>('/assistant/chat', {
      method: 'POST',
      body: {
        message,
        language: profile.language,
        history: history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        profile: { state: profile.state, workCategory: profile.workCategory },
      },
    });
    setMsgs((cur) => [...cur, { role: 'assistant', content: res.answer, meta: res }]);
  });

  const send = (message: string) => {
    const m = message.trim();
    if (!m || loading) return;
    last.current = m;
    const history = msgs;
    setMsgs((cur) => [...cur, { role: 'user', content: m }]);
    setText('');
    void run(m, history);
  };

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [msgs, loading]);
  useEffect(() => {
    const onPrefill = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      inputRef.current?.focus();
    };
    window.addEventListener('ks:prefill', onPrefill);
    return () => window.removeEventListener('ks:prefill', onPrefill);
  }, []);

  const mic = () => {
    setListening(true);
    speech?.listen(
      profile.language,
      (r) => {
        setListening(false);
        setText(r);
      },
      () => setListening(false),
    );
  };

  return (
    <div className="flex flex-col">
      <PageHeader title={t('askAi')} subtitle={t('sub_ask')} icon={MessageCircle} />

      {msgs.length === 0 && (
        <section className="card" data-testid="empty-state" aria-labelledby="sugg-h">
          <h2 id="sugg-h" className="t-card mb-4">
            {t('suggested')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK.map(({ key, icon: Icon }) => (
              <li key={key}>
                <button
                  type="button"
                  className="flex h-full min-h-11 w-full items-start gap-3 rounded-md border border-border bg-surface p-3.5 text-left transition-colors hover:border-[#cfd8cd] hover:bg-primary-subtle"
                  onClick={() => send(t(`q_${key}`))}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-primary-light text-primary">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[0.8125rem] font-semibold text-foreground-muted">
                      {t(`qa_${key}`)}
                    </span>
                    <span className="block font-medium">{t(`q_${key}`)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="space-y-4" aria-live="polite">
        {msgs.map((m, i) => (
          <li key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            {m.role === 'assistant' && m.meta ? (
              <AssistantMessage content={m.content} meta={m.meta} />
            ) : (
              <p
                className="prose-wrap max-w-[85%] rounded-xl rounded-br-sm bg-primary px-4 py-3 whitespace-pre-wrap text-on-primary md:max-w-xl"
                data-testid="user-msg"
              >
                {m.content}
              </p>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 space-y-3">
        {loading && <Spinner />}
        {error && (
          <ErrorBox errorKey={error} onRetry={() => void run(last.current, msgs.slice(0, -1))} />
        )}
      </div>
      <div ref={endRef} />

      <div className="sticky bottom-0 z-20 -mx-1 mt-4 bg-gradient-to-t from-background from-80% to-transparent px-1 pt-6 pb-[88px] md:pb-6">
        <form
          className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2 shadow-hover"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t('askPlaceholder')}</span>
            <input
              ref={inputRef}
              data-testid="chat-input"
              className="input !border-transparent !shadow-none"
              value={text}
              maxLength={1000}
              placeholder={listening ? t('listening') : t('askPlaceholder')}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          {speech?.canListen && (
            <button
              type="button"
              className={`btn btn-icon ${listening ? 'btn-primary' : 'btn-ghost'}`}
              onClick={mic}
              aria-label={t('mic')}
              aria-pressed={listening}
              title={t('micPrivacy')}
            >
              <Mic size={20} aria-hidden />
            </button>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !text.trim()}
            data-testid="chat-send"
            aria-label={t('send')}
          >
            <SendHorizontal size={18} aria-hidden />
            <span className="hidden sm:inline">{t('send')}</span>
          </button>
        </form>
        {speech?.canListen && <p className="t-support mt-2 px-2">{t('micPrivacy')}</p>}
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}
