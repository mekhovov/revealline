#!/usr/bin/env node
// Manual source-bound CPU qualification; not additional unit-test coverage.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
import { builtinWorldScene } from '../optional-practice/civilian-fpv/world-assets.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/demonstrations.mjs';
import { resolveSimThemeProfile } from '../optional-practice/civilian-fpv/world-themes.mjs';
import { dataIdentity } from '../game/data-json.mjs';

const baseline = 'cd2e6bc5dc0e8af7d1d30705632697cc97562dc1',
  root = new URL('../', import.meta.url),
  prefix = 'optional-practice/civilian-fpv/',
  visualPath = prefix + 'world-visuals.mjs',
  args = process.argv.slice(2),
  checks = [],
  scenes = [],
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  git = (...values) => execFileSync('git', values, { cwd: root, maxBuffer: 16 * 1024 * 1024 }),
  old = (path) => git('show', baseline + ':' + path),
  candidateSource = await readFile(new URL(visualPath, root)),
  close = (a, b, epsilon = 0.00001) => Math.abs(a - b) < epsilon;
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Use --out NEW_RECEIPT.json');
const check = (name, pass, details = undefined) => {
  checks.push({ name, passed: !!pass, ...(details === undefined ? {} : { details }) });
  assert(pass, name);
};
const immutable = {},
  runtimeFiles = git('ls-tree', '-r', '--name-only', baseline, '--', prefix)
    .toString()
    .trim()
    .split('\n');
check(
  'tracked runtime and asset file list is unchanged',
  runtimeFiles.join('\n') === git('ls-files', '--', prefix).toString().trim(),
);
check(
  'no untracked runtime assets',
  git('ls-files', '--others', '--exclude-standard', '--', prefix).length === 0,
);
for (const path of [
  ...runtimeFiles.filter((path) => path !== visualPath),
  'game/data-json.mjs',
  'game/presentation/theme-system.mjs',
  'game/hunt/actor-catalog.mjs',
  'game/hunt/preferences.mjs',
]) {
  const bytes = await readFile(new URL(path, root));
  check(path + ': exact baseline input', bytes.equals(old(path)));
  immutable[path] = hash(bytes);
}
async function sourceModule(path, bytes) {
  const source = bytes
    .toString()
    .replace(
      /from '(\.[^']+)'/g,
      (_, relative) => `from '${new URL(relative, new URL(path, root)).href}'`,
    );
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}
const before = await sourceModule(visualPath, old(visualPath)),
  after = await sourceModule(visualPath, candidateSource),
  oldCatalogue = await sourceModule(
    prefix + 'world-catalogue.mjs',
    old(prefix + 'world-catalogue.mjs'),
  ),
  catalogue = [
    ...new Map(
      [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((entry) => [entry.id, entry]),
    ).values(),
  ],
  coasts = catalogue.filter((entry) => entry.course.environment === 'coast'),
  canonical = coasts[0]?.course.obstacles.find(
    (obstacle) => obstacle.id === 'coast-tower-lighthouse',
  ),
  collections = Object.keys(after.SIM_VISUAL_COLLECTIONS),
  roles = ['shell', 'band', 'pane', 'trim'],
  landmark = (item) => item.userData.role === 'coast-lighthouse-landmark';
check(
  'five Coast courses with one unchanged arena bounds',
  coasts.length === 5 &&
    new Set(coasts.map((entry) => JSON.stringify(entry.course.bounds))).size === 1,
);
check(
  'all 17 shared collections retain identity',
  collections.length === 17 &&
    jsonHash(collections) === jsonHash(Object.keys(before.SIM_VISUAL_COLLECTIONS)),
);
check(
  'canonical lighthouse retains its exact 6 by 22 by 6 metre collision box',
  jsonHash(canonical) ===
    jsonHash({
      id: 'coast-tower-lighthouse',
      min: { x: 40000, y: 0, z: -46000 },
      max: { x: 46000, y: 22000, z: -40000 },
    }),
);
const courseIdentities = [];
for (const entry of coasts) {
  const prior = oldCatalogue.WORLD_CATALOGUE.find((row) => row.id === entry.id);
  check(
    entry.id + ': exact course, collision, actor, objective and identity data',
    !!prior &&
      jsonHash(prior.course) === jsonHash(entry.course) &&
      dataIdentity(prior.course) === dataIdentity(entry.course),
  );
  check(entry.id + ': no imported builtin GLB exists', builtinWorldScene(entry.course) === null);
  courseIdentities.push({
    course: entry.id,
    dataIdentity: dataIdentity(entry.course),
    sha256: jsonHash(entry.course),
  });
}
const coastIds = new Set(coasts.map((entry) => entry.id));
check(
  'no installed World or legacy Coast demonstrations are claimed',
  WORLD_DEMONSTRATIONS.every((row) => !coastIds.has(row.proof.course)) &&
    FLIGHT_DEMONSTRATIONS.every((row) => !coastIds.has(row.course)),
);

function nodeMaterials(item, module) {
  return [
    ...(Array.isArray(item.material) ? item.material : [item.material]),
    ...module.ownedSimMaterials(item),
    item.customDepthMaterial,
    item.customDistanceMaterial,
  ].filter(Boolean);
}
function build(module, original, quality, appearance) {
  const course = structuredClone(original);
  if (appearance === 'pixel') course.world = { ...course.world, theme: 'pixel' };
  const world = new THREE.Group(),
    materials = new Set(),
    material = (color, extras = {}) => {
      const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extras });
      materials.add(paint);
      return paint;
    },
    mesh = (geometry, paint, parent = world) => {
      const value = new THREE.Mesh(geometry, paint);
      parent.add(value);
      return value;
    },
    box = (size, at, color, parent) => {
      const value = mesh(new THREE.BoxGeometry(...size), material(color), parent);
      value.position.set(...at);
      return value;
    },
    presentation = {
      collectionId: appearance === 'pixel' ? 'authored' : appearance,
      revision: 'r1',
    };
  const surroundings = module.buildWorldVisuals({
    course,
    world,
    mesh,
    material,
    box,
    quality,
    maxAnisotropy: 8,
    presentation,
  });
  // Actual renderObstacle requests these lazily. Initialize the same owners on
  // both sides before counting the reused concrete maps for lighthouse paint.
  for (const obstacle of course.obstacles ?? []) {
    const kind = surroundings.obstacleSurfaceKind(obstacle);
    if (kind) surroundings.obstacleSurface(kind);
  }
  world.traverse((item) => {
    for (const paint of nodeMaterials(item, module)) materials.add(paint);
  });
  module.setSurfaceQuality(materials, quality, 8);
  world.updateMatrixWorld(true);
  return { world, module, course, presentation };
}
function typedBytes(value) {
  return hash(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
}
function valueData(value) {
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value))
    return value;
  if (typeof value === 'function') return value.toString();
  if (ArrayBuffer.isView(value)) return { type: value.constructor.name, hash: typedBytes(value) };
  if (typeof value.toArray === 'function') return value.toArray();
  if (Array.isArray(value)) return value.map(valueData);
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, valueData(item)]),
  );
}
function textureData(texture) {
  return {
    metadata: valueData(
      Object.fromEntries(
        Object.entries(texture).filter(
          ([key]) =>
            !['uuid', 'source', 'userData', 'version', 'onUpdate', '_listeners'].includes(key),
        ),
      ),
    ),
    image: {
      width: texture.image?.width,
      height: texture.image?.height,
      pixels: texture.image?.data ? typedBytes(texture.image.data) : null,
    },
    surface: texture.userData.surface
      ? {
          kind: texture.userData.surface.kind,
          seed: texture.userData.surface.seed,
          color: valueData(texture.userData.surface.color),
          pixel: texture.userData.surface.pixel,
          size: texture.userData.surface.size,
        }
      : null,
    userData: valueData(
      Object.fromEntries(Object.entries(texture.userData).filter(([key]) => key !== 'surface')),
    ),
  };
}
function paintData(paint) {
  return Object.fromEntries(
    Object.entries(paint)
      .filter(([key]) => !['uuid', 'id', 'version', '_listeners'].includes(key))
      .map(([key, value]) => [key, value?.isTexture ? textureData(value) : valueData(value)]),
  );
}
function geometryData(geometry) {
  return {
    type: geometry.type,
    index: geometry.index ? typedBytes(geometry.index.array) : null,
    groups: geometry.groups,
    drawRange: geometry.drawRange,
    attributes: Object.fromEntries(
      Object.entries(geometry.attributes).map(([key, attribute]) => [
        key,
        {
          itemSize: attribute.itemSize,
          count: attribute.count,
          normalized: attribute.normalized,
          hash: typedBytes(attribute.array),
        },
      ]),
    ),
  };
}
function snapshot({ world, module }) {
  const objects = [],
    newMaterials = new Set();
  world.traverse((item) => {
    if (landmark(item)) for (const paint of nodeMaterials(item, module)) newMaterials.add(paint);
  });
  world.traverse((item) => {
    if (!item.geometry || landmark(item)) return;
    objects.push({
      name: item.name,
      geometry: geometryData(item.geometry),
      matrix: item.matrixWorld.elements,
      visible: item.visible,
      castShadow: item.castShadow,
      receiveShadow: item.receiveShadow,
      userData: valueData(item.userData),
      instanceMatrix: item.instanceMatrix ? typedBytes(item.instanceMatrix.array) : null,
      instanceColor: item.instanceColor ? typedBytes(item.instanceColor.array) : null,
      paints: (Array.isArray(item.material) ? item.material : [item.material]).map(paintData),
    });
  });
  return jsonHash({
    objects,
    owned: module
      .ownedSimMaterials(world)
      .filter((paint) => !newMaterials.has(paint))
      .map(paintData)
      .sort((a, b) => jsonHash(a).localeCompare(jsonHash(b))),
  });
}
function resources({ world, module }) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set(),
    instances = new Set();
  world.traverse((item) => {
    if (item.geometry) geometries.add(item.geometry);
    if (item.isInstancedMesh) instances.add(item);
    for (const paint of nodeMaterials(item, module)) {
      materials.add(paint);
      for (const value of Object.values(paint)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries, materials, textures, instances };
}
function resourceCounts(built) {
  return Object.fromEntries(
    Object.entries(resources(built)).map(([key, values]) => [key, values.size]),
  );
}
function dispose(built) {
  const items = new Set(Object.values(resources(built)).flatMap((set) => [...set])),
    counts = new Map();
  for (const item of items)
    item.addEventListener('dispose', () => counts.set(item, (counts.get(item) ?? 0) + 1));
  built.module.disposeSimVisualGroup(built.world);
  assert(
    [...items].every((item) => counts.get(item) === 1),
    'all owned resources disposed exactly once',
  );
  assert.equal(built.world.children.length, 0);
  return items.size;
}
function verifyGeometry(rows, obstacle, label) {
  check(
    label + ': exactly four named layered batches',
    rows.length === 4 &&
      jsonHash(rows.map((row) => row.role)) === jsonHash(roles) &&
      new Set(rows.map((row) => row.layer)).size === 4 &&
      rows.every((row) => Number.isInteger(row.layer) && row.layer > 0),
  );
  const axes = ['x', 'y', 'z'],
    min = axes.map((axis) => obstacle.min[axis] / 1000),
    max = axes.map((axis) => obstacle.max[axis] / 1000);
  let vertices = 0,
    triangles = 0;
  for (const { geometry } of rows) {
    const positions = geometry.attributes.position,
      normals = geometry.attributes.normal,
      uv = geometry.attributes.uv;
    assert(positions && normals && uv);
    assert.equal(positions.count, normals.count);
    assert.equal(positions.count, uv.count);
    vertices += positions.count;
    triangles += (geometry.index?.count ?? positions.count) / 3;
    for (let i = 0; i < positions.count; i++) {
      const point = [positions.getX(i), positions.getY(i), positions.getZ(i)],
        n = [normals.getX(i), normals.getY(i), normals.getZ(i)],
        face = n.findIndex((value) => Math.abs(value) > 0.5);
      assert(
        face >= 0 && n.every((value, axis) => close(value, axis === face ? Math.sign(n[face]) : 0)),
        'axis-aligned outward normal',
      );
      assert(
        point.every(
          (value, axis) =>
            Number.isFinite(value) && value >= min[axis] - 0.00001 && value <= max[axis] + 0.00001,
        ),
        'vertex remains inside the original closed lighthouse envelope',
      );
      assert(
        close(point[face], n[face] > 0 ? max[face] : min[face]),
        'every painted vertex lies on the correctly oriented existing box face',
      );
      assert(
        Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)),
        'finite existing material UVs',
      );
    }
    const indices = geometry.index
      ? Array.from(geometry.index.array)
      : Array.from({ length: positions.count }, (_, i) => i);
    for (let i = 0; i < indices.length; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, indices[i]),
        b = new THREE.Vector3().fromBufferAttribute(positions, indices[i + 1]),
        c = new THREE.Vector3().fromBufferAttribute(positions, indices[i + 2]),
        n = new THREE.Vector3().fromBufferAttribute(normals, indices[i]);
      assert(b.sub(a).cross(c.sub(a)).dot(n) > 0.000001, 'nondegenerate outward triangle winding');
    }
  }
  check(
    label + ': at most 80 flush quads and 160 triangles',
    triangles > 0 && Number.isInteger(triangles) && triangles % 2 === 0 && triangles <= 160,
    { vertices, triangles },
  );
  return { vertices, triangles };
}
const geometryRows = after.buildCoastLighthouseGeometry(canonical),
  geometryBudget = verifyGeometry(geometryRows, canonical, 'canonical lighthouse');
const canonicalGeometry = geometryRows.map(({ role, layer, geometry }) => ({
  role,
  layer,
  geometry: geometryData(geometry),
}));
geometryRows.forEach((row) => row.geometry.dispose());
for (const entry of coasts) {
  const obstacle = entry.course.obstacles.find((row) => row.id === canonical.id),
    rows = after.buildCoastLighthouseGeometry(obstacle);
  check(
    entry.id + ': same bounded canonical landmark geometry',
    jsonHash(
      rows.map(({ role, layer, geometry }) => ({ role, layer, geometry: geometryData(geometry) })),
    ) === jsonHash(canonicalGeometry),
  );
  rows.forEach((row) => row.geometry.dispose());
}
const translated = structuredClone(canonical),
  translation = [17000, 7000, -23000];
for (const [i, axis] of ['x', 'y', 'z'].entries())
  for (const end of ['min', 'max']) translated[end][axis] += translation[i];
const shifted = after.buildCoastLighthouseGeometry(translated),
  original = after.buildCoastLighthouseGeometry(canonical);
verifyGeometry(shifted, translated, 'translated canonical lighthouse');
check(
  'same-dimension translated canonical box moves every mark by exactly its displacement',
  shifted.every((row, index) => {
    const a = original[index].geometry.attributes.position,
      b = row.geometry.attributes.position;
    return (
      a.count === b.count &&
      Array.from({ length: a.count }, (_, vertex) =>
        [0, 1, 2].every((axis) =>
          close(b.array[vertex * 3 + axis] - a.array[vertex * 3 + axis], translation[axis] / 1000),
        ),
      ).every(Boolean)
    );
  }),
);
[...shifted, ...original].forEach((row) => row.geometry.dispose());
const negative = [
  ['missing obstacle', undefined],
  ['null obstacle', null],
  ['empty obstacle', {}],
  ['different ID', { ...canonical, id: 'custom-lighthouse' }],
  ['explicit box type', { ...canonical, type: 'box' }],
  ['triangle mesh type', { ...canonical, type: 'trimesh' }],
  ['identity rotation', { ...canonical, rotation: [0, 0, 0, 1] }],
  ['rotated box', { ...canonical, rotation: [0, 0.7071068, 0, 0.7071068] }],
  ['missing bounds', { ...canonical, min: undefined }],
  ['nonfinite coordinate', { ...canonical, min: { ...canonical.min, x: NaN } }],
  ...['x', 'y', 'z'].map((axis) => [
    'changed ' + axis + ' dimension',
    { ...canonical, max: { ...canonical.max, [axis]: canonical.max[axis] + 1 } },
  ]),
];
for (const [label, obstacle] of negative)
  check(
    label + ': creator guard adds no marks',
    after.buildCoastLighthouseGeometry(obstacle).length === 0,
  );

for (const quality of ['low', 'balanced', 'high'])
  for (const appearance of ['authored', 'pixel', ...collections]) {
    const a = build(before, coasts[0].course, quality, appearance),
      b = build(after, coasts[0].course, quality, appearance),
      profile = resolveSimThemeProfile(b.course, b.presentation),
      pixel = profile.textureFilter === 'nearest',
      details = [];
    b.world.traverse((item) => {
      if (landmark(item)) details.push(item);
    });
    const label = coasts[0].id + '/' + quality + '/' + appearance;
    check(
      label +
        ': old meshes, geometry, transforms, material properties and texture pixels remain exact',
      snapshot(a) === snapshot(b),
    );
    check(
      label + ': four opaque role-owned batches or exact Pixel exclusion',
      details.length === (pixel ? 0 : 4) &&
        details.every(
          (item) =>
            item.name === 'coast-lighthouse-' + roles[details.indexOf(item)] &&
            item.userData.cosmeticDetail === true &&
            ['concrete', 'steel'].includes(item.userData.materialRole) &&
            !item.castShadow &&
            item.receiveShadow &&
            !item.material.transparent &&
            item.material.opacity === 1 &&
            item.material.depthWrite &&
            item.material.polygonOffset &&
            item.material.polygonOffsetFactor < 0 &&
            item.material.polygonOffsetUnits < 0,
        ),
    );
    if (!pixel) {
      const rows = after.buildCoastLighthouseGeometry(canonical);
      check(
        label + ': installed geometry matches the bounded helper and strict layer order',
        details.every(
          (item, index) =>
            jsonHash(geometryData(item.geometry)) ===
              jsonHash(geometryData(rows[index].geometry)) &&
            item.material.polygonOffsetFactor === -rows[index].layer &&
            item.material.polygonOffsetUnits === -rows[index].layer,
        ),
      );
      rows.forEach((row) => row.geometry.dispose());
      const solid = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 6), new THREE.MeshBasicMaterial());
      solid.position.set(43, 11, -43);
      solid.updateMatrixWorld(true);
      for (const axis of [0, 2])
        for (const side of [-1, 1])
          for (const height of [1, 5, 10, 15, 20, 21]) {
            const origin = new THREE.Vector3(43, height, -43),
              direction = new THREE.Vector3();
            origin.setComponent(axis, origin.getComponent(axis) + side * 10);
            direction.setComponent(axis, -side);
            const ray = new THREE.Raycaster(origin, direction),
              hit = ray.intersectObject(solid)[0],
              paints = ray.intersectObjects(details, true);
            assert(hit && close(hit.distance, 7));
            assert(paints.length > 0, 'closed shell paint covers each sampled wall location');
            for (const paint of paints)
              assert(
                close(paint.distance, hit.distance),
                'flush opaque artwork retains the original closed wall distance',
              );
          }
      solid.geometry.dispose();
      solid.material.dispose();
      check(label + ': painted faces cannot alter opaque wall distances', true);
    }
    const countsBefore = resourceCounts(a),
      countsAfter = resourceCounts(b);
    check(
      label + ': bounded four-geometry/four-material delta with no new textures or instances',
      countsAfter.geometries - countsBefore.geometries === (pixel ? 0 : 4) &&
        countsAfter.materials - countsBefore.materials === (pixel ? 0 : 4) &&
        countsAfter.textures === countsBefore.textures &&
        countsAfter.instances === countsBefore.instances,
      { before: countsBefore, after: countsAfter },
    );
    const disposedBefore = dispose(a),
      disposedAfter = dispose(b);
    check(label + ': every owned geometry/material/texture/instance disposed exactly once', true);
    scenes.push({
      course: coasts[0].id,
      quality,
      appearance,
      pixel,
      detailBatches: details.length,
      beforeResources: countsBefore,
      afterResources: countsAfter,
      disposedBefore,
      disposedAfter,
    });
  }
for (const [label, mutate] of [
  [
    'non-Coast canonical-looking course',
    (course) => {
      course.environment = 'quarry';
    },
  ],
  [
    'renamed creator obstacle',
    (course) => {
      course.obstacles = course.obstacles.map((o) => ({ ...o, id: 'custom-' + o.id }));
    },
  ],
  [
    'typed creator lighthouse',
    (course) => {
      course.obstacles.find((o) => o.id === canonical.id).type = 'box';
    },
  ],
  [
    'rotated creator lighthouse',
    (course) => {
      course.obstacles.find((o) => o.id === canonical.id).rotation = [0, 0, 0, 1];
    },
  ],
  [
    'resized creator lighthouse',
    (course) => {
      course.obstacles.find((o) => o.id === canonical.id).max.y += 1;
    },
  ],
]) {
  const course = structuredClone(coasts[0].course);
  mutate(course);
  const a = build(before, course, 'balanced', 'authored'),
    b = build(after, course, 'balanced', 'authored'),
    details = [];
  b.world.traverse((item) => {
    if (landmark(item)) details.push(item);
  });
  check(
    label + ': full scene remains exact with no landmark',
    details.length === 0 &&
      snapshot(a) === snapshot(b) &&
      jsonHash(resourceCounts(a)) === jsonHash(resourceCounts(b)),
  );
  dispose(a);
  dispose(b);
}
const unaffected = [
  ...new Map(
    catalogue
      .filter((entry) => entry.course.environment !== 'coast')
      .map((entry) => [entry.course.environment, entry]),
  ).values(),
];
check('all other 13 catalogue environments are represented', unaffected.length === 13);
for (const entry of unaffected) {
  const a = build(before, entry.course, 'balanced', 'authored'),
    b = build(after, entry.course, 'balanced', 'authored');
  check(
    entry.course.environment + ': unrelated scene, materials and resources remain exact',
    snapshot(a) === snapshot(b) && jsonHash(resourceCounts(a)) === jsonHash(resourceCounts(b)),
  );
  dispose(a);
  dispose(b);
}
const historical = JSON.parse(
    await readFile(new URL('docs/evidence/fpv-adventures-physics-20261002.json', root)),
  ),
  archiveManifest = JSON.parse(
    await readFile(new URL('docs/evidence/fpv-adventures-proof-archive-20261002.json', root)),
  ),
  priorProofs = historical.results.filter((row) => coastIds.has(row.id));
const historicalAudit = {
  format: historical.format,
  recordedAt: historical.finishedAt,
  proofCount: priorProofs.length,
  ticks: priorProofs.reduce((sum, row) => sum + row.ticks, 0),
  allPreviouslyCompletedAndReplayed: priorProofs.every((row) => row.completed && row.replayed),
  proofs: priorProofs.map(({ id, mode, ticks, proofSha256, finalStateIdentity }) => ({
    id,
    mode,
    ticks,
    proofSha256,
    finalStateIdentity,
  })),
  archive: archiveManifest.archive,
  archiveAvailable: false,
  freshReplayPerformed: false,
  note: 'Historical Adventure authoring qualification, separate from installed demonstrations and this CPU art check. No new replay claim.',
};
try {
  const bytes = await readFile(archiveManifest.archive);
  check(
    'retained historical Adventure archive matches its recorded bytes and SHA-256',
    bytes.length === archiveManifest.archiveBytes && hash(bytes) === archiveManifest.archiveSha256,
  );
  historicalAudit.archiveAvailable = true;
  historicalAudit.archiveBytes = bytes.length;
  historicalAudit.archiveSha256 = hash(bytes);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
check(
  'qualified runtime bytes remained unchanged during the probe',
  candidateSource.equals(await readFile(new URL(visualPath, root))),
);
const receipt = {
  format: 'FPVCoastLighthouseCPU.v1',
  createdAt: new Date().toISOString(),
  baseline,
  candidate: git('rev-parse', 'HEAD').toString().trim(),
  candidateStatus: git('status', '--short').toString().trim(),
  visualSha256: hash(candidateSource),
  qualifierSha256: hash(await readFile(new URL(import.meta.url))),
  immutable,
  checks,
  courseIdentities,
  geometryBudget,
  scenes,
  historicalAudit,
  limitation:
    'CPU construction, geometry and ownership evidence only. No WebGL, image acceptance, fresh recording replay, package admission, public availability or device-performance claim.',
};
if (args.length)
  await writeFile(new URL(args[1], root), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    passed: checks.length,
    scenes: scenes.length,
    courses: coasts.length,
    geometryBudget,
    installedRecordings: 0,
    historicalProofs: priorProofs.length,
    visualSha256: receipt.visualSha256,
  }),
);
