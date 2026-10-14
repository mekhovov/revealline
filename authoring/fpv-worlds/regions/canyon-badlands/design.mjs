/** Original authored terrain. Millimetre lattice output; no runtime generation. */
import { readFileSync } from 'node:fs';
const layout = JSON.parse(readFileSync(new URL('./layout.json', import.meta.url), 'utf8'));
export const { extent, districts, landmarks, routes } = layout;
const mainChannel = [
  [170, 155],
  [240, 220],
  [210, 300],
  [280, 360],
  [300, 420],
  [250, 480],
  [250, 540],
  [300, 620],
  [330, 730],
];
const sideChannel = [
  [250, 540],
  [180, 590],
  [125, 680],
  [100, 740],
];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const segmentDistance = (x, z, a, b) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
};
const channelDistance = (x, z, points) =>
  Math.min(...points.slice(1).map((p, i) => segmentDistance(x, z, points[i], p)));
export function heightMm(x, z) {
  let height = 74 + 9 * Math.sin(x / 96) * Math.cos(z / 117);
  height += 18 * smooth((x - 390) / 100) + 14 * smooth((z - 530) / 80);
  height += 50 * Math.exp(-(((x - 510) / 48) ** 2 + ((z - 330) / 55) ** 2));
  height += 65 * Math.exp(-(((x - 620) / 50) ** 2 + ((z - 440) / 54) ** 2));
  const basin = Math.hypot((x - 150) / 135, (z - 125) / 120);
  if (basin < 1.47) height = Math.min(height, 6 + 82 * smooth((basin - 0.82) / 0.65));
  const floor = 9 + z / 160;
  const mainDistance = channelDistance(x, z, mainChannel);
  const sideDistance = channelDistance(x, z, sideChannel);
  if (mainDistance < 54) height = Math.min(height, floor + 95 * smooth((mainDistance - 18) / 36));
  if (sideDistance < 36) height = Math.min(height, floor + 95 * smooth((sideDistance - 10) / 26));
  return Math.round(height * 1000);
}
// Same triangle diagonal as compileTerrainCell; never estimate clearance on the smooth equation.
export function surfaceMm(x, z) {
  const ix = Math.min(191, Math.floor(x / 4)),
    iz = Math.min(191, Math.floor(z / 4));
  const u = x / 4 - ix,
    v = z / 4 - iz;
  const a = heightMm(ix * 4, iz * 4),
    b = heightMm((ix + 1) * 4, iz * 4);
  const c = heightMm(ix * 4, (iz + 1) * 4),
    d = heightMm((ix + 1) * 4, (iz + 1) * 4);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
