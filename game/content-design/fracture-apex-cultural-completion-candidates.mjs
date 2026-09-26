import { freezeDesign } from './catalogs.mjs';
import { createCrosswindCulturalCompletionCandidates } from './crosswind-cultural-completion-candidates.mjs';

export const FRACTURE_APEX_CULTURAL_COMPLETION_REVISION = 'fracture-apex-cultural-routes-2';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const FRACTURE_APEX_CULTURAL_COMPLETION_SOURCES = freezeDesign({
  krychevskyTactilePanels: {
    institution: 'National Museum-Preserve of Ukrainian Pottery in Opishne',
    record: 'Ornaments that can be felt',
    region: 'Opishne, Poltava region',
    url: 'https://opishne-museum.gov.ua/ornamenty-yaki-mozhna-vidchuty/',
    observedVocabulary: [
      'large openwork wooden panels placed beside a staircase',
      'diagonal panels with varied proportions',
      'ornament reinterpreted as an accessible tactile spatial experience',
    ],
    adaptationBoundary:
      'An original crossing jig borrows open-panel spacing, diagonal balance and varied proportions only. No Krychevsky ornament, panel outline, artwork, tactile claim or source coordinates are copied.',
  },
  crimeanTatarOrnek: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Örnek, a Crimean Tatar ornament and knowledge about it',
    region: 'Crimean Tatar communities in Ukraine',
    url: 'https://ich.unesco.org/en/RL/ornek-a-crimean-tatar-ornament-and-knowledge-about-it-01601',
    observedVocabulary: [
      'geometric ornaments used primarily in weaving',
      'small elements joined into a narrative composition',
      'knowledge transmitted through teaching and collective practice',
    ],
    adaptationBoundary:
      'An original five-landing field borrows grouped geometry, joined small elements and open spacing only. No ornament, symbol, narrative meaning, palette, object or source coordinates are copied.',
  },
  threeDiamondTowel: {
    institution: 'Museum Fund of Ukraine',
    record: 'Embroidered towel, collection record 98567',
    region: 'Volyn Regional Museum',
    url: 'https://museum.mincult.gov.ua/collections/rushnik-vishitiy-98567',
    observedVocabulary: [
      'three large rhomboid figures containing smaller rhomboid organization',
      'rhythmic repeated elements along the upper and lower edges',
      'a decorative field concentrated near the two ends',
    ],
    adaptationBoundary:
      'An original relay-broadcast field borrows three-focus, nested-centre and rhythmic-edge organization only. No towel, embroidery, motif, stitch plan, palette, meaning or source coordinates are copied.',
  },
});

export const FRACTURE_APEX_CULTURAL_COMPLETION_SELECTIONS = freezeDesign([
  {
    id: 'bank-the-crossing',
    disposition: 'open-panel-crossing-jig',
    sourceIds: ['krychevskyTactilePanels'],
    approaches: ['centre-jig-first', 'equipment-pad-first'],
    pressurePoints: ['home-rail', 'centre-jig', 'crossing-anchor', 'equipment-pad'],
  },
  {
    id: 'five-anchors',
    disposition: 'grouped-five-landing-field',
    sourceIds: ['crimeanTatarOrnek'],
    approaches: ['central-cross-first', 'west-panel-first'],
    pressurePoints: ['central-cross', 'west-panel', 'east-panel', 'frontier-turn'],
  },
  {
    id: 'final-broadcast',
    disposition: 'three-focus-relay-broadcast',
    sourceIds: ['threeDiamondTowel'],
    approaches: ['upper-link-first', 'lower-link-first'],
    pressurePoints: ['central-pad', 'upper-anchor', 'lower-anchor', 'frontier-turn'],
  },
]);

const revisions = Object.freeze({
  'bank-the-crossing': {
    walls: [
      rect(21, 7, 8, 2),
      rect(43, 7, 8, 2),
      rect(17, 11, 8, 2),
      rect(47, 11, 7, 2),
      rect(18, 23, 10, 2),
      rect(44, 23, 10, 2),
      rect(25, 27, 6, 2),
      rect(41, 27, 6, 2),
    ],
    foundations: [rect(33, 8, 6, 12), rect(28, 14, 16, 4), rect(10, 24, 8, 4), rect(54, 8, 8, 5)],
    terrain: [
      { id: 'west-tool-mat', kind: 'slow', ...rect(23, 16, 5, 7) },
      { id: 'east-tool-mat', kind: 'slow', ...rect(44, 15, 5, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Bank the crossing anchor through the compact central jig, or establish the isolated upper equipment pad before connecting its reclaimed-ground roamer network?',
      lesson:
        'An Opishne museum record informs open-panel spacing and diagonal balance only. Walls block craft and enemies; foundations remain the only authored return surfaces.',
      counterplay:
        'Centre-first shortens the required anchor route but concentrates erosion near the busiest return. Pad-first takes longer and preserves a detached permanent reserve.',
      captureConsequence:
        'The centre makes the anchor a short follow-up and creates several repair departures. The upper pad stays separate until a later connection expands the roamer domain.',
      memorableMoment:
        'A protected anchor path survives through the open-panel jig while a neighbouring unprotected capture can still erode.',
      mastery:
        'Bank the crossing anchor from the central jig before joining the upper equipment pad, without losing a life.',
      difficulty: {
        band: 6,
        planning: 7,
        execution: 6,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
  'five-anchors': {
    actors: [
      {
        id: 'west-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 8.5,
        y: 18.5,
        heading: [1, 0],
      },
      {
        id: 'east-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 63.5,
        y: 18.5,
        heading: [-1, 0],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 33, y: 13, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(21, 6, 8, 2),
      rect(21, 8, 2, 7),
      rect(23, 14, 6, 2),
      rect(43, 6, 8, 2),
      rect(49, 8, 2, 7),
      rect(43, 14, 6, 2),
      rect(21, 20, 6, 2),
      rect(21, 22, 2, 7),
      rect(23, 29, 8, 2),
      rect(45, 20, 6, 2),
      rect(49, 22, 2, 7),
      rect(41, 29, 8, 2),
    ],
    foundations: [
      rect(34, 8, 4, 20),
      rect(29, 16, 14, 4),
      rect(12, 8, 8, 5),
      rect(52, 7, 8, 5),
      rect(12, 24, 8, 5),
      rect(52, 23, 8, 5),
    ],
    terrain: [
      { id: 'west-panel-field', kind: 'slow', ...rect(23, 8, 6, 6) },
      { id: 'east-panel-field', kind: 'slow', ...rect(43, 22, 6, 7) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Bank the western anchor through the upper grouped-panel opening, or secure an eastern landing first and approach its lower anchor from the central cross?',
      lesson:
        'A UNESCO Örnek record informs grouped geometry and joined small elements only. Broken bands are walls, while five permanent landings remain route choices rather than five chores.',
      counterplay:
        'Use the central cross to change side before the frontier arrives. Enter each wall group through its open face and preserve an uncrowded landing for repair.',
      captureConsequence:
        'Anchor order determines which connection survives the two eroders. A corner landing changes the next approach without making every island mandatory.',
      memorableMoment:
        'One banked route remains intact inside a grouped chamber while the opposite unprotected connection visibly reopens.',
      mastery:
        'Capture both anchors from opposite panel openings before reaching three quarters of the earned target, without losing a life.',
      difficulty: {
        band: 7,
        planning: 8,
        execution: 6,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
  'final-broadcast': {
    walls: [
      rect(29, 10, 5, 2),
      rect(38, 10, 5, 2),
      rect(21, 15, 4, 2),
      rect(47, 15, 4, 2),
      rect(21, 19, 4, 2),
      rect(47, 19, 4, 2),
      rect(29, 24, 5, 2),
      rect(38, 24, 5, 2),
    ],
    design: {
      routeDecision:
        'Open the upper protected link through the near focus before erosion overlaps it, or draw pressure across the centre and close at the lower anchor through the opposite wall gap?',
      lesson:
        'A museum towel record informs three-focus and rhythmic-edge organization only. Walls shape approaches while relay connectors, anchors and erosion keep their established rules.',
      counterplay:
        'Keep one anchor return visible and choose a wall gap before departure. Use an opened connector when remote repair would abandon the planned route.',
      captureConsequence:
        'Either anchor protects its cell and opens its authored non-scoring connector. The opposite occupied focus and unprotected earned shortcuts remain active.',
      memorableMoment:
        'The central broadcast pad becomes a choice between two protected links instead of an unrestricted four-way launch.',
      mastery:
        'Open the lower link first, traverse both connectors and clear without losing a life.',
      difficulty: {
        band: 12,
        planning: 12,
        execution: 10,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 11,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v27. Actor identities/roles, objectives, relays,
 * bonuses, art and gameplay policy remain exact; one frontier edge follows its
 * replacement foundation contour. */
export function createFractureApexCulturalCompletionCandidates({ artwork = false } = {}) {
  const before = createCrosswindCulturalCompletionCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-fracture-apex-cultural-completion-original-review'
    : 'whole-fracture-apex-cultural-completion-greybox-review';
  project.name = 'Whole Journey · Fracture and Apex Ukrainian cultural completion';
  project.revision = FRACTURE_APEX_CULTURAL_COMPLETION_REVISION;

  for (const selection of FRACTURE_APEX_CULTURAL_COMPLETION_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: FRACTURE_APEX_CULTURAL_COMPLETION_REVISION,
      walls: structuredClone(revision.walls),
      ...(revision.foundations ? { foundations: structuredClone(revision.foundations) } : {}),
      ...(revision.terrain ? { terrain: structuredClone(revision.terrain) } : {}),
      ...(revision.spawn ? { spawns: [structuredClone(revision.spawn)] } : {}),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: FRACTURE_APEX_CULTURAL_COMPLETION_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      ...(revision.actors ? { actors: structuredClone(revision.actors) } : {}),
      design: {
        ...mission.design,
        ...revision.design,
        practices: [
          ...new Set([
            ...mission.design.practices,
            'walls',
            ...(revision.terrain?.length ? ['slow-field'] : []),
          ]),
        ],
        combines: [
          ...new Set([
            ...mission.design.combines,
            'walls',
            ...(revision.terrain?.length ? ['slow-field'] : []),
          ]),
        ],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id))
      campaign.revision = FRACTURE_APEX_CULTURAL_COMPLETION_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = FRACTURE_APEX_CULTURAL_COMPLETION_REVISION;
  return structuredClone(project);
}
