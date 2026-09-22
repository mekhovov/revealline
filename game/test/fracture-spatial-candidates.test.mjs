import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFractureCandidates } from '../content-design/fracture-candidates.mjs';
import { createFractureSpatialCandidates } from '../content-design/fracture-spatial-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const original = createFractureCandidates();
const previous = compileContentProject(withPressureDifficulty(original));
const project = compileContentProject(createFractureSpatialCandidates());
test('Studio keeps original pictures and explicit successor inspection separate', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert(html.includes('id="fracture-spatial">Inspect Two Districts greybox successor</button>'));
  assert(html.includes('id="fracture">Inspect Fractured Grid picture candidates</button>'));
  const action = host.slice(
    host.indexOf("$('fracture-spatial').onclick"),
    host.indexOf("$('phase').onclick"),
  );
  assert.match(action, /discardSource\(\)/);
  assert.match(action, /createFractureSpatialCandidates\(\)/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session\.replace|launchPreview/);
});
test('one isolated district successor preserves every other Fracture level and all shared rules', () => {
  assert.deepEqual(createFractureCandidates(), original);
  assert.equal(project.source.id, 'fracture-spatial-review');
  assert.equal(project.source.difficultyCatalogId, 'journey-difficulty-v2');
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const old = resolveMission(previous, mission.id, { difficulty });
      const next = resolveMission(project, mission.id, { difficulty });
      assert.equal(next.officialProgressEligible, false);
      assert.deepEqual(next.level.rules, old.level.rules);
      assert.deepEqual(next.level.goal, old.level.goal);
      assert.deepEqual(
        next.level,
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (mission.id !== 'two-districts') assert.deepEqual(next.level, old.level);
      else {
        assert.notEqual(next.simulationIdentity, old.simulationIdentity);
        assert.deepEqual(next.level.classic.terrain, old.level.classic.terrain);
        assert.deepEqual(mission.objectives, []);
        assert.equal(mission.actors.length, 5);
        assert.equal(new Set(mission.actors.map((a) => a.role)).size, 3);
        assert(mission.design.combines.includes('field-keeper'));
        assert.equal(mission.design.difficulty.threatDensity, 5);
        assert(mission.actors.every((a) => a.tier === 'measured'));
      }
    }
});
test('districts remain two occupied components with usable island departures and no auto-fill', () => {
  const map = project.maps.find((m) => m.source.id === 'two-districts-map');
  assert.equal(map.geometry.fieldComponents.length, 2);
  assert.equal(map.geometry.safeComponents.length, 3);
  assert(map.geometry.safeComponents.every((c) => c.departures.length >= 4));
  assert.deepEqual(
    map.geometry.diagnostics.map((d) => d.code),
    ['disconnected-foundations'],
  );
  const run = createRun(resolveMission(project, 'two-districts').level, { seed: 1 });
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(snapshot.filledCells.length, 0);
  assert.deepEqual(
    snapshot.components.map((c) => c.enemyIds),
    [
      ['west-cutter', 'west-keeper'],
      ['east-cutter', 'east-keeper'],
    ],
  );
});
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`district first return and idle decision space: ${difficulty}/${turnPolicy}`, () => {
      const level = resolveMission(project, 'two-districts', { difficulty }).level;
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const idle = createRun(level, options);
      for (let tick = 0; tick < 1200; tick++) stepRun(idle, { direction: null }, FIXED_DT);
      assert.equal(idle.classic.livesLost, 0);
      const run = createRun(level, options),
        denominator = run.totalClaimable;
      for (let tick = 0; tick < 126; tick++) stepRun(run, { direction: 'left' }, FIXED_DT);
      assert(run.events.some((e) => e.type === 'cut.closed'));
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.status, 'running');
      assert.equal(run.totalClaimable, denominator);
      assert(run.coverage > 0 && run.coverage < 0.01);
    });
test('four old fast paths remain historical controls but do not clear the successor', async () => {
  const fixture = JSON.parse(
    await readFile(new URL('./fixtures/relay-fracture-pressure-routes.json', import.meta.url)),
  );
  const old = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
  const rows = fixture.rows.filter((r) => r.id === 'two-districts');
  assert.equal(rows.length, 4);
  for (const row of rows) {
    const options = {
      segments: row.segments.map((s) => [s.direction, s.ticks]),
      turnPolicy: row.turnPolicy,
    };
    const historical = assessPressureRoute(
      resolveMission(old, row.id, { difficulty: row.difficulty }).level,
      options,
    );
    assert.equal(historical.status, 'no-loss-clear');
    assert.equal(historical.checkpoint, row.checkpoint);
    const next = assessPressureRoute(
      resolveMission(project, row.id, { difficulty: row.difficulty }).level,
      options,
    );
    assert.notEqual(next.status, 'no-loss-clear');
  }
});
