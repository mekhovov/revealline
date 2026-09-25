import { freezeDesign } from './catalogs.mjs';
import { createWholeErosionReviewCandidates } from './whole-spatial-candidates.mjs';

const pair = Object.freeze({
  'long-wave': {
    actorId: 'west',
    role: 'heading-interceptor',
    routeDecision:
      'Commit to the direct middle link before the interceptor locks, or feint down the western current and turn toward the central landing after its target is fixed?',
    lesson:
      'The arrows change only craft travel time. The interceptor still warns for 0.75 seconds, commits to one predicted heading for 1.2 seconds, then recovers; it never bends toward a later turn.',
    counterplay:
      'Choose two reachable landings before departure. Turn after the visible lock, or wait on reclaimed ground through the finite commitment before taking the wide lane-emitter window.',
    captureConsequence:
      'Closure cancels the committed intercept and neutralizes captured arrows. The interceptor and remaining keeper still retain their occupied field regions, while the lane emitter keeps its separate schedule.',
    memorableMoment:
      'A with-current feint leaves the interceptor travelling toward an empty point while the central landing closes the actual route.',
    mastery:
      'Cancel a committed intercept, reclaim the east and west marked links, and clear without losing a life.',
    approaches: [
      'Use the alternating short links, turning toward the central landing after a visible lock.',
      'Wait out the committed intercept on a landing, then take the wider unmarked enclosure during lane recovery.',
    ],
  },
  'returning-light': {
    actorId: 'keeper',
    role: 'trail-pursuer',
    routeDecision:
      'Take the fast eastbound crossing before pursuit commits, or use the upper stepping platform to cancel the lock before awakening the reclaimed-ground roamer?',
    lesson:
      'The pursuer locks one point on the unfinished trail, warns for 0.75 seconds and follows a finite 1.2-second commitment. Capture may wake the roamer, so the next reclaimed-ground escape must already be visible.',
    counterplay:
      'Keep a stepping return in reserve. Close the exposed trail before the committed route arrives, then preserve two reclaimed exits before capturing the roamer.',
    captureConsequence:
      'Closure cancels pursuit and turns captured arrows into ordinary reclaimed ground. The pursuer retains its occupied field region, and the awakened roamer may use the new shortcut.',
    memorableMoment:
      'A short stepping closure cancels pursuit, then the same safe route becomes an escape from the newly active roamer.',
    mastery:
      'Cancel a committed pursuit, visit both stepping platforms after the roamer wakes, and clear without losing a life.',
    approaches: [
      'Use the fast eastbound field to reach the middle landing before the warned pursuit arrives.',
      'Take a shorter upper-platform closure first, then preserve the lower return before activating the roamer.',
    ],
  },
});

export const LATE_PRESSURE_PAIR_DISPOSITIONS = freezeDesign(
  Object.entries(pair).map(([missionId, design]) => ({
    missionId,
    decision: 'redesign-successor-candidate',
    replacement: { actorId: design.actorId, from: 'field-keeper', to: design.role },
    approaches: [...design.approaches],
    preserves: [
      'mission-and-map-identity',
      'actor-count-and-field-retention',
      'campaign-order-and-progression',
      'objectives-coverage-art-and-history',
    ],
    status: 'automated-pressure-review-only-human-balance-pending',
  })),
);

/** Copy-on-write late-game encounter pair. This is a candidate source only: no
 * route/default/version registration and no historical edition mutation. */
export function createLatePressurePairCandidates({ artwork = false } = {}) {
  const source = createWholeErosionReviewCandidates({ artwork });
  source.id = artwork
    ? 'whole-late-pressure-pair-original-review'
    : 'whole-late-pressure-pair-greybox-review';
  source.revision = 'late-pressure-pair-review-1';
  source.name = 'Whole Journey · late pressure pair review';
  source.missions = source.missions.map((mission) => {
    const design = pair[mission.id];
    if (!design) return mission;
    const actors = mission.actors.map((actor) =>
      actor.id === design.actorId ? { ...actor, role: design.role } : actor,
    );
    const roles = new Set(actors.map((actor) => actor.role));
    return {
      ...mission,
      revision: 'late-pressure-pair-1',
      actors,
      design: {
        ...mission.design,
        routeDecision: design.routeDecision,
        lesson: design.lesson,
        counterplay: design.counterplay,
        captureConsequence: design.captureConsequence,
        memorableMoment: design.memorableMoment,
        mastery: design.mastery,
        introduces: [],
        practices: [...new Set([...mission.design.practices, design.role])],
        combines: [
          ...new Set(
            [...mission.design.combines, design.role].filter(
              (mechanic) => mechanic !== 'field-keeper' || roles.has('field-keeper'),
            ),
          ),
        ],
      },
    };
  });
  return source;
}
