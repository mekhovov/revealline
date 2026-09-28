import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveDemoPicture,
  blurDemoPixels,
  createDemoPictureFilter,
} from '../ui/demo-picture.mjs';
import { earnedPictureFixture } from './helpers/earned-picture-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function request(f, mode = 'standard', themeId = 'fpv') {
  const entry = f.entries.find((item) => item.difficulty === mode);
  return {
    entry,
    level: entry.campaign.levels[0],
    theme: entry.themes.find((item) => item.id === themeId),
    library: f.profile,
    entries: f.entries,
    readMedia: async () => ({ store: f.store, metadata: f.metadata }),
    acquire: async ({ pin }) => ({
      image: { width: 1, height: 1 },
      fit: 'contain',
      pin,
      release() {},
    }),
  };
}

test('only the exact earned assignment reveals a picture, including shared Standard/Gentle identity', async () => {
  const f = await earnedPictureFixture('gentle');
  try {
    const before = JSON.stringify(f.profile);
    const result = await resolveDemoPicture(request(f, 'standard'));
    assert.equal(result.pictureVisibility, 'clear');
    assert.equal(result.backdrop.pin.sha256, f.receipt.presentationPin.sha256);
    assert.equal(JSON.stringify(f.profile), before);
    result.dispose();
    const unearned = await resolveDemoPicture({ ...request(f), library: { gallery: [] } });
    assert.equal(unearned.pictureVisibility, 'blurred');
    assert.ok(
      unearned.backdrop,
      'the actual unearned art is available only to the protected renderer',
    );
    unearned.dispose();
    const otherTheme = await resolveDemoPicture(request(f, 'standard', 'retro'));
    assert.equal(otherTheme.pictureVisibility, 'blurred');
    otherTheme.dispose();
  } finally {
    f.manager.close();
  }
});

test('a later current assignment stays blurred even when its map has an earned older original', async () => {
  const f = await earnedPictureFixture();
  try {
    const edited = structuredClone(f.metadata.document.library);
    edited.presentations.push({ ...edited.presentations[0], revision: 2 });
    edited.assignments[0].revision = 2;
    const saved = await f.store.read();
    await f.store.commit(
      await f.store.prepare(edited, saved.assets, {
        executionCatalog: f.catalog,
        previous: saved.document,
      }),
      { expectedGeneration: saved.generation },
    );
    f.metadata = await f.store.readMetadata();
    const result = await resolveDemoPicture(request(f));
    assert.equal(result.backdrop.pin.presentationRevision, 2);
    assert.equal(result.pictureVisibility, 'blurred');
    result.dispose();
  } finally {
    f.manager.close();
  }
});

test('implicit earned legacy originals use the retained art seed and exact installed owner', async () => {
  const f = await earnedPictureFixture();
  try {
    const options = request(f, 'gentle');
    delete options.readMedia;
    options.library = { gallery: [{ ...f.item, seed: 912 }], pictureReceipts: [] };
    const result = await resolveDemoPicture(options);
    assert.equal(result.pictureVisibility, 'clear');
    assert.equal(result.artSeed, 912);
    assert.equal(result.backdrop, null);
    const changed = { ...options, library: structuredClone(options.library) };
    changed.library.gallery[0].campaignKey += '-foreign';
    assert.equal((await resolveDemoPicture(changed)).pictureVisibility, 'blurred');
    assert.equal(
      (await resolveDemoPicture({ ...options, entries: [] })).pictureVisibility,
      'blurred',
    );
  } finally {
    f.manager.close();
  }
});

test('read failures, foreign pins and invalid earned receipts never authorize clear artwork', async () => {
  const f = await earnedPictureFixture();
  try {
    const base = request(f);
    assert.equal(
      (
        await resolveDemoPicture({
          ...base,
          readMedia: async () => {
            throw Error('Offline');
          },
        })
      ).pictureVisibility,
      'blurred',
    );
    const foreign = structuredClone(f.receipt.presentationPin);
    foreign.identity.themeId = 'retro';
    assert.equal(
      (await resolveDemoPicture({ ...base, currentPin: foreign })).pictureVisibility,
      'blurred',
    );
    const library = structuredClone(f.profile);
    library.pictureReceipts[0].presentationPin.identity.baseCampaignKey += '-foreign';
    const result = await resolveDemoPicture({ ...base, library });
    assert.equal(result.pictureVisibility, 'blurred');
    result.dispose();
  } finally {
    f.manager.close();
  }
});

test('cancelled late acquisition releases its bitmap, and resolved ownership disposes once', async () => {
  const f = await earnedPictureFixture(),
    gate = deferred(),
    controller = new AbortController();
  let releases = 0;
  try {
    const options = {
      ...request(f),
      signal: controller.signal,
      acquire: async ({ pin }) => {
        await gate.promise;
        return {
          image: {},
          pin,
          release() {
            releases++;
          },
        };
      },
    };
    const pending = resolveDemoPicture(options);
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    gate.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(releases, 1);
    const result = await resolveDemoPicture({ ...options, signal: undefined });
    result.dispose();
    result.dispose();
    assert.equal(releases, 2);
  } finally {
    f.manager.close();
  }
});

test('blur reduces real high-frequency detail without modifying its source pixels', () => {
  const pixels = new Uint8ClampedArray(64 * 48 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i + 1] = pixels[i + 2] = (i / 4) % 2 ? 255 : 0;
    pixels[i + 3] = 255;
  }
  const before = pixels.slice(),
    output = blurDemoPixels(pixels, 64, 48);
  assert.deepEqual(pixels, before);
  for (let x = 20; x < 44; x++)
    assert.ok(output[(24 * 64 + x) * 4] > 110 && output[(24 * 64 + x) * 4] < 145);
  assert.throws(() => blurDemoPixels(pixels, 1, 1));
});

function canvasFactory(created = []) {
  return () => {
    const canvas = { width: 0, height: 0 };
    const context = {
      drawImage(image) {
        canvas.original = image;
      },
      getImageData() {
        return { data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(127) };
      },
      putImageData() {
        canvas.filtered = true;
      },
    };
    canvas.getContext = () => context;
    created.push(canvas);
    return canvas;
  };
}
test('filter caches one bounded blurred source and fails closed for undecoded/unreadable replacements', () => {
  const created = [],
    filter = createDemoPictureFilter({ canvasFactory: canvasFactory(created) });
  const original = { width: 2000, height: 1000 };
  const blurred = filter.select(original, 'blurred');
  assert.equal(blurred.width, 96);
  assert.equal(blurred.height, 48);
  assert.equal(blurred.filtered, true);
  assert.notEqual(blurred, original);
  assert.equal(filter.select(original, 'blurred'), blurred);
  assert.equal(created.length, 1);
  assert.equal(filter.select(original), original);
  assert.equal(filter.select({ width: 0, height: 0 }, 'blurred'), null);
  assert.equal(blurred.width, 0, 'previous decoded cache is released');
  const failed = createDemoPictureFilter({
    canvasFactory() {
      throw Error('No canvas');
    },
  });
  assert.equal(failed.select(original, 'blurred'), null);
  assert.throws(() => failed.select(original, 'misspelled'));
});

function surface() {
  const calls = [],
    stack = [],
    state = { globalAlpha: 1 };
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: 600 } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ key, args });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') Object.assign(state, stack.pop());
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

test('actual painter protects first frame, late backdrop, victory and gallery while leaving the player sharp', async () => {
  const f = await earnedPictureFixture();
  try {
    const presets = JSON.parse(
      readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
    );
    const theme = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url)))
      .themes[0];
    const run = createRun(f.entries[0].campaign.levels[0]);
    const painter = new BoardPainter(presets, { pictureCanvasFactory: canvasFactory() });
    painter.theme = theme;
    painter.body = presets.characters['neutral-marker'];
    painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
    const original = { width: 384, height: 288 },
      actor = { width: 32, height: 32 };
    painter.background = original;
    painter.image = actor;
    const first = surface(),
      before = authoritativeCheckpoint(run);
    painter.draw(first.ctx, run, 0, { pictureVisibility: 'blurred' });
    assert.ok(!first.calls.some((c) => c.key === 'drawImage' && c.args[0] === original));
    assert.ok(first.calls.some((c) => c.key === 'drawImage' && c.args[0] === actor));
    assert.deepEqual(authoritativeCheckpoint(run), before);
    const late = { width: 768, height: 576 },
      second = surface();
    painter.draw(second.ctx, run, 0, {
      pictureVisibility: 'blurred',
      backdrop: { image: late, fit: 'contain' },
    });
    assert.ok(!second.calls.some((c) => c.key === 'drawImage' && c.args[0] === late));
    for (let i = 0; i < 1000 && run.status === 'running'; i++)
      stepRun(run, { direction: 'down' }, FIXED_DT);
    assert.equal(run.status, 'won');
    const win = surface();
    for (let i = 0; i < 100; i++)
      painter.draw(win.ctx, run, 0.1, { fullReveal: true, pictureVisibility: 'blurred' });
    assert.ok(!win.calls.some((c) => c.key === 'drawImage' && c.args[0] === original));
    const gallery = surface();
    painter.drawGallery(gallery.ctx, { image: original, pictureVisibility: 'blurred' });
    assert.ok(!gallery.calls.some((c) => c.key === 'drawImage' && c.args[0] === original));
    const ordinary = surface();
    painter.drawGallery(ordinary.ctx, { image: original });
    assert.equal(ordinary.calls.find((c) => c.key === 'drawImage').args[0], original);
  } finally {
    f.manager.close();
  }
});

test('disposing a painter clears its blur cache and rejects late setLook asset adoption', async (t) => {
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const pendingImages = [];
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      width = 64;
      height = 64;
      constructor() {
        pendingImages.push(this);
      }
      set src(value) {
        this.source = value;
      }
    },
  });
  t.after(() => {
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage);
    else delete globalThis.Image;
  });
  const presets = JSON.parse(
    readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
  );
  const theme = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url)))
    .themes[0];
  let assetCallbacks = 0;
  const painter = new BoardPainter(presets, {
    pictureCanvasFactory: canvasFactory(),
    onAsset() {
      assetCallbacks++;
    },
  });
  painter.makeArt = () => ({ width: 384, height: 288 });
  const pending = painter.setLook(theme, 'fpv-body', {
    background: { dataUrl: 'data:image/png;base64,fixture' },
  });
  assert.ok(pendingImages.length > 0);
  const filtered = painter.pictureFilter.select(painter.background, 'blurred');
  assert.ok(filtered.width > 0);
  painter.dispose();
  painter.dispose();
  assert.equal(filtered.width, 0);
  for (const image of pendingImages) image.onload();
  await pending;
  assert.equal(assetCallbacks, 0);
  assert.equal(painter.theme, null);
  assert.equal(painter.background, null);
  assert.equal(painter.image, null);
  assert.deepEqual(painter.images, {});
});
