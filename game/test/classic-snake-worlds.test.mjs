import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS, CLASSIC_SNAKE_CHAPTERS } from '../snake/classic-catalogue.mjs';
import {
  CLASSIC_CHAPTER_COMPOSITIONS,
  CLASSIC_BOARD_STYLES,
  CLASSIC_BOARD_SCENES,
  classicBoardPreferences,
  resolveClassicWorld,
} from '../snake/classic-worlds.mjs';
import {
  classicWallStructures,
  drawClassicLivingWall,
  drawClassicLivingGround,
  classicSceneBackdrop,
} from '../snake/classic-scenes.mjs';
import { createClassicSnake, exportClassicSnakeReplay } from '../snake/classic-core.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import { renderClassicSnakeLibraryPreview } from '../snake/classic-mission-library.mjs';

function canvasHarness() {
  const calls = [];
  const context = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] ?? ((...args) => calls.push([key, ...args, target.fillStyle])),
    },
  );
  const canvas = { width: 0, height: 0, style: {}, setAttribute() {}, getContext: () => context };
  return { calls, context, canvas };
}

test('new profiles use Lively FPV while saved looks and explicit legacy links win', () => {
  const prefs = (query, saved) => classicBoardPreferences(new URLSearchParams(query), saved);
  assert.deepEqual(prefs(''), { boardStyle: 'living-circuit', boardScene: 'auto' });
  for (const board of CLASSIC_BOARD_STYLES) {
    assert.equal(prefs('', { boardStyle: board }).boardStyle, board);
    assert.equal(prefs(`board=${board}`, { boardStyle: 'retro' }).boardStyle, board);
  }
  for (const scene of CLASSIC_BOARD_SCENES)
    assert.equal(prefs(`scene=${scene}`, { boardScene: 'orchard' }).boardScene, scene);
});

test('all 192 recipes retain identity and all 29 chapters have explicit cosmetic direction', () => {
  assert.equal(CLASSIC_SNAKE_LEVELS.length, 192);
  assert.deepEqual(
    Object.keys(CLASSIC_CHAPTER_COMPOSITIONS).sort(),
    CLASSIC_SNAKE_CHAPTERS.map((x) => x.id).sort(),
  );
  assert.equal(new Set(Object.values(CLASSIC_CHAPTER_COMPOSITIONS).map((x) => x.scene)).size, 6);
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const before = JSON.stringify(entry.level);
    const world = resolveClassicWorld({ chapterId: entry.chapterId });
    assert.ok(world.composition && world.zoning);
    assert.equal(
      resolveClassicWorld({ chapterId: entry.chapterId, boardScene: 'harbor' }).scene,
      'harbor',
    );
    assert.equal(JSON.stringify(entry.level), before);
  }
  assert.equal(
    resolveClassicWorld({ chapterId: 'unknown-a' }).scene,
    resolveClassicWorld({ chapterId: 'unknown-b' }).scene,
  );
});

test('connected structures retain holes, diagonal passages and eroded breaks', () => {
  const cells = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
    { x: 3, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 4, y: 4 },
  ];
  const structures = classicWallStructures(cells);
  assert.equal(structures.size, cells.length);
  assert.equal(structures.has('2,2'), false, 'courtyard remains open');
  assert.equal(structures.get('1,1'), structures.get('3,3'));
  assert.notEqual(structures.get('4,4'), structures.get('3,3'), 'diagonal corner is not connected');
  const split = classicWallStructures([
    { x: 1, y: 1 },
    { x: 3, y: 1 },
  ]);
  assert.notEqual(split.get('1,1'), split.get('3,1'), 'eroded connector splits the structure');
  const { context, calls } = canvasHarness();
  drawClassicLivingWall(context, cells[0], 'orchard', {
    structure: structures.get('1,1'),
    occupied: new Set(structures.keys()),
  });
  assert.ok(
    calls.some(([op, x, y, w, h]) => op === 'rect' && x === 0 && y === 0 && w === 28 && h === 28),
    'large specimen clips to each solid cell',
  );
  assert.ok(calls.some(([op]) => op === 'clip'));
});

test('creator wall images stay authoritative in every world treatment, including eroded terrain', () => {
  const entry = CLASSIC_SNAKE_LEVELS.find((x) => x.id === 'classic-field-linked-courts');
  const run = createClassicSnake(entry.level);
  const image = { width: 16, height: 16 };
  const presentation = {
    asset: () => ({ asset: { id: 'creator-wall', file: { sha256: 'custom' } } }),
    image: (slot) => (slot === 'terrain.wall' ? image : null),
  };
  run.removedWalls = [run.level.walls[0]];
  const before = exportClassicSnakeReplay(run);
  for (const boardStyle of CLASSIC_BOARD_STYLES.slice(2)) {
    const { canvas, calls } = canvasHarness();
    drawClassicBoard(canvas, run, { boardStyle, presentation });
    assert.equal(
      calls.filter(([op, art]) => op === 'drawImage' && art === image).length,
      run.level.walls.length - 1,
    );
    assert.deepEqual(exportClassicSnakeReplay(run), before);
  }
});

test('selector preview uses the same world renderer and selected appearance without a simulation step', () => {
  const entry = CLASSIC_SNAKE_LEVELS.find((x) => x.id === 'classic-field-linked-courts');
  const run = createClassicSnake(entry.level);
  const before = exportClassicSnakeReplay(run);
  for (const boardStyle of CLASSIC_BOARD_STYLES) {
    const a = canvasHarness(),
      b = canvasHarness();
    renderClassicSnakeLibraryPreview({
      container: { append() {} },
      document: { createElement: () => a.canvas },
      diagram: { kind: 'classic-snake', run, chapterId: entry.chapterId },
      appearance: { boardStyle, boardScene: 'harbor' },
    });
    drawClassicBoard(b.canvas, run, {
      boardStyle,
      boardScene: 'harbor',
      chapterId: entry.chapterId,
      reduced: true,
      cssWidth: 288,
      pixelRatio: 1,
    });
    assert.deepEqual(a.calls, b.calls, boardStyle);
  }
  assert.deepEqual(exportClassicSnakeReplay(run), before);
});

test('the complete world range reuses at most 192 tiny material tiles and 24 backdrop encodings', () => {
  const surfaces = [];
  const document = {
    createElement() {
      const { context, canvas } = canvasHarness();
      context.createImageData = (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      canvas.toDataURL = () => 'data:image/png;base64,fixture';
      surfaces.push(canvas);
      return canvas;
    },
  };
  for (let repeat = 0; repeat < 2; repeat++)
    for (const treatment of CLASSIC_BOARD_STYLES.slice(2))
      for (const scene of CLASSIC_BOARD_SCENES.slice(1)) {
        const { context } = canvasHarness();
        drawClassicLivingGround(context, { width: 24, height: 18 }, scene, { document, treatment });
        for (let x = 0; x < 4; x++)
          drawClassicLivingWall(context, { x, y: 0 }, scene, { document, treatment });
        classicSceneBackdrop(scene, { document, treatment });
      }
  assert.equal(surfaces.filter((x) => x.width === 32).length, 192);
  assert.equal(surfaces.filter((x) => x.width === 384).length, 24);
  const bytes = surfaces.reduce((n, c) => n + c.width * c.height * 4, 0);
  assert.ok(bytes < 16 * 1024 * 1024, `${bytes} bytes including even released backdrop canvases`);
});
