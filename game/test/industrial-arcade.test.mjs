import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pixelArtForSlot, FIELD_KIT_SPRITE_IDS } from '../presentation/pixel-art.mjs';
import {
  createArcadeAdapter,
  getArcadeCollection,
  selectedArcadeCollection,
  industrialTexturePixels,
  INDUSTRIAL_ARCADE_COLLECTION,
  INDUSTRIAL_ARCADE_PALETTE,
} from '../presentation/industrial-arcade.mjs';
import {
  INDUSTRIAL_BUILTIN_SPRITES,
  INDUSTRIAL_BUILTIN_MACHINERY_GEOMETRY,
} from '../presentation/industrial-arcade-builtins.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { canvasTextFonts } from '../text-face.mjs';

const following = { familyId: 'industrial-workshop', arcadeArt: 'follow-game' };
test('collection capability requires explicit opt-in and a registered matching family', () => {
  assert.equal(
    selectedArcadeCollection(following),
    getArcadeCollection('industrial-workshop', 'r2'),
  );
  for (const prefs of [
    null,
    {},
    { ...following, arcadeArt: 'authored' },
    { ...following, familyId: 'legacy' },
    { ...following, familyId: 'not-installed' },
  ])
    assert.equal(selectedArcadeCollection(prefs), null);
});

test('native industrial texture is deterministic and keeps every alpha pixel of every sprite', () => {
  for (const slot of FIELD_KIT_SPRITE_IDS) {
    const source = pixelArtForSlot(slot),
      before = new Uint8ClampedArray(source.rgba),
      result = industrialTexturePixels(source, slot);
    assert.equal(result.width, source.width);
    assert.equal(result.height, source.height);
    assert.deepEqual(result, industrialTexturePixels(source, slot));
    assert.deepEqual(source.rgba, before);
    assert.notDeepEqual(result.rgba, source.rgba);
    for (let at = 3; at < result.rgba.length; at += 4)
      assert.equal(result.rgba[at], source.rgba[at]);
  }
});

test('material treatment adds bounded surface detail while rejecting giant inputs', () => {
  const rgba = new Uint8ClampedArray(16 * 16 * 4);
  for (let at = 0; at < rgba.length; at += 4) rgba.set([24, 37, 49, 255], at);
  const result = industrialTexturePixels({ width: 16, height: 16, rgba }, 'terrain.wall');
  const colors = new Set();
  for (let at = 0; at < rgba.length; at += 4) colors.add(result.rgba.slice(at, at + 3).join(','));
  assert.ok(colors.size >= 3, 'seams, face and sparse fasteners differ');
  assert.throws(() => industrialTexturePixels({ width: 129, height: 1, rgba: [] }, 'terrain.wall'));
});

function fixture(hash, slot = 'terrain.wall') {
  hash ??= INDUSTRIAL_BUILTIN_SPRITES[slot][0];
  const image = { width: 16, height: 16 },
    geometry = { frame: { width: 16, height: 16 }, rotors: [] },
    asset = {
      id: `${slot}.field-kit`,
      file: { width: 16, height: 16, sha256: hash },
      geometry: INDUSTRIAL_BUILTIN_MACHINERY_GEOMETRY[slot],
    },
    frame = { image, geometry, asset },
    base = Object.freeze({
      source: Object.freeze({ id: 'unchanged' }),
      manifestSha256: 'exact-source',
      fonts: Object.freeze({ ui: 'test' }),
      canvas: Object.freeze({ motionScale: 0 }),
      resolved: Object.freeze({ assets: Object.freeze({ [slot]: asset }) }),
      image: (requested) => (requested === slot ? frame : null),
    });
  let allocations = 0;
  const canvases = [],
    canvasFactory = () => {
      allocations++;
      const listeners = new Map();
      const canvas = {
        listeners,
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener: (name) => listeners.delete(name),
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: pixelArtForSlot(slot).rgba }),
          putImageData() {},
        }),
      };
      canvases.push(canvas);
      return canvas;
    };
  return { base, frame, canvasFactory, canvases, allocations: () => allocations };
}

test('adapter caches prepared pixels, preserves exact geometry/source and owns only its derived canvases', () => {
  const f = fixture(),
    adapter = createArcadeAdapter({ canvasFactory: f.canvasFactory }),
    derived = adapter.resolve(f.base, INDUSTRIAL_ARCADE_COLLECTION);
  assert.equal(adapter.resolve(f.base, null), f.base);
  assert.equal(adapter.resolve(f.base, INDUSTRIAL_ARCADE_COLLECTION), derived);
  assert.equal(derived.resolved, f.base.resolved);
  assert.equal(derived.source, f.base.source);
  assert.match(derived.fonts.ui, /Exo 2/);
  assert.equal(
    canvasTextFonts('pixel', derived.fonts, { useThemeFont: true }).ui,
    derived.fonts.ui,
  );
  assert.match(canvasTextFonts('pixel', derived.fonts).ui, /Reveal Line Pixel/);
  assert.doesNotMatch(canvasTextFonts('plain', derived.fonts, { useThemeFont: true }).ui, /Exo 2/);
  assert.equal(derived.canvas.motionScale, 0);
  assert.equal(derived.canvas.palette, INDUSTRIAL_ARCADE_PALETTE);
  const frame = derived.image('terrain.wall');
  assert.notEqual(frame.image, f.frame.image);
  assert.equal(frame.geometry, f.frame.geometry);
  assert.equal(frame.asset, f.frame.asset);
  assert.equal(derived.image('terrain.wall'), frame);
  assert.equal(f.allocations(), 1);
  assert.deepEqual(adapter.resourceSnapshot(), {
    canvases: 1,
    pixels: 256,
    rgbaBytesEstimate: 1024,
    lost: 0,
  });
  adapter.clear();
  assert.equal(adapter.resourceSnapshot().rgbaBytesEstimate, 0);
  assert.equal(f.canvases[0].width, 0);
  assert.equal(f.frame.image.width, 16);
});

test('uploaded/custom hashes and failed Canvas reads retain original artwork', () => {
  const f = fixture('a'.repeat(64)),
    adapter = createArcadeAdapter({ canvasFactory: f.canvasFactory });
  assert.equal(
    adapter.resolve(f.base, INDUSTRIAL_ARCADE_COLLECTION).image('terrain.wall'),
    f.frame,
  );
  assert.equal(f.allocations(), 0);
  const uploadedCopy = fixture();
  uploadedCopy.frame.asset.id = 'terrain.wall.custom';
  const customAdapter = createArcadeAdapter({ canvasFactory: uploadedCopy.canvasFactory });
  assert.equal(
    customAdapter.resolve(uploadedCopy.base, INDUSTRIAL_ARCADE_COLLECTION).image('terrain.wall'),
    uploadedCopy.frame,
  );
  assert.equal(
    uploadedCopy.allocations(),
    0,
    'Explicit custom roles retain even byte-identical uploaded originals',
  );
  const broken = fixture(),
    failing = createArcadeAdapter({
      canvasFactory() {
        throw Error('unavailable');
      },
    });
  assert.equal(
    failing.resolve(broken.base, INDUSTRIAL_ARCADE_COLLECTION).image('terrain.wall'),
    broken.frame,
  );
});

test('changing the adapter revision retires cached canvases and preserves custom vehicle ownership', () => {
  const slot = 'enemy.border-patrol',
    f = fixture(undefined, slot),
    collection = getArcadeCollection('military-field'),
    adapter = createArcadeAdapter({ canvasFactory: f.canvasFactory, reviewRevision: null });
  try {
    const old = adapter.resolve(f.base, collection).image(slot);
    assert.notEqual(old.image, f.frame.image);
    assert.equal(old.geometry.machineryRevision, undefined);
    assert.equal(adapter.setReviewRevision('industrial-roster-v3'), true);
    assert.equal(old.image.width, 0);
    assert.equal(old.image.height, 0);
    const next = adapter.resolve(f.base, collection).image(slot);
    assert.notEqual(next.image, old.image);
    assert.equal(next.geometry.machineryRevision, 'industrial-roster-v3');
    assert.equal(next.asset, f.frame.asset);
    assert.equal(adapter.setReviewRevision('industrial-roster-v3'), false);
    assert.equal(adapter.resolve(f.base, collection).image(slot), next);
    assert.equal(adapter.setReviewRevision(null), true);
    assert.equal(next.image.width, 0);
    const restored = adapter.resolve(f.base, collection).image(slot);
    assert.notEqual(restored.image, next.image);
    assert.equal(restored.geometry.machineryRevision, undefined);
    assert.deepEqual(restored.geometry, old.geometry);
    assert.equal(f.frame.image.width, 16);

    for (const custom of [fixture('a'.repeat(64), slot), fixture(undefined, slot)]) {
      if (custom.frame.asset.file.sha256 !== 'a'.repeat(64))
        custom.frame.asset.id = `${slot}.custom`;
      for (const revision of ['industrial-roster-v3', null]) {
        adapter.setReviewRevision(revision);
        assert.equal(adapter.resolve(custom.base, collection).image(slot), custom.frame);
      }
    }
    assert.equal(f.allocations(), 3, 'Custom assets allocate no derived canvas');
  } finally {
    adapter.clear();
  }
});

test('Solo freezes selection at a new level and preserves source presentation identity', () => {
  const painter = new BoardPainter({}),
    base = fixture().base;
  let preferences = following;
  painter.setPresentation(base);
  painter.setArcadeProvider(() => preferences);
  painter.setLevel({}, { seed: 1 });
  assert.equal(painter.artSnapshot.appearance, getArcadeCollection('industrial-workshop', 'r2'));
  assert.equal(painter.presentation, base);
  preferences = { ...following, arcadeArt: 'authored' };
  assert.equal(painter.artSnapshot.appearance, getArcadeCollection('industrial-workshop', 'r2'));
  painter.setLevel({}, { seed: 2 });
  assert.equal(painter.artSnapshot, base);
  preferences = following;
  painter.setLevel({}, { seed: 1, arcadeCollection: null });
  assert.equal(painter.artSnapshot, base, 'Historical attempts explicitly preserve authored art');
  painter.dispose();
});

test('every current published builtin sprite is pinned without importing its manifest at runtime', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  for (const [slot, asset] of Object.entries(manifest.resolved.assets))
    if (
      INDUSTRIAL_ARCADE_COLLECTION.roles.includes(slot) &&
      asset.kind === 'image' &&
      asset.id.endsWith('.field-kit')
    )
      assert.ok(INDUSTRIAL_BUILTIN_SPRITES[slot]?.includes(asset.file.sha256), slot);
});

test('lost adapted sprites preserve source art and regenerate on restoration without leaking owners', () => {
  for (const slot of ['terrain.wall', 'enemy.border-patrol']) {
    const f = fixture(undefined, slot),
      lost = new Set();
    const adapter = createArcadeAdapter({
      canvasFactory: f.canvasFactory,
      onContextLoss: ({ owner }) => lost.add(owner),
      onContextRestored: ({ owner }) => {
        lost.delete(owner);
        if (!lost.size) adapter.clear();
      },
    });
    const collection = getArcadeCollection('military-field'),
      adapted = adapter.resolve(f.base, collection),
      before = adapted.image(slot),
      first = before.image;
    first.listeners.get('contextlost')();
    assert.equal(lost.size, 1);
    assert.equal(adapted.image(slot), f.frame, 'Loss retains a functional original body');
    first.listeners.get('contextrestored')();
    assert.equal(lost.size, 0);
    assert.equal(first.width, 0);
    assert.equal(first.listeners.size, 0);
    const restored = adapter.resolve(f.base, collection).image(slot);
    assert.notEqual(restored.image, first);
    assert.deepEqual(restored.geometry, before.geometry);
    assert.equal(restored.asset, before.asset);
    assert.equal(f.frame.image.width, 16, 'Shared source pixels remain owned by their release');
    restored.image.listeners.get('contextlost')();
    adapter.clear();
    assert.equal(lost.size, 0, 'Retired lost owners cannot block a later scene');
    assert.equal(restored.image.listeners.size, 0);
    assert.equal(restored.image.width, 0);
  }
});

test('BoardPainter forwards adapted context loss and invalidates derived pixels before reusing artwork', (t) => {
  const f = fixture(),
    original = globalThis.document,
    losses = [];
  globalThis.document = { createElement: () => f.canvasFactory() };
  t.after(() => {
    if (original === undefined) delete globalThis.document;
    else globalThis.document = original;
  });
  const painter = new BoardPainter({}, { onContextLoss: (event) => losses.push(event) });
  painter.arcadeCollection = INDUSTRIAL_ARCADE_COLLECTION;
  painter.setPresentation(f.base);
  const first = painter.artSnapshot.image('terrain.wall').image;
  first.listeners.get('contextlost')();
  assert.equal(losses.length, 1);
  assert.equal(losses[0].source, 'arcade-sprite');
  painter.invalidate();
  assert.equal(first.width, 0);
  assert.equal(first.listeners.size, 0);
  const second = painter.artSnapshot.image('terrain.wall').image;
  assert.notEqual(first, second);
  painter.dispose();
  assert.equal(second.width, 0);
});
