'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Empty, ErrorNote, PageTitle, Panel, Stat } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import type { LicenseStatus } from '@/lib/types';

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** 1536 -> "1.5 KB". */
function bytes(n: number | undefined): string {
  if (n === undefined) return '—';
  let i = 0;
  let v = n;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${UNITS[i]}`;
}

const LICENSE_TONE: Record<LicenseStatus, 'ok' | 'warn' | 'danger' | undefined> = {
  valid: 'ok',
  grace: 'warn',
  expired: 'danger',
  invalid: 'danger',
  missing: 'warn',
};

/** How the installation runs, its disk and its backups (administrators). */
export default function SystemPage() {
  const { t, tx } = useI18n();
  const fmt = useFmt();
  const status = useAsync(() => api.system.get(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const s = status.data;

  const backupNow = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.system.backupNow();
      status.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const freeShare = s?.disk.free_bytes !== undefined && s.disk.total_bytes ? s.disk.free_bytes / s.disk.total_bytes : undefined;

  return (
    <>
      <PageTitle title={t('system.title')} subtitle={t('system.subtitle')} />
      <ErrorNote error={status.error} />
      {s && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Stat label={t('system.version')} value={s.version} hint={t('system.since', { time: fmt.dateTime(s.started_at) })} />
            <Stat label={t('system.uptime')} value={fmt.span(s.uptime_s * 1000)} hint={s.time_zone} />
            <Stat
              label={t('system.database')}
              value={bytes(s.database.size_bytes)}
              hint={s.database.managed ? t('system.dbManaged') : t('system.dbExternal')}
            />
            <Stat
              label={t('system.diskFree')}
              value={bytes(s.disk.free_bytes)}
              hint={s.disk.total_bytes ? t('system.ofTotal', { total: bytes(s.disk.total_bytes) }) : undefined}
              tone={freeShare !== undefined && freeShare < 0.1 ? 'danger' : freeShare !== undefined && freeShare < 0.2 ? 'warn' : undefined}
            />
            <Stat label={t('system.robots')} value={`${s.robots.online} / ${s.robots.registered}`} hint={t('system.robotsHint')} />
            <Stat
              label={t('license.title')}
              value={tx('license.status', s.license.status)}
              hint={s.license.expires_at ? t('system.until', { date: fmt.dateTime(s.license.expires_at) }) : undefined}
              tone={LICENSE_TONE[s.license.status]}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Panel
              title={t('system.backups')}
              actions={
                s.backups.enabled && (
                  <Button variant="primary" disabled={busy} onClick={backupNow} className="whitespace-nowrap">
                    {busy ? t('system.backingUp') : t('system.backupNow')}
                  </Button>
                )
              }
            >
              {s.backups.enabled ? (
                <>
                  <p className="mb-3 text-xs text-slate-400">
                    {t('system.backupsHelp', { at: s.backups.at ?? '', days: s.backups.keep_days ?? 0 })}{' '}
                    <span className="font-mono text-slate-300">{s.backups.dir}</span>
                  </p>
                  {s.backups.list.length ? (
                    <div className="max-h-80 overflow-auto">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('system.file')}</th>
                            <th>{t('common.time')}</th>
                            <th className="text-right">{t('system.size')}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {s.backups.list.map((b) => (
                            <tr key={b.name}>
                              <td className="font-mono text-xs text-slate-200">{b.name}</td>
                              <td>{fmt.dateTime(b.created)}</td>
                              <td className="text-right tabular-nums">{bytes(b.size)}</td>
                              <td className="text-right">
                                <a href={api.system.backupUrl(b.name)} className="text-xs text-accent hover:underline">
                                  {t('common.download')}
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty>{t('system.noBackups')}</Empty>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-400">{t('system.backupsOff')}</p>
              )}
              <ErrorNote error={error} />
            </Panel>

            <div className="space-y-4">
              <Panel title={t('system.installation')}>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">{t('license.installation')}</dt>
                    <dd>
                      <button
                        type="button"
                        title={t('common.copy')}
                        onClick={() => copyText(s.installation_id)}
                        className="font-mono text-xs text-slate-100 hover:text-accent"
                      >
                        {s.installation_id} ⧉
                      </button>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">{t('license.map')}</dt>
                    <dd className="text-slate-200">{tx('license.maps', s.map_mode)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">HTTPS</dt>
                    <dd>{s.tls ? <Badge tone="ok">{t('system.on')}</Badge> : <Badge>{t('system.off')}</Badge>}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-slate-500">{t('system.data')}</dt>
                    <dd className="text-right text-slate-200">
                      {bytes(s.disk.data_bytes)}
                      <span className="block break-all font-mono text-[11px] text-slate-500">{s.disk.path}</span>
                    </dd>
                  </div>
                </dl>
                <Link href="/settings#license" className="mt-3 inline-block text-xs text-accent">
                  {t('license.title')} →
                </Link>
              </Panel>
              <Panel title={t('system.console')}>
                <p className="mb-2 text-xs text-slate-400">{t('system.consoleHelp')}</p>
                <pre className="overflow-x-auto rounded bg-ink-950 p-3 font-mono text-[11px] leading-5 text-slate-200">
                  {`netra reset-password admin
netra backup
netra restore -yes <file.dump>
netra installation-id
netra license <file.lic>`}
                </pre>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
