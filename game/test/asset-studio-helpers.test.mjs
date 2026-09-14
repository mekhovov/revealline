import test from 'node:test';
import assert from 'node:assert/strict';
import {
  centerCrop,
  checkedCrop,
  pixelBounds,
  matchingSlots,
} from '../../authoring/asset-studio/helpers.mjs';

test('crop uses an integer centered frame and never mutates source coordinates', () => {
  const source = { width: 1200, height: 800 };
  assert.deepEqual(centerCrop(source.width, source.height, 32, 32), {
    x: 200,
    y: 0,
    width: 800,
    height: 800,
  });
  assert.deepEqual(source, { width: 1200, height: 800 });
  assert.deepEqual(centerCrop(800, 1200, 960, 540), { x: 0, y: 375, width: 800, height: 450 });
  assert.throws(
    () => checkedCrop({ x: 799, y: 0, width: 2, height: 1 }, 800, 800),
    /fit completely/,
  );
  assert.throws(() => checkedCrop({ x: 0.5, y: 0, width: 32, height: 32 }, 64, 64), /whole pixels/);
});

test('occupied bounds distinguish alpha from actual visible silhouette, including empty sprite', () => {
  const data = new Uint8ClampedArray(4 * 4 * 4);
  data[(1 * 4 + 2) * 4 + 3] = 80;
  data[(2 * 4 + 3) * 4 + 3] = 255;
  assert.deepEqual(pixelBounds({ width: 4, height: 4, data }), {
    transparent: true,
    occupiedBounds: { x: 0.5, y: 0.25, width: 0.5, height: 0.5 },
  });
  data.fill(0);
  assert.deepEqual(pixelBounds({ width: 4, height: 4, data }), {
    transparent: true,
    occupiedBounds: null,
  });
  data.fill(255);
  assert.deepEqual(pixelBounds({ width: 4, height: 4, data }), {
    transparent: false,
    occupiedBounds: { x: 0, y: 0, width: 1, height: 1 },
  });
});

test('inventory combines usage/state/media/readiness filters without treating source as produced', () => {
  const slots = [
    {
      id: 'ui.button',
      label: 'Deploy',
      screens: ['title'],
      states: ['focus'],
      requirements: ['Keep text separate.'],
    },
    {
      id: 'player.scout',
      label: 'Scout',
      screens: ['flight'],
      states: ['default'],
      requirements: ['Four hubs.'],
    },
    {
      id: 'screen.missing',
      label: 'Missing scene',
      screens: ['title'],
      states: ['default'],
      requirements: [],
    },
  ];
  const resolved = {
    assets: {
      'ui.button': { kind: 'recipe', quality: { stage: 'source' } },
      'player.scout': { kind: 'image', quality: { stage: 'reviewed' } },
    },
  };
  assert.deepEqual(
    matchingSlots(slots, resolved, { quality: 'unfinished' }).map((s) => s.id),
    ['ui.button', 'screen.missing'],
  );
  assert.deepEqual(
    matchingSlots(slots, resolved, { quality: 'missing' }).map((s) => s.id),
    ['screen.missing'],
  );
  assert.deepEqual(
    matchingSlots(slots, resolved, {
      query: 'TEXT',
      screen: 'title',
      state: 'focus',
      kind: 'recipe',
      quality: 'source',
    }).map((s) => s.id),
    ['ui.button'],
  );
  assert.equal(matchingSlots(slots, resolved, { quality: 'produced' }).length, 0);
});
