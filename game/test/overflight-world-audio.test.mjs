import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightAudio } from '../overflight/audio.mjs';
import { createOverflightWorldAudio } from '../overflight/world-audio.mjs';
import { worldAmbienceRecipe } from '../ui/world-ambience.mjs';
import { encounterSoundRecipe } from '../ui/encounter-audio.mjs';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

const run = () => ({
  tick: 0,
  time: 0,
  phase: 'playing',
  compiled: { presentation: { world: 'field-crossing' } },
  player: { x: 0, y: 0 },
  priorityAttacks: [],
  events: [],
});

test('three worlds have quiet, distinct bounded ambience using original shared recipes', () => {
  const recipes = ['field-crossing', 'freight-depot', 'relay-ruins'].map(worldAmbienceRecipe);
  assert.equal(new Set(recipes.map((recipe) => recipe.tone.filterFrequency)).size, 3);
  for (const recipe of recipes) {
    assert.equal(recipe.priority, 0);
    assert.equal(recipe.procedural, true);
    assert.ok(recipe.tone.gain <= 0.01);
    assert.equal(recipe.layers.length, 1);
    assert.ok(recipe.tone.duration < recipe.cooldown * 2);
  }
  assert.equal(worldAmbienceRecipe('unknown-legacy-world'), null);
});

test('atmosphere advances only on accepted gameplay time and foreground danger removes owned voices', () => {
  const calls = [],
    retired = [];
  const sound = {
    encounter: (...args) => calls.push(args),
    voices: [
      {
        ambience: true,
        board: 'overflight',
        stop: () => retired.push('ambience'),
      },
      { ambience: true, board: 'solo', stop: () => retired.push('other') },
      { board: 'overflight', stop: () => retired.push('rotor') },
    ],
  };
  const audio = createOverflightWorldAudio(sound),
    state = run();
  audio.update(state);
  audio.update(state);
  assert.equal(calls.length, 1);
  state.time = 1.24;
  audio.update(state);
  assert.equal(calls.length, 1);
  state.time = 1.25;
  audio.update(state);
  assert.equal(calls.length, 2);
  state.phase = 'paused';
  state.time = 100;
  audio.update(state);
  assert.equal(calls.length, 2);
  state.phase = 'playing';
  audio.update(state, { foreground: true });
  state.time = 100.5;
  audio.update(state);
  assert.equal(calls.length, 2);
  state.time = 100.75;
  audio.update(state);
  assert.equal(calls.length, 3);
  audio.suspend();
  audio.reset();
  assert.ok(retired.length > 0);
  assert.ok(retired.every((name) => name === 'ambience'));
});

test('warning charge follows actual remaining time, ignores active ground patches and cancelled/reused attacks', () => {
  const calls = [];
  const audio = createOverflightWorldAudio({
      encounter: (...args) => calls.push(args),
    }),
    state = run(),
    attack = {
      active: true,
      owner: 1,
      stage: 'warning',
      remaining: 1.4,
      x: 100,
      y: 0,
    };
  state.priorityAttacks = [attack];
  audio.update(state);
  attack.remaining = 0.69;
  audio.update(state);
  audio.update(state);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'warning-charge');
  assert.ok(calls[0][1].progress > 0.5);
  state.phase = 'upgrade';
  audio.update(state);
  assert.equal(calls.length, 1);
  state.phase = 'playing';
  attack.remaining = 0.27;
  audio.update(state);
  assert.equal(calls.length, 2);
  attack.stage = 'active';
  attack.remaining = 2;
  audio.update(state);
  assert.equal(calls.filter(([cue]) => cue === 'warning-charge').length, 2);
  attack.stage = 'warning';
  attack.owner = 2;
  attack.remaining = 1;
  audio.update(state);
  attack.active = false;
  audio.update(state);
  attack.active = true;
  attack.remaining = 1;
  audio.update(state);
  assert.equal(calls.filter(([cue]) => cue === 'warning-charge').length, 2);
  attack.remaining = 0.49;
  audio.update(state);
  assert.equal(calls.filter(([cue]) => cue === 'warning-charge').length, 3);
});

test('audible warning charge wins over a more advanced distant attack in either pool order', () => {
  for (const distantFirst of [false, true]) {
    const calls = [],
      audio = createOverflightWorldAudio({ encounter: (...args) => calls.push(args) }),
      state = run(),
      near = { active: true, owner: 1, stage: 'warning', remaining: 1, x: 100, y: 0 },
      far = { active: true, owner: 2, stage: 'warning', remaining: 1, x: 1000, y: 0 };
    delete state.compiled.presentation;
    state.priorityAttacks = distantFirst ? [far, near] : [near, far];
    audio.update(state);
    near.remaining = 0.45;
    far.remaining = 0.15;
    audio.update(state);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'warning-charge');
    assert.equal(calls[0][1].audible, true);
    assert.equal(calls[0][1].pan, 100 / 480);
    assert.equal(calls[0][1].progress, 0.55);
    audio.update(state);
    assert.equal(calls.length, 1, 'neither passed warning rung is queued for replay');
  }
});

test('two local warning rungs produce only the most urgent cue without delayed backlog', () => {
  const calls = [],
    audio = createOverflightWorldAudio({ encounter: (...args) => calls.push(args) }),
    state = run(),
    first = { active: true, owner: 1, stage: 'warning', remaining: 1, x: 100, y: 0 },
    second = { active: true, owner: 2, stage: 'warning', remaining: 1, x: -100, y: 0 };
  state.priorityAttacks = [first, second];
  audio.update(state);
  first.remaining = 0.45;
  second.remaining = 0.15;
  audio.update(state);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].pan, -100 / 480);
  assert.equal(calls[0][1].progress, 0.85);
  state.time = 0.3;
  audio.update(state);
  assert.equal(calls.length, 1);
  first.remaining = 0.15;
  audio.update(state);
  assert.equal(calls.length, 2, 'a newly crossed rung remains eligible');
  assert.equal(calls[1][1].pan, 100 / 480);
});

test('leaving warning range releases local ambience and escort feedback without replay on return', () => {
  const calls = [],
    audio = createOverflightWorldAudio({ encounter: (...args) => calls.push(args) }),
    state = run(),
    attack = { active: true, owner: 1, stage: 'warning', remaining: 1, x: 100, y: 0 };
  state.priorityAttacks = [attack];
  state.riy = { escorts: [{ role: 'breaker', shots: 0, x: 0, y: 0 }] };
  audio.update(state);
  state.player.x = 800;
  state.riy.escorts[0].x = 800;
  state.riy.escorts[0].shots++;
  state.time = 0.8;
  attack.remaining = 0.45;
  audio.update(state);
  assert.deepEqual(
    calls.map(([cue]) => cue),
    ['escort-shot', 'ambience'],
  );
  state.player.x = 0;
  state.riy.escorts[0].x = 0;
  audio.update(state);
  assert.equal(calls.length, 2, 'returning does not replay the rung crossed out of range');
  attack.remaining = 0.15;
  audio.update(state);
  assert.equal(calls.at(-1)[0], 'warning-charge');
});

test('inaudible foreground events do not consume nearby charge, escort or ambience opportunities', () => {
  for (const type of ['warning', 'arrival', 'armor-break']) {
    const calls = [],
      audio = createOverflightAudio({ encounter: (...args) => calls.push(args) }),
      state = run(),
      attack = { active: true, owner: 1, stage: 'warning', remaining: 1, x: 100, y: 0 };
    state.priorityAttacks = [attack];
    state.riy = { escorts: [{ role: 'breaker', shots: 0, x: 0, y: 0 }] };
    audio.update(state);
    state.tick++;
    state.time = 0.6;
    state.events = [{ type, x: 1000, y: 0 }];
    attack.remaining = 0.45;
    audio.update(state);
    assert.ok(calls.some(([cue, details]) => cue === 'warning-charge' && details.audible));
    attack.active = false;
    state.tick++;
    state.time = 1.4;
    state.riy.escorts[0].shots++;
    audio.update(state);
    assert.ok(calls.some(([cue]) => cue === 'escort-shot'));
    assert.ok(calls.some(([cue]) => cue === 'ambience'));
  }
});

test('local foreground damage suppresses a charge rung without a stale cue after it clears', () => {
  const calls = [],
    audio = createOverflightAudio({ encounter: (...args) => calls.push(args) }),
    state = run(),
    attack = { active: true, owner: 1, stage: 'warning', remaining: 1, x: 100, y: 0 };
  state.priorityAttacks = [attack];
  audio.update(state);
  state.tick++;
  attack.remaining = 0.45;
  state.events = [{ type: 'damage' }];
  audio.update(state);
  assert.deepEqual(
    calls.map(([cue]) => cue),
    ['impact'],
  );
  state.tick++;
  state.events = [];
  audio.update(state);
  assert.equal(calls.length, 1);
  state.tick++;
  attack.remaining = 0.15;
  audio.update(state);
  assert.equal(calls.at(-1)[0], 'warning-charge');
});

test('squad shots are distinct but share a cadence cap and cannot backlog through warnings', () => {
  const calls = [];
  const audio = createOverflightWorldAudio({
      encounter: (...args) => calls.push(args),
    }),
    state = run();
  delete state.compiled.presentation;
  state.riy = {
    escorts: [
      { role: 'sweeper', shots: 20, x: 0 },
      { role: 'breaker', shots: 15, x: 0 },
    ],
  };
  audio.update(state);
  assert.equal(calls.length, 0, 'restored shots are observed without replay');
  for (const escort of state.riy.escorts) escort.shots++;
  audio.update(state);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].role, 'sweeper');
  state.time = 0.65;
  state.riy.escorts[1].shots++;
  audio.update(state);
  assert.equal(calls[1][1].role, 'breaker');
  state.time = 2;
  state.riy.escorts[0].shots++;
  audio.update(state, { foreground: true });
  state.time = 3;
  audio.update(state);
  assert.equal(calls.length, 2, 'suppressed shots are never replayed');
  assert.notEqual(
    encounterSoundRecipe('escort-shot', { role: 'breaker' }).tone.from,
    encounterSoundRecipe('escort-shot', { role: 'sweeper' }).tone.from,
  );
});

test('simultaneous squad shots alternate roles without increasing the shared cadence', () => {
  const calls = [];
  const audio = createOverflightWorldAudio({ encounter: (...args) => calls.push(args) });
  const state = run();
  delete state.compiled.presentation;
  state.riy = { escorts: ['sweeper', 'breaker'].map((role) => ({ role, shots: 0, x: 0, y: 0 })) };
  audio.update(state);
  for (const time of [0, 0.2, 0.65, 0.9, 1.3]) {
    state.time = time;
    for (const escort of state.riy.escorts) escort.shots++;
    audio.update(state);
  }
  assert.deepEqual(
    calls.map(([, details]) => details.role),
    ['sweeper', 'breaker', 'sweeper'],
  );
  state.time = 2;
  audio.update(state);
  assert.equal(calls.length, 3, 'cadence-suppressed shots are not replayed');
  audio.reset();
  audio.update(state);
  for (const escort of state.riy.escorts) escort.shots++;
  audio.update(state);
  assert.equal(calls.at(-1)[1].role, 'sweeper', 'retry resets presentation history');
});

test('an inaudible escort cannot spend the local cue slot or replay its shot on return', () => {
  const calls = [];
  const audio = createOverflightWorldAudio({ encounter: (...args) => calls.push(args) });
  const state = run();
  delete state.compiled.presentation;
  state.riy = {
    escorts: [
      { role: 'sweeper', shots: 0, x: 900, y: 0 },
      { role: 'breaker', shots: 0, x: 0, y: 0 },
    ],
  };
  audio.update(state);
  for (const escort of state.riy.escorts) escort.shots++;
  audio.update(state);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].role, 'breaker');
  state.riy.escorts[0].x = 0;
  state.time = 1;
  audio.update(state);
  assert.equal(calls.length, 1);
});

test('shared mixer suppresses inaudible sources before cooldown admission in every board', async (t) => {
  const { soundscape: sound, sources } = audioHarness();
  t.after(() => sound.dispose());
  await sound.enable();
  for (const board of ['solo', 'team', 'snake', 'overflight', 'sim']) {
    assert.equal(sound.encounter('catch', { board, family: 'runner', audible: false }), false);
    assert.equal(sources.length, 0);
  }
  assert.equal(sound.encounter('catch', { board: 'overflight', family: 'runner' }), true);
});

test('atmosphere uses shared mute/pause/cleanup and yields immediately to warning foreground', async (t) => {
  const { soundscape: sound, context } = audioHarness();
  t.after(() => sound.dispose());
  assert.equal(sound.encounter('ambience', { world: 'field-crossing' }), false);
  assert.equal(sound.context, null);
  await sound.enable();
  assert.equal(
    sound.encounter('ambience', {
      world: 'field-crossing',
      board: 'overflight',
    }),
    true,
  );
  assert.equal([...sound.voices].filter((voice) => voice.ambience).length, 2);
  assert.ok([...sound.voices].every((voice) => voice.bus === 'sfx'));
  assert.equal(sound.encounter('warning-charge', { progress: 0.8 }), true);
  assert.equal([...sound.voices].filter((voice) => voice.ambience).length, 0);
  context.currentTime += 2;
  assert.equal(sound.encounter('ambience', { world: 'field-crossing' }), false);
  sound.stopVoices();
  sound.configure({ sfx: 0 });
  assert.equal(sound.encounter('ambience', { world: 'field-crossing' }), false);
  sound.configure({ sfx: 0.7 });
  assert.equal(sound.encounter('ambience', { world: 'field-crossing' }), true);
  sound.pause();
  assert.equal(sound.voices.size, 0);
  assert.equal(sound.encounter('ambience', { world: 'field-crossing' }), false);
});

test('armor changes reserve a short foreground window before later destruction reactions', async (t) => {
  const { soundscape: sound, context } = audioHarness();
  t.after(() => sound.dispose());
  await sound.enable();
  for (const name of Object.keys(EFFECT_BANK))
    sound.feedbackDirector.buffers.set(name, { duration: 0.5 });
  assert.equal(sound.encounter('reel', { semantic: 'armor-break' }), true);
  assert.equal(sound.humanReaction({ family: 'runner', vocals: true }), false);
  context.currentTime += 0.36;
  assert.equal(sound.humanReaction({ family: 'runner', vocals: true }), true);
});

test('cross-frame friendly impacts cannot mask player damage and each impact channel remains bounded', async (t) => {
  const { soundscape: sound, context } = audioHarness();
  t.after(() => sound.dispose());
  await sound.enable();
  for (const name of Object.keys(EFFECT_BANK))
    sound.feedbackDirector.buffers.set(name, { duration: 0.5 });
  const audio = createOverflightAudio(sound),
    state = run();
  delete state.compiled.presentation;
  state.events = [{ type: 'impact' }];
  audio.update(state);
  assert.ok([...sound.voices].some((voice) => voice.priority === 3));
  assert.equal(sound.humanReaction({ family: 'runner', vocals: true }), true);
  assert.ok([...sound.voices].some((voice) => voice.humanReaction));

  context.currentTime += 1 / 60;
  state.tick++;
  state.events = [{ type: 'damage' }];
  audio.update(state);
  assert.ok([...sound.voices].some((voice) => voice.priority === 5));
  assert.ok([...sound.voices].every((voice) => !voice.humanReaction || voice.ended));
  assert.equal(sound.humanReaction({ family: 'runner', vocals: true }), false);
  assert.equal(sound.encounter('impact', { board: 'overflight' }), false);
  assert.equal(
    sound.encounter('impact', { board: 'overflight', semantic: 'friendly-impact' }),
    false,
  );
  for (const semantic of ['player-damage', 'custom-1', 'custom-2'])
    assert.equal(sound.encounter('impact', { board: 'overflight', semantic }), false);

  context.currentTime += 0.13;
  assert.equal(sound.encounter('impact', { board: 'overflight' }), true);
  assert.equal(
    sound.encounter('impact', { board: 'overflight', semantic: 'friendly-impact' }),
    true,
  );
  assert.equal(sound.encounter('impact', { board: 'overflight' }), false);
});

test('native adapter admits damage and armor ahead of ordinary impacts while Classic remains independent of gore', () => {
  const heard = [];
  const audio = createOverflightAudio(
    { encounter: (...args) => heard.push(args) },
    {
      getDestruction: () => ({ brutal: true, vocals: false }),
    },
  );
  const state = run();
  state.events = ['impact', 'defeat', 'armor-break', 'hunt-blocked'].map((type) => ({ type }));
  audio.update(state);
  assert.deepEqual(
    heard.map(([cue]) => cue),
    ['blocked', 'reel', 'impact', 'catch'],
  );
  assert.equal(encounterSoundRecipe(...heard[0]).priority, 5);
  assert.equal(encounterSoundRecipe(...heard[1]).priority, 4);
  assert.equal(encounterSoundRecipe(...heard[2]).priority, 3);
  assert.ok(heard.every(([, details]) => details.brutal && details.vocals === false));
});
