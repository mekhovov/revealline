// Original CC0 albedo study; existing UV scale, roughness and physical faces stay unchanged.
import { noise, rgbPNG } from './mineral.mjs';

const size = 256,
  fract = (n) => n - Math.floor(n),
  random = (x, y, seed) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 17.31) * 43758.5453123),
  wrap = (v) => v - Math.round(v / size) * size,
  clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function periodic(x, y, sx, sy = sx) {
  const u = x / size,
    v = y / size;
  return (
    noise(u * sx, v * sy) * (1 - u) * (1 - v) +
    noise((u - 1) * sx, v * sy) * u * (1 - v) +
    noise(u * sx, (v - 1) * sy) * (1 - u) * v +
    noise((u - 1) * sx, (v - 1) * sy) * u * v
  );
}

export function finishedMineralPNG() {
  // Sparse finite, softly shaded seams are albedo only: no dark holes, relief or new edges.
  // Torus-local segment coordinates keep every seam continuous across the repeat boundary.
  const seams = Array.from({ length: 11 }, (_, i) => {
      const angle = (i % 3 ? -0.32 : 1.12) + (random(i, 1, 79) - 0.5) * 0.5;
      return {
        x: random(i, 2, 79) * size,
        y: random(i, 3, 79) * size,
        dx: Math.cos(angle),
        dy: Math.sin(angle),
        half: 12 + random(i, 4, 79) * 30,
        width: 0.9 + random(i, 5, 79) * 0.6,
      };
    }),
    scanlines = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let seam = 0;
      for (const line of seams) {
        const vx = wrap(x - line.x),
          vy = wrap(y - line.y),
          along = clamp(vx * line.dx + vy * line.dy, -line.half, line.half),
          distance = Math.hypot(vx - along * line.dx, vy - along * line.dy);
        seam = Math.max(seam, clamp(1 - distance / line.width, 0, 1));
      }
      const broad = periodic(x, y, 3),
        grain = periodic(x, y, 17),
        direction = periodic(x, y, 3, 19),
        shade =
          190 +
          (broad - 0.5) * 10 +
          (grain - 0.5) * 3 +
          (direction - 0.5) * 6 +
          (random(x, y, 83) - 0.5) * 16 -
          seam * 4,
        at = y * (size * 3 + 1) + 1 + x * 3;
      scanlines[at] = Math.round(shade + 4);
      scanlines[at + 1] = Math.round(shade + 2);
      scanlines[at + 2] = Math.round(shade);
    }
  return rgbPNG(size, scanlines);
}
