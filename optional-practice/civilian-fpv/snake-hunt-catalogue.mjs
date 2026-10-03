import { dataIdentity } from '../../game/data-json.mjs';
import { EXPRESSIVE_HUNT_CHAPTERS, EXPRESSIVE_HUNT_COURSES } from './expressive-hunt-courses.mjs';

const text = (en, uk) => ({ en, uk });
const point = ([x, z, y = 0]) => ({
  x: Math.round(x * 1000),
  y: Math.round(y * 1000),
  z: Math.round(z * 1000),
});
const box = (id, x, z, w, d, h) => ({
  id,
  min: point([x - w / 2, z - d / 2]),
  max: point([x + w / 2, z + d / 2, h]),
});
const chapters = [
  {
    id: 'loops',
    title: text('Snake Hunt · Open loops', 'Змійка-полювання · Відкриті петлі'),
    environment: 'stadium',
    style: 'stadium',
    rows: [
      [
        'First three',
        'Перші троє',
        [
          [0, 12],
          [-10, 0],
          [10, -10],
        ],
        false,
        0,
      ],
      [
        'Clockwise catch',
        'За годинниковою стрілкою',
        [
          [-12, 12],
          [-16, -4],
          [0, -16],
          [16, -4],
          [12, 12],
        ],
        true,
        2,
      ],
      [
        'Wide figure eight',
        'Широка вісімка',
        [
          [-14, 8],
          [-18, -8],
          [-4, -14],
          [8, 0],
          [18, -12],
          [20, 8],
        ],
        true,
        2,
      ],
      [
        'Choose your loop',
        'Обери свою петлю',
        [
          [-20, 8],
          [-12, -12],
          [4, -20],
          [20, -6],
          [18, 14],
          [0, 8],
        ],
        false,
        3,
      ],
      [
        'Spiral inward',
        'Спіраль усередину',
        [
          [-22, 14],
          [-24, -16],
          [20, -22],
          [24, 12],
          [6, 18],
          [-10, 4],
          [0, -8],
        ],
        true,
        3,
      ],
      [
        'Double circuit',
        'Подвійне коло',
        [
          [-20, 16],
          [-24, 0],
          [-16, -20],
          [8, -24],
          [24, -12],
          [20, 12],
          [4, 16],
          [-6, -2],
        ],
        true,
        4,
      ],
    ],
  },
  {
    id: 'weave',
    title: text('Snake Hunt · Weave and return', 'Змійка-полювання · Слалом і повернення'),
    environment: 'warehouse',
    style: 'warehouse',
    rows: [
      [
        'Three aisles',
        'Три проходи',
        [
          [-16, 12],
          [0, -4],
          [16, -18],
        ],
        true,
        2,
      ],
      [
        'Alternating doors',
        'Почергові проходи',
        [
          [-18, 14],
          [18, 4],
          [-18, -8],
          [18, -20],
        ],
        true,
        3,
      ],
      [
        'Outside the pillars',
        'Навколо колон',
        [
          [-22, 8],
          [-22, -16],
          [0, -24],
          [22, -16],
          [22, 8],
        ],
        false,
        3,
      ],
      [
        'Long switchback',
        'Довгий зигзаг',
        [
          [-22, 18],
          [-22, -20],
          [-10, -20],
          [-10, 12],
          [12, 12],
          [12, -20],
        ],
        true,
        3,
      ],
      [
        'Diagonal threading',
        'Діагональний слалом',
        [
          [-20, 16],
          [16, -4],
          [-16, -20],
          [20, -24],
          [24, 10],
          [0, 16],
        ],
        true,
        4,
      ],
      [
        'Exit the coil',
        'Вихід зі спіралі',
        [
          [-24, 16],
          [-24, -24],
          [24, -24],
          [24, 16],
          [12, 8],
          [-12, 8],
          [-12, -12],
          [12, -12],
        ],
        true,
        4,
      ],
    ],
  },
  {
    id: 'heights',
    title: text('Snake Hunt · Height changes', 'Змійка-полювання · Зміна висоти'),
    environment: 'garage',
    style: 'garage',
    rows: [
      [
        'Low, high, low',
        'Низько, високо, низько',
        [
          [-14, 10],
          [0, -6, 2],
          [16, -16],
        ],
        true,
        2,
      ],
      [
        'Ascending arc',
        'Висхідна дуга',
        [
          [-20, 8],
          [-14, -8, 1.5],
          [0, -18, 3],
          [18, -8, 4.5],
        ],
        true,
        3,
      ],
      [
        'Roof islands',
        'Острови дахів',
        [
          [-20, 10, 2],
          [-20, -16, 4],
          [0, -20, 2],
          [20, -12, 4],
          [20, 12, 2],
        ],
        false,
        3,
      ],
      [
        'Over your echo',
        'Над власним слідом',
        [
          [-18, 12],
          [-18, -12],
          [18, -12, 2],
          [18, 12, 4],
          [-8, 8, 4],
          [-8, -18, 2],
        ],
        true,
        4,
      ],
      [
        'Descending staircase',
        'Сходами вниз',
        [
          [-22, 8, 5],
          [-18, -14, 4],
          [0, -24, 3],
          [20, -14, 2],
          [22, 10, 1],
          [4, 14],
        ],
        true,
        4,
      ],
      [
        'Stacked figure eight',
        'Вісімка на різних висотах',
        [
          [-20, 12],
          [-22, -14, 2],
          [-4, -18, 4],
          [8, 0, 4],
          [22, -18, 2],
          [24, 12],
          [4, 16, 2],
          [-8, 0, 4],
        ],
        true,
        4,
      ],
    ],
  },
  {
    id: 'chase',
    title: text('Snake Hunt · Moving quarry', 'Змійка-полювання · Рухливі цілі'),
    environment: 'container-yard',
    style: 'industrial',
    rows: [
      [
        'Meet the walkers',
        'Назустріч рухливим цілям',
        [
          [-16, 10],
          [0, -6],
          [16, -18],
        ],
        false,
        2,
      ],
      [
        'Crossing patrols',
        'Перехресні патрулі',
        [
          [-20, 10],
          [-10, -12],
          [10, 6],
          [22, -18],
        ],
        true,
        3,
      ],
      [
        'Chase the corners',
        'Полювання по кутах',
        [
          [-22, 14],
          [-22, -20],
          [22, -20],
          [22, 14],
          [0, -4],
        ],
        false,
        3,
      ],
      [
        'Moving slalom',
        'Рухливий слалом',
        [
          [-22, 14],
          [18, 4],
          [-18, -8],
          [22, -20],
          [-8, -24],
          [0, 14],
        ],
        true,
        4,
      ],
      [
        'One-way collection',
        'Збір в одному напрямку',
        [
          [-24, 16],
          [-24, -8],
          [-12, -24],
          [8, -24],
          [24, -8],
          [24, 16],
          [4, 8],
        ],
        true,
        4,
      ],
      [
        'The long hunt',
        'Довге полювання',
        [
          [-24, 16],
          [-24, -20],
          [-8, -26],
          [12, -24],
          [26, -12],
          [26, 12],
          [10, 18],
          [-8, 10],
          [-12, -4],
          [10, -8],
        ],
        true,
        5,
      ],
    ],
  },
];

function courseFor(chapter, row, index) {
  const [en, uk, route, ordered, growth] = row;
  const moving = chapter.id === 'chase';
  const obstacles =
    chapter.id === 'weave'
      ? [
          box('centre-pillar', 0, -14, 3, 4, 4),
          box('west-pillar', -7, -6, 3, 3, 3),
          box('east-pillar', 7, -6, 3, 3, 5),
        ]
      : chapter.id === 'chase'
        ? [box('centre-block', 0, -16, 5, 4, 3), box('east-block', 12, 16, 4, 3, 4)]
        : [];
  route.forEach(([x, z, y = 0], i) => {
    if (y > 0) obstacles.push(box(`target-platform-${i + 1}`, x, z, 5, 5, y));
  });
  const actors = route.map((position, i) => ({
    id: `humanoid-${String(i + 1).padStart(2, '0')}`,
    type: 'patrol',
    role: 'hostile',
    position: point(position),
    path: moving
      ? [point([position[0] - 2, position[1]]), point([position[0] + 2, position[1]])]
      : [],
    speed: moving ? 600 + index * 80 : 0,
    radius: 420,
    height: 2000,
    health: 50,
    fireEveryTicks: 0,
    damage: 0,
  }));
  const criterion = {
    type: 'hunt-contact-v1',
    targets: actors.map((actor) => actor.id),
    ordered,
    tail: { linksPerCatch: growth, maxLinks: growth ? 64 : 0, neckDistance: 4500, radius: 350 },
  };
  return {
    format: 'FlightCourse.v2',
    id: `snake-hunt-${chapter.id}-${String(index + 1).padStart(2, '0')}`,
    revision: 'r1',
    environment: chapter.environment,
    locales: {
      en: {
        title: en,
        brief: `Catch ${route.length} fictional humanoid targets by touching them${ordered ? ' in numbered order' : ' in any order'}. ${growth ? 'Each catch lengthens a solid echo of your flown path. Avoid the glowing tail; fly above or around it.' : 'This first course has no echo tail.'}`,
        lesson:
          'Use the usual manual throttle and flight controls. Aim for the marked torso around one metre above its platform. Pulses do not count. Wrong-order targets remain available. Blood is an optional visual setting.',
      },
      uk: {
        title: uk,
        brief: `Спіймайте ${route.length} вигаданих гуманоїдів дотиком${ordered ? ' у порядку номерів' : ' у довільному порядку'}. ${growth ? 'Кожен дотик подовжує твердий слід пройденого шляху. Оминайте світлий хвіст або пролітайте над ним.' : 'У першій вправі хвоста немає.'}`,
        lesson:
          'Керуйте звичайною ручною тягою та нахилом. Цільтеся в позначений тулуб приблизно за метр над платформою. Імпульси не зараховуються. Цілі, яких торкнулися поза чергою, залишаються. Кров — необов’язковий візуальний ефект.',
      },
    },
    spawn: point([0, 26]),
    bounds: { min: point([-34, -34]), max: point([34, 34, 18]) },
    obstacles,
    actors,
    steps: { 'self-level': [criterion], acro: [structuredClone(criterion)] },
    world: { id: chapter.environment, theme: 'pixel', style: chapter.style },
    rules: {
      seed: 9000 + chapters.indexOf(chapter) * 10 + index,
      maxTicks: 36000,
      collisionDamage: 0,
    },
    conditions: { profile: 'clear', revision: 'r1' },
  };
}

// New patrol courses have a separate pack identity. The original twenty-four
// recipe bytes and their retained playlist/progress references stay unchanged.
const pursuitChapters = [
  {
    id: 'interception',
    title: text('Snake Hunt · Patrol interception', 'Змійка-полювання · Перехоплення патрулів'),
  },
  {
    id: 'route-choices',
    title: text('Snake Hunt · Flight route choices', 'Змійка-полювання · Вибір льотного маршруту'),
  },
];
const pursuitRows = [
  [
    'loop-intercept',
    'Loop intercept',
    'Перехоплення на колі',
    'A broad patrol loop surrounds a low island. Fly across the open interior to meet a target.',
    'Широкий маршрут патруля оточує низький острів. Летіть через відкритий простір назустріч цілі.',
    'stadium',
    3,
    700,
    2,
    [
      [-14, 10],
      [-14, -12],
      [14, -12],
      [14, 10],
    ],
    [[0, 0, 8, 8, 3]],
  ],
  [
    'two-return-lanes',
    'Two return lanes',
    'Два шляхи повернення',
    'Two patrol loops flank a divider. Pass its end or climb above it before returning.',
    'Дві петлі патрулів проходять обабіч перегородки. Обігніть її кінець або підніміться над нею перед поверненням.',
    'warehouse',
    4,
    800,
    2,
    [
      [-18, 10],
      [-18, -16],
      [-6, -16],
      [-6, 10],
    ],
    [[0, -2, 3, 22, 4]],
    [
      [6, 10],
      [6, -16],
      [18, -16],
      [18, 10],
    ],
  ],
  [
    'corner-approach',
    'Corner approach',
    'Підхід за ріг',
    'The L-shaped barrier rewards approaching the next straight instead of following the target.',
    'Г-подібна перегородка заохочує зайти на наступну пряму, замість летіти за ціллю.',
    'warehouse',
    3,
    900,
    3,
    [
      [-12, 12],
      [-12, -16],
      [14, -16],
      [14, 12],
    ],
    [
      [-3, -2, 3, 16, 4],
      [4, 5, 12, 3, 4],
    ],
  ],
  [
    'crossing-patrols',
    'Crossing patrols',
    'Перехресні патрулі',
    'Horizontal and vertical patrol routes cross in open space. Choose an approach with a clear exit.',
    'Горизонтальні й вертикальні маршрути перетинаються у відкритому просторі. Оберіть підхід із вільним виходом.',
    'stadium',
    4,
    1000,
    3,
    [
      [-22, -3],
      [22, -3],
      [22, 3],
      [-22, 3],
    ],
    [
      [-14, -14, 4, 4, 3],
      [14, 14, 4, 4, 3],
      [-14, 14, 4, 4, 3],
      [14, -14, 4, 4, 3],
    ],
    [
      [-3, -22],
      [3, -22],
      [3, 20],
      [-3, 20],
    ],
  ],
  [
    'island-bypass',
    'Island bypass',
    'Обхід острова',
    'An asymmetric island and side block divide short and long approaches to the patrol.',
    'Несиметричний острів і бічний блок розділяють короткі та довгі підходи до патруля.',
    'garage',
    4,
    1100,
    3,
    [
      [-14, -8],
      [14, -8],
      [14, 10],
      [-14, 10],
    ],
    [
      [0, 0, 10, 8, 4],
      [-20, -14, 4, 6, 3],
    ],
  ],
  [
    'staggered-interception',
    'Staggered interception',
    'Перехоплення між укриттями',
    'A winding patrol passes alternating obstacles. Cut across a clear height instead of copying every ground turn.',
    'Звивистий патруль минає почергові перешкоди. Перетинайте вільну висоту, замість повторювати кожен наземний поворот.',
    'warehouse',
    5,
    1200,
    4,
    [
      [-24, 16],
      [-24, -18],
      [-4, -18],
      [-4, 16],
      [6, 16],
      [6, -18],
      [24, -18],
      [24, 16],
    ],
    [
      [-12, -8, 4, 8, 3],
      [0, 8, 4, 8, 4],
      [12, -8, 4, 8, 5],
    ],
  ],
  [
    'warehouse-return',
    'Warehouse return',
    'Повернення через склад',
    'Long aisles connect at both ends. Plan a return around your solid flown tail.',
    'Довгі проходи сполучаються з обох кінців. Плануйте повернення навколо твердого сліду польоту.',
    'warehouse',
    4,
    1000,
    3,
    [
      [-24, 16],
      [-24, -16],
      [0, -16],
      [0, 16],
      [24, 16],
      [24, -16],
      [-24, -16],
    ],
    [
      [-12, 0, 3, 22, 5],
      [12, 0, 3, 22, 5],
    ],
  ],
  [
    'courtyard-approaches',
    'Courtyard approaches',
    'Підходи до двору',
    'Three blocks define a courtyard with several approaches. The patrol stays on a continuous ground loop.',
    'Три блоки утворюють двір із кількома підходами. Патруль рухається безперервною наземною петлею.',
    'stadium',
    4,
    1100,
    3,
    [
      [-22, 16],
      [-22, -20],
      [22, -20],
      [22, 16],
    ],
    [
      [-10, -4, 5, 15, 4],
      [10, -4, 5, 15, 4],
      [0, 10, 8, 4, 3],
    ],
  ],
  [
    'platform-perimeter',
    'Platform perimeter',
    'Периметр платформи',
    'Patrols circle a broad platform. Use height to cross the middle, then descend toward the marked torso.',
    'Патрулі обходять широку платформу. Перелітайте середину на висоті, потім знижуйтеся до позначеного тулуба.',
    'garage',
    4,
    1200,
    4,
    [
      [-18, -14],
      [18, -14],
      [18, 14],
      [-18, 14],
    ],
    [
      [0, 0, 20, 14, 3],
      [23, -20, 4, 4, 5],
    ],
  ],
  [
    'boundary-cutback',
    'Boundary cutback',
    'Зворотний шлях біля межі',
    'A tall offset barrier separates the two ground return lanes. Stay inside the flight bounds when circling it.',
    'Висока зміщена перегородка розділяє два наземні шляхи повернення. Облітаючи її, залишайтеся в межах польоту.',
    'warehouse',
    4,
    1200,
    4,
    [
      [-20, 16],
      [-20, -22],
      [8, -22],
      [8, 16],
    ],
    [
      [-6, -2, 4, 24, 6],
      [21, 9, 4, 14, 4],
    ],
    [
      [13, 18],
      [13, -18],
      [27, -18],
      [27, 18],
    ],
  ],
  [
    'cross-route-choice',
    'Cross-route choice',
    'Вибір перехресного шляху',
    'Two figure-eight loops offer different interception angles. Keep the centre free for the next pass.',
    'Дві вісімки пропонують різні кути перехоплення. Залишайте центр вільним для наступного проходу.',
    'stadium',
    5,
    1300,
    4,
    [
      [0, 0],
      [-24, 0],
      [-24, -20],
      [0, -20],
      [0, 0],
      [24, 0],
      [24, 18],
      [0, 18],
    ],
    [
      [-12, -10, 5, 5, 4],
      [12, 10, 5, 5, 4],
      [-12, 12, 4, 4, 3],
      [14, -14, 4, 4, 3],
    ],
  ],
  [
    'airfield-circuit',
    'Airfield circuit',
    'Коло аеродрому',
    'Three patrol corridors share open ends. Combine direct interceptions with height changes around a longer tail.',
    'Три коридори патрулів мають спільні відкриті кінці. Поєднуйте прямі перехоплення зі зміною висоти навколо довшого хвоста.',
    'garage',
    6,
    1400,
    5,
    [
      [-26, 18],
      [-26, -22],
      [-2, -22],
      [-2, 18],
      [24, 18],
      [24, -22],
      [-26, -22],
    ],
    [
      [-14, -2, 4, 26, 5],
      [11, -2, 4, 26, 6],
      [29, 3, 3, 12, 4],
    ],
  ],
];
function pursuitCourseFor(row, index) {
  const [
    slug,
    en,
    uk,
    enBrief,
    ukBrief,
    environment,
    count,
    speed,
    growth,
    firstRoute,
    boxes,
    secondRoute,
  ] = row;
  const actors = Array.from({ length: count }, (_, actorIndex) => {
    const route = actorIndex % 2 && secondRoute ? secondRoute : firstRoute;
    const offset = Math.floor((actorIndex * route.length) / count) % route.length;
    const path = [...route.slice(offset), ...route.slice(0, offset)].map(point);
    return {
      id: `humanoid-${String(actorIndex + 1).padStart(2, '0')}`,
      type: 'patrol',
      role: 'hostile',
      position: { ...path[0] },
      path,
      speed,
      radius: 420,
      height: 2000,
      health: 50,
      fireEveryTicks: 0,
      damage: 0,
    };
  });
  const criterion = {
    type: 'hunt-contact-v1',
    targets: actors.map((actor) => actor.id),
    ordered: false,
    tail: { linksPerCatch: growth, maxLinks: 64, neckDistance: 4500, radius: 350 },
  };
  return {
    format: 'FlightCourse.v2',
    id: `snake-hunt-${pursuitChapters[Math.floor(index / 6)].id}-${slug}`,
    revision: 'r1',
    environment,
    locales: {
      en: {
        title: en,
        brief: enBrief,
        lesson: `Touch all ${count} moving, unarmed fictional humanoids in any order. Intercept their patrol routes with normal manual flight controls. Each catch adds a solid echo tail; fly above or around it. These flight courses have no grid shutters, pickups or sprint powers.`,
      },
      uk: {
        title: uk,
        brief: ukBrief,
        lesson: `Торкніться всіх ${count} рухливих неозброєних вигаданих гуманоїдів у довільному порядку. Перехоплюйте патрулі звичайним ручним керуванням. Кожен дотик подовжує твердий слід; пролітайте над ним або оминайте. Ці льотні вправи не мають клітинкових заслінок, припасів чи ривків.`,
      },
    },
    spawn: point([0, 28]),
    bounds: { min: point([-34, -34]), max: point([34, 34, 18]) },
    obstacles: boxes.map((dimensions, i) => box(`obstacle-${i + 1}`, ...dimensions)),
    actors,
    steps: { 'self-level': [criterion], acro: [structuredClone(criterion)] },
    world: { id: environment, theme: 'pixel', style: environment },
    rules: { seed: 9300 + index, maxTicks: 36000, collisionDamage: 0 },
    conditions: { profile: 'clear', revision: 'r1' },
  };
}
const originalCourses = chapters.flatMap((chapter) =>
  chapter.rows.map((row, index) => courseFor(chapter, row, index)),
);
export const SNAKE_HUNT_PURSUIT_COURSES = Object.freeze(pursuitRows.map(pursuitCourseFor));
export const SNAKE_HUNT_EXPRESSIVE_COURSES = EXPRESSIVE_HUNT_COURSES;
export const SNAKE_HUNT_COURSES = Object.freeze([
  ...originalCourses,
  ...SNAKE_HUNT_PURSUIT_COURSES,
  ...SNAKE_HUNT_EXPRESSIVE_COURSES,
]);
export const SNAKE_HUNT_IDENTITY = `fpv-snake-hunt:${dataIdentity(originalCourses)}`;
export const SNAKE_HUNT_PURSUIT_IDENTITY = `fpv-snake-pursuit:${dataIdentity(SNAKE_HUNT_PURSUIT_COURSES)}`;
export const SNAKE_HUNT_EXPRESSIVE_IDENTITY = `fpv-expressive-hunt:${dataIdentity(SNAKE_HUNT_EXPRESSIVE_COURSES)}`;
export const SNAKE_HUNT_CATALOGUE = Object.freeze(
  SNAKE_HUNT_COURSES.map((course, index) => ({
    id: course.id,
    course,
    world: course.environment,
    theme: 'snake-hunt',
    activity: 'hunt',
    difficulty: index % 6 < 2 ? 'beginner' : index % 6 < 5 ? 'intermediate' : 'advanced',
    duration: 4,
    packIdentity:
      index < originalCourses.length
        ? SNAKE_HUNT_IDENTITY
        : index < originalCourses.length + SNAKE_HUNT_PURSUIT_COURSES.length
          ? SNAKE_HUNT_PURSUIT_IDENTITY
          : SNAKE_HUNT_EXPRESSIVE_IDENTITY,
    legacy: false,
  })),
);
export const SNAKE_HUNT_PLAYLISTS = Object.freeze(
  [...chapters, ...pursuitChapters, ...EXPRESSIVE_HUNT_CHAPTERS].map((chapter) => ({
    format: 'FPVPlaylist.v1',
    id: `snake-hunt-${chapter.id}`,
    revision: 'r1',
    title: chapter.title,
    entries: SNAKE_HUNT_CATALOGUE.filter((entry) =>
      entry.id.startsWith(`snake-hunt-${chapter.id}-`),
    ).map((entry) => ({ packIdentity: entry.packIdentity, levelId: entry.id })),
  })),
);
