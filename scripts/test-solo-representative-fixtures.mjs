import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { normalizedLevel } from '../game/core/level.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { validateScenario } from '../game/content.mjs';
import { createFractureCandidates } from '../game/content-design/fracture-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { validateQualification } from './solo-qualification.mjs';
import { inspectQualificationReplayPortability } from './solo-qualification-replay.mjs';

const root = new URL('../docs/performance/fixtures/solo-representative/', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root)));
const fracture = await read('first-fracture.qualification.fixture');
const fractureUpload = await read('first-fracture.xonix.fixture');
const neutral = await read('signal-07-neutral.qualification.fixture');
const steering = await read('signal-07-steering.qualification.fixture');
const signalUpload = JSON.parse(
  await readFile(
    new URL(
      '../docs/performance/fixtures/solo-remote-auxiliary/signal-07.xonix.fixture',
      import.meta.url,
    ),
  ),
);
const campaign = JSON.parse(
  await readFile(new URL('../game/content/campaign.json', import.meta.url)),
);
const pinned = {
  'first-fracture.qualification.fixture':
    '3e2c56b4c5aae3343986a8a68d39e402a9822f66093c6556b99042e24947604e',
  'first-fracture.xonix.fixture':
    '312d005cf9f548804016ed08afd4688187a76249de174bae9a534beb472934b4',
  'signal-07-neutral.qualification.fixture':
    'aa2cbdbba30450e296b75f7458afa101dcd6ad0bc5858dd2de5ffc2dcc1e2c34',
};

test('retained erosion and neutral jammer recipes keep their original exact bytes', async () => {
  for (const [name, expected] of Object.entries(pinned))
    assert.equal(
      createHash('sha256')
        .update(await readFile(new URL(name, root)))
        .digest('hex'),
      expected,
    );
  for (const fixture of [fracture, neutral, steering]) validateQualification(fixture);
  for (const upload of [fractureUpload, signalUpload])
    assert.equal(validateScenario(upload).valid, true);
});

test('public uploads retain the actual compiled erosion and shipped jammer definitions', () => {
  const compiled = compileContentProject(createFractureCandidates());
  assert.deepEqual(
    fractureUpload.level,
    resolveMission(compiled, 'first-fracture', {
      difficulty: 'standard',
    }).level,
  );
  assert.deepEqual(fracture.expectedReplayDefinition.level, fractureUpload.level);
  assert.deepEqual(
    signalUpload.level,
    normalizedLevel(campaign.levels.find(({ id }) => id === 'signal-07')),
  );
  assert.deepEqual(neutral.expectedReplayDefinition.level, signalUpload.level);
  for (const [fixture, upload] of [
    [fracture, fractureUpload],
    [neutral, signalUpload],
  ]) {
    assert.equal(fixture.expectedReplayDefinition.options.classId, upload.settings.classId);
    assert.equal(fixture.expectedReplayDefinition.options.turnPolicy, upload.settings.turnPolicy);
    assert.equal(upload.settings.seed, 1);
  }
});

test('jammer steering replaces only the neutral duration with thirty meaningful public keys', () => {
  assert.deepEqual(steering.expectedReplayDefinition, neutral.expectedReplayDefinition);
  assert.equal(steering.timeoutMs, neutral.timeoutMs);
  const keys = steering.actions.filter(({ label }) => label?.startsWith('jammer-border-steering-'));
  assert.deepEqual(
    keys,
    Array.from({ length: 30 }, (_, index) => ({
      type: 'key',
      key: index % 2 ? 'ArrowRight' : 'ArrowLeft',
      ms: 1000,
      label: `jammer-border-steering-${index + 1}`,
    })),
  );
  const first = steering.actions.indexOf(keys[0]);
  const restored = structuredClone(steering.actions);
  restored.splice(first, 30, { type: 'wait', ms: 30000 });
  assert.deepEqual(restored, neutral.actions);
  assert.deepEqual(steering.replayRequirements, {
    ...neutral.replayRequirements,
    movingTicks: 3300,
    directionChangesWithMovement: 20,
  });
});

function observe(fixture, segments) {
  const definition = fixture.expectedReplayDefinition;
  const options = { ...definition.options, seed: 1 };
  const run = createRun(definition.level, options),
    recorder = createRecorder(definition.level, options);
  for (const [direction, ticks] of segments)
    for (let index = 0; index < ticks; index++) {
      assert.equal(run.status, 'running');
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
    }
  assert.equal(run.status, 'running');
  assert.equal(run.lives, 3);
  const verified = inspectQualificationReplayPortability(
    exportReplay(recorder, run),
    fixture.replayRequirements,
    definition,
  );
  assert.equal(verified.match, true);
  assert.equal(verified.status, 'pass');
  assert(verified.checks.every(({ pass }) => pass));
  return verified.features;
}

for (const heldTicks of [168, 180, 192, 204, 216])
  test(`earned erosion follows the legal capture with ${heldTicks} held ticks`, () => {
    const features = observe(fracture, [
      ['down', heldTicks],
      [null, 1800],
    ]);
    assert(features.closures >= 1);
    assert(features.eroded >= 1);
  });

test('retained neutral jammer control still activates the shipped presentation condition', () => {
  const features = observe(neutral, [[null, 3600]]);
  assert(features.jammerTicks > 0);
  assert.equal(features.directionChangesWithMovement, 0);
});

for (const delta of [-6, -3, 0, 3, 6])
  test(`meaningful jammer steering preserves public replay at ${120 + delta} ticks per hold`, () => {
    const features = observe(
      steering,
      Array.from({ length: 30 }, (_, index) => [index % 2 ? 'right' : 'left', 120 + delta]),
    );
    assert.equal(features.directionChangesWithMovement, 29);
    assert(features.jammerTicks >= 1000);
    assert.equal(features.closures, 0, 'This border route does not claim capture coverage');
  });
