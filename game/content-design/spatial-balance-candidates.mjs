import { createCulturalWorkshopCandidates } from './cultural-workshop-candidates.mjs';
import { createPursuitInterceptCandidates } from './pursuit-intercept-candidates.mjs';
import { compileContentProject } from './project.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });

/** Copy-on-write geometry experiment. Earlier editions/fixtures are unchanged.
 * No enrolment or human pacing claim. Coverage and physics stay fixed. */
export function createSpatialBalanceCandidates({ pressure = false } = {}) {
  const source = pressure ? createPursuitInterceptCandidates() : createCulturalWorkshopCandidates();
  const project = structuredClone(source);
  project.id = `${source.id}-spatial-v2`;
  project.name = `${source.name} · spatial revision 2`;
  project.revision = 'spatial-2';
  for (const mission of project.missions) {
    const motor = ['four-motor-landings', 'motor-feint'].includes(mission.id);
    if (!motor && mission.id !== 'dnipro-crossings') continue;
    const map = project.maps.find(
      (m) => m.id === mission.map.id && m.revision === mission.map.revision,
    );
    map.revision = 'spatial-2';
    mission.map.revision = 'spatial-2';
    mission.revision = 'spatial-2';
    if (motor) {
      map.foundations = [
        rect(12, 6, 6, 5),
        rect(54, 8, 6, 5),
        rect(14, 25, 6, 5),
        rect(52, 24, 6, 5),
      ];
      map.walls = [
        rect(31, 13, 10, 10),
        rect(24, 7, 24, 3),
        rect(25, 26, 21, 3),
        rect(3, 17, 18, 3),
        rect(51, 17, 18, 3),
      ];
      map.spawns[0] = { ...map.spawns[0], x: 15.5, y: 0.5 };
      mission.actors.find((a) => a.id === 'west').y = 12.5;
      mission.design.routeDecision = pressure
        ? 'Bait the heading lock toward a blocked aisle, or connect the offset pad with a shorter exposed dogleg?'
        : 'Connect an offset motor pad through the inner aisle, or circle a frame arm for a wider enclosure?';
      mission.design.captureConsequence =
        'A pad connection creates a return beyond a frame arm; retaining enemies still determine which side fills.';
      mission.design.memorableMoment =
        'The open frame arms turn four pads into a choice of changing approach directions.';
    } else {
      map.foundations = [
        rect(8, 8, 8, 5),
        rect(12, 24, 8, 5),
        rect(56, 6, 8, 5),
        rect(51, 23, 10, 5),
        rect(32, 15, 6, 5),
      ];
      map.walls = [
        rect(25, 6, 3, 11),
        rect(43, 20, 3, 10),
        rect(5, 18, 16, 3),
        rect(49, 14, 17, 3),
      ];
      map.spawns[0] = { ...map.spawns[0], x: 13.5, y: 10.5 };
      Object.assign(
        mission.actors.find((a) => a.id === 'south'),
        { x: 7.5, y: 30.5 },
      );
      mission.actors.push({
        id: 'east',
        role: 'field-keeper',
        tier: 'standard',
        x: 64.5,
        y: 19.5,
        heading: [-1, 1],
      });
      mission.design.difficulty.threatDensity = mission.actors.length - 1;
      mission.design.routeDecision =
        'Link the central landing to pass the staggered breakwater, or take the wider outer crossing?';
      mission.design.lesson =
        'Shore platforms are real returns; staggered breakwaters and keepers in separated approaches make crossing order matter.';
      mission.design.captureConsequence =
        'Each shore connection offers a shorter next approach around a different breakwater end.';
    }
  }
  for (const row of [...project.campaigns, ...project.packs]) row.revision = 'spatial-2';
  return structuredClone(compileContentProject(project).source);
}
