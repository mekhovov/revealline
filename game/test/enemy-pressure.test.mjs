import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, validateLevel, FIXED_DT, CELL, CLASSES } from '../core/index.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function level(mode = 'trail-pursuit') {
  return {
    version: 'xonix-level.v4',
    id: 'pressure-check',
    revision: '1',
    name: 'Readable pressure',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      lineImpact: { version: 'line-impact.v1', speed: 4 },
      enemyPressure: {
        version: 'enemy-pressure.v1',
        actors: [
          {
            id: 'hunter',
            mode,
            senseRadius: 20,
            scanTicks: 24,
            warningTicks: 60,
            commitTicks: 120,
            cooldownTicks: 180,
            leadTicks: mode === 'head-intercept' ? 24 : 0,
          },
        ],
      },
    },
    enemies: [
      { id: 'hunter', type: 'bouncer', x: 23.5, y: 10.5, vx: 2, vy: 1, radius: 0.25 },
      { id: 'seed', type: 'bouncer', x: 60.5, y: 26.5, vx: 0.1, vy: 0, radius: 0.25 },
    ],
    rules: { moveSpeed: 12, lives: 3, stopOnCapture: true },
  };
}
const definition = (source) => source.classic.enemyPressure.actors[0];
const pressure = (run) => run.enemies[0].classic.pressure;
function advance(run, direction, ticks, recorder) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    assert.ok(['running', 'respawning'].includes(run.status));
    const input = { direction };
    stepRun(run, input, FIXED_DT);
    if (recorder) recordInput(recorder, input);
    events.push(...run.events);
  }
  return events;
}
function until(run, predicate, direction = 'down', max = 500, recorder) {
  const events = [];
  for (let i = 0; i < max && !predicate(run); i++)
    events.push(...advance(run, direction, 1, recorder));
  assert.ok(predicate(run), `Condition not reached at tick ${run.tick}`);
  return events;
}
function checkReplay(run, recorder) {
  const checked = verifyReplay(exportReplay(recorder, run));
  assert.equal(checked.match, true);
  assert.deepEqual(authoritativeCheckpoint(checked.state), authoritativeCheckpoint(run));
}

test('pressure is a strict optional finite classic descriptor with owned unique moving field actors', () => {
  assert.equal(validateLevel(level()).valid, true);
  assert.equal(validateLevel(level('head-intercept')).valid, true);
  const absent = level();
  delete absent.classic.enemyPressure;
  const run = createRun(absent);
  assert.equal(Object.hasOwn(run.level.classic, 'enemyPressure'), false);
  assert.equal(Object.hasOwn(run.enemies[0], 'classic'), false);
  const bad = [
    (s) => {
      s.classic.enemyPressure = null;
    },
    (s) => {
      s.classic.enemyPressure.version = 'enemy-pressure.v2';
    },
    (s) => {
      s.classic.enemyPressure.extra = true;
    },
    (s) => {
      s.classic.enemyPressure.actors = [];
    },
    (s) => {
      s.classic.enemyPressure.actors.push({ ...definition(s) });
    },
    (s) => {
      definition(s).id = 'missing';
    },
    (s) => {
      s.enemies[0].type = 'eroder';
    },
    (s) => {
      s.enemies[0].vx = 0;
      s.enemies[0].vy = 0;
    },
    (s) => {
      s.enemies[0].vx = 20;
      s.enemies[0].vy = 20;
    },
    (s) => {
      definition(s).mode = 'omniscient';
    },
    (s) => {
      definition(s).senseRadius = 24.01;
    },
    (s) => {
      definition(s).scanTicks = 23;
    },
    (s) => {
      definition(s).warningTicks = 35;
    },
    (s) => {
      definition(s).commitTicks = 361;
    },
    (s) => {
      definition(s).cooldownTicks = 89;
    },
    (s) => {
      definition(s).leadTicks = 1;
    },
    (s) => {
      delete definition(s).warningTicks;
    },
    (s) => {
      definition(s).script = 'ignored';
    },
  ];
  for (const mutate of bad) {
    const source = level();
    mutate(source);
    assert.equal(validateLevel(source).valid, false);
    assert.throws(() => createRun(source));
  }
  for (const version of ['xonix-level.v1', 'xonix-level.v2', 'xonix-level.v3']) {
    const source = level();
    source.version = version;
    assert.equal(validateLevel(source).valid, false);
  }
  const source = level(),
    original = structuredClone(source),
    owned = createRun(source);
  definition(source).warningTicks = 180;
  assert.deepEqual(owned.level.classic.enemyPressure, original.classic.enemyPressure);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: a long exposed cut loses to pressure while short closure and distant departure remain counterplay`, () => {
    const source = level();
    delete source.classic.lineImpact;
    Object.assign(source.enemies[0], { x: 29.5, y: 10.5, vx: 0, vy: -6 });
    Object.assign(definition(source), { warningTicks: 36, commitTicks: 360 });
    const passive = structuredClone(source);
    delete passive.classic.enemyPressure;
    const options = { turnPolicy },
      greedy = createRun(source, options),
      control = createRun(passive, options),
      recording = createRecorder(source, options);
    const threats = advance(greedy, 'down', 300, recording);
    advance(control, 'down', 300);
    assert.equal(greedy.classic.livesLost, 1);
    assert.equal(control.classic.livesLost, 0);
    assert.equal(greedy.failureCause, 'enemy-trail');
    const warning = threats.find((e) => e.type === 'pressure.warning'),
      committed = threats.find((e) => e.type === 'pressure.committed');
    assert.ok(warning && committed);
    assert.ok(committed.actorTick - warning.actorTick >= 36);
    checkReplay(greedy, recording);
    for (const route of [
      [
        ['down', 30],
        ['right', 30],
        ['up', 30],
      ],
      [
        ['right', 200],
        ['down', 345],
      ],
    ]) {
      const run = createRun(source, options),
        recorder = createRecorder(source, options),
        events = [];
      for (const [direction, ticks] of route)
        for (let i = 0; i < ticks; i++) {
          const frame = advance(run, direction, 1, recorder);
          events.push(...frame);
          if (frame.some((e) => e.type === 'capture.stopped')) break;
        }
      assert.ok(events.some((e) => e.type === 'capture.stopped'));
      assert.equal(run.classic.livesLost, 0);
      const stopped = { ...run.player };
      advance(run, null, 120, recorder);
      assert.deepEqual(run.player, stopped);
      assert.equal(run.classic.livesLost, 0);
      checkReplay(run, recorder);
    }
  });

  test(`${turnPolicy}: sensing requires a live exposed line, range and unobstructed field sight`, () => {
    for (const mode of ['trail-pursuit', 'head-intercept']) {
      const source = level(mode),
        run = createRun(source, { turnPolicy });
      assert.equal(
        advance(run, null, 240).some((e) => e.type.startsWith('pressure.')),
        false,
      );
      const distant = level(mode);
      definition(distant).senseRadius = 4;
      assert.equal(
        advance(createRun(distant, { turnPolicy }), 'down', 100).some((e) =>
          e.type.startsWith('pressure.'),
        ),
        false,
      );
      const wall = level(mode);
      wall.walls = [{ x: 30, y: 1, w: 1, h: 20 }];
      const hidden = createRun(wall, { turnPolicy });
      assert.equal(
        advance(hidden, 'down', 100).some((e) => e.type.startsWith('pressure.')),
        false,
      );
      assert.equal(pressure(hidden).phase, 'patrol');
    }
  });

  test(`${turnPolicy}: warning locks one observed target before steering; finite commitment and cooldown prevent continuous pursuit`, () => {
    const source = level(),
      original = structuredClone(source),
      options = { turnPolicy },
      run = createRun(source, options),
      controlLevel = structuredClone(source);
    delete controlLevel.classic.enemyPressure;
    const control = createRun(controlLevel, options);
    until(run, (s) => pressure(s).phase === 'warning');
    advance(control, 'down', run.tick);
    assert.deepEqual(
      { x: run.enemies[0].x, y: run.enemies[0].y, vx: run.enemies[0].vx, vy: run.enemies[0].vy },
      {
        x: control.enemies[0].x,
        y: control.enemies[0].y,
        vx: control.enemies[0].vx,
        vy: control.enemies[0].vy,
      },
    );
    const target = { ...pressure(run).target },
      deadline = pressure(run).warningUntil;
    advance(run, 'right', 12);
    assert.deepEqual(
      pressure(run).target,
      target,
      'No new player direction is read into the locked aim.',
    );
    until(run, (s) => s.classic.actorTick === deadline - 1, null);
    assert.equal(pressure(run).phase, 'warning');
    const priorVelocity = [run.enemies[0].vx, run.enemies[0].vy];
    const events = advance(run, null, 1);
    assert.equal(pressure(run).phase, 'committed');
    assert.ok(events.some((e) => e.type === 'pressure.committed'));
    assert.notDeepEqual([run.enemies[0].vx, run.enemies[0].vy], priorVelocity);
    near(Math.hypot(run.enemies[0].vx, run.enemies[0].vy), Math.sqrt(5));
    assert.deepEqual(pressure(run).target, target);
    until(run, (s) => pressure(s).phase === 'cooldown', null);
    const cool = pressure(run).cooldownUntil;
    assert.equal(
      advance(run, null, cool - run.classic.actorTick - 1).some(
        (e) => e.type === 'pressure.warning',
      ),
      false,
    );
    assert.equal(pressure(run).phase, 'cooldown');
    assert.deepEqual(source, original);
  });

  test(`${turnPolicy}: interception uses bounded observed heading while nearest-trail pursuit does not lead`, () => {
    const pursue = createRun(level(), { turnPolicy }),
      intercept = createRun(level('head-intercept'), { turnPolicy });
    until(pursue, (s) => pressure(s).phase === 'warning');
    advance(intercept, 'down', pursue.tick);
    assert.equal(pressure(intercept).phase, 'warning');
    near(pressure(intercept).target.x, intercept.player.x);
    assert.ok(pressure(intercept).target.y > intercept.player.y);
    assert.ok(pressure(pursue).target.y <= pursue.player.y);
    assert.ok(
      pressure(intercept).target.y - intercept.player.y <=
        definition(level('head-intercept')).senseRadius / 2,
    );
  });

  test(`${turnPolicy}: an actual freeze pickup pauses warning and movement while world time continues`, () => {
    const source = level();
    definition(source).warningTicks = 180;
    source.classic.powerups = [{ id: 'freeze', kind: 'enemy-freeze', x: 36.5, y: 7.5 }];
    const run = createRun(source, { turnPolicy });
    until(run, (s) => s.classic.powerups[0].collectedTick !== null);
    assert.equal(pressure(run).phase, 'warning');
    const actorTick = run.classic.actorTick,
      deadline = pressure(run).warningUntil,
      enemy = { x: run.enemies[0].x, y: run.enemies[0].y },
      time = run.time;
    advance(run, null, 360);
    assert.equal(run.classic.actorTick, actorTick);
    assert.equal(pressure(run).warningUntil, deadline);
    assert.equal(pressure(run).phase, 'warning');
    assert.deepEqual({ x: run.enemies[0].x, y: run.enemies[0].y }, enemy);
    near(run.time, time + 3);
    advance(run, null, 1);
    assert.equal(run.classic.actorTick, actorTick + 1);
  });

  test(`${turnPolicy}: actual closure cancels pursuit and capture-stop remains stationary through cooldown`, () => {
    const source = level();
    definition(source).commitTicks = 360;
    const run = createRun(source, { turnPolicy }),
      recorder = createRecorder(source, { turnPolicy });
    const events = until(
      run,
      (s) => s.events.some((e) => e.type === 'capture.stopped'),
      'down',
      500,
      recorder,
    );
    assert.ok(events.some((e) => e.type === 'pressure.committed'));
    assert.ok(events.some((e) => e.type === 'pressure.cancelled' && e.reason === 'trail-closed'));
    assert.equal(pressure(run).phase, 'cooldown');
    assert.equal(pressure(run).target, null);
    const stopped = { ...run.player },
      coverage = run.coverage;
    advance(run, null, 120, recorder);
    assert.deepEqual(run.player, stopped);
    assert.equal(run.coverage, coverage);
    checkReplay(run, recorder);
  });

  test(`${turnPolicy}: a real self-contact recovery cancels the lock and cannot acquire during recovery or grace`, () => {
    const source = level(),
      options = { turnPolicy },
      run = createRun(source, options),
      recorder = createRecorder(source, options);
    const events = [
      ...advance(run, 'down', 36, recorder),
      ...advance(run, 'right', 24, recorder),
      ...advance(run, 'up', 12, recorder),
      ...advance(run, 'left', 24, recorder),
    ];
    assert.ok(events.some((e) => e.type === 'pressure.committed'));
    assert.ok(events.some((e) => e.type === 'pressure.cancelled' && e.reason === 'recovery'));
    assert.equal(run.status, 'respawning');
    assert.equal(run.lives, 2);
    assert.equal(pressure(run).target, null);
    const later = advance(run, null, 300, recorder);
    assert.equal(
      later.some((e) => e.type === 'pressure.warning'),
      false,
    );
    checkReplay(run, recorder);
  });

  test(`${turnPolicy}: warning and committed saves reconstruct exact targets, deadlines and future inputs`, async () => {
    for (const phase of ['warning', 'committed']) {
      const source = level('head-intercept'),
        options = { turnPolicy },
        run = createRun(source, options),
        recorder = createRecorder(source, options),
        campaign = {
          version: 'xonix-campaign.v1',
          id: 'pressure-saves',
          revision: '1',
          levels: [source],
          classRecipes: CLASSES,
        },
        key = campaignKey(campaign);
      until(run, (s) => pressure(s).phase === phase, 'down', 300, recorder);
      const before = authoritativeCheckpoint(run),
        saved = suspendSession({
          run,
          recorder,
          campaignKey: key,
          themeId: 'fpv',
          bodyId: 'quad',
          runId: `pressure-${phase}-${turnPolicy}`,
          continuation: { direction: 'down' },
        });
      const restored = await restoreSession(saved, { campaign, campaignKey: key });
      assert.deepEqual(authoritativeCheckpoint(run), before);
      assert.deepEqual(authoritativeCheckpoint(restored.run), before);
      advance(run, 'down', 24, recorder);
      advance(restored.run, 'down', 24, restored.recorder);
      assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
      checkReplay(run, recorder);
      const altered = exportReplay(recorder, run);
      altered.level.classic.enemyPressure.actors[0].cooldownTicks++;
      assert.equal(verifyReplay(altered).match, false);
      const checkpoint = authoritativeCheckpoint(run);
      pressure(run).nextScanTick++;
      assert.notDeepEqual(
        authoritativeCheckpoint(run),
        checkpoint,
        'Conditional state is fully authoritative.',
      );
    }
  });
}

test('locked routing goes around a wall entered during warning, at authored speed and legal body clearance', () => {
  const source = level('head-intercept');
  source.walls = [{ x: 30, y: 8, w: 1, h: 8 }];
  Object.assign(source.enemies[0], { x: 28.5, y: 6.5, vx: 0, vy: 4 });
  Object.assign(definition(source), { warningTicks: 180, commitTicks: 360, leadTicks: 0 });
  const run = createRun(source);
  until(run, (s) => pressure(s).phase === 'warning');
  const target = { ...pressure(run).target };
  until(run, (s) => pressure(s).phase === 'committed', null);
  assert.deepEqual(pressure(run).target, target);
  assert.ok(pressure(run).path.length > 1, 'A direct line would intersect the wall.');
  assert.ok(pressure(run).path.some((p) => p.y < 8));
  for (let i = 0; i < 240; i++) {
    advance(run, null, 1);
    assert.equal(fitsClassicDomain(run, run.enemies[0], run.enemies[0].radius, CELL.FIELD), true);
    near(Math.hypot(run.enemies[0].vx, run.enemies[0].vy), 4);
  }
});

test('a controlled grazing-wall route is conservatively aborted without projecting a legal body or turning through the wall', () => {
  const source = level();
  source.spawn.x = 20.5;
  source.walls = [{ x: 30, y: 1, w: 1, h: 20 }];
  Object.assign(source.enemies[0], { x: 29.5, y: 8.5, vx: 0, vy: 1 });
  const run = createRun(source);
  until(run, (s) => pressure(s).phase === 'warning');
  // The initial authored schema requires clearance. Isolate a later exact-touch
  // core state, which is legal under the swept movement domain's EPS boundary.
  run.enemies[0].x = 29.75;
  const events = until(run, (s) => pressure(s).phase === 'cooldown', null);
  assert.ok(
    events.some((e) => e.type === 'pressure.cancelled' && e.reason === 'route-unavailable'),
  );
  near(run.enemies[0].x, 29.75);
  near(run.enemies[0].y, 8.5 + run.time);
  assert.equal(fitsClassicDomain(run, run.enemies[0], 0.25, CELL.FIELD), true);
});

test('a controlled topology revision invalidates an already committed snapshot before another steering step', () => {
  const run = createRun(level());
  until(run, (s) => pressure(s).phase === 'committed');
  // Isolated topology invalidation boundary; actual closure/replay is covered above.
  run.classic.topologyRevision++;
  const events = advance(run, null, 1);
  assert.ok(events.some((e) => e.type === 'pressure.cancelled' && e.reason === 'topology-changed'));
  assert.equal(pressure(run).phase, 'cooldown');
  assert.deepEqual(pressure(run).path, []);
});
