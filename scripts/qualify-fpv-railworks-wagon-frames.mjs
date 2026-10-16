#!/usr/bin/env node
// Manual source-bound CPU qualification. No new unit suite or art/GPU/replay claim.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
import * as visuals from '../optional-practice/civilian-fpv/world-visuals.mjs';
import {
  THEME_PROFILES,
  resolveSimThemeProfile,
} from '../optional-practice/civilian-fpv/world-themes.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/demonstrations.mjs';
import { builtinWorldScene } from '../optional-practice/civilian-fpv/world-assets.mjs';
import { dataIdentity } from '../game/data-json.mjs';

const options = { baseline: '96ef08777c36a49c49babf8e15489867d484ba59', out: null };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1]) options.out = args[++i];
  else if (args[i] === '--baseline' && /^[a-f0-9]{40}$/.test(args[i + 1] ?? ''))
    options.baseline = args[++i];
  else throw Error('Use [--baseline LOCAL_40_HEX_SHA] [--out NEW_RECEIPT.json]');
}
const root = new URL('../', import.meta.url),
  baseline = options.baseline,
  prefix = 'optional-practice/civilian-fpv/',
  rendererPath = prefix + 'renderer.mjs',
  checks = [],
  scenes = [],
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  git = (...values) => execFileSync('git', values, { cwd: root, maxBuffer: 16 * 1024 * 1024 }),
  old = (path) => git('show', baseline + ':' + path),
  rendererBytes = await readFile(new URL(rendererPath, root)),
  rendererSource = rendererBytes.toString(),
  dimensions = Object.fromEntries(
    [0, 1].flatMap((row) =>
      [0, 1, 2, 3].map((column) => [`rail-car-${row}-${column}`, [5, 4, 13]]),
    ),
  ),
  ids = Object.keys(dimensions),
  axes = ['x', 'y', 'z'];
function check(name, pass, details) {
  checks.push({ name, passed: !!pass, ...(details === undefined ? {} : { details }) });
  assert(pass, name);
}
const immutable = {},
  runtimeFiles = git('ls-tree', '-r', '--name-only', baseline, '--', prefix)
    .toString()
    .trim()
    .split('\n');
check(
  'runtime/asset file list unchanged',
  runtimeFiles.join('\n') === git('ls-files', '--', prefix).toString().trim(),
);
check(
  'no untracked runtime assets',
  git('ls-files', '--others', '--exclude-standard', '--', prefix).length === 0,
);
for (const path of [
  ...runtimeFiles.filter((path) => path !== rendererPath),
  'game/data-json.mjs',
  'game/presentation/theme-system.mjs',
  'game/hunt/actor-catalog.mjs',
  'game/hunt/preferences.mjs',
]) {
  const bytes = await readFile(new URL(path, root));
  check(path + ': exact baseline input', bytes.equals(old(path)));
  immutable[path] = hash(bytes);
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
    else if (value && typeof value === 'object') walk(value, visit);
}
function parseRenderer(bytes) {
  const text = bytes.toString(),
    ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' }),
    functions = {},
    nodes = {};
  walk(ast, (node) => {
    if (node.type === 'FunctionDeclaration') {
      functions[node.id.name] = text.slice(node.start, node.end);
      nodes[node.id.name] = node;
    }
  });
  return { text, ast, functions, nodes };
}
const beforeRenderer = parseRenderer(old(rendererPath)),
  afterRenderer = parseRenderer(rendererBytes),
  helperNames = [
    'ownShadowMaterial',
    'obstacleSurfaceKind',
    'worldScaleUV',
    'garageStructureUV',
    'addGarageSurfaceDetails',
    'woodlandTrunkUV',
    'storageModuleUV',
    'stadiumStructureUV',
    'stadiumStructureDetail',
    'addFlushPanels',
    'renderObstacle',
    'releaseGroup',
  ];
for (const name of helperNames.filter((name) => name !== 'renderObstacle'))
  check(
    'exact actual renderer helper: ' + name,
    beforeRenderer.functions[name] === afterRenderer.functions[name],
  );
function maskedAST(parsed) {
  const removed = { guard: 0, branch: 0, choice: 0 };
  function clean(node, inObstacle = false) {
    if (Array.isArray(node))
      return node.map((item) => clean(item, inObstacle)).filter((item) => item !== undefined);
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'FunctionDeclaration') inObstacle = node.id.name === 'renderObstacle';
    if (inObstacle && node.type === 'VariableDeclarator' && node.id.name === 'railWagon') {
      removed.guard++;
      return undefined;
    }
    if (
      inObstacle &&
      node.type === 'IfStatement' &&
      node.test.type === 'Identifier' &&
      node.test.name === 'railWagon'
    ) {
      removed.branch++;
      return undefined;
    }
    if (
      inObstacle &&
      node.type === 'ConditionalExpression' &&
      node.test.type === 'Identifier' &&
      node.test.name === 'railWagon'
    ) {
      removed.choice++;
      return clean(node.alternate, inObstacle);
    }
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !['start', 'end', 'raw'].includes(key))
        .map(([key, value]) => [key, clean(value, inObstacle)]),
    );
  }
  const ast = clean(parsed.ast);
  assert.deepEqual(
    removed,
    parsed === beforeRenderer
      ? { guard: 0, branch: 0, choice: 0 }
      : { guard: 1, branch: 1, choice: 2 },
  );
  return ast;
}
check(
  'renderer AST exact except wagon guard, frame strips and two guarded accent choices',
  jsonHash(maskedAST(beforeRenderer)) === jsonHash(maskedAST(afterRenderer)),
);
const growth = rendererBytes.length - old(rendererPath).length;
check('runtime source growth below four KiB', growth > 0 && growth < 4096, { bytes: growth });
let guardSource;
walk(afterRenderer.nodes.renderObstacle, (node) => {
  if (node.type === 'VariableDeclarator' && node.id.name === 'railWagon')
    guardSource = rendererSource.slice(node.init.start, node.init.end);
});
assert(guardSource);
function guard(
  obstacle,
  course = canonical,
  profile = resolveSimThemeProfile(course),
  kit = null,
  kind = 'metal',
) {
  // Missing bounds return before the actual renderer's facade block. Invalid
  // coordinate values are tested through the exact initializer without building
  // unsupported NaN/Infinity BufferGeometry objects.
  if (!obstacle?.min || !obstacle?.max) return false;
  return Boolean(
    vm.runInNewContext(guardSource, {
      obstacle,
      course,
      themeProfile: profile,
      goalMaterialKit: kit,
      kind,
      height: (obstacle.max.y - obstacle.min.y) / 1000,
    }),
  );
}
let qualityLoop;
walk(afterRenderer.nodes.setQuality, (node) => {
  if (node.type === 'ForOfStatement' && node.right.name === 'qualityDetails')
    qualityLoop = rendererSource.slice(node.start, node.end);
});
assert(qualityLoop);
const catalogue = [
    ...new Map(
      [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].map((entry) => [entry.id, entry]),
    ).values(),
  ],
  railworks = catalogue.filter((entry) => entry.course.environment === 'rail-depot'),
  canonical = railworks[0]?.course,
  collections = Object.keys(visuals.SIM_VISUAL_COLLECTIONS),
  courseIdentities = [];
check(
  'five Railworks courses, one unchanged bounds',
  railworks.length === 5 &&
    new Set(railworks.map((entry) => jsonHash(entry.course.bounds))).size === 1,
);
check('seventeen shared collections', collections.length === 17);
for (const entry of railworks) {
  check(
    entry.id + ': authored Operations profile',
    resolveSimThemeProfile(entry.course).id === 'operations' &&
      resolveSimThemeProfile(entry.course).textureFilter === 'linear',
  );
  check(
    entry.id + ': eight exact canonical wagon sizes',
    entry.course.obstacles.length === 17 &&
      ids.every((id) => {
        const obstacle = entry.course.obstacles.find((item) => item.id === id);
        return (
          obstacle &&
          axes.every(
            (axis, index) =>
              obstacle.max[axis] - obstacle.min[axis] === dimensions[id][index] * 1000,
          ) &&
          guard(obstacle, entry.course)
        );
      }),
  );
  check(entry.id + ': no imported built-in GLB', builtinWorldScene(entry.course) === null);
  courseIdentities.push({
    course: entry.id,
    dataIdentity: dataIdentity(entry.course),
    sha256: jsonHash(entry.course),
    obstaclesSha256: jsonHash(entry.course.obstacles),
  });
}
const railIds = new Set(railworks.map((entry) => entry.id));
check(
  'no installed Railworks demonstrations claimed',
  WORLD_DEMONSTRATIONS.every((row) => !railIds.has(row.proof.course)) &&
    FLIGHT_DEMONSTRATIONS.every((row) => !railIds.has(row.course)),
);

function build(variant, original, quality, appearance = 'authored') {
  const course = structuredClone(original),
    parsed = variant === 'before' ? beforeRenderer : afterRenderer;
  if (appearance.startsWith('profile:')) {
    delete course.theme;
    delete course.themeId;
    delete course.themeProfile;
    course.world = { ...course.world, theme: appearance.slice(8) };
    delete course.world.themeId;
    delete course.world.themeProfile;
  }
  const presentation = {
      collectionId: appearance.startsWith('profile:') ? 'authored' : appearance,
      revision: 'r1',
    },
    world = new THREE.Group(),
    materials = new Set(),
    geometry = new Set(),
    qualityDetails = [],
    material = (color, extras = {}) => {
      const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extras });
      materials.add(paint);
      return paint;
    };
  let api;
  const mesh = (shape, paint, parent = world) => {
      const item = new THREE.Mesh(shape, paint);
      geometry.add(shape);
      api.ownShadowMaterial(item);
      parent.add(item);
      return item;
    },
    box = (size, at, color, parent) => {
      const item = mesh(new THREE.BoxGeometry(...size), material(color), parent);
      item.position.set(...at);
      return item;
    },
    context = vm.createContext({
      ...visuals,
      THREE,
      course,
      world,
      quality,
      material,
      mesh,
      geometry,
      materials,
      qualityDetails,
      shadowMaterials: new WeakMap(),
      garageDetailMaterials: new Map(),
      stadiumDetailMaterials: new Map(),
      texturesOf: (paint) => Object.values(paint ?? {}).filter((value) => value?.isTexture),
    });
  api = vm.runInContext(
    helperNames.map((name) => parsed.functions[name]).join('\n') +
      '\n({renderObstacle, ownShadowMaterial, releaseGroup})',
    context,
  );
  const surroundings = visuals.buildWorldVisuals({
      course,
      world,
      mesh,
      material,
      box,
      quality,
      maxAnisotropy: 8,
      presentation,
    }),
    collectionId = visuals.simCollectionIdForProfile(surroundings.profile);
  Object.assign(context, {
    environmentSurfaceKind: surroundings.obstacleSurfaceKind,
    obstacleSurface: surroundings.obstacleSurface,
    obstacleMaps: surroundings.obstacleMaps,
    themeProfile: surroundings.profile,
    goalMaterialKit: collectionId
      ? visuals.createWorkshopMaterials({ collectionId, material, quality, maxAnisotropy: 8 })
      : null,
    garageDetailMaterial: surroundings.garageDetailMaterial,
    stadiumMaterial: surroundings.stadiumDetailMaterial,
    obstacleFittingsMaterial: surroundings.obstacleFittingsMaterial,
  });
  world.traverse((item) => {
    api.ownShadowMaterial(item);
    if (item.geometry) geometry.add(item.geometry);
    nodeMaterials(item, visuals).forEach((paint) => materials.add(paint));
  });
  course.obstacles.forEach(api.renderObstacle);
  world.traverse((item) => nodeMaterials(item, visuals).forEach((paint) => materials.add(paint)));
  const changeQuality = (value) => {
    visuals.setSurfaceQuality(materials, value, 8);
    surroundings.setQuality?.(value);
    context.value = value;
    vm.runInContext(qualityLoop, context);
    world.updateMatrixWorld(true);
  };
  changeQuality(quality);
  return {
    world,
    module: visuals,
    materials,
    geometry,
    qualityDetails,
    course,
    appearance,
    quality,
    surroundings,
    changeQuality,
    release: () => api.releaseGroup(world),
  };
}

function nodeMaterials(item, module) {
  return [
    ...(Array.isArray(item.material) ? item.material : [item.material]),
    ...module.ownedSimMaterials(item),
    item.customDepthMaterial,
    item.customDistanceMaterial,
  ].filter(Boolean);
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

function textureData(texture) {
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
          kind: surface.kind,
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
      pixels: texture.image?.data ? typedBytes(texture.image.data) : null,
    },
  };
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

function snapshot(built, allowedIds = [], visibleOnly = false) {
  const { world, module } = built,
    geometries = [],
    materials = [],
    textures = [],
    nodes = [],
    geometryIds = new Map(),
    materialIds = new Map(),
    textureIds = new Map(),
    allowedGeometry = new Set(),
    allowedMaterials = new Set(),
    allowedNodes = new Set();
  world.traverse((item) => {
    if (
      item.name === 'flush-surface-markings' &&
      allowedIds.includes(item.parent?.userData.collisionId)
    ) {
      allowedGeometry.add(item.geometry);
      allowedMaterials.add(item.material);
      allowedNodes.add(item);
    }
  });
  const textureId = (texture) => {
      if (!textureIds.has(texture)) {
        textureIds.set(texture, textures.length);
        textures.push(textureData(texture));
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
                allowedMaterials.has(paint) && key === 'color'
                  ? '<approved-wagon-accent-color>'
                  : value?.isTexture
                    ? { texture: textureId(value) }
                    : valueData(value),
              ]),
          ),
        );
      }
      return materialIds.get(paint);
    },
    geometryId = (shape) => {
      if (!geometryIds.has(shape)) {
        geometryIds.set(shape, geometries.length);
        const attribute = (item, key) =>
          item
            ? {
                count:
                  allowedGeometry.has(shape) && ['position', 'normal'].includes(key)
                    ? '<permitted-detail-count>'
                    : item.count,
                itemSize: item.itemSize,
                normalized: item.normalized,
                usage: item.usage,
                array:
                  allowedGeometry.has(shape) && ['position', 'normal'].includes(key)
                    ? '<permitted-detail-attribute>'
                    : valueData(item.array),
              }
            : null;
        geometries.push({
          type: shape.type,
          parameters: valueData(shape.parameters),
          attributes: Object.fromEntries(
            Object.entries(shape.attributes).map(([key, item]) => [key, attribute(item, key)]),
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
    if (visibleOnly && !item.visible) return;
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
      userData: valueData(
        allowedNodes.has(item)
          ? { ...userData, minimumQuality: '<approved-wagon-quality>' }
          : userData,
      ),
      matrix: item.matrix.elements,
      matrixWorld: item.matrixWorld.elements,
      instances: item.instanceMatrix ? valueData(item.instanceMatrix.array) : null,
      instanceColors: item.instanceColor ? valueData(item.instanceColor.array) : null,
      count: item.count,
      visible: allowedNodes.has(item) ? '<approved-wagon-visibility>' : item.visible,
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

function bufferBytes(built) {
  const arrays = new Set();
  for (const shape of resources(built).geometries) {
    if (shape.index) arrays.add(shape.index.array);
    for (const attribute of Object.values(shape.attributes)) arrays.add(attribute.array);
  }
  return [...arrays].reduce((sum, array) => sum + array.byteLength, 0);
}
function dispose(built) {
  const owned = resources(built),
    items = new Set(Object.values(owned).flatMap((set) => [...set])),
    events = new Map();
  assert(
    [...built.materials].every((paint) => owned.materials.has(paint)),
    'all created paints are reachable owners',
  );
  for (const item of items)
    item.addEventListener('dispose', () => events.set(item, (events.get(item) ?? 0) + 1));
  built.release();
  assert(
    [...items].every((item) => events.get(item) === 1),
    'actual renderer releaseGroup disposes every owned resource once',
  );
  assert.equal(built.world.children.length, 0);
  assert.equal(built.geometry.size, 0);
  assert.equal(built.materials.size, 0);
  return items.size;
}
function wagonDetails(built, id) {
  const parent = built.world.getObjectByName(id);
  return parent?.children.filter((item) => item.name === 'flush-surface-markings') ?? [];
}
function detailStats(built, allowedIds) {
  const boxes = [];
  for (const id of allowedIds) {
    const details = wagonDetails(built, id),
      size = dimensions[id];
    assert.equal(details.length, 1, id + ': reuse exactly one accent batch');
    const detail = details[0],
      shape = detail.geometry,
      positions = shape.attributes.position,
      normals = shape.attributes.normal,
      faces = new Map();
    assert.equal(positions.count, 144);
    assert.equal(normals.count, positions.count);
    assert.equal(shape.index, null);
    assert.deepEqual(Object.keys(shape.attributes).sort(), ['normal', 'position']);
    assert.equal(detail.userData.minimumQuality, 'balanced');
    assert.equal(detail.visible, built.quality !== 'low');
    assert.equal(detail.material.transparent, false);
    assert.equal(detail.material.opacity, 1);
    assert.equal(detail.material.roughness, 0.62);
    assert.equal(detail.material.metalness, 0.15);
    assert.deepEqual(detail.material.color.toArray(), new THREE.Color(0x34464b).toArray());
    assert.equal(detail.material.polygonOffset, true);
    assert.equal(detail.material.polygonOffsetFactor, -2);
    assert.equal(detail.material.polygonOffsetUnits, -2);
    assert.equal(detail.castShadow, false);
    assert.equal(detail.receiveShadow, false);
    assert.equal(Object.values(detail.material).filter((v) => v?.isTexture).length, 0);
    for (let offset = 0; offset < positions.count; offset += 6) {
      const normal = new THREE.Vector3().fromBufferAttribute(normals, offset),
        faceAxis = Math.abs(normal.x) > 0.5 ? 0 : 2,
        alongAxis = faceAxis === 0 ? 2 : 0,
        sign = normal.getComponent(faceAxis),
        face = faceAxis + ':' + sign,
        bounds = new THREE.Box3();
      assert(
        Math.abs(normal.y) < 1e-7 && Math.abs(Math.abs(sign) - 1) < 1e-7,
        'only vertical outward faces',
      );
      for (let i = offset; i < offset + 6; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i);
        assert(new THREE.Vector3().fromBufferAttribute(normals, i).distanceTo(normal) < 1e-7);
        assert(
          axes.every(
            (_, axis) =>
              Number.isFinite(point.getComponent(axis)) &&
              Math.abs(point.getComponent(axis)) <= size[axis] / 2 + 1e-5,
          ),
          'inside original box',
        );
        assert(
          Math.abs(point.getComponent(faceAxis) - (sign * size[faceAxis]) / 2) < 1e-5,
          'exactly flush with original face',
        );
        bounds.expandByPoint(point);
      }
      for (const index of [offset, offset + 3]) {
        const a = new THREE.Vector3().fromBufferAttribute(positions, index),
          b = new THREE.Vector3().fromBufferAttribute(positions, index + 1),
          c = new THREE.Vector3().fromBufferAttribute(positions, index + 2);
        assert(b.sub(a).cross(c.sub(a)).dot(normal) > 1e-6, 'nondegenerate outward winding');
      }
      const center = bounds.getCenter(new THREE.Vector3()),
        extent = bounds.getSize(new THREE.Vector3()),
        row = [center.getComponent(alongAxis), center.y, extent.getComponent(alongAxis), extent.y];
      if (!faces.has(face)) faces.set(face, []);
      faces.get(face).push(row);
    }
    assert.equal(faces.size, 4);
    for (const [face, rectangles] of faces) {
      const long = face.startsWith('0:'),
        span = long ? 13 : 5,
        a = long ? 1.6 : 2.15,
        expected = [
          [0, -1.36, span * 0.96, 0.12],
          [-a, 0.2, 0.12, 2.6],
          [a, 0.2, 0.12, 2.6],
          [0, -1.04, 2 * a - 0.12, 0.12],
          [0, 1.44, 2 * a - 0.12, 0.12],
          ...(long
            ? [
                [-5.2, 0.2, 0.12, 2.9],
                [5.2, 0.2, 0.12, 2.9],
              ]
            : []),
        ];
      assert.equal(rectangles.length, expected.length);
      for (const wanted of expected)
        assert.equal(
          rectangles.filter((row) => row.every((value, i) => Math.abs(value - wanted[i]) < 1e-5))
            .length,
          1,
          id + '/' + face + ': exact retained belt and joined frame/stiffener recipe',
        );
      for (let i = 0; i < rectangles.length; i++)
        for (let j = i + 1; j < rectangles.length; j++) {
          const a = rectangles[i],
            b = rectangles[j],
            overlapX =
              Math.min(a[0] + a[2] / 2, b[0] + b[2] / 2) -
              Math.max(a[0] - a[2] / 2, b[0] - b[2] / 2),
            overlapY =
              Math.min(a[1] + a[3] / 2, b[1] + b[3] / 2) -
              Math.max(a[1] - a[3] / 2, b[1] - b[3] / 2);
          assert(overlapX <= 1e-5 || overlapY <= 1e-5, 'no overlapping coplanar strip interiors');
        }
    }
    boxes.push({ id, quads: positions.count / 6, faces: Object.fromEntries(faces) });
  }
  return { wagons: boxes.length, quads: boxes.length * 24, triangles: boxes.length * 48, boxes };
}
function compare(course, quality, appearance, label, { allowedIds = [] } = {}) {
  const a = build('before', course, quality, appearance),
    b = build('after', course, quality, appearance),
    beforeCounts = counts(a),
    afterCounts = counts(b),
    beforeBytes = bufferBytes(a),
    afterBytes = bufferBytes(b);
  check(
    label + ': exact scene outside approved accent position/normal/color/quality',
    jsonHash(snapshot(a, allowedIds)) === jsonHash(snapshot(b, allowedIds)),
  );
  check(
    label + ': exact resource ownership counts and texture bytes',
    jsonHash(beforeCounts) === jsonHash(afterCounts),
    afterCounts,
  );
  let details;
  if (allowedIds.length) {
    for (const id of allowedIds) {
      const previous = wagonDetails(a, id);
      assert.equal(previous.length, 1);
      assert.equal(previous[0].geometry.attributes.position.count, 24);
      assert.equal(previous[0].userData.minimumQuality, 'high');
    }
    details = detailStats(b, allowedIds);
    check(
      label + ': exact closed frames, flush nonoverlapping geometry and quality',
      true,
      details,
    );
    check(
      label + ': exact 2880 additional attribute bytes / 40 triangles per wagon',
      afterBytes - beforeBytes === allowedIds.length * 2880,
      { attributeByteDelta: afterBytes - beforeBytes, extraTriangles: allowedIds.length * 40 },
    );
    if (quality === 'low')
      check(
        label + ': low visible scene exact',
        jsonHash(snapshot(a, [], true)) === jsonHash(snapshot(b, [], true)),
      );
    else
      check(
        label + ': intended visible wagon change',
        jsonHash(snapshot(a, [], true)) !== jsonHash(snapshot(b, [], true)),
      );
  } else check(label + ': all geometry buffer bytes exact', beforeBytes === afterBytes);
  scenes.push({
    label,
    quality,
    appearance,
    counts: afterCounts,
    attributeBytes: afterBytes,
    attributeByteDelta: afterBytes - beforeBytes,
    sceneSha256: jsonHash(snapshot(b)),
    ...(details ? { details } : {}),
  });
  check(label + ': actual renderer disposes all owned resources once', dispose(a) === dispose(b));
}
for (const entry of railworks)
  for (const quality of ['low', 'balanced', 'high'])
    compare(entry.course, quality, 'authored', entry.id + '/' + quality, { allowedIds: ids });
for (const appearance of collections)
  for (const quality of ['low', 'balanced', 'high'])
    compare(canonical, quality, appearance, appearance + '/' + quality);
const otherProfiles = THEME_PROFILES.filter(
  (profile) => profile.id !== 'operations' && !collections.includes(profile.id),
);
check('three other authored profiles', otherProfiles.length === 3);
for (const profile of otherProfiles)
  for (const quality of ['low', 'balanced', 'high'])
    compare(canonical, quality, 'profile:' + profile.id, profile.id + '/' + quality);
const otherWorlds = [
  ...new Map(
    catalogue
      .filter((row) => row.course.environment !== 'rail-depot')
      .map((row) => [row.course.environment, row.course]),
  ).values(),
];
check('thirteen other environments', otherWorlds.length === 13);
for (const course of otherWorlds)
  for (const appearance of ['authored', 'profile:pixel'])
    compare(course, 'balanced', appearance, course.environment + '/' + appearance);
for (const id of ids) {
  const obstacle = canonical.obstacles.find((item) => item.id === id);
  const negative = [
    ['renamed', { ...obstacle, id: id + '-custom' }],
    ['explicit box', { ...obstacle, type: 'box' }],
    ['null type', { ...obstacle, type: null }],
    ['identity rotation', { ...obstacle, rotation: [0, 0, 0, 1] }],
    ['null rotation', { ...obstacle, rotation: null }],
    ...axes.flatMap((axis) =>
      [-1, 1].map((delta) => [
        'resized ' + axis + '/' + delta,
        { ...obstacle, max: { ...obstacle.max, [axis]: obstacle.max[axis] + delta } },
      ]),
    ),
  ];
  for (const [label, changed] of negative) {
    check(id + '/' + label + ': actual guard rejects', !guard(changed));
    compare(
      { ...canonical, obstacles: [changed] },
      'balanced',
      'authored',
      'guard ' + id + '/' + label,
    );
  }
  for (const [label, changed] of [
    ['missing min', { ...obstacle, min: undefined }],
    ['missing max', { ...obstacle, max: undefined }],
    ['nonfinite min', { ...obstacle, min: { ...obstacle.min, x: NaN } }],
    ['nonfinite max', { ...obstacle, max: { ...obstacle.max, z: Infinity } }],
    ['explicit triangle type', { ...obstacle, type: 'trimesh' }],
  ])
    check(id + '/' + label + ': strict guard rejection', !guard(changed));
  const shifted = structuredClone(obstacle);
  for (const [index, axis] of axes.entries())
    for (const end of ['min', 'max']) shifted[end][axis] += [17000, 7000, -23000][index];
  check(id + ': finite same-size translated box accepted', guard(shifted));
}
const first = canonical.obstacles.find((item) => item.id === ids[0]),
  operations = resolveSimThemeProfile(canonical);
for (const id of ['rail-car-2-0', 'rail-car-0-4', 'rail-car-01-0', 'xrail-car-0-0'])
  check(id + ': anchored canonical ID guard rejects', !guard({ ...first, id }));
check(
  'different environment guard rejects',
  !guard(first, { ...canonical, environment: 'quarry' }),
);
check(
  'nearest sampling guard rejects',
  !guard(first, canonical, { ...operations, textureFilter: 'nearest' }),
);
check('shared kit guard rejects', !guard(first, canonical, operations, {}));
check(
  'other surface kind guard rejects',
  !guard(first, canonical, operations, null, 'storage-steel'),
);
const translated = structuredClone(canonical);
for (const obstacle of translated.obstacles.filter((item) => ids.includes(item.id)))
  for (const [index, axis] of axes.entries())
    for (const end of ['min', 'max']) obstacle[end][axis] += [17000, 7000, -23000][index];
compare(translated, 'high', 'authored', 'translated canonical wagons', { allowedIds: ids });
const mixed = structuredClone(canonical);
mixed.obstacles.find((item) => item.id === ids[0]).max.x++;
mixed.obstacles.push({ ...structuredClone(first), id: 'rail-car-custom' });
compare(mixed, 'balanced', 'authored', 'mixed canonical and creator wagons', {
  allowedIds: ids.slice(1),
});
const isolated = { ...canonical, obstacles: [structuredClone(first)] };
compare(isolated, 'balanced', 'authored', 'single eligible canonical wagon', {
  allowedIds: [ids[0]],
});
const reusable = build('after', canonical, 'balanced'),
  stableResources = resources(reusable),
  expected = jsonHash(snapshot(reusable));
const repeated = build('after', canonical, 'balanced');
check('deterministic repeated full scene build', expected === jsonHash(snapshot(repeated)));
dispose(repeated);
for (const quality of ['high', 'low', 'balanced']) {
  reusable.changeQuality(quality);
  check(
    'actual quality visibility loop: ' + quality,
    reusable.qualityDetails.every(
      (item) =>
        item.visible ===
        (quality === 'high' || (quality !== 'low' && item.userData.minimumQuality === 'balanced')),
    ),
  );
}
check('quality roundtrip exact scene/map bytes', expected === jsonHash(snapshot(reusable)));
const finalResources = resources(reusable);
check(
  'quality changes retain exact resource objects',
  Object.entries(stableResources).every(
    ([key, values]) =>
      values.size === finalResources[key].size &&
      [...values].every((value) => finalResources[key].has(value)),
  ),
);
dispose(reusable);
check(
  'renderer source stable during qualification',
  rendererBytes.equals(await readFile(new URL(rendererPath, root))),
);
for (const [path, sha256] of Object.entries(immutable))
  assert.equal(
    hash(await readFile(new URL(path, root))),
    sha256,
    path + ': immutable input stable',
  );
const receipt = {
  format: 'fpv-railworks-wagon-frames-manual-cpu.v1',
  baseline,
  candidate: git('rev-parse', 'HEAD').toString().trim(),
  rendererSha256: hash(rendererBytes),
  immutable,
  runtimeGrowthBytes: growth,
  courseIdentities,
  dimensions,
  checks,
  scenes,
  passed: checks.every((row) => row.passed),
  scope:
    'Actual source-extracted renderObstacle, panel/UV/detail/shadow ownership/release helpers, real Three world/material objects, and exact setQuality detail visibility loop. Base geometry/maps/edges are fully compared; exceptions are limited to eligible wagon accent position/normal arrays, paint color and quality visibility. No universal draw-call parity is claimed. Excludes PMREM, camera, actors/objectives, imported GLTF rendering, GPU timing/pixels and fresh replay. Invalid numeric guards are checked through the exact initializer without constructing invalid GPU geometry. No art acceptance claimed.',
};
if (options.out)
  await writeFile(options.out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify(
    {
      passed: receipt.passed,
      checks: checks.length,
      scenes: scenes.length,
      rendererSha256: receipt.rendererSha256,
      runtimeGrowthBytes: growth,
      canonical: scenes.slice(0, 3).map(({ details, ...row }) => ({
        ...row,
        details: { wagons: details.wagons, quads: details.quads, triangles: details.triangles },
      })),
    },
    null,
    2,
  ),
);
