import { dataIdentity } from '../../game/data-json.mjs';

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

export const SNAKE_HUNT_COURSES = Object.freeze(
  chapters.flatMap((chapter) => chapter.rows.map((row, index) => courseFor(chapter, row, index))),
);
export const SNAKE_HUNT_IDENTITY = `fpv-snake-hunt:${dataIdentity(SNAKE_HUNT_COURSES)}`;
export const SNAKE_HUNT_CATALOGUE = Object.freeze(
  SNAKE_HUNT_COURSES.map((course, index) => ({
    id: course.id,
    course,
    world: course.environment,
    theme: 'snake-hunt',
    activity: 'hunt',
    difficulty: index % 6 < 2 ? 'beginner' : index % 6 < 5 ? 'intermediate' : 'advanced',
    duration: 4,
    packIdentity: SNAKE_HUNT_IDENTITY,
    legacy: false,
  })),
);
export const SNAKE_HUNT_PLAYLISTS = Object.freeze(
  chapters.map((chapter) => ({
    format: 'FPVPlaylist.v1',
    id: `snake-hunt-${chapter.id}`,
    revision: 'r1',
    title: chapter.title,
    entries: SNAKE_HUNT_CATALOGUE.filter((entry) =>
      entry.id.startsWith(`snake-hunt-${chapter.id}-`),
    ).map((entry) => ({ packIdentity: entry.packIdentity, levelId: entry.id })),
  })),
);
