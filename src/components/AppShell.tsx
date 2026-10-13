'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { useI18n, type MessageKey } from '@/i18n';
import { api, session } from '@/lib/api';
import { useLive } from '@/lib/live';
import { useMe } from '@/lib/session';
import { useTheme } from '@/lib/theme';
import type { Permission } from '@/lib/types';
import {
  IconAlert,
  IconAudit,
  IconCalendar,
  IconCrowd,
  IconFullscreen,
  IconFullscreenExit,
  IconHistory,
  IconKey,
  IconLayers,
  IconLogout,
  IconMap,
  IconMoon,
  IconReport,
  IconRoute,
  IconSettings,
  IconSidebar,
  IconSun,
  IconUsers,
} from './icons';
import { Badge, Button, ErrorNote, Field, Input, Modal, cx } from './ui';

interface NavItem {
  href: string;
  label: MessageKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  perm: Permission;
}

const SECTIONS: { title: MessageKey; items: NavItem[] }[] = [
  {
    title: 'nav.sectionOps',
    items: [
      { href: '/map', label: 'nav.map', icon: IconMap, perm: 'view' },
      { href: '/anomalies', label: 'nav.anomalies', icon: IconAlert, perm: 'view' },
      { href: '/patrols', label: 'nav.patrols', icon: IconHistory, perm: 'view' },
      { href: '/schedules', label: 'nav.schedules', icon: IconCalendar, perm: 'view' },
    ],
  },
  {
    title: 'nav.sectionData',
    items: [
      { href: '/routes', label: 'nav.routes', icon: IconRoute, perm: 'view' },
      { href: '/crowd', label: 'nav.crowd', icon: IconCrowd, perm: 'view' },
      { href: '/reports', label: 'nav.reports', icon: IconReport, perm: 'view' },
      { href: '/floor-plans', label: 'nav.floorPlans', icon: IconLayers, perm: 'configure' },
    ],
  },
  {
    title: 'nav.sectionAdmin',
    items: [
      { href: '/settings', label: 'nav.settings', icon: IconSettings, perm: 'configure' },
      { href: '/users', label: 'nav.users', icon: IconUsers, perm: 'users' },
      { href: '/audit', label: 'nav.audit', icon: IconAudit, perm: 'audit' },
    ],
  },
];

/** Pages that use the whole width with a thin margin (the wall dashboard). */
const DENSE = ['/dashboard'];

const SIDEBAR_KEY = 'netra.sidebar';
const WIDE = '(min-width: 1024px)';

/** Theme and language switches (also used on the login page). */
export function HeaderToggles() {
  const { theme, toggle } = useTheme();
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        title={theme === 'dark' ? t('header.light') : t('header.dark')}
        aria-label={theme === 'dark' ? t('header.light') : t('header.dark')}
        className="rounded p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100"
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
      <div className="flex rounded border border-ink-600 text-[11px]" title={t('header.language')}>
        {(['en', 'id'] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={cx(
              'px-2 py-1 uppercase',
              locale === l ? 'bg-accent text-white dark:text-ink-950' : 'text-slate-400 hover:text-slate-100',
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Clock() {
  const { intl } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return null;
  return (
    <span className="hidden text-sm tabular-nums text-slate-300 xl:inline">
      {new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(now)}
    </span>
  );
}

/** Browser fullscreen for a wall display; hidden where the Fullscreen API is missing (iPhone). */
function FullscreenButton() {
  const { t } = useI18n();
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  useEffect(() => {
    setSupported(!!document.fullscreenEnabled);
    const update = () => setActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  if (!supported) return null;
  const label = active ? t('header.exitFullscreen') : t('header.fullscreen');
  return (
    <button
      onClick={() => (active ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
      title={label}
      aria-label={label}
      className="rounded p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100"
    >
      {active ? <IconFullscreenExit /> : <IconFullscreen />}
    </button>
  );
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const submit = async () => {
    setError(undefined);
    try {
      await api.changePassword(current, next);
      setDone(true);
      setCurrent('');
      setNext('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    }
  };
  return (
    <Modal title={t('account.changePassword')} open={open} onClose={() => (setDone(false), onClose())}>
      <div className="space-y-3">
        <Field label={t('account.current')}>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label={t('account.new')}>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <p className="text-xs text-slate-500">{t('users.passwordMin')}</p>
        <ErrorNote error={error} />
        {done && <div className="text-sm text-ok">{t('account.changed')}</div>}
        <Button variant="primary" disabled={!current || next.length < 8} onClick={submit}>
          {t('common.save')}
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Sidebar state. Wide screens dock it (or hide it, remembered per browser); narrow screens open it
 * as a drawer over the page. The header button and the "[" key toggle whichever applies.
 */
function useSidebar() {
  const [docked, setDocked] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
  const [drawer, setDrawer] = useState(false);
  const toggle = useCallback(() => {
    if (window.matchMedia(WIDE).matches) {
      setDocked((d) => {
        try {
          localStorage.setItem(SIDEBAR_KEY, d ? 'hidden' : 'docked');
        } catch {
          /* private mode: not remembered */
        }
        return !d;
      });
    } else {
      setDrawer((o) => !o);
    }
  }, []);
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
  return { docked, drawer, setDrawer, toggle, open: wide ? docked : drawer };
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { me, can } = useMe();
  const { connected, online } = useLive();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { docked, drawer, setDrawer, toggle, open } = useSidebar();
  const robotsOnline = Object.values(online).filter(Boolean).length;
  const dense = DENSE.some((p) => pathname.startsWith(p));

  useEffect(() => setDrawer(false), [pathname, setDrawer]);

  const logout = async () => {
    await api.logout().catch(() => undefined);
    session.clear();
    router.replace('/login');
  };

  const sidebarLabel = open ? t('header.hideSidebar') : t('header.showSidebar');

  return (
    <div className="flex min-h-screen">
      {drawer && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setDrawer(false)} aria-hidden />}
      <aside
        id="netra-sidebar"
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-ink-600 bg-ink-900 transition-transform duration-200 motion-reduce:transition-none',
          drawer ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none',
          !docked && 'lg:hidden',
        )}
      >
        <div className="border-b border-ink-600 px-5 py-4">
          <div className="text-lg font-bold tracking-[0.35em] text-accent">NETRA</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Patrol Command Center</div>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {SECTIONS.map((section) => {
            const items = section.items.filter((i) => can(i.perm));
            if (!items.length) return null;
            return (
              <div key={section.title}>
                <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t(section.title)}</div>
                {items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cx(
                      'flex items-center gap-3 rounded px-3 py-2 text-sm transition',
                      pathname.startsWith(href) ? 'bg-accent/15 text-accent' : 'text-slate-300 hover:bg-ink-700 hover:text-slate-100',
                    )}
                  >
                    <Icon />
                    {t(label)}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        {me && (
          <div className="border-t border-ink-600 p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-100">{me.display_name || me.username}</div>
                <Badge tone="info">{t(`users.roles.${me.role}`)}</Badge>
              </div>
              <div className="flex">
                <button
                  onClick={() => setPasswordOpen(true)}
                  title={t('header.changePassword')}
                  aria-label={t('header.changePassword')}
                  className="rounded p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100"
                >
                  <IconKey />
                </button>
                <button
                  onClick={logout}
                  title={t('nav.logout')}
                  aria-label={t('nav.logout')}
                  className="rounded p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100"
                >
                  <IconLogout />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-ink-600 bg-ink-900/90 px-3 backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={toggle}
              title={`${sidebarLabel} ([)`}
              aria-label={sidebarLabel}
              aria-controls="netra-sidebar"
              aria-expanded={open}
              className="rounded p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100"
            >
              <IconSidebar />
            </button>
            {!docked && <span className="hidden text-sm font-bold tracking-[0.35em] text-accent lg:inline">NETRA</span>}
            {/* Replace public/logos/*.svg with the official logo files. */}
            <img src="/logos/ezra.svg" alt="EZRA Robotics" className="h-6 sm:h-7" />
            <span className="hidden h-5 w-px bg-ink-500 sm:block" />
            <img src="/logos/lippo.svg" alt="Lippo Mall" className="hidden h-7 sm:block" />
          </div>
          <div className="flex items-center gap-3 text-xs sm:gap-4">
            <span className="flex items-center gap-2 text-slate-400">
              <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok' : 'bg-danger')} />
              <span className="hidden sm:inline">{connected ? t('header.connected') : t('header.disconnected')}</span>
            </span>
            <span className="hidden text-slate-400 md:inline">
              {t('header.robotsOnline')} <b className="text-slate-100">{robotsOnline}</b>
            </span>
            <Clock />
            <FullscreenButton />
            <HeaderToggles />
          </div>
        </header>
        <main className={cx('flex-1', dense ? 'p-2 sm:p-3' : 'p-4 sm:p-6')}>{children}</main>
      </div>
      <PasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
