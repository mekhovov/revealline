import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { createSoundtrackSource } from '../soundtrack-source.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { SOUNDTRACK_COLLECTIONS } from '../content/soundtrack-catalogue.mjs';
import { emptySoundtrackLibrary, setCatalogueTracks } from '../soundtrack.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';
import { responseFor } from './helpers/soundtrack-albums.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';

const originals = await Promise.all([fixture('prepare-menu'), fixture('prepare-game')]);
const tracks = originals.map((original, index) => ({
  ...original.track,
  id: `builtin.catalog.prepare-${index}`,
  edition: 'preparation-test',
  path: `optional/soundtracks/prepare-${index}.mp3`,
  tags: { genres: ['synth90s'], role: index ? 'gameplay' : 'menu', energy: 3, themes: [] },
}));
const catalogue = {
  format: 'revealline-soundtrack-catalogue.v1',
  edition: 'preparation-test',
  tracks,
};
function setup(t, { local = new Map(), ordered = false, master, readAsset } = {}) {
  const audio = audioHarness(),
    second = audioHarness().media,
    requests = [];
  const source = createSoundtrackSource({
    catalogue,
    baseURL: 'https://example.test/releases/test/',
    readLocal: (hash) => local.get(hash) ?? null,
    fetch: async (url) => {
      requests.push(url);
      const index = tracks.findIndex((track) => url.endsWith(track.path));
      assert.notEqual(index, -1);
      return responseFor(originals[index].blob, url);
    },
  });
  const player = createSoundtrackPlayer({
    soundscape: audio.soundscape,
    audioElement: audio.media,
    secondAudioElement: second,
    URLImpl: audio.URLImpl,
    readAsset: readAsset ?? source.readAsset,
    catalogue,
    audioMaster: master,
    fadeMs: 0,
  });
  let library = setCatalogueTracks(emptySoundtrackLibrary(), tracks);
  if (ordered)
    library = {
      ...library,
      playlists: [
        {
          id: 'test.online',
          title: 'Online queue',
          trackIds: tracks.map((track) => track.id),
          order: 'ordered',
          repeat: 'all',
        },
      ],
      selection: { playlistId: 'test.online' },
    };
  player.setLibrary(library);
  player.setContext({ scene: 'menu' });
  t.after(() => player.dispose());
  return { ...audio, second, player, requests, source };
}

test('silent missing-local preparation preserves selection and explicit Play acquires only current and next', async (t) => {
  const h = setup(t, { ordered: true });
  assert.equal(await h.player.prepare(), false);
  assert.equal(h.player.snapshot().track.id, tracks[0].id);
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(h.player.snapshot().error, null);
  assert.deepEqual(h.requests, []);
  assert.equal(h.created.length, 0);
  assert.equal(h.media.plays, 0);
  assert.equal(await h.player.play(), true);
  await settleUntil(() => h.player.snapshot().preloadedTrackId === tracks[1].id);
  assert.deepEqual(
    h.requests,
    tracks.map((track) => `https://example.test/releases/test/${track.path}`),
  );
  assert.equal(h.created.length - h.revoked.length, 2);
  h.player.pause();
  await h.player.selectPlaylist('test.online');
  await h.player.prepare();
  assert.equal(
    h.requests.length,
    2,
    'Selecting/preparing while intentionally paused never acquires another original',
  );
  assert.equal(h.player.snapshot().desired, false);
});

test('silent menu-to-practice context changes do not fetch the selected online original', async (t) => {
  const h = setup(t);
  await h.player.prepare();
  h.player.setContext({ scene: 'gameplay', mapKey: 'practice.map', themeId: 'retro' });
  await settleUntil(
    () => h.player.snapshot().track?.id === tracks[1].id && !h.player.snapshot().preparation,
  );
  assert.deepEqual(h.requests, []);
  assert.equal(h.media.plays, 0);
  await h.player.play();
  assert(h.requests.length > 0 && h.requests.every((url) => url.endsWith(tracks[1].path)));
  assert.equal(h.player.snapshot().track.id, tracks[1].id);
});

test('master mute and deliberate Pause prevent a host opt-in from speculatively acquiring audio', async (t) => {
  const master = createAudioMaster({ muted: true });
  const h = setup(t, { master });
  await h.player.prepare({ allowNetwork: true });
  assert.deepEqual(h.requests, []);
  master.setMuted(false);
  await h.player.prepare({ allowNetwork: true });
  assert.equal(
    h.requests.length,
    1,
    'An unmuted host may explicitly prepare its remembered listening choice',
  );
  assert.equal(h.media.plays, 0);
  h.player.pause();
  h.player.setContext({ scene: 'gameplay' });
  await settleUntil(() => !h.player.snapshot().preparation);
  await h.player.prepare({ allowNetwork: true });
  assert.equal(h.requests.length, 1, 'Pause wins over a later preparation opt-in');
  assert.equal(h.player.snapshot().desired, false);
});

test('muting aborts next-track acquisition and late bytes cannot allocate a silent deck', async (t) => {
  const master = createAudioMaster({ muted: false });
  let reads = 0,
    finish,
    nextSignal;
  const h = setup(t, {
    ordered: true,
    master,
    readAsset: async (hash, options) => {
      if (options.localOnly) return null;
      reads++;
      if (hash === tracks[0].asset.sha256) return originals[0].blob;
      nextSignal = options.signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  await h.player.play();
  await settleUntil(() => Boolean(finish));
  master.setMuted(true);
  assert.equal(nextSignal.aborted, true);
  finish(originals[1].blob);
  await delay(10);
  assert.equal(h.created.length, 1);
  assert.equal(h.second.plays, 0);
  assert.equal(h.player.snapshot().preloadedTrackId, null);
  h.player.pause();
  master.setMuted(false);
  await h.player.prepare({ allowNetwork: true });
  assert.equal(reads, 2, 'Unmuting does not override a music-only Pause');
});

test('local preparation retains direct gesture playback before an asynchronous context wake', async (t) => {
  const local = new Map([[tracks[0].asset.sha256, originals[0].blob]]);
  const h = setup(t, { local });
  await h.player.prepare();
  assert.equal(h.created.length, 1);
  let finish;
  h.soundscape.enable = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const playing = h.player.play();
  assert.equal(h.media.plays, 1, 'Prepared local media.play stays in the gesture call stack');
  finish(true);
  assert.equal(await playing, true);
  assert.deepEqual(h.requests, []);
});

test('a generated album selection stays local until Play and then acquires current plus next only', async (t) => {
  const album = SOUNDTRACK_COLLECTIONS.find((entry) => entry.trackIds.length >= 3);
  assert(album, 'This edition declares a multi-track hosted album.');
  const fixtures = await Promise.all([0, 1, 2].map((index) => fixture(`album-bounded-${index}`)));
  const records = fixtures.map((original, index) => ({
    ...tracks[0],
    ...original.track,
    id: album.trackIds[index],
    path: `optional/soundtracks/album-${index}.mp3`,
  }));
  const requests = [],
    audio = audioHarness();
  const source = createSoundtrackSource({
    catalogue: { ...catalogue, tracks: records },
    baseURL: 'https://example.test/release/',
    fetch: async (url) => {
      requests.push(url);
      const index = records.findIndex((track) => url.endsWith(track.path));
      assert.notEqual(index, -1);
      return responseFor(fixtures[index].blob, url);
    },
  });
  const player = createSoundtrackPlayer({
    soundscape: audio.soundscape,
    audioElement: audio.media,
    secondAudioElement: audioHarness().media,
    URLImpl: audio.URLImpl,
    catalogue: source.catalogue,
    readAsset: source.readAsset,
    random: () => 0,
    fadeMs: 0,
  });
  t.after(() => player.dispose());
  player.setLibrary(setCatalogueTracks(emptySoundtrackLibrary(), records));
  await player.selectPlaylist(album.id);
  assert.deepEqual(requests, []);
  assert.equal(player.snapshot().selection, album.id);
  await player.play();
  await settleUntil(() => Boolean(player.snapshot().preloadedTrackId));
  assert.equal(requests.length, 2);
  assert.equal(new Set(requests).size, 2);
  assert.equal(audio.created.length - audio.revoked.length, 2);
});

for (const action of ['dispose', 'play']) {
  test(`a late local-only miss cannot overwrite a newer ${action} operation`, async (t) => {
    let playing, release;
    const h = setup(t, {
      readAsset: async (hash, { localOnly }) => {
        if (localOnly) {
          queueMicrotask(() =>
            queueMicrotask(() => {
              if (action === 'dispose') h.player.dispose();
              else playing = h.player.play();
            }),
          );
          return null;
        }
        if (!release)
          return new Promise((resolve) => {
            release = resolve;
          });
        return originals[0].blob;
      },
    });
    assert.equal(await h.player.prepare(), false);
    assert.equal(h.player.snapshot().status, action === 'dispose' ? 'disposed' : 'loading');
    if (action === 'play') {
      assert.equal(h.player.snapshot().desired, true);
      release(originals[0].blob);
      assert.equal(await playing, true);
      assert.equal(h.player.snapshot().status, 'playing');
    }
  });
}
