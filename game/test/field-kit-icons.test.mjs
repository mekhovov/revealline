import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ASSET_SLOTS } from '../presentation/catalog.mjs';
import {
  iconForSlot,
  FIELD_KIT_ICON_IDS,
  FIELD_KIT_ICON_SIZES,
  FIELD_KIT_ICON_DESCRIPTIONS,
} from '../presentation/icons.mjs';
const at = (image, x, y) =>
  Array.from(image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
const hash = (image) => createHash('sha256').update(image.rgba).digest('hex');

test('all45 semantic icons cover the exact registry and native grids with binary alpha, transparent edges and at most4 colors', () => {
  assert.deepEqual(
    [...FIELD_KIT_ICON_IDS].sort(),
    ASSET_SLOTS.filter((slot) => /^(icon|hud|reward|control)\./.test(slot.id))
      .map((slot) => slot.id)
      .sort(),
  );
  assert.equal(FIELD_KIT_ICON_IDS.length, 45);
  const hashes = new Set();
  for (const id of FIELD_KIT_ICON_IDS) {
    const icon = iconForSlot(id),
      slot = ASSET_SLOTS.find((slot) => slot.id === id),
      colors = new Set();
    assert.deepEqual({ width: icon.width, height: icon.height }, slot.dimensions, id);
    assert.equal(icon.rgba.length, icon.width * icon.height * 4, id);
    assert.equal(icon.width, FIELD_KIT_ICON_SIZES[id]);
    assert.ok(FIELD_KIT_ICON_DESCRIPTIONS[id].length > 20);
    let opaque = 0;
    for (let y = 0; y < icon.height; y++)
      for (let x = 0; x < icon.width; x++) {
        const color = at(icon, x, y);
        assert.ok([0, 255].includes(color[3]), `${id}: binary alpha`);
        if (color[3]) {
          opaque++;
          colors.add(color.slice(0, 3).join(','));
        }
        if (x === 0 || y === 0 || x === icon.width - 1 || y === icon.height - 1)
          assert.equal(color[3], 0, `${id}: edge clearance`);
      }
    assert.ok(opaque > 15 && opaque < (icon.width * icon.height) / 1.3, id);
    assert.ok(colors.size <= 4, `${id}: palette limit`);
    assert.ok(!hashes.has(hash(icon)), `${id}: unique semantic mark`);
    hashes.add(hash(icon));
  }
});

test('direction bindings rotate exactly clockwise, back differs from undo, and redo mirrors undo', () => {
  const up = iconForSlot('control.up'),
    right = iconForSlot('control.right'),
    down = iconForSlot('control.down'),
    left = iconForSlot('control.left');
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) {
      assert.deepEqual(at(right, 23 - y, x), at(up, x, y));
      assert.deepEqual(at(down, 23 - x, 23 - y), at(up, x, y));
      assert.deepEqual(at(left, y, 23 - x), at(up, x, y));
    }
  const undo = iconForSlot('icon.undo'),
    redo = iconForSlot('icon.redo');
  for (let y = 0; y < 24; y++)
    for (let x = 0; x < 24; x++) assert.deepEqual(at(redo, 23 - x, y), at(undo, x, y));
  assert.notEqual(hash(undo), hash(iconForSlot('icon.back')));
  assert.notEqual(hash(undo), hash(iconForSlot('icon.retry')));
  assert.equal(at(up, 11, 4)[3], 255, 'north-pointing tip');
  assert.equal(at(up, 4, 4)[3], 0, 'clear diagonal corner');
});

test('award rank marks remain distinct without medal hue', () => {
  const tokens = { amber: '#808080', muted: '#808080', hazard: '#808080' };
  const awards = ['bronze', 'silver', 'gold'].map((name) =>
    iconForSlot(`reward.${name}`, { tokens }),
  );
  assert.equal(new Set(awards.map(hash)).size, 3);
  const ink = [7, 11, 18, 255];
  for (let rank = 1; rank <= 3; rank++)
    for (let mark = 0; mark < 3; mark++) {
      assert.equal(
        JSON.stringify(at(awards[rank - 1], 12 + mark * 3, 20)) === JSON.stringify(ink),
        mark < rank,
      );
    }
});

test('inspection sizes stay binary and independently owned while malformed requests fail', () => {
  for (const id of FIELD_KIT_ICON_IDS)
    for (const size of [16, 24, 32]) {
      const image = iconForSlot(id, { size });
      assert.equal(image.rgba.length, size * size * 4);
      assert.ok(image.rgba.some((_, i) => i % 4 === 3 && image.rgba[i] === 255));
      assert.ok(image.rgba.every((value, i) => i % 4 !== 3 || value === 0 || value === 255));
    }
  const before = iconForSlot('icon.menu');
  before.rgba.fill(0);
  assert.ok(iconForSlot('icon.menu').rgba.some((value) => value !== 0));
  assert.throws(() => iconForSlot('icon.invented'));
  for (const size of [0, 15, 25, 128, NaN, '24'])
    assert.throws(() => iconForSlot('icon.menu', { size }));
  for (const text of ['red', '#fff', '#ff0000aa', {}, null])
    assert.throws(() => iconForSlot('icon.menu', { tokens: { text } }));
  assert.deepEqual(
    iconForSlot('icon.menu', { tokens: { unrelated: 'bad value' } }),
    iconForSlot('icon.menu'),
  );
});
