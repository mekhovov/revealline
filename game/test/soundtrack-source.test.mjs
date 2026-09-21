import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundtrackSource, fetchSoundtrackCatalogue } from '../soundtrack-source.mjs';
import { resolveCatalogueTrack } from '../soundtrack.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';
import { responseFor } from './helpers/soundtrack-albums.mjs';

const original = await fixture('source');
const track = resolveCatalogueTrack({
  ...original.track,
  id: 'builtin.catalog.source',
  edition: 'originals-1',
  path: 'optional/soundtracks/source.mp3',
  tags: { genres: ['synth90s'], role: 'menu', energy: 2, themes: ['retro'] },
});
const catalogue = {
  format: 'revealline-soundtrack-catalogue.v1',
  edition: 'originals-1',
  tracks: [track],
};
const body = original.assets[0].blob;

test('catalogue streaming trusts only shipped hashes and checks the entire original without saving it', async () => {
  const calls = [];
  const source = createSoundtrackSource({
    catalogue,
    baseURL: 'https://example.test/releases/v1/',
    fetch: async (url, options) => {
      calls.push([url, options]);
      return responseFor(body, url);
    },
  });
  const result = await source.readAsset(track.asset.sha256);
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), Buffer.from(await body.arrayBuffer()));
  assert.equal(calls[0][0], 'https://example.test/releases/v1/optional/soundtracks/source.mp3');
  assert.equal(calls[0][1].redirect, 'error');
  await assert.rejects(source.readAsset('0'.repeat(64)), /missing locally/);
  assert.equal(calls.length, 1);
});

test('offline listening does not fetch; an explicit download can fetch; stored originals work offline', async () => {
  let requests = 0;
  const options = {
    catalogue,
    baseURL: 'https://example.test/',
    installedOnly: () => true,
    fetch: async (url) => {
      requests++;
      return responseFor(body, url);
    },
  };
  const source = createSoundtrackSource(options);
  await assert.rejects(source.readAsset(track.asset.sha256), /Installed only/);
  assert.equal(requests, 0);
  await source.readAsset(track.asset.sha256, { download: true });
  assert.equal(requests, 1);
  assert.equal(
    await createSoundtrackSource({ ...options, readLocal: () => body }).readAsset(
      track.asset.sha256,
    ),
    body,
  );
  assert.equal(requests, 1);
});

for (const offlineCache of ['denied', 'unknown'])
  test(`standalone export remains allowed when offline storage is ${offlineCache}`, async () => {
    const restricted = resolveCatalogueTrack({
      ...track,
      policy: {
        id: track.id,
        sha256: track.asset.sha256,
        webPlayback: 'allowed',
        offlineCache,
        redistribute: 'allowed',
        modify: 'allowed',
        gameplayVideo: 'allowed',
        contentId: 'not-registered',
      },
    });
    let reads = 0,
      requests = 0;
    const source = createSoundtrackSource({
      catalogue: {
        ...catalogue,
        format: 'revealline-soundtrack-catalogue.v2',
        tracks: [restricted],
      },
      baseURL: 'https://example.test/releases/v1/',
      readLocal: () => {
        reads++;
        return null;
      },
      fetch: async (url) => {
        requests++;
        assert.equal(url, 'https://example.test/releases/v1/optional/soundtracks/source.mp3');
        return responseFor(body, url);
      },
    });
    await assert.rejects(
      source.readAsset(track.asset.sha256, { purpose: 'offline' }),
      /not approved/,
    );
    assert.equal(reads, 0);
    assert.equal(requests, 0);
    const exported = await source.readAsset(track.asset.sha256, { purpose: 'export' });
    assert.deepEqual(await exported.arrayBuffer(), await body.arrayBuffer());
    assert.equal(reads, 1);
    assert.equal(requests, 1);
    await assert.rejects(
      source.readAsset(track.asset.sha256, { purpose: 'offline' }),
      /not approved/,
    );
    assert.equal(reads, 1, 'Standalone export does not grant later offline read permission');
    assert.equal(requests, 1);
  });

test('streaming rejects corrupt/truncated media and cancellation before a request', async () => {
  const source = createSoundtrackSource({
    catalogue,
    baseURL: 'https://example.test/',
    fetch: async (url) => responseFor(new Uint8Array([1, 2, 3]), url),
  });
  await assert.rejects(source.readAsset(track.asset.sha256), /truncated/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(source.readAsset(track.asset.sha256, { signal: controller.signal }), {
    name: 'AbortError',
  });
});

test('the catalogue loader validates bounded version-local metadata and rejects foreign redirects', async () => {
  const result = await fetchSoundtrackCatalogue({
    baseURL: 'https://example.test/v2/',
    fetch: async (url) => responseFor(JSON.stringify(catalogue), url),
  });
  assert.equal(result.tracks[0].id, track.id);
  await assert.rejects(
    fetchSoundtrackCatalogue({
      baseURL: 'https://example.test/v2/',
      fetch: async () => responseFor(JSON.stringify(catalogue), 'https://foreign.test/catalogue'),
    }),
    /direct HTTP/,
  );
});
