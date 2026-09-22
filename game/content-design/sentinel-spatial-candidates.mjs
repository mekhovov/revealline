import { createSentinelCandidates } from './sentinel-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });

// Explicit geometry study, not a silent change to earlier Sentinel editions.
export function createSentinelSpatialCandidates() {
  const project = withPressureDifficulty(createSentinelCandidates());
  project.id = 'sentinel-spatial-review';
  project.name = 'Sentinel Crown · receiver approach study';
  project.revision = 'receiver-spatial-1';
  for (const mission of project.missions) {
    if (!['twin-receivers', 'relay-perimeter'].includes(mission.id)) continue;
    const map = project.maps.find((m) => m.id === mission.map.id);
    map.revision = mission.revision = mission.map.revision = 'receiver-spatial-1';
    const twin = mission.id === 'twin-receivers';
    const core = twin ? [59.5, 18.5] : [44.5, 18.5];
    Object.assign(
      mission.actors.find((a) => a.id === 'sentinel'),
      { x: core[0], y: core[1] },
    );
    Object.assign(
      mission.objectives.find((o) => o.id === 'core'),
      { x: core[0], y: core[1] },
    );
    if (twin) {
      map.foundations = [rect(6, 14, 7, 8), rect(22, 5, 8, 4), rect(22, 27, 8, 4)];
      map.walls = [
        rect(38, 6, 28, 2),
        rect(38, 28, 28, 2),
        rect(64, 8, 2, 20),
        rect(44, 12, 20, 2),
        rect(44, 22, 20, 2),
      ];
      map.spawns[0] = { id: 'home', x: 9.5, y: 17.5 };
      Object.assign(
        mission.objectives.find((o) => o.id === 'west-shield'),
        { x: 49.5, y: 10.5 },
      );
      Object.assign(
        mission.objectives.find((o) => o.id === 'east-shield'),
        { x: 59.5, y: 25.5 },
      );
      mission.actors.find((a) => a.id === 'frontier').edge = { x: 5, y: 17, side: 'east' };
      Object.assign(
        mission.actors.find((a) => a.id === 'rover'),
        { x: 20.5, y: 18.5 },
      );
      mission.design.routeDecision =
        'Secure the upper gallery approach first, or the lower landing, before turning around a receiver baffle?';
      mission.design.lesson =
        'Deep receiver galleries share the Sentinel field. Choose returns outside the baffles before committing to an inner cut.';
      mission.design.counterplay =
        'The walls block turns and never close cuts. The frontier follows your new return edge; the roamer activates on reclaimed ground.';
      mission.design.captureConsequence =
        'An approach capture creates useful return ground without automatically defeating the core. The same exposed-stage release rule applies.';
      mission.design.memorableMoment =
        'The second receiver approach becomes visible beyond the first gallery wall.';
      mission.design.mastery =
        'Capture the lower receiver before the upper receiver, in separate closures, and clear without losing a life.';
    } else {
      map.foundations = [
        rect(6, 8, 8, 5),
        rect(5, 22, 8, 5),
        rect(18, 16, 6, 4),
        rect(59, 25, 6, 5),
      ];
      map.walls = [
        rect(24, 5, 3, 22),
        rect(34, 7, 22, 3),
        rect(30, 25, 23, 3),
        rect(54, 13, 3, 10),
      ];
      map.spawns[0] = { id: 'home', x: 8.5, y: 0.5 };
      map.gates = [
        { id: 'corner-top', ...rect(14, 8, 6, 3) },
        { id: 'corner-side', ...rect(18, 11, 2, 5) },
      ];
      Object.assign(
        mission.objectives.find((o) => o.id === 'west-shield'),
        { x: 31.5, y: 22.5 },
      );
      Object.assign(
        mission.objectives.find((o) => o.id === 'east-shield'),
        { x: 60.5, y: 18.5 },
      );
      Object.assign(
        mission.objectives.find((o) => o.id === 'north-shield'),
        { x: 43.5, y: 12.5 },
      );
      mission.actors.find((a) => a.id === 'frontier').edge = { x: 5, y: 10, side: 'east' };
      Object.assign(
        mission.actors.find((a) => a.id === 'rover'),
        { x: 20.5, y: 24.5 },
      );
      mission.design.routeDecision =
        'Open the western transfer corner first, or take the long outer approach to a receiver beyond the baffles?';
      mission.design.lesson =
        'Separated returns make the opened corner a repositioning route; shield order stays voluntary and the core rules do not change.';
      mission.design.counterplay =
        'Leave space around each baffle end before committing. Capturing the roamer changes pressure on reclaimed returns, not the Sentinel retaining rule.';
      mission.design.captureConsequence =
        'The western shield joins the upper landing to the inner transfer pad with non-scoring reclaimed connectors.';
      mission.design.memorableMoment =
        'A broken transfer corner becomes a walkable alternative to the outer detour.';
    }
  }
  for (const item of [...project.packs, ...project.campaigns]) item.revision = 'receiver-spatial-1';
  return structuredClone(compileContentProject(project).source);
}
