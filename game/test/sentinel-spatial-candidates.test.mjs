import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { createSentinelSpatialCandidates } from '../content-design/sentinel-spatial-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const source = createSentinelCandidates(),
  original = structuredClone(source);
const old = compileContentProject(withPressureDifficulty(source));
const project = compileContentProject(createSentinelSpatialCandidates());
const ids = ['twin-receivers', 'relay-perimeter'];
const presets = ['gentle', 'standard', 'expert'];
test('Studio exposes a separate greybox inspection, never automatic apply or replacement', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert(
    html.includes('id="sentinel-spatial">Inspect Sentinel receiver greybox successor</button>'),
  );
  assert(html.includes('id="sentinel">Inspect Sentinel Crown picture candidates</button>'));
  const action = host.slice(
    host.indexOf("$('sentinel-spatial').onclick"),
    host.indexOf("$('apex').onclick"),
  );
  assert.match(action, /discardSource\(\)/);
  assert.match(action, /createSentinelSpatialCandidates\(\)/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session\.replace|launchPreview/);
  assert(html.includes('Apply inspected source'));
});
test('receiver successors isolate geometry changes and preserve the sole-anchor recipe and quotas', () => {
  assert.deepEqual(createSentinelCandidates(), original);
  assert.equal(project.source.difficultyCatalogId, 'journey-difficulty-v2');
  for (const mission of project.missions)
    for (const difficulty of presets) {
      const prior = resolveMission(old, mission.id, { difficulty }),
        next = resolveMission(project, mission.id, { difficulty });
      assert.deepEqual(next.level.rules, prior.level.rules);
      assert.deepEqual(next.level.encounter, prior.level.encounter);
      assert.deepEqual(next.level.goal, prior.level.goal);
      assert.equal(next.officialProgressEligible, false);
      assert.deepEqual(
        next.level,
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
      );
      assert.deepEqual(mission.modes, ['solo', 'versus']);
      assert.deepEqual(
        mission.actors.map((a) => [a.id, a.role, a.tier]),
        old.missions.find((m) => m.id === mission.id).actors.map((a) => [a.id, a.role, a.tier]),
      );
      if (ids.includes(mission.id))
        assert.notEqual(next.simulationIdentity, prior.simulationIdentity);
      else assert.deepEqual(next.level, prior.level);
    }
});
test('both receiver courts start connected and retained, with usable departures and valid field objectives', () => {
  for (const id of ids) {
    const mission = project.missions.find((m) => m.id === id),
      map = project.maps.find((m) => m.source.id === mission.map.id);
    assert.equal(map.geometry.fieldComponents.length, 1);
    assert(map.geometry.safeComponents.every((c) => c.departures.length >= 4));
    assert.deepEqual(
      map.geometry.diagnostics.map((d) => d.code),
      ['disconnected-foundations'],
    );
    const run = createRun(resolveMission(project, id).level, { seed: 1 });
    const snapshot = inspectCaptureSnapshot(run);
    assert.equal(snapshot.filledCells.length, 0);
    assert.deepEqual(snapshot.components[0].enemyIds, ['sentinel']);
    assert(
      run.objectives.every(
        (o) => run.cells[Math.floor(o.y) * run.width + Math.floor(o.x)] === CELL.FIELD,
      ),
    );
  }
});
for (const difficulty of presets)
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`idle decision space and first return remain lossless: ${difficulty}/${turnPolicy}`, () => {
      for (const id of ids) {
        const manifest = resolveMission(project, id, { difficulty }),
          options = { seed: 1, turnPolicy, classId: 'scout' };
        const idle = createRun(manifest.level, options);
        for (let n = 0; n < 1200; n++) stepRun(idle, { direction: null }, FIXED_DT);
        assert.equal(idle.classic.livesLost, 0, id);
        const run = createRun(manifest.level, options),
          denominator = run.totalClaimable;
        for (let n = 0; n < 1200 && !run.claimedCount; n++) {
          stepRun(run, { direction: id === 'twin-receivers' ? 'up' : 'down' }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, id);
        }
        assert(run.claimedCount > 0);
        assert.equal(run.status, 'running');
        assert.equal(run.encounter.stage, 'shielded');
        assert.equal(run.totalClaimable, denominator);
      }
    });
test('all twelve historical fast routes remain exact controls but no longer clear the new geometry', async () => {
  const audit = JSON.parse(
    await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
  );
  const rows = audit.rows.filter((r) => ids.includes(r.missionId));
  const historical = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
  assert.equal(rows.length, 12);
  for (const row of rows) {
    const options = { segments: row.chosen.segments, turnPolicy: row.turnPolicy };
    const manifest = resolveMission(historical, row.missionId, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const previous = assessPressureRoute(manifest.level, options);
    assert.equal(previous.status, 'no-loss-clear');
    assert.equal(previous.checkpoint, row.chosen.checkpoint);
    const current = assessPressureRoute(
      resolveMission(project, row.missionId, { difficulty: row.difficulty }).level,
      options,
    );
    assert.notEqual(current.status, 'no-loss-clear');
  }
});
