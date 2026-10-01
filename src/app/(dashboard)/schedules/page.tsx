'use client';

import { useState } from 'react';
import { Badge, Button, Empty, ErrorNote, Field, Input, PageTitle, Panel, Segmented, Select, Toggle, cx } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/hooks';
import { DAY_KEYS } from '@/lib/labels';
import { useMe } from '@/lib/session';
import type { Schedule } from '@/lib/types';

type Draft = Omit<Schedule, 'id' | 'last_run_on'> & { id?: number };
const EMPTY: Draft = { robot_id: '', route_id: 0, name: '', days: [1, 2, 3, 4, 5], time_of_day: '09:00', enabled: true, once_on: null };

export default function SchedulesPage() {
  const { t } = useI18n();
  const { me, can } = useMe();
  const schedules = useAsync(() => api.schedules.list(), []);
  const robots = useAsync(() => api.robots.list(), []);
  const routes = useAsync(() => api.routes.list(), []);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string>();
  const routeName = (id: number) => routes.data?.find((r) => r.id === id)?.name ?? `#${id}`;
  const editable = can('operate');

  const save = async () => {
    setError(undefined);
    try {
      await api.schedules.save(draft);
      setDraft(EMPTY);
      schedules.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    }
  };
  const toggle = async (s: Schedule) => {
    await api.schedules.save({ ...s, enabled: !s.enabled });
    schedules.reload();
  };
  const when = (s: Schedule) =>
    s.once_on
      ? t('schedules.onDate', { date: s.once_on })
      : s.days.length === 7
        ? t('schedules.everyDay')
        : s.days.map((d) => t(`days.${DAY_KEYS[d]!}`)).join(', ');

  return (
    <>
      <PageTitle title={t('schedules.title')} subtitle={t('schedules.subtitle', { tz: me?.timezone ?? 'Asia/Jakarta' })} />
      <div className={editable ? 'grid gap-4 xl:grid-cols-[1fr_360px]' : ''}>
        <Panel title={t('schedules.list')}>
          {schedules.data?.length ? (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>{t('common.name')}</th>
                    <th>{t('common.robot')}</th>
                    <th>{t('common.route')}</th>
                    <th>{t('schedules.days')}</th>
                    <th>{t('schedules.time')}</th>
                    <th>{t('schedules.lastRun')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {schedules.data.map((s) => (
                    <tr key={s.id}>
                      <td className="text-slate-100">{s.name}</td>
                      <td>{s.robot_id}</td>
                      <td>{routeName(s.route_id)}</td>
                      <td className="text-xs">{when(s)}</td>
                      <td className="font-mono">{s.time_of_day}</td>
                      <td className="text-xs text-slate-400">{s.last_run_on ?? '—'}</td>
                      <td className="space-x-2 whitespace-nowrap text-right">
                        {editable ? (
                          <>
                            <Toggle checked={s.enabled} onChange={() => toggle(s)} />
                            <Button onClick={() => setDraft(s)}>{t('common.edit')}</Button>
                            <Button
                              variant="danger"
                              onClick={() =>
                                confirm(t('schedules.deleteConfirm', { name: s.name })) && api.schedules.remove(s.id).then(schedules.reload)
                              }
                            >
                              {t('common.delete')}
                            </Button>
                          </>
                        ) : (
                          <Badge tone={s.enabled ? 'ok' : 'muted'}>{s.enabled ? t('schedules.enabled') : '—'}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{t('schedules.empty')}</Empty>
          )}
        </Panel>
        {editable && (
          <Panel
            title={draft.id ? t('schedules.editing') : t('schedules.new')}
            actions={draft.id ? <Badge tone="info">#{draft.id}</Badge> : null}
          >
            <div className="space-y-3">
              <Field label={t('common.name')}>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder={t('schedules.namePlaceholder')}
                />
              </Field>
              <Field label={t('common.robot')}>
                <Select value={draft.robot_id} onChange={(e) => setDraft({ ...draft, robot_id: e.target.value, route_id: 0 })}>
                  <option value="">{t('common.selectRobot')}</option>
                  {robots.data?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('common.route')}>
                <Select value={draft.route_id || ''} onChange={(e) => setDraft({ ...draft, route_id: Number(e.target.value) })}>
                  <option value="">{t('common.selectRoute')}</option>
                  {routes.data
                    ?.filter((r) => r.robot_id === draft.robot_id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={t('schedules.repeat')}>
                <Segmented<'weekly' | 'once'>
                  value={draft.once_on ? 'once' : 'weekly'}
                  onChange={(v) => setDraft({ ...draft, once_on: v === 'once' ? new Date().toISOString().slice(0, 10) : null })}
                  options={[
                    { value: 'weekly', label: t('schedules.weekly') },
                    { value: 'once', label: t('schedules.once') },
                  ]}
                />
              </Field>
              {draft.once_on ? (
                <Field label={t('schedules.date')}>
                  <Input type="date" value={draft.once_on} onChange={(e) => setDraft({ ...draft, once_on: e.target.value })} />
                </Field>
              ) : (
                <Field label={t('schedules.days')}>
                  <div className="flex gap-1">
                    {DAY_KEYS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            days: draft.days.includes(i) ? draft.days.filter((x) => x !== i) : [...draft.days, i].sort(),
                          })
                        }
                        className={cx(
                          'flex-1 rounded py-1.5 text-xs',
                          draft.days.includes(i) ? 'bg-accent text-white dark:text-ink-950' : 'border border-ink-500 text-slate-400',
                        )}
                      >
                        {t(`days.${d}`)}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              <Field label={t('schedules.time')}>
                <Input type="time" value={draft.time_of_day} onChange={(e) => setDraft({ ...draft, time_of_day: e.target.value })} />
              </Field>
              <Toggle checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} label={t('schedules.enabled')} />
              <ErrorNote error={error} />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  disabled={!draft.robot_id || !draft.route_id || (!draft.once_on && !draft.days.length)}
                  onClick={save}
                >
                  {t('common.save')}
                </Button>
                {draft.id && <Button onClick={() => setDraft(EMPTY)}>{t('common.cancel')}</Button>}
              </div>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
