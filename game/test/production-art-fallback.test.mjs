import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { loadProductionImage } from '../../authoring/production/preview.mjs';
import { buildSentinelTheme } from '../../authoring/library/sentinel-theme-chapters/build.mjs';

const rootURL = 'https://authoring.test/source/';
const embedded = CURRENT_ART_SOURCES.find(
  (source) =>
    source.kind === 'embedded' && source.sourceImagePath && source.source.kind === 'built-in',
);
const external = CURRENT_ART_SOURCES.find(
  (source) => source.kind === 'external' && source.source.descriptorId === 'sentinel-circuit-ukraine',
);
const original = (source) => ({
  role: 'original',
  file: { path: source.sourceImagePath, bytes: source.image.bytes, sha256: source.image.sha256 },
  width: source.image.width,
  height: source.image.height,
});
let externalPayloads;
const read = async (relative) => {
  if (relative.startsWith('optional/external-chapters/sentinel-circuit-ukraine/')) {
    externalPayloads ??= buildSentinelTheme('ukraine');
    const { payloads } = await externalPayloads;
    return new Uint8Array(
      await payloads[relative.endsWith('pack.json') ? 'pack' : 'media'].arrayBuffer(),
    );
  }
  return readFile(new URL('../../' + relative, import.meta.url));
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture(source, { missing = true, decode, response } = {}) {
  const calls = [],
    allocations = [],
    revoked = [];
  const options = {
    rootURL,
    cryptoSource: webcrypto,
    async fetchSource(url, init) {
      calls.push({ url, init });
      const relative = url.slice(rootURL.length);
      if (relative === source.sourceImagePath)
        return response
          ? response()
          : missing
            ? new Response('', { status: 404 })
            : new Response(await read(relative));
      return new Response(await read(relative));
    },
    urlAPI: {
      createObjectURL(blob) {
        const url = `blob:owned-${allocations.length}`;
        allocations.push({ url, blob });
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
    makeImage() {
      return {
        removeAttribute() {
          delete this.src;
        },
        async decode() {
          const owned = allocations.find((item) => item.url === this.src);
          const view = new DataView(await owned.blob.arrayBuffer());
          this.naturalWidth = view.getUint32(16);
          this.naturalHeight = view.getUint32(20);
          await decode?.(this);
        },
      };
    },
  };
  return { options, calls, allocations, revoked };
}

test('Production preserves direct originals and falls back once to byte-identical pinned artwork only after 404', async () => {
  for (const missing of [false, true]) {
    const h = fixture(embedded, { missing });
    const image = await loadProductionImage(original(embedded), h.options);
    assert.equal(h.calls.length, missing ? 2 : 1);
    assert.equal(h.calls[0].url, rootURL + embedded.sourceImagePath);
    if (missing) assert.equal(h.calls[1].url, rootURL + embedded.source.path);
    assert(
      h.calls.every(({ init }) => init.redirect === 'error' && init.credentials === 'same-origin'),
    );
    assert.deepEqual(
      Buffer.from(await h.allocations.at(-1).blob.arrayBuffer()),
      await read(embedded.sourceImagePath),
    );
    assert.equal(image.image.naturalWidth, embedded.image.width);
    assert.equal(h.revoked.length, 0);
    image.dispose();
    image.dispose();
    assert.equal(h.revoked.length, 1);
  }
});

test('Production refuses unavailable, corrupt, redirected and unregistered originals without broader fallback', async () => {
  const cases = [
    { response: () => new Response('', { status: 503 }) },
    {
      response: async () => {
        const bytes = new Uint8Array(await read(embedded.sourceImagePath));
        bytes[100] ^= 1;
        return new Response(bytes);
      },
    },
    { response: () => ({ ok: false, status: 404, redirected: true }) },
    { response: () => ({ ok: false, status: 404, url: rootURL + 'other.png' }) },
    {
      entry: {
        ...original(embedded),
        file: { ...original(embedded).file, sha256: '0'.repeat(64) },
      },
    },
    {
      entry: {
        ...original(embedded),
        file: { ...original(embedded).file, path: 'authoring/unregistered.png' },
      },
      response: () => new Response('', { status: 404 }),
    },
  ];
  for (const example of cases) {
    const h = fixture(embedded, example);
    if (example.entry?.file.path === 'authoring/unregistered.png')
      h.options.fetchSource = async (url) => {
        h.calls.push({ url });
        return new Response('', { status: 404 });
      };
    await assert.rejects(loadProductionImage(example.entry ?? original(embedded), h.options));
    assert.equal(h.calls.length, 1, 'Failed admission must not try a pack or unrelated URL.');
    assert.equal(h.allocations.length, 0);
  }
});

test('Production external fallback retires every temporary decoder and retains only the displayed original', async () => {
  const h = fixture(external);
  const image = await loadProductionImage(original(external), h.options);
  assert(h.allocations.length > 1, 'Native external preparation must decode its admitted images.');
  assert.equal(h.revoked.length, h.allocations.length - 1);
  assert.deepEqual(
    Buffer.from(await h.allocations.at(-1).blob.arrayBuffer()),
    await read(external.sourceImagePath),
  );
  image.dispose();
  assert.equal(new Set(h.revoked).size, h.allocations.length);
});

test('Production cancellation during a temporary fallback decode retires its URL and rejects late completion', async () => {
  const controller = new AbortController();
  let finish;
  const decoding = new Promise((resolve) => {
    finish = resolve;
  });
  const h = fixture(external, { decode: () => decoding });
  const promise = loadProductionImage(original(external), {
    ...h.options,
    signal: controller.signal,
  });
  void promise.catch(() => {});
  const deadline = Date.now() + 10000;
  while (!h.allocations.length && Date.now() < deadline) await flush();
  assert.equal(h.allocations.length, 1);
  controller.abort();
  await assert.rejects(promise, /cancelled/i);
  assert.equal(h.revoked.length, 1);
  finish();
  await flush();
  assert.equal(h.allocations.length, 1);
  assert.equal(h.revoked.length, 1);
});

test('Production exact original404 cannot admit a corrupted pinned fallback pack', async () => {
  const h = fixture(embedded);
  h.options.fetchSource = async (url) => {
    h.calls.push({ url });
    if (url === rootURL + embedded.sourceImagePath) return new Response('', { status: 404 });
    assert.equal(url, rootURL + embedded.source.path);
    const bytes = new Uint8Array(await read(embedded.source.path));
    bytes[100] ^= 1;
    return new Response(bytes);
  };
  await assert.rejects(loadProductionImage(original(embedded), h.options), /hash differs/i);
  assert.equal(h.calls.length, 2);
  assert.equal(h.allocations.length, 0);
});
