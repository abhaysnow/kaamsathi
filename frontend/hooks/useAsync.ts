'use client';
import { useCallback, useState } from 'react';
import { errorKey } from '@/lib/errors';

/** Tracks loading + error for one async action so every screen has the same states. */
export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (...a: A): Promise<R | undefined> => {
      setLoading(true);
      setError(null);
      try {
        return await fn(...a);
      } catch (e) {
        setError(errorKey(e));
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );
  return { run, loading, error, clearError: () => setError(null) };
}
