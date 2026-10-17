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
  mode: 'demo' | 'real';
  setMode: (m: 'demo' | 'real') => void;
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
  const [mode, setModeState] = useState<'demo' | 'real'>('demo');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage after mount so server and client markup match on first paint.
    /* eslint-disable react-hooks/set-state-in-effect */
    setProfileState({ ...DEFAULT, ...read<Partial<Profile>>('ks_profile', {}) });
    setModeState(read<string>('ks_mode', 'demo') === 'real' ? 'real' : 'demo');
    setReady(true);
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
  const setMode = useCallback((m: 'demo' | 'real') => {
    write('ks_mode', m);
    setModeState(m);
  }, []);
  const t = useCallback((k: string) => tr(profile.language, k), [profile.language]);

  const value = useMemo(
    () => ({ profile, setProfile, t, mode, setMode, ready }),
    [profile, setProfile, t, mode, setMode, ready],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}
