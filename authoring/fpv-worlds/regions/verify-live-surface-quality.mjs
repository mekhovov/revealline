import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createTerrainSurface } from '../../../optional-practice/civilian-fpv/regional/terrain-surface.mjs';

// Raw shared renderer imports use the real classic-script translation bootstrap.
vm.runInNewContext(
  await readFile(new URL('../../../game/vendor/i18next-26.4.2.min.js', import.meta.url), 'utf8'),
  { globalThis },
);
const { setRegionalSurfaceQuality } = await import(
  '../../../optional-practice/civilian-fpv/renderer.mjs'
);

function shaderOf(material) {
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <begin_vertex>',
    fragmentShader:
      '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>',
  };
  material.onBeforeCompile(shader);
  return shader;
}
let transitions = 0;
let profiles = 0;
for (const style of [
  'canyon',
  'urban',
  'railway',
  'railway-expanse',
  'tropical',
  'tropical-settlement',
  'desert',
  'hillside-town',
]) {
  profiles++;
  const originMm = { x: 128000, y: 0, z: 256000 };
  const material = createTerrainSurface({ style, quality: 'balanced', originMm });
  const geometry = new THREE.BoxGeometry();
  const group = new THREE.Group();
  // Shared material references must update only once, including array materials.
  group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, material]));
  const uniformObjects = shaderOf(material).uniforms;
  const positions = geometry.attributes.position.array.slice();
  let disposals = 0;
  material.addEventListener('dispose', () => disposals++);
  for (const [quality, tier] of [
    ['low', 'performance'],
    ['high', 'quality'],
    ['balanced', 'balanced'],
    ['high', 'quality'],
    ['low', 'performance'],
  ]) {
    const previousVersion = material.version;
    assert.equal(setRegionalSurfaceQuality(group, quality), 1);
    assert.equal(material.version, previousVersion + 1);
    const reference = createTerrainSurface({ style, quality: tier, originMm });
    const actualShader = shaderOf(material),
      referenceShader = shaderOf(reference);
    assert.equal(actualShader.vertexShader, referenceShader.vertexShader);
    assert.equal(actualShader.fragmentShader, referenceShader.fragmentShader);
    assert.equal(material.customProgramCacheKey(), reference.customProgramCacheKey());
    assert.equal(material.name, reference.name);
    for (const [key, uniform] of Object.entries(uniformObjects))
      assert.equal(actualShader.uniforms[key], uniform, 'Keep exact origin and uniform owners');
    assert.equal(group.children[0].material, material);
    assert.equal(group.children[0].geometry, geometry);
    assert.deepEqual(geometry.attributes.position.array, positions);
    assert.equal(disposals, 0);
    const currentVersion = material.version;
    setRegionalSurfaceQuality(group, quality);
    assert.equal(material.version, currentVersion, 'Same tier must not invalidate programs');
    reference.dispose();
    transitions++;
  }
  const version = material.version;
  assert.throws(() => setRegionalSurfaceQuality(group, 'unexpected'));
  assert.throws(() => material.userData.setRegionalSurfaceQuality('unexpected'));
  assert.equal(material.version, version);
  material.dispose();
  geometry.dispose();
  assert.equal(disposals, 1);
}
const plain = createTerrainSurface({ originMm: { x: 0, y: 0, z: 0 } });
const plainRoot = new THREE.Group();
plainRoot.add(new THREE.Mesh(undefined, plain));
assert.equal(setRegionalSurfaceQuality(plainRoot, 'high'), 0);
assert.equal(plain.version, 0);
plain.dispose();
plainRoot.children[0].geometry.dispose();
console.log(
  JSON.stringify({
    passed: true,
    transitions,
    profiles,
    geometryChanged: false,
    texturesAdded: 0,
  }),
);
