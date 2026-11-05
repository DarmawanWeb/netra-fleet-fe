'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HeaderToggles, featureLabel } from '@/components/AppShell';
import { Badge, Button, ErrorNote, Field, Input, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api, ApiError, session } from '@/lib/api';
import { useBranding } from '@/lib/branding';
import { copyText } from '@/lib/clipboard';
import type { LicenseInfo, SetupState } from '@/lib/types';

type Step = 'welcome' | 'admin' | 'license' | 'done';
const STEPS: Step[] = ['welcome', 'admin', 'license', 'done'];

function StepDots({ step }: { step: Step }) {
  const { t } = useI18n();
  const at = STEPS.indexOf(step);
  return (
    <ol className="flex items-center gap-2" aria-label={t('setup.progress')}>
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            aria-current={i === at ? 'step' : undefined}
            className={cx(
              'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ring-1',
              i < at && 'bg-accent/20 text-accent ring-accent/50',
              i === at && 'bg-accent text-ink-950 ring-accent',
              i > at && 'text-slate-500 ring-ink-500',
            )}
          >
            {i < at ? '✓' : i + 1}
          </span>
          <span className={cx('hidden text-xs sm:inline', i === at ? 'text-slate-100' : 'text-slate-500')}>{t(`setup.steps.${s}`)}</span>
          {i < STEPS.length - 1 && <span className="h-px w-4 bg-ink-500 sm:w-6" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function InstallationId({ id }: { id: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{t('license.installation')}</div>
      <div className="mt-1 select-all font-mono text-xl font-semibold tracking-wider text-slate-50 sm:text-2xl">{id}</div>
      <button
        type="button"
        onClick={() => copyText(id).then(() => (setCopied(true), setTimeout(() => setCopied(false), 2000)))}
        className="mt-2 text-xs text-accent hover:underline"
      >
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-lg space-y-5 rounded-xl border border-ink-600 bg-ink-900/90 p-6 shadow-2xl sm:p-8">{children}</div>;
}

/**
 * First-run setup of a new installation: the installation ID (the license is issued for it), the
 * first administrator, the license. Open only while the server has no account.
 */
export default function SetupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { branding, refresh } = useBranding();
  const [state, setState] = useState<SetupState>();
  const [step, setStep] = useState<Step>('welcome');
  const [username, setUsername] = useState('admin');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [license, setLicense] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LicenseInfo>();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.setup
      .state()
      .then((s) => (s.required ? setState(s) : router.replace('/login')))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('common.failed')));
  }, [router, t]);

  const adminOk = /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) && password.length >= 8 && password === confirm;

  const finish = async (withLicense: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api.setup.run({
        username,
        display_name: displayName.trim(),
        password,
        license: withLicense ? license.trim() : undefined,
      });
      session.set(res.token);
      setResult(res.license);
      refresh();
      setStep('done');
    } catch (e) {
      const message = e instanceof Error ? e.message : t('common.failed');
      if (e instanceof ApiError && e.status === 409) router.replace('/login');
      else if (message.startsWith('license')) setError(t('license.error', { error: message.replace(/^license: /, '') }));
      else setError(message), setStep('admin');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4 sm:p-6">
      <div className="absolute right-4 top-4">
        <HeaderToggles />
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold tracking-[0.4em] text-accent">{branding.name}</div>
        <div className="text-xs uppercase tracking-widest text-slate-500">{t('setup.title')}</div>
      </div>
      <StepDots step={step} />
      {!state ? (
        <Card>{error ? <ErrorNote error={error} /> : <div className="text-sm text-slate-400">{t('common.loading')}</div>}</Card>
      ) : step === 'welcome' ? (
        <Card>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">{t('setup.welcome')}</h1>
            <p className="mt-1 text-sm text-slate-400">{t('setup.welcomeHelp')}</p>
          </div>
          <InstallationId id={state.installation_id} />
          <p className="text-xs text-slate-400">{t('setup.idHelp')}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{t('setup.version', { version: state.version })}</span>
            <Button variant="primary" onClick={() => setStep('admin')}>
              {t('setup.next')}
            </Button>
          </div>
        </Card>
      ) : step === 'admin' ? (
        <Card>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">{t('setup.adminTitle')}</h1>
            <p className="mt-1 text-sm text-slate-400">{t('setup.adminHelp')}</p>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (adminOk) setError(undefined), setStep('license');
            }}
          >
            <Field label={t('login.username')}>
              <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" autoFocus />
            </Field>
            <Field label={`${t('users.displayName')} (${t('common.optional')})`}>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('login.password')}>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </Field>
              <Field label={t('setup.confirm')}>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              {confirm && confirm !== password ? <span className="text-danger">{t('setup.mismatch')}</span> : t('setup.passwordRule')}
            </p>
            <ErrorNote error={error} />
            <div className="flex justify-between">
              <Button type="button" onClick={() => setStep('welcome')}>
                {t('common.back')}
              </Button>
              <Button variant="primary" disabled={!adminOk}>
                {t('setup.next')}
              </Button>
            </div>
          </form>
        </Card>
      ) : step === 'license' ? (
        <Card>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">{t('license.upload')}</h1>
            <p className="mt-1 text-sm text-slate-400">{t('setup.licenseHelp', { id: state.installation_id })}</p>
          </div>
          <textarea
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="NETRA-LIC-1.…"
            aria-label={t('license.upload')}
            className="w-full rounded border border-ink-600 bg-ink-950 p-2 font-mono text-xs text-slate-100"
          />
          <input
            ref={file}
            type="file"
            accept=".lic,.txt,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setLicense((await f.text()).trim());
            }}
          />
          <ErrorNote error={error} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" onClick={() => setStep('admin')}>
              {t('common.back')}
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => file.current?.click()}>
                {t('license.chooseFile')}
              </Button>
              <Button variant="primary" disabled={busy || !license.trim().startsWith('NETRA-LIC-')} onClick={() => finish(true)}>
                {t('setup.finish')}
              </Button>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => finish(false)}
            className="w-full text-center text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            {t('setup.skipLicense')}
          </button>
        </Card>
      ) : (
        <Card>
          <div>
            <h1 className="text-lg font-semibold text-slate-100">{t('setup.doneTitle')}</h1>
            <p className="mt-1 text-sm text-slate-400">{t('setup.doneHelp', { username })}</p>
          </div>
          {result && result.status === 'valid' ? (
            <div className="space-y-2 rounded-lg border border-ok/40 bg-ok/5 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{result.client}</span>
                <Badge tone="ok">{t('license.status.valid')}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.features.map((f) => (
                  <Badge key={f} tone="info">
                    {t(featureLabel(f))}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn">{t('license.bannerMissing')}</p>
          )}
          <Button variant="primary" className="w-full" onClick={() => router.replace('/dashboard')}>
            {t('setup.open')}
          </Button>
        </Card>
      )}
    </div>
  );
}
