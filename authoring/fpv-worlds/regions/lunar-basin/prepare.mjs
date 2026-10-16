/** Original bounded lunar-themed composition. Refuses existing output directories. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { compileSceneryCell } from '../../../../optional-practice/civilian-fpv/regional/scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { design, revision, heightMm, sampledHeight, spawns } from './relief.mjs';

assert(process.argv[2], 'Provide a new external output directory');
const output = resolve(process.argv[2]);
const json = (x) => Buffer.from(JSON.stringify(x) + '\n');
const hash = (x) => createHash('sha256').update(x).digest('hex');
const terrains = [],
  cells = [];
for (let z = 0; z < 6; z++)
  for (let x = 0; x < 6; x++) {
    const common = { chunkId: `lunar-${x}-${z}`, x, z, cellSizeMm: 128000 };
    terrains.push({
      format: 'FPVRegionCollision.v1',
      ...common,
      samples: 33,
      heightsMm: Array.from({ length: 1089 }, (_, i) =>
        heightMm(x * 128 + (i % 33) * 4, z * 128 + Math.floor(i / 33) * 4),
      ),
    });
    cells.push({ format: 'FPVRegionScenery.v1', ...common, surfaces: [] });
  }
function clip(polygon, axis, bound, positive) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const ai = positive ? a[axis] >= bound : a[axis] <= bound;
    const bi = positive ? b[axis] >= bound : b[axis] <= bound;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}
const solids = [];
function mesh(id, positions, indices, color) {
  const bounds = [0, 1, 2].map((axis) => [
    Math.min(...positions.filter((_, i) => i % 3 === axis)),
    Math.max(...positions.filter((_, i) => i % 3 === axis)),
  ]);
  solids.push({ id, bounds });
  for (const cell of cells) {
    if (
      bounds[0][1] < cell.x * 128 ||
      bounds[0][0] > (cell.x + 1) * 128 ||
      bounds[2][1] < cell.z * 128 ||
      bounds[2][0] > (cell.z + 1) * 128
    )
      continue;
    const surface = { id, positionsMm: [], indices: [], color };
    for (let i = 0; i < indices.length; i += 3) {
      let polygon = indices.slice(i, i + 3).map((j) => positions.slice(j * 3, j * 3 + 3));
      for (const [axis, bound, positive] of [
        [0, cell.x * 128, true],
        [0, (cell.x + 1) * 128, false],
        [2, cell.z * 128, true],
        [2, (cell.z + 1) * 128, false],
      ])
        polygon = clip(polygon, axis, bound, positive);
      for (let j = 1; j < polygon.length - 1; j++) {
        const tri = [polygon[0], polygon[j], polygon[j + 1]].map((p) =>
          p.map(
            (v, axis) =>
              Math.round(v * 1000) -
              (axis === 0 ? cell.x * 128000 : axis === 2 ? cell.z * 128000 : 0),
          ),
        );
        const a = new THREE.Vector3(...tri[1]).sub(new THREE.Vector3(...tri[0]));
        const b = new THREE.Vector3(...tri[2]).sub(new THREE.Vector3(...tri[0]));
        if (a.cross(b).lengthSq() === 0) continue;
        const offset = surface.positionsMm.length / 3;
        surface.positionsMm.push(...tri.flat());
        surface.indices.push(offset, offset + 1, offset + 2);
      }
    }
    if (surface.indices.length) cell.surfaces.push(surface);
  }
}
const colours = {
  dark: [0.25, 0.27, 0.29],
  rock: [0.51, 0.5, 0.47],
  light: [0.7, 0.69, 0.64],
  metal: [0.57, 0.62, 0.64],
  marker: [0.75, 0.52, 0.21],
};
function geometry(id, g, color) {
  mesh(id, [...g.attributes.position.array], [...g.index.array], color);
  g.dispose();
}
function box(id, x, y, z, sx, sy, sz, color = colours.metal) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(x, y, z);
  geometry(id, g, color);
}
function rod(id, a, b, radius, color = colours.metal) {
  const start = new THREE.Vector3(...a),
    end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start),
    length = direction.length();
  const g = new THREE.CylinderGeometry(radius, radius, length, 8, 1, false);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
  );
  const centre = start.add(end).multiplyScalar(0.5);
  g.translate(centre.x, centre.y, centre.z);
  geometry(id, g, color);
}
function rock(id, x, z, sx, sz, h, seed, color = colours.rock) {
  const n = 7,
    p = [],
    ix = [];
  for (let level = 0; level < 3; level++)
    for (let i = 0; i < n; i++) {
      const angle = (i * Math.PI * 2) / n + seed * 0.17;
      const radius = 1 + 0.12 * Math.sin(i * 2.1 + seed);
      const width = level === 2 ? 0.55 : 1;
      const px = x + Math.cos(angle) * sx * 0.5 * radius * width,
        pz = z + Math.sin(angle) * sz * 0.5 * radius * width;
      p.push(
        px,
        level === 0
          ? sampledHeight(px, pz) - 1
          : sampledHeight(x, z) + h * (level === 1 ? 0.63 : 1) + Math.sin(i + seed) * h * 0.06,
        pz,
      );
    }
  for (let ring = 0; ring < 2; ring++)
    for (let i = 0; i < n; i++) {
      const a = ring * n + i,
        b = ring * n + ((i + 1) % n),
        c = a + n,
        d = b + n;
      ix.push(a, c, b, b, c, d);
    }
  for (let i = 1; i < n - 1; i++) {
    ix.push(0, i + 1, i);
    ix.push(2 * n, 2 * n + i, 2 * n + i + 1);
  }
  mesh(id, p, ix, color);
}
function shelter(id, x, z, sx, sz, roofHeight) {
  const base = sampledHeight(x, z),
    top = base + roofHeight;
  for (const dx of [-sx / 2 + 1, sx / 2 - 1])
    for (const dz of [-sz / 2 + 1, sz / 2 - 1]) {
      const floor = sampledHeight(x + dx, z + dz) - 0.4;
      box(
        `${id}-pier-${dx < 0 ? 'w' : 'e'}-${dz < 0 ? 'n' : 's'}`,
        x + dx,
        (floor + top) / 2,
        z + dz,
        1.6,
        top - floor,
        1.6,
        colours.dark,
      );
      box(
        `${id}-foot-${dx < 0 ? 'w' : 'e'}-${dz < 0 ? 'n' : 's'}`,
        x + dx,
        floor + 0.2,
        z + dz,
        3.2,
        0.8,
        3.2,
        colours.light,
      );
    }
  for (let panel = 0; panel < 3; panel++)
    box(
      `${id}-roof-${panel}`,
      x - sx / 3 + (panel * sx) / 3,
      top + 0.45,
      z,
      sx / 3 - 0.15,
      0.9,
      sz,
      colours.metal,
    );
  for (const side of [-1, 1])
    box(
      `${id}-edge-${side < 0 ? 'n' : 's'}`,
      x,
      top - 0.4,
      z + side * (sz / 2 - 0.35),
      sx,
      0.8,
      0.7,
      colours.marker,
    );
  if (id !== 'survey-shelter' && id !== 'service-gallery') return;
  // Attached roof ribs and corner equipment preserve both open central flight axes.
  for (const lane of [-1, 0, 1]) {
    box(
      `${id}-roof-rib-${lane + 1}`,
      x + (lane * sx) / 3,
      top - 0.65,
      z,
      0.55,
      1.3,
      sz - 1.6,
      colours.light,
    );
  }
  for (const side of [-1, 1]) {
    box(
      `${id}-side-stringer-${side < 0 ? 'w' : 'e'}`,
      x + side * (sx / 2 - 1),
      top - 0.65,
      z,
      1.6,
      1.3,
      sz,
      colours.metal,
    );
  }
  for (const [index, side] of [-1, 1].entries()) {
    const ex = x + side * (sx / 2 - 6),
      ez = z - sz / 2 + 6;
    const points = [-1.8, 0, 1.8].flatMap((dx) =>
      [-1.6, 0, 1.6].map((dz) => sampledHeight(ex + dx, ez + dz)),
    );
    const floor = Math.min(...points) - 0.12,
      deck = Math.max(...points) + 0.28;
    box(
      `${id}-equipment-plinth-${index}`,
      ex,
      (floor + deck) / 2,
      ez,
      3.6,
      deck - floor,
      3.2,
      colours.light,
    );
    box(`${id}-equipment-cabinet-${index}`, ex, deck + 1.9, ez, 2.8, 3.8, 2.4, colours.metal);
    // These are solid instrument faces with backing, not deceptive fly-through apertures.
    box(
      `${id}-instrument-backing-${index}`,
      ex,
      deck + 2.15,
      ez + 1.26,
      2.1,
      2.3,
      0.18,
      colours.dark,
    );
    for (const row of [-1, 0, 1]) {
      box(
        `${id}-instrument-strip-${index}-${row + 1}`,
        ex,
        deck + 2.15 + row * 0.56,
        ez + 1.37,
        1.65,
        0.12,
        0.12,
        row === 0 ? colours.marker : colours.light,
      );
    }
    box(`${id}-cabinet-cap-${index}`, ex, deck + 3.88, ez, 3.05, 0.16, 2.65, colours.light);
  }
}
// Each natural feature has a different footprint and approach; roofs retain open sides.
shelter('survey-shelter', 104, 144, 48, 48, 11);
for (const [i, x, z, sx, sz, h] of [
  [0, 164, 247, 12, 23, 5],
  [1, 180, 300, 20, 11, 7],
  [2, 211, 242, 9, 18, 4],
])
  rock(`landing-berm-${i}`, x, z, sx, sz, h, i, colours.dark);
rock('split-block-west', 337, 155, 17, 18, 14, 2);
rock('split-block-east', 367, 133, 19, 17, 11, 5, colours.light);
for (const [i, x, z, sx, sz, h] of [
  [0, 411, 267, 15, 28, 8],
  [1, 431, 294, 23, 14, 11],
  [2, 464, 281, 13, 20, 7],
])
  rock(`crescent-${i}`, x, z, sx, sz, h, i + 3);
rock('rille-elbow-left', 586, 168, 17, 32, 15, 7, colours.dark);
rock('rille-elbow-right', 633, 153, 15, 25, 10, 4);
shelter('survey-crossing', 680, 280, 34, 20, 16);
rock('broken-rim-north', 90, 523, 26, 15, 15, 8, colours.light);
rock('broken-rim-south', 150, 556, 15, 24, 11, 11);
rock('central-mound', 155, 557, 24, 19, 13, 3, colours.dark);
rock('tilted-slab-left', 314, 540, 19, 32, 22, 4, colours.light);
rock('tilted-slab-right', 369, 509, 16, 20, 12, 7);
rock('fork-west', 415, 644, 13, 38, 16, 5);
rock('fork-east', 488, 610, 16, 30, 20, 9, colours.light);
rock('fork-exit', 455, 678, 24, 15, 9, 4, colours.dark);
// A real shallow dish shell, supported by four piers; no solid proxy fills the space beneath.
const dishBase = sampledHeight(608, 520),
  dishY = dishBase + 19,
  p = [],
  ix = [],
  segments = 24,
  rings = 4;
for (let layer = 0; layer < 2; layer++)
  for (let ring = 0; ring <= rings; ring++)
    for (let i = 0; i < segments; i++) {
      const radius = 1 + ring * 4,
        angle = (i * Math.PI * 2) / segments;
      p.push(
        608 + Math.cos(angle) * radius,
        dishY + radius * radius * 0.012 + (layer === 0 ? 0 : -0.7),
        520 + Math.sin(angle) * radius,
      );
    }
const layerVertices = (rings + 1) * segments;
for (let layer = 0; layer < 2; layer++)
  for (let ring = 0; ring < rings; ring++)
    for (let i = 0; i < segments; i++) {
      const a = layer * layerVertices + ring * segments + i,
        b = layer * layerVertices + ring * segments + ((i + 1) % segments),
        c = a + segments,
        d = b + segments;
      if (layer === 0) ix.push(a, c, b, b, c, d);
      else ix.push(a, b, c, b, d, c);
    }
for (const ring of [0, rings])
  for (let i = 0; i < segments; i++) {
    const a = ring * segments + i,
      b = ring * segments + ((i + 1) % segments),
      c = a + layerVertices,
      d = b + layerVertices;
    ix.push(a, b, c, b, d, c);
  }
mesh('survey-dish', p, ix, colours.metal);
// Resolve support tops against the actual triangle shell, not its centre height.
// The old four piers ended below the curved underside by about 1.7 m.
function dishUnderside(x, z) {
  const ray = new THREE.Ray(new THREE.Vector3(x, dishBase, z), new THREE.Vector3(0, 1, 0));
  let lowest = Infinity;
  for (let i = 0; i < ix.length; i += 3) {
    const points = ix
      .slice(i, i + 3)
      .map((index) => new THREE.Vector3(...p.slice(index * 3, index * 3 + 3)));
    const hit = ray.intersectTriangle(...points, false, new THREE.Vector3());
    if (hit) lowest = Math.min(lowest, hit.y);
  }
  assert(Number.isFinite(lowest), 'Dish support must meet the real shell');
  return lowest;
}
const supportContacts = [];
for (const dx of [-11, 11])
  for (const dz of [-11, 11]) {
    const x = 608 + dx,
      z = 520 + dz,
      bottom = sampledHeight(x, z) - 0.5;
    const samples = [];
    for (const ox of [-0.75, 0, 0.75])
      for (const oz of [-0.75, 0, 0.75]) samples.push(dishUnderside(x + ox, z + oz));
    const top = Math.max(...samples) + 0.03;
    box(
      `dish-leg-${dx < 0 ? 'w' : 'e'}-${dz < 0 ? 'n' : 's'}`,
      x,
      (bottom + top) / 2,
      z,
      1.5,
      top - bottom,
      1.5,
      colours.dark,
    );
    supportContacts.push({
      x,
      z,
      bottom,
      top,
      undersideMin: Math.min(...samples),
      undersideMax: Math.max(...samples),
    });
  }
// A receiver suspended by three open struts makes the silhouette read as an antenna.
const receiver = [608, dishBase + 31, 520];
for (let i = 0; i < 3; i++) {
  const angle = (i * Math.PI * 2) / 3,
    radius = 15;
  rod(
    `dish-feed-strut-${i}`,
    [
      608 + Math.cos(angle) * radius,
      dishY + radius * radius * 0.012,
      520 + Math.sin(angle) * radius,
    ],
    receiver,
    0.28,
  );
}
box('dish-receiver', 608, dishBase + 31.25, 520, 2.4, 1.8, 2.4, colours.dark);
box('dish-receiver-marker', 608, dishBase + 32.17, 520, 1.4, 0.12, 1.4, colours.marker);
shelter('service-gallery', 680, 648, 48, 28, 15);
for (const dz of [-11, 11])
  for (const dx of [-16, 16])
    box(
      `gallery-rib-${dx < 0 ? 'w' : 'e'}-${dz < 0 ? 'n' : 's'}`,
      680 + dx,
      sampledHeight(680, 648) + 7.5,
      648 + dz,
      0.7,
      15,
      0.7,
      colours.marker,
    );

for (let z = 0; z < 6; z++)
  for (let x = 0; x < 6; x++)
    validateTerrainSeams(terrains.filter((c) => Math.abs(c.x - x) <= 1 && Math.abs(c.z - z) <= 1));
await mkdir(output, { recursive: false });
const manifests = {},
  resources = {};
for (const [layer, sources, compile] of [
  ['terrain', terrains, compileTerrainCell],
  ['scenery', cells, compileSceneryCell],
]) {
  await mkdir(resolve(output, layer));
  const assets = [],
    chunks = [];
  for (const source of sources) {
    const ids = [];
    if (layer === 'terrain' || source.surfaces.length) {
      const compiled = compile(source);
      resources[layer + '/' + source.chunkId] =
        compiled.positions?.byteLength + compiled.indices?.byteLength ||
        source.surfaces.reduce(
          (n, s) => n + s.positionsMm.length * 4 + s.indices.length * 4 + s.positionsMm.length * 4,
          0,
        );
      for (const [kind, bytes] of [
        ['scene', compiled.glb],
        ['collision', json(source)],
      ]) {
        const id = `${source.chunkId}-${kind}`,
          path = `${source.chunkId}.${kind === 'scene' ? 'glb' : 'json'}`;
        assets.push({
          id,
          kind,
          path,
          bytes: bytes.length,
          sha256: hash(bytes),
        });
        ids.push(id);
        await writeFile(resolve(output, layer, path), bytes);
      }
    }
    chunks.push({ id: source.chunkId, x: source.x, z: source.z, assets: ids });
  }
  const manifest = {
    format: layer === 'terrain' ? 'FPVRegionManifest.v1' : 'FPVSceneryManifest.v1',
    id: design.id,
    revision,
    title: design.title,
    grid: {
      cellSizeMm: 128000,
      minX: 0,
      minZ: 0,
      width: 6,
      depth: 6,
      floorMm: -10000,
      ceilingMm: 180000,
    },
    assets,
    chunks,
    spawns,
  };
  validateRegionManifest(manifest);
  manifests[layer] = manifest;
  await writeFile(resolve(output, layer, 'region.json'), json(manifest));
}
// Sample the intended lines densely against the exact terrain triangles. These remain
// authoring scenarios until collision and actual commanded-flight checks accept them.
const routes = design.districts.flatMap((d) =>
  d.routes.map((r) => {
    const points = [];
    for (let i = 1; i < r.waypointsXZMm.length; i++) {
      const a = r.waypointsXZMm[i - 1].map((n) => n / 1000),
        b = r.waypointsXZMm[i].map((n) => n / 1000),
        steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
      for (let j = i === 1 ? 0 : 1; j <= steps; j++) {
        const t = j / steps,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        points.push([
          Math.round(x * 1000) / 1000,
          Math.round((sampledHeight(x, z) + r.targetAGLMm / 1000) * 1000) / 1000,
          Math.round(z * 1000) / 1000,
        ]);
      }
    }
    return {
      id: r.id,
      district: d.id,
      points,
      halfWidth: r.minimumClearDiameterMm / 2000 - 0.25,
      plannedClearDiameterMm: r.minimumClearDiameterMm,
    };
  }),
);
const receipt = {
  format: 'FPVLunarPreparation.v1',
  revision,
  actualSizeM: [768, 768],
  terrainCells: 36,
  sceneryCells: cells.filter((c) => c.surfaces.length).length,
  landmarks: design.districts.flatMap((d) =>
    d.landmarks.map((l) => ({ id: l.id, district: d.id })),
  ),
  solids,
  supportContacts,
  spawns,
  routes,
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((n, a) => n + a.bytes, 0),
  terrainManifestSHA256: hash(json(manifests.terrain)),
  sceneryManifestSHA256: hash(json(manifests.scenery)),
  physics: design.physics,
  routeClearanceStatus: 'not-yet-verified',
  playerReady: false,
};
assert(receipt.sourceBytes < 12 * 1024 * 1024, 'Source payload target exceeded');
await writeFile(resolve(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(
  JSON.stringify({
    ...receipt,
    routes: routes.length,
    solids: solids.length,
    spawns: spawns.length,
  }),
);
