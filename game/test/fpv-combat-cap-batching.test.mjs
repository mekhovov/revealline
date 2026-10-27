import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createCombatPresentation } from '../../optional-practice/civilian-fpv/combat-presentation.mjs';
import { ACTOR_FAMILIES, ACTOR_CASTS } from '../hunt/actor-catalog.mjs';

const names = [
  'head',
  'pelvis',
  'abdomen',
  'chest',
  'leftForearm',
  'leftUpperArm',
  'rightForearm',
  'rightUpperArm',
  'leftShin',
  'leftThigh',
  'rightShin',
  'rightThigh',
];
function fixture() {
  const scene = new THREE.Group(),
    map = new THREE.Texture(),
    normalMap = new THREE.Texture(),
    capMap = new THREE.Texture(),
    outer = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      roughnessMap: map,
      metalnessMap: map,
      vertexColors: true,
    }),
    capPaint = new THREE.MeshStandardMaterial({
      map: capMap,
      color: '#a12222',
      roughness: 0.48,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    hairPaint = new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide }),
    regions = {},
    sources = [];
  const bodyGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2),
    capGeometry = new THREE.PlaneGeometry(0.18, 0.18);
  bodyGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      new Float32Array(bodyGeometry.attributes.position.count * 3).fill(0.8),
      3,
    ),
  );
  for (const [i, name] of names.entries()) {
    const branch = new THREE.Group(),
      body = new THREE.Mesh(bodyGeometry, outer),
      cap = new THREE.Mesh(capGeometry, capPaint);
    branch.position.y = 0.2 + i * 0.1;
    cap.position.y = branch.position.y - 0.1;
    cap.rotation.x = Math.PI / 2;
    branch.add(body);
    if (name === 'head') {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.03, 0.21), hairPaint);
      hair.position.y = 0.11;
      branch.add(hair);
      sources.push(hair.geometry);
    }
    scene.add(branch, cap);
    regions[name] = {
      mesh: branch,
      cap,
      parent: name === 'chest' ? null : 'chest',
      aggregate: name,
    };
  }
  const sourceSnapshot = Array.from(bodyGeometry.attributes.position.array);
  let releases = 0;
  const input = {
    ready: true,
    sha256: 'a'.repeat(64),
    family: 'courier',
    cast: 'tactical',
    scene,
    height: 1.8,
    radius: 0.35,
    regions,
    release: () => releases++,
  };
  return {
    input,
    outer,
    capPaint,
    map,
    normalMap,
    capMap,
    bodyGeometry,
    capGeometry,
    sourceSnapshot,
    releases: () => releases,
    dispose() {
      for (const geometry of [bodyGeometry, capGeometry, ...sources]) geometry.dispose();
      for (const material of [outer, capPaint, hairPaint]) material.dispose();
      for (const texture of [map, normalMap, capMap]) texture.dispose();
    },
  };
}
const floor = (point, normal, sweep) => {
  if (sweep?.fromMm && sweep.toMm.y > (sweep.radiusMm ?? 0)) return { clear: true };
  const at = sweep?.attachment?.position ?? sweep?.toMm ?? point;
  return {
    position: { x: at.x, y: 0, z: at.z },
    normal: { x: 0, y: 1, z: 0 },
    surfaceId: 'floor',
    localPosition: { x: at.x, y: 0, z: at.z },
    attached: Boolean(sweep?.attachment),
  };
};
const defeat = {
  type: 'defeat',
  eventId: 'test:1',
  sourceId: 'target',
  spawnId: 'target:1',
  tick: 1,
  position: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 1, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  material: 'organic',
  outcome: 'explosive',
  appearance: { family: 'courier', cast: 'tactical', type: 'patrol' },
  surface: floor({ x: 0, y: 0, z: 0 }),
};

test('twelve authored regions merge caps, preserve geometry and leave masked hair separate', () => {
  const source = fixture(),
    scene = new THREE.Scene(),
    prefs = { brutal: true, blood: true, showRemains: true },
    effects = createCombatPresentation({
      THREE,
      scene,
      preferences: () => prefs,
      groundQuery: floor,
    });
  try {
    assert.equal(effects.setAppearancePartsTemplates([source.input]), true);
    const merged = scene.children[0].children.filter((mesh) => mesh.name.endsWith(':body-cap'));
    assert.equal(merged.length, 12);
    assert.equal(effects.resources().appearanceDrawCalls, 13);
    assert.equal(new Set(merged.map((mesh) => mesh.material)).size, 1);
    assert.equal(effects.resources().appearanceDerivedMaterials, 1);
    assert.equal(effects.resources().appearanceDerivedTextures, 0);
    assert.equal(
      effects.resources().appearanceDerivedDecodedBytes,
      effects.resources().appearanceDerivedGpuBytes,
    );
    assert.ok(effects.resources().appearanceDerivedDecodedBytes > 0);
    const geometry = merged[0].geometry,
      bodyCount = source.bodyGeometry.attributes.position.count,
      capCount = source.capGeometry.attributes.position.count;
    assert.equal(geometry.attributes.position.count, bodyCount + capCount);
    assert.equal(
      geometry.index.count,
      source.bodyGeometry.index.count + source.capGeometry.index.count,
    );
    assert.deepEqual(Array.from(geometry.index.array), [
      ...source.bodyGeometry.index.array,
      ...Array.from(source.capGeometry.index.array, (index) => index + bodyCount),
    ]);
    assert.deepEqual(Array.from(geometry.attributes.combatCapRole.array), [
      ...Array(bodyCount).fill(0),
      ...Array(capCount).fill(1),
    ]);
    assert.deepEqual(Array.from(geometry.attributes.uv.array), [
      ...source.bodyGeometry.attributes.uv.array,
      ...source.capGeometry.attributes.uv.array,
    ]);
    assert.deepEqual(
      Array.from(geometry.attributes.color.array.slice(bodyCount * 3)),
      Array(capCount * 3).fill(1),
    );
    assert.deepEqual(
      Array.from(source.bodyGeometry.attributes.position.array),
      source.sourceSnapshot,
    );
    assert.equal(source.capGeometry.hasAttribute('color'), false);
    effects.observe([defeat], { runId: 'test', tick: 1 });
    effects.update({ tick: 1, presentationClock: 5, graphicsQuality: 'high' });
    assert.ok(
      merged.every((mesh) => mesh.count === 1),
      'all authored body regions are admitted at High',
    );
    assert.ok(merged.every((mesh) => mesh.geometry.attributes.combatCapEnabled.getX(0) === 1));
    prefs.brutal = false;
    effects.update({ tick: 1, presentationClock: 5, graphicsQuality: 'high' });
    assert.ok(merged.every((mesh) => mesh.geometry.attributes.combatCapEnabled.getX(0) === 0));
    assert.equal(merged[0].material.userData.combatCapUniforms.combatBlood.value, true);
    prefs.brutal = true;
    prefs.blood = false;
    effects.update({ tick: 1, presentationClock: 5, graphicsQuality: 'high' });
    assert.equal(merged[0].material.userData.combatCapUniforms.combatBlood.value, false);
    assert.ok(merged.every((mesh) => mesh.geometry.attributes.combatCapEnabled.getX(0) === 1));
    assert.equal(merged[0].material.transparent, false);
  } finally {
    effects.dispose();
    assert.equal(source.releases(), 1);
    source.dispose();
  }
});

test('36 family/cast leases share merged resources and reduce owned buffers versus separate caps', () => {
  const source = fixture(),
    scene = new THREE.Scene(),
    effects = createCombatPresentation({ THREE, scene });
  try {
    assert.equal(effects.setAppearancePartsTemplates([source.input]), true);
    const merged = effects.resources();
    const entries = ACTOR_CASTS.flatMap((cast) =>
      ACTOR_FAMILIES.map((family) => ({ ...source.input, family: family.id, cast: cast.id })),
    );
    assert.equal(entries.length, 36);
    assert.equal(effects.setAppearancePartsTemplates(entries), true);
    const all = effects.resources();
    assert.equal(all.appearanceCharacters, 36);
    assert.equal(all.appearanceDerivedMaterials, 1);
    assert.equal(all.registeredPools, merged.registeredPools);
    assert.equal(all.appearanceDerivedGpuBytes, merged.appearanceDerivedGpuBytes);
    assert.equal(all.appearanceDerivedDecodedBytes, merged.appearanceDerivedDecodedBytes);
    // A cap-specific normal map uses the legacy two-material path. This gives
    // an equivalent original-buffer baseline without changing authored data.
    source.capPaint.normalMap = source.normalMap;
    assert.equal(effects.setAppearancePartsTemplates([source.input]), true);
    const separate = effects.resources();
    assert.equal(separate.appearanceDrawCalls, 25);
    assert.ok(separate.appearanceDerivedGpuBytes > merged.appearanceDerivedGpuBytes);
    assert.ok(separate.appearanceDerivedDecodedBytes > merged.appearanceDerivedDecodedBytes);
  } finally {
    effects.dispose();
    assert.equal(source.releases(), 38);
    source.dispose();
  }
});

test('merged shader retains exterior shading, uses independent cap UVs and prewarms all textures', () => {
  const source = fixture(),
    scene = new THREE.Scene(),
    effects = createCombatPresentation({ THREE, scene });
  let sourceDisposed = 0,
    derivedDisposed = 0;
  source.outer.addEventListener('dispose', () => sourceDisposed++);
  source.capPaint.addEventListener('dispose', () => sourceDisposed++);
  try {
    assert.equal(effects.setAppearancePartsTemplates([source.input]), true);
    const merged = scene.children[0].children.filter((mesh) => mesh.name.endsWith(':body-cap')),
      material = merged[0].material,
      shader = {
        uniforms: {},
        vertexShader: THREE.ShaderLib.standard.vertexShader,
        fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      };
    material.addEventListener('dispose', () => derivedDisposed++);
    material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.combatCapMap.value, source.capMap);
    assert.match(shader.vertexShader, /combatCapMapTransform \* vec3\(uv, 1\.0\)/);
    assert.match(shader.fragmentShader, /vCombatCapEnabled < 0\.5\) discard/);
    assert.match(shader.fragmentShader, /combatBlood \? combatCapColor : combatCleanCapColor/);
    assert.match(
      shader.fragmentShader,
      /if \(vCombatCapRole < 0\.5\) \{\s*#include <normal_fragment_maps>/,
    );
    assert.match(
      shader.fragmentShader,
      /roughnessFactor = combatBlood \? combatCapRoughness : 0\.96/,
    );
    assert.match(
      shader.fragmentShader,
      /metalnessFactor = combatBlood \? combatCapMetalness : 0\.0/,
    );
    assert.equal(material.map, source.map);
    assert.equal(material.normalMap, source.normalMap);
    const uploaded = new Set();
    effects.prepareTextures((texture) => uploaded.add(texture));
    assert.deepEqual(uploaded, new Set([source.map, source.normalMap, source.capMap]));
    const finish = effects.prepareMaterials();
    assert.ok(merged.every((mesh) => mesh.visible));
    finish();
    assert.ok(merged.every((mesh) => !mesh.visible));
    effects.setAppearancePartsTemplates([]);
    assert.equal(sourceDisposed, 0);
    assert.equal(derivedDisposed, 1);
    assert.equal(effects.resources().appearanceDerivedGpuBytes, 0);
  } finally {
    effects.dispose();
    source.dispose();
  }
});

test('mixed authored palettes defer whole clusters at the global High budget without Current fallback', () => {
  const first = fixture(),
    second = fixture(),
    scene = new THREE.Scene(),
    effects = createCombatPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: true, blood: true, showRemains: true }),
      groundQuery: floor,
    });
  try {
    assert.equal(
      effects.setAppearancePartsTemplates([first.input, { ...second.input, family: 'guard' }]),
      true,
    );
    effects.observe(
      [
        defeat,
        {
          ...defeat,
          eventId: 'test:2',
          sourceId: 'guard',
          spawnId: 'guard:1',
          position: { x: 5000, y: 0, z: 0 },
          surface: floor({ x: 5000, y: 0, z: 0 }),
          appearance: { family: 'guard', cast: 'tactical', type: 'patrol' },
        },
      ],
      { runId: 'test', tick: 1 },
    );
    for (const x of [0, 5]) {
      effects.update({
        tick: 1,
        presentationClock: 5 + x / 10,
        graphicsQuality: 'high',
        cameraPosition: { x, y: 0, z: 0 },
      });
      const resources = effects.resources();
      assert.ok(resources.calls <= 24);
      assert.equal(resources.authoredClusters, 1);
      assert.equal(resources.authoredRegions, 12);
      assert.equal(resources.proceduralClusters, 0);
      assert.equal(resources.deferredAuthoredClusters, 1);
      const visibleRegions = scene.children[0].children.filter(
        (mesh) => mesh.name.endsWith(':body-cap') && mesh.count > 0,
      );
      assert.equal(visibleRegions.length, 12, 'the complete nearest body retains every region');
      assert.ok(visibleRegions.every((mesh) => mesh.material === visibleRegions[0].material));
      assert.equal(
        effects.export().records.length,
        2,
        'the deferred body remains a recoverable fact',
      );
    }
  } finally {
    effects.dispose();
    first.dispose();
    second.dispose();
  }
});
