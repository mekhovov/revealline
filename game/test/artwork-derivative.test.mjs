import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { crc32 } from '../../scripts/game-cli.mjs';
import {
  artworkDerivativePlan,
  prepareArtworkDerivative,
  rasterizeArtworkDerivative,
} from '../../authoring/asset-studio/artwork-derivative.mjs';
import {
  createArtworkCollection,
  exportArtworkCollection,
  importArtworkCollection,
} from '../../authoring/asset-studio/artwork-collection.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

// Actual bounded PNG fixtures, not production art. Native raster output is
// checked separately in the browser; injected encoders here expose ownership.
function png(width, height) {
  const chunk = (type, data) => {
    const name = Buffer.from(type),
      out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length);
    name.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
async function decodeImage(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return { naturalWidth: bytes.readUInt32BE(16), naturalHeight: bytes.readUInt32BE(20) };
}
async function fixture({ medium = 'pixel-art', creator = 'Fixture artist' } = {}) {
  const bytes = png(1600, 800);
  const document = createArtworkCollection({
    id: 'derivative-test',
    revision: 1,
    name: 'Test originals',
    treatment: medium === 'photograph' ? 'photographic-reveals' : 'pixel-art',
    artworks: [
      {
        id: 'original',
        role: 'reveal',
        medium,
        file: {
          name: 'original.png',
          mime: 'image/png',
          bytes: bytes.length,
          sha256: await hashPresentationBytes(bytes),
          width: 1600,
          height: 800,
        },
        provenance: {
          origin: 'original',
          creator,
          sourceIds: [],
          derivative: null,
          prompt: '',
          license: {
            status: 'original',
            name: 'Original test data',
            url: null,
            evidence: 'Test fixture only, never a production approval.',
          },
        },
      },
    ],
  });
  return {
    document,
    assets: new Map([['original.png', new Blob([bytes], { type: 'image/png' })]]),
  };
}
const choice = { board: 'wide', fit: 'contain' };
const encode = async (_blob, plan) =>
  new Blob([png(plan.width, plan.height)], { type: 'image/png' });

test('board preparation preserves aspect ratio and records whole-image or explicit centre-crop geometry', () => {
  const file = { width: 1600, height: 800 };
  const wide = artworkDerivativePlan(file, choice);
  assert.deepEqual(wide.source, [0, 0, 1600, 800]);
  assert.deepEqual(wide.destination, [0, 0, 1152, 576]);
  const classic = artworkDerivativePlan(file, { board: 'classic', fit: 'contain' });
  assert.deepEqual(classic.destination, [0, 96, 768, 384]);
  const cropped = artworkDerivativePlan(file, { board: 'classic', fit: 'cover' });
  assert.deepEqual(cropped.destination, [0, 0, 768, 576]);
  assert.ok(Math.abs(cropped.source[0] - 266.6666666667) < 0.001);
  assert.equal(cropped.source[1], 0);
  assert.ok(Object.isFrozen(wide) && Object.isFrozen(wide.source));
  assert.throws(() => artworkDerivativePlan({ width: 32, height: 32 }, choice), /upscaling/);
  assert.throws(() => artworkDerivativePlan(file, { ...choice, approved: true }), /not supported/);
  assert.throws(() => artworkDerivativePlan(file, { board: 'other', fit: 'contain' }), /supported/);
  assert.throws(() => artworkDerivativePlan(file, { board: 'wide', fit: 'stretch' }), /contain/);
  let touched = false;
  assert.throws(() =>
    artworkDerivativePlan(file, {
      get board() {
        touched = true;
        return 'wide';
      },
      fit: 'contain',
    }),
  );
  assert.equal(touched, false);
});

test('derivative round trip retains originals, exact provenance and maximum-length creator without approval', async () => {
  const current = await fixture({ creator: 'x'.repeat(2048) });
  const original = new Uint8Array(await current.assets.get('original.png').arrayBuffer());
  const next = await prepareArtworkDerivative(current, 'original', choice, {
    decodeImage,
    rasterize: encode,
  });
  assert.equal(current.document.artworks.length, 1);
  assert.equal(next.document.revision, 2);
  const derived = next.document.artworks[1];
  assert.equal(derived.id, 'original-wide-r2');
  assert.equal(derived.provenance.creator, current.document.artworks[0].provenance.creator);
  assert.equal(derived.provenance.derivative.parent, 'original');
  const recipe = JSON.parse(derived.provenance.derivative.changes);
  assert.equal(recipe.sampling, 'nearest');
  assert.equal(recipe.review, 'candidate-not-production-approved');
  assert.equal(recipe.tool, 'Reveal Line Asset Studio');
  const packet = await exportArtworkCollection(next.document, next.assets, { decodeImage });
  const restored = await importArtworkCollection(packet, { decodeImage });
  assert.deepEqual(restored.document, next.document);
  assert.deepEqual(
    new Uint8Array(await restored.assets.get('original.png').arrayBuffer()),
    original,
  );
  assert.deepEqual(
    new Uint8Array(await restored.assets.get(derived.file.name).arrayBuffer()),
    new Uint8Array(await next.assets.get(derived.file.name).arrayBuffer()),
  );
});

test('photographic choice uses smooth sampling and retains explicit collection policy', async () => {
  const current = await fixture({ medium: 'photograph' });
  const next = await prepareArtworkDerivative(current, 'original', choice, {
    decodeImage,
    rasterize: (blob, plan, options) => {
      assert.equal(options.sampling, 'smooth');
      return encode(blob, plan);
    },
  });
  assert.equal(next.document.treatment, 'photographic-reveals');
  assert.equal(next.document.artworks[1].medium, 'photograph');
});

test('source corruption fails before rasterization and invalid output never replaces retained input', async () => {
  const current = await fixture();
  let draws = 0;
  const wrong = { ...current, assets: new Map([['original.png', new Blob(['wrong'])]]) };
  await assert.rejects(
    prepareArtworkDerivative(wrong, 'original', choice, {
      decodeImage,
      rasterize: async () => {
        draws++;
        return encode(null, { width: 1152, height: 576 });
      },
    }),
  );
  assert.equal(draws, 0);
  for (const output of [
    new Blob([]),
    new Blob(['bad png']),
    new Blob([png(768, 576)]),
    new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]),
  ]) {
    await assert.rejects(
      prepareArtworkDerivative(current, 'original', choice, {
        decodeImage,
        rasterize: async () => output,
      }),
    );
    assert.equal(current.assets.size, 1);
    assert.equal(current.document.revision, 1);
  }
});

test('caller map mutation and ignored abort cannot adopt late derivative work', async () => {
  const current = await fixture(),
    gate = deferred(),
    rasterStarted = deferred(),
    controller = new AbortController();
  const task = prepareArtworkDerivative(current, 'original', choice, {
    decodeImage,
    signal: controller.signal,
    rasterize: async (blob) => {
      assert.ok(
        blob instanceof Blob,
        'Rasterization receives the owned original after caller-map mutation.',
      );
      rasterStarted.resolve();
      return gate.promise;
    },
  });
  current.assets.clear();
  await rasterStarted.promise;
  controller.abort();
  gate.resolve(await encode(null, { width: 1152, height: 576 }));
  await assert.rejects(task, { name: 'AbortError' });
  const second = await fixture(),
    decoded = deferred();
  let entered = false;
  const other = prepareArtworkDerivative(second, 'original', choice, {
    decodeImage: async (blob) => {
      if (!entered) {
        entered = true;
        await decoded.promise;
      }
      return decodeImage(blob);
    },
    rasterize: encode,
  });
  second.assets.clear();
  decoded.resolve();
  assert.equal((await other).assets.size, 2);
});

function nativeHarness({
  sourceWidth = 1600,
  nullEncode = false,
  waitEncode = false,
  waitDecode = false,
} = {}) {
  const calls = [],
    urls = new Set(),
    decode = deferred();
  let instance, deadline, pendingEncode;
  const context = {
    fillRect: (...args) => calls.push(['fill', ...args]),
    drawImage: (...args) => calls.push(['draw', ...args.slice(1)]),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (callback, mime) => {
      calls.push(['encode', mime]);
      pendingEncode = () => callback(nullEncode ? null : new Blob(['output']));
      if (!waitEncode) pendingEncode();
    },
  };
  class Image {
    constructor() {
      instance = this;
      this.naturalWidth = sourceWidth;
      this.naturalHeight = 800;
    }
    set src(value) {
      this.url = value;
      queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {
      this.url = null;
    }
    decode() {
      return waitDecode ? decode.promise : Promise.resolve();
    }
  }
  return {
    canvas,
    context,
    calls,
    decode,
    urls,
    image: () => instance,
    expire: () => deadline(),
    encode: () => pendingEncode(),
    options: {
      Image,
      document: { createElement: () => canvas },
      urls: {
        createObjectURL: () => {
          urls.add('owned');
          return 'owned';
        },
        revokeObjectURL: (url) => urls.delete(url),
      },
      schedule: (fn, ms) => {
        assert.equal(ms, 15000);
        deadline = fn;
        return 1;
      },
      cancel: (id) => assert.equal(id, 1),
    },
  };
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
function cleaned(h) {
  assert.equal(h.urls.size, 0);
  assert.equal(h.canvas.width, 0);
  assert.equal(h.canvas.height, 0);
  assert.equal(h.image().url, null);
  assert.equal(h.image().onload, null);
}
test('native drawing chooses explicit sampling and exact fit, releasing resources after encoding', async () => {
  const plan = artworkDerivativePlan(
    { width: 1600, height: 800 },
    { board: 'classic', fit: 'contain' },
  );
  for (const sampling of ['nearest', 'smooth']) {
    const h = nativeHarness();
    await rasterizeArtworkDerivative(new Blob(['source']), plan, { ...h.options, sampling });
    assert.equal(h.context.imageSmoothingEnabled, sampling === 'smooth');
    assert.equal(h.context.fillStyle, '#08131e');
    assert.deepEqual(h.calls, [
      ['fill', 0, 0, 768, 576],
      ['draw', 0, 0, 1600, 800, 0, 96, 768, 384],
      ['encode', 'image/png'],
    ]);
    cleaned(h);
  }
});
test('native decode/encode failures, timeout and abort release buffers and ignore late completion', async () => {
  const plan = artworkDerivativePlan({ width: 1600, height: 800 }, choice);
  for (const config of [{ sourceWidth: 1599 }, { nullEncode: true }]) {
    const h = nativeHarness(config);
    await assert.rejects(rasterizeArtworkDerivative(new Blob(['source']), plan, h.options));
    cleaned(h);
  }
  for (const stage of ['decode', 'encode']) {
    const h = nativeHarness(stage === 'decode' ? { waitDecode: true } : { waitEncode: true });
    const controller = new AbortController();
    const task = rasterizeArtworkDerivative(new Blob(['source']), plan, {
      ...h.options,
      signal: controller.signal,
    });
    const rejected = assert.rejects(task, { name: 'AbortError' });
    await turn();
    controller.abort();
    await rejected;
    if (stage === 'decode') h.decode.resolve();
    else h.encode();
    await turn();
    cleaned(h);
    if (stage === 'decode') assert.equal(h.calls.length, 0);
  }
  const h = nativeHarness({ waitDecode: true });
  const task = rasterizeArtworkDerivative(new Blob(['source']), plan, h.options);
  const rejected = assert.rejects(task, /timed out/);
  await turn();
  h.expire();
  await rejected;
  h.decode.resolve();
  await turn();
  cleaned(h);
});
