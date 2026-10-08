#!/usr/bin/env node
// Manual frozen-checkpoint comparison; actual renderer review remains separate.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [before, after, receiptPath] = process.argv.slice(2);
if (!before || !after || !receiptPath) throw Error('Use R1_DIRECTORY R2_DIRECTORY NEW_RECEIPT');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const checks = [];
const check = (name, passed) => checks.push({ name, passed: !!passed });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function load(root) {
  const build = JSON.parse(await readFile(path.join(root, 'checkpoint-build.json')));
  const project = JSON.parse(await readFile(path.join(root, 'prepared/project.json')));
  const bytes = await readFile(path.join(root, 'harbor-docks-source.glb'));
  if (sha(bytes) !== build.source.sha256) throw Error('Source asset changed');
  const length = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + length));
  const bin = bytes.subarray(28 + length);
  const images = doc.images.map((image) => {
    const view = doc.bufferViews[image.bufferView];
    const start = view.byteOffset ?? 0;
    return {
      name: image.name,
      mimeType: image.mimeType,
      bytes: view.byteLength,
      sha256: sha(bin.subarray(start, start + view.byteLength)),
    };
  });
  return { project, build, doc, images };
}
const old = await load(before),
  next = await load(after);
check(
  'Explicit r1 to r2 content revision',
  old.project.revision === 'r1' && next.project.revision === 'r2',
);
for (const p of [old.project, next.project]) {
  check(
    p.revision + ' one course checkpoint only',
    p.courses.length === 1 && p.courses[0].id === 'harbor-docks-01',
  );
}
const course = (p) => p.courses.map(({ revision, ...rest }) => rest);
check(
  'Every course field except revision is exact, including routes, bounds, spawn, physics and actors',
  same(course(old.project), course(next.project)),
);
for (const key of ['anchors', 'colliders'])
  check('Exact source ' + key, same(old.project.source[key], next.project.source[key]));
for (const key of [
  'spawnBindings',
  'routeBindings',
  'overrides',
  'themes',
  'campaigns',
  'playlists',
])
  check('Exact project ' + key, same(old.project[key], next.project[key]));
const markerNodes = (doc) => doc.nodes.filter((n) => n.extras?.rl);
check('Exact serialized semantic marker nodes', same(markerNodes(old.doc), markerNodes(next.doc)));
check(
  'All 38 collision records retained',
  old.project.source.colliders.length === 38 && next.project.source.colliders.length === 38,
);
for (const key of ['materials', 'textures', 'samplers', 'extensionsUsed', 'extensionsRequired'])
  check('Exact GLB ' + key, same(old.doc[key], next.doc[key]));
check(
  'Both original embedded PNG byte streams exact',
  old.images.length === 2 && same(old.images, next.images),
);
check(
  'Ten imported material batches retained',
  next.doc.materials.length === 10 && next.doc.meshes.length === old.doc.meshes.length,
);
check(
  'Revised scene within unchanged authoring limits',
  next.build.source.triangles <= 15000 &&
    next.build.source.bytes <= 1.5 * 1024 * 1024 &&
    next.build.source.colliders <= 44,
);
check('Prepared GLB validator has zero errors', next.build.prepared.validatorErrors === 0);
const receipt = {
  format: 'FPVHarborRefinementComparison.v1',
  scope:
    'Frozen r1/r2 source and project identity checks. No visual, ordinary-flight or performance acceptance.',
  before: old.build,
  after: next.build,
  imageBytes: next.images,
  triangleDelta: next.build.source.triangles - old.build.source.triangles,
  checks,
  passed: checks.every((c) => c.passed),
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    passed: receipt.passed,
    checks: checks.length,
    triangleDelta: receipt.triangleDelta,
  }),
);
if (!receipt.passed) process.exitCode = 1;
