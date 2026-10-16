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
import { WORLD_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../optional-practice/civilian-fpv/demonstrations.mjs';
import { replayFlight } from '../optional-practice/civilian-fpv/model.mjs';
import {
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';

const baseline = 'a1cb86c85cd52db7256ad2ed16c30c8f40f90c32',
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
for (const name of [
  'world-catalogue.mjs',
  'catalogue.mjs',
  'snake-hunt-catalogue.mjs',
  'expressive-hunt-courses.mjs',
  'world-model.mjs',
  'model.mjs',
  'world-collision.mjs',
  'world-themes.mjs',
  'world-assets.mjs',
  'renderer.mjs',
  'world-demonstrations.mjs',
  'demonstrations.mjs',
  'world-progress.mjs',
]) {
  const path = 'optional-practice/civilian-fpv/' + name,
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
  hangars = catalogue.filter((entry) => entry.course.environment === 'gym');
check(
  '12 Hangar courses across three arena sizes',
  hangars.length === 12 &&
    new Set(hangars.map((entry) => JSON.stringify(entry.course.bounds))).size === 3,
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
const landmark = (item) => item.userData.role === 'hangar-bay-landmark';
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
  ...new Map(hangars.map((entry) => [JSON.stringify(entry.course.bounds), entry])).values(),
];
for (const entry of representative)
  for (const quality of ['low', 'balanced', 'high'])
    for (const appearance of ['authored', 'pixel', 'industrial-workshop']) {
      const course = structuredClone(entry.course);
      if (appearance === 'pixel') course.world = { ...course.world, theme: 'pixel' };
      const presentation = appearance === 'pixel' ? 'authored' : appearance,
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
        `${entry.id}/${quality}/${appearance}: four opaque unshadowed wall paint batches`,
        details.length === 4 &&
          details.every(
            (item) =>
              !item.castShadow &&
              item.receiveShadow &&
              !item.material.transparent &&
              item.material.opacity === 1 &&
              item.material.polygonOffset &&
              ['rubber', 'enamel'].includes(item.userData.materialRole),
          ),
      );
      let vertices = 0;
      for (const item of details) {
        const position = item.geometry.attributes.position,
          uv = item.geometry.attributes.uv,
          size = new THREE.Box3().setFromBufferAttribute(item.parent.geometry.attributes.position);
        vertices += position.count;
        for (let i = 0; i < position.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(position, i);
          assert(size.clone().expandByScalar(1e-5).containsPoint(p));
          assert(Math.abs(Math.abs(p.z) - 0.175) < 1e-5);
          assert(Number.isFinite(uv.getX(i) + uv.getY(i)));
        }
        if (appearance === 'pixel')
          for (const value of Object.values(item.material))
            if (value?.isTexture) assert.equal(value.magFilter, THREE.NearestFilter);
      }
      const min = course.bounds.min,
        max = course.bounds.max;
      for (const side of ['north', 'south'])
        for (let bay = 0; bay < 4; bay++) {
          const sign = side === 'north' ? 1 : -1,
            x =
              (min.x + max.x) / 2000 + ((sign * (max.x - min.x)) / 1000) * ((bay + 0.5) / 4 - 0.5),
            ray = new THREE.Raycaster(
              new THREE.Vector3(x, 3, (min.z + max.z) / 2000),
              new THREE.Vector3(0, 0, -sign),
            ),
            left = ray.intersectObject(a, true)[0],
            right = ray.intersectObject(b, true)[0];
          assert(
            left && right && Math.abs(left.distance - right.distance) < 1e-4,
            'unchanged wall sightline distance',
          );
        }
      const resources = dispose(b, after);
      dispose(a, before);
      check(
        `${entry.id}/${quality}/${appearance}: coplanarity, ray distance, filtering and disposal`,
        vertices < 2000,
      );
      scenes.push({
        course: entry.id,
        quality,
        appearance,
        detailBatches: details.length,
        detailVertices: vertices,
        resources,
      });
    }
for (const entry of [
  ...new Map(
    catalogue
      .filter((entry) => entry.course.environment !== 'gym')
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
  const entry = hangars.find((entry) => entry.id === row.proof.course);
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
  const entry = hangars.find((entry) => entry.id === proof.course);
  if (!entry) continue;
  const result = replayFlight(entry.course, proof);
  check(
    proof.course + '/' + proof.mode + ' exact legacy replay',
    result.state.status === 'complete',
  );
  recordings.push({ course: entry.id, mode: proof.mode, ticks: result.state.ticks, legacy: true });
}
check('all 16 installed Hangar recordings replay', recordings.length === 16);
const receipt = {
  format: 'FPVHangarBayLandmarksCPU.v1',
  createdAt: new Date().toISOString(),
  baseline,
  candidate: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
  visualSha256: hash(await readFile(new URL(visualPath, root))),
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
