import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';

export const PRACTICE_FORMAT = 'revealline-civilian-practice.v1';
export const PRACTICE_MODEL = 'assisted-gym.v1';
export const PRACTICE_HZ = 20;
export const PRACTICE_CONTROLS = Object.freeze(['pitch', 'roll', 'yaw', 'throttle']);
export const neutralPracticeInput = () => ({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 1200;
function localized(value, fields) {
  exactKeys(value, ['en', 'uk'], 'practice locales');
  for (const locale of ['en', 'uk']) {
    exactKeys(value[locale], fields, `practice.${locale}`);
    required(
      fields.every((field) => text(value[locale][field])),
      'Complete bilingual practice copy required',
    );
  }
}
function position(value, world) {
  required(
    integer(value.x, 0, world.width) &&
      integer(value.z, 0, world.depth) &&
      integer(value.altitude, 0, world.ceiling),
    'Position outside bounded gym',
  );
}
export function validatePracticeCatalogue(input) {
  const value = boundedJSON(input, {
    maxBytes: 128 * 1024,
    maxNodes: 6000,
    maxArray: 64,
    maxDepth: 10,
    maxString: 1500,
  });
  exactKeys(
    value,
    ['format', 'id', 'revision', 'scenario', 'model', 'locales', 'world', 'drills'],
    'practice catalogue',
  );
  required(
    value.format === PRACTICE_FORMAT &&
      value.model === PRACTICE_MODEL &&
      value.scenario === 'civilian-gym' &&
      stableId(value.id) &&
      stableId(value.revision),
    'Unsupported civilian practice identity',
  );
  localized(value.locales, ['title', 'description']);
  exactKeys(value.world, ['width', 'depth', 'ceiling'], 'gym bounds');
  required(
    integer(value.world.width, 1000, 4000) &&
      integer(value.world.depth, 1000, 4000) &&
      integer(value.world.ceiling, 100, 500),
    'Invalid gym dimensions',
  );
  required(
    Array.isArray(value.drills) && value.drills.length > 0 && value.drills.length <= 24,
    'A practice catalogue contains 1–24 drills',
  );
  const ids = new Set();
  for (const drill of value.drills) {
    exactKeys(drill, ['id', 'revision', 'locales', 'spawn', 'checkpoints'], 'drill');
    required(
      stableId(drill.id) && stableId(drill.revision) && !ids.has(drill.id),
      'Unique drill identity required',
    );
    ids.add(drill.id);
    localized(drill.locales, ['title', 'brief', 'discovery']);
    exactKeys(drill.spawn, ['x', 'z', 'altitude', 'heading'], 'spawn');
    position(drill.spawn, value.world);
    required(
      drill.spawn.altitude === 0 && integer(drill.spawn.heading, 0, 359),
      'Drills start on the floor with a valid heading',
    );
    required(
      Array.isArray(drill.checkpoints) &&
        drill.checkpoints.length > 0 &&
        drill.checkpoints.length <= 32,
      'A drill contains 1–32 ordered checkpoints',
    );
    const checkpoints = new Set();
    for (const checkpoint of drill.checkpoints) {
      exactKeys(
        checkpoint,
        [
          'id',
          'x',
          'z',
          'altitude',
          'radius',
          'verticalTolerance',
          'heading',
          'headingTolerance',
          'holdTicks',
          'landed',
        ],
        'checkpoint',
      );
      required(
        stableId(checkpoint.id) && !checkpoints.has(checkpoint.id),
        'Unique checkpoint identity required',
      );
      checkpoints.add(checkpoint.id);
      position(checkpoint, value.world);
      required(
        integer(checkpoint.radius, 25, 250) &&
          integer(checkpoint.verticalTolerance, 5, 60) &&
          integer(checkpoint.holdTicks, 1, 100) &&
          integer(checkpoint.headingTolerance, 1, 45) &&
          (checkpoint.heading === null || integer(checkpoint.heading, 0, 359)) &&
          typeof checkpoint.landed === 'boolean',
        'Invalid checkpoint tolerance or hold',
      );
      required(
        !checkpoint.landed || checkpoint.altitude === 0,
        'Landing checkpoints must be on the floor',
      );
    }
  }
  return value;
}
export const exportPracticeCatalogue = (input) => canonicalJSON(validatePracticeCatalogue(input));
export function validatePracticeInput(input) {
  exactKeys(input, PRACTICE_CONTROLS, 'practice input');
  required(
    PRACTICE_CONTROLS.every(
      (key) =>
        typeof input[key] === 'number' && Number.isFinite(input[key]) && Math.abs(input[key]) <= 1,
    ),
    'Each practice axis must be finite and normalized',
  );
  return Object.fromEntries(
    PRACTICE_CONTROLS.map((key) => [key, Math.round(input[key] * 100) / 100 || 0]),
  );
}
export function createPractice(catalogue, drillId) {
  const source = validatePracticeCatalogue(catalogue);
  const drill = source.drills.find((item) => item.id === drillId);
  required(drill, 'Unknown practice drill');
  let state = {
    ...drill.spawn,
    ticks: 0,
    checkpoint: 0,
    holdTicks: 0,
    contacts: 0,
    status: 'ready',
  };
  const snapshot = () => ({
    ...state,
    total: drill.checkpoints.length,
    target: drill.checkpoints[state.checkpoint] ? { ...drill.checkpoints[state.checkpoint] } : null,
  });
  return {
    start() {
      if (state.status !== 'complete') state.status = 'active';
    },
    pause() {
      if (state.status === 'active') state.status = 'paused';
    },
    reset() {
      state = {
        ...drill.spawn,
        ticks: 0,
        checkpoint: 0,
        holdTicks: 0,
        contacts: 0,
        status: 'ready',
      };
    },
    snapshot,
    step(input) {
      const command = validatePracticeInput(input);
      if (state.status !== 'active') return snapshot();
      const heading = (state.heading + Math.round(command.yaw * 3) + 360) % 360;
      const angle = (heading * Math.PI) / 180;
      // Integer centimetres and fixed 20 Hz steps. Deliberately assisted:
      // commands select planar velocity / climb rate; neutral holds position.
      const x =
        state.x +
        Math.round((Math.sin(angle) * command.pitch + Math.cos(angle) * command.roll) * 8);
      const z =
        state.z +
        Math.round((-Math.cos(angle) * command.pitch + Math.sin(angle) * command.roll) * 8);
      const altitude = state.altitude + Math.round(command.throttle * 5);
      const world = source.world;
      const contact =
        x < 0 ||
        x > world.width ||
        z < 0 ||
        z > world.depth ||
        altitude < 0 ||
        altitude > world.ceiling;
      state = {
        ...state,
        heading,
        x: Math.max(0, Math.min(world.width, x)),
        z: Math.max(0, Math.min(world.depth, z)),
        altitude: Math.max(0, Math.min(world.ceiling, altitude)),
        ticks: state.ticks + 1,
        contacts: state.contacts + Number(contact),
      };
      const target = drill.checkpoints[state.checkpoint];
      const delta = Math.abs(state.heading - (target.heading ?? state.heading));
      const inside =
        Math.hypot(state.x - target.x, state.z - target.z) <= target.radius &&
        Math.abs(state.altitude - target.altitude) <= target.verticalTolerance &&
        Math.min(delta, 360 - delta) <= target.headingTolerance &&
        (!target.landed ||
          (state.altitude === 0 &&
            command.throttle <= 0 &&
            command.pitch === 0 &&
            command.roll === 0));
      state.holdTicks = inside ? state.holdTicks + 1 : 0;
      if (state.holdTicks >= target.holdTicks) {
        state.checkpoint++;
        state.holdTicks = 0;
        if (state.checkpoint === drill.checkpoints.length) state.status = 'complete';
      }
      return snapshot();
    },
    identity: dataIdentity(source),
    drill: () => structuredClone(drill),
    catalogue: () => validatePracticeCatalogue(source),
  };
}

/** Replay a bounded practice transcript. Claimed completion is never an input. */
export function replayPractice(catalogue, input) {
  const trace = boundedJSON(input, {
    maxBytes: 1024 * 1024,
    maxArray: 12000,
    maxNodes: 120000,
    maxDepth: 6,
  });
  exactKeys(trace, ['format', 'catalogueIdentity', 'drillId', 'commands'], 'practice transcript');
  required(
    trace.format === 'revealline-practice-transcript.v1' &&
      Array.isArray(trace.commands) &&
      trace.commands.length <= 12000,
    'Invalid practice transcript',
  );
  const model = createPractice(catalogue, trace.drillId);
  required(
    trace.catalogueIdentity === model.identity,
    'Practice transcript requires its exact catalogue',
  );
  model.start();
  let ticks = 0;
  for (const command of trace.commands) {
    exactKeys(command, ['ticks', 'input'], 'practice command');
    required(
      integer(command.ticks, 1, 200) && (ticks += command.ticks) <= 72000,
      'Practice transcript tick budget exceeded',
    );
    validatePracticeInput(command.input);
    required(
      model.snapshot().status !== 'complete',
      'Practice transcript continues after completion',
    );
    for (let index = 0; index < command.ticks; index++) {
      model.step(command.input);
      required(
        index === command.ticks - 1 || model.snapshot().status !== 'complete',
        'Practice transcript continues after completion',
      );
    }
  }
  return model.snapshot();
}
