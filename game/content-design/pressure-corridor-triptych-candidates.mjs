import { freezeDesign } from './catalogs.mjs';
import { createContestedWallTriptychCandidates } from './contested-wall-triptych-candidates.mjs';
import { PHASEWORKS_CULTURAL_ROUTES_SOURCES } from './phaseworks-cultural-routes-candidates.mjs';
import { LIVEWIRE_CULTURAL_ROUTES_SOURCES } from './livewire-cultural-routes-candidates.mjs';
import { RELAY_CULTURAL_COMPLETION_SOURCES } from './relay-cultural-completion-candidates.mjs';

export const PRESSURE_CORRIDOR_TRIPTYCH_REVISION = 'pressure-corridor-triptych-1';

export const PRESSURE_CORRIDOR_TRIPTYCH_SOURCES = freezeDesign({
  hutsulDiagonalBraid: {
    ...PHASEWORKS_CULTURAL_ROUTES_SOURCES.hutsulDiagonalBraid,
    adaptationBoundary:
      'Original staggered wall shoulders extend the established diagonal cadence using offset openings only. No textile, braid, motif, palette, meaning or source coordinates are copied.',
  },
  polissiaWovenCurtain: {
    ...LIVEWIRE_CULTURAL_ROUTES_SOURCES.polissiaWovenCurtain,
    adaptationBoundary:
      'Original cooling-bank brackets extend the established separated-band vocabulary using unequal intervals only. No curtain towel, ornament, band sequence, palette, meaning or source coordinates are copied.',
  },
  rhombusTowel: {
    ...RELAY_CULTURAL_COMPLETION_SOURCES.rhombusTowel,
    adaptationBoundary:
      'Original relay-court shoulders extend the established separated-rhombus organization using open paired quadrants only. No towel, rhombus motif, stitch plan, palette, meaning or source coordinates are copied.',
  },
});

export const PRESSURE_CORRIDOR_TRIPTYCH_SELECTIONS = freezeDesign([
  {
    id: 'pressure-ladder',
    disposition: 'hutsul-staggered-feint-corridors',
    sourceIds: ['hutsulDiagonalBraid'],
    approaches: ['upper-rung-first', 'lower-rung-first'],
    pressurePoints: ['west-shoulder', 'upper-gap', 'lower-gap', 'east-shoulder'],
  },
  {
    id: 'cooling-loop',
    disposition: 'polissia-separated-cooling-banks',
    sourceIds: ['polissiaWovenCurtain'],
    approaches: ['permanent-loop-first', 'cooled-bank-first'],
    pressurePoints: ['northwest-bracket', 'east-bank', 'west-bank', 'southeast-bracket'],
  },
  {
    id: 'relay-remix',
    disposition: 'rhombus-open-relay-court',
    sourceIds: ['rhombusTowel'],
    approaches: ['west-link-first', 'east-link-first'],
    pressurePoints: [
      'upper-west-court',
      'upper-east-court',
      'lower-west-court',
      'lower-east-court',
    ],
  },
]);

const rect = (x, y, w, h) => ({ x, y, w, h });
const revisions = Object.freeze({
  'pressure-ladder': {
    walls: [
      rect(6, 8, 6, 2),
      rect(10, 10, 2, 5),
      rect(25, 9, 5, 2),
      rect(27, 11, 2, 3),
      rect(43, 18, 5, 2),
      rect(43, 20, 2, 4),
      rect(59, 21, 6, 2),
      rect(63, 23, 2, 5),
    ],
    design: {
      routeDecision:
        'Climb the compact upper rungs while turning after each interceptor lock, or descend through the slow lower gap for a longer enclosure that establishes the far landing first?',
      lesson:
        'A Hutsul diagonal-braid record informs staggered cadence only. Walls define feint corridors, while the interceptor still warns, commits once and never retargets mid-route.',
      counterplay:
        'Keep the next opening visible before the warning ends. The upper gaps support short turns; the lower route uses one longer commitment and must account for the frontier patrol on the new contour.',
      captureConsequence:
        'Upper-first creates successive short returns. Lower-first neutralizes the slow approach and provides a far staging point, but leaves the upper transition exposed.',
      memorableMoment:
        'A committed interceptor passes behind one staggered shoulder as the craft closes on the next rung.',
      mastery: 'Use both staggered gaps and close a cut while an impact front remains active.',
      difficulty: {
        band: 8,
        planning: 9,
        execution: 7,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  'cooling-loop': {
    walls: [
      rect(20, 6, 8, 2),
      rect(26, 8, 2, 5),
      rect(55, 7, 7, 2),
      rect(55, 9, 2, 5),
      rect(18, 22, 10, 2),
      rect(28, 24, 2, 6),
      rect(45, 24, 7, 2),
      rect(50, 26, 2, 5),
    ],
    design: {
      routeDecision:
        'Connect the permanent northern and side landings through the separated upper bands, or neutralize a lethal bank through the lower brackets before erosion can reopen its shortcut?',
      lesson:
        'A Polissia woven-curtain record informs separated-band organization only. Walls remain permanent blockers; cooled hazards can still return when earned territory erodes.',
      counterplay:
        'The upper loop resists erosion but crosses the lane warning more often. A bank-first route is shorter after capture, yet its earned return must be repaired or abandoned when marked.',
      captureConsequence:
        'Permanent-loop-first preserves fallback departures. Bank-first neutralizes immediate danger and creates a fast route that remains strategically expendable.',
      memorableMoment:
        'A warned bank reopens while the separated permanent loop remains available on the opposite side of the wall field.',
      mastery:
        'Neutralize both banks, connect every foundation and recover from one erosion event.',
      difficulty: {
        band: 9,
        planning: 10,
        execution: 8,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 7,
        coordination: 0,
      },
    },
  },
  'relay-remix': {
    walls: [
      rect(17, 7, 9, 2),
      rect(24, 9, 2, 5),
      rect(46, 7, 9, 2),
      rect(46, 9, 2, 5),
      rect(17, 23, 9, 2),
      rect(24, 25, 2, 6),
      rect(46, 23, 9, 2),
      rect(53, 25, 2, 6),
    ],
    design: {
      routeDecision:
        'Open the west connector through the compact paired court while the lane is recovering, or cross the wider eastern court before activating the roamer on its new return network?',
      lesson:
        'A museum towel record informs separated-rhombus organization only. The four open courts shape approaches; relay gates still open into permanent, non-scoring connectors.',
      counterplay:
        'West-first offers the shorter closure around the keeper. East-first reaches the quieter field, but the opened connector expands the reclaimed roamer domain immediately.',
      captureConsequence:
        'The first opened side becomes a permanent launch path. The opposite court stays contested by the emitter and must be approached through a different warning window.',
      memorableMoment:
        'A connector opens across the central court as a travelling impact expires at the completed closure.',
      mastery: 'Open both connectors through different court gaps and finish without a life loss.',
      difficulty: {
        band: 10,
        planning: 11,
        execution: 9,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 8,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v36. Only selected wall geometry and design notes
 * change; pressure actors, gates, terrain, foundations and rules stay exact. */
export function createPressureCorridorTriptychCandidates({ artwork = false } = {}) {
  const before = createContestedWallTriptychCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-pressure-corridor-triptych-original-review'
    : 'whole-pressure-corridor-triptych-greybox-review';
  project.name = 'Whole Journey · Ukrainian pressure corridor triptych';
  project.revision = PRESSURE_CORRIDOR_TRIPTYCH_REVISION;

  for (const selection of PRESSURE_CORRIDOR_TRIPTYCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: PRESSURE_CORRIDOR_TRIPTYCH_REVISION,
      walls: structuredClone(revision.walls),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: PRESSURE_CORRIDOR_TRIPTYCH_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        introduces: mission.design.introduces,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = PRESSURE_CORRIDOR_TRIPTYCH_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = PRESSURE_CORRIDOR_TRIPTYCH_REVISION;
  return structuredClone(project);
}
