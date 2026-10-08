import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  pauseOverflightHunt,
  resumeOverflightHunt,
  chooseOverflightHuntUpgrade,
  rerollOverflightHuntUpgrades,
  overflightHuntSummary,
  spawnOverflightHuntEnemy,
  overflightHuntContactState,
  overflightHuntSweep,
  overflightHuntFixtureInput,
} from '../overflight/raid-core.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightHuntBuild,
  overflightHuntParameters,
  overflightHuntUpgradeParameters,
  legalOverflightHuntUpgrades,
  applyOverflightHuntUpgrade,
  HUNT_UPGRADE_IDS,
} from '../overflight/raid-upgrades.mjs';

const project = compileOverflightHuntProject(createOverflightHuntProject());
function quiet(options = {}) {
  const source = structuredClone(project);
  source.encounters = [];
  const run = createOverflightHuntRun(source, options);
  startOverflightHunt(run);
  return run;
}
const spawn = (run, settings = {}) =>
  spawnOverflightHuntEnemy(run, { warning: 0, speed: 0, ...settings });
function steps(run, count, input = {}) {
  for (let i = 0; i < count; i++)
    stepOverflightHunt(run, typeof input === 'function' ? input(run, i) : input);
}
function projectile(run, { x, y, vx = 0, vy = 0, radius = 3, owner = 999 } = {}) {
  const slot = run._projectileFree.pop(),
    item = run.projectiles[slot];
  Object.assign(item, {
    _slot: slot,
    id: run._nextId++,
    active: true,
    hostile: true,
    owner,
    x,
    y,
    prevX: x,
    prevY: y,
    vx,
    vy,
    radius,
    remaining: 5,
    damage: 20,
  });
  return item;
}
function upgrade(run, id, rank = 1) {
  for (let i = 1; i <= rank; i++)
    assert.equal(
      applyOverflightHuntUpgrade(
        run.build,
        legalOverflightHuntUpgrades(run.build).find((offer) => offer.id === `${id}:${i}`),
      ),
      true,
    );
}

test('Raid starts explicitly and preserves deterministic paused clocks and confirmation gating', () => {
  const run = createOverflightHuntRun(project);
  assert.equal(run.airframes, 3);
  stepOverflightHunt(run, { x: 1 });
  assert.equal(run.tick, 0);
  assert.equal(startOverflightHunt(run), true);
  assert.equal(startOverflightHunt(run), false);
  assert.throws(() => stepOverflightHunt(run, {}, 1 / 30), /fixed/);
  steps(run, 10, { x: 1 });
  run.hunt.rushRemaining = 4;
  run.hunt.chainRemaining = 3;
  pauseOverflightHunt(run);
  const paused = overflightHuntSummary(run);
  steps(run, 30, { x: 1 });
  assert.deepEqual(overflightHuntSummary(run), paused);
  resumeOverflightHunt(run);
  stepOverflightHunt(run, { boost: true });
  assert.equal(run.stats.boostsUsed, 0);
  stepOverflightHunt(run, { boost: false });
  stepOverflightHunt(run, { boost: true });
  assert.equal(run.stats.boostsUsed, 1);
});

test('sweep detects fast crossings even when neither endpoint overlaps, including both moving bodies', () => {
  assert.equal(overflightHuntSweep(0, 0, 100, 0, 50, -50, 50, 50, 10), 0.4292893218813452);
  assert.equal(overflightHuntSweep(0, 0, 10, 0, 50, 20, 50, 30, 5), null);
  const run = quiet();
  const enemy = spawn(run, {
    x: run.player.x,
    y: run.player.y - 30,
    speed: 3600,
    route: [{ x: run.player.x, y: run.player.y + 300 }],
  });
  stepOverflightHunt(run);
  assert.equal(enemy.active, false);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.player.hull, 100);
});

test('exposed contact preserves hull and exactly-once death rewards and remains', () => {
  const run = quiet(),
    enemy = spawn(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run);
  steps(run, 10);
  assert.equal(enemy.active, false);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.player.hull, 100);
  assert.equal(run.hunt.score, 50);
  assert.equal(run.hunt.rushCharge, 1);
  assert.equal(run.defeats.sequence, 1);
  assert.equal(run.stats.xpEarned, run.stats.xpCollected);
});

test('shield front blocks and rear exposes; guard orientation stays committed during approach', () => {
  const run = quiet(),
    x = run.player.x,
    y = run.player.y;
  const shield = spawn(run, {
    family: 'shield-bearer',
    behavior: 'shield',
    x: x - 12,
    y,
    heading: 0,
    phaseRemaining: 10,
  });
  assert.equal(overflightHuntContactState(shield, run.player), 'guarded');
  stepOverflightHunt(run);
  assert.equal(run.player.hull, 80);
  assert.equal(shield.active, true);
  run.player.x = shield.x - 12;
  run.player.y = shield.y;
  assert.equal(overflightHuntContactState(shield, run.player), 'exposed');
  stepOverflightHunt(run);
  assert.equal(shield.active, false);
  assert.equal(run.player.hull, 80);
});

test('protection uses the visible pre-movement phase rather than transitioning on collision', () => {
  const run = quiet();
  const enemy = spawn(run, {
    family: 'brace-trooper',
    behavior: 'brace',
    x: run.player.x,
    y: run.player.y,
    behaviorPhase: 'recovery',
    phaseRemaining: 0.001,
  });
  stepOverflightHunt(run);
  assert.equal(enemy.active, false);
  assert.equal(run.player.hull, 100);
  assert.equal(
    run.projectiles.some((p) => p.active),
    false,
  );
});

test('arrival warnings give a full harmless interval before contact becomes active', () => {
  const run = quiet();
  const enemy = spawn(run, { x: run.player.x, y: run.player.y, warning: 1 });
  steps(run, 60);
  assert.equal(enemy.active, true);
  stepOverflightHunt(run);
  assert.equal(enemy.active, false);
});

test('machinery requires boosted passes and cannot lose several segments while overlapping', () => {
  const run = quiet(),
    x = run.player.x,
    y = run.player.y;
  const enemy = spawn(run, {
    family: 'tracked-tank',
    behavior: 'vehicle',
    x: x + 20,
    y,
    phaseRemaining: 20,
    armorSegments: 3,
  });
  stepOverflightHunt(run);
  assert.equal(enemy.armorSegments, 3);
  assert.equal(run.player.hull, 100);
  stepOverflightHunt(run, { boost: true, x: 1 });
  assert.equal(enemy.armorSegments, 2);
  steps(run, 5, { x: 1 });
  assert.equal(enemy.armorSegments, 2);
  run.player.x = enemy.x + 100;
  run.player.y = enemy.y;
  run.player.vx = 0;
  stepOverflightHunt(run);
  assert.equal(enemy.armorContactLatched, false);
  run.player.x = enemy.x + 20;
  run.player.boostRemaining = 0.2;
  stepOverflightHunt(run, { x: -1 });
  assert.equal(enemy.armorSegments, 1);
});

test('blocking contact stops attacks against bodies behind a shield', () => {
  const run = quiet(),
    x = run.player.x,
    y = run.player.y;
  const shield = spawn(run, {
    family: 'shield-bearer',
    behavior: 'shield',
    x: x + 30,
    y,
    heading: Math.PI,
    phaseRemaining: 10,
  });
  const victim = spawn(run, { x: x + 80, y });
  run.player.vx = 10000;
  stepOverflightHunt(run, { x: 1 });
  assert.equal(shield.active, true);
  assert.equal(victim.active, true);
  assert.ok(run.player.x < shield.x);
});

test('wider offensive strike does not enlarge damage exposure', () => {
  const run = quiet();
  upgrade(run, 'strike-width', 2);
  const shield = spawn(run, {
    family: 'shield-bearer',
    behavior: 'shield',
    x: run.player.x,
    y: run.player.y + 20,
    heading: -Math.PI / 2,
    phaseRemaining: 10,
  });
  stepOverflightHunt(run, { x: 1, boost: true });
  assert.equal(shield.active, true);
  assert.equal(run.player.hull, 100);
});

test('independent projectile survives owner death and can damage the player in the same tick', () => {
  const run = quiet();
  const enemy = spawn(run, { x: run.player.x, y: run.player.y });
  const shot = projectile(run, {
    x: run.player.x + 30,
    y: run.player.y,
    vx: -2400,
    owner: enemy.id,
  });
  stepOverflightHunt(run);
  assert.equal(enemy.active, false);
  assert.equal(shot.active, false);
  assert.equal(run.player.hull, 80);
});

test('priority warnings are bounded and a dead windup owner does not fire', () => {
  const run = quiet();
  for (let i = 0; i < 5; i++)
    spawn(run, {
      family: 'brace-trooper',
      behavior: 'brace',
      x: run.player.x + 60 + i * 35,
      phaseRemaining: 0.001,
    });
  stepOverflightHunt(run);
  assert.equal(run.priorityAttacks.filter((p) => p.active).length, 2);
  const owner = run.enemies.find((e) => e.active && e.behaviorPhase === 'windup');
  // Reach the visible recovery side of a brace immediately before its windup.
  owner.behaviorPhase = 'recovery';
  owner.phaseRemaining = 0.001;
  run.player.x = owner.x;
  run.player.y = owner.y;
  stepOverflightHunt(run);
  assert.equal(owner.active, false);
  assert.equal(
    run.priorityAttacks.some((p) => p.active && p.owner === owner.id),
    false,
  );
});

test('each boost refunds once even for a full formation; passive recovery and hard floor remain', () => {
  const run = quiet();
  for (let i = 0; i < 8; i++) spawn(run, { x: run.player.x + (i % 2), y: run.player.y });
  stepOverflightHunt(run, { boost: true, x: 1 });
  assert.equal(run.stats.kills, 8);
  assert.equal(run.stats.boostRefunds, 1);
  assert.equal(run.player.boostCooldown, 1.75);
  run.player.boostCooldown = 0;
  steps(run, 52, (_, i) => ({ boost: i % 2 === 1 }));
  assert.equal(run.stats.boostsUsed, 1);
  steps(run, 3, (_, i) => ({ boost: i % 2 === 1 }));
  assert.equal(run.stats.boostsUsed, 2);
});

test('Rush stores until a fresh boost, does not refill during active Rush, and survives damage', () => {
  const run = quiet();
  run.hunt.rushCharge = 19;
  spawn(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run);
  assert.equal(run.hunt.rushCharge, 20);
  assert.equal(run.hunt.rushRemaining, 0);
  steps(run, 30);
  assert.equal(run.hunt.rushCharge, 20);
  projectile(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run);
  assert.equal(run.hunt.rushCharge, 20);
  stepOverflightHunt(run, { boost: true });
  assert.equal(run.hunt.rushCharge, 0);
  assert.equal(run.hunt.rushRemaining, 5);
  spawn(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run);
  assert.equal(run.hunt.rushCharge, 0);
  const time = run.hunt.rushRemaining;
  pauseOverflightHunt(run);
  steps(run, 300);
  assert.equal(run.hunt.rushRemaining, time);
});

test('eight choices remain three distinct legal cards and optional choices are awarded once', () => {
  const run = quiet();
  for (let i = 0; i < 35; i++) spawn(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run);
  assert.equal(run.phase, 'upgrade');
  assert.equal(run.hunt.pendingChoices, 2);
  run.hunt.pendingChoices += 6;
  const clock = run.tick;
  for (let i = 0; i < 8; i++) {
    assert.equal(run.offers.length, 3);
    assert.equal(new Set(run.offers.map((offer) => offer.id)).size, 3);
    if (i === 0) {
      assert.equal(rerollOverflightHuntUpgrades(run), true);
      assert.equal(run.progression.rerolls, 1);
    }
    assert.equal(chooseOverflightHuntUpgrade(run, 'bogus'), false);
    chooseOverflightHuntUpgrade(run, run.offers[0].id);
  }
  assert.equal(run.tick, clock);
  assert.equal(run.phase, 'playing');
  assert.equal(run.stats.upgradesChosen, 8);
  assert.equal(run.stats.optionalChoices, 2);
  assert.equal(chooseOverflightHuntUpgrade(run, 'strike-width:1'), false);
});

test('draft waits for the boost transaction to finish and confirmation cannot trigger a boost', () => {
  const run = quiet();
  for (let i = 0; i < 10; i++) spawn(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run, { boost: true, x: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.hunt.pendingChoices, 1);
  steps(run, 20);
  assert.equal(run.phase, 'upgrade');
  chooseOverflightHuntUpgrade(run, run.offers[0].id);
  run.player.boostCooldown = 0;
  steps(run, 90, { boost: true });
  assert.equal(run.stats.boostsUsed, 1);
});

test('courier escape starts only after reveal and required targets never expire', () => {
  const run = quiet();
  const courier = spawn(run, { family: 'courier', behavior: 'courier', x: 50, y: 50 });
  steps(run, 1200);
  assert.equal(courier.active, true);
  assert.equal(courier.escapeRemaining, 18);
  run.player.x = 120;
  run.player.y = 50;
  steps(run, 1200);
  assert.equal(courier.active, false);
  assert.equal(run.hunt.couriersEscaped, 1);
});

test('replacement preserves the build and finite world and ends after the last airframe', () => {
  const run = quiet({ airframes: 3 });
  upgrade(run, 'boost-duration');
  spawn(run, { x: run.player.x + 40, y: run.player.y });
  for (let i = 0; i < 3; i++) {
    run.player.hull = 20;
    run.player.invulnerable = 0;
    projectile(run, { x: run.player.x, y: run.player.y });
    stepOverflightHunt(run);
    if (i < 2) {
      assert.equal(run.player.invulnerable, 1.5);
      assert.equal(run.phase, 'playing');
    }
  }
  assert.equal(run.phase, 'lost');
  assert.equal(run.airframesRemaining, 0);
  assert.equal(run.build.hunt['boost-duration'], 1);
  assert.equal(run.stats.kills, 0);
});

test('all rank values used by previews are identical to simulation parameters', () => {
  const build = createOverflightHuntBuild();
  for (const id of HUNT_UPGRADE_IDS) {
    for (const rank of [1, 2]) {
      const card = legalOverflightHuntUpgrades(build).find((item) => item.id === `${id}:${rank}`);
      assert.ok(card.title.en && card.title.uk && card.current.uk && card.next.en);
      assert.equal(applyOverflightHuntUpgrade(build, card), true);
      const isolated = createOverflightHuntBuild();
      isolated.hunt[id] = rank;
      const { id: _, rank: __, ...preview } = overflightHuntUpgradeParameters(id, rank);
      assert.deepEqual(preview, overflightHuntParameters(isolated));
    }
  }
  assert.equal(legalOverflightHuntUpgrades(build).length, 0);
  assert.equal(applyOverflightHuntUpgrade(build, { id: 'boost-duration:3' }), false);
});

test('same compiled seed and inputs produce byte-identical summaries and enemy states', () => {
  const play = () => {
    const run = createOverflightHuntRun(project);
    startOverflightHunt(run);
    for (let i = 0; i < 3600 && run.phase !== 'lost'; i++) {
      if (run.phase === 'upgrade') chooseOverflightHuntUpgrade(run, run.offers[0].id);
      stepOverflightHunt(run, { x: Math.cos(i / 140), y: Math.sin(i / 110), boost: i % 160 === 0 });
    }
    return {
      summary: overflightHuntSummary(run),
      enemies: run.enemies
        .filter((enemy) => enemy.active)
        .map((enemy) => [enemy.id, enemy.x, enemy.y, enemy.behaviorPhase]),
    };
  };
  assert.deepEqual(play(), play());
});

test('initial machinery objectives require a telegraphed attack before their first opening', () => {
  const run = quiet();
  const enemy = spawn(run, {
    family: 'utility-car',
    behavior: 'vehicle',
    objectiveId: 'fixture-heavy',
    x: run.player.x + 100,
    y: run.player.y,
  });
  assert.equal(overflightHuntContactState(enemy), 'machinery-guarded');
  stepOverflightHunt(run);
  assert.equal(enemy.behaviorPhase, 'windup');
  assert.ok(enemy.phaseRemaining >= 1);
  steps(run, 72);
  assert.ok(['windup', 'burst'].includes(enemy.behaviorPhase));
  steps(run, 25);
  assert.equal(enemy.behaviorPhase, 'recovery');
  assert.ok(enemy.phaseRemaining > 2.8);
});

test('one exposed base-kit tank takes exactly three distinct boosted passes', () => {
  const run = quiet();
  const enemy = spawn(run, {
    family: 'tracked-tank',
    x: run.player.x + 20,
    y: run.player.y,
    phaseRemaining: 100,
  });
  for (let hit = 0; hit < 3; hit++) {
    run.player.x = enemy.x - 21;
    run.player.y = enemy.y;
    run.player.vx = 0;
    run.player.vy = 0;
    stepOverflightHunt(run, { x: 1, boost: true });
    assert.equal(enemy.armorSegments, 2 - hit);
    if (hit < 2) {
      run.player.x = enemy.x - 120;
      run.player.vx = 0;
      run.player.boostRemaining = 0;
      steps(run, 155);
    }
  }
  assert.equal(enemy.active, false);
  assert.equal(run.hunt.armorHits, 3);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.player.hull, 100);
  assert.equal(run.progression.choices, 0);
});

test('small cosmetic pools can exhaust without losing casualties or rewards', () => {
  const source = structuredClone(project);
  source.encounters = [];
  source.resources.pools.effects = 1;
  const run = createOverflightHuntRun(source);
  startOverflightHunt(run);
  for (let i = 0; i < 80; i++) spawn(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run);
  assert.equal(run.stats.kills, 80);
  assert.equal(run.defeats.sequence, 80);
  assert.equal(run.hunt.ordinaryKills, 80);
  assert.equal(run.stats.droppedVisualEffects, 79);
  assert.equal(run._enemyFree.length, run.enemies.length);
});

test('an exhausted projectile pool defers shots without corrupting ownership or warning slots', () => {
  const source = structuredClone(project);
  source.encounters = [];
  source.resources.pools.projectiles = 1;
  const run = createOverflightHuntRun(source);
  startOverflightHunt(run);
  projectile(run, { x: 50, y: 50 });
  const enemy = spawn(run, {
    family: 'brace-trooper',
    behavior: 'brace',
    x: run.player.x + 150,
    y: run.player.y,
    behaviorPhase: 'windup',
    phaseRemaining: 0.001,
  });
  stepOverflightHunt(run);
  assert.equal(enemy.pendingFire, false);
  assert.equal(run.stats.projectileDeferrals, 1);
  assert.equal(run.projectiles.filter((shot) => shot.active).length, 1);
});

test('stationary waiting cannot clear required objectives or replenish finite packs', () => {
  const run = createOverflightHuntRun(project);
  startOverflightHunt(run);
  const spawned = run.stats.spawned;
  for (let i = 0; i < 3600; i++) {
    if (run.phase === 'upgrade') chooseOverflightHuntUpgrade(run, run.offers[0].id);
    stepOverflightHunt(run);
  }
  assert.notEqual(run.phase, 'won');
  assert.equal(run.hunt.objectivesCompleted, 0);
  assert.equal(run.stats.spawned, spawned);
  assert.equal(run.stats.boostsUsed, 0);
});

test('the final fractional projectile flight segment collides, without flying past its lifetime', () => {
  const run = quiet();
  const shot = projectile(run, { x: run.player.x - 30, y: run.player.y, vx: 3000 });
  shot.remaining = 0.01;
  stepOverflightHunt(run);
  assert.equal(run.player.hull, 80);
  assert.equal(shot.active, false);
  run.player.invulnerable = 0;
  const short = projectile(run, { x: run.player.x - 30, y: run.player.y, vx: 3000 });
  short.remaining = 0.002;
  stepOverflightHunt(run);
  assert.equal(run.player.hull, 80);
  assert.equal(short.active, false);
});

test('formation-derived edge waypoints remain reachable inside the arena', () => {
  const run = quiet();
  const enemy = spawn(run, {
    x: 40,
    y: 40,
    speed: 100,
    route: [
      { x: -40, y: 40 },
      { x: 80, y: 40 },
    ],
  });
  assert.equal(enemy.route[0].x, 28);
  steps(run, 15);
  assert.equal(enemy.routeIndex, 1);
});

test('Raid technical workload sustains actual contact effects and exact populations without a game result', () => {
  const run = createOverflightHuntRun(project, { fixture: 'raid-reference' });
  startOverflightHunt(run);
  const expected = project.encounters.reduce(
    (sum, encounter) =>
      sum +
      encounter.objectives.length +
      encounter.packs.reduce((total, pack) => total + pack.count, 0),
    0,
  );
  for (let i = 0; i < 9000; i++) {
    stepOverflightHunt(run, overflightHuntFixtureInput(run));
    assert.equal(run.stats.enemiesAlive, expected);
    assert.equal(run.stats.enemiesVisible, 200);
    assert.equal(run.phase, 'playing');
  }
  const summary = overflightHuntSummary(run);
  assert.equal(summary.outcome, 'technical-fixture');
  assert.equal(summary.fixture, 'raid-reference');
  assert.equal(summary.fixtureWorkload.gameplayResult, false);
  assert.equal(run.progression.choices, 0);
  assert.equal(run.hunt.objectivesCompleted, 0);
  assert.ok(run.stats.kills > 500);
  assert.ok(run.stats.projectilesFired > 50);
  assert.equal(run.stats.kills, run.fixtureWorkload.recycledActors);
  assert.equal(
    run.enemies.filter(
      (enemy) =>
        enemy.active && enemy.specialist && enemy._fixtureDefinition.partition === 'visible',
    ).length,
    8,
  );
  assert.throws(() => overflightHuntFixtureInput(quiet()), /technical/);
});

test('boost ranks, Rush and chain expiry obey exact fixed tick durations without floating residue', () => {
  for (const [rank, ticks] of [
    [0, 18],
    [1, 21],
    [2, 24],
  ]) {
    const run = quiet();
    if (rank) upgrade(run, 'boost-duration', rank);
    let boostedTicks = 0;
    for (let i = 0; i < 30; i++) {
      stepOverflightHunt(run, { x: 1, boost: i === 0 });
      if (run.player.boostRemaining > 0) boostedTicks++;
    }
    assert.equal(boostedTicks, ticks);
  }
  const run = quiet();
  run.hunt.rushCharge = 20;
  stepOverflightHunt(run, { boost: true });
  steps(run, 299);
  assert.ok(run.hunt.rushRemaining > 0);
  stepOverflightHunt(run);
  assert.equal(run.hunt.rushRemaining, 0);
  spawn(run, { x: run.player.x, y: run.player.y });
  stepOverflightHunt(run);
  assert.equal(run.hunt.chain, 1);
  steps(run, 239);
  assert.equal(run.hunt.chain, 1);
  stepOverflightHunt(run);
  assert.equal(run.hunt.chain, 0);
});

test('lethal independent projectile contact wins chronological precedence over a later prey hit', () => {
  const run = quiet({ airframes: 1 });
  run.player.hull = 20;
  const x = run.player.x,
    y = run.player.y;
  projectile(run, { x, y });
  const prey = spawn(run, { x: x + 60, y });
  run.player.vx = 9000;
  stepOverflightHunt(run, { x: 1 });
  assert.equal(run.phase, 'lost');
  assert.equal(prey.active, true);
  assert.equal(run.stats.kills, 0);
});

test('a tracked-tank appearance on an authored column objective still grants its guaranteed upgrade', () => {
  const source = createOverflightHuntProject();
  source.encounters[1].objectives[0].family = 'tracked-tank';
  const run = createOverflightHuntRun(compileOverflightHuntProject(source));
  startOverflightHunt(run);
  const drainDrafts = () => {
    while (run.phase === 'upgrade') chooseOverflightHuntUpgrade(run, run.offers[0].id);
  };
  for (const objective of source.encounters[0].objectives) {
    const enemy = run.enemies.find((item) => item.active && item.objectiveId === objective.id);
    Object.assign(enemy, {
      speed: 0,
      warning: 0,
      behaviorPhase: 'recovery',
      phaseRemaining: 100,
      heading: 0,
    });
    Object.assign(run.player, { x: enemy.x - 1, y: enemy.y, vx: 0, vy: 0 });
    stepOverflightHunt(run);
    drainDrafts();
  }
  assert.equal(run.stats.objectiveChoices, 3);
  const tank = run.enemies.find((enemy) => enemy.active && enemy.objectiveId === 'light-1');
  assert.equal(tank.family, 'tracked-tank');
  assert.equal(tank.role, 'elite');
  Object.assign(tank, { speed: 0, warning: 0, behaviorPhase: 'recovery', phaseRemaining: 100 });
  Object.assign(run.player, { x: tank.x - 20, y: tank.y, vx: 0, vy: 0, boostRemaining: 0.2 });
  stepOverflightHunt(run, { x: 1 });
  assert.equal(tank.active, false);
  assert.equal(run.stats.objectiveChoices, 4);
});
