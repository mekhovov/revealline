// Original Reservoir checkpoint geometry. No downloaded meshes, textures or runtime changes.
// Coordinates are glTF metres; course geometry converts the same source to integer millimetres.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { encodeWorldGLB } from '../../../../optional-practice/civilian-fpv/world-content.mjs';
import { mineralPNG, noise } from './mineral.mjs';

const xyz = (a) => Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, Math.round(a[i] * 1000)]));
export const bounds = { min: xyz([-44, 0, -34]), max: xyz([6, 28, 38]) };
export const spawn = xyz([-30, 0.45, 26]);
const boxes = [],
  terrains = [],
  batches = new Map();
const paints = [
  ['mineral-ridge', '#b8b8a7', 1],
  ['fir-dark', '#244f46', 1],
  ['fir-light', '#3e6953', 1],
  ['reservoir-water', '#3e969c', 0.23],
  ['water-current', '#6fb2b2', 0.35],
  ['chalk-enamel', '#e5dfbe', 0.8],
  ['oxidized-roof', '#577d76', 0.82],
  ['blue-enamel', '#306a87', 0.65],
  ['safety-yellow', '#d6ab48', 0.8],
  ['closed-window', '#27454e', 0.65],
  ['warm-gravel', '#aa9c79', 1],
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
    normals = flat.attributes.normal.array;
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = positions.slice(i, i + 3),
      [nx, ny, nz] = normals.slice(i, i + 3),
      moss = Math.min(0.7, Math.max(0, ny - 0.6) * 2.5 * noise(x / 7, z / 7)),
      variation = Math.min(
        1,
        0.84 + 0.16 * noise(x / 3.1, z / 3.1) + 0.04 * noise(y * 1.2, x * 0.2),
      );
    // Metre-scale dominant-face projection retains grain on steep rock faces.
    batch.uvs.push((Math.abs(nx) > Math.abs(nz) ? z : x) / 4, (Math.abs(ny) > 0.65 ? z : y) / 4);
    batch.colors.push(variation - moss * 0.32, variation - moss * 0.12, variation - moss * 0.36);
  }
  batches.set(role, batch);
  flat.dispose();
}
const detailBox = (role, size, at, rotate) => add(new THREE.BoxGeometry(...size), role, at, rotate);
function solid(id, min, max) {
  boxes.push({ id, min: xyz(min), max: xyz(max) });
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
solid('building-maintenance', [-40, 0, -17], [-32, 4.2, -9]);
prism(
  'building-maintenance-roof',
  [
    [-40.3, -17.3],
    [-31.7, -17.3],
    [-31.7, -8.7],
    [-40.3, -8.7],
  ],
  4.45,
  4.2,
);
// Dam rises along the north water edge. The same solid and paint serve later routes.
prism(
  'platform-dam',
  [
    [-8, -32],
    [49, -32],
    [49, -25],
    [-8, -25],
  ],
  9.5,
);
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
for (const z of [-14.8, -11.4]) {
  detailBox('closed-window', [0.025, 1.3, 1.8], [-31.98, 2.75, z]);
  for (const dz of [-0.98, 0.98])
    detailBox('chalk-enamel', [0.05, 1.55, 0.12], [-31.955, 2.75, z + dz]);
  for (const y of [2, 3.5]) detailBox('chalk-enamel', [0.05, 0.12, 2.08], [-31.95, y, z]);
}
detailBox('blue-enamel', [1.65, 2.45, 0.035], [-36, 1.225, -8.98]);
detailBox('safety-yellow', [1.75, 0.1, 0.045], [-36, 2.5, -8.96]);
detailBox('oxidized-roof', [8.68, 0.07, 8.68], [-36, 4.49, -13]);
for (let x = -40; x < -31.8; x += 0.45)
  detailBox('chalk-enamel', [0.04, 0.028, 8.5], [x, 4.54, -13]);
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

// A connected heightfield encloses an irregular lake. All raised imported
// ground remains outside the first course, where it cannot fake a collision surface.
const shoreLeft = (z) => 8.8 + 0.65 * Math.sin(z * 0.18) + noise(z * 0.27, 3) * 1.8;
const shoreRight = (z) => 44 + 3.8 * Math.sin(z * 0.095) + noise(z * 0.23, 9) * 4;
const shoreSouth = (x) => 39 + 2.2 * Math.sin(x * 0.14) + noise(x * 0.3, 7) * 2;
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
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
const water = new THREE.PlaneGeometry(50, 72);
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
// Grounded conifer clusters supply familiar scale without another mesh owner.
for (let i = 0; i < 48; i++) {
  const cluster = [
      [58, 17],
      [64, -9],
      [37, -46],
      [-6, -49],
      [-60, 3],
      [-60, -30],
    ][i % 6],
    x = cluster[0] + Math.sin(i * 2.4) * (3 + (i % 8)),
    z = cluster[1] + Math.cos(i * 1.7) * (3 + (i % 7)),
    base = surfaceHeight(x, z) - 0.1,
    h = 3.2 + (i % 7) * 0.42;
  add(new THREE.CylinderGeometry(0.12, 0.2, h * 0.65, 5), 'mineral-ridge', [
    x,
    base + h * 0.325,
    z,
  ]);
  for (let k = 0; k < 2; k++)
    add(new THREE.ConeGeometry(1.25 - k * 0.3, h * 0.64, 7), i % 3 ? 'fir-dark' : 'fir-light', [
      x,
      base + h * (0.43 + k * 0.23),
      z,
    ]);
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
export const anchors = [
  { id: 'shore-pad', kind: 'spawn', position: [-30, 0.45, 26] },
  { id: 'shore-lookout-south', kind: 'checkpoint', position: [-10, 5, 15], order: 1 },
  { id: 'shore-lookout-north', kind: 'checkpoint', position: [-10, 7, -12], order: 2 },
  { id: 'shore-return', kind: 'landing', position: [-30, 0.45, 26], order: 3 },
];

export function createScene() {
  const document = {
    asset: { version: '2.0', generator: 'RevealLine original Mountain Reservoir source r2' },
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
    const data = new Float32Array(values),
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
      count: values.length / (type === 'VEC2' ? 2 : 3),
      type,
    };
    if (type === 'VEC3') {
      accessor.min = [0, 1, 2].map((k) => Math.min(...values.filter((_, i) => i % 3 === k)));
      accessor.max = [0, 1, 2].map((k) => Math.max(...values.filter((_, i) => i % 3 === k)));
    }
    return document.accessors.push(accessor) - 1;
  }
  for (const [role, batch] of batches) {
    const definition = paints.find(([id]) => id === role),
      color = new THREE.Color(definition[1]),
      textured = role === 'mineral-ridge' || role === 'warm-gravel';
    const material =
      document.materials.push({
        name: role,
        pbrMetallicRoughness: {
          baseColorFactor: [color.r, color.g, color.b, 1],
          metallicFactor: role === 'reservoir-water' ? 0.15 : 0,
          roughnessFactor: definition[2],
          ...(textured ? { baseColorTexture: { index: 0 } } : {}),
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
                    TEXCOORD_0: attribute(batch.uvs, 'VEC2'),
                    COLOR_0: attribute(batch.colors, 'VEC3'),
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
        extras: { rl: { id: box.id, kind: 'collider', size } },
      }) - 1,
    );
  }
  const texture = mineralPNG(),
    imageView =
      document.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: texture.length }) - 1;
  pieces.push(texture);
  offset += texture.length;
  document.images = [
    { name: 'original-mineral-grain-256', mimeType: 'image/png', bufferView: imageView },
  ];
  document.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  document.textures = [{ sampler: 0, source: 0 }];
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
      textures: 1,
      colliders: obstacles.length,
      collisionTriangles: terrains.reduce((n, o) => n + o.indices.length / 3, 0),
    },
  };
}
