import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONLINE_SOUNDTRACK_CATALOGUE_URL,
  fetchOnlineSoundtrackCatalogue,
  resolveOnlineSoundtrackCatalogue,
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

test('online catalogue creates a bounded immutable remote playback entry', () => {
  const resolved = resolveOnlineSoundtrackCatalogue(catalogue);
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

test('online catalogue cannot grant game admission or escape its hash path', () => {
  for (const changed of [
    { ...track, gameCatalogueAdmission: true },
    { ...track, audio: { ...track.audio, path: `objects/${'b'.repeat(64)}.mp3` } },
    { ...track, licenseURL: 'https://example.com/custom' },
    { ...track, recordingModeEligible: true },
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
