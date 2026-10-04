#!/usr/bin/env node
// Manual source-bound CPU qualification. No new unit suite or art/GPU/replay claim.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../optional-practice/civilian-fpv/vendor/three.module.js';
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

const options = { baseline: 'a46aded0b56c612fbbfb1736cfb27ee0746c2b1f', out: null };
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
  visualPath = prefix + 'world-visuals.mjs',
  checks = [],
  scenes = [],
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  git = (...values) => execFileSync('git', values, { cwd: root, maxBuffer: 16 * 1024 * 1024 }),
  old = (path) => git('show', baseline + ':' + path),
  rendererBytes = await readFile(new URL(rendererPath, root)),
  rendererSource = rendererBytes.toString(),
  visualBytes = await readFile(new URL(visualPath, root)),
  dimensions = Object.fromEntries(
    [0, 1, 2, 3].flatMap((row) =>
      [0, 1, 2, 3].map((column) => [`solar-panel-${row}-${column}`, [11, 0.3, 7]]),
    ),
  ),
  ids = Object.keys(dimensions),
  axes = ['x', 'y', 'z'];
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
const beforeVisuals = await sourceModule(visualPath, old(visualPath)),
  afterVisuals = await sourceModule(visualPath, visualBytes);
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
  ...runtimeFiles.filter((path) => ![rendererPath, visualPath].includes(path)),
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
const beforeVisualSource = parseRenderer(old(visualPath)),
  afterVisualSource = parseRenderer(visualBytes);
function normalizedSource(parsed, visual = false) {
  function solarTest(node) {
    return (
      node?.type === 'BinaryExpression' &&
      node.operator === '===' &&
      node.left.type === 'Identifier' &&
      node.left.name === 'kind' &&
      node.right.type === 'Literal' &&
      node.right.value === 'solar-array'
    );
  }
  function clean(node) {
    if (Array.isArray(node)) return node.map(clean).filter((item) => item !== undefined);
    if (!node || typeof node !== 'object') return node;
    if (!visual && node.type === 'FunctionDeclaration' && node.id.name === 'solarPanelUV')
      return undefined;
    if (
      visual &&
      node.type === 'VariableDeclarator' &&
      ['solarPanels', 'solarArray'].includes(node.id.name)
    )
      return undefined;
    if (visual && node.type === 'Property' && node.key.value === 'solar-array') return undefined;
    if (node.type === 'IfStatement' && solarTest(node.test))
      return clean(node.alternate) ?? undefined;
    if (
      node.type === 'ConditionalExpression' &&
      (solarTest(node.test) ||
        (visual && node.test.type === 'Identifier' && node.test.name === 'solarArray'))
    )
      return clean(node.alternate);
    if (
      !visual &&
      node.type === 'LogicalExpression' &&
      node.operator === '||' &&
      solarTest(node.right)
    )
      return clean(node.left);
    const result = Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !['start', 'end', 'raw'].includes(key))
        .map(([key, value]) => [key, clean(value)]),
    );
    if (result.type === 'VariableDeclaration' && !result.declarations.length) return undefined;
    return result;
  }
  return clean(parsed.ast);
}
check(
  'renderer AST exact outside solar UV helper, UV selection and material choices',
  jsonHash(normalizedSource(beforeRenderer)) === jsonHash(normalizedSource(afterRenderer)),
);
check(
  'world visuals AST exact outside solar atlas recipe, whole-world guard and kind mapping',
  jsonHash(normalizedSource(beforeVisualSource, true)) ===
    jsonHash(normalizedSource(afterVisualSource, true)),
);
const growth =
  rendererBytes.length - old(rendererPath).length + visualBytes.length - old(visualPath).length;
check('combined runtime source growth below three KiB', growth > 0 && growth <= 3072, {
  bytes: growth,
});
const guardNodes = {};
walk(afterVisualSource.nodes.buildWorldVisuals, (node) => {
  if (node.type === 'VariableDeclarator' && ['solarPanels', 'solarArray'].includes(node.id.name))
    guardNodes[node.id.name] = visualBytes.toString().slice(node.init.start, node.init.end);
});
assert(guardNodes.solarPanels && guardNodes.solarArray);
function guard(course = canonical, profile = resolveSimThemeProfile(course), kit = null) {
  return Boolean(
    vm.runInNewContext(
      'const solarPanels = ' + guardNodes.solarPanels + ';\n' + guardNodes.solarArray,
      {
        course,
        profile,
        environment: course.environment,
        pixel: profile.textureFilter === 'nearest',
        kit,
      },
    ),
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
  solarCourses = catalogue.filter((entry) => entry.course.environment === 'solar-farm'),
  canonical = solarCourses[0]?.course,
  collections = Object.keys(afterVisuals.SIM_VISUAL_COLLECTIONS),
  courseIdentities = [],
  canonicalRotation = [Math.sin(Math.PI / 24), 0, 0, Math.cos(Math.PI / 24)];
check(
  'five Solar courses, one unchanged bounds',
  solarCourses.length === 5 &&
    new Set(solarCourses.map((entry) => jsonHash(entry.course.bounds))).size === 1,
);
check('seventeen shared collections', collections.length === 17);
for (const entry of solarCourses) {
  check(
    entry.id + ': authored Operations/linear profile',
    resolveSimThemeProfile(entry.course).id === 'operations' &&
      resolveSimThemeProfile(entry.course).textureFilter === 'linear',
  );
  check(
    entry.id + ': sixteen exact canonical tilted panels',
    entry.course.obstacles.length === 34 &&
      guard(entry.course) &&
      ids.every((id) => {
        const obstacle = entry.course.obstacles.find((item) => item.id === id);
        return (
          obstacle &&
          obstacle.type === undefined &&
          axes.every(
            (axis, index) =>
              obstacle.max[axis] - obstacle.min[axis] === dimensions[id][index] * 1000,
          ) &&
          jsonHash(obstacle.rotation) === jsonHash(canonicalRotation)
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
const solarIds = new Set(solarCourses.map((entry) => entry.id));
check(
  'no installed Solar demonstrations claimed',
  WORLD_DEMONSTRATIONS.every((row) => !solarIds.has(row.proof.course)) &&
    FLIGHT_DEMONSTRATIONS.every((row) => !solarIds.has(row.course)),
);

function build(variant, original, quality, appearance = 'authored') {
  const course = structuredClone(original),
    visuals = variant === 'before' ? beforeVisuals : afterVisuals,
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
    [...helperNames, ...(variant === 'after' ? ['solarPanelUV'] : [])]
      .map((name) => parsed.functions[name])
      .join('\n') + '\n({renderObstacle, ownShadowMaterial, releaseGroup})',
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
          kind: allowed ? '<approved-solar-map>' : surface.kind,
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
        ? '<approved-solar-pixels>'
        : texture.image?.data
          ? typedBytes(texture.image.data)
          : null,
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

function snapshot(built, allowSolar = false, visibleOnly = false) {
  const { world, module } = built,
    geometries = [],
    materials = [],
    textures = [],
    nodes = [],
    geometryIds = new Map(),
    materialIds = new Map(),
    textureIds = new Map(),
    allowedMaps = new Set(),
    allowedGeometry = new Set(),
    allowedMaterials = new Set(),
    allowedNodes = new Set();
  world.traverse((item) => {
    if (allowSolar && ids.includes(item.userData.collisionId)) {
      allowedGeometry.add(item.geometry);
      allowedMaterials.add(item.material);
      allowedNodes.add(item);
      Object.values(item.material)
        .filter((value) => value?.isTexture)
        .forEach((value) => allowedMaps.add(value));
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
                allowedMaterials.has(paint) && key === 'roughness'
                  ? '<approved-solar-roughness>'
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
                count: item.count,
                itemSize: item.itemSize,
                normalized: item.normalized,
                usage: item.usage,
                array:
                  allowedGeometry.has(shape) && key === 'uv'
                    ? '<approved-solar-uv>'
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
        allowedNodes.has(item) ? { ...userData, surfaceKind: '<approved-solar-kind>' } : userData,
      ),
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
function atlasStats(built) {
  const maps = new Set();
  let topVertices = 0,
    quietVertices = 0;
  for (const id of ids) {
    const item = built.world.getObjectByName(id),
      shape = item.geometry,
      p = shape.attributes.position,
      n = shape.attributes.normal,
      uv = shape.attributes.uv;
    assert.equal(item.userData.surfaceKind, 'solar-array');
    assert.equal(item.userData.materialRole, 'steel');
    assert.equal(item.material.roughness, 0.8);
    assert.equal(item.material.metalness, 0.35);
    assert.equal(item.material.opacity, 1);
    assert.equal(item.material.transparent, false);
    assert(!Array.isArray(item.material), 'original single material retains shadow ownership');
    assert.equal(p.count, 24);
    assert.equal(shape.index.count, 36);
    assert.deepEqual(Object.keys(shape.attributes).sort(), ['normal', 'position', 'uv']);
    for (let i = 0; i < p.count; i++) {
      const top = n.getY(i) > 0.5,
        size = dimensions[id],
        across = Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) / size[2] : p.getX(i) / size[0],
        along = Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) / size[2] : p.getY(i) / size[1],
        expectedU = 0.015 + (across + 0.5) * 0.97,
        expectedV = (top ? 0.17 : 0.02) + (along + 0.5) * (top ? 0.81 : 0.1);
      assert(Math.abs(uv.getX(i) - expectedU) < 1e-6);
      assert(Math.abs(uv.getY(i) - expectedV) < 1e-6);
      assert(uv.getX(i) >= 0.015 - 1e-6 && uv.getX(i) <= 0.985 + 1e-6);
      assert(
        top
          ? uv.getY(i) >= 0.17 - 1e-6 && uv.getY(i) <= 0.98 + 1e-6
          : uv.getY(i) >= 0.02 - 1e-6 && uv.getY(i) <= 0.12 + 1e-6,
      );
      if (top) topVertices++;
      else quietVertices++;
    }
    Object.values(item.material)
      .filter((value) => value?.isTexture)
      .forEach((map) => maps.add(map));
  }
  assert.equal(topVertices, 64);
  assert.equal(quietVertices, 320);
  assert.equal(maps.size, 3);
  const allSolarMaps = [...resources(built).textures].filter((map) =>
    ['solar', 'solar-array'].includes(map.userData.surface?.kind),
  );
  assert.equal(allSolarMaps.length, 3, 'new and generic solar trios never coexist');
  const first = built.world.getObjectByName(ids[0]),
    color = first.material.map,
    normal = first.material.normalMap,
    orm = first.material.roughnessMap,
    size = { low: 128, balanced: 256, high: 512 }[built.quality],
    roughnessClasses = new Set();
  assert.equal(first.material.metalnessMap, null, 'existing scalar metalness remains untextured');
  assert.equal(first.material.aoMap, orm);
  assert.equal(new Set([color, normal, orm]).size, 3);
  for (const map of maps) {
    assert.equal(map.userData.surface.kind, 'solar-array');
    assert.equal(map.image.width, size);
    assert.equal(map.image.height, size);
    assert.equal(map.wrapS, THREE.RepeatWrapping);
    assert.equal(map.wrapT, THREE.RepeatWrapping);
    assert.equal(map.magFilter, THREE.LinearFilter);
    assert.equal(map.minFilter, THREE.LinearMipmapLinearFilter);
    for (let i = 3; i < map.image.data.length; i += 4) assert.equal(map.image.data[i], 255);
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const at = (y * size + x) * 4;
      roughnessClasses.add(orm.image.data[at + 1]);
      if (y / size >= 0.02 && y / size <= 0.12) {
        assert.equal(orm.image.data[at + 1], 242, 'quiet back has uniform roughness');
        assert.equal(orm.image.data[at + 2], 0, 'unused packed blue channel remains zero');
      }
    }
  assert.deepEqual(
    [...roughnessClasses].sort((a, b) => a - b),
    [82, 173, 242],
  );
  for (let row = 0; row < 3; row++)
    for (let column = 0; column < 10; column++) {
      const x = Math.round((0.015 + (column + 0.5) * 0.097) * size),
        y = Math.round((0.17 + (row + 0.5) * 0.27) * size),
        at = (y * size + x) * 4;
      assert.equal(orm.image.data[at + 1], 82, 'all thirty module centres contain glass');
      assert(
        color.image.data[at + 2] > color.image.data[at],
        'module centres retain blue cell colour',
      );
    }
  return {
    panels: 16,
    topVertices,
    quietVertices,
    modules: 30,
    maps: [...maps].map((map) => ({
      kind: map.userData.surface.kind,
      width: map.image.width,
      height: map.image.height,
      sha256: typedBytes(map.image.data),
    })),
  };
}
function capacities(built) {
  let meshes = 0,
    triangles = 0,
    visibleTriangles = 0,
    shadowTriangles = 0;
  built.world.traverse((item) => {
    if (!item.isMesh) return;
    meshes++;
    const count =
      ((item.geometry.index?.count ?? item.geometry.attributes.position?.count ?? 0) / 3) *
      (item.isInstancedMesh ? item.count : 1);
    triangles += count;
    let visible = true;
    for (let p = item; p; p = p.parent) if (!p.visible) visible = false;
    if (visible) visibleTriangles += count;
    if (item.castShadow) shadowTriangles += count;
  });
  return { meshes, triangles, visibleTriangles, shadowTriangles };
}
function compare(course, quality, appearance, label, allowed = false) {
  const a = build('before', course, quality, appearance),
    b = build('after', course, quality, appearance),
    ac = counts(a),
    bc = counts(b),
    beforeBytes = bufferBytes(a),
    afterBytes = bufferBytes(b);
  check(
    label + ': exact scene except approved solar maps/kind/UV/roughness',
    jsonHash(snapshot(a, allowed)) === jsonHash(snapshot(b, allowed)),
  );
  check(label + ': exact owner counts and texture allocation', jsonHash(ac) === jsonHash(bc), bc);
  check(
    label + ': exact geometry bytes and submitted-capacity inputs',
    beforeBytes === afterBytes && jsonHash(capacities(a)) === jsonHash(capacities(b)),
    capacities(b),
  );
  let atlas;
  if (allowed) {
    atlas = atlasStats(b);
    check(label + ': exact top/quiet UV regions, single map trio and opaque atlas', true, atlas);
    check(
      label + ': intended atlas pixels differ',
      jsonHash(snapshot(a)) !== jsonHash(snapshot(b)),
    );
  } else {
    check(
      label + ': generic solar map ownership unchanged',
      [...resources(b).textures].every((map) => map.userData.surface?.kind !== 'solar-array'),
    );
  }
  scenes.push({
    label,
    quality,
    appearance,
    counts: bc,
    attributeBytes: afterBytes,
    capacities: capacities(b),
    sceneSha256: jsonHash(snapshot(b)),
    ...(atlas ? { atlas } : {}),
  });
  check(label + ': actual renderer disposes all owners once', dispose(a) === dispose(b));
}
for (const entry of solarCourses)
  for (const quality of ['low', 'balanced', 'high'])
    compare(entry.course, quality, 'authored', entry.id + '/' + quality, true);
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
      .filter((row) => row.course.environment !== 'solar-farm')
      .map((row) => [row.course.environment, row.course]),
  ).values(),
];
check('thirteen other environments', otherWorlds.length === 13);
for (const course of otherWorlds)
  for (const appearance of ['authored', 'profile:pixel'])
    compare(course, 'balanced', appearance, course.environment + '/' + appearance);

const guardCases = [];
for (const id of ids) {
  const obstacle = canonical.obstacles.find((item) => item.id === id);
  const variants = [
    ['renamed', { ...obstacle, id: id + '-custom' }],
    ['explicit box', { ...obstacle, type: 'box' }],
    ['null type', { ...obstacle, type: null }],
    ['identity rotation', { ...obstacle, rotation: [0, 0, 0, 1] }],
    ['missing rotation', { ...obstacle, rotation: undefined }],
    ['null rotation', { ...obstacle, rotation: null }],
    [
      'changed tilt',
      { ...obstacle, rotation: [Math.sin(Math.PI / 25), 0, 0, Math.cos(Math.PI / 25)] },
    ],
    ['opposite quaternion', { ...obstacle, rotation: obstacle.rotation.map((value) => -value) }],
    ...axes.flatMap((axis) =>
      [-1, 1].map((delta) => [
        'resized ' + axis + '/' + delta,
        { ...obstacle, max: { ...obstacle.max, [axis]: obstacle.max[axis] + delta } },
      ]),
    ),
  ];
  for (const [label, changed] of variants) {
    const course = structuredClone(canonical);
    course.obstacles[course.obstacles.findIndex((o) => o.id === id)] = changed;
    check(id + '/' + label + ': whole-world guard rejects', !guard(course));
    if (id === ids[0]) guardCases.push([label, course]);
  }
  for (const [label, changed] of [
    ['missing min', { ...obstacle, min: undefined }],
    ['missing max', { ...obstacle, max: undefined }],
    ['nonfinite min', { ...obstacle, min: { ...obstacle.min, x: NaN } }],
    ['nonfinite max', { ...obstacle, max: { ...obstacle.max, z: Infinity } }],
    ['nonfinite rotation', { ...obstacle, rotation: [NaN, 0, 0, 1] }],
    ['short rotation', { ...obstacle, rotation: [0, 0, 1] }],
    ['string rotation', { ...obstacle, rotation: 'abcd' }],
    ['object rotation', { ...obstacle, rotation: { length: 4 } }],
    ['trimesh', { ...obstacle, type: 'trimesh' }],
  ]) {
    const course = structuredClone(canonical);
    course.obstacles[course.obstacles.findIndex((o) => o.id === id)] = changed;
    check(id + '/' + label + ': exact guard rejection without invalid geometry', !guard(course));
  }
  const course = structuredClone(canonical),
    shifted = course.obstacles.find((o) => o.id === id);
  for (const [i, axis] of axes.entries())
    for (const end of ['min', 'max']) shifted[end][axis] += [17000, 7000, -23000][i];
  check(id + ': finite same-size canonical rotation translation accepted', guard(course));
}
for (const [label, course] of guardCases)
  compare(course, 'balanced', 'authored', 'creator ' + label);
for (const label of [
  'missing panel',
  'additional panel',
  'duplicate ID',
  'replace with unknown panel',
]) {
  const course = structuredClone(canonical);
  if (label === 'missing panel') course.obstacles = course.obstacles.filter((o) => o.id !== ids[0]);
  else if (label === 'additional panel')
    course.obstacles.push({ ...structuredClone(course.obstacles[0]), id: 'solar-panel-custom' });
  else if (label === 'duplicate ID') course.obstacles.find((o) => o.id === ids[0]).id = ids[1];
  else course.obstacles.find((o) => o.id === ids[0]).id = 'solar-panel-4-0';
  check(label + ': whole-world guard rejects', !guard(course));
  for (const quality of ['low', 'balanced', 'high'])
    compare(course, quality, 'authored', 'creator ' + label + '/' + quality);
}
const translated = structuredClone(canonical);
for (const obstacle of translated.obstacles.filter((o) => ids.includes(o.id)))
  for (const [i, axis] of axes.entries())
    for (const end of ['min', 'max']) obstacle[end][axis] += [17000, 7000, -23000][i];
compare(translated, 'balanced', 'authored', 'all canonical panels translated', true);
const extra = structuredClone(canonical);
extra.obstacles.push({
  id: 'creator-service-box',
  min: { x: 0, y: 0, z: 0 },
  max: { x: 1000, y: 1000, z: 1000 },
});
check('additional non-panel solid preserves canonical atlas eligibility', guard(extra));
compare(extra, 'balanced', 'authored', 'additional non-panel creator solid', true);
check('different environment rejects', !guard({ ...canonical, environment: 'quarry' }));
check(
  'Pixel filtering rejects',
  !guard(canonical, { ...resolveSimThemeProfile(canonical), textureFilter: 'nearest' }),
);
check(
  'unknown filtering rejects',
  !guard(canonical, { ...resolveSimThemeProfile(canonical), textureFilter: 'unknown' }),
);
check('shared kit rejects', !guard(canonical, resolveSimThemeProfile(canonical), {}));
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
check(
  'world visuals source stable during qualification',
  visualBytes.equals(await readFile(new URL(visualPath, root))),
);
for (const [path, sha256] of Object.entries(immutable))
  assert.equal(
    hash(await readFile(new URL(path, root))),
    sha256,
    path + ': immutable input stable',
  );
const receipt = {
  format: 'fpv-solar-panel-frames-manual-cpu.v1',
  baseline,
  candidate: git('rev-parse', 'HEAD').toString().trim(),
  rendererSha256: hash(rendererBytes),
  worldVisualsSha256: hash(visualBytes),
  immutable,
  runtimeGrowthBytes: growth,
  courseIdentities,
  dimensions,
  checks,
  scenes,
  passed: checks.every((row) => row.passed),
  scope:
    'Actual source-extracted renderObstacle, panel/UV/detail/shadow ownership/release helpers, real Three world/material objects, and exact setQuality detail visibility loop. All base position/index/normal/edge/transform and owner data are compared exactly; approved solar UV, roughness, surface-kind metadata and one map trio are the only exceptions. Draw capacity inputs are exact; actual GPU submissions require browser evidence. Excludes PMREM, camera, actors/objectives, imported GLTF rendering, GPU timing/pixels and fresh replay. Invalid numeric guards are checked through the exact initializer without constructing invalid GPU geometry. No art acceptance claimed.',
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
      canonical: scenes.slice(0, 3),
    },
    null,
    2,
  ),
);
