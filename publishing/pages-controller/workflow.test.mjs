import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("active workflows pin reviewed Node 24 action runtimes without implicit npm caching", async () => {
  const directory = new URL("../../.github/workflows/", import.meta.url);
  const files = (await fs.readdir(directory)).filter((name) =>
    /\.ya?ml$/u.test(name),
  );
  const pins = new Map([
    ["checkout", "fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09"],
    ["setup-node", "a0853c24544627f65ddf259abe73b1d18a591444"],
    ["upload-artifact", "b7c566a772e6b6bfb58ed0dc250532a479d7789f"],
    ["upload-pages-artifact", "fc324d3547104276b827a68afc52ff2a11cc49c9"],
    ["download-artifact", "37930b1c2abaa49bbe596cd826c3c89aef350131"],
    ["deploy-pages", "368f82528645a54fb793d4d04e342629a3f51346"],
    ["github-script", "ed597411d8f924073f98dfc5c65a23a2325f34cd"],
  ]);
  const seen = new Map([...pins.keys()].map((name) => [name, 0]));

  for (const file of files) {
    const workflow = await fs.readFile(new URL(file, directory), "utf8");
    for (const match of workflow.matchAll(
      /uses:\s+actions\/(checkout|setup-node|upload-artifact|upload-pages-artifact|download-artifact|deploy-pages|github-script)@([^\s#]+)/gu,
    )) {
      const [, action, revision] = match;
      assert.equal(revision, pins.get(action), `${file}: actions/${action}`);
      seen.set(action, seen.get(action) + 1);
    }
    const setupCount = (
      workflow.match(/uses:\s+actions\/setup-node@/gu) || []
    ).length;
    const explicitCachePolicyCount = (
      workflow.match(
        /uses:\s+actions\/setup-node@[^\n]+\n\s+with:\n\s+package-manager-cache:\s+false/gu,
      ) || []
    ).length;
    assert.equal(
      explicitCachePolicyCount,
      setupCount,
      `${file}: every setup-node step must refuse newly implicit caching`,
    );
  }

  for (const [action, count] of seen)
    assert.ok(count > 0, `No active actions/${action} use found`);
});

test("source qualification retains mandatory guards while protected main owns publication", async () => {
  const source = await fs.readFile(
    new URL("../../.github/workflows/deploy-pages.yml", import.meta.url),
    "utf8",
  );
  const frozen = await fs.readFile(
    new URL("../../.github/workflows/publish-frozen-pages.yml", import.meta.url),
    "utf8",
  );
  const continuous = await fs.readFile(
    new URL("../../.github/workflows/deploy-main-pages.yml", import.meta.url),
    "utf8",
  );
  for (const command of [
    "npm run validate",
    "npm run lint",
    "npm run format:check",
    "npm run format:native:check",
    "node --check authoring/motion-lab/app.js",
    "node ../automation/scripts/run-test-shard.mjs --shard ${{ matrix.shard }}/4 --root .",
  ]) assert.ok(source.includes(command), `Missing source gate: ${command}`);
  assert.match(source, /shard: \[1, 2, 3, 4\]/);
  assert.match(source, /fail-fast: false/);
  assert.match(source, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(source, /working-directory: source/);
  assert.match(source, /cache-dependency-path: source\/package-lock\.json/);
  assert.match(source, /node --test scripts\/test-production-\*\.mjs/);
  assert.match(source, /run: npm run build/);
  assert.match(
    source,
    /Require the exact protected main base on public Pages\n\s+if: steps\.admission\.outputs\.mode == 'release'/,
  );
  assert.match(source, /admission-preflight\.mjs/);
  assert.match(source, /release-train-boundary\.mjs public/);
  assert.match(
    source,
    /PR_BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  );
  assert.doesNotMatch(source, /  release_gate:|workflow run publish-frozen-pages\.yml/);
  for (const job of ["preflight", "focused", "test", "build", "release-ready"])
    assert.ok(source.includes(`  ${job}:\n`));

  assert.match(frozen, /  pull_request:\n\s+branches: \[main\]/);
  assert.doesNotMatch(frozen, /  push:|  workflow_dispatch:|deploy-pages@|pages: write/);
  assert.match(frozen, /group: frozen-pages-pr-/);
  assert.match(frozen, /publish\.mjs verify-artifact/);
  assert.match(frozen, /name: frozen-pages-receipts/);

  assert.match(continuous, /  push:\n\s+branches: \[main\]/);
  assert.match(continuous, /  workflow_dispatch:/);
  assert.doesNotMatch(continuous, /  pull_request:/);
  assert.match(continuous, /group: pages-production/);
  assert.match(continuous, /cancel-in-progress: true/);
  assert.match(continuous, /MAX_PUBLISHED_BYTES: 950000000/);
  assert.match(continuous, /run: npm ci --prefer-offline/);
  assert.match(continuous, /main-deployment\.json/);
  assert.match(continuous, /include-hidden-files: true/);
  assert.match(continuous, /environment:\n\s+name: github-pages/);
  assert.match(
    continuous,
    /outputs:\n\s+page_url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/,
  );
  assert.match(continuous, /needs: \[build, deploy\]/);
  assert.ok(
    continuous.indexOf("name: Upload the exact main Pages artifact") <
      continuous.indexOf("  deploy:"),
  );
  assert.doesNotMatch(
    continuous,
    /pull_request_target|environment:.*preview|npm test/,
  );
});

test("public selector retains five releases in main-repository-only history globally", async () => {
  const publication = JSON.parse(
    await fs.readFile(new URL("./publication.json", import.meta.url), "utf8"),
  );
  assert.equal(publication.retainedReleaseCount, 5);
  assert.equal(publication.hostingPolicy, "main-repository-only");
  assert.equal(Object.hasOwn(publication, "retainedReleasesPerMajor"), false);
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
    [pages, ["Validate main-repository selector and current source qualification"]],
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

test("main-only publisher does not query or cache archive authorities", async () => {
  const workflow = await fs.readFile(new URL("../../.github/workflows/publish-frozen-pages.yml", import.meta.url), "utf8");
  const continuous = await fs.readFile(new URL("../../.github/workflows/deploy-main-pages.yml", import.meta.url), "utf8");
  const publisher = await fs.readFile(new URL("./publish.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /archive-authority|authority-etags|actions\/cache\//);
  assert.doesNotMatch(publisher, /verifyArchiveAuthorities|remoteAdmissions|archive-authority/);
  assert.match(publisher, /requireMainRepositoryPolicy\(configuration\)/);
  assert.match(publisher, /Published source qualification does not match the reviewed pin/);
  assert.match(workflow, /publish\.mjs verify-artifact/);
  assert.doesNotMatch(workflow, /deploy-pages@|public-byte-audit\.mjs/);
  assert.match(continuous, /Verify the public root identifies the exact main revision/);
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

test("frozen publication is PR-only while every protected-main push deploys", async () => {
  const frozen = await fs.readFile(
    new URL(
      "../../.github/workflows/publish-frozen-pages.yml",
      import.meta.url,
    ),
    "utf8",
  );
  const continuous = await fs.readFile(
    new URL("../../.github/workflows/deploy-main-pages.yml", import.meta.url),
    "utf8",
  );
  const pullRequest = frozen.slice(
    frozen.indexOf("  pull_request:"),
    frozen.indexOf("\npermissions:"),
  );
  assert.ok(pullRequest.includes("publishing/pages-controller/**"));
  for (const previewOnlyPath of [
    ".github/workflows/publish-frozen-pages.yml",
    "scripts/pages-archive.mjs",
    "scripts/pages-current-entry.mjs",
  ]) assert.ok(pullRequest.includes(previewOnlyPath));
  assert.doesNotMatch(frozen, /  push:|  workflow_dispatch:/);
  assert.match(frozen, /publish\.mjs verify-artifact/);
  const push = continuous.slice(
    continuous.indexOf("  push:"),
    continuous.indexOf("  workflow_dispatch:"),
  );
  assert.match(push, /branches: \[main\]/);
  assert.doesNotMatch(push, /paths:|paths-ignore:/);
  assert.doesNotMatch(continuous, /  pull_request:/);
});
