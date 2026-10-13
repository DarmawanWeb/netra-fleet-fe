import type { RoutePoint } from '@/lib/types';

/**
 * Stop number (1-based) and stop count for a waypoint index. Robots report stops by their waypoint
 * index in the route CSV; people count the inspection stops (waypoints with a dwell time).
 */
export function stopOrdinal(points: RoutePoint[] | undefined, waypoint: number | null | undefined) {
  if (!points?.length) return null;
  const stops = points.map((p, i) => (p[3] > 0 ? i : -1)).filter((i) => i >= 0);
  if (!stops.length) return null;
  const reached = waypoint === null || waypoint === undefined ? 0 : stops.filter((i) => i <= waypoint).length;
  return { n: reached, total: stops.length };
}

/** Stop number to show for a waypoint index, falling back to index + 1 while the route is unknown. */
export const stopNumber = (points: RoutePoint[] | undefined, waypoint: number) => stopOrdinal(points, waypoint)?.n || waypoint + 1;
