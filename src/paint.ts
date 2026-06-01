import * as THREE from 'three';
import { CONFIG } from './config.ts';
import { generateSplatTextures, generateDropletTextures } from './splats.ts';

// GPU render-to-texture ground paint. Each splat is rendered as one textured
// quad directly into a persistent WebGLRenderTarget (autoClear off => paint
// accumulates). No CPU canvas, no per-frame full-texture upload — so the live
// resolution can go high (8192) without stutter; cost per splat = one quad draw.
//
// Quads live in WORLD space (meters): a quad sits at (worldX, -worldZ) and is
// sized in meters. An orthographic camera spanning the plane maps that to the
// live target. Because the geometry is resolution-independent, the same splat
// history can be re-baked into an arbitrary-size export target (see exportPNG)
// covering only the painted region — print detail is decoupled from the live
// buffer. Mapping reproduces the old canvas (ground plane is rotateX(-90deg)):
// uv.u = (worldX+half)/size, uv.v = (half-worldZ)/size.
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// uColor carries raw sRGB components (targets are tagged sRGB, so we store sRGB
// bytes like the old canvas did). Custom ShaderMaterial output is written
// verbatim — no tonemapping/colorspace injection — so colors match.
const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMask;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float a = texture2D(uMask, vUv).a * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

// Everything needed to re-render a splat identically at any resolution/crop.
interface SplatRecord {
  x: number;
  z: number;
  radiusM: number;
  jitter: number;
  aspect: number;
  rotation: number;
  maskIndex: number;
  droplet: boolean; // true => directional comet mask (flung droplet streak)
  r: number;
  g: number;
  b: number;
  opacity: number;
}

// Per-splat shape overrides for directional flung droplets.
export interface SplatOpts {
  angle?: number; // streak orientation in paint space (radians); long axis = +x
  elongate?: number; // aspect along the streak (1 = round)
}

export class Paint {
  readonly texture: THREE.Texture;
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly paintScene = new THREE.Scene();
  private readonly liveCamera: THREE.OrthographicCamera;
  private readonly quad: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly masks: THREE.Texture[];
  private readonly dropletMasks: THREE.Texture[];
  private readonly res = CONFIG.paintResolution;
  private readonly size = CONFIG.plane.size;
  private readonly clearColor = new THREE.Color();
  private readonly history: SplatRecord[] = [];

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.rt = new THREE.WebGLRenderTarget(this.res, this.res, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.rt.texture.colorSpace = THREE.SRGBColorSpace;
    this.rt.texture.minFilter = THREE.LinearFilter; // no mips: avoids stale-mip cost on a live-updated target
    this.rt.texture.magFilter = THREE.LinearFilter;
    this.rt.texture.generateMipmaps = false;
    this.rt.texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.texture = this.rt.texture;

    const half = this.size / 2;
    this.liveCamera = new THREE.OrthographicCamera(-half, half, half, -half, -1, 1);

    const toTexture = (c: HTMLCanvasElement): THREE.Texture => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    this.masks = generateSplatTextures(4, 256).map(toTexture);
    this.dropletMasks = generateDropletTextures(4, 128).map(toTexture);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMask: { value: this.masks[0] },
        uColor: { value: new THREE.Vector3(1, 1, 1) },
        uOpacity: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.paintScene.add(this.quad);

    this.clearTarget(this.rt);
  }

  // White paper ground. Wipes all splats (live buffer + history).
  clear(): void {
    this.history.length = 0;
    this.clearTarget(this.rt);
  }

  // Stamp one splat at a world position on the ground (XZ plane, y=0).
  splat(
    worldX: number,
    worldZ: number,
    radiusM: number,
    color: string,
    opacity: number,
    opts?: SplatOpts,
  ): void {
    if (radiusM <= 1e-4) return;

    const directional = opts?.angle !== undefined;
    const pool = directional ? this.dropletMasks : this.masks;
    const int = parseInt(color.slice(1), 16);
    const rec: SplatRecord = {
      x: worldX,
      z: worldZ,
      radiusM,
      jitter: 1 + (Math.random() * 2 - 1) * CONFIG.splat.jitter,
      aspect: directional
        ? (opts!.elongate ?? 1) * (0.9 + Math.random() * 0.2)
        : 1 + (Math.random() * 2 - 1) * CONFIG.splat.aspectJitter,
      rotation: opts?.angle ?? Math.random() * Math.PI * 2,
      maskIndex: (Math.random() * pool.length) | 0,
      droplet: directional,
      r: ((int >> 16) & 255) / 255,
      g: ((int >> 8) & 255) / 255,
      b: (int & 255) / 255,
      opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    };
    this.history.push(rec);

    this.renderRecord(rec, this.rt, this.liveCamera);
  }

  // Re-bake the full splat history into a fresh target sized for print and
  // download it as a PNG. The export camera frames the fixed print area (the
  // centered rectangle matching width:height, fitted to the plane) 1:1 — no
  // padding, no crop-to-content. Returns false if there is nothing painted.
  exportPNG(width: number, height: number, filename = 'drop-it.png'): boolean {
    if (this.history.length === 0) return false;

    const camera = this.framePrintArea(width / height);

    const target = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    target.texture.colorSpace = THREE.SRGBColorSpace;

    this.clearTarget(target);
    for (const rec of this.history) this.renderRecord(rec, target, camera);

    const buf = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, width, height, buf);
    target.dispose();

    this.downloadPNG(buf, width, height, filename);
    return true;
  }

  // --- internals -----------------------------------------------------------

  private renderRecord(
    rec: SplatRecord,
    target: THREE.WebGLRenderTarget,
    camera: THREE.OrthographicCamera,
  ): void {
    const pool = rec.droplet ? this.dropletMasks : this.masks;
    this.material.uniforms.uMask.value = pool[rec.maskIndex];
    (this.material.uniforms.uColor.value as THREE.Vector3).set(rec.r, rec.g, rec.b);
    this.material.uniforms.uOpacity.value = rec.opacity;

    const drawSize = rec.radiusM * 2 * rec.jitter; // world meters
    this.quad.position.set(rec.x, -rec.z, 0); // paint space: qx=x, qy=-z
    this.quad.rotation.z = rec.rotation;
    this.quad.scale.set(drawSize * rec.aspect, drawSize / rec.aspect, 1);

    const prevTarget = this.renderer.getRenderTarget();
    const prevAuto = this.renderer.autoClear;
    this.renderer.autoClear = false; // accumulate into the target, don't wipe
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.paintScene, camera);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.autoClear = prevAuto;
  }

  // Ortho camera over the fixed print area: a rectangle of aspect `aspect`
  // (w/h), centered on the plane and scaled to fill it. This same rectangle is
  // the visible drop area (see Paint.printArea / the ground outline in scene),
  // so the export maps it 1:1 — full bleed, no padding.
  private framePrintArea(aspect: number): THREE.OrthographicCamera {
    const { w, h } = Paint.printArea(aspect);
    return new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -1, 1);
  }

  // World-meter size of the print rectangle for a given aspect (w/h), fitted
  // inside the square plane. Shared with the scene's drop-area outline.
  static printArea(aspect: number): { w: number; h: number } {
    const s = CONFIG.plane.size;
    return aspect < 1 ? { w: s * aspect, h: s } : { w: s, h: s / aspect };
  }

  private clearTarget(target: THREE.WebGLRenderTarget): void {
    const prevTarget = this.renderer.getRenderTarget();
    this.renderer.getClearColor(this.clearColor);
    const prevAlpha = this.renderer.getClearAlpha();

    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.clear(true, false, false);

    this.renderer.setRenderTarget(prevTarget);
    this.renderer.setClearColor(this.clearColor, prevAlpha);
  }

  // readRenderTargetPixels returns rows bottom-to-top; flip to a top-down PNG.
  private downloadPNG(buf: Uint8Array, width: number, height: number, filename: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(width, height);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * rowBytes;
      img.data.set(buf.subarray(src, src + rowBytes), y * rowBytes);
    }
    ctx.putImageData(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  // Splats render immediately into the target, so there is nothing to push.
  // Kept for call-site compatibility with the main loop.
  flush(): void {}
}
