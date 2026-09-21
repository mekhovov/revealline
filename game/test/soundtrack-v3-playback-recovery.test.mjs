import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import {
  BUILTIN_SOUNDTRACK_TRACKS,
  emptySoundtrackLibrary,
  upgradeSoundtrackLibrary,
} from '../soundtrack.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';

function createPlayer(t, readAsset) {
  const h = audioHarness();
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset,
    fadeMs: 0,
  });
  t.after(() => player.dispose());
  return { ...h, player };
}

test('v3 automatic published music failure falls back once to available synthesized music', async (t) => {
  let reads = 0;
  const h = createPlayer(t, async () => {
    throw new Error('No library download should be attempted.');
  });
  h.player.setLibrary(upgradeSoundtrackLibrary(emptySoundtrackLibrary()));
  h.player.setAuthoredTrack(BUILTIN_SOUNDTRACK_TRACKS[0].recipe);
  h.player.setPublishedTrack({
    id: `published.${'a'.repeat(64)}`,
    title: 'Unavailable published music',
    allowed: () => true,
    readBlob: async () => {
      reads++;
      throw new Error('Published asset unavailable.');
    },
  });
  assert.equal(h.player.snapshot().source, 'published');
  await h.player.play();
  const state = h.player.snapshot();
  assert.equal(reads, 1);
  assert.equal(state.status, 'playing');
  assert.equal(state.desired, true);
  assert.equal(state.track.kind, 'synth');
  assert.equal(state.track.id, 'builtin.authored');
  assert.match(state.notice, /Published asset unavailable/);
  assert.equal(h.created.length, 0);
});

test('explicit successful selection clears the previous failed recording notice', async (t) => {
  const song = await fixture('failure-notice');
  const h = createPlayer(t, async () => {
    throw new Error('Previous recording unavailable.');
  });
  h.player.setLibrary({
    ...song.library,
    playlists: [{ ...song.library.playlists[0], trackIds: [song.track.id] }],
    selection: { playlistId: 'qa.mix' },
  });
  await h.player.play();
  assert.match(h.player.snapshot().notice, /Previous recording unavailable/);
  await h.player.selectPlaylist('builtin.all');
  await h.player.play();
  const state = h.player.snapshot();
  assert.equal(state.status, 'playing');
  assert.equal(state.track.kind, 'synth');
  assert.equal(state.error, null);
  assert.equal(state.notice, null);
});
