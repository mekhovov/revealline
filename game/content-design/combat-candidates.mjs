import { createStarterProject } from './starter.mjs';
import { COMBAT_ACTOR_CATALOG, PRESSURE_DIFFICULTY_CATALOG } from './catalogs.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });
const actor = (id, role, x, y, heading) => ({ id, role, tier: 'measured', x, y, heading });
const keeper = (id, x, y, heading) => actor(id, 'field-keeper', x, y, heading);
const studies = [
  {
    id: 'workshop-sweep',
    name: 'Workshop sweep',
    band: 4,
    spawn: [20.5, 0.5],
    coverage: 0.7,
    foundations: [rect(18, 14, 5, 5), rect(46, 20, 6, 3)],
    walls: [rect(30, 8, 3, 12), rect(36, 23, 14, 2)],
    actors: [
      keeper('west-keeper', 8.5, 25.5, [1, -1]),
      keeper('east-keeper', 62.5, 8.5, [-1, 1]),
      actor('bench-scout', 'optional-scout', 19.5, 9.5, [1, 0]),
      actor('pad-scout', 'optional-scout', 45.5, 10.5, [-1, 1]),
    ],
    decision:
      'Approach a scout directly, or close around it while keeping the ordinary keeper on the other side?',
    lesson:
      'Bracketed scouts disappear on contact or capture; circles still damage body and trail and retain field.',
    consequence:
      'Enclosure removes optional scouts but still leaves every keeper-occupied region unclaimed.',
    moment: 'The first removed scout leaves the region logic unchanged.',
    introduces: ['optional-scout'],
    practices: ['foundations', 'enemy-seeded-closure'],
    combines: [],
    mastery: 'Remove one scout by contact and another by capture without losing a life.',
  },
  {
    id: 'sentry-detour',
    name: 'Sentry detour',
    band: 4,
    spawn: [13.5, 16.5],
    coverage: 0.72,
    foundations: [rect(11, 15, 5, 3), rect(32, 25, 8, 3), rect(56, 8, 5, 3)],
    walls: [rect(26, 4, 2, 18), rect(45, 16, 2, 14)],
    actors: [
      keeper('west-keeper', 8.5, 29.5, [1, -1]),
      keeper('east-keeper', 63.5, 18.5, [-1, 1]),
      actor('watch-sentry', 'optional-sentry', 35.5, 10.5, [1, 0]),
    ],
    decision:
      'Use the screened lower approach, or cross near the sentry and change direction after its aim locks?',
    lesson:
      'The sentry stops and locks one observed point; the shot does not track later steering.',
    consequence:
      'Return cancels a warning; capturing or touching the sentry removes it and its existing shot.',
    moment: 'The shot crosses an abandoned route while the craft reaches a different return.',
    introduces: ['optional-sentry'],
    practices: ['optional-scout', 'walls-versus-return-ground'],
    combines: [],
    mastery: 'Evade a fired shot and then capture the sentry without losing a life.',
  },
  {
    id: 'two-bay-service',
    name: 'Two-bay service',
    band: 5,
    spawn: [35.5, 17.5],
    coverage: 0.76,
    foundations: [rect(1, 16, 70, 3), rect(18, 6, 5, 3), rect(49, 26, 5, 3)],
    walls: [rect(39, 3, 2, 9), rect(26, 23, 14, 2)],
    actors: [
      keeper('north-keeper', 17.5, 12.5, [1, -1]),
      keeper('south-keeper', 56.5, 24.5, [1, 1]),
      keeper('north-return-keeper', 60.5, 3.5, [-1, 1]),
      keeper('south-return-keeper', 7.5, 21.5, [1, 1]),
      actor('north-sentry', 'optional-sentry', 49.5, 10.5, [-1, 0]),
      actor('south-scout', 'optional-scout', 13.5, 28.5, [1, -1]),
    ],
    decision:
      'Remove the northern sentry first, or establish a shorter southern return before crossing back?',
    lesson:
      'Threat removal and return-route improvement are different choices; both retained bays still need captures.',
    consequence:
      'Captured actors vanish without holding a bay open; the permanent central deck keeps both approaches available.',
    moment:
      'A return connection changes the next route while a removed sentry no longer pressures it.',
    introduces: [],
    practices: ['optional-sentry', 'optional-scout', 'foundations'],
    combines: ['optional-sentry', 'enemy-seeded-closure'],
    mastery:
      'Remove both optional actors and connect an interior landing in each bay without losing a life.',
  },
];

/** Original interaction greyboxes, not published missions or final visual assets. */
export function createCombatCandidates() {
  const project = createStarterProject('journey-combat-authoring-study');
  const template = project.missions[0];
  project.name = 'Optional robots · unqualified workshop studies';
  project.revision = 'combat-greybox-1';
  project.actorCatalogId = COMBAT_ACTOR_CATALOG.id;
  project.difficultyCatalogId = PRESSURE_DIFFICULTY_CATALOG.id;
  project.maps = studies.map((s) => ({
    format: 'MapDesignV1',
    id: `${s.id}-map`,
    revision: '1',
    name: s.name,
    width: 72,
    height: 36,
    walls: structuredClone(s.walls),
    foundations: structuredClone(s.foundations),
    terrain: [],
    spawns: [{ id: 'home', x: s.spawn[0], y: s.spawn[1] }],
  }));
  project.missions = studies.map((s) => ({
    ...structuredClone(template),
    id: s.id,
    name: s.name,
    revision: project.revision,
    map: { id: `${s.id}-map`, revision: '1' },
    actors: structuredClone(s.actors),
    combat: { version: 'mission-combat.v1', enabled: true },
    coverage: s.coverage,
    presentation: { themeId: 'rover-yard', backgroundAssetId: null },
    design: {
      routeDecision: s.decision,
      lesson: s.lesson,
      counterplay:
        'Use real reclaimed returns and walls as cover. Scouts and sentries are removable; ordinary keepers are not. Preserve a second route before exposing a long trail.',
      captureConsequence: s.consequence,
      memorableMoment: s.moment,
      mastery: s.mastery,
      introduces: [...s.introduces],
      practices: [...s.practices],
      combines: [...s.combines],
      durationSeconds: [45, 120],
      difficulty: {
        band: s.band,
        planning: 4,
        execution: s.band,
        threatDensity: s.id === 'two-bay-service' ? 4 : 3,
        timePressure: 0,
        mechanicLoad: s.id === 'two-bay-service' ? 3 : 2,
        coordination: 0,
      },
    },
  }));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'optional-workshop',
      revision: project.revision,
      name: 'Optional workshop encounters',
      band: 4,
      missionIds: studies.map((s) => s.id),
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'optional-robots',
      revision: project.revision,
      name: 'Optional robots · greybox study',
      campaignIds: ['optional-workshop'],
    },
  ];
  return project;
}
