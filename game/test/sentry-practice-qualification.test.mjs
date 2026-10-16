// Existing authored greybox through the actual Solo entry, input, recorder and
// Retry. Browser media/Canvas boundaries are modeled by soloPage; these routes
// establish deterministic counterplay, not human fairness or native pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { prepareScenario } from '../imports.mjs';
import { FIXED_DT, createRun, stepRun } from '../core/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const routes = read('./fixtures/combat-candidate-routes.json').routes;
const observations = read('./fixtures/combat-candidate-observations.json');
const source = createCombatCandidates(),
  sourceBytes = JSON.stringify(source),
  compiled = compileContentProject(source),
  manifest = resolveMission(compiled, 'sentry-detour', { difficulty: 'standard' }),
  theme = read('../content-design/themes.json').themes.find(
    (candidate) => candidate.id === manifest.presentation.themeId,
  ),
  handoffKey = 'revealline.playground.current';

async function exportFromHost(t, page) {
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === 60000) timer.unref();
    return timer;
  });
  await page.$('export-replay').onclick();
  const replay = JSON.parse(page.$('replay-json').value);
  assert.equal(verifyReplay(replay).match, true);
  page.$('replay-dialog').close();
  return replay;
}

async function play(t, page, route) {
  const events = [];
  const expectedRun = createRun(page.rendered.run.level, {
    seed: route.seed,
    turnPolicy: route.turnPolicy,
    classId: 'scout',
    classRecipes: page.rendered.run.classRecipes,
  });
  let liveShotExposureTicks = 0,
    cuts = 0,
    freshCaptureGestures = 0,
    warningPaused = false,
    shotInRecovery = false;
  for (const { direction, ticks } of route.segments) {
    const key = direction ? `Arrow${direction[0].toUpperCase()}${direction.slice(1)}` : null;
    if (key) page.key(key);
    for (let n = 0; n < ticks; n++) {
      const before = page.rendered.run.tick;
      page.frame(FIXED_DT * 1000);
      const run = page.rendered.run;
      stepRun(expectedRun, { direction }, FIXED_DT);
      let actualCommand = null;
      if (run.player.x !== expectedRun.player.x || run.player.y !== expectedRun.player.y) {
        const replay = await exportFromHost(t, page);
        actualCommand = replay.segments.at(-1)?.input;
      }
      assert.deepEqual(
        { x: run.player.x, y: run.player.y, status: run.status },
        { x: expectedRun.player.x, y: expectedRun.player.y, status: expectedRun.status },
        `Host versus recorded input at tick ${run.tick}; requested ${direction}; recorded ${JSON.stringify(actualCommand)}`,
      );
      assert.equal(
        run.tick,
        before + 1,
        JSON.stringify({
          note: 'Every recorded route tick is a real host step.',
          before,
          after: run.tick,
          status: run.status,
          direction,
          segmentTick: n,
          paused: page.rendered.paused,
          flightState: page.doc.body.dataset.flightState,
          player: { x: run.player.x, y: run.player.y, cutting: run.player.cutting },
        }),
      );
      events.push(...structuredClone(run.events));
      if (run.player.cutting && run.classic.combatPatrols.projectiles.length)
        liveShotExposureTicks++;
      if (run.events.some((event) => event.type === 'cut.closed')) cuts++;
      if (run.events.some((event) => event.type === 'combat.fired')) {
        const view = combatView(run);
        assert.equal(view.valid, true);
        assert.ok(
          view.actors.some((actor) => actor.id === 'watch-sentry' && actor.phase === 'recovery'),
        );
        assert.equal(view.projectiles.length, 1, 'Recovery does not erase the fired shot.');
        shotInRecovery = true;
      }
      if (!warningPaused && run.events.some((event) => event.type === 'combat.locked')) {
        const view = combatView(run);
        assert.equal(view.valid, true);
        warningPaused = true;
        assert.ok(
          view.actors.some((actor) => actor.id === 'watch-sentry' && actor.phase === 'warning'),
        );
        if (key) page.key(key, false);
        page.$('pause-button').click();
        page.frame(0);
        const held = authoritativeCheckpoint(run),
          heldView = combatView(run);
        for (let frame = 0; frame < 20; frame++) page.frame(50);
        assert.equal(page.rendered.paused, true);
        assert.deepEqual(authoritativeCheckpoint(run), held);
        assert.deepEqual(combatView(run), heldView);
        page.$('start-button').click();
        await settle(() => page.doc.body.dataset.flightState === 'running');
        if (key) page.key(key);
      }
      if (key && n + 1 < ticks && run.events.some((event) => event.type === 'capture.stopped')) {
        // The core trace explicitly requests this direction again next tick.
        // A held native key cannot do that after capture: translate the next
        // recorded command into a deliberate fresh gesture, without stepping.
        page.key(key, false);
        page.key(key);
        freshCaptureGestures++;
      }
    }
    if (key) page.key(key, false);
  }
  return {
    events,
    liveShotExposureTicks,
    cuts,
    warningPaused,
    shotInRecovery,
    freshCaptureGestures,
  };
}

for (const [turnPolicy, checkpoint] of [
  ['grid-center', 'c6b70bee5e553a14'],
  ['immediate', 'd84ab2551529735a'],
])
  test(`Sentry detour Standard/seed1/${turnPolicy}: real practice clear, counterplay, export and retained Retry`, async (t) => {
    const route = routes.find(
      (row) =>
        row.id === 'sentry-detour' &&
        row.difficulty === 'standard' &&
        row.seed === 1 &&
        row.turnPolicy === turnPolicy,
    );
    const expected = observations.find(
      (row) =>
        row.id === route.id &&
        row.difficulty === route.difficulty &&
        row.seed === route.seed &&
        row.turnPolicy === turnPolicy,
    ).on;
    assert.equal(manifest.simulationIdentity, 'f548ecb05ac84109');
    assert.equal(route.simulationIdentity, manifest.simulationIdentity);
    assert.equal(route.checkpoint, checkpoint);
    assert.equal(theme.id, 'rover-yard', 'Keep the original authored presentation.');
    assert.equal(manifest.level.version, 'xonix-level.v5');
    const preview = prepareContentPreview(compiled, route.id, {
      difficulty: route.difficulty,
      theme,
    });
    // Select an existing validated practice control before admission. No actor,
    // rule, geometry, victory or historical route is rewritten for this test.
    preview.scenario.settings.turnPolicy = turnPolicy;
    const scenario = (await prepareScenario(preview.scenario)).scenario,
      bytes = JSON.stringify(scenario),
      storage = memoryStorage({ retained: 'existing player bytes' }),
      previewStorage = memoryStorage({ [handoffKey]: bytes }),
      page = await soloPage(t, {
        storage,
        previewStorage,
        search: '?practice=1&revision=sentry-qualification',
      });
    assert.equal(scenario.format, 'xonix-playground.v6');
    assert.deepEqual(scenario.level, manifest.level);
    const initial = authoritativeCheckpoint(page.rendered.run);
    assert.deepEqual(
      initial,
      authoritativeCheckpoint(
        createRun(manifest.level, {
          seed: route.seed,
          turnPolicy,
          classId: 'scout',
          classRecipes: scenario.classRecipes,
        }),
      ),
    );
    const stored = [...storage.map],
      writes = storage.writes.length;
    assert.equal(writes, 0, 'Practice admission awards and persists nothing.');
    assert.match(page.$('overlay-copy').textContent, /Sentries lock aim/);
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    const observed = await play(t, page, route),
      run = page.rendered.run,
      result = authoritativeCheckpoint(run),
      locks = observed.events.filter((event) => event.type === 'combat.locked'),
      fired = observed.events.filter((event) => event.type === 'combat.fired');
    assert.equal(run.status, 'won');
    assert.equal(run.tick, route.ticks);
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.coverage, expected.coverage);
    assert.equal(
      result.hash,
      checkpoint,
      'Actual host matches the historical core route checkpoint.',
    );
    assert.equal(observed.cuts, expected.cuts);
    assert.equal(observed.warningPaused, true);
    assert.equal(locks.length, expected.locks);
    assert.equal(fired.length, expected.shots);
    assert.equal(observed.liveShotExposureTicks, expected.liveShotExposureTicks);
    assert.deepEqual(
      observed.events
        .filter((event) => event.type === 'combat.eliminated')
        .map(({ id, cause, tick }) => ({ id, cause, tick })),
      expected.removals,
    );
    assert.equal(
      observed.events.some((event) => ['combat.impact', 'player.failed'].includes(event.type)),
      false,
    );
    if (turnPolicy === 'grid-center') {
      assert.equal(observed.shotInRecovery, true);
      assert.equal(fired[0].tick, locks[0].warningUntil);
      assert.deepEqual(fired[0].aim, locks[0].aim, 'The sentry commits to its earlier aim.');
      assert.ok(
        observed.liveShotExposureTicks > 0,
        'This path evades a real shot, not only a warning.',
      );
    } else {
      assert.equal(observed.shotInRecovery, false);
      const cancellations = observed.events.filter((event) => event.type === 'combat.cancelled');
      assert.equal(cancellations.length, 1);
      assert.equal(cancellations[0].reason, 'capture');
      assert.ok(cancellations[0].tick < locks[0].warningUntil);
      assert.ok(
        expected.removals[0].tick < locks[1].warningUntil,
        'The second warning ends by ram elimination, not a second cancellation event.',
      );
      assert.ok(
        observed.freshCaptureGestures > 0,
        'The real host requires an explicit fresh direction after capture.',
      );
      assert.equal(
        fired.length,
        0,
        'This different existing route cancels warnings; it does not prove shot evasion.',
      );
    }
    const replay = await exportFromHost(t, page);
    assert.equal(replay.checkpoint.hash, checkpoint);
    assert.deepEqual(replay.level, run.level);
    assert.equal(replay.options.seed, route.seed);
    assert.equal(replay.options.turnPolicy, turnPolicy);
    assert.equal(replay.options.classId, 'scout');
    assert.deepEqual(replay.options.classRecipes, scenario.classRecipes);
    const actualDirections = replay.segments.flatMap(({ input, ticks }) =>
        Array(ticks).fill(input.direction),
      ),
      recordedDirections = route.segments.flatMap(({ direction, ticks }) =>
        Array(ticks).fill(direction),
      );
    assert.deepEqual(
      actualDirections,
      recordedDirections,
      'Actual recorder directions, including post-capture fresh gestures, equal the historical public-input route.',
    );
    for (let frame = 0; frame < 90; frame++) page.frame();
    assert.deepEqual(
      authoritativeCheckpoint(run),
      result,
      'Terminal presentation never advances the retained run.',
    );
    const retry = page.$('retry-button');
    retry.emit('pointerdown', { button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 1 });
    retry.focus();
    retry.emit('pointerup', { button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 1 });
    retry.click();
    page.frame(0);
    assert.notEqual(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), initial);
    assert.deepEqual(authoritativeCheckpoint(run), result);
    assert.deepEqual([...storage.map], stored);
    assert.equal(storage.writes.length, writes);
    assert.deepEqual([...previewStorage.map], [[handoffKey, bytes]]);
    assert.equal(previewStorage.writes.length, 0);
    assert.equal(JSON.stringify(scenario), bytes);
    assert.equal(JSON.stringify(source), sourceBytes);
    assert.deepEqual(page.errors, []);
  });
