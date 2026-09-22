import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, CLASSES } from '../core/index.mjs';
import { createRecorder, exportReplay, verifyReplay, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { combatLevel, patrol, combat, ticks } from './helpers/combat-fixture.mjs';

for (const turnPolicy of ['immediate', 'grid-center'])
  for (const seed of [1, 7])
    for (const scenario of ['ram', 'capture', 'evade'])
      test(`public inputs and equal paired boards: ${scenario}/${turnPolicy}/seed${seed}`, () => {
        const level = combatLevel(scenario === 'evade' ? 'sentry' : 'scout');
        if (scenario === 'capture') level.classic.combatPatrols.actors[0].y = 28.5;
        const options = { seed, turnPolicy, classId: 'scout' };
        const run = createRun(level, options),
          peer = createRun(level, options);
        const recorder = createRecorder(level, options);
        const events = ticks(run, 1000, 'right', recorder);
        ticks(peer, 1000, 'right');
        assert.equal(run.status, 'won');
        assert.equal(run.classic.livesLost, 0);
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
        assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(peer));
        if (scenario === 'evade') {
          assert(events.some((e) => e.type === 'combat.locked'));
          assert(events.some((e) => e.type === 'combat.fired'));
          assert(!events.some((e) => e.type === 'combat.impact'));
        } else {
          const removed = events.filter((e) => e.type === 'combat.eliminated');
          assert.equal(removed.length, 1);
          assert.equal(removed[0].cause, scenario);
          assert.equal(patrol(run).alive, false);
        }
        const noCombat = structuredClone(level);
        noCombat.classic.combatPatrols.enabled = false;
        const off = createRun(noCombat, options);
        ticks(off, 1000, 'right');
        assert.equal(run.score, off.score, 'combat awards no score or coverage');
        assert.equal(run.coverage, off.coverage);
        assert.notEqual(authoritativeCheckpoint(run).hash, authoritativeCheckpoint(off).hash);
      });

test('public warning/shot timing, fixed aim, expiry and subsequent scan do not depend on render batches', () => {
  const level = combatLevel(),
    run = createRun(level);
  const events = ticks(run, 480, 'right');
  const lock = events.find((e) => e.type === 'combat.locked');
  const fired = events.find((e) => e.type === 'combat.fired');
  assert.equal(lock.tick, 240);
  assert.equal(fired.tick, 360);
  assert.deepEqual(fired.aim, lock.aim);
  assert.equal(patrol(run).phase, 'cooldown');
  assert.equal(patrol(run).nextScanTick, 840);
  const expiry = ticks(run, 240, 'right');
  assert(expiry.some((e) => e.type === 'combat.expired' && e.tick === 720));
});

for (const saveTick of [300, 380])
  test(`suspend/restore preserves warning/projectile authority and exact continuation at tick${saveTick}`, async () => {
    const level = combatLevel(),
      options = { seed: 7, classId: 'scout', turnPolicy: 'immediate' };
    const run = createRun(level, options),
      recorder = createRecorder(level, options);
    ticks(run, saveTick, 'right', recorder);
    if (saveTick === 300) assert.equal(patrol(run).phase, 'warning');
    else assert.equal(combat(run).projectiles.length, 1);
    const campaign = {
      version: 'xonix-campaign.v1',
      id: 'combat-fixture-campaign',
      revision: '1',
      levels: [level],
      classRecipes: CLASSES,
    };
    const key = campaignKey(campaign);
    const saved = suspendSession({
      run,
      recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'quad',
      runId: 'combat-save',
      continuation: { direction: 'right' },
    });
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(combat(restored.run), combat(run));
    ticks(run, 1000, 'right', recorder);
    ticks(restored.run, 1000, 'right', restored.recorder);
    assert.equal(run.status, 'won');
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
    const replay = exportReplay(recorder, run);
    assert.equal(verifyReplay(replay).match, true);
    for (const mutate of [
      (r) => {
        r.level.classic.combatPatrols.enabled = false;
      },
      (r) => {
        r.level.classic.combatPatrols.actors[0].warningTicks++;
      },
      (r) => {
        r.level.classic.combatPatrols.actors[0].shotSpeed++;
      },
    ]) {
      const changed = structuredClone(replay);
      mutate(changed);
      assert.equal(verifyReplay(changed).match, false);
    }
    const changed = structuredClone(campaign);
    changed.levels[0].classic.combatPatrols.enabled = false;
    await assert.rejects(restoreSession(saved, { campaign: changed, campaignKey: key }));
  });

test('stationary exposed craft is hit by one telegraphed shot and life recovery clears all threats', () => {
  const level = combatLevel(),
    run = createRun(level),
    recorder = createRecorder(level);
  ticks(run, 240, 'right', recorder);
  const events = ticks(run, 800, null, recorder);
  assert(events.some((e) => e.type === 'combat.fired'));
  assert(events.some((e) => e.type === 'combat.impact'));
  const failure = events.find((e) => e.type === 'player.failed');
  assert.equal(failure.cause, 'combat-projectile');
  assert.equal(run.classic.livesLost, 1);
  assert.equal(combat(run).projectiles.length, 0);
  assert.equal(run.player.cutting, false);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
});

test('public keeper collision is not replaced by optional patrol rules', () => {
  const level = combatLevel('scout');
  level.enemies[0].y = 18.5;
  const run = createRun(level),
    recorder = createRecorder(level);
  const events = ticks(run, 750, 'right', recorder);
  assert(events.some((e) => e.type === 'combat.eliminated' && e.cause === 'ram'));
  assert(events.some((e) => e.type === 'player.failed' && e.cause.startsWith('enemy-')));
  assert.equal(run.classic.livesLost, 1);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
});
