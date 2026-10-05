// Regression source only; automated suites remain explicitly waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Element } from './helpers/couch-dom.mjs';
import { pageActorArtPool } from '../presentation/actor-art-pool.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  isStudioActorSlot,
  studioActorCanvas,
} from '../../authoring/asset-studio/actor-resources.mjs';
import { croppedImage } from '../../authoring/asset-studio/scene-preview.mjs';
import { drawAssetPreview } from '../../authoring/asset-studio/preview.mjs';

class PreviewElement extends Element {
  constructor(doc, tag) {
    super(doc, tag);
    this.style.getPropertyValue = (key) => this.style[key] || '';
    this.style.removeProperty = (key) => delete this.style[key];
    this.draws = [];
  }
  getContext() {
    return {
      drawImage: (...args) => this.draws.push(args),
      getImageData: () => ({ data: new Uint8ClampedArray(this.width * this.height * 4) }),
      putImageData() {},
    };
  }
  toDataURL() {
    return 'data:image/png;base64,AA==';
  }
}
function globals(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (prior) Object.defineProperty(globalThis, key, prior);
      else delete globalThis[key];
    });
  }
}
function boundary(t, decode) {
  const document = new Document();
  document.createElement = (tag) => new PreviewElement(document, tag);
  globals(t, { document, createImageBitmap: decode });
  return { document, pool: pageActorArtPool(document) };
}
const asset = (frame = { x: 1, y: 1, width: 2, height: 2 }) => ({
  id: 'test-actor',
  kind: 'image',
  file: { sha256: 'c'.repeat(64), width: 4, height: 4 },
  geometry: { frame },
});
const bytes = (value) => new Map([[value.file.sha256, new Blob(['immutable artwork'])]]);
const options = { slotId: 'enemy.bouncer', isCurrent: () => true };
const settle = async () => {
  for (let index = 0; index < 16; index++) await Promise.resolve();
};

test('paired static actor contexts share the runtime original and crop identities', async (t) => {
  const calls = [],
    closes = [],
    { pool } = boundary(t, async (...args) => {
      calls.push(args);
      const cropped = args.length > 1;
      return {
        width: cropped ? args[3] : 4,
        height: cropped ? args[4] : 4,
        close: () => closes.push(cropped ? 'crop' : 'source'),
      };
    }),
    value = asset(),
    left = [],
    right = [];
  const [a, b] = await Promise.all([
    croppedImage(value, bytes(value), options, (release) => left.push(release)),
    croppedImage(value, bytes(value), options, (release) => right.push(release)),
  ]);
  assert.strictEqual(a, b);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].slice(1), [1, 1, 2, 2]);
  assert.equal(pool.stats().reservedBytes, 80);
  const nativeCrop = await pool.acquire({
    key: `${value.file.sha256}:1,1,2,2`,
    width: 2,
    height: 2,
    load: () => assert.fail('The native host must reuse the Studio crop.'),
  });
  assert.strictEqual(nativeCrop.image, a);
  left.forEach((release) => release());
  assert.deepEqual(closes, []);
  right.forEach((release) => release());
  assert.deepEqual(closes, ['source']);
  nativeCrop.release();
  assert.deepEqual(closes, ['source', 'crop']);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('full-frame sprites and animated atlases preserve their complete source without a crop', async (t) => {
  let calls = 0;
  const { pool } = boundary(t, async () => {
    calls++;
    return { width: 4, height: 4, close() {} };
  });
  for (const value of [asset({ x: 0, y: 0, width: 4, height: 4 }), { ...asset(), animation: {} }]) {
    const releases = [];
    const image = await croppedImage(value, bytes(value), options, (fn) => releases.push(fn));
    assert.equal(image.width, 4);
    assert.equal(pool.stats().reservedBytes, 64);
    releases.forEach((release) => release());
    assert.equal(pool.stats().reservedBytes, 0);
  }
  assert.equal(calls, 2);
});

test('cancelling a pending crop retains the original until the decoder releases it', async (t) => {
  let finish,
    sourceClosed = 0,
    cropClosed = 0;
  const { pool } = boundary(t, async (...args) =>
    args.length === 1
      ? { width: 4, height: 4, close: () => sourceClosed++ }
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const releases = [],
    value = asset(),
    pending = croppedImage(value, bytes(value), options, (fn) => releases.push(fn));
  await settle();
  releases.forEach((release) => release());
  assert.equal(sourceClosed, 0);
  assert.equal(pool.stats().reservedBytes, 80);
  finish({ width: 2, height: 2, close: () => cropClosed++ });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(sourceClosed, 1);
  assert.equal(cropClosed, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('actor accounting uses the actual registered slot, never a picture or terrain asset name', async (t) => {
  const { pool } = boundary(t, async () => ({ width: 4, height: 4, close() {} }));
  globals(t, {
    Image: class {
      async decode() {}
    },
  });
  assert.equal(isStudioActorSlot('enemy.bouncer'), true);
  assert.equal(isStudioActorSlot('team.core.shielded'), true);
  for (const slotId of ['terrain.wall', 'picture.example', 'enemy.unregistered']) {
    assert.equal(isStudioActorSlot(slotId), false);
    const value = { ...asset(), id: 'enemy.bouncer' };
    await croppedImage(value, bytes(value), { ...options, slotId }, () => {});
    assert.equal(pool.stats().reservedBytes, 0);
  }
});

test('native, enlarged and alpha actor previews account for distinct canvases and retire their backing stores', async (t) => {
  let sourceClosed = 0,
    cropClosed = 0;
  const { document, pool } = boundary(t, async (...args) =>
    args.length === 1
      ? { width: 4, height: 4, close: () => sourceClosed++ }
      : { width: 2, height: 2, close: () => cropClosed++ },
  );
  const resolved = resolvePresentation(createDefaultThemeBundle()),
    slot = { id: 'enemy.bouncer', group: 'enemies', label: 'Actor', sampling: 'nearest' },
    value = asset(),
    surfaces = [];
  for (const mode of ['native', 'enlarged', 'alpha']) {
    const surface = document.createElement('div');
    document.body.append(surface);
    await drawAssetPreview(surface, slot, value, resolved, bytes(value), {
      mode,
      background: 'checker',
      geometry: false,
    });
    const canvas = surface.children[0];
    assert.equal(canvas.tagName, 'CANVAS');
    assert.deepEqual(canvas.draws[0].slice(1, 5), [0, 0, 2, 2]);
    surfaces.push({ surface, canvas });
  }
  assert.equal(pool.stats().reservedBytes, 64 + 16 + 3 * 16);
  assert.equal(sourceClosed, 0);
  for (const { surface, canvas } of surfaces) {
    surface.previewCleanup();
    assert.equal(canvas.width, 0);
    assert.equal(canvas.height, 0);
  }
  assert.equal(sourceClosed, 1);
  assert.equal(cropClosed, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('output canvas admission refuses before allocation and a failed direct preview releases its source', async (t) => {
  let decoded = 0,
    closed = 0;
  const { document, pool } = boundary(t, async () => {
    decoded++;
    return { width: 32, height: 32, close: () => closed++ };
  });
  const filler = await pool.acquire({
    key: 'other-visible-actors',
    width: 1024,
    height: pool.stats().limit / 4096 - 1,
    load: () => ({ width: 1024, height: pool.stats().limit / 4096 - 1 }),
  });
  const before = pool.stats().reservedBytes,
    releases = [];
  await assert.rejects(
    studioActorCanvas(64, 64, options, (fn) => releases.push(fn)),
    /budget/,
  );
  assert.equal(pool.stats().reservedBytes, before);
  const surface = document.createElement('div'),
    value = asset({ x: 0, y: 0, width: 32, height: 32 });
  value.file.width = value.file.height = 32;
  document.body.append(surface);
  await drawAssetPreview(
    surface,
    { id: 'enemy.bouncer', group: 'enemies', label: 'Actor' },
    value,
    resolvePresentation(createDefaultThemeBundle()),
    bytes(value),
    { mode: 'native', geometry: false, background: 'checker' },
  );
  assert.equal(surface.children[0].tagName, 'P');
  assert.equal(decoded, 1);
  assert.equal(closed, 1);
  assert.equal(pool.stats().reservedBytes, before);
  filler.release();
  assert.equal(pool.stats().reservedBytes, 0);
});
