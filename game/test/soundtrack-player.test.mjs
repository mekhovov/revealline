import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import {
  BUILTIN_SOUNDTRACK_TRACKS,
  emptySoundtrackLibrary,
  upgradeSoundtrackLibrary,
  setCatalogueTracks,
  resolveSoundtrackCatalogue,
  SOUNDTRACK_CATALOGUE_FORMAT_V2,
} from '../soundtrack.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';

const original = await fixture(),
  synthIds = BUILTIN_SOUNDTRACK_TRACKS.map((t) => t.id);
function setup({
  library = original.library,
  readAsset = async () => original.blob,
  ...options
} = {}) {
  const h = audioHarness(),
    changes = [];
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset,
    onChange: (s) => changes.push(s),
    fadeMs: 0,
    ...options,
  });
  player.setLibrary(library);
  return { ...h, player, changes };
}
const list = (ids, repeat = 'all') => ({
  ...emptySoundtrackLibrary(),
  playlists: [
    { id: 'test.queue', title: 'Test playlist', trackIds: ids, order: 'ordered', repeat },
  ],
  selection: { playlistId: 'test.queue' },
});
async function finishSynth(h) {
  const duration = h.soundscape.musicPosition().durationSeconds;
  h.player.seek(duration);
  h.player.update(false, { family: 'fpv' });
  await settleUntil(() => h.player.snapshot().status !== 'loading');
}
test('transport settling refuses a predicate that never becomes ready', async () => {
  await assert.rejects(
    settleUntil(() => false, { timeoutMs: 20 }),
    {
      message: 'Transport did not settle within 20 ms.',
    },
  );
});
test('transport construction/settings/selection stay silent until explicit Play', async () => {
  const h = setup();
  assert.equal(h.soundscape.context, null);
  await h.player.selectPlaylist('qa.mix');
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(h.soundscape.context, null);
  assert.equal(h.media.plays, 0);
  await h.player.play();
  assert.equal(h.player.snapshot().playing, true);
  h.player.dispose();
});
test('preparing a local MP3 keeps playback silent, then a gesture wake starts it before context resume settles', async () => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
  });
  assert.equal(await h.player.prepare(), false);
  assert.equal(h.player.snapshot().track.id, original.track.id);
  assert.equal(h.media.plays, 0);
  assert.equal(h.soundscape.context, null);

  let finish;
  const enabled = new Promise((resolve) => {
    finish = () => resolve(true);
  });
  h.soundscape.enable = () => enabled;
  const waking = h.player.wake();
  const playing = h.player.play();
  assert.equal(h.media.plays, 1);
  assert.deepEqual(h.player.snapshot().preparation, {
    stage: 'playing',
    message: 'Starting music playback…',
  });
  finish();
  assert.equal(await waking, true);
  assert.equal(await playing, true);
  assert.equal(h.player.snapshot().preparation, null);
  h.player.dispose();
});
test('synth song boundary signals once at actual audio deadline and does not schedule the next song early', async () => {
  const h = audioHarness();
  await h.soundscape.enable();
  let ends = 0;
  h.soundscape.setSongEndHandler(() => ends++);
  h.soundscape.seekMusic(h.soundscape.musicPosition().durationSeconds);
  h.soundscape.cursor.time = 0.08;
  h.soundscape.update(false, { family: 'fpv' });
  assert.equal(ends, 0);
  assert.equal(h.soundscape.cursor.index, 512);
  h.context.currentTime = 0.08;
  h.soundscape.update(false, { family: 'fpv' });
  assert.equal(ends, 1);
  h.context.currentTime = 10;
  h.soundscape.update(false, { family: 'fpv' });
  assert.equal(ends, 1);
});
test('music-only pause freezes position while gameplay SFX remain available; full lifecycle suspends both', async () => {
  const h = setup({ library: list([synthIds[0], synthIds[1]]) });
  await h.player.play();
  h.player.update(true, { family: 'fpv' });
  h.player.seek(5);
  h.player.pause();
  const position = h.player.snapshot().positionSeconds;
  h.context.currentTime += 20;
  h.player.update(true, { family: 'fpv' });
  assert.equal(h.player.snapshot().positionSeconds, position);
  const before = h.sources.length;
  h.soundscape.event('cut.started');
  assert(h.sources.length > before);
  await h.player.play();
  assert.equal(h.player.snapshot().positionSeconds, position);
  h.player.suspend();
  assert.equal(h.context.state, 'suspended');
  const stopped = h.sources.length;
  h.soundscape.event('cut.started');
  assert.equal(h.sources.length, stopped);
  await h.player.resume();
  assert.equal(h.player.snapshot().playing, true);
  h.player.dispose();
});
test('ordered mixed queue advances synth→MP3→end without another element or album decode', async () => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], repeat: 'off' }],
      selection: { playlistId: 'qa.mix' },
    },
  });
  await h.player.play();
  await finishSynth(h);
  await settleUntil(() => h.player.snapshot().track?.kind === 'mp3' && h.player.snapshot().playing);
  assert.equal(h.created.length, 1);
  assert.equal(h.media.plays, 1);
  h.media.emit('ended');
  await settleUntil(() => h.player.snapshot().status === 'ended');
  assert.equal(h.player.snapshot().playing, false);
  h.player.dispose();
  assert.equal(h.revoked.length, 1);
});
test('repeat-one repeats only on natural end, while Next explicitly advances', async () => {
  const h = setup({ library: list([synthIds[0], synthIds[1]], 'one') });
  await h.player.play();
  await finishSynth(h);
  assert.equal(h.player.snapshot().track.id, synthIds[0]);
  await h.player.next();
  assert.equal(h.player.snapshot().track.id, synthIds[1]);
  await h.player.previous();
  assert.equal(h.player.snapshot().track.id, synthIds[0]);
  h.player.dispose();
});
test('authored game music is the automatic fallback and changes only at a song boundary', async () => {
  const h = setup({ library: emptySoundtrackLibrary() }),
    one = {
      id: 'map-one',
      name: 'Authored One',
      genre: 'synthwave',
      tempo: 100,
      root: 48,
      scale: 'minor',
    },
    two = { ...one, id: 'map-two', name: 'Authored Two', tempo: 120 };
  h.player.setAuthoredTrack(one);
  await h.player.play();
  assert.equal(h.player.snapshot().source, 'authored');
  assert.equal(h.soundscape.track.id, 'map-one');
  h.player.setAuthoredTrack(two);
  assert.equal(h.soundscape.track.id, 'map-one');
  await finishSynth(h);
  assert.equal(h.soundscape.track.id, 'map-two');
  await h.player.selectPlaylist('builtin.all');
  assert.equal(h.player.snapshot().source, 'explicit');
  assert.notEqual(h.soundscape.track.id, 'map-two');
  h.player.dispose();
});
test('scope assignments beat authored fallback and context updates wait for current song', async () => {
  const library = list([synthIds[0]]);
  library.playlists.push({
    id: 'other',
    title: 'Other',
    trackIds: [synthIds[1]],
    order: 'ordered',
    repeat: 'all',
  });
  library.selection.playlistId = null;
  library.assignments = [{ scope: 'theme', key: 'retro', playlistId: 'other' }];
  const h = setup({ library });
  h.player.setAuthoredTrack({
    id: 'author',
    name: 'Authored',
    genre: 'ambient',
    tempo: 90,
    root: 48,
    scale: 'minor',
  });
  await h.player.play();
  h.player.setContext({ themeId: 'retro' });
  assert.equal(h.soundscape.track.id, 'author');
  await finishSynth(h);
  assert.equal(h.player.snapshot().track.id, synthIds[1]);
  h.player.dispose();
});
test('library metadata edits preserve current owned MP3 and object URL until natural boundary', async () => {
  const library = {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id, synthIds[1]] }],
      selection: { playlistId: 'qa.mix' },
    },
    h = setup({ library });
  await h.player.play();
  h.media.currentTime = 0.1;
  const oldURL = h.media.src;
  const next = structuredClone(library);
  next.tracks[0].title = 'Edited title';
  next.playlists[0].trackIds = [synthIds[2]];
  h.player.setLibrary(next);
  assert.equal(h.player.snapshot().track.title, original.track.title);
  assert.equal(h.media.src, oldURL);
  assert.equal(h.player.snapshot().positionSeconds, 0.1);
  h.media.emit('ended');
  await settleUntil(() => h.player.snapshot().track.id === synthIds[2]);
  assert.deepEqual(h.revoked, [oldURL]);
  h.player.dispose();
});
test('paused MP3 resumes the same URL/position and its ended handler remains active', async () => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id, synthIds[1]] }],
      selection: { playlistId: 'qa.mix' },
    },
  });
  await h.player.play();
  h.media.currentTime = 0.12;
  h.player.pause();
  const url = h.media.src;
  await h.player.play();
  assert.equal(h.media.src, url);
  assert.equal(h.media.currentTime, 0.12);
  h.media.emit('ended');
  await settleUntil(() => h.player.snapshot().track.id === synthIds[1]);
  h.player.dispose();
});
test('one broken original is skipped once and a finite builtin fallback remains observable', async () => {
  let reads = 0;
  const h = setup({
    library: {
      ...original.library,
      playlists: [
        { ...original.library.playlists[0], trackIds: [original.track.id, original.track.id] },
      ],
      selection: { playlistId: 'qa.mix' },
    },
    readAsset: async () => {
      reads++;
      throw Error('Missing original');
    },
  });
  await h.player.play();
  assert.equal(reads, 1);
  assert.equal(h.player.snapshot().track.id, synthIds[0]);
  assert.equal(h.player.snapshot().notice, 'Missing original');
  h.player.dispose();
});
test('autoplay denial is observable, preserves current track, and requires another explicit Play', async () => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
  });
  h.media.rejectPlay = new DOMException('Denied', 'NotAllowedError');
  assert.equal(await h.player.play(), false);
  assert.equal(h.player.snapshot().status, 'blocked');
  assert.equal(h.player.snapshot().track.id, original.track.id);
  h.media.rejectPlay = null;
  assert.equal(await h.player.play(), true);
  assert.equal(h.created.length, 1);
  h.player.dispose();
});
test('a stale pending asset load cannot publish audio after explicit selection or disposal', async () => {
  let release;
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
    readAsset: () => new Promise((r) => (release = r)),
  });
  const old = h.player.play();
  await settleUntil(() => !!release);
  await h.player.selectPlaylist('builtin.all');
  release(original.blob);
  await old;
  assert.equal(h.player.snapshot().track.id, synthIds[0]);
  assert.equal(h.created.length, 0);
  h.player.dispose();
  assert.equal(h.player.snapshot().status, 'disposed');
});
test('volume owns the music fader only, combines with master for MP3, and preserves SFX volume', async () => {
  const h = setup();
  h.soundscape.configure({ master: 0.5, sfx: 0.7 });
  h.player.setVolume(0.4);
  assert.equal(h.media.volume, 0.2);
  assert.equal(h.soundscape.getSettings().music, 0.4);
  assert.equal(h.soundscape.getSettings().sfx, 0.7);
  assert.throws(() => h.player.setVolume(2));
  h.player.dispose();
});
test('seeking a paused synth before creating audio is retained for its first permitted playback', async () => {
  const h = setup({ library: list([synthIds[0]]) });
  await h.player.selectPlaylist('test.queue');
  h.player.seek(10.05);
  assert.equal(h.soundscape.context, null);
  assert.equal(h.player.snapshot().positionSeconds, 10.05);
  await h.player.play();
  assert.equal(h.player.snapshot().positionSeconds, 10.05);
  h.player.dispose();
});

test('a complete synth rendition advances through real scheduler steps on a controlled audio clock', async () => {
  const h = setup({ library: list([synthIds[0], synthIds[1]]) });
  await h.player.play();
  const duration = h.soundscape.musicPosition().durationSeconds;
  for (let frame = 0; frame <= Math.ceil((duration + 0.2) * 30); frame++) {
    h.context.currentTime = frame / 30;
    h.player.update(false, { family: 'fpv' });
  }
  await settleUntil(
    () => h.player.snapshot().track.id === synthIds[1] && h.player.snapshot().playing,
  );
  assert(h.sources.length > 100);
  h.player.dispose();
});
test('repeat-all wraps and shuffled sessions preserve the exact authored entry multiset', async () => {
  const library = list([synthIds[0], synthIds[1], synthIds[2]]);
  library.playlists[0].order = 'shuffle';
  const h = setup({ library, random: () => 0.25 });
  await h.player.play();
  const queue = [...h.player.snapshot().queue];
  assert.deepEqual([...queue].sort(), [...library.playlists[0].trackIds].sort());
  await h.player.next();
  await h.player.next();
  await h.player.next();
  assert.equal(h.player.snapshot().track.id, queue[0]);
  h.player.dispose();
});
test('explicit switch fades only music and a pause during its fade cannot publish late playback', async () => {
  const library = list([synthIds[0]]);
  library.playlists.push({
    id: 'other',
    title: 'Other',
    trackIds: [synthIds[1]],
    order: 'ordered',
    repeat: 'all',
  });
  const h = setup({ library, fadeMs: 8 });
  await h.player.play();
  const pending = h.player.selectPlaylist('other');
  assert(h.soundscape.getSettings().music < 0.55);
  h.player.pause();
  assert.equal(await pending, false);
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(h.soundscape.getSettings().sfx, 0.7);
  await h.player.play();
  assert.equal(h.player.snapshot().track.id, synthIds[1]);
  assert.equal(h.soundscape.getSettings().music, 0.55);
  h.player.dispose();
});
test('lifecycle suspension of MP3 preserves listening intent and resumes the SFX context too', async () => {
  const library = {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
    h = setup({ library });
  await h.player.play();
  const url = h.media.src;
  h.media.currentTime = 0.15;
  h.player.suspend();
  assert.equal(h.context.state, 'suspended');
  assert.equal(h.player.snapshot().status, 'suspended');
  await h.player.resume();
  assert.equal(h.context.state, 'running');
  assert.equal(h.media.src, url);
  assert.equal(h.media.currentTime, 0.15);
  assert.equal(h.player.snapshot().playing, true);
  h.player.dispose();
});
test('unsupported or corrupt originals never reach an object URL and fallback attempts stay finite', async () => {
  const library = {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
    h = setup({ library, readAsset: async () => new Blob(['not audio']) });
  await h.player.play();
  assert.equal(h.created.length, 0);
  assert.equal(h.player.snapshot().track.kind, 'synth');
  h.player.dispose();
});
test('a changed stored selection is adopted on the next boundary while unrelated metadata edits preserve a session choice', async () => {
  const library = list([synthIds[0]]);
  library.playlists.push({
    id: 'other',
    title: 'Other',
    trackIds: [synthIds[1]],
    order: 'ordered',
    repeat: 'all',
  });
  const h = setup({ library });
  await h.player.play();
  const imported = structuredClone(library);
  imported.selection.playlistId = 'other';
  h.player.setLibrary(imported);
  assert.equal(h.player.snapshot().track.id, synthIds[0]);
  await finishSynth(h);
  assert.equal(h.player.snapshot().track.id, synthIds[1]);
  await h.player.selectPlaylist('test.queue');
  imported.playlists[0].title = 'New title';
  h.player.setLibrary(imported);
  assert.equal(h.player.snapshot().selection, 'test.queue');
  h.player.dispose();
});

test('disposal aborts a pending storage load and its late original cannot allocate a URL', async () => {
  let release, signal;
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
    readAsset: (_hash, options) => {
      signal = options.signal;
      return new Promise((r) => (release = r));
    },
  });
  const pending = h.player.play();
  await settleUntil(() => !!release);
  h.player.dispose();
  assert.equal(signal.aborted, true);
  release(original.blob);
  assert.equal(await pending, false);
  assert.equal(h.created.length, 0);
  assert.equal(h.player.snapshot().status, 'disposed');
});
test('a delayed media play promise cannot restore playing status after transport pause', async (t) => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
    readAsset: async () => {
      await delay(25);
      return original.blob;
    },
  });
  t.after(() => h.player.dispose());
  let release;
  h.media.play = () => {
    h.media.paused = false;
    return new Promise((r) => (release = r));
  };
  const pending = h.player.play();
  await settleUntil(() => !!release);
  assert.ok(h.player.snapshot().preparation);
  h.player.pause();
  assert.equal(h.player.snapshot().preparation, null);
  release();
  assert.equal(await pending, false);
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(h.player.snapshot().desired, false);
  assert.equal(h.media.paused, true);
  h.player.dispose();
});

test('returning explicitly to automatic selection restores the authored map recipe immediately', async () => {
  const h = setup({ library: emptySoundtrackLibrary() }),
    recipe = {
      id: 'authored-map',
      name: 'Authored map',
      genre: 'synthwave',
      tempo: 105,
      root: 48,
      scale: 'minor',
    };
  h.player.setAuthoredTrack(recipe);
  await h.player.play();
  await h.player.selectPlaylist('builtin.genre.ambient');
  assert.notEqual(h.soundscape.track.id, recipe.id);
  await h.player.selectPlaylist(null);
  assert.equal(h.soundscape.track.id, recipe.id);
  assert.equal(h.player.snapshot().source, 'authored');
  h.player.dispose();
});
test('a delayed synth enable denial cannot overwrite pause, suspend or dispose state', async () => {
  for (const action of ['pause', 'suspend', 'dispose']) {
    const h = setup({ library: list([synthIds[0]]) });
    await h.player.selectPlaylist('test.queue');
    let release;
    h.context.resume = () => new Promise((resolve) => (release = resolve));
    const pending = h.player.play();
    await settleUntil(() => !!release);
    h.player[action]();
    const expected = h.player.snapshot().status,
      count = h.changes.length;
    release();
    assert.equal(await pending, false);
    assert.equal(h.player.snapshot().status, expected);
    assert.equal(h.changes.length, count);
    h.player.dispose();
  }
});

test('restoring inactive listening intent after an audition never starts audio until host resume', async () => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
  });
  await h.player.play();
  assert.throws(() => h.player.setIntent(false), /inactive/);
  h.player.pause();
  h.player.suspend();
  const plays = h.media.plays;
  h.player.setIntent(true);
  assert.equal(h.player.snapshot().desired, true);
  assert.equal(h.player.snapshot().status, 'suspended');
  assert.equal(h.media.plays, plays);
  assert.equal(h.context.state, 'suspended');
  await h.player.resume();
  assert.equal(h.player.snapshot().playing, true);
  h.player.dispose();
});

test('silent audio preparation reports a delayed read and stale completion cannot reclaim its status', async (t) => {
  let finish;
  const waiting = new Promise((resolve) => {
    finish = resolve;
  });
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
    readAsset: () => waiting,
  });
  t.after(() => h.player.dispose());
  const preparing = h.player.prepare();
  assert.deepEqual(h.player.snapshot().preparation, {
    stage: 'reading',
    message: 'Reading the selected audio original…',
  });
  assert.equal(h.media.plays, 0);
  h.player.pause();
  assert.equal(h.player.snapshot().preparation, null);
  finish(original.blob);
  assert.equal(await preparing, false);
  assert.equal(h.player.snapshot().preparation, null);
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(h.media.plays, 0);
});

test('earlier cached play settlement cannot clear a newer play preparation observer', async (t) => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
  });
  t.after(() => h.player.dispose());
  await h.player.prepare();
  const pending = [];
  h.media.play = () => new Promise((resolve) => pending.push(resolve));
  const first = h.player.play(),
    second = h.player.play();
  assert.equal(pending.length, 2);
  assert.equal(h.player.snapshot().preparation.stage, 'playing');
  pending[0]();
  await first;
  assert.equal(h.player.snapshot().preparation.stage, 'playing');
  pending[1]();
  await second;
  assert.equal(h.player.snapshot().preparation, null);
});

function pairSetup({ fadeMs = 80, readAsset, library, ...options } = {}) {
  const second = audioHarness().media;
  const entries = ['first', 'second', 'third'].map((name) => ({
    ...original.track,
    id: `qa.${name}`,
    title: name,
  }));
  const pairLibrary = {
    ...list(entries.map((track) => track.id)),
    tracks: entries,
  };
  const h = setup({
    library: library ?? pairLibrary,
    readAsset,
    secondAudioElement: second,
    fadeMs,
    ...options,
  });
  return { ...h, second, entries, pairLibrary };
}

test('two streaming decks preload only the next track and genuinely overlap the audible boundary', async (t) => {
  let reads = 0;
  const h = pairSetup({
    readAsset: async () => {
      reads++;
      return original.blob;
    },
  });
  t.after(() => h.player.dispose());
  await h.player.play();
  await settleUntil(() => h.player.snapshot().preloadedTrackId === 'qa.second');
  assert.equal(reads, 2);
  assert.equal(h.second.plays, 0, 'preloading never starts an inaudible media clock');
  assert.equal(h.created.length - h.revoked.length, 2);
  h.media.currentTime = original.track.asset.durationSeconds - 0.06;
  h.media.emit('timeupdate');
  await settleUntil(() => h.player.snapshot().transitioning);
  assert.equal(h.player.snapshot().track.id, 'qa.second');
  assert.equal(h.media.paused, false);
  assert.equal(h.second.paused, false);
  assert.ok(h.media.volume > 0 && h.second.volume > 0);
  const base = h.soundscape.getSettings().master * h.player.snapshot().volume;
  assert.ok(Math.abs(h.media.volume + h.second.volume - base) < 0.00001);
  const lease = h.player.acquireGain({ factor: 0.2 });
  assert.ok(Math.abs(h.media.volume + h.second.volume - base * 0.2) < 0.00001);
  lease.release();
  await settleUntil(() => !h.player.snapshot().transitioning);
  await settleUntil(() => h.player.snapshot().preloadedTrackId === 'qa.third');
  assert.equal(reads, 3);
  assert.equal(
    h.created.length - h.revoked.length,
    2,
    'released deck is reused for the next original',
  );
  assert.equal(h.media.paused, true);
  assert.equal(h.second.paused, false);
});

test('pause during a crossfade cancels the outgoing deck and preserves the incoming position', async (t) => {
  const h = pairSetup();
  t.after(() => h.player.dispose());
  await h.player.play();
  await settleUntil(() => h.player.snapshot().preloadedTrackId === 'qa.second');
  const advancing = h.player.next();
  await settleUntil(() => h.player.snapshot().transitioning);
  h.second.currentTime = 0.1;
  h.player.pause();
  assert.equal(await advancing, false);
  assert.equal(h.media.paused, true);
  assert.equal(h.second.paused, true);
  assert.equal(h.player.snapshot().positionSeconds, 0.1);
  assert.equal(h.player.snapshot().desired, false);
  assert.equal(h.player.snapshot().transitioning, false);
  assert.equal(h.created.length - h.revoked.length, 1);
  const activeURL = h.second.src;
  await h.player.play();
  assert.equal(h.second.src, activeURL);
  assert.equal(h.player.snapshot().positionSeconds, 0.1);
});

for (const action of ['seek', 'library', 'context', 'suspend', 'dispose']) {
  test(`${action} cancels next-track acquisition and late bytes cannot allocate a deck`, async (t) => {
    let reads = 0,
      release,
      signal;
    const h = pairSetup({
      readAsset: async (_, options) => {
        reads++;
        if (reads === 1) return original.blob;
        signal = options.signal;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    });
    t.after(() => h.player.dispose());
    await h.player.play();
    await settleUntil(() => !!release);
    if (action === 'seek') h.player.seek(0.1);
    else if (action === 'library') h.player.setLibrary(h.pairLibrary);
    else if (action === 'context') h.player.setContext({ scene: 'menu' });
    else h.player[action]();
    assert.equal(signal.aborted, true);
    release(original.blob);
    await delay(10);
    assert.equal(h.created.length, 1);
    assert.equal(h.second.plays, 0);
    assert.equal(h.player.snapshot().preloadedTrackId, null);
  });
}

test('a browser denying the second element reuses the permitted first deck for the entire queue', async (t) => {
  const h = pairSetup({ fadeMs: 20 });
  t.after(() => h.player.dispose());
  await h.player.play();
  await settleUntil(() => h.player.snapshot().preloadedTrackId === 'qa.second');
  const preparedURL = h.second.src;
  h.second.rejectPlay = new DOMException('This element needs a fresh gesture.', 'NotAllowedError');
  assert.equal(await h.player.next(), true);
  assert.equal(h.second.plays, 1);
  assert.equal(h.media.plays, 2);
  assert.equal(h.media.src, preparedURL, 'reuse the validated original without another download');
  assert.equal(h.player.snapshot().track.id, 'qa.second');
  assert.equal(h.player.snapshot().transitioning, false);
  assert.equal(h.media.paused, false);
  assert.equal(h.second.paused, true);
  assert.equal(
    h.revoked.includes(preparedURL),
    false,
    'transferred ownership retains the original URL',
  );
  await settleUntil(() => h.player.snapshot().preloadedTrackId === 'qa.third');
  h.media.emit('ended');
  await settleUntil(
    () => h.player.snapshot().track.id === 'qa.third' && h.player.snapshot().playing,
  );
  assert.equal(h.media.plays, 3);
  assert.equal(h.second.plays, 1, 'later tracks also use the already permitted element');
  assert.equal(h.revoked.filter((url) => url === preparedURL).length, 1);
});

test('scene selection switches menu/gameplay music without changing paused listening intent', async (t) => {
  const entries = ['menu', 'gameplay'].map((role) => ({
    ...original.track,
    id: `qa.${role}`,
    title: role,
  }));
  const library = {
    ...upgradeSoundtrackLibrary(emptySoundtrackLibrary()),
    tracks: entries,
    tags: Object.fromEntries(
      entries.map((track) => [
        track.id,
        {
          genres: ['synth90s'],
          role: track.title,
          energy: 2,
          themes: [],
        },
      ]),
    ),
  };
  const h = setup({ library });
  t.after(() => h.player.dispose());
  h.player.setContext({ scene: 'menu' });
  await h.player.play();
  assert.equal(h.player.snapshot().track.id, 'qa.menu');
  h.player.pause();
  h.player.setContext({ scene: 'gameplay' });
  await settleUntil(() => h.player.snapshot().track.id === 'qa.gameplay');
  assert.equal(h.player.snapshot().status, 'paused');
  assert.equal(h.player.snapshot().desired, false);
  assert.equal(h.media.plays, 1);
});

test('empty Ukrainian/fusion selections stay silent with an explanation instead of unrelated fallback', async (t) => {
  const h = setup({ library: upgradeSoundtrackLibrary(emptySoundtrackLibrary()) });
  t.after(() => h.player.dispose());
  h.player.setAuthoredTrack(BUILTIN_SOUNDTRACK_TRACKS[0].recipe);
  for (const mode of ['ukrainian', 'fusion']) {
    await h.player.selectListening({
      mode,
      genres: ['synth90s', 'metal', 'ukrainian'],
      installedOnly: false,
      recordingMode: false,
    });
    assert.equal(await h.player.play(), false);
    assert.equal(h.player.snapshot().track, null);
    assert.equal(h.player.snapshot().status, 'idle');
    assert.ok(h.player.snapshot().notice.includes('No '));
  }
  assert.equal(h.media.plays, 0);
});

test('an offline Ukrainian queue tries each original once and stops without mislabelled fallback', async (t) => {
  let reads = 0;
  const track = { ...original.track, id: 'qa.ukrainian' };
  const library = {
    ...upgradeSoundtrackLibrary(emptySoundtrackLibrary()),
    tracks: [track],
    tags: { [track.id]: { genres: ['ukrainian'], role: 'any', energy: 3, themes: [] } },
    listening: {
      mode: 'ukrainian',
      genres: ['ukrainian'],
      installedOnly: false,
      recordingMode: false,
    },
  };
  const h = setup({
    library,
    readAsset: async () => {
      reads++;
      throw new Error('Offline');
    },
  });
  t.after(() => h.player.dispose());
  assert.equal(await h.player.play(), false);
  assert.equal(reads, 1);
  assert.equal(h.player.snapshot().status, 'error');
  assert.equal(h.player.snapshot().desired, false);
  assert.equal(h.created.length, 0);
  assert.ok(h.player.snapshot().notice);
});

test('failed restricted mixes and explicit v2 playlists preserve the selected music families', async (t) => {
  const base = upgradeSoundtrackLibrary(original.library);
  const tagged = {
    ...base,
    tags: { [original.track.id]: { genres: ['ukrainian'], role: 'any', energy: 3, themes: [] } },
  };
  const libraries = [
    {
      ...tagged,
      selection: { playlistId: null },
      listening: { mode: 'mix', genres: ['ukrainian'], installedOnly: false, recordingMode: false },
    },
    {
      ...tagged,
      playlists: [{ ...base.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: base.playlists[0].id },
    },
  ];
  for (const library of libraries) {
    let reads = 0;
    const h = setup({
      library,
      readAsset: async () => {
        reads++;
        throw new Error('Offline');
      },
    });
    t.after(() => h.player.dispose());
    assert.equal(await h.player.play(), false);
    assert.equal(reads, 1);
    assert.equal(h.player.snapshot().status, 'error');
    assert.equal(h.player.snapshot().desired, false);
    assert.equal(h.media.plays, 0);
    assert(!h.changes.some((state) => state.track?.kind === 'synth'));
  }
});

test('an explicit catalogue playlist with no installed recordings stays empty offline', async (t) => {
  const track = {
    ...original.track,
    id: 'builtin.catalog.offline',
    edition: 'test-1',
    path: 'game/content/music/offline.mp3',
    tags: { genres: ['ukrainian'], role: 'any', energy: 3, themes: [] },
  };
  const base = setCatalogueTracks(emptySoundtrackLibrary(), [track]);
  let reads = 0;
  const h = setup({
    library: {
      ...base,
      playlists: [
        {
          id: 'offline.only',
          title: 'My album',
          trackIds: [track.id],
          order: 'ordered',
          repeat: 'all',
        },
      ],
      selection: { playlistId: 'offline.only' },
      listening: { ...base.listening, installedOnly: true },
    },
    readAsset: async () => {
      reads++;
      return original.blob;
    },
  });
  t.after(() => h.player.dispose());
  assert.equal(await h.player.play(), false);
  assert.equal(reads, 0);
  assert.equal(h.player.snapshot().track, null);
  assert.equal(h.player.snapshot().playlistId, 'offline.only');
  assert.match(h.player.snapshot().notice, /Download/);
});

test('offloaded bonus tracks are skipped without fetching and an empty explicit album asks for Download again', async (t) => {
  const base = upgradeSoundtrackLibrary(original.library);
  let reads = 0;
  const h = setup({
    library: {
      ...base,
      bonusAlbums: [{ id: 'qa.bonus', trackIds: [original.track.id], downloaded: false }],
      selection: { playlistId: 'qa.mix' },
    },
    readAsset: async () => {
      reads++;
      throw new Error('Offloaded bonus recordings must not be fetched by playback');
    },
  });
  t.after(() => h.player.dispose());
  await h.player.play();
  await finishSynth(h);
  assert.equal(h.player.snapshot().track.kind, 'synth');
  assert.equal(reads, 0);
  h.player.setLibrary({
    ...base,
    playlists: [{ ...base.playlists[0], trackIds: [original.track.id] }],
    selection: { playlistId: 'qa.mix' },
    bonusAlbums: [{ id: 'qa.bonus', trackIds: [original.track.id], downloaded: false }],
  });
  await h.player.next();
  const state = h.player.snapshot();
  assert.equal(state.playing, false);
  assert.equal(state.playlistId, 'qa.mix');
  assert.match(state.notice, /Download again/);
  assert.equal(reads, 0);
});

test('catalogue metadata drives playback and same-ID theme selection changes the next rendition', async (t) => {
  const catalogTracks = ['circuit', 'river'].map((theme) => ({
    ...original.track,
    id: `builtin.catalog.${theme}`,
    edition: 'test-1',
    path: `game/content/music/${theme}.mp3`,
    tags: { genres: ['synth90s'], role: 'gameplay', energy: 3, themes: [theme] },
  }));
  const h = setup({ library: setCatalogueTracks(emptySoundtrackLibrary(), catalogTracks) });
  t.after(() => h.player.dispose());
  h.player.setContext({ scene: 'gameplay', themeId: 'circuit' });
  await h.player.play();
  const playlistId = h.player.snapshot().playlistId;
  const url = h.media.src;
  h.player.setContext({ scene: 'gameplay', themeId: 'river' });
  assert.equal(h.player.snapshot().track.id, 'builtin.catalog.circuit');
  assert.equal(h.player.snapshot().pendingPlaylistId, playlistId);
  assert.equal(h.media.src, url, 'theme matching waits for the audible boundary');
  h.media.emit('ended');
  await settleUntil(
    () => h.player.snapshot().track.id === 'builtin.catalog.river' && h.player.snapshot().playing,
  );
  assert.equal(h.player.snapshot().playlistId, playlistId);
  assert.notEqual(h.media.src, url);
});

test('short clips preserve their opening before entering the default crossfade window', async (t) => {
  const h = pairSetup({ fadeMs: 1500 });
  t.after(() => h.player.dispose());
  await h.player.play();
  await settleUntil(() => h.player.snapshot().preloadedTrackId === 'qa.second');
  assert.equal(h.player.snapshot().track.id, 'qa.first');
  assert.equal(h.player.snapshot().transitioning, false);
  assert.equal(h.second.plays, 0);
});

test('choosing an available genre clears the previous unavailable selection notice', async (t) => {
  const track = { ...original.track, id: 'qa.available-metal' };
  const base = upgradeSoundtrackLibrary(emptySoundtrackLibrary());
  const h = setup({
    library: {
      ...base,
      tracks: [track],
      tags: { [track.id]: { genres: ['metal'], role: 'any', energy: 4, themes: [] } },
      listening: { ...base.listening, mode: 'ukrainian' },
    },
  });
  t.after(() => h.player.dispose());
  assert.equal(await h.player.play(), false);
  assert.match(h.player.snapshot().notice, /No ukrainian/i);
  await h.player.selectListening({ ...base.listening, mode: 'metal' });
  assert.equal(h.player.snapshot().notice, null);
  assert.equal(await h.player.play(), true);
  assert.equal(h.player.snapshot().track.id, track.id);
  assert.equal(h.player.snapshot().notice, null);
  assert.equal(h.player.snapshot().error, null);
});

function permissionCatalogue(recordings) {
  return {
    format: SOUNDTRACK_CATALOGUE_FORMAT_V2,
    edition: 'selection-test',
    tracks: recordings.map((recording, index) => {
      const id = `builtin.catalog.selection-${index}`;
      return {
        ...recording.track,
        id,
        edition: 'selection-test',
        path: `game/content/music/selection-${index}.mp3`,
        tags: { genres: ['metal'], role: 'any', energy: 3, themes: [`theme-${index}`] },
        policy: {
          id,
          sha256: recording.track.asset.sha256,
          webPlayback: 'allowed',
          offlineCache: 'allowed',
          redistribute: 'allowed',
          modify: 'allowed',
          gameplayVideo: index === 0 ? 'allowed' : 'unknown',
          contentId: index === 0 ? 'not-registered' : 'unknown',
        },
      };
    }),
  };
}

test('invalid catalogue construction leaves media and master ownership available for a valid retry', (t) => {
  const h = audioHarness();
  let subscriptions = 0;
  const audioMaster = {
    snapshot: () => ({ muted: false, volume: 1 }),
    subscribe: () => {
      subscriptions++;
      return () => subscriptions--;
    },
  };
  const options = {
    soundscape: h.soundscape,
    audioElement: h.media,
    secondAudioElement: null,
    readAsset: async () => original.blob,
    audioMaster,
    URLImpl: h.URLImpl,
  };
  assert.throws(() => createSoundtrackPlayer({ ...options, catalogue: { invalid: true } }));
  assert.equal(subscriptions, 0);
  assert.equal(h.media.volume, 1);
  const player = createSoundtrackPlayer(options);
  t.after(() => player.dispose());
  assert.equal(subscriptions, 2);
  player.dispose();
  assert.equal(subscriptions, 0);
});

test('selection reuse follows owned library, context and override changes and rejects invalid setters atomically', async (t) => {
  const other = await fixture('selection-other');
  const catalogue = resolveSoundtrackCatalogue(permissionCatalogue([original, other]));
  const [first, second] = catalogue.tracks;
  const base = setCatalogueTracks(emptySoundtrackLibrary(), catalogue.tracks);
  const library = {
    ...base,
    playlists: [
      { id: 'test.first', title: 'First', trackIds: [first.id], order: 'ordered', repeat: 'all' },
    ],
  };
  const h = setup({
    library,
    catalogue,
    readAsset: async (hash) => (hash === first.asset.sha256 ? original.blob : other.blob),
  });
  t.after(() => h.player.dispose());
  h.player.setContext({ scene: 'gameplay', themeId: 'theme-0' });
  await h.player.prepare();
  assert.deepEqual(h.player.snapshot().queue, [first.id]);
  const prior = h.player.snapshot();
  assert.throws(() => h.player.setContext({ scene: 'invalid' }), /scene/);
  assert.throws(
    () => h.player.setLibrary({ ...library, selection: { playlistId: 'missing' } }),
    /Selected playlist/,
  );
  await assert.rejects(h.player.selectPlaylist('missing'), /Selected playlist/);
  assert.deepEqual(h.player.snapshot(), prior);

  h.player.setContext({ scene: 'gameplay', themeId: 'theme-1' });
  assert.equal(h.player.snapshot().pendingPlaylistId, prior.playlistId);
  await h.player.next();
  assert.deepEqual(h.player.snapshot().queue, [second.id]);
  await h.player.selectPlaylist('test.first');
  assert.deepEqual(h.player.snapshot().queue, [first.id]);
  await h.player.selectPlaylist(null);
  assert.deepEqual(h.player.snapshot().queue, [second.id]);

  h.player.setLibrary({ ...library, catalogTracks: [first], selection: { playlistId: null } });
  await h.player.next();
  assert.deepEqual(h.player.snapshot().queue, [first.id]);
  assert.equal(h.player.snapshot().desired, false);
});

test('selection reuse invalidates installed IDs and listening permissions while snapshots retain live position', async (t) => {
  const other = await fixture('selection-installed');
  const catalogue = resolveSoundtrackCatalogue(permissionCatalogue([original, other]));
  const [first, second] = catalogue.tracks;
  const base = setCatalogueTracks(emptySoundtrackLibrary(), catalogue.tracks);
  const h = setup({
    library: { ...base, listening: { ...base.listening, mode: 'metal', installedOnly: true } },
    catalogue,
    readAsset: async (hash) => (hash === first.asset.sha256 ? original.blob : other.blob),
  });
  t.after(() => h.player.dispose());
  h.player.setContext({ installedTrackIds: [first.id] });
  await h.player.prepare();
  assert.deepEqual(h.player.snapshot().queue, [first.id]);
  h.media.currentTime = first.asset.durationSeconds / 2;
  assert.equal(h.player.snapshot().positionSeconds, first.asset.durationSeconds / 2);
  h.media.currentTime = 0;
  assert.equal(h.player.snapshot().positionSeconds, 0);

  h.player.setContext({ installedTrackIds: [second.id] });
  await h.player.next();
  assert.deepEqual(h.player.snapshot().queue, [second.id]);
  await h.player.selectListening({ ...base.listening, mode: 'metal', recordingMode: true });
  assert.deepEqual(h.player.snapshot().queue, [first.id]);
  assert.match(h.player.snapshot().notice, /Recording mode/);
  await h.player.selectListening({ ...base.listening, mode: 'ukrainian' });
  assert.deepEqual(h.player.snapshot().queue, []);
  assert.equal(h.player.snapshot().track, null);
});

test('raw mutable catalogue policy revocation remains live for same-hash uploaded aliases', async (t) => {
  const catalogue = permissionCatalogue([original]);
  const base = upgradeSoundtrackLibrary(original.library);
  const h = setup({
    catalogue,
    library: {
      ...base,
      selection: { playlistId: null },
      tags: { [original.track.id]: { genres: ['ukrainian'], role: 'any', energy: 3, themes: [] } },
      listening: { ...base.listening, mode: 'ukrainian' },
    },
  });
  t.after(() => h.player.dispose());
  await h.player.prepare();
  assert.equal(h.player.snapshot().source, 'catalogue');
  assert.deepEqual(h.player.snapshot().queue, [original.track.id]);
  catalogue.tracks[0].policy.webPlayback = 'denied';
  assert.equal(h.player.snapshot().source, 'unavailable');
  await h.player.selectPlaylist(null);
  assert.equal(h.player.snapshot().track, null);
  assert.deepEqual(h.player.snapshot().queue, []);
  catalogue.tracks[0].policy.webPlayback = 'allowed';
  await h.player.selectPlaylist(null);
  assert.deepEqual(h.player.snapshot().queue, [original.track.id]);
  assert.equal(h.media.plays, 0);
});

test('base selection reuse never caches dynamic published permissions, authored replacement or failed adapters', async (t) => {
  let allowed = true,
    unavailable = false,
    reads = 0;
  const h = setup({ library: emptySoundtrackLibrary() });
  t.after(() => h.player.dispose());
  const published = {
    id: `published.${'f'.repeat(64)}`,
    title: 'Dynamic published recording',
    allowed: () => allowed,
    readBlob: async () => {
      reads++;
      if (unavailable) throw new Error('Published recording unavailable');
      return new Blob(['Modeled published audio'], { type: 'audio/wav' });
    },
  };
  h.player.setPublishedTrack(published);
  await h.player.prepare();
  assert.equal(h.player.snapshot().source, 'published');
  allowed = false;
  assert.equal(h.player.snapshot().source, 'default');
  h.player.setAuthoredTrack(BUILTIN_SOUNDTRACK_TRACKS[0].recipe);
  await h.player.prepare();
  assert.equal(h.player.snapshot().source, 'authored');
  h.player.setAuthoredTrack(null);
  await h.player.prepare();
  assert.equal(h.player.snapshot().source, 'default');
  allowed = true;
  unavailable = true;
  h.player.setPublishedTrack(published);
  assert.equal(h.player.snapshot().source, 'published');
  await h.player.selectPlaylist(null);
  assert.equal(reads, 2);
  assert.equal(h.player.snapshot().track.kind, 'synth');
  assert.equal(h.player.snapshot().source, 'default');
  assert.match(h.player.snapshot().notice, /Published recording unavailable/);
});
