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

    const ejectSpeed = impactSpeed * P.ejectSpeedFactor * (1 - P.ejectSpeedViscShrink * visc);
    const color = new THREE.Color(params.color);

    let spawned = 0;
    for (let i = 0; i < this.capacity && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;

      const azimuth = Math.random() * Math.PI * 2;
      const radial = Math.random() * P.spread;
      const speed = ejectSpeed * (0.6 + Math.random() * 0.8);
      const dir = new THREE.Vector3(
        Math.cos(azimuth) * radial,
        P.upBias,
        Math.sin(azimuth) * radial,
      ).normalize();

      p.body.pos.set(pos.x, Math.max(pos.y, 0.02), pos.z);
      p.body.vel.copy(dir).multiplyScalar(speed);
      p.body.vel.x += dropVel.x * P.inheritHorizontal;
      p.displayRadius = P.displayRadius * (0.7 + Math.random() * 0.6) * (1 + 0.5 * visc);
      p.splatRadius =
        mainSplatRadius * P.splatSizeFactor * (1 + P.splatSizeViscGain * visc) * (0.6 + Math.random() * 0.8);
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
        // Landed: bake a small splat, retire the instance.
        this.paint.splat(p.body.pos.x, p.body.pos.z, p.splatRadius, p.color, 0.9);
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
