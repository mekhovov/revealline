import { createHorizonSpatialCandidates } from './horizon-spatial-candidates.mjs';
import { compileContentProject } from './project.mjs';

// Explicit candidate edition. Never reinterpret the original Outpost's replays.
export function createOutpostSpatialCandidates({ artwork = false } = {}) {
  const project = createHorizonSpatialCandidates({ artwork });
  project.id = 'horizon-outpost-spatial-review';
  project.name = 'Horizon School · outpost keeper positions';
  project.revision = 'outpost-spatial-1';
  const mission = project.missions.find((item) => item.id === 'island-outpost');
  mission.revision = project.revision;
  mission.actors.find((actor) => actor.id === 'north').x = 11.5;
  mission.design.routeDecision =
    'Establish the short western bridge beside its keeper, or time the longer eastern return before choosing the next enclosure?';
  mission.design.lesson =
    'An interior outpost offers several departures. Keepers on opposite sides can retain both regions after a cut; a small bridge can still create useful return angles.';
  mission.design.counterplay =
    'Read the western keeper before enclosing the near shore and the eastern keeper before the long crossing. Reposition on the island to choose an upper or lower departure.';
  mission.design.captureConsequence =
    'A connection makes a new return surface, not a guaranteed large reveal. The next enclosure depends on which side each keeper occupies.';
  mission.design.memorableMoment =
    'A line-only bridge becomes the launch point for a smaller enclosure around the keeper on that shore.';
  for (const item of [...project.packs, ...project.campaigns]) item.revision = project.revision;
  return structuredClone(compileContentProject(project).source);
}
