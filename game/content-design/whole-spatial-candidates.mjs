import {
  freezeDesign,
  TRAIL_IMPACT_JOURNEY_POLICY,
  CURRENT_PRESSURE_ACTOR_CATALOG,
} from './catalogs.mjs';
import {
  WHOLE_SPATIAL_SELECTIONS_JSON,
  WHOLE_SPATIAL_GREYBOX_JSON,
  WHOLE_SPATIAL_ORIGINAL_JSON,
  WHOLE_SPATIAL_FIELD_FINALE_JSON,
  WHOLE_SPATIAL_TIMED_BORDER_JSON,
  WHOLE_SPATIAL_CULTURAL_WORKSHOP_JSON,
  WHOLE_SPATIAL_SORTING_LANES_JSON,
} from './whole-spatial-data.mjs';

export const WHOLE_SPATIAL_SELECTIONS = freezeDesign(JSON.parse(WHOLE_SPATIAL_SELECTIONS_JSON));

/** Fresh authored data, not pre-approved runtime manifests. The normal shared
 * compiler still validates all presets/modes at every host or Studio boundary.
 * CI regenerates these snapshots from scripts/lib/whole-spatial-source.mjs to
 * prevent stale data; no expensive study composition runs on the browser thread. */
export function createWholeSpatialCandidates({ artwork = false } = {}) {
  return JSON.parse(artwork ? WHOLE_SPATIAL_ORIGINAL_JSON : WHOLE_SPATIAL_GREYBOX_JSON);
}

/** Explicit successor. Keep the v1 factory, old boss and old progress immutable.
 * Parse only authored data here; hosts and Studio still use the shared compiler. */
export function createWholeFieldCandidates({ artwork = false } = {}) {
  const source = createWholeSpatialCandidates({ artwork });
  const { mission, map } = JSON.parse(WHOLE_SPATIAL_FIELD_FINALE_JSON);
  const index = source.missions.findIndex((item) => item.id === 'home-signal');
  const prior = source.missions[index];
  source.missions[index] = { ...mission, presentation: prior.presentation };
  const sameMap = (a, b) => a.id === b.id && a.revision === b.revision;
  source.maps = source.maps.filter(
    (item) =>
      !sameMap(item, prior.map) || source.missions.some((other) => sameMap(other.map, item)),
  );
  source.maps.push(map);
  source.id = artwork ? 'whole-field-original-review' : 'whole-field-greybox-review';
  source.revision = 'field-finale-review-1';
  source.name = 'Whole Journey · unvalidated field-finale review';
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return source;
}

/** Trail-aware bonus successor of the field-finale edition. Only the three
 * reviewed Border mission revisions change; maps and presentation stay intact. */
export function createWholeTimedCandidates({ artwork = false } = {}) {
  const source = createWholeFieldCandidates({ artwork });
  for (const mission of JSON.parse(WHOLE_SPATIAL_TIMED_BORDER_JSON)) {
    const index = source.missions.findIndex((item) => item.id === mission.id);
    source.missions[index] = { ...mission, presentation: source.missions[index].presentation };
  }
  source.id = artwork ? 'whole-timed-original-review' : 'whole-timed-greybox-review';
  source.revision = 'timed-border-review-1';
  source.name = 'Whole Journey · unvalidated timed-bonus review';
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return source;
}

/** Eight explicit optional missions. Older Journey editions are not expanded. */
export function createWholeVarietyCandidates({ artwork = false } = {}) {
  const source = createWholeTimedCandidates({ artwork });
  const delta = JSON.parse(WHOLE_SPATIAL_CULTURAL_WORKSHOP_JSON)[artwork ? 'original' : 'greybox'];
  for (const key of ['maps', 'missions', 'campaigns', 'packs', 'assets'])
    source[key].push(...delta[key]);
  source.id = artwork ? 'whole-variety-original-review' : 'whole-variety-greybox-review';
  source.revision = 'cultural-workshop-review-1';
  source.name = 'Whole Journey · unvalidated ornament and workshop review';
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return source;
}

/** Explicit one-map successor; historical libraries and progress remain frozen. */
export function createWholeSortingCandidates({ artwork = false } = {}) {
  const source = createWholeVarietyCandidates({ artwork });
  const { mission, map } = JSON.parse(WHOLE_SPATIAL_SORTING_LANES_JSON);
  const index = source.missions.findIndex((item) => item.id === mission.id);
  const prior = source.missions[index];
  source.missions[index] = { ...mission, presentation: prior.presentation };
  const sameMap = (a, b) => a.id === b.id && a.revision === b.revision;
  source.maps = source.maps.filter(
    (item) =>
      !sameMap(item, prior.map) || source.missions.some((other) => sameMap(other.map, item)),
  );
  source.maps.push(map);
  source.id = artwork ? 'whole-sorting-original-review' : 'whole-sorting-greybox-review';
  source.revision = 'sorting-lanes-review-1';
  source.name = 'Whole Journey · unvalidated contested sorting lanes review';
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return source;
}

const replaceMechanic = (values, from, to) => [
  ...new Set(values.map((value) => (value === from ? to : value))),
];

/** Current-rules successor. Geometry, objectives, presentation and actor motion
 * remain exact; only trail-contact consequences and obsolete carrier labels
 * change. The first three teaching layouts stay untouched. */
export function createWholeImpactCandidates({ artwork = false } = {}) {
  const source = createWholeSortingCandidates({ artwork });
  source.policyId = TRAIL_IMPACT_JOURNEY_POLICY.id;
  source.id = artwork ? 'whole-impact-original-review' : 'whole-impact-greybox-review';
  source.revision = 'global-trail-impact-review-1';
  source.name = 'Whole Journey · travelling trail-impact review';
  source.missions = source.missions.map((mission, index) => {
    const design = mission.design;
    const introduces = replaceMechanic(
      design.introduces,
      'selective-trail-impact',
      'travelling-trail-impact',
    );
    const practices = replaceMechanic(
      design.practices,
      'selective-trail-impact',
      'travelling-trail-impact',
    );
    if (index === 1) introduces.push('travelling-trail-impact');
    else if (index > 1 && !introduces.includes('travelling-trail-impact'))
      practices.push('travelling-trail-impact');
    return {
      ...mission,
      actors: mission.actors.map((actor) =>
        actor.role === 'impact-carrier' ? { ...actor, role: 'field-keeper' } : actor,
      ),
      design: {
        ...design,
        routeDecision:
          mission.id === 'final-broadcast'
            ? 'Open the upper protected link first, or invest in the lower anchor while the keeper and eroder occupy different corridors?'
            : design.routeDecision,
        lesson:
          index === 1
            ? 'A hit on an unfinished line sends visible impacts along it. Reach reclaimed ground before the craft-bound front arrives.'
            : mission.id === 'livewire-remix'
              ? 'Combine known lane, impact and reclaimed-ground threats. Moving enemies and an active lane both send visible fronts; direct craft contact remains immediate.'
              : design.lesson
                  .replace(
                    'Only the bolt carrier sends travelling impacts. The two lower keepers break a trail immediately; each occupied bay retains its own field.',
                    'Every field enemy sends a travelling impact when it strikes an unfinished trail; each occupied bay retains its own field.',
                  )
                  .replace('selective', 'travelling')
                  .replace('impact carrier', 'field enemy')
                  .replace('carrier closure race', 'trail-impact closure race'),
        counterplay:
          mission.id === 'final-broadcast'
            ? 'Keep the live route short: both the keeper and eroder send visible fronts when they strike an unfinished trail, while direct body contact remains immediate. Use the broad center corridor to change your approach.'
            : design.counterplay
                .replace('Watch the bolt', 'Watch every field enemy')
                .replace('marked carrier', 'field enemy')
                .replace('carrier\u2019s trail strike', 'enemy trail strike')
                .replace('the carrier and eroder', 'the keeper and eroder'),
        captureConsequence: design.captureConsequence
          .replace(
            'the carrier and keeper retain field normally',
            'the keepers retain field normally',
          )
          .replace('Carrier impacts', 'Trail impacts'),
        memorableMoment: design.memorableMoment.replace('carrier impacts', 'trail impacts'),
        introduces: [...new Set(introduces)],
        practices: [...new Set(practices)],
        combines: replaceMechanic(design.combines, 'impact-carrier', 'field-keeper'),
      },
    };
  });
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return source;
}

const pressureArcs = Object.freeze({
  'return-in-reserve': {
    actorId: 'carrier',
    role: 'trail-pursuer',
    introduce: true,
    routeDecision:
      'Close at the nearby northern landing when pursuit locks, or risk the longer lower enclosure while the committed route remains visible?',
    lesson:
      'The pursuer warns, locks one observed point on the unfinished trail, and commits for a finite route. It never retargets invisibly during that commitment.',
    counterplay:
      'Keep the northern landing in reserve. Close before the committed approach arrives, or put reclaimed ground or a wall between the pursuer and the next exposed trail.',
    memorableMoment:
      'A short landing closure cancels a visibly committed pursuit before the lower bay asks for a different route.',
  },
  'two-ways-home': {
    actorId: 'carrier',
    role: 'trail-pursuer',
    routeDecision:
      'Link the upper landing before provoking pursuit, or preserve two separate returns and choose one after the target locks?',
    lesson:
      'A second return is useful only when it is reachable before the finite pursuit commitment reaches the exposed trail.',
    counterplay:
      'Shape the frontier away from both exits, provoke a readable lock, then close at the return the pursuer did not commit toward.',
    memorableMoment:
      'The unused landing turns a pressured cut into a safe alternate closure and redirects the frontier patrol.',
  },
  'dogleg-transfer': {
    actorId: 'upper-carrier',
    role: 'trail-pursuer',
    routeDecision:
      'Screen the upper route behind the dogleg before a larger enclosure, or clear the lower chamber first and keep the central step as an emergency return?',
    lesson:
      'Physical walls and reclaimed ground block sensing; the dogleg closes cuts, but a wall alone never becomes a return surface.',
    counterplay:
      'Use the dogleg to break line of sight, wait through the finite commitment, and cross each occupied chamber toward its nearest genuine return.',
    memorableMoment:
      'The same stepped structure first screens pursuit and then closes a cut at a different height.',
  },
  'crossed-bands': {
    actorId: 'carrier',
    role: 'heading-interceptor',
    introduce: true,
    routeDecision:
      'Keep the obvious crossing after the interceptor locks your heading, or turn toward the central return and neutralize a different hazardous band?',
    lesson:
      'The interceptor warns and predicts only the observed heading. Its committed target does not follow a later turn.',
    counterplay:
      'Prepare a second return before entering the field. Turn after the target locks, keep the exposed segment short, and let closure cancel the finite commitment.',
    memorableMoment:
      'A deliberate turn leaves the interceptor travelling toward an empty point while the captured band becomes a safer approach.',
  },
  'pressure-ladder': {
    actorId: 'east-carrier',
    role: 'heading-interceptor',
    routeDecision:
      'Climb through short staggered returns and turn after each lock, or expose one longer route while the frontier patrol controls the next rung?',
    lesson:
      'Successive changes of heading beat prediction, but each landing also changes the frontier patrol route.',
    counterplay:
      'Keep the next rung visible, wait for the aim point to lock, then turn toward another landing instead of outrunning the interceptor in a straight line.',
    memorableMoment:
      'A new rung becomes both the next feint and a permanent return while the committed attack passes behind it.',
  },
  'signal-channels': {
    actorId: 'carrier',
    role: 'heading-interceptor',
    routeDecision:
      'Feint toward the northern clear channel, or turn south after the lock while preserving room for the reclaimed-ground roamer?',
    lesson:
      'Interception pressures the current heading while capture can wake a different movement-domain threat; solve the two roles with different routes.',
    counterplay:
      'Lock the interceptor onto an expendable approach, turn toward a broad connection, and leave an escape corridor for the roamer that activates after capture.',
    memorableMoment:
      'One turn defeats the committed intercept, neutralizes a hazardous bank, and wakes pressure on the newly reclaimed route.',
  },
});

/** Current-rules successor for the two Phaseworks pressure arcs. Actor counts,
 * geometry, objectives, pictures and every other mission stay exact. The roles
 * replace ordinary keepers; they do not add invisible pressure or extra bodies. */
export function createWholePressureCandidates({ artwork = false } = {}) {
  const source = createWholeImpactCandidates({ artwork });
  source.actorCatalogId = CURRENT_PRESSURE_ACTOR_CATALOG.id;
  source.id = artwork ? 'whole-pressure-original-review' : 'whole-pressure-greybox-review';
  source.revision = 'pressure-arcs-review-1';
  source.name = 'Whole Journey · readable pursuit and interception review';
  source.missions = source.missions.map((mission) => {
    const arc = pressureArcs[mission.id];
    if (!arc) return mission;
    const priorIntroductions = mission.design.introduces.filter((item) => item !== arc.role);
    const practices = [
      ...mission.design.practices,
      ...priorIntroductions,
      ...(arc.introduce ? [] : [arc.role]),
    ];
    return {
      ...mission,
      revision: 'pressure-arcs-1',
      actors: mission.actors.map((actor) =>
        actor.id === arc.actorId ? { ...actor, role: arc.role } : actor,
      ),
      design: {
        ...mission.design,
        routeDecision: arc.routeDecision,
        lesson: arc.lesson,
        counterplay: arc.counterplay,
        captureConsequence:
          'Closure cancels the committed attack. Field-retaining enemies still determine which regions remain unclaimed, and the existing terrain or patrol consequences remain active.',
        memorableMoment: arc.memorableMoment,
        introduces: arc.introduce ? [arc.role] : [],
        practices: [...new Set(practices)],
        combines: [...new Set([...mission.design.combines, arc.role])],
      },
    };
  });
  for (const item of [...source.campaigns, ...source.packs]) item.revision = source.revision;
  return source;
}
