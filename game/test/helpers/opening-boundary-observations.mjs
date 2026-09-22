// Read-only successor to the historical point-based opening observer. A stopped
// craft may sit exactly on a cell edge. Use the kernel's departure ownership and
// accepted closure direction, not raw rectangle containment at that boundary.
import { DIRECTIONS } from '../../core/index.mjs';
import { EPS } from '../../core/geometry.mjs';
import { cellIndex } from '../../core/movement.mjs';
import {
  createOpeningObservations,
  observeOpeningStep,
  inspectOpeningObservations as inspectHistoricalOpeningObservations,
} from './opening-route-observations.mjs';
export { openingBeforeStep } from './opening-route-observations.mjs';

function foundationCellIndices(run, index) {
  const x = index % run.width,
    y = Math.floor(index / run.width);
  return run.level.foundations.flatMap((rect, i) =>
    x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h ? [i] : [],
  );
}

export function createBoundaryAwareOpeningObservations(run) {
  if (!run.classic || run.rules.stopOnCapture !== true)
    throw new Error('Foundation observer requires classic stop-on-capture ownership.');
  return { ...createOpeningObservations(run), observationVersion: 2 };
}

export function inspectOpeningObservations(run, evidence) {
  if (evidence.observationVersion !== 2) throw new Error('Expected boundary-aware V2 evidence.');
  return {
    format: 'OpeningFoundationObservationsV2',
    ...inspectHistoricalOpeningObservations(run, evidence),
  };
}

export function observeBoundaryAwareOpeningStep(run, evidence, before) {
  observeOpeningStep(run, evidence, before);
  if (run.events.some((event) => event.type === 'cut.started')) {
    // Current fixed-step, bounded-speed candidates cannot cross a whole field
    // cell and close during the same tick. Refuse unsupported evidence rather
    // than infer a departure if a future runtime clears this anchor earlier.
    if (!Number.isInteger(run.classic?.departure))
      throw new Error('Foundation observer needs the accepted cut departure cell.');
    evidence.departure = foundationCellIndices(run, run.classic.departure);
  }
  if (!run.events.some((event) => event.type === 'cut.closed')) return;
  const direction = DIRECTIONS[run.player.direction];
  const index = cellIndex(
    run.player.x + direction.x * EPS * 4,
    run.player.y + direction.y * EPS * 4,
    run,
  );
  const foundations = foundationCellIndices(run, index);
  evidence.closures.at(-1).returnFoundations = foundations;
  for (const i of foundations)
    if (!evidence.visitedFoundations.has(i)) evidence.visitedFoundations.set(i, run.tick);
}
