import { dataIdentity } from '../../game/data-json.mjs';
import { FLIGHT_COURSES } from './catalogue.mjs';

const text = (en, uk) => ({ en, uk });
export const WORLD_THEMES = Object.freeze([
  { id: 'academy', title: text('Flight Academy', 'Льотна академія'), color: '#a2dfcf' },
  { id: 'ukrainian', title: text('Ukrainian Horizons', 'Українські обрії'), color: '#e5c36e' },
  { id: 'pixel', title: text('Pixel Circuit', 'Піксельні перегони'), color: '#bd9cfc' },
  { id: 'operations', title: text('Field Operations', 'Польові операції'), color: '#a5c581' },
]);
export const FLIGHT_WORLDS = Object.freeze([
  {
    id: 'gym',
    theme: 'academy',
    title: text('Training hangar', 'Навчальний ангар'),
    subtitle: text('Find your balance', 'Відчуйте рівновагу'),
    style: 'hangar',
  },
  {
    id: 'field',
    theme: 'academy',
    title: text('Open meadow', 'Відкрита лука'),
    subtitle: text('Space to learn', 'Простір для навчання'),
    style: 'meadow',
  },
  {
    id: 'woodland',
    theme: 'ukrainian',
    title: text('Woodland park', 'Лісопарк'),
    subtitle: text('Clearings, timber and quiet trails', 'Галявини, дерева та тихі стежки'),
    style: 'woodland',
  },
  {
    id: 'courtyard',
    theme: 'ukrainian',
    title: text('Ukrainian courtyard', 'Українське подвір’я'),
    subtitle: text('Warm walls and winding lanes', 'Теплі стіни та звивисті провулки'),
    style: 'courtyard',
  },
  {
    id: 'warehouse',
    theme: 'pixel',
    title: text('Pixel warehouse', 'Піксельний склад'),
    subtitle: text('Strong lines. Small gaps.', 'Чіткі лінії. Вузькі отвори.'),
    style: 'warehouse',
  },
  {
    id: 'stadium',
    theme: 'pixel',
    title: text('Circuit stadium', 'Гоночний стадіон'),
    subtitle: text('Find a faster line', 'Знайдіть швидшу траєкторію'),
    style: 'stadium',
  },
  {
    id: 'container-yard',
    theme: 'operations',
    title: text('Container yard', 'Контейнерний двір'),
    subtitle: text('Cover, movement and precision', 'Укриття, рух і точність'),
    style: 'industrial',
  },
  {
    id: 'garage',
    theme: 'operations',
    title: text('Parking garage', 'Паркінг'),
    subtitle: text('Columns and close encounters', 'Колони та близькі зустрічі'),
    style: 'garage',
  },
]);
export const ACTIVITY_NAMES = Object.freeze({
  training: text('Orientation', 'Ознайомлення'),
  exploration: text('Explore', 'Дослідження'),
  precision: text('Precision', 'Точність'),
  hazard: text('Evasion', 'Ухилення'),
  race: text('Race', 'Перегони'),
  combat: text('Combat', 'Бій'),
  capstone: text('Mixed challenge', 'Комбіноване завдання'),
  academy: text('Academy drill', 'Вправа академії'),
});
const p = (x, y, z) => ({ x: x * 1000, y: y * 1000, z: z * 1000 });
const box = (id, x, z, width, depth, height) => ({
  id,
  min: p(x - width / 2, 0, z - depth / 2),
  max: p(x + width / 2, height, z + depth / 2),
});
export function worldObstacles(id) {
  if (id === 'woodland')
    return [
      [-16, -12],
      [-20, 4],
      [18, -6],
      [22, 13],
      [-7, -25],
      [11, -26],
    ].map(([x, z], i) => box(`tree-${i}`, x, z, 1, 1, 8));
  if (id === 'courtyard')
    return [
      box('house-west', -25, -8, 8, 20, 8),
      box('house-east', 25, -5, 8, 26, 7),
      box('garden-wall', -10, -31, 15, 1, 2),
      box('well', 15, 5, 2, 2, 1.3),
    ];
  if (id === 'warehouse')
    return [-22, 22].flatMap((x, i) =>
      [-20, 0, 18].map((z, j) => box(`rack-${i}-${j}`, x, z, 5, 10, 7)),
    );
  if (id === 'stadium')
    return [
      box('stand-west', -32, 0, 5, 48, 8),
      box('stand-east', 32, 0, 5, 48, 8),
      box('scoreboard', 0, -36, 14, 2, 10),
    ];
  if (id === 'container-yard')
    return [-25, 25].flatMap((x, i) =>
      [-18, 0, 18].map((z, j) => box(`container-${i}-${j}`, x, z, 5, 12, j === 1 ? 5.2 : 2.6)),
    );
  if (id === 'garage')
    return [
      ...[-23, 23].flatMap((x, i) =>
        [-23, -5, 13].map((z, j) => box(`column-${i}-${j}`, x, z, 1.5, 1.5, 8)),
      ),
      { id: 'garage-deck', min: p(-35, 4.7, -30), max: p(-24, 5, -8) },
      {
        id: 'garage-ramp',
        type: 'trimesh',
        vertices: [
          -35000, 0, 14000, -24000, 0, 14000, -35000, 5000, -8000, -24000, 5000, -8000, -35000, 0,
          -8000, -24000, 0, -8000,
        ],
        indices: [0, 2, 1, 1, 2, 3, 0, 4, 2, 1, 3, 5, 2, 4, 3, 3, 4, 5, 0, 1, 4, 1, 5, 4],
      },
    ];
  return [];
}
const hold = (x, y, z, ticks = 35, size = 1800) => ({
  type: 'hold',
  min: { x: x * 1000 - size, y: Math.max(0, y * 1000 - 800), z: z * 1000 - size },
  max: { x: x * 1000 + size, y: y * 1000 + 800, z: z * 1000 + size },
  ticks,
  maxSpeed: 2600,
  maxTilt: 5000,
  minTilt: 0,
  centred: false,
  heading: null,
});
const land = (x, z) => ({
  ...hold(x, 0, z, 20, 2100),
  type: 'land',
  maxSpeed: 1300,
  maxTilt: 2500,
});
const gate = (axis, at, side, direction, y = 3, width = 5) => ({
  type: 'gate',
  axis,
  at: at * 1000,
  direction,
  minSide: (side - width / 2) * 1000,
  maxSide: (side + width / 2) * 1000,
  minY: Math.max(500, (y - 1.6) * 1000),
  maxY: (y + 1.6) * 1000,
});
// Every row is an authored route/task. Theme, mode and medal variants do not add levels.
const SLATES = {
  woodland: [
    [
      'Clearing check-in',
      'Знайомство з галявиною',
      'training',
      [
        [0, 3, 8],
        [5, 3, 0],
      ],
    ],
    [
      'Three clearings',
      'Три галявини',
      'exploration',
      [
        [-10, 3, 4],
        [0, 4, -16],
        [14, 3, -12],
      ],
    ],
    [
      'Trail beacons',
      'Маяки стежки',
      'exploration',
      [
        [13, 4, 10],
        [7, 6, -10],
        [-12, 4, -19],
        [0, 3, 0],
      ],
    ],
    [
      'Quiet hover',
      'Тихе зависання',
      'precision',
      [
        [-8, 3, 4],
        [5, 4, -8],
        [12, 3, 3],
      ],
    ],
    [
      'Canopy windows',
      'Вікна в кроні',
      'precision',
      [
        [0, 6, -8],
        [-10, 5, -17],
        [6, 4, -21],
      ],
    ],
    [
      'Crossing trail',
      'Перетин стежки',
      'hazard',
      [
        [0, 3, 7],
        [-9, 3, -9],
        [9, 4, -20],
      ],
    ],
    [
      'Low branch line',
      'Під гілками',
      'hazard',
      [
        [12, 2, 3],
        [-10, 2, -3],
        [10, 2, -16],
      ],
    ],
    [
      'Woodland survey',
      'Огляд лісопарку',
      'capstone',
      [
        [-12, 3, 5],
        [2, 6, -19],
        [16, 4, -13],
        [0, 3, 0],
      ],
    ],
  ],
  courtyard: [
    [
      'Courtyard welcome',
      'Знайомство з подвір’ям',
      'training',
      [
        [0, 3, 7],
        [-8, 3, 0],
      ],
    ],
    [
      'Garden markers',
      'Садові орієнтири',
      'exploration',
      [
        [-12, 3, 5],
        [-8, 4, -21],
        [12, 3, -12],
      ],
    ],
    [
      'Roofline survey',
      'Огляд дахів',
      'exploration',
      [
        [16, 7, 3],
        [12, 9, -22],
        [-16, 7, -15],
        [0, 3, 3],
      ],
    ],
    [
      'Well-side landing',
      'Посадка біля криниці',
      'precision',
      [
        [9, 2, 6],
        [10, 3, -4],
        [-8, 2, -12],
      ],
    ],
    [
      'Window alignment',
      'Лінія вікон',
      'precision',
      [
        [-15, 4, -2],
        [0, 5, -12],
        [15, 4, -20],
      ],
    ],
    [
      'Delivery crossing',
      'Перехресна доставка',
      'hazard',
      [
        [-10, 3, 8],
        [8, 3, -6],
        [-10, 4, -22],
      ],
    ],
    [
      'Laneway traffic',
      'Рух у провулку',
      'hazard',
      [
        [12, 3, 10],
        [-12, 3, -3],
        [12, 3, -15],
      ],
    ],
    [
      'Courtyard collection',
      'Обхід подвір’я',
      'capstone',
      [
        [-14, 4, 3],
        [0, 7, -20],
        [15, 4, -7],
        [0, 3, 8],
      ],
    ],
  ],
  warehouse: [
    [
      'Loading bay',
      'Вантажний майданчик',
      'training',
      [
        [0, 3, 8],
        [9, 3, 0],
      ],
    ],
    [
      'Central aisle',
      'Центральний прохід',
      'race',
      [
        ['z', 7, 0, -1],
        ['z', -8, 0, -1],
        ['z', -24, 0, -1],
      ],
    ],
    [
      'Pallet switchback',
      'Змійка між палетами',
      'race',
      [
        ['z', 6, -8, -1],
        ['z', -7, 8, -1],
        ['z', -21, -8, -1],
      ],
    ],
    [
      'Beam circuit',
      'Коло під балками',
      'race',
      [
        ['z', 0, -10, -1],
        ['x', 0, -20, 1],
        ['z', 0, 10, 1],
        ['x', 0, 10, -1],
      ],
    ],
    [
      'High-low sprint',
      'Високий і низький спринт',
      'race',
      [
        ['z', 8, 8, -1, 3],
        ['z', -6, -8, -1, 6],
        ['z', -23, 8, -1, 3],
      ],
    ],
    [
      'Shelf clearance',
      'Відстань до стелажів',
      'precision',
      [
        [-14, 3, 7],
        [14, 5, -6],
        [-14, 4, -19],
      ],
    ],
    [
      'Moving freight',
      'Рухомий вантаж',
      'hazard',
      [
        [8, 3, 5],
        [-8, 4, -7],
        [10, 3, -22],
      ],
    ],
    [
      'Warehouse circuit',
      'Коло складом',
      'capstone',
      [
        [-10, 3, 5],
        [10, 5, -12],
        [-10, 3, -25],
        [0, 3, 8],
      ],
    ],
  ],
  stadium: [
    [
      'Starting grid',
      'Стартова решітка',
      'training',
      [
        [0, 3, 8],
        [-8, 4, 0],
      ],
    ],
    [
      'Wide oval',
      'Широкий овал',
      'race',
      [
        ['z', 0, -13, -1],
        ['x', 0, -25, 1],
        ['z', 0, 13, 1],
        ['x', 0, 15, -1],
      ],
    ],
    [
      'Neon chicane',
      'Неонова шикана',
      'race',
      [
        ['z', 9, -10, -1],
        ['z', -2, 10, -1],
        ['z', -14, -10, -1],
        ['z', -26, 10, -1],
      ],
    ],
    [
      'Altitude ladder',
      'Сходи висоти',
      'race',
      [
        ['z', 7, 0, -1, 3],
        ['z', -4, 0, -1, 6],
        ['z', -17, 0, -1, 9],
        ['x', 14, -25, 1, 5],
      ],
    ],
    [
      'Double hairpin',
      'Подвійна шпилька',
      'race',
      [
        ['z', -5, -13, -1],
        ['x', 0, -20, 1],
        ['z', 5, 13, 1],
        ['x', 0, 12, -1],
        ['z', -20, -13, -1],
      ],
    ],
    [
      'Podium approach',
      'Підхід до подіуму',
      'precision',
      [
        [-12, 4, -8],
        [12, 4, -8],
        [0, 2, 0],
      ],
    ],
    [
      'Crossing lights',
      'Перехресні вогні',
      'hazard',
      [
        [0, 3, 8],
        [-11, 4, -6],
        [11, 4, -20],
      ],
    ],
    [
      'Stadium final',
      'Фінал стадіону',
      'capstone',
      [
        [-15, 4, 2],
        [0, 8, -25],
        [15, 4, 2],
        [0, 3, 10],
      ],
    ],
  ],
  'container-yard': [
    [
      'Yard check-in',
      'Знайомство з двором',
      'training',
      [
        [0, 3, 8],
        [10, 3, -2],
      ],
    ],
    [
      'Container survey',
      'Огляд контейнерів',
      'exploration',
      [
        [-14, 4, 6],
        [14, 6, -10],
        [-14, 4, -25],
      ],
    ],
    [
      'Crossing crane',
      'Перехід під краном',
      'hazard',
      [
        [10, 3, 5],
        [-10, 4, -7],
        [10, 3, -23],
      ],
    ],
    ['Target lane', 'Смуга мішеней', 'combat', [['sentry', 0, 0, -10]]],
    [
      'Patrol interruption',
      'Зупинка патруля',
      'combat',
      [
        ['patrol', -8, 0, -8],
        ['patrol', 8, 0, -16],
      ],
    ],
    [
      'Drone interception',
      'Перехоплення дронів',
      'combat',
      [
        ['drone', -7, 3, -9],
        ['drone', 7, 4, -19],
      ],
    ],
    [
      'Convoy challenge',
      'Завдання з конвоєм',
      'combat',
      [
        ['vehicle', 0, 0, -16],
        ['sentry', 12, 0, -8],
      ],
    ],
    [
      'Yard extraction',
      'Вихід із двору',
      'capstone',
      [
        [-12, 3, 5],
        [12, 4, -10],
        [0, 3, -25],
        [0, 3, 7],
      ],
    ],
  ],
  garage: [
    [
      'Parking approach',
      'Підхід до паркінгу',
      'training',
      [
        [0, 3, 8],
        [-10, 3, -3],
      ],
    ],
    [
      'Upper deck survey',
      'Огляд верхнього рівня',
      'exploration',
      [
        [-14, 4, 7],
        [-30, 7, -18],
        [14, 4, -7],
      ],
    ],
    [
      'Barrier timing',
      'Час проїзду шлагбаума',
      'hazard',
      [
        [10, 3, 5],
        [-10, 3, -8],
        [10, 3, -22],
      ],
    ],
    [
      'Sentry aisle',
      'Прохід вартового',
      'combat',
      [
        ['sentry', -9, 0, -12],
        ['sentry', 9, 0, -12],
      ],
    ],
    [
      'Ground patrol',
      'Наземний патруль',
      'combat',
      [
        ['patrol', 0, 0, -8],
        ['patrol', -12, 0, -21],
      ],
    ],
    [
      'Garage intercept',
      'Перехоплення в паркінгу',
      'combat',
      [
        ['drone', -10, 3, -12],
        ['drone', 10, 3, -22],
      ],
    ],
    [
      'Vehicle watch',
      'Спостереження за технікою',
      'combat',
      [
        ['vehicle', -8, 0, -16],
        ['vehicle', 10, 0, -24],
      ],
    ],
    [
      'Garage extraction',
      'Вихід із паркінгу',
      'capstone',
      [
        [12, 3, 5],
        [-12, 4, -7],
        [12, 3, -23],
        [0, 3, 8],
      ],
    ],
  ],
};
const brief = {
  training: text(
    'Lift off, settle inside each marked volume, then land. All challenges are open; take your time.',
    'Злетіть, стабілізуйтеся в кожному об’ємі та сядьте. Усі завдання відкриті — не поспішайте.',
  ),
  exploration: text(
    'Visit the survey beacons in order. Use landmarks to plan your next approach, then return to land.',
    'Відвідайте маяки по черзі. Плануйте підхід за орієнтирами та поверніться на посадку.',
  ),
  precision: text(
    'Hold each small volume steadily. Brake early, control your height and finish with a gentle landing.',
    'Стабільно утримуйте кожен малий об’єм. Гальмуйте завчасно, контролюйте висоту та м’яко сядьте.',
  ),
  hazard: text(
    'Pass the markers while avoiding the moving obstacles. Watch their rhythm before crossing.',
    'Пройдіть орієнтири, оминаючи рухомі перешкоди. Спершу спостерігайте за їхнім ритмом.',
  ),
  race: text(
    'Cross the gates in the marked direction and finish at the landing pad. A clean line beats frantic corrections.',
    'Пройдіть ворота в позначеному напрямку й сядьте на майданчик. Плавна траєкторія краща за різкі корекції.',
  ),
  combat: text(
    'Disable the fictional targets with pulse shots, then land. Space or the Fire button shoots along the drone’s nose.',
    'Вимкніть вигадані мішені імпульсами, потім сядьте. Пробіл або кнопка «Вогонь» стріляє вздовж носа дрона.',
  ),
  capstone: text(
    'Combine altitude changes, steady approaches and a clean return. Use the whole environment to find your line.',
    'Поєднайте зміну висоти, точні підходи та чисте повернення. Використовуйте весь простір для траєкторії.',
  ),
};
function makeCourse(world, row, index) {
  const [en, uk, activity, route] = row;
  let actors = [],
    steps;
  if (activity === 'race')
    steps = [hold(0, 3, 14), ...route.map((args) => gate(...args)), land(0, 12)];
  else if (activity === 'combat') {
    actors = route.map(([type, x, y, z], i) => ({
      id: `target-${i + 1}`,
      type,
      position: p(x, y, z),
      health: type === 'vehicle' ? 100 : 50,
      radius: type === 'vehicle' ? 1000 : type === 'drone' ? 500 : 400,
      height: 1800,
      fireEveryTicks: 150 + i * 30,
      damage: 5,
      range: 24000,
      ...(type === 'patrol' || type === 'vehicle'
        ? { path: [p(x, y, z), p(x + 5, y, z - 3)], speed: 800 }
        : {}),
    }));
    steps = [{ type: 'eliminate', targets: actors.map((a) => a.id) }, land(0, 12)];
  } else {
    steps = route.map(([x, y, z]) =>
      hold(x, y, z, activity === 'precision' ? 75 : 35, activity === 'precision' ? 1100 : 2000),
    );
    steps.push(land(0, 12));
  }
  if (activity === 'hazard')
    actors = [
      {
        id: 'crossing-1',
        type: 'hazard',
        position: p(-12, 2, -4),
        path: [p(-12, 2, -4), p(12, 2, -4)],
        speed: 2300,
        radius: 1100,
      },
      {
        id: 'crossing-2',
        type: 'hazard',
        position: p(12, 3, -17),
        path: [p(12, 3, -17), p(-12, 3, -17)],
        speed: 1700,
        radius: 1000,
      },
    ];
  if (activity === 'capstone' && world.theme === 'operations') {
    actors = [
      {
        id: 'extraction-patrol',
        type: 'patrol',
        position: p(-8, 0, -12),
        path: [p(-8, 0, -12), p(8, 0, -12)],
        speed: 900,
        radius: 400,
        height: 1800,
        health: 75,
        fireEveryTicks: 170,
        damage: 5,
        range: 24000,
      },
      {
        id: 'extraction-drone',
        type: 'drone',
        position: p(10, 5, -20),
        radius: 500,
        health: 50,
        fireEveryTicks: 190,
        damage: 5,
        range: 24000,
      },
    ];
    steps.splice(steps.length - 1, 0, { type: 'eliminate', targets: actors.map((a) => a.id) });
  }
  if (activity === 'capstone' && world.theme === 'pixel') {
    let before = [0, 3, 18];
    steps = [
      hold(0, 3, 14),
      ...route.map(([x, y, z]) => {
        const axis = Math.abs(x - before[0]) > Math.abs(z - before[2]) ? 'x' : 'z',
          direction = Math.sign(axis === 'x' ? x - before[0] : z - before[2]) || 1;
        before = [x, y, z];
        return gate(axis, axis === 'x' ? x : z, axis === 'x' ? z : x, direction, y, 6);
      }),
      land(0, 12),
    ];
  }
  if (world.id === 'garage' && activity === 'exploration') {
    const upper = {
      ...hold(-30, 5, -18, 25, 1800),
      type: 'land',
      surface: 'garage-deck',
      maxSpeed: 1300,
      maxTilt: 2500,
    };
    steps.splice(2, 0, upper);
  }
  if (activity === 'race') {
    const points = route.map(([axis, at, side, direction, y = 3]) =>
      p(axis === 'x' ? at : side, y, axis === 'z' ? at : side),
    );
    actors.push({
      id: 'pace-rival',
      type: 'drone',
      role: 'rival',
      position: p(-3, 3, 16),
      path: points,
      speed: 2600,
      radius: 300,
      health: 100,
      fireEveryTicks: 0,
    });
  }
  if (world.theme === 'ukrainian') {
    actors.push({
      id: 'park-visitor',
      type: 'patrol',
      role: 'civilian',
      position: p(-18, 0, 22),
      path: [p(-18, 0, 22), p(-10, 0, 26)],
      speed: 650,
      radius: 300,
      height: 1800,
      fireEveryTicks: 0,
    });
  }
  const locals = Object.fromEntries(
    ['en', 'uk'].map((lang) => [
      lang,
      {
        title: lang === 'en' ? en : uk,
        brief: brief[activity][lang],
        lesson:
          lang === 'en'
            ? 'Review the missed condition, practise that approach, or choose any other challenge.'
            : 'Перегляньте невиконану умову, потренуйте підхід або виберіть інше завдання.',
      },
    ]),
  );
  return {
    format: 'FlightCourse.v2',
    id: `${world.id}-${String(index + 1).padStart(2, '0')}`,
    revision: 'r1',
    environment: world.id,
    locales: locals,
    spawn: p(0, 0, 18),
    bounds: { min: p(-38, 0, -38), max: p(38, 18, 32) },
    obstacles: worldObstacles(world.id),
    steps: { 'self-level': steps, acro: structuredClone(steps) },
    world: { id: world.id, theme: world.theme, style: world.style },
    actors,
    rules: { seed: 100 + index, maxTicks: 36000 },
    conditions: { profile: 'clear', revision: 'r1' },
  };
}
export const WORLD_COURSES = Object.freeze(
  FLIGHT_WORLDS.filter((w) => SLATES[w.id]).flatMap((world) =>
    SLATES[world.id].map((row, index) => makeCourse(world, row, index)),
  ),
);
export const BUILTIN_WORLD_IDENTITY = `fpv-worlds:${dataIdentity(WORLD_COURSES)}`;
export const ACADEMY_IDENTITY = `fpv-academy:${dataIdentity(FLIGHT_COURSES)}`;
export const WORLD_CATALOGUE = Object.freeze([
  ...FLIGHT_COURSES.map((course, index) => ({
    id: course.id,
    course,
    world: course.environment,
    theme: 'academy',
    activity: 'academy',
    difficulty: index < 4 ? 'beginner' : index < 9 ? 'intermediate' : 'advanced',
    duration: 3,
    packIdentity: ACADEMY_IDENTITY,
    legacy: true,
  })),
  ...WORLD_COURSES.map((course) => {
    const index = Number(course.id.slice(-2)) - 1,
      row = SLATES[course.environment][index];
    return {
      id: course.id,
      course,
      world: course.environment,
      theme: course.world.theme,
      activity: row[2],
      difficulty: index === 0 ? 'beginner' : index === 7 ? 'advanced' : 'intermediate',
      duration: row[2] === 'combat' ? 4 : 3,
      packIdentity: BUILTIN_WORLD_IDENTITY,
      legacy: false,
    };
  }),
]);
export const CURATED_PLAYLISTS = Object.freeze(
  WORLD_THEMES.map((theme) => ({
    format: 'FPVPlaylist.v1',
    id: `collection-${theme.id}`,
    revision: 'r1',
    title: theme.title,
    entries: WORLD_CATALOGUE.filter((entry) => entry.theme === theme.id).map((entry) => ({
      packIdentity: entry.packIdentity,
      levelId: entry.id,
    })),
  })),
);
