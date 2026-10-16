// Original scenery contact repair. No collision, crown or runtime modification.
const area = (p) =>
  p.reduce((n, a, i) => {
    const b = p[(i + 1) % p.length];
    return n + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
const side = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function clippedFoot(foot, triangle) {
  let out = foot;
  const orientation = Math.sign(area(triangle));
  for (let edge = 0; edge < 3 && out.length; edge++) {
    const a = triangle[edge],
      b = triangle[(edge + 1) % 3],
      input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const p = input[i],
        q = input[(i + 1) % input.length],
        dp = side(a, b, p) * orientation,
        dq = side(a, b, q) * orientation;
      if (dp >= 0) out.push(p);
      if (dp >= 0 !== dq >= 0) {
        const t = dp / (dp - dq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
  }
  return out;
}

// A piecewise-linear heightfield reaches its extrema at the vertices of each
// clipped polygon. Centre/ring sampling would miss an interior terrain edge.
export function footTerrainRange(foot, terrain) {
  let min = Infinity,
    max = -Infinity,
    coveredArea = 0,
    pieces = 0;
  const xmin = Math.min(...foot.map((p) => p[0])),
    xmax = Math.max(...foot.map((p) => p[0])),
    zmin = Math.min(...foot.map((p) => p[1])),
    zmax = Math.max(...foot.map((p) => p[1]));
  for (let k = 0; k < terrain.length; k += 9) {
    const a = terrain.slice(k, k + 3),
      b = terrain.slice(k + 3, k + 6),
      c = terrain.slice(k + 6, k + 9);
    if (
      Math.min(a[0], b[0], c[0]) > xmax ||
      Math.max(a[0], b[0], c[0]) < xmin ||
      Math.min(a[2], b[2], c[2]) > zmax ||
      Math.max(a[2], b[2], c[2]) < zmin
    )
      continue;
    const triangle = [a, b, c].map((p) => [p[0], p[2]]),
      polygon = clippedFoot(foot, triangle);
    if (polygon.length < 3 || Math.abs(area(polygon)) < 1e-12) continue;
    const denominator = side(triangle[0], triangle[1], triangle[2]);
    if (!denominator) throw Error('Vertical face in terrain heightfield');
    coveredArea += Math.abs(area(polygon));
    pieces++;
    for (const p of polygon) {
      const wa = side(triangle[1], triangle[2], p) / denominator,
        wb = side(triangle[2], triangle[0], p) / denominator,
        y = wa * a[1] + wb * b[1] + (1 - wa - wb) * c[1];
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  }
  const footprintArea = Math.abs(area(foot));
  if (!pieces || Math.abs(coveredArea - footprintArea) > 1e-7)
    throw Error('Trunk foot does not have complete, nonoverlapping terrain coverage');
  return { min, max, pieces, footprintArea, coveredArea };
}

export function rootTrunks(batch, terrain, apply = true) {
  const { positions, normals } = batch,
    rows = [];
  if (positions.length !== 56 * 60 * 3 || normals.length !== positions.length)
    throw Error('Expected exactly 56 original five-sided, closed trunks');
  for (let tree = 0; tree < 56; tree++) {
    const start = tree * 60 * 3,
      end = start + 60 * 3,
      ys = positions.slice(start, end).filter((_, i) => i % 3 === 1),
      bottom = Math.min(...ys),
      top = Math.max(...ys),
      points = new Map();
    for (let i = start; i < end; i += 3)
      if (positions[i + 1] === bottom)
        points.set(positions[i] + ',' + positions[i + 2], [positions[i], positions[i + 2]]);
    const candidates = [...points.values()],
      centre = candidates.reduce(
        (p, q) => [p[0] + q[0] / candidates.length, p[1] + q[1] / candidates.length],
        [0, 0],
      ),
      foot = candidates
        .filter((p) => Math.hypot(p[0] - centre[0], p[1] - centre[1]) > 0.1)
        .sort(
          (a, b) =>
            Math.atan2(a[1] - centre[1], a[0] - centre[0]) -
            Math.atan2(b[1] - centre[1], b[0] - centre[0]),
        );
    if (foot.length !== 5) throw Error('Expected the actual five foot corners');
    const contact = footTerrainRange(foot, terrain),
      newBottom = Math.fround(Math.min(bottom, contact.min - 0.08)),
      slope = (0.18 - 0.09) / (top - newBottom);
    if (apply && newBottom !== bottom) {
      for (let i = start; i < end; i += 3) {
        if (positions[i + 1] === bottom) positions[i + 1] = newBottom;
        if (Math.abs(normals[i + 1]) < 0.5) {
          const radial = Math.hypot(normals[i], normals[i + 2]),
            scale = Math.hypot(1, slope);
          normals[i] /= radial * scale;
          normals[i + 1] = slope / scale;
          normals[i + 2] /= radial * scale;
        }
      }
    }
    rows.push({
      tree,
      centre,
      foot,
      bottom,
      top,
      newBottom,
      exposedDrop: Math.max(0, bottom - contact.min),
      embedDepth: contact.min - newBottom,
      ...contact,
    });
  }
  return rows;
}
