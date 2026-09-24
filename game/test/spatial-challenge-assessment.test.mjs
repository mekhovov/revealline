import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileContentProject } from '../content-design/project.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createSpatialChallengeJourney } from '../content-design/spatial-challenge-journey.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
  searchSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';
import { GAMEPLAY_TUNING_VERSION, recoverGameplayTuning } from '../gameplay-tuning.mjs';

const project = compileContentProject(createOpeningCandidates());
const prepared = prepareSpatialMission(project, 'first-return');
const spatial = compileContentProject(createSpatialChallengeJourney());
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/spatial-challenge-clear-routes.json', import.meta.url), 'utf8'),
);
const approaches = JSON.parse(
  readFileSync(
    new URL('./fixtures/spatial-challenge-approach-routes.json', import.meta.url),
    'utf8',
  ),
);
for (const row of [...fixture.rows, ...approaches.rows])
  test(`current gp4 legal-input clear and replay: ${row.missionId}/${row.difficulty}/${row.turnPolicy}/seed${row.seed}/${row.approach ?? 'primary'}`, () => {
    const mission = prepareSpatialMission(spatial, row.missionId, { difficulty: row.difficulty });
    assert.equal(mission.simulationIdentity, row.simulationIdentity);
    assert.equal(mission.authoredSimulationIdentity, row.authoredSimulationIdentity);
    const result = assessSpatialRoute(mission, {
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      segments: row.segments.map(([direction, ticks]) => ({ direction, ticks })),
    });
    for (const key of [
      'status',
      'ticks',
      'cuts',
      'coverage',
      'losses',
      'checkpoint',
      'levelIdentity',
    ])
      assert.equal(result[key], row[key], key);
    assert.equal(result.status, 'no-loss-clear');
    assert.equal(result.replayVerified, true);
    assert.equal(result.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
    assert.equal(result.gameplayTuning.adminOverride, false);
    assert.deepEqual(
      result.closures.map((c) => [c.tick, c.coverage]),
      row.closureCoverage,
    );
    assert.deepEqual(
      result.events.filter((e) => e.type === 'objective.captured').map((e) => [e.tick, e.id]),
      row.objectiveCaptures,
    );
    if (row.missionId === 'twin-receivers') {
      const captures = new Map(row.objectiveCaptures.map(([tick, id]) => [id, tick]));
      assert(captures.has('west-shield') && captures.has('east-shield'));
      assert.notEqual(captures.get('west-shield'), captures.get('east-shield'));
    }
  });
test('spatial evidence uses current tuned runtime and records failed routes with public replay', () => {
  const result = assessSpatialRoute(prepared, { segments: [{ direction: 'down', ticks: 1000 }] });
  assert.equal(result.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
  assert.deepEqual(recoverGameplayTuning(prepared.level), result.gameplayTuning);
  assert.notEqual(result.simulationIdentity, result.authoredSimulationIdentity);
  assert.equal(result.replayVerified, true);
  assert.equal(result.status, 'no-loss-clear');
  assert.equal(result.cuts, 1);
  assert.equal(result.closures[0].claimedCells, result.claimedCells);
  assert(result.segments.length);
  assert(result.initialComponents.some((c) => c.enemyIds.includes('keeper')));
  const repeated = assessSpatialRoute(prepared, { segments: result.segments });
  assert.deepEqual(repeated, result);
  const exhausted = assessSpatialRoute(prepared, { segments: [{ direction: null, ticks: 1 }] });
  assert.equal(exhausted.status, 'route-exhausted');
  assert.equal(exhausted.qualification, 'needs-new-route-not-proven-impossible');
  assert.deepEqual(exhausted.segments, [{ direction: null, ticks: 1 }]);
  const failed = assessSpatialRoute(prepared, {
    segments: [
      { direction: 'down', ticks: 60 },
      { direction: 'up', ticks: 60 },
    ],
  });
  assert.equal(failed.status, 'life-lost');
  assert.equal(failed.failureCause, 'self-contact');
  assert.equal(failed.replayVerified, true);
  assert.deepEqual(failed.segments, [
    { direction: 'down', ticks: 60 },
    { direction: 'up', ticks: 1 },
  ]);
});
test('spatial search is tick-bounded and reproduces its actual chosen inputs', () => {
  const options = { simulationTickBudget: 1000, candidateLimit: 2, maxCuts: 1 };
  const result = searchSpatialRoute(prepared, options);
  const repeated = searchSpatialRoute(prepared, options);
  assert.deepEqual(repeated, result);
  assert(result.search.simulatedTicks <= options.simulationTickBudget);
  assert(result.search.attempts.length > 0);
  const { search: _search, ...evidence } = result;
  assert.deepEqual(assessSpatialRoute(prepared, { segments: result.segments }), evidence);
});
test('spatial assessment rejects invalid seeds, steering, segments, and excessive work', () => {
  const valid = { segments: [{ direction: 'down', ticks: 1 }] };
  for (const patch of [
    { seed: 0 },
    { turnPolicy: 'random' },
    { segments: [] },
    { segments: [{ direction: 'warp', ticks: 1 }] },
    { segments: [{ direction: 'down', ticks: 120001 }] },
  ])
    assert.throws(() => assessSpatialRoute(prepared, { ...valid, ...patch }), /Invalid/);
  for (const patch of [
    { simulationTickBudget: 1000001 },
    { candidateLimit: 0 },
    { policy: 'perfect' },
  ])
    assert.throws(() => searchSpatialRoute(prepared, patch), /Invalid/);
});

test('qualification receipts have unique current configurations and an explicit superseded boundary', () => {
  const current = [...fixture.rows, ...fixture.incompleteSearches];
  const key = (row) => [row.missionId, row.difficulty, row.turnPolicy, row.seed].join('/');
  assert.equal(new Set(current.map(key)).size, current.length);
  for (const missionId of [
    'two-bays',
    'neon-remix',
    'broken-yard',
    'read-the-arrows',
    'crossing-complete',
    'twin-receivers',
  ])
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const row = fixture.rows.find(
          (r) =>
            r.missionId === missionId &&
            r.difficulty === difficulty &&
            r.turnPolicy === turnPolicy &&
            r.seed === 1,
        );
        assert(row, key({ missionId, difficulty, turnPolicy, seed: 1 }));
      }
  assert.equal(fixture.supersededGeometry.rows.length, 14);
  assert(
    fixture.supersededGeometry.rows.every((row) =>
      ['two-bays', 'read-the-arrows'].includes(row.missionId),
    ),
  );
});
test('Two bays east-first alternative begins with an actual occupied-region line-only connection', () => {
  const row = approaches.rows.find((r) => r.missionId === 'two-bays');
  const mission = prepareSpatialMission(spatial, row.missionId, { difficulty: row.difficulty });
  const result = assessSpatialRoute(mission, {
    seed: row.seed,
    turnPolicy: row.turnPolicy,
    segments: row.segments.map(([direction, ticks]) => ({ direction, ticks })),
  });
  assert.equal(row.segments[0][0], 'right');
  const closure = result.closures[0];
  assert.equal(closure.claimedCells, 42);
  assert.equal(closure.retainedComponents.filter((c) => c.retained).length, 3);
  assert.equal(result.status, 'no-loss-clear');
});
