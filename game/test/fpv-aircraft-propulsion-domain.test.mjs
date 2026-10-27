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
} from '../../optional-practice/civilian-fpv/propulsion-inverse.mjs';
import {
  solveStaticQuadCommandDomain,
  STATIC_QUAD_DOMAIN_FORMAT,
  STATIC_QUAD_DOMAIN_LIMITS,
} from '../../optional-practice/civilian-fpv/propulsion-domain.mjs';

const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const zero = () => ({ x: 0, y: 0, z: 0 });
const next = (value, up = true) => {
  if (value === 0) return up ? Number.MIN_VALUE : -Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + (up === value > 0 ? 1n : -1n));
  return view.getFloat64(0);
};
// Entirely invented piecewise tables. These are numerical oracles, not measured
// motors, transferable aircraft coefficients or recommended controller values.
function surface({
  commands = [0, 0.5, 1],
  thrust = [0, 2, 8],
  torque = [0, 0.125, 0.5],
  voltages = [4, 8],
  unit = 'normalized',
} = {}) {
  return {
    format: 'PropulsionSurface.v1',
    id: 'invented-domain-surface',
    name: 'Invented domain oracle',
    currentBasis: 'dc-input-at-recorded-voltage',
    paths: commands.map((command, index) => {
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
          rpm: 10,
          current: 10,
          thrust: (thrust[index] * voltage) / 4,
          torque: (torque[index] * voltage) / 4,
        },
        uncertainty: Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((key) => [key, null])),
      }));
      return path;
    }),
    cells: commands.slice(1).flatMap((_, c) => voltages.slice(1).map((_, v) => [c, v])),
  };
}
function quad(options = {}) {
  return {
    format: STATIC_QUAD_DOMAIN_FORMAT,
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
      commandUnit: options.unit ?? 'normalized',
      surface: surface(options),
    })),
    target: { force: { x: 0, y: 8, z: 0 }, torque: zero() },
  };
}
// Independent known-table interpolation and r×F accumulation. It never invokes
// the production surface, forward or inverse evaluators.
function oracle(input, commands) {
  const target = { force: zero(), torque: zero() };
  input.rotors.forEach((rotor, index) => {
    const paths = rotor.surface.paths,
      command = commands[index];
    const upper = paths.findIndex((path) => path.samples[0].values.command >= command);
    const lo = Math.max(0, upper - 1),
      hi = Math.max(1, upper);
    const low = paths[lo].samples[0].values,
      high = paths[hi].samples[0].values;
    const u = (command - low.command) / (high.command - low.command);
    const force =
      ((low.thrust + u * (high.thrust - low.thrust)) * input.supply.voltage) / low.voltage;
    const reaction =
      ((low.torque + u * (high.torque - low.torque)) * input.supply.voltage) / low.voltage;
    target.force.y += force;
    target.torque.x += rotor.position.y * 0 - rotor.position.z * force;
    target.torque.y += rotor.reactionDirection * reaction;
    target.torque.z += rotor.position.x * force - rotor.position.y * 0;
  });
  return target;
}
const local = (input, cells) =>
  solveStaticQuadCommandCell({
    ...input,
    format: STATIC_QUAD_INVERSE_FORMAT,
    rotors: input.rotors.map((rotor, i) => ({ ...rotor, cell: cells[i] })),
  });
const checkSolution = (input, expected) => {
  input.target = oracle(input, expected);
  const result = solveStaticQuadCommandDomain(input);
  assert.equal(result.status, 'solved', result.reason + ':' + result.unresolved?.reason);
  result.commands.forEach(({ value }, i) => near(value, expected[i]));
  for (const field of ['force', 'torque'])
    for (const axis of ['x', 'y', 'z'])
      near(result.selection.result.forward.wrench[field][axis], input.target[field][axis]);
  return result;
};

test('piecewise commands select different cells using an independent force/torque oracle', () => {
  const input = quad(),
    result = checkSolution(input, [0.25, 0.75, 0.875, 0.125]);
  assert.deepEqual(result.selection.cells, [
    [0, 0],
    [1, 0],
    [1, 0],
    [0, 0],
  ]);
  assert.equal(result.workload.candidateCombinations, 16);
  assert.equal(result.workload.cellSolves, 16);
  assert.equal(result.flightEligible, false);
  assert.equal(result.resultKind, 'calculated');
  assert.equal(result.selection.result.forward.load.load.operatingPoint.voltage, 4);
  assert.equal(result.sourceReceiptContext, 'validation-cell-lower-command-endpoints');
  assert.equal(result.sources[0].paths[0].source.kind, 'synthetic');
});

test('asymmetric geometry, rotor-specific slopes and mixed command units retain contributions', () => {
  const input = quad(),
    positions = [
      [-0.25, -0.5],
      [0.75, -0.25],
      [0.5, 0.75],
      [-0.5, 0.5],
    ];
  input.rotors.forEach((rotor, i) => {
    rotor.position = { x: positions[i][0], y: i * 0.125, z: positions[i][1] };
    rotor.surface = surface({
      thrust: [0.25, 2 + i, 8 + i * 2],
      torque: [0.03125, 0.125 + i * 0.0625, 0.5 + i * 0.0625],
    });
  });
  input.rotors[0].commandUnit = 'us';
  input.rotors[0].surface.paths.forEach((path, i) => {
    path.units.command = 'us';
    path.samples.forEach((sample) => {
      sample.values.command = 1000 + i * 500;
    });
  });
  input.supply.voltage = 6;
  checkSolution(input, [1250, 0.75, 0.875, 0.125]);
});

test('exact shared command boundaries deduplicate with deterministic first-cell ownership', () => {
  const input = quad(),
    result = checkSolution(input, [0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(result.selection.cells, [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ]);
  assert.equal(result.workload.duplicateSolutions, 15);
  assert.deepEqual(solveStaticQuadCommandDomain(JSON.stringify(input)), result);
});

test('different near-boundary floating-point vectors are never merged by an epsilon', () => {
  const input = quad(),
    boundary = 0.4,
    positions = [
      [-0.25, -0.5],
      [0.75, -0.25],
      [0.5, 0.75],
      [-0.5, 0.5],
    ];
  input.rotors.forEach((rotor, i) => {
    const thrust = [3.1, 4.2, 5.3, 6.4][i],
      torque = [0.19, 0.23, 0.31, 0.29][i];
    rotor.position = { x: positions[i][0], y: 0, z: positions[i][1] };
    rotor.surface = surface({
      commands: [0, boundary, 1],
      thrust: [0, thrust * boundary, thrust],
      torque: [0, torque * boundary, torque],
    });
  });
  input.target = oracle(input, Array(4).fill(boundary));
  const result = solveStaticQuadCommandDomain(input);
  assert.equal(result.reason, 'ambiguous-command-solutions');
  assert.equal(result.commands, null);
  assert.notDeepEqual(result.ambiguity[0].commands, result.ambiguity[1].commands);
  for (const candidate of result.ambiguity)
    candidate.commands.forEach(({ value }) => near(value, boundary, 1e-12));
});

test('exact voltage knots collapse only the matching declared command intervals', () => {
  const input = quad({ voltages: [4, 6, 8] });
  input.supply.voltage = 6;
  const result = checkSolution(input, [0.25, 0.75, 0.875, 0.125]);
  assert.equal(result.workload.candidateCombinations, 16);
  assert.ok(result.input.rotors.every((rotor) => rotor.candidateCells.every(([, v]) => v === 0)));
  input.rotors.forEach((rotor) => {
    rotor.surface.cells = [
      [0, 1],
      [1, 1],
    ];
  });
  const upper = checkSolution(input, [0.25, 0.75, 0.875, 0.125]);
  assert.ok(upper.input.rotors.every((rotor) => rotor.candidateCells.every(([, v]) => v === 1)));
  input.rotors[0].surface.cells.push([1, 0]);
  assert.throws(() => solveStaticQuadCommandDomain(input), /unique and sorted/);
});

test('domain endpoints and adjacent representable requests do not extrapolate or clamp', () => {
  for (const force of [0, 32, next(32, false)]) {
    const input = quad();
    input.target.force.y = force;
    assert.equal(solveStaticQuadCommandDomain(input).status, 'solved', String(force));
  }
  for (const force of [next(32), -Number.MIN_VALUE, -1]) {
    const input = quad();
    input.target.force.y = force;
    const result = solveStaticQuadCommandDomain(input);
    assert.equal(result.reason, 'no-command-domain-solution', String(force));
    assert.equal(result.commands, null);
  }
  for (const voltage of [next(4, false), next(8)]) {
    const input = quad();
    input.supply.voltage = voltage;
    const result = solveStaticQuadCommandDomain(input);
    assert.equal(result.reason, 'no-admitted-cell-at-voltage');
    assert.equal(result.workload.cellSolves, 1);
    assert.equal(result.commands, null);
  }
});

test('undeclared holes and isolated observed command paths do not become selectable cells', () => {
  const input = quad({
    commands: [0, 0.25, 0.5, 0.75, 1],
    thrust: [0, 1, 2, 3, 4],
    torque: [0, 0.0625, 0.125, 0.1875, 0.25],
  });
  input.rotors.forEach((rotor) => {
    rotor.surface.cells = [
      [0, 0],
      [3, 0],
    ];
  });
  input.target = oracle(input, [0.5, 0.5, 0.5, 0.5]);
  const result = solveStaticQuadCommandDomain(input);
  assert.equal(result.reason, 'no-command-domain-solution');
  assert.equal(result.workload.candidateCombinations, 16);
  assert.deepEqual(result.input.rotors[0].candidateCells, [
    [0, 0],
    [3, 0],
  ]);
});

test('distinct piecewise yaw solutions are ambiguous and cannot produce usable commands', () => {
  const input = quad({
    commands: [0, 0.25, 0.75, 1],
    thrust: [0, 1, 3, 4],
    torque: [0, 0.5, 0.1, 0.5],
  });
  input.target = oracle(input, [0.5, 0.5, 0.5, 0.5]);
  const other = oracle(input, [5 / 36, 31 / 36, 5 / 36, 31 / 36]);
  near(other.force.y, input.target.force.y);
  near(other.torque.y, 0);
  const result = solveStaticQuadCommandDomain(input);
  assert.equal(result.reason, 'ambiguous-command-solutions');
  assert.equal(result.commands, null);
  assert.equal(result.selection, null);
  assert.equal(result.ambiguity.length, 2);
  assert.notDeepEqual(result.ambiguity[0].commands, result.ambiguity[1].commands);
});

test('a solved cell cannot conceal a later non-increasing or numerically unresolved cell', () => {
  const input = quad();
  input.rotors[3].surface.paths[2].samples.forEach((sample, v) => {
    sample.values.thrust = input.rotors[3].surface.paths[1].samples[v].values.thrust;
  });
  input.target = oracle(input, [0.25, 0.25, 0.25, 0.25]);
  assert.equal(local(input, Array(4).fill([0, 0])).status, 'solved');
  const result = solveStaticQuadCommandDomain(input);
  assert.equal(result.reason, 'unresolved-command-cell');
  assert.equal(result.unresolved.reason, 'non-increasing-cell-thrust');
  assert.equal(result.workload.cellSolves, 2);
  assert.equal(result.commands, null);
  assert.equal(result.selection, null);
});

test('singular geometry and weak yaw authority remain unavailable', () => {
  const singular = quad();
  singular.rotors.forEach((rotor) => {
    rotor.position.z = 0;
  });
  const weak = quad();
  weak.rotors.forEach((rotor) =>
    rotor.surface.paths.forEach((path) =>
      path.samples.forEach((sample) => {
        sample.values.torque *= 1e-12;
      }),
    ),
  );
  for (const [input, reason] of [
    [singular, 'singular-allocation'],
    [weak, 'ill-conditioned-allocation'],
  ]) {
    const result = solveStaticQuadCommandDomain(input);
    assert.equal(result.reason, 'unresolved-command-cell');
    assert.equal(result.unresolved.reason, reason);
    assert.equal(result.commands, null);
  }
  const later = quad();
  later.rotors.forEach((rotor) =>
    rotor.surface.paths[2].samples.forEach((sample, v) => {
      sample.values.torque = rotor.surface.paths[1].samples[v].values.torque + 1e-12 * (v + 1);
    }),
  );
  later.target = oracle(later, [0.25, 0.25, 0.25, 0.25]);
  assert.equal(local(later, Array(4).fill([0, 0])).status, 'solved');
  const unresolved = solveStaticQuadCommandDomain(later);
  assert.equal(unresolved.unresolved.reason, 'ill-conditioned-allocation');
  assert.equal(unresolved.workload.cellSolves, 16);
  assert.equal(unresolved.commands, null);
});

test('missing later evidence and inconsistent power cannot be silently excluded from the search', () => {
  for (const missing of [true, false]) {
    const input = quad();
    input.rotors[3].surface.paths[2].samples.forEach((sample) => {
      if (missing) sample.values.torque = null;
      else sample.values.rpm = 100000;
    });
    input.target = oracle(input, [0.25, 0.25, 0.25, 0.25]);
    assert.equal(local(input, Array(4).fill([0, 0])).status, 'solved');
    const result = solveStaticQuadCommandDomain(input);
    assert.equal(result.reason, 'unresolved-command-cell');
    assert.equal(result.unresolved.reason, 'cell-endpoint-unavailable');
    assert.equal(result.commands, null);
  }
});

test('Cartesian work is bounded before enumeration and never silently truncates a larger domain', () => {
  const input = quad({
    commands: [0, 0.25, 0.5, 0.75, 1],
    thrust: [0, 1, 2, 3, 4],
    torque: [0, 0.0625, 0.125, 0.1875, 0.25],
  });
  const exact = checkSolution(input, [0.125, 0.125, 0.125, 0.125]);
  assert.equal(exact.workload.cellSolves, STATIC_QUAD_DOMAIN_LIMITS.maximumCombinations);
  input.rotors[0].surface = surface({
    commands: [0, 0.125, 0.25, 0.5, 0.75, 1],
    thrust: [0, 0.5, 1, 2, 3, 4],
    torque: [0, 0.03125, 0.0625, 0.125, 0.1875, 0.25],
  });
  const over = solveStaticQuadCommandDomain(input);
  assert.equal(over.reason, 'command-domain-workload-limit');
  assert.equal(over.workload.candidateCombinations, 320);
  assert.equal(over.workload.cellSolves, 1);
  assert.equal(over.commands, null);
});

test('complete domains, provenance and numerical policy bind identity and immutable results', () => {
  const input = quad(),
    before = structuredClone(input),
    result = checkSolution(input, [0.25, 0.75, 0.875, 0.125]);
  before.target = input.target;
  assert.deepEqual(input, before);
  const copy = structuredClone(input);
  copy.rotors[0].surface.paths[0].source.revision = 'different-source';
  assert.notEqual(solveStaticQuadCommandDomain(copy).identity, result.identity);
  assert.ok(Object.isFrozen(result.input.rotors[0].candidateCells[0]));
  assert.ok(Object.isFrozen(result.sources[0].paths[0].source));
  assert.throws(() => {
    result.commands[0].value = 1;
  }, TypeError);
  input.rotors.reverse();
  input.target = before.target;
  const reversed = solveStaticQuadCommandDomain(input);
  assert.equal(reversed.status, 'solved');
  assert.deepEqual(reversed.commands, [...result.commands].reverse());
  assert.notEqual(reversed.identity, result.identity);
});

test('malformed headers, geometry, units and surface declarations still fail complete validation', () => {
  const bad = [
    (x) => {
      x.format = 'unknown';
    },
    (x) => {
      x.frame = 'unknown';
    },
    (x) => {
      x.supply.voltage = '4';
    },
    (x) => {
      x.supply.kind = 'battery';
    },
    (x) => {
      x.target.force.y = Infinity;
    },
    (x) => {
      x.rotors[0].cell = [0, 0];
    },
    (x) => {
      x.rotors[0].commandUnit = 'rpm';
    },
    (x) => {
      x.rotors[0].surface.cells = [[9, 0]];
    },
    (x) => {
      x.rotors[0].id = x.rotors[1].id;
    },
    (x) => {
      delete x.units.force;
    },
  ];
  for (const mutate of bad) {
    const input = quad();
    mutate(input);
    assert.throws(() => solveStaticQuadCommandDomain(input));
  }
  const lateral = quad();
  lateral.target.force.x = 1;
  assert.equal(
    solveStaticQuadCommandDomain(lateral).unresolved.reason,
    'unsupported-lateral-force',
  );
  assert.throws(() => solveStaticQuadCommandDomain(' '.repeat(2 * 1024 * 1024)), /budget/i);
});

test('domain selector has no live controller, aircraft, worker, inspector or package admission', async () => {
  for (const file of [
    'aircraft-physics.mjs',
    'advanced-aircraft-runtime.mjs',
    'advanced-worker.mjs',
    'propulsion-evidence-ui.mjs',
  ]) {
    const text = await readFile(
      new URL(`../../optional-practice/civilian-fpv/${file}`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(text, /from\s+['"].*propulsion-domain\.mjs['"]/);
  }
  const policy = await readFile(
    new URL('../../publishing/optional-package-policy.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(policy, /propulsion-domain\.mjs/);
});
