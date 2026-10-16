/** Original continuous natural-relief study, metres throughout. Not a geographic reconstruction. */
export const EXTENT_M = 16384;
export const CELL_M = 512;
export const SAMPLE_M = 16;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const ellipse = (x, z, cx, cz, rx, rz) => Math.hypot((x - cx) / rx, (z - cz) / rz);
const hill = (x, z, cx, cz, rx, rz) => Math.exp(-(ellipse(x, z, cx, cz, rx, rz) ** 2));
const mask = (x, z, cx, cz, rx, rz) => 1 - smooth(0.7, 1.3, ellipse(x, z, cx, cz, rx, rz));
export const washX = (z) => 6500 + 650 * Math.sin(z / 1700) + 220 * Math.sin(z / 690 + 0.4);
export const districts = [
  {
    id: 'crescent-dunes',
    title: 'Crescent dunes',
    center: [3200, 3300],
    radiusM: 2400,
    character: 'Oblique dune crests with broad interdune lanes and a lower southern saddle',
  },
  {
    id: 'dry-wash',
    title: 'Dry wash',
    center: [6700, 5800],
    radiusM: 2000,
    character: 'A continuous sinuous drainage with tributary fans and bank-following space',
  },
  {
    id: 'salt-basin',
    title: 'Salt basin',
    center: [3400, 11500],
    radiusM: 2500,
    character: 'Low level playa with a gently rising alluvial margin and isolated island',
  },
  {
    id: 'sunrise-escarpment',
    title: 'Sunrise escarpment',
    center: [12600, 3300],
    radiusM: 2600,
    character: 'A long elevated eastern scarp with unequal broad passes and toe slopes',
  },
  {
    id: 'mesa-corridor',
    title: 'Mesa corridor',
    center: [11700, 10000],
    radiusM: 2200,
    character: 'An open north-south corridor between offset tablelands with climbable shoulders',
  },
  {
    id: 'rocky-plain',
    title: 'Rocky plain',
    center: [10900, 14000],
    radiusM: 1900,
    character: 'Uneven pediment with separate broad tors and navigable saddle gaps',
  },
];
// Broad terrain landmarks, not imported meshes. Widths exceed several 16 m samples.
// id, centreX/Z, radiiX/Z, rise, rotation.
export const landmarks = [
  ['dune-lookout', 2150, 3500, 150, 210, 26, 0.3],
  ['dune-southern-saddle', 4200, 4400, 210, 150, 22, -0.2],
  ['wash-west-butte', 5920, 5650, 150, 240, 72, -0.35],
  ['wash-east-bank-crown', 7100, 6250, 210, 120, 48, 0.5],
  ['playa-island', 3500, 11300, 240, 180, 42, 0.2],
  ['playa-southern-headland', 4300, 13300, 290, 170, 55, -0.2],
  ['escarpment-north-saddle', 12000, 2350, 220, 160, 52, 0.2],
  ['escarpment-low-toe', 11300, 4500, 180, 260, 62, -0.3],
  ['mesa-west-crown', 10800, 9650, 180, 220, 64, 0.1],
  ['mesa-east-shoulder', 12700, 10800, 280, 180, 48, -0.2],
  ['plain-west-tor', 9900, 13800, 160, 220, 95, -0.4],
  ['plain-east-tor', 10550, 13800, 230, 170, 120, 0.3],
  ['plain-southern-sentinel', 11300, 14700, 170, 260, 86, -0.2],
  ['plain-northern-knuckle', 11900, 13300, 240, 160, 74, 0.4],
];

export function heightMm(x, z) {
  // Basin-scale slope joins the independently authored districts without tiled edges.
  let h = 85 + 0.0035 * x + 0.0015 * z;
  h += 26 * hill(x, z, 14500, 15000, 2800, 2200);
  h += 18 * Math.sin(x / 2500 + 0.2) * Math.sin(z / 1900);
  const duneMask = mask(x, z, 3200, 3300, 2600, 2350);
  const phase = (x + 0.38 * z + 125 * Math.sin(z / 780)) / 108;
  // Asymmetric crests and two wavelengths are resolved by the fixed coarse lattice.
  const wave = Math.pow((1 + Math.sin(phase)) / 2, 2.4);
  const secondary = Math.pow((1 + Math.sin((x - 0.16 * z) / 177 + 1.1)) / 2, 3);
  h += duneMask * ((22 + 12 * Math.sin(z / 1600) ** 2) * wave + 9 * secondary);
  h -= 14 * hill(x, z, 4300, 4700, 900, 500);

  // A playa is deliberately nearly level; its shore varies smoothly, unlike a noise field.
  const salt = mask(x, z, 3400, 11500, 2550, 2200);
  const playa = 38 + 0.0008 * (x - 3400) + 0.0004 * (z - 11500);
  h = h * (1 - salt) + playa * salt;
  h += 36 * hill(x, z, 6500, 11700, 1350, 2600);
  // Narrower drainage is still at least 18 coarse samples across the principal floor.
  const wash = Math.exp(-(((x - washX(z)) / (150 + 35 * Math.sin(z / 1100) ** 2)) ** 2));
  h -= 34 * wash;
  h -=
    14 *
    Math.exp(-(((x - 4800 - 0.3 * (z - 8500)) / 210) ** 2)) *
    hill(x, z, 5600, 8500, 1900, 1500);

  // Broad escarpment retains two saddles and gradually fades into the southern pediment.
  h += 285 * smooth(11200, 12600, x) * (1 - smooth(4400, 6900, z));
  h -= 94 * hill(x, z, 12200, 2750, 1150, 430);
  h -= 70 * hill(x, z, 12100, 4700, 1100, 520);
  h += 48 * hill(x, z, 11000, 3400, 800, 1600);

  // Offset mesas leave a coherent corridor instead of a repeated grid of pillars.
  h += 185 * (1 - smooth(0.65, 1.15, ellipse(x, z, 10400, 9300, 1050, 1600)));
  h += 235 * (1 - smooth(0.62, 1.2, ellipse(x, z, 13500, 10400, 1300, 1250)));
  h += 48 * hill(x, z, 11800, 11600, 1800, 500);
  h += 8 * Math.sin(x / 490) * Math.sin(z / 610) * mask(x, z, 11000, 14000, 2700, 1850);
  // No sharp absolute/noise function; gentle long waves keep the transition terrain readable.
  h += 1.4 * Math.sin(x / 187 + z / 349) * Math.sin(z / 241 - x / 383) * (1 - salt);
  for (const [, cx, cz, rx, rz, rise, rotation] of landmarks) {
    const dx = x - cx,
      dz = z - cz;
    const px = dx * Math.cos(rotation) - dz * Math.sin(rotation),
      pz = dx * Math.sin(rotation) + dz * Math.cos(rotation);
    h += rise * (1 - smooth(0.15, 1.35, Math.hypot(px / rx, pz / rz)));
  }
  return Math.round(h * 1000);
}

/** Mirrors the canonical two-triangle 16 m terrain lattice exactly. */
export function surfaceMm(x, z) {
  const ax = Math.floor(x / SAMPLE_M) * SAMPLE_M,
    az = Math.floor(z / SAMPLE_M) * SAMPLE_M;
  const u = (x - ax) / SAMPLE_M,
    v = (z - az) / SAMPLE_M;
  const a = heightMm(ax, az),
    b = heightMm(ax + SAMPLE_M, az),
    c = heightMm(ax, az + SAMPLE_M),
    d = heightMm(ax + SAMPLE_M, az + SAMPLE_M);
  return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - v) * (b - d) + (1 - u) * (c - d);
}
const route = (id, district, points) => ({ id, district, halfWidthM: 20, clearanceM: 32, points });
export const routes = [
  route('dune-crest-traverse', 'crescent-dunes', [
    [2700, 3100],
    [3300, 3100],
    [3800, 3350],
  ]),
  route('dune-interdune-sweep', 'crescent-dunes', [
    [2200, 4050],
    [2800, 4200],
    [3400, 4100],
  ]),
  route(
    'wash-floor-follow',
    'dry-wash',
    [5000, 5500, 6000, 6500].map((z) => [Math.round(washX(z)), z]),
  ),
  route('wash-bank-loop', 'dry-wash', [
    [6050, 5700],
    [6400, 6000],
    [6800, 6350],
  ]),
  route('salt-island-pass', 'salt-basin', [
    [2900, 10900],
    [3500, 10900],
    [4100, 11000],
  ]),
  route('salt-shore-rise', 'salt-basin', [
    [4300, 12200],
    [4900, 12200],
    [5500, 12200],
  ]),
  route('escarpment-northern-pass', 'sunrise-escarpment', [
    [11200, 2750],
    [12000, 2750],
    [12800, 2750],
  ]),
  route('escarpment-toe-contour', 'sunrise-escarpment', [
    [10900, 3600],
    [11100, 4050],
    [10900, 4600],
  ]),
  route('mesa-central-corridor', 'mesa-corridor', [
    [11700, 9000],
    [11900, 9600],
    [11900, 10300],
  ]),
  route('mesa-southern-saddle', 'mesa-corridor', [
    [11200, 11300],
    [11800, 11400],
    [12400, 11300],
  ]),
  route('rocky-twin-gap', 'rocky-plain', [
    [10200, 13300],
    [10200, 13800],
    [10200, 14300],
  ]),
  route('rocky-sentinel-contour', 'rocky-plain', [
    [10900, 14300],
    [11600, 14300],
    [12000, 13900],
  ]),
];
export const starts = routes
  .filter((_, i) => i % 2 === 0)
  .map((r) => ({ id: r.district, x: r.points[0][0], z: r.points[0][1] }));
