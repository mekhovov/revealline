import {
  practiceAudioState,
  createPracticeAudio,
} from '../../optional-practice/civilian-flight/audio.mjs';
import { Soundscape } from '../ui/audio.mjs';
// Authored regression coverage; execution remains explicitly waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAudioOutput } from '../ui/audio-output.mjs';
import { encounterSoundRecipe, actorPhaseSound } from '../ui/encounter-audio.mjs';
import { createClassicAudio } from '../snake/classic-audio.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createWorldAudio } from '../../optional-practice/civilian-fpv/world-audio.mjs';

function contextHarness() {
  const made = [],
    parameters = () => ({
      value: 0,
      cancelScheduledValues() {},
      setValueAtTime(value) {
        this.value = value;
      },
      setTargetAtTime(value) {
        this.value = value;
      },
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
  const node = () => {
    const value = {
      gain: parameters(),
      frequency: parameters(),
      Q: parameters(),
      threshold: parameters(),
      knee: parameters(),
      ratio: parameters(),
      targets: [],
      connect(target) {
        this.targets.push(target);
        return target;
      },
      disconnect() {},
      start() {
        this.started = true;
      },
      stop() {
        this.stopped = true;
      },
    };
    made.push(value);
    return value;
  };
  const context = {
    currentTime: 0,
    state: 'suspended',
    sampleRate: 100,
    destination: {},
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
    createBufferSource: node,
    createDynamicsCompressor: node,
    createBuffer: (_, size) => ({ getChannelData: () => new Float32Array(size) }),
    async resume() {
      this.state = 'running';
    },
    async suspend() {
      this.state = 'suspended';
    },
    async close() {
      this.state = 'closed';
    },
  };
  return { context, made };
}

test('the shared graph routes movement through effects and dialogue through master', () => {
  const { context } = contextHarness(),
    output = createGameAudioOutput(context);
  assert.deepEqual(output.movementBus.targets, [output.sfxBus]);
  assert.deepEqual(output.sfxBus.targets, [output.master]);
  assert.deepEqual(output.dialogueBus.targets, [output.master]);
  assert.deepEqual(output.menuBus.targets, [output.master]);
  assert.deepEqual(output.master.targets, [output.compressor]);
});

test('family tells, supplies and machine impacts have bounded shared recipes', () => {
  assert.equal(actorPhaseSound('warning', 'warning'), null);
  assert.equal(actorPhaseSound(undefined, 'warning'), null);
  assert.equal(actorPhaseSound('walking', 'turning'), 'warning');
  assert.equal(actorPhaseSound('burst', 'rest'), 'recover');
  assert.notEqual(
    encounterSoundRecipe('warning', { family: 'runner' }).rate,
    encounterSoundRecipe('warning', { family: 'shield' }).rate,
  );
  assert.equal(encounterSoundRecipe('warning').priority, 5);
  assert.equal(encounterSoundRecipe('catch', { machine: true }).name, 'contact-metal');
  assert.equal(encounterSoundRecipe('catch').name, 'contact-soft');
  assert.notEqual(encounterSoundRecipe('pulse').name, encounterSoundRecipe('reel').name);
});

function snake() {
  return {
    tick: 0,
    elapsedMs: 0,
    status: 'running',
    catches: 0,
    pickupsUsed: 0,
    level: { id: 'audio-example', width: 24, height: 18 },
    snakes: [{ id: 0, alive: true, body: [{ x: 2, y: 3 }] }],
    targets: [{ id: 'runner-1', kind: 'runner', x: 5, y: 3, phase: 'walk' }],
    shutters: [{ id: 'gate', closed: false, warning: false }],
    recentCatches: [],
  };
}

test('Snake shares rotor/prey feedback and deduplicates catches, supplies and shutters', () => {
  const cues = [],
    projections = [];
  const sound = {
    encounter: (...cue) => cues.push(cue),
    feedback: (...args) => projections.push(args),
    feedbackDirector: { reset() {} },
  };
  const audio = createClassicAudio(sound),
    run = snake();
  audio.update(run, { mode: 'team' });
  run.tick = 1;
  run.catches = 1;
  run.recentCatches.push({ id: 'runner-1', kind: 'runner', x: 5, tick: 1 });
  run.shutters[0].warning = true;
  audio.update(run, { mode: 'team' });
  audio.update(run, { mode: 'team' });
  assert.deepEqual(
    cues.map(([name]) => name),
    ['catch', 'warning'],
  );
  assert.equal(projections.at(-1)[2].players[0].bodyId, 'fpv-scout-v1');
  assert.equal(projections.at(-1)[2].enemies[0].bodyId, 'humanoid');
  audio.reset();
  audio.update(run, { mode: 'team' });
  assert.equal(cues.length, 2, 'restore does not replay past catches');
  run.tick++;
  run.pickupsUsed++;
  run.events = [{ type: 'pickup.collected', pickup: { kind: 'pulse' } }];
  audio.update(run, { mode: 'team' });
  assert.equal(cues.at(-1)[0], 'pulse');
});

test('Snake observes mechanic cues at each simulation step without replaying duplicate events', () => {
  const cues = [];
  const audio = createClassicAudio({ encounter: (...cue) => cues.push(cue) });
  const run = snake();
  run.tick = 1;
  run.events = [{ type: 'target.warning', tick: 1, target: { kind: 'jammer', x: 4 } }];
  audio.events(run, { board: 'snake-1' });
  audio.events(run, { board: 'snake-1' });
  run.tick = 2;
  run.events = [
    { type: 'relay.collected', tick: 2, relay: { x: 5 } },
    { type: 'target.opened', tick: 2, target: { kind: 'relay', x: 7 } },
  ];
  audio.events(run);
  run.tick = 3;
  run.events = [{ type: 'target.warning', tick: 3, target: { kind: 'lane', x: 4 } }];
  audio.events(run, { active: false });
  audio.events(run);
  assert.deepEqual(
    cues.map(([cue]) => cue),
    ['warning', 'supply', 'objective'],
  );
  assert.equal(cues[0][1].board, 'snake-1');
  assert.equal(cues[0][1].family, 'jammer');
});

test('flight shares master mute, creates one context and sounds the terminal catch once', async () => {
  const { context, made } = contextHarness();
  let creations = 0;
  const values = new Map(),
    audioMaster = createAudioMaster({ muted: false, volume: 0.4 });
  const host = {
    AudioContext: function () {
      creations++;
      return context;
    },
    navigator: { audioSession: { type: 'auto' } },
    addEventListener() {},
    removeEventListener() {},
  };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const audio = createWorldAudio({ window: host, storage, audioMaster });
  assert.equal(creations, 0, 'construction cannot activate audio');
  await audio.resume();
  await audio.resume();
  assert.equal(creations, 1);
  assert.ok(audio.menuBus, 'menus reuse the flight context');
  const initial = { ticks: 0, step: 0, status: 'active', events: [], velocity: {}, contacts: 0 };
  audio.update(initial);
  const before = made.filter((node) => node.started).length;
  context.currentTime = 1;
  const final = {
    ...initial,
    ticks: 1,
    status: 'complete',
    events: [{ type: 'catch', actor: 'runner' }],
  };
  audio.update(final, { active: false });
  const after = made.filter((node) => node.started).length;
  assert.equal(after, before + 1);
  audio.update(final, { active: false });
  assert.equal(made.filter((node) => node.started).length, after);
  audioMaster.setMuted(true);
  assert.equal(audio.enabled(), false);
  assert.equal(host.navigator.audioSession.type, 'playback');
  audio.pause();
  assert.equal(host.navigator.audioSession.type, 'auto');
  audio.dispose();
});

test('offline encounter fallback retains its sweep and paired-board stereo position', () => {
  const notes = [],
    sound = {
      context: { currentTime: 1, state: 'running' },
      enabled: true,
      paused: false,
      gameplayPaused: false,
      audioMaster: { muted: false, volume: 1 },
      settings: { master: 1, sfx: 1 },
      recentEvents: new Map(),
      feedbackDirector: { play: () => null },
      play(note) {
        notes.push(note);
        return true;
      },
    };
  assert.equal(
    Soundscape.prototype.encounter.call(sound, 'catch', { board: 'left', pan: -0.5 }),
    true,
  );
  assert.equal(notes[0].pan, -0.5);
  assert.notEqual(notes[0].frequency, notes[0].endFrequency);
  assert.equal(
    Soundscape.prototype.encounter.call(sound, 'catch', { board: 'left', pan: -0.5 }),
    false,
  );
  sound.audioMaster.muted = true;
  assert.equal(Soundscape.prototype.encounter.call(sound, 'warning', { board: 'right' }), false);
});

test('kinematic gym projection shares sound without adding physics or changing native units', () => {
  const source = { ticks: 2, x: 120, z: 250, altitude: 30, checkpoint: 1, status: 'active' };
  const before = { ...source, ticks: 1, x: 112, altitude: 25 },
    original = structuredClone(source);
  const projected = practiceAudioState(source, before, { pitch: 1 });
  assert.deepEqual(projected.position, { x: 1200, y: 300, z: 2500 });
  assert.equal(projected.velocity.x, 1600);
  assert.equal(projected.step, 1);
  assert.deepEqual(source, original);
  const heard = [];
  const audio = createPracticeAudio({
    createAudio: () => ({
      update: (...args) => heard.push(args),
      pause() {},
      setCourse() {},
    }),
  });
  audio.update(source);
  assert.equal(heard[0][1].active, true);
  audio.update({ ...source, ticks: 3, status: 'complete', checkpoint: 2 });
  assert.equal(heard[1][0].step, 2);
  assert.equal(heard[1][1].active, false);
});

test('procedural encounter voices belong to the same Pause/Retry cleanup as samples', () => {
  const { context } = contextHarness();
  context.state = 'running';
  const sound = new Soundscape({ contextFactory: () => context });
  sound.setup();
  sound.enabled = true;
  sound.feedbackDirector.play = () => null;
  sound.encounter('warning', { board: 'snake-0' });
  const voice = [...sound.voices][0];
  assert.equal(voice.feedback, true);
  assert.equal(voice.name, 'warning');
  assert.equal(voice.priority, 5);
  assert.ok(voice.source);
  sound.feedbackDirector.reset();
  assert.equal(sound.voices.size, 0);
  assert.equal(voice.ended, true);
});

test('native flight movement accents use accepted vehicle material and prime restored observations', async () => {
  const { context, made } = contextHarness(),
    audioMaster = createAudioMaster({ muted: false, volume: 0.4 }),
    storage = { getItem: () => null, setItem() {} },
    host = {
      AudioContext: function () {
        return context;
      },
      addEventListener() {},
      removeEventListener() {},
    },
    audio = createWorldAudio({ window: host, storage, audioMaster });
  const course = { actors: [{ id: 'tank', type: 'vehicle', vehicleModel: 'field-tank' }] };
  audio.setCourse(course);
  await audio.resume();
  const state = {
    ticks: 0,
    step: 0,
    status: 'active',
    events: [],
    contacts: 0,
    velocity: {},
    position: { x: 0, y: 0, z: 0 },
    actors: [{ id: 'tank', type: 'vehicle', status: 'active', position: { x: 1000, y: 0, z: 0 } }],
  };
  const initial = made.filter((node) => node.started).length;
  audio.update(state);
  assert.equal(made.filter((node) => node.started).length, initial);
  context.currentTime = 1;
  state.ticks++;
  state.actors[0].position.x += 100;
  const original = structuredClone(state);
  audio.update(state);
  assert.deepEqual(state, original);
  const newSources = made.filter((node) => node.started).slice(initial);
  assert.equal(newSources.length, 1);
  assert.equal(
    newSources[0].frequency.value,
    encounterSoundRecipe('drive', { machine: 'tracked', family: 'lookout' }).tone.from,
  );
  audio.update(state);
  assert.equal(made.filter((node) => node.started).length, initial + 1);
  context.currentTime = 2.3;
  state.ticks++;
  state.actors[0].position.x += 100;
  audio.update(state);
  assert.equal(
    made.filter((node) => node.started).length,
    initial + 1,
    'continuous drive does not retrigger an onset',
  );
  audio.setCourse(course);
  audio.update(state);
  assert.equal(
    made.filter((node) => node.started).length,
    initial + 1,
    'restored positions are only observed',
  );
  audio.dispose();
});
