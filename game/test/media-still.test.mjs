import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareStillAsset } from '../media-still.mjs';
import { MEDIA_LIMITS } from '../media-library.mjs';
import { pngBytes, provenance, deferred } from './helpers/media-fixtures.mjs';

const metadata = () => ({ id: 'injected-picture', provenance: provenance() });
const dimensions = () => ({ naturalWidth: 1, naturalHeight: 1 });
const decodeImage = async () => dimensions();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pngHeader = (width, height) => {
  const b = pngBytes();
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
};

test('PNG bytes, hash and metadata stay exact; filename/type do not determine the format', async () => {
  const bytes = pngBytes(),
    source = new Blob([bytes], { type: 'video/mp4' });
  source.name = 'wrong.jpg';
  let calls = 0;
  const result = await prepareStillAsset(source, metadata(), {
    decodeImage: async (blob) => {
      calls++;
      assert.equal(blob.type, 'image/png');
      assert.notEqual(blob, source);
      assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
      return dimensions();
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.asset.sha256, hash(bytes));
  assert.equal(result.asset.bytes, bytes.length);
  assert.equal(result.asset.mime, 'image/png');
  assert.deepEqual(Buffer.from(await result.blob.arrayBuffer()), bytes);
  assert.ok(Object.isFrozen(result.asset.provenance));
});

test('JPEG header uses the required decoder; a header-only fixture cannot certify playback', async () => {
  // Deliberately not a complete JPEG: this tests the header/decode boundary.
  const header = Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 2, 1, 1, 17, 0, 255, 217]);
  let calls = 0;
  await assert.rejects(
    prepareStillAsset(new Blob([header]), metadata(), {
      decodeImage: async (blob) => {
        calls++;
        assert.equal(blob.type, 'image/jpeg');
        throw new Error('Decoder rejects missing scan data');
      },
    }),
    /missing scan data/,
  );
  assert.equal(calls, 1);
  const result = await prepareStillAsset(new Blob([header]), metadata(), {
    decodeImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }),
  });
  assert.equal(result.asset.sha256, hash(header));
  assert.equal(result.asset.width, 2);
});

test('size/header/animation/dimension bombs reject before allocating a decoder', async () => {
  const original = pngBytes(),
    animation = Buffer.alloc(12);
  animation.write('acTL', 4);
  const invalid = [
    Buffer.from('GIF89a'),
    Buffer.from('<svg/>'),
    original.subarray(0, 35),
    pngHeader(0, 1),
    pngHeader(8193, 1),
    pngHeader(8192, 8192),
    Buffer.concat([original.subarray(0, 33), animation, original.subarray(33)]),
    Buffer.alloc(MEDIA_LIMITS.assetBytes + 1),
  ];
  let calls = 0;
  for (const bytes of invalid)
    await assert.rejects(
      prepareStillAsset(new Blob([bytes]), metadata(), {
        decodeImage: async () => {
          calls++;
          return dimensions();
        },
      }),
    );
  assert.equal(calls, 0);
});

test('decoded mismatch, rejected decode and malicious dimensions never produce a prepared asset', async () => {
  const blob = new Blob([pngBytes()]);
  let reads = 0;
  for (const decoder of [
    async () => ({ naturalWidth: 2, naturalHeight: 1 }),
    async () => {
      throw new Error('decode failed');
    },
    async () => ({
      get naturalWidth() {
        reads++;
        return 1;
      },
      naturalHeight: 1,
    }),
  ])
    await assert.rejects(prepareStillAsset(blob, metadata(), { decodeImage: decoder }));
  await assert.rejects(
    prepareStillAsset(blob, metadata(), { decodeImage: null }),
    /decoder is required/,
  );
  assert.equal(reads, 0);
});

test('caller metadata and Blob accessors cannot alter the in-flight bytes or invoke getters', async () => {
  let reads = 0;
  const source = new Blob([pngBytes()]);
  for (const name of ['size', 'type', 'arrayBuffer', 'slice'])
    Object.defineProperty(source, name, {
      get() {
        reads++;
        throw new Error('untrusted getter');
      },
    });
  const gate = deferred(),
    entered = deferred(),
    value = metadata();
  const pending = prepareStillAsset(source, value, {
    decodeImage: () => {
      entered.resolve();
      return gate.promise;
    },
  });
  await entered.promise;
  value.id = 'late-edit';
  value.provenance.credit = 'changed';
  gate.resolve(dimensions());
  const result = await pending;
  assert.equal(reads, 0);
  assert.equal(result.asset.id, 'injected-picture');
  assert.equal(result.asset.provenance.credit, 'Test fixture');
  const hostile = {
    get id() {
      reads++;
      return 'hidden';
    },
    provenance: provenance(),
  };
  await assert.rejects(prepareStillAsset(source, hostile, { decodeImage }), /accessors/);
  await assert.rejects(
    prepareStillAsset({ size: 68, arrayBuffer: () => new ArrayBuffer(68) }, metadata(), {
      decodeImage,
    }),
    /Blob or File/,
  );
  assert.equal(reads, 0);
});

test('cancellation before read or after an asynchronous decoder prevents late adoption', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    prepareStillAsset(new Blob([pngBytes()]), metadata(), {
      decodeImage,
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  const live = new AbortController(),
    gate = deferred(),
    entered = deferred();
  const pending = prepareStillAsset(new Blob([pngBytes()]), metadata(), {
    signal: live.signal,
    decodeImage: () => {
      entered.resolve();
      return gate.promise;
    },
  });
  await entered.promise;
  live.abort();
  gate.resolve(dimensions());
  await assert.rejects(pending, { name: 'AbortError' });
});

test('default browser decoder cannot silently fall back to header-only validation in Node', async () => {
  assert.equal(typeof globalThis.Image, 'undefined');
  await assert.rejects(
    prepareStillAsset(new Blob([pngBytes()]), metadata()),
    /decoding is unavailable/,
  );
});

test('modeled browser adapter revokes its temporary URL on full decode, error and cancellation', async (t) => {
  const images = [],
    created = [],
    revoked = [];
  class ImageFixture {
    naturalWidth = 1;
    naturalHeight = 1;
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.source = value;
    }
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.source = null;
    }
    decode() {
      return this.gate?.promise ?? Promise.resolve();
    }
  }
  t.mock.method(globalThis.URL, 'createObjectURL', (blob) => {
    assert.equal(blob.type, 'image/png');
    const url = `blob:modeled-${created.length}`;
    created.push(url);
    return url;
  });
  t.mock.method(globalThis.URL, 'revokeObjectURL', (url) => revoked.push(url));
  Object.defineProperty(globalThis, 'Image', { value: ImageFixture, configurable: true });
  t.after(() => {
    delete globalThis.Image;
  });
  async function started(options) {
    const count = images.length,
      promise = prepareStillAsset(new Blob([pngBytes()]), metadata(), options);
    for (let i = 0; i < 20 && images.length === count; i++)
      await new Promise((resolve) => setImmediate(resolve));
    assert.equal(images.length, count + 1);
    return { promise, image: images.at(-1) };
  }
  const success = await started();
  success.image.gate = deferred();
  const loaded = success.image.onload();
  assert.equal(revoked.length, 0);
  success.image.gate.resolve();
  await loaded;
  await success.promise;
  assert.deepEqual(revoked, [created[0]]);
  assert.equal(success.image.source, null);
  const failed = await started();
  failed.image.onerror();
  await assert.rejects(failed.promise, /could not decode/);
  const controller = new AbortController(),
    cancelled = await started({ signal: controller.signal });
  cancelled.image.gate = deferred();
  const lateLoad = cancelled.image.onload();
  controller.abort();
  await assert.rejects(cancelled.promise, { name: 'AbortError' });
  cancelled.image.gate.resolve();
  await lateLoad;
  assert.deepEqual(revoked, created);
  assert.ok(images.every((image) => image.source === null));
});

test('abort during browser allocation is rechecked before any image source is loaded', async (t) => {
  const controller = new AbortController(),
    revoked = [];
  let loads = 0;
  class AbortImageFixture {
    constructor() {
      controller.abort();
    }
    set src(value) {
      loads++;
    }
    removeAttribute() {}
  }
  t.mock.method(globalThis.URL, 'createObjectURL', () => 'blob:allocation-abort');
  t.mock.method(globalThis.URL, 'revokeObjectURL', (url) => revoked.push(url));
  Object.defineProperty(globalThis, 'Image', { value: AbortImageFixture, configurable: true });
  t.after(() => {
    delete globalThis.Image;
  });
  await assert.rejects(
    prepareStillAsset(new Blob([pngBytes()]), metadata(), { signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(loads, 0);
  assert.deepEqual(revoked, ['blob:allocation-abort']);
});
