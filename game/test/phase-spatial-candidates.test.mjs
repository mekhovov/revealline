import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPhaseCandidates } from '../content-design/phase-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { createPhaseSpatialCandidates } from '../content-design/phase-spatial-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const original = createPhaseCandidates();
const previous = compileContentProject(withPressureDifficulty(original));
const project = compileContentProject(createPhaseSpatialCandidates());
test('Studio exposes an inspect-only reserve study without replacing the picture candidate', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert(html.includes('id="phase-spatial">Inspect Reserve landing greybox successor</button>'));
  assert(html.includes('id="phase">Inspect Phaseworks picture candidates</button>'));
  const action = host.slice(
    host.indexOf("$('phase-spatial').onclick"),
    host.indexOf("$('livewire').onclick"),
  );
  assert.match(action, /discardSource\(\)/);
  assert.match(action, /createPhaseSpatialCandidates\(\)/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session\.replace|launchPreview/);
});
test('reserve successor preserves the original factory, other missions and shared impact/pressure rules', () => {
  assert.deepEqual(createPhaseCandidates(), original);
  assert.equal(project.source.id, 'phase-spatial-review');
  assert.equal(project.source.difficultyCatalogId, 'journey-difficulty-v2');
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const old = resolveMission(previous, mission.id, { difficulty });
      const next = resolveMission(project, mission.id, { difficulty });
      assert.equal(next.officialProgressEligible, false);
      assert.deepEqual(next.level.rules, old.level.rules);
      assert.deepEqual(next.level.goal, old.level.goal);
      assert.deepEqual(next.level.classic.lineImpact, old.level.classic.lineImpact);
      assert.deepEqual(
        next.level,
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (mission.id !== 'return-in-reserve') assert.deepEqual(next.level, old.level);
      else {
        assert.notEqual(next.simulationIdentity, old.simulationIdentity);
        assert.equal(mission.actors.length, 4);
        assert.equal(new Set(mission.actors.map((a) => a.role)).size, 3);
        assert(mission.actors.every((a) => a.tier === 'measured'));
        assert.deepEqual(mission.objectives, []);
        assert.deepEqual(mission.bonuses, []);
        assert.deepEqual(mission.design.introduces, ['selective-trail-impact']);
        assert.equal(mission.design.mastery, original.missions[0].design.mastery);
      }
    }
  assert.throws(() => resolveContentJourney(project, { mode: 'team' }), /no missions/);
});
test('reserve bays retain independently with useful disconnected landings and no remote auto-fill', () => {
  const map = project.maps.find((m) => m.source.id === 'return-in-reserve-map');
  assert.equal(map.geometry.fieldComponents.length, 2);
  assert.equal(map.geometry.safeComponents.length, 3);
  assert(map.geometry.safeComponents.every((c) => c.departures.length >= 4));
  assert.deepEqual(
    map.geometry.diagnostics.map((d) => d.code),
    ['disconnected-foundations'],
  );
  const run = createRun(resolveMission(project, 'return-in-reserve').level);
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(snapshot.filledCells.length, 0);
  assert.deepEqual(
    snapshot.components.map((c) => c.enemyIds),
    [['carrier'], ['keeper', 'lower-keeper']],
  );
  assert(snapshot.components.every((c) => c.cells.length / run.totalClaimable < 0.78));
});
test('three recorded impact-free old shortcuts remain historical controls, not successor clears', async () => {
  const historicalProject = compileContentProject(
    withPressureDifficulty(createWholeJourneyCandidates()),
  );
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/middle-pressure-routes.json', import.meta.url)),
  );
  const rows = fixture.rows.filter((r) => r.id === 'return-in-reserve');
  assert.equal(rows.length, 3);
  for (const row of rows) {
    const options = {
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      segments: row.segments.map((s) => [s.direction, s.ticks]),
    };
    const old = assessPressureRoute(
      resolveMission(historicalProject, row.id, { difficulty: row.difficulty }).level,
      options,
    );
    assert.equal(old.status, 'no-loss-clear');
    assert.equal(old.checkpoint, row.checkpoint);
    const next = assessPressureRoute(
      resolveMission(project, row.id, { difficulty: row.difficulty }).level,
      options,
    );
    assert.notEqual(next.status, 'no-loss-clear');
  }
});
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`reserve decision space and no-wait first return: ${difficulty}/${turnPolicy}`, () => {
      const level = resolveMission(project, 'return-in-reserve', { difficulty }).level;
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const idle = createRun(level, options);
      for (let t = 0; t < 1200; t++) stepRun(idle, { direction: null }, FIXED_DT);
      assert.equal(idle.classic.livesLost, 0);
      const run = createRun(level, options),
        recorder = createRecorder(level, options);
      const denominator = run.totalClaimable;
      let closed = false;
      for (let t = 0; t < 1200 && !closed && !run.classic.livesLost; t++) {
        recordInput(recorder, { direction: 'up' });
        stepRun(run, { direction: 'up' }, FIXED_DT);
        closed = run.events.some((e) => e.type === 'cut.closed');
      }
      assert(closed);
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.status, 'running');
      assert.equal(run.totalClaimable, denominator);
      assert(run.tick < 150);
      assert.equal(run.player.speed, 0);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    });
