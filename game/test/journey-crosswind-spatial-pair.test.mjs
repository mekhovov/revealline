import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyCrosswindSpatialPairCandidates } from '../content-design/journey-crosswind-spatial-pair.mjs';
import { createJourneyOrnamentSpatialPairCandidates } from '../content-design/journey-ornament-spatial-pair.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const IDS = ['survey-markers', 'windbreak-weave'];
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const oldSource = createJourneyOrnamentSpatialPairCandidates({ artwork: true });
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyCrosswindSpatialPairCandidates({ artwork: true });
const oldProject = compileContentProject(oldSource);
const project = compileContentProject(revisedSource);

function mission(project, id) {
  return project.missions.find((item) => item.id === id);
}

function map(project, id) {
  const current = mission(project, id);
  return project.maps.find(
    (item) => item.source.id === current.map.id && item.source.revision === current.map.revision,
  );
}

test('Crosswind pair stacks copy-on-write and preserves the first pair, pictures and policy', () => {
  assert.deepEqual(createJourneyOrnamentSpatialPairCandidates({ artwork: true }), oldSnapshot);
  assert.equal(revisedSource.revision, 'crosswind-spatial-pair-1');
  assert.equal(revisedSource.policyId, oldSource.policyId);
  assert.equal(revisedSource.actorCatalogId, oldSource.actorCatalogId);
  assert.equal(revisedSource.difficultyCatalogId, oldSource.difficultyCatalogId);
  assert.deepEqual(revisedSource.assets, oldSource.assets);
  for (const current of project.missions) {
    const previous = mission(oldProject, current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
    else {
      assert.equal(current.revision, 'crosswind-spatial-pair-1');
      assert.equal(current.coverage, previous.coverage);
      assert.deepEqual(current.objectives, previous.objectives);
      assert.deepEqual(current.presentation, previous.presentation);
      assert.deepEqual(current.relayLinks, previous.relayLinks);
      assert.equal(current.design.routeDecision.includes(' or '), true);
      assert.match(current.design.mastery, /without losing a life/);
    }
  }
  for (const id of ['garden-refuges', 'four-quarters'])
    assert.deepEqual(mission(project, id), mission(oldProject, id));
});

test('FPV and bezkonechnyk obstacle geometries preserve reachable directional choices', () => {
  const expected = {
    'survey-markers': { walls: 6, foundations: 5, keepers: 3 },
    'windbreak-weave': { walls: 8, foundations: 5, keepers: 2 },
  };
  for (const id of IDS) {
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, 'crosswind-spatial-pair-1');
    assert.equal(currentMap.source.walls.length, expected[id].walls);
    assert.equal(currentMap.source.foundations.length, expected[id].foundations);
    assert.equal(currentMap.geometry.speedZones.length, 4);
    assert.equal(currentMap.geometry.fieldComponents.length, 1);
    assert.equal(currentMap.geometry.safeComponents.length, 6);
    assert.deepEqual(
      currentMap.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    assert(currentMap.geometry.safeComponents.every((item) => item.departures.length >= 8));
    for (const difficulty of PRESETS) {
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
      assert.equal(
        solo.level.enemies.filter((actor) => actor.type === 'bouncer').length,
        expected[id].keepers,
      );
      const run = createRun(solo.level, { seed: 1, classId: 'scout' });
      const capture = inspectCaptureSnapshot(run);
      assert.equal(capture.components.length, 1);
      assert.equal(capture.filledCells.length, 0);
      assert.equal(capture.components[0].retained, true);
      assert.equal(capture.components[0].enemyIds.length, expected[id].keepers);
      const topology = inspectMissionTopology(solo.level, currentMap.geometry);
      assert.deepEqual(topology.diagnostics, []);
      assert.equal(topology.optimisticCoverageCeiling, 1);
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

const approaches = Object.freeze({
  'survey-markers': Object.freeze({
    directReceiver: { direction: 'up', ticks: 107, gain: 8 },
    componentDogleg: { direction: 'right', ticks: 210, gain: 15 },
  }),
  'windbreak-weave': Object.freeze({
    threadFirst: { direction: 'up', ticks: 107, gain: 8 },
    weaveFirst: { direction: 'right', ticks: 206, gain: 17 },
  }),
});

for (const [id, routes] of Object.entries(approaches))
  for (const turnPolicy of CONTROLS)
    for (const [name, expected] of Object.entries(routes))
      test(`${id} ${name} is a deterministic safe first approach with ${turnPolicy}`, () => {
        const manifest = resolveMission(project, id, { difficulty: 'standard' });
        for (const seed of [1, 2]) {
          const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
          let ticks = 0;
          let closed = false;
          while (!closed && ticks < 1000) {
            stepRun(run, { direction: expected.direction }, FIXED_DT);
            ticks++;
            closed = run.events.some((event) => event.type === 'cut.closed');
            assert.equal(run.status, 'running');
          }
          assert.equal(closed, true);
          assert.equal(run.classic.livesLost, 0);
          assert.equal(run.player.speed, 0);
          assert.equal(ticks, expected.ticks);
          assert.equal(run.claimedCount, expected.gain);
        }
      });
