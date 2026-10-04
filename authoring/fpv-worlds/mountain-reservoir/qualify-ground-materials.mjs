#!/usr/bin/env node
// Manual asset-contract check. Art acceptance and exact-pack flights are separate.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { grassPNG, gravelPNG } from './source/ground-maps.mjs';
const [beforeRoot, afterRoot] = process.argv.slice(2);
if (!beforeRoot || !afterRoot) throw Error('Use FROZEN_R9_DIRECTORY NEW_MATERIAL_DIRECTORY');
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  checks = [];
function check(passed, name) {
  checks.push({ name, passed: !!passed });
  if (!passed) throw Error(name);
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function glb(b) {
  const length = b.readUInt32LE(12);
  return { doc: JSON.parse(b.subarray(20, 20 + length)), bin: b.subarray(28 + length) };
}
function view(m, index) {
  const v = m.doc.bufferViews[index];
  return m.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
}
function attribute(m, index) {
  const a = m.doc.accessors[index];
  check(
    !a.byteOffset && !m.doc.bufferViews[a.bufferView].byteStride,
    'Tightly packed original attribute',
  );
  return view(m, a.bufferView);
}
const beforeBytes = await readFile(path.join(beforeRoot, 'mountain-reservoir-source.glb')),
  afterBytes = await readFile(path.join(afterRoot, 'mountain-reservoir-source.glb')),
  before = glb(beforeBytes),
  after = glb(afterBytes);
check(
  sha(beforeBytes) === 'ca838e9e028838a5a17f74831d4ef8206a14addd2baa510da78f28dd25bd9aac',
  'Exact qualified r9 source',
);
check(afterBytes.length < 1.2 * 1024 * 1024, 'Unchanged complete source budget');
for (const key of ['nodes', 'scenes', 'samplers'])
  check(equal(before.doc[key], after.doc[key]), key + ' exact');
check(
  before.doc.meshes.length === after.doc.meshes.length && after.doc.materials.length === 13,
  'No new material or mesh batch',
);
const changes = new Map([
  ['shore-meadow', { index: 1, metres: 1.5 }],
  ['warm-gravel', { index: 2, metres: 0.75 }],
]);
for (let i = 0; i < before.doc.meshes.length; i++) {
  const b = before.doc.meshes[i],
    a = after.doc.meshes[i],
    change = changes.get(b.name);
  check(equal(b, a), b.name + ' mesh/primitive/index ownership exact');
  const bp = b.primitives[0],
    ap = a.primitives[0];
  for (const key of Object.keys(bp.attributes)) {
    const old = attribute(before, bp.attributes[key]),
      current = attribute(after, ap.attributes[key]),
      expected = Buffer.from(old);
    if (key === 'TEXCOORD_0' && change)
      for (let n = 0; n < expected.length; n += 4)
        expected.writeFloatLE((old.readFloatLE(n) * 4) / change.metres, n);
    check(
      expected.equals(current),
      b.name + '/' + key + (key === 'TEXCOORD_0' && change ? ' exact metre scale' : ' exact bytes'),
    );
  }
  const bm = structuredClone(before.doc.materials[bp.material]),
    am = after.doc.materials[ap.material];
  if (change) bm.pbrMetallicRoughness.baseColorTexture.index = change.index;
  check(equal(bm, am), b.name + ' only declared texture binding changes');
}
check(
  after.doc.images.length === 3 && after.doc.textures.length === 3,
  'Exactly two additional texture owners',
);
check(
  view(before, before.doc.images[0].bufferView).equals(view(after, after.doc.images[0].bufferView)),
  'Rock image exact',
);
const additions = [grassPNG(), gravelPNG()];
check(additions.reduce((n, b) => n + b.length, 0) <= 48 * 1024, 'Encoded new-image budget');
for (let i = 0; i < 2; i++) {
  const image = view(after, after.doc.images[i + 1].bufferView);
  check(image.equals(additions[i]), 'Original map ' + i + ' reproducible');
  check(image.readUInt32BE(16) === 128 && image.readUInt32BE(20) === 128, 'New map bounded128px');
  check(
    equal(after.doc.textures[i + 1], { sampler: 0, source: i + 1 }),
    'New map uses unchanged sampler',
  );
}
const projects = await Promise.all(
  [beforeRoot, afterRoot].map(async (r) =>
    JSON.parse(await readFile(path.join(r, 'prepared/project.json'))),
  ),
);
const noRevision = (v) => JSON.stringify(v, (k, x) => (k === 'revision' ? undefined : x));
check(
  projects[0].revision === 'r9' && projects[1].revision === 'r10',
  'Distinct candidate revision',
);
check(
  noRevision(projects[0].courses) === noRevision(projects[1].courses),
  'Eight courses/collision/routes exact except revision',
);
for (const key of [
  'spawnBindings',
  'routeBindings',
  'overrides',
  'themes',
  'campaigns',
  'playlists',
])
  check(equal(projects[0][key], projects[1][key]), key + ' exact');
const receipt = {
  format: 'FPVReservoirGroundMaterialQualification.v1',
  status: 'passed',
  checks,
  before: { bytes: beforeBytes.length, sha256: sha(beforeBytes) },
  after: { bytes: afterBytes.length, sha256: sha(afterBytes) },
  extraImageBytes: additions.reduce((n, b) => n + b.length, 0),
  addedMaterials: 0,
  addedMeshes: 0,
  addedTriangles: 0,
  addedTextures: 2,
  collisionChanges: 0,
  routeChanges: 0,
  limits: 'Static contracts only; no visual/flight/hardware claim.',
};
await writeFile(
  path.join(afterRoot, 'ground-material-qualification.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    status: receipt.status,
    checks: checks.length,
    ...receipt.after,
    extraImageBytes: receipt.extraImageBytes,
  }),
);
