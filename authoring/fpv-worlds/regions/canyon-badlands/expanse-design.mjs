/** Original broad-relief design; metres throughout, no reused/scaled arrival terrain. */
export const EXTENT_M = 8192;
export const CELL_M = 256;
export const SAMPLE_M = 8;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const ellipse = (x, z, cx, cz, rx, rz) => Math.hypot((x - cx) / rx, (z - cz) / rz);
const hill = (x, z, cx, cz, rx, rz) => Math.exp(-(ellipse(x, z, cx, cz, rx, rz) ** 2));
const channel = (x, z, points) => {
  let distance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1],
      [bx, bz] = points[i];
    const dx = bx - ax,
      dz = bz - az;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    distance = Math.min(distance, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return distance;
};
const westernRiver = [
  [120, 1300],
  [1100, 1450],
  [2000, 2100],
  [2750, 3100],
  [3800, 4200],
];
const southernRiver = [
  [1200, 7800],
  [1600, 6800],
  [2300, 5800],
  [3300, 5100],
  [4000, 4400],
];

export const districts = [
  {
    id: 'braided-basin',
    title: 'Braided basin',
    center: [1250, 1700],
    radiusM: 1250,
    character: 'Low alluvial basin, curving drainage and isolated fins',
  },
  {
    id: 'high-mesa',
    title: 'High mesa',
    center: [4750, 1500],
    radiusM: 1400,
    character: 'Broad elevated tableland with a descending western terrace',
  },
  {
    id: 'red-escarpment',
    title: 'Red escarpment',
    center: [6900, 3100],
    radiusM: 1300,
    character: 'Long eastern cliff contour with two saddles and a lower shelf',
  },
  {
    id: 'confluence',
    title: 'Three-way confluence',
    center: [3850, 4400],
    radiusM: 1200,
    character: 'Three unequal drainage corridors around an eroded central island',
  },
  {
    id: 'hoodoo-flats',
    title: 'Hoodoo flats',
    center: [1700, 6600],
    radiusM: 1350,
    character: 'Low rolling fan with separately authored pillar groups and broad slalom space',
  },
  {
    id: 'amphitheatre',
    title: 'Sunset amphitheatre',
    center: [6450, 6500],
    radiusM: 1400,
    character: 'Open horseshoe rim, elevated lookout and a clear westward exit',
  },
];

/** Smooth relief is authored in global space so every shared 8 m sample agrees. */
export function heightMm(x, z) {
  let h = 100 + 0.008 * z + 0.004 * x;
  h += 32 * hill(x, z, 600, 7000, 1900, 1200);
  h += 55 * hill(x, z, 7500, 600, 1900, 1200);
  h -= 48 * hill(x, z, 1300, 1700, 1300, 1000);
  // Flat mesa with a broad, independently located low terrace.
  h += 205 * (1 - smooth(0.72, 1.18, ellipse(x, z, 4750, 1500, 1500, 1080)));
  h += 62 * hill(x, z, 3550, 1850, 680, 900);
  // Eastern scarp is a continuous landform, with two passes rather than repeated teeth.
  h += 205 * smooth(6100, 6780, x) * (1 - smooth(0.65, 1.2, Math.abs(z - 3150) / 1950));
  h -= 85 * hill(x, z, 6650, 2700, 430, 240);
  h -= 70 * hill(x, z, 6500, 4050, 470, 280);
  h += 58 * hill(x, z, 5760, 3600, 620, 1200);
  // The principal gorge changes width and heading along its length.
  const mainX = 3500 + 520 * Math.sin(z / 1180 + 0.4) + 135 * Math.sin(z / 430);
  const width = 110 + 50 * (0.5 + 0.5 * Math.sin(z / 890 + 0.8));
  h -= 100 * Math.exp(-(((x - mainX) / width) ** 2));
  h -= 65 * Math.exp(-((channel(x, z, westernRiver) / 160) ** 2));
  h -= 55 * Math.exp(-((channel(x, z, southernRiver) / 180) ** 2));
  h += 85 * hill(x, z, 4400, 4550, 360, 550);
  // Broad southern fan, then a horseshoe rim with a deliberately open western mouth.
  h += 22 * hill(x, z, 1800, 6500, 1500, 1200) * Math.sin((x + z * 0.35) / 270);
  const ring = ellipse(x, z, 6450, 6500, 1250, 1150);
  const mouth = smooth(5400, 5900, x);
  h += 180 * Math.exp(-(((ring - 0.85) / 0.23) ** 2)) * mouth;
  h -= 35 * hill(x, z, 6300, 6500, 800, 700);
  // Low-amplitude erosion: incommensurate long waves, no repeated tile or sharp noise.
  h += 3 * Math.sin(x / 139 + z / 267) * Math.sin(z / 173 - x / 311);
  for (const [, cx, cz, rx, rz, rise, , twist] of landmarks) {
    const dx = x - cx,
      dz = z - cz;
    const px = dx * Math.cos(twist) - dz * Math.sin(twist);
    const pz = dx * Math.sin(twist) + dz * Math.cos(twist);
    const r = Math.hypot(px / (rx + 40), pz / (rz + 40));
    h += rise * (1 - smooth(0.25, 1.5, r));
  }
  return Math.round(Math.max(12, h) * 1000);
}

/** Exact same lower-left/upper-right split as the canonical terrain compiler. */
export function surfaceMm(x, z) {
  const ax = Math.floor(x / SAMPLE_M) * SAMPLE_M,
    az = Math.floor(z / SAMPLE_M) * SAMPLE_M;
  const u = (x - ax) / SAMPLE_M,
    v = (z - az) / SAMPLE_M;
  const a = heightMm(ax, az),
    b = heightMm(ax + SAMPLE_M, az);
  const c = heightMm(ax, az + SAMPLE_M),
    d = heightMm(ax + SAMPLE_M, az + SAMPLE_M);
  return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - v) * (b - d) + (1 - u) * (c - d);
}

// Independently placed silhouettes. Their profiles/sizes serve local routes, not a density quota.
// id, x, z, core radiusX/Z, height, design sides, rotation.
// Broad 40m shoulders keep these relief formations resolved on the 8 m lattice.
export const landmarks = [
  ['basin-entry-fin', 940, 1640, 28, 13, 48, 7, 0.1],
  ['basin-twin-west', 1510, 1940, 18, 22, 66, 9, 0.25],
  ['basin-twin-east', 1630, 1940, 24, 18, 52, 8, -0.15],
  ['mesa-west-marker', 3710, 1370, 36, 22, 40, 8, 0.1],
  ['mesa-north-crown', 4700, 1090, 28, 30, 64, 10, 0.2],
  ['mesa-east-fin', 5310, 1690, 15, 45, 58, 7, -0.25],
  ['scarp-saddle-north', 6710, 2640, 28, 18, 52, 8, 0.12],
  ['scarp-shelf-needle', 6060, 3270, 17, 22, 80, 9, -0.2],
  ['scarp-saddle-south', 6490, 4140, 36, 25, 45, 7, 0.1],
  ['confluence-island-fin', 4410, 4510, 30, 18, 60, 8, -0.3],
  ['confluence-west-turn', 3490, 4690, 22, 25, 46, 9, 0.2],
  ['confluence-south-pillar', 3890, 5090, 18, 20, 70, 8, 0.12],
  ['hoodoo-low-stack', 1400, 6410, 25, 32, 55, 10, -0.1],
  ['hoodoo-needle', 1740, 6630, 14, 18, 84, 9, 0.3],
  ['hoodoo-wide-crown', 2050, 6410, 38, 27, 50, 8, -0.2],
  ['rim-west-entry', 5490, 6360, 26, 18, 54, 7, 0.2],
  ['rim-east-lookout', 7210, 6470, 25, 34, 62, 10, -0.1],
  ['rim-south-exit', 6380, 7430, 30, 22, 46, 8, 0.25],
];

const route = (id, district, points) => ({ id, district, halfWidthM: 12, clearanceM: 24, points });
export const routes = [
  route('basin-twin-gap', 'braided-basin', [
    [1570, 1760],
    [1570, 2110],
  ]),
  route('basin-drainage', 'braided-basin', [
    [500, 1370],
    [1100, 1450],
    [1600, 1800],
    [2000, 2100],
  ]),
  route('mesa-west-rise', 'high-mesa', [
    [3370, 1570],
    [3770, 1570],
    [4170, 1570],
  ]),
  route('mesa-crown-orbit', 'high-mesa', [
    [4540, 1090],
    [4700, 930],
    [4860, 1090],
    [4700, 1250],
    [4540, 1090],
  ]),
  route('escarpment-north-pass', 'red-escarpment', [
    [6210, 2740],
    [6570, 2740],
    [6970, 2740],
  ]),
  route('escarpment-low-contour', 'red-escarpment', [
    [5880, 3000],
    [5910, 3400],
    [6020, 3800],
  ]),
  route('confluence-island-orbit', 'confluence', [
    [4150, 4380],
    [4440, 4250],
    [4640, 4540],
    [4380, 4770],
    [4150, 4380],
  ]),
  route('confluence-west-channel', 'confluence', [
    [2900, 3260],
    [3350, 3730],
    [3780, 4180],
  ]),
  route('hoodoo-slalom', 'hoodoo-flats', [
    [1250, 6550],
    [1550, 6550],
    [1900, 6550],
    [2220, 6550],
  ]),
  route('hoodoo-southern-fan', 'hoodoo-flats', [
    [1300, 7200],
    [1600, 7000],
    [1950, 7200],
    [2280, 7000],
  ]),
  route('amphitheatre-mouth', 'amphitheatre', [
    [5200, 6500],
    [5700, 6500],
    [6200, 6500],
  ]),
  route('amphitheatre-rim-ascent', 'amphitheatre', [
    [6470, 6800],
    [6800, 6800],
    [7090, 6800],
    [7350, 6800],
  ]),
];
export const starts = routes
  .filter((_, i) => i % 2 === 0)
  .map((r) => ({ id: r.district, x: r.points[0][0], z: r.points[0][1] }));
