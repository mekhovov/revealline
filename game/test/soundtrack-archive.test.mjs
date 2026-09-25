import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { fixture } from './helpers/soundtrack-fixtures.mjs';
import { responseFor } from './helpers/soundtrack-albums.mjs';
import { resolveCatalogueTrack } from '../soundtrack.mjs';
import { createSoundtrackSource } from '../soundtrack-source.mjs';
import {
  resolveSoundtrackArchives,
  resolveSoundtrackArchiveInventory,
} from '../soundtrack-archive.mjs';
const raw = await fixture('archive');
const id = 'builtin.catalog.archive';
const track = resolveCatalogueTrack({
  ...raw.track,
  id,
  edition: 'archive-1',
  archiveId: 'music-01',
  path: `objects/${raw.track.asset.sha256}.mp3`,
  tags: { genres: ['synth90s'], role: 'any', energy: 3, themes: [] },
  policy: {
    id,
    sha256: raw.track.asset.sha256,
    webPlayback: 'allowed',
    offlineCache: 'allowed',
    redistribute: 'allowed',
    modify: 'allowed',
    gameplayVideo: 'allowed',
    contentId: 'not-registered',
  },
});
const catalogue = {
  format: 'revealline-soundtrack-catalogue.v2',
  edition: 'archive-1',
  tracks: [track],
};
const inventory = {
  format: 'revealline-soundtrack-archive.v1',
  id: 'music-01',
  files: [{ path: track.path, bytes: track.asset.bytes, sha256: track.asset.sha256 }],
};
const inventoryJSON = JSON.stringify(inventory);
const admission = {
  id: 'music-01',
  baseURL: 'https://mekhovov.github.io/revealline-soundtracks-01/',
  inventorySha256: createHash('sha256').update(inventoryJSON).digest('hex'),
};
const source = (options = {}) =>
  createSoundtrackSource({ catalogue, archives: [admission], ...options });

test('only code-admitted archive inventory authorizes immutable objects; successful verification is reused', async () => {
  const calls = [];
  const reader = source({
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responseFor(url.endsWith('inventory.json') ? inventoryJSON : raw.blob, url);
    },
  });
  for (const purpose of ['playback', 'offline', 'export'])
    assert.deepEqual(
      await (await reader.readAsset(track.asset.sha256, { purpose })).arrayBuffer(),
      await raw.blob.arrayBuffer(),
    );
  assert.equal(calls.filter((call) => call.url.endsWith('inventory.json')).length, 1);
  assert.equal(calls.length, 4);
  assert(
    calls.every(
      (call) =>
        call.options.credentials === 'omit' &&
        call.options.mode === 'cors' &&
        call.options.redirect === 'error',
    ),
  );
  assert(calls.every((call) => call.url.startsWith(admission.baseURL)));
});

test('immutable batch prefixes authorize only their exact inventory and object URLs', async () => {
  const baseURL = `${admission.baseURL}batches/core-retro-20260924/`;
  const calls = [];
  const reader = source({
    archives: [{ ...admission, baseURL }],
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responseFor(url.endsWith('inventory.json') ? inventoryJSON : raw.blob, url);
    },
  });
  assert.deepEqual(
    await (await reader.readAsset(track.asset.sha256)).arrayBuffer(),
    await raw.blob.arrayBuffer(),
  );
  assert.deepEqual(
    calls.map(({ url }) => url),
    [`${baseURL}inventory.json`, `${baseURL}${track.path}`],
  );
  assert(
    calls.every(
      ({ options }) =>
        options.credentials === 'omit' && options.mode === 'cors' && options.redirect === 'error',
    ),
  );
  await assert.rejects(
    source({
      archives: [{ ...admission, baseURL }],
      fetch: async () => responseFor(inventoryJSON, `${admission.baseURL}inventory.json`),
    }).readAsset(track.asset.sha256),
    /direct HTTP/,
  );
});

test('batch admission rejects unsupported prefixes, encoded paths, credentials and URL suffixes', () => {
  for (const suffix of [
    'batches/',
    'batches/Uppercase/',
    'batches/with_underscore/',
    'batches/-leading/',
    `batches/${'a'.repeat(65)}/`,
    'batches/core',
    'batches/core//',
    'batches/core/subdirectory/',
    'batches/core/../other/',
    'batches/%2e%2e/',
    'batches/core%2fother/',
    'batches/core%5cother/',
    'batches/core\\other/',
    'batches/core/?query=1',
    'batches/core/#fragment',
    'batches/core/\n',
    'batches/core/\r',
    'other/core/',
  ])
    assert.throws(
      () => resolveSoundtrackArchives([{ ...admission, baseURL: admission.baseURL + suffix }]),
      /admitted/,
    );
  for (const baseURL of [
    'https://other.github.io/revealline-soundtracks-01/batches/core/',
    'https://mekhovov.github.io/other/batches/core/',
    'http://mekhovov.github.io/revealline-soundtracks-01/batches/core/',
    'https://user@mekhovov.github.io/revealline-soundtracks-01/batches/core/',
  ])
    assert.throws(() => resolveSoundtrackArchives([{ ...admission, baseURL }]), /admitted/);
  assert.equal(
    resolveSoundtrackArchives([
      { ...admission, baseURL: `${admission.baseURL}batches/${'a'.repeat(64)}/` },
    ]).length,
    1,
  );
});

test('unknown archives, foreign owners, hashes, redirects and mismatched inventory facts cannot fetch objects', async () => {
  for (const baseURL of [
    'https://evil.test/revealline-soundtracks-01/',
    'https://mekhovov.github.io/revealline-soundtracks-01/../',
    'https://user@mekhovov.github.io/revealline-soundtracks-01/',
  ])
    assert.throws(() => resolveSoundtrackArchives([{ ...admission, baseURL }]), /admitted/);
  const calls = [];
  const request = async (url) => {
    calls.push(url);
    return responseFor(inventoryJSON, url);
  };
  await assert.rejects(
    source({ archives: [], fetch: request }).readAsset(track.asset.sha256),
    /not admitted/,
  );
  assert.equal(calls.length, 0);
  await assert.rejects(
    source({
      archives: [{ ...admission, inventorySha256: '0'.repeat(64) }],
      fetch: request,
    }).readAsset(track.asset.sha256),
    /inventory differs/,
  );
  assert.equal(calls.length, 1);
  await assert.rejects(
    source({ fetch: async (url) => responseFor(inventoryJSON, url + '?redirected') }).readAsset(
      track.asset.sha256,
    ),
    /direct HTTP/,
  );
  const wrong = { ...inventory, files: [{ ...inventory.files[0], bytes: track.asset.bytes + 1 }] };
  const json = JSON.stringify(wrong);
  await assert.rejects(
    source({
      archives: [
        { ...admission, inventorySha256: createHash('sha256').update(json).digest('hex') },
      ],
      fetch: async (url) => responseFor(json, url),
    }).readAsset(track.asset.sha256),
    /differs.*inventory/,
  );
});

test('inventory bounds prohibit duplicate objects, path aliases and archive budget overflow', () => {
  for (const files of [
    [inventory.files[0], inventory.files[0]],
    [{ ...inventory.files[0], path: '../audio.mp3' }],
    [{ ...inventory.files[0], bytes: 33 * 1024 * 1024 }],
  ])
    assert.throws(() => resolveSoundtrackArchiveInventory({ ...inventory, files }, admission));
  const files = Array.from({ length: 30 }, (_, i) => {
    const sha256 = i.toString(16).padStart(64, '0');
    return { path: `objects/${sha256}.mp3`, sha256, bytes: 32 * 1024 * 1024 };
  });
  assert.throws(
    () => resolveSoundtrackArchiveInventory({ ...inventory, files }, admission),
    /800 MB/,
  );
});

test('local originals work without an admitted network archive and cancellation cannot prime inventory authority', async () => {
  let calls = 0;
  const local = source({
    archives: [],
    readLocal: () => raw.blob,
    fetch: () => {
      calls++;
      throw Error('unexpected');
    },
  });
  assert.equal(await local.readAsset(track.asset.sha256), raw.blob);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    source({
      fetch: () => {
        calls++;
      },
    }).readAsset(track.asset.sha256, { signal: controller.signal }),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
});
