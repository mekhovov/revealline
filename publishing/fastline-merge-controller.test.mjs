import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  asynchronousMergeRequest,
  asynchronousMergeResult,
  decideMergeAction,
  dependencyNumbers,
} from "./fastline-merge-controller.mjs";

const SHA = "1".repeat(40);
function fixture(overrides = {}) {
  return {
    pullRequest: {
      head: { sha: SHA },
      milestone: { title: "v0.132.0" },
      labels: [{ name: "fastline-approved" }],
      draft: false,
      mergeable: true,
      mergeable_state: "clean",
      review_decision: "APPROVED",
      auto_merge: null,
      ...overrides,
    },
    observedHeadSha: SHA,
    activeMilestone: "v0.132.0",
    requiredCheck: {
      status: "completed",
      conclusion: "success",
      head_sha: SHA,
    },
    dependencies: [],
  };
}

test("merges an admitted clean exact head through branch protection", () => {
  assert.deepEqual(decideMergeAction(fixture()), {
    action: "merge",
    reason: "exact head is admitted and immediately mergeable",
  });
});

test("nonblocking failed checks do not block an exact-head merge", () => {
  assert.equal(
    decideMergeAction(fixture({ mergeable_state: "unstable" })).action,
    "merge",
  );
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

test("holds, drafts, milestone changes and review blockers do not merge", () => {
  assert.equal(decideMergeAction(fixture({ draft: true })).action, "wait");
  assert.equal(
    decideMergeAction(
      fixture({
        labels: [{ name: "fastline-approved" }, { name: "hold: ux" }],
      }),
    ).action,
    "wait",
  );
  assert.equal(
    decideMergeAction(fixture({ milestone: { title: "v0.133.0" } })).action,
    "wait",
  );
  assert.equal(
    decideMergeAction(fixture({ review_decision: "CHANGES_REQUESTED" })).action,
    "wait",
  );
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
          { name: "fastline-approved" },
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
          { name: "fastline-approved" },
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
  assert.match(workflow, /contents: write/);
  assert.match(
    workflow,
    /if: hashFiles\('publishing\/fastline-merge-controller\.mjs'\) == ''/,
  );
  assert.match(
    workflow,
    /if: hashFiles\('publishing\/fastline-merge-controller\.mjs'\) != ''/,
  );
});
