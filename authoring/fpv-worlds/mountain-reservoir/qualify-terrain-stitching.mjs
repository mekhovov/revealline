#!/usr/bin/env node
// Manual asset qualification; no simulated flights or runtime/unit changes.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createScene, includeLandEngineering, includeTerrainStitching } from './source/scene.mjs';

const [beforeRoot, afterRoot, receiptPath] = process.argv.slice(2);
if (!beforeRoot || !afterRoot) throw Error('Use FROZEN_R8_DIRECTORY NEW_R9_DIRECTORY');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const checks = [];
function check(passed, name) {
  checks.push({ name, passed });
  if (!passed) throw Error(name);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function glb(bytes) {
  check(bytes.readUInt32LE(0) === 0x46546c67 && bytes.readUInt32LE(4) === 2, 'GLB2 header');
  const length = bytes.readUInt32LE(12),
    document = JSON.parse(bytes.subarray(20, 20 + length).toString()),
    binary = bytes.subarray(28 + length);
  return { document, binary };
}
function attribute(model, index) {
  const a = model.document.accessors[index],
    v = model.document.bufferViews[a.bufferView],
    bytes = { 5121: 1, 5126: 4 }[a.componentType],
    width = { VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  check(bytes && width && !v.byteStride, 'Expected original tightly packed attribute');
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return model.binary.subarray(start, start + a.count * bytes * width);
}
const beforeBytes = await readFile(path.join(beforeRoot, 'mountain-reservoir-source.glb')),
  afterBytes = await readFile(path.join(afterRoot, 'mountain-reservoir-source.glb')),
  before = glb(beforeBytes),
  after = glb(afterBytes);
check(
  hash(beforeBytes) === '158e736b1584944455d56d8075eba8cbd88f44176531cc50ea4c42b02fdbbb2a',
  'Exact published r8 source model',
);
includeLandEngineering();
check(
  hash(createScene().bytes) === hash(beforeBytes),
  'Default generator still reproduces r8 exactly',
);
includeTerrainStitching();
check(
  hash(createScene().bytes) === hash(afterBytes),
  'Current stitched source reproduces candidate exactly',
);
for (const key of ['nodes', 'scenes', 'materials', 'textures', 'samplers'])
  check(same(before.document[key], after.document[key]), key + ' exact');
check(before.document.meshes.length === after.document.meshes.length, 'No additional draw batch');
let addedPositions, addedNormals, originalRockPositions;
for (let i = 0; i < before.document.meshes.length; i++) {
  const b = before.document.meshes[i],
    a = after.document.meshes[i];
  check(b.name === a.name && b.primitives.length === a.primitives.length, b.name + ' identity');
  for (let j = 0; j < b.primitives.length; j++) {
    const bp = b.primitives[j],
      ap = a.primitives[j];
    check(bp.material === ap.material, b.name + ' material ownership');
    for (const name of Object.keys(bp.attributes)) {
      const bb = attribute(before, bp.attributes[name]),
        ab = attribute(after, ap.attributes[name]);
      check(ab.subarray(0, bb.length).equals(bb), b.name + '/' + name + ' original bytes exact');
      const extra = ab.subarray(bb.length);
      if (b.name === 'mineral-ridge') {
        const old = before.document.accessors[bp.attributes[name]],
          next = after.document.accessors[ap.attributes[name]];
        check(next.count === old.count + 102, name + ' exactly 34 closure triangles');
        if (name === 'POSITION') {
          addedPositions = extra;
          originalRockPositions = bb;
        }
        if (name === 'NORMAL') addedNormals = extra;
      } else check(extra.length === 0, b.name + '/' + name + ' no additions');
    }
  }
}
for (let i = 0; i < before.document.images.length; i++) {
  const image = (m) => {
    const view = m.document.bufferViews[m.document.images[i].bufferView];
    return m.binary.subarray(view.byteOffset, view.byteOffset + view.byteLength);
  };
  check(image(before).equals(image(after)), 'Original texture bytes exact');
}
let westTriangles = 0,
  northTriangles = 0;
const originalPoints = new Set();
for (let i = 0; i < originalRockPositions.length; i += 12)
  originalPoints.add(
    [0, 4, 8].map((offset) => originalRockPositions.readFloatLE(i + offset)).join(','),
  );
for (let i = 0; i < addedPositions.length; i += 36) {
  const points = [0, 12, 24].map((offset) =>
      [0, 4, 8].map((axis) => addedPositions.readFloatLE(i + offset + axis)),
    ),
    normals = [0, 12, 24].map((offset) =>
      [0, 4, 8].map((axis) => addedNormals.readFloatLE(i + offset + axis)),
    ),
    west = points.every(([x]) => x === -44),
    north = points.every(([, , z]) => z === -34);
  check(west !== north, 'Closure confined to one existing outer boundary');
  check(
    points.every(([x, y, z]) => x >= -44 && x <= 6 && z >= -34 && z <= 38 && y >= 0 && y <= 8.5),
    'Closure stays within fixed boundary extents',
  );
  check(
    points.every((p) => p[1] === 0 || originalPoints.has(p.join(','))),
    'Every raised closure vertex is an exact original heightfield vertex',
  );
  check(
    normals.every(([x, y, z]) => y === 0 && (west ? x === 1 && z === 0 : x === 0 && z === 1)),
    'Nondegenerate inward-facing closure',
  );
  if (west) westTriangles++;
  else northTriangles++;
}
check(westTriangles === 24 && northTriangles === 10, 'Exact west/north closure count');
const projects = await Promise.all(
  [beforeRoot, afterRoot].map(async (root) =>
    JSON.parse(await readFile(path.join(root, 'prepared/project.json'))),
  ),
);
check(projects[0].revision === 'r8' && projects[1].revision === 'r9', 'Separate new revision');
const withoutRevision = (value) =>
  JSON.parse(JSON.stringify(value, (k, v) => (k === 'revision' ? undefined : v)));
check(
  same(withoutRevision(projects[0].courses), withoutRevision(projects[1].courses)),
  'All eight courses exact except revision',
);
for (const key of [
  'spawnBindings',
  'routeBindings',
  'overrides',
  'themes',
  'campaigns',
  'playlists',
])
  check(same(projects[0][key], projects[1][key]), key + ' exact');
const receipt = {
  format: 'FPVReservoirTerrainStitching.v1',
  status: 'passed',
  checks,
  before: { bytes: beforeBytes.length, sha256: hash(beforeBytes) },
  after: { bytes: afterBytes.length, sha256: hash(afterBytes) },
  addedTriangles: westTriangles + northTriangles,
  collisionChanges: 0,
  routeChanges: 0,
  limitations: [
    'Static asset contracts only; actual old/new render review and exact new-pack demonstration qualification remain separate.',
  ],
};
await writeFile(
  receiptPath ?? path.join(afterRoot, 'terrain-stitching-qualification.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    status: receipt.status,
    checks: checks.length,
    ...receipt.after,
    addedTriangles: receipt.addedTriangles,
  }),
);
