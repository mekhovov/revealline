import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { inspectQualificationReplayPortability } from './solo-qualification-replay.mjs';
import { assertStarterGameplaySelection } from './solo-remote-offline.mjs';

const directory = new URL('../docs/performance/fixtures/solo-remote-offline/', import.meta.url);
const bytes = await readFile(new URL('installed-starter.source.fixture', directory));
const chapter = JSON.parse(bytes);
const recipe = JSON.parse(
  await readFile(new URL('installed-starter.qualification.fixture', directory)),
);
const projection = JSON.parse(
  await readFile(new URL('installed-starter.catalogue.fixture', directory)),
);
const bind = (data = projection, fixture = recipe) =>
  assertStarterGameplaySelection(data.core, data.catalogue, data.navigation, chapter, fixture);

test('installed Starter retains exact artifact chapter and both immutable mission definitions', async () => {
  assert.equal(bytes.length, recipe.offlinePreparation.sourceFixture.bytes);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '553239c39f2562b90a71670cd383f65c53dce6e84a6f386af51465c1caadce65',
  );
  const original = await readFile(new URL('original-art-opening.qualification.fixture', directory));
  assert.equal(
    createHash('sha256').update(original).digest('hex'),
    'f5459da998a91a3e401bf69306d08e7fd2dd3850058d4580dae6f042dce090d8',
  );
  const project = compileContentProject(chapter);
  for (const definition of [recipe.expectedReplayDefinition, recipe.expectedNextReplayDefinition]) {
    const resolved = resolveMission(project, definition.level.id, { difficulty: 'standard' });
    assert.deepEqual(
      definition.level,
      applyGameplayTuning(resolved.level, resolveGameplayTuning('standard')),
    );
  }
  assert.notDeepEqual(
    recipe.expectedReplayDefinition,
    JSON.parse(original).expectedReplayDefinition,
  );
  assert.deepEqual(bind().installedGroups, ['base', 'shared', 'solo:horizon-starter']);
});

test('prepared catalogue binding rejects the historical Opening route and mismatched mission ownership', () => {
  const archived = structuredClone(recipe);
  archived.query.journey = 'opening';
  assert.throws(() => bind(projection, archived));
  archived.offlinePreparation.routeId = 'opening';
  assert.throws(() => bind(projection, archived));
  const archivedBootstrap = projection.catalogue.navigationBootstraps.find(
    (item) => item.routeId === 'opening',
  );
  assert.deepEqual(archivedBootstrap.files, ['game/content-design/runtime/opening.json']);
  assert(!projection.core.files.some((item) => archivedBootstrap.files.includes(item.path)));
  assert.equal(
    projection.catalogue.missions.find((item) => item.routeId === 'opening').groups[0],
    'archive:journey:opening',
  );
  for (const modify of [
    (p) => {
      p.core.files.pop();
    },
    (p) => {
      p.core.files[0].sha256 = '0'.repeat(64);
    },
    (p) => {
      p.catalogue.destinations.find((item) => item.routeId === 'whole-spatial-v25').groups = [
        'archive:journey:opening',
      ];
    },
    (p) => {
      p.catalogue.missions.find((item) => item.routeId === 'whole-spatial-v25').groups = [
        'archive:journey:opening',
      ];
    },
    (p) => {
      p.catalogue.missions.find((item) => item.routeId === 'whole-spatial-v25').id += '-different';
    },
    (p) => {
      p.navigation.navigation.views.solo.campaigns[0].levels.reverse();
    },
  ]) {
    const changed = structuredClone(projection);
    modify(changed);
    assert.throws(() => bind(changed));
  }
});

for (const jitter of [-2, 0, 2])
  test(`installed Starter legal input earns the declared capture (${jitter} ticks)`, () => {
    const definition = recipe.expectedReplayDefinition;
    const options = { ...definition.options, seed: 1 };
    const run = createRun(definition.level, options);
    const recorder = createRecorder(definition.level, options);
    for (const [direction, ticks] of [
      ['right', 163 + jitter],
      ['down', 469],
      [null, 2400],
    ])
      for (let tick = 0; tick < ticks && run.status === 'running'; tick++) {
        const input = { direction };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
      }
    assert.equal(run.status, 'won');
    assert.equal(run.lives, 3);
    const evidence = inspectQualificationReplayPortability(
      exportReplay(recorder, run),
      recipe.replayRequirements,
      definition,
    );
    assert.equal(evidence.status, 'pass');
  });
