import { freezeDesign } from './catalogs.mjs';
import { createPhaseworksCulturalRoutesCandidates } from './phaseworks-cultural-routes-candidates.mjs';

export const LIVEWIRE_CULTURAL_ROUTES_REVISION = 'livewire-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const LIVEWIRE_CULTURAL_ROUTES_SOURCES = freezeDesign({
  kyivWovenBelt: {
    institution: 'Ivan Honchar Museum',
    record: "Men's woven belt",
    region: 'Middle Dnipro region, Kyiv area',
    url: 'https://honchar.org.ua/collections/detail/2593',
    observedVocabulary: [
      'a long narrow domestic-woven format',
      'geometric ornament recorded by the museum',
      'twill and slit tapestry weaving techniques',
    ],
    adaptationBoundary:
      'An original pair of long lock corridors borrows narrow-format rhythm only. No belt, ornament, weave draft, palette, meaning or source coordinates are copied.',
  },
  polissiaWovenCurtain: {
    institution: 'Ivan Honchar Museum',
    record: 'Woven curtain towel',
    region: 'Middle Polissia',
    url: 'https://honchar.org.ua/collections/detail/1984',
    observedVocabulary: [
      'geometric ornament recorded by the museum',
      'plain, tapestry and domestic weaving techniques',
      'a long surface organized through separated woven bands',
    ],
    adaptationBoundary:
      'An original staggered switchyard borrows separated-band organization only. No towel, ornament, band sequence, palette, meaning or source coordinates are copied.',
  },
  poltavaBeadedGerdan: {
    institution: 'Museum Fund of Ukraine',
    record: 'Beaded gerdan necklace',
    region: 'Poltava museum collection',
    url: 'https://museum.mincult.gov.ua/collections/250333',
    observedVocabulary: [
      'a narrow woven-bead construction',
      'a repeated geometric composition described by the catalogue',
      'paired angled units separated by small internal accents',
    ],
    adaptationBoundary:
      'An original split-junction layout borrows paired branching cadence only. No necklace, half-diamond, flower-cross, bead pattern, palette, meaning or source coordinates are copied.',
  },
});

export const LIVEWIRE_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'read-the-lock',
    disposition: 'kyiv-belt-lock-corridors',
    sourceIds: ['kyivWovenBelt'],
    approaches: ['central-lock-first', 'central-chain-to-lower'],
    pressurePoints: ['first-warning', 'central-landing', 'lower-crossing', 'perimeter-return'],
  },
  {
    id: 'switchyard',
    disposition: 'polissia-staggered-band-switchyard',
    sourceIds: ['polissiaWovenCurtain'],
    approaches: ['west-band-first', 'east-hot-band-first'],
    pressurePoints: ['west-step', 'row-lock', 'east-pocket', 'frontier-turn'],
  },
  {
    id: 'split-junction',
    disposition: 'poltava-branching-junction',
    sourceIds: ['poltavaBeadedGerdan'],
    approaches: ['west-branch-first', 'east-branch-first'],
    pressurePoints: ['west-hook', 'column-lock', 'east-float', 'corner-hazard'],
  },
]);

const revisions = Object.freeze({
  'read-the-lock': {
    walls: [
      rect(10, 8, 17, 2),
      rect(45, 8, 17, 2),
      rect(16, 16, 12, 2),
      rect(44, 16, 12, 2),
      rect(9, 24, 15, 2),
      rect(48, 24, 15, 2),
    ],
    foundations: [rect(31, 13, 10, 4), rect(30, 28, 12, 3)],
    terrain: [],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Close at the compact central landing during the first row warning, or chain that safe close directly into the lower corridor for a stronger second departure?',
      lesson:
        'A Kyiv-area woven-belt record informs only the long narrow cadence. The row lock remains telegraphed, foundations close cuts and band walls never become return ground.',
      counterplay:
        'Central-first keeps the initial exposure short. Chaining to the lower corridor deliberately spends a second warning window to establish a stronger later return.',
      captureConsequence:
        'The central landing creates a short repeatable crossing. The lower landing changes the next launch angle while the emitter and keeper continue retaining occupied field.',
      memorableMoment:
        'The warning row illuminates across three separated bands while the craft chooses the close central landing or the longer lower corridor.',
      mastery:
        'Bank the lower landing, then close at the central landing during an active row warning without losing a life.',
      difficulty: {
        band: 8,
        planning: 8,
        execution: 7,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  switchyard: {
    walls: [
      rect(7, 12, 10, 2),
      rect(22, 14, 2, 9),
      rect(24, 24, 14, 2),
      rect(51, 10, 13, 2),
      rect(48, 12, 2, 8),
      rect(35, 8, 13, 2),
    ],
    foundations: [
      rect(30, 16, 12, 3),
      rect(7, 7, 14, 3),
      rect(18, 9, 3, 11),
      rect(51, 20, 3, 10),
      rect(51, 27, 14, 3),
    ],
    terrain: [
      { id: 'west-slow', kind: 'slow', ...rect(9, 22, 9, 5) },
      { id: 'east-hot', kind: 'lethal', ...rect(55, 5, 7, 5) },
    ],
    spawn: { id: 'home', x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        'Join the shorter west stepped band before the frontier turns, or cross the row lock and neutralize the east hot pocket while establishing its longer return?',
      lesson:
        'A Polissia woven-curtain record informs only separated-band organization. Staggered foundations are returns; adjacent woven-band walls are obstructions, not substitutes.',
      counterplay:
        'West-first offers the shorter enclosure through slow ground. East-first waits out the locked row, neutralizes the lethal pocket and earns a wider later approach.',
      captureConsequence:
        'Each stepped network changes the useful departure edge without automatically claiming the other enemy-held side. Neutralized terrain becomes a real route choice.',
      memorableMoment:
        'A completed stepped band remains usable as the row attack passes through the still-open centre.',
      mastery:
        'Connect both stepped bands, neutralize the east pocket and clear without losing a life.',
      difficulty: {
        band: 8,
        planning: 9,
        execution: 7,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
  'split-junction': {
    walls: [
      rect(8, 8, 8, 2),
      rect(14, 10, 8, 2),
      rect(20, 12, 8, 2),
      rect(40, 22, 8, 2),
      rect(53, 24, 5, 2),
      rect(65, 31, 4, 2),
    ],
    foundations: [
      rect(9, 14, 14, 3),
      rect(20, 16, 3, 9),
      rect(49, 19, 3, 10),
      rect(49, 26, 14, 3),
      rect(33, 14, 6, 7),
    ],
    terrain: [
      { id: 'northwest', kind: 'slow', ...rect(7, 3, 11, 4) },
      { id: 'southeast', kind: 'slow', ...rect(55, 30, 10, 3) },
      { id: 'northeast', kind: 'lethal', ...rect(54, 5, 8, 5) },
      { id: 'southwest', kind: 'lethal', ...rect(10, 26, 8, 5) },
    ],
    spawn: { id: 'home', x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        'Connect the west hooked branch before the column lock reaches it, or establish the longer east branch and attack a dangerous corner from its floating end?',
      lesson:
        'A museum gerdan record informs only paired branching cadence. The two branches stay independent return networks and their wall accents remain blocking geometry.',
      counterplay:
        'West-first gives a short hook around the slow approach. East-first crosses during a rest window, then uses the floating end to enclose a lethal corner from outside.',
      captureConsequence:
        'Connecting one branch changes the frontier route and launch angle without granting the opposite quadrant. Corner neutralization remains a deliberate follow-up.',
      memorableMoment:
        'The locked column divides the paired branches, forcing a visible choice between a short west hook and the more valuable east approach.',
      mastery:
        'Connect both branches, neutralize both lethal corners and clear without losing a life.',
      difficulty: {
        band: 9,
        planning: 9,
        execution: 7,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v20. Existing identities, policies, catalogues,
 * objectives, bonuses and art stay exact; only the three selected Livewire
 * maps, spawn placement and design evidence change. */
export function createLivewireCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createPhaseworksCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-livewire-cultural-routes-original-review'
    : 'whole-livewire-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Livewire Ukrainian cultural routes';
  project.revision = LIVEWIRE_CULTURAL_ROUTES_REVISION;

  for (const selection of LIVEWIRE_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: LIVEWIRE_CULTURAL_ROUTES_REVISION,
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
      revision: LIVEWIRE_CULTURAL_ROUTES_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = LIVEWIRE_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = LIVEWIRE_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
