import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROPULSION_EVIDENCE_FIELDS,
  createSyntheticPropulsionEvidence,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';
import {
  PROPULSION_LOAD_FORMAT,
  solvePropulsionEvidenceLoad,
} from '../../optional-practice/civilian-fpv/propulsion-load.mjs';

const empty = () => Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((field) => [field, null]));
const near = (actual, expected, tolerance = 1e-11) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

// All rows in this file are invented numerical oracles, not aircraft data.
function path({ volts = [1, 3, 5], currents = volts, intervals, command = 0.5 } = {}) {
  const value = createSyntheticPropulsionEvidence();
  value.id = 'synthetic-voltage-sweep';
  value.name = 'Synthetic fixed-command voltage sweep';
  value.domain = {
    kind: 'one-dimensional-path',
    axis: 'voltage',
    intervals: intervals ?? [[volts[0], volts.at(-1)]],
  };
  value.samples = volts.map((voltage, i) => ({
    values: { ...empty(), command, voltage, current: currents[i], airspeed: 0 },
    uncertainty: empty(),
  }));
  return value;
}
const solve = (evidence = [path()], overrides = {}) =>
  solvePropulsionEvidenceLoad({
    evidence,
    openVoltage: 5,
    resistance: 1,
    currentBasis: 'dc-input-at-recorded-voltage',
    ...overrides,
  });

test('affine and constant load curves match independent circuit equations', () => {
  const linear = solve();
  assert.equal(linear.format, PROPULSION_LOAD_FORMAT);
  assert.equal(linear.resultKind, 'calculated');
  assert.equal(linear.assumptions.currentBasis, 'caller-declared');
  assert.equal(linear.assumptions.measurementTopology, 'unverified');
  assert.equal(linear.model.battery, 'ideal-fixed-open-voltage-and-series-resistance');
  assert.equal(linear.status, 'solved');
  near(linear.operatingPoint.voltage, 5 / (1 + 1)); // I(V) = V.
  near(linear.operatingPoint.current, 2.5);
  near(linear.operatingPoint.residualVolts, 0);
  near(linear.operatingPoint.electricalWatts, 6.25);
  near(linear.operatingPoint.batteryLossWatts, 6.25);
  near(
    5 * linear.operatingPoint.current,
    linear.operatingPoint.electricalWatts + linear.operatingPoint.batteryLossWatts,
  );
  const constant = solve([path({ currents: [2, 2, 2] })], { resistance: 0.5 });
  near(constant.operatingPoint.voltage, 5 - 0.5 * 2);
  const affine = solve([path({ currents: [3, 7, 11] })], { resistance: 0.25 });
  near(affine.operatingPoint.voltage, (5 - 0.25) / (1 + 2 * 0.25)); // I(V) = 2V + 1.
});

test('multiple independently commanded parallel loads intersect coverage and merge their knots', () => {
  const a = path({ volts: [1, 3, 5], currents: [1, 3, 5], command: 0.2 });
  const b = path({ volts: [2, 4, 6], currents: [1, 3, 5], command: 0.7 });
  const result = solve([a, b], { resistance: 0.5 });
  assert.deepEqual(result.intervals, [[2, 5]]);
  near(result.operatingPoint.voltage, (5 + 0.5) / 2); // I_total = V + (V - 1).
  near(result.operatingPoint.current, 4.5);
  assert.equal(result.operatingPoint.paths.length, 2);
  assert.deepEqual(
    result.sources.map((item) => item.command.value),
    [0.2, 0.7],
  );
  const four = solve(
    Array.from({ length: 4 }, () => path()),
    { resistance: 0.25 },
  );
  near(four.operatingPoint.voltage, 2.5);
  near(four.operatingPoint.current, 10);
});

test('piecewise knot boundaries use the containing segment, with exact sample roots preserved', () => {
  const evidence = path({ volts: [1, 2, 4], currents: [0, 1, 5] });
  const knot = solve([evidence], { openVoltage: 3 });
  assert.equal(knot.operatingPoint.voltage, 2);
  assert.equal(knot.operatingPoint.paths[0].status, 'sample');
  const later = solve([evidence], { openVoltage: 6 });
  near(later.operatingPoint.voltage, 3); // I = 2V - 3 above the knot.
  near(later.operatingPoint.current, 3);
  assert.deepEqual(later.operatingPoint.paths[0].bracket, [1, 2]);
});

test('zero resistance and zero current do not manufacture missing voltage endpoints', () => {
  const ideal = solve([path()], { resistance: 0 });
  assert.equal(ideal.operatingPoint.voltage, 5);
  assert.equal(ideal.operatingPoint.current, 5);
  assert.equal(ideal.operatingPoint.batteryLossWatts, 0);
  const idle = solve([path({ currents: [0, 0, 0] })], { openVoltage: 3, currentLimit: 0 });
  assert.equal(idle.status, 'solved');
  assert.equal(idle.operatingPoint.voltage, 3);
  assert.equal(idle.operatingPoint.current, 0);
  assert.equal(solve([path()], { openVoltage: 0, resistance: 0 }).reason, 'root-below-coverage');
  const zero = path({ volts: [0, 1], currents: [0, 1] });
  assert.equal(solve([zero], { openVoltage: 0 }).operatingPoint.voltage, 0);
  assert.equal(solve([path()], { openVoltage: 6, resistance: 0 }).reason, 'root-above-coverage');
});

test('disconnected coverage, isolated knots and nonintersecting paths never extrapolate', () => {
  const split = path({
    volts: [1, 2, 4, 5],
    intervals: [
      [1, 2],
      [4, 5],
    ],
  });
  const gap = solve([split], { openVoltage: 6 });
  assert.equal(gap.status, 'unavailable');
  assert.equal(gap.reason, 'root-in-coverage-gap');
  assert.equal(gap.operatingPoint, null);
  assert.equal(solve([split], { openVoltage: 9 }).operatingPoint.voltage, 4.5);
  const isolated = path({
    volts: [2, 4],
    intervals: [
      [2, 2],
      [4, 4],
    ],
  });
  assert.equal(solve([isolated], { openVoltage: 4 }).operatingPoint.voltage, 2);
  assert.equal(solve([isolated], { openVoltage: 6 }).reason, 'root-in-coverage-gap');
  assert.equal(solve([isolated], { openVoltage: 10 }).reason, 'root-above-coverage');
  const none = solve([path({ volts: [1, 2] }), path({ volts: [3, 4] })]);
  assert.equal(none.reason, 'no-common-coverage');
  assert.deepEqual(none.intervals, []);
  const touching = solve([path({ volts: [1, 2] }), path({ volts: [2, 3] })], { openVoltage: 6 });
  assert.deepEqual(touching.intervals, [[2, 2]]);
  assert.equal(touching.operatingPoint.voltage, 2);
});

test('current limit is diagnostic only and never silently reduces command or current', () => {
  const full = solve(),
    limited = solve([path()], { currentLimit: 2 });
  assert.equal(limited.status, 'limit-exceeded');
  assert.equal(limited.reason, 'unregulated-current-exceeds-limit');
  assert.deepEqual(limited.operatingPoint, full.operatingPoint);
  assert.equal(solve([path()], { currentLimit: 2.5 }).status, 'solved');
  assert.equal(solve([path()], { currentLimit: 0 }).status, 'limit-exceeded');
});

test('an unrepresentable operating voltage is unavailable rather than a false solved circuit', () => {
  const conditioned = path({ volts: [1, 1 + Number.EPSILON], currents: [0, 10000] });
  const result = solve([conditioned], { openVoltage: 2, resistance: 1000 });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'numerical-resolution');
  assert.equal(result.operatingPoint, null);
  const ordinary = solve().operatingPoint;
  assert.ok(Math.abs(ordinary.residualVolts) <= ordinary.residualToleranceVolts);
});

test('fixed commands remain in source command units and missing or changing commands are unavailable', () => {
  const pwm = path({ command: 1500 });
  pwm.units.command = 'us';
  const result = solve([pwm]);
  assert.equal(result.status, 'solved');
  assert.deepEqual(result.sources[0].command, { value: 1500, unit: 'us' });
  const percent = path({ command: 50 });
  percent.units.command = 'percent';
  assert.deepEqual(solve([percent]).sources[0].command, { value: 0.5, unit: 'normalized' });
  for (const missing of [0, 1, 2]) {
    const value = path();
    value.samples[missing].values.command = null;
    const unavailable = solve([value]);
    assert.equal(unavailable.reason, 'command-unavailable');
    assert.equal(unavailable.pathIndex, 0);
  }
  const varying = path();
  varying.samples[1].values.command = 0.6;
  assert.equal(solve([path(), varying]).reason, 'fixed-command-required');
  assert.equal(solve([path(), varying]).pathIndex, 1);
  assert.equal(solve([createSyntheticPropulsionEvidence()]).reason, 'voltage-axis-required');
});

test('the bench circuit requires recorded static single-rotor conditions and usable load current', () => {
  const cases = [
    [
      (v) => {
        v.conditions.scope = 'whole-aircraft';
      },
      'single-rotor-required',
    ],
    [
      (v) => {
        v.conditions.flow = 'unknown';
      },
      'static-flow-required',
    ],
    [
      (v) => {
        v.samples[1].values.airspeed = null;
      },
      'known-zero-airspeed-required',
    ],
    [
      (v) => {
        v.conditions.flow = 'axial';
        v.samples[1].values.airspeed = 1;
      },
      'static-flow-required',
    ],
    [
      (v) => {
        v.samples[1].values.current = null;
      },
      'current-unavailable',
    ],
    [
      (v) => {
        v.samples[0].values.current = -1;
      },
      'negative-current',
    ],
    [
      (v) => {
        v.samples[1].values.current = 0;
      },
      'nonmonotone-current',
    ],
  ];
  for (const [edit, reason] of cases) {
    const value = path();
    edit(value);
    const result = solve([value]);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reason, reason);
    assert.equal(result.operatingPoint, null);
  }
  const split = path({
    volts: [1, 2, 4, 5],
    currents: [1, 2, 1, 3],
    intervals: [
      [1, 2],
      [4, 5],
    ],
  });
  assert.equal(
    solve([split]).reason,
    'nonmonotone-current',
    'No alternate root is chosen across gaps',
  );
});

test('missing response channels and uncertainty remain unavailable, never synthesized or propagated', () => {
  const value = path();
  value.samples.forEach((sample) => {
    sample.uncertainty.current = 0.1;
  });
  value.uncertainty.kind = 'standard';
  const result = solve([value]),
    output = result.operatingPoint.paths[0];
  assert.equal(result.status, 'solved');
  assert.equal(result.uncertaintyBasis, 'central-values-only-not-propagated');
  assert.equal(result.sources[0].uncertainty.kind, 'standard');
  for (const channel of ['rpm', 'thrust', 'torque']) {
    assert.equal(output.values[channel], null);
    assert.equal(output.uncertainty[channel], null);
    assert.ok(output.missingFields.includes(channel));
  }
  near(output.uncertainty.current, 0.1);
  assert.equal(output.power.shaftWatts, null);
  assert.equal(output.uncertaintyBasis, 'linear-endpoint-values-not-model-error');
});

test('canonical conversions, supplied provenance and different source kinds survive without promotion', () => {
  const records = ['measured', 'calculated', 'synthetic'].map((kind, i) => {
    const value = path();
    // Exercise labels only: these rows still originate in this invented fixture.
    value.source.kind = kind;
    value.source.title = `Synthetic fixture exercising the ${kind} metadata label`;
    value.source.license.redistribution = ['unknown', 'restricted', 'permitted'][i];
    value.units.voltage = 'mV';
    value.units.current = 'mA';
    value.domain.intervals = [[1000, 5000]];
    value.samples.forEach((sample) => {
      sample.values.voltage *= 1000;
      sample.values.current *= 1000;
    });
    return value;
  });
  const result = solve(records, { resistance: 1 / 3 });
  near(result.operatingPoint.voltage, 2.5);
  assert.deepEqual(
    result.sources.map((item) => item.source.kind),
    ['measured', 'calculated', 'synthetic'],
  );
  assert.deepEqual(
    result.operatingPoint.paths.map((item) => item.sourceKind),
    ['measured', 'calculated', 'synthetic'],
  );
  assert.deepEqual(
    result.sources.map((item) => item.source.license.redistribution),
    ['unknown', 'restricted', 'permitted'],
  );
  assert.equal(result.sources[0].units.voltage, 'V');
  assert.equal(result.sources[0].units.current, 'A');
  assert.equal(records[0].samples[0].values.voltage, 1000);
});

test('bounded malformed inputs throw without invoking getters, accepting coercion or mutating data', () => {
  for (const overrides of [
    { evidence: [] },
    { evidence: Array.from({ length: 5 }, () => path()) },
    { openVoltage: null },
    { openVoltage: '5' },
    { openVoltage: -1 },
    { openVoltage: 1001 },
    { resistance: -1 },
    { resistance: Infinity },
    { resistance: '1' },
    { currentLimit: -1 },
    { currentLimit: NaN },
    { currentLimit: '2' },
    { currentBasis: null },
    { currentBasis: 'phase-current' },
    { extra: true },
  ])
    assert.throws(() => solve([path()], overrides));
  const accessor = path();
  let invoked = false;
  Object.defineProperty(accessor, 'name', {
    enumerable: true,
    get() {
      invoked = true;
      return 'bad';
    },
  });
  assert.throws(() => solve([accessor]));
  assert.equal(invoked, false);
  const invalidEvidence = path();
  invalidEvidence.samples[0].values.current = '1';
  assert.throws(() => solve([invalidEvidence]));
  const contradictoryFlow = path();
  contradictoryFlow.samples[1].values.airspeed = 1;
  assert.throws(() => solve([contradictoryFlow]), /Static evidence/);
});

test('source and result mutations cannot leak; identity tracks source content and electrical assumptions', () => {
  const value = path(),
    original = structuredClone(value),
    first = solve([value]),
    identity = first.identity;
  assert.deepEqual(value, original);
  assert.equal(solve([JSON.parse(JSON.stringify(value))]).identity, identity);
  first.sources[0].source.title = 'changed';
  first.operatingPoint.paths[0].values.current = 100;
  first.intervals[0][0] = 0;
  assert.deepEqual(value, original);
  const second = solve([value]);
  assert.equal(second.identity, identity);
  near(second.operatingPoint.current, 2.5);
  value.samples[0].values.current = 0;
  assert.notEqual(solve([value]).identity, identity);
  assert.notEqual(solve([original], { resistance: 0.5 }).identity, identity);
  assert.notEqual(solve([original], { currentLimit: 2 }).identity, identity);
  assert.equal(
    solvePropulsionEvidenceLoad(
      JSON.stringify({
        evidence: [original],
        openVoltage: 5,
        resistance: 1,
        currentBasis: 'dc-input-at-recorded-voltage',
      }),
    ).identity,
    identity,
  );
});

test('load solving has no runtime, catalog, network or persistence integration', async () => {
  const text = await readFile(
    new URL('../../optional-practice/civilian-fpv/propulsion-load.mjs', import.meta.url),
    'utf8',
  );
  assert.deepEqual(
    [...text.matchAll(/^import .* from '([^']+)';/gm)].map((match) => match[1]),
    ['../../game/data-json.mjs', './propulsion-evidence.mjs'],
  );
  assert.doesNotMatch(text, /\bfetch\s*\(|\bXMLHttpRequest\b|\.setItem\s*\(/);
});
