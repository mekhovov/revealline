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

test("internal resume starts at evidence and never repeats qualification", () => {
  assert.deepEqual(fastlineStages("resume"), [
    "evidence",
    "publication",
    "archive",
    "pages",
    "public-verification",
  ]);
});

test("publisher serializes requests and passes immutable artifacts through each stage", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/fastline-release.yml", import.meta.url),
    "utf8",
  );
  const qualification = await readFile(
    new URL("../.github/workflows/qualify-release-source.yml", import.meta.url),
    "utf8",
  );
  const evidence = await readFile(
    new URL(
      "../.github/workflows/assemble-waived-release-evidence.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(workflow, /group: fastline-publisher/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.doesNotMatch(workflow, /^\s+queue:/mu);
  assert.match(
    workflow,
    /uses: \.\/\.github\/workflows\/qualify-release-source\.yml/u,
  );
  assert.match(workflow, /needs\.qualify\.outputs\.artifact_id/u);
  assert.match(workflow, /needs\.qualify\.outputs\.artifact_digest/u);
  assert.match(workflow, /digest="\$\{EXPECTED_DIGEST#sha256:\}"/u);
  assert.match(workflow, /test "\$\(jq -r \.digest/u);
  assert.match(workflow, /release_artifact\.py run/u);
  assert.match(workflow, /fastline-release-objects\.mjs/u);
  assert.match(workflow, /fastline-release-publisher\.mjs publish/u);
  assert.match(workflow, /mode=resume/u);
  assert.match(workflow, /Refuse mismatched tag or release objects/u);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(
    workflow,
    /publish:[\s\S]*?permissions:\n      contents: write/u,
  );
  assert.match(qualification, /workflow_call:/u);
  assert.match(qualification, /artifact_id:/u);
  assert.match(qualification, /artifact_digest:/u);
  assert.match(evidence, /workflow_call:/u);
  assert.match(evidence, /artifact_id:/u);
  assert.match(evidence, /artifact_digest:/u);
  assert.match(
    evidence,
    /waived-release-small-package-\$VERSION-\$SOURCE_COMMIT/u,
  );
});
