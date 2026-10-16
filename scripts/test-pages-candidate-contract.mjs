import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANDIDATE_REPOSITORY as repository,
  parseCandidateInput,
  validateCandidateSnapshot,
  unsupportedCandidatePaths,
  validateArtifactProvenance,
  validateCandidateRun,
  assessCandidateFreshness,
} from './pages-candidate-contract.mjs';

const mainSha = 'a'.repeat(40),
  headSha = 'b'.repeat(40),
  syntheticSha = 'c'.repeat(40);
const input = () => ({ prNumber: '123', mainSha, headSha });
const pr = () => ({
  number: 123,
  state: 'open',
  draft: true,
  base: { ref: 'main', sha: mainSha, repo: { full_name: repository } },
  head: { sha: headSha, repo: { full_name: repository } },
});

test('canonical bounded inputs reject coercion, whitespace, extra keys and malformed SHAs', () => {
  assert.deepEqual(parseCandidateInput(input()), { prNumber: 123, mainSha, headSha });
  assert.equal(parseCandidateInput({ ...input(), prNumber: 99999999 }).prNumber, 99999999);
  for (const prNumber of [
    '0',
    '01',
    ' 123',
    '+123',
    '1e2',
    '123\n',
    0,
    -1,
    1.5,
    100000000,
    ['123'],
    null,
  ])
    assert.throws(() => parseCandidateInput({ ...input(), prNumber }));
  for (const value of [mainSha.toUpperCase(), mainSha + '\n', mainSha.slice(1), [mainSha], null]) {
    assert.throws(() => parseCandidateInput({ ...input(), mainSha: value }));
    assert.throws(() => parseCandidateInput({ ...input(), headSha: value }));
  }
  assert.throws(() => parseCandidateInput({ ...input(), extra: true }));
  assert.throws(() => parseCandidateInput(null));
});

test('same-repository open draft and non-draft snapshots are supported, not qualified', () => {
  const frozen = validateCandidateSnapshot(pr(), input());
  assert.equal(frozen.state, 'OPEN');
  assert.equal(frozen.draft, true);
  assert.equal(frozen.mainSha, mainSha);
  assert.equal(frozen.baseSha, mainSha);
  assert.equal(frozen.baseAncestorOfMain, true);
  const ready = pr();
  ready.state = 'OPEN';
  ready.draft = false;
  assert.equal(validateCandidateSnapshot(ready, input()).draft, false);
});

test('an older reported base requires exact identity plus explicit trusted ancestry proof', () => {
  const snapshot = pr();
  snapshot.base.sha = syntheticSha;
  const options = { reportedBaseSha: syntheticSha, baseIsAncestorOfMain: true };
  const frozen = validateCandidateSnapshot(snapshot, input(), options);
  assert.equal(frozen.mainSha, mainSha);
  assert.equal(frozen.baseSha, syntheticSha);
  assert.equal(frozen.baseAncestorOfMain, true);
  assert.throws(() => validateCandidateSnapshot(snapshot, input()));
  assert.throws(() =>
    validateCandidateSnapshot(snapshot, input(), { reportedBaseSha: syntheticSha }),
  );
  assert.throws(() =>
    validateCandidateSnapshot(snapshot, input(), { ...options, baseIsAncestorOfMain: false }),
  );
  assert.throws(() =>
    validateCandidateSnapshot(snapshot, input(), { ...options, reportedBaseSha: mainSha }),
  );
  for (const value of [true.toString(), 1, null, [], {}])
    assert.throws(() =>
      validateCandidateSnapshot(snapshot, input(), { ...options, baseIsAncestorOfMain: value }),
    );
  for (const value of [syntheticSha.toUpperCase(), syntheticSha + '\n', null, [syntheticSha]])
    assert.throws(() =>
      validateCandidateSnapshot(snapshot, input(), { ...options, reportedBaseSha: value }),
    );
});

for (const [name, mutate] of [
  [
    'number',
    (p) => {
      p.number = 124;
    },
  ],
  [
    'closed',
    (p) => {
      p.state = 'closed';
    },
  ],
  [
    'draft missing',
    (p) => {
      delete p.draft;
    },
  ],
  [
    'coercible draft',
    (p) => {
      p.draft = 'false';
    },
  ],
  [
    'foreign base repo',
    (p) => {
      p.base.repo.full_name = 'other/repo';
    },
  ],
  [
    'fork',
    (p) => {
      p.head.repo.full_name = 'other/revealline';
    },
  ],
  [
    'deleted head repo',
    (p) => {
      p.head.repo = null;
    },
  ],
  [
    'stacked base',
    (p) => {
      p.base.ref = 'parent';
    },
  ],
  [
    'base SHA',
    (p) => {
      p.base.sha = headSha;
    },
  ],
  [
    'head SHA',
    (p) => {
      p.head.sha = mainSha;
    },
  ],
])
  test(`snapshot rejects ${name}`, () => {
    const snapshot = pr();
    mutate(snapshot);
    assert.throws(() => validateCandidateSnapshot(snapshot, input()));
  });

test('first-unit boundary rejects controller/build contracts while allowing selector data and content', () => {
  const blocked = [
    'scripts/game-cli.mjs',
    'scripts/build-entry-writer.mjs',
    'scripts/pages-capacity-evidence.py',
    'scripts/pages-candidate-contract.mjs',
    'scripts/write-main-pages-metadata.mjs',
    'scripts/access-pages.mjs',
    'scripts/publish-optional-packages.mjs',
    '.github/workflows/publish-main-pages.yml',
    'publishing/another-profile.json',
    'game/build-config.json',
    'package.json',
    'package-lock.json',
    'game/optional-practice-details.mjs',
    'optional-practice/navigation.mjs',
  ];
  assert.deepEqual(unsupportedCandidatePaths([...blocked, ...blocked]).sort(), blocked.sort());
  assert.deepEqual(
    unsupportedCandidatePaths([
      'publishing/pages-controller/optional-packages.json',
      'game/runtime.mjs',
      'game/content/example.json',
      'docs/example.md',
    ]),
    [],
  );
  for (const name of [
    '',
    '../scripts/foo',
    '/scripts/foo',
    'a//b',
    'a\\b',
    'a\0b',
    'C:/scripts/foo',
  ])
    assert.throws(() => unsupportedCandidatePaths([name]));
});

const artifact = () => ({
  id: 100,
  name: 'pages-candidate',
  expired: false,
  workflow_run: { id: 200, head_sha: mainSha },
});
const expectedArtifact = () => ({
  artifactId: '100',
  runId: '200',
  controllerSha: mainSha,
  name: 'pages-candidate',
});
test('artifact provenance uses controller SHA, not synthetic source SHA', () => {
  assert.equal(validateArtifactProvenance(artifact(), expectedArtifact()).controllerSha, mainSha);
  for (const mutate of [
    (a) => {
      a.id = 101;
    },
    (a) => {
      a.name = 'other';
    },
    (a) => {
      a.expired = true;
    },
    (a) => {
      delete a.expired;
    },
    (a) => {
      a.workflow_run.id = 201;
    },
    (a) => {
      a.workflow_run.head_sha = syntheticSha;
    },
  ]) {
    const value = artifact();
    mutate(value);
    assert.throws(() => validateArtifactProvenance(value, expectedArtifact()));
  }
  for (const value of ['01', '0', '1e2', ['100'], Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() =>
      validateArtifactProvenance(artifact(), { ...expectedArtifact(), artifactId: value }),
    );
});

test('manual main run provenance remains distinct from candidate receipts', () => {
  const expected = {
    runId: '200',
    controllerSha: mainSha,
    workflowPath: '.github/workflows/measure-pages-candidate.yml',
  };
  const run = {
    id: 200,
    head_sha: mainSha,
    head_branch: 'main',
    event: 'workflow_dispatch',
    path: expected.workflowPath,
    repository: { full_name: repository },
  };
  assert.equal(validateCandidateRun(run, expected).controllerSha, mainSha);
  for (const change of [
    { head_sha: syntheticSha },
    { event: 'pull_request' },
    { head_branch: 'feature' },
    { path: 'other.yml' },
    { id: 201 },
    { repository: { full_name: 'other/repo' } },
  ])
    assert.throws(() => validateCandidateRun({ ...run, ...change }, expected));
});

test('freshness detects main/head/base/draft/state changes and never authorizes admission', () => {
  const frozen = validateCandidateSnapshot(pr(), input());
  const assess = (current = pr(), currentMainSha = mainSha) =>
    assessCandidateFreshness(frozen, current, { expectedMainSha: mainSha, currentMainSha });
  const fresh = assess();
  assert.equal(fresh.currentQueueEligible, true);
  assert.equal(fresh.mergeAuthorized, false);
  assert.equal(fresh.qualificationPerformed, false);
  assert.equal(fresh.productionDeploymentPerformed, false);
  for (const mutate of [
    (p) => {
      p.draft = false;
    },
    (p) => {
      p.head.sha = syntheticSha;
    },
    (p) => {
      p.base.sha = syntheticSha;
    },
    (p) => {
      p.base.ref = 'parent';
    },
    (p) => {
      p.state = 'closed';
    },
    (p) => {
      p.head.repo = null;
    },
  ]) {
    const current = pr();
    mutate(current);
    const result = assess(current);
    assert.equal(result.currentQueueEligible, false);
    assert.equal(result.stale, true);
    assert.equal(result.historicalDiagnosticOnly, true);
    assert.equal(result.mergeAuthorized, false);
  }
  assert.equal(assess(pr(), syntheticSha).stale, true);
});

test('older reported base and frozen main remain independently pinned during freshness checks', () => {
  const snapshot = pr();
  snapshot.base.sha = syntheticSha;
  const frozen = validateCandidateSnapshot(snapshot, input(), {
    reportedBaseSha: syntheticSha,
    baseIsAncestorOfMain: true,
  });
  const assess = (current = snapshot, currentMainSha = mainSha) =>
    assessCandidateFreshness(frozen, current, { expectedMainSha: mainSha, currentMainSha });
  assert.equal(assess().currentQueueEligible, true);
  const movedMain = assess(snapshot, headSha);
  assert.equal(movedMain.currentQueueEligible, false);
  assert.ok(movedMain.reasons.includes('main-changed'));
  // A PR API refresh to the same main tip must not alias away its frozen old base.
  for (const baseSha of [mainSha, headSha]) {
    const changed = structuredClone(snapshot);
    changed.base.sha = baseSha;
    const result = assess(changed);
    assert.equal(result.currentQueueEligible, false);
    assert.equal(result.historicalDiagnosticOnly, true);
  }
  const reassignedMainAlias = { ...frozen, mainSha: syntheticSha };
  assert.throws(() =>
    assessCandidateFreshness(reassignedMainAlias, snapshot, {
      expectedMainSha: mainSha,
      currentMainSha: mainSha,
    }),
  );
  for (const proof of [false, undefined, 'true', 1])
    assert.throws(() =>
      assessCandidateFreshness({ ...frozen, baseAncestorOfMain: proof }, snapshot, {
        expectedMainSha: mainSha,
        currentMainSha: mainSha,
      }),
    );
  for (const change of [
    { draft: false },
    { state: 'closed' },
    { head: { ...snapshot.head, sha: mainSha } },
    { base: { ...snapshot.base, ref: 'parent' } },
    { base: { ...snapshot.base, repo: { full_name: 'other/repo' } } },
  ]) {
    const result = assess({ ...snapshot, ...change });
    assert.equal(result.currentQueueEligible, false);
    assert.equal(result.stale, true);
    assert.equal(result.mergeAuthorized, false);
    assert.equal(result.qualificationPerformed, false);
    assert.equal(result.productionDeploymentPerformed, false);
  }
});
