#!/usr/bin/env node
// Bounded serialized scene audit; actual art review and final flights are separate.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createScene } from './source/scene.mjs';
const [beforeRoot, afterRoot, receiptPath] = process.argv.slice(2);
if (!beforeRoot || !afterRoot || !receiptPath) throw Error('Use FROZEN_R2 NEW_R3 NEW_RECEIPT');
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  checks = [];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(name, passed, detail) {
  checks.push({ name, passed: !!passed, ...(detail ? { detail } : {}) });
}
function glb(bytes) {
  if (
    bytes.readUInt32LE(0) !== 0x46546c67 ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw Error('Expected exact GLB2');
  const length = bytes.readUInt32LE(12);
  return { doc: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length) };
}
function view(model, index) {
  const v = model.doc.bufferViews[index];
  return model.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
}
function attribute(model, index) {
  const a = model.doc.accessors[index];
  if (a.byteOffset || model.doc.bufferViews[a.bufferView].byteStride)
    throw Error('Non-packed source attribute');
  return view(model, a.bufferView);
}
const beforeBytes = await readFile(path.join(beforeRoot, 'festival-grounds-source.glb'));
const afterBytes = await readFile(path.join(afterRoot, 'festival-grounds-source.glb'));
const before = glb(beforeBytes),
  after = glb(afterBytes);
check(
  'Exact frozen r2 original GLB',
  sha(beforeBytes) === '4825f1d3a46e0780a7a471e8b8435db7226400899dd635c5ba499fd5ac9d743d',
);
check(
  'Default source generator retains r2 bytes',
  Buffer.from(createScene().bytes).equals(beforeBytes),
);
check(
  'Candidate generator reproduces serialized r3 bytes',
  Buffer.from(createScene({ gathering: true }).bytes).equals(afterBytes),
);
check('Unchanged 1.5MiB source ceiling', afterBytes.length <= 1.5 * 1024 * 1024);
for (const key of ['materials', 'textures', 'samplers'])
  check(key + ' exact', equal(before.doc[key], after.doc[key]));
check(
  'Exactly twelve existing imported mesh/material batches',
  after.doc.meshes.length === 12 && after.doc.materials.length === 12,
);
check('Original two maps only', after.doc.images.length === 2 && before.doc.images.length === 2);
for (let i = 0; i < 2; i++)
  check(
    'Original map' + i + ' exact encoded PNG bytes',
    view(before, before.doc.images[i].bufferView).equals(
      view(after, after.doc.images[i].bufferView),
    ),
  );
check(
  'Every old mesh/anchor/collider node unchanged',
  equal(before.doc.nodes, after.doc.nodes.slice(0, before.doc.nodes.length)),
);
check('Only three new collider nodes', after.doc.nodes.length === before.doc.nodes.length + 3);
let oldTriangles = 0,
  addedTriangles = 0;
const allowed = new Set(['gravel', 'timber', 'blue', 'ochre', 'dark', 'chalk']);
for (let i = 0; i < before.doc.meshes.length; i++) {
  const b = before.doc.meshes[i],
    a = after.doc.meshes[i];
  const bp = b.primitives[0],
    ap = a.primitives[0];
  check(
    b.name + ' same primitive/material ownership',
    b.name === a.name &&
      a.primitives.length === 1 &&
      bp.material === ap.material &&
      bp.mode === ap.mode,
  );
  const p0 = attribute(before, bp.attributes.POSITION),
    p1 = attribute(after, ap.attributes.POSITION);
  oldTriangles += p0.length / 36;
  addedTriangles += (p1.length - p0.length) / 36;
  check(
    b.name + ' bounded append only',
    p1.length >= p0.length && (allowed.has(b.name) || p1.length === p0.length),
  );
  for (const key of Object.keys(bp.attributes)) {
    const old = attribute(before, bp.attributes[key]),
      next = attribute(after, ap.attributes[key]);
    check(
      b.name + '/' + key + ' old serialized bytes retained',
      next.subarray(0, old.length).equals(old),
    );
    const ac = before.doc.accessors[bp.attributes[key]],
      bc = after.doc.accessors[ap.attributes[key]];
    check(
      b.name + '/' + key + ' component contract retained',
      ac.type === bc.type &&
        ac.componentType === bc.componentType &&
        ac.normalized === bc.normalized,
    );
  }
  const newKeys = Object.keys(ap.attributes).filter((k) => !(k in bp.attributes));
  check(
    b.name + ' no undeclared new attributes',
    equal(newKeys, b.name === 'gravel' ? ['COLOR_0'] : []),
  );
  if (b.name === 'gravel') {
    const colors = attribute(after, ap.attributes.COLOR_0),
      ac = after.doc.accessors[ap.attributes.COLOR_0];
    check(
      'Gravel tint compact normalized RGBA8',
      ac.componentType === 5121 &&
        ac.type === 'VEC4' &&
        ac.normalized === true &&
        colors.length === p1.length / 3,
    );
    check(
      'All old gravel vertices retain opaque white',
      colors.subarray(0, p0.length / 3).every((v) => v === 255),
    );
    check(
      'New tint is subtle opaque luminance only',
      colors.every((v, n) => (n % 4 === 3 ? v === 255 : v >= 245 && v <= 255)),
    );
  }
  const normals = attribute(after, ap.attributes.NORMAL);
  let sane = true,
    scope = true;
  for (let at = p0.length; at < p1.length; at += 36) {
    const p = Array.from({ length: 9 }, (_, n) => p1.readFloatLE(at + n * 4));
    const u = [0, 1, 2].map((n) => p[n + 3] - p[n]),
      v = [0, 1, 2].map((n) => p[n + 6] - p[n]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    sane &&= p.every(Number.isFinite) && Math.hypot(...cross) > 1e-8;
    for (let n = 0; n < 9; n += 3) {
      const [x, y, z] = p.slice(n, n + 3),
        nx = normals.readFloatLE(at + n * 4),
        ny = normals.readFloatLE(at + (n + 1) * 4),
        nz = normals.readFloatLE(at + (n + 2) * 4);
      sane &&=
        Math.abs(Math.hypot(nx, ny, nz) - 1) < 1e-6 &&
        cross[0] * nx + cross[1] * ny + cross[2] * nz > 0;
      const table =
        x >= -36.351 && x <= -35.049 && y >= 0.914 && y <= 0.918 && z >= 13.749 && z <= 18.251;
      const panel =
        [-22, 22].some((cx) => Math.abs(x - cx) <= 2.56) &&
        [-2, 12].some((cz) => Math.abs(z - cz - 2.849) < 0.00001) &&
        y >= 1.05 &&
        y <= 2.43;
      const court = Math.abs(x) >= 34.999 && Math.abs(x) <= 40.001 && z >= 10.899 && z <= 22.601;
      const apron =
        Math.abs(x) >= 12.599 &&
        Math.abs(x) <= 18.151 &&
        [-2, 12].some((cz) => z >= cz - 3.501 && z <= cz + 3.801);
      scope &&=
        b.name === 'gravel'
          ? Math.abs(y - 0.018) < 0.000001 && (court || apron) && ny > 0.999
          : table || panel;
    }
  }
  check(b.name + ' additions finite/nondegenerate/outward', sane);
  check(b.name + ' additions stay within declared gathering/closed-wall regions', scope);
}
check('Increment <=256 imported triangles', addedTriangles > 0 && addedTriangles <= 256);
check('Final imported geometry <=12428 triangles', oldTriangles + addedTriangles <= 12428);
const beforeProject = JSON.parse(await readFile(path.join(beforeRoot, 'prepared/project.json')));
const afterProject = JSON.parse(await readFile(path.join(afterRoot, 'prepared/project.json')));
const oldCourse = beforeProject.courses[0],
  newCourse = afterProject.courses[0];
check(
  'All44 old colliders unchanged and only3 table solids appended',
  equal(oldCourse.obstacles, newCourse.obstacles.slice(0, 44)) && newCourse.obstacles.length === 47,
);
const expected = [
  ['picnic-west-top', [-36350, 780, 13750], [-35050, 910, 18250]],
  ['picnic-west-leg-a', [-36170, 0, 14350], [-35230, 780, 14510]],
  ['picnic-west-leg-b', [-36170, 0, 17490], [-35230, 780, 17650]],
].map(([id, min, max]) => ({
  id,
  min: Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, min[i]])),
  max: Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, max[i]])),
}));
check(
  'Three table collision envelopes exactly authored',
  equal(newCourse.obstacles.slice(44), expected),
);
check(
  'Existing routes/spawn/bounds/rules/actors unchanged',
  ['steps', 'spawn', 'bounds', 'rules', 'actors'].every((k) => equal(oldCourse[k], newCourse[k])),
);
check(
  'Explicit r3 course/pack revision',
  newCourse.revision === 'r3' && afterProject.revision === 'r3',
);
const receipt = {
  format: 'FPVFestivalGatheringQualification.v1',
  status: checks.every((c) => c.passed) ? 'passed' : 'failed',
  scope: 'Serialized source/asset/collision contract; not art acceptance or flight completion',
  before: { bytes: beforeBytes.length, sha256: sha(beforeBytes) },
  after: { bytes: afterBytes.length, sha256: sha(afterBytes) },
  importedTriangles: oldTriangles + addedTriangles,
  addedTriangles,
  colliders: 47,
  materialBatches: 12,
  originalMaps: 2,
  clearanceMillimetres: {
    tableToWestLaneEdge: 50,
    tableToBenchSeatEdge: 230,
    betweenPanelLegs: 2980,
    beneathTable: 780,
    westLaneWidth: 6000,
  },
  checks,
};
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify(
    {
      status: receipt.status,
      checks: checks.length,
      addedTriangles,
      failed: checks.filter((c) => !c.passed),
      receiptPath,
    },
    null,
    2,
  ),
);
if (receipt.status !== 'passed') process.exitCode = 1;
