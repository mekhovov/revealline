import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';
import {
  createPropulsionSurfaceEvaluator,
  PROPULSION_SURFACE_LIMITS,
} from './propulsion-surface.mjs';
import { evaluateStaticQuadPropulsion, STATIC_QUAD_PROPULSION_FORMAT } from './propulsion-quad.mjs';

export const STATIC_QUAD_INVERSE_FORMAT = 'StaticQuadInverse.v1';
export const STATIC_QUAD_INVERSE_RESULT_FORMAT = 'StaticQuadInverseResult.v1';
// Fixed physical scales, not independent normalization of the matrix rows:
// weak torque authority must remain visible in the condition estimate.
export const STATIC_QUAD_INVERSE_NUMERICS = Object.freeze({
  forceScaleN: 1,
  torqueScaleNm: 1,
  maximumConditionInfinity: 1e8,
  relativePivotFloor: 64 * Number.EPSILON,
  commandFractionTolerance: 64 * Number.EPSILON,
  forceAbsoluteToleranceN: 1e-9,
  torqueAbsoluteToleranceNm: 1e-11,
  relativeResidualTolerance: 1e-10,
});
const N = STATIC_QUAD_INVERSE_NUMERICS;
const XYZ = ['x', 'y', 'z'];
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function keys(value, names, label) {
  exactKeys(value, names, label);
  required(
    names.every((name) => Object.hasOwn(value, name)),
    `${label} has missing fields`,
  );
}
const norm = (matrix) =>
  Math.max(...matrix.map((row) => row.reduce((sum, v) => sum + Math.abs(v), 0)));

function invert(matrix) {
  const magnitude = norm(matrix);
  const work = matrix.map((row, i) => [...row, ...[0, 1, 2, 3].map((j) => Number(i === j))]);
  for (let column = 0; column < 4; column++) {
    let pivot = column;
    for (let row = column + 1; row < 4; row++)
      if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    const value = Math.abs(work[pivot][column]);
    if (value === 0) return { reason: 'singular-allocation', conditionInfinity: null };
    if (value <= magnitude * N.relativePivotFloor)
      return { reason: 'ill-conditioned-allocation', conditionInfinity: null };
    [work[column], work[pivot]] = [work[pivot], work[column]];
    const divisor = work[column][column];
    for (let entry = 0; entry < 8; entry++) work[column][entry] /= divisor;
    for (let row = 0; row < 4; row++) {
      if (row === column) continue;
      const factor = work[row][column];
      for (let entry = 0; entry < 8; entry++) work[row][entry] -= factor * work[column][entry];
    }
    if (!work.every((row) => row.every(finite)))
      return { reason: 'numerical-resolution', conditionInfinity: null };
  }
  const inverse = work.map((row) => row.slice(4)),
    conditionInfinity = magnitude * norm(inverse);
  if (!finite(conditionInfinity))
    return { reason: 'numerical-resolution', conditionInfinity: null };
  return {
    inverse,
    conditionInfinity,
    reason: conditionInfinity > N.maximumConditionInfinity ? 'ill-conditioned-allocation' : null,
  };
}

/** Local inverse only: ideal fixed terminal voltage, one explicitly admitted
 * cell per rotor, parallel +Y thrust. Commands retain their surface units;
 * they are NOT normalized speed requests for the existing flight controller. */
export function solveStaticQuadCommandCell(source) {
  const input = boundedJSON(source, {
    maxBytes: 4 * PROPULSION_SURFACE_LIMITS.maxBytes + 4096,
    maxNodes: 82000,
    maxDepth: 14,
    maxArray: 256,
    maxString: 4096,
  });
  keys(
    input,
    ['format', 'frame', 'thrustAxis', 'torqueBasis', 'units', 'supply', 'rotors', 'target'],
    'Static quad inverse',
  );
  required(input.format === STATIC_QUAD_INVERSE_FORMAT, 'Unsupported static quad inverse format');
  keys(input.supply, ['kind', 'voltage'], 'Inverse supply');
  required(
    input.supply.kind === 'ideal-fixed-terminal-voltage',
    'An explicit ideal fixed supply is required',
  );
  required(
    finite(input.supply.voltage) && input.supply.voltage >= 0 && input.supply.voltage <= 1000,
    'Invalid terminal voltage',
  );
  keys(input.target, ['force', 'torque'], 'Target body wrench');
  for (const field of ['force', 'torque']) {
    keys(input.target[field], XYZ, 'Target body vector');
    required(
      XYZ.every(
        (axis) => finite(input.target[field][axis]) && Math.abs(input.target[field][axis]) <= 1e6,
      ),
      'Invalid target body wrench',
    );
  }
  required(
    Array.isArray(input.rotors) && input.rotors.length === 4,
    'Exactly four rotors required',
  );
  const evaluators = input.rotors.map((rotor) => {
    keys(
      rotor,
      ['id', 'position', 'reactionDirection', 'commandUnit', 'cell', 'surface'],
      'Inverse rotor',
    );
    required(
      Array.isArray(rotor.cell) && rotor.cell.length === 2 && rotor.cell.every(Number.isInteger),
      'An explicit command/voltage cell is required',
    );
    const evaluator = createPropulsionSurfaceEvaluator(rotor.surface);
    required(
      rotor.commandUnit === evaluator.units.command,
      'Inverse command unit must match its surface',
    );
    const [c, v] = rotor.cell;
    required(
      c >= 0 && c < evaluator.commands.length - 1 && v >= 0 && v < evaluator.voltages.length - 1,
      'Inverse cell index outside surface grid',
    );
    return evaluator;
  });
  const windows = input.rotors.map((rotor, i) => ({
    command: evaluators[i].commands.slice(rotor.cell[0], rotor.cell[0] + 2),
    voltage: evaluators[i].voltages.slice(rotor.cell[1], rotor.cell[1] + 2),
  }));
  const forward = (commands) =>
    evaluateStaticQuadPropulsion({
      format: STATIC_QUAD_PROPULSION_FORMAT,
      frame: input.frame,
      thrustAxis: input.thrustAxis,
      torqueBasis: input.torqueBasis,
      units: input.units,
      battery: { openVoltage: input.supply.voltage, resistance: 0, currentLimit: null },
      rotors: input.rotors.map(({ id, position, reactionDirection, commandUnit, surface }, i) => ({
        id,
        position,
        reactionDirection,
        surface,
        command: { value: commands[i], unit: commandUnit },
      })),
    });
  // This also validates the shared geometry, SI units and direction contract.
  const lower = forward(windows.map(({ command }) => command[0]));
  const description = {
    ...input,
    rotors: input.rotors.map(({ surface, ...rotor }, i) => ({
      ...rotor,
      surfaceIdentity: evaluators[i].identity,
      window: windows[i],
    })),
  };
  const result = {
    format: STATIC_QUAD_INVERSE_RESULT_FORMAT,
    identity: dataIdentity({ format: STATIC_QUAD_INVERSE_FORMAT, input: description, numerics: N }),
    input: description,
    numerics: N,
    resultKind: 'calculated',
    flightEligible: false,
    assumptions: {
      allocation: 'local-selected-cells-only',
      supply: 'ideal-fixed-terminal-voltage-no-sag',
      commandDomain: 'surface-command-not-motor-speed',
      dynamics: 'not-modeled',
      uncertainty: 'central-values-only-not-propagated',
    },
    sourceReceiptContext: 'lower-command-endpoints',
    sources: lower.load.sources,
    status: 'unavailable',
    reason: null,
    rotorIndex: null,
    conditionInfinity: null,
    fractions: null,
    commands: null,
    basis: null,
    residual: null,
    forward: null,
  };
  const fail = (reason, detail = {}) => freeze({ ...result, reason, ...detail });
  if (input.target.force.x !== 0 || input.target.force.z !== 0)
    return fail('unsupported-lateral-force');
  for (let i = 0; i < 4; i++) {
    const [c, v] = input.rotors[i].cell;
    if (!evaluators[i].surface.cells.some(([a, b]) => a === c && b === v))
      return fail('cell-not-admitted', { rotorIndex: i });
    if (
      input.supply.voltage < windows[i].voltage[0] ||
      input.supply.voltage > windows[i].voltage[1]
    )
      return fail('voltage-outside-selected-cell', { rotorIndex: i });
  }
  if (lower.status !== 'solved') return fail('cell-endpoint-unavailable', { forward: lower });
  const upper = forward(windows.map(({ command }) => command[1]));
  if (upper.status !== 'solved') return fail('cell-endpoint-unavailable', { forward: upper });
  const columns = input.rotors.map((rotor, i) => {
    const low = lower.rotors[i].point.values,
      high = upper.rotors[i].point.values,
      thrust = high.thrust - low.thrust,
      torque = high.torque - low.torque;
    return [
      thrust,
      -rotor.position.z * thrust,
      rotor.reactionDirection * torque,
      rotor.position.x * thrust,
    ];
  });
  const flat = columns.findIndex((column) => column[0] <= 0);
  if (flat >= 0) return fail('non-increasing-cell-thrust', { rotorIndex: flat });
  const scales = [N.forceScaleN, N.torqueScaleNm, N.torqueScaleNm, N.torqueScaleNm];
  const matrix = scales.map((scale, row) => columns.map((column) => column[row] / scale));
  const vector = (wrench) => [wrench.force.y, wrench.torque.x, wrench.torque.y, wrench.torque.z];
  const offset = vector(lower.wrench),
    target = vector(input.target);
  result.basis = { order: ['force.y', 'torque.x', 'torque.y', 'torque.z'], offset, matrix };
  const solved = invert(matrix);
  result.conditionInfinity = solved.conditionInfinity;
  if (solved.reason) return fail(solved.reason);
  const rhs = target.map((v, i) => (v - offset[i]) / scales[i]);
  const fractions = solved.inverse.map((row) =>
    row.reduce((sum, value, i) => sum + value * rhs[i], 0),
  );
  if (!fractions.every(finite)) return fail('numerical-resolution');
  result.fractions = fractions;
  // Tolerances never admit coordinates outside a selected cell, including one
  // representable step outside. There is no clipping, snapping or extrapolation.
  if (input.target.force.y < 0 || fractions.some((v) => v < 0 || v > 1))
    return fail('outside-selected-command-cells');
  const commands = fractions.map((fraction, i) => {
    const [low, high] = windows[i].command;
    return low + (high - low) * fraction;
  });
  for (let i = 0; i < 4; i++) {
    const [low, high] = windows[i].command,
      reconstructed = (commands[i] - low) / (high - low);
    if (
      !finite(reconstructed) ||
      commands[i] < low ||
      commands[i] > high ||
      Math.abs(reconstructed - fractions[i]) > N.commandFractionTolerance
    )
      return fail('command-resolution', { rotorIndex: i });
  }
  const checked = forward(commands);
  result.forward = checked;
  if (checked.status !== 'solved') return fail('forward-check-unavailable');
  if (checked.load.load.operatingPoint.voltage !== input.supply.voltage)
    return fail('terminal-voltage-mismatch');
  const achieved = vector(checked.wrench),
    errors = achieved.map((v, i) => v - target[i]);
  const tolerances = achieved.map(
    (v, i) =>
      (i === 0 ? N.forceAbsoluteToleranceN : N.torqueAbsoluteToleranceNm) +
      N.relativeResidualTolerance * Math.max(Math.abs(v), Math.abs(target[i])),
  );
  result.residual = { order: result.basis.order, errors, tolerances };
  if (errors.some((error, i) => !finite(error) || Math.abs(error) > tolerances[i]))
    return fail('forward-residual');
  return freeze({
    ...result,
    status: 'solved',
    commands: commands.map((value, i) => ({
      id: input.rotors[i].id,
      value,
      unit: input.rotors[i].commandUnit,
    })),
  });
}
