// Authored regressions only; automated execution remains explicitly waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIndustrialAudioReview,
  INDUSTRIAL_AUDIO_SAMPLES,
} from '../ui/industrial-audio-review.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { MOVEMENT_AUDIO_KEY } from '../ui/movement-audio.mjs';
import { actorSoundProfile, encounterSoundRecipe } from '../ui/encounter-audio.mjs';
import { FeedbackDirector } from '../ui/feedback-director.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

function reviewHarness({ muted = false, enable } = {}) {
  const events = () => {
      const listeners = new Map();
      return {
        addEventListener(type, listener) {
          const row = listeners.get(type) ?? new Set();
          row.add(listener);
          listeners.set(type, row);
        },
        removeEventListener(type, listener) {
          listeners.get(type)?.delete(listener);
        },
        emit(type, event = {}) {
          for (const listener of [...(listeners.get(type) ?? [])]) listener(event);
        },
      };
    },
    storage = new Map([[AUDIO_PREFERENCES_KEY, JSON.stringify({ muted, volume: 0.42 })]]),
    writes = [],
    timers = new Map(),
    calls = [],
    document = { ...events(), hidden: false };
  let timerId = 0;
  const host = {
    ...events(),
    document,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem(key, value) {
        writes.push([key, value]);
        storage.set(key, value);
      },
    },
    setTimeout(fn, delay) {
      const id = ++timerId;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const sound = {
      configure() {},
      applyVolumes() {},
      async enable() {
        calls.push(['enable']);
        return enable ? enable() : true;
      },
      encounter(...args) {
        calls.push(args);
        return true;
      },
      suspend() {
        calls.push(['suspend']);
      },
      reset() {},
      async dispose() {
        calls.push(['dispose']);
      },
    },
    review = createIndustrialAudioReview({ window: host, document, soundFactory: () => sound });
  function advance(delay) {
    for (const [id, timer] of [...timers])
      if (timer.delay <= delay) {
        timers.delete(id);
        timer.fn();
      }
  }
  return { review, host, document, sound, timers, calls, writes, storage, advance };
}

test('six original sample descriptors and recipes distinguish actor/vehicle material without new assets', () => {
  assert.deepEqual(
    INDUSTRIAL_AUDIO_SAMPLES.map((entry) => entry.id),
    ['runner', 'courier', 'guard', 'shield-bearer', 'car', 'tank'],
  );
  for (const entry of INDUSTRIAL_AUDIO_SAMPLES) {
    assert.ok(entry.label.en && entry.label.uk && entry.description.en && entry.description.uk);
    assert.ok(Object.isFrozen(entry));
  }
  assert.equal(
    new Set(
      ['runner', 'courier', 'guard', 'shield-bearer'].map((id) => actorSoundProfile(id).cadence),
    ).size,
    4,
  );
  assert.notEqual(
    encounterSoundRecipe('drive', { machine: 'tracked' }).name,
    encounterSoundRecipe('drive', { machine: 'wheeled' }).name,
  );
  assert.equal(encounterSoundRecipe('equipment', { family: 'guard' }).movement, true);
  assert.equal(encounterSoundRecipe('step', { gainScale: -1 }).gain, 0);
});

test('listening honors saved mute/volume with no autoplay or preference writes', async () => {
  const h = reviewHarness({ muted: true });
  assert.deepEqual(h.review.snapshot(), {
    muted: true,
    volume: 0.42,
    playing: false,
    sample: null,
  });
  assert.deepEqual(await h.review.play('runner'), { played: false, reason: 'muted' });
  assert.ok(!h.calls.some(([kind]) => kind === 'enable'));
  assert.equal(h.writes.length, 0);
  h.review.setMuted(false);
  assert.equal(h.writes.length, 1);
  assert.equal((await h.review.play('runner')).played, true);
  assert.equal(h.writes.length, 1);
  await h.review.dispose();
});

test('changing a sample cancels the old sequence; release clears every delayed accent', async () => {
  const h = reviewHarness();
  await h.review.play('runner');
  await h.review.play('tank', { treatment: 'brutal' });
  h.advance(520);
  const catches = h.calls.filter(([kind]) => kind === 'catch');
  assert.equal(catches.length, 1);
  assert.equal(catches[0][1].machine, 'tracked');
  assert.equal(catches[0][1].brutal, true);
  h.review.release();
  h.advance(1000);
  assert.equal(h.timers.size, 0);
  assert.equal(h.review.snapshot().playing, false);
  await h.review.dispose();
});

test('release while activation is pending cannot schedule stale sound', async () => {
  let resolve;
  const h = reviewHarness({
    enable: () =>
      new Promise((done) => {
        resolve = done;
      }),
  });
  const pending = h.review.play('courier');
  h.review.release();
  resolve(true);
  assert.deepEqual(await pending, { played: false, reason: 'cancelled' });
  assert.ok(!h.calls.some(([kind]) => ['step', 'equipment', 'catch'].includes(kind)));
  assert.equal(h.timers.size, 0);
  await h.review.dispose();
});

test('BFCache and hidden interruption retain deliberate replay without autoplay', async () => {
  const h = reviewHarness();
  await h.review.play('guard');
  h.host.emit('pagehide', { persisted: true });
  assert.ok(!h.calls.some(([kind]) => kind === 'dispose'));
  h.host.emit('pageshow', { persisted: true });
  assert.equal(h.review.snapshot().playing, false);
  assert.equal((await h.review.play('guard')).played, true);
  h.document.hidden = true;
  h.document.emit('visibilitychange');
  assert.equal(h.timers.size, 0);
  assert.deepEqual(await h.review.play('car'), { played: false, reason: 'cancelled' });
  await h.review.dispose();
});

test('cross-tab mute cancels a preview and movement preferences keep their own fader', async () => {
  const h = reviewHarness();
  await h.review.play('car');
  const raw = JSON.stringify({ muted: true, volume: 0.42 });
  h.storage.set(AUDIO_PREFERENCES_KEY, raw);
  h.host.emit('storage', {
    key: AUDIO_PREFERENCES_KEY,
    storageArea: h.host.localStorage,
    newValue: raw,
  });
  assert.equal(h.review.snapshot().playing, false);
  assert.equal(h.timers.size, 0);
  h.storage.set(MOVEMENT_AUDIO_KEY, JSON.stringify({ enabled: false, volume: 0.2 }));
  h.host.emit('storage', { key: MOVEMENT_AUDIO_KEY });
  assert.deepEqual(h.sound.movementSettings, { enabled: false, volume: 0.2 });
  assert.equal(h.writes.length, 0);
  await h.review.dispose();
});

test('shared mixer gives warnings priority over incidental samples and offline renditions', async () => {
  const { soundscape: sound, context } = audioHarness();
  sound.feedbackDirector.prepare = () => {};
  sound.feedbackDirector.load = () => {};
  await sound.enable();
  assert.equal(sound.encounter('step', { family: 'runner' }), true);
  const step = [...sound.voices].find((voice) => voice.movement);
  assert.ok(step);
  context.currentTime = 0.1;
  assert.equal(sound.encounter('warning'), true);
  assert.equal(step.ended, true);
  context.currentTime = 0.8;
  assert.equal(sound.encounter('equipment', { family: 'guard' }), false);
  sound.reset();
  sound.movementSettings = { enabled: false, volume: 1 };
  assert.equal(sound.encounter('drive', { machine: 'tracked' }), false);
  assert.equal(sound.encounter('catch', { machine: 'tracked' }), true);
  sound.suspend();
  assert.equal(sound.voices.size, 0);
  await sound.dispose();
});

function observedBoard() {
  return {
    width: 24,
    height: 18,
    tick: 0,
    time: 0,
    status: 'running',
    player: { x: 1, y: 1, bodyId: 'fpv-body' },
    enemies: [
      { id: 'near', bodyId: 'humanoid', family: 'courier', x: 4, y: 1, phase: 'walk' },
      { id: 'far', bodyId: 'humanoid', family: 'runner', x: 8, y: 1, phase: 'walk' },
    ],
  };
}
function observedAudio() {
  const cues = [],
    sound = {
      enabled: true,
      paused: false,
      audioMaster: { muted: false },
      voices: new Set(),
      encounter: (...args) => cues.push(args),
    },
    director = new FeedbackDirector(sound);
  director.play = () => null;
  return { cues, director };
}

test('observed footsteps aggregate nearest family once per board/tick; restored actors do not replay', () => {
  const { cues, director } = observedAudio(),
    run = observedBoard();
  director.update(true, {}, run, { board: 'left', silentStart: true });
  assert.equal(cues.length, 0);
  run.tick++;
  run.enemies.forEach((actor) => actor.x++);
  const before = structuredClone(run);
  director.update(true, {}, run, { board: 'left' });
  assert.deepEqual(run, before);
  assert.equal(cues.length, 1);
  assert.equal(cues[0][0], 'step');
  assert.equal(cues[0][1].family, 'courier');
  director.update(true, {}, run, { board: 'left' });
  assert.equal(cues.length, 1);
  director.update(true, {}, structuredClone(run), { board: 'right', silentStart: true });
  assert.equal(cues.length, 1);
  director.reset();
  director.update(true, {}, run, { board: 'left', silentStart: true });
  assert.equal(cues.length, 1);
});

test('Military Field drive onset is bounded, excludes humanoids and requires renewed actual movement', () => {
  const { cues, director } = observedAudio(),
    run = observedBoard();
  run.enemies = [
    { id: 'tank', type: 'eroder', x: 4, y: 1 },
    { id: 'car', type: 'bouncer', x: 9, y: 1 },
  ];
  const options = { collectionId: 'military-field', silentStart: true };
  director.update(true, {}, run, options);
  run.tick++;
  run.enemies.forEach((actor) => actor.x++);
  director.update(true, {}, run, options);
  assert.equal(cues.length, 1);
  assert.equal(cues[0][1].machine, 'tracked');
  run.tick++;
  run.enemies.forEach((actor) => actor.x++);
  director.update(true, {}, run, options);
  assert.equal(cues.length, 1);
  run.tick++;
  director.update(true, {}, run, options);
  run.tick++;
  run.enemies.forEach((actor) => actor.x++);
  director.update(true, {}, run, options);
  assert.equal(cues.length, 2);
});

test('journal-owned phase cues suppress the observational equipment path', () => {
  const { cues, director } = observedAudio(),
    run = observedBoard();
  director.update(true, {}, run, { silentStart: true });
  run.tick++;
  run.enemies[0].phase = 'burst';
  director.update(true, {}, run, { phaseEvents: false });
  assert.equal(cues.length, 0);
});

test('recorded movement textures are short excerpts; persistent rotor loops keep their original ownership', () => {
  const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {} }),
    source = () => ({
      playbackRate: parameter(),
      connect() {},
      disconnect() {},
      start() {},
      stop(at) {
        this.stopAt = at;
      },
    }),
    sound = {
      enabled: true,
      audioMaster: { muted: false },
      voices: new Set(),
      movementSettings: { enabled: true, volume: 1 },
      movementBus: {},
      sfxBus: {},
      context: {
        state: 'running',
        currentTime: 1,
        createBufferSource: source,
        createGain: () => ({ gain: parameter(), connect() {}, disconnect() {} }),
      },
    },
    director = new FeedbackDirector(sound);
  director.buffers.set('grain', { duration: 6.4 });
  director.buffers.set('rotor', { duration: 5 });
  const step = director.play('grain', encounterSoundRecipe('step', { family: 'runner' }));
  assert.ok(step.source.stopAt < 1.1);
  const rotor = director.play('rotor', { loop: true, movement: true });
  assert.equal(rotor.source.stopAt, undefined);
  director.buffers.set('warning', { duration: 0.4 });
  director.play('warning', { priority: 5 });
  assert.equal(step.ended, true);
  assert.equal(rotor.ended, false);
  director.close();
});
