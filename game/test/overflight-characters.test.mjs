import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSES } from '../core/registry.mjs';
import { setLocale, getLocale } from '../i18n/index.mjs';
import { contentText } from '../i18n/content.mjs';
import { ASSET_SLOTS } from '../presentation/catalog.mjs';
import { ACTOR_PRESENTATION_SLOTS } from '../presentation/host.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import {
  DEFAULT_OVERFLIGHT_CHARACTER,
  OVERFLIGHT_CHARACTERS,
  OVERFLIGHT_CHARACTER_IMAGE_SLOTS,
  normalizeOverflightCharacterId,
  overflightCharacterName,
  resolveOverflightCharacter,
  prepareOverflightCharacters,
  paintOverflightCharacterPreview,
} from '../overflight/characters.mjs';
import { overflightHeroGeometry } from '../overflight/atlas.mjs';

const release = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url), 'utf8'),
);
function acceptedSnapshot() {
  const images = Object.fromEntries(
    OVERFLIGHT_CHARACTER_IMAGE_SLOTS.map((slot) => {
      const asset = release.resolved.assets[slot];
      return [
        slot,
        Object.freeze({
          image: Object.freeze({ width: asset.file.width, height: asset.file.height, slot }),
          asset,
          geometry: imagePresentation(asset),
        }),
      ];
    }),
  );
  return { images, snapshot: { image: (slot) => images[slot] ?? null } };
}

test('all seven native FPV bodies are registered, distinct and decoded by the board profile', () => {
  assert.deepEqual(
    OVERFLIGHT_CHARACTERS.map(({ id }) => id),
    ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'],
  );
  assert.equal(DEFAULT_OVERFLIGHT_CHARACTER, 'scout');
  const { snapshot, images } = acceptedSnapshot(),
    prepared = prepareOverflightCharacters(snapshot);
  assert.ok(Object.isFrozen(prepared));
  assert.equal(new Set(prepared.map(({ frame }) => frame.asset.file.sha256)).size, 7);
  for (const item of OVERFLIGHT_CHARACTERS) {
    assert.deepEqual(Object.keys(item), ['id', 'slots', 'rotorSlot']);
    for (const slot of item.slots) {
      assert.ok(ASSET_SLOTS.find(({ id }) => id === slot));
      assert.ok(ACTOR_PRESENTATION_SLOTS.includes(slot));
    }
    const resolved = prepared.find(({ id }) => id === item.id);
    assert.equal(resolved.playerSlot, item.slots[0]);
    assert.equal(resolved.frame, images[item.slots[0]]);
    assert.equal(resolved.frame.geometry.rotors.length, item.id === 'carrier' ? 6 : 4);
    assert.ok(Object.isFrozen(resolved));
  }
});

test('native names follow shared EN/UK locale changes without bringing Solo abilities', () => {
  const locale = getLocale();
  try {
    for (const language of ['en', 'uk']) {
      setLocale(language, { persist: false });
      for (const native of CLASSES) {
        assert.equal(overflightCharacterName(native.id), contentText(native, 'label'));
        assert.ok(overflightCharacterName(native.id).length);
      }
      assert.equal(overflightCharacterName(), language === 'uk' ? 'Розвідник' : 'Scout');
    }
  } finally {
    setLocale(locale, { persist: false });
  }
});

test('stored identities normalize once, while active rendering rejects invalid or missing craft', () => {
  for (const { id } of OVERFLIGHT_CHARACTERS) assert.equal(normalizeOverflightCharacterId(id), id);
  for (const id of [
    null,
    undefined,
    {},
    'SCOUT',
    '../carrier',
    'player.carrier.detailed',
    'unknown',
  ])
    assert.equal(normalizeOverflightCharacterId(id), 'scout');
  const { snapshot } = acceptedSnapshot();
  assert.throws(() => resolveOverflightCharacter(snapshot, 'unknown'), /Unsupported/);
  assert.throws(() => overflightCharacterName('unknown'), /Unsupported/);
  assert.throws(() => resolveOverflightCharacter(null), /snapshot/);
  assert.throws(() => resolveOverflightCharacter({ image: () => null }, 'carrier'), /carrier/);
});

test('same-character compact fallback and custom body/geometry retain exact accepted ownership', () => {
  const { snapshot, images } = acceptedSnapshot();
  const custom = Object.freeze({
    image: Object.freeze({ width: 96, height: 48, custom: true }),
    asset: Object.freeze({ id: 'authored.fiber', revision: 8 }),
    geometry: Object.freeze({
      frame: Object.freeze({ width: 96, height: 48 }),
      pivot: Object.freeze({ x: 0.4, y: 0.6 }),
      rotors: Object.freeze([]),
    }),
  });
  images['player.fiber.detailed'] = custom;
  const resolved = resolveOverflightCharacter(snapshot, 'fiber');
  assert.equal(resolved.frame, custom);
  assert.equal(resolved.frame.image, custom.image);
  assert.equal(resolved.frame.geometry, custom.geometry);
  assert.equal(resolveOverflightCharacter(snapshot, resolved.id).frame, custom);
  delete images['player.fiber.detailed'];
  assert.equal(resolveOverflightCharacter(snapshot, 'fiber').playerSlot, 'player.fiber.compact');
  delete images['player.fiber.compact'];
  assert.throws(() => prepareOverflightCharacters(snapshot), /fiber/);
  assert.throws(() => resolveOverflightCharacter(snapshot, 'fiber'), /fiber/);
  // Scout remains present: absent fiber artwork cannot silently substitute it.
  assert.equal(resolveOverflightCharacter(snapshot).id, 'scout');
});

test('roster preparation resolves each lazy accepted appearance once before selector use', () => {
  const { snapshot } = acceptedSnapshot(),
    calls = [];
  const prepared = prepareOverflightCharacters({
    image(slot) {
      calls.push(slot);
      return snapshot.image(slot);
    },
  });
  assert.deepEqual(
    calls,
    OVERFLIGHT_CHARACTERS.map(({ slots }) => slots[0]),
  );
  assert.equal(prepared.length, 7);
  assert.throws(() => resolveOverflightCharacter({ image: () => ({ image: {} }) }), /geometry/);
});

function previewCanvas() {
  const calls = [],
    ctx = { globalAlpha: 1 };
  for (const name of [
    'save',
    'restore',
    'translate',
    'scale',
    'rotate',
    'drawImage',
    'beginPath',
    'arc',
    'fill',
    'moveTo',
    'lineTo',
    'closePath',
    'fillRect',
  ])
    ctx[name] = (...args) => calls.push([name, ...args]);
  return { canvas: { getContext: () => ctx }, calls, ctx };
}

test('previews paint the accepted native bodies and exact atlas rotor geometry without clipping', () => {
  const { snapshot } = acceptedSnapshot();
  for (const entry of prepareOverflightCharacters(snapshot)) {
    const before = structuredClone(entry.frame.geometry),
      metrics = overflightHeroGeometry(entry.frame.geometry),
      { canvas, calls, ctx } = previewCanvas();
    assert.equal(paintOverflightCharacterPreview(canvas, entry), canvas);
    assert.equal(canvas.width, 64);
    assert.equal(canvas.height, 64);
    assert.equal(ctx.imageSmoothingEnabled, false);
    const draw = calls.filter(([name]) => name === 'drawImage');
    assert.equal(draw.length, 1);
    assert.equal(draw[0][1], entry.frame.image);
    assert.deepEqual(draw[0].slice(2), [
      -entry.frame.geometry.pivot.x * metrics.width,
      -entry.frame.geometry.pivot.y * metrics.height,
      metrics.width,
      metrics.height,
    ]);
    assert.deepEqual(
      calls.filter(([name]) => name === 'arc').map((call) => call[3]),
      metrics.rotors.map(({ radius }) => radius),
    );
    assert.equal(metrics.rotors.length, entry.id === 'carrier' ? 6 : 4);
    for (const rotor of metrics.rotors) {
      assert.ok(Math.abs(rotor.x) + rotor.radius <= metrics.frameSize / 2);
      assert.ok(Math.abs(rotor.y) + rotor.radius <= metrics.frameSize / 2);
    }
    assert.deepEqual(entry.frame.geometry, before);
    const large = previewCanvas();
    paintOverflightCharacterPreview(large.canvas, entry, { size: 128, pose: 3 });
    assert.deepEqual(
      large.calls.find(([name]) => name === 'scale'),
      ['scale', 2, 2],
    );
    assert.equal(large.canvas.width, 128);
  }
});

test('preview rejects mismatched character slots and leaves caller-owned accepted art unchanged', () => {
  const { snapshot } = acceptedSnapshot(),
    entry = resolveOverflightCharacter(snapshot, 'carrier'),
    { canvas } = previewCanvas();
  assert.throws(
    () =>
      paintOverflightCharacterPreview(canvas, { ...entry, playerSlot: 'player.scout.detailed' }),
    /resolved/,
  );
  assert.throws(() => paintOverflightCharacterPreview(canvas, entry, { size: 1024 }), /16–256/);
  assert.throws(() => paintOverflightCharacterPreview(canvas, entry, { pose: NaN }), /finite/);
  assert.throws(() => paintOverflightCharacterPreview({}, entry), /2D canvas/);
});
