'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
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
  IconHistory,
  IconKey,
  IconLayers,
  IconLogout,
  IconMap,
  IconMoon,
  IconReport,
  IconRoute,
  IconSettings,
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

/** Theme and language switches (also used on the login page). */
export function HeaderToggles() {
  const { theme, toggle } = useTheme();
  const { locale, setLocale, t } = useI18n();
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        title={theme === 'dark' ? t('header.light') : t('header.dark')}
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
    <span className="hidden font-mono text-sm text-slate-300 lg:inline">
      {new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(now)}
    </span>
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { me, can } = useMe();
  const { connected, online } = useLive();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const robotsOnline = Object.values(online).filter(Boolean).length;

  const logout = async () => {
    await api.logout().catch(() => undefined);
    session.clear();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-ink-600 bg-ink-900">
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
                  className="rounded p-1.5 text-slate-400 hover:bg-ink-700 hover:text-slate-100"
                >
                  <IconKey />
                </button>
                <button
                  onClick={logout}
                  title={t('nav.logout')}
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
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink-600 bg-ink-900/90 px-6 py-2.5 backdrop-blur">
          <div className="flex items-center gap-4">
            {/* Replace public/logos/*.svg with the official logo files. */}
            <img src="/logos/ezra.svg" alt="EZRA Robotics" className="h-7" />
            <span className="h-5 w-px bg-ink-500" />
            <img src="/logos/lippo.svg" alt="Lippo Mall" className="h-7" />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-2 text-slate-400">
              <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok' : 'bg-danger')} />
              {connected ? t('header.connected') : t('header.disconnected')}
            </span>
            <span className="text-slate-400">
              {t('header.robotsOnline')} <b className="text-slate-100">{robotsOnline}</b>
            </span>
            <Clock />
            <HeaderToggles />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <PasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
