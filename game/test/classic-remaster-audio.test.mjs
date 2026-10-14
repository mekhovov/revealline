import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassicAudio } from '../snake/classic-audio.mjs';

const board = () => ({
  tick: 0,
  elapsedMs: 0,
  status: 'running',
  catches: 0,
  bonusCatches: 0,
  level: {
    id: 'sound-test',
    width: 24,
    height: 18,
    stepMs: 200,
    targets: { required: [{ signalProfile: 'broadcast-burst-v1' }] },
  },
  snakes: [{ id: 'p1', alive: true, body: [{ x: 2, y: 2 }] }],
  targets: [
    { id: 'jammer', kind: 'jammer', x: 10, y: 10, policyIndex: 0, phase: 'jamming', phaseTicks: 4 },
  ],
  pulseTicks: 0,
  events: [],
});
test('interference suppresses enemy audio positions but keeps warning and cargo cues', () => {
  let projection;
  const cues = [];
  const audio = createClassicAudio({
    feedback(_active, _family, state) {
      projection = state;
    },
    encounter(cue, options) {
      cues.push({ cue, ...options });
    },
  });
  const run = board();
  audio.update(run);
  assert.equal(projection.enemies.length, 0);
  run.tick++;
  run.events = [
    { type: 'target.warning', tick: 1, target: { kind: 'guard', x: 8, y: 5 } },
    { type: 'target.warning', tick: 1, target: { kind: 'runner', x: 23, y: 5 } },
    { type: 'target.opened', tick: 1, target: { kind: 'relay', x: 0, y: 5 } },
    { type: 'cargo.collected', tick: 1 },
    { type: 'cargo.delivered', tick: 1 },
  ];
  audio.events(run);
  audio.events(run);
  assert.deepEqual(
    cues.map((c) => c.cue),
    ['warning', 'warning', 'objective', 'supply', 'objective'],
  );
  assert.ok(cues.slice(0, 3).every((cue) => cue.pan === 0));
  run.targets[0].phase = 'recovery';
  audio.update(run);
  assert.equal(projection.enemies.length, 1);
  run.targets[0].phase = 'jamming';
  run.pulseTicks = 3;
  audio.update(run);
  assert.equal(projection.enemies.length, 1);
});

test('a catch during interference has no directional or vocal position cue', () => {
  const cues = [];
  const audio = createClassicAudio({
    feedback() {},
    encounter(cue, options) {
      cues.push({ cue, ...options });
    },
    event(options) {
      cues.push(options);
    },
  });
  const run = board();
  audio.update(run);
  run.tick = 1;
  run.catches = 1;
  run.recentCatches = [{ kind: 'runner', x: 23, y: 0, tick: 1 }];
  audio.update(run);
  assert.equal(cues.find((c) => c.cue === 'catch').pan, 0);
  assert.equal(cues.find((c) => c.cue === 'catch').vocals, false);
  assert.equal(cues.find((c) => c.type === 'pickup.collected').pan, 0);
});
