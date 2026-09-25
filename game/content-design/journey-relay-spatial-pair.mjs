import { createJourneyPhaseworksSpatialPairCandidates } from './journey-phaseworks-spatial-pair.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'relay-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

const revisions = Object.freeze({
  'first-link': {
    walls: [
      rect(20, 6, 10, 2),
      rect(42, 6, 10, 2),
      rect(16, 10, 10, 2),
      rect(46, 10, 10, 2),
      rect(18, 20, 10, 2),
      rect(44, 20, 10, 2),
      rect(24, 24, 7, 2),
      rect(41, 24, 7, 2),
    ],
    foundations: [rect(31, 14, 10, 4), rect(31, 27, 10, 4), rect(10, 20, 8, 5)],
    terrain: [
      { id: 'west-signal-noise', kind: 'slow', ...rect(18, 13, 10, 6) },
      { id: 'east-signal-noise', kind: 'slow', ...rect(44, 13, 10, 6) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Capture the central relay for the shortest exposed descent and unlock the south bridge, or first establish the offset service landing through the longer clear western channel?',
      lesson:
        'The paired baffles are walls around an FPV diversity-link silhouette. Capturing the numbered relay opens the existing connector; walls never close a cut.',
      counterplay:
        'Read both keepers before choosing the central descent. The west service landing avoids signal-noise terrain, while the central relay trades exposure for an immediate permanent bridge.',
      captureConsequence:
        'The relay capture joins the two central landings without awarding coverage; the optional western landing creates an independent return for later side enclosures.',
      memorableMoment:
        'The craft captures the relay, stops on the upper pad, then crosses the newly lit bridge to the lower landing without opening another trail.',
      mastery:
        'Open and cross the south bridge, connect the western service landing, and clear without losing a life.',
      difficulty: {
        band: 9,
        planning: 8,
        execution: 6,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  'second-approach': {
    walls: [
      rect(12, 5, 10, 2),
      rect(50, 5, 10, 2),
      rect(15, 8, 7, 2),
      rect(50, 8, 7, 2),
      rect(18, 11, 8, 2),
      rect(46, 11, 8, 2),
      rect(20, 23, 8, 2),
      rect(44, 23, 8, 2),
      rect(23, 27, 7, 2),
      rect(42, 27, 7, 2),
    ],
    foundations: [rect(3, 14, 6, 7), rect(30, 14, 8, 7), rect(57, 14, 8, 7)],
    terrain: [
      { id: 'west-archive-bed', kind: 'slow', ...rect(10, 25, 10, 5) },
      { id: 'east-archive-bed', kind: 'slow', ...rect(52, 25, 10, 5) },
    ],
    spawn: { id: 'home', x: 37.5, y: 0.5 },
    design: {
      routeDecision:
        'Drop through the near eastern relay to open a short gallery immediately, or travel the outer rail and enter the western stepped arch for a safer first chamber?',
      lesson:
        'Two independent relays sit inside original stepped-arch baffles. Each capture opens only its matching bridge, so route order changes the usable return network.',
      counterplay:
        'Use the wide open crown of each arch to watch its keeper, then commit through the relay column. The central landing screens the frontier while crossing an opened bridge.',
      captureConsequence:
        'The first relay joins one outer landing to the center; opening the other completes a cross-board permanent return without changing earned coverage.',
      memorableMoment:
        'A direct eastern relay cut lands on the center pad, after which the craft crosses its newly opened gallery under the stepped wall silhouette.',
      mastery:
        'Open the eastern bridge before the western bridge, cross both permanent links, and clear without losing a life.',
      difficulty: {
        band: 9,
        planning: 9,
        execution: 6,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
});

/** Seventh copy-on-write spatial batch. Candidate editions only; default-route,
 * version, publication and historical replay behavior remain unchanged. */
export function createJourneyRelaySpatialPairCandidates({ artwork = false } = {}) {
  const source = createJourneyPhaseworksSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-relay-spatial-pair-original-review'
    : 'whole-relay-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · Relay link and stepped-arch spatial successors';
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
