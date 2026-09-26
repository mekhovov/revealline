import { freezeDesign } from './catalogs.mjs';
import { createFractureCulturalRoutesCandidates } from './fracture-cultural-routes-candidates.mjs';

export const PHASEWORKS_CULTURAL_ROUTES_REVISION = 'phaseworks-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const PHASEWORKS_CULTURAL_ROUTES_SOURCES = freezeDesign({
  krolevetsWovenBands: {
    institution: 'Ivan Honchar Museum',
    record: 'Woven rushnyk (towel) from Krolevets',
    region: 'Middle Dnipro region',
    url: 'https://honchar.org.ua/en/collections/detail/1846',
    observedVocabulary: [
      'geometric ornament recorded by the museum',
      'shaft and domestic weaving techniques',
      'a long textile format organized through repeated bands',
    ],
    adaptationBoundary:
      'An original set of alternating route bands borrows long-format rhythm only. No towel, ornament, weave draft, object, palette, meaning or source coordinates are copied.',
  },
  hutsulDiagonalBraid: {
    institution: 'Ivan Honchar Museum',
    record: "Women's embroidered shirt from the Hutsul area",
    region: 'Vyzhenka, Chernivtsi region',
    url: 'https://honchar.org.ua/en/collections/detail/1471',
    observedVocabulary: [
      'geometric ornament recorded by the museum',
      'diagonal cross stitch and Hutsulian braid among several techniques',
      'diamond-producing nabyruvannia listed in the catalogue record',
    ],
    adaptationBoundary:
      'An original pair of stepped return networks borrows diagonal alternation only. No shirt, stitch chart, braid, diamond motif, palette, meaning or source coordinates are copied.',
  },
  kosmachPysankaCompartments: {
    institution: 'Ivan Honchar Museum',
    record: 'Pysanka from the Hutsul area',
    region: 'Kosmach, Ivano-Frankivsk region',
    url: 'https://honchar.org.ua/en/collections/detail/1706',
    observedVocabulary: [
      'wax-resist layering',
      'geometric and floral ornament classifications',
      'multiple small elements organized within one bounded surface',
    ],
    adaptationBoundary:
      'An original compartment-and-dogleg layout borrows layered spatial subdivision only. No egg, ornament element, symbol, palette, wax sequence, meaning or source coordinates are copied.',
  },
});

export const PHASEWORKS_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'return-in-reserve',
    disposition: 'krolevets-alternating-return-bands',
    sourceIds: ['krolevetsWovenBands'],
    approaches: ['near-band-first', 'lower-reserve-first'],
    pressurePoints: ['near-band', 'pursuer-lock', 'lower-reserve', 'outer-patrol'],
  },
  {
    id: 'two-ways-home',
    disposition: 'hutsul-staggered-braid-returns',
    sourceIds: ['hutsulDiagonalBraid'],
    approaches: ['west-braid-first', 'east-braid-first'],
    pressurePoints: ['west-return', 'central-feint', 'east-return', 'frontier-crossing'],
  },
  {
    id: 'dogleg-transfer',
    disposition: 'kosmach-layered-dogleg-compartments',
    sourceIds: ['kosmachPysankaCompartments'],
    approaches: ['central-dogleg-first', 'outer-compartment-first'],
    pressurePoints: ['central-screen', 'upper-pursuer', 'outer-return', 'lower-hazard'],
  },
]);

const revisions = Object.freeze({
  'return-in-reserve': {
    actors: [
      {
        id: 'carrier',
        role: 'trail-pursuer',
        tier: 'measured',
        x: 45.5,
        y: 8.5,
        heading: [-1, 0],
      },
      { id: 'keeper', role: 'field-keeper', tier: 'measured', x: 10.5, y: 28.5, heading: [1, -1] },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 27.5,
        clockwise: true,
      },
      {
        id: 'lower-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 62.5,
        y: 30.5,
        heading: [-1, -1],
      },
    ],
    walls: [
      rect(9, 11, 15, 2),
      rect(48, 10, 5, 2),
      rect(56, 10, 6, 2),
      rect(14, 25, 14, 2),
      rect(45, 22, 7, 2),
      rect(55, 22, 3, 2),
    ],
    foundations: [rect(34, 7, 5, 19), rect(14, 15, 12, 4), rect(49, 26, 10, 4)],
    terrain: [],
    spawn: { id: 'home', x: 36.5, y: 0.5 },
    design: {
      routeDecision:
        'Take the short central band as soon as pursuit commits, or cross the open upper edge and bank the lower reserve before returning through the alternating bands?',
      lesson:
        'A Krolevets-informed band rhythm stays an abstract return network: the pursuer commits visibly, foundations close cuts and walls only screen movement and sensing.',
      counterplay:
        'Near-band-first keeps exposure short but leaves the remote reserve unclaimed. Lower-reserve-first asks for a longer boundary setup and rewards it with a second permanent return.',
      captureConsequence:
        'The near band cancels the first commitment quickly. The lower reserve gives later cuts a different escape endpoint while two keepers continue retaining separate field regions.',
      memorableMoment:
        'Alternating long and short bands turn the same visible pursuit lock into a choice between immediate safety and a stronger future return.',
      mastery:
        'Bank the lower reserve, then close at the near band with an active impact without losing a life.',
      difficulty: {
        band: 7,
        planning: 7,
        execution: 6,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'two-ways-home': {
    actors: [
      {
        id: 'carrier',
        role: 'trail-pursuer',
        tier: 'measured',
        x: 13.5,
        y: 8.5,
        heading: [1, 0],
      },
      { id: 'keeper', role: 'field-keeper', tier: 'measured', x: 61.5, y: 28.5, heading: [-1, 0] },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 30, y: 22, side: 'west' },
        clockwise: true,
      },
    ],
    walls: [
      rect(26, 8, 6, 2),
      rect(40, 8, 6, 2),
      rect(29, 13, 5, 2),
      rect(38, 13, 5, 2),
      rect(31, 26, 4, 2),
      rect(37, 26, 4, 2),
    ],
    foundations: [
      rect(14, 10, 9, 4),
      rect(20, 14, 3, 10),
      rect(20, 21, 10, 4),
      rect(49, 11, 10, 4),
      rect(49, 15, 3, 10),
      rect(42, 22, 10, 4),
    ],
    terrain: [{ id: 'braid-crossing', kind: 'slow', ...rect(33, 16, 6, 8) }],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Commit to the nearer west braid before the frontier reaches its shoulder, or feint through the centre and close at the east braid after the pursuer locks the old heading?',
      lesson:
        'Hutsul diagonal alternation becomes two original stepped return networks. Their offsets create different approach timings without changing pursuit rules.',
      counterplay:
        'West-first offers the shorter exposed drop. East-first uses the central wall rhythm to screen one approach, then turns after the finite lock toward the longer return.',
      captureConsequence:
        'Each braid remains an independent permanent return. Joining one reshapes the moving frontier while preserving the other as a deliberate alternate home.',
      memorableMoment:
        'A committed pursuer crosses the abandoned centre as the craft closes on the opposite stepped braid.',
      mastery:
        'Connect both stepped returns and close at the second one with an active impact without losing a life.',
      difficulty: {
        band: 7,
        planning: 8,
        execution: 6,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  'dogleg-transfer': {
    actors: [
      {
        id: 'upper-carrier',
        role: 'trail-pursuer',
        tier: 'measured',
        x: 47.5,
        y: 6.5,
        heading: [-1, 0],
      },
      {
        id: 'lower-carrier',
        role: 'field-keeper',
        tier: 'measured',
        x: 57.5,
        y: 29.5,
        heading: [-1, 0],
      },
      { id: 'keeper', role: 'field-keeper', tier: 'measured', x: 11.5, y: 29.5, heading: [1, 0] },
    ],
    walls: [
      rect(10, 12, 8, 2),
      rect(15, 18, 7, 2),
      rect(31, 7, 8, 2),
      rect(42, 14, 8, 2),
      rect(48, 25, 9, 2),
      rect(64, 16, 5, 2),
    ],
    foundations: [
      rect(22, 8, 6, 12),
      rect(22, 18, 20, 4),
      rect(39, 20, 4, 9),
      rect(54, 9, 9, 4),
      rect(59, 12, 4, 11),
    ],
    terrain: [
      { id: 'upper-pocket', kind: 'slow', ...rect(44, 3, 10, 3) },
      { id: 'lower-pocket', kind: 'lethal', ...rect(14, 25, 7, 5) },
    ],
    spawn: { id: 'home', x: 24.5, y: 0.5 },
    design: {
      routeDecision:
        'Use the short central dogleg to screen and close the first commitment, or cross the top edge to bank the outer compartment before working back through the lower hazard?',
      lesson:
        'Kosmach pysanka compartmental organization inspires an abstract layered board. Foundations close cuts and block sensing; nearby walls screen but never become return ground.',
      counterplay:
        'Central-first gives a quick genuine return behind a wall baffle. Outer-first is longer but preserves an independent landing beyond the pursuer before the lethal lower pocket matters.',
      captureConsequence:
        'The central dogleg shortens later closure races. The outer compartment creates a second protected approach while both field keepers still decide which chambers remain open.',
      memorableMoment:
        'A wall breaks the pursuer sightline, but the craft must still reach the stepped foundation beyond it to cancel the active impact.',
      mastery:
        'Close at both compartments, neutralize the lower lethal pocket and finish without losing a life.',
      difficulty: {
        band: 7,
        planning: 8,
        execution: 6,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v19. Existing identities, policies, catalogues,
 * objectives, bonuses and art stay exact; only the three selected Phaseworks
 * maps, spawn placement and actor attachment change with their topology. */
export function createPhaseworksCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createFractureCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-phaseworks-cultural-routes-original-review'
    : 'whole-phaseworks-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Phaseworks Ukrainian cultural routes';
  project.revision = PHASEWORKS_CULTURAL_ROUTES_REVISION;

  for (const selection of PHASEWORKS_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: PHASEWORKS_CULTURAL_ROUTES_REVISION,
      walls: structuredClone(revision.walls),
      foundations: structuredClone(revision.foundations),
      terrain: structuredClone(revision.terrain),
      spawns: [structuredClone(revision.spawn)],
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: PHASEWORKS_CULTURAL_ROUTES_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      actors: structuredClone(revision.actors),
      design: {
        ...mission.design,
        ...revision.design,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = PHASEWORKS_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = PHASEWORKS_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
