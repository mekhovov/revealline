import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  REMIX_PRESSURE_PAIR_DISPOSITIONS,
  createRemixPressurePairCandidates,
} from '../content-design/remix-pressure-pair-candidates.mjs';
import { createErosionPressurePairCandidates } from '../content-design/erosion-pressure-pair-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { pressureWaypoint, updateEnemyPressure } from '../core/enemy-pressure.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const baselineSource = createErosionPressurePairCandidates({ artwork: true });
const candidateSource = createRemixPressurePairCandidates({ artwork: true });
const baseline = compileContentProject(baselineSource);
const project = compileContentProject(candidateSource);
const target = Object.freeze({
  'phase-remix': { actorId: 'east-carrier', role: 'heading-interceptor' },
  'livewire-remix': { actorId: 'carrier', role: 'trail-pursuer' },
});
const historicalRoutes = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const middleRoutes = JSON.parse(
  await readFile(new URL('./fixtures/middle-pressure-routes.json', import.meta.url)),
);
const livewireRoutes = JSON.parse(
  await readFile(new URL('./fixtures/livewire-pressure-clear-routes.json', import.meta.url)),
);

test('Remix pair replaces one keeper per mission and preserves the preceding source', () => {
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
    assert.equal(after.revision, 'remix-pressure-pair-1');
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
    assert(after.design.combines.includes('reclaimed-roamer'));
  }
  for (const id of [
    'long-wave',
    'returning-light',
    'crossing-complete',
    'final-broadcast',
    'cooling-loop',
    'crosswind-remix',
  ])
    assert.deepEqual(
      candidateSource.missions.find((mission) => mission.id === id),
      baselineSource.missions.find((mission) => mission.id === id),
    );
});

test('Remix dispositions retain two distinct approaches and immutable boundaries', () => {
  assert.deepEqual(
    REMIX_PRESSURE_PAIR_DISPOSITIONS.map((row) => row.missionId),
    Object.keys(target),
  );
  for (const row of REMIX_PRESSURE_PAIR_DISPOSITIONS) {
    assert.equal(row.replacement.from, 'field-keeper');
    assert.equal(row.replacement.to, target[row.missionId].role);
    assert.equal(row.approaches.length, 2);
    assert.equal(new Set(row.approaches).size, 2);
    assert(row.preserves.includes('terrain-lane-frontier-and-roamer-rules'));
    assert.match(row.status, /human-balance-pending/);
  }
  assert.throws(() => REMIX_PRESSURE_PAIR_DISPOSITIONS.push({}));
});

test('Remix pressure retains field and resolves the shared finite cadence once', () => {
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

test('Remix pressure commitments do not retarget after a course change', () => {
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
  const fixture =
    source === 'historical'
      ? historicalRoutes
      : source === 'middle'
        ? middleRoutes
        : livewireRoutes;
  const row = fixture.rows.find(
    (candidate) =>
      (candidate.id ?? candidate.missionId) === id &&
      candidate.difficulty === difficulty &&
      candidate.turnPolicy === turnPolicy,
  );
  assert(row, `${id}/${difficulty}/${turnPolicy} route`);
  const segments = row.segments ?? row.chosen?.segments;
  assert(segments, `${id}/${difficulty}/${turnPolicy} chosen route`);
  return {
    seed: row.seed ?? 1,
    segments: segments.map((part) => (Array.isArray(part) ? part : [part.direction, part.ticks])),
  };
}

const routeCases = [
  {
    id: 'phase-remix',
    difficulty: 'gentle',
    turnPolicy: 'immediate',
    source: 'historical',
    approach: 'short-fallback-closures',
    checkpoint: 'dd3afa220c2f3055',
    events: { warning: 1, committed: 1, cooldown: 0, cancelled: 1 },
  },
  {
    id: 'phase-remix',
    difficulty: 'expert',
    turnPolicy: 'grid-center',
    source: 'middle',
    approach: 'wait-then-connect-circuit',
    checkpoint: 'a946c6e114d8cf51',
    events: { warning: 1, committed: 1, cooldown: 0, cancelled: 1 },
  },
  {
    id: 'livewire-remix',
    difficulty: 'standard',
    turnPolicy: 'immediate',
    source: 'livewire',
    approach: 'short-refuge-then-long-crossing',
    checkpoint: '89be945b27e7ed95',
    events: { warning: 5, committed: 5, cooldown: 2, cancelled: 3 },
  },
  {
    id: 'livewire-remix',
    difficulty: 'standard',
    turnPolicy: 'grid-center',
    source: 'livewire',
    approach: 'wait-and-draw-wide-route',
    checkpoint: '16fc7f4533380d44',
    events: { warning: 4, committed: 4, cooldown: 2, cancelled: 2 },
  },
];

test('each Remix mission has two different fixed legal-input route proofs', () => {
  for (const id of Object.keys(target)) {
    const rows = routeCases.filter((row) => row.id === id);
    assert.equal(rows.length, 2);
    assert.equal(new Set(rows.map((row) => row.approach)).size, 2);
    assert.equal(new Set(rows.map((row) => JSON.stringify(routeInput(row).segments))).size, 2);
  }
});

for (const expected of routeCases)
  test(`Remix pressure clear and equal race: ${expected.id}/${expected.difficulty}/${expected.turnPolicy}`, () => {
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
    const events = { warning: 0, committed: 0, cooldown: 0, cancelled: 0 };
    play: for (const [direction, ticks] of input.segments)
      for (let tick = 0; tick < ticks; tick++) {
        if (run.status !== 'running') break play;
        stepRun(run, { direction }, FIXED_DT);
        for (const event of run.events) {
          if (event.type === 'pressure.warning') events.warning++;
          else if (event.type === 'pressure.committed') events.committed++;
          else if (event.type === 'pressure.cooldown') events.cooldown++;
          else if (event.type === 'pressure.cancelled') events.cancelled++;
        }
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
