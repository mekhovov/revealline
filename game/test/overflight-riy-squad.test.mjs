import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightRun,
  startOverflight,
  spawnOverflightEnemy,
  chooseOverflightUpgrade,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
} from '../overflight/core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
  validateOverflightRiyProject,
  upgradeOverflightRiyProjectCopy,
} from '../overflight/riy-project.mjs';
import {
  createOverflightRiyPackage,
  exportOverflightRiyPackage,
  importOverflightRiyPackage,
} from '../overflight/riy-community.mjs';
import {
  createOverflightRiy,
  stepOverflightRiy,
  overflightRiyPresentation,
} from '../overflight/riy-core.mjs';
import {
  legalOverflightRiyUpgrades,
  draftOverflightRiyUpgrades,
  applyOverflightRiyUpgrade,
  overflightRiyEscortParameters,
} from '../overflight/riy-upgrades.mjs';
import { overflightRiyEditor } from '../studio/riy-editor.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { pilot } from '../overflight/review-pilot.mjs';
import { overflightAttackContains } from '../overflight/tactics.mjs';

function quiet() {
  const compiled = structuredClone(
    compileOverflightRiyProject(createOverflightRiyProject({ rulesVersion: 3 })),
  );
  compiled.encounters = [];
  compiled.goals.eliteAt = 10000;
  compiled.goals.finalAt = 20000;
  const run = createOverflightRun(compiled);
  run.player.heading = 0;
  run.riy = createOverflightRiy(run);
  startOverflight(run);
  run._cooldowns.primary = 10000;
  return run;
}
function enemy(run, x, y, extra = {}) {
  const item = spawnOverflightEnemy(run, {
    family: 'patroller',
    x,
    y,
    hp: 1000,
    speed: 0,
    warning: 0,
    ...extra,
  });
  item.attackCooldown = 10000;
  rebuildOverflightGrid(run._grid, run.enemies);
  return item;
}
function step(run, focus = false) {
  const tick = run.tick;
  stepOverflight(run);
  if (tick !== run.tick) stepOverflightRiy(run, { focus });
}
function upgrade(run, role, branch, rank = 2) {
  while (run.build.escorts.find((item) => item.role === role).rank < rank) {
    const offer = legalOverflightRiyUpgrades(run.build).find(
      (item) => item.role === role && item.branch === branch,
    );
    assert.ok(applyOverflightRiyUpgrade(run.build, offer, run.compiled.upgrades.modules));
  }
}

test('Riy V2 round trip preserves directional settings and explicit copies leave V1 immutable', async () => {
  const original = createOverflightRiyProject();
  const before = structuredClone(original);
  const project = upgradeOverflightRiyProjectCopy(original, {
    rulesVersion: 3,
  });
  assert.equal(project.format, 'OverflightRiyProjectV2');
  assert.equal(project.survivorFormat, 'OverflightProjectV3');
  assert.deepEqual(original, before);
  assert.equal(compileOverflightRiyProject(original).riyVersion, 1);
  project.riy.escorts[1].attackRange = 190;
  const imported = await importOverflightRiyPackage(
    exportOverflightRiyPackage(createOverflightRiyPackage(project)),
  );
  const compiled = compileOverflightRiyProject(imported.project);
  assert.equal(compiled.riyVersion, 2);
  assert.equal(compiled.rulesVersion, 3);
  assert.equal(compiled.riy.escorts[1].attackRange, 190);
  assert.equal(compiled.balanceRevision, 'overflight-balance.v3');
  assert.deepEqual(compiled.upgrades.modules, ['primary', 'scanner', 'shield', 'plating']);
  const invalid = structuredClone(project);
  invalid.upgrades.modules.push('proximity-pulse');
  assert.throws(() => validateOverflightRiyProject(invalid));
});

test('new authoring fields preview the exact per-role range and arc', () => {
  const project = createOverflightRiyProject({ rulesVersion: 3 });
  const editor = overflightRiyEditor({
    document: new Document(),
    project,
    locale: 'en',
    onChange() {},
  });
  const inputs = editor.querySelectorAll('input');
  const last = inputs[inputs.length - 1];
  last.value = '200';
  last.dispatchEvent({ type: 'input' });
  assert.equal(compileOverflightRiyProject(project).riy.escorts[1].attackRange, 200);
  for (const mutate of [
    (p) => (p.riy.escorts[0].followArc = 360),
    (p) => (p.riy.approachSeconds = 20),
    (p) => (p.riy.commandCooldown = 3),
    (p) => (p.survivorFormat = 'OverflightProjectV2'),
  ]) {
    const invalid = structuredClone(project);
    mutate(invalid);
    assert.throws(() => validateOverflightRiyProject(invalid));
  }
});

test('follow arcs retain flight heading: Sweeper covers rear and Breaker reaches forward at 180', () => {
  const run = quiet(),
    [s, b] = run.riy.escorts;
  s.cooldown = 0;
  b.cooldown = 10000;
  const rear = enemy(run, s.x - 75, s.y),
    front = enemy(run, s.x + 75, s.y);
  stepOverflightRiy(run);
  assert.equal(rear.hp, 988);
  assert.equal(front.hp, 1000);
  s.cooldown = 10000;
  b.cooldown = 0;
  rear.active = false;
  front.active = false;
  const forward = enemy(run, b.x + 160, b.y);
  stepOverflightRiy(run);
  assert.equal(forward.hp, 964);
  assert.equal(b.formationHeading, 0);
  run.player.heading = Math.PI / 2;
  b.cooldown = 0;
  stepOverflightRiy(run);
  assert.equal(
    forward.hp,
    964,
    'visual target heading must not rotate the firing arc toward the enemy',
  );
});

test('squad drafting owns both combat slots, locks branches and keeps ten legal choices', () => {
  const run = quiet();
  assert.deepEqual(run.build.combat, []);
  for (let count = 0; count < 10; count++) {
    const offers = draftOverflightRiyUpgrades(run.build, run.compiled.upgrades.modules, () => 0.4);
    assert.equal(new Set(offers.map((item) => item.id)).size, 3);
    assert.ok(
      offers.every(
        (item) => !['proximity-pulse', 'slow-field', 'side-burst'].includes(item.system),
      ),
    );
    run.offers = offers;
    run.phase = 'upgrade';
    assert.equal(chooseOverflightUpgrade(run, offers[0].id), true);
  }
  assert.equal(run.progression.choices, 10);
  assert.deepEqual(run.build.combat, []);
  const fresh = quiet();
  upgrade(fresh, 'sweeper', 'trail');
  assert.ok(!legalOverflightRiyUpgrades(fresh.build).some((item) => item.branch === 'broad'));
  assert.equal(
    applyOverflightRiyUpgrade(
      fresh.build,
      { id: 'riy-sweeper:broad:2', system: 'riy-sweeper' },
      fresh.compiled.upgrades.modules,
    ),
    false,
  );
});

test('chain shares one damage budget among at most three unique overlapping bodies', () => {
  const run = quiet();
  upgrade(run, 'breaker', 'chain');
  const [s, b] = run.riy.escorts;
  s.cooldown = 10000;
  b.cooldown = 0;
  const victims = [120, 125, 126, 127].map((offset) => enemy(run, b.x + offset, b.y));
  stepOverflightRiy(run);
  const harmed = victims.filter((item) => item.hp < 1000);
  assert.equal(harmed.length, 3);
  assert.ok(Math.abs(harmed.reduce((total, item) => total + 1000 - item.hp, 0) - 39.6) < 1e-8);
});

test('burst commits its second hit to the same guarded target, without retargeting a death', () => {
  const run = quiet();
  upgrade(run, 'breaker', 'burst');
  const [s, b] = run.riy.escorts;
  s.cooldown = 10000;
  b.cooldown = 0;
  const guard = enemy(run, b.x + 120, b.y, { family: 'shield-bearer' });
  guard.guardHeading = Math.PI;
  const nearby = enemy(run, b.x + 130, b.y + 15);
  stepOverflightRiy(run);
  assert.ok(Math.abs(guard.hp - 993.7) < 1e-8);
  guard.active = false;
  for (let i = 0; i < 20; i++) stepOverflightRiy(run);
  assert.equal(nearby.hp, 1000);
  assert.equal(b.pending, null);
});

test('trail branch reduces impact and leaves harmless bounded slowing fields', () => {
  const run = quiet();
  upgrade(run, 'sweeper', 'trail', 3);
  const [s, b] = run.riy.escorts;
  s.cooldown = 0;
  b.cooldown = 10000;
  const target = enemy(run, s.x - 75, s.y);
  const inTrail = enemy(run, s.x - 20, s.y + 20);
  stepOverflightRiy(run);
  assert.equal(target.hp, 1000, 'closer trail victim receives the targeted impact');
  assert.equal(inTrail.hp, 994);
  assert.equal(inTrail.slowMultiplier, 0.55);
  assert.ok(inTrail.slowUntil > run.tick);
  assert.equal(run.riy.trails.filter((item) => item.active).length, 1);
  for (let i = 0; i < 35; i++) stepOverflightRiy(run);
  assert.equal(inTrail.hp, 994, 'the trail itself never deals damage');
  assert.equal(run.riy.trails.length, 8);
});

test('Focus begins its three seconds on arrival, never resets fire cadence, and cancels an unreachable approach', () => {
  const run = quiet(),
    [s, b] = run.riy.escorts;
  enemy(run, run.player.x + 350, run.player.y, { family: 'tracked-tank' });
  s.cooldown = b.cooldown = 4;
  const cue = overflightRiyPresentation(run);
  assert.ok(cue.candidate);
  stepOverflightRiy(run, { focus: true });
  assert.equal(run.riy.phase, 'approach');
  assert.equal(run.riy.focusRemaining, 0);
  for (let i = 0; i < 119 && run.riy.phase === 'approach'; i++) stepOverflightRiy(run);
  assert.equal(run.riy.phase, 'engaged');
  assert.equal(run.riy.engagements, 1, 'only reaching attack range counts as an engagement');
  assert.equal(run.riy.focusRemaining, 3);
  assert.equal(s.shots + b.shots, 0, 'command must not reset existing cooldowns');
  const failed = quiet();
  failed.riy.rules = { ...failed.riy.rules, escortSpeed: 1 };
  enemy(failed, failed.player.x + 350, failed.player.y, {
    family: 'tracked-tank',
  });
  for (let i = 0; i < 122; i++) stepOverflightRiy(failed, { focus: i === 0 });
  assert.equal(failed.riy.targetId, null);
  assert.equal(failed.riy.commands, 1);
  assert.equal(failed.riy.engagements, 0, 'a timed-out approach cannot earn Focus mastery');
  assert.ok(failed.riy.cooldown > 3);
});

test('Focus spends nothing without targets, respects death/leash, and freezes with all other gameplay clocks', () => {
  const run = quiet();
  stepOverflightRiy(run, { focus: true });
  assert.equal(run.riy.commands, 0);
  assert.equal(run.riy.cooldown, 0);
  const target = enemy(run, run.player.x + 260, run.player.y, {
    family: 'tracked-tank',
  });
  step(run, true);
  pauseOverflight(run);
  const paused = structuredClone(run.riy);
  for (let i = 0; i < 120; i++) step(run, true);
  assert.deepEqual(run.riy, paused);
  resumeOverflight(run);
  target.x = run.player.x + 600;
  step(run);
  assert.equal(run.riy.targetId, null);
  assert.equal(run.riy.commands, 1);
  assert.ok(run.riy.cooldown > 0);
  assert.equal(
    overflightRiyEscortParameters(run.riy.rules.escorts[1], {
      rank: 3,
      branch: 'chain',
    }).chainTargets,
    3,
  );
});

test('Focus ends on target death without selecting another priority target or renewing cooldown', () => {
  const run = quiet();
  const target = enemy(run, run.player.x + 230, run.player.y, { family: 'tracked-tank' });
  const other = enemy(run, run.player.x + 260, run.player.y + 80, { family: 'tracked-tank' });
  stepOverflightRiy(run, { focus: true });
  assert.equal(run.riy.targetId, target.id);
  target.active = false;
  const cooldown = run.riy.cooldown;
  stepOverflightRiy(run, { focus: true });
  assert.equal(run.riy.targetId, null);
  assert.ok(other.active);
  assert.equal(run.riy.commands, 1);
  assert.ok(run.riy.cooldown < cooldown);
});

test('rapid authored trail fire stays within its fixed pool and branch upgrades do not reset cooldowns', () => {
  const run = quiet();
  run.riy.rules = structuredClone(run.riy.rules);
  run.riy.rules.escorts[0].interval = 0.5;
  upgrade(run, 'sweeper', 'trail', 3);
  run.attackRate = 1.25;
  const [s, b] = run.riy.escorts;
  b.cooldown = 10000;
  enemy(run, s.x - 40, s.y, { hp: 10000 });
  let high = 0;
  for (let tick = 0; tick < 900; tick++) {
    stepOverflightRiy(run);
    high = Math.max(high, run.riy.trails.filter((item) => item.active).length);
  }
  assert.ok(high <= 5);
  assert.ok(s.shots > 30);
  assert.equal(run.riy.trails.length, 8);
  const cooldown = b.cooldown;
  upgrade(run, 'breaker', 'burst');
  stepOverflightRiy(run);
  assert.ok(b.cooldown > cooldown - 0.03, 'rank changes cannot replenish the attack');
});

test('a long authored legacy Focus upgrades to a bounded nonoverlapping command without changing the source', () => {
  const original = createOverflightRiyProject();
  original.riy.focusSeconds = 6;
  original.riy.commandCooldown = 6;
  const copy = upgradeOverflightRiyProjectCopy(original, { rulesVersion: 3 });
  assert.equal(original.riy.commandCooldown, 6);
  assert.equal(copy.riy.commandCooldown, 8);
  assert.doesNotThrow(() => compileOverflightRiyProject(copy));
});

test('drafts teach a primary branch before escorts and keep its evolution reachable within five choices', () => {
  const run = quiet();
  const first = draftOverflightRiyUpgrades(run.build, run.compiled.upgrades.modules, () => 0.2);
  assert.ok(first.some((card) => card.id === 'primary:wide:2'));
  assert.ok(first.some((card) => card.id === 'primary:double:2'));
  for (const expected of [
    'primary:double:2',
    'riy-sweeper:trail:2',
    'riy-breaker:burst:2',
    'primary:double:3',
    'primary:double:4',
  ]) {
    const offers = draftOverflightRiyUpgrades(run.build, run.compiled.upgrades.modules, () => 0.2);
    const choice = offers.find((card) => card.id === expected);
    assert.ok(choice, `${expected} remains available at its progression step`);
    assert.ok(applyOverflightRiyUpgrade(run.build, choice, run.compiled.upgrades.modules));
  }
  assert.equal(run.build.primary.evolved, true);
});

test('two authored introduction packs show rear then front arrivals and never refill cleared bodies', () => {
  const project = createOverflightRiyProject({ rulesVersion: 3 });
  const run = createOverflightRun(compileOverflightRiyProject(project));
  run.player.heading = 0;
  run.player.invulnerable = 10000;
  run.riy = createOverflightRiy(run);
  startOverflight(run);
  run._cooldowns.primary = 10000;
  step(run);
  const first = run.enemies.find((item) => item.active);
  assert.ok(first.x < run.player.x - 185);
  assert.ok(first.warning >= 0.98, 'onscreen arrival stays harmless while announced');
  while (run.time < 12) stepOverflight(run);
  assert.equal(run._riyIntroSpawned.rear, 18);
  const front = run.enemies.find((item) => item.active && item.x > run.player.x + 185);
  assert.ok(front, 'front pack begins after the rear demonstration');
  while (run.time < 30) stepOverflight(run);
  assert.deepEqual(run._riyIntroSpawned, { rear: 18, front: 36 });
  assert.equal(run.stats.kills, 0);
  assert.equal(run.stats.enemiesAlive, 54);
  const legacy = createOverflightRiyProject();
  assert.equal(legacy.riy.intro, undefined);
  for (const change of [
    (p) => (p.riy.intro[0].count = 500),
    (p) => (p.riy.intro[1].start = 0),
    (p) => (p.riy.intro[1].end = 45),
  ]) {
    const invalid = structuredClone(project);
    change(invalid);
    assert.throws(() => validateOverflightRiyProject(invalid));
  }
});

test('blocked V3 priority admissions retry at ten Hz while committed simulation keeps stepping', () => {
  const run = quiet();
  run.player.invulnerable = 10000;
  for (const escort of run.riy.escorts) escort.cooldown = 10000;
  enemy(run, run.player.x, run.player.y, { radius: 50 });
  const brace = enemy(run, run.player.x + 220, run.player.y, { family: 'brace-trooper' });
  brace.attackCooldown = 0;
  step(run);
  const retry = brace.attackAdmissionTick;
  assert.equal(retry, run.tick + 6);
  assert.equal(
    run.priorityAttacks.some((attack) => attack.active),
    false,
  );
  for (let i = 0; i < 5; i++) step(run);
  assert.equal(brace.attackAdmissionTick, retry);
  step(run);
  assert.equal(brace.attackAdmissionTick, retry + 6);
});

test('V2 squad flight and Focus are deterministic for repeated ordinary inputs', () => {
  const runs = [quiet(), quiet()];
  for (const run of runs) {
    upgrade(run, 'sweeper', 'trail', 3);
    upgrade(run, 'breaker', 'chain', 3);
    enemy(run, run.player.x + 190, run.player.y, { family: 'tracked-tank', role: 'elite' });
    for (let i = 0; i < 8; i++) enemy(run, run.player.x - 90 + i * 20, run.player.y - 80);
    for (let tick = 0; tick < 360; tick++) {
      const previous = run.tick;
      stepOverflight(run, { x: Math.cos(tick / 80), y: Math.sin(tick / 80) });
      if (run.tick !== previous) stepOverflightRiy(run, { focus: tick === 60 || tick === 300 });
    }
  }
  assert.deepEqual(overflightRiyPresentation(runs[0]), overflightRiyPresentation(runs[1]));
  assert.deepEqual(runs[0].stats, runs[1].stats);
  assert.deepEqual(
    runs[0].enemies.map((item) => [item.id, item.hp]),
    runs[1].enemies.map((item) => [item.id, item.hp]),
  );
});

for (const kind of ['lane', 'fan', 'ground']) {
  test(`V3 review pilot is read-only and deterministic while avoiding a committed ${kind}`, () => {
    const run = quiet();
    run.player.x = 500;
    run.player.y = 500;
    run.player.vx = run.flight.speed;
    run.player.vy = 0;
    Object.assign(run.pickups[0], { active: true, x: 750, y: 500, value: 1 });
    const attack = run.priorityAttacks[0];
    Object.assign(attack, {
      active: true,
      stage: 'warning',
      kind,
      originX: 0,
      originY: 500,
      heading: 0,
      x: kind === 'ground' ? 565 : 900,
      y: 500,
      length: 1000,
      spread: 0.32,
      radius: kind === 'ground' ? 40 : 8,
      remaining: 0.5,
    });
    const policy = run.upgradePolicy;
    const snapshot = structuredClone({ ...run, upgradePolicy: null });
    const input = pilot(run);
    assert.deepEqual(pilot(run), input, 'repeated decisions consume no RNG or hidden pilot state');
    assert.equal(run.upgradePolicy, policy);
    assert.deepEqual(
      { ...run, upgradePolicy: null },
      snapshot,
      'even pools, clocks, RNG and resources are unchanged',
    );
    assert.ok(Math.hypot(input.x, input.y) <= 1 + 1e-9);
    assert.equal(typeof input.boost, 'boolean');
    const travel = input.boost
      ? run.flight.boostSpeed * 0.3 + run.flight.speed * 0.2
      : run.flight.speed * 0.5;
    assert.equal(
      overflightAttackContains(attack, 500 + input.x * travel, 500 + input.y * travel, 17),
      false,
    );
    assert.notDeepEqual(input, pilot({ ...run, priorityAttacks: [] }));
  });
}

test('squad rerolls replace escort fork cards while preserving the next primary or evolution opportunity', () => {
  const run = quiet(),
    allowed = run.compiled.upgrades.modules;
  const draft = (previous = []) =>
    draftOverflightRiyUpgrades(run.build, allowed, () => 0.2, previous);
  applyOverflightRiyUpgrade(
    run.build,
    draft().find((card) => card.id === 'primary:double:2'),
    allowed,
  );
  const initial = draft();
  assert.deepEqual(
    initial.map((card) => card.system),
    ['primary', 'riy-sweeper', 'riy-sweeper'],
  );
  const oldIds = initial.map((card) => card.id);
  const rerolled = draft(oldIds);
  assert.equal(rerolled.length, 3);
  assert.equal(new Set(rerolled.map((card) => card.id)).size, 3);
  assert.ok(
    rerolled.some((card) => !oldIds.includes(card.id)),
    'a paid reroll changes the choices when alternatives exist',
  );
  const rank3 = rerolled.find((card) => card.id === 'primary:double:3');
  assert.ok(rank3);
  applyOverflightRiyUpgrade(run.build, rank3, allowed);
  const evolving = draft();
  const again = draft(evolving.map((card) => card.id));
  assert.ok(again.some((card) => card.kind === 'evolution' && card.id === 'primary:double:4'));
});
