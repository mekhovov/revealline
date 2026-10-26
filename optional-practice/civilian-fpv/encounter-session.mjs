import {
  boundedJSON,
  dataIdentity,
  required,
  plainObject,
  exactKeys,
  canonicalJSON,
  stableId,
} from '../../game/data-json.mjs';
import {
  createEncounterRuntime,
  ENCOUNTER_FORMAT_V2,
  inspectEncounterRecovery,
  validateEncounterDefinition,
} from './encounter-runtime.mjs';
import { rotate, Q } from './math.mjs';
import {
  createAircraftArchiveStore,
  AIRCRAFT_ARCHIVE_PACKAGE_BYTES,
  AIRCRAFT_ARCHIVE_PAYLOAD_BYTES,
  AIRCRAFT_ARCHIVE_MAX_SEGMENTS,
} from './aircraft-archive.mjs';

const copy = (value) => structuredClone(value);
function archiveResumeBoundary(encounter, recording, session) {
  const state = copy(encounter.state);
  delete state.events; // Recovery restores event-free presentation, with identical gameplay.
  return dataIdentity({ state, recording, session });
}
const COMMANDS = ['reload', 'switchWeapon', 'payload', 'detonate', 'startNextWave'];
const mm = (value) =>
  Object.fromEntries(['x', 'y', 'z'].map((key) => [key, Math.round(value[key])]));
const player = (state) => ({
  position: mm(state.position),
  velocity: mm(state.velocity),
  radius: Math.ceil(state.aircraftRadiusMm ?? state.radius ?? 220),
  supportHeight: Math.round(
    state.aircraftSupportHeightMm ?? state.aircraftRadiusMm ?? state.radius ?? 220,
  ),
  crashed: ['destroyed', 'crashed', 'failed'].includes(state.status),
});

// Earlier v2 sessions represented reserved/temporarily absent encounter slots as
// caught actors in the physical checkpoint. Course checkpoints correctly reject
// that status outside Hunt. Migrate only slots whose independently validated
// encounter lifecycle proves they were absent; active actors are never repaired.
function canonicalCombatPhysical(source, encounterState) {
  const value = copy(source);
  const actors =
    value.format === 'FPVEncounterFlightCheckpoint.v1'
      ? value.state?.actors
      : value.format === 'AircraftCourseRecovery.v1'
        ? value.mission?.state?.actors
        : null;
  if (!Array.isArray(actors) || !Array.isArray(encounterState?.actors)) return value;
  const absent = new Set(
    encounterState.actors
      .filter((actor) => ['waiting', 'inactive'].includes(actor.status))
      .map((actor) => actor.slotId),
  );
  const migrate = actors.filter(
    (actor) =>
      absent.has(actor.id) &&
      actor.status === 'caught' &&
      Number.isSafeInteger(actor.health) &&
      Number.isSafeInteger(actor.maxHealth) &&
      actor.health > 0 &&
      actor.health <= actor.maxHealth,
  );
  if (!migrate.length) return value;
  if (value.format === 'AircraftCourseRecovery.v1') {
    const { checksum, ...packet } = value;
    required(checksum === dataIdentity(packet), 'Aircraft recovery checksum differs');
  }
  for (const actor of migrate) {
    actor.status = 'defeated';
    actor.health = 0;
  }
  if (value.format === 'AircraftCourseRecovery.v1') {
    const { checksum: _checksum, ...packet } = value;
    value.checksum = dataIdentity(packet);
  }
  return value;
}

function readRecovery(input) {
  required(plainObject(input), 'A combat recovery must be a plain object');
  const fields = Object.getOwnPropertyDescriptors(input);
  required(
    fields.gameplay &&
      Object.hasOwn(fields.gameplay, 'value') &&
      fields.checksum &&
      Object.hasOwn(fields.checksum, 'value'),
    'Invalid combat recovery fields',
  );
  const gameplay = boundedJSON(fields.gameplay.value, {
    maxBytes: 40 * 1024 * 1024,
    maxNodes: 3500000,
    maxArray: 786432,
    maxDepth: 48,
    maxString: 12 * 1024 * 1024,
  });
  exactKeys(
    gameplay,
    [
      'format',
      'identity',
      'encounter',
      'physical',
      'recording',
      ...(gameplay.format === 'FPVCombatRecovery.v2' ? ['session'] : []),
    ],
    'Combat recovery',
  );
  required(
    typeof fields.checksum.value === 'string' && fields.checksum.value === dataIdentity(gameplay),
    'Combat recovery checksum differs',
  );
  // Cosmetic data has its own budget and is never trusted as gameplay state.
  let presentation = null;
  try {
    if (fields.presentation && Object.hasOwn(fields.presentation, 'value'))
      presentation = boundedJSON(fields.presentation.value, {
        maxBytes: 8 * 1024 * 1024,
        maxNodes: 1000000,
        maxArray: 4096,
        maxDepth: 24,
        maxString: 4096,
      });
  } catch {
    /* Reconstruct settled remains from the valid defeat ledger. */
  }
  return { gameplay, presentation };
}

function restoreRecording(saved, identity, ticks, encounter = null) {
  const v2 = identity.format === 'FPVEncounterSession.v2';
  exactKeys(
    saved,
    ['segments', 'frames', 'segmentStart', 'retainedFrom', 'previousHash'],
    'Encounter recording',
  );
  required(
    Array.isArray(saved.segments) &&
      saved.segments.length <= (v2 ? 12 : 3) &&
      Array.isArray(saved.frames) &&
      saved.frames.length < 3000,
    'Invalid encounter recording budget',
  );
  let lastCommandSeq = 0,
    combatTicks = 0;
  const validFrames = (frames) =>
    frames.every((frame) => {
      const structural =
        Array.isArray(frame) &&
        frame.length === (v2 ? 7 : 5) &&
        frame.every(
          (value, index) =>
            Number.isSafeInteger(value) &&
            (index === 4
              ? value >= 0 && value <= 255
              : index === 5
                ? value >= 0
                : index === 6
                  ? value >= 0 && value <= 2
                  : value >= -1000 && value <= 1000),
        );
      if (!structural || !v2) return structural;
      const bits = frame[4],
        sequence = frame[5],
        phase = frame[6],
        commands = bits & 126;
      if (
        bits > 127 ||
        (commands && commands & (commands - 1)) ||
        Boolean(commands) !== Boolean(sequence) ||
        (sequence && sequence <= lastCommandSeq) ||
        (phase !== 0 && (bits || sequence)) ||
        (phase === 2 && frame.slice(0, 4).some(Boolean))
      )
        return false;
      if (sequence) lastCommandSeq = sequence;
      if (phase !== 1) combatTicks++;
      return true;
    });
  required(
    Number.isSafeInteger(saved.retainedFrom) &&
      saved.retainedFrom >= 0 &&
      saved.retainedFrom <= ticks,
    'Invalid retained recording interval',
  );
  let end = saved.retainedFrom,
    priorHash = null;
  for (const [index, segment] of saved.segments.entries()) {
    exactKeys(
      segment,
      ['format', 'identity', 'from', 'to', 'previousHash', 'frames', 'hash'],
      'Encounter segment',
    );
    const { hash, ...payload } = segment;
    required(
      segment.format === (v2 ? 'FPVEncounterSegment.v2' : 'FPVEncounterSegment.v1') &&
        dataIdentity(segment.identity) === dataIdentity(identity) &&
        dataIdentity(payload) === hash &&
        segment.from === end &&
        segment.to === end + 3000 &&
        Array.isArray(segment.frames) &&
        segment.frames.length === 3000 &&
        validFrames(segment.frames),
      'Invalid encounter segment',
    );
    required(
      index
        ? segment.previousHash === priorHash
        : saved.retainedFrom !== 0 || segment.previousHash === null,
      'Broken encounter recording chain',
    );
    end = segment.to;
    priorHash = hash;
  }
  required(
    saved.segmentStart === end &&
      end + saved.frames.length === ticks &&
      saved.previousHash === priorHash &&
      validFrames(saved.frames),
    'Incomplete encounter recording interval',
  );
  if (v2 && encounter)
    required(
      lastCommandSeq <= encounter.lastCommandSeq &&
        (saved.retainedFrom !== 0 ||
          (combatTicks === encounter.ticks && lastCommandSeq === encounter.lastCommandSeq)),
      'Encounter recording commands differ from accepted state',
    );
  return copy(saved);
}

/** One owner advances the companion only when its aircraft interval was accepted. */
export async function createEncounterSession(
  base,
  { definition, geometry, runtime = null, regional = false, runId },
) {
  const v2 = definition.format === ENCOUNTER_FORMAT_V2;
  const combat = runtime ?? createEncounterRuntime(definition, { geometry, runId });
  await base.configureEncounterActors(combat.snapshot().actors);
  let pending = null,
    saving = false,
    disposed = false,
    outsideArea = false,
    returning = false;
  let frames = [],
    segments = [],
    segmentStart = 0,
    retainedFrom = 0,
    previousHash = null;
  let sessionTicks = 0,
    nextCommandSeq = 1,
    commands = [],
    aftermathPaused = false,
    geometryWaiting = false,
    archiveGeneration = 0;
  const identity = Object.freeze({
    format: v2 ? 'FPVEncounterSession.v2' : 'FPVEncounterSession.v1',
    base: copy(base.identity),
    encounter: combat.identity,
  });
  const stateInside = (state) =>
    ['x', 'z'].every(
      (key) =>
        state.position[key] >= definition.bounds.min[key] &&
        state.position[key] <= definition.bounds.max[key],
    );
  function recordingStatus() {
    return {
      format: 'FPVEncounterRecordingStatus.v1',
      retainedFrom,
      retainedTo: v2 ? sessionTicks : summary().ticks,
      complete: retainedFrom === 0,
      practiceOnly: true,
    };
  }
  const summary = () => combat.summary?.() ?? combat.snapshot();
  const effectiveStatus = (flight, encounter) =>
    encounter.status !== 'active'
      ? encounter.status
      : encounter.phase === 'aftermath'
        ? aftermathPaused
          ? 'paused'
          : 'active'
        : flight.status;
  function snapshot(flight = base.snapshot(), encounter = combat.snapshot()) {
    const remaining = encounter.actors.filter((a) => a.type !== 'prop' && a.status !== 'defeated');
    const objective =
      definition.activity === 'strike'
        ? (encounter.actors.find((a) => a.type === 'vehicle') ??
          encounter.actors.filter((a) => a.type !== 'prop').at(-1))
        : definition.activity === 'survival'
          ? encounter.actors.find((a) => a.special === 'final' && a.status === 'active')
          : definition.activity === 'elimination'
            ? remaining.reduce((nearest, a) => {
                const d = (actor) =>
                  Math.hypot(
                    ...['x', 'y', 'z'].map((key) => actor.position[key] - flight.position[key]),
                  );
                return !nearest || d(a) < d(nearest) ? a : nearest;
              }, null)
            : null;
    return {
      ...flight,
      combat: true,
      unscored: true,
      health: encounter.health,
      actors: encounter.actors,
      projectiles: encounter.projectiles,
      events: encounter.events,
      kills: encounter.kills,
      shots: encounter.shots,
      hits: encounter.hits,
      score: encounter.score,
      status: effectiveStatus(flight, encounter),
      encounter: {
        ...encounter,
        outsideArea,
        returning,
        admittedCount: Math.min(definition.actors.length, definition.population),
        activity: definition.activity,
        difficulty: definition.difficulty,
        population: definition.population,
        ...(v2
          ? {
              servicePad: definition.servicePad ? copy(definition.servicePad) : null,
              geometryWaiting,
              objectiveTarget: objective
                ? {
                    id: objective.id,
                    position: copy(objective.position),
                    kind: definition.activity,
                    status: objective.status,
                    remaining: remaining.length,
                  }
                : null,
            }
          : {}),
      },
      combatRecording: recordingStatus(),
    };
  }
  function record(input, phase = 0, command = null) {
    frames.push([
      ...['roll', 'pitch', 'yaw', 'throttle'].map((key) =>
        Math.round(Math.max(-1, Math.min(1, input[key] ?? 0)) * 1000),
      ),
      ((input.actions ?? 0) & (v2 ? 1 : 255)) |
        (command?.reload ? 2 : 0) |
        (command?.switchWeapon === 0 ? 4 : command?.switchWeapon === 1 ? 8 : 0) |
        (command?.payload ? 16 : 0) |
        (command?.detonate ? 32 : 0) |
        (command?.startNextWave ? 64 : 0),
      ...(v2 ? [command?.commandSeq ?? 0, phase] : []),
    ]);
    sessionTicks++;
    if (frames.length < 3000) return;
    const segment = {
      format: v2 ? 'FPVEncounterSegment.v2' : 'FPVEncounterSegment.v1',
      identity,
      from: segmentStart,
      to: v2 ? sessionTicks : summary().ticks,
      previousHash,
      frames,
    };
    segment.hash = dataIdentity(segment);
    previousHash = segment.hash;
    segments.push(segment);
    frames = [];
    segmentStart = segment.to;
    if (segments.length > (v2 ? 12 : 3)) {
      segments.shift();
      retainedFrom = segments[0].from;
    }
  }
  function freezePresentation(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const item of Object.values(value)) freezePresentation(item);
      Object.freeze(value);
    }
    return value;
  }
  function frameSnapshot(
    flight = base.snapshot(),
    encounter = combat.frameSnapshot?.() ?? combat.snapshot(),
  ) {
    return freezePresentation(snapshot(flight, encounter));
  }
  function step(input, presentation = false, recordedPhase = null) {
    const view = presentation ? frameSnapshot : snapshot;
    const combatCommit =
      presentation && combat.commitFrame
        ? combat.commitFrame.bind(combat)
        : combat.commit.bind(combat);
    const combatCancel =
      presentation && combat.cancelFrame
        ? combat.cancelFrame.bind(combat)
        : combat.cancel.bind(combat);
    if (disposed || pending || saving) return view();
    const before = base.snapshot(),
      priorCombat = summary();
    if (effectiveStatus(before, priorCombat) !== 'active') return view(before);
    // v2 records the controls actually admitted by physics, including radios
    // whose raw values have more precision than the bounded recording format.
    if (v2)
      input = {
        ...input,
        ...Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [
            key,
            Math.round(
              Math.max(-1, Math.min(1, Number.isFinite(input[key]) ? input[key] : 0)) * 1000,
            ) / 1000,
          ]),
        ),
        actions: (input.actions ?? 0) & 1,
      };
    if (v2 && priorCombat.phase === 'aftermath') {
      const proposal = combat.prepare({ player: player(before), input: {} });
      if (proposal.rejected) {
        geometryWaiting = true;
        return view();
      }
      const result = combatCommit({
        transaction: proposal.transaction,
        accepted: true,
        player: player(before),
      });
      if (result.rejected) {
        geometryWaiting = true;
        return view();
      }
      geometryWaiting = false;
      record({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 }, 2);
      return view(before, result);
    }
    // A frozen encounter must not starve aircraft stepping or streaming. The
    // resident window may also temporarily omit part of the target area while
    // the aircraft is still inside it. Physics keeps its own terrain admission.
    const flightOnly = () => {
      const frozen = combat.snapshot().actors;
      base.stageEncounterActors({
        actors: frozen,
        motions: frozen.map((actor) => ({
          id: actor.slotId,
          from: actor.position,
          to: actor.position,
          enabled: actor.status === 'active',
        })),
      });
      const result = base.step({ ...input, actions: 0 });
      const finish = () => {
        const after = base.snapshot();
        if (v2 && after.ticks > before.ticks) record({ ...input, actions: 0 }, 1);
        outsideArea = !stateInside(after);
        if (!outsideArea) returning = false;
        return view(after);
      };
      if (result?.then) {
        pending = result.then(finish).finally(() => {
          pending = null;
        });
        return pending;
      }
      return finish();
    };
    // Phase 1 records regional flight-only accepted time. Replay must honor
    // that intent even when today's resident geometry is ready sooner.
    outsideArea = regional && !stateInside(before);
    if (outsideArea || recordedPhase === 1) {
      geometryWaiting = false;
      return flightOnly();
    }
    outsideArea = returning = false;
    const command = commands[0] ?? null;
    const proposal = combat.prepare({
      player: player(before),
      input: {
        fire: Boolean(input.actions & 1),
        nose: rotate(before.orientation, { x: 0, y: 0, z: -Q }),
        ...(v2
          ? {
              throttle: input.throttle ?? 0,
              muzzle: (() => {
                const offset = rotate(before.orientation, {
                  x: 0,
                  y: 0,
                  z: -(before.aircraftRadiusMm ?? before.radius ?? 220) - 40,
                });
                return mm({
                  x: before.position.x + offset.x,
                  y:
                    before.position.y +
                    (before.aircraftSupportHeightMm ?? before.aircraftRadiusMm ?? 220) +
                    offset.y,
                  z: before.position.z + offset.z,
                });
              })(),
            }
          : {}),
        ...(v2 && command ? command : {}),
      },
    });
    if (proposal.rejected) {
      geometryWaiting = true;
      // Recorded combat frames must retry admission rather than silently
      // becoming flight-only frames and changing the recorded combat clock.
      if (regional && recordedPhase === null) return flightOnly();
      return view();
    }
    geometryWaiting = false;
    try {
      base.stageEncounterActors(proposal);
    } catch (error) {
      combatCancel(proposal.transaction);
      throw error;
    }
    const finish = () => {
      let after = base.snapshot();
      const accepted = after.ticks > before.ticks;
      let committed = null;
      if (accepted) {
        const motion = base.encounterMotion?.() ?? {};
        if (motion.trace)
          motion.trace = motion.trace.map((point) => ({
            position: mm(point.position ?? point),
            ...(point.velocity ? { velocity: mm(point.velocity) } : {}),
          }));
        const result = combatCommit({
          transaction: proposal.transaction,
          accepted: true,
          player: player(after),
          ...motion,
        });
        if (result.rejected) {
          // Regional windows are held stable by the accepted aircraft interval.
          // A violation must stop the attempt instead of inventing contact data.
          geometryWaiting = true;
          base.pause();
          throw new Error(
            'Terrain changed during the accepted combat interval; restart this encounter.',
          );
        }
        committed = result;
        record(input, 0, command);
        if (command && commands[0] === command) commands.shift();
        if (result.status !== 'active') {
          base.pause();
          after = base.snapshot();
        }
        if (regional && !stateInside(after)) {
          outsideArea = true;
        }
      } else committed = combatCancel(proposal.transaction);
      return view(
        after,
        committed ?? (presentation ? combat.frameSnapshot?.() : null) ?? combat.snapshot(),
      );
    };
    try {
      const result = base.step(input);
      if (result?.then) {
        pending = result
          .then(finish)
          .catch((error) => {
            try {
              combatCancel(proposal.transaction);
            } catch {
              /* Commit already rejected it. */
            }
            throw error;
          })
          .finally(() => {
            pending = null;
          });
        return pending;
      }
      return finish();
    } catch (error) {
      try {
        combatCancel(proposal.transaction);
      } catch {
        /* Commit already rejected it. */
      }
      throw error;
    }
  }
  async function exportCombatRecovery(presentation = null) {
    aftermathPaused = true;
    base.pause();
    if (pending) await pending;
    const encounter = combat.checkpoint();
    const recording = copy({ segments, frames, segmentStart, retainedFrom, previousHash });
    const operation = base.encounterCheckpoint?.() ?? base.exportRecovery?.();
    saving = Boolean(operation?.then);
    try {
      const physical = saving ? await operation : operation;
      required(physical, 'This flight cannot save a combat session');
      const gameplay = {
        format: v2 ? 'FPVCombatRecovery.v2' : 'FPVCombatRecovery.v1',
        identity,
        encounter,
        physical,
        recording,
        ...(v2
          ? { session: { ticks: sessionTicks, nextCommandSeq, commands: copy(commands) } }
          : {}),
      };
      return copy({ gameplay, checksum: dataIdentity(gameplay), presentation });
    } finally {
      saving = false;
    }
  }
  async function restoreCombatRecovery(input) {
    const saved = readRecovery(input);
    required(
      saved.gameplay?.format === (v2 ? 'FPVCombatRecovery.v2' : 'FPVCombatRecovery.v1') &&
        dataIdentity(saved.gameplay.identity) === dataIdentity(identity),
      'Combat recovery belongs to different content or settings',
    );
    // Validate gameplay before touching the accepted aircraft boundary.
    const candidate = createEncounterRuntime(definition, {
      geometry,
      runId: summary().runId,
    });
    candidate.restore(saved.gameplay.encounter);
    if (v2) {
      const s = saved.gameplay.session;
      exactKeys(s, ['ticks', 'nextCommandSeq', 'commands'], 'Encounter session clock');
      required(
        Number.isSafeInteger(s.ticks) &&
          s.ticks >= candidate.snapshot().ticks &&
          Number.isSafeInteger(s.nextCommandSeq) &&
          s.nextCommandSeq > candidate.snapshot().lastCommandSeq &&
          Array.isArray(s.commands) &&
          s.commands.length <= 16,
        'Invalid encounter command queue',
      );
      let previous = candidate.snapshot().lastCommandSeq ?? 0;
      for (const command of s.commands) {
        exactKeys(
          command,
          ['commandSeq', ...COMMANDS.filter((key) => Object.hasOwn(command, key))],
          'Encounter command',
        );
        required(
          Number.isSafeInteger(command.commandSeq) &&
            command.commandSeq > previous &&
            command.commandSeq < s.nextCommandSeq &&
            Object.keys(command).length === 2 &&
            (Object.hasOwn(command, 'switchWeapon')
              ? [0, 1].includes(command.switchWeapon)
              : ['reload', 'payload', 'detonate', 'startNextWave'].some(
                  (key) => command[key] === true,
                )),
          'Invalid queued command',
        );
        previous = command.commandSeq;
      }
    }
    const history = restoreRecording(
      saved.gameplay.recording,
      identity,
      v2 ? saved.gameplay.session.ticks : candidate.snapshot().ticks,
      v2 ? candidate.snapshot() : null,
    );
    const restore = base.restoreEncounterCheckpoint ?? base.restoreRecovery;
    required(restore, 'This flight cannot restore a combat session');
    base.pause();
    await pending;
    await restore(
      v2
        ? canonicalCombatPhysical(saved.gameplay.physical, candidate.snapshot())
        : saved.gameplay.physical,
    );
    combat.restore(saved.gameplay.encounter);
    aftermathPaused = true;
    if (v2) ({ ticks: sessionTicks, nextCommandSeq, commands } = copy(saved.gameplay.session));
    ({ frames, segments, segmentStart, retainedFrom, previousHash } = history);
    archiveGeneration++;
    outsideArea = regional && !stateInside(base.snapshot());
    returning = false;
    return { state: snapshot(), presentation: saved.presentation ?? null };
  }
  return {
    ...base,
    identity,
    snapshot: () => snapshot(),
    frameSnapshot,
    step: (input) => step(input),
    stepFrame: (input) => step(input, true),
    async stepRecorded(frame) {
      required(
        v2 && Array.isArray(frame) && frame.length === 7 && frame.every(Number.isSafeInteger),
        'A v2 combat frame is required',
      );
      const [roll, pitch, yaw, throttle, bits, commandSeq, phase] = frame,
        commandBits = bits & 126;
      required(
        frame.slice(0, 4).every((n) => n >= -1000 && n <= 1000) &&
          bits >= 0 &&
          bits <= 127 &&
          phase >= 0 &&
          phase <= 2 &&
          (!commandBits || !(commandBits & (commandBits - 1))) &&
          Boolean(commandBits) === Boolean(commandSeq) &&
          (phase === 0 || (!bits && !commandSeq)) &&
          (phase !== 2 || frame.slice(0, 4).every((n) => n === 0)),
        'Invalid recorded combat frame',
      );
      required(
        !saving && !disposed && !pending && commands.length === 0,
        'Combat playback needs an idle accepted boundary',
      );
      const aftermath = summary().phase === 'aftermath';
      required(
        aftermath
          ? phase === 2
          : phase === 1
            ? regional
            : phase === 0 && (!regional || stateInside(base.snapshot())),
        'Recorded combat phase differs',
      );
      if (commandBits) {
        required(
          commandSeq > summary().lastCommandSeq,
          'Recorded combat command was already consumed',
        );
        const command =
          commandBits & 2
            ? { reload: true }
            : commandBits & 4
              ? { switchWeapon: 0 }
              : commandBits & 8
                ? { switchWeapon: 1 }
                : commandBits & 16
                  ? { payload: true }
                  : commandBits & 32
                    ? { detonate: true }
                    : { startNextWave: true };
        commands.push({ ...command, commandSeq });
        nextCommandSeq = Math.max(nextCommandSeq, commandSeq + 1);
      }
      returning = phase === 1;
      aftermathPaused = false;
      base.arm();
      const prior = sessionTicks;
      const result = await step(
        {
          roll: roll / 1000,
          pitch: pitch / 1000,
          yaw: yaw / 1000,
          throttle: throttle / 1000,
          actions: bits & 1,
        },
        false,
        phase,
      );
      if (sessionTicks === prior) {
        commands = [];
        return { accepted: false, state: result };
      }
      required(
        sessionTicks === prior + 1,
        'Combat replay advanced an unexpected number of intervals',
      );
      return { accepted: true, state: result };
    },
    queueCombatCommand(command) {
      if (
        !v2 ||
        saving ||
        disposed ||
        effectiveStatus(base.snapshot(), summary()) !== 'active' ||
        outsideArea ||
        commands.length >= 16
      )
        return false;
      const keys = Object.keys(command ?? {});
      if (
        keys.length !== 1 ||
        !COMMANDS.includes(keys[0]) ||
        (keys[0] === 'switchWeapon'
          ? ![0, 1].includes(command.switchWeapon)
          : command[keys[0]] !== true)
      )
        return false;
      commands.push({ ...command, commandSeq: nextCommandSeq++ });
      return true;
    },
    pause() {
      commands = [];
      aftermathPaused = true;
      base.pause();
    },
    readCombatSegment(afterIndex = -1, { metadata = true } = {}) {
      required(
        v2 && Number.isSafeInteger(afterIndex) && afterIndex >= -1,
        'Combat archive requires a v2 accepted recording',
      );
      const earliestIndex = segments.length ? segments[0].from / 3000 : segmentStart / 3000;
      const segment = segments.find((entry) => entry.from / 3000 > afterIndex);
      return {
        identity: copy(identity),
        generation: archiveGeneration,
        earliestIndex,
        latestTick: sessionTicks,
        gap: afterIndex + 1 < earliestIndex,
        segment: segment ? copy(segment) : null,
        ...(metadata
          ? {
              definition: copy(definition),
              runId: summary().runId,
              boundaryIdentity: archiveResumeBoundary(
                combat.checkpoint(),
                { segments, frames, segmentStart, retainedFrom, previousHash },
                { ticks: sessionTicks, nextCommandSeq, commands },
              ),
            }
          : {}),
      };
    },
    combatDefinition: () => copy(definition),
    combatDefeats: () =>
      combat.defeats?.() ?? combat.snapshot({ includeDefeats: true }).defeats ?? [],
    combatImpacts: () => combat.impacts?.() ?? [],
    nextWave() {
      if (v2) {
        if (
          summary().phase === 'intermission' &&
          !saving &&
          !disposed &&
          !outsideArea &&
          commands.length < 16
        )
          commands.push({ startNextWave: true, commandSeq: nextCommandSeq++ });
      } else combat.requestNextWave();
      return snapshot();
    },
    returnToEncounter() {
      returning = outsideArea;
      return snapshot();
    },
    encounterDestination: () => copy(definition.spawn),
    exportCombatRecovery,
    restoreCombatRecovery,
    combatCheckpointPending: () => saving,
    stepPending: () => Boolean(pending || base.stepPending?.()),
    arm() {
      if (!saving) {
        aftermathPaused = false;
        base.arm();
      }
    },
    async dispose() {
      disposed = true;
      base.pause();
      await pending?.catch(() => {});
      await base.dispose?.();
      geometry.dispose?.();
    },
  };
}

// Compare complete accepted dynamics (including the serialized physics world and
// contact/controller caches). Transport sequence gaps, pending unconsumed inputs,
// and recorder bookkeeping can differ after rejected steps or recovery; none can
// establish or invalidate a consumed flight trajectory.
function acceptedPhysicalBoundary(source, encounterState) {
  const value = canonicalCombatPhysical(source, encounterState);
  const simulation = (snapshot) => {
    const accepted = copy(snapshot);
    delete accepted.recording;
    delete accepted.recordingStatus;
    delete accepted.recorderLengths;
    delete accepted.hash;
    const checkpoint = accepted.checkpoint ?? accepted;
    delete checkpoint.pending;
    if (checkpoint.state) {
      for (const key of [
        'acceptedSequence',
        'acceptedTimestampUs',
        'consumedSequence',
        'inputBytes',
        'checkpointBytes',
      ])
        delete checkpoint.state[key];
    }
    return accepted;
  };
  if (value.format === 'AircraftCourseRecovery.v1') {
    delete value.sequence;
    delete value.checksum;
    value.physical = simulation(value.physical);
  } else if (['AdvancedRegionalRecovery.v1', 'AdvancedRegionalRecovery.v2'].includes(value.format))
    value.simulation = simulation(value.simulation);
  return value;
}

/** Replay accepted combat commands through the same admitted aircraft/encounter session.
 * The caller supplies the exact native or regional backend; checkpoint state is never
 * restored as a substitute for simulation. Truncated recordings cannot prove earlier play. */
export async function createEncounterPlayback(input, { createSession, signal } = {}) {
  const archive =
    input?.format === ENCOUNTER_ARCHIVE_FORMAT ? inspectEncounterArchive(input) : null;
  const { saved, definition } = archive
      ? { saved: archive.recovery, definition: archive.definition }
      : inspectEncounterRecovery(input),
    gameplay = saved.gameplay;
  required(
    definition.format === ENCOUNTER_FORMAT_V2 && gameplay.format === 'FPVCombatRecovery.v2',
    'Use the historical dispatcher for v1 combat recordings',
  );
  required(
    archive || gameplay.recording.retainedFrom === 0,
    'This recording no longer contains its beginning. Continue the saved session as local practice; complete replay verification is unavailable.',
  );
  required(typeof createSession === 'function', 'Combat playback needs its exact flight backend');
  const history = restoreRecording(
    gameplay.recording,
    gameplay.identity,
    gameplay.session.ticks,
    gameplay.encounter.state,
  );
  // Keep one bounded chunk view; do not duplicate an archive's complete frame chain.
  const chunks = archive
    ? [
        ...archive.packet.segments
          .filter((segment) => segment.record.kind === 'frames')
          .map((segment) => segment.record.segment.frames),
        history.frames,
      ]
    : [...history.segments.map((segment) => segment.frames), history.frames];
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let chunkIndex = 0,
    chunkOffset = 0;
  const currentFrame = () => {
    while (chunkIndex < chunks.length && chunkOffset >= chunks[chunkIndex].length) {
      chunkOffset = 0;
      chunkIndex++;
    }
    return chunks[chunkIndex]?.[chunkOffset];
  };
  const abort = () => {
    if (signal?.aborted) throw signal.reason ?? new Error('Combat playback cancelled');
  };
  abort();
  const session = await createSession({
    definition: copy(definition),
    runId: gameplay.encounter.state.runId,
    identity: copy(gameplay.identity),
  });
  let cursor = 0,
    disposed = false,
    verified = null,
    stepping = false;
  try {
    required(
      session?.stepRecorded &&
        session?.exportCombatRecovery &&
        dataIdentity(session.identity) === dataIdentity(gameplay.identity),
      'Combat playback backend identity differs',
    );
    required(
      session.snapshot().encounter?.ticks === 0 && session.snapshot().ticks === 0,
      'Combat playback must start from a fresh attempt',
    );
    abort();
  } catch (error) {
    await session?.dispose?.();
    throw error;
  }
  const cleanState = (source) => {
    const value = copy(source);
    delete value.events;
    return value;
  };
  return {
    session,
    snapshot: () => ({
      cursor,
      total: total,
      done: cursor === total,
      verified: verified !== null,
      state: session.snapshot(),
    }),
    async step() {
      required(!disposed && !stepping, 'Combat playback is unavailable or already advancing');
      abort();
      if (cursor === total) return { accepted: false, done: true, state: session.snapshot() };
      stepping = true;
      try {
        const result = await session.stepRecorded(currentFrame());
        abort();
        if (result.accepted) {
          cursor++;
          chunkOffset++;
        }
        return { ...result, done: cursor === total, cursor, total: total };
      } finally {
        stepping = false;
      }
    },
    async finish() {
      required(
        !disposed && !stepping && cursor === total,
        'Complete every recorded interval before verification',
      );
      abort();
      if (verified) return copy(verified);
      const replayed = await session.exportCombatRecovery();
      abort();
      required(
        dataIdentity(cleanState(replayed.gameplay.encounter.state)) ===
          dataIdentity(cleanState(gameplay.encounter.state)),
        'Combat replay does not reproduce its accepted final state',
      );
      required(
        dataIdentity(
          acceptedPhysicalBoundary(replayed.gameplay.physical, replayed.gameplay.encounter.state),
        ) === dataIdentity(acceptedPhysicalBoundary(gameplay.physical, gameplay.encounter.state)),
        'Combat replay does not reproduce its physical boundary',
      );
      verified = {
        format: 'FPVCombatReplayVerification.v2',
        verified: true,
        practiceOnly: true,
        physicalBoundary: 'accepted-dynamics-v1',
        identity: copy(gameplay.identity),
        definitionIdentity: gameplay.encounter.state.definitionIdentity,
        acceptedTicks: gameplay.encounter.state.ticks,
        sessionTicks: total,
        retainedFrom: 0,
        retainedTo: total,
        result: copy(gameplay.encounter.state.result),
      };
      return copy(verified);
    },
    async dispose() {
      disposed = true;
      await session.dispose();
    },
  };
}

export async function replayEncounterSession(
  input,
  {
    createSession,
    signal,
    yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
    onFrame,
  } = {},
) {
  const playback = await createEncounterPlayback(input, { createSession, signal });
  try {
    while (!playback.snapshot().done) {
      const result = await playback.step();
      required(
        result.accepted,
        'Recorded combat interval is not admitted by this terrain or flight backend',
      );
      await onFrame?.(result.state, result.cursor);
      if (result.cursor % 100 === 0) await yieldControl();
    }
    return await playback.finish();
  } finally {
    await playback.dispose();
  }
}

export const ENCOUNTER_ARCHIVE_FORMAT = 'FPVCombatArchivePackage.v1';
const ARCHIVE_MANIFEST = 'FPVCombatArchive.v1';
const ARCHIVE_SEGMENT = 'FPVCombatArchiveSegment.v1';
const archiveBytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const archiveInteger = (value, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const archiveBounds = {
  maxBytes: AIRCRAFT_ARCHIVE_PACKAGE_BYTES,
  maxNodes: 8000000,
  maxArray: 786432,
  maxDepth: 52,
  maxString: 12 * 1024 * 1024,
};
const archiveDigest = (value) => typeof value === 'string' && /^[a-f0-9]{16}$/.test(value);
function validateCombatArchiveManifest(input) {
  const value = boundedJSON(input, { ...archiveBounds, maxBytes: 528384 });
  exactKeys(
    value,
    [
      'format',
      'id',
      'host',
      'name',
      'createdAt',
      'revision',
      'identity',
      'config',
      'origin',
      'state',
      'firstIndex',
      'lastIndex',
      'startTick',
      'endTick',
      'segmentCount',
      'payloadBytes',
      'finalHash',
      'scored',
    ],
    'Combat archive manifest',
  );
  const config = value.config;
  exactKeys(config, ['identity', 'definition', 'runId'], 'Combat archive configuration');
  const definition = validateEncounterDefinition(config.definition);
  required(
    definition.format === ENCOUNTER_FORMAT_V2 &&
      config.identity?.format === 'FPVEncounterSession.v2' &&
      config.identity.encounter === dataIdentity(definition) &&
      typeof config.runId === 'string' &&
      config.runId.length > 0 &&
      config.runId.length <= 256,
    'Invalid combat archive configuration',
  );
  exactKeys(value.origin, ['kind', 'startTick'], 'Combat archive origin');
  required(
    value.format === ARCHIVE_MANIFEST &&
      stableId(value.id) &&
      value.host === 'combat' &&
      typeof value.name === 'string' &&
      value.name.length > 0 &&
      value.name.length <= 120 &&
      archiveInteger(value.createdAt) &&
      archiveInteger(value.revision) &&
      value.identity === dataIdentity(config.identity) &&
      archiveBytes(config) <= 512 * 1024 &&
      value.origin.kind === 'fresh' &&
      value.origin.startTick === 0 &&
      value.startTick === 0 &&
      archiveInteger(value.endTick) &&
      ['open', 'ended', 'interrupted', 'capacity', 'gap'].includes(value.state) &&
      value.scored === false &&
      archiveInteger(value.segmentCount, 0, AIRCRAFT_ARCHIVE_MAX_SEGMENTS) &&
      archiveInteger(value.payloadBytes, archiveBytes(config), AIRCRAFT_ARCHIVE_PAYLOAD_BYTES),
    'Invalid combat archive manifest',
  );
  required(
    value.segmentCount === 0
      ? value.firstIndex === null &&
          value.lastIndex === null &&
          value.finalHash === null &&
          value.endTick === 0 &&
          value.payloadBytes === archiveBytes(config)
      : value.firstIndex === 0 &&
          value.lastIndex === value.segmentCount - 1 &&
          archiveDigest(value.finalHash),
    'Combat archive range differs',
  );
  return value;
}
function emptyCombatArchive(spec) {
  return validateCombatArchiveManifest({
    format: ARCHIVE_MANIFEST,
    id: spec.id,
    host: 'combat',
    name: spec.name ?? 'Combat practice',
    createdAt: spec.createdAt ?? Date.now(),
    revision: 0,
    identity: spec.identity,
    config: spec.config,
    origin: { kind: 'fresh', startTick: 0 },
    state: 'open',
    firstIndex: null,
    lastIndex: null,
    startTick: 0,
    endTick: 0,
    segmentCount: 0,
    payloadBytes: archiveBytes(spec.config),
    finalHash: null,
    scored: false,
  });
}
function validateCombatArchiveSegment(input, manifest) {
  const item = boundedJSON(input, archiveBounds);
  exactKeys(
    item,
    ['format', 'index', 'startTick', 'endTick', 'initialHash', 'finalHash', 'previous', 'record'],
    'Combat archive segment',
  );
  const { finalHash, ...payload } = item;
  required(
    item.format === ARCHIVE_SEGMENT &&
      archiveInteger(item.index, 0, AIRCRAFT_ARCHIVE_MAX_SEGMENTS - 1) &&
      archiveInteger(item.startTick) &&
      archiveInteger(item.endTick, item.startTick) &&
      archiveDigest(item.initialHash) &&
      finalHash === dataIdentity(payload) &&
      (item.previous === null || archiveDigest(item.previous)),
    'Invalid combat archive segment',
  );
  if (item.record?.kind === 'frames') {
    exactKeys(item.record, ['kind', 'segment'], 'Combat archive frames');
    const segment = item.record.segment;
    required(
      item.startTick === segment.from && item.endTick === segment.to,
      'Combat archive frame range differs',
    );
    restoreRecording(
      {
        segments: [segment],
        frames: [],
        segmentStart: segment.to,
        retainedFrom: segment.from,
        previousHash: segment.hash,
      },
      manifest.config.identity,
      segment.to,
    );
  } else {
    exactKeys(item.record, ['kind', 'recovery'], 'Combat archive final boundary');
    required(item.record.kind === 'final', 'Unknown combat archive record');
    const { saved, definition } = inspectEncounterRecovery(item.record.recovery);
    required(
      dataIdentity(saved.gameplay.identity) === manifest.identity &&
        dataIdentity(definition) === manifest.config.identity.encounter &&
        saved.gameplay.encounter.state.runId === manifest.config.runId &&
        saved.gameplay.session.ticks === item.endTick &&
        saved.gameplay.recording.segmentStart === item.startTick,
      'Combat archive final boundary differs',
    );
    restoreRecording(
      saved.gameplay.recording,
      saved.gameplay.identity,
      saved.gameplay.session.ticks,
      saved.gameplay.encounter.state,
    );
    // Cosmetic records have their own recovery files; archives retain gameplay and launch hints.
    required(
      item.record.recovery.presentation === null,
      'Combat archives keep cosmetic records in separate recovery files',
    );
  }
  return item;
}
function extendCombatArchive(manifest, item, previous) {
  required(
    manifest.state === 'open' && (!previous || previous.record.kind !== 'final'),
    'Combat archive is closed',
  );
  required(
    item.index === manifest.segmentCount &&
      item.startTick === manifest.endTick &&
      item.initialHash === (previous?.finalHash ?? dataIdentity(manifest.config)) &&
      item.previous === (previous ? dataIdentity(previous) : null),
    'Missing or changed combat archive segment',
  );
  if (item.record.kind === 'frames') {
    const expected = previous?.record.segment?.hash ?? null;
    required(item.record.segment.previousHash === expected, 'Broken combat command chain');
  }
  const next = {
    ...manifest,
    revision: manifest.revision + 1,
    firstIndex: 0,
    lastIndex: item.index,
    endTick: item.endTick,
    segmentCount: manifest.segmentCount + 1,
    payloadBytes: manifest.payloadBytes + archiveBytes(item),
    finalHash: item.finalHash,
  };
  required(
    next.segmentCount <= AIRCRAFT_ARCHIVE_MAX_SEGMENTS &&
      next.payloadBytes <= AIRCRAFT_ARCHIVE_PAYLOAD_BYTES,
    'Combat archive capacity reached; flight and recent recording can continue',
  );
  return validateCombatArchiveManifest(next);
}
function validateCombatArchivePackage(input) {
  const value = boundedJSON(input, archiveBounds);
  exactKeys(value, ['format', 'manifest', 'segments'], 'Combat archive package');
  required(
    value.format === ENCOUNTER_ARCHIVE_FORMAT && Array.isArray(value.segments),
    'Unsupported combat archive package',
  );
  const manifest = validateCombatArchiveManifest(value.manifest);
  required(value.segments.length === manifest.segmentCount, 'Combat archive segment count differs');
  let reconstructed = emptyCombatArchive(manifest),
    previous = null,
    lastSequence = 0;
  for (const source of value.segments) {
    const segment = validateCombatArchiveSegment(source, manifest);
    reconstructed = extendCombatArchive(reconstructed, segment, previous);
    for (const frame of segment.record.kind === 'frames'
      ? segment.record.segment.frames
      : segment.record.recovery.gameplay.recording.frames) {
      if (frame[5]) {
        required(frame[5] > lastSequence, 'Combat archive command sequence repeats');
        lastSequence = frame[5];
      }
    }
    previous = segment;
  }
  for (const field of [
    'firstIndex',
    'lastIndex',
    'endTick',
    'segmentCount',
    'payloadBytes',
    'finalHash',
  ])
    required(
      reconstructed[field] === manifest[field],
      'Combat archive manifest differs from its chain',
    );
  if (previous?.record.kind === 'final') {
    const recovery = previous.record.recovery,
      history = recovery.gameplay.recording;
    for (const recent of history.segments) {
      const stored = value.segments[recent.from / 3000];
      required(
        stored?.record.kind === 'frames' &&
          canonicalJSON(stored.record.segment) === canonicalJSON(recent),
        'Combat archive differs from its retained recovery interval',
      );
    }
    required(
      lastSequence === recovery.gameplay.encounter.state.lastCommandSeq,
      'Combat archive commands differ from its final state',
    );
  }
  return value;
}
const combatArchiveCodec = {
  database: 'revealline.fpv.combat-archives.v1',
  format: ENCOUNTER_ARCHIVE_FORMAT,
  validateManifest: validateCombatArchiveManifest,
  validatePackage: validateCombatArchivePackage,
  validateSegment: validateCombatArchiveSegment,
  extend: extendCombatArchive,
  emptyManifest: emptyCombatArchive,
};
export const createEncounterArchiveStore = (options = {}) =>
  createAircraftArchiveStore({ ...options, codec: combatArchiveCodec });
export function inspectEncounterArchive(input) {
  const packet = validateCombatArchivePackage(input),
    tail = packet.segments.at(-1);
  required(
    tail?.record.kind === 'final' && packet.manifest.state === 'ended',
    'Combat archive has no complete saved ending',
  );
  const { saved: recovery, definition } = inspectEncounterRecovery(tail.record.recovery);
  return {
    recovery,
    definition,
    summary: {
      id: packet.manifest.id,
      name: packet.manifest.name,
      from: 0,
      to: packet.manifest.endTick,
      segments: packet.manifest.segmentCount,
      complete: true,
    },
    packet,
  };
}
function wrapCombatArchiveRecord(record, manifest, previous) {
  const payload = {
    format: ARCHIVE_SEGMENT,
    index: manifest.segmentCount,
    startTick: manifest.endTick,
    endTick: record.kind === 'frames' ? record.segment.to : record.recovery.gameplay.session.ticks,
    initialHash: previous?.finalHash ?? dataIdentity(manifest.config),
    previous: previous ? dataIdentity(previous) : null,
    record,
  };
  return { ...payload, finalHash: dataIdentity(payload) };
}
/** One background write retains sealed commands; quota, missed intervals and replacement
 * stop archival, never physics. Export pauses at a coherent boundary but keeps this feed open. */
export function createEncounterArchive({
  session,
  store: suppliedStore,
  indexedDB = globalThis.indexedDB,
  name = 'Combat practice',
  id = `combat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
  launch = null,
  resumeFrom = null,
} = {}) {
  required(
    session?.readCombatSegment && session?.exportCombatRecovery,
    'Combat archive needs an encounter session',
  );
  const initial = session.readCombatSegment(-1);
  let manifest = null,
    previous = null,
    afterIndex = -1,
    work = null,
    operation = null,
    queuedFinish = null,
    closed = false,
    closing = false,
    state = 'recording',
    error = null;
  const generation = initial.generation;
  const config = {
    identity: initial.identity,
    definition: initial.definition,
    runId: initial.runId,
  };
  let seed = resumeFrom ? inspectEncounterArchive(resumeFrom) : null;
  if (seed) {
    const source = seed.recovery.gameplay;
    required(
      canonicalJSON(seed.packet.manifest.config) === canonicalJSON(config) &&
        source.session.ticks === initial.latestTick &&
        archiveResumeBoundary(source.encounter, source.recording, source.session) ===
          initial.boundaryIdentity,
      'Combat archive continuation differs from its restored boundary',
    );
  }
  const hasSeed = Boolean(seed);
  let seedSegments = seed ? seed.packet.segments.slice(0, -1) : [],
    seedIndex = 0;
  // Keep only the validated sealed frame records, never the old final boundary.
  seed = resumeFrom = null;
  const store = suppliedStore ?? createEncounterArchiveStore({ indexedDB });
  const status = () => ({
    id,
    state,
    error,
    durableFrom: 0,
    durableTo: manifest?.endTick ?? 0,
    segments: manifest?.segmentCount ?? 0,
    bytes: manifest?.payloadBytes ?? 0,
    complete: state === 'ended',
    capacityBytes: AIRCRAFT_ARCHIVE_PACKAGE_BYTES,
  });
  async function failure(cause) {
    if (state === 'capacity' || state === 'gap') return status();
    error = String(cause?.message ?? cause).replace(/aircraft archive/gi, 'Combat archive');
    state = /capacity|full|quota/i.test(error)
      ? 'capacity'
      : /gap|missed|beginning|replaced/i.test(error)
        ? 'gap'
        : 'error';
    if (manifest?.state === 'open')
      try {
        manifest = await store.finish(
          id,
          {
            reason: state === 'capacity' ? 'capacity' : state === 'gap' ? 'gap' : 'interrupted',
            endTick: manifest.endTick,
            finalHash: manifest.finalHash,
          },
          { expectedRevision: manifest.revision },
        );
      } catch {}
    return status();
  }
  async function consume({ force = false } = {}) {
    if (
      !manifest &&
      !force &&
      session.readCombatSegment(afterIndex, { metadata: false }).latestTick === 0
    )
      return status();
    required(
      !initial.gap || hasSeed,
      'Combat archive missed its beginning; start a new attempt to retain a complete chain',
    );
    if (!manifest)
      manifest = await store.begin({
        id,
        host: 'combat',
        name,
        identity: dataIdentity(config.identity),
        config,
        origin: { kind: 'fresh', startTick: 0 },
      });
    for (let count = 0; count < (force ? AIRCRAFT_ARCHIVE_MAX_SEGMENTS + 13 : 13); count++) {
      if (closed) return status();
      const envelope = session.readCombatSegment(afterIndex, {
        metadata: false,
      });
      required(envelope.generation === generation, 'Combat archive session was replaced');
      const retained = seedSegments[seedIndex]?.record.segment;
      required(retained || !envelope.gap, 'A combat recording segment was missed');
      const segment = retained ?? envelope.segment;
      if (!segment) return status();
      const item = wrapCombatArchiveRecord({ kind: 'frames', segment }, manifest, previous);
      manifest = await store.append(id, item, {
        expectedRevision: manifest.revision,
      });
      previous = item;
      afterIndex = segment.from / 3000;
      if (retained) {
        seedSegments[seedIndex++] = null;
        if (seedIndex === seedSegments.length) {
          seedSegments = [];
          seedIndex = 0;
        }
      }
    }
    return status();
  }
  async function exportBoundary() {
    if (state === 'ended') return store.exportPackage(id);
    required(state === 'recording', 'Combat archive is unavailable');
    const saved = await session.exportCombatRecovery();
    if (work) await work;
    await consume({ force: true });
    required(state === 'recording', 'Combat archive stopped before its final boundary');
    const recovery = {
      ...saved,
      presentation: null,
      ...(launch ? { launch: copy(typeof launch === 'function' ? launch() : launch) } : {}),
    };
    const item = wrapCombatArchiveRecord({ kind: 'final', recovery }, manifest, previous);
    const ended = {
      ...extendCombatArchive(manifest, validateCombatArchiveSegment(item, manifest), previous),
      state: 'ended',
    };
    const packet = await store.exportPackage(id);
    return validateCombatArchivePackage({
      ...packet,
      manifest: ended,
      segments: [...packet.segments, item],
    });
  }
  function perform(kind) {
    const job = { kind, promise: null };
    operation = job;
    job.promise = Promise.resolve()
      .then(async () => {
        const packet = await exportBoundary();
        if (kind === 'finish' && state !== 'ended') {
          const item = packet.segments.at(-1);
          manifest = await store.append(id, item, { expectedRevision: manifest.revision });
          manifest = await store.finish(
            id,
            { reason: 'ended', endTick: manifest.endTick, finalHash: manifest.finalHash },
            { expectedRevision: manifest.revision },
          );
          state = 'ended';
        }
        return packet;
      })
      .catch(async (cause) => {
        await failure(cause);
        throw cause;
      })
      .finally(() => {
        if (operation === job) operation = null;
      });
    return job.promise;
  }
  const api = {
    snapshot: status,
    capture() {
      if (work) return work;
      if (closed || closing || operation || queuedFinish || state !== 'recording')
        return Promise.resolve(status());
      work = consume()
        .catch(failure)
        .finally(() => {
          work = null;
        });
      return work;
    },
    export() {
      if (queuedFinish) return queuedFinish;
      if (operation) return operation.promise;
      if (closed || closing) return Promise.reject(new Error('Combat archive is unavailable'));
      return perform('export');
    },
    finish() {
      if (queuedFinish) return queuedFinish;
      if (operation?.kind === 'finish') return operation.promise;
      if (closed || closing) return Promise.reject(new Error('Combat archive is unavailable'));
      if (!operation) return perform('finish');
      const prior = operation.promise;
      queuedFinish = prior
        .then(() => perform('finish'))
        .finally(() => {
          queuedFinish = null;
        });
      return queuedFinish;
    },
    async dispose() {
      if (closed) return;
      closing = true;
      await Promise.allSettled([work, operation?.promise, queuedFinish].filter(Boolean));
      closed = true;
      if (manifest?.state === 'open')
        try {
          manifest = await store.finish(
            id,
            { reason: 'interrupted', endTick: manifest.endTick, finalHash: manifest.finalHash },
            { expectedRevision: manifest.revision },
          );
        } catch {}
      if (!suppliedStore) store.close();
    },
  };
  return api;
}
