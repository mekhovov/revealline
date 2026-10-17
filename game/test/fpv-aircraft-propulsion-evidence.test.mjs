import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROPULSION_EVIDENCE_FORMAT,
  PROPULSION_EVIDENCE_FIELDS,
  PROPULSION_EVIDENCE_LIMITS,
  validatePropulsionEvidence,
  createPropulsionEvidenceEvaluator,
  createSyntheticPropulsionEvidence,
} from '../../optional-practice/civilian-fpv/propulsion-evidence.mjs';

const example = createSyntheticPropulsionEvidence;
const near = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const mutate = (edit) => {
  const source = example();
  edit(source);
  return source;
};
const codes = (value) => value.diagnostics.map((diagnostic) => diagnostic.code);
const empty = () => Object.fromEntries(PROPULSION_EVIDENCE_FIELDS.map((field) => [field, null]));

test('synthetic demonstration is explicit, detached and never a measured aircraft setup', () => {
  const source = example(),
    text = JSON.stringify(source);
  assert.equal(source.format, PROPULSION_EVIDENCE_FORMAT);
  assert.equal(source.source.kind, 'synthetic');
  assert.match(source.name, /Synthetic/);
  assert.deepEqual(validatePropulsionEvidence(text), source);
  const validated = validatePropulsionEvidence(source);
  validated.samples[0].values.thrust = 99;
  assert.equal(source.samples[0].values.thrust, 1);
  assert.equal(example().samples[0].values.thrust, 1);
  assert.equal(JSON.stringify(source), text);
});

test('knots retain observations, independent midpoint arithmetic and bounded coverage', () => {
  const evaluator = createPropulsionEvidenceEvaluator(example());
  const sample = evaluator.evaluate(0.5);
  assert.equal(sample.status, 'sample');
  assert.equal(sample.sourceKind, 'synthetic');
  assert.deepEqual(sample.bracket, [1, 1]);
  assert.deepEqual(sample.values, example().samples[1].values);
  assert.equal(sample.uncertaintyBasis, 'source-reported');
  const middle = evaluator.evaluate(0.375);
  assert.equal(middle.status, 'interpolated');
  assert.deepEqual(middle.bracket, [0, 1]);
  assert.equal(middle.fraction, 0.5);
  assert.equal(middle.values.rpm, 4500);
  assert.equal(middle.values.thrust, 2.5);
  assert.equal(middle.values.current, 2.5);
  assert.equal(middle.power.electricalWatts, 30);
  near(middle.power.shaftWatts, 11.780972450961723);
  assert.ok(codes(middle).includes('interpolation-uncertainty-excludes-model-error'));
  for (const [query, reason] of [
    [0, 'below-domain'],
    [1.1, 'above-domain'],
  ]) {
    const result = evaluator.evaluate(query);
    assert.equal(result.status, 'outside-coverage');
    assert.equal(result.reason, reason);
    assert.equal(result.values, null);
    assert.equal(result.power, null);
  }
});

test('documented disconnected intervals and isolated points never bridge missing experiments', () => {
  const source = example();
  source.domain.intervals = [
    [0.25, 0.5],
    [1, 1],
  ];
  const evaluator = createPropulsionEvidenceEvaluator(source);
  assert.equal(evaluator.evaluate(0.49).status, 'interpolated');
  assert.equal(evaluator.evaluate(0.75).reason, 'coverage-gap');
  assert.equal(evaluator.evaluate(1).status, 'sample');
  for (const intervals of [
    [[0.25, 0.75]],
    [
      [0.25, 1],
      [0.5, 1],
    ],
    [
      [1, 1],
      [0.25, 0.5],
    ],
    [[0.5, 0.25]],
    [],
  ])
    assert.throws(
      () => validatePropulsionEvidence({ ...source, domain: { ...source.domain, intervals } }),
      /interval|sampled endpoints|sample must belong/,
    );
});

test('canonical unit conversions preserve source units, including force rather than mass', () => {
  const source = example();
  source.units = {
    command: 'percent',
    rpm: 'rad/s',
    voltage: 'mV',
    airspeed: 'km/h',
    thrust: 'gf',
    torque: 'N*cm',
    current: 'mA',
  };
  source.domain.intervals = [[25, 100]];
  const factors = {
    command: 100,
    rpm: Math.PI / 30,
    voltage: 1000,
    airspeed: 3.6,
    thrust: 1 / 0.00980665,
    torque: 100,
    current: 1000,
  };
  for (const sample of source.samples)
    for (const field of PROPULSION_EVIDENCE_FIELDS) {
      sample.values[field] *= factors[field];
      sample.uncertainty[field] = 0.1 * factors[field];
    }
  const evaluator = createPropulsionEvidenceEvaluator(source);
  assert.deepEqual(evaluator.axis, { field: 'command', unit: 'normalized' });
  assert.deepEqual(evaluator.intervals, [[0.25, 1]]);
  assert.equal(evaluator.evidence.units.thrust, 'gf');
  const point = evaluator.evaluate(0.5);
  for (const field of PROPULSION_EVIDENCE_FIELDS) {
    near(point.values[field], example().samples[1].values[field]);
    near(point.uncertainty[field], 0.1);
  }
  const kgf = mutate((s) => {
    s.units.thrust = 'kgf';
    for (const sample of s.samples) sample.values.thrust = 1;
  });
  near(createPropulsionEvidenceEvaluator(kgf).evaluate(0.5).values.thrust, 9.80665);
});

test('PWM, RPM, voltage and airspeed axes are never implicitly interchangeable', () => {
  const pwm = mutate((s) => {
    s.units.command = 'us';
    s.domain.intervals = [[1200, 1800]];
    s.samples.forEach((sample, index) => {
      sample.values.command = [1200, 1400, 1800][index];
    });
  });
  const evaluator = createPropulsionEvidenceEvaluator(pwm);
  assert.deepEqual(evaluator.axis, { field: 'command', unit: 'us' });
  assert.equal(evaluator.evaluate(1300).values.command, 1300);
  assert.equal(evaluator.evaluate(0.5).status, 'outside-coverage');
  assert.throws(() => evaluator.evaluate({ command: 1300, voltage: 12 }), /one finite axis/);
  for (const axis of ['rpm', 'voltage', 'airspeed']) {
    const source = example();
    source.domain.axis = axis;
    source.conditions.flow = 'unknown';
    source.samples.forEach((sample, index) => {
      sample.values[axis] = [2, 4, 8][index];
    });
    source.domain.intervals = [[2, 8]];
    const result = createPropulsionEvidenceEvaluator(source).evaluate(3);
    assert.equal(result.axis.field, axis);
    assert.equal(result.values[axis], 3);
    assert.equal(result.values.command, 0.375);
  }
});

test('battery-loaded sweep keeps observed voltage and is not upgraded to a voltage surface', () => {
  const source = mutate((s) => {
    s.samples[0].values.voltage = 15.4;
    s.samples[1].values.voltage = 15;
    s.samples[2].values.voltage = 14.35;
  });
  const evaluator = createPropulsionEvidenceEvaluator(source);
  assert.equal(evaluator.evaluate(0.375).values.voltage, 15.2);
  assert.equal(evaluator.evidence.domain.kind, 'one-dimensional-path');
  assert.throws(() => evaluator.evaluate({ command: 0.375, voltage: 16.8 }), /one finite axis/);
});

test('missing observations and uncertainties remain missing between partial endpoints', () => {
  const source = mutate((s) => {
    s.units.current = null;
    for (const sample of s.samples) sample.values.current = null;
    s.samples[0].values.torque = null;
    s.samples[1].uncertainty.thrust = 0.4;
  });
  const evaluator = createPropulsionEvidenceEvaluator(source);
  const point = evaluator.evaluate(0.375);
  assert.equal(point.values.current, null);
  assert.equal(point.values.torque, null);
  assert.equal(point.uncertainty.thrust, null);
  assert.equal(point.power.electricalWatts, null);
  assert.equal(point.power.shaftWatts, null);
  assert.equal(point.power.efficiency, null);
  assert.deepEqual(point.missingFields, ['torque', 'current']);
  assert.equal(evaluator.evaluate(0.5).uncertainty.thrust, 0.4);
  assert.ok(codes(evaluator).includes('channels-unavailable'));
});

test('uncertainties retain their source interpretation and never become fitting error estimates', () => {
  const source = mutate((s) => {
    s.uncertainty = { kind: 'expanded', coverageFactor: 2, notes: 'Synthetic example only' };
    s.samples[0].uncertainty.thrust = 0.2;
    s.samples[1].uncertainty.thrust = 0.4;
  });
  const evaluator = createPropulsionEvidenceEvaluator(source);
  assert.equal(evaluator.evidence.uncertainty.coverageFactor, 2);
  const point = evaluator.evaluate(0.375);
  near(point.uncertainty.thrust, 0.3);
  assert.equal(point.uncertaintyBasis, 'linear-endpoint-values-not-model-error');
  assert.throws(
    () =>
      validatePropulsionEvidence(
        mutate((s) => {
          s.uncertainty.coverageFactor = 2;
        }),
      ),
    /expanded uncertainty/,
  );
});

test('noisy and nonmonotonic loads survive; physics checks are diagnostics, not quiet corrections', () => {
  const source = mutate((s) => {
    s.samples[0].values.thrust = -0.02;
    s.samples[0].uncertainty.thrust = 0.1;
    s.samples[1].values.thrust = -0.04;
    s.samples[1].values.torque = 1;
  });
  const before = JSON.stringify(source),
    evaluator = createPropulsionEvidenceEvaluator(source);
  assert.equal(evaluator.evaluate(0.25).values.thrust, -0.02);
  const point = evaluator.evaluate(0.5);
  near(point.power.shaftWatts, 628.3185307179587);
  assert.equal(point.power.electricalWatts, 48);
  assert.ok(point.power.efficiency > 1);
  assert.ok(codes(point).includes('shaft-power-exceeds-electrical-central-values'));
  assert.ok(codes(point).includes('negative-load-reading'));
  assert.ok(evaluator.diagnostics.some((d) => d.sample === 1 && d.fields.includes('torque')));
  assert.equal(JSON.stringify(source), before);
});

test('calculated evidence never gets a measured result label and missing power is not zero', () => {
  const source = mutate((s) => {
    s.source.kind = 'calculated';
    for (const sample of s.samples) sample.values.rpm = null;
    s.units.rpm = null;
  });
  const point = createPropulsionEvidenceEvaluator(source).evaluate(0.5);
  assert.equal(point.status, 'sample');
  assert.equal(point.sourceKind, 'calculated');
  assert.equal(point.power.shaftWatts, null);
  assert.equal(point.power.efficiency, null);
  assert.ok(!codes(point).includes('shaft-power-exceeds-electrical-central-values'));
});

test('unknown and restricted licenses are preserved as data and do not acquire redistribution permission', () => {
  for (const redistribution of ['unknown', 'restricted']) {
    const source = mutate((s) => {
      s.source.license = { id: null, url: null, attribution: null, redistribution };
    });
    const evaluator = createPropulsionEvidenceEvaluator(source);
    assert.equal(evaluator.evidence.source.license.redistribution, redistribution);
    assert.ok(codes(evaluator).includes('redistribution-not-confirmed'));
  }
  assert.throws(
    () =>
      validatePropulsionEvidence(
        mutate((s) => {
          s.source.license.id = null;
        }),
      ),
    /explicit license/,
  );
});

test('schema rejects coercion, contradictory or malformed inputs without mutating the caller', () => {
  const edits = [
    (s) => {
      s.format = 'PropulsionEvidence.v2';
    },
    (s) => {
      s.extra = 1;
    },
    (s) => {
      delete s.samples[0].values.thrust;
    },
    (s) => {
      s.samples[0].values.thrust = '2';
    },
    (s) => {
      s.samples[0].uncertainty.thrust = '0.2';
    },
    (s) => {
      s.samples[0].uncertainty.thrust = -1;
    },
    (s) => {
      s.samples[0].values.thrust = null;
      s.samples[0].uncertainty.thrust = 1;
    },
    (s) => {
      s.units.rpm = 'V';
    },
    (s) => {
      s.units.rpm = null;
    },
    (s) => {
      s.samples[0].values.command = null;
    },
    (s) => {
      s.samples[1].values.command = 0.25;
    },
    (s) => {
      s.samples.reverse();
    },
    (s) => {
      s.samples[0].values.command = 1.1;
    },
    (s) => {
      s.samples[0].values.airspeed = 1;
    },
    (s) => {
      s.conditions.humidityRatio = 35;
    },
    (s) => {
      s.conditions.pressurePa = '101325';
    },
    (s) => {
      s.source.retrievedAt = '2026-02-30';
    },
    (s) => {
      s.source.sha256 = 'not-a-hash';
    },
    (s) => {
      s.source.url = 'javascript:alert(1)';
    },
    (s) => {
      s.source.url = 'https://user:secret@example.org/test';
    },
    (s) => {
      s.source.kind = 'flight-validated';
    },
    (s) => {
      s.domain.kind = 'voltage-surface';
    },
    (s) => {
      s.domain.axis = 'thrust';
    },
    (s) => {
      s.samples = [s.samples[0]];
    },
  ];
  for (const edit of edits) {
    const source = mutate(edit),
      before = JSON.stringify(source);
    assert.throws(() => validatePropulsionEvidence(source), TypeError);
    assert.equal(JSON.stringify(source), before);
  }
  assert.throws(() => validatePropulsionEvidence('{"format":'), /JSON/);
});

test('import enforces byte, sample and graph bounds without invoking external getters', () => {
  assert.throws(
    () => validatePropulsionEvidence(' '.repeat(PROPULSION_EVIDENCE_LIMITS.maxBytes + 1)),
    /budget/,
  );
  const source = example();
  source.samples = Array(PROPULSION_EVIDENCE_LIMITS.maxSamples + 1).fill(source.samples[0]);
  assert.throws(() => validatePropulsionEvidence(source), /budget/);
  const cycle = example();
  cycle.conditions.notes = cycle;
  assert.throws(() => validatePropulsionEvidence(cycle), /Cycle|cycle/);
  let touched = false;
  const hostile = example();
  Object.defineProperty(hostile.samples[0].values, 'thrust', {
    enumerable: true,
    get() {
      touched = true;
      return 1;
    },
  });
  assert.throws(() => validatePropulsionEvidence(hostile), /accessors/);
  assert.equal(touched, false);
  const forged = JSON.stringify(example()).replace('"format":', '"__proto__":{},"format":');
  assert.throws(() => validatePropulsionEvidence(forged), /Forbidden|forbidden/);
});

test('256 samples remain bounded and evaluable, and canonical axis collapse is rejected', () => {
  const source = example();
  source.domain.intervals = [[0, 1]];
  source.samples = Array.from({ length: 256 }, (_, i) => ({
    values: { ...empty(), command: i / 255, thrust: i / 255 },
    uncertainty: empty(),
  }));
  const evaluator = createPropulsionEvidenceEvaluator(source);
  near(evaluator.evaluate(0.5).values.thrust, 0.5);
  const collapse = example();
  collapse.units.command = 'percent';
  collapse.samples[0].values.command = 0;
  collapse.samples[1].values.command = Number.MIN_VALUE;
  collapse.samples[2].values.command = 100;
  collapse.domain.intervals = [[0, 100]];
  assert.throws(() => validatePropulsionEvidence(collapse), /Canonical evidence axis/);
});

test('frozen evaluator identity is stable across key ordering and caller/result mutations', () => {
  const source = example(),
    evaluator = createPropulsionEvidenceEvaluator(source);
  const reordered = Object.fromEntries(Object.entries(source).reverse());
  assert.equal(createPropulsionEvidenceEvaluator(reordered).identity, evaluator.identity);
  source.samples[1].values.thrust = 99;
  assert.equal(evaluator.evaluate(0.5).values.thrust, 4);
  const result = evaluator.evaluate(0.5);
  result.values.thrust = 99;
  result.axis.field = 'voltage';
  assert.equal(evaluator.evaluate(0.5).values.thrust, 4);
  assert.equal(evaluator.axis.field, 'command');
  assert.throws(() => {
    evaluator.samples[0].values.thrust = 99;
  }, TypeError);
  assert.throws(() => {
    evaluator.evidence.conditions.notes = 'changed';
  }, TypeError);
  assert.notEqual(createPropulsionEvidenceEvaluator(source).identity, evaluator.identity);
  for (const query of [NaN, Infinity, null, '0.5', undefined])
    assert.throws(() => evaluator.evaluate(query), /one finite axis/);
});

test('evidence evaluator does not couple to aircraft runtime, presets or network execution', async () => {
  const text = await readFile(
    new URL('../../optional-practice/civilian-fpv/propulsion-evidence.mjs', import.meta.url),
    'utf8',
  );
  assert.deepEqual(
    [...text.matchAll(/^import .* from '([^']+)';/gm)].map((match) => match[1]),
    ['../../game/data-json.mjs'],
  );
  assert.doesNotMatch(text, /\bfetch\s*\(|\bXMLHttpRequest\b|\.setItem\s*\(/);
});
