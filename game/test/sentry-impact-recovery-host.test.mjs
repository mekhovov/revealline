// A legal impact route on the unchanged three-life authored Standard greybox.
// The Solo host, inputs, core and recorder are real; browser media/Canvas are
// modeled by soloPage. No native pixels, human fairness or terminal clear claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { prepareScenario } from '../imports.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

const impactRoute = [
  ['right', 12],
  ['down', 228],
  ['right', 252],
  ['up', 192],
  // Left reaches the authored wall and remains commanded while it blocks
  // movement. Releasing a key alone would not stop continuous Solo flight.
  ['left', 352],
  ['down', 36],
  ['right', 68],
];
const handoffKey = 'revealline.playground.current';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);
const directions = (segments) =>
  segments.flatMap(([direction, ticks]) => Array(ticks).fill(direction));

async function pauseAndHold(page, run) {
  page.$('pause-button').click();
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(run),
    combat = structuredClone(run.classic.combatPatrols),
    view = combatView(run),
    deadline = run.respawnAt;
  for (let frame = 0; frame < 20; frame++) page.frame(50);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(run.classic.combatPatrols, combat);
  assert.deepEqual(combatView(run), view);
  assert.equal(run.respawnAt, deadline);
}

async function resume(page, run) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.run, run, 'Resume retains the nonterminal attempt.');
  assert.equal(page.rendered.paused, false);
}

async function exportPartial(page, run, expectedSegments, checkpoint) {
  const before = authoritativeCheckpoint(run);
  assert.equal(page.$('export-replay').disabled, false);
  await page.$('export-replay').onclick();
  const replay = JSON.parse(page.$('replay-json').value);
  assert.equal(verifyReplay(replay).match, true, 'A nonterminal replay is independently playable.');
  assert.equal(replay.checkpoint.hash, checkpoint);
  assert.equal(replay.summary.status, run.status);
  assert.equal(replay.summary.won, false);
  assert.equal(replay.summary.lives, 2);
  assert.equal(replay.summary.livesLost, 1);
  assert.deepEqual(
    replay.segments.flatMap(({ input, ticks }) => Array(ticks).fill(input.direction)),
    directions(expectedSegments),
    'The recorder includes only real steps and the neutral recovery interval.',
  );
  assert.deepEqual(replay.level, run.level);
  assert.equal(replay.options.seed, 1);
  assert.equal(replay.options.turnPolicy, 'grid-center');
  assert.equal(replay.options.classId, 'scout');
  assert.deepEqual(replay.options.classRecipes, run.classRecipes);
  page.$('replay-dialog').close();
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(run), before);
}

test('Sentry detour: real shot causes one nonterminal loss, paused recovery, fresh grace departure and exact partial replays', async (t) => {
  // Preserve the real replay download path without keeping Node alive for its
  // one-minute Blob URL cleanup timer. Simulation and readiness clocks stay real.
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === 60000) timer.unref();
    return timer;
  });
  const source = createCombatCandidates(),
    sourceBytes = JSON.stringify(source),
    compiled = compileContentProject(source),
    manifest = resolveMission(compiled, 'sentry-detour', { difficulty: 'standard' }),
    theme = JSON.parse(
      readFileSync(new URL('../content-design/themes.json', import.meta.url)),
    ).themes.find((candidate) => candidate.id === manifest.presentation.themeId),
    preview = prepareContentPreview(compiled, manifest.missionId, {
      difficulty: 'standard',
      theme,
    });
  preview.scenario.settings.turnPolicy = 'grid-center';
  const scenario = (await prepareScenario(preview.scenario)).scenario,
    bytes = JSON.stringify(scenario),
    storage = memoryStorage({ retained: 'existing player bytes' }),
    previewStorage = memoryStorage({ [handoffKey]: bytes }),
    page = await soloPage(t, {
      storage,
      previewStorage,
      search: '?practice=1&revision=sentry-impact-recovery',
    }),
    expectedRun = createRun(manifest.level, {
      ...scenario.settings,
      classRecipes: scenario.classRecipes,
    });
  assert.equal(manifest.simulationIdentity, 'f548ecb05ac84109');
  assert.equal(manifest.level.rules.lives, 3);
  assert.equal(manifest.officialProgressEligible, false);
  assert.equal(theme.id, 'rover-yard');
  assert.deepEqual(
    scenario.level,
    manifest.level,
    'Use the authored preset once, without fresh tuning.',
  );
  assert.deepEqual(scenario.settings, { classId: 'scout', turnPolicy: 'grid-center', seed: 1 });
  assert.deepEqual(
    authoritativeCheckpoint(page.rendered.run),
    authoritativeCheckpoint(expectedRun),
  );
  assert.equal(storage.writes.length, 0);
  const stored = [...storage.map];
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  const run = page.rendered.run,
    events = [],
    combat = () => run.classic.combatPatrols,
    sentry = () => combat().actors.find((actor) => actor.id === 'watch-sentry');
  // Authored theme/scenario only: this greybox has no separate artwork leases.
  assert.equal(page.rendered.actorAppearance, null);
  assert.equal(page.rendered.backdrop, null);
  const step = (direction) => {
    const tick = run.tick;
    page.frame(FIXED_DT * 1000);
    stepRun(expectedRun, { direction }, FIXED_DT);
    assert.equal(run.tick, tick + 1, 'Each command represents one real host step.');
    assert.deepEqual(run.player, expectedRun.player, `Public input parity at tick ${run.tick}.`);
    assert.equal(run.status, expectedRun.status);
    events.push(...structuredClone(run.events));
  };
  let lock, fired, secured;
  for (const [direction, ticks] of impactRoute) {
    const key = `Arrow${direction[0].toUpperCase()}${direction.slice(1)}`;
    page.key(key);
    for (let n = 0; n < ticks; n++) {
      step(direction);
      if (run.tick === 690) {
        lock = structuredClone(run.events.find((event) => event.type === 'combat.locked'));
        assert.equal(lock.id, 'watch-sentry');
        assert.equal(lock.warningUntil, 870);
        assert.deepEqual(lock.aim, { x: run.player.x, y: run.player.y });
        assert.equal(sentry().phase, 'warning');
        secured = { coverage: run.coverage, claimed: run.claimedCount, score: run.score };
        page.key(key, false);
        await pauseAndHold(page, run);
        await resume(page, run);
        page.key(key);
      }
      if (sentry().phase === 'warning') assert.deepEqual(sentry().aim, lock.aim);
      if (run.tick === 870) {
        fired = structuredClone(run.events.find((event) => event.type === 'combat.fired'));
        assert.equal(fired.actorId, lock.id);
        assert.deepEqual(fired.aim, lock.aim);
        assert.equal(sentry().phase, 'recovery');
        assert.equal(combatView(run).projectiles.length, 1);
        assert.equal(combat().projectiles[0].id, fired.id);
      }
      if (run.tick === 1036) {
        near(run.player.x, 28.5);
        near(run.player.y, 19.5);
        assert.equal(run.player.speed, 0, 'The actual wall blocks the still-commanded Left.');
        assert.equal(
          combat().projectiles.length,
          1,
          'The shot remains active during actor recovery.',
        );
      }
      if (n + 1 < ticks && run.events.some((event) => event.type === 'capture.stopped')) {
        // A capture clears native intent. The next explicit route command is a
        // fresh gesture, not a held key bypassing the capture safety boundary.
        page.key(key, false);
        page.key(key);
      }
    }
    if (run.status !== 'respawning') page.key(key, false);
  }
  assert.equal(run.tick, 1140);
  assert.equal(run.status, 'respawning');
  assert.equal(run.lives, 2);
  assert.equal(run.classic.livesLost, 1);
  assert.equal(run.failureCause, 'combat-projectile');
  assert.equal(authoritativeCheckpoint(run).hash, '796497074ce1bc30');
  const [impact, removed, failure] = run.events;
  assert.deepEqual(
    run.events.map((event) => event.type),
    ['combat.impact', 'combat.projectileRemoved', 'player.failed'],
  );
  assert.equal(impact.id, fired.id);
  assert.equal(impact.actorId, fired.actorId);
  assert.equal(removed.id, fired.id);
  assert.equal(removed.reason, 'recovery');
  assert.equal(failure.actorId, 'watch-sentry');
  assert.equal(failure.cause, 'combat-projectile');
  assert.equal(failure.lives, 2);
  assert.equal(run.respawnAt, failure.time + run.rules.respawnSeconds);
  assert.deepEqual(combat().projectiles, []);
  assert.equal(sentry().alive, true);
  assert.equal(sentry().phase, 'cooldown');
  assert.deepEqual(run.trail, []);
  assert.deepEqual(run.trailSegments, []);
  assert.equal(run.cutStartedAt, null);
  assert.equal(run.player.queuedDirection, null);
  assert.equal(run.player.speed, 0);
  assert.equal(run.player.cutting, false);
  assert.deepEqual(
    { coverage: run.coverage, claimed: run.claimedCount, score: run.score },
    secured,
  );
  assert.equal(run.claimedCount, 24, 'The two actual earlier captures remain secured.');
  assert.equal(page.$('retry-button').hidden, true, 'Nonterminal recovery is not a result Retry.');
  await pauseAndHold(page, run);
  await exportPartial(page, run, impactRoute, '796497074ce1bc30');
  await resume(page, run);

  // The last Right remains physically held. Recovery clears intent; a native
  // repeat after respawn cannot revive it without a new release/press gesture.
  for (let n = 0; n < 90; n++) {
    if (run.tick === 1218)
      page
        .$('game-canvas')
        .emit('keydown', { code: 'ArrowRight', key: 'ArrowRight', repeat: true });
    step(null);
    if (run.tick === 1217) assert.equal(run.status, 'respawning');
    if (run.tick === 1218) {
      assert.equal(run.events[0].type, 'player.respawned');
      assert.equal(run.status, 'running');
      assert.equal(run.player.x, run.level.spawn.x);
      assert.equal(run.player.y, run.level.spawn.y);
      assert.equal(run.player.graceUntil, run.time + run.rules.graceSeconds);
      assert.equal(authoritativeCheckpoint(run).hash, '2b3e3dee2a91c198');
    }
  }
  assert.equal(run.tick, 1230);
  assert.equal(run.player.x, run.level.spawn.x);
  assert.equal(run.player.y, run.level.spawn.y);
  assert.equal(run.player.speed, 0);
  page.key('ArrowRight', false);
  page.key('ArrowRight');
  for (let n = 0; n < 120; n++) {
    step('right');
    if (run.tick === 1231) assert.ok(run.player.x > run.level.spawn.x, 'A fresh gesture moves.');
    if ([1278, 1338].includes(run.tick)) {
      assert.equal(run.player.x, 15.5);
      assert.equal(run.player.speed, 0);
      assert.equal(run.player.cutting, false);
    }
    if (run.tick === 1339) {
      assert.ok(run.time > run.player.graceUntil);
      assert.ok(run.player.x > 15.5, 'Field departure resumes after the grace boundary.');
    }
  }
  page.key('ArrowRight', false);
  assert.equal(run.tick, 1350);
  assert.equal(run.status, 'running');
  assert.equal(run.player.cutting, true);
  assert.equal(run.lives, 2);
  assert.equal(events.filter((event) => event.type === 'player.failed').length, 1);
  assert.equal(events.filter((event) => event.type === 'combat.fired').length, 1);
  assert.equal(events.filter((event) => event.type === 'player.respawned').length, 1);
  assert.equal(authoritativeCheckpoint(run).hash, '49f4f5629aae51ad');
  await exportPartial(page, run, [...impactRoute, [null, 90], ['right', 120]], '49f4f5629aae51ad');
  assert.equal(page.$('theme-select').value, theme.id);
  assert.equal(page.rendered.actorAppearance, null);
  assert.equal(page.rendered.backdrop, null);
  assert.deepEqual([...storage.map], stored);
  assert.equal(
    storage.writes.length,
    0,
    'Practice recovery/export do not persist profile changes.',
  );
  assert.deepEqual([...previewStorage.map], [[handoffKey, bytes]]);
  assert.equal(previewStorage.writes.length, 0);
  assert.equal(JSON.stringify(scenario), bytes);
  assert.equal(JSON.stringify(source), sourceBytes);
  assert.deepEqual(page.errors, []);
});
