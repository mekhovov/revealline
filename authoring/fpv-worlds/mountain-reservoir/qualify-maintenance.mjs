#!/usr/bin/env node
// Manual serialized candidate audit, independent of the geometry generator.
// Actual appearance and far/grazing depth remain native-renderer observations.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const [beforeRoot, afterRoot, out] = process.argv.slice(2);
if (!beforeRoot || !afterRoot || !out) throw Error('Use EXACT_R15 NEW_R16 RECEIPT');
const checks = [],
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
  const a = m.doc.accessors[index],
    data = view(m, a.bufferView),
    width =
      { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] *
      { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType],
    stride = m.doc.bufferViews[a.bufferView].byteStride ?? width;
  if (!width || a.sparse) throw Error('Unsupported attribute layout');
  return Buffer.concat(
    Array.from({ length: a.count }, (_, i) => {
      const start = (a.byteOffset ?? 0) + i * stride;
      return data.subarray(start, start + width);
    }),
  );
}
const floats = (b) => Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
const beforeBytes = await readFile(path.join(beforeRoot, 'mountain-reservoir-source.glb')),
  afterBytes = await readFile(path.join(afterRoot, 'mountain-reservoir-source.glb')),
  before = parse(beforeBytes),
  after = parse(afterBytes),
  expectedAdded = {
    'closed-window': 16,
    'chalk-enamel': 49,
    'blue-enamel': 21,
    'oxidized-roof': 6,
  },
  removed = { 'closed-window': 24, 'chalk-enamel': 96 },
  triangles = [];
check(
  'Exact accepted r15 source',
  sha(beforeBytes) === '3215632ac49f9c7142858744140165dd1382b3fda3ea40a7b864688b7305d898',
);
check('Source below unchanged 1.2MiB target', afterBytes.length < 1.2 * 1024 * 1024);
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
for (const mesh of before.doc.meshes) {
  const primitive = mesh.primitives[0];
  for (const [name, index] of Object.entries(primitive.attributes)) {
    const b = attribute(before, index),
      a = attribute(after, index),
      cut = (removed[mesh.name] ?? 0) * 9 * 4;
    if (!(mesh.name in expectedAdded)) {
      check(mesh.name + '/' + name + ' exact bytes', b.equals(a));
      continue;
    }
    check(
      mesh.name + ' existing untextured attribute layout',
      ['POSITION', 'NORMAL'].includes(name),
    );
    check(
      mesh.name + '/' + name + ' all retained attributes exact',
      b.subarray(cut).equals(a.subarray(0, b.length - cut)),
    );
    const added = a.subarray(b.length - cut);
    check(
      mesh.name + '/' + name + ' exact bounded append',
      added.length === expectedAdded[mesh.name] * 9 * 4,
    );
    if (name === 'NORMAL') {
      const n = floats(added);
      check(
        mesh.name + ' outward planar normals',
        n.every(
          (_, i) =>
            i % 3 ||
            (n[i] === 1 && n[i + 1] === 0 && n[i + 2] === 0) ||
            (n[i] === 0 && n[i + 1] === 0 && n[i + 2] === 1),
        ),
      );
      continue;
    }
    const p = floats(added);
    for (let i = 0; i < p.length; i += 9) {
      const v = [p.slice(i, i + 3), p.slice(i + 3, i + 6), p.slice(i + 6, i + 9)],
        east = v.every((q) => Math.abs(q[0] + 17.95) < 1e-6),
        front = v.every((q) => Math.abs(q[2] + 10.95) < 1e-6);
      check(
        mesh.name + ' triangle ' + i / 9 + ' one closed face only',
        east !== front &&
          v.every(
            ([x, y, z]) =>
              y >= 0.059999 && y <= 3.571 && (east ? z >= -19 && z <= -11 : x >= -26 && x <= -18),
          ),
      );
      triangles.push({
        role: mesh.name,
        plane: east ? 'east' : 'front',
        points: v.map(([x, y, z]) => [east ? -z : x, y]),
      });
    }
    if (cut) {
      const old = floats(b.subarray(0, cut));
      check(
        mesh.name + ' removed triangles confined to exact old east-window boxes',
        old.every((v, i) =>
          i % 3 === 0
            ? v >= -17.993 && v <= -17.924
            : i % 3 === 1
              ? v >= 1.924 && v <= 3.561
              : v >= -17.841 && v <= -12.359,
        ),
      );
    }
  }
}
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
  area = (p) =>
    Math.abs(
      p.reduce((s, a, i) => {
        const b = p[(i + 1) % p.length];
        return s + a[0] * b[1] - a[1] * b[0];
      }, 0),
    ) / 2;
// Convex triangle clipping independently detects overlapping coloured regions.
function intersect(subject, clip) {
  let result = subject;
  for (let i = 0; i < 3; i++) {
    const a = clip[i],
      b = clip[(i + 1) % 3],
      input = result;
    result = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j],
        q = input[(j + 1) % input.length],
        dp = cross(a, b, p),
        dq = cross(a, b, q);
      if (dp >= -1e-10) result.push(p);
      if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
        const t = dp / (dp - dq);
        result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
  }
  return result;
}
check(
  'Exactly 92 new triangles below 96 target; remove 120 redundant triangles',
  triangles.length === 92,
);
let maxOverlap = 0;
for (const t of triangles)
  check('Nondegenerate outward triangle ' + triangles.indexOf(t), cross(...t.points) > 1e-7);
for (let i = 0; i < triangles.length; i++)
  for (let j = i + 1; j < triangles.length; j++)
    if (triangles[i].plane === triangles[j].plane)
      maxOverlap = Math.max(maxOverlap, area(intersect(triangles[i].points, triangles[j].points)));
check('No overlapping new coplanar coloured surfaces after serialization', maxOverlap < 1e-7);
const within = (t, x0, y0, x1, y1) =>
    t.points.every(
      ([x, y]) => x >= x0 - 2e-6 && x <= x1 + 2e-6 && y >= y0 - 2e-6 && y <= y1 + 2e-6,
    ),
  covered = (plane, x0, y0, x1, y1, role) =>
    triangles
      .filter((t) => t.plane === plane && (!role || t.role === role) && within(t, x0, y0, x1, y1))
      .reduce((sum, t) => sum + area(t.points), 0);
check(
  'Maintenance badge is fully filled opaque partition',
  Math.abs(covered('front', -22.9, 2.95, -21.1, 3.57) - 1.8 * 0.62) < 3e-6,
);
check(
  'Closed vent is fully filled opaque plate',
  Math.abs(covered('front', -25.175, 2.4, -24.425, 3) - 0.75 * 0.6) < 3e-6,
);
for (const u of [15 - 8 / 3, 15, 15 + 8 / 3]) {
  check(
    'Pane at ' + u + ' matches existing canonical lower mark',
    Math.abs(covered('east', u - 0.55, 0.875, u + 0.55, 1.925, 'closed-window') - 1.1 * 1.05) <
      3e-6,
  );
  check(
    'Pane/frame at ' + u + ' entire closed rectangle',
    Math.abs(covered('east', u - 0.67, 0.755, u + 0.67, 2.045) - 1.34 * 1.29) < 3e-6,
  );
}
check(
  'No new front paint overlaps existing closed door or amber lintel',
  triangles
    .filter((t) => t.plane === 'front')
    .every((t) => t.points.every(([x, y]) => x <= -22.825 || x >= -21.175 || y >= 2.55)),
);
const oldProject = JSON.parse(await readFile(path.join(beforeRoot, 'prepared/project.json'))),
  project = JSON.parse(await readFile(path.join(afterRoot, 'prepared/project.json'))),
  noRevision = (v) => JSON.stringify(v, (k, x) => (k === 'revision' ? undefined : x));
check('New explicit r16 identity', oldProject.revision === 'r15' && project.revision === 'r16');
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
  preparedBytes = await readFile(path.join(afterRoot, 'prepared', project.world.modelAsset)),
  prepared = parse(preparedBytes);
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
for (const mesh of before.doc.meshes.filter((m) => !(m.name in expectedAdded))) {
  const old = oldPrepared.doc.meshes.find((m) => m.name === mesh.name),
    current = prepared.doc.meshes.find((m) => m.name === mesh.name);
  for (const [name, index] of Object.entries(old.primitives[0].attributes))
    check(
      'Prepared ' + mesh.name + '/' + name + ' exact bytes',
      attribute(oldPrepared, index).equals(
        attribute(prepared, current.primitives[0].attributes[name]),
      ),
    );
}
const build = JSON.parse(await readFile(path.join(afterRoot, 'world-build.json')));
check('Prepared validator zero errors', build.prepared.validatorErrors === 0);
check(
  'Exact resource counts; triangle budget reduced by 28',
  same(
    Object.fromEntries(
      ['triangles', 'materials', 'nodes', 'textures', 'colliders', 'collisionTriangles'].map(
        (k) => [k, build.source[k]],
      ),
    ),
    {
      triangles: 12260,
      materials: 13,
      nodes: 60,
      textures: 3,
      colliders: 48,
      collisionTriangles: 108,
    },
  ),
);
await writeFile(
  out,
  JSON.stringify(
    {
      format: 'FPVReservoirMaintenanceQualification.v1',
      beforeSHA256: sha(beforeBytes),
      afterSHA256: sha(afterBytes),
      preparedSHA256: sha(preparedBytes),
      checks,
      newTriangles: 92,
      removedTriangles: 120,
      maximumOverlapSquareMetres: maxOverlap,
      limitations: [
        'Serialized ownership/collision/closed-partition audit, not visual acceptance.',
        'Actual low/balanced/high, Pixel/shared, grazing and roof views still required.',
        'No fresh16 ordinary proofs for this intermediate art candidate.',
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
    sourceBytes: afterBytes.length,
    newTriangles: triangles.length,
    maxOverlap,
    receipt: out,
  }),
);
