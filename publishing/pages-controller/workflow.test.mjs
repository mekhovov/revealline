import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("source qualification retains six gates while the controller owns guarded main publication", async () => {
  const legacy = await fs.readFile(
    new URL("../../.github/workflows/deploy-pages.yml", import.meta.url),
    "utf8",
  );
  const workflow = await fs.readFile(
    new URL(
      "../../.github/workflows/publish-frozen-pages.yml",
      import.meta.url,
    ),
    "utf8",
  );
  for (const command of [
    "npm run validate",
    "npm run lint",
    "npm run format:check",
    "npm run format:native:check",
    "node --check authoring/motion-lab/app.js",
    "node ../automation/scripts/run-test-shard.mjs --shard ${{ matrix.shard }}/4 --root .",
  ])
    assert.ok(legacy.includes(command), `Missing source gate: ${command}`);
  assert.match(legacy, /shard: \[1, 2, 3, 4\]/);
  assert.match(legacy, /fail-fast: false/);
  assert.match(legacy, /mkdir -p \.cache/);
  assert.match(legacy, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(legacy, /path: automation/);
  assert.match(legacy, /working-directory: source/);
  assert.match(legacy, /cache-dependency-path: source\/package-lock\.json/);
  assert.doesNotMatch(legacy, /cp \.ci-tools/);
  assert.match(legacy, /node --test scripts\/test-production-\*\.mjs/);
  assert.match(legacy, /run: npm run build/);
  // Release routing reads controller infrastructure from main, never today's runner in an old tag.
  const gate = legacy.slice(
    legacy.indexOf("  release_gate:"),
    legacy.indexOf("  preflight:"),
  );
  assert.match(gate, /ref: main/);
  assert.match(gate, /release-policy\.mjs route/);
  assert.match(gate, /workflow run publish-frozen-pages.yml .* --ref main/);
  for (const job of ["preflight", "test", "build"])
    assert.ok(
      legacy.includes(`  ${job}:\n    if: github.event_name == 'pull_request'`),
    );
  assert.doesNotMatch(
    legacy,
    /build:pages|upload-pages-artifact|deploy-pages@/,
  );
  assert.match(
    workflow,
    /if: github.event_name != 'pull_request' && github.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /REQUESTED_RELEASE: \$\{\{ inputs.release_tag/);
  assert.match(workflow, /release-policy\.mjs verify/);
  assert.match(workflow, /environment:\n\s+name: github-pages/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /group: frozen-pages-/);
  assert.match(legacy, /group: source-gates-\$\{\{ github.ref \}\}/);
  assert.match(legacy, /cancel-in-progress: false/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /publish\.mjs verify-artifact/);
  assert.ok(
    workflow.indexOf("publish.mjs verify-artifact") <
      workflow.indexOf("name: Upload verified Pages artifact"),
  );
  assert.doesNotMatch(
    workflow,
    /pull_request_target|environment:.*preview|npm test/,
  );
});

test("delivery-only push is excluded after the controller glob while PR review and mixed publication remain enabled", async () => {
  const workflow = await fs.readFile(
    new URL(
      "../../.github/workflows/publish-frozen-pages.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const push = workflow.slice(
    workflow.indexOf("  push:"),
    workflow.indexOf("  pull_request:"),
  );
  const pullRequest = workflow.slice(
    workflow.indexOf("  pull_request:"),
    workflow.indexOf("  workflow_dispatch:"),
  );
  const positive = "      - 'publishing/pages-controller/**'";
  const negative = "      - '!publishing/pages-controller/delivery/**'";
  assert.ok(push.includes(positive));
  assert.equal(push.split(negative).length - 1, 1);
  assert.ok(push.indexOf(negative) > push.indexOf(positive));
  assert.ok(pullRequest.includes(positive));
  assert.ok(!pullRequest.includes(negative));
  assert.match(push, /branches: \[main\]/);
  assert.match(push, /docs\/deployment\.md/);
  assert.match(workflow, /publish\.mjs verify-artifact/);
});
