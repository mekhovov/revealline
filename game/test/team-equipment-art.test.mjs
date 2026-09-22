import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { TEAM_EQUIPMENT_IDS, teamEquipmentArt } from '../presentation/team-equipment-art.mjs';
import { FIELD_KIT_COLORS, pixelArtForSlot } from '../presentation/pixel-art.mjs';
import { ASSET_SLOTS } from '../presentation/catalog.mjs';
import { encodeSpritePNG, inspectSprite } from '../../scripts/produce-field-kit-sprites.mjs';
import { createFieldKitProduction } from '../../scripts/produce-field-kit-theme.mjs';
import { resolvePresentation } from '../presentation/model.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const mask = (image) =>
  Uint8Array.from({ length: image.width * image.height }, (_, i) => image.rgba[i * 4 + 3]);

test('five equipment frames meet exact slot, palette, transparency and file budgets', () => {
  assert.equal(TEAM_EQUIPMENT_IDS.length, 5);
  for (const id of TEAM_EQUIPMENT_IDS) {
    const image = teamEquipmentArt(id),
      slot = ASSET_SLOTS.find((entry) => entry.id === id);
    const facts = inspectSprite(image),
      png = encodeSpritePNG(image);
    assert.deepEqual({ width: image.width, height: image.height }, slot.dimensions, id);
    assert.ok(facts.opaquePixels > 0 && facts.transparentPixels > 0, id);
    assert.ok(facts.colors.length <= 12, id);
    assert.ok(
      facts.colors.every((color) => Object.values(FIELD_KIT_COLORS).includes(color)),
      id,
    );
    assert.ok(
      facts.colors.every((color) => slot.palette.includes(color)),
      `${id}: declared slot palette`,
    );
    assert.ok(facts.occupiedBounds.x > 0 && facts.occupiedBounds.y > 0, id);
    assert.ok(facts.occupiedBounds.x + facts.occupiedBounds.width < 1, id);
    assert.ok(facts.occupiedBounds.y + facts.occupiedBounds.height < 1, id);
    assert.ok(png.length <= slot.budget.maxBytes, id);
    assert.equal(slot.geometry.pivot.x, 0.5);
    assert.equal(slot.geometry.pivot.y, 0.5);
    assert.ok(Buffer.from(teamEquipmentArt(id).rgba).equals(Buffer.from(image.rgba)), id);
    // Decode filter-0 PNG scanlines independently and compare every output pixel.
    const chunks = [];
    for (let at = 8; at < png.length; ) {
      const length = png.readUInt32BE(at),
        type = png.subarray(at + 4, at + 8).toString();
      if (type === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + length));
      at += length + 12;
    }
    const raw = inflateSync(Buffer.concat(chunks));
    for (let y = 0; y < image.height; y++) {
      const at = y * (image.width * 4 + 1);
      assert.equal(raw[at], 0);
      assert.ok(
        raw
          .subarray(at + 1, at + 1 + image.width * 4)
          .equals(Buffer.from(image.rgba.subarray(y * image.width * 4, (y + 1) * image.width * 4))),
      );
    }
  }
});

test('objective states differ by silhouette and never alias ordinary pickup or enemy pixels', () => {
  for (const ids of [TEAM_EQUIPMENT_IDS.slice(0, 2), TEAM_EQUIPMENT_IDS.slice(2)])
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        assert.notEqual(
          hash(mask(teamEquipmentArt(ids[a]))),
          hash(mask(teamEquipmentArt(ids[b]))),
          `${ids[a]} / ${ids[b]} must not rely on colour alone`,
        );
      }
  for (const id of TEAM_EQUIPMENT_IDS) {
    const value = hash(teamEquipmentArt(id).rgba);
    for (const existing of ['pickup.objective', 'pickup.supply', 'enemy.relay-sentinel'])
      assert.notEqual(value, hash(pixelArtForSlot(existing).rgba), `${id} is original equipment`);
  }
  assert.throws(() => teamEquipmentArt('team.unknown'), /No Team equipment/);
});

test('production actually binds every equipment PNG with exact authored geometry and produced status', async () => {
  const production = await createFieldKitProduction(),
    resolved = resolvePresentation(production.document);
  for (const id of TEAM_EQUIPMENT_IDS) {
    const asset = resolved.assets[id],
      expected = encodeSpritePNG(teamEquipmentArt(id));
    assert.equal(asset.kind, 'image');
    assert.equal(asset.quality.stage, 'produced');
    assert.equal(asset.file.sha256, hash(expected));
    assert.equal(asset.file.bytes, expected.length);
    assert.ok(
      Buffer.from(await production.assets.get(asset.file.sha256).arrayBuffer()).equals(expected),
    );
    assert.deepEqual(
      asset.geometry.occupiedBounds,
      inspectSprite(teamEquipmentArt(id)).occupiedBounds,
    );
  }
});
