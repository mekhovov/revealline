import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import {
  pixelArtForSlot,
  FIELD_KIT_SPRITE_IDS,
  FIELD_KIT_COLORS,
  FIELD_KIT_PLAYER_HUBS,
} from '../presentation/pixel-art.mjs';
import { ASSET_SLOTS } from '../presentation/catalog.mjs';
import { inspectSprite, produceFieldKitSprites } from '../../scripts/produce-field-kit-sprites.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const at = (sprite, x, y) =>
  Array.from(sprite.rgba.subarray((y * sprite.width + x) * 4, (y * sprite.width + x) * 4 + 4));
const rgba = (hex) =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).concat(255);

test('all 30 registered sprite frames have binary alpha, at most 12 approved colors, and valid exact frame geometry', () => {
  assert.equal(FIELD_KIT_SPRITE_IDS.length, 30);
  for (const id of FIELD_KIT_SPRITE_IDS) {
    const sprite = pixelArtForSlot(id),
      slot = ASSET_SLOTS.find((slot) => slot.id === id),
      facts = inspectSprite(sprite);
    assert.deepEqual({ width: sprite.width, height: sprite.height }, slot.dimensions, id);
    assert.equal(sprite.rgba.length, sprite.width * sprite.height * 4);
    assert.ok(facts.opaquePixels > 0, id);
    assert.ok(facts.colors.length <= 12, id);
    assert.ok(
      facts.colors.every((color) => Object.values(FIELD_KIT_COLORS).includes(color)),
      id,
    );
    assert.ok(facts.occupiedBounds.x >= 0 && facts.occupiedBounds.y >= 0, id);
    assert.ok(facts.occupiedBounds.x + facts.occupiedBounds.width <= 1, id);
    assert.ok(facts.occupiedBounds.y + facts.occupiedBounds.height <= 1, id);
    if (slot.alpha === 'required') assert.ok(facts.transparentPixels > 0, id);
    if (id.startsWith('terrain.')) assert.equal(facts.transparentPixels, 0, id);
  }
});

test('north-facing player cameras and static motor centers match the exact registered anchors at both native grids', () => {
  for (const id of FIELD_KIT_SPRITE_IDS.filter((id) => id.startsWith('player.'))) {
    const sprite = pixelArtForSlot(id),
      slot = ASSET_SLOTS.find((slot) => slot.id === id),
      classId = id.split('.')[1],
      hubs = FIELD_KIT_PLAYER_HUBS[classId];
    assert.deepEqual(hubs, slot.geometry.rotorAnchors, id);
    assert.equal(hubs.length, classId === 'carrier' ? 6 : 4, id);
    assert.deepEqual(
      at(sprite, Math.floor(sprite.width * 0.5), Math.floor(sprite.height * 0.2)),
      rgba(FIELD_KIT_COLORS.cyan),
      `${id}: cyan camera faces north`,
    );
    for (const hub of hubs) {
      // A continuous normalized anchor is represented by its containing pixel;
      // the discrepancy from that pixel center is at most half a native pixel.
      const x = Math.floor(hub.x * sprite.width),
        y = Math.floor(hub.y * sprite.height);
      assert.ok(Math.abs((x + 0.5) / sprite.width - hub.x) <= 0.5 / sprite.width + 1e-9, id);
      assert.ok(Math.abs((y + 0.5) / sprite.height - hub.y) <= 0.5 / sprite.height + 1e-9, id);
      assert.deepEqual(
        at(sprite, x, y),
        rgba(FIELD_KIT_COLORS.amber),
        `${id}: visible static hub at ${hub.x},${hub.y}`,
      );
      const r = Math.max(3, Math.floor(sprite.width * 0.105));
      const clear = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].filter(([dx, dy]) => {
        const px = x + dx * r,
          py = y + dy * r;
        return (
          px < 0 ||
          py < 0 ||
          px >= sprite.width ||
          py >= sprite.height ||
          at(sprite, px, py)[3] === 0
        );
      }).length;
      assert.ok(clear >= 3, `${id}: no opaque rotor disc around a static motor`);
    }
    const b = inspectSprite(sprite).occupiedBounds;
    assert.ok(
      b.x >= 0.125 && b.y >= 0.125 && b.x + b.width <= 0.875 && b.y + b.height <= 0.875,
      `${id}: body stays inside the registered art envelope`,
    );
  }
});

test('native detailed drawings are distinct authored clusters and all role outputs are independent', () => {
  const signatures = new Set();
  for (const id of FIELD_KIT_SPRITE_IDS) {
    const sprite = pixelArtForSlot(id);
    signatures.add(hash(sprite.rgba));
    const original = hash(sprite.rgba);
    sprite.rgba.fill(0);
    assert.equal(hash(pixelArtForSlot(id).rgba), original, `${id}: owned output`);
  }
  assert.equal(signatures.size, FIELD_KIT_SPRITE_IDS.length);
  for (const classId of Object.keys(FIELD_KIT_PLAYER_HUBS)) {
    const compact = pixelArtForSlot(`player.${classId}.compact`),
      detailed = pixelArtForSlot(`player.${classId}.detailed`),
      upsampled = new Uint8ClampedArray(64 * 64 * 4);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++)
        upsampled.set(at(compact, Math.floor(x / 2), Math.floor(y / 2)), (y * 64 + x) * 4);
    assert.notDeepEqual(
      detailed.rgba,
      upsampled,
      `${classId}: 64 px includes separately authored detail`,
    );
  }
  assert.throws(() => pixelArtForSlot('player.unknown.compact'), /No authored/);
  assert.throws(
    () => pixelArtForSlot('player.scout.compact', { tokens: { cyan: 'url(evil)' } }),
    /Invalid sprite palette/,
  );
  assert.throws(() => pixelArtForSlot('player.scout.compact', { size: 1000 }), /integer from/);
});

test('all emitted PNGs decode to source pixels and retain exact hashes, measured bounds, and produced-only provenance', async () => {
  const directory = new URL('../assets/field-kit/sprites/', import.meta.url),
    manifest = JSON.parse(await readFile(new URL('sprites.json', directory)));
  assert.equal(manifest.assets.length, 30);
  assert.equal(manifest.quality.stage, 'produced');
  for (const asset of manifest.assets) {
    const bytes = await readFile(new URL(asset.file.path, directory)),
      sprite = pixelArtForSlot(asset.slotId),
      facts = inspectSprite(sprite);
    assert.equal(bytes.length, asset.file.bytes);
    assert.equal(hash(bytes), asset.file.sha256);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), sprite.width);
    assert.equal(bytes.readUInt32BE(20), sprite.height);
    const compressed = [];
    for (let offset = 8; offset < bytes.length; ) {
      const length = bytes.readUInt32BE(offset),
        type = bytes.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const rows = inflateSync(Buffer.concat(compressed));
    for (let y = 0; y < sprite.height; y++) {
      const start = y * (sprite.width * 4 + 1);
      assert.equal(rows[start], 0);
      assert.deepEqual(
        rows.subarray(start + 1, start + 1 + sprite.width * 4),
        Buffer.from(sprite.rgba.subarray(y * sprite.width * 4, (y + 1) * sprite.width * 4)),
      );
    }
    assert.deepEqual(asset.geometry.occupiedBounds, facts.occupiedBounds);
    assert.equal(asset.quality.stage, 'produced');
    assert.deepEqual(asset.quality.evidence, []);
    assert.ok(asset.provenance.prompt.includes('NORTH'));
    assert.ok(asset.provenance.license.includes('Original project'));
  }
  assert.deepEqual(await produceFieldKitSprites({ check: true }), {
    count: 30,
    totalSpriteBytes: manifest.assets.reduce((total, a) => total + a.file.bytes, 0),
    artifacts: 33,
    directory: new URL('.', directory).pathname.slice(0, -1),
  });
});
