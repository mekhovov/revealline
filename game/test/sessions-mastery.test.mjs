import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  authoritativeCheckpoint,
  verifyReplay,
} from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession, SESSION_FORMAT } from '../sessions.mjs';
import {
  STEADY_SIGNAL,
  captureMasterySetup,
  captureMasteryFacts,
  createMasteryObserver,
  masteryDefinitionIdentity,
} from '../mastery.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/homeward-skies.json', import.meta.url), 'utf8'),
);
const proof = JSON.parse(
  await readFile(new URL('../replays/homeward-routes.json', import.meta.url), 'utf8'),
);
const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const key = campaignKey(campaign);
const routeFor = (policy) =>
  proof.routes.find(
    (route) =>
      route.levelId === 'homeward-01' &&
      route.turnPolicy === policy &&
      route.variant === 'specialty' &&
      route.classId === 'fiber',
  );
const copy = (value) => structuredClone(value);

function flight(policy = 'immediate', installed = campaign) {
  const options = {
    seed: 1,
    classId: 'fiber',
    turnPolicy: policy,
    classRecipes: installed.classRecipes,
  };
  const run = createRun(installed.levels[0], options),
    recorder = createRecorder(installed.levels[0], options, 'session-observer-test');
  const binding = { campaignId: campaign.id, campaignKey: key, runId: `homeward-resume-${policy}` };
  const observer = createMasteryObserver({
    definition: STEADY_SIGNAL,
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
  const from = source.run.tick;
  let index = 0;
  for (const segment of route.segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      if (index++ < from) continue;
      if (source.run.tick >= end) return;
      stepRun(source.run, segment.input, FIXED_DT);
      recordInput(source.recorder, segment.input);
      source.observer?.observe(captureMasteryFacts(source.run, { runId: source.runId }));
    }
}
function savedFlight(policy = 'immediate', ticks = 180, installed = campaign) {
  const source = flight(policy, installed);
  advance(source, routeFor(policy), ticks);
  return { source, saved: suspendSession(source) };
}
const options = (extra = {}) => ({
  campaign,
  campaignKey: key,
  masteryDefinition: STEADY_SIGNAL,
  ...extra,
});

for (const policy of ['immediate', 'grid-center'])
  test(`restored ${policy} live-cut observer rebuilds its prefix and reaches the original optional win`, async () => {
    const { source, saved } = savedFlight(policy);
    const prefix = source.observer.snapshot();
    assert.ok(prefix.pendingCutCells >= 8 && prefix.bestClosedCutCells === 0 && !prefix.qualified);
    const restored = await restoreSession(JSON.stringify(saved), options());
    assert.deepEqual(Object.keys(restored), ['session', 'run', 'recorder', 'masteryObserver']);
    assert.deepEqual(restored.masteryObserver.snapshot(), prefix);
    assert.deepEqual(authoritativeCheckpoint(restored.run), saved.replay.checkpoint);
    assert.equal(
      restored.recorder.releaseAfter,
      true,
      'Restored input stays released without an extra mastery tick.',
    );
    advance(source, routeFor(policy));
    advance(
      { ...restored, observer: restored.masteryObserver, runId: restored.session.runId },
      routeFor(policy),
    );
    assert.deepEqual(restored.masteryObserver.snapshot(), source.observer.snapshot());
    const final = restored.masteryObserver.snapshot();
    assert.equal(final.qualified, true);
    assert.equal(final.bestClosedCutCells, 22);
    assert.equal(final.authority, 'preview-only');
    assert.equal(final.setup.runId, saved.runId);
    assert.equal(final.setup.campaignKey, key);
    assert.equal(final.setup.turnPolicy, policy);
    const replay = exportReplay(restored.recorder, restored.run);
    assert.equal(verifyReplay(replay).match, true);
    assert.deepEqual(replay.summary, routeFor(policy).expected);
    assert.deepEqual(replay.checkpoint, routeFor(policy).checkpoint);
  });

test('omitted optional mastery preserves the exact old return and serialized session shape', async () => {
  const { saved } = savedFlight();
  const before = copy(saved);
  for (const extra of [{}, { masteryDefinition: undefined }]) {
    const restored = await restoreSession(saved, { campaign, campaignKey: key, ...extra });
    assert.deepEqual(Object.keys(restored), ['session', 'run', 'recorder']);
    assert.equal(Object.hasOwn(restored, 'masteryObserver'), false);
    assert.deepEqual(authoritativeCheckpoint(restored.run), saved.replay.checkpoint);
  }
  const restored = await restoreSession(saved, options());
  const resaved = suspendSession({ ...restored, ...restored.session });
  assert.equal(resaved.format, SESSION_FORMAT);
  assert.deepEqual(Object.keys(resaved), [
    'format',
    'campaignKey',
    'themeId',
    'bodyId',
    'runId',
    'savedAt',
    'replay',
  ]);
  assert.deepEqual(resaved, before, 'The observer never enters persisted session data.');
  assert.deepEqual(saved, before, 'Restoration does not mutate the caller envelope.');
});

test('definition and all installed/session identity data are captured before yielding', async () => {
  const { saved } = savedFlight(),
    original = copy(saved),
    definition = copy(STEADY_SIGNAL),
    installed = copy(campaign);
  const pending = restoreSession(
    saved,
    options({ campaign: installed, masteryDefinition: definition }),
  );
  definition.all[1].minCells = 1;
  definition.name = 'Different badge';
  installed.classRecipes.find((recipe) => recipe.id === 'fiber').signalResistance = false;
  installed.levels[0].rules.lives = 9;
  saved.runId = 'another-attempt';
  saved.campaignKey = 'another-campaign';
  saved.replay.segments[0].input.direction = 'left';
  const restored = await pending,
    preview = restored.masteryObserver.snapshot();
  assert.equal(preview.definitionIdentity, masteryDefinitionIdentity(STEADY_SIGNAL));
  assert.equal(preview.predicates[1].minCells, 8);
  assert.equal(preview.setup.initialLives, 3);
  assert.equal(preview.setup.runId, original.runId);
  assert.equal(preview.setup.campaignKey, original.campaignKey);
  assert.deepEqual(authoritativeCheckpoint(restored.run), original.replay.checkpoint);
});

test('malformed or inapplicable optional definitions reject before exposing a continuation', async () => {
  const { saved } = savedFlight();
  const definitions = [
    null,
    {},
    { ...copy(STEADY_SIGNAL), campaignId: 'other-campaign' },
    { ...copy(STEADY_SIGNAL), levelId: 'homeward-02' },
  ];
  const unknownZone = copy(STEADY_SIGNAL);
  unknownZone.all[1].zoneId = 'missing-zone';
  definitions.push(unknownZone);
  let reads = 0;
  const getter = copy(STEADY_SIGNAL);
  Object.defineProperty(getter.all[1], 'minCells', {
    enumerable: true,
    get() {
      reads++;
      return 1;
    },
  });
  definitions.push(getter);
  for (const definition of definitions) {
    let progressCalls = 0;
    await assert.rejects(
      restoreSession(
        saved,
        options({
          masteryDefinition: definition,
          onProgress: () => {
            progressCalls++;
          },
        }),
      ),
      TypeError,
    );
    assert.equal(progressCalls, 0);
  }
  assert.equal(reads, 0);
  const restored = await restoreSession(saved, options());
  assert.ok(restored.masteryObserver.snapshot().pendingCutCells >= 8);
});

test('unverified progress fields cannot be imported into an otherwise valid old session', async () => {
  const { saved } = savedFlight();
  for (const property of ['mastery', 'masteryObserver', 'masteryPreview']) {
    await assert.rejects(
      restoreSession({ ...saved, [property]: { qualified: true } }, options()),
      /not supported/,
    );
  }
});

test('a self-consistent altered map or roster cannot release a reconstructed observer', async () => {
  for (const alter of [
    (installed) => {
      installed.levels[0].goal.coverage = 0.99;
    },
    (installed) => {
      installed.classRecipes.find((recipe) => recipe.id === 'fiber').cooldown = 8;
    },
  ]) {
    const changed = copy(campaign);
    alter(changed);
    const { saved } = savedFlight('immediate', 180, changed);
    await assert.rejects(restoreSession(saved, options()), /rules differ/);
  }
  const { saved } = savedFlight();
  saved.replay.summary.score++;
  await assert.rejects(restoreSession(saved, options()), /verification failed/);
});

test('cancellation before work or at final progress returns no resumable observer', async () => {
  const { saved } = savedFlight('immediate', 1);
  const early = new AbortController();
  early.abort();
  await assert.rejects(restoreSession(saved, options({ signal: early.signal })), {
    name: 'AbortError',
  });
  const late = new AbortController();
  let reachedFinal = false;
  await assert.rejects(
    restoreSession(
      saved,
      options({
        signal: late.signal,
        onProgress: ({ ticks, total }) => {
          if (ticks === total && total > 0) {
            reachedFinal = true;
            late.abort();
          }
        },
      }),
    ),
    { name: 'AbortError' },
  );
  assert.equal(reachedFinal, true);
  const restored = await restoreSession(saved, options());
  assert.equal(restored.masteryObserver.snapshot().tick, 1);
});

test('an ended replay cannot be adopted as a saved mastery continuation', async () => {
  const source = flight();
  advance(source, routeFor('immediate'));
  const saved = {
    format: SESSION_FORMAT,
    campaignKey: key,
    themeId: source.themeId,
    bodyId: source.bodyId,
    runId: source.runId,
    savedAt: source.savedAt,
    replay: exportReplay(source.recorder, source.run),
  };
  await assert.rejects(restoreSession(saved, options()), /already ended/);
});
