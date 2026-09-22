import { createPhaseCandidates } from './phase-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });

// Explicit greybox successor; original content, pictures and enrollment stay intact.
export function createPhaseSpatialCandidates() {
  const project = withPressureDifficulty(createPhaseCandidates());
  project.id = 'phase-spatial-review';
  project.name = 'Phaseworks · reserve landing study';
  project.revision = 'reserve-spatial-1';
  const mission = project.missions.find((m) => m.id === 'return-in-reserve');
  const map = project.maps.find((m) => m.id === mission.map.id);
  map.revision = mission.revision = mission.map.revision = 'reserve-spatial-1';
  map.foundations = [rect(1, 14, 70, 3), rect(31, 5, 9, 3), rect(37, 26, 7, 3)];
  map.walls = [rect(12, 23, 18, 2), rect(48, 18, 2, 10)];
  map.spawns = [{ id: 'home', x: 35.5, y: 15.5 }];
  Object.assign(
    mission.actors.find((a) => a.id === 'carrier'),
    {
      x: 43.5,
      y: 10.5,
      heading: [-1, 0],
    },
  );
  Object.assign(
    mission.actors.find((a) => a.id === 'keeper'),
    {
      x: 10.5,
      y: 20.5,
      heading: [1, 1],
    },
  );
  mission.actors.push({
    id: 'lower-keeper',
    role: 'field-keeper',
    tier: 'measured',
    x: 60.5,
    y: 31.5,
    heading: [-1, -1],
  });
  mission.design.routeDecision =
    'Practice a short northern landing return, or work around the lower baffles for a larger enclosure between two keepers?';
  mission.design.lesson =
    'Only the bolt carrier sends travelling impacts. The two lower keepers break a trail immediately; each occupied bay retains its own field.';
  mission.design.counterplay =
    'The northern landing offers a short return. Watch the bolt before extending your trail; close before its impact reaches you. Use the center deck to change bays, and never mistake a wall for a return.';
  mission.design.captureConsequence =
    'A landing connection improves your next escape without clearing the other occupied bay. Neither bay alone reaches the coverage target.';
  mission.design.memorableMoment =
    'A small landing return extinguishes an impact; the lower bay then asks for a different enclosure around its baffles.';
  mission.design.difficulty.threatDensity = 4;
  for (const item of [...project.packs, ...project.campaigns]) item.revision = 'reserve-spatial-1';
  return structuredClone(compileContentProject(project).source);
}
