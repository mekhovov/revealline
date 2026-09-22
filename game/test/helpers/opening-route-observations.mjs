// Test-only observations. These neither award mastery nor alter completion rules.
import { inspectCaptureSnapshot } from '../../core/capture-regions.mjs';
import { roverLinks } from './rover-goal.mjs';

function foundationIndices(run, point) {
  return run.level.foundations.flatMap((rect, i) =>
    point.x >= rect.x && point.x < rect.x + rect.w && point.y >= rect.y && point.y < rect.y + rect.h
      ? [i]
      : [],
  );
}
function visit(run, evidence) {
  for (const i of foundationIndices(run, run.player))
    if (!evidence.visitedFoundations.has(i)) evidence.visitedFoundations.set(i, run.tick);
}
export function createOpeningObservations(run) {
  const evidence = {
    visitedFoundations: new Map(),
    initialRegions: inspectCaptureSnapshot(run).components.map((c) => ({
      enemyIds: c.enemyIds,
      cells: new Set(c.cells),
    })),
    cutRegions: new Set(),
    departure: null,
    closures: [],
  };
  visit(run, evidence);
  return evidence;
}
export function openingBeforeStep(run) {
  return {
    player: { x: run.player.x, y: run.player.y, cutting: run.player.cutting },
    trail: run.trail.map((c) => c.index),
    claimedCount: run.claimedCount,
  };
}
export function observeOpeningStep(run, evidence, before) {
  visit(run, evidence);
  if (!before.player.cutting && run.player.cutting)
    evidence.departure = foundationIndices(run, before.player);
  if (!run.events.some((e) => e.type === 'cut.closed')) return;
  const domains = evidence.initialRegions
    .filter((region) => before.trail.some((cell) => region.cells.has(cell)))
    .map((region) => region.enemyIds.join('+'));
  for (const domain of domains) evidence.cutRegions.add(domain);
  evidence.closures.push({
    tick: run.tick,
    departureFoundations: evidence.departure ?? [],
    returnFoundations: foundationIndices(run, run.player),
    initialRegions: domains,
    lineOnly: run.claimedCount - before.claimedCount === before.trail.length,
  });
  evidence.departure = null;
}
export function inspectOpeningObservations(run, evidence) {
  return {
    visitedFoundations: [...evidence.visitedFoundations],
    allFoundationsVisited: evidence.visitedFoundations.size === run.level.foundations.length,
    allFoundationsMutuallyLinked:
      run.level.foundations.length === 0 || roverLinks(run, run.level.foundations),
    perimeterLinkedFoundations: run.level.foundations.flatMap((rect, i) =>
      roverLinks(run, [{ x: 0, y: 0, w: 1, h: 1 }, rect]) ? [i] : [],
    ),
    cutRegions: [...evidence.cutRegions].sort(),
    closures: evidence.closures,
  };
}
