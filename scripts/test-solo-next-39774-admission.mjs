import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { parse } from 'acorn';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { createBrowserHitchJournal, createHitchJournalStore } = await import(
  pathToFileURL(join(root, 'scripts/solo-qualification-hitch-journal.mjs')).href
);
const proposal = process.env.SOLO_NEXT_39774_PROPOSAL || root;
const {
  qualificationNextRouteOptions,
  NEXT_ROUTE_39774_SOURCE,
  NEXT_ROUTE_LIMITS,
  NEXT_ROUTE_IDENTITIES,
} = await import(pathToFileURL(join(root, 'scripts/solo-qualification-next-route.mjs')).href);
const {
  bindSustainedJob,
  sustainedMatrix,
  GEOMETRIC_NEXT_39774_SOURCE,
  geometricNextAssessment,
  verifyTimingHitchJournal,
} = await import(pathToFileURL(join(root, 'scripts/solo-remote-sustained.mjs')).href);
const historicalPath = 'docs/performance/solo-next-geometric-e1cc-plan.json';
const original = JSON.parse(await readFile(join(root, historicalPath)));
const heldPath = 'docs/performance/solo-next-geometric-39774-plan.json';
const workflowPath = '.github/workflows/solo-remote-next-geometric-39774-temporary.yml';
const held = JSON.parse(await readFile(join(proposal, heldPath)));
const bytes = await readFile(join(root, original.recipes.next.path));
const recipe = JSON.parse(bytes);
const flags = (revision) => [
  '--authored-next-route=authored-next-geometric-v1',
  '--work-probe',
  '--hitch-journal',
  '--cadence=settled120',
  '--source-revision=' + revision,
];
// In-memory schema controls only. These are not package pins and are never
// written to the held declaration or accepted as a native release witness.
function synthetic() {
  const plan = structuredClone(original),
    source = GEOMETRIC_NEXT_39774_SOURCE;
  plan.sourceCohort = source.name;
  plan.latestSourceRevision = source.candidate;
  plan.latestRuntimeRevision = source.runtime;
  plan.release.sourceCohort = source.name;
  plan.release.candidateRevision = source.candidate;
  plan.release.onceOnlyBefore = source.candidate;
  plan.candidate = {
    revision: source.candidate,
    tree: source.candidateTree,
    run: 1,
    artifact: 1,
    outer: { bytes: 1, sha256: 'a'.repeat(64) },
    inner: { bytes: 1, sha256: 'b'.repeat(64) },
    manifestSHA256: 'c'.repeat(64),
  };
  return plan;
}

test('only the exact separately named final source joins the unchanged geometric recipe', () => {
  assert.equal(NEXT_ROUTE_39774_SOURCE, '39774cce8697d412d138ef4da11ac547a5f8e535');
  assert.equal(
    GEOMETRIC_NEXT_39774_SOURCE.candidateTree,
    'cac2369a26cac5282e4260c638b934540d17ced6',
  );
  assert.deepEqual(qualificationNextRouteOptions(flags(NEXT_ROUTE_39774_SOURCE), recipe, bytes), {
    protocol: 'authored-next-geometric-v1',
    sourceRevision: NEXT_ROUTE_39774_SOURCE,
  });
  for (const revision of [
    'f'.repeat(40),
    NEXT_ROUTE_39774_SOURCE.slice(0, -1),
    NEXT_ROUTE_39774_SOURCE.toUpperCase(),
  ])
    assert.throws(() => qualificationNextRouteOptions(flags(revision), recipe, bytes));
  assert.throws(() =>
    qualificationNextRouteOptions(
      [...flags(NEXT_ROUTE_39774_SOURCE), '--source-revision=' + original.candidate.revision],
      recipe,
      bytes,
    ),
  );
  for (const flag of [
    '--cpu-profile',
    '--baseline-runtime',
    '--memory-profile',
    '--readiness-probe=first-running-v1',
  ])
    assert.throws(() =>
      qualificationNextRouteOptions([...flags(NEXT_ROUTE_39774_SOURCE), flag], recipe, bytes),
    );
  const changed = Buffer.from(bytes);
  changed[changed.length - 2] ^= 1;
  assert.throws(() =>
    qualificationNextRouteOptions(flags(NEXT_ROUTE_39774_SOURCE), recipe, changed),
  );
});

test('all six final-source schema rows preserve candidate-only route and owner bounds', () => {
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const old = bindSustainedJob(original, engine, repetition);
      const current = bindSustainedJob(synthetic(), engine, repetition);
      assert.equal(current.rows.length, 1);
      assert.equal(current.rows[0].source, 'candidate');
      for (const key of [
        'rows',
        'helperTimeoutMs',
        'setupTimeoutMs',
        'calibrationTimeoutMs',
        'evidenceBytes',
        'rowEvidenceBytes',
        'calibrationPreset',
        'nativeRouteProtocol',
        'recipes',
        'performanceExclusion',
      ])
        assert.deepEqual(current[key], old[key], key);
      assert.equal(current.candidate.revision, NEXT_ROUTE_39774_SOURCE);
    }
  assert.deepEqual(sustainedMatrix(synthetic()), sustainedMatrix(original));
});

test('mixed final-source bindings and widened route controls remain rejected', () => {
  for (const mutate of [
    (p) => (p.candidate.revision = original.candidate.revision),
    (p) => (p.candidate.tree = original.candidate.tree),
    (p) => (p.latestRuntimeRevision = original.candidate.revision),
    (p) => (p.latestSourceRevision = original.candidate.revision),
    (p) => (p.release.onceOnlyBefore = original.candidate.revision),
    (p) => (p.release.sourceCohort = original.sourceCohort),
    (p) => (p.candidateOnly = false),
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.phase = 'retry'),
    (p) => (p.recipes.next.sha256 = 'd'.repeat(64)),
    (p) => (p.nativeRouteProtocol = 'authored-next-geometric-v2'),
  ]) {
    const p = synthetic();
    mutate(p);
    assert.throws(() => bindSustainedJob(p, 'chromium', 1));
  }
});

test('actual397 package and scoped prior owners bind six rows at the reviewed one-shot edge', async () => {
  const expectedCandidate = {
    revision: '39774cce8697d412d138ef4da11ac547a5f8e535',
    tree: 'cac2369a26cac5282e4260c638b934540d17ced6',
    run: 39066188021,
    artifact: 12114802738,
    outer: {
      bytes: 1092535270,
      sha256: '6da8f8e085c18168f17c8a0e6348890b1f5ade90a4404463d1ba6dfd69b31fcb',
    },
    inner: {
      bytes: 1074103399,
      sha256: '4a93ff4a892ea17d89e7fd42e5da7d079e0db3a03159ebaf2d74971995ebd6bd',
    },
    manifestSHA256: '7ff350dfb99ef499d3af61b43178c0149d699e2d51cc1c76f9142318a5b3e190',
    producer:
      'Exact successful Appearance package, Node22.13.1 Linux; original focused-policy metadata retained. Full outer/member/source/CSP verification required remotely before any native row.',
  };
  assert.deepEqual(held.candidate, expectedCandidate);
  assert.deepEqual(held.packageMetadataProof, {
    path: '.cache/solo-followup/397-package/appearance-analysis.json',
    bytes: 14638,
    sha256: '56820945ef7af4aeed69bff886c48c202f533ca27f50236105bc3633633291a6',
  });
  assert.deepEqual(held.priorLinuxOwners, {
    path: '.cache/solo-followup/final397-next-proposal/prior-owners/combined-readback.json',
    bytes: 1173,
    sha256: 'a469e0ae19e4234faba4e72de7043dc9aef68ab46d123f103b162a526486024a',
  });
  assert.equal(held.release.status, 'reviewed-diagnostic-only');
  assert.equal(held.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(held.releaseTrigger.onceOnlyBefore, NEXT_ROUTE_39774_SOURCE);
  assert.equal(held.release.onceOnlyBefore, NEXT_ROUTE_39774_SOURCE);
  assert.equal(held.release.firstEightRequired, false);
  assert.equal(held.currentSourceCorrectness.status, 'unobserved');
  assert.equal(held.performanceExclusion, true);
  for (const key of ['noUnclosedOwners', 'allPriorPlannedJobsClosed', 'priorProofInspected'])
    assert.equal(held.release[key], true);
  assert.equal(
    held.release.evidence.filter(
      (e) => e.runId === 39044567236 && e.disposition === 'failed-reviewed',
    ).length,
    6,
  );
  assert.match(held.release.ownerScope, /No global/);
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const row = bindSustainedJob(held, engine, repetition);
      assert.equal(row.rows.length, 1);
      assert.equal(row.rows[0].source, 'candidate');
    }
  for (const key of ['run', 'artifact', 'outer', 'inner', 'manifestSHA256']) {
    const invalid = structuredClone(held);
    invalid.candidate[key] = null;
    assert.throws(() => bindSustainedJob(invalid, 'chromium', 1));
  }
  const workflow = await readFile(join(proposal, workflowPath), 'utf8');
  assertReleaseGuard(workflow);
  assert(workflow.includes('ref: ' + NEXT_ROUTE_39774_SOURCE));
  assert(workflow.includes('install --with-deps chromium webkit'));
  assert(workflow.includes('cancel-in-progress: false'));
  assert(!workflow.includes('workflow_dispatch'));
  assert(!workflow.includes('continue-on-error'));
  assert(!workflow.includes('npm ci --prefix baseline'));
});

const releaseConditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == '39774cce8697d412d138ef4da11ac547a5f8e535'",
];
function assertReleaseGuard(text) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], releaseConditions.join(' && '));
  assert.equal((text.match(/^    if:/gm) ?? []).length, 1);
}
test('each one-shot condition is required and no alternate dispatch is admitted', async () => {
  const text = await readFile(join(proposal, workflowPath), 'utf8');
  assertReleaseGuard(text);
  for (const condition of releaseConditions)
    assert.throws(() =>
      assertReleaseGuard(
        text.replace(
          releaseConditions.join(' && '),
          releaseConditions.filter((x) => x !== condition).join(' && '),
        ),
      ),
    );
  for (const wrong of ['true', 'false'])
    assert.throws(() => assertReleaseGuard(text.replace(releaseConditions.join(' && '), wrong)));
});

test('current frozen runtime inputs and sparse support are exact; historical declarations stay immutable', async () => {
  const workflow = await readFile(join(proposal, workflowPath), 'utf8');
  const lists = [
    ...workflow.matchAll(/          sparse-checkout: \|\n((?:            .+\n)+)/g),
  ].map((m) =>
    m[1]
      .trim()
      .split('\n')
      .map((l) => l.trim().slice(1)),
  );
  assert.equal(lists.length, 2);
  for (const list of lists) assert.equal(new Set(list).size, list.length);
  for (const ref of [...held.frozenTools, ...held.adapterInputs, ...Object.values(held.recipes)]) {
    const value = await readFile(join(proposal, ref.path)).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return readFile(join(root, ref.path));
    });
    assert.equal(value.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(value).digest('hex'), ref.sha256, ref.path);
    for (const list of lists) assert(list.includes(ref.path), ref.path);
  }
  for (const path of lists[1])
    assert(
      (
        await readFile(join(proposal, path)).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
          return readFile(join(root, path));
        })
      ).length > 0,
      path,
    );
  for (const [path, hash] of [
    [
      'docs/performance/solo-next-geometric-c696-plan.json',
      'ca1c5c8994f8fdddcedee0137929a23161d92dcbebdb3d21e6a3945c250b2376',
    ],
    [
      'docs/performance/solo-next-geometric-e1cc-plan.json',
      'dc8da4df17877b83f6afb9c657f960bdb97227073be5beafd3631ceb48c167d4',
    ],
    [
      '.github/workflows/solo-remote-next-geometric-c696-temporary.yml',
      'b2071becacdd008ab088f7df5c8b410aca92de3d826354910a25ad7ccb268aa4',
    ],
    [
      '.github/workflows/solo-remote-next-geometric-e1cc-temporary.yml',
      '02e00c52e02ee51441c129b6c8305cfce56854eaf9a3d0e93773ba2dddbace7a',
    ],
  ])
    assert.equal(
      createHash('sha256')
        .update(await readFile(join(root, path)))
        .digest('hex'),
      hash,
      path,
    );
});

test('eleven missions, ten Next actions, strict replay and original short command budget remain exact', () => {
  assert.deepEqual(held.recipes, original.recipes);
  assert.deepEqual(held.jobs, original.jobs);
  assert.deepEqual(held.deadlines, original.deadlines);
  assert.deepEqual(held.resources, original.resources);
  assert.equal(recipe.timeoutMs, 1200000);
  assert.equal(recipe.actions.filter((a) => a.type === 'authored-next-route').length, 11);
  assert.equal(
    recipe.actions.filter((a) => a.type === 'click' && a.selector === '#next-button').length,
    10,
  );
  assert.deepEqual(NEXT_ROUTE_LIMITS, {
    missionMs: 60000,
    stageMs: 15000,
    pollMs: 50,
    operationMs: 100,
    reads: 1201,
    events: 128,
    stages: 32,
    evidenceBytes: 65536,
  });
  assert.equal(bytes.length, 9086);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), original.recipes.next.sha256);
});

// Reuse actual existing test fixtures and adverse assertions under the new source.
// The final-source call uses the actual admitted declaration; all adverse assertions remain unchanged.
test('new source preserves actual transition assessment and binary-journal failure boundaries', async (t) => {
  const source = await readFile(
    join(root, 'scripts/test-solo-next-geometric-admission.mjs'),
    'utf8',
  );
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const sample = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'sample',
  );
  assert(sample);
  const callbacks = [
    'post-child route assessment retains numerical failures and rejects missing transitions, owners, replay and cleanup',
    'actual candidate journal sidecar is independently reread and changed bytes remain invalid',
  ].map((name) => {
    const call = ast.body.find(
      (node) =>
        node.type === 'ExpressionStatement' &&
        node.expression.type === 'CallExpression' &&
        node.expression.callee.name === 'test' &&
        node.expression.arguments[0]?.value === name,
    )?.expression;
    assert(call, name);
    return source.slice(call.arguments[1].start, call.arguments[1].end);
  });
  const context = {
    assert,
    bindSustainedJob,
    geometricNextAssessment,
    verifyTimingHitchJournal,
    createBrowserHitchJournal,
    createHitchJournalStore,
    NEXT_ROUTE_IDENTITIES,
    manifest: held,
    fixture: recipe,
    readFile,
    writeFile,
    mkdtemp,
    realpath,
    rm,
    join,
    tmpdir,
    URL,
    Buffer,
  };
  const evaluate = new Function(
    ...Object.keys(context),
    source.slice(sample.start, sample.end) +
      ';const assess = (s) => geometricNextAssessment(s.plan,s.row,s.raw,s.command,"test-version",s.journal);return [' +
      callbacks.join(',') +
      '];',
  );
  for (const run of evaluate(...Object.values(context))) await run(t);
});
