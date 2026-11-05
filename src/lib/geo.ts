import type { GeoTransform, GpsFix, Pose } from './types';

/**
 * The georeference of a GPS site, as netra-fleet-be internal/geo computes it: a similarity from map
 * metres to east/north metres in the tangent plane at (ref_lat, ref_lon), then the exact conversion
 * between that plane and the WGS84 ellipsoid. The server fits it; the dashboard applies it to live
 * poses without a round trip.
 */

const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const DEG = Math.PI / 180;

export type LatLon = [lat: number, lon: number];

function ecef(lat: number, lon: number, h: number): [number, number, number] {
  const sinLat = Math.sin(lat * DEG);
  const cosLat = Math.cos(lat * DEG);
  const n = A / Math.sqrt(1 - E2 * sinLat * sinLat);
  return [(n + h) * cosLat * Math.cos(lon * DEG), (n + h) * cosLat * Math.sin(lon * DEG), (n * (1 - E2) + h) * sinLat];
}

function fromEcef(x: number, y: number, z: number): [lat: number, lon: number, h: number] {
  const p = Math.hypot(x, y);
  let phi = Math.atan2(z, p * (1 - E2));
  for (let i = 0; i < 10; i++) {
    const s = Math.sin(phi);
    const n = A / Math.sqrt(1 - E2 * s * s);
    const next = Math.atan2(z + E2 * n * s, p);
    const done = Math.abs(next - phi) < 1e-15;
    phi = next;
    if (done) break;
  }
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return [phi / DEG, Math.atan2(y, x) / DEG, p * c + z * s - A * Math.sqrt(1 - E2 * s * s)];
}

/** East/north/up tangent plane at a point of the ellipsoid. */
class Plane {
  private readonly sinLat: number;
  private readonly cosLat: number;
  private readonly sinLon: number;
  private readonly cosLon: number;
  private readonly o: [number, number, number];

  constructor(lat: number, lon: number) {
    this.sinLat = Math.sin(lat * DEG);
    this.cosLat = Math.cos(lat * DEG);
    this.sinLon = Math.sin(lon * DEG);
    this.cosLon = Math.cos(lon * DEG);
    this.o = ecef(lat, lon, 0);
  }

  local(lat: number, lon: number): [e: number, n: number] {
    const [x, y, z] = ecef(lat, lon, 0);
    const dx = x - this.o[0];
    const dy = y - this.o[1];
    const dz = z - this.o[2];
    return [-this.sinLon * dx + this.cosLon * dy, -this.sinLat * this.cosLon * dx - this.sinLat * this.sinLon * dy + this.cosLat * dz];
  }

  /** The surface point under (e, n): moved along the local vertical until its height is zero. */
  geodetic(e: number, n: number): LatLon {
    let u = 0;
    let out: LatLon = [0, 0];
    for (let i = 0; i < 5; i++) {
      const x = this.o[0] - this.sinLon * e - this.sinLat * this.cosLon * n + this.cosLat * this.cosLon * u;
      const y = this.o[1] + this.cosLon * e - this.sinLat * this.sinLon * n + this.cosLat * this.sinLon * u;
      const z = this.o[2] + this.cosLat * n + this.sinLat * u;
      const [lat, lon, h] = fromEcef(x, y, z);
      out = [lat, lon];
      if (Math.abs(h) < 1e-9) break;
      u -= h;
    }
    return out;
  }
}

const planes = new WeakMap<GeoTransform, Plane>();
const planeOf = (t: GeoTransform) => {
  let p = planes.get(t);
  if (!p) {
    p = new Plane(t.ref_lat, t.ref_lon);
    planes.set(t, p);
  }
  return p;
};

/** Map position (metres) to WGS84 degrees. */
export function toLatLon(t: GeoTransform, x: number, y: number): LatLon {
  const c = Math.cos(t.rotation_rad);
  const s = Math.sin(t.rotation_rad);
  return planeOf(t).geodetic(t.scale * (c * x - s * y) + t.east_m, t.scale * (s * x + c * y) + t.north_m);
}

/** WGS84 degrees to a map position (metres). */
export function toMap(t: GeoTransform, lat: number, lon: number): [x: number, y: number] {
  const [e, n] = planeOf(t).local(lat, lon);
  const c = Math.cos(t.rotation_rad);
  const s = Math.sin(t.rotation_rad);
  const de = (e - t.east_m) / t.scale;
  const dn = (n - t.north_m) / t.scale;
  return [c * de + s * dn, -s * de + c * dn];
}

/** Compass heading (degrees clockwise from north) of a map yaw (radians from the map x axis). */
export function headingDeg(t: GeoTransform, yaw: number): number {
  const d = (90 - (t.rotation_rad + yaw) / DEG) % 360;
  return d < 0 ? d + 360 : d;
}

/** Whether a robot's GPS gives a position: latitude and longitude on the earth and a fix. */
export function validFix(gps: GpsFix | null | undefined): gps is GpsFix {
  return (
    !!gps &&
    Number.isFinite(gps.lat) &&
    Number.isFinite(gps.lon) &&
    gps.fix !== 'none' &&
    Math.abs(gps.lat) <= 90 &&
    Math.abs(gps.lon) <= 180
  );
}

/** Where to draw a robot: its GPS position when it has a fix, else its pose through the transform. */
export function robotLatLon(pose: Pose | null | undefined, gps: GpsFix | null | undefined, t: GeoTransform | null): LatLon | null {
  if (validFix(gps)) return [gps.lat, gps.lon];
  if (pose && t) return toLatLon(t, pose.x, pose.y);
  return null;
}

/** Ground distance in metres between two positions (haversine on the mean earth radius). */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = (b[0] - a[0]) * DEG;
  const dLon = (b[1] - a[1]) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * DEG) * Math.cos(b[0] * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}
