import test from 'node:test';
import assert from 'node:assert/strict';
import { Soundscape, DEFAULT_TRACKS, MUSIC_STYLES, SYNTH_SONG_STEPS } from '../ui/audio.mjs';
import { composeStep, scheduleWindow, deriveTension, validateTrack } from '../ui/music.mjs';
class Param {
  constructor() {
    this.value = 0;
    this.calls = [];
  }
  setValueAtTime(value, time) {
    this.value = value;
    this.calls.push({ value, time });
  }
  linearRampToValueAtTime(value, time) {
    this.calls.push({ value, time });
  }
  exponentialRampToValueAtTime(value, time) {
    this.calls.push({ value, time });
  }
  setTargetAtTime(value, time) {
    this.value = value;
    this.calls.push({ value, time });
  }
  cancelScheduledValues() {}
}
class Node {
  constructor(context) {
    this.context = context;
    this.gain = new Param();
    this.frequency = new Param();
    this.Q = new Param();
    this.threshold = new Param();
    this.knee = new Param();
    this.ratio = new Param();
    this.connections = [];
    this.stopped = Infinity;
  }
  connect(node) {
    this.connections.push(node);
  }
  disconnect() {
    this.disconnected = true;
  }
  start(time) {
    this.started = time;
  }
  stop(time = this.context.currentTime) {
    this.stopped = time;
  }
}
class AudioContextFake {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.destination = {};
    this.sources = [];
    this.nodes = [];
    this.resumeCount = 0;
    this.suspendCount = 0;
  }
  node() {
    const n = new Node(this);
    this.nodes.push(n);
    return n;
  }
  createGain() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createDynamicsCompressor() {
    return this.node();
  }
  createWaveShaper() {
    return this.node();
  }
  createOscillator() {
    const n = this.node();
    this.sources.push(n);
    return n;
  }
  createBufferSource() {
    return this.createOscillator();
  }
  createBuffer(_channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  async resume() {
    this.resumeCount++;
    this.state = 'running';
  }
  async suspend() {
    this.suspendCount++;
    this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
  }
  advance(dt) {
    this.currentTime += dt;
    for (const s of this.sources)
      if (s.stopped <= this.currentTime && !s.ended) {
        s.ended = true;
        s.onended?.();
      }
  }
}
const setup = async (options = {}) => {
  const context = new AudioContextFake(),
    sound = new Soundscape({ ...options, contextFactory: () => context });
  await sound.enable();
  return { context, sound };
};

test('no context or sound is created before an explicit user audio action', async () => {
  let calls = 0;
  const sound = new Soundscape({
    contextFactory: () => {
      calls++;
      return new AudioContextFake();
    },
  });
  sound.update(true, {});
  sound.event('cells.claimed');
  assert.equal(calls, 0);
  assert.equal(await sound.toggle(), true);
  assert.equal(calls, 1);
  await sound.dispose();
});
test('all five styles have deterministic distinct original orchestration with bounded notes', () => {
  const signatures = [];
  for (const track of DEFAULT_TRACKS) {
    assert.equal(validateTrack(track).valid, true);
    const notes = Array.from({ length: 64 }, (_, i) => composeStep(track, i, 0.8));
    assert.deepEqual(
      notes,
      Array.from({ length: 64 }, (_, i) => composeStep(track, i, 0.8)),
    );
    assert.ok(notes.every((list) => list.length <= 10));
    for (const note of notes.flat()) {
      assert.ok(note.duration > 0 && note.duration < 5);
      assert.ok(note.volume > 0 && note.volume < 0.4);
      if (note.frequency) assert.ok(note.frequency >= 30 && note.frequency <= 5000);
    }
    signatures.push(JSON.stringify(notes));
  }
  assert.equal(new Set(signatures).size, MUSIC_STYLES.length);
});
test('scheduler preserves musical deadlines under frequent calls and avoids backlog bursts', () => {
  let cursor = null;
  const times = [];
  for (let now = 0; now < 2; now += 1 / 120) {
    const r = scheduleWindow(cursor, now, 120);
    cursor = r.cursor;
    times.push(...r.steps.map((s) => s.time));
  }
  for (let i = 1; i < times.length; i++)
    assert.ok(Math.abs(times[i] - times[i - 1] - 0.125) < 1e-8);
  const stalled = scheduleWindow(cursor, 900, 120);
  assert.ok(stalled.steps.length <= 4);
  assert.ok(stalled.steps.every((s) => s.time >= 900 && s.time <= 900.12));
  assert.throws(() => scheduleWindow(null, 0, 120, { ahead: Infinity }));
});
test('master/music/sfx buses are independently controlled and invalid changes are atomic', async () => {
  const { sound } = await setup();
  sound.configure({ master: 0.2, music: 0, sfx: 0.8 });
  assert.equal(sound.master.gain.value, 0.2);
  assert.equal(sound.musicBus.gain.value, 0);
  assert.equal(sound.sfxBus.gain.value, 0.8);
  const before = sound.getSettings();
  assert.throws(() => sound.configure({ master: 0.9, music: 2 }));
  assert.deepEqual(sound.getSettings(), before);
  sound.update(true, {});
  assert.equal(sound.voices.size, 0);
  sound.event('cells.claimed');
  assert.ok(sound.voices.size > 0);
  await sound.dispose();
});
test('track descriptors are copied, styles switch cleanly, and unsupported media are rejected', async () => {
  const { sound } = await setup(),
    track = { ...DEFAULT_TRACKS[3], id: 'custom', name: 'My metal track', tempo: 140 };
  sound.setTrack(track);
  track.root = 84;
  assert.notEqual(sound.track.root, 84);
  assert.equal(sound.getSettings().style, 'metal');
  sound.update(true, {});
  assert.ok(sound.voices.size > 0);
  sound.configure({ style: 'arcade-rock' });
  assert.equal(sound.getSettings().style, 'rock');
  assert.equal(sound.voices.size, 0);
  assert.throws(() => sound.setTrack({ ...track, url: 'remote.mp3' }));
  await sound.dispose();
});
test('pause cancels scheduled notes, freezes scheduling and resumes only through explicit method', async () => {
  const { sound, context } = await setup();
  sound.update(true, {});
  assert.ok(sound.voices.size);
  const count = context.sources.length;
  sound.pause();
  assert.equal(sound.voices.size, 0);
  assert.equal(context.state, 'suspended');
  context.advance(20);
  sound.update(true, {});
  assert.equal(context.sources.length, count);
  assert.equal(await sound.resume(), true);
  sound.update(true, {});
  assert.ok(context.sources.length > count);
  assert.ok([...sound.voices].every((v) => v.bus === 'music'));
  await sound.dispose();
});
test('adopting mute disables active preview immediately and ordinary resume cannot re-enable it', async () => {
  const { sound, context } = await setup();
  assert.equal(await sound.preview(), true);
  assert.ok(sound.voices.size > 0);
  const sources = context.sources.length,
    resumes = context.resumeCount;
  assert.equal(sound.disable(), false);
  assert.equal(sound.enabled, false);
  assert.equal(sound.previewActive, false);
  assert.equal(sound.voices.size, 0);
  assert.equal(sound.master.gain.value, 0);
  assert.equal(await sound.resume(), false);
  sound.update(true, {});
  sound.event('cells.claimed');
  assert.equal(context.sources.length, sources);
  assert.equal(context.resumeCount, resumes);
  assert.equal(await sound.enable(), true);
  sound.update(true, {});
  assert.ok(context.sources.length > sources);
  await sound.dispose();
});
test('mute needs no context and wins an in-flight preview enable', async () => {
  let calls = 0,
    finish;
  const context = new AudioContextFake();
  context.resume = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const sound = new Soundscape({
    contextFactory: () => {
      calls++;
      return context;
    },
  });
  assert.equal(sound.disable(), false);
  assert.equal(calls, 0);
  const pending = sound.preview();
  sound.disable();
  finish();
  assert.equal(await pending, false);
  assert.equal(sound.enabled, false);
  assert.equal(sound.previewActive, false);
  assert.equal(await sound.resume(), false);
  await sound.dispose();
});
test('terminal events distinguish victory and failure, stop backing music, and survive inactive update', async () => {
  const { sound, context } = await setup();
  sound.update(true, {});
  sound.event({ type: 'run.completed', won: true, tick: 1 });
  const victory = context.sources.slice(-9).map((s) => s.frequency.value);
  sound.update(false, {}, { status: 'won' });
  assert.ok([...sound.voices].some((v) => v.bus === 'sfx'));
  assert.equal(
    [...sound.voices].some((v) => v.bus === 'music'),
    false,
  );
  sound.reset();
  context.advance(2);
  sound.event({ type: 'run.completed', won: false, tick: 1 });
  const failure = context.sources.slice(-5).map((s) => s.frequency.value);
  assert.notDeepEqual(victory, failure);
  await sound.dispose();
});
test('polyphony is capped and event bursts deduplicate instead of allocating forever', async () => {
  const { sound, context } = await setup();
  for (let i = 0; i < 500; i++) sound.event('cells.claimed');
  assert.equal(context.sources.length, 3);
  for (let i = 0; i < 300; i++) sound.tone(440, 0.2, 0.02);
  assert.ok(sound.voices.size <= 64);
  context.advance(4);
  assert.equal(sound.voices.size, 0);
  await sound.dispose();
  assert.equal(context.state, 'closed');
  assert.equal(sound.context, null);
  assert.equal(await sound.toggle(), false);
});
test('failed autoplay resume reports disabled and disposal wins pending enable race', async () => {
  const context = new AudioContextFake();
  context.resume = async () => {
    throw new Error('gesture required');
  };
  const sound = new Soundscape({ contextFactory: () => context });
  assert.equal(await sound.enable(), false);
  assert.equal(sound.enabled, false);
  await sound.dispose();
  const delayed = new AudioContextFake();
  let finish;
  delayed.resume = () =>
    new Promise(
      (resolve) =>
        (finish = () => {
          delayed.state = 'running';
          resolve();
        }),
    );
  const second = new Soundscape({ contextFactory: () => delayed });
  const enabling = second.enable();
  await second.dispose();
  finish();
  assert.equal(await enabling, false);
  assert.equal(second.enabled, false);
});
test('tension is derived read-only and does not change the musical tempo or game state', () => {
  const state = {
      lives: 1,
      player: { cutting: true },
      trail: Array(24).fill(0),
      enemies: [{ bossPhase: 'warning' }],
    },
    before = structuredClone(state);
  assert.equal(deriveTension(state), 1);
  assert.equal(deriveTension({}), 0);
  assert.deepEqual(state, before);
  const low = composeStep(DEFAULT_TRACKS[0], 3, 0),
    high = composeStep(DEFAULT_TRACKS[0], 3, 1);
  assert.ok(high.length > low.length);
  assert.equal(DEFAULT_TRACKS[0].tempo, 108);
});
test('gesture preview plays from an inactive terminal screen and stops at its bounded deadline', async () => {
  const context = new AudioContextFake();
  const sound = new Soundscape({ contextFactory: () => context });
  sound.configure({ style: 'ambient' });
  assert.equal(await sound.preview({ seconds: 1 }), true);
  assert.equal(sound.enabled, true);
  assert.equal(sound.previewActive, true);
  assert.ok(sound.voices.size > 0);
  for (let n = 0; n < 10; n++) {
    context.advance(0.09);
    sound.update(
      false,
      { family: 'atlas' },
      { status: 'won', lives: 1, player: { cutting: true } },
    );
    assert.equal(sound.tension, 0);
  }
  assert.ok(context.sources.every((source) => source.stopped <= 1 + 1e-9));
  context.advance(0.11);
  const count = context.sources.length;
  sound.update(false, {}, { status: 'won' });
  assert.equal(sound.previewActive, false);
  assert.equal(sound.voices.size, 0);
  assert.equal(context.sources.length, count);
  assert.equal(sound.enabled, true);
  await assert.rejects(sound.preview({ seconds: 20 }), /duration/);
  await sound.dispose();
});
test('pause, reset, mute and disposal cancel preview without restarting after a delayed gesture', async () => {
  for (const cancel of ['pause', 'reset', 'toggle', 'dispose']) {
    const { sound } = await setup();
    await sound.preview();
    await sound[cancel]();
    assert.equal(sound.previewActive, false, cancel);
    assert.equal(sound.voices.size, 0, cancel);
    await sound.dispose();
  }
  const context = new AudioContextFake();
  let finish;
  context.resume = () =>
    new Promise((resolve) => {
      finish = () => {
        context.state = 'running';
        resolve();
      };
    });
  const sound = new Soundscape({ contextFactory: () => context });
  const pending = sound.preview();
  sound.reset();
  finish();
  assert.equal(await pending, false);
  assert.equal(sound.previewActive, false);
  assert.equal(context.sources.length, 0);
  await sound.dispose();
});

test('persistent soundtrack opt-in remains silent until an allowed audio action', async () => {
  let contexts = 0;
  const sound = new Soundscape({
    persistentMusic: true,
    contextFactory: () => {
      contexts++;
      return new AudioContextFake();
    },
  });
  sound.setTrack(DEFAULT_TRACKS[2], { atBoundary: true });
  sound.update(false, {}, { status: 'won' });
  sound.pause();
  sound.reset();
  assert.equal(await sound.resume(), false);
  assert.equal(contexts, 0);
  assert.equal(sound.musicState().active, false);
  assert.throws(() => new Soundscape({ persistentMusic: 'true' }), /boolean/);
  assert.equal(await sound.enable(), true);
  sound.update(false, {}, { status: 'ready' });
  assert.equal(contexts, 1);
  assert.equal(sound.musicState().active, true);
  assert.ok(sound.voices.size > 0);
  await sound.dispose();
});

test('persistent music survives menu, gameplay pause, terminal cues and attempt reset', async () => {
  const { sound, context } = await setup({ persistentMusic: true });
  sound.update(false, {}, { status: 'ready' });
  const initialMusic = [...sound.voices],
    initialCursor = { ...sound.cursor };
  sound.pause();
  assert.equal(context.state, 'running');
  assert.equal(context.suspendCount, 0);
  assert.deepEqual([...sound.voices], initialMusic);
  assert.deepEqual(sound.cursor, initialCursor);
  sound.event('cells.claimed');
  assert.deepEqual([...sound.voices], initialMusic);
  context.advance(0.3);
  sound.update(false, {}, { status: 'running', lives: 1, player: { cutting: true } });
  assert.ok(sound.cursor.index > initialCursor.index);
  assert.equal(sound.tension, 0);
  const pausedCursor = { ...sound.cursor };
  assert.equal(await sound.resume(), true);
  assert.equal(context.resumeCount, 1);
  assert.deepEqual(sound.cursor, pausedCursor);
  sound.update(true, {});
  sound.event('cut.started');
  assert.ok([...sound.voices].some((voice) => voice.bus === 'sfx'));
  for (const won of [true, false]) {
    const before = { ...sound.cursor },
      music = [...sound.voices].filter((voice) => voice.bus === 'music');
    sound.event({ type: 'run.completed', won, tick: won ? 10 : 20 });
    assert.ok([...sound.voices].some((voice) => voice.bus === 'sfx'));
    assert.ok(music.every((voice) => sound.voices.has(voice)));
    assert.deepEqual(sound.cursor, before);
    context.advance(0.15);
    sound.update(false, {}, { status: won ? 'won' : 'lost' });
    assert.equal(sound.musicState().active, true);
    assert.ok(sound.cursor.index > before.index);
    const after = { ...sound.cursor };
    sound.reset();
    assert.deepEqual(sound.cursor, after);
    assert.ok([...sound.voices].every((voice) => voice.bus === 'music'));
    sound.update(true, {});
  }
  await sound.dispose();
});

test('automatic authored tracks wait for a real song boundary and adopt the new tempo there', async () => {
  const { sound, context } = await setup({ persistentMusic: true });
  sound.update(true, {});
  const original = sound.musicState(),
    boundary = 0.025 + (SYNTH_SONG_STEPS * 60) / original.track.tempo / 4,
    selected = { ...DEFAULT_TRACKS[4], id: 'queued-ambient' };
  sound.setTrack(DEFAULT_TRACKS[1], { atBoundary: true });
  sound.setTrack(selected, { atBoundary: true });
  selected.tempo = 180;
  const snapshot = sound.musicState();
  snapshot.pendingTrack.root = 84;
  snapshot.track.name = 'external change';
  assert.equal(sound.musicState().pendingTrack.tempo, 72);
  assert.equal(sound.musicState().pendingTrack.root, DEFAULT_TRACKS[4].root);
  assert.deepEqual(sound.musicState().track, original.track);
  assert.equal(sound.musicState().step, original.step);
  let firstNewSources = null,
    oldSources = null;
  while (context.currentTime < boundary + 0.1) {
    const count = context.sources.length;
    context.advance(0.025);
    sound.update(true, {});
    if (sound.track.id === 'queued-ambient' && firstNewSources === null) {
      oldSources = context.sources.slice(0, count);
      firstNewSources = context.sources.slice(count);
      assert.ok(context.currentTime >= boundary - 0.12 - 1e-8);
    }
  }
  assert.ok(firstNewSources?.length > 0);
  assert.ok(firstNewSources.every((source) => Math.abs(source.started - boundary) < 1e-8));
  assert.ok(oldSources.every((source) => source.stopped <= boundary + 1e-8));
  assert.equal(sound.musicState().pendingTrack, null);
  assert.equal(sound.getSettings().style, 'ambient');
  const count = context.sources.length;
  while (context.currentTime < boundary + 1.3) {
    context.advance(0.025);
    sound.update(false, {}, { status: 'won' });
  }
  const bell = context.sources.slice(count).find((source) => source.type === 'sine');
  // Ambient's next note is six sixteenths after its first chord, at the new 72 BPM.
  assert.ok(bell);
  assert.ok(Math.abs(bell.started - (boundary + (6 * 60) / 72 / 4)) < 1e-8);
  await sound.dispose();
});

test('same authored context cancels a queued change without restart; explicit selection replaces it', async () => {
  const { sound, context } = await setup({ persistentMusic: true });
  sound.update(true, {});
  context.advance(0.3);
  sound.update(true, {});
  const cursor = { ...sound.cursor },
    sources = [...sound.voices];
  sound.setTrack(DEFAULT_TRACKS[1], { atBoundary: true });
  sound.setTrack({ ...DEFAULT_TRACKS[0] }, { atBoundary: true });
  assert.equal(sound.musicState().pendingTrack, null);
  assert.deepEqual(sound.cursor, cursor);
  assert.deepEqual([...sound.voices], sources);
  sound.setTrack(DEFAULT_TRACKS[1], { atBoundary: true });
  const before = sound.musicState();
  assert.throws(() => sound.setTrack(DEFAULT_TRACKS[2], { atBoundary: 'yes' }), /boolean/);
  assert.throws(() => sound.setTrack({ ...DEFAULT_TRACKS[2], url: 'track.mp3' }), /field/);
  assert.deepEqual(sound.musicState(), before);
  sound.event('cut.started');
  sound.setTrack(DEFAULT_TRACKS[3]);
  assert.equal(sound.musicState().track.id, DEFAULT_TRACKS[3].id);
  assert.equal(sound.musicState().pendingTrack, null);
  assert.equal(sound.cursor, null);
  assert.ok([...sound.voices].some((voice) => voice.bus === 'sfx'));
  assert.ok([...sound.voices].every((voice) => voice.bus === 'sfx'));
  sound.update(true, {});
  assert.equal(sound.cursor.index, 1);
  assert.ok([...sound.voices].some((voice) => voice.bus === 'music'));
  await sound.dispose();
});

test('persistent lifecycle suspension and mute silence sources but retain the musical position', async () => {
  const { sound, context } = await setup({ persistentMusic: true });
  sound.update(true, {});
  for (let i = 0; i < 20; i++) {
    context.advance(0.1);
    sound.update(true, {});
  }
  sound.setTrack(DEFAULT_TRACKS[3], { atBoundary: true });
  const step = sound.musicState().step,
    count = context.sources.length;
  sound.suspend();
  assert.equal(sound.voices.size, 0);
  assert.equal(sound.musicState().active, false);
  context.advance(900);
  sound.suspend();
  sound.update(false, {});
  assert.equal(context.sources.length, count);
  assert.equal(sound.musicState().step, step);
  assert.equal(await sound.resume(), true);
  sound.update(false, {});
  assert.ok(sound.musicState().step >= step && sound.musicState().step <= step + 1);
  assert.ok(context.sources.slice(count).every((source) => source.started >= 900));
  assert.equal(sound.musicState().pendingTrack.id, DEFAULT_TRACKS[3].id);
  const mutedStep = sound.musicState().step;
  sound.disable();
  assert.equal(sound.voices.size, 0);
  assert.equal(await sound.resume(), false);
  context.advance(90);
  assert.equal(await sound.enable(), true);
  sound.update(false, {});
  assert.ok(sound.musicState().step >= mutedStep && sound.musicState().step <= mutedStep + 1);
  assert.equal(sound.musicState().pendingTrack.id, DEFAULT_TRACKS[3].id);
  context.state = 'suspended';
  assert.equal(sound.musicState().active, false);
  await sound.dispose();
});

test('persistent lifecycle cancellation wins delayed audio enable and cannot publish late notes', async () => {
  for (const cancel of ['suspend', 'disable', 'dispose']) {
    const context = new AudioContextFake();
    let finish;
    context.resume = () =>
      new Promise((resolve) => {
        finish = () => {
          context.state = 'running';
          resolve();
        };
      });
    const sound = new Soundscape({ persistentMusic: true, contextFactory: () => context });
    const pending = sound.enable();
    await sound[cancel]();
    finish();
    assert.equal(await pending, false, cancel);
    sound.update(false, {}, { status: 'ready' });
    assert.equal(context.sources.length, 0, cancel);
    assert.equal(sound.musicState().active, false, cancel);
    await sound.dispose();
  }
});

test('persistent audition returns to the ongoing soundtrack without a cursor reset', async () => {
  const { sound, context } = await setup({ persistentMusic: true });
  sound.update(true, {});
  context.advance(0.5);
  sound.update(true, {});
  const step = sound.musicState().step;
  assert.equal(await sound.preview({ seconds: 1 }), true);
  assert.equal(sound.musicState().step, step);
  for (let i = 0; i < 15; i++) {
    context.advance(0.1);
    sound.update(false, {}, { status: 'won' });
  }
  assert.equal(sound.previewActive, false);
  assert.equal(sound.musicState().active, true);
  assert.ok(sound.musicState().step > step);
  assert.ok(sound.voices.size > 0);
  sound.pause();
  assert.equal(sound.previewActive, false);
  assert.equal(sound.musicState().active, true);
  await sound.dispose();
});

test('persistent scheduler remains bounded after a stall and only explicit music reset restarts it', async () => {
  const { sound, context } = await setup({ persistentMusic: true });
  sound.update(true, {});
  const step = sound.musicState().step;
  context.advance(900);
  const count = context.sources.length;
  sound.update(false, {});
  assert.ok(sound.musicState().step > step && sound.musicState().step <= step + 4);
  assert.ok(context.sources.length - count <= 40);
  assert.ok(context.sources.slice(count).every((source) => source.started >= 900));
  sound.update(true, {});
  sound.event('cut.started');
  sound.setTrack(DEFAULT_TRACKS[2], { atBoundary: true });
  sound.resetMusic();
  assert.equal(sound.cursor, null);
  assert.equal(sound.musicState().pendingTrack, null);
  assert.ok([...sound.voices].length > 0);
  assert.ok([...sound.voices].every((voice) => voice.bus === 'sfx'));
  sound.update(false, {});
  assert.equal(sound.cursor.index, 1);
  await sound.dispose();
});
