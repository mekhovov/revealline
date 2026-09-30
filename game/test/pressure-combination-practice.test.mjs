// Existing authored Standard preview, not freshly tuned ordinary Journey play.
// The real Solo host/core/recorder execute; soloPage models browser media and
// Canvas boundaries. These routes prove neither native pixels nor fairness.
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
  handoffKey = 'revealline.playground.current';
const cases = [
  {
    id: 'lens-intercept',
    name: 'Lens intercept',
    turnPolicy: 'immediate',
    identity: '2497ae07cb45e615',
    checkpoint: 'fc18d9f52830479d',
    themeId: 'rover-yard',
    roles: ['heading-interceptor', 'frontier-patrol'],
    pressureId: 'left',
    pressureMode: 'head-intercept',
    pairedId: 'frontier',
    ticks: 5130,
    coverage: 0.743,
    cuts: 10,
    timeline: [
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
  },
  {
    id: 'band-pursuit',
    name: 'Band pursuit',
    turnPolicy: 'grid-center',
    identity: '8641e22597e489bd',
    checkpoint: 'ac781296e170bdfa',
    themeId: 'horizon',
    roles: ['trail-pursuer', 'perimeter-patrol'],
    pressureId: 'west',
    pressureMode: 'trail-pursuit',
    pairedId: 'outer',
    ticks: 6726,
    coverage: 0.7309417040358744,
    cuts: 7,
    timeline: [
      ['pressure.warning', 1849],
      ['pressure.committed', 1969],
      ['pressure.cancelled', 2094],
      ['pressure.warning', 4488],
      ['pressure.cancelled', 4506],
      ['pressure.warning', 5124],
      ['pressure.committed', 5244],
      ['pressure.cooldown', 5424],
      ['pressure.warning', 6690],
      ['pressure.cancelled', 6726],
    ],
  },
];

const near = (a, b) => Math.abs(a - b) < 1e-7;
const atCenter = ({ x, y }) => near(x - Math.floor(x), 0.5) && near(y - Math.floor(y), 0.5);
function pointOnTrail({ x, y }, segments) {
  return segments.some(
    ({ x1, y1, x2, y2 }) =>
      Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) < 1e-7 &&
      x >= Math.min(x1, x2) - 1e-7 &&
      x <= Math.max(x1, x2) + 1e-7 &&
      y >= Math.min(y1, y2) - 1e-7 &&
      y <= Math.max(y1, y2) + 1e-7,
  );
}

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

async function qualifyRoute(t, expected) {
  const { id, turnPolicy } = expected,
    [, identity, checkpoint, segments, expectedEvents] = fixture.sets
      .find((set) => set.difficulty === 'standard' && set.turnPolicy === turnPolicy)
      .rows.find((row) => row[0] === id),
    source = createPursuitInterceptCandidates(),
    sourceBytes = JSON.stringify(source),
    compiled = compileContentProject(source),
    manifest = resolveMission(compiled, id, { difficulty: 'standard' }),
    theme = read('../content-design/themes.json').themes.find(
      (candidate) => candidate.id === manifest.presentation.themeId,
    ),
    preview = prepareContentPreview(compiled, id, { difficulty: 'standard', theme });
  // Select the existing validated steering option before admission. The level,
  // actors and historical route stay unchanged; no fresh tuning is applied.
  preview.scenario.settings.turnPolicy = turnPolicy;
  const scenario = (await prepareScenario(preview.scenario)).scenario,
    bytes = JSON.stringify(scenario),
    storage = memoryStorage({ retained: 'existing player bytes' }),
    previewStorage = memoryStorage({ [handoffKey]: bytes }),
    page = await soloPage(t, {
      storage,
      previewStorage,
      search: `?practice=1&revision=${id}-qualification`,
    });
  assert.equal(identity, expected.identity);
  assert.equal(manifest.simulationIdentity, identity);
  assert.equal(checkpoint, expected.checkpoint);
  assert.equal(theme.id, expected.themeId);
  assert.equal(manifest.officialProgressEligible, false);
  assert.deepEqual(manifest.design.combines, expected.roles);
  assert.deepEqual(scenario.level, manifest.level, 'Admit the exact authored difficulty once.');
  assert.deepEqual(scenario.settings, { classId: 'scout', turnPolicy, seed: 1 });
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
    pairedPositions = new Set(),
    bufferedTurns = [];
  let warningPaused = false,
    latestWarning = null,
    latestCommit = null,
    frontierRejoined = false,
    pendingTurn = null,
    queuedTicks = 0,
    completedCommitments = 0,
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
      // Enter has no flight action. Its held repeat must not become Retry after
      // the final real capture exposes the result controls.
      if (run.tick === expected.ticks - 1) {
        page.$('game-canvas').focus();
        confirm(page);
      }
      const before = run.tick,
        beforePlayer = { ...run.player };
      page.frame(FIXED_DT * 1000);
      stepRun(expectedRun, { direction }, FIXED_DT);
      assert.equal(run.tick, before + 1, 'Every route tick is an actual host step.');
      assert.deepEqual(
        { player: run.player, status: run.status },
        { player: expectedRun.player, status: expectedRun.status },
        `Host follows historical public input at tick ${run.tick}: ${direction}.`,
      );
      if (run.player.queuedDirection) {
        queuedTicks++;
        assert.equal(turnPolicy, 'grid-center');
        assert.equal(run.player.queuedDirection, direction);
        assert.notEqual(run.player.direction, direction, 'A buffered request must wait.');
        assert.equal(run.player.direction, beforePlayer.direction);
        pendingTurn ??= { start: run.tick, from: run.player.direction, to: direction };
      } else if (pendingTurn) {
        assert.equal(
          run.player.direction,
          pendingTurn.to,
          'The requested turn eventually applies.',
        );
        assert.equal(atCenter(beforePlayer), true, 'The queued turn applies at a cell center.');
        bufferedTurns.push({ ...pendingTurn, end: run.tick });
        pendingTurn = null;
      }
      events.push(...structuredClone(run.events));
      const pressure = run.enemies.find((enemy) => enemy.id === expected.pressureId).classic
          .pressure,
        paired = run.enemies.find((enemy) => enemy.id === expected.pairedId);
      pairedPositions.add(`${paired.x},${paired.y}`);
      if (paired.classic?.mode === 'rejoining' && paired.classic.topologyRevision > 0)
        frontierRejoined = true;
      if (expected.pairedId === 'outer')
        assert.ok(
          near(paired.x, 0.5) ||
            near(paired.x, run.width - 0.5) ||
            near(paired.y, 0.5) ||
            near(paired.y, run.height - 0.5),
          'The paired perimeter patrol stays on the outside boundary after captures.',
        );
      for (const event of run.events.filter((event) => event.type.startsWith('pressure.'))) {
        const name = `${event.id}:${event.type}`;
        pressureCounts[name] = (pressureCounts[name] ?? 0) + 1;
        assert.equal(event.mode, expected.pressureMode);
        if (event.type === 'pressure.warning') {
          latestWarning = structuredClone(event);
          if (event.mode === 'trail-pursuit') {
            assert.equal(pointOnTrail(event.target, run.trailSegments), true);
            // Sensing precedes movement. These warnings sample the then-current
            // trail endpoint; this route does not prove deeper-trail targeting.
            assert.ok(
              Math.hypot(event.target.x - run.player.x, event.target.y - run.player.y) > 1e-7,
              'Movement advances the player beyond the trail point sampled for this warning.',
            );
          }
        }
        if (event.type === 'pressure.committed') {
          latestCommit = structuredClone(event);
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
        if (event.type === 'pressure.cooldown') {
          completedCommitments++;
          assert.equal(event.actorTick, latestCommit.commitUntil);
          assert.deepEqual(event.target, latestCommit.target);
          assert.equal(
            run.player.cutting,
            true,
            'Commitment can expire while the cut remains open.',
          );
          assert.equal(
            run.events.some((candidate) => candidate.type === 'capture.stopped'),
            false,
          );
          assert.equal(pressure.phase, 'cooldown');
          assert.equal(pressure.target, null);
          assert.deepEqual(pressure.path, []);
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
        assert.equal(run.tick, expected.timeline[0][1]);
        if (key) page.key(key, false);
        page.$('pause-button').click();
        page.frame(0);
        const held = authoritativeCheckpoint(run),
          heldPressure = structuredClone(pressure),
          heldPatrol = structuredClone(paired);
        for (let frame = 0; frame < 20; frame++) page.frame(50);
        assert.equal(page.rendered.paused, true);
        assert.deepEqual(authoritativeCheckpoint(run), held);
        assert.deepEqual(pressure, heldPressure);
        assert.deepEqual(paired, heldPatrol);
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
  assert.equal(run.tick, expected.ticks);
  assert.equal(run.coverage, expected.coverage);
  assert.equal(run.classic.livesLost, 0);
  assert.equal(events.filter((event) => event.type === 'cut.closed').length, expected.cuts);
  assert.equal(
    events.some((event) => event.type === 'player.failed'),
    false,
  );
  assert.deepEqual(pressureCounts, expectedEvents);
  assert.deepEqual(
    events
      .filter((event) => event.type.startsWith('pressure.'))
      .map(({ type, tick }) => [type, tick]),
    expected.timeline,
  );
  assert.equal(warningPaused, true);
  assert.ok(pairedPositions.size > 1, 'The paired patrol really moves.');
  if (id === 'lens-intercept') {
    assert.equal(frontierRejoined, true, 'Capture changes the paired frontier route.');
    assert.equal(queuedTicks, 0, 'Immediate steering never queues a turn.');
    assert.equal(completedCommitments, 0, 'This interception route cancels every attack.');
  } else {
    assert.equal(frontierRejoined, false, 'The perimeter patrol does not become a frontier actor.');
    assert.equal(queuedTicks, 30);
    assert.equal(bufferedTurns.length, 5);
    assert.deepEqual(bufferedTurns[0], { start: 2155, from: 'left', to: 'right', end: 2161 });
    assert.equal(completedCommitments, 1);
  }
  assert.equal(pendingTurn, null);
  assert.ok(freshCaptureGestures > 0);
  const result = authoritativeCheckpoint(run);
  assert.equal(
    result.hash,
    checkpoint,
    'Actual host preserves the pinned historical terminal state.',
  );
  const retry = page.$('retry-button');
  assert.equal(retry.hidden, false);
  // Exercise visible Retry; automatic result-focus placement is a separate check.
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
  assert.equal(replay.options.turnPolicy, turnPolicy);
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
}

for (const route of cases)
  test(`${route.name} Standard/seed1/${route.turnPolicy}: combined route clears through real practice, Pause, replay and retained Retry`, (t) =>
    qualifyRoute(t, route));
