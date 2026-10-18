import { assertDeclaredReadinessTool } from './solo-readiness-rejoin-declared-source.mjs';
import {
  declaredPreparationRefs,
  DE332_PREPARATION_WITNESS,
} from './solo-de332-preparation-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'acorn';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import {
  bindReadinessJob,
  readinessRowPlan,
  readinessArguments,
  readinessMatrix,
  RUNTIME797_READINESS_SOURCE,
  RUNTIME797_READINESS_COHORT,
  RUNTIME797_READINESS_ROW,
  RUNTIME797_READINESS_FAULT_FIXTURES,
  PREPARATION_READINESS_PHASES,
} from './solo-remote-readiness.mjs';
import {
  qualificationReadinessOptions,
  selectedFontSourceBinding,
  createSelectedFontSettlementOwner,
  createSelectedFontSettlementProbe,
  createBrowserReadinessProbe,
  selectedFont,
  assessSelectedFontSettlementReadiness,
  SELECTED_FONT_SOURCE_BINDING,
} from './solo-qualification-readiness.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import { verifyTimingHitchJournal } from './solo-remote-sustained.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const manifest = JSON.parse(
  await read('docs/performance/solo-readiness-preparation-797e03-plan.json'),
);

const actualFirstEight = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
).proof;
const reviewed = () => structuredClone(manifest);

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('prospective readiness references match candidate tools without refreshing any executed declaration', async () => {
  const refs = [
    manifest.fixture,
    ...manifest.additionalFixtures,
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
  ];
  assert.equal(new Set(refs.map((ref) => ref.path)).size, refs.length);
  for (const ref of refs) {
    if (
      await assertDeclaredReadinessTool(
        'docs/performance/solo-readiness-preparation-797e03-plan.json',
        ref,
      )
    )
      continue;
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
  }
});
test('held declaration refuses execution; reviewed exact selection preserves twelve serial boundaries and real recipe bytes', async () => {
  assert.throws(() =>
    readinessMatrix({
      ...structuredClone(manifest),
      status: 'held-awaiting-source-and-dispatch-review',
    }),
  );
  assert.equal(manifest.status, 'reviewed-readiness-diagnostic-only');
  assert.deepEqual(manifest.release.firstEightEvidence, actualFirstEight);
  assert.equal(manifest.release.firstEightAllCorrectnessPassed, true);
  const missingProof = structuredClone(manifest);
  missingProof.release.firstEightEvidence = null;
  assert.throws(() => readinessMatrix(missingProof));
  const selected = reviewed();
  assert.equal(selected.sourceCohort, RUNTIME797_READINESS_COHORT);
  assert.deepEqual(
    readinessMatrix(selected).include.map((r) => [r.jobMinutes, r.stepMinutes, r.outerSeconds]),
    [
      [130, 78, 4620],
      [130, 78, 4620],
    ],
  );
  assert.equal(selected.candidate.revision, '797e03f28743921842df6aa57520a72016ba3dfc');
  assert.equal(selected.candidate.run, 39104551453);
  assert.equal(selected.candidate.artifact, 12128990483);
  for (const engine of selected.engines) {
    const plan = bindReadinessJob(selected, engine);
    assert.deepEqual(
      plan.rows.map((row) => row.phase),
      PREPARATION_READINESS_PHASES,
    );
    for (const row of plan.rows) {
      const single = readinessRowPlan(plan, row),
        bytes = await read(single.fixture.path);
      assert.equal(bytes.length, single.fixture.bytes);
      assert.equal(hash(bytes), single.fixture.sha256);
      assert.equal(single.sourceCohort, RUNTIME797_READINESS_ROW);
      const args = readinessArguments(
        { plan, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://127.0.0.1:1/game/',
        '/evidence',
      );
      const pilot = qualificationReadinessOptions(args, JSON.parse(bytes), bytes);
      assert.equal(pilot.sourceRevision, RUNTIME797_READINESS_SOURCE.revision);
      assert.equal(pilot.protocol, single.protocol.name);
      assert.equal(row.timeoutMs, 480000);
      assert.equal(JSON.parse(bytes).timeoutMs, 240000);
      assert.equal(pilot.documents ?? 1, row.phase === 'saved-resume' ? 2 : 1);
      assert.equal(
        args.includes('--readiness-geometry=phase-boundary-v1'),
        ['cold-first30', 'warm-resume', 'saved-resume'].includes(row.phase),
      );
      assert.equal(
        args.includes('--readiness-required-start=trusted-initial-start-v1'),
        row.phase === 'required-original-cancel',
      );
      assert.equal(
        args.includes('--readiness-cancel-boundary=post-command-v3'),
        row.phase === 'selected-font-cancel',
      );
      for (const change of [
        (x) => x.filter((f) => f !== '--work-probe'),
        (x) => x.concat('--source-revision=' + RUNTIME797_READINESS_SOURCE.revision),
        (x) =>
          x.map((f) =>
            f.startsWith('--source-revision=') ? '--source-revision=' + 'f'.repeat(40) : f,
          ),
        (x) => x.concat('--density-comparison=full-muted-v1'),
      ])
        assert.throws(() => qualificationReadinessOptions(change(args), JSON.parse(bytes), bytes));
      assert.throws(() =>
        qualificationReadinessOptions(
          args,
          JSON.parse(bytes),
          Buffer.concat([bytes, Buffer.from('\n')]),
        ),
      );
    }
  }
});
test('new fault fixtures differ only at the exact embedded source; actions, delays, assets and expected replay are unchanged', async () => {
  const sources = {
    'selected-font-cancel': [
      'solo-readiness-font/selected-font-request-settlement-v4.qualification.fixture',
      'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
    ],
    'required-original-cancel': [
      'solo-readiness-media/required-original-cancel-start-v2.qualification.fixture',
      '239c574ecddd5bb6d5896e621d9edc53e7f6a313',
    ],
    'optional-icon-missing': [
      'solo-readiness-media/optional-icon-missing-v1.qualification.fixture',
      'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
    ],
  };
  for (const [phase, [path, source]] of Object.entries(sources)) {
    const old = (await read('docs/performance/fixtures/' + path)).toString();
    assert.equal(old.split(source).length, 2);
    const next = (await read(RUNTIME797_READINESS_FAULT_FIXTURES[phase].path)).toString();
    assert.equal(next, old.replace(source, RUNTIME797_READINESS_SOURCE.revision));
  }
});
test('source/package/fixture/row/limit mutations cannot gain reviewed readiness admission', () => {
  for (const mutate of [
    (m) => (m.release.firstEightRequired = false),
    (m) => (m.release.firstEightAllCorrectnessPassed = false),
    (m) => (m.release.firstEightEvidence = null),
    (m) =>
      (m.release.firstEightEvidence.sourceRevision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
    (m) => (m.release.firstEightEvidence.correctness = 'failed'),
    (m) => (m.release.firstEightEvidence.ownersClosed = false),
    (m) => (m.release.firstEightEvidence.runId = 0),
    (m) => (m.release.firstEightEvidence.artifactSHA256 = 'invalid'),
    (m) => (m.release.firstEightEvidence.unreviewed = true),
    (m) => m.candidate.artifact++,
    (m) => m.candidate.run++,
    (m) => m.candidate.outer.bytes++,
    (m) => (m.candidate.inner.sha256 = '0'.repeat(64)),
    (m) => (m.candidate.tree = '0'.repeat(40)),
    (m) => (m.candidate.manifestSHA256 = '0'.repeat(64)),
    (m) => (m.runtimeRevision = '0'.repeat(40)),
    (m) => (m.additionalFixtures[2].sha256 = '0'.repeat(64)),
    (m) => m.protocol.phases.pop(),
    (m) => m.protocol.geometry.pop(),
    (m) => (m.release.dispatch.lane = 'next'),
    (m) => (m.automaticRetries = 1),
    (m) => m.helperTimeoutMs++,
    (m) => m.rowEvidenceBytes++,
    (m) => (m.cpu = 4),
    (m) => (m.performanceExclusion = false),
  ]) {
    const changed = reviewed();
    mutate(changed);
    assert.throws(() => bindReadinessJob(changed, 'webkit'));
  }
  const plan = bindReadinessJob(reviewed(), 'chromium');
  assert.throws(() => readinessRowPlan(plan, { ...plan.rows[0], phase: 'other' }));
  assert.throws(() => readinessRowPlan(plan, { ...plan.rows[0], timeoutMs: 480001 }));
});
test('source797 all six exact row policies reuse positive binary journal verification; saved requires two active documents', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-preparation-journal-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const url = 'http://127.0.0.1:4321/game/?journey=opening';
  const plan = bindReadinessJob(reviewed(), 'webkit');
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
        ...(p.protocol.requiredStartRetention
          ? { requiredStartRetention: p.protocol.requiredStartRetention }
          : {}),
        ...(row.phase === 'selected-font-cancel'
          ? { settlementObservation: 'original-demand-v1' }
          : {}),
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

test('actual V4 serialized owner and independent assessor require the chosen exact font source', async () => {
  const original = await readFile(
    resolve('scripts/test-solo-selected-font-settlement.mjs'),
    'utf8',
  );
  const ast = parse(original, { ecmaVersion: 'latest', sourceType: 'module' });
  const names = ['deferred', 'face', 'harness', 'ownerHarness', 'completedOwner', 'readinessModel'];
  const functions = names
    .map((name) => {
      const node = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === name);
      assert(node, name);
      return original.slice(node.start, node.end);
    })
    .join('\n');
  const prior = await readFile(resolve('scripts/test-solo-selected-font-post-command.mjs'), 'utf8');
  const actualModel = prior.slice(
    prior.indexOf('function model('),
    prior.indexOf("\ntest('V3 serialized"),
  );
  const sandbox = {
    assert,
    JSON,
    TextEncoder,
    URL,
    structuredClone,
    createContext,
    runInContext,
    runInNewContext,
    createSelectedFontSettlementProbe,
    createBrowserReadinessProbe,
    selectedFont,
    actualModel,
    target: "600 16px 'Field Kit Display', 'Handjet', sans-serif",
    sample: 'Workshop Майстерня 012345',
    flush: async () => {
      await Promise.resolve();
      await Promise.resolve();
    },
    createSelectedFontSettlementOwner: (options) =>
      createSelectedFontSettlementOwner({
        ...options,
        sourceRevision: RUNTIME797_READINESS_SOURCE.revision,
      }),
  };
  const { completedOwner, readinessModel } = runInNewContext(
    functions + '\n({completedOwner,readinessModel})',
    sandbox,
  );
  const h = await completedOwner(),
    model = readinessModel('selected-font-request-settlement-v4');
  const raw = JSON.parse(
    JSON.stringify({ observation: model.observation, app: model.app, transport: model.transport }),
  );
  const owner = JSON.parse(JSON.stringify(h.owner.snapshot()));
  assert.deepEqual(owner.sourceBinding, {
    ...SELECTED_FONT_SOURCE_BINDING,
    revision: RUNTIME797_READINESS_SOURCE.revision,
  });
  assert.equal(
    assessSelectedFontSettlementReadiness(
      raw.observation,
      raw.app,
      1,
      raw.transport,
      owner,
      RUNTIME797_READINESS_SOURCE.revision,
    ).status,
    'passed',
  );
  assert.equal(
    assessSelectedFontSettlementReadiness(raw.observation, raw.app, 1, raw.transport, owner).status,
    'failed',
  );
  for (const change of [
    (o) => (o.sourceBinding.revision = SELECTED_FONT_SOURCE_BINDING.revision),
    (o) => (o.sourceBinding.css.sha256 = '0'.repeat(64)),
    (o) => o.sourceBinding.themeHost.bytes++,
    (o) => (o.closed = false),
    (o) => (o.evidence.calls[0].settlement = 'rejected'),
  ]) {
    const changed = structuredClone(owner);
    change(changed);
    assert.equal(
      assessSelectedFontSettlementReadiness(
        raw.observation,
        raw.app,
        1,
        raw.transport,
        changed,
        RUNTIME797_READINESS_SOURCE.revision,
      ).status,
      'failed',
    );
  }
  assert.deepEqual(selectedFontSourceBinding(), SELECTED_FONT_SOURCE_BINDING);
  assert.throws(() => selectedFontSourceBinding('a'.repeat(40)));
  assert.throws(() =>
    createSelectedFontSettlementOwner({ page: {}, sourceRevision: 'a'.repeat(40) }),
  );
});
test('actual qualifier forwards admitted source to both font owner and final assessment', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
    calls = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (
      n.type === 'CallExpression' &&
      n.callee?.type === 'MemberExpression' &&
      ['createSelectedFontSettlementOwner', 'assessSelectedFontSettlementReadiness'].includes(
        n.callee.property.name,
      )
    )
      calls.push(n);
    for (const [key, value] of Object.entries(n))
      if (key !== 'parent') Array.isArray(value) ? value.forEach(walk) : walk(value);
  };
  walk(ast);
  assert.equal(calls.length, 2);
  const owner = calls.find((n) => n.callee.property.name === 'createSelectedFontSettlementOwner');
  const property = owner.arguments[0].properties.find((n) => n.key.name === 'sourceRevision');
  assert.equal(
    source.slice(property.value.start, property.value.end),
    'readinessOptions.sourceRevision',
  );
  const final = calls
    .find((n) => n.callee.property.name === 'assessSelectedFontSettlementReadiness')
    .arguments.at(-1);
  assert.equal(source.slice(final.start, final.end), 'readinessOptions.sourceRevision');
});

test('exact797 source readback preserves all declared assets without claiming app lifecycle equivalence', async () => {
  const bytes = await read(manifest.sourceCompatibility.path);
  assert.equal(bytes.length, manifest.sourceCompatibility.bytes);
  assert.equal(hash(bytes), manifest.sourceCompatibility.sha256);
  const proof = JSON.parse(bytes);
  assert.equal(proof.source, RUNTIME797_READINESS_SOURCE.revision);
  assert.equal(proof.tree, RUNTIME797_READINESS_SOURCE.tree);
  assert.equal(proof.previous, '73a345cec696d7789198cf295ca5c37b17ca0e71');
  assert.equal(proof.records.length, 13);
  assert(proof.records.every((record) => record.equal && record.previous === record.object));
  for (const ref of [SELECTED_FONT_SOURCE_BINDING.css, SELECTED_FONT_SOURCE_BINDING.themeHost]) {
    const row = proof.records.find((r) => r.path === ref.path);
    assert.equal(row.bytes, ref.bytes);
    assert.equal(row.sha256, ref.sha256);
  }
  const font = proof.records.find((r) => r.path === 'game/' + selectedFont.relativePath);
  assert.equal(font.bytes, selectedFont.bytes);
  assert.equal(font.sha256, selectedFont.sha256);
  assert.equal(manifest.currentSourceCorrectness.status, 'passed-correctness-only');
  assert.deepEqual(manifest.currentSourceCorrectness.receipt, actualFirstEight);
});

test('prior de332 declaration readback rejects changed manifest, witness and unknown source without current admission fallback', async () => {
  const bytes = await read(DE332_PREPARATION_WITNESS);
  for (const path of [
    'docs/performance/solo-readiness-preparation-de332-plan.json',
    'docs/performance/solo-native-touch-de332-plan.json',
  ]) {
    const original = await read(path);
    assert(declaredPreparationRefs(bytes, path, original).size > 30);
    assert.throws(() =>
      declaredPreparationRefs(bytes, path, Buffer.concat([original, Buffer.from(' ')])),
    );
    assert.throws(() => declaredPreparationRefs(bytes, 'unknown', original));
    for (const mutate of [
      (value) => value.records.pop(),
      (value) => (value.records[0].sha256 = '0'.repeat(64)),
      (value) => (value.revision = '0'.repeat(40)),
      (value) => (value.tree = '0'.repeat(40)),
      (value) => value.declarations.pop(),
    ]) {
      const changed = JSON.parse(bytes);
      mutate(changed);
      assert.throws(() =>
        declaredPreparationRefs(Buffer.from(JSON.stringify(changed)), path, original),
      );
    }
  }
});
