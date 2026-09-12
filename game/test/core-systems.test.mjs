import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  releaseInputs,
  getSummary,
  validateLevel,
  validateClassRecipes,
  CLASSES,
  FIXED_DT,
} from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
const base = {
  version: 'xonix-level.v1',
  id: 'systems',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.8 },
  enemies: [{ id: 'e', type: 'bouncer', x: 40.5, y: 24.5, vx: 0, vy: 0 }],
  supplies: [{ id: 'pad', x: 24.5, y: 0.5, radius: 2 }],
};
const zone = {
  id: 'radio',
  x: 20,
  y: 1,
  w: 8,
  h: 10,
  speedFactor: 0.5,
  disableBoost: true,
  lockAbility: true,
};

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: fiber bypasses the same zone that slows, removes boost and locks ordinary abilities`, () => {
    const level = {
      ...base,
      signalZones: [zone],
      objectives: [{ id: 'hidden', x: 8.5, y: 8.5, hidden: true }],
    };
    const regular = createRun(level, { turnPolicy }),
      fiber = createRun(level, { turnPolicy, classId: 'fiber' });
    stepRun(regular, { direction: 'down', boost: true }, 0.5);
    stepRun(fiber, { direction: 'down', boost: true }, 0.5);
    assert.ok(fiber.player.y > regular.player.y + 2);
    assert.equal(regular.signal.abilityBlocked, true);
    assert.equal(fiber.signal.abilityBlocked, false);
    assert.equal(regular.signal.boostBlocked, true);
    assert.equal(fiber.signal.resistant, true);
    stepRun(regular, { action: true });
    stepRun(fiber, { action: true });
    assert.equal(regular.objectives[0].revealed, false);
    assert.equal(fiber.objectives[0].revealed, true);
    assert.ok(regular.events.some((e) => e.reason === 'signal-interference'));
  });
  test(`${turnPolicy}: radio resilience never makes fiber's exposed cable immune to a field enemy`, () => {
    const state = createRun(
      {
        ...base,
        signalZones: [zone],
        enemies: [{ id: 'cutter', type: 'bouncer', x: 26.5, y: 2.5, vx: -6, vy: 0 }],
      },
      { classId: 'fiber', turnPolicy },
    );
    stepRun(state, { direction: 'down' }, 0.5);
    assert.equal(state.lives, 2);
    assert.equal(state.failureCause, 'enemy-trail');
    assert.equal(state.trail.length, 0);
  });
  test(`${turnPolicy}: impact pulse abandons the live cut, suppresses emitter and redeploys without capture or life loss`, () => {
    const state = createRun(
      {
        ...base,
        signalZones: [
          {
            ...zone,
            x: 22.5,
            y: 1,
            w: 4,
            h: 4,
            speedFactor: 1,
            disableBoost: false,
            lockAbility: false,
          },
        ],
      },
      { classId: 'impact', turnPolicy },
    );
    stepRun(state, { direction: 'down' }, 0.25);
    assert.equal(state.player.cutting, true);
    stepRun(state, { action: true });
    assert.equal(state.status, 'respawning');
    assert.equal(state.lives, 3);
    assert.equal(state.claimedCount, 0);
    assert.equal(state.trail.length, 0);
    assert.ok(state.signalZones[0].suppressedUntil > state.time);
    assert.ok(state.events.some((e) => e.type === 'craft.redeployed'));
    stepRun(state, {}, 1);
    assert.equal(state.status, 'running');
    assert.equal(state.player.y, 0.5);
    stepRun(state, { action: true });
    assert.ok(state.events.some((e) => e.reason === 'cooldown'));
  });
  test(`${turnPolicy}: challenge clocks and cable limits fail fairly while completed cuts beat later deadlines`, () => {
    const cable = createRun({ ...base, rules: { maxTrailCells: 3 } }, { turnPolicy });
    stepRun(cable, { direction: 'down' }, 0.6);
    assert.equal(cable.lives, 2);
    assert.equal(cable.failureCause, 'cable-limit');
    const timed = createRun({ ...base, rules: { cutTimeLimitSeconds: 0.25 } }, { turnPolicy });
    stepRun(timed, { direction: 'down' }, 0.6);
    assert.equal(timed.lives, 2);
    assert.equal(timed.failureCause, 'cut-timeout');
    const tie = createRun(
      { ...base, goal: { coverage: 0.4 }, rules: { timeLimitSeconds: 34.5 / 8 } },
      { turnPolicy },
    );
    stepRun(tie, { direction: 'down' }, 5);
    assert.equal(tie.status, 'lost');
    assert.equal(tie.failureCause, 'mission-timeout');
    const enough = createRun(
      { ...base, goal: { coverage: 0.4 }, rules: { timeLimitSeconds: 34.5 / 8 + FIXED_DT } },
      { turnPolicy },
    );
    stepRun(enough, { direction: 'down' }, 5);
    assert.equal(enough.status, 'won');
  });
}

test('switching requires safe hangar contact; explicit empty hangars disables it', () => {
  const outside = createRun(base);
  stepRun(outside, { direction: 'right' }, 1);
  stepRun(outside, { switchClass: 'fiber' });
  assert.equal(outside.activeClassId, 'scout');
  assert.ok(outside.events.some((e) => e.reason === 'outside-hangar'));
  const unsafe = createRun(base);
  stepRun(unsafe, { direction: 'down' }, 0.5);
  stepRun(unsafe, { switchClass: 'fiber' });
  assert.equal(unsafe.activeClassId, 'scout');
  assert.ok(unsafe.events.some((e) => e.reason === 'unsafe'));
  const disabled = createRun({ ...base, hangars: [] });
  stepRun(disabled, { switchClass: 'fiber' });
  assert.equal(disabled.activeClassId, 'scout');
  const unknown = createRun(base);
  stepRun(unknown, { switchClass: 'invented' });
  assert.ok(unknown.events.some((e) => e.reason === 'unknown-class'));
});

test('switching preserves ammo, per-class cooldowns and deployed fields without retaining an equipped shield', () => {
  const recipes = structuredClone(CLASSES);
  recipes.find((c) => c.id === 'bomber').cooldown = 8;
  const state = createRun(base, { classId: 'bomber', classRecipes: recipes });
  stepRun(state, { pickup: true });
  stepRun(state, { action: true });
  assert.equal(state.ability.ammo, 0);
  const until = state.ability.cooldownUntil,
    field = state.ability.fields[0].id;
  stepRun(state, { switchClass: 'interceptor', action: false });
  assert.equal(state.activeClassId, 'interceptor');
  assert.equal(state.ability.fields[0].id, field);
  stepRun(state, { action: true });
  assert.ok(state.ability.shieldUntil > state.time);
  stepRun(state, { switchClass: 'bomber' });
  assert.equal(state.activeClassId, 'interceptor');
  assert.ok(state.events.some((e) => e.reason === 'switch-cooldown'));
  stepRun(state, {}, 2.1);
  stepRun(state, { switchClass: 'bomber' });
  assert.equal(state.activeClassId, 'bomber');
  assert.equal(state.ability.ammo, 0);
  assert.equal(state.ability.cooldownUntil, until);
  assert.equal(state.ability.shieldUntil, 0);
  assert.equal(state.classId, 'bomber');
  assert.equal(state.classHistory.length, 3);
});

test('held class command has one edge, shell release rearms it and switched replay reconstructs all loadouts', () => {
  const options = { classId: 'bomber' },
    state = createRun(base, options),
    recorder = createRecorder(base, options, 'systems-test');
  function tick(input = {}) {
    stepRun(state, input);
    recordInput(recorder, input);
  }
  tick({ pickup: true });
  tick({ action: true });
  tick({ switchClass: 'fiber' });
  for (let i = 0; i < 260; i++) tick({ switchClass: 'fiber' });
  assert.equal(state.classHistory.length, 2);
  releaseInputs(state);
  recordRelease(recorder);
  tick({ switchClass: 'bomber' });
  const replay = exportReplay(recorder, state),
    verified = verifyReplay(replay);
  assert.equal(verified.match, true);
  assert.equal(verified.state.activeClassId, 'bomber');
  assert.equal(verified.state.ability.ammo, 0);
  assert.equal(getSummary(state).switches, 2);
  const changed = structuredClone(replay);
  changed.segments.find((s) => s.input.switchClass === 'fiber').input.switchClass = 'scout';
  assert.equal(verifyReplay(changed).match, false);
  const before = authoritativeCheckpoint(state);
  state._loadouts.fiber.cooldownUntil = 100;
  assert.notEqual(authoritativeCheckpoint(state).hash, before.hash);
});

test('stun delivery supports suppression, while a slow net does not suppress a signal emitter', () => {
  const level = {
    ...base,
    signalZones: [{ id: 'emitter', x: 23, y: 1, w: 3, h: 2, speedFactor: 0.5 }],
  };
  for (const classId of ['bomber', 'trapper']) {
    const state = createRun(level, { classId });
    stepRun(state, { pickup: true });
    stepRun(state, { action: true });
    assert.equal(state.signalZones[0].suppressedUntil > state.time, classId === 'bomber');
    stepRun(state, {}, 5);
    assert.equal(state.signalZones[0].suppressedUntil, 0);
  }
});

test('new declarative rules reject invalid geometry/values and cloned run data cannot be changed by the caller', () => {
  for (const patch of [
    { signalZones: [{ ...zone, speedFactor: 0 }] },
    { signalZones: [{ ...zone, w: 80 }] },
    { signalZones: [{ ...zone, lockAbility: 'yes' }] },
    { hangars: [{ id: 'bad', x: -1, y: 2 }] },
    { rules: { maxTrailCells: 1.5 } },
    { rules: { cutTimeLimitSeconds: -1 } },
  ])
    assert.equal(validateLevel({ ...base, ...patch }).valid, false);
  for (const patch of [
    { signalResistance: 'yes' },
    { moveSpeedMultiplier: 9 },
    { primitive: 'impact-pulse', capacity: 1 },
  ])
    assert.equal(validateClassRecipes([{ ...CLASSES[0], ...patch }]).valid, false);
  const level = { ...base, signalZones: [{ ...zone }] },
    state = createRun(level);
  level.signalZones[0].speedFactor = 0.25;
  assert.equal(state.signalZones[0].speedFactor, 0.5);
  const strange = { ...CLASSES[0], id: 'constructor' },
    custom = createRun(base, { classRecipes: [CLASSES[0], strange] });
  stepRun(custom, { switchClass: 'constructor' });
  assert.equal(custom.activeClassId, 'constructor');
  assert.equal(custom.ability.primitive, 'scan');
  const collision = createRun({ ...base, objectives: [{ id: 'home-hangar', x: 8.5, y: 8.5 }] });
  assert.equal(validateLevel(collision.level).valid, true);
});

test('mission timeout also expires during redeployment and pause alone advances no challenge time', () => {
  const state = createRun({ ...base, rules: { timeLimitSeconds: 0.25 } }, { classId: 'impact' });
  stepRun(state, { action: true });
  releaseInputs(state);
  const time = state.time;
  stepRun(state, {}, 0);
  assert.equal(state.time, time);
  stepRun(state, {}, 0.5);
  assert.equal(state.status, 'lost');
  assert.equal(state.time, 0.25);
  assert.equal(state.failureCause, 'mission-timeout');
});
