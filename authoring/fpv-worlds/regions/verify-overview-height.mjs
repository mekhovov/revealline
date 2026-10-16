/** Exact authored geometry camera coverage; no native/GPU timing assertion. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createVerifiedMixedWindow } from '../../../optional-practice/civilian-fpv/regional/verified-mixed-window.mjs';
const path = 'optional-practice/civilian-fpv/renderer.mjs';
const source = await readFile(new URL('../../../' + path, import.meta.url), 'utf8');
const baseline = process.argv[4]
  ? await readFile(process.argv[4], 'utf8')
  : execFileSync('git', ['show', 'ffe4fe89c7aaef1711194c78d7acda9323f45a36:' + path]).toString();
const factory = (text) =>
  runInNewContext(
    text
      .slice(
        text.indexOf('export function createFlightViewFrame'),
        text.indexOf('/** Presentation only. All world/actor'),
      )
      .replace('export function', 'function') + '\ncreateFlightViewFrame',
    { THREE },
  );
const current = factory(source),
  old = factory(baseline);
const make = (create, aspect, far) => {
  const camera = new THREE.PerspectiveCamera(82, aspect, 0.035, far),
    aircraft = new THREE.Group();
  return { camera, aircraft, frame: create({ camera, aircraft }) };
};
const stamp = ({ camera, aircraft }) => ({
  position: camera.position.toArray(),
  rotation: camera.quaternion.toArray(),
  projection: camera.projectionMatrix.toArray(),
  near: camera.near,
  far: camera.far,
  aircraft: aircraft.position.toArray(),
  visible: aircraft.visible,
});
const sha = (b) => createHash('sha256').update(b).digest('hex');
let exactFlightComparisons = 0,
  inspectedVertices = 0,
  fittedViews = 0;
const cases = [];
const aspects = [390 / 844, 844 / 390, 1280 / 800, 16 / 9];
for (const [label, root] of [
  ['Alpine', process.argv[2]],
  ['Coaster', process.argv[3]],
]) {
  assert(root, 'Supply preserved Alpine and Coaster paired sources');
  const read = async (p) => await readFile(resolve(root, p));
  const terrainBytes = await read('terrain/region.json'),
    sceneryBytes = await read('scenery/region.json');
  const terrain = JSON.parse(terrainBytes),
    scenery = JSON.parse(sceneryBytes);
  const expected =
    label === 'Alpine'
      ? [
          'ce45cfcfc2f5ae829c863a926e8b7aa8133bedb404ceff3df4e4ed9a5dfd93a3',
          '692d5727473f4c99ec43e66fda667fe24112d174d89080409858a53d9a031fb7',
        ]
      : [null, '6267731197ea142b0cf4a99380953108aca11ae01db69aabda866388029b037d'];
  if (expected[0]) assert.equal(sha(terrainBytes), expected[0]);
  assert.equal(sha(sceneryBytes), expected[1]);
  const fetchImpl = async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const u = new URL(url);
    assert.equal(u.origin, 'https://height-review.invalid');
    return new Response(await read(u.pathname.slice(1)));
  };
  const owner = createVerifiedMixedWindow(terrain, {
    source: { baseURL: 'https://height-review.invalid/terrain/', fetchImpl },
    scenery: {
      manifest: scenery,
      source: { baseURL: 'https://height-review.invalid/scenery/', fetchImpl },
    },
    maxGeometryBytes: 8 * 1024 * 1024,
  });
  try {
    for (const spawn of terrain.spawns) {
      await owner.transition(spawn.position);
      const snapshot = owner.snapshot();
      assert.equal(snapshot.state, 'ready');
      const origin = snapshot.provenance.originMm;
      const box = new THREE.Box3().setFromObject(owner.group);
      const bounds = { min: {}, max: {} };
      for (const axis of ['x', 'y', 'z']) {
        bounds.min[axis] = box.min[axis] * 1000 + origin[axis];
        bounds.max[axis] = box.max[axis] * 1000 + origin[axis];
      }
      const far = (1000 * terrain.grid.cellSizeMm) / 128000,
        pose = { position: spawn.position, orientation: [0, 0, 0, 1000000], ticks: 0 };
      for (const aspect of aspects) {
        const a = make(old, aspect, far),
          b = make(current, aspect, far);
        for (const row of [a, b]) {
          row.frame.bounds = bounds;
          row.frame.originMm = origin;
        }
        for (const view of ['fpv', 'chase', 'overview', 'editor']) {
          a.frame.view = b.frame.view = view;
          a.frame.draw(pose);
          b.frame.draw(pose);
          assert.deepEqual(stamp(b), stamp(a));
          exactFlightComparisons++;
        }
        b.frame.regionalOverview = true;
        b.frame.view = 'overview';
        b.frame.draw(pose);
        b.camera.updateMatrixWorld();
        assert(b.camera.near > 0.035 && b.camera.near <= 10);
        let vertices = 0;
        owner.group.traverse((object) => {
          if (!object.isMesh) return;
          const attr = object.geometry.attributes.position;
          for (let i = 0; i < attr.count; i++) {
            const point = new THREE.Vector3()
              .fromBufferAttribute(attr, i)
              .applyMatrix4(object.matrixWorld);
            const projected = point.clone().project(b.camera);
            assert(
              Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1,
              'Actual resident vertex fully framed',
            );
            assert(
              projected.z > -1 && projected.z < 1,
              'Actual resident vertex inside depth range',
            );
            vertices++;
          }
        });
        inspectedVertices += vertices;
        fittedViews++;
        cases.push({
          world: label,
          start: spawn.id,
          aspect,
          minimumY: bounds.min.y / 1000,
          maximumY: bounds.max.y / 1000,
          camera: b.camera.position.toArray(),
          near: b.camera.near,
          far: b.camera.far,
          vertices,
        });
        for (const next of aspects) {
          a.camera.aspect = b.camera.aspect = next;
          a.camera.updateProjectionMatrix();
          b.camera.updateProjectionMatrix();
          for (const view of ['fpv', 'chase', 'editor']) {
            a.frame.view = b.frame.view = view;
            a.frame.draw(pose);
            b.frame.draw(pose);
            assert.deepEqual(stamp(b), stamp(a));
            exactFlightComparisons++;
          }
          b.frame.view = 'overview';
          b.frame.draw(pose);
        }
      }
    }
  } finally {
    owner.dispose();
  }
  assert.equal(owner.snapshot().geometryBytes, 0);
  assert.equal(owner.snapshot().textureBytes, 0);
}
// Flat and elevated copies of the same local arena: framing translates vertically,
// without changing scale or view direction. Every corner remains visible on short screens.
for (const y of [0, 424000, 1000000])
  for (const aspect of aspects) {
    const a = make(current, aspect, 2000),
      b = make(current, aspect, 2000);
    for (const [row, offset] of [
      [a, 0],
      [b, y],
    ]) {
      row.frame.regionalOverview = true;
      row.frame.bounds = {
        min: { x: 0, y: offset, z: 0 },
        max: { x: 768000, y: offset, z: 768000 },
      };
      row.frame.originMm = { x: 0, y: 0, z: 0 };
      row.frame.view = 'overview';
      row.frame.draw({
        position: { x: 0, y: offset, z: 0 },
        orientation: [0, 0, 0, 1000000],
        ticks: 0,
      });
    }
    assert(Math.abs(b.camera.position.y - a.camera.position.y - y / 1000) < 1e-9);
    assert.deepEqual(b.camera.quaternion.toArray(), a.camera.quaternion.toArray());
  }
console.log(
  JSON.stringify(
    {
      format: 'FPVRegionalOverviewHeightVerification.v1',
      runtimeSHA256: sha(source),
      exactFlightComparisons,
      inspectedVertices,
      fittedViews,
      cases,
      nativeVisualReview: false,
    },
    null,
    2,
  ),
);
