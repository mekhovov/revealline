import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createOnlineSoundtrackSourceManager,
  DEFAULT_ONLINE_SOUNDTRACK_SOURCES,
  resolveOnlineSoundtrackSources,
  normalizeOnlineSoundtrackSourceURL,
} from '../online-soundtrack-sources.mjs';
import {
  ONLINE_SOUNDTRACK_CATALOGUE_URL,
  createOnlineSoundtrackSourceAuthority,
  resolveOnlineSoundtrackCatalogue,
  isResolvedOnlineSoundtrackTrack,
  onlineSoundtrackRecordingAllowed,
  onlineSoundtrackOfflineAllowed,
  fetchVerifiedOnlineSoundtrack,
} from '../online-soundtrack-catalogue.mjs';
import {
  publicCatalogueFixture,
  publicCatalogueResponse,
} from './helpers/soundtrack-public-catalogue.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { emptySoundtrackLibrary, upgradeSoundtrackLibrary } from '../soundtrack.mjs';

const main = ONLINE_SOUNDTRACK_CATALOGUE_URL,
  custom = 'https://music.example.net/catalogue.json';
const descriptors = (mainEnabled = true, customEnabled = true) => [
  { url: main, enabled: mainEnabled },
  { url: custom, enabled: customEnabled },
];
function catalogue(url, hashes = ['a'], { unknown = false, review = false } = {}) {
  const value = publicCatalogueFixture(),
    original = value.tracks[0];
  value.archive = {
    id: url === main ? 'revealline-soundtracks' : 'community-fixture',
    baseURL: new URL('.', url).href,
  };
  value.tracks = hashes.map((hash, index) => {
    const sha256 = hash.padStart(64, '0');
    const track = {
      ...original,
      id: `fixture-${index}`,
      title: `Song ${hash}`,
      tags: unknown ? ['ФПВ'] : ['synth'],
      audio: { ...original.audio, sha256, path: `objects/${sha256}.mp3` },
    };
    if (review) track.visibility = 'review-only';
    if (unknown)
      Object.assign(track, {
        license: 'Unknown — uploader-confirmed rights',
        licenseURL: null,
        rights: {
          licenseId: 'UNKNOWN',
          licenseVersion: null,
          licenseURL: null,
          rightsEvidenceURL: track.source,
          attribution: track.credit,
          derivativeChangeNotice: 'Original uploader-supplied recording.',
          permissionBasis: 'uploader-confirmed-public-redistribution-and-web-playback',
          shareAlike: {
            required: null,
            deliveryLicenseId: null,
            deliveryLicenseVersion: null,
            deliveryLicenseURL: null,
          },
        },
      });
    return track;
  });
  value.counts = {
    declaredTracks: hashes.length,
    uniqueRecordings: hashes.length,
    duplicateAliases: 0,
    audioBytes: hashes.length * original.audio.bytes,
  };
  return value;
}
function response(url, value = catalogue(url)) {
  return { ...publicCatalogueResponse(value), url };
}
function manager(t, options = {}) {
  const value = createOnlineSoundtrackSourceManager(options);
  t.after(() => value.dispose());
  return value;
}
function player(t, sourceManager) {
  const h = audioHarness(),
    value = createSoundtrackPlayer({
      soundscape: h.soundscape,
      audioElement: h.media,
      URLImpl: h.URLImpl,
      readAsset: async () => {
        throw new Error('Unexpected local asset read.');
      },
      fadeMs: 0,
      onlineSourceManager: sourceManager,
    });
  value.setLibrary(upgradeSoundtrackLibrary(emptySoundtrackLibrary()));
  t.after(() => {
    value.dispose();
    h.soundscape.dispose();
  });
  return { ...h, player: value };
}

test('sources default to main only; explicit site URLs normalize and source count is bounded', () => {
  assert.deepEqual(resolveOnlineSoundtrackSources(DEFAULT_ONLINE_SOUNDTRACK_SOURCES), [
    { url: main, enabled: true },
  ]);
  assert.equal(normalizeOnlineSoundtrackSourceURL('https://music.example.net'), custom);
  assert.equal(
    normalizeOnlineSoundtrackSourceURL('https://music.example.net/pack/'),
    'https://music.example.net/pack/catalogue.json',
  );
  assert.throws(() => resolveOnlineSoundtrackSources([{ url: custom, enabled: true }]));
  assert.throws(() =>
    resolveOnlineSoundtrackSources([...descriptors(), { url: custom, enabled: false }]),
  );
  assert.throws(() =>
    resolveOnlineSoundtrackSources([
      ...DEFAULT_ONLINE_SOUNDTRACK_SOURCES,
      ...['a', 'b', 'c', 'd'].map((host) => ({
        url: `https://${host}.example.net`,
        enabled: true,
      })),
    ]),
  );
});
for (const url of [
  'http://music.example.net',
  'https://u:p@music.example.net',
  'https://localhost',
  'https://localhost.',
  'https://server.local',
  'https://server.internal',
  'https://intranet',
  'https://127.0.0.1',
  'https://2130706433',
  'https://10.1.2.3',
  'https://172.16.1.2',
  'https://192.168.1.1',
  'https://169.254.169.254',
  'https://100.64.0.1',
  'https://224.0.0.1',
  'https://[::1]',
  'https://music.example.net/?token=x',
  'https://music.example.net/#x',
]) {
  test(`source URL rejects ${url}`, () =>
    assert.throws(() => normalizeOnlineSoundtrackSourceURL(url)));
}

test('optional UNKNOWN requires complete uploader permission; main and review-only remain excluded', async (t) => {
  const customCatalogue = catalogue(custom, ['a'], { unknown: true });
  const sourceAuthority = createOnlineSoundtrackSourceAuthority(custom, { allowUnknown: true });
  const track = resolveOnlineSoundtrackCatalogue(customCatalogue, { sourceAuthority }).tracks[0];
  assert.equal(track.rights.kind, 'unknown');
  assert.equal(track.contentId, 'unknown');
  assert.equal(track.recordingModeEligible, false);
  assert.equal(onlineSoundtrackRecordingAllowed(track), false);
  assert.equal(onlineSoundtrackOfflineAllowed(track), false);
  let downloaded = false;
  await assert.rejects(
    fetchVerifiedOnlineSoundtrack(track, {
      fetch: async () => {
        downloaded = true;
      },
    }),
  );
  assert.equal(downloaded, false);
  assert.equal(
    resolveOnlineSoundtrackCatalogue(catalogue(main, ['a'], { unknown: true })).tracks.length,
    0,
  );
  assert.equal(
    resolveOnlineSoundtrackCatalogue(catalogue(custom, ['a'], { unknown: true, review: true }), {
      sourceAuthority,
    }).tracks.length,
    0,
  );
  customCatalogue.tracks[0].rights.permissionBasis = 'unchecked';
  assert.throws(() => resolveOnlineSoundtrackCatalogue(customCatalogue, { sourceAuthority }));
  assert.throws(() => createOnlineSoundtrackSourceAuthority(main, { allowUnknown: true }));
  const feed = manager(t, {
    sources: descriptors(false),
    fetch: async (url) => response(url, catalogue(url, ['a'], { unknown: true })),
  });
  assert.equal((await feed.refresh()).tracks.length, 1);
});

test('custom catalogue cannot change its directory, origin, or hash-bound audio path', () => {
  const sourceAuthority = createOnlineSoundtrackSourceAuthority(custom, { allowUnknown: true });
  for (const change of [
    (v) => (v.archive.baseURL = 'https://other.example.net/'),
    (v) => (v.archive.baseURL = 'https://music.example.net/other/'),
    (v) => (v.tracks[0].audio.path = 'https://other.example.net/objects/a.mp3'),
    (v) => (v.tracks[0].audio.path = `../objects/${'a'.repeat(64)}.mp3`),
  ]) {
    const value = catalogue(custom);
    change(value);
    assert.throws(() => resolveOnlineSoundtrackCatalogue(value, { sourceAuthority }));
  }
});

test('one failed or redirecting feed does not poison healthy feed; no request until refresh', async (t) => {
  const calls = [];
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url, options) => {
      calls.push(url);
      assert.equal(options.redirect, 'error');
      return url === main ? response(url) : { ...response(url), redirected: true };
    },
  });
  assert.deepEqual(calls, []);
  const state = await feed.refresh();
  assert.deepEqual(calls.sort(), [main, custom].sort());
  assert.equal(state.tracks.length, 1);
  assert.equal(state.sources[0].status, 'ready');
  assert.equal(state.sources[1].status, 'error');
});

test('source removal aborts in-flight requests and stale completion cannot restore membership', async (t) => {
  let finish, signal;
  const feed = manager(t, {
    sources: descriptors(false),
    fetch: (url, options) => {
      signal = options.signal;
      return new Promise((resolve) => {
        finish = () => resolve(response(url));
      });
    },
  });
  const refreshing = feed.refresh();
  feed.setSources([{ url: main, enabled: false }]);
  assert.equal(signal.aborted, true);
  finish();
  await refreshing;
  assert.deepEqual(feed.snapshot().tracks, []);
  assert.equal(feed.snapshot().sources.length, 1);
});

test('disabled source and same-hash rights changes revoke old objects without revoking independent manager', async (t) => {
  let unknown = false;
  const first = manager(t, {
    sources: descriptors(false),
    fetch: async (url) => response(url, catalogue(url, ['a'], { unknown })),
  });
  const second = manager(t, { sources: descriptors(false), fetch: async (url) => response(url) });
  const old = (await first.refresh()).tracks[0],
    independent = (await second.refresh()).tracks[0];
  unknown = true;
  const revised = (await first.refresh()).tracks[0];
  assert.equal(isResolvedOnlineSoundtrackTrack(old), false);
  assert.equal(revised.rights.kind, 'unknown');
  assert.equal(isResolvedOnlineSoundtrackTrack(independent), true);
  first.setSources(descriptors(false, false));
  assert.equal(isResolvedOnlineSoundtrackTrack(revised), false);
  first.setSources(descriptors(false, true));
  assert.equal(isResolvedOnlineSoundtrackTrack(revised), false);
  assert.equal(isResolvedOnlineSoundtrackTrack(independent), true);
});

test('exact hashes dedupe with retained credits and restrictive rights; hash-size conflict is quarantined', async (t) => {
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url) => response(url, catalogue(url, ['a'], { unknown: url === custom })),
  });
  const merged = (await feed.refresh()).tracks[0];
  assert.deepEqual(merged.sourceURLs, [main, custom]);
  assert.equal(merged.sourceCredits.length, 2);
  assert.equal(merged.rights.kind, 'unknown');
  assert.equal(onlineSoundtrackOfflineAllowed(merged), false);
  assert.equal(onlineSoundtrackRecordingAllowed(merged), false);
  feed.setSources(descriptors(true, false));
  assert.equal(isResolvedOnlineSoundtrackTrack(merged), false);
  assert.equal(feed.snapshot().tracks[0].rights.kind, 'licensed');
  const conflicts = manager(t, {
    sources: descriptors(),
    fetch: async (url) => {
      const value = catalogue(url, url === main ? ['a', 'b'] : ['a']);
      if (url === custom) {
        value.tracks[0].audio.bytes++;
        value.counts.audioBytes++;
      }
      return response(url, value);
    },
  });
  assert.equal((await conflicts.refresh()).conflicts, 1);
  assert.equal(conflicts.snapshot().tracks.length, 1);
});

test('aggregate output stays within 512 while independently healthy sources remain ready', async (t) => {
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url) =>
      response(
        url,
        catalogue(
          url,
          Array.from({ length: 300 }, (_, i) => (i + (url === main ? 0 : 300)).toString(16)),
        ),
      ),
  });
  const state = await feed.refresh();
  assert.equal(state.tracks.length, 512);
  assert.equal(state.limited, true);
  assert(state.sources.every((row) => row.status === 'ready'));
});

test('disabling playing source switches to retained source on the same transport and repeat cannot revive it', async (t) => {
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url) => response(url, catalogue(url, [url === main ? 'a' : 'b'])),
  });
  const state = await feed.refresh(),
    h = player(t, feed);
  assert.equal(
    await h.player.playRemotePlaylist(state.tracks, { repeat: 'one', allowLibraryFallback: false }),
    true,
  );
  assert(h.media.src.startsWith(new URL('.', main).href));
  feed.setSources(descriptors(false));
  await settleUntil(
    () =>
      h.player.snapshot().status === 'playing' &&
      h.player.snapshot().track?.id === state.tracks[1].id,
  );
  assert(h.media.src.startsWith(new URL('.', custom).href));
  assert.deepEqual(h.player.snapshot().queue, [state.tracks[1].id]);
  await h.player.next();
  assert.equal(h.player.snapshot().track.id, state.tracks[1].id);
  feed.setSources(descriptors(false, false));
  assert.equal(h.player.snapshot().track, null);
  assert.equal(h.media.paused, true);
  assert.deepEqual(h.player.snapshot().queue, []);
});

test('source disabled while paused does not start next source, and stale queue entry is rejected', async (t) => {
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url) => response(url, catalogue(url, [url === main ? 'a' : 'b'])),
  });
  const state = await feed.refresh(),
    h = player(t, feed);
  await h.player.playRemotePlaylist(state.tracks, { allowLibraryFallback: false });
  h.player.pause();
  const plays = h.media.plays;
  feed.setSources(descriptors(false));
  assert.equal(h.media.plays, plays);
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(h.player.snapshot().track, null);
  assert.equal(await h.player.play(), true);
  assert.equal(h.player.snapshot().track.id, state.tracks[1].id);
  await assert.rejects(h.player.playRemotePlaylist([state.tracks[0]]));
});

test('same hash can keep playing from retained source after primary source is disabled', async (t) => {
  const feed = manager(t, { sources: descriptors(), fetch: async (url) => response(url) });
  const state = await feed.refresh(),
    h = player(t, feed);
  await h.player.playRemotePlaylist(state.tracks, { allowLibraryFallback: false });
  feed.setSources(descriptors(false));
  await settleUntil(
    () =>
      h.player.snapshot().status === 'playing' && h.media.src.startsWith(new URL('.', custom).href),
  );
  assert.equal(h.player.snapshot().queue.length, 1);
});

test('saved mapped styles fall back locally with every feed off without network; FPV does not', async (t) => {
  let requests = 0;
  const feed = manager(t, {
      sources: [{ url: main, enabled: false }],
      fetch: async () => {
        requests++;
        throw new Error('No fetch');
      },
    }),
    h = player(t, feed);
  const library = upgradeSoundtrackLibrary(emptySoundtrackLibrary());
  h.player.setLibrary(
    { ...library, listening: { ...library.listening, mode: 'synth90s', genres: ['synth90s'] } },
    { publicStyles: ['synth'] },
  );
  assert.equal(await h.player.play(), true);
  assert.equal(h.player.snapshot().track.kind, 'synth');
  assert.equal(requests, 0);
  h.player.setLibrary(library, { publicStyles: ['fpv'] });
  assert.equal(await h.player.play(), false);
  assert.equal(h.player.snapshot().track, null);
  assert.equal(requests, 0);
});

test('catalogue refresh during playback retains unchanged recording and paused replay uses current membership', async (t) => {
  const feed = manager(t, { sources: descriptors(false), fetch: async (url) => response(url) });
  const state = await feed.refresh(),
    h = player(t, feed);
  await h.player.playRemotePlaylist(state.tracks, { allowLibraryFallback: false });
  const plays = h.media.plays;
  await feed.refresh();
  assert.equal(h.player.snapshot().status, 'playing');
  assert.equal(h.media.plays, plays);
  h.player.pause();
  await feed.refresh();
  assert.equal(h.media.plays, plays);
  assert.equal(await h.player.play(), true);
  assert.equal(h.player.snapshot().track.id, state.tracks[0].id);
});

test('source-off retains local mixed queue and paused intent without importing assets', async (t) => {
  const feed = manager(t, { sources: descriptors(false), fetch: async (url) => response(url) });
  const state = await feed.refresh(),
    h = player(t, feed);
  const library = upgradeSoundtrackLibrary(emptySoundtrackLibrary());
  h.player.setLibrary({
    ...library,
    listening: { ...library.listening, mode: 'synth90s', genres: ['synth90s'] },
  });
  await h.player.playRemotePlaylist(state.tracks, {
    mixWithLibrary: true,
    allowLibraryFallback: false,
  });
  const localIds = h.player.snapshot().queue.filter((id) => !id.startsWith('online.'));
  assert(localIds.length > 0);
  h.player.pause();
  const plays = h.media.plays;
  feed.setSources(descriptors(false, false));
  assert.deepEqual(h.player.snapshot().queue, localIds);
  assert.equal(h.media.plays, plays);
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(await h.player.play(), true);
  assert.equal(h.player.snapshot().track.kind, 'synth');
});

test('one playback failure advances within retained enabled feeds and failed source refresh removes only its entries', async (t) => {
  let failed = false;
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url) => {
      if (failed && url === main) throw new Error('Offline main');
      return response(url, catalogue(url, [url === main ? 'a' : 'b']));
    },
  });
  const state = await feed.refresh(),
    h = player(t, feed);
  await h.player.playRemotePlaylist(state.tracks, { allowLibraryFallback: false });
  failed = true;
  await feed.refresh();
  await settleUntil(
    () =>
      h.player.snapshot().status === 'playing' &&
      h.player.snapshot().track?.id === state.tracks[1].id,
  );
  assert.deepEqual(h.player.snapshot().queue, [state.tracks[1].id]);
  assert.equal(feed.snapshot().sources[0].status, 'error');
  assert.equal(feed.snapshot().sources[1].status, 'ready');
});

for (const pendingRead of [false, true])
  test(`removing source preserves and reindexes ${pendingRead ? 'pending' : 'completed'} local preload`, async (t) => {
    const first = await fixture(),
      second = await fixture('other');
    let releaseRead,
      startedRead = false;
    const deferredRead = new Promise((resolve) => {
      releaseRead = resolve;
    });
    const h = audioHarness(),
      h2 = audioHarness();
    const secondTrack = { ...second.track, id: 'qa.other' };
    const library = {
      ...emptySoundtrackLibrary(),
      tracks: [first.track, secondTrack],
      playlists: [
        {
          id: 'qa.locals',
          title: 'Local originals',
          trackIds: [first.track.id, secondTrack.id],
          order: 'ordered',
          repeat: 'all',
        },
      ],
      selection: { playlistId: 'qa.locals' },
    };
    const feed = manager(t, { sources: descriptors(false), fetch: async (url) => response(url) });
    const value = createSoundtrackPlayer({
      soundscape: h.soundscape,
      audioElement: h.media,
      secondAudioElement: h2.media,
      URLImpl: h.URLImpl,
      fadeMs: 50,
      onlineSourceManager: feed,
      readAsset: async (sha256) => {
        if (sha256 === first.track.asset.sha256) return first.blob;
        startedRead = true;
        if (pendingRead) await deferredRead;
        return second.blob;
      },
    });
    t.after(() => {
      value.dispose();
      h.soundscape.dispose();
      h2.soundscape.dispose();
    });
    value.setLibrary(library);
    await value.playRemotePlaylist((await feed.refresh()).tracks, {
      mixWithLibrary: true,
      allowLibraryFallback: false,
    });
    await value.next();
    await settleUntil(() =>
      pendingRead ? startedRead : value.snapshot().preloadedTrackId === secondTrack.id,
    );
    await feed.refresh();
    if (!pendingRead) assert.equal(value.snapshot().preloadedTrackId, secondTrack.id);
    feed.setSources(descriptors(false, false));
    assert.equal(value.snapshot().track.id, first.track.id);
    assert.deepEqual(value.snapshot().queue, [first.track.id, secondTrack.id]);
    releaseRead();
    await settleUntil(() => value.snapshot().preloadedTrackId === secondTrack.id);
    assert.equal(value.snapshot().preloadedTrackId, secondTrack.id);
    h.media.currentTime = first.track.asset.durationSeconds - 0.01;
    h.media.emit('timeupdate');
    await settleUntil(
      () => value.snapshot().track?.id === secondTrack.id && value.snapshot().status === 'playing',
    );
    assert.equal(value.snapshot().track.id, secondTrack.id);
  });

test('duplicate hash retains styles, collections and licence links from every enabled source', async (t) => {
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url) => {
      const value = catalogue(url, ['a'], { unknown: url === custom });
      value.tracks[0].collections = [url === main ? 'Main collection' : 'FPV collection'];
      return response(url, value);
    },
  });
  const state = await feed.refresh(),
    merged = state.tracks[0];
  assert(state.styles.includes('synth'));
  assert(state.styles.includes('fpv'));
  assert.deepEqual(merged.collections, ['Main collection', 'FPV collection']);
  assert.equal(
    merged.sourceCredits[0].licenseURL,
    'https://creativecommons.org/publicdomain/zero/1.0/',
  );
  assert.equal(merged.sourceCredits[1].licenseURL, null);
});

for (const change of ['disable', 'rights'])
  test(`verified offline fetch rejects ${change} during download`, async (t) => {
    const bytes = new Uint8Array([1, 2, 3]),
      sha256 = createHash('sha256').update(bytes).digest('hex');
    let unknown = false;
    const feed = manager(t, {
      sources: descriptors(false),
      fetch: async (url) => {
        const value = catalogue(url, [sha256], { unknown });
        value.tracks[0].audio.path = new URL(value.tracks[0].audio.path, url).href;
        value.tracks[0].audio.bytes = bytes.length;
        value.counts.audioBytes = bytes.length;
        value.tracks[0].audio.delivery = {
          type: 'external-url',
          verifiedAt: '2026-10-01T00:00:00Z',
          rangeRequests: true,
          cors: true,
        };
        return response(url, value);
      },
    });
    const track = (await feed.refresh()).tracks[0];
    assert(track && onlineSoundtrackOfflineAllowed(track));
    let finish;
    const downloading = fetchVerifiedOnlineSoundtrack(track, {
      fetch: () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              status: 200,
              redirected: false,
              url: track.url,
              headers: { get: () => String(bytes.length) },
              body: new Response(bytes).body,
            });
        }),
    });
    if (change === 'disable') feed.setSources(descriptors(false, false));
    else {
      unknown = true;
      await feed.refresh();
    }
    finish();
    await assert.rejects(downloading, /no longer permits/);
  });

test('same licence with different attribution keeps streaming credits but cannot grant offline or Recording permission', async (t) => {
  const feed = manager(t, {
    sources: descriptors(),
    fetch: async (url) => {
      const value = catalogue(url);
      if (url === custom) value.tracks[0].credit = 'Additional contributor attribution';
      return response(url, value);
    },
  });
  const state = await feed.refresh(),
    track = state.tracks[0],
    h = player(t, feed);
  assert.equal(track.rights.kind, 'licensed');
  assert.equal(track.rightsConflict, true);
  assert.equal(onlineSoundtrackOfflineAllowed(track), false);
  assert.equal(onlineSoundtrackRecordingAllowed(track), false);
  assert.equal(await h.player.playRemotePlaylist(state.tracks), true);
  assert.deepEqual(h.player.snapshot().track.sourceCredits, track.sourceCredits);
  assert.equal(track.sourceCredits[1].credit, 'Additional contributor attribution');
});
