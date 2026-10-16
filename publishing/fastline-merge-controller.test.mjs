import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  POLICY_FILES,
  admissionBinding,
  validationPolicyDigest,
} from "./admission-binding.mjs";
import test from "node:test";
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
} from "./fastline-merge-controller.mjs";

const SHA = "1".repeat(40);
function fixture(overrides = {}) {
  return {
    pullRequest: {
      head: { sha: SHA },
      milestone: null,
      labels: [],
      draft: false,
      state: "open",
      mergeable: true,
      mergeable_state: "clean",
      review_decision: "APPROVED",
      auto_merge: null,
      ...overrides,
    },
    observedHeadSha: SHA,
    requiredCheck: {
      status: "completed",
      conclusion: "success",
      head_sha: SHA,
      admissionMatches: true,
    },
    checkRuns: [
      {
        id: 1,
        name: "release-ready",
        status: "completed",
        conclusion: "success",
        head_sha: SHA,
      },
    ],
    dependencies: [],
  };
}

test("merges an admitted clean exact head through branch protection", () => {
  assert.deepEqual(decideMergeAction(fixture()), {
    action: "merge",
    reason: "exact head is admitted and immediately mergeable",
  });
});

test("pending and failed exact-head checks block a merge even when GitHub calls it unstable", () => {
  for (const [status, conclusion] of [
    ["in_progress", null],
    ["completed", "failure"],
    ["completed", "cancelled"],
  ]) {
    const input = fixture({ mergeable_state: "unstable" });
    input.checkRuns.push({
      id: 2,
      name: "candidate",
      status,
      conclusion,
      head_sha: SHA,
    });
    assert.equal(decideMergeAction(input).action, "wait");
  }
});

test("only policy-selected source jobs may be skipped without claiming a pass", () => {
  const input = fixture();
  input.checkRuns.push({
    id: 2,
    name: "test",
    status: "completed",
    conclusion: "skipped",
    head_sha: SHA,
  });
  assert.equal(decideMergeAction(input).action, "merge");
  input.checkRuns.push({
    id: 3,
    name: "candidate",
    status: "completed",
    conclusion: "skipped",
    head_sha: SHA,
  });
  assert.match(decideMergeAction(input).reason, /candidate concluded skipped/);
});

test("latest check attempt wins and the running controller does not deadlock itself", () => {
  assert.equal(
    exactHeadCheckBlocker(
      [
        {
          id: 1,
          name: "preview",
          status: "completed",
          conclusion: "success",
          head_sha: SHA,
        },
        {
          id: 2,
          name: "preview",
          status: "in_progress",
          conclusion: null,
          head_sha: SHA,
        },
        {
          id: 3,
          name: "reconcile",
          status: "in_progress",
          conclusion: null,
          head_sha: SHA,
        },
      ],
      SHA,
    ),
    "preview is in_progress on the exact head",
  );
});

test("a truncated exact-head check inventory fails closed", () => {
  const input = fixture();
  input.checkInventoryComplete = false;
  assert.deepEqual(decideMergeAction(input), {
    action: "wait",
    reason: "exact-head check inventory is incomplete",
  });
});

test("pending protected hooks arm auto-merge for the exact head", () => {
  assert.equal(
    decideMergeAction(fixture({ mergeable_state: "has_hooks" })).action,
    "arm",
  );
});

test("updates a behind conflict-free branch before auto-merge", () => {
  assert.equal(
    decideMergeAction(fixture({ mergeable_state: "behind" })).action,
    "update",
  );
});

test("changed heads invalidate admission and disarm an existing request", () => {
  const input = fixture({ auto_merge: { enabled_at: "now" } });
  input.observedHeadSha = "2".repeat(40);
  assert.deepEqual(decideMergeAction(input), {
    action: "disarm",
    reason: "head changed after inspection",
  });
});

test("a failed required rerun disarms an already admitted exact head", () => {
  const input = fixture({ auto_merge: { enabled_at: "now" } });
  input.requiredCheck.conclusion = "failure";
  assert.deepEqual(decideMergeAction(input), {
    action: "disarm",
    reason: "release-ready is not successful on the exact head",
  });
});

test("missing or stale admission receipts disarm even a successful exact head", () => {
  const input = fixture({ auto_merge: { enabled_at: "now" } });
  for (const admissionMatches of [false, undefined]) {
    input.requiredCheck.admissionMatches = admissionMatches;
    assert.equal(decideMergeAction(input).action, "disarm");
  }
});

test("draft and closed PRs fail closed and disarm existing auto-merge", () => {
  for (const overrides of [
    { draft: true },
    { state: "closed" },
    { state: undefined },
  ]) {
    assert.equal(decideMergeAction(fixture(overrides)).action, "wait");
    assert.equal(
      decideMergeAction(fixture({ ...overrides, auto_merge: {} })).action,
      "disarm",
    );
  }
});

test("labels, milestones and review state do not change exact-head admission", () => {
  for (const overrides of [
    { labels: [{ name: "hold: ux" }, { name: "release-train-hold" }] },
    { milestone: { title: "v0.133.0" } },
    { review_decision: "CHANGES_REQUESTED" },
  ])
    assert.equal(decideMergeAction(fixture(overrides)).action, "merge");
});

function policyFixture() {
  const approval = structuredClone(REVIEWED_POLICY_CHANGES[0]);
  return {
    repository: approval.repository,
    pullRequest: {
      number: approval.number,
      head: { sha: approval.headSha, repo: { full_name: approval.repository } },
      base: {
        sha: approval.baseSha,
        ref: "main",
        repo: { full_name: approval.repository },
      },
    },
    trustedPolicyBlobs: approval.trustedPolicyBlobs,
    candidatePolicyBlobs: approval.candidatePolicyBlobs,
    changedPaths: approval.paths,
    receiptPaths: approval.paths,
    trustedPolicyDigest: approval.trustedPolicyDigest,
  };
}

test("actual receipt verification retains trusted policy, provenance and complete-path gates", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "policy-admission-test-"),
  );
  try {
    const approval = structuredClone(REVIEWED_POLICY_CHANGES[0]);
    approval.trustedPolicyBlobs = [];
    for (const name of POLICY_FILES) {
      const bytes = Buffer.from(`trusted fixture ${name}\n`);
      await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
      await fs.writeFile(path.join(root, name), bytes);
      approval.trustedPolicyBlobs.push([
        name,
        createHash("sha1")
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest("hex"),
      ]);
    }
    approval.candidatePolicyBlobs = approval.trustedPolicyBlobs.map(
      ([name, oid]) => [
        name,
        name === "publishing/focused-test-map.json" ? "c".repeat(40) : oid,
      ],
    );
    const pull = {
      number: approval.number,
      changed_files: approval.paths.length,
      head: { sha: approval.headSha, repo: { full_name: approval.repository } },
      base: {
        sha: approval.baseSha,
        ref: "main",
        repo: { full_name: approval.repository },
      },
    };
    const policyDigest = await validationPolicyDigest(root);
    approval.trustedPolicyDigest = policyDigest;
    approval.approvedPolicyDigest = "e".repeat(64);
    const originalReceipt = admissionBinding(pull, {
      workflowRevision: SHA,
      policyDigest: approval.approvedPolicyDigest,
      paths: approval.paths,
    });
    const run = {
      id: 123,
      run_attempt: 1,
      event: "pull_request",
      path: ".github/workflows/deploy-pages.yml",
      head_sha: pull.head.sha,
    };
    const check = () => ({
      app: { slug: "github-actions" },
      details_url:
        "https://github.com/mekhovov/revealline/actions/runs/123/job/456",
    });
    let receipt = originalReceipt,
      artifacts = [
        {
          id: 987,
          name: "admission-123-1",
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
        if (endpoint.endsWith("/actions/runs/123")) return run;
        if (endpoint.endsWith("/artifacts?per_page=100")) return { artifacts };
        if (endpoint.includes("/files?")) return rows;
        throw new Error(`Unexpected API ${endpoint}`);
      },
      graph: async () => ({
        repository: Object.fromEntries(
          candidate.map(([, oid], i) => [`p${i}`, { oid }]),
        ),
      }),
      download: async () => {
        await fs.writeFile(
          path.join(root, "admission.json"),
          JSON.stringify(receipt),
        );
        execFileSync("zip", ["-q", "receipt.zip", "admission.json"], {
          cwd: root,
        });
        return {
          ok: true,
          arrayBuffer: async () => fs.readFile(path.join(root, "receipt.zip")),
        };
      },
    };
    const verify = () =>
      checkedAdmission("mekhovov", "revealline", check(), pull, options);
    // The original all-blobs-equal rule rejects this exact approved difference.
    assert.notDeepEqual(approval.trustedPolicyBlobs, candidate);
    options.approvals = [];
    assert.equal(await verify(), false);
    options.approvals = [approval];
    assert.equal(await verify(), true);
    assert.ok(calls.some((endpoint) => endpoint.includes("/files?")));
    receipt = { ...originalReceipt, policyDigest: "f".repeat(64) };
    assert.equal(
      await verify(),
      false,
      "approval must not waive trusted receipt policy",
    );
    receipt = { ...originalReceipt, headSha: "f".repeat(40) };
    assert.equal(await verify(), false);
    receipt = originalReceipt;
    rows = rows.slice(1);
    await assert.rejects(verify(), /Incomplete/);
    rows = approval.paths.map((filename) => ({ filename }));
    rows[0].previous_filename = "publishing/fastline-merge-controller.mjs";
    assert.equal(
      await verify(),
      false,
      "rename source must be independently included",
    );
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
    run.head_sha = "f".repeat(40);
    assert.equal(await verify(), false);
    run.head_sha = pull.head.sha;
    candidate = approval.trustedPolicyBlobs;
    options.approvals = [];
    receipt = { ...originalReceipt, policyDigest };
    assert.equal(
      await verify(),
      true,
      "unchanged policies still use the ordinary path",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("only the exact reviewed source, complete policy and actual changed paths are approved", () => {
  assert.equal(reviewedPolicyChangeMatches(policyFixture()), true);
  for (const mutate of [
    (x) => (x.repository = "attacker/revealline"),
    (x) => x.pullRequest.number++,
    (x) => (x.pullRequest.head.sha = "a".repeat(40)),
    (x) => (x.pullRequest.base.sha = "b".repeat(40)),
    (x) => (x.pullRequest.base.ref = "other"),
    (x) => (x.pullRequest.head.repo.full_name = "attacker/revealline"),
    (x) => (x.pullRequest.base.repo.full_name = "attacker/revealline"),
    (x) => (x.trustedPolicyBlobs[0][1] = "a".repeat(40)),
    (x) => (x.candidatePolicyBlobs[0][1] = "a".repeat(40)),
    (x) => (x.candidatePolicyBlobs[4][1] = "b".repeat(40)),
    (x) => (x.trustedPolicyDigest = "f".repeat(64)),
    (x) => x.trustedPolicyBlobs.pop(),
    (x) => x.candidatePolicyBlobs.push(x.candidatePolicyBlobs[0]),
    (x) => (x.candidatePolicyBlobs[0][0] = "../policy"),
    (x) => x.changedPaths.pop(),
    (x) => x.changedPaths.push("publishing/fastline-merge-controller.mjs"),
    (x) => x.changedPaths.push(x.changedPaths[0]),
    (x) => x.receiptPaths.pop(),
    (x) => x.receiptPaths.push("other"),
  ]) {
    const input = policyFixture();
    mutate(input);
    assert.equal(reviewedPolicyChangeMatches(input), false);
  }
});

test("manual stack workflow exception is confined to its immutable reviewed identity", () => {
  for (const name of [
    ".github/workflows/deploy-pages.yml",
    ".github/workflows/fastline-auto-merge.yml",
    ".github/workflows/other.yml",
    ".github/other",
    "publishing/fastline-merge-controller.mjs",
  ]) {
    const input = policyFixture();
    const approvals = structuredClone(REVIEWED_POLICY_CHANGES);
    const paths = [...input.changedPaths, name].sort();
    input.changedPaths = paths;
    input.receiptPaths = paths;
    approvals[0].paths = paths;
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false, name);
  }
  for (const field of ["repository", "number", "headSha", "baseSha"]) {
    const input = policyFixture();
    const approvals = structuredClone(REVIEWED_POLICY_CHANGES);
    const value =
      field === "repository"
        ? "other/repo"
        : field === "number"
          ? 1559
          : "a".repeat(40);
    approvals[0][field] = value;
    if (field === "repository") {
      input.repository = value;
      input.pullRequest.head.repo.full_name = value;
      input.pullRequest.base.repo.full_name = value;
    } else if (field === "number") input.pullRequest.number = value;
    else if (field === "headSha") input.pullRequest.head.sha = value;
    else input.pullRequest.base.sha = value;
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false, field);
  }
  for (const index of [0, 1, 2, 3, 5, 6]) {
    const input = policyFixture();
    const approvals = structuredClone(REVIEWED_POLICY_CHANGES);
    input.candidatePolicyBlobs[index][1] = "d".repeat(40);
    approvals[0].candidatePolicyBlobs[index][1] = "d".repeat(40);
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false);
  }
});

test("approval inventory is strict, unique and cannot come from candidate input", () => {
  const input = policyFixture();
  for (const approvals of [
    [],
    null,
    [...REVIEWED_POLICY_CHANGES, ...REVIEWED_POLICY_CHANGES],
  ])
    assert.equal(reviewedPolicyChangeMatches(input, approvals), false);
  const bad = structuredClone(REVIEWED_POLICY_CHANGES);
  bad[0].extra = "not permitted";
  assert.equal(reviewedPolicyChangeMatches(input, bad), false);
  assert.equal(reviewedPolicyChangeMatches({ ...input, approvals: [] }), false);
  assert.equal(reviewedPolicyChangeMatches(null), false);
});

test("main freshness requires exact valid checkout and live branch identities", () => {
  assert.equal(trustedMainMatches(SHA, SHA), true);
  for (const values of [
    [SHA, "2".repeat(40)],
    [undefined, undefined],
    ["main", "main"],
    [SHA.toUpperCase(), "f".repeat(40)],
  ])
    assert.equal(trustedMainMatches(...values), false);
});

test("final mutation snapshot rechecks exact approval identities, main, checks and dependencies", () => {
  const policy = policyFixture();
  const pull = {
    ...policy.pullRequest,
    state: "open",
    draft: false,
    mergeable: true,
    mergeable_state: "clean",
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
    name: "release-ready",
    head_sha: pull.head.sha,
    status: "completed",
    conclusion: "success",
    admissionReceipt: receipt,
    policyDigest,
    approvedPolicyContext,
  };
  const fixture = () =>
    structuredClone({
      controllerMainSha: SHA,
      liveMainSha: SHA,
      previousDecision: { action: "merge" },
      pullRequest: pull,
      requiredCheck: required,
      freshChecks: { total_count: 1, check_runs: [structuredClone(required)] },
      observedHeadSha: pull.head.sha,
      dependencies: [],
    });
  assert.equal(mutationSnapshotMatches(fixture()), true);
  const retargeted = structuredClone(pull);
  retargeted.base.ref = "other-branch-at-the-same-sha";
  assert.equal(freshAdmissionMatches(required, retargeted), false);
  for (const mutate of [
    (x) => (x.liveMainSha = "f".repeat(40)),
    (x) => (x.pullRequest.head.sha = "f".repeat(40)),
    (x) => (x.pullRequest.base.sha = "f".repeat(40)),
    (x) => (x.pullRequest.base.ref = "other-branch-at-the-same-sha"),
    (x) => (x.pullRequest.head.repo.full_name = "other/repository"),
    (x) => (x.pullRequest.base.repo.full_name = "other/repository"),
    (x) => (x.pullRequest.draft = true),
    (x) => (x.pullRequest.state = "closed"),
    (x) => (x.freshChecks.total_count = 2),
    (x) => x.freshChecks.check_runs[0].id++,
    (x) => (x.freshChecks.check_runs[0].conclusion = "failure"),
    (x) => (x.freshChecks.check_runs[0].status = "in_progress"),
    (x) =>
      x.freshChecks.check_runs.push({
        id: 20,
        name: "candidate",
        head_sha: pull.head.sha,
        status: "in_progress",
      }),
    (x) => x.dependencies.push({ number: 1, merged_at: null }),
  ]) {
    const input = fixture();
    mutate(input);
    assert.equal(mutationSnapshotMatches(input), false, String(mutate));
  }
});

test("declared dependencies must already be merged", () => {
  const input = fixture();
  input.dependencies = [{ number: 573, merged_at: null }];
  assert.equal(
    decideMergeAction(input).reason,
    "declared predecessor is not merged",
  );
  input.dependencies[0].merged_at = "2026-09-26T00:00:00Z";
  assert.equal(decideMergeAction(input).action, "merge");
});

test("only explicitly labeled GitHub stacks use the asynchronous merge endpoint", () => {
  assert.equal(
    decideMergeAction(
      fixture({
        labels: [{ name: "fastline-stack-merge" }],
        stack: { number: 7, size: 2, position: 2 },
      }),
    ).action,
    "stack",
  );
  assert.equal(
    decideMergeAction(
      fixture({
        labels: [{ name: "fastline-stack-merge" }],
      }),
    ).action,
    "merge",
  );
});

test("stacked merge payload and polling results remain exact and fail closed", () => {
  assert.deepEqual(asynchronousMergeRequest(SHA), {
    sha: SHA,
    merge_method: "merge",
    merge_action: "default",
    bypass_rules: false,
  });
  assert.throws(() => asynchronousMergeRequest("main"), /exact 40-character/);
  assert.deepEqual(
    asynchronousMergeResult({ status: "pending", details: {} }),
    {
      done: false,
      merged: false,
    },
  );
  assert.deepEqual(
    asynchronousMergeResult({ status: "merged", details: { sha: SHA } }),
    {
      done: true,
      merged: true,
      sha: SHA,
    },
  );
  assert.deepEqual(
    asynchronousMergeResult({
      status: "failed",
      details: { message: "blocked" },
    }),
    { done: true, merged: false, reason: "blocked" },
  );
});

test("only GitHub's stack-only endpoint rejection switches merge APIs", () => {
  assert.equal(
    isStackOnlyMergeError({
      status: 403,
      data: {
        message:
          "Merging stacked PRs via this endpoint is not supported. Use the asynchronous merge endpoint instead.",
      },
    }),
    true,
  );
  for (const error of [
    { status: 403, data: { message: "Branch protection denied merge." } },
    {
      status: 403,
      data: { message: "Resource not accessible by integration" },
    },
    { status: 409, data: { message: "Conflict" } },
  ])
    assert.equal(isStackOnlyMergeError(error), false);
});

test("a controller-owned merge dispatches the rolling Pages workflow from main", () => {
  assert.deepEqual(mainPagesDispatchRequest(), { ref: "main" });
});

test("dependency references are explicit and deduplicated by the caller", () => {
  assert.deepEqual(
    dependencyNumbers("Depends on #573\nBlocked by #576"),
    [573, 576],
  );
});

test("the privileged workflow is a safe no-op until the trusted controller reaches main", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/fastline-auto-merge.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /Record one-time controller bootstrap/);
  assert.match(workflow, /opened,/);
  assert.match(workflow, /reopened,/);
  assert.match(workflow, /filter: blob:none/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.doesNotMatch(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /actions: write/);
  assert.match(
    workflow,
    /if: hashFiles\('publishing\/fastline-merge-controller\.mjs'\) == ''/,
  );
  assert.match(
    workflow,
    /if: hashFiles\('publishing\/fastline-merge-controller\.mjs'\) != ''/,
  );
});
