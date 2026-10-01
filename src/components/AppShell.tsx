'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { session } from '@/lib/api';
import { useLive } from '@/lib/live';
import { cx } from './ui';
import {
  IconAlert,
  IconCalendar,
  IconCrowd,
  IconHistory,
  IconLayers,
  IconLogout,
  IconMap,
  IconRoute,
  IconSettings,
} from './icons';

const NAV = [
  { href: '/peta', label: 'Peta Operasi', icon: IconMap },
  { href: '/anomali', label: 'Anomali', icon: IconAlert },
  { href: '/patroli', label: 'Patroli', icon: IconHistory },
  { href: '/jadwal', label: 'Jadwal', icon: IconCalendar },
  { href: '/rute', label: 'Rute', icon: IconRoute },
  { href: '/keramaian', label: 'Keramaian', icon: IconCrowd },
  { href: '/denah', label: 'Denah', icon: IconLayers },
  { href: '/pengaturan', label: 'Pengaturan', icon: IconSettings },
];

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="font-mono text-sm text-slate-300">
      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(now)} WIB
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { connected, online } = useLive();
  const robotsOnline = Object.values(online).filter(Boolean).length;

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-ink-600 bg-ink-900">
        <div className="border-b border-ink-600 px-5 py-4">
          <div className="text-lg font-bold tracking-[0.35em] text-accent">NETRA</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Patrol Command Center</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                'flex items-center gap-3 rounded px-3 py-2 text-sm transition',
                pathname.startsWith(href) ? 'bg-accent/15 text-accent' : 'text-slate-300 hover:bg-ink-700 hover:text-white',
              )}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>
        <button
          className="m-2 flex items-center gap-3 rounded px-3 py-2 text-sm text-slate-400 hover:bg-ink-700 hover:text-white"
          onClick={() => {
            session.clear();
            router.replace('/login');
          }}
        >
          <IconLogout />
          Keluar
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-ink-600 bg-ink-900/90 px-6 py-2.5 backdrop-blur">
          <div className="flex items-center gap-4">
            {/* Replace public/logos/*.svg with the official logo files. */}
            <img src="/logos/ezra.svg" alt="EZRA Robotics" className="h-7" />
            <span className="h-5 w-px bg-ink-500" />
            <img src="/logos/lippo.svg" alt="Lippo Mall" className="h-7" />
          </div>
          <div className="flex items-center gap-5 text-xs">
            <span className="flex items-center gap-2 text-slate-400">
              <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok' : 'bg-danger')} />
              {connected ? 'Terhubung' : 'Terputus'}
            </span>
            <span className="text-slate-400">
              Robot aktif <b className="text-slate-100">{robotsOnline}</b>
            </span>
            <Clock />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
