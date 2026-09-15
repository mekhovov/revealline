import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { MessageChannel } from 'node:worker_threads';
import { createServer } from 'node:http';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { offlineAvailability, prepareOffline, checkOffline } from '../offline.mjs';
const template = await fs.readFile(
  new URL('../offline/service-worker.template.js', import.meta.url),
  'utf8',
);
const digest = (b) =>
  createHash('sha256')
    .update(b instanceof ArrayBuffer ? new Uint8Array(b) : b)
    .digest('hex');
const scope = 'https://game.example/releases/v2/site/';
const marker = {
  format: 'revealline-offline.v1',
  version: '2',
  buildId: 'a'.repeat(64),
  scope: '../',
  worker: '../service-worker.js',
};
const documentRef = { querySelector: () => ({ content: JSON.stringify(marker) }) };
const locationRef = { href: `${scope}game/` };
function host(configPatch = {}, storage = new Map(), options = {}) {
  const entries = new Map(
    options.entries ?? [
      ['game/index.html', '<title>Game</title>'],
      ['game/app.mjs', 'export const game=true;'],
      ['authoring/motion-lab/animation.mjs', 'export const animation=true;'],
    ],
  );
  const config = {
    format: 'revealline-offline.v1',
    version: '2',
    buildId: 'a'.repeat(64),
    files: [...entries].map(([path, bytes]) => ({
      path,
      bytes: Buffer.byteLength(bytes),
      sha256: digest(bytes),
    })),
    ...configPatch,
  };
  const network = new Map([...entries].map(([path, body]) => [new URL(path, scope).href, body]));
  const caches = {
    async keys() {
      return [...storage.keys()];
    },
    async delete(key) {
      return storage.delete(key);
    },
    async open(key) {
      if (!storage.has(key)) storage.set(key, new Map());
      const data = storage.get(key);
      return {
        async match(url) {
          return data.get(typeof url === 'string' ? url : url.url)?.clone();
        },
        async put(url, response) {
          const keyURL = typeof url === 'string' ? url : url.url;
          await options.beforePut?.({ key, url: keyURL, response });
          const bytes = await response.arrayBuffer();
          data.set(
            keyURL,
            new Response([204, 205].includes(response.status) ? null : bytes, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            }),
          );
          writes.push({ key, url: keyURL });
        },
      };
    },
  };
  const handlers = {},
    calls = [],
    writes = [];
  let claimed = 0;
  const self = {
    registration: { scope },
    clients: {
      async claim() {
        claimed++;
      },
    },
    addEventListener(name, fn) {
      handlers[name] = fn;
    },
  };
  const context = {
    self,
    caches,
    crypto: webcrypto,
    URL,
    Request,
    Response,
    Headers,
    AbortController,
    Uint8Array,
    console,
    fetch: async (request) => {
      const url = typeof request === 'string' ? request : request.url;
      calls.push(url);
      if (options.fetch) return options.fetch(request);
      if (!network.has(url)) throw Error('offline');
      const value = network.get(url);
      return typeof value === 'function' ? value(request) : new Response(value);
    },
  };
  vm.runInNewContext(template.replace('__XONIX_OFFLINE_CONFIG__', JSON.stringify(config)), context);
  async function dispatch(name, event = {}) {
    let wait, reply;
    handlers[name]({
      ...event,
      waitUntil(value) {
        wait = value;
      },
      respondWith(value) {
        reply = value;
      },
    });
    if (wait) await wait;
    return reply ? await reply : null;
  }
  async function report(url = `${scope}game/`) {
    let report;
    await dispatch('message', {
      data: { type: 'revealline.offline-check' },
      source: { url },
      ports: [
        {
          postMessage(value) {
            report = value;
          },
        },
      ],
    });
    return report;
  }
  return {
    config,
    network,
    caches,
    storage,
    calls,
    writes,
    dispatch,
    report,
    get claimed() {
      return claimed;
    },
  };
}

test('offline source pages have no registration side effect and reject explicit preparation without build marker', async () => {
  let registrations = 0;
  const env = {
    documentRef: { querySelector: () => null },
    locationRef,
    navigatorRef: {
      serviceWorker: {
        register() {
          registrations++;
        },
      },
    },
    secure: true,
  };
  assert.equal(offlineAvailability(env).available, false);
  await assert.rejects(prepareOffline(env), /packaged release/);
  assert.equal(registrations, 0);
  assert.equal(offlineAvailability({ ...env, documentRef, secure: false }).available, false);
  assert.equal(offlineAvailability({ ...env, documentRef, secure: true }).available, true);
});

test('scope metadata rejects a remote worker or a sibling app', () => {
  for (const changed of [
    { worker: 'https://other.example/worker.js' },
    { scope: '../../different/', worker: '../../different/service-worker.js' },
    { buildId: 'bad' },
  ]) {
    const env = {
      documentRef: {
        querySelector: () => ({ content: JSON.stringify({ ...marker, ...changed }) }),
      },
      locationRef,
      navigatorRef: { serviceWorker: {} },
      secure: true,
    };
    assert.equal(offlineAvailability(env).available, false);
  }
});

test('install verifies all shipped bytes and activate removes only this exact scope previous versions', async () => {
  const h = host(),
    prefix = `revealline-offline:${encodeURIComponent(scope)}:`;
  await h.caches.open(`${prefix}old`);
  await h.caches.open(
    `revealline-offline:${encodeURIComponent('https://game.example/releases/v1/site/')}:old`,
  );
  await h.caches.open('another-app');
  await h.dispatch('install');
  assert.equal(h.claimed, 0);
  assert.equal((await h.report()).status, 'ready');
  assert.equal(h.calls.length, 3);
  await h.dispatch('activate');
  assert.equal(h.claimed, 1);
  assert.ok(!(await h.caches.keys()).includes(`${prefix}old`));
  assert.ok((await h.caches.keys()).includes('another-app'));
  assert.equal((await h.caches.keys()).length, 3);
});

test('failed network or integrity prevents installation and preserves the active previous cache', async () => {
  const h = host(),
    old = `revealline-offline:${encodeURIComponent(scope)}:previous`;
  await h.caches.open(old);
  h.network.set(`${scope}game/app.mjs`, 'changed behind immutable URL');
  await assert.rejects(h.dispatch('install'), /integrity|byte budget/);
  assert.deepEqual(await h.caches.keys(), [old]);
  assert.equal((await h.report()).status, 'not-ready');
  await assert.rejects(h.dispatch('activate'), /Incomplete/);
  assert.equal(h.claimed, 0);
});

test('a cached version supports nested navigations and sibling shipped assets with no network', async () => {
  const h = host();
  await h.dispatch('install');
  await h.dispatch('activate');
  h.network.clear();
  h.calls.length = 0;
  const html = await h.dispatch('fetch', { request: new Request(`${scope}game/?practice=1`) });
  assert.equal(await html.text(), '<title>Game</title>');
  const asset = await h.dispatch('fetch', {
    request: new Request(`${scope}authoring/motion-lab/animation.mjs`),
  });
  assert.match(await asset.text(), /animation=true/);
  assert.equal(h.calls.length, 0);
});

test('worker never intercepts another release, remote URL, unknown route or mutating request', async () => {
  const h = host();
  await h.dispatch('install');
  for (const request of [
    new Request('https://game.example/releases/v1/site/game/'),
    new Request('https://other.example/game/'),
    new Request(`${scope}private.json`),
    new Request(`${scope}game/app.mjs`, { method: 'POST' }),
  ])
    assert.equal(await h.dispatch('fetch', { request }), null);
  assert.equal(await h.report('https://game.example/game/'), undefined);
});

test('self-check detects corrupt and missing files without a network request', async () => {
  const h = host();
  await h.dispatch('install');
  h.calls.length = 0;
  const key = (await h.caches.keys())[0],
    data = h.storage.get(key);
  data.delete(`${scope}game/app.mjs`);
  data.set(`${scope}game/index.html`, new Response('corrupt'));
  const report = await h.report();
  assert.equal(report.status, 'not-ready');
  assert.deepEqual([...report.missing], ['game/app.mjs']);
  assert.deepEqual([...report.corrupt], ['game/index.html']);
  assert.equal(h.calls.length, 0);
});

test('a missing file may repair from its expected bytes but cannot mix another deployed version into active code', async () => {
  const h = host();
  await h.dispatch('install');
  const data = h.storage.get((await h.caches.keys())[0]);
  data.delete(`${scope}game/app.mjs`);
  let result = await h.dispatch('fetch', { request: new Request(`${scope}game/app.mjs`) });
  assert.equal(result.status, 200);
  assert.ok(data.has(`${scope}game/app.mjs`));
  data.delete(`${scope}game/app.mjs`);
  h.network.set(`${scope}game/app.mjs`, 'export const dangerousMix=true;');
  result = await h.dispatch('fetch', { request: new Request(`${scope}game/app.mjs`) });
  assert.equal(result.status, 503);
  assert.equal(data.has(`${scope}game/app.mjs`), false);
});

test('cached complete install is reused offline without redownloading resources', async () => {
  const h = host();
  await h.dispatch('install');
  h.calls.length = 0;
  h.network.clear();
  await h.dispatch('install');
  assert.equal(h.calls.length, 0);
  assert.equal((await h.report()).status, 'ready');
});

test('explicit preparation and later verification expose a bounded worker report; waiting updates never skip waiting', async () => {
  let registrations = 0,
    checks = 0;
  const worker = {
    state: 'installed',
    postMessage(message, ports) {
      assert.ok(['revealline.offline-check', 'revealline.offline-prepare'].includes(message.type));
      checks++;
      ports[0].postMessage({
        status: 'ready',
        buildId: marker.buildId,
        count: 3,
        verified: 3,
        bytes: 123,
      });
      ports[0].close();
    },
  };
  const registration = { scope, waiting: worker, active: { old: true } };
  const navigatorRef = {
    serviceWorker: {
      async register(url, options) {
        registrations++;
        assert.equal(url, `${scope}service-worker.js`);
        assert.equal(options.scope, scope);
        return registration;
      },
      async getRegistration() {
        return registration;
      },
    },
  };
  const env = {
    documentRef,
    locationRef,
    navigatorRef,
    secure: true,
    MessageChannelImpl: MessageChannel,
  };
  const statuses = [];
  const result = await prepareOffline({ ...env, onStatus: (s) => statuses.push(s.status) });
  assert.equal(result.status, 'waiting');
  assert.deepEqual(statuses, ['preparing', 'waiting']);
  assert.equal(registrations, 1);
  assert.equal((await checkOffline(env)).status, 'ready');
  assert.equal(registrations, 1);
  assert.equal(checks, 2);
  assert.doesNotMatch(template, /self\.skipWaiting\s*\(/);
});

test('explicit prepare repairs an evicted file after reconnection without discarding other scopes', async () => {
  const h = host();
  await h.dispatch('install');
  const data = h.storage.get((await h.caches.keys())[0]);
  data.delete(`${scope}game/app.mjs`);
  let result;
  await h.dispatch('message', {
    data: { type: 'revealline.offline-prepare' },
    source: { url: `${scope}game/` },
    ports: [
      {
        postMessage(value) {
          result = value;
        },
      },
    ],
  });
  assert.equal(result.status, 'ready');
  assert.ok(data.has(`${scope}game/app.mjs`));
});

const oneFile = (body, options = {}) =>
  host({}, new Map(), { entries: [['game/data.bin', body]], ...options });
const currentCache = (h) =>
  h.storage.get(`revealline-offline:${encodeURIComponent(scope)}:${'a'.repeat(64)}`);

function streamed(chunks, { fail = false } = {}) {
  let index = 0,
    cancelled = false;
  const body = new ReadableStream(
    {
      pull(controller) {
        if (index < chunks.length) controller.enqueue(chunks[index++]);
        else if (fail) controller.error(new Error('body transport failed'));
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return {
    body,
    get cancelled() {
      return cancelled;
    },
  };
}

test('network bodies are consumed once without cloning and reconstructed with decoded headers', async () => {
  const data = new TextEncoder().encode('verified content'),
    stream = streamed([data.subarray(0, 3), data.subarray(3)]),
    response = new Response(stream.body, {
      status: 203,
      statusText: 'Non-Authoritative Information',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'gzip',
        'Content-Length': '2',
        'Content-Security-Policy': "default-src 'self'",
        'Cache-Control': 'no-cache',
        Vary: 'Accept-Encoding, Accept-Language',
        ETag: '"source-tag"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  response.clone = () => {
    throw new Error('Network response must not be cloned');
  };
  const h = oneFile(data, { fetch: async () => response });
  await h.dispatch('install');
  assert.equal(response.bodyUsed, true);
  assert.equal(response.body.locked, false);
  const cached = currentCache(h).get(`${scope}game/data.bin`);
  assert.equal(await cached.clone().text(), 'verified content');
  assert.equal(cached.status, 203);
  assert.equal(cached.statusText, 'Non-Authoritative Information');
  assert.equal(cached.headers.get('Content-Encoding'), null);
  assert.equal(cached.headers.get('Content-Length'), String(data.byteLength));
  for (const name of [
    'Content-Type',
    'Content-Security-Policy',
    'Cache-Control',
    'Vary',
    'ETag',
    'X-Content-Type-Options',
  ])
    assert.equal(cached.headers.get(name), response.headers.get(name));
  h.calls.length = 0;
  assert.equal((await h.report()).status, 'ready');
  assert.equal(h.calls.length, 0);
});

test('stream overruns are cancelled before copying and malformed bodies never create a cache', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const cases = [
    { name: 'large chunk', chunks: [new Uint8Array([1, 2, 3, 4])], cancel: true },
    { name: 'trailing chunk', chunks: [bytes, new Uint8Array([4])], cancel: true },
    { name: 'truncated', chunks: [bytes.subarray(0, 2)] },
    { name: 'errored', chunks: [bytes.subarray(0, 2)], fail: true },
    { name: 'non-byte chunk', chunks: ['123'], cancel: true },
    { name: 'wrong hash', chunks: [new Uint8Array([1, 2, 4])] },
  ];
  for (const entry of cases) {
    const stream = streamed(entry.chunks, entry),
      response = new Response(stream.body),
      h = oneFile(bytes, { fetch: async () => response });
    await assert.rejects(h.dispatch('install'), /byte budget|integrity|transport/, entry.name);
    assert.equal(response.body.locked, false, entry.name);
    if (entry.cancel) assert.equal(stream.cancelled, true, entry.name);
    assert.equal(h.storage.size, 0, entry.name);
    assert.equal(h.writes.length, 0, entry.name);
  }
  const h = oneFile(bytes, { fetch: async () => new Response(null) });
  await assert.rejects(h.dispatch('install'), /integrity/);
  assert.equal(h.storage.size, 0);
});

test('generated byte and file budgets reject malformed inventory before body allocation or fetch', () => {
  const file = { path: 'game/data.bin', bytes: 0, sha256: digest('') };
  for (const bytes of [-1, 0.5, Number.MAX_SAFE_INTEGER, 64 * 1024 * 1024 + 1])
    assert.throws(() => host({ files: [{ ...file, bytes }] }), /byte budget/);
  assert.throws(
    () =>
      host({
        files: [
          { ...file, bytes: 64 * 1024 * 1024 },
          { ...file, path: 'game/other.bin', bytes: 1 },
        ],
      }),
    /byte budget/,
  );
  assert.throws(
    () => host({ files: Array.from({ length: 2001 }, (_, i) => ({ ...file, path: `game/${i}` })) }),
    /file budget/,
  );
});

test('redirects, opaque/error and non-cacheable network responses remain rejected', async () => {
  const variants = [
    () => Object.defineProperty(new Response('ok'), 'redirected', { value: true }),
    () => Object.defineProperty(new Response('ok'), 'type', { value: 'opaque' }),
    () => Response.error(),
    () => new Response('ok', { status: 404 }),
    () => new Response('ok', { status: 206 }),
    () => new Response('ok', { headers: { Vary: 'Accept-Encoding, *' } }),
  ];
  for (const variant of variants) {
    const h = oneFile('ok', { fetch: async () => variant() });
    await assert.rejects(h.dispatch('install'), /integrity/);
    assert.equal(h.storage.size, 0);
    assert.equal(h.writes.length, 0);
  }
});

test('valid empty 200, 204 and 205 bodies retain status and an accurate zero length', async () => {
  for (const status of [200, 204, 205]) {
    const h = oneFile('', { fetch: async () => new Response(null, { status, statusText: '' }) });
    await h.dispatch('install');
    const response = currentCache(h).get(`${scope}game/data.bin`);
    assert.equal(response.status, status);
    assert.equal(response.statusText, '');
    assert.equal(response.headers.get('Content-Length'), '0');
    assert.equal((await response.clone().arrayBuffer()).byteLength, 0);
    assert.equal((await h.report()).status, 'ready');
  }
});

test('actual illustrated Workshop bytes survive both install and missing-file repair', async () => {
  const bytes = await fs.readFile(
    new URL('../content/packs/equipment-workshop.json', import.meta.url),
  );
  assert.equal(bytes.byteLength, 11127024);
  assert.equal(digest(bytes), 'a015f79c47d8bac6cd09ba04e50c0c98d759e523eea7d225edbe62a8a5254054');
  let responses = 0;
  const h = host({}, new Map(), {
    entries: [['game/content/packs/equipment-workshop.json', bytes]],
    fetch: async () => {
      responses++;
      const response = new Response(bytes, { headers: { 'Content-Type': 'application/json' } });
      response.clone = () => {
        throw new Error('Retained network clone');
      };
      return response;
    },
  });
  await h.dispatch('install');
  const url = `${scope}game/content/packs/equipment-workshop.json`,
    cache = currentCache(h);
  assert.equal(digest(await cache.get(url).clone().arrayBuffer()), digest(bytes));
  cache.delete(url);
  const repaired = await h.dispatch('fetch', { request: new Request(url) });
  assert.equal(repaired.status, 200);
  assert.equal(digest(await repaired.arrayBuffer()), digest(bytes));
  assert.equal(digest(await cache.get(url).clone().arrayBuffer()), digest(bytes));
  assert.equal(responses, 2);
  assert.equal((await h.report()).status, 'ready');
});

test('native fetch gzip and brotli decoding produces cacheable owned payloads with preserved policy', async () => {
  const bytes = Buffer.from('compressed original body '.repeat(200)),
    compressed = { gzip: gzipSync(bytes), br: brotliCompressSync(bytes) },
    server = createServer((request, response) => {
      const encoding = request.url.slice(1);
      response.writeHead(200, {
        'Content-Encoding': encoding,
        'Content-Length': compressed[encoding].length,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Security-Policy': "default-src 'self'",
        'Cache-Control': 'no-cache',
        Vary: 'Accept-Encoding',
      });
      response.end(compressed[encoding]);
    });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const encoding of ['gzip', 'br']) {
      let upstream;
      const h = oneFile(bytes, {
        fetch: async () => {
          upstream = await fetch(`http://127.0.0.1:${server.address().port}/${encoding}`);
          return upstream;
        },
      });
      await h.dispatch('install');
      const cached = currentCache(h).get(`${scope}game/data.bin`);
      assert.equal(upstream.headers.get('Content-Encoding'), encoding);
      assert.equal(upstream.headers.get('Content-Length'), String(compressed[encoding].length));
      assert.equal(digest(await cached.clone().arrayBuffer()), digest(bytes));
      assert.equal(cached.headers.get('Content-Encoding'), null);
      assert.equal(cached.headers.get('Content-Length'), String(bytes.length));
      for (const name of ['Content-Type', 'Content-Security-Policy', 'Cache-Control', 'Vary'])
        assert.equal(cached.headers.get(name), upstream.headers.get(name));
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('all downloads finish before a new cache exists and the older build stays exact until activation', async () => {
  for (const valid of [true, false]) {
    let release, reached;
    const wait = new Promise((resolve) => {
        release = resolve;
      }),
      pending = new Promise((resolve) => {
        reached = resolve;
      }),
      old = `revealline-offline:${encodeURIComponent(scope)}:previous`,
      h = host();
    h.storage.set(old, new Map([[`${scope}game/index.html`, new Response('old exact bytes')]]));
    h.network.set(`${scope}authoring/motion-lab/animation.mjs`, async () => {
      reached();
      await wait;
      return new Response(valid ? 'export const animation=true;' : 'mismatch');
    });
    const installing = h.dispatch('install');
    await pending;
    assert.deepEqual(await h.caches.keys(), [old]);
    assert.equal(h.writes.length, 0);
    assert.equal(
      await h.storage.get(old).get(`${scope}game/index.html`).clone().text(),
      'old exact bytes',
    );
    release();
    if (valid) {
      await installing;
      assert.equal(h.writes.at(-1).url, `${scope}.offline-ready`);
      assert.equal(
        await h.storage.get(old).get(`${scope}game/index.html`).clone().text(),
        'old exact bytes',
      );
      assert.equal(h.claimed, 0);
      await h.dispatch('activate');
      assert.equal(h.storage.has(old), false);
    } else {
      await assert.rejects(installing, /integrity/);
      assert.deepEqual(await h.caches.keys(), [old]);
      assert.equal(
        await h.storage.get(old).get(`${scope}game/index.html`).clone().text(),
        'old exact bytes',
      );
    }
  }
});

test(
  'installation overlaps at most four downloads and publishes in inventory order only after every body verifies',
  { timeout: 3000 },
  async () => {
    const deferred = () => {
        let resolve;
        const promise = new Promise((done) => {
          resolve = done;
        });
        return { promise, resolve };
      },
      entries = Array.from({ length: 9 }, (_, i) => [`game/${i}.txt`, `verified body ${i}`]),
      started = entries.map(deferred),
      release = entries.map(deferred);
    let active = 0,
      peak = 0;
    const h = host({}, new Map(), {
      entries,
      async fetch(request) {
        const index = entries.findIndex(([name]) => request.url === `${scope}${name}`);
        active++;
        peak = Math.max(peak, active);
        started[index].resolve();
        await release[index].promise;
        active--;
        return new Response(entries[index][1]);
      },
    });
    const installing = h.dispatch('install');
    await Promise.all(started.slice(0, 4).map((entry) => entry.promise));
    assert.equal(h.calls.length, 4);
    assert.equal(h.storage.size, 0);
    release[3].resolve();
    await started[4].promise;
    assert.equal(h.calls.length, 5);
    assert.equal(h.writes.length, 0);
    assert.equal(h.storage.size, 0);
    release.forEach((entry) => entry.resolve());
    await installing;
    assert.equal(peak, 4);
    assert.equal(active, 0);
    assert.deepEqual(
      h.writes.map(({ url }) => url),
      [...entries.map(([name]) => `${scope}${name}`), `${scope}.offline-ready`],
    );
    const report = await h.report();
    assert.equal(report.status, 'ready');
    assert.equal(report.verified, entries.length);
  },
);

test(
  'a failed parallel download aborts active requests, stops the queue and preserves the previous cache',
  { timeout: 3000 },
  async () => {
    const entries = Array.from({ length: 8 }, (_, i) => [`game/${i}.txt`, `verified body ${i}`]),
      old = `revealline-offline:${encodeURIComponent(scope)}:previous`;
    let fail,
      allStarted,
      aborted = 0;
    const pending = new Promise((resolve) => {
        allStarted = resolve;
      }),
      h = host({}, new Map([[old, new Map([['kept', new Response('old exact bytes')]])]]), {
        entries,
        fetch(request) {
          const first = request.url === `${scope}${entries[0][0]}`;
          const response = new Promise((resolve, reject) => {
            if (first) fail = () => resolve(new Response('wrong hash'));
            else
              request.signal.addEventListener(
                'abort',
                () => {
                  aborted++;
                  reject(request.signal.reason);
                },
                { once: true },
              );
          });
          if (h.calls.length === 4) allStarted();
          return response;
        },
      });
    const rejected = assert.rejects(h.dispatch('install'), /integrity|byte budget/);
    await pending;
    fail();
    await rejected;
    assert.equal(h.calls.length, 4);
    assert.equal(aborted, 3);
    assert.equal(h.writes.length, 0);
    assert.deepEqual(await h.caches.keys(), [old]);
    assert.equal(await h.storage.get(old).get('kept').clone().text(), 'old exact bytes');
    assert.equal(h.claimed, 0);
  },
);

test(
  'simultaneous prepare requests share one install and can retry after a failed download',
  { timeout: 3000 },
  async () => {
    let release,
      started,
      fail = true;
    const pending = new Promise((resolve) => {
        started = resolve;
      }),
      wait = new Promise((resolve) => {
        release = resolve;
      }),
      h = oneFile('verified body', {
        async fetch() {
          started();
          await wait;
          return new Response(fail ? 'incorrect body' : 'verified body');
        },
      });
    const prepare = async () => {
      let report;
      await h.dispatch('message', {
        data: { type: 'revealline.offline-prepare' },
        source: { url: `${scope}game/` },
        ports: [
          {
            postMessage(value) {
              report = value;
            },
          },
        ],
      });
      return report;
    };
    const first = prepare(),
      second = prepare();
    await pending;
    assert.equal(h.calls.length, 1);
    release();
    for (const report of await Promise.all([first, second])) {
      assert.equal(report.status, 'error');
      assert.match(report.message, /integrity|byte budget/);
    }
    assert.equal(h.storage.size, 0);
    fail = false;
    for (const report of await Promise.all([prepare(), prepare()]))
      assert.equal(report.status, 'ready');
    assert.equal(h.calls.length, 2);
    assert.equal((await h.report()).status, 'ready');
  },
);

test(
  'native streaming downloads abort after another file fails verification',
  { timeout: 5000 },
  async () => {
    let releaseFailure, receivedBody, closedStream, upstream;
    const failureReady = new Promise((resolve) => {
        releaseFailure = resolve;
      }),
      bodyReady = new Promise((resolve) => {
        receivedBody = resolve;
      }),
      streamClosed = new Promise((resolve) => {
        closedStream = resolve;
      }),
      server = createServer(async (request, response) => {
        if (request.url.endsWith('/bad.txt')) {
          await failureReady;
          response.end('xxxxxx');
        } else {
          response.on('close', closedStream);
          response.writeHead(200, { 'Content-Length': 6 });
          response.write('abc');
        }
      });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const h = host({}, new Map(), {
        entries: [
          ['game/bad.txt', 'abcdef'],
          ['game/slow.txt', 'abcdef'],
        ],
        async fetch(request) {
          const response = await fetch(
            `http://127.0.0.1:${server.address().port}/${new URL(request.url).pathname.split('/').at(-1)}`,
            { signal: request.signal },
          );
          if (request.url.endsWith('/slow.txt')) {
            upstream = response;
            receivedBody();
          }
          return response;
        },
      });
      const rejected = assert.rejects(h.dispatch('install'), /integrity/);
      await bodyReady;
      releaseFailure();
      await rejected;
      await streamClosed;
      assert.equal(upstream.bodyUsed, true);
      assert.equal(upstream.body.locked, false);
      assert.equal(h.storage.size, 0);
      assert.equal(h.writes.length, 0);
    } finally {
      releaseFailure();
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  },
);

test('asset and marker cache-write failures clean only the partial build and never claim clients', async () => {
  for (const failedPath of ['game/app.mjs', '.offline-ready']) {
    const old = `revealline-offline:${encodeURIComponent(scope)}:previous`,
      other = 'another-app',
      storage = new Map([old, other].map((key) => [key, new Map([['kept', new Response(key)]])])),
      h = host({}, storage, {
        beforePut: ({ url }) => {
          if (url === `${scope}${failedPath}`) throw new Error('simulated cache write failure');
        },
      });
    await assert.rejects(h.dispatch('install'), /cache write failure/);
    assert.deepEqual(await h.caches.keys(), [old, other]);
    for (const key of [old, other])
      assert.equal(await storage.get(key).get('kept').clone().text(), key);
    await assert.rejects(h.dispatch('activate'), /Incomplete/);
    assert.equal(h.claimed, 0);
    // This checks our activation handler's guard, not browser old-worker rollback.
    assert.deepEqual(await h.caches.keys(), [old, other]);
  }
});

test('repair cache-write failure returns 503 and keeps unrelated verified entries', async () => {
  let fail = false;
  const h = host({}, new Map(), {
    beforePut: ({ url }) => {
      if (fail && url === `${scope}game/app.mjs`) throw new Error('repair cache failure');
    },
  });
  await h.dispatch('install');
  const cache = currentCache(h),
    untouched = await cache.get(`${scope}game/index.html`).clone().text(),
    marker = await cache.get(`${scope}.offline-ready`).clone().text();
  cache.delete(`${scope}game/app.mjs`);
  fail = true;
  const response = await h.dispatch('fetch', { request: new Request(`${scope}game/app.mjs`) });
  assert.equal(response.status, 503);
  assert.equal(cache.has(`${scope}game/app.mjs`), false);
  assert.equal(await cache.get(`${scope}game/index.html`).clone().text(), untouched);
  assert.equal(await cache.get(`${scope}.offline-ready`).clone().text(), marker);
});

test('optional pack preparation and verification explicitly distinguish core cache from already-installed device packs', async () => {
  const optionalMarker = {
    ...marker,
    optionalPacks: [
      {
        path: 'game/content/packs/fpv-arcade.json',
        id: 'fpv-arcade',
        name: 'FPV Front · First Light',
      },
    ],
  };
  const worker = {
    state: 'activated',
    postMessage(_message, ports) {
      ports[0].postMessage({ status: 'ready', buildId: marker.buildId, verified: 3, bytes: 123 });
      ports[0].close();
    },
  };
  const registration = { scope, active: worker, waiting: null, installing: null };
  const env = {
    documentRef: { querySelector: () => ({ content: JSON.stringify(optionalMarker) }) },
    locationRef,
    secure: true,
    navigatorRef: {
      serviceWorker: {
        register: async () => registration,
        getRegistration: async () => registration,
      },
    },
    MessageChannelImpl: MessageChannel,
  };
  const available = offlineAvailability(env);
  assert.match(available.note, /First Light.*install once while online/);
  assert.match(available.note, /Already-installed packs/);
  const messages = [];
  const result = await prepareOffline({ ...env, onStatus: (s) => messages.push(s.message) });
  assert.equal(result.status, 'ready');
  assert.ok(messages.every((m) => m.includes('install once while online')));
  assert.match((await checkOffline(env)).message, /install once while online/);
  optionalMarker.optionalPacks = [{ name: 42 }];
  assert.equal(offlineAvailability(env).available, false);
});
