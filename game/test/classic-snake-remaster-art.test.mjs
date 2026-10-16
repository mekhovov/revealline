import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_STRUCTURE_FAMILIES,
  CLASSIC_STRUCTURE_REVISION,
  classicStructureModule,
} from '../snake/classic-structure-art.mjs';
import {
  drawClassicLivingWall,
  drawClassicLivingGround,
  classicSceneMaterial,
  classicSceneBackdrop,
} from '../snake/classic-scenes.mjs';
import { classicTargetIdentity } from '../snake/classic-target-identity.mjs';
import { classicTargetPose, drawClassicTarget } from '../snake/classic-target-art.mjs';
import { classicCargoShape } from '../snake/classic-operation-view.mjs';
import { resolveClassicWorld } from '../snake/classic-worlds.mjs';

const recorder = () => {
  const calls = [];
  const ctx = new Proxy(
    {},
    { get: (o, k) => o[k] ?? ((...args) => calls.push([k, ...args, o.fillStyle])) },
  );
  return { ctx, calls };
};

test('long structures repeat cell-scale construction and clip landmark to actual occupancy', () => {
  const structure = { x: 0, y: 0, width: 12, height: 3 };
  const occupied = new Set(Array.from({ length: 36 }, (_, i) => `${i % 12},${Math.floor(i / 12)}`));
  const { ctx, calls } = recorder();
  drawClassicLivingWall(ctx, { x: 6, y: 1 }, 'freight', {
    structure,
    occupied,
    composition: { assembly: { family: 'container', footprint: [0, 0, 12, 3] } },
  });
  assert(calls.some(([op]) => op === 'clip'));
  assert(
    !calls.some(([op, x, y]) => op === 'scale' && (x > 1 || y > 1)),
    'native panels and landmark are never stretched to 12×3',
  );
  assert(
    calls.some(([op, x, y, w, h]) => op === 'fillRect' && w === 2 && h === 28),
    'container rib stays two native pixels wide',
  );
  const fullCount = calls.length;
  const gap = recorder();
  occupied.delete('6,1');
  drawClassicLivingWall(gap.ctx, { x: 5, y: 1 }, 'freight', {
    structure,
    occupied,
    composition: { assembly: { family: 'container', footprint: [0, 0, 12, 3] } },
  });
  assert(gap.calls.length < fullCount, 'incomplete landmark footprint is not painted over a hole');
});

test('all six worlds expose three construction families and explicit assembly overrides', () => {
  assert.equal(Object.keys(CLASSIC_STRUCTURE_FAMILIES).length, 6);
  for (const [scene, families] of Object.entries(CLASSIC_STRUCTURE_FAMILIES)) {
    assert.equal(new Set(families).size, 3);
    for (const family of families) {
      const m = classicStructureModule({ x: 2, y: 3 }, scene, {
        composition: { assembly: { family, footprint: [2, 3, 4, 3], anchor: [3, 4] } },
      });
      assert.equal(m.family, family);
      assert.deepEqual([m.landmarkX, m.landmarkY], [3, 4]);
    }
  }
  assert.equal(
    classicStructureModule({ x: 0, y: 0 }, 'orchard', {
      structure: { x: 0, y: 0, width: 4, height: 4 },
      composition: { assembly: { family: 'planter', footprint: null } },
    }).landmark,
    false,
  );
});

test('specialist identity is stable across every appearance and pose never predicts a future phase', () => {
  for (const kind of ['jammer', 'lane', 'relay', 'rover', 'guard', 'runner', 'sprinter']) {
    const identity = classicTargetIdentity(kind, 'living-circuit');
    for (const style of ['theme', 'retro', 'toybox', 'atmospheric-ruins', 'night-arcade'])
      assert.deepEqual(classicTargetIdentity(kind, style), identity);
  }
  for (const phase of ['warning', 'rest', 'recovery', 'waiting', 'dormant'])
    assert.equal(classicTargetPose({ phase, timeMs: 1537 }).stride, 0);
  assert.equal(classicTargetPose({ phase: 'warning', timeMs: 1537 }).stance, 'prepare');
  assert.equal(
    classicTargetPose({ phase: 'active', reducedEffects: true, timeMs: 1537 }).stride,
    0,
  );
  assert.equal(classicTargetPose({ phase: 'travel', timeMs: 1537 }).warning, false);
  const { ctx, calls } = recorder();
  drawClassicTarget(ctx, 0, 0, 28, 0, {
    kind: 'jammer',
    phase: 'warning',
    boardStyle: 'toybox',
    timeMs: 1500,
  });
  assert(
    calls.some(
      ([op, x, y, w, h]) => op === 'fillRect' && x === -8 && y === -10 && w === 16 && h === 2,
    ),
    'antenna is a primary silhouette, not only a badge',
  );
});

test('cargo has four repeatable non-colour destination silhouettes and descriptors retain chosen treatment', () => {
  assert.deepEqual(['A', 'B', 'C', 'D'].map(classicCargoShape), [
    'crate',
    'drum',
    'case',
    'bundle',
  ]);
  assert.equal(classicCargoShape('E'), 'crate');
  for (const treatment of [
    'theme',
    'retro',
    'living-circuit',
    'toybox',
    'atmospheric-ruins',
    'night-arcade',
  ]) {
    const world = resolveClassicWorld({ boardStyle: treatment });
    assert.equal(world.treatment, treatment);
    assert.equal(world.structureRevision, CLASSIC_STRUCTURE_REVISION);
  }
});

test('six appearances retain no more than 192 material tiles and 24 distinct backdrops', () => {
  const surfaces = [];
  const urls = [];
  const document = {
    createElement() {
      const { ctx } = recorder();
      ctx.createImageData = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      ctx.putImageData = () => {};
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toDataURL: () => {
          const url = 'data:test,' + urls.length;
          urls.push(url);
          return url;
        },
      };
      surfaces.push(canvas);
      return canvas;
    },
  };
  for (const boardStyle of [
    'living-circuit',
    'toybox',
    'atmospheric-ruins',
    'night-arcade',
    'theme',
    'retro',
  ])
    for (const scene of Object.keys(CLASSIC_STRUCTURE_FAMILIES)) {
      const { ctx } = recorder();
      drawClassicLivingGround(ctx, { width: 4, height: 4 }, scene, {
        document,
        treatment: boardStyle,
      });
      for (let x = 0; x < 4; x++)
        drawClassicLivingWall(ctx, { x, y: 0 }, scene, { document, treatment: boardStyle });
      classicSceneBackdrop(scene, { document, treatment: boardStyle });
    }
  assert(surfaces.filter((c) => c.width === 32 && c.height === 32).length <= 192);
  assert.equal(urls.length, 24, 'restrained looks reuse native backdrop encodings');
});

test('obstacle-free prototype appearances differ in actual sampled floor pixels, not only fallback fill', () => {
  const mean = (style) => {
    const bytes = classicSceneMaterial('orchard', { treatment: style }).rgba;
    const rgb = [0, 0, 0];
    for (let i = 0; i < bytes.length; i += 4)
      for (let c = 0; c < 3; c++) rgb[c] += bytes[i + c] / (bytes.length / 4);
    return rgb;
  };
  const rich = mean('living-circuit'),
    toy = mean('toybox'),
    restrained = mean('theme');
  assert(
    toy[0] - rich[0] > 50 && toy[1] - rich[1] > 50,
    'toy enamel remains visibly lighter after material sampling',
  );
  assert(
    restrained[2] - rich[2] > 15 && rich[0] - restrained[0] > 20,
    'restrained slate is not repainted olive by source texture',
  );
});
