import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateStackRun,
  validateStackPacket,
  stackFailure,
  stackArtifactName,
} from './pages-stack-packet.mjs';
import { freezeStackSnapshot } from './pages-stack-contract.mjs';

const source = 'a'.repeat(40);
const expected = { runId: '123', runAttempt: '2', controllerSha: source };
const run = () => ({
  id: 123,
  run_attempt: 2,
  head_sha: source,
  head_branch: 'main',
  event: 'workflow_dispatch',
  path: '.github/workflows/measure-pages-stack.yml',
  repository: { full_name: 'mekhovov/revealline' },
});
test('run provenance includes exact controller, workflow, branch, repository and attempt', () => {
  assert.equal(validateStackRun(run(), expected).runAttempt, '2');
  for (const [key, value] of [
    ['id', 124],
    ['run_attempt', 1],
    ['head_sha', 'b'.repeat(40)],
    ['head_branch', 'branch'],
    ['event', 'push'],
    ['path', '.github/workflows/measure-pages-candidate.yml'],
    ['repository', { full_name: 'other/repo' }],
  ]) {
    assert.throws(() => validateStackRun({ ...run(), [key]: value }, expected));
  }
});
test('diagnostic artifact names bind run attempt and reject coercion or production names', () => {
  assert.equal(stackArtifactName('pages', expected), 'stack-pages-123-2');
  for (const kind of ['github-pages', '', '../pages'])
    assert.throws(() => stackArtifactName(kind, expected));
  for (const runId of ['01', '1\n', null, 1.5, '-1'])
    assert.throws(() => stackArtifactName('pages', { ...expected, runId }));
});
test('failure and incomplete build results cannot assert measurements or admission', () => {
  for (const reason of ['build-incomplete', 'independent-verification-failed']) {
    const result = stackFailure(reason);
    for (const key of [
      'measurementComplete',
      'currentQueueEligible',
      'mergeAuthorized',
      'qualificationPerformed',
      'productionDeploymentPerformed',
    ])
      assert.equal(result[key], false);
    assert.equal(Object.hasOwn(result, 'archiveBytes'), false);
  }
  assert.throws(() => stackFailure('arbitrary candidate error text'));
});

function packet() {
  const heads = ['b'.repeat(40), 'c'.repeat(40)];
  const flags = {
    mergeAuthorized: false,
    qualificationPerformed: false,
    productionDeploymentPerformed: false,
  };
  const input = {
    mainSha: source,
    entries: heads.map((headSha, i) => ({ prNumber: i + 1, headSha })),
  };
  const observations = heads.map((head, i) => ({
    pull: {
      number: i + 1,
      state: 'open',
      draft: true,
      mergeable: null,
      mergeable_state: 'unknown',
      head: { sha: head, ref: `codex/branch-${i}`, repo: { full_name: 'mekhovov/revealline' } },
      base: {
        sha: i ? heads[0] : source,
        ref: i ? 'codex/branch-0' : 'main',
        repo: { full_name: 'mekhovov/revealline' },
      },
    },
    baseTipSha: i ? heads[0] : source,
    baseProof: {
      ancestor: i ? heads[0] : source,
      descendant: i ? heads[0] : source,
      verified: true,
    },
    parentProof: i ? { ancestor: heads[0], descendant: head, verified: true } : null,
    checks: { total_count: 0, check_runs: [] },
    statuses: [],
  }));
  const steps = heads.map((headSha, i) => ({
    headSha,
    tree: String(i + 3).repeat(40),
    commit: String(i + 1).repeat(40),
  }));
  const composition = {
    format: 'revealline-pages-stack-object-composition.v1',
    mainSha: source,
    headShas: heads,
    steps,
    tree: steps[1].tree,
    commit: steps[1].commit,
    ...flags,
  };
  return {
    format: 'revealline-pages-stack-preflight.v1',
    ...expected,
    input,
    snapshot: freezeStackSnapshot(input, observations),
    composition,
    pathEvidence: [
      [source, steps[0].commit],
      [steps[0].commit, steps[1].commit],
      [source, steps[1].commit],
    ].map(([baseSha, sourceSha]) => ({ baseSha, sourceSha, paths: ['game/example.mjs'] })),
    syntheticSha: composition.commit,
    syntheticTree: composition.tree,
    sourceCommittedAt: '2026-10-16T00:00:00Z',
    buildVersion: `main-${composition.commit.slice(0, 12)}`,
    overlay: {
      format: 'revealline-pages-candidate-overlay.v1',
      repository: 'mekhovov/revealline',
      basePath: '/revealline/',
      selectorSha256: 'a'.repeat(64),
      releases: [],
      files: [{ path: 'practice/index.json', bytes: 1, sha256: 'a'.repeat(64) }],
    },
    controllerClosure: {
      entry: 'publishing/optional-package-promotion.mjs',
      paths: ['publishing/optional-package-promotion.mjs'],
      packages: [],
      files: [{ path: 'publishing/optional-package-promotion.mjs', sha256: 'a'.repeat(64) }],
    },
    ...flags,
  };
}
test('validates complete detached preflight schema and rejects tampered binding or authority', () => {
  assert.equal(validateStackPacket(packet(), expected).syntheticSha, '2'.repeat(40));
  const mutations = [
    (p) => {
      p.extra = true;
    },
    (p) => {
      p.runAttempt = '1';
    },
    (p) => {
      p.controllerSha = 'e'.repeat(40);
    },
    (p) => {
      p.syntheticSha = source;
    },
    (p) => {
      p.syntheticTree = source;
    },
    (p) => {
      p.buildVersion = 'arbitrary';
    },
    (p) => {
      p.snapshot.members[1].baseRef = 'other';
    },
    (p) => {
      p.snapshot.members[0].repository = 'foreign/repo';
    },
    (p) => {
      p.snapshot.members[0].extra = true;
    },
    (p) => {
      p.composition.steps[0].commit = source;
    },
    (p) => {
      p.composition.steps[1].headSha = headsMissing();
    },
    (p) => {
      p.composition.steps.pop();
    },
    (p) => {
      p.pathEvidence.pop();
    },
    (p) => {
      p.pathEvidence[0].paths = ['scripts/changed.mjs'];
    },
    (p) => {
      p.pathEvidence[1].paths = ['publishing/optional-package-promotion.mjs'];
    },
    (p) => {
      p.pathEvidence[0].sourceSha = source;
    },
    (p) => {
      p.controllerClosure.files[0].sha256 = 'bad';
    },
    (p) => {
      p.controllerClosure.entry = '../wrong';
    },
    (p) => {
      p.overlay.files[0].path = 'practice/../escape';
    },
    (p) => {
      p.overlay.files[0].bytes = 950000001;
    },
    (p) => {
      p.overlay.files.push(p.overlay.files[0]);
    },
    (p) => {
      p.mergeAuthorized = true;
    },
    (p) => {
      p.composition.qualificationPerformed = true;
    },
    (p) => {
      p.snapshot.productionDeploymentPerformed = true;
    },
    (p) => {
      p.sourceCommittedAt = 'invalid';
    },
  ];
  for (const mutate of mutations) {
    const p = packet();
    mutate(p);
    assert.throws(() => validateStackPacket(p, expected));
  }
});
function headsMissing() {
  return 'f'.repeat(40);
}
