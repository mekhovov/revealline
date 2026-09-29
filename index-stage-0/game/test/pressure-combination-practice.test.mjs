// Existing authored Standard preview, not freshly tuned ordinary Journey play.
// The real Solo host/core/recorder execute; soloPage models browser media and
// Canvas boundaries. This one route proves neither native pixels nor fairness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPursuitInterceptCandidates } from '../content-design/pursuit-intercept-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { prepareScenario } from '../imports.mjs';
import { FIXED_DT, createRun, stepRun } from '../core/index.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixture = read('./fixtures/pursuit-intercept-clear-routes.json'),
  [id, identity, checkpoint, segments, expectedEvents] = fixture.sets
    .find((set) => set.difficulty === 'standard' && set.turnPolicy === 'immediate')
    .rows.find((row) => row[0] === 'lens-intercept'),
  handoffKey = 'revealline.playground.current';

async function exportFromHost(t, page) {
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === 60000) timer.unref(); // Blob URL cleanup must not keep Node alive.
    return timer;
  });
  await page.$('export-replay').onclick();
  const replay = JSON.parse(page.$('replay-json').value);
  assert.equal(verifyReplay(replay).match, true);
  page.$('replay-dialog').close();
  return replay;
}

function confirm(page, repeat = false) {
  const target = page.doc.activeElement,
    event = target.emit('keydown', { key: 'Enter', code: 'Enter', repeat });
  // Browser default activation is modeled only when the real handlers allow it.
  if (!event.defaultPrevented && target.tagName === 'BUTTON') target.click();
  return event;
}

test('Lens intercept Standard/seed1/immediate: combined frontier route clears through real practice, Pause, replay and retained Retry', async (t) => {
  const source = createPursuitInterceptCandidates(),
    sourceBytes = JSON.stringify(source),
    compiled = compileContentProject(source),
    manifest = resolveMission(compiled, id, { difficulty: 'standard' }),
    theme = read('../content-design/themes.json').themes.find(
      (candidate) => candidate.id === manifest.presentation.themeId,
    ),
    preview = prepareContentPreview(compiled, id, { difficulty: 'standard', theme }),
    scenario = (await prepareScenario(preview.scenario)).scenario,
    bytes = JSON.stringify(scenario),
    storage = memoryStorage({ retained: 'existing player bytes' }),
    previewStorage = memoryStorage({ [handoffKey]: bytes }),
    page = await soloPage(t, {
      storage,
      previewStorage,
      search: '?practice=1&revision=lens-intercept-qualification',
    });
  assert.equal(identity, '2497ae07cb45e615');
  assert.equal(manifest.simulationIdentity, identity);
  assert.equal(checkpoint, 'fc18d9f52830479d');
  assert.equal(theme.id, 'rover-yard');
  assert.equal(manifest.officialProgressEligible, false);
  assert.deepEqual(manifest.design.combines, ['heading-interceptor', 'frontier-patrol']);
  assert.deepEqual(scenario.level, manifest.level, 'Admit the exact authored difficulty once.');
  assert.deepEqual(scenario.settings, { classId: 'scout', turnPolicy: 'immediate', seed: 1 });
  const expectedRun = createRun(manifest.level, {
      ...scenario.settings,
      classRecipes: scenario.classRecipes,
    }),
    initial = authoritativeCheckpoint(page.rendered.run),
    stored = [...storage.map];
  assert.deepEqual(initial, authoritativeCheckpoint(expectedRun));
  assert.equal(storage.writes.length, 0, 'Practice admission persists nothing.');
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  const appearance = page.rendered.actorAppearance,
    backdrop = page.rendered.backdrop,
    run = page.rendered.run,
    events = [],
    pressureCounts = {},
    frontierPositions = new Set();
  let warningPaused = false,
    latestWarning = null,
    frontierRejoined = false,
    freshCaptureGestures = 0;
  // This greybox uses its authored theme/scenario, without separate artwork
  // leases. Retry must preserve that scope; this is not a decoded-art review.
  assert.equal(appearance, null);
  assert.equal(backdrop, null);
  assert.equal(page.$('theme-select').value, theme.id);
  assert.equal(page.doc.body.dataset.pictureState, 'ready');
  assert.deepEqual(authoritativeCheckpoint(run), initial);

  for (const [direction, ticks] of segments) {
    const key = direction ? `Arrow${direction[0].toUpperCase()}${direction.slice(1)}` : null;
    if (key) page.key(key);
    for (let n = 0; n < ticks; n++) {
      // Enter has no flight action. Its held repeat must not become Retry when
      // the final real capture moves focus from the canvas to results.
      if (run.tick === 5129) {
        page.$('game-canvas').focus();
        confirm(page);
      }
      const before = run.tick;
      page.frame(FIXED_DT * 1000);
      stepRun(expectedRun, { direction }, FIXED_DT);
      assert.equal(run.tick, before + 1, 'Every route tick is an actual host step.');
      assert.deepEqual(
        { x: run.player.x, y: run.player.y, status: run.status },
        { x: expectedRun.player.x, y: expectedRun.player.y, status: expectedRun.status },
        `Host follows historical public input at tick ${run.tick}: ${direction}.`,
      );
      events.push(...structuredClone(run.events));
      const pressure = run.enemies.find((enemy) => enemy.id === 'left').classic.pressure,
        frontier = run.enemies.find((enemy) => enemy.id === 'frontier');
      frontierPositions.add(`${frontier.x},${frontier.y}`);
      if (frontier.classic.mode === 'rejoining' && frontier.classic.topologyRevision > 0)
        frontierRejoined = true;
      for (const event of run.events.filter((event) => event.type.startsWith('pressure.'))) {
        const name = `${event.id}:${event.type}`;
        pressureCounts[name] = (pressureCounts[name] ?? 0) + 1;
        if (event.type === 'pressure.warning') latestWarning = structuredClone(event);
        if (event.type === 'pressure.committed') {
          assert.equal(event.actorTick, latestWarning.warningUntil);
          assert.deepEqual(event.target, latestWarning.target, 'Commit retains the earlier lock.');
          assert.equal(pressure.phase, 'committed');
        }
        if (event.type === 'pressure.cancelled') {
          assert.equal(event.reason, 'trail-closed');
          assert.ok(run.events.some((candidate) => candidate.type === 'capture.stopped'));
          assert.equal(pressure.phase, 'cooldown');
          assert.equal(pressure.target, null);
        }
      }
      if (['warning', 'committed'].includes(pressure.phase))
        assert.deepEqual(
          pressure.target,
          latestWarning.target,
          'Movement cannot retarget the lock.',
        );
      if (!warningPaused && pressure.phase === 'warning') {
        warningPaused = true;
        assert.equal(run.tick, 769);
        if (key) page.key(key, false);
        page.$('pause-button').click();
        page.frame(0);
        const held = authoritativeCheckpoint(run),
          heldPressure = structuredClone(pressure),
          heldFrontier = structuredClone(frontier);
        for (let frame = 0; frame < 20; frame++) page.frame(50);
        assert.equal(page.rendered.paused, true);
        assert.deepEqual(authoritativeCheckpoint(run), held);
        assert.deepEqual(pressure, heldPressure);
        assert.deepEqual(frontier, heldFrontier);
        page.$('start-button').click();
        await settle(() => page.doc.body.dataset.flightState === 'running');
        if (key) page.key(key);
      }
      if (key && n + 1 < ticks && run.events.some((event) => event.type === 'capture.stopped')) {
        // Closing a cut intentionally clears held native input. Translate the
        // next explicit historical command to a fresh gesture without a tick.
        page.key(key, false);
        page.key(key);
        freshCaptureGestures++;
      }
    }
    if (key) page.key(key, false);
  }

  assert.equal(run.status, 'won');
  assert.equal(run.tick, 5130);
  assert.equal(run.coverage, 0.743);
  assert.equal(run.classic.livesLost, 0);
  assert.equal(events.filter((event) => event.type === 'cut.closed').length, 10);
  assert.equal(
    events.some((event) => event.type === 'player.failed'),
    false,
  );
  assert.deepEqual(pressureCounts, expectedEvents);
  assert.deepEqual(
    events
      .filter((event) => event.type.startsWith('pressure.'))
      .map(({ type, tick }) => [type, tick]),
    [
      ['pressure.warning', 769],
      ['pressure.committed', 889],
      ['pressure.cancelled', 954],
      ['pressure.warning', 2676],
      ['pressure.committed', 2796],
      ['pressure.cancelled', 2850],
      ['pressure.warning', 4668],
      ['pressure.cancelled', 4758],
      ['pressure.warning', 5088],
      ['pressure.cancelled', 5130],
    ],
  );
  assert.equal(warningPaused, true);
  assert.ok(frontierPositions.size > 1, 'The paired frontier patrol really moves.');
  assert.equal(frontierRejoined, true, 'Capture changes the paired frontier route.');
  assert.ok(freshCaptureGestures > 0);
  const result = authoritativeCheckpoint(run);
  assert.equal(
    result.hash,
    checkpoint,
    'Actual host preserves the pinned historical terminal state.',
  );
  const retry = page.$('retry-button');
  assert.equal(retry.hidden, false);
  retry.focus();
  assert.equal(confirm(page, true).defaultPrevented, true);
  for (let frame = 0; frame < 90; frame++) page.frame();
  assert.equal(page.rendered.run, run, 'Held Confirm cannot become a result action.');
  assert.deepEqual(authoritativeCheckpoint(run), result);
  retry.emit('keyup', { key: 'Enter', code: 'Enter' });

  const replay = await exportFromHost(t, page);
  assert.equal(replay.checkpoint.hash, checkpoint);
  assert.deepEqual(replay.level, manifest.level);
  assert.deepEqual(replay.options.classRecipes, scenario.classRecipes);
  assert.equal(replay.options.seed, fixture.seed);
  assert.equal(replay.options.turnPolicy, 'immediate');
  assert.equal(replay.options.classId, 'scout');
  assert.deepEqual(
    replay.segments.flatMap(({ input, ticks }) => Array(ticks).fill(input.direction)),
    segments.flatMap(([direction, ticks]) => Array(ticks).fill(direction)),
    'The actual recorder retains every historical command, including capture re-entry.',
  );
  retry.focus();
  confirm(page);
  page.frame(0);
  await settle(() => page.rendered.run !== run);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), initial);
  assert.deepEqual(page.rendered.actorAppearance, appearance);
  assert.equal(page.rendered.backdrop, backdrop);
  assert.equal(page.$('theme-select').value, theme.id);
  assert.equal(page.doc.body.dataset.pictureState, 'ready');
  assert.deepEqual(authoritativeCheckpoint(run), result);
  assert.deepEqual([...storage.map], stored);
  assert.equal(storage.writes.length, 0, 'Clear, export and Retry do not grant or persist awards.');
  assert.deepEqual([...previewStorage.map], [[handoffKey, bytes]]);
  assert.equal(previewStorage.writes.length, 0);
  assert.equal(JSON.stringify(scenario), bytes);
  assert.equal(JSON.stringify(source), sourceBytes);
  assert.deepEqual(page.errors, []);
});
