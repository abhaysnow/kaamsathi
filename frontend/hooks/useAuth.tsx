'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError, UNAUTHORIZED_EVENT, api } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';
interface AuthCtx {
  status: Status;
  user: AuthUser | null;
  /** Asks the server who is signed in. The UI never decides this on its own. */
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  /** True after a deliberate sign-out, so the guard does not add a "return to" path. */
  signedOut: boolean;
}
const Ctx = createContext<AuthCtx | null>(null);

/**
 * Client-side view of the server session. It only mirrors GET /auth/me: protection of data is
 * enforced by the API on every request, so this state controls navigation, never access.
 * Nothing about the session is kept in browser storage; the session cookie is HttpOnly.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [signedOut, setSignedOut] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: AuthUser }>('/auth/me');
      setUser(r.user);
      setStatus('authenticated');
      setSignedOut(false);
      return r.user;
    } catch (e) {
      // Offline is not the same as signed out, but either way we cannot show private pages.
      if (!(e instanceof ApiError) || e.status === 401 || e.status === 0) {
        setUser(null);
        setStatus('anonymous');
      }
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      // Clear client state even if the network call failed; the cookie is cleared server-side.
      setSignedOut(true);
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    let live = true;
    api<{ user: AuthUser }>('/auth/me')
      .then((r) => {
        if (!live) return;
        setUser(r.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!live) return;
        setUser(null);
        setStatus('anonymous');
      });
    const onUnauthorized = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      live = false;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const value = useMemo(
    () => ({ status, user, refresh, logout, signedOut }),
    [status, user, refresh, logout, signedOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
