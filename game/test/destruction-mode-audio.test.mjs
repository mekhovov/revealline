import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverflightAudio } from '../overflight/audio.mjs';
import {
  createOverflightRun,
  startOverflight,
  spawnOverflightEnemy,
  damageOverflightArea,
} from '../overflight/core.mjs';
import { compileOverflightProject, createOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  spawnOverflightHuntEnemy,
} from '../overflight/raid-core.mjs';
import {
  compileOverflightHuntProject,
  createOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import { createClassicAudio } from '../snake/classic-audio.mjs';
import { FeedbackDirector } from '../ui/feedback-director.mjs';
import { destructionCategory } from '../ui/destruction-audio.mjs';

function recorder() {
  const calls = [];
  const sound = {
    encounter(cue, details) {
      calls.push({ cue, ...details });
    },
    event(event) {
      calls.push({ cue: event.type });
    },
    feedback() {},
    feedbackDirector: { reset() {} },
  };
  return { calls, sound };
}

test('Survivor mass clears keep every material family while bounding events and voices', () => {
  const compiled = structuredClone(compileOverflightProject(createOverflightProject()));
  compiled.encounters = [];
  const run = createOverflightRun(compiled);
  startOverflight(run);
  const families = ['runner', 'shield-bearer', 'utility-car', 'tracked-tank', 'radar-truck'];
  for (const family of families)
    for (let index = 0; index < 100; index++)
      assert.ok(
        spawnOverflightEnemy(run, {
          family,
          hp: 1,
          warning: 0,
          speed: 0,
          heavy: false,
          specialist: false,
          x: 700 + (index % 20),
          y: 400,
        }),
      );
  rebuildOverflightGrid(run._grid, run.enemies);
  assert.equal(damageOverflightArea(run, 710, 400, 150, 1000), 500);
  assert.equal(run.stats.kills, 500);
  const defeats = run.events.filter((event) => event.type === 'defeat');
  assert.equal(defeats.length, 5);
  assert.deepEqual(new Set(defeats.map((event) => event.family)), new Set(families));
  assert.ok(defeats.every((event) => event.count === 100));
  assert.equal(defeats.find((event) => event.family === 'tracked-tank').machine, 'tracked');
  const { sound, calls } = recorder();
  const audio = createOverflightAudio(sound);
  audio.update(run);
  audio.update(run);
  assert.equal(calls.filter((call) => call.cue === 'catch').length, 5);
  assert.deepEqual(
    new Set(calls.filter((call) => call.cue === 'catch').map(destructionCategory)),
    new Set(['soft', 'armored', 'light', 'heavy', 'electronic']),
  );
  assert.equal(damageOverflightArea(run, 710, 400, 150, 1000), 0);
  assert.equal(run.stats.kills, 500);
});

test('Raid accepts one sound per distinct casualty material despite its two semantic kill events', () => {
  const compiled = structuredClone(compileOverflightHuntProject(createOverflightHuntProject()));
  compiled.encounters = [];
  const run = createOverflightHuntRun(compiled);
  startOverflightHunt(run);
  for (const family of ['runner', 'brace-trooper'])
    spawnOverflightHuntEnemy(run, {
      family,
      behavior: 'patrol',
      speed: 0,
      warning: 0,
      x: run.player.x,
      y: run.player.y,
    });
  stepOverflightHunt(run);
  assert.equal(run.stats.kills, 2);
  assert.equal(run.events.filter((event) => event.type === 'defeat').length, 2);
  assert.equal(run.events.filter((event) => event.type === 'hunt-kill').length, 2);
  const { sound, calls } = recorder();
  const audio = createOverflightAudio(sound);
  audio.update(run);
  audio.update(run);
  assert.equal(calls.filter((call) => call.cue === 'catch').length, 2);
});

test('final destruction precedes results and cannot be replayed by result redraw', () => {
  const { sound, calls } = recorder();
  const audio = createOverflightAudio(sound);
  const run = {
    tick: 1,
    phase: 'won',
    player: { x: 50 },
    events: [
      { type: 'won' },
      { type: 'hunt-kill', family: 'tracked-tank', machine: 'tracked', x: 80 },
      { type: 'defeat', family: 'tracked-tank', machine: 'tracked', x: 80 },
    ],
  };
  audio.update(run);
  audio.update(run);
  assert.deepEqual(
    calls.map((call) => call.cue),
    ['catch', 'run.completed'],
  );
  assert.equal(destructionCategory(calls[0]), 'heavy');
});

test('shared main/Hunt/team event paths resolve soldier, machinery, captured hunter and core identities', () => {
  const { sound, calls } = recorder();
  const director = new FeedbackDirector(sound);
  const run = {
    width: 100,
    level: { hunt: { targets: [{ id: 'soldier', kind: 'shield-bearer' }] } },
    enemies: [
      { id: 'tank', type: 'eroder', x: 80 },
      { id: 'carrier', type: 'border-patrol', x: 10 },
      { id: 'hunter', type: 'hunter', bodyId: 'humanoid', family: 'runner', x: 30 },
      { id: 'sentinel', type: 'relay-sentinel', x: 45 },
    ],
    strongholds: [{ id: 'core', core: { x: 70 } }],
  };
  const events = [
    { type: 'combat.eliminated', id: 'soldier', x: 20, tick: 1 },
    { type: 'combat.eliminated', id: 'tank', tick: 1 },
    { type: 'combat.eliminated', id: 'carrier', tick: 1 },
    { type: 'enemy.defeated', enemy: 'hunter', tick: 1 },
    { type: 'encounter.defeated', id: 'sentinel', tick: 1 },
    { type: 'core.defeated', stronghold: 'core', tick: 1 },
    { type: 'core.defeated', stronghold: 'removed-core', tick: 1 },
    { type: 'enemy.defeated', enemy: 'recycled-soldier', family: 'runner', tick: 1 },
  ];
  director.events(events, run, {}, { board: 'team', getDestruction: () => ({ brutal: true }) });
  director.events(events, run, {}, { board: 'team' });
  assert.equal(calls.length, 8);
  assert.deepEqual(calls.map(destructionCategory), [
    'armored',
    'heavy',
    'heavy',
    'soft',
    'electronic',
    'electronic',
    'electronic',
    'soft',
  ]);
  assert.ok(calls.every((call) => call.cue === 'catch' && call.board === 'team' && call.brutal));
  assert.ok(calls[1].pan > 0 && calls[2].pan < 0);
});

test('Classic Snake simultaneous catches retain distinct materials and never replay restored catches', () => {
  const { sound, calls } = recorder();
  const audio = createClassicAudio(sound);
  const run = {
    tick: 0,
    elapsedMs: 0,
    catches: 0,
    pickupsUsed: 0,
    status: 'running',
    level: { id: 'materials', width: 24, height: 18 },
    snakes: [{ id: 0, alive: true, body: [{ x: 2, y: 3 }] }],
    shutters: [],
    targets: [],
    recentCatches: [],
  };
  audio.update(run);
  run.tick++;
  run.catches = 3;
  run.recentCatches = [
    { id: 'old', kind: 'relay-warden', x: 20, tick: 0 },
    { id: 'a', kind: 'runner', x: 5, tick: 1 },
    { id: 'b', kind: 'shield', x: 8, tick: 1 },
    { id: 'c', kind: 'runner', x: 10, tick: 1 },
  ];
  audio.update(run);
  audio.update(run);
  const catches = calls.filter((call) => call.cue === 'catch');
  assert.deepEqual(catches.map(destructionCategory), ['soft', 'armored']);
  audio.reset();
  audio.update(run);
  assert.equal(calls.filter((call) => call.cue === 'catch').length, 2);
});
