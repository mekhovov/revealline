import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { inspectQualificationReplayPortability } from './solo-qualification-replay.mjs';
import { validateQualification } from './solo-qualification.mjs';

const campaign = JSON.parse(
  await readFile(new URL('../game/content/campaign.json', import.meta.url)),
);

function observe(segments, options = { seed: 1, turnPolicy: 'immediate' }) {
  const level = campaign.levels[0],
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) {
      const input = { direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
    }
  const recording = exportReplay(recorder, run);
  const result = inspectQualificationReplayPortability(
    recording,
    {},
    { level: recording.level, options },
  );
  assert.equal(result.match, true);
  assert.equal(result.status, 'pass');
  assert.equal(run.status, 'running');
  assert.equal(run.lives, 3);
  return { recording, result };
}

test('accepted movement reversals exclude initial, repeated, neutral and blocked inputs', () => {
  const { recording, result } = observe([
    ['left', 60],
    ['left', 60],
    [null, 60],
    ['up', 60], // The unchanged mission starts on the top boundary.
    ['left', 60],
    ['right', 60],
    ['right', 60],
    ['left', 60],
  ]);
  assert.equal(result.features.directionChangesWithMovement, 2);
  assert.equal(
    inspectQualificationReplayPortability(recording, { directionChangesWithMovement: 2 }).status,
    'pass',
  );
  assert.equal(
    inspectQualificationReplayPortability(recording, { directionChangesWithMovement: 3 }).status,
    'fail',
  );
});

test('held boundary inputs never manufacture a moving reversal', () => {
  const { result } = observe([
    ['left', 600], // Includes a long stationary hold at the left boundary.
    ['up', 120],
    ['left', 120],
    ['right', 60],
  ]);
  assert.equal(result.features.directionChangesWithMovement, 1);
});

test('a queued grid-center turn counts only after its requested movement is accepted', () => {
  const options = { seed: 1, turnPolicy: 'grid-center' };
  const ignored = observe(
    [
      ['left', 1],
      ['down', 1],
      ['left', 1],
    ],
    options,
  );
  assert.equal(ignored.result.features.directionChangesWithMovement, 0);
  const accepted = observe(
    [
      ['left', 1],
      ['down', 30],
    ],
    options,
  );
  assert.equal(accepted.result.features.directionChangesWithMovement, 1);
});

test('real recovery and respawn displacement do not count as a fresh direction change', () => {
  const options = { seed: 1, turnPolicy: 'immediate' },
    level = campaign.levels[0],
    run = createRun(level, options),
    recorder = createRecorder(level, options),
    events = [];
  const tick = (direction) => {
    recordInput(recorder, { direction });
    stepRun(run, { direction }, FIXED_DT);
    events.push(...run.events);
  };
  for (const [direction, ticks] of [
    ['down', 60],
    ['right', 60],
    ['up', 30],
    ['left', 60],
  ])
    for (let index = 0; index < ticks; index++) tick(direction);
  assert.equal(events.filter((event) => event.type === 'player.failed').length, 1);
  assert.equal(events.find((event) => event.type === 'player.failed').cause, 'self-contact');
  for (let index = 0; index < 240 && run.status === 'respawning'; index++) tick(null);
  assert.equal(events.filter((event) => event.type === 'player.respawned').length, 1);
  assert.equal(run.status, 'running');
  assert.equal(run.lives, 2);
  const inspect = () => {
    const result = inspectQualificationReplayPortability(exportReplay(recorder, run));
    assert.equal(result.match, true);
    assert.equal(result.status, 'pass');
    return result.features.directionChangesWithMovement;
  };
  const before = inspect();
  for (let index = 0; index < 60; index++) tick('left');
  assert.equal(
    inspect(),
    before,
    'First accepted movement after recovery establishes its baseline.',
  );
  for (let index = 0; index < 60; index++) tick('right');
  assert.equal(inspect(), before + 1, 'A subsequent real reversal counts once.');
});

test('direction-change workload requirements retain the ordinary positive minimum rule', () => {
  const scenario = {
    format: 'SoloQualificationV1',
    id: 'meaningful-input-workload',
    kind: 'performance',
    timeoutMs: 10000,
    coverage: ['actual accepted movement reversals'],
    actions: [{ type: 'exportReplay' }],
    replayRequirements: { directionChangesWithMovement: 20 },
  };
  assert.doesNotThrow(() => validateQualification(scenario));
  assert.throws(() =>
    validateQualification({
      ...scenario,
      replayRequirements: { directionChangesWithMovement: 0 },
    }),
  );
});
