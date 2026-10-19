import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { POLICY_FILES, admissionBinding, validationPolicyDigest } from './admission-binding.mjs';
import test from 'node:test';
import {
  asynchronousMergeRequest,
  asynchronousMergeResult,
  decideMergeAction,
  dependencyNumbers,
  exactHeadCheckBlocker,
  isStackOnlyMergeError,
  mainPagesDispatchRequest,
  reviewedPolicyChangeMatches,
  trustedMainMatches,
  REVIEWED_POLICY_CHANGES,
  checkedAdmission,
  freshAdmissionMatches,
  mutationSnapshotMatches,
  collectExactHeadCheckInventory,
  REVIEWED_PR_INAPPLICABLE_WORKFLOWS,
  inventoryCheckBlocker,
  inventoryReleaseReady,
  executeVerifiedMergeAction,
  collectControllerSnapshot,
  github,
} from './fastline-merge-controller.mjs';

const SHA = '1'.repeat(40);

const fixtureActionJob = (row) => ({
  id: 1000 + row.id,
  run_id: row.id === 5 ? 50 : 60,
  run_attempt: 1,
  head_sha: SHA,
  name: row.name,
  status: row.status,
  conclusion: row.conclusion,
  started_at: row.started_at,
  completed_at: row.completed_at,
  check_run_url: `https://api.github.com/repos/mekhovov/revealline/check-runs/${row.id}`,
});

function actionSnapshot(action = 'merge') {
  const policy = policyFixture();
  const pull = {
    ...policy.pullRequest,
    node_id: 'PR_fixture',
    body: '',
    state: 'open',
    draft: false,
    merged: false,
    labels: [],
    auto_merge: null,
    mergeable: true,
    mergeable_state: action === 'update' ? 'behind' : action === 'arm' ? 'has_hooks' : 'clean',
  };
  if (action === 'stack') {
    pull.labels = ['fastline-stack-merge'];
    pull.stack = { number: 1 };
  }
  const provenance = {
    checkId: 1,
    role: 'release-ready',
    jobId: 10,
    runId: 20,
    runAttempt: 1,
    workflowId: 30,
    workflowPath: '.github/workflows/deploy-pages.yml',
    suiteId: 40,
  };
  const check = {
    id: 1,
    name: 'release-ready',
    head_sha: pull.head.sha,
    status: 'completed',
    conclusion: 'success',
    actionsProvenance: provenance,
    admissionMatches: true,
    policyDigest: policy.trustedPolicyDigest,
    admissionReceipt: admissionBinding(pull, {
      workflowRevision: SHA,
      policyDigest: policy.trustedPolicyDigest,
      paths: policy.changedPaths,
    }),
  };
  const inventory = {
    headSha: pull.head.sha,
    complete: true,
    provenance: [provenance],
    effectiveStatuses: [],
    checkRuns: [
      check,
      ...Array.from({ length: 143 }, (_, i) => ({
        id: i + 2,
        name: `ordinary-${i}`,
        head_sha: pull.head.sha,
        status: 'completed',
        conclusion: 'success',
      })),
    ],
  };
  const snapshot = {
    controllerMainSha: SHA,
    liveMainSha: SHA,
    pullRequest: pull,
    requiredCheck: check,
    checkInventory: inventory,
    observedHeadSha: pull.head.sha,
    dependencies: [],
  };
  snapshot.decision = { action };
  return snapshot;
}

test('every merge-capable action requires a fresh complete admitted snapshot', async () => {
  for (const action of ['update', 'stack', 'merge', 'arm']) {
    const initial = actionSnapshot(action);
    let refreshed = 0;
    const writes = [];
    const actions = Object.fromEntries(
      ['update', 'stack', 'merge', 'arm', 'disarm'].map((name) => [
        name,
        async (pull, head) => {
          assert.equal(pull.head.sha, initial.observedHeadSha);
          assert.equal(head, initial.observedHeadSha);
          writes.push(name);
          return true;
        },
      ]),
    );
    assert.equal(
      await executeVerifiedMergeAction({
        snapshot: initial,
        refresh: async () => {
          refreshed++;
          return structuredClone(initial);
        },
        actions,
      }),
      ['merge', 'stack'].includes(action),
    );
    assert.equal(refreshed, 1);
    assert.deepEqual(writes, [action]);
    for (const mutate of [
      (s) => (s.liveMainSha = 'f'.repeat(40)),
      (s) => (s.pullRequest.head.sha = 'f'.repeat(40)),
      (s) => (s.pullRequest.base.sha = 'f'.repeat(40)),
      (s) => (s.pullRequest.base.ref = 'retarget-at-same-sha'),
      (s) => (s.pullRequest.draft = true),
      (s) => (s.pullRequest.state = 'closed'),
      (s) => (s.pullRequest.node_id = 'different-PR'),
      (s) => (s.checkInventory.complete = false),
      (s) => (s.checkInventory.checkRuns[140].conclusion = 'failure'),
      (s) => {
        s.checkInventory.checkRuns[140].status = 'in_progress';
        s.checkInventory.checkRuns[140].conclusion = null;
      },
      (s) => s.checkInventory.provenance[0].runAttempt++,
      (s) =>
        s.checkInventory.effectiveStatuses.push({
          context: 'CI',
          state: 'pending',
        }),
      (s) => s.dependencies.push({ number: 99, merged_at: null }),
      (s) => (s.pullRequest.body = 'Depends on #99'),
    ]) {
      writes.length = 0;
      await assert.rejects(
        executeVerifiedMergeAction({
          snapshot: initial,
          refresh: async () => {
            const fresh = structuredClone(initial);
            mutate(fresh);
            return fresh;
          },
          actions,
        }),
        /changed|incomplete/u,
      );
      assert.deepEqual(writes, [], `${action} ${String(mutate)}`);
    }
  }
});

test('a stack-only rejection requires another full snapshot before fallback', async () => {
  const initial = actionSnapshot();
  for (const variant of ['stable', 'failed-later-page', 'already-merged', 'API-error']) {
    let reads = 0;
    const writes = [];
    const result = executeVerifiedMergeAction({
      snapshot: initial,
      refresh: async () => {
        reads++;
        if (reads === 2 && variant === 'API-error') throw new Error('snapshot read failed');
        const fresh = structuredClone(initial);
        if (reads === 2 && variant === 'failed-later-page')
          fresh.checkInventory.checkRuns[140].conclusion = 'failure';
        if (reads === 2 && variant === 'already-merged') {
          fresh.pullRequest.state = 'closed';
          fresh.pullRequest.merged = true;
        }
        return fresh;
      },
      actions: {
        merge: async () => {
          writes.push('merge');
          throw {
            status: 403,
            data: {
              message:
                'Merging stacked PRs via this endpoint is not supported. Use the asynchronous merge endpoint instead.',
            },
          };
        },
        stack: async () => {
          writes.push('stack');
          return true;
        },
      },
    });
    if (['failed-later-page', 'API-error'].includes(variant)) await assert.rejects(result);
    else assert.equal(await result, variant === 'stable');
    assert.equal(reads, 2);
    assert.deepEqual(writes, variant === 'stable' ? ['merge', 'stack'] : ['merge']);
  }
});

test('ordinary merge rejection never retries or switches merge methods', async () => {
  for (const error of [
    { status: 403, data: { message: 'different rejection' } },
    { status: 409 },
    { status: 500 },
    new Error('network observation lost'),
  ]) {
    let reads = 0;
    const writes = [];
    await assert.rejects(
      executeVerifiedMergeAction({
        snapshot: actionSnapshot(),
        refresh: async () => {
          reads++;
          return actionSnapshot();
        },
        actions: {
          merge: async () => {
            writes.push('merge');
            throw error;
          },
          stack: async () => {
            writes.push('stack');
            return true;
          },
        },
      }),
    );
    assert.equal(reads, 1);
    assert.deepEqual(writes, ['merge']);
  }
});

test('snapshot reader verifies PR and main bookends and reuses only same-source admission', async () => {
  const input = provenanceFixture();
  const expected = actionSnapshot();
  expected.pullRequest.head.sha = SHA;
  expected.pullRequest.base.sha = '2'.repeat(40);
  const pull = expected.pullRequest;
  let admissions = 0,
    prReads = 0;
  const routes = [];
  const api = async (route, options) => {
    routes.push(route);
    if (route.endsWith('/git/ref/heads/main')) return { object: { sha: SHA } };
    if (route.endsWith(`/pulls/${pull.number}`)) {
      prReads++;
      return structuredClone(pull);
    }
    return input.api(route, options);
  };
  const options = {
    repository: input.repository,
    number: pull.number,
    observedHeadSha: SHA,
    controllerMainSha: SHA,
    invocation: input.invocation,
    api,
    admit: async (check, pr) => {
      admissions++;
      check.policyDigest = 'a'.repeat(64);
      check.admissionReceipt = admissionBinding(pr, {
        workflowRevision: SHA,
        policyDigest: check.policyDigest,
        paths: ['docs/fixture.md'],
      });
      return true;
    },
  };
  const first = await collectControllerSnapshot(options);
  assert.equal(first.decision.action, 'merge');
  assert.equal(prReads, 2);
  assert.equal(routes.filter((r) => r.includes('/check-runs?')).length, 2);
  const second = await collectControllerSnapshot({
    ...options,
    admittedCheck: first.requiredCheck,
  });
  assert.equal(admissions, 1);
  assert.equal(second.decision.action, 'merge');
  let reads = 0;
  await assert.rejects(
    collectControllerSnapshot({
      ...options,
      api: async (route, o) => {
        const value = await api(route, o);
        if (route.endsWith(`/pulls/${pull.number}`) && ++reads === 2) value.base.ref = 'retarget';
        return value;
      },
    }),
    /changed/u,
  );
});

// Job IDs deliberately differ from check IDs. Only GitHub's check_run_url join
// is authoritative; a caller-controlled details_url is not an identity proof.
function provenanceFixture(mutate, count = 5) {
  const input = inventoryFixture(count);
  const invocation = { runId: 50, runAttempt: 1, jobName: 'reconcile' };
  const workflows = {
    'deploy-pages.yml': {
      id: 300,
      path: '.github/workflows/deploy-pages.yml',
      state: 'active',
    },
    'fastline-auto-merge.yml': {
      id: 400,
      path: '.github/workflows/fastline-auto-merge.yml',
      state: 'active',
    },
  };
  const run = (controller = false) => ({
    id: controller ? 50 : 60,
    run_attempt: 1,
    workflow_id: controller ? 400 : 300,
    path: workflows[controller ? 'fastline-auto-merge.yml' : 'deploy-pages.yml'].path,
    head_sha: SHA,
    check_suite_id: controller ? 8 : 7,
    repository: { id: 12, full_name: input.repository },
    head_repository: { id: 12, full_name: input.repository },
    event: 'pull_request',
    status: 'in_progress',
    conclusion: null,
  });
  const names = ['release-ready', 'focused', 'test', 'build', 'reconcile'];
  for (const [i, row] of input.rows.entries()) {
    row.app.slug = 'github-actions';
    if (i >= 5) continue;
    row.name = names[i];
    row.check_suite.id = i === 4 ? 8 : 7;
    row.details_url = 'https://attacker.invalid/not-an-actions-run';
    if (i > 0 && i < 4) row.conclusion = 'skipped';
    if (i === 4) {
      row.status = 'in_progress';
      row.conclusion = null;
      row.completed_at = null;
    }
  }
  const calls = [];
  let sweep = 0;
  const baseApi = input.api;
  input.api = async (route) => {
    calls.push(route);
    const url = new URL(route, 'https://api.github.com');
    let result;
    if (url.pathname.endsWith('/check-suites')) {
      sweep++;
      result = await baseApi(route);
      result.check_suites[0].app.slug = 'github-actions';
      result.check_suites.push({
        ...structuredClone(result.check_suites[0]),
        id: 8,
      });
      result.total_count++;
    } else if (url.pathname.includes('/actions/workflows/')) {
      result = structuredClone(workflows[url.pathname.split('/').at(-1)]);
    } else if (url.pathname.endsWith('/actions/runs')) {
      result = {
        total_count: 1,
        workflow_runs: [run(url.searchParams.get('check_suite_id') === '8')],
      };
    } else if (/\/attempts\/1\/jobs$/u.test(url.pathname)) {
      const controller = url.pathname.includes('/runs/50/');
      const matchingJobs = input.rows.filter((r) => (r.id === 5) === controller);
      const page = Number(url.searchParams.get('page'));
      result = {
        total_count: matchingJobs.length,
        jobs: matchingJobs.slice((page - 1) * 100, page * 100).map((row) => ({
          id: 1000 + row.id,
          run_id: controller ? 50 : 60,
          run_attempt: 1,
          head_sha: SHA,
          name: row.name,
          status: row.status,
          conclusion: row.conclusion,
          started_at: row.started_at,
          completed_at: row.completed_at,
          check_run_url: `https://api.github.com/repos/${input.repository}/check-runs/${row.id}`,
        })),
      };
    } else result = await baseApi(route);
    mutate?.({ route, url, result, sweep });
    return result;
  };
  return { ...input, invocation, calls };
}

test('trusted job provenance binds policy skips, admission and only this controller invocation', async () => {
  const result = await collectExactHeadCheckInventory(provenanceFixture());
  assert.equal(inventoryCheckBlocker(result, SHA), null);
  assert.equal(inventoryReleaseReady(result, SHA)?.id, 1);
  assert.deepEqual(
    result.provenance.map((p) => [p.checkId, p.role]),
    [
      [1, 'release-ready'],
      [2, 'policy-skip'],
      [3, 'policy-skip'],
      [4, 'policy-skip'],
      [5, 'self-reconcile'],
    ],
  );
  assert.equal(result.provenance[0].jobId, 1001);
  assert(result.requestCounts.every((n) => n <= 64));
});

test('spoofed workflow, app, job and invocation identities never grant exceptions', async () => {
  for (const mutate of [
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs[0].path = '.github/workflows/spoof.yml';
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs[0].workflow_id = 999;
    },
    ({ result }) => {
      if (result.jobs) result.jobs[0].check_run_url += '?spoof';
    },
    ({ result }) => {
      if (result.jobs) result.jobs[0].name = 'different-job';
    },
  ]) {
    const result = await collectExactHeadCheckInventory(provenanceFixture(mutate));
    assert(inventoryCheckBlocker(result, SHA) || !inventoryReleaseReady(result, SHA));
  }
  await assert.rejects(
    collectExactHeadCheckInventory(
      provenanceFixture(({ result }) => {
        if (result.check_runs) result.check_runs[0].app.slug = 'spoof';
      }),
    ),
    /suite/u,
  );
  const input = provenanceFixture();
  input.invocation.runAttempt = 2;
  const result = await collectExactHeadCheckInventory(input);
  assert.match(inventoryCheckBlocker(result, SHA), /reconcile.*in_progress/u);
});

test('metadata identities and states are re-read in both budgeted sweeps', async () => {
  for (const mutate of [
    ({ result, sweep }) => {
      if (sweep === 2 && result.jobs) result.jobs[0].id++;
    },
    ({ result, sweep }) => {
      if (sweep === 2 && result.workflow_runs) result.workflow_runs[0].run_attempt++;
    },
    ({ result, sweep }) => {
      if (sweep === 2 && result.id === 300) result.id++;
    },
    ({ result, sweep }) => {
      if (sweep === 2 && result.jobs) result.jobs[0].conclusion = 'failure';
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(provenanceFixture(mutate)));
  await assert.rejects(
    collectExactHeadCheckInventory({ ...provenanceFixture(), maxRequests: 4 }),
    /budget/u,
  );
});

test('conflicting app slugs cannot form a trusted suite/run identity', async () => {
  await assert.rejects(
    collectExactHeadCheckInventory(
      provenanceFixture(({ result }) => {
        if (result.check_suites) result.check_suites[0].app.slug = 'different-app';
      }),
    ),
    /suite/u,
  );
});

test('distinct failed IDs, legacy gates and ambiguous admission stay blocked', async () => {
  const input = provenanceFixture();
  input.rows[1].conclusion = 'failure';
  input.rows[2].name = 'focused';
  input.rows[2].conclusion = 'success';
  const result = await collectExactHeadCheckInventory(input);
  assert.match(inventoryCheckBlocker(result, SHA), /focused.*failure/u);
  const legacy = structuredClone(result);
  legacy.checkRuns[1].conclusion = 'success';
  legacy.effectiveStatuses = [{ id: 99, context: 'CI', state: 'pending' }];
  assert.match(inventoryCheckBlocker(legacy, SHA), /CI.*pending/u);
  const ambiguous = structuredClone(result);
  ambiguous.provenance.push({ ...ambiguous.provenance[0], checkId: 100 });
  ambiguous.checkRuns.push({ ...ambiguous.checkRuns[0], id: 100 });
  assert.equal(inventoryReleaseReady(ambiguous, SHA), null);
});

test('job pagination is complete and duplicate current controller names are not exempt', async () => {
  const input = provenanceFixture(({ result, url }) => {
    if (url.pathname.includes('/runs/60/') && result.jobs) {
      const originals = input.rows.filter((row) => row.id !== 5).map(fixtureActionJob);
      const expected = Array.from({ length: 101 }, (_, i) => ({
        ...originals[0],
        id: 5000 + i,
        name: `unrelated-${i}`,
        check_run_url: `https://api.github.com/repos/mekhovov/revealline/check-runs/${5000 + i}`,
      }));
      // The actual release-ready/policy jobs are beyond page one.
      expected.splice(97, 4, ...originals);
      result.total_count = 101;
      const page = Number(url.searchParams.get('page'));
      result.jobs = expected.slice((page - 1) * 100, page * 100);
    }
  });
  const inventory = await collectExactHeadCheckInventory(input);
  assert.equal(inventoryReleaseReady(inventory, SHA)?.actionsProvenance.runId, 60);
  assert.equal(inventoryCheckBlocker(inventory, SHA), null);
  assert.equal(
    input.calls.filter((route) => route.includes('/runs/60/attempts/1/jobs?')).length,
    4,
  );
  const ambiguous = provenanceFixture(({ result, url }) => {
    if (url.pathname.includes('/runs/50/') && result.jobs) {
      result.jobs.push({
        ...result.jobs[0],
        id: 5555,
        check_run_url: 'https://api.github.com/repos/mekhovov/revealline/check-runs/5555',
      });
      result.total_count++;
    }
  });
  assert.match(
    inventoryCheckBlocker(await collectExactHeadCheckInventory(ambiguous), SHA),
    /reconcile.*in_progress/u,
  );
});

test('job metadata honors its own 1000-row bound and unsupported context folding fails closed', async () => {
  for (const count of [1000, 1001]) {
    const input = provenanceFixture(({ result, url }) => {
      if (!result.jobs || !url.pathname.includes('/runs/60/')) return;
      const originals = input.rows.filter((row) => row.id !== 5).map(fixtureActionJob);
      const jobs = Array.from({ length: count }, (_, i) => ({
        ...originals[0],
        id: 5000 + i,
        name: `ordinary-${i}`,
        check_run_url: `https://api.github.com/repos/mekhovov/revealline/check-runs/${5000 + i}`,
      }));
      jobs.splice(count - 4, 4, ...originals);
      result.total_count = count;
      const page = Number(url.searchParams.get('page'));
      result.jobs = jobs.slice((page - 1) * 100, page * 100);
    });
    if (count > 1000) await assert.rejects(collectExactHeadCheckInventory(input), /bound/u);
    else
      assert.equal(inventoryCheckBlocker(await collectExactHeadCheckInventory(input), SHA), null);
  }
  await assert.rejects(
    collectExactHeadCheckInventory(
      inventoryFixture(1, ({ result, url }) => {
        if (url.pathname.endsWith('/statuses'))
          result.push({
            id: 1,
            context: '\u212ACI',
            state: 'success',
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          });
      }),
    ),
    /normalization/u,
  );
});

test('ambiguous runs, overlapping jobs, foreign metadata and API failures reject inventory', async () => {
  for (const mutation of [
    ({ result }) => {
      if (result.workflow_runs) {
        result.workflow_runs.push({ ...result.workflow_runs[0], id: 777 });
        result.total_count++;
      }
    },
    ({ result }) => {
      if (result.jobs) {
        result.jobs.push(structuredClone(result.jobs[0]));
        result.total_count++;
      }
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs[0].head_sha = '2'.repeat(40);
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs[0].repository.full_name = 'foreign/repo';
    },
    ({ result }) => {
      if (result.jobs) result.jobs[0].run_attempt++;
    },
    ({ result }) => {
      if (result.jobs) result.jobs.pop();
    },
    ({ url }) => {
      if (url.pathname.endsWith('/actions/runs')) throw new Error('Actions read denied');
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(provenanceFixture(mutation)));
});

test('actual initial and final collectors each sweep all 144 records before an action', async () => {
  for (const variant of ['stable', 'consistent-new-failure', 'changed-final-sweep']) {
    const input = provenanceFixture(({ result, url, sweep }) => {
      if (
        result.check_runs &&
        Number(url.searchParams.get('page')) === 2 &&
        ((variant === 'consistent-new-failure' && sweep >= 3) ||
          (variant === 'changed-final-sweep' && sweep === 4))
      )
        result.check_runs[0].conclusion = 'failure';
    }, 144);
    const pull = actionSnapshot().pullRequest;
    pull.head.sha = SHA;
    let admitted = 0;
    const writes = [];
    const api = async (route, options) => {
      assert(!options?.method, 'snapshot reads must not mutate');
      if (route.endsWith('/git/ref/heads/main')) return { object: { sha: SHA } };
      if (route.endsWith(`/pulls/${pull.number}`)) return structuredClone(pull);
      return input.api(route, options);
    };
    const options = {
      repository: input.repository,
      number: pull.number,
      observedHeadSha: SHA,
      controllerMainSha: SHA,
      invocation: input.invocation,
      api,
      admit: async (check, pr) => {
        admitted++;
        check.policyDigest = 'a'.repeat(64);
        check.admissionReceipt = admissionBinding(pr, {
          workflowRevision: SHA,
          policyDigest: check.policyDigest,
          paths: ['docs/fixture.md'],
        });
        return true;
      },
    };
    const snapshot = await collectControllerSnapshot(options);
    assert.equal(snapshot.decision.action, 'merge');
    const executed = executeVerifiedMergeAction({
      snapshot,
      refresh: () =>
        collectControllerSnapshot({
          ...options,
          admittedCheck: snapshot.requiredCheck,
        }),
      actions: {
        merge: async () => {
          writes.push('merge');
          return true;
        },
      },
    });
    if (variant === 'stable') assert.equal(await executed, true);
    else await assert.rejects(executed);
    assert.deepEqual(writes, variant === 'stable' ? ['merge'] : []);
    assert.equal(admitted, 1, 'same immutable head/main receipt is not redundantly downloaded');
    assert.equal(input.calls.filter((r) => r.includes('/check-runs?')).length, 8);
  }
});

test('HTTP adapter preserves pagination headers, propagates abort and never hides API failure', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    github('/repos/owner/repo/commits/fixture/check-runs', {
      signal: controller.signal,
      transport: async (url, options) => {
        assert.equal(options.signal.aborted, true);
        throw new Error('request aborted');
      },
    }),
    /aborted/u,
  );
  const payload = { ok: true };
  assert.deepEqual(
    await github('/fixture', {
      includePagination: true,
      transport: async () => ({
        ok: true,
        headers: new Headers({
          link: '<https://api.github.com/fixture?page=2>; rel="next"',
        }),
        text: async () => JSON.stringify(payload),
      }),
    }),
    {
      body: payload,
      link: '<https://api.github.com/fixture?page=2>; rel="next"',
    },
  );
  await assert.rejects(
    github('/fixture', {
      transport: async () => ({
        ok: false,
        status: 403,
        text: async () => '{"message":"read denied"}',
      }),
    }),
    (error) => error.status === 403 && error.data.message === 'read denied',
  );
});
function inventoryFixture(count = 144, mutate) {
  const calls = [];
  const rows = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `job-${i}`,
    head_sha: SHA,
    status: 'completed',
    conclusion: 'success',
    started_at: '2026-10-18T00:00:00Z',
    completed_at: '2026-10-18T00:01:00Z',
    check_suite: { id: 7 },
    app: { id: 15368 },
  }));
  let sweep = 0;
  const api = async (route) => {
    calls.push(route);
    const url = new URL(route, 'https://api.github.com');
    const page = Number(url.searchParams.get('page'));
    let result;
    if (url.pathname.endsWith('/check-suites')) {
      sweep++;
      result = {
        total_count: 1,
        check_suites: [
          {
            id: 7,
            head_sha: SHA,
            repository: { id: 12, full_name: 'mekhovov/revealline' },
            app: { id: 15368 },
            status: 'completed',
            conclusion: 'success',
          },
        ],
      };
    } else if (url.pathname.endsWith('/check-runs')) {
      assert.equal(url.searchParams.get('filter'), 'all');
      result = {
        total_count: count,
        check_runs: rows.slice((page - 1) * 100, page * 100),
      };
    } else if (url.pathname.endsWith('/statuses')) result = [];
    else throw new Error(`Unexpected read ${route}`);
    result = structuredClone(result);
    mutate?.({ result, url, page, sweep });
    return result;
  };
  return { api, calls, rows, repository: 'mekhovov/revealline', headSha: SHA };
}

test('complete inventory rereads every page at bounded boundary counts', async () => {
  for (const count of [0, 1, 99, 100, 101, 144, 1000]) {
    const input = inventoryFixture(count);
    const result = await collectExactHeadCheckInventory(input);
    assert.equal(result.complete, true);
    assert.equal(result.checkRuns.length, count);
    assert.equal(result.atomicSnapshot, false);
    assert.equal(result.mergeAuthority, false);
    assert.equal(
      input.calls.filter((p) => p.includes('/check-runs?')).length,
      Math.max(1, Math.ceil(count / 100)) * 2,
    );
  }
});

test('inventory rejects oversized, duplicate, incomplete, foreign and malformed rows', async () => {
  await assert.rejects(collectExactHeadCheckInventory(inventoryFixture(1001)), /bound/u);
  for (const mutation of [
    ({ result }) => {
      if (result.check_runs?.length) result.check_runs[0].head_sha = '2'.repeat(40);
    },
    ({ result }) => {
      if (result.check_runs?.length) result.check_runs[0].check_suite.id = 99;
    },
    ({ result }) => {
      if (result.check_runs?.length) result.check_runs[0].app.id = 99;
    },
    ({ result }) => {
      if (result.check_runs?.length) result.check_runs[0].status = 'bogus';
    },
    ({ result }) => {
      if (result.check_runs?.length) result.check_runs[0].conclusion = null;
    },
    ({ result }) => {
      if (result.check_runs?.length) result.check_runs.pop();
    },
    ({ result, page }) => {
      if (result.check_runs?.length && page === 2) result.check_runs[0].id = 1;
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(inventoryFixture(144, mutation)));
});

test('later-page state or identities cannot change between full sweeps', async () => {
  for (const mutation of [
    ({ result, page, sweep }) => {
      if (result.check_runs && page === 2 && sweep === 2)
        result.check_runs[0].conclusion = 'failure';
    },
    ({ result, page, sweep }) => {
      if (result.check_runs && page === 2 && sweep === 2) result.check_runs[0].id = 9999;
    },
    ({ result, sweep }) => {
      if (result.check_runs && sweep === 2) result.total_count++;
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(inventoryFixture(144, mutation)));
});

test('same-name jobs stay distinct and zero-run suites do not become gates', async () => {
  const input = inventoryFixture(2, ({ result }) => {
    if (result.check_suites)
      (result.check_suites.push({
        id: 8,
        head_sha: SHA,
        repository: { id: 12, full_name: 'mekhovov/revealline' },
        app: { id: 42 },
        status: 'queued',
        conclusion: null,
      }),
        result.total_count++);
    if (result.check_runs)
      result.check_runs.forEach((row) => {
        row.name = 'correctness';
      });
  });
  input.rows[1].conclusion = 'failure';
  const result = await collectExactHeadCheckInventory(input);
  assert.equal(result.checkRuns.length, 2);
  assert.equal(result.checkRuns[1].conclusion, 'failure');
  assert.equal(result.suites.length, 2);
});

test('legacy contexts use newest-first order, not greatest ID or case', async () => {
  const input = inventoryFixture(1, ({ result, url }) => {
    if (url.pathname.endsWith('/statuses'))
      result.push(
        {
          id: 1,
          context: 'CI',
          state: 'pending',
          created_at: '2026-10-18T02:00:00Z',
          updated_at: '2026-10-18T02:00:00Z',
        },
        {
          id: 500,
          context: 'ci',
          state: 'success',
          created_at: '2026-10-18T01:00:00Z',
          updated_at: '2026-10-18T01:00:00Z',
        },
      );
  });
  const result = await collectExactHeadCheckInventory(input);
  assert.equal(result.statuses.length, 2);
  assert.deepEqual(
    result.effectiveStatuses.map((s) => [s.context, s.state, s.id]),
    [['CI', 'pending', 1]],
  );
});

test('suite and legacy bounds include complete terminal pages', async () => {
  for (const count of [100, 101, 1000, 1001]) {
    const suiteInput = inventoryFixture(1, ({ result, page }) => {
      if (!result.check_suites) return;
      result.total_count = count;
      result.check_suites = Array.from(
        { length: Math.min(100, count - (page - 1) * 100) },
        (_, i) => ({
          id: (page - 1) * 100 + i + 1,
          head_sha: SHA,
          repository: { id: 12, full_name: 'mekhovov/revealline' },
          app: { id: 15368 },
          status: 'completed',
          conclusion: 'success',
        }),
      );
    });
    if (count > 1000) await assert.rejects(collectExactHeadCheckInventory(suiteInput), /bound/u);
    else assert.equal((await collectExactHeadCheckInventory(suiteInput)).suites.length, count);
    const legacyInput = inventoryFixture(1, ({ result, url, page }) => {
      if (!url.pathname.endsWith('/statuses')) return;
      result.push(
        ...Array.from({ length: Math.min(100, Math.max(0, count - (page - 1) * 100)) }, (_, i) => ({
          id: (page - 1) * 100 + i + 1,
          context: `ci-${(page - 1) * 100 + i}`,
          state: 'success',
          created_at: '2026-10-18T00:00:00Z',
        })),
      );
    });
    if (count > 1000) await assert.rejects(collectExactHeadCheckInventory(legacyInput), /bound/u);
    else {
      assert.equal((await collectExactHeadCheckInventory(legacyInput)).statuses.length, count);
      assert.equal(
        legacyInput.calls.filter((p) => p.includes('/statuses?')).length,
        (Math.floor(count / 100) + 1) * 2,
      );
    }
  }
});

test('legacy mutations and foreign or premature pagination links fail closed', async () => {
  for (const mutation of [
    ({ result, url, sweep }) => {
      if (url.pathname.endsWith('/statuses') && sweep === 2)
        result.push({
          id: 3,
          context: 'CI',
          state: 'failure',
          created_at: '2026-10-18T00:00:00Z',
        });
    },
    ({ result, url }) => {
      if (url.pathname.endsWith('/statuses'))
        result.push(
          {
            id: 3,
            context: 'CI',
            state: 'success',
            created_at: '2026-10-18T00:00:00Z',
          },
          {
            id: 3,
            context: 'other',
            state: 'success',
            created_at: '2026-10-18T00:00:00Z',
          },
        );
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(inventoryFixture(1, mutation)));
  for (const link of [
    '<https://foreign.example/repos/mekhovov/revealline/commits/' +
      SHA +
      '/check-suites?per_page=100&page=2>; rel="next"',
    '<https://api.github.com/repos/mekhovov/revealline/commits/' +
      SHA +
      '/check-suites?per_page=100&page=2>; rel="next"',
  ]) {
    const input = inventoryFixture(1);
    const read = input.api;
    input.api = async (route) => ({ body: await read(route), link });
    await assert.rejects(collectExactHeadCheckInventory(input), /pagination/u);
  }
});

test('full legacy terminal pages with prev/first headers still require the empty probe', async () => {
  for (const count of [100, 200, 1000]) {
    const input = inventoryFixture(1),
      raw = input.api;
    input.api = async (route, options) => {
      const body = await raw(route, options);
      const url = new URL(route, 'https://api.github.com');
      if (!url.pathname.endsWith('/statuses')) return body;
      const page = Number(url.searchParams.get('page'));
      const rows = Array.from(
        { length: Math.min(100, Math.max(0, count - (page - 1) * 100)) },
        (_, i) => ({
          id: (page - 1) * 100 + i + 1,
          context: `ci-${(page - 1) * 100 + i}`,
          state: 'success',
          created_at: '2026-10-18T00:00:00Z',
        }),
      );
      const target = (n) => {
        const link = new URL(url);
        link.searchParams.set('page', String(n));
        return String(link);
      };
      const link =
        page < count / 100
          ? `<${target(page + 1)}>; rel="next", <${target(count / 100)}>; rel="last"`
          : `${page > 1 ? `<${target(page - 1)}>; rel="prev", ` : ''}<${target(1)}>; rel="first"`;
      return { body: rows, link };
    };
    const result = await collectExactHeadCheckInventory(input);
    assert.equal(result.complete, true);
    assert.equal(result.statuses.length, count);
    const expectedPages = Array.from({ length: count / 100 + 1 }, (_, i) => i + 1);
    assert.deepEqual(
      input.calls
        .filter((route) => route.includes('/statuses?'))
        .map((route) => Number(new URL(route, 'https://api.github.com').searchParams.get('page'))),
      [...expectedPages, ...expectedPages],
    );
  }
});

test('suite repositories are required, trusted and included in repeated identity', async () => {
  for (const mutate of [
    (suite) => {
      delete suite.repository;
    },
    (suite) => {
      suite.repository.id = 0;
    },
    (suite) => {
      suite.repository.id = 99;
    },
    (suite) => {
      suite.repository.full_name = 'foreign/repo';
    },
  ]) {
    const input = inventoryFixture(1, ({ result }) => {
      if (result.check_suites) mutate(result.check_suites[0]);
    });
    input.repositoryId = 12;
    await assert.rejects(collectExactHeadCheckInventory(input), /repository/u);
  }
  const changed = inventoryFixture(1, ({ result, sweep }) => {
    if (result.check_suites && sweep === 2) result.check_suites[0].repository.id = 99;
  });
  await assert.rejects(collectExactHeadCheckInventory(changed), /changed|repository/u);
  const inconsistent = inventoryFixture(1, ({ result }) => {
    if (!result.check_suites) return;
    result.check_suites.push({
      ...structuredClone(result.check_suites[0]),
      id: 8,
      repository: { id: 99, full_name: 'mekhovov/revealline' },
    });
    result.total_count++;
  });
  await assert.rejects(collectExactHeadCheckInventory(inconsistent), /repository/u);
});

test('legacy short-page next links and counted premature ends remain invalid', async () => {
  for (const kind of ['short', 'empty', 'foreign', 'counted']) {
    const input = inventoryFixture(144),
      raw = input.api;
    input.api = async (route, options) => {
      const body = await raw(route, options),
        url = new URL(route, 'https://api.github.com');
      const statuses = url.pathname.endsWith('/statuses');
      if (
        kind === 'counted' &&
        url.pathname.endsWith('/check-runs') &&
        url.searchParams.get('page') === '1'
      )
        return { body, link: `<${url}>; rel="first"` };
      if (!statuses || kind === 'counted') return body;
      url.searchParams.set('page', '2');
      if (kind === 'foreign') url.hostname = 'foreign.example';
      return {
        body:
          kind === 'short'
            ? [
                {
                  id: 1,
                  context: 'ci',
                  state: 'success',
                  created_at: '2026-10-18T00:00:00Z',
                },
              ]
            : [],
        link: `<${url}>; rel="next"`,
      };
    };
    await assert.rejects(collectExactHeadCheckInventory(input), /pagination/u);
  }
});

test('a timed-out read is aborted and cannot return partial success', async () => {
  let aborted = false;
  await assert.rejects(
    collectExactHeadCheckInventory({
      ...inventoryFixture(1),
      requestTimeoutMs: 2,
      api: async (_, { signal }) =>
        new Promise(() => {
          signal.addEventListener('abort', () => {
            aborted = true;
          });
        }),
    }),
    /timeout/u,
  );
  assert.equal(aborted, true);
});

test('GitHub numeric repository pagination is accepted only for the proven same repository', async () => {
  const fixtureWithHeaders = (repositoryId) => {
    const input = inventoryFixture(144);
    const raw = input.api;
    return {
      ...input,
      repositoryId,
      api: async (route, options) => {
        const body = await raw(route, options),
          url = new URL(route, 'https://api.github.com');
        if (body.check_suites) body.check_suites[0].repository.id = repositoryId ?? 1367404328;
        if (!url.pathname.endsWith('/check-runs')) return body;
        const page = Number(url.searchParams.get('page'));
        const next = `https://api.github.com/repositories/1367404328/commits/${SHA}/check-runs?filter=all&per_page=100&page=2`;
        const first = `https://api.github.com/repositories/1367404328/commits/${SHA}/check-runs?filter=all&per_page=100&page=1`;
        return {
          body,
          link:
            page === 1
              ? `<${next}>; rel="next", <${next}>; rel="last"`
              : `<${first}>; rel="prev", <${first}>; rel="first"`,
        };
      },
    };
  };
  const accepted = await collectExactHeadCheckInventory(fixtureWithHeaders(1367404328));
  assert.equal(accepted.checkRuns.length, 144);
  await assert.rejects(
    collectExactHeadCheckInventory(fixtureWithHeaders(1367404329)),
    /pagination/u,
  );
  await assert.rejects(
    collectExactHeadCheckInventory(fixtureWithHeaders(undefined)),
    /pagination/u,
  );
});

test('duplicate pagination page parameters never become a trusted next page', async () => {
  const input = inventoryFixture(144),
    raw = input.api;
  input.api = async (route, options) => {
    const body = await raw(route, options);
    if (route.endsWith('check-runs?filter=all&per_page=100&page=1'))
      return {
        body,
        link: `<https://api.github.com${route.replace(/&page=1$/u, '&page=2&page=99')}>; rel="next"`,
      };
    return body;
  };
  await assert.rejects(collectExactHeadCheckInventory(input), /pagination|page/u);
});

test('the numeric alias also preserves complete Actions-job pagination and repository bookends', async () => {
  const input = provenanceFixture(undefined, 144),
    raw = input.api;
  const withHeaders = {
    ...input,
    repositoryId: 12,
    api: async (route, options) => {
      const body = await raw(route, options);
      if (!Number.isSafeInteger(body?.total_count) || body.total_count <= 100) return body;
      const url = new URL(route, 'https://api.github.com'),
        page = Number(url.searchParams.get('page'));
      url.pathname = url.pathname.replace(`/repos/${input.repository}/`, '/repositories/12/');
      const pages = Math.ceil(body.total_count / 100);
      let link;
      if (page < pages) {
        url.searchParams.set('page', String(page + 1));
        link = `<${url}>; rel="next"`;
      } else {
        url.searchParams.set('page', '1');
        link = `<${url}>; rel="first"`;
      }
      return { body, link };
    },
  };
  const result = await collectExactHeadCheckInventory(withHeaders);
  assert.equal(result.repositoryId, 12);
  assert.equal(inventoryCheckBlocker(result, SHA), null);
  const options = { ...withHeaders, repositoryId: 99 };
  await assert.rejects(collectExactHeadCheckInventory(options), /pagination|identity/u);
});

test('inventory fails closed on API, request budget and elapsed budget', async () => {
  await assert.rejects(
    collectExactHeadCheckInventory({
      ...inventoryFixture(1),
      api: async () => {
        throw new Error('403 read denied');
      },
    }),
    /403/u,
  );
  await assert.rejects(
    collectExactHeadCheckInventory({ ...inventoryFixture(1), maxRequests: 1 }),
    /request budget/u,
  );
  let ticks = 0;
  await assert.rejects(
    collectExactHeadCheckInventory({
      ...inventoryFixture(1),
      now: () => ticks++ * 120001,
    }),
    /time budget/u,
  );
});

function fixture(overrides = {}) {
  const input = {
    pullRequest: {
      head: { sha: SHA },
      milestone: null,
      labels: [],
      draft: false,
      state: 'open',
      mergeable: true,
      mergeable_state: 'clean',
      review_decision: 'APPROVED',
      auto_merge: null,
      ...overrides,
    },
    observedHeadSha: SHA,
    requiredCheck: {
      id: 1,
      name: 'release-ready',
      status: 'completed',
      conclusion: 'success',
      head_sha: SHA,
      admissionMatches: true,
    },
    checkRuns: [
      {
        id: 1,
        name: 'release-ready',
        status: 'completed',
        conclusion: 'success',
        head_sha: SHA,
      },
    ],
    dependencies: [],
  };
  const provenance = {
    checkId: 1,
    role: 'release-ready',
    jobId: 10,
    runId: 20,
    runAttempt: 1,
    workflowId: 30,
    workflowPath: '.github/workflows/deploy-pages.yml',
    suiteId: 40,
  };
  input.requiredCheck.actionsProvenance = provenance;
  input.checkInventory = {
    headSha: SHA,
    complete: true,
    checkRuns: input.checkRuns,
    provenance: [provenance],
    effectiveStatuses: [],
  };
  return input;
}

test('merges an admitted clean exact head through branch protection', () => {
  assert.deepEqual(decideMergeAction(fixture()), {
    action: 'merge',
    reason: 'exact head is admitted and immediately mergeable',
  });
});

test('pending and failed exact-head checks block a merge even when GitHub calls it unstable', () => {
  for (const [status, conclusion] of [
    ['in_progress', null],
    ['completed', 'failure'],
    ['completed', 'cancelled'],
  ]) {
    const input = fixture({ mergeable_state: 'unstable' });
    input.checkRuns.push({
      id: 2,
      name: 'candidate',
      status,
      conclusion,
      head_sha: SHA,
    });
    assert.equal(decideMergeAction(input).action, 'wait');
  }
});

test('only policy-selected source jobs may be skipped without claiming a pass', () => {
  const input = fixture();
  input.checkRuns.push({
    id: 2,
    name: 'test',
    status: 'completed',
    conclusion: 'skipped',
    head_sha: SHA,
  });
  assert.match(decideMergeAction(input).reason, /test concluded skipped/u);
  input.checkInventory.provenance.push({ checkId: 2, role: 'policy-skip' });
  assert.equal(decideMergeAction(input).action, 'merge');
  input.checkRuns.push({
    id: 3,
    name: 'candidate',
    status: 'completed',
    conclusion: 'skipped',
    head_sha: SHA,
  });
  assert.match(decideMergeAction(input).reason, /candidate concluded skipped/);
});

test('all distinct attempts gate and only a provenance-bound own controller is excluded', () => {
  assert.equal(
    exactHeadCheckBlocker(
      [
        {
          id: 1,
          name: 'preview',
          status: 'completed',
          conclusion: 'success',
          head_sha: SHA,
        },
        {
          id: 2,
          name: 'preview',
          status: 'in_progress',
          conclusion: null,
          head_sha: SHA,
        },
        {
          id: 3,
          name: 'reconcile',
          status: 'in_progress',
          conclusion: null,
          head_sha: SHA,
        },
      ],
      SHA,
    ),
    'preview is in_progress on the exact head',
  );
  const reconcile = {
    id: 3,
    name: 'reconcile',
    status: 'in_progress',
    conclusion: null,
    head_sha: SHA,
  };
  assert.match(exactHeadCheckBlocker([reconcile], SHA), /reconcile is in_progress/u);
  assert.equal(
    exactHeadCheckBlocker([reconcile], SHA, [{ checkId: 3, role: 'self-reconcile' }]),
    null,
  );
  assert.match(
    exactHeadCheckBlocker(
      [
        {
          id: 1,
          name: 'preview',
          status: 'completed',
          conclusion: 'failure',
          head_sha: SHA,
        },
        {
          id: 2,
          name: 'preview',
          status: 'completed',
          conclusion: 'success',
          head_sha: SHA,
        },
      ],
      SHA,
    ),
    /preview concluded failure/u,
  );
});

test('a truncated exact-head check inventory fails closed', () => {
  const input = fixture();
  input.checkInventoryComplete = false;
  assert.deepEqual(decideMergeAction(input), {
    action: 'wait',
    reason: 'exact-head check inventory is incomplete',
  });
});

test('pending protected hooks arm auto-merge for the exact head', () => {
  assert.equal(decideMergeAction(fixture({ mergeable_state: 'has_hooks' })).action, 'arm');
});

test('unknown mergeability never inherits a stale clean-state permission', () => {
  for (const mergeable of [null, undefined]) {
    assert.equal(
      decideMergeAction(fixture({ mergeable, mergeable_state: 'clean' })).action,
      'wait',
    );
  }
});

test('updates a behind conflict-free branch before auto-merge', () => {
  assert.equal(decideMergeAction(fixture({ mergeable_state: 'behind' })).action, 'update');
});

test('changed heads invalidate admission and disarm an existing request', () => {
  const input = fixture({ auto_merge: { enabled_at: 'now' } });
  input.observedHeadSha = '2'.repeat(40);
  assert.deepEqual(decideMergeAction(input), {
    action: 'disarm',
    reason: 'head changed after inspection',
  });
});

test('a failed required rerun disarms an already admitted exact head', () => {
  const input = fixture({ auto_merge: { enabled_at: 'now' } });
  input.requiredCheck.conclusion = 'failure';
  assert.deepEqual(decideMergeAction(input), {
    action: 'disarm',
    reason: 'release-ready is not successful on the exact head',
  });
});

test('missing or stale admission receipts disarm even a successful exact head', () => {
  const input = fixture({ auto_merge: { enabled_at: 'now' } });
  for (const admissionMatches of [false, undefined]) {
    input.requiredCheck.admissionMatches = admissionMatches;
    assert.equal(decideMergeAction(input).action, 'disarm');
  }
});

test('draft and closed PRs fail closed and disarm existing auto-merge', () => {
  for (const overrides of [{ draft: true }, { state: 'closed' }, { state: undefined }]) {
    assert.equal(decideMergeAction(fixture(overrides)).action, 'wait');
    assert.equal(decideMergeAction(fixture({ ...overrides, auto_merge: {} })).action, 'disarm');
  }
});

test('draft or unknown readiness blocks every merge path and disarms existing requests', () => {
  let combinations = 0;
  for (const draft of [true, undefined, null]) {
    for (const mergeable_state of ['clean', 'unstable', 'behind', 'has_hooks']) {
      for (const auto_merge of [null, { enabled_at: 'now' }]) {
        for (const stack of [undefined, { number: 7, size: 2, position: 2 }]) {
          const input = fixture({
            draft,
            mergeable_state,
            auto_merge,
            labels: [{ name: 'fastline-stack-merge' }],
            stack,
          });
          assert.deepEqual(decideMergeAction(input), {
            action: auto_merge ? 'disarm' : 'wait',
            reason: 'pull request is draft or draft state is unknown',
          });
          combinations++;
        }
      }
    }
  }
  assert.equal(combinations, 48);
});

test('labels, milestones and review state do not change exact-head admission', () => {
  for (const overrides of [
    { labels: [{ name: 'hold: ux' }, { name: 'release-train-hold' }] },
    { milestone: { title: 'v0.133.0' } },
    { review_decision: 'CHANGES_REQUESTED' },
  ])
    assert.equal(decideMergeAction(fixture(overrides)).action, 'merge');
});

function policyFixture() {
  const approval = structuredClone(REVIEWED_POLICY_CHANGES[0]);
  return {
    repository: approval.repository,
    pullRequest: {
      number: approval.number,
      head: {
        sha: approval.headSha,
        repo: { id: 12, full_name: approval.repository },
      },
      base: {
        sha: approval.baseSha,
        ref: 'main',
        repo: { id: 12, full_name: approval.repository },
      },
    },
    trustedPolicyBlobs: approval.trustedPolicyBlobs,
    candidatePolicyBlobs: approval.candidatePolicyBlobs,
    changedPaths: approval.paths,
    receiptPaths: approval.paths,
    trustedPolicyDigest: approval.trustedPolicyDigest,
  };
}

test('actual receipt verification retains trusted policy, provenance and complete-path gates', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-admission-test-'));
  try {
    const approval = structuredClone(REVIEWED_POLICY_CHANGES[0]);
    approval.trustedPolicyBlobs = [];
    for (const name of POLICY_FILES) {
      const bytes = Buffer.from(`trusted fixture ${name}\n`);
      await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await fs.writeFile(path.join(root, name), bytes);
      approval.trustedPolicyBlobs.push([
        name,
        createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      ]);
    }
    approval.candidatePolicyBlobs = approval.trustedPolicyBlobs.map(([name, oid]) => [
      name,
      name === 'publishing/focused-test-map.json' ? 'c'.repeat(40) : oid,
    ]);
    const pull = {
      number: approval.number,
      changed_files: approval.paths.length,
      head: { sha: approval.headSha, repo: { full_name: approval.repository } },
      base: {
        sha: approval.baseSha,
        ref: 'main',
        repo: { full_name: approval.repository },
      },
    };
    const policyDigest = await validationPolicyDigest(root);
    approval.trustedPolicyDigest = policyDigest;
    approval.approvedPolicyDigest = 'e'.repeat(64);
    const originalReceipt = admissionBinding(pull, {
      workflowRevision: SHA,
      policyDigest: approval.approvedPolicyDigest,
      paths: approval.paths,
    });
    const run = {
      id: 123,
      run_attempt: 1,
      workflow_id: 300,
      check_suite_id: 700,
      event: 'pull_request',
      path: '.github/workflows/deploy-pages.yml',
      head_sha: pull.head.sha,
    };
    const check = () => ({
      id: 456,
      name: 'release-ready',
      head_sha: pull.head.sha,
      app: { id: 15368, slug: 'github-actions' },
      actionsProvenance: {
        checkId: 456,
        role: 'release-ready',
        jobId: 1000,
        runId: 123,
        runAttempt: 1,
        workflowId: 300,
        workflowPath: '.github/workflows/deploy-pages.yml',
        suiteId: 700,
      },
      details_url: 'https://attacker.invalid/not-an-authoritative-run',
    });
    let receipt = originalReceipt,
      artifacts = [
        {
          id: 987,
          name: 'admission-123-1',
          expired: false,
          size_in_bytes: 1000,
        },
      ];
    let rows = approval.paths.map((filename) => ({ filename }));
    let candidate = approval.candidatePolicyBlobs;
    const calls = [];
    const options = {
      root,
      approvals: [approval],
      api: async (endpoint) => {
        calls.push(endpoint);
        if (endpoint.endsWith('/actions/runs/123')) return run;
        if (endpoint.endsWith('/artifacts?per_page=100')) return { artifacts };
        if (endpoint.includes('/files?')) return rows;
        throw new Error(`Unexpected API ${endpoint}`);
      },
      graph: async () => ({
        repository: Object.fromEntries(candidate.map(([, oid], i) => [`p${i}`, { oid }])),
      }),
      download: async () => {
        await fs.writeFile(path.join(root, 'admission.json'), JSON.stringify(receipt));
        execFileSync('zip', ['-q', 'receipt.zip', 'admission.json'], {
          cwd: root,
        });
        return {
          ok: true,
          arrayBuffer: async () => fs.readFile(path.join(root, 'receipt.zip')),
        };
      },
    };
    const verify = () => checkedAdmission('mekhovov', 'revealline', check(), pull, options);
    // The original all-blobs-equal rule rejects this exact approved difference.
    assert.notDeepEqual(approval.trustedPolicyBlobs, candidate);
    options.approvals = [];
    assert.equal(await verify(), false);
    options.approvals = [approval];
    assert.equal(await verify(), true);
    assert.ok(calls.some((endpoint) => endpoint.includes('/files?')));
    receipt = { ...originalReceipt, policyDigest: 'f'.repeat(64) };
    assert.equal(await verify(), false, 'approval must not waive trusted receipt policy');
    receipt = { ...originalReceipt, headSha: 'f'.repeat(40) };
    assert.equal(await verify(), false);
    receipt = originalReceipt;
    rows = rows.slice(1);
    await assert.rejects(verify(), /Incomplete/);
    rows = approval.paths.map((filename) => ({ filename }));
    rows[0].previous_filename = 'publishing/fastline-merge-controller.mjs';
    assert.equal(await verify(), false, 'rename source must be independently included');
    rows = approval.paths.map((filename) => ({ filename }));
    rows[1] = rows[0];
    await assert.rejects(verify(), /Duplicate/);
    rows = approval.paths.map((filename) => ({ filename }));
    artifacts[0].expired = true;
    assert.equal(await verify(), false);
    artifacts[0].expired = false;
    artifacts.push(artifacts[0]);
    assert.equal(await verify(), false);
    artifacts = artifacts.slice(0, 1);
    run.head_sha = 'f'.repeat(40);
    assert.equal(await verify(), false);
    run.head_sha = pull.head.sha;
    for (const key of ['run_attempt', 'workflow_id', 'check_suite_id']) {
      run[key]++;
      assert.equal(await verify(), false, `${key} must remain bound`);
      run[key]--;
    }
    const unbound = check();
    delete unbound.actionsProvenance;
    assert.equal(await checkedAdmission('mekhovov', 'revealline', unbound, pull, options), false);
    candidate = approval.trustedPolicyBlobs;
    options.approvals = [];
    receipt = { ...originalReceipt, policyDigest };
    assert.equal(await verify(), true, 'unchanged policies still use the ordinary path');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('only the exact reviewed source, complete policy and actual changed paths are approved', () => {
  assert.equal(reviewedPolicyChangeMatches(policyFixture()), true);
  for (const mutate of [
    (x) => (x.repository = 'attacker/revealline'),
    (x) => x.pullRequest.number++,
    (x) => (x.pullRequest.head.sha = 'a'.repeat(40)),
    (x) => (x.pullRequest.base.sha = 'b'.repeat(40)),
    (x) => (x.pullRequest.base.ref = 'other'),
    (x) => (x.pullRequest.head.repo.full_name = 'attacker/revealline'),
    (x) => (x.pullRequest.base.repo.full_name = 'attacker/revealline'),
    (x) => (x.trustedPolicyBlobs[0][1] = 'a'.repeat(40)),
    (x) => (x.candidatePolicyBlobs[0][1] = 'a'.repeat(40)),
    (x) => (x.candidatePolicyBlobs[4][1] = 'b'.repeat(40)),
    (x) => (x.trustedPolicyDigest = 'f'.repeat(64)),
    (x) => x.trustedPolicyBlobs.pop(),
    (x) => x.candidatePolicyBlobs.push(x.candidatePolicyBlobs[0]),
    (x) => (x.candidatePolicyBlobs[0][0] = '../policy'),
    (x) => x.changedPaths.pop(),
    (x) => x.changedPaths.push('publishing/fastline-merge-controller.mjs'),
    (x) => x.changedPaths.push(x.changedPaths[0]),
    (x) => x.receiptPaths.pop(),
    (x) => x.receiptPaths.push('other'),
  ]) {
    const input = policyFixture();
    mutate(input);
    assert.equal(reviewedPolicyChangeMatches(input), false);
  }
});

test('manual stack workflow exception is confined to its immutable reviewed identity', () => {
  for (const name of [
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/fastline-auto-merge.yml',
    '.github/workflows/other.yml',
    '.github/other',
    'publishing/fastline-merge-controller.mjs',
  ]) {
    const input = policyFixture();
    const approvals = structuredClone(REVIEWED_POLICY_CHANGES);
    const paths = [...input.changedPaths, name].sort();
    input.changedPaths = paths;
    input.receiptPaths = paths;
    approvals[0].paths = paths;
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false, name);
  }
  for (const field of ['repository', 'number', 'headSha', 'baseSha']) {
    const input = policyFixture();
    const approvals = structuredClone(REVIEWED_POLICY_CHANGES);
    const value =
      field === 'repository' ? 'other/repo' : field === 'number' ? 1559 : 'a'.repeat(40);
    approvals[0][field] = value;
    if (field === 'repository') {
      input.repository = value;
      input.pullRequest.head.repo.full_name = value;
      input.pullRequest.base.repo.full_name = value;
    } else if (field === 'number') input.pullRequest.number = value;
    else if (field === 'headSha') input.pullRequest.head.sha = value;
    else input.pullRequest.base.sha = value;
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false, field);
  }
  for (const index of [0, 1, 2, 3, 5, 6]) {
    const input = policyFixture();
    const approvals = structuredClone(REVIEWED_POLICY_CHANGES);
    input.candidatePolicyBlobs[index][1] = 'd'.repeat(40);
    approvals[0].candidatePolicyBlobs[index][1] = 'd'.repeat(40);
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false);
  }
});

test('approval inventory is strict, unique and cannot come from candidate input', () => {
  const input = policyFixture();
  for (const approvals of [[], null, [...REVIEWED_POLICY_CHANGES, ...REVIEWED_POLICY_CHANGES]])
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false);
  const bad = structuredClone(REVIEWED_POLICY_CHANGES);
  bad[0].extra = 'not permitted';
  assert.equal(reviewedPolicyChangeMatches(input, bad), false);
  assert.equal(reviewedPolicyChangeMatches({ ...input, approvals: [] }), false);
  assert.equal(reviewedPolicyChangeMatches(null), false);
});

test('main freshness requires exact valid checkout and live branch identities', () => {
  assert.equal(trustedMainMatches(SHA, SHA), true);
  for (const values of [
    [SHA, '2'.repeat(40)],
    [undefined, undefined],
    ['main', 'main'],
    [SHA.toUpperCase(), 'f'.repeat(40)],
  ])
    assert.equal(trustedMainMatches(...values), false);
});

test('final mutation snapshot rechecks exact approval identities, main, checks and dependencies', () => {
  const policy = policyFixture();
  const pull = {
    ...policy.pullRequest,
    state: 'open',
    draft: false,
    mergeable: true,
    mergeable_state: 'clean',
  };
  const policyDigest = REVIEWED_POLICY_CHANGES[0].approvedPolicyDigest;
  const receipt = admissionBinding(pull, {
    workflowRevision: SHA,
    policyDigest,
    paths: policy.changedPaths,
  });
  const { pullRequest: _pullRequest, ...approvedPolicyContext } = policy;
  const required = {
    id: 10,
    name: 'release-ready',
    head_sha: pull.head.sha,
    status: 'completed',
    conclusion: 'success',
    admissionReceipt: receipt,
    policyDigest,
    approvedPolicyContext,
    actionsProvenance: {
      checkId: 10,
      role: 'release-ready',
      jobId: 10,
      runId: 20,
      runAttempt: 1,
      workflowId: 30,
      workflowPath: '.github/workflows/deploy-pages.yml',
      suiteId: 40,
    },
  };
  const fixture = () =>
    structuredClone({
      controllerMainSha: SHA,
      liveMainSha: SHA,
      previousDecision: { action: 'merge' },
      pullRequest: pull,
      initialPullRequest: structuredClone(pull),
      requiredCheck: required,
      freshChecks: {
        headSha: pull.head.sha,
        complete: true,
        checkRuns: [structuredClone(required)],
        provenance: [structuredClone(required.actionsProvenance)],
        effectiveStatuses: [],
      },
      observedHeadSha: pull.head.sha,
      dependencies: [],
    });
  assert.equal(mutationSnapshotMatches(fixture()), true);
  const retargeted = structuredClone(pull);
  retargeted.base.ref = 'other-branch-at-the-same-sha';
  assert.equal(freshAdmissionMatches(required, retargeted), false);
  for (const mutate of [
    (x) => (x.liveMainSha = 'f'.repeat(40)),
    (x) => (x.pullRequest.head.sha = 'f'.repeat(40)),
    (x) => (x.pullRequest.base.sha = 'f'.repeat(40)),
    (x) => (x.pullRequest.base.ref = 'other-branch-at-the-same-sha'),
    (x) => (x.pullRequest.head.repo.full_name = 'other/repository'),
    (x) => (x.pullRequest.base.repo.full_name = 'other/repository'),
    (x) => (x.pullRequest.draft = true),
    (x) => (x.pullRequest.state = 'closed'),
    (x) => (x.freshChecks.complete = false),
    (x) => x.freshChecks.checkRuns[0].id++,
    (x) => (x.freshChecks.checkRuns[0].conclusion = 'failure'),
    (x) => (x.freshChecks.checkRuns[0].status = 'in_progress'),
    (x) =>
      x.freshChecks.checkRuns.push({
        id: 20,
        name: 'candidate',
        head_sha: pull.head.sha,
        status: 'in_progress',
      }),
    (x) => x.dependencies.push({ number: 1, merged_at: null }),
  ]) {
    const input = fixture();
    mutate(input);
    assert.equal(mutationSnapshotMatches(input), false, String(mutate));
  }
});

test('declared dependencies must already be merged', () => {
  const input = fixture();
  input.dependencies = [{ number: 573, merged_at: null }];
  assert.equal(decideMergeAction(input).reason, 'declared predecessor is not merged');
  input.dependencies[0].merged_at = '2026-09-26T00:00:00Z';
  assert.equal(decideMergeAction(input).action, 'merge');
});

test('only explicitly labeled GitHub stacks use the asynchronous merge endpoint', () => {
  assert.equal(
    decideMergeAction(
      fixture({
        labels: [{ name: 'fastline-stack-merge' }],
        stack: { number: 7, size: 2, position: 2 },
      }),
    ).action,
    'stack',
  );
  assert.equal(
    decideMergeAction(
      fixture({
        labels: [{ name: 'fastline-stack-merge' }],
      }),
    ).action,
    'merge',
  );
});

test('stacked merge payload and polling results remain exact and fail closed', () => {
  assert.deepEqual(asynchronousMergeRequest(SHA), {
    sha: SHA,
    merge_method: 'merge',
    merge_action: 'default',
    bypass_rules: false,
  });
  assert.throws(() => asynchronousMergeRequest('main'), /exact 40-character/);
  assert.deepEqual(asynchronousMergeResult({ status: 'pending', details: {} }), {
    done: false,
    merged: false,
  });
  assert.deepEqual(asynchronousMergeResult({ status: 'merged', details: { sha: SHA } }), {
    done: true,
    merged: true,
    sha: SHA,
  });
  assert.deepEqual(
    asynchronousMergeResult({
      status: 'failed',
      details: { message: 'blocked' },
    }),
    { done: true, merged: false, reason: 'blocked' },
  );
});

test("only GitHub's stack-only endpoint rejection switches merge APIs", () => {
  assert.equal(
    isStackOnlyMergeError({
      status: 403,
      data: {
        message:
          'Merging stacked PRs via this endpoint is not supported. Use the asynchronous merge endpoint instead.',
      },
    }),
    true,
  );
  for (const error of [
    { status: 403, data: { message: 'Branch protection denied merge.' } },
    {
      status: 403,
      data: { message: 'Resource not accessible by integration' },
    },
    { status: 409, data: { message: 'Conflict' } },
  ])
    assert.equal(isStackOnlyMergeError(error), false);
});

test('a controller-owned merge dispatches the rolling Pages workflow from main', () => {
  assert.deepEqual(mainPagesDispatchRequest(), { ref: 'main' });
});

test('dependency references are explicit and deduplicated by the caller', () => {
  assert.deepEqual(dependencyNumbers('Depends on #573\nBlocked by #576'), [573, 576]);
});

test('the privileged workflow is a safe no-op until the trusted controller reaches main', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/fastline-auto-merge.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /Record one-time controller bootstrap/);
  assert.match(workflow, /opened,/);
  assert.match(workflow, /reopened,/);
  assert.match(workflow, /filter: blob:none/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /if: hashFiles\('publishing\/fastline-merge-controller\.mjs'\) == ''/);
  assert.match(workflow, /if: hashFiles\('publishing\/fastline-merge-controller\.mjs'\) != ''/);
});

function prInapplicableFixture({
  workflowPath = '.github/workflows/published-pages-smoke.yml',
  blob = Object.keys(REVIEWED_PR_INAPPLICABLE_WORKFLOWS[workflowPath])[0],
  copies = 1,
  extraChecks = 0,
  baseSha = '2'.repeat(40),
  allowRecordedBaseDrift = false,
  pullRequestNumber = 1620,
  mutate,
} = {}) {
  const repository = 'mekhovov/revealline';
  const base = baseSha;
  const app = { id: 15368, slug: 'github-actions' };
  const repositoryRecord = { id: 12, full_name: repository };
  const repositoryURL = `https://api.github.com/repos/${repository}`;
  const paths = [
    '.github/workflows/deploy-pages.yml',
    '.github/workflows/fastline-auto-merge.yml',
    workflowPath,
  ];
  const catalog = paths.map((path, i) => ({ id: 300 + i, path, state: 'active' }));
  while (catalog.length < 116)
    catalog.push({
      id: 300 + catalog.length,
      path: `.github/workflows/unused-${catalog.length}.yml`,
      state: 'active',
    });
  const directory = [
    { name: workflowPath.split('/').at(-1), path: workflowPath, sha: blob, type: 'file' },
  ];
  const suites = [],
    checks = [],
    runs = [],
    jobs = new Map();
  const addRun = (workflowId, definitions, controller = false) => {
    const suiteId = 7 + suites.length;
    const runId = 50 + runs.length;
    const run = {
      id: runId,
      run_attempt: 1,
      workflow_id: workflowId,
      path: catalog.find((row) => row.id === workflowId).path,
      head_sha: SHA,
      check_suite_id: suiteId,
      repository: repositoryRecord,
      head_repository: repositoryRecord,
      event: 'pull_request',
      status: controller ? 'in_progress' : 'completed',
      conclusion: controller ? null : 'success',
      pull_requests: [
        {
          id: 99,
          number: pullRequestNumber,
          url: `${repositoryURL}/pulls/${pullRequestNumber}`,
          head: { ref: 'codex/fixture', sha: SHA, repo: { id: 12, url: repositoryURL } },
          base: { ref: 'main', sha: base, repo: { id: 12, url: repositoryURL } },
        },
      ],
    };
    runs.push(run);
    suites.push({
      id: suiteId,
      head_sha: SHA,
      repository: repositoryRecord,
      app,
      status: run.status,
      conclusion: run.conclusion,
    });
    const actionJobs = [];
    for (const [name, conclusion] of definitions) {
      const check = {
        id: 1000 + checks.length,
        name,
        head_sha: SHA,
        app,
        check_suite: { id: suiteId },
        status: conclusion === null ? 'in_progress' : 'completed',
        conclusion,
        started_at: '2026-10-18T00:00:00Z',
        completed_at: conclusion === null ? null : '2026-10-18T00:01:00Z',
        details_url: 'https://attacker.invalid/not-used',
      };
      checks.push(check);
      actionJobs.push({
        id: 100000 + check.id,
        run_id: run.id,
        run_attempt: 1,
        head_sha: SHA,
        name,
        status: check.status,
        conclusion,
        started_at: check.started_at,
        completed_at: check.completed_at,
        check_run_url: `${repositoryURL}/check-runs/${check.id}`,
      });
    }
    jobs.set(run.id, actionJobs);
    return run;
  };
  addRun(300, [
    ['release-ready', 'success'],
    ['test', 'skipped'],
    ['build', 'skipped'],
    ...Array.from({ length: extraChecks }, (_, i) => [`extra-success-${i}`, 'success']),
  ]);
  const controller = addRun(301, [['reconcile', null]], true);
  const reviewed = REVIEWED_PR_INAPPLICABLE_WORKFLOWS[workflowPath][blob];
  for (let i = 0; i < copies; i++)
    addRun(
      302,
      Object.values(reviewed.jobs).map((definition) => [
        definition.checkNames[0],
        definition.proof ? 'skipped' : 'success',
      ]),
    );
  const calls = [];
  let sweep = 0;
  const api = async (route) => {
    calls.push(route);
    const url = new URL(route, 'https://api.github.com');
    const page = Number(url.searchParams.get('page'));
    const counted = (key, rows) => ({
      total_count: rows.length,
      [key]: rows.slice((page - 1) * 100, page * 100),
    });
    let result;
    if (url.pathname.endsWith('/check-suites')) {
      sweep++;
      result = counted('check_suites', suites);
    } else if (url.pathname.endsWith('/check-runs')) {
      assert.equal(url.searchParams.get('filter'), 'all');
      result = counted('check_runs', checks);
    } else if (url.pathname.endsWith('/statuses')) result = [];
    else if (url.pathname.endsWith('/actions/runs')) {
      assert.equal(url.searchParams.get('head_sha'), SHA);
      assert.equal(url.searchParams.has('check_suite_id'), false);
      result = counted('workflow_runs', runs);
    } else if (url.pathname.endsWith('/actions/workflows')) result = counted('workflows', catalog);
    else if (url.pathname.endsWith('/contents/.github/workflows')) {
      assert.equal(url.searchParams.get('ref'), SHA);
      result = directory;
    } else if (url.pathname.includes('/compare/')) {
      const match = /\/compare\/([a-f0-9]{40})\.\.\.([a-f0-9]{40})$/u.exec(url.pathname);
      assert(match);
      const requestedBase = match[1];
      assert.equal(match[2], SHA);
      if (!allowRecordedBaseDrift) assert.equal(requestedBase, base);
      assert.equal(url.pathname, `/repos/${repository}/compare/${requestedBase}...${SHA}`);
      assert.equal(url.searchParams.get('per_page'), '1');
      result = {
        url: `${repositoryURL}/compare/${requestedBase}...${SHA}`,
        base_commit: { sha: requestedBase },
        merge_base_commit: { sha: requestedBase },
        status: requestedBase === SHA ? 'identical' : 'ahead',
        ahead_by: requestedBase === SHA ? 0 : 1,
        behind_by: 0,
        total_commits: requestedBase === SHA ? 0 : 1,
      };
    } else {
      const match = /\/actions\/runs\/(\d+)\/attempts\/1\/jobs$/u.exec(url.pathname);
      assert(match, `Unexpected read ${route}`);
      result = counted('jobs', jobs.get(Number(match[1])));
    }
    result = structuredClone(result);
    mutate?.({ route, url, result, page, sweep });
    return result;
  };
  return {
    repository,
    repositoryId: 12,
    headSha: SHA,
    pullRequestNumber,
    invocation: { runId: controller.id, runAttempt: 1, jobName: 'reconcile' },
    api,
    calls,
    suites,
    checks,
    runs,
    jobs,
    catalog,
    directory,
    base,
  };
}

test('reviewed PR-inapplicable skips preserve source success and native qualification separation', async () => {
  const input = prInapplicableFixture();
  const inventory = await collectExactHeadCheckInventory(input);
  assert.equal(inventoryCheckBlocker(inventory, SHA), null);
  const browser = inventory.checkRuns.find((check) => check.name === 'browser');
  const binding = inventory.provenance.find((row) => row.checkId === browser.id);
  assert.equal(browser.conclusion, 'skipped');
  assert.equal(binding.role, 'inapplicable-skip');
  assert.equal(binding.workflowBlob, input.directory[0].sha);
  assert.equal(binding.executedSourceBase, input.base);
  assert.equal(binding.pullRequestNumber, 1620);
  assert.deepEqual(binding.inapplicableJobs, ['browser']);
  assert.equal(binding.sourceJobs[0].jobId, 'source');
  assert.equal(inventoryReleaseReady(inventory, SHA).name, 'release-ready');
  assert.equal(inventory.mergeAuthority, false);
  assert.equal(input.calls.filter((route) => route.includes('/compare/')).length, 2);
  assert.equal(input.calls.filter((route) => route.includes('/contents/')).length, 2);
});

test('all skipped matrix-name candidates and transitive needs require source-bound proofs', async () => {
  const input = prInapplicableFixture({
    workflowPath: '.github/workflows/solo-native-package-consumer.yml',
  });
  const inventory = await collectExactHeadCheckInventory(input);
  assert.equal(inventoryCheckBlocker(inventory, SHA), null);
  const bindings = inventory.provenance.filter((row) => row.role === 'inapplicable-skip');
  assert.equal(bindings.length, 16);
  const engine = inventory.checkRuns.filter((row) => row.name === 'matrix.engine');
  assert.equal(engine.length, 2);
  for (const check of engine)
    assert.deepEqual(bindings.find((row) => row.checkId === check.id).inapplicableJobs, [
      'app-overhead',
      'journal-cost',
    ]);
  const sustained = inventory.checkRuns.find((row) => row.name === 'sustained');
  assert.deepEqual(bindings.find((row) => row.checkId === sustained.id).inapplicableJobs, [
    'declare',
    'sustained',
  ]);
});

test('frozen one-shot owners are inapplicable only outside PR1544', async () => {
  const workflowPath = Object.keys(REVIEWED_PR_INAPPLICABLE_WORKFLOWS).find((path) =>
    Object.values(REVIEWED_PR_INAPPLICABLE_WORKFLOWS[path]).some((entry) =>
      Object.values(entry.jobs).some((job) => job.proof?.kind === 'other-pr'),
    ),
  );
  const other = await collectExactHeadCheckInventory(prInapplicableFixture({ workflowPath }));
  assert.equal(inventoryCheckBlocker(other, SHA), null);
  const original = await collectExactHeadCheckInventory(
    prInapplicableFixture({
      workflowPath,
      pullRequestNumber: 1544,
    }),
  );
  assert.match(inventoryCheckBlocker(original, SHA), /skipped/u);
  assert.equal(
    original.provenance.some((row) => row.role === 'inapplicable-skip'),
    false,
  );
});

test('workflow mutations, source failure and manual/native runs never become skip exceptions', async () => {
  for (const mutate of [
    ({ result }) => {
      if (Array.isArray(result) && result[0]?.sha) result[0].sha = 'f'.repeat(40);
    },
    ({ result }) => {
      const selected = result.workflows?.find((row) => row.id === 302);
      if (selected) selected.state = 'disabled_manually';
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs.at(-1).event = 'workflow_dispatch';
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs.at(-1).workflow_id = 777;
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs.at(-1).path = '.github/workflows/unknown.yml';
    },
    ({ result }) => {
      if (result.jobs)
        result.jobs
          .filter((row) => row.name === 'source')
          .forEach((row) => (row.conclusion = 'failure'));
    },
    ({ result }) => {
      if (result.jobs)
        result.jobs
          .filter((row) => row.name === 'source')
          .forEach((row) => (row.check_run_url += '?spoof'));
    },
    ({ result }) => {
      if (result.jobs)
        result.jobs
          .filter((row) => row.name === 'source')
          .forEach((row) => (row.started_at = '2026-10-18T00:00:01Z'));
    },
    ({ result }) => {
      if (result.jobs)
        result.jobs
          .filter((row) => row.name === 'browser')
          .forEach((row) => (row.check_run_url += '?spoof'));
    },
  ]) {
    const inventory = await collectExactHeadCheckInventory(prInapplicableFixture({ mutate }));
    assert.match(inventoryCheckBlocker(inventory, SHA), /skipped/u);
    assert.equal(
      inventory.provenance.some((row) => row.role === 'inapplicable-skip'),
      false,
    );
  }
});

test('unknown check names and missing or non-skipped dependencies remain gates', async () => {
  const input = prInapplicableFixture({
    workflowPath: '.github/workflows/solo-native-package-consumer.yml',
  });
  const declare = input.checks.find((row) => row.name === 'declare');
  const declaredJob = [...input.jobs.values()].flat().find((row) => row.name === 'declare');
  declare.conclusion = 'success';
  declaredJob.conclusion = 'success';
  const inventory = await collectExactHeadCheckInventory(input);
  assert.match(inventoryCheckBlocker(inventory, SHA), /sustained.*skipped/u);
  const unknown = prInapplicableFixture();
  unknown.checks.find((row) => row.name === 'browser').name = 'unknown-browser';
  [...unknown.jobs.values()].flat().find((row) => row.name === 'browser').name = 'unknown-browser';
  assert.match(
    inventoryCheckBlocker(await collectExactHeadCheckInventory(unknown), SHA),
    /unknown-browser/u,
  );
});

test('failed, pending and cancelled native jobs remain blocked even under reviewed workflow bytes', async () => {
  for (const [status, conclusion] of [
    ['completed', 'failure'],
    ['completed', 'cancelled'],
    ['in_progress', null],
  ]) {
    const input = prInapplicableFixture();
    for (const row of [...input.checks, ...[...input.jobs.values()].flat()]) {
      if (row.name !== 'browser') continue;
      row.status = status;
      row.conclusion = conclusion;
      row.completed_at = status === 'completed' ? '2026-10-18T00:01:00Z' : null;
    }
    // Keep another otherwise-inapplicable skip to exercise the batched path.
    const extra = input.checks.find((row) => row.name === 'source');
    extra.name = 'unknown';
    extra.conclusion = 'skipped';
    const extraJob = [...input.jobs.values()].flat().find((row) => row.name === 'source');
    extraJob.name = 'unknown';
    extraJob.conclusion = 'skipped';
    const inventory = await collectExactHeadCheckInventory(input);
    assert(inventoryCheckBlocker(inventory, SHA));
    const browser = inventory.checkRuns.find((row) => row.name === 'browser');
    assert.notEqual(
      inventory.provenance.find((row) => row.checkId === browser.id)?.role,
      'inapplicable-skip',
    );
  }
});

test('PR associations bind the exact head, repository and unique non-historical owner', async () => {
  for (const change of [
    (run) => {
      run.pull_requests = [];
    },
    (run) => {
      run.pull_requests.push(structuredClone(run.pull_requests[0]));
    },
    (run) => {
      run.pull_requests[0].number = 1544;
    },
    (run) => {
      run.pull_requests[0].head.sha = 'e'.repeat(40);
    },
    (run) => {
      run.pull_requests[0].head.repo.id = 999;
    },
    (run) => {
      run.pull_requests[0].base.repo.url = 'https://api.github.com/repos/attacker/repo';
    },
    (run) => {
      run.pull_requests[0].base.ref = 'other';
    },
    (run) => {
      run.pull_requests[0].url += '?spoof';
    },
  ]) {
    const input = prInapplicableFixture();
    change(input.runs.at(-1));
    const inventory = await collectExactHeadCheckInventory(input);
    assert.match(inventoryCheckBlocker(inventory, SHA), /skipped/u);
  }
});

test('executed-source ancestry requires an immutable ancestor and a consistent summary', async () => {
  for (const change of [
    (row) => {
      row.status = 'diverged';
      row.behind_by = 1;
      row.merge_base_commit.sha = 'd'.repeat(40);
    },
    (row) => {
      row.status = 'behind';
      row.ahead_by = 0;
      row.total_commits = 0;
      row.behind_by = 1;
    },
    (row) => {
      row.status = 'identical';
      row.ahead_by = 0;
      row.total_commits = 0;
    },
    (row) => {
      row.merge_base_commit.sha = 'd'.repeat(40);
    },
    (row) => {
      row.ahead_by = 2;
    },
  ]) {
    const inventory = await collectExactHeadCheckInventory(
      prInapplicableFixture({
        mutate: ({ result }) => {
          if (result.merge_base_commit) change(result);
        },
      }),
    );
    assert.match(inventoryCheckBlocker(inventory, SHA), /skipped/u);
  }
  for (const change of [
    (row) => {
      row.url = row.url.replace(SHA, 'f'.repeat(40));
    },
    (row) => {
      row.base_commit.sha = 'd'.repeat(40);
    },
    (row) => {
      row.ahead_by = -1;
    },
    (row) => {
      row.total_commits = 1.5;
    },
    (row) => {
      row.merge_base_commit.sha = 'malformed';
    },
    (row) => {
      delete row.status;
    },
  ])
    await assert.rejects(
      collectExactHeadCheckInventory(
        prInapplicableFixture({
          mutate: ({ result }) => {
            if (result.merge_base_commit) change(result);
          },
        }),
      ),
      /ancestry/u,
    );
});

test('workflow catalogs, run batches and directories are complete, bounded and unambiguous', async () => {
  for (const mutate of [
    ({ result }) => {
      if (result.workflows) result.workflows.pop();
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs.push(structuredClone(result.workflow_runs[0]));
    },
    ({ result }) => {
      if (result.workflows?.length > 1) result.workflows[1].path = result.workflows[0].path;
    },
    ({ result }) => {
      if (result.workflow_runs) result.workflow_runs[0].repository.id = 999;
    },
    ({ result }) => {
      if (Array.isArray(result) && result[0]?.sha) result.push(structuredClone(result[0]));
    },
    ({ result }) => {
      if (Array.isArray(result) && result[0]?.sha) result[0].type = 'symlink';
    },
    ({ result }) => {
      if (Array.isArray(result) && result[0]?.sha)
        result[0].path = '.github/workflows/../spoof.yml';
    },
    ({ result }) => {
      if (Array.isArray(result) && result[0]?.sha) result[0].sha = 'bad';
    },
    ({ result }) => {
      if (Array.isArray(result) && result[0]?.sha)
        while (result.length < 1000) result.push(structuredClone(result[0]));
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(prInapplicableFixture({ mutate })));
});

test('batched run-to-suite and exact-attempt job joins never collapse historical identities', async () => {
  for (const mutate of [
    ({ result }) => {
      if (result.workflow_runs) {
        result.workflow_runs.push({ ...structuredClone(result.workflow_runs.at(-1)), id: 999 });
        result.total_count++;
      }
    },
    ({ result }) => {
      if (result.jobs?.some((row) => row.name === 'browser')) {
        result.jobs.push({ ...structuredClone(result.jobs.at(-1)), id: 999 });
        result.total_count++;
      }
    },
    ({ result }) => {
      if (result.jobs) result.jobs[0].run_attempt = 2;
    },
    ({ result }) => {
      if (result.jobs) result.jobs[0].run_id = 999;
    },
    ({ result }) => {
      if (result.jobs) result.jobs[0].head_sha = 'e'.repeat(40);
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(prInapplicableFixture({ mutate })));
});

test('the second complete sweep rechecks workflow bytes, PR base, ancestry and catalog state', async () => {
  for (const mutate of [
    ({ result, sweep }) => {
      if (sweep === 2 && Array.isArray(result) && result[0]?.sha) result[0].sha = 'f'.repeat(40);
    },
    ({ result, sweep }) => {
      if (sweep === 2 && result.merge_base_commit) result.merge_base_commit.sha = 'd'.repeat(40);
    },
    ({ result, sweep }) => {
      if (sweep === 2 && result.workflows) result.workflows.at(-1).state = 'disabled_manually';
    },
  ])
    await assert.rejects(collectExactHeadCheckInventory(prInapplicableFixture({ mutate })));
});

test('a large frozen cohort stays within the unchanged per-sweep request bound', async () => {
  const input = prInapplicableFixture({ copies: 46, extraChecks: 14 });
  const inventory = await collectExactHeadCheckInventory(input);
  assert.equal(inventoryCheckBlocker(inventory, SHA), null);
  assert.deepEqual(inventory.requestCounts, [57, 57]);
  assert.equal(inventory.provenance.filter((row) => row.role === 'inapplicable-skip').length, 46);
  assert.equal(input.calls.filter((route) => route.includes('/actions/runs?')).length, 2);
  assert.equal(input.calls.filter((route) => route.includes('/attempts/')).length, 96);
  assert.equal(input.calls.filter((route) => route.includes('/compare/')).length, 2);
  await assert.rejects(
    collectExactHeadCheckInventory({
      ...prInapplicableFixture({ copies: 54, extraChecks: 14 }),
    }),
    /request budget/u,
  );
});

test('new proof reads share existing request and wall-clock bounds', async () => {
  await assert.rejects(
    collectExactHeadCheckInventory({
      ...prInapplicableFixture(),
      maxRequests: 6,
    }),
    /request budget/u,
  );
  let now = 0;
  await assert.rejects(
    collectExactHeadCheckInventory({
      ...prInapplicableFixture({
        mutate: ({ url }) => {
          if (url.pathname.includes('/compare/')) now = 120_000;
        },
      }),
      now: () => now,
    }),
    /time budget/u,
  );
});

test('the finite registry has no source-job exemption and every inherited proof names a reviewed root', () => {
  for (const [workflowPath, versions] of Object.entries(REVIEWED_PR_INAPPLICABLE_WORKFLOWS)) {
    assert.match(workflowPath, /^\.github\/workflows\/[A-Za-z0-9_.-]+$/u);
    for (const [blob, reviewed] of Object.entries(versions)) {
      assert.match(blob, /^[a-f0-9]{40}$/u);
      assert.match(reviewed.sha256, /^[a-f0-9]{64}$/u);
      assert(Number.isSafeInteger(reviewed.bytes) && reviewed.bytes > 0);
      for (const source of reviewed.requiredSuccessfulJobs)
        assert.equal(reviewed.jobs[source].proof, null);
      for (const definition of Object.values(reviewed.jobs)) {
        assert(definition.checkNames.length > 0);
        if (definition.proof?.kind === 'other-pr') assert.equal(definition.proof.forbiddenPR, 1544);
        if (definition.proof?.kind === 'needs-inapplicable') {
          assert.equal(definition.condition, null);
          assert.deepEqual(definition.proof.needs, definition.needs);
          assert(definition.needs.length > 0);
          for (const needed of definition.needs) assert(reviewed.jobs[needed].proof);
        }
      }
    }
  }
});

test('a successful source guard from another run or attempt cannot authorize a skip', async () => {
  const input = prInapplicableFixture({ copies: 2 });
  const firstNative = input.runs[2];
  const sourceJob = input.jobs.get(firstNative.id).find((row) => row.name === 'source');
  sourceJob.run_attempt = 2;
  await assert.rejects(collectExactHeadCheckInventory(input), /job identity/u);
  const mismatch = prInapplicableFixture({ copies: 2 });
  const firstSource = mismatch.jobs.get(mismatch.runs[2].id).find((row) => row.name === 'source');
  firstSource.check_run_url = mismatch.jobs
    .get(mismatch.runs[3].id)
    .find((row) => row.name === 'source').check_run_url;
  const inventory = await collectExactHeadCheckInventory(mismatch);
  assert.match(inventoryCheckBlocker(inventory, SHA), /browser.*skipped/u);
  assert.equal(inventory.provenance.filter((row) => row.role === 'inapplicable-skip').length, 1);
});

test('missing PR identity and original PR1544 never receive the new role', async () => {
  const original = await collectExactHeadCheckInventory(
    prInapplicableFixture({ pullRequestNumber: 1544 }),
  );
  assert.match(inventoryCheckBlocker(original, SHA), /browser.*skipped/u);
  assert.equal(
    original.provenance.some((row) => row.role === 'inapplicable-skip'),
    false,
  );
  const missing = provenanceFixture();
  missing.rows[1].name = 'browser';
  const ordinary = await collectExactHeadCheckInventory(missing);
  assert.match(inventoryCheckBlocker(ordinary, SHA), /browser.*skipped/u);
  for (const pullRequestNumber of [0, -1, '1620', 1.5])
    await assert.rejects(
      collectExactHeadCheckInventory({ ...prInapplicableFixture(), pullRequestNumber }),
      /pull request identity/u,
    );
});

test('identical executed-source base requires the same head and zero comparison counts', async () => {
  const input = prInapplicableFixture({ baseSha: SHA });
  assert.equal(inventoryCheckBlocker(await collectExactHeadCheckInventory(input), SHA), null);
  const invalid = prInapplicableFixture({
    baseSha: SHA,
    mutate: ({ result }) => {
      if (result.merge_base_commit) {
        result.status = 'ahead';
        result.ahead_by = 1;
        result.total_commits = 1;
      }
    },
  });
  assert.match(
    inventoryCheckBlocker(await collectExactHeadCheckInventory(invalid), SHA),
    /skipped/u,
  );
});

test('source guards must be consistently successful in the same joined attempt', async () => {
  for (const [status, conclusion] of [
    ['completed', 'failure'],
    ['completed', 'cancelled'],
    ['completed', 'skipped'],
    ['in_progress', null],
  ]) {
    const input = prInapplicableFixture();
    for (const row of [...input.checks, ...[...input.jobs.values()].flat()]) {
      if (row.name !== 'source') continue;
      row.status = status;
      row.conclusion = conclusion;
      row.completed_at = status === 'completed' ? '2026-10-18T00:01:00Z' : null;
    }
    const inventory = await collectExactHeadCheckInventory(input);
    const browser = inventory.checkRuns.find((row) => row.name === 'browser');
    assert(inventoryCheckBlocker(inventory, SHA));
    assert.notEqual(
      inventory.provenance.find((row) => row.checkId === browser.id)?.role,
      'inapplicable-skip',
    );
  }
  const missing = prInapplicableFixture();
  missing.checks.splice(
    missing.checks.findIndex((row) => row.name === 'source'),
    1,
  );
  const nativeJobs = missing.jobs.get(missing.runs.at(-1).id);
  nativeJobs.splice(
    nativeJobs.findIndex((row) => row.name === 'source'),
    1,
  );
  const inventory = await collectExactHeadCheckInventory(missing);
  assert.match(inventoryCheckBlocker(inventory, SHA), /browser.*skipped/u);
  assert.equal(
    inventory.provenance.some((row) => row.role === 'inapplicable-skip'),
    false,
  );
});

test('every ambiguous matrix sibling must be skipped before its shared name is inapplicable', async () => {
  for (const conclusion of ['success', 'failure']) {
    const input = prInapplicableFixture({
      workflowPath: '.github/workflows/solo-native-package-consumer.yml',
    });
    const siblings = input.checks.filter((row) => row.name === 'matrix.engine');
    assert.equal(siblings.length, 2);
    siblings[1].conclusion = conclusion;
    const jobs = input.jobs.get(input.runs.at(-1).id).filter((row) => row.name === 'matrix.engine');
    jobs[1].conclusion = conclusion;
    const inventory = await collectExactHeadCheckInventory(input);
    assert(inventoryCheckBlocker(inventory, SHA));
    for (const sibling of siblings)
      assert.notEqual(
        inventory.provenance.find((row) => row.checkId === sibling.id)?.role,
        'inapplicable-skip',
      );
  }
});

test('a valid alternate recorded base still fails the complete-sweep stability check', async () => {
  const input = prInapplicableFixture({
    allowRecordedBaseDrift: true,
    mutate: ({ result, sweep }) => {
      if (sweep === 2 && result.workflow_runs)
        result.workflow_runs.at(-1).pull_requests[0].base.sha = 'd'.repeat(40);
    },
  });
  await assert.rejects(
    collectExactHeadCheckInventory(input),
    /inventory changed between complete sweeps/u,
  );
  assert.equal(input.calls.filter((route) => route.includes('/compare/')).length, 2);
});
