import { freezeDesign } from './catalogs.mjs';
import { createEarlyCulturalRoutesCandidates } from './early-cultural-routes-candidates.mjs';

export const SIGNAL_CULTURAL_ROUTES_REVISION = 'signal-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const SIGNAL_CULTURAL_ROUTES_SOURCES = freezeDesign({
  reshetylivkaWhitework: {
    institution: 'Regional Centre for the Safeguarding of Intangible Cultural Heritage',
    record: 'White-on-white technique of embroidery of Reshetylivka',
    region: 'Reshetylivka, Poltava region',
    url: 'https://www.unesco-centerbg.org/en/2021/11/22/white-on-white-technique-of-embroidery-of-reshetylivka/',
    observedVocabulary: [
      'openwork and counted-thread construction',
      'merezhka joins that alternate dense and open passages',
      'white-on-white relief made legible through texture and shadow',
    ],
    adaptationBoundary:
      'Two original offset return bars translate openwork spacing and an unequal joining rhythm only. No embroidery chart, garment, motif, meaning, palette or source coordinates are copied.',
  },
  kosivCeramics: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Tradition of Kosiv painted ceramics',
    region: 'Hutsul region of Ukraine',
    url: 'https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456',
    observedVocabulary: [
      'framed fields assembled into rhythmic painted compositions',
      'green, yellow and brown drawing associated with the ceramic tradition',
      'figurative scenes that express Hutsul history, life, folklore and customs',
    ],
    adaptationBoundary:
      'Three original landing panels translate framing and unequal panel rhythm only. No ceramic, scene, person, animal, ornament, palette or source coordinates are copied or used as targets.',
  },
  petrykivkaPainting: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Petrykivka decorative painting as a phenomenon of the Ukrainian ornamental folk art',
    region: 'Petrykivka, Dnipropetrovsk region',
    url: 'https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893',
    observedVocabulary: [
      'branching floral compositions with a strong central stem',
      'distinct leaves and flowers arranged as balanced masses',
      'decorative painting transmitted as a living local practice',
    ],
    adaptationBoundary:
      'An original open stem with offset return branches translates large-scale branching rhythm only. No painting, flower, bird, brushstroke, palette, meaning or source coordinates are copied.',
  },
});

export const SIGNAL_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'soft-crossing',
    disposition: 'reshetylivka-openwork-offset-returns',
    sourceIds: ['reshetylivkaWhitework'],
    approaches: ['slow-band-first', 'clear-edge-first'],
    pressurePoints: ['slow-band', 'upper-return', 'clear-east-edge', 'lower-return'],
  },
  {
    id: 'cool-the-crossing',
    disposition: 'kosiv-framed-three-panel-crossing',
    sourceIds: ['kosivCeramics'],
    approaches: ['near-panel-first', 'far-panel-first'],
    pressurePoints: ['near-panel', 'hot-bed-frame', 'north-shoulder', 'far-panel'],
  },
  {
    id: 'signal-remix',
    disposition: 'petrykivka-open-branch-network',
    sourceIds: ['petrykivkaPainting'],
    approaches: ['upper-branch-first', 'lower-branch-first'],
    pressurePoints: ['west-bud', 'upper-branch', 'central-stem', 'lower-branch', 'east-bud'],
  },
]);

const revisions = Object.freeze({
  'soft-crossing': {
    foundations: [rect(32, 13, 5, 3), rect(39, 20, 4, 3)],
    design: {
      routeDecision:
        'Cross the short slow band into the upper openwork return, or travel around its clear eastern edge before committing to the lower offset return?',
      lesson:
        'Slow ground changes route cost, while two unequal returns make the safer detour useful rather than merely longer.',
      counterplay:
        'Take the upper return only while the eastern keeper is moving away. The clear-edge route avoids the slow band but stays exposed beside the perimeter patrol for longer.',
      captureConsequence:
        'The direct closure neutralizes a short slow strip; the edge-first closure establishes a deeper return that shortens the next eastern enclosure.',
      memorableMoment:
        'A Reshetylivka-whitework-informed open join turns one broad landing into a quick textured crossing and a slower offset return choice.',
      mastery: 'Use both offset returns and neutralize the slow band without a loss.',
    },
  },
  'cool-the-crossing': {
    foundations: [rect(16, 8, 5, 3), rect(32, 7, 5, 2), rect(51, 24, 5, 3)],
    design: {
      routeDecision:
        'Establish the near framed panel before enclosing the lethal bed, or cross the safe northern shoulder and build a longer approach toward the far panel?',
      lesson:
        'Three unequal returns frame the lethal field without turning it into a wall; neutralizing it still requires a valid enemy-seeded enclosure.',
      counterplay:
        'The near panel supports a short cautious cut. The northern shoulder offers a longer setup only after the east keeper and perimeter patrol separate.',
      captureConsequence:
        'Near-panel play leaves the far crossing exposed; far-panel play creates a useful return beyond the lethal bed before it is neutralized.',
      memorableMoment:
        'A Kosiv-ceramics-informed three-panel frame makes the dangerous centre a route-order problem instead of one rectangular detour.',
      mastery: 'Reach the far panel before neutralizing the complete lethal bed.',
    },
  },
  'signal-remix': {
    foundations: [
      rect(15, 9, 4, 6),
      rect(18, 11, 16, 2),
      rect(33, 11, 3, 13),
      rect(35, 22, 19, 2),
      rect(53, 20, 4, 7),
      rect(53, 9, 4, 7),
    ],
    design: {
      routeDecision:
        'Secure the upper branch through slow ground, or descend the central stem and contest the lower branch beside the lethal channel first?',
      lesson:
        'A branched return network combines known terrain and patrol domains without adding a finale-only rule.',
      counterplay:
        'The upper branch is shorter but crosses slow field. The lower branch waits for the frontier patrol to leave the central stem and keeps the freeze detour optional.',
      captureConsequence:
        'Upper-first play calms the western approach; lower-first play establishes the eastern bud and changes the useful frontier before the slow channel is neutralized.',
      memorableMoment:
        'A Petrykivka-informed open stem and two offset branches turn the Remix into a readable network with two different terrain costs.',
      mastery: 'Connect both branches without collecting the optional freeze bonus.',
    },
  },
});

/** Copy-on-write successor to v14. Existing actors, physics, terrain, bonuses,
 * objectives and art remain exact; only foundation geometry and route guidance
 * change for the selected identities. */
export function createSignalCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createEarlyCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-signal-cultural-routes-original-review'
    : 'whole-signal-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Signal Ukrainian cultural routes';
  project.revision = SIGNAL_CULTURAL_ROUTES_REVISION;

  for (const selection of SIGNAL_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    nextMap.revision = SIGNAL_CULTURAL_ROUTES_REVISION;
    nextMap.foundations = structuredClone(revision.foundations);
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: SIGNAL_CULTURAL_ROUTES_REVISION,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = SIGNAL_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = SIGNAL_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
