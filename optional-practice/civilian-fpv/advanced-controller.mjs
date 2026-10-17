import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';

export const ADVANCED_CONTROLLER = 'sim-independent-pid.v2';
export const ADVANCED_AXES = Object.freeze(['roll', 'pitch', 'yaw']);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const zeroAxes = () => ({ roll: 0, pitch: 0, yaw: 0 });
const clone = (value) => structuredClone(value);
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;

/** Gains use SI units: Nm/(rad/s), Nm/rad, Nm/(rad/s²), and Nm/(rad/s²).
 * They are SIM gains, not Betaflight PID values. */
export const DEFAULT_ADVANCED_TUNE = Object.freeze({
  format: 'AdvancedControllerTune.v2',
  gains: Object.freeze({
    roll: Object.freeze({ p: 0.025, i: 0.012, d: 0.0003, feedforward: 0.0002 }),
    pitch: Object.freeze({ p: 0.025, i: 0.012, d: 0.0003, feedforward: 0.0002 }),
    yaw: Object.freeze({ p: 0.018, i: 0.008, d: 0.0002, feedforward: 0.0001 }),
  }),
  integralLimit: 0.12,
  antiWindup: 20,
  gyroFilterHz: 100,
  dTermFilterHz: 60,
  inputSmoothingHz: 0,
  feedforwardFilterHz: 30,
});

export function validateAdvancedTune(source = DEFAULT_ADVANCED_TUNE) {
  const tune = boundedJSON(source, { maxBytes: 8192, maxNodes: 100, maxDepth: 5 });
  // Older saved experimental tunes deliberately keep their unfiltered
  // feedforward choice. New templates use a finite-bandwidth derivative so a
  // packet transition does not become a frequency-dependent saturated impulse.
  if (tune.format === 'AdvancedControllerTune.v1') {
    required(!Object.hasOwn(tune, 'feedforwardFilterHz'), 'Unexpected legacy feedforward filter');
    tune.format = 'AdvancedControllerTune.v2';
    tune.feedforwardFilterHz = 0;
  }
  exactKeys(
    tune,
    [
      'format',
      'gains',
      'integralLimit',
      'antiWindup',
      'gyroFilterHz',
      'dTermFilterHz',
      'inputSmoothingHz',
      'feedforwardFilterHz',
    ],
    'Advanced controller tune',
  );
  required(tune.format === 'AdvancedControllerTune.v2', 'Unsupported Advanced controller tune');
  exactKeys(tune.gains, ADVANCED_AXES, 'Controller gains');
  for (const axis of ADVANCED_AXES) {
    exactKeys(tune.gains[axis], ['p', 'i', 'd', 'feedforward'], 'Axis gains');
    for (const key of ['p', 'i', 'd', 'feedforward'])
      required(
        finite(tune.gains[axis][key], 0, 1),
        'Controller gains must be within 0..1 SI units',
      );
  }
  required(
    finite(tune.integralLimit, 0, 1) && finite(tune.antiWindup, 0, 100),
    'Invalid anti-windup settings',
  );
  for (const key of ['gyroFilterHz', 'dTermFilterHz', 'inputSmoothingHz', 'feedforwardFilterHz'])
    required(finite(tune[key], 0, 1000), 'Filter cutoff must be 0..1000 Hz');
  return tune;
}

/** Replaceable controller contract. A firmware adapter can declare
 * inputProcessing:'firmware-owned' and accept calibrated controls itself. */
export const ADVANCED_CONTROLLER_CAPABILITIES = Object.freeze({
  identity: ADVANCED_CONTROLLER,
  inputProcessing: 'external-rate-evaluator',
  inputUnits: 'calibrated-normalized',
  targetUnits: 'degrees-per-second',
  sensorUnits: 'radians-per-second',
  motorUnits: 'normalized-speed',
  curveCompatibility: 'provided-by-rate-evaluator',
  inputResponseCompatibility: 'independent-sim',
  controllerCompatibility: 'independent-sim',
  snapshotVersion: 'AdvancedControllerState.v2',
});

const lowPass = (old, value, hz, dt) =>
  hz === 0 ? value : old + ((value - old) * dt) / (1 / (2 * 3.141592653589793 * hz) + dt);
const initialState = () => ({
  format: 'AdvancedControllerState.v2',
  integral: zeroAxes(),
  gyro: zeroAxes(),
  derivative: zeroAxes(),
  feedforward: zeroAxes(),
  target: zeroAxes(),
  previousTarget: zeroAxes(),
  previousGyro: zeroAxes(),
  motors: [0, 0, 0, 0],
  saturated: false,
  requestedTorque: zeroAxes(),
  achievedTorque: zeroAxes(),
});

/** All four motors participate in every coupled body step. Motor order is
 * front-left, front-right, rear-right, rear-left; body +y points upward. */
export function createAdvancedController({
  tune: source,
  armLength = 0.115,
  maxThrust = 6,
  reactionTorque = 0.014,
} = {}) {
  const tune = validateAdvancedTune(source);
  required(
    finite(armLength, 0.01, 1) && finite(maxThrust, 0.01, 100) && finite(reactionTorque, 0.001, 1),
    'Invalid mixer geometry',
  );
  const geometry = { armLength, maxThrust, reactionTorque };
  const identity = dataIdentity({ backend: ADVANCED_CONTROLLER, tune, geometry });
  const lever = armLength * 0.7071067811865476;
  const signs = [
    { roll: 1, pitch: -1, yaw: -1 },
    { roll: -1, pitch: -1, yaw: 1 },
    { roll: -1, pitch: 1, yaw: -1 },
    { roll: 1, pitch: 1, yaw: 1 },
  ];
  let state = initialState();
  function restore(snapshot) {
    const next = boundedJSON(snapshot, { maxBytes: 8192, maxNodes: 100, maxDepth: 5 });
    required(
      next.identity === identity && next.state?.format === 'AdvancedControllerState.v2',
      'Controller snapshot belongs to another tune',
    );
    exactKeys(next, ['identity', 'state'], 'Controller snapshot');
    exactKeys(next.state, Object.keys(initialState()), 'Controller state');
    for (const key of [
      'integral',
      'gyro',
      'derivative',
      'feedforward',
      'target',
      'previousTarget',
      'previousGyro',
      'requestedTorque',
      'achievedTorque',
    ]) {
      exactKeys(next.state[key], ADVANCED_AXES, 'Controller state axes');
      required(
        ADVANCED_AXES.every((axis) => finite(next.state[key][axis], -1e9, 1e9)),
        'Invalid controller state',
      );
    }
    required(
      Array.isArray(next.state.motors) &&
        next.state.motors.length === 4 &&
        next.state.motors.every((v) => finite(v, 0, 1)) &&
        typeof next.state.saturated === 'boolean',
      'Invalid motor state',
    );
    state = next.state;
  }
  function step({ controls, target, sensors, dt }) {
    required(finite(dt, 0.0001, 0.02), 'Controller step must have fixed substep duration');
    required(
      controls &&
        ADVANCED_AXES.every((axis) => finite(controls[axis], -1, 1)) &&
        finite(controls.throttle, 0, 1),
      'Calibrated controls required',
    );
    required(
      target &&
        ADVANCED_AXES.every((axis) => finite(target[axis], -10000, 10000)) &&
        finite(target.throttle, 0, 1),
      'Rate evaluator must supply finite commands',
    );
    required(
      sensors && ADVANCED_AXES.every((axis) => finite(sensors[axis], -1e6, 1e6)),
      'Current body sensor sample required',
    );
    const torque = zeroAxes();
    for (const axis of ADVANCED_AXES) {
      const gain = tune.gains[axis];
      state.gyro[axis] = lowPass(state.gyro[axis], sensors[axis], tune.gyroFilterHz, dt);
      state.target[axis] = lowPass(
        state.target[axis],
        (target[axis] * 3.141592653589793) / 180,
        tune.inputSmoothingHz,
        dt,
      );
      state.feedforward[axis] = lowPass(
        state.feedforward[axis],
        (state.target[axis] - state.previousTarget[axis]) / dt,
        tune.feedforwardFilterHz,
        dt,
      );
      const error = state.target[axis] - state.gyro[axis];
      state.derivative[axis] = lowPass(
        state.derivative[axis],
        (state.gyro[axis] - state.previousGyro[axis]) / dt,
        tune.dTermFilterHz,
        dt,
      );
      state.integral[axis] = clamp(
        state.integral[axis] + gain.i * error * dt,
        -tune.integralLimit,
        tune.integralLimit,
      );
      torque[axis] =
        gain.p * error +
        state.integral[axis] -
        gain.d * state.derivative[axis] +
        gain.feedforward * state.feedforward[axis];
      state.previousGyro[axis] = state.gyro[axis];
      state.previousTarget[axis] = state.target[axis];
    }
    const raw = signs.map(
      (sign) =>
        target.throttle * target.throttle +
        (sign.roll * torque.roll + sign.pitch * torque.pitch) / (4 * lever * maxThrust) +
        (sign.yaw * torque.yaw) / (4 * reactionTorque * maxThrust),
    );
    const lowest = Math.min(...raw),
      highest = Math.max(...raw),
      spread = highest - lowest;
    // Preserve relative authority by desaturating the complete mix before clamping.
    const scaled =
      spread > 1
        ? raw.map((value) => (value - lowest) / spread)
        : raw.map(
            (value) =>
              value + Math.max(0, -lowest) - Math.max(0, highest + Math.max(0, -lowest) - 1),
          );
    const outputs =
      target.throttle === 0 ? [0, 0, 0, 0] : scaled.map((value) => clamp(value, 0, 1));
    const achieved = zeroAxes();
    for (let motor = 0; motor < 4; motor++) {
      achieved.roll += outputs[motor] * signs[motor].roll * lever * maxThrust;
      achieved.pitch += outputs[motor] * signs[motor].pitch * lever * maxThrust;
      achieved.yaw += outputs[motor] * signs[motor].yaw * reactionTorque * maxThrust;
    }
    for (const axis of ADVANCED_AXES)
      state.integral[axis] =
        target.throttle === 0
          ? 0
          : clamp(
              state.integral[axis] + tune.antiWindup * (achieved[axis] - torque[axis]) * dt,
              -tune.integralLimit,
              tune.integralLimit,
            );
    state.motors = outputs.map(Math.sqrt);
    state.saturated = outputs.some((value, index) => Math.abs(value - raw[index]) > 1e-9);
    state.requestedTorque = torque;
    state.achievedTorque = achieved;
    return { motors: [...state.motors], saturated: state.saturated };
  }
  return {
    capabilities: () => ({ ...ADVANCED_CONTROLLER_CAPABILITIES }),
    identity,
    initialize: () => {
      state = initialState();
    },
    reset: () => {
      state = initialState();
    },
    step,
    telemetry: () => clone(state),
    snapshot: () => ({ identity, state: clone(state) }),
    restore,
  };
}
