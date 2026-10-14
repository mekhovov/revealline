import assert from 'node:assert/strict';
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createSceneryLighting } from './scenery-lighting.mjs';

for (const style of ['plain', 'urban']) {
  const scene = new THREE.Scene(),
    renderer = { shadowMap: { enabled: false } };
  const owner = createSceneryLighting(scene, renderer, style);
  const group = new THREE.Group(),
    geometry = new THREE.BoxGeometry(2, 2, 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  group.add(mesh);
  const positions = [...geometry.attributes.position.array];
  owner.focus(group, [64, 4, 64]);
  assert.deepEqual([...geometry.attributes.position.array], positions);
  assert.equal(mesh.castShadow, style === 'urban');
  assert.equal(mesh.receiveShadow, style === 'urban');
  const suns = scene.children.filter((v) => v.isDirectionalLight);
  assert.equal(suns.length, 1);
  if (style === 'urban') {
    assert.deepEqual(suns[0].shadow.mapSize.toArray(), [1024, 1024]);
    assert.equal(suns[0].shadow.camera.right, 110);
    owner.focus(group, [192, 0, 192], true);
    assert.equal(suns[0].shadow.camera.right, 260);
    assert.deepEqual(suns[0].target.position.toArray(), [192, 0, 192]);
    owner.focus(group, [64, 0, 64]);
    assert.deepEqual(suns[0].target.position.toArray(), [64, 0, 64]);
    let disposed = 0;
    suns[0].shadow.map = { dispose: () => disposed++ };
    owner.release();
    assert.equal(disposed, 1);
    assert.equal(suns[0].shadow.map, null);
    assert.equal(suns[0].castShadow, false, 'Empty-view draw must not allocate a replacement map');
    owner.focus(group, [64, 0, 64]);
    assert.equal(suns[0].shadow.needsUpdate, true);
    assert.equal(suns[0].castShadow, true);
  } else assert.equal(renderer.shadowMap.enabled, false);
  owner.dispose();
  owner.dispose();
  assert.equal(scene.children.length, 0);
  assert.throws(() => owner.focus(group, [0, 0, 0]), /disposed/);
  geometry.dispose();
  mesh.material.dispose();
}
assert.throws(
  () => createSceneryLighting(new THREE.Scene(), { shadowMap: {} }, 'unknown'),
  /profile/,
);
console.log(
  JSON.stringify({
    passed: true,
    profiles: 2,
    maximumShadowMap: '1024x1024',
    geometryUnchanged: true,
    releaseAndReload: true,
    gpuAcceptance: 'requires native browser review',
  }),
);
