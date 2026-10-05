import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import {
  createClassicSnake,
  classicSnakeUsesVariableHazards,
  classicSnakeSignalView,
  queueClassicSnakeTurn,
  stepClassicSnake,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  queueClassicSnakeMatchTurn,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import { classicVisualSnapshot } from '../snake/classic-recent-replay.mjs';
import { classicSnakeRatingForRecord } from '../snake/classic-ratings.mjs';
import { CLASSIC_SNAKE_RATING_CALIBRATIONS } from '../snake/classic-rating-calibrations.mjs';
import { createClassicSnakeRecords } from '../snake/classic-records.mjs';

const entry = (slug) => CLASSIC_SNAKE_V4_LEVELS.find((row) => row.id === `classic-field-${slug}`);
const make = (slug = 'signal-check', hazardSeed = 17, pace = 'normal') =>
  createClassicSnake(prepareClassicSnakeLevel(entry(slug), { pace }), { seed: 17, hazardSeed });
function circle(run, beforeStep) {
  const { x, y } = run.snakes[0].body[0];
  const direction =
    run.tick === 0
      ? 'up'
      : x === 22 && y === 1
        ? 'down'
        : x === 22 && y === 16
          ? 'left'
          : x === 1 && y === 16
            ? 'up'
            : y === 1 && run.snakes[0].direction === 'up'
              ? 'right'
              : run.snakes[0].direction;
  queueClassicSnakeTurn(run, 0, direction);
  beforeStep?.(direction);
  stepClassicSnake(run);
  assert.equal(run.status, 'running');
}

test('variable profiles require an explicit uint32 schedule seed; legacy recipes forbid it', () => {
  const level = entry('signal-check').level;
  assert.ok(classicSnakeUsesVariableHazards(level));
  for (const options of [{}, { hazardSeed: -1 }, { hazardSeed: 2 ** 32 }, { hazardSeed: 0.5 }])
    assert.throws(() => createClassicSnake(level, options), /hazard seed/);
  for (const hazardSeed of [0, 17, 0xffffffff])
    assert.equal(createClassicSnake(level, { hazardSeed }).hazardSeed, hazardSeed);
  const legacy = structuredClone(level);
  legacy.targets.required.forEach((policy) => delete policy.signalProfile);
  assert.equal(classicSnakeUsesVariableHazards(legacy), false);
  assert.throws(() => createClassicSnake(legacy, { hazardSeed: 17 }), /hazard seed/);
  const invalid = structuredClone(level);
  invalid.targets.required[0].signalProfile = 'unknown';
  assert.throws(() => createClassicSnake(invalid, { hazardSeed: 17 }), /interference profile/);
});

test('fresh timing seeds vary radio schedules without changing actor or spawn randomness', () => {
  const a = make('quiet-return', 1),
    b = make('quiet-return', 2),
    again = make('quiet-return', 1);
  const phasesA = [],
    phasesB = [];
  for (let i = 0; i < 180; i++) {
    circle(a);
    circle(b);
    circle(again);
    assert.deepEqual(a, again);
    assert.equal(a.random, b.random);
    assert.deepEqual(a.snakes, b.snakes);
    assert.deepEqual(
      a.targets.map(({ id, x, y, random }) => ({ id, x, y, random })),
      b.targets.map(({ id, x, y, random }) => ({ id, x, y, random })),
    );
    phasesA.push(
      a.targets.filter((target) => target.kind === 'jammer').map((target) => target.phase),
    );
    phasesB.push(
      b.targets.filter((target) => target.kind === 'jammer').map((target) => target.phase),
    );
  }
  assert.notDeepEqual(phasesA, phasesB);
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(a)), a);
});

test('all paces bound warning and burst duration, enforce clear intervals and allow one transmitter', () => {
  for (const pace of ['slow', 'normal', 'fast'])
    for (const seed of [0, 17, 0xffffffff]) {
      const run = make('quiet-channel', seed, pace),
        previous = new Map();
      let lastBurstEnd = -Infinity,
        bursts = 0;
      for (let i = 0; i < 700; i++) {
        circle(run);
        const sources = classicSnakeSignalView(run).sources;
        assert.ok(sources.filter((source) => source.phase === 'jamming').length <= 1);
        for (const source of sources) {
          const before = previous.get(source.id);
          if (source.phase !== before?.phase) {
            if (source.phase === 'jamming') {
              assert.equal(before.phase, 'warning');
              assert.ok(run.elapsedMs - before.started >= 800);
              assert.ok(run.elapsedMs - lastBurstEnd >= 1600);
              bursts++;
            }
            if (before?.phase === 'jamming') {
              assert.ok(run.elapsedMs - before.started >= 600);
              assert.ok(run.elapsedMs - before.started <= 1400);
              lastBurstEnd = run.elapsedMs;
              assert.ok(source.remainingMs >= 2000 && source.remainingMs <= 4400);
            }
            previous.set(source.id, { phase: source.phase, started: run.elapsedMs });
          }
        }
      }
      assert.ok(bursts > 8);
      assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
    }
});

test('community catch speedups cannot stretch a maximum burst or recovery past its bound', () => {
  const level = structuredClone(entry('quiet-channel').level);
  level.walls = [];
  level.speedupEvery = 1;
  level.minStepMs = 60;
  const patrol = {
    kind: 'patroller',
    every: 4,
    path: [
      { x: 3, y: 10 },
      { x: 4, y: 10 },
      { x: 4, y: 11 },
      { x: 3, y: 11 },
    ],
  };
  level.targets.required = [level.targets.required[0], patrol, structuredClone(patrol)];
  const findPhase = (phase, duration) => {
    for (let hazardSeed = 0; hazardSeed < 128; hazardSeed++) {
      const run = createClassicSnake(level, { hazardSeed });
      if (phase === 'jamming') {
        for (let tick = 0; tick < 100 && run.targets[0].phase !== phase; tick++) circle(run);
      }
      const source = run.targets.find((target) => target.kind === 'jammer');
      if (source.phase === phase && source.signalUntilMs - run.elapsedMs === duration) return run;
    }
    assert.fail('The bounded schedule sample must include its upper limit.');
  };
  for (const [phase, maximum, expected] of [
    ['jamming', 1400, 1340],
    ['rest', 4400, 4380],
  ]) {
    const run = findPhase(phase, maximum);
    const source = run.targets.find((target) => target.kind === 'jammer');
    const started = run.elapsedMs;
    // Exercise an actual accepted catch transaction: it changes only future
    // movement intervals from 200ms to 190ms while the source keeps transmitting.
    circle(run, (direction) => {
      const prey = run.targets.find((target) => target.kind !== 'jammer');
      const head = run.snakes[0].body[0];
      const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
      prey.x = head.x + dx;
      prey.y = head.y + dy;
    });
    assert.equal(run.catches, 1);
    while (source.phase === phase && run.elapsedMs - started < 5000) circle(run);
    assert.notEqual(source.phase, phase);
    assert.equal(run.elapsedMs - started, expected);
    assert.ok(run.elapsedMs - started <= maximum);
  }
});

test('variable bursts cannot overlap lethal lanes and restore the full lane warning', () => {
  const run = make('signal-crossing', 73, 'fast');
  let bursts = 0,
    laneAttacks = 0;
  for (let tick = 0; tick < 700; tick++) {
    const before = classicSnakeSignalView(run).active;
    circle(run);
    const active = classicSnakeSignalView(run).active;
    const lane = run.targets.find((target) => target.kind === 'lane');
    if (active) bursts++;
    if (lane.phase === 'active') laneAttacks++;
    assert.ok(!(active && lane.phase === 'active'));
    if ((before || active) && lane.phase === 'warning')
      assert.ok(lane.phaseTicks * run.level.minStepMs >= 800);
  }
  assert.ok(bursts > 0 && laneAttacks > 0);
});

test('source capture and Pulse immediately clear reception; compact replay retains the saved signal', () => {
  const run = make();
  while (!classicSnakeSignalView(run).active) circle(run);
  const snapshot = classicVisualSnapshot(run),
    view = classicSnakeSignalView(run);
  assert.equal(view.sources[0].radius, 6);
  assert.deepEqual(classicSnakeSignalView(snapshot), view);
  assert.equal(snapshot.hazardSeed, 17);
  assert.equal(snapshot.history, undefined);
  run.pulseTicks = 3;
  assert.equal(classicSnakeSignalView(run).active, false);
  const remaining = view.sources[0].remainingMs;
  circle(run);
  assert.equal(classicSnakeSignalView(run).sources[0].remainingMs, remaining);
  run.pulseTicks = 0;
  const head = run.snakes[0].body[0],
    delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[run.snakes[0].direction];
  run.targets[0].x = head.x + delta[0];
  run.targets[0].y = head.y + delta[1];
  stepClassicSnake(run);
  assert.equal(classicSnakeSignalView(run).active, false);
  assert.equal(run.events.filter((event) => event.type === 'target.caught').length, 1);
  assert.ok(run.signalClearUntilMs >= run.elapsedMs + 1600);
  run.status = 'won';
  assert.equal(classicSnakeSignalView(run).warning, false);
});

test('Continue and matched Versus preserve the accepted seed and reject forged schedules', () => {
  for (const mode of ['solo', 'team', 'versus']) {
    const match = createClassicSnakeMatch(entry('signal-check').level, {
      mode,
      seed: 17,
      hazardSeed: 0xffffffff,
    });
    advanceClassicSnakeMatchTo(match, 1400);
    assert.ok(match.runs.every((run) => run.hazardSeed === 0xffffffff));
    const saved = exportClassicSnakeMatch(match);
    assert.deepEqual(restoreClassicSnakeMatch(saved), match);
    const forged = structuredClone(saved);
    forged.options.hazardSeed = 2;
    assert.throws(() => restoreClassicSnakeMatch(forged), /accepted match recipe/);
    const altered = structuredClone(saved.replays[0]);
    altered.hazardSeed = 2;
    assert.throws(() => restoreClassicSnakeReplay(altered), /exact verification/);
  }
});

test('retained unprofiled v4 proof restores with its original checkpoint and bytes', async () => {
  const old = JSON.parse(
    await readFile(
      new URL('./fixtures/classic-snake-legacy-jammer-proof.json', import.meta.url),
      'utf8',
    ),
  );
  const run = restoreClassicSnakeReplay(old);
  assert.equal(run.status, 'won');
  assert.equal(Object.hasOwn(run, 'hazardSeed'), false);
  assert.deepEqual(exportClassicSnakeReplay(run), old);
});

test('variable schedule completions retain verified records but never imply seeded silver or gold', async (t) => {
  const sample = CLASSIC_SNAKE_RATING_CALIBRATIONS[0];
  const grade = classicSnakeRatingForRecord({
    key: sample.key,
    policy: 'mission',
    clear: true,
    fewestMoves: 1,
    completionOnly: true,
  });
  assert.equal(grade.stars, 1);
  assert.equal(grade.calibrated, false);
  const source = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v4-proofs.json', import.meta.url), 'utf8'),
  );
  const proof = source.proofs.find(
    (row) =>
      row.levelId === 'classic-field-signal-check' && row.mode === 'solo' && row.pace === 'normal',
  ).replay;
  const match = createClassicSnakeMatch(proof.level, {
    mode: proof.mode,
    seed: proof.seed,
    hazardSeed: proof.hazardSeed,
  });
  let cursor = 0;
  for (let tick = 0; tick < proof.steps; tick++) {
    while (proof.turns[cursor]?.tick === tick) {
      const turn = proof.turns[cursor++];
      assert.ok(queueClassicSnakeMatchTurn(match, turn.playerId, turn.direction));
    }
    advanceClassicSnakeMatchTo(match, (tick + 1) * proof.level.stepMs);
  }
  assert.equal(match.status, 'finished');
  assert.equal(match.result, 'won');
  const records = createClassicSnakeRecords({ indexedDB: null });
  t.after(() => records.close());
  await records.remember(match.runs[0], {
    mode: 'solo',
    chapterId: entry('signal-check').chapterId,
    level: proof.level,
    match: exportClassicSnakeMatch(match),
  });
  assert.equal(records.get(match.runs[0], 'solo').rating.stars, 1);
  assert.equal(records.get(match.runs[0], 'solo').variableHazards, true);
  assert.equal(records.ratingEvidence()[0].completionOnly, true);
});
