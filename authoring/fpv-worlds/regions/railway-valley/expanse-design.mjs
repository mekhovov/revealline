/** Original industrial valley, in metres. Source study; no player admission. */
export const EXTENT_M = 4096;
export const CELL_M = 256;
export const districts = [
  { id: 'freight', x: 640, z: 640, en: 'Freight exchange', uk: 'Вантажний вузол' },
  { id: 'viaduct', x: 2048, z: 2048, en: 'River viaduct', uk: 'Річковий віадук' },
  { id: 'quarry', x: 3456, z: 640, en: 'Quarry transfer', uk: 'Кар’єрний термінал' },
  { id: 'station', x: 640, z: 3200, en: 'Station settlement', uk: 'Привокзальне селище' },
  { id: 'foundry', x: 2048, z: 3200, en: 'Foundry works', uk: 'Ливарний завод' },
  { id: 'sidings', x: 3456, z: 3200, en: 'Timber sidings', uk: 'Лісовий роз’їзд' },
];
const smooth = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export function heightMm(x, z) {
  const river = 2048 + 110 * Math.sin(x / 460);
  let h =
    28 +
    120 * Math.exp(-(((z - 250) / 440) ** 2)) +
    96 * Math.exp(-(((z - 3850) / 430) ** 2)) +
    36 * Math.sin(x / 360) ** 2 * (1 - Math.exp(-(((z - river) / 300) ** 2)));
  const channel = 1 - smooth(65, 290, Math.abs(z - river));
  h = h * (1 - channel) + 12 * channel;
  for (const d of districts.filter((d) => d.id !== 'viaduct')) {
    const weight = 1 - smooth(145, 225, Math.max(Math.abs(x - d.x), Math.abs(z - d.z)));
    h += (64 - h) * weight;
  }
  // Railroad approaches are level; the central crossing remains a real raised bridge.
  const northSouth =
    (1 - smooth(13, 34, Math.abs(x - 2048))) *
    Math.max(1 - smooth(1750, 1800, z), smooth(2300, 2350, z));
  const crossTracks = Math.max(
    1 - smooth(11, 30, Math.abs(z - 640)),
    1 - smooth(11, 30, Math.abs(z - 3200)),
  );
  const weight =
    Math.max(northSouth, crossTracks) * smooth(192, 256, x) * (1 - smooth(3840, 3904, x));
  h += (64 - h) * weight;
  return Math.round(h * 1000);
}
// Same a/c/b and b/c/d triangles as the canonical visible and collision mesh.
export function surfaceMm(x, z) {
  const ax = Math.floor(x / 8) * 8,
    az = Math.floor(z / 8) * 8;
  const tx = (x - ax) / 8,
    tz = (z - az) / 8;
  const a = heightMm(ax, az),
    b = heightMm(ax + 8, az),
    c = heightMm(ax, az + 8),
    d = heightMm(ax + 8, az + 8);
  return tx + tz <= 1
    ? a + (b - a) * tx + (c - a) * tz
    : d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
}
const palette = {
  concrete: [0.51, 0.49, 0.43],
  steel: [0.19, 0.25, 0.27],
  brick: [0.48, 0.25, 0.16],
  timber: [0.34, 0.23, 0.12],
  pale: [0.68, 0.68, 0.61],
  blue: [0.16, 0.36, 0.45],
  amber: [0.76, 0.47, 0.12],
};
export function architecture() {
  const pieces = [];
  const box = (id, material, center, size) =>
    pieces.push({ id, color: palette[material], center, size });
  const hall = (id, x, z, width = 28, length = 96, top = 83) => {
    for (const dx of [-width / 2, width / 2])
      box(`${id}-wall-${dx}`, 'brick', [x + dx, (64 + top) / 2, z], [0.7, top - 64, length]);
    box(`${id}-roof`, 'pale', [x, top, z], [width + 2, 0.6, length + 2]);
    for (const dz of [-length / 2, length / 2])
      box(`${id}-lintel-${dz}`, 'amber', [x, top - 1.5, z + dz], [width, 2, 0.8]);
    for (let dz = -length / 2 + 12; dz < length / 2; dz += 24)
      box(`${id}-tie-${dz}`, 'steel', [x, top - 3, z + dz], [width, 0.4, 0.4]);
  };
  const track = (id, a, b) => {
    const alongX = a[2] === b[2],
      length = alongX ? b[0] - a[0] : b[2] - a[2];
    const mid = a.map((n, i) => (n + b[i]) / 2);
    box(
      `${id}-bed`,
      'concrete',
      [mid[0], 64.2, mid[2]],
      alongX ? [length, 0.4, 8] : [8, 0.4, length],
    );
    for (const side of [-1.2, 1.2])
      box(
        `${id}-rail-${side}`,
        'steel',
        [mid[0] + (alongX ? 0 : side), 64.6, mid[2] + (alongX ? side : 0)],
        alongX ? [length, 0.2, 0.15] : [0.15, 0.2, length],
      );
    for (let n = 6; n < length; n += 12)
      box(
        `${id}-sleeper-${n}`,
        'timber',
        [a[0] + (alongX ? n : 0), 64.45, a[2] + (alongX ? 0 : n)],
        alongX ? [0.35, 0.12, 5] : [5, 0.12, 0.35],
      );
  };
  track('north-main', [256, 0, 640], [3840, 0, 640]);
  track('south-main', [256, 0, 3200], [3840, 0, 3200]);
  track('valley-main', [2048, 0, 384], [2048, 0, 3712]);
  // Bridge piers and side frames deliberately leave the river flight line open.
  for (const z of [1792, 1888, 1984, 2112, 2208, 2304]) {
    for (const dx of [-7, 7]) {
      const ground = surfaceMm(2048 + dx, z) / 1000 - 1;
      box(
        `viaduct-pier-${dx}-${z}`,
        'concrete',
        [2048 + dx, (ground + 64) / 2, z],
        [1.4, 64 - ground, 2],
      );
      box(`viaduct-post-${dx}-${z}`, 'steel', [2048 + dx, 74, z], [0.4, 20, 0.5]);
    }
    box(`viaduct-crown-${z}`, 'blue', [2048, 84, z], [14.4, 0.5, 0.6]);
  }
  for (const dx of [-7, 7])
    box(`viaduct-top-${dx}`, 'steel', [2048 + dx, 84, 2048], [0.45, 0.45, 512]);
  hall('freight-west', 588, 640);
  hall('freight-east', 692, 640, 36, 128, 88);
  for (const z of [592, 640, 688])
    box(`freight-loading-${z}`, 'concrete', [730, 66, z], [18, 4, 24]);
  // Quarry: terraces and a conveyor canopy produce distinct vertical and horizontal gaps.
  for (let i = 0; i < 4; i++)
    box(
      `quarry-bench-${i}`,
      'concrete',
      [3526 + i * 18, 67 + i * 5, 640],
      [18, 6 + i * 10, 200 - i * 24],
    );
  for (const z of [580, 620, 660, 700])
    for (const dx of [-16, 16])
      box(`quarry-post-${dx}-${z}`, 'steel', [3456 + dx, 77, z], [0.6, 26, 0.6]);
  box('quarry-conveyor', 'blue', [3456, 90, 640], [34, 1, 140]);
  box('quarry-transfer-tower', 'amber', [3398, 84, 696], [14, 40, 14]);
  // Station: platform canopy and an inhabited-looking side street, with open approaches.
  for (const dx of [-15, 15])
    for (const z of [3148, 3180, 3220, 3252])
      box(`station-post-${dx}-${z}`, 'pale', [640 + dx, 71, z], [0.5, 14, 0.5]);
  box('station-canopy', 'blue', [640, 78, 3200], [34, 0.6, 120]);
  for (const [i, dx, dz] of [
    [0, -64, -70],
    [1, -64, 0],
    [2, -64, 70],
    [3, 64, -50],
    [4, 64, 40],
  ]) {
    box(`station-home-${i}`, 'brick', [640 + dx, 69, 3200 + dz], [24, 10, 32]);
    box(`station-roof-${i}`, 'pale', [640 + dx, 74.3, 3200 + dz], [27, 0.6, 35]);
  }
  // Foundry: taller halls, chimney landmarks and a clear pipe gantry route.
  hall('foundry-east', 2110, 3200, 46, 152, 96);
  for (const [i, dx, dz] of [
    [0, -65, -55],
    [1, -65, 55],
    [2, 110, -85],
    [3, 110, 85],
  ]) {
    box(`foundry-stack-${i}`, 'brick', [2048 + dx, 95, 3200 + dz], [8, 62, 8]);
    box(`foundry-collar-${i}`, 'pale', [2048 + dx, 119, 3200 + dz], [9, 3, 9]);
  }
  for (const z of [3144, 3200, 3256]) {
    for (const dx of [-20, 20])
      box(`foundry-gantry-post-${dx}-${z}`, 'steel', [2048 + dx, 78, z], [0.8, 28, 0.8]);
    box(`foundry-gantry-${z}`, 'amber', [2048, 92, z], [42, 1, 1]);
  }
  // Timber: open stacks, low roof and crane weave instead of another enclosed hall.
  for (const dx of [-65, -40, 40, 65])
    for (const dz of [-60, 0, 60])
      box(`timber-stack-${dx}-${dz}`, 'timber', [3456 + dx, 67, 3200 + dz], [12, 6, 34]);
  for (const z of [3136, 3200, 3264]) {
    for (const dx of [-22, 22])
      box(`sidings-crane-${dx}-${z}`, 'steel', [3456 + dx, 77, z], [0.8, 26, 1]);
    box(`sidings-header-${z}`, 'amber', [3456, 90, z], [46, 1.2, 1.2]);
  }
  box('timber-canopy', 'blue', [3456, 77, 3200], [30, 0.5, 36]);
  return pieces;
}
export const routes = [
  { id: 'freight-hall', from: [588, 72, 574], to: [588, 72, 706], halfWidth: 3 },
  { id: 'freight-apron', from: [500, 72, 550], to: [780, 72, 550], halfWidth: 3 },
  { id: 'viaduct-river-gap', from: [1984, 36, 2048], to: [2112, 36, 2048], halfWidth: 3 },
  { id: 'viaduct-above-deck', from: [2048, 72, 1760], to: [2048, 72, 2336], halfWidth: 3 },
  { id: 'quarry-under-conveyor', from: [3456, 75, 554], to: [3456, 75, 726], halfWidth: 3 },
  { id: 'quarry-low-transfer', from: [3336, 72, 560], to: [3490, 72, 560], halfWidth: 3 },
  { id: 'station-canopy', from: [640, 71, 3128], to: [640, 71, 3272], halfWidth: 3 },
  { id: 'station-street', from: [608, 70, 3096], to: [608, 70, 3304], halfWidth: 3 },
  { id: 'foundry-gantries', from: [2048, 76, 3104], to: [2048, 76, 3296], halfWidth: 3 },
  { id: 'foundry-hall', from: [2110, 75, 3108], to: [2110, 75, 3292], halfWidth: 3 },
  { id: 'timber-crane-line', from: [3456, 72, 3104], to: [3456, 72, 3296], halfWidth: 3 },
  { id: 'timber-side-aisle', from: [3427, 72, 3104], to: [3427, 72, 3296], halfWidth: 2 },
];
export const spawns = routes
  .filter((_, i) => i % 2 === 0)
  .map((r) => ({
    id: r.id,
    position: { x: r.from[0] * 1000, y: r.from[1] * 1000, z: r.from[2] * 1000 },
  }));
export const landmarks = [
  ['freight-halls', 588, 640],
  ['loading-apron', 730, 640],
  ['river-trestle', 2048, 2048],
  ['north-bridge-portal', 2048, 1792],
  ['quarry-terraces', 3544, 640],
  ['transfer-tower', 3398, 696],
  ['station-canopy', 640, 3200],
  ['station-street', 576, 3200],
  ['foundry-chimneys', 1983, 3145],
  ['foundry-hall', 2110, 3200],
  ['timber-cranes', 3456, 3136],
  ['timber-stacks', 3521, 3200],
];
export const placements = [
  ['freight-tank', 'north-tank-a', 662, 64.6, 586],
  ['freight-wood', 'north-timber-a', 662, 64.6, 698],
  ['quarry-tank', 'north-tank-a', 3420, 64.6, 610],
  ['station-wood', 'north-timber-a', 684, 64.6, 3220],
  ['foundry-tank', 'north-tank-a', 2014, 64.6, 3220],
  ['timber-wood', 'north-timber-a', 3508, 64.6, 3180],
];
export const solidProbes = [
  { id: 'freight-wall', from: [570, 72, 620], to: [582, 72, 620] },
  { id: 'quarry-terrace', from: [3506, 68, 640], to: [3530, 68, 640] },
  { id: 'station-home', from: [552, 69, 3200], to: [580, 69, 3200] },
  { id: 'foundry-stack', from: [1970, 90, 3145], to: [1992, 90, 3145] },
  { id: 'timber-stack', from: [3510, 67, 3200], to: [3532, 67, 3200] },
];
