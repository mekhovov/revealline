import { freezeDesign } from './catalogs.mjs';
import { createWholeErosionReviewCandidates } from './whole-spatial-candidates.mjs';

export const SPATIAL_NEXT_BATCH_REVISION = 'cultural-spatial-triptych-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const SPATIAL_NEXT_BATCH_SOURCES = freezeDesign({
  lemkoPysanka: {
    institution: 'Ivan Honchar Museum',
    object: 'Pysanka, Lemko Area, 1950–1980',
    registrationNumber: 'НДФ-1497',
    url: 'https://honchar.org.ua/en/collections/detail/1019',
    observedVocabulary: ['geometric and floral ornament', 'sun', 'spikelet'],
    adaptationBoundary:
      'Original game-space rhythm informed by the catalogued vocabulary; no surface design or coordinates are copied.',
  },
  pysankaTradition: {
    institution: 'UNESCO Intangible Cultural Heritage',
    object: 'Pysanka, Ukrainian tradition and art of decorating eggs',
    url: 'https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134',
    adaptationBoundary:
      'Context for the living Ukrainian practice; the mission does not claim to reproduce a pysanka.',
  },
  podilliaWovenRushnyk: {
    institution: 'Ivan Honchar Museum',
    object: 'Woven rushnyk, Podolia, first half of the twentieth century',
    registrationNumber: 'КН-18297',
    url: 'https://honchar.org.ua/en/collections/detail/2708',
    observedVocabulary: ['geometric ornament', 'linen, twill and shaft weaving'],
    adaptationBoundary:
      'Original stepped bands and pockets use only the catalogued geometric and weaving context; no motif is transcribed.',
  },
  podilliaEmbroideredRushnyk: {
    institution: 'Ivan Honchar Museum',
    object: 'Embroidered rushnyk, Podolia, first half of the twentieth century',
    registrationNumber: 'КН-22891',
    url: 'https://honchar.org.ua/en/collections/detail/1786',
    observedVocabulary: ['geometric ornament', 'hand embroidery'],
    adaptationBoundary:
      'Supports regional attribution only; the map is not a copy or interpretation of symbol meanings.',
  },
  petrykivka: {
    institution: 'UNESCO Intangible Cultural Heritage',
    object: 'Petrykivka decorative painting as Ukrainian ornamental folk art',
    url: 'https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893',
    inventoryUrl: 'https://ich.unesco.org/doc/src/18937-EN.pdf',
    observedVocabulary: ['fantastic flowers', 'local flora and fauna', 'branch', 'frieze'],
    adaptationBoundary:
      'Original non-crossing branch routes borrow compositional principles only; they do not copy painted artwork.',
  },
});

export const SPATIAL_NEXT_BATCH_SELECTIONS = freezeDesign([
  {
    id: 'stepping-stones',
    disposition: 'lemko-pysanka-sun-spikelet-route-fork',
    sourceIds: ['lemkoPysanka', 'pysankaTradition'],
    approaches: ['near-spikelet-first', 'sun-landing-first'],
    pressurePoints: ['near-seed', 'sun-landing', 'upper-spikelet', 'lower-spikelet'],
  },
  {
    id: 'return-pocket',
    disposition: 'podillia-geometric-rushnyk-pocket-bands',
    sourceIds: ['podilliaWovenRushnyk', 'podilliaEmbroideredRushnyk'],
    approaches: ['upper-band-first', 'lower-band-first'],
    pressurePoints: ['inner-pocket', 'upper-band-mouth', 'lower-band-mouth', 'freeze-detour'],
  },
  {
    id: 'neutral-ground',
    disposition: 'petrykivka-noncrossing-branch-hazard-route',
    sourceIds: ['petrykivka'],
    approaches: ['slow-bed-first', 'upper-branch-first'],
    pressurePoints: ['central-stem', 'slow-west-bed', 'upper-branch', 'hot-east-bed'],
  },
]);

const revisions = Object.freeze({
  'stepping-stones': {
    foundations: [
      rect(10, 9, 4, 3),
      rect(33, 15, 5, 4),
      rect(50, 7, 3, 3),
      rect(50, 26, 3, 3),
      rect(62, 15, 4, 3),
    ],
    walls: [],
    design: {
      routeDecision:
        'Use the near seed landing to build a short spikelet chain, or bypass it for the broader central sun landing before choosing an upper or lower return?',
      lesson:
        'Five disconnected landings turn the early foundation lesson into a real route fork without adding a new rule.',
      counterplay:
        'Read both keepers from the boundary. The near landing limits exposure; the central landing gives more return directions but needs a longer opening cut.',
      captureConsequence:
        'Connecting one landing leaves the other branch intact, so the next enclosure begins from a materially different angle.',
      memorableMoment:
        'An original sun-and-spikelet spatial rhythm opens into visibly different upper and lower chains.',
      mastery: 'Use both the near-spikelet and central-sun approaches without losing a life.',
    },
  },
  'return-pocket': {
    foundations: [
      rect(25, 10, 18, 3),
      rect(25, 23, 18, 3),
      rect(25, 12, 3, 12),
      rect(39, 15, 4, 2),
      rect(39, 19, 4, 2),
    ],
    walls: [],
    design: {
      routeDecision:
        'Leave the pocket through the upper woven band for a short keeper read, or stage on the lower band before sweeping toward the freeze bonus?',
      lesson:
        'Alternating foundation bands and negative-space mouths redirect travel without introducing a rule ahead of its taught campaign arc.',
      counterplay:
        'Reposition on the safe pocket spine, watch the inside keeper, then commit from the upper or lower mouth; neither route is a single-exit trap.',
      captureConsequence:
        'An upper closure creates a compact return near the inside keeper; a lower closure preserves a longer outside line toward the bonus.',
      memorableMoment:
        'A stepped geometric band becomes two readable pocket mouths with different return value.',
      mastery:
        'Close once from each band mouth and collect the existing freeze bonus without a loss.',
    },
  },
  'neutral-ground': {
    foundations: [
      rect(33, 9, 4, 13),
      rect(25, 17, 8, 3),
      rect(37, 18, 8, 3),
      rect(30, 7, 10, 2),
      rect(30, 22, 10, 2),
    ],
    walls: [],
    design: {
      routeDecision:
        'Cross the western slow bed directly from the side branch, or climb the safe stem and arc above the eastern hot bed for a faster but longer enclosure?',
      lesson:
        'The non-crossing branches supply safe staging while the existing slow and lethal beds retain their exact rules and cells.',
      counterplay:
        'The western line is direct but slow. The upper branch avoids the lethal bed, costs more distance, and exposes a different frontier timing.',
      captureConsequence:
        'The slow-bed closure makes a broad western return; the upper closure creates a narrow eastern departure without neutralizing the hot bed.',
      memorableMoment:
        'A flowing, non-crossing branch route lets the player choose a slow garden bed or an ambitious arc above heat.',
      mastery:
        'Close from both branch approaches without entering the lethal bed or losing a life.',
    },
  },
});

/** Bounded cumulative successor to the current registered whole-Journey route.
 * Its separate profile/session pair prevents accidental cross-edition progress;
 * all historical routes and their prior mission editions remain addressable. */
export function createSpatialNextBatchCandidates({ artwork = false } = {}) {
  const source = createWholeErosionReviewCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-cultural-spatial-triptych-original-review'
    : 'whole-cultural-spatial-triptych-greybox-review';
  project.name = 'Whole Journey · Ukrainian cultural spatial triptych';
  project.revision = SPATIAL_NEXT_BATCH_REVISION;

  for (const selection of SPATIAL_NEXT_BATCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = {
      ...priorMap,
      revision: SPATIAL_NEXT_BATCH_REVISION,
      foundations: structuredClone(revision.foundations),
      walls: structuredClone(revision.walls),
    };
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: SPATIAL_NEXT_BATCH_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        practices: [
          ...new Set([...mission.design.practices, ...(revision.walls.length ? ['walls'] : [])]),
        ],
        combines: [
          ...new Set([...mission.design.combines, ...(revision.walls.length ? ['walls'] : [])]),
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = SPATIAL_NEXT_BATCH_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = SPATIAL_NEXT_BATCH_REVISION;
  // Route hosts compile this complete 91-mission source once. Compiling here
  // and cloning its raw source forced every consumer to perform the same full
  // validation a second time before it could launch or browse the edition.
  return structuredClone(project);
}
