import test from "node:test";
import assert from "node:assert/strict";
import {
  createMissionLibrary,
  libraryMissionId,
} from "../mission-library/library.mjs";

const entry = (id = "shared-name", modes = ["solo", "versus"]) => ({
  id,
  campaignKey: "campaign/revision/fingerprint",
  campaignTitle: "Original campaign",
  name: "Shared name",
  levelIndex: 8,
  modes,
  tags: ["Arcade"],
  rules: "65% · 3 lives",
});
function source(overrides = {}) {
  return {
    id: "original",
    editionId: "edition-1",
    edition: "Original edition",
    collection: "Classic",
    entries: [entry()],
    describe: (value) => value,
    availability: () => ({ state: "ready" }),
    launch: () => true,
    ...overrides,
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("All orders Journey, Classic and Custom, preserving each owner authored order", () => {
  const library = createMissionLibrary([
    source({ id: "custom", collection: "Custom" }),
    source({ entries: [entry("last"), entry("first")] }),
    source({ id: "new", collection: "Journey" }),
  ]);
  assert.deepEqual(
    library.missions.map((row) => row.collection),
    ["Journey", "Classic", "Classic", "Custom"],
  );
  assert.deepEqual(
    library.missions.slice(1, 3).map((row) => row.runtimeId),
    ["last", "first"],
  );
  assert.equal(
    library.next,
    undefined,
    "Browsing must not provide combined progression.",
  );
});

test("same names and runtime IDs in different editions/owners remain distinct", () => {
  const library = createMissionLibrary([
    source(),
    source({ id: "archive", editionId: "edition-0" }),
  ]);
  assert.equal(new Set(library.missions.map((row) => row.id)).size, 2);
  assert.notEqual(
    library.missions[0].campaignKey,
    library.missions[1].campaignKey,
  );
  const parts = { owner: "a/b", edition: "c", campaign: "d", mission: "e" };
  assert.notEqual(
    libraryMissionId(parts),
    libraryMissionId({ ...parts, owner: "a", edition: "b/c" }),
  );
});

test("automatic continuation defaults on and only accepts explicit booleans", () => {
  const library = createMissionLibrary([source()]);
  const original = library.missions[0];
  assert.equal(original.automaticContinuation, true);
  for (const value of [null, 0, 1, "", "false", {}]) {
    assert.throws(
      () => library.register(source({ automaticContinuation: value })),
      /automatic continuation must be a boolean/,
    );
    assert.equal(
      library.missions[0],
      original,
      "Reject atomically without replacing its owner",
    );
  }
  library.register(source({ automaticContinuation: false }));
  assert.equal(library.missions[0].automaticContinuation, false);
  assert.equal(
    library.launch(library.missions[0]),
    true,
    "Browse-only remains playable",
  );
  library.register(source({ automaticContinuation: true }));
  assert.equal(library.missions[0].automaticContinuation, true);
});

test("search covers edition, campaign, tags and rules; filters are mode-aware", () => {
  const library = createMissionLibrary([
    source(),
    source({
      id: "team",
      collection: "Journey",
      entries: [entry("coop", ["team"])],
    }),
  ]);
  assert.equal(library.search("original arcade 65%").length, 1);
  assert.equal(library.search("", { mode: "team" }).length, 1);
  assert.equal(library.search("", { collection: "Custom" }).length, 0);
  assert.equal(
    library.search("", { campaign: library.missions[1].campaignKey }).length,
    1,
  );
  assert.throws(() => library.search("", { mode: "online" }));
});

test("late mission launches exact original object without inventing clears or modifying it", () => {
  const original = Object.freeze(entry());
  let launched;
  const library = createMissionLibrary([
    source({
      entries: [original],
      launch: (value, context) => {
        launched = { value, context };
      },
    }),
  ]);
  const row = library.missions[0];
  assert.equal(library.progress(row, "solo"), "");
  library.launch(row, { mode: "solo" });
  assert.equal(launched.value, original);
  assert.equal(launched.context.mode, "solo");
  assert.equal(library.progress(row, "solo"), "");
  assert.throws(() => library.launch({ ...row }), /stale/);
  assert.throws(() => library.launch(row, { mode: "team" }), /support/);
});

test("metadata cannot manufacture ready state, an exact installed replacement invalidates old rows", () => {
  const library = createMissionLibrary([
    source({ availability: () => ({ state: "download", bytes: 1234 }) }),
  ]);
  const old = library.missions[0];
  assert.throws(() => library.launch(old), /Prepare/);
  library.register(source());
  assert.equal(library.missions.length, 1);
  assert.equal(library.missions[0].id, old.id);
  assert.throws(() => library.launch(old), /stale/);
  assert.equal(library.launch(library.missions[0]), true);
});

test("reject duplicate source rows atomically without invalidating accepted content", () => {
  const library = createMissionLibrary([source()]);
  const old = library.missions[0];
  assert.throws(
    () => library.register(source({ entries: [entry(), entry()] })),
    /duplicate/,
  );
  assert.equal(library.missions[0], old);
  assert.equal(library.launch(old), true);
});

test("prepare reports a bounded download, becomes Play-ready, and never launches automatically", async () => {
  let ready = false,
    launches = 0,
    finish;
  const library = createMissionLibrary([
    source({
      availability: () =>
        ready ? { state: "ready" } : { state: "download", bytes: 200 },
      prepare: () =>
        new Promise((resolve) => {
          finish = () => {
            ready = true;
            resolve();
          };
        }),
      launch: () => launches++,
    }),
  ]);
  const row = library.missions[0];
  const result = library.prepare(row);
  assert.equal(library.availability(row).state, "preparing");
  assert.throws(() => library.launch(row), /Prepare/);
  await tick();
  finish();
  assert.deepEqual(await result, { state: "ready" });
  assert.equal(launches, 0);
  library.launch(row);
  assert.equal(launches, 1);
});

test("download failure exposes reason and retry, retaining original row and progress", async () => {
  let calls = 0,
    ready = false;
  const library = createMissionLibrary([
    source({
      availability: () =>
        ready ? { state: "ready" } : { state: "download", bytes: 200 },
      progress: () => "Cleared",
      prepare: async () => {
        if (!calls++) throw new Error("Offline");
        ready = true;
      },
    }),
  ]);
  const row = library.missions[0];
  await assert.rejects(library.prepare(row), /Offline/);
  assert.deepEqual(library.availability(row), {
    state: "unavailable",
    reason: "Offline",
    retry: true,
  });
  await library.prepare(row);
  assert.equal(library.availability(row).state, "ready");
  assert.equal(library.progress(row), "Cleared");
  assert.equal(library.missions[0], row);
});

test("cancel settles immediately even if a transport ignores AbortSignal; a late failure cannot revive error", async () => {
  let fail, transportSignal;
  const library = createMissionLibrary([
    source({
      availability: () => ({ state: "download", bytes: 200 }),
      prepare: (_, { signal }) => {
        transportSignal = signal;
        return new Promise((_, reject) => {
          fail = reject;
        });
      },
    }),
  ]);
  const row = library.missions[0];
  const operation = library.prepare(row);
  await tick();
  library.cancel(row);
  assert.equal(transportSignal.aborted, true);
  assert.deepEqual(await operation, { state: "cancelled" });
  fail(new Error("Late failure"));
  await tick();
  assert.deepEqual(library.availability(row), {
    state: "download",
    bytes: 200,
  });
});

test("owner replacement cancels preparations and rejects stale selection without merging modified Custom", async () => {
  const library = createMissionLibrary([
    source({
      availability: () => ({ state: "download", bytes: 200 }),
      prepare: () => new Promise(() => {}),
    }),
  ]);
  const old = library.missions[0],
    operation = library.prepare(old);
  await tick();
  library.register(source());
  library.register(source({ id: "import-modified", collection: "Custom" }));
  assert.deepEqual(await operation, { state: "cancelled" });
  assert.equal(library.missions.length, 2);
  assert.throws(() => library.launch(old), /stale/);
});

test("aborted external signal never starts preparation and disposed registry never launches", async () => {
  let calls = 0;
  const library = createMissionLibrary([
    source({
      availability: () => ({ state: "download", bytes: 200 }),
      prepare: () => calls++,
    }),
  ]);
  const row = library.missions[0],
    controller = new AbortController();
  controller.abort();
  assert.deepEqual(await library.prepare(row, { signal: controller.signal }), {
    state: "cancelled",
  });
  assert.equal(calls, 0);
  library.dispose();
  assert.throws(() => library.launch(row), /stale/);
  assert.equal(library.missions.length, 0);
});

test("availability never silently invents readiness or download sizes", () => {
  const library = createMissionLibrary([
    source({ availability: () => ({ state: "download", bytes: 0 }) }),
  ]);
  assert.throws(() => library.availability(library.missions[0]), /byte size/);
  assert.throws(
    () =>
      createMissionLibrary([source({ entries: [entry("bad", ["online"])] })]),
    /supported modes/,
  );
});

test("reentrant availability reconciliation cannot launch or prepare a stale owner", async () => {
  for (const action of ["launch", "prepare"]) {
    let calls = 0;
    const library = createMissionLibrary();
    library.register(
      source({
        availability: () => {
          library.register(source());
          return action === "launch"
            ? { state: "ready" }
            : { state: "download", bytes: 200 };
        },
        launch: () => calls++,
        prepare: () => calls++,
      }),
    );
    const original = library.missions[0];
    if (action === "launch")
      assert.throws(() => library.launch(original), /stale/);
    else await assert.rejects(library.prepare(original), /stale/);
    assert.equal(calls, 0);
  }
});

test("Solo preparation and failure cannot poison a ready Versus mission", async () => {
  let reject;
  const library = createMissionLibrary([
    source({
      availability: (_, mode) =>
        mode === "versus"
          ? { state: "ready" }
          : { state: "download", bytes: 200 },
      prepare: () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    }),
  ]);
  const row = library.missions[0];
  const operation = library.prepare(row, { mode: "solo" });
  await tick();
  assert.equal(library.availability(row, "solo").state, "preparing");
  assert.equal(library.availability(row, "versus").state, "ready");
  reject(new Error("Solo preparation failed"));
  await assert.rejects(operation, /Solo preparation failed/);
  assert.equal(library.availability(row, "solo").state, "unavailable");
  assert.equal(library.availability(row, "versus").state, "ready");
  assert.equal(library.launch(row, { mode: "versus" }), true);
});
