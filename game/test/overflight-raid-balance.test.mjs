import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  spawnOverflightHuntEnemy,
  overflightHuntContactState,
} from '../overflight/raid-core.mjs';
import {
  overflightHuntWeakPoint,
  overflightHuntEnemyLayers,
} from '../overflight/raid-render-cues.mjs';
import {
  overflightHuntInvestedRanks,
  legalOverflightHuntRefits,
  draftOverflightHuntRefits,
  applyOverflightHuntRefit,
} from '../overflight/raid-upgrades.mjs';
import { overflightHuntPreviewModel } from '../overflight/raid-upgrade-card.mjs';
import {
  createOverflightRaidVariant,
  overflightMarathonProject,
  overflightMarathonNextContract,
  overflightTimeAttackResult,
  overflightRaidVariantRecord,
} from '../overflight/raid-variants.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import {
  createOverflightHuntRecords,
  OVERFLIGHT_HUNT_RECORDS_FORMAT_V3,
} from '../overflight/raid-records.mjs';
import {
  createOverflightHuntPackage,
  exportOverflightHuntPackage,
  importOverflightHuntPackage,
} from '../overflight/raid-community.mjs';
const project = (options = {}) =>
  createOverflightHuntProject({ seed: 42, rulesVersion: 3, ...options });
function quiet() {
  const compiled = structuredClone(compileOverflightHuntProject(project()));
  compiled.encounters = [];
  const run = createOverflightHuntRun(compiled);
  run.caches = [];
  startOverflightHunt(run);
  return run;
}
const steps = (run, count, input = {}) => {
  for (let i = 0; i < count; i++) stepOverflightHunt(run, input);
};
const spawn = (run, options) => spawnOverflightHuntEnemy(run, { speed: 0, warning: 0, ...options });
const capped = (run) => {
  Object.assign(run.build.hunt, {
    'strike-width': 2,
    'boost-duration': 2,
    'boost-cooldown': 2,
    'chain-window': 2,
  });
  run.hunt.refitBudget = 8;
  return run;
};

test('Raid V3 round-trips authored escort links, medal budgets and balance identity without changing old defaults', async () => {
  assert.equal(createOverflightHuntProject().format, 'OverflightHuntProjectV2');
  assert.equal(createOverflightHuntProject({ legacy: true }).format, 'OverflightHuntProjectV1');
  for (const difficulty of ['relaxed', 'standard', 'veteran'])
    for (const encounterSet of ['patrol', 'crossing', 'mixed']) {
      const source = project({ difficulty, encounterSet });
      const compiled = compileOverflightHuntProject(source);
      assert.equal(compiled.rulesVersion, 3);
      assert.equal(compiled.balanceRevision, 'overflight-balance.v3');
      assert.ok(compiled.encounters.every((e) => e.packs.filter((p) => p.escortOf).length === 2));
      for (let contract = 1; contract <= 5; contract++)
        compileOverflightHuntProject(overflightMarathonProject(source, contract, 42 + contract));
    }
  const source = project();
  source.medalBudgets.gold = 75;
  const imported = await importOverflightHuntPackage(
    exportOverflightHuntPackage(createOverflightHuntPackage(source)),
  );
  assert.deepEqual(imported.project, source);
  assert.equal(
    compileOverflightHuntProject(imported.project).projectIdentity,
    compileOverflightHuntProject(source).projectIdentity,
  );
  const bad = structuredClone(source);
  bad.encounters[0].packs.find((p) => p.escortOf).escortOf = 'carrier';
  assert.throws(() => compileOverflightHuntProject(bad), /own sector/);
  const budget = structuredClone(source);
  budget.medalBudgets.silver = 70;
  assert.throws(() => compileOverflightHuntProject(budget), /Silver/);
});

test('guarded machinery has a readable rear-half opening; recovery exposes all sides', () => {
  const run = quiet(),
    p = run.player;
  const enemy = spawn(run, {
    family: 'tracked-tank',
    x: p.x + 70,
    y: p.y,
    heading: 0,
    behaviorPhase: 'guarding',
    phaseRemaining: 100,
  });
  assert.equal(
    overflightHuntContactState(enemy, { x: enemy.x - 50, y: enemy.y }),
    'machinery-exposed',
  );
  assert.equal(
    overflightHuntContactState(enemy, { x: enemy.x + 50, y: enemy.y }),
    'machinery-guarded',
  );
  assert.equal(overflightHuntWeakPoint(enemy).arc, Math.PI);
  assert.ok(
    overflightHuntEnemyLayers(enemy).some((layer) => layer.frame === 'arrow' && layer.dx < 0),
  );
  enemy.behaviorPhase = 'recovery';
  assert.equal(overflightHuntWeakPoint(enemy).arc, Math.PI * 2);
  assert.equal(
    overflightHuntContactState(enemy, { x: enemy.x + 50, y: enemy.y }),
    'machinery-exposed',
  );
  enemy.huntRulesVersion = 2;
  enemy.behaviorPhase = 'guarding';
  assert.equal(
    overflightHuntContactState(enemy, { x: enemy.x - 50, y: enemy.y }),
    'machinery-guarded',
  );
});

test('fresh boosted passes can remove two plates in one opening; the same boost cannot repeat after exiting', () => {
  const run = quiet(),
    p = run.player;
  const enemy = spawn(run, {
    family: 'tracked-tank',
    x: p.x + 45,
    y: p.y,
    heading: 0,
    behaviorPhase: 'recovery',
    phaseRemaining: 3.5,
  });
  steps(run, 10, { x: 1, boost: true });
  assert.equal(enemy.armorSegments, 2);
  const boostTick = run._boostStartedTick;
  // Reconstruct another re-entry from this same contact transaction's boost ID.
  Object.assign(p, { x: enemy.x - 50, vx: 0, vy: 0, boostRemaining: 0.25 });
  steps(run, 10, { x: 1 });
  assert.equal(enemy.armorSegments, 2);
  assert.equal(run._boostStartedTick, boostTick);
  Object.assign(p, { x: enemy.x - 80, vx: 0, vy: 0, boostRemaining: 0 });
  while (p.boostCooldown > 0) stepOverflightHunt(run);
  Object.assign(p, { x: enemy.x - 45, vx: 0, vy: 0 });
  steps(run, 10, { x: 1, boost: true });
  assert.equal(enemy.armorSegments, 1);
  assert.equal(enemy.behaviorPhase, 'recovery');
  assert.ok(enemy.phaseRemaining > 0);
  assert.equal(run.hunt.armorHits, 2);
});

test('frontal machinery contact still hurts and width does not expand the rear angle', () => {
  const run = quiet(),
    p = run.player;
  const enemy = spawn(run, {
    family: 'armored-carrier',
    x: p.x - 24,
    y: p.y,
    heading: 0,
    behaviorPhase: 'guarding',
    phaseRemaining: 100,
  });
  run.build.hunt['strike-width'] = 2;
  stepOverflightHunt(run, { x: -1, boost: true });
  assert.equal(p.hull, 80);
  assert.equal(enemy.armorSegments, 2);
  assert.equal(run.stats.blockedContacts, 1);
});

test('guard interruption opens a shield or brace but never machinery or independent fired projectiles', () => {
  const run = quiet(),
    p = run.player;
  run.build.hunt['guard-interrupt'] = 2;
  const machine = spawn(run, {
    family: 'tracked-tank',
    x: p.x + 80,
    y: p.y,
    behaviorPhase: 'windup',
    phaseRemaining: 3,
  });
  const brace = spawn(run, {
    family: 'brace-trooper',
    behavior: 'brace',
    x: p.x + 90,
    y: p.y + 40,
    behaviorPhase: 'windup',
    phaseRemaining: 3,
  });
  spawn(run, { family: 'patroller', x: p.x + 12, y: p.y });
  const slot = run._projectileFree.pop();
  Object.assign(run.projectiles[slot], {
    active: true,
    id: run._nextId++,
    owner: machine.id,
    x: p.x + 200,
    y: p.y,
    vx: 0,
    vy: 0,
    radius: 3,
    remaining: 5,
  });
  stepOverflightHunt(run, { x: 1, boost: true });
  assert.equal(brace.behaviorPhase, 'recovery');
  assert.equal(machine.behaviorPhase, 'windup');
  assert.equal(run.projectiles[slot].active, true);
});

test('an objective restores only one shield charge and escorts move with the defended target', () => {
  const run = createOverflightHuntRun(compileOverflightHuntProject(project()));
  startOverflightHunt(run);
  const leader = run.enemies.find((e) => e.active && e.objectiveId === 'leader-1');
  const escort = run.enemies.find((e) => e.active && e.escortOf && e.behavior === 'shield');
  const oldX = escort.x,
    oldY = escort.y;
  steps(run, 75);
  assert.ok(Math.hypot(escort.x - oldX, escort.y - oldY) > 2);
  run.build.hunt['recovery-shield'] = 2;
  run.player.shield = 0;
  Object.assign(run.player, { x: leader.x, y: leader.y, vx: 0, vy: 0 });
  stepOverflightHunt(run);
  assert.equal(leader.active, false);
  assert.equal(run.player.shield, 1);
});

test('Marathon refits preserve eight invested ranks, compatibility and useful choices', () => {
  const run = capped(quiet());
  assert.equal(overflightHuntInvestedRanks(run.build), 8);
  run.progression.rerolls = 3;
  let offers = draftOverflightHuntRefits(run, () => 0.4);
  assert.equal(offers.length, 3);
  assert.equal(offers[2].system, 'field-score');
  const offer = offers[0];
  assert.equal(overflightHuntPreviewModel(offer).beforeSystem, offer.fromSystem);
  assert.equal(applyOverflightHuntRefit(run, offer), true);
  assert.equal(overflightHuntInvestedRanks(run.build), 8);
  assert.equal(run.build.hunt[offer.fromSystem], offer.fromNextRank);
  assert.equal(run.build.hunt[offer.system], offer.rank);
  run.player.hull = 90;
  offers = draftOverflightHuntRefits(run, () => 0.4);
  assert.equal(offers[2].system, 'field-repair');
  assert.equal(offers[2].amount, 10);
  assert.equal(applyOverflightHuntRefit(run, offers[2]), true);
  assert.equal(run.player.hull, 100);
  assert.equal(applyOverflightHuntRefit(run, offers[2]), false);
  for (const card of legalOverflightHuntRefits(run)) {
    const copy = structuredClone(run);
    assert.equal(applyOverflightHuntRefit(copy, card), true);
    assert.equal(overflightHuntInvestedRanks(copy.build), 8);
    assert.ok(!(copy.build.hunt.plating && copy.build.hunt['recovery-shield']));
  }
});

test('authored provisional medals and V3 records retain raw/adjusted time in a separate bucket', async () => {
  const source = project();
  source.medalBudgets.gold = 30;
  source.medalBudgets.silver = 60;
  const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, {
    variant: 'time-attack',
  });
  const run = mode.createRun(compileOverflightHuntProject(source));
  Object.assign(run, { phase: 'won', time: 29 });
  run.stats.damageTaken = 20;
  assert.equal(overflightTimeAttackResult(run).medal, 'silver');
  let state = { format: OVERFLIGHT_HUNT_RECORDS_FORMAT_V3, entries: {} };
  const records = createOverflightHuntRecords({
    revisedBackend: {
      read: async () => state,
      update: async (fn) => (state = fn(state)),
      close() {},
    },
  });
  const saved = await records.record(overflightRaidVariantRecord(run));
  assert.equal(saved.durable, true);
  assert.equal(saved.fastestClear.rawTime, 29);
  assert.equal(saved.fastestClear.adjustedTime, 34);
  records.dispose();
  const marathon = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, {
    variant: 'marathon',
  }).createRun(compileOverflightHuntProject(source));
  assert.match(overflightMarathonNextContract(marathon), /Crossing columns/);
  assert.equal(marathon.hunt.refitBudget, 8);
});

test('interrupted shields recover their committed facing rather than staying permanently open', () => {
  const run = quiet(),
    p = run.player;
  run.build.hunt['guard-interrupt'] = 1;
  const shield = spawn(run, {
    family: 'shield-bearer',
    behavior: 'shield',
    x: p.x + 100,
    y: p.y,
    heading: Math.PI,
    phaseRemaining: 2,
  });
  spawn(run, { family: 'patroller', x: p.x + 12, y: p.y });
  stepOverflightHunt(run, { x: 1, boost: true });
  assert.equal(shield.behaviorPhase, 'recovery');
  assert.equal(overflightHuntContactState(shield, p), 'exposed');
  Object.assign(p, { x: shield.x - 160, boostRemaining: 0, vx: 0, vy: 0 });
  steps(run, 46);
  assert.equal(shield.behaviorPhase, 'patrol');
  assert.equal(overflightHuntContactState(shield, p), 'guarded');
});

test('capped Marathon opens native refit drafts and carries the budget to the next contract', () => {
  const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, {
    variant: 'marathon',
  });
  const run = capped(mode.createRun(compileOverflightHuntProject(project())));
  mode.start(run);
  run.hunt.pendingChoices = 1;
  mode.step(run, {});
  assert.equal(run.phase, 'upgrade');
  assert.equal(run.offers.length, 3);
  assert.ok(run.offers.every((offer) => ['refit', 'field'].includes(offer.kind)));
  assert.equal(mode.choose(run, run.offers[0].id), true);
  assert.equal(overflightHuntInvestedRanks(run.build), 8);
  run.phase = 'won';
  run.hunt.score = 500;
  assert.equal(mode.continueContract(run), true);
  assert.equal(run.hunt.refitBudget, 8);
  assert.equal(overflightHuntInvestedRanks(run.build), 8);
  assert.equal(run.raidVariant.contract, 2);
});

test('Raid reports actual hull loss for contact, lane, fan and ground result breakdowns', () => {
  for (const cause of ['lane', 'fan']) {
    const run = quiet(),
      p = run.player;
    const slot = run._projectileFree.pop();
    Object.assign(run.projectiles[slot], {
      active: true,
      id: run._nextId++,
      owner: 999,
      attackKind: cause,
      x: p.x,
      y: p.y,
      vx: 0,
      vy: 0,
      radius: 3,
      remaining: 2,
    });
    stepOverflightHunt(run);
    assert.equal(run.stats.damageTaken, 20);
    assert.equal(run.stats.damageCauses[cause], 20);
  }
  const run = quiet(),
    p = run.player;
  const tank = spawn(run, {
    family: 'tracked-tank',
    x: p.x + 220,
    y: p.y,
    behaviorPhase: 'windup',
    phaseRemaining: 0,
  });
  tank.attackSpec = { kind: 'ground', x: p.x, y: p.y, radius: 45 };
  stepOverflightHunt(run);
  assert.equal(run.stats.damageCauses.ground, 20);
  assert.equal(run.stats.damageTaken, 20);
});
