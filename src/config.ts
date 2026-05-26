// Tunable constants. User-facing knobs live in params.ts.
export const CONFIG = {
  gravity: 9.81, // m/s^2 (real physics)
  timeScale: 0.35, // slow-mo playback factor (sim seconds per wall second)
  fixedDt: 1 / 120, // physics step in sim-seconds
  maxStepsPerFrame: 300, // guard against spiral-of-death after tab stalls

  plane: {
    size: 30, // meters (square)
  },

  wind: {
    response: 1.5, // 1/s — how fast the drop eases toward wind speed (horizontal drag)
    particleResponse: 2.5, // particles are lighter, respond faster
  },

  drop: {
    displayRadiusMin: 0.15, // m — visible ball at size = 1 mm
    displayRadiusMax: 0.6, // m — visible ball at size = 20 mm
    stretchK: 0.012, // velocity stretch per m/s
    stretchMax: 2.5,
    spawnClamp: 13, // m — max |spawn x| offset so drop stays over the plane
  },

  splat: {
    sizeFactor: 2.8, // main radius = displayRadius * factor * speedTerm * viscTerm
    refSpeed: 15, // m/s reference for sqrt speed scaling
    viscShrink: 0.3, // radius *= (1 - viscShrink * visc)
    opacityViscGain: 0.35, // thicker = more opaque
    minRadius: 0.12, // m
    maxRadius: 4.0, // m
    jitter: 0.2, // +/- uniform scale jitter
    aspectJitter: 0.2, // oval variation
  },

  particles: {
    baseCount: 22,
    countSpeedK: 1.4, // count grows with impact speed * size
    minCount: 8,
    maxCount: 70,
    viscCountShrink: 0.8, // count *= (1 - 0.8 * visc)
    ejectSpeedFactor: 0.55, // fraction of impact speed
    ejectSpeedViscShrink: 0.6, // eject speed *= (1 - 0.6 * visc)
    upBias: 0.75, // upward component of ejection
    spread: 1.0, // radial spread magnitude
    inheritHorizontal: 0.3, // inherit fraction of drop horizontal velocity
    displayRadius: 0.06, // m — flying droplet ball size
    splatSizeFactor: 0.32, // particle splat radius relative to main splat
    splatSizeViscGain: 0.6, // thicker = fatter droplet splats
    capacity: 512, // instanced mesh pool size (covers overlapping bursts)
  },

  camera: {
    fitMargin: 1.35, // multiply framing height
    minDistance: 7,
    elevationDeg: 18, // camera tilt above horizon for auto-fit
    azimuthDeg: 25, // camera around-Y angle for auto-fit
    lerp: 0.09, // auto-fit interpolation speed
  },

  paintResolution: 4096, // canvas-texture px across the 30 m plane
} as const;
