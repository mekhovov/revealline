import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCoop, startCoop, stepCoop, pauseCoop, validateCoopLevel } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { coopBonusActive } from '../coop/timed-bonuses.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const compiled = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
);
const command = (direction = null, support = false) => ({ direction, boost: true, support });
const idle = [command(), command()];

function earnedRescue(seat) {
  const run = startCoop(createCoop(RELAY_YARD, { difficulty: 'standard', seed: 17 })),
    warnings = new Map();
  // Existing qualified revision-2 input route. No actor position, phase, rescue,
  // target or timer is injected; both warning targets and rescues come from core.
  const segments = [
    [140, command('right'), command('left')],
    [70, command('up'), command('up')],
    [214, command('right'), command('left')],
    [24, command(seat === 0 ? 'left' : null), command(seat === 1 ? 'right' : null)],
    [35, command(seat === 0 ? 'up' : null), command(seat === 1 ? 'up' : null)],
    [17, command(seat === 1 ? 'right' : null), command(seat === 0 ? 'left' : null)],
    [60, command(null, seat === 1), command(null, seat === 0)],
  ];
  for (const [ticks, ...commands] of segments)
    for (let i = 0; i < ticks; i++) {
      stepCoop(run, commands, 1 / 120);
      for (const enemy of run.enemies)
        if (enemy.phase === 'warning' && !warnings.has(enemy.target))
          warnings.set(enemy.target, structuredClone(run));
    }
  assert.equal(run.players[seat].status, 'downed');
  assert.equal(run.players[1 - seat].rescue.target, seat);
  assert.equal(run.time - run.players[1 - seat].rescue.startedAt, 0.5);
  assert.deepEqual([...warnings.keys()].sort(), [0, 1]);
  return { run, warnings };
}

function presentation(progress) {
  const slots = ['player.scout.compact', 'player.scout.detailed'];
  if (progress) slots.push('team.rescue.progress');
  const assets = Object.fromEntries(slots.map((id) => [id, compiled.resolved.assets[id]])),
    frames = Object.fromEntries(
      slots
        .filter((id) => assets[id].kind === 'image')
        .map((id) => {
          const asset = assets[id];
          return [
            id,
            {
              image: { id, width: asset.file.width, height: asset.file.height },
              geometry: imagePresentation(asset),
            },
          ];
        }),
    );
  return {
    resolved: { assets },
    canvas: {
      assets,
      motionScale: 1,
      palette: {
        ink: '#f3f0db',
        paper: '#070b12',
        muted: '#a5b2bb',
        accent: '#f4bf62',
        safe: '#78dce8',
        danger: '#f07879',
        field: '#070b12',
        grid: '#182631',
        sky: '#dfb781',
        land: '#687c55',
      },
    },
    fonts: { ui: 'sans-serif', numeric: 'monospace' },
    image: (id) => frames[id] ?? null,
  };
}

// Finite, stateful Canvas command evidence, not browser font/raster qualification.
function surface(width, progress = true) {
  let state = { globalAlpha: 1 };
  const calls = [],
    stack = [],
    ctx = new Proxy(
      {},
      {
        get(_, name) {
          if (name in state) return state[name];
          return (...args) => {
            calls.push({ name, args, state: { ...state } });
            if (name === 'save') stack.push({ ...state });
            if (name === 'restore') state = stack.pop();
            if (name === 'measureText')
              return { width: fontSize(state.font) * String(args[0]).length * 0.55 };
          };
        },
        set(_, name, value) {
          state[name] = value;
          return true;
        },
      },
    ),
    painter = createCoopPainter({
      width: 1152,
      height: 576,
      clientWidth: width,
      getContext: () => ctx,
    });
  painter.setPresentation(presentation(progress));
  return {
    paint(run, options) {
      calls.length = 0;
      const checkpoint = structuredClone(run);
      painter.paint(run, options);
      assert.deepEqual(run, checkpoint, 'Every paint preserves the entire core checkpoint.');
      assert.equal(stack.length, 0);
      return structuredClone(calls);
    },
  };
}
const fontSize = (font) => Number.parseFloat(font?.match(/[\d.]+px/)?.[0] ?? '1');
const textCalls = (calls) => calls.filter((call) => call.name === 'fillText');
const rescueLabel = (locale, seat, progress) =>
  `${locale === 'uk' ? 'РЯТУЄМО' : 'RESCUE'} ${seat + 1}${progress ? ' · 50%' : ''}`;
const lockLabel = (locale, seat) => `${locale === 'uk' ? 'ЦІЛЬ' : 'LOCK'} ${seat + 1}`;

function assertCue(calls, expected, width, minimum) {
  const matching = textCalls(calls).filter((call) => call.args[0] === expected);
  assert.equal(matching.length, 1, `One actual cue: ${expected}`);
  const call = matching[0],
    cell = width / 72,
    size = fontSize(call.state.font) * cell,
    measured = size * expected.length * 0.55,
    x = call.args[1] * cell,
    y = call.args[2] * cell;
  assert.ok(size >= minimum - 1e-8, 'Localization never reduces the readable font minimum.');
  assert.ok(x - measured / 2 >= 0 && x + measured / 2 <= width, 'Measured cue fits the board.');
  assert.ok(y - size * 0.7 >= 0 && y + size * 0.7 <= width / 2);
  const texts = textCalls(calls).map((item) => item.args[0]);
  assert.ok(texts.includes('1') && texts.includes('2'), 'Both player identity badges remain.');
}

for (const seat of [0, 1])
  for (const progress of [false, true])
    test(`real rescue of player ${seat + 1} changes language in place (${progress ? 'progress' : 'legacy role'})`, (context) => {
      const locale = getLocale();
      context.after(() => setLocale(locale, { persist: false }));
      const { run } = earnedRescue(seat),
        checkpoint = structuredClone(run);
      for (const width of [212, 1152])
        for (const reduced of [false, true]) {
          const view = surface(width, progress),
            options = { reduced, textSize: 'large', textFace: 'plain' };
          let english;
          for (const language of ['en', 'uk', 'en']) {
            setLocale(language, { persist: false });
            const calls = view.paint(run, options);
            assertCue(calls, rescueLabel(language, seat, progress), width, (14 * 4) / 3);
            assert.equal(
              textCalls(calls).filter((call) => /^(?:RESCUE|РЯТУЄМО) /.test(call.args[0])).length,
              1,
            );
            if (language === 'en') {
              if (english)
                assert.deepEqual(
                  calls,
                  english,
                  'Returning to English restores exact draw commands.',
                );
              english = calls;
            } else assert.ok(!textCalls(calls).some((call) => /^RESCUE /.test(call.args[0])));
          }
        }
      assert.deepEqual(run, checkpoint);
      pauseCoop(run);
      const paused = structuredClone(run);
      for (let tick = 0; tick < 60; tick++) stepCoop(run, idle);
      assert.deepEqual(run, paused);
      setLocale('uk', { persist: false });
      assert.ok(
        !textCalls(surface(212, progress).paint(run, { reduced: true })).some((call) =>
          /^(?:RESCUE|РЯТУЄМО) /.test(call.args[0]),
        ),
        'Core cancels held contact rescue on pause; translated text must not retain stale progress.',
      );
    });

for (const seat of [0, 1])
  test(`actual Hunter lock names player ${seat + 1} in the chosen language through pause`, (context) => {
    const locale = getLocale();
    context.after(() => setLocale(locale, { persist: false }));
    const { warnings } = earnedRescue(0),
      run = warnings.get(seat),
      checkpoint = structuredClone(run);
    for (const paused of [false, true]) {
      if (paused) pauseCoop(run);
      for (const width of [212, 1152])
        for (const reduced of [false, true]) {
          const view = surface(width),
            options = { reduced, textSize: 'large', textFace: 'plain' };
          let english;
          for (const language of ['en', 'uk', 'en']) {
            setLocale(language, { persist: false });
            const calls = view.paint(run, options);
            assertCue(calls, lockLabel(language, seat), width, 16);
            const enemy = run.enemies.find(
              (entry) => entry.phase === 'warning' && entry.target === seat,
            );
            assert.ok(
              calls.some(
                (call) =>
                  call.name === 'arc' &&
                  call.args[0] === enemy.targetPoint.x &&
                  call.args[1] === enemy.targetPoint.y &&
                  call.args[2] === 0.75,
              ),
            );
            if (language === 'en') {
              if (english) assert.deepEqual(calls, english);
              english = calls;
            } else assert.ok(!textCalls(calls).some((call) => /^LOCK /.test(call.args[0])));
          }
        }
      if (!paused) assert.deepEqual(run, checkpoint);
    }
    const held = structuredClone(run);
    for (let tick = 0; tick < 120; tick++) stepCoop(run, idle);
    assert.deepEqual(run, held, 'Pause does not advance the locked target or warning timer.');
  });

for (const seat of [0, 1])
  test(`reserve recovery of player ${seat + 1} cannot retain a translated contact-rescue label`, (context) => {
    const locale = getLocale();
    context.after(() => setLocale(locale, { persist: false }));
    const { run } = earnedRescue(seat),
      view = surface(212),
      reserves = run.team.reserves,
      deadline = Math.ceil(run.players[seat].downedUntil * 120) + 1;
    setLocale('uk', { persist: false });
    assertCue(view.paint(run, { reduced: true }), rescueLabel('uk', seat, true), 212, 14);
    // Releasing Support cancels the free contact rescue; existing core timing
    // spends a reserve. The painter must not describe that as contact progress.
    while (run.tick < deadline && run.players[seat].status === 'downed') stepCoop(run, idle);
    assert.equal(run.players[seat].status, 'active');
    assert.equal(run.team.reserves, reserves - 1);
    assert.ok(run.players[seat].graceUntil > run.time);
    for (const language of ['uk', 'en']) {
      setLocale(language, { persist: false });
      assert.ok(
        !textCalls(view.paint(run, { reduced: true })).some((call) =>
          /^(?:RESCUE|РЯТУЄМО) /.test(call.args[0]),
        ),
      );
    }
  });

test('a real slow pickup retains the compact downward marker on the localized locked target', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const level = {
    version: 'revealline-coop-level.v6',
    id: 'localized-slow-lock',
    revision: '1',
    name: 'Localized slow lock',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: 8.5, y: 0.5 },
      { x: 71.5, y: 30.5 },
    ],
    walls: [],
    safeRects: [],
    terrain: [],
    enemies: [{ id: 'hunter', type: 'hunter', x: 13.5, y: 8.5, vx: 0, vy: 0.2, radius: 0.25 }],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 8, boostMultiplier: 1 },
    lineImpact: { version: 'team-line-impact.v2', speed: 1 },
    timedBonuses: {
      version: 'timed-bonuses.v2',
      schedules: [
        {
          id: 'slow',
          kind: 'enemy-slow',
          anchors: [
            { x: 8.5, y: 8.5 },
            { x: 8.5, y: 18.5 },
          ],
          initialDelayTicks: 0,
          announcementTicks: 120,
          availableTicks: 1200,
          cooldownTicks: 240,
          maxAppearances: 1,
          maxCollections: 1,
        },
      ],
    },
  };
  assert.deepEqual(validateCoopLevel(level), { valid: true, errors: [] });
  const run = startCoop(createCoop(level, { seed: 17 }));
  for (let tick = 0; tick < 121; tick++) stepCoop(run, idle);
  let collected = false;
  for (let tick = 0; tick < 1200 && !collected; tick++) {
    stepCoop(run, [command('down'), command()]);
    collected = run.events.some(
      (event) => event.type === 'powerup.collected' && event.kind === 'enemy-slow',
    );
  }
  assert.equal(collected, true);
  for (let tick = 0; tick < 600 && run.enemies[0].phase !== 'warning'; tick++)
    stepCoop(run, [command('up'), command()]);
  assert.equal(run.enemies[0].phase, 'warning');
  assert.equal(coopBonusActive(run, 'enemy-slow'), true);
  const view = surface(212);
  for (const language of ['en', 'uk', 'en']) {
    setLocale(language, { persist: false });
    const calls = view.paint(run, { reduced: true, textSize: 'large', textFace: 'plain' });
    assertCue(calls, `${lockLabel(language, run.enemies[0].target)} ↓`, 212, 16);
    assert.equal(calls.filter((call) => call.name === 'arc' && call.args[2] === 0.88).length, 1);
  }
});
