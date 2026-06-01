# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server (hot reload)
npm run build      # tsc typecheck + vite build -> dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit (strict; noUnusedLocals/Params on)
```

No test runner, linter, or formatter is configured. `npm run typecheck` is the only correctness gate — run it after edits.

## What this is

Browser 3D paint-drop simulator. Three.js + TypeScript + Vite, no backend. UI in German (lil-gui panel). Deploys to GitHub Pages — `vite.config.ts` hard-codes `base: '/drop-it/'`, so asset paths assume that subpath. Module imports use explicit `.ts` extensions (`allowImportingTsExtensions`).

## Architecture

`main.ts` is the composition root and owns the loop. It wires the modules, holds the `idle | falling` state machine, and runs a fixed-timestep accumulator: wall delta * `CONFIG.timeScale` feeds `CONFIG.fixedDt` (1/120 s) physics steps. Wind is read live each step, so slider changes affect a drop mid-fall.

Lifecycle of one drop:
1. **Play** -> `spawnX()` (physics.ts) pre-simulates the fall to predict wind drift and offsets the spawn upwind so the impact lands near plane center. `env.fitTo()` lerps the camera to frame the height.
2. Each step `drop.step()` integrates gravity + horizontal wind drag (single-axis, X only).
3. On `hasLanded()` (y<=0) `onImpact()` bakes the main splat and fires a particle `burst()`, returns to `idle`.

Module roles:
- **physics.ts** — pure integrators (`stepBody`, `stepParticle`) + `predictDrift`/`spawnX`. No rendering. The one place real physics lives.
- **drop.ts** — the falling-ball mesh; velocity-stretched sphere. `displayRadius()` is an *exaggerated* visual size, distinct from `physicalRadiusM()` in params.ts (true mm). Keep that distinction.
- **paint.ts** — **bake-to-texture** ground paint. Every splat is drawn once into a 2D canvas (`CONFIG.paintResolution` px across the 30 m plane) and forgotten — unbounded accumulation at constant render cost. Coordinate mapping (world XZ -> canvas px) depends on the ground plane's `rotateX(-90deg)` and `texture.flipY=false`; change one and you must change the other. `flush()` pushes to GPU at most once per frame via a `dirty` flag.
- **splats.ts** — procedurally generates the splat-shape alpha-mask pool once at startup (no asset files). paint.ts tints/rotates/scales them per impact.
- **splash.ts** — secondary droplets as one pooled `InstancedMesh` (`CONFIG.particles.capacity`). Particles fly ballistic arcs and each bakes its own small splat on landing. Retired instances are parked at y=-1000, scale 0.
- **scene.ts** — renderer, lights, shadows, ground plane, OrbitControls, and the auto-fit camera lerp.
- **ui.ts** — lil-gui panel bound directly to the live `Params` object; mutations are read by the loop next frame.

## Params vs Config

Two distinct constant sets — don't conflate:
- **params.ts** (`Params`) — the 5 user knobs (height, wind, size, color, viscosity), their slider ranges, and defaults. Mutated live by the UI.
- **config.ts** (`CONFIG`) — fixed tuning constants (gravity, timestep, splat/particle/camera coefficients). `as const`. This is the tuning surface for look-and-feel; most "make splats bigger/wind stronger" requests are CONFIG edits.
