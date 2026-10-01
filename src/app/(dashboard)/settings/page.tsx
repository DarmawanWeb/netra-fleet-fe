'use client';

import { useState } from 'react';
import { Badge, Button, ErrorNote, Input, PageTitle, Panel, Toggle } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { useAsync, useRules } from '@/lib/hooks';
import type { Rule } from '@/lib/types';

function RobotsPanel() {
  const { t } = useI18n();
  const fmt = useFmt();
  const robots = useAsync(() => api.robots.list(), []);
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
          <pre className="overflow-x-auto rounded bg-ink-950 p-2 font-mono text-xs text-slate-100">{`CC_URL=${location.origin}\nCC_TOKEN=${token.token}`}</pre>
          <div className="flex gap-2">
            <Button onClick={() => navigator.clipboard.writeText(token.token)}>{t('settings.copy')}</Button>
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

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <>
      <PageTitle title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="space-y-4">
        <RobotsPanel />
        <RulesPanel />
      </div>
    </>
  );
}
