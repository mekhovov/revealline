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
  preparationReadinessSelection,
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
const executedWitnessBytes = await read(
  'docs/performance/fixtures/solo-readiness-geometry/7c7-execution-source.json',
);
const executedWitnessSHA256 = 'a54fa43e5f89dc2ccce08f69892421213d5a6a0deb107ebc6dc320f174665613';
function executedBindings(bytes, declarationBytes, workflowBytes) {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), executedWitnessSHA256);
  const witness = JSON.parse(bytes);
  assert.equal(witness.head, '7c7cc2648331870683ac7b76850bbeff859f802e');
  assert.equal(witness.tree, 'e20aabb50c0e82c52c0970a14934b2d05611f53e');
  for (const [path, value] of [
    ['docs/performance/solo-readiness-preparation-e1cc-plan.json', declarationBytes],
    ['.github/workflows/solo-remote-readiness-ab45-temporary.yml', workflowBytes],
  ]) {
    const entry = witness.records.find((r) => r.path === path);
    assert.equal(value.length, entry.bytes);
    assert.equal(createHash('sha256').update(value).digest('hex'), entry.sha256);
  }
  const declaration = JSON.parse(declarationBytes);
  for (const ref of [
    ...declaration.adapterInputs,
    ...declaration.frozenTools,
    declaration.fixture,
    ...declaration.additionalFixtures,
  ]) {
    const entry = witness.records.find((r) => r.path === ref.path);
    assert(entry, ref.path);
    assert.equal(entry.bytes, ref.bytes, ref.path);
    assert.equal(entry.sha256, ref.sha256, ref.path);
  }
  return witness;
}
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

test('executed one-shot release retains exact7c7 bindings, artifact pins and original sparse test inventory', async () => {
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
  executedBindings(
    executedWitnessBytes,
    await read('docs/performance/solo-readiness-preparation-e1cc-plan.json'),
    Buffer.from(workflow),
  );
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
    manifest.fixture,
    ...manifest.additionalFixtures,
  ]) {
    // The complete executed Git binding above remains historical; the v2
    // release contract independently requires every prospective current byte.
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
function assertReleaseGuard(workflow, conditions = releaseConditions) {
  assert(workflow.includes('    if: ' + conditions.join(' && ') + '\n'));
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

test('mutated executed witness, declaration or original workflow cannot acquire historical authority', async () => {
  const declaration = await read('docs/performance/solo-readiness-preparation-e1cc-plan.json'),
    workflow = await read('.github/workflows/solo-remote-readiness-ab45-temporary.yml');
  for (const args of [
    [Buffer.concat([executedWitnessBytes, Buffer.from(' ')]), declaration, workflow],
    [executedWitnessBytes, Buffer.concat([declaration, Buffer.from(' ')]), workflow],
    [executedWitnessBytes, declaration, Buffer.concat([workflow, Buffer.from(' ')])],
  ])
    assert.throws(() => executedBindings(...args));
});

const diagnosedManifest = JSON.parse(
  await read('docs/performance/solo-readiness-diagnosed-239-plan.json'),
);
function boundDiagnosedPlan() {
  return bindReadinessJob(diagnosedManifest, 'webkit');
}
test('actual239 successor admits only the two diagnosed WebKit recipes and preserves actual runner enrichment', async () => {
  assert.deepEqual(diagnosedManifest.engines, ['webkit']);
  assert.deepEqual(diagnosedManifest.candidate, {
    revision: '239c574ecddd5bb6d5896e621d9edc53e7f6a313',
    tree: '1ac7f17971498d2a8be19085f00a9f732db42798',
    run: 39049194998,
    artifact: 12107584924,
    outer: {
      bytes: 1091981388,
      sha256: 'de57853058db05207dd93f0fd2cb38dd57589485dc0a5cfcc81221d1d1710aec',
    },
    inner: {
      bytes: 1073799309,
      sha256: '0a0f4273b3ac6cc906b6625063d52229a39c92b108d1dba296b7bd5628028f17',
    },
    manifestSHA256: 'abe173d91aece2ba590c0c2442d48f151b13e23a88fa0ead7b6690f4f95b9d36',
    producer:
      'Exact successful Appearance package, Node22.13.1 Linux; original focused-policy metadata retained. Full outer/member/source/CSP verification required remotely before any native row.',
  });
  assert.equal(diagnosedManifest.release.onceOnlyBefore, diagnosedManifest.candidate.revision);
  for (const key of ['run', 'artifact', 'outer', 'inner', 'manifestSHA256']) {
    const unbound = structuredClone(diagnosedManifest);
    unbound.candidate[key] = null;
    assert.throws(() => bindReadinessJob(unbound, 'webkit'));
  }
  assert.throws(() => bindReadinessJob(diagnosedManifest, 'chromium'));
  const p = boundDiagnosedPlan();
  assert.deepEqual(
    p.rows.map((r) => r.phase),
    ['warm-resume', 'required-original-cancel'],
  );
  for (const row of p.rows) {
    const enriched = { ...row, storage: '/bounded/row', startedAt: 'fixture', status: 'running' };
    const single = readinessRowPlan(p, enriched);
    assert.equal(single.phase, row.phase);
    assert.equal(
      single.protocol.requiredStartRetention,
      row.phase === 'required-original-cancel' ? 'trusted-initial-start-v1' : undefined,
    );
    const bytes = await read(single.fixture.path);
    assert.equal(bytes.length, single.fixture.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), single.fixture.sha256);
    const args = readinessArguments(
      { plan: p, here: '/tools/scripts', repository: '/tools' },
      enriched,
      'http://127.0.0.1:1/game/',
      '/bounded',
    );
    const selected = qualificationReadinessOptions(args, JSON.parse(bytes), bytes);
    assert.equal(selected.sourceRevision, p.candidate.revision);
    assert.equal(selected.protocol, single.protocol.name);
    assert.equal(
      args.includes('--readiness-geometry=phase-boundary-v1'),
      row.phase === 'warm-resume',
    );
    assert.equal(
      args.includes('--readiness-required-start=trusted-initial-start-v1'),
      row.phase === 'required-original-cancel',
    );
    assert(
      args.includes('--viewport=400x850') &&
        args.includes('--dpr=3') &&
        args.includes('--mobile-context'),
    );
    assert.equal(row.timeoutMs, 480000);
    assert.equal(JSON.parse(bytes).timeoutMs, 240000);
    for (const altered of [
      { ...enriched, phase: 'selected-font-cancel' },
      { ...enriched, timeoutMs: 480001 },
      { ...enriched, unrecognized: true },
    ])
      assert.throws(() => readinessRowPlan(p, altered));
    for (const altered of [
      { ...single, engine: 'chromium' },
      { ...single, phase: 'saved-resume' },
      { ...single, sourceCohort: 'readiness-diagnosed-row-candidatec696' },
    ])
      assert.throws(() => preparationReadinessSelection(altered));
  }
  const workflow = (
    await read('.github/workflows/solo-remote-readiness-diagnosed-239-temporary.yml')
  ).toString();
  const conditions = [
    ...releaseConditions.slice(0, 3),
    "github.event.before == '239c574ecddd5bb6d5896e621d9edc53e7f6a313'",
  ];
  assertReleaseGuard(workflow, conditions);
  for (const condition of conditions)
    assert.throws(() => assertReleaseGuard(workflow.replace(condition, 'true'), conditions));
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((match) => match[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [
    ...diagnosedManifest.adapterInputs,
    ...diagnosedManifest.frozenTools,
    diagnosedManifest.fixture,
    ...diagnosedManifest.additionalFixtures,
  ]) {
    const bytes = await read(ref.path);
    assert.deepEqual(
      { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
      { bytes: ref.bytes, sha256: ref.sha256 },
      ref.path,
    );
    assert(sparse.includes(ref.path), ref.path);
  }
  assert.match(workflow, /engine: \[webkit\]/);
  assert(workflow.includes('playwright" install --with-deps chromium webkit'));
  assert(workflow.includes('timeout-minutes: 130') && workflow.includes('timeout-minutes: 78'));
  assert(workflow.includes('4620s node scripts/run-solo-remote-correctness.mjs'));
});
test('actual239 row policies retain positive binary journal proof and reject missing trusted-Start metadata', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-diagnosed-journal-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const url = 'http://127.0.0.1:4321/game/?journey=opening',
    plan = boundDiagnosedPlan();
  for (const row of plan.rows) {
    const p = readinessRowPlan(plan, row),
      output = join(dir, row.phase + '.json');
    const store = createHitchJournalStore(output, () => 0, { soloURL: url });
    const allocation = store.beginDocument({ url, action: 'initial' });
    let now = 0;
    const journal = createBrowserHitchJournal(
      {},
      {
        performance: { now: () => now, timeOrigin: 1700000000000 },
        location: { origin: 'http://127.0.0.1:4321', pathname: '/game/' },
        document: { hidden: false, hasFocus: () => true, addEventListener() {} },
        addEventListener() {},
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
      },
    );
    journal.configure(allocation);
    journal.first(0, 0);
    journal.subscribe(0);
    journal.phase(2, 0);
    journal.frame(0, 40, 2, 2);
    journal.beginWork(1, 2);
    journal.endWork(55, 2);
    journal.phase(3, 60);
    now = 100;
    await store.retain(journal.seal('paused'), 'final-existing-public-boundary');
    const raw = {
      hitchJournal: store.finish(),
      readinessPilot: {
        protocol: p.protocol.name,
        ...(p.protocol.geometryObservation
          ? { geometryObservation: p.protocol.geometryObservation }
          : {}),
        ...(p.protocol.requiredStartRetention
          ? { requiredStartRetention: p.protocol.requiredStartRetention }
          : {}),
      },
    };
    const checked = await verifyTimingHitchJournal(p, raw, output, url);
    assert.equal(checked.status, 'complete', JSON.stringify(checked));
    for (const change of [
      (q) => (q.candidate.tree = '0'.repeat(40)),
      (q) => (q.runtimeRevision = '0'.repeat(40)),
      (q) => (q.fixture.sha256 = '0'.repeat(64)),
      (q) => (q.protocol.name = 'other'),
    ]) {
      const q = structuredClone(p);
      change(q);
      assert.equal(
        (await verifyTimingHitchJournal(q, raw, output, url)).status,
        'invalid-evidence',
      );
    }
    const missing = structuredClone(raw);
    delete missing.readinessPilot[
      p.protocol.requiredStartRetention ? 'requiredStartRetention' : 'geometryObservation'
    ];
    assert.equal(
      (await verifyTimingHitchJournal(p, missing, output, url)).status,
      'invalid-evidence',
    );
  }
});
