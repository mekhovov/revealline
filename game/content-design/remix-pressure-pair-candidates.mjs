import { freezeDesign } from './catalogs.mjs';
import { createErosionPressurePairCandidates } from './erosion-pressure-pair-candidates.mjs';

const pair = Object.freeze({
  'phase-remix': {
    actorId: 'east-carrier',
    role: 'heading-interceptor',
    routeDecision:
      'Connect the central circuit before the interceptor locks the long crossing, or feint toward the east carrier and turn into a shorter fallback enclosure after its target is fixed?',
    lesson:
      'The interceptor predicts one observed heading, warns for 0.75 seconds and commits for a finite 1.2 seconds. The frontier patrol and reclaimed-ground roamer keep their independent domains.',
    counterplay:
      'Keep a fallback landing visible, turn only after the intercept target locks, and preserve an exit before a broad capture wakes the roamer. Waiting on reclaimed ground remains a valid response.',
    captureConsequence:
      'Closure cancels interception and any travelling trail impact. The interceptor and west keeper retain their occupied field regions while the frontier and roamer continue independently.',
    memorableMoment:
      'A late turn sends the interceptor into the abandoned crossing while the craft closes a short return just before the roamer enters the new corridor.',
    mastery:
      'Cancel a committed intercept after the roamer activates, neutralize the lethal bank and clear without losing a life.',
    approaches: [
      'Use short closures from the disconnected fallback landings, turning after a visible intercept lock.',
      'Wait through the commitment on reclaimed ground, then connect the central circuit before the frontier patrol returns.',
    ],
  },
  'livewire-remix': {
    actorId: 'carrier',
    role: 'trail-pursuer',
    routeDecision:
      'Use the cross-emitter recovery window for one long connection, or bait pursuit onto a short trail and bank a nearer refuge before the roamer wakes?',
    lesson:
      'The pursuer locks one point on the unfinished trail and commits for a finite route. The two emitters keep their marked schedules; none of the three threats retargets invisibly during commitment.',
    counterplay:
      'Choose the return before departure, close before the warned pursuit or lane front arrives, and leave a reclaimed-ground exit available before capturing the roamer.',
    captureConsequence:
      'Closure cancels pursuit and clears travelling impacts, but it does not disable either lane emitter and can activate the roamer on the newly reclaimed route.',
    memorableMoment:
      'One closure extinguishes pursuit and a crossing lane front, then the captured edge becomes the escape route from the awakened roamer.',
    mastery:
      'Cancel a committed pursuit while the roamer is active and clear through both emitter domains without losing a life.',
    approaches: [
      'Take a short refuge closure to cancel pursuit, then use the next cross-emitter recovery window for the longer connection.',
      'Wait through one emitter cycle, draw pursuit away from the selected return and close the broad route before the second lane fires.',
    ],
  },
});

export const REMIX_PRESSURE_PAIR_DISPOSITIONS = freezeDesign(
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
      'terrain-lane-frontier-and-roamer-rules',
    ],
    status: 'automated-pressure-review-only-human-balance-pending',
  })),
);

/** Copy-on-write Remix pair stacked on prior readable-pressure candidates.
 * It remains unregistered: defaults and history do not resolve this source. */
export function createRemixPressurePairCandidates({ artwork = false } = {}) {
  const source = createErosionPressurePairCandidates({ artwork });
  source.id = artwork
    ? 'whole-remix-pressure-pair-original-review'
    : 'whole-remix-pressure-pair-greybox-review';
  source.revision = 'remix-pressure-pair-review-1';
  source.name = 'Whole Journey · Remix pressure pair review';
  source.missions = source.missions.map((mission) => {
    const design = pair[mission.id];
    if (!design) return mission;
    const actors = mission.actors.map((actor) =>
      actor.id === design.actorId ? { ...actor, role: design.role } : actor,
    );
    const roles = new Set(actors.map((actor) => actor.role));
    return {
      ...mission,
      revision: 'remix-pressure-pair-1',
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
