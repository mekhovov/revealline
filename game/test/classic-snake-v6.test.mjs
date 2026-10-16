import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import { makeClassicSnakeV6 } from '../snake/classic-core-v6.mjs';
import {
  createClassicSnake,
  stepClassicSnake,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
  validateClassicSnakeLevel,
} from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import { classicVisualSnapshot } from '../snake/classic-recent-replay.mjs';
import { CLASSIC_PACES, prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
const route = Array.from({ length: 8 }, (_, i) => ({ x: 8 + i, y: 8 }));
function recipe(kind = 'runner') {
  const level = structuredClone(CLASSIC_SNAKE_V4_LEVELS[0].level);
  Object.assign(level, { walls: [], wrap: true, goal: 4, revision: 'tactical-test' });
  const policy = { kind, every: 3 };
  if (['refuge', 'switchback', 'pair'].includes(kind)) policy.goals = [route[0], route.at(-1)];
  if (['jammer', 'guard'].includes(kind)) policy.at = route[0];
  if (kind === 'jammer') policy.signalProfile = 'broadcast-burst-v1';
  if (kind === 'guard') policy.heading = 'right';
  level.targets = { maxActive: kind === 'pair' ? 2 : 1, required: [policy], bonus: null };
  return makeClassicSnakeV6(level, { tactics: [{ policyIndex: 0, route }] });
}
const runFor = (kind, mode = 'solo') =>
  createClassicSnake(recipe(kind), { mode, ...(kind === 'jammer' ? { hazardSeed: 71 } : {}) });
function advance(run, ticks) {
  for (let i = 0; i < ticks; i++) {
    stepClassicSnake(run);
    assert.equal(run.status, 'running');
  }
}

test('v6 validates adjacency, uniqueness, family, source anchoring and sealed fields', () => {
  const level = recipe();
  assert.deepEqual(validateClassicSnakeLevel(level), level);
  for (const mutate of [
    (l) => l.tactics[0].route.push({ x: 22, y: 8 }),
    (l) => l.tactics[0].route.push(l.tactics[0].route[0]),
    (l) => l.tactics.push(l.tactics[0]),
    (l) => {
      l.tactics[0].futureTurns = [];
    },
    (l) => {
      l.targets.required[0].kind = 'still';
    },
    (l) => {
      l.tactics[0].route[0].x = -1;
    },
  ]) {
    const invalid = structuredClone(level);
    mutate(invalid);
    assert.throws(() => validateClassicSnakeLevel(invalid));
  }
  const source = recipe('jammer');
  source.targets.required[0].at = { x: 20, y: 8 };
  assert.throws(() => validateClassicSnakeLevel(source));
});

test('all tactical families move by adjacent route cells and preserve exact replay', () => {
  for (const kind of [
    'runner',
    'refuge',
    'switchback',
    'pair',
    'sprinter',
    'shield',
    'jammer',
    'guard',
  ]) {
    const run = runFor(kind);
    for (let i = 0; i < 100; i++) {
      const before = new Map(run.targets.map((t) => [t.id, { x: t.x, y: t.y }]));
      advance(run, 1);
      for (const target of run.targets) {
        assert.ok(
          route.some((at) => at.x === target.x && at.y === target.y),
          kind,
        );
        const old = before.get(target.id);
        if (old) assert.ok(Math.abs(old.x - target.x) + Math.abs(old.y - target.y) <= 1, kind);
      }
    }
    assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run, kind);
    const altered = exportClassicSnakeReplay(run);
    altered.level.tactics[0].route.pop();
    assert.throws(() => restoreClassicSnakeReplay(altered));
  }
});

test('committed destinations ignore changing heads and unused queued inputs', () => {
  const run = runFor('runner');
  advance(run, 10);
  const target = run.targets[0],
    endpoint = target.tactical.end;
  assert.equal(target.tactical.phase, 'travel');
  run.snakes[0].body = [0, 1, 2, 3].map((i) => ({ x: route[endpoint].x - i, y: 6 }));
  advance(run, 1);
  assert.equal(target.tactical.end, endpoint);
  const a = runFor('runner'),
    b = structuredClone(a);
  a.snakes[0].turns = ['right'];
  b.snakes[0].turns = ['right', 'down'];
  advance(a, 1);
  advance(b, 1);
  assert.deepEqual(a.targets, b.targets);
});

test('all supported paces give tactical preparation at least 800 ms', () => {
  for (const pace of Object.keys(CLASSIC_PACES)) {
    const run = createClassicSnake(
      prepareClassicSnakeLevel({ level: recipe('sprinter') }, { pace }),
    );
    let warnedAt = null,
      movedAt = null;
    for (let i = 0; i < 40 && movedAt === null; i++) {
      advance(run, 1);
      if (run.events.some((e) => e.type === 'target.warning')) warnedAt = run.elapsedMs;
      if (run.events.some((e) => e.type === 'target.moved')) movedAt = run.elapsedMs;
    }
    assert.ok(movedAt - warnedAt >= 800, `${pace}: ${movedAt - warnedAt}`);
  }
});

test('congestion waits without teleporting or reversing the commitment', () => {
  const run = runFor('runner');
  advance(run, 9);
  const actor = run.targets[0],
    state = actor.tactical;
  const next = route[state.index + Math.sign(state.end - state.index)],
    old = { x: actor.x, y: actor.y },
    end = state.end;
  run.pickup = { ...next, bornTick: 0, kind: 'pulse' };
  advance(run, 6);
  assert.deepEqual({ x: actor.x, y: actor.y }, old);
  assert.equal(state.end, end);
  assert.ok(actor.blockedTicks > 0);
});

test('mobile sources reach stations during recovery and freeze under Pulse', () => {
  for (const kind of ['jammer', 'guard']) {
    const run = runFor(kind);
    let moves = 0;
    for (let i = 0; i < 100; i++) {
      const phase = run.targets[0].phase;
      advance(run, 1);
      if (run.events.some((e) => e.type === 'target.moved')) {
        assert.equal(phase, 'rest');
        moves++;
      }
      if (run.targets[0].phase === 'warning')
        assert.ok([0, route.length - 1].includes(run.targets[0].tactical.index));
    }
    assert.ok(moves > 0, kind);
    run.pulseTicks = 5;
    const prior = structuredClone(run.targets[0].tactical),
      position = { x: run.targets[0].x, y: run.targets[0].y };
    advance(run, 4);
    assert.deepEqual(run.targets[0].tactical, prior);
    assert.deepEqual({ x: run.targets[0].x, y: run.targets[0].y }, position);
  }
});

test('Team, independent Mission Race boards and compact snapshots retain tactical state', () => {
  const team = runFor('runner', 'team');
  advance(team, 35);
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(team)), team);
  const snapshot = classicVisualSnapshot(team);
  assert.deepEqual(snapshot.targets[0].tactical, team.targets[0].tactical);
  assert.notEqual(snapshot.targets[0].tactical, team.targets[0].tactical);
  const match = createClassicSnakeMatch(recipe(), { mode: 'versus', policy: 'mission' });
  advanceClassicSnakeMatchTo(match, 4000);
  assert.deepEqual(match.runs[0].targets, match.runs[1].targets);
  assert.notEqual(match.runs[0].targets[0].tactical, match.runs[1].targets[0].tactical);
  assert.deepEqual(restoreClassicSnakeMatch(exportClassicSnakeMatch(match)), match);
});

test('mobile jammers and guards share one fair scheduler at every pace', () => {
  for (const pace of Object.keys(CLASSIC_PACES)) {
    const source = recipe('jammer');
    source.targets.maxActive = 2;
    source.targets.required.push({
      kind: 'guard',
      every: 3,
      at: { x: 16, y: 12 },
      heading: 'left',
    });
    source.tactics.push({
      policyIndex: 1,
      route: [
        { x: 16, y: 12 },
        { x: 15, y: 12 },
        { x: 14, y: 12 },
      ],
    });
    const run = createClassicSnake(prepareClassicSnakeLevel({ level: source }, { pace }), {
      hazardSeed: 71,
    });
    let warningAt = null,
      bursts = 0,
      shots = 0,
      guardWasWarning = false;
    for (let i = 0; i < 400; i++) {
      const jammed = run.signal.jammed;
      advance(run, 1);
      const guard = run.targets.find((target) => target.kind === 'guard');
      if (guard.phase === 'warning' && !guardWasWarning) warningAt = run.elapsedMs;
      if (run.signal.jammed) {
        assert.equal(run.projectiles.length, 0, pace);
        bursts++;
        warningAt = null;
      }
      if (!run.signal.jammed && jammed && guard.phase === 'warning') warningAt = run.elapsedMs;
      const born = run.projectiles.filter((shot) => shot.bornTick === run.tick);
      if (born.length) {
        assert.ok(warningAt !== null && run.elapsedMs - warningAt >= 800, pace);
        shots += born.length;
      }
      guardWasWarning = guard.phase === 'warning';
    }
    assert.ok(bursts > 0 && shots > 0, pace);
    const altered = exportClassicSnakeReplay(run);
    altered.hazardSeed++;
    assert.throws(() => restoreClassicSnakeReplay(altered));
  }
});
