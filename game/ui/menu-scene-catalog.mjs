/** Presentation-only IDs. Scene choice never changes campaign, rules or saves. */
const rows = [['fpv', 'hangar', '#080e18', '#f4c56c', '#83dae7', '68% 50%', '50% 50%', 'drone'],
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
    '61% 50%',
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
  ]];

// Top-left rectangles in the uncropped source image, measured in percentages.
// Effects stay attached to scenery when the image is cropped or the camera moves.
// Water patches deliberately avoid bridge, shoreline and building silhouettes.
const environmentRows = {fpv: [
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
  ]};
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
const indoorActors = new Set(['droneaid-community',
'droneaid-nl-workshop-lights-theme',
'droneaid-nl-parts-in-motion-theme',
'droneaid-nl-makers-together-theme',
'droneaid-nl-careful-handoff-theme',
'droneaid-nl-signals-of-support-theme',
'droneaid-nl-shared-horizon-theme']);

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
          environment: environments[id],
          portraitEnvironment: id === 'fpv' ? fpvPortraitEnvironment : environments[id],
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

const EDITION_SCENES = Object.freeze({'droneaid-community': 'droneaid-community',
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
  )});

export function resolveMenuScene({ themeId, editionId } = {}) {
  if (Object.hasOwn(MENU_SCENES, themeId)) return MENU_SCENES[themeId];
  const edition = Object.hasOwn(EDITION_SCENES, editionId) ? EDITION_SCENES[editionId] : null;
  return (edition && MENU_SCENES[edition]) || MENU_SCENES.fpv;
}

export function menuSceneMode(mode) {
  return ['solo', 'versus', 'team'].includes(mode) ? mode : 'solo';
}
