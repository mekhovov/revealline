import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROPULSION_EVIDENCE_FIELDS,
  createSyntheticPropulsionEvidence,
  createPropulsionEvidenceEvaluator,
  validatePropulsionEvidence,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';
import {
  PROPULSION_SURFACE_FORMAT,
  PROPULSION_SURFACE_LOAD_FORMAT,
  PROPULSION_SURFACE_LIMITS,
  validatePropulsionSurface,
  createPropulsionSurfaceEvaluator,
  solvePropulsionSurfaceLoad,
} from '../../optional-practice/civilian-fpv/propulsion-surface.mjs';

const near = (actual, expected, tolerance = 1e-11) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const empty = () => Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((field) => [field, null]));
// Invented analytic surfaces only. These fixtures are not aircraft measurements.
function surface({ commands = [0, 0.5, 1], voltages = [1, 3, 5], intervals, cells } = {}) {
  return {
    format: PROPULSION_SURFACE_FORMAT,
    id: 'synthetic-command-voltage-oracle',
    name: 'Invented bilinear oracle',
    currentBasis: 'dc-input-at-recorded-voltage',
    paths: commands.map((command, index) => {
      const path = createSyntheticPropulsionEvidence();
      path.id = `synthetic-voltage-path-${index}`;
      path.components.esc = 'Invented ESC';
      path.components.escFirmware = 'Invented ESC firmware revision';
      path.domain = {
        kind: 'one-dimensional-path',
        axis: 'voltage',
        intervals: intervals ?? [[voltages[0], voltages.at(-1)]],
      };
      path.samples = voltages.map((voltage) => ({
        values: {
          command,
          voltage,
          airspeed: 0,
          current: (1 + command) * voltage + command,
          thrust: 2 * command * voltage,
          torque: (command * voltage) / 1000,
          rpm: 1000 * command * voltage,
        },
        uncertainty: { ...empty(), thrust: 0.01 + command / 10 + voltage / 100 },
      }));
      return path;
    }),
    cells: cells ?? commands.slice(1).flatMap((_, c) => voltages.slice(1).map((_, v) => [c, v])),
  };
}
const edited = (edit) => {
  const value = surface();
  edit(value);
  return value;
};
const solve = (value = surface(), command = 0.5, overrides = {}) =>
  solvePropulsionSurfaceLoad({
    loads: [{ surface: value, command }],
    openVoltage: 5,
    resistance: 0.5,
    ...overrides,
  });

test('surface retains exact original paths and rejects coercing a path into a surface', () => {
  const input = surface(),
    text = JSON.stringify(input);
  assert.deepEqual(validatePropulsionSurface(text), input);
  const detached = validatePropulsionSurface(input);
  detached.paths[0].samples[0].values.current = 100;
  assert.equal(JSON.stringify(input), text);
  for (const path of input.paths) assert.deepEqual(validatePropulsionEvidence(path), path);
  assert.throws(() => validatePropulsionEvidence(input), TypeError);
  assert.throws(() => validatePropulsionSurface(input.paths[0]), TypeError);
});

test('bilinear command-voltage interpolation matches an independent analytic oracle across the grid', () => {
  const evaluator = createPropulsionSurfaceEvaluator(surface());
  for (let c = 0; c <= 40; c++)
    for (let v = 0; v <= 40; v++) {
      const command = c / 40,
        voltage = 1 + v / 10;
      const point = evaluator.evaluate({ command, voltage });
      assert.notEqual(point.status, 'outside-coverage');
      assert.equal(point.values.command, command);
      assert.equal(point.values.voltage, voltage);
      near(point.values.current, (1 + command) * voltage + command);
      near(point.values.thrust, 2 * command * voltage);
      near(point.values.rpm, 1000 * command * voltage);
      near(point.uncertainty.thrust, 0.01 + command / 10 + voltage / 100);
      near(point.power.electricalWatts, voltage * ((1 + command) * voltage + command));
    }
  const middle = evaluator.evaluate({ command: 0.25, voltage: 2 });
  assert.equal(middle.status, 'interpolated');
  assert.equal(middle.resultKind, 'calculated');
  assert.deepEqual(middle.cell, [0, 0]);
  assert.deepEqual(middle.fractions, { command: 0.5, voltage: 0.5 });
  assert.equal(middle.uncertaintyBasis, 'bilinear-endpoint-values-not-model-error');
  assert.deepEqual(
    middle.sources.map((row) => row.source.kind),
    ['synthetic', 'synthetic'],
  );
});

test('exact path commands preserve source knots and one-dimensional interpolation', () => {
  const input = surface(),
    evaluator = createPropulsionSurfaceEvaluator(input);
  for (let i = 0; i < input.paths.length; i++) {
    const original = createPropulsionEvidenceEvaluator(input.paths[i]);
    for (const voltage of [1, 2, 3, 4, 5]) {
      const expected = original.evaluate(voltage),
        point = evaluator.evaluate({ command: evaluator.commands[i], voltage });
      assert.equal(point.status, expected.status);
      assert.equal(point.cell, null);
      assert.deepEqual(point.values, expected.values);
      assert.deepEqual(point.uncertainty, expected.uncertainty);
      assert.equal(point.uncertaintyBasis, expected.uncertaintyBasis);
      assert.deepEqual(
        point.sources.map((source) => source.pathIndex),
        [i],
      );
      assert.equal(point.resultKind, expected.status === 'sample' ? 'source-sample' : 'calculated');
    }
  }
});

test('shared edges are exact and deterministic; no tolerance expands coverage or snaps coordinates', () => {
  const evaluator = createPropulsionSurfaceEvaluator(
    surface({ commands: [0, 1], cells: [[0, 0]] }),
  );
  const edge = evaluator.evaluate({ command: 0.25, voltage: 3 });
  assert.equal(edge.status, 'interpolated');
  assert.equal(edge.values.voltage, 3);
  assert.equal(
    evaluator.evaluate({ command: 0.25, voltage: 3 + 2 ** -51 }).status,
    'outside-coverage',
  );
  assert.equal(evaluator.evaluate({ command: 0.25, voltage: 3 - 2 ** -51 }).status, 'interpolated');
  assert.equal(
    evaluator.evaluate({ command: -Number.MIN_VALUE, voltage: 2 }).reason,
    'outside-domain',
  );
  assert.equal(
    evaluator.evaluate({ command: 1 + Number.EPSILON, voltage: 2 }).reason,
    'outside-domain',
  );
  const full = createPropulsionSurfaceEvaluator(surface());
  assert.deepEqual(
    full.evaluate({ command: 0.25, voltage: 3 }).cell,
    [0, 0],
    'Shared voltage edge uses the first sorted cell',
  );
  assert.deepEqual(full.evaluate({ command: 0.25, voltage: 3 + 2 ** -51 }).cell, [0, 1]);
  for (const command of [0.5 - Number.EPSILON, 0.5, 0.5 + Number.EPSILON])
    near(full.evaluate({ command, voltage: 3 }).values.current, (1 + command) * 3 + command, 1e-14);
});

test('undeclared cells and disconnected path intervals never fill sparse coverage', () => {
  const evaluator = createPropulsionSurfaceEvaluator(
    surface({
      cells: [
        [0, 0],
        [1, 1],
      ],
    }),
  );
  assert.equal(evaluator.evaluate({ command: 0.25, voltage: 4 }).reason, 'coverage-gap');
  assert.equal(evaluator.evaluate({ command: 0.75, voltage: 2 }).values, null);
  assert.equal(
    evaluator.evaluate({ command: 0.5, voltage: 4 }).status,
    'interpolated',
    'Original path coverage survives',
  );
  assert.ok(evaluator.diagnostics.some((item) => item.code === 'partial-cell-coverage'));
  const split = surface({
    commands: [0, 1],
    voltages: [1, 2, 4, 5],
    intervals: [
      [1, 2],
      [4, 5],
    ],
    cells: [
      [0, 0],
      [0, 2],
    ],
  });
  const gap = createPropulsionSurfaceEvaluator(split);
  for (const command of [0, 0.5, 1])
    assert.equal(gap.evaluate({ command, voltage: 3 }).status, 'outside-coverage');
  split.cells.splice(1, 0, [0, 1]);
  assert.throws(() => validatePropulsionSurface(split), /coverage gap/);
});

test('a cell requires actual four corners at adjacent canonical grid knots', () => {
  const missing = surface({ commands: [0, 1] });
  missing.paths[1].samples.splice(1, 1);
  assert.throws(() => validatePropulsionSurface(missing), /four observed corners/);
  for (const cells of [
    [],
    [[0, 2]],
    [[2, 0]],
    [[0.5, 0]],
    [[0, 0, 1]],
    [
      [0, 0],
      [0, 0],
    ],
    [
      [1, 0],
      [0, 0],
    ],
    [[-1, 0]],
  ])
    assert.throws(() => validatePropulsionSurface({ ...surface(), cells }));
  const collapsed = surface({ commands: [0, 1] });
  collapsed.paths[1].samples.forEach((sample) => {
    sample.values.command = 0;
  });
  assert.throws(() => validatePropulsionSurface(collapsed), /strictly increasing/);
});

test('components, test conditions and fixed command must be explicit and consistent', () => {
  for (const edit of [
    (v) => {
      v.paths[0].components.esc = null;
    },
    (v) => {
      v.paths[1].components.motor = 'Another motor';
    },
    (v) => {
      v.paths[1].conditions.temperatureC = 20;
    },
    (v) => {
      v.paths[1].conditions.installation = 'Different fixture';
    },
    (v) => {
      v.paths[1].samples[1].values.command = 0.6;
    },
    (v) => {
      v.paths[1].samples[0].values.command = null;
    },
    (v) => {
      v.paths[1].units.command = 'us';
    },
    (v) => {
      v.paths.reverse();
    },
  ])
    assert.throws(() => validatePropulsionSurface(edited(edit)));
  assert.throws(
    () =>
      validatePropulsionSurface(
        edited((v) => {
          delete v.currentBasis;
        }),
      ),
    /missing fields/,
  );
  assert.throws(
    () =>
      validatePropulsionSurface(
        edited((v) => {
          v.currentBasis = 'battery';
        }),
      ),
    /current basis/,
  );
});

test('source units normalize without command to RPM conversion or voltage scaling assumptions', () => {
  const input = surface();
  const path = input.paths[1];
  path.units.command = 'percent';
  path.units.voltage = 'mV';
  path.units.current = 'mA';
  path.domain.intervals = [[1000, 5000]];
  for (const sample of path.samples) {
    sample.values.command *= 100;
    sample.values.voltage *= 1000;
    sample.values.current *= 1000;
  }
  const evaluator = createPropulsionSurfaceEvaluator(input);
  assert.deepEqual(evaluator.commands, [0, 0.5, 1]);
  assert.deepEqual(evaluator.voltages, [1, 3, 5]);
  near(evaluator.evaluate({ command: 0.25, voltage: 2 }).values.current, 2.75);
  assert.equal(evaluator.surface.paths[1].samples[0].values.voltage, 1000);
  const pwm = surface({ commands: [1200, 1500, 1800] });
  for (const row of pwm.paths) {
    row.units.command = 'us';
    for (const point of row.samples) {
      // Keep the invented load oracle inside the original observation limits.
      point.values.current = point.values.voltage;
      point.values.thrust = 1;
      point.values.torque = 0.001;
      point.values.rpm = 1000;
      point.uncertainty.thrust = null;
    }
  }
  const microseconds = createPropulsionSurfaceEvaluator(pwm);
  assert.equal(microseconds.units.command, 'us');
  assert.equal(microseconds.evaluate({ command: 0.5, voltage: 2 }).reason, 'outside-domain');
  assert.equal(microseconds.evaluate({ command: 1300, voltage: 2 }).values.command, 1300);
});

test('missing observations and uncertainty stay unavailable; exact boundaries use their own observations', () => {
  const input = surface();
  input.paths[0].units.torque = null;
  for (const sample of input.paths[0].samples) sample.values.torque = null;
  input.paths[1].samples[1].uncertainty.thrust = null;
  const evaluator = createPropulsionSurfaceEvaluator(input);
  assert.equal(evaluator.units.torque, 'N*m');
  const middle = evaluator.evaluate({ command: 0.25, voltage: 2 });
  assert.equal(middle.values.torque, null);
  assert.equal(middle.uncertainty.thrust, null);
  assert.equal(middle.power.shaftWatts, null);
  assert.ok(middle.missingFields.includes('torque'));
  assert.equal(evaluator.evaluate({ command: 0.5, voltage: 2 }).values.torque, 0.001);
  assert.equal(evaluator.evaluate({ command: 0.25, voltage: 1 }).uncertainty.thrust, 0.045);
});

test('noisy and nonmonotonic readings are preserved with diagnostics; cancellation cannot make a load eligible', () => {
  const input = surface();
  input.paths[0].samples[1].values.current = -1;
  input.paths[1].samples[0].values.thrust = -0.1;
  const before = JSON.stringify(input),
    evaluator = createPropulsionSurfaceEvaluator(input);
  assert.equal(evaluator.evaluate({ command: 0, voltage: 3 }).values.current, -1);
  assert.ok(
    evaluator.diagnostics.some(
      (item) => item.code === 'nonmonotone-load-voltage' && item.fields.includes('current'),
    ),
  );
  assert.ok(
    evaluator.diagnostics.some(
      (item) => item.code === 'nonmonotone-load-command' && item.fields.includes('thrust'),
    ),
  );
  assert.ok(evaluator.diagnostics.some((item) => item.code === 'negative-load-reading'));
  assert.equal(solve(input, 0.25).reason, 'negative-current');
  const nonmonotone = surface();
  nonmonotone.paths[0].samples[1].values.current = 0.5;
  // Averaging this decreasing source with its increasing neighbor is monotone.
  const average = createPropulsionSurfaceEvaluator(nonmonotone);
  assert.ok(
    average.evaluate({ command: 0.25, voltage: 3 }).values.current >
      average.evaluate({ command: 0.25, voltage: 1 }).values.current,
  );
  assert.equal(solve(nonmonotone, 0.25).reason, 'nonmonotone-current');
  assert.equal(JSON.stringify(input), before);
});

test('different uncertainty interpretations are not numerically blended or relabeled', () => {
  const input = surface();
  input.paths[0].uncertainty = {
    kind: 'standard',
    coverageFactor: null,
    notes: 'Invented uncertainty for schema checks only.',
  };
  input.paths[1].uncertainty = {
    kind: 'expanded',
    coverageFactor: 2,
    notes: 'Invented uncertainty for schema checks only.',
  };
  const evaluator = createPropulsionSurfaceEvaluator(input);
  const point = evaluator.evaluate({ command: 0.25, voltage: 2 });
  assert.equal(point.values.current, 2.75);
  assert.deepEqual(point.uncertainty, empty());
  assert.equal(point.uncertaintyBasis, 'unavailable-incompatible-source-uncertainty');
  assert.ok(point.diagnostics.some((item) => item.code === 'incompatible-source-uncertainty'));
  assert.deepEqual(
    point.sources.map((row) => row.uncertainty.kind),
    ['standard', 'expanded'],
  );
  near(evaluator.evaluate({ command: 0, voltage: 2 }).uncertainty.thrust, 0.03);
});

test('mixed source declarations stay attached to contributing paths without creating a measured interpolation', () => {
  const input = surface();
  input.paths[0].source.kind = 'measured';
  input.paths[0].source.title = 'Invented fixture exercising a supplied measured label only';
  input.paths[0].source.license.redistribution = 'restricted';
  input.paths[1].source.kind = 'calculated';
  const evaluator = createPropulsionSurfaceEvaluator(input);
  const point = evaluator.evaluate({ command: 0.25, voltage: 2 });
  assert.equal(point.resultKind, 'calculated');
  assert.deepEqual(
    point.sources.map((row) => row.source.kind),
    ['measured', 'calculated'],
  );
  assert.equal(point.sources[0].source.license.redistribution, 'restricted');
  const result = solve(input, 0.25);
  assert.equal(result.load.sources[0].source.kind, 'calculated');
  assert.equal(result.sources[0].paths[0].source.kind, 'measured');
  assert.equal(result.sources[0].paths[0].source.license.redistribution, 'restricted');
  assert.equal(result.sources[0].paths[0].units.voltage, 'V');
});

test('phase and unknown current basis disable electrical power and load solving without dropping data', () => {
  for (const currentBasis of ['phase-current', 'unknown']) {
    const input = { ...surface(), currentBasis };
    const point = createPropulsionSurfaceEvaluator(input).evaluate({ command: 0.25, voltage: 2 });
    assert.equal(point.values.current, 2.75);
    assert.equal(point.power.electricalWatts, null);
    assert.equal(point.power.efficiency, null);
    assert.notEqual(point.power.shaftWatts, null);
    const result = solve(input, 0.25);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, 'dc-input-current-required');
    assert.equal(result.surfaceIndex, 0);
    assert.equal(result.load, null);
  }
});

test('fixed-command surface load matches an independent affine circuit and retains original source kinds', () => {
  const input = surface(),
    result = solve(input, 0.25);
  assert.equal(result.format, PROPULSION_SURFACE_LOAD_FORMAT);
  assert.equal(result.status, 'solved');
  assert.equal(result.resultKind, 'calculated');
  assert.deepEqual(result.sliceKinds, ['calculated-command-slice']);
  const voltage = (5 - 0.5 * 0.25) / (1 + 0.5 * 1.25);
  near(result.load.operatingPoint.voltage, voltage);
  near(result.load.operatingPoint.current, 1.25 * voltage + 0.25);
  near(result.load.operatingPoint.residualVolts, 0);
  assert.equal(result.load.sources[0].source.kind, 'calculated');
  assert.equal(result.load.sources[0].source.license.redistribution, 'unknown');
  assert.deepEqual(
    result.sources[0].paths.map((row) => row.source.kind),
    ['synthetic', 'synthetic', 'synthetic'],
  );
  assert.equal(result.load.uncertaintyBasis, 'central-values-only-not-propagated');
  const exact = solve(input, 0.5);
  assert.deepEqual(exact.sliceKinds, ['original-voltage-path']);
  assert.equal(exact.load.sources[0].source.kind, 'synthetic');
  near(exact.load.operatingPoint.voltage, 19 / 7);
});

test('independently commanded loads share a covered voltage; diagnostic limit does not regulate them', () => {
  const input = surface();
  const loads = [0, 0.5, 1].map((command) => ({ surface: input, command }));
  const result = solve(input, 0, { loads, resistance: 0.1 });
  near(result.load.operatingPoint.voltage, 97 / 29);
  near(result.load.operatingPoint.current, 4.5 * (97 / 29) + 1.5);
  assert.deepEqual(
    result.sources.map((item) => item.command),
    [0, 0.5, 1],
  );
  const limited = solve(input, 0, { loads, resistance: 0.1, currentLimit: 1 });
  assert.equal(limited.status, 'limit-exceeded');
  assert.deepEqual(limited.load.operatingPoint, result.load.operatingPoint);
  assert.equal(result.load.assumptions.measurementTopology, 'unverified');
});

test('load roots outside surface slices and within holes remain unavailable', () => {
  const input = surface({
    commands: [0, 1],
    voltages: [1, 2, 4, 5],
    intervals: [
      [1, 2],
      [4, 5],
    ],
    cells: [
      [0, 0],
      [0, 2],
    ],
  });
  assert.equal(solve(input, 0.5).reason, 'root-in-coverage-gap');
  assert.equal(solve(input, -0.1).reason, 'command-outside-coverage');
  assert.equal(solve(input, 1.1).reason, 'command-outside-coverage');
  assert.equal(solve(input, 0.5, { openVoltage: 0 }).reason, 'root-below-coverage');
  assert.equal(solve(input, 0.5, { openVoltage: 20 }).reason, 'root-above-coverage');
  assert.equal(solve(input, 0.5, { openVoltage: 7.5 }).status, 'solved');
  const absentColumn = surface({ cells: [[0, 0]] });
  assert.equal(solve(absentColumn, 0.75).reason, 'command-outside-coverage');
});

test('surface load retains original static-flow and finite-resolution eligibility', () => {
  const mixed = surface();
  for (const path of mixed.paths) path.conditions.flow = 'mixed';
  assert.equal(solve(mixed, 0.25).reason, 'static-flow-required');
  const missing = surface();
  missing.paths[0].samples[0].values.current = null;
  assert.equal(solve(missing, 0.25).reason, 'current-unavailable');
  const conditioned = surface({ commands: [0, 1], voltages: [1, 1 + Number.EPSILON] });
  for (const path of conditioned.paths)
    path.samples.forEach((sample, i) => {
      sample.values.current = i * 10000;
    });
  assert.equal(
    solve(conditioned, 0.5, { openVoltage: 2, resistance: 1000 }).reason,
    'numerical-resolution',
  );
});

test('bounded malformed documents and queries fail without getters, source mutation or numeric coercion', () => {
  const input = surface(),
    evaluator = createPropulsionSurfaceEvaluator(input);
  for (const edit of [
    (v) => {
      v.extra = true;
    },
    (v) => {
      v.paths = [];
    },
    (v) => {
      v.paths = Array.from({ length: 17 }, () => v.paths[0]);
    },
    (v) => {
      v.name = 'x'.repeat(PROPULSION_SURFACE_LIMITS.maxBytes);
    },
    (v) => {
      v.paths[1].samples[0].values.current = '3';
    },
    (v) => {
      v.paths[1].samples[0].values.voltage = Infinity;
    },
  ])
    assert.throws(() => validatePropulsionSurface(edited(edit)));
  let invoked = false;
  const getter = { voltage: 2 };
  Object.defineProperty(getter, 'command', {
    enumerable: true,
    get() {
      invoked = true;
      return 0.25;
    },
  });
  assert.throws(() => evaluator.evaluate(getter));
  assert.equal(invoked, false);
  for (const query of [
    { command: '0.25', voltage: 2 },
    { command: 0.25, voltage: NaN },
    { command: 0.25 },
    { command: 0.25, voltage: 2, extra: 1 },
  ])
    assert.throws(() => evaluator.evaluate(query));
  for (const overrides of [
    { loads: [] },
    { resistance: '1' },
    { openVoltage: null },
    { currentLimit: -1 },
    { extra: true },
  ])
    assert.throws(() => solve(input, 0.25, overrides));
  const many = surface({
    commands: [0, 0.5, 1],
    voltages: Array.from({ length: 86 }, (_, i) => i + 1),
  });
  assert.throws(() => validatePropulsionSurface(many), /Too many surface samples/);
});

test('frozen provenance and detached results preserve originals; identities bind cells and electrical assumptions', () => {
  const input = surface(),
    before = JSON.stringify(input);
  const a = createPropulsionSurfaceEvaluator(input),
    b = createPropulsionSurfaceEvaluator(before);
  assert.equal(a.identity, b.identity);
  assert.throws(() => {
    a.surface.paths[0].source.title = 'changed';
  });
  const point = a.evaluate({ command: 0.25, voltage: 2 });
  point.values.current = 99;
  point.sources[0].source.title = 'changed';
  point.cell[0] = 99;
  assert.equal(a.evaluate({ command: 0.25, voltage: 2 }).values.current, 2.75);
  assert.equal(JSON.stringify(input), before);
  input.cells.pop();
  assert.notEqual(createPropulsionSurfaceEvaluator(input).identity, a.identity);
  assert.notEqual(solve(input, 0.25).identity, solve(JSON.parse(before), 0.25).identity);
  assert.notEqual(solve(input, 0.25).identity, solve(input, 0.25, { resistance: 0.1 }).identity);
  assert.notEqual(solve(input, 0.25).identity, solve(input, 0.3).identity);
});

test('surface API has no flight activation, network, persistence or UI dependency', async () => {
  const source = await readFile(
    new URL('../../optional-practice/civilian-fpv/propulsion-surface.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /advanced-simulation|aircraft-simulation|aircraft-catalog|\bfetch\s*\(|\bXMLHttpRequest\b|\.setItem\s*\(/,
  );
  for (const file of [
    'propulsion-evidence.mjs',
    'propulsion-load.mjs',
    'propulsion-evidence-ui.mjs',
  ]) {
    const content = await readFile(
      new URL(`../../optional-practice/civilian-fpv/${file}`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(content, /from ['"].*propulsion-surface/);
  }
});
