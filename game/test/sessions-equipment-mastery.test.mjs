import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import {
  SUPPLY_LINE,
  SAFE_RETURN,
  createMasteryObserver,
  captureMasterySetup,
  captureMasteryFacts,
} from '../mastery.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const pack = await json('../content/packs/homeward-skies.json');
const proof = await json('../replays/homeward-routes.json');
const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes },
  key = campaignKey(campaign);
const copy = (value) => structuredClone(value);
const goals = [
  {
    definition: SUPPLY_LINE,
    boundaries: [0, 1, 11, 12, 60, 466, 467, 812, 813, 814, 815, 850, 979, 980, 1209],
  },
  { definition: SAFE_RETURN, boundaries: [104, 105, 140, 181, 182, 1119] },
];
function fresh(route, definition) {
  const level = campaign.levels.find((value) => value.id === route.levelId);
  const options = {
    seed: route.seed,
    classId: route.classId,
    turnPolicy: route.turnPolicy,
    classRecipes: campaign.classRecipes,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'equipment-session-test');
  const binding = {
    definition,
    campaignId: campaign.id,
    campaignKey: key,
    runId: `resume-${definition.id}-${route.turnPolicy}`,
  };
  const observer = createMasteryObserver({
    definition,
    setup: captureMasterySetup(run, binding),
    initial: captureMasteryFacts(run, binding),
  });
  return {
    run,
    recorder,
    observer,
    ...binding,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    savedAt: '2026-09-12T12:00:00.000Z',
  };
}
function advance(source, route, end = route.expected.tick) {
  let index = 0;
  const start = source.run.tick;
  for (const segment of route.segments) {
    if (segment.releaseBefore && index >= start) {
      releaseInputs(source.run);
      recordRelease(source.recorder);
    }
    for (let tick = 0; tick < segment.ticks; tick++) {
      if (index++ < start) continue;
      if (source.run.tick >= end) return;
      stepRun(source.run, segment.input, FIXED_DT);
      recordInput(source.recorder, segment.input);
      source.observer.observe(
        captureMasteryFacts(source.run, { runId: source.runId, definition: source.definition }),
      );
    }
  }
}
const routeFor = (definition, policy) =>
  proof.routes.find(
    (route) =>
      route.levelId === definition.levelId &&
      route.turnPolicy === policy &&
      route.variant === 'specialty',
  );
const options = (definition, extra = {}) => ({
  campaign,
  campaignKey: key,
  masteryDefinition: definition,
  ...extra,
});

for (const { definition, boundaries } of goals)
  for (const policy of ['immediate', 'grid-center'])
    test(`${definition.id}/${policy}: each equipment boundary restores only replay-derived progress`, async () => {
      const route = routeFor(definition, policy),
        full = fresh(route, definition);
      advance(full, route);
      const expected = full.observer.snapshot();
      assert.equal(expected.qualified, true);
      assert.deepEqual(exportReplay(full.recorder, full.run).checkpoint, route.checkpoint);
      for (const tick of boundaries) {
        const source = fresh(route, definition);
        advance(source, route, tick);
        const prefix = source.observer.snapshot(),
          saved = suspendSession(source),
          before = copy(saved);
        const restored = await restoreSession(saved, options(definition));
        assert.deepEqual(restored.masteryObserver.snapshot(), prefix, `prefix tick ${tick}`);
        assert.equal(prefix.qualified, false);
        assert.equal(prefix.complete, false);
        assert.deepEqual(authoritativeCheckpoint(restored.run), saved.replay.checkpoint);
        assert.equal(restored.run.tick, tick, 'Restoring does not add an observation tick.');
        assert.equal(restored.recorder.releaseAfter, true);
        assert.deepEqual(suspendSession({ ...restored, ...restored.session }), saved);
        assert.deepEqual(saved, before);
        assert.equal(saved.format, 'xonix-session.v1');
        assert.equal(saved.replay.version, 'xonix-replay.v3');
        assert.deepEqual(Object.keys(saved), [
          'format',
          'campaignKey',
          'themeId',
          'bodyId',
          'runId',
          'savedAt',
          'replay',
        ]);
        if (definition.id === 'safe-return') {
          assert.equal(
            prefix.predicates[1].phase,
            tick < 105 ? 'not-started' : tick < 182 ? 'awaiting-return' : 'returned',
            `recovery tick ${tick}`,
          );
        } else {
          const byId = (id) => prefix.predicates[1].regions.find((value) => value.zoneId === id);
          assert.equal(
            prefix.predicates[0].collectedPadIds.length,
            tick < 1 ? 0 : tick < 814 ? 1 : 2,
          );
          assert.equal(prefix.predicates[2].satisfied, tick >= 813);
          assert.equal(byId('west-emitter').bestClosedCells, tick < 467 ? 0 : 4);
          assert.equal(byId('south-emitter').bestClosedCells, tick < 980 ? 0 : 3);
        }
        advance(
          {
            ...restored,
            observer: restored.masteryObserver,
            runId: restored.session.runId,
            definition,
          },
          route,
        );
        assert.deepEqual(restored.masteryObserver.snapshot(), expected, `continued tick ${tick}`);
        const completed = exportReplay(restored.recorder, restored.run);
        assert.deepEqual(completed.summary, route.expected);
        assert.deepEqual(completed.checkpoint, route.checkpoint);
      }
      // One fully resumed attempt also crosses the existing award boundary.
      const source = fresh(route, definition);
      advance(source, route, boundaries[3]);
      const restored = await restoreSession(suspendSession(source), options(definition));
      advance(
        {
          ...restored,
          observer: restored.masteryObserver,
          runId: restored.session.runId,
          definition,
        },
        route,
      );
      const verified = await verifyMasteryRun({
        replay: exportReplay(restored.recorder, restored.run),
        campaign,
        definition,
        runId: source.runId,
        earnedAt: source.savedAt,
      });
      assert.equal(verified.qualified, true);
      assert.deepEqual(
        verifiedMasteryRecord(verified).setup.classHistory,
        route.expected.classHistory,
      );
    });

test('definition-free restore keeps the old session result shape for either equipment route', async () => {
  for (const { definition } of goals) {
    const route = routeFor(definition, 'immediate'),
      source = fresh(route, definition);
    advance(source, route, 140);
    const saved = suspendSession(source);
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(Object.keys(restored), ['session', 'run', 'recorder']);
    assert.deepEqual(authoritativeCheckpoint(restored.run), saved.replay.checkpoint);
  }
});

test('equipment restore snapshots the definition and rejects forged progress or incompatible installed content', async () => {
  const source = fresh(routeFor(SUPPLY_LINE, 'immediate'), SUPPLY_LINE);
  advance(source, routeFor(SUPPLY_LINE, 'immediate'), 850);
  const saved = suspendSession(source),
    rule = copy(SUPPLY_LINE),
    installed = copy(campaign);
  const pending = restoreSession(saved, options(rule, { campaign: installed }));
  rule.all[0].padIds[0] = 'missing';
  installed.classRecipes[0].label = 'Changed';
  const restored = await pending;
  assert.deepEqual(restored.masteryObserver.snapshot(), source.observer.snapshot());
  for (const field of ['mastery', 'masteryPreview', 'masteryObserver'])
    await assert.rejects(
      restoreSession({ ...saved, [field]: { qualified: true } }, options(SUPPLY_LINE)),
      /not supported/,
    );
  const changed = copy(campaign);
  changed.levels[1].rules.lives = 9;
  await assert.rejects(
    restoreSession(saved, options(SUPPLY_LINE, { campaign: changed })),
    /rules differ/,
  );
});

test('cancelling a recovery rebuild on its final progress callback returns no restored session', async () => {
  const route = routeFor(SAFE_RETURN, 'immediate'),
    source = fresh(route, SAFE_RETURN);
  advance(source, route, 140);
  const saved = suspendSession(source),
    before = copy(saved),
    controller = new AbortController();
  await assert.rejects(
    restoreSession(
      saved,
      options(SAFE_RETURN, {
        signal: controller.signal,
        onProgress(value) {
          if (value.fraction === 1) controller.abort();
        },
      }),
    ),
    { name: 'AbortError' },
  );
  assert.deepEqual(saved, before);
});
