import { createRun, CELL } from '../core/index.mjs';
import { fieldNeighbors, inspectCaptureSnapshot } from '../core/capture-regions.mjs';

/** Static wall-connectivity proof only. Terrain, enemy timing, legal closure and
 * human execution can further restrict playability; none can open these walls.
 * Foundation-era candidates have no gate or boss transitions. */
export function inspectMissionTopology(level, geometry) {
  const run = createRun(level, { seed: 1, classId: 'scout' });
  const capture = inspectCaptureSnapshot(run);
  const start = Math.floor(level.spawn.y) * level.width + Math.floor(level.spawn.x);
  const reachable = new Set([start]),
    queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++)
    for (const next of fieldNeighbors(queue[cursor], level.width, level.height)) {
      if (next >= 0 && geometry.cells[next] !== CELL.WALL && !reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  const diagnostics = [];
  const inaccessibleRetained = new Set();
  const empty = new Set(capture.filledCells);
  for (const component of capture.components) {
    const remote = !component.cells.some((cell) => reachable.has(cell));
    if (remote && component.retained) {
      for (const cell of component.cells) inaccessibleRetained.add(cell);
      diagnostics.push({
        severity: 'warning',
        code: 'inaccessible-retained-chamber',
        componentId: component.id,
        enemyIds: component.enemyIds,
        cells: component.cells.length,
        message:
          'Walls isolate an occupied field region from this mission spawn. Its cells cannot be earned with the current mechanics.',
      });
    } else if (!component.retained) {
      diagnostics.push({
        severity: 'warning',
        code: remote ? 'remote-auto-fill' : 'unoccupied-auto-fill',
        componentId: component.id,
        cells: component.cells.length,
        message:
          'This empty region would fill at the first accepted closure if it remains unoccupied. Check that this is intentional.',
      });
    }
  }
  for (const objective of level.objectives) {
    const cell = Math.floor(objective.y) * level.width + Math.floor(objective.x);
    if (inaccessibleRetained.has(cell))
      diagnostics.push({
        severity: objective.required ? 'error' : 'warning',
        code: 'unreachable-objective',
        objectiveId: objective.id,
        message: `${objective.required ? 'Required' : 'Optional'} objective ${objective.id} lies in a wall-isolated, enemy-retained chamber.`,
      });
    else if (!reachable.has(cell) && empty.has(cell))
      diagnostics.push({
        severity: 'warning',
        code: 'remote-objective-auto-fill',
        objectiveId: objective.id,
        message: `Objective ${objective.id} is unreachable by movement but would be earned through remote empty-region fill.`,
      });
  }
  const optimisticCoverageCeiling =
    (geometry.eligibleCount - inaccessibleRetained.size) / geometry.eligibleCount;
  if (optimisticCoverageCeiling + 1e-12 < level.goal.coverage)
    diagnostics.push({
      severity: 'error',
      code: 'unreachable-coverage-quota',
      message: `Even an optimistic clear can earn at most ${(optimisticCoverageCeiling * 100).toFixed(1)}%; this mission requires ${(level.goal.coverage * 100).toFixed(1)}%.`,
    });
  return {
    assumption:
      'Static wall connectivity and initial enemy retention only; not a solution, timing or enjoyment proof.',
    inaccessibleRetainedCells: inaccessibleRetained.size,
    optimisticCoverageCeiling,
    diagnostics,
  };
}
