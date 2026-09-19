import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import {
  createStudioTeamFixture,
  TEAM_PREVIEW_SCENARIOS,
} from '../../authoring/asset-studio/team-preview-fixture.mjs';

const hash = (run) => createHash('sha256').update(JSON.stringify(run)).digest('hex');
const event = (run, type) => run.events.some((item) => item.type === type);
const rules = {
  initial(run) {
    assert.equal(run.tick, 0);
    assert.equal(run.coverage, 0);
    assert.equal(run.status, 'running');
    assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
  },
  cutting(run) {
    assert.ok(run.players.every((player) => player.cutting && player.trail.length));
    assert.ok(event(run, 'cut.started'));
  },
  warning(run) {
    assert.ok(run.enemies.some((enemy) => enemy.type === 'hunter' && enemy.phase === 'warning'));
    assert.ok(event(run, 'enemy.warning'));
  },
  charge(run) {
    assert.ok(run.enemies.some((enemy) => enemy.type === 'hunter' && enemy.phase === 'commit'));
    assert.ok(event(run, 'enemy.commit'));
  },
  capture(run) {
    assert.ok(run.claimedCount > 0 && run.coverage > 0);
    assert.ok(run.players.every((player) => !player.cutting));
    assert.ok(event(run, 'cut.joint'));
  },
  anchors(run) {
    assert.equal(run.status, 'running');
    assert.ok(run.strongholds[0].anchors.every((anchor) => anchor.captured));
    assert.equal(run.strongholds[0].shielded, false);
    assert.equal(run.strongholds[0].defeated, false);
    assert.ok(event(run, 'shield.disabled'));
  },
  core(run) {
    assert.equal(run.status, 'running');
    assert.ok(run.strongholds[0].anchors.every((anchor) => anchor.captured));
    assert.equal(run.strongholds[0].shielded, false);
    assert.equal(run.strongholds[0].defeated, false);
    assert.ok(run.players.every((player) => Math.abs(player.y - 6.5) < 0.051));
  },
  victory(run) {
    assert.equal(run.status, 'won');
    assert.ok(event(run, 'run.completed'));
    assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
    if (run.level.goal.cores) assert.ok(run.strongholds.every((hold) => hold.defeated));
    else assert.ok(run.coverage >= run.level.goal.coverage);
  },
};
function assertScenario(run, scenario) {
  if (rules[scenario]) return rules[scenario](run);
  const seat = Number(scenario.at(-1)) - 1;
  const target = run.players[seat];
  const helper = run.players[1 - seat];
  assert.equal(run.status, 'running');
  assert.equal(run.team.reserves, 3);
  assert.ok(run.claimedCount > 0);
  assert.ok(run.players.every((player) => player.support.uses === 0));
  assert.ok(run.strongholds[0].anchors.every((anchor) => anchor.captured));
  assert.equal(run.strongholds[0].defeated, false);
  if (scenario.startsWith('downed')) {
    assert.equal(target.status, 'downed');
    assert.equal(helper.status, 'active');
    assert.equal(helper.rescue, null);
    assert.ok(event(run, 'player.downed'));
  } else if (scenario.startsWith('rescue')) {
    assert.equal(target.status, 'downed');
    assert.equal(helper.rescue.target, seat);
    assert.ok(Math.abs(run.time - helper.rescue.startedAt - 0.5) < 1e-9);
  } else {
    assert.equal(target.status, 'active');
    assert.ok(target.graceUntil > run.time);
    assert.equal(helper.rescue, null);
    assert.ok(
      run.events.some(
        (item) =>
          item.type === 'player.revived' && item.player === seat && item.reason === 'contact',
      ),
    );
  }
}

// Independently captured full-state hashes from exact cbd950ab real-core command
// replay. These catch a changed trace, seed, rules, timing or fabricated state;
// core709 is an intermediate waypoint checked semantically above.
const expected = {
  'first-connection': [
    ['initial', 0, '1983e348a7320fb71a77c43be7d1e6cf7ea523268b1663a8556127df626493b1'],
    ['cutting', 65, 'd980bd3b486795f30011065a4f2e355850754692ec8d4c0b0e7f408a72e9c399'],
    ['warning', 90, '887fafa0066cd6c2b11490138ad24281851d50bb3d033169c4034704def33c20'],
    ['charge', 234, '118dc797bf72d19ad65b92b42827addd99fb2fa54b39dd4f733382d4992826be'],
    ['capture', 414, 'e5d4bea4814429c1d047771ef99cbb3aeed86738eb8ad0e7601748f4105821b9'],
    ['victory', 1179, '354e9d07c4ebcfb5fd889310cf445dd814eb4b645d6f6405775ce700e5aba17c'],
  ],
  'relay-yard': [
    ['initial', 0, '7574881b6ad3392ee47cc466d7416c186e2dad83634496b4556683af14637e07'],
    ['cutting', 65, 'dbbfbb2ab8cff67cd2edafeb912f9d333de9bd895022fcc566372d1f29d0597b'],
    ['warning', 180, '5fc2be4395feebba172d1ef44fc803acfb56e66dfd69139473a2d78f58ed8a9f'],
    ['charge', 324, '06fe31a7ca3a5dc0904d713d3c700e799c0430bf3ffb26be418bea68f8446d72'],
    ['capture', 414, 'b7204d17dad51a1f9b99bf89b2eb090b7e013778770a754e4ecd1e4c61e31729'],
    ['anchors', 653, '71d76e6da82d7ef229921fec563f639c9c095ea734e49a2b815ac98bec6a8c46'],
    ['core', 709, null],
    ['victory', 832, 'a10cec4c1aff590a841bfe8a483d316012de1f4ce1e8354673d68477d7a88879'],
    ['downed-p1', 483, '98c720bef88cffbd510c2ce615cc3cf74668b4efa371072a5a1339c5223a8974'],
    ['rescue-p1', 560, '7c65834e898cc05cfd731c255fa117315e7fac20f4ba55a637ed5cef37b0d5ce'],
    ['recovered-p1', 620, 'e0be1c1987029bfb17838ea9a08d3e7685cd9019be2e202169b75cd8f405455e'],
    ['downed-p2', 483, '82d57dbc82955180aa2d2e3272c3c3418fcd3f85597e82ea13ed6628914b36ee'],
    ['rescue-p2', 560, 'e8c882d6c8d688b8dba88af66fe084fd4dd0d2892af2b4dfc9f675728bc177e6'],
    ['recovered-p2', 620, '7b2c015a7c59e63a10e10e90396a567b6c98208525d80e2056d98135f585a458'],
  ],
};
for (const [arena, cases] of Object.entries(expected)) {
  for (const [scenario, tick, stateHash] of cases) {
    test(`Team Studio ${arena} / ${scenario} is a command-earned Standard state`, () => {
      const before = [structuredClone(FIRST_CONNECTION), structuredClone(RELAY_YARD)];
      const fixture = createStudioTeamFixture({ arena, scenario });
      assert.equal(fixture.level.id, arena);
      assert.equal(fixture.level.revision, 2);
      assert.equal(fixture.run.tick, tick);
      assert.equal(fixture.run.difficulty, 'standard');
      assert.equal(fixture.scenario, scenario);
      assert.equal(
        fixture.label,
        TEAM_PREVIEW_SCENARIOS.find((item) => item.id === scenario).label,
      );
      assertScenario(fixture.run, scenario);
      if (stateHash) assert.equal(hash(fixture.run), stateHash);
      assert.deepEqual([FIRST_CONNECTION, RELAY_YARD], before);
      const original = structuredClone(fixture.run);
      const originalRef = fixture.run;
      fixture.advance(FIXED_DT);
      fixture.reset();
      assert.notEqual(fixture.run, originalRef);
      assert.deepEqual(fixture.run, original);
    });
  }
}

test('Team Studio rejects unknown arenas/scenarios and unavailable arena roles', () => {
  for (const arena of ['solo', '', null, 17, 'constructor', '__proto__', ['relay-yard']])
    assert.throws(() => createStudioTeamFixture({ arena }), /Unknown Team preview arena/);
  for (const scenario of ['patrol', '', null, 17, 'constructor'])
    assert.throws(() => createStudioTeamFixture({ scenario }), /Unknown Team preview scenario/);
  for (const scenario of TEAM_PREVIEW_SCENARIOS.map((item) => item.id)) {
    if (expected['first-connection'].some(([id]) => id === scenario)) continue;
    assert.throws(() => createStudioTeamFixture({ scenario }), /unavailable in first-connection/);
  }
  assert.equal(createStudioTeamFixture().run.level.id, 'first-connection');
  assert.equal(createStudioTeamFixture().scenario, 'initial');
  assert.ok(Object.isFrozen(TEAM_PREVIEW_SCENARIOS));
  assert.ok(TEAM_PREVIEW_SCENARIOS.every(Object.isFrozen));
});

test('Team Studio accumulates real fixed steps and drops excess frame backlog', () => {
  const fixture = createStudioTeamFixture();
  const reference = startCoop(createCoop(FIRST_CONNECTION, { difficulty: 'standard', seed: 17 }));
  const commands = [
    { direction: 'up', boost: true, support: false },
    { direction: 'up', boost: true, support: false },
  ];
  fixture.advance(FIXED_DT / 2);
  assert.equal(fixture.run.tick, 0);
  fixture.advance(FIXED_DT / 2);
  stepCoop(reference, commands, FIXED_DT);
  assert.deepEqual(fixture.run, reference);
  fixture.advance(600);
  for (let i = 0; i < 8; i++) stepCoop(reference, commands, FIXED_DT);
  assert.deepEqual(fixture.run, reference);
  const before = hash(fixture.run);
  for (const dt of [0, -1, NaN, Infinity, -Infinity, undefined, null, '1']) fixture.advance(dt);
  assert.equal(hash(fixture.run), before);
  fixture.advance(FIXED_DT);
  stepCoop(reference, commands, FIXED_DT);
  assert.deepEqual(fixture.run, reference, 'long frames must not leave a catch-up backlog');
});

for (const seat of [1, 2]) {
  test(`Team Studio can hold P${seat} rescue without clearing it, then finish through commands`, () => {
    const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario: `rescue-p${seat}` });
    const before = structuredClone(fixture.run);
    const heldRun = fixture.run;
    for (let frame = 0; frame < 120; frame++) {
      fixture.advance(0);
      assert.equal(fixture.run, heldRun);
    }
    assert.deepEqual(fixture.run, before, 'held preview must not call pauseCoop or change input');
    for (let tick = 0; tick < 60; tick++) fixture.advance(FIXED_DT);
    assert.equal(fixture.run.tick, 620);
    assertScenario(fixture.run, `recovered-p${seat}`);
    const completed = structuredClone(fixture.run);
    for (let tick = 0; tick < 59; tick++) fixture.advance(FIXED_DT);
    assert.deepEqual(fixture.run, completed, 'end hold must not change simulation time or state');
    fixture.advance(FIXED_DT);
    assert.deepEqual(fixture.run, before, 'loop restores the earned half-rescue snapshot exactly');
  });
}

test('Team Studio preview loops after at most three simulated seconds without hidden seek steps', () => {
  const fixture = createStudioTeamFixture({ scenario: 'cutting' });
  const selected = structuredClone(fixture.run);
  for (let frame = 0; frame < 45; frame++) fixture.advance(1);
  assert.equal(fixture.run.tick, selected.tick + 360);
  const end = structuredClone(fixture.run);
  for (let frame = 0; frame < 7; frame++) fixture.advance(1);
  assert.deepEqual(fixture.run, end);
  fixture.advance(1);
  assert.deepEqual(fixture.run, selected);
  fixture.advance(FIXED_DT);
  assert.equal(fixture.run.tick, selected.tick + 1);
});

test('Team Studio reset, independent instances and authored levels remain isolated', () => {
  const before = [structuredClone(FIRST_CONNECTION), structuredClone(RELAY_YARD)];
  const a = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'charge' });
  const b = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'charge' });
  const start = structuredClone(a.run);
  assert.notEqual(a.run, b.run);
  assert.notEqual(a.run.cells, b.run.cells);
  for (const dt of [0.001, 0.014, 0.1, 0.2, 0, 0.016, 999]) {
    a.advance(dt);
    b.advance(dt);
    assert.deepEqual(a.run, b.run);
  }
  a.reset();
  assert.deepEqual(a.run, start);
  assert.notDeepEqual(a.run, b.run);
  assert.ok(Object.isFrozen(a.level));
  assert.ok(Object.isFrozen(a.level.spawns[0]));
  assert.throws(() => {
    a.level.spawns[0].x = 999;
  }, TypeError);
  // Consumer mutation must not poison the private earned reset snapshot or
  // another preview. This is an isolation check, never a scenario constructor.
  a.run.players[0].x = -999;
  a.run.cells[0] = 255;
  a.reset();
  assert.deepEqual(a.run, start);
  assert.deepEqual([FIRST_CONNECTION, RELAY_YARD], before);
});
