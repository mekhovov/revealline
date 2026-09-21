import assert from 'node:assert/strict';
import test from 'node:test';
import { createCouchMusicSession } from '../couch/couch-music-session.mjs';
import { createCouchMusicLibrary } from '../couch/couch-music-library.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
const audio = await fixture();
const prepared = await prepareSoundtrackLibrary(
  {
    ...audio.library,
    playlists: [{ ...audio.library.playlists[0], trackIds: [audio.track.id] }],
    selection: { playlistId: 'qa.mix' },
  },
  audio.assets,
  { probeMedia: structuralProbe },
);
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
function setup({
  read = async () => ({ generation: 1, library: prepared.library, assets: prepared.assets }),
  initialMusicVolume,
} = {}) {
  const h = audioHarness(),
    master = createAudioMaster({ volume: 0.2, muted: true });
  let owner;
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset: (hash) => owner.readAsset(hash),
    audioMaster: master,
    fadeMs: 0,
  });
  owner = createCouchMusicLibrary({
    player,
    managedStore: {
      storyMedia: true,
      soundtrackCatalogue: true,
      readDomain: read,
      commitDomain: async (_, value, options) => ({
        generation: options.expectedGeneration + 1,
        library: value.library,
      }),
    },
  });
  const session = createCouchMusicSession({
    player,
    library: owner,
    soundscape: h.soundscape,
    initialMusicVolume,
  });
  return {
    ...h,
    owner,
    master,
    player,
    session,
    close() {
      session.dispose();
      player.dispose();
      owner.close();
      h.soundscape.dispose();
      master.dispose();
    },
  };
}

test('loading prepares accepted MP3 silently; a ready first Start plays in its gesture turn', async () => {
  const h = setup();
  try {
    await h.session.loadLibrary();
    assert.equal(h.media.plays, 0);
    assert.equal(h.session.snapshot().readyForStart, true);
    const starting = h.session.start();
    assert.equal(h.media.plays, 1);
    assert.equal(await starting, true);
    assert.equal(h.session.snapshot().playback.status, 'playing');
    assert.equal(h.media.muted, true);
  } finally {
    h.close();
  }
});

test('explicit Pause before first Start survives preparation, Retry and Resume', async () => {
  const h = setup();
  try {
    h.session.pause();
    await h.session.loadLibrary();
    assert.equal(await h.session.start(), false);
    h.session.resetGameplay();
    assert.equal(await h.session.start(), false);
    h.session.suspend();
    await h.session.resume();
    assert.equal(h.media.plays, 0);
    assert.equal(h.session.snapshot().transportChoice, 'pause');
    assert.equal(h.player.snapshot().desired, false);
  } finally {
    h.close();
  }
});

test('slow library readiness never blocks Start or performs a late autoplay', async () => {
  const read = deferred();
  const h = setup({ read: () => read.promise });
  try {
    const loading = h.session.loadLibrary();
    assert.equal(await h.session.start(), false);
    assert.equal(h.media.plays, 0);
    assert.equal(h.session.snapshot().needsPlayGesture, true);
    read.resolve({ generation: 1, library: prepared.library, assets: prepared.assets });
    await loading;
    assert.equal(h.media.plays, 0);
    assert.equal(h.session.snapshot().needsPlayGesture, true);
    await h.session.play();
    assert.equal(h.media.plays, 1);
    assert.equal(h.session.snapshot().needsPlayGesture, false);
  } finally {
    h.close();
  }
});

test('Pause during a pending load clears deferred Play intent', async () => {
  const read = deferred();
  const h = setup({ read: () => read.promise });
  try {
    const loading = h.session.loadLibrary();
    await h.session.play();
    h.session.pause();
    read.resolve({ generation: 1, library: prepared.library, assets: prepared.assets });
    await loading;
    assert.equal(h.session.snapshot().needsPlayGesture, false);
    assert.equal(await h.session.start(), false);
    assert.equal(h.media.plays, 0);
  } finally {
    h.close();
  }
});

test('gameplay Pause, Retry and accepted context change retain the MP3 node, position and listening choice', async () => {
  const h = setup();
  try {
    await h.session.loadLibrary();
    await h.session.start();
    h.media.currentTime = 0.1;
    const url = h.media.src,
      created = h.created.length,
      plays = h.media.plays;
    h.session.pauseGameplay();
    h.session.resetGameplay();
    h.session.setAcceptedContext({ themeId: 'fpv', campaignKey: 'accepted', mapKey: 'accepted-1' });
    await h.session.start();
    assert.equal(h.media.src, url);
    assert.equal(h.media.currentTime, 0.1);
    assert.equal(h.created.length, created);
    assert.equal(h.media.plays, plays);
    assert.equal(h.player.snapshot().desired, true);
  } finally {
    h.close();
  }
});

test('lifecycle return restores prior listening but cannot request gameplay Resume', async () => {
  const h = setup();
  try {
    await h.session.loadLibrary();
    await h.session.start();
    const url = h.media.src;
    h.media.currentTime = 0.1;
    h.session.suspend();
    assert.equal(h.media.paused, true);
    await h.session.resume();
    assert.equal(h.media.src, url);
    assert.equal(h.media.currentTime, 0.1);
    assert.equal(h.player.snapshot().desired, true);
    h.session.pause();
    h.session.suspend();
    const plays = h.media.plays;
    await h.session.resume();
    assert.equal(h.media.plays, plays);
  } finally {
    h.close();
  }
});

test('blocked browser Play is reported from its actual promise and keeps master muted', async () => {
  const h = setup();
  try {
    await h.session.loadLibrary();
    h.media.rejectPlay = new DOMException('Gesture required', 'NotAllowedError');
    assert.equal(await h.session.start(), false);
    assert.equal(h.player.snapshot().status, 'blocked');
    assert.equal(h.session.snapshot().needsPlayGesture, true);
    assert.equal(h.master.snapshot().muted, true);
    h.media.rejectPlay = null;
    assert.equal(await h.session.play(), true);
    assert.equal(h.media.muted, true);
  } finally {
    h.close();
  }
});

test('session music volume is independent of shared master and never uses profile storage', async () => {
  const h = setup();
  try {
    assert.equal(h.player.snapshot().volume, 0.55);
    const masterBefore = h.master.snapshot();
    h.session.setVolume(0.31);
    assert.equal(h.player.snapshot().volume, 0.31);
    assert.deepEqual(h.master.snapshot(), masterBefore);
    assert.throws(() => h.session.setVolume(2));
  } finally {
    h.close();
  }
  const next = setup();
  try {
    assert.equal(next.player.snapshot().volume, 0.55);
  } finally {
    next.close();
  }
});

test('storage denial leaves a visible error and permits a deliberate built-in music start', async () => {
  const h = setup({
    read: async () => {
      throw new Error('Storage unavailable');
    },
  });
  try {
    await assert.rejects(h.session.loadLibrary(), /Storage unavailable/);
    assert.equal(h.session.snapshot().library.status, 'error');
    assert.equal(await h.session.play(), true);
    assert.equal(h.player.snapshot().track.kind, 'synth');
    assert.equal(h.owner.snapshot().generation, null);
  } finally {
    h.close();
  }
});

test('inactive menu update still pumps the existing player; suspension/disposal gate the pump', () => {
  const calls = [];
  const soundscape = { pause() {}, reset() {} };
  const player = {
    setVolume() {},
    snapshot: () => ({ desired: false, status: 'paused' }),
    update: (...args) => calls.push(args),
    suspend() {},
    pause() {},
  };
  const library = { snapshot: () => ({ status: 'idle' }), load() {}, commit() {} };
  const session = createCouchMusicSession({ player, library, soundscape });
  session.update(false, { family: 'fpv' });
  assert.equal(calls.length, 1);
  session.suspend();
  session.update(false, { family: 'fpv' });
  assert.equal(calls.length, 1);
  session.dispose();
  session.update(true, { family: 'fpv' });
  assert.equal(calls.length, 1);
});

test('disposal fences a late library completion without closing borrowed owners', async () => {
  const read = deferred();
  const h = setup({ read: () => read.promise });
  try {
    const loading = h.session.loadLibrary();
    h.session.dispose();
    read.resolve({ generation: 1, library: prepared.library, assets: prepared.assets });
    await loading;
    assert.equal(h.session.snapshot().disposed, true);
    assert.equal(h.owner.snapshot().status, 'ready');
    assert.equal(h.media.plays, 0);
    assert.equal(await h.session.start(), false);
    assert.equal(await h.session.play(), false);
    assert.equal(h.player.snapshot().desired, false);
  } finally {
    h.close();
  }
});

test('library save updates accepted bytes without requesting playback', async () => {
  const h = setup();
  try {
    await h.session.loadLibrary();
    h.session.pause();
    const value = await prepareSoundtrackLibrary(emptySoundtrackLibrary(), [], {
      probeMedia: structuralProbe,
    });
    await h.session.saveLibrary(value);
    assert.equal(h.owner.snapshot().generation, 2);
    assert.equal(h.media.plays, 0);
    assert.equal(await h.session.start(), false);
  } finally {
    h.close();
  }
});

test('a playing session remains ready across a slow library refresh without another Play request', async () => {
  const next = deferred();
  let reads = 0;
  const h = setup({
    read: () =>
      ++reads === 1
        ? Promise.resolve({ generation: 1, library: prepared.library, assets: prepared.assets })
        : next.promise,
  });
  try {
    await h.session.loadLibrary();
    await h.session.start();
    const loading = h.session.loadLibrary(),
      plays = h.media.plays;
    assert.equal(await h.session.start(), true);
    assert.equal(h.session.snapshot().needsPlayGesture, false);
    assert.equal(h.media.plays, plays);
    next.resolve({ generation: 1, library: prepared.library, assets: prepared.assets });
    await loading;
  } finally {
    h.close();
  }
});

test('repeated Start during a delayed browser play promise makes one request and waits for reality', async () => {
  const h = setup(),
    permission = deferred();
  try {
    await h.session.loadLibrary();
    h.media.play = async () => {
      h.media.plays++;
      await permission.promise;
      h.media.paused = false;
    };
    const first = h.session.start(),
      second = h.session.start();
    assert.equal(h.media.plays, 1);
    assert.notEqual(h.player.snapshot().status, 'playing');
    permission.resolve();
    assert.equal(await first, true);
    assert.equal(await second, true);
    assert.equal(h.player.snapshot().status, 'playing');
  } finally {
    permission.resolve();
    h.close();
  }
});

test('Pause wins against a delayed browser play resolution and cannot regain listening intent', async () => {
  const h = setup(),
    permission = deferred();
  try {
    await h.session.loadLibrary();
    h.media.play = async () => {
      h.media.plays++;
      await permission.promise;
    };
    const first = h.session.start();
    h.session.pause();
    permission.resolve();
    assert.equal(await first, false);
    assert.equal(h.player.snapshot().desired, false);
    assert.equal(h.session.snapshot().needsPlayGesture, false);
    assert.equal(await h.session.start(), false);
  } finally {
    permission.resolve();
    h.close();
  }
});

test('repeated foreground notifications coalesce resume permission and do not restart settled playback', async () => {
  const h = setup(),
    permission = deferred();
  try {
    await h.session.loadLibrary();
    await h.session.start();
    h.session.suspend();
    h.media.play = async () => {
      h.media.plays++;
      await permission.promise;
      h.media.paused = false;
    };
    const before = h.media.plays;
    const first = h.session.resume(),
      second = h.session.resume();
    assert.equal(h.media.plays, before + 1);
    permission.resolve();
    assert.equal(await first, true);
    assert.equal(await second, true);
    await h.session.resume();
    assert.equal(h.media.plays, before + 1);
  } finally {
    permission.resolve();
    h.close();
  }
});

test('an accepted paused track can resume while a new library refresh is still pending', async () => {
  const next = deferred();
  let reads = 0;
  const h = setup({
    read: () =>
      ++reads === 1
        ? Promise.resolve({ generation: 1, library: prepared.library, assets: prepared.assets })
        : next.promise,
  });
  try {
    await h.session.loadLibrary();
    await h.session.start();
    h.session.suspend();
    const loading = h.session.loadLibrary();
    assert.equal(await h.session.resume(), true);
    assert.equal(h.player.snapshot().playing, true);
    next.resolve({ generation: 1, library: prepared.library, assets: prepared.assets });
    await loading;
  } finally {
    h.close();
  }
});
