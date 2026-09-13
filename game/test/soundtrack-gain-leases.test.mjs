import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { BUILTIN_SOUNDTRACK_TRACKS } from '../soundtrack.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture } from './helpers/soundtrack-fixtures.mjs';

const original = await fixture();
const close = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function setup(t, { mp3 = false, readAsset = async () => original.blob, fadeMs = 0 } = {}) {
  const h = audioHarness();
  h.soundscape.configure({ master: 0.8, music: 0.6 });
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    readAsset,
    URLImpl: h.URLImpl,
    fadeMs,
  });
  const library = structuredClone(original.library);
  library.playlists[0].trackIds = mp3
    ? [original.track.id, BUILTIN_SOUNDTRACK_TRACKS[0].id]
    : [BUILTIN_SOUNDTRACK_TRACKS[0].id, original.track.id];
  library.selection.playlistId = library.playlists[0].id;
  const savedLibrary = structuredClone(library);
  player.setLibrary(library);
  t.after(() => player.dispose());
  return { ...h, player, library, savedLibrary };
}
function mix(h, expected) {
  close(h.soundscape.getSettings().music, expected);
  close(h.media.volume, h.soundscape.getSettings().master * expected);
  if (h.soundscape.musicBus)
    close(h.soundscape.musicBus.gain.value, h.soundscape.enabled ? expected : 0);
}

for (const mp3 of [false, true]) {
  test(
    `temporary leases attenuate ${mp3 ? 'MP3' : 'synth'} without restarting or changing saved controls`,
    { timeout: 5000 },
    async (t) => {
      const h = setup(t, { mp3 });
      await h.player.play();
      if (mp3) h.media.currentTime = 0.1;
      else h.player.seek(3);
      const before = h.player.snapshot(),
        url = h.media.src,
        plays = h.media.plays;
      const cursor = h.soundscape.cursor;
      const a = h.player.acquireGain({ factor: 0.2 });
      mix(h, 0.12);
      assert.deepEqual(h.player.snapshot(), before);
      assert.equal(h.media.src, url);
      assert.equal(h.media.plays, plays);
      assert.equal(h.soundscape.cursor, cursor);
      assert.equal(h.soundscape.getSettings().sfx, 0.7);
      assert.equal(h.soundscape.getSettings().master, 0.8);
      const b = h.player.acquireGain({ factor: 0.5 });
      const c = h.player.acquireGain({ factor: 0.2 });
      a.release();
      mix(h, 0.12); // Equal factors have independent ownership.
      c.release();
      mix(h, 0.3);
      a.release();
      mix(h, 0.3);
      b.release();
      mix(h, 0.6);
      assert.deepEqual(h.player.snapshot(), before);
      assert.deepEqual(h.library, h.savedLibrary);
    },
  );
}

test(
  'volume edits, zero volume and paused listening intent survive lease release',
  { timeout: 5000 },
  async (t) => {
    const h = setup(t, { mp3: true });
    await h.player.play();
    h.media.currentTime = 0.1;
    const lease = h.player.acquireGain({ factor: 0.2 });
    h.player.setVolume(0.4);
    mix(h, 0.08);
    assert.equal(h.player.snapshot().volume, 0.4);
    h.player.pause();
    const paused = h.player.snapshot(),
      plays = h.media.plays;
    lease.release();
    mix(h, 0.4);
    assert.deepEqual(h.player.snapshot(), paused);
    assert.equal(h.media.plays, plays);
    assert.equal(h.media.paused, true);
    const muted = h.player.acquireGain({ factor: 0 });
    h.player.setVolume(0);
    muted.release();
    mix(h, 0);
    assert.equal(h.player.snapshot().desired, false);
    assert.equal(h.player.snapshot().volume, 0);
  },
);

test('an idle lease neither enables audio nor changes explicit mute/master state', (t) => {
  const h = setup(t);
  const idle = h.player.snapshot();
  h.soundscape.configure({ master: 0 });
  const lease = h.player.acquireGain({ factor: 0.25 });
  assert.equal(h.soundscape.context, null);
  assert.equal(h.media.plays, 0);
  assert.equal(h.media.volume, 0);
  lease.release();
  assert.equal(h.soundscape.context, null);
  assert.equal(h.soundscape.enabled, false);
  assert.equal(h.soundscape.getSettings().master, 0);
  assert.deepEqual(h.player.snapshot(), idle);
});

test(
  'lease changes during asynchronous original acquisition use the latest mix once playback begins',
  { timeout: 5000 },
  async (t) => {
    const opened = deferred(),
      bytes = deferred();
    const h = setup(t, {
      mp3: true,
      readAsset: () => {
        opened.resolve();
        return bytes.promise;
      },
    });
    const a = h.player.acquireGain({ factor: 0.2 });
    const playing = h.player.play();
    await opened.promise;
    const b = h.player.acquireGain({ factor: 0.4 });
    a.release();
    bytes.resolve(original.blob);
    assert.equal(await playing, true);
    mix(h, 0.24);
    assert.equal(h.media.plays, 1);
    b.release();
    mix(h, 0.6);
    assert.equal(h.media.plays, 1);
  },
);

test(
  'lease release composes with an in-flight fade and stays correct on the next track',
  { timeout: 5000 },
  async (t) => {
    const h = setup(t, { fadeMs: 40 });
    await h.player.play();
    const lease = h.player.acquireGain({ factor: 0.2 });
    const next = h.player.next();
    // fadeOut applies its first quarter synchronously before awaiting its timer.
    mix(h, 0.6 * 0.75 * 0.2);
    lease.release();
    mix(h, 0.6 * 0.75);
    assert.equal(await next, true);
    assert.equal(h.player.snapshot().track.kind, 'mp3');
    mix(h, 0.6);
  },
);

test(
  'suspension and lease cleanup never resume playback or lose the surviving owner',
  { timeout: 5000 },
  async (t) => {
    const h = setup(t, { mp3: true });
    await h.player.play();
    const a = h.player.acquireGain({ factor: 0.2 }),
      b = h.player.acquireGain({ factor: 0.4 });
    h.player.suspend();
    const suspended = h.player.snapshot(),
      plays = h.media.plays;
    a.release();
    assert.deepEqual(h.player.snapshot(), suspended);
    assert.equal(h.media.paused, true);
    assert.equal(h.media.plays, plays);
    close(h.media.volume, 0.8 * 0.6 * 0.4);
    await h.player.resume();
    mix(h, 0.24);
    b.release();
    mix(h, 0.6);
  },
);

test(
  'player disposal clears only this player’s leases and late releases are terminal no-ops',
  { timeout: 5000 },
  async (t) => {
    const h = setup(t),
      other = setup(t);
    await h.player.play();
    await other.player.play();
    const lease = h.player.acquireGain({ factor: 0.2 }),
      otherLease = other.player.acquireGain({ factor: 0.3 });
    h.player.dispose();
    mix(h, 0.6);
    mix(other, 0.18);
    const dead = h.player.snapshot();
    const configure = h.soundscape.configure;
    h.soundscape.configure = () => {
      throw new Error('Late release must not touch mixer');
    };
    lease.release();
    lease.release();
    assert.deepEqual(h.player.snapshot(), dead);
    assert.throws(() => h.player.acquireGain({ factor: 0.2 }), /disposed/);
    h.soundscape.configure = configure;
    otherLease.release();
    mix(other, 0.6);
  },
);

test('invalid factors and failed mixer acquisition do not leave hidden attenuation', (t) => {
  const h = setup(t);
  for (const factor of [-0.1, 1.1, NaN, Infinity, '0.2', null, undefined]) {
    assert.throws(() => h.player.acquireGain({ factor }), /gain/);
  }
  const existing = h.player.acquireGain({ factor: 0.5 });
  const configure = h.soundscape.configure.bind(h.soundscape);
  let failed = false;
  h.soundscape.configure = (value) => {
    configure(value);
    if (!failed) {
      failed = true;
      throw new Error('Mixer unavailable');
    }
  };
  assert.throws(() => h.player.acquireGain({ factor: 0.1 }), /Mixer unavailable/);
  mix(h, 0.3);
  existing.release();
  mix(h, 0.6);
});

test('reentrant disposal during mixer allocation cannot publish a surviving lease', (t) => {
  const h = setup(t);
  const configure = h.soundscape.configure.bind(h.soundscape);
  let once = true;
  h.soundscape.configure = (value) => {
    configure(value);
    if (once) {
      once = false;
      h.player.dispose();
    }
  };
  assert.throws(() => h.player.acquireGain({ factor: 0.2 }), /disposed/);
  mix(h, 0.6);
  assert.equal(h.player.snapshot().status, 'disposed');
  assert.equal(h.media.plays, 0);
});
