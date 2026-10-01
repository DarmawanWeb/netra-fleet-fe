'use client';

import { useState } from 'react';
import { Badge, Button, ErrorNote, Field, Input, Modal, PageTitle, Panel, Select } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import { useMe } from '@/lib/session';
import type { Role, User } from '@/lib/types';

const ROLES: Role[] = ['viewer', 'operator', 'supervisor', 'admin'];

export default function UsersPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const { me } = useMe();
  const users = useAsync(() => api.users.list(), []);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState({ username: '', display_name: '', role: 'operator' as Role, password: '' });
  const [resetFor, setResetFor] = useState<User>();
  const [newPassword, setNewPassword] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
      users.reload();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
      return false;
    }
  };

  return (
    <>
      <PageTitle title={t('users.title')} subtitle={t('users.subtitle')} />
      <ErrorNote error={error ?? users.error} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>{t('users.username')}</th>
                  <th>{t('users.displayName')}</th>
                  <th>{t('users.role')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('users.lastLogin')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data?.map((u) => {
                  const self = u.username === me?.username;
                  return (
                    <tr key={u.id}>
                      <td className="font-mono text-slate-100">
                        {u.username} {self && <span className="text-xs text-slate-500">({t('users.you')})</span>}
                      </td>
                      <td>
                        <Input
                          defaultValue={u.display_name}
                          onBlur={(e) =>
                            e.target.value !== u.display_name && run(() => api.users.update(u.id, { ...u, display_name: e.target.value }))
                          }
                        />
                      </td>
                      <td>
                        <Select
                          value={u.role}
                          disabled={self}
                          onChange={(e) => run(() => api.users.update(u.id, { ...u, role: e.target.value as Role }))}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`users.roles.${r}`)}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <Badge tone={u.disabled ? 'muted' : 'ok'}>{u.disabled ? t('users.disabled') : t('users.active')}</Badge>
                      </td>
                      <td className="text-xs text-slate-400">{fmt.dateTime(u.last_login)}</td>
                      <td className="space-x-1 whitespace-nowrap text-right">
                        <Button onClick={() => (setResetFor(u), setNewPassword(''))}>{t('users.resetPassword')}</Button>
                        {!self && (
                          <>
                            <Button onClick={() => run(() => api.users.update(u.id, { ...u, disabled: !u.disabled }))}>
                              {u.disabled ? t('users.enable') : t('users.disable')}
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => confirm(t('users.deleteConfirm', { name: u.username })) && run(() => api.users.remove(u.id))}
                            >
                              {t('common.delete')}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title={t('users.add')}>
            <div className="space-y-3">
              <Field label={t('users.username')}>
                <Input
                  value={draft.username}
                  onChange={(e) => setDraft({ ...draft, username: e.target.value.toLowerCase() })}
                  placeholder="jdoe"
                />
              </Field>
              <Field label={t('users.displayName')}>
                <Input value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} />
              </Field>
              <Field label={t('users.role')}>
                <Select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`users.roles.${r}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('users.password')}>
                <Input
                  type="password"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  autoComplete="new-password"
                />
              </Field>
              <p className="text-xs text-slate-500">{t('users.passwordMin')}</p>
              <Button
                variant="primary"
                disabled={draft.username.length < 3 || draft.password.length < 8}
                onClick={async () =>
                  (await run(() => api.users.create(draft))) && setDraft({ username: '', display_name: '', role: 'operator', password: '' })
                }
              >
                {t('common.add')}
              </Button>
            </div>
          </Panel>
          <Panel title={t('users.role')}>
            <dl className="space-y-2 text-sm">
              {ROLES.map((r) => (
                <div key={r}>
                  <dt className="font-medium text-slate-100">{t(`users.roles.${r}`)}</dt>
                  <dd className="text-xs text-slate-400">{t(`users.roleHelp.${r}`)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
      <Modal title={t('users.newPassword', { name: resetFor?.username ?? '' })} open={!!resetFor} onClose={() => setResetFor(undefined)}>
        <div className="space-y-3">
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          <p className="text-xs text-slate-500">{t('users.passwordMin')}</p>
          <Button
            variant="primary"
            disabled={newPassword.length < 8}
            onClick={async () => (await run(() => api.users.resetPassword(resetFor!.id, newPassword))) && setResetFor(undefined)}
          >
            {t('common.save')}
          </Button>
        </div>
      </Modal>
    </>
  );
}
