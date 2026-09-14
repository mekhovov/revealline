import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, getSummary, CELL } from '../../../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../../../game/replay.mjs';
import { boundedJSON, exactKeys, plainObject } from '../../../game/data-json.mjs';
import { digest } from '../sentinel-circuit/files.mjs';
import { CLASS_IDS, IDS } from './build.mjs';

export const ROUTE_TICK_LIMIT = 21600;
export const STEP_TICK_LIMIT = 3600;
export const DIRECTIONS = Object.freeze(['up', 'right', 'down', 'left']);
export const INPUT = Object.freeze({
  direction: null,
  boost: false,
  action: false,
  pickup: false,
  switchClass: null,
});

/** Own and validate a finite data-only controller before creating any run. */
export function ownCommands(value) {
  const commands = boundedJSON(value, {
    maxBytes: 32768,
    maxNodes: 4096,
    maxDepth: 6,
    maxArray: 128,
    maxString: 64,
  });
  assert.ok(Array.isArray(commands) && commands.length > 0 && commands.length <= 128);
  for (const command of commands) {
    assert.ok(plainObject(command));
    if (Object.hasOwn(command, 'to')) {
      exactKeys(command, ['to'], 'Waypoint command');
      assert.ok(Array.isArray(command.to) && command.to.length === 2);
      const [direction, target] = command.to;
      assert.ok(DIRECTIONS.includes(direction));
      assert.ok(
        Number.isFinite(target) &&
          target >= 0.5 &&
          target <= (['up', 'down'].includes(direction) ? 35.5 : 71.5),
      );
    } else if (Object.hasOwn(command, 'ticks')) {
      exactKeys(command, ['ticks', 'direction'], 'Timed command');
      assert.ok(
        Number.isInteger(command.ticks) && command.ticks > 0 && command.ticks <= STEP_TICK_LIMIT,
      );
      assert.ok(command.direction === null || DIRECTIONS.includes(command.direction));
    } else if (Object.hasOwn(command, 'untilLoss')) {
      exactKeys(command, ['untilLoss', 'direction'], 'Loss command');
      assert.equal(command.untilLoss, true);
      assert.ok(command.direction === null || DIRECTIONS.includes(command.direction));
    } else {
      exactKeys(command, ['recover'], 'Recovery command');
      assert.equal(command.recover, true);
    }
  }
  return commands;
}

/** Every change to the run is an ordinary public core tick; no state patching. */
export function drive(
  level,
  classRecipes,
  turnPolicy,
  commands,
  { classId = 'scout', onTick } = {},
) {
  assert.ok(CLASS_IDS.includes(classId), 'Explicit selectable authored class required.');
  assert.ok(['immediate', 'grid-center'].includes(turnPolicy));
  const owned = ownCommands(commands);
  const setup = { classId, classRecipes, turnPolicy, seed: 1 };
  const run = createRun(level, setup);
  const recorder = createRecorder(level, setup, 'countercurrent-proof');
  const events = {},
    notable = [],
    captures = [],
    laneTicks = {},
    pressureTicks = {};
  let slowTicks = 0,
    stopChecks = 0;
  const terminal = () => ['won', 'lost'].includes(run.status);
  function tick(direction = null) {
    assert.ok(run.tick < ROUTE_TICK_LIMIT, 'Finite Countercurrent route tick budget.');
    if (terminal()) return false;
    const input = { ...INPUT, direction };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    for (const event of run.events) {
      events[event.type] = (events[event.type] ?? 0) + 1;
      if (event.type !== 'player.moved') notable.push(structuredClone(event));
      if (event.type === 'cells.claimed')
        captures.push({
          tick: run.tick,
          count: event.indices.length,
          cellsSha256: digest(event.indices),
          player: { x: run.player.x, y: run.player.y },
        });
    }
    for (const enemy of run.enemies) {
      if (enemy.type === 'lane-boss') {
        laneTicks[enemy.id] ??= { idle: 0, warning: 0, active: 0 };
        laneTicks[enemy.id][enemy.bossPhase]++;
      }
      if (enemy.classic?.pressure) {
        const phase = enemy.classic.pressure.phase;
        pressureTicks[phase] = (pressureTicks[phase] ?? 0) + 1;
      }
    }
    const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
    if (run.cells[cell] === CELL.FIELD && run.classic.terrain[cell] === 1) slowTicks++;
    if (run.events.some((event) => event.type === 'capture.stopped')) {
      assert.equal(run.player.speed, 0);
      assert.equal(run.player.queuedDirection, null);
      assert.equal(run.player.cutting, false);
      stopChecks++;
    }
    onTick?.({ run, recorder, input });
    return true;
  }
  function to(direction, target) {
    const axis = ['left', 'right'].includes(direction) ? 'x' : 'y';
    const sign = ['right', 'down'].includes(direction) ? 1 : -1;
    let count = 0;
    while (sign * (target - run.player[axis]) > 1e-6 && !terminal()) {
      assert.ok(
        ++count <= STEP_TICK_LIMIT,
        `Blocked ${direction} toward ${target} at ${run.player.x},${run.player.y}.`,
      );
      tick(direction);
      if (!terminal() && run.events.some((event) => event.type === 'capture.stopped')) {
        const before = { x: run.player.x, y: run.player.y };
        tick();
        assert.deepEqual(
          { x: run.player.x, y: run.player.y },
          before,
          'A neutral command following capture must not resume movement.',
        );
      }
    }
  }
  for (const command of owned) {
    if (terminal()) break;
    if (command.to) to(...command.to);
    else if (command.ticks) {
      for (let n = 0; n < command.ticks && !terminal(); n++) tick(command.direction);
    } else if (command.untilLoss) {
      const lives = run.lives;
      let n = 0;
      while (run.lives === lives && !terminal()) {
        assert.ok(++n <= STEP_TICK_LIMIT, 'Finite actual loss control.');
        tick(command.direction);
      }
    } else {
      let n = 0;
      while (run.status === 'respawning') {
        assert.ok(++n <= STEP_TICK_LIMIT, 'Finite recovery.');
        tick();
      }
    }
  }
  return {
    run,
    recorder,
    setup,
    expected: getSummary(run),
    replay: exportReplay(recorder, run),
    metrics: { events, notable, captures, laneTicks, pressureTicks, slowTicks, stopChecks },
  };
}

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Authored proposals, not recorded successes. A route becomes qualified only
// after the complete verifier writes and independently reproduces its proof.
export const CONTROLS = freeze({
  'countercurrent-offset-docks': {
    north: [
      { to: ['right', 36.5] },
      { to: ['up', 0.5] },
      { to: ['left', 8.5] },
      { to: ['down', 35.5] },
      { to: ['right', 62.5] },
      { to: ['up', 0.5] },
      { to: ['left', 36.5] },
      { to: ['down', 35.5] },
      { to: ['left', 0.5] },
      { to: ['up', 18.5] },
      { to: ['right', 62.5] },
      { to: ['up', 5.5] },
      { to: ['left', 0.5] },
      { to: ['down', 31.5] },
      { to: ['right', 62.5] },
    ],
    south: [
      { to: ['right', 36.5] },
      { to: ['down', 35.5] },
      { to: ['left', 0.5] },
      { to: ['up', 18.5] },
      { to: ['right', 71.5] },
      { to: ['left', 36.5] },
      { to: ['up', 0.5] },
      { to: ['right', 62.5] },
      { to: ['down', 35.5] },
      { to: ['left', 8.5] },
      { to: ['up', 0.5] },
      { to: ['right', 36.5] },
      { to: ['down', 31.5] },
      { to: ['left', 0.5] },
    ],
    loss: [
      { to: ['right', 8.5] },
      { to: ['down', 22.5] },
      { to: ['left', 4.5] },
      { untilLoss: true, direction: 'up' },
    ],
  },
  'countercurrent-sandbar-braid': {
    north: [
      { to: ['up', 0.5] },
      { to: ['left', 0.5] },
      { to: ['down', 18.5] },
      { to: ['right', 71.5] },
      { to: ['down', 35.5] },
      { to: ['left', 62.5] },
      { to: ['up', 0.5] },
      { to: ['left', 7.5] },
      { to: ['down', 35.5] },
      { to: ['right', 36.5] },
      { to: ['up', 18.5] },
      { to: ['right', 71.5] },
      { to: ['down', 31.5] },
      { to: ['left', 0.5] },
    ],
    south: [
      { to: ['left', 7.5] },
      { to: ['up', 0.5] },
      { to: ['right', 62.5] },
      { to: ['down', 35.5] },
      { to: ['left', 0.5] },
      { to: ['up', 18.5] },
      { to: ['right', 71.5] },
      { to: ['up', 0.5] },
      { to: ['left', 36.5] },
      { to: ['down', 35.5] },
      { to: ['right', 71.5] },
      { to: ['up', 31.5] },
      { to: ['left', 0.5] },
    ],
    loss: [
      { to: ['up', 31.5] },
      { to: ['left', 31.5] },
      { to: ['down', 33.5] },
      { untilLoss: true, direction: 'right' },
    ],
  },
  'countercurrent-crossing-watch': {
    north: [
      { to: ['right', 12.5] },
      { to: ['up', 0.5] },
      { ticks: 360, direction: null },
      { to: ['right', 30.5] },
      { to: ['down', 35.5] },
      { to: ['right', 54.5] },
      { ticks: 300, direction: null },
      { to: ['up', 0.5] },
      { to: ['down', 17.5] },
      { to: ['left', 30.5] },
      { to: ['left', 0.5] },
      { to: ['up', 0.5] },
      { to: ['right', 66.5] },
      { ticks: 480, direction: null },
      { to: ['down', 35.5] },
      { to: ['right', 71.5] },
      { to: ['up', 31.5] },
      { to: ['left', 54.5] },
      { to: ['up', 8.5] },
      { to: ['right', 71.5] },
    ],
    south: [
      { to: ['right', 12.5] },
      { to: ['down', 35.5] },
      { ticks: 360, direction: null },
      { to: ['right', 30.5] },
      { to: ['up', 0.5] },
      { to: ['right', 54.5] },
      { ticks: 300, direction: null },
      { to: ['down', 35.5] },
      { to: ['up', 17.5] },
      { to: ['left', 30.5] },
      { to: ['left', 0.5] },
      { to: ['down', 35.5] },
      { to: ['right', 66.5] },
      { ticks: 480, direction: null },
      { to: ['up', 0.5] },
      { to: ['right', 71.5] },
      { to: ['down', 31.5] },
      { to: ['left', 54.5] },
      { to: ['up', 8.5] },
      { to: ['right', 71.5] },
    ],
    loss: [
      { to: ['right', 8.5] },
      { to: ['down', 22.5] },
      { to: ['left', 4.5] },
      { untilLoss: true, direction: 'up' },
    ],
  },
});

// Only these three Gentle schedules differ; all Standard routes stay unchanged.
const GENTLE_CONTROLS = freeze({
  'countercurrent-offset-docks': {
    south: [
      { to: ['right', 36.5] },
      { to: ['down', 35.5] },
      { to: ['left', 0.5] },
      { to: ['up', 18.5] },
      { to: ['right', 71.5] },
      { to: ['left', 62.5] },
      { to: ['up', 0.5] },
      { to: ['left', 32.5] },
      { to: ['down', 35.5] },
      { to: ['left', 8.5] },
      { to: ['up', 0.5] },
      { to: ['right', 62.5] },
      { to: ['down', 31.5] },
      { to: ['left', 0.5] },
    ],
  },
  'countercurrent-sandbar-braid': {
    south: [
      { to: ['left', 7.5] },
      { to: ['up', 0.5] },
      { to: ['right', 62.5] },
      { to: ['down', 35.5] },
      { to: ['left', 0.5] },
      { to: ['up', 18.5] },
      { to: ['right', 71.5] },
      { to: ['up', 0.5] },
      { to: ['left', 36.5] },
      { ticks: 360, direction: null },
      { to: ['down', 35.5] },
      { to: ['right', 71.5] },
      { to: ['up', 31.5] },
      { to: ['left', 0.5] },
    ],
  },
  'countercurrent-crossing-watch': {
    north: [
      { to: ['right', 12.5] },
      { to: ['up', 0.5] },
      { ticks: 360, direction: null },
      { to: ['right', 30.5] },
      { to: ['down', 35.5] },
      { to: ['right', 54.5] },
      { ticks: 540, direction: null },
      { to: ['up', 0.5] },
      { to: ['down', 17.5] },
      { to: ['left', 30.5] },
      { to: ['left', 0.5] },
      { to: ['up', 0.5] },
      { to: ['right', 66.5] },
      { ticks: 480, direction: null },
      { to: ['down', 35.5] },
      { to: ['right', 71.5] },
      { to: ['up', 31.5] },
      { to: ['left', 54.5] },
      { to: ['up', 8.5] },
      { to: ['right', 71.5] },
    ],
  },
});

export function routeCommands(levelId, which, difficulty) {
  assert.ok(
    IDS.includes(levelId) && ['north', 'south', 'loss', 'recovered', 'gameover'].includes(which),
  );
  assert.ok(['standard', 'gentle'].includes(difficulty));
  const controls = CONTROLS[levelId];
  const gentle = difficulty === 'gentle' ? GENTLE_CONTROLS[levelId] : null;
  // The real loss/recovery advances Watch's actor clocks. Its 300-tick pause
  // differs from the 540-tick pause required by the fresh Gentle north route.
  const recovered =
    difficulty === 'gentle' && levelId === 'countercurrent-crossing-watch'
      ? controls.north
      : (gentle?.north ?? controls.north);
  if (which === 'gameover') {
    assert.equal(difficulty, 'standard');
    return ownCommands(
      Array.from({ length: 3 }, () => [...controls.loss, { recover: true }]).flat(),
    );
  }
  return ownCommands(
    which === 'recovered'
      ? [...controls.loss, { recover: true }, ...recovered]
      : (gentle?.[which] ?? controls[which]),
  );
}
