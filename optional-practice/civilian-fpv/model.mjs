import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import {
  DEFAULT_RESPONSE,
  FLIGHT_CONTROLS,
  responseCurve,
  responseIdentity,
  validateFlightResponse,
} from './radio-profile.mjs';
import { Q, attitude, clamp, integrateOrientation, isqrt, mul, roundDiv } from './math.mjs';
export const FLIGHT_MODEL = 'civilian-quad-fixed.v1';
export const FLIGHT_HZ = 50;
export const MAX_FLIGHT_TICKS = 50 * 60 * 12;
export const FLIGHT_MODES = Object.freeze(['self-level', 'acro']);
const int = (n, a, b) => Number.isSafeInteger(n) && n >= a && n <= b;
const vector = (v, min, max) => {
  exactKeys(v, ['x', 'y', 'z'], 'position');
  required(
    ['x', 'y', 'z'].every((key) => int(v[key], min, max)),
    'Position outside model bounds',
  );
};
export function validateFlightCourse(input) {
  const c = boundedJSON(input, { maxBytes: 65536, maxNodes: 5000, maxArray: 64, maxDepth: 10 });
  exactKeys(
    c,
    ['format', 'id', 'revision', 'environment', 'locales', 'spawn', 'bounds', 'obstacles', 'steps'],
    'flight course',
  );
  required(
    c.format === 'FlightCourse.v1' &&
      stableId(c.id) &&
      stableId(c.revision) &&
      ['gym', 'field'].includes(c.environment),
    'Unsupported flight course',
  );
  exactKeys(c.locales, ['en', 'uk'], 'course locales');
  for (const lang of ['en', 'uk']) {
    exactKeys(c.locales[lang], ['title', 'brief', 'lesson'], 'course text');
    required(
      ['title', 'brief', 'lesson'].every(
        (key) =>
          typeof c.locales[lang][key] === 'string' &&
          c.locales[lang][key].length > 0 &&
          c.locales[lang][key].length <= 2048,
      ),
      'Bilingual course text required',
    );
  }
  vector(c.spawn, -100000, 100000);
  required(c.spawn.y === 0, 'Flight starts grounded');
  exactKeys(c.bounds, ['min', 'max'], 'world bounds');
  vector(c.bounds.min, -100000, 100000);
  vector(c.bounds.max, -100000, 100000);
  required(
    c.bounds.min.y === 0 &&
      ['x', 'y', 'z'].every(
        (key) =>
          c.bounds.max[key] - c.bounds.min[key] >= 1000 &&
          c.spawn[key] >= c.bounds.min[key] &&
          c.spawn[key] <= c.bounds.max[key],
      ),
    'Invalid world bounds',
  );
  required(Array.isArray(c.obstacles) && c.obstacles.length <= 32, 'Too many obstacles');
  const box = (b) => {
    vector(b.min, -100000, 100000);
    vector(b.max, -100000, 100000);
    required(
      ['x', 'y', 'z'].every((key) => b.min[key] < b.max[key]),
      'Empty volume',
    );
  };
  const ids = new Set();
  for (const obstacle of c.obstacles) {
    exactKeys(obstacle, ['id', 'min', 'max'], 'obstacle');
    required(stableId(obstacle.id) && !ids.has(obstacle.id), 'Unique obstacle ids required');
    ids.add(obstacle.id);
    box(obstacle);
  }
  exactKeys(c.steps, FLIGHT_MODES, 'mode criteria');
  for (const mode of FLIGHT_MODES) {
    const steps = c.steps[mode];
    required(
      Array.isArray(steps) && steps.length >= 1 && steps.length <= 32,
      'Course needs ordered criteria',
    );
    for (const step of steps) {
      if (step.type === 'gate') {
        exactKeys(
          step,
          ['type', 'axis', 'at', 'direction', 'minSide', 'maxSide', 'minY', 'maxY'],
          'gate',
        );
        required(
          ['x', 'z'].includes(step.axis) &&
            [-1, 1].includes(step.direction) &&
            ['at', 'minSide', 'maxSide', 'minY', 'maxY'].every((key) =>
              int(step[key], -100000, 100000),
            ) &&
            step.minSide < step.maxSide &&
            step.minY >= 0 &&
            step.minY < step.maxY,
          'Invalid directional opening',
        );
      } else {
        exactKeys(
          step,
          ['type', 'min', 'max', 'ticks', 'maxSpeed', 'maxTilt', 'minTilt', 'centred', 'heading'],
          'hold',
        );
        required(['hold', 'land'].includes(step.type), 'Unknown course criterion');
        box(step);
        required(
          int(step.ticks, 1, 500) &&
            int(step.maxSpeed, 0, 30000) &&
            int(step.maxTilt, 0, 18000) &&
            int(step.minTilt, 0, step.maxTilt) &&
            typeof step.centred === 'boolean' &&
            (step.heading === null || int(step.heading, -18000, 18000)),
          'Invalid hold criteria',
        );
        required(step.type !== 'land' || step.min.y === 0, 'Landing volume must include ground');
      }
    }
  }
  return c;
}
export function quantizeFlightInput(input) {
  exactKeys(input, FLIGHT_CONTROLS, 'flight input');
  required(
    FLIGHT_CONTROLS.every(
      (key) =>
        Number.isFinite(input[key]) &&
        input[key] >= (key === 'throttle' ? 0 : -1) &&
        input[key] <= 1,
    ),
    'Invalid normalized flight input',
  );
  return Object.fromEntries(
    FLIGHT_CONTROLS.map((key) => [key, roundDiv(Math.round(input[key] * 1000000), 1000)]),
  );
}
function validateQuantized(input) {
  exactKeys(input, FLIGHT_CONTROLS, 'recorded controls');
  required(
    FLIGHT_CONTROLS.every((key) => int(input[key], key === 'throttle' ? 0 : -1000, 1000)),
    'Invalid recorded input',
  );
}
/** Strict approach side, inclusive destination plane/opening. Rational integer
 * intersection tests include crossings between steps and reject reverse travel. */
export function crossesGate(a, b, gate) {
  const axis = gate.axis,
    side = axis === 'x' ? 'z' : 'x',
    direction = gate.direction;
  if ((a[axis] - gate.at) * direction >= 0 || (b[axis] - gate.at) * direction < 0) return false;
  let den = b[axis] - a[axis],
    num = gate.at - a[axis];
  if (den < 0) {
    den = -den;
    num = -num;
  }
  return ['y', side].every((key) => {
    const n = a[key] * den + (b[key] - a[key]) * num,
      low = key === 'y' ? gate.minY : gate.minSide,
      high = key === 'y' ? gate.maxY : gate.maxSide;
    return n >= low * den && n <= high * den;
  });
}
/** Swept expanded box, stable x/y/z tie breaking. Parameter as integer millionths.
 * Conservative entry rounds toward the start; deterministic contact cannot tunnel. */
function sweepBox(a, b, box) {
  let entry = 0,
    exit = Q,
    hitAxis = 'x',
    sign = 0;
  for (const axis of ['x', 'y', 'z']) {
    const delta = b[axis] - a[axis],
      lo = box.min[axis] - 100,
      hi = box.max[axis] + 100;
    if (!delta) {
      if (a[axis] < lo || a[axis] > hi) return null;
      continue;
    }
    const lower = Math.floor(((lo - a[axis]) * Q) / delta),
      upper = Math.floor(((hi - a[axis]) * Q) / delta);
    const start = Math.min(lower, upper),
      end = Math.max(lower, upper);
    if (start > entry) {
      entry = start;
      hitAxis = axis;
      sign = delta > 0 ? -1 : 1;
    }
    exit = Math.min(exit, end);
    if (entry > exit) return null;
  }
  return entry >= 0 && entry <= Q && exit >= 0 ? { at: entry, axis: hitAxis, sign } : null;
}
export function createFlight({ course, mode = 'self-level', response = DEFAULT_RESPONSE }) {
  const source = validateFlightCourse(course),
    rates = validateFlightResponse(response);
  required(FLIGHT_MODES.includes(mode), 'Unsupported flight mode');
  const identity = {
    model: FLIGHT_MODEL,
    course: source.id,
    courseIdentity: dataIdentity(source),
    mode,
    responseIdentity: responseIdentity(rates),
  };
  let state;
  const reset = () => {
    state = {
      ticks: 0,
      status: 'disarmed',
      position: { ...source.spawn },
      velocity: { x: 0, y: 0, z: 0 },
      orientation: [0, 0, 0, Q],
      angular: { roll: 0, pitch: 0, yaw: 0 },
      step: 0,
      hold: 0,
      contacts: 0,
      landingSpeed: 0,
      landingTilt: 0,
      lastInput: { roll: 0, pitch: 0, yaw: 0, throttle: 0 },
      heightRange: { min: 0, max: 0 },
    };
  };
  reset();
  const snapshot = () => ({
    ...structuredClone(state),
    total: source.steps[mode].length,
    target: structuredClone(source.steps[mode][state.step] ?? null),
    attitude: attitude(state.orientation),
  });
  function step(input, { quantized = false } = {}) {
    const command = quantized ? input : quantizeFlightInput(input);
    validateQuantized(command);
    if (state.status !== 'active') return snapshot();
    if (state.ticks >= MAX_FLIGHT_TICKS) {
      state.status = 'expired';
      return snapshot();
    }
    const angles = attitude(state.orientation),
      shaped = Object.fromEntries(
        ['roll', 'pitch', 'yaw'].map((key) => [key, responseCurve(command[key], rates.expo)]),
      );
    for (const key of ['roll', 'pitch', 'yaw']) {
      const desired =
        mode === 'self-level' && key !== 'yaw'
          ? clamp(
              (roundDiv(shaped[key] * rates.maxTilt * 100, 1000) - angles[key]) * 4,
              -rates.maxRate * 100,
              rates.maxRate * 100,
            )
          : roundDiv(shaped[key] * rates.maxRate * 100, 1000);
      const difference = desired - state.angular[key];
      state.angular[key] += difference
        ? Math.sign(difference) * Math.max(1, Math.abs(roundDiv(difference, rates.responseTicks)))
        : 0;
    }
    state.orientation = integrateOrientation(state.orientation, state.angular, FLIGHT_HZ);
    const nextAttitude = attitude(state.orientation),
      thrust = roundDiv(command.throttle * 19620, 1000),
      before = { ...state.position },
      next = {};
    for (const axis of ['x', 'y', 'z']) {
      const acceleration = mul(nextAttitude.up[axis], thrust) - (axis === 'y' ? 9810 : 0);
      state.velocity[axis] = clamp(
        roundDiv(state.velocity[axis] * 995, 1000) + roundDiv(acceleration, FLIGHT_HZ),
        -30000,
        30000,
      );
      next[axis] = state.position[axis] + roundDiv(state.velocity[axis], FLIGHT_HZ);
    }
    const speed = isqrt(Object.values(state.velocity).reduce((n, v) => n + v * v, 0)),
      tilt = Math.max(Math.abs(nextAttitude.roll), Math.abs(nextAttitude.pitch));
    let collision = null;
    for (const obstacle of [...source.obstacles].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const hit = sweepBox(before, next, obstacle);
      if (hit && (!collision || hit.at < collision.at)) collision = hit;
    }
    if (collision) {
      for (const axis of ['x', 'y', 'z'])
        next[axis] =
          before[axis] + roundDiv((next[axis] - before[axis]) * Math.max(0, collision.at - 1), Q);
      next[collision.axis] += collision.sign;
      state.velocity = { x: 0, y: 0, z: 0 };
      state.contacts++;
    }
    for (const axis of ['x', 'y', 'z']) {
      if (
        next[axis] < source.bounds.min[axis] ||
        next[axis] > source.bounds.max[axis] ||
        (axis === 'y' && next.y === 0)
      ) {
        const floor = axis === 'y' && next.y <= 0;
        if (floor && before.y > 0) {
          state.landingSpeed = speed;
          state.landingTilt = tilt;
        }
        if (!floor || (before.y > 0 && speed > 1500)) state.contacts++;
        next[axis] = clamp(next[axis], source.bounds.min[axis], source.bounds.max[axis]);
        state.velocity[axis] = 0;
        if (floor) {
          state.velocity.x = roundDiv(state.velocity.x * 700, 1000);
          state.velocity.z = roundDiv(state.velocity.z * 700, 1000);
        }
      }
      state.position[axis] = next[axis];
    }
    state.ticks++;
    state.lastInput = { ...command };
    state.heightRange.min = Math.min(state.heightRange.min, next.y);
    state.heightRange.max = Math.max(state.heightRange.max, next.y);
    const target = source.steps[mode][state.step];
    let accepted = false;
    if (target.type === 'gate') accepted = crossesGate(before, next, target);
    else {
      const heading =
        target.heading === null
          ? 0
          : Math.abs(((nextAttitude.yaw - target.heading + 54000) % 36000) - 18000);
      const inside =
        ['x', 'y', 'z'].every(
          (key) => next[key] >= target.min[key] && next[key] <= target.max[key],
        ) &&
        speed <= target.maxSpeed &&
        tilt <= target.maxTilt &&
        tilt >= target.minTilt &&
        heading <= 1500 &&
        (!target.centred ||
          ['pitch', 'roll', 'yaw'].every((key) => Math.abs(command[key]) <= 50)) &&
        (target.type !== 'land' ||
          (next.y === 0 &&
            command.throttle <= 100 &&
            state.landingSpeed <= target.maxSpeed &&
            state.landingTilt <= target.maxTilt));
      state.hold = inside ? state.hold + 1 : 0;
      accepted = state.hold >= target.ticks;
    }
    if (accepted) {
      state.step++;
      state.hold = 0;
      if (state.step === source.steps[mode].length) state.status = 'complete';
    }
    return snapshot();
  }
  return {
    identity,
    course: () => structuredClone(source),
    response: () => ({ ...rates }),
    snapshot,
    step,
    reset,
    arm() {
      if (['disarmed', 'paused'].includes(state.status)) state.status = 'active';
    },
    pause() {
      if (state.status === 'active') state.status = 'paused';
    },
  };
}
export const exportFlightCourse = (input) => canonicalJSON(validateFlightCourse(input));

/** Fixed-width four-int input frames avoid JSON expansion from continuously moving
 * sticks. 36,000 frames cover every tick of a 12 minute authored attempt. No truncation. */
export function createFlightRecorder(flight, { session = 'practice' } = {}) {
  required(
    ['practice', 'demonstration', 'authoring', 'replay'].includes(session),
    'Invalid practice session',
  );
  const frames = [];
  return {
    record(input) {
      required(
        frames.length < MAX_FLIGHT_TICKS,
        'Flight proof full; reset or export before continuing',
      );
      const c = quantizeFlightInput(input);
      frames.push(FLIGHT_CONTROLS.map((key) => c[key]));
    },
    export() {
      return {
        format: 'FlightAttempt.v1',
        session,
        ...flight.identity,
        response: flight.response(),
        frames: frames.map((x) => [...x]),
      };
    },
    ticks: () => frames.length,
  };
}
function prepareFlightReplay(course, input, sampleEvery) {
  const proof = boundedJSON(input, {
    maxBytes: 1024 * 1024,
    maxNodes: MAX_FLIGHT_TICKS * 6 + 500,
    maxArray: MAX_FLIGHT_TICKS,
    maxDepth: 8,
  });
  exactKeys(
    proof,
    [
      'format',
      'session',
      'model',
      'course',
      'courseIdentity',
      'mode',
      'responseIdentity',
      'response',
      'frames',
    ],
    'flight proof',
  );
  required(
    proof.format === 'FlightAttempt.v1' &&
      ['practice', 'demonstration', 'authoring', 'replay'].includes(proof.session) &&
      Array.isArray(proof.frames) &&
      proof.frames.length <= MAX_FLIGHT_TICKS,
    'Invalid flight proof',
  );
  const flight = createFlight({ course, mode: proof.mode, response: proof.response });
  required(
    Object.entries(flight.identity).every(([key, value]) => proof[key] === value),
    'Exact flight model, course, mode and response required',
  );
  flight.arm();
  const path = [];
  function advance(i) {
    const frame = proof.frames[i];
    required(Array.isArray(frame) && frame.length === 4, 'Four recorded controls required');
    required(flight.snapshot().status === 'active', 'Flight proof continues after terminal state');
    const state = flight.step(
      Object.fromEntries(FLIGHT_CONTROLS.map((key, j) => [key, frame[j]])),
      { quantized: true },
    );
    if (sampleEvery && (i % sampleEvery === 0 || state.status === 'complete'))
      path.push({
        tick: state.ticks,
        position: state.position,
        orientation: state.orientation,
        input: state.lastInput,
      });
  }
  return {
    ticks: proof.frames.length,
    advance,
    result: () => ({ identity: flight.identity, state: flight.snapshot(), path }),
  };
}
export function replayFlight(course, input, { sampleEvery = 0 } = {}) {
  const replay = prepareFlightReplay(course, input, sampleEvery);
  for (let i = 0; i < replay.ticks; i++) replay.advance(i);
  return replay.result();
}

/** The same validator and stepping authority as synchronous replay. Cooperative
 * proof admission yields at most every 200 ticks; cancellation never changes an
 * outcome or turns a partial transcript into accepted completion evidence. */
export async function replayFlightCooperatively(
  course,
  input,
  {
    sampleEvery = 0,
    signal,
    yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
  } = {},
) {
  signal?.throwIfAborted();
  const replay = prepareFlightReplay(course, input, sampleEvery);
  for (let i = 0; i < replay.ticks; i++) {
    if (i % 200 === 0) {
      signal?.throwIfAborted();
      await yieldControl();
      signal?.throwIfAborted();
    }
    replay.advance(i);
  }
  signal?.throwIfAborted();
  return replay.result();
}
