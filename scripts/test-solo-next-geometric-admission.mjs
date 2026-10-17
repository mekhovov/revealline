import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  bindSustainedJob,
  sustainedMatrix,
  validateSustainedPlan,
  sustainedArguments,
  prepareSustainedMode,
  geometricNextAssessment,
  verifyTimingHitchJournal,
} from './solo-remote-sustained.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import { NEXT_ROUTE_IDENTITIES } from './solo-qualification-next-route.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const manifest = JSON.parse(
  await readFile(join(root, 'docs/performance/solo-next-geometric-c696-plan.json')),
);
const fixture = JSON.parse(await readFile(join(root, manifest.recipes.next.path)));
const digest = async (p) => {
  const bytes = await readFile(p);
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
};
function sample(engine = 'chromium') {
  const plan = bindSustainedJob(manifest, engine, 1),
    row = plan.rows[0];
  const actions = fixture.actions.map((action, index) => ({
    path: String(index),
    type: action.type,
    status: 'pass',
  }));
  for (const [index, identity] of NEXT_ROUTE_IDENTITIES.entries())
    Object.assign(actions[6 + 5 * index], {
      status: 'passed-public-route',
      protocol: 'authored-next-geometric-v1',
      mission: identity.id,
      initial: { mission: identity.id, autoNext: false, lives: 3, tick: 0 },
      final: { mission: identity.id, autoNext: false, lives: 3, tick: 1800, status: 'won' },
      reads: 100,
      unsettled: 0,
      heldKeys: [],
      elapsedMs: 15000,
      events: [{ status: 'settled' }],
      stages: [],
    });
  const raw = {
    scenarioStatus: 'pass',
    scenarioSHA256: plan.recipes.next.sha256,
    sourceRevision: plan.candidate.revision,
    buildIdentity: { sourceRevision: plan.candidate.revision },
    environment: {
      engine,
      browserVersion: 'test-version',
      contextMode: engine === 'webkit' ? 'persistent' : 'ephemeral',
      contextOwner: { cleanup: { status: 'closed', profileRemoved: true, browserClosed: true } },
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine, browserVersion: 'test-version' },
    },
    pageErrors: [],
    resources: [],
    performanceGateStatus: 'pass-observed-window',
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: false,
    cacheMode: 'fresh-context',
    scenarioKind: 'lifecycle',
    kind: 'lifecycle',
    actions,
    snapshots: NEXT_ROUTE_IDENTITIES.map(() => ({ group: 'next-result' })),
  };
  return {
    plan,
    row,
    raw,
    command: { status: 'closed', exitCode: 0 },
    journal: { status: 'complete' },
  };
}
const assess = (s) =>
  geometricNextAssessment(s.plan, s.row, s.raw, s.command, 'test-version', s.journal);
test('candidate-only declaration preserves six fresh jobs and original bounds; legacy roles stay paired', async () => {
  const matrix = sustainedMatrix(manifest).include;
  assert.equal(matrix.length, 6);
  for (const job of matrix) {
    const p = bindSustainedJob(manifest, job.engine, job.repetition);
    assert.deepEqual(
      p.rows.map((r) => r.source),
      ['candidate'],
    );
    assert.equal(p.rows[0].timeoutMs, 1440000);
    assert.equal(p.helperTimeoutMs, 6300000);
    assert.equal(p.rowEvidenceBytes, 134217728);
    assert.equal(p.evidenceBytes, 536870912);
    assert.equal(p.setupTimeoutMs, 2400000);
    assert.equal(p.calibrationTimeoutMs, 300000);
    assert.equal(job.jobMinutes, 152);
    assert.equal(p.release.firstEightAllCorrectnessPassed, false);
    const args = sustainedArguments(
      { plan: p, here: join(root, 'scripts'), modeState: { cpu: 2, recipePath: 'recipe' } },
      p.rows[0],
      'url',
      'out',
    );
    assert(args.includes('--authored-next-route=authored-next-geometric-v1'));
    assert(args.includes('--hitch-journal'));
    assert(!args.includes('--baseline-runtime'));
  }
  const legacy = JSON.parse(
    await readFile(join(root, 'docs/performance/solo-final-next-plan.json')),
  );
  assert.deepEqual(
    bindSustainedJob(legacy, 'chromium', 1).rows.map((r) => r.source),
    ['baseline', 'candidate'],
  );
  assert(
    !sustainedArguments(
      {
        plan: bindSustainedJob(legacy, 'chromium', 1),
        here: join(root, 'scripts'),
        modeState: { cpu: 1, recipePath: 'recipe' },
      },
      { source: 'candidate', engine: 'chromium' },
      'url',
      'out',
    ).some((a) => a.startsWith('--authored-next-route')),
  );
});
test('source, phase, baseline authority, protocol, row and bound mutations cannot gain admission', () => {
  const mutations = [
    (p) => (p.candidate.revision = 'a'.repeat(40)),
    (p) => (p.candidate.tree = 'b'.repeat(40)),
    (p) => (p.latestRuntimeRevision = 'a'.repeat(40)),
    (p) => (p.sourceCohort = 'next-candidatec696'),
    (p) => (p.phase = 'retry'),
    (p) => (p.candidateOnly = false),
    (p) => (p.nativeRouteProtocol = 'arbitrary'),
    (p) => (p.baseline.scope = 'paired'),
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.baseline.publisher = {}),
    (p) => (p.baseline.run = 1),
    (p) => (p.release.onceOnlyBefore = 'b'.repeat(40)),
    (p) => (p.release.scope = 'independent-comparison-diagnostics'),
    (p) => (p.release.automaticRetries = 1),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.recipes.next.sha256 = 'c'.repeat(64)),
    (p) => (p.recipes.next.path = p.recipes.opening.path),
    (p) => p.recipes.next.bytes++,
    (p) => p.rowEvidenceBytes++,
    (p) => p.calibrationTimeoutMs++,
    (p) =>
      (p.frozenTools = p.frozenTools.filter(
        (r) => r.path !== 'scripts/solo-qualification-next-route.mjs',
      )),
    (p) => p.rows.push({ ...p.rows[0], source: 'baseline' }),
    (p) => (p.rows[0].source = 'baseline'),
  ];
  for (const mutate of mutations) {
    const p = bindSustainedJob(manifest, 'chromium', 1);
    mutate(p);
    assert.throws(() => validateSustainedPlan(p));
  }
});
test('post-child route assessment retains numerical failures and rejects missing transitions, owners, replay and cleanup', async () => {
  for (const engine of ['chromium', 'webkit'])
    assert.equal((await assess(sample(engine))).status, 'passed');
  const failed = sample();
  failed.raw.performanceGateStatus = 'fail';
  failed.command.exitCode = 2;
  const result = await assess(failed);
  assert.equal(result.correctness, 'pass');
  assert.equal(result.rawPerformanceGateStatus, 'fail');
  assert.equal(result.status, 'failed');
  assert.equal(result.performanceQualification, 'not-qualified-diagnostic-only');
  const negatives = [
    (s) => s.raw.actions.splice(6, 1),
    (s) => (s.raw.actions[6].status = 'pass'),
    (s) => (s.raw.actions[11].mission = 'first-return'),
    (s) => (s.raw.actions[6].initial.tick = 13),
    (s) => (s.raw.actions[6].final.lives = 2),
    (s) => (s.raw.actions[6].unsettled = 1),
    (s) => (s.raw.actions[6].heldKeys = ['left']),
    (s) => (s.raw.actions[6].events[0].status = 'invoked'),
    (s) => (s.raw.actions[6].reads = 1202),
    (s) => (s.raw.actions[6].cleanupFailure = 'late up'),
    (s) => (s.raw.actions[9].type = 'wait'),
    (s) => s.raw.snapshots.pop(),
    (s) => (s.raw.replay.nativeVerification.status = 'fail'),
    (s) => (s.raw.replay.scope = 'partial-failure'),
    (s) => s.raw.pageErrors.push('error'),
    (s) => (s.raw.finalReadFailure = 'failed'),
    (s) => (s.raw.environment.contextOwner.cleanup.profileRemoved = false),
    (s) => (s.journal.status = 'incomplete'),
    (s) => (s.raw.performanceGateStatusBeforeHitchJournal = 'fail'),
    (s) => (s.command.status = 'unclosed'),
  ];
  for (const mutate of negatives) {
    const s = sample('webkit');
    mutate(s);
    assert.equal((await assess(s)).status, 'failed');
  }
});
test('candidate-only WebKit preparation never builds or downloads a baseline', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-next-admit-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'evidence'));
  let baselineCalls = 0;
  const plan = bindSustainedJob(manifest, 'webkit', 1),
    mode = await prepareSustainedMode({
      plan,
      repository: root,
      work: dir,
      evidence: join(dir, 'evidence'),
      report: {},
      admitted: { artifacts: { candidate: {} } },
      digest,
      ensureBaseline: async () => {
        baselineCalls++;
        throw Error('baseline forbidden');
      },
    });
  assert.equal(baselineCalls, 0);
  assert.equal(mode.cpu, 1);
  assert.deepEqual(JSON.parse(await readFile(mode.recipePath)), fixture);
});
test('actual isolated three-module declaration CLI binds only six candidate observations', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-next-declare-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts'));
  for (const f of [
    'solo-remote-sustained.mjs',
    'solo-qualification.mjs',
    'solo-qualification-observation.mjs',
  ])
    await copyFile(join(root, 'scripts', f), join(dir, 'scripts', f));
  await writeFile(join(dir, 'plan.json'), JSON.stringify(manifest));
  const output = execFileSync(
    process.execPath,
    [join(dir, 'scripts/solo-remote-sustained.mjs'), 'matrix-plan', join(dir, 'plan.json')],
    { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 },
  );
  assert.equal(JSON.parse(output.trim().slice(7)).include.length, 6);
});

test('actual candidate journal sidecar is independently reread and changed bytes remain invalid', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-next-journal-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=authored',
    store = createHitchJournalStore(output, () => 100, { soloURL: url });
  const allocation = store.beginDocument({ url, action: 'initial' });
  let now = 0;
  const location = new URL(url);
  const journal = createBrowserHitchJournal(
    {},
    {
      performance: { now: () => now, timeOrigin: 1700000000000 },
      location: { origin: location.origin, pathname: location.pathname },
      document: { hidden: false, hasFocus: () => true, addEventListener() {} },
      addEventListener() {},
      btoa: (v) => Buffer.from(v, 'binary').toString('base64'),
    },
  );
  journal.configure(allocation);
  journal.first(0, 0);
  journal.subscribe(0);
  journal.phase(2, 0);
  journal.frame(0, 40.125, 2, 2);
  journal.beginWork(1, 2);
  journal.endWork(55.25, 2);
  journal.phase(3, 60);
  now = 100;
  await store.retain(journal.seal('paused'), 'final-existing-public-boundary');
  const raw = { hitchJournal: store.finish() },
    plan = bindSustainedJob(manifest, 'chromium', 1);
  assert.equal((await verifyTimingHitchJournal(plan, raw, output, url)).status, 'complete');
  const file = raw.hitchJournal.documents[0].path,
    bytes = await readFile(file);
  bytes[0] ^= 1;
  await writeFile(file, bytes);
  assert.equal((await verifyTimingHitchJournal(plan, raw, output, url)).status, 'invalid-evidence');
});

test('concrete package, tools and one-shot workflow retain exact independent identities', async () => {
  const checkPackage = (p) => {
    assert.equal(p.candidate.run, 39028705715);
    assert.equal(p.candidate.artifact, 12100662115);
    assert.deepEqual(p.candidate.outer, {
      bytes: 1091949183,
      sha256: '8545bc4e8a665cbaff8d39e9704dd0dc85ba72b52e1f3dc04ed1cc69ca874342',
    });
    assert.deepEqual(p.candidate.inner, {
      bytes: 1073779419,
      sha256: 'c715e0a960300c48b341fbc1b3dbc656882f6f03b5dadf373aaf6d9473079fa5',
    });
    assert.equal(
      p.candidate.manifestSHA256,
      '9521c2f2afb62879a7ebedb09b7436f9a93babed10cb53989a4f9108239dc21d',
    );
    assert.equal(p.currentSourceCorrectness.run, 39032516813);
    assert.equal(p.currentSourceCorrectness.observations, 8);
  };
  checkPackage(manifest);
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = 'f'.repeat(64)),
    (p) => (p.currentSourceCorrectness.observations = 0),
  ]) {
    const p = structuredClone(manifest);
    mutate(p);
    assert.throws(() => checkPackage(p));
  }
  const refs = [
    ...manifest.frozenTools,
    ...manifest.adapterInputs,
    ...Object.values(manifest.recipes),
  ];
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  for (const ref of refs)
    assert.deepEqual(
      await digest(join(root, ref.path)),
      { bytes: ref.bytes, sha256: ref.sha256 },
      ref.path,
    );
  const workflow = await readFile(
    join(root, '.github/workflows/solo-remote-next-geometric-c696-temporary.yml'),
    'utf8',
  );
  const guard =
    "    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '0febd334619731adc26dfa3df78aab02991563af'";
  const checkGuard = (text) => {
    assert.equal(
      text
        .split('\n')
        .filter((l) => l.startsWith('    if:'))
        .join('\n'),
      guard,
    );
    assert(!text.includes('workflow_dispatch'));
    assert(!text.includes('continue-on-error'));
  };
  checkGuard(workflow);
  for (const c of [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == '0febd334619731adc26dfa3df78aab02991563af'",
  ])
    assert.throws(() => checkGuard(workflow.replace(c, 'true')));
  const lists = [
    ...workflow.matchAll(/          sparse-checkout: \|\n((?:            .+\n)+)/g),
  ].map((m) =>
    m[1]
      .trim()
      .split('\n')
      .map((l) => l.trim().slice(1)),
  );
  assert.equal(lists.length, 2);
  assert.equal(lists[1].length, new Set(lists[1]).size);
  for (const ref of refs) assert(lists[1].includes(ref.path), ref.path);
  for (const file of lists[1]) assert((await readFile(join(root, file))).length > 0, file);
  assert(!workflow.includes('npm ci --prefix baseline'));
  assert(!/^\s*filter:/m.test(workflow));
  assert(workflow.includes('ref: ' + manifest.candidate.revision));
  assert(workflow.includes('ref: ' + manifest.baseline.revision));
  assert(workflow.includes('max-parallel: 6'));
  assert(workflow.includes('cancel-in-progress: false'));
  assert(workflow.includes('timeout-minutes: ${{ matrix.jobMinutes }}'));
  assert(workflow.includes('if: ${{ always() }}'));
});
