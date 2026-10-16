import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  drawClassicBattlefield,
  classicBattlefieldWorld,
  classicBattlefieldPalette,
} from '../snake/classic-battlefield-art.mjs';
import { CLASSIC_BOARD_STYLES, classicBoardPreferences } from '../snake/classic-worlds.mjs';
import { createClassicSnake, exportClassicSnakeReplay } from '../snake/classic-core.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import { CLASSIC_COPY } from '../snake/classic-copy.mjs';
import { classicTerrainCacheStats } from '../snake/classic-terrain-cache.mjs';
import { Document } from './helpers/couch-dom.mjs';

const recording = () => {
  const calls = [];
  return {
    calls,
    ctx: new Proxy(
      {},
      {
        get: (target, key) =>
          key in target ? target[key] : (...args) => calls.push([key, ...args, target.fillStyle]),
      },
    ),
  };
};

test('battlefield reuse is an explicit translated Snake appearance with unchanged default preference', async () => {
  assert.ok(CLASSIC_BOARD_STYLES.includes('fpv-battlefield'));
  assert.equal(classicBoardPreferences(new URLSearchParams()).boardStyle, 'living-circuit');
  assert.equal(
    classicBoardPreferences(new URLSearchParams(), { boardStyle: 'theme' }).boardStyle,
    'theme',
  );
  assert.equal(
    classicBoardPreferences(new URLSearchParams('board=fpv-battlefield')).boardStyle,
    'fpv-battlefield',
  );
  assert.ok(CLASSIC_COPY.en['fpv-battlefield']);
  assert.match(CLASSIC_COPY.uk['fpv-battlefield'], /Поле/);
  assert.match(
    await readFile(new URL('../snake/play.html', import.meta.url), 'utf8'),
    /value="fpv-battlefield"/,
  );
});

test('native scenery sources provide three distinct reused worlds with tall props only in the outer backdrop', () => {
  const drawings = [];
  for (const [scene, expected] of [
    ['orchard', 'field-crossing'],
    ['freight', 'freight-depot'],
    ['relay', 'relay-ruins'],
  ]) {
    assert.equal(classicBattlefieldWorld(scene), expected);
    const floor = recording(),
      backdrop = recording();
    drawClassicBattlefield(floor.ctx, scene, 672, 504);
    drawClassicBattlefield(backdrop.ctx, scene, 672, 504, { backdrop: true });
    assert.ok(backdrop.calls.length > floor.calls.length);
    assert.equal(floor.calls[1][0], 'scale');
    assert.match(classicBattlefieldPalette(scene).field, /^#[a-f0-9]{6}$/);
    drawings.push(JSON.stringify(floor.calls));
  }
  assert.equal(new Set(drawings).size, 3);
});

test('real Snake gameplay draws reused ground through its bounded terrain cache and preserves custom wall art and replay', () => {
  const document = new Document(),
    canvas = document.createElement('canvas'),
    entry = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === 'classic-field-linked-courts'),
    run = createClassicSnake(entry.level),
    before = exportClassicSnakeReplay(run),
    image = { width: 16, height: 16 },
    draws = [],
    create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'canvas') element.getContext('2d').drawImage = (source) => draws.push(source);
    return element;
  };
  const options = {
    boardStyle: 'fpv-battlefield',
    boardScene: 'freight',
    presentation: {
      asset: () => ({ asset: { id: 'my-wall', file: { sha256: 'private-art' } } }),
      image: (slot) => (slot === 'terrain.wall' ? image : null),
    },
  };
  drawClassicBoard(canvas, run, options);
  drawClassicBoard(canvas, run, options);
  assert.equal(classicTerrainCacheStats(document).misses, 1);
  assert.equal(classicTerrainCacheStats(document).hits, 1);
  assert.equal(draws.filter((source) => source === image).length, run.level.walls.length);
  assert.deepEqual(exportClassicSnakeReplay(run), before);
});
