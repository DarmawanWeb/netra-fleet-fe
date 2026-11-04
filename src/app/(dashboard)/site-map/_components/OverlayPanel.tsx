'use client';

import { IconUpload } from '@/components/icons';
import { Button, ErrorNote, Field, Input } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import type { GeoOverlay } from '@/lib/types';
import { field, num } from '../_lib/form';

export interface OverlayDraft {
  file: File | null;
  /** Object URL of the chosen file, for the preview before it is uploaded. */
  preview: string | null;
  north: string;
  south: string;
  east: string;
  west: string;
  opacity: number;
}

export const draftOf = (o: GeoOverlay | null | undefined): OverlayDraft => ({
  file: null,
  preview: null,
  north: o ? field(o.north, 7) : '',
  south: o ? field(o.south, 7) : '',
  east: o ? field(o.east, 7) : '',
  west: o ? field(o.west, 7) : '',
  opacity: o?.opacity ?? 1,
});

/** The bounds of a draft when they make a box, else null. */
export function draftBounds(d: OverlayDraft) {
  const b = { north: num(d.north), south: num(d.south), east: num(d.east), west: num(d.west) };
  return Object.values(b).every(Number.isFinite) && b.north > b.south && b.east > b.west ? b : null;
}

/** An aerial or drone image of the site placed by the latitude and longitude of its edges; works offline. */
export function OverlayPanel({
  saved,
  draft,
  onChange,
  onUseView,
  onSave,
  onRemove,
  busy,
  error,
}: {
  saved: GeoOverlay | null;
  draft: OverlayDraft;
  onChange: (d: OverlayDraft) => void;
  onUseView: () => void;
  onSave: () => void;
  onRemove: () => void;
  busy: boolean;
  error?: string;
}) {
  const { t } = useI18n();
  const fmt = useFmt();
  const bounds = draftBounds(draft);
  const changed =
    !!draft.file ||
    (!!saved &&
      (draft.north !== field(saved.north, 7) ||
        draft.south !== field(saved.south, 7) ||
        draft.east !== field(saved.east, 7) ||
        draft.west !== field(saved.west, 7) ||
        draft.opacity !== saved.opacity));
  const thumb = draft.preview ?? (saved ? api.geo.overlayUrl(saved.url) : null);
  const choose = (file: File | undefined) => {
    if (!file) return;
    if (draft.preview) URL.revokeObjectURL(draft.preview);
    onChange({ ...draft, file, preview: URL.createObjectURL(file) });
  };
  const edge = (key: 'north' | 'south' | 'east' | 'west', label: string) => (
    <Field label={label}>
      <Input
        value={draft[key]}
        onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
        inputMode="decimal"
        className="h-8 py-1 font-mono text-xs"
      />
    </Field>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border border-ink-600 bg-ink-950">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <IconUpload width={22} height={22} className="text-slate-500" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 text-xs text-slate-400">
          <p className="truncate text-slate-200">
            {draft.file
              ? draft.file.name
              : saved
                ? t('siteMap.overlaySaved', { time: fmt.dateTime(saved.updated_at) })
                : t('siteMap.noOverlay')}
          </p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-ink-500 px-2.5 py-1 text-xs text-slate-200 hover:border-accent hover:text-accent">
            <IconUpload width={14} height={14} aria-hidden />
            {saved || draft.file ? t('siteMap.replaceImage') : t('siteMap.chooseImage')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => (choose(e.target.files?.[0]), (e.target.value = ''))}
            />
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {edge('north', t('siteMap.north'))}
        {edge('south', t('siteMap.south'))}
        {edge('west', t('siteMap.west'))}
        {edge('east', t('siteMap.east'))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">{t('siteMap.opacity')}</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={draft.opacity}
          onChange={(e) => onChange({ ...draft, opacity: Number(e.target.value) })}
          className="flex-1 accent-cyan-500"
          aria-label={t('siteMap.opacity')}
        />
        <span className="w-10 text-right font-mono text-xs text-slate-300">{Math.round(draft.opacity * 100)}%</span>
      </div>
      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={onUseView}>{t('siteMap.useView')}</Button>
        <Button variant="primary" disabled={busy || !bounds || !changed || (!draft.file && !saved)} onClick={onSave}>
          {draft.file ? t('siteMap.uploadOverlay') : t('siteMap.saveBounds')}
        </Button>
        {saved && (
          <Button variant="danger" disabled={busy} onClick={onRemove}>
            {t('siteMap.removeOverlay')}
          </Button>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">{t('siteMap.overlayHelp')}</p>
    </div>
  );
}
