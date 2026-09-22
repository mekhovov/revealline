import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHorizonSpatialCandidates } from '../content-design/horizon-spatial-candidates.mjs';
import { createOutpostSpatialCandidates } from '../content-design/outpost-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const originalSource = createHorizonSpatialCandidates();
const original = compileContentProject(originalSource);
const revised = compileContentProject(createOutpostSpatialCandidates());
const id = 'island-outpost';
const presets = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];
const oldRoutes = JSON.parse(
  await readFile(new URL('./fixtures/opening-pressure-routes.json', import.meta.url)),
).rows.filter((r) => r.id === id);

function play(project, difficulty, turnPolicy, segments) {
  const manifest = resolveMission(project, id, { difficulty });
  const options = { seed: 1, classId: 'scout', turnPolicy };
  const run = createRun(manifest.level, options),
    recorder = createRecorder(manifest.level, options);
  const closures = [];
  for (const { direction, ticks } of segments)
    for (let t = 0; t < ticks; t++) {
      assert.equal(run.status, 'running');
      if (direction === null) assert.equal(run.player.speed, 0);
      const before = run.claimedCount;
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      assert.equal(run.classic.livesLost, 0);
      if (run.events.some((e) => e.type === 'cut.closed'))
        closures.push({ tick: run.tick, gain: run.claimedCount - before });
    }
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  return { run, closures };
}

test('explicit Outpost successor changes one keeper position without changing other runtime fields or missions', () => {
  assert.equal(revised.source.revision, 'outpost-spatial-1');
  assert.deepEqual(revised.source.maps, original.source.maps);
  assert.deepEqual(createHorizonSpatialCandidates(), originalSource);
  for (const mission of revised.missions)
    for (const difficulty of presets) {
      const before = resolveMission(original, mission.id, { difficulty });
      const after = resolveMission(revised, mission.id, { difficulty });
      assert.equal(after.officialProgressEligible, false);
      if (mission.id !== id) assert.deepEqual(after.level, before.level);
      else {
        assert.notEqual(after.simulationIdentity, before.simulationIdentity);
        const expected = structuredClone(before.level);
        expected.revision = 'outpost-spatial-1';
        expected.enemies.find((e) => e.id === 'north').x = 11.5;
        assert.deepEqual(after.level, expected);
        assert.deepEqual(mission.design.introduces, []);
        assert.deepEqual(
          mission.design.difficulty,
          original.missions.find((m) => m.id === id).design.difficulty,
        );
        const run = createRun(after.level, { seed: 1 });
        assert.equal(run.totalClaimable, 2355);
        const regions = inspectCaptureSnapshot(run);
        assert.equal(regions.components.length, 1);
        assert.equal(regions.filledCells.length, 0);
        assert.deepEqual(regions.components[0].enemyIds, ['north', 'south']);
      }
    }
});

test('original picture bindings remain available through the same compiler', () => {
  const before = createHorizonSpatialCandidates({ artwork: true });
  const after = createOutpostSpatialCandidates({ artwork: true });
  assert.deepEqual(after.assets, before.assets);
  assert.deepEqual(
    after.missions.map((m) => m.presentation),
    before.missions.map((m) => m.presentation),
  );
  assert.deepEqual(after.maps, revised.source.maps);
});

for (const difficulty of presets)
  for (const turnPolicy of controls) {
    test(`Outpost idle and three short departures: ${difficulty}/${turnPolicy}`, () => {
      const idle = play(revised, difficulty, turnPolicy, [{ direction: null, ticks: 1200 }]);
      assert.equal(idle.run.claimedCount, 0);
      for (const [direction, ticks, gain] of [
        ['left', 222, 16],
        ['up', 198, 14],
        ['down', 210, 15],
      ]) {
        const result = play(revised, difficulty, turnPolicy, [{ direction, ticks }]);
        assert.deepEqual(result.closures, [{ tick: ticks, gain }]);
        assert.equal(result.run.player.speed, 0);
      }
    });
    test(`Outpost near-shore branches have different seeded outcomes: ${difficulty}/${turnPolicy}`, () => {
      const prefix = [
        { direction: 'left', ticks: 222 },
        { direction: 'right', ticks: 222 },
      ];
      const north = play(revised, difficulty, turnPolicy, [
        ...prefix,
        { direction: 'up', ticks: 198 },
      ]);
      const south = play(revised, difficulty, turnPolicy, [
        ...prefix,
        { direction: 'down', ticks: 210 },
      ]);
      assert.deepEqual(
        north.closures.map((c) => c.gain),
        [16, 14],
      );
      assert.deepEqual(
        south.closures.map((c) => c.gain),
        [16, turnPolicy === 'immediate' ? 317 : 302],
      );
      assert.equal(north.run.status, 'running');
      assert.equal(south.run.status, 'running');
      assert.equal(north.run.player.speed, 0);
      assert.equal(south.run.player.speed, 0);
    });
  }

for (const turnPolicy of controls)
  test(`Outpost historical Expert fast route remains legal but retains the western field: ${turnPolicy}`, () => {
    const row = oldRoutes.find((r) => r.turnPolicy === turnPolicy);
    const before = play(original, 'expert', turnPolicy, row.segments);
    const after = play(revised, 'expert', turnPolicy, row.segments);
    assert.equal(before.run.status, 'won');
    assert.equal(before.run.coverage, row.coverage);
    assert.equal(after.run.status, 'running');
    assert.deepEqual(
      after.closures.map((c) => c.gain),
      [49, 19],
    );
    assert.equal(after.run.claimedCount, 68);
    assert.equal(after.run.coverage, 68 / 2355);
    assert(after.run.classic.livesLost === 0 && after.run.player.speed === 0);
  });
