import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = (name) => readFileSync(
  new URL(`../.github/workflows/${name}.yml`, import.meta.url), "utf8",
);
const candidateJob = () => workflow("company-edition-candidate").split("\n  candidate:\n")[1];

test("candidate qualification retains a bounded archive-finalization margin", () => {
  const job = candidateJob();
  assert.ok(job, "candidate job must exist");
  assert.match(job, /^    timeout-minutes: 45$/m);
  assert.match(job, /Compile twice and inspect original candidate ZIP members/);
  assert.match(job, /node scripts\/bundle-editions\.mjs/);
  assert.match(job, /Save small capacity metadata for review/);
  assert.match(job, /if-no-files-found: error/);
});

test("large immutable candidate upload avoids recompressing existing archives", () => {
  const upload = candidateJob().split("- name: Save immutable candidates for review")[1]?.split("\n      - name:")[0];
  assert.ok(upload, "immutable artifact upload remains mandatory");
  assert.match(upload, /compression-level: 0/);
  assert.match(upload, /path: \.cache\/company-candidate\//);
  assert.match(upload, /if-no-files-found: error/);
  assert.doesNotMatch(upload, /continue-on-error|overwrite: true/);
});

test("production deployment finishes validation while pending snapshots coalesce", () => {
  const source = workflow("deploy-main-pages");
  const concurrency = source.split("\nconcurrency:\n")[1]?.split("\nenv:")[0];
  assert.ok(concurrency);
  assert.match(concurrency, /group: pages-production/);
  assert.match(concurrency, /cancel-in-progress: false/);
  assert.doesNotMatch(concurrency, /queue: max/);
  assert.match(source, /Enforce the Pages publication budget/);
  assert.match(source, /Verify exact tracked source after build/);
  assert.match(source, /verify-public-main:/);
});
