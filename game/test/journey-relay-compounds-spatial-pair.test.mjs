import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createJourneyRelayCompoundsSpatialPairCandidates,
  JOURNEY_RELAY_COMPOUNDS_SPATIAL_DISPOSITIONS,
} from '../content-design/journey-relay-compounds-spatial-pair.mjs';
import { createJourneyRelaySpatialPairCandidates } from '../content-design/journey-relay-spatial-pair.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const IDS = ['three-compounds', 'spiral-stores'];
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const oldSource = createJourneyRelaySpatialPairCandidates({ artwork: true });
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyRelayCompoundsSpatialPairCandidates({
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

function stepUntil(run, direction, predicate, maxTicks = 1600) {
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

function closeRoute(run, route) {
  if (route === 'upper-relay-first') {
    stepUntil(run, 'up', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else if (route === 'west-reserve-first') {
    stepUntil(run, 'down', (state) => state.player.y >= 20.4);
    stepUntil(run, 'left', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else if (route === 'west-window-first') {
    stepUntil(run, 'left', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else if (route === 'east-window-first') {
    stepUntil(run, 'down', (state) => state.player.y >= 20.4);
    stepUntil(run, 'right', (state) => state.events.some((event) => event.type === 'cut.closed'));
  } else throw new TypeError(`Unknown route ${route}`);
}

test('Relay compounds pair records two redesign dispositions and preserves historical identities', () => {
  assert.deepEqual(createJourneyRelaySpatialPairCandidates({ artwork: true }), oldSnapshot);
  assert.deepEqual(Object.keys(JOURNEY_RELAY_COMPOUNDS_SPATIAL_DISPOSITIONS), IDS);
  for (const disposition of Object.values(JOURNEY_RELAY_COMPOUNDS_SPATIAL_DISPOSITIONS)) {
    assert.equal(disposition.disposition, 'redesign');
    assert.equal(disposition.approaches.length, 2);
    assert.equal(new Set(disposition.approaches).size, 2);
  }
  assert.equal(revisedSource.revision, 'relay-compounds-spatial-pair-1');
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
      assert.equal(current.revision, 'relay-compounds-spatial-pair-1');
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

test('compound yards and opposing broken spirals retain valid governed fields and relay topology', () => {
  const expected = {
    'three-compounds': { walls: 10, foundations: 4, safe: 5, retainers: 2 },
    'spiral-stores': { walls: 8, foundations: 9, safe: 4, retainers: 3 },
  };
  for (const id of IDS) {
    const previousMission = mission(oldProject, id);
    const currentMission = mission(project, id);
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, 'relay-compounds-spatial-pair-1');
    assert.equal(currentMap.source.walls.length, expected[id].walls);
    assert.equal(currentMap.source.foundations.length, expected[id].foundations);
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
      assert.deepEqual(solo.level.relayGates, previous.level.relayGates);
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
        for (let tick = 0; tick < 720; tick++) stepRun(run, { direction: null }, FIXED_DT);
        assert.equal(run.status, 'running');
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.claimedCount, 0);
      }
    });

for (const [id, disposition] of Object.entries(JOURNEY_RELAY_COMPOUNDS_SPATIAL_DISPOSITIONS))
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
          assert(run.claimedCount > 0, `${id}/${route}`);
          assert.equal(run.player.speed, 0, `${id}/${route}`);
          assert.equal(run.classic.livesLost, 0, `${id}/${route}`);
        }
      });

const relayRoutes = Object.freeze({
  'upper-relay-first': Object.freeze({
    objectiveId: 'upper-relay',
    gateId: 'west-link',
  }),
  'west-window-first': Object.freeze({
    objectiveId: 'west-relay',
    gateId: 'upper-break',
  }),
  'east-window-first': Object.freeze({
    objectiveId: 'east-relay',
    gateId: 'lower-break',
  }),
});

for (const [route, signature] of Object.entries(relayRoutes)) {
  const id = route === 'upper-relay-first' ? 'three-compounds' : 'spiral-stores';
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${id} ${route} opens only its matching relay on ${difficulty} with ${turnPolicy}`, () => {
        const manifest = resolveMission(project, id, { difficulty });
        const run = createRun(manifest.level, {
          seed: 1,
          classId: 'scout',
          turnPolicy,
        });
        closeRoute(run, route);
        assert(
          run.events.some(
            (event) => event.type === 'objective.captured' && event.id === signature.objectiveId,
          ),
        );
        assert(
          run.events.some(
            (event) => event.type === 'relay.opened' && event.id === signature.gateId,
          ),
        );
        assert.equal(
          run.relay.gates.find((gate) => gate.id === signature.gateId).openedTick !== null,
          true,
        );
        assert.equal(
          run.relay.gates
            .filter((gate) => gate.openedTick !== null)
            .map((gate) => gate.id)
            .join(','),
          signature.gateId,
        );
        assert.equal(run.classic.livesLost, 0);
      });
}
