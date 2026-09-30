import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createCouchMusicLibrary } from '../couch/couch-music-library.mjs';
import { createCouchMusicSession } from '../couch/couch-music-session.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { emptySoundtrackLibrary, upgradeSoundtrackLibrary } from '../soundtrack.mjs';
import { resolveOnlineSoundtrackCatalogue } from '../online-soundtrack-catalogue.mjs';
import {
  PUBLIC_SOUNDTRACK_STYLE_IDS,
  localGenresForPublicStyles,
} from '../soundtrack-style-taxonomy.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import {
  publicCatalogueFixture,
  publicCatalogueResponse,
} from './helpers/soundtrack-public-catalogue.mjs';

const library = upgradeSoundtrackLibrary(emptySoundtrackLibrary());
const libraryFor = (styles) => {
  const genres = localGenresForPublicStyles(styles);
  return genres.length
    ? {
        ...library,
        listening: { ...library.listening, mode: genres.length === 1 ? genres[0] : 'mix', genres },
      }
    : library;
};
const catalogue = publicCatalogueFixture();
const remote = resolveOnlineSoundtrackCatalogue(catalogue).tracks;
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
};
function setup(t, { fetch = async () => publicCatalogueResponse(), ...options } = {}) {
  const h = audioHarness();
  let requests = 0;
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset: async () => {
      throw new Error('No unrelated local original should be requested.');
    },
    fadeMs: 0,
    random: () => 0,
    onlineCatalogueDownload: {
      fetch: (...args) => {
        requests++;
        return fetch(...args);
      },
    },
    ...options,
  });
  t.after(() => {
    player.dispose();
    h.soundscape.dispose();
  });
  return { ...h, player, requests: () => requests };
}
for (const styles of [['fpv'], ['fusion'], ['synth', 'fpv'], PUBLIC_SOUNDTRACK_STYLE_IDS]) {
  test(`saved ${styles.join(',')} resolves on generic Play only and never writes storage`, async (t) => {
    const h = setup(t);
    h.player.setLibrary(libraryFor(styles), { publicStyles: styles });
    assert.equal(await h.player.prepare({ allowNetwork: true }), false);
    assert.equal(h.requests(), 0);
    assert.equal(h.player.snapshot().track, null);
    assert.equal(h.media.plays, 0);
    assert.equal(await h.player.play(), true);
    const queue = h.player.snapshot().queue;
    const expected = remote
      .filter((track) => styles.includes(track.title.toLowerCase()))
      .map((track) => track.id);
    assert.deepEqual(queue.filter((id) => id.startsWith('online.')).sort(), expected.sort());
    assert.equal(h.requests(), 1);
    assert.equal(h.player.snapshot().order, 'shuffle');
    assert.equal(h.player.snapshot().repeat, 'all');
    if (styles.length === 1) assert.equal(queue.length, 1);
    else
      assert(
        queue.some((id) => !id.startsWith('online.')),
        'mapped styles keep local mixing',
      );
  });
}

test('repeated pending Play coalesces and a denied media gesture retries the correct queue directly', async (t) => {
  const response = deferred();
  const h = setup(t, { fetch: () => response.promise });
  h.player.setLibrary(library, { publicStyles: ['fpv'] });
  h.media.rejectPlay = new DOMException('Needs another gesture', 'NotAllowedError');
  const first = h.player.play(),
    second = h.player.play();
  assert.equal(h.requests(), 1);
  response.resolve(publicCatalogueResponse());
  assert.deepEqual(await Promise.all([first, second]), [false, false]);
  assert.equal(h.player.snapshot().status, 'blocked');
  assert.equal(h.player.snapshot().track.title, 'FPV');
  h.media.rejectPlay = null;
  const before = h.media.plays;
  const resumed = h.player.play();
  assert.equal(h.media.plays, before + 1, 'prepared media play remains synchronous with gesture');
  assert.equal(await resumed, true);
  assert.equal(h.requests(), 1);
});

for (const action of [
  'pause',
  'suspend',
  'dispose',
  'close',
  'playlist',
  'remote',
  'styles',
  'clear',
  'policy',
]) {
  test(`late saved-style acquisition loses to ${action}`, async (t) => {
    const response = deferred();
    let signal;
    const h = setup(t, {
      fetch: (_, options) => {
        signal = options.signal;
        return response.promise;
      },
    });
    h.player.setLibrary(library, { publicStyles: ['fpv'] });
    const pending = h.player.play();
    if (action === 'close') h.player.cancelPendingPlay();
    else if (action === 'playlist') await h.player.selectPlaylist('builtin.all');
    else if (action === 'remote') await h.player.playRemotePlaylist([remote[0]]);
    else if (action === 'styles') h.player.setLibrary(library, { publicStyles: ['fusion'] });
    else if (action === 'clear') h.player.setLibrary(library);
    else if (action === 'policy')
      h.player.setLibrary(
        { ...library, listening: { ...library.listening, recordingMode: true } },
        { publicStyles: ['fpv'] },
      );
    else h.player[action]();
    assert.equal(signal.aborted, true);
    const winner = h.player.snapshot();
    response.resolve(publicCatalogueResponse());
    assert.equal(await pending, false);
    assert.deepEqual(
      h.player.snapshot(),
      winner,
      'late archive result cannot replace the winning action',
    );
    assert.notEqual(winner.status, 'loading');
    if (action === 'clear') assert.equal(winner.pendingPublicStyles, false);
  });
}

for (const failure of ['network', 'empty', 'recording']) {
  test(`failed exact-style restoration (${failure}) keeps no prior-genre fallback and permits retry`, async (t) => {
    const invalid = structuredClone(catalogue);
    if (failure === 'empty') invalid.tracks[1].tags = ['ukrainian'];
    if (failure === 'recording') {
      invalid.tracks[1].contentId = 'unknown';
      invalid.tracks[1].recordingModeEligible = false;
    }
    let fail = true;
    const h = setup(t, {
      fetch: async () => {
        if (fail && failure === 'network') throw new Error('offline');
        return publicCatalogueResponse(fail ? invalid : catalogue);
      },
    });
    h.player.setLibrary(
      { ...library, listening: { ...library.listening, recordingMode: true } },
      { publicStyles: ['fpv'] },
    );
    assert.equal(await h.player.play(), false);
    assert.equal(h.player.snapshot().status, 'error');
    assert.equal(h.player.snapshot().track, null);
    assert.equal(h.media.plays, 0);
    assert.equal(h.player.snapshot().pendingPublicStyles, true);
    fail = false;
    assert.equal(await h.player.play(), true);
    assert.equal(h.player.snapshot().track.title, 'FPV');
  });
}

test('same styles and unrelated commits preserve the current session queue and position', async (t) => {
  const h = setup(t);
  h.player.setLibrary(library, { publicStyles: ['fpv'] });
  await h.player.play();
  await h.player.playRemotePlaylist([remote[2], remote[0]]);
  h.media.currentTime = 12;
  const before = {
    queue: h.player.snapshot().queue,
    track: h.player.snapshot().track,
    plays: h.media.plays,
  };
  h.player.setLibrary(
    {
      ...library,
      playlists: [
        {
          id: 'test.unrelated',
          title: 'Unrelated new playlist',
          trackIds: ['builtin.signal-afterglow'],
          order: 'ordered',
          repeat: 'all',
        },
      ],
    },
    { publicStyles: ['fpv'] },
  );
  assert.deepEqual(h.player.snapshot().queue, before.queue);
  assert.deepEqual(h.player.snapshot().track, before.track);
  assert.equal(h.media.currentTime, 12);
  assert.equal(h.media.plays, before.plays);
  assert.equal(h.player.snapshot().pendingPublicStyles, false);
  h.player.pause();
  await h.player.play();
  assert.equal(h.requests(), 1);
  assert.deepEqual(h.player.snapshot().queue, before.queue);
});

test('clearing exact metadata also clears a mixed remote queue while a local member is active', async (t) => {
  const h = setup(t);
  h.player.setLibrary(libraryFor(['synth', 'fpv']), { publicStyles: ['synth', 'fpv'] });
  await h.player.play();
  for (
    let i = 0;
    i < h.player.snapshot().queue.length && h.player.snapshot().track.kind === 'remote';
    i++
  )
    await h.player.next();
  assert.equal(h.player.snapshot().track.kind, 'synth');
  h.player.setLibrary(library);
  assert.equal(h.player.snapshot().track, null);
  await h.player.play();
  assert.equal(h.player.snapshot().source === 'remote', false);
  assert(h.player.snapshot().queue.every((id) => !id.startsWith('online.')));
});

test('generic Play preserves master mute across lazy acquisition', async (t) => {
  const master = createAudioMaster({ muted: true });
  const h = setup(t, { audioMaster: master });
  h.player.setLibrary(library, { publicStyles: ['fpv'] });
  assert.equal(await h.player.play(), true);
  assert.equal(master.snapshot().muted, true);
  assert.equal(h.media.muted, true);
});

for (const styles of [['fpv'], ['fusion'], ['synth', 'fpv']]) {
  test(`Couch reload carries durable ${styles.join(',')} to the first Start without a save`, async (t) => {
    const memory = memoryIndexedDB();
    const manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      soundtrackCatalogue: true,
    });
    const prepared = await prepareSoundtrackLibrary(libraryFor(styles), [], {
      probeMedia: structuralProbe,
    });
    await manager.commitDomain('audio', prepared, { expectedGeneration: 0, publicStyles: styles });
    const h = setup(t);
    const owner = createCouchMusicLibrary({ player: h.player, managedStore: manager });
    const session = createCouchMusicSession({
      player: h.player,
      library: owner,
      soundscape: h.soundscape,
    });
    t.after(() => {
      session.dispose();
      owner.close();
      manager.close();
    });
    await session.loadLibrary();
    assert.equal(h.requests(), 0);
    assert.equal(h.player.snapshot().track, null);
    assert.equal(await session.start(), true);
    const expected = remote
      .filter((track) => styles.includes(track.title.toLowerCase()))
      .map((track) => track.id);
    assert.deepEqual(
      h.player
        .snapshot()
        .queue.filter((id) => id.startsWith('online.'))
        .sort(),
      expected.sort(),
    );
    const snapshot = await manager.readDomain('audio');
    assert.equal(snapshot.generation, 1);
    assert.deepEqual(snapshot.publicStyles, styles);
  });
}

for (const styles of [['fpv'], ['fusion']]) {
  test(`exhausted ${styles[0]} media stops without prior local genre and can retry`, async (t) => {
    const h = setup(t);
    h.player.setLibrary(library, { publicStyles: styles });
    await h.player.play();
    h.media.emit('error');
    await settleUntil(() => h.player.snapshot().status === 'error');
    assert.equal(h.player.snapshot().desired, false);
    assert.equal(h.player.snapshot().source, 'remote');
    assert(h.player.snapshot().queue.every((id) => id.startsWith('online.')));
    assert.equal(await h.player.play(), true);
    assert.equal(h.requests(), 1);
    assert.equal(h.player.snapshot().track.title.toLowerCase(), styles[0]);
  });
}

test('an exact mixed queue can recover only through its already selected local style', async (t) => {
  const h = setup(t);
  h.player.setLibrary(libraryFor(['synth', 'fpv']), { publicStyles: ['synth', 'fpv'] });
  await h.player.play();
  for (let count = 0; count < 3 && h.player.snapshot().track.kind === 'remote'; count++) {
    const failedId = h.player.snapshot().track.id;
    h.media.emit('error');
    await settleUntil(() => h.player.snapshot().track.id !== failedId);
  }
  assert.equal(h.player.snapshot().track.id, 'builtin.signal-afterglow');
  assert.equal(h.player.snapshot().playing, true);
  assert(
    h.player
      .snapshot()
      .queue.every((id) => id.startsWith('online.') || id === 'builtin.signal-afterglow'),
  );
});

test('a changed Recording policy rearms the saved exact choice rather than a prior local projection', async (t) => {
  const unsafe = structuredClone(catalogue);
  unsafe.tracks[1].contentId = 'unknown';
  unsafe.tracks[1].recordingModeEligible = false;
  const h = setup(t, { fetch: async () => publicCatalogueResponse(unsafe) });
  h.player.setLibrary(library, { publicStyles: ['fpv'] });
  assert.equal(await h.player.play(), true);
  h.player.setLibrary(
    { ...library, listening: { ...library.listening, recordingMode: true } },
    { publicStyles: ['fpv'] },
  );
  assert.equal(h.player.snapshot().track, null);
  assert.equal(h.player.snapshot().pendingPublicStyles, true);
  assert.equal(await h.player.play(), false);
  assert.equal(h.player.snapshot().track, null);
});
