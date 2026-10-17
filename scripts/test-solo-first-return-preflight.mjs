import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAuthoredJourneyRoute } from '../game/content-design/route.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { normalizedLevel } from '../game/core/level.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../game/replay.mjs';
import { inspectQualificationReplayPortability } from './solo-qualification-replay.mjs';
import { validateQualification } from './solo-qualification.mjs';

const directory = new URL('../docs/performance/fixtures/solo-remote-sustained/', import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(`${name}.qualification.fixture`, directory)));
const retry = await read('retry-first-return-anchored-preflight');
const next = await read('next-first-return-anchored-preflight');
const heldRetry = await read('retry-first-return-anchored');
const heldNext = await read('next-first-return-anchored');
const cycle = heldRetry.actions.find((action) => action.type === 'repeat').actions;
const route = cycle.slice(0, 2);

test('short held native fixtures remain inline, bounded and separate from long qualification recipes', async () => {
  for (const fixture of [retry, next]) {
    assert.doesNotThrow(() => validateQualification(fixture));
    assert.equal(fixture.kind, 'lifecycle');
    assert.equal(fixture.timeoutMs, 240000);
    assert.equal(fixture.evidenceStorage, undefined);
    assert.equal(fixture.resourceRules, undefined);
    assert.equal(
      fixture.actions.some((action) => ['repeat', 'fault', 'reload'].includes(action.type)),
      false,
    );
    assert.equal(fixture.actions.filter((action) => action.type === 'exportReplay').length, 1);
    assert.deepEqual(fixture.actions.at(-1), { type: 'exportReplay' });
    assert.equal(
      fixture.actions.some((action) => /resume/.test(action.selector ?? '')),
      false,
    );
  }
  const preserved = {
    soak: '079d4dd76fbd914ddd4da7311f8e6cee4a0ff4fc3bc951842b2921c94c53b8ff',
    retry: '77458b3992e1f40b565bd57912bdc2b4e79ddadb8ce07b617456e220853fe9d1',
    next: '17aa6627b51310ea2ccc4cca2d77a5a9f00d68c6a4edff114720480c208ae11b',
  };
  for (const [kind, sha] of Object.entries(preserved))
    assert.equal(
      createHash('sha256')
        .update(
          await readFile(new URL(`${kind}-first-return-anchored.qualification.fixture`, directory)),
        )
        .digest('hex'),
      sha,
    );
  assert.deepEqual(retry.actions, [
    ...heldRetry.actions.slice(0, 8),
    ...cycle,
    { type: 'wait', ms: 1000 },
    ...cycle.slice(0, 4),
    { type: 'exportReplay' },
  ]);
  assert.equal(retry.actions.filter((action) => action.selector === '#retry-button').length, 1);
  assert.equal(
    retry.actions.filter((action) => action.type === 'result' && action.outcome === 'won').length,
    2,
  );
  assert.deepEqual(next.actions.slice(0, 8), heldNext.actions.slice(0, 8));
  assert.deepEqual(next.actions.slice(8), [
    { type: 'click', selector: '#pause-button' },
    { type: 'wait', phase: 'paused', timeoutMs: 10000 },
    { type: 'snapshot', group: 'first-next-paused' },
    { type: 'exportReplay' },
  ]);
  assert.equal(next.actions.filter((action) => action.selector === '#next-button').length, 1);
  assert.equal(
    next.replayRequirements,
    undefined,
    'A fresh Next attempt cannot claim the preceding capture.',
  );
});

test('native preflight definitions retain authored First Return and its real next mission', () => {
  const routeSource = createAuthoredJourneyRoute('authored');
  const ids = routeSource.corePackIds.flatMap((id) =>
    routeSource.source.packs
      .find((pack) => pack.id === id)
      .campaignIds.flatMap(
        (campaignId) =>
          routeSource.source.campaigns.find((campaign) => campaign.id === campaignId).missionIds,
      ),
  );
  assert.deepEqual(ids.slice(0, 2), ['first-return', 'choose-your-share']);
  const compiled = compileContentProject(routeSource.source);
  for (const [fixture, id] of [
    [retry, ids[0]],
    [next, ids[1]],
  ]) {
    const manifest = resolveMission(compiled, id, { difficulty: 'standard' });
    assert.deepEqual(fixture.expectedReplayDefinition, {
      level: normalizedLevel(
        applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
      ),
      options: { classId: 'scout', turnPolicy: 'immediate' },
    });
  }
});

test('each modeled retry attempt earns a real closure and the final replay retains those mechanics', () => {
  const definition = retry.expectedReplayDefinition;
  let recording;
  for (let attempt = 0; attempt < 2; attempt++) {
    const run = createRun(definition.level, definition.options);
    const recorder = createRecorder(definition.level, definition.options);
    for (const action of route) {
      const input = { direction: action.key === 'ArrowUp' ? 'up' : 'down' };
      for (let tick = 0; tick < Math.round(action.ms / (FIXED_DT * 1000)); tick++) {
        if (run.status !== 'running') break;
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
      }
    }
    assert.equal(run.status, 'won');
    assert.equal(run.lives, 3);
    assert.equal(run.claimedCount, 816);
    recording = exportReplay(recorder, run);
  }
  const proof = inspectQualificationReplayPortability(
    recording,
    retry.replayRequirements,
    definition,
  );
  assert.equal(proof.status, 'pass');
  assert.equal(proof.features.closures, 1);
  assert.equal(proof.features.maximumTrailCells, 34);
});
