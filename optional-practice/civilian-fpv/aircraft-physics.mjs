import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';

export const AIRCRAFT_PHYSICS_FORMAT = 'AdvancedAircraft.v2';
export const AIRCRAFT_CONTROLLER = 'sim-aircraft-pid.v1';
const XYZ = ['x', 'y', 'z'];
const AXES = ['roll', 'pitch', 'yaw'];
const PI = 3.141592653589793;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const finite = (v, low, high) => Number.isFinite(v) && v >= low && v <= high;
const clone = (v) => structuredClone(v);
const zero = () => ({ x: 0, y: 0, z: 0 });
const axisZero = () => ({ roll: 0, pitch: 0, yaw: 0 });
const vector = (value) =>
  typeof value === 'number' ? { x: value, y: value, z: value } : clone(value);
const vectorCheck = (v, low, high, label) => {
  exactKeys(v, XYZ, label);
  required(
    XYZ.every((axis) => finite(v[axis], low, high)),
    `Invalid ${label}`,
  );
};
const BASE_FIELDS = [
  'format',
  'id',
  'mass',
  'armLength',
  'inertia',
  'maxThrust',
  'radius',
  'reactionTorque',
  'motorTimeConstant',
  'linearDrag',
  'quadraticDrag',
  'angularDrag',
  'motorOutputLimit',
  'battery',
  'sensorNoise',
  'vibration',
];

/** SI units throughout. Body +x right, +y up, +z rear. Rotor positions and
 * principal inertia refer to the COM/body origin; centerOfMass records that
 * origin in the frame's coordinates. Motor order FL, FR, RR, RL is conventional,
 * not required by the allocator. Positive spin produces positive body-y torque.
 * maxThrust is PER MOTOR at nominalVoltage, not at full battery voltage. */
export function createAircraftPhysics(base, options = {}) {
  const value = clone(base);
  const centerOfMass = options.centerOfMass ?? zero();
  const lever = (options.wheelbase ? options.wheelbase / 2 : value.armLength) * 0.7071067811865476;
  const rotors = options.rotors ?? [
    { position: { x: -lever, y: 0, z: -lever }, spin: 1 },
    { position: { x: lever, y: 0, z: -lever }, spin: -1 },
    { position: { x: lever, y: 0, z: lever }, spin: 1 },
    { position: { x: -lever, y: 0, z: lever }, spin: -1 },
  ];
  const dimensions = options.dimensions ?? {
    x: value.armLength * 0.7,
    y: value.armLength * 0.35,
    z: value.armLength,
  };
  const aircraft = {
    ...value,
    format: AIRCRAFT_PHYSICS_FORMAT,
    geometry: {
      rotors: rotors.map((rotor) => ({
        ...rotor,
        position: Object.fromEntries(XYZ.map((a) => [a, rotor.position[a] - centerOfMass[a]])),
      })),
      centerOfMass: clone(centerOfMass),
      bodyHalfExtents: Object.fromEntries(XYZ.map((a) => [a, dimensions[a] / 2])),
      propellerRadius: (options.propellerDiameter ?? value.armLength) / 2,
      ducted: options.ducted ?? false,
    },
    drag: {
      linear: vector(options.linearDrag ?? value.linearDrag),
      quadratic: vector(options.quadraticDrag ?? value.quadraticDrag),
      angular: vector(options.angularDrag ?? value.angularDrag),
    },
    propulsion: {
      idleSpeed: options.idleSpeed ?? 0.055,
      airmode: options.airmode ?? true,
      table: options.table ?? null,
    },
    battery: {
      ...value.battery,
      depletion: options.depletion ?? false,
      chemistry:
        { lipo: 'LiPo', lihv: 'LiHV', 'li-ion': 'Li-ion' }[options.chemistry] ??
        options.chemistry ??
        'LiPo',
      currentLimit: options.currentLimit ?? value.battery.fullCurrent,
    },
  };
  aircraft.radius = Math.max(aircraft.radius, aircraftCollisionRadius(aircraft));
  return validateAircraftPhysics(aircraft);
}

/** Enclosing COM-relative radius for terrain admission and course advice.
 * Mirrors the runtime's central cuboid and rotor-cylinder collision geometry. */
export function aircraftCollisionRadius(aircraft) {
  const {
    centerOfMass: center,
    bodyHalfExtents: half,
    rotors,
    propellerRadius,
    ducted,
  } = aircraft.geometry;
  const x = half.x + Math.abs(center.x),
    y = half.y + Math.abs(center.y),
    z = half.z + Math.abs(center.z);
  let radiusSquared = x * x + y * y + z * z;
  const rotorHalfHeight = ducted ? Math.max(half.y, 0.006) : 0.003;
  for (const { position } of rotors) {
    const radial = Math.sqrt(position.x * position.x + position.z * position.z) + propellerRadius,
      vertical = Math.abs(position.y) + rotorHalfHeight;
    radiusSquared = Math.max(radiusSquared, radial * radial + vertical * vertical);
  }
  return Math.sqrt(radiusSquared);
}

export function validateAircraftPhysics(source) {
  const value = boundedJSON(source, {
    maxBytes: 32768,
    maxNodes: 1800,
    maxArray: 128,
    maxDepth: 8,
  });
  exactKeys(value, [...BASE_FIELDS, 'geometry', 'drag', 'propulsion'], 'Aircraft physics');
  required(
    value.format === AIRCRAFT_PHYSICS_FORMAT &&
      typeof value.id === 'string' &&
      value.id.length > 0 &&
      value.id.length <= 80,
    'Unsupported aircraft physics',
  );
  const limits = {
    mass: [0.01, 25],
    armLength: [0.01, 2],
    maxThrust: [0.01, 250],
    radius: [0.01, 2],
    reactionTorque: [0.0001, 1],
    motorTimeConstant: [0.001, 1],
    linearDrag: [0, 100],
    quadraticDrag: [0, 100],
    angularDrag: [0, 100],
    motorOutputLimit: [0.1, 1],
    sensorNoise: [0, 5],
    vibration: [0, 5],
  };
  for (const [key, bounds] of Object.entries(limits))
    required(finite(value[key], ...bounds), `Invalid aircraft ${key}`);
  vectorCheck(value.inertia, 0.0000001, 100, 'principal inertia');
  for (const axis of XYZ)
    required(
      value.inertia[axis] <=
        XYZ.filter((a) => a !== axis).reduce((sum, a) => sum + value.inertia[a], 0) * (1 + 1e-9),
      'Principal inertia violates triangle inequality',
    );
  exactKeys(
    value.geometry,
    ['rotors', 'centerOfMass', 'bodyHalfExtents', 'propellerRadius', 'ducted'],
    'Aircraft geometry',
  );
  vectorCheck(value.geometry.centerOfMass, -2, 2, 'center of mass');
  vectorCheck(value.geometry.bodyHalfExtents, 0.001, 2, 'body half extents');
  required(
    finite(value.geometry.propellerRadius, 0.005, 1) && typeof value.geometry.ducted === 'boolean',
    'Invalid propeller geometry',
  );
  required(
    Array.isArray(value.geometry.rotors) && value.geometry.rotors.length === 4,
    'A quad requires four rotors',
  );
  for (const rotor of value.geometry.rotors) {
    exactKeys(rotor, ['position', 'spin'], 'Rotor');
    vectorCheck(rotor.position, -2, 2, 'rotor position');
    required(rotor.spin === 1 || rotor.spin === -1, 'Invalid rotor spin');
  }
  required(
    value.radius >= aircraftCollisionRadius(value) - 1e-12,
    'Aircraft radius must enclose its complete collision geometry',
  );
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) {
      const a = value.geometry.rotors[i].position,
        b = value.geometry.rotors[j].position;
      const dx = a.x - b.x,
        dz = a.z - b.z;
      required(
        dx * dx + dz * dz >=
          4 * value.geometry.propellerRadius * value.geometry.propellerRadius - 1e-12,
        'Propeller discs overlap',
      );
    }
  const inverse = inverseAllocation(value);
  required(
    inverse.every((row) => row[0] > 0),
    'Center of mass must lie inside the rotor support polygon',
  );
  exactKeys(value.drag, ['linear', 'quadratic', 'angular'], 'Directional drag');
  for (const key of ['linear', 'quadratic', 'angular'])
    vectorCheck(value.drag[key], 0, 100, `${key} drag`);
  exactKeys(value.propulsion, ['idleSpeed', 'airmode', 'table'], 'Propulsion');
  required(
    finite(value.propulsion.idleSpeed, 0, 0.3) && typeof value.propulsion.airmode === 'boolean',
    'Invalid armed idle',
  );
  if (value.propulsion.table !== null) {
    const table = value.propulsion.table;
    exactKeys(table, ['referenceVoltage', 'samples'], 'Propulsion table');
    required(
      finite(table.referenceVoltage, 1, 100) &&
        Array.isArray(table.samples) &&
        table.samples.length >= 2 &&
        table.samples.length <= 128,
      'Invalid propulsion table',
    );
    table.samples.forEach((row, index) => {
      required(
        Array.isArray(row) &&
          row.length === 4 &&
          finite(row[0], 0, 1) &&
          row.slice(1).every((v) => finite(v, 0, 1000)),
        'Invalid propulsion sample',
      );
      if (index) {
        const previous = table.samples[index - 1];
        required(
          row[0] > previous[0] &&
            row[1] > previous[1] &&
            row[2] >= previous[2] &&
            row[3] >= previous[3],
          'Propulsion samples must increase monotonically',
        );
      }
    });
    required(
      table.samples[0].every((v) => v === 0) &&
        table.samples.at(-1)[0] === 1 &&
        table.samples.at(-1)[3] > 0,
      'Propulsion samples must cover zero to full speed with yaw torque',
    );
  }
  const battery = value.battery;
  exactKeys(
    battery,
    [
      'nominalVoltage',
      'fullVoltage',
      'emptyVoltage',
      'resistance',
      'fullCurrent',
      'capacityAh',
      'depletion',
      'chemistry',
      'currentLimit',
    ],
    'Aircraft battery',
  );
  required(
    finite(battery.nominalVoltage, 1, 100) &&
      finite(battery.fullVoltage, battery.nominalVoltage, 100) &&
      finite(battery.emptyVoltage, 1, battery.nominalVoltage) &&
      finite(battery.resistance, 0, 10) &&
      finite(battery.fullCurrent, 0.01, 1000) &&
      finite(battery.currentLimit, 0.01, 1000) &&
      finite(battery.capacityAh, 0.01, 100) &&
      typeof battery.depletion === 'boolean' &&
      ['LiPo', 'LiHV', 'Li-ion'].includes(battery.chemistry),
    'Invalid aircraft battery',
  );
  return value;
}

/** Deterministic linear interpolation; tables are static measurements only.
 * Voltage scaling and non-static operating points remain analytic estimates. */
export function aircraftMotorPoint(aircraft, speed, voltage) {
  const s = clamp(speed, 0, 1),
    table = aircraft.propulsion.table;
  const reference = table?.referenceVoltage ?? aircraft.battery.nominalVoltage;
  const ratio = Math.max(0, voltage) / reference,
    square = ratio * ratio;
  if (!table) {
    const thrust = aircraft.maxThrust * s * s * square;
    return {
      thrust,
      current: (aircraft.battery.fullCurrent / 4) * s * s * s * square,
      torque: thrust * aircraft.reactionTorque,
    };
  }
  let upper = 1;
  while (upper < table.samples.length - 1 && table.samples[upper][0] < s) upper++;
  const a = table.samples[upper - 1],
    b = table.samples[upper],
    fraction = (s - a[0]) / (b[0] - a[0]);
  return {
    thrust: (a[1] + (b[1] - a[1]) * fraction) * square,
    current: (a[2] + (b[2] - a[2]) * fraction) * square,
    torque: (a[3] + (b[3] - a[3]) * fraction) * square,
  };
}

export function aircraftMotorSpeedForThrust(aircraft, thrust, voltage) {
  if (thrust <= 0 || voltage <= 0) return 0;
  if (!aircraft.propulsion.table)
    return clamp(
      (Math.sqrt(thrust / aircraft.maxThrust) * aircraft.battery.nominalVoltage) / voltage,
      0,
      1,
    );
  const table = aircraft.propulsion.table,
    ratio = voltage / table.referenceVoltage;
  const referenceThrust = thrust / (ratio * ratio);
  let upper = 1;
  while (upper < table.samples.length - 1 && table.samples[upper][1] < referenceThrust) upper++;
  const a = table.samples[upper - 1],
    b = table.samples[upper];
  return clamp(a[0] + ((b[0] - a[0]) * (referenceThrust - a[1])) / (b[1] - a[1]), 0, 1);
}

/** Solve V = openVoltage - R*I(V), then current-limit the common motor speed.
 * Fixed iteration counts are part of the versioned numerical model. */
export function aircraftElectricalPoint(aircraft, motorSpeeds, usedAh = 0) {
  const battery = aircraft.battery;
  const charge = battery.depletion ? clamp(1 - usedAh / battery.capacityAh, 0, 1) : 1;
  const openVoltage = battery.emptyVoltage + (battery.fullVoltage - battery.emptyVoltage) * charge;
  const speeds = motorSpeeds.map((v) => (charge > 0 ? clamp(v, 0, aircraft.motorOutputLimit) : 0));
  const solve = (scale) => {
    // Every currently supported static curve scales current with V². Solve
    // the resulting quadratic directly; this avoids iterative load estimates
    // inside a 1 kHz controller and gives a unique stable electrical point.
    const coefficient = speeds.reduce(
      (sum, speed) => sum + aircraftMotorPoint(aircraft, speed * scale, 1).current,
      0,
    );
    const voltage =
      (2 * openVoltage) / (1 + Math.sqrt(1 + 4 * battery.resistance * coefficient * openVoltage));
    const points = speeds.map((speed) => aircraftMotorPoint(aircraft, speed * scale, voltage));
    return { voltage, current: points.reduce((sum, point) => sum + point.current, 0), points };
  };
  let scale = 1,
    point = solve(1);
  if (point.current > battery.currentLimit) {
    let low = 0,
      high = 1;
    for (let n = 0; n < 24; n++) {
      const middle = (low + high) / 2;
      if (solve(middle).current > battery.currentLimit) high = middle;
      else low = middle;
    }
    scale = low;
    point = solve(scale);
  }
  return {
    voltage: point.voltage,
    current: point.current,
    motorSpeeds: speeds.map((speed) => speed * scale),
    thrusts: point.points.map((p) => p.thrust),
    reactionTorques: point.points.map((p) => p.torque),
    charge,
    currentLimited: scale < 1,
  };
}

export function stepAircraftPropulsion(aircraft, { motorSpeeds, commands, usedAh = 0, dt }) {
  required(
    finite(dt, 0.0001, 0.02) && finite(usedAh, 0, aircraft.battery.capacityAh),
    'Invalid propulsion step',
  );
  required(
    [motorSpeeds, commands].every(
      (a) => Array.isArray(a) && a.length === 4 && a.every((v) => finite(v, 0, 1)),
    ),
    'Invalid motor commands',
  );
  const alpha = Math.min(1, (2 * dt) / (2 * aircraft.motorTimeConstant + dt));
  const speeds = motorSpeeds.map(
    (speed, i) => speed + (commands[i] * aircraft.motorOutputLimit - speed) * alpha,
  );
  const point = aircraftElectricalPoint(aircraft, speeds, usedAh);
  return {
    ...point,
    usedAh: aircraft.battery.depletion
      ? Math.min(aircraft.battery.capacityAh, usedAh + (point.current * dt) / 3600)
      : usedAh,
  };
}

/** Inputs and outputs are body-relative; linearVelocity is air-relative, so the
 * host subtracts world wind before rotating to the body. All forces act at COM. */
export function aircraftBodyForces(
  aircraft,
  { thrusts, reactionTorques, linearVelocity = zero(), angularVelocity = zero() },
) {
  const force = zero(),
    torque = zero();
  aircraft.geometry.rotors.forEach((rotor, i) => {
    force.y += thrusts[i];
    torque.x -= rotor.position.z * thrusts[i];
    torque.z += rotor.position.x * thrusts[i];
    torque.y += rotor.spin * reactionTorques[i];
  });
  for (const axis of XYZ) {
    force[axis] -=
      aircraft.drag.linear[axis] * linearVelocity[axis] +
      aircraft.drag.quadratic[axis] * linearVelocity[axis] * Math.abs(linearVelocity[axis]);
    torque[axis] -= aircraft.drag.angular[axis] * angularVelocity[axis];
  }
  return { force, torque };
}

/** Inverse allocation rows turn [collective N, roll Nm, pitch Nm, yaw Nm] into
 * individual rotor thrust. Axis signs match the existing SIM's pilot controls. */
function inverseAllocation(aircraft, reactionRatio = aircraft.reactionTorque) {
  const rotors = aircraft.geometry.rotors;
  const matrix = [
    rotors.map(() => 1),
    rotors.map((r) => -r.position.x),
    rotors.map((r) => r.position.z),
    rotors.map((r) => -r.spin * reactionRatio),
  ].map((row, i) => [...row, ...[0, 1, 2, 3].map((j) => (i === j ? 1 : 0))]);
  for (let column = 0; column < 4; column++) {
    let pivot = column;
    for (let row = column + 1; row < 4; row++)
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    required(
      Math.abs(matrix[pivot][column]) > 1e-12,
      'Rotor geometry cannot allocate all control axes',
    );
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let i = 0; i < 8; i++) matrix[column][i] /= divisor;
    for (let row = 0; row < 4; row++)
      if (row !== column) {
        const factor = matrix[row][column];
        for (let i = 0; i < 8; i++) matrix[row][i] -= factor * matrix[column][i];
      }
  }
  return matrix.map((row) => row.slice(4));
}

export function allocateAircraftThrust(
  aircraft,
  { collective, torque, voltage, armed = true, airmode = aircraft.propulsion.airmode },
) {
  if (!armed) return { motors: [0, 0, 0, 0], thrusts: [0, 0, 0, 0], saturated: false };
  const maximum = aircraftMotorPoint(aircraft, aircraft.motorOutputLimit, voltage).thrust;
  const idle = aircraftMotorPoint(
    aircraft,
    aircraft.propulsion.idleSpeed * aircraft.motorOutputLimit,
    voltage,
  ).thrust;
  const representative = aircraftMotorPoint(
    aircraft,
    Math.max(
      aircraft.propulsion.idleSpeed,
      Math.sqrt(Math.max(0, collective) / Math.max(4 * maximum, 1e-12)),
    ),
    voltage,
  );
  const ratio =
    representative.thrust > 1e-12 && representative.torque > 0
      ? representative.torque / representative.thrust
      : aircraft.reactionTorque;
  const inverse = inverseAllocation(aircraft, ratio);
  const differential = inverse.map(
    (row) => row[1] * torque.roll + row[2] * torque.pitch + row[3] * torque.yaw,
  );
  const minimumCollective = Math.max(...inverse.map((row) => idle / row[0]));
  const interval = (scale) => {
    let low = 0,
      high = 4 * maximum;
    for (let i = 0; i < 4; i++) {
      low = Math.max(low, (idle - differential[i] * scale) / inverse[i][0]);
      high = Math.min(high, (maximum - differential[i] * scale) / inverse[i][0]);
    }
    if (!airmode) high = Math.min(high, Math.max(collective, minimumCollective));
    return { low, high, valid: low <= high };
  };
  let scale = 1,
    limits = interval(scale);
  if (!limits.valid) {
    let low = 0,
      high = 1;
    for (let n = 0; n < 28; n++) {
      const middle = (low + high) / 2;
      if (interval(middle).valid) low = middle;
      else high = middle;
    }
    scale = low;
    limits = interval(scale);
  }
  const usedCollective = clamp(collective, limits.low, limits.high);
  const thrusts = inverse.map((row, i) =>
    clamp(row[0] * usedCollective + differential[i] * scale, idle, maximum),
  );
  return {
    thrusts,
    motors: thrusts.map(
      (force) => aircraftMotorSpeedForThrust(aircraft, force, voltage) / aircraft.motorOutputLimit,
    ),
    saturated: scale < 1 - 1e-9 || Math.abs(usedCollective - collective) > 1e-9,
  };
}

export function createAircraftControllerTune(source) {
  const aircraft = validateAircraftPhysics(source);
  const frequency = Math.min(9, 0.3 / aircraft.motorTimeConstant);
  const bodyAxis = { roll: 'z', pitch: 'x', yaw: 'y' };
  const gains = Object.fromEntries(
    AXES.map((axis) => {
      const inertia = aircraft.inertia[bodyAxis[axis]],
        yaw = axis === 'yaw' ? 0.55 : 1;
      return [
        axis,
        {
          p: inertia * frequency * yaw,
          i: inertia * frequency * 0.45 * yaw,
          d: inertia * 0.035,
          feedforward: inertia * 0.025,
        },
      ];
    }),
  );
  return validateAircraftControllerTune({
    format: 'AdvancedControllerTune.v3',
    gains,
    integralLimit: aircraft.maxThrust * Math.min(aircraft.armLength, 0.2) * 0.25,
    antiWindup: 20,
    gyroFilterHz: 100,
    dTermFilterHz: 60,
    inputSmoothingHz: 0,
    feedforwardFilterHz: 30,
  });
}

export function validateAircraftControllerTune(source) {
  const tune = boundedJSON(source, { maxBytes: 8192, maxNodes: 100, maxDepth: 5 });
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
    'Aircraft controller tune',
  );
  required(tune.format === 'AdvancedControllerTune.v3', 'Unsupported aircraft controller tune');
  exactKeys(tune.gains, AXES, 'Controller gains');
  for (const axis of AXES) {
    exactKeys(tune.gains[axis], ['p', 'i', 'd', 'feedforward'], 'Controller axis gains');
    required(
      Object.values(tune.gains[axis]).every((v) => finite(v, 0, 1000)),
      'Invalid SI controller gain',
    );
  }
  required(
    finite(tune.integralLimit, 0, 1000) && finite(tune.antiWindup, 0, 100),
    'Invalid controller anti-windup',
  );
  for (const key of ['gyroFilterHz', 'dTermFilterHz', 'inputSmoothingHz', 'feedforwardFilterHz'])
    required(finite(tune[key], 0, 1000), 'Invalid controller filter');
  return tune;
}
const lowPass = (old, value, hz, dt) =>
  hz === 0 ? value : old + ((value - old) * dt) / (1 / (2 * PI * hz) + dt);
const controllerState = () => ({
  format: 'AircraftControllerState.v1',
  integral: axisZero(),
  gyro: axisZero(),
  derivative: axisZero(),
  feedforward: axisZero(),
  target: axisZero(),
  previousTarget: axisZero(),
  previousGyro: axisZero(),
  motors: [0, 0, 0, 0],
  saturated: false,
  requestedTorque: axisZero(),
  achievedTorque: axisZero(),
});

export function createAircraftController({
  aircraft: source,
  tune: sourceTune,
  groundIntegralPolicy = 'legacy',
} = {}) {
  const aircraft = validateAircraftPhysics(source),
    tune = sourceTune
      ? validateAircraftControllerTune(sourceTune)
      : createAircraftControllerTune(aircraft);
  required(
    ['legacy', 'supported-reset.v1'].includes(groundIntegralPolicy),
    'Unsupported ground integral policy',
  );
  const physicalAircraft = clone(aircraft);
  delete physicalAircraft.id;
  const identity = dataIdentity({
    backend: AIRCRAFT_CONTROLLER,
    aircraft: physicalAircraft,
    tune,
    ...(groundIntegralPolicy === 'legacy' ? {} : { groundIntegralPolicy }),
  });
  let state = controllerState();
  return {
    identity,
    capabilities: () => ({
      identity: AIRCRAFT_CONTROLLER,
      inputProcessing: 'external-rate-evaluator',
      inputUnits: 'calibrated-normalized',
      targetUnits: 'degrees-per-second',
      sensorUnits: 'radians-per-second',
      motorUnits: 'normalized-speed',
      curveCompatibility: 'provided-by-rate-evaluator',
      inputResponseCompatibility: 'independent-sim',
      controllerCompatibility: 'independent-sim',
      snapshotVersion: 'AircraftControllerState.v1',
      ...(groundIntegralPolicy === 'legacy' ? {} : { groundIntegralPolicy }),
    }),
    initialize: () => {
      state = controllerState();
    },
    reset: () => {
      state = controllerState();
    },
    step({
      controls,
      target,
      sensors,
      dt,
      voltage = aircraft.battery.fullVoltage,
      usedAh = 0,
      armed = true,
      grounded = false,
    }) {
      required(finite(dt, 0.0001, 0.02) && finite(voltage, 0, 100), 'Invalid controller substep');
      required(typeof grounded === 'boolean', 'Invalid controller support observation');
      required(
        controls &&
          AXES.every((a) => finite(controls[a], -1, 1)) &&
          finite(controls.throttle, 0, 1),
        'Calibrated controls required',
      );
      required(
        target &&
          AXES.every((a) => finite(target[a], -10000, 10000)) &&
          finite(target.throttle, 0, 1),
        'Finite commanded rates required',
      );
      required(
        sensors && AXES.every((a) => finite(sensors[a], -1e6, 1e6)),
        'Current body sensors required',
      );
      // Ground reaction can prevent rotation even when the motors can deliver
      // the requested torque. Motor-allocation anti-windup cannot observe that
      // constraint. Clear only the stored integral while supported; retain the
      // proportional/derivative/feedforward response and all airborne Airmode.
      const resetIntegral = groundIntegralPolicy === 'supported-reset.v1' && grounded;
      const torque = axisZero();
      for (const axis of AXES) {
        const gains = tune.gains[axis];
        state.gyro[axis] = lowPass(state.gyro[axis], sensors[axis], tune.gyroFilterHz, dt);
        state.target[axis] = lowPass(
          state.target[axis],
          (target[axis] * PI) / 180,
          tune.inputSmoothingHz,
          dt,
        );
        state.feedforward[axis] = lowPass(
          state.feedforward[axis],
          (state.target[axis] - state.previousTarget[axis]) / dt,
          tune.feedforwardFilterHz,
          dt,
        );
        state.derivative[axis] = lowPass(
          state.derivative[axis],
          (state.gyro[axis] - state.previousGyro[axis]) / dt,
          tune.dTermFilterHz,
          dt,
        );
        const error = state.target[axis] - state.gyro[axis];
        state.integral[axis] = resetIntegral
          ? 0
          : clamp(
              state.integral[axis] + gains.i * error * dt,
              -tune.integralLimit,
              tune.integralLimit,
            );
        torque[axis] =
          gains.p * error +
          state.integral[axis] -
          gains.d * state.derivative[axis] +
          gains.feedforward * state.feedforward[axis];
        state.previousGyro[axis] = state.gyro[axis];
        state.previousTarget[axis] = state.target[axis];
      }
      if (voltage <= 0 || !armed) {
        state = controllerState();
        return { motors: [...state.motors], saturated: false };
      }
      const collective =
        4 *
        aircraftMotorPoint(aircraft, target.throttle * aircraft.motorOutputLimit, voltage).thrust;
      const allocation = allocateAircraftThrust(aircraft, { collective, torque, voltage, armed });
      const electrical = aircraftElectricalPoint(
        aircraft,
        allocation.motors.map((speed) => speed * aircraft.motorOutputLimit),
        usedAh,
      );
      const actual = aircraftBodyForces(aircraft, electrical).torque;
      const achieved = { roll: -actual.z, pitch: -actual.x, yaw: -actual.y };
      if (!resetIntegral)
        for (const axis of AXES)
          state.integral[axis] = clamp(
            state.integral[axis] + tune.antiWindup * (achieved[axis] - torque[axis]) * dt,
            -tune.integralLimit,
            tune.integralLimit,
          );
      state.motors = allocation.motors.map((v) => clamp(v, 0, 1));
      state.saturated = allocation.saturated || electrical.currentLimited;
      state.requestedTorque = torque;
      state.achievedTorque = achieved;
      return { motors: [...state.motors], saturated: state.saturated };
    },
    telemetry: () => clone(state),
    snapshot: () => ({ identity, state: clone(state) }),
    restore(snapshot) {
      const next = boundedJSON(snapshot, { maxBytes: 8192, maxNodes: 100, maxDepth: 5 });
      exactKeys(next, ['identity', 'state'], 'Aircraft controller snapshot');
      required(
        next.identity === identity && next.state?.format === 'AircraftControllerState.v1',
        'Aircraft controller snapshot mismatch',
      );
      exactKeys(next.state, Object.keys(controllerState()), 'Aircraft controller state');
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
        exactKeys(next.state[key], AXES, 'Controller state axes');
        required(
          AXES.every((a) => finite(next.state[key][a], -1e9, 1e9)),
          'Invalid controller state',
        );
      }
      required(
        Array.isArray(next.state.motors) &&
          next.state.motors.length === 4 &&
          next.state.motors.every((v) => finite(v, 0, 1)) &&
          typeof next.state.saturated === 'boolean',
        'Invalid controller motor state',
      );
      state = next.state;
    },
  };
}

/** Same force and electrical evaluator as flight. This is an estimated static
 * performance card, not an empirical flight-performance certification. */
export function aircraftPerformance(source, { usedAh = 0 } = {}) {
  const aircraft = validateAircraftPhysics(source);
  const full = aircraftElectricalPoint(aircraft, [1, 1, 1, 1], usedAh);
  const weight = aircraft.mass * 9.81;
  let low = 0,
    high = 1;
  for (let n = 0; n < 32; n++) {
    const middle = (low + high) / 2;
    const point = aircraftElectricalPoint(aircraft, Array(4).fill(middle), usedAh);
    if (point.thrusts.reduce((sum, force) => sum + force, 0) < weight) low = middle;
    else high = middle;
  }
  return {
    thrustToWeight: full.thrusts.reduce((sum, force) => sum + force, 0) / weight,
    hoverThrottle:
      full.thrusts.reduce((sum, force) => sum + force, 0) >= weight
        ? (low + high) / (2 * aircraft.motorOutputLimit)
        : null,
    fullThrottleCurrent: full.current,
    fullThrottleVoltage: full.voltage,
  };
}
