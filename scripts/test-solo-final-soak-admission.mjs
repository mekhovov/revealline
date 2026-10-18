import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  anchoredSoakAssessment,
  bindSustainedJob,
  prepareSustainedMode,
  sustainedArguments,
  sustainedMatrix,
  validateSustainedPlan,
  verifyTimingHitchJournal,
} from './solo-remote-sustained.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
  qualificationHitchJournalOptions,
} from './solo-qualification-hitch-journal.mjs';
import {
  createQualificationSnapshotStore,
  readQualificationSnapshotReport,
} from './solo-qualification-snapshot-store.mjs';
import { qualificationSnapshotStorage } from './solo-qualification.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const load = (path) => readFile(join(root, path));
const original = JSON.parse(await load('docs/performance/solo-remote-sustained-plan.json'));
const source = {
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
  baselineTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  candidate: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  candidateTree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
  runtime: '32abd322afd8243e4537ce4784e2f78ee45ecbec',
};
const recipePath =
  'docs/performance/fixtures/solo-remote-sustained/soak-first-return-anchored.qualification.fixture';
const recipeBytes = await load(recipePath),
  recipe = JSON.parse(recipeBytes);
const reference = async (path) => {
  const bytes = await load(path);
  return { path, bytes: bytes.length, sha256: sha(bytes) };
};
async function manifest() {
  const m = structuredClone(original);
  // Unit-only placeholders exercise shape admission, never publication authority.
  const identity = (run, artifact) => ({
    run,
    artifact,
    outer: { bytes: 100, sha256: 'a'.repeat(64) },
    inner: { bytes: 90, sha256: 'b'.repeat(64) },
    manifestSHA256: 'c'.repeat(64),
  });
  Object.assign(m, {
    sourceCohort: 'soak-main8b-candidatea6e',
    latestSourceRevision: source.candidate,
    latestRuntimeRevision: source.runtime,
    hitchJournal: 'bounded-v1',
    ownedResources: 'source-bounds-v1',
    candidate: { revision: source.candidate, tree: source.candidateTree, ...identity(1, 2) },
    baseline: {
      revision: source.baseline,
      tree: source.baselineTree,
      reusableArtifact: {
        format: 'SoloHostedNormalBaselineReuseV2',
        sourceRevision: source.baseline,
        sourceTree: source.baselineTree,
        name: 'solo-normal-baseline-8b019919-3-1',
        ...identity(3, 4),
        ready: { bytes: 80, sha256: 'd'.repeat(64) },
        producer: {
          repository: m.repository,
          workflow: '.github/workflows/solo-remote-baseline-temporary.yml',
          run: 3,
          attempt: 1,
          toolingRevision: source.candidate,
          toolingTree: source.candidateTree,
        },
      },
    },
  });
  Object.assign(m.release, {
    sourceCohort: m.sourceCohort,
    candidateRevision: source.candidate,
    baselineRevision: source.baseline,
  });
  m.recipes.soak = await reference(recipePath);
  m.adapterInputs = await Promise.all(m.adapterInputs.map((ref) => reference(ref.path)));
  m.frozenTools = await Promise.all(
    [
      'scripts/qualify-solo-runtime.mjs',
      'scripts/solo-qualification-hitch-journal.mjs',
      'scripts/solo-qualification-snapshot-store.mjs',
      'scripts/solo-owned-resource-assessment.mjs',
    ].map(reference),
  );
  return m;
}
async function temporary(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-final-soak-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('final anchored soak binds exact source and original finite observation bounds without changing legacy admission', async () => {
  const m = await manifest();
  const matrix = sustainedMatrix(m).include;
  assert.equal(matrix.length, 6);
  assert(
    matrix.every(
      (job) => job.jobMinutes === 192 && job.stepMinutes === 148 && job.outerSeconds === 147 * 60,
    ),
  );
  let observations = 0;
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const p = bindSustainedJob(m, engine, repetition);
      observations += p.rows.length;
      assert.deepEqual(
        p.rows.map((row) => row.source),
        repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
      );
      assert(p.rows.every((row) => row.timeoutMs === 2640000 && row.performanceExclusion));
      assert.equal(p.helperTimeoutMs, 145 * 60000);
      assert.equal(p.rowEvidenceBytes, 128 * 1024 ** 2);
      assert.equal(p.evidenceBytes, 512 * 1024 ** 2);
      assert.equal(p.calibrationTimeoutMs, 300000);
      assert.equal(p.calibrationPreset, 'mid');
      assert.equal(p.release.firstEightAllCorrectnessPassed, false);
      assert.equal(p.release.predecessorRun, 38985941469);
      assert.equal(
        p.recipes.soak.sha256,
        '079d4dd76fbd914ddd4da7311f8e6cee4a0ff4fc3bc951842b2921c94c53b8ff',
      );
    }
  assert.equal(observations, 12);
  assert.equal(recipe.timeoutMs, 2400000);
  assert.equal(recipe.actions[8].atLeastMs, 1800000);
  assert.equal(recipe.actions[8].count, 360);
  assert.equal(recipe.evidenceStorage, 'snapshot-chunks-v1');
  const before = bindSustainedJob(original, 'webkit', 1);
  assert.equal(before.candidate.revision, '3adcd53792043ef02459e86168c6b33a66d6ef00');
  assert.equal(
    before.recipes.soak.sha256,
    'c5a3c197b828c92a4e737a681153692aa02ab86b24cc62bafc9d070f3fa2b39b',
  );
  for (const mutate of [
    (p) => {
      p.sourceCohort = 'cold-main8b-candidatea6e';
    },
    (p) => {
      p.phase = 'next';
    },
    (p) => {
      p.candidate.revision = before.candidate.revision;
    },
    (p) => {
      p.candidate.tree = 'a'.repeat(40);
    },
    (p) => {
      p.latestRuntimeRevision = 'a'.repeat(40);
    },
    (p) => {
      p.latestSourceRevision = 'a'.repeat(40);
    },
    (p) => {
      p.baseline.publisher = {};
    },
    (p) => {
      p.release.firstEightAllCorrectnessPassed = true;
    },
    (p) => {
      p.release.status = 'reviewed-and-released';
    },
    (p) => {
      delete p.hitchJournal;
    },
    (p) => {
      delete p.ownedResources;
    },
    (p) => {
      p.recipes.soak = before.recipes.soak;
    },
    (p) => {
      p.rowEvidenceBytes++;
    },
    (p) => {
      p.rows[0].timeoutMs++;
    },
    ...[
      'scripts/solo-qualification-snapshot-store.mjs',
      'scripts/solo-owned-resource-assessment.mjs',
      'scripts/solo-qualification-hitch-journal.mjs',
    ].map((path) => (p) => {
      p.frozenTools = p.frozenTools.filter((ref) => ref.path !== path);
    }),
  ]) {
    const changed = bindSustainedJob(m, 'webkit', 1);
    mutate(changed);
    assert.throws(() => validateSustainedPlan(changed));
  }
});

test('anchored matrix preserves the isolated three-module declaration closure', async (t) => {
  const dir = await temporary(t);
  await mkdir(join(dir, 'scripts'));
  for (const path of [
    'solo-remote-sustained.mjs',
    'solo-qualification.mjs',
    'solo-qualification-observation.mjs',
  ])
    await writeFile(join(dir, 'scripts', path), await load('scripts/' + path));
  const m = await manifest(),
    input = join(dir, 'plan.json');
  await writeFile(input, JSON.stringify(m));
  const actual = execFileSync(
    process.execPath,
    [join(dir, 'scripts/solo-remote-sustained.mjs'), 'matrix-plan', input],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 ** 2, cwd: dir },
  );
  assert.equal(actual, `matrix=${JSON.stringify(sustainedMatrix(m))}\n`);
});

test('preparation requires exact anchored bytes, chunk reservation and journal flags without launching a browser', async (t) => {
  const dir = await temporary(t),
    work = join(dir, 'work');
  await mkdir(work);
  const p = bindSustainedJob(await manifest(), 'webkit', 1);
  let admitted = false;
  const ctx = {
    plan: p,
    repository: root,
    here: join(root, 'scripts'),
    work,
    evidence: dir,
    report: {},
    admitted: { artifacts: { candidate: {} } },
    ensureBaseline: async () => {
      admitted = true;
    },
    required: async () => assert.fail('No browser or calibration in this WebKit preparation unit'),
    digest: async (path) => {
      const b = await readFile(path);
      return { bytes: b.length, sha256: sha(b) };
    },
  };
  ctx.modeState = await prepareSustainedMode(ctx);
  assert(admitted);
  assert.deepEqual(await readFile(ctx.modeState.recipePath), recipeBytes);
  assert.deepEqual(ctx.modeState.snapshotStorage, {
    maximumBytes: 96 * 1024 ** 2,
    maximumIndexBytes: 4 * 1024 ** 2,
    maximumSnapshotBytes: 1024 ** 2,
    maximumSnapshots: 512,
  });
  const args = sustainedArguments(
    ctx,
    p.rows[0],
    'http://127.0.0.1:4321/game/?journey=opening',
    dir,
  );
  assert(args.includes('--snapshot-chunks'));
  assert(args.includes('--hitch-journal-preparation=first-return-anchored-v1'));
  assert(!args.includes('--memory-profile'));
  assert.equal(
    qualificationHitchJournalOptions(args, recipe, recipeBytes).preparationPolicy,
    'first-return-anchored-v1',
  );
  assert.throws(() =>
    qualificationHitchJournalOptions(args, recipe, Buffer.concat([recipeBytes, Buffer.from(' ')])),
  );
});

const retained = JSON.parse(
  await load('docs/performance/fixtures/solo-resource-assessment/retained-3ad-soak.fixture'),
);
function ownerModel() {
  // Same explicit synthetic current-schema additions as the pure analyzer tests.
  // The original native fixture and its failures remain byte-identical.
  const value = structuredClone(retained.snapshots[1].application.resources);
  value.pcm.published = {
    decodedBytes: 0,
    decodedBytesLimit: 32 * 1024 ** 2,
    cacheEntries: 0,
    loading: 0,
  };
  value.soundtrack.inspection.workerOwned = true;
  value.soundtrack.playback = {
    ownedBlobURLCount: 1,
    ownedBlobBytes: 4170,
    failedRevocationCount: 0,
    failedRevocationBytes: 0,
    decks: [
      { index: 0, ownedBlobURLCount: 1, ownedBlobBytes: 4170 },
      { index: 1, ownedBlobURLCount: 0, ownedBlobBytes: 0 },
    ],
  };
  return value;
}
function raw(p, role = 'candidate') {
  return {
    format: 'SoloQualificationReportV1',
    scenarioStatus: 'pass',
    scenarioSHA256: p.recipes.soak.sha256,
    sourceRevision: p[role].revision,
    buildIdentity: { sourceRevision: p[role].revision },
    environment: { engine: 'chromium', contextMode: 'ephemeral', browserVersion: '123.4' },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine: 'chromium', browserVersion: '123.4' },
    },
    kind: 'lifecycle',
    scenarioKind: 'lifecycle',
    workProbe: true,
    cadenceProtocol: 'settled120',
    cacheMode: 'fresh-context',
    baselineRuntime: role === 'baseline',
    pageErrors: [],
    resources: recipe.resourceRules.map((rule) => ({ ...rule, status: 'pass' })),
    performanceGateStatus: 'pass-observed-window',
    actions: [{ type: 'repeat', status: 'pass', elapsedMs: 1800000, iterations: 180 }],
    snapshots: Array.from({ length: 10 }, () => ({
      group: 'completed',
      application: { resources: ownerModel() },
    })),
  };
}
const closed = { status: 'closed', exitCode: 0 };
async function journal(t, p) {
  const dir = await temporary(t),
    output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const store = createHitchJournalStore(output, () => 100, {
    soloURL: url,
    preparationPolicy: 'first-return-anchored-v1',
  });
  for (const [i, role] of ['preparation', 'solo'].entries()) {
    const navigation = {
      url: role === 'preparation' ? new URL('playground/', url).href : url,
      action: i ? 'follow-4' : 'initial',
    };
    const allocation = store.beginDocument(navigation);
    let now = 0;
    const location = new URL(navigation.url);
    const env = {
      performance: { now: () => now, timeOrigin: 1700000000000 + i * 1000 },
      location: { origin: location.origin, pathname: location.pathname },
      document: { hidden: false, hasFocus: () => true, addEventListener() {} },
      addEventListener() {},
      btoa: (v) => Buffer.from(v, 'binary').toString('base64'),
    };
    const j = createBrowserHitchJournal({}, env);
    j.configure(allocation);
    j.first(0, 0);
    if (i) j.subscribe(0);
    j.phase(i ? 2 : 6, 0);
    j.frame(0, 40.125, i ? 2 : 6, i ? 2 : 6);
    if (i) {
      j.beginWork(1, 2);
      j.endWork(55.25, 2);
      j.phase(3, 60);
    }
    now = 100;
    await store.retain(
      j.seal(i ? 'paused' : undefined),
      i ? 'final-existing-public-boundary' : 'before-follow-4',
    );
  }
  const value = raw(p);
  value.hitchJournal = store.finish();
  return { value, output, url, dir };
}

test('anchored chunk hydration and binary journal preserve all records before separate retention assessment', async (t) => {
  const p = bindSustainedJob(await manifest(), 'chromium', 1),
    f = await journal(t, p);
  const before = JSON.parse(JSON.stringify(f.value));
  const limits = qualificationSnapshotStorage(['--snapshot-chunks'], recipe);
  const writer = await createQualificationSnapshotStore(f.output, limits);
  await writer.save(f.value);
  const hydrated = await readQualificationSnapshotReport(f.output, limits);
  assert.deepEqual(hydrated, before);
  const verified = await verifyTimingHitchJournal(p, hydrated, f.output, f.url);
  assert.equal(verified.status, 'complete', verified.failure);
  assert.equal(verified.documents, 2);
  const result = await anchoredSoakAssessment(p, p.rows[1], hydrated, closed, '123.4', verified);
  assert.equal(result.numericObservationStatus, 'passed');
  assert.equal(result.ownedResourceBoundsStatus, 'pass');
  assert.equal(result.ownedResourceAssessment.rows.length, 10);
  assert.equal(result.retentionQualification, 'review-required');
  assert.equal(result.ownedResourceAssessment.retention.status, 'requires-owner-trend-review');
  assert.equal(result.status, 'review-required');
  assert.equal(result.performanceQualification, 'not-qualified-diagnostic-only');
  const changed = structuredClone(hydrated);
  changed.hitchJournal.documents.shift();
  assert.equal(
    (await verifyTimingHitchJournal(p, changed, f.output, f.url)).status,
    'invalid-evidence',
  );
  const oldOutput = join(f.dir, 'old-report.json');
  const oldWriter = await createQualificationSnapshotStore(oldOutput, limits);
  await oldWriter.save(structuredClone(retained));
  assert.deepEqual(await readQualificationSnapshotReport(oldOutput, limits), retained);
});

test('missing owners remain inconclusive and budget/protocol failures remain failures without erasing raw gates', async () => {
  const p = bindSustainedJob(await manifest(), 'chromium', 1),
    row = p.rows[1];
  const assess = (r, journal = { status: 'complete' }) =>
    anchoredSoakAssessment(p, row, r, closed, '123.4', journal);
  const missing = raw(p);
  delete missing.snapshots[0].application.resources.soundtrack.inspection.workerOwned;
  const unknown = await assess(missing);
  assert.equal(unknown.numericObservationStatus, 'passed');
  assert.equal(unknown.ownedResourceBoundsStatus, 'inconclusive');
  assert.equal(unknown.status, 'inconclusive');
  for (const mutate of [
    (r) => {
      r.snapshots[0].application.resources.pcm.published.decodedBytes = 32 * 1024 ** 2 + 1;
    },
    (r) => {
      r.replay.nativeVerification.status = 'fail';
    },
    (r) => {
      r.actions[0].elapsedMs--;
    },
    (r) => {
      r.actions[0].iterations = 361;
    },
    (r) => {
      r.sourceRevision = source.baseline;
    },
    (r) => {
      r.performanceGateStatus = 'fail';
    },
    (r) => {
      r.performanceGateStatusBeforeHitchJournal = 'fail';
    },
  ]) {
    const value = raw(p);
    mutate(value);
    const result = await assess(value);
    assert.equal(result.status, 'failed');
    assert.equal(result.rawPerformanceGateStatus, value.performanceGateStatus);
    assert.equal(result.performanceQualification, 'not-qualified-diagnostic-only');
  }
  const empty = raw(p);
  empty.snapshots = [];
  assert.equal((await assess(empty)).status, 'inconclusive');
  assert.equal((await assess(raw(p), { status: 'invalid-evidence' })).status, 'failed');
  const baselineRow = p.rows[0],
    baselineRaw = raw(p, 'baseline');
  baselineRaw.snapshots = structuredClone(retained.snapshots);
  const baseline = await anchoredSoakAssessment(p, baselineRow, baselineRaw, closed, '123.4', {
    status: 'complete',
  });
  assert.equal(baseline.ownedResourceBoundsStatus, 'inconclusive');
  assert.equal(baseline.status, 'inconclusive');
  assert.equal(baseline.ownedResourceAssessment.rows.length, 5);
});

for (const sourceLabel of ['de332', '73']) {
  const sourceRevision =
    sourceLabel === '73'
      ? '73a345cec696d7789198cf295ca5c37b17ca0e71'
      : 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
  async function de332SoakManifest() {
    const m = JSON.parse(
      await load(`docs/performance/solo-${sourceLabel}-lifecycle-soak-plan.json`),
    );
    if (sourceLabel === '73') {
      assert.equal(m.release.status, 'reviewed-diagnostic-only');
      assert.equal(m.release.predecessorRun, 39105055762);
      assert.equal(m.release.evidence[0].scope, 'first-eight-correctness-only');
      const unreleased = structuredClone(m);
      unreleased.release.status = 'held-for-review';
      assert.throws(() => bindSustainedJob(unreleased, 'chromium', 1));
      return m;
    }
    assert.equal(m.release.status, 'held-for-review');
    assert.throws(() => bindSustainedJob(m, 'chromium', 1));
    // Test-only release facts exercise the actual adapter, not release authority.
    Object.assign(m.release, {
      status: 'reviewed-diagnostic-only',
      predecessorRun: 1,
      noUnclosedOwners: true,
      allPriorPlannedJobsClosed: true,
      priorProofInspected: true,
      evidence: [
        {
          runId: 1,
          artifactId: 2,
          artifactSHA256: '0'.repeat(64),
          summarySHA256: '0'.repeat(64),
          disposition: 'failed-reviewed',
        },
      ],
    });
    return m;
  }

  test(`${sourceLabel}: soak retains thirty-minute elapsed duty, twelve arms and exact current source bindings`, async () => {
    const m = await de332SoakManifest();
    assert.equal(m.sourceCohort, `soak-main8b-candidate${sourceLabel}-v1`);
    assert.equal(m.candidate.revision, sourceRevision);
    assert.equal(m.candidate.artifact, sourceLabel === '73' ? 12127570566 : 12123463810);
    assert.equal(m.baseline.reusableArtifact.artifact, 12088541389);
    for (const ref of [...m.frozenTools, ...m.adapterInputs, ...Object.values(m.recipes)])
      assert.deepEqual(await reference(ref.path), ref);
    assert.equal(recipe.actions.find((a) => a.type === 'repeat').atLeastMs, 1800000);
    const jobs = sustainedMatrix(m).include;
    assert.equal(jobs.length, 6);
    assert(
      jobs.every(
        (j) => j.jobMinutes === 192 && j.stepMinutes === 148 && j.outerSeconds === 147 * 60,
      ),
    );
    let arms = 0;
    for (const engine of ['chromium', 'webkit'])
      for (const repetition of [1, 2, 3]) {
        const p = bindSustainedJob(m, engine, repetition);
        arms += p.rows.length;
        assert.deepEqual(
          p.rows.map((r) => r.source),
          repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
        );
        assert(p.rows.every((r) => r.timeoutMs === 2640000 && r.performanceExclusion));
        assert.equal(p.helperTimeoutMs, 145 * 60000);
        assert.equal(p.rowEvidenceBytes, 128 * 1024 ** 2);
        assert.equal(p.evidenceBytes, 512 * 1024 ** 2);
        assert.equal(p.setupTimeoutMs, 40 * 60000);
        assert.equal(p.calibrationTimeoutMs, 300000);
        assert.equal(p.release.firstEightRequired, false);
        for (const mutate of [
          (p) => {
            p.candidate.tree = '0'.repeat(40);
          },
          (p) => {
            p.baseline.reusableArtifact.artifact++;
          },
          (p) => {
            p.recipes.soak.bytes++;
          },
          (p) => {
            p.ownedResources = undefined;
          },
          (p) => {
            p.release.status = 'reviewed-and-released';
          },
          (p) => {
            p.release.predecessorRun = null;
          },
          (p) => {
            p.release.noUnclosedOwners = false;
          },
          (p) => {
            p.release.dispatch.phase = 'retry';
          },
          (p) => {
            p.release.firstEightAllCorrectnessPassed = true;
          },
          (p) => {
            p.rows[0].timeoutMs++;
          },
        ]) {
          const q = structuredClone(p);
          mutate(q);
          assert.throws(() => validateSustainedPlan(q));
        }
      }
    assert.equal(arms, 12);
  });

  test(`${sourceLabel}: soak uses actual anchored preparation, chunk hydration and final-document journal`, async (t) => {
    const p = bindSustainedJob(await de332SoakManifest(), 'webkit', 1),
      dir = await temporary(t),
      work = join(dir, 'work');
    await mkdir(work);
    const ctx = {
      plan: p,
      repository: root,
      here: join(root, 'scripts'),
      work,
      evidence: dir,
      report: {},
      admitted: { artifacts: { candidate: {} } },
      ensureBaseline: async () => {},
      required: async () => assert.fail('No browser/calibration in pure preparation control'),
      digest: async (path) => {
        const b = await readFile(path);
        return { bytes: b.length, sha256: sha(b) };
      },
    };
    ctx.modeState = await prepareSustainedMode(ctx);
    assert.deepEqual(await readFile(ctx.modeState.recipePath), recipeBytes);
    assert.deepEqual(ctx.modeState.snapshotStorage, {
      maximumBytes: 96 * 1024 ** 2,
      maximumIndexBytes: 4 * 1024 ** 2,
      maximumSnapshotBytes: 1024 ** 2,
      maximumSnapshots: 512,
    });
    const args = sustainedArguments(
      ctx,
      p.rows[1],
      'http://127.0.0.1:4321/game/?journey=opening',
      dir,
    );
    assert(args.includes('--snapshot-chunks'));
    assert(!args.includes('--memory-profile'));
    assert.equal(
      qualificationHitchJournalOptions(args, recipe, recipeBytes).preparationPolicy,
      'first-return-anchored-v1',
    );
    const admitted = bindSustainedJob(await de332SoakManifest(), 'chromium', 1),
      f = await journal(t, admitted);
    const limits = qualificationSnapshotStorage(['--snapshot-chunks'], recipe);
    const writer = await createQualificationSnapshotStore(f.output, limits);
    await writer.save(f.value);
    const hydrated = await readQualificationSnapshotReport(f.output, limits);
    assert.deepEqual(hydrated, f.value);
    const verified = await verifyTimingHitchJournal(admitted, hydrated, f.output, f.url);
    assert.equal(verified.status, 'complete', verified.failure);
    assert.equal(verified.documents, 2);
    const result = await anchoredSoakAssessment(
      admitted,
      admitted.rows[1],
      hydrated,
      closed,
      '123.4',
      verified,
    );
    assert.equal(result.numericObservationStatus, 'passed');
    assert.equal(result.ownedResourceBoundsStatus, 'pass');
    assert.equal(result.ownedResourceAssessment.rows.length, 10);
    assert.equal(result.retentionQualification, 'review-required');
    assert.equal(result.status, 'review-required');
    assert.equal(result.performanceQualification, 'not-qualified-diagnostic-only');
    assert.equal(result.firstEightRequired, false);
    const missing = structuredClone(hydrated);
    missing.hitchJournal.documents.shift();
    assert.equal(
      (await verifyTimingHitchJournal(admitted, missing, f.output, f.url)).status,
      'invalid-evidence',
    );
  });

  test(`${sourceLabel}: soak preserves missing-owner uncertainty and elapsed, native, raw and cleanup failures`, async () => {
    const p = bindSustainedJob(await de332SoakManifest(), 'chromium', 1);
    const assess = (r, command = closed, journal = { status: 'complete' }) =>
      anchoredSoakAssessment(p, p.rows[1], r, command, '123.4', journal);
    const missing = raw(p);
    delete missing.snapshots[0].application.resources.soundtrack.inspection.workerOwned;
    assert.equal((await assess(missing)).status, 'inconclusive');
    for (const mutate of [
      (r) => {
        r.actions[0].elapsedMs = 1799999;
      },
      (r) => {
        r.actions[0].iterations = 361;
      },
      (r) => {
        r.replay.nativeVerification.status = 'fail';
      },
      (r) => {
        r.performanceGateStatus = 'fail';
      },
      (r) => {
        r.failure = 'original failure';
      },
      (r) => {
        r.snapshots[0].application.resources.pcm.published.decodedBytes = 32 * 1024 ** 2 + 1;
      },
    ]) {
      const value = raw(p);
      mutate(value);
      const result = await assess(value);
      assert.equal(result.status, 'failed');
      assert.equal(result.rawPerformanceGateStatus, value.performanceGateStatus);
    }
    assert.equal((await assess(raw(p), { status: 'failed', exitCode: 2 })).status, 'failed');
    assert.equal((await assess(raw(p), closed, { status: 'invalid-evidence' })).status, 'failed');
  });
}
