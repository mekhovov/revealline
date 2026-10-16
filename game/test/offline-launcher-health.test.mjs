import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { memoryCaches } from './helpers/official-caches.mjs';

test('launcher health detects eviction without fetching and repair verifies only missing shell files', async () => {
  const scope = 'https://game.example/revealline/app/',
    contents = new Map([
      ['index.html', 'launcher'],
      ['app.mjs', 'script'],
    ]);
  const config = {
    id: 'fixture',
    files: [...contents].map(([path, value]) => ({
      path,
      bytes: Buffer.byteLength(value),
      sha256: createHash('sha256').update(value).digest('hex'),
    })),
  };
  const handlers = new Map(),
    caches = memoryCaches(),
    requests = [];
  let corrupt = false;
  const source = (
    await readFile(new URL('../offline/app-worker.template.js', import.meta.url), 'utf8')
  ).replace('__REVEALLINE_LAUNCHER_CONFIG__', JSON.stringify(config));
  vm.runInNewContext(source, {
    self: {
      registration: { scope },
      clients: { claim: async () => {} },
      addEventListener: (type, handler) => handlers.set(type, handler),
    },
    caches,
    crypto: webcrypto,
    URL,
    Uint8Array,
    Response,
    Headers,
    fetch: async (url) => {
      requests.push(url);
      return new Response(
        corrupt ? 'damaged!' : contents.get(new URL(url).pathname.split('/').at(-1)),
      );
    },
  });
  let operation;
  handlers.get('install')({
    waitUntil: (promise) => {
      operation = promise;
    },
  });
  await operation;
  assert.equal(requests.length, 2);
  const cache = await caches.open(`revealline-launcher:${encodeURIComponent(scope)}:fixture`);
  await cache.delete(new URL('index.html', scope).href);
  async function message(type) {
    let result;
    handlers.get('message')({
      data: { type, requestId: 'one' },
      ports: [
        {
          postMessage: (value) => {
            result = value;
          },
        },
      ],
      waitUntil: (promise) => {
        operation = promise;
      },
    });
    await operation;
    return result;
  }
  assert.equal((await message('revealline.launcher-check')).status, 'incomplete');
  assert.equal(requests.length, 2);
  corrupt = true;
  assert.equal((await message('revealline.launcher-prepare')).status, 'incomplete');
  assert.equal(await cache.match(new URL('index.html', scope).href), undefined);
  corrupt = false;
  assert.equal((await message('revealline.launcher-prepare')).status, 'ready');
  assert.equal(requests.length, 4);
  assert.equal((await message('revealline.launcher-check')).status, 'ready');
  assert.equal(requests.length, 4);
});

test('returning from an updater uses the cached launcher while update resources stay network-only', async () => {
  const template = await readFile(
    new URL('../offline/app-worker.template.js', import.meta.url),
    'utf8',
  );
  for (const scope of ['https://game.example/app/', 'https://game.example/revealline/app/']) {
    const config = {
        id: 'return-navigation',
        files: [{ path: 'index.html' }, { path: 'app.mjs' }],
      },
      handlers = new Map(),
      caches = memoryCaches(),
      requests = [];
    let unavailable = '503';
    const cache = await caches.open(
      `revealline-launcher:${encodeURIComponent(scope)}:${config.id}`,
    );
    await cache.put(new URL('index.html', scope).href, new Response('cached launcher'));
    await cache.put(new URL('app.mjs', scope).href, new Response('cached script'));
    vm.runInNewContext(template.replace('__REVEALLINE_LAUNCHER_CONFIG__', JSON.stringify(config)), {
      self: {
        registration: { scope },
        clients: { get: async () => ({ url: new URL('update.html?check=1', scope).href }) },
        addEventListener: (type, handler) => handlers.set(type, handler),
      },
      caches,
      URL,
      fetch: async (request, options) => {
        requests.push({ url: request.url, cache: options?.cache });
        if (unavailable === 'throw') throw new TypeError('Network unavailable');
        return new Response('Origin unavailable', { status: 503 });
      },
    });
    const request = (relative, mode) => {
      let response;
      handlers.get('fetch')({
        clientId: 'updater',
        request: { url: new URL(relative, scope).href, method: 'GET', mode },
        respondWith: (value) => {
          response = value;
        },
      });
      return response;
    };
    for (unavailable of ['503', 'throw'])
      for (const route of ['./?manage', 'index.html?manage']) {
        const response = await request(route, 'navigate');
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'cached launcher');
      }
    assert.equal(requests.length, 0, 'Returning to a prepared launcher needs no origin request.');
    unavailable = '503';
    for (const [route, mode] of [
      ['update.html?check=2', 'navigate'],
      ['app.mjs', 'cors'],
      ['index.html', 'cors'],
      ['../game/overflight/app.mjs', 'cors'],
      ['other.html', 'navigate'],
    ]) {
      assert.equal((await request(route, mode)).status, 503);
      assert.equal(requests.at(-1).cache, 'no-store');
    }
    assert.equal(
      requests.length,
      5,
      'Updater documents and imported resources never use old bytes.',
    );
  }
});

test('installed launch preserves only opted-in controller diagnostics and its selected edition', async () => {
  const source = (await readFile(new URL('../offline/app.mjs', import.meta.url), 'utf8'))
    .replace(/import \{[\s\S]*?\} from '\.\/installed-app\.mjs';/, '')
    .replace(/import \{[^;]*\} from '\.\/i18n\/index\.mjs';/, '')
    .replace(/import \{[^;]*\} from '\.\/ui\/launcher-navigation\.mjs';/, '')
    .replace(/import \{[^;]*\} from '\.\/edition-context\.mjs';/, '');
  for (const query of ['?controllerTrace=1&journey=untrusted', '?controllerTrace=0', '']) {
    const elements = new Map(),
      replacements = [],
      selected = {
        version: 'v0.141.7',
        scope: 'https://game.example/revealline/releases/v0.141.7/site/',
      };
    vm.runInNewContext(source, {
      document: {
        getElementById: (id) => {
          if (!elements.has(id)) elements.set(id, {});
          return elements.get(id);
        },
      },
      window: { addEventListener() {} },
      location: {
        href: `https://game.example/revealline/app/${query}`,
        replace: (url) => replacements.push(url),
      },
      URL,
      attachLauncherNavigation: () => {},
      editionIdFromLocation: () => null,
      readInstalledState: () => ({ active: selected }),
      validateInstalledEdition: (edition) => edition,
      installedPresentation: () => true,
      localizedText: () => {},
      t: (key) => key,
      fetch: () => {
        throw new Error('Installed launch must not select a newer edition.');
      },
    });
    const expected = `${selected.scope}game/${query.includes('controllerTrace=1') ? '?controllerTrace=1' : ''}`;
    assert.deepEqual(replacements, [expected]);
    assert.equal(elements.get('play').href, expected);
    assert.equal(selected.version, 'v0.141.7');
  }
});
