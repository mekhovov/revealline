import {
  practiceAudioState,
  createPracticeAudio,
} from '../../optional-practice/civilian-flight/audio.mjs';
import { Soundscape } from '../ui/audio.mjs';
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
      disconnect() {
        this.disconnected = true;
      },
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

test('the shared graph routes effects and dialogue through the gameplay stage, with music independent', () => {
  const { context } = contextHarness(),
    output = createGameAudioOutput(context);
  assert.deepEqual(output.movementBus.targets, [output.sfxBus]);
  assert.deepEqual(output.sfxBus.targets, [output.gameplayBus]);
  assert.deepEqual(output.dialogueBus.targets, [output.gameplayBus]);
  assert.deepEqual(output.menuBus.targets, [output.gameplayBus]);
  assert.deepEqual(output.gameplayBus.targets, [output.master]);
  assert.deepEqual(output.musicBus.targets, [output.master]);
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
  assert.equal(encounterSoundRecipe('catch', { machine: true }).name, 'destroy-light');
  assert.equal(encounterSoundRecipe('catch').name, 'destroy-soft');
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
  assert.equal(after, before + 1 + encounterSoundRecipe('catch').layers.length);
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
      voices: new Set(),
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
    encounterSoundRecipe('drive', { machine: 'tracked', family: 'tracked-tank' }).tone.from,
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

test('optional FPV flight retains all five destruction materials in one transaction with a bounded native output', async () => {
  const { context, made } = contextHarness();
  const master = createAudioMaster({ muted: false, volume: 0.4 });
  const host = {
    AudioContext: function () {
      return context;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const storage = { getItem: () => null, setItem() {} };
  const audio = createWorldAudio({ window: host, storage, audioMaster: master });
  audio.setCourse({
    actors: [
      { id: 'runner', type: 'patrol' },
      { id: 'shield', type: 'patrol' },
      { id: 'car', type: 'vehicle', vehicleModel: 'field-utility' },
      { id: 'tank', type: 'vehicle', vehicleModel: 'field-tank' },
      { id: 'radar', type: 'vehicle', vehicleModel: 'relay-truck' },
    ],
    pursuit: {
      actors: [
        { id: 'runner', family: 'runner' },
        { id: 'shield', family: 'shield-bearer' },
      ],
    },
  });
  await audio.resume();
  const snapshot = { ticks: 0, step: 0, status: 'active', events: [], velocity: {}, contacts: 0 };
  audio.update(snapshot);
  const before = made.filter((node) => node.started).length;
  context.currentTime = 1;
  snapshot.ticks++;
  snapshot.events = Array.from({ length: 400 }, () => ({ type: 'defeat', actor: 'runner' }));
  snapshot.events.push(
    ...['shield', 'car', 'tank', 'radar'].map((actor) => ({ type: 'defeat', actor })),
  );
  snapshot.events.push({ type: 'catch', actor: 'runner' });
  const unchanged = structuredClone(snapshot);
  audio.update(snapshot);
  const created = made.filter((node) => node.started).slice(before);
  assert.equal(created.length, 10, 'five tone/noise pairs, independent of the 405 events');
  assert.equal(created.filter((node) => node.buffer).length, 5);
  assert.equal(
    new Set(created.filter((node) => !node.buffer).map((node) => node.frequency.value)).size,
    5,
  );
  audio.update(snapshot);
  assert.equal(made.filter((node) => node.started).length, before + 10);
  assert.deepEqual(snapshot, unchanged, 'audio never mutates simulation');
  // The remaining two effect slots keep warning cues available during a mass clear.
  snapshot.ticks++;
  snapshot.events = [{ type: 'warning', actor: 'shield' }];
  audio.update(snapshot);
  assert.equal(made.filter((node) => node.started).length, before + 11);
  audio.pause();
  assert.ok(
    created.every((node) => node.stopped),
    'pause releases every destruction layer',
  );
  audio.dispose();
  master.dispose();
});

test('combat event IDs deduplicate across ticks, restore silently, and keep victim materials and vocals separate', async () => {
  const { context, made } = contextHarness();
  context.decodeAudioData = async () => ({
    duration: 0.5,
    length: 2,
    sampleRate: 4,
    numberOfChannels: 1,
    isVoice: true,
    getChannelData: () => Float32Array.from([0.1, -0.1]),
  });
  const master = createAudioMaster({ muted: false, volume: 0.4 });
  const prefs = { brutal: true, vocals: true };
  const audio = createWorldAudio({
    window: {
      AudioContext: function () {
        return context;
      },
      addEventListener() {},
      removeEventListener() {},
    },
    storage: { getItem: () => null, setItem() {} },
    audioMaster: master,
    getDestruction: () => prefs,
  });
  const state = {
    ticks: 0,
    step: 0,
    status: 'active',
    events: [],
    contacts: 0,
    velocity: {},
    position: { x: 0, y: 0, z: 0 },
    actors: [],
  };
  try {
    await audio.resume();
    await Promise.resolve();
    audio.update(state);
    const human = {
      eventId: 'run:1',
      type: 'defeat',
      actor: 'spawn-human',
      sourceId: 'human',
      material: 'organic',
      appearance: { family: 'courier', cast: 'arcade', type: 'patrol' },
    };
    state.ticks = 1;
    context.currentTime = 1;
    state.events = [human];
    audio.update(state);
    const voice = made.find((node) => node.started && node.buffer?.isVoice);
    assert.ok(voice, 'accepted humanoid defeat uses the decoded shared voice bank');
    const count = made.filter((node) => node.started).length;
    state.ticks++;
    context.currentTime = 2;
    audio.update(state);
    assert.equal(
      made.filter((node) => node.started).length,
      count,
      'same event cannot replay on a later tick',
    );
    prefs.vocals = false;
    audio.update(state);
    assert.equal(voice.stopped, true, 'turning vocals off stops an already playing reaction');
    prefs.vocals = true;
    state.ticks++;
    context.currentTime = 3;
    state.events = [
      {
        ...human,
        eventId: 'run:2',
        actor: 'spawn-machine',
        material: 'electronic',
        appearance: { family: 'courier', type: 'prop' },
      },
    ];
    audio.update(state);
    assert.equal(
      made.filter((node) => node.started && node.buffer?.isVoice).length,
      1,
      'electronic props never inherit a humanoid voice from their family fallback',
    );
    const tones = made.filter((node) => node.started && !node.buffer);
    assert.equal(
      tones.at(-1).frequency.value,
      encounterSoundRecipe('catch', { category: 'electronic' }).tone.from,
    );
    audio.setCourse({});
    state.ticks = 50;
    state.events = [{ ...human, eventId: 'restore:50' }];
    const restoredCount = made.filter((node) => node.started).length;
    audio.update(state);
    state.ticks++;
    context.currentTime = 5;
    audio.update(state);
    assert.equal(
      made.filter((node) => node.started).length,
      restoredCount,
      'restoring a prior event primes its identity without replay',
    );
    state.ticks++;
    state.events = [{ eventId: 'restore:52', type: 'player-damage' }];
    audio.update(state);
    assert.ok(
      made.filter((node) => node.started).length > restoredCount,
      'accepted player damage remains audible',
    );
  } finally {
    audio.dispose();
    master.dispose();
  }
});

test('both live graph owners apply mono after activation, keep music separate and dispose the stage', async () => {
  for (const family of ['soundscape', 'world', 'gym']) {
    const { context, made } = contextHarness(),
      values = new Map(),
      writes = [];
    let contexts = 0,
      resumes = 0;
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        writes.push(key);
        values.set(key, value);
      },
    };
    context.resume = async () => {
      resumes++;
      context.state = 'running';
    };
    const host = {
      localStorage: storage,
      AudioContext: function () {
        contexts++;
        return context;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    const audioMaster = createAudioMaster({ muted: false, volume: 0.4 });
    const audio =
      family === 'soundscape'
        ? new Soundscape({
            window: host,
            getStorage: () => storage,
            audioMaster,
            contextFactory: () => {
              contexts++;
              return context;
            },
          })
        : family === 'world'
          ? createWorldAudio({ window: host, storage, audioMaster })
          : createPracticeAudio({
              window: host,
              createAudio: (options) => createWorldAudio({ ...options, audioMaster }),
            });
    audio.gameplayOutput.choose(true);
    assert.equal(audio.gameplayOutput.snapshot().status, 'inactive');
    assert.equal(contexts, 0, `${family}: selecting mono must not construct a context`);
    assert.equal(resumes, 0);
    if (family === 'soundscape') await audio.enable();
    else await audio.resume();
    assert.equal(contexts, 1);
    assert.equal(audio.gameplayOutput.snapshot().status, 'mono');
    const stage = made.find(
      (node) => node.channelCountMode === 'explicit' && node.channelCount === 1,
    );
    assert.ok(stage);
    assert.equal(
      made.filter((node) => node.targets.includes(stage)).length,
      3,
      'SFX, menu and voice stage inputs.',
    );
    const master = stage.targets[0],
      masterBefore = master.gain.value;
    assert.equal(
      made.filter((node) => node.targets.includes(master)).length,
      2,
      'Independent music and gameplay buses.',
    );
    const edges = made.map((node) => [...node.targets]);
    const started = made.filter((node) => node.started).length,
      beforeResumes = resumes;
    audio.gameplayOutput.choose(false);
    assert.equal(stage.channelCountMode, 'max');
    assert.equal(master.gain.value, masterBefore);
    assert.deepEqual(
      made.map((node) => node.targets),
      edges,
    );
    assert.equal(made.filter((node) => node.started).length, started);
    assert.equal(resumes, beforeResumes);
    assert.deepEqual(writes, [
      'revealline.gameplay-audio-output.v1',
      'revealline.gameplay-audio-output.v1',
    ]);
    await audio.dispose();
    assert.equal(stage.disconnected, true);
    assert.equal(context.state, 'closed');
    audio.gameplayOutput.choose(true);
    assert.equal(writes.length, 2);
    audioMaster.dispose();
  }
});

test('v2 weapons and reload states have distinct bounded deterministic audio without changing legacy fire', () => {
  const profiles = ['autocannon', 'scatter', 'precision', 'rocket'].map((weapon) =>
    encounterSoundRecipe('fire', { weapon, eventId: 'shot-42' }),
  );
  assert.equal(new Set(profiles.map((p) => p.name)).size, 4);
  assert.equal(new Set(profiles.map((p) => p.tone.from)).size, 4);
  for (const profile of profiles) {
    assert.ok(profile.layers.length <= 2);
    assert.ok(profile.tone.duration < 0.5);
    assert.ok(profile.priority < 5, 'incoming warning voices retain precedence');
  }
  assert.deepEqual(
    profiles[0],
    encounterSoundRecipe('fire', { weapon: 'autocannon', eventId: 'shot-42' }),
  );
  assert.equal(
    encounterSoundRecipe('fire').name,
    'attack',
    'historical v1 fire recipe remains available',
  );
  assert.equal(encounterSoundRecipe('player-damage', { weapon: 'rocket' }).priority, 5);
  assert.equal(encounterSoundRecipe('player-damage', { weapon: 'rocket' }).name, 'hull-damage');
  const states = [
    'reload-start',
    'reload-ready',
    'weapon-empty',
    'weapon-selected',
    'payload',
    'payload-armed',
    'payload-ready',
    'explosion',
    'component',
    'repair',
    'resupply',
  ];
  assert.equal(
    new Set(states.map((type) => encounterSoundRecipe(type, { weapon: 'rocket' }).name)).size,
    states.length,
  );
});

test('v2 crowd shots cannot exhaust the incoming warning reserve, and reload events are not replayed after pause', async () => {
  const { context, made } = contextHarness();
  const audioMaster = createAudioMaster({ muted: false, volume: 0.5 });
  const audio = createWorldAudio({
    audioMaster,
    window: {
      AudioContext: function () {
        return context;
      },
      addEventListener() {},
      removeEventListener() {},
    },
    storage: { getItem: () => null, setItem() {} },
  });
  try {
    await audio.resume();
    const base = {
      ticks: 0,
      status: 'active',
      position: { x: 0, y: 0, z: 0 },
      velocity: {},
      contacts: 0,
      events: [],
    };
    audio.update(base);
    const staticVoices = made.filter((n) => n.started && !n.stopped).length;
    for (let i = 1; i <= 20; i++) {
      context.currentTime += 0.15;
      audio.update({
        ...base,
        ticks: i,
        events: [{ type: 'fire', actor: 'player', eventId: `fire:${i}`, weapon: 'autocannon' }],
      });
    }
    assert.ok(made.filter((n) => n.started && !n.stopped).length <= staticVoices + 10);
    context.currentTime += 0.2;
    const beforeWarning = made.filter((n) => n.started).length;
    audio.update({
      ...base,
      ticks: 21,
      events: [{ type: 'telegraph', actor: 'enemy', eventId: 'warning:21' }],
    });
    assert.ok(made.filter((n) => n.started).length > beforeWarning);
    assert.ok(made.filter((n) => n.started && !n.stopped).length <= staticVoices + 12);
    const paused = {
      ...base,
      ticks: 22,
      status: 'paused',
      events: [{ type: 'reload-ready', eventId: 'reload:22', weapon: 'precision' }],
    };
    audio.update(paused, { active: false });
    const beforeResume = made.filter((n) => n.started).length;
    context.currentTime += 1;
    audio.update({ ...paused, ticks: 23, status: 'active' });
    assert.equal(made.filter((n) => n.started).length, beforeResume);
  } finally {
    await audio.dispose();
    audioMaster.dispose();
  }
});
