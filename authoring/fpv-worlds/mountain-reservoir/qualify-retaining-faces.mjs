#!/usr/bin/env node
// Manual asset/collision-envelope qualification; actual grazing/art review is separate.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const [beforeRoot, afterRoot, receiptPath] = process.argv.slice(2);
if (!beforeRoot || !afterRoot) throw Error('Use FROZEN_R11_DIRECTORY NEW_RETAINING_DIRECTORY');
const sha = (b) => createHash('sha256').update(b).digest('hex'),
  checks = [],
  canonical = (v) =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canonical(v[k])]),
          )
        : v,
  eq = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function check(name, passed) {
  checks.push({ name, passed: !!passed });
  if (!passed) throw Error(name);
}
function glb(bytes) {
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
const beforeBytes = await readFile(path.join(beforeRoot, 'mountain-reservoir-source.glb')),
  afterBytes = await readFile(path.join(afterRoot, 'mountain-reservoir-source.glb')),
  before = glb(beforeBytes),
  after = glb(afterBytes);
check(
  'Exact visually accepted r11 source',
  sha(beforeBytes) === '503c49b5e29a3cb486272ca2d328b4d50b69fda82ba90d45bd76c37d2b29343a',
);
check('Unchanged source budget', afterBytes.length < 1.2 * 1024 * 1024);
const requiredCoating = after.doc.asset.generator.includes('r14-required-surface-coating'),
  coating = requiredCoating || after.doc.asset.generator.includes('r13-opaque-retaining-coating'),
  comparisonMaterials = structuredClone(after.doc.materials);
if (coating) {
  const mineral = comparisonMaterials.find((m) => m.name === 'mineral-ridge');
  check(
    'Exact mineral coating declaration',
    requiredCoating
      ? eq(mineral.extensions, {
          REVEALLINE_surface_coating: { version: 1, kind: 'opaque-finish' },
        })
      : eq(mineral.extras, {
          reveallineSurface: { format: 'SimSurfaceCoating.v1', kind: 'opaque-finish' },
        }),
  );
  delete mineral[requiredCoating ? 'extensions' : 'extras'];
}
if (requiredCoating)
  check(
    'Exactly one required source capability',
    eq(after.doc.extensionsUsed, ['REVEALLINE_surface_coating']) &&
      eq(after.doc.extensionsRequired, ['REVEALLINE_surface_coating']),
  );
check('Only exact declared coating material change', eq(before.doc.materials, comparisonMaterials));
for (const key of ['nodes', 'scenes', 'meshes', 'textures', 'samplers'])
  check(key + ' ownership exact', eq(before.doc[key], after.doc[key]));
for (let i = 0; i < 3; i++)
  check(
    'Image ' + i + ' exact',
    view(before, before.doc.images[i].bufferView).equals(
      view(after, after.doc.images[i].bufferView),
    ),
  );
let newPositions;
for (let i = 0; i < before.doc.meshes.length; i++) {
  const mesh = before.doc.meshes[i],
    attributes = mesh.primitives[0].attributes;
  for (const [key, index] of Object.entries(attributes)) {
    const b = attribute(before, index),
      a = attribute(after, index);
    check(mesh.name + '/' + key + ' original bytes exact', b.equals(a.subarray(0, b.length)));
    if (mesh.name !== 'mineral-ridge')
      check(mesh.name + '/' + key + ' no extra geometry', a.length === b.length);
    else if (key === 'POSITION') newPositions = a.subarray(b.length);
  }
}
check(
  'Bounded appended triangles only',
  newPositions?.length > 0 && newPositions.length % 36 === 0 && newPositions.length / 36 <= 278,
);
const [oldProject, project] = await Promise.all(
    [beforeRoot, afterRoot].map(async (r) =>
      JSON.parse(await readFile(path.join(r, 'prepared/project.json'))),
    ),
  ),
  noRevision = (v) => JSON.stringify(v, (k, x) => (k === 'revision' ? undefined : x));
check(
  'Distinct candidate revision',
  oldProject.revision === 'r11' &&
    project.revision === (requiredCoating ? 'r14' : coating ? 'r13' : 'r12'),
);
if (coating) {
  const prepared = glb(await readFile(path.join(afterRoot, 'prepared', project.world.modelAsset))),
    marked = prepared.doc.materials.filter((m) =>
      requiredCoating ? m.extensions?.REVEALLINE_surface_coating : m.extras?.reveallineSurface,
    );
  check(
    'Prepared GLB preserves exactly one fixed opaque coating declaration',
    marked.length === 1 &&
      marked[0].name === 'mineral-ridge' &&
      (requiredCoating
        ? eq(marked[0].extensions.REVEALLINE_surface_coating, {
            version: 1,
            kind: 'opaque-finish',
          }) && eq(prepared.doc.extensionsRequired, ['REVEALLINE_surface_coating'])
        : eq(marked[0].extras.reveallineSurface, {
            format: 'SimSurfaceCoating.v1',
            kind: 'opaque-finish',
          })),
  );
}
check(
  'Eight exact physical courses except revision',
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
  check(key + ' exact', eq(oldProject[key], project[key]));
const planes = [];
for (const t of project.courses[0].obstacles.filter((o) => o.type === 'trimesh')) {
  const points = Array.from({ length: t.vertices.length / 3 }, (_, i) =>
      t.vertices.slice(i * 3, i * 3 + 3).map((v) => v / 1000),
    ),
    n = points.length / 2,
    bottom = points[0][1],
    top = points[n][1],
    polygon = points.slice(0, n),
    centre = [0, 2].map((axis) => polygon.reduce((sum, p) => sum + p[axis], 0) / n);
  planes.push({ id: t.id, kind: 'top', polygon, top, normal: [0, 1, 0] });
  for (let i = 0; i < n; i++) {
    const a = points[i],
      b = points[(i + 1) % n],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = Math.hypot(dx, dz),
      normal = [-dz / length, 0, dx / length];
    if ((a[0] === -44 && b[0] === -44) || (a[2] === -34 && b[2] === -34)) continue;
    if (
      normal[0] * (centre[0] - (a[0] + b[0]) / 2) + normal[2] * (centre[1] - (a[2] + b[2]) / 2) >
      0
    )
      normal.forEach((v, k) => (normal[k] = -v));
    planes.push({ id: t.id, kind: 'side', a, b, dx, dz, length, bottom, top, normal });
  }
}
function inPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j],
      b = polygon[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      t = ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / (dx * dx + dz * dz);
    if (
      t >= -1e-6 &&
      t <= 1 + 1e-6 &&
      Math.hypot(p[0] - a[0] - t * dx, p[2] - a[2] - t * dz) < 1e-5
    )
      return true;
    if (
      a[2] > p[2] !== b[2] > p[2] &&
      p[0] < ((b[0] - a[0]) * (p[2] - a[2])) / (b[2] - a[2]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
const owners = new Set();
let greatestOffset = 0;
for (let i = 0; i < newPositions.length; i += 36) {
  const points = Array.from({ length: 3 }, (_, j) =>
    Array.from({ length: 3 }, (_, k) => newPositions.readFloatLE(i + (j * 3 + k) * 4)),
  );
  const matching = planes.filter((f) =>
    points.every((p) => {
      const distance =
        f.kind === 'top'
          ? p[1] - f.top
          : (p[0] - f.a[0]) * f.normal[0] + (p[2] - f.a[2]) * f.normal[2];
      // The authored offset is1.5mm; permit only Float32 coordinate quantization.
      if (Math.abs(distance - 0.0015) > 0.000006) return false;
      greatestOffset = Math.max(greatestOffset, distance);
      if (f.kind === 'top') return inPolygon(p, f.polygon);
      const along = ((p[0] - f.a[0]) * f.dx + (p[2] - f.a[2]) * f.dz) / (f.length * f.length);
      return along >= -1e-6 && along <= 1 + 1e-6 && p[1] >= f.bottom - 1e-6 && p[1] <= f.top + 1e-6;
    }),
  );
  check('Finish triangle ' + i / 36 + ' lies on one named canonical face', matching.length === 1);
  const f = matching[0],
    u = points[1].map((v, k) => v - points[0][k]),
    v = points[2].map((n, k) => n - points[0][k]),
    cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
    area2 = Math.hypot(...cross);
  check(
    'Finish triangle ' + i / 36 + ' has nondegenerate outward winding',
    area2 > 1e-6 && cross.reduce((sum, n, k) => sum + n * f.normal[k], 0) / area2 > 0.999,
  );
  owners.add(f.id);
}
check(
  'Exactly the five existing terrace owners',
  owners.size === 5 &&
    [...owners].every((id) =>
      /^(rock-west-(lower|middle|upper)|rock-north-(shoulder|terrace))$/.test(id),
    ),
);
const receipt = {
  format: 'FPVReservoirRetainingQualification.v1',
  status: 'passed',
  checks,
  before: { bytes: beforeBytes.length, sha256: sha(beforeBytes) },
  after: { bytes: afterBytes.length, sha256: sha(afterBytes) },
  addedTriangles: newPositions.length / 36,
  greatestOffsetMetres: greatestOffset,
  addedMaterials: 0,
  addedTextures: 0,
  addedMeshes: 0,
  collisionChanges: 0,
  routeChanges: 0,
  limits:
    'Static source/collision-face contracts only; grazing overlap, shadows, visual benefit, flight and hardware acceptance are separate.',
};
await writeFile(
  receiptPath ?? path.join(afterRoot, 'retaining-qualification.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    status: receipt.status,
    checks: checks.length,
    addedTriangles: receipt.addedTriangles,
    greatestOffset,
    bytes: afterBytes.length,
  }),
);
