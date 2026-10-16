/** Real-source comparison depth/contour coverage; no GPU/native claim. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createVerifiedMixedWindow } from '../../../../optional-practice/civilian-fpv/regional/verified-mixed-window.mjs';
import { configureSceneryPreviewDepth } from '../preview-depth.mjs';
const views = [
  {
    id: 'snow',
    point: [3400, 575, 3100],
    camera: [3900, 1260, 3650],
    target: [3456, 470, 3200],
    height: 480,
  },
  {
    id: 'scree',
    point: [1800, 350, 1100],
    camera: [1350, 900, 650],
    target: [1740, 330, 1100],
    height: 330,
  },
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const records = [];
let inspectedVertices = 0;
for (const [label, root] of [
  ['legacy', process.argv[2]],
  ['contours', process.argv[3]],
]) {
  assert(root, 'Supply both preserved paired source directories');
  const terrainBytes = await readFile(resolve(root, 'terrain/region.json')),
    sceneryBytes = await readFile(resolve(root, 'scenery/region.json'));
  const manifest = JSON.parse(terrainBytes),
    scenery = JSON.parse(sceneryBytes);
  const expected =
    label === 'legacy'
      ? [
          'ce45cfcfc2f5ae829c863a926e8b7aa8133bedb404ceff3df4e4ed9a5dfd93a3',
          '692d5727473f4c99ec43e66fda667fe24112d174d89080409858a53d9a031fb7',
        ]
      : [
          'c1218b914e01346414dd160e2535fdd115a057a18b511a29577526675b6a90b0',
          '73d63d56158b300b006bcd3e1750477ba23304af51665cda7080aec891ed5a61',
        ];
  assert.deepEqual([sha(terrainBytes), sha(sceneryBytes)], expected);
  const fetchImpl = async (url, { signal } = {}) => {
    signal?.throwIfAborted();
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://preview-depth.invalid');
    return new Response(await readFile(resolve(root, '.' + parsed.pathname)));
  };
  const owner = createVerifiedMixedWindow(manifest, {
    source: { baseURL: 'https://preview-depth.invalid/terrain/', fetchImpl },
    scenery: {
      manifest: scenery,
      source: { baseURL: 'https://preview-depth.invalid/scenery/', fetchImpl },
    },
  });
  try {
    for (const view of views) {
      await owner.transition(
        Object.fromEntries(['x', 'y', 'z'].map((axis, i) => [axis, view.point[i] * 1000])),
      );
      const origin = owner.snapshot().provenance.originMm;
      const local = (p) => p.map((v, i) => v - origin[['x', 'y', 'z'][i]] / 1000);
      for (const aspect of [390 / 844, 844 / 390, 1280 / 800, 16 / 9]) {
        const camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 2000);
        camera.position.fromArray(local(view.camera));
        camera.lookAt(...local(view.target));
        const depth = configureSceneryPreviewDepth(camera, owner.group, {
          overview: true,
          far: 2000,
        });
        assert.equal(depth.near, 10, 'Far comparison views retain conservative 10m near plane');
        camera.updateMatrixWorld(true);
        let vertices = 0,
          visibleBoundaryVertices = 0,
          visibleBelow = 0,
          visibleAbove = 0,
          minimumDepth = Infinity;
        owner.group.traverse((object) => {
          if (!object.isMesh) return;
          const attribute = object.geometry.attributes.position;
          for (let i = 0; i < attribute.count; i++) {
            const point = new THREE.Vector3()
              .fromBufferAttribute(attribute, i)
              .applyMatrix4(object.matrixWorld);
            const distance = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
            minimumDepth = Math.min(minimumDepth, distance);
            assert(
              distance > camera.near && distance < camera.far,
              'Actual source vertices remain inside depth range',
            );
            const projected = point.clone().project(camera),
              height = point.y + origin.y / 1000;
            if (Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1) {
              if (Math.abs(height - view.height) < 0.025) visibleBoundaryVertices++;
              if (height > view.height - 40 && height < view.height - 1) visibleBelow++;
              if (height < view.height + 40 && height > view.height + 1) visibleAbove++;
            }
            vertices++;
          }
        });
        assert(
          visibleBelow > 20 && visibleAbove > 20,
          'Comparison frames both sides of the actual height boundary',
        );
        if (label === 'contours')
          assert(
            visibleBoundaryVertices > 20,
            'Clipped contour itself visible, not just unrelated district scenery',
          );
        const precisionGain = (2000 - 0.1) / 0.1 / ((camera.far - camera.near) / camera.near);
        assert(precisionGain > 90);
        records.push({
          label,
          view: view.id,
          aspect,
          ...depth,
          minimumActualDepth: minimumDepth,
          vertices,
          visibleBoundaryVertices,
          visibleBelow,
          visibleAbove,
          estimatedDepthPrecisionGain: precisionGain,
        });
        inspectedVertices += vertices;
        configureSceneryPreviewDepth(camera, owner.group);
        assert.equal(camera.near, 0.1);
        assert.equal(camera.far, 1400);
      }
    }
  } finally {
    owner.dispose();
  }
  assert.equal(owner.snapshot().geometryBytes, 0);
  assert.equal(owner.snapshot().textureBytes, 0);
}
console.log(
  JSON.stringify(
    {
      format: 'FPVAlpinePreviewDepthVerification.v1',
      inspectedVertices,
      records,
      nativeVisualReview: false,
    },
    null,
    2,
  ),
);
