import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RULESET } from '../core/index.mjs';
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
const level = JSON.parse(fs.readFileSync(new URL('../content/campaign.json', import.meta.url)))
  .levels[0];
for (const turnPolicy of ['immediate', 'grid-center'])
  test(`identical simultaneous clears draw without iteration-order advantage: ${turnPolicy}`, () => {
    const match = createDuel(level, { turnPolicy });
    resumeDuel(match);
    for (let i = 0; i < 2000 && match.status === 'running'; i++)
      stepDuel(match, [{ direction: 'down' }, { direction: 'down' }]);
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert.equal(match.runs[0].status, 'won');
    assert.equal(match.runs[1].status, 'won');
    assert.equal(match.runs[0].tick, match.runs[1].tick);
  });
test('first clear wins and terminal match does not advance', () => {
  const match = createDuel(level);
  resumeDuel(match);
  for (let i = 0; i < 2000 && match.status === 'running'; i++)
    stepDuel(match, [neutralCommand(), { direction: 'down' }]);
  assert.equal(match.winner, 1);
  const before = match.tick;
  stepDuel(match, [{}, {}]);
  assert.equal(match.tick, before);
});
test('pause freezes both boards and resume releases input', () => {
  const match = createDuel(level);
  resumeDuel(match);
  stepDuel(match, [{ direction: 'down' }, { direction: 'left' }]);
  pauseDuel(match);
  const before = match.runs.map(authoritativeCheckpoint);
  const tick = match.tick;
  stepDuel(match, [{ direction: 'down' }, { direction: 'down' }]);
  assert.deepEqual(match.runs.map(authoritativeCheckpoint), before);
  assert.equal(match.tick, tick);
  resumeDuel(match);
  assert.equal(match.status, 'running');
  assert.equal(match.runs[0].player.speed, 0);
});
test('time limit ends tied idle boards fairly', () => {
  const match = createDuel(level, {}, { seconds: 10 });
  resumeDuel(match);
  for (let i = 0; i < 1200; i++) stepDuel(match, [{}, {}]);
  assert.equal(match.status, 'finished');
  assert.equal(match.winner, null);
  assert.match(match.reason, /Time/);
});
test('future transport boundary rejects duplicate/out-of-order input and injected game state', () => {
  const context = { nextTick: 17, player: 1, matchId: 'local-1' },
    packet = {
      protocol: DUEL_PROTOCOL,
      ruleset: RULESET,
      matchId: 'local-1',
      tick: 17,
      player: 1,
      input: neutralCommand(),
    };
  assert.equal(validateDuelPacket(packet, context), true);
  for (const patch of [
    { tick: 16 },
    { tick: 18 },
    { player: 0 },
    { ruleset: 'old' },
    { score: 1000 },
    { input: { ...packet.input, switchClass: 'foo' } },
  ])
    assert.equal(validateDuelPacket({ ...packet, ...patch }, context), false);
});

test('invalid second command leaves both boards untouched', () => {
  const match = createDuel(level);
  resumeDuel(match);
  const before = match.runs.map(authoritativeCheckpoint);
  assert.throws(
    () => stepDuel(match, [{ direction: 'down' }, { direction: 'diagonal' }]),
    /Invalid race/,
  );
  assert.deepEqual(match.runs.map(authoritativeCheckpoint), before);
  assert.equal(match.tick, 0);
});
