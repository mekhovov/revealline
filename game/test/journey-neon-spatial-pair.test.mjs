import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyNeonSpatialPairCandidates } from '../content-design/journey-neon-spatial-pair.mjs';
import { createJourneyRoverSpatialPairCandidates } from '../content-design/journey-rover-spatial-pair.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const IDS = ['dogleg-return', 'staggered-circuit'];
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const oldSource = createJourneyRoverSpatialPairCandidates({ artwork: true });
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyNeonSpatialPairCandidates({ artwork: true });
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

test('Neon pair stacks copy-on-write and preserves identity, history, art, rules and order', () => {
  assert.deepEqual(createJourneyRoverSpatialPairCandidates({ artwork: true }), oldSnapshot);
  assert.equal(revisedSource.revision, 'neon-spatial-pair-1');
  assert.equal(revisedSource.policyId, oldSource.policyId);
  assert.equal(revisedSource.actorCatalogId, oldSource.actorCatalogId);
  assert.equal(revisedSource.difficultyCatalogId, oldSource.difficultyCatalogId);
  assert.deepEqual(revisedSource.assets, oldSource.assets);
  assert.deepEqual(
    revisedSource.campaigns.map((campaign) => [campaign.id, campaign.missionIds]),
    oldSource.campaigns.map((campaign) => [campaign.id, campaign.missionIds]),
  );
  assert.deepEqual(
    revisedSource.packs.map((pack) => [pack.id, pack.missionIds]),
    oldSource.packs.map((pack) => [pack.id, pack.missionIds]),
  );
  for (const current of project.missions) {
    const previous = mission(oldProject, current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
    else {
      assert.equal(current.revision, 'neon-spatial-pair-1');
      assert.equal(current.id, previous.id);
      assert.equal(current.name, previous.name);
      assert.equal(current.coverage, previous.coverage);
      assert.deepEqual(current.objectives, previous.objectives);
      assert.deepEqual(current.presentation, previous.presentation);
      assert.deepEqual(current.modes, previous.modes);
      assert.equal(current.design.routeDecision.includes(' or '), true);
      assert.match(current.design.mastery, /without losing a life/);
    }
  }
  for (const id of [
    'garden-refuges',
    'four-quarters',
    'survey-markers',
    'windbreak-weave',
    'split-berths',
    'stepped-return',
  ])
    assert.deepEqual(mission(project, id), mission(oldProject, id));
});

test('hooked dogleg and FPV circuit keep one retained field and deliberate return islands', () => {
  const expected = {
    'dogleg-return': { walls: 10, foundations: 5, safeComponents: 4 },
    'staggered-circuit': { walls: 8, foundations: 4, safeComponents: 5 },
  };
  for (const id of IDS) {
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, 'neon-spatial-pair-1');
    assert.equal(currentMap.source.walls.length, expected[id].walls);
    assert.equal(currentMap.source.foundations.length, expected[id].foundations);
    assert.equal(currentMap.source.terrain.length, 2);
    assert.equal(
      currentMap.source.terrain.every((area) => area.kind === 'slow'),
      true,
    );
    assert.equal(currentMap.geometry.fieldComponents.length, 1);
    assert.equal(currentMap.geometry.safeComponents.length, expected[id].safeComponents);
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
      assert.equal(solo.level.enemies.filter((actor) => actor.type === 'bouncer').length, 2);
      assert.equal(solo.level.enemies.filter((actor) => actor.type === 'contour-patrol').length, 1);
      assert.equal(solo.level.enemies.filter((actor) => actor.type === 'border-patrol').length, 1);
      const run = createRun(solo.level, { seed: 1, classId: 'scout' });
      const capture = inspectCaptureSnapshot(run);
      assert.equal(capture.components.length, 1);
      assert.equal(capture.filledCells.length, 0);
      assert.equal(capture.components[0].retained, true);
      assert.equal(capture.components[0].enemyIds.length, 2);
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
  'dogleg-return': Object.freeze({
    centralHook: { targetX: 35.5, ticks: 90, gain: 7 },
    eastHookOpening: { targetX: 58.5, ticks: 366, gain: 7 },
  }),
  'staggered-circuit': Object.freeze({
    controllerPad: { targetX: 35.5, ticks: 78, gain: 6 },
    rightTrace: { targetX: 56.5, ticks: 366, gain: 9 },
  }),
});

for (const [id, routes] of Object.entries(approaches))
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      for (const [name, expected] of Object.entries(routes))
        test(`${id} ${name} is safe on ${difficulty} with ${turnPolicy}`, () => {
          const manifest = resolveMission(project, id, { difficulty });
          for (const seed of [1, 2]) {
            const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
            let ticks = 0;
            while (run.player.x < expected.targetX) {
              stepRun(run, { direction: 'right' }, FIXED_DT);
              ticks++;
              assert.equal(run.status, 'running');
            }
            let closed = false;
            while (!closed && ticks < 1000) {
              stepRun(run, { direction: 'down' }, FIXED_DT);
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
