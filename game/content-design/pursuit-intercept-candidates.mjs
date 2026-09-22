import { createCulturalWorkshopCandidates } from './cultural-workshop-candidates.mjs';
import { PRESSURE_ACTOR_CATALOG } from './catalogs.mjs';

const studies = [
  {
    id: 'stitch-return',
    name: 'Stitch return',
    source: 'cross-stitch-crossings',
    role: 'trail-pursuer',
    introduce: true,
    decision:
      'Close at the nearby landing after a trail warning, or continue toward the far opening?',
    lesson:
      'The pursuer marks a visible point on your unfinished trail, warns, then commits to that point.',
    moment: 'Closing the short route cancels a visibly committed approach.',
    mastery: 'Cancel a committed pursuit by closing without losing a life.',
  },
  {
    id: 'oval-escape',
    name: 'Oval escape',
    source: 'pysanka-sections',
    role: 'trail-pursuer',
    decision:
      'Leave the spindle through the near opening, or put the wall between your trail and the pursuer?',
    lesson: 'Walls block sensing, but cannot close a cut. Keep a real return within reach.',
    moment: 'A segmented wall becomes cover for a different approach.',
    mastery: 'Use both a wall-screened departure and a short closure.',
  },
  {
    id: 'band-pursuit',
    name: 'Band pursuit',
    source: 'rushnyk-bands',
    role: 'trail-pursuer',
    combine: 'perimeter-patrol',
    decision:
      'Wait for the outside patrol, or cross between the inner returns before pursuit reaches the trail?',
    lesson: 'A known outer patrol pressures returns while pursuit pressures the unfinished cut.',
    moment: 'An internal return resolves pursuit without following the outer patrol.',
    mastery: 'Close from each inner return without losing a life.',
  },
  {
    id: 'motor-feint',
    name: 'Motor feint',
    source: 'four-motor-landings',
    role: 'heading-interceptor',
    introduce: true,
    decision:
      'Keep the original heading, or turn toward an adjacent pad after the aim point locks?',
    lesson:
      'Interception predicts only the observed heading; the marked target does not follow your next turn.',
    moment: 'A deliberate turn leaves the committed approach heading toward an empty point.',
    mastery: 'Turn after a lock and close at a different pad without losing a life.',
  },
  {
    id: 'circuit-switch',
    name: 'Circuit switch',
    source: 'circuit-lanes',
    role: 'heading-interceptor',
    decision:
      'Take the obvious straight aisle, or use a work pad to change approach after interception locks?',
    lesson: 'Prepare an alternative return before provoking a locked-heading attack.',
    moment: 'The apparently longer approach becomes useful counterplay.',
    mastery: 'Close on two different work pads after separate warnings.',
  },
  {
    id: 'lens-intercept',
    name: 'Lens intercept',
    source: 'twin-lens-chambers',
    role: 'heading-interceptor',
    combine: 'frontier-patrol',
    decision:
      'Shape the central frontier first, or exit the chamber while interception commits elsewhere?',
    lesson:
      'The frontier patrol follows the boundary; interception follows a previously locked field target.',
    moment: 'One capture cancels interception and redirects a different threat.',
    mastery: 'Cancel interception and make a return from both chambers.',
  },
];

/** Six explicit encounter variants on existing greybox geometry, not six new maps. */
export function createPursuitInterceptCandidates() {
  const source = createCulturalWorkshopCandidates();
  const project = structuredClone(source);
  project.id = 'journey-pursuit-intercept-review';
  project.name = 'Pursuit + interception · unvalidated encounter studies';
  project.revision = 'encounter-study-1';
  project.actorCatalogId = PRESSURE_ACTOR_CATALOG.id;
  project.missions = studies.map((study) => {
    const mission = structuredClone(source.missions.find((m) => m.id === study.source));
    const keepers = mission.actors.filter((a) => a.role === 'field-keeper');
    mission.id = study.id;
    mission.name = study.name;
    mission.revision = 'encounter-study-1';
    mission.actors = [
      { ...keepers[0], role: study.role },
      keepers.at(-1),
      ...(study.combine ? mission.actors.filter((a) => a.role === study.combine) : []),
    ];
    mission.design = {
      ...mission.design,
      routeDecision: study.decision,
      lesson: study.lesson,
      counterplay: PRESSURE_ACTOR_CATALOG.roles[study.role].counterplay,
      captureConsequence:
        'Closure cancels pursuit or interception; field-retaining actors still determine which regions remain unclaimed.',
      memorableMoment: study.moment,
      mastery: study.mastery,
      introduces: study.introduce ? [study.role] : [],
      practices: study.introduce
        ? ['enemy-seeded-closure', 'foundations']
        : [study.role, 'foundations'],
      combines: study.combine ? [study.role, study.combine] : [],
      difficulty: { ...mission.design.difficulty, threatDensity: mission.actors.length - 1 },
    };
    return mission;
  });
  project.maps = project.maps.filter((map) =>
    project.missions.some((mission) => mission.map.id === map.id),
  );
  project.campaigns = ['pursuit', 'interception'].map((id, i) => ({
    format: 'CampaignDesignV1',
    id: `${id}-study`,
    revision: project.revision,
    name: `${i ? 'Interception' : 'Pursuit'} · encounter study`,
    band: 4,
    missionIds: project.missions.slice(i * 3, i * 3 + 3).map((m) => m.id),
  }));
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'readable-pressure-study',
      revision: project.revision,
      name: 'Readable pressure · optional study',
      campaignIds: project.campaigns.map((c) => c.id),
    },
  ];
  return project;
}
