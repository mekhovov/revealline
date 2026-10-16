/** Original terrain-following visual surfaces. Never used as collision geometry. */
import { GRID, CELL_M, heightMm, surfaceMm } from './design.mjs';
const snowColour = [0.9, 0.94, 0.96, 1];
const screeColour = [0.48, 0.51, 0.52, 1];
function clipHeight(poly, height, side) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const insideA = (a[1] - height) * side >= 0,
      insideB = (b[1] - height) * side >= 0;
    if (insideA) out.push(a);
    if (insideA !== insideB) {
      const t = (height - a[1]) / (b[1] - a[1]);
      out.push(a.map((value, axis) => value + (b[axis] - value) * t));
    }
  }
  return out;
}
function* triangulate(poly, color) {
  // The source contract is integer millimetres. Snap horizontal intersections first,
  // then sample the exact canonical triangle so the visual bias stays +3mm.
  const snapped = poly.map((p) => {
    const x = Math.round(p[0] * 1000) / 1000,
      z = Math.round(p[2] * 1000) / 1000;
    return [x, (surfaceMm(x, z) + 3) / 1000, z];
  });
  for (let i = 1; i + 1 < snapped.length; i++)
    yield { points: [snapped[0], snapped[i], snapped[i + 1]], color };
}
export function* alpineSurfaceOverlays({ contours = false } = {}) {
  if (typeof contours !== 'boolean') throw new TypeError('Explicit contour mode required');
  for (let cz = 0; cz < GRID; cz++)
    for (let cx = 0; cx < GRID; cx++)
      for (let z = 0; z < 32; z++)
        for (let x = 0; x < 32; x++) {
          const worldX = cx * CELL_M + x * 8,
            worldZ = cz * CELL_M + z * 8;
          const h = heightMm(worldX + 4, worldZ + 4) / 1000;
          const snow = h > 480,
            scree = h > 330;
          const meltwater =
            Math.abs(worldX - 610 - 18 * Math.sin(worldZ / 70)) < 14 &&
            worldZ > 420 &&
            worldZ < 1000;
          const road = Math.abs(worldX - 1700) < 94 && worldZ > 625 && worldZ < 735;
          const p = (dx, dz) => [
            worldX + dx,
            heightMm(worldX + dx, worldZ + dz) / 1000 + 0.003,
            worldZ + dz,
          ];
          const triangles = [
            [p(0, 0), p(0, 8), p(8, 0)],
            [p(8, 0), p(0, 8), p(8, 8)],
          ];
          if (contours) {
            for (const triangle of triangles) {
              yield* triangulate(clipHeight(triangle, 480.003, 1), snowColour);
              yield* triangulate(
                clipHeight(clipHeight(triangle, 330.003, 1), 480.003, -1),
                screeColour,
              );
            }
            // Preserve the old, independently authored low valley water and road exactly.
            if (snow || scree || (!meltwater && !road)) continue;
          } else if (!snow && !scree && !meltwater && !road) continue;
          const color = snow
            ? snowColour
            : scree
              ? screeColour
              : meltwater
                ? [0.12, 0.42, 0.48, 1]
                : [0.29, 0.29, 0.27, 1];
          for (const points of triangles) yield { points, color };
        }
}
