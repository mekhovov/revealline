import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { readCurrentArtImage } from '../presentation/current-art.mjs';
import { loadProductionImage } from '../../authoring/production/preview.mjs';
import { buildSentinelTheme } from '../../authoring/library/sentinel-theme-chapters/build.mjs';

const rootURL = 'https://art.test/site/';
const template = await readFile(
  new URL('../offline/service-worker.template.js', import.meta.url),
  'utf8',
);
const embedded = CURRENT_ART_SOURCES.find(
  (row) => row.kind === 'embedded' && row.source.kind === 'optional' && row.sourceImagePath,
);
const external = CURRENT_ART_SOURCES.find(
  (row) => row.kind === 'external' && row.source.descriptorId === 'sentinel-circuit-coupa',
);
const pins = (source) =>
  source.kind === 'external' ? [source.source.pack, source.source.media] : [source.source];
let externalBodies;
async function body(relative) {
  if (relative.startsWith('optional/external-chapters/sentinel-circuit-coupa/')) {
    externalBodies ??= buildSentinelTheme('coupa');
    const { payloads } = await externalBodies;
    return Buffer.from(
      await payloads[relative.endsWith('pack.json') ? 'pack' : 'media'].arrayBuffer(),
    );
  }
  return readFile(new URL('../../' + relative, import.meta.url));
}
const imageFacts = async (blob) => {
  const data = new DataView(await blob.arrayBuffer());
  return { width: data.getUint32(16), height: data.getUint32(20), close() {} };
};
function imageOwner() {
  const active = new Map(),
    retired = [];
  let next = 0;
  return {
    active,
    retired,
    cryptoSource: webcrypto,
    urlAPI: {
      createObjectURL(blob) {
        const url = `blob:preview-${next++}`;
        active.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        active.delete(url);
        retired.push(url);
      },
    },
    makeImage() {
      return {
        removeAttribute() {
          delete this.src;
        },
        async decode() {
          const facts = await imageFacts(active.get(this.src));
          this.naturalWidth = facts.width;
          this.naturalHeight = facts.height;
        },
      };
    },
  };
}
function worker({
  source = embedded,
  offline = true,
  omitted = [source.sourceImagePath],
  configPatch = {},
  cached = new Map(),
} = {}) {
  const handlers = {},
    requests = [],
    network = [],
    writes = [],
    matches = [];
  const config = {
    files: [],
    downloadFiles: pins(source).map((pin) => ({ ...pin, kind: 'gameplay' })),
    omittedSourceOriginals: omitted,
    packageConsent: true,
    buildId: 'a'.repeat(64),
    ...configPatch,
  };
  const networkFetch = async (request) => {
    network.push(request.url);
    if (offline) throw new TypeError('Network offline');
    return new Response('unlisted network result', { status: 418 });
  };
  const context = {
    URL,
    Response,
    Headers,
    Request,
    Blob,
    Uint8Array,
    AbortController,
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
    console,
    self: {
      registration: { scope: rootURL },
      addEventListener(type, fn) {
        handlers[type] = fn;
      },
    },
    caches: {
      async open(name) {
        return {
          async match(key) {
            matches.push({ name, key });
            const value = cached.get(key);
            return value ? new Response(value.bytes, { headers: value.headers }) : undefined;
          },
          async put(key) {
            writes.push({ name, key });
            throw new Error('Reads must not write cache');
          },
        };
      },
    },
    fetch: networkFetch,
  };
  vm.runInNewContext(template.replace('__XONIX_OFFLINE_CONFIG__', JSON.stringify(config)), context);
  async function fetchSource(url, init) {
    const request = new Request(url, init);
    if (request.signal.aborted) throw request.signal.reason;
    requests.push(request.url);
    let reply;
    handlers.fetch({
      request,
      respondWith(value) {
        reply = Promise.resolve(value);
      },
    });
    return reply ?? networkFetch(request);
  }
  return { fetchSource, requests, network, writes, matches, config };
}
async function cachedWorker(source, options = {}) {
  const cached = new Map();
  for (const pin of pins(source))
    cached.set(`https://art.test/.revealline-official/sha256/${pin.sha256}`, {
      bytes: await body(pin.path),
      headers: { 'Content-Length': String(pin.bytes) },
    });
  return worker({ source, cached, ...options });
}
const productionEntry = (source) => ({
  role: 'original',
  file: { path: source.sourceImagePath, bytes: source.image.bytes, sha256: source.image.sha256 },
  width: source.image.width,
  height: source.image.height,
});

test('worker rejects malformed omission lists and collisions before accepting fetch events', () => {
  for (const omitted of [
    {},
    Array(257).fill('authoring/a.png'),
    [embedded.sourceImagePath, embedded.sourceImagePath],
    ['../authoring/a.png'],
    ['/authoring/a.png'],
    ['authoring/../a.png'],
    ['authoring/a%2fb.png'],
    ['authoring/a.png?x'],
    ['authoring/a.png#x'],
    ['https://outside.test/a.png'],
    ['game/a.png'],
    ['authoring/a.svg'],
    ['authoring/with space.png'],
    ['authoring/\\a.png'],
  ])
    assert.throws(() => worker({ omitted }), /omitted source-original/);
  for (const key of ['files', 'downloadFiles'])
    assert.throws(
      () =>
        worker({
          configPatch: {
            [key]: [
              {
                path: embedded.sourceImagePath,
                bytes: embedded.image.bytes,
                sha256: embedded.image.sha256,
              },
            ],
          },
        }),
      /Conflicting omitted/,
    );
  assert.doesNotThrow(() => worker({ configPatch: { omittedSourceOriginals: undefined } }));
});

test('only listed same-scope GET paths receive local404; unknown and no-store cache authorization stay unchanged', async () => {
  const h = await cachedWorker(embedded);
  for (const suffix of ['', '?preview=1']) {
    const response = await h.fetchSource(rootURL + embedded.sourceImagePath + suffix, {
      cache: 'no-store',
    });
    assert.equal(response.status, 404);
  }
  assert.deepEqual(h.network, []);
  assert.deepEqual(h.matches, []);
  for (const [url, init] of [
    [rootURL + 'authoring/unknown.png'],
    ['https://other.test/site/' + embedded.sourceImagePath],
    ['https://art.test/outside/' + embedded.sourceImagePath],
    [rootURL + embedded.sourceImagePath, { method: 'HEAD' }],
    [rootURL + embedded.source.path, { cache: 'no-store' }],
  ])
    await assert.rejects(h.fetchSource(url, init), /Network offline/);
  assert.equal(h.network.length, 5);
  assert.deepEqual(h.writes, []);
});

for (const source of [embedded, external]) {
  test(
    `real worker supplies exact ${source.kind} fallback to both readers online and offline without writes`,
    { timeout: 45000 },
    async () => {
      const expected = await body(source.sourceImagePath);
      for (const offline of [false, true]) {
        const h = await cachedWorker(source, { offline });
        const current = await readCurrentArtImage(source.id, {
          baseURL: rootURL,
          fetch: h.fetchSource,
          decodeImage: imageFacts,
        });
        assert.deepEqual(Buffer.from(current.bytes), expected);
        const owner = imageOwner();
        const production = await loadProductionImage(productionEntry(source), {
          rootURL,
          fetchSource: h.fetchSource,
          ...owner,
        });
        assert.deepEqual(
          Buffer.from(await owner.active.get(production.image.src).arrayBuffer()),
          expected,
        );
        assert.equal(production.image.naturalWidth, source.image.width);
        assert.equal(production.image.naturalHeight, source.image.height);
        production.dispose();
        assert.equal(owner.active.size, 0);
        assert.deepEqual(h.network, []);
        assert.deepEqual(h.writes, []);
        assert.equal(
          h.requests.filter((url) => url === rootURL + source.sourceImagePath).length,
          2,
        );
        for (const pin of pins(source))
          assert.equal(h.requests.filter((url) => url === rootURL + pin.path).length, 2);
      }
    },
  );
}

test('an off-list offline original cannot acquire a fallback merely because native bytes are cached', async () => {
  const h = await cachedWorker(embedded, { omitted: [] });
  await assert.rejects(
    readCurrentArtImage(embedded.id, { baseURL: rootURL, fetch: h.fetchSource }),
    /Network offline/,
  );
  await assert.rejects(
    loadProductionImage(productionEntry(embedded), { rootURL, fetchSource: h.fetchSource }),
    /Network offline/,
  );
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.matches, []);
  assert.deepEqual(h.writes, []);
});

test('worker404 leaves pin mismatches and cancellation as failures without cache writes', async () => {
  const bytes = Buffer.from(await body(embedded.source.path));
  bytes[100] ^= 1;
  const cached = new Map([
    [
      `https://art.test/.revealline-official/sha256/${embedded.source.sha256}`,
      { bytes, headers: { 'Content-Length': String(bytes.length) } },
    ],
  ]);
  const h = worker({ cached });
  await assert.rejects(
    readCurrentArtImage(embedded.id, { baseURL: rootURL, fetch: h.fetchSource }),
    /hash differs/i,
  );
  await assert.rejects(
    loadProductionImage(productionEntry(embedded), { rootURL, fetchSource: h.fetchSource }),
    /hash differs/i,
  );
  const fresh = await cachedWorker(embedded),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readCurrentArtImage(embedded.id, {
      baseURL: rootURL,
      fetch: fresh.fetchSource,
      signal: controller.signal,
    }),
    /cancelled/i,
  );
  await assert.rejects(
    loadProductionImage(productionEntry(embedded), {
      rootURL,
      fetchSource: fresh.fetchSource,
      signal: controller.signal,
    }),
    /cancelled/i,
  );
  assert.deepEqual(fresh.requests, []);
  assert.deepEqual(fresh.writes, []);
  assert.deepEqual(h.writes, []);
});
