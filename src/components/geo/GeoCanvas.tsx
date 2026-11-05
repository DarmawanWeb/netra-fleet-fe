'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { robotLatLon, toLatLon, type LatLon } from '@/lib/geo';
import { useTheme } from '@/lib/theme';
import type { GeoTransform } from '@/lib/types';
import { heatColor, toneColor } from '../MapLayers';
import { cx } from '../ui';
import { anomalyHtml, controlPointHtml, esc, robotHtml, stopHtml } from './markers';
import type { GeoMapProps, TrailPoint } from './types';

const MAX_ZOOM = 22;
const FIT_MAX_ZOOM = 19;
const ROUTE = { dark: '#22d3ee', light: '#0e7490' };
const CASING = { dark: '#05080f', light: '#ffffff' };
const TRAIL_CHUNKS = 6;

/** Leaflet state of one map instance; rebuilt with the map (React strict mode mounts twice). */
interface Ctx {
  map: L.Map;
  base: L.TileLayer | null;
  overlay: L.ImageOverlay | null;
  heat: L.LayerGroup;
  paths: L.LayerGroup;
  routes: L.LayerGroup;
  trails: Map<string, L.Polyline[]>;
  anomalies: L.LayerGroup;
  robots: Map<string, { marker: L.Marker; html: string }>;
  points: L.LayerGroup;
  /** Signature of what each layer shows, to rebuild it only when that changes. */
  sig: Record<string, string>;
}

const transformSig = (t: GeoTransform | null) =>
  t ? [t.ref_lat, t.ref_lon, t.scale, t.rotation_rad, t.east_m, t.north_m].join(',') : 'none';

const trailLatLon = (p: TrailPoint, t: GeoTransform | null): LatLon | null =>
  p.lat !== undefined && p.lon !== undefined ? [p.lat, p.lon] : t ? toLatLon(t, p.x, p.y) : null;

/**
 * Leaflet map of a GPS site: the basemap tiles and/or the overlay image, then crowd cells, paths,
 * routes, trails, anomaly pins, robots and control points. Map-frame positions go through the site
 * transform; robots with a GPS fix are drawn at it. Loaded on the client only (see GeoMapView).
 */
export default function GeoCanvas(props: GeoMapProps) {
  const {
    transform,
    basemap,
    overlay,
    robots,
    routes,
    anomalies,
    trails,
    heat,
    paths,
    controlPoints,
    focus,
    fitKey,
    routeColor,
    picking,
    className,
  } = props;
  const { t } = useI18n();
  const { theme } = useTheme();
  const day = theme === 'light';
  const el = useRef<HTMLDivElement>(null);
  const ctx = useRef<Ctx | null>(null);
  const handlers = useRef(props);
  handlers.current = props;
  const moved = useRef(false); // the operator (or a followed robot) took over the view
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tiles, setTiles] = useState({ errors: 0, loads: 0 });
  const tsig = transformSig(transform);

  // ---- the map
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const map = L.map(node, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 2,
      maxZoom: MAX_ZOOM,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      worldCopyJump: true,
    }).setView([0, 0], 2);
    L.control.attribution({ position: 'bottomright', prefix: 'Leaflet' }).addTo(map);
    L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 120 }).addTo(map);
    map.createPane('netraImage').style.zIndex = '250';
    const group = () => L.layerGroup().addTo(map);
    ctx.current = {
      map,
      base: null,
      overlay: null,
      heat: group(),
      paths: group(),
      routes: group(),
      trails: new Map(),
      anomalies: group(),
      robots: new Map(),
      points: group(),
      sig: {},
    };
    const userMove = () => {
      moved.current = true;
      handlers.current.onUserMove?.();
    };
    map.on('dragstart boxzoomstart dblclick', userMove);
    node.addEventListener('wheel', userMove, { passive: true });
    node.addEventListener('touchstart', (e) => e.touches.length > 1 && userMove(), { passive: true });
    map.on('click', (e: L.LeafletMouseEvent) => handlers.current.onMapClick?.(e.latlng.lat, e.latlng.lng));
    map.on('moveend', () => {
      const b = map.getBounds();
      handlers.current.onViewChange?.([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
    });
    const ro = new ResizeObserver(([entry]) => {
      map.invalidateSize({ pan: false });
      if (entry) setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) });
    });
    ro.observe(node);
    return () => {
      ro.disconnect();
      node.removeEventListener('wheel', userMove);
      map.remove();
      ctx.current = null;
    };
  }, []);

  // ---- basemap tiles
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const sig = `${basemap.kind}|${basemap.url}|${basemap.attribution}|${basemap.max_zoom}`;
    if (c.sig.base === sig) return;
    c.sig.base = sig;
    c.base?.remove();
    c.base = null;
    setTiles({ errors: 0, loads: 0 });
    if (basemap.kind === 'none' || !basemap.url) return;
    c.base = L.tileLayer(basemap.url, {
      maxNativeZoom: basemap.max_zoom,
      maxZoom: MAX_ZOOM,
      attribution: esc(basemap.attribution),
      className: `netra-tiles netra-tiles-${basemap.kind}`,
    })
      .on('tileerror', () => setTiles((s) => (s.errors >= 3 ? s : { ...s, errors: s.errors + 1 })))
      .on('tileload', () => setTiles((s) => (s.loads ? s : { ...s, loads: 1 })))
      .addTo(c.map);
  }, [basemap.kind, basemap.url, basemap.attribution, basemap.max_zoom]);

  // ---- overlay image
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const sig = overlay ? `${overlay.url}|${overlay.north},${overlay.south},${overlay.east},${overlay.west}|${overlay.opacity}` : '';
    if (c.sig.overlay === sig) return;
    c.sig.overlay = sig;
    c.overlay?.remove();
    c.overlay = overlay
      ? L.imageOverlay(
          api.geo.overlayUrl(overlay.url),
          [
            [overlay.south, overlay.west],
            [overlay.north, overlay.east],
          ],
          { opacity: overlay.opacity, pane: 'netraImage', className: 'netra-overlay', interactive: false },
        ).addTo(c.map)
      : null;
  });

  // ---- crowd cells: squares of the map frame, so rotated quadrilaterals on the earth
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const cells = heat?.cells ?? [];
    const metric = heat?.metric ?? 'peak';
    const sig = `${tsig}|${metric}|${heat?.unit}|${cells.map((h) => `${h.x},${h.y},${h[metric]},${h.samples}`).join(';')}`;
    if (c.sig.heat === sig) return;
    c.sig.heat = sig;
    c.heat.clearLayers();
    if (!transform || !cells.length) return;
    const max = Math.max(1, ...cells.map((h) => h[metric]));
    for (const h of cells) {
      const corners = [
        [h.x, h.y],
        [h.x + h.size, h.y],
        [h.x + h.size, h.y + h.size],
        [h.x, h.y + h.size],
      ].map(([x, y]) => toLatLon(transform, x!, y!));
      L.polygon(corners, { stroke: false, fillColor: heatColor(h[metric] / max), fillOpacity: 0.25 + 0.5 * (h[metric] / max) })
        .bindTooltip(`${h[metric]} ${esc(heat?.unit ?? '')} (${h.samples})`, { sticky: true, direction: 'top' })
        .addTo(c.heat);
    }
  });

  // ---- paths (e.g. a track replay)
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const list = paths ?? [];
    const sig = `${tsig}|${day}|${list.map((p) => `${p.color}:${p.opacity}:${p.points?.length ?? 0}:${p.latlngs?.length ?? 0}:${JSON.stringify(p.latlngs?.at(-1) ?? p.points?.at(-1) ?? null)}`).join(';')}`;
    if (c.sig.paths === sig) return;
    c.sig.paths = sig;
    c.paths.clearLayers();
    for (const p of list) {
      const ll = p.latlngs ?? (transform ? (p.points ?? []).map(([x, y]) => toLatLon(transform, x, y)) : []);
      if (ll.length < 2) continue;
      L.polyline(ll, {
        color: p.color ?? ROUTE[theme],
        opacity: p.opacity ?? 0.85,
        weight: 3,
        lineJoin: 'round',
        interactive: false,
      }).addTo(c.paths);
    }
  });

  // ---- routes with numbered stops
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const color = routeColor ?? ROUTE[theme];
    const sig = `${tsig}|${color}|${theme}|${routes.map((r) => `${r.length}:${r[0]?.join(',')}:${r.at(-1)?.join(',')}`).join(';')}`;
    if (c.sig.routes === sig) return;
    c.sig.routes = sig;
    c.routes.clearLayers();
    if (!transform) return;
    for (const pts of routes) {
      if (pts.length < 2) continue;
      const line = pts.map(([x, y]) => toLatLon(transform, x, y));
      // A casing in the background colour keeps the route readable on aerial imagery.
      L.polyline(line, { color: CASING[theme], opacity: 0.7, weight: 7, lineJoin: 'round', interactive: false }).addTo(c.routes);
      L.polyline(line, { color, opacity: 0.95, weight: 3.5, lineJoin: 'round', interactive: false }).addTo(c.routes);
      pts
        .filter((p) => p[3] > 0)
        .forEach(([x, y], i) =>
          L.marker(toLatLon(transform, x, y), {
            icon: L.divIcon({ className: 'netra-geo-icon', html: stopHtml(i + 1, color), iconSize: [20, 20], iconAnchor: [10, 10] }),
            interactive: false,
            keyboard: false,
          }).addTo(c.routes),
        );
    }
  });

  // ---- trails: a few chunks per robot, fading with age, updated in place
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const seen = new Set<string>();
    for (const tr of trails ?? []) {
      const ll = tr.points.map((p) => trailLatLon(p, transform)).filter((p): p is LatLon => !!p);
      seen.add(tr.id);
      let lines = c.trails.get(tr.id);
      if (!lines) {
        lines = Array.from({ length: TRAIL_CHUNKS }, () =>
          L.polyline([], { weight: 3, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(c.map),
        );
        c.trails.set(tr.id, lines);
      }
      const color = toneColor(tr.tone ?? 'ok', day);
      const per = Math.ceil(ll.length / TRAIL_CHUNKS);
      lines.forEach((line, i) => {
        line.setLatLngs(ll.length < 2 ? [] : ll.slice(i * per, Math.min(ll.length, (i + 1) * per + 1)));
        line.setStyle({ color, opacity: 0.1 + (0.55 * (i + 1)) / TRAIL_CHUNKS });
      });
    }
    for (const [id, lines] of c.trails)
      if (!seen.has(id)) {
        lines.forEach((l) => l.remove());
        c.trails.delete(id);
      }
  });

  // ---- anomaly pins
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const sig = `${tsig}|${anomalies.map((a) => `${a.id}:${a.x},${a.y}:${a.pending ? 1 : 0}${a.fresh ? 1 : 0}:${a.label}`).join(';')}`;
    if (c.sig.anomalies === sig) return;
    c.sig.anomalies = sig;
    c.anomalies.clearLayers();
    if (!transform) return;
    for (const a of anomalies) {
      L.marker(toLatLon(transform, a.x, a.y), {
        icon: L.divIcon({
          className: 'netra-geo-icon',
          html: anomalyHtml(a.pending, !!a.fresh, a.label),
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        }),
        keyboard: false,
        zIndexOffset: 500,
      })
        .on('click', () => handlers.current.onAnomaly?.(a.id))
        .addTo(c.anomalies);
    }
  });

  // ---- robots, moved in place every telemetry
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const seen = new Set<string>();
    for (const r of robots) {
      const at = robotLatLon(r.pose, r.gps, transform);
      if (!at) continue;
      seen.add(r.id);
      let entry = c.robots.get(r.id);
      const html = robotHtml(r.name);
      if (!entry || entry.html !== html) {
        entry?.marker.remove();
        const marker = L.marker(at, {
          icon: L.divIcon({ className: 'netra-geo-icon', html, iconSize: [64, 64], iconAnchor: [32, 32] }),
          keyboard: false,
          zIndexOffset: 1000,
        })
          .on('click', () => handlers.current.onRobot?.(r.id))
          .addTo(c.map);
        entry = { marker, html };
        c.robots.set(r.id, entry);
      } else {
        entry.marker.setLatLng(at);
      }
      const node = entry.marker.getElement()?.firstElementChild as HTMLElement | null | undefined;
      if (!node) continue;
      node.style.setProperty('--tone', toneColor(r.tone ?? (r.alarm ? 'danger' : 'ok'), day));
      node.classList.toggle('selected', !!r.selected);
      node.classList.toggle('inspecting', !!r.inspecting);
      node.classList.toggle('clickable', !!handlers.current.onRobot);
      // Screen rotation of the heading arrow: the map yaw turned by the transform, y down.
      const deg = r.pose && transform ? -((transform.rotation_rad + r.pose.yaw) * 180) / Math.PI : null;
      node.classList.toggle('no-heading', deg === null);
      node.querySelector('.arrow')?.setAttribute('transform', `rotate(${(deg ?? 0).toFixed(1)})`);
    }
    for (const [id, entry] of c.robots)
      if (!seen.has(id)) {
        entry.marker.remove();
        c.robots.delete(id);
      }
  });

  // ---- control points (site map page): draggable, with the residual to where the fit puts them
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const list = controlPoints ?? [];
    const sig = `${day}|${list.map((p) => `${p.label}:${p.lat},${p.lon}:${p.predicted?.join(',')}:${p.active ? 1 : 0}${p.warn ? 1 : 0}`).join(';')}`;
    if (c.sig.points === sig) return;
    c.sig.points = sig;
    c.points.clearLayers();
    list.forEach((p, i) => {
      if (p.predicted) {
        const color = p.warn ? (day ? '#b45309' : '#f59e0b') : day ? '#0e7490' : '#22d3ee';
        L.polyline([[p.lat, p.lon], p.predicted], { color, weight: 2, dashArray: '4 4', interactive: false }).addTo(c.points);
        L.circleMarker(p.predicted, { radius: 4, color, weight: 2, fillOpacity: 0, interactive: false }).addTo(c.points);
      }
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: 'netra-geo-icon',
          html: controlPointHtml(i + 1, p.label, !!p.active, !!p.warn),
          iconSize: [28, 36],
          iconAnchor: [14, 32],
        }),
        draggable: !!handlers.current.onControlPointMove,
        keyboard: false,
        zIndexOffset: 2000,
      })
        .on('dragend', (e) => {
          const ll = (e.target as L.Marker).getLatLng();
          handlers.current.onControlPointMove?.(i, ll.lat, ll.lng);
        })
        .addTo(c.points);
    });
  });

  // ---- picking cursor
  useEffect(() => {
    ctx.current?.map.getContainer().classList.toggle('netra-picking', !!picking);
  }, [picking]);

  // ---- fit to what there is to see
  const fit = useCallback(() => {
    const c = ctx.current;
    if (!c) return;
    const pts: LatLon[] = [];
    for (const r of robots) {
      const at = robotLatLon(r.pose, r.gps, transform);
      if (at) pts.push(at);
    }
    if (transform) {
      routes.forEach((r) => r.forEach(([x, y]) => pts.push(toLatLon(transform, x, y))));
      anomalies.forEach((a) => pts.push(toLatLon(transform, a.x, a.y)));
      (heat?.cells ?? []).forEach((h) => pts.push(toLatLon(transform, h.x, h.y), toLatLon(transform, h.x + h.size, h.y + h.size)));
    }
    (paths ?? []).forEach((p) =>
      (p.latlngs ?? (transform ? (p.points ?? []).map(([x, y]) => toLatLon(transform, x, y)) : [])).forEach((ll) => pts.push(ll)),
    );
    (controlPoints ?? []).forEach((p) => pts.push([p.lat, p.lon]));
    // The whole overlay image only when there is nothing else to show.
    if (!pts.length && overlay) pts.push([overlay.south, overlay.west], [overlay.north, overlay.east]);
    if (pts.length) c.map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: FIT_MAX_ZOOM, animate: false });
    else if (transform) c.map.setView([transform.ref_lat, transform.ref_lon], 18, { animate: false });
  }, [robots, routes, anomalies, heat, paths, controlPoints, overlay, transform]);

  const robotKey = robots
    .filter((r) => robotLatLon(r.pose, r.gps, transform))
    .map((r) => r.id)
    .join();
  const contentKey = `${robotKey}|${routes.map((r) => r.length).join()}|${robotKey || routes.length ? '' : (heat?.cells.length ?? 0)}|${(paths ?? []).map((p) => p.latlngs?.length ?? p.points?.length ?? 0).join()}|${controlPoints?.length ?? 0}|${overlay?.url ?? ''}|${tsig}|${fitKey ?? ''}`;
  useEffect(() => {
    if (moved.current || !size.w) return;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, size.w, size.h]);

  // ---- follow
  useEffect(() => {
    const c = ctx.current;
    if (!c || !focus) return;
    moved.current = true;
    const zoom = focus.zoom ?? c.map.getZoom();
    if (Math.abs(zoom - c.map.getZoom()) > 0.01) c.map.setView([focus.lat, focus.lon], zoom, { animate: true });
    else c.map.panTo([focus.lat, focus.lon], { animate: true, duration: 0.6 });
  }, [focus]);

  const zoomBy = (d: number) => {
    moved.current = true;
    handlers.current.onUserMove?.();
    ctx.current?.map.setZoom((ctx.current?.map.getZoom() ?? 2) + d);
  };
  const tilesDown = basemap.kind !== 'none' && tiles.errors >= 3 && !tiles.loads;

  return (
    <div className={cx('netra-geo relative overflow-hidden', className)}>
      <div ref={el} className="absolute inset-0" role="region" aria-label={t('geo.mapTitle')} />
      {tilesDown && (
        <div className="pointer-events-none absolute inset-x-0 bottom-9 z-[1000] flex justify-center px-3">
          <span className="rounded-md border border-warn/40 bg-ink-900/90 px-2.5 py-1 text-[11px] text-warn backdrop-blur">
            {overlay ? t('geo.tilesDownOverlay') : t('geo.tilesDown')}
          </span>
        </div>
      )}
      <div className="absolute bottom-7 right-2 z-[1000] flex gap-1">
        <MapButton label="+" title={t('map.zoomIn')} onClick={() => zoomBy(1)} />
        <MapButton label="−" title={t('map.zoomOut')} onClick={() => zoomBy(-1)} />
        <MapButton
          label={t('map.fit')}
          title={t('geo.fitHint')}
          onClick={() => {
            handlers.current.onUserMove?.();
            moved.current = false;
            fit();
          }}
        />
      </div>
    </div>
  );
}

function MapButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="min-w-8 h-8 rounded border border-ink-600 bg-ink-900/90 px-2 text-sm text-slate-200 backdrop-blur hover:border-accent hover:text-accent"
    >
      {label}
    </button>
  );
}
