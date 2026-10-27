import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { ACTOR_FAMILIES, ACTOR_CASTS } from '../hunt/actor-catalog.mjs';
import {
  combatFragmentRecipe,
  createCombatPresentation,
  normalizeCombatDefeat,
} from '../../optional-practice/civilian-fpv/combat-presentation.mjs';

const defeat = (family = 'courier', cast = 'tactical', outcome = 'explosive') =>
  normalizeCombatDefeat({
    type: 'defeat',
    eventId: 'organic-detail:1',
    sourceId: 'soldier',
    spawnId: 'soldier:1',
    tick: 1,
    material: 'organic',
    outcome,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 4000, y: 500, z: 0 },
    appearance: { family, cast, type: 'patrol' },
    seed: 27,
  });

test('detailed organic recipes retain twelve bounded, connected, persistent body regions', () => {
  for (const family of ACTOR_FAMILIES)
    for (const cast of ACTOR_CASTS)
      for (const detail of ['low', 'high', 'ultra'])
        for (const outcome of ['intact', 'localized', 'breakup', 'explosive']) {
          const parts = combatFragmentRecipe(defeat(family.id, cast.id, outcome), {
            brutal: true,
            blood: true,
            detail,
          });
          assert.ok(parts.length <= 140, `${family.id}/${cast.id}/${detail}/${outcome}`);
          assert.equal(new Set(parts.filter((p) => p.bodyAt).map((p) => p.region)).size, 12);
          assert.ok(parts.filter((p) => p.attachment < 0).every((p) => p.bodyAt));
          for (const [index, part] of parts.entries()) {
            assert.ok(part.size.every((n) => Number.isFinite(n) && n > 0));
            assert.ok(part.supportSize.every((n) => Number.isFinite(n) && n > 0));
            assert.ok(part.attachment < index);
            if (part.optionalDetail) {
              assert.ok(part.attachment >= 0);
              assert.equal(parts[part.attachment].optionalDetail, undefined);
              assert.equal(part.region, parts[part.attachment].region);
            }
          }
        }
});

test('graphic layers have neck-aware cuts, paired forearm bones and recognizable attached hands', () => {
  const record = defeat();
  const parts = combatFragmentRecipe(record, { brutal: true, blood: true, detail: 'ultra' });
  const head = parts.findIndex((p) => p.bodyAt && p.region === 'head');
  assert.ok(parts.some((p) => p.attachment === head && p.shape === 'wound' && p.at[1] < 0));
  for (const side of ['left', 'right']) {
    const forearm = parts.findIndex((p) => p.bodyAt && p.region === `${side}Forearm`);
    assert.equal(parts.filter((p) => p.attachment === forearm && p.shape === 'bone').length, 2);
    assert.equal(
      parts.filter((p) => p.attachment === forearm && p.shape === 'limb' && p.size[0] === 0.021)
        .length,
      4,
    );
    const shin = parts.findIndex((p) => p.bodyAt && p.region === `${side}Shin`);
    assert.ok(
      parts.some(
        (p) =>
          p.attachment === shin && !p.optionalDetail && p.shape === 'round' && p.size[2] >= 0.3,
      ),
    );
  }
});

test('graphic switches remove organic exposure without losing uniforms, gear or body regions', () => {
  const record = defeat();
  for (const settings of [
    { brutal: false, blood: false },
    { brutal: false, blood: true },
    { brutal: true, blood: false },
  ]) {
    const parts = combatFragmentRecipe(record, { ...settings, detail: 'ultra' });
    assert.ok(parts.every((p) => !['wound', 'bone'].includes(p.shape)));
    assert.equal(new Set(parts.filter((p) => p.bodyAt).map((p) => p.region)).size, 12);
    assert.ok(parts.some((p) => p.shape === 'metal'));
  }
  const low = combatFragmentRecipe(record, { brutal: true, blood: true, detail: 'low' });
  const high = combatFragmentRecipe(record, { brutal: true, blood: true, detail: 'high' });
  assert.ok(low.length < high.length);
});

test('rotated attached details fit every connected parent support box', () => {
  const parts = combatFragmentRecipe(defeat(), { blood: true, brutal: true, detail: 'ultra' });
  const point = new THREE.Vector3();
  for (const part of parts) {
    if (part.attachment < 0) continue;
    const parent = parts[part.attachment];
    const rotation = new THREE.Euler(...(part.rotation ?? [0, 0, 0]));
    for (const x of [-0.5, 0.5])
      for (const y of [-0.5, 0.5])
        for (const z of [-0.5, 0.5]) {
          point
            .set(x * part.supportSize[0], y * part.supportSize[1], z * part.supportSize[2])
            .applyEuler(rotation)
            .add(new THREE.Vector3(...part.at));
          assert.ok(
            point
              .toArray()
              .every((value, axis) => Math.abs(value) <= parent.supportSize[axis] / 2 + 1e-9),
            part.region,
          );
        }
  }
});

test('every Current family settles under Auto pressure without dropping its persistent body regions', () => {
  const floor = (point, normal, sweep) => {
    if (sweep?.toMm && sweep.toMm.y > (sweep.radiusMm ?? 0)) return { clear: true };
    const at = sweep?.attachment?.position ?? sweep?.toMm ?? point;
    return {
      position: { x: at.x, y: 0, z: at.z },
      normal: { x: 0, y: 1, z: 0 },
      surfaceId: 'floor',
      attached: Boolean(sweep?.attachment),
    };
  };
  for (const family of ACTOR_FAMILIES) {
    const effects = createCombatPresentation({
      THREE,
      scene: new THREE.Scene(),
      detail: 'auto',
      preferences: () => ({ blood: true, brutal: true, showRemains: true }),
      groundQuery: floor,
    });
    try {
      for (let frame = 0; frame < 95; frame++)
        effects.update({ tick: 0, presentationClock: 0, graphicsQuality: 'high', frameMs: 30 });
      const fact = { ...defeat(family.id), type: 'defeat' };
      effects.observe([fact], { runId: 'pressure', tick: 1 });
      let maximumMoving = 0;
      for (let tick = 1; tick <= 450; tick++) {
        effects.update({
          tick,
          presentationClock: tick / 50,
          graphicsQuality: 'high',
          frameMs: 30,
        });
        maximumMoving = Math.max(maximumMoving, effects.resources().moving);
      }
      const result = effects.resources();
      assert.equal(result.tier, 'high');
      assert.equal(result.pressureReduced, true);
      assert.ok(maximumMoving > 0 && maximumMoving <= 128, family.id);
      assert.ok(result.settled > 0, family.id);
      const poses = Object.values(effects.export().records[0].presentation.pieces);
      assert.ok(poses.length > 0 && poses.length <= 12);
      assert.ok(
        poses.every((pose) => pose.settled && !pose.pending),
        family.id,
      );
    } finally {
      effects.dispose();
    }
  }
});

test('persistent blood follows settled body contacts and exact world positions through recenter and restore', () => {
  let queries = 0;
  const floor = (point, normal, sweep) => {
    queries++;
    if (sweep?.toMm && sweep.toMm.y > (sweep.radiusMm ?? 0)) return { clear: true };
    const at = sweep?.attachment?.position ?? sweep?.toMm ?? point;
    return {
      position: { x: at.x, y: 0, z: at.z },
      normal: { x: 0, y: 1, z: 0 },
      surfaceId: 'floor',
      localPosition: { x: at.x, y: 0, z: at.z },
      attached: Boolean(sweep?.attachment),
    };
  };
  const scene = new THREE.Scene();
  const effects = createCombatPresentation({
    THREE,
    scene,
    detail: 'ultra',
    preferences: () => ({ blood: true, brutal: true, showRemains: true }),
    groundQuery: floor,
  });
  const matrices = () => {
    const marks = scene.getObjectByName('combat-mark'),
      matrix = new THREE.Matrix4();
    return Array.from({ length: marks.count }, (_, index) => {
      marks.getMatrixAt(index, matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
    });
  };
  try {
    effects.observe([{ ...defeat(), type: 'defeat' }], { runId: 'contact', tick: 1 });
    for (let tick = 1; tick <= 1000; tick++)
      effects.update({ tick, presentationClock: tick / 50, graphicsQuality: 'high' });
    const saved = effects.export(),
      poses = saved.records[0].presentation.pieces;
    assert.equal(Object.keys(poses).length, 12);
    assert.ok(Object.values(poses).every((pose) => pose.settled && !pose.pending));
    const before = matrices(),
      surfaces = Object.values(poses).map((pose) => pose.surface.position);
    assert.ok(before.length > 4, 'settled parts add pools beyond the original impact splashes');
    assert.ok(
      surfaces.some(
        (surface) =>
          Math.hypot(surface.x, surface.z) > 300 &&
          // Archived support coordinates are rounded to 0.1 mm.
          before.some(
            (mark) => Math.hypot(mark[0] - surface.x / 1000, mark[2] - surface.z / 1000) < 1.5e-4,
          ),
      ),
      'a dispersed body region has a pool at its accepted ground contact',
    );
    const probes = queries,
      origin = { x: 100000, y: 0, z: -30000 };
    effects.update({
      tick: 1000,
      presentationClock: 20,
      graphicsQuality: 'high',
      originMm: origin,
    });
    const shifted = matrices();
    assert.equal(shifted.length, before.length);
    for (let index = 0; index < before.length; index++)
      for (let axis = 0; axis < 3; axis++)
        assert.ok(
          Math.abs(shifted[index][axis] + [100, 0, -30][axis] - before[index][axis]) < 1e-5,
        );
    assert.equal(queries, probes, 'paused recenter reuses accepted world support');
    effects.restore(saved, { runId: 'contact' });
    effects.update({ tick: saved.tick, presentationClock: 20, graphicsQuality: 'high' });
    assert.deepEqual(
      Object.keys(effects.export().records[0].presentation.pieces).sort(),
      Object.keys(poses).sort(),
    );
    assert.equal(effects.resources().bursts, 0);
    assert.equal(effects.resources().stored, 1);
  } finally {
    effects.dispose();
  }
});
