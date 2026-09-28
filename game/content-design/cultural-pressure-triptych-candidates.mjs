import { freezeDesign } from './catalogs.mjs';
import { SIGNAL_CULTURAL_ROUTES_SOURCES } from './signal-cultural-routes-candidates.mjs';
import { ROVER_CULTURAL_ROUTES_SOURCES } from './rover-cultural-routes-candidates.mjs';
import { FRACTURE_CULTURAL_ROUTES_SOURCES } from './fracture-cultural-routes-candidates.mjs';
import { createCulturalTimedBonusPressureCandidates } from './cultural-timed-bonus-pressure-candidates.mjs';

export const CULTURAL_PRESSURE_TRIPTYCH_REVISION = 'cultural-pressure-triptych-1';

export const CULTURAL_PRESSURE_TRIPTYCH_SOURCES = freezeDesign({
  reshetylivkaWhitework: SIGNAL_CULTURAL_ROUTES_SOURCES.reshetylivkaWhitework,
  kosivCeramics: ROVER_CULTURAL_ROUTES_SOURCES.kosivCeramics,
  crimeanTatarOrnek: FRACTURE_CULTURAL_ROUTES_SOURCES.crimeanTatarOrnek,
});

export const CULTURAL_PRESSURE_TRIPTYCH_SELECTIONS = freezeDesign([
  {
    id: 'garden-refuges',
    disposition: 'reshetylivka-openwork-hazard-brackets',
    sourceIds: ['reshetylivkaWhitework'],
    approaches: ['near-row-first', 'far-refuge-first'],
    pressurePoints: ['home-spine', 'near-hazard-row', 'far-hazard-row', 'east-refuge'],
  },
  {
    id: 'broken-yard',
    disposition: 'kosiv-unequal-yard-panels',
    sourceIds: ['kosivCeramics'],
    approaches: ['west-window-first', 'east-pocket-first'],
    pressurePoints: ['central-branch', 'west-window', 'marked-pocket', 'roamer-return'],
  },
  {
    id: 'island-reserve',
    disposition: 'ornek-grouped-repair-islands',
    sourceIds: ['crimeanTatarOrnek'],
    approaches: ['slow-island-first', 'clear-reserve-first'],
    pressurePoints: ['central-island', 'slow-approach', 'east-reserve', 'erosion-front'],
  },
]);

const rect = (x, y, w, h) => ({ x, y, w, h });
const revisions = Object.freeze({
  'garden-refuges': {
    walls: [
      rect(6, 6, 8, 2),
      rect(6, 8, 2, 6),
      rect(58, 6, 8, 2),
      rect(64, 8, 2, 6),
      rect(6, 27, 8, 2),
      rect(12, 23, 2, 4),
      rect(58, 27, 8, 2),
      rect(58, 23, 2, 4),
    ],
    design: {
      routeDecision:
        'Neutralize the near lethal row through the short openwork bracket, or use the long outer shoulder to establish the east refuge before crossing either hazard?',
      lesson:
        'Reshetylivka-whitework-informed open brackets narrow the useful approaches without becoming returns; the two lethal rows still neutralize only through capture.',
      counterplay:
        'The home spine supports several departures. Read the frontier patrol before using the inner gap, or take the longer outer shoulder while both keepers are moving away.',
      captureConsequence:
        'Near-row-first creates a compact safe staging lane; refuge-first establishes a deeper return that shortens the second hazardous enclosure.',
      memorableMoment:
        'Alternating open and solid brackets make the two visually balanced hazard rows demand deliberately different routes.',
      mastery: 'Connect the east refuge and neutralize both lethal rows without losing a life.',
      difficulty: {
        band: 4,
        planning: 5,
        execution: 4,
        threatDensity: 3,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
  'broken-yard': {
    walls: [
      rect(20, 5, 8, 2),
      rect(20, 7, 2, 5),
      rect(52, 5, 12, 2),
      rect(66, 7, 2, 7),
      rect(6, 26, 10, 2),
      rect(14, 23, 2, 3),
      rect(55, 28, 10, 2),
      rect(55, 25, 2, 3),
    ],
    design: {
      routeDecision:
        'Use the short west window to bank a reserve return, or cross the longer east panel to neutralize the marked pocket before the central roamer controls that branch?',
      lesson:
        'Kosiv-ceramics-informed unequal panels are blocking walls, not reclaimed ground. The five foundations remain the only permanent landings.',
      counterplay:
        'Keep the central branch behind the craft while comparing the open panel ends. The west window is shorter; the east route is valuable only before the roamer owns its return.',
      captureConsequence:
        'West-first preserves a second escape from the hub; east-first removes the lethal pocket and creates a strong but more contested return.',
      memorableMoment:
        'Four irregular wall shoulders turn the broad yard into a sequence of communicating sectors without sealing any one chamber.',
      mastery:
        'Connect both outer platforms and neutralize the marked pocket after using both panel openings.',
      difficulty: {
        band: 6,
        planning: 7,
        execution: 5,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'island-reserve': {
    walls: [
      rect(5, 5, 10, 2),
      rect(5, 7, 2, 8),
      rect(18, 24, 9, 2),
      rect(25, 26, 2, 5),
      rect(45, 5, 10, 2),
      rect(45, 7, 2, 6),
      rect(61, 30, 6, 2),
      rect(65, 25, 2, 5),
    ],
    design: {
      routeDecision:
        'Take the short slowing approach into the western grouped island, or wrap the clear eastern shoulder to establish a reserve before either eroder reaches the next earned link?',
      lesson:
        'Örnek-informed grouped geometry separates permanent islands with open wall shoulders; earned links can erode while every authored foundation survives.',
      counterplay:
        'Keep the central island available until one eroder commits. The western approach costs speed; the eastern wrap costs exposure but banks a second permanent return.',
      captureConsequence:
        'West-first neutralizes the slow approach for later repairs; east-first shortens the long side and leaves the central island as an emergency reserve.',
      memorableMoment:
        'A reopened link changes the route, but the separated island grouping keeps two legible recovery choices on the board.',
      mastery: 'Join all three islands, repair one eroded link and finish without losing a life.',
      difficulty: {
        band: 6,
        planning: 7,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v33. Only selected wall geometry and design notes
 * change; actors, terrain, foundations, spawns, bonuses, artwork and rules stay exact. */
export function createCulturalPressureTriptychCandidates({ artwork = false } = {}) {
  const before = createCulturalTimedBonusPressureCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-cultural-pressure-triptych-original-review'
    : 'whole-cultural-pressure-triptych-greybox-review';
  project.name = 'Whole Journey · Ukrainian cultural pressure triptych';
  project.revision = CULTURAL_PRESSURE_TRIPTYCH_REVISION;

  for (const selection of CULTURAL_PRESSURE_TRIPTYCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: CULTURAL_PRESSURE_TRIPTYCH_REVISION,
      walls: structuredClone(revision.walls),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: CULTURAL_PRESSURE_TRIPTYCH_REVISION,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = CULTURAL_PRESSURE_TRIPTYCH_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = CULTURAL_PRESSURE_TRIPTYCH_REVISION;
  return structuredClone(project);
}
