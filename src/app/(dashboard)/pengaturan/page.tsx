'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, ErrorNote, Field, Input, PageTitle, Panel, Toggle } from '@/components/ui';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { useAsync } from '@/lib/hooks';
import type { Rule } from '@/lib/types';

function TokenNotice({ id, token, onClose }: { id: string; token: string; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded border border-warn/50 bg-warn/10 p-3 text-sm">
      <div>
        Token untuk <b>{id}</b> — salin sekarang, token tidak ditampilkan lagi. Isi di robot pada <code>/etc/pashupati/pashupati.env</code>:
      </div>
      <pre className="overflow-x-auto rounded bg-ink-950 p-2 font-mono text-xs text-accent">{`CC_URL=${typeof window === 'undefined' ? '' : window.location.origin}\nCC_TOKEN=${token}`}</pre>
      <div className="flex gap-2">
        <Button onClick={() => navigator.clipboard.writeText(token)}>Salin token</Button>
        <Button onClick={onClose}>Selesai</Button>
      </div>
    </div>
  );
}

function RobotsPanel() {
  const robots = useAsync(() => api.robots.list(), []);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<{ id: string; token: string }>();
  const [error, setError] = useState<string>();
  const create = async () => {
    setError(undefined);
    try {
      setIssued(await api.robots.create(id.trim().toLowerCase(), name.trim()));
      setId('');
      setName('');
      robots.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal');
    }
  };
  return (
    <Panel title="Robot">
      <div className="space-y-4">
        {issued && <TokenNotice {...issued} onClose={() => setIssued(undefined)} />}
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {robots.data?.map((r) => (
              <tr key={r.id}>
                <td className="font-mono">{r.id}</td>
                <td>{r.name}</td>
                <td>{r.online ? <Badge tone="ok">Online</Badge> : <span className="text-xs text-slate-500">{ago(r.last_seen)}</span>}</td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  <Button onClick={() => confirm(`Buat token baru untuk ${r.id}? Token lama berhenti berlaku.`) && api.robots.rotateToken(r.id).then(setIssued)}>
                    Token baru
                  </Button>
                  <Button variant="danger" onClick={() => confirm(`Hapus ${r.id} beserta datanya?`) && api.robots.remove(r.id).then(robots.reload)}>
                    Hapus
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <Field label="ID robot">
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="l1w-01" />
          </Field>
          <Field label="Nama">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Genisom L1W Lt. 1" />
          </Field>
          <Button variant="primary" disabled={!id} onClick={create}>Tambah</Button>
        </div>
        <ErrorNote error={error} />
      </div>
    </Panel>
  );
}

function RuleRow({ rule, onSaved }: { rule: Rule; onSaved: () => void }) {
  const [draft, setDraft] = useState(rule);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(rule), [rule]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(rule);
  const save = async () => {
    setSaving(true);
    try {
      await api.rules.save(draft);
      onSaved();
    } finally {
      setSaving(false);
    }
  };
  return (
    <tr>
      <td className="font-mono text-xs">{rule.category}</td>
      <td><Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></td>
      <td><Toggle checked={draft.requires_validation} onChange={(v) => setDraft({ ...draft, requires_validation: v })} /></td>
      <td><Toggle checked={draft.notify_telegram} onChange={(v) => setDraft({ ...draft, notify_telegram: v })} /></td>
      <td><Input value={draft.telegram_chat_id} onChange={(e) => setDraft({ ...draft, telegram_chat_id: e.target.value })} placeholder="default" /></td>
      <td className="w-24"><Input type="number" min={0} max={1} step={0.05} value={draft.min_confidence} onChange={(e) => setDraft({ ...draft, min_confidence: Number(e.target.value) })} /></td>
      <td className="space-x-2 whitespace-nowrap text-right">
        <Button variant="primary" disabled={!dirty || saving} onClick={save}>Simpan</Button>
        {rule.category !== 'unknown' && (
          <Button variant="danger" onClick={() => confirm(`Hapus kategori ${rule.label}?`) && api.rules.remove(rule.category).then(onSaved)}>×</Button>
        )}
      </td>
    </tr>
  );
}

function RulesPanel() {
  const rules = useAsync(() => api.rules.list(), []);
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const add = async () => {
    await api.rules.save({
      category: category.trim().toLowerCase().replace(/\s+/g, '_'),
      label,
      requires_validation: true,
      notify_telegram: false,
      telegram_chat_id: '',
      min_confidence: 0.5,
    });
    setCategory('');
    setLabel('');
    rules.reload();
  };
  return (
    <Panel title="Aturan Kategori Anomali">
      <p className="mb-3 text-xs text-slate-400">
        Tanpa validasi: anomali langsung dikonfirmasi dan dikirim ke Telegram (mis. sampah ke grup cleaning service). Dengan validasi: menunggu
        konfirmasi operator di halaman Anomali. Chat ID kosong memakai grup default server.
      </p>
      <table>
        <thead>
          <tr>
            <th>Kategori</th>
            <th>Label</th>
            <th>Wajib validasi</th>
            <th>Telegram</th>
            <th>Chat ID</th>
            <th>Min. yakin</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rules.data?.map((r) => <RuleRow key={r.category} rule={r} onSaved={rules.reload} />)}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <Field label="Kode kategori (sama dengan output detektor)">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="broken_light" />
        </Field>
        <Field label="Label">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lampu Mati" />
        </Field>
        <Button variant="primary" disabled={!category || !label} onClick={add}>Tambah</Button>
      </div>
    </Panel>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageTitle title="Pengaturan" subtitle="Robot, token dan aturan anomali" />
      <div className="space-y-4">
        <RobotsPanel />
        <RulesPanel />
      </div>
    </>
  );
}
