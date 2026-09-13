import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createStillMediaPreview } from '../ui/still-media-preview.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { pngBytes, assetRecord, mediaFixture, deferred } from './helpers/media-fixtures.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const themes = read('../content/themes.json').themes;
const presets = read('../../authoring/motion-lab/presets.json');
const bytes = pngBytes();
const asset = () => ({
  ...assetRecord(),
  sha256: createHash('sha256').update(bytes).digest('hex'),
});
const blob = () => new Blob([bytes], { type: 'image/png' });
const background = (fit = 'cover') => ({
  dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
  fit,
});
const drawable = (id = 'decoded') => ({
  id,
  width: 1,
  height: 1,
  naturalWidth: 1,
  naturalHeight: 1,
  released: 0,
  removeAttribute(name) {
    assert.equal(name, 'src');
    this.released++;
  },
});

// Actual BoardPainter commands, finite Canvas2D/Image/URL boundaries. These are
// not browser decoding, raster silhouette, storage, awards or hardware tests.
function harness(t, options = {}) {
  const canvases = [];
  const document = {
    createElement(name) {
      assert.equal(name, 'canvas');
      const calls = [],
        stack = [],
        values = {
          globalAlpha: 1,
          globalCompositeOperation: 'source-over',
          imageSmoothingEnabled: true,
        };
      let width = 300,
        height = 150;
      const canvas = { ownerDocument: document, style: {}, calls, changes: [], frame: null };
      for (const axis of ['width', 'height'])
        Object.defineProperty(canvas, axis, {
          get: () => (axis === 'width' ? width : height),
          set(value) {
            if (axis === 'width') width = value;
            else height = value;
            canvas.changes.push([axis, value]);
            canvas.frame = null;
          },
        });
      const context = new Proxy(
        { canvas },
        {
          get(target, key) {
            if (key in target) return target[key];
            if (key in values) return values[key];
            return (...args) => {
              const call = { op: key, args, ...values };
              calls.push(call);
              if (key === 'save') stack.push({ ...values });
              if (key === 'restore') Object.assign(values, stack.pop());
              if (key === 'clearRect') canvas.frame = null;
              if (key === 'drawImage') canvas.frame = call;
            };
          },
          set(_target, key, value) {
            values[key] = value;
            return true;
          },
        },
      );
      canvas.getContext = (kind) => {
        assert.equal(kind, '2d');
        return context;
      };
      canvases.push(canvas);
      return canvas;
    },
  };
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() =>
    oldDocument
      ? Object.defineProperty(globalThis, 'document', oldDocument)
      : delete globalThis.document,
  );
  const canvas = document.createElement('canvas'),
    urls = new Map(),
    created = [],
    revoked = [];
  const URLImpl = {
    createObjectURL(value) {
      const url = `blob:preview-${created.length}`;
      created.push({ url, blob: value });
      urls.set(url, value);
      return url;
    },
    revokeObjectURL(url) {
      revoked.push(url);
      urls.delete(url);
    },
  };
  const preview = createStillMediaPreview({
    canvas,
    presets,
    URLImpl,
    decodeImage: async () => drawable(),
    ...options,
  });
  t.after(() => preview.dispose());
  const request = (wide = true) => ({
    theme: structuredClone(themes[0]),
    level: mediaFixture(wide).campaign.levels[0],
    seed: 17,
    asset: asset(),
    blob: blob(),
  });
  return { preview, canvas, canvases, document, created, revoked, urls, request };
}
const stage = (canvas) => canvas.frame.args[0];
const imageCall = (canvas) => stage(canvas).calls.findLast((call) => call.op === 'drawImage');
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('real gallery stages a verified original with contain/nearest and copies it once at wide size', async (t) => {
  const image = drawable(),
    h = harness(t, { decodeImage: async () => image });
  const request = h.request(),
    before = structuredClone(request.level);
  assert.equal(h.preview.canvas, h.canvas);
  assert.equal(await h.preview.show(request), true);
  assert.deepEqual([h.canvas.width, h.canvas.height], [1152, 576]);
  assert.equal(h.canvas.style.aspectRatio, '1152 / 576');
  assert.deepEqual(imageCall(h.canvas).args, [image, 288, 0, 576, 576]);
  assert.equal(imageCall(h.canvas).imageSmoothingEnabled, false);
  assert.equal(h.canvas.frame.imageSmoothingEnabled, false);
  assert.equal(h.canvas.frame.globalCompositeOperation, 'copy');
  assert.equal(h.canvas.calls.filter((call) => call.op === 'drawImage').length, 1);
  assert.equal(image.released, 1);
  assert.deepEqual(await h.created[0].blob.arrayBuffer(), await request.blob.arrayBuffer());
  assert.deepEqual(h.revoked, [h.created[0].url]);
  assert.equal(h.urls.size, 0);
  assert.deepEqual(request.level, before);
});

test('legacy size and authored cover fit stay together and do not allocate an object URL', async (t) => {
  const image = drawable(),
    h = harness(t, { decodeImage: async () => image });
  const request = { ...h.request(false), asset: null, blob: null, legacyBackground: background() };
  assert.equal(await h.preview.show(request), true);
  assert.deepEqual([h.canvas.width, h.canvas.height], [768, 576]);
  assert.deepEqual(imageCall(h.canvas).args, [image, 0, -96, 768, 768]);
  assert.equal(h.created.length, 0);
  await h.preview.show({ ...request, legacyBackground: background('contain') });
  assert.deepEqual(imageCall(h.canvas).args, [image, 96, 0, 576, 576]);
});

test('browser decoder waits for full decode before resizing or changing the previous preview', async (t) => {
  const decoded = deferred(),
    entered = deferred();
  class Image {
    constructor() {
      Object.assign(this, drawable());
    }
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    decode() {
      entered.resolve();
      return decoded.promise;
    }
  }
  const h = harness(t, { decodeImage: undefined, ImageClass: Image });
  h.canvas.frame = { marker: 'old art' };
  const old = h.canvas.frame,
    pending = h.preview.show(h.request());
  await entered.promise;
  assert.equal(h.canvas.frame, old);
  assert.deepEqual(h.canvas.changes, []);
  decoded.resolve();
  assert.equal(await pending, true);
  assert.notEqual(h.canvas.frame, old);
});

test('failed candidate decode preserves the exact committed frame and dimensions', async (t) => {
  let fail = false;
  const h = harness(t, {
    decodeImage: async () => {
      if (fail) throw new Error('broken image');
      return drawable();
    },
  });
  await h.preview.show(h.request(false));
  const old = h.canvas.frame,
    changes = [...h.canvas.changes];
  fail = true;
  await assert.rejects(h.preview.show(h.request(true)), /broken image/);
  assert.equal(h.canvas.frame, old);
  assert.deepEqual(h.canvas.changes, changes);
  assert.deepEqual([h.canvas.width, h.canvas.height], [768, 576]);
  assert.deepEqual(
    h.revoked,
    h.created.map((entry) => entry.url),
  );
});

test('unsupported legacy bytes and fit fail without replacing current art with generated fallback', async (t) => {
  const h = harness(t);
  await h.preview.show(h.request());
  const old = h.canvas.frame;
  for (const legacyBackground of [
    { ...background(), fit: 'stretch' },
    { dataUrl: 'https://example.invalid/image.png' },
    false,
  ]) {
    await assert.rejects(
      h.preview.show({ ...h.request(), asset: null, blob: null, legacyBackground }),
    );
    assert.equal(h.canvas.frame, old);
  }
});

test('managed original mismatch is rejected before URL allocation or decode', async (t) => {
  let decodes = 0;
  const h = harness(t, {
    decodeImage: async () => {
      decodes++;
      return drawable();
    },
  });
  for (const patch of [
    { blob: new Blob([new Uint8Array(bytes.length)]) },
    { blob: new Blob(['short']) },
    { asset: null },
    { asset: false },
  ])
    await assert.rejects(h.preview.show({ ...h.request(), ...patch }));
  assert.equal(decodes, 0);
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.canvas.changes, []);
});

test('decoded dimension mismatch cannot resize or paint and releases the owned image', async (t) => {
  const image = { ...drawable(), naturalWidth: 2 };
  const h = harness(t, { decodeImage: async () => image });
  await assert.rejects(h.preview.show(h.request()), /dimensions differ/);
  assert.deepEqual(h.canvas.changes, []);
  assert.equal(image.released, 1);
  assert.equal(h.urls.size, 0);
});

test('superseded uncooperative decoder returns false and its late image cannot repaint', async (t) => {
  const late = deferred(),
    entered = deferred(),
    oldImage = drawable('old'),
    newImage = drawable('new');
  let count = 0;
  const h = harness(t, {
    decodeImage: () => {
      if (++count === 1) {
        entered.resolve();
        return late.promise;
      }
      return newImage;
    },
  });
  const old = h.preview.show(h.request(false));
  await entered.promise;
  const newer = h.preview.show(h.request(true));
  assert.equal(await old, false);
  assert.equal(await newer, true);
  const frame = h.canvas.frame;
  late.resolve(oldImage);
  await flush();
  assert.equal(h.canvas.frame, frame);
  assert.equal(imageCall(h.canvas).args[0], newImage);
  assert.equal(oldImage.released, 1);
  assert.equal(h.urls.size, 0);
  assert.equal(new Set(h.revoked).size, 2);
});

test('external cancellation rejects promptly, preserves prior art, and cleans up a late decoder', async (t) => {
  const late = deferred(),
    entered = deferred(),
    image = drawable();
  const h = harness(t, {
    decodeImage: () => {
      entered.resolve();
      return late.promise;
    },
  });
  h.canvas.frame = { marker: 'prior context' };
  const frame = h.canvas.frame,
    controller = new AbortController();
  const pending = h.preview.show(h.request(), { signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await entered.promise;
  controller.abort();
  await rejected;
  assert.equal(h.canvas.frame, frame);
  assert.equal(h.urls.size, 0);
  late.resolve(image);
  await flush();
  assert.equal(image.released, 1);
  assert.equal(h.canvas.frame, frame);
});

test('already-aborted requests never allocate, decode or resize', async (t) => {
  const h = harness(t, { decodeImage: () => assert.fail('should not decode') });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.preview.show(h.request(), { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(h.created.length, 0);
  assert.deepEqual(h.canvas.changes, []);
});

test('explicit context clear cancels pending work and prevents old-theme paint after selection changes', async (t) => {
  const late = deferred(),
    entered = deferred();
  const h = harness(t, {
    decodeImage: () => {
      entered.resolve();
      return late.promise;
    },
  });
  const pending = h.preview.show(h.request());
  await entered.promise;
  h.preview.clear();
  assert.equal(await pending, false);
  assert.equal(h.canvas.frame, null);
  late.resolve(drawable());
  await flush();
  assert.equal(h.canvas.frame, null);
  assert.equal(h.urls.size, 0);
});

test('dispose invalidates pending work, is idempotent, and rejects later show', async (t) => {
  const late = deferred(),
    entered = deferred();
  const h = harness(t, {
    decodeImage: () => {
      entered.resolve();
      return late.promise;
    },
  });
  const pending = h.preview.show(h.request());
  await entered.promise;
  h.preview.dispose();
  h.preview.dispose();
  assert.equal(await pending, false);
  await assert.rejects(h.preview.show(h.request()), /disposed/);
  late.reject(new Error('decoder rejected after dispose'));
  await flush();
  assert.equal(h.canvas.frame, null);
  assert.equal(h.urls.size, 0);
});

test('generated fallback uses the real current-theme scene without simulation or decoder activity', async (t) => {
  const h = harness(t, { decodeImage: () => assert.fail('generated scene does not decode') });
  const run = createRun(h.request().level),
    before = authoritativeCheckpoint(run);
  const request = { ...h.request(), asset: null, blob: null, level: run.level };
  await h.preview.show(request);
  const art = imageCall(h.canvas).args[0];
  assert.deepEqual([art.width, art.height], [384, 288]);
  assert.ok(art.calls.filter((call) => call.op === 'fillRect').length > 100);
  await h.preview.show(request);
  assert.deepEqual(imageCall(h.canvas).args[0].calls, art.calls);
  await h.preview.show({ ...request, theme: themes[2] });
  assert.notDeepEqual(imageCall(h.canvas).args[0].calls, art.calls);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.equal(h.created.length, 0);
});

class LoadOnlyImage {
  constructor() {
    Object.assign(this, drawable());
  }
  set src(_value) {
    queueMicrotask(() => this.onload?.());
  }
}
for (const [name, options] of [
  ['Image', { decodeImage: undefined, ImageClass: undefined }],
  ['complete decoder', { decodeImage: undefined, ImageClass: LoadOnlyImage }],
  ['object URL', { URLImpl: {} }],
])
  test(`missing ${name} capability fails clearly without losing prior art`, async (t) => {
    const h = harness(t, options);
    h.canvas.frame = { marker: 'old' };
    const before = h.canvas.frame;
    await assert.rejects(h.preview.show(h.request()), /unavailable/);
    assert.equal(h.canvas.frame, before);
    assert.deepEqual(h.canvas.changes, []);
    assert.equal(h.urls.size, 0);
  });

test('browser decode errors preserve prior pixels and release URL and handlers', async (t) => {
  let instance;
  class BadImage {
    constructor() {
      instance = this;
      Object.assign(this, drawable());
    }
    set src(_value) {
      queueMicrotask(() => this.onerror?.());
    }
  }
  const h = harness(t, { decodeImage: undefined, ImageClass: BadImage });
  h.canvas.frame = { marker: 'old' };
  const before = h.canvas.frame;
  await assert.rejects(h.preview.show(h.request()), /could not decode/);
  assert.equal(h.canvas.frame, before);
  assert.equal(instance.released, 1);
  assert.equal(instance.onload, null);
  assert.equal(instance.onerror, null);
  assert.equal(h.urls.size, 0);
});

test('theme metadata is snapshotted before an async decode can observe caller edits', async (t) => {
  const ready = deferred(),
    entered = deferred();
  const h = harness(t, {
    decodeImage: () => {
      entered.resolve();
      return ready.promise;
    },
  });
  const request = h.request(),
    originalField = request.theme.palette.field;
  const pending = h.preview.show(request);
  await entered.promise;
  request.theme.palette.field = '#123456';
  ready.resolve(drawable());
  assert.equal(await pending, true);
  const fill = stage(h.canvas).calls.find((call) => call.op === 'fillRect');
  assert.equal(fill.fillStyle, originalField);
});

test('failed staging keeps previous dimensions and pixels after successful candidate decode', async (t) => {
  const image = drawable(),
    h = harness(t, { decodeImage: async () => image });
  await h.preview.show(h.request(false));
  const frame = h.canvas.frame,
    changes = [...h.canvas.changes];
  const create = h.document.createElement;
  h.document.createElement = (name) => {
    const result = create(name);
    result.getContext = () => null;
    return result;
  };
  await assert.rejects(h.preview.show(h.request()), /staging canvas is unavailable/);
  assert.equal(h.canvas.frame, frame);
  assert.deepEqual(h.canvas.changes, changes);
  assert.equal(h.urls.size, 0);
});
