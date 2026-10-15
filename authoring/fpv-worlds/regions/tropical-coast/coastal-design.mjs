/** Original bounded coastal layout; asset placement and paths share the same coordinates. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = (v) => {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
};
export const foundations = [
  { x: 80, z: 102, radius: 23, height: -3 },
  { x: 190, z: 100, radius: 20, height: -1.5 },
  { x: 192, z: 196, radius: 21, height: 2 },
  { x: 192, z: 292, radius: 18, height: 3 },
];
export function coastalHeightMm(x, z) {
  const shore = 115 + 12 * Math.sin(x / 62) + 5 * Math.sin(x / 27);
  const inland = z - shore;
  let y = inland < 0 ? -4 * smooth(-inland / 30) : 2.2 * smooth(inland / 30);
  if (inland > 28)
    y +=
      smooth((inland - 28) / 24) *
      (2 + 2.2 * Math.sin(x / 53) * Math.sin(z / 47) + 1.2 * Math.sin((x + z) / 31));
  for (const p of foundations) {
    const d = Math.hypot(x - p.x, z - p.z);
    y += (p.height - y) * (1 - smooth((d - p.radius) / 12));
  }
  return Math.round(y * 1000);
}
export const placements = [
  {
    id: 'covered-pier',
    asset: 'covered-jetty',
    x: 80,
    z: 102,
    y: -3,
    scale: 1,
    yaw: 0,
  },
  {
    id: 'open-pier',
    asset: 'open-jetty',
    x: 190,
    z: 100,
    y: -1.5,
    scale: 1,
    yaw: 0,
  },
  ...[
    [294, 103, 1.4],
    [310, 113, 1.1],
    [327, 96, 1.5],
  ].map(([x, z, scale], i) => ({
    id: 'shallows-rock-' + i,
    asset: 'beach-rock',
    x,
    z,
    y: coastalHeightMm(x, z) / 1000,
    scale,
    yaw: i * 0.7,
  })),
  ...[
    [64, 180],
    [101, 211],
    [292, 298],
    [325, 326],
  ].map(([x, z], i) => ({
    id: 'palm-' + i,
    asset: 'palm',
    x,
    z,
    y: coastalHeightMm(x, z) / 1000,
    scale: 1,
    yaw: i * 0.5,
  })),
  {
    id: 'stilt-hut',
    asset: 'jungle-hut',
    x: 192,
    z: 196,
    y: 2,
    scale: 1,
    yaw: 0,
  },
  ...[
    [290, 185],
    [312, 199],
    [330, 180],
  ].map(([x, z], i) => ({
    id: 'bamboo-' + i,
    asset: 'young-bamboo',
    x,
    z,
    y: coastalHeightMm(x, z) / 1000,
    scale: 1.5,
    yaw: i * 0.8,
  })),
  ...Array.from({ length: 24 }, (_, i) => {
    const x = 28 + (i % 6) * 15,
      z = 275 + Math.floor(i / 6) * 22;
    return {
      id: 'grass-' + i,
      asset: 'beach-grass',
      x,
      z,
      y: coastalHeightMm(x, z) / 1000,
      scale: 3,
      yaw: i * 0.9,
    };
  }),
  ...[
    [186, 292],
    [192, 300],
    [199, 292],
  ].map(([x, z], i) => ({
    id: 'cargo-' + i,
    asset: 'crate',
    x,
    z,
    y: 3,
    scale: 1.4,
    yaw: (i * Math.PI) / 2,
  })),
];
export const startingPoints = [
  { id: 'shore-overlook', position: { x: 192000, y: 16000, z: 164000 } },
  { id: 'covered-pier', position: { x: 63000, y: 4500, z: 102000 } },
  { id: 'hut-approach', position: { x: 192000, y: 7000, z: 177000 } },
];
export const flightRoutes = [
  {
    id: 'shoreline-crossings',
    points: [
      [30, 12, 143],
      [130, 12, 143],
      [250, 12, 143],
      [350, 12, 143],
    ],
    halfWidth: 2,
  },
  {
    id: 'covered-pier-opening',
    points: [
      [65, 4.4, 102],
      [95, 4.4, 102],
    ],
    halfWidth: 1,
  },
  {
    id: 'under-pier',
    points: [
      [65, 0.7, 102],
      [95, 0.7, 102],
    ],
    halfWidth: 0.8,
  },
  {
    id: 'palm-slalom',
    points: [
      [48, 12, 180],
      [64, 12, 171],
      [80, 12, 182],
      [101, 12, 202],
      [116, 12, 215],
    ],
    halfWidth: 2,
  },
  {
    id: 'bamboo-corridor',
    points: [
      [278, 12, 193],
      [305, 12, 186],
      [343, 12, 193],
    ],
    halfWidth: 2,
  },
  {
    id: 'cargo-braking',
    points: [
      [179, 5, 300],
      [185, 5, 302],
      [201, 5, 302],
      [210, 5, 292],
    ],
    halfWidth: 1.5,
  },
];
