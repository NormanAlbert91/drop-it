import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { type Body, stepBody } from './physics.ts';
import { type Params } from './params.ts';

const UP = new THREE.Vector3(0, 1, 0);

// Visible ball radius (exaggerated for the stylized look). Physics uses the true
// mm radius elsewhere; this is purely what the eye sees during the fall.
export function displayRadius(sizeMm: number): number {
  // 1..20 mm keeps its original min..max slope; beyond 20 the radius keeps
  // growing (extrapolated, not clamped) so larger drops read as larger.
  const t = Math.max(0, THREE.MathUtils.inverseLerp(1, 20, sizeMm));
  return THREE.MathUtils.lerp(CONFIG.drop.displayRadiusMin, CONFIG.drop.displayRadiusMax, t);
}

export class Drop {
  readonly mesh: THREE.Mesh;
  readonly body: Body;
  private radius: number = CONFIG.drop.displayRadiusMin;
  private sizeMm: number = 1;
  private readonly material: THREE.MeshStandardMaterial;

  constructor() {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    this.body = { pos: new THREE.Vector3(), vel: new THREE.Vector3() };
  }

  spawn(params: Params, startX: number): void {
    this.radius = displayRadius(params.sizeMm);
    this.sizeMm = params.sizeMm;
    this.material.color.set(params.color);
    this.body.pos.set(startX, params.heightM, 0);
    this.body.vel.set(0, 0, 0);
    this.mesh.visible = true;
    this.updateMesh();
  }

  step(windMs: number, dt: number): void {
    stepBody(this.body, windMs, CONFIG.wind.response, dt);
  }

  // Returns true once the drop reaches the ground (y <= 0).
  hasLanded(): boolean {
    return this.body.pos.y <= 0;
  }

  updateMesh(): void {
    this.mesh.position.copy(this.body.pos);
    const speed = this.body.vel.length();
    const stretch = THREE.MathUtils.clamp(
      1 + CONFIG.drop.stretchK * speed,
      1,
      CONFIG.drop.stretchMax,
    );
    if (speed > 1e-3) {
      const dir = this.body.vel.clone().normalize();
      this.mesh.quaternion.setFromUnitVectors(UP, dir);
    }
    // Local +Y is aligned to the travel direction. Large drops flatten along that
    // axis (oblate) and bulge at the equator instead of reading as a teardrop.
    const D = CONFIG.drop;
    const oblate = THREE.MathUtils.clamp(
      D.oblateK * (this.sizeMm - D.oblateOnsetMm),
      0,
      D.oblateMax,
    );
    const axial = stretch * (1 - oblate);
    const equator = 1 + oblate * 0.6;
    this.mesh.scale.set(this.radius * equator, this.radius * axial, this.radius * equator);
  }

  hide(): void {
    this.mesh.visible = false;
  }

  get displayRadiusM(): number {
    return this.radius;
  }
}
