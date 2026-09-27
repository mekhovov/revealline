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
