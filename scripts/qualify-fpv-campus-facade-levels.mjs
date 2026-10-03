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

const root = new URL('../', import.meta.url),
  baseline = '287eec95c81687fb8a6d176f750f7c65a60e1fe3',
  prefix = 'optional-practice/civilian-fpv/',
  rendererPath = prefix + 'renderer.mjs',
  args = process.argv.slice(2),
  checks = [],
  scenes = [],
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  git = (...values) => execFileSync('git', values, { cwd: root, maxBuffer: 16 * 1024 * 1024 }),
  old = (path) => git('show', baseline + ':' + path),
  rendererBytes = await readFile(new URL(rendererPath, root)),
  rendererSource = rendererBytes.toString(),
  dimensions = {
    'building-west-low': [18, 9, 20, 3],
    'building-east-mid': [18, 14, 20, 4],
    'building-west-high': [18, 19, 22, 6],
    'building-east-high': [18, 23, 22, 7],
  },
  ids = Object.keys(dimensions),
  axes = ['x', 'y', 'z'];
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Use --out NEW_RECEIPT.json');
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
  let changedBlocks = 0;
  function clean(node, inObstacle = false) {
    if (Array.isArray(node)) return node.map((item) => clean(item, inObstacle));
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'FunctionDeclaration') inObstacle = node.id.name === 'renderObstacle';
    if (
      inObstacle &&
      node.type === 'IfStatement' &&
      parsed.text.slice(node.test.start, node.test.end) === 'size && size[1] > 0.5'
    ) {
      changedBlocks++;
      return { type: 'PermittedFacadeDetailBlock' };
    }
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !['start', 'end', 'raw'].includes(key))
        .map(([key, value]) => [key, clean(value, inObstacle)]),
    );
  }
  const ast = clean(parsed.ast);
  assert.equal(changedBlocks, 1);
  return ast;
}
check(
  'renderer AST exact outside existing facade-detail block',
  jsonHash(maskedAST(beforeRenderer)) === jsonHash(maskedAST(afterRenderer)),
);
const growth = rendererBytes.length - old(rendererPath).length;
check('runtime source growth below four KiB', growth > 0 && growth < 4096, { bytes: growth });
const guardNodes = {};
walk(afterRenderer.nodes.renderObstacle, (node) => {
  if (node.type === 'VariableDeclarator' && ['campusSize', 'campusStories'].includes(node.id.name))
    guardNodes[node.id.name] = rendererSource.slice(node.init.start, node.init.end);
});
assert(guardNodes.campusSize && guardNodes.campusStories);
function guard(obstacle, course = canonical, profile = resolveSimThemeProfile(course), kit = null) {
  // Missing bounds return before the actual renderer's facade block. Invalid
  // coordinate values are tested through the exact initializer without building
  // unsupported NaN/Infinity BufferGeometry objects.
  if (!obstacle?.min || !obstacle?.max) return 0;
  return vm.runInNewContext(
    'const campusSize = ' + guardNodes.campusSize + ';\n' + guardNodes.campusStories,
    {
      obstacle,
      course,
      themeProfile: profile,
      goalMaterialKit: kit,
      kind: 'plaster',
      height: (obstacle.max.y - obstacle.min.y) / 1000,
    },
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
  campuses = catalogue.filter((entry) => entry.course.environment === 'rooftops'),
  canonical = campuses[0]?.course,
  collections = Object.keys(visuals.SIM_VISUAL_COLLECTIONS),
  courseIdentities = [];
check(
  'five Campus courses, one unchanged bounds',
  campuses.length === 5 &&
    new Set(campuses.map((entry) => jsonHash(entry.course.bounds))).size === 1,
);
check('seventeen shared collections', collections.length === 17);
for (const entry of campuses) {
  check(
    entry.id + ': authored Pixel profile',
    resolveSimThemeProfile(entry.course).id === 'pixel' &&
      resolveSimThemeProfile(entry.course).textureFilter === 'nearest',
  );
  check(
    entry.id + ': four exact canonical building sizes',
    ids.every((id) => {
      const obstacle = entry.course.obstacles.find((item) => item.id === id);
      return (
        obstacle &&
        axes.every(
          (axis, index) => obstacle.max[axis] - obstacle.min[axis] === dimensions[id][index] * 1000,
        ) &&
        guard(obstacle, entry.course) === dimensions[id][3]
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
const campusIds = new Set(campuses.map((entry) => entry.id));
check(
  'no installed Campus demonstrations claimed',
  WORLD_DEMONSTRATIONS.every((row) => !campusIds.has(row.proof.course)) &&
    FLIGHT_DEMONSTRATIONS.every((row) => !campusIds.has(row.course)),
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
    allowedMaps = new Set(),
    allowedGeometry = new Set();
  world.traverse((item) => {
    if (
      item.name === 'flush-surface-markings' &&
      allowedIds.includes(item.parent?.userData.collisionId)
    )
      allowedGeometry.add(item.geometry);
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
                count: allowedGeometry.has(shape) ? '<permitted-detail-count>' : item.count,
                itemSize: item.itemSize,
                normalized: item.normalized,
                usage: item.usage,
                array: allowedGeometry.has(shape)
                  ? '<permitted-detail-attribute>'
                  : valueData(item.array),
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
function buildingDetails(built, id) {
  const parent = built.world.getObjectByName(id);
  return parent?.children.filter((item) => item.name === 'flush-surface-markings') ?? [];
}
function detailStats(built, allowedIds) {
  let panes = 0,
    accents = 0,
    vertices = 0;
  const boxes = [],
    bridge = built.course.obstacles.find(
      (obstacle) =>
        obstacle.id === 'roof-deck-skybridge' &&
        obstacle.type === undefined &&
        obstacle.rotation === undefined &&
        axes.every(
          (axis, i) =>
            Number.isFinite(obstacle.min?.[axis]) &&
            Number.isFinite(obstacle.max?.[axis]) &&
            obstacle.max[axis] - obstacle.min[axis] === [50000, 1200, 6000][i],
        ),
    );
  for (const id of allowedIds) {
    const parent = built.world.getObjectByName(id),
      size = axes.map(
        (axis) =>
          (built.course.obstacles.find((item) => item.id === id).max[axis] -
            built.course.obstacles.find((item) => item.id === id).min[axis]) /
          1000,
      ),
      details = buildingDetails(built, id),
      levels = new Set();
    assert.equal(details.length, 2, id + ': the same two detail batches');
    for (const detail of details) {
      const positions = detail.geometry.attributes.position,
        normals = detail.geometry.attributes.normal,
        pane = detail.userData.minimumQuality === 'balanced';
      assert.equal(positions.count % 6, 0);
      assert.equal(normals.count, positions.count);
      assert.equal(detail.geometry.index, null);
      assert.deepEqual(Object.keys(detail.geometry.attributes).sort(), ['normal', 'position']);
      assert.equal(detail.material.transparent, false);
      assert.equal(detail.material.polygonOffset, true);
      assert.equal(detail.material.polygonOffsetFactor, -2);
      assert.equal(detail.material.polygonOffsetUnits, -2);
      assert.equal(detail.castShadow, false);
      vertices += positions.count;
      if (pane) panes += positions.count / 6;
      else accents += positions.count / 6;
      for (let index = 0; index < positions.count; index += 6) {
        const normal = new THREE.Vector3().fromBufferAttribute(normals, index),
          faceAxis = Math.abs(normal.x) > 0.5 ? 0 : 2,
          faceSign = normal.getComponent(faceAxis),
          bounds = new THREE.Box3();
        assert(
          Math.abs(normal.y) < 1e-7 && Math.abs(Math.abs(faceSign) - 1) < 1e-7,
          'only vertical outward faces',
        );
        for (let i = index; i < index + 6; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, i),
            n = new THREE.Vector3().fromBufferAttribute(normals, i);
          assert(n.distanceTo(normal) < 1e-7);
          assert(
            axes.every(
              (_, axis) =>
                Number.isFinite(p.getComponent(axis)) &&
                Math.abs(p.getComponent(axis)) <= size[axis] / 2 + 0.00001,
            ),
            'all artwork confined to closed box',
          );
          assert(
            Math.abs(p.getComponent(faceAxis) - (faceSign * size[faceAxis]) / 2) < 0.00001,
            'all artwork exactly flush',
          );
          bounds.expandByPoint(p.clone().applyMatrix4(parent.matrixWorld));
        }
        for (const offset of [0, 3]) {
          const a = new THREE.Vector3().fromBufferAttribute(positions, index + offset),
            b = new THREE.Vector3().fromBufferAttribute(positions, index + offset + 1),
            c = new THREE.Vector3().fromBufferAttribute(positions, index + offset + 2);
          assert(
            b.sub(a).cross(c.sub(a)).dot(normal) > 0.000001,
            'outward nondegenerate triangles',
          );
        }
        if (pane) {
          const center = bounds.getCenter(new THREE.Vector3());
          levels.add(Math.round(center.y * 100000));
          const dimensions = bounds.getSize(new THREE.Vector3()),
            alongAxis = faceAxis === 0 ? 2 : 0;
          assert(
            dimensions.y > 1.49 &&
              dimensions.y <= 1.50001 &&
              dimensions.getComponent(alongAxis) > 1.97 &&
              dimensions.getComponent(alongAxis) <= 2.00001,
            'intended full-height-storey pane dimensions',
          );
          if (bridge) {
            const min = axes.map((axis) => bridge.min[axis] / 1000),
              max = axes.map((axis) => bridge.max[axis] / 1000),
              face = center.getComponent(faceAxis);
            assert(
              !(
                face >= min[faceAxis] &&
                face <= max[faceAxis] &&
                bounds.max.getComponent(alongAxis) > min[alongAxis] + 0.00001 &&
                bounds.min.getComponent(alongAxis) < max[alongAxis] - 0.00001 &&
                bounds.max.y > min[1] + 0.00001 &&
                bounds.min.y < max[1] - 0.00001
              ),
              'no pane intersects canonical solid bridge attachment',
            );
          }
        }
      }
    }
    assert.equal(levels.size, dimensions[id][3], id + ': specified floor hierarchy');
    boxes.push({
      id,
      stories: levels.size,
      paneQuads: details[0].geometry.attributes.position.count / 6,
      accentQuads: details[1].geometry.attributes.position.count / 6,
    });
  }
  return { panes, accents, vertices, triangles: vertices / 3, boxes };
}
function compare(course, quality, appearance, label, { allowedIds = [], expectedPanes } = {}) {
  const a = build('before', course, quality, appearance),
    b = build('after', course, quality, appearance),
    left = snapshot(a, allowedIds),
    right = snapshot(b, allowedIds),
    beforeCounts = counts(a),
    afterCounts = counts(b),
    beforeBytes = bufferBytes(a),
    afterBytes = bufferBytes(b);
  check(
    label + ': geometry/maps/materials exact outside approved detail attributes',
    jsonHash(left) === jsonHash(right),
  );
  check(
    label + ': exact resource ownership counts and texture bytes',
    jsonHash(beforeCounts) === jsonHash(afterCounts),
    afterCounts,
  );
  let details;
  if (allowedIds.length) {
    details = detailStats(b, allowedIds);
    check(label + ': flush/in-bounds opaque details and coherent floor hierarchy', true, details);
    if (expectedPanes !== undefined)
      check(label + ': expected bridge-safe pane count', details.panes === expectedPanes, {
        panes: details.panes,
      });
    check(
      label + ': at most 544 extra triangles / 39168 attribute bytes',
      afterBytes > beforeBytes && afterBytes - beforeBytes <= 39168,
      { attributeByteDelta: afterBytes - beforeBytes },
    );
    if (quality === 'low')
      check(
        label + ': low visible scene byte-exact',
        jsonHash(snapshot(a, [], true)) === jsonHash(snapshot(b, [], true)),
      );
    else
      check(
        label + ': visible facade geometry changed',
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

for (const entry of campuses)
  for (const quality of ['low', 'balanced', 'high'])
    compare(entry.course, quality, 'authored', entry.id + '/' + quality, {
      allowedIds: ids,
      expectedPanes: 398,
    });
for (const appearance of collections)
  for (const quality of ['low', 'balanced', 'high'])
    compare(canonical, quality, appearance, appearance + '/' + quality);
const nonPixelProfiles = THEME_PROFILES.filter(
  (profile) => profile.id !== 'pixel' && !collections.includes(profile.id),
);
for (const profile of nonPixelProfiles)
  for (const quality of ['low', 'balanced', 'high'])
    compare(canonical, quality, 'profile:' + profile.id, 'non-Pixel ' + profile.id + '/' + quality);
const otherWorlds = [
  ...new Map(
    catalogue
      .filter((entry) => entry.course.environment !== 'rooftops')
      .map((entry) => [entry.course.environment, entry]),
  ).values(),
];
check('thirteen other environments retained', otherWorlds.length === 13);
for (const entry of otherWorlds)
  for (const appearance of ['authored', 'profile:pixel'])
    compare(
      entry.course,
      'balanced',
      appearance,
      'other ' + entry.course.environment + '/' + appearance,
    );

for (const id of ids) {
  const obstacle = canonical.obstacles.find((item) => item.id === id);
  const negative = [
    ['renamed', { ...obstacle, id: id + '-custom' }],
    ['explicit box', { ...obstacle, type: 'box' }],
    ['null type', { ...obstacle, type: null }],
    ['identity rotation', { ...obstacle, rotation: [0, 0, 0, 1] }],
    ['null rotation', { ...obstacle, rotation: null }],
    ...axes.map((axis) => [
      'resized ' + axis,
      { ...obstacle, max: { ...obstacle.max, [axis]: obstacle.max[axis] + 1 } },
    ]),
  ];
  for (const [label, changed] of negative) {
    check(id + '/' + label + ': actual guard rejects', guard(changed) === 0);
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
    check(id + '/' + label + ': strict guard rejection', guard(changed) === 0);
  const shifted = structuredClone(obstacle);
  for (const [i, axis] of axes.entries())
    for (const end of ['min', 'max']) shifted[end][axis] += [17000, 7000, -23000][i];
  check(id + ': finite same-size translated box accepted', guard(shifted) === dimensions[id][3]);
}
const translated = structuredClone(canonical);
for (const obstacle of translated.obstacles.filter((item) => ids.includes(item.id)))
  for (const [i, axis] of axes.entries())
    for (const end of ['min', 'max']) obstacle[end][axis] += [17000, 7000, -23000][i];
compare(translated, 'high', 'authored', 'translated buildings clear original bridge', {
  allowedIds: ids,
  expectedPanes: 400,
});
for (const obstacle of translated.obstacles.filter((item) => item.id === 'roof-deck-skybridge'))
  for (const [i, axis] of axes.entries())
    for (const end of ['min', 'max']) obstacle[end][axis] += [17000, 7000, -23000][i];
compare(
  translated,
  'high',
  'authored',
  'translated buildings and bridge retain attachment omission',
  { allowedIds: ids, expectedPanes: 398 },
);
for (const [label, patch] of [
  ['explicit box', { type: 'box' }],
  ['identity rotation', { rotation: [0, 0, 0, 1] }],
]) {
  const course = structuredClone(canonical),
    index = course.obstacles.findIndex((item) => item.id === 'roof-deck-skybridge');
  course.obstacles[index] = { ...course.obstacles[index], ...patch };
  compare(course, 'high', 'authored', 'unsupported bridge ' + label, {
    allowedIds: ids,
    expectedPanes: 400,
  });
}
const extra = structuredClone(canonical);
extra.obstacles.push({
  id: 'building-custom',
  min: { x: -10000, y: 0, z: -55000 },
  max: { x: -4000, y: 12000, z: -45000 },
});
compare(extra, 'balanced', 'authored', 'creator mixed canonical/custom boxes', {
  allowedIds: ids,
  expectedPanes: 398,
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
  format: 'fpv-campus-facade-levels-manual-cpu.v1',
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
    'Actual source-extracted renderObstacle, panel/UV/detail/shadow ownership/release helpers, real Three world/material objects, and exact setQuality detail visibility loop. Base geometry/maps/edges are fully compared. Excludes PMREM, camera, actors/objectives, imported GLTF rendering, GPU timing/pixels and fresh replay. Invalid numeric guards are checked through the exact initializer without constructing invalid GPU geometry. No art acceptance claimed.',
};
if (args.length) await writeFile(args[1], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
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
