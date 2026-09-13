import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';
import { prepareStoryFixture } from './helpers/victory-story-fixture.mjs';
import { createStoryMusicDucker, createVictoryStoryPresentation } from '../ui/victory-story.mjs';

class Node extends Element {
  insertBefore(child, target) {
    child.remove();
    const index = this.children.indexOf(target);
    assert.notEqual(index, -1);
    this.children.splice(index, 0, child);
    child.parentNode = this;
    return child;
  }
}
class Video extends Node {
  constructor(doc) {
    super(doc, 'video');
    this.src = '';
    this.readyState = 0;
    this._time = 0;
    this.seeking = false;
    this.paused = true;
    this.frames = new Map();
    this.nextFrame = 0;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.loads = 0;
    this.ended = false;
    this.playResult = () => Promise.resolve();
  }
  get currentTime() {
    return this._time;
  }
  set currentTime(value) {
    this._time = value;
    this.seeking = true;
  }
  load() {
    this.loads++;
  }
  pause() {
    this.pauseCalls++;
    this.paused = true;
  }
  play() {
    this.playCalls++;
    return this.playResult().then(() => {
      this.paused = false;
    });
  }
  removeAttribute(name) {
    super.removeAttribute(name);
    if (name === 'src') this.src = '';
  }
  metadata(facts = {}) {
    this.duration = facts.duration ?? 6;
    this.videoWidth = facts.width ?? 640;
    this.videoHeight = facts.height ?? 360;
    this.readyState = 2;
    this.emit('loadedmetadata');
  }
  completeSeek(value = this._time) {
    this._time = value;
    this.seeking = false;
    this.emit('seeked');
  }
  requestVideoFrameCallback(fn) {
    const id = ++this.nextFrame;
    this.frames.set(id, fn);
    return id;
  }
  cancelVideoFrameCallback(id) {
    this.frames.delete(id);
  }
  at(seconds) {
    this._time = seconds;
    this.emit('timeupdate');
  }
}
async function setup(t, overrides = {}) {
  const f = await prepareStoryFixture();
  const doc = new Document(),
    win = new Events();
  doc.createElement = (tag) => new Node(doc, tag);
  doc.defaultView = win;
  const container = doc.createElement('div'),
    poster = doc.createElement('canvas');
  poster.dataset.exactOriginal = f.pin.sha256;
  container.append(poster);
  doc.body.append(container);
  const urls = new Map(),
    revoked = [],
    timeouts = new Map(),
    intervals = new Map(),
    gains = [],
    changes = [];
  let id = 0,
    video;
  const timers = {
    setTimeout(fn) {
      timeouts.set(++id, fn);
      return id;
    },
    clearTimeout(key) {
      timeouts.delete(key);
    },
    setInterval(fn) {
      intervals.set(++id, fn);
      return id;
    },
    clearInterval(key) {
      intervals.delete(key);
    },
  };
  const musicDucker = createStoryMusicDucker((gain) => gains.push(gain));
  const player = createVictoryStoryPresentation({
    container,
    posterElement: poster,
    picturePin: f.pin,
    prepared: f.prepared,
    document: doc,
    window: win,
    timers,
    musicDucker,
    createVideo() {
      video = new Video(doc);
      return video;
    },
    URLImpl: {
      createObjectURL(blob) {
        const url = `blob:story-${++id}`;
        urls.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        urls.delete(url);
        revoked.push(url);
      },
    },
    onChange: (state) => changes.push(state),
    ...overrides,
  });
  t.after(() => player.dispose());
  const button = (text) =>
    [...player.element.querySelectorAll('button')].find((b) => b.textContent === text);
  const ready = () => {
    video.metadata();
    video.completeSeek();
  };
  return {
    ...f,
    doc,
    win,
    container,
    poster,
    player,
    video,
    urls,
    revoked,
    gains,
    changes,
    timeouts,
    intervals,
    button,
    ready,
  };
}
const microtasks = async () => {
  for (let n = 0; n < 8; n++) await Promise.resolve();
};

test('exact poster stays visible through silent preparation; explicit native action starts one segment without reward APIs', async (t) => {
  const h = await setup(t);
  assert.equal(h.player.snapshot().state, 'preparing');
  assert.equal(h.poster.hidden, false);
  assert.equal(h.video.playCalls, 0);
  assert.equal(h.video.muted, true);
  assert.deepEqual(h.gains, []);
  h.ready();
  assert.equal(h.video.currentTime, 2);
  assert.equal(h.player.snapshot().state, 'poster');
  h.button('Play').emit('pointerdown');
  assert.equal(h.video.playCalls, 0);
  h.button('Play').click();
  assert.equal(h.video.playCalls, 1); // Modeled native button click; no OS-input claim.
  await microtasks();
  assert.equal(h.player.snapshot().state, 'playing');
  assert.equal(h.poster.hidden, true);
  assert.equal(h.video.volume, 0.7);
  assert.deepEqual(h.gains, [0.2]);
  assert.deepEqual(
    Object.keys(h.player).sort(),
    ['dispose', 'element', 'pause', 'play', 'replay', 'setPreferences', 'skip', 'snapshot'].sort(),
  );
  h.video.at(4);
  assert.equal(h.player.snapshot().state, 'poster');
  assert.equal(h.poster.hidden, false);
  assert.equal(h.poster.dataset.exactOriginal, h.pin.sha256);
  assert.equal(h.container.children[0], h.poster);
  assert.deepEqual(h.gains, [0.2, 1]);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.video.frames.size, 0);
});

test('Skip and Replay preserve the same poster, seek the selected start and never mint a new result', async (t) => {
  const h = await setup(t);
  h.ready();
  await h.player.play();
  h.video.at(3);
  h.button('Skip').click();
  assert.equal(h.poster.hidden, false);
  assert.equal(h.video.paused, true);
  h.button('Replay').click();
  assert.equal(h.player.snapshot().state, 'preparing');
  assert.equal(h.video.currentTime, 2);
  h.video.completeSeek();
  await microtasks();
  assert.equal(h.player.snapshot().state, 'playing');
  assert.equal(h.video.playCalls, 2);
  h.video.at(4.1);
  assert.equal(h.player.snapshot().state, 'poster');
  assert.equal(h.container.children[0], h.poster);
  assert.deepEqual(h.gains, [0.2, 1, 0.2, 1]);
});

test('blocked play is truthful, returns music gain and offers a later native retry', async (t) => {
  const h = await setup(t);
  h.ready();
  h.video.playResult = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
  assert.equal(await h.player.play(), false);
  assert.equal(h.player.snapshot().state, 'blocked');
  assert.equal(h.poster.hidden, false);
  assert.match(h.player.snapshot().reason, /blocked/);
  assert.deepEqual(h.gains, [0.2, 1]);
  assert.equal(h.timeouts.size, 0);
  h.video.playResult = () => Promise.resolve();
  assert.equal(await h.player.play(), true);
});

test('blur pauses pending play and a late successful promise cannot restart audible video', async (t) => {
  const h = await setup(t);
  h.ready();
  const late = deferred();
  h.video.playResult = () => late.promise;
  const result = h.player.play();
  h.win.emit('blur');
  assert.equal(h.poster.hidden, false);
  assert.deepEqual(h.gains, [0.2, 1]);
  assert.equal(await result, false);
  assert.equal(h.video.muted, true);
  late.resolve();
  await microtasks();
  assert.equal(h.video.paused, true);
  assert.equal(h.intervals.size, 0);
  h.win.emit('focus');
  assert.equal(h.video.playCalls, 1);
});

test('hidden-page pause retains current position and needs explicit Resume story', async (t) => {
  const h = await setup(t);
  h.ready();
  await h.player.play();
  h.video.at(2.75);
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.equal(h.player.snapshot().state, 'paused');
  assert.equal(h.video.currentTime, 2.75);
  assert.equal(await h.player.play(), false);
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  assert.equal(h.video.playCalls, 1);
  h.button('Resume story').click();
  await microtasks();
  assert.equal(h.player.snapshot().state, 'playing');
  assert.equal(h.video.currentTime, 2.75);
});

test('pause during Replay seek cancels its autoplay intent but allows later explicit Play', async (t) => {
  const h = await setup(t);
  h.ready();
  await h.player.play();
  h.player.skip();
  await h.player.replay();
  h.win.emit('blur');
  h.video.completeSeek();
  await microtasks();
  assert.equal(h.player.snapshot().state, 'poster');
  assert.equal(h.video.playCalls, 1);
  assert.equal(await h.player.play(), true);
  assert.equal(h.video.playCalls, 2);
});

test('Skip before metadata keeps the exact poster and never starts after late readiness', async (t) => {
  const h = await setup(t);
  h.player.skip();
  h.ready();
  await microtasks();
  assert.equal(h.player.snapshot().state, 'poster');
  assert.equal(h.poster.hidden, false);
  assert.equal(h.video.playCalls, 0);
  assert.equal(await h.player.play(), true);
});

test('reduced motion stays opt-in, and enabling it during playback returns to the exact poster', async (t) => {
  const h = await setup(t, { reducedMotion: true });
  h.ready();
  assert.equal(h.video.playCalls, 0);
  assert.match(
    [...h.player.element.querySelectorAll('p')].find(
      (node) => node.getAttribute('role') === 'status',
    ).textContent,
    /Reduced motion/,
  );
  await h.player.play();
  assert.equal(h.player.snapshot().state, 'playing');
  h.player.setPreferences({ reducedMotion: false });
  h.player.setPreferences({ reducedMotion: true });
  assert.equal(h.player.snapshot().state, 'poster');
  assert.equal(h.poster.hidden, false);
  assert.deepEqual(h.gains, [0.2, 1]);
});

test('cinematic volume is independent and pause releases only this music lease', async (t) => {
  const factors = [],
    mixer = createStoryMusicDucker((factor) => factors.push(factor));
  const outer = mixer.acquire(0.1),
    h = await setup(t, { musicDucker: mixer });
  h.ready();
  await h.player.play();
  h.player.setPreferences({ volume: 0.35 });
  assert.equal(h.video.volume, 0.35);
  h.player.pause();
  assert.deepEqual(factors, [0.1, 0.1, 0.1]);
  outer();
  outer();
  assert.deepEqual(factors, [0.1, 0.1, 0.1, 1]);
  assert.throws(() => h.player.setPreferences({ volume: NaN }));
});

test('stale frame callback cannot clear the newer Replay poll or finish a different play epoch', async (t) => {
  const h = await setup(t);
  h.ready();
  await h.player.play();
  const old = [...h.video.frames.values()][0];
  h.player.skip();
  await h.player.replay();
  h.video.completeSeek();
  await microtasks();
  const current = [...h.video.frames.keys()];
  old(0, { mediaTime: 5 });
  assert.deepEqual([...h.video.frames.keys()], current);
  assert.equal(h.player.snapshot().state, 'playing');
  h.player.skip();
  assert.equal(h.video.frames.size, 0);
});

test('finite load, seek and play deadlines preserve poster and release temporary music', async (t) => {
  for (const stage of ['load', 'seek', 'play']) {
    const h = await setup(t);
    if (stage === 'seek') h.video.metadata();
    let pending;
    if (stage === 'play') {
      h.ready();
      const never = deferred();
      h.video.playResult = () => never.promise;
      pending = h.player.play();
    }
    assert.equal(h.timeouts.size, 1);
    [...h.timeouts.values()][0]();
    assert.equal(h.player.snapshot().state, 'error');
    assert.equal(h.poster.hidden, false);
    assert.equal(h.video.paused, true);
    assert.equal(h.timeouts.size, 0);
    assert.equal(h.intervals.size, 0);
    if (pending) {
      assert.deepEqual(h.gains, [0.2, 1]);
      assert.equal(await pending, false);
    }
  }
});

test('different playback dimensions or unhonored seek never show video', async (t) => {
  const h = await setup(t);
  h.video.metadata({ width: 320 });
  assert.equal(h.player.snapshot().state, 'error');
  assert.equal(h.video.playCalls, 0);
  const k = await setup(t);
  k.video.metadata();
  k.video.completeSeek(0);
  assert.equal(k.player.snapshot().state, 'error');
  assert.equal(k.poster.hidden, false);
});

test('duration mutation and media decode failure stop the player without replacing earned art', async (t) => {
  for (const kind of ['duration', 'error']) {
    const h = await setup(t);
    h.ready();
    await h.player.play();
    if (kind === 'duration') {
      h.video.duration = 7;
      h.video.at(3);
    } else h.video.emit('error');
    assert.equal(h.player.snapshot().state, 'error');
    assert.equal(h.poster.hidden, false);
    assert.deepEqual(h.gains, [0.2, 1]);
  }
});

test('without frame callbacks the current-time observer still ends the selected segment', async (t) => {
  const h = await setup(t);
  h.video.requestVideoFrameCallback = undefined;
  h.ready();
  await h.player.play();
  h.video._time = 4.05;
  [...h.intervals.values()][0]();
  assert.equal(h.player.snapshot().state, 'poster');
  assert.equal(h.intervals.size, 0);
});

test('dispose/pagehide revokes one owned URL, all listeners/timers and late play success', async (t) => {
  const h = await setup(t);
  h.ready();
  const late = deferred();
  h.video.playResult = () => late.promise;
  const pending = h.player.play();
  const oldVideo = h.video;
  h.win.emit('pagehide');
  h.player.dispose();
  assert.equal(h.player.snapshot().state, 'disposed');
  assert.equal(h.urls.size, 0);
  assert.equal(h.revoked.length, 1);
  assert.equal(oldVideo.src, '');
  assert.equal(h.poster.hidden, false);
  assert.equal(h.container.children.length, 1);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.intervals.size, 0);
  for (const set of oldVideo.listeners.values()) assert.equal(set.size, 0);
  assert.equal(await pending, false);
  assert.equal(oldVideo.muted, true);
  late.resolve();
  await microtasks();
  assert.equal(oldVideo.paused, true);
  const count = h.changes.length;
  oldVideo.metadata();
  h.player.setPreferences({ volume: 0.9 });
  assert.equal(h.changes.length, count);
  assert.equal(await h.player.play(), false);
});

test('an external abort before or after opening releases owned media and keeps the caller poster', async (t) => {
  for (const before of [true, false]) {
    const controller = new AbortController();
    if (before) controller.abort();
    const h = await setup(t, { signal: controller.signal });
    if (!before) controller.abort();
    assert.equal(h.player.snapshot().state, 'disposed');
    assert.equal(h.urls.size, 0);
    assert.equal(h.container.children[0], h.poster);
    assert.equal(h.poster.hidden, false);
  }
});

test('a broken music restoration adapter cannot prevent owned video cleanup and reports its limit', async (t) => {
  const h = await setup(t, {
    musicDucker: {
      acquire: () => () => {
        throw new Error('mixer disconnected');
      },
    },
  });
  h.ready();
  await h.player.play();
  h.player.skip();
  assert.match(h.player.snapshot().audioWarning, /could not be restored/);
  assert.equal(h.poster.hidden, false);
  assert.equal(h.video.paused, true);
  assert.equal(h.video.muted, true);
  await h.player.play();
  assert.doesNotThrow(() => h.player.dispose());
  assert.equal(h.urls.size, 0);
  assert.equal(h.intervals.size, 0);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.container.children.length, 1);
});

test('failed gain acquisition rolls back only the new lease and never starts media', async (t) => {
  const gains = [];
  const mixer = createStoryMusicDucker((gain) => {
    gains.push(gain);
    if (gain === 0.2) throw new Error('mixer unavailable');
  });
  const h = await setup(t, { musicDucker: mixer });
  h.ready();
  assert.equal(await h.player.play(), false);
  assert.equal(h.video.playCalls, 0);
  assert.deepEqual(gains, [0.2, 1]);
  assert.equal(h.poster.hidden, false);
});

test('premature native end reports truncation instead of claiming the selected segment completed', async (t) => {
  const h = await setup(t);
  h.ready();
  await h.player.play();
  h.video._time = 3;
  h.video.ended = true;
  h.video.emit('ended');
  assert.equal(h.player.snapshot().state, 'error');
  assert.match(h.player.snapshot().reason, /before/);
  assert.equal(h.poster.hidden, false);
  assert.deepEqual(h.gains, [0.2, 1]);
});

test('native focus follows visible story actions through Play, Pause, end and Replay', async (t) => {
  const h = await setup(t);
  h.ready();
  const play = h.button('Play');
  play.focus();
  play.click();
  assert.equal(h.doc.activeElement, h.button('Pause'));
  await microtasks();
  h.button('Pause').click();
  assert.equal(h.doc.activeElement, h.button('Resume story'));
  h.button('Resume story').click();
  await microtasks();
  h.video.at(4);
  assert.equal(h.doc.activeElement, h.button('Replay'));
  assert.equal(h.doc.activeElement.hidden, false);
  // Native focus methods and click defaults are modeled here; physical keys/controllers remain a host gate.
});

test('an obsolete play result cannot pause or redock a newer explicit play', async (t) => {
  const h = await setup(t);
  h.ready();
  const first = deferred();
  h.video.playResult = () => first.promise;
  const old = h.player.play();
  h.player.pause();
  assert.equal(await old, false);
  h.video.playResult = () => Promise.resolve();
  assert.equal(await h.player.play(), true);
  const pauses = h.video.pauseCalls;
  first.resolve();
  await microtasks();
  assert.equal(h.player.snapshot().state, 'playing');
  assert.equal(h.video.paused, false);
  assert.equal(h.video.pauseCalls, pauses);
  assert.equal(h.poster.hidden, true);
});

test('native media interruption releases music and requires explicit story Resume', async (t) => {
  const h = await setup(t);
  h.ready();
  await h.player.play();
  h.video._time = 3;
  h.video.pause();
  h.video.emit('pause');
  assert.equal(h.player.snapshot().state, 'paused');
  assert.deepEqual(h.gains, [0.2, 1]);
  h.video.emit('playing');
  assert.equal(h.player.snapshot().state, 'paused');
  assert.equal(await h.player.play(), true);
  assert.equal(h.video.currentTime, 3);
});

test('abort during video allocation cleans the returned unadopted video without loading an original', async (t) => {
  const controller = new AbortController();
  let allocated;
  const h = await setup(t, {
    signal: controller.signal,
    createVideo() {
      controller.abort();
      allocated = new Video(new Document());
      return allocated;
    },
  });
  assert.equal(h.player.snapshot().state, 'disposed');
  assert.equal(allocated.src, '');
  assert.equal(allocated.paused, true);
  assert.equal(allocated.muted, true);
  assert.equal(allocated.parentNode, null);
  assert.equal(allocated.loads, 1);
  assert.equal(h.urls.size, 0);
  assert.equal(h.revoked.length, 0);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.container.children.length, 1);
  assert.equal(h.poster.hidden, false);
});

test('abort during URL allocation revokes the returned unadopted URL exactly once', async (t) => {
  const controller = new AbortController(),
    revoked = [];
  let allocations = 0;
  const h = await setup(t, {
    signal: controller.signal,
    URLImpl: {
      createObjectURL() {
        allocations++;
        controller.abort();
        return 'blob:aborted-during-allocation';
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
  });
  assert.equal(h.player.snapshot().state, 'disposed');
  assert.equal(allocations, 1);
  assert.deepEqual(revoked, ['blob:aborted-during-allocation']);
  assert.equal(h.video.src, '');
  assert.equal(h.video.muted, true);
  assert.equal(h.video.paused, true);
  assert.equal(h.timeouts.size, 0);
  assert.equal(h.container.children.length, 1);
  h.player.dispose();
  assert.equal(revoked.length, 1);
  h.video.metadata();
  assert.equal(h.video.playCalls, 0);
});

test('abort during gain acquisition releases the returned lease without starting video', async (t) => {
  const controller = new AbortController();
  let releases = 0;
  const h = await setup(t, {
    signal: controller.signal,
    musicDucker: {
      acquire() {
        controller.abort();
        return () => {
          releases++;
        };
      },
    },
  });
  h.ready();
  assert.equal(await h.player.play(), false);
  assert.equal(h.player.snapshot().state, 'disposed');
  assert.equal(releases, 1);
  assert.equal(h.video.playCalls, 0);
  assert.equal(h.urls.size, 0);
});

test('abort during status callback keeps disposed state after pending seek readiness', async (t) => {
  const controller = new AbortController();
  let cancelOnPreparing = false;
  const h = await setup(t, {
    signal: controller.signal,
    onChange(state) {
      if (cancelOnPreparing && state.state === 'preparing') controller.abort();
    },
  });
  cancelOnPreparing = true;
  h.video.metadata();
  assert.equal(h.player.snapshot().state, 'disposed');
  assert.equal(h.urls.size, 0);
  assert.equal(h.video.playCalls, 0);
  assert.equal(h.timeouts.size, 0);
});

test('abort during gain release cannot reopen a disposed story as a static view', async (t) => {
  const controller = new AbortController();
  let releases = 0;
  const h = await setup(t, {
    signal: controller.signal,
    musicDucker: {
      acquire() {
        return () => {
          releases++;
          controller.abort();
        };
      },
    },
  });
  h.ready();
  await h.player.play();
  h.player.skip();
  assert.equal(h.player.snapshot().state, 'disposed');
  assert.equal(releases, 1);
  assert.equal(h.urls.size, 0);
  assert.equal(h.container.children.length, 1);
});
