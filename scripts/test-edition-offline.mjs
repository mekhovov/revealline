import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { buildEditionOfflineFiles } from './edition-offline.mjs';
import { validateCompanyInstallationReference } from '../game/edition-context.mjs';

async function build(editionId = 'coupa', options = {}) {
  return buildEditionOfflineFiles({
    files: new Map([
      ['game/company.html', Buffer.from('<!doctype html><head></head><main>Game</main>')],
      ['game/logo.svg', Buffer.from('<svg/>')],
    ]),
    editionId,
    version: '0.140.0',
    basePath: '/revealline/',
    name: editionId,
    iconPath: 'game/logo.svg',
    ...options,
  });
}
function worker(files, { corrupt = false, respond, stores = new Map(), clientURL } = {}) {
  const inventory = JSON.parse(files.get('offline-cache.json'));
  const scope = `https://game.test/revealline/editions/${inventory.editionId}/releases/v${inventory.version.replace(/^v/, '')}/site/`;
  const cacheName = `revealline-company-${encodeURIComponent(scope)}-${inventory.buildId}`;
  if (!stores.has(cacheName)) stores.set(cacheName, new Map());
  const cache = stores.get(cacheName),
    handlers = new Map(),
    requests = [];
  const self = {
    registration: { scope },
    clients: { get: async () => ({ url: clientURL ?? `${scope}game/company.html` }) },
    addEventListener: (type, handler) => handlers.set(type, handler),
  };
  const caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const target = stores.get(name);
      return {
        match: async (key) => target.get(key)?.clone(),
        put: async (key, response) => target.set(key, response.clone()),
      };
    },
  };
  const fetch = async (url) => {
    requests.push(url);
    const path = url.slice(scope.length);
    const value = files.get(path);
    const custom = respond?.(path, value);
    if (custom) return custom;
    return new Response(corrupt && path === 'game/logo.svg' ? 'corrupt' : value, {
      status: value ? 200 : 404,
    });
  };
  vm.runInNewContext(files.get('service-worker.js').toString(), {
    self,
    caches,
    fetch,
    URL,
    Response,
    Headers,
    crypto: webcrypto,
    Uint8Array,
    Map,
    encodeURIComponent,
  });
  const dispatch = async (type, event = {}) => {
    let work;
    handlers.get(type)({
      ...event,
      waitUntil: (promise) => {
        work = promise;
      },
      respondWith: (promise) => {
        work = promise;
      },
    });
    return work;
  };
  return { scope, cache, requests, dispatch };
}

test('offline artifacts are reproducible with distinct stable app IDs and scoped workers', async () => {
  const a = await build(),
    b = await build(),
    other = await build('droneaid');
  assert.deepEqual(a, b);
  assert.equal(JSON.parse(a.get('app/manifest.webmanifest')).id, '/revealline/editions/coupa/');
  assert.notEqual(
    JSON.parse(a.get('app/manifest.webmanifest')).id,
    JSON.parse(other.get('app/manifest.webmanifest')).id,
  );
  assert.match(a.get('game/company.html').toString(), /rel="manifest"/);
  assert.ok(a.has('app/icon.svg'));
  const inventory = JSON.parse(a.get('offline-cache.json'));
  assert.equal(
    inventory.files.some((row) => row.path === 'service-worker.js'),
    false,
  );
  assert.equal(
    inventory.files.some((row) => row.path === 'offline-cache.json'),
    false,
  );
  assert.equal(inventory.files.length, a.size - 2);
});

test('real generated worker verifies all files, serves offline, and scopes messages', async () => {
  const files = await build(),
    runtime = worker(files);
  await runtime.dispatch('install');
  assert.equal(runtime.requests.length, JSON.parse(files.get('offline-cache.json')).files.length);
  let receipt;
  await runtime.dispatch('message', {
    data: { type: 'verify-company-edition' },
    source: { id: 'page' },
    ports: [
      {
        postMessage: (value) => {
          receipt = value;
        },
      },
    ],
  });
  assert.equal(receipt.status, 'ready');
  const response = await runtime.dispatch('fetch', {
    request: { method: 'GET', url: `${runtime.scope}game/company.html?continue=1` },
  });
  assert.equal(await response.text(), files.get('game/company.html').toString());
  const foreign = await runtime.dispatch('fetch', {
    request: {
      method: 'GET',
      url: 'https://game.test/revealline/editions/droneaid/game/company.html',
    },
  });
  assert.equal(foreign, undefined);
  runtime.cache.set(`${runtime.scope}game/logo.svg`, new Response('changed'));
  await runtime.dispatch('message', {
    data: { type: 'verify-company-edition' },
    source: { id: 'page' },
    ports: [
      {
        postMessage: (value) => {
          receipt = value;
        },
      },
    ],
  });
  assert.equal(receipt.status, 'error');
});

test('corrupt downloads refuse worker installation and over-budget editions are refused', async () => {
  const runtime = worker(await build(), { corrupt: true });
  await assert.rejects(runtime.dispatch('install'), /differs/);
  const files = new Map([['game/company.html', Buffer.from('game')]]);
  for (let i = 0; i < 2001; i++) files.set(`game/f-${i}.json`, Buffer.from('{}'));
  await assert.rejects(
    buildEditionOfflineFiles({ files, editionId: 'coupa', version: '1.0.0' }),
    /2000 files/,
  );
});

test('offline downloads stop and cancel overlong streams before allocating the advertised body', async () => {
  const files = await build();
  for (const announced of [false, true]) {
    let pulls = 0,
      cancelled = false;
    const runtime = worker(files, {
      respond: (path) =>
        path === 'game/logo.svg'
          ? new Response(
              new ReadableStream(
                {
                  pull(controller) {
                    pulls++;
                    controller.enqueue(new Uint8Array(7));
                  },
                  cancel() {
                    cancelled = true;
                  },
                },
                { highWaterMark: 0 },
              ),
              { headers: announced ? { 'content-length': '999999999' } : {} },
            )
          : null,
    });
    await assert.rejects(runtime.dispatch('install'), /length differs/);
    assert.equal(cancelled, true);
    assert.equal(pulls, announced ? 0 : 1);
    assert.equal(runtime.cache.has(`${runtime.scope}game/logo.svg`), false);
  }
  const runtime = worker(files, {
    respond: (path) => (path === 'game/logo.svg' ? new Response('broken') : null),
  });
  await assert.rejects(runtime.dispatch('install'), /hash differs/);
});

test('launcher identity and palette are branded before scripts run and reject CSS injection', async () => {
  const files = await build('droneaid', {
    name: 'DroneAid <script> & friends',
    palette: { ink: '#123456', paper: '#fefefe', accent: '#cdef01' },
  });
  const manifest = JSON.parse(files.get('app/manifest.webmanifest'));
  assert.equal(manifest.theme_color, '#123456');
  assert.equal(manifest.background_color, '#fefefe');
  assert.equal(manifest.icons[0].type, 'image/svg+xml');
  const html = files.get('app/index.html').toString();
  assert.match(html, /DroneAid &lt;script&gt; &amp; friends/);
  assert.ok(
    html.includes('color:#123456') &&
      html.includes('background:#fefefe') &&
      html.includes('solid #cdef01'),
  );
  assert.ok(html.includes('<img src="./icon.svg" alt="">'));
  assert.ok(!html.includes('<script> & friends'));
  await assert.rejects(
    build('droneaid', { palette: { ink: '</style><script>bad()</script>' } }),
    /fixed hex/,
  );
});

test('manifest raster icon format and dimensions come from the original image bytes', async () => {
  const icon = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZXkAAAAASUVORK5CYII=',
    'base64',
  );
  const files = new Map([
    ['game/company.html', Buffer.from('<head></head>')],
    ['game/logo.png', icon],
  ]);
  const built = await build('coupa', { files, iconPath: 'game/logo.png' });
  assert.deepEqual(JSON.parse(built.get('app/manifest.webmanifest')).icons[0], {
    src: './icon.png',
    sizes: '1x1',
    type: 'image/png',
    purpose: 'any',
  });
  files.set('game/logo.png', Buffer.from('wrong format'));
  await assert.rejects(build('coupa', { files, iconPath: 'game/logo.png' }), /icon bytes/);
});

test('an active unchanged worker repairs only evicted or corrupt files after an interrupted download', async () => {
  const files = await build();
  let interrupted = true;
  const runtime = worker(files, {
    respond(path) {
      if (interrupted && path === 'game/logo.svg') throw new Error('connection interrupted');
    },
  });
  await assert.rejects(runtime.dispatch('install'), /interrupted/);
  const already = new Set(runtime.cache.keys());
  assert.ok(already.size > 0);
  interrupted = false;
  runtime.requests.length = 0;
  let receipt;
  const send = (type, source = 'page') =>
    runtime.dispatch('message', {
      data: { type },
      source: { id: source },
      ports: [
        {
          postMessage: (value) => {
            receipt = value;
          },
        },
      ],
    });
  await send('repair-company-edition');
  assert.equal(receipt.status, 'ready');
  assert.ok(runtime.requests.every((url) => !already.has(url)));
  runtime.requests.length = 0;
  runtime.cache.delete(`${runtime.scope}game/logo.svg`);
  runtime.cache.set(`${runtime.scope}game/company.html`, new Response('stale HTML'));
  await send('verify-company-edition');
  assert.equal(receipt.status, 'error');
  assert.equal(runtime.requests.length, 0, 'verification must not silently download or repair');
  await send('repair-company-edition');
  assert.equal(receipt.status, 'ready');
  assert.deepEqual(
    new Set(runtime.requests),
    new Set([`${runtime.scope}game/logo.svg`, `${runtime.scope}game/company.html`]),
  );
});

test('failed update and foreign-client repair cannot change a retained release or another edition cache', async () => {
  const stores = new Map(),
    oldFiles = await build(),
    old = worker(oldFiles, { stores });
  await old.dispatch('install');
  const retained = new Map(
    await Promise.all(
      [...old.cache].map(async ([url, response]) => [url, await response.clone().text()]),
    ),
  );
  const update = worker(await build('coupa', { version: '0.141.0' }), { stores, corrupt: true });
  await assert.rejects(update.dispatch('install'), /differs/);
  assert.equal(stores.size, 2);
  for (const [url, body] of retained) assert.equal(await old.cache.get(url).clone().text(), body);
  const response = await old.dispatch('fetch', {
    request: { method: 'GET', url: `${old.scope}game/company.html` },
  });
  assert.equal(await response.text(), oldFiles.get('game/company.html').toString());
  const other = worker(await build('droneaid'), { stores });
  await other.dispatch('install');
  assert.equal(stores.size, 3);
  assert.notEqual(other.cache, old.cache);
  const foreign = worker(oldFiles, { stores, clientURL: `${other.scope}game/company.html` });
  let receipt;
  await foreign.dispatch('message', {
    data: { type: 'repair-company-edition' },
    source: { id: 'foreign' },
    ports: [
      {
        postMessage: (value) => {
          receipt = value;
        },
      },
    ],
  });
  assert.equal(receipt.status, 'error');
  assert.equal(foreign.requests.length, 0);
  for (const [url, body] of retained) assert.equal(await old.cache.get(url).clone().text(), body);
});

test('generated stable launcher opens verified active and retained release links and rejects foreign update pointers', async () => {
  const files = await build(),
    nodes = new Map(),
    values = new Map();
  const root = 'https://game.test/revealline/editions/coupa/';
  const reference = (version) => ({
    editionId: 'coupa',
    version,
    scope: `${root}releases/v${version}/site/`,
    entry: 'game/company.html',
    buildId: 'ab'.repeat(32),
  });
  const state = { active: reference('0.140.0'), previous: reference('0.139.0') };
  values.set('revealline.company-installed.coupa.v1', JSON.stringify(state));
  let candidate = { ...reference('0.141.0'), scope: '../releases/v0.141.0/site/' };
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, { hidden: true });
      return nodes.get(id);
    },
  };
  assert.ok(
    files.has('app/edition-context.mjs'),
    'the stable launcher carries its dependency without relying on the immutable game directory',
  );
  const script = files
    .get('app/app.mjs')
    .toString()
    .replace(/^import[^\n]+\n/, '');
  vm.runInNewContext(script, {
    document,
    location: { href: `${root}app/`, origin: new URL(root).origin },
    localStorage: { getItem: (key) => values.get(key) },
    URL,
    navigator: {},
    validateCompanyInstallationReference,
    fetch: async () => ({ ok: true, json: async () => candidate }),
  });
  assert.equal(nodes.get('play').href.href, `${state.active.scope}game/company.html`);
  assert.equal(nodes.get('previous').href.href, `${state.previous.scope}game/company.html`);
  await nodes.get('check').onclick();
  assert.equal(nodes.get('prepare').href.href, `${root}releases/v0.141.0/site/game/company.html`);
  candidate = {
    ...candidate,
    scope: 'https://elsewhere.test/revealline/editions/coupa/releases/v0.141.0/site/',
  };
  await nodes.get('check').onclick();
  assert.match(nodes.get('status').textContent, /matching published edition/);
  assert.equal(values.get('revealline.company-installed.coupa.v1'), JSON.stringify(state));
});
