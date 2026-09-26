import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  fastlineStages,
  resumeDecision,
  validateFastlineInputs,
} from "./fastline-release-inputs.mjs";

const sourceSha = "a".repeat(40);

test("accepts one exact serialized release request", () => {
  assert.deepEqual(
    validateFastlineInputs({
      version: "v0.132.2",
      sourceSha,
      releasePr: "607",
      predecessorTag: "v0.132.1",
      mode: "publish",
    }),
    {
      version: "v0.132.2",
      numericVersion: "0.132.2",
      sourceSha,
      releasePr: 607,
      predecessorTag: "v0.132.1",
      mode: "publish",
    },
  );
});

test("rejects symbolic sources, unstable versions and invalid predecessor requests", () => {
  const base = {
    version: "v0.132.2",
    sourceSha,
    releasePr: 607,
    predecessorTag: "v0.132.1",
    mode: "shadow",
  };
  for (const changed of [
    { sourceSha: "main" },
    { version: "0.132.2" },
    { releasePr: 0 },
    { predecessorTag: "v0.132.2" },
    { mode: "force" },
  ])
    assert.throws(() => validateFastlineInputs({ ...base, ...changed }));
});

test("resumption reuses exact objects, creates absent objects and stops on drift", () => {
  const expected = { sha: sourceSha, bytes: 7 };
  assert.equal(resumeDecision({ expected }).action, "create");
  assert.equal(resumeDecision({ expected, actual: expected }).action, "reuse");
  assert.deepEqual(
    resumeDecision({ expected, actual: { ...expected, bytes: 8 } }),
    {
      action: "stop",
      reason: "existing object differs from the exact request",
    },
  );
  assert.match(
    resumeDecision({
      expected,
      actual: { ...expected, bytes: 8 },
      published: true,
    }).reason,
    /never be overwritten/u,
  );
});

test("shadow mode plans every stage without changing the stage order", () => {
  assert.deepEqual(
    fastlineStages("shadow"),
    fastlineStages("publish").map((stage) => `shadow:${stage}`),
  );
});

test("publisher canary queues every request and passes one immutable artifact to inspection", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/fastline-release.yml", import.meta.url),
    "utf8",
  );
  const qualification = await readFile(
    new URL("../.github/workflows/qualify-release-source.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /group: fastline-publisher/u);
  assert.match(workflow, /queue: max/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(
    workflow,
    /uses: \.\/\.github\/workflows\/qualify-release-source\.yml/u,
  );
  assert.match(workflow, /needs\.qualify\.outputs\.artifact_id/u);
  assert.match(workflow, /needs\.qualify\.outputs\.artifact_digest/u);
  assert.match(workflow, /inspect_qualified_artifact\.py/u);
  assert.doesNotMatch(workflow, /contents: write/u);
  assert.match(qualification, /workflow_call:/u);
  assert.match(qualification, /artifact_id:/u);
  assert.match(qualification, /artifact_digest:/u);
});
