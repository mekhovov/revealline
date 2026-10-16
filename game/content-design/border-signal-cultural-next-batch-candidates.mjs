import { freezeDesign } from './catalogs.mjs';
import { createBorderCulturalNextBatchCandidates } from './border-cultural-next-batch-candidates.mjs';

export const BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION = 'border-signal-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES = freezeDesign({
  poltavaShirts: {
    institution: 'M. F. Sumtsov Kharkiv Historical Museum',
    record: 'Collection of Poltava women’s embroidered shirts, late 19th–early 20th century',
    region: 'Poltava region',
    url: 'https://museum.kh.ua/academic/publications.html?n=929',
    observedVocabulary: [
      'vertical sleeve bands and staggered field arrangements',
      'branch, oak-leaf and broken-tree motifs recorded by the museum study',
      'combined plant, geometric and geometricized compositions',
    ],
    adaptationBoundary:
      'An original offset stem-and-leaf return network translates only broad arrangement and rhythm; no shirt, chart, motif drawing, palette, village attribution or object coordinates are copied.',
  },
  bukovynaPysanka: {
    institution: 'Ivan Honchar Museum',
    record: 'Pysanka, collection record 1188',
    region: 'Bukovyna',
    url: 'https://honchar.org.ua/en/collections/detail/1188',
    observedVocabulary: [
      'geometric and floral ornament',
      'cross, rhomb, pine, ox’s-eye and wave elements named by the catalogue',
      'wax-resist sections arranged on a compact curved surface',
    ],
    adaptationBoundary:
      'An original asymmetric spine-and-shoulder route translates sectioning and directional contrast only; no egg division, symbol, chart, palette or object coordinates are copied and no universal meaning is assigned.',
  },
  slobozhanshchynaRushnyk: {
    institution: 'Ivan Honchar Museum',
    record: 'Embroidered rushnyk, collection number KN-25720',
    region: 'Slobozhanshchyna, Okhtyrka district, Sumy region',
    url: 'https://honchar.org.ua/collections/detail/2006',
    observedVocabulary: [
      'hand chain-stitch decoration on homespun hemp cloth',
      'plant and zoomorphic ornament recorded by the catalogue',
      'long textile field suited to separated end-weighted masses',
    ],
    adaptationBoundary:
      'An original hooked-return composition translates the long field and chain-like linkage only; no rushnyk image, figure, stitch chart, palette or object coordinates are copied, and animals or people never become targets.',
  },
});

export const BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SELECTIONS = freezeDesign([
  {
    id: 'border-remix',
    disposition: 'poltava-offset-stem-and-leaves',
    sourceIds: ['poltavaShirts'],
    approaches: ['central-stem-first', 'far-leaf-first'],
    pressurePoints: ['west-leaf', 'central-stem', 'east-leaf', 'mixed-patrol-crossing'],
  },
  {
    id: 'dry-spine',
    disposition: 'bukovyna-asymmetric-spine-shoulders',
    sourceIds: ['bukovynaPysanka'],
    approaches: ['upper-shoulder-first', 'lower-shoulder-first'],
    pressurePoints: ['spine-entry', 'upper-shoulder', 'slow-bed-gap', 'lower-shoulder'],
  },
  {
    id: 'wide-approach',
    disposition: 'slobozhanshchyna-hooked-return-chain',
    sourceIds: ['slobozhanshchynaRushnyk'],
    approaches: ['west-hook-first', 'east-hook-first'],
    pressurePoints: ['west-hook', 'slow-field-edge', 'link-return', 'east-hook'],
  },
]);

const revisions = Object.freeze({
  'border-remix': {
    foundations: [rect(16, 11, 8, 4), rect(33, 8, 3, 20), rect(46, 22, 8, 4)],
    design: {
      routeDecision:
        'Secure the central stem before the mixed patrols converge, or use a longer exposed crossing to establish the far offset leaf first?',
      lesson:
        'Offset returns make capture order matter while the known perimeter and moving-frontier patrol rules stay unchanged.',
      counterplay:
        'The central stem offers the shorter recovery. The far leaf is valuable only when both patrol domains are moving away from its crossing.',
      captureConsequence:
        'A stem-first closure creates a flexible middle return; a far-leaf closure creates a stronger outside departure but leaves the centre contested.',
      memorableMoment:
        'A Poltava-embroidery-informed staggered stem and leaves turn the Remix into a deliberate centre-first or far-first choice.',
      mastery:
        'Use both the central-stem and far-leaf approaches without collecting either optional bonus.',
    },
  },
  'dry-spine': {
    foundations: [rect(34, 7, 4, 18), rect(27, 10, 7, 3), rect(38, 22, 4, 3)],
    design: {
      routeDecision:
        'Use the upper shoulder to work around the western slow bed, or descend the spine and establish the lower shoulder beside the eastern bed first?',
      lesson:
        'An asymmetric spine changes which slow-field edge is the practical return without changing terrain physics.',
      counterplay:
        'Stage on the spine until the nearest keeper travels away, then choose the shoulder that avoids crossing the broader occupied slow bed.',
      captureConsequence:
        'The upper shoulder shortens a western enclosure; the lower shoulder creates a safer later departure toward the eastern field.',
      memorableMoment:
        'A Bukovyna-pysanka-informed divided spine creates two unequal shoulders between preserved slow fields.',
      mastery: 'Close once from each shoulder without collecting the optional life.',
    },
  },
  'wide-approach': {
    foundations: [rect(14, 15, 7, 4), rect(24, 7, 3, 8), rect(49, 10, 7, 4)],
    design: {
      routeDecision:
        'Build from the west hook along the slow-field edge, or cross the wider ordinary approach and establish the eastern hook first?',
      lesson:
        'Linked but separated returns reward planning around the slow field while the frontier patrol keeps the changing boundary relevant.',
      counterplay:
        'The small link return supports a cautious western route; the eastern hook is faster only when both keepers leave its open approach.',
      captureConsequence:
        'A west-hook closure creates a short staging return; an east-hook closure shifts the useful frontier toward the far side of the slow field.',
      memorableMoment:
        'A Slobozhanshchyna-rushnyk-informed long field and chain-like linkage create two differently pressured hooks.',
      mastery: 'Use both hooks and the link return without losing a life.',
    },
  },
});

/** Copy-on-write successor to v12. Existing identities, art, actors, terrain,
 * bonuses and rules remain exact; only foundations and route guidance change. */
export function createBorderSignalCulturalNextBatchCandidates({ artwork = false } = {}) {
  const before = createBorderCulturalNextBatchCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-border-signal-cultural-routes-original-review'
    : 'whole-border-signal-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Border and Signal cultural routes';
  project.revision = BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION;

  for (const selection of BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    nextMap.revision = BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION;
    nextMap.foundations = structuredClone(revision.foundations);
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION,
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
    if (owningCampaignIds.has(campaign.id))
      campaign.revision = BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION;
  return structuredClone(project);
}
