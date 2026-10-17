'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { browserSpeech, type SpeechProvider } from '@/lib/speech';

const noopSubscribe = () => () => undefined;

/**
 * Browser speech is only known on the client. Reporting "unavailable" during SSR and the first
 * hydration pass keeps server and client markup identical; the mic/speaker buttons appear after.
 */
export function useSpeech(): SpeechProvider | null {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return useMemo(() => (isClient ? browserSpeech() : null), [isClient]);
}
