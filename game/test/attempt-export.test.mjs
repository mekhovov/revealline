import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
  authoritativeCheckpoint,
} from '../replay.mjs';
import {
  SESSION_FORMAT,
  SESSION_IMPORT_BYTES,
  SESSION_STORAGE_BYTES,
  suspendSession,
  restoreSession,
} from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { prepareAttemptExport } from '../attempt-export.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const stamp = '2026-09-12T12:34:56.789Z';
const copy = (value) => structuredClone(value);
const cases = [];
function envelope(replay, campaign, runId = 'attempt-export-fixture') {
  return {
    format: SESSION_FORMAT,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId,
    savedAt: stamp,
    replay,
  };
}

// Read the existing finite proofs, execute only public core inputs and compare
// the complete results with their old checkpoints. No fixture is rewritten.
for (const packId of ['homeward-skies', 'sentinel-relay']) {
  const pack = await json(`../content/packs/${packId}.json`);
  const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  const proof = await json(
    `../replays/${packId === 'homeward-skies' ? 'homeward' : 'sentinel'}-routes.json`,
  );
  for (const policy of ['immediate', 'grid-center']) {
    const route = proof.routes.find(
      (r) =>
        r.turnPolicy === policy &&
        (packId === 'homeward-skies'
          ? r.levelId === 'homeward-03' && r.variant === 'specialty'
          : r.variant === 'recovered'),
    );
    assert.ok(route);
    const level = campaign.levels.find((l) => l.id === route.levelId);
    const options = {
      seed: route.seed,
      classId: route.classId,
      turnPolicy: policy,
      classRecipes: campaign.classRecipes,
    };
    const run = createRun(level, options),
      recorder = createRecorder(level, options, 'attempt-export-proof-prefix');
    let live, recovery;
    for (const segment of route.segments) {
      if (segment.releaseBefore) {
        releaseInputs(run);
        recordRelease(recorder);
      }
      for (let tick = 0; tick < segment.ticks; tick++) {
        assert.ok(['running', 'respawning'].includes(run.status));
        stepRun(run, segment.input, FIXED_DT);
        recordInput(recorder, segment.input);
        if (!live && run.tick >= 100 && run.status === 'running' && run.trail.length > 0)
          live = envelope(exportReplay(recorder, run), campaign, route.id);
        if (!recovery && run.status === 'respawning')
          recovery = envelope(exportReplay(recorder, run), campaign, route.id);
      }
    }
    if (route.releaseAfter) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    const replay = exportReplay(recorder, run);
    assert.deepEqual(replay.summary, route.expected);
    assert.deepEqual(replay.checkpoint, route.checkpoint);
    assert.ok(live && recovery);
    cases.push({ campaign, policy, live, recovery, won: envelope(replay, campaign, route.id) });
  }
}

for (const entry of cases) {
  const { campaign, policy } = entry;
  for (const phase of ['live', 'recovery'])
    test(`${campaign.id}/${policy}/${phase}: installed export preserves the entire legal checkpoint`, async () => {
      const source = copy(entry[phase]),
        original = copy(source),
        progress = [];
      const result = await prepareAttemptExport(source, {
        campaign,
        onProgress: (value) => progress.push(value),
      });
      assert.deepEqual(Object.keys(result).sort(), ['context', 'session']);
      assert.equal(result.context, 'installed-campaign');
      assert.deepEqual(result.session, original);
      assert.equal(JSON.stringify(result.session), JSON.stringify(original));
      assert.deepEqual(source, original);
      assert.notEqual(result.session, source);
      assert.notEqual(result.session.replay, source.replay);
      assert.ok(Object.isFrozen(result.session.replay.segments[0].input));
      assert.equal(progress[0].ticks, 0);
      assert.equal(progress.at(-1).fraction, 1);
      for (const value of progress)
        assert.deepEqual(Object.keys(value).sort(), ['fraction', 'ticks', 'total']);
      const checked = await verifyReplayAsync(result.session.replay);
      assert.equal(checked.match, true);
      assert.equal(checked.state.status, phase === 'live' ? 'running' : 'respawning');
      assert.equal(Object.hasOwn(checked, 'masteryPreview'), false);
      assert.deepEqual(checked.actual.checkpoint, original.replay.checkpoint);
      const restored = await restoreSession(result.session, {
        campaign,
        campaignKey: campaignKey(campaign),
      });
      // Export kept the pre-release recording. Restore may intentionally release
      // held inputs in its private returned state; that is not exported here.
      assert.equal(restored.run.tick, original.replay.ticks);
      assert.equal(restored.run.status, checked.state.status);
      assert.deepEqual(result.session, original);
    });

  test(`${campaign.id}/${policy}: missing context yields an explicitly limited rescue file`, async () => {
    const source = copy(entry.recovery);
    source.campaignKey = 'historical-pack/1/not-established-by-the-replay';
    const result = await prepareAttemptExport(JSON.stringify(source));
    assert.equal(result.context, 'replay-only');
    assert.deepEqual(result.session, source);
    assert.equal((await verifyReplayAsync(result.session.replay)).match, true);
    await assert.rejects(
      restoreSession(result.session, { campaign, campaignKey: campaignKey(campaign) }),
      /different campaign/,
    );
  });

  test(`${campaign.id}/${policy}: actual won state rejects in both verification paths`, async () => {
    assert.equal((await verifyReplayAsync(entry.won.replay)).state.status, 'won');
    for (const options of [{}, { campaign }])
      await assert.rejects(prepareAttemptExport(entry.won, options), /already ended/);
  });
}

for (const cause of ['self-contact', 'boss-lane'])
  for (const policy of ['immediate', 'grid-center'])
    test(`${cause}/${policy}: real lost recordings cannot be exported as unfinished`, async () => {
      const fixture = retryFixture(cause);
      const campaign = {
        version: 'xonix-campaign.v1',
        id: 'attempt-export-loss',
        revision: '1',
        levels: [fixture.level],
        classRecipes: CLASSES,
      };
      const options = { classId: 'scout', classRecipes: CLASSES, turnPolicy: policy, seed: 120 };
      const run = createRun(fixture.level, options),
        recorder = createRecorder(fixture.level, options);
      for (const segment of fixture.segments)
        for (let tick = 0; tick < segment.ticks; tick++) {
          stepRun(run, segment.input, FIXED_DT);
          recordInput(recorder, segment.input);
        }
      assert.equal(run.status, 'lost');
      assert.equal(run.tick, fixture.terminalTick);
      const source = envelope(exportReplay(recorder, run), campaign);
      for (const context of [{}, { campaign }])
        await assert.rejects(prepareAttemptExport(source, context), /already ended/);
      source.replay.summary.status = 'running';
      await assert.rejects(prepareAttemptExport(source), /verification failed/);
    });

test('existing release-before and release-after boundaries survive verification without resuspending', async () => {
  const { live, campaign } = cases[0];
  const restored = await restoreSession(live, { campaign, campaignKey: campaignKey(campaign) });
  stepRun(restored.run, {}, FIXED_DT);
  recordInput(restored.recorder, {});
  const source = suspendSession({ ...restored, ...restored.session, savedAt: stamp });
  assert.equal(source.replay.releaseAfter, true);
  assert.equal(source.replay.segments.at(-1).releaseBefore, true);
  const before = JSON.stringify(source),
    checkpoint = authoritativeCheckpoint(restored.run),
    recording = exportReplay(restored.recorder, restored.run);
  const result = await prepareAttemptExport(source, { campaign });
  assert.equal(JSON.stringify(result.session), before);
  assert.deepEqual(authoritativeCheckpoint(restored.run), checkpoint);
  assert.deepEqual(exportReplay(restored.recorder, restored.run), recording);
});

test('supplied wrong or malformed campaign rejects before progress, never downgrades', async () => {
  const { live, campaign } = cases[0];
  const wrongRevision = copy(campaign);
  wrongRevision.revision = 'another-revision';
  const wrongLevel = copy(campaign);
  wrongLevel.levels[0].goal.coverage = 0.99;
  const malformed = copy(campaign);
  malformed.levels[0].version = 'xonix-level.v999';
  for (const value of [null, {}, wrongRevision, wrongLevel, malformed, cases[2].campaign]) {
    let progress = 0;
    await assert.rejects(
      prepareAttemptExport(live, { campaign: value, onProgress: () => progress++ }),
    );
    assert.equal(progress, 0);
  }
});

test('same claimed key cannot hide a self-consistent different map or full roster', async () => {
  const { live, campaign } = cases[0];
  for (const change of ['level', 'roster']) {
    const level = copy(live.replay.level),
      options = copy(live.replay.options);
    if (change === 'level') level.goal.coverage = 0.99;
    else options.classRecipes.find((recipe) => recipe.id !== options.classId).revision = 'new';
    const run = createRun(level, options),
      recorder = createRecorder(level, options);
    const source = suspendSession({
      run,
      recorder,
      ...envelope(null, campaign),
    });
    assert.equal((await verifyReplayAsync(source.replay)).match, true);
    assert.equal((await prepareAttemptExport(source)).context, 'replay-only');
    await assert.rejects(prepareAttemptExport(source, { campaign }), /rules differ/);
  }
});

test('checkpoint, summary, input, encounter state hashes and mixed version pairs reject', async () => {
  for (const entry of [cases[0], cases[2]]) {
    const changes = [
      (s) => (s.replay.checkpoint.hash = '0000000000000000'),
      (s) => (s.replay.summary.score += 1),
      (s) => (s.replay.segments[0].input.direction = 'left'),
      (s) => (s.replay.version = 'xonix-replay.v999'),
      (s) => (s.replay.ruleset = 'xonix-core.v999'),
      (s) => (s.replay.checkpoint.algorithm = 'fnv1a64-state-v999'),
      (s) =>
        (s.replay.version =
          s.replay.version === 'xonix-replay.v3' ? 'xonix-replay.v4' : 'xonix-replay.v3'),
    ];
    if (entry.live.replay.version === 'xonix-replay.v4')
      changes.push((s) => (s.replay.checkpoint.sections.encounter = '0000000000000000'));
    for (const change of changes) {
      const source = copy(entry.live);
      change(source);
      for (const options of [{}, { campaign: entry.campaign }])
        await assert.rejects(prepareAttemptExport(source, options));
    }
  }
});

test('session and campaign data are owned before yielding; returned data cannot mutate either source', async () => {
  const source = copy(cases[2].recovery),
    original = copy(source),
    campaign = copy(cases[2].campaign);
  const controller = new AbortController();
  let progress = 0;
  const options = { campaign, signal: controller.signal, onProgress: () => progress++ };
  const pending = prepareAttemptExport(source, options);
  source.runId = 'replaced';
  source.savedAt = 'not-a-date';
  source.replay.segments[0].input.direction = 'left';
  campaign.classRecipes[0].revision = 'replaced';
  campaign.levels[0].encounter.initialDelayTicks = 1;
  options.campaign = null;
  options.onProgress = () => assert.fail('Must retain the original host callback.');
  options.signal = AbortSignal.abort();
  const result = await pending;
  assert.deepEqual(result.session, original);
  assert.ok(progress > 0);
  assert.throws(() => (result.session.replay.level.id = 'mutated'), TypeError);
  assert.equal(source.runId, 'replaced');
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(campaign), false);
});

test('options are finite own data fields, with host capabilities checked before candidate access', async () => {
  let reads = 0;
  const accessor = {
    get campaign() {
      reads++;
      return cases[0].campaign;
    },
  };
  const hidden = Object.defineProperty({}, 'campaign', { value: cases[0].campaign });
  const inherited = Object.create({ campaign: cases[0].campaign });
  for (const options of [
    null,
    [],
    'options',
    accessor,
    hidden,
    inherited,
    { [Symbol('extra')]: true },
    { mastery: {} },
    { campaignKey: 'not-a-context' },
    { onProgress: null },
    { onProgress: 1 },
    { signal: null },
    { signal: {} },
    { signal: { aborted: 'false' } },
  ])
    await assert.rejects(prepareAttemptExport(cases[0].live, options), TypeError);
  assert.equal(reads, 0);
});

test('bounded session and campaign snapshots reject malformed data without invoking getters', async () => {
  const { live, campaign } = cases[0];
  let reads = 0;
  for (const field of ['savedAt', 'replay']) {
    const source = copy(live);
    Object.defineProperty(source, field, {
      enumerable: true,
      get() {
        reads++;
        return live[field];
      },
    });
    await assert.rejects(prepareAttemptExport(source), /accessors/);
  }
  const accessor = copy(campaign);
  Object.defineProperty(accessor, 'levels', {
    enumerable: true,
    get() {
      reads++;
      return campaign.levels;
    },
  });
  await assert.rejects(prepareAttemptExport(live, { campaign: accessor }), /accessors/);
  assert.equal(reads, 0);
  const sparse = copy(live);
  delete sparse.replay.segments[0];
  const cyclic = copy(live);
  cyclic.replay.self = cyclic;
  for (const source of [
    null,
    undefined,
    '',
    '{',
    sparse,
    cyclic,
    { ...live, savedAt: '2026-02-31T00:00:00.000Z' },
    { ...live, bodyId: 'javascript:run' },
    { ...live, injected: true },
    '{"__proto__":{}}',
  ])
    await assert.rejects(prepareAttemptExport(source));
  await assert.rejects(prepareAttemptExport(' '.repeat(SESSION_IMPORT_BYTES + 1)), /budget/);
});

test('portable files may exceed the local slot budget without weakening the portable limit', async () => {
  const campaign = await json('../content/campaign.json');
  campaign.classRecipes = CLASSES;
  const level = campaign.levels[0],
    options = { classId: 'scout', classRecipes: CLASSES, seed: 1 };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  // A real idle flight with alternating ordinary pickup input creates a large
  // recording without relying on whitespace padding or invented replay state.
  for (let tick = 0; tick < 20000; tick++) {
    const input = { pickup: tick % 2 === 0 };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'running');
  const source = suspendSession({ run, recorder, ...envelope(null, campaign) });
  const file = JSON.stringify(source),
    bytes = new TextEncoder().encode(file).length;
  assert.ok(bytes > SESSION_STORAGE_BYTES && bytes <= SESSION_IMPORT_BYTES);
  const result = await prepareAttemptExport(file, { campaign });
  assert.deepEqual(result.session, source);
});

for (const installed of [false, true])
  for (const when of ['before', 'during', 'final'])
    test(`${installed ? 'installed' : 'replay-only'} cancellation ${when} cannot return a prepared file`, async () => {
      const { recovery, campaign } = cases[2];
      const controller = new AbortController();
      let progress = 0;
      if (when === 'before') controller.abort();
      await assert.rejects(
        prepareAttemptExport(recovery, {
          ...(installed ? { campaign } : {}),
          signal: controller.signal,
          onProgress: ({ ticks, total }) => {
            progress++;
            if (
              (when === 'during' && ticks > 0 && ticks < total) ||
              (when === 'final' && ticks === total)
            )
              controller.abort();
          },
        }),
        { name: 'AbortError' },
      );
      assert.equal(controller.signal.aborted, true);
      assert.equal(progress === 0, when === 'before');
    });

test('a throwing final progress callback rejects without producing export data', async () => {
  const failure = new Error('Host operation replaced');
  await assert.rejects(
    prepareAttemptExport(cases[0].live, {
      onProgress: ({ ticks, total }) => {
        if (ticks === total) throw failure;
      },
    }),
    (error) => error === failure,
  );
});
