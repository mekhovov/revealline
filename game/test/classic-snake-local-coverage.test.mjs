import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createClassicSnakeV4,
  stepClassicSnakeV4,
  queueClassicSnakeTurnV4,
  classicSnakeSignalCoverage,
  classicSnakeSignalView,
  exportClassicSnakeReplayV4,
  restoreClassicSnakeReplayV4,
} from '../snake/classic-core-v4.mjs';

function make({
  profile = 'local-burst-v2',
  stepMs = 200,
  mode = 'solo',
  hazardSeed = 17,
  extra,
  ...changes
} = {}) {
  const level = {
    version: 'classic-snake-level.v4',
    id: 'local-coverage-check',
    revision: '1',
    name: 'Local coverage check',
    width: 24,
    height: 18,
    walls: [],
    spawns: [
      { x: 5, y: 2, direction: 'right' },
      { x: 18, y: 15, direction: 'left' },
    ],
    goal: 4,
    stepMs,
    minStepMs: stepMs,
    speedupEvery: 0,
    wrap: false,
    targetMovement: 'still',
    fleeEvery: 3,
    objective: 'mission',
    targets: {
      maxActive: extra ? 2 : 1,
      required: [
        { kind: 'jammer', every: 3, at: { x: 12, y: 9 }, signalProfile: profile },
        ...(extra ? [extra] : []),
      ],
      bonus: null,
    },
    shutters: [],
    pickups: [],
    ...changes,
  };
  return createClassicSnakeV4(level, { mode, seed: 17, hazardSeed });
}
const source = (run) => run.targets.find((target) => target.kind === 'jammer');
function step(run, direction = run.snakes[0].direction, partner) {
  for (const [seat, turn] of [direction, partner].entries())
    if (turn && turn !== run.snakes[seat].direction)
      assert.ok(queueClassicSnakeTurnV4(run, seat, turn), `${seat}: ${turn} at ${run.tick}`);
  stepClassicSnakeV4(run);
  assert.equal(run.status, 'running', JSON.stringify(run.failure));
}
function walk(run, direction, count = 1) {
  for (let n = 0; n < count; n++) step(run, direction);
}
function outsideTurn(snake) {
  const { x, y } = snake.body[0];
  if (x === 17 && y === 2) return 'up';
  if (x === 17 && y === 1) return 'left';
  if (x === 5 && y === 1) return 'down';
  if (x === 5 && y === 2) return 'right';
  return snake.direction;
}
function waitOutside(run) {
  // Two complete legal laps out of range, including the full initial recovery.
  for (let n = 0; n < 52; n++) {
    step(run, outsideTurn(run.snakes[0]));
    assert.equal(source(run).phase, 'rest');
    assert.equal(classicSnakeSignalView(run).warning, false);
    assert.equal(classicSnakeSignalView(run).active, false);
  }
  assert.deepEqual(run.snakes[0].body[0], { x: 5, y: 2 });
}
function enter(run) {
  walk(run, 'right', 7);
  walk(run, 'down');
  assert.deepEqual(run.snakes[0].body[0], { x: 12, y: 3 });
  assert.equal(source(run).phase, 'warning');
  assert.equal(source(run).signalUntilMs - run.elapsedMs, 800);
}
function insideTurn(snake) {
  const { x, y } = snake.body[0];
  if (x === 14 && y === 5) return 'left';
  if (x === 10 && y === 5) return 'down';
  if (x === 10 && y === 11) return 'right';
  if (x === 14 && y === 11) return 'up';
  return snake.direction;
}
function enterInnerLoop(run) {
  enter(run);
  walk(run, 'down', 4);
  walk(run, 'left', 2);
  walk(run, 'down', 4);
}

test('local v2 stays idle outside coverage and authored/community paces give a whole entry warning', () => {
  for (const stepMs of [80, 120, 150, 200, 260, 280, 300]) {
    const run = make({ stepMs });
    waitOutside(run);
    enter(run);
    const started = run.elapsedMs;
    for (const direction of [
      'down',
      'down',
      'down',
      'down',
      'left',
      'left',
      'down',
      'down',
      'down',
      'down',
    ]) {
      if (source(run).phase !== 'warning') break;
      step(run, direction);
    }
    assert.equal(source(run).phase, 'jamming');
    assert.ok(run.elapsedMs - started >= 800);
    assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
  }
});

test('warning exit clears at the accepted boundary even with cable inside; re-entry starts from 800ms', () => {
  const run = make();
  waitOutside(run);
  enter(run);
  const firstWarning = source(run).signalStartedMs;
  walk(run, 'right'); // (13,3) is outside, while the previous head remains inside.
  assert.deepEqual(run.snakes[0].body[1], { x: 12, y: 3 });
  assert.equal(classicSnakeSignalCoverage(run, source(run)), false);
  assert.equal(source(run).phase, 'rest');
  assert.equal(classicSnakeSignalView(run).warning, false);
  walk(run, 'down'); // (13,4) re-enters without reversing into the body.
  assert.equal(source(run).phase, 'warning');
  assert.ok(source(run).signalStartedMs > firstWarning);
  assert.equal(source(run).signalUntilMs - run.elapsedMs, 800);
  assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
});

function exitBurst(run) {
  waitOutside(run);
  walk(run, 'right', 12);
  walk(run, 'down', 4); // (17,6) enters the circle.
  assert.equal(source(run).phase, 'warning');
  for (const direction of ['left', 'up', 'left', 'up']) step(run, direction);
  assert.equal(source(run).phase, 'jamming'); // (15,4), one move from clear ground.
  const started = run.elapsedMs;
  walk(run, 'up'); // (15,3), with trailing cable still in coverage.
  assert.equal(run.elapsedMs - started, 200);
  assert.equal(source(run).phase, 'rest');
  assert.equal(run.signal.jammed, false);
  assert.equal(classicSnakeSignalView(run).active, false);
}

test('a cancelled burst gets random recovery and a clear interval before a fresh re-entry warning', () => {
  const run = make();
  exitBurst(run);
  const ended = run.elapsedMs,
    recovery = source(run).signalUntilMs - ended;
  assert.ok(recovery >= 2000 && recovery <= 4400);
  assert.ok(run.signalClearUntilMs >= ended + 1600);
  walk(run, 'left');
  walk(run, 'down'); // Re-entry during recovery cannot resurrect the cancelled burst.
  assert.equal(classicSnakeSignalCoverage(run, source(run)), true);
  assert.equal(source(run).phase, 'rest');
  let warningAt = null;
  for (let n = 0; n < 50 && source(run).phase !== 'jamming'; n++) {
    step(run, insideTurn(run.snakes[0]));
    if (source(run).phase === 'warning' && warningAt === null) warningAt = run.elapsedMs;
  }
  assert.equal(source(run).phase, 'jamming');
  assert.ok(warningAt >= ended + recovery);
  assert.ok(run.elapsedMs - warningAt >= 800);
  assert.ok(run.elapsedMs - ended >= 1600);
  assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
});

test('Pulse freezes phase clocks but an accepted exit still cancels warning and burst', () => {
  for (const phase of ['warning', 'jamming']) {
    const run = make();
    waitOutside(run);
    walk(run, 'right', 12);
    walk(run, 'down', 4);
    for (const direction of ['left', 'up', 'left', 'up']) {
      if (phase === 'warning' && direction === 'up' && run.snakes[0].body[0].x === 15) break;
      step(run, direction);
    }
    assert.equal(source(run).phase, phase);
    const remaining = source(run).signalUntilMs - run.elapsedMs;
    // Isolate the already-accepted Pulse condition; all subsequent head moves
    // use ordinary queued turns, including exit and re-entry during the freeze.
    run.pulseTicks = 8;
    walk(run, 'up');
    if (phase === 'warning') {
      assert.equal(source(run).signalUntilMs - run.elapsedMs, remaining);
      walk(run, 'up');
    }
    assert.equal(classicSnakeSignalCoverage(run, source(run)), false);
    assert.equal(source(run).phase, 'rest');
    assert.equal(run.signal.jammed, false);
    assert.equal(classicSnakeSignalView(run).active, false);
    const recovery = source(run).signalUntilMs - run.elapsedMs;
    walk(run, 'left');
    walk(run, 'down');
    assert.equal(classicSnakeSignalCoverage(run, source(run)), true);
    assert.equal(source(run).signalUntilMs - run.elapsedMs, recovery);
    assert.equal(classicSnakeSignalView(run).warning, false);
  }
});

test('coverage is Euclidean and wrapped, counts either living Team head, and never counts the body', () => {
  const run = make({ mode: 'team' }),
    radio = source(run);
  run.snakes[0].body = [
    { x: 18, y: 10 },
    { x: 12, y: 9 },
  ];
  run.snakes[1].body = [{ x: 12, y: 15 }];
  assert.equal(classicSnakeSignalCoverage(run, radio), true, 'partner is exactly six cells away');
  run.snakes[1].alive = false;
  assert.equal(classicSnakeSignalCoverage(run, radio), false, 'diagonal is beyond the circle');
  run.level = { ...run.level, wrap: true };
  radio.x = 0;
  radio.y = 0;
  run.snakes[0].body[0] = { x: 23, y: 17 };
  assert.equal(classicSnakeSignalCoverage(run, radio), true, 'both axes wrap');
});

test('accepted movement into wrapped coverage starts its warning before crossing the board seam', () => {
  const run = make({
    wrap: true,
    targets: {
      maxActive: 1,
      required: [{ kind: 'jammer', every: 3, at: { x: 0, y: 9 }, signalProfile: 'local-burst-v2' }],
      bonus: null,
    },
  });
  waitOutside(run);
  walk(run, 'right', 18);
  walk(run, 'down', 2);
  assert.deepEqual(run.snakes[0].body[0], { x: 23, y: 4 });
  assert.equal(source(run).phase, 'warning');
  assert.equal(source(run).signalUntilMs - run.elapsedMs, 800);
  assert.equal(classicSnakeSignalView(run).sources[0].exposed, true);
  walk(run, 'right');
  assert.deepEqual(run.snakes[0].body[0], { x: 0, y: 4 });
  assert.equal(source(run).signalUntilMs - run.elapsedMs, 600);
  assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
});

test('catching an exposed source clears reception and preserves its shared clear interval', () => {
  const run = make();
  waitOutside(run);
  enter(run);
  walk(run, 'down', 4);
  assert.equal(source(run).phase, 'jamming');
  walk(run, 'down', 2);
  assert.equal(run.catches, 1);
  assert.equal(run.events.filter((event) => event.type === 'target.caught').length, 1);
  assert.equal(classicSnakeSignalView(run).active, false);
  assert.ok(run.signalClearUntilMs >= run.elapsedMs + 1600);
  assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
});

test('Pulse keeps an exposed source deadline frozen through accepted movement inside coverage', () => {
  const run = make();
  waitOutside(run);
  enterInnerLoop(run);
  for (let n = 0; n < 80 && source(run).phase !== 'jamming'; n++)
    step(run, insideTurn(run.snakes[0]));
  assert.equal(source(run).phase, 'jamming');
  const remaining = source(run).signalUntilMs - run.elapsedMs;
  run.pulseTicks = 4;
  for (let n = 0; n < 4; n++) {
    step(run, insideTurn(run.snakes[0]));
    assert.equal(source(run).phase, 'jamming');
    assert.equal(source(run).signalUntilMs - run.elapsedMs, remaining);
    assert.equal(classicSnakeSignalCoverage(run, source(run)), true);
  }
  step(run, insideTurn(run.snakes[0]));
  assert.equal(source(run).signalUntilMs - run.elapsedMs, remaining - run.level.stepMs);
});

test('a covered Team partner drives the shared schedule while the other head stays outside', () => {
  const run = make({
    mode: 'team',
    spawns: [
      { x: 5, y: 2, direction: 'right' },
      { x: 14, y: 13, direction: 'left' },
    ],
  });
  let bursts = 0;
  for (let n = 0; n < 90; n++) {
    const partner = run.snakes[1],
      { x, y } = partner.body[0];
    const direction =
      x === 10 && y === 13
        ? 'up'
        : x === 10 && y === 11
          ? 'right'
          : x === 14 && y === 11
            ? 'down'
            : x === 14 && y === 13
              ? 'left'
              : partner.direction;
    step(run, outsideTurn(run.snakes[0]), direction);
    assert.ok(run.snakes[0].body[0].y <= 2);
    if (classicSnakeSignalView(run).active) bursts++;
  }
  assert.ok(bursts > 0);
  assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
});

test('local coverage preserves lane and projectile coordination across repeated accepted bursts', () => {
  for (const extra of [
    { kind: 'lane', every: 3, at: { x: 5, y: 14 }, lane: { axis: 'x', from: 5, to: 18 } },
    { kind: 'guard', every: 3, at: { x: 18, y: 13 }, heading: 'right' },
  ]) {
    const run = make({ extra });
    waitOutside(run);
    enterInnerLoop(run);
    let bursts = 0,
      attacks = 0;
    for (let n = 0; n < 500; n++) {
      const before = run.signal.jammed;
      step(run, insideTurn(run.snakes[0]));
      const other = run.targets.find((target) => target.kind === extra.kind);
      if (run.signal.jammed) bursts++;
      if (other.phase === 'active' || run.projectiles.length) attacks++;
      assert.ok(!(run.signal.jammed && (other.phase === 'active' || run.projectiles.length)));
      if ((before || run.signal.jammed) && other.phase === 'warning')
        assert.ok(other.phaseTicks * run.level.minStepMs >= 800);
    }
    assert.ok(bursts > 0 && attacks > 0);
    assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
  }
});

function crossingTurn(snake) {
  const { x, y } = snake.body[0];
  if (x === 7 && y === 5) return 'right';
  if (x === 17 && y === 5) return 'down';
  if (x === 17 && y === 13) return 'left';
  if (x === 7 && y === 13) return 'up';
  return snake.direction;
}
function enterCrossingLoop(run) {
  walk(run, 'right', 2);
  walk(run, 'down', 3);
}
test('leaving an active local burst preserves a pending lane warning in full', () => {
  const run = make({
    extra: { kind: 'lane', every: 3, at: { x: 5, y: 14 }, lane: { axis: 'x', from: 5, to: 18 } },
  });
  enterCrossingLoop(run);
  let cancellations = 0;
  for (let n = 0; n < 800; n++) {
    const jammed = run.signal.jammed,
      previousRemaining = source(run).signalUntilMs - run.elapsedMs;
    step(run, crossingTurn(run.snakes[0]));
    const lane = run.targets.find((target) => target.kind === 'lane');
    if (jammed && !classicSnakeSignalCoverage(run, source(run)) && previousRemaining > 200) {
      cancellations++;
      assert.equal(run.signal.jammed, false);
      assert.notEqual(lane.phase, 'active');
      if (lane.phase === 'warning') assert.ok(lane.phaseTicks * run.level.minStepMs >= 800);
    }
  }
  assert.ok(cancellations > 0);
  assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
});

test('two local sources retain a shared clear interval when heads repeatedly leave and enter range', () => {
  for (const hazardSeed of [0, 17, 0xffffffff]) {
    const run = make({
      hazardSeed,
      extra: { kind: 'jammer', every: 3, at: { x: 20, y: 9 }, signalProfile: 'local-burst-v2' },
    });
    enterCrossingLoop(run);
    let previous = null,
      ended = -Infinity,
      bursts = 0;
    for (let n = 0; n < 800; n++) {
      step(run, crossingTurn(run.snakes[0]));
      const active = run.targets.filter((target) => target.phase === 'jamming');
      assert.ok(active.length <= 1);
      const current = active[0]?.id ?? null;
      if (previous && current !== previous) ended = run.elapsedMs;
      if (current && current !== previous) {
        bursts++;
        assert.ok(run.elapsedMs - ended >= 1600);
      }
      previous = current;
    }
    assert.ok(bursts > 3);
    assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
  }
});

test('historical local v1 exposes truthful range flags without changing accepted replay bytes', async () => {
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-local-v1-proofs.json', import.meta.url)),
  );
  for (const proof of proofs) {
    const restored = restoreClassicSnakeReplayV4(proof.replay);
    assert.deepEqual(exportClassicSnakeReplayV4(restored), proof.replay);
  }
  const proof = proofs.find(
    (row) =>
      row.levelId === 'classic-field-quiet-return' && row.mode === 'team' && row.pace === 'normal',
  ).replay;
  const run = createClassicSnakeV4(proof.level, {
    mode: proof.mode,
    seed: proof.seed,
    hazardSeed: proof.hazardSeed,
  });
  let cursor = 0;
  while (run.tick < 78) {
    while (proof.turns[cursor]?.tick === run.tick) {
      const turn = proof.turns[cursor++];
      assert.ok(queueClassicSnakeTurnV4(run, turn.playerId, turn.direction));
    }
    stepClassicSnakeV4(run);
    if (run.tick === 77) {
      assert.equal(source(run).phase, 'jamming', 'historical simulation remains unchanged');
      assert.equal(classicSnakeSignalView(run).active, false);
      assert.equal(classicSnakeSignalView(run).sources[0].exposed, false);
    }
  }
  assert.equal(classicSnakeSignalView(run).active, true);
  assert.deepEqual(restoreClassicSnakeReplayV4(exportClassicSnakeReplayV4(run)), run);
});
