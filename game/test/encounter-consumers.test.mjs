import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { ENCOUNTER_VERSIONS } from '../core/versions.mjs';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  verifyReplayAsync,
  snapshotReplay,
} from '../replay.mjs';
import { prepareReplayPlayer } from '../replay-player.mjs';
import { suspendSession, restoreSession, saveSession } from '../sessions.mjs';
import {
  emptyLibrary,
  campaignKey,
  importLibrary,
  exportLibrary,
  progressFor,
  recordLibraryCompletion,
  boardIdentity,
} from '../library.mjs';
import { emptyProgress, awardCompletion, validateProgress } from '../progress.mjs';
import { campaignContinuation, campaignSelection } from '../continuation.mjs';
import { createMasteryCatalog, resolveMasteryContext } from '../mastery-catalog.mjs';
import { STEADY_SIGNAL } from '../mastery.mjs';

const source = JSON.parse(
  await readFile(
    new URL('../../authoring/library/sentinel-relay/proposedpack-source.json', import.meta.url),
    'utf8',
  ),
);
const campaign = { ...source.campaigns[0], classRecipes: source.classRecipes };
const level = campaign.levels[0];
const key = campaignKey(campaign);
function flight(policy = 'immediate', until = 300) {
  const options = {
    seed: 1,
    turnPolicy: policy,
    classId: 'scout',
    classRecipes: campaign.classRecipes,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'encounter-consumers');
  for (let i = 0; i < until; i++) {
    const input = { direction: null };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  return {
    run,
    recorder,
    campaignKey: key,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: `encounter-${policy}`,
    savedAt: '2026-09-12T12:00:00.000Z',
  };
}
function ordinaryWin(policy) {
  const f = flight(policy, 0);
  const send = (direction, ticks) => {
    for (let i = 0; i < ticks && f.run.status !== 'won'; i++) {
      stepRun(f.run, { direction }, FIXED_DT);
      recordInput(f.recorder, { direction });
    }
  };
  send('up', 270);
  send('right', 180);
  send(null, 116);
  send('down', 525);
  send('right', 120);
  for (let waited = 0; f.run.encounter.phase !== 'open'; waited++) {
    assert.ok(waited < 6000, 'The opening must arrive within the bounded ordinary route.');
    send(null, 1);
  }
  send('up', 90);
  send('left', 120);
  assert.equal(f.run.status, 'won');
  return f;
}
for (const policy of ['immediate', 'grid-center']) {
  test(`encounter ${policy}: sync, asynchronous and theater paths retain complete v4 authority`, async () => {
    const f = ordinaryWin(policy),
      recording = exportReplay(f.recorder, f.run);
    assert.equal(recording.version, ENCOUNTER_VERSIONS.replayVersion);
    assert.equal(recording.ruleset, ENCOUNTER_VERSIONS.ruleset);
    assert.equal(recording.checkpoint.algorithm, ENCOUNTER_VERSIONS.checkpointAlgorithm);
    assert.ok(recording.checkpoint.sections.encounter);
    assert.equal(verifyReplay(recording).match, true);
    assert.equal((await verifyReplayAsync(JSON.stringify(recording))).match, true);
    for (const rate of [0.5, 1, 2]) {
      const player = await prepareReplayPlayer(recording);
      player.setRate(rate);
      player.play();
      while (player.phase === 'playing') player.advance(1 / 30);
      assert.deepEqual(player.finalCheckpoint, {
        matched: true,
        hash: recording.checkpoint.hash,
        algorithm: recording.checkpoint.algorithm,
      });
      assert.deepEqual(authoritativeCheckpoint(player.state), recording.checkpoint);
      assert.equal(player.state.encounter.defeated, true);
    }
  });
  test(`encounter ${policy}: delay, warning and active saves reconstruct without injected state`, async () => {
    for (const tick of [100, 300, 500]) {
      const f = flight(policy, tick),
        saved = suspendSession(f);
      const restored = await restoreSession(saved, { campaign, campaignKey: key });
      assert.deepEqual(restored.run.encounter, f.run.encounter);
      assert.deepEqual(authoritativeCheckpoint(restored.run), saved.replay.checkpoint);
      for (let i = 0; i < 35; i++) {
        const input = { direction: 'up' };
        for (const value of [f, restored]) {
          stepRun(value.run, input, FIXED_DT);
          recordInput(value.recorder, input);
        }
      }
      assert.deepEqual(
        exportReplay(restored.recorder, restored.run),
        exportReplay(f.recorder, f.run),
      );
    }
  });
  test(`encounter ${policy}: ordinary progress, local scores, chapter continuation and portable library`, () => {
    const f = ordinaryWin(policy),
      result = getSummary(f.run),
      before = emptyProgress(campaign);
    assert.equal(
      awardCompletion(
        before,
        campaign,
        { ...result, ruleset: 'xonix-core.v2' },
        { runId: 'wrong' },
      ),
      before,
    );
    assert.equal(
      awardCompletion(before, campaign, result, { runId: 'practice', practice: true }),
      before,
    );
    const library = recordLibraryCompletion(emptyLibrary(), {
      campaign,
      result,
      runId: f.runId,
      themeId: 'fpv',
      bodyId: 'fpv-body',
      sourcePackId: source.id,
      completedAt: f.savedAt,
    });
    assert.equal(library.gallery.length, 1);
    assert.equal(library.scores.length, 1);
    assert.deepEqual(library.masteries, []);
    const imported = importLibrary(exportLibrary(library), { campaigns: [campaign] });
    assert.deepEqual(JSON.parse(exportLibrary(imported)), JSON.parse(exportLibrary(library)));
    const progress = progressFor(imported, campaign);
    assert.equal(validateProgress(progress, campaign), true);
    assert.equal(campaignContinuation(progress, campaign).complete, true);
    assert.equal(campaignSelection(progress, campaign).overview, true);
    assert.equal(campaignSelection(progress, campaign, { levelId: level.id }).explicit, true);
    assert.equal(
      library.scores[0].boardId,
      boardIdentity({
        campaign,
        level,
        recipe: campaign.classRecipes.find((r) => r.id === 'scout'),
        seed: 1,
        turnPolicy: policy,
        classRoute: ['scout'],
      }),
    );
  });
}

test('every encounter state field and nested configuration field changes authoritative checksums', () => {
  const f = flight(),
    original = authoritativeCheckpoint(f.run);
  assert.deepEqual(
    Object.keys(f.run.encounter).sort(),
    [
      'version',
      'kind',
      'stage',
      'phase',
      'phaseStartTick',
      'phaseEndTick',
      'axis',
      'lane',
      'cycle',
      'defeated',
      'transitionTick',
      'defeatTick',
      'defeatCause',
      'qualifyingCutCells',
    ].sort(),
  );
  for (const [name, value] of Object.entries(f.run.encounter)) {
    const run = structuredClone(f.run);
    run.encounter[name] =
      typeof value === 'number'
        ? value + 1
        : typeof value === 'boolean'
          ? !value
          : value === null
            ? 1
            : `${value}-changed`;
    const checkpoint = authoritativeCheckpoint(run);
    assert.notEqual(checkpoint.sections.encounter, original.sections.encounter, name);
    assert.notEqual(checkpoint.hash, original.hash, name);
  }
  for (const [name, value] of Object.entries(f.run.level.encounter)) {
    const paths =
      typeof value === 'object' ? Object.keys(value).map((child) => [name, child]) : [[name]];
    for (const path of paths) {
      const run = structuredClone(f.run),
        target = path.length === 2 ? run.level.encounter[path[0]] : run.level.encounter;
      const leaf = path.at(-1),
        old = target[leaf];
      target[leaf] = typeof old === 'number' ? old + 1 : `${old}-changed`;
      assert.notEqual(
        authoritativeCheckpoint(run).sections.configuration,
        original.sections.configuration,
        path.join('.'),
      );
    }
  }
});
test('self-consistent forged encounter section checksums cannot inject phase state or a victory', async () => {
  const f = flight(),
    recording = exportReplay(f.recorder, f.run);
  const changedRun = structuredClone(f.run);
  changedRun.encounter.defeated = true;
  changedRun.encounter.stage = 'defeated';
  const forged = { ...recording, checkpoint: authoritativeCheckpoint(changedRun) };
  const checked = verifyReplay(forged);
  assert.equal(checked.match, false);
  assert.equal(checked.state.encounter.defeated, false);
  assert.ok(checked.diagnostics.some((d) => d.section === 'encounter'));
  await assert.rejects(prepareReplayPlayer(forged), /verification failed/);
  const saved = suspendSession(f);
  saved.replay = forged;
  await assert.rejects(
    restoreSession(saved, { campaign, campaignKey: key }),
    /verification failed/,
  );
});
test('invalid cross-version combinations fail before simulation, save writes or mastery observation', async () => {
  const f = flight(),
    saved = suspendSession(f);
  const variants = [
    (r) => {
      r.version = 'xonix-replay.v3';
    },
    (r) => {
      r.ruleset = 'xonix-core.v2';
    },
    (r) => {
      r.level.version = 'xonix-level.v1';
    },
    (r) => {
      r.checkpoint.algorithm = 'fnv1a64-state-v2';
    },
    (r) => {
      delete r.checkpoint.sections.encounter;
      r.checkpoint.hash = dataIdentity(r.checkpoint.sections);
    },
    (r) => {
      r.encounter = {};
    },
  ];
  for (const change of variants) {
    const replay = structuredClone(saved.replay);
    change(replay);
    assert.throws(() => snapshotReplay(replay));
    await assert.rejects(verifyReplayAsync(replay));
    await assert.rejects(restoreSession({ ...saved, replay }, { campaign, campaignKey: key }));
  }
  const invalid = structuredClone(saved);
  invalid.replay.ruleset = 'xonix-core.v2';
  let writes = 0;
  assert.equal(
    saveSession(
      {
        setItem() {
          writes++;
        },
      },
      'slot',
      invalid,
    ).ok,
    false,
  );
  assert.equal(writes, 0);
  await assert.rejects(
    verifyReplayAsync(saved.replay, {
      mastery: {
        definition: STEADY_SIGNAL,
        campaignId: campaign.id,
        campaignKey: key,
        runId: 'unsupported-seal',
      },
    }),
    /legacy core v2/,
  );
});
test('installed encounter configuration and mixed campaigns cannot alias legacy identities or restores', async () => {
  const old = JSON.parse(
    await readFile(new URL('./fixtures/compatibility-v0100.json', import.meta.url)),
  ).campaign;
  const mixed = { ...campaign, levels: [level, old.levels[0]] };
  assert.throws(() => campaignKey(mixed), /mix/);
  assert.equal(validateProgress(emptyProgress(mixed), mixed), false);
  const changed = structuredClone(campaign);
  changed.levels[0].encounter.laneWidth += 0.1;
  assert.notEqual(campaignKey(changed), key);
  const saved = suspendSession(flight());
  await assert.rejects(
    restoreSession(saved, { campaign: changed, campaignKey: key }),
    /rules differ/,
  );
  await assert.rejects(
    restoreSession(saved, { campaign: old, campaignKey: key }),
    /simulation versions/,
  );
  const entry = {
    campaign,
    sourcePackId: source.id,
    sourcePackFormat: 'xonix-pack.v3',
    masteries: [],
  };
  const catalog = createMasteryCatalog([entry, { campaign: old, sourcePackId: null }]);
  assert.deepEqual(catalog.registrations, []);
  assert.equal(catalog.get(key, level.id), null);
  assert.throws(
    () => createMasteryCatalog([{ ...entry, masteries: [STEADY_SIGNAL] }]),
    /requires masteries/,
  );
  assert.throws(
    () => createMasteryCatalog([{ ...entry, sourcePackFormat: 'xonix-pack.v2' }]),
    /simulation versions/,
  );
  assert.throws(
    () => resolveMasteryContext({ campaign, definition: STEADY_SIGNAL }),
    /legacy core v2/,
  );
});
test('cancelled encounter verification leaves its owned recording unchanged', async () => {
  const f = flight(),
    recording = exportReplay(f.recorder, f.run),
    before = canonicalJSON(recording);
  const controller = new AbortController();
  await assert.rejects(
    verifyReplayAsync(recording, {
      chunkTicks: 1,
      signal: controller.signal,
      onProgress: ({ ticks }) => {
        if (ticks > 0) controller.abort();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(canonicalJSON(recording), before);
});
test('direct async encounter verification snapshots its input before the first yield', async () => {
  const f = ordinaryWin('immediate'),
    recording = exportReplay(f.recorder, f.run);
  const expected = recording.checkpoint.hash;
  const pending = verifyReplayAsync(recording);
  recording.level.encounter.transitionTicks = 1;
  recording.segments[0].input.direction = 'down';
  recording.summary.score = 1;
  const verified = await pending;
  assert.equal(verified.match, true);
  assert.equal(verified.actual.checkpoint.hash, expected);
});
