import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  createCombatActorPresentation,
  COMBAT_ACTOR_LIMIT,
} from '../../optional-practice/civilian-fpv/combat-actors.mjs';
import {
  prepareCombatAppearancePack,
  validateCombatAppearanceManifest,
  COMBAT_DAMAGE_REGIONS,
} from '../../optional-practice/civilian-fpv/combat-appearance.mjs';
const actor = (i, type = 'patrol', archetype = 'military-trooper') => ({
  id: `troop-${i}`,
  sourceId: `troop-${i}`,
  spawnId: `troop-${i}`,
  type,
  material: type === 'patrol' ? 'organic' : 'metal',
  radius: 350,
  height: 1800,
  position: { x: i * 2000, y: 0, z: 0 },
  velocity: { x: 1000, y: 0, z: 0 },
  health: 100,
  status: 'active',
  appearance: { family: 'patroller', cast: 'tactical', archetype },
});
test('all 128 actors retain every primitive when instance pools grow', () => {
  const scene = new THREE.Scene(),
    view = createCombatActorPresentation({ THREE, scene });
  try {
    for (const graphicsQuality of ['low', 'balanced', 'high']) {
      view.setActors([actor(0)]);
      view.update({ graphicsQuality });
      const one = view.resources().instances;
      view.setActors(Array.from({ length: 128 }, (_, i) => actor(i)));
      view.update({ graphicsQuality });
      assert.equal(view.resources().capacity, COMBAT_ACTOR_LIMIT);
      assert.equal(view.resources().actors, 128);
      assert.equal(view.resources().instances, one * 128);
      assert.ok(view.resources().calls <= 4);
      const batches = scene.children[0].children.filter((n) => n.isInstancedMesh && n.count);
      assert.ok(batches.some((n) => n.instanceMatrix.count > 2048));
      for (const batch of batches)
        assert.ok(
          [...batch.instanceMatrix.array.slice(0, batch.count * 16)].every(Number.isFinite),
        );
    }
    assert.throws(() => view.setActors(Array.from({ length: 129 }, (_, i) => actor(i))), /128/);
  } finally {
    view.dispose();
  }
  assert.equal(scene.children.length, 0);
});
test('moving props and aerial hazards retain machine silhouettes even on low detail', () => {
  const scene = new THREE.Scene(),
    view = createCombatActorPresentation({ THREE, scene });
  try {
    const get = (type, archetype) => {
      view.setActors([actor(0, type, archetype)]);
      view.update({ graphicsQuality: 'low' });
      return {
        count: view.resources().instances,
        matrices: scene.children[0].children
          .filter((n) => n.isInstancedMesh)
          .flatMap((n) => [...n.instanceMatrix.array.slice(0, n.count * 16)]),
      };
    };
    const supply = get('prop', 'supply-container');
    const tracked = get('prop', 'tracked-robot');
    const explosive = get('prop', 'explosive-rover');
    const airborne = get('hazard', 'interceptor-uav');
    assert.ok(
      tracked.count >= 19 && tracked.count > supply.count * 3,
      'tracked robot has body, turret, tracks and six wheels',
    );
    assert.ok(
      explosive.count >= 19 &&
        JSON.stringify(explosive.matrices) !== JSON.stringify(tracked.matrices),
      'wheeled explosive payload silhouette differs',
    );
    assert.ok(
      airborne.count > 12 && airborne.count > supply.count * 3,
      'interceptor has arms, motors, rotors, sensor and payload',
    );
  } finally {
    view.dispose();
  }
});
test('immutable r2 supplies twelve connected regions for every military wardrobe within budget', async () => {
  const base = new URL('../../authoring/library/fpv-character-art/r2/', import.meta.url);
  const manifestBytes = await fs.readFile(new URL('manifest.json', base));
  const sha256 = createHash('sha256').update(manifestBytes).digest('hex');
  const pack = await prepareCombatAppearancePack({
    manifestBytes,
    sha256,
    assets: new Map([['characters.glb', await fs.readFile(new URL('characters.glb', base))]]),
  });
  assert.equal(pack.manifest.format, 'FPVCombatAppearance.v2');
  assert.equal(pack.manifest.characters.length, 36);
  assert.ok(pack.metrics.vertices <= 65536);
  for (const c of pack.manifest.characters) {
    assert.deepEqual(Object.keys(c.regions).sort(), [...COMBAT_DAMAGE_REGIONS].sort());
    assert.equal(Object.values(c.regions).filter((r) => r.parent === null).length, 1);
    for (const gear of c.equipment) assert.ok(c.regions[gear.damageRegion]);
  }
  const manifest = JSON.parse(manifestBytes);
  manifest.regionSets['military-body-v2'].chest.parent = 'head';
  assert.throws(() => validateCombatAppearanceManifest(manifest), /Cyclic/);
  const r1 = await fs.readFile(new URL('../r1/manifest.json', base));
  assert.equal(
    createHash('sha256').update(r1).digest('hex'),
    '8121b18a0a6c1ea2c625cb355ef2d5efee0ed6c1486a835d415c3119fc555357',
  );
});

test('enemy health bars obey visibility, recent damage and spawn reset without extra actor limits', () => {
  const scene = new THREE.Scene(),
    view = createCombatActorPresentation({ THREE, scene });
  const initial = { ...actor(0), maxHealth: 100, position: { x: 0, y: 0, z: 0 } };
  const cameraPosition = new THREE.Vector3(0, 1, 10),
    aimDirection = new THREE.Vector3(0, 0, -1);
  try {
    view.setActors([initial]);
    view.update({ tick: 1, cameraPosition, enemyHealthDisplay: 'off', aimDirection });
    assert.equal(view.resources().healthBars, 0);
    view.update({ tick: 1, cameraPosition, enemyHealthDisplay: 'all' });
    assert.equal(view.resources().healthBars, 1);
    view.update({ tick: 1, cameraPosition, enemyHealthDisplay: 'aimed' });
    assert.equal(view.resources().healthBars, 0);
    view.update({ tick: 1, cameraPosition, enemyHealthDisplay: 'aimed', aimDirection });
    assert.equal(view.resources().healthBars, 1);
    view.setActors([{ ...initial, health: 50 }]);
    view.update({ tick: 2, cameraPosition });
    assert.equal(view.resources().healthBars, 1);
    view.update({ tick: 153, cameraPosition });
    assert.equal(view.resources().healthBars, 0);
    view.setActors([{ ...initial, spawnId: 'replacement' }]);
    view.update({ tick: 154, cameraPosition });
    assert.equal(view.resources().healthBars, 0);
    view.setActors([{ ...initial, status: 'waiting' }]);
    view.update({ tick: 155, cameraPosition, enemyHealthDisplay: 'all' });
    assert.equal(view.resources().actors, 0);
    assert.equal(view.resources().healthBars, 0);
    view.setActors(Array.from({ length: 128 }, (_, i) => ({ ...actor(i), maxHealth: 100 })));
    view.update({ tick: 156, cameraPosition, enemyHealthDisplay: 'all' });
    assert.equal(view.resources().healthBars, 128);
  } finally {
    view.dispose();
  }
});
