import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONLINE_SOUNDTRACK_CATALOGUE_URL,
  fetchOnlineSoundtrackCatalogue,
  resolveOnlineSoundtrackCatalogue,
} from '../online-soundtrack-catalogue.mjs';
import { setLocale } from '../i18n/index.mjs';
import { soundtrackErrorText } from '../ui/soundtrack-error-copy.mjs';

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

test('online catalogue diagnostics follow the active locale and retain interpolation', (t) => {
  t.after(() => setLocale('en', { persist: false }));
  let failure;
  try {
    resolveOnlineSoundtrackCatalogue({
      ...catalogue,
      tracks: [{ ...track, durationSeconds: -1 }],
    });
  } catch (error) {
    failure = error;
  }
  assert(failure);

  setLocale('en', { persist: false });
  assert.equal(
    soundtrackErrorText(failure),
    'Online soundtrack duration is invalid: creator.song.',
  );
  setLocale('uk', { persist: false });
  assert.equal(
    soundtrackErrorText(failure),
    'Некоректна тривалість онлайн-саундтреку: creator.song.',
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
