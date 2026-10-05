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
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/demonstrations.mjs';
import { builtinWorldScene } from '../optional-practice/civilian-fpv/world-assets.mjs';
import { dataIdentity } from '../game/data-json.mjs';

const root = new URL('../', import.meta.url),
  baseline = '0aeb0c2b4342715ba9a19b976114d7d905fed7bd',
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
  source = {
    [visualPath]: await readFile(new URL(visualPath, root)),
    [rendererPath]: await readFile(new URL(rendererPath, root)),
  },
  dimensions = {
    'rock-west-terrace': [22, 7, 76],
    'rock-east-terrace': [22, 9, 76],
    'rock-west-rim': [8, 16, 82],
    'rock-east-rim': [8, 19, 82],
    'rock-central-spire': [12, 20, 12],
    'rock-landing-ledge': [8, 5, 8],
  },
  ids = Object.keys(dimensions),
  axes = ['x', 'y', 'z'];
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Usage: node scripts/qualify-fpv-quarry-strata.mjs [--out NEW.json]');
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
  quarries = catalogue.filter((entry) => entry.course.environment === 'quarry'),
  canonical = quarries[0]?.course,
  collections = Object.keys(after.SIM_VISUAL_COLLECTIONS),
  courseIdentities = [];
check(
  'five Quarry courses, one bounds',
  quarries.length === 5 &&
    new Set(quarries.map((entry) => jsonHash(entry.course.bounds))).size === 1,
);
check(
  'all 17 shared collections unchanged',
  collections.length === 17 &&
    jsonHash(collections) === jsonHash(Object.keys(before.SIM_VISUAL_COLLECTIONS)),
);
for (const entry of quarries) {
  const prior = oldCatalogue.WORLD_CATALOGUE.find((row) => row.id === entry.id);
  check(
    entry.id + ': exact course/collision/actor/objective identity',
    !!prior &&
      jsonHash(prior.course) === jsonHash(entry.course) &&
      dataIdentity(prior.course) === dataIdentity(entry.course),
  );
  check(entry.id + ': no built-in GLB', builtinWorldScene(entry.course) === null);
  check(
    entry.id + ': six exact canonical stone solids',
    ids.every((id) => {
      const obstacle = entry.course.obstacles.find((item) => item.id === id);
      return (
        obstacle &&
        !obstacle.type &&
        !obstacle.rotation &&
        axes.every(
          (axis, index) =>
            (obstacle.max[axis] - obstacle.min[axis]) / 1000 === dimensions[id][index],
        ) &&
        after.isQuarryStrataObstacle(obstacle)
      );
    }),
  );
  courseIdentities.push({
    course: entry.id,
    dataIdentity: dataIdentity(entry.course),
    sha256: jsonHash(entry.course),
  });
}
const quarryIds = new Set(quarries.map((entry) => entry.id));
check(
  'no installed Quarry demonstrations claimed',
  WORLD_DEMONSTRATIONS.every((row) => !quarryIds.has(row.proof.course)) &&
    FLIGHT_DEMONSTRATIONS.every((row) => !quarryIds.has(row.course)),
);

// Execute exact renderer functions, with real Three scene objects and the actual
// world surface resolver. This excludes camera, PMREM, actors and goal rendering.
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
  newFunctions = rendererFunctions(source[rendererPath]),
  helperNames = [
    'obstacleSurfaceKind',
    'worldScaleUV',
    'garageStructureUV',
    'addFlushPanels',
    'renderObstacle',
  ];
for (const name of helperNames.filter((name) => name !== 'renderObstacle'))
  check('renderer helper exact: ' + name, oldFunctions[name] === newFunctions[name]);
check(
  'renderer changes only guarded six-metre UV selection and concrete role metadata',
  source[rendererPath]
    .toString()
    .replace(
      "      // Reuse the same world-metre projection so mineral beds share height\n      // across the six canonical Quarry masses; only their UVs are replaced.\n      else if (kind === 'quarry-stone') garageStructureUV(shape, obstacle);\n",
      '',
    )
    .replace("    if (kind === 'quarry-stone') value.userData.materialRole = 'concrete';\n", '') ===
    old(rendererPath).toString(),
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
  if (allowed) metadata.name = '<approved-rock-map>';
  return {
    metadata: valueData(metadata),
    userData: valueData(
      Object.fromEntries(Object.entries(texture.userData).filter(([key]) => key !== 'surface')),
    ),
    surface: surface
      ? {
          kind: allowed ? '<approved-rock-map>' : surface.kind,
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
        ? '<approved-rock-pixels>'
        : texture.image?.data
          ? typedBytes(texture.image.data)
          : null,
    },
  };
}
function snapshot(built, allowStrata = false) {
  const { world, module } = built,
    geometries = [],
    materials = [],
    textures = [],
    nodes = [],
    geometryIds = new Map(),
    materialIds = new Map(),
    textureIds = new Map(),
    allowedMaps = new Set(),
    allowedGeometry = new Set();
  if (allowStrata)
    world.traverse((item) => {
      if (ids.includes(item.userData.collisionId)) {
        allowedGeometry.add(item.geometry);
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
        const attribute = (item, uv = false) =>
          item
            ? {
                count: item.count,
                itemSize: item.itemSize,
                normalized: item.normalized,
                usage: item.usage,
                array:
                  uv && allowedGeometry.has(shape)
                    ? '<approved-six-metre-UV>'
                    : valueData(item.array),
              }
            : null;
        geometries.push({
          type: shape.type,
          parameters: valueData(shape.parameters),
          attributes: Object.fromEntries(
            Object.entries(shape.attributes).map(([key, item]) => [
              key,
              attribute(item, key === 'uv'),
            ]),
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
    if (allowStrata && ids.includes(item.userData.collisionId)) {
      userData.surfaceKind = '<approved-rock-kind>';
      userData.materialRole = '<approved-rock-role>';
    }
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
function verifyUV(built) {
  let vertices = 0;
  for (const id of ids) {
    const item = built.world.getObjectByName(id),
      position = item.geometry.attributes.position,
      normal = item.geometry.attributes.normal,
      uv = item.geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      const xyz = [position.getX(i), position.getY(i), position.getZ(i)].map(
          (value, axis) => value + item.position.getComponent(axis),
        ),
        n = [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))],
        expected = [
          (n[0] > n[1] && n[0] > n[2] ? xyz[2] : xyz[0]) / 6,
          (n[1] >= n[0] && n[1] >= n[2] ? xyz[2] : xyz[1]) / 6,
        ];
      assert(
        expected.every((value, axis) => Math.abs(value - uv.array[i * 2 + axis]) < 0.00001),
        'actual renderer UV equals world metres / six',
      );
      vertices++;
    }
  }
  return vertices;
}
function compare(course, quality, appearance, label, allowed = false, renderObstacles = true) {
  const a = build(before, course, quality, appearance, renderObstacles),
    b = build(after, course, quality, appearance, renderObstacles),
    left = snapshot(a, allowed),
    right = snapshot(b, allowed),
    aCounts = counts(a),
    bCounts = counts(b);
  check(
    label + ': exact unchanged scene outside approved maps/kind/UV',
    jsonHash(left) === jsonHash(right),
  );
  check(
    label + ': exact resource counts and texture allocation',
    jsonHash(aCounts) === jsonHash(bCounts),
    bCounts,
  );
  if (allowed) {
    const maps = new Set();
    for (const id of ids) {
      const item = b.world.getObjectByName(id);
      assert.equal(item.userData.surfaceKind, 'quarry-stone');
      assert.equal(item.userData.materialRole, 'concrete');
      Object.values(item.material)
        .filter((value) => value?.isTexture)
        .forEach((value) => maps.add(value));
    }
    check(
      label + ': six rocks share exactly three owned strata maps',
      maps.size === 3 && [...maps].every((map) => map.userData.surface?.kind === 'quarry-stone'),
    );
    check(label + ': actual six-metre world UVs', verifyUV(b) === 144);
    const size = { low: 128, balanced: 256, high: 512 }[quality];
    check(
      label + ': quality sampling/filters retain baseline contract',
      [...maps].every(
        (map) =>
          map.image.width === size &&
          map.image.height === size &&
          map.wrapS === THREE.RepeatWrapping &&
          map.wrapT === THREE.RepeatWrapping &&
          map.magFilter === THREE.LinearFilter &&
          map.minFilter === THREE.LinearMipmapLinearFilter,
      ),
    );
    check(
      label + ': rock pixels visibly differ from prior stone recipe',
      jsonHash(snapshot(a)) !== jsonHash(snapshot(b)),
    );
    scenes.push({
      label,
      quality,
      appearance,
      counts: bCounts,
      sceneSha256: jsonHash(snapshot(b)),
      strata: [...maps].map((map) => ({
        kind: map.userData.surface.kind,
        width: map.image.width,
        height: map.image.height,
        sha256: typedBytes(map.image.data),
      })),
    });
  } else scenes.push({ label, quality, appearance, counts: bCounts, sceneSha256: jsonHash(right) });
  check(label + ': all owned resources disposed once', dispose(a) === dispose(b));
}

const guardNegatives = [];
for (const id of ids) {
  const obstacle = canonical.obstacles.find((row) => row.id === id),
    shifted = structuredClone(obstacle);
  for (const [i, axis] of axes.entries())
    for (const end of ['min', 'max']) shifted[end][axis] += [17000, 7000, -23000][i];
  check(id + ': finite same-size translation accepted', after.isQuarryStrataObstacle(shifted));
  for (const [label, patch] of [
    ['renamed', { id: id + '-custom' }],
    ['explicit box', { type: 'box' }],
    ['trimesh', { type: 'trimesh' }],
    ['rotation', { rotation: [0, 0, 0, 1] }],
    ['missing min', { min: undefined }],
    ['nonfinite', { max: { ...obstacle.max, x: Infinity } }],
    ...axes.map((axis) => [
      'resized ' + axis,
      { max: { ...obstacle.max, [axis]: obstacle.max[axis] + 1 } },
    ]),
  ]) {
    const changed = { ...obstacle, ...patch };
    check(id + ': guard rejects ' + label, !after.isQuarryStrataObstacle(changed));
    if (id === ids[0] && !['missing min', 'nonfinite', 'trimesh'].includes(label))
      guardNegatives.push([label, changed]);
  }
}
for (const [label, obstacle] of [
  ['missing', undefined],
  ['null', null],
  ['empty', {}],
])
  check(label + ': guard is safely negative', !after.isQuarryStrataObstacle(obstacle));
for (const quality of ['low', 'balanced', 'high'])
  for (const appearance of ['authored', 'pixel', ...collections])
    compare(canonical, quality, appearance, quality + '/' + appearance, appearance === 'authored');
for (const entry of quarries.slice(1))
  compare(entry.course, 'balanced', 'authored', entry.id, true);
for (const [label, obstacle] of guardNegatives) {
  const course = structuredClone(canonical);
  course.obstacles[course.obstacles.findIndex((row) => row.id === ids[0])] = obstacle;
  compare(course, 'balanced', 'authored', 'creator ' + label);
}
for (const label of ['missing solid', 'additional stone']) {
  const course = structuredClone(canonical);
  if (label === 'missing solid')
    course.obstacles = course.obstacles.filter((row) => row.id !== ids[0]);
  else
    course.obstacles.push({
      id: 'rock-custom',
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1000, y: 1000, z: 1000 },
    });
  compare(course, 'balanced', 'authored', 'creator ' + label);
}
const translated = structuredClone(canonical);
for (const obstacle of translated.obstacles.filter((row) => ids.includes(row.id)))
  for (const [i, axis] of axes.entries())
    for (const end of ['min', 'max']) obstacle[end][axis] += [17000, 7000, -23000][i];
compare(translated, 'balanced', 'authored', 'creator finite translated six solids', true);
for (const entry of [
  ...new Map(
    catalogue
      .filter((row) => row.course.environment !== 'quarry')
      .map((row) => [row.course.environment, row]),
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

// Determinism and runtime quality re-sampling preserve the same shared owners.
const reusable = build(after, canonical, 'balanced', 'authored'),
  expected = jsonHash(snapshot(reusable)),
  owners = resources(reusable),
  repeated = build(after, canonical, 'balanced', 'authored');
check(
  'independent builds produce identical map and scene bytes',
  expected === jsonHash(snapshot(repeated)),
);
dispose(repeated);
for (const quality of ['low', 'high', 'balanced'])
  after.setSurfaceQuality(reusable.materials, quality, 8);
check(
  'quality cycle returns exact deterministic scene/map bytes',
  expected === jsonHash(snapshot(reusable)),
);
const currentOwners = resources(reusable);
check(
  'quality re-sampling retains identical owned geometry/material/texture objects',
  Object.entries(owners).every(
    ([key, values]) =>
      values.size === currentOwners[key].size &&
      [...values].every((value) => currentOwners[key].has(value)),
  ),
);
dispose(reusable);
for (const [path, bytes] of Object.entries(source))
  check(
    path + ': source remained stable during qualification',
    bytes.equals(await readFile(new URL(path, root))),
  );
for (const [path, sha256] of Object.entries(immutable))
  assert.equal(
    hash(await readFile(new URL(path, root))),
    sha256,
    path + ': immutable source remained stable',
  );
const receipt = {
  format: 'fpv-quarry-strata-manual-cpu.v1',
  baseline,
  candidate: git('rev-parse', 'HEAD').toString().trim(),
  sourceSha256: Object.fromEntries(
    Object.entries(source).map(([path, bytes]) => [path, hash(bytes)]),
  ),
  immutable,
  courseIdentities,
  dimensions,
  checks,
  scenes,
  passed: checks.every((row) => row.passed),
  scope:
    'Actual source-extracted renderer obstacle/UV/panel functions and real Three world/material objects. Other-world controls cover buildWorldVisuals plus lazy obstacle surfaces. No WebGL, GPU memory measurement, actor/objective rendering or fresh replay is claimed; course, collision, actor and installed recording inputs are byte-bound to baseline.',
};
if (args.length) await writeFile(args[1], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify(
    {
      passed: receipt.passed,
      checks: checks.length,
      scenes: scenes.length,
      courseCount: quarries.length,
      sourceSha256: receipt.sourceSha256,
      authored: scenes.filter((row) => row.appearance === 'authored').slice(0, 3),
    },
    null,
    2,
  ),
);
