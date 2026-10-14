/** Original second relief study. Smooth authored drainage joins on the unchanged 4 m format. */
import {
  CatmullRomCurve3,
  Vector3,
} from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';

const main = [
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
const fork = [
  [250, 540],
  [180, 590],
  [125, 680],
  [100, 740],
];
const line = (points, samples) =>
  new CatmullRomCurve3(
    points.map(([x, z]) => new Vector3(x, 0, z)),
    false,
    'centripetal',
  ).getSpacedPoints(samples);
const channels = [line(main, 384), line(fork, 160)];
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const t = clamp(v);
  return t * t * (3 - 2 * t);
};
const softMin = (a, b, radius = 5) =>
  Math.min(a, b) - Math.max(radius - Math.abs(a - b), 0) ** 2 / (4 * radius);
function distance(x, z, points) {
  let result = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz));
    result = Math.min(result, (x - a.x - t * dx) ** 2 + (z - a.z - t * dz) ** 2);
  }
  return Math.sqrt(result);
}
export function reliefHeightMm(x, z) {
  let h = 74 + 9 * Math.sin(x / 96) * Math.cos(z / 117);
  h += 18 * smooth((x - 390) / 100) + 14 * smooth((z - 530) / 80);
  h += 50 * Math.exp(-(((x - 510) / 48) ** 2 + ((z - 330) / 55) ** 2));
  h += 65 * Math.exp(-(((x - 620) / 50) ** 2 + ((z - 440) / 54) ** 2));
  const basin = Math.hypot((x - 150) / 135, (z - 125) / 120);
  if (basin < 1.55) h = softMin(h, 6 + 82 * smooth((basin - 0.82) / 0.73));
  const floor = 9 + z / 160;
  const d = distance(x, z, channels[0]);
  const f = distance(x, z, channels[1]);
  if (d < 64) h = softMin(h, floor + 95 * smooth((d - 20) / 44));
  if (f < 46) h = softMin(h, floor + 95 * smooth((f - 12) / 34));
  return Math.round(h * 1000);
}

// Same source triangle diagonal and millimetre values used by compileTerrainCell.
export function reliefSurfaceMm(x, z) {
  const ix = Math.floor(x / 4),
    iz = Math.floor(z / 4),
    u = x / 4 - ix,
    v = z / 4 - iz;
  const a = reliefHeightMm(ix * 4, iz * 4),
    b = reliefHeightMm((ix + 1) * 4, iz * 4);
  const c = reliefHeightMm(ix * 4, (iz + 1) * 4),
    d = reliefHeightMm((ix + 1) * 4, (iz + 1) * 4);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
