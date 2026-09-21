import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPhaseSpatialCandidates } from '../content-design/phase-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';
import {
  createMiddleEvidence,
  middleBeforeStep,
  observeMiddleEvidence,
  inspectMiddleEvidence,
} from './helpers/middle-pressure-evidence.mjs';

const project = compileContentProject(createPhaseSpatialCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/phase-spatial-clear-routes.json', import.meta.url)),
);
const mastery = JSON.parse(
  await readFile(new URL('./fixtures/phase-spatial-mastery-routes.json', import.meta.url)),
);
const key = (r) => [r.difficulty, r.turnPolicy, r.seed, r.delaySeconds].join('/');
test('reserve ordinary study covers all six configurations plus explicit seed and delay samples', () => {
  assert.equal(fixture.format, 'PhaseSpatialFeasibilityV1');
  assert.equal(fixture.projectRevision, project.source.revision);
  assert.equal(fixture.rows.length, 18);
  const expected = ['gentle', 'standard', 'expert'].flatMap((difficulty) =>
    ['immediate', 'grid-center'].flatMap((turnPolicy) =>
      [
        [1, 0],
        [2, 0],
        [1, 1.5],
      ].map(([seed, delaySeconds]) => key({ difficulty, turnPolicy, seed, delaySeconds })),
    ),
  );
  assert.deepEqual(fixture.rows.map(key).sort(), expected.sort());
  assert.equal(fixture.rows.filter((r) => r.evidence.optionalGoal.achieved).length, 15);
  assert(
    fixture.rows.some((r) => r.metrics.seconds < 30),
    'short optimized paths remain visible in the record',
  );
});
test('reserve mastery records separate all-six paths with a visible active-impact closure', () => {
  assert.equal(mastery.format, 'PhaseSpatialMasteryV1');
  assert.equal(mastery.projectRevision, project.source.revision);
  const expected = ['gentle', 'standard', 'expert'].flatMap((difficulty) =>
    ['immediate', 'grid-center'].map((turnPolicy) =>
      key({ difficulty, turnPolicy, seed: 1, delaySeconds: 0 }),
    ),
  );
  assert.deepEqual(mastery.rows.map(key).sort(), expected.sort());
  assert(
    mastery.rows.every(
      (r) => r.evidence.optionalGoal.achieved && r.impacts.some((i) => i.visibleTicks >= 29),
    ),
  );
});
for (const [label, row] of [
  ['ordinary', fixture],
  ['mastery', mastery],
].flatMap(([label, collection]) => collection.rows.map((row) => [label, row])))
  test(`reserve ${label} no-loss clear/replay/equal race: ${key(row)}`, () => {
    assert.equal(row.id, 'return-in-reserve');
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const segments = row.segments.map((s) => [s.direction, s.ticks]);
    const { segments: played, ...metrics } = assessPressureRoute(manifest.level, {
      segments,
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      replay: true,
    });
    assert.deepEqual(played, segments);
    assert.deepEqual(metrics, row.metrics);
    assert.equal(metrics.status, 'no-loss-clear');
    assert.deepEqual(metrics.collectedBonusIds, []);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      evidence = createMiddleEvidence('phase', run);
    const match = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(match.runs[0].cells, match.runs[1].cells);
    resumeDuel(match);
    const denominator = run.totalClaimable,
      closures = [],
      impacts = [];
    let activeFrom = null;
    for (const [direction, ticks] of segments)
      for (let t = 0; t < ticks; t++) {
        assert.equal(run.status, 'running');
        assert.equal(match.status, 'running');
        const before = middleBeforeStep(run, evidence);
        stepRun(run, { direction }, FIXED_DT);
        observeMiddleEvidence(run, evidence, before);
        stepDuel(match, [{ direction }, { direction }]);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, denominator);
        if (run.events.some((e) => e.type === 'lineImpact.seeded')) activeFrom ??= run.tick;
        if (run.events.some((e) => e.type === 'cut.closed')) {
          closures.push([run.tick, run.coverage]);
          if (run.events.some((e) => e.type === 'lineImpact.cleared' && e.reason === 'capture'))
            impacts.push({
              closedAt: run.tick,
              seededAt: activeFrom,
              visibleTicks: run.tick - activeFrom,
            });
          activeFrom = null;
        }
      }
    assert.deepEqual(closures, row.closures);
    assert.equal(closures.length, row.cuts);
    assert.deepEqual(impacts, row.impacts);
    const checkpoint = authoritativeCheckpoint(run);
    assert.equal(checkpoint.hash, row.checkpoint);
    assert.deepEqual(inspectMiddleEvidence(run, evidence), row.evidence);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    if (label === 'mastery') assert.equal(row.evidence.optionalGoal.achieved, true);
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });
