import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONLINE_SOUNDTRACK_CATALOGUE_URL,
  fetchOnlineSoundtrackCatalogue,
  fetchVerifiedOnlineSoundtrack,
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
  collections: ['Creator album', 'Metal action'],
  status: 'licensed-preview',
  listeningApproval: 'not-reviewed',
  gameCatalogueAdmission: false,
  contentId: true,
  recordingModeEligible: false,
  audio: {
    path: `https://github.com/mekhovov/revealline-soundtracks/releases/download/audio-test/${sha256}.mp3`,
    bytes: 1234,
    sha256,
  },
  aliases: [],
};
const catalogue = {
  format: 'revealline-public-soundtrack-catalogue.v1',
  archive: {
    id: 'revealline-soundtracks',
    baseURL: 'https://mekhovov.github.io/revealline-soundtracks/',
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
    `https://github.com/mekhovov/revealline-soundtracks/releases/download/audio-test/${sha256}.mp3`,
  );
  assert(Object.isFrozen(resolved));
  assert(Object.isFrozen(resolved.tracks));
  assert.equal(resolved.tracks[0].contentId, true);
  assert.equal(resolved.tracks[0].recordingModeEligible, false);
});

test('online catalogue preserves an exact original filename with leading whitespace', () => {
  const value = resolveOnlineSoundtrackCatalogue({
    ...catalogue,
    tracks: [{ ...track, fileName: ' Song.mp3' }],
  }).tracks[0];
  assert.equal(value.fileName, ' Song.mp3');
});

test('online catalogue validates but excludes unlisted review recordings from game queues', () => {
  const publicTrack = {
    ...track,
    collections: ['Base Game Playlist'],
  };
  const heldHash = 'b'.repeat(64);
  const held = {
    ...track,
    id: 'creator.held-song',
    collections: ['Base Game Review'],
    visibility: 'review-only',
    audio: {
      ...track.audio,
      path: `https://github.com/mekhovov/revealline-soundtracks/releases/download/audio-test/${heldHash}.mp3`,
      sha256: heldHash,
    },
  };
  const resolved = resolveOnlineSoundtrackCatalogue({
    ...catalogue,
    counts: {
      declaredTracks: 2,
      uniqueRecordings: 2,
      duplicateAliases: 0,
      audioBytes: publicTrack.audio.bytes + held.audio.bytes,
    },
    tracks: [publicTrack, held],
  });
  assert.equal(resolved.tracks.length, 1);
  assert.equal(resolved.tracks[0].archiveTrackId, publicTrack.id);
  assert.equal(
    resolved.tracks.some(({ archiveTrackId }) => archiveTrackId === held.id),
    false,
  );
});

test('online catalogue accepts hash-bound external delivery without a domain allowlist', async () => {
  const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const url = 'https://example-bucket.s3.eu-central-1.amazonaws.com/music/song.mp3';
  const externalTrack = {
    ...track,
    audio: {
      path: url,
      bytes: bytes.length,
      sha256: digest,
      delivery: {
        type: 'external-url',
        verifiedAt: '2026-09-27T00:00:00.000Z',
        rangeRequests: true,
        cors: true,
      },
    },
  };
  const resolved = resolveOnlineSoundtrackCatalogue({
    ...catalogue,
    counts: { ...catalogue.counts, audioBytes: bytes.length },
    tracks: [externalTrack],
  }).tracks[0];
  assert.equal(resolved.url, url);
  assert.equal(resolved.delivery.type, 'external-url');
  const blob = await fetchVerifiedOnlineSoundtrack(resolved, {
    fetch: async (_url, options) => {
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.Range, `bytes=0-${bytes.length - 1}`);
      return {
        status: 206,
        redirected: false,
        url,
        headers: new Headers({ 'content-length': String(bytes.length) }),
        body: new Response(bytes).body,
      };
    },
  });
  assert.equal(blob.size, bytes.length);
  for (const path of [
    'http://cdn.example/song.mp3',
    'https://127.0.0.1/song.mp3',
    `${url}?X-Amz-Signature=temporary`,
  ])
    assert.throws(() =>
      resolveOnlineSoundtrackCatalogue({
        ...catalogue,
        counts: { ...catalogue.counts, audioBytes: bytes.length },
        tracks: [{ ...externalTrack, audio: { ...externalTrack.audio, path } }],
      }),
    );
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

test('online catalogue preserves uploader-confirmed unknown rights without forging a licence', () => {
  const credit = 'Song by Creator. Rights confirmed by uploader.';
  const rights = {
    licenseId: 'UNKNOWN',
    licenseVersion: null,
    licenseURL: null,
    rightsEvidenceURL: track.source,
    attribution: credit,
    derivativeChangeNotice: 'Exact submitted MP3 bytes retained.',
    permissionBasis: 'uploader-confirmed-public-redistribution-and-web-playback',
    shareAlike: {
      required: null,
      deliveryLicenseId: null,
      deliveryLicenseVersion: null,
      deliveryLicenseURL: null,
    },
  };
  const resolved = resolveOnlineSoundtrackCatalogue({
    ...catalogue,
    tracks: [
      {
        ...track,
        license: 'Unknown — uploader-confirmed rights',
        licenseURL: null,
        credit,
        rights,
        recordingModeEligible: false,
      },
    ],
  }).tracks[0];
  assert.equal(resolved.rights.license, 'Unknown — uploader-confirmed rights');
  assert.equal(resolved.rights.evidence.permissionBasis, rights.permissionBasis);
  assert.equal(resolved.websites.length, 1);
  assert.deepEqual(resolved.collections, ['Creator album', 'Metal action']);
});

test('online catalogue normalizes accidental edge whitespace in source and credit metadata', () => {
  const credit = 'Song by Creator. Rights confirmed by uploader.';
  const source = 'https://creator.example/song';
  const resolved = resolveOnlineSoundtrackCatalogue({
    ...catalogue,
    tracks: [
      {
        ...track,
        source: `${source}\n`,
        credit: `${credit}\n`,
        license: 'Unknown — uploader-confirmed rights',
        licenseURL: null,
        rights: {
          licenseId: 'UNKNOWN',
          licenseVersion: null,
          licenseURL: null,
          rightsEvidenceURL: `${source}\n`,
          attribution: `${credit}\n`,
          derivativeChangeNotice: 'Exact submitted bytes retained.',
          permissionBasis: 'uploader-confirmed-public-redistribution-and-web-playback',
          shareAlike: {
            required: null,
            deliveryLicenseId: null,
            deliveryLicenseVersion: null,
            deliveryLicenseURL: null,
          },
        },
      },
    ],
  }).tracks[0];
  assert.equal(resolved.rights.source, source);
  assert.equal(resolved.rights.credit, credit);
  assert.equal(resolved.rights.evidence.evidence, source);
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

test('online catalogue accepts a valid 512-recording payload above the legacy limits', async () => {
  const tracks = Array.from({ length: 512 }, (_, index) => {
    const hash = index.toString(16).padStart(64, '0');
    const credit = `Song ${index} by Creator. ${'Attribution details. '.repeat(32)}`.trim();
    return {
      ...track,
      id: `creator.song-${index}`,
      credit,
      audio: {
        ...track.audio,
        path: `https://github.com/mekhovov/revealline-soundtracks/releases/download/audio-test/${hash}.mp3`,
        sha256: hash,
      },
      rights: {
        licenseId: 'CC-BY',
        licenseVersion: '4.0',
        licenseURL: track.licenseURL,
        rightsEvidenceURL: track.source,
        attribution: credit,
        derivativeChangeNotice: 'Converted from the creator recording to a verified MP3.',
        shareAlike: {
          required: false,
          deliveryLicenseId: null,
          deliveryLicenseVersion: null,
          deliveryLicenseURL: null,
        },
      },
    };
  });
  const value = {
    ...catalogue,
    counts: {
      declaredTracks: tracks.length,
      uniqueRecordings: tracks.length,
      duplicateAliases: 0,
      audioBytes: tracks.reduce((sum, item) => sum + item.audio.bytes, 0),
    },
    tracks,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  assert.ok(bytes.byteLength > 512 * 1024, 'fixture crosses the retired 512 KiB limit');
  const resolved = await fetchOnlineSoundtrackCatalogue({
    fetch: async (url) => ({
      status: 200,
      redirected: false,
      url,
      headers: new Headers({ 'content-length': String(bytes.byteLength) }),
      body: new Response(bytes).body,
    }),
  });
  assert.equal(resolved.tracks.length, 512);
});

test('online catalogue rejects a 513th recording before queue construction', () => {
  const tracks = Array.from({ length: 513 }, (_, index) => {
    const hash = index.toString(16).padStart(64, '0');
    return {
      ...track,
      id: `creator.song-${index}`,
      audio: {
        ...track.audio,
        path: `https://github.com/mekhovov/revealline-soundtracks/releases/download/audio-test/${hash}.mp3`,
        sha256: hash,
      },
    };
  });
  assert.throws(
    () =>
      resolveOnlineSoundtrackCatalogue({
        ...catalogue,
        counts: {
          declaredTracks: tracks.length,
          uniqueRecordings: tracks.length,
          duplicateAliases: 0,
          audioBytes: tracks.reduce((sum, item) => sum + item.audio.bytes, 0),
        },
        tracks,
      }),
    /item budget|structural budget|list is too large/,
  );
});

test('online catalogue retains an independent structural-node ceiling', () => {
  const oversizedStructure = {
    ...catalogue,
    sources: Array.from({ length: 32 }, () => Array.from({ length: 512 }, () => [1, 2, 3, 4])),
  };
  assert.ok(JSON.stringify(oversizedStructure).length < 2 * 1024 * 1024);
  assert.throws(() => resolveOnlineSoundtrackCatalogue(oversizedStructure), /structural budget/);
});

test('online catalogue stops reading a streamed response at its byte limit', async () => {
  const chunk = new Uint8Array(1024 * 1024),
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
