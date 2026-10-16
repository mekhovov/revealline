import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { teamSupportPreviewNote } from '../../authoring/asset-studio/cross-mode-preview.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { buildCoopLevel, createCoopLevelRecipe, validateCoopPack } from '../coop/recipes.mjs';
import { COOP_RULESET } from '../coop/core.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import {
  createStudioTeamFixture,
  TEAM_PREVIEW_SCENARIOS,
  isTeamPreviewScenarioAvailable,
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
  support(run) {
    assert.equal(run.status, 'running');
    assert.equal(run.supportEffects.length, 2);
    assert.ok(run.supportEffects.every((effect) => effect.until > run.time));
    assert.ok(run.players.every((player) => player.support.uses === 1));
    assert.equal(
      run.enemies.filter((enemy) => enemy.speedScale < 1 && enemy.slowUntil > run.time).length,
      2,
    );
  },
  'emitter-warning'(run) {
    assert.equal(run.status, 'running');
    assert.equal(run.strongholds[0].emitter.phase, 'warning');
    assert.ok(run.strongholds[0].emitter.phaseUntil > run.time);
    assert.ok(
      run.players[run.strongholds[0].emitter.target].trail.some(
        (cell) => cell.index === run.strongholds[0].emitter.cellIndex,
      ),
    );
    assert.equal(run.impacts.length, 0);
  },
  'emitter-spark'(run) {
    assert.equal(run.status, 'running');
    assert.equal(run.strongholds[0].emitter.phase, 'cooldown');
    assert.equal(run.impacts.length, 1);
    assert.ok(run.impacts[0].progress > 0);
    assert.ok(
      run.players[run.impacts[0].player].trail.some(
        (cell) => cell.index === run.impacts[0].cellIndex,
      ),
    );
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
// replay, including the explicit historical `hybrid` support role introduced by
// 6bb6918e. These catch a changed trace, seed, rules, timing or fabricated state;
// core709 is an intermediate waypoint checked semantically above.
const expected = {
  'first-connection': [
    ['initial', 0, '4e7e01510bd5de0a22d6a68c26ca336000f7cded4f4f8ff15d66886b2499c7b6'],
    ['cutting', 65, '1eb67486c7d38de57ffd908140986d656c0fe0b00eec8c0048a011fe268b7904'],
    ['warning', 90, '91ffc47295aa740058a8baec92faf5bb23a6805088753ba9af42e946fd9da46d'],
    ['charge', 234, 'a9339757c03c879cdbaa22c4516619ca7ef4dba5e55e756ba9322fb840d22a84'],
    ['capture', 414, '918a2b717e397d40151a7e80dfa48398a6ff75ce56899655d6e39c463aa9dc53'],
    ['support', 211, null],
    ['victory', 1179, '4c04826fe4dd60ed803f243684f25dea3c3d0ef8ee3373f56cf638e6bc961642'],
  ],
  'relay-yard': [
    ['initial', 0, '85de0a167871d3650ac2793dd7d58d4b578fbcd1cab3e55f15d0686732c0e34b'],
    ['cutting', 65, 'c07bf72f78733399f18626a70d0fd40bb00a116aecfddc23c7acd5cac93d5050'],
    ['warning', 180, 'b9ddeaed23827a5a26a30f20deb5f26fbf436381a869ac4b5ab3eb54e1f789a9'],
    ['charge', 324, '01424754b8d9eaaa1940d7843663ccc2de67c6256babb8a177e7e18c00032358'],
    ['capture', 414, 'c52f9ed343a83ed6f248301d598e0bca551377102fc72e881d2c54fd40a38451'],
    ['support', 291, null],
    ['emitter-warning', 360, null],
    ['emitter-spark', 430, null],
    ['anchors', 653, 'c24a7c2b82821959c3055fa06469559151bc3503e554d7ed9d57a10219811007'],
    ['core', 709, null],
    ['victory', 832, '9e8bb4842a0e50dc2493ad12c2d8c62e3f44f4e38dbd765132a58706c6d18579'],
    ['downed-p1', 483, '909fab140d96746e599825510d7228be1ac31e41f9f9c5dfb5668bd004edd625'],
    ['rescue-p1', 560, '94c74c1fd5e45902801d30f91404bb6af107755f21f52a6ba3838520ce19874b'],
    ['recovered-p1', 620, '42a7dc2f31b6596cc3a9db6574814de26f223e07b5b97ff26a19a28fe524d780'],
    ['downed-p2', 483, 'b76c59972abdc7199f208667b922e3ea8b72d9bb54b49f35484dd58e602e15e5'],
    ['rescue-p2', 560, '2f679a5371c4ea213787ef2876e7709a8536f7ddd77b97c692b10a30eb05da1f'],
    ['recovered-p2', 620, '9b942b1a88917d5ab04ec190d6db33b0326a435b098ee368f7d940ea27598720'],
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
    if (
      scenario === 'hunter-recovery' ||
      scenario === 'team-recovery' ||
      expected['first-connection'].some(([id]) => id === scenario)
    )
      continue;
    assert.throws(() => createStudioTeamFixture({ scenario }), /unavailable in first-connection/);
  }
  assert.equal(createStudioTeamFixture().run.level.id, 'first-connection');
  assert.equal(createStudioTeamFixture().scenario, 'initial');
  assert.ok(Object.isFrozen(TEAM_PREVIEW_SCENARIOS));
  assert.ok(TEAM_PREVIEW_SCENARIOS.every(Object.isFrozen));
});

test('Team Studio scene labels switch locale without rebuilding fixture state', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const fixture = createStudioTeamFixture({ scenario: 'capture' });
  const run = fixture.run;
  setLocale('en', { persist: false });
  assert.equal(fixture.label, 'Joint capture');
  setLocale('uk', { persist: false });
  assert.equal(fixture.label, 'Спільне захоплення');
  assert.equal(fixture.run, run);
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
    for (let tick = 0; tick < 300; tick++) fixture.advance(FIXED_DT);
    assert.equal(fixture.run.tick, before.tick + 360);
    assert(fixture.run.players[seat - 1].graceUntil <= fixture.run.time);
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

for (const [level, travel] of [
  [FIRST_CONNECTION, 150],
  [RELAY_YARD, 230],
]) {
  test(`Support specimen ${level.id} equals independent public-command replay and expires on active time`, () => {
    const fixture = createStudioTeamFixture({ arena: level.id, scenario: 'support' });
    const reference = startCoop(createCoop(level, { difficulty: 'standard', seed: 17 }));
    const command = (direction, support = false) => ({ direction, boost: true, support });
    for (let tick = 0; tick < 60; tick++)
      stepCoop(reference, [command('up'), command('up')], FIXED_DT);
    for (let tick = 0; tick < travel; tick++)
      stepCoop(reference, [command('right'), command('left')], FIXED_DT);
    stepCoop(reference, [command('right', true), command('left', true)], FIXED_DT);
    assert.deepEqual(fixture.run, reference);
    const before = structuredClone(fixture.run);
    for (let frame = 0; frame < 60; frame++) fixture.advance(0);
    assert.deepEqual(fixture.run, before);
    for (let tick = 0; tick < 40; tick++) fixture.advance(FIXED_DT);
    assert.equal(fixture.run.supportEffects.length, 0);
    assert.ok(
      fixture.run.enemies.some(
        (enemy) => enemy.speedScale < 1 && enemy.slowUntil > fixture.run.time,
      ),
    );
    fixture.reset();
    assert.deepEqual(fixture.run, before);
  });
}

test('Support preview describes only live effects and never implies Scan or victory visibility', () => {
  const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'support' });
  assert.match(teamSupportPreviewNote(fixture.run), /^2 active Support pulses · 2 slowed enemies/);
  for (let tick = 0; tick < 40; tick++) fixture.advance(FIXED_DT);
  assert.match(teamSupportPreviewNote(fixture.run), /^0 active Support pulses · 2 slowed enemies/);
  assert.match(
    teamSupportPreviewNote(
      createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }).run,
    ),
    /hides Support effects/,
  );
});

test('Studio availability derives from the same arena scenarios as the real fixture', () => {
  for (const arena of ['first-connection', 'relay-yard']) {
    for (const { id } of TEAM_PREVIEW_SCENARIOS) {
      if (isTeamPreviewScenarioAvailable(arena, id))
        assert.doesNotThrow(() => createStudioTeamFixture({ arena, scenario: id }));
      else assert.throws(() => createStudioTeamFixture({ arena, scenario: id }), /unavailable/);
    }
    assert.equal(isTeamPreviewScenarioAvailable(arena, 'support'), true);
  }
  for (const value of ['constructor', '__proto__', null, 7]) {
    assert.equal(isTeamPreviewScenarioAvailable(value, 'initial'), false);
    assert.equal(isTeamPreviewScenarioAvailable('relay-yard', value), false);
  }
});

for (const [scenario, ticks] of [
  ['emitter-warning', 360],
  ['emitter-spark', 430],
])
  test(`Emitter ${scenario} matches independent public controls without altered state`, () => {
    const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario });
    const run = startCoop(createCoop(RELAY_YARD, { difficulty: 'standard', seed: 17 }));
    const c = (direction, support = false) => ({ direction, boost: true, support });
    for (let tick = 0; tick < ticks; tick++)
      stepCoop(
        run,
        tick < 60
          ? [c('up'), c('up')]
          : tick < 330
            ? [c('right', tick === 290), c('left', tick === 290)]
            : [c('up'), c('up')],
        FIXED_DT,
      );
    assert.deepEqual(fixture.run, run);
    const before = structuredClone(fixture.run);
    for (let i = 0; i < 30; i++) fixture.advance(0);
    assert.deepEqual(fixture.run, before);
    if (scenario === 'emitter-spark') {
      const start = fixture.run.impacts[0].x;
      for (let i = 0; i < 10; i++) fixture.advance(FIXED_DT);
      assert.ok(fixture.run.impacts[0].x > start);
      for (let i = 0; i < 20; i++) fixture.advance(FIXED_DT);
      assert.equal(fixture.run.impacts.length, 0);
    }
    fixture.reset();
    assert.deepEqual(fixture.run, before);
  });

test('every Team specimen is selectable from the shipped Studio scene control', async () => {
  const html = await readFile(
    new URL('../../authoring/asset-studio/index.html', import.meta.url),
    'utf8',
  );
  const select = html.match(/<select[^>]*id="preview-team-scenario"[\s\S]*?<\/select>/)?.[0];
  assert(select);
  const ids = [...select.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    ids,
    [...TEAM_PREVIEW_SCENARIOS].map((s) => s.id),
  );
});

test('secured specimen earns one core through public commands in a valid two-relay imported level', () => {
  const before = structuredClone(RELAY_YARD);
  const level = buildCoopLevel(
    createCoopLevelRecipe('stronghold', {
      id: 'studio-two-relays',
      name: 'Studio Two Relays',
      layout: {
        strongholds: [
          ...structuredClone(RELAY_YARD.strongholds),
          {
            id: 'studio-south-relay',
            core: { x: 35.5, y: 29.5 },
            anchors: [
              { x: 23.5, y: 25.5 },
              { x: 48.5, y: 25.5 },
            ],
          },
        ],
      },
    }),
  );
  const imported = JSON.parse(
    JSON.stringify({
      version: 'revealline-coop-pack.v1',
      ruleset: COOP_RULESET,
      id: 'studio-two-relays',
      revision: 1,
      name: 'Studio Two Relays',
      levels: [level],
    }),
  );
  assert.deepEqual(validateCoopPack(imported), { valid: true, errors: [] });
  assert.deepEqual(level.goal, { cores: ['yard-relay', 'studio-south-relay'] });
  assert.ok(level.strongholds.every((hold) => !('defeated' in hold) && !('shielded' in hold)));
  const reference = startCoop(createCoop(imported.levels[0], { difficulty: 'standard', seed: 17 }));
  // Independently replay the public trace; no fixture helper or state assignment.
  for (const [ticks, p1, p2, support = false] of [
    [60, 'up', 'up'],
    [230, 'right', 'left'],
    [1, 'right', 'left', true],
    [123, 'right', 'left'],
    [1, null, null],
    [123, 'left', 'right'],
    [115, 'up', 'up'],
    [1, null, null],
    [55, 'down', 'down'],
    [1, 'right', 'left', true],
    [122, 'right', 'left'],
  ])
    for (let tick = 0; tick < ticks; tick++)
      stepCoop(
        reference,
        [p1, p2].map((direction) => ({ direction, boost: direction !== null, support })),
        FIXED_DT,
      );
  const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'secured' });
  assert.equal(fixture.neutralBackdrop, true);
  assert.equal(fixture.level.id, 'studio-two-relays');
  assert.notEqual(fixture.level.id, RELAY_YARD.id);
  assert.deepEqual(fixture.level, level);
  assert.deepEqual(fixture.run, reference);
  assert.equal(fixture.run.tick, 832);
  assert.equal(fixture.run.status, 'running');
  const [secured, active] = fixture.run.strongholds;
  assert.equal(secured.defeated, true);
  assert.equal(secured.shielded, false);
  assert.ok(secured.anchors.every((anchor) => anchor.captured));
  assert.equal(active.defeated, false);
  assert.equal(active.shielded, true);
  assert.ok(active.anchors.every((anchor) => !anchor.captured));
  assert.ok(event(fixture.run, 'core.defeated'));
  assert.ok(!event(fixture.run, 'run.completed'));
  const selected = structuredClone(fixture.run);
  for (let tick = 0; tick < 30; tick++) fixture.advance(0);
  assert.deepEqual(fixture.run, selected);
  for (let tick = 0; tick < 360; tick++) {
    fixture.advance(FIXED_DT);
    stepCoop(
      reference,
      [0, 1].map(() => ({ direction: null, boost: false, support: false })),
      FIXED_DT,
    );
  }
  assert.deepEqual(fixture.run, reference);
  assert.equal(fixture.run.status, 'running');
  for (let tick = 0; tick < 60; tick++) fixture.advance(FIXED_DT);
  assert.deepEqual(fixture.run, selected, 'loop restores only the real earned snapshot');
  assert.deepEqual(RELAY_YARD, before);
  assert.equal(createStudioTeamFixture({ arena: 'relay-yard' }).neutralBackdrop, false);
});
