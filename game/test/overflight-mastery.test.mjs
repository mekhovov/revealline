import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import { createOverflightRun } from '../overflight/core.mjs';
import {
  createOverflightMastery,
  overflightRunReport,
  validateOverflightMastery,
  OVERFLIGHT_MASTERY_FORMAT,
} from '../overflight/mastery.mjs';
import {
  renderOverflightRunReport,
  overflightFinalTargetReport,
} from '../overflight/mastery-view.mjs';
import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import { createOverflightRaidVariant } from '../overflight/raid-variants.mjs';
import { createOverflightWorldPresentation } from '../overflight/worlds.mjs';
import { canonicalJSON, dataIdentity } from '../data-json.mjs';

function run() {
  const result = createOverflightRun(
    compileOverflightProject(
      createOverflightProject({ rulesVersion: 3, world: 'field-crossing', seed: 17 }),
    ),
    { airframes: 3 },
  );
  result.phase = 'won';
  result.time = 360;
  Object.assign(result.stats, {
    kills: 2000,
    damageTaken: 40,
    xpEarned: 1000,
    xpCollected: 700,
    xpOnGround: 300,
    cachesClaimed: 1,
  });
  result.stats.damageCauses.contact = 40;
  result.progression.history = [
    { id: 'primary:wide:2', time: 20 },
    { id: 'primary:wide:3', time: 70 },
    { id: 'primary:wide:4', time: 90 },
  ];
  return result;
}
function memory() {
  let source = { format: OVERFLIGHT_MASTERY_FORMAT, entries: {} };
  return {
    fail: false,
    writes: 0,
    async read() {
      if (this.fail) throw new Error('unavailable');
      return structuredClone(source);
    },
    async update(fn) {
      if (this.fail) throw new Error('unavailable');
      this.writes++;
      source = fn(source);
      return structuredClone(source);
    },
  };
}

test('mastery follows completed actions, preserves earned flags and compares the prior same-seed run', async () => {
  const backend = memory();
  const mastery = createOverflightMastery({ backend });
  const first = run();
  const result = await mastery.record(first);
  assert.deepEqual(result.achieved, { complete: true, intact: true, technique: true });
  assert.equal(result.previous, null);
  assert.equal(result.durable, true);
  await mastery.record(first);
  assert.equal(backend.writes, 1, 'refreshing results does not write another attempt');
  const second = run();
  second.phase = 'lost';
  second.time = 250;
  second.airframesRemaining = 0;
  second.stats.cachesClaimed = 0;
  const next = await mastery.record(second);
  assert.equal(next.previous.time, 360);
  assert.equal(next.last.outcome, 'lost');
  assert.deepEqual(next.achieved, result.achieved, 'later failures do not erase mastery');
  const other = run();
  other.seed = 18;
  assert.equal((await mastery.record(other)).previous, null);
  const veteran = run();
  veteran.difficulty = 'veteran';
  assert.equal((await mastery.record(veteran)).previous, null);
  const cosmetics = run();
  cosmetics.appearance = { characterId: 'different', reducedEffects: true };
  assert.equal((await mastery.record(cosmetics)).previous.time, 250);
  const resultState = await backend.read();
  assert.doesNotThrow(() => validateOverflightMastery(resultState));
});

test('all six battlefield worlds persist mastery across reopened stores and retain legacy entries', async () => {
  const worlds = [
    'field-crossing',
    'freight-depot',
    'relay-ruins',
    'river-port',
    'chalk-quarry',
    'orchard-strongpoint',
  ];
  const backend = memory();
  const makeRun = (world) => {
    const result = createOverflightRun(
      compileOverflightProject(createOverflightProject({ rulesVersion: 4, world, seed: 17 })),
      { airframes: 3 },
    );
    result.phase = 'won';
    result.time = 360;
    result.stats.cachesClaimed = 1;
    return result;
  };
  const firstStore = createOverflightMastery({ backend });
  assert.equal((await firstStore.record(run())).durable, true, 'old rules remain writable');
  for (const world of worlds) {
    const saved = await firstStore.record(makeRun(world));
    assert.equal(saved.context.world, world);
    assert.equal(saved.durable, true, `${world} achievement must reach profile storage`);
    assert.deepEqual(saved.achieved, { complete: true, intact: true, technique: true });
  }
  firstStore.dispose();
  const reopened = createOverflightMastery({ backend });
  for (const world of worlds) {
    const replay = makeRun(world);
    replay.phase = 'lost';
    replay.time = 250;
    replay.airframesRemaining = 0;
    replay.stats.cachesClaimed = 0;
    const saved = await reopened.record(replay);
    assert.equal(saved.durable, true);
    assert.equal(saved.previous.time, 360, `${world} must recover its prior run after reopening`);
    assert.deepEqual(saved.achieved, { complete: true, intact: true, technique: true });
  }
  const state = await backend.read();
  assert.equal(Object.keys(validateOverflightMastery(state).entries).length, 7);
  const unknown = structuredClone(Object.values(state.entries)[0]);
  unknown.context.world = 'unknown-world';
  assert.throws(
    () =>
      validateOverflightMastery({
        format: OVERFLIGHT_MASTERY_FORMAT,
        entries: { [dataIdentity(unknown.context)]: unknown },
      }),
    /Invalid mastery world/,
  );
  reopened.dispose();
});

test('Riy requires reached attack range and Raid requires an earned chain, not selected upgrades', () => {
  const squad = run();
  squad.riy = { commands: 8, engagements: 2 };
  assert.equal(overflightRunReport(squad).mastery.technique, false);
  squad.riy.engagements = 3;
  assert.equal(overflightRunReport(squad).mastery.technique, true);
  const raid = run();
  raid.hunt = { bestChain: 9 };
  assert.equal(overflightRunReport(raid).mastery.technique, false);
  raid.hunt.bestChain = 10;
  assert.equal(overflightRunReport(raid).mastery.technique, true);
  raid.phase = 'lost';
  assert.equal(overflightRunReport(raid).mastery.technique, false);
});

test('world artwork does not split mastery for unchanged authored encounters or legacy rules', async () => {
  const mastery = createOverflightMastery({ backend: memory() });
  const original = run();
  const first = await mastery.record(original);
  assert.equal(first.context.world, 'field-crossing');
  const source = createOverflightProject({ rulesVersion: 3, world: 'field-crossing', seed: 17 });
  source.presentation = createOverflightWorldPresentation('relay-ruins');
  const reskinned = run();
  reskinned.compiled = compileOverflightProject(source);
  assert.ok(original.compiled.projectIdentity);
  assert.equal(reskinned.compiled.projectIdentity, original.compiled.projectIdentity);
  const updated = await mastery.record(reskinned);
  assert.deepEqual(updated.context, first.context);
  assert.equal(updated.previous.time, 360);
  for (const world of ['freight-depot', 'relay-ruins']) {
    const legacy = createOverflightProject({ rulesVersion: 3, seed: 17 });
    legacy.presentation = createOverflightWorldPresentation(world);
    const oldRun = run();
    oldRun.compiled = compileOverflightProject(legacy);
    const result = await mastery.record(oldRun);
    assert.equal(result.context.world, 'legacy');
    assert.equal(result.previous?.time ?? null, world === 'relay-ruins' ? 360 : null);
  }
});

test('report distinguishes earned, collected, ground salvage and upgrade gaps without claiming reachability', () => {
  const report = overflightRunReport(run());
  assert.equal(report.salvageEarned, 1000);
  assert.equal(report.salvageCollected, 700);
  assert.equal(report.salvageRemaining, 300);
  assert.equal(report.longestChoiceGap, 50);
  assert.equal(report.sinceLastChoice, 270);
});

test('flight report shows actual final armor and hull without treating missing targets as defeated', () => {
  const current = run();
  current.phase = 'lost';
  assert.equal(overflightFinalTargetReport(current), null);
  current.goals = { ...current.goals, finalSpawned: true, finalId: 123 };
  assert.equal(overflightFinalTargetReport(current), null, 'an absent snapshot is not zero health');
  const target = current.enemies[0];
  Object.assign(target, {
    id: 123,
    active: true,
    role: 'final',
    hp: 1750,
    maxHp: 3500,
    armor: 750,
    maxArmor: 1500,
  });
  const before = structuredClone(target);
  assert.deepEqual(overflightFinalTargetReport(current), {
    armor: 750,
    maxArmor: 1500,
    hull: 1750,
    maxHull: 3500,
  });
  assert.deepEqual(target, before);
  const document = new Document();
  const root = document.createElement('section');
  renderOverflightRunReport({ document, root, run: current });
  const meters = root.querySelectorAll('progress');
  assert.equal(meters.length, 2);
  assert.equal(meters[0].getAttribute('value'), '750');
  assert.equal(meters[0].getAttribute('max'), '1500');
  assert.equal(meters[1].getAttribute('value'), '1750');
  assert.match(root.textContent, /Armor remaining: 50%/);
  assert.match(root.textContent, /Hull remaining: 50%/);
  renderOverflightRunReport({ document, root, run: current, locale: 'uk' });
  assert.match(root.textContent, /Залишок броні: 50%/);
  target.id = 124;
  assert.equal(
    overflightFinalTargetReport(current),
    null,
    'pool reuse cannot report another actor',
  );
  target.id = 123;
  target.active = false;
  assert.equal(overflightFinalTargetReport(current), null);
  current.goals.finalDefeated = true;
  target.hp = 0;
  target.armor = 0;
  assert.deepEqual(overflightFinalTargetReport(current), {
    armor: 0,
    maxArmor: 1500,
    hull: 0,
    maxHull: 3500,
  });
  current.hunt = { bestChain: 5 };
  assert.equal(overflightFinalTargetReport(current), null, 'Raid retains its objective report');
});

test('failed profile writes retain session achievements; review fixtures never write', async () => {
  const backend = memory();
  backend.fail = true;
  const mastery = createOverflightMastery({ backend });
  const first = await mastery.record(run());
  assert.equal(first.durable, false);
  backend.fail = false;
  const next = run();
  next.stats.cachesClaimed = 0;
  const saved = await mastery.record(next);
  assert.equal(saved.durable, true);
  assert.equal(saved.achieved.technique, true);
  assert.equal(saved.previous.time, 360);
  const review = run();
  review.review = true;
  await assert.rejects(mastery.record(review), /Review runs/);
  assert.equal(backend.writes, 1);
  const resultState = await backend.read();
  assert.doesNotThrow(() => validateOverflightMastery(resultState));
});

test('Marathon is recorded only after banking and its mode stays separate from Single Raid', async () => {
  const backend = memory();
  const mastery = createOverflightMastery({ backend });
  const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: 'marathon' });
  const compiled = mode.compileProject(mode.createProject());
  const raid = mode.createRun(compiled, { airframes: 3 });
  raid.phase = 'won';
  raid.time = 30;
  raid.hunt.bestChain = 12;
  assert.equal(await mastery.record(raid), null);
  assert.equal(backend.writes, 0);
  mode.bankContract(raid);
  const saved = await mastery.record(raid);
  assert.equal(saved.context.mode, 'marathon');
  assert.equal(saved.achieved.technique, true);
  const single = OVERFLIGHT_HUNT_MODE.createRun(compiled, { airframes: 3 });
  single.phase = 'won';
  single.time = 30;
  assert.equal((await mastery.record(single)).previous, null);
});

test('mastery evicts the oldest context at capacity while retaining recently replayed achievements', async () => {
  const initial = await createOverflightMastery({ backend: memory() }).record(run());
  const contextAt = (seed) => ({ ...initial.context, rules: { ...initial.context.rules, seed } });
  let source = {
    format: OVERFLIGHT_MASTERY_FORMAT,
    entries: Object.fromEntries(
      Array.from({ length: 256 }, (_, index) => {
        const context = contextAt(index + 1);
        return [
          dataIdentity(context),
          {
            context,
            achieved: initial.achieved,
            last: initial.last,
            order: index,
          },
        ];
      }),
    ),
  };
  const backend = {
    async read() {
      return JSON.parse(canonicalJSON(source));
    },
    async update(fn) {
      source = fn(JSON.parse(canonicalJSON(source)));
      return source;
    },
  };
  const mastery = createOverflightMastery({ backend });
  const repeated = run();
  repeated.seed = 1;
  repeated.phase = 'lost';
  repeated.stats.cachesClaimed = 0;
  const replayed = await mastery.record(repeated);
  assert.equal(replayed.durable, true);
  assert.equal(replayed.achieved.technique, true);
  for (const seed of [257, 258]) {
    const next = run();
    next.seed = seed;
    assert.equal((await mastery.record(next)).durable, true);
  }
  assert.equal(Object.keys(source.entries).length, 256);
  assert.ok(source.entries[dataIdentity(contextAt(1))]);
  assert.equal(source.entries[dataIdentity(contextAt(2))], undefined);
  assert.equal(source.entries[dataIdentity(contextAt(3))], undefined);
  assert.ok(source.entries[dataIdentity(contextAt(258))]);
  assert.doesNotThrow(() => validateOverflightMastery(source));
  for (const entry of Object.values(source.entries)) delete entry.order;
  assert.doesNotThrow(
    () => validateOverflightMastery(source),
    'existing profiles need no migration',
  );
});

test('Marathon mastery totals damage and airframe loss across contracts exactly once', async () => {
  const mode = createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant: 'marathon' });
  const raid = mode.createRun(mode.compileProject(mode.createProject()), { airframes: 3 });
  raid.phase = 'won';
  raid.time = 35;
  raid.stats.damageTaken = 120;
  raid.stats.kills = 20;
  raid.airframesRemaining = 2;
  assert.equal(mode.continueContract(raid), true);
  assert.equal(raid.airframesRemaining, 2);
  raid.phase = 'won';
  raid.time = 25;
  raid.stats.damageTaken = 40;
  raid.stats.kills = 10;
  assert.equal(mode.bankContract(raid), true);
  const mastery = createOverflightMastery({ backend: memory() });
  const result = await mastery.record(raid);
  assert.equal(result.last.time, 60);
  assert.equal(result.last.damageTaken, 160);
  assert.equal(result.last.kills, 30);
  assert.equal(result.last.airframesLost, 1);
  assert.equal(result.achieved.intact, false);
  assert.deepEqual((await mastery.record(raid)).last, result.last);
});

test('native report presents three goals, measured progression and understandable prior-run differences', () => {
  const document = new Document();
  const root = document.createElement('section');
  const current = run();
  renderOverflightRunReport({
    document,
    root,
    run: current,
    previous: { time: 380, kills: 1800, damageTaken: 80 },
  });
  assert.equal(root.querySelectorAll('li').length, 3);
  assert.match(root.textContent, /1000 \/ 700 \/ 300/);
  assert.match(root.textContent, /-20\.0s/);
  assert.match(root.textContent, /\+200/);
  assert.match(root.textContent, /-40/);
  renderOverflightRunReport({ document, root, run: current, locale: 'uk' });
  assert.match(root.textContent, /Майстерність на полі/);
});
