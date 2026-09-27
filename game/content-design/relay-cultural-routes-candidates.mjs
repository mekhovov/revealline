import { freezeDesign } from './catalogs.mjs';
import { createLivewireCulturalRoutesCandidates } from './livewire-cultural-routes-candidates.mjs';

export const RELAY_CULTURAL_ROUTES_REVISION = 'relay-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const RELAY_CULTURAL_ROUTES_SOURCES = freezeDesign({
  podilliaWovenTowel: {
    institution: 'Ivan Honchar Museum',
    record: 'Woven towel',
    region: 'Podillia, Mukhivtsi',
    url: 'https://honchar.org.ua/collections/detail/2200',
    observedVocabulary: [
      'geometric ornament recorded by the museum',
      'squares of different sizes organized into schematic quatrefoil groups',
      'terminal red-and-black separating bands recorded in the object description',
    ],
    adaptationBoundary:
      'An original linked-landing plan borrows grouped-square and terminal-band organization only. No towel, quatrefoil, weave draft, palette, meaning or source coordinates are copied.',
  },
  symmetricKilim: {
    institution: 'Museum Fund of Ukraine',
    record: 'Kilim, collection record 62650',
    region: 'National Museum of Decorative Art of Ukraine',
    url: 'https://museum.mincult.gov.ua/collections/kilim-62650',
    observedVocabulary: [
      'a vertically symmetric composition around the centre',
      'alternating smooth and ornamented horizontal bands',
      'curved-down band edges recorded by the catalogue',
    ],
    adaptationBoundary:
      'An original mirrored relay field borrows bilateral balance and alternating-band cadence only. No kilim, plant motif, band sequence, palette, meaning or source coordinates are copied.',
  },
  alternatingBranchKilim: {
    institution: 'Museum Fund of Ukraine',
    record: 'Kilim, collection record 56857',
    region: 'National Museum of Decorative Art of Ukraine',
    url: 'https://museum.mincult.gov.ua/collections/kilim-56857',
    observedVocabulary: [
      'a central field separated from its border',
      'rows whose branch direction alternates',
      'a triple winding border with right-angle turns',
    ],
    adaptationBoundary:
      'An original three-compound route borrows alternating branch direction and right-angle border rhythm only. No kilim, branch, flower, border, palette, meaning or source coordinates are copied.',
  },
});

export const RELAY_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'first-link',
    disposition: 'podillia-grouped-square-landing',
    sourceIds: ['podilliaWovenTowel'],
    approaches: ['relay-first', 'west-band-detour'],
    pressurePoints: ['relay-line', 'upper-landing', 'closed-bridge', 'lower-return'],
  },
  {
    id: 'second-approach',
    disposition: 'symmetric-alternating-relay-banks',
    sourceIds: ['symmetricKilim'],
    approaches: ['near-relay-first', 'far-relay-first'],
    pressurePoints: ['west-trigger', 'outer-transfer', 'east-trigger', 'frontier-landing'],
  },
  {
    id: 'three-compounds',
    disposition: 'alternating-branch-compounds',
    sourceIds: ['alternatingBranchKilim'],
    approaches: ['upper-relay-first', 'east-relay-first'],
    pressurePoints: ['central-store', 'upper-trigger', 'east-trigger', 'roamer-return'],
  },
]);

const revisions = Object.freeze({
  'first-link': {
    walls: [
      rect(18, 7, 8, 2),
      rect(46, 7, 8, 2),
      rect(14, 20, 12, 2),
      rect(46, 20, 12, 2),
      rect(26, 11, 3, 3),
      rect(43, 11, 3, 3),
    ],
    foundations: [rect(31, 14, 10, 4), rect(31, 27, 10, 4), rect(17, 25, 7, 3), rect(48, 25, 7, 3)],
    terrain: [
      { id: 'west-soft', kind: 'slow', ...rect(7, 10, 8, 8) },
      { id: 'east-soft', kind: 'slow', ...rect(57, 10, 8, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Capture the visible relay on the direct central line, or enter through the west band and make a longer side close before committing to the bridge?',
      lesson:
        'A Podillia woven-towel record informs grouped-square and terminal-band organization only. The numbered relay opens the matching connector; surrounding band walls never become return ground.',
      counterplay:
        'Relay-first earns the permanent south bridge quickly. The west detour avoids the central exposure but delays the shortcut and leaves a longer return under perimeter pressure.',
      captureConsequence:
        'The relay opens the non-scoring bridge between the central landings. Side platforms remain separate returns and neither keeper is released by the connection.',
      memorableMoment:
        'The central connector changes from a blocking bar to a bright permanent return while the paired side bands remain contested.',
      mastery:
        'Open the relay after a west-band detour, use the new bridge and clear without losing a life.',
      difficulty: {
        band: 9,
        planning: 8,
        execution: 7,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
  'second-approach': {
    walls: [
      rect(13, 7, 12, 2),
      rect(47, 7, 12, 2),
      rect(17, 25, 10, 2),
      rect(45, 25, 10, 2),
      rect(26, 11, 4, 2),
      rect(40, 1, 3, 13),
    ],
    foundations: [
      rect(3, 14, 6, 7),
      rect(30, 14, 8, 7),
      rect(57, 14, 8, 7),
      rect(13, 29, 9, 3),
      rect(50, 29, 9, 3),
    ],
    terrain: [
      { id: 'upper-west', kind: 'slow', ...rect(10, 3, 10, 3) },
      { id: 'upper-east', kind: 'slow', ...rect(52, 3, 10, 3) },
      { id: 'lower-centre', kind: 'lethal', ...rect(31, 27, 10, 5) },
    ],
    spawn: { id: 'home', x: 5.5, y: 17.5 },
    design: {
      routeDecision:
        'Open the near west connector from its short landing, or escape to the perimeter and approach the far east relay from above before the frontier reaches that return?',
      lesson:
        'A museum kilim record informs bilateral balance and alternating-band cadence only. Each mirrored trigger owns one connector; visual symmetry never implies shared activation.',
      counterplay:
        'Near-first produces a central launch quickly. Far-first uses the longer outer transfer to gain the east bridge before the changing frontier can contest its landing.',
      captureConsequence:
        'Each relay permanently joins one neighbouring landing. Opening one half changes the next approach but cannot open, clear or score the mirrored half.',
      memorableMoment:
        'The board remains visually balanced while only the chosen half lights and becomes traversable.',
      mastery:
        'Open the far east connector first, then use both bridges and clear without losing a life.',
      difficulty: {
        band: 9,
        planning: 9,
        execution: 7,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
  'three-compounds': {
    walls: [
      rect(16, 7, 9, 2),
      rect(22, 9, 3, 5),
      rect(50, 22, 3, 5),
      rect(47, 27, 9, 2),
      rect(27, 4, 3, 6),
      rect(42, 26, 3, 6),
    ],
    foundations: [
      rect(32, 14, 8, 7),
      rect(7, 13, 8, 9),
      rect(56, 13, 8, 9),
      rect(32, 3, 8, 4),
      rect(19, 27, 8, 3),
      rect(45, 30, 8, 3),
    ],
    terrain: [
      { id: 'west-court', kind: 'slow', ...rect(16, 22, 8, 5) },
      { id: 'east-court', kind: 'lethal', ...rect(53, 22, 3, 5) },
    ],
    spawn: { id: 'home', x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        'Open the short upper relay to gain a direct north return, or branch east through the longer exposed approach and secure the roamer-side connector first?',
      lesson:
        'A museum kilim record informs alternating branch direction and right-angle border rhythm only. Relay order changes the return network while every field keeper stays in its own domain.',
      counterplay:
        'Upper-first creates the safest repeated departure. East-first spends more exposure to neutralize a hazardous court and secure a return before the roamer activates on reclaimed ground.',
      captureConsequence:
        'The selected branch becomes permanent return ground. The other compound remains independently enemy-retained, and an awakened roamer may use every opened connector.',
      memorableMoment:
        'A newly opened branch is simultaneously a valuable shortcut and a future roamer route.',
      mastery:
        'Open the east branch first, preserve an escape corridor and clear after visiting all three compounds without losing a life.',
      difficulty: {
        band: 9,
        planning: 9,
        execution: 8,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 8,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v21. Existing identities, policies, catalogues,
 * actors, relay links, objectives, bonuses and art remain exact. */
export function createRelayCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createLivewireCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-relay-cultural-routes-original-review'
    : 'whole-relay-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Relay Ukrainian cultural routes';
  project.revision = RELAY_CULTURAL_ROUTES_REVISION;

  for (const selection of RELAY_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: RELAY_CULTURAL_ROUTES_REVISION,
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
      revision: RELAY_CULTURAL_ROUTES_REVISION,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = RELAY_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = RELAY_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
