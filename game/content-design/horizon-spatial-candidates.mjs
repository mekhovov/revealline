import { createOpeningCandidates } from './horizon-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

// Explicit successor: keep the original opening lessons and immutable editions.
export function createHorizonSpatialCandidates({ artwork = false } = {}) {
  const project = withPressureDifficulty(createOpeningCandidates({ artwork }));
  project.id = 'horizon-spatial-review';
  project.name = 'Horizon School · inward and outward returns';
  project.revision = 'courtyard-spatial-1';
  const mission = project.missions.find((item) => item.id === 'courtyard-return');
  const map = project.maps.find((item) => item.id === mission.map.id);
  map.revision = mission.revision = mission.map.revision = project.revision;
  map.foundations = [
    { x: 14, y: 6, w: 44, h: 2 },
    { x: 14, y: 28, w: 44, h: 2 },
    { x: 14, y: 8, w: 2, h: 20 },
    { x: 56, y: 8, w: 2, h: 20 },
  ];
  map.spawns = [{ id: 'home', x: 14.5, y: 17.5 }];
  mission.design.routeDecision =
    'Take the short outer bridge first, or move along the ring to choose an inward enclosure?';
  mission.design.lesson =
    'The ring separates two keeper-held fields. Its outer edge offers short returns; its inner edge supports larger enclosures. Both fields matter to the clear.';
  mission.design.counterplay =
    'Watch the keeper in the field you are entering. Move along reclaimed ring ground to shorten the exposed route, and close before a keeper reaches your line.';
  mission.design.captureConsequence =
    'An outer connection creates new launch angles but cannot claim the occupied courtyard. An inward capture creates shorter interior returns without clearing the outside for free.';
  mission.design.memorableMoment =
    'A short outer bridge changes the next launch, then an inward enclosure reveals the courtyard at a different scale.';
  for (const item of [...project.packs, ...project.campaigns]) item.revision = project.revision;
  return structuredClone(compileContentProject(project).source);
}
