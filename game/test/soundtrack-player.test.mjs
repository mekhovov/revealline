import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { BUILTIN_SOUNDTRACK_TRACKS, emptySoundtrackLibrary } from '../soundtrack.mjs';
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
test('a delayed media play promise cannot restore playing status after transport pause', async () => {
  const h = setup({
    library: {
      ...original.library,
      playlists: [{ ...original.library.playlists[0], trackIds: [original.track.id] }],
      selection: { playlistId: 'qa.mix' },
    },
  });
  let release;
  h.media.play = () => {
    h.media.paused = false;
    return new Promise((r) => (release = r));
  };
  const pending = h.player.play();
  await settleUntil(() => !!release);
  h.player.pause();
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
