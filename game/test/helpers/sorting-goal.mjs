// Successor-only evidence. Do not reinterpret the historical Sorting Yard goal.
import {
  createBoundaryAwareOpeningObservations,
  observeBoundaryAwareOpeningStep,
  openingBeforeStep,
} from './opening-boundary-observations.mjs';
import { CELL } from '../../core/index.mjs';

export function createSortingEvidence(run) {
  return {
    boundary: createBoundaryAwareOpeningObservations(run),
    activeReturns: new Set(),
    warnings: [],
    activations: [],
    closureAfterBothReturns: false,
  };
}
export function sortingBeforeStep(run) {
  return {
    boundary: openingBeforeStep(run),
    bothActive:
      run.enemies.filter(
        (actor) => actor.type === 'claimed-rover' && actor.classic.mode === 'active',
      ).length === 2,
  };
}
export function observeSortingStep(run, evidence, before) {
  observeBoundaryAwareOpeningStep(run, evidence.boundary, before.boundary);
  for (const event of run.events) {
    if (event.type === 'rover.warning') evidence.warnings.push([run.tick, event.id]);
    if (event.type === 'rover.activated') evidence.activations.push([run.tick, event.id]);
    if (event.type !== 'cut.closed' || !before.bothActive) continue;
    if (evidence.activeReturns.has(1) && evidence.activeReturns.has(2))
      evidence.closureAfterBothReturns = true;
    for (const index of evidence.boundary.closures.at(-1).returnFoundations)
      if (index === 1 || index === 2) evidence.activeReturns.add(index);
  }
}
export function inspectSortingEvidence(run, evidence) {
  const chambersEarned = evidence.boundary.initialRegions.filter((region) =>
    [...region.cells].some((index) => run.cells[index] === CELL.SAFE),
  ).length;
  const mastered =
    run.status === 'won' &&
    run.classic.livesLost === 0 &&
    chambersEarned === 2 &&
    evidence.activeReturns.has(1) &&
    evidence.activeReturns.has(2);
  return {
    mastered,
    chambersEarned,
    activeReturns: [...evidence.activeReturns].sort(),
    closureAfterBothReturns: evidence.closureAfterBothReturns,
    warnings: evidence.warnings,
    activations: evidence.activations,
    closures: evidence.boundary.closures,
  };
}
