import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
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

for (const row of approaches.rows.filter((row) => row.prefixEvidence))
  test(`intended approach reaches its authored return and capture effect: ${row.missionId}/${row.approach}`, () => {
    const mission = prepareSpatialMission(spatial, row.missionId, { difficulty: row.difficulty });
    const run = createRun(mission.level, {
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      classId: 'scout',
    });
    let closures = 0;
    let neutralizedLethalCells = 0;
    outer: for (const [direction, ticks] of row.segments)
      for (let tick = 0; tick < ticks; tick++) {
        if (run.tick === row.prefixEvidence.ticks) break outer;
        stepRun(run, { direction }, FIXED_DT);
        for (const event of run.events) {
          if (event.type === 'cut.closed') closures++;
          if (event.type === 'cells.claimed')
            neutralizedLethalCells += event.indices.filter(
              (index) => run.classic.terrain[index] === 2,
            ).length;
        }
      }
    assert.equal(run.tick, row.prefixEvidence.ticks);
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.player.cutting, false);
    assert.equal(closures, row.prefixEvidence.closures);
    assert.equal(neutralizedLethalCells, row.prefixEvidence.neutralizedLethalCells);
    const [left, top, right, bottom] = row.prefixEvidence.returnBounds;
    assert(run.player.x >= left && run.player.x <= right);
    assert(run.player.y >= top && run.player.y <= bottom);
  });

test('all six approach pairs resolve to actual cleared routes, not search-policy labels', () => {
  assert.equal(approaches.pairs.length, 6);
  assert.equal(new Set(approaches.pairs.map((pair) => pair.missionId)).size, 6);
  for (const pair of approaches.pairs) {
    assert.equal(pair.routes.length, 2);
    const selected = pair.routes.map((reference) => {
      const source = reference.approach ? approaches.rows : fixture.rows;
      const matches = source.filter(
        (row) =>
          row.missionId === pair.missionId &&
          Object.entries(reference).every(([key, value]) => row[key] === value),
      );
      assert.equal(matches.length, 1, `${pair.missionId}: ${pair.comparison}`);
      assert.equal(matches[0].status, 'no-loss-clear');
      return matches[0];
    });
    assert.notDeepEqual(selected[0].segments, selected[1].segments);
  }
});

test('Crossing timing sensitivity retains the successful narrow window and all failed checks', () => {
  assert.equal(approaches.crossingTimingSensitivity.rows.length, 6);
  let clears = 0;
  for (const row of approaches.crossingTimingSensitivity.rows) {
    const mission = prepareSpatialMission(spatial, row.missionId, { difficulty: row.difficulty });
    assert.equal(mission.simulationIdentity, row.simulationIdentity);
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
      'failureCause',
      'checkpoint',
    ])
      assert.equal(result[key], row[key], key);
    assert.equal(result.replayVerified, true);
    if (result.status === 'no-loss-clear') clears++;
  }
  assert.equal(clears, 1);
});

test('route CLI requires an explicit approach for ambiguous configurations', () => {
  const cli = fileURLToPath(new URL('../../scripts/probe-spatial-challenge.mjs', import.meta.url));
  const routes = fileURLToPath(
    new URL('./fixtures/spatial-challenge-approach-routes.json', import.meta.url),
  );
  const args = [cli, 'read-the-arrows', `--route=${routes}`];
  const ambiguous = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.notEqual(ambiguous.status, 0);
  assert.match(ambiguous.stderr, /Ambiguous route configuration/);
  const selected = spawnSync(process.execPath, [...args, '--approach=fast-southbound'], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(selected.status, 0, selected.stderr);
  const evidence = JSON.parse(selected.stdout);
  assert.equal(evidence.approach, 'fast-southbound');
  assert.equal(evidence.status, 'no-loss-clear');
  assert.equal(evidence.replayVerified, true);
});
