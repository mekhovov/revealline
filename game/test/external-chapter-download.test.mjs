import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EXTERNAL_CATALOG,
  prepareExternalCatalog,
  loadExternalCatalog,
  prepareExternalDownload,
} from '../external-chapter-catalog.mjs';
import { sourceExternalChapter } from '../external-chapter-source.mjs';
import { buildRouteWorld } from '../../authoring/library/route-worlds/build.mjs';
const world = await buildRouteWorld('retro');
const item = EXTERNAL_CATALOG.chapters.find((i) => i.id === world.descriptor.id);
const decodeImage = async (blob) => {
  const b = Buffer.from(await blob.arrayBuffer());
  return { naturalWidth: b.readUInt32BE(16), naturalHeight: b.readUInt32BE(20) };
};
const body = async (path) =>
  path.endsWith('/pack.json') ? world.payloads.pack : world.payloads.media;

test('catalog requires all five exact code-owned descriptors; foreign metadata and accessor authority refuse', async () => {
  assert.equal(
    prepareExternalCatalog(
      await readFile(new URL('../content/external-worlds.json', import.meta.url), 'utf8'),
    ),
    EXTERNAL_CATALOG,
  );
  assert.equal(EXTERNAL_CATALOG.chapters.length, 5);
  assert.equal(EXTERNAL_CATALOG.chapters.at(-1).id, 'sentinel-circuit-fpv');
  for (const mutate of [
    (c) => c.chapters.reverse(),
    (c) => c.chapters.pop(),
    (c) => (c.chapters[1].media.path = 'https://foreign.test/a'),
    (c) => (c.chapters[1].media.sha256 = '0'.repeat(64)),
    (c) => c.chapters.push(c.chapters[0]),
  ]) {
    const c = structuredClone(EXTERNAL_CATALOG);
    mutate(c);
    assert.throws(() => prepareExternalCatalog(c));
  }
  assert.throws(() => sourceExternalChapter('foreign'));
  let called = 0;
  const c = {
    get format() {
      called++;
      return EXTERNAL_CATALOG.format;
    },
  };
  assert.throws(() => prepareExternalCatalog(c));
  assert.equal(called, 0);
  assert(Object.isFrozen(EXTERNAL_CATALOG.chapters[0].media));
});
for (const prefix of [
  'https://example.test/',
  'https://example.test/revealline/',
  'https://example.test/releases/v0.36.0/site/',
])
  test(`selected pair uses exact edition paths and actual descriptor/original validation: ${prefix}`, async () => {
    const requests = [];
    const prepared = await prepareExternalDownload(item.id, {
      baseURL: prefix,
      decodeImage,
      fetch: async (url, options) => {
        requests.push({ url, options });
        return new Response(await body(url));
      },
    });
    assert.deepEqual(prepared.descriptor, world.descriptor);
    assert.equal(requests.length, 2);
    for (const [i, kind] of ['pack', 'media'].entries()) {
      assert.equal(requests[i].url, new URL(item[kind].path, prefix).href);
      assert.equal(requests[i].options.redirect, 'error');
      assert.equal(requests[i].options.credentials, 'same-origin');
    }
  });

test('wrong hash, truncated second file, redirect and oversized stream never return an install preparation', async () => {
  const base = { baseURL: 'https://example.test/releases/v0.36.0/site/', decodeImage };
  let calls = 0;
  await assert.rejects(
    prepareExternalDownload(item.id, {
      ...base,
      fetch: async (url) => {
        calls++;
        const raw = Buffer.from(await (await body(url)).arrayBuffer());
        raw[raw.length - 1] ^= 1;
        return new Response(raw);
      },
    }),
    /differ|match/i,
  );
  assert.equal(calls, 2);
  await assert.rejects(
    prepareExternalDownload(item.id, {
      ...base,
      fetch: async (url) =>
        new Response(url.endsWith('/pack.json') ? world.payloads.pack : new Uint8Array(1)),
    }),
    /incomplete/,
  );
  await assert.rejects(
    prepareExternalDownload(item.id, {
      ...base,
      fetch: async () => ({ ok: true, redirected: true }),
    }),
    /exact edition/,
  );
  let cancelled = false;
  await assert.rejects(
    prepareExternalDownload(item.id, {
      ...base,
      fetch: async () =>
        new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new Uint8Array(item.pack.bytes + 1));
            },
            cancel() {
              cancelled = true;
            },
          }),
        ),
    }),
    /byte budget/,
  );
  assert.equal(cancelled, true);
  await assert.rejects(
    prepareExternalDownload(item.id, {
      ...base,
      fetch: async () =>
        new Response('', { headers: { 'content-length': String(item.pack.bytes + 1) } }),
    }),
    /byte budget/,
  );
});

test('abort interrupts a blocked stream and prevents requesting the second body; invalid bases never fetch', async () => {
  const c = new AbortController();
  let reader,
    calls = 0,
    cancelled = false;
  const pending = prepareExternalDownload(item.id, {
    baseURL: 'https://example.test/',
    signal: c.signal,
    decodeImage,
    fetch: async () => {
      calls++;
      return new Response(
        new ReadableStream({
          start(x) {
            reader = x;
          },
          cancel() {
            cancelled = true;
          },
        }),
      );
    },
  });
  while (!reader) await new Promise((r) => setImmediate(r));
  c.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
  assert(cancelled);
  for (const baseURL of [
    'file:///tmp/',
    'https://example.test/releases/v0.36.0',
    'https://example.test/?q=x',
  ])
    await assert.rejects(
      prepareExternalDownload(item.id, {
        baseURL,
        fetch: async () => {
          assert.fail('invalid base fetch');
        },
      }),
      /same-origin/,
    );
});

test('small catalog reads remain bounded and abort before any body request', async () => {
  const calls = [];
  assert.equal(
    await loadExternalCatalog({
      baseURL: 'https://example.test/site/',
      fetch: async (url) => {
        calls.push(url);
        return new Response(JSON.stringify(EXTERNAL_CATALOG));
      },
    }),
    EXTERNAL_CATALOG,
  );
  assert.deepEqual(calls, ['https://example.test/site/game/content/external-worlds.json']);
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    loadExternalCatalog({ signal: c.signal, fetch: async () => assert.fail('pre-abort fetch') }),
    { name: 'AbortError' },
  );
});

test('abort during an active reader cancels the stream and requests no second payload', async () => {
  const signal = new AbortController();
  let stream,
    calls = 0,
    cancelled = false;
  const pending = prepareExternalDownload(item.id, {
    baseURL: 'https://example.test/',
    signal: signal.signal,
    fetch: async () => {
      calls++;
      stream = new ReadableStream({
        cancel() {
          cancelled = true;
        },
      });
      return new Response(stream);
    },
  });
  while (!stream?.locked) await new Promise((resolve) => setImmediate(resolve));
  signal.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert(cancelled);
  assert.equal(stream.locked, false);
  assert.equal(calls, 1);
});

test('a caller URL mutation between downloads cannot change the selected edition', async () => {
  const first = EXTERNAL_CATALOG.chapters[0];
  const origin = 'https://example.test/releases/one/';
  const baseURL = new URL(origin);
  const calls = [];
  await assert.rejects(
    prepareExternalDownload(first.id, {
      baseURL,
      fetch: async (url) => {
        calls.push(url);
        if (calls.length === 1) {
          baseURL.href = 'https://elsewhere.test/releases/two/';
          return new Response(new Uint8Array(first.pack.bytes));
        }
        throw new Error('Reached second request');
      },
    }),
    /Reached second request/,
  );
  assert.deepEqual(calls, [
    new URL(first.pack.path, origin).href,
    new URL(first.media.path, origin).href,
  ]);
});

test('default fetch capability is captured once for the selected pair', async (t) => {
  const first = EXTERNAL_CATALOG.chapters[0];
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      globalThis.fetch = async () =>
        assert.fail('Changed global fetch must not receive the second request');
      return new Response(new Uint8Array(first.pack.bytes));
    }
    throw new Error('Reached original fetch again');
  });
  await assert.rejects(
    prepareExternalDownload(first.id, { baseURL: 'https://example.test/' }),
    /Reached original fetch again/,
  );
  assert.equal(calls.length, 2);
});
