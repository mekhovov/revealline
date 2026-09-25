import { freezeDesign } from './catalogs.mjs';
import { createHorizonNextBatchCandidates } from './horizon-next-batch-candidates.mjs';

export const BORDER_CULTURAL_NEXT_BATCH_REVISION = 'border-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const BORDER_CULTURAL_NEXT_BATCH_SOURCES = freezeDesign({
  reshetylivkaWhiteOnWhite: {
    institution:
      'Regional Centre for the Safeguarding of Intangible Cultural Heritage in South-Eastern Europe under the auspices of UNESCO',
    element: '“White on White” Technique of Embroidery of Reshetylivka',
    register: 'National Register of the Intangible Cultural Heritage of Ukraine',
    region: 'Reshetylivka, Poltava region',
    url: 'https://www.unesco-centerbg.org/en/2021/11/22/white-on-white-technique-of-embroidery-of-reshetylivka/',
    observedVocabulary: [
      'geometric and floral merezhka hemstitch compositions',
      'cutwork arranged as one, three, five or more square openings',
      'light-and-dark relief produced by white-on-white stitching',
    ],
    adaptationBoundary:
      'An original high-contrast aperture and ladder-band route translates openings and rhythm only; no embroidery chart, stitch pattern, palette or object coordinates are copied.',
  },
  petrykivkaPainting: {
    institution: 'UNESCO Intangible Cultural Heritage',
    element: 'Petrykivka decorative painting as a phenomenon of the Ukrainian ornamental folk art',
    nominationNumber: '00893',
    region: 'Petrykivka, Dnipropetrovsk region',
    url: 'https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893',
    inventoryUrl: 'https://ich.unesco.org/doc/src/18937-EN.pdf',
    observedVocabulary: [
      'fantastic flowers and natural elements derived from local flora and fauna',
      'branch and frieze compositions recorded in the Ukrainian inventory',
      'stems and branches composed without crossing one another',
    ],
    adaptationBoundary:
      'An original rectilinear stem and separated branch route translates large-scale flow only; no painting, flower, symbol, palette or object coordinates are copied.',
  },
  kosivPaintedCeramics: {
    institution: 'UNESCO Intangible Cultural Heritage',
    element: 'Tradition of Kosiv painted ceramics',
    nominationNumber: '01456',
    region: 'Kosiv and the Hutsul community',
    url: 'https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456',
    observedVocabulary: [
      'graphical contour scratched into white slip on local grey clay',
      'painted dishes, ceremonial items, toys and tiles',
      'figurative ornament grounded in Hutsul history, life, folklore, flora and fauna',
    ],
    adaptationBoundary:
      'An original bilateral open-frame route translates ceramic contour and panel rhythm only; no pottery artwork, figure, symbol, palette or object coordinates are copied, and people or animals never become targets.',
  },
});

export const BORDER_CULTURAL_NEXT_BATCH_SELECTIONS = freezeDesign([
  {
    id: 'second-landing',
    disposition: 'reshetylivka-white-on-white-aperture-bands',
    sourceIds: ['reshetylivkaWhiteOnWhite'],
    approaches: ['near-aperture-first', 'far-window-first'],
    pressurePoints: ['home-descent', 'near-aperture', 'open-side', 'far-window'],
  },
  {
    id: 'long-rail',
    disposition: 'petrykivka-stem-separated-branches',
    sourceIds: ['petrykivkaPainting'],
    approaches: ['central-stem-first', 'outer-branch-first'],
    pressurePoints: ['stem-entry', 'west-branch', 'east-branch', 'bonus-detour'],
  },
  {
    id: 'new-frontier',
    disposition: 'kosiv-ceramic-bilateral-open-frame',
    sourceIds: ['kosivPaintedCeramics'],
    approaches: ['near-shoulder-first', 'far-shoulder-first'],
    pressurePoints: ['top-frame', 'near-shoulder', 'open-centre', 'far-shoulder'],
  },
]);

const revisions = Object.freeze({
  'second-landing': {
    foundations: [rect(18, 11, 11, 3), rect(18, 14, 3, 6), rect(18, 20, 11, 3), rect(50, 24, 5, 3)],
    design: {
      routeDecision:
        'Close the short near aperture after the perimeter patrol passes, or leave its open side and make the longer outside wrap to the offset far window?',
      lesson:
        'An open square and separated landing change return distance while keeping the known foundation, keeper and perimeter-patrol rules.',
      counterplay:
        'Use the near bands to wait out the patrol, or start the far wrap only when the east keeper and outer patrol are moving away from its return line.',
      captureConsequence:
        'The near-aperture closure creates a compact home return; the far-window closure creates an offset departure that shortens a later outside crossing.',
      memorableMoment:
        'A Reshetylivka-informed aperture and merezhka rhythm turns the second landing into a short closure or a deliberate long wrap.',
      mastery: 'Complete both the near-aperture and far-window approaches without a loss.',
    },
  },
  'long-rail': {
    foundations: [rect(34, 10, 4, 15), rect(24, 12, 9, 3), rect(40, 21, 9, 3)],
    design: {
      routeDecision:
        'Use the central stem for a short ordinary closure, or commit to a separated outer branch that improves the later return toward an optional bonus window?',
      lesson:
        'A stem and two offset branches create route value without changing movement, patrol speed or the optional nature of bonuses.',
      counterplay:
        'Stage on the central stem, then take a branch only while its keeper is travelling away; the direct stem route never requires a pickup.',
      captureConsequence:
        'The central closure preserves two broad fields; an outer-branch closure creates a farther return that shortens the next exposed crossing.',
      memorableMoment:
        'A Petrykivka-informed branch and frieze flow turns the long rail into a safe stem and an ambitious offset branch.',
      mastery: 'Complete both the central-stem and outer-branch approaches without a loss.',
    },
  },
  'new-frontier': {
    foundations: [rect(28, 12, 3, 12), rect(31, 12, 8, 3), rect(39, 12, 3, 12)],
    design: {
      routeDecision:
        'Close the short near shoulder for a modest contour change, or cross the open centre and close the far shoulder first for a larger frontier reroute?',
      lesson:
        'Two shoulders make the moving frontier consequence visible: a closure changes the boundary it follows, not its collision rule.',
      counterplay:
        'Read the patrol on the near shoulder before leaving the top frame. The far shoulder remains reachable through the open centre with a separate return.',
      captureConsequence:
        'The near closure keeps the patrol close to the original frame; the far closure shifts its surviving route to the opposite shoulder.',
      memorableMoment:
        'A Kosiv-ceramic-informed open frame makes the frontier visibly choose between two unequal shoulders.',
      mastery: 'Create new frontiers from both shoulders without losing a life.',
    },
  },
});

/** Exact three-mission successor to the registered v11 route. The separate
 * v12 route/profile owns progression; v11 remains the immutable launch owner
 * for the three previous-edition cards. */
export function createBorderCulturalNextBatchCandidates({ artwork = false } = {}) {
  const before = createHorizonNextBatchCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-border-cultural-routes-original-review'
    : 'whole-border-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Border cultural routes';
  project.revision = BORDER_CULTURAL_NEXT_BATCH_REVISION;

  for (const selection of BORDER_CULTURAL_NEXT_BATCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = {
      ...priorMap,
      revision: BORDER_CULTURAL_NEXT_BATCH_REVISION,
      foundations: structuredClone(revision.foundations),
      walls: [],
      terrain: [],
    };
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: BORDER_CULTURAL_NEXT_BATCH_REVISION,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = BORDER_CULTURAL_NEXT_BATCH_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = BORDER_CULTURAL_NEXT_BATCH_REVISION;
  return structuredClone(project);
}
