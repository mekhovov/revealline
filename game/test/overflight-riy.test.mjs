import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  spawnOverflightEnemy,
  damageOverflightArea,
  pauseOverflight,
  resumeOverflight,
} from '../overflight/core.mjs';
import {
  createOverflightRiy,
  stepOverflightRiy,
  overflightRiyTarget,
} from '../overflight/riy-core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';

function quiet() {
  const compiled = structuredClone(compileOverflightProject(createOverflightProject()));
  compiled.encounters = [];
  compiled.goals.eliteAt = 10000;
  compiled.goals.finalAt = 20000;
  const run = createOverflightRun(compiled, { airframes: 3 });
  startOverflight(run);
  run._cooldowns.primary = 10000;
  run.riy = createOverflightRiy(run);
  return run;
}
function enemy(run, values = {}) {
  const item = spawnOverflightEnemy(run, {
    x: run.player.x + 200,
    y: run.player.y,
    warning: 0,
    hp: 1000,
    speed: 0,
    family: 'patroller',
    ...values,
  });
  item.attackCooldown = 10000;
  rebuildOverflightGrid(run._grid, run.enemies);
  return item;
}
function step(run, focus = false, input = {}) {
  const tick = run.tick;
  stepOverflight(run, input);
  if (run.tick !== tick) stepOverflightRiy(run, { focus });
}

test('focus selects a visible priority target with stable ties and never selects arrivals or offscreen enemies', () => {
  const run = quiet();
  enemy(run, { x: run.player.x + 30 });
  const tank = enemy(run, { family: 'tracked-tank', x: run.player.x + 250 });
  enemy(run, { family: 'tracked-tank', role: 'final', x: run.player.x, y: run.player.y + 320 });
  enemy(run, { family: 'tracked-tank', role: 'elite', x: run.player.x + 120, warning: 1 });
  assert.equal(overflightRiyTarget(run)?.id, tank.id);
});

test('one focus command moves escorts away from their normal cover route and damages the selected target', () => {
  const follow = quiet(),
    focus = quiet();
  const normalTank = enemy(follow, { family: 'tracked-tank' }),
    focusedTank = enemy(focus, { family: 'tracked-tank' });
  for (let i = 0; i < 150; i++) {
    step(follow);
    step(focus, i === 0);
  }
  assert.equal(follow.riy.commands, 0);
  assert.equal(focus.riy.commands, 1);
  assert.ok(focus.riy.escorts[0].x > follow.riy.escorts[0].x + 80);
  assert.ok(focusedTank.armor < normalTank.armor);
  assert.equal(focus.riy.targetId, focusedTank.id);
  // Repeated requests cannot refresh the three-second focus or bypass cooldown.
  for (let i = 0; i < 70; i++) step(focus, true);
  assert.equal(focus.riy.commands, 1);
  assert.equal(focus.riy.targetId, null);
});

test('support fire uses shared directional guards, armor, death rewards and sound events', () => {
  const run = quiet();
  const guard = enemy(run, { family: 'shield-bearer', hp: 100 });
  guard.guardHeading = 0;
  damageOverflightArea(run, guard.x, guard.y, 1, 36, { origin: { x: guard.x + 50, y: guard.y } });
  assert.equal(guard.hp, 91);
  assert.equal(guard.guardIntegrity, 33);
  damageOverflightArea(run, guard.x, guard.y, 1, 100, { origin: { x: guard.x - 50, y: guard.y } });
  assert.equal(guard.active, false);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.xpEarned, guard.xp);
  assert.ok(run.events.some((e) => e.type === 'defeat'));
  damageOverflightArea(run, guard.x, guard.y, 1, 100, { origin: { x: guard.x - 50, y: guard.y } });
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.xpEarned, guard.xp);
  assert.throws(
    () => damageOverflightArea(run, 0, 0, 1, 1, { origin: { x: NaN, y: 0 } }),
    RangeError,
  );
});

test('Sweeper hits a cluster while Breaker concentrates stronger damage', () => {
  const run = quiet();
  const s = run.riy.escorts[0],
    b = run.riy.escorts[1];
  const targets = [
    enemy(run, { x: s.x + 60, y: s.y }),
    enemy(run, { x: s.x + 60, y: s.y - 30 }),
    enemy(run, { x: b.x + 60, y: b.y }),
  ];
  s.cooldown = 0;
  b.cooldown = 0;
  stepOverflightRiy(run);
  assert.deepEqual(
    targets.map((e) => 1000 - e.hp),
    [12, 12, 36],
  );
  assert.deepEqual(
    run.riy.escorts.map((e) => e.shots),
    [1, 1],
  );
});

test('pause and upgrade clocks freeze escort state; handoff clears focus and recalls both escorts', () => {
  const run = quiet();
  enemy(run, { family: 'tracked-tank' });
  step(run, true);
  pauseOverflight(run);
  const snapshot = structuredClone(run.riy);
  for (let i = 0; i < 120; i++) step(run, true);
  assert.deepEqual(run.riy, snapshot);
  resumeOverflight(run);
  run.phase = 'upgrade';
  stepOverflightRiy(run, { focus: true });
  assert.deepEqual(run.riy, snapshot);
  run.phase = 'playing';
  run.player.x = 300;
  run.player.y = 300;
  run.stats.airframesLost++;
  stepOverflightRiy(run);
  assert.equal(run.riy.targetId, null);
  assert.ok(run.riy.escorts.every((e) => Math.hypot(e.x - 300, e.y - 300) < 5));
});

test('same commands and inputs produce deterministic escort positions and damage; leaving range cancels focus', () => {
  const a = quiet(),
    b = quiet();
  for (const run of [a, b]) enemy(run, { family: 'tracked-tank' });
  for (let i = 0; i < 300; i++) for (const run of [a, b]) step(run, i === 0, { y: -0.25 });
  assert.deepEqual(a.riy, b.riy);
  assert.deepEqual(a.stats, b.stats);
  assert.equal(a.riy.escorts.length, 2);
  const fresh = quiet();
  const target = enemy(fresh, { family: 'tracked-tank' });
  step(fresh, true);
  target.x += 1000;
  stepOverflightRiy(fresh);
  assert.equal(fresh.riy.targetId, null);
});

test('native command input respects paused menus, fresh presses, retry and disposal', async () => {
  const { Document } = await import('./helpers/couch-dom.mjs');
  const { createOverflightRiyMode } = await import('../overflight/riy-mode.mjs');
  const document = new Document();
  const mount = document.createElement('section');
  mount.id = 'overflight-game';
  document.body.append(mount);
  const run = quiet();
  enemy(run, { family: 'tracked-tank' });
  const mode = createOverflightRiyMode({ step: stepOverflight, text: (_l, k) => k });
  let active = true;
  const dispose = mode.installActions({ document, getRun: () => run, canAct: () => active });
  mode.refreshOverlay(run, 'en');
  const button = mount.querySelector('button');
  const key = (overrides = {}) =>
    document.defaultView.dispatchEvent({
      type: 'keydown',
      code: 'KeyF',
      preventDefault() {},
      ...overrides,
    });
  const advance = () => mode.step(run, { x: 0, y: 0, boost: false }, 1 / 60);
  active = false;
  key();
  button.click();
  active = true;
  advance();
  assert.equal(run.riy.commands, 0);
  key({ repeat: true });
  key({ ctrlKey: true });
  key({ target: { tagName: 'INPUT' } });
  advance();
  assert.equal(run.riy.commands, 0);
  key();
  mode.releaseInput();
  advance();
  assert.equal(run.riy.commands, 0, 'opening a menu clears a pending command');
  button.click();
  advance();
  assert.equal(run.riy.commands, 1);
  key();
  advance();
  assert.equal(run.riy.commands, 1, 'cooldown cannot be refreshed');
  mode.refreshOverlay(run, 'uk');
  assert.equal(button.disabled, true);
  assert.match(button.textContent, /Зосередити/);
  run.riy.cooldown = 0;
  key();
  mode.resetPresentation();
  advance();
  assert.equal(run.riy.commands, 1);
  dispose();
  key();
  advance();
  assert.equal(run.riy.commands, 1);
  assert.equal(mount.children.length, 0);
});
