import { createJourneyRelayWatchpostsSpatialPairCandidates } from "./journey-relay-watchposts-spatial-pair.mjs";
import { compileContentProject } from "./project.mjs";

const REVISION = "crosswind-compass-spatial-pair-1";
const rect = (x, y, w, h) => ({ x, y, w, h });

export const JOURNEY_CROSSWIND_COMPASS_SPATIAL_DISPOSITIONS = Object.freeze({
  "compass-array": Object.freeze({
    disposition: "redesign",
    approaches: Object.freeze(["north-neck-first", "west-arm-first"]),
  }),
  "outer-loop": Object.freeze({
    disposition: "redesign",
    approaches: Object.freeze(["inner-post-first", "outer-post-first"]),
  }),
});

const revisions = Object.freeze({
  "compass-array": {
    walls: [
      rect(23, 13, 7, 2),
      rect(43, 13, 8, 2),
      rect(23, 21, 7, 2),
      rect(43, 21, 8, 2),
      rect(15, 4, 5, 2),
      rect(52, 4, 5, 2),
      rect(15, 32, 5, 2),
      rect(52, 32, 5, 2),
    ],
    foundations: [
      rect(31, 15, 10, 6),
      rect(22, 5, 28, 3),
      rect(22, 28, 28, 3),
      rect(9, 13, 5, 9),
      rect(58, 13, 5, 9),
    ],
    spawn: { id: "home", x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        "Take the short north neck with its favourable arrow and frontier timing, or cross the longer unmarked west arm to establish a side return before using any neck?",
      lesson:
        "Compass baffles separate the marked bands without changing their rules. Movement with an arrow is faster, against it is slower, and crossing it sideways remains ordinary speed.",
      counterplay:
        "Read both keepers from the central pad. The north neck is short but predictable to the frontier patrol; the west arm is longer and avoids a marked lane.",
      captureConsequence:
        "Reclaiming a neck neutralizes its directional modifier. A side-arm closure instead creates a broad ordinary-speed departure for a later enclosure.",
      memorableMoment:
        "The craft races with the north arrow into a small landing, then uses the quiet west arm as a completely different return.",
      mastery:
        "Close on both a marked neck and an unmarked side arm, then clear without losing a life.",
      difficulty: {
        band: 11,
        planning: 11,
        execution: 9,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  "outer-loop": {
    walls: [
      rect(9, 10, 7, 2),
      rect(32, 12, 8, 2),
      rect(48, 10, 8, 2),
      rect(9, 24, 7, 2),
      rect(32, 24, 8, 2),
      rect(48, 25, 8, 2),
    ],
    foundations: [
      rect(4, 6, 4, 24),
      rect(8, 6, 50, 3),
      rect(8, 27, 50, 3),
      rect(25, 14, 4, 8),
      rect(44, 14, 4, 8),
      rect(62, 11, 4, 13),
    ],
    spawn: { id: "home", x: 6.5, y: 17.5 },
    design: {
      routeDecision:
        "Use the nearby with-arrow lane to reach the first inner post, or reposition along the reclaimed upper loop before taking a short against-arrow dogleg to the outer post?",
      lesson:
        "The long U is useful return ground, not universal safety. Directional field applies only while unclaimed, while an activated roamer can still use connected reclaimed routes.",
      counterplay:
        "The inner approach is quick but immediately enlarges the roamer network. The outer setup consumes safe travel time, then asks for a short committed dogleg through the marked column.",
      captureConsequence:
        "The inner closure creates the shortest central escape but activates nearby reclaimed-ground pressure. The outer closure preserves two separated post approaches for later cuts.",
      memorableMoment:
        "A long safe reposition ends with a tight against-arrow turn onto the outer post while the central roamer remains far away.",
      mastery:
        "Close once on an inner post and once on the outer post, then clear without losing a life.",
      difficulty: {
        band: 11,
        planning: 11,
        execution: 9,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
});

/** Tenth copy-on-write spatial batch. Candidate editions only; default route,
 * version, publication, historical replay and completion identities are unchanged. */
export function createJourneyCrosswindCompassSpatialPairCandidates({
  artwork = false,
} = {}) {
  const source = createJourneyRelayWatchpostsSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? "whole-crosswind-compass-spatial-pair-original-review"
    : "whole-crosswind-compass-spatial-pair-greybox-review";
  project.revision = REVISION;
  project.name =
    "Whole Journey · Compass array and outer-loop spatial successors";
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
        practices: [...new Set([...mission.design.practices, "walls"])],
        combines: [...new Set([...mission.design.combines, "walls"])],
      },
    });
  }
  for (const item of [...project.packs, ...project.campaigns])
    item.revision = REVISION;
  return structuredClone(compileContentProject(project).source);
}
