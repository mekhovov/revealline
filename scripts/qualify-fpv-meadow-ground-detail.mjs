#!/usr/bin/env node
// Manual CPU scene/recording qualification; no additional unit-test coverage.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
import * as after from '../optional-practice/civilian-fpv/world-visuals.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createBeginnerPreview } from '../optional-practice/civilian-fpv/beginner-coach.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/demonstrations.mjs';
import { replayFlight } from '../optional-practice/civilian-fpv/model.mjs';
import {
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';

const baseline = 'b3167a8f89c09286a424996ba4f7e3dca4a351b2',
  root = new URL('../', import.meta.url),
  prefix = 'optional-practice/civilian-fpv/',
  visualPath = prefix + 'world-visuals.mjs',
  args = process.argv.slice(2),
  checks = [],
  scenes = [],
  recordings = [],
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  git = (...values) => execFileSync('git', values, { cwd: root, maxBuffer: 16 * 1024 * 1024 }),
  old = (path) => git('show', baseline + ':' + path),
  sourceBytes = await readFile(new URL(visualPath, root)),
  visualSha256 = hash(sourceBytes);
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
  'tracked runtime/assets file list is unchanged',
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
  const current = await readFile(new URL(path, root));
  check(path + ' retains exact baseline bytes', current.equals(old(path)));
  immutable[path] = hash(current);
}
const source = old(visualPath)
    .toString()
    .replace(
      /from '(\.[^']+)'/g,
      (_, path) => `from '${new URL(path, new URL(visualPath, root)).href}'`,
    ),
  before = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')),
  catalogue = [
    ...new Map(
      [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((entry) => [entry.id, entry]),
    ).values(),
  ],
  fields = catalogue.filter((entry) => entry.course.environment === 'field'),
  representative = [
    ...new Map(fields.map((entry) => [JSON.stringify(entry.course.bounds), entry])).values(),
  ],
  collections = Object.keys(after.SIM_VISUAL_COLLECTIONS),
  qualities = ['low', 'balanced', 'high'];
check(
  '43 Meadow courses across four catalogue bounds',
  fields.length === 43 && representative.length === 4,
);
check(
  'all 17 shared collections retain identity',
  collections.length === 17 &&
    jsonHash(collections) === jsonHash(Object.keys(before.SIM_VISUAL_COLLECTIONS)),
);

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
    };
  module.buildWorldVisuals({
    course,
    world,
    mesh,
    material,
    box,
    quality,
    maxAnisotropy: 8,
    presentation: {
      collectionId: appearance === 'pixel' ? 'authored' : appearance,
      revision: 'r1',
    },
  });
  world.traverse((item) => {
    for (const paint of nodeMaterials(item, module)) materials.add(paint);
  });
  module.setSurfaceQuality(materials, quality, 8);
  world.updateMatrixWorld(true);
  const ground = world.children.filter(
    (item) =>
      item.geometry?.type === 'PlaneGeometry' &&
      item.geometry.parameters.width === (course.bounds.max.x - course.bounds.min.x) / 1000 + 100 &&
      item.geometry.parameters.height === (course.bounds.max.z - course.bounds.min.z) / 1000 + 100,
  );
  assert.equal(ground.length, 1, 'one existing ground plane');
  return { world, materials, ground: ground[0], module };
}
function nodeMaterials(item, module) {
  return [
    ...(Array.isArray(item.material) ? item.material : [item.material]),
    ...module.ownedSimMaterials(item),
    item.customDepthMaterial,
    item.customDistanceMaterial,
  ].filter(Boolean);
}
function bytes(value) {
  return hash(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
}
function valueData(value) {
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value))
    return value;
  if (ArrayBuffer.isView(value))
    return { type: value.constructor.name, length: value.length, hash: bytes(value) };
  if (typeof value.toArray === 'function') return value.toArray();
  if (Array.isArray(value)) return value.map(valueData);
  assert.equal(typeof value, 'object', 'snapshot value is serializable data');
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, valueData(item)]),
  );
}
function textureData(texture, allowed = false) {
  const surface = texture.userData.surface,
    metadata = Object.fromEntries(
      Object.entries(texture).filter(
        ([key]) =>
          !['uuid', 'source', 'userData', 'version', 'onUpdate', '_listeners'].includes(key),
      ),
    );
  if (allowed) metadata.name = '<authored-meadow-ground>';
  return {
    metadata: valueData(metadata),
    userData: valueData(
      Object.fromEntries(Object.entries(texture.userData).filter(([key]) => key !== 'surface')),
    ),
    surface: surface
      ? {
          kind: allowed ? '<authored-meadow-ground>' : surface.kind,
          color: valueData(surface.color),
          seed: surface.seed,
          pixel: surface.pixel,
          size: surface.size,
        }
      : null,
    image: {
      width: texture.image?.width,
      height: texture.image?.height,
      type: texture.image?.data?.constructor.name,
      bytes: texture.image?.data?.byteLength,
      pixels: allowed
        ? '<permitted-ground-pixels>'
        : texture.image?.data
          ? bytes(texture.image.data)
          : null,
    },
  };
}
function snapshot(built, allowGround = false) {
  const { world, ground, module } = built,
    geometries = [],
    materials = [],
    textures = [],
    nodes = [],
    geometryIds = new Map(),
    materialIds = new Map(),
    textureIds = new Map(),
    allowed = new Set(
      allowGround ? Object.values(ground.material).filter((value) => value?.isTexture) : [],
    ),
    textureId = (texture) => {
      if (!textureIds.has(texture)) {
        textureIds.set(texture, textures.length);
        textures.push(textureData(texture, allowed.has(texture)));
      }
      return textureIds.get(texture);
    },
    materialId = (paint) => {
      if (!materialIds.has(paint)) {
        materialIds.set(paint, materials.length);
        materials.push(
          Object.fromEntries(
            Object.entries(paint)
              .filter(([key]) => !['uuid', 'version', '_listeners'].includes(key))
              .map(([key, value]) => [
                key,
                value?.isTexture ? { texture: textureId(value) } : valueData(value),
              ]),
          ),
        );
      }
      return materialIds.get(paint);
    },
    geometryId = (geometry) => {
      if (!geometryIds.has(geometry)) {
        geometryIds.set(geometry, geometries.length);
        const attribute = (item) =>
          item
            ? {
                count: item.count,
                itemSize: item.itemSize,
                normalized: item.normalized,
                usage: item.usage,
                array: valueData(item.array),
              }
            : null;
        geometries.push({
          type: geometry.type,
          parameters: geometry.parameters,
          attributes: Object.fromEntries(
            Object.entries(geometry.attributes).map(([key, item]) => [key, attribute(item)]),
          ),
          index: attribute(geometry.index),
          groups: geometry.groups,
          drawRange: geometry.drawRange,
          morphAttributes: valueData(geometry.morphAttributes),
          morphTargetsRelative: geometry.morphTargetsRelative,
        });
      }
      return geometryIds.get(geometry);
    };
  function visit(item, parent) {
    const id = nodes.length;
    nodes.push({
      parent,
      name: item.name,
      type: item.type,
      geometry: item.geometry ? geometryId(item.geometry) : null,
      materials: nodeMaterials(item, module).map(materialId),
      userData: valueData(
        Object.fromEntries(
          Object.entries(item.userData).filter(([key]) => key !== 'ownedMaterials'),
        ),
      ),
      matrix: item.matrix.elements,
      matrixWorld: item.matrixWorld.elements,
      position: item.position.toArray(),
      quaternion: item.quaternion.toArray(),
      scale: item.scale.toArray(),
      instances: item.instanceMatrix ? valueData(item.instanceMatrix.array) : null,
      instanceColors: item.instanceColor ? valueData(item.instanceColor.array) : null,
      count: item.count,
      visible: item.visible,
      layers: item.layers.mask,
      renderOrder: item.renderOrder,
      frustumCulled: item.frustumCulled,
      castShadow: item.castShadow,
      receiveShadow: item.receiveShadow,
    });
    item.children.forEach((child) => visit(child, id));
  }
  visit(world, null);
  return { nodes, geometries, materials, textures };
}
function dispose(built) {
  const resources = new Set(),
    disposed = new Map();
  built.world.traverse((item) => {
    if (item.geometry) resources.add(item.geometry);
    if (item.isInstancedMesh) resources.add(item);
    for (const paint of nodeMaterials(item, built.module)) {
      resources.add(paint);
      for (const value of Object.values(paint)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const paint of built.materials) assert(resources.has(paint), 'created material is owned');
  for (const resource of resources)
    resource.addEventListener('dispose', () =>
      disposed.set(resource, (disposed.get(resource) ?? 0) + 1),
    );
  built.module.disposeSimVisualGroup(built.world);
  assert(
    [...resources].every((resource) => disposed.get(resource) === 1),
    'every owned resource disposed exactly once',
  );
  assert.equal(built.world.children.length, 0);
  return resources.size;
}
function groundChanges(a, b) {
  const changed = [];
  for (const key of ['map', 'normalMap', 'roughnessMap']) {
    const left = a.ground.material[key],
      right = b.ground.material[key];
    assert.equal(left.userData.surface.kind, 'grass');
    assert.equal(right.userData.surface.kind, 'meadow-grass');
    assert.notEqual(bytes(left.image.data), bytes(right.image.data), key + ' pixels change');
    assert.equal(left.image.data.length, right.image.data.length);
    for (let i = 0; i < right.image.data.length; i += 4) {
      assert.equal(right.image.data[i + 3], 255, 'opaque maps');
      if (key === 'roughnessMap') {
        for (const channel of [0, 2, 3])
          assert.equal(
            left.image.data[i + channel],
            right.image.data[i + channel],
            'AO/metal/alpha channels unchanged',
          );
      }
    }
    changed.push({ slot: key, before: bytes(left.image.data), after: bytes(right.image.data) });
  }
  assert.equal(b.ground.material.aoMap, b.ground.material.roughnessMap);
  return changed;
}
function qualify(entry, quality, appearance, scope = 'catalogue') {
  const name = `${entry.id}/${quality}/${appearance}`,
    allowed = entry.course.environment === 'field' && appearance === 'authored',
    a = build(before, entry.course, quality, appearance),
    b = build(after, entry.course, quality, appearance),
    left = snapshot(a, allowed),
    right = snapshot(b, allowed);
  check(
    name +
      ': scene structure, geometry, UVs, shadows, material parameters and protected texture bytes exact',
    jsonHash(left) === jsonHash(right),
  );
  const changes = allowed ? groundChanges(a, b) : [],
    full = snapshot(b),
    expected = jsonHash(full),
    repeated = build(after, entry.course, quality, appearance);
  check(
    name + ': repeated scene and texture descriptors deterministic',
    jsonHash(snapshot(repeated)) === expected,
  );
  dispose(repeated);
  for (const preset of [...qualities.filter((preset) => preset !== quality), quality])
    after.setSurfaceQuality(b.materials, preset, 8);
  check(
    name + ': texture descriptors/pixels restored after preset cycle',
    jsonHash(snapshot(b)) === expected,
  );
  if (entry.course.environment === 'field') {
    const ground = b.ground,
      maps = Object.values(ground.material).filter((value) => value?.isTexture);
    check(
      name + ': unchanged 12 m ground tile and grass role',
      ground.userData.materialRole === 'grass' &&
        maps.every(
          (texture) =>
            texture.repeat.x === ground.geometry.parameters.width / 12 &&
            texture.repeat.y === ground.geometry.parameters.height / 12,
        ),
    );
    if (appearance === 'pixel')
      check(
        name + ': Pixel nearest filtering',
        maps.every((texture) => texture.magFilter === THREE.NearestFilter),
      );
  }
  const resources = dispose(b),
    baselineResources = dispose(a);
  check(
    name + ': unchanged resource count, every owned resource disposed once',
    resources === baselineResources,
  );
  scenes.push({
    course: entry.id,
    environment: entry.course.environment,
    scope,
    quality,
    appearance,
    protectedSnapshotSha256: jsonHash(right),
    fullSnapshotSha256: expected,
    changes,
    resources,
    geometries: full.geometries.length,
    materials: full.materials.length,
    textures: full.textures.length,
    meshNodes: full.nodes.filter((node) => node.geometry !== null).length,
  });
}

for (const entry of representative)
  for (const quality of qualities)
    for (const appearance of ['authored', 'pixel', ...collections])
      qualify(entry, quality, appearance);
const preview = createBeginnerPreview().course();
check(
  'coach preview remains an unscored field sandbox',
  preview.id === 'coach-controls-preview' && preview.environment === 'field',
);
for (const quality of qualities)
  for (const appearance of ['authored', 'pixel', ...collections])
    qualify(
      { id: preview.id, course: preview },
      quality,
      appearance,
      'unrecorded-controls-preview',
    );
const others = [
  ...new Map(
    catalogue
      .filter((entry) => entry.course.environment !== 'field')
      .map((entry) => [entry.course.environment, entry]),
  ).values(),
];
check('all 13 other environments represented', others.length === 13);
for (const entry of others)
  for (const quality of qualities) qualify(entry, quality, 'authored', 'other-environment');

// Evaluate every shared role, including roles not used by the representative scenes.
for (const collectionId of collections)
  for (const quality of qualities) {
    const holder = (module) => {
        const world = new THREE.Group(),
          materials = new Set(),
          kit = module.createWorkshopMaterials({
            collectionId,
            quality,
            maxAnisotropy: 8,
            material: (color, extras) => {
              const paint = new THREE.MeshStandardMaterial({ color, ...extras });
              materials.add(paint);
              return paint;
            },
          });
        for (const role of Object.keys(module.getSimVisualCollection(collectionId).materials))
          kit.paint(role);
        world.userData.ownedMaterials = [...materials];
        return { world, materials, module };
      },
      a = holder(before),
      b = holder(after);
    check(
      `${collectionId}/${quality}: all seven shared material-role bytes and parameters exact`,
      a.materials.size === 7 &&
        b.materials.size === 7 &&
        jsonHash(snapshot(a)) === jsonHash(snapshot(b)),
    );
    dispose(a);
    dispose(b);
  }

await initWorldRuntime();
for (const row of WORLD_DEMONSTRATIONS) {
  const entry = fields.find((entry) => entry.id === row.proof.course);
  if (!entry) continue;
  const result = await replayWorldFlight(entry.course, row.proof, { yieldControl: async () => {} }),
    identity = worldStateIdentity(result.state);
  check(
    row.proof.course + '/' + row.proof.mode + ': exact World recording replay',
    result.state.status === 'complete' && identity === row.proof.finalStateIdentity,
  );
  recordings.push({
    course: entry.id,
    mode: row.proof.mode,
    ticks: result.state.ticks,
    identity,
    legacy: false,
  });
}
for (const proof of FLIGHT_DEMONSTRATIONS) {
  const entry = fields.find((entry) => entry.id === proof.course);
  if (!entry) continue;
  const result = replayFlight(entry.course, proof);
  check(
    proof.course + '/' + proof.mode + ': legacy recording completes',
    result.state.status === 'complete',
  );
  recordings.push({ course: entry.id, mode: proof.mode, ticks: result.state.ticks, legacy: true });
}
check(
  'all 51 installed Meadow recordings replay: 35 World and 16 legacy',
  recordings.length === 51 &&
    recordings.filter((row) => !row.legacy).length === 35 &&
    recordings.filter((row) => row.legacy).length === 16,
);
check(
  'candidate visual source unchanged throughout qualification',
  hash(await readFile(new URL(visualPath, root))) === visualSha256,
);
for (const [path, expected] of Object.entries(immutable))
  assert.equal(
    hash(await readFile(new URL(path, root))),
    expected,
    'bound runtime input remained unchanged: ' + path,
  );
const receipt = {
  format: 'FPVMeadowGroundDetailCPU.v1',
  createdAt: new Date().toISOString(),
  baseline,
  candidate: git('rev-parse', 'HEAD').toString().trim(),
  visualSha256,
  scriptSha256: hash(await readFile(new URL(import.meta.url))),
  immutable,
  checks,
  scenes,
  recordings,
  scope: {
    catalogueFieldCourses: fields.map((entry) => entry.id),
    catalogueBounds: representative.map((entry) => entry.course.bounds),
    coachPreview: { course: preview.id, bounds: preview.bounds, recorded: false },
    collections,
    otherEnvironments: others.map((entry) => entry.course.environment),
  },
  limitations: [
    'CPU procedural scene evidence only; renderer, actual GLB payload, physics, catalogue, themes and recordings are byte-bound to baseline.',
    'No WebGL rendering, image acceptance, target-readability, GPU draw-call or hardware-performance claim.',
    'The permitted ground difference includes texture name and recipe kind metadata; every sampling parameter and non-pixel material value is compared.',
  ],
};
if (args.length)
  await writeFile(new URL(args[1], root), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    passed: checks.length,
    sceneCases: scenes.length,
    recordings: recordings.length,
    recordingTicks: recordings.reduce((sum, row) => sum + row.ticks, 0),
    immutableFiles: Object.keys(immutable).length,
    visualSha256,
    scriptSha256: receipt.scriptSha256,
  }),
);
