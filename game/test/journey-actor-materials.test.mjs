import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JOURNEY_ACTOR_MATERIALS,
  journeyActorMaterial,
  journeyActorPixels,
  drawJourneyActorMaterial,
} from '../presentation/journey-actor-materials.mjs';
import { ENEMY_CATALOG } from '../enemy-catalog.mjs';

test('twelve original immutable materials have unique bounded identities and all seven role recipes', () => {
  assert.equal(JOURNEY_ACTOR_MATERIALS.length, 12);
  assert.equal(new Set(JOURNEY_ACTOR_MATERIALS.map(({ id }) => id)).size, 12);
  assert(Object.isFrozen(JOURNEY_ACTOR_MATERIALS));
  for (const material of JOURNEY_ACTOR_MATERIALS) {
    assert.equal(journeyActorMaterial(material.id), material);
    assert(Object.isFrozen(material));
    for (const color of [material.metal, material.inset]) assert.match(color, /^#[0-9a-f]{6}$/);
    const silhouettes = new Set();
    for (const { type } of ENEMY_CATALOG) {
      const pixels = journeyActorPixels(material.id, type);
      assert(Object.isFrozen(pixels));
      assert(pixels.length > 20 && pixels.length <= 196);
      for (const pixel of pixels) {
        assert(Object.isFrozen(pixel));
        assert.equal(pixel.size, 2);
        assert(Number.isInteger(pixel.x) && pixel.x >= -14 && pixel.x + pixel.size <= 14);
        assert(Number.isInteger(pixel.y) && pixel.y >= -14 && pixel.y + pixel.size <= 14);
        assert(['outline', 'role', 'metal', 'inset'].includes(pixel.tone));
      }
      assert(
        pixels.some((pixel) => pixel.tone === 'role'),
        `${material.id}/${type} role color remains`,
      );
      const locations = pixels.map(({ x, y }) => `${x},${y}`);
      assert.equal(new Set(locations).size, pixels.length);
      silhouettes.add(locations.join(';'));
      // Every painted cluster is attached to the body. Floating decorations could
      // be mistaken for extra actors or projectiles at phone size.
      const pending = new Set(locations),
        frontier = [pixels[0]];
      pending.delete(locations[0]);
      while (frontier.length) {
        const { x, y } = frontier.pop();
        for (const [dx, dy] of [
          [-2, 0],
          [2, 0],
          [0, -2],
          [0, 2],
        ])
          if (pending.delete(`${x + dx},${y + dy}`)) frontier.push({ x: x + dx, y: y + dy });
      }
      assert.equal(pending.size, 0, `${material.id}/${type} connected silhouette`);
    }
    assert.equal(silhouettes.size, 7, `${material.id} preserves seven distinct role outlines`);
  }
});

test('campaign materials differ in authored pixel treatment, not only color', () => {
  for (const { type } of ENEMY_CATALOG) {
    const signatures = JOURNEY_ACTOR_MATERIALS.map(({ id }) =>
      JSON.stringify(journeyActorPixels(id, type)),
    );
    assert.equal(new Set(signatures).size, 12, type);
  }
});

test('the body renderer stays deterministic and cannot change contact or gameplay data', () => {
  const colors = Object.freeze({
    dark: '#07111c',
    body: '#ff6d91',
    trim: '#ffd27b',
    light: '#f1f7ed',
  });
  for (const material of JOURNEY_ACTOR_MATERIALS)
    for (const { type } of ENEMY_CATALOG) {
      const frame = Object.freeze({
        journeyMaterial: material.id,
        type,
        radius: 3.2,
        diameter: 24,
        x: 140,
        y: 100,
        dormant: false,
      });
      const render = () => {
        const calls = [],
          ctx = {
            fillRect(...args) {
              calls.push([this.fillStyle, ...args]);
            },
          };
        assert.equal(drawJourneyActorMaterial(ctx, frame, colors), true);
        return calls;
      };
      assert.deepEqual(render(), render());
      assert.equal(frame.radius, 3.2);
      const muted = [];
      drawJourneyActorMaterial(
        {
          fillRect() {
            muted.push(this.fillStyle);
          },
        },
        { ...frame, dormant: true },
        colors,
      );
      assert(muted.every((color) => [colors.dark, colors.body].includes(color)));
    }
});

test('unknown materials, inherited role names and legacy frames never draw a replacement', () => {
  for (const id of [null, undefined, 'retro', '__proto__', 'constructor', 'horizon-enamel-v2']) {
    assert.equal(journeyActorMaterial(id), null);
    assert.equal(journeyActorPixels(id, 'bouncer'), null);
    assert.equal(
      drawJourneyActorMaterial(null, { journeyMaterial: id, type: 'bouncer' }, null),
      false,
    );
  }
  assert.equal(drawJourneyActorMaterial(null, null, null), false);
  for (const type of ['__proto__', 'toString', '', undefined])
    assert.equal(journeyActorPixels(JOURNEY_ACTOR_MATERIALS[0].id, type), null);
  assert.equal(drawJourneyActorMaterial(null, { themeId: 'retro', type: 'bouncer' }, null), false);
});
