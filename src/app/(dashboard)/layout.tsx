'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { session } from '@/lib/api';
import { LiveProvider } from '@/lib/live';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!session.token()) router.replace('/login');
    else setReady(true);
  }, [router]);
  if (!ready) return null;
  return (
    <LiveProvider>
      <AppShell>{children}</AppShell>
    </LiveProvider>
  );
}
