import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLivewireSpatialCandidates } from '../content-design/livewire-spatial-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const baseline = compileContentProject(createLivewireSpatialCandidates());
const project = compileContentProject(createLivewireSpatialCandidates({ edition: 'routing' }));
const ids = ['switchyard', 'split-junction'];
const presets = ['gentle', 'standard', 'expert'];
const policies = ['immediate', 'grid-center'];

function fly(level, options, segments) {
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  const closures = [];
  let previousClaimed = 0;
  for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) {
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      if (run.events.some((event) => event.type === 'cut.closed')) {
        closures.push([run.tick, run.claimedCount - previousClaimed]);
        previousClaimed = run.claimedCount;
      }
    }
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  return { run, closures };
}

test('routing edition is explicit and preserves its predecessor and unchanged actors/rules', () => {
  assert.throws(() => createLivewireSpatialCandidates({ edition: 'guess' }), /Unknown/);
  assert.deepEqual(createLivewireSpatialCandidates(), baseline.source);
  assert.equal(project.source.revision, 'routing-spatial-2');
  for (const mission of project.missions)
    for (const difficulty of presets) {
      const before = resolveMission(baseline, mission.id, { difficulty });
      const after = resolveMission(project, mission.id, { difficulty });
      assert.equal(after.officialProgressEligible, false);
      assert.deepEqual(after.level.enemies, before.level.enemies);
      assert.deepEqual(after.level.rules, before.level.rules);
      assert.deepEqual(after.level.goal, before.level.goal);
      assert.deepEqual(after.level.classic, before.level.classic);
      assert.deepEqual(
        after.level,
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (ids.includes(mission.id)) {
        assert.notEqual(after.simulationIdentity, before.simulationIdentity);
        const original = baseline.missions.find((item) => item.id === mission.id);
        assert.deepEqual(mission.actors, original.actors);
        assert.deepEqual(mission.objectives, original.objectives);
        assert.deepEqual(mission.bonuses, original.bonuses);
        assert.deepEqual(mission.design.introduces, original.design.introduces);
        assert.equal(mission.design.mastery, original.design.mastery);
      } else assert.deepEqual(after.level, before.level);
    }
});

test('routing retains exact picture revisions and no art determines collision', () => {
  const before = createLivewireSpatialCandidates({ artwork: true });
  const after = createLivewireSpatialCandidates({ artwork: true, edition: 'routing' });
  assert.deepEqual(after.assets, before.assets);
  assert.deepEqual(
    after.missions.map((item) => item.presentation),
    before.missions.map((item) => item.presentation),
  );
});

for (const id of ids) {
  test(`${id} starts with one anchored field and no remote automatic fill`, () => {
    const map = project.maps.find((item) => item.source.id === `${id}-map`);
    const oldMap = baseline.maps.find((item) => item.source.id === `${id}-map`);
    assert.equal(map.geometry.fieldComponents.length, 1);
    assert(map.geometry.safeComponents.every((component) => component.departures.length >= 4));
    assert.deepEqual(map.source.spawns, oldMap.source.spawns);
    assert.deepEqual(map.source.terrain, oldMap.source.terrain);
    assert.deepEqual(
      map.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    const snapshot = inspectCaptureSnapshot(createRun(resolveMission(project, id).level));
    assert.equal(snapshot.filledCells.length, 0);
    assert.deepEqual(
      snapshot.components.map((component) => component.enemyIds),
      [['emitter', 'keeper']],
    );
  });
  for (const difficulty of presets)
    for (const turnPolicy of policies)
      test(`${id} readable first returns and idle clearance: ${difficulty}/${turnPolicy}`, () => {
        const level = resolveMission(project, id, { difficulty }).level;
        const options = { seed: 1, classId: 'scout', turnPolicy };
        const idle = createRun(level, options);
        for (let tick = 0; tick < 1200; tick++) {
          stepRun(idle, { direction: null }, FIXED_DT);
          assert.equal(idle.classic.livesLost, 0);
          assert(
            idle.enemies.find((actor) => actor.id === 'keeper').x < (id === 'switchyard' ? 26 : 24),
          );
        }
        const routes =
          id === 'switchyard'
            ? [
                [['up', 198]],
                [
                  ['right', 84],
                  ['down', 210],
                ],
                [
                  ['left', 120],
                  ['down', 210],
                ],
              ]
            : [
                [['down', 210]],
                [['up', 198]],
                [['left', 120]],
                [
                  ['down', 36],
                  ['right', 132],
                ],
              ];
        for (const segments of routes) {
          const { run, closures } = fly(level, options, segments);
          assert.equal(run.classic.livesLost, 0);
          assert.equal(run.status, 'running');
          assert.equal(closures.length, 1);
          assert(run.coverage < 0.02);
          assert.equal(run.totalClaimable, id === 'switchyard' ? 2204 : 2226);
        }
      });
}

test('Switchyard long cut stays legal but retains the west instead of receiving 1385 cells', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/livewire-pressure-clear-routes.json', import.meta.url)),
  );
  const row = fixture.rows.find(
    (item) =>
      item.id === 'switchyard' && item.difficulty === 'standard' && item.turnPolicy === 'immediate',
  );
  const historical = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
  const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
  const segments = row.segments.map((item) => [item.direction, item.ticks]);
  const old = fly(resolveMission(historical, row.id).level, options, segments);
  assert.equal(old.run.status, 'won');
  assert.equal(authoritativeCheckpoint(old.run).hash, row.checkpoint);
  assert.equal(old.closures[1][1], 1385);
  const next = fly(resolveMission(project, row.id).level, options, segments);
  assert.equal(next.run.status, 'running');
  assert.equal(next.run.classic.livesLost, 0);
  assert.deepEqual(next.closures, [
    [414, 29],
    [1578, 34],
    [2166, 312],
    [2658, 104],
  ]);
  const prefix = fly(resolveMission(project, row.id).level, options, segments.slice(0, 6));
  const snapshot = inspectCaptureSnapshot(prefix.run);
  assert.deepEqual(
    snapshot.components.map((component) => [component.cells.length, component.enemyIds]),
    [
      [1303, ['keeper']],
      [838, ['emitter']],
    ],
  );
});

test('Split Junction floating east connector secures its seven cells, not an empty quadrant', () => {
  const { run, closures } = fly(
    resolveMission(project, 'split-junction').level,
    { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
    [
      ['down', 210],
      ['up', 174],
      ['right', 132],
    ],
  );
  assert.equal(run.classic.livesLost, 0);
  assert.equal(run.status, 'running');
  assert.deepEqual(closures, [
    [210, 14],
    [510, 7],
  ]);
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(snapshot.filledCells.length, 0);
  assert.deepEqual(
    snapshot.components.map((component) => component.enemyIds),
    [['emitter', 'keeper']],
  );
});
