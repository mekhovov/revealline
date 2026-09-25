import { freezeDesign } from './catalogs.mjs';
import { createWholeErosionReviewCandidates } from './whole-spatial-candidates.mjs';

const DRAFT_REVISION = 'spatial-next-draft-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const SPATIAL_NEXT_BATCH_SELECTIONS = freezeDesign([
  {
    id: 'stepping-stones',
    disposition: 'early-foundation-route-fork',
    visualStudy: 'existing-horizon-foundations',
  },
  {
    id: 'four-quarters',
    disposition: 'original-stepped-woven-band-study',
    visualStudy: 'ukrainian-geometric-craft-informed-no-copied-pattern',
  },
  {
    id: 'survey-markers',
    disposition: 'offset-flight-controller-trace-study',
    visualStudy: 'fpv-workbench-informed-no-copied-component-layout',
  },
]);

const revisions = Object.freeze({
  'stepping-stones': {
    foundations: [rect(9, 8, 7, 5), rect(27, 7, 8, 4), rect(29, 23, 8, 4), rect(53, 10, 7, 5)],
    walls: [],
    routeDecision:
      'Build the shorter upper chain first, or skip to the lower offset landing for a wider but more useful return?',
    lesson:
      'The two middle landings form a real fork: each shortens a different later crossing instead of repeating one straight chain.',
    counterplay:
      'Read both keepers from the near landing. Use the upper branch for short exposure or the lower branch to approach the far landing from below.',
    captureConsequence:
      'Connecting one middle landing leaves the other available as a distinct return; occupied regions still remain with their keepers.',
    memorableMoment:
      'A simple island lesson becomes a choice between two visibly different stepping routes.',
    mastery: 'Connect the far landing through both middle approaches without losing a life.',
  },
  'four-quarters': {
    foundations: [rect(28, 1, 5, 34), rect(1, 15, 70, 5)],
    // Original asymmetric stepped bands. They are informed by the rhythm and
    // directional changes of geometric Ukrainian craft, not copied embroidery,
    // a chart, or a claim that these walls reproduce a named cultural symbol.
    walls: [
      rect(10, 10, 11, 2),
      rect(19, 6, 2, 4),
      rect(49, 9, 13, 2),
      rect(49, 11, 2, 4),
      rect(10, 24, 13, 2),
      rect(21, 26, 2, 4),
      rect(49, 25, 13, 2),
      rect(49, 21, 2, 4),
    ],
    routeDecision:
      'Take a short inner enclosure beside the upper stepped band, or sweep around the offset lower band for a larger capture?',
    lesson:
      'The original stepped bands alternate their openings. Walls redirect the route but never close a cut or act as reclaimed ground.',
    counterplay:
      'Reposition on the permanent cross, inspect the keeper in the chosen quarter, and approach an upper or lower band from its open end.',
    captureConsequence:
      'An inner closure creates a new angle around one band while the other occupied quarters remain independent.',
    memorableMoment:
      'Three related wall rhythms ask for different entry directions instead of four repeated rectangles.',
    mastery: 'Close once beside an inner band end and once around an outer band end.',
  },
  'survey-markers': {
    foundations: [rect(31, 15, 10, 5), rect(6, 15, 9, 5), rect(57, 15, 9, 5), rect(31, 3, 10, 3)],
    // Offset wall traces suggest an original flight-controller workbench
    // layout. They do not copy a real board, antenna drawing, or artwork.
    walls: [
      rect(20, 6, 3, 9),
      rect(23, 6, 8, 3),
      rect(49, 21, 3, 9),
      rect(41, 27, 8, 3),
      rect(48, 9, 13, 2),
      rect(11, 25, 13, 2),
    ],
    routeDecision:
      'Use a marked direct link to a side pad, or arc around an offset trace to bank a broader unmarked approach?',
    lesson:
      'The FPV-inspired trace walls are collision geometry only. Directional fields still change travel speed only on unclaimed cells.',
    counterplay:
      'Stage on the central pad, compare the keepers, then choose a direct marked connection or the broad gap at the opposite end of a trace.',
    captureConsequence:
      'A side-pad connection removes only the crossed speed field and opens a new departure around one trace end.',
    memorableMoment:
      'A direct signal-like run and a wide unmarked arc arrive at the same pad from different sides.',
    mastery: 'Connect both side pads using different ends of the offset traces.',
  },
});

/**
 * Unenrolled copy-on-write source for exactly three remaining spatial studies.
 * Historical routes, progress, pictures and prior mission/map revisions stay in
 * their existing factories. This factory does not allocate a player route or a
 * release version.
 */
export function createSpatialNextBatchCandidates({ artwork = false } = {}) {
  const source = createWholeErosionReviewCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-spatial-next-batch-original-review'
    : 'whole-spatial-next-batch-greybox-review';
  project.name = 'Whole Journey · three-route spatial draft · human balance pending';
  project.revision = DRAFT_REVISION;

  for (const selection of SPATIAL_NEXT_BATCH_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = {
      ...priorMap,
      revision: DRAFT_REVISION,
      foundations: structuredClone(revision.foundations),
      walls: structuredClone(revision.walls),
    };
    project.maps = project.maps.filter(
      (item) => !(item.id === priorMap.id && item.revision === priorMap.revision),
    );
    project.maps.push(nextMap);
    mission.revision = DRAFT_REVISION;
    mission.map.revision = DRAFT_REVISION;
    Object.assign(mission.design, {
      routeDecision: revision.routeDecision,
      lesson: revision.lesson,
      counterplay: revision.counterplay,
      captureConsequence: revision.captureConsequence,
      memorableMoment: revision.memorableMoment,
      mastery: revision.mastery,
    });
    if (revision.walls.length > 0)
      mission.design.combines = [...new Set([...mission.design.combines, 'walls'])];
  }

  for (const item of [...project.campaigns, ...project.packs]) item.revision = DRAFT_REVISION;
  return project;
}
