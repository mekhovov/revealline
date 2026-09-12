import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, getSummary, RULESET } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  createDuel,
  stepDuel,
  pauseDuel,
  resumeDuel,
  neutralCommand,
  validateDuelPacket,
  DUEL_PROTOCOL,
} from '../multiplayer.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const oldLevel = (await json('../content/campaign.json')).levels[0];
const pack = await json('../content/packs/sentinel-relay.json');
const proof = await json('../replays/sentinel-routes.json');
const level = pack.campaigns[0].levels[0];
const routeFor = (policy, variant = 'ordinary') =>
  proof.routes.find(
    (route) =>
      route.turnPolicy === policy && route.variant === variant && route.classId === 'scout',
  );
const command = ({ direction, boost, action, pickup }) => ({ direction, boost, action, pickup });
const options = (route) => ({
  seed: route.seed,
  classId: route.classId,
  turnPolicy: route.turnPolicy,
  classRecipes: pack.classRecipes,
});
function feed(match, route, { from = 0, until = route.expected.tick, player = null } = {}) {
  let offset = 0;
  for (const segment of route.segments) {
    const end = offset + segment.ticks;
    for (let tick = Math.max(from, offset); tick < Math.min(until, end); tick++) {
      const input = command(segment.input);
      stepDuel(
        match,
        player === null
          ? [input, input]
          : [0, 1].map((seat) => (seat === player ? input : neutralCommand())),
      );
    }
    offset = end;
  }
  assert.equal(match.tick, until);
}

test('legacy duel keeps the exact previous object shape, ordering, defaults and run bytes', () => {
  const actual = createDuel(oldLevel);
  const expected = {
    protocol: 'xonix-duel.v1',
    ruleset: 'xonix-core.v2',
    runs: [createRun(oldLevel), createRun(oldLevel)],
    tick: 0,
    limitTicks: 90 * 120,
    status: 'ready',
    winner: null,
    reason: '',
  };
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
  assert.equal(actual.ruleset, RULESET);
  assert.ok(actual.runs.every((run) => !Object.hasOwn(run, 'encounter')));
  assert.notEqual(actual.runs[0], actual.runs[1]);
  assert.notEqual(actual.runs[0].cells, actual.runs[1].cells);
});

for (const policy of ['immediate', 'grid-center']) {
  for (const variant of ['ordinary', 'isolation', 'recovered'])
    test(`${policy}/${variant}: identical legal encounter routes draw at the exact proven core3 finish`, () => {
      const route = routeFor(policy, variant),
        match = createDuel(level, options(route));
      assert.equal(match.ruleset, 'xonix-core.v3');
      assert.ok(match.runs.every((run) => run.ruleset === match.ruleset));
      resumeDuel(match);
      feed(match, route);
      assert.equal(match.status, 'finished');
      assert.equal(match.winner, null);
      assert.equal(match.reason, 'First clear');
      for (const run of match.runs) {
        assert.equal(run.encounter.stage, 'defeated');
        assert.deepEqual(getSummary(run), route.expected);
        assert.deepEqual(authoritativeCheckpoint(run), route.checkpoint);
      }
      const terminal = JSON.stringify(match);
      stepDuel(match, [{ direction: 'right' }, { action: true }]);
      assert.equal(JSON.stringify(match), terminal);
    });

  test(`${policy}: pauses across every encounter stage freeze both clocks and retain the winning continuation`, () => {
    const route = routeFor(policy),
      match = createDuel(level, options(route));
    resumeDuel(match);
    const stops = route.phases
      .filter((phase) => phase.stage !== 'defeated' && phase.phase !== 'delay')
      .map((phase) => phase.tick);
    let from = 0;
    for (const until of stops) {
      feed(match, route, { from, until });
      const encounters = match.runs.map((run) => structuredClone(run.encounter));
      pauseDuel(match);
      const paused = JSON.stringify(match);
      for (let frame = 0; frame < 100; frame++)
        stepDuel(match, [
          { direction: 'right', action: true },
          { direction: 'up', boost: true },
        ]);
      assert.equal(JSON.stringify(match), paused);
      assert.deepEqual(
        match.runs.map((run) => run.encounter),
        encounters,
      );
      resumeDuel(match);
      assert.equal(match.status, 'running');
      assert.equal(match.tick, until);
      for (const run of match.runs) {
        assert.equal(run.player.speed, 0);
        assert.equal(run.player.queuedDirection, null);
        assert.deepEqual(run._input, { action: false, pickup: false, switchClass: null });
      }
      from = until;
    }
    feed(match, route, { from });
    assert.equal(match.winner, null);
    assert.deepEqual(match.runs.map(getSummary), [route.expected, route.expected]);
  });

  for (const player of [0, 1])
    test(`${policy}: player${player + 1}'s actual core release wins over an idle board`, () => {
      const route = routeFor(policy),
        match = createDuel(level, options(route));
      resumeDuel(match);
      feed(match, route, { player });
      assert.equal(match.winner, player);
      assert.equal(match.runs[player].encounter.defeated, true);
      assert.equal(match.runs[1 - player].encounter.defeated, false);
      assert.equal(match.runs[1 - player].coverage, 0);
      assert.deepEqual(getSummary(match.runs[player]), route.expected);
    });
}

test('future packet version gate uses the explicitly selected match and preserves omitted legacy context', () => {
  const context = { nextTick: 17, player: 1, matchId: 'test-match' };
  const packet = {
    protocol: DUEL_PROTOCOL,
    ruleset: RULESET,
    matchId: context.matchId,
    tick: 17,
    player: 1,
    input: neutralCommand(),
  };
  const encounter = createDuel(level);
  assert.equal(validateDuelPacket(packet, context), true);
  assert.equal(validateDuelPacket({ ...packet, ruleset: encounter.ruleset }, context), false);
  assert.equal(
    validateDuelPacket(
      { ...packet, ruleset: encounter.ruleset },
      { ...context, ruleset: encounter.ruleset },
    ),
    true,
  );
  assert.equal(validateDuelPacket(packet, { ...context, ruleset: encounter.ruleset }), false);
  assert.equal(validateDuelPacket(packet, { ...context, ruleset: RULESET }), true);
  for (const ruleset of ['xonix-core.v1', 'xonix-core.v4', 'xonix-level.v2', null, 3, {}, []])
    assert.equal(validateDuelPacket({ ...packet, ruleset }, { ...context, ruleset }), false);
});

test('core3 packet mismatch never bypasses match identity, order, player or data-only command gate', () => {
  const context = { nextTick: 10, player: 0, matchId: 'encounter-local', ruleset: 'xonix-core.v3' };
  const packet = {
    protocol: DUEL_PROTOCOL,
    ruleset: context.ruleset,
    matchId: context.matchId,
    tick: 10,
    player: 0,
    input: neutralCommand(),
  };
  for (const patch of [
    { protocol: 'xonix-duel.v2' },
    { ruleset: RULESET },
    { tick: 9 },
    { tick: 11 },
    { player: 1 },
    { matchId: 'other' },
    { encounter: { defeated: true } },
    { score: 100000 },
    { input: { ...packet.input, switchClass: 'impact' } },
    { input: { ...packet.input, direction: 'diagonal' } },
  ])
    assert.equal(validateDuelPacket({ ...packet, ...patch }, context), false);
  assert.equal(validateDuelPacket(packet, context), true);
});

test('invalid second encounter command is rejected before either core3 board advances', () => {
  const match = createDuel(level);
  resumeDuel(match);
  const before = JSON.stringify(match);
  assert.throws(
    () => stepDuel(match, [{ direction: 'right' }, { direction: 'diagonal' }]),
    /Invalid race command/,
  );
  assert.equal(JSON.stringify(match), before);
});
