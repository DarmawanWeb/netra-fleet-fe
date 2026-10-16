'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { HeaderToggles } from '@/components/AppShell';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api, ApiError, session } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { token } = await api.login(username, password);
      session.set(token);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('login.throttled') : t('login.wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="absolute right-4 top-4">
        <HeaderToggles />
      </div>
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-ink-600 bg-ink-900/90 p-8 shadow-2xl">
        <div className="flex items-center justify-center pb-2">
          <img src="/logos/ezra.svg" alt="EZRA Robotics" className="h-8" />
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tracking-[0.4em] text-accent">NETRA</div>
          <div className="text-xs uppercase tracking-widest text-slate-500">{t('login.subtitle')}</div>
        </div>
        <Field label={t('login.username')}>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </Field>
        <Field label={t('login.password')}>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <ErrorNote error={error} />
        <Button variant="primary" className="w-full" disabled={busy || !username || !password}>
          {busy ? t('login.checking') : t('login.submit')}
        </Button>
      </form>
    </div>
  );
}
