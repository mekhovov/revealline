/** Original connected canal district; metres in authoring, millimetres in published data. */
export const sizeM = 384;
export const revision = 'district-r2';
export const canals = [
  { id: 'main-canal', min: [112, 0], max: [144, 384] },
  { id: 'cross-canal-west', min: [0, 216], max: [112, 248] },
  { id: 'cross-canal-east', min: [144, 216], max: [384, 248] },
  { id: 'turning-basin', min: [256, 248], max: [352, 336] },
];
export const quays = [
  { min: [0, 0], max: [112, 216] },
  { min: [144, 0], max: [384, 216] },
  { min: [0, 248], max: [112, 384] },
  { min: [144, 248], max: [256, 384] },
  { min: [256, 336], max: [384, 384] },
  { min: [352, 248], max: [384, 336] },
];
export const waterAt = (x, z) =>
  canals.some(({ min, max }) => x >= min[0] && x <= max[0] && z >= min[1] && z <= max[1]);
export const heightMm = (x, z) => (waterAt(x, z) ? -3000 : 3900);
export const placements = [];
export const boxes = [];
export const gables = [];
export const arches = [];
const stone = [0.54, 0.49, 0.4],
  brick = [0.51, 0.27, 0.18],
  slate = [0.2, 0.27, 0.3];
const box = (id, center, size, color = stone, surface = 'stone') =>
  boxes.push({ id, center, size, color, surface });
const put = (id, asset, x, y, z, scale, yaw = 0) =>
  placements.push({ id, asset, x, y, z, scale, yaw });
// Model apertures remain real openings. Each house has an unobstructed through passage.
function house(id, x, z, scale, roofRise, tint) {
  const y = 4,
    half = scale * 2;
  put(id + '-entry', 'wall-doorway-wide-square.glb', x - half, y, z, scale);
  put(id + '-exit', 'wall-doorway-wide-square.glb', x + half, y, z, scale, Math.PI);
  for (const dz of [-half, half])
    for (const dx of [-scale, scale])
      put(
        `${id}-wall-${dx}-${dz}`.replaceAll('.', 'p'),
        'wall.glb',
        x + dx,
        y,
        z + dz,
        scale,
        Math.PI / 2,
      );
  gables.push({
    id: id + '-roof',
    center: [x, y + 2.4 * scale, z],
    width: half * 2 + 1,
    depth: half * 2 + 1,
    rise: roofRise,
    color: tint,
  });
}
house('merchant-house', 52, 56, 3, 5, brick);
house('narrow-gable', 84, 96, 2.5, 7, slate);
house('copper-roof', 44, 148, 3.2, 3.5, [0.2, 0.39, 0.34]);
house('warehouse-west', 184, 80, 4.5, 4, [0.33, 0.31, 0.28]);
house('warehouse-east', 224, 80, 4.5, 6, brick);
house('court-north', 200, 272, 3, 4, slate);
house('court-south', 200, 328, 3, 6, brick);
house('west-bend', 56, 304, 3.5, 4, brick);
house('basin-lookout', 304, 368, 2.5, 7, slate);
house('eastern-row', 360, 152, 3, 5, brick);
// North masonry bridge: segmental arch, no invisible rectangular collision proxy.
arches.push({
  id: 'masonry-arch',
  center: [128, 4, 64],
  span: 40,
  rise: 8,
  thickness: 1.2,
  depth: 7,
  color: stone,
});
box('arch-deck', [128, 13.6, 64], [48, 0.8, 8]);
for (const x of [104, 152]) box(`arch-bank-${x}`, [x, 8.6, 64], [8, 9.2, 9]);
for (const z of [60.2, 67.8])
  box(`arch-parapet-${z}`.replace('.', 'p'), [128, 14.8, z], [48, 1.6, 0.35]);
// A much higher slim pedestrian connection makes a distinct vertical flying route.
box('highwalk-deck', [128, 20, 176], [52, 0.65, 5], [0.42, 0.32, 0.19], 'timber');
for (const x of [102, 154]) {
  box(`highwalk-tower-${x}`, [x, 12, 176], [2, 16, 5], [0.24, 0.3, 0.3]);
  box(`highwalk-landing-${x}`, [x, 19.6, 176], [12, 0.6, 12], [0.44, 0.41, 0.32]);
}
for (const z of [173.6, 178.4]) {
  box(`highwalk-rail-${z}`.replace('.', 'p'), [128, 21.1, z], [52, 1.5, 0.2], slate);
  for (const x of [112, 128, 144])
    box(`highwalk-post-${x}-${z}`.replace('.', 'p'), [x, 21.4, z], [0.25, 2, 0.25], slate);
}
// South courtyard is open to the canal and has an elevated return through the upper balcony.
for (const x of [172, 228]) {
  box(`court-wing-${x}`, [x, 9, 300], [8, 10, 28], [0.58, 0.45, 0.3]);
  box(`court-cap-${x}`, [x, 14.7, 300], [10, 1.4, 30], slate);
}
box('court-high-return', [200, 13, 314], [48, 0.8, 5], [0.41, 0.31, 0.2], 'timber');
// Lock-side paired walls frame a low passage without sealing the cross canal.
for (const x of [48, 80]) box(`lock-guide-${x}`, [x, 1, 232], [2, 8, 22], stone);
box('lock-footbridge', [64, 8.5, 232], [36, 0.8, 4], slate);
for (const x of [48, 80]) {
  box(`lock-deck-support-${x}`, [x, 6.55, 232], [2, 3.1, 4], stone);
  box(`lock-support-cap-${x}`, [x, 8, 232], [3, 0.2, 4.5], stone);
}
for (const z of [230.1, 233.9])
  box(`lock-rail-${z}`.replace('.', 'p'), [64, 9.5, z], [36, 1.2, 0.25], slate);
// Basin dock and three unequal mooring landmarks leave a 12 m clear navigation line.
for (const x of [262, 290])
  for (const z of [268, 276])
    box(`dock-pile-${x}-${z}`, [x, 0.5, z], [0.7, 7, 0.7], [0.3, 0.25, 0.19]);
box('basin-dock', [276, 4.1, 272], [36, 0.4, 10], [0.43, 0.32, 0.21], 'timber');
for (const [id, x, z, height] of [
  ['near', 280, 300, 7],
  ['middle', 320, 276, 10],
  ['far', 332, 320, 6],
])
  box(`basin-mooring-${id}`, [x, height / 2 - 3, z], [2, height, 2], [0.26, 0.3, 0.29]);
// Clear low furniture and facade rhythm; no decoration crosses a declared route.
for (const z of [24, 112, 200, 272, 352])
  for (const x of [108, 148])
    box(`quay-bollard-${x}-${z}`, [x, 4.6, z], [0.8, 1.2, 0.8], [0.25, 0.29, 0.3]);
// Continuous copings sit on the quay, with paved circulation bands behind them.
// Only edges adjacent to water get these details; route apertures stay unchanged.
for (const [index, q] of quays.entries()) {
  for (const [axis, edge, inward] of [
    [0, q.min[0], 1],
    [0, q.max[0], -1],
    [1, q.min[1], 1],
    [1, q.max[1], -1],
  ]) {
    const other = 1 - axis;
    const mid = (q.min[other] + q.max[other]) / 2;
    const test = axis === 0 ? [edge - inward, mid] : [mid, edge - inward];
    if (!waterAt(...test)) continue;
    const length = q.max[other] - q.min[other];
    const point = (offset, y) =>
      axis === 0 ? [edge + inward * offset, y, mid] : [mid, y, edge + inward * offset];
    const size = (width, height) =>
      axis === 0 ? [width, height, length] : [length, height, width];
    box(
      `quay-coping-${index}-${axis}-${inward}`,
      point(0.25, 4.15),
      size(0.6, 0.3),
      [0.67, 0.65, 0.58],
      'stone',
    );
    box(
      `quay-paving-${index}-${axis}-${inward}`,
      point(3.1, 4.025),
      size(5, 0.05),
      [0.54, 0.55, 0.53],
      'paving',
    );
  }
}
// Public yards contrast with circulation stone, rather than leaving one tan plane.
for (const [id, x, z, width, depth] of [
  ['warehouse-apron', 202, 80, 108, 42],
  ['merchant-square', 60, 116, 76, 132],
  ['courtyard-paving', 200, 300, 48, 48],
  ['west-bend-square', 56, 304, 72, 76],
])
  box(id, [x, 4.025, z], [width, 0.05, depth], [0.47, 0.42, 0.36], 'paving');
// Original facade details are grounded corner piers and top lintels, outside door gaps.
for (const [id, x, z, scale] of [
  ['warehouse-west', 184, 80, 4.5],
  ['warehouse-east', 224, 80, 4.5],
  ['merchant-house', 52, 56, 3],
  ['west-bend', 56, 304, 3.5],
]) {
  const half = scale * 2,
    wallHeight = scale * 2.4;
  for (const dx of [-half, half]) {
    for (const dz of [-half, half])
      box(
        `${id}-corner-${dx}-${dz}`.replaceAll('.', 'p'),
        [x + dx, 4 + wallHeight / 2, z + dz],
        [0.65, wallHeight, 0.65],
        [0.64, 0.59, 0.49],
        'stone',
      );
    box(
      `${id}-lintel-${dx}`.replaceAll('.', 'p'),
      [x + dx, 4 + wallHeight - 0.1, z],
      [0.7, 0.55, half * 2 + 0.65],
      [0.57, 0.4, 0.28],
      'brick',
    );
  }
  for (const dz of [-half, half])
    box(
      `${id}-plinth-${dz}`.replaceAll('.', 'p'),
      [x, 4.35, z + dz],
      [half * 2, 0.7, 0.55],
      [0.49, 0.48, 0.44],
      'stone',
    );
}
export const spawns = [
  { id: 'north-arch', position: { x: 128000, y: 3000, z: 24000 } },
  { id: 'warehouse-passage', position: { x: 156000, y: 7000, z: 80000 } },
  { id: 'highwalk', position: { x: 128000, y: 9000, z: 144000 } },
  { id: 'lock-bend', position: { x: 64000, y: 3000, z: 220000 } },
  { id: 'courtyard', position: { x: 200000, y: 7000, z: 288000 } },
  { id: 'turning-basin', position: { x: 304000, y: 3000, z: 304000 } },
];
export const routes = [
  {
    id: 'arch-canal',
    halfWidth: 3,
    points: [
      [128, 3, 12],
      [128, 3, 64],
      [128, 3, 112],
    ],
  },
  {
    id: 'warehouse-through',
    halfWidth: 0.8,
    points: [
      [156, 7, 80],
      [184, 7, 80],
      [224, 7, 80],
      [250, 7, 80],
    ],
  },
  {
    id: 'highwalk-under',
    halfWidth: 3,
    points: [
      [128, 9, 136],
      [128, 9, 176],
      [128, 9, 208],
    ],
  },
  {
    id: 'lock-through',
    halfWidth: 2,
    points: [
      [64, 3, 218],
      [64, 3, 232],
      [64, 3, 246],
    ],
  },
  {
    id: 'courtyard-return',
    halfWidth: 2,
    points: [
      [200, 7, 288],
      [200, 7, 302],
      [200, 7, 320],
    ],
  },
  {
    id: 'basin-slalom',
    halfWidth: 3,
    points: [
      [304, 3, 248],
      [304, 3, 284],
      [296, 3, 308],
      [312, 3, 326],
    ],
  },
];
