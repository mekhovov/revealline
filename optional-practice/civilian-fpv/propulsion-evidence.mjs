import { boundedJSON, dataIdentity, exactKeys, required, stableId } from '../../game/data-json.mjs';

export const PROPULSION_EVIDENCE_FORMAT = 'PropulsionEvidence.v1';
export const PROPULSION_EVIDENCE_LIMITS = Object.freeze({
  maxBytes: 256 * 1024,
  maxSamples: 256,
  maxIntervals: 32,
});
export const PROPULSION_EVIDENCE_FIELDS = Object.freeze([
  'command',
  'rpm',
  'voltage',
  'airspeed',
  'thrust',
  'torque',
  'current',
]);
const FIELDS = PROPULSION_EVIDENCE_FIELDS;
const AXES = ['command', 'rpm', 'voltage', 'airspeed'];
const PI = 3.141592653589793;
const UNITS = {
  command: { normalized: [1, 'normalized'], percent: [0.01, 'normalized'], us: [1, 'us'] },
  rpm: { rpm: [1, 'rpm'], 'rad/s': [60 / (2 * PI), 'rpm'] },
  voltage: { V: [1, 'V'], mV: [0.001, 'V'] },
  airspeed: { 'm/s': [1, 'm/s'], 'km/h': [1 / 3.6, 'm/s'] },
  thrust: { N: [1, 'N'], gf: [0.00980665, 'N'], kgf: [9.80665, 'N'] },
  torque: { 'N*m': [1, 'N*m'], 'N*cm': [0.01, 'N*m'] },
  current: { A: [1, 'A'], mA: [0.001, 'A'] },
};
const LIMITS = {
  rpm: [0, 1e6],
  voltage: [0, 1000],
  airspeed: [0, 1000],
  thrust: [-1e5, 1e5],
  torque: [-1e4, 1e4],
  current: [-1e4, 1e4],
};
const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const copy = (v) => structuredClone(v);
const allFields = (value) => Object.fromEntries(FIELDS.map((field) => [field, value]));
const text = (v, max, nullable = false) =>
  (nullable && v === null) || (typeof v === 'string' && v.trim().length > 0 && v.length <= max);

function keys(value, allowed, label) {
  exactKeys(value, allowed, label);
  required(
    allowed.every((key) => Object.hasOwn(value, key)),
    `${label} has missing fields`,
  );
}
function url(value) {
  if (value === null) return true;
  if (!text(value, 2048)) return false;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
function date(value) {
  return (
    value === null ||
    (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value)
  );
}
function channelBounds(field, unit) {
  return field === 'command' ? [0, unit === 'us' ? 10000 : 1] : LIMITS[field];
}
function canonical(value, unit, field) {
  return value === null ? null : value * UNITS[field][unit][0];
}
function normalizedSample(sample, units) {
  return Object.fromEntries(
    ['values', 'uncertainty'].map((kind) => [
      kind,
      Object.fromEntries(
        FIELDS.map((field) => [field, canonical(sample[kind][field], units[field], field)]),
      ),
    ]),
  );
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Validate data only: no URLs are fetched, licenses inferred, samples fitted,
 * or settings applied to any aircraft. Source units and observations survive. */
export function validatePropulsionEvidence(source) {
  const value = boundedJSON(source, {
    maxBytes: PROPULSION_EVIDENCE_LIMITS.maxBytes,
    maxNodes: 16000,
    maxDepth: 8,
    maxArray: PROPULSION_EVIDENCE_LIMITS.maxSamples,
    maxString: 4096,
  });
  keys(
    value,
    [
      'format',
      'id',
      'name',
      'source',
      'components',
      'conditions',
      'units',
      'uncertainty',
      'domain',
      'samples',
    ],
    'Propulsion evidence',
  );
  required(value.format === PROPULSION_EVIDENCE_FORMAT, 'Unsupported propulsion evidence format');
  required(stableId(value.id) && text(value.name, 160), 'Invalid propulsion evidence identity');
  const sourceData = value.source;
  keys(
    sourceData,
    ['kind', 'title', 'url', 'revision', 'retrievedAt', 'sha256', 'license'],
    'Evidence source',
  );
  required(
    ['measured', 'calculated', 'synthetic'].includes(sourceData.kind),
    'Invalid evidence kind',
  );
  required(
    text(sourceData.title, 240) &&
      url(sourceData.url) &&
      text(sourceData.revision, 160, true) &&
      date(sourceData.retrievedAt),
    'Invalid evidence source metadata',
  );
  required(
    sourceData.sha256 === null ||
      (typeof sourceData.sha256 === 'string' && /^[a-fA-F0-9]{64}$/.test(sourceData.sha256)),
    'Invalid source SHA-256',
  );
  keys(sourceData.license, ['id', 'url', 'attribution', 'redistribution'], 'Evidence license');
  required(
    text(sourceData.license.id, 160, true) &&
      url(sourceData.license.url) &&
      text(sourceData.license.attribution, 2048, true) &&
      ['permitted', 'unknown', 'restricted'].includes(sourceData.license.redistribution),
    'Invalid evidence license metadata',
  );
  required(
    sourceData.license.redistribution !== 'permitted' ||
      (sourceData.license.id !== null && sourceData.license.attribution !== null),
    'Permitted redistribution needs an explicit license and attribution',
  );
  keys(
    value.components,
    ['motor', 'propeller', 'esc', 'escFirmware', 'controlProtocol'],
    'Evidence components',
  );
  required(
    Object.values(value.components).every((v) => text(v, 240, true)),
    'Invalid component description',
  );
  const conditions = value.conditions;
  keys(
    conditions,
    [
      'flow',
      'scope',
      'airDensityKgM3',
      'temperatureC',
      'pressurePa',
      'humidityRatio',
      'installation',
      'notes',
    ],
    'Evidence conditions',
  );
  required(
    ['static', 'axial', 'edgewise', 'mixed', 'unknown'].includes(conditions.flow),
    'Invalid flow condition',
  );
  required(
    ['single-rotor', 'whole-aircraft', 'unknown'].includes(conditions.scope),
    'Invalid measurement scope',
  );
  for (const [field, limits] of Object.entries({
    airDensityKgM3: [0.001, 20],
    temperatureC: [-100, 150],
    pressurePa: [1, 2e6],
    humidityRatio: [0, 1],
  }))
    required(
      conditions[field] === null || finite(conditions[field], ...limits),
      `Invalid condition ${field}`,
    );
  required(
    text(conditions.installation, 1024, true) && text(conditions.notes, 4096, true),
    'Invalid evidence conditions',
  );
  keys(value.uncertainty, ['kind', 'coverageFactor', 'notes'], 'Evidence uncertainty');
  required(
    ['unknown', 'reported', 'absolute-bound', 'standard', 'expanded'].includes(
      value.uncertainty.kind,
    ),
    'Invalid uncertainty kind',
  );
  required(
    value.uncertainty.coverageFactor === null || finite(value.uncertainty.coverageFactor, 1, 10),
    'Invalid uncertainty coverage factor',
  );
  required(
    value.uncertainty.kind === 'expanded' || value.uncertainty.coverageFactor === null,
    'Coverage factor is only meaningful for expanded uncertainty',
  );
  required(text(value.uncertainty.notes, 2048, true), 'Invalid uncertainty notes');
  keys(value.units, FIELDS, 'Evidence units');
  for (const field of FIELDS)
    required(
      value.units[field] === null ||
        (typeof value.units[field] === 'string' && Object.hasOwn(UNITS[field], value.units[field])),
      `Unsupported ${field} unit`,
    );
  keys(value.domain, ['kind', 'axis', 'intervals'], 'Evidence domain');
  required(
    value.domain.kind === 'one-dimensional-path' && AXES.includes(value.domain.axis),
    'Unsupported evidence domain',
  );
  const axis = value.domain.axis;
  required(value.units[axis] !== null, 'Evidence axis needs explicit units');
  required(
    Array.isArray(value.samples) && value.samples.length >= 2,
    'Evidence needs at least two samples',
  );
  let previous = -Infinity,
    previousCanonical = -Infinity;
  const xs = [];
  for (const sample of value.samples) {
    keys(sample, ['values', 'uncertainty'], 'Evidence sample');
    for (const kind of ['values', 'uncertainty']) keys(sample[kind], FIELDS, `Sample ${kind}`);
    for (const field of FIELDS) {
      const v = sample.values[field],
        u = sample.uncertainty[field],
        unit = value.units[field];
      required(v === null || unit !== null, `${field} measurement needs units`);
      required(u === null || v !== null, `${field} uncertainty needs a measurement`);
      if (v !== null) {
        const bounds = channelBounds(field, unit);
        required(
          typeof v === 'number' && finite(canonical(v, unit, field), ...bounds),
          `Invalid ${field} measurement`,
        );
        required(
          u === null ||
            (typeof u === 'number' &&
              finite(canonical(u, unit, field), 0, Math.max(...bounds.map(Math.abs)))),
          `Invalid ${field} uncertainty`,
        );
      }
    }
    required(
      sample.values[axis] !== null && sample.values[axis] > previous,
      'Evidence axis samples must be present and strictly increasing',
    );
    const canonicalAxis = canonical(sample.values[axis], value.units[axis], axis);
    required(
      canonicalAxis > previousCanonical,
      'Canonical evidence axis samples must be strictly increasing',
    );
    previousCanonical = canonicalAxis;
    previous = sample.values[axis];
    xs.push(previous);
    required(
      conditions.flow !== 'static' ||
        sample.values.airspeed === null ||
        sample.values.airspeed === 0,
      'Static evidence cannot have nonzero airspeed',
    );
  }
  required(
    value.samples.some((sample) =>
      ['thrust', 'torque', 'current'].some((field) => sample.values[field] !== null),
    ),
    'Evidence needs at least one load measurement',
  );
  const intervals = value.domain.intervals;
  required(
    Array.isArray(intervals) &&
      intervals.length >= 1 &&
      intervals.length <= PROPULSION_EVIDENCE_LIMITS.maxIntervals,
    'Invalid evidence intervals',
  );
  previous = -Infinity;
  for (const interval of intervals) {
    required(
      Array.isArray(interval) && interval.length === 2 && interval.every(Number.isFinite),
      'Invalid coverage interval',
    );
    const [low, high] = interval;
    required(
      low <= high && low > previous && xs.includes(low) && xs.includes(high),
      'Coverage intervals must have sampled endpoints and be disjoint and sorted',
    );
    previous = high;
  }
  required(
    xs.every((x) => intervals.some(([low, high]) => x >= low && x <= high)),
    'Every sample must belong to a declared interval',
  );
  return value;
}

const diagnostic = (code, fields, sample = null, severity = 'warning') => ({
  code,
  fields,
  sample,
  severity,
});
function energy(values) {
  const { voltage, current, rpm, torque } = values;
  const electricalWatts = voltage === null || current === null ? null : voltage * current;
  const shaftWatts = rpm === null || torque === null ? null : torque * ((2 * PI * rpm) / 60);
  return {
    electricalWatts,
    shaftWatts,
    efficiency:
      electricalWatts !== null && electricalWatts > 0 && shaftWatts !== null
        ? shaftWatts / electricalWatts
        : null,
  };
}
function pointDiagnostics(values, sample = null) {
  const diagnostics = [];
  const negative = ['thrust', 'torque', 'current'].filter(
    (field) => values[field] !== null && values[field] < 0,
  );
  if (negative.length) diagnostics.push(diagnostic('negative-load-reading', negative, sample));
  const power = energy(values);
  if (
    power.shaftWatts !== null &&
    power.electricalWatts !== null &&
    power.shaftWatts > power.electricalWatts + 1e-9 * Math.max(1, Math.abs(power.electricalWatts))
  )
    diagnostics.push(
      diagnostic(
        'shaft-power-exceeds-electrical-central-values',
        ['rpm', 'torque', 'voltage', 'current'],
        sample,
      ),
    );
  return diagnostics;
}

/** A path is not a voltage/throttle surface. Evaluation accepts only its one
 * axis; other coordinates are observed outputs, never requested conditions. */
export function createPropulsionEvidenceEvaluator(source) {
  const evidence = validatePropulsionEvidence(source);
  const field = evidence.domain.axis;
  const unit = UNITS[field][evidence.units[field]][1];
  const samples = evidence.samples.map((sample) => normalizedSample(sample, evidence.units));
  const intervals = evidence.domain.intervals.map((interval) =>
    interval.map((value) => canonical(value, evidence.units[field], field)),
  );
  const units = Object.fromEntries(
    FIELDS.map((name) => [
      name,
      evidence.units[name] === null ? null : UNITS[name][evidence.units[name]][1],
    ]),
  );
  const diagnostics = samples.flatMap((sample, index) => pointDiagnostics(sample.values, index));
  const missing = FIELDS.filter((name) => samples.every((sample) => sample.values[name] === null));
  if (missing.length) diagnostics.push(diagnostic('channels-unavailable', missing, null, 'info'));
  if (evidence.source.license.redistribution !== 'permitted')
    diagnostics.push(diagnostic('redistribution-not-confirmed', [], null, 'info'));
  if (evidence.conditions.airDensityKgM3 === null)
    diagnostics.push(diagnostic('air-density-unavailable', [], null, 'info'));
  const axis = { field, unit };
  const evaluate = (value) => {
    required(
      typeof value === 'number' && Number.isFinite(value),
      'Evaluation needs one finite axis value in canonical units',
    );
    const interval = intervals.find(([low, high]) => value >= low && value <= high);
    if (!interval)
      return {
        status: 'outside-coverage',
        reason:
          value < intervals[0][0]
            ? 'below-domain'
            : value > intervals.at(-1)[1]
              ? 'above-domain'
              : 'coverage-gap',
        sourceKind: evidence.source.kind,
        axis: copy(axis),
        value,
        bracket: null,
        fraction: null,
        values: null,
        uncertainty: null,
        uncertaintyBasis: null,
        missingFields: [...FIELDS],
        power: null,
        diagnostics: [],
      };
    let upper = samples.findIndex((sample) => sample.values[field] >= value);
    const exact = samples[upper].values[field] === value;
    const lower = exact ? upper : upper - 1;
    const a = samples[lower],
      b = samples[upper];
    const fraction = exact ? 0 : (value - a.values[field]) / (b.values[field] - a.values[field]);
    const interpolate = (kind) =>
      Object.fromEntries(
        FIELDS.map((name) => {
          const av = a[kind][name],
            bv = b[kind][name];
          return [name, av === null || bv === null ? null : av + (bv - av) * fraction];
        }),
      );
    const values = interpolate('values'),
      uncertainty = interpolate('uncertainty');
    // Preserve the exact query coordinate instead of its floating point reconstruction.
    values[field] = value;
    const resultDiagnostics = pointDiagnostics(values, exact ? upper : null);
    if (!exact)
      resultDiagnostics.push(
        diagnostic('interpolation-uncertainty-excludes-model-error', [], null, 'info'),
      );
    return {
      status: exact ? 'sample' : 'interpolated',
      sourceKind: evidence.source.kind,
      axis: copy(axis),
      value,
      bracket: [lower, upper],
      fraction,
      values,
      uncertainty,
      uncertaintyBasis: exact ? 'source-reported' : 'linear-endpoint-values-not-model-error',
      missingFields: FIELDS.filter((name) => values[name] === null),
      power: energy(values),
      diagnostics: resultDiagnostics,
    };
  };
  return Object.freeze({
    identity: dataIdentity(evidence),
    evidence: freeze(evidence),
    axis: freeze(axis),
    units: freeze(units),
    intervals: freeze(intervals),
    samples: freeze(samples),
    diagnostics: freeze(diagnostics),
    evaluate,
  });
}

/** Small SIM-authored example for import/compare UI and offline demonstrations.
 * These invented bench numbers are never a real-aircraft preset or measurement. */
export function createSyntheticPropulsionEvidence() {
  const source = {
    format: PROPULSION_EVIDENCE_FORMAT,
    id: 'sim-synthetic-propulsion-example',
    name: 'Synthetic propulsion example',
    source: {
      kind: 'synthetic',
      title: 'SIM-authored numerical example',
      url: null,
      revision: '1',
      retrievedAt: null,
      sha256: null,
      license: {
        id: 'CC0-1.0',
        url: 'https://creativecommons.org/publicdomain/zero/1.0/',
        attribution: 'SIM-authored synthetic test data; no real aircraft measurements.',
        redistribution: 'permitted',
      },
    },
    components: {
      motor: 'Synthetic motor',
      propeller: 'Synthetic propeller',
      esc: null,
      escFirmware: null,
      controlProtocol: 'Normalized example command',
    },
    conditions: {
      flow: 'static',
      scope: 'single-rotor',
      airDensityKgM3: null,
      temperatureC: null,
      pressurePa: null,
      humidityRatio: null,
      installation: null,
      notes: 'Invented values for software demonstrations only.',
    },
    units: {
      command: 'normalized',
      rpm: 'rpm',
      voltage: 'V',
      airspeed: 'm/s',
      thrust: 'N',
      torque: 'N*m',
      current: 'A',
    },
    uncertainty: {
      kind: 'unknown',
      coverageFactor: null,
      notes: 'Synthetic values have no measurement uncertainty estimate.',
    },
    domain: { kind: 'one-dimensional-path', axis: 'command', intervals: [[0.25, 1]] },
    samples: [
      [0.25, 3000, 12, 0, 1, 0.01, 1],
      [0.5, 6000, 12, 0, 4, 0.04, 4],
      [1, 12000, 12, 0, 16, 0.16, 24],
    ].map((row) => ({
      values: Object.fromEntries(FIELDS.map((field, index) => [field, row[index]])),
      uncertainty: allFields(null),
    })),
  };
  return validatePropulsionEvidence(source);
}
