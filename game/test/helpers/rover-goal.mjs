import { CELL } from '../../core/index.mjs';

function connectedGround(run, root) {
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
      seen.add(cell);
      queue.push(cell);
    }
  }
  return seen;
}

// Test-only evidence predicates, never campaign awards or alternate win rules.
// Closures carry real trail cells and the active actor IDs immediately before
// closing, so a final capture which merely starts a warning cannot fake mastery.
export function inspectRoverGoal({ missionId, run, foundations, initialComponents, closures }) {
  const component = connectedGround(run, foundations[0].y * run.width + foundations[0].x);
  const allLinked = foundations.every((rect) => component.has(rect.y * run.width + rect.x));
  const spineLinked = foundations
    .slice(0, 3)
    .every((rect) => component.has(rect.y * run.width + rect.x));
  const active = run.enemies.filter(
    (actor) => actor.type === 'claimed-rover' && actor.classic.mode === 'active',
  );
  const roamerCount = run.enemies.filter((actor) => actor.type === 'claimed-rover').length;
  const materialsNeutralized = run.classic.terrain.every(
    (kind, cell) => !kind || run.cells[cell] !== CELL.FIELD,
  );
  const chambersCaptured = initialComponents.filter((region) =>
    region.cells.some((cell) => run.cells[cell] === CELL.SAFE),
  ).length;
  const activeClosures = closures.filter((closure) => closure.activeIds.length > 0);
  const firstFullLink = closures.find((closure) => closure.allLinked);
  const upperEnd = activeClosures.some((closure) =>
    closure.trail.some(
      (cell) =>
        Math.floor(cell / run.width) === 7 && cell % run.width >= 24 && cell % run.width <= 32,
    ),
  );
  const lowerEnd = activeClosures.some((closure) =>
    closure.trail.some(
      (cell) =>
        cell % run.width === 44 &&
        Math.floor(cell / run.width) >= 21 &&
        Math.floor(cell / run.width) <= 25,
    ),
  );
  const conditions = {
    'wake-the-yard': activeClosures.length > 0,
    'split-berths': allLinked && firstFullLink?.activeIds.length > 0,
    'stepped-return': upperEnd && lowerEnd,
    'between-the-rows': allLinked && materialsNeutralized,
    'broken-yard': allLinked && materialsNeutralized,
    'sorting-yard': active.length === roamerCount && chambersCaptured === 2,
    'rover-remix': spineLinked && active.length === roamerCount,
  };
  if (!Object.hasOwn(conditions, missionId)) throw new Error('Unknown authored Rover goal.');
  return {
    achieved: run.status === 'won' && run.classic.livesLost === 0 && conditions[missionId],
    allLinked,
    spineLinked,
    active: active.length,
    roamerCount,
    materialsNeutralized,
    chambersCaptured,
    upperEnd,
    lowerEnd,
    activeClosures: activeClosures.length,
  };
}

export function roverLinks(run, foundations) {
  const component = connectedGround(run, foundations[0].y * run.width + foundations[0].x);
  return foundations.every((rect) => component.has(rect.y * run.width + rect.x));
}
