import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  pixelArtForSlot,
  FIELD_KIT_SPRITE_IDS,
  FIELD_KIT_COLORS,
} from '../presentation/pixel-art.mjs';
import {
  candidatePixelArtForSlot,
  FIELD_KIT_CANDIDATE_RIGS,
  FIELD_KIT_CANDIDATE_PIVOT,
} from '../presentation/rotor-candidate-art.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const classes = ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'];
const alphaAt = (sprite, x, y) => sprite.rgba[(y * sprite.width + x) * 4 + 3];
const rgbaAt = (sprite, x, y) => [
  ...sprite.rgba.slice((y * sprite.width + x) * 4, (y * sprite.width + x) * 4 + 4),
];
const countOpaque = (sprite) =>
  sprite.rgba.filter((value, index) => index % 4 === 3 && value === 255).length;
const draw = (id, treatment) => candidatePixelArtForSlot(`player.${id}.${treatment}`);

test('all thirty original sprite outputs retain their exact pre-candidate aggregate hash', () => {
  const source = createHash('sha256');
  for (const id of FIELD_KIT_SPRITE_IDS) {
    source.update(id);
    source.update('\0');
    source.update(pixelArtForSlot(id).rgba);
  }
  assert.equal(
    source.digest('hex'),
    '8d5fa5724dc3e5d69b0521a2768885f053c8386bd43b618e9a0ad0d407da7e13',
  );
});

test('candidate rigs keep a native-pixel frame gutter and independent neighboring sweep circles', () => {
  assert.deepEqual(FIELD_KIT_CANDIDATE_PIVOT, { x: 0.5, y: 0.5 });
  for (const [id, hubs] of Object.entries(FIELD_KIT_CANDIDATE_RIGS)) {
    assert.equal(hubs.length, id === 'carrier' ? 6 : 4);
    for (const [index, hub] of hubs.entries()) {
      assert.ok(hub.radius > 0.12, `${id}: the candidate sweep is larger than the original`);
      assert.ok([2, 3, 4].includes(hub.blades));
      assert.ok([-1, 1].includes(hub.direction));
      for (const edge of [hub.x, hub.y, 1 - hub.x, 1 - hub.y])
        assert.ok(edge - hub.radius >= 1 / 32, `${id}: one full pixel inside the frame at 32px`);
      for (const other of hubs.slice(index + 1)) {
        const gap = Math.hypot(hub.x - other.x, hub.y - other.y) - hub.radius - other.radius;
        assert.ok(gap >= 0.8 / 32, `${id}: neighboring propeller sweeps remain separated`);
      }
    }
    const clockwise = [...hubs].sort(
      (a, b) => Math.atan2(a.y - 0.5, a.x - 0.5) - Math.atan2(b.y - 0.5, b.x - 0.5),
    );
    assert.ok(
      clockwise.every(
        (hub, index) => hub.direction !== clockwise[(index + 1) % clockwise.length].direction,
      ),
      `${id}: neighboring motors counter-rotate around the frame`,
    );
  }
});

for (const treatment of ['compact', 'detailed'])
  test(`all seven ${treatment} candidates have distinct native silhouettes, smaller hubs and lighter body proportions`, () => {
    const silhouettes = new Set(),
      amber = [1, 3, 5]
        .map((i) => parseInt(FIELD_KIT_COLORS.amber.slice(i, i + 2), 16))
        .concat(255);
    for (const id of classes) {
      const sprite = draw(id, treatment),
        original = pixelArtForSlot(`player.${id}.${treatment}`),
        size = treatment === 'compact' ? 32 : 64;
      assert.equal(sprite.width, size);
      assert.equal(sprite.height, size);
      assert.equal(sprite.rgba.length, size * size * 4);
      assert.ok(
        countOpaque(sprite) < countOpaque(original) * 0.65,
        `${id}: more open frame around the equipment`,
      );
      const alpha = sprite.rgba.filter((_, index) => index % 4 === 3);
      assert.ok(alpha.every((value) => value === 0 || value === 255));
      silhouettes.add(hash(alpha));
      for (const hub of FIELD_KIT_CANDIDATE_RIGS[id]) {
        const x = Math.floor(hub.x * size),
          y = Math.floor(hub.y * size),
          motorRadius = size === 32 ? 1 : 2,
          outward = hub.x < 0.5 ? -1 : 1;
        assert.deepEqual(
          rgbaAt(sprite, x, y),
          amber,
          `${id}: motor center equals the proposed rig`,
        );
        assert.equal(
          alphaAt(sprite, x + outward * (motorRadius + 1), y),
          0,
          `${id}: no old oversized motor ring`,
        );
        assert.ok(
          (2 * hub.radius * size) / (2 * motorRadius + 1) >= 3.2 - 1e-12,
          `${id}: blades dominate the motor diameter`,
        );
      }
    }
    assert.equal(
      silhouettes.size,
      7,
      'role variation changes silhouette as well as interior color',
    );
  });

test('carrier keeps six separate arms and patrol candidate is opt-in without registering old empty geometry', () => {
  const carrier = FIELD_KIT_CANDIDATE_RIGS.carrier;
  assert.equal(carrier.length, 6);
  assert.ok(carrier.every((hub) => hub.blades === 2));
  for (const size of [32, 64]) {
    const slot = 'enemy.border-patrol',
      baseline = pixelArtForSlot(slot, { size }),
      candidate = candidatePixelArtForSlot(slot, { size });
    assert.notEqual(hash(candidate.rgba), hash(baseline.rgba));
    assert.deepEqual(pixelArtForSlot(slot, { size }), baseline);
  }
  assert.throws(
    () => candidatePixelArtForSlot('enemy.bouncer'),
    /No reference-proportion candidate/,
  );
  assert.throws(
    () => candidatePixelArtForSlot('player.scout.compact', { size: 128 }),
    /native 32 or 64/,
  );
});
