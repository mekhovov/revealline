/** Original civic courtyard. The accepted r2 street and doorway layout stays intact. */
import * as base from '../design.mjs';
export const { sizeM, heightMm, houses, roads, roadTopMm, spawns } = base;
export const revision = 'courtyard-r3';
export const title = {
  en: 'Hillside Town — civic courtyard study',
  uk: 'Містечко на схилі — дослідження міського подвір’я',
};
export const placements = base.placements.map((p) => ({ ...p }));
// Licensed kit columns retain their original UVs and one shared palette.
for (const z of [228, 232, 235, 239])
  for (const x of [173.5, 178.5])
    placements.push({
      id: `market-column-${x}-${z}`.replaceAll('.', 'p'),
      asset: 'column.glb',
      x,
      y: heightMm(x, z) / 1000 + 0.1,
      z,
      scale: 2,
      yaw: 0,
    });

export function architecture() {
  const boxes = base.architecture();
  const box = (id, center, size, color) => boxes.push({ id, center, size, color });
  const stone = [0.62, 0.56, 0.43],
    trim = [0.84, 0.78, 0.62],
    wood = [0.29, 0.19, 0.12];
  // Distinct supported roof silhouettes on the two buildings framing the court.
  for (const [id, x, z, shade, width, height] of [
    ['civic-house', 176, 176, [0.7, 0.58, 0.41], 5.8, 2.4],
    ['market-house', 218, 210, [0.6, 0.35, 0.23], 7, 1.4],
  ]) {
    box(`${id}-roof-storey`, [x, 19.2 + height / 2, z], [width, height, 5.8], shade);
    box(`${id}-roof-cap`, [x, 19.2 + height + 0.15, z], [width + 0.7, 0.3, 6.5], trim);
    for (const dz of [-5.16, 5.16]) {
      box(`${id}-cornice-${dz}`, [x, 17.8, z + dz], [10.5, 0.3, 0.25], trim);
      for (const dx of [-4.8, 0, 4.8])
        box(`${id}-pilaster-${dx}-${dz}`, [x + dx, 15, z + dz], [0.22, 5.8, 0.22], trim);
    }
  }
  // Two open market bays. Roof panels follow the local support height; the
  // north/south aisle and east-facing approach have no wall or hanging banner.
  for (const [bay, z] of [
    [0, 230],
    [1, 237],
  ]) {
    const y = heightMm(176, z) / 1000;
    box(`market-${bay}-canopy`, [176, y + 5.075, z], [6.5, 0.35, 5.2], [0.72, 0.37, 0.22]);
    box(`market-${bay}-crest`, [176, y + 5.3, z], [0.35, 0.2, 5.2], trim);
    // Counters stay outside the 2.2 m centre aisle; legs reach actual road top.
    for (const x of [173.8, 178.2]) {
      box(`market-${bay}-counter-${x}`, [x, y + 1.05, z], [0.8, 0.2, 3], wood);
      for (const dz of [-1.1, 1.1])
        box(`market-${bay}-leg-${x}-${dz}`, [x, y + 0.55, z + dz], [0.18, 0.9, 0.18], wood);
    }
  }
  // A recognizable original civic clock marker at the quiet south-east edge.
  // Static face/hands are artwork, not a simulation timer or navigation HUD.
  box('civic-marker-base', [207, 12.5, 238], [3.8, 0.8, 3.8], stone);
  box('civic-marker-shaft', [207, 18.8, 238], [2.6, 12, 2.6], stone);
  box('civic-marker-crown', [207, 25, 238], [3.4, 0.4, 3.4], trim);
  box('civic-marker-face', [205.68, 23, 238], [0.08, 2.2, 2.2], trim);
  box('civic-marker-hour', [205.62, 23.35, 238], [0.05, 0.8, 0.12], wood);
  box('civic-marker-minute', [205.62, 23, 238.4], [0.05, 0.12, 0.9], wood);
  // Benches describe the court perimeter without interrupting flight lanes.
  for (const [id, x, z] of [
    ['north', 204, 216],
    ['south', 194, 238],
  ]) {
    box(`bench-${id}-seat`, [x, 12.85, z], [3, 0.2, 0.7], wood);
    box(`bench-${id}-back`, [x, 13.25, z + 0.3], [3, 0.7, 0.15], wood);
    for (const dx of [-1, 1])
      box(`bench-${id}-leg-${dx}`, [x + dx, 12.45, z], [0.2, 0.7, 0.5], stone);
  }
  return boxes;
}
export const routes = [
  ...base.routes,
  {
    id: 'market-open-arcade',
    halfWidth: 0.65,
    points: [
      [176, 14.5, 222],
      [176, 14.5, 235],
    ],
  },
  {
    id: 'civic-marker-orbit',
    halfWidth: 2,
    points: [
      [198, 18, 231],
      [198, 18, 247],
      [216, 18, 247],
      [216, 18, 231],
    ],
  },
];
export const probes = [
  ...base.probes,
  { id: 'market-aisle-clear', from: [176, 14.5, 225], to: [176, 14.5, 234], clear: true },
  { id: 'market-canopy-solid', from: [176, 20, 230], to: [176, 14, 230], clear: false },
  { id: 'market-column-solid', from: [172, 14, 228], to: [175, 14, 228], clear: false },
  { id: 'civic-marker-solid', from: [203, 20, 238], to: [211, 20, 238], clear: false },
];
