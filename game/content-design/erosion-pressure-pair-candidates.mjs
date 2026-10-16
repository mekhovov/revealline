import { freezeDesign } from './catalogs.mjs';
import { createApexPressurePairCandidates } from './apex-pressure-pair-candidates.mjs';

const pair = Object.freeze({
  'cooling-loop': {
    actorId: 'keeper',
    role: 'heading-interceptor',
    routeDecision:
      'Cross the cooled bank while the lane and intercept windows separate, or connect the permanent landing loop before risking a longer enclosure?',
    lesson:
      'The lane emitter and interceptor warn independently. The interceptor commits to one predicted heading for a finite route; erosion can reopen earned ground but cannot remove a permanent foundation.',
    counterplay:
      'Keep a foundation return visible, turn only after the intercept target locks, and repair an eroded bank only when it protects the next route. Waiting on reclaimed ground remains a valid answer to overlapping warnings.',
    captureConsequence:
      'Closure cancels the committed intercept and neutralizes captured lethal terrain. The interceptor still retains its occupied field region while separately warned erosion can reopen earned shortcuts.',
    memorableMoment:
      'A late turn sends the interceptor across an empty bank while the craft closes on a permanent landing that survives the next erosion warning.',
    mastery:
      'Cancel a committed intercept, neutralize both lethal banks, connect all four foundations and clear without losing a life.',
    approaches: [
      'Wait on a permanent landing until lane and intercept recovery overlap, then take the direct cooled-bank enclosure.',
      'Feint toward the marked bank, turn after the intercept locks and use the longer foundation loop before deciding whether an eroded spoke is worth repairing.',
    ],
  },
  'crosswind-remix': {
    actorId: 'keeper',
    role: 'trail-pursuer',
    routeDecision:
      'Use the marked current before pursuit and erosion overlap, or draw the pursuer toward an earned spoke and close through the permanent outer returns?',
    lesson:
      'The pursuer locks one point on the unfinished trail and commits for a finite route. Directional fields change only craft travel time; earned inner spokes remain vulnerable to a separately warned eroder.',
    counterplay:
      'Plan a reachable foundation before departure, account for the marked travel-time difference, and leave isolated erosion unrepaired when the outer return already provides the safer next approach.',
    captureConsequence:
      'Closure cancels pursuit and neutralizes captured arrows. The pursuer retains its occupied field region while erosion can restore only eligible earned territory, never permanent foundations.',
    memorableMoment:
      'A with-current closure cancels the pursuer committed to the center, then a permanent outer return remains available after an inner spoke erodes.',
    mastery:
      'Cancel a committed pursuit, use both current directions, allow and strategically ignore or repair one erosion, then clear without losing a life.',
    approaches: [
      'Take the faster marked crossing before pursuit arrives, then use its captured edge as the next return while the eroder recovers.',
      'Draw pursuit toward a short inner spoke, close through an outer foundation and decline low-value erosion cleanup.',
    ],
  },
});

export const EROSION_PRESSURE_PAIR_DISPOSITIONS = freezeDesign(
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
      'erosion-foundation-and-relay-rules',
    ],
    status: 'automated-pressure-review-only-human-balance-pending',
  })),
);

/** Copy-on-write erosion-counterplay pair stacked on the readable-pressure
 * candidates. It remains unregistered: no default, version or historical
 * edition resolves this source until a later integration explicitly adopts it. */
export function createErosionPressurePairCandidates({ artwork = false } = {}) {
  const source = createApexPressurePairCandidates({ artwork });
  source.id = artwork
    ? 'whole-erosion-pressure-pair-original-review'
    : 'whole-erosion-pressure-pair-greybox-review';
  source.revision = 'erosion-pressure-pair-review-1';
  source.name = 'Whole Journey · erosion pressure pair review';
  source.missions = source.missions.map((mission) => {
    const design = pair[mission.id];
    if (!design) return mission;
    const actors = mission.actors.map((actor) =>
      actor.id === design.actorId ? { ...actor, role: design.role } : actor,
    );
    const roles = new Set(actors.map((actor) => actor.role));
    return {
      ...mission,
      revision: 'erosion-pressure-pair-1',
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
