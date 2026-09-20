import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  createDuel,
  stepDuel,
  pauseDuel,
  resumeDuel,
  validateDuelPacket,
  neutralCommand,
  DUEL_PROTOCOL,
  UNTIMED_DUEL_PROTOCOL,
} from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const level = resolveMission(
  compileContentProject(createOpeningCandidates()),
  'first-return',
).level;
const untimed = { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 };

test('untimed races explicitly version the match while timed v1 rejects zero and remains the default', () => {
  const timed = createDuel(level);
  assert.equal(timed.protocol, DUEL_PROTOCOL);
  assert.equal(timed.limitTicks, 10800);
  const match = createDuel(level, {}, untimed);
  assert.equal(match.protocol, UNTIMED_DUEL_PROTOCOL);
  assert.equal(match.limitTicks, null);
  assert.deepEqual(
    match.runs.map(authoritativeCheckpoint),
    timed.runs.map(authoritativeCheckpoint),
  );
  for (const seconds of [0, -1, 9, 601, null, Infinity, 1.5])
    assert.throws(() => createDuel(level, {}, { seconds }), /duration/);
  for (const seconds of [undefined, null, 10, 90, Infinity, '0'])
    assert.throws(
      () => createDuel(level, {}, { protocol: UNTIMED_DUEL_PROTOCOL, seconds }),
      /zero/,
    );
  assert.throws(() => createDuel(level, {}, { protocol: 'unknown', seconds: 0 }), /protocol/);
});

test('idle untimed boards continue beyond the historical deadline and pause without losing continuation', () => {
  const match = createDuel(level, {}, untimed);
  resumeDuel(match);
  for (let tick = 0; tick < 10801; tick++) stepDuel(match, [{}, {}]);
  assert.equal(match.status, 'running');
  assert.equal(match.tick, 10801);
  assert(match.runs.every((run) => run.status === 'running' && run.lives === 3));
  pauseDuel(match);
  const before = match.runs.map(authoritativeCheckpoint);
  stepDuel(match, [{ direction: 'down' }, { direction: 'down' }]);
  assert.deepEqual(match.runs.map(authoritativeCheckpoint), before);
  resumeDuel(match);
  assert.equal(match.status, 'running');
  assert(match.runs.every((run) => run.player.speed === 0));
});

test('untimed simultaneous first clears retain exact timed-board checkpoints and replay verification', () => {
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const match = createDuel(level, options, untimed),
    timed = createDuel(level, options);
  const recorders = match.runs.map(() => createRecorder(level, options));
  resumeDuel(match);
  resumeDuel(timed);
  for (let tick = 0; tick < 1000 && match.status === 'running'; tick++) {
    const command = { direction: 'down' };
    for (const recorder of recorders) recordInput(recorder, command);
    stepDuel(match, [command, command]);
    stepDuel(timed, [command, command]);
  }
  assert.equal(match.status, 'finished');
  assert.equal(match.winner, null);
  assert.equal(match.reason, 'First clear');
  assert.deepEqual(
    match.runs.map(authoritativeCheckpoint),
    timed.runs.map(authoritativeCheckpoint),
  );
  for (let index = 0; index < 2; index++) {
    recordRelease(recorders[index]);
    assert.equal(verifyReplay(exportReplay(recorders[index], match.runs[index])).match, true);
  }
});

test('untimed first clear wins over an idle rival and finished matches cannot advance', () => {
  const match = createDuel(level, {}, untimed);
  resumeDuel(match);
  for (let tick = 0; tick < 1000 && match.status === 'running'; tick++)
    stepDuel(match, [{}, { direction: 'down' }]);
  assert.equal(match.winner, 1);
  assert.equal(match.reason, 'First clear');
  const before = match.runs.map(authoritativeCheckpoint),
    tick = match.tick;
  stepDuel(match, [{ direction: 'down' }, {}]);
  assert.deepEqual(match.runs.map(authoritativeCheckpoint), before);
  assert.equal(match.tick, tick);
});

test('untimed both-ended adjudication ranks coverage without reporting a timer expiry', () => {
  const match = createDuel(level, {}, untimed);
  resumeDuel(match);
  // This is an adjudication fixture, not claimed player input or route evidence.
  for (const run of match.runs) {
    run.status = 'lost';
    run.lives = 0;
  }
  match.runs[0].coverage = 0.1;
  match.runs[1].coverage = 0.2;
  stepDuel(match, [{}, {}]);
  assert.equal(match.status, 'finished');
  assert.equal(match.reason, 'Both flights ended');
  assert.equal(match.winner, 1);
});

test('untimed input packets require explicit matching protocol context and cannot cross into legacy matches', () => {
  const match = createDuel(level, {}, untimed);
  const context = {
    nextTick: 1,
    player: 0,
    matchId: 'untimed',
    ruleset: match.ruleset,
    protocol: match.protocol,
  };
  const packet = { ...context, tick: 1, input: neutralCommand() };
  delete packet.nextTick;
  assert.equal(validateDuelPacket(packet, context), true);
  const legacyContext = { ...context };
  delete legacyContext.protocol;
  assert.equal(validateDuelPacket(packet, legacyContext), false);
  assert.equal(validateDuelPacket({ ...packet, protocol: DUEL_PROTOCOL }, context), false);
  assert.equal(
    validateDuelPacket({ ...packet, protocol: 'other' }, { ...context, protocol: 'other' }),
    false,
  );
});
