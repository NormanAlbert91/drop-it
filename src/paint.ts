import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { generateSplatTextures } from './splats.ts';

// Bake-to-texture ground paint. Every splat is drawn once into a 2D canvas and
// forgotten — unbounded accumulation at constant render cost. The canvas is a
// CanvasTexture used as the ground plane's map.
export class Paint {
  readonly texture: THREE.CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bases: HTMLCanvasElement[];
  private readonly res = CONFIG.paintResolution;
  private readonly size = CONFIG.plane.size;
  private dirty = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.res;
    this.canvas.height = this.res;
    this.ctx = this.canvas.getContext('2d')!;
    this.bases = generateSplatTextures(4, 256);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.flipY = false; // map canvas pixel (0,0) to uv (0,0)
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;

    this.clear();
  }

  // White paper ground. Wipes all splats.
  clear(): void {
    this.ctx.globalAlpha = 1;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.res, this.res);
    this.dirty = true;
  }

  // Stamp one splat at a world position on the ground (XZ plane, y=0).
  splat(worldX: number, worldZ: number, radiusM: number, color: string, opacity: number): void {
    const half = this.size / 2;
    // Plane is rotated -90deg about X: local (lx,ly) -> world (lx, 0, -ly).
    // With flipY=false: canvasPx = u*res, canvasPy = v*res.
    const px = ((worldX + half) / this.size) * this.res;
    const py = ((half - worldZ) / this.size) * this.res;
    const radiusPx = (radiusM / this.size) * this.res;
    if (radiusPx <= 0.5) return;

    const base = this.bases[(Math.random() * this.bases.length) | 0];
    const rotation = Math.random() * Math.PI * 2;
    const jitter = 1 + (Math.random() * 2 - 1) * CONFIG.splat.jitter;
    const aspect = 1 + (Math.random() * 2 - 1) * CONFIG.splat.aspectJitter;

    const tinted = this.tint(base, color);
    const drawSize = radiusPx * 2 * jitter;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = THREE.MathUtils.clamp(opacity, 0, 1);
    ctx.translate(px, py);
    ctx.rotate(rotation);
    ctx.scale(aspect, 1 / aspect);
    ctx.drawImage(tinted, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    ctx.restore();

    this.dirty = true;
  }

  // Colorize a white alpha-mask base into a fresh tinted canvas.
  private tint(base: HTMLCanvasElement, color: string): HTMLCanvasElement {
    const t = document.createElement('canvas');
    t.width = base.width;
    t.height = base.height;
    const tx = t.getContext('2d')!;
    tx.drawImage(base, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = color;
    tx.fillRect(0, 0, t.width, t.height);
    return t;
  }

  // Push canvas changes to the GPU at most once per frame.
  flush(): void {
    if (this.dirty) {
      this.texture.needsUpdate = true;
      this.dirty = false;
    }
  }
}
