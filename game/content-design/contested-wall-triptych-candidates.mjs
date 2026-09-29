import { freezeDesign } from './catalogs.mjs';
import { createCurrentRemixPressureCandidates } from './current-remix-pressure-candidates.mjs';
import { NEON_CULTURAL_ROUTES_SOURCES } from './neon-cultural-routes-candidates.mjs';
import { FRACTURE_CULTURAL_ROUTES_SOURCES } from './fracture-cultural-routes-candidates.mjs';
import { LIVEWIRE_CULTURAL_ROUTES_SOURCES } from './livewire-cultural-routes-candidates.mjs';

export const CONTESTED_WALL_TRIPTYCH_REVISION = 'contested-wall-triptych-1';

export const CONTESTED_WALL_TRIPTYCH_SOURCES = freezeDesign({
  opishnePaintedBowls: {
    ...NEON_CULTURAL_ROUTES_SOURCES.opishnePaintedBowls,
    adaptationBoundary:
      'Original interrupted wall brackets extend the established contour vocabulary using unequal openings only. No bowl, painted motif, palette, meaning, object outline or source coordinates are copied.',
  },
  borshchivEmbroidery: {
    ...FRACTURE_CULTURAL_ROUTES_SOURCES.borshchivEmbroidery,
    adaptationBoundary:
      'Original staggered wall shoulders extend the established relief-panel vocabulary using alternating density only. No shirt, stitch, motif, palette, meaning or source coordinates are copied.',
  },
  kyivWovenBelt: {
    ...LIVEWIRE_CULTURAL_ROUTES_SOURCES.kyivWovenBelt,
    adaptationBoundary:
      'Original quadrant brackets extend the established narrow-band cadence using separated right-angle fields only. No belt, ornament, weave draft, palette, meaning or source coordinates are copied.',
  },
});

export const CONTESTED_WALL_TRIPTYCH_SELECTIONS = freezeDesign([
  {
    id: 'side-door-bays',
    disposition: 'opishne-interrupted-mouth-brackets',
    sourceIds: ['opishnePaintedBowls'],
    approaches: ['near-mouth-first', 'far-shoulder-first'],
    pressurePoints: ['west-mouth', 'upper-transfer', 'lower-transfer', 'east-mouth'],
  },
  {
    id: 'staggered-reserve',
    disposition: 'borshchiv-staggered-repair-shoulders',
    sourceIds: ['borshchivEmbroidery'],
    approaches: ['slow-anchor-first', 'danger-pocket-first'],
    pressurePoints: ['west-pocket', 'slow-shoulder', 'central-reserve', 'east-repair-gap'],
  },
  {
    id: 'crossbar-depot',
    disposition: 'kyiv-band-quadrant-locks',
    sourceIds: ['kyivWovenBelt'],
    approaches: ['north-south-first', 'east-west-first'],
    pressurePoints: [
      'northwest-bracket',
      'northeast-bracket',
      'southwest-bracket',
      'southeast-bracket',
    ],
  },
]);

const rect = (x, y, w, h) => ({ x, y, w, h });
const revisions = Object.freeze({
  'side-door-bays': {
    walls: [
      rect(23, 5, 5, 2),
      rect(25, 7, 2, 5),
      rect(44, 6, 5, 2),
      rect(44, 8, 2, 5),
      rect(22, 24, 5, 2),
      rect(25, 26, 2, 5),
      rect(44, 24, 5, 2),
      rect(47, 20, 2, 4),
    ],
    design: {
      routeDecision:
        'Take the compact western mouth while its patrol is leaving, or cross the broken central shoulders to establish the reversed eastern bay before returning through a different opening?',
      lesson:
        'Opishne-painted-bowl records inform interrupted contour rhythm only. Walls block movement and never become return ground; the existing contour foundations still close every cut.',
      counterplay:
        'Use the upper transfer for the shorter west-first route. The lower transfer costs more exposure but reaches the far mouth after its counter-clockwise patrol has committed away.',
      captureConsequence:
        'West-first creates a dependable staging contour near home. East-first redirects the far patrol and makes the lower centre a shorter second enclosure.',
      memorableMoment:
        'Two broken wall shoulders turn the open middle into a choice between opposing contour mouths instead of a single safe crossing.',
      mastery:
        'Connect all three contours and use both central transfer gaps without losing a life.',
      difficulty: {
        band: 4,
        planning: 6,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
  'staggered-reserve': {
    walls: [
      rect(5, 14, 8, 2),
      rect(11, 16, 2, 6),
      rect(23, 14, 6, 2),
      rect(27, 16, 2, 6),
      rect(43, 12, 7, 2),
      rect(43, 14, 2, 5),
      rect(43, 28, 7, 2),
      rect(48, 24, 2, 4),
    ],
    design: {
      routeDecision:
        'Bank the slowed northern anchor through the narrow western shoulder, or cross the open east repair gap to enclose the lethal pocket before an eroder reopens the earned route?',
      lesson:
        'Borshchiv embroidery informs alternating visual density only. Staggered walls shape repairs while foundations remain permanent and earned territory remains erodible.',
      counterplay:
        'Keep the central foundation in reserve. West-first shortens the anchor capture; east-first avoids the reclaimed roamer but leaves a longer repair route behind the lethal field.',
      captureConsequence:
        'North-first neutralizes the slow approach and banks one protected objective. South-east-first removes immediate danger and creates a stronger but erodible repair corridor.',
      memorableMoment:
        'Alternating dense and open shoulders make the same diagonal island sequence support a cautious anchor route or an exposed repair race.',
      mastery: 'Capture both anchors, neutralize both terrain fields and repair one reopened link.',
      difficulty: {
        band: 7,
        planning: 8,
        execution: 6,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  'crossbar-depot': {
    walls: [
      rect(8, 11, 10, 2),
      rect(8, 13, 2, 3),
      rect(48, 6, 8, 2),
      rect(48, 8, 2, 5),
      rect(16, 23, 8, 2),
      rect(22, 25, 2, 6),
      rect(52, 22, 8, 2),
      rect(60, 24, 2, 7),
    ],
    design: {
      routeDecision:
        'Build the north-south spine through the two narrow band openings, or establish the east-west crossbar while alternating row and column warnings constrain opposite quadrants?',
      lesson:
        'A Kyiv-area woven-belt record informs separated narrow-band cadence only. The brackets are walls; the permanent cross foundations remain the only authored returns.',
      counterplay:
        'The north-south route has shorter individual cuts but repeatedly crosses the row warning. The east-west route is longer and must close before the column warning owns its next quadrant.',
      captureConsequence:
        'A completed spine opens short side departures around both hazards. A completed crossbar creates broad returns but leaves the north and south brackets as contested finishing routes.',
      memorableMoment:
        'Four offset right-angle brackets divide the two telegraphed attack axes into readable, differently timed quadrants.',
      mastery:
        'Connect all five foundations and close through both a row-warning and a column-warning window.',
      difficulty: {
        band: 9,
        planning: 10,
        execution: 8,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v35. Only selected wall geometry and design notes
 * change; actors, terrain, foundations, spawns, objectives and rules stay exact. */
export function createContestedWallTriptychCandidates({ artwork = false } = {}) {
  const before = createCurrentRemixPressureCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-contested-wall-triptych-original-review'
    : 'whole-contested-wall-triptych-greybox-review';
  project.name = 'Whole Journey · contested Ukrainian wall triptych';
  project.revision = CONTESTED_WALL_TRIPTYCH_REVISION;

  for (const selection of CONTESTED_WALL_TRIPTYCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: CONTESTED_WALL_TRIPTYCH_REVISION,
      walls: structuredClone(revision.walls),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: CONTESTED_WALL_TRIPTYCH_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        introduces: mission.design.introduces,
        practices: [...new Set([...mission.design.practices, 'walls'])],
        combines: [...new Set([...mission.design.combines, 'walls'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = CONTESTED_WALL_TRIPTYCH_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = CONTESTED_WALL_TRIPTYCH_REVISION;
  return structuredClone(project);
}
