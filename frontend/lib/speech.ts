import type { Lang } from './types';

/**
 * Speech is isolated behind this interface. The default implementation uses the browser's own
 * Web Speech API (availability and privacy depend on the browser vendor — on Chrome, audio may be
 * sent to the vendor's cloud). Swap in a server-side STT/TTS provider by implementing `SpeechProvider`.
 */
export interface SpeechProvider {
  canSpeak: boolean;
  canListen: boolean;
  speak(text: string, lang: Lang): void;
  stopSpeaking(): void;
  listen(lang: Lang, onResult: (text: string) => void, onError: (msg: string) => void): () => void;
}

const BCP47: Record<Lang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
};

type RecCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

export function browserSpeech(): SpeechProvider {
  const w =
    typeof window === 'undefined'
      ? undefined
      : (window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor });
  const Rec = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  return {
    canSpeak,
    canListen: Boolean(Rec),
    speak(text, lang) {
      if (!canSpeak) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = BCP47[lang];
      window.speechSynthesis.speak(u);
    },
    stopSpeaking() {
      if (canSpeak) window.speechSynthesis.cancel();
    },
    listen(lang, onResult, onError) {
      if (!Rec) return () => undefined;
      const r = new Rec();
      r.lang = BCP47[lang];
      r.interimResults = false;
      r.onresult = (e) => onResult(e.results[0]?.[0]?.transcript ?? '');
      r.onerror = () => onError('mic');
      r.start();
      return () => r.stop();
    },
  };
}
