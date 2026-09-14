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
  const recorder = createRecorder(level, setup, 'moving-edges-proof');
  const events = {},
    notable = [],
    captures = [],
    laneTicks = {},
    pressureTicks = {},
    actorModes = {},
    erosion = [],
    recaptures = [];
  const eroded = new Set(),
    credited = new Set();
  let priorUnique = run.classic.uniqueClaimedCount;
  let slowTicks = 0,
    stopChecks = 0;
  const terminal = () => ['won', 'lost'].includes(run.status);
  function tick(direction = null) {
    assert.ok(run.tick < ROUTE_TICK_LIMIT, 'Finite Moving Edges route tick budget.');
    if (terminal()) return false;
    const input = { ...INPUT, direction };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    for (const event of run.events) {
      events[event.type] = (events[event.type] ?? 0) + 1;
      if (event.type !== 'player.moved') notable.push(structuredClone(event));
      if (event.type === 'cells.eroded') {
        for (const index of event.indices) eroded.add(index);
        erosion.push({
          tick: run.tick,
          indices: [...event.indices],
          uniqueClaimedCount: run.classic.uniqueClaimedCount,
        });
      }
      if (event.type === 'cells.claimed') {
        for (const index of event.indices) credited.add(index);
        const repeated = event.indices.filter((index) => eroded.has(index));
        if (repeated.length) {
          recaptures.push({ tick: run.tick, indices: repeated });
          for (const index of repeated) eroded.delete(index);
        }
        captures.push({
          tick: run.tick,
          count: event.indices.length,
          cellsSha256: digest(event.indices),
          player: { x: run.player.x, y: run.player.y },
        });
      }
    }
    assert.ok(
      run.classic.uniqueClaimedCount >= priorUnique,
      'Erosion cannot decrease unique credit.',
    );
    priorUnique = run.classic.uniqueClaimedCount;
    assert.equal(priorUnique, credited.size, 'Exactly first-time cells earn credit.');
    assert.equal(
      run.score,
      credited.size * run.rules.pointsPerCell,
      'No repeated cell score after erosion.',
    );
    for (const enemy of run.enemies) {
      if (['contour-patrol', 'claimed-rover', 'eroder'].includes(enemy.type)) {
        const mode = enemy.classic?.mode ?? (enemy.classic?.target === null ? 'moving' : 'warning');
        actorModes[enemy.id] ??= {};
        actorModes[enemy.id][mode] = (actorModes[enemy.id][mode] ?? 0) + 1;
      }
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
    metrics: {
      events,
      notable,
      captures,
      laneTicks,
      pressureTicks,
      actorModes,
      erosion,
      recaptures,
      slowTicks,
      stopChecks,
    },
  };
}

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// Authored ordinary routes use only waypoints. Difficulty-specific returns reflect actual enemy timing.
// north/south remain distinct capture decisions; all initial failed attempts are retained in cache.
export const CONTROLS = freeze({
  'moving-edges-terrace-stitch': {
    north: [
      {
        to: ['right', 34.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 7.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 64.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 34.5],
      },
      {
        to: ['down', 20.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 44.5],
      },
      {
        to: ['up', 20.5],
      },
      {
        to: ['left', 0.5],
      },
    ],
    south: [
      {
        to: ['right', 44.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 7.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['right', 34.5],
      },
      {
        to: ['down', 20.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 64.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 0.5],
      },
    ],
  },
  'moving-edges-survey-wheel': {
    north: [
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 69.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 39.5],
      },
      {
        to: ['down', 20.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['up', 11.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['down', 31.5],
      },
      {
        to: ['left', 39.5],
      },
    ],
    south: [
      {
        to: ['right', 64.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 39.5],
      },
      {
        to: ['up', 20.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['up', 11.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['down', 31.5],
      },
      {
        to: ['left', 39.5],
      },
    ],
  },
  'moving-edges-breakwater-return': {
    north: [
      {
        to: ['right', 26.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['right', 47.5],
      },
      {
        to: ['down', 18.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['right', 65.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 47.5],
      },
      {
        to: ['down', 18.5],
      },
      {
        to: ['right', 71.5],
      },
    ],
    south: [
      {
        to: ['up', 16.5],
      },
      {
        to: ['right', 65.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 26.5],
      },
      {
        to: ['up', 18.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['right', 47.5],
      },
      {
        to: ['down', 18.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['down', 35.5],
      },
    ],
  },
});

export const GENTLE_CONTROLS = freeze({
  'moving-edges-terrace-stitch': {
    north: [
      {
        to: ['right', 34.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 7.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 64.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['down', 20.5],
      },
      {
        to: ['left', 7.5],
      },
      {
        to: ['up', 19.5],
      },
      {
        to: ['right', 64.5],
      },
      {
        to: ['up', 0.5],
      },
    ],
    south: [
      {
        to: ['right', 44.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 7.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['right', 34.5],
      },
      {
        to: ['down', 20.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 64.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 0.5],
      },
    ],
  },
  'moving-edges-survey-wheel': {
    north: [
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 64.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 39.5],
      },
      {
        to: ['down', 20.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['up', 11.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['down', 31.5],
      },
      {
        to: ['left', 39.5],
      },
    ],
    south: [
      {
        to: ['right', 64.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 39.5],
      },
      {
        to: ['up', 20.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['up', 11.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['down', 27.5],
      },
      {
        to: ['left', 39.5],
      },
    ],
  },
  'moving-edges-breakwater-return': {
    north: [
      {
        to: ['right', 26.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['right', 47.5],
      },
      {
        to: ['down', 18.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['right', 65.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 47.5],
      },
      {
        to: ['down', 18.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 14.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['up', 0.5],
      },
    ],
    south: [
      {
        to: ['right', 65.5],
      },
      {
        to: ['down', 35.5],
      },
      {
        to: ['left', 24.5],
      },
      {
        to: ['up', 18.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['right', 47.5],
      },
      {
        to: ['down', 18.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['left', 8.5],
      },
      {
        to: ['down', 35.5],
      },
    ],
  },
});

export function routeCommands(levelId, which, difficulty) {
  assert.ok(IDS.includes(levelId), 'Exact Moving Edges level required.');
  assert.ok(['north', 'south'].includes(which), 'Only first-stage ordinary routes are authored.');
  assert.ok(['standard', 'gentle'].includes(difficulty));
  return ownCommands((difficulty === 'gentle' ? GENTLE_CONTROLS : CONTROLS)[levelId][which]);
}
