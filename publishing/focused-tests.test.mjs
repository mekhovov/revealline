import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { focusedTestPlan } from "./focused-tests.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  await readFile(path.join(directory, "focused-test-map.json"), "utf8"),
);

test("localization and offline paths select only their bounded gates", () => {
  const plan = focusedTestPlan(
    ["game/localization/en.json", "game/offline/install.mjs"],
    manifest,
  );
  assert.deepEqual(plan.categories, ["localization", "offline"]);
  assert.equal(plan.unknownRuntime.length, 0);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ["i18n-check", "localization-runtime", "offline-runtime"],
  );
});

test("unknown runtime paths fail closed through validate", () => {
  const plan = focusedTestPlan(["game/new-player-runtime.mjs"], manifest);
  assert.deepEqual(plan.categories, []);
  assert.deepEqual(plan.unknownRuntime, ["game/new-player-runtime.mjs"]);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ["unknown-runtime-validate"],
  );
});

test("release roots delegate unknown-runtime validation to their required exact-head build", () => {
  const plan = focusedTestPlan(["game/new-player-runtime.mjs"], manifest, {
    fallbackHandled: true,
  });
  assert.deepEqual(plan.categories, []);
  assert.deepEqual(plan.unknownRuntime, ["game/new-player-runtime.mjs"]);
  assert.deepEqual(plan.commands, []);
});

test("Team picture authority changes avoid the broad navigation matrix", () => {
  const plan = focusedTestPlan(
    [
      "game/couch/coop-picture-bindings.mjs",
      "game/couch/coop-presentation.mjs",
      "game/test/coop-historical-import-picture.test.mjs",
      "game/test/coop-picture-bindings.test.mjs",
      "game/test/coop-reviewed-successor-picture.test.mjs",
      "package.json",
      "package-lock.json",
      "game/build-config.json",
    ],
    manifest,
  );
  assert.deepEqual(plan.categories, ["team-picture-bindings"]);
  assert.deepEqual(plan.unknownRuntime.sort(), [
    "game/build-config.json",
    "package-lock.json",
    "package.json",
  ]);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ["team-picture-bindings", "unknown-runtime-validate"],
  );
});

test("other Team runtime paths retain the navigation gate", () => {
  const plan = focusedTestPlan(["game/couch/relay-rescue.mjs"], manifest);
  assert.deepEqual(plan.categories, ["localization", "player-navigation-team"]);
  assert.deepEqual(plan.unknownRuntime, []);
});

test("documentation-only changes have a zero-command bounded plan", () => {
  const plan = focusedTestPlan(["docs/fast-release-mode.md"], manifest);
  assert.deepEqual(plan, { categories: [], unknownRuntime: [], commands: [] });
});

test("changed test files are executed directly without shell evaluation", () => {
  const plan = focusedTestPlan(["game/test/offline-new.test.mjs"], manifest);
  assert.ok(plan.commands.some(({ id }) => id === "offline-runtime"));
  assert.ok(
    plan.commands.some(
      ({ id }) => id === "changed-test:game/test/offline-new.test.mjs",
    ),
  );
});

test("manifest-declared changed tests are not executed twice", () => {
  const plan = focusedTestPlan(
    ["game/test/coop-picture-bindings.test.mjs"],
    manifest,
  );
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ["team-picture-bindings"],
  );
});

test("publishing changes run the exact-head controller, authority, determinism and public-byte gates", () => {
  const plan = focusedTestPlan(
    ["publishing/pages-controller/public-byte-audit.mjs"],
    manifest,
  );
  assert.deepEqual(plan.categories, ["publishing"]);
  const command = plan.commands.find(
    ({ id }) => id === "publishing-controller",
  );
  assert.ok(command);
  for (const required of [
    "publishing/focused-tests.test.mjs",
    "publishing/fastline-merge-controller.test.mjs",
    "publishing/fastline-release-inputs.test.mjs",
    "publishing/fastline-release-objects.test.mjs",
    "publishing/fastline-release-publisher.test.mjs",
    "publishing/pages-controller/archive-authority.test.mjs",
    "publishing/pages-controller/assemble.test.mjs",
    "publishing/pages-controller/metadata.test.mjs",
    "publishing/pages-controller/public-byte-audit.test.mjs",
    "publishing/pages-controller/release-asset.test.mjs",
  ])
    assert.ok(
      command.args.includes(required),
      `Missing focused gate: ${required}`,
    );
});

test("unsafe paths and empty selections are rejected", () => {
  assert.throws(() => focusedTestPlan([], manifest), /requires bounded/u);
  assert.throws(
    () => focusedTestPlan(["../outside.mjs"], manifest),
    /requires bounded/u,
  );
});
