import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
  takeReplayMasteryObserver,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { SUPPLY_LINE, SAFE_RETURN, STEADY_SIGNAL, masteryDefinitionIdentity } from '../mastery.mjs';
import {
  campaignKey,
  emptyLibrary,
  withMasteryRecords,
  exportLibrary,
  importLibrary,
} from '../library.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const pack = await json('../content/packs/homeward-skies.json');
const proof = await json('../replays/homeward-routes.json');
const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const key = campaignKey(campaign),
  copy = (value) => structuredClone(value);
const goals = [SUPPLY_LINE, SAFE_RETURN];
const request = (definition, runId = `equipment-${definition.id}`) => ({
  definition,
  campaignId: campaign.id,
  campaignKey: key,
  runId,
});
const award = (replay, definition) => ({
  replay,
  campaign,
  definition,
  runId: `equipment-${definition.id}`,
  earnedAt: '2026-09-12T12:00:00.000Z',
});
function recording(route) {
  const level = campaign.levels.find((value) => value.id === route.levelId);
  const options = {
    seed: route.seed,
    classId: route.classId,
    turnPolicy: route.turnPolicy,
    classRecipes: campaign.classRecipes,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'equipment-replay-test');
  for (const segment of route.segments) {
    if (segment.releaseBefore) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    for (let tick = 0; tick < segment.ticks; tick++) {
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
    }
  }
  const value = exportReplay(recorder, run);
  assert.deepEqual(value.summary, route.expected);
  assert.deepEqual(value.checkpoint, route.checkpoint);
  return value;
}
const routes = proof.routes.filter(
  (route) =>
    goals.some((goal) => goal.levelId === route.levelId) &&
    (route.variant === 'specialty' || route.classId === 'interceptor'),
);
const recordings = new Map(routes.map((route) => [route.id, recording(route)]));
const positive = (definition, policy = 'immediate') =>
  recordings.get(
    routes.find(
      (route) =>
        route.levelId === definition.levelId &&
        route.turnPolicy === policy &&
        route.variant === 'specialty',
    ).id,
  );

for (const route of routes)
  test(`${route.id}: optional goal preserves the original win and checkpoint`, async () => {
    const definition = goals.find((value) => value.levelId === route.levelId);
    const replay = recordings.get(route.id),
      before = copy(replay);
    const ordinary = await verifyReplayAsync(replay);
    const checked = await verifyReplayAsync(replay, { mastery: request(definition) });
    assert.equal(checked.match, true);
    assert.deepEqual(checked.actual, ordinary.actual);
    assert.deepEqual(checked.actual.summary, route.expected);
    assert.deepEqual(checked.actual.checkpoint, route.checkpoint);
    assert.equal(Object.hasOwn(ordinary, 'masteryPreview'), false);
    const preview = checked.masteryPreview,
      qualifying = route.variant === 'specialty';
    assert.equal(preview.authority, 'preview-only');
    assert.equal(preview.qualified, qualifying);
    assert.equal(preview.complete, true);
    assert.equal(preview.status, 'won');
    assert.equal(preview.definitionIdentity, masteryDefinitionIdentity(definition));
    assert.deepEqual(preview.classHistory, route.expected.classHistory);
    assert.equal(Object.hasOwn(preview, 'bestClosedCutCells'), false);
    if (definition.id === 'supply-line') {
      assert.deepEqual(
        preview.predicates[0].collectedPadIds,
        qualifying ? ['south-supply', 'west-supply'] : [],
      );
      assert.deepEqual(
        preview.predicates[1].regions.map((value) => value.bestClosedCells),
        qualifying ? [3, 4] : [0, 0],
      );
      assert.equal(preview.predicates[2].satisfied, qualifying);
    } else assert.equal(preview.predicates[1].phase, qualifying ? 'returned' : 'not-started');
    const observer = takeReplayMasteryObserver(checked);
    assert.deepEqual(observer.snapshot(), preview);
    assert.equal(takeReplayMasteryObserver(checked), null);
    assert.throws(() => verifiedMasteryRecord(checked), /verification is required/);
    const verified = await verifyMasteryRun(award(replay, definition));
    assert.equal(verified.qualified, qualifying);
    const record = verifiedMasteryRecord(verified);
    if (qualifying) {
      assert.equal(record.format, 'xonix-mastery-record.v1');
      assert.equal(record.definitionHash, masteryDefinitionIdentity(definition));
      assert.deepEqual(record.setup.classHistory, route.expected.classHistory);
      const library = withMasteryRecords(emptyLibrary(), [record]);
      assert.equal(library.format, 'xonix-library.v2');
      assert.deepEqual(importLibrary(exportLibrary(library)).masteries, [record]);
    } else assert.equal(record, null);
    assert.deepEqual(replay, before);
  });

for (const comparison of proof.comparisons)
  test(`${comparison.levelId}/${comparison.turnPolicy}: omitted action never supplies the missing goal`, async () => {
    const definition = goals.find((value) => value.levelId === comparison.levelId);
    const checked = await verifyReplayAsync(comparison.replay, { mastery: request(definition) });
    assert.equal(checked.match, true);
    assert.deepEqual(checked.actual.checkpoint, comparison.replay.checkpoint);
    assert.deepEqual(checked.actual.summary, comparison.replay.summary);
    assert.equal(checked.masteryPreview.qualified, false);
    if (checked.state.status === 'won') {
      assert.equal(checked.state.lives, 2);
      const result = await verifyMasteryRun(award(comparison.replay, definition));
      assert.equal(verifiedMasteryRecord(result), null);
    } else {
      assert.equal(checked.state.status, 'running');
      await assert.rejects(
        verifyMasteryRun(award(comparison.replay, definition)),
        /completed winning attempt/,
      );
    }
  });

test('v2 request owns all nested definition data and binding before asynchronous work', async () => {
  const mastery = copy(request(SUPPLY_LINE)),
    before = copy(mastery);
  const pending = verifyReplayAsync(positive(SUPPLY_LINE), { mastery, chunkTicks: 1200 });
  mastery.definition.all[1].regions[0].minCells = 1500;
  mastery.definition.all[0].padIds[0] = 'missing-pad';
  mastery.runId = 'changed';
  mastery.campaignKey = 'changed';
  const checked = await pending;
  assert.equal(checked.masteryPreview.qualified, true);
  assert.equal(checked.masteryPreview.setup.runId, before.runId);
  assert.equal(checked.masteryPreview.setup.campaignKey, before.campaignKey);
  assert.equal(
    checked.masteryPreview.definitionIdentity,
    masteryDefinitionIdentity(before.definition),
  );
});

test('v2 request admits all four supported pad and region references within its deeper budget', async () => {
  const installed = copy(campaign),
    definition = copy(SUPPLY_LINE);
  const level = installed.levels.find((item) => item.id === definition.levelId);
  for (const id of ['extra-one', 'extra-two']) {
    level.supplies.push({ ...copy(level.supplies[0]), id: `pad-${id}` });
    level.signalZones.push({ ...copy(level.signalZones[0]), id: `zone-${id}` });
    definition.all[0].padIds.push(`pad-${id}`);
    definition.all[1].regions.push({ zoneId: `zone-${id}`, minCells: 2 });
  }
  const options = { seed: 1, classId: 'bomber', classRecipes: installed.classRecipes };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'four-reference-boundary');
  const checked = await verifyReplayAsync(exportReplay(recorder, run), {
    mastery: { ...request(definition), campaignKey: campaignKey(installed) },
  });
  assert.equal(checked.match, true);
  assert.equal(checked.ticks, 0);
  assert.equal(checked.masteryPreview.predicates[0].padIds.length, 4);
  assert.equal(checked.masteryPreview.predicates[1].regions.length, 4);
  assert.equal(checked.masteryPreview.qualified, false);
  assert.notEqual(checked.masteryPreview.setup.campaignKey, key);
});

test('nested request accessors, extra fields, unsupported versions and structural excess reject before progress', async () => {
  const inputs = [],
    altered = (edit) => {
      const value = copy(request(SUPPLY_LINE));
      edit(value);
      inputs.push(value);
    };
  altered((value) => {
    value.definition.version = 'xonix-mastery-definition.v3';
  });
  altered((value) => {
    value.definition.all.push(copy(value.definition.all[0]));
  });
  altered((value) => {
    value.definition.all[0].padIds = Array.from({ length: 5 }, (_, i) => `pad-${i}`);
  });
  altered((value) => {
    value.definition.all[1].regions[0].formula = 'award()';
  });
  altered((value) => {
    value.definition.all[1].regions[0].minCells = Infinity;
  });
  altered((value) => {
    value.definition.description = 'x'.repeat(513);
  });
  altered((value) => {
    value.extra = { deeply: { nested: { a: { b: { c: { d: 1 } } } } } };
  });
  altered((value) => {
    value.definition.all[1].regions[0] = Object.create({ inherited: true });
  });
  altered((value) => {
    value.definition.all[0].padIds[2] = 'gap';
    delete value.definition.all[0].padIds[1];
  });
  altered((value) => {
    value.definition.all[0].padIds.custom = true;
  });
  altered((value) => {
    value.definition = {
      ...copy(STEADY_SIGNAL),
      all: [...copy(STEADY_SIGNAL.all), { type: 'clean-win' }],
    };
  });
  inputs.push(JSON.parse('{"__proto__":{"polluted":true}}'));
  let reads = 0;
  for (const select of [(value) => value.definition, (value) => value.definition.all[1].regions[0]])
    altered((value) => {
      Object.defineProperty(select(value), 'version', {
        enumerable: true,
        get() {
          reads++;
          return 'xonix-mastery-definition.v2';
        },
      });
    });
  for (const mastery of inputs) {
    let progress = 0;
    await assert.rejects(
      verifyReplayAsync(positive(SUPPLY_LINE), { mastery, onProgress: () => progress++ }),
      TypeError,
    );
    assert.equal(progress, 0);
  }
  assert.equal(reads, 0);
  assert.equal({}.polluted, undefined);
});

test('missing map, pad, zone, hangar, recipe or actor references never expose an observer', async () => {
  for (const [definition, alter] of [
    [
      SUPPLY_LINE,
      (value) => {
        value.campaignId = 'other';
      },
    ],
    [
      SUPPLY_LINE,
      (value) => {
        value.levelId = 'homeward-03';
      },
    ],
    [
      SUPPLY_LINE,
      (value) => {
        value.all[0].padIds[0] = 'missing';
      },
    ],
    [
      SUPPLY_LINE,
      (value) => {
        value.all[1].regions[0].zoneId = 'missing';
      },
    ],
    [
      SUPPLY_LINE,
      (value) => {
        value.all[2].hangarId = 'missing';
      },
    ],
    [
      SUPPLY_LINE,
      (value) => {
        value.all[2].classId = 'missing';
      },
    ],
    [
      SAFE_RETURN,
      (value) => {
        value.all[1].actorId = 'missing';
      },
    ],
  ]) {
    const changed = copy(definition);
    alter(changed);
    let progress = 0;
    await assert.rejects(
      verifyReplayAsync(positive(definition), {
        mastery: request(changed),
        onProgress: () => progress++,
      }),
      TypeError,
    );
    assert.equal(progress, 0);
  }
});

test('v2 cancellation before, during and at final progress yields no verified record', async () => {
  for (const definition of goals)
    for (const at of ['before', 'during', 'final']) {
      const controller = new AbortController();
      if (at === 'before') controller.abort();
      let calls = 0;
      await assert.rejects(
        verifyMasteryRun(award(positive(definition), definition), {
          signal: controller.signal,
          chunkTicks: 120,
          onProgress(value) {
            calls++;
            if ((at === 'during' && value.ticks > 0) || (at === 'final' && value.fraction === 1))
              controller.abort();
          },
        }),
        { name: 'AbortError' },
      );
      if (at === 'before') assert.equal(calls, 0);
    }
});

test('a qualifying v2 preview with a tampered summary grants neither continuation nor certificate', async () => {
  const replay = copy(positive(SAFE_RETURN));
  replay.summary.score++;
  const checked = await verifyReplayAsync(replay, { mastery: request(SAFE_RETURN) });
  assert.equal(checked.match, false);
  assert.equal(checked.masteryPreview.qualified, true);
  assert.deepEqual(authoritativeCheckpoint(checked.state), replay.checkpoint);
  assert.equal(takeReplayMasteryObserver(checked), null);
  await assert.rejects(verifyMasteryRun(award(replay, SAFE_RETURN)), /replay verification failed/);
});
