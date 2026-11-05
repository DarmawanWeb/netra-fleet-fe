'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoMapView, type GeoControlPoint, type GeoRobot } from '@/components/GeoMapView';
import { Badge, Button, ErrorNote, PageTitle, Panel } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFmt } from '@/lib/format';
import { distanceM, toLatLon } from '@/lib/geo';
import { useAsync, useGeoSite } from '@/lib/hooks';
import { robotTone } from '@/lib/labels';
import { useLive } from '@/lib/live';
import type { Basemap, GeoOverlay, GeoSite } from '@/lib/types';
import { BasemapPanel } from './_components/BasemapPanel';
import { ControlPoints, type PositionSource } from './_components/ControlPoints';
import { FitPanel, LIMITS, type FitState } from './_components/FitPanel';
import { OverlayPanel, draftBounds, draftOf, type OverlayDraft } from './_components/OverlayPanel';
import { isComplete, num, rowLatLon, rowOf, toPoint, type PointRow } from './_lib/form';

const NO_BASEMAP: Basemap = { kind: 'none', url: '', attribution: '', max_zoom: 22 };

/** A tile URL template the server accepts: http(s) or a path on this host, with {z}, {x} and {y}. */
const tileTemplate = (url: string) =>
  /^(https?:\/\/|\/(?!\/))[^\s"'<>\\`]+$/.test(url.trim()) && url.includes('{z}') && url.includes('{x}') && /\{-?y\}/.test(url);

/** The basemap drawn for a choice: presets come from the server, a custom one from the form once it is a template. */
function resolveBasemap(choice: Basemap, site: GeoSite | undefined): Basemap {
  if (choice.kind === 'none') return choice;
  if (choice.kind === 'custom') return tileTemplate(choice.url) ? { ...choice, url: choice.url.trim() } : { ...choice, kind: 'none' };
  return site?.presets.find((p) => p.kind === choice.kind) ?? { ...choice, url: '' };
}

/**
 * The georeference of a GPS site: control points (the same places in the robot map and on the
 * earth) fitted into the transform, the basemap and an offline overlay image, with the live robots
 * drawn through the fit being edited.
 */
export default function SiteMapPage() {
  const { t } = useI18n();
  const fmt = useFmt();
  const geo = useGeoSite();
  const site = geo.site;
  const { telemetry, online } = useLive();
  const robots = useAsync(() => api.robots.list(), []);

  const [rows, setRows] = useState<PointRow[]>([]);
  const [heading, setHeading] = useState('');
  const [basemap, setBasemap] = useState<Basemap>(NO_BASEMAP);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [picking, setPicking] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [overlay, setOverlay] = useState<OverlayDraft>(draftOf(null));
  const [overlayBusy, setOverlayBusy] = useState(false);
  const [overlayError, setOverlayError] = useState<string>();
  const [fit, setFit] = useState<FitState>({ transform: null });
  const view = useRef<[number, number, number, number] | null>(null);
  // The map follows the basemap form once typing pauses, so a URL being typed loads no tiles.
  const [shownBasemap, setShownBasemap] = useState<Basemap>(NO_BASEMAP);
  useEffect(() => {
    const timer = setTimeout(() => setShownBasemap(basemap), basemap.kind === 'custom' ? 600 : 0);
    return () => clearTimeout(timer);
  }, [basemap]);

  // The form follows the saved site until it is edited (also when another dashboard saves it).
  useEffect(() => {
    if (!site || dirty) return;
    setRows(site.points.map(rowOf));
    setHeading(site.heading_deg === null ? '' : String(site.heading_deg));
    setBasemap(site.basemap);
    setFit({ transform: site.transform });
  }, [site, dirty]);
  const savedOverlay = site?.overlay ?? null;
  const overlaySig = savedOverlay
    ? [savedOverlay.url, savedOverlay.north, savedOverlay.south, savedOverlay.east, savedOverlay.west, savedOverlay.opacity].join('|')
    : '';
  useEffect(
    () => setOverlay((d) => (d.file ? d : draftOf(savedOverlay))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlaySig],
  );

  const edit =
    <T,>(set: (v: T) => void) =>
    (v: T) => (set(v), setDirty(true));
  const complete = rows.filter(isComplete);
  const headingValue = complete.length === 1 && heading.trim() !== '' && Number.isFinite(num(heading)) ? num(heading) : null;
  const incomplete = rows.findIndex((r) => !isComplete(r));

  // Fit what is entered, a moment after the last change, to show the residuals before saving.
  const fitSig = JSON.stringify([complete.map(toPoint), headingValue]);
  useEffect(() => {
    if (!dirty) return;
    const points = complete.map(toPoint);
    if (points.length < 2 && !(points.length === 1 && headingValue !== null)) {
      setFit({ transform: null });
      return;
    }
    setFit((f) => ({ ...f, busy: true }));
    let alive = true;
    const timer = setTimeout(() => {
      api.geo
        .fit({ points, heading_deg: headingValue })
        .then((r) => alive && setFit({ transform: r.transform }))
        .catch((e: unknown) => alive && setFit({ transform: null, error: e instanceof Error ? e.message : String(e) }));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSig, dirty]);

  // Residual of each complete row: where the fit puts its map position against its latitude/longitude.
  const transform = fit.error ? null : fit.transform;
  const residuals = useMemo(() => {
    const out: Record<string, number> = {};
    if (!transform) return out;
    for (const r of rows) {
      if (!isComplete(r)) continue;
      out[r.key] = distanceM(toLatLon(transform, num(r.x), num(r.y)), [num(r.lat), num(r.lon)]);
    }
    return out;
  }, [rows, transform]);
  const warn = useMemo(
    () => new Set(Object.entries(residuals).flatMap(([k, m]) => (transform?.method === 'points' && m > LIMITS.residual ? [k] : []))),
    [residuals, transform],
  );
  const spread = useMemo(() => {
    let d = 0;
    for (const a of complete) for (const b of complete) d = Math.max(d, Math.hypot(num(a.x) - num(b.x), num(a.y) - num(b.y)));
    return d;
  }, [complete]);

  // Robots: live on the map, and the source of "use the robot's position".
  const live = (robots.data ?? []).flatMap((r): (GeoRobot & { tel: PositionSource | null })[] => {
    const tel = telemetry[r.id];
    if (!(online[r.id] ?? r.online) || !tel) return [];
    return [
      {
        id: r.id,
        name: r.name,
        pose: tel.pose,
        gps: tel.gps,
        tone: robotTone(tel),
        tel: tel.pose ? { id: r.id, name: r.name, pose: tel.pose, gps: tel.gps } : null,
      },
    ];
  });
  const sources = live.flatMap((r) => (r.tel ? [r.tel] : []));
  const source = sources.find((s) => s.id === sourceId) ?? sources[0];

  // Control points on the map: those with a position on the earth, with where the fit puts them.
  const marked = rows.flatMap((r, i) => {
    const at = rowLatLon(r);
    if (!at) return [];
    const predicted = transform && isComplete(r) ? toLatLon(transform, num(r.x), num(r.y)) : null;
    const point: GeoControlPoint = {
      label: r.label || t('siteMap.pointN', { n: i + 1 }),
      lat: at[0],
      lon: at[1],
      predicted: predicted && residuals[r.key]! > 0.05 ? predicted : null,
      active: picking === r.key,
      warn: warn.has(r.key),
    };
    return [{ key: r.key, point }];
  });

  const bounds = draftBounds(overlay);
  const overlayShown: GeoOverlay | null =
    bounds && (overlay.preview || savedOverlay)
      ? {
          url: overlay.preview ?? savedOverlay!.url,
          content_type: overlay.file?.type ?? savedOverlay?.content_type ?? '',
          ...bounds,
          opacity: overlay.opacity,
          updated_at: savedOverlay?.updated_at ?? '',
        }
      : null;

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const save = async () => {
    if (incomplete >= 0) {
      setSaveError(t('siteMap.incomplete', { n: incomplete + 1 }));
      return;
    }
    setSaving(true);
    setSaveError(undefined);
    try {
      const saved = await api.geo.save({
        points: complete.map(toPoint),
        heading_deg: headingValue,
        basemap: { kind: basemap.kind, url: basemap.url, attribution: basemap.attribution, max_zoom: basemap.max_zoom },
      });
      setDirty(false);
      setRows(saved.points.map(rowOf));
      setFit({ transform: saved.transform });
      geo.reload();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setDirty(false);
    setSaveError(undefined);
    setPicking(null);
  };

  const saveOverlay = async () => {
    if (!bounds) return;
    setOverlayBusy(true);
    setOverlayError(undefined);
    try {
      await api.geo.overlay({ ...bounds, opacity: overlay.opacity }, overlay.file ?? undefined);
      if (overlay.preview) URL.revokeObjectURL(overlay.preview);
      setOverlay((d) => ({ ...d, file: null, preview: null }));
      geo.reload();
    } catch (e) {
      setOverlayError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setOverlayBusy(false);
    }
  };

  const removeOverlay = async () => {
    if (!confirm(t('siteMap.removeOverlayConfirm'))) return;
    setOverlayBusy(true);
    setOverlayError(undefined);
    try {
      await api.geo.removeOverlay();
      setOverlay(draftOf(null));
      geo.reload();
    } catch (e) {
      setOverlayError(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setOverlayBusy(false);
    }
  };

  const useView = () => {
    const v = view.current;
    if (!v) return;
    const [south, west, north, east] = v.map((x) => String(Number(x.toFixed(7))));
    setOverlay((d) => ({ ...d, south: south!, west: west!, north: north!, east: east! }));
  };

  const pickedIndex = rows.findIndex((r) => r.key === picking);
  const status = dirty
    ? t('siteMap.unsaved')
    : site?.updated_at
      ? t('siteMap.savedBy', { time: fmt.dateTime(site.updated_at), user: site.updated_by || '—' })
      : t('siteMap.neverSaved');

  return (
    <>
      <PageTitle
        title={t('siteMap.title')}
        subtitle={t('siteMap.subtitle')}
        actions={
          <>
            <span className={dirty ? 'text-xs text-warn' : 'text-xs text-slate-500'}>{status}</span>
            {dirty && <Button onClick={revert}>{t('siteMap.revert')}</Button>}
            <Button variant="primary" disabled={!dirty || saving || !site} onClick={save}>
              {saving ? t('siteMap.saving') : t('common.save')}
            </Button>
          </>
        }
      />
      <ErrorNote error={geo.error ?? saveError} />
      <div className="mt-2 grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="relative xl:sticky xl:top-[4.25rem] xl:self-start">
          <GeoMapView
            className="h-[60vh] min-h-[420px] xl:h-[calc(100vh-10.75rem)]"
            transform={transform}
            basemap={resolveBasemap(shownBasemap, site)}
            overlay={overlayShown}
            robots={live}
            routes={[]}
            anomalies={[]}
            controlPoints={marked.map((m) => m.point)}
            onControlPointMove={(i, lat, lon) => {
              const key = marked[i]?.key;
              if (key) edit(setRows)(rows.map((r) => (r.key === key ? { ...r, lat: lat.toFixed(7), lon: lon.toFixed(7) } : r)));
            }}
            picking={!!picking}
            onMapClick={(lat, lon) => {
              if (!picking) return;
              edit(setRows)(rows.map((r) => (r.key === picking ? { ...r, lat: lat.toFixed(7), lon: lon.toFixed(7) } : r)));
              setPicking(null);
            }}
            onViewChange={(b) => (view.current = b)}
          />
          {picking && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[600] flex justify-center px-3">
              <span className="rounded-md border border-accent/60 bg-ink-900/95 px-3 py-1.5 text-xs text-slate-100 shadow-lg backdrop-blur">
                {t('siteMap.picking', { n: pickedIndex + 1 })}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <Panel title={t('siteMap.fit')}>
            <FitPanel
              fit={fit}
              residuals={rows.flatMap((r, i) => (residuals[r.key] !== undefined ? [{ n: i + 1, m: residuals[r.key]! }] : []))}
              points={complete.length}
              spread={spread}
            />
          </Panel>
          <Panel title={t('siteMap.points')} actions={<Badge tone={complete.length >= 2 ? 'info' : 'muted'}>{complete.length}</Badge>}>
            <p className="mb-3 text-xs leading-relaxed text-slate-400">{t('siteMap.pointsHelp')}</p>
            <ControlPoints
              rows={rows}
              onChange={edit(setRows)}
              residuals={residuals}
              warn={warn}
              picking={picking}
              onPick={setPicking}
              sources={sources}
              sourceId={source?.id ?? ''}
              onSource={setSourceId}
              heading={heading}
              onHeading={edit(setHeading)}
              showHeading={complete.length === 1}
            />
          </Panel>
          <Panel title={t('siteMap.basemap')}>
            <BasemapPanel value={basemap} onChange={edit(setBasemap)} />
          </Panel>
          <Panel title={t('siteMap.overlay')}>
            <OverlayPanel
              saved={savedOverlay}
              draft={overlay}
              onChange={setOverlay}
              onUseView={useView}
              onSave={saveOverlay}
              onRemove={removeOverlay}
              busy={overlayBusy}
              error={overlayError}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
