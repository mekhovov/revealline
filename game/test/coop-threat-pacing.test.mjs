import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { updateThreatClocks, nextThreatDeadline } from '../coop/threats.mjs';

const hard = {
  hunterWakeStep: 0.45,
  hunterRecovery: 1.2,
  hunterRange: 28,
  hunterAttackSpeed: 11,
  hunterCommitMax: 2.4,
  emitterCooldown: 3,
};
const hunter = (id, x, y = 14.5, vx = 0) => ({ id, type: 'hunter', x, y, vx, vy: 0, radius: 0.2 });
const neutral = () => [
  { direction: null, boost: false, support: false },
  { direction: null, boost: false, support: false },
];
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

function fixture({
  enemies = [hunter('left', 30.5), hunter('right', 31.5)],
  encounter = hard,
  difficulty = 'standard',
  strongholds = [],
  safeRects = [],
} = {}) {
  return startCoop(
    createCoop(
      {
        version: 'revealline-coop-level.v1',
        id: 'authored-pressure',
        revision: 1,
        name: 'Authored pressure test',
        width: 72,
        height: 36,
        spawns: [
          { x: 26.5, y: 0.5 },
          { x: 40.5, y: 0.5 },
        ],
        enemies,
        encounter,
        strongholds,
        safeRects,
        goal: { coverage: 0.99 },
      },
      { difficulty },
    ),
  );
}
function expose(run, player, x, last = 10) {
  const trail = Array.from({ length: last }, (_, y) => ({ x, y: y + 1, index: (y + 1) * 72 + x }));
  Object.assign(run.players[player], {
    x: x + 0.5,
    y: last + 0.5,
    cellIndex: last * 72 + x,
    trail,
    cutting: true,
    safeAnchor: { x: x + 0.5, y: 0.5 },
    departureIndex: x,
    direction: null,
    blockedDirection: null,
  });
}
const emit = (run, type, data) => run.events.push({ type, time: run.time, ...data });
function advanceClock(run, time) {
  run.time = time;
  updateThreatClocks(run, emit);
}
function exposePair(run) {
  expose(run, 0, 26);
  expose(run, 1, 40);
}

test('authored Hunter starts are staggered by position and independent of enemy array order', () => {
  const run = fixture({
    enemies: [hunter('a-right', 50.5), hunter('z-left', 20.5), hunter('middle', 35.5)],
  });
  const ordered = run.enemies.slice().sort((a, b) => a.x - b.x);
  ordered.forEach((enemy, index) => near(enemy.phaseUntil, 0.5 + index * 0.45));
  const retry = fixture({
    enemies: [hunter('middle', 35.5), hunter('z-left', 20.5), hunter('a-right', 50.5)],
  });
  assert.deepEqual(retry.enemies, run.enemies);
});

test('a second Hunter pressures the other eligible player instead of piling onto the nearest trail', () => {
  const run = fixture();
  exposePair(run);
  advanceClock(run, 0.5);
  assert.equal(run.enemies.find((enemy) => enemy.id === 'left').target, 0);
  advanceClock(run, 0.95);
  assert.equal(run.enemies.find((enemy) => enemy.id === 'right').target, 1);
  assert.equal(run.enemies.filter((enemy) => enemy.phase === 'warning').length, 2);
});

test('emitter warnings and travelling impacts count when allocating fresh Hunter pressure', () => {
  const run = fixture({
    enemies: [hunter('hunter', 30.5)],
    strongholds: [
      {
        id: 'relay',
        core: { x: 35.5, y: 20.5 },
        anchors: [
          { x: 20.5, y: 20.5 },
          { x: 50.5, y: 20.5 },
        ],
      },
    ],
  });
  exposePair(run);
  Object.assign(run.strongholds[0].emitter, { phase: 'warning', phaseUntil: 9, target: 0 });
  advanceClock(run, 0.5);
  assert.equal(run.enemies[0].target, 1);
  const other = fixture({ enemies: [hunter('hunter', 30.5)] });
  exposePair(other);
  other.impacts.push({ id: 'live', player: 0 });
  advanceClock(other, 0.5);
  assert.equal(other.enemies[0].target, 1);
});

test('pressure allocation cannot override a warning lock or a committed point', () => {
  const run = fixture();
  exposePair(run);
  advanceClock(run, 0.5);
  const enemy = run.enemies.find((actor) => actor.id === 'left');
  const locked = structuredClone(enemy.targetPoint);
  expose(run, 0, 50);
  expose(run, 1, 29);
  advanceClock(run, 0.95);
  advanceClock(run, 1.7);
  assert.equal(enemy.phase, 'commit');
  assert.equal(enemy.target, 0);
  assert.deepEqual(enemy.targetPoint, locked);
  assert.ok(enemy.vx < 0);
});

test('Hunter attack speed is independent of patrol speed and can reach the authored distant point', () => {
  const run = fixture({ enemies: [hunter('hunter', 50.5, 10.5, 0.5)] });
  expose(run, 0, 30);
  advanceClock(run, 0.5);
  const enemy = run.enemies[0];
  assert.equal(enemy.phase, 'warning');
  advanceClock(run, 1.7);
  assert.equal(enemy.phase, 'commit');
  near(Math.hypot(enemy.vx, enemy.vy), 11);
  near(enemy.phaseUntil - run.time, 20 / 11);
  near((enemy.phaseUntil - run.time) * Math.hypot(enemy.vx, enemy.vy), 20);
});

test('Hunters do not warn at targets beyond their travel budget or through secured territory', () => {
  const short = fixture({
    enemies: [hunter('hunter', 50.5, 10.5)],
    encounter: { ...hard, hunterAttackSpeed: 6, hunterCommitMax: 0.8 },
  });
  expose(short, 0, 30);
  advanceClock(short, 0.5);
  assert.equal(short.enemies[0].phase, 'patrol');
  assert.ok(short.enemies[0].phaseUntil > short.time);
  const blocked = fixture({
    enemies: [hunter('hunter', 50.5, 10.5)],
    safeRects: [{ x: 40, y: 1, w: 1, h: 34 }],
  });
  expose(blocked, 0, 30);
  advanceClock(blocked, 0.5);
  assert.equal(blocked.enemies[0].phase, 'patrol');
});

test('downed and recovering players are excluded without retargeting an existing warning', () => {
  const run = fixture();
  exposePair(run);
  run.players[0].graceUntil = 2;
  advanceClock(run, 0.5);
  const first = run.enemies.find((enemy) => enemy.id === 'left');
  assert.equal(first.target, 1);
  Object.assign(run.players[1], { status: 'downed', cutting: false });
  advanceClock(run, 0.95);
  assert.equal(run.enemies.find((enemy) => enemy.id === 'right').phase, 'patrol');
  advanceClock(run, 1.7);
  assert.equal(first.phase, 'recovery');
  assert.equal(first.target, 1);
  near(first.phaseUntil - run.time, 1.2);
});

test('authored emitter pressure keeps its visible warning and a full rest between launches', () => {
  const run = fixture({
    enemies: [hunter('distant', 65.5, 30.5)],
    strongholds: [
      {
        id: 'relay',
        core: { x: 35.5, y: 12.5 },
        anchors: [
          { x: 20.5, y: 20.5 },
          { x: 50.5, y: 20.5 },
        ],
      },
    ],
  });
  exposePair(run);
  const emitter = run.strongholds[0].emitter;
  advanceClock(run, 0.5);
  assert.equal(emitter.phase, 'warning');
  const target = emitter.target;
  const point = structuredClone(emitter.targetPoint);
  advanceClock(run, 1.49);
  assert.equal(run.impacts.length, 0);
  assert.equal(emitter.target, target);
  assert.deepEqual(emitter.targetPoint, point);
  advanceClock(run, 1.5);
  assert.equal(run.impacts.length, 1);
  assert.equal(emitter.phase, 'cooldown');
  near(emitter.phaseUntil, 4.5);
  advanceClock(run, 4.49);
  assert.equal(emitter.phase, 'cooldown');
  advanceClock(run, 4.5);
  assert.equal(emitter.phase, 'warning');
  assert.equal(
    emitter.target,
    1 - target,
    'the next lock should avoid the player whose spark is still travelling',
  );
});

for (const [difficulty, cap] of [
  ['gentle', 1],
  ['standard', 2],
  ['expert', 3],
]) {
  test(`${difficulty} Hunter budget makes progress without synchronized dogpiles or deadline deadlocks`, () => {
    const run = fixture({
      difficulty,
      enemies: [
        hunter('one', 29.5),
        hunter('two', 31.5),
        hunter('three', 34.5),
        hunter('four', 37.5),
      ],
    });
    exposePair(run);
    let transitions = 0;
    while (run.time < 100) {
      const next = nextThreatDeadline(run);
      assert.ok(
        Number.isFinite(next) && next > run.time,
        'every waiting actor must have a future deadline',
      );
      advanceClock(run, next);
      assert.ok(
        run.enemies.filter((enemy) => ['warning', 'commit'].includes(enemy.phase)).length <= cap,
      );
      assert.ok(++transitions < 3000, 'a bounded timeline must make progress');
    }
    for (const enemy of run.enemies) {
      const warnings = run.events.filter(
        (event) => event.type === 'enemy.warning' && event.enemy === enemy.id,
      );
      assert.ok(warnings.length >= 3, `${enemy.id} must receive repeated attack opportunities`);
      const attacks = run.events.filter((event) => event.enemy === enemy.id);
      for (let index = 0; index < attacks.length; index++) {
        if (attacks[index].type === 'enemy.commit')
          assert.equal(attacks[index - 1]?.type, 'enemy.warning');
        if (attacks[index].type === 'enemy.warning' && index > 0)
          assert.ok(attacks[index].time >= attacks[index - 1].time + hard.hunterRecovery - 1e-8);
      }
    }
  });
}

test('seat swaps preserve authored threat behavior in the real fixed-step simulation', () => {
  const a = fixture(),
    b = fixture();
  exposePair(a);
  exposePair(b);
  b.players.reverse();
  b.players.forEach((player, id) => {
    player.id = id;
  });
  const changeSeat = (id) => (Number.isInteger(id) ? 1 - id : id);
  const eventTargets = (event) => ({
    ...event,
    ...(Object.hasOwn(event, 'target') ? { target: changeSeat(event.target) } : {}),
    ...(Object.hasOwn(event, 'player') ? { player: changeSeat(event.player) } : {}),
  });
  for (let tick = 0; tick < 600; tick++) {
    stepCoop(a, neutral());
    stepCoop(b, neutral());
    assert.deepEqual(
      b.enemies.map((enemy) => ({ ...enemy, target: changeSeat(enemy.target) })),
      a.enemies,
    );
    assert.deepEqual(
      b.events.map(eventTargets).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))),
      a.events.slice().sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))),
    );
    assert.deepEqual(b.cells, a.cells);
    assert.equal(b.team.reserves, a.team.reserves);
  }
});
