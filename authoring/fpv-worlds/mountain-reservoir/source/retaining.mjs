// Original shallow finish over the existing cut-rock prisms. No new physical solids.
import { noise } from './mineral.mjs';

const ids = new Set([
  'rock-west-lower',
  'rock-west-middle',
  'rock-west-upper',
  'rock-north-shoulder',
  'rock-north-terrace',
]);
export function retainingFaces(terrains) {
  const positions = [],
    shades = [],
    faces = [],
    offset = 0.0015;
  const triangle = (points, normal, shade, owner) => {
    const [a, b, c] = points,
      u = b.map((v, i) => v - a[i]),
      v = c.map((value, i) => value - a[i]),
      cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cross.reduce((sum, value, i) => sum + value * normal[i], 0) < 0)
      [points[1], points[2]] = [points[2], points[1]];
    positions.push(...points.flat());
    shades.push(shade, shade, shade);
    faces.push({ ...owner, normal, offset });
  };
  for (const terrain of terrains) {
    if (!ids.has(terrain.id)) throw Error('Unexpected retaining terrain');
    const points = Array.from({ length: terrain.vertices.length / 3 }, (_, i) =>
        terrain.vertices.slice(i * 3, i * 3 + 3).map((v) => v / 1000),
      ),
      count = points.length / 2,
      bottom = points[0][1],
      top = points[count][1],
      centre = [0, 2].map(
        (axis) => points.slice(0, count).reduce((n, p) => n + p[axis], 0) / count,
      );
    if (!Number.isInteger(count) || top <= bottom) throw Error('Expected original upright prism');
    // Keep top triangles exact apart from the shallow finish offset. The original
    // support plane, silhouette and all covered portions remain physically intact.
    for (let i = 0; i < terrain.indices.length; i += 3) {
      const indices = terrain.indices.slice(i, i + 3);
      if (!indices.every((index) => index >= count)) continue;
      triangle(
        indices.map((index) => [points[index][0], top + offset, points[index][2]]),
        [0, 1, 0],
        0.98,
        { id: terrain.id, kind: 'top', sourceTriangle: i / 3 },
      );
    }
    for (let i = 0; i < count; i++) {
      const a = points[i],
        b = points[(i + 1) % count];
      // These backs face out of the playable volume and are already enclosed by
      // the retained ridge/skirt. Do not spend decorative geometry behind them.
      if ((a[0] === -44 && b[0] === -44) || (a[2] === -34 && b[2] === -34)) continue;
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz),
        normal = [-dz / length, 0, dx / length];
      if (
        normal[0] * (centre[0] - (a[0] + b[0]) / 2) + normal[2] * (centre[1] - (a[2] + b[2]) / 2) >
        0
      )
        for (let axis = 0; axis < 3; axis++) normal[axis] *= -1;
      const levels = (p) => [
          bottom,
          bottom + (top - bottom) * (0.22 + noise(p[0] / 5, p[2] / 5) * 0.05),
          bottom + (top - bottom) * (0.47 + noise(p[0] / 7 + 9, p[2] / 7) * 0.07),
          bottom + (top - bottom) * (0.76 + noise(p[0] / 4, p[2] / 4 + 5) * 0.04),
          top,
        ],
        left = levels(a),
        right = levels(b),
        point = (p, y) => [p[0] + normal[0] * offset, y, p[2] + normal[2] * offset];
      for (let band = 0; band < 4; band++) {
        const shade = [0.98, 0.91, 0.96, 0.93][band] + noise(a[0] / 6 + band, a[2] / 6) * 0.025,
          p = [
            point(a, left[band]),
            point(b, right[band]),
            point(b, right[band + 1]),
            point(a, left[band + 1]),
          ],
          owner = { id: terrain.id, kind: 'side', edge: i, band };
        triangle([p[0], p[1], p[2]], normal, shade, owner);
        triangle([p[0], p[2], p[3]], normal, shade, owner);
      }
    }
  }
  if (positions.length / 9 > 278 || faces.length !== shades.length / 3)
    throw Error('Retaining finish exceeds the reviewed budget');
  return { positions, shades, faces, triangles: positions.length / 9 };
}
