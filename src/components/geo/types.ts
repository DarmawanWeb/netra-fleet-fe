import type { LatLon } from '@/lib/geo';
import type { Basemap, GeoOverlay, GeoTransform, GpsFix, Pose, RoutePoint } from '@/lib/types';
import type { GridAnomaly, GridHeat } from '../GridMapView';
import type { RobotTone } from '../MapLayers';

/** A robot on the GPS map: drawn at its GPS position when it has a fix, else at its pose through the transform. */
export interface GeoRobot {
  id: string;
  name: string;
  pose: Pose | null;
  gps?: GpsFix | null;
  alarm?: boolean;
  /** Colour by state; overrides alarm. */
  tone?: RobotTone;
  selected?: boolean;
  /** Dwelling at a stop: a slow scanning sweep. */
  inspecting?: boolean;
}

/** A recent position of a robot: map pose and, when the robot reported one, its GPS position. */
export interface TrailPoint extends Pose {
  lat?: number;
  lon?: number;
}

export interface GeoTrail {
  id: string;
  points: TrailPoint[];
  tone?: RobotTone;
}

/** A polyline in map metres (through the transform) or in WGS84 degrees. */
export interface GeoPath {
  points?: [number, number][];
  latlngs?: LatLon[];
  color?: string;
  opacity?: number;
}

/** A control point of the site map page: draggable, with where the fit puts it. */
export interface GeoControlPoint {
  label: string;
  lat: number;
  lon: number;
  /** Where the transform puts the point's map position (the residual is the line to it). */
  predicted?: LatLon | null;
  active?: boolean;
  /** Its residual is large. */
  warn?: boolean;
}

/** Keep this position in the centre (follow mode), optionally at a zoom. */
export interface GeoFocus {
  lat: number;
  lon: number;
  zoom?: number;
}

export interface GeoMapProps {
  transform: GeoTransform | null;
  basemap: Basemap;
  overlay?: GeoOverlay | null;
  robots: GeoRobot[];
  routes: RoutePoint[][];
  anomalies: GridAnomaly[];
  trails?: GeoTrail[];
  heat?: GridHeat;
  paths?: GeoPath[];
  controlPoints?: GeoControlPoint[];
  onControlPointMove?: (index: number, lat: number, lon: number) => void;
  focus?: GeoFocus | null;
  /** Fit the view again whenever this changes (besides robots, routes or cells appearing). */
  fitKey?: string;
  routeColor?: string;
  /** Clicks on the map pick a position (crosshair cursor). */
  picking?: boolean;
  onMapClick?: (lat: number, lon: number) => void;
  onAnomaly?: (id: number) => void;
  onRobot?: (id: string) => void;
  /** The operator panned, zoomed or fitted the view (e.g. to stop following). */
  onUserMove?: () => void;
  /** The visible area after every move: [south, west, north, east]. */
  onViewChange?: (bounds: [number, number, number, number]) => void;
  className?: string;
}
