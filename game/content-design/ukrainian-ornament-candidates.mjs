import { freezeDesign } from './catalogs.mjs';
import { createSpatialChallengeJourney } from './spatial-challenge-journey.mjs';

export const UKRAINIAN_ORNAMENT_REVISION = 'ukrainian-ornament-study-1';
export const UKRAINIAN_ORNAMENT_MISSION_IDS = freezeDesign([
  'cross-stitch-crossings',
  'rushnyk-bands',
  'pysanka-sections',
]);

const rect = (x, y, w, h) => ({ x, y, w, h });
// Original stepped abstractions, not traced embroidery or asserted regional
// symbolism. Omitting opposite tips leaves two deliberate, traversable mouths.
const openDiamond = (x, y, vertical = false) =>
  [
    [0, -8],
    [2, -6],
    [4, -4],
    [6, -2],
    [6, 2],
    [4, 4],
    [2, 6],
    [0, 8],
    [-2, 6],
    [-4, 4],
    [-6, 2],
    [-6, -2],
    [-4, -4],
    [-2, -6],
  ].map(([dx, dy]) => rect(x + (vertical ? -dy : dx), y + (vertical ? dx : dy), 2, 2));

function revise(project, id, update) {
  const mission = project.missions.find((candidate) => candidate.id === id);
  if (!mission) throw new Error(`Ornament study requires mission ${id}.`);
  const previous = project.maps.find(
    (map) => map.id === mission.map.id && map.revision === mission.map.revision,
  );
  if (!previous) throw new Error(`Ornament study requires the map for ${id}.`);
  const map = structuredClone(previous);
  mission.revision = map.revision = UKRAINIAN_ORNAMENT_REVISION;
  mission.map = { id: map.id, revision: map.revision };
  update(mission, map);
  const shared = project.missions.some(
    (other) => other.map.id === previous.id && other.map.revision === previous.revision,
  );
  if (shared) project.maps.push(map);
  else project.maps[project.maps.indexOf(previous)] = map;
}

function spawnAt(mission, map, x, y) {
  map.spawns = map.spawns.map((spawn) =>
    spawn.id === mission.spawnId ? { ...spawn, x, y } : spawn,
  );
}

function addKeeper(mission, id, x, y, heading) {
  const template = mission.actors.find((actor) => actor.role === 'field-keeper');
  if (!template) throw new Error(`Ornament study requires a keeper in ${mission.id}.`);
  mission.actors.push({ ...structuredClone(template), id, x, y, heading });
}

/** Explicit optional successor, never a mutation of the v6 default or old saves.
 * The host/Studio compiler and shared gp4 preparation remain authoritative.
 * Pictures, quotas, bands, controls and unrelated authored records are preserved;
 * compilation and route samples are not human balance or cultural validation. */
export function createUkrainianOrnamentJourney({
  artwork = false,
  source = createSpatialChallengeJourney({ artwork }),
} = {}) {
  const project = structuredClone(source);
  revise(project, 'cross-stitch-crossings', (mission, map) => {
    map.walls = [...openDiamond(22, 16), ...openDiamond(49, 20, true)];
    map.foundations = [rect(11, 14, 5, 4), rect(34, 8, 5, 4), rect(61, 25, 5, 5)];
    spawnAt(mission, map, 13.5, 15.5);
    // The added keeper contests the rotated motif, while the original two keep
    // their exterior routes. This is spatial pressure, not faster map physics.
    addKeeper(mission, 'rotated-motif', 47.5, 21.5, [-1, -1]);
    Object.assign(mission.design, {
      routeDecision:
        'Thread the first diamond mouth to the offset middle landing, or enclose around its upper shoulder before approaching the north-south motif?',
      lesson:
        'From the starting reclaimed landing, inspect the wall to the right: walls block craft and keepers but never close a cut. Only reclaimed ground is a return; the second diamond opens on a different axis.',
      counterplay:
        'Use the lower edge of the starting landing for the open mouth, or depart above the shoulder. Read the keeper courses before turning toward the offset return; no pickup is required.',
      captureConsequence:
        'Connecting the middle landing changes the approach to the rotated motif. Keepers still retain their current field regions, so a useful connection may bank only its trail.',
      memorableMoment:
        'The second stitched diamond cannot be crossed by repeating the first horizontal route.',
      mastery:
        'Connect both detached landings using a motif mouth and an exterior shoulder approach without losing a life.',
      introduces: ['walls'],
      practices: ['enemy-seeded-closure', 'foundations'],
      combines: ['walls', 'foundations', 'enemy-seeded-closure'],
    });
    mission.design.difficulty.threatDensity = 3;
  });

  revise(project, 'rushnyk-bands', (mission, map) => {
    // Each band is a stepped wall, with a broad alternating gap. No reclaimed
    // strip spans either gap: each crossing must earn its connecting trail.
    map.walls = [
      rect(4, 8, 8, 2),
      rect(10, 10, 2, 4),
      rect(12, 12, 11, 2),
      rect(32, 8, 12, 2),
      rect(42, 10, 2, 4),
      rect(44, 12, 12, 2),
      rect(54, 8, 2, 4),
      rect(56, 8, 12, 2),
      rect(4, 24, 12, 2),
      rect(14, 20, 2, 4),
      rect(16, 20, 10, 2),
      rect(24, 22, 2, 4),
      rect(26, 24, 14, 2),
      rect(49, 24, 9, 2),
      rect(56, 20, 2, 4),
      rect(58, 20, 10, 2),
    ];
    map.foundations = [
      rect(12, 8, 6, 4),
      rect(26, 6, 4, 4),
      rect(42, 27, 4, 4),
      rect(57, 16, 7, 4),
    ];
    spawnAt(mission, map, 14.5, 10.5);
    // Two outside keepers alone leave the new inner weave weakly contested.
    // A third ordinary keeper occupies that field; the outer patrol stays outer.
    addKeeper(mission, 'inner-weave', 35.5, 17.5, [-1, 1]);
    Object.assign(mission.design, {
      routeDecision:
        'Connect the short upper landing and weave through the alternating inner gaps, or wrap a band end for a broader enclosure while timing the perimeter patrol?',
      lesson:
        'Inspect the wall immediately below the starting reclaimed pad. The zigzag bands block movement and cannot close a cut; the small return pads stop before the gaps rather than bridging them for free.',
      counterplay:
        'Watch the keeper between the bands before crossing the open weave. Use a return beyond one band end if the inner passage is pressured, and avoid waiting in the outer patrol path.',
      captureConsequence:
        'An earned passage connection creates a return beside the next bend. It does not turn the wall into reclaimed ground or move the perimeter patrol onto the new frontier.',
      memorableMoment:
        'A route that turns right around the first embroidered band must reconsider its approach at the left-facing second band.',
      mastery:
        'Make one closure through an inner gap and another around a band end without losing a life.',
      introduces: [],
      practices: ['enemy-seeded-closure', 'foundations', 'walls', 'perimeter-patrol'],
      combines: ['walls', 'foundations', 'perimeter-patrol'],
    });
    mission.design.difficulty.threatDensity = 3;
  });

  revise(project, 'pysanka-sections', (mission, map) => {
    // An open, asymmetric egg-decoration abstraction. Wide side and shoulder
    // openings keep one communicating field instead of empty sealed ornaments.
    map.walls = [
      rect(30, 5, 12, 2),
      rect(24, 9, 6, 2),
      rect(42, 9, 4, 2),
      rect(20, 12, 4, 6),
      rect(46, 12, 4, 3),
      rect(50, 18, 3, 8),
      rect(17, 23, 4, 5),
      rect(21, 28, 8, 2),
      rect(29, 31, 18, 2),
      rect(47, 28, 6, 2),
    ];
    map.foundations = [rect(33, 7, 6, 5), rect(8, 19, 5, 5), rect(59, 14, 5, 5)];
    spawnAt(mission, map, 35.5, 9.5);
    const frontier = mission.actors.find((actor) => actor.role === 'frontier-patrol');
    if (!frontier) throw new Error('Pysanka study requires its existing frontier patrol.');
    // The patrol remains on the same side of the moved central return, not in
    // unclaimed field or on a decorative wall contour.
    frontier.edge = { x: 32, y: 9, side: 'east' };
    Object.assign(mission.design, {
      routeDecision:
        'Connect through the broad right-side opening and reshape the nearby frontier, or pass around the northern shoulder to establish the exterior left return first?',
      lesson:
        'Inspect the wall above the starting reclaimed pad. The open stepped shell blocks movement but is not a return surface; only keeper positions decide retained field, and the frontier patrol follows reclaimed edges.',
      counterplay:
        'Leave from the side away from the frontier patrol. Read the inside keeper before the right-side cut, or use the visible shoulder gap to reach the longer outside approach.',
      captureConsequence:
        'A side connection changes the nearby patrol frontier, while a shoulder enclosure establishes an exterior return. Open wall sections remain walls and do not create a separate capture rule.',
      memorableMoment:
        'The short side opening and longer stepped shoulder lead to different useful return surfaces around the same open egg silhouette.',
      mastery:
        'Use both the side opening and northern shoulder approach before clearing without losing a life.',
      introduces: [],
      practices: ['enemy-seeded-closure', 'foundations', 'walls', 'frontier-patrol'],
      combines: ['walls', 'foundations', 'frontier-patrol'],
    });
  });

  project.id = artwork ? 'ukrainian-ornament-original-review' : 'ukrainian-ornament-greybox-review';
  project.revision = UKRAINIAN_ORNAMENT_REVISION;
  project.name = 'Ukrainian ornament · wall routing study · balance pending';
  for (const campaign of project.campaigns)
    if (campaign.id === 'ornament-crossings') campaign.revision = UKRAINIAN_ORNAMENT_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.includes('ornament-crossings'))
      pack.revision = UKRAINIAN_ORNAMENT_REVISION;
  return project;
}
