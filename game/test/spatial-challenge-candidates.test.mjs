import test from "node:test";
import assert from "node:assert/strict";
import {
  createSpatialChallengeCandidates,
  SPATIAL_CHALLENGE_MISSION_IDS,
  SPATIAL_CHALLENGE_REVISION,
} from "../content-design/spatial-challenge-candidates.mjs";
import { createWholeSortingCandidates } from "../content-design/whole-spatial-candidates.mjs";
import {
  compileContentProject,
  resolveMission,
} from "../content-design/project.mjs";
import { freezeDesign } from "../content-design/catalogs.mjs";
import { createRun, stepRun, FIXED_DT } from "../core/index.mjs";
import { inspectCaptureSnapshot } from "../core/capture-regions.mjs";
import { CELL } from "../core/registry.mjs";
import {
  applyGameplayTuning,
  resolveGameplayTuning,
} from "../gameplay-tuning.mjs";

const ids = new Set(SPATIAL_CHALLENGE_MISSION_IDS);
const source = createSpatialChallengeCandidates();
const project = compileContentProject(source);
const presets = ["gentle", "standard", "expert"];
const controls = ["immediate", "grid-center"];
const tuned = (id, difficulty = "standard") =>
  applyGameplayTuning(
    resolveMission(project, id, { difficulty }).level,
    resolveGameplayTuning(difficulty),
  );

for (const artwork of [false, true])
  test(`successor preserves the other 86 missions, identities, order and artwork: ${artwork}`, () => {
    const before = createWholeSortingCandidates({ artwork });
    const original = structuredClone(before);
    const next = createSpatialChallengeCandidates({
      artwork,
      source: freezeDesign(before),
    });
    assert.deepEqual(before, original);
    assert.equal(next.missions.length, 91);
    assert.equal(next.maps.length, 91);
    assert.deepEqual(next.assets, before.assets);
    for (const key of ["missions", "campaigns", "packs"])
      assert.deepEqual(
        next[key].map((item) => item.id),
        before[key].map((item) => item.id),
      );
    assert.equal(next.policyId, before.policyId);
    assert.equal(next.actorCatalogId, before.actorCatalogId);
    assert.equal(next.difficultyCatalogId, before.difficultyCatalogId);
    for (const mission of next.missions) {
      const previous = before.missions.find((item) => item.id === mission.id);
      assert.deepEqual(mission.presentation, previous.presentation);
      assert.equal(mission.coverage, previous.coverage);
      assert.equal(mission.timeLimitSeconds, previous.timeLimitSeconds);
      if (!ids.has(mission.id)) assert.deepEqual(mission, previous);
      else {
        assert.equal(mission.revision, SPATIAL_CHALLENGE_REVISION);
        assert.equal(mission.map.id, previous.map.id);
        assert.equal(mission.map.revision, SPATIAL_CHALLENGE_REVISION);
        assert.notEqual(mission.revision, previous.revision);
      }
    }
    assert.deepEqual(next.missions.slice(0, 3), before.missions.slice(0, 3));
    next.missions[0].name = "Local edit";
    assert.deepEqual(createWholeSortingCandidates({ artwork }), original);
  });

test("supplied Twin revision composes without being overwritten or mutating its owner", () => {
  const base = createWholeSortingCandidates();
  const twin = base.missions.find((mission) => mission.id === "twin-receivers");
  twin.revision = "injected-receiver-test";
  twin.design.lesson = "An independently reviewed receiver teaching revision.";
  const snapshot = structuredClone(base);
  const next = createSpatialChallengeCandidates({ source: freezeDesign(base) });
  assert.deepEqual(base, snapshot);
  assert.deepEqual(
    next.missions.find((mission) => mission.id === twin.id),
    twin,
  );
});

test("all pilot presets preserve shared rules and identical Solo/Versus boards", () => {
  const before = compileContentProject(createWholeSortingCandidates());
  for (const difficulty of presets)
    for (const id of SPATIAL_CHALLENGE_MISSION_IDS) {
      const solo = resolveMission(project, id, { difficulty });
      const versus = resolveMission(project, id, {
        difficulty,
        mode: "versus",
      });
      const old = resolveMission(before, id, { difficulty });
      assert.deepEqual(solo.level, versus.level);
      assert.deepEqual(solo.level.rules, old.level.rules);
      assert.deepEqual(solo.level.goal, old.level.goal);
      assert.notEqual(solo.simulationIdentity, old.simulationIdentity);
      const run = createRun(tuned(id, difficulty), { seed: 1 });
      assert.equal(run.width, 72);
      assert.equal(run.height, 36);
      assert.equal(
        inspectCaptureSnapshot(run).filledCells.length,
        0,
        `${id}/${difficulty}`,
      );
    }
});

test("unequal bays each retain enemies and neither bay alone supplies the unchanged quota", () => {
  const run = createRun(tuned("two-bays"), { seed: 1 });
  const snapshot = inspectCaptureSnapshot(run);
  assert.deepEqual(
    snapshot.components.map((component) => component.enemyIds),
    [["west"], ["east", "east-return"]],
  );
  assert.deepEqual(
    snapshot.components.map((component) => component.cells.length),
    [835, 1407],
  );
  for (const component of snapshot.components)
    assert(
      component.cells.length / run.totalClaimable < run.level.goal.coverage,
    );
});

test("offset return shelves change departure length without opening either retained bay", () => {
  const run = createRun(tuned("two-bays"), { seed: 1 });
  const at = (x, y) => run.cells[y * run.width + x];
  assert.equal(
    at(21, 10),
    CELL.SAFE,
    "Upper west shelf is reclaimed return ground",
  );
  assert.equal(at(21, 25), CELL.FIELD, "No matching lower west shelf");
  assert.equal(
    at(35, 25),
    CELL.SAFE,
    "Lower east shelf is reclaimed return ground",
  );
  assert.equal(at(35, 10), CELL.FIELD, "No matching upper east shelf");
  assert.equal(at(20, 10), CELL.FIELD);
  assert.equal(at(36, 25), CELL.FIELD);
  assert.equal(run.coverage, 0, "Shelves never award earned coverage");
});

test("arrow baffles block later transfers while both opening approaches stay geometrically clear", () => {
  const run = createRun(tuned("read-the-arrows"), { seed: 1 });
  const at = (x, y) => run.cells[y * run.width + x];
  for (const [x, y] of [
    [22, 8],
    [23, 15],
    [47, 19],
    [48, 28],
  ])
    assert.equal(at(x, y), CELL.WALL);
  for (const [x, y] of [
    [22, 7],
    [22, 16],
    [47, 18],
    [47, 29],
  ])
    assert.equal(
      at(x, y),
      CELL.FIELD,
      "Every staggered wall has a usable open end",
    );
  for (let y = 1; y < 17; y++) {
    assert.equal(
      at(35, y),
      CELL.FIELD,
      "First fast approach contains no wall or forced turn",
    );
    assert.equal(run.classic.terrain[y * run.width + 35], 0);
  }
  assert.equal(at(35, 17), CELL.SAFE);
  for (let y = 1; y < 11; y++)
    assert.equal(at(14, y), CELL.FIELD, "Western ordinary approach stays open");
  assert.equal(at(14, 11), CELL.SAFE);
  assert.equal(inspectCaptureSnapshot(run).components.length, 1);
});

test("circuits remain field-connected through three different mouths", () => {
  const run = createRun(tuned("neon-remix"), { seed: 1 });
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(snapshot.components.length, 1);
  assert.deepEqual(snapshot.components[0].enemyIds, ["west", "middle", "east"]);
  const at = (x, y) => run.cells[y * run.width + x];
  for (const [x, y] of [
    [20, 13],
    [35, 15],
    [51, 13],
  ])
    assert.equal(at(x, y), CELL.FIELD);
  for (const [x, y] of [
    [9, 13],
    [35, 28],
    [62, 13],
  ])
    assert.equal(at(x, y), CELL.SAFE);
});

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`protected wall contact never closes a cut or costs a life: ${difficulty}/${turnPolicy}`, () => {
      const run = createRun(tuned("broken-yard", difficulty), {
        seed: 1,
        turnPolicy,
      });
      let closures = 0;
      for (let tick = 0; tick < 300; tick++) {
        stepRun(run, { direction: "left" }, FIXED_DT);
        closures += run.events.filter(
          (event) => event.type === "cut.closed",
        ).length;
      }
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.coverage, 0);
      assert.equal(closures, 0);
      assert.equal(run.player.cutting, false);
      assert.equal(run.trail.length, 0);
      assert(run.player.x >= 25 && run.player.x < 26);
      assert.equal(run.cells[17 * run.width + 24], CELL.WALL);
      assert.equal(inspectCaptureSnapshot(run).components.length, 1);
    });

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`arrow teaching crossing ends on a broad landing at current rates: ${difficulty}/${turnPolicy}`, () => {
      const run = createRun(tuned("read-the-arrows", difficulty), {
        seed: 1,
        turnPolicy,
      });
      let closed = false;
      for (
        let tick = 0;
        tick < 500 && !closed && !run.classic.livesLost;
        tick++
      ) {
        stepRun(run, { direction: "down" }, FIXED_DT);
        closed = run.events.some((event) => event.type === "cut.closed");
      }
      assert(closed);
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.player.cutting, false);
      assert.equal(run.status, "running");
      assert(run.player.x >= 30 && run.player.x < 42);
      assert(run.player.y >= 17 && run.player.y <= 21);
    });
