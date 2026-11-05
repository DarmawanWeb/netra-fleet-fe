'use client';

import { Field, Input, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import type { Basemap, BasemapKind } from '@/lib/types';

/** The tiles under the map: a preset, a custom tile server, or none. */
export function BasemapPanel({ value, onChange }: { value: Basemap; onChange: (b: Basemap) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <Segmented<BasemapKind>
        value={value.kind}
        onChange={(kind) => onChange({ ...value, kind })}
        options={[
          { value: 'osm', label: t('siteMap.basemaps.osm') },
          { value: 'satellite', label: t('siteMap.basemaps.satellite') },
          { value: 'custom', label: t('siteMap.basemaps.custom') },
          { value: 'none', label: t('siteMap.basemaps.none') },
        ]}
      />
      {value.kind === 'custom' && (
        <div className="space-y-3">
          <Field label={t('siteMap.tileUrl')}>
            <Input
              value={value.url}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              placeholder="https://tiles.example.com/{z}/{x}/{y}.png"
              className="font-mono text-xs"
              spellCheck={false}
            />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <Field label={t('siteMap.attribution')}>
              <Input value={value.attribution} onChange={(e) => onChange({ ...value, attribution: e.target.value })} maxLength={300} />
            </Field>
            <Field label={t('siteMap.maxZoom')}>
              <Input
                type="number"
                min={1}
                max={24}
                value={value.max_zoom || ''}
                onChange={(e) => onChange({ ...value, max_zoom: Number(e.target.value) })}
              />
            </Field>
          </div>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">
        {value.kind === 'none'
          ? t('siteMap.basemapNone')
          : value.kind === 'custom'
            ? t('siteMap.basemapCustom')
            : t('siteMap.basemapInternet')}
      </p>
    </div>
  );
}
