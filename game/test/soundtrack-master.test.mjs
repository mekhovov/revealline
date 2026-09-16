import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';

const original = await fixture();
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10);
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function setup(t, { readAsset = async () => original.blob, muted = false } = {}) {
  const h = audioHarness(),
    master = createAudioMaster({ muted, volume: 0.5 });
  const soundscape = new Soundscape({
    persistentMusic: true,
    contextFactory: () => h.context,
    audioMaster: master,
  });
  soundscape.configure({ master: 0.8, music: 0.6 });
  const player = createSoundtrackPlayer({
    soundscape,
    audioMaster: master,
    audioElement: h.media,
    readAsset,
    URLImpl: h.URLImpl,
    fadeMs: 0,
  });
  const library = structuredClone(original.library);
  library.playlists[0].trackIds = [
    original.track.id,
    ...library.playlists[0].trackIds.filter((id) => id !== original.track.id),
  ];
  library.selection.playlistId = library.playlists[0].id;
  player.setLibrary(library);
  t.after(async () => {
    player.dispose();
    await soundscape.dispose();
  });
  return { ...h, master, soundscape, player, library };
}

test('MP3 master gain composes once with independent music leases without transport or library changes', async (t) => {
  const h = setup(t);
  await h.player.play();
  assert.equal(h.player.snapshot().track.kind, 'mp3');
  h.media.currentTime = 0.1;
  const before = h.player.snapshot(),
    saved = structuredClone(h.library);
  const url = h.media.src,
    plays = h.media.plays;
  near(h.media.volume, 0.8 * 0.6 * 0.5);
  const a = h.player.acquireGain({ factor: 0.2 });
  const b = h.player.acquireGain({ factor: 0.4 });
  h.master.setMuted(true);
  a.release();
  h.master.setVolume(0.25);
  near(h.media.volume, 0.8 * 0.6 * 0.4 * 0.25);
  assert.equal(h.media.muted, true);
  b.release();
  h.master.setMuted(false);
  near(h.media.volume, 0.8 * 0.6 * 0.25);
  assert.deepEqual(h.player.snapshot(), before);
  assert.deepEqual(h.library, saved);
  assert.equal(h.media.src, url);
  assert.equal(h.media.plays, plays);
  assert.equal(h.media.currentTime, 0.1);
  assert.equal(h.soundscape.getSettings().master, 0.8);
});

test('master changes during original acquisition govern eventual playback without overriding desired', async (t) => {
  const reading = deferred(),
    bytes = deferred();
  const h = setup(t, {
    readAsset: () => {
      reading.resolve();
      return bytes.promise;
    },
  });
  const playing = h.player.play();
  await reading.promise;
  h.master.setMuted(true);
  h.master.setVolume(0.2);
  bytes.resolve(original.blob);
  assert.equal(await playing, true);
  assert.equal(h.media.muted, true);
  near(h.media.volume, 0.8 * 0.6 * 0.2);
  assert.equal(h.player.snapshot().desired, true);
  assert.equal(h.soundscape.master.gain.value, 0);
});

test('deferred native Play after mute stays silent and cannot restart explicitly paused music', async (t) => {
  const h = setup(t);
  await h.player.prepare();
  const opened = deferred();
  h.media.play = async () => {
    h.media.plays++;
    await opened.promise;
    h.media.paused = false;
  };
  const playing = h.player.play();
  h.master.setMuted(true);
  opened.resolve();
  await playing;
  assert.equal(h.media.muted, true);
  h.player.pause();
  const before = h.player.snapshot(),
    plays = h.media.plays;
  h.master.setVolume(0.8);
  h.master.setMuted(false);
  assert.deepEqual(h.player.snapshot(), before);
  assert.equal(h.media.plays, plays);
  assert.equal(h.media.paused, true);
});

test('master unmute and lease cleanup cannot clear lifecycle suspension or disposed media ownership', async (t) => {
  const h = setup(t);
  await h.player.play();
  const lease = h.player.acquireGain({ factor: 0.4 });
  h.player.suspend();
  const before = h.player.snapshot(),
    plays = h.media.plays;
  h.master.setMuted(true);
  h.master.setMuted(false);
  lease.release();
  assert.deepEqual(h.player.snapshot(), before);
  assert.equal(h.media.paused, true);
  assert.equal(h.media.plays, plays);
  h.player.dispose();
  const dead = h.player.snapshot();
  h.master.setVolume(0.1);
  h.master.setMuted(false);
  assert.equal(h.media.muted, true);
  assert.deepEqual(h.player.snapshot(), dead);
  assert.equal(h.created.length, h.revoked.length);
});
