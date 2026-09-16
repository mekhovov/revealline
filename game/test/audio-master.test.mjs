import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioMaster, bindAudioMasterMedia } from '../ui/audio-master.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-10);
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
function queuedMedia() {
  const listeners = new Map(),
    events = [],
    writes = [];
  let volume = 1,
    muted = false;
  const element = {
    get volume() {
      return volume;
    },
    set volume(value) {
      volume = value;
      writes.push(['volume', value]);
      events.push('volumechange');
    },
    get muted() {
      return muted;
    },
    set muted(value) {
      muted = value;
      writes.push(['muted', value]);
      events.push('volumechange');
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emit(type) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn();
    },
  };
  return {
    element,
    writes,
    events,
    flush() {
      let count = 0;
      while (events.length) {
        assert(++count < 30, 'Native volume events must reach a fixed point.');
        element.emit(events.shift());
      }
      return count;
    },
  };
}

test('master starts silent, publishes explicit intent synchronously and never exposes mutable state', () => {
  const master = createAudioMaster();
  assert.deepEqual(master.snapshot(), { muted: true, volume: 1, revision: 0 });
  const seen = [];
  const release = master.subscribe((state) => seen.push(state));
  assert.equal(seen.length, 1);
  master.setVolume(0.4);
  master.setMuted(false);
  master.setMuted(false);
  assert.deepEqual(
    seen.map((state) => state.revision),
    [0, 1, 2, 3],
  );
  assert.equal(seen.at(-1), master.snapshot());
  assert.throws(() => {
    seen.at(-1).volume = 1;
  }, TypeError);
  release();
  master.setMuted(true);
  assert.equal(seen.length, 4);
});

test('invalid master changes leave state and observers untouched', () => {
  const master = createAudioMaster();
  const before = master.snapshot();
  for (const value of [-1, 1.1, NaN, Infinity, '0.5', null])
    assert.throws(() => master.setVolume(value), /volume/);
  for (const value of [0, null, 'false']) assert.throws(() => master.setMuted(value), /mute/);
  assert.equal(master.snapshot(), before);
});

test('a failed output cannot prevent other outputs from muting, and newer observer intent wins', () => {
  const master = createAudioMaster({ muted: false });
  master.subscribe(({ revision }) => {
    if (revision) throw new Error('failed output');
  });
  const observed = [];
  master.subscribe((state) => observed.push(state));
  assert.throws(() => master.setMuted(true), AggregateError);
  assert.equal(observed.at(-1).muted, true);
  const reentrant = createAudioMaster({ muted: false });
  reentrant.subscribe(({ muted, revision }) => {
    if (!muted && revision === 1) reentrant.setMuted(true);
  });
  const other = [];
  reentrant.subscribe((state) => other.push(state));
  reentrant.setVolume(0.5);
  assert(other.slice(1).every((state) => state.muted && state.revision === 2));
});

test('native output composes local and shared volume once and preserves local mute', () => {
  const master = createAudioMaster({ muted: false, volume: 0.4 });
  const h = queuedMedia();
  const binding = bindAudioMasterMedia({ audioMaster: master, element: h.element, volume: 0.5 });
  near(h.element.volume, 0.2);
  binding.setLocal({ muted: true, volume: 0.7 });
  master.setMuted(true);
  master.setVolume(0.2);
  master.setMuted(false);
  assert.equal(h.element.muted, true);
  near(h.element.volume, 0.14);
  binding.setLocal({ muted: false });
  assert.equal(h.element.muted, false);
  assert.throws(() => binding.setLocal({ volume: 0.1, muted: 'no' }), /mute/);
  master.setVolume(1);
  near(h.element.volume, 0.7);
  binding.dispose();
});

test('queued native volume/play events reassert the current gate without cumulative gain or loops', () => {
  const master = createAudioMaster({ volume: 0.4 });
  const h = queuedMedia();
  const binding = bindAudioMasterMedia({ audioMaster: master, element: h.element, volume: 0.5 });
  h.flush();
  h.element.muted = false;
  h.element.volume = 1;
  h.element.emit('play');
  h.flush();
  assert.equal(h.element.muted, true);
  near(h.element.volume, 0.2);
  const revision = master.snapshot().revision;
  h.element.emit('volumechange');
  assert.equal(h.events.length, 0);
  assert.equal(master.snapshot().revision, revision);
  h.writes.length = 0;
  master.setVolume(0.1);
  master.setMuted(false);
  h.flush();
  assert.deepEqual(h.writes, [
    ['volume', 0.05],
    ['muted', false],
  ]);
  binding.dispose();
});

test('native bindings have independent cleanup and refuse two owners of one element', () => {
  const master = createAudioMaster({ muted: false });
  const first = queuedMedia(),
    second = queuedMedia();
  const a = bindAudioMasterMedia({ audioMaster: master, element: first.element, volume: 0.3 });
  const b = bindAudioMasterMedia({ audioMaster: master, element: second.element, volume: 0.6 });
  assert.throws(
    () => bindAudioMasterMedia({ audioMaster: master, element: first.element }),
    /owner/,
  );
  a.dispose();
  a.setLocal({ muted: false, volume: 1 });
  master.setVolume(0.5);
  assert.equal(first.element.muted, true);
  near(first.element.volume, 0.3);
  near(second.element.volume, 0.3);
  master.dispose();
  assert.equal(second.element.muted, true);
  assert.throws(() => master.setMuted(false), /disposed/);
  b.dispose();
});

test('zero master/local volume enforces native mute without changing either mute preference', () => {
  const master = createAudioMaster({ muted: false, volume: 0.4 });
  const h = queuedMedia();
  const binding = bindAudioMasterMedia({ audioMaster: master, element: h.element, volume: 0.5 });
  master.setVolume(0);
  assert.equal(master.snapshot().muted, false);
  assert.equal(h.element.muted, true);
  master.setVolume(0.4);
  assert.equal(h.element.muted, false);
  binding.setLocal({ volume: 0 });
  assert.equal(h.element.muted, true);
  binding.setLocal({ muted: true, volume: 0.5 });
  master.setVolume(0);
  master.setVolume(1);
  assert.equal(h.element.muted, true);
  binding.setLocal({ muted: false });
  assert.equal(h.element.muted, false);
  near(h.element.volume, 0.5);
  h.flush();
  binding.dispose();
});

test('a native platform ignoring volume writes cannot loop and zero still uses its mute gate', () => {
  const master = createAudioMaster({ muted: false });
  const h = queuedMedia();
  Object.defineProperty(h.element, 'volume', {
    get: () => 1,
    set(value) {
      h.writes.push(['ignoredVolume', value]);
      h.events.push('volumechange');
    },
  });
  const binding = bindAudioMasterMedia({ audioMaster: master, element: h.element, volume: 0.5 });
  h.flush();
  assert.deepEqual(h.writes, [['ignoredVolume', 0.5]]);
  master.setVolume(0);
  h.flush();
  assert.equal(h.element.muted, true);
  assert.equal(master.snapshot().muted, false);
  assert.equal(h.events.length, 0);
  binding.dispose();
});

function sound(t, master) {
  const h = audioHarness();
  const output = new Soundscape({
    persistentMusic: true,
    audioMaster: master,
    contextFactory: () => h.context,
  });
  t.after(() => output.dispose());
  return { ...h, output };
}
test('Soundscape master changes do not create a context and retain local preview attenuation', async (t) => {
  const master = createAudioMaster({ volume: 0.5 });
  const { output } = sound(t, master);
  output.configure({ master: 0.35, music: 0.4, sfx: 0.7 });
  master.setVolume(0.2);
  assert.equal(output.context, null);
  await output.enable();
  assert.equal(output.master.gain.value, 0);
  master.setMuted(false);
  near(output.master.gain.value, 0.07);
  near(output.musicBus.gain.value, 0.4);
  near(output.sfxBus.gain.value, 0.7);
  assert.equal(output.getSettings().master, 0.35);
});

test('master mute wins over deferred enable and resume without changing transport preference', async (t) => {
  const master = createAudioMaster({ muted: false, volume: 0.5 });
  const { output, context } = sound(t, master);
  const opening = deferred();
  context.resume = async () => {
    await opening.promise;
    context.state = 'running';
  };
  const enabling = output.enable();
  master.setMuted(true);
  opening.resolve();
  assert.equal(await enabling, true);
  assert.equal(output.master.gain.value, 0);
  assert.equal(output.enabled, true, 'Activation remains separate from master mute.');
  output.suspend();
  const waking = deferred();
  context.resume = async () => {
    await waking.promise;
    context.state = 'running';
  };
  master.setMuted(false);
  const resuming = output.resume();
  master.setMuted(true);
  waking.resolve();
  await resuming;
  assert.equal(output.master.gain.value, 0);
  master.setMuted(false);
  near(output.master.gain.value, 0.65 * 0.5);
});

test('master disposal silences outputs and disposed Soundscapes release only their subscription', async (t) => {
  const master = createAudioMaster({ muted: false });
  const a = sound(t, master),
    b = sound(t, master);
  await a.output.enable();
  await b.output.enable();
  await a.output.dispose();
  a.output.applyVolumes = () => {
    throw new Error('Disposed output must stay detached');
  };
  master.setVolume(0.2);
  near(b.output.master.gain.value, 0.13);
  master.dispose();
  assert.equal(b.output.master.gain.value, 0);
});
