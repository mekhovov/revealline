import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  createAuthoritativeRoom,
  joinAuthoritativeRoom,
  readyAuthoritativeRoom,
  pauseAuthoritativeRoom,
  submitAuthoritativeInput,
  stepAuthoritativeRoom,
  snapshotAuthoritativeRoom,
  restoreTrustedRoomSnapshot,
  exportAuthoritativeRoomResult,
  verifyAuthoritativeRoomResult,
  encodeNetworkState,
  decodeNetworkState,
} from '../online/room-core.mjs';

const room = (mode = 'versus') =>
  createAuthoritativeRoom(
    { family: 'snake', mode, level: CLASSIC_SNAKE_LEVELS[0].level, seed: 17 },
    { id: 'a'.repeat(32), contentHash: 'b'.repeat(64) },
  );
const start = (value) => {
  joinAuthoritativeRoom(value, 0);
  readyAuthoritativeRoom(value, 0, 0);
  readyAuthoritativeRoom(value, 1, 0);
};

test('ready requires both seats and pause stops the entire native match clock', () => {
  const value = room();
  joinAuthoritativeRoom(value, 0);
  readyAuthoritativeRoom(value, 0, 0);
  stepAuthoritativeRoom(value, 100);
  assert.equal(value.tick, 0);
  readyAuthoritativeRoom(value, 1, 100);
  stepAuthoritativeRoom(value, 101);
  assert.equal(value.tick, 1);
  pauseAuthoritativeRoom(value);
  stepAuthoritativeRoom(value, 500);
  assert.equal(value.tick, 1);
  assert.equal(value.engine.match.elapsedMs, value.activeMs);
});
test('duplicate controls are acknowledged once and old rematch generations fail', () => {
  const value = room();
  start(value);
  const input = { sequence: 1, generation: 1, direction: 'down', boost: false, support: false };
  submitAuthoritativeInput(value, 0, input, 0);
  submitAuthoritativeInput(value, 0, input, 0);
  assert.equal(value.queue.length, 1);
  assert.throws(() => submitAuthoritativeInput(value, 0, { ...input, generation: 0 }, 0));
});
test('full snapshots retain target phases, RNG, bodies, queued controls and exact typed cells', () => {
  const value = room('team');
  start(value);
  submitAuthoritativeInput(
    value,
    1,
    { sequence: 1, generation: 1, direction: 'up', boost: false, support: false },
    0,
  );
  const restored = restoreTrustedRoomSnapshot(snapshotAuthoritativeRoom(value));
  assert.deepEqual(restored.queue, value.queue);
  assert.deepEqual(restored.engine.runs, value.engine.runs);
  const typed = new Uint8Array([0, 1, 2]);
  assert.deepEqual(decodeNetworkState(encodeNetworkState(typed)), typed);
  const damaged = snapshotAuthoritativeRoom(value);
  damaged.tick++;
  assert.throws(() => restoreTrustedRoomSnapshot(damaged));
});
test('a missing player pauses after five seconds and abandons after sixty', () => {
  const value = room();
  start(value);
  stepAuthoritativeRoom(value, 5001);
  assert.equal(value.status, 'paused');
  stepAuthoritativeRoom(value, 60001);
  assert.equal(value.status, 'abandoned');
});
test('server replay reproduces a simultaneous terminal duel, including shared pause releases', () => {
  const value = room();
  start(value);
  stepAuthoritativeRoom(value, 0);
  pauseAuthoritativeRoom(value);
  readyAuthoritativeRoom(value, 0, 0);
  readyAuthoritativeRoom(value, 1, 0);
  for (let i = 0; i < 6000 && value.status === 'playing'; i++) stepAuthoritativeRoom(value, 0);
  assert.equal(value.status, 'finished');
  const receipt = exportAuthoritativeRoomResult(value);
  assert.deepEqual(verifyAuthoritativeRoomResult(receipt), value.result);
  receipt.result = { winner: 'p1', reason: 'invented' };
  assert.throws(() => verifyAuthoritativeRoomResult(receipt));
});

test('pause receipts retain discarded acknowledgement numbers without replaying their controls', () => {
  const value = room();
  start(value);
  submitAuthoritativeInput(
    value,
    0,
    { sequence: 64, generation: 1, direction: 'down', boost: false, support: false },
    0,
  );
  pauseAuthoritativeRoom(value);
  readyAuthoritativeRoom(value, 0, 0);
  readyAuthoritativeRoom(value, 1, 0);
  submitAuthoritativeInput(
    value,
    0,
    { sequence: 128, generation: 1, direction: 'right', boost: false, support: false },
    0,
  );
  for (let tick = 0; tick < 6000 && value.status === 'playing'; tick++)
    stepAuthoritativeRoom(value, 0);
  assert.equal(value.status, 'finished');
  const receipt = exportAuthoritativeRoomResult(value);
  assert.deepEqual(verifyAuthoritativeRoomResult(receipt), value.result);
  receipt.tick++;
  assert.throws(() => verifyAuthoritativeRoomResult(receipt));
});

test('trusted server checkpoints retain history and alias the native match boards', async () => {
  const { checkpointAuthoritativeRoom, restoreAuthoritativeRoomCheckpoint } = await import(
    '../online/room-core.mjs'
  );
  const value = room('team');
  start(value);
  submitAuthoritativeInput(
    value,
    0,
    { sequence: 1, generation: 1, direction: 'down', boost: false, support: false },
    0,
  );
  const checkpoint = checkpointAuthoritativeRoom(value);
  const restored = restoreAuthoritativeRoomCheckpoint(checkpoint, {
    engineVersion: value.engineVersion,
    contentHash: value.contentHash,
  });
  assert.strictEqual(restored.engine.runs, restored.engine.match.runs);
  stepAuthoritativeRoom(value, 0);
  stepAuthoritativeRoom(restored, 0);
  assert.deepEqual(checkpointAuthoritativeRoom(restored), checkpointAuthoritativeRoom(value));
  assert.throws(() =>
    restoreAuthoritativeRoomCheckpoint(checkpoint, {
      engineVersion: 'other',
      contentHash: value.contentHash,
    }),
  );
});
