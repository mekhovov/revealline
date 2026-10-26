import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../../game/data-json.mjs';
import {
  PROPULSION_EVIDENCE_FIELDS,
  PROPULSION_EVIDENCE_FORMAT,
  PROPULSION_EVIDENCE_LIMITS,
  createPropulsionEvidenceEvaluator,
} from './propulsion-evidence.mjs';
import { solvePropulsionEvidenceLoad } from './propulsion-load.mjs';

export const PROPULSION_SURFACE_FORMAT = 'PropulsionSurface.v1';
export const PROPULSION_SURFACE_LOAD_FORMAT = 'PropulsionSurfaceLoad.v1';
export const PROPULSION_SURFACE_LIMITS = Object.freeze({
  maxBytes: 256 * 1024,
  maxPaths: 16,
  maxSamples: 256,
  maxCells: 256,
});
const FIELDS = PROPULSION_EVIDENCE_FIELDS;
const copy = (value) => structuredClone(value);
const finite = (value, low, high) =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const empty = () => Object.fromEntries(FIELDS.map((field) => [field, null]));
function keys(value, allowed, label) {
  exactKeys(value, allowed, label);
  required(
    allowed.every((key) => Object.hasOwn(value, key)),
    `${label} has missing fields`,
  );
}
function parse(source) {
  return boundedJSON(source, {
    maxBytes: PROPULSION_SURFACE_LIMITS.maxBytes,
    maxNodes: 20000,
    maxDepth: 10,
    maxArray: 256,
    maxString: 4096,
  });
}

/** A surface explicitly composes original voltage sweeps. Source metadata and
 * uncertainty remain attached to each sweep, never promoted to aircraft data. */
function compile(source) {
  const surface = parse(source);
  keys(surface, ['format', 'id', 'name', 'currentBasis', 'paths', 'cells'], 'Propulsion surface');
  required(surface.format === PROPULSION_SURFACE_FORMAT, 'Unsupported propulsion surface format');
  required(
    stableId(surface.id) &&
      typeof surface.name === 'string' &&
      surface.name.trim().length > 0 &&
      surface.name.length <= 160,
    'Invalid propulsion surface identity',
  );
  required(
    ['dc-input-at-recorded-voltage', 'phase-current', 'unknown'].includes(surface.currentBasis),
    'Invalid surface current basis',
  );
  required(
    Array.isArray(surface.paths) &&
      surface.paths.length >= 2 &&
      surface.paths.length <= PROPULSION_SURFACE_LIMITS.maxPaths,
    'A surface needs two to sixteen voltage paths',
  );
  const paths = surface.paths.map(createPropulsionEvidenceEvaluator);
  required(
    paths.reduce((sum, path) => sum + path.samples.length, 0) <=
      PROPULSION_SURFACE_LIMITS.maxSamples,
    'Too many surface samples',
  );
  const components = canonicalJSON(paths[0].evidence.components),
    conditions = canonicalJSON(paths[0].evidence.conditions);
  required(
    Object.values(paths[0].evidence.components).every((value) => value !== null),
    'A surface needs explicit motor, propeller, ESC, firmware and control protocol',
  );
  const commands = [];
  for (const path of paths) {
    required(path.axis.field === 'voltage', 'Surface paths must use the voltage axis');
    required(
      canonicalJSON(path.evidence.components) === components &&
        canonicalJSON(path.evidence.conditions) === conditions,
      'Surface paths must declare identical components and conditions',
    );
    required(
      path.units.command === paths[0].units.command,
      'Surface command units must be compatible',
    );
    const command = path.samples[0].values.command;
    required(
      command !== null && path.samples.every((sample) => sample.values.command === command),
      'Each surface path needs one fixed observed command',
    );
    required(
      commands.length === 0 || command > commands.at(-1),
      'Surface commands must be strictly increasing',
    );
    commands.push(command);
  }
  const voltages = [
    ...new Set(paths.flatMap((path) => path.samples.map((sample) => sample.values.voltage))),
  ].sort((a, b) => a - b);
  const units = Object.fromEntries(
    FIELDS.map((field) => [
      field,
      paths.find((path) => path.units[field] !== null)?.units[field] ?? null,
    ]),
  );
  required(
    Array.isArray(surface.cells) &&
      surface.cells.length >= 1 &&
      surface.cells.length <= PROPULSION_SURFACE_LIMITS.maxCells,
    'A surface needs one to 256 declared cells',
  );
  let previous = -1;
  for (const cell of surface.cells) {
    required(
      Array.isArray(cell) && cell.length === 2 && cell.every(Number.isInteger),
      'Surface cell needs command and voltage indexes',
    );
    const [c, v] = cell;
    required(
      c >= 0 && c < paths.length - 1 && v >= 0 && v < voltages.length - 1,
      'Surface cell index outside grid',
    );
    const ordinal = c * voltages.length + v;
    required(ordinal > previous, 'Surface cells must be unique and sorted');
    previous = ordinal;
    for (const path of [paths[c], paths[c + 1]]) {
      const low = voltages[v],
        high = voltages[v + 1];
      required(
        path.samples.some((sample) => sample.values.voltage === low) &&
          path.samples.some((sample) => sample.values.voltage === high),
        'A surface cell needs four observed corners',
      );
      required(
        path.intervals.some(([from, to]) => from <= low && to >= high),
        'A surface cell cannot bridge a path coverage gap',
      );
    }
  }
  return { surface, paths, commands, voltages, units };
}

export function validatePropulsionSurface(source) {
  return compile(source).surface;
}

function nonmonotone(a, b) {
  return ['rpm', 'thrust', 'torque', 'current'].filter(
    (field) => a[field] !== null && b[field] !== null && b[field] < a[field],
  );
}
function power(values, currentBasis) {
  const electricalWatts =
    currentBasis === 'dc-input-at-recorded-voltage' && values.current !== null
      ? values.voltage * values.current
      : null;
  const shaftWatts =
    values.rpm !== null && values.torque !== null
      ? values.torque * ((2 * 3.141592653589793 * values.rpm) / 60)
      : null;
  return {
    electricalWatts,
    shaftWatts,
    efficiency:
      electricalWatts !== null && electricalWatts > 0 && shaftWatts !== null
        ? shaftWatts / electricalWatts
        : null,
  };
}

/** Commands are in the paths' common canonical unit (normalized or us), voltage
 * is in V. No epsilon, snapping, extrapolation, triangulation or inferred cells.
 * Original one-dimensional coverage remains available at an exact path command. */
export function createPropulsionSurfaceEvaluator(source) {
  const { surface, paths, commands, voltages, units } = compile(source);
  const diagnostics = paths.flatMap((path, pathIndex) =>
    path.diagnostics
      .filter(
        (item) =>
          surface.currentBasis === 'dc-input-at-recorded-voltage' ||
          item.code !== 'shaft-power-exceeds-electrical-central-values',
      )
      .map((item) => ({ ...copy(item), pathIndex })),
  );
  const warn = (code, fields, paths, samples) =>
    diagnostics.push({ code, fields, paths, samples, severity: 'warning' });
  paths.forEach((path, pathIndex) => {
    path.samples.slice(1).forEach((sample, index) => {
      const fields = nonmonotone(path.samples[index].values, sample.values);
      if (fields.length) warn('nonmonotone-load-voltage', fields, [pathIndex], [index, index + 1]);
    });
  });
  for (let i = 0; i < paths.length - 1; i++) {
    for (let j = 0; j < paths[i].samples.length; j++) {
      const a = paths[i].samples[j].values,
        k = paths[i + 1].samples.findIndex((sample) => sample.values.voltage === a.voltage);
      if (k < 0) continue;
      const fields = nonmonotone(a, paths[i + 1].samples[k].values);
      if (fields.length) warn('nonmonotone-load-command', fields, [i, i + 1], [j, k]);
    }
  }
  if (surface.cells.length < (commands.length - 1) * (voltages.length - 1))
    diagnostics.push({ code: 'partial-cell-coverage', fields: [], severity: 'info' });
  const identity = dataIdentity(surface);
  const sources = (indexes) =>
    indexes.map((index) => ({
      pathIndex: index,
      identity: paths[index].identity,
      source: copy(paths[index].evidence.source),
      uncertainty: copy(paths[index].evidence.uncertainty),
    }));
  function evaluate(query) {
    query = boundedJSON(query, {
      maxBytes: 256,
      maxNodes: 4,
      maxDepth: 2,
      maxArray: 2,
      maxString: 64,
    });
    keys(query, ['command', 'voltage'], 'Surface query');
    required(
      finite(query.command, -Infinity, Infinity) && finite(query.voltage, -Infinity, Infinity),
      'Surface query needs finite canonical coordinates',
    );
    const { command, voltage } = query;
    const result = {
      status: 'outside-coverage',
      reason: 'coverage-gap',
      resultKind: 'calculated',
      command,
      voltage,
      cell: null,
      fractions: null,
      sources: [],
      values: null,
      uncertainty: null,
      uncertaintyBasis: null,
      missingFields: [...FIELDS],
      power: null,
      diagnostics: [],
    };
    if (
      command < commands[0] ||
      command > commands.at(-1) ||
      voltage < voltages[0] ||
      voltage > voltages.at(-1)
    )
      return { ...result, reason: 'outside-domain' };
    const pathIndex = commands.indexOf(command);
    let points,
      indexes,
      fraction = 0;
    if (pathIndex >= 0) {
      const point = paths[pathIndex].evaluate(voltage);
      if (point.status === 'outside-coverage') return result;
      points = [point];
      indexes = [pathIndex];
      result.status = point.status;
      result.uncertaintyBasis = point.uncertaintyBasis;
      result.diagnostics = point.diagnostics.filter(
        (item) =>
          surface.currentBasis === 'dc-input-at-recorded-voltage' ||
          item.code !== 'shaft-power-exceeds-electrical-central-values',
      );
    } else {
      const upper = commands.findIndex((value) => value > command);
      const cell = surface.cells.find(
        ([c, v]) => c === upper - 1 && voltage >= voltages[v] && voltage <= voltages[v + 1],
      );
      if (!cell) return result;
      const [c, v] = cell;
      fraction = (command - commands[c]) / (commands[c + 1] - commands[c]);
      points = [paths[c].evaluate(voltage), paths[c + 1].evaluate(voltage)];
      indexes = [c, c + 1];
      result.status = 'interpolated';
      result.cell = [...cell];
      result.fractions = {
        command: fraction,
        voltage: (voltage - voltages[v]) / (voltages[v + 1] - voltages[v]),
      };
      result.uncertaintyBasis = 'bilinear-endpoint-values-not-model-error';
      result.diagnostics = [
        { code: 'interpolation-uncertainty-excludes-model-error', fields: [], severity: 'info' },
      ];
    }
    for (const kind of ['values', 'uncertainty']) {
      result[kind] = Object.fromEntries(
        FIELDS.map((field) => {
          const a = points[0][kind][field],
            b = points.at(-1)[kind][field];
          return [field, a === null || b === null ? null : a + (b - a) * fraction];
        }),
      );
    }
    result.values.command = command;
    result.values.voltage = voltage;
    if (
      indexes.length === 2 &&
      canonicalJSON(paths[indexes[0]].evidence.uncertainty) !==
        canonicalJSON(paths[indexes[1]].evidence.uncertainty)
    ) {
      result.uncertainty = empty();
      result.uncertaintyBasis = 'unavailable-incompatible-source-uncertainty';
      result.diagnostics.push({
        code: 'incompatible-source-uncertainty',
        fields: [...FIELDS],
        severity: 'info',
      });
    }
    result.reason = null;
    result.sources = sources(indexes);
    result.resultKind = result.status === 'sample' ? 'source-sample' : 'calculated';
    result.missingFields = FIELDS.filter((field) => result.values[field] === null);
    result.power = power(result.values, surface.currentBasis);
    const diagnose = (code, fields) => {
      if (!result.diagnostics.some((item) => item.code === code))
        result.diagnostics.push({ code, fields, sample: null, severity: 'warning' });
    };
    const negative = ['thrust', 'torque', 'current'].filter(
      (field) => result.values[field] !== null && result.values[field] < 0,
    );
    if (negative.length) diagnose('negative-load-reading', negative);
    const { shaftWatts, electricalWatts } = result.power;
    // Bilinear channel interpolation does not preserve inequalities between
    // products (RPM × torque versus voltage × current). Diagnose the result.
    if (
      shaftWatts !== null &&
      electricalWatts !== null &&
      shaftWatts > electricalWatts + 1e-9 * Math.max(1, Math.abs(electricalWatts))
    )
      diagnose('shaft-power-exceeds-electrical-central-values', [
        'rpm',
        'torque',
        'voltage',
        'current',
      ]);
    return result;
  }
  return Object.freeze({
    identity,
    surface: freeze(surface),
    commands: freeze(commands),
    voltages: freeze(voltages),
    units: freeze(units),
    diagnostics: freeze(diagnostics),
    evaluate,
  });
}

function sourceLoadReason(evaluator, command) {
  const { commands, surface } = evaluator;
  const exact = commands.indexOf(command),
    upper = commands.findIndex((value) => value > command);
  const indexes = exact >= 0 ? [exact] : [upper - 1, upper];
  for (const index of indexes) {
    const path = createPropulsionEvidenceEvaluator(surface.paths[index]);
    const points = path.samples.map((sample) => sample.values);
    if (path.evidence.conditions.scope !== 'single-rotor') return 'single-rotor-required';
    if (path.evidence.conditions.flow !== 'static') return 'static-flow-required';
    if (points.some((point) => point.airspeed !== 0)) return 'known-zero-airspeed-required';
    if (points.some((point) => point.current === null)) return 'current-unavailable';
    if (points.some((point) => point.current < 0)) return 'negative-current';
    if (points.some((point, i) => i > 0 && point.current < points[i - 1].current))
      return 'nonmonotone-current';
  }
  return null;
}

function voltageSlice(evaluator, command) {
  const { surface, commands, voltages } = evaluator;
  const exact = commands.indexOf(command);
  if (exact >= 0) return { kind: 'original-voltage-path', evidence: copy(surface.paths[exact]) };
  const upper = commands.findIndex((value) => value > command);
  if (command < commands[0] || upper < 0) return null;
  const intervals = [];
  for (const [c, v] of surface.cells) {
    if (c !== upper - 1) continue;
    const low = voltages[v],
      high = voltages[v + 1];
    if (intervals.at(-1)?.[1] === low) intervals.at(-1)[1] = high;
    else intervals.push([low, high]);
  }
  if (!intervals.length) return null;
  const knots = voltages.filter((voltage) =>
    intervals.some(([low, high]) => voltage >= low && voltage <= high),
  );
  const first = surface.paths[0];
  return {
    kind: 'calculated-command-slice',
    evidence: {
      format: PROPULSION_EVIDENCE_FORMAT,
      id: 'calculated-surface-slice',
      name: 'Calculated fixed-command surface slice',
      source: {
        kind: 'calculated',
        title: 'Interpolation of supplied propulsion surface',
        url: null,
        revision: evaluator.identity,
        retrievedAt: null,
        sha256: null,
        license: { id: null, url: null, attribution: null, redistribution: 'unknown' },
      },
      components: copy(first.components),
      conditions: copy(first.conditions),
      units: copy(evaluator.units),
      uncertainty: {
        kind: 'unknown',
        coverageFactor: null,
        notes:
          'Central values only. Source uncertainty and interpolation error are not propagated.',
      },
      domain: { kind: 'one-dimensional-path', axis: 'voltage', intervals },
      samples: knots.map((voltage) => ({
        values: evaluator.evaluate({ command, voltage }).values,
        uncertainty: empty(),
      })),
    },
  };
}

function intersectIntervals(a, b) {
  const result = [];
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    const low = Math.max(a[i][0], b[j][0]),
      high = Math.min(a[i][1], b[j][1]);
    if (low <= high) result.push([low, high]);
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return result;
}

// A valid sparse surface may have more derived intervals than the older path
// format admits. Keep that contract unchanged and solve bounded common windows.
// Only oversized calculated slices are restricted; original paths stay intact.
function solveSlices(slices, inputs) {
  const solve = (evidence) =>
    solvePropulsionEvidenceLoad({
      evidence,
      ...inputs,
      currentBasis: 'dc-input-at-recorded-voltage',
    });
  const oversized = (slice) =>
    slice.evidence.domain.intervals.length > PROPULSION_EVIDENCE_LIMITS.maxIntervals;
  if (!slices.some(oversized)) {
    const load = solve(slices.map((slice) => slice.evidence));
    return {
      load,
      status: load.status,
      reason: load.reason,
      surfaceIndex: load.pathIndex,
      loadCoverage: 'complete-slices',
      commonIntervals: copy(load.intervals),
    };
  }
  const toVolts = (evidence) => (evidence.units.voltage === 'mV' ? 0.001 : 1);
  const coverage = slices.map(({ evidence }) =>
    evidence.domain.intervals.map((interval) =>
      interval.map((voltage) => voltage * toVolts(evidence)),
    ),
  );
  let commonIntervals = coverage[0];
  for (const intervals of coverage.slice(1))
    commonIntervals = intersectIntervals(commonIntervals, intervals);
  const result = {
    loadCoverage: 'bounded-window',
    commonIntervals,
    load: null,
    status: 'unavailable',
    reason: 'no-common-coverage',
    surfaceIndex: null,
  };
  for (let index = 0; index < commonIntervals.length; index++) {
    const [low, high] = commonIntervals[index];
    const evidence = slices.map((slice) => {
      if (!oversized(slice)) return slice.evidence;
      const source = slice.evidence,
        scale = toVolts(source);
      const interval = source.domain.intervals.find(
        ([from, to]) => from * scale <= low && to * scale >= high,
      );
      // Every admitted cell has distinct observed voltage endpoints, so this
      // interval retains at least two samples even for a point intersection.
      return {
        ...source,
        domain: { ...source.domain, intervals: [interval] },
        samples: source.samples.filter(
          ({ values }) => values.voltage >= interval[0] && values.voltage <= interval[1],
        ),
      };
    });
    const load = solve(evidence);
    result.load = load;
    if (load.reason === 'root-above-coverage') {
      result.reason = load.reason;
      continue;
    }
    // The retained delegated receipt describes its window. The wrapper's
    // reason describes the complete sparse coverage, including earlier windows.
    return {
      ...result,
      status: load.status,
      surfaceIndex: load.pathIndex,
      reason:
        load.reason === 'root-below-coverage' && index > 0 ? 'root-in-coverage-gap' : load.reason,
    };
  }
  return result;
}

/** Non-activating bench calculation at independently specified commands. The
 * existing load kernel checks voltage-current monotonicity and circuit residual.
 * Provenance stays with the surface; a calculated slice is never measured data. */
export function solvePropulsionSurfaceLoad(source) {
  const options = boundedJSON(source, {
    maxBytes: 4 * PROPULSION_SURFACE_LIMITS.maxBytes + 2048,
    maxNodes: 81000,
    maxDepth: 13,
    maxArray: 256,
    maxString: 4096,
  });
  exactKeys(options, ['loads', 'openVoltage', 'resistance', 'currentLimit'], 'Surface load');
  required(
    Array.isArray(options.loads) && options.loads.length >= 1 && options.loads.length <= 4,
    'Surface load needs one to four loads',
  );
  required(
    finite(options.openVoltage, 0, 1000) && finite(options.resistance, 0, 1000),
    'Invalid battery-model voltage or resistance',
  );
  const currentLimit = options.currentLimit ?? null;
  required(currentLimit === null || finite(currentLimit, 0, 40000), 'Invalid current limit');
  const evaluators = options.loads.map((load) => {
    keys(load, ['surface', 'command'], 'Surface load entry');
    required(
      finite(load.command, -Infinity, Infinity),
      'Load command must use finite canonical units',
    );
    return createPropulsionSurfaceEvaluator(load.surface);
  });
  const inputs = { openVoltage: options.openVoltage, resistance: options.resistance, currentLimit };
  const sources = evaluators.map((evaluator, i) => ({
    identity: evaluator.identity,
    command: options.loads[i].command,
    commandUnit: evaluator.units.command,
    currentBasis: evaluator.surface.currentBasis,
    paths: evaluator.surface.paths.map((path, pathIndex) => ({
      pathIndex,
      identity: dataIdentity(path),
      source: copy(path.source),
      components: copy(path.components),
      conditions: copy(path.conditions),
      units: copy(path.units),
      uncertainty: copy(path.uncertainty),
    })),
    diagnostics: copy(evaluator.diagnostics),
  }));
  const result = {
    format: PROPULSION_SURFACE_LOAD_FORMAT,
    resultKind: 'calculated',
    identity: dataIdentity({
      format: PROPULSION_SURFACE_LOAD_FORMAT,
      inputs,
      loads: sources.map(({ identity, command }) => ({ identity, command })),
    }),
    inputs,
    sources,
    status: 'unavailable',
    reason: null,
    surfaceIndex: null,
    sliceKinds: [],
    load: null,
  };
  const slices = [];
  for (let i = 0; i < evaluators.length; i++) {
    if (evaluators[i].surface.currentBasis !== 'dc-input-at-recorded-voltage')
      return { ...result, reason: 'dc-input-current-required', surfaceIndex: i };
    const slice = voltageSlice(evaluators[i], options.loads[i].command);
    if (!slice) return { ...result, reason: 'command-outside-coverage', surfaceIndex: i };
    const sourceReason = sourceLoadReason(evaluators[i], options.loads[i].command);
    if (sourceReason) return { ...result, reason: sourceReason, surfaceIndex: i };
    slices.push(slice);
  }
  const solved = solveSlices(slices, inputs);
  return {
    ...result,
    ...solved,
    sliceKinds: slices.map((slice) => slice.kind),
  };
}
