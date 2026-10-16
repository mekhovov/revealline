import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createJourneyCrosswindCompassSpatialPairCandidates,
  JOURNEY_CROSSWIND_COMPASS_SPATIAL_DISPOSITIONS,
} from '../content-design/journey-crosswind-compass-spatial-pair.mjs';
import { createJourneyRelayWatchpostsSpatialPairCandidates } from '../content-design/journey-relay-watchposts-spatial-pair.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const IDS = ['compass-array', 'outer-loop'];
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const oldSource = createJourneyRelayWatchpostsSpatialPairCandidates({
  artwork: true,
});
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyCrosswindCompassSpatialPairCandidates({
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
    (item) => item.source.id === current.map.id && item.source.revision === current.map.revision,
  );
}

function stepUntil(run, direction, predicate, maxTicks = 4000) {
  let ticks = 0;
  while (!predicate(run) && ticks < maxTicks) {
    stepRun(run, { direction }, FIXED_DT);
    ticks++;
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
  }
  assert.equal(predicate(run), true, `route did not finish within ${maxTicks} ticks`);
  return ticks;
}

function idle(run, ticks) {
  for (let tick = 0; tick < ticks; tick++) {
    stepRun(run, { direction: null }, FIXED_DT);
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
  }
}

function closeRoute(run, route) {
  if (route === 'north-neck-first') {
    stepUntil(run, 'up', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else if (route === 'west-arm-first') {
    // This is intentional readable counterplay rather than a fixed delay: wait
    // until the vertical keeper is beyond the intended horizontal trail.
    stepUntil(run, null, (state) => {
      const keeper = state.enemies.find((enemy) => enemy.id === 'west');
      return keeper.y >= 24 && keeper.vy > 0;
    });
    stepUntil(run, 'left', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else if (route === 'inner-post-first') {
    stepUntil(run, 'right', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else if (route === 'outer-post-first') {
    stepUntil(run, 'up', (state) => state.player.y <= 7.6);
    stepUntil(run, 'right', (state) => state.player.x >= 60.4);
    stepUntil(run, 'down', (state) => state.player.y >= 11.4);
    stepUntil(run, 'right', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else throw new TypeError(`Unknown route ${route}`);
}

test('Crosswind compass pair records two redesign dispositions and preserves historical identities', () => {
  assert.deepEqual(
    createJourneyRelayWatchpostsSpatialPairCandidates({ artwork: true }),
    oldSnapshot,
  );
  assert.deepEqual(Object.keys(JOURNEY_CROSSWIND_COMPASS_SPATIAL_DISPOSITIONS), IDS);
  for (const disposition of Object.values(JOURNEY_CROSSWIND_COMPASS_SPATIAL_DISPOSITIONS)) {
    assert.equal(disposition.disposition, 'redesign');
    assert.equal(disposition.approaches.length, 2);
    assert.equal(new Set(disposition.approaches).size, 2);
  }
  assert.equal(revisedSource.revision, 'crosswind-compass-spatial-pair-1');
  assert.equal(revisedSource.policyId, oldSource.policyId);
  assert.equal(revisedSource.actorCatalogId, oldSource.actorCatalogId);
  assert.equal(revisedSource.difficultyCatalogId, oldSource.difficultyCatalogId);
  assert.deepEqual(revisedSource.assets, oldSource.assets);
  assert.deepEqual(
    revisedSource.campaigns.map((campaign) => [campaign.id, campaign.missionIds]),
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
      assert.equal(current.revision, 'crosswind-compass-spatial-pair-1');
      assert.equal(current.id, previous.id);
      assert.equal(current.name, previous.name);
      assert.equal(current.coverage, previous.coverage);
      assert.deepEqual(current.objectives, previous.objectives);
      assert.deepEqual(current.relayLinks, previous.relayLinks);
      assert.deepEqual(current.presentation, previous.presentation);
      assert.deepEqual(current.modes, previous.modes);
      assert.deepEqual(current.actors, previous.actors);
      assert.equal(current.design.routeDecision.includes(' or '), true);
      assert.match(current.design.mastery, /without losing a life/);
    }
  }
});

test('compass baffles and outer shelves preserve exact speed fields and governed topology', () => {
  const expected = {
    'compass-array': {
      walls: 8,
      foundations: 5,
      safe: 6,
      retainers: 2,
      zones: 6,
    },
    'outer-loop': { walls: 6, foundations: 6, safe: 5, retainers: 3, zones: 3 },
  };
  for (const id of IDS) {
    const previousMission = mission(oldProject, id);
    const currentMission = mission(project, id);
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, 'crosswind-compass-spatial-pair-1');
    assert.equal(currentMap.source.walls.length, expected[id].walls);
    assert.equal(currentMap.source.foundations.length, expected[id].foundations);
    assert.equal(currentMap.source.speedZones.length, expected[id].zones);
    assert.deepEqual(currentMap.source.speedZones, previousMap.source.speedZones);
    assert.deepEqual(currentMap.source.gates, previousMap.source.gates);
    assert.deepEqual(currentMission.objectives, previousMission.objectives);
    assert.equal(currentMap.geometry.fieldComponents.length, 1);
    assert.equal(currentMap.geometry.safeComponents.length, expected[id].safe);
    assert.deepEqual(
      currentMap.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    assert(currentMap.geometry.safeComponents.every((item) => item.departures.length >= 20));
    for (const difficulty of PRESETS) {
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, {
        difficulty,
        mode: 'versus',
      });
      const previous = resolveMission(oldProject, id, {
        difficulty,
        mode: 'solo',
      });
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
      assert.deepEqual(solo.level.directionalZones, previous.level.directionalZones);
      assert.deepEqual(solo.level.relayGates, previous.level.relayGates);
      assert.deepEqual(solo.level.objectives, previous.level.objectives);
      assert.deepEqual(solo.level.relayGates.gates, []);
      assert.deepEqual(solo.level.objectives, []);
      const run = createRun(solo.level, { seed: 1, classId: 'scout' });
      const capture = inspectCaptureSnapshot(run);
      assert.equal(capture.components.length, 1);
      assert.equal(capture.filledCells.length, 0);
      assert.equal(capture.components[0].retained, true);
      assert.equal(capture.components[0].enemyIds.length, expected[id].retainers);
      assert.deepEqual(inspectMissionTopology(solo.level, currentMap.geometry).diagnostics, []);
    }
  }
});

for (const id of IDS)
  for (const difficulty of PRESETS)
    test(`${id} has no unavoidable idle opening pressure on ${difficulty}`, () => {
      const manifest = resolveMission(project, id, { difficulty });
      for (const seed of [1, 2]) {
        const run = createRun(manifest.level, { seed, classId: 'scout' });
        idle(run, 720);
        assert.equal(run.claimedCount, 0);
      }
    });

const expectedClaims = Object.freeze({
  'north-neck-first': 7,
  'west-arm-first': 17,
  'inner-post-first': 17,
  'outer-post-first': 8,
});

for (const [id, disposition] of Object.entries(JOURNEY_CROSSWIND_COMPASS_SPATIAL_DISPOSITIONS))
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${id} supports two authored first approaches on ${difficulty} with ${turnPolicy}`, () => {
        for (const route of disposition.approaches) {
          const manifest = resolveMission(project, id, { difficulty });
          const run = createRun(manifest.level, {
            seed: 1,
            classId: 'scout',
            turnPolicy,
          });
          closeRoute(run, route);
          assert.equal(run.claimedCount, expectedClaims[route], `${id}/${route}`);
          assert.equal(run.player.speed, 0, `${id}/${route}`);
          assert.equal(run.classic.livesLost, 0, `${id}/${route}`);
          assert.equal(run.events.filter((event) => event.type === 'cut.closed').length, 1);
          assert.equal(run.relay.gates.length, 0);
          assert.equal(run.objectives.length, 0);
        }
      });
