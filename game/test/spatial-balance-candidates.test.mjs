import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSpatialBalanceCandidates } from '../content-design/spatial-balance-candidates.mjs';
import { createCulturalWorkshopCandidates } from '../content-design/cultural-workshop-candidates.mjs';
import { createPursuitInterceptCandidates } from '../content-design/pursuit-intercept-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const projects = new Map(
  [false, true].map((pressure) => [
    pressure,
    compileContentProject(createSpatialBalanceCandidates({ pressure })),
  ]),
);
for (const pressure of [false, true]) {
  test(`spatial revision is copy-on-write and preserves quotas, rules and unrelated missions: pressure=${pressure}`, () => {
    const create = pressure ? createPursuitInterceptCandidates : createCulturalWorkshopCandidates;
    const old = create(),
      snapshot = structuredClone(old);
    const next = createSpatialBalanceCandidates({ pressure }),
      project = projects.get(pressure);
    assert.deepEqual(create(), snapshot);
    assert.equal(next.revision, 'spatial-2');
    assert.equal(next.difficultyCatalogId, old.difficultyCatalogId);
    for (const mission of next.missions) {
      const original = old.missions.find((m) => m.id === mission.id);
      const changed = ['dnipro-crossings', 'four-motor-landings', 'motor-feint'].includes(
        mission.id,
      );
      if (!changed) assert.deepEqual(mission, original);
      const map = next.maps.find((m) => m.id === mission.map.id);
      if (!changed)
        assert.deepEqual(
          map,
          old.maps.find((m) => m.id === map.id),
        );
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const previous = resolveMission(compileContentProject(old), mission.id, { difficulty });
        const current = resolveMission(project, mission.id, { difficulty });
        assert.deepEqual(current.level.rules, previous.level.rules);
        assert.equal(current.officialProgressEligible, false);
        assert.deepEqual(
          current.level,
          resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
        );
        assert.equal(
          current.level.classic.enemyPressure?.actors[0]?.warningTicks,
          previous.level.classic.enemyPressure?.actors[0]?.warningTicks,
        );
      }
    }
    next.maps[0].walls.length = 0;
    assert.deepEqual(create(), snapshot, 'Returned drafts cannot mutate older editions');
  });
  test(`revised geometry has usable returns, no remote autofill and no immediate spawn pressure: pressure=${pressure}`, () => {
    const project = projects.get(pressure);
    for (const mission of project.missions.filter((m) => m.revision === 'spatial-2')) {
      const map = project.maps.find((m) => m.source.id === mission.map.id);
      assert.equal(map.geometry.fieldComponents.length, 1);
      assert(map.geometry.safeComponents.every((c) => c.departures.length >= 4));
      assert.deepEqual(
        map.geometry.diagnostics.map((d) => d.code),
        ['disconnected-foundations'],
      );
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const manifest = resolveMission(project, mission.id, { difficulty });
        const run = createRun(manifest.level, { seed: 1 });
        for (let i = 0; i < 1200; i++) stepRun(run, { direction: null }, FIXED_DT);
        assert.equal(run.status, 'running');
        assert.equal(run.lives, manifest.level.rules.lives);
      }
    }
  });
}

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/spatial-balance-clear-routes.json', import.meta.url)),
);
test('qualification matrix contains every revised mission/preset/steering combination exactly once', () => {
  const keys = fixture.rows.map((r) => [r.mission, r.difficulty, r.turnPolicy].join('/'));
  assert.equal(keys.length, 18);
  assert.equal(new Set(keys).size, 18);
  for (const id of ['dnipro-crossings', 'four-motor-landings', 'motor-feint'])
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center'])
        assert(keys.includes([id, difficulty, turnPolicy].join('/')));
});
test('delayed-start evidence stays separate from the complete preset matrix', () => {
  assert.equal(fixture.stressRows.length, 3);
  assert.equal(new Set(fixture.stressRows.map((row) => row.mission)).size, 3);
  for (const row of fixture.stressRows) {
    assert.equal(row.seed, 2);
    assert.equal(row.initialDelayTicks, 180);
    assert.equal(row.difficulty, 'standard');
    assert.equal(row.turnPolicy, 'immediate');
    assert.equal(row.segments[0][0], null);
    assert(row.segments[0][1] >= 180);
  }
});
for (const row of [...fixture.rows, ...fixture.stressRows]) {
  const { mission, difficulty, turnPolicy, seed, segments } = row;
  test(`spatial candidate lossless Solo/replay and equal Versus: ${mission}/${difficulty}/${turnPolicy}/seed${seed}/delay${row.initialDelayTicks}`, () => {
    const manifest = resolveMission(projects.get(mission === 'motor-feint'), mission, {
      difficulty,
    });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed, turnPolicy, classId: 'scout' };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options),
      events = {};
    const match = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    resumeDuel(match);
    for (const [direction, ticks] of segments)
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        assert.equal(match.status, 'running');
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        stepDuel(match, [{ direction }, { direction }]);
        assert.equal(run.lives, manifest.level.rules.lives);
        for (const e of run.events.filter((e) => e.type.startsWith('pressure.'))) {
          const key = `${e.id}:${e.type}`;
          events[key] = (events[key] ?? 0) + 1;
        }
      }
    assert.equal(run.status, 'won');
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert.deepEqual(events, row.pressureEvents);
    if (mission === 'motor-feint') assert(events['west:pressure.warning'] > 0);
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(match.runs.every((r) => r.status === 'won' && r.lives === manifest.level.rules.lives));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });
}
