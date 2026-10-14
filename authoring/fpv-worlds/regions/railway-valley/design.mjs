/** Original bounded Railway composition; metres here, millimetres in compiled sources. */
const smooth = (lo, hi, value) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
export const sizeM = 384;
export function heightMm(x, z) {
  let height =
    2 +
    22 * Math.exp(-(((x - 65) / 65) ** 2 + ((z - 60) / 65) ** 2)) +
    10 * Math.exp(-(((x - 330) / 75) ** 2 + ((z - 315) / 65) ** 2));
  const valley = smooth(108, 150, z) * (1 - smooth(202, 244, z));
  height = height * (1 - valley) - 8 * valley;
  const yardX = smooth(120, 140, x) * (1 - smooth(344, 368, x));
  const north = smooth(12, 28, z) * (1 - smooth(112, 132, z));
  const south = smooth(244, 264, z) * (1 - smooth(344, 368, z));
  const bank =
    (1 - smooth(10, 22, Math.abs(x - 192))) * (1 - smooth(108, 128, z) + smooth(224, 244, z));
  const plateau = Math.max(yardX * Math.max(north, south), bank);
  height = height * (1 - plateau) + 14 * plateau;
  return Math.round(height * 1000);
}

const colors = {
  concrete: [0.52, 0.5, 0.43],
  steel: [0.18, 0.25, 0.29],
  timber: [0.34, 0.19, 0.09],
  pale: [0.68, 0.68, 0.59],
  brick: [0.46, 0.25, 0.15],
  amber: [0.72, 0.43, 0.1],
  blue: [0.13, 0.37, 0.49],
};
export function architecture() {
  const boxes = [];
  const box = (id, material, center, size) =>
    boxes.push({ id, color: colors[material], center, size });
  // Deck and rail approaches stay readable above the broad terrain cutting.
  box('main-deck', 'concrete', [192, 14.3, 192], [12, 0.6, 336]);
  for (const x of [190.8, 193.2]) box(`main-rail-${x}`, 'steel', [x, 14.78, 192], [0.16, 0.2, 336]);
  for (let z = 28; z <= 356; z += 4)
    box(`main-sleeper-${z}`, 'timber', [192, 14.66, z], [4, 0.12, 0.35]);
  for (const z of [144, 176, 208]) {
    for (const x of [187, 197]) {
      const base = heightMm(x, z) / 1000 - 0.3;
      box(`trestle-pier-${x}-${z}`, 'concrete', [x, (base + 14) / 2, z], [1.5, 14 - base, 2]);
      box(`trestle-upright-${x}-${z}`, 'steel', [x, 21, z], [0.35, 14, 0.35]);
    }
    box(`trestle-crown-${z}`, 'steel', [192, 27.8, z], [10.4, 0.4, 0.4]);
  }
  for (const x of [186.4, 197.6]) box(`bridge-side-${x}`, 'blue', [x, 16.4, 176], [0.3, 0.5, 112]);
  // Yard track runs and parking lines leave a broad central flight lane.
  for (const [id, x, start, end] of [
    ['north-tank', 234, 36, 104],
    ['north-timber', 266, 36, 104],
    ['south-tank', 234, 268, 336],
    ['south-timber', 266, 268, 336],
  ]) {
    box(`${id}-bed`, 'concrete', [x, 14.15, (start + end) / 2], [5, 0.3, end - start]);
    for (const dx of [-1.2, 1.2])
      box(
        `${id}-rail-${dx < 0 ? 'left' : 'right'}`,
        'steel',
        [x + dx, 14.48, (start + end) / 2],
        [0.16, 0.2, end - start],
      );
    for (let z = start; z <= end; z += 4)
      box(`${id}-sleeper-${z}`, 'timber', [x, 14.37, z], [4, 0.12, 0.35]);
  }
  box('station-platform', 'concrete', [166, 14, 66], [26, 0.8, 72]);
  box('station-canopy', 'blue', [166, 23.5, 66], [28, 0.45, 68]);
  for (const x of [154, 178])
    for (const z of [36, 56, 76, 96])
      box(`station-post-${x}-${z}`, 'pale', [x, 18.6, z], [0.45, 9.2, 0.45]);
  for (const z of [36, 66, 96]) box(`station-cross-${z}`, 'timber', [166, 22.7, z], [25, 0.4, 0.4]);
  // Two open ends and a clear central route through the maintenance hall.
  box('hall-west', 'brick', [280, 20, 70], [0.6, 12, 56]);
  box('hall-east', 'brick', [320, 20, 70], [0.6, 12, 56]);
  box('hall-roof', 'pale', [300, 26.2, 70], [41, 0.4, 57]);
  for (const z of [42, 98]) {
    for (const x of [286, 314]) box(`hall-door-wing-${x}-${z}`, 'brick', [x, 20, z], [12, 12, 0.6]);
    box(`hall-door-header-${z}`, 'amber', [300, 25, z], [16, 2, 0.7]);
  }
  for (const z of [50, 70, 90]) box(`hall-rafter-${z}`, 'steel', [300, 24.8, z], [40, 0.35, 0.35]);
  // Open recovery and ridge markers are reachable landmarks, not fenced flight limits.
  for (const [id, x, z, width, top] of [
    ['field', 80, 300, 18, 12],
    ['ridge', 64, 60, 16, heightMm(64, 60) / 1000 + 12],
    ['west-cut', 48, 180, 20, 5],
    ['east-cut', 330, 180, 20, 5],
  ]) {
    const alongX = id.endsWith('cut');
    for (const dx of [-width / 2, width / 2]) {
      const px = x + (alongX ? 0 : dx),
        pz = z + (alongX ? dx : 0);
      const ground =
        Math.min(
          ...[-2, 0, 2].flatMap((ox) => [-2, 0, 2].map((oz) => heightMm(px + ox, pz + oz))),
        ) / 1000;
      box(
        `${id}-portal-${dx < 0 ? 'left' : 'right'}`,
        'amber',
        [px, (ground + top) / 2, pz],
        [0.5, top - ground + 0.6, 0.5],
      );
    }
    box(
      `${id}-portal-crown`,
      'amber',
      [x, top, z],
      alongX ? [0.5, 0.5, width + 0.5] : [width + 0.5, 0.5, 0.5],
    );
  }
  return boxes;
}

export const placements = [
  ['north-tank-a', 'train-carriage-tank.glb', 234, 14.6, 58],
  ['north-tank-b', 'train-carriage-tank.glb', 234, 14.6, 88],
  ['north-timber-a', 'train-carriage-flatbed-wood.glb', 266, 14.6, 58],
  ['north-timber-b', 'train-carriage-flatbed-wood.glb', 266, 14.6, 88],
  ['south-tank-a', 'train-carriage-tank.glb', 234, 14.6, 282],
  ['south-tank-b', 'train-carriage-tank.glb', 234, 14.6, 312],
  ['south-timber-a', 'train-carriage-flatbed-wood.glb', 266, 14.6, 282],
  ['bridge-timber', 'train-carriage-flatbed-wood.glb', 192, 14.9, 190],
];

export const routes = [
  { id: 'under-trestle', from: [155, 4, 160], to: [224, 4, 160], halfWidth: 2 },
  { id: 'above-bridge-deck', from: [192, 22, 124], to: [192, 22, 228], halfWidth: 2 },
  { id: 'north-freight-lane', from: [250, 19, 32], to: [250, 19, 108], halfWidth: 2 },
  { id: 'station-canopy', from: [166, 19, 28], to: [166, 19, 104], halfWidth: 2 },
  { id: 'maintenance-hall', from: [300, 20, 32], to: [300, 20, 108], halfWidth: 2 },
  { id: 'cutting-traverse', from: [32, 0, 180], to: [352, 0, 180], halfWidth: 2 },
  { id: 'field-recovery', from: [80, 8, 268], to: [80, 8, 336], halfWidth: 2 },
];
export const spawns = [
  { id: 'freight-yard', position: { x: 250000, y: 16000, z: 40000 } },
  { id: 'trestle-approach', position: { x: 160000, y: 4000, z: 160000 } },
  { id: 'maintenance-entry', position: { x: 300000, y: 19000, z: 32000 } },
  { id: 'field-recovery', position: { x: 80000, y: 8000, z: 280000 } },
];
