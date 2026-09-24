import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { prepareCreatorImage, CREATOR_IMAGE_LIMITS } from '../creator/image.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';

const png = (width, height) =>
  new Blob([
    encodeSpritePNG({ width, height, rgba: new Uint8Array(width * height * 4).fill(120) }),
  ]);
const options = { alt: 'A portrait', fit: 'contain' };
function browserModel(width = 10, height = 20) {
  const draws = [],
    canvases = [],
    bitmap = {
      width,
      height,
      closed: 0,
      close() {
        this.closed++;
      },
    };
  return {
    bitmap,
    draws,
    canvases,
    decodeBitmap: async (_blob, settings) => {
      assert.deepEqual(settings, { imageOrientation: 'from-image' });
      return bitmap;
    },
    createCanvas: () => {
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ fillRect() {}, drawImage: (...args) => draws.push(args.slice(1)) }),
        toBlob(callback) {
          callback(png(this.width, this.height));
        },
      };
      canvases.push(canvas);
      return canvas;
    },
  };
}
test('portrait preparation creates separately pinned runtime and thumbnail bytes and releases pixels', async () => {
  const model = browserModel();
  const original = png(10, 20);
  const result = await prepareCreatorImage(original, options, model);
  assert.equal(result.asset.width, 1280);
  assert.equal(result.asset.height, 640);
  assert.deepEqual(model.draws[0], [480, 0, 320, 640]);
  assert.equal(result.runtime.sha256, await creatorSHA256(await result.runtime.blob.arrayBuffer()));
  assert.equal(result.original.sha256, await creatorSHA256(await original.arrayBuffer()));
  assert.notEqual(result.original.sha256, result.runtime.sha256);
  assert.notEqual(result.thumbnail.sha256, result.runtime.sha256);
  assert.equal(model.bitmap.closed, 1);
  assert.ok(model.canvases.every((c) => c.width === 0 && c.height === 0));
});
test('oriented dimensions drive reviewed fit and fill without changing the original', async () => {
  const model = browserModel(20, 10);
  await prepareCreatorImage(png(10, 20), { ...options, fit: 'cover' }, model);
  assert.deepEqual(model.draws[0], [0, 0, 1280, 640]);
  const portrait = browserModel();
  await prepareCreatorImage(png(10, 20), { ...options, fit: 'cover' }, portrait);
  assert.deepEqual(portrait.draws[0], [0, -960, 1280, 2560]);
});
test('invalid and oversized original bytes are rejected before pixel allocation, regardless of claimed MIME or size', async () => {
  let decoded = 0;
  const decodeBitmap = () => {
    decoded++;
    throw new Error('Should not decode');
  };
  await assert.rejects(
    prepareCreatorImage(new Blob(['not a PNG'], { type: 'image/png' }), options, { decodeBitmap }),
    /Cannot use/,
  );
  const oversized = new Blob([new Uint8Array(CREATOR_IMAGE_LIMITS.sourceBytes + 1)]);
  Object.defineProperty(oversized, 'size', { value: 1 });
  await assert.rejects(prepareCreatorImage(oversized, options, { decodeBitmap }), /byte budget/);
  await assert.rejects(
    prepareCreatorImage(
      {
        size: 10,
        arrayBuffer() {
          throw new Error('getter');
        },
      },
      options,
    ),
    /native/,
  );
  assert.equal(decoded, 0);
});
test('cancellation and timeout close a bitmap that completes after the caller has stopped waiting', async () => {
  for (const cancel of [true, false]) {
    let finish, started;
    const ready = new Promise((resolve) => {
      started = resolve;
    });
    const controller = new AbortController();
    const model = browserModel();
    const pending = prepareCreatorImage(png(10, 20), options, {
      ...model,
      signal: controller.signal,
      timeoutMs: cancel ? 1000 : 30,
      decodeBitmap: () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    });
    await ready;
    if (cancel) controller.abort();
    await assert.rejects(pending, cancel ? { name: 'AbortError' } : /timed out/);
    finish(model.bitmap);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(model.bitmap.closed, 1);
    assert.equal(model.canvases.length, 0);
  }
});
