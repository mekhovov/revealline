/** Original Alpine composition. Metres for authoring; canonical heights are integer millimetres. */
export const GRID = 16,
  CELL_M = 256,
  EXTENT_M = GRID * CELL_M;
export const districts = [
  {
    id: "glacial-valley",
    x: 640,
    z: 700,
    height: 110,
    character:
      "Broad glacial valley with erratic boulders and braided meltwater",
  },
  {
    id: "switchback-pass",
    x: 1700,
    z: 600,
    height: 260,
    character:
      "Stepped retaining walls and traversable switchback road terraces",
  },
  {
    id: "snow-saddle",
    x: 3000,
    z: 800,
    height: 420,
    character: "Narrow snow saddle framed by unequal rocky pinnacles",
  },
  {
    id: "summit-station",
    x: 3400,
    z: 3100,
    height: 560,
    character: "Split mountain station, cable pylons and lookout tower",
  },
  {
    id: "viaduct-gorge",
    x: 2400,
    z: 3000,
    height: 210,
    character:
      "Long elevated viaduct with unequal grounded piers and fly-through bays",
  },
  {
    id: "reservoir-dam",
    x: 800,
    z: 2800,
    height: 170,
    character:
      "Reservoir retaining face, spillway channel and separated maintenance galleries",
  },
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (v) => v * v * (3 - 2 * v);
const stationApproach = {
  id: "station-approach",
  x: 3280,
  z: 3100,
  height: 560,
};
export const links = [
  [districts[0], districts[1]],
  [districts[1], districts[2]],
  [districts[2], stationApproach],
  [stationApproach, districts[3]],
  [districts[3], districts[4]],
  [districts[4], districts[5]],
  [districts[5], districts[0]],
];
function distanceToLink(x, z, a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = clamp(
    ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
    0,
    1,
  );
  return {
    distance: Math.hypot(x - a.x - t * dx, z - a.z - t * dz),
    height: a.height + (b.height - a.height) * t,
  };
}
export function heightMm(x, z) {
  const peak = (px, pz, amplitude, radius) =>
    amplitude * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (radius * radius));
  let h =
    85 +
    peak(2100, 1750, 610, 720) +
    peak(3660, 2500, 520, 700) +
    peak(2500, 480, 340, 550) +
    22 * Math.sin(x / 310) * Math.cos(z / 410) +
    9 * Math.sin((x + z) / 137);
  // Connected, sloped valleys are carved into the relief; the rest remains mountainous.
  const near = links
    .map(([a, b]) => distanceToLink(x, z, a, b))
    .sort((a, b) => a.distance - b.distance)[0];
  if (near.distance < 155)
    h =
      near.height +
      (h - near.height) * smooth(clamp((near.distance - 38) / 117, 0, 1));
  for (const d of districts) {
    const r = Math.hypot(x - d.x, z - d.z);
    if (r < 220)
      h = d.height + (h - d.height) * smooth(clamp((r - 115) / 105, 0, 1));
  }
  // The viaduct sits across a real lowered gorge. End abutments remain on the shoulders.
  const gorge = Math.hypot((x - 2400) / 180, (z - 3070) / 60);
  if (gorge < 1) h -= 35 * (1 - gorge * gorge);
  return Math.round(Math.max(35, h) * 1000);
}
export function surfaceMm(x, z) {
  const ix = Math.floor(x / 8) * 8,
    iz = Math.floor(z / 8) * 8,
    u = (x - ix) / 8,
    v = (z - iz) / 8;
  const a = heightMm(ix, iz),
    b = heightMm(ix + 8, iz),
    c = heightMm(ix, iz + 8),
    d = heightMm(ix + 8, iz + 8);
  return u + v <= 1
    ? a + (b - a) * u + (c - a) * v
    : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
export const routes = [];
// A ring of linked valleys. Segment starts select test scenarios, never mutate a running body.
for (const [a, b] of links) {
  const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 80);
  for (let i = 0; i < count; i++) {
    const point = (t) => {
      const x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      return [x, surfaceMm(x, z) / 1000 + 18, z];
    };
    routes.push({
      id: `${a.id}-link-${i + 1}`,
      from: point(i / count).map((v) => Math.round(v * 1000) / 1000),
      to: point((i + 1) / count).map((v) => Math.round(v * 1000) / 1000),
      halfWidth: 8,
    });
  }
}
const route = (id, from, to, halfWidth = 4) =>
  routes.push({ id, from, to, halfWidth });
route("glacial-erratic-slalom", [580, 122, 700], [700, 122, 700], 10);
route("switchback-terrace", [1630, 272, 600], [1770, 272, 600], 5);
route("snow-pinnacle-gap", [3000, 432, 720], [3000, 432, 880], 6);
route("summit-station-concourse", [3320, 572, 3100], [3480, 572, 3100], 5);
route("viaduct-underpass", [2400, 218, 3035], [2400, 218, 3110], 5);
route("dam-spillway", [800, 182, 2720], [800, 182, 2880], 5);
export const spawns = districts.map((d) => ({
  id: d.id,
  position: { x: d.x * 1000, y: (d.height + 4) * 1000, z: d.z * 1000 },
}));
const stone = [0.39, 0.43, 0.45, 1],
  concrete = [0.64, 0.65, 0.61, 1],
  timber = [0.32, 0.2, 0.12, 1],
  red = [0.55, 0.16, 0.1, 1],
  dark = [0.16, 0.2, 0.23, 1];
export function architecture() {
  const pieces = [];
  const box = (id, center, size, color = stone) =>
    pieces.push({ id, type: "box", center, size, color });
  const post = (id, x, z, top, width = 3, color = stone) => {
    const floor = surfaceMm(x, z) / 1000 - 1;
    box(id, [x, (floor + top) / 2, z], [width, top - floor, width], color);
  };
  const rock = (id, x, z, r, h) =>
    pieces.push({
      id,
      type: "rock",
      center: [x, surfaceMm(x, z) / 1000 + h * 0.43, z],
      size: [r, h, r * 0.8],
      color: stone,
    });
  for (const [i, [x, z, r, h]] of [
    [575, 675, 12, 15],
    [705, 735, 17, 23],
    [600, 770, 9, 11],
    [725, 630, 22, 18],
    [530, 810, 16, 20],
  ].entries())
    rock(`valley-erratic-${i}`, x, z, r, h);
  // Three road terraces on different levels, joined visually by two long ramps.
  for (let i = 0; i < 3; i++) {
    const z = 650 + i * 22,
      top = 266 + i * 7;
    const bottom =
      Math.min(...[1610, 1700, 1790].map((x) => surfaceMm(x, z) / 1000)) - 1;
    box(
      `pass-retaining-${i}`,
      [1700, (top + bottom) / 2, z],
      [180, top - bottom, 3],
      stone,
    );
    box(`pass-road-${i}`, [1700, top, z - 7], [180, 1, 12], dark);
    for (const x of [1612, 1788])
      post(`pass-post-${i}-${x}`, x, z - 12, top + 2, 0.6, concrete);
  }
  for (let i = 0; i < 2; i++)
    pieces.push({
      id: `pass-ramp-${i}`,
      type: "box",
      center: [i === 0 ? 1780 : 1620, 269.5 + i * 7, 654 + i * 22],
      size: [12, 1, Math.hypot(22, 7)],
      rotationX: -Math.atan2(7, 22),
      color: dark,
    });
  // Paired natural towers, deliberately unequal in height and silhouette.
  rock("saddle-west-spire", 2964, 760, 20, 58);
  rock("saddle-east-buttress", 3044, 814, 32, 37);
  rock("saddle-outcrop", 2978, 890, 17, 22);
  // Two station wings leave an open concourse; a separate observation tower overlooks the ridge.
  for (const side of [-1, 1]) {
    const z = 3100 + side * 32;
    box(`station-wing-${side}`, [3400, 567, z], [94, 14, 25], timber);
    box(`station-roof-${side}`, [3400, 575, z], [104, 2, 31], red);
    for (const x of [3350, 3450])
      post(`station-porch-${side}-${x}`, x, z - side * 20, 574, 1.5, timber);
  }
  for (const x of [3480, 3510])
    for (const z of [3170, 3200])
      post(`lookout-leg-${x}-${z}`, x, z, 610, 3, timber);
  box("lookout-deck", [3495, 600, 3185], [38, 2, 38], timber);
  box("lookout-roof", [3495, 610, 3185], [43, 2, 43], red);
  for (const [i, x] of [3310, 3250, 3190].entries()) {
    post(`cable-pylon-${i}`, x, 3155, 580 - i * 9, 2, dark);
    box(`cable-crosshead-${i}`, [x, 580 - i * 9, 3155], [12, 2, 3], dark);
  }
  // A long bridge with seven unequal grounded piers; centre bay remains a clear flight opening.
  for (const x of [2240, 2290, 2340, 2460, 2510, 2560]) {
    post(`viaduct-pier-${x}`, x, 3070, 240, 6, concrete);
    box(`viaduct-cap-${x}`, [x, 240, 3070], [10, 3, 22], concrete);
  }
  box("viaduct-deck", [2400, 244, 3070], [350, 4, 18], concrete);
  for (const z of [3061, 3079])
    box(`viaduct-parapet-${z}`, [2400, 247, z], [350, 2, 1], stone);
  // Dam consists of separated thick faces, leaving a visible, traversable central spillway.
  for (const side of [-1, 1]) {
    box(
      `dam-face-${side}`,
      [800 + side * 63, 184, 2840],
      [94, 28, 12],
      concrete,
    );
    box(
      `dam-gallery-${side}`,
      [800 + side * 63, 200, 2840],
      [100, 3, 18],
      stone,
    );
    for (let i = 0; i < 4; i++)
      box(
        `dam-buttress-${side}-${i}`,
        [800 + side * (25 + i * 22), 180, 2855],
        [8, 20, 24],
        concrete,
      );
  }
  return pieces;
}
export const landmarks = architecture()
  .filter((p) => /spire|buttress|deck|roof|retaining|face/.test(p.id))
  .map((p) => ({ id: p.id, position: p.center }));
export const solidProbes = [
  {
    id: "station-wall",
    from: [3346, 567, 3068],
    to: [3360, 567, 3068],
    halfWidth: 1,
  },
  {
    id: "dam-face",
    from: [730, 184, 2800],
    to: [730, 184, 2860],
    halfWidth: 1,
  },
];
export const compositionSupports = [
  { id: "viaduct-road", position: [2400, 249, 3070], height: 246 },
  { id: "summit-roof", position: [3400, 580, 3068], height: 576 },
];
