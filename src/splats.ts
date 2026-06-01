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

// Comet/teardrop masks for flung secondary droplets: a round head on the +x
// side tapering to a thin tail toward -x, plus a couple of tiny lead specks.
// paint.ts rotates these to the droplet's flight direction so they read as
// directional streaks instead of round blobs. The long axis is +x (so a
// horizontal aspect>1 stretches along the streak).
export function generateDropletTextures(count = 4, size = 128): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < count; i++) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;
    const rand = makeRng(0x85ebca6b ^ ((i + 1) * 2246822519));
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';

    const cy = size / 2;
    const headX = size * 0.66;
    const tailX = size * 0.14;
    const headR = size * (0.16 + rand() * 0.05);

    // Tapered body: overlapping circles shrinking from head to tail.
    const steps = 14;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = headX + (tailX - headX) * t;
      const r = headR * (1 - t) * (1 - t) + size * 0.012; // quadratic taper to a fine tail
      const wobble = (rand() * 2 - 1) * size * 0.01;
      ctx.beginPath();
      ctx.arc(x, cy + wobble, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // A few tiny droplets thrown ahead of the head (motion lead).
    const lead = 2 + Math.floor(rand() * 3);
    for (let s = 0; s < lead; s++) {
      const x = headX + size * (0.06 + rand() * 0.16);
      const y = cy + (rand() * 2 - 1) * size * 0.06;
      const r = size * (0.008 + rand() * 0.02);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    out.push(c);
  }
  return out;
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

    // Clean round-ish core. The flung spray is rendered as separate directional
    // droplets (see splash.ts), so the main splat stays round — only a gentle
    // edge wobble (lots of points, small jitter) keeps it from looking like a
    // perfect circle.
    drawBlob(ctx, cx, cy, size * 0.36, size * 0.025, 48, rand);

    out.push(c);
  }
  return out;
}
