#!/usr/bin/env node
// Manual, source-bound scene and recording qualification; not additional unit coverage.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as after from '../optional-practice/civilian-fpv/world-assets.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/demonstrations.mjs';
import {
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';

const baseline = '25700b699cc3c6e2b56d1917803dd7c4e6933b42',
  root = new URL('../', import.meta.url),
  runtimePath = 'optional-practice/civilian-fpv/world-assets.mjs',
  args = process.argv.slice(2),
  checks = [],
  scenes = [],
  recordings = [],
  immutable = {},
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  old = (path) =>
    execFileSync('git', ['show', baseline + ':' + path], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Use --out NEW_RECEIPT.json');
const check = (name, pass, details = undefined) => {
  checks.push({ name, passed: !!pass, ...(details === undefined ? {} : { details }) });
  assert(pass, name);
};
const close = (a, b, epsilon = 0.00002) => Math.abs(a - b) < epsilon;
for (const path of execFileSync(
  'git',
  ['ls-files', 'optional-practice/civilian-fpv', 'authoring/fpv-worlds/assets/kenney'],
  { cwd: root },
)
  .toString()
  .trim()
  .split('\n')
  .filter((path) => path !== runtimePath && !path.endsWith('/runtime-provenance.json'))) {
  const current = await readFile(new URL(path, root));
  check(path + ' retains exact baseline bytes', current.equals(old(path)));
  immutable[path] = hash(current);
}
const oldRuntime = old(runtimePath),
  currentRuntime = await readFile(new URL(runtimePath, root)),
  library = (source) => {
    const match = /const LIBRARY\s*=\s*'([^']+)';/.exec(source.toString());
    assert(match, 'embedded GLB library is present');
    return Buffer.from(match[1], 'base64');
  },
  oldLibrary = library(oldRuntime),
  currentLibrary = library(currentRuntime),
  source = oldRuntime
    .toString()
    .replace(
      /from '(\.[^']+)'/g,
      (_, path) => `from '${new URL(path, new URL(runtimePath, root)).href}'`,
    ),
  before = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
check('embedded original GLB library is byte-identical', oldLibrary.equals(currentLibrary));
const provenance = JSON.parse(
  await readFile(new URL('authoring/fpv-worlds/assets/kenney/runtime-provenance.json', root)),
);
check(
  'generated provenance binds the current runtime and unchanged library',
  provenance.sha256 === hash(currentRuntime) &&
    provenance.bytes === currentRuntime.length &&
    provenance.librarySha256 === hash(currentLibrary) &&
    provenance.libraryBytes === currentLibrary.length,
);
function parseGLB(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), bytes.byteLength);
  const jsonLength = view.getUint32(12, true),
    json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))),
    binOffset = 20 + jsonLength,
    bin = bytes.subarray(binOffset + 8, binOffset + 8 + view.getUint32(binOffset, true));
  return { bytes, json, bin };
}
async function scene(module, course) {
  const blob = module.builtinWorldScene(course);
  return blob ? parseGLB(Buffer.from(await blob.arrayBuffer())) : null;
}
const originalJSON = parseGLB(currentLibrary).json,
  windowMeshes = new Set();
function collectMeshes(index) {
  const node = originalJSON.nodes[index];
  if (node.mesh !== undefined) windowMeshes.add(node.mesh);
  for (const child of node.children ?? []) collectMeshes(child);
}
originalJSON.nodes.forEach((node, index) => {
  if (node.extras?.sceneryId === 'retro-urban/wall-a-flat-window') collectMeshes(index);
});
assert.equal(windowMeshes.size, 1, 'one unchanged window source mesh');
const catalogue = [
    ...new Map(
      [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((entry) => [entry.id, entry]),
    ).values(),
  ],
  warehouses = catalogue.filter((entry) => entry.course.environment === 'warehouse');
check(
  '29 Warehouse courses across four arena bounds',
  warehouses.length === 29 &&
    new Set(warehouses.map((entry) => JSON.stringify(entry.course.bounds))).size === 4,
);
const windowPlacement = (placement) => placement.model === 'retro-urban/wall-a-flat-window',
  buildingPlacement = (placement) => /^city-industrial\/building-[adl]$/.test(placement.model),
  movedPlacement = (placement) => windowPlacement(placement) || buildingPlacement(placement),
  center = (placement) =>
    placement.bounds.min.map((value, axis) =>
      axis === 1 ? value : (value + placement.bounds.max[axis]) / 2,
    ),
  extent = (placement) =>
    placement.bounds.min.map((value, axis) => placement.bounds.max[axis] - value),
  overlaps = (a, b) =>
    a.bounds.min.every(
      (value, axis) =>
        Math.min(a.bounds.max[axis], b.bounds.max[axis]) - Math.max(value, b.bounds.min[axis]) >
        0.00001,
    );
function translationAccessor(data, index) {
  const accessor = data.json.accessors[index],
    view = data.json.bufferViews[accessor.bufferView],
    offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  assert.equal(accessor.componentType, 5126);
  assert.equal(accessor.type, 'VEC3');
  assert.equal(view.byteStride ?? 12, 12);
  return {
    offset,
    length: accessor.count * 12,
    rows: Array.from({ length: accessor.count }, (_, row) =>
      Array.from({ length: 3 }, (_, axis) => data.bin.readFloatLE(offset + row * 12 + axis * 4)),
    ),
  };
}
function verifyTranslatedGLB(a, b, name) {
  const pa = a.json.asset.extras.placements,
    pb = b.json.asset.extras.placements,
    ja = structuredClone(a.json),
    jb = structuredClone(b.json),
    ba = Buffer.from(a.bin),
    bb = Buffer.from(b.bin),
    windowBySide = new Map();
  assert.equal(pa.length, pb.length);
  pa.forEach((placement, index) => {
    const candidate = pb[index];
    assert.equal(placement.model, candidate.model);
    assert.equal(placement.side, candidate.side);
    assert(extent(placement).every((value, axis) => close(value, extent(candidate)[axis])));
    assert.equal(placement.bounds.min[1], candidate.bounds.min[1]);
    if (!movedPlacement(placement)) assert.deepEqual(placement, candidate);
    if (windowPlacement(placement)) {
      if (!windowBySide.has(placement.side)) windowBySide.set(placement.side, []);
      windowBySide.get(placement.side).push({ before: placement, after: candidate });
    }
    // Only validated placement translations may vary in scene metadata.
    ja.asset.extras.placements[index].bounds = {};
    jb.asset.extras.placements[index].bounds = {};
  });
  let buildings = 0,
    windows = 0;
  a.json.nodes.forEach((node, index) => {
    const candidate = b.json.nodes[index];
    assert(candidate && node.name === candidate.name);
    const rootMatch = /^scenery-(\d+)$/.exec(node.name ?? '');
    if (rootMatch) {
      const placementIndex = Number(rootMatch[1]) - 1;
      if (buildingPlacement(pa[placementIndex])) {
        const oldCenter = center(pa[placementIndex]),
          newCenter = center(pb[placementIndex]);
        assert(node.translation.every((value, axis) => close(value, oldCenter[axis])));
        assert(candidate.translation.every((value, axis) => close(value, newCenter[axis])));
        ja.nodes[index].translation = [];
        jb.nodes[index].translation = [];
        buildings++;
      }
    }
    const attributes = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
    if (!attributes || !windowMeshes.has(node.mesh)) return;
    assert.deepEqual(attributes, candidate.extensions.EXT_mesh_gpu_instancing.attributes);
    const sideMatch = /^scenery-side-(\d+)-mesh-\d+$/.exec(node.name),
      pairs = windowBySide.get(Number(sideMatch[1])),
      aa = translationAccessor(a, attributes.TRANSLATION),
      ab = translationAccessor(b, attributes.TRANSLATION);
    assert.equal(pairs.length, aa.rows.length);
    assert.equal(ab.rows.length, aa.rows.length);
    pairs.forEach((pair, row) => {
      const oldCenter = center(pair.before),
        newCenter = center(pair.after);
      assert(
        aa.rows[row].every((value, axis) =>
          close(ab.rows[row][axis] - value, newCenter[axis] - oldCenter[axis]),
        ),
        'actual instance transform follows the declared placement translation',
      );
      windows++;
    });
    for (const data of [ja, jb]) {
      delete data.accessors[attributes.TRANSLATION].min;
      delete data.accessors[attributes.TRANSLATION].max;
    }
    ba.fill(0, aa.offset, aa.offset + aa.length);
    bb.fill(0, ab.offset, ab.offset + ab.length);
  });
  check(
    name + ': only six building and 32 window translations change in the actual GLB',
    buildings === 6 && windows === 32 && jsonHash(ja) === jsonHash(jb) && ba.equals(bb),
  );
  check(
    name + ': exact 57 placements, six batches, 42 instances and 15 individually sorted meshes',
    pb.length === 57 &&
      jsonHash(b.json.asset.extras.batching) ===
        jsonHash({ sourceMeshes: 57, batches: 6, instances: 42, unbatched: 15, spatialGroups: 4 }),
  );
}
function verifyGeometry(data, course, name) {
  const placements = data.json.asset.extras.placements,
    bounds = course.bounds,
    min = [bounds.min.x / 1000, bounds.min.y / 1000, bounds.min.z / 1000],
    max = [bounds.max.x / 1000, bounds.max.y / 1000, bounds.max.z / 1000];
  check(
    name + ': all placed model envelopes remain strictly outside flight bounds',
    placements.every((p) =>
      [0, 2].some((axis) => p.bounds.max[axis] < min[axis] || p.bounds.min[axis] > max[axis]),
    ),
  );
  const runs = [];
  for (let side = 0; side < 4; side++) {
    const axis = side % 2 ? 2 : 0,
      depthAxis = side % 2 ? 0 : 2,
      windows = placements.filter((p) => p.side === side && windowPlacement(p)),
      points = windows.map((p) => center(p)[axis]),
      gaps = points.slice(1).map((value, index) => value - points[index] - 6),
      left = windows[0].bounds.min[axis] - min[axis],
      right = max[axis] - windows[7].bounds.max[axis];
    assert.equal(windows.length, 8);
    const outwardGap = (p) =>
      side === 0 || side === 3
        ? min[depthAxis] - p.bounds.max[depthAxis]
        : p.bounds.min[depthAxis] - max[depthAxis];
    check(
      name + '/side' + side + ': two four-bay runs at 6.04 m pitch with clear ends and centre',
      gaps.every((gap, index) => (index === 3 ? gap >= 0.5 : close(gap, 0.04))) &&
        left >= 0.5 &&
        right >= 0.5 &&
        windows.every(
          (p) =>
            close(extent(p)[axis], 6) &&
            close(extent(p)[depthAxis], 0.6) &&
            close(extent(p)[1], 6) &&
            close(p.bounds.min[1] - min[1], 2.5) &&
            close(outwardGap(p), 0.5),
        ),
    );
    runs.push({ side, gaps, endClearance: [left, right] });
  }
  const intersections = [];
  for (let i = 0; i < placements.length; i++)
    for (let j = i + 1; j < placements.length; j++)
      if (
        (movedPlacement(placements[i]) || movedPlacement(placements[j])) &&
        overlaps(placements[i], placements[j])
      )
        intersections.push([i + 1, j + 1]);
  check(
    name + ': regrouped windows/buildings overlap no other model envelope',
    !intersections.length,
    intersections,
  );
  return runs;
}
for (const entry of warehouses) {
  const a = await scene(before, entry.course),
    b = await scene(after, entry.course);
  verifyTranslatedGLB(a, b, entry.id);
  const runs = verifyGeometry(b, entry.course, entry.id);
  scenes.push({
    course: entry.id,
    bounds: entry.course.bounds,
    beforeSha256: hash(a.bytes),
    afterSha256: hash(b.bytes),
    bytes: b.bytes.length,
    runs,
  });
}
const supported = new Set(['woodland', 'courtyard', 'stadium', 'container-yard', 'garage']),
  unaffected = [
    ...new Map(
      catalogue
        .filter((entry) => supported.has(entry.course.environment))
        .map((entry) => [
          JSON.stringify([
            entry.course.environment,
            entry.course.bounds,
            entry.course.world?.theme,
          ]),
          entry,
        ]),
    ).values(),
  ];
check(
  'all five other supported scenery environments are represented',
  new Set(unaffected.map((e) => e.course.environment)).size === 5,
);
for (const entry of unaffected) {
  const a = await scene(before, entry.course),
    b = await scene(after, entry.course);
  check(entry.id + ': unaffected environment GLB remains byte-identical', a.bytes.equals(b.bytes));
}
const creatorCases = [];
for (const [width, depth] of [
  [48, 48],
  [63.999, 88],
  [88, 63.999],
  [24, 100],
  [100, 24],
  [64, 64],
  [64, 88],
  [88, 64],
]) {
  const course = structuredClone(warehouses[0].course);
  course.bounds = {
    min: { x: 13000, y: 7000, z: -91000 },
    max: { x: 13000 + width * 1000, y: 27000, z: -91000 + depth * 1000 },
  };
  const a = await scene(before, course),
    b = await scene(after, course),
    name = 'creator ' + width + 'x' + depth + 'm at translated origin';
  if (Math.min(width, depth) < 64)
    check(name + ': small-layout fallback retains the exact prior GLB', a.bytes.equals(b.bytes));
  else {
    verifyTranslatedGLB(a, b, name);
    verifyGeometry(b, course, name);
  }
  creatorCases.push({ width, depth, beforeSha256: hash(a.bytes), afterSha256: hash(b.bytes) });
}
for (const input of [
  undefined,
  null,
  {},
  'unknown',
  { environment: 'unknown' },
  { environment: 'gym' },
])
  check(
    'unsupported scenery request remains absent: ' + JSON.stringify(input),
    before.builtinWorldScene(input) === null && after.builtinWorldScene(input) === null,
  );
await initWorldRuntime();
const warehouseIds = new Set(warehouses.map((entry) => entry.id)),
  worldProofs = WORLD_DEMONSTRATIONS.filter((row) => warehouseIds.has(row.proof.course)),
  legacyProofs = FLIGHT_DEMONSTRATIONS.filter((row) => warehouseIds.has(row.course));
check(
  '18 installed Warehouse World recordings and no legacy recordings',
  worldProofs.length === 18 && legacyProofs.length === 0,
);
for (const row of worldProofs) {
  const course = warehouses.find((entry) => entry.id === row.proof.course).course,
    result = await replayWorldFlight(course, row.proof, { yieldControl: async () => {} }),
    identity = worldStateIdentity(result.state);
  check(
    row.proof.course + '/' + row.proof.mode + ': exact completed World replay',
    result.state.status === 'complete' && identity === row.proof.finalStateIdentity,
  );
  recordings.push({
    course: row.proof.course,
    mode: row.proof.mode,
    ticks: result.state.ticks,
    identity,
  });
}
const receipt = {
  format: 'FPVWarehouseExteriorCPU.v1',
  createdAt: new Date().toISOString(),
  baseline,
  candidate: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  candidateStatus: execFileSync('git', ['status', '--short'], { cwd: root }).toString().trim(),
  runtimeSha256: hash(currentRuntime),
  librarySha256: hash(currentLibrary),
  libraryBytes: currentLibrary.length,
  qualifierSha256: hash(await readFile(new URL(import.meta.url))),
  immutable,
  checks,
  scenes,
  unaffectedCases: unaffected.map((entry) => ({
    course: entry.id,
    environment: entry.course.environment,
    bounds: entry.course.bounds,
  })),
  creatorCases,
  recordings,
  limitation:
    'CPU functional evidence only; no WebGL, image acceptance or hardware-performance claim. Other recordings retain byte-identical source inputs but are not claimed as freshly replayed.',
};
if (args.length)
  await writeFile(new URL(args[1], root), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    passed: checks.length,
    sceneCases: scenes.length,
    unaffectedCases: unaffected.length,
    creatorCases: creatorCases.length,
    recordings: recordings.length,
    ticks: recordings.reduce((sum, row) => sum + row.ticks, 0),
    runtimeSha256: receipt.runtimeSha256,
  }),
);
