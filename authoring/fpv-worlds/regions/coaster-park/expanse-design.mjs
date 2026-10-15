/** Original connected park composition. Metres except explicitly named millimetres. */
export const EXTENT_M = 2048;
export const CELL_M = 256;
export const GRID = EXTENT_M / CELL_M;
export const districts = [
  {
    id: "arrival-gardens",
    center: [384, 384],
    role: "Entrance, ticket plaza and station approaches",
  },
  {
    id: "loop-meadow",
    center: [1152, 384],
    role: "Loop landmark, open practice meadow and parallel gantries",
  },
  {
    id: "ridge-station",
    center: [1664, 640],
    role: "Station terrace and elevated viewing frames",
  },
  {
    id: "service-courts",
    center: [1408, 1408],
    role: "Service hall, narrow courts and canopy passes",
  },
  {
    id: "woodland-promenade",
    center: [640, 1664],
    role: "Tree rows, picnic plazas and slalom opportunities",
  },
  {
    id: "river-gardens",
    center: [384, 1152],
    role: "Low boardwalk, bridge frames and broad garden turns",
  },
];
const route = (id, from, to, halfWidth = 3) => ({
  id,
  from: [from[0], 14, from[1]],
  to: [to[0], 14, to[1]],
  halfWidth,
});
export const routes = districts.flatMap(({ id, center: [x, z] }) => [
  route(`${id}-cross-plaza`, [x - 90, z], [x + 90, z]),
  route(`${id}-cross-garden`, [x, z - 90], [x, z + 90]),
]);
for (let i = 0; i < districts.length; i++) {
  const a = districts[i].center,
    b = districts[(i + 1) % districts.length].center;
  if (a[0] !== b[0])
    routes.push(route(`link-${i}-east-west`, a, [b[0], a[1]], 5));
  if (a[1] !== b[1])
    routes.push(route(`link-${i}-north-south`, [b[0], a[1]], b, 5));
}
export const acceptedModels = [
  "park-entrance.glb",
  "station.glb",
  "stall-food.glb",
  "stall-drinks.glb",
  "coaster-steel-looping.glb",
  "coaster-steel-straight.glb",
  "tree-large.glb",
  "support-large.glb",
];
export const placements = [];
for (const [
  index,
  {
    id,
    center: [x, z],
  },
] of districts.entries()) {
  const featureModels = [
    [
      "park-entrance.glb",
      "station.glb",
      "stall-food.glb",
      "stall-drinks.glb",
      "coaster-steel-looping.glb",
    ],
    [
      "support-large.glb",
      "station.glb",
      "tree-large.glb",
      "tree-large.glb",
      "coaster-steel-looping.glb",
    ],
    [
      "station.glb",
      "support-large.glb",
      "stall-food.glb",
      "tree-large.glb",
      "coaster-steel-straight.glb",
    ],
    [
      "station.glb",
      "station.glb",
      "stall-drinks.glb",
      "support-large.glb",
      "coaster-steel-straight.glb",
    ],
    [
      "tree-large.glb",
      "tree-large.glb",
      "tree-large.glb",
      "tree-large.glb",
      "tree-large.glb",
    ],
    [
      "park-entrance.glb",
      "tree-large.glb",
      "tree-large.glb",
      "stall-drinks.glb",
      "coaster-steel-straight.glb",
    ],
  ][index];
  placements.push(
    {
      id: `${id}-north-west-feature`,
      model: featureModels[0],
      x: x - 64,
      z: z - 64,
    },
    {
      id: `${id}-north-east-feature`,
      model: featureModels[1],
      x: x + 48,
      z: z - 64,
    },
    {
      id: `${id}-south-west-feature`,
      model: featureModels[2],
      x: x - 64,
      z: z + 64,
    },
    {
      id: `${id}-south-east-feature`,
      model: featureModels[3],
      x: x + 48,
      z: z + 64,
    },
    // A separate cell keeps each detailed looping model inside the existing decode budget.
    {
      id: `${id}-outer-feature`,
      model: featureModels[4],
      x: x + 256,
      z: z + 64,
    },
    {
      id: `${id}-track`,
      model: "coaster-steel-straight.glb",
      x: x + 48,
      z: z + 320,
    },
    { id: `${id}-support`, model: "support-large.glb", x: x - 64, z: z + 320 },
  );
  for (let n = 0; n < 4; n++)
    placements.push({
      id: `${id}-tree-${n}`,
      model: "tree-large.glb",
      x: x - 64 + (n % 2) * 112,
      z: z + 256 + Math.floor(n / 2) * 96,
    });
}
// Small separated groves create optional detours around the connected park,
// with full-size gaps between the original tree meshes and explicit cell ownership.
for (const [gx, gz] of [
  [0, 0],
  [3, 0],
  [6, 0],
  [7, 3],
  [6, 7],
  [3, 7],
  [0, 6],
  [0, 3],
])
  for (const [index, [dx, dz]] of [
    [-40, -40],
    [40, -40],
    [-40, 40],
    [40, 40],
  ].entries())
    placements.push({
      id: `grove-${gx}-${gz}-${index}`,
      model: "tree-large.glb",
      x: gx * CELL_M + 128 + dx,
      z: gz * CELL_M + 128 + dz,
    });
const distanceSegment = (x, z, a, b) => {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)),
    );
  return Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz);
};
export function heightMm(x, z) {
  const hills =
    12 +
    9 * Math.sin(x / 230) * Math.sin(z / 310) +
    7 * Math.sin((x + z) / 510);
  let distance = Infinity;
  for (const r of routes)
    distance = Math.min(distance, distanceSegment(x, z, r.from, r.to));
  for (const p of placements)
    distance = Math.min(
      distance,
      Math.max(0, Math.hypot(x - p.x, z - p.z) - 30),
    );
  for (const d of districts)
    distance = Math.min(
      distance,
      Math.max(0, Math.hypot(x - d.center[0], z - d.center[1]) - 125),
    );
  const t = Math.max(0, Math.min(1, (distance - 20) / 70));
  return Math.round((8 + Math.max(0, hills) * t * t * (3 - 2 * t)) * 1000);
}
export function surfaceMm(x, z) {
  const sx = Math.floor(x / 8) * 8,
    sz = Math.floor(z / 8) * 8,
    u = (x - sx) / 8,
    v = (z - sz) / 8,
    a = heightMm(sx, sz),
    b = heightMm(sx + 8, sz),
    c = heightMm(sx, sz + 8),
    d = heightMm(sx + 8, sz + 8);
  return u + v <= 1
    ? a + (b - a) * u + (c - a) * v
    : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
export const spawns = districts.map(({ id, center: [x, z] }) => ({
  id,
  position: { x: x * 1000, y: 11000, z: z * 1000 },
}));
export function architecture() {
  const result = [];
  const add = (id, center, size, color) =>
    result.push({ id, center, size, color });
  for (const [
    index,
    {
      id,
      center: [x, z],
    },
  ] of districts.entries()) {
    const color = [
      [0.15, 0.55, 0.62],
      [0.83, 0.38, 0.2],
      [0.75, 0.68, 0.38],
    ][index % 3];
    // Actual fly-through openings: 18 m clear width, 16 m clear height above the park floor.
    for (const side of [-1, 1])
      add(
        `${id}-gate-post-${side}`,
        [x + side * 10, 16, z + 45],
        [2, 16, 2],
        color,
      );
    add(`${id}-gate-crown`, [x, 25, z + 45], [22, 2, 2], color);
    // Edge landmarks keep both central axes and continuous connecting corridors open.
    add(
      `${id}-viewing-wall`,
      [x - 100, 13, z - 60],
      [4, 10, 46],
      [0.48, 0.39, 0.28],
    );
    add(
      `${id}-canopy`,
      [x + 70, 23, z + 70],
      [34, 1.5, 24],
      [0.88, 0.82, 0.62],
    );
    for (const dx of [-15, 15])
      for (const dz of [-10, 10])
        add(
          `${id}-canopy-post-${dx}-${dz}`,
          [x + 70 + dx, 15.5, z + 70 + dz],
          [1.3, 15, 1.3],
          color,
        );
    // Original boardwalk margins provide scale and low routes without blocking the marked flight line.
    for (const side of [-1, 1])
      add(
        `${id}-boardwalk-${side}`,
        [x + side * 22, 8.5, z],
        [14, 1, 130],
        [0.54, 0.4, 0.26],
      );
    if (index === 0)
      for (const offset of [-90, -60, -30]) {
        for (const side of [-1, 1])
          add(
            `${id}-arcade-${offset}-${side}`,
            [x + side * 24, 14, z + offset],
            [2, 12, 2],
            color,
          );
        add(
          `${id}-arcade-top-${offset}`,
          [x, 21, z + offset],
          [50, 2, 2],
          [0.9, 0.84, 0.65],
        );
      }
    if (index === 1)
      for (const side of [-1, 1]) {
        add(
          `${id}-meadow-tower-${side}`,
          [x + side * 70, 22, z + 100],
          [4, 28, 4],
          color,
        );
        add(
          `${id}-meadow-span-${side}`,
          [x + side * 70, 37, z + 100],
          [44, 2, 5],
          [0.73, 0.58, 0.35],
        );
      }
    if (index === 2)
      for (let step = 0; step < 4; step++)
        add(
          `${id}-viewing-terrace-${step}`,
          [x + 70, 9 + step, z - 100 + step * 10],
          [50, 2 + step * 2, 10],
          [0.68, 0.65, 0.55],
        );
    if (index === 3)
      for (const side of [-1, 1]) {
        for (const wall of [-1, 1])
          add(
            `${id}-hall-${side}-wall-${wall}`,
            [x + side * 65 + wall * 18, 18, z - 60],
            [2, 20, 72],
            [0.52, 0.6, 0.61],
          );
        add(
          `${id}-hall-${side}-roof`,
          [x + side * 65, 28.5, z - 60],
          [40, 1, 72],
          color,
        );
      }
    if (index === 4)
      for (let n = 0; n < 7; n++)
        add(
          `${id}-garden-bench-${n}`,
          [x - 80 + n * 24, 9.5, z + 105],
          [12, 3, 4],
          [0.47, 0.35, 0.22],
        );
    if (index === 5) {
      add(
        `${id}-garden-bridge`,
        [x, 21, z - 70],
        [74, 2, 12],
        [0.57, 0.42, 0.25],
      );
      for (const side of [-1, 1])
        add(
          `${id}-bridge-pier-${side}`,
          [x + side * 33, 14, z - 70],
          [4, 12, 12],
          [0.55, 0.54, 0.46],
        );
    }
  }
  return result;
}
export const landmarks = districts.map(({ id, center }) => ({
  id: `${id}-outer-landmark`,
  position: [center[0] + 256, 8, center[1] + 64],
}));
export const solidProbes = districts.map(({ id, center: [x, z] }) => ({
  id: `${id}-wall-solid`,
  from: [x - 110, 13, z - 60],
  to: [x - 90, 13, z - 60],
}));
