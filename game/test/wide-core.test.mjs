import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  releaseInputs,
  getSummary,
  validateLevel,
  geometryForLevel,
  geometryForRun,
  CLASSES,
  CELL,
  FIXED_DT,
} from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { LEGACY_GEOMETRY, WIDE_GEOMETRY } from '../core/geometry.mjs';
import { cellIndex, planEnemy, applyPlannedEnemy } from '../core/movement.mjs';
import { resolveVersions, versionsForCampaign, WIDE_VERSIONS } from '../core/versions.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  verifyReplayAsync,
  authoritativeCheckpoint,
} from '../replay.mjs';

function level(overrides = {}) {
  return {
    version: 'xonix-level.v3',
    id: 'wide-test',
    name: 'Wide geometry test',
    revision: '1',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 60.5, y: 0.5 },
    goal: { coverage: 0.15 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 20.5, y: 18.5, vx: 0, vy: 0 }],
    objectives: [{ id: 'east', x: 65.5, y: 12.5, required: true }],
    ...overrides,
  };
}
function staged() {
  return level({
    spawn: { x: 0.5, y: 18.5 },
    goal: { coverage: 0.75 },
    enemies: [{ id: 'sentinel', type: 'relay-sentinel', x: 58.5, y: 18.5 }],
    objectives: [
      { id: 'relay', x: 8.5, y: 8.5, required: true, hidden: false },
      { id: 'core', x: 58.5, y: 18.5, required: true, hidden: false },
    ],
    encounter: {
      version: 'xonix-encounter.v1',
      kind: 'relay-sentinel',
      enemyId: 'sentinel',
      shieldObjectiveId: 'relay',
      coreObjectiveId: 'core',
      minReleaseCutCells: 8,
      initialDelayTicks: 240,
      transitionTicks: 180,
      shielded: { warningTicks: 240, activeTicks: 84, restTicks: 396 },
      exposed: { warningTicks: 240, activeTicks: 84, openTicks: 480 },
      laneWidth: 1.2,
    },
  });
}
function driver(source, options = {}) {
  const run = createRun(source, options),
    recorder = createRecorder(source, options, 'wide-test'),
    events = [];
  const tick = (input = {}) => {
    assert.ok(['running', 'respawning'].includes(run.status));
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
    events.push(...structuredClone(run.events));
  };
  const move = (count, direction) => {
    for (let i = 0; i < count && !['won', 'lost'].includes(run.status); i++) tick({ direction });
  };
  const wait = (predicate) => {
    for (let i = 0; !predicate(); i++) {
      assert.ok(i < 5000);
      tick();
    }
  };
  const replay = () => {
    releaseInputs(run);
    recordRelease(recorder);
    return exportReplay(recorder, run);
  };
  return { run, recorder, events, tick, move, wait, replay };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('wide selectors and geometry are owned, immutable, and reject unsupported mixed dimensions', () => {
  for (const [key, value] of Object.entries(WIDE_VERSIONS))
    assert.deepEqual(resolveVersions({ [key]: value }), WIDE_VERSIONS);
  const source = level(),
    run = createRun(source);
  assert.equal(geometryForLevel(source), WIDE_GEOMETRY);
  assert.equal(geometryForRun(run), WIDE_GEOMETRY);
  assert.deepEqual(WIDE_GEOMETRY, {
    width: 72,
    height: 36,
    cellCount: 2592,
    maxX: 71.5,
    maxY: 35.5,
    interiorWidth: 70,
    interiorHeight: 34,
    perimeter: 212,
  });
  assert.ok(Object.isFrozen(WIDE_GEOMETRY));
  assert.throws(() => {
    WIDE_GEOMETRY.width = 48;
  });
  assert.equal(run.totalClaimable, 2380);
  assert.equal(run.cells.length, 2592);
  assert.equal(run.encounter, null);
  assert.equal(cellIndex(60.5, 18.5, run), 18 * 72 + 60);
  assert.equal(cellIndex(60.5, 18.5), 18 * 48 + 47);
  assert.throws(() => geometryForRun({ ...run, ruleset: 'future' }), /unsupported/);
  assert.throws(() => geometryForRun({ ...run, width: 48 }), /dimensions/);
  assert.throws(
    () => resolveVersions({ ...WIDE_VERSIONS, replayVersion: 'xonix-replay.v4' }),
    /mismatched/,
  );
  const legacy = level({
    version: 'xonix-level.v1',
    width: 48,
    spawn: { x: 6.5, y: 0.5 },
    objectives: [],
  });
  delete legacy.encounter;
  assert.equal(geometryForRun(createRun(legacy)), LEGACY_GEOMETRY);
  assert.throws(() => versionsForCampaign({ levels: [legacy, source] }), /mix/);
});

test('wide schema rejects omitted/nullability/accessor/version errors and enforces east-side geometry budgets', () => {
  const mutations = [
    (l) => delete l.encounter,
    (l) => (l.width = 48),
    (l) => (l.height = 35),
    (l) => (l.version = 'xonix-level.v4'),
    (l) => (l.encounter = {}),
    (l) => (l.extra = true),
    (l) => (l.spawn.x = 72.5),
    (l) => (l.walls = [{ x: 70, y: 1, w: 2, h: 1 }]),
    (l) => (l.objectives[0].x = 71.5),
    (l) => (l.rules = { maxTrailCells: 2381 }),
  ];
  for (const mutate of mutations) {
    const source = level();
    mutate(source);
    assert.equal(validateLevel(source).valid, false);
    assert.throws(() => createRun(source), /Invalid level/);
  }
  let calls = 0;
  for (const key of ['encounter', 'width', 'version']) {
    const source = level();
    Object.defineProperty(source, key, {
      enumerable: true,
      get() {
        calls++;
        return null;
      },
    });
    assert.equal(validateLevel(source).valid, false);
  }
  assert.equal(calls, 0);
  const source = level({
    walls: [{ x: 68, y: 30, w: 3, h: 4 }],
    rules: { maxTrailCells: 2380 },
    supplies: [{ id: 's', x: 71.5, y: 2.5 }],
    hangars: [{ id: 'h', x: 71.5, y: 3.5 }],
    signalZones: [{ id: 'z', x: 65, y: 5, w: 6, h: 2, speedFactor: 0.5 }],
  });
  assert.equal(validateLevel(source).valid, true);
  assert.equal(createRun(source).cells[33 * 72 + 70], CELL.WALL);
  const owned = normalizedLevel(source);
  source.rules.maxTrailCells = 1;
  assert.equal(owned.rules.maxTrailCells, 2380);
  const bad = staged();
  bad.enemies[0].x = 58;
  assert.equal(validateLevel(bad).valid, false);
});

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: legal east-side cut claims exactly its empty region, objective and v5 replay`, async () => {
    const d = driver(level(), { turnPolicy: policy });
    d.move(525, 'down');
    assert.equal(d.run.status, 'won');
    assert.equal(d.run.claimedCount, 11 * 34);
    assert.equal(d.run.lives, 3);
    assert.equal(d.run.objectives[0].captured, true);
    assert.equal(d.run.cells[12 * 72 + 65], CELL.SAFE);
    assert.equal(d.run.cells[18 * 72 + 20], CELL.FIELD);
    const replay = d.replay();
    assert.equal(replay.version, 'xonix-replay.v5');
    assert.equal(replay.checkpoint.algorithm, 'fnv1a64-state-v4');
    assert.ok(Object.hasOwn(replay.checkpoint.sections, 'encounter'));
    assert.equal(verifyReplay(replay).match, true);
    assert.equal((await verifyReplayAsync(replay, { chunkTicks: 120 })).match, true);
    for (const mutate of [
      (r) => (r.level.width = 48),
      (r) => (r.level.encounter = {}),
      (r) => (r.version = 'xonix-replay.v4'),
      (r) => (r.checkpoint.algorithm = 'fnv1a64-state-v3'),
    ]) {
      const bad = structuredClone(replay);
      mutate(bad);
      assert.throws(() => verifyReplay(bad));
    }
    const badCheckpoint = structuredClone(replay);
    badCheckpoint.checkpoint.sections.encounter = '0000000000000000';
    assert.throws(() => verifyReplay(badCheckpoint), /Checkpoint root/);
    const before = authoritativeCheckpoint(d.run);
    d.run.cells[10 * 72 + 60] = CELL.FIELD;
    assert.notEqual(authoritativeCheckpoint(d.run).sections.board, before.sections.board);
  });
  test(`${policy}: wide staged route captures actual core after a qualifying opening, then verifies v5`, () => {
    const d = driver(staged(), { turnPolicy: policy });
    d.move(270, 'up');
    d.move(180, 'right');
    d.wait(() => d.run.encounter.phase === 'rest');
    d.move(525, 'down');
    assert.equal(d.run.encounter.stage, 'transition');
    assert.equal(d.run.objectives[0].captured, true);
    assert.equal(d.run.objectives[1].captured, false);
    d.move(120, 'right');
    d.wait(() => d.run.encounter.phase === 'open');
    d.move(90, 'up');
    d.move(120, 'left');
    assert.equal(d.run.status, 'won');
    assert.equal(d.run.lives, 3);
    assert.equal(d.run.encounter.defeatCause, 'cut-release');
    assert.equal(d.run.objectives[1].captured, true);
    assert.equal(d.run.coverage, 1);
    assert.equal(verifyReplay(d.replay()).match, true);
    assert.ok(d.events.some((e) => e.type === 'encounter.defeated'));
  });
  test(`${policy}: walls, right border, swept trail contacts and boss lanes work beyond column 47`, () => {
    const w = driver(
      level({ goal: { coverage: 1 }, objectives: [], walls: [{ x: 60, y: 4, w: 1, h: 1 }] }),
      { turnPolicy: policy },
    );
    w.move(90, 'down');
    assert.ok(w.run.player.y < 4);
    near(w.run.player.x, 60.5);
    assert.equal(w.run.status, 'running');
    const edge = driver(level({ spawn: { x: 71.5, y: 10.5 }, objectives: [] }), {
      turnPolicy: policy,
    });
    edge.move(30, 'right');
    near(edge.run.player.x, 71.5);
    edge.move(15, 'up');
    assert.ok(edge.run.player.y < 10.5);
    const hit = driver(
      level({
        spawn: { x: 60.5, y: 0.5 },
        goal: { coverage: 1 },
        objectives: [],
        enemies: [{ id: 'cutter', type: 'bouncer', x: 62.5, y: 2.5, vx: -6, vy: 0 }],
      }),
      { turnPolicy: policy },
    );
    hit.move(25, 'down');
    assert.equal(hit.run.status, 'respawning');
    assert.equal(hit.run.failureCause, 'enemy-trail');
    assert.equal(verifyReplay(hit.replay()).match, true);
    for (const axis of ['horizontal', 'vertical']) {
      const lane = driver(
        level({
          objectives: [],
          goal: { coverage: 1 },
          enemies: [
            {
              id: 'lane',
              type: 'lane-boss',
              x: 20.5,
              y: 18.5,
              axis,
              warningSeconds: 0.25,
              activeSeconds: 0.1,
              period: 1,
            },
          ],
        }),
        { turnPolicy: policy },
      );
      lane.move(300, 'down');
      assert.equal(lane.run.status, 'respawning');
      assert.equal(lane.run.failureCause, 'boss-lane');
      assert.equal(verifyReplay(lane.replay()).match, true);
    }
  });
}

test('wide patrol corners and partial contact continuation use the 212-cell perimeter', () => {
  for (const clockwise of [true, false]) {
    const run = createRun(
      level({
        objectives: [],
        enemies: [
          {
            id: 'p',
            type: 'border-patrol',
            x: 71.5,
            y: clockwise ? 34.5 : 1.5,
            speed: 4,
            clockwise,
          },
        ],
      }),
    );
    const enemy = run.enemies[0],
      plan = planEnemy(run, enemy, 0.5);
    near(plan.enemy.x, 70.5);
    near(plan.enemy.y, clockwise ? 35.5 : 0.5);
    applyPlannedEnemy(enemy, plan, 0.125, 0.5, run);
    near(enemy.x, 71.5);
    near(enemy.y, clockwise ? 35 : 1);
    near(enemy.perimeter, clockwise ? 105.5 : 71.5);
  }
  const run = createRun(
    level({
      objectives: [],
      enemies: [{ id: 'e', type: 'bouncer', x: 70.5, y: 8.5, vx: 4, vy: 0 }],
    }),
  );
  const plan = planEnemy(run, run.enemies[0], 0.25);
  near(plan.enemy.x, 70);
  assert.equal(plan.enemy.vx, -4);
});

test('all seven class abilities and switches serialize at the east rail without affecting an interleaved legacy run', () => {
  const source = level({
    objectives: [{ id: 'hidden', x: 65.5, y: 9.5, hidden: true }],
    goal: { coverage: 1 },
    supplies: [{ id: 's', x: 60.5, y: 0.5 }],
    hangars: [{ id: 'h', x: 60.5, y: 0.5 }],
    enemies: [{ id: 'e', type: 'bouncer', x: 60.5, y: 3.5, vx: 0, vy: 2 }],
  });
  const old = level({
    version: 'xonix-level.v1',
    width: 48,
    spawn: { x: 6.5, y: 0.5 },
    objectives: [],
  });
  delete old.encounter;
  const baseline = createRun(old),
    interleaved = createRun(old);
  for (const recipe of CLASSES) {
    const d = driver(source, { classId: recipe.id });
    d.tick({ pickup: true });
    d.tick({ action: true });
    assert.ok(
      d.events.some(
        (event) => event.type === 'ability.used' && event.primitive === recipe.primitive,
      ),
    );
    for (let i = 0; i < 24; i++) {
      d.tick();
      stepRun(interleaved, {}, FIXED_DT);
      stepRun(baseline, {}, FIXED_DT);
    }
    assert.equal(verifyReplay(d.replay()).match, true);
    assert.equal(d.run.width, 72);
  }
  assert.deepEqual(authoritativeCheckpoint(interleaved), authoritativeCheckpoint(baseline));
  assert.deepEqual(getSummary(interleaved), getSummary(baseline));
  assert.equal(Object.hasOwn(interleaved, 'encounter'), false);
  const d = driver(source);
  d.tick({ switchClass: 'fiber' });
  assert.equal(d.run.activeClassId, 'fiber');
  assert.equal(verifyReplay(d.replay()).match, true);
});
