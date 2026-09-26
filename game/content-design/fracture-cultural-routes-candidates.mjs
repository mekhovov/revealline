import { freezeDesign } from './catalogs.mjs';
import { createRoverCulturalRoutesCandidates } from './rover-cultural-routes-candidates.mjs';

export const FRACTURE_CULTURAL_ROUTES_REVISION = 'fracture-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const FRACTURE_CULTURAL_ROUTES_SOURCES = freezeDesign({
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
      'An original offset return lattice borrows broad geometric grouping only. No ornament, symbol, narrative meaning, palette, object or source coordinates are copied or turned into a target.',
  },
  borshchivEmbroidery: {
    institution: 'Ivan Honchar Museum',
    record: 'Researchers revealed techniques of Borshchiv embroidery',
    region: 'Borshchiv district, Ternopil region',
    url: 'https://old.honchar.org.ua/p/vidkryly-sekrety-borschivskoji-vyshyvky/',
    observedVocabulary: [
      'multiple embroidery techniques within one regional practice',
      'relief produced with wool thread and later floss',
      'densely decorated sleeve areas with village-specific variation',
    ],
    adaptationBoundary:
      'An original pair of unequal route panels borrows dense-versus-open band contrast only. No shirt, sleeve, stitch, village pattern, palette, legend, meaning or source coordinates are copied.',
  },
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
      'An original diagonal repair network borrows open-panel spacing and varied proportions only. No Krychevsky ornament, panel outline, artwork, tactile claim or source coordinates are copied.',
  },
});

export const FRACTURE_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'first-fracture',
    disposition: 'ornek-offset-repair-lattice',
    sourceIds: ['crimeanTatarOrnek'],
    approaches: ['central-lattice-first', 'east-reserve-first'],
    pressurePoints: ['central-landing', 'eroder-front', 'east-reserve', 'outer-patrol'],
  },
  {
    id: 'two-districts',
    disposition: 'borshchiv-unequal-relief-panels',
    sourceIds: ['borshchivEmbroidery'],
    approaches: ['west-panel-first', 'east-panel-first'],
    pressurePoints: ['west-eroder', 'central-spine', 'east-eroder', 'frontier-crossing'],
  },
  {
    id: 'fracture-remix',
    disposition: 'krychevsky-open-diagonal-repair-network',
    sourceIds: ['krychevskyTactilePanels'],
    approaches: ['central-panel-first', 'outer-panel-first'],
    pressurePoints: ['central-panel', 'hub-roamer', 'outer-panel', 'anchor-crossing'],
  },
]);

const revisions = Object.freeze({
  'first-fracture': {
    actors: [
      {
        id: 'cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 58.5,
        y: 7.5,
        heading: [-1, 0],
      },
      { id: 'keeper', role: 'field-keeper', tier: 'measured', x: 10.5, y: 29.5, heading: [1, -1] },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 27.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(23, 6, 7, 2),
      rect(42, 6, 7, 2),
      rect(18, 13, 8, 2),
      rect(46, 13, 8, 2),
      rect(25, 25, 7, 2),
      rect(40, 25, 7, 2),
    ],
    foundations: [rect(33, 8, 7, 6), rect(34, 14, 5, 11), rect(54, 16, 9, 5), rect(10, 22, 8, 5)],
    terrain: [{ id: 'repair-shadow', kind: 'slow', ...rect(43, 17, 6, 7) }],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Use the short central lattice before its earned approach can erode, or cross the offset openings to bank the detached east reserve first?',
      lesson:
        'An Örnek-informed geometric grouping remains an abstract route lattice: foundations survive erosion, walls block movement and earned connections can reopen.',
      counterplay:
        'Central-first gives several short repair departures but attracts erosion near the busiest return. East-first costs a longer exposed line and preserves a permanent reserve beyond it.',
      captureConsequence:
        'Joining the central lattice creates efficient repairs around the eroder. Banking the east reserve first keeps a second permanent return when the centre reopens.',
      memorableMoment:
        'An offset geometric rhythm makes the shortest landing and the safest long-term reserve visibly different choices.',
      mastery:
        'Bank the east reserve, repair one eroded cell and close again at the central lattice without losing a life.',
      difficulty: {
        band: 6,
        planning: 6,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'two-districts': {
    actors: [
      {
        id: 'west-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 8.5,
        y: 27.5,
        heading: [1, -1],
      },
      {
        id: 'east-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 64.5,
        y: 27.5,
        heading: [-1, -1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 33, y: 10, side: 'east' },
        clockwise: true,
      },
      {
        id: 'west-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 12.5,
        y: 30.5,
        heading: [1, 0],
      },
      {
        id: 'east-keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 60.5,
        y: 5.5,
        heading: [0, 1],
      },
    ],
    walls: [
      rect(10, 7, 5, 2),
      rect(19, 7, 4, 2),
      rect(10, 25, 13, 2),
      rect(10, 9, 2, 7),
      rect(21, 19, 2, 6),
      rect(49, 10, 5, 2),
      rect(57, 10, 5, 2),
      rect(49, 28, 13, 2),
      rect(60, 12, 2, 7),
      rect(49, 22, 2, 6),
    ],
    foundations: [rect(14, 9, 7, 14), rect(34, 1, 4, 34), rect(52, 14, 7, 14), rect(26, 27, 20, 3)],
    terrain: [
      { id: 'west-relief', kind: 'slow', ...rect(25, 12, 5, 10) },
      { id: 'east-relief', kind: 'lethal', ...rect(42, 15, 5, 10) },
    ],
    spawn: { id: 'home', x: 17.5, y: 0.5 },
    design: {
      routeDecision:
        'Establish the shorter west relief panel before its eroder marks the approach, or cross the open upper field to reach the taller east panel first?',
      lesson:
        'Borshchiv-informed dense and open bands become unequal abstract route panels. Each district keeps its own eroder and field anchor; the permanent spine switches pressure, not ownership.',
      counterplay:
        'The west panel is quick but leaves the lethal east approach untouched. The east panel requires a longer opening; enter after the frontier leaves its upper shoulder.',
      captureConsequence:
        'West-first creates a short repair loop into the spine. East-first neutralizes the harsher crossing sooner and preserves a distinct west reserve.',
      memorableMoment:
        'Unequal relief bands make each district demand a different opening instead of mirroring the same capture twice.',
      mastery:
        'Close from both panels, repair in each district and neutralize the east relief without losing a life.',
      difficulty: {
        band: 6,
        planning: 7,
        execution: 5,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  'fracture-remix': {
    actors: [
      {
        id: 'west-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 7.5,
        y: 29.5,
        heading: [1, -1],
      },
      {
        id: 'east-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 64.5,
        y: 7.5,
        heading: [-1, 1],
      },
      {
        id: 'hub-roamer',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 36.5,
        y: 17.5,
        heading: [0, 1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 32, y: 10, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(20, 7, 8, 2),
      rect(44, 7, 8, 2),
      rect(14, 12, 7, 2),
      rect(51, 12, 7, 2),
      rect(22, 26, 8, 2),
      rect(42, 26, 8, 2),
      rect(31, 30, 4, 2),
      rect(37, 30, 4, 2),
    ],
    foundations: [
      rect(33, 8, 7, 5),
      rect(34, 13, 5, 14),
      rect(11, 17, 12, 5),
      rect(49, 17, 12, 5),
      rect(8, 27, 8, 4),
      rect(56, 8, 8, 4),
    ],
    terrain: [{ id: 'diagonal-repair-gap', kind: 'slow', ...rect(43, 15, 5, 10) }],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short central open panel and accept roamer pressure, or take the long upper route to bank the remote outer panel before repairing the hub?',
      lesson:
        'A Krychevsky-informed open-panel composition combines known repair, anchor, frontier and reclaimed-ground threats without adding another rule.',
      counterplay:
        'The central panel shortens anchor routes but gives the roamer a shared network. The outer panel is exposed and remains an independent reserve until deliberately joined.',
      captureConsequence:
        'Central-first makes later repairs efficient while enlarging reclaimed-ground danger. Outer-first banks a remote escape and changes which damaged connection matters most.',
      memorableMoment:
        'Varied open panels make a useful central repair network compete with a safer detached return.',
      mastery:
        'Capture both anchors, connect both outer panels through the hub and repair after the roamer activates without losing a life.',
      difficulty: {
        band: 7,
        planning: 8,
        execution: 6,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v18. Existing identities, policy, catalogues,
 * objectives, bonuses and art stay exact; only the three selected Fractured
 * Grid maps, spawn placement and actor attachment change with their topology. */
export function createFractureCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createRoverCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-fracture-cultural-routes-original-review'
    : 'whole-fracture-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Fractured Grid Ukrainian cultural routes';
  project.revision = FRACTURE_CULTURAL_ROUTES_REVISION;

  for (const selection of FRACTURE_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: FRACTURE_CULTURAL_ROUTES_REVISION,
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
      revision: FRACTURE_CULTURAL_ROUTES_REVISION,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = FRACTURE_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = FRACTURE_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
