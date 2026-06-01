// Tunable constants. User-facing knobs live in params.ts.
export const CONFIG = {
  gravity: 9.81, // m/s^2 (real physics)
  timeScale: 1, // realtime playback (sim seconds per wall second)
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
    stretchK: 0.006, // velocity stretch per m/s (gentle — drops stay rounder)
    stretchMax: 1.4,
    // Surface tension can't hold large drops spherical: above onset they flatten
    // along the fall axis (oblate "hamburger" shape) and bulge at the equator
    // instead of stretching into a teardrop.
    oblateOnsetMm: 4, // mm — flattening starts above this diameter
    oblateK: 0.03, // flatten fraction per mm above onset
    oblateMax: 0.35, // cap on flatten fraction
    spawnClamp: 13, // m — max |spawn x| offset so drop stays over the plane
  },

  splat: {
    sizeFactor: 2.8, // main radius = displayRadius * factor * speedTerm * viscTerm
    refSpeed: 15, // m/s reference for sqrt speed scaling
    viscShrink: 0.3, // radius *= (1 - viscShrink * visc)
    opacityViscGain: 0.35, // thicker = more opaque
    minRadius: 0.12, // m
    maxRadius: 10.0, // m
    jitter: 0.2, // +/- uniform scale jitter
    aspectJitter: 0.2, // oval variation
  },

  particles: {
    baseCount: 70,
    countSpeedK: 3.6, // count grows with impact speed * size
    minCount: 28,
    maxCount: 300,
    viscCountShrink: 0.8, // count *= (1 - 0.8 * visc)
    // Radial spread model: each droplet targets a landing radius t (0..1).
    reachFactor: 0.16, // m of max landing radius = reachFactor * impactSpeed^reachSpeedExp
    reachSpeedExp: 1.35, // >1 => higher fall spreads droplets disproportionately wider
    reachPlaneFrac: 0.95, // cap reach to this fraction of the plane half-size
    reachViscShrink: 0.5, // reach *= (1 - 0.5 * visc)
    radialExp: 0.5, // <1 biases areal density outward (0.5 = even over the disk)
    radialInner: 0.25, // spray begins at this fraction of reach (keeps the center clear)
    arcUpFactor: 0.18, // vertical launch speed as fraction of impact speed (sets airtime/arc)
    inheritHorizontal: 0.3, // inherit fraction of drop horizontal velocity
    displayRadius: 0.06, // m — flying droplet ball size
    splatSizeFactor: 0.32, // particle splat radius relative to main splat
    splatSizeViscGain: 0.6, // thicker = fatter droplet splats
    // Size + tail graded by landing radius (center -> rim):
    innerSize: 1.15, // size scale at the center (big droplets near the drop)
    outerSize: 0.3, // size scale at the rim (fine droplets)
    tailInner: 1.1, // streak aspect near center (short tail)
    tailOuter: 2.6, // streak aspect at rim (long tail)
    capacity: 768, // instanced mesh pool size (covers overlapping bursts)
  },

  camera: {
    fitMargin: 1.35, // multiply framing height
    minDistance: 7,
    elevationDeg: 18, // camera tilt above horizon for auto-fit
    azimuthDeg: 25, // camera around-Y angle for auto-fit
    lerp: 0.09, // auto-fit interpolation speed
  },

  paintResolution: 8192, // render-target px across the 30 m plane (GPU-baked, no upload cost)

  print: {
    width: 4800, // export PNG px — t-shirt print (re-baked from splat history, not the live buffer)
    height: 6200,
  },
} as const;
