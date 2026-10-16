import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import { createSnakeStudioPreview } from '../studio/snake-preview.mjs';
import {
  createAuthoritativeRoom,
  joinAuthoritativeRoom,
  readyAuthoritativeRoom,
  stepAuthoritativeRoom,
  rematchAuthoritativeRoom,
  snapshotAuthoritativeRoom,
  restoreTrustedRoomSnapshot,
  checkpointAuthoritativeRoom,
  restoreAuthoritativeRoomCheckpoint,
  exportAuthoritativeRoomResult,
  verifyAuthoritativeRoomResult,
} from '../online/room-core.mjs';
import { fixture } from './helpers/room-service-http-fixture.mjs';

const row = CLASSIC_SNAKE_V4_LEVELS.find((entry) => entry.id === 'classic-field-signal-check');
test('Studio admits local jammer drafts with an explicit repeatable preview seed', () => {
  const preview = createSnakeStudioPreview();
  for (const mode of ['solo', 'team', 'versus']) {
    const loaded = preview.load(row.level, { mode });
    assert.ok(loaded.match.boards.every((board) => board.hazardSeed === 17));
    preview.step();
    const first = preview.snapshot();
    preview.load(row.level, { mode });
    preview.step();
    assert.deepEqual(preview.snapshot(), first);
  }
  preview.dispose();
});

test('network checkpoints and receipts retain each accepted shared schedule while rematches replace it', () => {
  const recipe = { family: 'snake', mode: 'versus', level: row.level, seed: 17 };
  const room = createAuthoritativeRoom(recipe, {
    id: 'a'.repeat(32),
    contentHash: 'b'.repeat(64),
    hazardSeed: 101,
  });
  joinAuthoritativeRoom(room, 0);
  for (const hazardSeed of [101, 202]) {
    if (hazardSeed === 202) {
      rematchAuthoritativeRoom(room, 0, 0);
      assert.equal(room.status, 'finished');
      rematchAuthoritativeRoom(room, 1, 0, { hazardSeed });
    }
    readyAuthoritativeRoom(room, 0, 0);
    readyAuthoritativeRoom(room, 1, 0);
    for (let tick = 0; tick < 50; tick++) stepAuthoritativeRoom(room, 0);
    const restored = restoreAuthoritativeRoomCheckpoint(checkpointAuthoritativeRoom(room), {
      engineVersion: room.engineVersion,
      contentHash: room.contentHash,
    });
    assert.deepEqual(restored.engine.match, room.engine.match);
    const snapshot = restoreTrustedRoomSnapshot(snapshotAuthoritativeRoom(room));
    assert.ok(snapshot.engine.runs.every((run) => run.hazardSeed === hazardSeed));
    for (let tick = 0; tick < 1000 && room.status === 'playing'; tick++)
      stepAuthoritativeRoom(room, 0);
    assert.equal(room.status, 'finished');
    const receipt = exportAuthoritativeRoomResult(room);
    assert.equal(receipt.hazardSeed, hazardSeed);
    assert.deepEqual(verifyAuthoritativeRoomResult(receipt), room.result);
    assert.deepEqual(room.recipe, recipe);
    receipt.hazardSeed++;
    assert.throws(() => verifyAuthoritativeRoomResult(receipt), /Embedded Snake replay differs/);
  }
});

test('room service assigns the schedule once and keeps both seats synchronized', async (t) => {
  const h = await fixture(t, {
    entry: { ...row, id: 'variable-snake', family: 'snake', mode: 'versus' },
  });
  const initial = restoreTrustedRoomSnapshot(await h.snap());
  const seed = initial.engine.match.options.hazardSeed;
  assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff);
  assert.ok(initial.engine.runs.every((run) => run.hazardSeed === seed));
  const again = restoreTrustedRoomSnapshot(await h.snap());
  assert.equal(again.engine.match.options.hazardSeed, seed);
  await h.start();
  for (let step = 0; step < 42; step++) h.advance(100);
  const ended = await h.snap();
  assert.equal(ended.status, 'finished');
  const activation = ended.controlActivation;
  assert.equal((await h.api('/rematch', h.host, { activation })).status, 200);
  assert.equal((await h.snap()).generation, 1);
  assert.equal((await h.api('/rematch', h.guest, { activation })).status, 200);
  const next = restoreTrustedRoomSnapshot(await h.snap());
  assert.equal(next.generation, 2);
  assert.equal(next.status, 'waiting');
  // Fresh entropy can coincide, so validate ownership rather than a probabilistic inequality.
  assert.ok(Number.isInteger(next.engine.match.options.hazardSeed));
  assert.ok(
    next.engine.runs.every((run) => run.hazardSeed === next.engine.match.options.hazardSeed),
  );
  assert.deepEqual(next.recipe, initial.recipe);
});
