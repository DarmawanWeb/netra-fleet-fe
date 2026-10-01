import type { FloorPlan } from './types';

export interface Px {
  px: number;
  py: number;
}

/** Robot map frame (m, y up) to plan pixels (y down): p = origin + s·R(θ)·(x, −y). */
export function mapToPlan(plan: FloorPlan, x: number, y: number): Px {
  const c = Math.cos(plan.rotation_rad);
  const s = Math.sin(plan.rotation_rad);
  const u = x * plan.px_per_m;
  const v = -y * plan.px_per_m;
  return { px: plan.origin_x_px + c * u - s * v, py: plan.origin_y_px + s * u + c * v };
}

/** Inverse of mapToPlan. */
export function planToMap(plan: FloorPlan, px: number, py: number): { x: number; y: number } {
  const c = Math.cos(plan.rotation_rad);
  const s = Math.sin(plan.rotation_rad);
  const du = px - plan.origin_x_px;
  const dv = py - plan.origin_y_px;
  const u = c * du + s * dv;
  const v = -s * du + c * dv;
  return { x: u / plan.px_per_m, y: -v / plan.px_per_m };
}

/** Heading on the plan (degrees, SVG rotation) for a map yaw. */
export function planHeadingDeg(plan: FloorPlan, yaw: number): number {
  return ((plan.rotation_rad - yaw) * 180) / Math.PI;
}
