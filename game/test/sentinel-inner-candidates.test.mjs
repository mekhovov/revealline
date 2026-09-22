import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelSpatialCandidates } from '../content-design/sentinel-spatial-candidates.mjs';
import { createSentinelInnerCandidates } from '../content-design/sentinel-inner-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const before = createSentinelSpatialCandidates();
const prior = compileContentProject(before);
const source = createSentinelInnerCandidates();
const project = compileContentProject(source);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/sentinel-spatial-clear-routes.json', import.meta.url)),
);

test('inner receiver is an isolated objective-placement successor, not a rules or speed change', () => {
  assert.deepEqual(createSentinelSpatialCandidates(), before);
  assert.notEqual(source.id, before.id);
  assert.deepEqual(source.maps, before.maps);
  assert.deepEqual(source.assets, before.assets);
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const old = resolveMission(prior, mission.id, { difficulty });
      const next = resolveMission(project, mission.id, { difficulty });
      assert.deepEqual(
        next.level,
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (mission.id !== 'twin-receivers') {
        assert.deepEqual(next.level, old.level);
        continue;
      }
      const expected = structuredClone(old.level);
      expected.revision = next.level.revision;
      Object.assign(
        expected.objectives.find((row) => row.id === 'east-shield'),
        {
          x: 50.5,
          y: 19.5,
        },
      );
      assert.deepEqual(next.level, expected);
      assert.notEqual(next.simulationIdentity, old.simulationIdentity);
      assert.equal(next.officialProgressEligible, false);
      const snapshot = inspectCaptureSnapshot(createRun(next.level, { seed: 1 }));
      assert.equal(snapshot.components.length, 1);
      assert.deepEqual(snapshot.components[0].enemyIds, ['sentinel']);
      assert.equal(snapshot.filledCells.length, 0);
    }
});

test('the exact short historical clear remains intact but its outer closure cannot collect the inner receiver', () => {
  const row = fixture.rows.find(
    (item) =>
      item.id === 'twin-receivers' &&
      item.difficulty === 'standard' &&
      item.turnPolicy === 'immediate',
  );
  const options = { seed: 1, turnPolicy: row.turnPolicy, classId: 'scout' };
  const old = createRun(resolveMission(prior, row.id).level, options);
  const next = createRun(resolveMission(project, row.id).level, options);
  let inspectedMouth = false;
  for (const { direction, ticks } of row.segments)
    for (let tick = 0; tick < ticks; tick++) {
      stepRun(old, { direction }, FIXED_DT);
      stepRun(next, { direction }, FIXED_DT);
      if (old.tick === 2046) {
        assert.equal(old.encounter.stage, 'transition');
        assert.equal(next.encounter.stage, 'shielded');
        assert.equal(next.objectives.find((o) => o.id === 'west-shield').captured, true);
        assert.equal(next.objectives.find((o) => o.id === 'east-shield').captured, false);
        assert.equal(next.classic.livesLost, 0);
        inspectedMouth = true;
      }
    }
  assert(inspectedMouth);
  assert.equal(old.status, 'won');
  assert.equal(authoritativeCheckpoint(old).hash, row.checkpoint);
  assert.notEqual(next.status, 'won');
});

test('every preset and steering mode retains a lossless decision window and first foundation return', () => {
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const level = resolveMission(project, 'twin-receivers', { difficulty }).level;
      const options = { seed: 1, turnPolicy };
      const idle = createRun(level, options),
        run = createRun(level, options);
      for (let i = 0; i < 1200; i++) stepRun(idle, { direction: null }, FIXED_DT);
      assert.equal(idle.classic.livesLost, 0);
      for (let i = 0; i < 1200 && !run.claimedCount; i++)
        stepRun(run, { direction: 'up' }, FIXED_DT);
      assert(run.claimedCount > 0);
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.encounter.stage, 'shielded');
      assert.equal(run.totalClaimable, idle.totalClaimable);
    }
});
