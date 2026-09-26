import assert from "node:assert/strict";
import test from "node:test";
import {
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

test("arms exact-head auto-merge only for an admitted clean PR", () => {
  assert.deepEqual(decideMergeAction(fixture()), {
    action: "arm",
    reason: "exact head is admitted and merge-ready",
  });
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
  assert.equal(decideMergeAction(input).action, "arm");
});

test("dependency references are explicit and deduplicated by the caller", () => {
  assert.deepEqual(
    dependencyNumbers("Depends on #573\nBlocked by #576"),
    [573, 576],
  );
});
