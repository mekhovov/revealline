/** Original drainage retained; an 8 m binomial filter rounds narrow ridge transitions. */
import { heightMm } from './design.mjs';

const weights = [1, 4, 6, 4, 1];
const heights = new Map();
function originalHeight(x, z) {
  const key = `${x},${z}`;
  if (!heights.has(key)) heights.set(key, heightMm(x, z));
  return heights.get(key);
}
export function reliefHeightMm(x, z) {
  let sum = 0;
  for (let zOffset = -2; zOffset <= 2; zOffset++) {
    for (let xOffset = -2; xOffset <= 2; xOffset++) {
      sum +=
        originalHeight(x + xOffset * 4, z + zOffset * 4) *
        weights[xOffset + 2] *
        weights[zOffset + 2];
    }
  }
  return Math.round(sum / 256);
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
