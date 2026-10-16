import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asynchronousMergeRequest,
  asynchronousMergeResult,
  decideMergeAction,
  dependencyNumbers,
  exactHeadCheckBlocker,
  isStackOnlyMergeError,
  mainPagesDispatchRequest,
} from "./fastline-merge-controller.mjs";

const SHA = "1".repeat(40);
function fixture(overrides = {}) {
  return {
    pullRequest: {
      head: { sha: SHA },
      milestone: null,
      labels: [],
      draft: false,
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
    checkRuns: [{ id: 1, name: "release-ready", status: "completed", conclusion: "success", head_sha: SHA }],
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
    input.checkRuns.push({ id: 2, name: "candidate", status, conclusion, head_sha: SHA });
    assert.equal(decideMergeAction(input).action, "wait");
  }
});

test("only policy-selected source jobs may be skipped without claiming a pass", () => {
  const input = fixture();
  input.checkRuns.push({ id: 2, name: "test", status: "completed", conclusion: "skipped", head_sha: SHA });
  assert.equal(decideMergeAction(input).action, "merge");
  input.checkRuns.push({ id: 3, name: "candidate", status: "completed", conclusion: "skipped", head_sha: SHA });
  assert.match(decideMergeAction(input).reason, /candidate concluded skipped/);
});

test("latest check attempt wins and the running controller does not deadlock itself", () => {
  assert.equal(exactHeadCheckBlocker([
    { id: 1, name: "preview", status: "completed", conclusion: "success", head_sha: SHA },
    { id: 2, name: "preview", status: "in_progress", conclusion: null, head_sha: SHA },
    { id: 3, name: "reconcile", status: "in_progress", conclusion: null, head_sha: SHA },
  ], SHA), "preview is in_progress on the exact head");
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

test("drafts, labels, milestones and review state do not block an exact-head merge", () => {
  for (const overrides of [
    { draft: true },
    { labels: [{ name: "hold: ux" }, { name: "release-train-hold" }] },
    { milestone: { title: "v0.133.0" } },
    { review_decision: "CHANGES_REQUESTED" },
  ]) assert.equal(decideMergeAction(fixture(overrides)).action, "merge");
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
        labels: [
          { name: "fastline-stack-merge" },
        ],
        stack: { number: 7, size: 2, position: 2 },
      }),
    ).action,
    "stack",
  );
  assert.equal(
    decideMergeAction(
      fixture({
        labels: [
          { name: "fastline-stack-merge" },
        ],
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
    { done: true, merged: true, sha: SHA },
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
    { status: 403, data: { message: "Resource not accessible by integration" } },
    { status: 409, data: { message: "Conflict" } },
  ]) assert.equal(isStackOnlyMergeError(error), false);
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
