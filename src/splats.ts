// Procedurally generate the splat-shape pool as alpha masks (white blobs on
// transparent). Built once at startup -> no asset files, no native deps.
// Tinting/rotation/scale happen later in paint.ts per impact.

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseR: number,
  jitter: number,
  points: number,
  rand: () => number,
): void {
  ctx.beginPath();
  for (let p = 0; p <= points; p++) {
    const a = (p / points) * Math.PI * 2;
    const r = baseR + (rand() * 2 - 1) * jitter;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (p === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export function generateSplatTextures(count = 4, size = 256): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    const rand = makeRng(0x9e3779b1 ^ ((i + 1) * 2654435761));
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';

    const cx = size / 2;
    const cy = size / 2;

    // Main irregular blob.
    drawBlob(ctx, cx, cy, size * 0.3, size * 0.11, 16, rand);

    // Satellite droplets flung around the core.
    const satellites = 4 + Math.floor(rand() * 5);
    for (let s = 0; s < satellites; s++) {
      const ang = rand() * Math.PI * 2;
      const dist = size * (0.28 + rand() * 0.16);
      const sx = cx + Math.cos(ang) * dist;
      const sy = cy + Math.sin(ang) * dist;
      const sr = size * (0.02 + rand() * 0.05);
      drawBlob(ctx, sx, sy, sr, sr * 0.5, 9, rand);
    }

    // Fine speckles for splatter texture.
    const speckles = 12 + Math.floor(rand() * 16);
    for (let s = 0; s < speckles; s++) {
      const ang = rand() * Math.PI * 2;
      const dist = size * (0.3 + rand() * 0.18);
      const sx = cx + Math.cos(ang) * dist;
      const sy = cy + Math.sin(ang) * dist;
      const sr = size * (0.005 + rand() * 0.015);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    out.push(c);
  }
  return out;
}
