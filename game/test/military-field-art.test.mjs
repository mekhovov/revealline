import test from 'node:test';
import assert from 'node:assert/strict';
import { MILITARY_FIELD_ROLES, militaryFieldPixels } from '../presentation/military-field-art.mjs';
import {
  getThemeFamily,
  resolvePresentation,
  validatePresentationCoverage,
} from '../presentation/theme-system.mjs';
import {
  getArcadeCollection,
  industrialTexturePixels,
  createArcadeAdapter,
} from '../presentation/industrial-arcade.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from '../presentation/industrial-arcade-builtins.mjs';
import { resolveSimThemeProfile } from '../../optional-practice/civilian-fpv/world-themes.mjs';
import { getSimVisualCollection } from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';

test('military appearance is shared by the game, Studio candidates and native SIM materials', () => {
  const family = getThemeFamily('military-field');
  assert.equal(
    validatePresentationCoverage(resolvePresentation({ themeFamily: family })).valid,
    true,
  );
  const candidate = createThemeCandidate(createDefaultThemeBundle(), { familyId: family.id });
  assert.deepEqual(candidate.family.arcade, family.arcade);
  assert.equal(candidate.simDependency.collection.id, family.sim.id);
  const profile = resolveSimThemeProfile({}, { collectionId: family.sim.id, revision: 'r1' });
  assert.equal(profile.assets.vehicle, 'builtin:military-utility-car');
  assert.equal(getSimVisualCollection(profile.id).materials.concrete.color, 0x969f8c);
});

test('vehicle art is bounded and transparent while all three terrain meanings stay distinct', () => {
  const samples = new Map();
  for (const [slot, role] of Object.entries(MILITARY_FIELD_ROLES)) {
    const size = slot.startsWith('terrain.') ? 16 : 32;
    const frame = militaryFieldPixels({ width: size, height: size }, slot);
    assert.equal(frame.rgba.length, size * size * 4);
    const opaque = frame.rgba.filter(
      (_, index) => index % 4 === 3 && frame.rgba[index] === 255,
    ).length;
    assert.ok(opaque > (size * size) / 5, `${role} has a legible occupied body`);
    if (!slot.startsWith('terrain.')) {
      assert.equal(frame.rgba[3], 0);
      assert.equal(frame.rgba.at(-1), 0);
      assert.ok(opaque < size * size * 0.8, `${role} has no opaque square token`);
    }
    if (samples.has(role)) assert.deepEqual(frame.rgba, samples.get(role));
    samples.set(role, frame.rgba);
  }
  assert.equal(
    new Set([...samples.values()].map((rgba) => Buffer.from(rgba).toString('base64'))).size,
    samples.size,
  );
});

test('military art leaves player pixels and imported author artwork intact', () => {
  const collection = getArcadeCollection('military-field', 'r1');
  const rgba = new Uint8ClampedArray(32 * 32 * 4).fill(197);
  assert.deepEqual(
    industrialTexturePixels({ width: 32, height: 32, rgba }, 'player.scout.compact', collection)
      .rgba,
    rgba,
  );
  let allocations = 0;
  const adapter = createArcadeAdapter({
    canvasFactory: () => {
      allocations++;
      return null;
    },
  });
  const original = {
    image: {},
    asset: { id: 'enemy.bouncer.field-kit', file: { sha256: 'imported-custom-content' } },
  };
  const base = { image: () => original };
  assert.equal(adapter.resolve(base, collection).image('enemy.bouncer'), original);
  assert.equal(allocations, 0);
  adapter.clear();
});

test('accepted vehicles have no rotor anchors and retiring the adapter releases its canvas', () => {
  const slot = 'enemy.bouncer';
  const canvas = {
    getContext: () => ({
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
      putImageData() {},
    }),
  };
  const asset = {
    id: `${slot}.field-kit`,
    file: { width: 32, height: 32, sha256: INDUSTRIAL_BUILTIN_SPRITES[slot][0] },
  };
  const geometry = {
    frame: { width: 32, height: 32 },
    pivot: { x: 0.5, y: 0.5 },
    rotors: [{ x: 0.1 }],
  };
  const original = { image: { width: 32, height: 32 }, asset, geometry };
  const adapter = createArcadeAdapter({ canvasFactory: () => canvas });
  const frame = adapter
    .resolve({ image: () => original }, getArcadeCollection('military-field', 'r1'))
    .image(slot);
  assert.equal(frame.geometry.material, 'military-vehicle');
  assert.deepEqual(frame.geometry.rotors, []);
  assert.equal(frame.geometry.pivot, geometry.pivot);
  assert.equal(geometry.rotors.length, 1, 'original authored geometry was not edited');
  adapter.clear();
  assert.equal(canvas.width, 0);
});
