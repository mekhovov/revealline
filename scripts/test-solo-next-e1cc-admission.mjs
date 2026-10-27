import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// This executed declaration is immutable. New declarations must check current files.
const executionWitnessBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-readiness-geometry/7c7-execution-source.json',
    import.meta.url,
  ),
);
function executedBindings(bytes, declarationBytes, workflowBytes) {
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    'a54fa43e5f89dc2ccce08f69892421213d5a6a0deb107ebc6dc320f174665613',
  );
  const witness = JSON.parse(bytes);
  assert.equal(witness.head, '7c7cc2648331870683ac7b76850bbeff859f802e');
  assert.equal(witness.tree, 'e20aabb50c0e82c52c0970a14934b2d05611f53e');
  for (const [path, value] of [
    ['docs/performance/solo-next-geometric-e1cc-plan.json', declarationBytes],
    ['.github/workflows/solo-remote-next-geometric-e1cc-temporary.yml', workflowBytes],
  ]) {
    const entry = witness.records.find((r) => r.path === path);
    assert(entry, path);
    assert.equal(value.length, entry.bytes, path);
    assert.equal(createHash('sha256').update(value).digest('hex'), entry.sha256, path);
  }
  return witness;
}
const root = process.cwd();
const dir = process.env.SOLO_NEXT_E1CC_PROPOSAL || join(root, 'scripts');
const { qualificationNextRouteOptions, NEXT_ROUTE_SOURCE, NEXT_ROUTE_FINAL_SOURCE } = await import(
  pathToFileURL(join(dir, 'solo-qualification-next-route.mjs')).href
);
const { bindSustainedJob, GEOMETRIC_NEXT_FINAL_SOURCE } = await import(
  pathToFileURL(join(dir, 'solo-remote-sustained.mjs')).href
);
const original = JSON.parse(
  await readFile(join(root, 'docs/performance/solo-next-geometric-c696-plan.json')),
);
const bytes = await readFile(join(root, original.recipes.next.path));
const scenario = JSON.parse(bytes);
const flags = (revision) => [
  '--authored-next-route=authored-next-geometric-v1',
  '--work-probe',
  '--hitch-journal',
  '--cadence=settled120',
  '--source-revision=' + revision,
];
const pending = () => {
  const plan = structuredClone(original),
    source = GEOMETRIC_NEXT_FINAL_SOURCE;
  plan.sourceCohort = source.name;
  plan.latestRuntimeRevision = source.runtime;
  plan.latestSourceRevision = source.candidate;
  plan.release.sourceCohort = source.name;
  plan.release.candidateRevision = source.candidate;
  plan.release.onceOnlyBefore = source.candidate;
  plan.candidate = {
    revision: source.candidate,
    tree: source.candidateTree,
    run: null,
    artifact: null,
    outer: null,
    inner: null,
    manifestSHA256: null,
  };
  return plan;
};
// Synthetic shape used only in memory to test strict schema/source dispatch.
// It is not an executable artifact declaration or package identity witness.
function synthetic() {
  const plan = pending();
  Object.assign(plan.candidate, {
    run: 1,
    artifact: 1,
    outer: { bytes: 1, sha256: 'a'.repeat(64) },
    inner: { bytes: 1, sha256: 'b'.repeat(64) },
    manifestSHA256: 'c'.repeat(64),
  });
  return plan;
}

test('original authored route source remains exact and the final-layout source is explicitly admitted', () => {
  for (const revision of [NEXT_ROUTE_SOURCE, NEXT_ROUTE_FINAL_SOURCE])
    assert.deepEqual(qualificationNextRouteOptions(flags(revision), scenario, bytes), {
      protocol: 'authored-next-geometric-v1',
      sourceRevision: revision,
    });
  for (const revision of [
    'f'.repeat(40),
    NEXT_ROUTE_FINAL_SOURCE.slice(0, -1),
    NEXT_ROUTE_FINAL_SOURCE.toUpperCase(),
  ])
    assert.throws(() => qualificationNextRouteOptions(flags(revision), scenario, bytes));
  assert.throws(() =>
    qualificationNextRouteOptions(
      [...flags(NEXT_ROUTE_SOURCE), '--source-revision=' + NEXT_ROUTE_FINAL_SOURCE],
      scenario,
      bytes,
    ),
  );
  for (const flag of [
    '--baseline-runtime',
    '--cpu-profile',
    '--memory-profile',
    '--readiness-probe=first-running-v1',
  ])
    assert.throws(() =>
      qualificationNextRouteOptions([...flags(NEXT_ROUTE_FINAL_SOURCE), flag], scenario, bytes),
    );
});

test('unresolved package cannot produce a single executable final-source row', () => {
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3])
      assert.throws(() => bindSustainedJob(pending(), engine, repetition));
});

test('six synthetic schema controls keep exact final source and original route, bounds and candidate-only rows', () => {
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const old = bindSustainedJob(original, engine, repetition),
        plan = bindSustainedJob(synthetic(), engine, repetition);
      assert.equal(plan.rows.length, 1);
      assert.equal(plan.rows[0].source, 'candidate');
      for (const key of [
        'helperTimeoutMs',
        'evidenceBytes',
        'rowEvidenceBytes',
        'setupTimeoutMs',
        'calibrationTimeoutMs',
        'calibrationPreset',
        'nativeRouteProtocol',
        'recipes',
        'performanceExclusion',
      ])
        assert.deepEqual(plan[key], old[key]);
      assert.equal(plan.candidate.revision, NEXT_ROUTE_FINAL_SOURCE);
    }
});

test('final-source dispatch rejects mixed identities, old trigger, role authority and altered recipe', () => {
  for (const mutate of [
    (p) => (p.candidate.revision = NEXT_ROUTE_SOURCE),
    (p) => (p.candidate.tree = original.candidate.tree),
    (p) => (p.latestRuntimeRevision = NEXT_ROUTE_SOURCE),
    (p) => (p.latestSourceRevision = NEXT_ROUTE_SOURCE),
    (p) => (p.release.onceOnlyBefore = original.release.onceOnlyBefore),
    (p) => (p.sourceCohort = original.sourceCohort),
    (p) => (p.release.sourceCohort = original.sourceCohort),
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.candidateOnly = false),
    (p) => (p.phase = 'retry'),
    (p) => (p.recipes.next.sha256 = 'd'.repeat(64)),
    (p) => (p.nativeRouteProtocol = 'authored-next-geometric-v2'),
  ]) {
    const p = synthetic();
    mutate(p);
    assert.throws(() => bindSustainedJob(p, 'chromium', 1));
  }
});

test('actual package and scoped prior owners bind all six rows at one reviewed push edge', async () => {
  const held = JSON.parse(
    await readFile(join(root, 'docs/performance/solo-next-geometric-e1cc-plan.json')),
  );
  assert.equal(held.candidate.run, 39037874955);
  assert.equal(held.candidate.artifact, 12104590541);
  assert.deepEqual(held.candidate.outer, {
    bytes: 1091965213,
    sha256: 'fb85094a61cdc329ccf8a1488b6e3ca1043ef5f249a6b33729bb04141336af1e',
  });
  assert.deepEqual(held.candidate.inner, {
    bytes: 1073790972,
    sha256: '6c8bbb6aafe3f9d55e2fb445d5846a5e9d02ebd648c4e630889743bf76ec421e',
  });
  assert.equal(
    held.candidate.manifestSHA256,
    '23f555db20036838cc1601f2cebf8f1a75eb62fb0c6cf36f1e1988035b3e1b64',
  );
  assert.equal(held.candidate.revision, NEXT_ROUTE_FINAL_SOURCE);
  assert.equal(held.release.status, 'reviewed-diagnostic-only');
  assert.equal(held.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(held.releaseTrigger.onceOnlyBefore, NEXT_ROUTE_FINAL_SOURCE);
  assert.equal(held.release.noUnclosedOwners, true);
  assert.equal(held.release.firstEightAllCorrectnessPassed, false);
  assert.equal(held.currentSourceCorrectness.status, 'unobserved');
  assert.equal(
    held.priorLinuxOwners.sha256,
    'a9c8afc47cc982ed74a87af50a7c4bab60dd5fd8dbc6c494ce39d48dc01383a1',
  );
  assert.equal(
    held.packageMetadataProof.sha256,
    'fd82e61aee70d927d9860e62063dd373733d6d3108d61e8b4bd0e5a22849b54a',
  );
  assert.equal(held.predecessorSetupFailure.nativeObservations, 0);
  assert.equal(held.predecessorSetupFailure.failedJobs, 6);
  assert.equal(held.predecessorSetupFailure.closedCommands, 24);
  assert.equal(
    held.release.evidence.filter(
      (e) => e.runId === 39037875135 && e.disposition === 'failed-reviewed',
    ).length,
    6,
  );
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const row = bindSustainedJob(held, engine, repetition);
      assert.equal(row.rows.length, 1);
      assert.equal(row.rows[0].source, 'candidate');
    }
  const text = await readFile(
    join(root, '.github/workflows/solo-remote-next-geometric-e1cc-temporary.yml'),
    'utf8',
  );
  assert.equal(text.split('\n').filter((l) => l.startsWith('    if:')).length, 1);
  assertReleaseGuard(text);
  assert(text.includes('ref: ' + NEXT_ROUTE_FINAL_SOURCE));
  assert(!text.includes('ref: ' + NEXT_ROUTE_SOURCE));
  assert(!text.includes('workflow_dispatch'));
  assert(!text.includes('continue-on-error'));
  assert(!text.includes('npm ci --prefix baseline'));
});

test('executed7c7 tools retain exact source bindings and historical sparse input coverage', async () => {
  const plan = JSON.parse(
    await readFile(join(root, 'docs/performance/solo-next-geometric-e1cc-plan.json')),
  );
  const workflow = await readFile(
    join(root, '.github/workflows/solo-remote-next-geometric-e1cc-temporary.yml'),
    'utf8',
  );
  const lists = [
    ...workflow.matchAll(/          sparse-checkout: \|\n((?:            .+\n)+)/g),
  ].map((m) =>
    m[1]
      .trim()
      .split('\n')
      .map((l) => l.trim().slice(1)),
  );
  assert.equal(lists.length, 2);
  assert.equal(new Set(lists[1]).size, lists[1].length);
  const execution = executedBindings(
    executionWitnessBytes,
    await readFile(join(root, 'docs/performance/solo-next-geometric-e1cc-plan.json')),
    Buffer.from(workflow),
  );
  for (const ref of [...plan.frozenTools, ...plan.adapterInputs, ...Object.values(plan.recipes)]) {
    const entry = execution.records.find((r) => r.path === ref.path);
    assert(entry, ref.path);
    assert.equal(entry.bytes, ref.bytes, ref.path);
    assert.equal(entry.sha256, ref.sha256, ref.path);
    assert(lists[1].includes(ref.path), ref.path);
  }
  for (const path of lists[1]) assert((await readFile(join(root, path))).length > 0, path);
});

const releaseConditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17'",
];
function assertReleaseGuard(text) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], releaseConditions.join(' && '));
  assert.equal((text.match(/^    if:/gm) ?? []).length, 1);
}
test('each exact release condition remains mandatory without alternate dispatch', async () => {
  const text = await readFile(
    join(root, '.github/workflows/solo-remote-next-geometric-e1cc-temporary.yml'),
    'utf8',
  );
  assertReleaseGuard(text);
  for (const condition of releaseConditions) {
    const wrong = text.replace(
      releaseConditions.join(' && '),
      releaseConditions.filter((x) => x !== condition).join(' && '),
    );
    assert.throws(() => assertReleaseGuard(wrong));
  }
  assert.throws(() => assertReleaseGuard(text.replace(releaseConditions.join(' && '), 'true')));
});

test('immutable7c7 witness rejects altered source, declaration and workflow identities', async () => {
  const declaration = await readFile(
    join(root, 'docs/performance/solo-next-geometric-e1cc-plan.json'),
  );
  const workflow = await readFile(
    join(root, '.github/workflows/solo-remote-next-geometric-e1cc-temporary.yml'),
  );
  executedBindings(executionWitnessBytes, declaration, workflow);
  for (const slot of [0, 1, 2]) {
    const inputs = [executionWitnessBytes, declaration, workflow].map((bytes) =>
      Buffer.from(bytes),
    );
    inputs[slot][0] ^= 1;
    assert.throws(() => executedBindings(...inputs));
  }
});
