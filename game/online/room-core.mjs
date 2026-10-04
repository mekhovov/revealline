import { canonicalJSON, dataIdentity, required } from '../data-json.mjs';
import { validateRoomContent, assertRoomRecipeBinding } from './room-content.mjs';
import { createRun, stepRun, getSummary, FIXED_DT } from '../core/index.mjs';
import {
  createCoop,
  startCoop,
  stepCoop,
  getCoopSummary,
  releaseCoopInputs,
} from '../coop/core.mjs';
import {
  createDuel,
  stepDuel,
  resumeDuel,
  releaseDuel,
  UNTIMED_DUEL_PROTOCOL,
} from '../multiplayer.mjs';
import {
  ROOM_PROTOCOL,
  LEGACY_ROOM_PROTOCOL,
  roomControls,
  roomIdleControls,
  roomCaptureControls,
  roomTeamControls,
} from './room-controls.mjs';
import { ROOM_EVENT_JOURNAL, ROOM_EVENT_LIMIT, projectRoomEvent } from './room-events.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
} from '../snake/classic-match.mjs';

export { ROOM_PROTOCOL, LEGACY_ROOM_PROTOCOL } from './room-controls.mjs';
export const NETWORK_SNAPSHOT = 'revealline-network-snapshot.v2';
export const ROOM_CHECKPOINT = 'revealline-room-checkpoint.v1';
const clone = (value) => structuredClone(value);
const idle = (protocol) => roomControls(roomIdleControls(), protocol);

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

function createEngine(recipe, protocol) {
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
  if (protocol === ROOM_PROTOCOL) {
    const duel = createDuel(
      recipe.level,
      { seed: recipe.seed },
      { seconds: 0, protocol: UNTIMED_DUEL_PROTOCOL },
    );
    resumeDuel(duel);
    return { kind: 'capture', duel, runs: duel.runs };
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
  { id, contentHash, protocol = ROOM_PROTOCOL, engineVersion = protocol, now = 0 } = {},
) {
  required([ROOM_PROTOCOL, LEGACY_ROOM_PROTOCOL].includes(protocol), 'Unknown room protocol.');
  required(typeof id === 'string' && /^[a-f0-9]{32}$/.test(id), 'Invalid room identity.');
  required(
    typeof contentHash === 'string' && /^[a-f0-9]{64}$/.test(contentHash),
    'A full immutable content hash is required.',
  );
  required(
    Number.isSafeInteger(recipe.seed) && recipe.seed >= 0 && recipe.seed <= 0xffffffff,
    'Invalid room seed.',
  );
  if (recipe.content !== undefined) validateRoomContent(recipe.content, recipe);
  return {
    protocol,
    id,
    contentHash,
    engineVersion,
    recipe: clone(recipe),
    recipeIdentity: dataIdentity(recipe),
    engine: createEngine(recipe, protocol),
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
    controls: [idle(protocol), idle(protocol)],
    queue: [],
    history: [],
    result: null,
    eventSerial: 0,
    events: [],
    ...(protocol === ROOM_PROTOCOL ? { presentationSerial: 0, presentationEvents: [] } : {}),
    pauseReason: null,
  };
}
function releaseRoomControls(room) {
  room.controls = [idle(room.protocol), idle(room.protocol)];
  if (room.protocol !== ROOM_PROTOCOL) return;
  if (room.engine.duel) releaseDuel(room.engine.duel);
  else if (room.engine.kind === 'team') releaseCoopInputs(room.engine.runs[0]);
}
function actors(run) {
  return run.targets ?? run.combatPatrols?.actors ?? run.classic?.combatPatrols?.actors ?? [];
}
function phaseOf(actor) {
  return actor.pursuit?.phase ?? actor.phase;
}
function journal(room, board, data) {
  room.presentationEvents.push({
    id: `${room.id}:${room.generation}:fx:${++room.presentationSerial}`,
    serial: room.presentationSerial,
    board,
    roomTick: room.tick,
    event: projectRoomEvent(data),
  });
  if (room.presentationEvents.length > ROOM_EVENT_LIMIT) room.presentationEvents.shift();
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
  releaseRoomControls(room);
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
  const accepted = roomControls(input, room.protocol);
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
  if (room.engine.duel) {
    const duel = room.engine.duel;
    return duel.status === 'finished'
      ? {
          winner: duel.winner === null ? 'draw' : `p${duel.winner + 1}`,
          reason: duel.reason,
          summaries: runs.map(getSummary),
        }
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
  const before =
    room.protocol === ROOM_PROTOCOL
      ? room.engine.runs.map((run) => ({
          tick: run.tick,
          phases: new Map(actors(run).map((actor) => [actor.id, phaseOf(actor)])),
          shutters: new Map((run.shutters ?? []).map((gate) => [gate.id, gate.closed])),
        }))
      : null;
  for (const input of room.queue.splice(0)) {
    const accepted = roomControls(input, room.protocol);
    if (room.protocol === ROOM_PROTOCOL)
      for (const key of ['action', 'pickup', 'steer'])
        accepted[key] ||= room.controls[input.seat][key];
    room.controls[input.seat] = accepted;
    room.history.push(input);
    if (
      room.engine.kind === 'snake' &&
      input.direction &&
      (room.protocol === LEGACY_ROOM_PROTOCOL || input.steer)
    )
      queueClassicSnakeMatchTurn(room.engine.match, input.seat, input.direction);
  }
  if (room.engine.kind === 'snake') advanceClassicSnakeMatchTo(room.engine.match, room.activeMs);
  else if (room.engine.kind === 'team')
    stepCoop(
      room.engine.runs[0],
      room.protocol === ROOM_PROTOCOL ? room.controls.map(roomTeamControls) : room.controls,
      FIXED_DT,
    );
  else if (room.engine.duel) stepDuel(room.engine.duel, room.controls.map(roomCaptureControls));
  else room.engine.runs.forEach((run, seat) => stepRun(run, room.controls[seat], FIXED_DT));
  if (before) {
    room.engine.runs.forEach((run, board) => {
      if (run.tick !== before[board].tick) {
        for (const accepted of run.events ?? []) journal(room, board, accepted);
        for (const gate of run.shutters ?? [])
          if (before[board].shutters.get(gate.id) !== gate.closed)
            journal(room, board, {
              type: 'shutter.changed',
              id: gate.id,
              tick: run.tick,
              closed: gate.closed,
              x: gate.cells[0]?.x,
              y: gate.cells[0]?.y,
            });
        for (const actor of actors(run)) {
          const phase = before[board].phases.get(actor.id);
          if (phase !== undefined && phase !== phaseOf(actor))
            journal(room, board, {
              type: 'actor.phase',
              tick: run.tick,
              id: actor.id,
              actorFamily: actor.actorFamily ?? actor.kind ?? actor.family,
              previous: phase,
              phase: phaseOf(actor),
              x: actor.x,
              y: actor.y,
            });
        }
      }
    });
    // Native one-shot actions never become network-held controls.
    room.controls.forEach((control) => {
      control.action = control.pickup = control.steer = false;
    });
  }
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
  room.engine = createEngine(room.recipe, room.protocol);
  room.status = 'waiting';
  room.tick = 0;
  room.activeMs = 0;
  room.controls = [idle(room.protocol), idle(room.protocol)];
  room.queue = [];
  room.history = [];
  room.result = null;
  if (room.protocol === ROOM_PROTOCOL) {
    room.presentationSerial = 0;
    room.presentationEvents = [];
  }
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
  releaseRoomControls(room);
  event(room, 'abandoned', { seat });
}
export function snapshotAuthoritativeRoom(room) {
  const state = encodeNetworkState({
    format: room.protocol === ROOM_PROTOCOL ? NETWORK_SNAPSHOT : 'revealline-network-snapshot.v1',
    protocol: room.protocol,
    roomId: room.id,
    contentHash: room.contentHash,
    engineVersion: room.engineVersion,
    ...(room.controlActivation
      ? {
          controlProtocol: room.controlProtocol,
          controlActivation: room.controlActivation,
        }
      : {}),
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
    ...(room.protocol === ROOM_PROTOCOL
      ? {
          presentation: {
            format: ROOM_EVENT_JOURNAL,
            first: room.presentationEvents[0]?.serial ?? room.presentationSerial + 1,
            last: room.presentationSerial,
            events: room.presentationEvents,
          },
        }
      : {}),
  });
  return { ...state, stateIdentity: dataIdentity(state) };
}
export function restoreTrustedRoomSnapshot(snapshot) {
  const { stateIdentity, ...state } = snapshot;
  required(
    ((state.format === NETWORK_SNAPSHOT && state.protocol === ROOM_PROTOCOL) ||
      (state.format === 'revealline-network-snapshot.v1' &&
        state.protocol === LEGACY_ROOM_PROTOCOL)) &&
      dataIdentity(state) === stateIdentity,
    'Network snapshot identity mismatch.',
  );
  required(
    state.recipeIdentity === dataIdentity(state.recipe),
    'Network recipe identity mismatch.',
  );
  if (state.recipe.content !== undefined) validateRoomContent(state.recipe.content, state.recipe);
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
    [ROOM_PROTOCOL, LEGACY_ROOM_PROTOCOL].includes(room.protocol) &&
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
  if (room.engine.duel) room.engine.runs = room.engine.duel.runs;
  return room;
}
export function exportAuthoritativeRoomResult(room) {
  required(room.status === 'finished', 'This room has no terminal result.');
  return {
    protocol: room.protocol,
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
  { engineVersion = receipt.protocol, contentHash, acceptedRecipe } = {},
) {
  if (receipt.recipe?.content !== undefined)
    required(
      acceptedRecipe && contentHash,
      'Resolve the trusted accepted room recipe before verifying imported provenance.',
    );
  if (acceptedRecipe)
    required(
      canonicalJSON(receipt.recipe) === canonicalJSON(acceptedRecipe),
      'The receipt does not contain the exact accepted room recipe.',
    );
  required(
    [ROOM_PROTOCOL, LEGACY_ROOM_PROTOCOL].includes(receipt.protocol) &&
      receipt.engineVersion === engineVersion &&
      (contentHash === undefined || receipt.contentHash === contentHash),
    'Resolve the exact server engine source before verifying this result.',
  );
  const room = createAuthoritativeRoom(receipt.recipe, {
    id: '0'.repeat(32),
    contentHash: receipt.contentHash,
    engineVersion,
    protocol: receipt.protocol,
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
        releaseRoomControls(room);
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

/** Provenance-aware boundary for a registry-resolved recipe. Verification proves
 * reproduction under those exact bytes, not a signed server result or reward. */
export async function verifyBoundAuthoritativeRoomResult(
  receipt,
  { acceptedRecipe, contentHash, engineVersion } = {},
) {
  required(
    acceptedRecipe && contentHash && engineVersion,
    'Resolve the trusted registry recipe, SHA256 and engine before verification.',
  );
  await assertRoomRecipeBinding(receipt.recipe, contentHash, acceptedRecipe);
  return verifyAuthoritativeRoomResult(receipt, { acceptedRecipe, contentHash, engineVersion });
}
