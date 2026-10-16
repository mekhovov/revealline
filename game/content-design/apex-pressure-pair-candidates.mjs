import { freezeDesign } from './catalogs.mjs';
import { createLatePressurePairCandidates } from './late-pressure-pair-candidates.mjs';

const pair = Object.freeze({
  'crossing-complete': {
    actorId: 'upper',
    role: 'heading-interceptor',
    routeDecision:
      'Hold the direct central crossing after the interceptor locks, or turn toward a side terrace and turn that hazardous belt into the next broad return?',
    lesson:
      'The interceptor predicts one observed heading, warns for 0.75 seconds and commits for a finite 1.2 seconds. The frontier and perimeter patrols keep their own routes; none can steer the committed intercept after a turn.',
    counterplay:
      'Choose a reachable center or terrace return before departure. Turn after the visible lock, close the exposed segment, and read the two patrol domains before extending the next belt enclosure.',
    captureConsequence:
      'Closure cancels interception and neutralizes captured terrain and arrows. The interceptor and lower keeper retain their occupied field regions while the frontier and perimeter patrols continue independently.',
    memorableMoment:
      'A late turn leaves the interceptor crossing an empty stripe while the craft closes on a terrace that becomes the next safe approach.',
    mastery:
      'Cancel a committed intercept, reclaim both lethal side fields, and visit the connected lower terrace before clearing without a life loss.',
    approaches: [
      'Feint through the marked center, then turn to the nearest terrace after the interceptor target locks.',
      'Wait on a terrace through the commitment, then enclose a hazardous side belt while the patrol routes are separated.',
    ],
  },
  'final-broadcast': {
    actorId: 'carrier',
    role: 'trail-pursuer',
    routeDecision:
      'Bank the upper protected link before pursuit and erosion overlap, or draw the pursuer toward the broad center and close at the lower anchor while its target stays fixed?',
    lesson:
      'The pursuer locks one point on the unfinished trail and commits for a finite route. The eroder uses a separate warning, so a protected connector can be more valuable than chasing every reopened cell.',
    counterplay:
      'Keep the nearest anchor return visible, close before the warned pursuit arrives, and repair eroded ground only when it preserves the planned route. Use an opened connector when remote cleanup would break that plan.',
    captureConsequence:
      'Closure cancels pursuit; capturing an anchor protects its cell and opens a permanent non-scoring connector. Earned shortcuts remain vulnerable to separately warned erosion.',
    memorableMoment:
      'A protected link survives erosion while a short anchor closure cancels the pursuer committed to the abandoned center route.',
    mastery:
      'Cancel a committed pursuit and traverse both opened connectors before clearing without a life loss.',
    approaches: [
      'Secure the upper anchor first and use its permanent link for the next pursued closure.',
      'Draw pursuit through the broad center, then close at the lower anchor and leave an isolated erosion loss unrepaired.',
    ],
  },
});

export const APEX_PRESSURE_PAIR_DISPOSITIONS = freezeDesign(
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

/** Copy-on-write Apex encounter pair stacked on the earlier late-pressure pair.
 * This remains an unregistered candidate: defaults and historical routes do not
 * resolve it until a later versioned integration explicitly adopts the source. */
export function createApexPressurePairCandidates({ artwork = false } = {}) {
  const source = createLatePressurePairCandidates({ artwork });
  source.id = artwork
    ? 'whole-apex-pressure-pair-original-review'
    : 'whole-apex-pressure-pair-greybox-review';
  source.revision = 'apex-pressure-pair-review-1';
  source.name = 'Whole Journey · Apex readable-pressure pair review';
  source.missions = source.missions.map((mission) => {
    const design = pair[mission.id];
    if (!design) return mission;
    const actors = mission.actors.map((actor) =>
      actor.id === design.actorId ? { ...actor, role: design.role } : actor,
    );
    const roles = new Set(actors.map((actor) => actor.role));
    return {
      ...mission,
      revision: 'apex-pressure-pair-1',
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
