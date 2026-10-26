import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';
import {
  createPropulsionSurfaceEvaluator,
  PROPULSION_SURFACE_LIMITS,
} from './propulsion-surface.mjs';
import {
  solveStaticQuadCommandCell,
  STATIC_QUAD_INVERSE_FORMAT,
  STATIC_QUAD_INVERSE_NUMERICS,
} from './propulsion-inverse.mjs';

export const STATIC_QUAD_DOMAIN_FORMAT = 'StaticQuadDomainInverse.v1';
export const STATIC_QUAD_DOMAIN_RESULT_FORMAT = 'StaticQuadDomainInverseResult.v1';
export const STATIC_QUAD_DOMAIN_LIMITS = Object.freeze({ maximumCombinations: 256 });
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

/** Bounded calculated selection over declared cells, not isolated path knots.
 * This does not certify exact mathematical uniqueness near numerical boundaries
 * or supply a motor-speed/controller mapping. It never changes live aircraft. */
export function solveStaticQuadCommandDomain(source) {
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
    'Static quad command domain',
  );
  required(
    input.format === STATIC_QUAD_DOMAIN_FORMAT,
    'Unsupported static quad command domain format',
  );
  required(
    Array.isArray(input.rotors) && input.rotors.length === 4,
    'Exactly four rotors required',
  );
  const evaluators = input.rotors.map((rotor) => {
    keys(
      rotor,
      ['id', 'position', 'reactionDirection', 'commandUnit', 'surface'],
      'Command domain rotor',
    );
    return createPropulsionSurfaceEvaluator(rotor.surface);
  });
  const candidates = evaluators.map((evaluator) => {
    const byCommand = new Map();
    // Surface validation checks every cell before this selection. On a shared
    // voltage knot, both cells use the same observed path values in every field;
    // the evaluator also uses the first sorted admitted voltage cell.
    for (const [command, voltage] of evaluator.surface.cells)
      if (
        input.supply?.voltage >= evaluator.voltages[voltage] &&
        input.supply?.voltage <= evaluator.voltages[voltage + 1] &&
        !byCommand.has(command)
      )
        byCommand.set(command, [command, voltage]);
    return [...byCommand.values()];
  });
  const cellInput = (cells) => ({
    ...input,
    format: STATIC_QUAD_INVERSE_FORMAT,
    rotors: input.rotors.map((rotor, index) => ({ ...rotor, cell: cells[index] })),
  });
  const firstCells = candidates.map((cells, i) => cells[0] ?? evaluators[i].surface.cells[0]);
  // Reuse the local solver's complete geometry, target, unit and supply checks.
  // This one result is reused as candidate zero; even rejected/empty domains
  // therefore receive normal input validation without an unbounded search.
  const first = solveStaticQuadCommandCell(cellInput(firstCells));
  const description = {
    ...input,
    rotors: input.rotors.map(({ surface, ...rotor }, index) => ({
      ...rotor,
      surfaceIdentity: evaluators[index].identity,
      candidateCells: candidates[index],
    })),
  };
  const combinations = candidates.reduce((count, cells) => count * cells.length, 1);
  const result = {
    format: STATIC_QUAD_DOMAIN_RESULT_FORMAT,
    identity: dataIdentity({
      format: STATIC_QUAD_DOMAIN_FORMAT,
      input: description,
      limits: STATIC_QUAD_DOMAIN_LIMITS,
      numerics: STATIC_QUAD_INVERSE_NUMERICS,
    }),
    input: description,
    limits: STATIC_QUAD_DOMAIN_LIMITS,
    numerics: STATIC_QUAD_INVERSE_NUMERICS,
    resultKind: 'calculated',
    flightEligible: false,
    assumptions: {
      domain: 'union-of-declared-command-cells-at-fixed-voltage',
      selection: 'unique-calculated-command-vector-under-local-inverse-numerics',
      supply: 'ideal-fixed-terminal-voltage-no-sag',
      commandDomain: 'surface-command-not-motor-speed',
      dynamics: 'not-modeled',
      uncertainty: 'central-values-only-not-propagated',
    },
    sourceReceiptContext: 'validation-cell-lower-command-endpoints',
    sources: first.sources,
    workload: { candidateCombinations: combinations, cellSolves: 1, duplicateSolutions: 0 },
    status: 'unavailable',
    reason: null,
    rotorIndex: null,
    commands: null,
    selection: null,
    unresolved: null,
    ambiguity: null,
  };
  const fail = (reason, detail = {}) => freeze({ ...result, reason, ...detail });
  const uncovered = candidates.findIndex((cells) => cells.length === 0);
  if (uncovered >= 0) return fail('no-admitted-cell-at-voltage', { rotorIndex: uncovered });
  if (combinations > STATIC_QUAD_DOMAIN_LIMITS.maximumCombinations)
    return fail('command-domain-workload-limit');
  let selected = null;
  for (let ordinal = 0; ordinal < combinations; ordinal++) {
    let cursor = ordinal;
    const cells = new Array(4);
    for (let index = 3; index >= 0; index--) {
      cells[index] = candidates[index][cursor % candidates[index].length];
      cursor = Math.floor(cursor / candidates[index].length);
    }
    const solved = ordinal === 0 ? first : solveStaticQuadCommandCell(cellInput(cells));
    if (ordinal > 0) result.workload.cellSolves++;
    if (solved.status !== 'solved') {
      // This is a computed rejection under the local inverse's strict bounds,
      // not a certified absence of an exact root near a floating-point boundary.
      if (solved.reason === 'outside-selected-command-cells') continue;
      return fail('unresolved-command-cell', {
        unresolved: { cells, reason: solved.reason, result: solved },
      });
    }
    if (!selected) selected = { cells, result: solved };
    else if (
      solved.commands.every((command, i) => command.value === selected.result.commands[i].value)
    )
      result.workload.duplicateSolutions++;
    else
      return fail('ambiguous-command-solutions', {
        ambiguity: [
          { cells: selected.cells, commands: selected.result.commands },
          { cells, commands: solved.commands },
        ],
      });
  }
  if (!selected) return fail('no-command-domain-solution');
  return freeze({
    ...result,
    status: 'solved',
    commands: selected.result.commands,
    selection: selected,
  });
}
