import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { createLivewireSpatialCandidates } from '../content-design/livewire-spatial-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const id = 'cross-the-afterglow';
const original = createLivewireCandidates();
const previous = compileContentProject(withPressureDifficulty(original));
const project = compileContentProject(createLivewireSpatialCandidates());
const presets = ['gentle', 'standard', 'expert'];
const policies = ['immediate', 'grid-center'];

test('picture-enabled successors retain exact existing original asset bindings', () => {
  const old = createLivewireCandidates({ artwork: true });
  const next = createLivewireSpatialCandidates({ artwork: true });
  assert.deepEqual(next.assets, old.assets);
  assert.deepEqual(
    next.missions.map((mission) => mission.presentation),
    old.missions.map((mission) => mission.presentation),
  );
  assert.equal(next.assets.length, 7);
  assert(
    createLivewireSpatialCandidates().missions.every(
      (mission) => mission.presentation.backgroundAssetId === null,
    ),
  );
});

test('Afterglow successor changes spatial decisions, not speed, quota, rules or other missions', () => {
  assert.deepEqual(createLivewireCandidates(), original);
  assert.equal(project.source.difficultyCatalogId, 'journey-difficulty-v2');
  assert.equal(project.missions.length, 7);
  for (const mission of project.missions)
    for (const difficulty of presets) {
      const before = resolveMission(previous, mission.id, { difficulty });
      const after = resolveMission(project, mission.id, { difficulty });
      assert.equal(after.officialProgressEligible, false);
      assert.deepEqual(after.level.rules, before.level.rules);
      assert.deepEqual(after.level.goal, before.level.goal);
      assert.deepEqual(after.level.enemies, before.level.enemies);
      assert.deepEqual(after.level.classic, before.level.classic);
      assert.deepEqual(
        after.level,
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (mission.id !== id) assert.deepEqual(after.level, before.level);
      else {
        assert.notEqual(after.simulationIdentity, before.simulationIdentity);
        const oldMission = previous.missions.find((item) => item.id === id);
        assert.deepEqual(mission.actors, oldMission.actors);
        assert.deepEqual(mission.objectives, []);
        assert.deepEqual(mission.bonuses, []);
        assert.deepEqual(mission.design.introduces, []);
        assert.equal(mission.design.mastery, oldMission.design.mastery);
        assert.equal(mission.coverage, oldMission.coverage);
      }
    }
});

test('walls preserve one anchored field, three usable landings and the north/west return choices', () => {
  const map = project.maps.find((item) => item.source.id === `${id}-map`);
  const old = previous.maps.find((item) => item.source.id === `${id}-map`);
  assert.deepEqual(map.source.foundations, old.source.foundations);
  assert.deepEqual(map.source.spawns, old.source.spawns);
  assert.equal(map.geometry.fieldComponents.length, 1);
  // Three authored landings plus the outer reclaimed perimeter.
  assert.equal(map.geometry.safeComponents.length, 4);
  assert.equal(map.geometry.safeComponents.length, old.geometry.safeComponents.length);
  assert(map.geometry.safeComponents.every((component) => component.departures.length >= 4));
  assert.deepEqual(
    map.geometry.diagnostics.map((row) => row.code),
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
  for (const turnPolicy of policies) {
    test(`Afterglow safe opening, west retention and replay: ${difficulty}/${turnPolicy}`, () => {
      const level = resolveMission(project, id, { difficulty }).level;
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const idle = createRun(level, options);
      for (let tick = 0; tick < 1200; tick++) {
        stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0);
        assert(idle.enemies.find((actor) => actor.id === 'keeper').x < 24);
      }
      for (const direction of ['left', 'up']) {
        const run = createRun(level, options);
        const recorder = createRecorder(level, options);
        const denominator = run.totalClaimable;
        for (let tick = 0; tick < 1200 && !run.claimedCount && !run.classic.livesLost; tick++) {
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
        }
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.status, 'running');
        assert(run.claimedCount > 0);
        assert(run.coverage < 0.02);
        assert.equal(run.totalClaimable, denominator);
        assert.equal(run.player.speed, 0);
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      }
    });
  }

test('historical 17.05-second shortcut remains valid only for its original edition', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/livewire-pressure-clear-routes.json', import.meta.url)),
  );
  const row = fixture.rows.find(
    (item) => item.id === id && item.difficulty === 'standard' && item.turnPolicy === 'immediate',
  );
  const historical = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
  const options = {
    seed: 1,
    turnPolicy: row.turnPolicy,
    segments: row.segments.map((item) => [item.direction, item.ticks]),
    replay: true,
  };
  const before = assessPressureRoute(resolveMission(historical, id).level, options);
  assert.equal(before.status, 'no-loss-clear');
  assert.equal(before.checkpoint, row.checkpoint);
  const after = assessPressureRoute(resolveMission(project, id).level, options);
  assert.notEqual(after.status, 'no-loss-clear');
});

test('cutting beside the wall keeps both occupied regions instead of granting a western windfall', () => {
  const level = resolveMission(project, id).level;
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  const closures = [];
  for (const [direction, ticks] of [
    ['down', 216],
    ['left', 108],
    ['up', 420],
  ])
    for (let tick = 0; tick < ticks; tick++) {
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      if (run.events.some((event) => event.type === 'cut.closed'))
        closures.push([run.tick, run.claimedCount]);
    }
  assert.equal(run.classic.livesLost, 0);
  assert.equal(run.status, 'running');
  assert.deepEqual(closures, [
    [210, 14],
    [738, 48],
  ]);
  assert.equal(run.totalClaimable, 2226);
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(snapshot.filledCells.length, 0);
  assert.deepEqual(
    snapshot.components.map((component) => [component.cells.length, component.enemyIds]),
    [
      [776, ['keeper']],
      [1402, ['emitter']],
    ],
  );
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
});
