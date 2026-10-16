'use client';

import { useState } from 'react';
import { Badge, Button, ErrorNote, Input, PageTitle, Panel, Toggle } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { useFmt } from '@/lib/format';
import { useAsync, useRules } from '@/lib/hooks';
import { useMe } from '@/lib/session';
import type { ApiClient, ApiClientSecret, Rule } from '@/lib/types';

/** Address robots use: this page's origin, unless it is open as localhost on the command-center computer. */
function useRobotUrl() {
  const info = useAsync(() => api.info().catch(() => null), []);
  if (typeof window === 'undefined') return { url: '', local: false };
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const configured = info.data?.public_url ?? '';
  return { url: local && configured && !configured.includes('localhost') ? configured : window.location.origin, local, configured };
}

function RobotsPanel() {
  const { t } = useI18n();
  const fmt = useFmt();
  const robots = useAsync(() => api.robots.list(), []);
  const robotUrl = useRobotUrl();
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [token, setToken] = useState<{ id: string; token: string }>();
  const [error, setError] = useState<string>();

  const create = async () => {
    setError(undefined);
    try {
      const res = await api.robots.create(id.trim(), name.trim() || id.trim());
      setToken({ id: id.trim(), token: res.token });
      setId('');
      setName('');
      robots.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    }
  };

  return (
    <Panel title={t('settings.robots')}>
      {token && (
        <div className="mb-4 space-y-2 rounded border border-warn/50 bg-warn/10 p-3 text-sm">
          <div className="text-warn">{t('settings.tokenNotice', { id: token.id })}</div>
          <pre className="overflow-x-auto rounded bg-ink-950 p-2 font-mono text-xs text-slate-100">{`CC_URL=${robotUrl.url}\nCC_TOKEN=${token.token}`}</pre>
          {robotUrl.local && (
            <div className="text-xs text-slate-400">{t('settings.lanHint', { url: robotUrl.configured || 'http://<computer>.local' })}</div>
          )}
          <div className="flex gap-2">
            <Button onClick={() => copyText(token.token)}>{t('settings.copy')}</Button>
            <Button onClick={() => setToken(undefined)}>{t('settings.done')}</Button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('common.name')}</th>
              <th>{t('common.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {robots.data?.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-slate-100">{r.id}</td>
                <td>
                  <Input
                    defaultValue={r.name}
                    onBlur={(e) =>
                      e.target.value !== r.name && api.robots.update(r.id, e.target.value, r.floor_plan_id).then(robots.reload)
                    }
                  />
                </td>
                <td>
                  {r.online ? (
                    <Badge tone="ok">online</Badge>
                  ) : (
                    <span className="text-xs text-slate-500">{t('robot.lastSeen', { ago: fmt.ago(r.last_seen) })}</span>
                  )}
                </td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  <Button
                    onClick={async () =>
                      confirm(t('settings.confirmRotate', { id: r.id })) &&
                      setToken({ id: r.id, token: (await api.robots.rotateToken(r.id)).token })
                    }
                  >
                    {t('settings.newToken')}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => confirm(t('settings.confirmDelete', { id: r.id })) && api.robots.remove(r.id).then(robots.reload)}
                  >
                    {t('common.delete')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder={`${t('settings.robotId')} (l1w-01)`} className="w-40" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('common.name')} className="w-56" />
        <Button variant="primary" disabled={!id.trim()} onClick={create}>
          {t('common.add')}
        </Button>
      </div>
      <ErrorNote error={error} />
    </Panel>
  );
}

function RulesPanel() {
  const { t } = useI18n();
  const rules = useRules();
  const [draft, setDraft] = useState<Rule>({
    category: '',
    label: '',
    requires_validation: true,
    notify_telegram: true,
    telegram_chat_id: '',
    min_confidence: 0.5,
  });
  const save = (rule: Rule) => api.rules.save(rule).then(rules.reload);
  return (
    <Panel title={t('settings.rules')}>
      <p className="mb-3 text-xs text-slate-400">{t('settings.rulesHelp')}</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{t('settings.category')}</th>
              <th>{t('settings.label')}</th>
              <th>{t('settings.requiresValidation')}</th>
              <th>{t('settings.telegram')}</th>
              <th>{t('settings.chatId')}</th>
              <th>{t('settings.minConfidence')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.data?.map((r) => (
              <tr key={r.category}>
                <td className="font-mono text-xs text-slate-300">{r.category}</td>
                <td>
                  <Input defaultValue={r.label} onBlur={(e) => e.target.value !== r.label && save({ ...r, label: e.target.value })} />
                </td>
                <td>
                  <Toggle checked={r.requires_validation} onChange={(v) => save({ ...r, requires_validation: v })} />
                </td>
                <td>
                  <Toggle checked={r.notify_telegram} onChange={(v) => save({ ...r, notify_telegram: v })} />
                </td>
                <td>
                  <Input
                    defaultValue={r.telegram_chat_id}
                    placeholder={t('settings.default')}
                    className="w-36"
                    onBlur={(e) => e.target.value !== r.telegram_chat_id && save({ ...r, telegram_chat_id: e.target.value })}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    defaultValue={r.min_confidence}
                    className="w-20"
                    onBlur={(e) => Number(e.target.value) !== r.min_confidence && save({ ...r, min_confidence: Number(e.target.value) })}
                  />
                </td>
                <td className="text-right">
                  {r.category !== 'unknown' && (
                    <Button variant="danger" onClick={() => api.rules.remove(r.category).then(rules.reload)}>
                      {t('common.delete')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
          placeholder={t('settings.codeHint')}
          className="w-72"
        />
        <Input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder={t('settings.label')}
          className="w-44"
        />
        <Button
          variant="primary"
          disabled={!draft.category || !draft.label}
          onClick={() => save(draft).then(() => setDraft({ ...draft, category: '', label: '' }))}
        >
          {t('common.add')}
        </Button>
      </div>
      <ErrorNote error={rules.error} />
    </Panel>
  );
}

/** Scope checkboxes; each scope is labelled by its first part (anomalies:read → apiClients.scope.anomalies). */
function ScopeChecks({ scopes, value, onChange }: { scopes: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const { tx } = useI18n();
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {scopes.map((s) => (
        <label key={s} title={s} className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs text-slate-300">
          <input
            type="checkbox"
            className="accent-cyan-500"
            checked={value.includes(s)}
            onChange={(e) => onChange(e.target.checked ? [...value, s] : value.filter((v) => v !== s))}
          />
          {tx('apiClients.scope', s.split(':')[0])}
        </label>
      ))}
    </div>
  );
}

/** Integration API clients (admins only): the secret is shown once, after create and after a new secret. */
function ApiClientsPanel() {
  const { t } = useI18n();
  const fmt = useFmt();
  const clients = useAsync(() => api.apiClients.list(), []);
  const origin = useRobotUrl().url;
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['anomalies:read']);
  const [secret, setSecret] = useState<ApiClientSecret & { name: string }>();
  const [copied, setCopied] = useState<string>();
  const [error, setError] = useState<string>();

  const run = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
      clients.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'));
    }
  };
  const copy = async (key: string, text: string) => {
    if (!(await copyText(text))) return;
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? undefined : k)), 1500);
  };
  const update = (c: ApiClient, patch: Partial<Pick<ApiClient, 'name' | 'scopes' | 'enabled'>>) =>
    run(() => api.apiClients.update(c.id, { name: c.name, scopes: c.scopes, enabled: c.enabled, ...patch }));
  const create = () =>
    run(async () => {
      const res = await api.apiClients.create(name.trim(), scopes);
      setSecret({ name: res.client.name, client_id: res.client.client_id, client_secret: res.client_secret });
      setName('');
    });
  const rotate = (c: ApiClient) =>
    confirm(t('apiClients.confirmRotate', { name: c.name })) &&
    run(async () => setSecret({ name: c.name, ...(await api.apiClients.rotateSecret(c.id)) }));
  const lastUsed = (iso: string | null) => (iso && Date.now() - Date.parse(iso) >= 864e5 ? fmt.dateTime(iso) : fmt.ago(iso));

  const available = clients.data?.scopes ?? [];
  const credentials =
    secret &&
    [
      `NETRA_API_URL=${origin}/api/ext/v1`,
      `NETRA_API_DOCS=${origin}/api/ext/docs`,
      `CLIENT_ID=${secret.client_id}`,
      `CLIENT_SECRET=${secret.client_secret}`,
    ].join('\n');
  const localOnly = /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin);

  return (
    <Panel
      title={t('apiClients.title')}
      actions={
        <a href="/api/ext/docs" target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
          {t('apiClients.docs')} ↗
        </a>
      }
    >
      <p className="mb-3 text-xs text-slate-400">{t('apiClients.help')}</p>
      {secret && credentials && (
        <div className="mb-4 space-y-2 rounded border border-warn/50 bg-warn/10 p-3 text-sm">
          <div className="text-warn">{t('apiClients.secretNotice', { name: secret.name })}</div>
          <pre className="overflow-x-auto rounded bg-ink-950 p-2 font-mono text-xs text-slate-100">{credentials}</pre>
          {localOnly && <div className="text-xs text-slate-400">{t('apiClients.localHint')}</div>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => copy('all', credentials)}>{copied === 'all' ? t('apiClients.copied') : t('apiClients.copyAll')}</Button>
            <Button onClick={() => copy('secret', secret.client_secret)}>
              {copied === 'secret' ? t('apiClients.copied') : t('apiClients.copySecret')}
            </Button>
            <Button onClick={() => setSecret(undefined)}>{t('settings.done')}</Button>
          </div>
        </div>
      )}
      {clients.data?.clients.length ? (
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>{t('apiClients.application')}</th>
                <th>{t('apiClients.clientId')}</th>
                <th>{t('apiClients.access')}</th>
                <th>{t('apiClients.enabled')}</th>
                <th className="whitespace-nowrap">{t('apiClients.lastUsed')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.data.clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Input
                      defaultValue={c.name}
                      maxLength={80}
                      className="w-48"
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== c.name) update(c, { name: value });
                      }}
                    />
                    <div className="mt-1 whitespace-nowrap text-[11px] text-slate-500">
                      {t('apiClients.createdBy', { user: c.created_by || '—', time: fmt.dateTime(c.created_at) })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="font-mono text-xs text-slate-100">{c.client_id}</span>{' '}
                    <button className="text-xs text-slate-400 hover:text-accent" onClick={() => copy(`id-${c.id}`, c.client_id)}>
                      {copied === `id-${c.id}` ? t('apiClients.copied') : t('apiClients.copy')}
                    </button>
                  </td>
                  <td>
                    {/* At least one scope stays; disable the client to cut it off. */}
                    <ScopeChecks scopes={available} value={c.scopes} onChange={(s) => s.length > 0 && update(c, { scopes: s })} />
                  </td>
                  <td>
                    <Toggle checked={c.enabled} onChange={(v) => update(c, { enabled: v })} />
                  </td>
                  <td className="whitespace-nowrap text-xs text-slate-400">{lastUsed(c.last_used_at)}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <Button onClick={() => rotate(c)}>{t('apiClients.newSecret')}</Button>
                    <Button
                      variant="danger"
                      onClick={() => confirm(t('apiClients.confirmDelete', { name: c.name })) && run(() => api.apiClients.remove(c.id))}
                    >
                      {t('common.delete')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        clients.data && <p className="text-sm text-slate-500">{t('apiClients.empty')}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('apiClients.namePlaceholder')}
          maxLength={80}
          className="w-64"
        />
        <ScopeChecks scopes={available} value={scopes} onChange={setScopes} />
        <Button variant="primary" disabled={!name.trim() || scopes.length === 0} onClick={create}>
          {t('apiClients.create')}
        </Button>
      </div>
      <div className="mt-3">
        <ErrorNote error={error ?? clients.error} />
      </div>
    </Panel>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { can } = useMe();
  return (
    <>
      <PageTitle title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="space-y-4">
        <RobotsPanel />
        <RulesPanel />
        {can('users') && <ApiClientsPanel />}
      </div>
    </>
  );
}
