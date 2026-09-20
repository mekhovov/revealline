import { CELL } from '../../core/index.mjs';

function reclaimedComponent(run, root, { excludeInteriorFoundations = false } = {}) {
  const queue = [root],
    seen = new Set(queue);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const x = queue[cursor] % run.width,
      y = Math.floor(queue[cursor] / run.width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        cell = ny * run.width + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= run.width ||
        ny >= run.height ||
        seen.has(cell) ||
        run.cells[cell] !== CELL.SAFE
      )
        continue;
      if (
        excludeInteriorFoundations &&
        nx > 0 &&
        ny > 0 &&
        nx < run.width - 1 &&
        ny < run.height - 1 &&
        run.foundation.permanent[cell]
      )
        continue;
      seen.add(cell);
      queue.push(cell);
    }
  }
  return seen;
}

// Test-only authored-goal predicates, never an award or a new capture rule.
// closedTrails contains actual unfinished trails immediately before a closure,
// not all cells enclosed by that cut; filling a ring mouth alone cannot fake it.
export function inspectNeonGoal({ missionId, run, foundations, initialComponents, closedTrails }) {
  const connected = reclaimedComponent(run, foundations[0].y * run.width + foundations[0].x);
  const allFoundationsLinked = foundations.every((r) => connected.has(r.y * run.width + r.x));
  const outerConnected = connected.has(0);
  const materialsNeutralized = run.classic.terrain.every(
    (kind, cell) => !kind || run.cells[cell] !== CELL.FIELD,
  );
  const chambersCaptured = initialComponents.filter((region) =>
    region.cells.some((cell) => run.cells[cell] === CELL.SAFE),
  ).length;
  const mouthTrailClosure =
    missionId === 'inside-out' &&
    closedTrails.some((trail) =>
      trail.some((cell) => {
        const x = cell % run.width,
          y = Math.floor(cell / run.width);
        return x >= 38 && x <= 40 && y >= 12 && y <= 17;
      }),
    );
  let twoElbowEnds = false;
  if (missionId === 'folded-corner') {
    // Reaching the second end by simply walking along the permanent L does not
    // count. Both outer contacts must connect through earned reclaimed cells.
    const earned = reclaimedComponent(run, 0, { excludeInteriorFoundations: true });
    const [stem, arm] = foundations;
    const top = Array.from({ length: stem.w }, (_, i) => (stem.y - 1) * run.width + stem.x + i);
    const right = Array.from({ length: arm.h }, (_, i) => (arm.y + i) * run.width + arm.x + arm.w);
    twoElbowEnds = top.some((cell) => earned.has(cell)) && right.some((cell) => earned.has(cell));
  }
  const conditions = {
    'folded-corner': twoElbowEnds,
    'inside-out': mouthTrailClosure && outerConnected,
    'four-quarters': chambersCaptured >= 3,
    'side-door-bays': allFoundationsLinked,
    'dogleg-return': chambersCaptured === 2 && materialsNeutralized,
    'staggered-circuit': allFoundationsLinked,
    'neon-remix': allFoundationsLinked && materialsNeutralized,
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown authored Neon goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    allFoundationsLinked,
    outerConnected,
    materialsNeutralized,
    chambersCaptured,
    mouthTrailClosure,
    twoElbowEnds,
  };
}
