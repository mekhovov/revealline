/** Original six-district composition. Wide cells retain an 8 m terrain sampling step. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
const hill = (x, z, cx, cz, radius, height) =>
  height * (1 - smooth(Math.hypot(x - cx, z - cz) / radius));
export const region = {
  id: 'tropical-coastal-districts',
  revision: 'districts-r1',
  cellSizeMm: 256000,
  title: {
    en: 'Tropical coast — six flight districts',
    uk: 'Тропічне узбережжя — шість районів польоту',
  },
  scope:
    'Bounded 768 m six-district source candidate; not a large archipelago or default player admission',
};
export const foundations = [
  { x: 96, z: 150, radius: 24, height: -3 },
  { x: 175, z: 147, radius: 22, height: -3 },
  { x: 350, z: 145, radius: 22, height: -1.5 },
  { x: 430, z: 165, radius: 22, height: -1.5 },
  { x: 100, z: 350, radius: 80, height: 5 },
  { x: 380, z: 365, radius: 76, height: 14 },
  { x: 630, z: 355, radius: 65, height: 24 },
  { x: 380, z: 650, radius: 56, height: 14 },
];
export function coastalHeightMm(x, z) {
  const shore = 155 + 24 * Math.sin(x / 80) + 9 * Math.sin(x / 37);
  const inland = z - shore;
  let y = inland < 0 ? -6 * smooth(-inland / 55) : 3 * smooth(inland / 45);
  y += hill(x, z, 183, 214, 55, 11); // Harbour headland.
  y += hill(x, z, 446, 130, 42, 5); // Lagoon sandbar.
  y += hill(x, z, 687, 226, 110, 23); // Reef bluff.
  y += smooth((inland - 60) / 120) * (5 + 3 * Math.sin(x / 60) * Math.sin(z / 70));
  y += hill(x, z, 380, 365, 130, 10);
  y += hill(x, z, 650, 360, 150, 22);
  y += hill(x, z, 660, 650, 150, 32);
  y += hill(x, z, 65, 600, 76, 17) + hill(x, z, 195, 595, 76, 21); // Distinct dune pass.
  for (const p of foundations)
    y += (p.height - y) * (1 - smooth((Math.hypot(x - p.x, z - p.z) - p.radius) / 16));
  return Math.round(y * 1000);
}
const placed = (id, asset, x, z, scale = 1, yaw = 0, y = coastalHeightMm(x, z) / 1000) => ({
  id,
  asset,
  x,
  z,
  scale,
  yaw,
  y,
});
export const placements = [
  placed('harbour-covered-pier', 'covered-jetty', 96, 150, 1, 0, -3),
  placed('harbour-return-pier', 'covered-jetty', 175, 147, 1, Math.PI / 2, -3),
  placed('lagoon-open-pier', 'open-jetty', 350, 145, 1, 0, -1.5),
  placed('lagoon-turning-pier', 'open-jetty', 430, 165, 1, Math.PI / 2, -1.5),
  ...[
    [400, 205, 1.3],
    [460, 210, 1.6],
    [610, 170, 1.8],
    [650, 182, 2.2],
    [700, 160, 1.5],
    [70, 590, 1.2],
    [195, 600, 1.4],
  ].map(([x, z, s], i) => placed('landmark-rock-' + i, 'beach-rock', x, z, s, i * 0.7)),
  ...[
    [70, 330],
    [100, 365],
    [130, 335],
    [165, 380],
  ].map(([x, z], i) => placed('valley-palm-' + i, 'palm', x, z, 1, i * 0.6, 5)),
  placed('stilt-hut-west', 'jungle-hut', 350, 355, 1, 0, 14),
  placed('stilt-hut-east', 'jungle-hut', 415, 390, 1, Math.PI, 14),
  ...[
    [595, 330],
    [620, 365],
    [650, 340],
    [675, 380],
    [610, 610],
    [650, 650],
    [690, 620],
  ].map(([x, z], i) => placed('ridge-bamboo-' + i, 'young-bamboo', x, z, 1.5, i * 0.8)),
  ...Array.from({ length: 12 }, (_, i) =>
    placed(
      'dune-grass-' + i,
      'beach-grass',
      35 + (i % 4) * 58,
      540 + Math.floor(i / 4) * 65,
      3,
      i * 0.9,
    ),
  ),
  ...[
    [360, 650],
    [380, 665],
    [400, 650],
  ].map(([x, z], i) => placed('village-cargo-' + i, 'crate', x, z, 1.4, (i * Math.PI) / 2, 14)),
];
export const districts = [
  {
    id: 'harbour',
    title: 'Covered harbour and headland',
    cells: [[0, 0]],
    landmarks: ['covered-harbour', 'harbour-headland'],
  },
  {
    id: 'lagoon',
    title: 'Lagoon piers and sandbar',
    cells: [[1, 0]],
    landmarks: ['lagoon-piers', 'lagoon-sandbar'],
  },
  {
    id: 'reef',
    title: 'Rock reef and coastal bluff',
    cells: [[2, 0]],
    landmarks: ['reef-rocks', 'reef-bluff'],
  },
  {
    id: 'valley',
    title: 'Palm valley and dune pass',
    cells: [
      [0, 1],
      [0, 2],
    ],
    landmarks: ['palm-valley', 'dune-pass'],
  },
  {
    id: 'village',
    title: 'Hillside huts and cargo square',
    cells: [
      [1, 1],
      [1, 2],
    ],
    landmarks: ['hillside-huts', 'cargo-square'],
  },
  {
    id: 'ridge',
    title: 'Bamboo grove and ridge overlook',
    cells: [
      [2, 1],
      [2, 2],
    ],
    landmarks: ['bamboo-grove', 'ridge-overlook'],
  },
];
export const landmarks = [
  ['covered-harbour', 96, 150],
  ['harbour-headland', 183, 214],
  ['lagoon-piers', 350, 145],
  ['lagoon-sandbar', 446, 130],
  ['reef-rocks', 650, 182],
  ['reef-bluff', 687, 226],
  ['palm-valley', 100, 350],
  ['dune-pass', 130, 600],
  ['hillside-huts', 380, 365],
  ['cargo-square', 380, 650],
  ['bamboo-grove', 630, 355],
  ['ridge-overlook', 660, 650],
].map(([id, x, z]) => ({
  id,
  position: { x: x * 1000, y: coastalHeightMm(x, z) + 16000, z: z * 1000 },
}));
export const startingPoints = landmarks
  .filter((_, i) => i % 2 === 0)
  .map((p) => ({ id: p.id, position: p.position }));
export const flightRoutes = [
  {
    id: 'shoreline-crossings',
    points: [
      [40, 36, 232],
      [220, 36, 232],
      [400, 36, 232],
      [580, 36, 232],
      [730, 36, 232],
    ],
    halfWidth: 2,
  },
  {
    id: 'covered-harbour-bay',
    points: [
      [81, 4.4, 150],
      [111, 4.4, 150],
    ],
    halfWidth: 1,
  },
  {
    id: 'under-harbour-pier',
    points: [
      [81, 0.7, 150],
      [111, 0.7, 150],
    ],
    halfWidth: 0.8,
  },
  {
    id: 'harbour-headland-contour',
    points: [
      [150, 20, 203],
      [183, 24, 214],
      [215, 20, 210],
    ],
    halfWidth: 2,
  },
  {
    id: 'lagoon-pier-approach',
    points: [
      [325, 10, 145],
      [375, 10, 145],
      [405, 10, 155],
      [450, 10, 175],
    ],
    halfWidth: 2,
  },
  {
    id: 'reef-bluff-traverse',
    points: [
      [585, 34, 220],
      [640, 40, 240],
      [700, 40, 240],
      [735, 32, 210],
    ],
    halfWidth: 2,
  },
  {
    id: 'palm-valley-slalom',
    points: [
      [55, 12, 330],
      [70, 12, 321],
      [100, 12, 355],
      [130, 12, 325],
      [178, 12, 385],
    ],
    halfWidth: 2,
  },
  {
    id: 'dune-pass',
    points: [
      [130, 26, 530],
      [130, 26, 600],
      [130, 26, 680],
    ],
    halfWidth: 2,
  },
  {
    id: 'hillside-village-street',
    points: [
      [380, 20, 315],
      [380, 20, 365],
      [385, 20, 420],
    ],
    halfWidth: 2,
  },
  {
    id: 'cargo-square-braking',
    points: [
      [349, 16, 665],
      [373, 16, 672],
      [402, 16, 672],
      [416, 16, 650],
    ],
    halfWidth: 1.5,
  },
  {
    id: 'bamboo-grove-corridor',
    points: [
      [580, 33, 350],
      [610, 33, 340],
      [640, 33, 360],
      [690, 33, 355],
    ],
    halfWidth: 2,
  },
  {
    id: 'ridge-overlook',
    points: [
      [590, 44, 580],
      [620, 50, 615],
      [660, 53, 675],
      [710, 44, 690],
    ],
    halfWidth: 2,
  },
];
export const contactProbes = [
  { id: 'palm-trunk', from: [66, 7.912, 330.5], to: [75, 7.912, 330.5], maxX: 71 },
  { id: 'cargo-box', from: [356, 14.6, 650], to: [364, 14.6, 650], maxX: 360 },
  { id: 'covered-pier-roof', from: [92, 10, 150], falling: true, minY: 5.5 },
];
export const verificationProbes = [
  { id: 'harbour-open-bay', from: [81, 4.4, 150], to: [111, 4.4, 150], clear: true },
  { id: 'harbour-below-deck', from: [81, 0.7, 150], to: [111, 0.7, 150], clear: true },
  { id: 'harbour-roof', from: [92, 12, 150], to: [92, 4, 150], clear: false },
  { id: 'palm-trunk', from: [66, 7.912, 330.5], to: [75, 7.912, 330.5], clear: false },
  { id: 'palm-leaves', from: [68, 16.912, 330], to: [68, 10.912, 330], clear: true },
  { id: 'hut-roof', from: [348, 27, 355], to: [348, 19, 355], clear: false },
  { id: 'cargo-box', from: [356, 14.6, 650], to: [364, 14.6, 650], clear: false },
  { id: 'sea-visual-only', from: [20, 2, 20], to: [20, -2, 20], clear: true },
];
