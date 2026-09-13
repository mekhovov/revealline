import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, validateLevel, CLASSES, FIXED_DT } from '../core/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';

function level(arcade = true) {
  return {
    version: 'xonix-level.v4',
    id: 'arcade-policy-proof',
    revision: '1',
    name: 'Authored Arcade policy',
    width: 72,
    height: 36,
    encounter: null,
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      ...(arcade ? { arcadeActions: { version: 'arcade-actions.v1' } } : {}),
    },
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 60.5, y: 20.5, vx: 0.1, vy: 0 }],
    objectives: [{ id: 'hidden', x: 36.5, y: 8.5, required: false, hidden: true }],
    supplies: [{ id: 'home-supply', x: 36.5, y: 0.5, radius: 2 }],
    rules: { moveSpeed: 12, boostMultiplier: 2, lives: 3, stopOnCapture: true },
  };
}
function advance(run, input, ticks, recorder) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    if (recorder) recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    events.push(...run.events);
  }
  return events;
}

test('Arcade actions require an explicit strict versioned classic descriptor, never a name or ID', () => {
  assert.equal(validateLevel(level()).valid, true);
  assert.deepEqual(arcadeActionCapabilities(level()), {
    manualAbility: false,
    manualPickup: false,
    manualBoost: false,
  });
  assert.equal(Object.isFrozen(arcadeActionCapabilities(level())), true);
  assert.deepEqual(arcadeActionCapabilities(level(false)), {
    manualAbility: true,
    manualPickup: true,
    manualBoost: true,
  });
  assert.equal(Object.hasOwn(createRun(level(false)).level.classic, 'arcadeActions'), false);
  for (const value of [
    null,
    false,
    {},
    'arcade-actions.v1',
    { version: 'arcade-actions.v2' },
    { version: 'arcade-actions.v1', scan: true },
  ]) {
    const source = level();
    source.classic.arcadeActions = value;
    assert.equal(validateLevel(source).valid, false);
    assert.throws(() => createRun(source));
  }
  for (const version of ['xonix-level.v1', 'xonix-level.v2', 'xonix-level.v3']) {
    const source = level();
    source.version = version;
    assert.equal(validateLevel(source).valid, false);
  }
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: all seven loadouts ignore manual actions and boost at core authority`, () => {
    for (const { id: classId } of CLASSES) {
      const source = level(),
        options = { classId, turnPolicy },
        clean = createRun(source, options),
        attempted = createRun(source, options);
      const input = Object.freeze({ direction: 'down', action: true, pickup: true, boost: true });
      const cleanEvents = advance(clean, { direction: 'down' }, 30);
      assert.deepEqual(advance(attempted, input, 30), cleanEvents, classId);
      assert.deepEqual(authoritativeCheckpoint(attempted), authoritativeCheckpoint(clean), classId);
      assert.equal(attempted.ability.ammo, 0);
      assert.equal(attempted.ability.cooldownUntil, 0);
      assert.equal(attempted.objectives[0].revealed, false);
      assert.equal(attempted.status, 'running');
      assert.deepEqual(source, level(), 'Run creation/stepping does not mutate the recipe.');
      assert.equal(input.boost, true, 'Filtering does not rewrite the caller recording.');
    }
  });

  test(`${turnPolicy}: all four contact pickups still apply without an ability or supply button`, () => {
    const source = level();
    source.classic.powerups = ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'].map(
      (kind, i) => ({ id: kind, kind, x: 36.5, y: i + 1.5 }),
    );
    const run = createRun(source, { turnPolicy });
    const events = advance(run, { direction: 'down' }, 60);
    assert.equal(events.filter((e) => e.type === 'powerup.collected').length, 4);
    assert.equal(
      events.some((e) => e.type === 'ability.used' || e.type === 'pickup.collected'),
      false,
    );
    assert.equal(run.lives, 4);
    assert.equal(
      run.classic.powerups.every((p) => Number.isInteger(p.collectedTick)),
      true,
    );
    for (const effect of Object.values(run.classic.effects)) assert.ok(effect.until > run.tick);
    assert.ok(run.player.y > 6.5, 'The authored speed pickup increases ordinary movement.');
  });

  test(`${turnPolicy}: recorded manual attempts restore exactly and policy removal cannot validate the same checkpoint`, async () => {
    const source = level(),
      options = { turnPolicy, classId: 'scout' },
      run = createRun(source, options),
      recorder = createRecorder(source, options);
    advance(run, { direction: 'down', action: true, pickup: true, boost: true }, 13, recorder);
    advance(run, { direction: 'right', action: true, pickup: true, boost: true }, 1, recorder);
    const campaign = {
        version: 'xonix-campaign.v1',
        id: 'arcade-proof-campaign',
        revision: '1',
        levels: [source],
        classRecipes: CLASSES,
      },
      key = campaignKey(campaign),
      before = authoritativeCheckpoint(run),
      replay = exportReplay(recorder, run);
    assert.equal(verifyReplay(replay).match, true);
    const saved = suspendSession({
      run,
      recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'quad',
      runId: `arcade-${turnPolicy}`,
      continuation: { direction: 'right' },
    });
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    advance(run, { direction: 'right', action: true, pickup: true, boost: true }, 12, recorder);
    advance(restored.run, { direction: 'right' }, 12, restored.recorder);
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    const altered = structuredClone(replay);
    delete altered.level.classic.arcadeActions;
    assert.equal(verifyReplay(altered).match, false);
  });
}

test('absent Arcade policy retains real Scan, supply refill, charged ability and Boost behavior', () => {
  const source = level(false),
    scan = createRun(source);
  stepRun(scan, { action: true }, FIXED_DT);
  assert.equal(scan.objectives[0].revealed, true);
  assert.equal(
    scan.events.some((e) => e.type === 'ability.used'),
    true,
  );
  const charged = createRun(source, { classId: 'bomber' });
  stepRun(charged, { pickup: true }, FIXED_DT);
  assert.equal(charged.ability.ammo, 1);
  stepRun(charged, { action: true }, FIXED_DT);
  assert.equal(charged.ability.ammo, 0);
  assert.equal(charged.ability.fields.length, 1);
  const normal = createRun(source),
    boost = createRun(source);
  advance(normal, { direction: 'down' }, 30);
  advance(boost, { direction: 'down', boost: true }, 30);
  assert.ok(boost.player.y > normal.player.y);
});
