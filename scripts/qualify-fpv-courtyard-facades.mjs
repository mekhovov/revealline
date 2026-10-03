#!/usr/bin/env node
// Manual, source-bound scene and recording qualification; not additional unit coverage.
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
import {
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  resolveSimThemeProfile,
} from '../optional-practice/civilian-fpv/world-themes.mjs';
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/demonstrations.mjs';
import { replayFlight } from '../optional-practice/civilian-fpv/model.mjs';
import {
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';

const baseline = '2dbbe0a0f26684eae0a2bdb0b7cbda087627457f',
  root = new URL('../', import.meta.url),
  args = process.argv.slice(2),
  checks = [],
  scenes = [],
  recordings = [],
  hash = (value) => createHash('sha256').update(value).digest('hex'),
  jsonHash = (value) => hash(JSON.stringify(value)),
  old = (path) =>
    execFileSync('git', ['show', baseline + ':' + path], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw Error('Use --out NEW_RECEIPT.json');
const check = (name, pass, details = undefined) => {
  checks.push({ name, passed: !!pass, ...(details === undefined ? {} : { details }) });
  assert(pass, name);
};
const immutable = {};
for (const path of execFileSync('git', ['ls-files', 'optional-practice/civilian-fpv'], {
  cwd: root,
})
  .toString()
  .trim()
  .split('\n')
  .filter((path) => /\.(?:mjs|js|wasm)$/.test(path) && !path.endsWith('/world-visuals.mjs'))) {
  const name = path.split('/').at(-1),
    current = await readFile(new URL(path, root));
  check(name + ' retains exact baseline bytes', current.equals(old(path)));
  immutable[path] = hash(current);
}
const visualPath = 'optional-practice/civilian-fpv/world-visuals.mjs',
  source = old(visualPath)
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
  courtyards = catalogue.filter((entry) => entry.course.environment === 'courtyard');
check(
  '11 Courtyard courses across three arena sizes',
  courtyards.length === 11 &&
    new Set(courtyards.map((entry) => JSON.stringify(entry.course.bounds))).size === 3,
);
function build(module, course, quality, appearance) {
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
    presentation: { collectionId: appearance, revision: 'r1' },
  });
  world.traverse((item) => {
    for (const paint of [
      ...(Array.isArray(item.material) ? item.material : [item.material]),
      ...module.ownedSimMaterials(item),
    ])
      if (paint) materials.add(paint);
  });
  module.setSurfaceQuality(materials, quality, 8);
  world.updateMatrixWorld(true);
  return world;
}
const landmark = (item) => item.userData.role === 'courtyard-house-facade';
function snapshot(world) {
  const values = [];
  world.traverse((item) => {
    if (!item.geometry || landmark(item)) return;
    const attributes = Object.fromEntries(
      Object.entries(item.geometry.attributes).map(([key, attr]) => [
        key,
        hash(Buffer.from(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength)),
      ]),
    );
    const paints = (Array.isArray(item.material) ? item.material : [item.material]).map(
      (paint) => ({
        color: paint.color.getHex(),
        roughness: paint.roughness,
        metalness: paint.metalness,
        opacity: paint.opacity,
        textures: Object.fromEntries(
          Object.entries(paint)
            .filter(([, value]) => value?.isTexture)
            .map(([key, value]) => [
              key,
              {
                filter: [value.magFilter, value.minFilter],
                repeat: value.repeat.toArray(),
                pixels: value.image?.data ? hash(value.image.data) : null,
              },
            ]),
        ),
      }),
    );
    values.push({
      name: item.name,
      attributes,
      index: item.geometry.index ? Array.from(item.geometry.index.array) : null,
      matrix: item.matrixWorld.elements,
      instances: item.instanceMatrix ? Array.from(item.instanceMatrix.array) : null,
      visible: item.visible,
      castShadow: item.castShadow,
      receiveShadow: item.receiveShadow,
      paints,
    });
  });
  return jsonHash(values);
}
function resourceCounts(world, module) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  world.traverse((item) => {
    if (item.geometry) geometries.add(item.geometry);
    for (const paint of [
      ...(Array.isArray(item.material) ? item.material : [item.material]),
      ...module.ownedSimMaterials(item),
    ]) {
      if (!paint) continue;
      materials.add(paint);
      for (const value of Object.values(paint)) if (value?.isTexture) textures.add(value);
    }
  });
  return { geometries: geometries.size, materials: materials.size, textures: textures.size };
}
function dispose(world, module) {
  const resources = new Set(),
    disposed = new Map();
  world.traverse((item) => {
    if (item.geometry) resources.add(item.geometry);
    if (item.isInstancedMesh) resources.add(item);
    for (const paint of [
      ...(Array.isArray(item.material) ? item.material : [item.material]),
      ...module.ownedSimMaterials(item),
    ]) {
      if (!paint) continue;
      resources.add(paint);
      for (const value of Object.values(paint)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources)
    resource.addEventListener('dispose', () =>
      disposed.set(resource, (disposed.get(resource) ?? 0) + 1),
    );
  module.disposeSimVisualGroup(world);
  assert(
    [...resources].every((resource) => disposed.get(resource) === 1),
    'every owned resource disposed exactly once',
  );
  assert.equal(world.children.length, 0);
  return resources.size;
}
const representative = [
  ...new Map(courtyards.map((entry) => [JSON.stringify(entry.course.bounds), entry])).values(),
];
const appearances = [
  'authored',
  'pixel',
  ...Object.values(BUILTIN_SIM_VISUAL_COLLECTIONS)
    .filter((c) => c.id !== 'authored')
    .map((c) => c.id),
];
for (const entry of representative)
  for (const quality of ['low', 'balanced', 'high'])
    for (const appearance of appearances) {
      const course = structuredClone(entry.course);
      if (appearance === 'pixel') course.world = { ...course.world, theme: 'pixel' };
      const presentation = appearance === 'pixel' ? 'authored' : appearance,
        isPixel =
          resolveSimThemeProfile(course, { collectionId: presentation, revision: 'r1' })
            .textureFilter === 'nearest',
        a = build(before, course, quality, presentation),
        b = build(after, course, quality, presentation),
        details = [];
      b.traverse((item) => {
        if (landmark(item)) details.push(item);
      });
      check(
        `${entry.id}/${quality}/${appearance}: existing geometry, transforms, UVs and material pixels exact`,
        snapshot(a) === snapshot(b),
      );
      check(
        `${entry.id}/${quality}/${appearance}: six opaque batches or exact Pixel exclusion`,
        details.length === (isPixel ? 0 : 6) &&
          details.every(
            (item) =>
              !item.castShadow &&
              item.receiveShadow &&
              !item.material.transparent &&
              item.material.opacity === 1 &&
              item.material.polygonOffset,
          ),
      );
      if (!isPixel) {
        for (const [y, z, finish] of [
          [0.3, -8.3, 'door'],
          [1, -8, 'accent'],
          [5, -8.3, 'window'],
          [5.76, -8.3, 'trim'],
        ]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(0, y, z), new THREE.Vector3(-1, 0, 0)),
            overlapping = ray
              .intersectObjects(details, true)
              .filter((hit) => Math.abs(hit.distance - 21) < 1e-5),
            front = overlapping.sort(
              (a, b) =>
                a.object.material.polygonOffsetFactor - b.object.material.polygonOffsetFactor,
            )[0];
          assert(
            front?.object.name === 'courtyard-house-' + finish,
            'unambiguous plinth/door/panel/pane/frame offset layer',
          );
        }
        check(
          `${entry.id}/${quality}/${appearance}: closed entrance and window layers ordered`,
          true,
        );
      }
      let vertices = 0;
      for (const item of details) {
        const p = item.geometry.attributes.position,
          n = item.geometry.attributes.normal,
          uv = item.geometry.attributes.uv;
        vertices += p.count;
        for (let i = 0; i < p.count; i++) {
          const point = new THREE.Vector3().fromBufferAttribute(p, i),
            box = course.obstacles
              .filter((o) => /^house-(east|west)$/.test(o.id))
              .find((o) =>
                ['x', 'y', 'z'].every(
                  (axis) =>
                    point[axis] >= o.min[axis] / 1000 - 1e-5 &&
                    point[axis] <= o.max[axis] / 1000 + 1e-5,
                ),
              );
          assert(box, 'every vertex inside one existing house envelope');
          const face = Math.abs(n.getX(i)) > 0.5 ? 'x' : 'z';
          assert(
            Math.abs(point[face] - box.min[face] / 1000) < 1e-5 ||
              Math.abs(point[face] - box.max[face] / 1000) < 1e-5,
            'every vertex coplanar with an existing vertical wall',
          );
          const expectedNormal = Math.abs(point[face] - box.max[face] / 1000) < 1e-5 ? 1 : -1;
          assert(
            Math.abs((face === 'x' ? n.getX(i) : n.getZ(i)) - expectedNormal) < 1e-5,
            'outward-facing winding',
          );
          assert(
            Math.abs(uv.getX(i) - (face === 'x' ? point.z : point.x) / 3) < 1e-5 &&
              Math.abs(uv.getY(i) - point.y / 3) < 1e-5,
            'world-space role texture UV',
          );
        }
      }
      check(
        `${entry.id}/${quality}/${appearance}: bounded coplanar artwork`,
        vertices === (isPixel ? 0 : 3984),
      );
      // Coplanar artwork must neither shorten a line to the wall nor let a ray
      // pass through its closed windows/doors. Inspect the actual box plus paint.
      const solids = new THREE.Group();
      for (const o of course.obstacles.filter((o) => /^house-(east|west)$/.test(o.id))) {
        const shape = new THREE.BoxGeometry(
            ...['x', 'y', 'z'].map((axis) => (o.max[axis] - o.min[axis]) / 1000),
          ),
          value = new THREE.Mesh(shape, new THREE.MeshBasicMaterial());
        value.position.set(...['x', 'y', 'z'].map((axis) => (o.max[axis] + o.min[axis]) / 2000));
        solids.add(value);
      }
      solids.updateMatrixWorld(true);
      for (const [x, z, direction] of [
        [-21, -8, -1],
        [21, -5, 1],
      ])
        for (const y of [0.3, 1.5, 3.2, 5, 6.9]) {
          const ray = new THREE.Raycaster(
              new THREE.Vector3(0, y, z),
              new THREE.Vector3(direction, 0, 0),
            ),
            base = ray.intersectObject(solids, true)[0],
            paint = ray.intersectObjects(details, true)[0];
          assert(base && Math.abs(base.distance - Math.abs(x)) < 1e-5);
          if (paint) assert(Math.abs(base.distance - paint.distance) < 1e-5);
        }
      solids.traverse((item) => {
        item.geometry?.dispose();
        item.material?.dispose();
      });
      const beforeResources = resourceCounts(a, before),
        afterResources = resourceCounts(b, after);
      const resources = dispose(b, after);
      dispose(a, before);
      check(
        `${entry.id}/${quality}/${appearance}: unchanged wall ray distances and exactly-once disposal`,
        true,
      );
      scenes.push({
        course: entry.id,
        quality,
        appearance,
        detailBatches: details.length,
        detailVertices: vertices,
        resources,
        beforeResources,
        afterResources,
      });
    }
const canonical = structuredClone(courtyards[0].course);
for (const mutation of [
  (c) => {
    c.environment = 'warehouse';
  },
  (c) => {
    c.obstacles = c.obstacles.map((o) => ({ ...o, id: 'custom-' + o.id }));
  },
  (c) => {
    c.obstacles = c.obstacles.map((o) => ({ ...o, type: 'box' }));
  },
  (c) => {
    c.obstacles = c.obstacles.map((o) => ({ ...o, max: { ...o.max, x: o.max.x + 1 } }));
  },
]) {
  const changed = structuredClone(canonical);
  mutation(changed);
  check(
    'unsupported environment/IDs/types/dimensions do not acquire facade artwork',
    after.buildCourtyardFacadeGeometry(changed).length === 0,
  );
}
for (const entry of courtyards) {
  const geometry = after.buildCourtyardFacadeGeometry(entry.course);
  check(entry.id + ' has only the six canonical facade batches', geometry.length === 6);
  geometry.forEach((row) => row.geometry.dispose());
}
for (const entry of [
  ...new Map(
    catalogue
      .filter((entry) => entry.course.environment !== 'courtyard')
      .map((entry) => [entry.course.environment, entry]),
  ).values(),
]) {
  const a = build(before, entry.course, 'balanced', 'authored'),
    b = build(after, entry.course, 'balanced', 'authored');
  check(
    entry.course.environment + ' untouched scene/material regression',
    snapshot(a) === snapshot(b),
  );
  dispose(a, before);
  dispose(b, after);
}
await initWorldRuntime();
for (const row of WORLD_DEMONSTRATIONS) {
  const entry = courtyards.find((entry) => entry.id === row.proof.course);
  if (!entry) continue;
  const result = await replayWorldFlight(entry.course, row.proof, { yieldControl: async () => {} });
  check(
    row.proof.course + '/' + row.proof.mode + ' exact World replay',
    result.state.status === 'complete' &&
      worldStateIdentity(result.state) === row.proof.finalStateIdentity,
  );
  recordings.push({
    course: entry.id,
    mode: row.proof.mode,
    ticks: result.state.ticks,
    identity: worldStateIdentity(result.state),
  });
}
for (const proof of FLIGHT_DEMONSTRATIONS) {
  const entry = courtyards.find((entry) => entry.id === proof.course);
  if (!entry) continue;
  const result = replayFlight(entry.course, proof);
  check(
    proof.course + '/' + proof.mode + ' exact legacy replay',
    result.state.status === 'complete',
  );
  recordings.push({ course: entry.id, mode: proof.mode, ticks: result.state.ticks, legacy: true });
}
check(
  'all installed Courtyard recordings replay',
  recordings.length ===
    WORLD_DEMONSTRATIONS.filter((row) => courtyards.some((e) => e.id === row.proof.course)).length +
      FLIGHT_DEMONSTRATIONS.filter((row) => courtyards.some((e) => e.id === row.course)).length,
);
const receipt = {
  format: 'FPVCourtyardFacadeCPU.v1',
  createdAt: new Date().toISOString(),
  baseline,
  candidate: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  visualSha256: hash(await readFile(new URL(visualPath, root))),
  qualifierSha256: hash(await readFile(new URL(import.meta.url))),
  immutable,
  checks,
  scenes,
  recordings,
  limitation:
    'CPU functional evidence only; no WebGL, image acceptance or hardware-performance claim.',
};
if (args.length)
  await writeFile(new URL(args[1], root), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    passed: checks.length,
    sceneCases: scenes.length,
    recordings: recordings.length,
    visualSha256: receipt.visualSha256,
  }),
);
