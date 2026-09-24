import { freezeDesign } from './catalogs.mjs';
import { createWholeSortingCandidates } from './whole-spatial-candidates.mjs';

export const SPATIAL_CHALLENGE_REVISION = 'spatial-challenge-a-1';
export const SPATIAL_CHALLENGE_MISSION_IDS = freezeDesign([
  'two-bays',
  'neon-remix',
  'broken-yard',
  'read-the-arrows',
  'crossing-complete',
]);

const rect = (x, y, w, h) => ({ x, y, w, h });
const terrain = (id, kind, x, y, w, h) => ({ id, kind, ...rect(x, y, w, h) });
const keeper = (id, x, y, heading) => ({
  id,
  role: 'field-keeper',
  tier: 'measured',
  x,
  y,
  heading,
});
const frontier = (id, x, y, side, clockwise = true) => ({
  id,
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side },
  clockwise,
});
const outer = () => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'measured',
  x: 71.5,
  y: 25.5,
  clockwise: true,
});

function revise(source, id, update) {
  const mission = source.missions.find((item) => item.id === id);
  if (!mission) throw new Error(`Spatial challenge requires mission ${id}.`);
  const oldMap = source.maps.find(
    (item) => item.id === mission.map.id && item.revision === mission.map.revision,
  );
  if (!oldMap) throw new Error(`Spatial challenge requires the map for ${id}.`);
  const map = structuredClone(oldMap);
  mission.revision = map.revision = SPATIAL_CHALLENGE_REVISION;
  mission.map = { id: map.id, revision: map.revision };
  update(mission, map);
  const shared = source.missions.some(
    (other) => other.map.id === oldMap.id && other.map.revision === oldMap.revision,
  );
  if (shared) source.maps.push(map);
  else source.maps[source.maps.indexOf(oldMap)] = map;
}

/** An explicit authored successor. A supplied source can compose another reviewed
 * mission revision; it is copied, and all unrelated records remain unchanged.
 * The normal host/Studio boundary compiles this data once. Shared gameplay
 * tuning is applied by the host, never encoded as map physics. */
export function createSpatialChallengeCandidates({
  artwork = false,
  source = createWholeSortingCandidates({ artwork }),
} = {}) {
  const project = structuredClone(source);
  revise(project, 'two-bays', (mission, map) => {
    // Offset shelves shorten different departures without joining the two
    // independently retained bays or supplying a scoring shortcut.
    map.foundations = [rect(26, 1, 3, 34), rect(21, 9, 5, 3), rect(29, 24, 7, 3)];
    map.spawns = [{ id: 'home', x: 27.5, y: 17.5 }];
    mission.actors = [
      keeper('west', 10.5, 10.5, [1, 1]),
      keeper('east', 43.5, 8.5, [1, 1]),
      keeper('east-return', 61.5, 27.5, [-1, -1]),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Bank a modest enclosure in the smaller bay, or start the larger bay while its two keepers leave a useful gap?',
      lesson:
        'The unequal bays retain independently. Neither whole bay supplies the clear quota; two keepers can keep both sides of a cut occupied in the larger bay.',
      counterplay:
        'Reposition along the divider to the upper west or lower east return shelf. Inspect both large-bay keepers before committing; a shorter return remains useful even when it banks only the trail.',
      captureConsequence:
        'A capture changes one occupied bay without filling the other. The permanent divider contributes no earned coverage.',
      memorableMoment:
        'The upper west and lower east shelves change where a shorter departure is available; one narrow-bay keeper and two wide-bay keepers contest different returns.',
      mastery:
        'Earn a closure in each bay and separate the two eastern keepers without a life loss.',
    });
    mission.design.difficulty.threatDensity = 3;
    mission.design.difficulty.planning = 3;
  });

  revise(project, 'neon-remix', (mission, map) => {
    // Three ordinary foundation circuits, with east-, north- and west-facing
    // mouths. These are deliberate landings, unlike the wall baffles below.
    map.foundations = [
      rect(8, 7, 14, 3),
      rect(8, 18, 14, 3),
      rect(8, 10, 3, 8),
      rect(19, 10, 3, 1),
      rect(19, 17, 3, 1),
      rect(29, 27, 14, 3),
      rect(29, 17, 3, 10),
      rect(40, 17, 3, 10),
      rect(29, 14, 3, 3),
      rect(38, 14, 5, 3),
      rect(50, 7, 14, 3),
      rect(50, 18, 14, 3),
      rect(61, 10, 3, 8),
      rect(50, 10, 3, 1),
      rect(50, 17, 3, 1),
    ];
    map.terrain = [
      terrain('slow-bridge', 'slow', 23, 11, 5, 7),
      terrain('north-mouth', 'slow', 32, 8, 6, 6),
      terrain('hot-bridge', 'lethal', 45, 12, 3, 10),
    ];
    mission.actors = [
      keeper('west', 14.5, 13.5, [1, 1]),
      keeper('middle', 35.5, 22.5, [1, -1]),
      keeper('east', 56.5, 13.5, [-1, 1]),
      frontier('near-frontier', 7, 13, 'east'),
      frontier('far-frontier', 64, 13, 'west', false),
      outer(),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Connect opposing mouths through the slow approach, approach the middle circuit from above, or neutralize the hot eastern transfer first?',
      lesson:
        'Each open circuit has a keeper and a different mouth. Closing a mouth can secure a line while leaving its occupied interior unclaimed.',
      counterplay:
        'Use the clear upper and lower bypasses. Read each frontier patrol separately and enclose the lethal bridge before crossing it.',
      captureConsequence:
        'Connecting circuits changes the return network and patrol contour; reclaiming a bridge removes its player-only hazard.',
      memorableMoment:
        'A north-facing return between two opposing mouths becomes the pivot for a different second capture.',
      mastery:
        'Use all three circuit foundations and neutralize both transfer approaches before clearing without a life loss.',
    });
    mission.design.difficulty.threatDensity = 5;
  });

  revise(project, 'broken-yard', (mission, map) => {
    map.foundations = [
      rect(31, 14, 7, 8),
      rect(25, 15, 6, 3),
      rect(8, 6, 8, 4),
      rect(55, 25, 8, 4),
    ];
    // The west foundation meets a wall: the craft can inspect its blocking
    // behavior while still on reclaimed ground, before making an exposed cut.
    map.walls = [rect(23, 8, 2, 12), rect(45, 14, 2, 14), rect(33, 5, 18, 2), rect(9, 25, 14, 2)];
    map.terrain = [
      terrain('marked-west', 'lethal', 13, 14, 6, 5),
      terrain('marked-east', 'lethal', 52, 9, 7, 5),
      terrain('marked-south', 'lethal', 31, 27, 8, 3),
    ];
    mission.actors = [
      keeper('north-west', 12.5, 12.5, [1, -1]),
      keeper('north-east', 60.5, 6.5, [-1, 1]),
      keeper('south-west', 9.5, 30.5, [1, -1]),
      keeper('south-east', 60.5, 20.5, [-1, 1]),
      {
        id: 'sleeper',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 59.5,
        y: 27.5,
        heading: [-1, 0],
      },
      frontier('frontier', 7, 7, 'east'),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Use the upper opening around the near wall to reach the quiet landing, or enclose a lethal cluster and prepare an escape from the roamer landing?',
      lesson:
        'The wall beside the starting foundation blocks craft and field enemies but never closes a cut. Red field harms only the craft until captured; reclaimed ground can host a roamer.',
      counterplay:
        'Inspect the nearby wall from the protected foundation. Its ends remain open; return to a marked landing rather than the wall, and keep another exit before entering the roamer platform.',
      captureConsequence:
        'The four irregular sectors communicate around wall ends. Capturing a hazard creates usable space, while joining the far foundation enlarges the active roamer route.',
      memorableMoment:
        'A wall shields one approach from a keeper, while the neighboring lethal pattern offers no such protection.',
      mastery:
        'Use both detached landings and reclaim two lethal clusters before clearing without a life loss.',
      introduces: ['walls'],
      combines: ['field-keeper', 'reclaimed-roamer', 'frontier-patrol', 'lethal-field', 'walls'],
    });
    mission.design.difficulty.threatDensity = 6;
  });

  revise(project, 'read-the-arrows', (mission, map) => {
    map.foundations = [rect(30, 17, 12, 4), rect(11, 11, 7, 5), rect(55, 25, 7, 4)];
    // The offset blockers shape subsequent transfers, not the first marked run.
    // Going around their ends still needs a foundation or earned-ground return.
    map.walls = [rect(22, 8, 2, 8), rect(47, 19, 2, 10)];
    map.speedZones = [
      { id: 'southbound', direction: 'down', ...rect(33, 3, 6, 14) },
      { id: 'northbound', direction: 'up', ...rect(25, 21, 5, 10) },
    ];
    mission.actors = [
      keeper('west', 9.5, 25.5, [1, -1]),
      keeper('east', 61.5, 6.5, [-1, 1]),
      keeper('lower-return', 45.5, 27.5, [-1, -1]),
      outer(),
      {
        id: 'emitter',
        role: 'lane-emitter',
        tier: 'measured',
        x: 57.5,
        y: 12.5,
        axis: 'vertical',
      },
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Take the broad marked run straight into the central landing, or use the longer western bypass around the first baffle before approaching the warned eastern lane?',
      counterplay:
        'The first fast corridor has no lethal tiles, lane attack or required turn at its end. Watch moving keepers and stop on the broad landing. Go around the staggered wall ends to reach a real return; use the western platform when the eastern emitter warns.',
      captureConsequence:
        'A reclaimed arrow corridor becomes ordinary return ground. The lane warning remains tied to its visible eastern column and keeps its established timing.',
      memorableMoment:
        'The fast straight crossing ends on a generous landing; the next direction is a deliberate decision between the quiet bypass and the warned lane.',
      combines: ['field-keeper', 'perimeter-patrol', 'lane-emitter', 'walls'],
    });
    mission.design.difficulty.threatDensity = 5;
  });

  revise(project, 'crossing-complete', (mission, map) => {
    map.foundations = [
      rect(29, 7, 14, 3),
      rect(8, 15, 17, 3),
      rect(47, 23, 17, 3),
      rect(31, 29, 10, 3),
    ];
    map.walls = [rect(44, 5, 2, 4), rect(28, 23, 2, 6)];
    mission.actors = [
      keeper('keeper-upper-west', 12.5, 6.5, [1, 1]),
      keeper('keeper-upper-east', 58.5, 14.5, [-1, 1]),
      keeper('keeper-lower-west', 16.5, 29.5, [1, -1]),
      keeper('keeper-lower-east', 59.5, 31.5, [-1, -1]),
      frontier('frontier', 28, 8, 'east'),
      outer(),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Time the contested central crossings between four keepers, or neutralize a side hazard to earn a broader approach around a baffle?',
      counterplay:
        'The marked center remains free of lethal tiles. Compare upper and lower keeper courses before crossing; the two side terraces support shorter captures and the freeze remains an optional detour.',
      captureConsequence:
        'A captured side belt becomes a usable approach, while center connections reshape the frontier. Wall ends still require a real return surface beyond them.',
      memorableMoment:
        'A narrow center connection prepares a side enclosure that changes the next crossing from a race into a broad return.',
      combines: [
        'field-keeper',
        'frontier-patrol',
        'perimeter-patrol',
        'directional-speed-fields',
        'lethal-field',
        'walls',
      ],
    });
    mission.design.difficulty.threatDensity = 7;
  });

  project.id = artwork
    ? 'spatial-challenge-a-original-review'
    : 'spatial-challenge-a-greybox-review';
  project.revision = SPATIAL_CHALLENGE_REVISION;
  project.name = 'Whole Journey · spatial challenge pilot';
  for (const item of [...project.campaigns, ...project.packs]) item.revision = project.revision;
  return project;
}
