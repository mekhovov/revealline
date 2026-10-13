import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_MISSION_COMPOSITIONS } from '../snake/classic-compositions.mjs';
import { createClassicSnake, classicSnakeUsesVariableHazards } from '../snake/classic-core.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import {
  classicTerrainCacheStats,
  CLASSIC_TERRAIN_CACHE_BYTES,
} from '../snake/classic-terrain-cache.mjs';
import {
  observeClassicWorldReactions,
  drawClassicWorldReactions,
} from '../snake/classic-world-reactions.mjs';
function owner() {
  const canvases = [];
  const document = {
    createElement() {
      const calls = [];
      const context = new Proxy(
        {},
        { get: (t, k) => t[k] ?? ((...args) => calls.push([k, ...args])) },
      );
      const canvas = {
        width: 0,
        height: 0,
        style: {},
        ownerDocument: document,
        getContext: () => context,
        calls,
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  return { document, canvases };
}
test('all official missions have literal art briefs independent from gameplay recipes', () => {
  assert.equal(Object.keys(CLASSIC_MISSION_COMPOSITIONS).length, 240);
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const world = CLASSIC_MISSION_COMPOSITIONS[entry.id];
    assert.ok(world.structure && world.ambient && world.landmark && world.floor);
    assert.ok(world.focus[0] >= 0 && world.focus[0] < entry.level.width);
    assert.ok(world.focus[1] >= 0 && world.focus[1] < entry.level.height);
    assert.equal('composition' in entry.level, false);
  }
  assert.equal(CLASSIC_SNAKE_LEVELS[0].level.walls.length, 0);
});
test('browsing all 240 missions releases least-used terrain within the cache budget', () => {
  const { document, canvases } = owner(),
    canvas = document.createElement('canvas');
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const run = createClassicSnake(entry.level, {
      seed: 17,
      ...(classicSnakeUsesVariableHazards(entry.level) ? { hazardSeed: 17 } : {}),
    });
    drawClassicBoard(canvas, run, {
      boardStyle: 'living-circuit',
      chapterId: entry.chapterId,
      reduced: true,
    });
    assert.ok(classicTerrainCacheStats(document).bytes <= CLASSIC_TERRAIN_CACHE_BYTES);
  }
  const stats = classicTerrainCacheStats(document);
  assert.ok(stats.entries > 0 && stats.entries < 12);
  assert.ok(
    canvases.filter((c) => c.width === 1 && c.height === 1).length > 200,
    'evicted backing stores are released',
  );
});
test('paused terrain refreshes on appearance, erosion and loaded creator artwork; repeats hit the cache', () => {
  const { document } = owner(),
    canvas = document.createElement('canvas');
  const entry = CLASSIC_SNAKE_LEVELS.find((x) => x.level.walls.length > 0),
    run = createClassicSnake(entry.level);
  const before = JSON.stringify(run);
  const draw = (options = {}) =>
    drawClassicBoard(canvas, run, {
      boardStyle: 'living-circuit',
      chapterId: entry.chapterId,
      reduced: true,
      ...options,
    });
  draw();
  draw();
  assert.equal(classicTerrainCacheStats(document).hits, 1);
  assert.equal(JSON.stringify(run), before);
  draw({ boardStyle: 'toybox' });
  assert.equal(classicTerrainCacheStats(document).misses, 2);
  run.removedWalls = [run.level.walls[0]];
  draw();
  assert.equal(classicTerrainCacheStats(document).misses, 3);
  let image = null;
  const presentation = {
    asset: () => ({ asset: { id: 'creator', file: { sha256: 'creator' } } }),
    image: () => image,
  };
  draw({ presentation });
  image = { width: 16, height: 16 };
  draw({ presentation });
  assert.equal(classicTerrainCacheStats(document).misses, 5);
  draw({ presentation });
  assert.equal(classicTerrainCacheStats(document).hits, 2);
});
test('cosmetic reactions never award progress, replay twice on redraw, or reveal catches through jamming', () => {
  const board = {},
    attempt = {},
    run = {
      tick: 0,
      level: {
        operation: {
          parcels: [{ id: 'p', dockId: 'd' }],
          docks: [{ id: 'd', at: { x: 4, y: 5 } }],
        },
      },
      operation: { parcels: [{ id: 'p', state: 'waiting' }] },
      snakes: [{ id: 0, body: [{ x: 2, y: 3 }] }],
      recentCatches: [],
      removedWalls: [],
    };
  observeClassicWorldReactions(board, run, attempt, 0);
  run.tick = 1;
  run.operation.parcels[0] = { id: 'p', state: 'carried', carrier: 0 };
  run.recentCatches = [{ x: 3, y: 3, tick: 1 }];
  const before = JSON.stringify(run);
  const effects = observeClassicWorldReactions(board, run, attempt, 100);
  assert.deepEqual(
    effects.map((x) => x.kind),
    ['catch', 'load'],
  );
  assert.equal(observeClassicWorldReactions(board, run, attempt, 200).length, 2);
  assert.equal(JSON.stringify(run), before);
  const { document } = owner(),
    ctx = document.createElement('canvas').getContext('2d');
  const hidden = effects.filter((e) => e.kind === 'catch');
  let fills = 0;
  ctx.fillRect = () => fills++;
  drawClassicWorldReactions(
    ctx,
    run,
    hidden,
    {},
    { palette: {}, timeMs: 200, concealEnemies: true },
  );
  assert.equal(fills, 0);
  drawClassicWorldReactions(ctx, run, effects, {}, { palette: {}, timeMs: 200, reduced: true });
  assert.equal(fills, 0);
  assert.equal(observeClassicWorldReactions(board, run, attempt, 700).length, 0);
  assert.equal(
    observeClassicWorldReactions(board, run, {}, 701).length,
    0,
    'new attempts do not inherit effects',
  );
});
