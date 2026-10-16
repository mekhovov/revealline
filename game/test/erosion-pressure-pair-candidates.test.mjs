import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  EROSION_PRESSURE_PAIR_DISPOSITIONS,
  createErosionPressurePairCandidates,
} from '../content-design/erosion-pressure-pair-candidates.mjs';
import { createApexPressurePairCandidates } from '../content-design/apex-pressure-pair-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { pressureWaypoint, updateEnemyPressure } from '../core/enemy-pressure.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';

const baselineSource = createApexPressurePairCandidates({ artwork: true });
const candidateSource = createErosionPressurePairCandidates({ artwork: true });
const baseline = compileContentProject(baselineSource);
const project = compileContentProject(candidateSource);
const target = Object.freeze({
  'cooling-loop': { actorId: 'keeper', role: 'heading-interceptor' },
  'crosswind-remix': { actorId: 'keeper', role: 'trail-pursuer' },
});
const livewireRoutes = JSON.parse(
  await readFile(new URL('./fixtures/livewire-pressure-clear-routes.json', import.meta.url)),
);
const lateRoutes = JSON.parse(
  await readFile(new URL('./fixtures/late-journey-pressure-routes.json', import.meta.url)),
);
const generatedRoutes = Object.freeze({
  'crosswind-remix/gentle/grid-center': [
    ['down', 332],
    ['left', 48],
    ['down', 48],
    ['left', 24],
    ['up', 402],
    ['down', 18],
    ['up', 12],
    ['right', 72],
    ['down', 144],
    ['right', 426],
    ['left', 174],
    ['down', 270],
    [null, 240],
    ['up', 18],
    ['down', 12],
    ['left', 36],
    ['up', 270],
  ],
});

test('erosion-pressure pair changes one keeper per mission and preserves the stacked source', () => {
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
    assert.equal(after.revision, 'erosion-pressure-pair-1');
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
    assert(after.design.combines.includes('territory-eroder'));
  }
  for (const id of ['long-wave', 'returning-light', 'crossing-complete', 'final-broadcast'])
    assert.deepEqual(
      candidateSource.missions.find((mission) => mission.id === id),
      baselineSource.missions.find((mission) => mission.id === id),
    );
});

test('erosion-pressure dispositions document two routes and immutable preservation boundaries', () => {
  assert.deepEqual(
    EROSION_PRESSURE_PAIR_DISPOSITIONS.map((row) => row.missionId),
    Object.keys(target),
  );
  for (const row of EROSION_PRESSURE_PAIR_DISPOSITIONS) {
    assert.equal(row.replacement.from, 'field-keeper');
    assert.equal(row.replacement.to, target[row.missionId].role);
    assert.equal(row.approaches.length, 2);
    assert.equal(new Set(row.approaches).size, 2);
    assert(row.preserves.includes('erosion-foundation-and-relay-rules'));
    assert.match(row.status, /human-balance-pending/);
  }
  assert.throws(() => EROSION_PRESSURE_PAIR_DISPOSITIONS.push({}));
});

test('replacement actors retain field and resolve the shared finite cadence once', () => {
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

test('erosion-pressure commitments keep one target after the craft changes course', () => {
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

function routeInput(id, difficulty, turnPolicy) {
  const generated = generatedRoutes[`${id}/${difficulty}/${turnPolicy}`];
  if (generated) return { seed: 1, segments: generated };
  const fixture = id === 'cooling-loop' ? livewireRoutes : lateRoutes;
  const row = fixture.rows.find(
    (candidate) =>
      candidate.id === id &&
      candidate.difficulty === difficulty &&
      candidate.turnPolicy === turnPolicy,
  );
  assert(row, `${id}/${difficulty}/${turnPolicy} route`);
  return {
    seed: row.seed ?? 1,
    segments: row.segments.map((part) =>
      Array.isArray(part) ? part : [part.direction, part.ticks],
    ),
  };
}

const routeCases = [
  {
    id: 'cooling-loop',
    difficulty: 'expert',
    turnPolicy: 'immediate',
    checkpoint: '9da7c8ccce805c56',
    events: { warning: 3, committed: 2, cooldown: 1, cancelled: 2, eroded: 3 },
  },
  {
    id: 'cooling-loop',
    difficulty: 'expert',
    turnPolicy: 'grid-center',
    checkpoint: '1f2c71ca4db3b48a',
    events: { warning: 3, committed: 2, cooldown: 1, cancelled: 2, eroded: 2 },
  },
  {
    id: 'crosswind-remix',
    difficulty: 'gentle',
    turnPolicy: 'grid-center',
    checkpoint: '5c61609f02e59fdb',
    events: { warning: 3, committed: 3, cooldown: 0, cancelled: 3, eroded: 4 },
  },
  {
    id: 'crosswind-remix',
    difficulty: 'standard',
    turnPolicy: 'immediate',
    checkpoint: '071ce3155c9e65d9',
    events: { warning: 3, committed: 3, cooldown: 1, cancelled: 2, eroded: 5 },
  },
];

for (const expected of routeCases)
  test(`erosion-pressure clear and equal race: ${expected.id}/${expected.difficulty}/${expected.turnPolicy}`, () => {
    const input = routeInput(expected.id, expected.difficulty, expected.turnPolicy);
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
    const events = { warning: 0, committed: 0, cooldown: 0, cancelled: 0, eroded: 0 };
    play: for (const [direction, ticks] of input.segments)
      for (let tick = 0; tick < ticks; tick++) {
        if (run.status !== 'running') break play;
        stepRun(run, { direction }, FIXED_DT);
        for (const event of run.events) {
          if (event.type === 'pressure.warning') events.warning++;
          else if (event.type === 'pressure.committed') events.committed++;
          else if (event.type === 'pressure.cooldown') events.cooldown++;
          else if (event.type === 'pressure.cancelled') events.cancelled++;
          else if (event.type === 'cells.eroded') events.eroded++;
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
