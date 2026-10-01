'use client';

import { useState } from 'react';
import { Empty, ErrorNote, Input, PageTitle, Panel, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { presetRange, RANGE_PRESETS, useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';

export default function AuditPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const [preset, setPreset] = useState<string>('7d');
  const [user, setUser] = useState('');
  const entries = useAsync(() => api.audit(presetRange(preset), user || undefined), [preset, user]);
  return (
    <>
      <PageTitle
        title={t('audit.title')}
        subtitle={t('audit.subtitle')}
        actions={
          <>
            <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder={t('audit.filterUser')} className="w-44" />
            <Segmented value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.key, label: t(p.label) }))} />
          </>
        }
      />
      <ErrorNote error={entries.error} />
      <Panel>
        {entries.data?.length ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>{t('common.time')}</th>
                  <th>{t('audit.user')}</th>
                  <th>{t('audit.action')}</th>
                  <th>{t('audit.ip')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.map((e, i) => (
                  <tr key={`${e.ts}-${i}`}>
                    <td className="whitespace-nowrap text-xs text-slate-400">{fmt.dateTime(e.ts)}</td>
                    <td className="font-mono text-slate-100">{e.username}</td>
                    <td className={`font-mono text-xs ${e.action === 'login_failed' ? 'text-danger' : 'text-slate-300'}`}>{e.action}</td>
                    <td className="font-mono text-xs text-slate-500">{e.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t('audit.empty')}</Empty>
        )}
      </Panel>
    </>
  );
}
