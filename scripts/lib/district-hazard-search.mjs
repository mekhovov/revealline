// Offline route selection only. Never changes the run, victory or mastery rules.
import { CELL } from '../../game/core/index.mjs';
export function remainingLethal(run) {
  return run.classic.terrain.reduce(
    (count, kind, cell) => count + Number(kind === 2 && run.cells[cell] === CELL.FIELD),
    0,
  );
}
export const districtHazardSearchPolicy = {
  bentCuts: true,
  acceptCompletion: (run) => remainingLethal(run) === 0,
  scoreCandidate({ run, next, defaultScore }) {
    if (!remainingLethal(run)) return defaultScore;
    let easternGain = 0;
    for (let cell = 0; cell < run.cells.length; cell++)
      if (
        cell % run.width >= 38 &&
        run.cells[cell] === CELL.FIELD &&
        next.cells[cell] === CELL.SAFE
      )
        easternGain += Math.floor(cell / run.width) >= 24 ? 8 : 1;
    return (
      (easternGain + (remainingLethal(run) - remainingLethal(next)) * 2000) /
      (next.tick - run.tick + 120)
    );
  },
};
