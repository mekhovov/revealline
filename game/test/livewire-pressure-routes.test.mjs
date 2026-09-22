import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';
import {
  createLivewireGoalEvidence,
  livewireBeforeStep,
  observeLivewireGoal,
  inspectLivewireGoal,
} from './helpers/livewire-goal.mjs';

const project = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/livewire-pressure-clear-routes.json', import.meta.url)),
);
const old = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const key = (r) => [r.id ?? r.missionId, r.difficulty, r.turnPolicy].join('/');
test('new Livewire paths cover all seven unchanged pressure editions, presets and steering modes', () => {
  assert.equal(fixture.format, 'LivewirePressureFeasibilityV1');
  const expected = old.rows.filter((r) => r.chapter === 'livewire');
  assert.equal(fixture.rows.length, 42);
  assert.equal(new Set(fixture.rows.map(key)).size, 42);
  assert.deepEqual(fixture.rows.map(key).sort(), expected.map(key).sort());
  for (const row of fixture.rows) {
    assert.equal(
      row.simulationIdentity,
      expected.find((r) => key(r) === key(row)).simulationIdentity,
    );
    assert.equal(row.status, 'won');
    assert.equal(row.delaySeconds, 0);
  }
});
for (const row of fixture.rows)
  test(`new Livewire no-loss path/replay/equal race: ${key(row)}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const segments = row.segments.map((s) => [s.direction, s.ticks]);
    const result = assessPressureRoute(manifest.level, {
      segments,
      turnPolicy: row.turnPolicy,
      replay: true,
    });
    assert.equal(result.status, 'no-loss-clear');
    assert.equal(result.checkpoint, row.checkpoint);
    assert.deepEqual(result, row.metrics);
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      evidence = createLivewireGoalEvidence(run);
    const match = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(match.runs[0].cells, match.runs[1].cells);
    resumeDuel(match);
    const events = [],
      closures = [];
    for (const [direction, ticks] of segments)
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        assert.equal(match.status, 'running');
        const before = livewireBeforeStep(run);
        stepRun(run, { direction }, FIXED_DT);
        observeLivewireGoal(run, evidence, before);
        stepDuel(match, [{ direction }, { direction }]);
        assert.equal(run.classic.livesLost, 0);
        for (const e of run.events)
          if (['boss.warning', 'life.lost', 'cut.closed', 'lineImpact.created'].includes(e.type))
            events.push([run.tick, e.type]);
        if (run.events.some((e) => e.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
      }
    const mission = project.missions.find((m) => m.id === row.id);
    const foundations = project.maps.find((m) => m.source.id === mission.map.id).source.foundations;
    assert.deepEqual(
      inspectLivewireGoal({ missionId: row.id, run, foundations, evidence }),
      row.goal,
    );
    assert.deepEqual(events, row.events);
    assert.deepEqual(closures, row.closures);
    assert.equal(closures.length, row.cuts);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });
