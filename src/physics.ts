import * as THREE from 'three';
import { CONFIG } from './config.ts';

export interface Body {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
}

// Advance a falling body one fixed step.
// Gravity pulls -Y. Wind is a horizontal drag easing vx toward windMs (X axis only).
export function stepBody(body: Body, windMs: number, response: number, dt: number): void {
  body.vel.y -= CONFIG.gravity * dt;
  body.vel.x += (windMs - body.vel.x) * response * dt;
  // z untouched — single-axis wind (v1). Particles get their own z velocity at eject.
  body.pos.addScaledVector(body.vel, dt);
}

// Particles can carry a z velocity; same drag eases it toward 0 (no wind on z).
export function stepParticle(body: Body, windMs: number, dt: number): void {
  const r = CONFIG.wind.particleResponse;
  body.vel.y -= CONFIG.gravity * dt;
  body.vel.x += (windMs - body.vel.x) * r * dt;
  body.vel.z += (0 - body.vel.z) * r * dt;
  body.pos.addScaledVector(body.vel, dt);
}

// Pre-simulate a drop released at x=0 to find horizontal drift at landing (y=0).
// Used to offset the spawn point upwind so the impact lands near plane center.
export function predictDrift(heightM: number, windMs: number): number {
  const body: Body = {
    pos: new THREE.Vector3(0, heightM, 0),
    vel: new THREE.Vector3(0, 0, 0),
  };
  const dt = CONFIG.fixedDt;
  let steps = 0;
  const maxSteps = Math.ceil((20 / dt)); // hard cap ~20 sim-seconds
  while (body.pos.y > 0 && steps < maxSteps) {
    stepBody(body, windMs, CONFIG.wind.response, dt);
    steps++;
  }
  return body.pos.x;
}

// Spawn x so the drop lands roughly centered, clamped to keep it over the plane.
export function spawnX(heightM: number, windMs: number): number {
  const drift = predictDrift(heightM, windMs);
  return THREE.MathUtils.clamp(-drift, -CONFIG.drop.spawnClamp, CONFIG.drop.spawnClamp);
}
