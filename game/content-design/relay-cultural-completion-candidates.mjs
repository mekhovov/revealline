import { freezeDesign } from './catalogs.mjs';
import { createApexCulturalRoutesCandidates } from './apex-cultural-routes-candidates.mjs';

export const RELAY_CULTURAL_COMPLETION_REVISION = 'relay-cultural-routes-2';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const RELAY_CULTURAL_COMPLETION_SOURCES = freezeDesign({
  polissiaCraneTowel: {
    institution: 'Ivan Honchar Museum',
    record: 'Woven curtain towel, collection number KN-750',
    region: 'Middle Polissia, Zhytomyr region',
    url: 'https://honchar.org.ua/collections/detail/1924',
    observedVocabulary: [
      'separate bands with distinct geometric arrangements',
      'diagonal lines, triangles, crosses and broken lines recorded in the museum description',
      'broad bands containing rhombi and a distant crane-wing impression',
    ],
    adaptationBoundary:
      'An original paired-store route borrows alternating angular-band cadence only. No towel, crane figure, band sequence, palette, meaning or source coordinates are copied.',
  },
  rhombusTowel: {
    institution: 'Museum Fund of Ukraine',
    record: 'Embroidered towel, collection record 94261',
    region: 'Lviv Historical Museum',
    url: 'https://museum.mincult.gov.ua/collections/rushnik-vishitiy-94261',
    observedVocabulary: [
      'a geometric cross-stitch band organized around rhombi and triangles',
      'three separated rhombi containing flower forms',
      'a larger rhomboid figure with branching outer sides',
    ],
    adaptationBoundary:
      'An original nested-return plan borrows separated rhombus-and-triangle organization only. No towel, flower, stitch chart, palette, meaning or source coordinates are copied.',
  },
  hutsulBandKilim: {
    institution: 'Museum Fund of Ukraine',
    record: 'Kilim, collection record 157856',
    region: 'Yampil Museum of Fine Arts',
    url: 'https://museum.mincult.gov.ua/collections/kilim-157856',
    observedVocabulary: [
      'alternating horizontal bands of different widths',
      'rhomboid figures arranged inside the broadest band',
      'elongated rhombi nested inside larger rhomboid figures',
    ],
    adaptationBoundary:
      'An original four-watchpost field borrows alternating band widths and nested-rhombus rhythm only. No kilim, weave, palette, meaning or source coordinates are copied.',
  },
});

export const RELAY_CULTURAL_COMPLETION_SELECTIONS = freezeDesign([
  {
    id: 'spiral-stores',
    disposition: 'polissia-angular-band-store-approaches',
    sourceIds: ['polissiaCraneTowel'],
    approaches: ['west-store-first', 'east-store-first'],
    pressurePoints: [
      'west-inward-gap',
      'central-hot-crossing',
      'east-inward-gap',
      'frontier-spine',
    ],
  },
  {
    id: 'nested-relays',
    disposition: 'separated-rhombus-relay-rings',
    sourceIds: ['rhombusTowel'],
    approaches: ['upper-ring-first', 'lower-ring-first'],
    pressurePoints: ['upper-trigger-gap', 'left-ring-baffle', 'inner-link', 'east-hazard-bank'],
  },
  {
    id: 'watchpost-exchange',
    disposition: 'alternating-band-watchpost-crossing',
    sourceIds: ['hutsulBandKilim'],
    approaches: ['northwest-first', 'northeast-transfer-first'],
    pressurePoints: [
      'northwest-window',
      'north-band-transfer',
      'central-junction',
      'southeast-bank',
    ],
  },
]);

const revisions = Object.freeze({
  'spiral-stores': {
    walls: [
      rect(10, 11, 5, 2),
      rect(22, 13, 2, 5),
      rect(13, 21, 8, 2),
      rect(51, 14, 8, 2),
      rect(51, 16, 2, 5),
      rect(45, 23, 6, 2),
    ],
    terrain: [
      { id: 'west-inward-drag', kind: 'slow', ...rect(10, 15, 4, 4) },
      { id: 'central-hot-crossing', kind: 'lethal', ...rect(29, 15, 3, 5) },
      { id: 'east-inward-drag', kind: 'slow', ...rect(58, 18, 4, 4) },
    ],
    design: {
      routeDecision:
        'Take the short hazardous crossing into the west store, or cross the longer open side and secure the east store before the frontier reaches the central spine?',
      lesson:
        'A Polissia museum towel record informs alternating angular-band cadence only. Broken wall bands block both craft and enemies; the store foundations remain the only return surfaces.',
      counterplay:
        'West-first spends less time exposed but crosses the lethal central strip. East-first avoids that strip, keeps a broad turning lane and delays the shorter upper connector.',
      captureConsequence:
        'Each relay still opens only its authored permanent connector. Neutralizing one inward field changes the safer transfer to the other store without clearing its keeper.',
      memorableMoment:
        'One enclosure turns a cramped angular store into a direct return while the opposite store remains visibly occupied.',
      mastery:
        'Open the east store first, cross the central spine to the west relay and clear without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'nested-relays': {
    walls: [
      rect(19, 9, 7, 2),
      rect(24, 11, 2, 5),
      rect(19, 21, 7, 2),
      rect(47, 9, 6, 2),
      rect(50, 11, 2, 4),
      rect(49, 23, 6, 2),
    ],
    terrain: [
      { id: 'left-ring-drag', kind: 'slow', ...rect(17, 16, 4, 4) },
      { id: 'east-hazard-bank', kind: 'lethal', ...rect(49, 18, 6, 3) },
    ],
    design: {
      routeDecision:
        'Close the short upper ring around its visible trigger, or descend through the lower gap and establish a return before contesting the hazardous east bank?',
      lesson:
        'A museum towel record informs separated rhombus-and-triangle organization only. Nested shapes never imply nested fill: each field component remains retained by its own keeper.',
      counterplay:
        'Upper-first earns the long inner connector early. Lower-first preserves the broad outer opening and lets the player approach the east trigger after neutralizing its lethal bank.',
      captureConsequence:
        'The chosen relay removes one return detour while every unclaimed ring and its keeper remain active. No opened gate performs a second hidden capture.',
      memorableMoment:
        'The visible ring stays occupied when its connector opens, separating route progress from territory ownership.',
      mastery:
        'Secure the lower return first, then open the upper connector and clear without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'watchpost-exchange': {
    walls: [
      rect(16, 4, 8, 2),
      rect(24, 6, 2, 4),
      rect(16, 12, 8, 2),
      rect(42, 5, 7, 2),
      rect(59, 10, 7, 2),
      rect(13, 23, 8, 2),
      rect(20, 25, 2, 5),
      rect(57, 22, 8, 2),
      rect(57, 31, 8, 2),
    ],
    terrain: [
      { id: 'northwest-band', kind: 'slow', ...rect(4, 10, 5, 3) },
      { id: 'northeast-band', kind: 'slow', ...rect(48, 8, 4, 3) },
      { id: 'southwest-hot-band', kind: 'lethal', ...rect(23, 24, 7, 3) },
      { id: 'southeast-band', kind: 'slow', ...rect(42, 27, 5, 3) },
    ],
    design: {
      routeDecision:
        'Drop directly through the northwest watchpost for the near relay, or traverse the exposed top edge and enter through the northeast window before the frontier reaches the hub?',
      lesson:
        'A Hutsul kilim record informs alternating band widths and nested-rhombus rhythm only. The four watchposts remain independent occupied field problems around one relay hub.',
      counterplay:
        'Northwest-first is the shortest closure and exposes the nearby trigger. Northeast-first takes longer but establishes pressure on the far half before the central frontier can contest both junctions.',
      captureConsequence:
        'Each relay still opens one permanent junction. Capturing a band neutralizes only its enclosed hazard and never clears the diagonally opposite watchpost.',
      memorableMoment:
        'The cross-board hub assembles one side at a time while the alternating bands keep the opposite approach visibly dangerous.',
      mastery:
        'Enter from the northeast first, open both junctions and clear without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 7,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v25. Existing identities, policies, catalogues,
 * actors, objectives, relay links, bonuses and artwork remain exact. */
export function createRelayCulturalCompletionCandidates({ artwork = false } = {}) {
  const before = createApexCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-relay-cultural-completion-original-review'
    : 'whole-relay-cultural-completion-greybox-review';
  project.name = 'Whole Journey · Relay Ukrainian cultural completion';
  project.revision = RELAY_CULTURAL_COMPLETION_REVISION;

  for (const selection of RELAY_CULTURAL_COMPLETION_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: RELAY_CULTURAL_COMPLETION_REVISION,
      walls: structuredClone(revision.walls),
      terrain: structuredClone(revision.terrain),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: RELAY_CULTURAL_COMPLETION_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        practices: [...new Set([...mission.design.practices, 'walls', 'terrain'])],
        combines: [...new Set([...mission.design.combines, 'walls', 'terrain'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = RELAY_CULTURAL_COMPLETION_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = RELAY_CULTURAL_COMPLETION_REVISION;
  return structuredClone(project);
}
