import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONLINE_SOUNDTRACK_CATALOGUE_URL,
  ONLINE_SOUNDTRACK_DIRECTORY_URL,
  fetchOnlineSoundtrackCatalogue,
  fetchOnlineSoundtrackCatalogues,
  fetchOnlineSoundtrackDirectory,
  resolveOnlineSoundtrackCatalogue,
  resolveOnlineSoundtrackDirectory,
} from '../online-soundtrack-catalogue.mjs';

const sha256 = 'a'.repeat(64);
const track = {
  id: 'creator.song',
  title: 'Song',
  artist: 'Creator',
  durationSeconds: 180,
  tags: ['metal', 'gameplay'],
  source: 'https://creator.example/song',
  license: 'CC BY 4.0 International',
  licenseURL: 'https://creativecommons.org/licenses/by/4.0/',
  credit: 'Song by Creator, CC BY 4.0.',
  fileName: 'song.mp3',
  archiveId: 'creator-album',
  collection: 'Creator album',
  status: 'licensed-preview',
  listeningApproval: 'not-reviewed',
  gameCatalogueAdmission: false,
  contentId: true,
  recordingModeEligible: false,
  audio: { path: `batches/creator-album/objects/${sha256}.mp3`, bytes: 1234, sha256 },
  aliases: [],
};
const catalogue = {
  format: 'revealline-public-soundtrack-catalogue.v1',
  archive: {
    id: 'revealline-soundtracks-01',
    baseURL: 'https://mekhovov.github.io/revealline-soundtracks-01/',
  },
  sources: [],
  counts: { declaredTracks: 1, uniqueRecordings: 1, duplicateAliases: 0, audioBytes: 1234 },
  tracks: [track],
};
const directory = {
  format: 'revealline-public-soundtrack-directory.v1',
  catalogues: [
    {
      id: 'revealline-soundtracks-01',
      url: ONLINE_SOUNDTRACK_CATALOGUE_URL,
      baseURL: 'https://mekhovov.github.io/revealline-soundtracks-01/',
      required: true,
    },
  ],
};

function response(url, value, { status = 200, redirected = false } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return {
    status,
    redirected,
    url,
    headers: new Headers({ 'content-length': String(bytes.byteLength) }),
    body: new Response(bytes).body,
  };
}

test('online catalogue creates a bounded immutable remote playback entry', () => {
  const resolved = resolveOnlineSoundtrackCatalogue({
    ...catalogue,
    tracks: [{ ...track, default: false }],
  });
  assert.equal(resolved.tracks[0].id, `online.${sha256}`);
  assert.equal(
    resolved.tracks[0].url,
    `https://mekhovov.github.io/revealline-soundtracks-01/batches/creator-album/objects/${sha256}.mp3`,
  );
  assert(Object.isFrozen(resolved));
  assert(Object.isFrozen(resolved.tracks));
  assert.equal(resolved.tracks[0].contentId, true);
  assert.equal(resolved.tracks[0].recordingModeEligible, false);
});

test('online catalogue accepts legacy entries and validates mirrored structured rights', () => {
  const rights = {
    licenseId: 'CC-BY',
    licenseVersion: '4.0',
    licenseURL: track.licenseURL,
    rightsEvidenceURL: track.source,
    attribution: track.credit,
    derivativeChangeNotice: 'Converted from the native lossless recording to MP3.',
    shareAlike: {
      required: false,
      deliveryLicenseId: null,
      deliveryLicenseVersion: null,
      deliveryLicenseURL: null,
    },
  };
  const legacy = resolveOnlineSoundtrackCatalogue(catalogue).tracks[0],
    resolved = resolveOnlineSoundtrackCatalogue({
      ...catalogue,
      tracks: [{ ...track, rights }],
    }).tracks[0];
  assert.equal(legacy.rights.evidence, null);
  assert.deepEqual(resolved.rights.evidence, {
    licenseId: 'CC-BY',
    licenseVersion: '4.0',
    licenseURL: track.licenseURL,
    evidence: track.source,
    attribution: track.credit,
    derivativeChangeNotice: rights.derivativeChangeNotice,
    shareAlike: rights.shareAlike,
  });
  for (const invalid of [
    { ...rights, attribution: 'Forged credit' },
    { ...rights, rightsEvidenceURL: 'https://example.com/other' },
    { ...rights, licenseVersion: '3.0' },
    { ...rights, shareAlike: { ...rights.shareAlike, required: true } },
    { ...rights, shareAlike: { ...rights.shareAlike, unexpected: true } },
  ])
    assert.throws(
      () =>
        resolveOnlineSoundtrackCatalogue({ ...catalogue, tracks: [{ ...track, rights: invalid }] }),
      /rights|share-alike/i,
    );
});

test('online catalogue requires compatible delivery terms for share-alike recordings', () => {
  const licenseURL = 'https://creativecommons.org/licenses/by-sa/4.0/',
    license = 'CC BY-SA 4.0 International',
    credit = 'Song by Creator, CC BY-SA 4.0.',
    rights = {
      licenseId: 'CC-BY-SA',
      licenseVersion: '4.0',
      licenseURL,
      rightsEvidenceURL: track.source,
      attribution: credit,
      derivativeChangeNotice: 'Native MP3 retained unchanged.',
      shareAlike: {
        required: true,
        deliveryLicenseId: 'CC-BY-SA',
        deliveryLicenseVersion: '4.0',
        deliveryLicenseURL: licenseURL,
      },
    };
  assert.doesNotThrow(() =>
    resolveOnlineSoundtrackCatalogue({
      ...catalogue,
      tracks: [{ ...track, license, licenseURL, credit, rights }],
    }),
  );
  assert.throws(
    () =>
      resolveOnlineSoundtrackCatalogue({
        ...catalogue,
        tracks: [{ ...track, license, licenseURL, credit }],
      }),
    /ShareAlike rights are required/,
  );
  assert.throws(
    () =>
      resolveOnlineSoundtrackCatalogue({
        ...catalogue,
        tracks: [{ ...track, license: 'CC0 (forged label)', licenseURL, credit, rights }],
      }),
    /licence is invalid/,
  );
  assert.throws(() =>
    resolveOnlineSoundtrackCatalogue({
      ...catalogue,
      tracks: [
        {
          ...track,
          license,
          licenseURL,
          credit,
          rights: {
            ...rights,
            shareAlike: { ...rights.shareAlike, deliveryLicenseId: 'CC-BY' },
          },
        },
      ],
    }),
  );
});

test('online catalogue cannot grant game admission or escape its hash path', () => {
  for (const changed of [
    { ...track, gameCatalogueAdmission: true },
    { ...track, audio: { ...track.audio, path: `objects/${'b'.repeat(64)}.mp3` } },
    { ...track, licenseURL: 'https://example.com/custom' },
    { ...track, recordingModeEligible: true },
    { ...track, default: true },
  ])
    assert.throws(() => resolveOnlineSoundtrackCatalogue({ ...catalogue, tracks: [changed] }));
  assert.throws(() =>
    resolveOnlineSoundtrackCatalogue({
      ...catalogue,
      tracks: [track, track],
      counts: { declaredTracks: 2, uniqueRecordings: 2, duplicateAliases: 0, audioBytes: 2468 },
    }),
  );
});

test('online catalogue fetch is direct, credential-free and bounded', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(catalogue));
  let options;
  const resolved = await fetchOnlineSoundtrackCatalogue({
    fetch: async (url, value) => {
      assert.equal(url, ONLINE_SOUNDTRACK_CATALOGUE_URL);
      options = value;
      return {
        status: 200,
        redirected: false,
        url,
        headers: new Headers({ 'content-length': String(bytes.byteLength) }),
        body: new Response(bytes).body,
      };
    },
  });
  assert.equal(resolved.tracks.length, 1);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.mode, 'cors');
  await assert.rejects(
    fetchOnlineSoundtrackCatalogue({
      fetch: async (url) => ({
        status: 302,
        redirected: true,
        url,
        headers: new Headers(),
        body: new Response(bytes).body,
      }),
    }),
    /direct HTTP 200/,
  );
});

test('online catalogue stops reading a streamed response at its byte limit', async () => {
  const chunk = new Uint8Array(256 * 1024),
    source = [chunk, chunk, new Uint8Array(1), chunk];
  let reads = 0,
    cancelled = false;
  const body = {
    getReader() {
      return {
        async read() {
          reads++;
          return source.length ? { done: false, value: source.shift() } : { done: true };
        },
        async cancel() {
          cancelled = true;
        },
        releaseLock() {},
      };
    },
  };
  await assert.rejects(
    fetchOnlineSoundtrackCatalogue({
      fetch: async (url) => ({
        status: 200,
        redirected: false,
        url,
        headers: new Headers(),
        body,
      }),
    }),
    /exceeds its byte limit/,
  );
  assert.equal(reads, 3);
  assert.equal(cancelled, true);
});

test('online archive directory is exact, bounded and keeps the primary archive required first', async () => {
  const resolved = resolveOnlineSoundtrackDirectory(directory);
  assert.equal(resolved.catalogues[0].id, 'revealline-soundtracks-01');
  assert(Object.isFrozen(resolved.catalogues));
  const fetched = await fetchOnlineSoundtrackDirectory({
    fetch: async (url, options) => {
      assert.equal(url, ONLINE_SOUNDTRACK_DIRECTORY_URL);
      assert.equal(options.credentials, 'omit');
      assert.equal(options.mode, 'cors');
      return response(url, directory);
    },
  });
  assert.equal(fetched.catalogues.length, 1);
  for (const invalid of [
    { ...directory, unexpected: true },
    {
      ...directory,
      catalogues: [{ ...directory.catalogues[0], required: false }],
    },
    {
      ...directory,
      catalogues: [
        directory.catalogues[0],
        {
          ...directory.catalogues[0],
          id: 'revealline-soundtracks-02',
          url: 'https://evil.example/catalogue.json',
          baseURL: 'https://evil.example/',
        },
      ],
    },
    { ...directory, catalogues: Array(9).fill(directory.catalogues[0]) },
  ])
    assert.throws(() => resolveOnlineSoundtrackDirectory(invalid));
});

test('online archive directory merges trusted shards and records optional failures', async () => {
  const secondHash = 'b'.repeat(64),
    secondArchive = {
      id: 'revealline-soundtracks-02',
      url: 'https://mekhovov.github.io/revealline-soundtracks-02/catalogue.json',
      baseURL: 'https://mekhovov.github.io/revealline-soundtracks-02/',
      required: false,
    },
    secondCatalogue = {
      ...catalogue,
      archive: { id: secondArchive.id, baseURL: secondArchive.baseURL },
      tracks: [
        {
          ...track,
          id: 'creator.second-song',
          title: 'Second song',
          audio: {
            path: `objects/${secondHash}.mp3`,
            bytes: 4321,
            sha256: secondHash,
          },
        },
      ],
      counts: { declaredTracks: 1, uniqueRecordings: 1, duplicateAliases: 0, audioBytes: 4321 },
    },
    twoArchives = { ...directory, catalogues: [...directory.catalogues, secondArchive] };
  const merged = await fetchOnlineSoundtrackCatalogues({
    fetch: async (url) => {
      if (url === ONLINE_SOUNDTRACK_DIRECTORY_URL) return response(url, twoArchives);
      if (url === ONLINE_SOUNDTRACK_CATALOGUE_URL) return response(url, catalogue);
      return response(url, secondCatalogue);
    },
  });
  assert.equal(merged.tracks.length, 2);
  assert.equal(merged.counts.audioBytes, 5555);
  assert.equal(merged.unavailable.length, 0);
  assert.equal(merged.tracks[1].url, `${secondArchive.baseURL}objects/${secondHash}.mp3`);

  const partial = await fetchOnlineSoundtrackCatalogues({
    fetch: async (url) => {
      if (url === ONLINE_SOUNDTRACK_DIRECTORY_URL) return response(url, twoArchives);
      if (url === ONLINE_SOUNDTRACK_CATALOGUE_URL) return response(url, catalogue);
      return response(url, {}, { status: 503 });
    },
  });
  assert.equal(partial.tracks.length, 1);
  assert.deepEqual(
    partial.unavailable.map(({ id }) => id),
    ['revealline-soundtracks-02'],
  );
});

test('online archive loading falls back to the hardcoded primary and rejects cross-shard duplicates', async () => {
  const fallback = await fetchOnlineSoundtrackCatalogues({
    fetch: async (url) => {
      if (url === ONLINE_SOUNDTRACK_DIRECTORY_URL) return response(url, {}, { status: 503 });
      return response(url, catalogue);
    },
  });
  assert.equal(fallback.tracks.length, 1);

  const secondArchive = {
      id: 'revealline-soundtracks-02',
      url: 'https://mekhovov.github.io/revealline-soundtracks-02/catalogue.json',
      baseURL: 'https://mekhovov.github.io/revealline-soundtracks-02/',
      required: true,
    },
    duplicateCatalogue = {
      ...catalogue,
      archive: { id: secondArchive.id, baseURL: secondArchive.baseURL },
    };
  await assert.rejects(
    fetchOnlineSoundtrackCatalogues({
      fetch: async (url) => {
        if (url === ONLINE_SOUNDTRACK_DIRECTORY_URL)
          return response(url, {
            ...directory,
            catalogues: [...directory.catalogues, secondArchive],
          });
        if (url === ONLINE_SOUNDTRACK_CATALOGUE_URL) return response(url, catalogue);
        return response(url, duplicateCatalogue);
      },
    }),
    /duplicate recording/,
  );
});
