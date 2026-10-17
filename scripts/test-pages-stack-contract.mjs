import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseStackInput,
  freezeStackSnapshot,
  assessStackFreshness,
} from './pages-stack-contract.mjs';

const main = 'a'.repeat(40);
const heads = ['b'.repeat(40), 'c'.repeat(40), 'd'.repeat(40)];
const repository = 'mekhovov/revealline';
const input = (count = 2) =>
  parseStackInput(
    main,
    JSON.stringify(heads.slice(0, count).map((headSha, i) => ({ prNumber: i + 1, headSha }))),
  );
const proof = (ancestor, descendant) => ({ ancestor, descendant, verified: true });
function rows(count = 2) {
  return heads.slice(0, count).map((head, i) => ({
    pull: {
      number: i + 1,
      state: 'open',
      draft: true,
      mergeable: null,
      mergeable_state: 'unknown',
      head: { ref: `codex/branch-${i}`, sha: head, repo: { full_name: repository } },
      base: {
        ref: i ? `codex/branch-${i - 1}` : 'main',
        sha: i ? heads[i - 1] : main,
        repo: { full_name: repository },
      },
    },
    baseTipSha: i ? heads[i - 1] : main,
    baseProof: proof(i ? heads[i - 1] : main, i ? heads[i - 1] : main),
    parentProof: i ? proof(heads[i - 1], head) : null,
    statuses: [],
    checks: {
      total_count: 1,
      check_runs: [
        {
          id: 100 + i,
          name: 'focused',
          head_sha: head,
          status: 'completed',
          conclusion: 'success',
          app: { id: 7 },
          check_suite: { id: 8 },
          details_url: 'https://github.com/test',
          started_at: null,
          completed_at: null,
        },
      ],
    },
  }));
}
test('bounded two/three-entry input is canonical and detached', () => {
  assert.equal(input().entries.length, 2);
  assert.equal(input(3).entries.length, 3);
  assert.equal(
    parseStackInput(
      main,
      ' [ { "prNumber": 1, "headSha": "' +
        heads[0] +
        '" }, { "prNumber": 2, "headSha": "' +
        heads[1] +
        '" } ] ',
    ).entries.length,
    2,
  );
});
test('rejects duplicate JSON keys, unknown keys, duplicate identities and malformed bounds', () => {
  const valid = input().entries;
  for (const entries of [
    [],
    [valid[0]],
    [...valid, valid[0]],
    [...valid, { prNumber: 3, headSha: heads[2] }, { prNumber: 4, headSha: main }],
    [valid[0], { ...valid[1], headSha: heads[0] }],
    [valid[0], { ...valid[1], prNumber: 1 }],
    [valid[0], { ...valid[1], extra: true }],
    [valid[0], { ...valid[1], prNumber: '2' }],
    [valid[0], { ...valid[1], headSha: 'C'.repeat(40) }],
  ])
    assert.throws(() => parseStackInput(main, JSON.stringify(entries)));
  assert.throws(() =>
    parseStackInput(
      main,
      '[{"prNumber":1,"prNumber":9,"headSha":"' + heads[0] + '"},' + JSON.stringify(valid[1]) + ']',
    ),
  );
  for (const raw of [null, {}, 'x'.repeat(4097), '{', 'null'])
    assert.throws(() => parseStackInput(main, raw));
  assert.throws(() => parseStackInput(main + '\n', JSON.stringify(valid)));
});
test('freezes draft diagnostics, complete check context and detached identities', () => {
  for (const count of [2, 3]) {
    const current = rows(count);
    const frozen = freezeStackSnapshot(input(count), current);
    assert.equal(frozen.members.length, count);
    assert.equal(frozen.members[0].draft, true);
    current[0].pull.draft = false;
    assert.equal(frozen.members[0].draft, true);
    assert.equal(frozen.mergeAuthorized, false);
    assert.equal(frozen.qualificationPerformed, false);
    assert.equal(frozen.productionDeploymentPerformed, false);
  }
});
test('older reported bases require exact explicit trusted ancestry proof', () => {
  const current = rows();
  current[0].pull.base.sha = 'e'.repeat(40);
  current[0].baseProof = proof('e'.repeat(40), main);
  assert.equal(freezeStackSnapshot(input(), current).members[0].baseSha, 'e'.repeat(40));
  current[0].baseProof.verified = false;
  assert.throws(() => freezeStackSnapshot(input(), current));
});
const mutations = [
  (r) => {
    r[0].pull.state = 'closed';
  },
  (r) => {
    r[0].pull.draft = 'true';
  },
  (r) => {
    r[0].pull.head.repo.full_name = 'foreign/repo';
  },
  (r) => {
    r[1].pull.base.repo.full_name = 'foreign/repo';
  },
  (r) => {
    r[1].pull.base.ref = 'other';
  },
  (r) => {
    r[0].pull.base.ref = 'other';
  },
  (r) => {
    r[1].baseTipSha = main;
  },
  (r) => {
    r[1].parentProof = proof(heads[1], heads[0]);
  },
  (r) => {
    r[1].parentProof.verified = false;
  },
  (r) => {
    r[0].baseProof.descendant = heads[0];
  },
  (r) => {
    r[1].pull.head.ref = r[0].pull.head.ref;
  },
  (r) => {
    r[0].pull.head.ref = 'main';
  },
  (r) => {
    r[0].pull.head.sha = main;
  },
  (r) => {
    r[0].checks.total_count = 2;
  },
  (r) => {
    r[0].checks.check_runs[0].head_sha = main;
  },
  (r) => {
    r[0].checks.check_runs.push(r[0].checks.check_runs[0]);
    r[0].checks.total_count = 2;
  },
];
for (const [index, mutate] of mutations.entries())
  test(`rejects invalid chain or evidence ${index}`, () => {
    const current = rows();
    mutate(current);
    assert.throws(() => freezeStackSnapshot(input(), current));
  });
test('freshness compares full snapshots and never grants admission', () => {
  const frozen = freezeStackSnapshot(input(), rows());
  assert.equal(assessStackFreshness(frozen, rows(), main).currentQueueEligible, true);
  const changed = [
    (r) => {
      r[0].pull.draft = false;
    },
    (r) => {
      r[0].pull.mergeable = true;
      r[0].pull.mergeable_state = 'clean';
    },
    (r) => {
      r[0].checks.check_runs[0].conclusion = 'failure';
    },
    (r) => {
      r[0].checks.check_runs[0].id = 999;
    },
    (r) => {
      r[0].checks = { total_count: 0, check_runs: [] };
    },
    ...mutations,
  ];
  for (const mutate of changed) {
    const current = rows();
    mutate(current);
    const result = assessStackFreshness(frozen, current, main);
    assert.equal(result.currentQueueEligible, false);
    assert.equal(result.historicalDiagnosticOnly, true);
    assert.equal(result.mergeAuthorized, false);
    assert.equal(result.qualificationPerformed, false);
    assert.equal(result.productionDeploymentPerformed, false);
  }
  assert.equal(assessStackFreshness(frozen, rows(), heads[0]).currentQueueEligible, false);
  assert.equal(assessStackFreshness(frozen, null, main).externalInputStatus, 'unverifiable');
});
