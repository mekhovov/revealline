import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  bindSustainedJob,
  sustainedMatrix,
  validateSustainedPlan,
  prepareSustainedMode,
  sustainedArguments,
  verifyTimingHitchJournal,
  finalLifecycleAssessment,
} from './solo-remote-sustained.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
  qualificationHitchJournalOptions,
} from './solo-qualification-hitch-journal.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const load = (path) => readFile(join(root, path));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const original = JSON.parse(await load('docs/performance/solo-final-soak-plan.json'));
const recipes = Object.fromEntries(
  await Promise.all(
    ['next', 'retry', 'long29'].map(async (phase) => {
      const path = `docs/performance/fixtures/solo-remote-sustained/${phase === 'long29' ? phase : `${phase}-first-return-anchored`}.qualification.fixture`;
      const bytes = await load(path);
      return [
        phase,
        {
          path,
          bytes,
          value: JSON.parse(bytes),
          ref: { path, bytes: bytes.length, sha256: sha(bytes) },
        },
      ];
    }),
  ),
);
const phaseValues = {
  next: { previous: 'soak', row: 1440000, helper: 105, job: 152 },
  retry: { previous: 'next', row: 1140000, helper: 95, job: 142 },
  long29: { previous: 'diagnostics', row: 2640000, helper: 145, job: 192 },
};
async function manifest(phase) {
  const m = structuredClone(original);
  m.phase = phase;
  m.sourceCohort = `${phase}-main8b-candidatea6e`;
  delete m.ownedResources;
  m.recipes[phase] = recipes[phase].ref;
  Object.assign(m.release, {
    phase,
    previousPhase: phaseValues[phase].previous,
    sourceCohort: m.sourceCohort,
  });
  for (const name of ['adapterInputs', 'frozenTools'])
    m[name] = await Promise.all(
      m[name].map(async (r) => {
        const bytes = await load(r.path);
        return { path: r.path, bytes: bytes.length, sha256: sha(bytes) };
      }),
    );
  return m;
}
async function temporary(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-final-lifecycle-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('three final lifecycle phases preserve exact routes, twelve arms, source order and finite limits', async () => {
  for (const phase of Object.keys(recipes)) {
    const m = await manifest(phase),
      spec = phaseValues[phase];
    const matrix = sustainedMatrix(m).include;
    assert.equal(matrix.length, 6);
    assert(
      matrix.every(
        (job) =>
          job.jobMinutes === spec.job &&
          job.stepMinutes === spec.helper + 3 &&
          job.outerSeconds === (spec.helper + 2) * 60,
      ),
    );
    let count = 0;
    for (const engine of ['chromium', 'webkit'])
      for (const repetition of [1, 2, 3]) {
        const p = bindSustainedJob(m, engine, repetition);
        assert.deepEqual(
          p.rows.map((r) => r.source),
          repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
        );
        count += p.rows.length;
        assert(p.rows.every((r) => r.timeoutMs === spec.row && r.performanceExclusion));
        assert.equal(p.helperTimeoutMs, spec.helper * 60000);
        assert.equal(p.rowEvidenceBytes, 128 * 1024 ** 2);
        assert.equal(p.evidenceBytes, 512 * 1024 ** 2);
        assert.equal(p.setupTimeoutMs, 40 * 60000);
        assert.equal(p.calibrationTimeoutMs, 300000);
        assert.equal(p.release.firstEightAllCorrectnessPassed, false);
        assert.equal(p.recipes[phase].sha256, recipes[phase].ref.sha256);
      }
    assert.equal(count, 12);
  }
  assert.equal(recipes.next.value.actions.filter((a) => a.selector === '#next-button').length, 10);
  assert.equal(recipes.next.value.actions.filter((a) => a.type === 'result').length, 11);
  assert.equal(recipes.retry.value.actions[8].count, 20);
  assert.equal(recipes.long29.value.actions[3].atLeastMs, 1740000);
  assert.equal(recipes.long29.value.actions[8].type, 'reload');
});

test('final lifecycle admission rejects phase, source, recipe, journal and ownership widening', async () => {
  for (const phase of Object.keys(recipes)) {
    const p = bindSustainedJob(await manifest(phase), 'chromium', 1);
    for (const mutate of [
      (p) => {
        p.sourceCohort = 'soak-main8b-candidatea6e';
      },
      (p) => {
        p.candidate.revision = p.baseline.revision;
      },
      (p) => {
        p.candidate.tree = 'f'.repeat(40);
      },
      (p) => {
        p.latestRuntimeRevision = p.candidate.revision;
      },
      (p) => {
        p.baseline.publisher = {};
      },
      (p) => {
        p.release.firstEightAllCorrectnessPassed = true;
      },
      (p) => {
        p.rows[0].timeoutMs++;
      },
      (p) => {
        p.rowEvidenceBytes++;
      },
      (p) => {
        p.helperTimeoutMs++;
      },
      (p) => {
        p.hitchJournal = undefined;
      },
      (p) => {
        p.ownedResources = 'source-bounds-v1';
      },
      (p) => {
        p.recipes[phase].sha256 = 'f'.repeat(64);
      },
      (p) => {
        p.frozenTools = p.frozenTools.filter(
          (r) => !r.path.endsWith('solo-qualification-hitch-journal.mjs'),
        );
      },
    ]) {
      const changed = structuredClone(p);
      mutate(changed);
      assert.throws(() => validateSustainedPlan(changed));
    }
  }
});

test('actual three-module declaration CLI admits all three exact lifecycle phases without dependencies', async (t) => {
  const dir = await temporary(t);
  await mkdir(join(dir, 'scripts'));
  for (const name of [
    'solo-remote-sustained.mjs',
    'solo-qualification.mjs',
    'solo-qualification-observation.mjs',
  ])
    await writeFile(join(dir, 'scripts', name), await load('scripts/' + name));
  for (const phase of Object.keys(recipes)) {
    const m = await manifest(phase),
      input = join(dir, 'manifest.json');
    await writeFile(input, JSON.stringify(m));
    const result = execFileSync(
      process.execPath,
      [join(dir, 'scripts/solo-remote-sustained.mjs'), 'matrix-plan', input],
      { cwd: dir, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 ** 2 },
    );
    assert.equal(result, `matrix=${JSON.stringify(sustainedMatrix(m))}\n`);
  }
});

test('prepared bytes and policy flags preserve public routes, memory exclusion and inline snapshots', async (t) => {
  for (const phase of Object.keys(recipes)) {
    const dir = await temporary(t),
      work = join(dir, 'work');
    await mkdir(work);
    const p = bindSustainedJob(await manifest(phase), 'webkit', 1);
    const ctx = {
      plan: p,
      repository: root,
      here: join(root, 'scripts'),
      work,
      evidence: dir,
      report: {},
      admitted: { artifacts: { candidate: {} } },
      ensureBaseline: async () => {},
      required: async () => assert.fail('No browser/calibration in WebKit preparation unit'),
      digest: async (path) => {
        const b = await readFile(path);
        return { bytes: b.length, sha256: sha(b) };
      },
    };
    ctx.modeState = await prepareSustainedMode(ctx);
    assert.deepEqual(await readFile(ctx.modeState.recipePath), recipes[phase].bytes);
    assert.equal(ctx.modeState.snapshotStorage, null);
    for (const engine of ['chromium', 'webkit']) {
      const row = { ...p.rows[1], engine };
      const args = sustainedArguments(ctx, row, 'http://127.0.0.1:4321/game/?journey=opening', dir);
      assert(args.includes('--hitch-journal'));
      assert(!args.includes('--snapshot-chunks'));
      assert.equal(args.includes('--memory-profile'), phase === 'retry' && engine === 'chromium');
      const options = qualificationHitchJournalOptions(
        args,
        recipes[phase].value,
        recipes[phase].bytes,
      );
      assert.equal(
        options.preparationPolicy,
        phase === 'retry' ? 'first-return-retry-anchored-v1' : undefined,
      );
      assert.equal(
        options.activeDocumentPolicy,
        phase === 'long29' ? 'first-before-reload-v1' : undefined,
      );
    }
  }
});

test('new journal policies require exact immutable recipes and cannot be combined or broadened', () => {
  const first = '--hitch-journal-active-document=first-before-reload-v1';
  const retry = '--hitch-journal-preparation=first-return-retry-anchored-v1';
  for (const [phase, flag] of [
    ['long29', first],
    ['retry', retry],
  ]) {
    const f = recipes[phase],
      flags = ['--hitch-journal', '--work-probe', flag];
    assert(qualificationHitchJournalOptions(flags, f.value, f.bytes));
    for (const invalid of [
      [flag],
      [...flags, flag],
      [...flags, phase === 'long29' ? retry : first],
      flags.map((x) => (x === flag ? flag + '-other' : x)),
    ])
      assert.throws(() => qualificationHitchJournalOptions(invalid, f.value, f.bytes));
    assert.throws(() =>
      qualificationHitchJournalOptions(flags, f.value, Buffer.concat([f.bytes, Buffer.from(' ')])),
    );
    assert.throws(() =>
      qualificationHitchJournalOptions(flags, { ...f.value, timeoutMs: 2400001 }, f.bytes),
    );
  }
});

async function journalFixture(
  t,
  phase,
  { activeRestored = false, omitRestored = false, defaultPolicy = false, prospectiveManifest } = {},
) {
  const dir = await temporary(t),
    output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const flags = [
    '--hitch-journal',
    '--work-probe',
    ...(phase === 'retry'
      ? ['--hitch-journal-preparation=first-return-retry-anchored-v1']
      : phase === 'long29'
        ? ['--hitch-journal-active-document=first-before-reload-v1']
        : []),
  ];
  const options = qualificationHitchJournalOptions(
    flags,
    recipes[phase].value,
    recipes[phase].bytes,
  );
  const store = createHitchJournalStore(output, () => 100, {
    ...(defaultPolicy ? {} : options),
    soloURL: url,
  });
  const count = phase === 'next' || omitRestored ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const prep = phase === 'retry' && i === 0;
    const active = phase === 'long29' ? i === 0 || activeRestored : !prep;
    const navigation = {
      url: prep ? new URL('playground/', url).href : url,
      action: i ? (phase === 'retry' ? 'follow-4' : 'reload-8') : 'initial',
    };
    const allocation = store.beginDocument(navigation);
    let now = 0;
    const location = new URL(navigation.url);
    const j = createBrowserHitchJournal(
      {},
      {
        performance: { now: () => now, timeOrigin: 1700000000000 + i * 1000 },
        location: { origin: location.origin, pathname: location.pathname },
        document: { hidden: false, hasFocus: () => true, addEventListener() {} },
        addEventListener() {},
        btoa: (v) => Buffer.from(v, 'binary').toString('base64'),
      },
    );
    j.configure(allocation);
    j.first(0, 0);
    if (!prep) j.subscribe(0);
    const p = prep ? 6 : active ? 2 : 3;
    j.phase(p, 0);
    j.frame(0, 40.125, p, p);
    if (!prep) {
      j.beginWork(1, p);
      j.endWork(55.25, p);
      j.phase(3, 60);
    }
    now = 100;
    await store.retain(
      j.seal(prep ? undefined : 'paused'),
      prep
        ? 'before-follow-4'
        : phase === 'long29' && i === 0
          ? 'before-reload-8'
          : 'final-existing-public-boundary',
    );
  }
  const plan = bindSustainedJob(prospectiveManifest ?? (await manifest(phase)), 'chromium', 1);
  return { plan, output, url, raw: { hitchJournal: store.finish() }, store };
}

test('real binary readback uses the first recording document and retains the paused zero-active restoration', async (t) => {
  for (const phase of Object.keys(recipes)) {
    const f = await journalFixture(t, phase);
    const result = await verifyTimingHitchJournal(f.plan, f.raw, f.output, f.url);
    assert.equal(result.status, 'complete', result.failure);
    assert.equal(result.documents, phase === 'next' ? 1 : 2);
    assert.equal(
      result.activePlayCoverage,
      phase === 'long29' ? 'observed-first-solo-before-reload' : 'observed-final-solo',
    );
    assert.equal(result.activeElapsedMs, 40.125);
    if (phase === 'long29') {
      assert.equal(result.activeDocument, 1);
      assert.equal(result.documentCoverage[0].activeFrames, 1);
      assert.equal(result.documentCoverage[1].activeFrames, 0);
      assert.equal(
        result.records,
        f.raw.hitchJournal.documents.reduce((sum, d) => sum + d.header.records, 0),
      );
    }
  }
});

test('long recording rejects missing, wrong or newly active restored documents without borrowing their timing', async (t) => {
  for (const mode of [{ activeRestored: true }, { omitRestored: true }, { defaultPolicy: true }]) {
    const f = await journalFixture(t, 'long29', mode);
    assert.equal(f.raw.hitchJournal.status, 'incomplete');
    assert.equal(
      (await verifyTimingHitchJournal(f.plan, f.raw, f.output, f.url)).status,
      'invalid-evidence',
    );
  }
  const f = await journalFixture(t, 'long29');
  for (const mutate of [
    (r) => {
      r.hitchJournal.activeDocumentPolicy = undefined;
    },
    (r) => {
      r.hitchJournal.activePlayCoverage = 'observed-final-solo';
    },
    (r) => {
      r.hitchJournal.documents.reverse();
    },
    (r) => {
      r.hitchJournal.documents[0].boundary = 'before-reload-1';
    },
    (r) => {
      r.hitchJournal.documents[1].header.publicPhase = 'result';
    },
    (r) => {
      r.hitchJournal.documents[1].header.activeFrames = 1;
    },
    (r) => {
      r.hitchJournal.documents[1].header.records++;
    },
    (r) => {
      r.performanceGateStatusBeforeHitchJournal = 'fail';
    },
  ]) {
    const raw = structuredClone(f.raw);
    mutate(raw);
    assert.equal(
      (await verifyTimingHitchJournal(f.plan, raw, f.output, f.url)).status,
      'invalid-evidence',
    );
  }
  assert.throws(() => f.store.beginDocument({ url: f.url, action: 'reload-8' }));
});

function rawProtocol(plan) {
  const phase = plan.phase,
    recipe = recipes[phase].value;
  const actions = recipe.actions.map((a, i) => ({
    path: String(i),
    type: a.type,
    label: a.label ?? null,
    status: 'pass',
    ...(a.type === 'repeat' ? { iterations: a.count, elapsedMs: a.atLeastMs ?? 200000 } : {}),
  }));
  const hash = 'a'.repeat(64),
    replay = {
      scope: 'completed-scenario',
      bytes: 1000,
      sha256: hash,
      nativeVerification: { status: 'pass', engine: 'chromium', browserVersion: '123.4' },
    };
  return {
    scenarioStatus: 'pass',
    scenarioSHA256: plan.recipes[phase].sha256,
    sourceRevision: plan.candidate.revision,
    buildIdentity: { sourceRevision: plan.candidate.revision },
    environment: { engine: 'chromium', contextMode: 'ephemeral', browserVersion: '123.4' },
    replay,
    kind: phase === 'retry' ? 'memory-profile' : recipe.kind,
    scenarioKind: recipe.kind,
    workProbe: true,
    cadenceProtocol: 'settled120',
    cacheMode: 'fresh-context',
    baselineRuntime: false,
    pageErrors: [],
    resources: (recipe.resourceRules ?? []).map((r) => ({ ...r, status: 'pass' })),
    performanceGateStatus: phase === 'retry' ? 'excluded-memory-profiling' : 'pass-observed-window',
    actions,
    snapshots:
      phase === 'next'
        ? Array.from({ length: 11 }, () => ({ group: 'next-result' }))
        : phase === 'retry'
          ? [...Array.from({ length: 20 }, () => ({ group: 'completed' })), { group: 'last-retry' }]
          : [
              {
                group: 'continuous-recording-paused',
                phase: 'paused',
                application: null,
                probe: null,
              },
              {
                group: 'restored-continuous-recording-paused',
                phase: 'paused',
                application: null,
                probe: null,
              },
            ],
    ...(phase === 'long29'
      ? {
          replayIdentity: {
            format: 'SoloPublicReplayIdentityPairV1',
            mode: 'exact-public-bytes-pair',
            status: 'pass',
            observations: [
              { bytes: 1000, sha256: hash },
              { bytes: 1000, sha256: hash },
            ],
          },
        }
      : {}),
  };
}
const closed = { status: 'closed', exitCode: 0 };
test('final lifecycle assessment keeps complete route checks, raw failures and memory exclusions separate', async () => {
  for (const phase of Object.keys(recipes)) {
    const p = bindSustainedJob(await manifest(phase), 'chromium', 1),
      row = p.rows[1],
      raw = rawProtocol(p);
    const assess = (r, journal = { status: 'complete' }) =>
      finalLifecycleAssessment(p, row, r, closed, '123.4', journal);
    const result = assess(raw);
    assert.equal(result.correctness, 'pass');
    assert.equal(result.protocolStatus, 'pass');
    assert.equal(result.status, phase === 'long29' ? 'failed' : 'passed');
    assert.equal(result.performanceQualification, 'not-qualified-diagnostic-only');
    if (phase === 'long29') {
      assert.equal(result.preReloadPerformance.status, 'inconclusive');
      assert.equal(result.finalDocumentPerformanceGateStatus, 'pass-observed-window');
    }
    for (const mutate of [
      (r) => {
        r.actions.pop();
      },
      (r) => {
        r.workProbe = false;
      },
      (r) => {
        r.replay.nativeVerification.status = 'fail';
      },
      (r) => {
        r.performanceGateStatusBeforeHitchJournal = 'fail';
      },
      (r) => {
        r.failure = 'retained original failure';
      },
    ]) {
      const changed = structuredClone(raw);
      mutate(changed);
      assert.equal(assess(changed).status, 'failed');
    }
    assert.equal(assess(raw, { status: 'invalid-evidence' }).status, 'failed');
    if (phase !== 'long29') {
      const changed = structuredClone(raw);
      changed.snapshots.pop();
      assert.equal(assess(changed).protocolStatus, 'fail');
    }
    if (phase === 'retry') {
      const changed = structuredClone(raw);
      changed.actions[8].iterations = 19;
      assert.equal(assess(changed).status, 'failed');
      const failedChild = structuredClone(raw);
      failedChild.actions.push({ path: '8.0.0', type: 'key', status: 'fail' });
      assert.equal(assess(failedChild).protocolStatus, 'fail');
    }
    if (phase === 'next') {
      const changed = structuredClone(raw);
      changed.performanceGateStatus = 'fail';
      const failed = assess(changed);
      assert.equal(failed.status, 'failed');
      assert.equal(failed.rawPerformanceGateStatus, 'fail');
    }
  }
});

for (const sourceLabel of ['de332', '797']) {
  const sourceRevision =
    sourceLabel === '797'
      ? '797e03f28743921842df6aa57520a72016ba3dfc'
      : 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
  async function de332Manifest(phase) {
    const m = JSON.parse(
      await load(`docs/performance/solo-${sourceLabel}-lifecycle-${phase}-plan.json`),
    );
    assert.equal(m.release.status, 'held-for-review');
    assert.throws(() => bindSustainedJob(m, 'chromium', 1));
    // Synthetic release facts test admission shape, never grant remote authority.
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
    if (sourceLabel === '797') {
      m.release.firstEightAllCorrectnessPassed = true;
      m.release.firstEightEvidence = {
        format: 'SoloFirstEightCorrectnessEvidenceV1',
        sourceRevision,
        runId: 1,
        artifactId: 2,
        artifactSHA256: '0'.repeat(64),
        summarySHA256: '0'.repeat(64),
        correctness: 'passed',
        ownersClosed: true,
      };
    }
    return m;
  }

  test(`${sourceLabel}: lifecycle retry and long recording retain exact twelve-arm comparisons and immutable recipes`, async () => {
    for (const phase of ['retry', 'long29']) {
      const m = await de332Manifest(phase),
        spec = phaseValues[phase];
      assert.equal(m.sourceCohort, `${phase}-main8b-candidate${sourceLabel}-v1`);
      assert.equal(m.candidate.revision, sourceRevision);
      assert.equal(m.candidate.artifact, sourceLabel === '797' ? 12128990483 : 12123463810);
      assert.equal(m.baseline.reusableArtifact.artifact, 12088541389);
      for (const ref of [...m.frozenTools, ...m.adapterInputs, ...Object.values(m.recipes)]) {
        const bytes = await load(ref.path);
        assert.equal(bytes.length, ref.bytes, ref.path);
        assert.equal(sha(bytes), ref.sha256, ref.path);
      }
      const jobs = sustainedMatrix(m).include;
      assert.equal(jobs.length, 6);
      assert(
        jobs.every(
          (j) =>
            j.jobMinutes === spec.job &&
            j.stepMinutes === spec.helper + 3 &&
            j.outerSeconds === (spec.helper + 2) * 60,
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
          assert(p.rows.every((r) => r.timeoutMs === spec.row && r.performanceExclusion));
          assert.equal(p.helperTimeoutMs, spec.helper * 60000);
          assert.equal(p.rowEvidenceBytes, 128 * 1024 ** 2);
          assert.equal(p.evidenceBytes, 512 * 1024 ** 2);
          assert.equal(p.setupTimeoutMs, 40 * 60000);
          assert.equal(p.calibrationTimeoutMs, 300000);
          assert.equal(p.release.firstEightRequired, sourceLabel === '797');
          assert.equal(
            p.release.firstEightAllCorrectnessPassed,
            sourceLabel === '797' ? true : undefined,
          );
          for (const mutate of [
            ...(sourceLabel === '797'
              ? [
                  (p) => (p.release.firstEightRequired = false),
                  (p) => (p.release.firstEightEvidence = null),
                  (p) =>
                    (p.release.firstEightEvidence.sourceRevision =
                      '73a345cec696d7789198cf295ca5c37b17ca0e71'),
                  (p) => (p.release.firstEightEvidence.correctness = 'failed'),
                  (p) => (p.release.firstEightEvidence.ownersClosed = false),
                  (p) => (p.release.firstEightEvidence.artifactSHA256 = 'invalid'),
                  (p) => (p.release.firstEightEvidence.runId = 0),
                  (p) => (p.release.firstEightEvidence.unreviewed = true),
                ]
              : []),
            (p) => {
              p.phase = 'next';
            },
            (p) => {
              p.candidate.outer.bytes++;
            },
            (p) => {
              p.baseline.reusableArtifact.artifact++;
            },
            (p) => {
              p.recipes[phase].sha256 = '0'.repeat(64);
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
              p.release.dispatch.phase = 'next';
            },
            (p) => {
              p.release.onceOnlyBefore = p.candidate.revision;
            },
            (p) => {
              p.release.firstEightAllCorrectnessPassed = sourceLabel !== '797';
            },
            (p) => {
              p.rows[0].timeoutMs++;
            },
            (p) => {
              p.performanceExclusion = false;
            },
            (p) => {
              p.hitchJournal = undefined;
            },
          ]) {
            const q = structuredClone(p);
            mutate(q);
            assert.throws(() => validateSustainedPlan(q));
          }
        }
      assert.equal(arms, 12);
    }
    assert.equal(recipes.retry.value.actions[8].count, 20);
    assert.equal(recipes.long29.value.actions[3].atLeastMs, 1740000);
    assert.equal(recipes.long29.value.actions[8].type, 'reload');
  });

  test(`${sourceLabel}: lifecycle actual preparation and binary documents retain retry and pre-reload authority`, async (t) => {
    for (const phase of ['retry', 'long29']) {
      const m = await de332Manifest(phase),
        dir = await temporary(t),
        work = join(dir, 'work');
      await mkdir(work);
      const p = bindSustainedJob(m, 'webkit', 1);
      const ctx = {
        plan: p,
        repository: root,
        here: join(root, 'scripts'),
        work,
        evidence: dir,
        report: {},
        admitted: { artifacts: { candidate: {} } },
        ensureBaseline: async () => {},
        required: async () =>
          assert.fail('No browser/calibration in this pure preparation control'),
        digest: async (path) => {
          const b = await readFile(path);
          return { bytes: b.length, sha256: sha(b) };
        },
      };
      ctx.modeState = await prepareSustainedMode(ctx);
      assert.deepEqual(await readFile(ctx.modeState.recipePath), recipes[phase].bytes);
      assert.equal(ctx.modeState.snapshotStorage, null);
      for (const engine of ['chromium', 'webkit']) {
        const args = sustainedArguments(
          ctx,
          { ...p.rows[1], engine },
          'http://127.0.0.1:4321/game/?journey=opening',
          dir,
        );
        assert(args.includes('--hitch-journal'));
        assert(!args.includes('--snapshot-chunks'));
        assert.equal(args.includes('--memory-profile'), phase === 'retry' && engine === 'chromium');
        const options = qualificationHitchJournalOptions(
          args,
          recipes[phase].value,
          recipes[phase].bytes,
        );
        assert.equal(
          options.preparationPolicy,
          phase === 'retry' ? 'first-return-retry-anchored-v1' : undefined,
        );
        assert.equal(
          options.activeDocumentPolicy,
          phase === 'long29' ? 'first-before-reload-v1' : undefined,
        );
      }
      const f = await journalFixture(t, phase, { prospectiveManifest: m });
      const result = await verifyTimingHitchJournal(f.plan, f.raw, f.output, f.url);
      assert.equal(result.status, 'complete', result.failure);
      assert.equal(result.documents, 2);
      assert.equal(result.activeElapsedMs, 40.125);
      if (phase === 'long29') {
        assert.equal(result.activePlayCoverage, 'observed-first-solo-before-reload');
        assert.equal(result.documentCoverage[1].activeFrames, 0);
        const changed = await journalFixture(t, phase, {
          prospectiveManifest: m,
          activeRestored: true,
        });
        assert.equal(
          (await verifyTimingHitchJournal(changed.plan, changed.raw, changed.output, changed.url))
            .status,
          'invalid-evidence',
        );
      }
      const omitted = structuredClone(f.raw);
      omitted.hitchJournal.documents.pop();
      assert.equal(
        (await verifyTimingHitchJournal(f.plan, omitted, f.output, f.url)).status,
        'invalid-evidence',
      );
    }
  });

  test(`${sourceLabel}: lifecycle assessment retains every Retry failure and long recording insufficiency`, async () => {
    for (const phase of ['retry', 'long29']) {
      const p = bindSustainedJob(await de332Manifest(phase), 'chromium', 1),
        raw = rawProtocol(p);
      const assess = (value, command = closed, journal = { status: 'complete' }) =>
        finalLifecycleAssessment(p, p.rows[1], value, command, '123.4', journal);
      const result = assess(raw);
      assert.equal(result.correctness, 'pass');
      assert.equal(result.protocolStatus, 'pass');
      assert.equal(result.status, phase === 'retry' ? 'passed' : 'failed');
      assert.equal(result.performanceQualification, 'not-qualified-diagnostic-only');
      assert.equal(result.firstEightRequired, sourceLabel === '797');
      assert.equal(result.firstEightAllCorrectnessPassed, sourceLabel === '797' ? true : undefined);
      if (phase === 'long29') assert.equal(result.preReloadPerformance.status, 'inconclusive');
      for (const mutate of [
        (r) => {
          r.failure = 'original failure';
        },
        (r) => {
          r.replay.nativeVerification.status = 'fail';
        },
        (r) => {
          r.sourceRevision = p.baseline.revision;
        },
        (r) => {
          if (phase === 'retry') r.actions[8].status = 'fail';
          else r.actions[3].elapsedMs = 0;
        },
        (r) => {
          r.actions.push({
            path: phase === 'retry' ? '8.0.0' : '3.0.0',
            type: 'key',
            status: 'fail',
          });
        },
        (r) => {
          if (phase === 'retry') r.actions[8].iterations = 19;
          else r.replayIdentity.observations[1].sha256 = 'b'.repeat(64);
        },
      ]) {
        const changed = structuredClone(raw);
        mutate(changed);
        assert.equal(assess(changed).status, 'failed');
      }
      assert.equal(assess(raw, { status: 'failed', exitCode: 2 }).status, 'failed');
      assert.equal(assess(raw, closed, { status: 'invalid-evidence' }).status, 'failed');
    }
  });
}
