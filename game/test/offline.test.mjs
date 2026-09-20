import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { MessageChannel } from 'node:worker_threads';
import { createServer } from 'node:http';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { offlineAvailability, prepareOffline, checkOffline } from '../offline.mjs';
import { CONTENT_PROJECT_ITEM_LIMITS } from '../content-design/limits.mjs';
import { waitFor } from './helpers/wait-for.mjs';
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
          await options.beforeMatch?.({ key, url });
          const entry = data.get(typeof url === 'string' ? url : url.url);
          assert.ok(!entry?.bodyUsed, `Cached response was consumed: ${url}`);
          return entry?.clone();
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
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args),
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
  const checked = await checkOffline(env);
  assert.equal(checked.status, 'waiting');
  assert.match(checked.message, /Close all tabs/);
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
  const report = await h.report();
  assert.equal(report.status, 'ready', report.message);
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
  const summaries = [];
  const result = await prepareOffline({
    ...env,
    onStatus: (s) => {
      messages.push(s.message);
      summaries.push(s.summary);
    },
  });
  assert.equal(result.status, 'ready');
  assert.ok(messages.every((m) => m.includes('install once while online')));
  assert.ok(summaries.every((summary) => summary && !summary.includes('First Light')));
  for (let i = 0; i < messages.length; i++)
    assert.equal(messages[i], `${summaries[i]} ${available.note}`);
  const checked = await checkOffline(env);
  assert.match(checked.message, /install once while online/);
  assert.equal(checked.message, `${checked.summary} ${available.note}`);
  registration.active = null;
  registration.waiting = worker;
  worker.state = 'installed';
  for (const waiting of [await prepareOffline(env), await checkOffline(env)]) {
    assert.equal(waiting.status, 'waiting');
    assert.match(waiting.summary, /^Update saved\. Close all tabs/);
    assert.equal(waiting.message, `${waiting.summary} ${available.note}`);
  }
  optionalMarker.optionalPacks = [{ name: 42 }];
  assert.equal(offlineAvailability(env).available, false);
});

test('optional Journey artwork never receives a core-offline readiness claim', async () => {
  const optionalArtwork = {
    name: 'Journey candidate artwork',
    availability: 'online-only',
    count: 10,
    bytes: 25862573,
  };
  const artworkMarker = { ...marker, optionalArtwork };
  const worker = {
    state: 'activated',
    postMessage(_message, ports) {
      ports[0].postMessage({ status: 'ready', buildId: marker.buildId, verified: 3, bytes: 123 });
      ports[0].close();
    },
  };
  const registration = { scope, active: worker, waiting: null, installing: null };
  const env = {
    documentRef: { querySelector: () => ({ content: JSON.stringify(artworkMarker) }) },
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
  for (const name of ['Opening Journey artwork', 'Journey candidate artwork']) {
    artworkMarker.optionalArtwork = { ...optionalArtwork, name };
    const available = offlineAvailability(env);
    assert.equal(available.available, true);
    assert.match(available.note, new RegExp(name));
  }
  artworkMarker.optionalArtwork = optionalArtwork;
  assert.match(offlineAvailability(env).note, /artwork is not included in offline preparation/);
  const reports = [];
  for (const operation of [prepareOffline, checkOffline]) {
    const result = await operation({ ...env, onStatus: (report) => reports.push(report) });
    assert.equal(result.status, 'ready');
    assert.match(result.message, /web preview needs an online connection/);
    assert.match(result.message, /full downloaded distribution includes the original pictures/);
  }
  for (const report of reports.filter((report) => report.status === 'ready'))
    assert.match(report.message, /not included in offline preparation/);
  for (const bad of [
    null,
    {},
    { ...optionalArtwork, count: CONTENT_PROJECT_ITEM_LIMITS.assets + 1 },
    { ...optionalArtwork, bytes: 0 },
    { ...optionalArtwork, availability: 'ready' },
    { ...optionalArtwork, name: 'Unknown artwork' },
  ]) {
    artworkMarker.optionalArtwork = bad;
    assert.equal(offlineAvailability(env).available, false);
  }
});

const PROTOCOL = 'revealline.offline-progress.v1';
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const until = (predicate) =>
  waitFor(predicate, { message: 'Expected asynchronous observation did not arrive' });
function observedHost(h, state = 'activated') {
  const listeners = new Set(),
    pending = [],
    requests = [];
  const worker = {
    state,
    scriptURL: `${scope}service-worker.js`,
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    postMessage(data, ports) {
      requests.push(data);
      pending.push(
        h.dispatch('message', {
          data,
          ports: structuredClone(ports, { transfer: ports }),
          source: { url: locationRef.href },
        }),
      );
    },
  };
  const registration = {
    scope,
    active: state === 'activated' ? worker : null,
    waiting: state === 'installed' ? worker : null,
    installing: state === 'installing' ? worker : null,
  };
  const env = {
    documentRef,
    locationRef,
    secure: true,
    MessageChannelImpl: MessageChannel,
    navigatorRef: {
      serviceWorker: {
        register: async () => registration,
        getRegistration: async () => registration,
      },
    },
  };
  function change(next) {
    worker.state = next;
    registration.installing = next === 'installing' ? worker : null;
    registration.waiting = next === 'installed' ? worker : null;
    registration.active = next === 'activated' ? worker : null;
    for (const listener of listeners) listener();
  }
  return { worker, registration, env, listeners, pending, requests, change };
}

test('a measured installing-worker download survives more than sixty seconds and separates downloaded, verified and saved work', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const entries = [
      ['game/first', 'first'],
      ['game/second', 'second'],
      ['game/third', 'third'],
    ],
    release = entries.map(deferred),
    h = host({}, new Map(), {
      entries,
      async fetch(request) {
        const i = entries.findIndex(([path]) => request.url === `${scope}${path}`);
        await release[i].promise;
        return new Response(entries[i][1]);
      },
    }),
    observed = observedHost(h, 'installing'),
    statuses = [];
  const installing = h.dispatch('install').then(() => observed.change('installed'));
  let ended = false;
  const preparing = prepareOffline({ ...observed.env, onStatus: (s) => statuses.push(s) }).finally(
    () => {
      ended = true;
    },
  );
  await until(() => statuses.some((s) => s.stage === 'downloading'));
  for (let i = 0; i < entries.length; i++) {
    t.mock.timers.tick(40000);
    assert.equal(ended, false, 'a progressing installation must not hit the old total deadline');
    release[i].resolve();
    await until(() =>
      statuses.some((s) => s.stage === 'downloading' && s.progress?.completed === i + 1),
    );
  }
  await installing;
  const result = await preparing;
  assert.equal(result.status, 'waiting');
  assert.match(result.message, /Close all tabs/);
  for (const s of statuses.filter((s) => s.stage === 'downloading')) {
    assert.equal(s.progress.completed, s.downloadVerified);
    assert.equal(s.downloaded >= s.downloadVerified, true);
    assert.equal(s.saved, 0);
    assert.equal(s.progress.total, entries.length);
  }
  const saved = statuses.find(
    (s) => s.stage === 'saving' && s.progress.completed === entries.length,
  );
  assert.equal(saved.saved, entries.length);
  assert.equal(saved.downloadVerified, entries.length);
  assert.ok(
    statuses.some((s) => s.stage === 'verifying' && s.progress.completed === entries.length),
  );
  assert.equal(h.writes.at(-1).url, `${scope}.offline-ready`);
  assert.equal(h.calls.length, entries.length);
  assert.equal(observed.listeners.size, 0);
  await Promise.all(observed.pending);
});

test('an installation observation timeout is recoverable; reopening and two tabs rejoin the same download', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const release = deferred(),
    h = oneFile('shared body', {
      async fetch() {
        await release.promise;
        return new Response('shared body');
      },
    }),
    observed = observedHost(h, 'installing'),
    firstStatuses = [];
  const installing = h.dispatch('install').then(() => observed.change('activated'));
  const first = prepareOffline({ ...observed.env, onStatus: (s) => firstStatuses.push(s) });
  await until(() => firstStatuses.some((s) => s.stage === 'downloading'));
  t.mock.timers.tick(60001);
  assert.equal((await first).status, 'still-running');
  assert.equal(observed.listeners.size, 0);
  const firstCount = firstStatuses.length,
    nextStatuses = [];
  const second = prepareOffline({ ...observed.env, onStatus: (s) => nextStatuses.push(s) });
  const third = checkOffline(observed.env);
  await until(() => nextStatuses.some((s) => s.stage === 'downloading'));
  assert.equal(h.calls.length, 1);
  release.resolve();
  await installing;
  for (const report of await Promise.all([second, third])) assert.equal(report.status, 'ready');
  assert.equal(
    firstStatuses.length,
    firstCount,
    'late completion must not revive the detached caller',
  );
  assert.equal(h.calls.length, 1);
  assert.equal(h.writes.filter((w) => w.url.endsWith('.offline-ready')).length, 1);
  await Promise.all(observed.pending);
});

test('closing an observer aborts only that caller; background installation completes and cached reopening does not fetch', async () => {
  const release = deferred(),
    h = oneFile('kept', {
      async fetch(request) {
        await release.promise;
        assert.equal(request.signal.aborted, false);
        return new Response('kept');
      },
    }),
    observed = observedHost(h, 'installing'),
    controller = new AbortController(),
    statuses = [];
  const installing = h.dispatch('install').then(() => observed.change('activated'));
  const first = prepareOffline({
    ...observed.env,
    signal: controller.signal,
    onStatus: (s) => statuses.push(s),
  });
  await until(() => statuses.some((s) => s.stage === 'downloading'));
  const rejection = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  await rejection;
  const count = statuses.length;
  assert.equal(observed.listeners.size, 0);
  release.resolve();
  await installing;
  await Promise.all(observed.pending);
  const cache = currentCache(h);
  assert.equal(await cache.get(`${scope}game/data.bin`).clone().text(), 'kept');
  const writes = h.writes.length;
  assert.equal((await prepareOffline(observed.env)).status, 'ready');
  assert.equal((await checkOffline(observed.env)).status, 'ready');
  assert.equal(h.calls.length, 1);
  assert.equal(h.writes.length, writes);
  assert.equal(statuses.length, count);
});

test('separate report timeout and cancellation during cached verification preserve storage and do not start preparation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let block = false;
  const release = deferred(),
    reached = deferred(),
    h = host({}, new Map(), {
      async beforeMatch() {
        if (block) {
          reached.resolve();
          await release.promise;
        }
      },
    });
  await h.dispatch('install');
  const observed = observedHost(h),
    writes = h.writes.length,
    calls = h.calls.length;
  block = true;
  const statuses = [],
    first = checkOffline({ ...observed.env, timeout: 30000, onStatus: (s) => statuses.push(s) });
  await reached.promise;
  await until(() => statuses.length > 1);
  t.mock.timers.tick(30001);
  assert.equal((await first).status, 'unconfirmed');
  const controller = new AbortController(),
    second = checkOffline({ ...observed.env, signal: controller.signal });
  await until(() => observed.requests.length === 2);
  const rejected = assert.rejects(second, { name: 'AbortError' });
  controller.abort();
  await rejected;
  release.resolve();
  await Promise.all(observed.pending);
  block = false;
  assert.equal((await checkOffline(observed.env)).status, 'ready');
  assert.equal(h.writes.length, writes);
  assert.equal(h.calls.length, calls);
  assert.ok(observed.requests.every((r) => r.type === 'revealline.offline-check'));
});

test('a historical terminal-only worker remains compatible while a silent old install times out truthfully', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = host(),
    observed = observedHost(h, 'installing');
  let port;
  observed.worker.postMessage = (_request, ports) => {
    port = ports[0];
  };
  const first = prepareOffline(observed.env);
  await until(() => port);
  t.mock.timers.tick(60001);
  assert.equal((await first).status, 'still-running');
  observed.change('activated');
  observed.worker.postMessage = (_request, ports) => {
    ports[0].postMessage({ status: 'ready', buildId: marker.buildId, verified: 3 });
    ports[0].close();
  };
  assert.equal((await prepareOffline(observed.env)).status, 'ready');
  assert.equal((await checkOffline(observed.env)).status, 'ready');
});

test('versioned progress rejects mismatched build or scope before downloads and ignores a stale request completion', async () => {
  for (const patch of [{ buildId: 'b'.repeat(64) }, { scope: `${scope}sibling/` }]) {
    const h = host(),
      messages = [],
      port = { postMessage: (r) => messages.push(r), close() {} };
    await h.dispatch('message', {
      data: {
        type: 'revealline.offline-prepare',
        protocol: PROTOCOL,
        requestId: 'mismatch',
        buildId: marker.buildId,
        scope,
        ...patch,
      },
      source: { url: locationRef.href },
      ports: [port],
    });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].kind, 'terminal');
    assert.equal(messages[0].status, 'not-ready');
    assert.equal(h.calls.length, 0);
    assert.equal(h.storage.size, 0);
  }
  const observed = observedHost(host()),
    statuses = [];
  let complete;
  observed.worker.postMessage = (request, ports) => {
    const envelope = {
      format: PROTOCOL,
      requestId: request.requestId,
      scope,
      buildId: marker.buildId,
    };
    ports[0].postMessage({
      ...envelope,
      requestId: 'older-request',
      kind: 'terminal',
      status: 'ready',
    });
    ports[0].postMessage({
      ...envelope,
      kind: 'progress',
      stage: 'saving',
      progress: { completed: 2, total: 1, unit: 'files' },
    });
    complete = () => {
      ports[0].postMessage({ ...envelope, kind: 'terminal', status: 'ready', verified: 3 });
      ports[0].close();
    };
  };
  let ended = false;
  const preparing = prepareOffline({ ...observed.env, onStatus: (s) => statuses.push(s) }).finally(
    () => {
      ended = true;
    },
  );
  await until(() => statuses.length === 2);
  assert.equal(statuses[1].progress, null, 'invalid measured progress is never rendered');
  assert.equal(ended, false, 'an earlier request cannot complete a newer observer');
  complete();
  assert.equal((await preparing).status, 'ready');
  observed.worker.postMessage = (request, ports) => {
    ports[0].postMessage({
      format: PROTOCOL,
      requestId: request.requestId,
      scope,
      buildId: 'b'.repeat(64),
      kind: 'terminal',
      status: 'ready',
    });
    ports[0].close();
  };
  await assert.rejects(prepareOffline(observed.env), /different build/);
  assert.equal((await checkOffline(observed.env)).status, 'not-ready');
});

test('a changed or redundant worker cannot publish success to an old observation', async () => {
  for (const change of ['superseded', 'redundant', 'wrong-script']) {
    const observed = observedHost(host());
    let complete;
    observed.worker.postMessage = (request, ports) => {
      complete = () => {
        ports[0].postMessage({
          format: PROTOCOL,
          requestId: request.requestId,
          scope,
          buildId: marker.buildId,
          kind: 'terminal',
          status: 'ready',
        });
        ports[0].close();
      };
    };
    const pending = prepareOffline(observed.env);
    await until(() => complete);
    const rejected = assert.rejects(pending, /worker changed|download failed|does not match/i);
    if (change === 'superseded') observed.registration.installing = { state: 'installing' };
    if (change === 'redundant') observed.change('redundant');
    if (change === 'wrong-script') observed.worker.scriptURL = `${scope}other-worker.js`;
    complete();
    await rejected;
    assert.equal(observed.listeners.size, 0);
  }
});

test('streamed integrity, missing-file and quota failures remain real failures with no ready claim', async () => {
  for (const fault of ['integrity', 'quota']) {
    const old = `revealline-offline:${encodeURIComponent(scope)}:previous`,
      storage = new Map([[old, new Map([['kept', new Response('old')]])]]),
      h = host({}, storage, {
        entries: [['game/data.bin', 'valid']],
        fetch: async () => new Response(fault === 'integrity' ? 'wrong' : 'valid'),
        beforePut() {
          if (fault === 'quota')
            throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
        },
      }),
      observed = observedHost(h),
      statuses = [];
    await assert.rejects(
      prepareOffline({ ...observed.env, onStatus: (s) => statuses.push(s) }),
      /integrity|quota/,
    );
    assert.ok(statuses.every((s) => !['ready', 'waiting'].includes(s.status)));
    assert.deepEqual(await h.caches.keys(), [old]);
    assert.equal(await storage.get(old).get('kept').clone().text(), 'old');
  }
  const h = host();
  await h.dispatch('install');
  currentCache(h).delete(`${scope}game/app.mjs`);
  currentCache(h).set(`${scope}game/index.html`, new Response('corrupt'));
  const result = await checkOffline(observedHost(h).env);
  assert.equal(result.status, 'not-ready');
  assert.deepEqual([...result.missing], ['game/app.mjs']);
  assert.deepEqual([...result.corrupt], ['game/index.html']);
  assert.equal(h.calls.length, 3);
});

test('versioned subscribers release on detach, completion, expiry and capacity while shared install keeps running', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const release = deferred(),
    h = oneFile('body', {
      async fetch() {
        await release.promise;
        return new Response('body');
      },
    });
  const records = [];
  const subscribe = (id, protocol = PROTOCOL) => {
    const record = { id, messages: [], closed: false };
    const port = {
      postMessage(r) {
        record.messages.push(r);
      },
      close() {
        record.closed = true;
      },
    };
    record.port = port;
    record.done = h.dispatch('message', {
      data: {
        type: 'revealline.offline-prepare',
        protocol,
        requestId: id,
        scope,
        buildId: marker.buildId,
      },
      source: { url: locationRef.href },
      ports: [port],
    });
    records.push(record);
    return record;
  };
  const first = subscribe('first'),
    terminalOnly = subscribe('legacy', null);
  await until(() => first.messages.some((s) => s.stage === 'downloading'));
  first.port.onmessage({ data: { type: 'revealline.offline-detach', requestId: 'first' } });
  const firstCount = first.messages.length;
  for (let i = 0; i < 65; i++) subscribe(`tab-${i}`);
  assert.equal(records.find((r) => r.id === 'tab-0').closed, true);
  t.mock.timers.tick(5 * 60 * 1000 + 1);
  assert.ok(records.filter((r) => r !== terminalOnly).every((r) => r.closed));
  assert.equal(h.calls.length, 1);
  assert.equal(h.writes.length, 0);
  release.resolve();
  await Promise.all(records.map((r) => r.done));
  assert.equal(first.messages.length, firstCount);
  assert.equal(terminalOnly.messages.length, 1);
  assert.equal(terminalOnly.messages[0].status, 'ready');
  assert.equal(terminalOnly.messages[0].kind, undefined);
  assert.equal((await h.report()).status, 'ready');
});

test('aborting while registration is pending detaches promptly and never unregisters the eventual worker', async () => {
  const observed = observedHost(host()),
    registration = deferred(),
    controller = new AbortController();
  observed.env.navigatorRef.serviceWorker.register = () => registration.promise;
  const first = prepareOffline({ ...observed.env, signal: controller.signal });
  const rejected = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  await rejected;
  registration.resolve(observed.registration);
  await nextTurn();
  assert.equal(observed.requests.length, 0);
  assert.equal(observed.listeners.size, 0);
});

test('prepare joins a pending cached inspection before repair and final verification uses the repaired bytes', async () => {
  const release = deferred(),
    reached = deferred();
  let pause = false,
    matched = 0;
  const h = host({}, new Map(), {
    async beforeMatch({ url }) {
      if (pause && url === `${scope}game/index.html`) {
        matched++;
        reached.resolve();
        await release.promise;
      }
    },
  });
  await h.dispatch('install');
  currentCache(h).delete(`${scope}game/app.mjs`);
  const observed = observedHost(h);
  pause = true;
  const checking = checkOffline(observed.env);
  await reached.promise;
  const preparing = prepareOffline(observed.env);
  await until(() => observed.requests.length === 2);
  assert.equal(matched, 1, 'preparation must join the already-running inspection');
  pause = false;
  release.resolve();
  assert.equal((await checking).status, 'not-ready');
  assert.equal((await preparing).status, 'ready');
  assert.equal(h.calls.length, 6);
  assert.equal((await h.report()).status, 'ready');
});
