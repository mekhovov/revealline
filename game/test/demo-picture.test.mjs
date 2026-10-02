import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveDemoPicture,
  blurDemoPixels,
  concealDemoPixels,
  createDemoPictureFilter,
} from '../ui/demo-picture.mjs';
import { earnedPictureFixture } from './helpers/earned-picture-fixture.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createSessionPictureView } from '../presentation/session-picture-view.mjs';
import { emptyGenericMediaLibrary, hydrateStoredStillMedia } from '../media-storage-record.mjs';

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

async function retainWithoutAssignment(f) {
  const saved = await f.store.read();
  await f.store.commit(
    await f.store.prepare({ ...saved.document.library, assignments: [] }, saved.assets, {
      executionCatalog: f.catalog,
      previous: saved.document,
    }),
    { expectedGeneration: saved.generation },
  );
  f.metadata = await f.store.readMetadata();
}

test('an earned release original stays clear when its retained history has no persistent assignment', async () => {
  const f = await earnedPictureFixture('gentle');
  try {
    await retainWithoutAssignment(f);
    const profileBefore = JSON.stringify(f.profile),
      metadataBefore = JSON.stringify(f.metadata),
      acquired = [];
    let releases = 0;
    const options = {
      ...request(f, 'standard'),
      acquire: async ({ pin }) => {
        acquired.push(pin);
        return { image: { width: 1, height: 1 }, pin, release: () => releases++ };
      },
    };
    const result = await resolveDemoPicture(options);
    assert.equal(result.pictureVisibility, 'clear');
    assert.deepEqual(result.backdrop.pin, f.receipt.presentationPin);
    assert.deepEqual(acquired, [f.receipt.presentationPin]);
    assert.equal(
      result.artSeed,
      null,
      'A still uses its exact decoded original, not procedural art.',
    );
    assert.equal(JSON.stringify(f.profile), profileBefore);
    assert.equal(JSON.stringify(await f.store.readMetadata()), metadataBefore);
    result.dispose();
    result.dispose();
    assert.equal(releases, 1);

    const unearned = await resolveDemoPicture({ ...options, library: { gallery: [] } });
    assert.equal(unearned.pictureVisibility, 'blurred');
    assert.equal(unearned.backdrop, null);
    assert.equal(acquired.length, 1, 'Retained bytes alone never authorize an earned fallback.');
    const otherTheme = await resolveDemoPicture(request(f, 'standard', 'retro'));
    assert.equal(otherTheme.pictureVisibility, 'blurred');
    const foreign = structuredClone(f.profile);
    foreign.pictureReceipts[0].presentationPin.identity.baseCampaignKey += '-foreign';
    assert.equal(
      (await resolveDemoPicture({ ...options, library: foreign })).pictureVisibility,
      'blurred',
    );
    const explicitLegacy = await resolveDemoPicture({
      ...options,
      currentPin: { kind: 'legacy', identity: f.receipt.presentationPin.identity },
    });
    assert.equal(explicitLegacy.pictureVisibility, 'blurred');
    assert.equal(explicitLegacy.backdrop, null);
    assert.equal(
      acquired.length,
      1,
      'An explicit current choice cannot be replaced by an earned one.',
    );
  } finally {
    f.manager.close();
  }
});

test('earned-original fallback fails concealed and releases mismatched or cancelled acquisitions', async () => {
  const f = await earnedPictureFixture();
  try {
    await retainWithoutAssignment(f);
    for (const failure of ['wrong-pin', 'missing-image', 'decode-error']) {
      let releases = 0;
      const result = await resolveDemoPicture({
        ...request(f),
        acquire: async ({ pin }) => {
          if (failure === 'decode-error') throw new Error('Original unavailable');
          return {
            image: failure === 'missing-image' ? null : { width: 1, height: 1 },
            pin: failure === 'wrong-pin' ? { ...pin, sha256: '0'.repeat(64) } : pin,
            release: () => releases++,
          };
        },
      });
      assert.equal(result.pictureVisibility, 'blurred', failure);
      assert.equal(result.previewAvailable, false, failure);
      assert.equal(result.backdrop, null, failure);
      result.dispose();
      assert.equal(releases, failure === 'decode-error' ? 0 : 1);
    }

    const gate = deferred(),
      started = deferred(),
      controller = new AbortController();
    let releases = 0;
    const pending = resolveDemoPicture({
      ...request(f),
      signal: controller.signal,
      acquire: async ({ pin }) => {
        started.resolve();
        await gate.promise;
        return { image: { width: 1, height: 1 }, pin, release: () => releases++ };
      },
    });
    await started.promise;
    controller.abort();
    gate.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(releases, 1, 'An earned fallback cannot outlive its cancelled scene.');
  } finally {
    f.manager.close();
  }
});

test('earned session originals use their combined view adapter while explicit acquisition overrides stay authoritative', async () => {
  const f = await earnedPictureFixture();
  try {
    await retainWithoutAssignment(f);
    const media = {
      metadata: { generation: 0, document: hydrateStoredStillMedia(emptyGenericMediaLibrary()) },
      store: {
        readAsset: () => assert.fail('Session originals do not belong to the durable store.'),
      },
    };
    const before = JSON.stringify(media.metadata),
      profileBefore = JSON.stringify(f.profile),
      original = { width: 1, height: 1, sessionOriginal: true };
    let acquisitions = 0,
      releases = 0,
      wrongPin = false;
    const registry = {
      metadata: () => ({ scope: 'session', revision: 1, document: f.metadata.document }),
      has: (pin) => pin.presentationId === f.receipt.presentationPin.presentationId,
      acquire: async (pin) => {
        assert.deepEqual(pin, f.receipt.presentationPin);
        acquisitions++;
        return {
          image: original,
          pin: wrongPin ? { ...pin, sha256: '0'.repeat(64) } : pin,
          release: () => releases++,
        };
      },
    };
    const view = createSessionPictureView(media, registry),
      options = { ...request(f), readMedia: async () => view };
    delete options.acquire;
    const result = await resolveDemoPicture(options);
    assert.equal(result.pictureVisibility, 'clear');
    assert.equal(result.backdrop.image, original);
    assert.deepEqual(result.backdrop.pin, f.receipt.presentationPin);
    result.dispose();
    result.dispose();
    assert.equal(acquisitions, 1);
    assert.equal(releases, 1);
    assert.equal(JSON.stringify(media.metadata), before);
    assert.equal(JSON.stringify(f.profile), profileBefore);
    assert.equal(view.metadata.scope, 'durable-and-session');
    assert.equal(view.metadata.document.library.assignments.length, 0);

    wrongPin = true;
    const mismatch = await resolveDemoPicture(options);
    assert.equal(mismatch.pictureVisibility, 'blurred');
    assert.equal(mismatch.previewAvailable, false);
    assert.equal(mismatch.backdrop, null);
    assert.equal(releases, 2, 'The view adapter cannot authorize a different decoded original.');
    const overridden = await resolveDemoPicture({
      ...options,
      acquire: async () => {
        throw new Error('Explicit acquisition unavailable');
      },
    });
    assert.equal(overridden.pictureVisibility, 'blurred');
    assert.equal(overridden.previewAvailable, false);
    assert.equal(overridden.backdrop, null);
    assert.equal(
      acquisitions,
      2,
      'Failure of the explicit adapter cannot fall through to the view.',
    );
  } finally {
    f.manager.close();
  }
});

test('only the exact earned assignment reveals a picture, including shared Standard/Gentle identity', async () => {
  const f = await earnedPictureFixture('gentle');
  try {
    const before = JSON.stringify(f.profile);
    const result = await resolveDemoPicture(request(f, 'standard'));
    assert.equal(result.pictureVisibility, 'clear');
    assert.equal(result.backdrop.pin.sha256, f.receipt.presentationPin.sha256);
    assert.equal(result.previewAvailable, true);
    assert.equal(JSON.stringify(f.profile), before);
    result.dispose();
    const unearned = await resolveDemoPicture({ ...request(f), library: { gallery: [] } });
    assert.equal(unearned.pictureVisibility, 'blurred');
    assert.equal(
      unearned.previewAvailable,
      true,
      'A verified unearned original permits an explicit demo preview.',
    );
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
    assert.equal(result.previewAvailable, true);
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

test('preview eligibility requires installed identity and verified art without granting an earned picture', async () => {
  const f = await earnedPictureFixture();
  try {
    const base = { ...request(f), library: { gallery: [] } };
    const before = JSON.stringify({ profile: f.profile, metadata: f.metadata });
    const legacy = await resolveDemoPicture({ ...base, readMedia: undefined });
    assert.equal(
      legacy.previewAvailable,
      true,
      'An installed procedural original is also a valid preview.',
    );
    assert.equal(legacy.pictureVisibility, 'blurred');
    assert.equal(legacy.backdrop, null);
    legacy.dispose();
    const foreign = structuredClone(f.receipt.presentationPin);
    foreign.identity.themeId = 'retro';
    const cases = [
      { entries: [] },
      { level: { ...base.level, revision: 'uninstalled-revision' } },
      { currentPin: foreign },
      {
        readMedia: async () => {
          throw Error('Unavailable');
        },
      },
      {
        acquire: async () => {
          throw Error('Decode failure');
        },
      },
      { acquire: async ({ pin }) => ({ pin, image: null, release() {} }) },
    ];
    for (const invalid of cases) {
      const picture = await resolveDemoPicture({ ...base, ...invalid });
      assert.equal(picture.previewAvailable, false);
      assert.equal(picture.pictureVisibility, 'blurred');
      assert.equal(picture.backdrop, null);
      picture.dispose();
    }
    assert.equal(JSON.stringify({ profile: f.profile, metadata: f.metadata }), before);
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
    assert.ok(output[(24 * 64 + x) * 4] >= 102 && output[(24 * 64 + x) * 4] <= 153);
  assert.throws(() => blurDemoPixels(pixels, 1, 1));
});

test('the box blur preserves analytic edge-clamped averages with wide kernels and repeated passes', () => {
  const red = [0, 30, 90, 120, 180, 240],
    pixels = new Uint8ClampedArray(
      red.flatMap((value, index) => [value, 255 - value, index < 3 ? 0 : 255, 255]),
    ),
    before = pixels.slice();
  // These small 3×2 averages are calculated with repeated edge pixels and
  // rounding after each horizontal/vertical pass, independently of a window.
  for (const [radius, passes, expectedRed, expectedBlue] of [
    [1, 1, [53, 87, 120, 97, 133, 170], [85, 170]],
    [4, 1, [93, 104, 115, 107, 119, 131], [113, 142]],
    [1, 2, [79, 102, 125, 94, 118, 142], [113, 142]],
  ]) {
    const expected = new Uint8ClampedArray(
      expectedRed.flatMap((value, index) => [
        value,
        255 - value,
        expectedBlue[index < 3 ? 0 : 1],
        255,
      ]),
    );
    assert.deepEqual(blurDemoPixels(pixels, 3, 2, radius, passes), expected);
  }
  assert.deepEqual(pixels, before);
  const single = new Uint8ClampedArray([13, 80, 181, 73]);
  assert.deepEqual(blurDemoPixels(single, 1, 1, 32, 4), single);
});

function landmarkPixels(width, height) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4,
        detail = (x + y) % 2 ? 32 : -32;
      pixels[index] = (x < width / 2 ? 48 : 208) + detail;
      pixels[index + 1] = (y < height / 2 ? 48 : 208) + detail;
      pixels[index + 2] = 96 + detail;
      pixels[index + 3] = 255;
    }
  return pixels;
}

function channelMean(pixels, channel) {
  let sum = 0;
  for (let index = channel; index < pixels.length; index += 4) sum += pixels[index];
  return sum / (pixels.length / 4);
}

function regionMean(pixels, width, height, channel, contains) {
  let sum = 0,
    count = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (contains(x, y)) {
        sum += pixels[(y * width + x) * 4 + channel];
        count++;
      }
  return sum / count;
}

function landmarkContrast(pixels, width, height, channel) {
  const coordinate = channel === 0 ? (x) => x / width : (_, y) => y / height;
  return (
    regionMean(pixels, width, height, channel, (x, y) => coordinate(x, y) >= 0.75) -
    regionMean(pixels, width, height, channel, (x, y) => coordinate(x, y) < 0.25)
  );
}

function checkerAmplitude(pixels, width, height) {
  let projected = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      projected += pixels[(y * width + x) * 4 + 2] * ((x + y) % 2 ? 1 : -1);
  return Math.abs(projected / (width * height));
}

test('the weak signal retains subdued scene composition while obscuring original fine detail', () => {
  const width = 160,
    height = 120,
    pixels = landmarkPixels(width, height),
    before = pixels.slice(),
    output = concealDemoPixels(pixels, width, height),
    gentle = blurDemoPixels(pixels, width, height);
  assert.deepEqual(pixels, before, 'Concealment never mutates the earned original.');
  assert.deepEqual(
    concealDemoPixels(pixels, width, height),
    output,
    'The teaser is deterministic.',
  );
  for (const channel of [0, 1]) {
    const originalContrast = landmarkContrast(pixels, width, height, channel),
      retainedContrast = landmarkContrast(output, width, height, channel);
    assert.ok(landmarkContrast(gentle, width, height, channel) > originalContrast * 0.9);
    assert.ok(retainedContrast > originalContrast * 0.1, 'Broad scene shapes remain perceptible.');
    assert.ok(retainedContrast < originalContrast * 0.9, 'The signal subdues original contrast.');
  }
  assert.ok(
    checkerAmplitude(output, width, height) < checkerAmplitude(pixels, width, height) * 0.25,
    'Source checker detail is attenuated; intentional signal grain need not be smooth.',
  );
  let changed = 0;
  for (let index = 0; index < pixels.length; index += 4)
    if ([0, 1, 2].some((channel) => pixels[index + channel] !== output[index + channel])) changed++;
  assert.ok(
    changed / (width * height) > 0.75,
    'Source picture detail is not copied into a teaser.',
  );
  assert.notDeepEqual(output, gentle, 'Signal interference adds concealment beyond simple blur.');
});

test('different scene compositions produce different recognizable signal impressions', () => {
  const width = 160,
    height = 120,
    pixels = landmarkPixels(width, height),
    expected = concealDemoPixels(pixels, width, height),
    count = width * height;
  for (const [name, sourceIndex] of [
    [
      'horizontal reflection',
      (index) => Math.floor(index / width) * width + width - 1 - (index % width),
    ],
    ['180-degree rotation', (index) => count - 1 - index],
    ['cyclic pixel permutation', (index) => (index + 517) % count],
  ]) {
    const rearranged = new Uint8ClampedArray(pixels.length);
    for (let index = 0; index < count; index++) {
      const source = sourceIndex(index) * 4;
      rearranged.set(pixels.subarray(source, source + 4), index * 4);
    }
    assert.notDeepEqual(rearranged, pixels, `${name} actually changes the source composition.`);
    const result = concealDemoPixels(rearranged, width, height);
    assert.notDeepEqual(
      result,
      expected,
      `${name} must change the scene impression instead of retaining only a palette.`,
    );
    if (name !== 'cyclic pixel permutation')
      assert.ok(
        landmarkContrast(result, width, height, 0) < 0,
        'A reflected left/right landmark remains reflected underneath interference.',
      );
  }
});

test('muted broad color distinguishes warm and cool pictures without restoring full chroma', () => {
  const width = 79,
    height = 53,
    warm = new Uint8ClampedArray(width * height * 4),
    cool = new Uint8ClampedArray(warm.length);
  for (let index = 0; index < warm.length; index += 4) {
    const shade = (index / 4) % 4;
    warm.set([176 + shade * 20, 48 + shade * 16, 24 + shade * 8, 255], index);
    cool.set([24 + shade * 8, 48 + shade * 16, 176 + shade * 20, 255], index);
  }
  const warmResult = concealDemoPixels(warm, width, height),
    coolResult = concealDemoPixels(cool, width, height);
  for (const [source, result, first, second] of [
    [warm, warmResult, 0, 2],
    [cool, coolResult, 2, 0],
  ]) {
    const originalChroma = channelMean(source, first) - channelMean(source, second),
      retainedChroma = channelMean(result, first) - channelMean(result, second);
    assert.ok(retainedChroma > originalChroma * 0.27, 'Broad palette remains recognizable.');
    assert.ok(retainedChroma < originalChroma * 0.43, 'Most original chroma remains suppressed.');
  }
  assert.ok(channelMean(warmResult, 0) - channelMean(coolResult, 0) > 12);
  assert.notDeepEqual(warmResult, coolResult, 'Different source luminance survives color loss.');
});

test('equally lit pictures keep distinct subdued palettes, not only different brightness', () => {
  const width = 96,
    height = 72;
  const results = [
    [180, 70, 45],
    [45, 105, 120],
  ].map((palette) => {
    const source = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < source.length; index += 4) source.set([...palette, 255], index);
    return concealDemoPixels(source, width, height);
  });
  const luma = (pixels) =>
    0.2126 * channelMean(pixels, 0) +
    0.7152 * channelMean(pixels, 1) +
    0.0722 * channelMean(pixels, 2);
  assert.ok(Math.abs(luma(results[0]) - luma(results[1])) < 4);
  assert.ok(channelMean(results[0], 0) - channelMean(results[0], 2) > 35);
  assert.ok(channelMean(results[1], 2) - channelMean(results[1], 0) > 20);
});

test('transparent picture silhouettes cannot survive through the concealed alpha channel', () => {
  const width = 63,
    height = 47,
    pixels = new Uint8ClampedArray(width * height * 4),
    reflected = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      pixels.set([200, 180, 160, x < width / 2 ? 0 : 255], index);
      reflected.set(pixels.subarray(index, index + 4), (y * width + width - 1 - x) * 4);
    }
  for (const source of [pixels, reflected]) {
    const result = concealDemoPixels(source, width, height);
    for (let index = 3; index < result.length; index += 4)
      assert.equal(result[index], 255, 'The original alpha mask never reaches the picture layer.');
  }
});

test('concealment supports tiny and nondivisible images and rejects invalid pixel bounds', () => {
  for (const [width, height] of [
    [1, 1],
    [1, 7],
    [7, 1],
    [13, 7],
    [255, 253],
    [512, 512],
  ]) {
    const pixels = landmarkPixels(width, height),
      before = pixels.slice(),
      output = concealDemoPixels(pixels, width, height);
    assert.ok(output instanceof Uint8ClampedArray);
    assert.equal(output.length, pixels.length);
    assert.deepEqual(pixels, before);
    assert.deepEqual(concealDemoPixels(pixels, width, height), output);
  }
  for (const [width, height] of [
    [0, 1],
    [1, 0],
    [-1, 1],
    [1.5, 1],
    [513, 1],
    [1, 513],
  ])
    assert.throws(
      () =>
        concealDemoPixels(new Uint8ClampedArray(Math.max(0, width * height * 4)), width, height),
      TypeError,
    );
  assert.throws(() => concealDemoPixels(new Uint8Array(4), 1, 1), TypeError);
  assert.throws(() => concealDemoPixels(new Uint8ClampedArray(8), 1, 1), TypeError);
});

function canvasFactory(created = []) {
  return () => {
    const canvas = { width: 0, height: 0 };
    const context = {
      drawImage(image) {
        canvas.original = image;
      },
      getImageData() {
        if (canvas.original.pixels) {
          assert.equal(canvas.original.width, canvas.width);
          assert.equal(canvas.original.height, canvas.height);
          return { data: canvas.original.pixels.slice() };
        }
        return { data: new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(127) };
      },
      putImageData(pixels) {
        canvas.filtered = true;
        canvas.pixels = pixels.data.slice();
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
  assert.equal(blurred.width, 512);
  assert.equal(blurred.height, 256);
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

test('an unreadable source is quarantined until replacement or explicit cache reset', () => {
  let reads = 0;
  const factory = canvasFactory();
  const filter = createDemoPictureFilter({
    canvasFactory() {
      const canvas = factory(),
        context = canvas.getContext();
      context.getImageData = () => {
        reads++;
        throw Error('Unreadable');
      };
      return canvas;
    },
  });
  const source = { width: 128, height: 96 };
  for (let frame = 0; frame < 60; frame++)
    assert.equal(filter.select(source, 'blurred', { animate: true, time: frame }), null);
  assert.equal(reads, 1, 'Failed readback must not allocate and retry every animation frame.');
  filter.select({ ...source }, 'blurred');
  assert.equal(reads, 2, 'A replacement image gets its own preparation attempt.');
  filter.clear();
  filter.select(source, 'blurred');
  assert.equal(reads, 3);
});

test('the cached picture filter presents concealed pixels while clear pictures retain their original', () => {
  const created = [],
    filter = createDemoPictureFilter({ canvasFactory: canvasFactory(created) }),
    original = { width: 160, height: 120, pixels: landmarkPixels(160, 120) },
    before = original.pixels.slice(),
    concealed = filter.select(original, 'blurred');
  assert.ok(concealed);
  assert.notEqual(concealed, original);
  assert.deepEqual(concealed.pixels, concealDemoPixels(before, original.width, original.height));
  assert.notDeepEqual(concealed.pixels, blurDemoPixels(before, original.width, original.height));
  const shown = concealed.pixels.slice();
  for (let frame = 0; frame < 20; frame++) {
    assert.equal(filter.select(original, 'blurred'), concealed);
    assert.deepEqual(
      concealed.pixels,
      shown,
      'Static/reduced-effects selection remains unchanged.',
    );
  }
  assert.equal(created.length, 1, 'Repeated frames reuse one prepared bitmap.');
  assert.equal(filter.select(original, 'clear'), original);
  assert.deepEqual(original.pixels, before);
});

test('receiver snow is monochrome with localized horizontal impulse streaks', () => {
  const width = 256,
    height = 192;
  const neutral = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < neutral.length; i += 4) neutral.set([128, 128, 128, 255], i);
  const output = concealDemoPixels(neutral, width, height),
    mean = channelMean(output, 0);
  let variance = 0,
    longest = 0;
  for (let y = 0; y < height; y++) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        residual = output[i] - mean;
      assert.equal(output[i], output[i + 1]);
      assert.equal(output[i], output[i + 2]);
      variance += residual * residual;
      run = residual < -40 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  assert.ok(variance / (width * height) > 150, 'Receiver snow has visible fine texture.');
  assert.ok(longest >= 6, 'Dropouts cluster into horizontal streaks rather than independent dots.');
});

test('animated snow reuses its bitmap, freezes by time and keeps concealed geometry across frames', () => {
  const created = [],
    filter = createDemoPictureFilter({ canvasFactory: canvasFactory(created) });
  const original = { width: 160, height: 120, pixels: landmarkPixels(160, 120) };
  const before = original.pixels.slice(),
    bitmap = filter.select(original, 'blurred');
  const staticFrame = bitmap.pixels.slice(),
    means = [];
  for (let frame = 1; frame <= 24; frame++) {
    assert.equal(filter.select(original, 'blurred', { animate: true, time: frame / 12 }), bitmap);
    assert.notDeepEqual(
      bitmap.pixels,
      staticFrame,
      'Noise evolves while the picture stays concealed.',
    );
    assert.ok(
      checkerAmplitude(bitmap.pixels, 160, 120) < 8,
      'No animated frame restores fine detail.',
    );
    means.push(channelMean(bitmap.pixels, 0));
  }
  assert.ok(Math.max(...means) - Math.min(...means) < 2, 'No full-frame brightness flash.');
  const frozen = bitmap.pixels.slice();
  filter.select(original, 'blurred', { animate: true, time: 2.01 });
  assert.deepEqual(bitmap.pixels, frozen, 'Noise is bounded to 12 updates per second.');
  filter.select(original, 'blurred', { animate: false, time: 100 });
  assert.deepEqual(bitmap.pixels, staticFrame, 'Reduced effects selects a stable concealed frame.');
  assert.equal(created.length, 1, 'Long-running interference cannot accumulate canvas resources.');
  assert.deepEqual(original.pixels, before);
  filter.clear();
  assert.equal(bitmap.width, 0);
});

test('demo noise evolves independently for pictures with different broad palettes', () => {
  const width = 96,
    height = 72;
  const deltas = [
    [180, 70, 45],
    [45, 105, 120],
  ].map((palette) => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < pixels.length; index += 4) pixels.set([...palette, 255], index);
    const image = { width, height, pixels },
      filter = createDemoPictureFilter({ canvasFactory: canvasFactory() }),
      bitmap = filter.select(image, 'blurred'),
      before = bitmap.pixels.slice();
    filter.select(image, 'blurred', { animate: true, time: 1 / 12 });
    const delta = Array.from(
      { length: width * height },
      (_, index) => bitmap.pixels[index * 4] - before[index * 4],
    );
    filter.clear();
    return delta;
  });
  const changed = deltas[0].filter((value, index) => value !== deltas[1][index]).length;
  assert.ok(
    changed / (width * height) > 0.85,
    'One shared fixed noise texture does not mask every picture.',
  );
});

test('muted color never restores source chromatic detail, including by averaging animated frames', () => {
  const width = 96,
    height = 72,
    pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      pixels.set((x + y) % 2 ? [200, 100, 56, 255] : [56, 100, 200, 255], (y * width + x) * 4);
  const projection = (data) => {
    let total = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        total += (data[index] - data[index + 2]) * ((x + y) % 2 ? 1 : -1);
      }
    return Math.abs(total / (width * height));
  };
  assert.equal(projection(pixels), 144);
  const image = { width, height, pixels },
    filter = createDemoPictureFilter({ canvasFactory: canvasFactory() }),
    average = new Float64Array(pixels.length);
  for (let frame = 0; frame < 24; frame++) {
    const bitmap = filter.select(image, 'blurred', { animate: true, time: frame / 12 });
    assert.ok(projection(bitmap.pixels) < 2);
    for (let index = 0; index < average.length; index++)
      average[index] += bitmap.pixels[index] / 24;
  }
  assert.ok(
    projection(average) < 2,
    'Averaging receiver snow cannot reconstruct concealed color detail.',
  );
  const reduced = filter.select(image, 'blurred', { animate: false, time: 500 });
  assert.ok(projection(reduced.pixels) < 2);
  filter.clear();
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
  let assetCallbacks = 0,
    statusCallbacks = 0;
  const painter = new BoardPainter(presets, {
    pictureCanvasFactory: canvasFactory(),
    onAsset() {
      assetCallbacks++;
    },
    onAssetStatus() {
      statusCallbacks++;
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
  const statusAtDisposal = statusCallbacks;
  assert.equal(filtered.width, 0);
  for (const image of pendingImages) image.onload();
  await pending;
  assert.equal(assetCallbacks, 0);
  assert.equal(statusCallbacks, statusAtDisposal);
  assert.equal(painter.theme, null);
  assert.equal(painter.background, null);
  assert.equal(painter.image, null);
  assert.deepEqual(painter.images, {});
});
