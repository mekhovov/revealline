import test from 'node:test';
import assert from 'node:assert/strict';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
import { resolveRewardAsset } from '../rewards/media.mjs';
import { verifyEditionAssets } from '../editions/assets.mjs';

test('reward media finds the exact first-earned original in a registered retained presentation', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const original = f.original.catalog.assets[0];
  f.replacePicture();
  const provider = await f.load();
  assert.ok(!provider.selection.campaigns[0].assetIds.includes(original.id));
  const requests = [];
  const result = await resolveRewardAsset(
    provider,
    { assetId: original.id, sha256: original.sha256 },
    {
      fetcher: async (url, options) => {
        requests.push(new URL(url).pathname.slice(1));
        return f.fetcher(url, options);
      },
    },
  );
  assert.equal(result.asset.path, original.path);
  assert.deepEqual(requests, [f.descriptor.path]);
  assert.deepEqual(
    await verifyEditionAssets(result.bootstrap, {
      baseURL: provider.rootURL,
      ids: [result.asset.id],
      fetcher: f.fetcher,
    }),
    [original.id],
  );
  const current = provider.catalog.assets.find((asset) => asset.id === 'new-picture');
  const now = await resolveRewardAsset(
    provider,
    { assetId: current.id, sha256: current.sha256 },
    { fetcher: () => assert.fail('Current exact media needs no history fetch') },
  );
  assert.equal(now.bootstrap, provider.bootstrap);
});

test('unregistered, corrupt and missing original histories never fall back to current artwork', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const original = f.original.catalog.assets[0];
  f.replacePicture();
  const provider = await f.load(),
    reference = { assetId: original.id, sha256: original.sha256 };
  for (const fetcher of [
    async () => new Response('', { status: 404 }),
    async () => new Response('tampered snapshot'),
  ])
    await assert.rejects(
      resolveRewardAsset(provider, reference, { fetcher }),
      /exact reward media is unavailable/,
    );
  const withoutHistory = structuredClone(provider.currentCatalog);
  delete withoutHistory.editions[0].presentationHistory;
  await assert.rejects(
    resolveRewardAsset({ ...provider, currentCatalog: withoutHistory }, reference, {
      fetcher: () => assert.fail('Undeclared history must not be fetched'),
    }),
    /unavailable/,
  );
  await assert.rejects(
    resolveRewardAsset(provider, { ...reference, sha256: '0'.repeat(64) }, { fetcher: f.fetcher }),
    /unavailable/,
  );
});

test('reward history lookup has one total deadline and cancels stalled transport', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const original = f.original.catalog.assets[0];
  f.replacePicture();
  const provider = await f.load(),
    reference = { assetId: original.id, sha256: original.sha256 };
  let received;
  const stalled = (_url, { signal }) => {
    received = signal;
    return new Promise(() => {});
  };
  await assert.rejects(
    resolveRewardAsset(provider, reference, { fetcher: stalled, timeoutMs: 5 }),
    /timed out/,
  );
  assert.equal(received.aborted, true);
  const controller = new AbortController();
  const pending = resolveRewardAsset(provider, reference, {
    fetcher: stalled,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(received.aborted, true);
});
