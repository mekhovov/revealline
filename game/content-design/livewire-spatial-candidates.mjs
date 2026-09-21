import { createLivewireCandidates } from './livewire-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

// Explicit successor, not a mutation of the historical Livewire editions.
export function createLivewireSpatialCandidates({ artwork = false } = {}) {
  const project = withPressureDifficulty(createLivewireCandidates({ artwork }));
  project.id = 'livewire-spatial-review';
  project.name = 'Livewire Foundry · offset return approaches';
  project.revision = 'afterglow-spatial-1';
  const mission = project.missions.find((item) => item.id === 'cross-the-afterglow');
  const map = project.maps.find((item) => item.id === mission.map.id);
  map.revision = mission.revision = mission.map.revision = 'afterglow-spatial-1';
  map.walls = [
    { x: 24, y: 3, w: 2, h: 12 },
    { x: 24, y: 22, w: 2, h: 11 },
  ];
  mission.design.routeDecision =
    'Connect the west landing through the open aisle, or establish the northern return before working around the baffle ends?';
  mission.design.lesson =
    'A locked column threatens the exposed trail. A west landing and a northern landing offer different returns; baffles are walls, never return surfaces.';
  mission.design.counterplay =
    'Keep a real landing at the end of the cut. Cross the open aisle during a rest window, or turn around a baffle end after reading the marked column.';
  mission.design.captureConsequence =
    'The west connector opens approaches on both sides of the baffles, while occupied field still remains unclaimed. Each new frontier changes the patrol route.';
  mission.design.memorableMoment =
    'A completed westward connector remains usable through the column attack, then offers a different approach around the upper baffle.';
  for (const item of [...project.packs, ...project.campaigns])
    item.revision = 'afterglow-spatial-1';
  return structuredClone(compileContentProject(project).source);
}
