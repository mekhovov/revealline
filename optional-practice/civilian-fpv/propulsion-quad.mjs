import { boundedJSON, dataIdentity, exactKeys, required, stableId } from '../../game/data-json.mjs';
import {
  PROPULSION_SURFACE_LIMITS,
  createPropulsionSurfaceEvaluator,
  solvePropulsionSurfaceLoad,
} from './propulsion-surface.mjs';

export const STATIC_QUAD_PROPULSION_FORMAT = 'StaticQuadPropulsion.v1';
export const STATIC_QUAD_RESULT_FORMAT = 'StaticQuadPropulsionResult.v1';
const FRAME = 'body-x-right-y-up-z-rear-origin-com';
const TORQUE_BASIS = 'steady-shaft-reaction-magnitude';
const UNITS = Object.freeze({
  position: 'm',
  force: 'N',
  torque: 'N*m',
  voltage: 'V',
  current: 'A',
  resistance: 'ohm',
});
const CHANNELS = ['rpm', 'thrust', 'torque', 'current'];
const CONDITIONS = [
  'airDensityKgM3',
  'temperatureC',
  'pressurePa',
  'humidityRatio',
  'installation',
];
const finite = (value, low, high) =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function keys(value, allowed, label) {
  exactKeys(value, allowed, label);
  required(
    allowed.every((key) => Object.hasOwn(value, key)),
    `${label} has missing fields`,
  );
}

/** Non-activating steady bench calculation. Positions are relative to COM;
 * every thrust acts along body +y. Rotor array order is retained exactly.
 * reactionDirection is the sign of body-y reaction torque, not a guessed CW
 * convention. ESC command is never interpreted as RPM or normalized speed. */
export function evaluateStaticQuadPropulsion(source) {
  const options = boundedJSON(source, {
    maxBytes: 4 * PROPULSION_SURFACE_LIMITS.maxBytes + 4096,
    maxNodes: 82000,
    maxDepth: 14,
    maxArray: 256,
    maxString: 4096,
  });
  keys(
    options,
    ['format', 'frame', 'thrustAxis', 'torqueBasis', 'units', 'rotors', 'battery'],
    'Static quad propulsion',
  );
  required(options.format === STATIC_QUAD_PROPULSION_FORMAT, 'Unsupported static quad format');
  required(options.frame === FRAME, 'Explicit body axes and COM origin are required');
  required(
    options.thrustAxis === 'positive-y',
    'Only parallel body-positive-y thrust is supported',
  );
  required(
    options.torqueBasis === TORQUE_BASIS,
    'Explicit steady reaction-torque basis is required',
  );
  keys(options.units, Object.keys(UNITS), 'Static quad units');
  required(
    Object.entries(UNITS).every(([key, unit]) => options.units[key] === unit),
    'Static quad geometry and battery inputs require declared SI units',
  );
  keys(options.battery, ['openVoltage', 'resistance', 'currentLimit'], 'Static quad battery');
  required(
    finite(options.battery.openVoltage, 0, 1000) &&
      finite(options.battery.resistance, 0, 1000) &&
      (options.battery.currentLimit === null || finite(options.battery.currentLimit, 0, 40000)),
    'Invalid static quad battery inputs',
  );
  required(
    Array.isArray(options.rotors) && options.rotors.length === 4,
    'Exactly four rotors required',
  );
  const ids = new Set();
  const evaluators = options.rotors.map((rotor) => {
    keys(rotor, ['id', 'position', 'reactionDirection', 'command', 'surface'], 'Static quad rotor');
    required(stableId(rotor.id) && !ids.has(rotor.id), 'Rotor identifiers must be unique');
    ids.add(rotor.id);
    keys(rotor.position, ['x', 'y', 'z'], 'Rotor COM-relative position');
    required(
      Object.values(rotor.position).every((value) => finite(value, -2, 2)),
      'Invalid rotor position in metres',
    );
    required(
      rotor.reactionDirection === 1 || rotor.reactionDirection === -1,
      'Explicit body-y reaction direction required',
    );
    keys(rotor.command, ['value', 'unit'], 'Rotor command');
    required(finite(rotor.command.value, -Infinity, Infinity), 'Finite rotor command required');
    const evaluator = createPropulsionSurfaceEvaluator(rotor.surface);
    required(
      rotor.command.unit === evaluator.units.command,
      'Rotor command must declare the surface canonical command unit',
    );
    return evaluator;
  });
  const input = {
    frame: options.frame,
    thrustAxis: options.thrustAxis,
    torqueBasis: options.torqueBasis,
    units: options.units,
    battery: options.battery,
    rotors: options.rotors.map(({ id, position, reactionDirection, command }, index) => ({
      index,
      id,
      position,
      reactionDirection,
      command,
      surfaceIdentity: evaluators[index].identity,
    })),
  };
  const load = solvePropulsionSurfaceLoad({
    loads: options.rotors.map((rotor) => ({
      surface: rotor.surface,
      command: rotor.command.value,
    })),
    ...options.battery,
  });
  const result = {
    format: STATIC_QUAD_RESULT_FORMAT,
    resultKind: 'calculated',
    identity: dataIdentity({ format: STATIC_QUAD_PROPULSION_FORMAT, input }),
    flightEligible: false,
    assumptions: {
      torqueBasis: 'caller-declared-not-verified',
      measurementTopology: 'unverified',
      environment: 'declared-known-values-agree',
      operatingCondition: 'steady-static-independent-parallel-rotors',
      dynamics: 'not-modeled',
      allocation: 'not-performed',
      uncertainty: 'central-values-only-not-propagated',
    },
    input,
    load,
    status: load.status,
    reason: load.reason,
    rotorIndex: load.surfaceIndex,
    diagnostics: [],
    rotors: null,
    wrench: null,
    power: null,
  };
  const unknown = [],
    incompatible = [];
  let conflictIndex = null;
  for (const field of CONDITIONS) {
    const values = evaluators.map((evaluator) => evaluator.surface.paths[0].conditions[field]);
    if (values.includes(null)) unknown.push(field);
    const known = values.find((value) => value !== null),
      different = values.findIndex((value) => value !== null && value !== known);
    if (different >= 0) {
      incompatible.push(field);
      conflictIndex ??= different;
    }
  }
  if (unknown.length) {
    result.assumptions.environment = 'partially-unknown';
    result.diagnostics.push({
      code: 'unknown-rotor-conditions',
      fields: unknown,
      severity: 'warning',
    });
  }
  if (incompatible.length) {
    result.assumptions.environment = 'incompatible-declarations';
    result.diagnostics.push({
      code: 'incompatible-rotor-conditions',
      fields: incompatible,
      severity: 'warning',
    });
    return freeze({
      ...result,
      status: 'unavailable',
      reason: 'incompatible-rotor-conditions',
      rotorIndex: conflictIndex,
    });
  }
  if (load.status === 'unavailable') return freeze(result);
  const operatingPoint = load.load.operatingPoint;
  const points = evaluators.map((evaluator, index) =>
    evaluator.evaluate({
      command: options.rotors[index].command.value,
      voltage: operatingPoint.voltage,
    }),
  );
  result.rotors = points.map((point, index) => ({ ...input.rotors[index], point }));
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    result.diagnostics.push(...point.diagnostics.map((item) => ({ ...item, rotorIndex: index })));
    let reason = point.status === 'outside-coverage' ? 'operating-point-outside-coverage' : null;
    const missing = CHANNELS.filter((field) => point.values?.[field] === null),
      negative = CHANNELS.filter((field) => point.values?.[field] < 0);
    if (!reason && missing.length) reason = 'operating-channels-unavailable';
    if (!reason && negative.length) reason = 'negative-operating-channel';
    if (
      !reason &&
      point.diagnostics.some(
        (item) => item.code === 'shaft-power-exceeds-electrical-central-values',
      )
    )
      reason = 'operating-power-inconsistent';
    if (reason) {
      result.diagnostics.push({
        code: reason,
        rotorIndex: index,
        fields: [...missing, ...negative],
      });
      return freeze({ ...result, status: 'unavailable', reason, rotorIndex: index });
    }
  }
  const force = { x: 0, y: 0, z: 0 },
    torque = { x: 0, y: 0, z: 0 };
  let shaftWatts = 0;
  points.forEach((point, index) => {
    const rotor = input.rotors[index],
      thrust = point.values.thrust;
    force.y += thrust;
    torque.x -= rotor.position.z * thrust;
    torque.z += rotor.position.x * thrust;
    torque.y += rotor.reactionDirection * point.values.torque;
    shaftWatts += point.power.shaftWatts;
  });
  result.wrench = { force, torque };
  result.power = {
    supplyWatts: options.battery.openVoltage * operatingPoint.current,
    electricalWatts: operatingPoint.electricalWatts,
    batteryLossWatts: operatingPoint.batteryLossWatts,
    shaftWatts,
  };
  return freeze(result);
}
