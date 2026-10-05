// Authored regressions; automated suites remain waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  checkpointAuthoritativeRoom,
  restoreAuthoritativeRoomCheckpoint,
} from '../online/room-core.mjs';
import {
  ROOM_PROTOCOL,
  LEGACY_ROOM_PROTOCOL,
  roomControls,
  roomIdleControls,
  roomCaptureControls,
  roomTeamControls,
} from '../online/room-controls.mjs';
import {
  ROOM_EVENT_JOURNAL,
  createRoomEventCursor,
  projectRoomEvent,
} from '../online/room-events.mjs';
import { createRoomClientLifecycle } from '../online/room-client-lifecycle.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { captureRecipe } from '../ui/feedback-cues.mjs';

const captureLevel = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)))
  .levels[0];
const make = (family = 'capture', protocol = ROOM_PROTOCOL) =>
  createAuthoritativeRoom(
    {
      family,
      mode: 'versus',
      seed: 17,
      level: family === 'snake' ? CLASSIC_SNAKE_LEVELS[0].level : captureLevel,
    },
    { id: 'a'.repeat(32), contentHash: 'b'.repeat(64), protocol },
  );
const start = (room) => {
  joinAuthoritativeRoom(room, 0);
  readyAuthoritativeRoom(room, 0, 0);
  readyAuthoritativeRoom(room, 1, 0);
};
const send = (room, sequence, patch = {}) =>
  submitAuthoritativeInput(
    room,
    0,
    {
      ...roomIdleControls(),
      sequence,
      generation: room.generation,
      ...patch,
    },
    0,
  );

test('successor controls retain equipment and fresh steering without leaking native vocabularies', () => {
  const value = roomControls({
    ...roomIdleControls(),
    action: true,
    pickup: true,
    steer: true,
    support: true,
  });
  assert.deepEqual(roomCaptureControls(value), {
    direction: null,
    boost: false,
    action: true,
    pickup: true,
  });
  assert.deepEqual(roomTeamControls(value), {
    direction: null,
    boost: false,
    support: true,
    steer: true,
  });
  assert.deepEqual(roomControls(value, LEGACY_ROOM_PROTOCOL), {
    direction: null,
    boost: false,
    support: true,
  });
  assert.throws(() => roomControls({ ...value, action: 1 }));
});

test('native untimed Capture duel owns coverage, lives and score tie breaks only in v2', () => {
  for (const protocol of [LEGACY_ROOM_PROTOCOL, ROOM_PROTOCOL]) {
    const room = make('capture', protocol);
    start(room);
    for (const run of room.engine.runs) {
      run.status = 'lost';
      run.coverage = 0.3;
      run.lives = 0;
    }
    room.engine.runs[1].score = 999;
    stepAuthoritativeRoom(room, 0);
    assert.equal(room.result.winner, protocol === ROOM_PROTOCOL ? 'p2' : 'draw');
    assert.equal(!!room.engine.duel, protocol === ROOM_PROTOCOL);
  }
});

test('v2 equipment pulses are admitted once even when a release shares the same server tick', () => {
  const room = make();
  start(room);
  send(room, 1, { action: true, pickup: true, boost: true });
  send(room, 2, { action: false, pickup: false, boost: true });
  stepAuthoritativeRoom(room, 0);
  assert.equal(room.controls[0].action, false);
  assert.equal(room.controls[0].pickup, false);
  assert.equal(room.controls[0].boost, true);
  assert.equal(room.history[0].action, true);
  assert.equal(room.history[1].action, false);
  pauseAuthoritativeRoom(room);
  assert.deepEqual(room.controls[0], roomIdleControls());
});

test('held direction updates never duplicate a Snake turn; legacy interpretation stays available', () => {
  const room = make('snake');
  start(room);
  const snake = room.engine.runs[0].snakes[0];
  const direction = snake.direction === 'up' || snake.direction === 'down' ? 'left' : 'up';
  send(room, 1, { direction, steer: true });
  stepAuthoritativeRoom(room, 0);
  const turns = structuredClone(snake.turns);
  send(room, 2, { direction, boost: true });
  stepAuthoritativeRoom(room, 0);
  assert.deepEqual(snake.turns, turns);
  assert.equal(room.history[0].steer, true);
  assert.equal(room.history[1].steer, false);
});

test('v1 receipts/snapshots and v2 native checkpoint aliases retain their own interpretation', () => {
  for (const protocol of [LEGACY_ROOM_PROTOCOL, ROOM_PROTOCOL]) {
    const room = make('snake', protocol);
    start(room);
    const wire = snapshotAuthoritativeRoom(room);
    assert.equal(restoreTrustedRoomSnapshot(wire).protocol, protocol);
    assert.equal(
      wire.format,
      protocol === ROOM_PROTOCOL
        ? 'revealline-network-snapshot.v2'
        : 'revealline-network-snapshot.v1',
    );
    for (let i = 0; i < 6000 && room.status === 'playing'; i++) stepAuthoritativeRoom(room, 0);
    assert.equal(room.status, 'finished');
    assert.deepEqual(
      verifyAuthoritativeRoomResult(exportAuthoritativeRoomResult(room)),
      room.result,
    );
  }
  const room = make();
  start(room);
  const restored = restoreAuthoritativeRoomCheckpoint(checkpointAuthoritativeRoom(room), {
    engineVersion: room.engineVersion,
    contentHash: room.contentHash,
  });
  assert.strictEqual(restored.engine.runs, restored.engine.duel.runs);
});

const wire = (serials, generation = 1, last = serials.at(-1) ?? 0) => ({
  roomId: 'a',
  generation,
  presentation: {
    format: ROOM_EVENT_JOURNAL,
    first: serials[0] ?? last + 1,
    last,
    events: serials.map((serial) => ({
      serial,
      id: `event-${serial}`,
      board: 0,
      event: { type: 'target.caught' },
    })),
  },
});
test('accepted effect windows deduplicate retries and prime reconnect, lost windows and rematches silently', () => {
  const cursor = createRoomEventCursor();
  assert.equal(cursor.accept(wire([1, 2])).events.length, 0);
  assert.deepEqual(
    cursor.accept(wire([1, 2, 3])).events.map((e) => e.serial),
    [3],
  );
  assert.equal(cursor.accept(wire([1, 2, 3])).events.length, 0);
  assert.equal(cursor.accept(wire([8, 9])).gap, true);
  assert.deepEqual(
    cursor.accept(wire([8, 9, 10])).events.map((e) => e.serial),
    [10],
  );
  assert.equal(cursor.accept(wire([10, 11]), { silent: true }).events.length, 0);
  assert.equal(cursor.accept(wire([1], 2)).events.length, 0);
  assert.deepEqual(
    cursor.accept(wire([1, 2], 2)).events.map((e) => e.serial),
    [2],
  );
});
test('capture event projection preserves the audible capture tier without copying topology arrays', () => {
  const event = { type: 'cells.claimed', indices: Array.from({ length: 60 }, (_, i) => i) };
  const projected = projectRoomEvent(event),
    run = { cells: new Uint8Array(400), totalClaimable: 400 };
  assert.equal(projected.indices, undefined);
  assert.deepEqual(captureRecipe(projected, run), captureRecipe(event, run));
  assert.equal(
    projectRoomEvent({
      type: 'target.caught',
      target: { id: 'runner-1', kind: 'runner', x: 4, y: 5, route: Array(500).fill(2) },
    }).target.route,
    undefined,
  );
});
test('client serializes successor one-shot gestures rather than reducing them to movement holds', async () => {
  const calls = [],
    client = createRoomClientLifecycle({ sendInput: async (input) => calls.push(input) });
  client.own({ seat: 0 });
  client.accept(
    {
      status: 'playing',
      generation: 1,
      controlActivation: 'a',
      seats: [{ acknowledged: 0 }, { acknowledged: 0 }],
    },
    client.snapshot().epoch,
  );
  client.submit({
    ...roomIdleControls(),
    direction: 'left',
    action: true,
    pickup: true,
    steer: true,
  });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(calls.length, 1);
  for (const key of ['action', 'pickup', 'steer']) assert.equal(calls[0][key], true);
});

test('deep optional event details preserve JSON wire identity after projection', () => {
  const projected = projectRoomEvent({
    type: 'target.caught',
    target: { details: [{ nested: { more: true } }] },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(projected)), projected);
});
