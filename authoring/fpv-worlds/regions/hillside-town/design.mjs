/** Original stepped town layout, not a reconstruction of another simulator map. */
export const sizeM = 384;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function heightMm(x, z) {
  // Flat inhabited terraces connected by graded lanes; exact shared samples at cell seams.
  const h = 12 * clamp((z - 112) / 32, 0, 1) + 12 * clamp((z - 240) / 32, 0, 1);
  return Math.round(h * 1000);
}
export const placements = [];
const put = (id, asset, x, y, z, scale = 2.5, yaw = 0) =>
  placements.push({ id: id.replaceAll('.', 'p'), asset, x, y, z, scale, yaw });
const houses = [];
for (let row = 0; row < 3; row++)
  for (let col = 0; col < 3; col++) {
    const y = row * 12;
    for (const [n, dx, dz] of [
      ['court', 48, 48],
      ['street', 90, 82],
    ]) {
      const x = col * 128 + dx,
        z = row * 128 + dz,
        id = `terrace-${row}-${col}-${n}`;
      houses.push({ id, x, y, z });
      put(id + '-front', 'wall-doorway-wide-square.glb', x - 5, y, z);
      put(id + '-back', 'wall-doorway-wide-square.glb', x + 5, y, z, 2.5, Math.PI);
      for (const dz of [-5, 5])
        for (const dx of [-2.5, 2.5])
          put(id + `-side-${dx}-${dz}`, 'wall.glb', x + dx, y, z + dz, 2.5, Math.PI / 2);
      put(id + '-roof', 'roof-flat-square.glb', x, y + 6, z, 4.2);
      put(id + '-floor', 'floor.glb', x, y, z, 5);
    }
  }
export { houses };
// Original platforms and retaining edges use solid geometry; openings are authored gaps.
export function architecture() {
  const boxes = [];
  const box = (id, center, size, color) => boxes.push({ id, center, size, color });
  for (let row = 0; row < 3; row++) {
    const z = 64 + row * 128,
      y = row * 12;
    for (const x of [24, 360])
      box(`retaining-${row}-${x}`, [x, y - 2, z + 40], [3, 4, 48], [0.44, 0.43, 0.39]);
  }
  box('elevated-pad', [320, 30, 288], [16, 0.6, 16], [0.68, 0.64, 0.49]);
  for (const x of [313, 327])
    for (const z of [281, 295])
      box(`pad-column-${x}-${z}`, [x, 27, z], [0.8, 6, 0.8], [0.44, 0.43, 0.39]);
  // Edge rails stop short of the landing approach, retaining a 10 m clear southern opening.
  for (const x of [312, 328])
    box(`pad-edge-${x}`, [x, 30.8, 288], [0.3, 1, 16], [0.72, 0.68, 0.54]);
  return boxes;
}
// Road tops follow the exact terrain lattice and every slope breakpoint.
// Uniform 100 mm surfacing avoids steps at intersections and cell boundaries.
export const roadTopMm = 100;
export const roads = [
  ...[0, 1, 2].flatMap((row) => [
    {
      id: `terrace-${row}-cross-street`,
      min: [8, 58 + row * 128],
      max: [376, 70 + row * 128],
      color: [0.37, 0.35, 0.31],
    },
    {
      id: `terrace-${row}-courtyard`,
      min: [173, 85 + row * 128],
      max: [211, 115 + row * 128],
      color: [0.58, 0.54, 0.44],
    },
  ]),
  ...[128, 256].map((x) => ({
    id: `graded-street-${x}`,
    min: [x - 6, 4],
    max: [x + 6, 372],
    color: [0.37, 0.35, 0.31],
  })),
];

export const spawns = [
  { id: 'lower-square', position: { x: 128000, y: 3000, z: 64000 } },
  { id: 'middle-courtyard', position: { x: 192000, y: 15000, z: 228000 } },
  { id: 'upper-terrace', position: { x: 256000, y: 27000, z: 320000 } },
  { id: 'elevated-pad', position: { x: 320000, y: 31500, z: 288000 } },
];
export const routes = [
  {
    id: 'lower-main-street',
    halfWidth: 4,
    points: [
      [20, 4, 64],
      [192, 4, 64],
      [360, 4, 64],
    ],
  },
  {
    id: 'graded-ascent',
    halfWidth: 4,
    points: [
      [128, 5, 96],
      [128, 5, 112],
      [128, 17, 144],
      [128, 17, 240],
      [128, 29, 272],
      [128, 29, 348],
    ],
  },
  {
    id: 'courtyard-turn',
    halfWidth: 4,
    points: [
      [160, 16, 192],
      [192, 16, 192],
      [192, 16, 228],
      [222, 16, 228],
    ],
  },
  {
    id: 'upper-switchback',
    halfWidth: 4,
    points: [
      [256, 29, 280],
      [256, 29, 320],
      [328, 29, 320],
      [328, 29, 350],
      [280, 29, 350],
    ],
  },
  {
    id: 'house-open-pass',
    halfWidth: 1.2,
    points: [
      [35, 3, 48],
      [61, 3, 48],
    ],
  },
  {
    id: 'pad-approach',
    halfWidth: 2,
    points: [
      [320, 33, 268],
      [320, 33, 288],
    ],
  },
  {
    id: 'under-pad',
    halfWidth: 2,
    points: [
      [320, 27, 268],
      [320, 27, 308],
    ],
  },
];
export const probes = [
  { id: 'house-open-door', from: [35, 3, 48], to: [61, 3, 48], clear: true },
  { id: 'house-solid-side', from: [48, 3, 40], to: [48, 3, 56], clear: false },
  { id: 'house-solid-roof', from: [48, 10, 48], to: [48, 2, 48], clear: false },
  { id: 'courtyard-clear', from: [176, 16, 218], to: [208, 16, 228], clear: true },
  { id: 'pad-solid', from: [320, 36, 288], to: [320, 26, 288], clear: false },
  { id: 'under-pad-clear', from: [320, 27, 268], to: [320, 27, 308], clear: true },
  { id: 'graded-road-clear', from: [128, 5, 112], to: [128, 17, 144], clear: true },
];
