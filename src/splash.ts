import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { type Body, stepParticle } from './physics.ts';
import { type Params } from './params.ts';
import { type Paint } from './paint.ts';

interface Particle {
  body: Body;
  active: boolean;
  displayRadius: number;
  splatRadius: number;
  angle: number; // baked streak orientation (paint space), fixed at eject
  elongate: number; // baked streak aspect (1 = round, >1 = long tail)
  color: string;
}

const dummy = new THREE.Object3D();

// Secondary droplets flung out on impact. Each flies a ballistic arc (with wind
// drift) and bakes its own small splat where it lands. Rendered via one pooled
// InstancedMesh so overlapping bursts stay cheap.
export class Splash {
  readonly mesh: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly capacity = CONFIG.particles.capacity;
  private windMs = 0;

  constructor(private readonly paint: Paint) {
    const geo = new THREE.SphereGeometry(1, 12, 8);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.0 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.mesh.castShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const black = new THREE.Color(0, 0, 0);
    for (let i = 0; i < this.capacity; i++) {
      this.particles.push({
        body: { pos: new THREE.Vector3(), vel: new THREE.Vector3() },
        active: false,
        displayRadius: 0,
        splatRadius: 0,
        angle: 0,
        elongate: 1,
        color: '#ffffff',
      });
      dummy.position.set(0, -1000, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, black);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  setWind(windMs: number): void {
    this.windMs = windMs;
  }

  // Eject a burst at an impact point.
  burst(
    pos: THREE.Vector3,
    impactSpeed: number,
    dropVel: THREE.Vector3,
    params: Params,
    mainSplatRadius: number,
  ): void {
    const P = CONFIG.particles;
    const visc = params.viscosity;
    const energy = impactSpeed * (params.sizeMm / 6);
    const rawCount = P.baseCount + energy * P.countSpeedK;
    const count = Math.round(
      THREE.MathUtils.clamp(rawCount * (1 - P.viscCountShrink * visc), P.minCount, P.maxCount),
    );

    // How far the spray can reach. Grows faster than linearly with impact speed
    // (reachSpeedExp > 1) so a higher fall flings droplets much wider; damped by
    // viscosity and capped to stay on the plane.
    const maxReach = Math.min(
      P.reachFactor * Math.pow(impactSpeed, P.reachSpeedExp) * (1 - P.reachViscShrink * visc),
      CONFIG.plane.size * 0.5 * P.reachPlaneFrac,
    );
    const drag = CONFIG.wind.particleResponse;
    const color = new THREE.Color(params.color);

    let spawned = 0;
    for (let i = 0; i < this.capacity && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      // t: normalized landing radius (0 = at the central drop, 1 = outermost).
      // radialExp < 1 biases the *areal* density outward, so droplets land
      // evenly across the disk — few near the center, more toward the rim —
      // instead of all clustering at one distance.
      const t = Math.pow(Math.random(), P.radialExp);
      const azimuth = Math.random() * Math.PI * 2;
      // Spray starts at an inner ring (radialInner) rather than at the drop
      // itself, leaving the round central splat clear.
      const landR =
        maxReach * (P.radialInner + t * (1 - P.radialInner)) * (0.85 + Math.random() * 0.3);

      // Vertical launch sets the airtime T = 2*vy/g (no vertical drag). Then the
      // horizontal launch speed is back-solved so the droplet lands at landR
      // despite horizontal drag: distance = v0/drag * (1 - e^{-drag*T}).
      const vy = Math.max(impactSpeed * P.arcUpFactor * (0.8 + Math.random() * 0.4), 1.2);
      const airtime = (2 * vy) / CONFIG.gravity;
      const reachFrac = (1 - Math.exp(-drag * airtime)) / drag;
      const v0 = landR / Math.max(reachFrac, 1e-3);

      p.body.pos.set(pos.x, Math.max(pos.y, 0.02), pos.z);
      p.body.vel.set(Math.cos(azimuth) * v0, vy, Math.sin(azimuth) * v0);
      p.body.vel.x += dropVel.x * P.inheritHorizontal;

      // Grade by landing radius: center = big drop + short tail, rim = small
      // drop + long tail (fine fast spray streaks more).
      const sizeScale =
        THREE.MathUtils.lerp(P.innerSize, P.outerSize, t) * (0.85 + Math.random() * 0.3);
      p.displayRadius = P.displayRadius * sizeScale * (1 + 0.5 * visc);
      p.splatRadius =
        mainSplatRadius * P.splatSizeFactor * (1 + P.splatSizeViscGain * visc) * sizeScale;
      p.elongate =
        THREE.MathUtils.lerp(P.tailInner, P.tailOuter, t) * (0.9 + Math.random() * 0.2);
      // Streak points outward (paint space is (x, -z), so the angle uses -azimuth).
      p.angle = -azimuth;
      p.color = params.color;
      p.active = true;
      this.mesh.setColorAt(i, color);
      spawned++;
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      stepParticle(p.body, this.windMs, dt);

      if (p.body.pos.y <= 0) {
        // Landed: bake the directional comet streak baked at eject (orientation
        // outward, tail length graded by landing radius).
        this.paint.splat(p.body.pos.x, p.body.pos.z, p.splatRadius, p.color, 0.9, {
          angle: p.angle,
          elongate: p.elongate,
        });
        p.active = false;
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        anyActive = true;
        continue;
      }

      dummy.position.copy(p.body.pos);
      dummy.scale.setScalar(p.displayRadius);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      anyActive = true;
    }
    if (anyActive) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
