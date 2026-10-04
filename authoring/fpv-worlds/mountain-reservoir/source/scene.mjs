// Original Reservoir checkpoint geometry. No downloaded meshes, textures or runtime changes.
// Coordinates are glTF metres; course geometry converts the same source to integer millimetres.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { encodeWorldGLB } from '../../../../optional-practice/civilian-fpv/world-content.mjs';
import { mineralPNG, noise } from './mineral.mjs';
import { grassPNG, gravelPNG } from './ground-maps.mjs';
import { addReservoirEngineering } from './engineering.mjs';

const xyz = (a) => Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, Math.round(a[i] * 1000)]));
export const bounds = { min: xyz([-44, 0, -34]), max: xyz([6, 28, 38]) };
export const spawn = xyz([-30, 0.45, 26]);
const boxes = [],
  terrains = [],
  batches = new Map();
const paints = [
  ['mineral-ridge', '#ffffff', 1],
  ['fir-dark', '#304329', 1],
  ['fir-light', '#536640', 1],
  ['tree-bark', '#554635', 1],
  ['reservoir-water', '#ffffff', 0.23],
  ['water-current', '#6fb2b2', 0.35],
  ['chalk-enamel', '#e5dfbe', 0.8],
  ['oxidized-roof', '#577d76', 0.82],
  ['blue-enamel', '#306a87', 0.65],
  ['safety-yellow', '#d6ab48', 0.8],
  ['closed-window', '#27454e', 0.65],
  ['warm-gravel', '#aa9c79', 1],
  ['shore-meadow', '#ffffff', 1],
];
function add(shape, role, at = [0, 0, 0], rotate = [0, 0, 0]) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...at),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotate)),
    new THREE.Vector3(1, 1, 1),
  );
  let flat = shape.index ? shape.toNonIndexed() : shape.clone();
  shape.dispose();
  flat.applyMatrix4(matrix);
  if (!flat.attributes.normal) flat.computeVertexNormals();
  const batch = batches.get(role) ?? { positions: [], normals: [], uvs: [], colors: [] };
  batch.positions.push(...flat.attributes.position.array);
  batch.normals.push(...flat.attributes.normal.array);
  const positions = flat.attributes.position.array,
    normals = flat.attributes.normal.array,
    rock = new THREE.Color('#85918f'),
    groundCover = new THREE.Color('#647441'),
    waterDeep = new THREE.Color('#376f76'),
    waterShallow = new THREE.Color('#739a8d');
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = positions.slice(i, i + 3),
      ny = normals[i + 1],
      moss = Math.min(1, Math.max(0, ny - 0.62) * 4) * (0.35 + 0.65 * noise(x / 11, z / 11)),
      variation = 0.82 + 0.18 * noise(x / 3.1, z / 3.1),
      triangle = Math.floor(i / 9) * 9,
      a = new THREE.Vector3(...positions.slice(triangle, triangle + 3)),
      b = new THREE.Vector3(...positions.slice(triangle + 3, triangle + 6)).sub(a),
      c = new THREE.Vector3(...positions.slice(triangle + 6, triangle + 9)).sub(a),
      face = b.cross(c),
      ax = Math.abs(face.x),
      ay = Math.abs(face.y),
      az = Math.abs(face.z);
    // Choose one projection for the whole triangle. Per-vertex axis changes
    // folded r2 UVs through faces and caused the rejected vertical bank strips.
    batch.uvs.push((ax > ay && ax > az ? z : x) / 4, (ay >= ax && ay >= az ? z : y) / 4);
    const color =
      role === 'mineral-ridge'
        ? rock.clone().lerp(groundCover, moss).multiplyScalar(variation)
        : new THREE.Color().setRGB(variation, variation, variation);
    if (role === 'shore-meadow')
      color.copy(groundCover).multiplyScalar(0.8 + noise(x / 9, z / 9) * 0.28);
    if (role === 'reservoir-water') {
      const bankDistance = Math.max(
        0,
        Math.min(x - shoreLeft(z), shoreRight(z) - x, z + 25, shoreSouth(x) - z),
      );
      color.copy(waterShallow).lerp(waterDeep, Math.min(1, bankDistance / 7));
      color.multiplyScalar(0.96 + 0.04 * noise(x / 4, z / 4));
    }
    batch.colors.push(color.r, color.g, color.b);
  }
  batches.set(role, batch);
  flat.dispose();
}
const detailBox = (role, size, at, rotate) => add(new THREE.BoxGeometry(...size), role, at, rotate);
function solid(id, min, max, rotation) {
  boxes.push({ id, min: xyz(min), max: xyz(max), ...(rotation ? { rotation } : {}) });
}
function prism(id, footprint, height, bottom = 0) {
  const vertices = [
    ...footprint.map(([x, z]) => [x, bottom, z]),
    ...footprint.map(([x, z]) => [x, height, z]),
  ].flat();
  const n = footprint.length,
    indices = [];
  for (let i = 1; i < n - 1; i++) indices.push(n, n + i + 1, n + i, 0, i, i + 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, j, n + i, j, n + j, n + i);
  }
  terrains.push({
    id,
    type: 'trimesh',
    vertices: vertices.map((v) => Math.round(v * 1000)),
    indices,
  });
}

// Exposed flight solids are rendered by the existing course renderer, never duplicated in GLB.
prism(
  'rock-west-lower',
  [
    [-44, -24],
    [-36, -27],
    [-31, -22],
    [-32, -10],
    [-29, -5],
    [-33, 8],
    [-44, 13],
  ],
  2.7,
);
prism(
  'rock-west-middle',
  [
    [-44, -24],
    [-39, -25],
    [-35, -21],
    [-36, -10],
    [-33, -6],
    [-37, 5],
    [-44, 9],
  ],
  5.6,
  2.7,
);
prism(
  'rock-west-upper',
  [
    [-44, -21],
    [-41, -22],
    [-38, -18],
    [-39, -9],
    [-36, -5],
    [-39, 2],
    [-44, 5],
  ],
  8.5,
  5.6,
);
prism(
  'rock-north-shoulder',
  [
    [-27, -34],
    [-13, -34],
    [-10, -29],
    [-13, -23],
    [-22, -25],
    [-28, -29],
  ],
  4.1,
);
prism(
  'rock-north-terrace',
  [
    [-24, -34],
    [-16, -34],
    [-14, -30],
    [-18, -27],
    [-25, -29],
  ],
  6.8,
  4.1,
);
solid('platform-shore-pad', [-34, 0, 22], [-26, 0.45, 30]);
solid('building-maintenance', [-26, 0, -19], [-18, 4.2, -11]);
solid('building-maintenance-roof', [-26.3, 4.2, -19.3], [-17.7, 4.45, -10.7]);
// Dam rises along the north water edge. The same solid and paint serve later routes.
solid('platform-dam', [-8, 0, -32], [49, 9.5, -25]);
solid('platform-dam-crest', [-8, 9.5, -29.8], [49, 9.85, -26]);
for (let z = -32; z <= 36; z += 4)
  solid(`rail-shore-post-${z + 32}`, [5.45, 0, z - 0.1], [5.65, 1.2, z + 0.1]);
solid('rail-shore-low', [5.49, 0.48, -32], [5.61, 0.59, 36]);
solid('rail-shore-high', [5.49, 1.05, -32], [5.61, 1.16, 36]);
for (const [i, x, z] of [
  [0, -35, 21],
  [1, -25, 21],
  [2, -35, 31],
  [3, -25, 31],
])
  solid(`platform-pad-bollard-${i}`, [x - 0.2, 0, z - 0.2], [x + 0.2, 0.8, z + 0.2]);

// Thin opaque paint is attached outside canonical closed faces. It never suggests an opening.
for (const z of [-16.8, -13.4]) {
  detailBox('closed-window', [0.025, 1.3, 1.8], [-17.98, 2.75, z]);
  for (const dz of [-0.98, 0.98])
    detailBox('chalk-enamel', [0.05, 1.55, 0.12], [-17.955, 2.75, z + dz]);
  for (const y of [2, 3.5]) detailBox('chalk-enamel', [0.05, 0.12, 2.08], [-17.95, y, z]);
}
detailBox('blue-enamel', [1.65, 2.45, 0.035], [-22, 1.225, -10.98]);
detailBox('safety-yellow', [1.75, 0.1, 0.045], [-22, 2.5, -10.96]);
detailBox('oxidized-roof', [8.68, 0.07, 8.68], [-22, 4.49, -15]);
for (let x = -26; x < -17.8; x += 0.45)
  detailBox('chalk-enamel', [0.04, 0.028, 8.5], [x, 4.54, -15]);
// Landing pad H and corner marks are flush and do not change support geometry.
for (const x of [-31, -29]) detailBox('chalk-enamel', [0.24, 0.016, 3], [x, 0.463, 26]);
detailBox('chalk-enamel', [2, 0.016, 0.24], [-30, 0.464, 26]);
for (const x of [-33.65, -26.35]) detailBox('safety-yellow', [0.2, 0.015, 7.3], [x, 0.462, 26]);
for (const z of [22.35, 29.65]) detailBox('safety-yellow', [7.3, 0.015, 0.2], [-30, 0.462, z]);
// Repeated narrow joints describe construction bays on the solid dam, not flight gaps.
for (let x = -7; x < 49; x += 5.5)
  detailBox('oxidized-roof', [0.08, 9.2, 0.026], [x, 4.6, -24.982]);
for (let x = -6; x < 48; x += 4) {
  detailBox('safety-yellow', [0.55, 0.23, 0.028], [x, 8.9, -24.965]);
  detailBox('blue-enamel', [0.55, 0.23, 0.028], [x + 0.55, 8.9, -24.965]);
}
// Inspection rail visibly identifies the first route's water-side edge.
for (let z = -30; z < 36; z += 4) detailBox('safety-yellow', [0.028, 0.24, 0.55], [5.428, 0.86, z]);
// Flush meadow pigment over the existing flat support: no new elevation or
// collision. The gravel inspection paths and concrete pad remain distinct.
const meadow = new THREE.PlaneGeometry(50, 72, 10, 12);
meadow.rotateX(-Math.PI / 2);
add(meadow, 'shore-meadow', [-19, 0.007, 2]);
detailBox('warm-gravel', [13, 0.003, 12], [-22, 0.012, -15]);
const pathPositions = [];
for (let z = -9; z < 23; z += 2) {
  const centre = (v) => -22 - smooth((v + 9) / 32) * 8,
    a = [centre(z) - 1.65, 0.012, z],
    b = [centre(z) + 1.65, 0.012, z],
    c = [centre(z + 2) - 1.65, 0.012, z + 2],
    d = [centre(z + 2) + 1.65, 0.012, z + 2];
  pathPositions.push(...a, ...c, ...b, ...b, ...c, ...d);
}
const servicePath = new THREE.BufferGeometry();
servicePath.setAttribute('position', new THREE.Float32BufferAttribute(pathPositions, 3));
add(servicePath, 'warm-gravel');

// A connected heightfield encloses an irregular lake. All raised imported
// ground remains outside the first course, where it cannot fake a collision surface.
const shoreLeft = (z) => 8.8 + 0.65 * Math.sin(z * 0.18) + noise(z * 0.27, 3) * 1.8;
const shoreRight = (z) => 44 + 3.8 * Math.sin(z * 0.095) + noise(z * 0.23, 9) * 4;
const shoreSouth = (x) => 39 + 2.2 * Math.sin(x * 0.14) + noise(x * 0.3, 7) * 2;
function smooth(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
const hill = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2) - ((z - cz) / rz) ** 2);
function groundHeight(x, z) {
  const shoreDistance = Math.max(shoreLeft(z) - x, x - shoreRight(z), -25 - z, z - shoreSouth(x));
  if (shoreDistance < 0) return -0.35;
  const ridge =
    6 +
    19 * hill(x, z, 67, 8, 23, 35) +
    24 * hill(x, z, 44, -57, 24, 20) +
    29 * hill(x, z, -15, -63, 31, 19) +
    23 * hill(x, z, -68, -42, 22, 27) +
    17 * hill(x, z, -66, 12, 18, 32) +
    3 * noise(x / 9, z / 9) +
    1.1 * noise(x / 2.4, z / 2.4);
  const distanceFromFlight = Math.max(-44 - x, x - 6, -34 - z, z - 38, 0);
  let edge = 0;
  if (x <= -44 && z >= -24 && z <= 13) edge = z >= -21 && z <= 5 ? 8.5 : z <= 9 ? 5.6 : 2.7;
  if (z <= -34 && x >= -27 && x <= -13) edge = x >= -24 && x <= -16 ? 6.8 : 4.1;
  const bank = 0.11 + ridge * smooth(shoreDistance / 17);
  return edge + (bank - edge) * smooth(distanceFromFlight / 8);
}
const axis = (min, max, boundaries) =>
  [
    ...new Set([
      ...Array.from({ length: Math.ceil((max - min) / 3) + 1 }, (_, i) =>
        Math.min(max, min + i * 3),
      ),
      ...boundaries,
    ]),
  ].sort((a, b) => a - b);
const xs = axis(-86, 90, [-44, 6]),
  zs = axis(-82, 66, [-34, 38]),
  terrainPositions = [],
  terrainIndices = [];
for (const z of zs) for (const x of xs) terrainPositions.push(x, groundHeight(x, z), z);
for (let iz = 0; iz < zs.length - 1; iz++) {
  for (let ix = 0; ix < xs.length - 1; ix++) {
    const x = (xs[ix] + xs[ix + 1]) / 2,
      z = (zs[iz] + zs[iz + 1]) / 2;
    if (x > -44 && x < 6 && z > -34 && z < 38) continue;
    const a = iz * xs.length + ix,
      b = a + 1,
      c = a + xs.length,
      d = c + 1;
    terrainIndices.push(a, c, b, b, c, d);
  }
}
const terrain = new THREE.BufferGeometry();
terrain.setAttribute('position', new THREE.Float32BufferAttribute(terrainPositions, 3));
terrain.setIndex(terrainIndices);
terrain.computeVertexNormals();
add(terrain, 'mineral-ridge');
let terrainStitched = false;
export function includeTerrainStitching() {
  if (terrainStitched) throw Error('Terrain boundary already stitched');
  const positions = [];
  const skirt = (a, b, north) => {
    const bottomA = [a[0], 0, a[2]],
      bottomB = [b[0], 0, b[2]];
    // The decorative heightfield interpolates between discrete terrace levels,
    // exposing its open underside. Close that edge on the existing unreachable
    // world boundary. Playable geometry and every original top triangle stay exact.
    if (a[1] > 0) positions.push(...a, ...(north ? bottomA : b), ...(north ? b : bottomA));
    if (b[1] > 0)
      positions.push(...b, ...(north ? bottomA : bottomB), ...(north ? bottomB : bottomA));
  };
  for (let i = 0; i < zs.length - 1; i++) {
    if (zs[i] < -34 || zs[i + 1] > 38) continue;
    skirt(
      [-44, groundHeight(-44, zs[i]), zs[i]],
      [-44, groundHeight(-44, zs[i + 1]), zs[i + 1]],
      false,
    );
  }
  for (let i = 0; i < xs.length - 1; i++) {
    if (xs[i] < -44 || xs[i + 1] > 6) continue;
    skirt(
      [xs[i], groundHeight(xs[i], -34), -34],
      [xs[i + 1], groundHeight(xs[i + 1], -34), -34],
      true,
    );
  }
  const closure = new THREE.BufferGeometry();
  closure.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  add(closure, 'mineral-ridge');
  terrainStitched = true;
  return { triangles: positions.length / 9, positions };
}
function surfaceHeight(x, z) {
  const ix = xs.findIndex((v, i) => x >= v && x <= xs[i + 1]),
    iz = zs.findIndex((v, i) => z >= v && z <= zs[i + 1]),
    u = (x - xs[ix]) / (xs[ix + 1] - xs[ix]),
    v = (z - zs[iz]) / (zs[iz + 1] - zs[iz]),
    a = groundHeight(xs[ix], zs[iz]),
    b = groundHeight(xs[ix + 1], zs[iz]),
    c = groundHeight(xs[ix], zs[iz + 1]),
    d = groundHeight(xs[ix + 1], zs[iz + 1]);
  return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
// The bank mesh covers this plane outside the irregular shoreline. Its lower
// bed is hidden below the opaque water, leaving no dangling ridge or shore gap.
const water = new THREE.PlaneGeometry(50, 72, 12, 16);
water.rotateX(-Math.PI / 2);
add(water, 'reservoir-water', [33, 0.22, 9]);
for (let i = 0; i < 25; i++) {
  const x = 12 + ((i * 13) % 29),
    z = -21 + ((i * 17) % 55);
  detailBox(
    'water-current',
    [0.7 + (i % 5) * 0.3, 0.006, 0.04],
    [x, 0.23, z],
    [0, ((i % 4) - 2) * 0.11, 0],
  );
}
// Mixed clusters have open trunks, uneven fir tiers and rounder deciduous crowns.
// Every root is placed on the exact rendered terrain, outside the flight boundary.
for (let i = 0; i < 56; i++) {
  const cluster = [
      [58, 17],
      [64, -9],
      [37, -46],
      [-6, -49],
      [-60, 3],
      [-60, -30],
    ][i % 6],
    x = cluster[0] + Math.sin(i * 2.4) * (2 + (i % 6)),
    z = cluster[1] + Math.cos(i * 1.7) * (2 + (i % 5)),
    base = surfaceHeight(x, z) - 0.1,
    h = 3.8 + (i % 9) * 0.43;
  add(new THREE.CylinderGeometry(0.09, 0.18, h * 0.74, 5), 'tree-bark', [x, base + h * 0.37, z]);
  if (i % 3) {
    for (let k = 0; k < 3; k++) {
      const shape = new THREE.ConeGeometry((1.45 - k * 0.3) * (h / 6), h * 0.39, 7);
      shape.scale(1, 1, 0.78 + (i % 4) * 0.09);
      add(
        shape,
        k === 2 && i % 2 ? 'fir-light' : 'fir-dark',
        [x + Math.sin(i + k) * 0.12, base + h * (0.45 + k * 0.18), z + Math.cos(i + k) * 0.12],
        [0, i * 0.73 + k * 0.4, 0],
      );
    }
  } else {
    for (let k = 0; k < 3; k++) {
      const shape = new THREE.IcosahedronGeometry(1, 0);
      shape.scale(h * (0.2 - k * 0.024), h * 0.23, h * 0.19);
      add(
        shape,
        k % 2 ? 'fir-dark' : 'fir-light',
        [
          x + Math.sin(i + k * 2) * h * 0.1,
          base + h * (0.55 + k * 0.12),
          z + Math.cos(i + k * 2) * h * 0.1,
        ],
        [0.13 * k, i * 0.57, 0.08 * k],
      );
    }
  }
}
// Irregular low outcrops break the smooth bank into geological shelves.
// These are embedded scenery, all east of the marked course boundary.
for (let i = 0; i < 10; i++) {
  const z = -21 + i * 5.7,
    x = shoreRight(z) + 2.5 + (i % 3),
    base = surfaceHeight(x, z);
  for (let layer = 0; layer < 2; layer++) {
    const shape = new THREE.IcosahedronGeometry(1, 0),
      p = shape.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const scale = 0.88 + 0.24 * noise(p.getX(j) * 3 + i, p.getZ(j) * 3 + layer);
      p.setXYZ(
        j,
        p.getX(j) * scale * (2.2 - layer * 0.55),
        p.getY(j) * (0.6 - layer * 0.12),
        p.getZ(j) * scale * 1.35,
      );
    }
    shape.computeVertexNormals();
    add(
      shape,
      'mineral-ridge',
      [x + layer * 0.25, base + layer * 0.5 - 0.12, z],
      [0.12, i * 1.73, -0.07],
    );
  }
}
// Flush irregular gravel apron gives the existing flat support a readable scale.
const gravelPositions = [];
for (let z = -30; z < 36; z += 2) {
  const inner = (v) => 0.6 + noise(v * 0.16, 11) * 2.3,
    outer = 5.35,
    a = [inner(z), 0.012, z],
    b = [outer, 0.012, z],
    c = [inner(z + 2), 0.012, z + 2],
    d = [outer, 0.012, z + 2];
  gravelPositions.push(...a, ...c, ...b, ...b, ...c, ...d);
}
const gravel = new THREE.BufferGeometry();
gravel.setAttribute('position', new THREE.Float32BufferAttribute(gravelPositions, 3));
add(gravel, 'warm-gravel');

export const obstacles = [...terrains, ...boxes];
let engineeringAdded = false;
export function includeLandEngineering() {
  if (engineeringAdded) throw Error('Land engineering already included');
  addReservoirEngineering({ solid, detailBox });
  obstacles.splice(0, obstacles.length, ...terrains, ...boxes);
  engineeringAdded = true;
}
export const anchors = [
  { id: 'shore-pad', kind: 'spawn', position: [-30, 0.45, 26] },
  { id: 'shore-lookout-south', kind: 'checkpoint', position: [-10, 5, 15], order: 1 },
  { id: 'shore-lookout-north', kind: 'checkpoint', position: [-10, 7, -12], order: 2 },
  { id: 'shore-return', kind: 'landing', position: [-30, 0.45, 26], order: 3 },
];

export function createScene({ groundMaterials = false } = {}) {
  const document = {
    asset: {
      version: '2.0',
      generator:
        'RevealLine original Mountain Reservoir source ' +
        (groundMaterials
          ? 'r11-ground-material-candidate'
          : terrainStitched
            ? 'r9-terrain-stitching-candidate'
            : engineeringAdded
              ? 'r7'
              : 'r4'),
    },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }],
  };
  const pieces = [];
  let offset = 0,
    triangles = 0;
  function attribute(values, type, componentType = 5126) {
    const data =
        componentType === 5121
          ? new Uint8Array(values.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)))
          : new Float32Array(values),
      bytes = new Uint8Array(data.buffer);
    const view =
      document.bufferViews.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: bytes.length,
        target: 34962,
      }) - 1;
    pieces.push(bytes);
    offset += bytes.length;
    const accessor = {
      bufferView: view,
      componentType,
      count: values.length / { VEC2: 2, VEC3: 3, VEC4: 4 }[type],
      type,
      ...(componentType === 5121 ? { normalized: true } : {}),
    };
    if (type === 'VEC3' && componentType !== 5121) {
      accessor.min = [0, 1, 2].map((k) => Math.min(...values.filter((_, i) => i % 3 === k)));
      accessor.max = [0, 1, 2].map((k) => Math.max(...values.filter((_, i) => i % 3 === k)));
    }
    return document.accessors.push(accessor) - 1;
  }
  for (const [role, batch] of batches) {
    const definition = paints.find(([id]) => id === role),
      color = new THREE.Color(definition[1]),
      textured = role === 'mineral-ridge' || role === 'warm-gravel' || role === 'shore-meadow',
      colored = textured || role === 'reservoir-water';
    const material =
      document.materials.push({
        name: role,
        pbrMetallicRoughness: {
          baseColorFactor: [color.r, color.g, color.b, 1],
          metallicFactor: role === 'reservoir-water' ? 0.15 : 0,
          roughnessFactor: definition[2],
          ...(textured
            ? {
                baseColorTexture: {
                  index: groundMaterials
                    ? role === 'shore-meadow'
                      ? 1
                      : role === 'warm-gravel'
                        ? 2
                        : 0
                    : 0,
                },
              }
            : {}),
        },
      }) - 1;
    const mesh =
      document.meshes.push({
        name: role,
        primitives: [
          {
            attributes: {
              POSITION: attribute(batch.positions, 'VEC3'),
              NORMAL: attribute(batch.normals, 'VEC3'),
              ...(textured
                ? {
                    TEXCOORD_0: attribute(
                      groundMaterials && role === 'shore-meadow'
                        ? batch.uvs.map((v) => (v * 4) / 1.5)
                        : groundMaterials && role === 'warm-gravel'
                          ? batch.uvs.map((v) => (v * 4) / 0.75)
                          : batch.uvs,
                      'VEC2',
                    ),
                  }
                : {}),
              ...(colored
                ? {
                    COLOR_0: attribute(
                      batch.colors.flatMap((v, i) => (i % 3 === 2 ? [v, 1] : [v])),
                      'VEC4',
                      5121,
                    ),
                  }
                : {}),
            },
            material,
          },
        ],
      }) - 1;
    document.scenes[0].nodes.push(document.nodes.push({ name: role, mesh }) - 1);
    triangles += batch.positions.length / 9;
  }
  for (const { position, ...semantics } of anchors)
    document.scenes[0].nodes.push(
      document.nodes.push({
        name: semantics.id,
        translation: position,
        extras: { rl: semantics },
      }) - 1,
    );
  for (const box of boxes) {
    const size = ['x', 'y', 'z'].map((k) => (box.max[k] - box.min[k]) / 1000),
      translation = ['x', 'y', 'z'].map((k) => (box.max[k] + box.min[k]) / 2000);
    document.scenes[0].nodes.push(
      document.nodes.push({
        name: box.id,
        translation,
        ...(box.rotation ? { rotation: box.rotation } : {}),
        extras: { rl: { id: box.id, kind: 'collider', size } },
      }) - 1,
    );
  }
  document.images = [];
  const images = [['original-mineral-grain-256', mineralPNG()]];
  if (groundMaterials)
    images.push(['original-short-grass-128', grassPNG()], ['original-gravel-128', gravelPNG()]);
  if (groundMaterials && images[1][1].length + images[2][1].length > 48 * 1024)
    throw Error('Ground image authoring budget exceeded');
  for (const [name, texture] of images) {
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      pieces.push(new Uint8Array(padding));
      offset += padding;
    }
    const imageView =
      document.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: texture.length }) - 1;
    pieces.push(texture);
    offset += texture.length;
    document.images.push({ name, mimeType: 'image/png', bufferView: imageView });
  }
  document.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  document.textures = document.images.map((_, source) => ({ sampler: 0, source }));
  document.buffers[0].byteLength = offset;
  const binary = new Uint8Array(offset);
  let position = 0;
  for (const bytes of pieces) {
    binary.set(bytes, position);
    position += bytes.length;
  }
  return {
    bytes: encodeWorldGLB(document, binary),
    statistics: {
      triangles,
      materials: document.materials.length,
      nodes: document.nodes.length,
      textures: document.textures.length,
      colliders: obstacles.length,
      collisionTriangles: terrains.reduce((n, o) => n + o.indices.length / 3, 0),
    },
  };
}
