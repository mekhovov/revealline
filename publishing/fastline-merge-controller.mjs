#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  POLICY_FILES,
  sameAdmission,
  validationPolicyDigest,
} from "./admission-binding.mjs";

const STACK_MERGE_LABEL = "fastline-stack-merge";
// release-ready records the selected source policy. These jobs are deliberately
// skipped when that policy waives a full suite; a skip is never a test pass.
const POLICY_SKIPPED_JOBS = new Set(["focused", "test", "build"]);

// Reviewed, exact-source exceptions are trusted only because this module is
// loaded from main. Never load approvals from a pull request or an artifact.
const TRUSTED_POLICY_1553 = [
  [
    ".github/workflows/deploy-pages.yml",
    "fe9b921b9456a8ffa7bb79c9ee104206ac7a7f82",
  ],
  [
    "publishing/admission-binding.mjs",
    "bbc451129f21407143e4d3034d819711e5539dd2",
  ],
  [
    "publishing/admission-preflight.mjs",
    "9750b8dc5aef171f9124563966f726c2cbe15237",
  ],
  ["publishing/focused-tests.mjs", "403941412c35b2a61c2f67f611aa11d0b6d57467"],
  [
    "publishing/focused-test-map.json",
    "9d09a9d27d6d0ef7b68606b7d3d489968fc92530",
  ],
  ["publishing/test-policy.json", "e067e704a165e16e449761989e3e1b611dc35181"],
  ["publishing/test-policy.mjs", "aa9f1efc79301cd227dbe7eb874dcba6b601003c"],
];
export const REVIEWED_POLICY_CHANGES = [
  {
    repository: "mekhovov/revealline",
    number: 1553,
    headSha: "717f2ba6fec280d8bbf9ff3ac495648b95c5e4f2",
    baseSha: "facf1627e2bb039ee7e5a3b9d662ded4c4ef3368",
    paths: [
      "docs/pages-capacity-safe-plan-2026-10-15.md",
      "publishing/focused-test-map.json",
      "publishing/focused-tests.test.mjs",
      "scripts/pages-candidate-stack.mjs",
      "scripts/test-pages-candidate-stack.mjs",
    ],
    trustedPolicyBlobs: TRUSTED_POLICY_1553,
    candidatePolicyBlobs: TRUSTED_POLICY_1553.map(([name, oid]) => [
      name,
      name === "publishing/focused-test-map.json"
        ? "61a0b7a8f903a73a1ae5e5eeb26863b3b585f1f2"
        : oid,
    ]),
  },
];

const exactSha = (value) =>
  typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const exactKeys = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  equal(Object.keys(value).sort(), [...keys].sort());
const policyBlobsValid = (entries) =>
  Array.isArray(entries) &&
  entries.length === POLICY_FILES.length &&
  entries.every(
    (entry, index) =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      entry[0] === POLICY_FILES[index] &&
      exactSha(entry[1]),
  );
const pathsValid = (paths) =>
  Array.isArray(paths) &&
  paths.length > 0 &&
  paths.every(
    (name) =>
      typeof name === "string" &&
      /^[a-zA-Z0-9_.\/-]+$/u.test(name) &&
      !name.startsWith("/") &&
      !name.split("/").some((part) => !part || part === "." || part === ".."),
  ) &&
  equal(paths, [...new Set(paths)].sort());

export function trustedMainMatches(checkoutSha, liveSha) {
  return exactSha(checkoutSha) && checkoutSha === liveSha;
}

export function freshAdmissionMatches(check, pullRequest) {
  return (
    sameAdmission(check?.admissionReceipt, pullRequest, check?.policyDigest) &&
    (!check.approvedPolicyContext ||
      reviewedPolicyChangeMatches({
        ...check.approvedPolicyContext,
        pullRequest,
      }))
  );
}

export function mutationSnapshotMatches({
  controllerMainSha,
  liveMainSha,
  previousDecision,
  pullRequest,
  requiredCheck,
  freshChecks,
  observedHeadSha,
  dependencies,
}) {
  if (!trustedMainMatches(controllerMainSha, liveMainSha)) return false;
  const latest = freshChecks.check_runs
    .filter((check) => check.name === "release-ready")
    .sort((left, right) => right.id - left.id)[0];
  if (
    !latest ||
    latest.id !== requiredCheck?.id ||
    !freshAdmissionMatches(requiredCheck, pullRequest)
  )
    return false;
  const freshRequired = { ...latest, admissionMatches: true };
  const freshDecision = decideMergeAction({
    pullRequest,
    observedHeadSha,
    requiredCheck: freshRequired,
    checkRuns: freshChecks.check_runs,
    checkInventoryComplete:
      freshChecks.total_count <= freshChecks.check_runs.length,
    dependencies,
  });
  return (
    ["update", "stack", "merge", "arm"].includes(previousDecision.action) &&
    freshDecision.action === previousDecision.action
  );
}

export function reviewedPolicyChangeMatches(
  input,
  approvals = REVIEWED_POLICY_CHANGES,
) {
  if (
    !exactKeys(input, [
      "repository",
      "pullRequest",
      "trustedPolicyBlobs",
      "candidatePolicyBlobs",
      "changedPaths",
      "receiptPaths",
    ]) ||
    !Array.isArray(approvals) ||
    approvals.length !== 1 ||
    !policyBlobsValid(input.trustedPolicyBlobs) ||
    !policyBlobsValid(input.candidatePolicyBlobs) ||
    !pathsValid(input.changedPaths) ||
    !pathsValid(input.receiptPaths)
  )
    return false;
  const approval = approvals[0];
  if (
    !exactKeys(approval, [
      "repository",
      "number",
      "headSha",
      "baseSha",
      "paths",
      "trustedPolicyBlobs",
      "candidatePolicyBlobs",
    ]) ||
    !Number.isSafeInteger(approval.number) ||
    approval.number < 1 ||
    !exactSha(approval.headSha) ||
    !exactSha(approval.baseSha) ||
    !pathsValid(approval.paths) ||
    !policyBlobsValid(approval.trustedPolicyBlobs) ||
    !policyBlobsValid(approval.candidatePolicyBlobs)
  )
    return false;
  // This bounded first path supports only the reviewed test-map registration,
  // never controller/workflow/executable-policy changes through an exception.
  const differences = approval.trustedPolicyBlobs
    .filter(
      (entry, index) => !equal(entry, approval.candidatePolicyBlobs[index]),
    )
    .map(([name]) => name);
  if (
    !equal(differences, ["publishing/focused-test-map.json"]) ||
    approval.paths.includes("publishing/fastline-merge-controller.mjs") ||
    approval.paths.some((name) => name.startsWith(".github/"))
  )
    return false;
  const pull = input.pullRequest;
  return (
    input.repository === approval.repository &&
    pull?.number === approval.number &&
    pull.head?.sha === approval.headSha &&
    pull.base?.sha === approval.baseSha &&
    pull.base?.ref === "main" &&
    pull.head?.repo?.full_name === approval.repository &&
    pull.base?.repo?.full_name === approval.repository &&
    equal(input.trustedPolicyBlobs, approval.trustedPolicyBlobs) &&
    equal(input.candidatePolicyBlobs, approval.candidatePolicyBlobs) &&
    equal(input.changedPaths, approval.paths) &&
    equal(input.receiptPaths, approval.paths)
  );
}

export function exactHeadCheckBlocker(checkRuns = [], headSha) {
  const latest = new Map();
  for (const check of checkRuns) {
    // The controller cannot wait for its own currently running reconcile job.
    if (check.name === "reconcile") continue;
    if (check.head_sha && check.head_sha !== headSha)
      return `${check.name} belongs to a different head`;
    const previous = latest.get(check.name);
    if (!previous || check.id > previous.id) latest.set(check.name, check);
  }
  for (const check of latest.values()) {
    if (check.status !== "completed")
      return `${check.name} is ${check.status || "pending"} on the exact head`;
    if (
      check.conclusion !== "success" &&
      !(check.conclusion === "skipped" && POLICY_SKIPPED_JOBS.has(check.name))
    )
      return `${check.name} concluded ${check.conclusion || "without a result"} on the exact head`;
  }
  return null;
}

export function dependencyNumbers(body = "") {
  return [
    ...String(body).matchAll(/(?:depends on|blocked by)\s+#([1-9][0-9]*)/giu),
  ].map((match) => Number(match[1]));
}

export function decideMergeAction({
  pullRequest,
  observedHeadSha,
  requiredCheck,
  checkRuns = [],
  checkInventoryComplete = true,
  dependencies = [],
}) {
  const labels = new Set(
    (pullRequest.labels || []).map((label) => label.name || label),
  );
  const autoMergeEnabled = Boolean(pullRequest.auto_merge);
  const reason = (() => {
    if (!/^[0-9a-f]{40}$/u.test(observedHeadSha || ""))
      return "event has no exact head SHA";
    if (pullRequest.head?.sha !== observedHeadSha)
      return "head changed after inspection";
    if (pullRequest.state !== "open") return "pull request is not open";
    if (pullRequest.draft !== false)
      return "pull request is draft or draft state is unknown";
    if (dependencies.some((dependency) => !dependency.merged_at))
      return "declared predecessor is not merged";
    if (
      !requiredCheck ||
      requiredCheck.status !== "completed" ||
      requiredCheck.conclusion !== "success" ||
      requiredCheck.head_sha !== observedHeadSha
    )
      return "release-ready is not successful on the exact head";
    if (requiredCheck.admissionMatches !== true)
      return "source or admission metadata changed since the successful gate";
    if (!checkInventoryComplete)
      return "exact-head check inventory is incomplete";
    const checkBlocker = exactHeadCheckBlocker(checkRuns, observedHeadSha);
    if (checkBlocker) return checkBlocker;
    if (
      pullRequest.mergeable === false ||
      pullRequest.mergeable_state === "dirty"
    )
      return "pull request has conflicts";
    if (pullRequest.mergeable_state === "behind") return null;
    if (
      !["clean", "has_hooks", "unstable"].includes(pullRequest.mergeable_state)
    )
      return `mergeability is ${pullRequest.mergeable_state || "unknown"}`;
    return null;
  })();

  if (reason) return { action: autoMergeEnabled ? "disarm" : "wait", reason };
  if (pullRequest.mergeable_state === "behind")
    return {
      action: "update",
      reason: "strict main requires an exact-SHA branch update",
    };
  if (
    labels.has(STACK_MERGE_LABEL) &&
    pullRequest.stack &&
    Number.isSafeInteger(pullRequest.stack.number)
  )
    return {
      action: "stack",
      reason: "declared stack top passed the exact-head gate",
    };
  if (["clean", "unstable"].includes(pullRequest.mergeable_state))
    return {
      action: "merge",
      reason:
        pullRequest.mergeable_state === "clean"
          ? "exact head is admitted and immediately mergeable"
          : "exact head is admitted; only nonblocking checks are failing",
    };
  if (autoMergeEnabled)
    return { action: "none", reason: "exact-head auto-merge is already armed" };
  return {
    action: "arm",
    reason: "exact head is admitted; protected auto-merge may proceed",
  };
}

export function asynchronousMergeRequest(headSha) {
  if (!/^[0-9a-f]{40}$/u.test(headSha || ""))
    throw new TypeError("An exact 40-character head SHA is required.");
  return {
    sha: headSha,
    merge_method: "merge",
    merge_action: "default",
    bypass_rules: false,
  };
}

export function isStackOnlyMergeError(error) {
  return (
    error?.status === 403 &&
    error?.data?.message ===
      "Merging stacked PRs via this endpoint is not supported. Use the asynchronous merge endpoint instead."
  );
}

// Pull-request merges made with the workflow token do not emit a second
// `push` workflow run. Dispatch the rolling Pages build deliberately after a
// controller-owned merge so public play always follows protected main.
export function mainPagesDispatchRequest() {
  return { ref: "main" };
}

export function asynchronousMergeResult(value) {
  const status = value?.status;
  if (status === "pending") return { done: false, merged: false };
  if (status === "merged")
    return { done: true, merged: true, sha: value?.details?.sha || null };
  return {
    done: true,
    merged: false,
    reason:
      value?.details?.message || `asynchronous merge ${status || "failed"}`,
  };
}

async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      "x-github-api-version": "2026-03-10",
      "user-agent": "revealline-fastline-controller",
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(
      `GitHub ${response.status} ${pathname}: ${text.slice(0, 1000)}`,
    );
    error.status = response.status;
    error.body = text;
    try {
      error.data = text ? JSON.parse(text) : null;
    } catch {
      error.data = null;
    }
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

async function mergeStack(owner, repository, pullRequest, headSha) {
  let requested;
  try {
    requested = await github(
      `/repos/${owner}/${repository}/pulls/${pullRequest.number}/merge-async`,
      {
        method: "PUT",
        body: JSON.stringify(asynchronousMergeRequest(headSha)),
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    // A duplicate request returns its existing UUID as a 409. Continue that
    // exact request; every other rejection fails closed. GitHub does not
    // support auto-merge for stacks, so arming the top PR is not a valid
    // fallback.
    if (error?.status !== 409) throw error;
    requested = error.data;
  }
  if (requested?.status === "merged") return true;
  const uuid = requested?.details?.uuid || requested?.uuid;
  if (typeof uuid !== "string" || !/^[0-9a-f-]{20,80}$/iu.test(uuid))
    return false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const value = await github(
      `/repos/${owner}/${repository}/pulls/${pullRequest.number}/merge-async/${uuid}`,
    );
    const result = asynchronousMergeResult(value);
    if (result.done) {
      if (!result.merged) throw new Error(result.reason);
      return true;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(15000, 1000 * 2 ** attempt)),
    );
  }
  throw new Error(
    "Asynchronous stacked merge did not finish within the bounded poll window.",
  );
}

async function dispatchMainPages(owner, repository) {
  await github(
    `/repos/${owner}/${repository}/actions/workflows/publish-main-pages.yml/dispatches`,
    {
      method: "POST",
      body: JSON.stringify(mainPagesDispatchRequest()),
      headers: { "content-type": "application/json" },
    },
  );
}

async function graphql(query, variables) {
  const result = await github("/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
    headers: { "content-type": "application/json" },
  });
  if (result.errors?.length)
    throw new Error(`GraphQL: ${JSON.stringify(result.errors)}`);
  return result.data;
}

async function setAutoMerge(pullRequest, action, headSha) {
  if (action === "arm")
    return graphql(
      `
        mutation ($id: ID!, $head: GitObjectID!) {
          enablePullRequestAutoMerge(
            input: {
              pullRequestId: $id
              mergeMethod: MERGE
              expectedHeadOid: $head
            }
          ) {
            pullRequest {
              number
            }
          }
        }
      `,
      { id: pullRequest.node_id, head: headSha },
    );
  if (action === "disarm")
    return graphql(
      `
        mutation ($id: ID!) {
          disablePullRequestAutoMerge(input: { pullRequestId: $id }) {
            pullRequest {
              number
            }
          }
        }
      `,
      { id: pullRequest.node_id },
    );
}

async function appendSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `${lines.join("\n")}\n`,
    );
}

async function upsertStatusComment(
  owner,
  repository,
  pullRequest,
  decision,
  observedHeadSha,
) {
  const marker = "<!-- fastline-controller-status -->";
  const dependencies = [...new Set(dependencyNumbers(pullRequest.body))];
  const nextAction = {
    arm: "GitHub auto-merge is being armed for this exact head.",
    disarm:
      "Existing auto-merge is being disarmed until the blocker is resolved.",
    update:
      "The branch is being updated from strict main; checks must pass again on the new head.",
    stack:
      "The declared GitHub stack is being submitted through the asynchronous exact-head endpoint.",
    merge:
      "The clean exact head is being submitted through the protected merge endpoint.",
    none: "No action: exact-head auto-merge is already armed.",
    wait: "Resolve the blocker, then rerun `release-ready` on the resulting exact head.",
  }[decision.action];
  const body = [
    marker,
    "### Fastline queue status",
    "",
    `- Purpose: ${pullRequest.title}`,
    `- Target: ${pullRequest.milestone?.title || "unassigned"}`,
    `- Predecessor: ${dependencies.length ? dependencies.map((number) => `#${number}`).join(", ") : "none declared"}`,
    `- Blocker/status: ${decision.reason}`,
    `- Checked SHA: \`${observedHeadSha || "none"}\``,
    `- Next: ${nextAction}`,
    "",
    "_This single bot-owned comment is updated in place._",
  ].join("\n");
  let existing = null;
  for (let page = 1; page <= 10 && !existing; page++) {
    const comments = await github(
      `/repos/${owner}/${repository}/issues/${pullRequest.number}/comments?per_page=100&page=${page}`,
    );
    existing = comments.find((comment) => comment.body?.includes(marker));
    if (comments.length < 100) break;
  }
  if (existing?.body === body) return;
  await github(
    existing
      ? `/repos/${owner}/${repository}/issues/comments/${existing.id}`
      : `/repos/${owner}/${repository}/issues/${pullRequest.number}/comments`,
    {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({ body }),
      headers: { "content-type": "application/json" },
    },
  );
}

async function main() {
  if (!process.env.GH_TOKEN) throw new Error("GH_TOKEN is required.");
  const event = JSON.parse(
    await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const workflowPull = event.workflow_run?.pull_requests?.[0];
  const [owner, repository] = process.env.GITHUB_REPOSITORY.split("/");
  const controllerRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const controllerMainSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: controllerRoot,
    encoding: "utf8",
    timeout: 10_000,
  }).trim();
  const initialMain = await github(
    `/repos/${owner}/${repository}/git/ref/heads/main`,
  );
  if (!trustedMainMatches(controllerMainSha, initialMain.object?.sha))
    throw new Error(
      "Trusted controller checkout is not current main; no mutation permitted.",
    );
  const observedHeadSha =
    event.pull_request?.head?.sha ||
    workflowPull?.head?.sha ||
    event.workflow_run?.head_sha;
  let number = event.pull_request?.number || workflowPull?.number;
  if (
    !Number.isSafeInteger(number) &&
    /^[0-9a-f]{40}$/u.test(observedHeadSha || "")
  ) {
    const associated = await github(
      `/repos/${owner}/${repository}/commits/${observedHeadSha}/pulls?per_page=100`,
    );
    const candidates = associated.filter(
      (candidate) =>
        candidate.state === "open" &&
        candidate.base?.ref === "main" &&
        candidate.head?.sha === observedHeadSha,
    );
    if (candidates.length !== 1) return;
    number = candidates[0].number;
  }
  if (!Number.isSafeInteger(number)) return;
  const pullRequest = await github(
    `/repos/${owner}/${repository}/pulls/${number}`,
  );
  const checks = await github(
    `/repos/${owner}/${repository}/commits/${pullRequest.head.sha}/check-runs?per_page=100`,
  );
  const requiredCheck = checks.check_runs
    .filter((check) => check.name === "release-ready")
    // A new queued/in-progress gate supersedes an older successful one too.
    .sort((left, right) => right.id - left.id)[0];
  // Never relabel a check from another commit as an exact-head success.
  if (requiredCheck?.conclusion === "success") {
    try {
      requiredCheck.admissionMatches = await checkedAdmission(
        owner,
        repository,
        requiredCheck,
        pullRequest,
      );
    } catch (error) {
      requiredCheck.admissionMatches = false;
      await appendSummary([`Admission receipt rejected: ${error.message}`]);
    }
  }
  const dependencyIds = [
    ...new Set(dependencyNumbers(pullRequest.body)),
  ].filter((dependency) => dependency !== number);
  const dependencies = [];
  for (const dependency of dependencyIds)
    dependencies.push(
      await github(`/repos/${owner}/${repository}/pulls/${dependency}`),
    );
  const decision = decideMergeAction({
    pullRequest,
    observedHeadSha,
    requiredCheck,
    checkRuns: checks.check_runs,
    checkInventoryComplete: checks.total_count <= checks.check_runs.length,
    dependencies,
  });
  await appendSummary([
    "### Fastline merge controller",
    "",
    `PR: #${number}`,
    `Observed head: \`${observedHeadSha || "none"}\``,
    `Decision: **${decision.action}** — ${decision.reason}`,
  ]);
  await upsertStatusComment(
    owner,
    repository,
    pullRequest,
    decision,
    observedHeadSha,
  );
  if (["update", "stack", "merge", "arm"].includes(decision.action)) {
    const fresh = await github(`/repos/${owner}/${repository}/pulls/${number}`);
    const freshChecks = await github(
      `/repos/${owner}/${repository}/commits/${fresh.head.sha}/check-runs?per_page=100`,
    );
    const freshDependencies = [];
    for (const dependency of [...new Set(dependencyNumbers(fresh.body))]) {
      if (dependency !== number)
        freshDependencies.push(
          await github(`/repos/${owner}/${repository}/pulls/${dependency}`),
        );
    }
    const liveMain = await github(
      `/repos/${owner}/${repository}/git/ref/heads/main`,
    );
    if (
      !mutationSnapshotMatches({
        controllerMainSha,
        liveMainSha: liveMain.object?.sha,
        previousDecision: decision,
        pullRequest: fresh,
        requiredCheck,
        freshChecks,
        observedHeadSha,
        dependencies: freshDependencies,
      })
    ) {
      if (fresh.auto_merge)
        await setAutoMerge(fresh, "disarm", observedHeadSha);
      throw new Error(
        "Admission changed before mutation; no merge was submitted.",
      );
    }
  }
  let merged = false;
  if (decision.action === "update") {
    await github(
      `/repos/${owner}/${repository}/pulls/${number}/update-branch`,
      {
        method: "PUT",
        body: JSON.stringify({ expected_head_sha: observedHeadSha }),
        headers: { "content-type": "application/json" },
      },
    );
  } else if (decision.action === "stack") {
    merged = await mergeStack(owner, repository, pullRequest, observedHeadSha);
    if (!merged)
      throw new Error("GitHub did not accept the declared stack merge.");
  } else if (decision.action === "merge") {
    try {
      const result = await github(
        `/repos/${owner}/${repository}/pulls/${number}/merge`,
        {
          method: "PUT",
          body: JSON.stringify({
            sha: observedHeadSha,
            merge_method: "merge",
          }),
          headers: { "content-type": "application/json" },
        },
      );
      if (!result?.merged)
        throw new Error(
          result?.message || "GitHub rejected the exact-head merge.",
        );
      merged = true;
    } catch (error) {
      if (!isStackOnlyMergeError(error)) throw error;
      merged = await mergeStack(
        owner,
        repository,
        pullRequest,
        observedHeadSha,
      );
      if (!merged)
        throw new Error("GitHub did not accept the exact-head stack merge.");
    }
  } else if (decision.action === "arm" || decision.action === "disarm")
    await setAutoMerge(pullRequest, decision.action, observedHeadSha);
  if (merged) {
    await dispatchMainPages(owner, repository);
    await appendSummary([
      "Dispatched the rolling Pages build from protected main after the merge.",
    ]);
  }
}

export async function checkedAdmission(
  owner,
  repository,
  check,
  pullRequest,
  {
    root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    api = github,
    graph = graphql,
    download = fetch,
    approvals = REVIEWED_POLICY_CHANGES,
  } = {},
) {
  const match = new URL(check.details_url).pathname.match(
    /\/actions\/runs\/(\d+)\//,
  );
  if (check.app?.slug !== "github-actions" || !match) return false;
  const prefix = `/repos/${owner}/${repository}`;
  const run = await api(`${prefix}/actions/runs/${match[1]}`);
  if (
    run.event !== "pull_request" ||
    run.path !== ".github/workflows/deploy-pages.yml" ||
    run.head_sha !== pullRequest.head.sha
  )
    return false;
  // The artifact is untrusted input. Compare the actual checked revision's
  // policy blobs with protected-main automation, not its self-reported digest.
  const query = `query($owner: String!, $repository: String!) {
    repository(owner: $owner, name: $repository) {
      ${POLICY_FILES.map((name, index) => `p${index}: object(expression: ${JSON.stringify(`${run.head_sha}:${name}`)}) { oid }`).join("\n")}
    }
  }`;
  const policy = await graph(query, { owner, repository });
  const trustedPolicyBlobs = [];
  const candidatePolicyBlobs = [];
  for (const [index, name] of POLICY_FILES.entries()) {
    const bytes = await fs.readFile(path.join(root, name));
    const oid = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    trustedPolicyBlobs.push([name, oid]);
    candidatePolicyBlobs.push([name, policy.repository[`p${index}`]?.oid]);
  }
  const ordinaryPolicyMatch = equal(trustedPolicyBlobs, candidatePolicyBlobs);
  const result = await api(
    `${prefix}/actions/runs/${run.id}/artifacts?per_page=100`,
  );
  const artifacts = result.artifacts.filter(
    (item) => item.name === `admission-${run.id}-${run.run_attempt}`,
  );
  if (
    artifacts.length !== 1 ||
    artifacts[0].expired ||
    artifacts[0].size_in_bytes > 1_000_000
  )
    return false;
  const response = await download(
    `https://api.github.com${prefix}/actions/artifacts/${artifacts[0].id}/zip`,
    {
      headers: {
        authorization: `Bearer ${process.env.GH_TOKEN}`,
        accept: "application/vnd.github+json",
      },
    },
  );
  if (!response.ok)
    throw new Error(`Receipt download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1_000_000)
    throw new Error("Admission archive exceeds budget.");
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "fastline-admission-"),
  );
  const archive = path.join(directory, "receipt.zip");
  try {
    await fs.writeFile(archive, bytes);
    // Read one bounded member only. Never extract or execute artifact contents.
    const receipt = JSON.parse(
      execFileSync("unzip", ["-p", archive, "admission.json"], {
        encoding: "utf8",
        maxBuffer: 512_000,
        timeout: 10_000,
      }),
    );
    if (!ordinaryPolicyMatch) {
      const changedPaths = await completeChangedPaths(
        owner,
        repository,
        pullRequest,
        api,
      );
      if (
        !reviewedPolicyChangeMatches(
          {
            repository: `${owner}/${repository}`,
            pullRequest,
            trustedPolicyBlobs,
            candidatePolicyBlobs,
            changedPaths,
            receiptPaths: receipt.paths,
          },
          approvals,
        )
      )
        return false;
      check.approvedPolicyContext = {
        repository: `${owner}/${repository}`,
        trustedPolicyBlobs,
        candidatePolicyBlobs,
        changedPaths,
        receiptPaths: receipt.paths,
      };
    }
    const policyDigest = await validationPolicyDigest(root);
    check.admissionReceipt = receipt;
    check.policyDigest = policyDigest;
    return sameAdmission(receipt, pullRequest, policyDigest);
  } finally {
    await fs.unlink(archive).catch(() => {});
    await fs.rmdir(directory);
  }
}

async function completeChangedPaths(
  owner,
  repository,
  pullRequest,
  api = github,
) {
  if (
    !Number.isSafeInteger(pullRequest.changed_files) ||
    pullRequest.changed_files < 1 ||
    pullRequest.changed_files > 3000
  )
    throw new Error("Invalid or oversized changed-file inventory.");
  const paths = new Set(),
    filenames = new Set();
  let count = 0;
  for (let page = 1; page <= 30; page++) {
    const rows = await api(
      `/repos/${owner}/${repository}/pulls/${pullRequest.number}/files?per_page=100&page=${page}`,
    );
    if (!Array.isArray(rows)) throw new Error("Invalid changed-file response.");
    count += rows.length;
    for (const row of rows) {
      if (filenames.has(row.filename))
        throw new Error("Duplicate changed-file row.");
      filenames.add(row.filename);
      paths.add(row.filename);
      if (row.previous_filename) paths.add(row.previous_filename);
    }
    if (rows.length < 100) break;
  }
  const result = [...paths].sort();
  if (count !== pullRequest.changed_files || !pathsValid(result))
    throw new Error("Incomplete or unsafe changed-path inventory.");
  return result;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
