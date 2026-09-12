import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  FIXED_DT,
  CELL,
  CLASSES,
  getSummary,
  validateLevel,
  releaseInputs,
} from '../core/index.mjs';
import { classicEffectActive, projectClassicState } from '../core/classic-state.mjs';
import {
  fitsClassicDomain,
  classicClaim,
  classicProtectedCells,
  classicErosionReason,
  commitClassicErosion,
  updateClassicAnchors,
} from '../core/classic-topology.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import {
  classicContourGraph,
  orientedContourEdge,
  nextContourEdge,
  contourRejoinPath,
} from '../core/classic-contour.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

function level(changes = {}) {
  return {
    version: 'xonix-level.v4',
    id: 'classic-core-test',
    revision: '1',
    name: 'Classic core test',
    width: 72,
    height: 36,
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    encounter: null,
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
    walls: [],
    enemies: [{ id: 'seed', type: 'bouncer', x: 60.5, y: 18.5, vx: 0, vy: 0 }],
    objectives: [],
    supplies: [],
    rules: { moveSpeed: 10, lives: 3, graceSeconds: 0, respawnSeconds: 0.1 },
    ...changes,
  };
}
function ticks(run, direction, count, extra = {}) {
  const events = [];
  for (let n = 0; n < count; n++) {
    stepRun(run, { direction, ...extra }, FIXED_DT);
    events.push(...structuredClone(run.events));
  }
  return events;
}
function until(run, direction, predicate, limit = 2400) {
  for (let i = 0; i < limit; i++) {
    const events = ticks(run, direction, 1);
    if (predicate(run, events)) return events;
    assert.equal(run.status, 'running', `unexpected ${run.failureCause}`);
  }
  assert.fail('Legal command did not reach the expected boundary');
}
const powerup = (kind, id = kind, x = 36.5, y = 0.5) => ({ id, kind, x, y });

test('classic declarations reject hostile, ambiguous and unsupported mechanics before construction', () => {
  assert.equal(validateLevel(level()).valid, true);
  const invalid = [
    level({ classic: { version: 'classic.v1', terrain: [], powerups: [], script: 'run' } }),
    level({ classic: { version: 'future', terrain: [], powerups: [] } }),
    level({
      classic: {
        version: 'classic.v1',
        terrain: [
          { id: 'mud', kind: 'slow', x: 1, y: 1, w: 2, h: 2 },
          { id: 'fire', kind: 'lethal', x: 2, y: 2, w: 2, h: 2 },
        ],
        powerups: [],
      },
    }),
    level({
      classic: {
        version: 'classic.v1',
        terrain: [],
        powerups: [powerup('player-speed'), powerup('enemy-slow')],
      },
    }),
    level({ classic: { version: 'classic.v1', terrain: [], powerups: [powerup('teleport')] } }),
    level({
      enemies: [
        {
          id: 'contour',
          type: 'contour-patrol',
          edge: { x: 20, y: 20, side: 'north' },
          clockwise: true,
          speed: 2,
        },
      ],
    }),
    level({ enemies: [{ id: 'rover', type: 'claimed-rover', x: 10.2, y: 10.5, vx: 1, vy: 0 }] }),
  ];
  let getterCalls = 0;
  const hostile = level();
  Object.defineProperty(hostile.classic, 'terrain', {
    get() {
      getterCalls++;
      return [];
    },
    enumerable: true,
  });
  invalid.push(hostile);
  for (const candidate of invalid) {
    assert.equal(validateLevel(candidate).valid, false);
    assert.throws(() => createRun(candidate));
  }
  assert.equal(getterCalls, 0);
});

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: slow material splits a tick at its exact edge and leaves enemy speed unchanged`, () => {
    const source = level({
      spawn: { x: 0.5, y: 18.5 },
      rules: { moveSpeed: 20, boostMultiplier: 2.4, lives: 3 },
      enemies: [{ id: 'seed', type: 'bouncer', x: 50.5, y: 10.5, vx: 6, vy: 0 }],
      classic: {
        version: 'classic.v1',
        terrain: [{ id: 'slow', kind: 'slow', x: 1, y: 18, w: 2, h: 1 }],
        powerups: [],
      },
    });
    const run = createRun(source, { turnPolicy: policy });
    ticks(run, 'right', 1, { boost: true });
    assert.ok(Math.abs(run.player.x - 0.9) < 1e-8);
    ticks(run, 'right', 1, { boost: true });
    assert.ok(Math.abs(run.player.x - 1.15) < 1e-8);
    assert.ok(Math.abs(run.enemies[0].x - 50.6) < 1e-8);
    // 60 Hz rendering and 120 Hz calls select the same deterministic fixed ticks.
    const chunked = createRun(source, { turnPolicy: policy });
    stepRun(chunked, { direction: 'right', boost: true }, FIXED_DT * 2);
    assert.deepEqual(authoritativeCheckpoint(chunked), authoritativeCheckpoint(run));
  });

  test(`${policy}: swept lethal material fails within a boosted tick and cannot be shielded`, () => {
    const source = level({
      spawn: { x: 0.5, y: 18.5 },
      rules: { moveSpeed: 20, boostMultiplier: 3, lives: 1 },
      classic: {
        version: 'classic.v1',
        terrain: [{ id: 'lethal', kind: 'lethal', x: 1, y: 18, w: 1, h: 1 }],
        powerups: [],
      },
    });
    const run = createRun(source, { turnPolicy: policy, classId: 'interceptor' });
    ticks(run, 'right', 1, { boost: true, action: true });
    assert.equal(run.status, 'lost');
    assert.equal(run.failureCause, 'lethal-terrain');
    assert.equal(run.classic.livesLost, 1);
    assert.ok(run.time < FIXED_DT);
    assert.equal(
      run.events.some((e) => e.type === 'shield.absorbed'),
      false,
    );
  });

  test(`${policy}: capture neutralizes material but does not collect an enclosed contact pickup`, () => {
    const run = createRun(
      level({
        classic: {
          version: 'classic.v1',
          terrain: [{ id: 'left-fire', kind: 'lethal', x: 5, y: 5, w: 2, h: 2 }],
          powerups: [powerup('extra-life', 'left-heart', 12.5, 10.5)],
        },
      }),
      { turnPolicy: policy },
    );
    const events = ticks(run, 'down', 420);
    assert.ok(events.some((e) => e.type === 'cells.claimed'));
    assert.equal(run.cells[5 * 72 + 5], CELL.SAFE);
    assert.equal(run.classic.terrain[5 * 72 + 5], 2);
    assert.equal(run.classic.powerups[0].collectedTick, null);
    assert.equal(run.lives, 3);
    assert.equal(
      events.some((e) => e.type === 'powerup.collected'),
      false,
    );
  });

  test(`${policy}: claimed rover never seeds fill, warns for 120 actor ticks, then threatens safe ground`, () => {
    const source = level();
    source.enemies.push({ id: 'rover', type: 'claimed-rover', x: 10.5, y: 10.5, vx: 0, vy: 0 });
    const run = createRun(source, { turnPolicy: policy });
    const events = ticks(run, 'down', 420),
      rover = run.enemies[1];
    const warning = events.find((e) => e.type === 'rover.warning');
    assert.ok(warning);
    assert.equal(run.cells[10 * 72 + 10], CELL.SAFE);
    assert.equal(rover.classic.mode, 'warning');
    ticks(run, 'down', warning.activationTick - run.classic.actorTick - 1);
    assert.equal(rover.classic.mode, 'warning');
    ticks(run, 'down', 1);
    assert.equal(rover.classic.mode, 'active');
    ticks(run, 'left', 312);
    until(run, 'up', (_state, events) => events.some((e) => e.type === 'player.failed'));
    assert.equal(run.failureCause, 'enemy-player');
    assert.equal(run.classic.livesLost, 1);
    assert.equal(
      run.events.some((e) => e.type === 'cut.started'),
      false,
    );
  });

  test(`${policy}: an active claimed rover reflects inside safe ground without erasing or retaining field`, () => {
    const source = level();
    source.enemies.push({ id: 'rover', type: 'claimed-rover', x: 10.5, y: 10.5, vx: -4, vy: 0 });
    const run = createRun(source, { turnPolicy: policy });
    ticks(run, 'down', 560);
    const topology = run.cells.slice(),
      count = run.claimedCount;
    for (let n = 0; n < 600; n++) {
      ticks(run, 'down', 1);
      assert.equal(fitsClassicDomain(run, run.enemies[1], run.enemies[1].radius, CELL.SAFE), true);
    }
    assert.deepEqual(run.cells, topology);
    assert.equal(run.claimedCount, count);
    assert.equal(run.enemies[1].classic.mode, 'active');
  });

  test(`${policy}: contour captures rebuild a continuous safe rejoin instead of teleporting`, () => {
    const source = level();
    source.enemies.push({
      id: 'contour',
      type: 'contour-patrol',
      edge: { x: 10, y: 1, side: 'north' },
      clockwise: true,
      speed: 2,
      radius: 0.2,
    });
    const run = createRun(source, { turnPolicy: policy });
    const events = ticks(run, 'down', 420),
      contour = run.enemies[1];
    assert.ok(events.some((e) => e.type === 'contour.routeChanged' && e.mode === 'rejoining'));
    assert.equal(contour.classic.mode, 'rejoining');
    assert.ok(contour.x < 20);
    for (let n = 0; n < 1800 && contour.classic.mode !== 'patrolling'; n++) {
      const before = { x: contour.x, y: contour.y };
      ticks(run, 'down', 1);
      assert.ok(Math.hypot(contour.x - before.x, contour.y - before.y) <= 2 * FIXED_DT + 1e-7);
    }
    assert.equal(contour.classic.mode, 'patrolling');
    assert.equal(run.lives, 3);
  });

  test(`${policy}: legal eroder contact warns, reopens one cell and reclaim never farms score`, () => {
    const source = level({
      enemies: [{ id: 'eroder', type: 'eroder', x: 66.5, y: 18.5, vx: -4, vy: 0 }],
    });
    const run = createRun(source, { turnPolicy: policy });
    ticks(run, 'down', 420);
    const score = run.score,
      unique = run.classic.uniqueClaimedCount,
      count = run.claimedCount,
      denominator = run.totalClaimable;
    const warning = until(run, 'down', (_state, events) =>
      events.some((e) => e.type === 'erosion.warning'),
    ).find((e) => e.type === 'erosion.warning');
    ticks(run, 'down', warning.erosionAt - run.classic.actorTick - 1);
    assert.equal(run.cells[warning.index], CELL.SAFE);
    ticks(run, 'down', 1);
    assert.equal(run.cells[warning.index], CELL.FIELD);
    assert.equal(run.claimedCount, count - 1);
    assert.equal(run.score, score);
    assert.equal(run.totalClaimable, denominator);
    until(run, 'up', (_state, events) => events.some((e) => e.type === 'cut.closed'));
    assert.equal(run.cells[warning.index], CELL.SAFE);
    assert.equal(run.score, score);
    assert.equal(run.classic.uniqueClaimedCount, unique);
    assert.equal(run.claimedCount, count);
    assert.equal(run.totalClaimable, denominator);
  });
}

test('timed pickups activate next tick, refresh without stacking, and expire on the exclusive bound', () => {
  const source = level({
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [powerup('player-speed'), powerup('player-speed', 'second-speed', 38.5)],
    },
  });
  const run = createRun(source);
  ticks(run, null, 1);
  assert.equal(classicEffectActive(run, 'player-speed'), false);
  const first = run.classic.effects['player-speed'].until;
  ticks(run, 'right', 1);
  assert.equal(classicEffectActive(run, 'player-speed'), true);
  assert.ok(Math.abs(run.player.x - 36.5 - 12.5 * FIXED_DT) < 1e-8);
  until(run, 'right', (state) => state.classic.powerups[1].collectedTick !== null);
  const end = run.classic.effects['player-speed'].until;
  assert.ok(end > first && end < first + 100);
  assert.equal(run.classic.effects['player-speed'].from, 2);
  ticks(run, null, end - run.tick - 1);
  assert.equal(classicEffectActive(run, 'player-speed'), true);
  ticks(run, null, 1);
  assert.equal(classicEffectActive(run, 'player-speed'), false);
});

test('global freeze stops movement, damage and actor clocks while world time and expiry continue', () => {
  const run = createRun(
    level({
      classic: { version: 'classic.v1', terrain: [], powerups: [powerup('enemy-freeze')] },
      enemies: [
        { id: 'patrol', type: 'border-patrol', x: 40.5, y: 0.5, speed: 4, clockwise: false },
        { id: 'seed', type: 'bouncer', x: 60.5, y: 10.5, vx: 2, vy: 0 },
      ],
    }),
  );
  ticks(run, null, 1);
  const positions = run.enemies.map((e) => [e.x, e.y]),
    clock = run.classic.actorTick;
  ticks(run, null, 360);
  assert.deepEqual(
    run.enemies.map((e) => [e.x, e.y]),
    positions,
  );
  assert.equal(run.classic.actorTick, clock);
  assert.equal(run.tick, 361);
  assert.equal(run.lives, 3);
  ticks(run, null, 1);
  assert.equal(run.classic.actorTick, clock + 1);
  assert.notDeepEqual(
    run.enemies.map((e) => [e.x, e.y]),
    positions,
  );
});

test('a heart is consumed once at the cap and cannot erase the loss ledger', () => {
  const run = createRun(
    level({
      rules: { lives: 9, graceSeconds: 0, respawnSeconds: 0.1 },
      classic: { version: 'classic.v1', terrain: [], powerups: [powerup('extra-life')] },
    }),
  );
  const events = ticks(run, null, 1);
  assert.equal(run.lives, 9);
  assert.equal(events.find((e) => e.type === 'powerup.collected').gain, 0);
  ticks(run, 'down', 20);
  until(run, 'up', (_state, events) => events.some((e) => e.type === 'player.failed'));
  assert.equal(run.classic.livesLost, 1);
  ticks(run, null, 30);
  assert.equal(run.lives, 8);
  assert.equal(run.classic.powerups[0].collectedTick, 1);
});

test('pickup and active erosion state survive exact public replay with a released input boundary', () => {
  const source = level({
    classic: { version: 'classic.v1', terrain: [], powerups: [powerup('enemy-slow')] },
    enemies: [{ id: 'eroder', type: 'eroder', x: 66.5, y: 18.5, vx: -4, vy: 0 }],
  });
  const run = createRun(source),
    recorder = createRecorder(source, {}, 'classic-public-prefix');
  for (let i = 0; i < 1400; i++) {
    const input = { direction: 'down' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    if (run.events.some((e) => e.type === 'erosion.warning')) break;
  }
  assert.notEqual(run.enemies[0].classic.target, null);
  releaseInputs(run);
  recordRelease(recorder);
  const replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), authoritativeCheckpoint(run));
  const projection = projectClassicState(run);
  projection.state.effects['enemy-slow'].until++;
  assert.notDeepEqual(projection, projectClassicState(run));
});

test('generated home hangar identity cannot collide with a new powerup or terrain ID', () => {
  const source = level({
    classic: {
      version: 'classic.v1',
      terrain: [{ id: 'home-hangar-1', kind: 'slow', x: 2, y: 2, w: 1, h: 1 }],
      powerups: [powerup('extra-life', 'home-hangar')],
    },
  });
  const run = createRun(source),
    recorder = createRecorder(source);
  assert.equal(run.hangars[0].id, 'home-hangar-2');
  recordInput(recorder, {});
  stepRun(run, {}, FIXED_DT);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
});

test('an earlier pickup precedes a later failure, while an exact contact tie cancels the second pickup', () => {
  const run = createRun(
    level({
      rules: { moveSpeed: 10, lives: 1, graceSeconds: 0, respawnSeconds: 0.1 },
      enemies: [{ id: 'patrol', type: 'border-patrol', x: 40.3, y: 0.5, speed: 0 }],
      classic: {
        version: 'classic.v1',
        terrain: [],
        powerups: [powerup('extra-life', 'earlier', 38.5), powerup('extra-life', 'tie', 40.5)],
      },
    }),
  );
  until(run, 'right', (_state, events) => events.some((event) => event.type === 'player.failed'));
  assert.equal(run.status, 'respawning');
  assert.equal(run.lives, 1);
  assert.equal(run.classic.livesLost, 1);
  assert.notEqual(run.classic.powerups[0].collectedTick, null);
  assert.equal(run.classic.powerups[1].collectedTick, null);
  assert.equal(
    run.events.some((event) => event.type === 'powerup.collected'),
    false,
  );
});

test('global freeze permits enemy contact only until its exclusive expiry, including on safe ground', () => {
  const run = createRun(
    level({
      enemies: [{ id: 'patrol', type: 'border-patrol', x: 40.5, y: 0.5, speed: 0 }],
      classic: { version: 'classic.v1', terrain: [], powerups: [powerup('enemy-freeze')] },
    }),
  );
  ticks(run, null, 1);
  ticks(run, 'right', 48);
  assert.ok(Math.abs(run.player.x - 40.5) < 1e-8);
  ticks(run, null, 312);
  assert.equal(run.status, 'running');
  assert.equal(run.tick, 361);
  ticks(run, null, 1);
  assert.equal(run.status, 'respawning');
  assert.equal(run.failureCause, 'enemy-player');
  assert.equal(run.classic.livesLost, 1);
});

test('the strongest slow wins without multiplication; the old local field still excludes border patrols', () => {
  const run = createRun(
    level({
      supplies: [{ id: 'supply', x: 36.5, y: 0.5 }],
      enemies: [
        { id: 'seed', type: 'bouncer', x: 38.5, y: 2.5, vx: 1, vy: 0 },
        { id: 'patrol', type: 'border-patrol', x: 40.5, y: 0.5, speed: 1, clockwise: true },
      ],
      classic: { version: 'classic.v1', terrain: [], powerups: [powerup('enemy-slow')] },
    }),
    { classId: 'trapper' },
  );
  ticks(run, null, 1, { pickup: true, action: true });
  const positions = run.enemies.map((enemy) => enemy.x);
  ticks(run, null, 1);
  assert.ok(Math.abs(run.enemies[0].x - positions[0] - 0.25 * FIXED_DT) < 1e-8);
  assert.ok(Math.abs(run.enemies[1].x - positions[1] - 0.5 * FIXED_DT) < 1e-8);
  assert.ok(run.ability.fields.length > 0);
});

test('speed pickup and class/boost multipliers remain capped at sixty cells per second', () => {
  const recipes = structuredClone(CLASSES);
  recipes[0].moveSpeedMultiplier = 1.5;
  const run = createRun(
    level({
      rules: { moveSpeed: 20, boostMultiplier: 3 },
      classic: { version: 'classic.v1', terrain: [], powerups: [powerup('player-speed')] },
    }),
    { classRecipes: recipes },
  );
  ticks(run, null, 1);
  ticks(run, 'right', 1, { boost: true });
  assert.ok(Math.abs(run.player.x - 37) < 1e-8);
  assert.equal(run.player.speed, 60);
});

test('shield, impact and life loss clear player speed while retaining global enemy effects', () => {
  for (const kind of ['shield', 'impact', 'failure']) {
    const run = createRun(
      level({
        enemies: [{ id: 'patrol', type: 'border-patrol', x: 40.5, y: 0.5, speed: 0 }],
        classic: {
          version: 'classic.v1',
          terrain: [],
          powerups: [powerup('player-speed'), powerup('enemy-slow', 'slow', 37.5)],
        },
      }),
      { classId: kind === 'shield' ? 'interceptor' : kind === 'impact' ? 'impact' : 'scout' },
    );
    ticks(run, null, 1, { action: kind === 'shield' });
    ticks(run, 'right', 12);
    assert.equal(classicEffectActive(run, 'player-speed'), true);
    assert.equal(classicEffectActive(run, 'enemy-slow'), true);
    if (kind === 'impact') ticks(run, null, 1, { action: true });
    else
      until(run, 'right', (_state, events) =>
        events.some((event) => ['shield.absorbed', 'player.failed'].includes(event.type)),
      );
    assert.equal(run.status, 'respawning');
    assert.equal(classicEffectActive(run, 'player-speed'), false);
    assert.equal(classicEffectActive(run, 'enemy-slow'), true);
    assert.equal(run.classic.livesLost, kind === 'failure' ? 1 : 0);
  }
});

test('freeze does not stop lethal terrain or the mission deadline during recovery', () => {
  const run = createRun(
    level({
      spawn: { x: 0.5, y: 18.5 },
      rules: {
        moveSpeed: 20,
        boostMultiplier: 3,
        lives: 3,
        respawnSeconds: 1,
        timeLimitSeconds: 0.05,
      },
      classic: {
        version: 'classic.v1',
        terrain: [{ id: 'fire', kind: 'lethal', x: 1, y: 18, w: 1, h: 1 }],
        powerups: [powerup('enemy-freeze', 'freeze', 0.5, 18.5)],
      },
    }),
  );
  ticks(run, null, 1);
  ticks(run, 'right', 1, { boost: true });
  assert.equal(run.status, 'respawning');
  assert.equal(run.failureCause, 'lethal-terrain');
  ticks(run, null, 4);
  assert.equal(run.status, 'lost');
  assert.equal(run.failureCause, 'mission-timeout');
  assert.equal(run.classic.actorTick, 1);
  assert.equal(run.classic.livesLost, 1);
  assert.ok(Math.abs(run.time - 0.05) < 1e-8);
});

test('restoring the initial life count with a heart cannot turn a damaged clear into clean gold', () => {
  const run = createRun(
    level({
      goal: { coverage: 0.4 },
      classic: {
        version: 'classic.v1',
        terrain: [],
        powerups: [powerup('extra-life', 'heart', 36.5, 2.5)],
      },
    }),
  );
  ticks(run, 'down', 30);
  assert.equal(run.lives, 4);
  until(run, 'up', (_state, events) => events.some((event) => event.type === 'player.failed'));
  ticks(run, null, 13);
  assert.equal(run.lives, run.rules.lives);
  ticks(run, 'down', 420);
  assert.equal(run.status, 'won');
  assert.equal(run.medal, 'silver');
  assert.equal(getSummary(run).livesLost, 1);
});

test('a contour blocked by a wall stops at radius clearance and can never tunnel through the corner', () => {
  const run = createRun(
    level({
      walls: [{ x: 15, y: 1, w: 1, h: 5 }],
      enemies: [
        {
          id: 'contour',
          type: 'contour-patrol',
          edge: { x: 14, y: 1, side: 'north' },
          clockwise: true,
          speed: 15,
          radius: 0.25,
        },
        { id: 'seed', type: 'bouncer', x: 60.5, y: 18.5, vx: 0, vy: 0 },
      ],
    }),
  );
  ticks(run, null, 120);
  assert.equal(run.enemies[0].classic.mode, 'idle');
  assert.ok(Math.abs(run.enemies[0].x - 14.75) < 1e-8);
  assert.equal(run.enemies[0].y, 1);
  assert.equal(run.cells[72 + 15], CELL.WALL);
});

test('classic erosion transactions protect body support, departure, anchors and this-tick claims', () => {
  const run = createRun(
    level({
      objectives: [{ id: 'relay', x: 10.5, y: 18.5, required: true }],
      supplies: [{ id: 'supply', x: 20.5, y: 18.5 }],
    }),
  );
  ticks(run, 'down', 420);
  ticks(run, 'up', 24);
  updateClassicAnchors(run);
  assert.equal(run.objectives[0].captured, true);
  for (const anchor of run.classic.anchors) {
    assert.ok(anchor.path.length > 0);
    for (const index of anchor.path) {
      assert.equal(classicProtectedCells(run).has(index), true);
      assert.notEqual(classicErosionReason(run, index), null);
    }
  }
  const player = Math.floor(run.player.y) * 72 + 36;
  assert.equal(classicErosionReason(run, player), 'protected');
  assert.equal(classicErosionReason(run, player - 72), 'protected');
  ticks(run, 'right', 60);
  assert.notEqual(run.classic.departure, null);
  assert.equal(classicProtectedCells(run).has(run.classic.departure), true);
  assert.equal(classicErosionReason(run, 0), 'border');
  // Isolated topology transaction fixture, not a claimed gameplay/replay route.
  const index = 5 * 72 + 40;
  run.cells[index] = CELL.SAFE;
  classicClaim(run, [index]);
  assert.equal(classicErosionReason(run, index), 'protected');
  run.classic.tickClaims = [];
  assert.equal(classicErosionReason(run, index), null);
});

function sentinelSource(changes = {}) {
  return level({
    enemies: [{ id: 'sentinel', type: 'relay-sentinel', x: 60.5, y: 18.5 }],
    objectives: [
      { id: 'relay', x: 10.5, y: 10.5, required: true },
      { id: 'core', x: 60.5, y: 18.5, required: true },
    ],
    encounter: {
      version: 'xonix-encounter.v1',
      kind: 'relay-sentinel',
      enemyId: 'sentinel',
      shieldObjectiveId: 'relay',
      coreObjectiveId: 'core',
      minReleaseCutCells: 8,
      initialDelayTicks: 7200,
      transitionTicks: 1,
      shielded: { warningTicks: 1, activeTicks: 1, restTicks: 1 },
      exposed: { warningTicks: 1, activeTicks: 1, openTicks: 7200 },
      laneWidth: 1.2,
    },
    ...changes,
  });
}

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: erosion cancels a rover's pending warning; an active rover instead protects its body support`, () => {
    for (const velocity of [-8, -4]) {
      const run = createRun(
        level({
          enemies: [
            { id: 'eroder', type: 'eroder', x: 66.5, y: 18.5, vx: velocity, vy: 0 },
            { id: 'rover', type: 'claimed-rover', x: 36.5, y: 18.5, vx: 0, vy: 0 },
          ],
        }),
        { turnPolicy: policy },
      );
      const events = ticks(run, 'down', 1200),
        index = 18 * 72 + 36;
      assert.ok(events.some((event) => event.type === 'rover.warning'));
      if (velocity === -8) {
        assert.ok(events.some((event) => event.type === 'rover.activationCancelled'));
        assert.equal(run.cells[index], CELL.FIELD);
        assert.equal(run.enemies[1].classic.mode, 'dormant');
      } else {
        assert.equal(run.cells[index], CELL.SAFE);
        assert.equal(run.enemies[1].classic.mode, 'active');
        assert.equal(classicErosionReason(run, index), 'protected');
        assert.equal(
          events.some((event) => event.type === 'erosion.warning' && event.index === index),
          false,
        );
      }
    }
  });

  test(`${policy}: the new rules retain a real two-stage sentinel release with non-seeding classic actors`, () => {
    const source = sentinelSource();
    source.enemies.push(
      { id: 'rover', type: 'claimed-rover', x: 10.5, y: 18.5, vx: 0, vy: 0 },
      {
        id: 'contour',
        type: 'contour-patrol',
        edge: { x: 10, y: 1, side: 'north' },
        clockwise: true,
        speed: 0,
      },
    );
    assert.equal(validateLevel(source).valid, true);
    const run = createRun(source, { turnPolicy: policy });
    ticks(run, 'down', 420);
    assert.equal(run.encounter.stage, 'exposed');
    assert.equal(run.encounter.phase, 'open');
    assert.equal(run.objectives[0].captured, true);
    assert.equal(run.objectives[1].captured, false);
    ticks(run, 'right', 408);
    ticks(run, 'up', 420);
    assert.equal(run.status, 'won');
    assert.equal(run.encounter.defeatCause, 'cut-release');
    assert.ok(run.encounter.qualifyingCutCells >= 8);
    assert.equal(run.classic.livesLost, 0);
    const bad = structuredClone(source);
    bad.enemies.push({ id: 'extra-seed', type: 'eroder', x: 65.5, y: 10.5, vx: 0, vy: 0 });
    assert.equal(validateLevel(bad).valid, false);
  });
}

test('a collected freeze holds a visible sentinel warning on its actor clock without extending world time', () => {
  const source = sentinelSource({
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [powerup('enemy-freeze', 'freeze', 37.5)],
    },
  });
  source.encounter.initialDelayTicks = 1;
  source.encounter.shielded.warningTicks = 30;
  const run = createRun(source);
  until(run, 'right', (state) => state.classic.powerups[0].collectedTick !== null);
  assert.equal(run.encounter.phase, 'warning');
  const phase = structuredClone(run.encounter),
    clock = run.classic.actorTick,
    time = run.time;
  ticks(run, null, 360);
  assert.deepEqual(run.encounter, phase);
  assert.equal(run.classic.actorTick, clock);
  assert.ok(Math.abs(run.time - time - 3) < 1e-8);
  ticks(run, null, phase.phaseEndTick - clock);
  assert.equal(run.encounter.phase, 'active');
  assert.equal(run.encounter.phaseStartTick, phase.phaseEndTick);
});

test('mission timeout wins an exact closure tie before any capture or clear reward', () => {
  const run = createRun(
    level({ goal: { coverage: 0.4 }, rules: { moveSpeed: 10, timeLimitSeconds: 3.45 } }),
  );
  const events = ticks(run, 'down', 414);
  assert.equal(run.status, 'lost');
  assert.equal(run.failureCause, 'mission-timeout');
  assert.equal(run.claimedCount, 0);
  assert.equal(run.score, 0);
  assert.equal(
    events.some((event) => event.type === 'cut.closed'),
    false,
  );
});

test('contour diagonal ties follow the selected field side and disconnected safe islands have no false rejoin', () => {
  // Explicit graph fixtures exercise topology choices, not simulated route completion.
  const run = createRun(level());
  run.cells[9 * 72 + 10] = CELL.SAFE;
  run.cells[10 * 72 + 9] = CELL.SAFE;
  run.classic.topologyRevision++;
  const graph = classicContourGraph(run),
    northwest = (9 * 72 + 9) * 4;
  const clockwise = orientedContourEdge(graph.edges.get(northwest + 1), true);
  const counterclockwise = orientedContourEdge(graph.edges.get(northwest + 2), false);
  assert.equal(nextContourEdge(run, { clockwise: true }, clockwise).id, northwest + 2);
  assert.equal(nextContourEdge(run, { clockwise: false }, counterclockwise).id, northwest + 1);
  for (let y = 7; y <= 13; y++)
    for (let x = 7; x <= 13; x++)
      run.cells[y * 72 + x] = x === 7 || x === 13 || y === 7 || y === 13 ? CELL.WALL : CELL.SAFE;
  run.classic.topologyRevision++;
  assert.equal(contourRejoinPath(run, { x: 10.5, y: 10.5, radius: 0.25 }), null);
});

test('freeze preserves an active attack and an exposed opening instead of consuming their actor ticks', () => {
  for (const phase of ['active', 'open']) {
    const source = sentinelSource({
      classic: {
        version: 'classic.v1',
        terrain: [],
        powerups: [powerup('enemy-freeze', 'freeze', 37.5, phase === 'open' ? 35.5 : 0.5)],
      },
    });
    if (phase === 'active') {
      source.encounter.initialDelayTicks = 1;
      source.encounter.shielded.activeTicks = 30;
    }
    const run = createRun(source);
    if (phase === 'open') ticks(run, 'down', 420);
    until(run, 'right', (state) => state.classic.powerups[0].collectedTick !== null);
    assert.equal(run.encounter.phase, phase);
    const expected = structuredClone(run.encounter),
      clock = run.classic.actorTick;
    ticks(run, null, 360);
    assert.deepEqual(run.encounter, expected);
    assert.equal(run.classic.actorTick, clock);
    ticks(run, null, 1);
    assert.equal(run.classic.actorTick, clock + 1);
    assert.equal(run.encounter.phase, phase);
    assert.equal(run.encounter.phaseEndTick, expected.phaseEndTick);
  }
});

test('public sessions preserve pending pickup activation and post-capture rover/contour continuation', async () => {
  for (const prefix of [1, 420]) {
    const source = level({
      classic: { version: 'classic.v1', terrain: [], powerups: [powerup('player-speed')] },
    });
    source.enemies.push(
      { id: 'rover', type: 'claimed-rover', x: 10.5, y: 18.5, vx: 0, vy: 0 },
      {
        id: 'contour',
        type: 'contour-patrol',
        edge: { x: 10, y: 1, side: 'north' },
        clockwise: true,
        speed: 2,
      },
    );
    const campaign = {
      version: 'xonix-campaign.v1',
      id: `classic-prefix-${prefix}`,
      revision: '1',
      name: 'Classic prefix',
      levels: [source],
      classRecipes: structuredClone(CLASSES),
    };
    const run = createRun(source),
      recorder = createRecorder(source),
      key = campaignKey(campaign);
    for (let n = 0; n < prefix; n++) {
      const command = { direction: 'down' };
      recordInput(recorder, command);
      stepRun(run, command, FIXED_DT);
    }
    if (prefix === 1) assert.equal(classicEffectActive(run, 'player-speed'), false);
    else {
      assert.equal(run.enemies[1].classic.mode, 'warning');
      assert.equal(run.enemies[2].classic.mode, 'rejoining');
    }
    const session = suspendSession({
      run,
      recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'scout',
      runId: `classic-${prefix}`,
      savedAt: '2026-09-13T00:00:00.000Z',
    });
    const restored = await restoreSession(session, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    assert.deepEqual(ticks(restored.run, 'down', 180), ticks(run, 'down', 180));
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  }
});

test('simultaneous eroders share one removal and cooldown even when a target becomes protected', () => {
  // Controlled transaction fixture for a tie that normal map authoring cannot directly schedule.
  const run = createRun(
    level({
      enemies: ['zeta', 'alpha', 'blocked'].map((id, i) => ({
        id,
        type: 'eroder',
        x: 50.5 + i,
        y: 18.5,
        vx: 0,
        vy: 0,
      })),
    }),
  );
  const target = 10 * 72 + 20,
    protectedTarget = 10 * 72 + 21;
  for (const index of [target, protectedTarget]) run.cells[index] = CELL.SAFE;
  classicClaim(run, [target, protectedTarget]);
  run.claimedCount = 2;
  run.coverage = 2 / run.totalClaimable;
  run.classic.tickClaims = [protectedTarget];
  for (const enemy of run.enemies)
    Object.assign(enemy.classic, {
      target: enemy.id === 'blocked' ? protectedTarget : target,
      erosionAt: 0,
    });
  assert.equal(commitClassicErosion(run), 1);
  assert.equal(run.claimedCount, 1);
  assert.equal(run.classic.uniqueClaimedCount, 2);
  assert.deepEqual(
    run.events
      .filter((event) => event.type === 'erosion.blocked')
      .map((event) => [event.id, event.reason]),
    [
      ['blocked', 'protected'],
      ['zeta', 'not-safe'],
    ],
  );
  assert.deepEqual(run.events.find((event) => event.type === 'cells.eroded').indices, [target]);
  assert.ok(
    run.enemies.every(
      (enemy) => enemy.classic.target === null && enemy.classic.cooldownUntil === 120,
    ),
  );
});

test('classic session restore retains a real pending erosion and then produces the same future ticks', async () => {
  const source = level({
    enemies: [{ id: 'eroder', type: 'eroder', x: 66.5, y: 18.5, vx: -4, vy: 0 }],
  });
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'classic-session',
    revision: '1',
    name: 'Classic session',
    levels: [source],
    classRecipes: structuredClone(CLASSES),
  };
  const run = createRun(source),
    recorder = createRecorder(source),
    key = campaignKey(campaign);
  for (let n = 0; n < 1800; n++) {
    const command = { direction: 'down' };
    recordInput(recorder, command);
    stepRun(run, command, FIXED_DT);
    if (run.enemies[0].classic.target !== null) break;
  }
  assert.notEqual(run.enemies[0].classic.target, null);
  const session = suspendSession({
    run,
    recorder,
    campaignKey: key,
    themeId: 'fpv',
    bodyId: 'scout',
    runId: 'classic-restore',
    savedAt: '2026-09-13T00:00:00.000Z',
    continuation: { direction: 'down' },
  });
  const restored = await restoreSession(session, { campaign, campaignKey: key });
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  const expectedEvents = ticks(run, 'down', 70),
    actualEvents = ticks(restored.run, 'down', 70);
  assert.deepEqual(actualEvents, expectedEvents);
  assert.ok(actualEvents.some((event) => event.type === 'cells.eroded'));
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
});
