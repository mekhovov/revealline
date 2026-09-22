import { createLivewireCandidates } from './livewire-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

// Explicit successor, not a mutation of the historical Livewire editions.
export function createLivewireSpatialCandidates({ artwork = false, edition = 'afterglow' } = {}) {
  if (!['afterglow', 'routing'].includes(edition))
    throw new Error('Unknown Livewire spatial edition');
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
  if (edition === 'routing') {
    project.name = 'Livewire Foundry · distinct return routes';
    project.revision = 'routing-spatial-2';
    const switchyard = project.missions.find((item) => item.id === 'switchyard');
    const switchMap = project.maps.find((item) => item.id === switchyard.map.id);
    switchMap.revision = switchyard.revision = switchyard.map.revision = 'routing-spatial-2';
    switchMap.walls = [
      { x: 26, y: 25, w: 2, h: 8 },
      { x: 26, y: 23, w: 16, h: 2 },
    ];
    switchyard.design.routeDecision =
      'Connect the west rail for an approach around the elbow, or establish the east rail and neutralize its hot pocket first?';
    switchyard.design.lesson =
      'The lower elbow keeps a field keeper on the west approach. Rails close cuts; the elbow wall does not. Read the locked row before choosing which rail to join.';
    switchyard.design.counterplay =
      'Use the central platform to change direction. The west rail opens the slow-side approach; the east rail offers a return beneath the hot pocket. Keep a real return beyond every bend.';
    switchyard.design.captureConsequence =
      'A connection changes the next launch angle without automatically filling the other occupied side. Enclosing the hot pocket makes a new approach usable.';
    switchyard.design.memorableMoment =
      'Two staggered rails stay useful for different reasons after the first long connector leaves both enemy-held sides contested.';
    const junction = project.missions.find((item) => item.id === 'split-junction');
    const junctionMap = project.maps.find((item) => item.id === junction.map.id);
    junctionMap.revision = junction.revision = junction.map.revision = 'routing-spatial-2';
    junctionMap.foundations = [
      { x: 10, y: 13, w: 16, h: 3 },
      { x: 24, y: 16, w: 2, h: 8 },
      { x: 46, y: 20, w: 16, h: 3 },
      { x: 33, y: 14, w: 6, h: 7 },
    ];
    junction.design.routeDecision =
      'Link the hooked west rail or floating east rail first, then choose a return around its end to enclose a dangerous corner?';
    junction.design.lesson =
      'The west hook is return ground that redirects the keeper; the east rail floats short of the border. Connecting a rail is a foothold, not a free quadrant.';
    junction.design.counterplay =
      'Shift within the central landing before departing toward either rail. Read the locked column, use the hooked tip as a nearer western return, and enclose lethal corners from outside.';
    junction.design.captureConsequence =
      'Each short connection changes your launch angle without automatically claiming a corner. A later enclosure can neutralize terrain and turn the floating end into a longer return route.';
    junction.design.memorableMoment =
      'The first rail connection leaves the picture contested; steering around its end turns the next return into a meaningful enclosure.';
    for (const item of [...project.packs, ...project.campaigns])
      item.revision = 'routing-spatial-2';
  }
  return structuredClone(compileContentProject(project).source);
}
