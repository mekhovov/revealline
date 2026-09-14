import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, getSummary, CELL } from '../../../game/core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../../../game/replay.mjs';

export const ROUTE_TICK_LIMIT = 21600;
export const STEP_TICK_LIMIT = 3600;
export const INPUT = Object.freeze({
  direction: null,
  boost: false,
  action: false,
  pickup: false,
  switchClass: null,
});

/** Finite, read-only waypoint controller. Every state change is a public core tick. */
export function drive(level, classRecipes, turnPolicy, commands, { onTick } = {}) {
  const setup = { classId: 'scout', classRecipes, turnPolicy, seed: 1 };
  const run = createRun(level, setup),
    recorder = createRecorder(level, setup, 'fracture-lines-proof');
  const events = {},
    notable = [];
  let pressureTicks = 0,
    slowTicks = 0,
    recapturedCells = 0;
  const recaptureScores = [];
  const terminal = () => ['won', 'lost'].includes(run.status);
  function tick(direction = null) {
    assert.ok(run.tick < ROUTE_TICK_LIMIT, 'Finite Fracture route tick budget.');
    if (terminal()) return false;
    const input = { ...INPUT, direction };
    const beforeUnique = run.classic.uniqueClaimedCount,
      beforeScore = run.score;
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    for (const event of run.events) {
      events[event.type] = (events[event.type] ?? 0) + 1;
      if (event.type !== 'player.moved') notable.push(structuredClone(event));
    }
    if (run.enemies.some((e) => e.classic?.pressure?.phase === 'committed')) pressureTicks++;
    const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
    if (run.cells[cell] === CELL.FIELD && run.classic.terrain[cell] === 1) slowTicks++;
    const claimed = run.events
      .filter((e) => e.type === 'cells.claimed')
      .reduce((n, e) => n + e.indices.length, 0);
    const firstClaims = run.classic.uniqueClaimedCount - beforeUnique;
    const reclaimed = claimed - firstClaims;
    if (reclaimed > 0) {
      assert.equal(
        run.score - beforeScore,
        firstClaims * run.rules.pointsPerCell,
        'Recapture cannot farm cell points.',
      );
      recapturedCells += reclaimed;
      recaptureScores.push({
        tick: run.tick,
        claimed,
        firstClaims,
        reclaimed,
        scoreDelta: run.score - beforeScore,
      });
    }
    onTick?.({ run, recorder, input, reclaimed });
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
      if (!terminal() && run.events.some((e) => e.type === 'capture.stopped')) tick();
    }
  }
  for (const command of commands) {
    if (terminal()) break;
    if (command.to) to(...command.to);
    else if (command.ticks) {
      assert.ok(
        Number.isInteger(command.ticks) && command.ticks > 0 && command.ticks <= STEP_TICK_LIMIT,
      );
      for (let n = 0; n < command.ticks && !terminal(); n++) tick(command.direction ?? null);
    } else if (command.untilLoss) {
      const lives = run.lives;
      let count = 0;
      while (run.lives === lives && !terminal()) {
        assert.ok(++count <= STEP_TICK_LIMIT, 'Finite deliberate first-life-loss control.');
        tick(command.direction ?? null);
      }
    } else if (command.recover) {
      let count = 0;
      while (run.status === 'respawning') {
        assert.ok(++count <= STEP_TICK_LIMIT, 'Finite recovery.');
        tick();
      }
    } else throw new Error('Unknown Fracture command.');
  }
  return {
    run,
    recorder,
    setup,
    expected: getSummary(run),
    replay: exportReplay(recorder, run),
    metrics: { events, notable, pressureTicks, slowTicks, recapturedCells, recaptureScores },
  };
}

// Fixed, independently replayed inputs. Each difficulty owns its actual route.
// Split Ring retains coordinate controls; other routes keep compact bounded ticks.
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const CONTROLS = freeze({
  'fracture-lines-split-ring': {
    north: [
      {
        to: ['right', 34.5],
      },
      {
        to: ['up', 0.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['down', 21.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['down', 32.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 4.5],
      },
      {
        to: ['left', 0.5],
      },
      {
        to: ['right', 34.5],
      },
      {
        to: ['down', 21.5],
      },
      {
        to: ['right', 43.5],
      },
      {
        to: ['down', 32.5],
      },
      {
        to: ['right', 58.5],
      },
      {
        to: ['up', 4.5],
      },
    ],
    south: [
      {
        to: ['down', 35.5],
      },
      {
        to: ['right', 71.5],
      },
      {
        to: ['up', 21.5],
      },
      {
        to: ['left', 0.5],
      },
    ],
    loss: [
      {
        to: ['right', 5.5],
      },
      {
        to: ['down', 22.5],
      },
      {
        to: ['left', 2.5],
      },
      {
        untilLoss: true,
        direction: 'up',
      },
    ],
  },
  'fracture-lines-fault-fan': {
    north: {
      standard: [
        {
          ticks: 144,
          direction: 'up',
        },
        {
          ticks: 496,
          direction: 'left',
        },
        {
          ticks: 104,
          direction: 'down',
        },
        {
          ticks: 120,
          direction: 'right',
        },
        {
          ticks: 16,
          direction: 'down',
        },
        {
          ticks: 120,
          direction: 'left',
        },
        {
          ticks: 156,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 384,
          direction: 'right',
        },
        {
          ticks: 276,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 240,
          direction: 'down',
        },
        {
          ticks: 380,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 200,
          direction: 'up',
        },
        {
          ticks: 380,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 200,
          direction: 'down',
        },
        {
          ticks: 104,
          direction: 'left',
        },
        {
          ticks: 196,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 280,
          direction: 'left',
        },
        {
          ticks: 48,
          direction: 'down',
        },
        {
          ticks: 120,
          direction: 'right',
        },
        {
          ticks: 12,
          direction: 'down',
        },
      ],
      gentle: [
        {
          ticks: 144,
          direction: 'up',
        },
        {
          ticks: 496,
          direction: 'left',
        },
        {
          ticks: 104,
          direction: 'down',
        },
        {
          ticks: 120,
          direction: 'right',
        },
        {
          ticks: 16,
          direction: 'down',
        },
        {
          ticks: 120,
          direction: 'left',
        },
        {
          ticks: 156,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 384,
          direction: 'right',
        },
        {
          ticks: 276,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 240,
          direction: 'down',
        },
        {
          ticks: 380,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 200,
          direction: 'up',
        },
        {
          ticks: 380,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 200,
          direction: 'down',
        },
        {
          ticks: 104,
          direction: 'left',
        },
        {
          ticks: 196,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 280,
          direction: 'left',
        },
        {
          ticks: 48,
          direction: 'down',
        },
        {
          ticks: 120,
          direction: 'right',
        },
        {
          ticks: 12,
          direction: 'down',
        },
      ],
    },
    south: {
      standard: [
        {
          ticks: 136,
          direction: 'down',
        },
        {
          ticks: 112,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 384,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 40,
          direction: 'up',
        },
        {
          ticks: 380,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 200,
          direction: 'up',
        },
        {
          ticks: 380,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 200,
          direction: 'down',
        },
        {
          ticks: 280,
          direction: 'right',
        },
        {
          ticks: 196,
          direction: 'up',
        },
      ],
      gentle: [
        {
          ticks: 136,
          direction: 'down',
        },
        {
          ticks: 104,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 392,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 40,
          direction: 'up',
        },
        {
          ticks: 388,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 200,
          direction: 'up',
        },
        {
          ticks: 388,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 320,
          direction: 'right',
        },
        {
          ticks: 196,
          direction: 'down',
        },
      ],
    },
    loss: [
      {
        to: ['left', 66.5],
      },
      {
        to: ['down', 22.5],
      },
      {
        to: ['right', 69.5],
      },
      {
        untilLoss: true,
        direction: 'up',
      },
    ],
    recovered: {
      standard: [
        {
          ticks: 40,
          direction: 'left',
        },
        {
          ticks: 32,
          direction: 'down',
        },
        {
          ticks: 24,
          direction: 'right',
        },
        {
          ticks: 29,
          direction: 'up',
        },
        {
          ticks: 77,
          direction: null,
        },
        {
          ticks: 136,
          direction: 'down',
        },
        {
          ticks: 112,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 384,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 40,
          direction: 'up',
        },
        {
          ticks: 380,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 200,
          direction: 'up',
        },
        {
          ticks: 380,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 200,
          direction: 'down',
        },
        {
          ticks: 280,
          direction: 'right',
        },
        {
          ticks: 196,
          direction: 'up',
        },
      ],
      gentle: [
        {
          ticks: 40,
          direction: 'left',
        },
        {
          ticks: 32,
          direction: 'down',
        },
        {
          ticks: 24,
          direction: 'right',
        },
        {
          ticks: 29,
          direction: 'up',
        },
        {
          ticks: 77,
          direction: null,
        },
        {
          ticks: 136,
          direction: 'down',
        },
        {
          ticks: 104,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 392,
          direction: 'left',
        },
        {
          ticks: 276,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 40,
          direction: 'up',
        },
        {
          ticks: 388,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 200,
          direction: 'up',
        },
        {
          ticks: 388,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 320,
          direction: 'right',
        },
        {
          ticks: 196,
          direction: 'down',
        },
      ],
    },
  },
  'fracture-lines-frayed-causeway': {
    north: {
      standard: [
        {
          ticks: 280,
          direction: 'right',
        },
        {
          ticks: 224,
          direction: 'up',
        },
        {
          ticks: 564,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 568,
          direction: 'right',
        },
        {
          ticks: 184,
          direction: 'down',
        },
        {
          ticks: 564,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 568,
          direction: 'right',
        },
        {
          ticks: 88,
          direction: 'up',
        },
        {
          ticks: 596,
          direction: 'left',
        },
      ],
      gentle: [
        {
          ticks: 280,
          direction: 'right',
        },
        {
          ticks: 224,
          direction: 'up',
        },
        {
          ticks: 564,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 88,
          direction: 'right',
        },
        {
          ticks: 220,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 392,
          direction: 'right',
        },
        {
          ticks: 220,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 192,
          direction: 'down',
        },
        {
          ticks: 388,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 140,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 252,
          direction: 'right',
        },
        {
          ticks: 120,
          direction: 'up',
        },
        {
          ticks: 420,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 16,
          direction: 'right',
        },
        {
          ticks: 116,
          direction: 'down',
        },
      ],
    },
    south: {
      standard: [
        {
          ticks: 288,
          direction: 'left',
        },
        {
          ticks: 152,
          direction: 'up',
        },
        {
          ticks: 596,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 384,
          direction: 'left',
        },
        {
          ticks: 148,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 152,
          direction: 'up',
        },
        {
          ticks: 288,
          direction: 'right',
        },
        {
          ticks: 148,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 96,
          direction: 'right',
        },
        {
          ticks: 224,
          direction: 'up',
        },
        {
          ticks: 564,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 568,
          direction: 'right',
        },
        {
          ticks: 184,
          direction: 'down',
        },
        {
          ticks: 380,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 184,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 156,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 412,
          direction: 'right',
        },
        {
          ticks: 88,
          direction: 'up',
        },
        {
          ticks: 412,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 184,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 24,
          direction: 'down',
        },
        {
          ticks: 180,
          direction: 'right',
        },
      ],
      gentle: [
        {
          ticks: 288,
          direction: 'left',
        },
        {
          ticks: 152,
          direction: 'up',
        },
        {
          ticks: 596,
          direction: 'right',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'right',
        },
        {
          ticks: 384,
          direction: 'left',
        },
        {
          ticks: 148,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 152,
          direction: 'up',
        },
        {
          ticks: 288,
          direction: 'right',
        },
        {
          ticks: 148,
          direction: 'down',
        },
      ],
    },
    loss: [
      {
        to: ['up', 31.5],
      },
      {
        to: ['left', 32.5],
      },
      {
        to: ['down', 33.5],
      },
      {
        untilLoss: true,
        direction: 'right',
      },
    ],
    recovered: {
      standard: [
        {
          ticks: 32,
          direction: 'up',
        },
        {
          ticks: 32,
          direction: 'left',
        },
        {
          ticks: 16,
          direction: 'down',
        },
        {
          ticks: 29,
          direction: 'right',
        },
        {
          ticks: 77,
          direction: null,
        },
        {
          ticks: 280,
          direction: 'right',
        },
        {
          ticks: 224,
          direction: 'up',
        },
        {
          ticks: 564,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 568,
          direction: 'right',
        },
        {
          ticks: 176,
          direction: 'down',
        },
        {
          ticks: 564,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 568,
          direction: 'right',
        },
        {
          ticks: 88,
          direction: 'up',
        },
        {
          ticks: 596,
          direction: 'left',
        },
      ],
      gentle: [
        {
          ticks: 32,
          direction: 'up',
        },
        {
          ticks: 32,
          direction: 'left',
        },
        {
          ticks: 16,
          direction: 'down',
        },
        {
          ticks: 29,
          direction: 'right',
        },
        {
          ticks: 77,
          direction: null,
        },
        {
          ticks: 280,
          direction: 'right',
        },
        {
          ticks: 224,
          direction: 'up',
        },
        {
          ticks: 564,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 88,
          direction: 'right',
        },
        {
          ticks: 220,
          direction: 'down',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'down',
        },
        {
          ticks: 392,
          direction: 'right',
        },
        {
          ticks: 220,
          direction: 'up',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'up',
        },
        {
          ticks: 208,
          direction: 'down',
        },
        {
          ticks: 388,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 392,
          direction: 'right',
        },
        {
          ticks: 128,
          direction: 'up',
        },
        {
          ticks: 420,
          direction: 'left',
        },
        {
          ticks: 1,
          direction: null,
        },
        {
          ticks: 4,
          direction: 'left',
        },
        {
          ticks: 48,
          direction: 'right',
        },
        {
          ticks: 124,
          direction: 'down',
        },
      ],
    },
  },
});
