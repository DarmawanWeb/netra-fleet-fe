'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, ErrorNote, Field, Input, Modal, Select, Toggle } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import type { Asset, AssetInput } from '@/lib/types';

export const ASSET_KINDS = [
  'transformer',
  'breaker',
  'disconnector',
  'current_transformer',
  'voltage_transformer',
  'surge_arrester',
  'busbar',
  'bushing',
  'connector',
  'cable_termination',
  'capacitor',
  'reactor',
  'insulator',
  'other',
];

const blank: AssetInput = {
  tag: '',
  name: '',
  kind: 'disconnector',
  bay: '',
  voltage_kv: null,
  phase: '',
  x: null,
  y: null,
  notes: '',
  archived: false,
};

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** Add or change an asset; on change, archive or delete it too. */
export function AssetForm({
  asset,
  bays,
  open,
  onClose,
  onSaved,
}: {
  asset?: Asset;
  bays: string[];
  open: boolean;
  onClose: () => void;
  onSaved: (a?: Asset) => void;
}) {
  const { t, tx } = useI18n();
  const [form, setForm] = useState<AssetInput>(blank);
  const [text, setText] = useState({ voltage: '', x: '', y: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    const a = asset ?? blank;
    setForm({
      tag: a.tag,
      name: a.name,
      kind: a.kind,
      bay: a.bay,
      voltage_kv: a.voltage_kv,
      phase: a.phase,
      x: a.x,
      y: a.y,
      notes: a.notes,
      archived: a.archived,
    });
    setText({ voltage: a.voltage_kv?.toString() ?? '', x: a.x?.toString() ?? '', y: a.y?.toString() ?? '' });
    setError(undefined);
  }, [open, asset]);

  const set = <K extends keyof AssetInput>(k: K, v: AssetInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const saved = await api.substation.saveAsset({ ...form, voltage_kv: num(text.voltage), x: num(text.x), y: num(text.y) }, asset?.id);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!asset || !window.confirm(t('substation.assets.confirmDelete', { tag: asset.tag }))) return;
    setBusy(true);
    try {
      await api.substation.removeAsset(asset.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={asset ? t('substation.assets.edit', { tag: asset.tag }) : t('substation.assets.add')} open={open} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-[1fr_1.6fr] gap-3">
          <Field label={t('substation.assets.tag')}>
            <Input
              value={form.tag}
              onChange={(e) => set('tag', e.target.value)}
              required
              maxLength={40}
              placeholder="PMS-L1"
              className="font-mono"
            />
          </Field>
          <Field label={t('common.name')}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('substation.assets.kind')}>
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              {ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {tx('substation.kinds', k)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('substation.assets.bay')}>
            <Input value={form.bay} onChange={(e) => set('bay', e.target.value)} list="netra-bays" maxLength={80} />
            <datalist id="netra-bays">
              {bays.filter(Boolean).map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Field label="kV">
            <Input
              inputMode="decimal"
              value={text.voltage}
              onChange={(e) => setText((x) => ({ ...x, voltage: e.target.value }))}
              placeholder="150"
            />
          </Field>
          <Field label={t('substation.assets.phase')}>
            <Input value={form.phase} onChange={(e) => set('phase', e.target.value)} maxLength={8} placeholder="R" />
          </Field>
          <Field label="x (m)">
            <Input inputMode="decimal" value={text.x} onChange={(e) => setText((x) => ({ ...x, x: e.target.value }))} />
          </Field>
          <Field label="y (m)">
            <Input inputMode="decimal" value={text.y} onChange={(e) => setText((x) => ({ ...x, y: e.target.value }))} />
          </Field>
        </div>
        <p className="-mt-1 text-[11px] text-slate-500">{t('substation.assets.positionHelp')}</p>
        <Field label={t('substation.assets.notes')}>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full rounded border border-ink-500 bg-ink-950 px-2.5 py-1.5 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </Field>
        {asset && <Toggle checked={form.archived} onChange={(v) => set('archived', v)} label={t('substation.assets.archived')} />}
        <ErrorNote error={error} />
        <div className="flex items-center gap-2 pt-1">
          {asset && (
            <Button type="button" variant="danger" disabled={busy} onClick={remove}>
              {t('common.delete')}
            </Button>
          )}
          <span className="flex-1" />
          <Button type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
