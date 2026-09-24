import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyOrnamentSpatialPairCandidates } from '../content-design/journey-ornament-spatial-pair.mjs';
import { createWholeErosionReviewCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const IDS = ['garden-refuges', 'four-quarters'];
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const oldSource = createWholeErosionReviewCandidates({ artwork: true });
const oldSnapshot = structuredClone(oldSource);
const revisedSource = createJourneyOrnamentSpatialPairCandidates({ artwork: true });
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

test('ornament pair is copy-on-write and preserves historical missions, pictures and rules', () => {
  assert.deepEqual(createWholeErosionReviewCandidates({ artwork: true }), oldSnapshot);
  assert.equal(revisedSource.revision, 'ornament-spatial-pair-1');
  assert.deepEqual(revisedSource.assets, oldSource.assets);
  for (const current of project.missions) {
    const previous = mission(oldProject, current.id);
    if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
    else {
      assert.equal(current.revision, 'ornament-spatial-pair-1');
      assert.equal(current.coverage, previous.coverage);
      assert.deepEqual(current.objectives, previous.objectives);
      assert.deepEqual(current.presentation, previous.presentation);
      assert.equal(current.design.routeDecision.includes(' or '), true);
      assert.match(current.design.mastery, /without losing a life/);
    }
  }
  for (const id of IDS) {
    const previousMap = map(oldProject, id);
    const currentMap = map(project, id);
    assert.notEqual(currentMap.geometryIdentity, previousMap.geometryIdentity);
    assert.equal(currentMap.source.revision, 'ornament-spatial-pair-1');
  }
});

test('both ornament geometries remain reachable, retained and diagnostic-clean apart from deliberate islands', () => {
  for (const id of IDS) {
    const currentMap = map(project, id);
    assert.equal(currentMap.geometry.fieldComponents.length, 1);
    assert.equal(currentMap.geometry.safeComponents.length, 2);
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
      const run = createRun(solo.level, { seed: 1, classId: 'scout' });
      const capture = inspectCaptureSnapshot(run);
      assert.equal(capture.components.length, 1);
      assert.equal(capture.filledCells.length, 0);
      assert(capture.components[0].enemyIds.length >= 3);
      assert.equal(capture.components[0].retained, true);
      const topology = inspectMissionTopology(solo.level, currentMap.geometry);
      assert.deepEqual(topology.diagnostics, []);
      assert.equal(topology.optimisticCoverageCeiling, 1);
    }
  }
});

for (const id of IDS)
  for (const difficulty of PRESETS)
    test(`${id} has no unavoidable opening pressure on ${difficulty}`, () => {
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
  'garden-refuges': Object.freeze({
    center: { targetX: 35.5, ticks: 114, gain: 9 },
    eastBranch: { targetX: 40.5, ticks: 222, gain: 13 },
  }),
  'four-quarters': Object.freeze({
    center: { targetX: 35.5, ticks: 90, gain: 7 },
    eastPoint: { targetX: 40.5, ticks: 210, gain: 12 },
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
          if (expected.targetX > run.player.x)
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
