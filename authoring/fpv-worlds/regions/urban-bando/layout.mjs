/** Original full-size architectural study, in metres. This is not a World.v1 course. */
export const sizeM = 384;
export const boxes = [];
const box = (id, centre, size, material = 'concrete', rotation = null) =>
  boxes.push({ id, centre, size, material, rotation });
box('ground', [192, -0.5, 192], [384, 1, 384], 'ground');
// Open mill: ring-shaped slabs make the central atrium a genuine 28 × 24 m shaft.
for (const y of [0.4, 8, 16, 24]) {
  box(`mill-west-${y}`, [41, y, 64], [18, 0.8, 64]);
  box(`mill-east-${y}`, [87, y, 64], [18, 0.8, 64]);
  box(`mill-north-${y}`, [64, y, 42], [28, 0.8, 20]);
  box(`mill-south-${y}`, [64, y, 86], [28, 0.8, 20]);
}
for (const x of [30, 98])
  for (const z of [30, 64, 98]) box(`mill-column-${x}-${z}`, [x, 13, z], [1.5, 26, 1.5], 'brick');
// Warehouse: opposed 12 m loading openings, a large skylight and high transverse beams.
for (const z of [30, 98]) {
  for (const x of [166, 214]) box(`warehouse-front-${x}-${z}`, [x, 5, z], [36, 10, 1], 'brick');
  box(`warehouse-lintel-${z}`, [190, 10, z], [12, 2, 1]);
}
for (const x of [146, 234]) box(`warehouse-side-${x}`, [x, 6, 64], [1, 12, 68], 'brick');
for (const x of [157, 223]) box(`warehouse-roof-${x}`, [x, 12, 64], [22, 0.8, 68], 'roof');
for (const z of [38, 64, 90]) box(`warehouse-beam-${z}`, [190, 11.2, z], [88, 0.6, 0.6], 'steel');
// Loading yard portal crane: walk/fly through the real space between its supports.
for (const x of [286, 354]) box(`yard-crane-leg-${x}`, [x, 10, 55], [1.2, 20, 1.2], 'steel');
box('yard-crane-crossbeam', [320, 20, 55], [70, 1.2, 1.2], 'steel');
// Parking decks: open side entries and a central 16 × 16 m vertical shaft.
for (const y of [0.4, 6, 12, 18]) {
  for (const x of [39, 89]) box(`parking-side-${x}-${y}`, [x, y, 260], [34, 0.7, 84]);
  for (const z of [235, 285]) box(`parking-end-${z}-${y}`, [64, y, z], [16, 0.7, 34]);
}
for (const x of [24, 104])
  for (const z of [220, 260, 300]) box(`parking-column-${x}-${z}`, [x, 10, z], [1, 20, 1], 'steel');
// Separate sloped access ramp keeps the central shaft unobstructed.
box('parking-ramp', [114, 3.3, 260], [10, 0.6, 37], 'concrete', [-Math.atan(6 / 36), 0, 0]);
// Viaduct: supported deck with genuinely empty underpass, not a bounding-box collider.
box('viaduct-deck', [200, 14, 255], [112, 1.5, 16]);
for (const x of [148, 200, 252]) box(`viaduct-pillar-${x}`, [x, 6.5, 255], [3, 13, 12], 'brick');
for (const z of [247, 263]) box(`viaduct-railing-${z}`, [200, 15.5, z], [112, 1.5, 0.4], 'steel');
// Tower court: low stepped stands for deliberate changes of altitude.
for (let i = 0; i < 3; i++)
  box(`tower-stand-${i}`, [303 + i * 11, 1 + i, 314], [10, 2 + i * 2, 18], 'brick');
export const props = [
  {
    id: 'yard-container-west',
    model: 'shipping-container-a.glb',
    x: 304,
    z: 82,
    width: 12,
    yaw: 0,
  },
  {
    id: 'yard-container-east',
    model: 'shipping-container-b.glb',
    x: 336,
    z: 82,
    width: 12,
    yaw: 0,
  },
  {
    id: 'yard-container-north',
    model: 'shipping-container-a.glb',
    x: 320,
    z: 30,
    width: 12,
    yaw: 90,
  },
  { id: 'tower', model: 'water-tower.glb', x: 320, z: 250, height: 34, yaw: 0 },
  { id: 'service-building', model: 'building-d.glb', x: 350, z: 350, width: 35, yaw: 180 },
];
export const districts = [
  ['open-mill', 'Open Mill', 'Відкритий цех', 64, 64],
  ['loading-hall', 'Loading Hall', 'Вантажний зал', 190, 64],
  ['container-yard', 'Container Yard', 'Контейнерний двір', 320, 64],
  ['parking-decks', 'Parking Decks', 'Паркувальні яруси', 64, 260],
  ['viaduct', 'Viaduct', 'Віадук', 200, 255],
  ['tower-court', 'Tower Court', 'Двір вежі', 320, 270],
].map(([id, en, uk, x, z]) => ({ id, title: { en, uk }, centre: [x, z] }));
export const probes = [
  { id: 'mill-floor-lane', from: [20, 4, 50], to: [108, 4, 50], clear: true },
  { id: 'mill-vertical-atrium', from: [64, 2, 64], to: [64, 32, 64], clear: true },
  { id: 'mill-solid-slab', from: [41, 3, 64], to: [41, 11, 64], clear: false },
  { id: 'warehouse-loading-doors', from: [190, 4, 20], to: [190, 4, 108], clear: true },
  { id: 'warehouse-skylight', from: [190, 3, 50], to: [190, 20, 50], clear: true },
  { id: 'warehouse-side-wall', from: [130, 4, 64], to: [160, 4, 64], clear: false },
  { id: 'yard-crane-gap', from: [320, 10, 40], to: [320, 10, 70], clear: true },
  { id: 'yard-crane-beam', from: [320, 20, 40], to: [320, 20, 70], clear: false },
  { id: 'parking-side-entry', from: [10, 3, 245], to: [118, 3, 245], clear: true },
  { id: 'parking-shaft', from: [64, 2, 260], to: [64, 25, 260], clear: true },
  { id: 'parking-slab', from: [39, 3, 245], to: [39, 9, 245], clear: false },
  { id: 'viaduct-underpass', from: [174, 5, 225], to: [174, 5, 285], clear: true },
  { id: 'viaduct-pillar', from: [200, 5, 225], to: [200, 5, 285], clear: false },
  { id: 'tower-court-approach', from: [320, 5, 165], to: [320, 5, 215], clear: true },
];
export const landmarks = [
  ['mill-atrium', 'Mill atrium', 'Атріум цеху', [64, 12, 64]],
  ['mill-upper-deck', 'Upper mill deck', 'Верхній ярус цеху', [64, 26, 42]],
  ['hall-entrance', 'Loading entrance', 'Вантажний вхід', [190, 4, 30]],
  ['hall-skylight', 'Warehouse skylight', 'Світловий отвір складу', [190, 13, 50]],
  ['yard-crane', 'Portal crane', 'Портальний кран', [320, 10, 55]],
  ['yard-containers', 'Container lane', 'Контейнерний прохід', [320, 4, 82]],
  ['parking-shaft', 'Parking shaft', 'Шахта паркінгу', [64, 10, 260]],
  ['parking-ramp', 'Parking ramp', 'Пандус паркінгу', [114, 4, 260]],
  ['viaduct-underpass', 'Viaduct underpass', 'Прохід під віадуком', [174, 5, 255]],
  ['viaduct-deck', 'Viaduct deck', 'Верх віадука', [200, 16, 255]],
  ['water-tower', 'Water tower', 'Водонапірна вежа', [320, 35, 250]],
  ['service-court', 'Service court', 'Службовий двір', [350, 3, 325]],
].map(([id, en, uk, position]) => ({ id, title: { en, uk }, position }));
