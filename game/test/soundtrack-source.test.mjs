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

test('local gameplay never consults a live catalogue or soundtrack server even when the browser reports online', async () => {
  let requests = 0;
  const source = createSoundtrackSource({
    catalogue,
    localPlayback: () => true,
    readOfficial: async () => null,
    fetch: async () => {
      requests++;
      throw new Error('Network blocked');
    },
  });
  assert.equal(await source.readAsset(track.asset.sha256), null);
  assert.equal(requests, 0);
  const local = createSoundtrackSource({
    catalogue,
    localPlayback: () => true,
    readOfficial: async () => body,
    fetch: async () => {
      throw new Error('Network must not be used');
    },
  });
  assert.equal(await local.readAsset(track.asset.sha256), body);
});

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

test('local-only preparation returns a local original or absence without granting archive or recording requests', async () => {
  let requests = 0;
  const local = new Map();
  const source = createSoundtrackSource({
    catalogue,
    readLocal: (hash) => local.get(hash) ?? null,
    fetch: async (url) => {
      requests++;
      return responseFor(body, url);
    },
  });
  assert.equal(await source.readAsset(track.asset.sha256, { localOnly: true }), null);
  assert.equal(await source.readAsset('0'.repeat(64), { localOnly: true }), null);
  assert.equal(requests, 0);
  local.set(track.asset.sha256, body);
  assert.equal(await source.readAsset(track.asset.sha256, { localOnly: true }), body);
  assert.equal(requests, 0);
  await assert.rejects(source.readAsset(track.asset.sha256, { localOnly: 'yes' }), /Invalid local/);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    source.readAsset(track.asset.sha256, { localOnly: true, signal: cancelled.signal }),
    { name: 'AbortError' },
  );
  assert.equal(requests, 0);
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

const coreTrack = resolveCatalogueTrack({
  ...track,
  archiveId: 'qa.core-preview',
  path: `objects/${track.asset.sha256}.mp3`,
  policy: {
    id: track.id,
    sha256: track.asset.sha256,
    webPlayback: 'allowed',
    offlineCache: 'allowed',
    redistribute: 'allowed',
    modify: 'allowed',
    gameplayVideo: 'allowed',
    contentId: 'registered',
  },
});
const coreCatalogue = {
  ...catalogue,
  format: 'revealline-soundtrack-catalogue.v2',
  tracks: [coreTrack],
};
const coreRegistration = {
  id: coreTrack.id,
  sha256: coreTrack.asset.sha256,
  bytes: coreTrack.asset.bytes,
  path: `game/audio/soundtracks/${coreTrack.asset.sha256}.mp3`,
};

test('a shipped recording remains local-only in installed play but can be explicitly downloaded', async () => {
  const urls = [];
  let local = null;
  const source = createSoundtrackSource({
    catalogue: coreCatalogue,
    bundled: [coreRegistration],
    localPlayback: () => true,
    readLocal: () => local,
    installedOnly: () => true,
    baseURL: 'https://example.test/releases/v1/',
    fetch: async (url) => {
      urls.push(url);
      return responseFor(body, url);
    },
  });
  assert.equal(await source.readAsset(coreTrack.asset.sha256, { localOnly: true }), null);
  assert.equal(urls.length, 0);
  local = body;
  assert.equal(await source.readAsset(coreTrack.asset.sha256, { localOnly: true }), body);
  assert.equal(urls.length, 0);
  local = null;
  assert.equal(await source.readAsset(coreTrack.asset.sha256), null);
  assert.equal(urls.length, 0);
  for (const options of [{ purpose: 'offline' }, { purpose: 'export' }]) {
    const found = await source.readAsset(coreTrack.asset.sha256, options);
    assert.deepEqual(Buffer.from(await found.arrayBuffer()), Buffer.from(await body.arrayBuffer()));
  }
  assert.equal(urls.length, 2);
  assert.ok(
    urls.every((url) => url === `https://example.test/releases/v1/${coreRegistration.path}`),
  );
});

test('bundled registrations cannot redirect, rename, change bytes, duplicate or grant missing permissions', () => {
  for (const changed of [
    { id: 'builtin.catalog.renamed' },
    { sha256: '0'.repeat(64) },
    { bytes: coreRegistration.bytes + 1 },
    { path: 'https://elsewhere.test/audio.mp3' },
    { path: 'game/audio/soundtracks/../audio.mp3' },
  ]) {
    assert.throws(
      () =>
        createSoundtrackSource({
          catalogue: coreCatalogue,
          bundled: [{ ...coreRegistration, ...changed }],
        }),
      /bundled soundtrack|Bundled soundtrack/,
    );
  }
  assert.throws(
    () =>
      createSoundtrackSource({
        catalogue: coreCatalogue,
        bundled: [coreRegistration, coreRegistration],
      }),
    /duplicate bundled/,
  );
  for (const permission of ['webPlayback', 'offlineCache', 'redistribute']) {
    for (const value of ['denied', 'unknown'])
      assert.throws(
        () =>
          createSoundtrackSource({
            catalogue: {
              ...coreCatalogue,
              tracks: [{ ...coreTrack, policy: { ...coreTrack.policy, [permission]: value } }],
            },
            bundled: [coreRegistration],
          }),
        /offline and redistribution permission/,
      );
  }
});

test('bundled assets retain full-byte validation and cancellation', async () => {
  const source = createSoundtrackSource({
    catalogue: coreCatalogue,
    bundled: [coreRegistration],
    fetch: async (url) => responseFor(new Blob([new Uint8Array(body.size)]), url),
  });
  await assert.rejects(source.readAsset(coreTrack.asset.sha256));
  let requests = 0;
  const abortSource = createSoundtrackSource({
    catalogue: coreCatalogue,
    bundled: [coreRegistration],
    fetch: async () => {
      requests++;
      throw new Error('Unexpected request');
    },
  });
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(abortSource.readAsset(coreTrack.asset.sha256, { signal: abort.signal }), {
    name: 'AbortError',
  });
  assert.equal(requests, 0);
});

test('same-recording catalogue aliases cannot widen bundled playback, storage or redistribution permission', () => {
  for (const permission of ['webPlayback', 'offlineCache', 'redistribute']) {
    for (const value of ['denied', 'unknown']) {
      const alias = {
        ...coreTrack,
        id: 'builtin.catalog.restricted-alias',
        policy: {
          ...coreTrack.policy,
          id: 'builtin.catalog.restricted-alias',
          [permission]: value,
        },
      };
      assert.throws(
        () =>
          createSoundtrackSource({
            catalogue: { ...coreCatalogue, tracks: [coreTrack, alias] },
            bundled: [coreRegistration],
          }),
        /offline and redistribution permission/,
      );
    }
  }
});
