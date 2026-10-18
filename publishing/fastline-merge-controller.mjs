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

// Every accepted observation includes two full bounded sweeps. This remains
// local implementation until hosted gates and independent review qualify it.
export async function collectExactHeadCheckInventory({
  repository,
  repositoryId,
  headSha,
  api,
  invocation,
  now = Date.now,
  maxRequests = 64,
  sweepTimeoutMs = 120_000,
  requestTimeoutMs = 30_000,
}) {
  const require = (condition, message) => {
    if (!condition) throw new Error(`Exact-head inventory: ${message}`);
  };
  require(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(
    repository,
  ), "invalid repository");
  require(/^[a-f0-9]{40}$/u.test(headSha), "invalid head");
  require(typeof api === "function" &&
    typeof now === "function", "missing reader or clock");
  require(Number.isSafeInteger(maxRequests) &&
    maxRequests > 0 &&
    maxRequests <= 64, "invalid request budget");
  require(Number.isSafeInteger(sweepTimeoutMs) &&
    sweepTimeoutMs > 0 &&
    sweepTimeoutMs <= 120_000, "invalid time budget");
  require(Number.isSafeInteger(requestTimeoutMs) &&
    requestTimeoutMs > 0 &&
    requestTimeoutMs <= 30_000, "invalid request timeout");
  const prefix = `/repos/${repository}/commits/${headSha}`;
  const statuses = new Set([
    "queued",
    "in_progress",
    "completed",
    "waiting",
    "requested",
    "pending",
  ]);
  const conclusions = new Set([
    "action_required",
    "cancelled",
    "failure",
    "neutral",
    "success",
    "skipped",
    "stale",
    "timed_out",
  ]);
  const positive = (value) => Number.isSafeInteger(value) && value > 0;
  require(repositoryId === undefined ||
    positive(repositoryId), "invalid numeric repository identity");
  require(invocation === undefined ||
    (positive(invocation?.runId) &&
      positive(invocation?.runAttempt) &&
      invocation?.jobName === "reconcile"), "invalid controller invocation");
  const timestamp = (value) =>
    value === null ||
    (typeof value === "string" &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/u.test(value) &&
      Number.isFinite(Date.parse(value)));
  const phase = (row) => {
    require(statuses.has(row.status), "invalid status");
    require(row.status === "completed"
      ? conclusions.has(row.conclusion)
      : row.conclusion === null, "invalid conclusion");
  };
  const identity = (row) => {
    require(positive(row?.id) &&
      positive(row?.app?.id), "invalid run or app identity");
    require(row.head_sha === headSha, "foreign head");
    phase(row);
  };
  const linksMatch = (link, route, hasNext) => {
    if (link === undefined || link === null || link === "") return;
    require(typeof link === "string", "invalid pagination link");
    const parts = link.split(/,\s*(?=<)/u);
    const relations = new Set();
    let next = false;
    for (const part of parts) {
      const match = /^<([^>]+)>;\s*rel="(next|prev|first|last)"$/u.exec(
        part.trim(),
      );
      require(match &&
        !relations.has(match[2]), "malformed pagination relation");
      relations.add(match[2]);
      const target = new URL(match[1]);
      const current = new URL(route, "https://api.github.com");
      const resourcePath = (pathname) => {
        const named = `/repos/${repository}/`;
        const numeric =
          repositoryId === undefined ? null : `/repositories/${repositoryId}/`;
        if (pathname.startsWith(named)) return pathname.slice(named.length);
        if (numeric && pathname.startsWith(numeric))
          return pathname.slice(numeric.length);
        return null;
      };
      // GitHub canonicalizes Link URLs to /repositories/{immutable id}/.
      // Accept that alias ONLY for the proven same repository. Requests remain
      // constructed from the literal trusted owner/name, never from this URL.
      require(target.origin === current.origin &&
        !target.username &&
        !target.password &&
        !target.hash &&
        resourcePath(target.pathname) !== null &&
        resourcePath(target.pathname) ===
          resourcePath(current.pathname), "foreign pagination resource");
      const pageValues = target.searchParams.getAll("page");
      require(pageValues.length === 1 &&
        /^[1-9][0-9]*$/u.test(
          pageValues[0],
        ), "invalid pagination page parameter");
      const targetPage = Number(pageValues[0]);
      require(positive(targetPage), "invalid linked page");
      target.searchParams.delete("page");
      current.searchParams.delete("page");
      require([...target.searchParams].sort().toString() ===
        [...current.searchParams]
          .sort()
          .toString(), "changed pagination filters");
      if (match[2] === "next") {
        next = true;
        require(targetPage ===
          Number(
            new URL(route, "https://api.github.com").searchParams.get("page"),
          ) +
            1, "skipped pagination page");
      }
    }
    // A full uncounted legacy page cannot prove whether it is the last page.
    // Validate any links, but always probe the next bounded page even when a
    // valid terminal header supplies only prev/first. Counted endpoints still
    // require exact next-link agreement with their independently checked total.
    require(hasNext === null ||
      next === hasNext, "incomplete pagination links");
  };
  const sweep = async () => {
    const started = now();
    require(Number.isFinite(started), "invalid clock");
    let requests = 0;
    const read = async (route) => {
      require(++requests <= maxRequests, "request budget exceeded");
      const elapsed = now() - started;
      require(Number.isFinite(elapsed) &&
        elapsed >= 0 &&
        elapsed < sweepTimeoutMs, "time budget exceeded");
      const abort = new AbortController();
      let timer;
      try {
        const response = await Promise.race([
          Promise.resolve().then(() => api(route, { signal: abort.signal })),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => {
                abort.abort();
                reject(new Error("Exact-head inventory: request timeout"));
              },
              Math.min(requestTimeoutMs, sweepTimeoutMs - elapsed),
            );
          }),
        ]);
        const after = now() - started;
        require(Number.isFinite(after) &&
          after >= 0 &&
          after < sweepTimeoutMs, "time budget exceeded");
        // A trusted HTTP adapter may expose a Link header without mixing it
        // into GitHub's JSON body. Raw injected JSON fixtures are also supported.
        return response &&
          Object.hasOwn(response, "body") &&
          Object.hasOwn(response, "link")
          ? response
          : { body: response, link: null };
      } finally {
        clearTimeout(timer);
      }
    };
    const counted = async (
      resource,
      key,
      validate,
      base = prefix,
      query = "",
    ) => {
      const rows = [],
        ids = new Set();
      let expected;
      for (let page = 1; page <= 10; page++) {
        const route = `${base}/${resource}?${query}${resource === "check-runs" ? "filter=all&" : ""}per_page=100&page=${page}`;
        const { body, link } = await read(route);
        require(Number.isSafeInteger(body?.total_count) &&
          body.total_count >= 0 &&
          body.total_count <= 1000, "count outside bound");
        expected ??= body.total_count;
        require(body.total_count === expected, "count changed during sweep");
        require(Array.isArray(body[key]) &&
          body[key].length ===
            Math.min(100, expected - rows.length), "incomplete page");
        for (const row of body[key]) {
          validate(row);
          require(!ids.has(row.id), "duplicate identity");
          ids.add(row.id);
          rows.push(structuredClone(row));
        }
        linksMatch(link, route, rows.length < expected);
        if (rows.length === expected) return rows;
      }
      throw new Error("Exact-head inventory: pagination bound exceeded");
    };
    let suiteRepositoryId = repositoryId;
    const suites = await counted("check-suites", "check_suites", (row) => {
      identity(row);
      require(positive(row.repository?.id) &&
        row.repository.full_name ===
          repository, "invalid suite repository identity");
      suiteRepositoryId ??= row.repository.id;
      require(row.repository.id ===
        suiteRepositoryId, "foreign suite repository identity");
    });
    const suiteById = new Map(suites.map((row) => [row.id, row]));
    const checkRuns = await counted("check-runs", "check_runs", (row) => {
      identity(row);
      require(typeof row.name === "string" &&
        row.name.length > 0 &&
        row.name.length <= 1024, "invalid check name");
      const suite = suiteById.get(row.check_suite?.id);
      require(suite &&
        suite.app.id === row.app.id &&
        (suite.app.slug ?? null) ===
          (row.app.slug ?? null), "unlisted or foreign suite");
      require(timestamp(row.started_at ?? null) &&
        timestamp(row.completed_at ?? null), "invalid check timestamp");
      require(row.status !== "completed" ||
        typeof row.completed_at === "string", "missing completion timestamp");
    });
    const legacy = [],
      legacyIds = new Set();
    let ended = false,
      previousTime = Infinity;
    for (let page = 1; page <= 11; page++) {
      const route = `${prefix}/statuses?per_page=100&page=${page}`;
      const { body, link } = await read(route);
      require(Array.isArray(body) &&
        body.length <= 100 &&
        legacy.length + body.length <= 1000, "legacy count outside bound");
      for (const row of body) {
        require(positive(row?.id) &&
          !legacyIds.has(row.id), "duplicate or invalid legacy identity");
        require(typeof row.context === "string" &&
          row.context.length > 0 &&
          row.context.length <= 1024, "invalid legacy context");
        // GitHub documents case-insensitive contexts, but does not define a
        // Unicode folding algorithm. Do not guess whether two non-ASCII names
        // are one gate or two: unsupported normalization fails closed.
        require(/^[\x20-\x7e]+$/u.test(
          row.context,
        ), "unsupported legacy context normalization");
        require(["success", "failure", "error", "pending"].includes(
          row.state,
        ), "invalid legacy state");
        require(typeof row.created_at === "string" &&
          timestamp(row.created_at) &&
          timestamp(row.updated_at ?? null), "invalid legacy timestamp");
        const created = Date.parse(row.created_at);
        require(created <= previousTime, "legacy order is not newest first");
        previousTime = created;
        legacyIds.add(row.id);
        legacy.push(structuredClone(row));
      }
      linksMatch(link, route, body.length === 100 ? null : false);
      if (body.length < 100) {
        ended = true;
        break;
      }
    }
    require(ended, "incomplete legacy pagination");
    const effective = new Map();
    for (const row of legacy) {
      const context = row.context.toLowerCase();
      if (!effective.has(context)) effective.set(context, row);
    }
    // Only a GitHub-owned suite -> run -> exact attempt -> job/check URL join
    // can prove an exception. Never derive a read URL from details_url, infer
    // a job ID from a check ID, or collapse different historical check IDs.
    const provenance = [],
      metadata = [],
      workflowCache = new Map(),
      jobCache = new Map();
    const actionsPrefix = `/repos/${repository}/actions`;
    const workflow = async (filename) => {
      if (!workflowCache.has(filename)) {
        const { body } = await read(`${actionsPrefix}/workflows/${filename}`);
        require(positive(body?.id) &&
          typeof body.path === "string" &&
          typeof body.state === "string", "invalid trusted workflow metadata");
        const record = { id: body.id, path: body.path, state: body.state };
        workflowCache.set(filename, record);
        metadata.push({ kind: "workflow", ...record });
      }
      return workflowCache.get(filename);
    };
    const jobsForSuite = async (suiteId) => {
      if (!jobCache.has(suiteId)) {
        const runs = await counted(
          "runs",
          "workflow_runs",
          (row) => {
            require(positive(row?.id) &&
              positive(row.run_attempt) &&
              positive(row.workflow_id) &&
              row.head_sha === headSha &&
              row.check_suite_id === suiteId &&
              row.repository?.full_name === repository &&
              row.head_repository?.full_name === repository &&
              positive(row.repository.id) &&
              (repositoryId === undefined ||
                row.repository.id === repositoryId) &&
              row.repository.id === row.head_repository.id &&
              typeof row.path === "string" &&
              typeof row.event === "string", "invalid Actions run identity");
            phase(row);
          },
          actionsPrefix,
          `check_suite_id=${suiteId}&`,
        );
        require(runs.length === 1, "ambiguous Actions suite/run join");
        const run = runs[0];
        metadata.push({
          kind: "run",
          id: run.id,
          attempt: run.run_attempt,
          workflowId: run.workflow_id,
          path: run.path,
          head: run.head_sha,
          suiteId: run.check_suite_id,
          event: run.event,
          repositoryId: run.repository.id,
          headRepositoryId: run.head_repository.id,
          status: run.status,
          conclusion: run.conclusion,
        });
        const jobs = await counted(
          `runs/${run.id}/attempts/${run.run_attempt}/jobs`,
          "jobs",
          (job) => {
            require(positive(job?.id) &&
              job.run_id === run.id &&
              job.run_attempt === run.run_attempt &&
              job.head_sha === headSha &&
              typeof job.name === "string" &&
              typeof job.check_run_url === "string" &&
              timestamp(job.started_at ?? null) &&
              timestamp(
                job.completed_at ?? null,
              ), "invalid Actions job identity");
            phase(job);
          },
          actionsPrefix,
        );
        metadata.push({
          kind: "jobs",
          runId: run.id,
          attempt: run.run_attempt,
          jobs: jobs
            .map((job) => ({
              id: job.id,
              runId: job.run_id,
              attempt: job.run_attempt,
              head: job.head_sha,
              name: job.name,
              checkUrl: job.check_run_url,
              status: job.status,
              conclusion: job.conclusion,
              startedAt: job.started_at ?? null,
              completedAt: job.completed_at ?? null,
            }))
            .sort((a, b) => a.id - b.id),
        });
        jobCache.set(suiteId, { run, jobs });
      }
      return jobCache.get(suiteId);
    };
    for (const check of [...checkRuns].sort((a, b) => a.id - b.id)) {
      if (
        !(
          check.name === "release-ready" ||
          check.name === "reconcile" ||
          (check.conclusion === "skipped" &&
            POLICY_SKIPPED_JOBS.has(check.name))
        )
      )
        continue;
      const binding = { checkId: check.id, role: "ordinary" };
      if (check.app.id === 15368 && check.app.slug === "github-actions") {
        const { run, jobs } = await jobsForSuite(check.check_suite.id);
        const matches = jobs.filter(
          (job) =>
            job.check_run_url ===
            `https://api.github.com/repos/${repository}/check-runs/${check.id}`,
        );
        require(matches.length <= 1, "ambiguous check/job join");
        const job = matches[0];
        if (
          job &&
          job.name === check.name &&
          job.status === check.status &&
          job.conclusion === check.conclusion &&
          job.started_at === check.started_at &&
          job.completed_at === check.completed_at
        ) {
          Object.assign(binding, {
            jobId: job.id,
            runId: run.id,
            runAttempt: run.run_attempt,
            workflowId: run.workflow_id,
            workflowPath: run.path,
            suiteId: run.check_suite_id,
          });
          const controller = check.name === "reconcile";
          const filename = controller
            ? "fastline-auto-merge.yml"
            : "deploy-pages.yml";
          const trusted = await workflow(filename);
          if (
            trusted.state === "active" &&
            trusted.path === `.github/workflows/${filename}` &&
            run.workflow_id === trusted.id &&
            run.path === trusted.path
          ) {
            if (
              controller &&
              invocation?.runId === run.id &&
              invocation.runAttempt === run.run_attempt &&
              invocation.jobName === job.name &&
              jobs.filter((candidate) => candidate.name === invocation.jobName)
                .length === 1
            )
              binding.role = "self-reconcile";
            else if (!controller && run.event === "pull_request")
              binding.role =
                check.name === "release-ready"
                  ? "release-ready"
                  : "policy-skip";
          }
        }
      }
      provenance.push(binding);
    }
    const suiteRecord = (row) => ({
      id: row.id,
      appId: row.app.id,
      appSlug: row.app.slug ?? null,
      head: row.head_sha,
      status: row.status,
      conclusion: row.conclusion,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    });
    const runRecord = (row) => ({
      ...suiteRecord(row),
      name: row.name,
      suiteId: row.check_suite.id,
      detailsUrl: row.details_url ?? null,
      externalId: row.external_id ?? null,
      startedAt: row.started_at ?? null,
      completedAt: row.completed_at ?? null,
    });
    const legacyRecord = (row) => ({
      id: row.id,
      context: row.context,
      state: row.state,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? null,
      creatorId: row.creator?.id ?? null,
      targetUrl: row.target_url ?? null,
    });
    const byId = (a, b) => a.id - b.id;
    const canonical = JSON.stringify({
      repository,
      repositoryId: repositoryId ?? null,
      headSha,
      suites: suites
        .map((row) => ({
          ...suiteRecord(row),
          repositoryId: row.repository.id,
          repository: row.repository.full_name,
        }))
        .sort(byId),
      checkRuns: checkRuns.map(runRecord).sort(byId),
      statuses: legacy.map(legacyRecord),
      effectiveStatuses: [...effective.values()].map(legacyRecord),
      provenance,
      metadata,
    });
    return {
      suites,
      checkRuns,
      statuses: legacy,
      effectiveStatuses: [...effective.values()],
      canonical,
      requests,
      provenance,
      metadata,
    };
  };
  const startedAt = new Date().toISOString();
  const first = await sweep();
  const second = await sweep();
  require(first.canonical ===
    second.canonical, "inventory changed between complete sweeps");
  return {
    repository,
    repositoryId: repositoryId ?? null,
    headSha,
    suites: second.suites,
    checkRuns: second.checkRuns,
    statuses: second.statuses,
    effectiveStatuses: second.effectiveStatuses,
    provenance: second.provenance,
    metadata: second.metadata,
    startedAt,
    completedAt: new Date().toISOString(),
    requestCounts: [first.requests, second.requests],
    complete: true,
    atomicSnapshot: false,
    mergeAuthority: false,
  };
}

// These evaluators accept only a complete exact-head collector result.
export function inventoryCheckBlocker(inventory, headSha) {
  if (
    inventory?.complete !== true ||
    inventory.headSha !== headSha ||
    !Array.isArray(inventory.provenance) ||
    !Array.isArray(inventory.effectiveStatuses)
  )
    return "exact-head check inventory is incomplete";
  const bindings = new Map(inventory.provenance.map((p) => [p.checkId, p]));
  for (const check of inventory.checkRuns) {
    const binding = bindings.get(check.id);
    if (check.head_sha !== headSha)
      return `${check.name} belongs to a different head`;
    if (binding?.role === "self-reconcile") continue;
    if (check.status !== "completed")
      return `${check.name} is ${check.status} on the exact head`;
    if (
      check.conclusion !== "success" &&
      !(
        check.conclusion === "skipped" &&
        POLICY_SKIPPED_JOBS.has(check.name) &&
        binding?.role === "policy-skip"
      )
    )
      return `${check.name} concluded ${check.conclusion} on the exact head`;
  }
  for (const status of inventory.effectiveStatuses)
    if (status.state !== "success")
      return `legacy ${status.context} is ${status.state} on the exact head`;
  return null;
}

export function inventoryReleaseReady(inventory, headSha) {
  if (
    inventory?.complete !== true ||
    inventory.headSha !== headSha ||
    !Array.isArray(inventory.provenance)
  )
    return null;
  const ids = new Set(
    inventory.provenance
      .filter((p) => p.role === "release-ready")
      .map((p) => p.checkId),
  );
  const matches = inventory.checkRuns.filter(
    (check) =>
      ids.has(check.id) &&
      check.head_sha === headSha &&
      check.name === "release-ready",
  );
  return matches.length === 1
    ? {
        ...matches[0],
        actionsProvenance: inventory.provenance.find(
          (p) => p.checkId === matches[0].id,
        ),
      }
    : null;
}

// Reviewed, exact-source exceptions are trusted only because this module is
// loaded from main. Never load approvals from a pull request or an artifact.
const TRUSTED_POLICY_1558 = [
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
    "61a0b7a8f903a73a1ae5e5eeb26863b3b585f1f2",
  ],
  ["publishing/test-policy.json", "e067e704a165e16e449761989e3e1b611dc35181"],
  ["publishing/test-policy.mjs", "aa9f1efc79301cd227dbe7eb874dcba6b601003c"],
];
export const REVIEWED_POLICY_CHANGES = [
  {
    repository: "mekhovov/revealline",
    number: 1558,
    headSha: "d69dfcdc853e99c2a727ef13e747334ffe7ef97a",
    baseSha: "0597edff78fbec0faeccffae413ca48e7a5d91f1",
    trustedPolicyDigest:
      "533b2fbc30efdf12a2d5ea578a4360239e284ff8200107f1f7765b9f6210489b",
    approvedPolicyDigest:
      "083826bf415c8ff93e7801bfd7b35674547bcbb1acecf7f7734f4146a9eef475",
    paths: [
      ".github/workflows/measure-pages-stack.yml",
      "docs/pages-stack-measurement-design-2026-10-16.md",
      "docs/pages-stack-measurement-plan-2026-10-16.md",
      "publishing/focused-test-map.json",
      "publishing/focused-tests.test.mjs",
      "publishing/source-workflow.test.mjs",
      "scripts/pages-stack-artifact.py",
      "scripts/pages-stack-artifacts.mjs",
      "scripts/pages-stack-contract.mjs",
      "scripts/pages-stack-measurement.mjs",
      "scripts/pages-stack-packet.mjs",
      "scripts/pages-stack-source.mjs",
      "scripts/test-pages-stack-artifacts.mjs",
      "scripts/test-pages-stack-contract.mjs",
      "scripts/test-pages-stack-e2e.mjs",
      "scripts/test-pages-stack-measurement.mjs",
      "scripts/test-pages-stack-packet.mjs",
      "scripts/test-pages-stack-source.mjs",
    ],
    trustedPolicyBlobs: TRUSTED_POLICY_1558,
    candidatePolicyBlobs: TRUSTED_POLICY_1558.map(([name, oid]) => [
      name,
      name === "publishing/focused-test-map.json"
        ? "61dda74f9db14d20b6055e725cf5836b3b539bfe"
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
  // The immutable #1558 record keeps its original complete seven-file shape.
  // This validates a record, not admission: all exact source/blob/digest/path
  // comparisons below still apply, and ordinary admission still uses current
  // POLICY_FILES. Never treat an arbitrary shorter inventory as a legacy one.
  [POLICY_FILES, TRUSTED_POLICY_1558.map(([name]) => name)].some(
    (profile) =>
      entries.length === profile.length &&
      entries.every(
        (entry, index) =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          entry[0] === profile[index] &&
          exactSha(entry[1]),
      ),
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
  initialPullRequest,
}) {
  if (!trustedMainMatches(controllerMainSha, liveMainSha)) return false;
  if (
    !initialPullRequest ||
    !equal(
      pullMutationIdentity(initialPullRequest),
      pullMutationIdentity(pullRequest),
    )
  )
    return false;
  const latest = inventoryReleaseReady(freshChecks, observedHeadSha);
  if (
    !latest ||
    latest.id !== requiredCheck?.id ||
    !equal(latest.actionsProvenance, requiredCheck.actionsProvenance) ||
    !freshAdmissionMatches(requiredCheck, pullRequest)
  )
    return false;
  const freshRequired = { ...latest, admissionMatches: true };
  const freshDecision = decideMergeAction({
    pullRequest,
    observedHeadSha,
    requiredCheck: freshRequired,
    checkInventory: freshChecks,
    dependencies,
  });
  return (
    ["update", "stack", "merge", "arm"].includes(previousDecision.action) &&
    freshDecision.action === previousDecision.action
  );
}

const pullMutationIdentity = (pull) => ({
  number: pull.number,
  nodeId: pull.node_id,
  state: pull.state,
  draft: pull.draft,
  head: {
    sha: pull.head?.sha,
    ref: pull.head?.ref,
    repository: pull.head?.repo?.full_name,
    repositoryId: pull.head?.repo?.id,
  },
  base: {
    sha: pull.base?.sha,
    ref: pull.base?.ref,
    repository: pull.base?.repo?.full_name,
    repositoryId: pull.base?.repo?.id,
  },
  dependencies: [...new Set(dependencyNumbers(pull.body))].sort(
    (a, b) => a - b,
  ),
  labels: (pull.labels || []).map((label) => label.name || label).sort(),
  stack: pull.stack?.number ?? null,
  autoMerge: Boolean(pull.auto_merge),
  mergeable: pull.mergeable,
  mergeableState: pull.mergeable_state,
});

export async function collectControllerSnapshot({
  repository,
  number,
  observedHeadSha,
  controllerMainSha,
  invocation,
  api = github,
  admit,
  admittedCheck,
}) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository) ||
    !Number.isSafeInteger(number) ||
    number < 1
  )
    throw new Error("Invalid controller identity.");
  const prefix = `/repos/${repository}`;
  const mainBefore = await api(`${prefix}/git/ref/heads/main`);
  const first = await api(`${prefix}/pulls/${number}`);
  // The rejected-merge fallback must recognize an already completed merge
  // without another mutation or a duplicate production dispatch.
  if (first.state !== "open")
    return {
      pullRequest: first,
      observedHeadSha,
      controllerMainSha,
      liveMainSha: mainBefore.object?.sha,
      decision: { action: "wait", reason: "pull request is not open" },
    };
  if (!trustedMainMatches(controllerMainSha, mainBefore.object?.sha))
    throw new Error("Trusted main changed before snapshot.");
  if (
    first.number !== number ||
    first.head?.repo?.full_name !== repository ||
    first.base?.repo?.full_name !== repository ||
    !Number.isSafeInteger(first.base?.repo?.id) ||
    first.base.repo.id < 1 ||
    first.head?.repo?.id !== first.base.repo.id
  )
    throw new Error("Foreign pull request identity.");
  const checkInventory = await collectExactHeadCheckInventory({
    repository,
    repositoryId: first.base.repo.id,
    headSha: first.head.sha,
    invocation,
    api: (route, options) =>
      api(route, { ...options, includePagination: true }),
  });
  const requiredCheck = inventoryReleaseReady(checkInventory, first.head.sha);
  if (
    requiredCheck?.status === "completed" &&
    requiredCheck.conclusion === "success"
  ) {
    if (
      admittedCheck &&
      requiredCheck.id === admittedCheck.id &&
      equal(requiredCheck.actionsProvenance, admittedCheck.actionsProvenance)
    ) {
      for (const key of [
        "admissionReceipt",
        "policyDigest",
        "approvedPolicyContext",
      ])
        if (Object.hasOwn(admittedCheck, key))
          requiredCheck[key] = structuredClone(admittedCheck[key]);
      requiredCheck.admissionMatches = freshAdmissionMatches(
        requiredCheck,
        first,
      );
    } else if (!admittedCheck) {
      const [owner, name] = repository.split("/");
      requiredCheck.admissionMatches = await (
        admit || ((check, pull) => checkedAdmission(owner, name, check, pull))
      )(requiredCheck, first);
    }
  }
  const dependencies = [];
  for (const dependency of [...new Set(dependencyNumbers(first.body))])
    if (dependency !== number)
      dependencies.push(await api(`${prefix}/pulls/${dependency}`));
  const last = await api(`${prefix}/pulls/${number}`);
  const mainAfter = await api(`${prefix}/git/ref/heads/main`);
  if (
    !equal(pullMutationIdentity(first), pullMutationIdentity(last)) ||
    !trustedMainMatches(controllerMainSha, mainAfter.object?.sha)
  )
    throw new Error("PR or trusted main changed during snapshot.");
  const decision = decideMergeAction({
    pullRequest: last,
    observedHeadSha,
    requiredCheck,
    checkInventory,
    dependencies,
  });
  return {
    controllerMainSha,
    liveMainSha: mainAfter.object.sha,
    pullRequest: last,
    observedHeadSha,
    requiredCheck,
    checkInventory,
    dependencies,
    decision,
  };
}

export async function executeVerifiedMergeAction({
  snapshot,
  refresh,
  actions,
}) {
  const action = snapshot.decision.action;
  if (action === "disarm") {
    await actions.disarm(snapshot.pullRequest, snapshot.observedHeadSha);
    return false;
  }
  if (!["update", "stack", "merge", "arm"].includes(action)) return false;
  const verify = async () => {
    const fresh = await refresh();
    if (
      fresh.pullRequest.state === "closed" &&
      fresh.pullRequest.merged === true &&
      fresh.pullRequest.head?.sha === snapshot.observedHeadSha
    )
      return null;
    if (
      !mutationSnapshotMatches({
        controllerMainSha: snapshot.controllerMainSha,
        liveMainSha: fresh.liveMainSha,
        previousDecision: snapshot.decision,
        pullRequest: fresh.pullRequest,
        initialPullRequest: snapshot.pullRequest,
        requiredCheck: snapshot.requiredCheck,
        freshChecks: fresh.checkInventory,
        observedHeadSha: snapshot.observedHeadSha,
        dependencies: fresh.dependencies,
      })
    ) {
      if (fresh.pullRequest.auto_merge && actions.disarm)
        await actions.disarm(fresh.pullRequest, snapshot.observedHeadSha);
      throw new Error(
        "Admission changed before mutation; no merge-capable request submitted.",
      );
    }
    return fresh;
  };
  const fresh = await verify();
  if (!fresh) return false;
  const perform = (name) =>
    actions[name](fresh.pullRequest, snapshot.observedHeadSha);
  if (action === "update" || action === "arm") {
    await perform(action);
    return false;
  }
  if (action === "stack") {
    if (!(await perform("stack")))
      throw new Error("GitHub did not accept the declared stack merge.");
    return true;
  }
  try {
    if (!(await perform("merge")))
      throw new Error("GitHub rejected the exact-head merge.");
    return true;
  } catch (error) {
    if (!isStackOnlyMergeError(error)) throw error;
    const fallback = await verify();
    if (!fallback) return false;
    if (!(await actions.stack(fallback.pullRequest, snapshot.observedHeadSha)))
      throw new Error("GitHub did not accept the exact-head stack merge.");
    return true;
  }
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
      "trustedPolicyDigest",
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
      "trustedPolicyDigest",
      "approvedPolicyDigest",
    ]) ||
    !Number.isSafeInteger(approval.number) ||
    approval.number < 1 ||
    !exactSha(approval.headSha) ||
    !exactSha(approval.baseSha) ||
    !/^[a-f0-9]{64}$/u.test(approval.trustedPolicyDigest || "") ||
    !/^[a-f0-9]{64}$/u.test(approval.approvedPolicyDigest || "") ||
    !pathsValid(approval.paths) ||
    !policyBlobsValid(approval.trustedPolicyBlobs) ||
    !policyBlobsValid(approval.candidatePolicyBlobs)
  )
    return false;
  // Only the reviewed map may differ among policy files. The new manual
  // diagnostic workflow is outside POLICY_FILES and allowed only at this
  // immutable reviewed PR/head/base identity, never as a generic exception.
  const differences = approval.trustedPolicyBlobs
    .filter(
      (entry, index) => !equal(entry, approval.candidatePolicyBlobs[index]),
    )
    .map(([name]) => name);
  if (
    !equal(differences, ["publishing/focused-test-map.json"]) ||
    approval.paths.includes("publishing/fastline-merge-controller.mjs") ||
    approval.paths.some(
      (name) =>
        name.startsWith(".github/") &&
        !(
          name === ".github/workflows/measure-pages-stack.yml" &&
          approval.repository === "mekhovov/revealline" &&
          approval.number === 1558 &&
          approval.headSha === "d69dfcdc853e99c2a727ef13e747334ffe7ef97a" &&
          approval.baseSha === "0597edff78fbec0faeccffae413ca48e7a5d91f1"
        ),
    )
  )
    return false;
  const pull = input.pullRequest;
  return (
    input.repository === approval.repository &&
    input.trustedPolicyDigest === approval.trustedPolicyDigest &&
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

export function exactHeadCheckBlocker(
  checkRuns = [],
  headSha,
  provenance = [],
  effectiveStatuses = [],
) {
  return inventoryCheckBlocker(
    { complete: true, headSha, checkRuns, provenance, effectiveStatuses },
    headSha,
  );
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
  checkInventory,
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
    if (!checkInventoryComplete || checkInventory?.complete !== true)
      return "exact-head check inventory is incomplete";
    const selected = inventoryReleaseReady(checkInventory, observedHeadSha);
    if (
      !selected ||
      selected.id !== requiredCheck.id ||
      !equal(selected.actionsProvenance, requiredCheck.actionsProvenance)
    )
      return "release-ready identity is not uniquely verified on the exact head";
    const checkBlocker = inventoryCheckBlocker(checkInventory, observedHeadSha);
    if (checkBlocker) return checkBlocker;
    if (
      pullRequest.mergeable === false ||
      pullRequest.mergeable_state === "dirty"
    )
      return "pull request has conflicts";
    if (pullRequest.mergeable !== true) return "mergeability is unknown";
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
          : "exact head is admitted; platform reports unstable merge state",
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

export async function github(
  pathname,
  { includePagination = false, transport = fetch, ...options } = {},
) {
  const timeout = AbortSignal.timeout(30_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const response = await transport(`https://api.github.com${pathname}`, {
    ...options,
    signal,
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
  const body = text ? JSON.parse(text) : null;
  return includePagination
    ? { body, link: response.headers.get("link") }
    : body;
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
  const snapshotOptions = {
    repository: `${owner}/${repository}`,
    number,
    observedHeadSha,
    controllerMainSha,
    invocation: {
      runId: Number(process.env.GITHUB_RUN_ID),
      runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      jobName: process.env.GITHUB_JOB,
    },
  };
  let snapshot;
  try {
    snapshot = await collectControllerSnapshot(snapshotOptions);
  } catch (error) {
    // An operational/incomplete observation cannot authorize a mutation. Keep
    // protective disarming available, without fabricating a CI code failure.
    const pull = await github(`/repos/${owner}/${repository}/pulls/${number}`);
    snapshot = {
      pullRequest: pull,
      observedHeadSha,
      controllerMainSha,
      decision: {
        action: pull.auto_merge ? "disarm" : "wait",
        reason: `Operational observation rejected: ${error.message}`,
      },
    };
  }
  const { pullRequest, decision } = snapshot;
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
  const merged = await executeVerifiedMergeAction({
    snapshot,
    refresh: () =>
      collectControllerSnapshot({
        ...snapshotOptions,
        admittedCheck: snapshot.requiredCheck,
      }),
    actions: {
      update: async (pull, head) =>
        github(
          `/repos/${owner}/${repository}/pulls/${pull.number}/update-branch`,
          {
            method: "PUT",
            body: JSON.stringify({ expected_head_sha: head }),
            headers: { "content-type": "application/json" },
          },
        ),
      stack: (pull, head) => mergeStack(owner, repository, pull, head),
      merge: async (pull, head) => {
        const result = await github(
          `/repos/${owner}/${repository}/pulls/${pull.number}/merge`,
          {
            method: "PUT",
            body: JSON.stringify({
              sha: head,
              merge_method: "merge",
            }),
            headers: { "content-type": "application/json" },
          },
        );
        if (!result?.merged)
          throw new Error(
            result?.message || "GitHub rejected the exact-head merge.",
          );
        return true;
      },
      arm: (pull, head) => setAutoMerge(pull, "arm", head),
      disarm: (pull, head) => setAutoMerge(pull, "disarm", head),
    },
  });
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
  const proof = check.actionsProvenance;
  if (
    check.app?.id !== 15368 ||
    check.app?.slug !== "github-actions" ||
    check.name !== "release-ready" ||
    check.head_sha !== pullRequest.head.sha ||
    proof?.role !== "release-ready" ||
    proof.checkId !== check.id ||
    proof.workflowPath !== ".github/workflows/deploy-pages.yml" ||
    ![
      proof.runId,
      proof.runAttempt,
      proof.workflowId,
      proof.jobId,
      proof.suiteId,
    ].every((value) => Number.isSafeInteger(value) && value > 0)
  )
    return false;
  const prefix = `/repos/${owner}/${repository}`;
  const run = await api(`${prefix}/actions/runs/${proof.runId}`);
  if (
    run.id !== proof.runId ||
    run.run_attempt !== proof.runAttempt ||
    run.workflow_id !== proof.workflowId ||
    run.check_suite_id !== proof.suiteId ||
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
  const trustedPolicyDigest = await validationPolicyDigest(root);
  let policyDigest = trustedPolicyDigest;
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
      signal: AbortSignal.timeout(30_000),
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
            trustedPolicyDigest,
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
        trustedPolicyDigest,
      };
      // This digest was independently derived from every reviewed candidate
      // policy blob and installed with the trusted approval, never taken from
      // the untrusted receipt. All executable policy blobs still match main.
      policyDigest = approvals[0].approvedPolicyDigest;
    }
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
