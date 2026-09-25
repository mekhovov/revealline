import test from "node:test";
import assert from "node:assert/strict";
import {
  createJourneyRelayWatchpostsSpatialPairCandidates,
  JOURNEY_RELAY_WATCHPOSTS_SPATIAL_DISPOSITIONS,
} from "../content-design/journey-relay-watchposts-spatial-pair.mjs";
import { createJourneyRelayCompoundsSpatialPairCandidates } from "../content-design/journey-relay-compounds-spatial-pair.mjs";
import {
  compileContentProject,
  resolveMission,
} from "../content-design/project.mjs";
import { inspectMissionTopology } from "../content-design/diagnostics.mjs";
import { createRun, stepRun, FIXED_DT } from "../core/index.mjs";
import { inspectCaptureSnapshot } from "../core/capture-regions.mjs";

const IDS = ["nested-relays", "watchpost-exchange"];
const PRESETS = ["gentle", "standard", "expert"];
const CONTROLS = ["immediate", "grid-center"];
const oldSource = createJourneyRelayCompoundsSpatialPairCandidates({
  artwork: true,
});
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyRelayWatchpostsSpatialPairCandidates({
  artwork: true,
});
const oldProject = compileContentProject(oldSource);
const project = compileContentProject(revisedSource);

function mission(compiledProject, id) {
  return compiledProject.missions.find((item) => item.id === id);
}

function map(compiledProject, id) {
  const current = mission(compiledProject, id);
  return compiledProject.maps.find(
    (item) =>
      item.source.id === current.map.id &&
      item.source.revision === current.map.revision,
  );
}

function stepUntil(run, direction, predicate, maxTicks = 3600) {
  let ticks = 0;
  while (!predicate(run) && ticks < maxTicks) {
    stepRun(run, { direction }, FIXED_DT);
    ticks++;
    assert.equal(run.status, "running");
    assert.equal(run.classic.livesLost, 0);
  }
  assert.equal(
    predicate(run),
    true,
    `route did not finish within ${maxTicks} ticks`,
  );
  return ticks;
}

function idle(run, ticks) {
  for (let tick = 0; tick < ticks; tick++) {
    stepRun(run, { direction: null }, FIXED_DT);
    assert.equal(run.status, "running");
    assert.equal(run.classic.livesLost, 0);
  }
}

function closeRoute(run, route) {
  if (route === "upper-ring-first") {
    stepUntil(run, "up", (state) =>
      state.events.some((event) => event.type === "cut.closed"),
    );
  } else if (route === "inner-drop-first") {
    // The short read is deliberate counterplay: it lets the horizontal keeper
    // clear the vertical relay stem before the craft exposes its trail.
    idle(run, 30);
    stepUntil(run, "left", (state) => state.player.x <= 28.6);
    stepUntil(run, "down", (state) => state.player.y >= 21.4);
    stepUntil(run, "right", (state) => state.player.x >= 45.4);
    stepUntil(run, "up", (state) => state.player.y <= 18.6);
    stepUntil(run, "right", (state) => state.player.x >= 56.4);
    stepUntil(run, "up", (state) =>
      state.events.some((event) => event.type === "cut.closed"),
    );
  } else if (route === "northwest-drop-first") {
    stepUntil(run, "down", (state) =>
      state.events.some((event) => event.type === "cut.closed"),
    );
  } else if (route === "southeast-perimeter-first") {
    stepUntil(run, "right", (state) => state.player.x >= 71.4);
    stepUntil(run, "down", (state) => state.player.y >= 35.4);
    stepUntil(run, "left", (state) => state.player.x <= 52.6);
    stepUntil(run, "up", (state) =>
      state.events.some((event) => event.type === "cut.closed"),
    );
  } else throw new TypeError(`Unknown route ${route}`);
}

test("Relay watchposts pair records two redesign dispositions and preserves historical identities", () => {
  assert.deepEqual(
    createJourneyRelayCompoundsSpatialPairCandidates({ artwork: true }),
    oldSnapshot,
  );
  assert.deepEqual(
    Object.keys(JOURNEY_RELAY_WATCHPOSTS_SPATIAL_DISPOSITIONS),
    IDS,
  );
  for (const disposition of Object.values(
    JOURNEY_RELAY_WATCHPOSTS_SPATIAL_DISPOSITIONS,
  )) {
    assert.equal(disposition.disposition, "redesign");
    assert.equal(disposition.approaches.length, 2);
    assert.equal(new Set(disposition.approaches).size, 2);
  }
  assert.equal(revisedSource.revision, "relay-watchposts-spatial-pair-1");
  assert.equal(revisedSource.policyId, oldSource.policyId);
  assert.equal(revisedSource.actorCatalogId, oldSource.actorCatalogId);
  assert.equal(
    revisedSource.difficultyCatalogId,
    oldSource.difficultyCatalogId,
  );
  assert.deepEqual(revisedSource.assets, oldSource.assets);
  assert.deepEqual(
    revisedSource.campaigns.map((campaign) => [
      campaign.id,
      campaign.missionIds,
    ]),
    oldSource.campaigns.map((campaign) => [campaign.id, campaign.missionIds]),
  );
  assert.deepEqual(
    revisedSource.packs.map((pack) => [pack.id, pack.campaignIds]),
    oldSource.packs.map((pack) => [pack.id, pack.campaignIds]),
  );
  for (const current of project.missions) {
    const previous = mission(oldProject, current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
    else {
      assert.equal(current.revision, "relay-watchposts-spatial-pair-1");
      assert.equal(current.id, previous.id);
      assert.equal(current.name, previous.name);
      assert.equal(current.coverage, previous.coverage);
      assert.deepEqual(current.objectives, previous.objectives);
      assert.deepEqual(current.relayLinks, previous.relayLinks);
      assert.deepEqual(current.presentation, previous.presentation);
      assert.deepEqual(current.modes, previous.modes);
      assert.deepEqual(current.actors, previous.actors);
      assert.equal(current.design.routeDecision.includes(" or "), true);
      assert.match(current.design.mastery, /without losing a life/);
    }
  }
});

test("nested rings and four watch sectors retain valid governed fields and relay topology", () => {
  const expected = {
    "nested-relays": {
      walls: 5,
      foundations: 8,
      fields: 2,
      safe: 3,
      retainerCounts: [1, 2],
      diagnostics: ["disconnected-foundations"],
    },
    "watchpost-exchange": {
      walls: 9,
      foundations: 3,
      fields: 4,
      safe: 1,
      retainerCounts: [1, 1, 1, 1],
      diagnostics: [],
    },
  };
  for (const id of IDS) {
    const previousMission = mission(oldProject, id);
    const currentMission = mission(project, id);
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, "relay-watchposts-spatial-pair-1");
    assert.equal(currentMap.source.walls.length, expected[id].walls);
    assert.equal(
      currentMap.source.foundations.length,
      expected[id].foundations,
    );
    assert.deepEqual(currentMap.source.gates, previousMap.source.gates);
    assert.deepEqual(currentMission.objectives, previousMission.objectives);
    assert.equal(
      currentMap.geometry.fieldComponents.length,
      expected[id].fields,
    );
    assert.equal(currentMap.geometry.safeComponents.length, expected[id].safe);
    assert.deepEqual(
      currentMap.geometry.diagnostics.map((item) => item.code),
      expected[id].diagnostics,
    );
    assert(
      currentMap.geometry.safeComponents.every(
        (item) => item.departures.length >= 60,
      ),
    );
    for (const difficulty of PRESETS) {
      const solo = resolveMission(project, id, { difficulty, mode: "solo" });
      const versus = resolveMission(project, id, {
        difficulty,
        mode: "versus",
      });
      const previous = resolveMission(oldProject, id, {
        difficulty,
        mode: "solo",
      });
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
      assert.deepEqual(solo.level.relayGates, previous.level.relayGates);
      const run = createRun(solo.level, { seed: 1, classId: "scout" });
      const capture = inspectCaptureSnapshot(run);
      assert.equal(capture.components.length, expected[id].fields);
      assert.equal(capture.filledCells.length, 0);
      assert(capture.components.every((component) => component.retained));
      assert.deepEqual(
        capture.components.map((component) => component.enemyIds.length).sort(),
        expected[id].retainerCounts,
      );
      assert.deepEqual(
        inspectMissionTopology(solo.level, currentMap.geometry).diagnostics,
        [],
      );
    }
  }
});

for (const id of IDS)
  for (const difficulty of PRESETS)
    test(`${id} has no unavoidable idle opening pressure on ${difficulty}`, () => {
      const manifest = resolveMission(project, id, { difficulty });
      for (const seed of [1, 2]) {
        const run = createRun(manifest.level, { seed, classId: "scout" });
        idle(run, 720);
        assert.equal(run.claimedCount, 0);
      }
    });

for (const [id, disposition] of Object.entries(
  JOURNEY_RELAY_WATCHPOSTS_SPATIAL_DISPOSITIONS,
))
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${id} supports two authored first approaches on ${difficulty} with ${turnPolicy}`, () => {
        for (const route of disposition.approaches) {
          const manifest = resolveMission(project, id, { difficulty });
          const run = createRun(manifest.level, {
            seed: 1,
            classId: "scout",
            turnPolicy,
          });
          closeRoute(run, route);
          assert(run.claimedCount > 0, `${id}/${route}`);
          assert.equal(run.player.speed, 0, `${id}/${route}`);
          assert.equal(run.classic.livesLost, 0, `${id}/${route}`);
        }
      });

const relayRoutes = Object.freeze({
  "upper-ring-first": Object.freeze({
    objectiveId: "upper-relay",
    gateId: "inner-link",
  }),
  "inner-drop-first": Object.freeze({
    objectiveId: "inner-relay",
    gateId: "lower-link",
  }),
  "northwest-drop-first": Object.freeze({
    objectiveId: "northwest-relay",
    gateId: "west-junction",
  }),
  "southeast-perimeter-first": Object.freeze({
    objectiveId: "southeast-relay",
    gateId: "east-junction",
  }),
});

for (const [route, signature] of Object.entries(relayRoutes)) {
  const id =
    route.includes("ring") || route.includes("inner")
      ? "nested-relays"
      : "watchpost-exchange";
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${id} ${route} opens only its matching relay on ${difficulty} with ${turnPolicy}`, () => {
        const manifest = resolveMission(project, id, { difficulty });
        const run = createRun(manifest.level, {
          seed: 1,
          classId: "scout",
          turnPolicy,
        });
        closeRoute(run, route);
        assert(
          run.events.some(
            (event) =>
              event.type === "objective.captured" &&
              event.id === signature.objectiveId,
          ),
        );
        assert(
          run.events.some(
            (event) =>
              event.type === "relay.opened" && event.id === signature.gateId,
          ),
        );
        assert.equal(
          run.relay.gates.find((gate) => gate.id === signature.gateId)
            .openedTick !== null,
          true,
        );
        assert.equal(
          run.relay.gates
            .filter((gate) => gate.openedTick !== null)
            .map((gate) => gate.id)
            .join(","),
          signature.gateId,
        );
        assert.equal(run.classic.livesLost, 0);
      });
}
