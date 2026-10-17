import assert from 'node:assert/strict';
import test from 'node:test';
import { freezeStackSources, readStackObservations } from './pages-stack-source.mjs';
import { assessStackFreshness } from './pages-stack-contract.mjs';

const main = 'a'.repeat(40),
  heads = ['b'.repeat(40), 'c'.repeat(40)];
const input = { mainSha: main, entries: heads.map((headSha, i) => ({ prNumber: i + 1, headSha })) };
function fixture() {
  const pulls = heads.map((head, i) => ({
    number: i + 1,
    state: 'open',
    draft: true,
    mergeable: null,
    mergeable_state: 'unknown',
    head: { sha: head, ref: `codex/branch-${i}`, repo: { full_name: 'mekhovov/revealline' } },
    base: {
      sha: i ? heads[0] : main,
      ref: i ? 'codex/branch-0' : 'main',
      repo: { full_name: 'mekhovov/revealline' },
    },
  }));
  const fetched = [];
  const proofs = [];
  const diffs = [];
  const api = async (endpoint) => {
    if (endpoint === 'git/ref/heads/main') return { object: { type: 'commit', sha: main } };
    if (endpoint === 'git/ref/heads/codex%2Fbranch-0')
      return { object: { type: 'commit', sha: heads[0] } };
    const match = /^pulls\/(\d+)$/u.exec(endpoint);
    if (match) return structuredClone(pulls[Number(match[1]) - 1]);
    if (endpoint.includes('/check-runs?')) return { total_count: 0, check_runs: [] };
    if (endpoint.includes('/statuses?')) return [];
    throw new Error(`Unexpected API endpoint: ${endpoint}`);
  };
  const composition = {
    format: 'revealline-pages-stack-object-composition.v1',
    mainSha: main,
    headShas: heads,
    steps: heads.map((headSha, i) => ({
      headSha,
      commit: String(i + 1).repeat(40),
      tree: String(i + 3).repeat(40),
    })),
    commit: '2'.repeat(40),
    tree: '4'.repeat(40),
    mergeAuthorized: false,
    qualificationPerformed: false,
    productionDeploymentPerformed: false,
  };
  const options = {
    api,
    fetchObjects: async (values) => fetched.push(values),
    prove: async (a, b) => {
      proofs.push([a, b]);
      return true;
    },
    compose: async () => composition,
    changedPaths: async (a, b) => {
      diffs.push([a, b]);
      return ['game/example.mjs'];
    },
    closurePaths: ['trusted-renderer.mjs'],
  };
  return { pulls, fetched, proofs, diffs, options, composition };
}
test('reads exact PR/ref/check identities, fetches objects before ancestry, and composes frozen source', async () => {
  const f = fixture();
  const value = await freezeStackSources(input, f.options);
  assert.equal(f.fetched.length, 1);
  assert.deepEqual(f.fetched[0], [main, ...heads]);
  assert.equal(f.proofs.length, 3);
  assert.equal(value.snapshot.members.length, 2);
  assert.equal(value.composition.commit, f.composition.commit);
  assert.equal(value.mergeAuthorized, false);
  assert.deepEqual(f.diffs, [
    [main, '1'.repeat(40)],
    ['1'.repeat(40), '2'.repeat(40)],
    [main, '2'.repeat(40)],
  ]);
});
test('rejects unsupported intermediate changes even when the final diff cancels them', async () => {
  const f = fixture();
  let count = 0;
  f.options.changedPaths = async () => (++count === 1 ? ['scripts/tool.mjs'] : []);
  await assert.rejects(freezeStackSources(input, f.options), /Unsupported/u);
});
test('rejects intermediate renderer changes and invalid composition identities', async () => {
  const f = fixture();
  f.options.changedPaths = async () => ['trusted-renderer.mjs'];
  await assert.rejects(freezeStackSources(input, f.options), /renderer/u);
  const other = fixture();
  other.composition.steps[0].headSha = main;
  await assert.rejects(freezeStackSources(input, other.options));
});
test('rejects moved dependency refs, missing ancestry, foreign repositories and moved main', async () => {
  for (const mutation of [
    (f) => {
      f.pulls[1].base.ref = 'other';
    },
    (f) => {
      f.options.prove = async () => false;
    },
    (f) => {
      f.pulls[0].head.repo.full_name = 'other/repo';
    },
    (f) => {
      const original = f.options.api;
      f.options.api = async (e) =>
        e === 'git/ref/heads/main' ? { object: { type: 'commit', sha: heads[0] } } : original(e);
    },
  ]) {
    const f = fixture();
    mutation(f);
    await assert.rejects(freezeStackSources(input, f.options));
  }
});
test('complete check pagination rejects count changes and duplicate IDs', async () => {
  const f = fixture();
  const original = f.options.api;
  const check = {
    id: 7,
    name: 'focused',
    head_sha: heads[0],
    app: { id: 1 },
    check_suite: { id: 2 },
    status: 'completed',
    conclusion: 'success',
    details_url: null,
    started_at: null,
    completed_at: null,
  };
  f.options.api = async (e) =>
    e.includes('/check-runs?')
      ? { total_count: 101, check_runs: Array(100).fill(check) }
      : original(e);
  await assert.rejects(readStackObservations(input, f.options));
});
test('collects all check pages and binds each check to the actual frozen head', async () => {
  const f = fixture();
  const original = f.options.api;
  f.options.api = async (endpoint) => {
    if (!endpoint.includes('/check-runs?')) return original(endpoint);
    const head = endpoint.split('/')[1];
    const start = endpoint.endsWith('page=1') ? 0 : 100;
    return {
      total_count: 101,
      check_runs: Array.from({ length: start ? 1 : 100 }, (_, offset) => ({
        id: start + offset + 1,
        name: 'focused',
        head_sha: head,
        app: { id: 7 },
        check_suite: { id: 8 },
        status: 'completed',
        conclusion: 'success',
        details_url: null,
        started_at: null,
        completed_at: null,
      })),
    };
  };
  const value = await freezeStackSources(input, f.options);
  assert.equal(value.snapshot.members[0].checks.length, 101);
  assert.equal(value.snapshot.members[1].checks.length, 101);
});
test('rejects missing branch objects, incomplete pages and main movement after composition', async () => {
  for (const mutation of [
    (f) => {
      const original = f.options.api;
      f.options.api = async (e) =>
        e.includes('codex%2F') ? { object: { type: 'tag', sha: heads[0] } } : original(e);
    },
    (f) => {
      const original = f.options.api;
      f.options.api = async (e) =>
        e.includes('/check-runs?') ? { total_count: 1, check_runs: [] } : original(e);
    },
    (f) => {
      const original = f.options.api;
      let count = 0;
      f.options.api = async (e) =>
        e === 'git/ref/heads/main' && ++count > 2
          ? { object: { type: 'commit', sha: heads[0] } }
          : original(e);
    },
    (f) => {
      f.options.changedPaths = async () => ['../unsafe'];
    },
  ]) {
    const f = fixture();
    mutation(f);
    await assert.rejects(freezeStackSources(input, f.options));
  }
});
test('legacy external status success changing to failure invalidates freshness', async () => {
  const f = fixture();
  const original = f.options.api;
  let state = 'success';
  f.options.api = async (endpoint) =>
    endpoint.includes('/statuses?')
      ? [
          {
            id: 71,
            context: 'external-ci',
            state,
            target_url: null,
            description: null,
            created_at: null,
            updated_at: null,
          },
        ]
      : original(endpoint);
  const frozen = await freezeStackSources(input, f.options);
  state = 'failure';
  const current = await readStackObservations(input, f.options);
  assert.equal(assessStackFreshness(frozen.snapshot, current, main).currentQueueEligible, false);
  f.options.api = async (endpoint) => (endpoint.includes('/statuses?') ? [] : original(endpoint));
  assert.equal(
    assessStackFreshness(frozen.snapshot, await readStackObservations(input, f.options), main)
      .currentQueueEligible,
    false,
  );
});
test('commit status pagination rejects duplicate, missing and oversized pages', async () => {
  for (const value of [null, Array(100).fill({ id: 7 }), Array(101).fill({ id: 7 })]) {
    const f = fixture();
    const original = f.options.api;
    f.options.api = async (endpoint) =>
      endpoint.includes('/statuses?') ? value : original(endpoint);
    await assert.rejects(readStackObservations(input, f.options));
  }
});
