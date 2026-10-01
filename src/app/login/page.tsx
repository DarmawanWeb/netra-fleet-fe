'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { api, session } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
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
      router.replace('/peta');
    } catch {
      setError('Nama pengguna atau kata sandi salah');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-ink-600 bg-ink-900/90 p-8 shadow-2xl">
        <div className="flex items-center justify-center gap-4 pb-2">
          <img src="/logos/ezra.svg" alt="EZRA Robotics" className="h-8" />
          <img src="/logos/lippo.svg" alt="Lippo Mall" className="h-8" />
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold tracking-[0.4em] text-accent">NETRA</div>
          <div className="text-xs uppercase tracking-widest text-slate-500">Patrol Command Center</div>
        </div>
        <Field label="Nama pengguna">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </Field>
        <Field label="Kata sandi">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <ErrorNote error={error} />
        <Button variant="primary" className="w-full" disabled={busy || !username || !password}>
          {busy ? 'Memeriksa…' : 'Masuk'}
        </Button>
      </form>
    </div>
  );
}
