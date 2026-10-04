// Original Reservoir checkpoint geometry. No downloaded meshes, textures or runtime changes.
// Coordinates are glTF metres; course geometry converts the same source to integer millimetres.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { encodeWorldGLB } from '../../../../optional-practice/civilian-fpv/world-content.mjs';

const xyz = (a) => Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, Math.round(a[i] * 1000)]));
export const bounds = { min: xyz([-44, 0, -34]), max: xyz([6, 28, 38]) };
export const spawn = xyz([-30, 0.45, 26]);
const boxes = [],
  terrains = [],
  batches = new Map();
const paints = [
  ['mineral-ridge', '#697b7a', 1],
  ['distant-ridge', '#789191', 1],
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
  const batch = batches.get(role) ?? { positions: [], normals: [] };
  batch.positions.push(...flat.attributes.position.array);
  batch.normals.push(...flat.attributes.normal.array);
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

// Reservoir and mountains are scenery beyond course 01's marked eastern boundary.
const water = new THREE.PlaneGeometry(42, 68, 12, 16);
water.rotateX(-Math.PI / 2);
add(water, 'reservoir-water', [29, 0.22, 8]);
for (let i = 0; i < 32; i++) {
  const x = 10 + ((i * 13) % 37),
    z = -21 + ((i * 17) % 61);
  detailBox(
    'water-current',
    [1.2 + (i % 5) * 0.4, 0.007, 0.06],
    [x, 0.23, z],
    [0, ((i % 4) - 2) * 0.11, 0],
  );
}
function ridge(role, points, backZ) {
  const vertices = [],
    indices = [];
  points.forEach(([x, y, z]) => vertices.push(x, 0, z, x, y, z, x, 0, backZ));
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 3,
      b = a + 3;
    indices.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  const shape = new THREE.BufferGeometry();
  shape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  shape.setIndex(indices);
  add(shape, role);
}
ridge(
  'distant-ridge',
  [
    [-85, 20, -73],
    [-63, 36, -82],
    [-42, 24, -75],
    [-16, 45, -89],
    [6, 32, -80],
    [27, 49, -88],
    [52, 30, -78],
    [78, 37, -82],
    [96, 17, -72],
  ],
  -100,
);
ridge(
  'mineral-ridge',
  [
    [-60, 8, -48],
    [-45, 19, -50],
    [-29, 13, -47],
    [-7, 22, -58],
    [14, 18, -54],
    [34, 25, -61],
    [59, 16, -50],
    [78, 8, -48],
  ],
  -72,
);
ridge(
  'mineral-ridge',
  [
    [49, 3, 43],
    [57, 11, 29],
    [58, 15, 7],
    [57, 18, -12],
    [51, 8, -23],
  ],
  53,
);
for (let i = 0; i < 38; i++) {
  const x = 11 + ((i * 17) % 48),
    z = -40 - ((i * 11) % 13),
    h = 2.4 + (i % 7) * 0.45;
  add(new THREE.CylinderGeometry(0.15, 0.24, h, 5), 'mineral-ridge', [x, h / 2, z]);
  for (let k = 0; k < 3; k++)
    add(new THREE.ConeGeometry(1.2 - k * 0.22, h * 0.58, 7), i % 3 ? 'fir-dark' : 'fir-light', [
      x,
      h * 0.42 + k * h * 0.2,
      z,
    ]);
}
// Shore strips are flush mineral/gravel paint, leaving canonical ground support visible.
for (let i = 0; i < 18; i++)
  detailBox('warm-gravel', [0.08, 0.008, 1.4], [3.8 + (i % 3) * 0.22, 0.008, -31 + i * 3.7]);

export const obstacles = [...terrains, ...boxes];
export const anchors = [
  { id: 'shore-pad', kind: 'spawn', position: [-30, 0.45, 26] },
  { id: 'shore-lookout-south', kind: 'checkpoint', position: [-10, 5, 15], order: 1 },
  { id: 'shore-lookout-north', kind: 'checkpoint', position: [-10, 7, -12], order: 2 },
  { id: 'shore-return', kind: 'landing', position: [-30, 0.45, 26], order: 3 },
];

export function createScene() {
  const document = {
    asset: { version: '2.0', generator: 'RevealLine original Mountain Reservoir source r1' },
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
    const accessor = { bufferView: view, componentType, count: values.length / 3, type };
    if (type === 'VEC3') {
      accessor.min = [0, 1, 2].map((k) => Math.min(...values.filter((_, i) => i % 3 === k)));
      accessor.max = [0, 1, 2].map((k) => Math.max(...values.filter((_, i) => i % 3 === k)));
    }
    return document.accessors.push(accessor) - 1;
  }
  for (const [role, batch] of batches) {
    const definition = paints.find(([id]) => id === role),
      color = new THREE.Color(definition[1]);
    const material =
      document.materials.push({
        name: role,
        pbrMetallicRoughness: {
          baseColorFactor: [color.r, color.g, color.b, 1],
          metallicFactor: role === 'reservoir-water' ? 0.15 : 0,
          roughnessFactor: definition[2],
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
      textures: 0,
      colliders: obstacles.length,
      collisionTriangles: terrains.reduce((n, o) => n + o.indices.length / 3, 0),
    },
  };
}
