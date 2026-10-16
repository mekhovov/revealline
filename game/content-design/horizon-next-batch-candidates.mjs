import { freezeDesign } from './catalogs.mjs';
import { createSpatialNextBatchCandidates } from './spatial-next-batch-candidates.mjs';

export const HORIZON_NEXT_BATCH_REVISION = 'horizon-cultural-joins-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const HORIZON_NEXT_BATCH_SOURCES = freezeDesign({
  vyzhenkaJoiningShirt: {
    institution: 'Ivan Honchar Museum',
    object: 'Women’s shirt, Vyzhenka, Vyzhnytsia district, early twentieth century',
    registrationNumber: 'КН-26139',
    region: 'Hutsul ethnographic region',
    url: 'https://honchar.org.ua/to-learn/sorochka-zhinocha-chernivetska-oblast-poch-hh-st-i134',
    observedConstruction: [
      'shoulder inserts joined vertically to the body',
      'Hutsul braid masking a joining seam',
      'double-prutyk seam along joined panels',
    ],
    adaptationBoundary:
      'Original broken joining routes translate construction scale and alternation only; no embroidery chart, garment outline or stitch pattern is copied.',
  },
  verkhovynaShoulderShirt: {
    institution: 'Ivan Honchar Museum',
    object: 'Women’s shirt, Verkhovyna district, early twentieth century',
    registrationNumber: 'КН-444',
    region: 'Hutsul ethnographic region',
    url: 'https://honchar.org.ua/to-learn/sorochka-zhinocha-chernivetska-oblast-poch-hh-st-1-i139',
    observedConstruction: [
      'shoulder inserts joined vertically to the body',
      'embroidered detail applied over the shoulder-to-sleeve join',
      'gathered collar and cuffs',
    ],
    adaptationBoundary:
      'Original offset shoulder groups and joining axes translate garment construction only; no embroidery chart, garment outline or stitch pattern is copied.',
  },
  lemkoFloralPysanka: {
    institution: 'Ivan Honchar Museum',
    object: 'Pysanka, Lemko Area, 1950–1980',
    registrationNumber: 'НДФ-3636',
    region: 'Lemko Area',
    url: 'https://honchar.org.ua/en/collections/detail/1514',
    observedVocabulary: ['floral ornament', 'spiral', 'flower', 'petal', 'dots'],
    adaptationBoundary:
      'An original open five-landing rhythm uses the catalogued vocabulary as compositional context; no egg division, surface artwork or coordinates are copied.',
  },
});

export const HORIZON_NEXT_BATCH_SELECTIONS = freezeDesign([
  {
    id: 'island-outpost',
    disposition: 'vyzhenka-hutsul-broken-joining-seam',
    sourceIds: ['vyzhenkaJoiningShirt'],
    approaches: ['west-join-first', 'east-double-prutyk-first'],
    pressurePoints: ['home-panel', 'west-short-join', 'upper-stitch', 'lower-stitch'],
  },
  {
    id: 'long-way-home',
    disposition: 'verkhovyna-hutsul-shoulder-gathered-join',
    sourceIds: ['verkhovynaShoulderShirt'],
    approaches: ['upper-shoulder-first', 'lower-gather-first'],
    pressurePoints: ['west-shoulder', 'upper-join', 'lower-gather', 'east-shoulder'],
  },
  {
    id: 'horizon-remix',
    disposition: 'lemko-pysanka-spiral-flower-rhythm',
    sourceIds: ['lemkoFloralPysanka'],
    approaches: ['spiral-shoulder-first', 'outer-petal-first'],
    pressurePoints: ['central-spiral', 'upper-petal', 'east-petal', 'lower-petal', 'west-dot'],
  },
]);

const revisions = Object.freeze({
  'island-outpost': {
    foundations: [rect(17, 15, 4, 4), rect(28, 11, 2, 2), rect(30, 22, 2, 2)],
    design: {
      routeDecision:
        'Close the short western join from the home panel, or make the longer bent return to the offset eastern stitches before choosing the next enclosure?',
      lesson:
        'A broad home panel and two broken joining points create different return distances without adding a rule beyond foundations and keeper reads.',
      counterplay:
        'Read the western keeper before the short closure. For the eastern join, leave from the upper edge and turn only after the keeper is moving away from the bent trail.',
      captureConsequence:
        'The west closure keeps a compact home return; the eastern stitch creates a smaller but more central departure for the following enclosure.',
      memorableMoment:
        'A Vyzhenka-informed broken joining rhythm turns one outpost into a short seam and an offset double return.',
      mastery: 'Complete both the short western join and the bent eastern join without a loss.',
    },
  },
  'long-way-home': {
    foundations: [rect(10, 14, 4, 7), rect(27, 12, 11, 3), rect(34, 25, 11, 3), rect(57, 14, 4, 7)],
    design: {
      routeDecision:
        'Join through the upper shoulder group for the shorter first return, or descend to the offset gathered group for a longer line that approaches the far shoulder?',
      lesson:
        'Offset paired groups around a strong side-to-side joining axis make route planning visible while retaining only known foundation rules.',
      counterplay:
        'Use the west shoulder as safe staging, then commit above or below only when the corresponding keeper is travelling away from the intended line.',
      captureConsequence:
        'The upper join leaves a broad lower region; the lower gathered join leaves a different upper region and a closer angle to the east shoulder.',
      memorableMoment:
        'A Verkhovyna-informed shoulder construction resolves into two offset joining groups rather than a symmetric cross.',
      mastery: 'Reach both offset joins from the west shoulder without losing a life.',
    },
  },
  'horizon-remix': {
    foundations: [
      rect(32, 14, 7, 7),
      rect(37, 5, 9, 3),
      rect(55, 14, 4, 6),
      rect(27, 27, 8, 3),
      rect(12, 16, 3, 4),
    ],
    design: {
      routeDecision:
        'Secure the upper petal from the central spiral shoulder, or connect the western dot first and build an outside return before separating the three keepers?',
      lesson:
        'Five familiar landings form an open spiral, petal and dot rhythm; the finale adds no mandatory mechanic.',
      counterplay:
        'Stage on the central landing for the upper petal, or watch the west keeper before committing to the dot. Each route preserves another safe return if the next read changes.',
      captureConsequence:
        'The upper-petal closure leaves the western field broad; the dot-first closure shifts the surviving keeper regions toward the outer petal chain.',
      memorableMoment:
        'A Lemko-pysanka-informed floral rhythm opens into a central spiral shoulder and four deliberately uneven outer landings.',
      mastery: 'Complete both the central-petal and dot-first approaches without losing a life.',
    },
  },
});

/** Exact three-mission successor to the registered v10 route. The separate
 * v11 route/profile owns progression; v10 remains the immutable launch owner
 * for the three previous-edition cards. */
export function createHorizonNextBatchCandidates({ artwork = false } = {}) {
  const before = createSpatialNextBatchCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-horizon-cultural-joins-original-review'
    : 'whole-horizon-cultural-joins-greybox-review';
  project.name = 'Whole Journey · Horizon cultural joins';
  project.revision = HORIZON_NEXT_BATCH_REVISION;

  for (const selection of HORIZON_NEXT_BATCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = {
      ...priorMap,
      revision: HORIZON_NEXT_BATCH_REVISION,
      foundations: structuredClone(revision.foundations),
      walls: [],
      terrain: [],
    };
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: HORIZON_NEXT_BATCH_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: { ...mission.design, ...revision.design },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = HORIZON_NEXT_BATCH_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = HORIZON_NEXT_BATCH_REVISION;
  return structuredClone(project);
}
