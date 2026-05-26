// User-controlled simulation parameters (the 5 knobs).
export interface Params {
  heightM: number; // 1..50  — Fallhöhe
  windMs: number; // -10..10 — Windgeschwindigkeit (signed, +x direction)
  sizeMm: number; // 1..20   — Tropfendurchmesser
  color: string; // hex      — Farbe
  viscosity: number; // 0..1 — Viskosität (0 watery, 1 thick)
}

export const PARAM_RANGES = {
  heightM: { min: 1, max: 50, step: 0.5 },
  windMs: { min: -10, max: 10, step: 0.1 },
  sizeMm: { min: 1, max: 20, step: 0.1 },
  viscosity: { min: 0, max: 1, step: 0.01 },
} as const;

export function defaultParams(): Params {
  return {
    heightM: 12,
    windMs: 0,
    sizeMm: 6,
    color: '#c81e1e',
    viscosity: 0.3,
  };
}

// True physical radius of the drop in meters (used for physics/labels).
export function physicalRadiusM(sizeMm: number): number {
  return sizeMm / 1000 / 2;
}
