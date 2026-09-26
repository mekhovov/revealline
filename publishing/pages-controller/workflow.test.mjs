import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("source qualification retains mandatory guards and restorable suites while controller owns publication", async () => {
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
  assert.match(
    legacy,
    /Build pull-request artifact\n\s+if: vars\.REVEALLINE_FULL_CI == 'true'/,
  );
  assert.match(
    legacy,
    /Defer full artifact build to merged-source qualification\n\s+if: vars\.REVEALLINE_FULL_CI != 'true'/,
  );
  assert.match(
    legacy,
    /Require the previous stable release on public Pages\n\s+if: steps\.admission\.outputs\.mode == 'release'/,
  );
  assert.match(legacy, /Release\\ evidence\\ v/);
  assert.match(legacy, /restricted to a non-empty docs-only diff/);
  assert.match(legacy, /echo 'mode=release-evidence'/);
  assert.match(
    legacy,
    /needs\.preflight\.outputs\.admission == 'release-evidence'/,
  );
  assert.match(legacy, /if \[ "\$ADMISSION" = release-evidence \]/);
  assert.match(legacy, /release-train-boundary\.mjs public/);
  assert.match(
    legacy,
    /PR_BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  );
  assert.match(legacy, /contents\/package\.json\?ref=\$PR_BASE_SHA/);
  assert.match(legacy, /PR_BASE_VERSION="\$base_version"/);
  assert.match(
    legacy,
    /Require exact release version identity[\s\S]*?release-train-boundary\.mjs source \./,
  );
  // Release routing reads controller infrastructure from main, never today's runner in an old tag.
  const gate = legacy.slice(
    legacy.indexOf("  release_gate:"),
    legacy.indexOf("  preflight:"),
  );
  assert.match(gate, /ref: main/);
  assert.match(gate, /release-policy\.mjs route/);
  assert.match(gate, /workflow run publish-frozen-pages.yml .* --ref main/);
  for (const job of ["preflight", "focused", "test", "build", "release-ready"])
    assert.ok(legacy.includes(`  ${job}:\n`));
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
  assert.match(
    workflow,
    /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
  );
  assert.match(
    workflow,
    /queue: \$\{\{ github\.event_name == 'pull_request' && 'single' \|\| 'max' \}\}/,
  );
  assert.match(workflow, /group: frozen-pages-/);
  assert.match(legacy, /group: source-gates-\$\{\{ github.ref \}\}/);
  const pullRequestTrigger = legacy.slice(
    legacy.indexOf("  pull_request:"),
    legacy.indexOf("  workflow_dispatch:"),
  );
  assert.match(pullRequestTrigger, /branches: \[main\]/);
  for (const event of [
    "opened",
    "synchronize",
    "reopened",
    "edited",
    "ready_for_review",
  ])
    assert.match(pullRequestTrigger, new RegExp(`\\b${event}\\b`, "u"));
  for (const metadataEvent of [
    "labeled",
    "unlabeled",
    "milestoned",
    "demilestoned",
  ])
    assert.doesNotMatch(
      pullRequestTrigger,
      new RegExp(`\\b${metadataEvent}\\b`, "u"),
    );
  assert.doesNotMatch(pullRequestTrigger, /paths-ignore:/);
  const sourceConcurrency = legacy.slice(
    legacy.indexOf("concurrency:"),
    legacy.indexOf("jobs:"),
  );
  assert.match(
    sourceConcurrency,
    /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
  );
  assert.doesNotMatch(sourceConcurrency, /cancel-in-progress: true/);
  const qualification = await fs.readFile(
    new URL(
      "../../.github/workflows/qualify-release-source.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const originalUpload = await fs.readFile(
    new URL(
      "../../.github/workflows/upload-release-originals.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(
    (qualification.match(/cancel-in-progress: false/g) || []).length,
    1,
  );
  assert.equal(
    (originalUpload.match(/cancel-in-progress: false/g) || []).length,
    1,
  );
  assert.doesNotMatch(qualification, /cancel-in-progress: (?:true|\$)/);
  assert.doesNotMatch(originalUpload, /cancel-in-progress: (?:true|\$)/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /publish\.mjs verify-artifact/);
  assert.ok(
    workflow.indexOf("publish.mjs verify-artifact") <
      workflow.indexOf("name: Upload verified Pages artifact"),
  );
  assert.match(
    workflow,
    /outputs:\n\s+page_url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/,
  );
  assert.match(workflow, /audit-public-bytes:\n/);
  assert.match(workflow, /needs: \[assemble, deploy\]/);
  assert.match(workflow, /public-byte-audit\.mjs/);
  assert.match(workflow, /name: frozen-pages-receipts/);
  assert.match(workflow, /name: public-byte-audit-\$\{\{ github\.sha \}\}/);
  assert.ok(
    workflow.indexOf("name: Deploy verified frozen edition to GitHub Pages") <
      workflow.indexOf("  audit-public-bytes:"),
  );
  assert.doesNotMatch(
    workflow,
    /pull_request_target|environment:.*preview|npm test/,
  );
});

test("fast mode waives long suites while release source and publication guards stay mandatory", async () => {
  const read = (name) =>
    fs.readFile(
      new URL("../../.github/workflows/" + name, import.meta.url),
      "utf8",
    );
  const pr = await read("deploy-pages.yml");
  const manual = await read("qualify-release-source.yml");
  const originalUpload = await read("upload-release-originals.yml");
  const pages = await read("publish-frozen-pages.yml");
  for (const workflow of [pr, manual, originalUpload, pages]) {
    assert.match(workflow, /id: test_policy/);
    assert.match(workflow, /publishing\/test-policy.mjs/);
    assert.doesNotMatch(workflow, /continue-on-error|\|\| true/);
  }
  assert.match(
    pr,
    /test:\n\s+if: >-\n\s+github.event_name == 'pull_request' &&\n\s+needs.preflight.outputs.admission == 'release' &&\n\s+vars.REVEALLINE_FULL_CI == 'true' &&\n\s+needs.preflight.outputs.runTests == 'true'/,
  );
  assert.match(
    pr,
    /Run extended static and provenance checks\n\s+if: vars.REVEALLINE_FULL_CI == 'true'/,
  );
  assert.match(
    manual,
    /test:\n\s+if: needs.qualify.outputs.runTests == 'true'/,
  );
  assert.match(manual, /run_tests:\n[\s\S]*?type: boolean/);
  for (const workflow of [manual, originalUpload])
    assert.match(
      workflow,
      /Verify local utility tests before authenticated work\n\s+if: steps.test_policy.outputs.runTests == 'true'/,
    );
  assert.match(
    manual,
    /Check hosted artifact utility locally\n\s+if: steps.test_policy.outputs.runTests == 'true'/,
  );
  assert.match(
    pages,
    /Verify metadata bridges and bounded ZIP extraction in full mode\n\s+if: vars.REVEALLINE_FULL_CI == 'true' && steps.test_policy.outputs.runTests == 'true'/,
  );
  for (const [workflow, names] of [
    [
      pr,
      [
        "Validate release-critical source",
        "Verify exact tracked source before commands",
        "Defer full artifact build to merged-source qualification",
        "Verify tracked source after fast release gate",
      ],
    ],
    [
      manual,
      [
        "Validate source",
        "Lint source",
        "Check formatting",
        "Check native formatting",
        "Require reviewed production slots in the committed ledger",
        "Freeze the exact qualified commit",
        "Inspect all frozen originals without release writes",
      ],
    ],
    [
      originalUpload,
      [
        "Verify all originals and upload two absent members to the existing draft",
      ],
    ],
    [pages, ["Validate frozen selector and admitted archives"]],
  ]) {
    const blocks = workflow.split("      - name: ");
    for (const name of names) {
      const block = blocks.find((value) => value.startsWith(name + "\n"));
      assert.ok(block, name);
      assert.doesNotMatch(block, /if:.*test_policy|if:.*runTests/, name);
    }
  }
  assert.match(
    pages,
    /Assemble exact current ZIP and historical metadata bridges\n\s+if: github\.event_name != 'pull_request' \|\| vars\.REVEALLINE_FULL_CI == 'true'/,
  );
  assert.match(
    pages,
    /Independently reread every prepared artifact byte\n\s+if: github\.event_name != 'pull_request' \|\| vars\.REVEALLINE_FULL_CI == 'true'/,
  );
  assert.match(
    pages,
    /Defer Pages artifact assembly to main publication\n\s+if: github\.event_name == 'pull_request' && vars\.REVEALLINE_FULL_CI != 'true'/,
  );
});

test("draft staging shares the bounded maintenance path policy without checking out PR code", async () => {
  const workflow = await fs.readFile(
    new URL(
      "../../.github/workflows/stage-unallocated-pr.yml",
      import.meta.url,
    ),
    "utf8",
  );
  for (const path of [
    "docs\\/",
    "publishing\\/",
    "\\.github\\/workflows\\/",
    "game\\/test\\/",
  ])
    assert.ok(workflow.includes(path), `Missing maintenance path: ${path}`);
  assert.match(workflow, /github\.paginate\(github\.rest\.pulls\.listFiles/);
  assert.match(workflow, /files\.length > 0/);
  assert.match(workflow, /files\.every/);
  assert.match(workflow, /if \(maintenance\) \{[\s\S]*?return;/);
  assert.doesNotMatch(
    workflow,
    /actions\/checkout|pull_request_target[\s\S]*?run:/,
  );
  assert.match(workflow, /convertPullRequestToDraft/);
});

test("publisher infrastructure suites run only when full CI and the test policy are enabled", async () => {
  const workflow = await fs.readFile(
    new URL(
      "../../.github/workflows/publish-frozen-pages.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const block = workflow
    .split("      - name: ")
    .find((value) =>
      value.startsWith(
        "Verify metadata bridges and bounded ZIP extraction in full mode\n",
      ),
    );
  assert.ok(block);
  const expression = /^        if: (.+)$/m.exec(block)?.[1];
  assert.ok(expression);
  const evaluate = new Function("vars", "steps", "return (" + expression + ")");
  for (const fullCI of ["true", "false", "", undefined]) {
    for (const runTests of ["true", "false", "", undefined]) {
      assert.equal(
        evaluate(
          { REVEALLINE_FULL_CI: fullCI },
          { test_policy: { outputs: { runTests } } },
        ),
        fullCI === "true" && runTests === "true",
        String(fullCI) + " / " + String(runTests),
      );
    }
  }
  assert.match(
    block,
    /node --test publishing\/test-policy\.test\.mjs publishing\/pages-controller\/\*\.test\.mjs/,
  );
  assert.match(
    block,
    /python3 -m unittest discover -s publishing\/pages-controller -p 'test_\*\.py' -v/,
  );
  assert.doesNotMatch(block, /continue-on-error|\|\| true/);
});

test("Pages authority fallback restores and saves a bounded conditional ETag cache", async () => {
  const workflow = await fs.readFile(
    new URL(
      "../../.github/workflows/publish-frozen-pages.yml",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    workflow,
    /actions\/cache\/restore@0057852bfaa89a56745cba8c7296529d2fc39830/u,
  );
  assert.match(
    workflow,
    /actions\/cache\/save@0057852bfaa89a56745cba8c7296529d2fc39830/u,
  );
  assert.match(workflow, /\.cache\/frozen-pages\/authority-etags\.json/u);
  assert.match(workflow, /frozen-pages-authority-\$\{\{ runner\.os \}\}-/u);
  assert.match(
    workflow,
    /if: success\(\) && hashFiles\('\.cache\/frozen-pages\/authority-etags\.json'\) != ''/u,
  );
});

test("freeze admits required-success or explicit-waiver-skipped only, never failure or cancellation", async () => {
  const manual = await fs.readFile(
    new URL(
      "../../.github/workflows/qualify-release-source.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const match = /  freeze:\n    if: >-\n([\s\S]*?)\n    needs:/.exec(manual);
  assert.ok(match);
  const expression = match[1]
    .trim()
    .replace(/^\$\{\{/, "")
    .replace(/\}\}$/, "");
  const evaluate = new Function(
    "cancelled",
    "github",
    "inputs",
    "needs",
    "return (" + expression + ")",
  );
  for (const cancelled of [false, true])
    for (const mode of ["required", "waived", ""])
      for (const qualify of ["success", "failure", "skipped", "cancelled"])
        for (const tests of ["success", "failure", "skipped", "cancelled"]) {
          const result = evaluate(
            () => cancelled,
            { event_name: "workflow_dispatch" },
            { operation: "qualify", freeze_snapshot: true },
            {
              qualify: { result: qualify, outputs: { testMode: mode } },
              test: { result: tests },
            },
          );
          assert.equal(
            result,
            !cancelled &&
              qualify === "success" &&
              ((mode === "required" && tests === "success") ||
                (mode === "waived" && tests === "skipped")),
          );
        }
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
  const positive = "publishing/pages-controller/**";
  const negative = "!publishing/pages-controller/delivery/**";
  assert.ok(push.includes(positive));
  assert.equal(push.split(negative).length - 1, 1);
  assert.ok(push.indexOf(negative) > push.indexOf(positive));
  assert.ok(pullRequest.includes(positive));
  assert.ok(!pullRequest.includes(negative));
  assert.match(push, /branches: \[main\]/);
  for (const previewOnlyPath of [
    ".github/workflows/publish-frozen-pages.yml",
    "scripts/pages-archive.mjs",
    "scripts/pages-current-entry.mjs",
  ]) {
    assert.ok(!push.includes(previewOnlyPath));
    assert.ok(pullRequest.includes(previewOnlyPath));
  }
  assert.ok(push.includes("!publishing/pages-controller/evidence/**"));
  assert.ok(
    push.includes("!publishing/pages-controller/source-qualification.mjs"),
  );
  assert.ok(
    push.includes("!publishing/pages-controller/release-train-boundary.mjs"),
  );
  assert.ok(
    push.includes(
      "!publishing/pages-controller/release-train-boundary.test.mjs",
    ),
  );
  assert.ok(push.includes("!publishing/pages-controller/*.test.mjs"));
  assert.ok(push.includes("!publishing/pages-controller/test_*.py"));
  assert.match(workflow, /publish\.mjs verify-artifact/);
});
