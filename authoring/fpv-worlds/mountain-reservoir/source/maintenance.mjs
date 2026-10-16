// Original closed-face maintenance paint. Every coloured region is a partition
// of one plane: the badge has real geometry holes filled by opaque glyphs.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';

export function maintenanceInlays(add) {
  const counts = {};
  const front = ([u, v]) => [u, v, -10.95];
  const east = ([u, v]) => [-17.95, v, -u];
  const rectangle = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  function paint(role, contour, map, holes = []) {
    const vectors = (a) => a.map((v) => new THREE.Vector2(...v)),
      faces = THREE.ShapeUtils.triangulateShape(vectors(contour), holes.map(vectors)),
      points = [contour, ...holes].flat(),
      positions = faces.flatMap((face) => {
        const p = face.map((i) => map(points[i])),
          a = new THREE.Vector3(...p[0]),
          normal = new THREE.Vector3(...p[1]).sub(a).cross(new THREE.Vector3(...p[2]).sub(a));
        if ((map === front ? normal.z : normal.x) < 0) [p[1], p[2]] = [p[2], p[1]];
        return p.flat();
      }),
      geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    add(geometry, role);
    counts[role] = (counts[role] ?? 0) + faces.length;
  }
  const rect = (role, x0, y0, x1, y1, map = front) => paint(role, rectangle(x0, y0, x1, y1), map);

  // Match the three opaque canonical marks, replacing the old high duplicate
  // row. Solid panes remain visible in Low, which omits canonical flush marks.
  for (const u of [15 - 8 / 3, 15, 15 + 8 / 3]) {
    const l = u - 0.55,
      r = u + 0.55,
      b = 1.4 - 0.525,
      t = 1.4 + 0.525,
      stroke = 0.12;
    rect('closed-window', l, b, r, t, east);
    rect('chalk-enamel', l - stroke, b - stroke, l, t + stroke, east);
    rect('chalk-enamel', r, b - stroke, r + stroke, t + stroke, east);
    rect('chalk-enamel', l, b - stroke, r, b, east);
    rect('chalk-enamel', l, t, r, t + stroke, east);
  }

  // Blue water-service badge, original droplet and station 01. Each glyph
  // replaces the background region beneath it; no coplanar coloured layers.
  const badge = rectangle(-22.9, 2.95, -21.1, 3.57),
    droplet = [
      [-22.57, 3.43],
      [-22.76, 3.15],
      [-22.68, 3.06],
      [-22.46, 3.06],
      [-22.38, 3.15],
    ],
    zero = rectangle(-22.19, 3.07, -21.84, 3.45),
    one = rectangle(-21.58, 3.07, -21.49, 3.45);
  paint('blue-enamel', badge, front, [droplet, zero, one]);
  paint('chalk-enamel', droplet, front);
  paint('chalk-enamel', one, front);
  rect('blue-enamel', -22.1, 3.16, -21.93, 3.36);
  rect('chalk-enamel', -22.19, 3.07, -22.1, 3.45);
  rect('chalk-enamel', -21.93, 3.07, -21.84, 3.45);
  rect('chalk-enamel', -22.1, 3.07, -21.93, 3.16);
  rect('chalk-enamel', -22.1, 3.36, -21.93, 3.45);

  // Closed vent plate, nine touching opaque strips rather than open slots.
  for (let i = 0; i < 9; i++)
    rect(
      i % 2 ? 'chalk-enamel' : 'closed-window',
      -25.175,
      2.4 + (i * 0.6) / 9,
      -24.425,
      2.4 + ((i + 1) * 0.6) / 9,
    );
  rect('chalk-enamel', -22.965, 0.06, -22.825, 2.45);
  rect('chalk-enamel', -21.175, 0.06, -21.035, 2.45);
  // The front plinth stops at the jambs; no extra layer covers the closed door.
  rect('oxidized-roof', -26, 0.06, -22.965, 0.52);
  rect('oxidized-roof', -21.035, 0.06, -18, 0.52);
  rect('oxidized-roof', 11, 0.06, 19, 0.52, east);
  const triangles = Object.values(counts).reduce((a, b) => a + b, 0);
  if (triangles > 96) throw Error('Maintenance inlay triangle budget exceeded');
  return { triangles, byRole: counts };
}
