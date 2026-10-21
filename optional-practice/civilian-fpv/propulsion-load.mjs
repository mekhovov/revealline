import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';
import { createPropulsionEvidenceEvaluator } from './propulsion-evidence.mjs';

export const PROPULSION_LOAD_FORMAT = 'PropulsionLoad.v1';
const copy = (value) => structuredClone(value);
const finite = (value, low, high) =>
  typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;

function intersect(a, b) {
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

function unavailableReason(evaluator) {
  if (evaluator.axis.field !== 'voltage') return 'voltage-axis-required';
  const evidence = evaluator.evidence,
    points = evaluator.samples.map((sample) => sample.values);
  if (evidence.conditions.scope !== 'single-rotor') return 'single-rotor-required';
  if (evidence.conditions.flow !== 'static') return 'static-flow-required';
  if (points.some((point) => point.airspeed !== 0)) return 'known-zero-airspeed-required';
  if (points.some((point) => point.command === null)) return 'command-unavailable';
  if (points.some((point) => point.command !== points[0].command)) return 'fixed-command-required';
  if (points.some((point) => point.current === null)) return 'current-unavailable';
  if (points.some((point) => point.current < 0)) return 'negative-current';
  if (points.some((point, i) => i > 0 && point.current < points[i - 1].current))
    return 'nonmonotone-current';
  return null;
}

/** Bench calculation only. Each record is one static-rotor path
 * at a fixed command, powered by the same supplied ideal battery model. The
 * caller must assert DC input current at the recorded terminal voltage; source
 * measurement topology is not verified by this calculation.
 * Command is never interpreted as motor speed. No flight settings are changed. */
export function solvePropulsionEvidenceLoad(source) {
  const options = boundedJSON(source, {
    maxBytes: 4 * 256 * 1024 + 2048,
    maxNodes: 65000,
    maxDepth: 10,
    maxArray: 256,
    maxString: 4096,
  });
  exactKeys(
    options,
    ['evidence', 'openVoltage', 'resistance', 'currentLimit', 'currentBasis'],
    'Propulsion load',
  );
  required(
    options.currentBasis === 'dc-input-at-recorded-voltage',
    'Explicit DC input current at recorded terminal voltage is required',
  );
  required(
    Array.isArray(options.evidence) && options.evidence.length >= 1 && options.evidence.length <= 4,
    'Propulsion load needs one to four evidence records',
  );
  required(
    finite(options.openVoltage, 0, 1000) && finite(options.resistance, 0, 1000),
    'Invalid battery-model voltage or resistance',
  );
  const currentLimit = options.currentLimit ?? null;
  required(currentLimit === null || finite(currentLimit, 0, 40000), 'Invalid current limit');
  const evaluators = options.evidence.map(createPropulsionEvidenceEvaluator);
  const inputs = {
    openVoltage: options.openVoltage,
    resistance: options.resistance,
    currentLimit,
    currentBasis: options.currentBasis,
  };
  const result = {
    format: PROPULSION_LOAD_FORMAT,
    resultKind: 'calculated',
    model: {
      battery: 'ideal-fixed-open-voltage-and-series-resistance',
      loads: 'piecewise-linear-current-at-fixed-command',
      connection: 'parallel-at-common-terminal-voltage',
    },
    assumptions: {
      currentBasis: 'caller-declared',
      measurementTopology: 'unverified',
      interactionBetweenLoads: 'not-modeled',
    },
    identity: dataIdentity({
      format: PROPULSION_LOAD_FORMAT,
      inputs,
      evidence: evaluators.map((evaluator) => evaluator.identity),
    }),
    inputs,
    sources: evaluators.map((evaluator) => ({
      identity: evaluator.identity,
      source: copy(evaluator.evidence.source),
      components: copy(evaluator.evidence.components),
      conditions: copy(evaluator.evidence.conditions),
      uncertainty: copy(evaluator.evidence.uncertainty),
      units: copy(evaluator.units),
      command: {
        value: evaluator.samples[0].values.command,
        unit: evaluator.units.command,
      },
      diagnostics: copy(evaluator.diagnostics),
    })),
    intervals: [],
    status: 'unavailable',
    reason: null,
    pathIndex: null,
    operatingPoint: null,
    uncertaintyBasis: 'central-values-only-not-propagated',
  };
  const unavailable = (reason, pathIndex = null) => ({ ...result, reason, pathIndex });
  for (let i = 0; i < evaluators.length; i++) {
    const reason = unavailableReason(evaluators[i]);
    if (reason) return unavailable(reason, i);
  }
  let intervals = copy(evaluators[0].intervals);
  for (const evaluator of evaluators.slice(1))
    intervals = intersect(intervals, evaluator.intervals);
  result.intervals = intervals;
  if (!intervals.length) return unavailable('no-common-coverage');

  const point = (voltage) => {
    const paths = evaluators.map((evaluator) => evaluator.evaluate(voltage));
    const current = paths.reduce((sum, path) => sum + path.values.current, 0);
    return {
      voltage,
      current,
      electricalWatts: voltage * current,
      batteryLossWatts: options.resistance * current * current,
      residualVolts: voltage + options.resistance * current - options.openVoltage,
      paths,
    };
  };
  const solved = (operatingPoint) => {
    const residualToleranceVolts =
      32 *
      Number.EPSILON *
      Math.max(
        Math.abs(options.openVoltage),
        Math.abs(operatingPoint.voltage),
        Math.abs(options.resistance * operatingPoint.current),
      );
    // A steep curve can put the mathematical root between representable
    // voltages. Never report a rounded coordinate whose evaluated load fails
    // the circuit equation, or invent a current at that coordinate.
    if (Math.abs(operatingPoint.residualVolts) > residualToleranceVolts)
      return unavailable('numerical-resolution');
    const exceeded = currentLimit !== null && operatingPoint.current > currentLimit;
    return {
      ...result,
      status: exceeded ? 'limit-exceeded' : 'solved',
      reason: exceeded ? 'unregulated-current-exceeds-limit' : null,
      operatingPoint: { ...operatingPoint, residualToleranceVolts },
    };
  };

  for (let i = 0; i < intervals.length; i++) {
    const [low, high] = intervals[i];
    const knots = [
      ...new Set([
        low,
        high,
        ...evaluators.flatMap((evaluator) =>
          evaluator.samples
            .map((sample) => sample.values.voltage)
            .filter((v) => v > low && v < high),
        ),
      ]),
    ].sort((a, b) => a - b);
    let previous = point(knots[0]);
    if (previous.residualVolts === 0) return solved(previous);
    if (previous.residualVolts > 0)
      return unavailable(i === 0 ? 'root-below-coverage' : 'root-in-coverage-gap');
    for (const voltage of knots.slice(1)) {
      const next = point(voltage);
      if (next.residualVolts === 0) return solved(next);
      if (next.residualVolts > 0) {
        // The summed current and load equation are affine inside this union of
        // source knots. This root has no iteration tolerance or V² assumption.
        const fraction = -previous.residualVolts / (next.residualVolts - previous.residualVolts);
        const root = previous.voltage + (next.voltage - previous.voltage) * fraction;
        // Only bound floating-point roundoff to the already covered bracket.
        return solved(point(Math.max(previous.voltage, Math.min(next.voltage, root))));
      }
      previous = next;
    }
  }
  return unavailable('root-above-coverage');
}
