import assert from 'node:assert/strict';
import test from 'node:test';
import { EFFECT_BANK } from '../audio/effects/bank.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { createOverflightAudio } from '../overflight/audio.mjs';
import { createClassicAudio } from '../snake/classic-audio.mjs';
import { classicTargetIdentity } from '../snake/classic-target-identity.mjs';

const voices = (sound) => [...sound.voices];
const reactions = (sound) => voices(sound).filter((voice) => voice.humanReaction);
const impacts = (sound) => voices(sound).filter((voice) => voice.name?.startsWith('destroy-'));
async function prepared(t) {
  const h = audioHarness();
  t.after(() => h.soundscape.dispose());
  await h.soundscape.enable();
  for (const name of Object.keys(EFFECT_BANK))
    h.soundscape.feedbackDirector.buffers.set(name, { duration: 0.4 });
  return h;
}

const hunt = { targets: [{ id: 'soldier', kind: 'humanoid' }] };
for (const [mode, definition] of [
  ['Solo / Hunt', { level: { hunt } }],
  ['Solo running enemies', { level: { runningEnemies: { hunt } } }],
  ['Team', { level: { classic: { hunt } } }],
  ['Versus', { definition: { classic: { hunt } } }],
  ['replay', { level: { hunt } }],
]) {
  test(`${mode} shares reactions/classic selection without enabling visual gore`, async (t) => {
    const h = await prepared(t);
    let settings = { brutal: false, vocals: true };
    h.soundscape.setDestructionPreferences(() => settings);
    const run = { width: 30, ...definition };
    const event = { type: 'combat.eliminated', id: 'soldier', tick: 1, x: 10 };
    const options = { board: mode, mode: mode === 'Versus' ? 'versus' : 'solo' };
    h.soundscape.events([event], run, {}, options);
    assert.equal(reactions(h.soundscape).length, 1);
    assert.equal(impacts(h.soundscape).length, 1);
    h.soundscape.stopVoices();
    settings = { ...settings, vocals: false };
    h.context.currentTime += 1;
    h.soundscape.events([{ ...event, tick: 2 }], run, {}, options);
    assert.equal(reactions(h.soundscape).length, 0);
    assert.equal(impacts(h.soundscape).length, 1, 'classic selection retains material impacts');
    h.soundscape.stopVoices();
    settings = { ...settings, vocals: true };
    h.context.currentTime += 1;
    h.soundscape.events([{ ...event, tick: 2 }], run, {}, options);
    assert.equal(voices(h.soundscape).length, 0, 'changing style cannot replay past deaths');
  });
}

test('explicit non-humanoid identity survives native shared event adaptation', async (t) => {
  const h = await prepared(t);
  h.soundscape.setDestructionPreferences(() => ({ vocals: true, brutal: false }));
  const run = {
    width: 30,
    enemies: [
      { id: 'fruit', family: 'runner', bodyId: 'fruit', x: 5 },
      { id: 'monster', family: 'guard', bodyId: 'monster', x: 8 },
      { id: 'tank', family: 'tracked-tank', x: 10 },
    ],
  };
  for (const [index, actor] of run.enemies.entries()) {
    h.context.currentTime += 1;
    h.soundscape.events([{ type: 'enemy.defeated', enemy: actor.id, tick: index }], run);
  }
  h.context.currentTime += 1;
  h.soundscape.events(
    [{ type: 'enemy.defeated', enemy: 'removed', family: 'runner', flesh: false, tick: 3 }],
    run,
  );
  assert.equal(reactions(h.soundscape).length, 0);
  assert.equal(impacts(h.soundscape).length, 4);
});

for (const mode of ['Survivor', 'Raid']) {
  test(`${mode} live defeats honor the shared sound choice and keep machinery nonverbal`, async (t) => {
    const h = await prepared(t);
    let settings = { brutal: false, vocals: true };
    const audio = createOverflightAudio(h.soundscape, { getDestruction: () => settings });
    const run = {
      tick: 1,
      phase: 'playing',
      player: { x: 100, y: 100 },
      events: [{ type: 'defeat', family: 'runner', x: 120, y: 100 }],
    };
    if (mode === 'Raid') run.events.push({ ...run.events[0], type: 'hunt-kill' });
    audio.update(run);
    audio.update(run);
    assert.equal(reactions(h.soundscape).length, 1);
    assert.equal(impacts(h.soundscape).length, 1, 'one casualty keeps one sound owner');
    h.soundscape.stopVoices();
    settings = { ...settings, vocals: false };
    h.context.currentTime += 1;
    run.tick++;
    audio.update(run);
    assert.equal(reactions(h.soundscape).length, 0);
    assert.equal(impacts(h.soundscape).length, 1);
    h.soundscape.stopVoices();
    settings = { ...settings, vocals: true };
    h.context.currentTime += 1;
    run.tick++;
    run.events = [{ type: 'defeat', family: 'tracked-tank', machine: 'tracked', x: 120, y: 100 }];
    audio.update(run);
    assert.equal(reactions(h.soundscape).length, 0);
    assert.equal(impacts(h.soundscape).length, 1);
  });
}

test('Classic Snake solo/team/versus catches share the selector; machinery follows its painted identity', async (t) => {
  const h = await prepared(t);
  let settings = { brutal: false, vocals: true },
    boardStyle = 'theme';
  const audio = createClassicAudio(h.soundscape, {
    getDestruction: () => settings,
    getBoardStyle: () => boardStyle,
  });
  for (const mode of ['solo', 'team', 'versus']) {
    const run = {
      tick: 0,
      elapsedMs: 0,
      catches: 0,
      status: 'running',
      level: { id: mode, width: 24, height: 18 },
      snakes: [{ id: 0, alive: true, body: [{ x: 2, y: 3 }] }],
      targets: [],
      shutters: [],
      recentCatches: [],
    };
    const options = { mode, board: mode };
    audio.update(run, { ...options, active: false });
    h.soundscape.stopVoices();
    h.context.currentTime += 1;
    run.tick++;
    run.catches++;
    run.recentCatches = [{ id: 'a', kind: 'humanoid', x: 3, tick: run.tick }];
    audio.update(run, options);
    assert.equal(reactions(h.soundscape).length, 1, mode);
    h.soundscape.stopVoices();
    settings = { ...settings, vocals: false };
    h.context.currentTime += 1;
    run.tick++;
    run.catches++;
    audio.update(run, options);
    assert.equal(reactions(h.soundscape).length, 0);
    assert.equal(impacts(h.soundscape).length, 1);
    settings = { ...settings, vocals: true };
    boardStyle = 'living-circuit';
    h.soundscape.stopVoices();
    h.context.currentTime += 1;
    run.tick++;
    run.catches++;
    run.recentCatches = [{ id: 'machine', kind: 'lane', x: 3, tick: run.tick }];
    audio.update(run, options);
    assert.equal(reactions(h.soundscape).length, 0);
    assert(impacts(h.soundscape).some((voice) => voice.name.startsWith('destroy-heavy')));
    boardStyle = 'theme';
    h.soundscape.stopVoices();
  }
  assert.deepEqual(classicTargetIdentity('lane', 'living-circuit'), {
    family: 'tracked-tank',
    humanoid: false,
    machine: 'tracked',
  });
  assert.equal(classicTargetIdentity('lane', 'theme').humanoid, true);
});

test('the shared preference applies to direct multiplayer encounters and cannot be bypassed by event facts', async (t) => {
  const h = await prepared(t);
  let settings = { vocals: false, brutal: false };
  h.soundscape.setDestructionPreferences(() => settings);
  h.soundscape.encounter('catch', { family: 'runner', vocals: true, board: 'room-0' });
  assert.equal(reactions(h.soundscape).length, 0);
  assert.equal(impacts(h.soundscape).length, 1);
  h.soundscape.stopVoices();
  settings = { ...settings, vocals: true };
  h.context.currentTime += 1;
  h.soundscape.encounter('catch', { family: 'runner', board: 'room-1' });
  assert.equal(reactions(h.soundscape).length, 1);
});
