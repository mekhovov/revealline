import { createJourneyRelayCompoundsSpatialPairCandidates } from './journey-relay-compounds-spatial-pair.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'relay-watchposts-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const JOURNEY_RELAY_WATCHPOSTS_SPATIAL_DISPOSITIONS = Object.freeze({
  'nested-relays': Object.freeze({
    disposition: 'redesign',
    approaches: Object.freeze(['upper-ring-first', 'inner-drop-first']),
  }),
  'watchpost-exchange': Object.freeze({
    disposition: 'redesign',
    approaches: Object.freeze(['northwest-drop-first', 'southeast-perimeter-first']),
  }),
});

const revisions = Object.freeze({
  'nested-relays': {
    walls: [
      rect(18, 9, 8, 2),
      rect(33, 9, 9, 2),
      rect(18, 20, 8, 2),
      rect(60, 10, 2, 8),
      rect(60, 21, 2, 8),
    ],
    foundations: [
      rect(13, 5, 46, 3),
      rect(13, 8, 3, 21),
      rect(16, 26, 43, 3),
      rect(56, 8, 3, 10),
      rect(56, 22, 3, 4),
      rect(28, 12, 20, 3),
      rect(28, 15, 3, 9),
      rect(31, 21, 17, 3),
    ],
    terrain: [{ id: 'upper-ring-static', kind: 'slow', ...rect(26, 8, 6, 3) }],
    spawn: { id: 'home', x: 29.5, y: 13.5 },
    design: {
      routeDecision:
        'Take the short but slowed upper-ring cut to open the long inner link, or shift across the inner shelf and drop beside its keeper to open the lower link first?',
      lesson:
        'The nested archive rings remain one enemy-governed field. Each numbered relay opens one return shortcut without moving a keeper or causing a second fill.',
      counterplay:
        'Read the inner keeper before choosing the vertical drop. The upper route is shorter but crosses signal static; the inner drop is clear but exposes a longer trail beside the frontier patrol.',
      captureConsequence:
        'The upper relay opens the long cross-ring connector. The inner relay opens only the lower bridge, changing the next return distance without changing field retention.',
      memorableMoment:
        'The craft closes through one ring, lights a shortcut across the next, and the neighbouring keeper visibly remains in its original field.',
      mastery:
        'Open the lower connector first, then use both links and clear without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 8,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 8,
        coordination: 0,
      },
    },
  },
  'watchpost-exchange': {
    walls: [
      rect(15, 5, 12, 2),
      rect(15, 7, 2, 5),
      rect(5, 23, 8, 2),
      rect(11, 25, 2, 6),
      rect(45, 5, 9, 2),
      rect(45, 7, 2, 5),
      rect(56, 22, 10, 2),
      rect(56, 24, 2, 6),
      rect(45, 30, 5, 2),
    ],
    foundations: [rect(34, 1, 4, 34), rect(1, 16, 26, 3), rect(45, 16, 26, 3)],
    terrain: [
      { id: 'northwest-watch-noise', kind: 'slow', ...rect(7, 10, 6, 4) },
      { id: 'southeast-watch-noise', kind: 'slow', ...rect(50, 22, 5, 6) },
    ],
    spawn: { id: 'home', x: 10.5, y: 0.5 },
    design: {
      routeDecision:
        'Drop through the nearby northwest watch lane and open the west junction, or stay on the safe outer perimeter and approach the southeast relay upward before assembling the opposite route?',
      lesson:
        'Four occupied watch sectors remain independent pressure problems. Junctions join reclaimed routes only after their matching relay is captured.',
      counterplay:
        'Use the outer border to change approach height without exposure. The northwest route is short and slowed; the southeast route is a longer safe setup followed by a pressured upward cut.',
      captureConsequence:
        'The northwest relay opens only the western hub junction. The southeast relay opens only the eastern junction; neither capture clears a keeper-held neighbouring sector.',
      memorableMoment:
        'A long perimeter transfer ends in an upward relay cut, and the newly opened junction turns the central watch spine into a cross-board return.',
      mastery:
        'Open the southeast junction first, traverse both junctions, and clear without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 8,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 8,
        coordination: 0,
      },
    },
  },
});

/** Ninth copy-on-write spatial batch. Candidate editions only; default route,
 * version, publication, historical replay and completion identities are unchanged. */
export function createJourneyRelayWatchpostsSpatialPairCandidates({ artwork = false } = {}) {
  const source = createJourneyRelayCompoundsSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-relay-watchposts-spatial-pair-original-review'
    : 'whole-relay-watchposts-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · Nested relays and watchpost exchange spatial successors';
  for (const [missionId, revision] of Object.entries(revisions)) {
    const mission = project.missions.find((item) => item.id === missionId);
    const oldMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const map = {
      ...oldMap,
      revision: REVISION,
      walls: revision.walls,
      foundations: revision.foundations,
      terrain: revision.terrain,
      spawns: [revision.spawn],
    };
    project.maps = project.maps.filter(
      (item) => item.id !== oldMap.id || item.revision !== oldMap.revision,
    );
    project.maps.push(map);
    Object.assign(mission, {
      revision: REVISION,
      map: { id: map.id, revision: map.revision },
      design: {
        ...mission.design,
        ...revision.design,
        practices: [...new Set([...mission.design.practices, 'walls', 'slow-field'])],
        combines: [...new Set([...mission.design.combines, 'walls', 'slow-field'])],
      },
    });
  }
  for (const item of [...project.packs, ...project.campaigns]) item.revision = REVISION;
  return structuredClone(compileContentProject(project).source);
}
