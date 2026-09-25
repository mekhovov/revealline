import { createJourneyOrnamentSpatialPairCandidates } from './journey-ornament-spatial-pair.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'crosswind-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

const revisions = Object.freeze({
  'survey-markers': {
    actors: [
      {
        id: 'north-west',
        role: 'field-keeper',
        tier: 'measured',
        x: 13.5,
        y: 7.5,
        heading: [1, 1],
      },
      {
        id: 'south-east',
        role: 'field-keeper',
        tier: 'measured',
        x: 59.5,
        y: 28.5,
        heading: [-1, -1],
      },
      {
        id: 'workbench',
        role: 'field-keeper',
        tier: 'measured',
        x: 35.5,
        y: 25.5,
        heading: [1, -1],
      },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 25.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(23, 7, 3, 8),
      rect(46, 7, 3, 8),
      rect(17, 10, 3, 5),
      rect(52, 20, 3, 6),
      rect(21, 21, 3, 7),
      rect(48, 27, 3, 5),
    ],
    foundations: [
      rect(31, 15, 10, 6),
      rect(31, 4, 10, 3),
      rect(8, 15, 8, 5),
      rect(56, 15, 8, 5),
      rect(31, 29, 10, 3),
    ],
    speedZones: [
      { id: 'north-receiver', direction: 'up', ...rect(33, 7, 6, 8) },
      { id: 'west-receiver', direction: 'left', ...rect(16, 16, 15, 3) },
      { id: 'east-receiver', direction: 'right', ...rect(41, 16, 15, 3) },
      { id: 'south-receiver', direction: 'down', ...rect(33, 21, 6, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        'Commit to a marked receiver corridor for the shortest connection, or dogleg around an antenna baffle toward a side work pad while its keeper is distant?',
      lesson:
        'FPV receiver-inspired walls block movement but never close a cut. Directional fields change route efficiency only while their cells remain unclaimed.',
      counterplay:
        'Read the workbench keeper before taking a direct corridor. Use the central pad to choose a second heading, and approach a baffle end behind the perimeter patrol.',
      captureConsequence:
        'Connecting one receiver pad neutralizes its directional field and creates a return beyond one baffle; the other occupied approaches remain active.',
      memorableMoment:
        'The obvious fast trace becomes a risky closure while a longer component-shaped dogleg opens the better next departure.',
      mastery:
        'Connect one vertical and one horizontal receiver pad, then close around a baffle end without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'windbreak-weave': {
    actors: [
      {
        id: 'northwest',
        role: 'field-keeper',
        tier: 'measured',
        x: 14.5,
        y: 6.5,
        heading: [1, 1],
      },
      {
        id: 'southeast',
        role: 'field-keeper',
        tier: 'measured',
        x: 57.5,
        y: 29.5,
        heading: [-1, -1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 32, y: 17, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(16, 9, 18, 2),
      rect(40, 9, 17, 2),
      rect(8, 13, 17, 2),
      rect(47, 13, 17, 2),
      rect(8, 21, 17, 2),
      rect(47, 21, 17, 2),
      rect(16, 25, 18, 2),
      rect(40, 25, 17, 2),
    ],
    foundations: [
      rect(33, 15, 6, 6),
      rect(28, 4, 16, 3),
      rect(7, 16, 9, 4),
      rect(56, 16, 9, 4),
      rect(28, 29, 16, 3),
    ],
    speedZones: [
      { id: 'north-thread', direction: 'up', ...rect(34, 7, 4, 8) },
      { id: 'west-thread', direction: 'left', ...rect(16, 16, 17, 4) },
      { id: 'east-thread', direction: 'right', ...rect(39, 16, 17, 4) },
      { id: 'south-thread', direction: 'down', ...rect(34, 21, 4, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        'Follow the short marked thread through the bezkonechnyk-inspired weave, or turn around an alternating wall end to reshape the frontier before reaching an outer landing?',
      lesson:
        'The endless-line-inspired rhythm is made from broken walls, so every passage remains visibly open. Only foundations and captured territory close cuts.',
      counterplay:
        'Turn on the central landing after reading the frontier patrol. Alternate left and right wall ends instead of repeating the same exposed spoke.',
      captureConsequence:
        'A closure neutralizes one directional thread and moves the frontier along the newly captured contour, changing which meander opening is safer next.',
      memorableMoment:
        'A straight assisted connection makes the opposite winding passage—not another identical spoke—the next useful route.',
      mastery: 'Connect three outer landings through alternating openings without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
});

/** Second copy-on-write spatial batch, intentionally stacked on the first pair.
 * No route enrolment or reinterpretation of existing missions occurs here. */
export function createJourneyCrosswindSpatialPairCandidates({ artwork = false } = {}) {
  const source = createJourneyOrnamentSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-crosswind-spatial-pair-original-review'
    : 'whole-crosswind-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · Crosswind ornament and FPV spatial successors';
  for (const [missionId, revision] of Object.entries(revisions)) {
    const mission = project.missions.find((item) => item.id === missionId);
    const oldMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const map = {
      ...oldMap,
      revision: REVISION,
      walls: revision.walls,
      foundations: revision.foundations,
      speedZones: revision.speedZones,
      spawns: [revision.spawn],
    };
    project.maps = project.maps.filter(
      (item) => item.id !== oldMap.id || item.revision !== oldMap.revision,
    );
    project.maps.push(map);
    Object.assign(mission, {
      revision: REVISION,
      map: { id: map.id, revision: map.revision },
      actors: revision.actors,
      design: {
        ...mission.design,
        ...revision.design,
        practices: [...new Set([...mission.design.practices, 'walls'])],
        combines: [...new Set([...mission.design.combines, 'walls'])],
      },
    });
  }
  for (const item of [...project.packs, ...project.campaigns]) item.revision = REVISION;
  return structuredClone(compileContentProject(project).source);
}
