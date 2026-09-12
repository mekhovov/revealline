import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { MessageChannel } from 'node:worker_threads';
import { offlineAvailability, prepareOffline, checkOffline } from '../offline.mjs';
const template = await fs.readFile(
  new URL('../offline/service-worker.template.js', import.meta.url),
  'utf8',
);
const digest = (b) => createHash('sha256').update(b).digest('hex');
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
function host(configPatch = {}, storage = new Map()) {
  const entries = new Map([
    ['game/index.html', '<title>Game</title>'],
    ['game/app.mjs', 'export const game=true;'],
    ['authoring/motion-lab/animation.mjs', 'export const animation=true;'],
  ]);
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
          data.set(typeof url === 'string' ? url : url.url, response.clone());
        },
      };
    },
  };
  const handlers = {},
    calls = [];
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
    console,
    fetch: async (request) => {
      const url = typeof request === 'string' ? request : request.url;
      calls.push(url);
      if (!network.has(url)) throw Error('offline');
      return new Response(network.get(url));
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
  await assert.rejects(h.dispatch('install'), /integrity/);
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
