import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROPULSION_EVIDENCE_FIELDS,
  createSyntheticPropulsionEvidence,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';
import {
  STATIC_QUAD_PROPULSION_FORMAT,
  STATIC_QUAD_RESULT_FORMAT,
  evaluateStaticQuadPropulsion,
} from '../../optional-practice/civilian-fpv/propulsion-quad.mjs';

const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const empty = () => Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((field) => [field, null]));
// Invented affine loads and bilinear rotor channels; no manufacturer data.
function surface({ commandUnit = 'normalized', voltages = [0, 4, 8], cells } = {}) {
  const commands = commandUnit === 'us' ? [1000, 1500, 2000] : [0, 0.5, 1];
  return {
    format: 'PropulsionSurface.v1',
    id: 'synthetic-quad-oracle',
    name: 'Invented static quad surface',
    currentBasis: 'dc-input-at-recorded-voltage',
    paths: commands.map((command, index) => {
      const path = createSyntheticPropulsionEvidence(),
        c = index / 2;
      path.id = `invented-quad-command-${index}`;
      path.components.esc = 'Invented ESC';
      path.components.escFirmware = 'Invented firmware';
      path.units.command = commandUnit;
      path.domain = {
        kind: 'one-dimensional-path',
        axis: 'voltage',
        intervals: [[voltages[0], voltages.at(-1)]],
      };
      path.samples = voltages.map((voltage) => ({
        values: {
          command,
          voltage,
          airspeed: 0,
          current: (1 + c) * voltage + c,
          thrust: 2 * c * voltage,
          torque: 0.001 * c * voltage,
          rpm: 100 * c * voltage,
        },
        uncertainty: empty(),
      }));
      return path;
    }),
    cells: cells ?? commands.slice(1).flatMap((_, c) => voltages.slice(1).map((_, v) => [c, v])),
  };
}
function quad(commands = [0.5, 0.5, 0.5, 0.5]) {
  return {
    format: STATIC_QUAD_PROPULSION_FORMAT,
    frame: 'body-x-right-y-up-z-rear-origin-com',
    thrustAxis: 'positive-y',
    torqueBasis: 'steady-shaft-reaction-magnitude',
    units: {
      position: 'm',
      force: 'N',
      torque: 'N*m',
      voltage: 'V',
      current: 'A',
      resistance: 'ohm',
    },
    battery: { openVoltage: 6, resistance: 0.1, currentLimit: null },
    rotors: [
      [-0.2, -0.3, 1],
      [0.2, -0.3, -1],
      [0.2, 0.3, 1],
      [-0.2, 0.3, -1],
    ].map(([x, z, reactionDirection], index) => ({
      id: `rotor-${index}`,
      position: { x, y: 0, z },
      reactionDirection,
      command: { value: commands[index], unit: 'normalized' },
      surface: surface(),
    })),
  };
}
const calculate = (edit = () => {}) => {
  const input = quad();
  edit(input);
  return evaluateStaticQuadPropulsion(input);
};
const everySample = (input, fn) =>
  input.rotors.forEach((rotor) => rotor.surface.paths.forEach((path) => path.samples.forEach(fn)));

test('symmetric quad matches an independent affine circuit and cancels every moment', () => {
  const result = evaluateStaticQuadPropulsion(quad());
  const voltage = (6 - 0.1 * 2) / (1 + 0.1 * 6); // ΣI = 6V + 2.
  assert.equal(result.status, 'solved');
  assert.equal(result.format, STATIC_QUAD_RESULT_FORMAT);
  assert.equal(result.resultKind, 'calculated');
  assert.equal(result.flightEligible, false);
  assert.equal(result.assumptions.torqueBasis, 'caller-declared-not-verified');
  assert.equal(result.assumptions.allocation, 'not-performed');
  near(result.load.load.operatingPoint.voltage, voltage);
  near(result.load.load.operatingPoint.current, 6 * voltage + 2);
  near(result.wrench.force.y, 4 * voltage);
  assert.deepEqual(result.wrench.torque, { x: 0, y: 0, z: 0 });
  near(result.power.supplyWatts, result.power.electricalWatts + result.power.batteryLossWatts);
  near(result.power.batteryLossWatts, 0.1 * (6 * voltage + 2) ** 2);
  near(result.power.shaftWatts, 4 * 0.0005 * voltage * ((50 * voltage * 2 * Math.PI) / 60));
  assert.deepEqual(
    result.input.rotors.map((rotor) => rotor.index),
    [0, 1, 2, 3],
  );
  assert.equal(
    result.load.sources.every((source) =>
      source.paths.every((path) => path.source.kind === 'synthetic'),
    ),
    true,
  );
});

test('each individually commanded rotor matches the vector cross-product oracle and declared reaction sign', () => {
  for (let active = 0; active < 4; active++) {
    const input = quad([0, 0, 0, 0]);
    input.rotors[active].command.value = 1;
    input.rotors[active].position.y = 0.4;
    input.battery.resistance = 0;
    const result = evaluateStaticQuadPropulsion(input),
      p = input.rotors[active].position,
      f = { x: 0, y: 12, z: 0 },
      cross = {
        x: p.y * f.z - p.z * f.y,
        y: p.z * f.x - p.x * f.z,
        z: p.x * f.y - p.y * f.x,
      };
    near(result.wrench.force.y, 12);
    near(result.wrench.torque.x, cross.x);
    near(result.wrench.torque.z, cross.z);
    near(result.wrench.torque.y, cross.y + input.rotors[active].reactionDirection * 0.006);
    input.rotors[active].reactionDirection *= -1;
    const reversed = evaluateStaticQuadPropulsion(input);
    near(reversed.wrench.torque.y, -result.wrench.torque.y);
    assert.equal(reversed.wrench.torque.x, result.wrench.torque.x);
    assert.equal(reversed.wrench.torque.z, result.wrench.torque.z);
  }
});

test('asymmetric commands retain individual contributions and caller rotor order', () => {
  const commands = [0.1, 0.25, 0.75, 0.9],
    input = quad(commands),
    result = evaluateStaticQuadPropulsion(input),
    sum = commands.reduce((a, b) => a + b, 0),
    voltage = (6 - 0.1 * sum) / (1 + 0.1 * (4 + sum));
  near(result.load.load.operatingPoint.voltage, voltage);
  near(result.wrench.force.y, 2 * voltage * sum);
  near(
    result.wrench.torque.x,
    0.3 * 2 * voltage * (commands[0] + commands[1] - commands[2] - commands[3]),
  );
  near(
    result.wrench.torque.z,
    0.2 * 2 * voltage * (-commands[0] + commands[1] + commands[2] - commands[3]),
  );
  near(
    result.wrench.torque.y,
    0.001 * voltage * (commands[0] - commands[1] + commands[2] - commands[3]),
  );
  input.rotors.reverse();
  const reordered = evaluateStaticQuadPropulsion(input);
  for (const type of ['force', 'torque'])
    for (const axis of ['x', 'y', 'z'])
      near(reordered.wrench[type][axis], result.wrench[type][axis]);
  assert.deepEqual(
    reordered.input.rotors.map((rotor) => rotor.id),
    ['rotor-3', 'rotor-2', 'rotor-1', 'rotor-0'],
  );
  assert.notEqual(reordered.identity, result.identity);
});

test('current-limit excess remains an unchanged unregulated diagnostic calculation', () => {
  const original = evaluateStaticQuadPropulsion(quad()),
    limited = calculate((input) => {
      input.battery.currentLimit = 1;
    });
  assert.equal(limited.status, 'limit-exceeded');
  assert.equal(limited.reason, 'unregulated-current-exceeds-limit');
  assert.equal(limited.flightEligible, false);
  assert.deepEqual(limited.wrench, original.wrench);
  assert.deepEqual(limited.power, original.power);
  assert.deepEqual(limited.rotors, original.rotors);
  assert.equal(limited.load.load.operatingPoint.current, original.load.load.operatingPoint.current);
});

test('missing or negative operating channels preserve evidence and yield no usable wrench', () => {
  for (const channel of ['rpm', 'thrust', 'torque', 'current']) {
    const result = calculate((input) =>
      everySample(input, (sample) => {
        sample.values[channel] = null;
      }),
    );
    assert.equal(result.status, 'unavailable', channel);
    assert.equal(result.wrench, null);
    assert.equal(result.power, null);
    assert.equal(result.flightEligible, false);
    assert.match(result.reason, /unavailable/);
  }
  for (const channel of ['thrust', 'torque', 'current']) {
    const result = calculate((input) =>
      everySample(input, (sample) => {
        sample.values[channel] = -1;
      }),
    );
    assert.equal(result.status, 'unavailable', channel);
    assert.equal(result.wrench, null);
    assert.match(result.reason, /negative/);
    assert.equal(result.flightEligible, false);
  }
});

test('power-inconsistent operating values remain visible but never become a wrench', () => {
  const result = calculate((input) =>
    everySample(input, (sample) => {
      sample.values.torque = 10;
      sample.values.rpm = 10000;
    }),
  );
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'operating-power-inconsistent');
  assert.equal(result.rotorIndex, 0);
  assert.equal(result.wrench, null);
  assert.equal(result.rotors[0].point.values.torque, 10);
  assert.equal(result.rotors[0].point.values.rpm, 10000);
  assert.ok(
    result.diagnostics.some(
      (item) => item.code === 'shaft-power-exceeds-electrical-central-values',
    ),
  );
});

test('microsecond commands stay in source units and cannot be treated as normalized motor speed', () => {
  const input = quad();
  for (const rotor of input.rotors) {
    rotor.surface = surface({ commandUnit: 'us' });
    rotor.command = { unit: 'us', value: 1500 };
  }
  const result = evaluateStaticQuadPropulsion(input);
  assert.deepEqual(result.wrench, evaluateStaticQuadPropulsion(quad()).wrench);
  assert.deepEqual(
    result.input.rotors.map((rotor) => rotor.command),
    Array.from({ length: 4 }, () => ({ unit: 'us', value: 1500 })),
  );
  input.rotors[0].command.unit = 'normalized';
  assert.throws(() => evaluateStaticQuadPropulsion(input), /canonical command unit/);
  input.rotors[0].command = { unit: 'us', value: 0.5 };
  assert.equal(evaluateStaticQuadPropulsion(input).reason, 'command-outside-coverage');
});

test('coverage gaps, outside-domain commands, unknown current basis and nonstatic data stay unavailable', () => {
  const cases = [
    [
      'gap',
      (input) => {
        input.rotors[0].command.value = 0.25;
        input.rotors[0].surface.cells = [
          [1, 0],
          [1, 1],
        ];
      },
      'command-outside-coverage',
    ],
    [
      'outside voltage',
      (input) => {
        input.battery.openVoltage = 9;
        input.battery.resistance = 0;
      },
      'root-above-coverage',
    ],
    [
      'outside command',
      (input) => {
        input.rotors[0].command.value = 1.0000000000000002;
      },
      'command-outside-coverage',
    ],
    [
      'current basis',
      (input) => {
        input.rotors[0].surface.currentBasis = 'phase-current';
      },
      'dc-input-current-required',
    ],
    [
      'flow',
      (input) =>
        input.rotors[0].surface.paths.forEach((path) => {
          path.conditions.flow = 'axial';
        }),
      'static-flow-required',
    ],
    [
      'unknown airspeed',
      (input) =>
        everySample(input, (sample) => {
          sample.values.airspeed = null;
        }),
      'known-zero-airspeed-required',
    ],
  ];
  for (const [label, edit, reason] of cases) {
    const result = calculate(edit);
    assert.equal(result.status, 'unavailable', label);
    assert.equal(result.reason, reason, label);
    assert.equal(result.wrench, null);
    assert.equal(result.flightEligible, false);
  }
});

test('schema requires explicit axes, COM origin, torque declaration, units and four unique rotor records', () => {
  const edits = [
    (value) => {
      delete value.frame;
    },
    (value) => {
      value.frame = 'world';
    },
    (value) => {
      value.thrustAxis = 'negative-y';
    },
    (value) => {
      delete value.torqueBasis;
    },
    (value) => {
      value.torqueBasis = 'motor-command';
    },
    (value) => {
      value.units.position = 'mm';
    },
    (value) => {
      value.units.voltage = 'mV';
    },
    (value) => {
      value.rotors.pop();
    },
    (value) => {
      value.rotors.push(structuredClone(value.rotors[0]));
    },
    (value) => {
      value.rotors[1].id = value.rotors[0].id;
    },
    (value) => {
      value.rotors[0].position.x = 2.01;
    },
    (value) => {
      value.rotors[0].position.z = NaN;
    },
    (value) => {
      value.rotors[0].reactionDirection = 0;
    },
    (value) => {
      value.rotors[0].command.value = Infinity;
    },
    (value) => {
      value.battery.resistance = -1;
    },
    (value) => {
      value.battery.currentLimit = -1;
    },
    (value) => {
      value.units.extra = 'ignored';
    },
    (value) => {
      delete value.rotors[1];
    },
    (value) => {
      value.rotors[0].surface.evaluate = () => {};
    },
  ];
  for (const edit of edits) {
    const input = quad();
    edit(input);
    assert.throws(() => evaluateStaticQuadPropulsion(input), TypeError);
  }
});

test('source input is copied without executing getters and returned provenance is immutable', () => {
  const input = quad(),
    original = JSON.stringify(input),
    result = evaluateStaticQuadPropulsion(input);
  assert.equal(JSON.stringify(input), original);
  assert.deepEqual(evaluateStaticQuadPropulsion(original), result);
  assert.deepEqual(evaluateStaticQuadPropulsion(input), result);
  assert.throws(() => {
    result.input.rotors[0].position.x = 0;
  }, TypeError);
  assert.throws(() => {
    result.load.sources[0].paths[0].source.kind = 'measured';
  }, TypeError);
  assert.throws(() => {
    result.rotors[0].point.values.current = 0;
  }, TypeError);
  input.rotors[0].position.x = 0;
  assert.equal(result.input.rotors[0].position.x, -0.2);
  assert.notEqual(evaluateStaticQuadPropulsion(input).identity, result.identity);
  let read = false;
  Object.defineProperty(input, 'frame', {
    enumerable: true,
    get() {
      read = true;
      return 'world';
    },
  });
  assert.throws(() => evaluateStaticQuadPropulsion(input), TypeError);
  assert.equal(read, false);
});

test('known cross-rotor condition conflicts refuse a wrench; unknown conditions stay explicit', () => {
  const conditions = {
    airDensityKgM3: 1.2,
    temperatureC: 20,
    pressurePa: 101325,
    humidityRatio: 0.5,
    installation: 'Invented identical open static mount',
  };
  const declared = () => {
    const input = quad();
    for (const rotor of input.rotors)
      for (const path of rotor.surface.paths) Object.assign(path.conditions, conditions);
    return input;
  };
  const complete = evaluateStaticQuadPropulsion(declared());
  assert.equal(complete.status, 'solved');
  for (const field of Object.keys(conditions)) {
    const input = declared();
    for (const path of input.rotors[2].surface.paths)
      path.conditions[field] =
        field === 'installation' ? 'Different bench mount' : conditions[field] / 2;
    const result = evaluateStaticQuadPropulsion(input);
    assert.equal(result.status, 'unavailable', field);
    assert.equal(result.reason, 'incompatible-rotor-conditions', field);
    assert.equal(result.wrench, null);
    assert.equal(result.power, null);
    assert.equal(result.rotorIndex, 2);
    assert.equal(result.load.status, 'solved', 'The unmodified electrical diagnostic is retained');
    assert.ok(result.diagnostics.some((item) => item.fields.includes(field)));
    assert.equal(result.flightEligible, false);
  }
  assert.equal(complete.assumptions.environment, 'declared-known-values-agree');
  const unknown = declared();
  for (const path of unknown.rotors[1].surface.paths) path.conditions.airDensityKgM3 = null;
  const partial = evaluateStaticQuadPropulsion(unknown);
  assert.equal(partial.status, 'solved');
  assert.equal(partial.assumptions.environment, 'partially-unknown');
  assert.ok(
    partial.diagnostics.some(
      (item) => item.code === 'unknown-rotor-conditions' && item.fields.includes('airDensityKgM3'),
    ),
  );
  assert.equal(partial.load.sources[1].paths[0].conditions.airDensityKgM3, null);
  for (const path of unknown.rotors[3].surface.paths) path.conditions.airDensityKgM3 = 1;
  assert.equal(
    evaluateStaticQuadPropulsion(unknown).reason,
    'incompatible-rotor-conditions',
    'An unknown rotor must not hide disagreement between other known values',
  );
  const mixed = declared();
  for (const path of mixed.rotors[2].surface.paths) {
    path.components.motor = 'Different invented motor';
    path.components.propeller = 'Different invented propeller';
    path.components.esc = 'Different invented ESC';
    path.conditions.notes = 'Different inert description';
  }
  assert.equal(evaluateStaticQuadPropulsion(mixed).status, 'solved');
});

test('adapter stays outside existing aircraft, worker and inspector dependency lists', async () => {
  for (const file of [
    'aircraft-physics.mjs',
    'advanced-aircraft-runtime.mjs',
    'advanced-worker.mjs',
    'propulsion-evidence-ui.mjs',
  ]) {
    const source = await readFile(
      new URL(`../../optional-practice/civilian-fpv/${file}`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(source, /from\s+['"].*propulsion-(quad|surface)\.mjs['"]/);
  }
});
