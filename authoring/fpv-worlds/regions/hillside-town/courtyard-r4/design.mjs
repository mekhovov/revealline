/** One planted civic market court; no expansion of accepted world/pins. */
import * as base from '../courtyard-r3/design.mjs';
export const { sizeM, heightMm, houses, roadTopMm, spawns, placements, routes, probes, roads } =
  base;
export const revision = 'courtyard-r4';
export const title = {
  en: 'Hillside Town — planted market courtyard',
  uk: 'Містечко на схилі — озеленене ринкове подвір’я',
};
export function architecture() {
  const boxes = base.architecture();
  const box = (id, center, size, color, primitive) =>
    boxes.push({
      id,
      center,
      size,
      color,
      ...(primitive ? { primitive } : {}),
    });
  const stone = [0.64, 0.59, 0.48],
    soil = [0.24, 0.19, 0.11],
    wood = [0.3, 0.19, 0.1];
  // Trees are original low-poly solid geometry, deliberately outside every certified corridor.
  for (const [i, x, z] of [
    [0, 183, 216],
    [1, 183, 239],
    [2, 206, 218],
  ]) {
    box(`planter-${i}`, [x, 12.5, z], [3.2, 0.8, 3.2], stone);
    box(`planter-soil-${i}`, [x, 12.94, z], [2.8, 0.08, 2.8], soil);
    box(`tree-trunk-${i}`, [x, 14.8, z], [0.45, 3.8, 0.45], wood, 'trunk');
    for (const [n, dx, dy, dz, r] of [
      [0, 0, 0, 0, 2.2],
      [1, -0.8, -0.35, 0.4, 1.5],
      [2, 0.6, 0.45, -0.5, 1.7],
    ])
      box(
        `tree-crown-${i}-${n}`,
        [x + dx, 17.3 + dy, z + dz],
        [r * 2, r * 1.6, r * 2],
        [0.19 + n * 0.025, 0.35 + n * 0.02, 0.12],
        'crown',
      );
  }
  // Low paired garden beds and a paving edge frame the seats, not the central aisle.
  for (const [i, x, z] of [
    [0, 202, 216],
    [1, 194, 239],
  ]) {
    box(`garden-${i}`, [x, 12.38, z], [2.5, 0.56, 1.2], stone);
    box(`garden-green-${i}`, [x, 12.9, z], [2.2, 0.6, 0.9], [0.28, 0.4, 0.13], 'crown');
  }
  // Thin paving bands sit on the existing flat courtyard slab; no collision staircase.
  for (const z of [214, 220, 226, 232, 238])
    box(`paving-band-${z}`, [192, 12.095, z], [36, 0.012, 0.12], [0.72, 0.66, 0.53]);
  // Striped timber/canvas canopy and grounded produce displays keep the 2.2 m aisle open.
  for (const [bay, z] of [
    [0, 230],
    [1, 237],
  ]) {
    for (let n = 0; n < 7; n++)
      box(
        `awning-stripe-${bay}-${n}`,
        [173.21 + n * 0.93, 17.26, z],
        [0.9, 0.03, 5.15],
        n % 2 ? [0.84, 0.75, 0.52] : [0.3, 0.46, 0.38],
      );
    for (const x of [173.8, 178.2])
      for (const [n, dz] of [
        [0, -0.8],
        [1, 0],
        [2, 0.8],
      ]) {
        box(`display-box-${bay}-${x}-${n}`, [x, 13.32, z + dz], [0.62, 0.34, 0.64], wood);
        box(
          `display-produce-${bay}-${x}-${n}`,
          [x, 13.57, z + dz],
          [0.48, 0.2, 0.49],
          [
            [0.67, 0.29, 0.14],
            [0.54, 0.59, 0.2],
            [0.77, 0.57, 0.18],
          ][n],
          'crown',
        );
      }
  }
  // Insets are drawn on closed side walls; the real front/back doorway meshes stay untouched.
  for (const [id, x, z] of [
    ['civic', 176, 176],
    ['market', 218, 210],
  ])
    for (const dz of [-5.16, 5.16])
      for (const dx of [-2.7, 2.7]) {
        box(`window-frame-${id}-${dx}-${dz}`, [x + dx, 15.7, z + dz], [1.8, 2.2, 0.12], stone);
        box(
          `window-inset-${id}-${dx}-${dz}`,
          [x + dx, 15.7, z + dz + Math.sign(dz) * 0.08],
          [1.45, 1.85, 0.08],
          [0.2, 0.29, 0.29],
        );
        box(
          `window-mullion-${id}-${dx}-${dz}`,
          [x + dx, 15.7, z + dz + Math.sign(dz) * 0.14],
          [0.1, 1.9, 0.06],
          wood,
        );
      }
  return boxes;
}
