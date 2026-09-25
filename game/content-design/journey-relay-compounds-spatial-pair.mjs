import { createJourneyRelaySpatialPairCandidates } from "./journey-relay-spatial-pair.mjs";
import { compileContentProject } from "./project.mjs";

const REVISION = "relay-compounds-spatial-pair-1";
const rect = (x, y, w, h) => ({ x, y, w, h });

export const JOURNEY_RELAY_COMPOUNDS_SPATIAL_DISPOSITIONS = Object.freeze({
  "three-compounds": Object.freeze({
    disposition: "redesign",
    approaches: Object.freeze(["upper-relay-first", "west-reserve-first"]),
  }),
  "spiral-stores": Object.freeze({
    disposition: "redesign",
    approaches: Object.freeze(["west-window-first", "east-window-first"]),
  }),
});

const revisions = Object.freeze({
  "three-compounds": {
    walls: [
      rect(18, 5, 10, 2),
      rect(44, 5, 10, 2),
      rect(18, 8, 2, 6),
      rect(52, 8, 2, 6),
      rect(27, 10, 5, 2),
      rect(40, 10, 5, 2),
      rect(18, 22, 2, 7),
      rect(52, 22, 2, 7),
      rect(18, 29, 10, 2),
      rect(44, 29, 10, 2),
    ],
    foundations: [
      rect(32, 14, 8, 7),
      rect(7, 13, 8, 9),
      rect(56, 13, 8, 9),
      rect(32, 3, 8, 4),
    ],
    terrain: [
      { id: "west-archive-noise", kind: "slow", ...rect(21, 12, 7, 4) },
      { id: "east-archive-noise", kind: "slow", ...rect(44, 20, 7, 4) },
    ],
    spawn: { id: "home", x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        "Take the short exposed ascent through the upper relay and wake the western link first, or establish the west compound as a reserve before committing to either numbered relay?",
      lesson:
        "Three separated archive compounds share permanent relay links, but a reclaimed-ground roamer can pressure every connected landing after activation.",
      counterplay:
        "Read both keepers from the central pad. The upper cut is short but commits to relay order; the western side cut is longer and preserves a separate refuge before the roamer network expands.",
      captureConsequence:
        "The upper relay opens the western connector; the eastern relay opens the opposite connector. An outer compound remains an independent return until its link is deliberately opened.",
      memorableMoment:
        "The craft banks a quiet western refuge, then lights the upper connector and watches the roamer gain a visibly larger patrol network.",
      mastery:
        "Establish the western reserve before opening both links, visit all three compounds, and clear without losing a life.",
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
  "spiral-stores": {
    walls: [
      rect(11, 10, 13, 2),
      rect(22, 12, 2, 4),
      rect(22, 19, 2, 4),
      rect(11, 21, 11, 2),
      rect(48, 13, 13, 2),
      rect(48, 15, 2, 5),
      rect(48, 22, 2, 4),
      rect(50, 26, 11, 1),
    ],
    foundations: [
      rect(6, 6, 22, 3),
      rect(6, 9, 3, 18),
      rect(9, 24, 19, 3),
      rect(44, 9, 22, 3),
      rect(63, 12, 3, 18),
      rect(44, 27, 19, 3),
      rect(33, 14, 6, 7),
      rect(33, 9, 3, 5),
      rect(36, 21, 3, 6),
    ],
    terrain: [
      { id: "west-store-static", kind: "slow", ...rect(14, 13, 6, 3) },
      { id: "east-store-static", kind: "slow", ...rect(52, 21, 6, 3) },
    ],
    spawn: { id: "home", x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        "Commit to the western mid-store window for the upper shortcut, or descend to the opposing eastern window and open the lower shortcut while the frontier patrol is farther away?",
      lesson:
        "Opposing broken spirals expose different crossing windows. A shortcut reduces the next return distance but never turns the wall silhouette into return ground.",
      counterplay:
        "Wait on the central spine until the frontier patrol passes the intended window, then use the straight opening through the broken wall rather than following the ornamental bend.",
      captureConsequence:
        "The western window opens the upper break and the eastern window opens the lower break; each permanently shortens only its own later approach.",
      memorableMoment:
        "A long cross-store cut captures one relay through a narrow opening, and the newly lit shortcut makes the opposite spiral visibly easier to approach.",
      mastery:
        "Open the two shortcuts in consecutive captures, use each permanent link, and clear without losing a life.",
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
});

/** Eighth copy-on-write spatial batch. Candidate editions only; default route,
 * version, publication, historical replay and completion identities are unchanged. */
export function createJourneyRelayCompoundsSpatialPairCandidates({
  artwork = false,
} = {}) {
  const source = createJourneyRelaySpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? "whole-relay-compounds-spatial-pair-original-review"
    : "whole-relay-compounds-spatial-pair-greybox-review";
  project.revision = REVISION;
  project.name =
    "Whole Journey · Relay compounds and broken-spiral spatial successors";
  for (const [missionId, revision] of Object.entries(revisions)) {
    const mission = project.missions.find((item) => item.id === missionId);
    const oldMap = project.maps.find(
      (item) =>
        item.id === mission.map.id && item.revision === mission.map.revision,
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
        practices: [
          ...new Set([...mission.design.practices, "walls", "slow-field"]),
        ],
        combines: [
          ...new Set([...mission.design.combines, "walls", "slow-field"]),
        ],
      },
    });
  }
  for (const item of [...project.packs, ...project.campaigns])
    item.revision = REVISION;
  return structuredClone(compileContentProject(project).source);
}
