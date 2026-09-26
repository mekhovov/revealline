import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolveEditionSelection } from '../editions/model.mjs';
import { verifyEditionAssets } from '../editions/assets.mjs';

const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await fs.readFile(new URL('game/editions/catalog.json', root)));
const bootstrap = {
  catalog,
  selection: resolveEditionSelection(catalog, { editionId: 'coupa-adventure' }),
};
test('presentation preparation reads only selected exact asset bytes', async () => {
  const requested = [];
  const verified = await verifyEditionAssets(bootstrap, {
    baseURL: 'https://example.test/',
    fetcher: async (url) => {
      requested.push(url.pathname);
      return new Response(await fs.readFile(new URL(url.pathname.slice(1), root)));
    },
  });
  assert.ok(verified.includes('coupa-flower'));
  assert.ok(verified.includes('coupa-home'));
  assert.ok(
    requested.every((file) => !file.includes('droneaid') && !file.includes('inside-village')),
  );
});
test('corrupt or incomplete asset download cannot activate a presentation', async () => {
  await assert.rejects(
    verifyEditionAssets(bootstrap, {
      baseURL: 'https://example.test/',
      fetcher: async () => new Response(new Uint8Array(1)),
    }),
    /incomplete/,
  );
  await assert.rejects(
    verifyEditionAssets(bootstrap, {
      baseURL: 'https://example.test/',
      fetcher: async (url) => {
        const data = await fs.readFile(new URL(url.pathname.slice(1), root));
        data[0] ^= 1;
        return new Response(data);
      },
    }),
    /pinned revision/,
  );
});
test('cancellation and oversized streams reject before presentation adoption', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(
    verifyEditionAssets(bootstrap, {
      baseURL: 'https://example.test/',
      signal: controller.signal,
      fetcher: () => {
        called = true;
      },
    }),
    /abort/i,
  );
  assert.equal(called, false);
  await assert.rejects(
    verifyEditionAssets(bootstrap, {
      baseURL: 'https://example.test/',
      fetcher: async (url) => {
        const data = await fs.readFile(new URL(url.pathname.slice(1), root));
        return new Response(new Uint8Array(data.length + 1));
      },
    }),
    /pinned size/,
  );
});

test('asset verification releases stream locks and cancels a blocked tee without awaiting its other consumer', async () => {
  const asset = catalog.assets.find((entry) => entry.id === 'coupa-flower');
  for (const cancelled of [false, true]) {
    const controller = new AbortController();
    let pulled;
    const started = new Promise((resolve) => {
      pulled = resolve;
    });
    const [body, other] = new ReadableStream(
      {
        pull(stream) {
          pulled();
          if (!cancelled) stream.enqueue(new Uint8Array(asset.bytes + 1));
        },
      },
      { highWaterMark: 0 },
    ).tee();
    const pending = verifyEditionAssets(bootstrap, {
      baseURL: 'https://example.test/',
      ids: [asset.id],
      signal: controller.signal,
      fetcher: async () => new Response(body),
    });
    const check = assert.rejects(pending, cancelled ? { name: 'AbortError' } : /pinned size/);
    await started;
    if (cancelled) controller.abort();
    await check;
    assert.equal(body.locked, false);
    await other.cancel();
  }
});

test('a globally registered foreign asset cannot be requested through a selected edition', async () => {
  let requested = false;
  await assert.rejects(
    verifyEditionAssets(bootstrap, {
      baseURL: 'https://example.test/',
      ids: ['droneaid-logo'],
      fetcher: () => {
        requested = true;
      },
    }),
    /unavailable in this edition/,
  );
  assert.equal(requested, false);
});
