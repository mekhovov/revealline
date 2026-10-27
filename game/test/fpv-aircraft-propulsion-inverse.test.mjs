import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createSyntheticPropulsionEvidence,
  PROPULSION_EVIDENCE_FIELDS,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';
import {
  solveStaticQuadCommandCell,
  STATIC_QUAD_INVERSE_FORMAT,
  STATIC_QUAD_INVERSE_NUMERICS,
} from '../../optional-practice/civilian-fpv/propulsion-inverse.mjs';

const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const zero = () => ({ x: 0, y: 0, z: 0 });
const empty = () => Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((key) => [key, null]));
const next = (value, up = true) => {
  if (value === 0) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + (up === value > 0 ? 1n : -1n));
  return view.getFloat64(0);
};
// Invented affine command channels and linear voltage scaling. All numbers are
// test oracles, not observations or recommended aircraft coefficients.
function surface({
  thrust = 4,
  torque = 0.25,
  thrustOffset = 0,
  torqueOffset = 0,
  unit = 'normalized',
  commands,
  voltages = [4, 8],
} = {}) {
  const values =
    commands ?? (unit === 'us' ? [1000, 2000] : unit === 'percent' ? [0, 100] : [0, 1]);
  return {
    format: 'PropulsionSurface.v1',
    id: 'invented-inverse-surface',
    name: 'Invented inverse oracle',
    currentBasis: 'dc-input-at-recorded-voltage',
    paths: values.map((command, index) => {
      const path = createSyntheticPropulsionEvidence();
      path.id = `invented-command-${index}`;
      path.components.esc = 'Invented ESC';
      path.components.escFirmware = 'Invented firmware';
      path.units.command = unit;
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
          rpm: 10 + 10 * index,
          current: 1,
          thrust: ((thrustOffset + thrust * index) * voltage) / 4,
          torque: ((torqueOffset + torque * index) * voltage) / 4,
        },
        uncertainty: empty(),
      }));
      return path;
    }),
    cells: values.slice(1).flatMap((_, c) => voltages.slice(1).map((_, v) => [c, v])),
  };
}
function quad() {
  return {
    format: STATIC_QUAD_INVERSE_FORMAT,
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
    supply: { kind: 'ideal-fixed-terminal-voltage', voltage: 4 },
    rotors: [
      [-0.5, -0.5, 1],
      [0.5, -0.5, -1],
      [0.5, 0.5, 1],
      [-0.5, 0.5, -1],
    ].map(([x, z, reactionDirection], i) => ({
      id: `rotor-${i}`,
      position: { x, y: 0, z },
      reactionDirection,
      commandUnit: 'normalized',
      cell: [0, 0],
      surface: surface(),
    })),
    target: { force: { x: 0, y: 8, z: 0 }, torque: zero() },
  };
}
function oracle(input, fractions, parameters = {}) {
  const target = { force: zero(), torque: zero() },
    {
      thrust = [4, 4, 4, 4],
      torque = [0.25, 0.25, 0.25, 0.25],
      thrustOffset = [0, 0, 0, 0],
      torqueOffset = [0, 0, 0, 0],
    } = parameters;
  input.rotors.forEach(({ position, reactionDirection }, i) => {
    const force = ((thrustOffset[i] + thrust[i] * fractions[i]) * input.supply.voltage) / 4,
      reaction = ((torqueOffset[i] + torque[i] * fractions[i]) * input.supply.voltage) / 4;
    // Independent vector cross product r × (0, force, 0).
    target.force.y += force;
    target.torque.x += position.y * 0 - position.z * force;
    target.torque.y += position.z * 0 - position.x * 0 + reactionDirection * reaction;
    target.torque.z += position.x * force - position.y * 0;
  });
  return target;
}
const everySample = (input, fn) =>
  input.rotors.forEach((rotor, i) =>
    rotor.surface.paths.forEach((path, c) =>
      path.samples.forEach((sample) => fn(sample.values, i, c)),
    ),
  );

test('symmetric hover allocation follows an independently solved command matrix', () => {
  const result = solveStaticQuadCommandCell(quad());
  assert.equal(result.status, 'solved');
  assert.deepEqual(
    result.commands.map(({ value }) => value),
    [0.5, 0.5, 0.5, 0.5],
  );
  assert.deepEqual(result.forward.wrench, quad().target);
  assert.equal(result.forward.load.load.operatingPoint.voltage, 4);
  assert.equal(result.forward.power.batteryLossWatts, 0);
  assert.equal(result.flightEligible, false);
  assert.equal(result.resultKind, 'calculated');
  assert.equal(result.assumptions.supply, 'ideal-fixed-terminal-voltage-no-sag');
  assert.equal(result.assumptions.commandDomain, 'surface-command-not-motor-speed');
  assert.equal(result.sourceReceiptContext, 'lower-command-endpoints');
  assert.deepEqual(
    result.sources.map(({ command }) => command),
    [0, 0, 0, 0],
  );
  assert.deepEqual(result.residual.errors, [0, 0, 0, 0]);
});

test('positive and negative body moments match a closed-form symmetric inverse', () => {
  for (const axis of ['x', 'y', 'z'])
    for (const sign of [-1, 1]) {
      const input = quad();
      input.target.torque[axis] = sign * 0.125;
      const { x, y, z } = input.target.torque;
      const expected = [
        0.5 + x / 8 + y - z / 8,
        0.5 + x / 8 - y + z / 8,
        0.5 - x / 8 + y + z / 8,
        0.5 - x / 8 - y - z / 8,
      ];
      const result = solveStaticQuadCommandCell(input);
      assert.equal(result.status, 'solved', axis);
      result.commands.forEach(({ value }, i) => near(value, expected[i]));
      for (const coordinate of ['x', 'y', 'z'])
        near(result.forward.wrench.torque[coordinate], input.target.torque[coordinate]);
    }
});

test('asymmetric geometry, offsets and individual torque slopes retain exact component contributions', () => {
  const input = quad(),
    positions = [
      [-0.25, -0.5],
      [0.75, -0.25],
      [0.5, 0.75],
      [-0.5, 0.5],
    ],
    parameters = {
      thrust: [2, 4, 8, 16],
      torque: [0.125, 0.5, 0.25, 1],
      thrustOffset: [0.25, 0.5, 0.125, 0.75],
      torqueOffset: [0.03125, 0.0625, 0.125, 0.25],
    },
    fractions = [0.25, 0.5, 0.75, 0.125];
  input.rotors.forEach((rotor, i) => {
    rotor.position = { x: positions[i][0], y: i * 0.125, z: positions[i][1] };
    rotor.surface = surface(
      Object.fromEntries(Object.entries(parameters).map(([field, values]) => [field, values[i]])),
    );
  });
  input.supply.voltage = 6;
  input.target = oracle(input, fractions, parameters);
  const result = solveStaticQuadCommandCell(input);
  assert.equal(result.status, 'solved');
  result.commands.forEach(({ value }, i) => near(value, fractions[i]));
  for (const field of ['force', 'torque'])
    for (const axis of ['x', 'y', 'z'])
      near(result.forward.wrench[field][axis], input.target[field][axis]);
  input.rotors.reverse();
  const reordered = solveStaticQuadCommandCell(input);
  assert.equal(reordered.status, 'solved');
  reordered.commands.forEach(({ value }, i) => near(value, fractions[3 - i]));
  assert.notEqual(reordered.identity, result.identity);
});

test('mixed canonical command units use cell fractions without assuming motor speed', () => {
  const input = quad();
  input.rotors[0].surface = surface({ unit: 'us' });
  input.rotors[0].commandUnit = 'us';
  input.rotors[2].surface = surface({ unit: 'percent' });
  const result = solveStaticQuadCommandCell(input);
  assert.equal(result.status, 'solved');
  assert.deepEqual(
    result.commands.map(({ value, unit }) => [value, unit]),
    [
      [1500, 'us'],
      [0.5, 'normalized'],
      [0.5, 'normalized'],
      [0.5, 'normalized'],
    ],
  );
  input.rotors[0].commandUnit = 'normalized';
  assert.throws(() => solveStaticQuadCommandCell(input), /unit must match/);
});

test('exact command boundaries and adjacent representable targets never clamp an outside solution', () => {
  for (const force of [0, 16, next(16, false)]) {
    const input = quad();
    input.target.force.y = force;
    const result = solveStaticQuadCommandCell(input);
    assert.equal(result.status, 'solved', String(force));
    result.commands.forEach(({ value }) => assert.equal(value, force / 16));
  }
  for (const force of [next(16), -Number.MIN_VALUE, -1]) {
    const input = quad();
    input.target.force.y = force;
    const result = solveStaticQuadCommandCell(input);
    assert.equal(result.reason, 'outside-selected-command-cells', String(force));
    assert.equal(result.commands, null);
    assert.equal(result.flightEligible, false);
  }
});

test('voltage endpoints and interior are exact; an adjacent value outside the chosen cell is unavailable', () => {
  for (const voltage of [4, 6, 8]) {
    const input = quad();
    input.supply.voltage = voltage;
    input.target = oracle(input, [0.5, 0.5, 0.5, 0.5]);
    assert.equal(solveStaticQuadCommandCell(input).status, 'solved');
  }
  for (const voltage of [next(4, false), next(8)]) {
    const input = quad();
    input.supply.voltage = voltage;
    const result = solveStaticQuadCommandCell(input);
    assert.equal(result.reason, 'voltage-outside-selected-cell');
    assert.equal(result.rotorIndex, 0);
  }
});

test('a selected hole stays unavailable even when its two exact command paths are covered', () => {
  const input = quad();
  input.rotors[0].surface = surface({ commands: [0, 0.5, 1] });
  input.rotors[0].surface.cells = [[1, 0]];
  assert.equal(solveStaticQuadCommandCell(input).reason, 'cell-not-admitted');
  input.rotors[0].cell = [9, 0];
  assert.throws(() => solveStaticQuadCommandCell(input), /index outside/);
  input.rotors[0].cell = [0.5, 0];
  assert.throws(() => solveStaticQuadCommandCell(input), /explicit command/);
});

test('degenerate and weak-axis matrices fail before presenting usable commands', () => {
  const singular = quad();
  singular.rotors.forEach((rotor) => {
    rotor.reactionDirection = 1;
  });
  assert.equal(solveStaticQuadCommandCell(singular).reason, 'singular-allocation');
  for (const weak of ['yaw', 'arm']) {
    const input = quad();
    input.rotors.forEach((rotor) => {
      if (weak === 'yaw') rotor.surface = surface({ torque: 1e-10 });
      else {
        rotor.position.x *= 1e-10;
        rotor.position.z *= 1e-10;
      }
    });
    const result = solveStaticQuadCommandCell(input);
    assert.equal(result.reason, 'ill-conditioned-allocation', weak);
    assert.equal(result.commands, null);
    assert.equal(result.numerics.forceScaleN, 1);
    assert.equal(result.numerics.torqueScaleNm, 1);
  }
  const zeroSlope = quad();
  zeroSlope.rotors[1].surface = surface({ thrust: 0 });
  assert.equal(solveStaticQuadCommandCell(zeroSlope).reason, 'non-increasing-cell-thrust');
  zeroSlope.rotors[1].surface = surface({ thrustOffset: 4, thrust: -2 });
  assert.equal(solveStaticQuadCommandCell(zeroSlope).reason, 'non-increasing-cell-thrust');
});

test('an unrepresentable interior command is unavailable without rounding to a boundary', () => {
  const input = quad();
  input.rotors[0].surface = surface({ unit: 'us', commands: [1000, next(1000)] });
  input.rotors[0].commandUnit = 'us';
  const result = solveStaticQuadCommandCell(input);
  assert.equal(result.reason, 'command-resolution');
  assert.equal(result.rotorIndex, 0);
  assert.equal(result.commands, null);
});

test('missing, negative or ineligible endpoint evidence is retained as an unavailable receipt', () => {
  for (const field of ['rpm', 'thrust', 'torque', 'current']) {
    const input = quad();
    everySample(input, (values) => {
      values[field] = null;
    });
    const result = solveStaticQuadCommandCell(input);
    assert.equal(result.reason, 'cell-endpoint-unavailable', field);
    assert.equal(result.forward.status, 'unavailable');
    assert.equal(result.commands, null);
    assert.ok(
      result.sources.every((source) =>
        source.paths.every(({ source: item }) => item.kind === 'synthetic'),
      ),
    );
  }
  for (const edit of [
    (input) =>
      everySample(input, (values) => {
        values.thrust = -1;
      }),
    (input) => {
      input.rotors[0].surface.currentBasis = 'phase-current';
    },
    (input) =>
      everySample(input, (values) => {
        values.airspeed = null;
      }),
  ]) {
    const input = quad();
    edit(input);
    assert.equal(solveStaticQuadCommandCell(input).reason, 'cell-endpoint-unavailable');
  }
});

test('an interpolated power inconsistency cannot pass just because both endpoints passed', () => {
  const input = quad();
  everySample(input, (values, i, c) => {
    values.rpm = c * 10000;
    values.torque = 0.1 * (1 - c);
    values.current = 0.1;
  });
  const result = solveStaticQuadCommandCell(input);
  assert.equal(result.reason, 'forward-check-unavailable');
  assert.equal(result.forward.reason, 'operating-power-inconsistent');
  assert.equal(result.commands, null);
  assert.equal(result.flightEligible, false);
});

test('zero and near-zero requested moments use explicit absolute residual limits', () => {
  for (const yaw of [0, Number.MIN_VALUE, 1e-14]) {
    const input = quad();
    input.target.torque.y = yaw;
    const result = solveStaticQuadCommandCell(input);
    assert.equal(result.status, 'solved');
    result.residual.errors.forEach((error, i) => {
      assert.ok(Number.isFinite(error));
      assert.ok(Math.abs(error) <= result.residual.tolerances[i]);
    });
    assert.ok(
      result.residual.tolerances[2] >= STATIC_QUAD_INVERSE_NUMERICS.torqueAbsoluteToleranceNm,
    );
  }
});

test('body coordinates, ideal supply and complete SI declarations are explicit', () => {
  for (const edit of [
    (input) => {
      input.frame = 'pilot-roll-pitch-yaw';
    },
    (input) => {
      input.thrustAxis = 'negative-y';
    },
    (input) => {
      input.torqueBasis = 'electromagnetic';
    },
    (input) => {
      input.units.position = 'mm';
    },
    (input) => {
      input.supply.kind = 'battery';
    },
    (input) => {
      input.supply.resistance = 0.1;
    },
    (input) => {
      input.rotors[1].id = input.rotors[0].id;
    },
    (input) => {
      delete input.target.torque.z;
    },
    (input) => {
      input.rotors[0].position.x = Infinity;
    },
  ]) {
    const input = quad();
    edit(input);
    assert.throws(() => solveStaticQuadCommandCell(input));
  }
  const lateral = quad();
  lateral.target.force.x = 1;
  assert.equal(solveStaticQuadCommandCell(lateral).reason, 'unsupported-lateral-force');
});

test('known condition conflicts remain unavailable and unknown conditions remain explicit', () => {
  const input = quad();
  input.rotors.forEach((rotor) =>
    rotor.surface.paths.forEach((path) => {
      path.conditions.airDensityKgM3 = null;
    }),
  );
  const unknown = solveStaticQuadCommandCell(input);
  assert.equal(unknown.status, 'solved');
  assert.equal(unknown.forward.assumptions.environment, 'partially-unknown');
  input.rotors[0].surface.paths.forEach((path) => {
    path.conditions.airDensityKgM3 = 1;
  });
  input.rotors[1].surface.paths.forEach((path) => {
    path.conditions.airDensityKgM3 = 2;
  });
  const conflict = solveStaticQuadCommandCell(input);
  assert.equal(conflict.reason, 'cell-endpoint-unavailable');
  assert.equal(conflict.forward.reason, 'incompatible-rotor-conditions');
});

test('inputs, identities, source metadata and receipts are detached and immutable', () => {
  const input = quad(),
    before = structuredClone(input),
    result = solveStaticQuadCommandCell(input);
  assert.deepEqual(input, before);
  assert.deepEqual(solveStaticQuadCommandCell(JSON.stringify(input)), result);
  input.rotors[0].surface.paths[0].source.title = 'changed later';
  assert.notEqual(result.sources[0].paths[0].source.title, 'changed later');
  assert.notEqual(solveStaticQuadCommandCell(input).identity, result.identity);
  assert.throws(() => {
    result.commands[0].value = 0;
  });
  assert.throws(() => {
    result.input.rotors[0].position.x = 5;
  });
  assert.throws(() => {
    result.sources[0].paths[0].source.title = 'change';
  });
  assert.throws(() => solveStaticQuadCommandCell({ ...quad(), extra: true }));
  const accessor = quad();
  Object.defineProperty(accessor, 'format', {
    enumerable: true,
    get() {
      throw new Error('must not call');
    },
  });
  assert.throws(() => solveStaticQuadCommandCell(accessor), /accessors.*hidden fields/i);
  const cycle = quad();
  cycle.supply.self = cycle;
  assert.throws(() => solveStaticQuadCommandCell(cycle), /cycle/i);
  assert.throws(() => solveStaticQuadCommandCell(' '.repeat(2 * 1024 * 1024)), /budget/i);
});

test('inverse module remains outside every existing live integration entry point', async () => {
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
    assert.doesNotMatch(source, /from\s+['"].*propulsion-inverse\.mjs['"]/);
  }
});
