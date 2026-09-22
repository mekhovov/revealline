import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createHorizonSpatialCandidates } from '../content-design/horizon-spatial-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const original = compileContentProject(withPressureDifficulty(createOpeningCandidates()));
const revised = compileContentProject(createHorizonSpatialCandidates());
const id = 'courtyard-return';
const presets = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];

test('Courtyard successor preserves actors, physics, percentage and all other missions', () => {
  assert.equal(revised.source.revision, 'courtyard-spatial-1');
  for (const mission of revised.missions)
    for (const difficulty of presets) {
      const before = resolveMission(original, mission.id, { difficulty });
      const after = resolveMission(revised, mission.id, { difficulty });
      assert.equal(after.officialProgressEligible, false);
      assert.deepEqual(after.level.enemies, before.level.enemies);
      assert.deepEqual(after.level.rules, before.level.rules);
      assert.deepEqual(after.level.goal, before.level.goal);
      assert.deepEqual(after.level.classic, before.level.classic);
      if (mission.id !== id) assert.deepEqual(after.level, before.level);
      else {
        assert.notEqual(after.simulationIdentity, before.simulationIdentity);
        assert.deepEqual(mission.actors, original.missions.find((item) => item.id === id).actors);
        assert.deepEqual(mission.design.introduces, []);
        assert.deepEqual(mission.objectives, []);
        assert.deepEqual(mission.bonuses, []);
      }
    }
});

test('existing picture bindings are retained without changing geometry', () => {
  const before = withPressureDifficulty(createOpeningCandidates({ artwork: true }));
  const after = createHorizonSpatialCandidates({ artwork: true });
  assert.deepEqual(after.assets, before.assets);
  assert.deepEqual(
    after.missions.map((item) => item.presentation),
    before.missions.map((item) => item.presentation),
  );
  assert.deepEqual(after.maps, revised.source.maps);
});

test('both retained fields contribute by geometry, not a new objective or inflated quota', () => {
  const before = createRun(resolveMission(original, id).level, { seed: 1 });
  const after = createRun(resolveMission(revised, id).level, { seed: 1 });
  const oldRegions = inspectCaptureSnapshot(before).components;
  const snapshot = inspectCaptureSnapshot(after);
  assert.equal(after.totalClaimable, 2124);
  assert(after.totalClaimable < before.totalClaimable);
  assert.equal(snapshot.filledCells.length, 0);
  assert.deepEqual(
    snapshot.components.map((c) => [c.cells.length, c.enemyIds]),
    [
      [1324, ['outside']],
      [800, ['inside']],
    ],
  );
  assert(
    oldRegions.find((c) => c.enemyIds.includes('outside')).cells.length / before.totalClaimable >
      0.7,
  );
  assert(snapshot.components.every((c) => c.cells.length / after.totalClaimable < 0.7));
  assert.deepEqual(after.level.walls, []);
  assert.equal(after.level.foundations.length, 4);
});

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`Courtyard idle and four readable departures: ${difficulty}/${turnPolicy}`, () => {
      const manifest = resolveMission(revised, id, { difficulty });
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const idle = createRun(manifest.level, options);
      for (let t = 0; t < 1200; t++) stepRun(idle, { direction: null }, FIXED_DT);
      assert.equal(idle.classic.livesLost, 0);
      assert.equal(idle.claimedCount, 0);
      for (const [direction, ticks, earned] of [
        ['left', 162, 13],
        ['right', 498, 400],
        ['up', 198, 5],
        ['down', 210, 5],
      ]) {
        const run = createRun(manifest.level, options);
        const recorder = createRecorder(manifest.level, options);
        let closures = 0;
        for (let t = 0; t < ticks; t++) {
          assert.equal(closures, 0);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          closures += Number(run.events.some((e) => e.type === 'cut.closed'));
          assert.equal(run.classic.livesLost, 0);
        }
        assert.equal(closures, 1);
        assert.equal(run.claimedCount, earned);
        assert.equal(run.player.speed, 0);
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      }
    });
