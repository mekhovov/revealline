import test from 'node:test';
import assert from 'node:assert/strict';
import { INDUSTRIAL_ENVIRONMENT_REVISION } from '../presentation/industrial-materials.mjs';
import {
  CLASSIC_BOARD_SCENES,
  CLASSIC_SCENE_MATERIAL_REVISION,
  resolveClassicBoardScene,
  classicSceneMaterial,
  classicSceneBackdrop,
  drawClassicLivingGround,
  drawClassicLivingWall,
} from '../snake/classic-scenes.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { createClassicSnake, exportClassicSnakeReplay } from '../snake/classic-core.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import { drawClassicTarget } from '../snake/classic-target-art.mjs';

function context() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] ?? ((...args) => calls.push([key, ...args, target.fillStyle])),
    },
  );
  return { ctx, calls };
}

test('scene Auto follows chapter identity while explicit choice wins without touching RNG', () => {
  assert.deepEqual(CLASSIC_BOARD_SCENES, ['auto', 'orchard', 'workshop', 'relay']);
  const opening = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === 'classic-snake-open-loop');
  assert.ok(opening, 'fresh-profile opening mission exists in the accepted catalogue');
  assert.equal(resolveClassicBoardScene(opening), 'orchard');
  for (const [chapterId, expected] of [
    ['classic-snake-first-coils', 'orchard'],
    ['classic-snake-route-windows', 'workshop'],
    ['classic-snake-signal-tactics', 'relay'],
  ]) {
    for (const levelId of ['one', 'two'])
      assert.equal(resolveClassicBoardScene({ chapterId, levelId }), expected);
    assert.equal(resolveClassicBoardScene({ chapterId, boardScene: 'workshop' }), 'workshop');
  }
  const original = Math.random;
  Math.random = () => {
    throw new Error('Scene selection must not consume RNG');
  };
  try {
    assert.equal(resolveClassicBoardScene(), 'orchard');
    assert.equal(
      resolveClassicBoardScene({ chapterId: 'community-chapter', levelId: 'one' }),
      resolveClassicBoardScene({ chapterId: 'community-chapter', levelId: 'two' }),
    );
  } finally {
    Math.random = original;
  }
});

test('three quiet ground palettes use the current material generator and opaque wall recipes', () => {
  assert.equal(CLASSIC_SCENE_MATERIAL_REVISION, INDUSTRIAL_ENVIRONMENT_REVISION);
  const samples = ['orchard', 'workshop', 'relay'].map((scene) => classicSceneMaterial(scene));
  assert.equal(new Set(samples.map(({ rgba }) => Buffer.from(rgba).toString('base64'))).size, 3);
  for (const scene of ['orchard', 'workshop', 'relay']) {
    const floor = classicSceneMaterial(scene),
      wall = classicSceneMaterial(scene, { wall: true });
    assert.notDeepEqual(floor, wall, 'walls have distinct contrast from traversable ground');
    for (let at = 3; at < floor.rgba.length; at += 4) {
      assert.equal(floor.rgba[at], 255);
      assert.equal(wall.rgba[at], 255);
    }
    for (let channel = 0; channel < 3; channel++) {
      const values = [];
      for (let at = channel; at < floor.rgba.length; at += 4) values.push(floor.rgba[at]);
      assert.ok(
        Math.max(...values) - Math.min(...values) < 25,
        'floor grain cannot compete with actors',
      );
    }
  }
});

test('Living Circuit preserves the complete grid, actual wall cells, and every replay field', () => {
  const entry = CLASSIC_SNAKE_LEVELS.find(
    (candidate) => candidate.id === 'classic-snake-open-loop',
  );
  assert.ok(entry);
  const run = createClassicSnake(entry.level);
  const before = exportClassicSnakeReplay(run),
    dimensions = [];
  for (const boardStyle of ['theme', 'retro', 'living-circuit'])
    for (const boardScene of ['auto', 'orchard', 'workshop', 'relay']) {
      const { ctx, calls } = context();
      const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
      drawClassicBoard(canvas, run, {
        boardStyle,
        boardScene,
        chapterId: entry.chapterId,
        pixelRatio: 2,
        cssWidth: 320,
      });
      dimensions.push([canvas.width, canvas.height, canvas.style.aspectRatio]);
      assert.deepEqual(calls[0].slice(0, 7), [
        'setTransform',
        canvas.width / (run.level.width * 28),
        0,
        0,
        canvas.height / (run.level.height * 28),
        0,
        0,
      ]);
      assert.deepEqual(exportClassicSnakeReplay(run), before);
    }
  for (const size of dimensions) assert.deepEqual(size, dimensions[0]);
  const { ctx, calls } = context();
  drawClassicLivingWall(ctx, { x: 3, y: 4 }, 'orchard');
  assert.ok(
    calls.some(
      ([method, x, y, w, h]) =>
        method === 'fillRect' && x === 84 && y === 112 && w === 28 && h === 28,
    ),
  );
  calls.length = 0;
  drawClassicLivingGround(ctx, { width: 24, height: 18 }, 'orchard');
  assert.ok(
    calls.some(
      ([method, x, y, w, h]) =>
        method === 'fillRect' && x === 0 && y === 0 && w === 672 && h === 504,
    ),
  );
});

test('specialists use the native machinery painter without changing target data or accepted heading', () => {
  for (const kind of [
    'jammer',
    'lane',
    'relay',
    'perimeter',
    'contour',
    'rover',
    'ricochet',
    'eroder',
    'guard',
  ]) {
    const { ctx, calls } = context();
    const options = Object.freeze({
      kind,
      heading: 'left',
      boardStyle: 'living-circuit',
      frozen: true,
    });
    drawClassicTarget(ctx, 28, 56, 28, 0, options);
    assert.ok(calls.some(([method, x, y]) => method === 'translate' && x === 42 && y === 70));
    assert.ok(calls.some(([method, angle]) => method === 'rotate' && angle === -Math.PI / 2));
  }
});

test('perimeter backdrop is generated once per scene/document and remains outside board geometry', () => {
  let serialized = 0,
    created = 0;
  const document = {
    createElement: () => {
      created++;
      const { ctx } = context();
      ctx.createImageData = (width, height) => ({
        data: new Uint8ClampedArray(width * height * 4),
      });
      return {
        getContext: () => ctx,
        toDataURL: () => `data:image/png;base64,scene${++serialized}`,
      };
    },
  };
  const orchard = classicSceneBackdrop('orchard', { document });
  assert.equal(classicSceneBackdrop('orchard', { document }), orchard);
  assert.notEqual(classicSceneBackdrop('workshop', { document }), orchard);
  assert.notEqual(classicSceneBackdrop('relay', { document }), orchard);
  assert.equal(serialized, 3);
  assert.equal(created, 6, 'three backdrops and three cached native material tiles');
  assert.equal(classicSceneBackdrop('orchard', { document: null }), null);
});
