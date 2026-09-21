import { createFractureCandidates } from './fracture-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });

// An explicit greybox successor. Never mutates or enrolls the previous edition.
export function createFractureSpatialCandidates() {
  const project = withPressureDifficulty(createFractureCandidates());
  project.id = 'fracture-spatial-review';
  project.name = 'Fractured Grid · district approaches study';
  project.revision = 'district-spatial-1';
  const mission = project.missions.find((m) => m.id === 'two-districts');
  const map = project.maps.find((m) => m.id === mission.map.id);
  map.revision = mission.revision = mission.map.revision = 'district-spatial-1';
  map.foundations = [rect(34, 1, 4, 34), rect(19, 16, 6, 4), rect(50, 11, 5, 6)];
  map.walls = [rect(8, 13, 10, 2), rect(12, 25, 18, 2), rect(45, 7, 2, 14), rect(51, 22, 14, 2)];
  mission.actors.find((a) => a.id === 'west-cutter').heading = [1, -1];
  mission.actors.push(
    {
      id: 'west-keeper',
      role: 'field-keeper',
      tier: 'measured',
      x: 12.5,
      y: 30.5,
      heading: [1, 0],
    },
    { id: 'east-keeper', role: 'field-keeper', tier: 'measured', x: 60.5, y: 5.5, heading: [0, 1] },
  );
  mission.design.routeDecision =
    'Bank the short western island return, work around the eastern baffle to reach its taller landing, or risk a broad outer enclosure?';
  mission.design.lesson =
    'Each district contains an eroder and a keeper. A cut between occupied pockets secures only its line; choose the return that improves your next enclosure.';
  mission.design.counterplay =
    'Use the center spine to switch districts when pressure builds. Walls never close cuts; the islands do. Read both field anchors before a large slice.';
  mission.design.captureConsequence =
    'Connecting an island shortens later returns without clearing its occupied district. The permanent center lane never erodes; earned approaches can.';
  mission.design.memorableMoment =
    'A modest island connection becomes a new departure around a baffle while the far pocket remains visibly occupied.';
  for (const item of [...project.packs, ...project.campaigns]) item.revision = 'district-spatial-1';
  return structuredClone(compileContentProject(project).source);
}
