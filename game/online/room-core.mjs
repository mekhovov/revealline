import { canonicalJSON, dataIdentity, required } from '../data-json.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import { createCoop, startCoop, stepCoop, getCoopSummary } from '../coop/core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
} from '../snake/classic-match.mjs';

export const ROOM_PROTOCOL = 'revealline-room.v1';
export const NETWORK_SNAPSHOT = 'revealline-network-snapshot.v1';
export const ROOM_CHECKPOINT = 'revealline-room-checkpoint.v1';
const directions = ['up', 'right', 'down', 'left'];
const clone = (value) => structuredClone(value);
const command = (input) => {
  required(
    input &&
      (input.direction === null || directions.includes(input.direction)) &&
      typeof input.boost === 'boolean' &&
      typeof input.support === 'boolean',
    'Invalid room controls.',
  );
  return { direction: input.direction, boost: input.boost, support: input.support };
};
const idle = () => ({ direction: null, boost: false, support: false });

/** A full recursive wire format. Hash checkpoints are never used as snapshots. */
export function encodeNetworkState(value) {
  if (ArrayBuffer.isView(value))
    return { $typed: value.constructor.name, values: Array.from(value) };
  if (value instanceof Set) return { $set: [...value].map(encodeNetworkState) };
  if (value instanceof Map) return { $map: [...value].map(encodeNetworkState) };
  if (Array.isArray(value)) return value.map(encodeNetworkState);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encodeNetworkState(item)]),
    );
  return value;
}
export function decodeNetworkState(value) {
  if (Array.isArray(value)) return value.map(decodeNetworkState);
  if (value && typeof value === 'object') {
    const typed = {
      Uint8Array,
      Uint16Array,
      Uint32Array,
      Int8Array,
      Int16Array,
      Int32Array,
      Float32Array,
      Float64Array,
    };
    if (value.$typed) {
      required(
        Object.hasOwn(typed, value.$typed) &&
          Array.isArray(value.values) &&
          value.values.length <= 250000,
        'Invalid snapshot array.',
      );
      return new typed[value.$typed](value.values);
    }
    if (value.$set) return new Set(value.$set.map(decodeNetworkState));
    if (value.$map) return new Map(value.$map.map(decodeNetworkState));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, decodeNetworkState(item)]),
    );
  }
  return value;
}

function createEngine(recipe) {
  required(
    ['snake', 'capture'].includes(recipe.family) && ['versus', 'team'].includes(recipe.mode),
    'Unsupported online game format.',
  );
  if (recipe.family === 'snake') {
    const match = createClassicSnakeMatch(recipe.level, { mode: recipe.mode, seed: recipe.seed });
    return { kind: 'snake', match, runs: match.runs };
  }
  if (recipe.mode === 'team') {
    const run = createCoop(recipe.level, { seed: recipe.seed });
    startCoop(run);
    return { kind: 'team', runs: [run] };
  }
  return {
    kind: 'capture',
    runs: [
      createRun(recipe.level, { seed: recipe.seed }),
      createRun(recipe.level, { seed: recipe.seed }),
    ],
  };
}

/** Room ownership is server-only. Clients submit controls, never positions or results. */
export function createAuthoritativeRoom(
  recipe,
  { id, contentHash, engineVersion = ROOM_PROTOCOL, now = 0 } = {},
) {
  required(typeof id === 'string' && /^[a-f0-9]{32}$/.test(id), 'Invalid room identity.');
  required(
    typeof contentHash === 'string' && /^[a-f0-9]{64}$/.test(contentHash),
    'A full immutable content hash is required.',
  );
  required(
    Number.isSafeInteger(recipe.seed) && recipe.seed >= 0 && recipe.seed <= 0xffffffff,
    'Invalid room seed.',
  );
  return {
    protocol: ROOM_PROTOCOL,
    id,
    contentHash,
    engineVersion,
    recipe: clone(recipe),
    recipeIdentity: dataIdentity(recipe),
    engine: createEngine(recipe),
    status: 'waiting',
    generation: 1,
    tick: 0,
    activeMs: 0,
    createdAt: now,
    touchedAt: now,
    seats: [
      { joined: true, ready: false, lastSeen: now, acknowledged: 0 },
      { joined: false, ready: false, lastSeen: now, acknowledged: 0 },
    ],
    controls: [idle(), idle()],
    queue: [],
    history: [],
    result: null,
    eventSerial: 0,
    events: [],
    pauseReason: null,
  };
}
function event(room, kind, detail = {}) {
  const item = {
    id: `${room.id}:${room.generation}:${++room.eventSerial}`,
    tick: room.tick,
    kind,
    ...detail,
  };
  room.events.push(item);
  if (room.events.length > 128) room.events.shift();
}
export function joinAuthoritativeRoom(room, now) {
  required(room.status === 'waiting' && !room.seats[1].joined, 'This room already has two seats.');
  room.seats[1] = { joined: true, ready: false, lastSeen: now, acknowledged: 0 };
  room.touchedAt = now;
  event(room, 'joined', { seat: 1 });
}
export function touchAuthoritativeRoom(room, seat, now) {
  required(room.seats[seat]?.joined, 'Unknown player seat.');
  room.seats[seat].lastSeen = now;
  room.touchedAt = now;
}
export function pauseAuthoritativeRoom(room, reason = 'player') {
  if (room.status !== 'playing') return;
  room.status = 'paused';
  room.pauseReason = reason;
  room.seats.forEach((seat) => {
    seat.ready = false;
  });
  room.controls = [idle(), idle()];
  room.queue = [];
  room.history.push({
    tick: room.tick + 1,
    release: true,
    acknowledged: room.seats.map((seat) => seat.acknowledged),
  });
  event(room, 'paused', { reason });
}
export function readyAuthoritativeRoom(room, seat, now) {
  touchAuthoritativeRoom(room, seat, now);
  required(['waiting', 'paused'].includes(room.status), 'This room is not waiting for readiness.');
  room.seats[seat].ready = true;
  if (room.seats.every((player) => player.joined && player.ready && now - player.lastSeen < 5000)) {
    room.status = 'playing';
    room.pauseReason = null;
    event(room, 'started');
  }
}
export function submitAuthoritativeInput(room, seat, input, now) {
  touchAuthoritativeRoom(room, seat, now);
  required(
    Number.isSafeInteger(input.sequence) &&
      input.sequence > 0 &&
      input.sequence <= 1000000 &&
      input.generation === room.generation,
    'Invalid input sequence or rematch generation.',
  );
  const player = room.seats[seat];
  if (input.sequence <= player.acknowledged) return player.acknowledged;
  required(
    input.sequence <= player.acknowledged + 64,
    'Input sequence exceeds the acknowledgement window.',
  );
  required(
    room.status === 'playing' && room.queue.filter((item) => item.seat === seat).length < 8,
    'This room is paused or its input buffer is full.',
  );
  const accepted = command(input);
  player.acknowledged = input.sequence;
  room.queue.push({ seat, sequence: input.sequence, tick: room.tick + 1, ...accepted });
  return player.acknowledged;
}
function terminal(room) {
  if (room.engine.kind === 'snake') return room.engine.match.result;
  const runs = room.engine.runs;
  if (room.engine.kind === 'team') {
    return ['won', 'lost'].includes(runs[0].status)
      ? { outcome: runs[0].status, summaries: [getCoopSummary(runs[0])] }
      : null;
  }
  const won = runs.map((run) => run.status === 'won');
  if (won.some(Boolean))
    return {
      winner: won.every(Boolean) ? 'draw' : won[0] ? 'p1' : 'p2',
      reason: 'objective',
      summaries: runs.map(getSummary),
    };
  if (runs.every((run) => run.status === 'lost'))
    return {
      winner:
        runs[0].coverage === runs[1].coverage
          ? 'draw'
          : runs[0].coverage > runs[1].coverage
            ? 'p1'
            : 'p2',
      reason: 'coverage',
      summaries: runs.map(getSummary),
    };
  return null;
}
/** One server-owned fixed tick; the host never fast-forwards after a stall. */
export function stepAuthoritativeRoom(room, now) {
  if (['abandoned', 'finished'].includes(room.status)) return;
  const joined = room.seats.filter((seat) => seat.joined);
  if (joined.some((seat) => now - seat.lastSeen > 60000)) {
    room.status = 'abandoned';
    room.result = { outcome: 'abandoned' };
    event(room, 'abandoned');
    return;
  }
  if (joined.some((seat) => now - seat.lastSeen > 5000)) pauseAuthoritativeRoom(room, 'connection');
  if (room.status !== 'playing') return;
  room.tick++;
  room.activeMs = room.tick * FIXED_DT * 1000;
  for (const input of room.queue.splice(0)) {
    room.controls[input.seat] = command(input);
    room.history.push(input);
    if (room.engine.kind === 'snake' && input.direction)
      queueClassicSnakeMatchTurn(room.engine.match, input.seat, input.direction);
  }
  if (room.engine.kind === 'snake') advanceClassicSnakeMatchTo(room.engine.match, room.activeMs);
  else if (room.engine.kind === 'team') stepCoop(room.engine.runs[0], room.controls, FIXED_DT);
  else room.engine.runs.forEach((run, seat) => stepRun(run, room.controls[seat], FIXED_DT));
  const result = terminal(room);
  if (result || room.tick >= 216000 || room.history.length >= 32768) {
    room.status = 'finished';
    room.result = result ?? { outcome: 'draw', reason: 'room-limit' };
    event(room, 'finished', { result: room.result });
  }
}
export function rematchAuthoritativeRoom(room, seat, now) {
  touchAuthoritativeRoom(room, seat, now);
  required(room.status === 'finished', 'Finish this round before requesting a rematch.');
  room.seats[seat].rematch = true;
  if (!room.seats.every((player) => player.rematch)) return;
  room.generation++;
  room.engine = createEngine(room.recipe);
  room.status = 'waiting';
  room.tick = 0;
  room.activeMs = 0;
  room.controls = [idle(), idle()];
  room.queue = [];
  room.history = [];
  room.result = null;
  room.seats.forEach((player) => {
    player.ready = false;
    player.rematch = false;
    player.acknowledged = 0;
  });
  event(room, 'rematch');
}
export function abandonAuthoritativeRoom(room, seat, now) {
  touchAuthoritativeRoom(room, seat, now);
  if (room.status === 'finished' || room.status === 'abandoned') return;
  room.status = 'abandoned';
  room.result = { outcome: 'abandoned', reason: 'player-left' };
  room.queue = [];
  room.controls = [idle(), idle()];
  event(room, 'abandoned', { seat });
}
export function snapshotAuthoritativeRoom(room) {
  const state = encodeNetworkState({
    format: NETWORK_SNAPSHOT,
    protocol: ROOM_PROTOCOL,
    roomId: room.id,
    contentHash: room.contentHash,
    engineVersion: room.engineVersion,
    recipeIdentity: room.recipeIdentity,
    recipe: room.recipe,
    status: room.status,
    pauseReason: room.pauseReason,
    generation: room.generation,
    tick: room.tick,
    activeMs: room.activeMs,
    seats: room.seats,
    controls: room.controls,
    queue: room.queue,
    engine: room.engine,
    result: room.result,
    events: room.events,
  });
  return { ...state, stateIdentity: dataIdentity(state) };
}
export function restoreTrustedRoomSnapshot(snapshot) {
  const { stateIdentity, ...state } = snapshot;
  required(
    state.format === NETWORK_SNAPSHOT &&
      state.protocol === ROOM_PROTOCOL &&
      dataIdentity(state) === stateIdentity,
    'Network snapshot identity mismatch.',
  );
  // Only trusted service snapshots enter reconciliation. This does not grant progression ownership.
  return decodeNetworkState(state);
}

/** Server-storage boundary, distinct from public rendering snapshots. The host
 * must retain seat credentials separately and must never accept this from a player. */
export function checkpointAuthoritativeRoom(room) {
  const state = encodeNetworkState(room);
  return { format: ROOM_CHECKPOINT, state, stateIdentity: dataIdentity(state) };
}
export function restoreAuthoritativeRoomCheckpoint(
  checkpoint,
  { engineVersion, contentHash } = {},
) {
  required(
    checkpoint?.format === ROOM_CHECKPOINT &&
      dataIdentity(checkpoint.state) === checkpoint.stateIdentity,
    'Trusted room checkpoint identity mismatch.',
  );
  const room = decodeNetworkState(checkpoint.state);
  required(
    room.protocol === ROOM_PROTOCOL &&
      room.engineVersion === engineVersion &&
      room.contentHash === contentHash &&
      room.recipeIdentity === dataIdentity(room.recipe) &&
      Array.isArray(room.history) &&
      room.history.length <= 32768 &&
      Array.isArray(room.seats) &&
      room.seats.length === 2 &&
      Number.isSafeInteger(room.tick) &&
      room.tick >= 0 &&
      room.tick <= 216000,
    'Resolve the exact trusted room engine and content before recovery.',
  );
  // The wire representation duplicates references; restore this simulation alias.
  if (room.engine.kind === 'snake') room.engine.runs = room.engine.match.runs;
  return room;
}
export function exportAuthoritativeRoomResult(room) {
  required(room.status === 'finished', 'This room has no terminal result.');
  return {
    protocol: ROOM_PROTOCOL,
    recipe: clone(room.recipe),
    contentHash: room.contentHash,
    engineVersion: room.engineVersion,
    tick: room.tick,
    inputs: clone(room.history),
    result: clone(room.result),
    ...(room.engine.kind === 'snake' ? { replay: exportClassicSnakeMatch(room.engine.match) } : {}),
  };
}
export function verifyAuthoritativeRoomResult(
  receipt,
  { engineVersion = ROOM_PROTOCOL, contentHash } = {},
) {
  required(
    receipt.protocol === ROOM_PROTOCOL &&
      receipt.engineVersion === engineVersion &&
      (contentHash === undefined || receipt.contentHash === contentHash),
    'Resolve the exact server engine source before verifying this result.',
  );
  const room = createAuthoritativeRoom(receipt.recipe, {
    id: '0'.repeat(32),
    contentHash: receipt.contentHash,
    engineVersion,
  });
  joinAuthoritativeRoom(room, 0);
  readyAuthoritativeRoom(room, 0, 0);
  readyAuthoritativeRoom(room, 1, 0);
  required(
    Number.isSafeInteger(receipt.tick) &&
      receipt.tick >= 0 &&
      receipt.tick <= 216000 &&
      Array.isArray(receipt.inputs) &&
      receipt.inputs.length <= 32768,
    'Unbounded room result.',
  );
  let cursor = 0;
  while (room.tick < receipt.tick && room.status === 'playing') {
    while (receipt.inputs[cursor]?.tick === room.tick + 1) {
      const input = receipt.inputs[cursor++];
      if (input.release === true) {
        room.controls = [idle(), idle()];
        if (input.acknowledged !== undefined) {
          required(
            Array.isArray(input.acknowledged) &&
              input.acknowledged.length === 2 &&
              input.acknowledged.every(
                (sequence, seat) =>
                  Number.isSafeInteger(sequence) &&
                  sequence >= room.seats[seat].acknowledged &&
                  sequence <= 1000000,
              ),
            'Invalid pause acknowledgement.',
          );
          room.seats.forEach((seat, index) => {
            seat.acknowledged = input.acknowledged[index];
          });
        }
        room.history.push(clone(input));
      } else
        submitAuthoritativeInput(room, input.seat, { ...input, generation: room.generation }, 0);
    }
    stepAuthoritativeRoom(room, 0);
  }
  required(
    room.tick === receipt.tick &&
      cursor === receipt.inputs.length &&
      room.status === 'finished' &&
      canonicalJSON(room.result) === canonicalJSON(receipt.result),
    'Authoritative result did not reproduce.',
  );
  if (receipt.replay !== undefined)
    required(
      room.engine.kind === 'snake' &&
        canonicalJSON(exportClassicSnakeMatch(room.engine.match)) === canonicalJSON(receipt.replay),
      'Embedded Snake replay differs from the authoritative inputs.',
    );
  return clone(room.result);
}
