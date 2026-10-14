import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { resolveClassicWorld } from '../snake/classic-worlds.mjs';
import { drawClassicLivingGround, classicScenePalette } from '../snake/classic-scenes.mjs';
import {
  drawClassicStructureModule,
  classicStructureModule,
  CLASSIC_STRUCTURE_FAMILIES,
} from '../snake/classic-structure-art.mjs';

const reviewed = CLASSIC_SNAKE_LEVELS.flatMap((entry) => {
  const world = resolveClassicWorld({ levelId: entry.id, chapterId: entry.chapterId });
  return world.floorPlan && !world.floorPlan.pattern ? [{ entry, world }] : [];
});
const record = () => {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get: (o, key) => o[key] ?? ((...args) => calls.push([key, args, o.globalAlpha, o.fillStyle])),
    },
  );
  return { ctx, calls };
};

test('authored review covers adjacent pairs in every world with distinct bounded floor arrangements', () => {
  assert.equal(reviewed.length, 18);
  const scenes = new Map();
  const plans = new Set();
  for (const { entry, world } of reviewed) {
    const { floorPlan } = world;
    scenes.set(world.scene, (scenes.get(world.scene) ?? 0) + 1);
    plans.add(JSON.stringify([floorPlan.paths, floorPlan.patches]));
    for (const [x, y] of floorPlan.paths.flat()) {
      assert(x >= 0 && x <= entry.level.width, entry.id);
      assert(y >= 0 && y <= entry.level.height, entry.id);
    }
    for (const [x, y, w, h] of floorPlan.patches) {
      assert(x >= 0 && x + w <= entry.level.width, entry.id);
      assert(y >= 0 && y + h <= entry.level.height, entry.id);
    }
  }
  assert.equal(scenes.size, 6);
  assert([...scenes.values()].every((count) => count >= 2));
  assert.equal(plans.size, reviewed.length, 'distinct names alone do not count as composition');
  assert.equal(reviewed[0].entry.level.walls.length, 0, 'Open Loop remains obstacle-free');
});

test('all four looks render actual authored paths as quiet flat paint without changing the level', () => {
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const world = resolveClassicWorld({ levelId: entry.id, chapterId: entry.chapterId });
    const before = JSON.stringify(entry.level);
    for (const treatment of ['living-circuit', 'toybox', 'atmospheric-ruins', 'night-arcade']) {
      const { ctx, calls } = record();
      drawClassicLivingGround(ctx, entry.level, world.scene, {
        unit: 12,
        treatment,
        composition: world,
      });
      for (const [start] of world.floorPlan.paths)
        assert(
          calls.some(
            ([op, args]) => op === 'moveTo' && JSON.stringify(args) === JSON.stringify(start),
          ),
        );
      for (const patch of world.floorPlan.patches)
        assert(
          calls.some(
            ([op, args, alpha]) =>
              op === 'fillRect' && JSON.stringify(args) === JSON.stringify(patch) && alpha <= 0.075,
          ),
        );
      assert(
        calls.some(([op]) => op === 'clip'),
        'floor paint remains inside the board',
      );
      if (treatment === 'atmospheric-ruins')
        assert(calls.some(([op, args]) => op === 'setLineDash' && args[0].length === 4));
    }
    assert.equal(JSON.stringify(entry.level), before);
  }
});

test('joined foundry machinery has one inspection port instead of a miniature boiler on every tile', () => {
  for (const family of ['boiler', 'pressure']) {
    let ports = 0;
    for (let y = 0; y < 3; y++)
      for (let x = 0; x < 4; x++) {
        const { ctx, calls } = record();
        drawClassicStructureModule(ctx, { x, y }, 'workshop', {
          structure: { x: 0, y: 0, width: 4, height: 3 },
          composition: { assembly: { family, footprint: null } },
        });
        ports += calls.filter(
          ([op, args]) => op === 'fillRect' && args[2] === 12 && args[3] === 13,
        ).length;
      }
    assert.equal(ports, 1, family);
  }
});

test('a harbor pump island has one joined intake row and a single small-structure pump', () => {
  let intakeCells = 0,
    smallPumps = 0;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 6; x++) {
      const { ctx, calls } = record();
      drawClassicStructureModule(ctx, { x, y }, 'harbor', {
        structure: { x: 0, y: 0, width: 6, height: 4 },
        composition: { assembly: { family: 'pump', footprint: [0, 0, 6, 4], anchor: [0, 0] } },
        occupied: new Set(),
      });
      intakeCells += calls.filter(
        ([op, args]) =>
          op === 'fillRect' && args[0] === 0 && args[1] === 11 && args[2] === 28 && args[3] === 8,
      ).length;
    }
  assert.equal(intakeCells, 6, 'a single horizontal intake, not a repeating crossed-pipe grid');
  for (let y = 0; y < 4; y++) {
    const { ctx, calls } = record();
    drawClassicStructureModule(ctx, { x: 0, y }, 'harbor', {
      structure: { x: 0, y: 0, width: 1, height: 4 },
      composition: { assembly: { family: 'pump', footprint: null } },
    });
    smallPumps += calls.filter(
      ([op, args]) => op === 'fillRect' && args[2] === 12 && args[3] === 15,
    ).length;
  }
  assert.equal(smallPumps, 1, 'thin structures get a single native fitting');
});

test('all official missions have bounded explicit floor plans and component materials match real wall cells', () => {
  let completed = 0;
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const world = resolveClassicWorld({ levelId: entry.id, chapterId: entry.chapterId });
    const plan = world.floorPlan;
    assert(plan, entry.id);
    for (const [x, y] of plan.paths.flat()) {
      assert(x >= 0 && x <= entry.level.width && y >= 0 && y <= entry.level.height, entry.id);
    }
    for (const [x, y, w, h] of plan.patches) {
      assert(
        x >= 0 &&
          y >= 0 &&
          w > 0 &&
          h > 0 &&
          x + w <= entry.level.width + 1e-9 &&
          y + h <= entry.level.height + 1e-9,
        entry.id,
      );
    }
    if (!world.componentAssemblies) continue; // The 18 previous manual briefs stay untouched.
    completed++;
    const used = new Set();
    const walls = new Set(entry.level.walls.map(({ x, y }) => `${x},${y}`));
    for (const assembly of world.componentAssemblies) {
      assert(CLASSIC_STRUCTURE_FAMILIES[world.scene].includes(assembly.family), entry.id);
      for (const [x, y] of assembly.cells) {
        const key = `${x},${y}`;
        assert(walls.has(key), entry.id + ' decoration must be an actual solid cell');
        assert(!used.has(key), entry.id + ' component cells must have one material owner');
        used.add(key);
        // Erosion may split a component and change its bounding box. Material
        // ownership follows the original surviving cell, not the current box.
        const module = classicStructureModule({ x, y }, world.scene, {
          structure: { x, y, width: 1, height: 1 },
          composition: world,
        });
        assert.equal(module.family, assembly.family);
      }
    }
    assert.deepEqual(used, walls, entry.id);
    assert(plan.intent.length > 10, entry.id + ' retains the specific tactical brief');
  }
  assert.equal(completed, 222);
});

test('Alpine Toybox solids separate from their pale floor in grayscale and retain role fittings', () => {
  const luminance = (rgb) =>
    rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const floor = luminance(classicScenePalette('relay', 'toybox').tint);
  const signatures = new Set();
  for (const family of ['receiver', 'shelter', 'antenna']) {
    const { ctx, calls } = record();
    drawClassicStructureModule(ctx, { x: 1, y: 1 }, 'relay', {
      treatment: 'toybox',
      structure: { x: 0, y: 0, width: 3, height: 3 },
      composition: { assembly: { family, footprint: null } },
    });
    const base = calls.find(([op, args]) => op === 'fillRect' && args.join(',') === '0,0,28,28')[3];
    const rgb = base.match(/[a-f0-9]{2}/gi).map((v) => parseInt(v, 16));
    const ratio = (floor + 0.05) / (luminance(rgb) + 0.05);
    assert(ratio >= 2, family + ' painted solid should not merge into floor in grayscale');
    signatures.add(JSON.stringify(calls));
  }
  assert.equal(signatures.size, 3, 'receiver vents, shelter window and antenna mast stay distinct');
});
