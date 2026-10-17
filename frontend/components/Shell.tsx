'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronRight,
  FlaskConical,
  Globe,
  LayoutGrid,
  Loader2,
  LogOut,
  Sprout,
  UserRound,
  X,
} from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { isPublicPath, safeNext } from '@/lib/authPaths';
import { LANGUAGES, type Lang } from '@/lib/types';
import { NAV, currentNav, isActive } from '@/lib/nav';

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md"
      aria-label="KaamSaathi AI — Home"
    >
      <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-on-primary">
        <Sprout size={20} strokeWidth={2} aria-hidden />
      </span>
      <span className="text-[1.0625rem] font-bold tracking-tight">
        KaamSaathi <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { t, profile, setProfile } = useApp();
  return (
    <label className="relative flex items-center">
      <Globe
        size={18}
        className="pointer-events-none absolute left-3 text-foreground-muted"
        aria-hidden
      />
      <select
        aria-label={t('language')}
        className={`input !min-h-11 !pl-9 ${compact ? '!w-[8.5rem] !pr-2' : '!w-auto'}`}
        value={profile.language}
        onChange={(e) => setProfile({ language: e.target.value as Lang })}
      >
        {LANGUAGES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Status is text + icon, never colour alone. */
function ModeBadge({ testId = 'mode-banner' }: { testId?: string }) {
  const { t, mode } = useApp();
  return mode === 'demo' ? (
    <span data-testid={testId} className="badge badge-warning" title={t('demoBanner')}>
      <FlaskConical size={14} aria-hidden />
      {t('demoShort')}
      <span className="sr-only"> — {t('demoBanner')}</span>
    </span>
  ) : (
    <span data-testid={testId} className="badge badge-primary" title={t('realBanner')}>
      <UserRound size={14} aria-hidden />
      {t('realShort')}
    </span>
  );
}

/** Signs out on the server first, then clears client state and returns to the login page. */
function useSignOut() {
  const { logout } = useAuth();
  const router = useRouter();
  return async () => {
    await logout();
    router.replace('/login');
  };
}

function AccountCard() {
  const { t } = useApp();
  const { user } = useAuth();
  const signOut = useSignOut();
  if (!user) return null;
  return (
    <div className={`rounded-md p-3.5 ${user.isDemo ? 'bg-warning-bg' : 'bg-surface-muted'}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-semibold text-on-primary"
        >
          {user.name.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.875rem] font-semibold" data-testid="account-name">
            {user.name}
          </p>
          <p className="truncate text-[0.8125rem] text-foreground-muted">{user.email}</p>
        </div>
      </div>
      {user.isDemo && (
        <p className="mt-2.5 text-[0.8125rem] font-medium text-warning">{t('demoBanner')}</p>
      )}
      <button
        type="button"
        className="btn btn-secondary btn-sm mt-3 w-full"
        onClick={() => void signOut()}
        data-testid="logout"
      >
        <LogOut size={16} aria-hidden />
        {t('logout')}
      </button>
    </div>
  );
}

function SidebarNav() {
  const { t } = useApp();
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {NAV.map(({ href, labelKey, icon: Icon }) => {
        const active = isActive(href, path);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-medium transition-colors ${
                active
                  ? 'bg-primary-light font-semibold text-primary-hover'
                  : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {t(labelKey)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Native <dialog>: focus trap, Esc to close and an accessible modal for free. */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp();
  const path = usePathname();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label={t('nav_more')}
      className="m-0 mt-auto max-h-[85vh] w-full max-w-none rounded-t-xl bg-surface p-0 text-foreground backdrop:bg-black/30 md:hidden"
    >
      <div className="p-5 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <p className="t-card">{t('nav_more')}</p>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <ul className="space-y-1">
          {NAV.filter((n) => !n.primaryOnMobile).map(({ href, labelKey, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                aria-current={isActive(href, path) ? 'page' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-md px-3 font-medium ${
                  isActive(href, path)
                    ? 'bg-primary-light text-primary-hover'
                    : 'hover:bg-surface-muted'
                }`}
              >
                <Icon size={20} aria-hidden />
                <span className="flex-1">{t(labelKey)}</span>
                <ChevronRight size={18} className="text-foreground-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <AccountCard />
        </div>
      </div>
    </dialog>
  );
}

function BottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { t } = useApp();
  const path = usePathname();
  const inMore = NAV.some((n) => !n.primaryOnMobile && isActive(n.href, path));
  const item = (active: boolean) =>
    `flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-md text-[0.75rem] font-semibold ${
      active ? 'bg-primary-light text-primary-hover' : 'text-foreground-muted'
    }`;
  return (
    <nav
      aria-label={t('menu')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <ul className="grid grid-cols-4 gap-1">
        {NAV.filter((n) => n.primaryOnMobile).map(({ href, labelKey, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href, path) ? 'page' : undefined}
              className={item(isActive(href, path))}
            >
              <Icon size={21} aria-hidden />
              <span className="max-w-full truncate px-1">{t(labelKey)}</span>
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            className={item(inMore || moreOpen)}
          >
            <LayoutGrid size={21} aria-hidden />
            {t('nav_more')}
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Login, register and password pages: no app navigation, just the language selector. */
function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <main id="main">{children}</main>
    </div>
  );
}

function FullPageLoader() {
  const { t } = useApp();
  return (
    <div role="status" className="grid min-h-screen place-items-center text-foreground-muted">
      <span className="flex items-center gap-2">
        <Loader2 size={20} className="animate-spin" aria-hidden />
        {t('loading')}
      </span>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return isPublicPath(path) ? (
    <PublicShell>{children}</PublicShell>
  ) : (
    <PrivateShell>{children}</PrivateShell>
  );
}

/**
 * Private pages render only after the server confirms the session (GET /auth/me). This is a UX
 * guard; the API independently rejects every unauthenticated request for private data.
 */
function PrivateShell({ children }: { children: ReactNode }) {
  const { t } = useApp();
  const { status, signedOut } = useAuth();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const path = usePathname();
  const page = currentNav(path);

  useEffect(() => {
    if (status !== 'anonymous') return;
    const next = safeNext(path);
    router.replace(
      signedOut || next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`,
    );
  }, [status, signedOut, path, router]);

  if (status !== 'authenticated') return <FullPageLoader />;

  return (
    <div className="min-h-screen md:grid md:grid-cols-[var(--sidebar-width)_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-[var(--header-height)] items-center px-5">
          <Logo />
        </div>
        <nav aria-label={t('menu')} className="flex-1 overflow-y-auto px-3 py-2">
          <SidebarNav />
        </nav>
        <div className="p-3">
          <AccountCard />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-24 md:pb-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex h-16 max-w-[var(--content-max-width)] items-center justify-between gap-3 px-4 md:h-[var(--header-height)] md:px-8">
            <div className="md:hidden">
              <Logo />
            </div>
            <nav
              aria-label="Breadcrumb"
              className="hidden items-center gap-1.5 text-[0.875rem] md:flex"
            >
              <span className="text-foreground-muted">KaamSaathi</span>
              {page && page.href !== '/' && (
                <>
                  <ChevronRight size={16} className="text-foreground-subtle" aria-hidden />
                  <span className="font-semibold" aria-current="page">
                    {t(page.labelKey)}
                  </span>
                </>
              )}
            </nav>
            <div className="flex items-center gap-2 md:gap-3">
              <span className="hidden sm:inline-flex">
                <ModeBadge />
              </span>
              <LanguageSelect compact />
            </div>
          </div>
          {/* Mobile: demo status must stay visible even when the badge does not fit the header. */}
          <div className="flex justify-center pb-2 sm:hidden">
            <ModeBadge testId="mode-banner-mobile" />
          </div>
        </header>

        <main
          id="main"
          className="mx-auto w-full max-w-[var(--content-max-width)] flex-1 px-4 py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>

      <BottomNav onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
