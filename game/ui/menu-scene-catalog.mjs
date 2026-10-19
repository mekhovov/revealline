/** Presentation-only IDs. Scene choice never changes campaign, rules or saves. */
const rows = [
  ['fpv', 'hangar', '#080e18', '#f4c56c', '#83dae7', '68% 50%', '50% 50%', 'drone'],
  ['ukraine', 'meadow', '#0b1730', '#ffd876', '#83c4ed', '68% 50%', '71% 50%', 'bird'],
  ['retro', 'rain', '#080e26', '#ffcd80', '#80dcf2', '68% 50%', '68% 50%', 'reflection'],
  ['droneaid-community', 'relay', '#152b39', '#f0c777', '#94d1cd', '64% 50%', '67% 50%', 'drone'],
  [
    'droneaid-nl-community',
    'workshop',
    '#0a0c0e',
    '#ffd601',
    '#5b81fd',
    '50% 48%',
    '90% 50%',
    'drone',
  ],
  [
    'droneaid-nl-workshop-lights-theme',
    'lamplight',
    '#242436',
    '#ffc66c',
    '#a9c0ed',
    '62% 50%',
    '68% 50%',
    'drone',
  ],
  [
    'droneaid-nl-parts-in-motion-theme',
    'parts',
    '#152d3a',
    '#f0b887',
    '#8eded7',
    '63% 50%',
    '10% 50%',
    'parcel',
  ],
  [
    'droneaid-nl-makers-together-theme',
    'makers',
    '#183832',
    '#e5d78a',
    '#a0e0c6',
    '62% 50%',
    '59% 50%',
    'drone',
  ],
  [
    'droneaid-nl-careful-handoff-theme',
    'handoff',
    '#1c3047',
    '#edc285',
    '#a7d4e9',
    '65% 50%',
    '64% 50%',
    'parcel',
  ],
  [
    'droneaid-nl-signals-of-support-theme',
    'signal',
    '#162642',
    '#dfb5f2',
    '#80dbef',
    '64% 50%',
    '66% 50%',
    'signal',
  ],
  [
    'droneaid-nl-shared-horizon-theme',
    'horizon',
    '#162f42',
    '#ffd58b',
    '#9ccfef',
    '65% 50%',
    '66% 50%',
    'bird',
  ],
];

// The capture route is composed against each artwork instead of floating at a
// single global position. Values are percentages of the visible menu frame;
// the route stays in the quieter half of the image and outside the menu copy.
const routeRows = {
  fpv: ['rise', 48, 5, 48, 0.5, 27, 3, 72],
  ukraine: ['horizon', 47, 4, 50, 0.48, 24, 2, 75],
  retro: ['circuit', 50, 8, 47, 0.58, 30, 4, 68],
  'droneaid-community': ['bridge', 49, 6, 48, 0.46, 28, 4, 70],
  'droneaid-nl-community': ['horizon', 49, 5, 49, 0.5, 28, 3, 71],
  'droneaid-nl-workshop-lights-theme': ['rise', 50, 5, 47, 0.52, 29, 3, 69],
  'droneaid-nl-parts-in-motion-theme': ['circuit', 49, 6, 48, 0.52, 28, 4, 70],
  'droneaid-nl-makers-together-theme': ['bridge', 48, 5, 49, 0.48, 27, 3, 71],
  'droneaid-nl-careful-handoff-theme': ['horizon', 49, 6, 48, 0.5, 28, 4, 70],
  'droneaid-nl-signals-of-support-theme': ['circuit', 48, 4, 50, 0.58, 27, 3, 72],
  'droneaid-nl-shared-horizon-theme': ['horizon', 47, 4, 51, 0.48, 26, 2, 73],
};
const routes = Object.fromEntries(
  Object.entries(routeRows).map(
    ([id, [variant, left, top, width, opacity, portraitLeft, portraitTop, portraitWidth]]) => [
      id,
      Object.freeze({
        variant,
        left,
        top,
        width,
        opacity,
        portraitLeft,
        portraitTop,
        portraitWidth,
      }),
    ],
  ),
);

// Top-left rectangles in the uncropped source image, measured in percentages.
// Effects stay attached to scenery when the image is cropped or the camera moves.
// Water patches deliberately avoid bridge, shoreline and building silhouettes.
const environmentRows = {
  fpv: [
    ['cloud', 63, 9, 28, 12, -4, 16],
    ['beam', 68, 27, 29, 34, -2, 8],
    ['lamp', 41, 24, 5, 4, -1, 4.8],
    ['foliage', 61, 35, 28, 20, -2, 7],
  ],
  ukraine: [
    ['cloud', 48, 7, 44, 17, -6, 18],
    ['water', 72, 67, 12, 4, -2, 5.2],
    ['beam', 74, 28, 21, 35, -3, 9],
  ],
  retro: [
    ['water', 58, 86, 21, 8, -1.2, 4.8],
    ['lamp', 68, 29, 6, 7, -1, 4.2],
    ['lamp', 94, 20, 5, 10, -3, 5.6],
  ],
  'droneaid-community': [
    ['lamp', 46, 5, 5, 12, -1, 5.2],
    ['lamp', 57, 19, 5, 10, -2.4, 6],
    ['steam', 58, 61, 4, 13, -1.6, 5.8],
  ],
  'droneaid-nl-community': [],
  'droneaid-nl-workshop-lights-theme': [
    ['beam', 8, 9, 34, 53, -2, 8],
    ['lamp', 93, 0, 7, 12, -1, 5.2],
  ],
  'droneaid-nl-parts-in-motion-theme': [
    ['lamp', 4, 12, 10, 18, -1, 5.6],
    ['beam', 22, 4, 24, 38, -3, 8],
  ],
  'droneaid-nl-makers-together-theme': [
    ['lamp', 77, 0, 13, 13, -2, 5.2],
    ['beam', 7, 0, 34, 40, -3, 8.6],
  ],
  'droneaid-nl-careful-handoff-theme': [
    ['lamp', 55, 0, 10, 12, -1, 5.6],
    ['beam', 4, 4, 29, 39, -2, 8],
  ],
  'droneaid-nl-signals-of-support-theme': [
    ['lamp', 19, 0, 10, 14, -1.6, 5.2],
    ['beam', 1, 4, 27, 37, -3, 8.4],
  ],
  'droneaid-nl-shared-horizon-theme': [
    ['lamp', 85, 6, 14, 19, -2, 5.4],
    ['beam', 2, 13, 23, 45, -3, 8.6],
  ],
};
const freezeEnvironment = (values) =>
  Object.freeze(
    values.map(([kind, x, y, width, height, delay, duration]) =>
      Object.freeze({ kind, x, y, width, height, delay, duration }),
    ),
  );
const environments = Object.fromEntries(
  Object.entries(environmentRows).map(([id, values]) => [id, freezeEnvironment(values)]),
);
const fpvPortraitEnvironment = freezeEnvironment([
  ['cloud', 78, 44, 21, 5, -4, 16],
  ['beam', 80, 52, 19, 17, -2, 8],
  ['lamp', 5, 49, 12, 3, -1, 4.8],
  ['foliage', 79, 58, 12, 10, -2, 7],
]);
// These narrow crops keep the drones/workbenches as their focal subjects, but
// exclude the large windows and desk lamps at the edges of the full picture.
// Measure alternate regions on the scenery that is actually visible: the rear
// pendant, sunlit work surfaces/walls, and the makers' trailing plant. Parts is
// reframed toward its lamp, window and assembled drone instead of the empty mat.
// Lighting changes brightness only; it must not bend drones, tools or their geometry.
const portraitEnvironments = Object.fromEntries(
  Object.entries({
    'droneaid-nl-workshop-lights-theme': [
      ['lamp', 60, 0, 5, 8, -1, 5.2],
      ['beam', 53, 27, 20, 10, -2, 8],
    ],
    'droneaid-nl-parts-in-motion-theme': [
      ['lamp', 4, 12, 10, 18, -1, 5.6],
      ['beam', 22, 4, 24, 38, -2, 8],
    ],
    'droneaid-nl-makers-together-theme': [
      ['foliage', 48, 7, 8, 26, -2, 7],
      ['beam', 46, 41, 18, 12, -3, 8.6],
    ],
    'droneaid-nl-signals-of-support-theme': [['beam', 51, 22, 20, 18, -3, 8.4]],
    'droneaid-nl-shared-horizon-theme': [['beam', 54, 26, 17, 14, -3, 8.6]],
  }).map(([id, values]) => [id, freezeEnvironment(values)]),
);
const indoorActors = new Set([
  'droneaid-community',
  'droneaid-nl-workshop-lights-theme',
  'droneaid-nl-parts-in-motion-theme',
  'droneaid-nl-makers-together-theme',
  'droneaid-nl-careful-handoff-theme',
  'droneaid-nl-signals-of-support-theme',
  'droneaid-nl-shared-horizon-theme',
]);

// Mode artwork belongs to its existing world; it is not a theme, campaign or
// capability. Selected Solo editions project this map to an empty object.
export const MENU_SCENE_COMPOSITIONS = Object.freeze({
  fpv: Object.freeze({
    versus: Object.freeze({
      composition: 'fpv-versus',
      landscape: './art/menu-scenes/fpv-versus.webp',
      portrait: './art/menu-scenes/fpv-versus-portrait.webp',
      landscapePosition: '70% 50%',
      portraitPosition: '50% 50%',
      environment: freezeEnvironment([
        ['cloud', 64, 8, 28, 16, -4, 16],
        ['lamp', 51, 15, 7, 5, -1, 4.8],
        ['foliage', 82, 3, 16, 17, -2, 7],
        ['beam', 74, 46, 18, 9, -2, 8],
      ]),
      portraitEnvironment: freezeEnvironment([
        ['cloud', 75, 35, 21, 10, -4, 16],
        ['lamp', 11, 39, 10, 3, -1, 4.8],
        ['foliage', 84, 31, 14, 9, -2, 7],
        ['beam', 64, 65, 21, 7, -2, 8],
      ]),
    }),
    team: Object.freeze({
      composition: 'fpv-team',
      landscape: './art/menu-scenes/fpv-team.webp',
      portrait: './art/menu-scenes/fpv-team-portrait.webp',
      landscapePosition: '70% 50%',
      portraitPosition: '50% 50%',
      environment: freezeEnvironment([
        ['cloud', 68, 10, 24, 15, -4, 16],
        ['lamp', 38, 20, 7, 4, -1, 4.8],
        ['foliage', 82, 3, 15, 18, -2, 7],
        ['beam', 58, 49, 12, 10, -2, 8],
      ]),
      portraitEnvironment: freezeEnvironment([
        ['cloud', 82, 37, 15, 10, -4, 16],
        ['lamp', 4, 43, 11, 3, -1, 4.8],
        ['foliage', 77, 32, 11, 12, -2, 7],
        ['beam', 60, 63, 13, 6, -2, 8],
      ]),
    }),
  }),
  ukraine: Object.freeze({
    versus: Object.freeze({
      composition: 'ukraine-versus',
      landscape: './art/menu-scenes/ukraine-versus.webp',
      portrait: './art/menu-scenes/ukraine-versus-portrait.webp',
      landscapePosition: '70% 50%',
      portraitPosition: '50% 50%',
      environment: freezeEnvironment([
        ['cloud', 64, 3, 33, 18, -4, 16],
        ['lamp', 40, 19, 5, 13, -1, 4.8],
        ['water', 87, 66, 9, 4, -2, 5.2],
        ['foliage', 34, 34, 7, 20, -2, 7],
      ]),
      portraitEnvironment: freezeEnvironment([
        ['cloud', 67, 20, 30, 9, -4, 16],
        ['lamp', 38, 33, 6, 4, -1, 4.8],
        ['water', 55, 60, 10, 4, -2, 5.2],
        ['foliage', 28, 43, 8, 8, -2, 7],
      ]),
    }),
    team: Object.freeze({
      composition: 'ukraine-team',
      landscape: './art/menu-scenes/ukraine-team.webp',
      portrait: './art/menu-scenes/ukraine-team-portrait.webp',
      landscapePosition: '70% 50%',
      portraitPosition: '50% 50%',
      environment: freezeEnvironment([
        ['cloud', 68, 3, 29, 17, -4, 16],
        ['lamp', 39, 24, 4, 8, -1, 4.8],
        ['water', 79, 68, 12, 5, -2, 5.2],
        ['foliage', 28, 31, 7, 20, -2, 7],
      ]),
      portraitEnvironment: freezeEnvironment([
        ['cloud', 68, 14, 29, 10, -4, 16],
        ['lamp', 26, 28, 7, 7, -1, 4.8],
        ['water', 82, 60, 12, 4, -2, 5.2],
        ['foliage', 24, 40, 10, 11, -2, 7],
      ]),
    }),
  }),
  retro: Object.freeze({
    versus: Object.freeze({
      composition: 'retro-versus',
      landscape: './art/menu-scenes/retro-versus.webp',
      portrait: './art/menu-scenes/retro-versus-portrait.webp',
      landscapePosition: '70% 50%',
      portraitPosition: '50% 50%',
      environment: freezeEnvironment([
        ['water', 64, 88, 20, 8, -1.2, 4.8],
        ['lamp', 61, 27, 5, 7, -1, 4.2],
        ['lamp', 68, 19, 14, 4, -3, 5.6],
        ['foliage', 44, 45, 5, 16, -2, 7],
      ]),
      portraitEnvironment: freezeEnvironment([
        ['water', 54, 84, 26, 9, -1.2, 4.8],
        ['lamp', 61, 31, 7, 4, -1, 4.2],
        ['lamp', 73, 33, 6, 5, -3, 5.6],
        ['foliage', 31, 42, 11, 12, -2, 7],
      ]),
    }),
    team: Object.freeze({
      composition: 'retro-team',
      landscape: './art/menu-scenes/retro-team.webp',
      portrait: './art/menu-scenes/retro-team-portrait.webp',
      landscapePosition: '70% 50%',
      portraitPosition: '50% 50%',
      environment: freezeEnvironment([
        ['water', 67, 87, 20, 9, -1.2, 4.8],
        ['lamp', 61, 27, 5, 7, -1, 4.2],
        ['lamp', 68, 19, 14, 4, -3, 5.6],
        ['foliage', 44, 45, 5, 17, -2, 7],
      ]),
      portraitEnvironment: freezeEnvironment([
        ['water', 55, 82, 24, 11, -1.2, 4.8],
        ['lamp', 63, 29, 6, 4, -1, 4.2],
        ['lamp', 70, 31, 6, 5, -3, 5.6],
        ['foliage', 44, 44, 9, 10, -2, 7],
      ]),
    }),
  }),
});
const compositionProfiles = new WeakMap();

export const MENU_SCENES = Object.freeze(
  Object.fromEntries(
    rows.map(
      ([id, atmosphere, ink, light, accent, landscapePosition, portraitPosition, actor], index) => [
        id,
        Object.freeze({
          id,
          atmosphere,
          ink,
          light,
          accent,
          landscapePosition,
          portraitPosition,
          actor,
          actorVisible: !indoorActors.has(id),
          route: routes[id],
          environment: environments[id],
          portraitEnvironment:
            id === 'fpv' ? fpvPortraitEnvironment : (portraitEnvironments[id] ?? environments[id]),
          landscape:
            id === 'droneaid-nl-community'
              ? './art/menu-scenes/droneaid-main-background.webp'
              : `./art/menu-scenes/${id}.webp`,
          portrait:
            id === 'droneaid-nl-community'
              ? './art/menu-scenes/droneaid-main-background.webp'
              : `./art/menu-scenes/${id === 'fpv' ? 'fpv-portrait' : id}.webp`,
          ...(id === 'droneaid-nl-community'
            ? { wordmark: './art/menu-scenes/droneaid-wordmark-light.svg' }
            : {}),
          duration: 24 + (index % 7) * 3,
          particleCount: 6 + (index % 3),
          signalOpacity:
            id.startsWith('droneaid') ||
            ['hangar', 'rain', 'network', 'signal', 'relay'].includes(atmosphere)
              ? 0.05
              : 0.03,
          signalPeakOpacity:
            id.startsWith('droneaid') ||
            ['hangar', 'rain', 'network', 'signal', 'relay'].includes(atmosphere)
              ? 0.12
              : 0.06,
        }),
      ],
    ),
  ),
);

const EDITION_SCENES = Object.freeze({
  'droneaid-community': 'droneaid-community',
  'droneaid-nl-community': 'droneaid-nl-community',
  ...Object.fromEntries(
    [
      'workshop-lights',
      'parts-in-motion',
      'makers-together',
      'careful-handoff',
      'signals-of-support',
      'shared-horizon',
    ].map((id) => [`droneaid-nl-${id}`, `droneaid-nl-${id}-theme`]),
  ),
});

export function resolveMenuScene({ themeId, editionId, mode } = {}) {
  const edition = Object.hasOwn(EDITION_SCENES, editionId) ? EDITION_SCENES[editionId] : null;
  const profile = Object.hasOwn(MENU_SCENES, themeId)
    ? MENU_SCENES[themeId]
    : (edition && MENU_SCENES[edition]) || MENU_SCENES.fpv;
  // Editions support Solo only. Worlds without authored mode artwork retain
  // their base composition; an unknown world uses the approved FPV fallback.
  const composition = !editionId && MENU_SCENE_COMPOSITIONS[profile.id]?.[menuSceneMode(mode)];
  if (!composition) return profile;
  if (!compositionProfiles.has(composition))
    compositionProfiles.set(composition, Object.freeze({ ...profile, ...composition }));
  return compositionProfiles.get(composition);
}

export function menuSceneMode(mode) {
  return ['solo', 'versus', 'team'].includes(mode) ? mode : 'solo';
}
