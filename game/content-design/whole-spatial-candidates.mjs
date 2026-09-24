import { freezeDesign, TRAIL_IMPACT_JOURNEY_POLICY } from './catalogs.mjs';
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
