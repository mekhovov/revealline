/** Original fictional relief; existing terrestrial flight physics is unchanged. */
import { readFileSync } from 'node:fs';
export const design = JSON.parse(readFileSync(new URL('./design.json', import.meta.url)));
export const revision = 'composition-r1';
const sq = (x) => x * x;
const gauss = (x, z, cx, cz, sx, sz = sx) => Math.exp(-sq((x - cx) / sx) - sq((z - cz) / sz));
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function crater(x, z, cx, cz, radius, depth, rim) {
  const r = Math.hypot(x - cx, (z - cz) * 1.08) / radius;
  return -depth * Math.exp(-Math.pow(r / 0.76, 4)) + rim * Math.exp(-sq((r - 1) / 0.19));
}
function unflattened(x, z) {
  // Broad asymmetric mare and highlands; no tiling, dunes, random runtime noise or copied data.
  let y = 22 + 1.8 * Math.sin(x / 91) * Math.cos(z / 117);
  y += 21 * gauss(x, z, 390, 590, 155, 145) + 12 * gauss(x, z, 656, 570, 140, 180);
  y +=
    4 * Math.exp(-sq((z - (246 + 18 * Math.sin(x / 70))) / 15)) * gauss(x, z, 170, 230, 100, 160);
  y += crater(x, z, 382, 44, 74, 13, 8);
  y += crater(x, z, 151, 591, 117, 20, 14);
  y += crater(x, z, 74, 230, 29, 3.5, 1.8) + crater(x, z, 230, 84, 22, 3, 1.5);
  // One continuous sinuous rille, with wide entrances rather than sharp periodic teeth.
  const centre = 622 + 24 * Math.sin((z - 70) / 58) + 8 * Math.sin(z / 117);
  y -=
    13 * Math.exp(-Math.pow((x - centre) / 24, 4)) * smooth(18, 80, z) * (1 - smooth(310, 380, z));
  y -= 7 * Math.exp(-sq((x - (359 + (z - 470) * 0.48)) / 20)) * gauss(x, z, 410, 570, 115, 145);
  y -= 6 * Math.exp(-sq((x - (469 - (z - 570) * 0.32)) / 22)) * gauss(x, z, 410, 620, 120, 95);
  // Broad irregular ejecta lobes, distinct from the mare and terraced crater.
  y += 6 * gauss(x, z, 430, 271, 54, 34) + 4 * gauss(x, z, 322, 198, 42, 67);
  return y;
}
const flattened = [
  [104, 144, 28],
  [608, 520, 34],
  [680, 648, 41],
  ...design.districts.map((d) => [...d.startXZMm.map((n) => n / 1000), 9]),
];
export function heightMm(x, z) {
  let y = unflattened(x, z);
  for (const [cx, cz, radius] of flattened) {
    const weight = 1 - smooth(radius, radius + 12, Math.hypot(x - cx, z - cz));
    y = y * (1 - weight) + unflattened(cx, cz) * weight;
  }
  return Math.round(y * 1000);
}
/** Exact canonical triangle interpolation, not an analytic approximation between samples. */
export function sampledHeight(x, z) {
  const x0 = Math.floor(x / 4) * 4,
    z0 = Math.floor(z / 4) * 4;
  const u = (x - x0) / 4,
    v = (z - z0) / 4;
  const a = heightMm(x0, z0),
    b = heightMm(x0 + 4, z0),
    c = heightMm(x0, z0 + 4),
    d = heightMm(x0 + 4, z0 + 4);
  return (
    (u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)) / 1000
  );
}
export const spawns = design.districts.map((d) => ({
  id: d.id,
  position: {
    x: d.startXZMm[0],
    y: heightMm(d.startXZMm[0] / 1000, d.startXZMm[1] / 1000) + 3000,
    z: d.startXZMm[1],
  },
}));
