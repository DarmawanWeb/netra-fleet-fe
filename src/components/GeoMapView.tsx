'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { useMe } from '@/lib/session';
import type { GeoSite } from '@/lib/types';
import { GridMapView, type GridFocus } from './GridMapView';
import type { GeoMapProps } from './geo/types';
import { cx } from './ui';

export type { GeoControlPoint, GeoFocus, GeoMapProps, GeoPath, GeoRobot, GeoTrail, TrailPoint } from './geo/types';

// Leaflet touches window when it loads: the map is a client-only chunk.
const GeoCanvas = dynamic(() => import('./geo/GeoCanvas'), {
  ssr: false,
  loading: () => <div className="netra-geo h-full w-full" />,
});

/** A GPS map on Leaflet: basemap tiles and/or an overlay image under the robots and map layers. */
export function GeoMapView({ className, ...props }: GeoMapProps) {
  return (
    <div className={cx('relative isolate overflow-hidden rounded-xl border border-ink-600', className)}>
      <GeoCanvas {...props} className="h-full w-full" />
    </div>
  );
}

/** Says the site has no georeference yet; links to the site map for people who can set it up. */
export function GeoPrompt({ className, short }: { className?: string; short?: boolean }) {
  const { t } = useI18n();
  const { can } = useMe();
  return (
    <span className={cx('text-[11px] text-slate-300', className)}>
      {short ? t('geo.notGeoreferencedShort') : t('geo.notGeoreferenced')}{' '}
      {can('configure') && (
        <Link href="/site-map" className="text-accent underline-offset-2 hover:underline">
          {t('geo.setUp')}
        </Link>
      )}
    </span>
  );
}

/**
 * The GPS map once the site is georeferenced; before that the grid in the robot map frame with a
 * prompt to set up the site map. Map-frame layers go through the transform on the GPS map.
 */
export function GeoOrGrid({
  site,
  loaded,
  className,
  gridFocus,
  prompt = 'chip',
  overlay,
  fill,
  ...props
}: Omit<GeoMapProps, 'transform' | 'basemap' | 'overlay'> & {
  site: GeoSite | undefined;
  loaded: boolean;
  /** Fill the parent's height (the dashboard); otherwise the map's className sizes it. */
  fill?: boolean;
  /** Follow on the grid fallback (map metres). */
  gridFocus?: GridFocus | null;
  /** Where the fallback says the site is not georeferenced: a chip on the map, a line under it, or nowhere. */
  prompt?: 'chip' | 'below' | 'none';
  /** HTML laid over the map (layer switches, chips). */
  overlay?: ReactNode;
}) {
  if (!loaded) return <div className={cx('rounded-xl border border-ink-600 bg-ink-950', className)} />;
  const wrapper = fill ? 'relative h-full' : 'relative';
  if (site?.transform)
    return (
      <div className={wrapper}>
        <GeoMapView {...props} transform={site.transform} basemap={site.basemap} overlay={site.overlay} className={className} />
        {overlay}
      </div>
    );
  return (
    <>
      <div className={wrapper}>
        <GridMapView
          className={className}
          robots={props.robots.flatMap((r) => (r.pose ? [{ ...r, pose: r.pose }] : []))}
          routes={props.routes}
          anomalies={props.anomalies}
          trails={props.trails?.map((tr) => ({ id: tr.id, poses: tr.points, tone: tr.tone }))}
          heat={props.heat}
          paths={props.paths?.flatMap((p) => (p.points ? [{ points: p.points, color: p.color, opacity: p.opacity }] : []))}
          focus={gridFocus}
          fitKey={props.fitKey}
          routeColor={props.routeColor}
          onAnomaly={props.onAnomaly}
          onRobot={props.onRobot}
          onUserMove={props.onUserMove}
        />
        {prompt === 'chip' && (
          <div className="pointer-events-none absolute bottom-14 left-3 right-3 flex">
            <div className="pointer-events-auto rounded-md border border-ink-500 bg-ink-900/90 px-2.5 py-1 backdrop-blur">
              <GeoPrompt short />
            </div>
          </div>
        )}
        {overlay}
      </div>
      {prompt === 'below' && <GeoPrompt className="mt-2 block text-xs text-slate-500" />}
    </>
  );
}
