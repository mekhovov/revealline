import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyPhaseworksSpatialPairCandidates } from '../content-design/journey-phaseworks-spatial-pair.mjs';
import { createJourneyFractureSpatialPairCandidates } from '../content-design/journey-fracture-spatial-pair.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const IDS = ['two-ways-home', 'dogleg-transfer'];
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const oldSource = createJourneyFractureSpatialPairCandidates({ artwork: true });
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyPhaseworksSpatialPairCandidates({ artwork: true });
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

test('Phaseworks pair preserves history, pressure roles, art, rules and authored order', () => {
  assert.deepEqual(createJourneyFractureSpatialPairCandidates({ artwork: true }), oldSnapshot);
  assert.equal(revisedSource.revision, 'phaseworks-spatial-pair-1');
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
      assert.equal(current.revision, 'phaseworks-spatial-pair-1');
      assert.equal(current.id, previous.id);
      assert.equal(current.name, previous.name);
      assert.equal(current.coverage, previous.coverage);
      assert.deepEqual(current.objectives, previous.objectives);
      assert.deepEqual(current.presentation, previous.presentation);
      assert.deepEqual(current.modes, previous.modes);
      assert.deepEqual(
        current.actors.map(({ id, role }) => ({ id, role })),
        previous.actors.map(({ id, role }) => ({ id, role })),
      );
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
    'dogleg-return',
    'staggered-circuit',
    'bank-the-crossing',
    'five-anchors',
  ])
    assert.deepEqual(mission(project, id), mission(oldProject, id));
});

test('woven bands and FPV jig preserve finite pursuit in one retained field', () => {
  const expected = {
    'two-ways-home': {
      walls: 10,
      foundations: 3,
      safeComponents: 4,
      retainers: 2,
      terrain: ['slow', 'slow'],
      pressureId: 'carrier',
    },
    'dogleg-transfer': {
      walls: 8,
      foundations: 5,
      safeComponents: 4,
      retainers: 3,
      terrain: ['lethal', 'slow'],
      pressureId: 'upper-carrier',
    },
  };
  for (const id of IDS) {
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, 'phaseworks-spatial-pair-1');
    assert.equal(currentMap.source.walls.length, expected[id].walls);
    assert.equal(currentMap.source.foundations.length, expected[id].foundations);
    assert.deepEqual(
      currentMap.source.terrain.map((area) => area.kind).sort(),
      expected[id].terrain,
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
      const previous = resolveMission(oldProject, id, { difficulty, mode: 'solo' });
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
      assert.deepEqual(solo.level.classic.enemyPressure, previous.level.classic.enemyPressure);
      assert.equal(solo.level.classic.enemyPressure.actors.length, 1);
      assert.equal(solo.level.classic.enemyPressure.actors[0].id, expected[id].pressureId);
      assert.equal(solo.level.classic.enemyPressure.actors[0].mode, 'trail-pursuit');
      const run = createRun(solo.level, { seed: 1, classId: 'scout' });
      const capture = inspectCaptureSnapshot(run);
      assert.equal(capture.components.length, 1);
      assert.equal(capture.filledCells.length, 0);
      assert.equal(capture.components[0].retained, true);
      assert.equal(capture.components[0].enemyIds.length, expected[id].retainers);
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
  'two-ways-home': Object.freeze({
    centerLanding: { targetX: 35.5, ticks: 78, gain: 6 },
    eastWOpening: { targetX: 56.5, ticks: 486, gain: 19 },
  }),
  'dogleg-transfer': Object.freeze({
    balancingHub: { targetX: 35.5, ticks: 90, gain: 7 },
    upperServicePad: { targetX: 56.5, ticks: 390, gain: 8 },
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
