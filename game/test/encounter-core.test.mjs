import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  releaseInputs,
  getSummary,
  validateLevel,
  CELL,
  FIXED_DT,
  CLASSES,
} from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { commitCapture } from '../core/capture.mjs';
import { enemyContact } from '../core/contacts.mjs';
import { updateAbilities } from '../core/abilities.mjs';
import { planEnemy } from '../core/movement.mjs';
import { encounterCutCells, canReleaseIsolated } from '../core/encounter.mjs';

// A standalone authored fixture: no current pack/route author can change these expectations.
function level() {
  return {
    version: 'xonix-level.v2',
    id: 'encounter-core-test',
    revision: '1',
    name: 'Sentinel test',
    width: 48,
    height: 36,
    spawn: { x: 0.5, y: 18.5 },
    goal: { coverage: 0.75 },
    enemies: [{ id: 'sentinel', type: 'relay-sentinel', x: 34.5, y: 18.5 }],
    objectives: [
      { id: 'relay', x: 8.5, y: 8.5, required: true, hidden: false },
      { id: 'core', x: 34.5, y: 18.5, required: true, hidden: false },
    ],
    supplies: [{ id: 'supply', x: 0.5, y: 18.5 }],
    rules: { moveSpeed: 8, lives: 3, timeMedals: [30, 60] },
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
  };
}
function driver(run) {
  const events = [],
    inputs = [];
  const tick = (input = {}) => {
    assert.ok(['running', 'respawning'].includes(run.status), 'route must still be live');
    stepRun(run, input, FIXED_DT);
    inputs.push(structuredClone(input));
    events.push(...structuredClone(run.events));
  };
  const move = (ticks, direction) => {
    for (let i = 0; i < ticks && run.status !== 'won'; i++) tick({ direction });
  };
  const wait = (predicate, limit = 10000) => {
    for (let i = 0; !predicate(); i++) {
      assert.ok(i < limit, 'finite route budget');
      tick();
    }
  };
  return { run, events, inputs, tick, move, wait };
}
function relayRoute(policy = 'immediate', source = level(), classId = 'scout') {
  const d = driver(createRun(source, { turnPolicy: policy, classId }));
  d.move(270, 'up');
  d.move(180, 'right');
  d.wait(() => d.run.encounter.phase === 'rest');
  d.move(525, 'down');
  assert.equal(d.run.encounter.transitionTick, 1083);
  assert.equal(d.run.objectives[0].captured, true);
  d.move(120, 'right');
  return d;
}
const atOpen = (policy = 'immediate') => {
  const d = relayRoute(policy);
  d.wait(() => d.run.encounter.phase === 'open');
  return d;
};
const trailCell = (x, y) => ({ x, y, index: y * 48 + x });

// Transaction/contact fixtures below intentionally set a narrow precondition, not a playable win.
// Actual no-mutation, public-input routes are asserted separately in both steering modes.
function cutFixture(count = 8, phase = 'open') {
  const run = atOpen().run;
  run.encounter.phase = phase;
  run.player.cutting = true;
  run.trail = Array.from({ length: count }, (_, i) => trailCell(13 + i, 5));
  run.events = [];
  return run;
}
function isolatedFixture() {
  const run = atOpen().run;
  // Model a previously secured remnant; only the occupied core remains unclaimed.
  for (let y = 1; y < 35; y++) for (let x = 1; x < 47; x++) run.cells[y * 48 + x] = CELL.SAFE;
  run.cells[18 * 48 + 34] = CELL.FIELD;
  run.claimedCount = run.totalClaimable - 1;
  run.coverage = run.claimedCount / run.totalClaimable;
  return run;
}

test('v2 descriptor owns data and rejects malformed keys, references and other field anchors', () => {
  const source = level();
  assert.equal(validateLevel(source).valid, true);
  const owned = normalizedLevel(source);
  source.encounter.exposed.openTicks = 1;
  assert.equal(owned.encounter.exposed.openTicks, 480);
  const invalid = [
    (l) => delete l.encounter,
    (l) => {
      l.version = 'xonix-level.v1';
    },
    (l) => {
      l.encounter.extra = 1;
    },
    (l) => {
      l.encounter.shielded.extra = 1;
    },
    (l) => {
      l.encounter.exposed.openTicks = 0;
    },
    (l) => {
      l.encounter.transitionTicks = 1.5;
    },
    (l) => {
      l.encounter.initialDelayTicks = 7201;
    },
    (l) => {
      l.encounter.minReleaseCutCells = 129;
    },
    (l) => {
      l.encounter.laneWidth = NaN;
    },
    (l) => {
      l.encounter.coreObjectiveId = 'missing';
    },
    (l) => {
      l.encounter.coreObjectiveId = 'relay';
    },
    (l) => {
      l.objectives[0].required = false;
    },
    (l) => {
      l.objectives[1].hidden = true;
    },
    (l) => {
      l.objectives[1].x = 35.5;
    },
    (l) => {
      l.objectives[0].x = 34.5;
      l.objectives[0].y = 18.5;
    },
    (l) => {
      l.enemies[0].vx = 0;
    },
    (l) => {
      l.enemies[0].x = 34;
      l.enemies[0].y = 18;
      l.encounter.minReleaseCutCells = 1;
    },
    (l) => {
      l.enemies[0].x = 34.49;
    },
    (l) => {
      l.enemies[0].period = 4;
    },
    (l) => {
      l.enemies.push({ id: 'other', type: 'bouncer', x: 20, y: 20, vx: 1, vy: 1 });
    },
    (l) => {
      l.enemies.push({ id: 'other', type: 'relay-sentinel', x: 20, y: 20 });
    },
    (l) => {
      l.encounter = JSON.stringify(l.encounter);
    },
    (l) => {
      l.typoEncounter = {};
    },
  ];
  for (const mutate of invalid) {
    const candidate = level();
    mutate(candidate);
    assert.equal(validateLevel(candidate).valid, false, mutate.toString());
  }
});

test('new branch rejects accessors, hidden fields and prototype payloads without invocation', () => {
  let calls = 0;
  for (const path of [
    ['version'],
    ['encounter'],
    ['encounter', 'version'],
    ['encounter', 'exposed', 'openTicks'],
  ]) {
    const candidate = level();
    let parent = candidate;
    for (const key of path.slice(0, -1)) parent = parent[key];
    Object.defineProperty(parent, path.at(-1), {
      enumerable: true,
      get() {
        calls++;
        throw new Error('getter executed');
      },
    });
    assert.equal(validateLevel(candidate).valid, false);
  }
  const inherited = level();
  Object.setPrototypeOf(inherited.encounter, { injected: true });
  assert.equal(validateLevel(inherited).valid, false);
  const hidden = level();
  Object.defineProperty(hidden.encounter, 'hidden', { value: true });
  assert.equal(validateLevel(hidden).valid, false);
  assert.equal(calls, 0);
});

test('minimum must fit claimable cells; finite timings accept endpoints', () => {
  const source = level();
  for (const key of ['initialDelayTicks', 'transitionTicks']) source.encounter[key] = 7200;
  source.encounter.laneWidth = 0.25;
  source.encounter.minReleaseCutCells = 1;
  assert.equal(validateLevel(source).valid, true);
  source.encounter.minReleaseCutCells = 128;
  source.walls = [
    { x: 1, y: 1, w: 46, h: 17 },
    { x: 1, y: 19, w: 46, h: 16 },
  ];
  source.objectives[0] = { ...source.objectives[0], x: 8.5, y: 18.5 };
  assert.match(validateLevel(source).errors.join(' '), /claimable/);
});

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: legal unboosted no-ability two-stage route orders capture, defeat and result`, () => {
    const d = atOpen(policy);
    assert.equal(d.run.tick, 1588);
    assert.equal(d.run.encounter.phaseStartTick, 1588);
    assert.equal(d.run.encounter.phaseEndTick, 2068);
    d.move(90, 'up');
    d.move(120, 'left');
    assert.equal(d.run.status, 'won');
    assert.equal(d.run.tick, 1791);
    assert.equal(d.run.lives, 3);
    assert.equal(d.run.coverage, 1);
    assert.equal(d.run.encounter.qualifyingCutCells, 13);
    assert.equal(d.run.encounter.defeatCause, 'cut-release');
    assert.equal(d.events.filter((e) => e.type === 'encounter.defeated').length, 1);
    assert.equal(d.events.filter((e) => e.type === 'run.completed').length, 1);
    assert.deepEqual(
      d.events.slice(-5).map((e) => e.type),
      ['cut.closed', 'cells.claimed', 'objective.captured', 'encounter.defeated', 'run.completed'],
    );
    assert.ok(
      d.inputs.every(
        (input) => !input.action && !input.pickup && !input.boost && !input.switchClass,
      ),
    );
    const terminal = structuredClone(d.run.encounter);
    stepRun(d.run, { direction: 'right' });
    assert.deepEqual(d.run.encounter, terminal);
    assert.deepEqual(d.run.events, []);
  });
  test(`${policy}: two missed openings repeat, pause consumes no phases and third opening wins`, () => {
    const d = atOpen(policy);
    const before = structuredClone(d.run.encounter);
    releaseInputs(d.run);
    stepRun(d.run, {}, 0);
    assert.deepEqual(d.run.encounter, before);
    for (let i = 0; i < 2; i++) {
      d.wait(() => d.run.encounter.phase !== 'open');
      d.wait(() => d.run.encounter.phase === 'open');
    }
    assert.equal(d.run.encounter.cycle, 3);
    assert.equal(d.run.status, 'running');
    d.move(90, 'up');
    d.move(120, 'left');
    assert.equal(d.run.status, 'won');
    assert.equal(d.run.tick, 3399);
  });
  test(`${policy}: scheduling at 10/30/60/120 FPS retains full authority and phase events`, () => {
    const d = atOpen(policy);
    d.move(90, 'up');
    d.move(120, 'left');
    for (const frameTicks of [12, 4, 2, 1]) {
      const run = createRun(level(), { turnPolicy: policy });
      const events = [];
      for (let i = 0; i < d.inputs.length; ) {
        let size = 1;
        while (
          size < frameTicks &&
          i + size < d.inputs.length &&
          JSON.stringify(d.inputs[i]) === JSON.stringify(d.inputs[i + size])
        )
          size++;
        stepRun(run, d.inputs[i], size * FIXED_DT);
        events.push(...run.events);
        i += size;
      }
      assert.deepEqual(getSummary(run), getSummary(d.run));
      assert.deepEqual(run.encounter, d.run.encounter);
      assert.deepEqual(events, d.events);
    }
  });
}

test('phase endpoints are half-open; warning locks one lane, relay cancels old lane mid-tick', () => {
  const d = driver(createRun(level()));
  d.move(240, null);
  assert.equal(d.run.encounter.phase, 'delay');
  d.tick();
  assert.equal(d.run.encounter.phase, 'warning');
  assert.equal(d.run.encounter.lane, 18.5);
  d.move(100, 'up');
  assert.equal(d.run.encounter.lane, 18.5);
  d.wait(() => d.run.tick === 480);
  assert.equal(d.run.encounter.phase, 'warning');
  d.tick();
  assert.equal(d.run.encounter.phase, 'active');
  d.wait(() => d.run.tick === 564);
  assert.equal(d.run.encounter.phase, 'active');
  d.tick();
  assert.equal(d.run.encounter.phase, 'rest');
  const relay = relayRoute();
  const transition = relay.events.find((e) => e.type === 'encounter.stageChanged');
  assert.equal(transition.tick, 1083);
  assert.equal(transition.phaseStartTick, 1084);
  assert.equal(transition.phaseEndTick, 1264);
  assert.equal(transition.lane, null);
  assert.ok(
    transition.time > (transition.tick - 1) * FIXED_DT &&
      transition.time < transition.tick * FIXED_DT,
  );
  relay.wait(() => relay.run.tick === 1263);
  assert.equal(relay.run.encounter.phase, 'transition');
  relay.tick();
  assert.equal(relay.run.encounter.phase, 'warning');
  assert.equal(relay.run.encounter.axis, 'vertical');
});

test('only distinct new FIELD cells in this cut count; short cuts keep normal capture without banking', () => {
  const run = cutFixture(7);
  commitCapture(run);
  assert.equal(run.encounter.defeated, false);
  assert.equal(run.encounter.qualifyingCutCells, 0);
  assert.equal(run.events[0].type, 'cut.closed');
  assert.ok(run.events[0].cells >= 7);
  assert.ok(run.cells.filter((cell) => cell === CELL.FIELD).length > 8);
  run.player.cutting = true;
  run.trail = Array.from({ length: 7 }, (_, i) => trailCell(13 + i, 7));
  commitCapture(run);
  assert.equal(run.encounter.defeated, false);
  run.player.cutting = true;
  run.trail = Array.from({ length: 8 }, (_, i) => trailCell(1 + i, 5));
  assert.equal(encounterCutCells(run), 0);
  commitCapture(run);
  assert.equal(run.encounter.defeated, false);
  run.player.cutting = true;
  run.trail = Array.from({ length: 8 }, () => trailCell(25, 5));
  assert.equal(encounterCutCells(run), 1);
  commitCapture(run);
  assert.equal(run.encounter.defeated, false);
  const eight = cutFixture(8);
  commitCapture(eight);
  assert.equal(eight.encounter.defeated, true);
  assert.equal(eight.encounter.qualifyingCutCells, 8);
});

test('a stage-one capture that secures the relay cannot reuse its long cut for defeat', () => {
  const run = createRun(level());
  run.tick = 12;
  run.player.cutting = true;
  run.trail = Array.from({ length: 34 }, (_, y) => trailCell(12, y + 1));
  commitCapture(run);
  assert.equal(run.encounter.stage, 'transition');
  assert.equal(run.encounter.defeated, false);
  assert.equal(run.encounter.qualifyingCutCells, 0);
  assert.deepEqual(
    run.events.map((e) => e.type),
    ['cut.closed', 'cells.claimed', 'objective.captured', 'encounter.stageChanged'],
  );
});

for (const policy of ['immediate', 'grid-center'])
  for (const [closingTick, outcome] of [
    [1587, 'respawning'],
    [1588, 'won'],
    [2067, 'won'],
    [2068, 'running'],
  ])
    test(`${policy}: closing transaction at tick ${closingTick} uses that tick's phase and contact priority`, () => {
      const d = relayRoute(policy);
      d.wait(() => d.run.tick === closingTick - 1);
      const run = d.run;
      run.player = {
        ...run.player,
        x: 13.025,
        y: 5.5,
        direction: 'left',
        cutting: true,
        graceUntil: 0,
      };
      run.trail = Array.from({ length: 8 }, (_, i) => trailCell(20 - i, 5));
      run.trailSegments = [];
      run.cutStartedAt = run.time - 1;
      stepRun(run, { direction: 'left' });
      assert.equal(run.status, outcome);
      assert.equal(run.encounter.defeated, outcome === 'won');
      if (outcome === 'respawning') {
        assert.equal(run.events.find((e) => e.type === 'player.failed').cause, 'boss-lane');
        assert.ok(
          !run.events.some((e) => e.type === 'cut.closed' || e.type === 'encounter.defeated'),
        );
      }
    });

test('stun suppresses only stripe; expiry restores it without delaying phases or body/trail contact', () => {
  const run = cutFixture(8, 'active');
  const stationary = [{ x1: 13.5, y1: 5.5, x2: 13.5, y2: 5.5, t0: 0, t1: FIXED_DT }];
  const trace = { cells: [], started: null };
  const contact = () =>
    enemyContact(
      run,
      stationary,
      run.enemies.map((e) => planEnemy(run, e, FIXED_DT)),
      trace,
      FIXED_DT,
    );
  assert.equal(contact().kind, 'boss-lane');
  run.ability.fields = [
    { kind: 'stun-field', x: 34.5, y: 18.5, radius: 3, until: run.time + FIXED_DT },
  ];
  updateAbilities(run);
  assert.equal(contact(), null);
  run.trail.push(trailCell(34, 18));
  assert.equal(contact().kind, 'enemy-trail');
  run.trail.pop();
  const originalPhase = structuredClone(run.encounter);
  run.time += FIXED_DT;
  updateAbilities(run);
  assert.equal(contact().kind, 'boss-lane');
  assert.deepEqual(run.encounter, originalPhase);
});

test('core raster grazing returns contact even at the exact closing horizon, including while stunned', () => {
  const run = atOpen().run;
  run.player.cutting = true;
  run.enemies[0].stunnedUntil = run.time + 10;
  const horizon = FIXED_DT;
  const contact = enemyContact(
    run,
    [{ x1: 30, y1: 18.5, x2: 30.1, y2: 18.5, t0: 0, t1: horizon }],
    run.enemies.map((e) => planEnemy(run, e, horizon)),
    { cells: [{ index: 18 * 48 + 34, time: horizon }], started: 0, closure: horizon },
    horizon,
  );
  assert.equal(contact.time, horizon);
  assert.equal(contact.kind, 'enemy-trail');
});

test('slow fields do not change encounter scheduling; supported abilities preserve the same phase clock', () => {
  const slow = atOpen();
  slow.run.ability.fields = [
    { kind: 'slow-field', x: 34.5, y: 18.5, radius: 3, until: slow.run.time + 10, slowFactor: 0.1 },
  ];
  updateAbilities(slow.run);
  assert.equal(slow.run.enemies[0].slowFactor, 0.1);
  slow.wait(() => slow.run.tick === 2068);
  assert.equal(slow.run.enemies[0].slowFactor, 0.1);
  assert.equal(slow.run.encounter.phase, 'warning');
  assert.equal(slow.run.encounter.phaseStartTick, 2068);
  for (const recipe of CLASSES) {
    const run = createRun(level(), { classId: recipe.id });
    for (let i = 0; i < 565; i++) stepRun(run, { pickup: i === 0, action: i === 1 });
    assert.equal(run.encounter.phase, 'rest', recipe.id);
    assert.equal(run.encounter.phaseStartTick, 565, recipe.id);
    assert.equal(run.encounter.phaseEndTick, 961, recipe.id);
    assert.equal(run.encounter.defeated, false, recipe.id);
  }
});

test('failure and shield absorption discard cut credit while preserving relay, stage and clock', () => {
  for (const shield of [false, true]) {
    const run = cutFixture(8);
    run.encounter.phase = 'active';
    run.encounter.phaseEndTick = run.tick + 20;
    if (shield) run.ability.shieldUntil = run.time + 1;
    stepRun(run, {});
    assert.equal(run.status, 'respawning');
    assert.equal(run.lives, shield ? 3 : 2);
    assert.equal(run.encounter.stage, 'exposed');
    assert.equal(run.objectives[0].captured, true);
    assert.equal(run.encounter.qualifyingCutCells, 0);
    assert.equal(encounterCutCells(run), 0);
    assert.ok(run.events.some((e) => e.type === (shield ? 'shield.absorbed' : 'player.failed')));
    const end = run.encounter.phaseEndTick;
    while (run.tick < end) stepRun(run, {});
    assert.equal(run.encounter.phase, 'open');
    assert.equal(run.encounter.defeated, false);
  }
});

test('impact abandons a qualifying open cut and redeploys without release', () => {
  const run = cutFixture(8);
  const recipe = CLASSES.find((r) => r.primitive === 'impact-pulse');
  // Recipe/state setup is explicit; the actual ability transition goes through public input.
  const impact = createRun(level(), { classId: recipe.id });
  Object.assign(run, {
    classId: impact.classId,
    activeClassId: impact.activeClassId,
    classRecipe: impact.classRecipe,
    ability: impact.ability,
    _loadouts: impact._loadouts,
  });
  stepRun(run, { action: true });
  assert.equal(run.status, 'respawning');
  assert.equal(run.trail.length, 0);
  assert.equal(run.encounter.defeated, false);
  assert.equal(run.encounter.qualifyingCutCells, 0);
  assert.ok(run.events.some((e) => e.type === 'craft.redeployed'));
});

test('isolation fills the sole remaining core with no synthetic cut event', () => {
  const run = isolatedFixture();
  assert.equal(canReleaseIsolated(run), true);
  stepRun(run, {});
  assert.equal(run.status, 'won');
  assert.equal(run.encounter.defeatCause, 'isolated');
  assert.equal(run.encounter.qualifyingCutCells, 0);
  assert.equal(run.objectives[1].captured, true);
  assert.deepEqual(
    run.events.map((e) => e.type),
    ['cells.claimed', 'objective.captured', 'encounter.defeated', 'run.completed'],
  );
});

test('isolation requires open, safe, no cut and a genuinely running world tick', () => {
  for (const mutation of [
    (r) => {
      r.encounter.phase = 'warning';
    },
    (r) => {
      r.encounter.phase = 'active';
    },
    (r) => {
      r.encounter.stage = 'transition';
      r.encounter.phase = 'transition';
    },
    (r) => {
      r.player.cutting = true;
    },
    (r) => {
      r.trail = [trailCell(34, 18)];
    },
    (r) => {
      r.player.x = 34.5;
      r.player.y = 18.5;
    },
    (r) => {
      for (let i = 1; i <= 9; i++) r.cells[20 * 48 + i] = CELL.FIELD;
    },
    (r) => {
      r.status = 'respawning';
      r.respawnAt = r.time + 0.1;
    },
  ]) {
    const run = isolatedFixture();
    mutation(run);
    assert.equal(canReleaseIsolated(run), false, mutation.toString());
  }
  const respawn = isolatedFixture();
  respawn.status = 'respawning';
  respawn.respawnAt = respawn.time;
  stepRun(respawn, {});
  assert.equal(respawn.status, 'running');
  assert.equal(respawn.encounter.defeated, false);
  assert.ok(respawn.events.some((e) => e.type === 'player.respawned'));
  stepRun(respawn, {});
  assert.equal(respawn.status, 'won');
});

test('a border patrol remains a nonseed but contact defeats the isolation win on the same tick', () => {
  const source = level();
  source.enemies.push({ id: 'patrol', type: 'border-patrol', x: 20.5, y: 35.5, speed: 0 });
  assert.equal(validateLevel(source).valid, true);
  const run = isolatedFixture();
  run.enemies.push(createRun(source).enemies[1]);
  assert.equal(canReleaseIsolated(run), true);
  stepRun(run, {});
  assert.equal(run.status, 'respawning');
  assert.equal(run.encounter.defeated, false);
  assert.ok(!run.events.some((e) => e.type === 'cells.claimed' || e.type === 'encounter.defeated'));
});

test('terminal loss/timeout and same-tick impact cannot trigger isolated release', () => {
  const lost = isolatedFixture();
  lost.lives = 1;
  lost.player.cutting = true;
  lost.trail = [trailCell(34, 18)];
  stepRun(lost, {});
  assert.equal(lost.status, 'lost');
  assert.equal(lost.encounter.defeated, false);
  const timeout = isolatedFixture();
  timeout.rules.timeLimitSeconds = timeout.time + FIXED_DT / 2;
  stepRun(timeout, {});
  assert.equal(timeout.status, 'lost');
  assert.equal(timeout.encounter.defeated, false);
  const redeploy = isolatedFixture();
  const impact = createRun(level(), { classId: 'impact' });
  redeploy.classRecipe = impact.classRecipe;
  redeploy.ability = impact.ability;
  stepRun(redeploy, { action: true });
  assert.equal(redeploy.status, 'respawning');
  assert.equal(redeploy.encounter.defeated, false);
});

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: legal successive short captures isolate the core and complete without a release cut`, () => {
    const d = relayRoute(policy);
    const open = () => d.run.encounter.phase === 'open';
    const freshOpen = () => {
      if (open()) d.wait(() => !open());
      d.wait(open);
    };
    d.move(120, 'left');
    d.move(525, 'up');
    d.move(315, 'right');
    freshOpen();
    d.move(525, 'down');
    assert.equal(d.run.status, 'running');
    assert.ok(d.run.coverage > 0.7);
    d.move(30, 'right');
    freshOpen();
    d.move(525, 'up');
    assert.equal(d.run.status, 'running');
    assert.equal(d.run.cells.filter((cell) => cell === CELL.FIELD).length, 34);
    d.move(255, 'down');
    freshOpen();
    d.move(30, 'left');
    d.move(30, 'down');
    d.move(30, 'right');
    assert.equal(d.run.status, 'won');
    assert.equal(d.run.lives, 3);
    assert.equal(d.run.encounter.defeatCause, 'isolated');
    assert.equal(d.run.encounter.qualifyingCutCells, 0);
    assert.equal(d.events.filter((e) => e.type === 'encounter.defeated').length, 1);
    const defeat = d.events.findIndex((e) => e.type === 'encounter.defeated');
    assert.equal(d.events[defeat - 1].type, 'objective.captured');
    // Final short closure owns one claim transaction; isolated release owns a separate one.
    assert.deepEqual(
      d.events.slice(defeat - 4, defeat + 1).map((e) => e.type),
      ['cut.closed', 'cells.claimed', 'cells.claimed', 'objective.captured', 'encounter.defeated'],
    );
  });

  test(`${policy}: a real relay capture leaving one FIELD cell still waits through the complete first stage2 attack`, () => {
    const source = level();
    source.spawn = { x: 0.5, y: 2.5 };
    source.objectives[0] = { id: 'relay', x: 2.5, y: 2.5, required: true };
    source.supplies = [];
    source.walls = [];
    const field = (x, y) => (x <= 3 && y <= 3) || (x === 34 && y === 18);
    for (let y = 1; y < 35; y++)
      for (let x = 1; x < 47; ) {
        if (field(x, y)) {
          x++;
          continue;
        }
        const start = x;
        while (x < 47 && !field(x, y)) x++;
        source.walls.push({ x: start, y, w: x - start, h: 1 });
      }
    assert.equal(validateLevel(source).valid, true);
    const d = driver(createRun(source, { turnPolicy: policy }));
    d.move(30, 'right');
    d.move(30, 'up');
    assert.equal(d.run.encounter.stage, 'transition');
    assert.equal(d.run.cells.filter((cell) => cell === CELL.FIELD).length, 1);
    const transitionTick = d.run.encounter.transitionTick;
    const firstWarning = transitionTick + 181;
    const firstActive = firstWarning + 240;
    const firstOpen = firstActive + 84;
    d.wait(() => d.run.tick === firstWarning);
    assert.equal(d.run.encounter.phase, 'warning');
    d.wait(() => d.run.tick === firstActive);
    assert.equal(d.run.encounter.phase, 'active');
    d.wait(() => d.run.tick === firstOpen - 1);
    assert.equal(d.run.status, 'running');
    d.tick();
    assert.equal(d.run.status, 'won');
    assert.equal(d.run.encounter.defeatCause, 'isolated');
    assert.equal(d.events.filter((e) => e.type === 'cut.closed').length, 1);
  });
}

test('centered sentinel keeps the minimum-one fallback reachable and never silently snaps authored coordinates', () => {
  for (const position of [
    { x: 34, y: 18 },
    { x: 34.49, y: 18.5 },
    { x: 34.5, y: 18.51 },
  ]) {
    const source = level();
    Object.assign(source.enemies[0], position);
    source.encounter.minReleaseCutCells = 1;
    assert.match(validateLevel(source).errors.join(' '), /cell center/);
    assert.throws(() => createRun(source), /cell center/);
    assert.equal(source.enemies[0].x, position.x);
    assert.equal(source.enemies[0].y, position.y);
  }
  const source = level();
  source.enemies[0].radius = 0.45;
  source.encounter.minReleaseCutCells = 1;
  assert.equal(validateLevel(source).valid, true);
});

for (const policy of ['immediate', 'grid-center'])
  test(`${policy}: branched 13-cell remnant with longest path7 is reducible by short cuts to isolated release`, () => {
    const run = atOpen(policy).run;
    // Controlled already-captured topology: a cross with three cells on each arm.
    // This is a capture-algorithm fixture, not a claimed route from the authored start.
    for (let y = 1; y < 35; y++) for (let x = 1; x < 47; x++) run.cells[y * 48 + x] = CELL.SAFE;
    const remaining = new Set([trailCell(34, 18).index]);
    for (let delta = 1; delta <= 3; delta++)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        remaining.add(trailCell(34 + delta * dx, 18 + delta * dy).index);
    for (const index of remaining) run.cells[index] = CELL.FIELD;
    assert.equal(remaining.size, 13);
    let longest = 0;
    for (const start of remaining) {
      const queue = [[start, 1]],
        visited = new Set([start]);
      for (const [index, length] of queue) {
        longest = Math.max(longest, length);
        for (const neighbor of [index - 1, index + 1, index - 48, index + 48])
          if (remaining.has(neighbor) && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push([neighbor, length + 1]);
          }
      }
    }
    assert.equal(longest, 7);
    assert.ok(longest < run.level.encounter.minReleaseCutCells);
    run.claimedCount = run.totalClaimable - remaining.size;
    run.coverage = run.claimedCount / run.totalClaimable;
    run.player.x = 35.5;
    run.player.y = 15.5;
    assert.equal(canReleaseIsolated(run), false);
    const d = driver(run);
    for (const moves of [
      [[30, 'left']],
      [
        [15, 'down'],
        [30, 'right'],
      ],
      [
        [15, 'down'],
        [30, 'left'],
      ],
      [
        [30, 'left'],
        [30, 'down'],
      ],
    ]) {
      for (const [ticks, direction] of moves) d.move(ticks, direction);
      assert.equal(run.status, 'running');
      assert.equal(run.encounter.defeated, false);
      assert.ok(run.cells.filter((cell) => cell === CELL.FIELD).length > 8);
    }
    d.move(15, 'right');
    d.move(30, 'up');
    assert.equal(run.status, 'won');
    assert.equal(run.lives, 3);
    assert.equal(run.encounter.defeatCause, 'isolated');
    assert.equal(run.encounter.qualifyingCutCells, 0);
    assert.equal(d.events.filter((e) => e.type === 'cut.closed').length, 5);
  });

test('staged relay cannot use the legacy border-objective boundary as an automatic shield capture', () => {
  for (const [x, y] of [
    [47, 8.5],
    [8.5, 35],
  ]) {
    const source = level();
    Object.assign(source.objectives[0], { x, y });
    assert.match(validateLevel(source).errors.join(' '), /claimable interior/);
    // Preserve v1's previous acceptance; this tightening belongs only to the finite recipe.
    delete source.encounter;
    source.version = 'xonix-level.v1';
    source.enemies = [];
    assert.equal(validateLevel(source).valid, true);
  }
});
