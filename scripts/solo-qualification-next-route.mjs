import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const NEXT_ROUTE_PROTOCOL = 'authored-next-geometric-v1';
export const NEXT_ROUTE_SOURCE = 'c696af41857840359ae473558b90682f3d71f2db';
export const NEXT_ROUTE_FINAL_SOURCE = 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17';
export const NEXT_ROUTE_39774_SOURCE = '39774cce8697d412d138ef4da11ac547a5f8e535';
export const NEXT_ROUTE_DE332_SOURCE = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
const nextRouteSources = Object.freeze([
  NEXT_ROUTE_SOURCE,
  NEXT_ROUTE_FINAL_SOURCE,
  NEXT_ROUTE_39774_SOURCE,
  NEXT_ROUTE_DE332_SOURCE,
]);
export const NEXT_ROUTE_IDENTITIES = [
  {
    id: 'first-return',
    levelSHA256: '5561f9e677bd5c6b7a33205207ed16d25a43ebdb4be54ab5ac219779f78130db',
    enemyCount: 1,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: [
      {
        type: 'key',
        key: 'ArrowRight',
        ms: 1358,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 3908,
      },
    ],
  },
  {
    id: 'choose-your-share',
    levelSHA256: '2e8b912c1ce8028b9509eaff890809ca4a144823c59f377f7a8e95facd32f6f8',
    enemyCount: 1,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: null,
  },
  {
    id: 'two-keepers',
    levelSHA256: 'c98d17d44b57dc19a8329cf3a7dc7772c9bd5cf1c1681f37b26cf50e87a81eea',
    enemyCount: 2,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: null,
  },
  {
    id: 'nearby-shore',
    levelSHA256: 'c6ef0a3032aff086ecf7775588f26098cf22ef1c31d8346e1a9102ea5618708f',
    enemyCount: 2,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: [
      {
        type: 'wait',
        ms: 5000,
      },
      {
        type: 'key',
        key: 'ArrowRight',
        ms: 4408,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 3958,
      },
      {
        type: 'key',
        key: 'ArrowLeft',
        ms: 1917,
      },
      {
        type: 'key',
        key: 'ArrowUp',
        ms: 3908,
      },
    ],
  },
  {
    id: 'island-outpost',
    levelSHA256: 'c794a6d0a9a876b3200590290cb48a73fbcd2b00550762ae7a8e125f187c46e2',
    enemyCount: 2,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: null,
  },
  {
    id: 'stepping-stones',
    levelSHA256: '8b2f599730f202a12ec441beeba976b5b1aa36281822721e33e9cfb02f4f9aff',
    enemyCount: 2,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: [
      {
        type: 'wait',
        ms: 500,
      },
      {
        type: 'key',
        key: 'ArrowRight',
        ms: 3283,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 3967,
      },
      {
        type: 'key',
        key: 'ArrowUp',
        ms: 3958,
      },
      {
        type: 'key',
        key: 'ArrowLeft',
        ms: 2267,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 3908,
      },
    ],
  },
  {
    id: 'two-bays',
    levelSHA256: 'a8e5b0c4b2f79de683fe551dbd5c48f2a4b2155c43374b6abda3b7c8b31e22cd',
    enemyCount: 2,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: null,
  },
  {
    id: 'courtyard-return',
    levelSHA256: '9418d4782980ef5c6bafc2975f1c292989be9a292e9e00f6c1dda5484ef54815',
    enemyCount: 2,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: [
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 5667,
      },
      {
        type: 'key',
        key: 'ArrowRight',
        ms: 8333,
      },
      {
        type: 'key',
        key: 'ArrowUp',
        ms: 2000,
      },
      {
        type: 'key',
        key: 'ArrowLeft',
        ms: 8333,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 6667,
      },
    ],
  },
  {
    id: 'long-way-home',
    levelSHA256: '2fc16948a45be920d517a243773d1b7db898f235556db3bf3608e568f8d878dc',
    enemyCount: 2,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: null,
  },
  {
    id: 'behind-the-patrol',
    levelSHA256: '73a2ab26b6e0514d10733719ccac033f7299685fdf56fa25afd918be97df5fc1',
    enemyCount: 3,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: [
      {
        type: 'wait',
        ms: 6667,
      },
      {
        type: 'key',
        key: 'ArrowRight',
        ms: 3842,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 4333,
      },
    ],
  },
  {
    id: 'second-landing',
    levelSHA256: '0108b52c6be4213d1f9c4907bad412b99a786cdccdc867fd405b7ec7afc31994',
    enemyCount: 3,
    options: {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    },
    timed: [
      {
        type: 'wait',
        ms: 4417,
      },
      {
        type: 'key',
        key: 'ArrowRight',
        ms: 6833,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 2083,
      },
      {
        type: 'key',
        key: 'ArrowLeft',
        ms: 9167,
      },
      {
        type: 'key',
        key: 'ArrowLeft',
        ms: 833,
      },
      {
        type: 'key',
        key: 'ArrowRight',
        ms: 2917,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 5000,
      },
      {
        type: 'key',
        key: 'ArrowDown',
        ms: 5000,
      },
    ],
  },
];
export const NEXT_ROUTE_LIMITS = Object.freeze({
  missionMs: 60000,
  stageMs: 15000,
  pollMs: 50,
  operationMs: 100,
  reads: 1201,
  events: 128,
  stages: 32,
  evidenceBytes: 65536,
});

export function geometricRoutes(context) {
  const { run, captures } = context;
  const safe = () => run.trail.length === 0;
  const routes = {
    'choose-your-share': [
      {
        id: 'keeper-crossed-right-away',
        direction: null,
        done: () => {
          const e = run.enemies[0];
          return safe() && e.x >= 49 && e.x <= 50 && e.vx > 0 && e.vx <= 9;
        },
      },
      { id: 'spawn-column-down', direction: 'down', done: () => run.status === 'won' },
    ],
    'two-keepers': [
      { id: 'top-quarter-column', direction: 'left', done: () => safe() && run.player.x <= 21.5 },
      {
        id: 'top-stop-and-first-corridor-clear',
        direction: 'up',
        done: () => {
          if (!safe() || run.player.y > 0.500001) return false;
          const x = run.player.x,
            D = 34.5 / 8.84 + 0.15,
            right = 70;
          return run.enemies.every((e) => {
            const magnitude = Math.hypot(e.vx, e.vy),
              speed =
                magnitude *
                Math.cos(
                  Math.max(
                    (8 * Math.PI) / 180,
                    Math.atan2(Math.abs(e.vy), Math.abs(e.vx)) - (18 * Math.PI) / 180,
                  ),
                );
            if (e.x > x) {
              if (e.vx >= 0) return (2 * right - e.x - x) / speed > D;
              return (e.x - x) / speed > D;
            }
            if (e.vx <= 0) return false;
            const t = (x - e.x) / e.vx,
              y = e.y + e.vy * t;
            return (
              t < D &&
              Math.min(e.y, y) > 2 &&
              Math.max(e.y, y) < 34 &&
              y > 0.5 + 8.84 * t + 4 &&
              (2 * Math.abs(x - right)) / speed > D - t
            );
          });
        },
      },
      { id: 'quarter-down-capture', direction: 'down', done: () => safe() && captures.length >= 1 },
      {
        id: 'bottom-outer-edge',
        direction: 'down',
        done: () => safe() && run.player.y >= 35.499999,
      },
      {
        id: 'bottom-right-quarter-column',
        direction: 'right',
        done: () => safe() && run.player.x >= 45.5,
      },
      {
        id: 'bottom-stop-and-keepers-cross-ahead',
        direction: 'down',
        done: () => {
          if (!safe() || run.player.y < 35.499999) return false;
          const x = run.player.x,
            D = 34.5 / 8.84 + 0.15,
            left = Math.ceil(captures[0].x) + 1,
            right = 70;
          return run.enemies.every((e) => {
            const magnitude = Math.hypot(e.vx, e.vy),
              speed =
                magnitude *
                Math.cos(
                  Math.max(
                    (8 * Math.PI) / 180,
                    Math.atan2(Math.abs(e.vy), Math.abs(e.vx)) - (18 * Math.PI) / 180,
                  ),
                ),
              toward = (x - e.x) * e.vx > 0;
            if (!toward) {
              const wall = e.x < x ? left : right;
              return (Math.abs(e.x - wall) + Math.abs(x - wall)) / speed > D;
            }
            const t = (x - e.x) / e.vx,
              y = e.y + e.vy * Math.min(t, D);
            if (Math.min(e.y, y) <= 2 || Math.max(e.y, y) >= 34) return false;
            if (t > D) return true;
            const wall = e.x < x ? right : left;
            return y < 35.5 - 8.84 * t - 4 && (2 * Math.abs(x - wall)) / speed > D - t;
          });
        },
      },
      { id: 'right-quarter-up-capture', direction: 'up', done: () => run.status === 'won' },
    ],
    'island-outpost': [
      {
        id: 'island-left-capture',
        direction: 'left',
        done: () => safe() && run.player.x <= 1.000001,
      },
      { id: 'left-outer-edge', direction: 'left', done: () => safe() && run.player.x <= 0.500001 },
      {
        id: 'left-shore-top-edge',
        direction: 'up',
        done: () => safe() && run.player.y <= 0.500001,
      },
      { id: 'top-goal-column', direction: 'right', done: () => safe() && run.player.x >= 44.0 },
      {
        id: 'top-stop-and-keepers-cross-below',
        direction: 'up',
        done: () => {
          if (!safe() || run.player.y > 0.500001) return false;
          const x = run.player.x,
            D = 34.5 / 8.84 + 0.15,
            left = 22,
            right = 70;
          return run.enemies.every((e) => {
            if (e.x <= 22) return false;
            const magnitude = Math.hypot(e.vx, e.vy),
              speed =
                magnitude *
                Math.cos(
                  Math.max(
                    (8 * Math.PI) / 180,
                    Math.atan2(Math.abs(e.vy), Math.abs(e.vx)) - (18 * Math.PI) / 180,
                  ),
                ),
              toward = (x - e.x) * e.vx > 0;
            if (!toward) {
              const wall = e.x < x ? left : right;
              return (Math.abs(e.x - wall) + Math.abs(x - wall)) / speed > D;
            }
            const t = (x - e.x) / e.vx,
              y = e.y + e.vy * Math.min(t, D);
            if (Math.min(e.y, y) <= 2 || Math.max(e.y, y) >= 34) return false;
            if (t > D) return true;
            const wall = e.x < x ? right : left;
            return y > 0.5 + 8.84 * t + 4 && (2 * Math.abs(x - wall)) / speed > D - t;
          });
        },
      },
      { id: 'goal-column-down-capture', direction: 'down', done: () => run.status === 'won' },
    ],
    'long-way-home': [
      {
        id: 'west-left-capture',
        direction: 'left',
        done: () => safe() && run.player.x <= 1.000001,
      },
      { id: 'left-outer-edge', direction: 'left', done: () => safe() && run.player.x <= 0.500001 },
      {
        id: 'left-shore-top-edge',
        direction: 'up',
        done: () => safe() && run.player.y <= 0.500001,
      },
      { id: 'top-north-column', direction: 'right', done: () => safe() && run.player.x >= 34.5 },
      { id: 'north-top-capture', direction: 'down', done: () => safe() && run.player.y >= 7 },
      { id: 'north-south-capture', direction: 'down', done: () => safe() && run.player.y >= 26 },
      { id: 'south-bottom-capture', direction: 'down', done: () => safe() && run.player.y >= 35 },
      {
        id: 'bottom-outer-edge',
        direction: 'down',
        done: () => safe() && run.player.y >= 35.499999,
      },
      { id: 'bottom-west-column', direction: 'left', done: () => safe() && run.player.x <= 13.0 },
      { id: 'west-bottom-capture', direction: 'up', done: () => safe() && run.player.y <= 21 },
      {
        id: 'west-top-corridor-clear',
        direction: null,
        done: () => {
          const e = run.enemies.find((e) => e.id === 'north');
          if (!safe() || run.player.speed !== 0) return false;
          if (e.vx >= 0 || e.x <= run.player.x) return true;
          const t = (run.player.x - e.x) / e.vx,
            y = e.y + e.vy * t;
          return (
            t > (run.player.y - 1) / 8.84 + 0.15 ||
            y < 1 ||
            y > 14 ||
            y < run.player.y - 8.84 * t - 4
          );
        },
      },
      { id: 'west-top-capture', direction: 'up', done: () => safe() && run.player.y <= 1.000001 },
      { id: 'top-outer-edge', direction: 'up', done: () => safe() && run.player.y <= 0.500001 },
      { id: 'top-east-column', direction: 'right', done: () => safe() && run.player.x >= 56.5 },
      { id: 'east-top-capture', direction: 'down', done: () => safe() && run.player.y >= 14 },
      {
        id: 'east-bottom-corridor-clear',
        direction: null,
        done: () => {
          const e = run.enemies.find((e) => e.id === 'south');
          return safe() && run.player.speed === 0 && e.y <= 17 && e.vy < 0;
        },
      },
      { id: 'east-bottom-capture', direction: 'down', done: () => safe() && run.player.y >= 35 },
      {
        id: 'bottom-outer-edge-again',
        direction: 'down',
        done: () => safe() && run.player.y >= 35.499999,
      },
      { id: 'bottom-left-edge', direction: 'left', done: () => safe() && run.player.x <= 0.500001 },
      { id: 'left-middle-row', direction: 'up', done: () => safe() && run.player.y <= 18.0 },
      {
        id: 'left-stop-north-crossed-down',
        direction: 'left',
        done: () => {
          const e = run.enemies.find((e) => e.id === 'north');
          return (
            safe() &&
            run.player.x <= 0.500001 &&
            e.y >= run.player.y + 1 &&
            e.y <= run.player.y + 3 &&
            e.vy > 0
          );
        },
      },
      { id: 'middle-right-capture', direction: 'right', done: () => safe() && run.player.x >= 34 },
      { id: 'middle-right-fresh-capture', direction: 'right', done: () => run.status === 'won' },
    ],
  };
  routes['two-bays'] = [
    {
      id: 'spawn-row-right-capture',
      direction: 'right',
      done: () => safe() && captures.length >= 1,
    },
    { id: 'right-shore-top-edge', direction: 'up', done: () => safe() && run.player.y <= 0.500001 },
    { id: 'top-quarter-column', direction: 'left', done: () => safe() && run.player.x <= 53.5 },
    {
      id: 'right-quarter-down-capture',
      direction: 'down',
      done: () => safe() && captures.length >= 2,
    },
    {
      id: 'west-crossed-up-ahead',
      direction: null,
      done: () => {
        const e = run.enemies.find((e) => e.id === 'west');
        return (
          safe() &&
          run.player.speed === 0 &&
          e.x >= 20 &&
          e.x <= 32 &&
          e.y >= 15 &&
          e.y <= 16.5 &&
          e.vx < 0 &&
          e.vy < 0
        );
      },
    },
    { id: 'middle-left-capture', direction: 'left', done: () => safe() && captures.length >= 3 },
    {
      id: 'left-shore-bottom-landing',
      direction: 'down',
      done: () => safe() && run.player.y >= 35,
    },
    { id: 'bottom-quarter-column', direction: 'right', done: () => safe() && run.player.x >= 17.5 },
    { id: 'left-quarter-up-capture', direction: 'up', done: () => run.status === 'won' },
  ];
  return routes;
}

// Each entry is exactly one awaited public keyboard operation. There is no synthetic
// round trip when no key changes, and key release does not clear continuous intent.
export function geometricKeyOperations(previous, direction) {
  const operations = [];
  if (direction && previous === direction) operations.push({ type: 'keyup', direction: previous });
  if (direction) operations.push({ type: 'keydown', direction });
  if (previous && previous !== direction) operations.push({ type: 'keyup', direction: previous });
  return operations;
}

// Serialized into the existing Phaser-owner observer only for the exact protocol.
// Reads retained render/run facts; never advances the game or clears input.
export function createNextRouteReader(getGame, environment) {
  let game,
    scene,
    run,
    previousRun,
    failed = false;
  function require(condition, reason) {
    if (!condition) {
      failed = true;
      throw new Error(reason);
    }
  }
  return (mission, begin = false) => {
    require(!failed, 'Next route reader previously invalidated');
    const currentGame = getGame();
    const scenes = currentGame?.scene?.scenes;
    require(Array.isArray(scenes) && scenes.length <= 64, 'Bounded scene owner unavailable');
    const painted = scenes.filter((value) => value?.lastPaint?.run);
    require(painted.length === 1, 'Unique submitted scene required');
    const currentScene = painted[0],
      currentRun = currentScene.lastPaint.run;
    require(currentScene.submittedRun === currentRun, 'Submitted run identity mismatch');
    if (begin) {
      require(currentRun !== previousRun, 'Manual Next did not replace run');
      require(!game || currentGame === game, 'Game owner replaced');
      require(!scene || currentScene === scene, 'Scene owner replaced across Next');
      game = currentGame;
      scene = currentScene;
      run = currentRun;
      previousRun = currentRun;
    }
    require(currentGame === game &&
      currentScene === scene &&
      currentRun === run, 'Route owner replaced');
    require(run.level?.id === mission, 'Wrong authored mission');
    require(Array.isArray(run.enemies) && run.enemies.length <= 3, 'Enemy owner bound exceeded');
    require(Array.isArray(run.trail) && run.trail.length <= 2592, 'Trail bound exceeded');
    const value = {
      phase: environment.document.body?.dataset.flightState,
      autoNext: environment.document.querySelector('#settings-autoNext')?.checked,
      mission: run.level.id,
      status: run.status,
      tick: run.tick,
      lives: run.lives,
      claimedCount: run.claimedCount,
      trail: { length: run.trail.length },
      player: { x: run.player.x, y: run.player.y, speed: run.player.speed },
      enemies: run.enemies.map((enemy) => ({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        vx: enemy.vx ?? null,
        vy: enemy.vy ?? null,
      })),
    };
    if (begin) {
      value.level = run.level;
      value.options = { seed: run.seed, classId: run.classId, turnPolicy: run.turnPolicy };
    }
    return value;
  };
}

export function validateNextRouteAction(action) {
  assert.deepEqual(Object.keys(action).sort(), ['mission', 'protocol', 'timeoutMs', 'type']);
  assert.equal(action.type, 'authored-next-route');
  assert.equal(action.protocol, NEXT_ROUTE_PROTOCOL);
  assert(NEXT_ROUTE_IDENTITIES.some((x) => x.id === action.mission));
  assert.equal(action.timeoutMs, NEXT_ROUTE_LIMITS.missionMs);
  return action;
}

export function nextRouteIdentity(snapshot, mission) {
  const expected = NEXT_ROUTE_IDENTITIES.find((x) => x.id === mission);
  assert(expected);
  assert.equal(snapshot.mission, mission);
  assert.equal(snapshot.enemies?.length, expected.enemyCount);
  assert.deepEqual(snapshot.options, expected.options);
  const bytes = JSON.stringify(snapshot.level);
  assert(bytes.length <= 16384);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.levelSHA256);
  return expected;
}

/** Every command is trusted Playwright keyboard input. A timed-out native call
 * stays failed/unsettled; the enclosing browser owner supplies final cleanup. */
export async function executeNextRoute({
  action,
  read,
  keyboard,
  wait,
  now = () => performance.now(),
  deadline,
  record,
}) {
  validateNextRouteAction(action);
  const limits = NEXT_ROUTE_LIMITS,
    start = now();
  assert(Number.isFinite(start) && start >= 0 && Number.isFinite(deadline));
  const end = Math.min(deadline, start + limits.missionMs);
  let lastNow = start,
    physical = null,
    claimed = null,
    run = null,
    unsettled = 0,
    lastReadAt = start;
  const held = new Set(),
    captures = [];
  Object.assign(record, {
    protocol: NEXT_ROUTE_PROTOCOL,
    mission: action.mission,
    scope: 'Bounded public-input transition/resource workload; excluded from timing qualification.',
    reads: 0,
    events: [],
    stages: [],
    status: 'running',
    unsettled: 0,
  });
  const clock = () => {
    const value = now();
    assert(Number.isFinite(value) && value >= lastNow, 'Invalid monotonic route clock');
    lastNow = value;
    return value;
  };
  async function bounded(work, until, label) {
    assert(clock() < until, `${label} deadline elapsed before invocation`);
    let timer;
    unsettled++;
    record.unsettled = unsettled;
    const pending = Promise.resolve().then(() => {
      assert(clock() < until, `${label} deadline elapsed before native call`);
      return work();
    });
    const handled = pending.then(
      (value) => {
        unsettled--;
        record.unsettled = unsettled;
        return value;
      },
      (error) => {
        unsettled--;
        record.unsettled = unsettled;
        throw error;
      },
    );
    try {
      const value = await Promise.race([
        handled,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`${label} deadline exceeded`)),
            Math.max(1, until - clock()),
          );
        }),
      ]);
      assert(clock() <= until, `${label} settled after deadline`);
      return value;
    } finally {
      clearTimeout(timer);
    }
  }
  function valid(value) {
    assert(value && value.mission === action.mission);
    assert.equal(value.autoNext, false, 'Public Auto Next must stay disabled');
    assert.equal(value.lives, 3, 'Route lost a life');
    assert(['running', 'won'].includes(value.status), 'Unexpected route status');
    assert(
      value.status === 'won'
        ? ['running', 'picture', 'result'].includes(value.phase)
        : value.phase === 'running',
      'Route is not actively playing',
    );
    for (const key of ['tick', 'claimedCount'])
      assert(Number.isSafeInteger(value[key]) && value[key] >= 0);
    assert(
      value.claimedCount <= 2592 &&
        Number.isSafeInteger(value.trail?.length) &&
        value.trail.length >= 0 &&
        value.trail.length <= 2592,
    );
    for (const key of ['x', 'y', 'speed']) assert(Number.isFinite(value.player?.[key]));
    assert(
      value.player.x >= 0 &&
        value.player.x <= 72 &&
        value.player.y >= 0 &&
        value.player.y <= 36 &&
        value.player.speed >= 0 &&
        value.player.speed <= 20,
    );
    assert(Array.isArray(value.enemies) && value.enemies.length <= 3);
    for (const enemy of value.enemies) {
      assert(typeof enemy.id === 'string' && enemy.id.length <= 64);
      for (const key of ['x', 'y']) assert(Number.isFinite(enemy[key]));
      for (const key of ['vx', 'vy']) assert(enemy[key] === null || Number.isFinite(enemy[key]));
    }
    if (run)
      assert(
        value.tick >= run.tick && value.claimedCount >= run.claimedCount,
        'Route state regressed',
      );
  }
  async function observe(begin = false, until = end) {
    assert(++record.reads <= limits.reads, 'Route read capacity exceeded');
    lastReadAt = clock();
    const value = await bounded(
      () => read(action.mission, begin),
      Math.min(end, until, lastReadAt + limits.operationMs),
      'rendered-state read',
    );
    valid(value);
    if (begin) {
      nextRouteIdentity(value, action.mission);
      assert(value.tick <= 12, 'Initial route observation exceeded modeled 100 ms envelope');
      delete value.level;
      delete value.options;
      record.initial = value;
    }
    if (claimed !== null && value.claimedCount > claimed) {
      assert(captures.length < 32);
      captures.push({ x: value.player.x, y: value.player.y });
    }
    claimed = value.claimedCount;
    run = value;
    return value;
  }
  async function operation(type, direction, until) {
    assert(record.events.length < limits.events, 'Route event capacity exceeded');
    const key = 'Arrow' + direction[0].toUpperCase() + direction.slice(1);
    const event = { type, key, startedAtMs: clock() - start, status: 'not-invoked' };
    record.events.push(event);
    await bounded(
      () => {
        if (type === 'keydown') held.add(direction);
        event.status = 'invoked';
        return keyboard[type === 'keydown' ? 'down' : 'up'](key);
      },
      Math.min(end, until),
      'keyboard operation',
    );
    if (type === 'keyup') held.delete(direction);
    event.status = 'settled';
    event.completedAtMs = clock() - start;
  }
  async function waitFor(ms, until = end) {
    assert(Number.isFinite(ms) && ms >= 0);
    await bounded(() => wait(ms), Math.min(end, until), 'route wait');
  }
  try {
    await observe(true);
    const expected = NEXT_ROUTE_IDENTITIES.find((x) => x.id === action.mission);
    if (expected.timed) {
      for (const item of expected.timed) {
        if (run.status === 'won') break;
        assert(record.stages.length < limits.stages);
        const stage = { action: item, atMs: clock() - start, before: run };
        record.stages.push(stage);
        if (item.type === 'key') {
          const direction = item.key.slice(5).toLowerCase();
          await operation('keydown', direction, clock() + limits.operationMs);
          await waitFor(item.ms);
          await operation('keyup', direction, clock() + limits.operationMs);
        } else await waitFor(item.ms);
        await observe();
        stage.after = run;
      }
      while (run.status !== 'won') {
        await waitFor(limits.pollMs);
        await observe();
      }
    } else {
      // Closures capture this local view. It is updated only from readback.
      const view = {};
      Object.assign(view, run);
      const stages = geometricRoutes({ run: view, captures })[action.mission];
      assert(stages);
      for (const spec of stages) {
        if (run.status === 'won') break;
        assert(record.stages.length < limits.stages);
        const stage = { id: spec.id, atMs: clock() - start, before: run };
        record.stages.push(stage);
        const stageEnd = Math.min(end, clock() + limits.stageMs);
        let first = true;
        for (const item of geometricKeyOperations(physical, spec.direction)) {
          await operation(
            item.type,
            item.direction,
            Math.min(stageEnd, (first ? lastReadAt : clock()) + limits.operationMs),
          );
          first = false;
        }
        physical = spec.direction;
        // No new stage may observe while an ordered key release remains pending.
        for (;;) {
          await observe(false, stageEnd);
          Object.assign(view, run);
          if (run.status === 'won' || spec.done()) break;
          await waitFor(limits.pollMs, stageEnd);
        }
        stage.after = run;
        stage.completedAtMs = clock() - start;
      }
    }
    assert.equal(run.status, 'won', 'Authored route did not win');
    record.final = run;
    record.status = 'passed-public-route';
  } catch (error) {
    record.status = 'failed';
    record.failure = String(error?.message ?? error).slice(0, 512);
    throw error;
  } finally {
    // No recovery command may race an unsettled command. Browser closure remains
    // responsible after a timeout; this never converts failure to success.
    if (unsettled === 0)
      for (const direction of [...held])
        try {
          await operation('keyup', direction, Math.min(end, clock() + limits.operationMs));
        } catch (error) {
          record.status = 'failed';
          record.cleanupFailure = String(error?.message ?? error).slice(0, 512);
          break;
        }
    record.heldKeys = [...held];
    record.unsettled = unsettled;
    record.elapsedMs = clock() - start;
    if (record.heldKeys.length || record.unsettled) record.status = 'failed';
    assert(
      Buffer.byteLength(JSON.stringify(record)) <= limits.evidenceBytes,
      'Route evidence capacity exceeded',
    );
  }
  assert.equal(record.status, 'passed-public-route', 'Route cleanup did not settle');
  return record;
}

export const NEXT_ROUTE_FIXTURE = Object.freeze({
  bytes: 9086,
  sha256: '0fd24c7db64be144da0d05b57ae26289b2a676a4f90df547d918c6cc13cef1a8',
});
export const FIRST_VICTORY_CPU_FIXTURE = Object.freeze({
  bytes: 3527,
  sha256: '561510be9786c949f65e6fcf0c0352e7e892c710ec80958e7139040e3911caa1',
});
export const FIRST_VICTORY_239_CPU_FIXTURE = Object.freeze({
  bytes: 3524,
  sha256: '328ae1964a398623c9dd1b71ff14c91e3dbb4156670558bcf381306334e9cf4c',
});
export const FIRST_VICTORY_DE332_CPU_FIXTURE = Object.freeze({
  bytes: 3545,
  sha256: 'b1f50b274862dbe09237011e40f5fced6042095e745f488c44d72933906ef5ba',
});
export function qualificationNextRouteOptions(flags, scenario, bytes) {
  const selected = flags.filter((value) => value.startsWith('--authored-next-route'));
  const declared =
    scenario.nativeRouteProtocol !== undefined || scenario.nativeRouteCpuProfile !== undefined;
  if (!declared) {
    assert.equal(selected.length, 0, 'Next route flag requires exact recipe');
    assert(
      !scenario.actions.some((action) => action.type === 'authored-next-route'),
      'Next operation requires exact recipe',
    );
    return null;
  }
  assert.deepEqual(selected, [`--authored-next-route=${NEXT_ROUTE_PROTOCOL}`]);
  assert.equal(scenario.nativeRouteProtocol, NEXT_ROUTE_PROTOCOL);
  if (scenario.nativeRouteCpuProfile !== undefined) {
    const current = scenario.nativeRouteCpuProfile === 'first-victory-239-v1';
    const de332 = scenario.nativeRouteCpuProfile === 'first-victory-de332-v1';
    assert(
      ['first-victory-e1cc-v1', 'first-victory-239-v1', 'first-victory-de332-v1'].includes(
        scenario.nativeRouteCpuProfile,
      ),
    );
    const profileSource = de332
      ? NEXT_ROUTE_DE332_SOURCE
      : current
        ? '239c574ecddd5bb6d5896e621d9edc53e7f6a313'
        : NEXT_ROUTE_FINAL_SOURCE;
    const profileFixture = de332
      ? FIRST_VICTORY_DE332_CPU_FIXTURE
      : current
        ? FIRST_VICTORY_239_CPU_FIXTURE
        : FIRST_VICTORY_CPU_FIXTURE;
    assert.equal(scenario.kind, 'performance');
    assert.equal(scenario.timeoutMs, 240000);
    assert.equal(scenario.requiredProfile, 'cpu');
    assert.equal(bytes.length, profileFixture.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), profileFixture.sha256);
    assert.deepEqual(scenario, JSON.parse(bytes), 'Profile recipe differs from admitted bytes');
    for (const [name, value] of [
      ['source-revision', profileSource],
      ['cpu', de332 ? '3.88' : '2.42'],
      ['browser', 'chromium'],
      ['cadence', 'settled120'],
    ])
      assert.deepEqual(
        flags.filter((flag) => flag === `--${name}` || flag.startsWith(`--${name}=`)),
        [`--${name}=${value}`],
      );
    for (const flag of ['--cpu-profile', '--work-probe', '--hitch-journal'])
      assert.deepEqual(
        flags.filter((value) => value.startsWith(flag)),
        [flag],
      );
    assert(
      !flags.some((value) =>
        /^--(?:baseline-runtime|memory-profile|audio-proof|journal-cost-probe|readiness-probe|readiness-geometry)(?:=|$)/.test(
          value,
        ),
      ),
      'CPU route cannot share another observation mode',
    );
    const actions = scenario.actions.filter((action) => action.type === 'authored-next-route');
    assert.deepEqual(
      actions.map((action) => validateNextRouteAction(action).mission),
      ['first-return'],
    );
    return { protocol: NEXT_ROUTE_PROTOCOL, sourceRevision: profileSource };
  }
  assert.equal(scenario.kind, 'lifecycle');
  assert.equal(scenario.timeoutMs, 1200000);
  assert.equal(bytes.length, NEXT_ROUTE_FIXTURE.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), NEXT_ROUTE_FIXTURE.sha256);
  const sourceFlags = flags.filter((value) => value.startsWith('--source-revision'));
  assert.equal(sourceFlags.length, 1, 'Exactly one admitted source required');
  const sourceRevision = sourceFlags[0].slice('--source-revision='.length);
  assert(nextRouteSources.includes(sourceRevision), 'Unreviewed authored-route source');
  assert.equal(sourceFlags[0], '--source-revision=' + sourceRevision);
  for (const value of ['--work-probe', '--hitch-journal', '--cadence=settled120'])
    assert(flags.includes(value), `Required ${value}`);
  assert(
    !flags.some((value) =>
      /^--(?:baseline-runtime|cpu-profile|memory-profile|audio-proof|journal-cost-probe|readiness-probe)(?:=|$)/.test(
        value,
      ),
    ),
    'Next route evidence cannot share another observation mode',
  );
  const actions = scenario.actions.filter((action) => action.type === 'authored-next-route');
  assert.deepEqual(
    actions.map((action) => validateNextRouteAction(action).mission),
    NEXT_ROUTE_IDENTITIES.map((row) => row.id),
  );
  return { protocol: NEXT_ROUTE_PROTOCOL, sourceRevision };
}
