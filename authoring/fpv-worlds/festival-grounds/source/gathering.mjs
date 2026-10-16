// Original r3 gathering pocket. Painted ground has no elevation/collision role.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';

export function addGatheringDetails(art, solid) {
  function polygon(role, points, map, tint = 1, outward = [0, 0, 1]) {
    const contour = points.map(([x, y]) => new THREE.Vector2(x, y));
    const positions = THREE.ShapeUtils.triangulateShape(contour, []).flatMap((triangle) =>
      triangle.flatMap((i) => map(...points[i])),
    );
    for (let i = 0; i < positions.length; i += 9) {
      const a = new THREE.Vector3(...positions.slice(i, i + 3));
      const normal = new THREE.Vector3(...positions.slice(i + 3, i + 6))
        .sub(a)
        .cross(new THREE.Vector3(...positions.slice(i + 6, i + 9)).sub(a));
      if (normal.dot(new THREE.Vector3(...outward)) < 0) {
        const b = positions.slice(i + 3, i + 6);
        positions.splice(i + 3, 3, ...positions.slice(i + 6, i + 9));
        positions.splice(i + 6, 3, ...b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    art.add(geometry, role, [0, 0, 0], [0, 0, 0], tint);
  }
  function ground(points, tint) {
    // Outlines stop at the existing lane
    // edge, so no second surface lies over the r2 gravel rectangles.
    polygon('gravel', points, (x, z) => [x, 0.018, z], tint, [0, 1, 0]);
  }
  // A broad worn court connects each bench to its service lane. The west
  // court contains the table; the east remains an uncluttered resting bay.
  const court = [
    [35, 11.1],
    [37.9, 10.9],
    [39.6, 12.4],
    [40, 16.3],
    [39.3, 20.7],
    [37.2, 22],
    [35, 21.3],
  ];
  ground(court, 0.96);
  ground(
    court.map(([x, z], i) => [-x, z + (i > 1 && i < 6 ? 0.6 : 0)]),
    0.98,
  );
  for (const [side, z] of [
    [-1, -2],
    [-1, 12],
    [1, -2],
    [1, 12],
  ]) {
    // Four broad aprons meet the closed serving face without covering the
    // open central lawn or the outer six-metre service lane.
    ground(
      [
        [side * 18.15, z - 3.25],
        [side * 15.1, z - 3.5],
        [side * 12.6, z - 1.6],
        [side * 12.85, z + 1.85],
        [side * 15.3, z + 3.8],
        [side * 18.15, z + 3.25],
      ],
      z < 0 ? 0.96 : 1,
    );
  }

  // The long table belongs to the existing west bench. Its underside remains
  // physically open between the two panel legs; no single enclosing collider.
  const parts = [
    ['top', [-36.35, 0.78, 13.75], [-35.05, 0.91, 18.25]],
    ['leg-a', [-36.17, 0, 14.35], [-35.23, 0.78, 14.51]],
    ['leg-b', [-36.17, 0, 17.49], [-35.23, 0.78, 17.65]],
  ];
  for (const [name, min, max] of parts) {
    solid('picnic-west-' + name, min, max);
  }
  // Canonical solids draw the continuous top and metal panel supports. Only
  // its attached wooden upper finish is imported; do not duplicate box faces.
  polygon(
    'timber',
    [
      [-36.35, 13.75],
      [-36.35, 18.25],
      [-35.05, 18.25],
      [-35.05, 13.75],
    ],
    (x, z) => [x, 0.915, z],
    1,
    [0, 1, 0],
  );
  // Narrow surface seams and a runner establish human scale. These are paint,
  // not gaps through the one continuous solid tabletop.
  const top = (points, role) => polygon(role, points, (x, z) => [x, 0.917, z], 1, [0, 1, 0]);
  for (const x of [-36.03, -35.7, -35.37])
    top(
      [
        [x - 0.006, 13.76],
        [x - 0.006, 18.24],
        [x + 0.006, 18.24],
        [x + 0.006, 13.76],
      ],
      'dark',
    );
  // Runner stays between the plank seams: no coplanar decorative overlap.
  for (const [start, end, role] of [
    [13.78, 14.03, 'blue'],
    [14.03, 14.15, 'ochre'],
    [14.15, 17.8, 'blue'],
    [17.8, 17.92, 'ochre'],
    [17.92, 18.22, 'blue'],
  ])
    top(
      [
        [-35.98, start],
        [-35.98, end],
        [-35.75, end],
        [-35.75, start],
      ],
      role,
    );

  // Large original event rosettes and arrows on existing closed wall bays.
  // No new sign support or apparent opening: all marks lie on opaque panels.
  for (const [x, z] of [
    [-22, -2],
    [-22, 12],
    [22, -2],
    [22, 12],
  ]) {
    const face = (u, v) => [x + u, v, z + 2.849];
    const cx = -1.75,
      cy = 1.75;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const point = (angle, radius) => [
        cx + Math.sin(angle) * radius,
        cy + Math.cos(angle) * radius,
      ];
      polygon(
        i % 2 ? 'ochre' : 'blue',
        [point(a - 0.2, 0.2), point(a, 0.67), point(a + 0.2, 0.2)],
        face,
      );
    }
    polygon(
      'chalk',
      [
        [cx - 0.14, cy],
        [cx, cy - 0.14],
        [cx + 0.14, cy],
        [cx, cy + 0.14],
      ],
      face,
    );
    const sign = -Math.sign(x);
    polygon(
      'blue',
      [
        [-0.68, -0.1],
        [0.22, -0.1],
        [0.22, -0.32],
        [0.7, 0],
        [0.22, 0.32],
        [0.22, 0.1],
        [-0.68, 0.1],
      ].map(([u, v]) => [1.75 + sign * u, 1.7 + v]),
      face,
    );
    polygon(
      'ochre',
      [
        [0.95, 1.06],
        [2.55, 1.06],
        [2.55, 1.16],
        [0.95, 1.16],
      ],
      face,
    );
  }
}
