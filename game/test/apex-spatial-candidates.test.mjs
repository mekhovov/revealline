import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApexCandidates } from '../content-design/apex-candidates.mjs';
import { createApexSpatialCandidates } from '../content-design/apex-spatial-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const oldSource = withPressureDifficulty(createApexCandidates());
const old = compileContentProject(oldSource);
const revised = compileContentProject(createApexSpatialCandidates());
const presets = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];

test('Studio study uses existing explicit inspection and Apply, not automatic enrollment', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert(html.includes('id="apex-spatial">Inspect Home Signal contested-return study</button>'));
  const action = host.slice(
    host.indexOf("$('apex-spatial').onclick"),
    host.indexOf("$('whole-journey').onclick"),
  );
  assert.match(action, /discardSource\(\)/);
  assert.match(action, /createApexSpatialCandidates\(\)/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session\.replace|launchPreview/);
});

test('Home approach is one explicit spatial successor; old sources, mechanics and other missions stay exact', () => {
  assert.deepEqual(withPressureDifficulty(createApexCandidates()), oldSource);
  assert.equal(revised.source.revision, 'home-approach-1');
  assert.equal(revised.source.difficultyCatalogId, 'journey-difficulty-v2');
  for (const mission of revised.missions)
    for (const difficulty of presets) {
      const prior = resolveMission(old, mission.id, { difficulty });
      const next = resolveMission(revised, mission.id, { difficulty });
      assert.equal(next.officialProgressEligible, false);
      assert.deepEqual(
        next.level,
        resolveMission(revised, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (mission.id !== 'home-signal') assert.deepEqual(next.level, prior.level);
      else {
        assert.notEqual(next.simulationIdentity, prior.simulationIdentity);
        for (const key of ['rules', 'goal', 'encounter'])
          assert.deepEqual(next.level[key], prior.level[key]);
        const before = old.missions.find((item) => item.id === mission.id);
        assert.deepEqual(
          mission.actors.map(({ id, role, tier }) => [id, role, tier]),
          before.actors.map(({ id, role, tier }) => [id, role, tier]),
        );
        assert.deepEqual(mission.design.difficulty, before.design.difficulty);
        assert.deepEqual(mission.design.mastery, before.design.mastery);
        assert.deepEqual(mission.bonuses, before.bonuses);
        assert.deepEqual(mission.relayLinks, before.relayLinks);
        assert.deepEqual(mission.design.introduces, []);
      }
    }
});

test('both artwork editions preserve exact original asset pins and all presentation bindings', () => {
  const before = createApexCandidates({ artwork: true });
  const after = createApexSpatialCandidates({ artwork: true });
  assert.deepEqual(after.assets, before.assets);
  assert.deepEqual(
    after.missions.map((mission) => mission.presentation),
    before.missions.map((mission) => mission.presentation),
  );
  assert.deepEqual(after.maps, revised.source.maps);
});

test('three shield approaches share one retained field, usable returns and a reserved non-scoring transfer', () => {
  const map = revised.maps.find((item) => item.source.id === 'home-signal-map');
  assert.equal(map.geometry.fieldComponents.length, 1);
  assert(map.geometry.safeComponents.every((component) => component.departures.length >= 4));
  assert.deepEqual(
    map.geometry.diagnostics.map((item) => item.code),
    ['disconnected-foundations'],
  );
  const run = createRun(resolveMission(revised, 'home-signal').level);
  assert.equal(run.totalClaimable, 1921);
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(snapshot.filledCells.length, 0);
  assert.deepEqual(snapshot.components[0].enemyIds, ['sentinel']);
  assert(
    run.objectives.every(
      (item) => run.cells[Math.floor(item.y) * run.width + Math.floor(item.x)] === CELL.FIELD,
    ),
  );
  assert.equal(run.relay.gates[0].cells.length, 24);
});

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`Home approach idle and three real first-return choices: ${difficulty}/${turnPolicy}`, () => {
      const level = resolveMission(revised, 'home-signal', { difficulty }).level;
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const idle = createRun(level, options);
      for (let tick = 0; tick < 1200; tick++) stepRun(idle, { direction: null }, FIXED_DT);
      assert.equal(idle.classic.livesLost, 0);
      assert.equal(idle.claimedCount, 0);
      for (const [direction, ticks, earned] of [
        ['up', 102, 5],
        ['down', 114, 5],
        ['left', 174, 9],
      ]) {
        const run = createRun(level, options);
        for (let tick = 0; tick < ticks; tick++) stepRun(run, { direction }, FIXED_DT);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.claimedCount, earned);
        assert(run.events.some((event) => event.type === 'cut.closed'));
        assert.equal(run.player.speed, 0);
        assert.equal(run.status, 'running');
        assert.equal(run.encounter.stage, 'shielded');
        assert(run.objectives.every((item) => !item.captured));
        assert.equal(run.totalClaimable, 1921);
      }
    });

test('historical Home shortcuts keep exact checkpoints but do not clear the explicit approach successor', async () => {
  const audit = JSON.parse(
    await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
  );
  const late = JSON.parse(
    await readFile(new URL('./fixtures/late-journey-pressure-routes.json', import.meta.url)),
  );
  const historical = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
  const rows = audit.rows
    .filter((row) => row.missionId === 'home-signal' && row.chosen)
    .map((row) => ({
      difficulty: row.difficulty,
      turnPolicy: row.turnPolicy,
      segments: row.chosen.segments,
      checkpoint: row.chosen.checkpoint,
    }));
  for (const row of late.rows.filter((item) => item.id === 'home-signal'))
    rows.push({
      ...row,
      segments: row.segments.map(({ direction, ticks }) => [direction, ticks]),
      checkpoint: row.metrics.checkpoint,
    });
  assert.equal(rows.length, 6);
  for (const row of rows) {
    const before = assessPressureRoute(
      resolveMission(historical, 'home-signal', { difficulty: row.difficulty }).level,
      { ...row, replay: true },
    );
    assert.equal(before.status, 'no-loss-clear');
    assert.equal(before.checkpoint, row.checkpoint);
    const after = assessPressureRoute(
      resolveMission(revised, 'home-signal', { difficulty: row.difficulty }).level,
      row,
    );
    assert.notEqual(after.status, 'no-loss-clear');
  }
});
