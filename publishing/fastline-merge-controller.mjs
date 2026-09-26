#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOLD_LABELS = new Set(["release-train-hold", "do-not-merge", "hold"]);

export function dependencyNumbers(body = "") {
  return [
    ...String(body).matchAll(/(?:depends on|blocked by)\s+#([1-9][0-9]*)/giu),
  ].map((match) => Number(match[1]));
}

export function decideMergeAction({
  pullRequest,
  observedHeadSha,
  activeMilestone,
  requiredCheck,
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
    if (!activeMilestone) return "active release variable is not configured";
    if (pullRequest.milestone?.title !== activeMilestone)
      return "pull request is outside the active milestone";
    if (pullRequest.draft) return "pull request remains draft";
    if (!labels.has("fastline-approved"))
      return "fastline-approved label is absent";
    if (
      [...labels].some(
        (label) => HOLD_LABELS.has(label) || label.startsWith("hold:"),
      )
    )
      return "hold label is present";
    if (pullRequest.review_decision === "CHANGES_REQUESTED")
      return "review changes are requested";
    if (dependencies.some((dependency) => !dependency.merged_at))
      return "declared predecessor is not merged";
    if (
      !requiredCheck ||
      requiredCheck.status !== "completed" ||
      requiredCheck.conclusion !== "success" ||
      requiredCheck.head_sha !== observedHeadSha
    )
      return "release-ready is not successful on the exact head";
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
  if (autoMergeEnabled)
    return { action: "none", reason: "exact-head auto-merge is already armed" };
  if (["clean", "unstable"].includes(pullRequest.mergeable_state))
    return {
      action: "merge",
      reason: "all blocking requirements passed on the exact head",
    };
  return { action: "arm", reason: "exact head is admitted and merge-ready" };
}

async function github(pathname, options = {}) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "revealline-fastline-controller",
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok)
    throw new Error(
      `GitHub ${response.status} ${pathname}: ${text.slice(0, 1000)}`,
    );
  return text ? JSON.parse(text) : null;
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

async function reviewDecision(owner, repository, number) {
  const data = await graphql(
    `
      query ($owner: String!, $repository: String!, $number: Int!) {
        repository(owner: $owner, name: $repository) {
          pullRequest(number: $number) {
            reviewDecision
          }
        }
      }
    `,
    { owner, repository, number },
  );
  return data.repository.pullRequest.reviewDecision;
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
    merge: "The protected exact-head merge is being submitted now.",
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
  if (event.workflow_run && event.workflow_run.conclusion !== "success") return;
  const [owner, repository] = process.env.GITHUB_REPOSITORY.split("/");
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
  pullRequest.review_decision = await reviewDecision(owner, repository, number);
  const checks = await github(
    `/repos/${owner}/${repository}/commits/${pullRequest.head.sha}/check-runs?per_page=100`,
  );
  const requiredCheck = checks.check_runs
    .filter((check) => check.name === "release-ready")
    .sort(
      (left, right) =>
        new Date(right.completed_at || 0) - new Date(left.completed_at || 0),
    )[0];
  if (requiredCheck) requiredCheck.head_sha = pullRequest.head.sha;
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
    activeMilestone: process.env.ACTIVE_MILESTONE || "",
    requiredCheck,
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
  if (decision.action === "update") {
    await github(
      `/repos/${owner}/${repository}/pulls/${number}/update-branch`,
      {
        method: "PUT",
        body: JSON.stringify({ expected_head_sha: observedHeadSha }),
        headers: { "content-type": "application/json" },
      },
    );
  } else if (decision.action === "merge") {
    await github(`/repos/${owner}/${repository}/pulls/${number}/merge`, {
      method: "PUT",
      body: JSON.stringify({ sha: observedHeadSha, merge_method: "merge" }),
      headers: { "content-type": "application/json" },
    });
  } else if (decision.action === "arm" || decision.action === "disarm")
    await setAutoMerge(pullRequest, decision.action, observedHeadSha);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
