import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  APEX_PRESSURE_PAIR_DISPOSITIONS,
  createApexPressurePairCandidates,
} from '../content-design/apex-pressure-pair-candidates.mjs';
import { createLatePressurePairCandidates } from '../content-design/late-pressure-pair-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { pressureWaypoint, updateEnemyPressure } from '../core/enemy-pressure.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const baselineSource = createLatePressurePairCandidates({ artwork: true });
const candidateSource = createApexPressurePairCandidates({ artwork: true });
const baseline = compileContentProject(baselineSource);
const project = compileContentProject(candidateSource);
const target = Object.freeze({
  'crossing-complete': { actorId: 'upper', role: 'heading-interceptor' },
  'final-broadcast': { actorId: 'carrier', role: 'trail-pursuer' },
});
const historicalAudit = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const lateRoutes = JSON.parse(
  await readFile(new URL('./fixtures/late-journey-pressure-routes.json', import.meta.url)),
);

test('Apex pair changes exactly one keeper per mission and preserves prior candidates and progression', () => {
  assert.equal(candidateSource.missions.length, baselineSource.missions.length);
  assert.deepEqual(candidateSource.maps, baselineSource.maps);
  assert.deepEqual(candidateSource.assets, baselineSource.assets);
  assert.deepEqual(candidateSource.campaigns, baselineSource.campaigns);
  assert.deepEqual(candidateSource.packs, baselineSource.packs);

  for (let index = 0; index < candidateSource.missions.length; index++) {
    const before = baselineSource.missions[index];
    const after = candidateSource.missions[index];
    assert.equal(after.id, before.id);
    if (!target[after.id]) {
      assert.deepEqual(after, before, after.id);
      continue;
    }
    const expected = target[after.id];
    assert.equal(after.revision, 'apex-pressure-pair-1');
    assert.equal(after.actors.length, before.actors.length);
    assert.deepEqual(after.map, before.map);
    assert.deepEqual(after.objectives, before.objectives);
    assert.deepEqual(after.bonuses, before.bonuses);
    assert.equal(after.coverage, before.coverage);
    assert.deepEqual(after.presentation, before.presentation);
    assert.equal(before.actors.find((actor) => actor.id === expected.actorId).role, 'field-keeper');
    assert.equal(after.actors.find((actor) => actor.id === expected.actorId).role, expected.role);
    assert.deepEqual(
      after.actors.filter((actor) => actor.id !== expected.actorId),
      before.actors.filter((actor) => actor.id !== expected.actorId),
    );
    assert(after.design.practices.includes(expected.role));
    assert(after.design.combines.includes(expected.role));
  }
  for (const id of ['long-wave', 'returning-light'])
    assert.deepEqual(
      candidateSource.missions.find((mission) => mission.id === id),
      baselineSource.missions.find((mission) => mission.id === id),
    );
});

test('Apex dispositions document two approaches and immutable preservation boundaries', () => {
  assert.deepEqual(
    APEX_PRESSURE_PAIR_DISPOSITIONS.map((row) => row.missionId),
    Object.keys(target),
  );
  for (const row of APEX_PRESSURE_PAIR_DISPOSITIONS) {
    assert.equal(row.replacement.from, 'field-keeper');
    assert.equal(row.replacement.to, target[row.missionId].role);
    assert.equal(row.approaches.length, 2);
    assert.equal(new Set(row.approaches).size, 2);
    assert(row.preserves.includes('objectives-coverage-art-and-history'));
    assert.match(row.status, /human-balance-pending/);
  }
  assert.throws(() => APEX_PRESSURE_PAIR_DISPOSITIONS.push({}));
});

test('Apex roles retain field and resolve the shared finite cadence once in both modes', () => {
  for (const [id, expected] of Object.entries(target))
    for (const mode of ['solo', 'versus'])
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const before = resolveMission(baseline, id, { mode, difficulty });
        const current = resolveMission(project, id, { mode, difficulty });
        assert.notEqual(current.simulationIdentity, before.simulationIdentity);
        assert.equal(current.level.enemies.length, before.level.enemies.length);
        const pressure = current.level.classic.enemyPressure.actors;
        assert.equal(pressure.length, 1, `${id}/${mode}/${difficulty}`);
        assert.deepEqual(
          {
            id: pressure[0].id,
            warningTicks: pressure[0].warningTicks,
            commitTicks: pressure[0].commitTicks,
            cooldownTicks: pressure[0].cooldownTicks,
            mode: pressure[0].mode,
          },
          {
            id: expected.actorId,
            warningTicks: 90,
            commitTicks: 144,
            cooldownTicks: { gentle: 441, standard: 300, expert: 229 }[difficulty],
            mode: expected.role === 'trail-pursuer' ? 'trail-pursuit' : 'head-intercept',
          },
        );
        assert.equal(project.actors.roles[expected.role].retainsField, true);
      }
});

test('Apex commitments keep one target after the craft changes course', () => {
  for (const [id, expected] of Object.entries(target)) {
    const manifest = resolveMission(project, id, { difficulty: 'standard' });
    const run = createRun(manifest.level, { seed: 1 });
    const enemy = run.enemies.find((candidate) => candidate.id === expected.actorId);
    const pressure = enemy.classic.pressure;

    run.player.cutting = true;
    run.player.direction = 'right';
    run.player.speed = 0;
    run.player.x = enemy.x + 0.4;
    run.player.y = enemy.y;
    run.trail = [1];
    run.trailSegments = [{ x1: enemy.x + 0.35, y1: enemy.y, x2: enemy.x + 0.45, y2: enemy.y }];
    updateEnemyPressure(run);
    assert.equal(pressure.phase, 'warning');
    const locked = structuredClone(pressure.target);

    run.player.direction = 'left';
    run.player.x = enemy.x - 0.4;
    run.trailSegments = [{ x1: enemy.x - 0.45, y1: enemy.y, x2: enemy.x - 0.35, y2: enemy.y }];
    run.classic.actorTick = pressure.warningUntil;
    updateEnemyPressure(run);
    assert.equal(pressure.phase, 'committed');
    assert.deepEqual(pressure.target, locked);
    assert.equal(pressure.commitUntil - run.classic.actorTick, 144);
    assert.deepEqual(pressureWaypoint(enemy, 1, 1).target, locked);
  }
});

function routeInput({ id, difficulty, turnPolicy, source }) {
  if (source === 'late') {
    const row = lateRoutes.rows.find(
      (candidate) =>
        candidate.id === id &&
        candidate.difficulty === difficulty &&
        candidate.turnPolicy === turnPolicy,
    );
    return { seed: row.seed, segments: row.segments.map((part) => [part.direction, part.ticks]) };
  }
  const row = historicalAudit.rows.find(
    (candidate) =>
      candidate.missionId === id &&
      candidate.difficulty === difficulty &&
      candidate.turnPolicy === turnPolicy,
  );
  assert(row?.chosen, `${id}/${difficulty}/${turnPolicy} historical route`);
  return { seed: row.seed, segments: row.chosen.segments };
}

const routeCases = [
  {
    id: 'crossing-complete',
    difficulty: 'gentle',
    turnPolicy: 'immediate',
    source: 'historical',
    checkpoint: '770238d85d967f72',
    events: { 'pressure.warning': 1, 'pressure.committed': 1, 'pressure.cooldown': 1 },
  },
  {
    id: 'crossing-complete',
    difficulty: 'expert',
    turnPolicy: 'grid-center',
    source: 'late',
    checkpoint: '1f66ff895f40cf02',
    events: { 'pressure.warning': 2, 'pressure.committed': 2, 'pressure.cooldown': 2 },
  },
  {
    id: 'final-broadcast',
    difficulty: 'gentle',
    turnPolicy: 'immediate',
    source: 'historical',
    checkpoint: '09d4bd25eb3067ca',
    events: { 'pressure.warning': 1, 'pressure.committed': 1, 'pressure.cancelled': 1 },
  },
  {
    id: 'final-broadcast',
    difficulty: 'standard',
    turnPolicy: 'grid-center',
    source: 'late',
    checkpoint: '221378d3203c6865',
    events: {
      'pressure.warning': 4,
      'pressure.committed': 3,
      'pressure.cooldown': 1,
      'pressure.cancelled': 3,
    },
  },
];

for (const expected of routeCases)
  test(`Apex real-input no-loss clear and equal race: ${expected.id}/${expected.difficulty}/${expected.turnPolicy}`, () => {
    const input = routeInput(expected);
    const manifest = resolveMission(project, expected.id, { difficulty: expected.difficulty });
    const result = assessPressureRoute(manifest.level, {
      ...input,
      turnPolicy: expected.turnPolicy,
      replay: true,
    });
    assert.equal(result.status, 'no-loss-clear');
    assert.equal(result.checkpoint, expected.checkpoint);
    assert.deepEqual(result.collectedBonusIds, []);

    const options = { seed: input.seed, classId: 'scout', turnPolicy: expected.turnPolicy };
    const run = createRun(manifest.level, options);
    const events = {};
    play: for (const [direction, ticks] of input.segments)
      for (let tick = 0; tick < ticks; tick++) {
        if (run.status !== 'running') break play;
        stepRun(run, { direction }, FIXED_DT);
        for (const event of run.events.filter((item) => item.type.startsWith('pressure.')))
          events[event.type] = (events[event.type] ?? 0) + 1;
      }
    assert.equal(run.status, 'won');
    assert.equal(run.classic.livesLost, 0);
    assert.deepEqual(events, expected.events);
    assert.equal(authoritativeCheckpoint(run).hash, expected.checkpoint);

    const versus = resolveMission(project, expected.id, {
      difficulty: expected.difficulty,
      mode: 'versus',
    });
    const match = createDuel(versus.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    resumeDuel(match);
    race: for (const [direction, ticks] of input.segments)
      for (let tick = 0; tick < ticks; tick++) {
        if (match.status !== 'running') break race;
        stepDuel(match, [{ direction }, { direction }]);
      }
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(match.runs.every((entry) => entry.status === 'won' && entry.classic.livesLost === 0));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });
