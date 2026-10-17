import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bindReadinessJob,
  readinessRowPlan,
  readinessArguments,
  readinessMatrix,
  PREPARATION_READINESS_PHASES,
} from './solo-remote-readiness.mjs';
import { qualificationReadinessOptions } from './solo-qualification-readiness.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import { verifyTimingHitchJournal } from './solo-remote-sustained.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const manifest = JSON.parse(
  await read('docs/performance/solo-readiness-preparation-e1cc-plan.json'),
);
test('exact package admits six serial correctness rows per engine, preserved source/limits and all real fixture hashes', async () => {
  assert.equal(manifest.candidate.revision, 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17');
  assert.equal(manifest.candidate.tree, '58f19392e25384620d896098fce8616b538e318d');
  assert.equal(manifest.candidate.run, 39037874955);
  assert.equal(manifest.candidate.artifact, 12104590541);
  assert.equal(manifest.release.onceOnlyBefore, manifest.candidate.revision);
  assert.equal(manifest.performanceExclusion, true);
  assert.equal(manifest.automaticRetries, 0);
  assert.deepEqual(
    readinessMatrix(manifest).include.map((r) => [r.jobMinutes, r.stepMinutes, r.outerSeconds]),
    [
      [130, 78, 4620],
      [130, 78, 4620],
    ],
  );
  for (const engine of manifest.engines) {
    const p = bindReadinessJob(manifest, engine);
    assert.deepEqual(
      p.rows.map((r) => r.phase),
      PREPARATION_READINESS_PHASES,
    );
    for (const row of p.rows) {
      const single = readinessRowPlan(p, row),
        bytes = await read(single.fixture.path);
      assert.equal(bytes.length, single.fixture.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), single.fixture.sha256);
      const args = readinessArguments(
        { plan: p, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://127.0.0.1:1/game/',
        '/evidence',
      );
      const selected = qualificationReadinessOptions(args, JSON.parse(bytes), bytes);
      assert.equal(selected.protocol, single.protocol.name);
      assert.equal(selected.sourceRevision, manifest.candidate.revision);
      assert.equal(
        args.includes('--readiness-geometry=phase-boundary-v1'),
        ['cold-first30', 'warm-resume', 'saved-resume'].includes(row.phase),
      );
      assert.equal(
        args.includes('--readiness-cancel-boundary=post-command-v3'),
        row.phase === 'selected-font-cancel',
      );
      assert(!args.some((x) => x.startsWith('--density-comparison')));
      assert.equal(row.timeoutMs, 480000);
      assert.equal(JSON.parse(bytes).timeoutMs, 240000);
    }
  }
});
test('changed source, fixture, phase, row, numerical authority or limits cannot gain new admission', () => {
  for (const change of [
    (m) => (m.candidate.revision = 'c696af41857840359ae473558b90682f3d71f2db'),
    (m) => (m.candidate.tree = '0'.repeat(40)),
    (m) => (m.runtimeRevision = '0'.repeat(40)),
    (m) => (m.additionalFixtures[2].sha256 = '0'.repeat(64)),
    (m) => (m.phase = 'joined-selected-font-and-same-viewport-dpr'),
    (m) => m.protocol.geometry.pop(),
    (m) => (m.performanceExclusion = false),
    (m) => m.helperTimeoutMs++,
    (m) => m.rowEvidenceBytes++,
    (m) => (m.cpu = 4),
    (m) => (m.automaticRetries = 1),
  ]) {
    const m = structuredClone(manifest);
    change(m);
    assert.throws(() => bindReadinessJob(m, 'webkit'));
  }
});
test('all six exact row policies reuse positive binary journal verification; saved requires two active documents', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-preparation-journal-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const url = 'http://127.0.0.1:4321/game/?journey=opening';
  const plan = bindReadinessJob(manifest, 'webkit');
  for (const row of plan.rows) {
    const p = readinessRowPlan(plan, row),
      output = join(dir, row.phase + '.json');
    const store = createHitchJournalStore(output, () => 0, { soloURL: url });
    const count = row.phase === 'saved-resume' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const allocation = store.beginDocument({ url, action: i ? 'reload-7' : 'initial' });
      let now = 0;
      const j = createBrowserHitchJournal(
        {},
        {
          performance: { now: () => now, timeOrigin: 1700000000000 + i * 1000 },
          location: { origin: 'http://127.0.0.1:4321', pathname: '/game/' },
          document: { hidden: false, hasFocus: () => true, addEventListener() {} },
          addEventListener() {},
          btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        },
      );
      j.configure(allocation);
      j.first(0, 0);
      j.subscribe(0);
      j.phase(2, 0);
      j.frame(0, 40, 2, 2);
      j.beginWork(1, 2);
      j.endWork(55, 2);
      j.phase(3, 60);
      now = 100;
      await store.retain(
        j.seal('paused'),
        i === count - 1 ? 'final-existing-public-boundary' : 'before-reload-7',
      );
    }
    const r = {
      hitchJournal: store.finish(),
      readinessPilot: {
        protocol: p.protocol.name,
        ...(p.protocol.geometryObservation
          ? { geometryObservation: p.protocol.geometryObservation }
          : {}),
        ...(p.protocol.cancelBoundaryObservation
          ? { cancelBoundaryObservation: p.protocol.cancelBoundaryObservation }
          : {}),
      },
    };
    const result = await verifyTimingHitchJournal(p, r, output, url);
    assert.equal(result.status, 'complete', JSON.stringify(result));
    for (const change of [
      (q) => (q.candidate.tree = '0'.repeat(40)),
      (q) => (q.fixture.sha256 = '0'.repeat(64)),
      (q) => (q.protocol.name = 'other'),
    ]) {
      const q = structuredClone(p);
      change(q);
      assert.equal((await verifyTimingHitchJournal(q, r, output, url)).status, 'invalid-evidence');
    }
    if (count === 2) {
      const missing = structuredClone(r);
      missing.hitchJournal.documents.pop();
      assert.equal(
        (await verifyTimingHitchJournal(p, missing, output, url)).status,
        'invalid-evidence',
      );
    }
  }
});

test('one-shot release has actual artifact pins, current frozen inputs and a complete sparse test inventory', async () => {
  assert.deepEqual(manifest.candidate.outer, {
    bytes: 1091965213,
    sha256: 'fb85094a61cdc329ccf8a1488b6e3ca1043ef5f249a6b33729bb04141336af1e',
  });
  assert.deepEqual(manifest.candidate.inner, {
    bytes: 1073790972,
    sha256: '6c8bbb6aafe3f9d55e2fb445d5846a5e9d02ebd648c4e630889743bf76ec421e',
  });
  const workflow = (
    await read('.github/workflows/solo-remote-readiness-ab45-temporary.yml')
  ).toString();
  assertReleaseGuard(workflow);
  assert.equal(manifest.release.publicationHold, undefined);
  assert(workflow.includes('ref: ' + manifest.candidate.revision));
  assert(workflow.includes('timeout-minutes: 130'));
  assert(workflow.includes('timeout-minutes: 78'));
  assert(workflow.includes('4620s node scripts/run-solo-remote-correctness.mjs'));
  assert(workflow.includes('bind-plan docs/performance/solo-readiness-preparation-e1cc-plan.json'));
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
    manifest.fixture,
    ...manifest.additionalFixtures,
  ]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    assert(sparse.includes(ref.path), ref.path);
  }
  const command = workflow.match(/node --test --test-concurrency=2 ([^\n]+) 2>&1/)[1];
  for (const file of command.split(' ')) assert(sparse.includes(file), file);
  for (const file of [
    'docs/performance/fixtures/solo-readiness-font/e1cc-execution-source.json',
    'docs/performance/fixtures/solo-readiness-font/e1cc-executed-workflow.yml',
    'docs/performance/fixtures/solo-readiness-font/selected-font-cancel-joined-v2.qualification.fixture',
  ])
    assert(sparse.includes(file), file);
});

const releaseConditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17'",
];
function assertReleaseGuard(workflow) {
  assert(workflow.includes('    if: ' + releaseConditions.join(' && ') + '\n'));
  assert(!workflow.includes('workflow_dispatch'));
  assert(!workflow.includes('continue-on-error'));
  assert(!workflow.includes('if: ${{ false }}'));
}
test('each exact release condition remains mandatory without alternate dispatch', async () => {
  const workflow = (
    await read('.github/workflows/solo-remote-readiness-ab45-temporary.yml')
  ).toString();
  assertReleaseGuard(workflow);
  for (const condition of releaseConditions) {
    assert.throws(() => assertReleaseGuard(workflow.replace(condition, 'true')));
  }
});
