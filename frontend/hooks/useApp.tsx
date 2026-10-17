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
import { useAuth } from '@/hooks/useAuth';
import { tr } from '@/lib/i18n';
import type { Lang, WorkCategory } from '@/lib/types';

export interface Profile {
  language: Lang;
  workCategory?: WorkCategory;
  state?: string;
  platform?: string;
  largeText: boolean;
  highContrast: boolean;
}
interface Ctx {
  profile: Profile;
  setProfile: (p: Partial<Profile>) => void;
  t: (k: string) => string;
  /** Whether the signed-in account is the shared demo account (from the server). */
  mode: 'demo' | 'real';
  /** Profile hydrated and a server-confirmed session exists: safe to load private data. */
  ready: boolean;
}
const DEFAULT: Profile = { language: 'en', largeText: false, highContrast: false };
const AppCtx = createContext<Ctx | null>(null);

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable: app still works for this visit */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);
  const { status, user } = useAuth();
  const mode: 'demo' | 'real' = user?.isDemo ? 'demo' : 'real';
  const ready = hydrated && status === 'authenticated';

  useEffect(() => {
    // Hydrate from localStorage after mount so server and client markup match on first paint.
    /* eslint-disable react-hooks/set-state-in-effect */
    setProfileState({ ...DEFAULT, ...read<Partial<Profile>>('ks_profile', {}) });
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    document.documentElement.lang = profile.language;
    document.documentElement.classList.toggle('large-text', profile.largeText);
    document.documentElement.classList.toggle('high-contrast', profile.highContrast);
  }, [profile]);

  const setProfile = useCallback((p: Partial<Profile>) => {
    setProfileState((cur) => {
      const next = { ...cur, ...p };
      write('ks_profile', next);
      return next;
    });
  }, []);
  const t = useCallback((k: string) => tr(profile.language, k), [profile.language]);

  const value = useMemo(
    () => ({ profile, setProfile, t, mode, ready }),
    [profile, setProfile, t, mode, ready],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
