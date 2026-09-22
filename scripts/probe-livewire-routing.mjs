import { createLivewireSpatialCandidates } from '../game/content-design/livewire-spatial-candidates.mjs';
import { probePressureRoute } from './lib/pressure-route-probe.mjs';
import { CELL } from '../game/core/index.mjs';
import { CLASSIC_MATERIAL } from '../game/core/classic-state.mjs';
import { roverLinks } from '../game/test/helpers/rover-goal.mjs';

// Offline search target only; never changes the runtime win rule or grants awards.
const source = createLivewireSpatialCandidates({ edition: 'routing' });
const mastery = process.argv.includes('--mastery');
const foundations = source.maps.find((map) => map.id === process.argv[2] + '-map')?.foundations;
const remainingHazards = (run) =>
  run.classic.terrain.reduce(
    (count, kind, cell) =>
      count + Number(kind === CLASSIC_MATERIAL.lethal && run.cells[cell] === CELL.FIELD),
    0,
  );

probePressureRoute({ switchyard: 'up', 'split-junction': 'down' }, () => source, {
  bentCuts: process.argv.includes('--bent'),
  ...(mastery
    ? {
        acceptCompletion: (run) => remainingHazards(run) === 0 && roverLinks(run, foundations),
        scoreCandidate: ({ run, next, defaultScore }) =>
          defaultScore + (remainingHazards(run) - remainingHazards(next)) * 0.08,
      }
    : {}),
});
