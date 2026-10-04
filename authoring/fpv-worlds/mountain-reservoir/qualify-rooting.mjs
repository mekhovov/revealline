#!/usr/bin/env node
// Manual serialized-asset audit. Independent edge/vertex intersection checks;
// deliberately does not import the authoring clipper. Visual acceptance is separate.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const [beforeRoot, afterRoot, out] = process.argv.slice(2);
if (!beforeRoot || !afterRoot || !out)
  throw Error('Use EXACT_R14_DIRECTORY NEW_R15_DIRECTORY RECEIPT');
const checks = [],
  trees = [],
  sha = (b) => createHash('sha256').update(b).digest('hex'),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, passed) {
  checks.push({ name, passed: !!passed });
  if (!passed) throw Error(name);
}
function parse(bytes) {
  const n = bytes.readUInt32LE(12);
  return { doc: JSON.parse(bytes.subarray(20, 20 + n)), bin: bytes.subarray(28 + n) };
}
function view(m, index) {
  const v = m.doc.bufferViews[index];
  return m.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
}
function attribute(m, index) {
  const a = m.doc.accessors[index];
  if (a.byteOffset || m.doc.bufferViews[a.bufferView].byteStride)
    throw Error('Unexpected strided attribute');
  return view(m, a.bufferView);
}
const floats = (b) => Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
function positions(m, name) {
  const p = m.doc.meshes.find((x) => x.name === name).primitives[0];
  return floats(attribute(m, p.attributes.POSITION));
}
const beforeBytes = await readFile(path.join(beforeRoot, 'mountain-reservoir-source.glb')),
  afterBytes = await readFile(path.join(afterRoot, 'mountain-reservoir-source.glb')),
  before = parse(beforeBytes),
  after = parse(afterBytes);
check(
  'Exact accepted r14 source',
  sha(beforeBytes) === 'caf24d9c11ea4be3ee5db66a2e420ee06354c4a127d987ed15bba49ef344d0d5',
);
check('Unchanged source target', afterBytes.length < 1.2 * 1024 * 1024);
for (const key of [
  'nodes',
  'scenes',
  'meshes',
  'materials',
  'textures',
  'samplers',
  'extensionsUsed',
  'extensionsRequired',
])
  check(key + ' exact ownership/state', same(before.doc[key], after.doc[key]));
for (let i = 0; i < before.doc.images.length; i++)
  check(
    'Image ' + i + ' exact',
    view(before, before.doc.images[i].bufferView).equals(
      view(after, after.doc.images[i].bufferView),
    ),
  );
for (let i = 0; i < before.doc.meshes.length; i++) {
  const mesh = before.doc.meshes[i];
  for (const [name, index] of Object.entries(mesh.primitives[0].attributes)) {
    const b = attribute(before, index),
      a = attribute(after, index);
    check(mesh.name + '/' + name + ' same allocation size', b.length === a.length);
    if (mesh.name !== 'tree-bark') check(mesh.name + '/' + name + ' exact bytes', b.equals(a));
  }
}
const original = positions(before, 'tree-bark'),
  candidate = positions(after, 'tree-bark'),
  terrain = positions(before, 'mineral-ridge').slice(0, 5184 * 9),
  cross = (a, b) => a[0] * b[1] - a[1] * b[0],
  sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
function barycentric(p, triangle) {
  const [a, b, c] = triangle,
    denominator = cross(sub(b, a), sub(c, a)),
    v = cross(sub(p, a), sub(c, a)) / denominator,
    w = cross(sub(b, a), sub(p, a)) / denominator;
  return [1 - v - w, v, w];
}
function within(p, polygon) {
  return polygon.every(
    (a, i) => cross(sub(polygon[(i + 1) % polygon.length], a), sub(p, a)) >= -1e-8,
  );
}
function intersection(a, b, c, d) {
  const r = sub(b, a),
    s = sub(d, c),
    den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(c, a), s) / den,
    u = cross(sub(c, a), r) / den;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9
    ? [a[0] + t * r[0], a[1] + t * r[1]]
    : null;
}
let changed = 0;
for (let tree = 0; tree < 56; tree++) {
  const start = tree * 180,
    end = start + 180,
    ys = original.slice(start, end).filter((_, i) => i % 3 === 1),
    oldBottom = Math.min(...ys),
    oldTop = Math.max(...ys),
    newBottom = Math.min(...candidate.slice(start, end).filter((_, i) => i % 3 === 1)),
    unique = new Map();
  let topExact = true,
    xzExact = true,
    bottomOnly = true;
  for (let i = start; i < end; i += 3) {
    xzExact &&= candidate[i] === original[i] && candidate[i + 2] === original[i + 2];
    if (original[i + 1] !== oldBottom) topExact &&= candidate[i + 1] === original[i + 1];
    else bottomOnly &&= candidate[i + 1] === newBottom && newBottom <= oldBottom;
    if (original[i + 1] === oldBottom)
      unique.set(original[i] + ',' + original[i + 2], [original[i], original[i + 2]]);
  }
  const values = [...unique.values()],
    centre = values.reduce(
      (a, p) => [a[0] + p[0] / values.length, a[1] + p[1] / values.length],
      [0, 0],
    ),
    foot = values
      .filter((p) => Math.hypot(...sub(p, centre)) > 0.1)
      .sort(
        (a, b) =>
          Math.atan2(a[1] - centre[1], a[0] - centre[0]) -
          Math.atan2(b[1] - centre[1], b[0] - centre[0]),
      );
  let minimum = Infinity,
    extrema = 0;
  const cornersCovered = new Set();
  for (let k = 0; k < terrain.length; k += 9) {
    const verts = [
        terrain.slice(k, k + 3),
        terrain.slice(k + 3, k + 6),
        terrain.slice(k + 6, k + 9),
      ],
      tri = verts.map((p) => [p[0], p[2]]);
    if (
      Math.min(...tri.map((p) => p[0])) > centre[0] + 0.2 ||
      Math.max(...tri.map((p) => p[0])) < centre[0] - 0.2 ||
      Math.min(...tri.map((p) => p[1])) > centre[1] + 0.2 ||
      Math.max(...tri.map((p) => p[1])) < centre[1] - 0.2
    )
      continue;
    const candidates = tri.filter((p) => within(p, foot));
    foot.forEach((p, i) => {
      if (barycentric(p, tri).every((v) => v >= -1e-9)) {
        candidates.push(p);
        cornersCovered.add(i);
      }
      for (let e = 0; e < 3; e++) {
        const hit = intersection(p, foot[(i + 1) % 5], tri[e], tri[(e + 1) % 3]);
        if (hit) candidates.push(hit);
      }
    });
    for (const p of candidates) {
      const weights = barycentric(p, tri),
        height = weights.reduce((s, w, i) => s + w * verts[i][1], 0);
      minimum = Math.min(minimum, height);
      extrema++;
    }
  }
  check(
    'Tree ' + tree + ' exact horizontal footprint/top/crown attachment',
    xzExact && topExact && bottomOnly,
  );
  check(
    'Tree ' + tree + ' complete foot corners covered with intersected terrain extrema',
    foot.length === 5 && cornersCovered.size === 5 && extrema > 0 && Number.isFinite(minimum),
  );
  check('Tree ' + tree + ' entire foot embedded at least 79.99mm', minimum - newBottom >= 0.07999);
  check(
    'Tree ' + tree + ' complete footprint remains outside playable bounds',
    foot.every(([x, z]) => x < -44 || x > 6 || z < -34 || z > 38),
  );
  if (newBottom !== oldBottom) changed++;
  trees.push({
    tree,
    centre,
    oldBottom,
    newBottom,
    oldTop,
    minimum,
    originalGap: Math.max(0, oldBottom - minimum),
    embedDepth: minimum - newBottom,
    extrema,
  });
}
check('Exactly 55 existing trunk feet lowered for the bounded margin', changed === 55);
const bark = after.doc.meshes.find((m) => m.name === 'tree-bark').primitives[0],
  normals = floats(attribute(after, bark.attributes.NORMAL));
check(
  'All modified trunk normals finite and unit length',
  normals.every(Number.isFinite) &&
    normals.every((_, i) => i % 3 || Math.abs(Math.hypot(...normals.slice(i, i + 3)) - 1) < 1e-6),
);
const oldProject = JSON.parse(await readFile(path.join(beforeRoot, 'prepared/project.json'))),
  project = JSON.parse(await readFile(path.join(afterRoot, 'prepared/project.json'))),
  noRevision = (v) => JSON.stringify(v, (k, x) => (k === 'revision' ? undefined : x));
check('New explicit r15 identity', oldProject.revision === 'r14' && project.revision === 'r15');
check(
  'All eight complete courses/colliders/routes exact except revision',
  noRevision(oldProject.courses) === noRevision(project.courses),
);
for (const key of [
  'spawnBindings',
  'routeBindings',
  'overrides',
  'themes',
  'campaigns',
  'playlists',
])
  check(key + ' exact', same(oldProject[key], project[key]));
const oldPrepared = parse(
    await readFile(path.join(beforeRoot, 'prepared', oldProject.world.modelAsset)),
  ),
  prepared = parse(await readFile(path.join(afterRoot, 'prepared', project.world.modelAsset)));
for (const key of [
  'nodes',
  'scenes',
  'meshes',
  'materials',
  'textures',
  'samplers',
  'extensionsUsed',
  'extensionsRequired',
])
  check(
    'Prepared ' + key + ' exact ownership/state',
    same(oldPrepared.doc[key], prepared.doc[key]),
  );
check(
  'Prepared model validation has no errors',
  JSON.parse(await readFile(path.join(afterRoot, 'world-build.json'))).prepared.validatorErrors ===
    0,
);
await writeFile(
  out,
  JSON.stringify(
    {
      format: 'FPVReservoirRootContactQualification.v1',
      beforeSHA256: sha(beforeBytes),
      afterSHA256: sha(afterBytes),
      checks,
      trees,
      limitations: [
        'Independent serialized geometry/identity audit; actual root close/cluster/overview art acceptance still required.',
        'Scenery remains outside flight bounds. No added tree collision or changed gameplay.',
      ],
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    checks: checks.length,
    changed,
    maxOriginalGap: Math.max(...trees.map((t) => t.originalGap)),
    minimumEmbedding: Math.min(...trees.map((t) => t.embedDepth)),
    receipt: out,
  }),
);
