#!/usr/bin/env node
// Manual source-bound CPU qualification; no additional unit coverage or replay generation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { builtinWorldScene } from '../optional-practice/civilian-fpv/world-assets.mjs';
import { dataIdentity } from '../game/data-json.mjs';

const root = new URL('../', import.meta.url),
  baseline = '96ef08777c36a49c49babf8e15489867d484ba59',
  prefix = 'optional-practice/civilian-fpv/',
  visualPath = prefix + 'world-visuals.mjs',
  rendererPath = prefix + 'renderer.mjs',
  args = process.argv.slice(2),
  checks = [],
  scenes = [],
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  git = (...values) => execFileSync('git', values, { cwd: root, maxBuffer: 16 * 1024 * 1024 }),
  old = (path) => git('show', baseline + ':' + path),
  source = { [visualPath]: await readFile(new URL(visualPath, root)) };
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Usage: node scripts/qualify-fpv-orchard-tree-surfaces.mjs [--out NEW.json]');
function check(name, pass, details) {
  checks.push({ name, passed: !!pass, ...(details === undefined ? {} : { details }) });
  assert(pass, name);
}
async function sourceModule(path, bytes) {
  const text = bytes
    .toString()
    .replace(
      /from '(\.[^']+)'/g,
      (_, relative) => `from '${new URL(relative, new URL(path, root)).href}'`,
    );
  return import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
}
const immutable = {},
  runtimeFiles = git('ls-tree', '-r', '--name-only', baseline, '--', prefix)
    .toString()
    .trim()
    .split('\n');
check(
  'tracked runtime/asset file list unchanged',
  runtimeFiles.join('\n') === git('ls-files', '--', prefix).toString().trim(),
);
check(
  'no untracked runtime assets',
  git('ls-files', '--others', '--exclude-standard', '--', prefix).length === 0,
);
for (const path of [
  ...runtimeFiles.filter((path) => !Object.hasOwn(source, path)),
  'game/data-json.mjs',
  'game/presentation/theme-system.mjs',
  'game/hunt/actor-catalog.mjs',
  'game/hunt/preferences.mjs',
]) {
  const bytes = await readFile(new URL(path, root));
  check(path + ': exact baseline bytes', bytes.equals(old(path)));
  immutable[path] = hash(bytes);
}
const before = await sourceModule(visualPath, old(visualPath)),
  after = await sourceModule(visualPath, source[visualPath]),
  oldCatalogue = await sourceModule(
    prefix + 'world-catalogue.mjs',
    old(prefix + 'world-catalogue.mjs'),
  ),
  catalogue = [
    ...new Map(
      [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((entry) => [entry.id, entry]),
    ).values(),
  ],
  orchards = catalogue.filter((entry) => entry.course.environment === 'orchard'),
  canonical = orchards[0]?.course,
  ids = canonical.obstacles.filter((item) => /^tree-/.test(item.id)).map((item) => item.id),
  collections = Object.keys(after.SIM_VISUAL_COLLECTIONS),
  courseIdentities = [];
check('five canonical Orchard activities', orchards.length === 5 && ids.length === 32);
check(
  'all17 shared collections retained',
  collections.length === 17 &&
    jsonHash(collections) === jsonHash(Object.keys(before.SIM_VISUAL_COLLECTIONS)),
);
for (const entry of orchards) {
  const prior = oldCatalogue.WORLD_CATALOGUE.find((row) => row.id === entry.id);
  check(
    entry.id + ': exact course/collision/actor/objective identity',
    !!prior &&
      jsonHash(prior.course) === jsonHash(entry.course) &&
      dataIdentity(prior.course) === dataIdentity(entry.course),
  );
  check(entry.id + ': no built-in GLB', builtinWorldScene(entry.course) === null);
  courseIdentities.push({
    course: entry.id,
    dataIdentity: dataIdentity(entry.course),
    sha256: jsonHash(entry.course),
  });
}
function rendererFunctions(bytes) {
  const text = bytes.toString(),
    ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' }),
    found = {};
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration') found[node.id.name] = text.slice(node.start, node.end);
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
  }
  walk(ast);
  return found;
}
const oldFunctions = rendererFunctions(old(rendererPath)),
  newFunctions = rendererFunctions(await readFile(new URL(rendererPath, root))),
  helperNames = [
    'obstacleSurfaceKind',
    'worldScaleUV',
    'garageStructureUV',
    'addFlushPanels',
    'renderObstacle',
  ];
check(
  'entire renderer remains exact baseline bytes',
  (await readFile(new URL(rendererPath, root))).equals(old(rendererPath)),
);
function nodeMaterials(item, module) {
  return [
    ...(Array.isArray(item.material) ? item.material : [item.material]),
    ...module.ownedSimMaterials(item),
    item.customDepthMaterial,
    item.customDistanceMaterial,
  ].filter(Boolean);
}
function build(module, original, quality, appearance, renderObstacles = true) {
  const course = structuredClone(original);
  if (appearance === 'pixel') course.world = { ...course.world, theme: 'pixel' };
  const world = new THREE.Group(),
    materials = new Set(),
    geometry = new Set(),
    material = (color, extras = {}) => {
      const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extras });
      materials.add(paint);
      return paint;
    },
    mesh = (shape, paint, parent = world) => {
      geometry.add(shape);
      const item = new THREE.Mesh(shape, paint);
      parent.add(item);
      return item;
    },
    box = (size, at, color, parent) => {
      const item = mesh(new THREE.BoxGeometry(...size), material(color), parent);
      item.position.set(...at);
      return item;
    },
    presentation = {
      collectionId: appearance === 'pixel' ? 'authored' : appearance,
      revision: 'r1',
    },
    surroundings = module.buildWorldVisuals({
      course,
      world,
      mesh,
      material,
      box,
      quality,
      maxAnisotropy: 8,
      presentation,
    });
  if (renderObstacles) {
    const functions = module === before ? oldFunctions : newFunctions,
      render = vm.runInNewContext(
        helperNames.map((name) => functions[name]).join('\n') + '\nrenderObstacle',
        {
          THREE,
          course,
          world,
          quality,
          material,
          mesh,
          geometry,
          materials,
          environmentSurfaceKind: surroundings.obstacleSurfaceKind,
          obstacleSurface: surroundings.obstacleSurface,
          obstacleMaps: surroundings.obstacleMaps,
          themeProfile: surroundings.profile,
          qualityDetails: [],
          goalMaterialKit:
            appearance !== 'authored' && appearance !== 'pixel'
              ? { collectionId: appearance }
              : null,
          bindSimModelRole: module.bindSimModelRole,
        },
      );
    course.obstacles.forEach(render);
  } else {
    for (const obstacle of course.obstacles ?? []) {
      const kind = surroundings.obstacleSurfaceKind(obstacle);
      if (kind) surroundings.obstacleSurface(kind);
    }
  }
  world.traverse((item) => nodeMaterials(item, module).forEach((paint) => materials.add(paint)));
  module.setSurfaceQuality(materials, quality, 8);
  world.updateMatrixWorld(true);
  return { world, module, course, materials, surroundings, appearance, quality };
}
function typedBytes(value) {
  return hash(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
}
function valueData(value) {
  if (value === null || ['undefined', 'string', 'number', 'boolean'].includes(typeof value))
    return value;
  if (typeof value === 'function') return value.toString();
  if (value.isBufferGeometry)
    return {
      type: value.type,
      parameters: valueData(value.parameters),
      index: value.index ? typedBytes(value.index.array) : null,
      // EdgesGeometry retains its source shape as metadata. Its own computed
      // attributes below bind the actual outline; exclude source UVs here.
      attributes: Object.fromEntries(
        Object.entries(value.attributes)
          .filter(([key]) => key !== 'uv')
          .map(([key, attribute]) => [key, typedBytes(attribute.array)]),
      ),
    };
  if (ArrayBuffer.isView(value)) return { type: value.constructor.name, hash: typedBytes(value) };
  if (typeof value.toArray === 'function') return value.toArray();
  if (Array.isArray(value)) return value.map(valueData);
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
  return {
    metadata: valueData(metadata),
    userData: valueData(
      Object.fromEntries(Object.entries(texture.userData).filter(([key]) => key !== 'surface')),
    ),
    surface: surface
      ? {
          kind: allowed ? '<approved-tree-map>' : surface.kind,
          color: valueData(surface.color),
          seed: surface.seed,
          pixel: surface.pixel,
          size: surface.size,
        }
      : null,
    image: {
      width: texture.image?.width,
      height: texture.image?.height,
      bytes: texture.image?.data?.byteLength,
      pixels: allowed
        ? '<approved-tree-pixels>'
        : texture.image?.data
          ? typedBytes(texture.image.data)
          : null,
    },
  };
}
function snapshot(built, allowTreeMaps = false) {
  const { world, module } = built,
    geometries = [],
    materials = [],
    textures = [],
    nodes = [],
    geometryIds = new Map(),
    materialIds = new Map(),
    textureIds = new Map(),
    allowedMaps = new Set();
  if (allowTreeMaps)
    world.traverse((item) => {
      if (ids.includes(item.userData.collisionId)) {
        Object.values(item.material)
          .filter((value) => value?.isTexture)
          .forEach((map) => allowedMaps.add(map));
      }
    });
  const textureId = (texture) => {
      if (!textureIds.has(texture)) {
        textureIds.set(texture, textures.length);
        textures.push(textureData(texture, allowedMaps.has(texture)));
      }
      return textureIds.get(texture);
    },
    materialId = (paint) => {
      if (!materialIds.has(paint)) {
        materialIds.set(paint, materials.length);
        materials.push(
          Object.fromEntries(
            Object.entries(paint)
              .filter(([key]) => !['uuid', 'id', 'version', '_listeners'].includes(key))
              .map(([key, value]) => [
                key,
                value?.isTexture ? { texture: textureId(value) } : valueData(value),
              ]),
          ),
        );
      }
      return materialIds.get(paint);
    },
    geometryId = (shape) => {
      if (!geometryIds.has(shape)) {
        geometryIds.set(shape, geometries.length);
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
          type: shape.type,
          parameters: valueData(shape.parameters),
          attributes: Object.fromEntries(
            Object.entries(shape.attributes).map(([key, item]) => [key, attribute(item)]),
          ),
          index: attribute(shape.index),
          groups: shape.groups,
          drawRange: shape.drawRange,
          morphAttributes: valueData(shape.morphAttributes),
          morphTargetsRelative: shape.morphTargetsRelative,
        });
      }
      return geometryIds.get(shape);
    };
  function visit(item, parent) {
    const index = nodes.length,
      userData = Object.fromEntries(
        Object.entries(item.userData).filter(([key]) => key !== 'ownedMaterials'),
      );
    nodes.push({
      parent,
      name: item.name,
      type: item.type,
      geometry: item.geometry ? geometryId(item.geometry) : null,
      materials: nodeMaterials(item, module).map(materialId),
      userData: valueData(userData),
      matrix: item.matrix.elements,
      matrixWorld: item.matrixWorld.elements,
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
    item.children.forEach((child) => visit(child, index));
  }
  visit(world, null);
  return { nodes, geometries, materials, textures };
}
function resources(built) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set(),
    instances = new Set();
  built.world.traverse((item) => {
    if (item.geometry) geometries.add(item.geometry);
    if (item.isInstancedMesh) instances.add(item);
    for (const paint of nodeMaterials(item, built.module)) {
      materials.add(paint);
      Object.values(paint)
        .filter((value) => value?.isTexture)
        .forEach((value) => textures.add(value));
    }
  });
  return { geometries, materials, textures, instances };
}
function counts(built) {
  const result = resources(built);
  return {
    ...Object.fromEntries(Object.entries(result).map(([key, values]) => [key, values.size])),
    textureBytes: [...result.textures].reduce(
      (sum, map) => sum + (map.image?.data?.byteLength ?? 0),
      0,
    ),
  };
}
function dispose(built) {
  const owned = resources(built),
    items = new Set(Object.values(owned).flatMap((set) => [...set])),
    disposals = new Map();
  assert(
    [...built.materials].every((paint) => owned.materials.has(paint)),
    'every created material has a scene owner',
  );
  for (const item of items)
    item.addEventListener('dispose', () => disposals.set(item, (disposals.get(item) ?? 0) + 1));
  built.module.disposeSimVisualGroup(built.world);
  assert(
    [...items].every((item) => disposals.get(item) === 1),
    'every owned resource disposed exactly once',
  );
  assert.equal(built.world.children.length, 0);
  return items.size;
}
function compare(course, quality, appearance, label, allowed = false, renderObstacles = true) {
  const a = build(before, course, quality, appearance, renderObstacles),
    b = build(after, course, quality, appearance, renderObstacles),
    left = snapshot(a, allowed),
    right = snapshot(b, allowed),
    aCounts = counts(a),
    bCounts = counts(b);
  check(
    label + ': exact scene including geometry/UV/materials outside six approved maps',
    jsonHash(left) === jsonHash(right),
  );
  check(
    label + ': exact owners/batches/texture allocation',
    jsonHash(aCounts) === jsonHash(bCounts),
    bCounts,
  );
  const maps = new Set();
  if (allowed) {
    for (const id of ids) {
      const item = b.world.getObjectByName(id);
      assert(item);
      Object.values(item.material)
        .filter((v) => v?.isTexture)
        .forEach((v) => maps.add(v));
    }
    check(
      label + ': exactly six maps in two existing shared surface owners',
      maps.size === 6 &&
        new Set([...maps].map((m) => m.userData.surface)).size === 2 &&
        [...maps].every((m) =>
          ['orchard-bark', 'orchard-foliage'].includes(m.userData.surface.kind),
        ),
    );
    const size = { low: 128, balanced: 256, high: 512 }[quality];
    check(
      label + ': unchanged tier size/repeat/filter and opaque pixels',
      [...maps].every(
        (m) =>
          m.image.width === size &&
          m.image.height === size &&
          m.wrapS === THREE.RepeatWrapping &&
          m.wrapT === THREE.RepeatWrapping &&
          m.magFilter === THREE.LinearFilter &&
          m.minFilter === THREE.LinearMipmapLinearFilter &&
          m.image.data.every((v, i) => i % 4 !== 3 || v === 255),
      ),
    );
    check(label + ': tree surface pixels change', jsonHash(snapshot(a)) !== jsonHash(snapshot(b)));
  }
  scenes.push({
    label,
    quality,
    appearance,
    counts: bCounts,
    sceneSha256: jsonHash(snapshot(b)),
    maps: [...maps].map((map) => ({
      kind: map.userData.surface.kind,
      width: map.image.width,
      sha256: typedBytes(map.image.data),
    })),
  });
  check(label + ': all owned resources disposed exactly once', dispose(a) === dispose(b));
}
for (const quality of ['low', 'balanced', 'high'])
  for (const appearance of ['authored', 'pixel', ...collections])
    compare(canonical, quality, appearance, quality + '/' + appearance, appearance === 'authored');
for (const entry of orchards.slice(1))
  compare(entry.course, 'balanced', 'authored', entry.id, true);
const mutations = [
  ['custom course id', (c) => (c.id += '-custom')],
  ['custom world id', (c) => (c.world.id = 'custom-orchard')],
  ['custom bounds', (c) => (c.bounds.max.x += 1000)],
  ['renamed trunk', (c) => (c.obstacles[0].id += '-custom')],
  ['trunk resized', (c) => (c.obstacles[0].max.y += 1)],
  [
    'trunk translated',
    (c) => {
      c.obstacles[0].min.x += 100;
      c.obstacles[0].max.x += 100;
    },
  ],
  ['trunk rotated', (c) => (c.obstacles[0].rotation = [0, 0, 0, 1])],
  ['explicit box', (c) => (c.obstacles[0].type = 'box')],
  ['crown vertex changed', (c) => (c.obstacles[1].vertices[0] += 1)],
  [
    'crown winding changed',
    (c) => {
      const a = c.obstacles[1].indices;
      [a[0], a[1]] = [a[1], a[0]];
    },
  ],
  ['missing tree', (c) => c.obstacles.splice(0, 1)],
  ['duplicate tree', (c) => (c.obstacles[2].id = c.obstacles[0].id)],
  [
    'additional timber',
    (c) =>
      c.obstacles.push({
        id: 'crate-custom',
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1000, y: 1000, z: 1000 },
      }),
  ],
  [
    'replaced barn with custom timber',
    (c) => (c.obstacles.find((o) => o.id === 'building-barn').id = 'crate-custom'),
  ],
  ['custom profile', null],
];
const canonicalProfile = build(after, canonical, 'balanced', 'authored');
const profileValue = canonicalProfile.surroundings.profile;
dispose(canonicalProfile);
mutations[mutations.length - 1][1] = (c) => {
  c.themeProfile = structuredClone(profileValue);
  c.themeProfile.palette.ground += 1;
};
for (const [label, mutate] of mutations) {
  const c = structuredClone(canonical);
  mutate(c);
  compare(c, 'balanced', 'authored', 'custom ' + label);
}
for (const entry of [
  ...new Map(
    catalogue
      .filter((r) => r.course.environment !== 'orchard')
      .map((r) => [r.course.environment, r]),
  ).values(),
])
  compare(
    entry.course,
    'balanced',
    'authored',
    'unaffected ' + entry.course.environment,
    false,
    false,
  );
const reusable = build(after, canonical, 'balanced', 'authored'),
  expected = jsonHash(snapshot(reusable)),
  owners = resources(reusable),
  repeated = build(after, canonical, 'balanced', 'authored');
check(
  'independent trees produce exact deterministic surface/scene bytes',
  expected === jsonHash(snapshot(repeated)),
);
dispose(repeated);
for (const quality of ['low', 'high', 'balanced'])
  after.setSurfaceQuality(reusable.materials, quality, 8);
check('quality cycle returns exact scene and map bytes', expected === jsonHash(snapshot(reusable)));
const currentOwners = resources(reusable);
check(
  'quality changes retain identical texture/material/geometry/instance owners',
  Object.entries(owners).every(
    ([key, values]) =>
      values.size === currentOwners[key].size &&
      [...values].every((value) => currentOwners[key].has(value)),
  ),
);
dispose(reusable);
for (const [path, bytes] of Object.entries(source))
  check(path + ': stable during qualification', bytes.equals(await readFile(new URL(path, root))));
for (const [path, sha256] of Object.entries(immutable))
  assert.equal(
    hash(await readFile(new URL(path, root))),
    sha256,
    path + ': unchanged baseline source',
  );
const receipt = {
  format: 'fpv-orchard-tree-surfaces-manual.v1',
  baseline,
  candidate: git('rev-parse', 'HEAD').toString().trim(),
  sourceSha256: Object.fromEntries(
    Object.entries(source).map(([path, bytes]) => [path, hash(bytes)]),
  ),
  immutable,
  courseIdentities,
  checks,
  scenes,
  passed: checks.every((c) => c.passed),
  scope:
    'Real Three world objects and exact renderer obstacle/UV/panel functions. Complete geometry/UV/material/resource equality except six canonical Orchard map byte arrays and their surface recipe identifiers. No actual WebGL/FPS or fresh replay claimed; all course/collision/actor/recording inputs remain byte-bound.',
};
if (args.length) await writeFile(args[1], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify(
    {
      passed: receipt.passed,
      checks: checks.length,
      scenes: scenes.length,
      sourceSha256: receipt.sourceSha256,
      authored: scenes.filter((s) => s.appearance === 'authored').slice(0, 3),
    },
    null,
    2,
  ),
);
