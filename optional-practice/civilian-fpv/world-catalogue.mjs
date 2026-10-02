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

// Flight School is a separate content revision. Existing Academy/world identities
// and their recorded demonstrations deliberately do not include these lessons.
const schoolHold = (x, y, z, options = {}) => ({
  ...hold(x, y, z, 50, 3000),
  maxSpeed: 2200,
  maxTilt: 3500,
  ...options,
});
const schoolGate = (axis, at, side, direction, y = 2.5) => ({
  ...gate(axis, at, side, direction, y, 7),
  minY: 500,
  maxY: (y + 2) * 1000,
});
const schoolLanding = (x, z) => ({
  ...schoolHold(x, 0, z, { ticks: 30, maxSpeed: 1500, maxTilt: 2500 }),
  type: 'land',
  surface: '$floor',
});
const schoolNote = (
  title,
  instruction,
  why,
  axis,
  motion,
  target,
  tip,
  direction = 1,
  lateralDirection,
) => ({
  title: text(...title),
  instruction: text(...instruction),
  why: text(...why),
  axis,
  motion,
  direction,
  ...(lateralDirection === undefined ? {} : { lateralDirection }),
  target,
  tip: text(...tip),
});
const schoolLift = (height = 2.5) => [
  schoolHold(0, height, 0),
  schoolNote(
    ['Lift gently', 'Плавно підніміться'],
    [
      `Start with throttle low and the other controls centred. Arm, then raise throttle gently into the ${height} m target. Ease back as you approach it.`,
      `Почніть із низького газу та центрованих інших стіків. Увімкніть мотори й плавно додайте газ до цілі ${height} м. Наближаючись, трохи зменште газ.`,
    ],
    [
      'Throttle changes thrust. More upward force starts a climb; reducing it slows the climb. There is no automatic altitude hold.',
      'Газ змінює тягу. Більша підйомна сила починає набір висоти; менша сповільнює його. Автоматичного утримання висоти немає.',
    ],
    'throttle',
    'lift',
    0.58,
    [
      'Use small changes. Keyboard: ↑/↓ changes throttle; hold Shift for finer adjustments. Releasing the key keeps its current setting.',
      'Робіть малі зміни. На клавіатурі ↑/↓ змінює газ; Shift дає точніше керування. Після відпускання клавіші газ зберігається.',
    ],
  ),
];
const schoolLand = (x = 0, z = 0) => [
  schoolLanding(x, z),
  schoolNote(
    ['Settle onto the pad', 'М’яко сядьте на майданчик'],
    [
      'Move above the lit pad and brake your drift. Keep the drone level, lower throttle a little to descend, then reduce it fully after touching down.',
      'Станьте над підсвіченим майданчиком і погасіть дрейф. Тримайте дрон горизонтально, трохи зменште газ для спуску та приберіть його після торкання.',
    ],
    [
      'A landing needs low speed and a level drone. Cutting throttle high above the ground makes the drone fall; reduce it gradually while descending.',
      'Для посадки потрібні мала швидкість і горизонтальний дрон. Вимкнення газу на висоті спричиняє падіння; зменшуйте його поступово під час спуску.',
    ],
    'throttle',
    'land',
    0.44,
    [
      'Watch the downward speed, not only height. If the landing was hard, lift gently and try a softer touchdown, or retry this lesson.',
      'Стежте за швидкістю спуску, а не лише висотою. Після жорсткої посадки плавно підніміться й сядьте м’якше або повторіть урок.',
    ],
    -1,
  ),
];
const schoolLesson = (index, options, stages) => {
  const id = `beginner-${String(index + 1).padStart(2, '0')}`,
    environment = index < 7 ? 'gym' : 'field',
    title = text(...options.title),
    summary = text(...options.summary),
    concept = text(...options.concept),
    objectives = stages.map(([objective]) => objective),
    course = {
      format: 'FlightCourse.v2',
      id,
      revision: 'r1',
      environment,
      locales: Object.fromEntries(
        ['en', 'uk'].map((locale) => [
          locale,
          { title: title[locale], brief: summary[locale], lesson: concept[locale] },
        ]),
      ),
      spawn: p(0, 0, 0),
      bounds: { min: p(-32, 0, -32), max: p(32, 16, 32) },
      obstacles: [],
      steps: { 'self-level': objectives, acro: structuredClone(objectives) },
      world: {
        id: environment,
        theme: 'academy',
        style: environment === 'gym' ? 'hangar' : 'meadow',
      },
      actors: [],
      rules: { seed: 700 + index, maxTicks: 36000, collisionDamage: 0 },
      conditions: { profile: 'clear', revision: 'r1' },
    };
  return Object.freeze({
    id,
    index,
    title,
    summary,
    concept,
    duration: options.duration ?? 4,
    chapter: options.chapter,
    mode: options.mode ?? 'self-level',
    camera: options.camera ?? 'chase',
    course,
    steps: stages.map(([, note]) => note),
  });
};
const ORIGINAL_BEGINNER_LESSONS = Object.freeze([
  schoolLesson(
    0,
    {
      title: ['Meet your drone', 'Знайомство з дроном'],
      summary: [
        'Meet the four controls, prepare on the pad, and make a tiny first hop.',
        'Познайомтеся з чотирма осями керування, підготуйтеся на майданчику й зробіть перший малий підскок.',
      ],
      concept: [
        'Throttle changes thrust; yaw turns the nose; pitch tilts forward/back; roll tilts sideways. The stick diagram follows your selected input and radio layout.',
        'Газ змінює тягу; рискання повертає ніс; тангаж нахиляє вперед/назад; крен — убік. Схема стіків відповідає вибраному пристрою та розкладці пульта.',
      ],
      chapter: 'controls',
      duration: 3,
    },
    [
      [
        schoolHold(0, 0, 0, { ticks: 40, maxSpeed: 500, maxTilt: 1000, centred: true }),
        schoolNote(
          ['Ready on the launch pad', 'Готовність на стартовому майданчику'],
          [
            'Lower throttle fully. Centre yaw, pitch and roll, then deliberately arm. Stay on the pad while you find the controls in the diagram.',
            'Повністю опустіть газ. Центруйте рискання, тангаж і крен, тоді свідомо увімкніть мотори. Залишайтеся на майданчику, розглядаючи керування на схемі.',
          ],
          [
            'Arming enables the motors; it does not take off for you. Centred rotational controls ask for no turn or tilt in self-level mode.',
            'Увімкнення дозволяє роботу моторів, але не злітає замість вас. Центровані осі обертання в режимі самовирівнювання не задають повороту чи нахилу.',
          ],
          'mixed',
          'hover',
          0,
          [
            'The solid dots show your real controls. Animated guidance explains a movement; it does not move the drone for you.',
            'Суцільні точки показують ваше реальне керування. Анімація пояснює рух, але не керує дроном замість вас.',
          ],
        ),
      ],
      schoolLift(1.4),
      schoolLand(),
    ],
  ),
  schoolLesson(
    1,
    {
      title: ['Up, down, under control', 'Угору й униз під контролем'],
      summary: [
        'Use throttle to visit two heights, then return softly to the pad.',
        'Газом відвідайте дві висоти й м’яко поверніться на майданчик.',
      ],
      concept: [
        'Throttle is a force control, not an elevator button. The drone can still climb after you ease the throttle because it already has upward speed.',
        'Газ керує силою, а не працює кнопкою ліфта. Дрон може продовжити підйом після зменшення газу, бо вже має швидкість угору.',
      ],
      chapter: 'controls',
      duration: 3,
    },
    [
      schoolLift(1.8),
      [
        schoolHold(0, 3.8, 0, { ticks: 60, maxSpeed: 1500 }),
        schoolNote(
          ['Climb to the upper ribbon', 'Підніміться до верхньої смуги'],
          [
            'Raise throttle a little to climb. Before the upper target, ease it back and wait for your upward speed to settle.',
            'Трохи додайте газ для підйому. Перед верхньою ціллю зменште його й дочекайтеся сповільнення руху вгору.',
          ],
          [
            'A small input held briefly is easier to correct than a large burst. Level hover is near mid-throttle in this model, but momentum still matters.',
            'Малий короткий рух легше виправити, ніж різкий стрибок. У цій моделі горизонтальне зависання близьке до середини газу, але імпульс усе ще впливає.',
          ],
          'throttle',
          'lift',
          0.55,
          [
            'Look at the height ribbon and the vertical-speed arrow together.',
            'Дивіться одночасно на смугу висоти та стрілку вертикальної швидкості.',
          ],
        ),
      ],
      schoolLand(),
    ],
  ),
  schoolLesson(
    2,
    {
      title: ['Find your hover', 'Знайдіть зависання'],
      summary: [
        'Rise to the practice box and hold a calm hover for three seconds.',
        'Підніміться в навчальний об’єм і спокійно зависніть на три секунди.',
      ],
      concept: [
        'Self-level helps the drone become level. You still manage height, speed and position. A centred stick alone is not a brake.',
        'Самовирівнювання допомагає дрону стати горизонтально. Висотою, швидкістю та положенням досі керуєте ви. Центрований стік сам по собі не гальмо.',
      ],
      chapter: 'controls',
      duration: 4,
    },
    [
      schoolLift(),
      [
        schoolHold(0, 2.5, 0, { ticks: 150, maxSpeed: 1200, maxTilt: 1800 }),
        schoolNote(
          ['Keep the hover calm', 'Утримуйте спокійне зависання'],
          [
            'Stay inside the glowing box. Make tiny throttle corrections and keep the drone nearly level until the three-second ring fills.',
            'Залишайтеся у світному об’ємі. Малими поправками газу тримайте дрон майже горизонтально, доки заповниться трисекундне кільце.',
          ],
          [
            'The hold counts only while position, speed and tilt are gentle enough. Moving outside simply starts the hold again; you can keep practising.',
            'Час рахується, лише коли положення, швидкість і нахил достатньо спокійні. Вихід за межі просто починає відлік знову — тренуйтеся далі.',
          ],
          'throttle',
          'hover',
          0.5,
          [
            'If you drift, use a brief opposite tilt, then centre. Do not chase every tiny movement.',
            'Якщо дрейфуєте, коротко нахиліть у протилежний бік і центруйте стік. Не намагайтеся виправити кожне мале коливання.',
          ],
        ),
      ],
      schoolLand(),
    ],
  ),
  schoolLesson(
    3,
    {
      title: ['Turn the nose: yaw', 'Поверніть ніс: рискання'],
      summary: [
        'Hover, face right, face left, then face the front again.',
        'Зависніть, поверніть ніс праворуч, ліворуч і знову вперед.',
      ],
      concept: [
        'Yaw rotates the drone around its upright axis. Turning its nose does not erase sideways or forward momentum.',
        'Рискання обертає дрон навколо вертикальної осі. Поворот носа не стирає бічного чи поступального імпульсу.',
      ],
      chapter: 'controls',
      duration: 4,
    },
    [
      schoolLift(),
      ...[
        [9000, 1, 'right', 'праворуч'],
        [-9000, -1, 'left', 'ліворуч'],
        [0, 1, 'forward', 'уперед'],
      ].map(([heading, direction, en, uk]) => [
        schoolHold(0, 2.5, 0, { ticks: 40, heading, maxSpeed: 2000 }),
        schoolNote(
          [`Face ${en}`, `Спрямуйте ніс ${uk}`],
          [
            `Use yaw to face ${en}. Ease the control toward centre as the nose lines up with the heading marker; keep a little throttle for height.`,
            `Рисканням спрямуйте ніс ${uk}. Наближаючись до позначки курсу, центруйте керування; підтримуйте висоту газом.`,
          ],
          [
            'Yaw changes where the camera looks. At rest, it can turn the drone without needing to fly a circle.',
            'Рискання змінює напрямок погляду камери. У спокої ним можна повернути дрон без польоту по колу.',
          ],
          'yaw',
          'yaw',
          0.25,
          [
            'Keyboard: Q turns left, E turns right; Shift makes a gentler turn.',
            'Клавіатура: Q повертає ліворуч, E — праворуч; Shift робить поворот плавнішим.',
          ],
          direction,
        ),
      ]),
      schoolLand(),
    ],
  ),
  schoolLesson(
    4,
    {
      title: ['Forward with pitch', 'Уперед із тангажем'],
      summary: [
        'Tilt the nose forward, pass a wide marker, then level and slow down.',
        'Нахиліть ніс уперед, пройдіть широкий маркер, вирівняйтеся й сповільніться.',
      ],
      concept: [
        'Pitch tilts the thrust forward or backward. In self-level, centring pitch levels the drone; its existing motion continues.',
        'Тангаж нахиляє тягу вперед або назад. У самовирівнюванні центрування тангажу вирівнює дрон, але наявний рух триває.',
      ],
      chapter: 'movement',
      duration: 4,
    },
    [
      schoolLift(),
      [
        schoolGate('z', -6, 0, -1),
        schoolNote(
          ['Nose forward, move forward', 'Ніс уперед — рух уперед'],
          [
            'Move pitch forward a little to tilt the nose down. Maintain height with throttle and pass through the wide marker ahead.',
            'Трохи подайте тангаж уперед, щоб опустити ніс. Підтримуйте висоту газом і пройдіть широкий маркер попереду.',
          ],
          [
            'Leaning redirects some thrust horizontally, so speed builds over time instead of changing instantly.',
            'Нахил спрямовує частину тяги горизонтально, тому швидкість наростає поступово, а не змінюється миттєво.',
          ],
          'pitch',
          'pitch',
          0.25,
          [
            'Keyboard: W tilts forward; S tilts back. Small taps with Shift are easier to learn.',
            'Клавіатура: W нахиляє вперед, S — назад. Легше вчитися з короткими натисканнями та Shift.',
          ],
        ),
      ],
      [
        schoolHold(0, 2.5, -10, { maxSpeed: 1400 }),
        schoolNote(
          ['Level, then slow the drift', 'Вирівняйтеся й сповільніть дрейф'],
          [
            'Centre pitch to level. If you keep moving forward, briefly tilt backward, then centre again inside the box.',
            'Центруйте тангаж для вирівнювання. Якщо рух уперед триває, коротко нахиліть назад і знову центруйте стік усередині об’єму.',
          ],
          [
            'Level is an attitude; stopped is a speed. You need opposite thrust to remove the speed you built.',
            'Горизонтальне положення — це нахил, а зупинка — швидкість. Для гасіння набраної швидкості потрібна протилежна тяга.',
          ],
          'pitch',
          'brake',
          0.2,
          [
            'Brake before reaching the middle of the target, not after passing it.',
            'Починайте гальмувати до середини цілі, а не після її проходження.',
          ],
          -1,
        ),
      ],
      schoolLand(0, -10),
    ],
  ),
  schoolLesson(
    5,
    {
      title: ['Slide with roll', 'Рухайтеся боком із креном'],
      summary: [
        'Slide right and left while keeping the nose facing forward.',
        'Рухайтеся праворуч і ліворуч, утримуючи ніс уперед.',
      ],
      concept: [
        'Roll banks the drone sideways. You can fly sideways without turning the nose; yaw and roll are different controls.',
        'Крен нахиляє дрон убік. Можна летіти боком без повороту носа: рискання та крен — різні осі керування.',
      ],
      chapter: 'movement',
      duration: 4,
    },
    [
      schoolLift(),
      ...[
        [6, 1, 'right', 'праворуч'],
        [-6, -1, 'left', 'ліворуч'],
      ].map(([x, direction, en, uk]) => [
        schoolHold(x, 2.5, 0, { heading: 0, maxSpeed: 1600 }),
        schoolNote(
          [`Slide ${en}`, `Посуньтеся ${uk}`],
          [
            `Use a small ${en} roll to reach the side box. Keep yaw centred, then briefly bank the opposite way to slow down.`,
            `Малим креном ${uk} дістаньтеся бічного об’єму. Тримайте рискання по центру, а для сповільнення коротко нахиліться у протилежний бік.`,
          ],
          [
            'The sideways lean creates sideways acceleration while the nose can keep facing the same landmark.',
            'Бічний нахил створює бічне прискорення, а ніс може й далі дивитися на той самий орієнтир.',
          ],
          'roll',
          'roll',
          0.25,
          [
            'Keyboard: A rolls left, D rolls right. Keep using throttle while moving sideways.',
            'Клавіатура: A дає крен ліворуч, D — праворуч. Продовжуйте керувати газом під час бічного руху.',
          ],
          direction,
        ),
      ]),
      schoolLand(-6, 0),
    ],
  ),
  schoolLesson(
    6,
    {
      title: ['Brake, do not chase', 'Гальмуйте завчасно'],
      summary: [
        'Build speed, stop in a roomy box, reverse gently, and stop again.',
        'Наберіть швидкість, зупиніться у просторому об’ємі, плавно рушіть назад і знову зупиніться.',
      ],
      concept: [
        'Opposite tilt brakes motion. Holding it too long builds speed in the opposite direction. Ease toward level as the speed falls.',
        'Протилежний нахил гальмує рух. Надто довге утримання набере швидкість у зворотний бік. Коли швидкість падає, повертайтеся до горизонту.',
      ],
      chapter: 'movement',
      duration: 5,
    },
    [
      schoolLift(),
      [
        schoolGate('z', -5, 0, -1),
        schoolNote(
          ['Build a little speed', 'Наберіть трохи швидкості'],
          [
            'Tilt forward gently and pass the first marker. Notice the motion arrow growing as you accelerate.',
            'Плавно нахиліть уперед і пройдіть перший маркер. Помітьте, як стрілка руху зростає під час прискорення.',
          ],
          [
            'Speed is accumulated motion. You will need time and space to remove it.',
            'Швидкість — це накопичений рух. Для її гасіння потрібні час і простір.',
          ],
          'pitch',
          'pitch',
          0.25,
          [
            'Keep the speed modest; this is a braking lesson, not a race.',
            'Тримайте помірну швидкість: це урок гальмування, а не перегони.',
          ],
        ),
      ],
      [
        schoolHold(0, 2.5, -10, { ticks: 75, maxSpeed: 900 }),
        schoolNote(
          ['Brake into the box', 'Загальмуйте в об’ємі'],
          [
            'Tilt backward before the box. As the motion arrow shrinks, ease pitch to centre and settle below 0.9 m/s.',
            'Нахиліть назад перед об’ємом. Коли стрілка руху зменшується, центруйте тангаж і сповільніться нижче 0,9 м/с.',
          ],
          [
            'The opposite lean pushes against your current movement. Centring after slowing prevents an unwanted reversal.',
            'Протилежний нахил створює силу проти поточного руху. Центрування після сповільнення запобігає небажаному руху назад.',
          ],
          'pitch',
          'brake',
          0.2,
          [
            'If you overshoot, make one gentle return instead of rapidly switching direction.',
            'Якщо пролетіли ціль, плавно поверніться замість різких перемикань напрямку.',
          ],
          -1,
        ),
      ],
      [
        schoolHold(0, 2.5, -3, { ticks: 60, maxSpeed: 1100 }),
        schoolNote(
          ['Reverse, then settle', 'Рушіть назад і зупиніться'],
          [
            'Tilt back gently to return to the near box. Before reaching it, tilt forward briefly to brake the backward drift.',
            'Плавно нахиліть назад для повернення до ближнього об’єму. Перед ним коротко нахиліть уперед, щоб погасити рух назад.',
          ],
          [
            'Braking direction depends on your velocity, not on where the nose points.',
            'Напрямок гальмування залежить від швидкості, а не лише від напрямку носа.',
          ],
          'pitch',
          'brake',
          0.2,
          [
            'Watch the motion arrow: brake against it, then relax the stick.',
            'Стежте за стрілкою руху: гальмуйте проти неї, потім послабте стік.',
          ],
        ),
      ],
      schoolLand(0, -3),
    ],
  ),
  schoolLesson(
    7,
    {
      title: ['Keep height while moving', 'Тримайте висоту в русі'],
      summary: [
        'Fly forward to a higher box, then descend into a lower box while moving.',
        'Летіть уперед до вищого об’єму, а потім у русі спустіться до нижчого.',
      ],
      concept: [
        'Tilting shares thrust between upward lift and horizontal acceleration. Height and direction need coordinated control.',
        'Нахил ділить тягу між підйомною силою та горизонтальним прискоренням. Висота й напрямок потребують узгодженого керування.',
      ],
      chapter: 'movement',
      duration: 4,
    },
    [
      schoolLift(3),
      [
        schoolHold(0, 4, -8, { maxSpeed: 1800 }),
        schoolNote(
          ['Travel and climb a little', 'Рухайтеся й трохи наберіть висоту'],
          [
            'Use gentle forward pitch and a little extra throttle to reach the higher box. Brake the forward drift as you arrive.',
            'Малим тангажем уперед і трохи більшим газом дістаньтеся вищого об’єму. На підході загальмуйте поступальний рух.',
          ],
          [
            'A tilted drone may need more total thrust to keep the same upward force. The throttle guide is a starting point, not an autopilot.',
            'Нахиленому дрону може знадобитися більша загальна тяга для тієї самої підйомної сили. Підказка газу — орієнтир, а не автопілот.',
          ],
          'mixed',
          'lift',
          0.55,
          [
            'Look ahead at the destination and glance at height; do not stare only at the sticks.',
            'Дивіться вперед на ціль і поглядайте на висоту; не зосереджуйтеся лише на стіках.',
          ],
        ),
      ],
      [
        schoolHold(0, 2, -16, { maxSpeed: 1600 }),
        schoolNote(
          ['Travel into the lower box', 'Перейдіть до нижчого об’єму'],
          [
            'Fly toward the next box and ease throttle to descend slowly. Restore enough thrust to stop descending at the target height.',
            'Летіть до наступного об’єму й трохи зменште газ для повільного спуску. Біля потрібної висоти відновіть тягу для припинення спуску.',
          ],
          [
            'Stopping a descent needs upward acceleration before the ground arrives, just as braking forward motion needs opposite tilt.',
            'Для припинення спуску потрібне прискорення вгору ще до землі, так само як для гальмування вперед потрібен протилежний нахил.',
          ],
          'mixed',
          'lift',
          0.48,
          [
            'If the downward arrow grows, add a little throttle before you get too low.',
            'Якщо стрілка вниз зростає, трохи додайте газ, перш ніж опуститеся надто низько.',
          ],
          -1,
        ),
      ],
      schoolLand(0, -16),
    ],
  ),
  schoolLesson(
    8,
    {
      title: ['Your first corner', 'Ваш перший поворот'],
      summary: [
        'Fly a short straight, turn the nose right, and start a new straight.',
        'Пролетіть коротку пряму, поверніть ніс праворуч і почніть нову пряму.',
      ],
      concept: [
        'A calm turn begins with speed control. First learn to slow, turn and travel; smoother linked turns can come later.',
        'Спокійний поворот починається з контролю швидкості. Спершу навчіться сповільнюватися, повертати й рухатися; плавне поєднання прийде пізніше.',
      ],
      chapter: 'first-flight',
      duration: 5,
    },
    [
      schoolLift(),
      [
        schoolHold(0, 2.5, -8, { maxSpeed: 1400 }),
        schoolNote(
          ['Fly to the corner', 'Долетіть до повороту'],
          [
            'Pitch forward toward the corner box, then use opposite pitch to slow before turning.',
            'Тангажем уперед рушіть до об’єму на повороті, а потім протилежним тангажем сповільніться.',
          ],
          [
            'Less speed gives you more time to line up the next direction.',
            'Менша швидкість дає більше часу для вибору наступного напрямку.',
          ],
          'pitch',
          'brake',
          0.2,
          [
            'You do not need to bank hard or race around this corner.',
            'Не потрібно різко нахилятися чи проходити цей поворот на швидкості.',
          ],
          -1,
        ),
      ],
      [
        schoolHold(0, 2.5, -8, { heading: 9000, maxSpeed: 1800 }),
        schoolNote(
          ['Turn the nose right', 'Поверніть ніс праворуч'],
          [
            'Yaw right toward the new route. Keep the drone nearly level and maintain height while the nose turns.',
            'Рисканням поверніть праворуч до нового маршруту. Під час повороту тримайте дрон майже горизонтально й підтримуйте висоту.',
          ],
          [
            'Forward pitch now sends you toward the drone’s new front, not the original direction of the map.',
            'Тангаж уперед тепер спрямовує рух до нового переду дрона, а не до початкового напрямку карти.',
          ],
          'yaw',
          'yaw',
          0.25,
          [
            'The nose arrow and heading marker help you separate turning from sideways movement.',
            'Стрілка носа та позначка курсу допомагають відрізнити поворот від бічного руху.',
          ],
        ),
      ],
      [
        schoolGate('x', 8, -8, 1),
        schoolNote(
          ['Fly the new straight', 'Летіть новою прямою'],
          [
            'With the nose facing right, use a little forward pitch to pass the wide gate on the new straight.',
            'Коли ніс спрямований праворуч, малим тангажем уперед пройдіть широкі ворота на новій прямій.',
          ],
          [
            'Pitch is relative to the aircraft. Yaw changed the direction that “forward” means.',
            'Тангаж діє відносно дрона. Рискання змінило напрямок, який означає «вперед».',
          ],
          'pitch',
          'route',
          0.25,
          [
            'Make one small correction at a time and keep checking height.',
            'Робіть по одній малій поправці й продовжуйте стежити за висотою.',
          ],
        ),
      ],
      schoolLand(12, -8),
    ],
  ),
  schoolLesson(
    9,
    {
      title: ['See through the goggles', 'Погляд через окуляри'],
      summary: [
        'Fly from the drone camera, read the horizon, and approach two landmarks calmly.',
        'Летіть із камери дрона, читайте горизонт і спокійно підійдіть до двох орієнтирів.',
      ],
      concept: [
        'FPV means seeing through the aircraft camera. The camera tilts and turns with the drone, so the horizon helps explain your attitude.',
        'FPV означає погляд через камеру апарата. Камера нахиляється та повертається разом із дроном, тому горизонт допомагає зрозуміти його положення.',
      ],
      chapter: 'first-flight',
      camera: 'fpv',
      duration: 4,
    },
    [
      schoolLift(),
      [
        schoolHold(0, 2.5, -7, { maxSpeed: 1500, heading: 0 }),
        schoolNote(
          ['Approach the front landmark', 'Наблизьтеся до переднього орієнтира'],
          [
            'In the camera view, use small forward pitch to approach the bright box. Slow down before the box fills your view.',
            'У вигляді з камери малим тангажем уперед наблизьтеся до яскравого об’єму. Сповільніться, перш ніж він заповнить екран.',
          ],
          [
            'Nearby objects move across the view faster. The horizon tilts with your drone; it does not mean the whole world is turning.',
            'Близькі предмети швидше рухаються екраном. Горизонт нахиляється разом із дроном; це не означає, що обертається весь світ.',
          ],
          'pitch',
          'pitch',
          0.2,
          [
            'Keep the target near the centre and use the height readout when the ground is hard to judge.',
            'Тримайте ціль поблизу центру та користуйтеся висотоміром, коли складно оцінити відстань до землі.',
          ],
        ),
      ],
      [
        schoolHold(5, 2.5, -7, { maxSpeed: 1500, heading: 0 }),
        schoolNote(
          ['Slide to the side landmark', 'Посуньтеся до бічного орієнтира'],
          [
            'Keep facing forward. Roll gently right toward the next box, then bank left briefly to brake.',
            'Дивіться вперед. Плавно дайте крен праворуч до наступного об’єму, потім коротко нахиліть ліворуч для гальмування.',
          ],
          [
            'A tilted horizon shows roll. The sideways movement you see comes from the same roll control you learned from outside.',
            'Нахилений горизонт показує крен. Видимий бічний рух походить від того самого керування креном, яке ви вивчили зовні.',
          ],
          'roll',
          'roll',
          0.2,
          [
            'The control diagram still shows the same sticks; only your viewpoint changed.',
            'Схема показує ті самі стіки — змінилася лише точка огляду.',
          ],
        ),
      ],
      schoolLand(5, -7),
    ],
  ),
  schoolLesson(
    10,
    {
      title: ['Three friendly gates', 'Троє дружніх воріт'],
      summary: [
        'Follow three wide, gentle openings in order and land beyond the last one.',
        'Послідовно пройдіть три широкі прості отвори й сядьте за останнім.',
      ],
      concept: [
        'A gate has an opening and an approach direction. Aim through its centre, then look for the next marker before making a correction.',
        'Ворота мають отвір і напрямок підходу. Цільтеся крізь центр, а перед поправкою шукайте наступний маркер.',
      ],
      chapter: 'first-flight',
      camera: 'fpv',
      duration: 5,
    },
    [
      schoolLift(),
      ...[
        [-6, 0],
        [-12, 2],
        [-18, -2],
      ].map(([z, side], index) => [
        schoolGate('z', z, side, -1),
        schoolNote(
          [`Pass gate ${index + 1}`, `Пройдіть ворота ${index + 1}`],
          [
            'Approach from the arrow side at a calm speed. Keep the opening ahead, make small pitch/roll corrections, and fly all the way through.',
            'Підходьте з боку стрілки на спокійній швидкості. Тримайте отвір попереду, робіть малі поправки тангажу/крену й повністю пролетіть крізь нього.',
          ],
          [
            'The gate counts when you cross its plane in the marked direction and inside the opening; hovering beside it is not a crossing.',
            'Ворота зараховуються під час перетину їхньої площини в позначеному напрямку всередині отвору; зависання поруч не є проходженням.',
          ],
          'mixed',
          'route',
          0.22,
          [
            'Missed it? Slow down, return to the approach side, and try again. There is no race timer to beat.',
            'Промахнулися? Сповільніться, поверніться на бік підходу та спробуйте ще раз. Тут не потрібно обганяти таймер.',
          ],
          1,
          [0, 1, -1][index],
        ),
      ]),
      schoolLand(-2, -22),
    ],
  ),
  schoolLesson(
    11,
    {
      title: ['Your first solo route', 'Ваш перший самостійний маршрут'],
      summary: [
        'Put it together: lift, travel, turn, pass a gate, hover and land.',
        'Поєднайте все: зліт, рух, поворот, ворота, зависання та посадку.',
      ],
      concept: [
        'You now coordinate thrust, attitude, heading and momentum. Fly smoothly at your own pace; control matters more than speed.',
        'Тепер ви узгоджуєте тягу, нахил, курс та імпульс. Летіть плавно у власному темпі: контроль важливіший за швидкість.',
      ],
      chapter: 'first-flight',
      camera: 'fpv',
      duration: 6,
    },
    [
      schoolLift(),
      [
        schoolGate('z', -6, 0, -1),
        schoolNote(
          ['Begin your first straight', 'Почніть першу пряму'],
          [
            'Lift, keep a steady height, and fly through the first wide gate. You know the controls—use small, calm inputs.',
            'Підніміться, тримайте висоту й пройдіть перші широкі ворота. Ви вже знаєте керування — рухайте стіки спокійно й небагато.',
          ],
          [
            'Smooth inputs leave you time to see the next task and adjust.',
            'Плавне керування залишає час побачити наступне завдання й скоригувати політ.',
          ],
          'pitch',
          'route',
          0.22,
          [
            'The next marker tells you where to go; your real controls still do all the flying.',
            'Наступний маркер показує шлях; усім польотом досі керуєте ви.',
          ],
        ),
      ],
      [
        schoolHold(0, 2.5, -11, { maxSpeed: 1500, heading: 9000 }),
        schoolNote(
          ['Slow and face the turn', 'Сповільніться й поверніть ніс'],
          [
            'Brake into the corner box, then yaw right to face the next gate. Hold a calm height while changing heading.',
            'Загальмуйте в об’ємі на повороті й рисканням поверніть праворуч до наступних воріт. Підтримуйте висоту, змінюючи курс.',
          ],
          [
            'Slowing first separates the tasks and makes a beginner turn easier to control.',
            'Попереднє сповільнення розділяє завдання й полегшує контроль повороту для початківця.',
          ],
          'yaw',
          'yaw',
          0.25,
          [
            'Brake drift before turning if the box keeps sliding past you.',
            'Якщо об’єм продовжує пропливати повз вас, спершу погасіть дрейф.',
          ],
        ),
      ],
      [
        schoolGate('x', 9, -11, 1),
        schoolNote(
          ['Take the second straight', 'Пройдіть другу пряму'],
          [
            'Pitch forward along the new direction and pass the second gate. Begin slowing for the landing area beyond it.',
            'Тангажем уперед рушіть у новому напрямку й пройдіть другі ворота. Почніть сповільнюватися до зони посадки за ними.',
          ],
          [
            'Good approaches start early: set up the next move before you reach it.',
            'Вдалий підхід починається завчасно: готуйте наступний рух до прибуття.',
          ],
          'pitch',
          'route',
          0.22,
          [
            'Stay relaxed; there is plenty of space around this route.',
            'Не поспішайте: навколо цього маршруту багато простору.',
          ],
        ),
      ],
      [
        schoolHold(14, 2, -11, { ticks: 75, maxSpeed: 1200 }),
        schoolNote(
          ['Hover above home', 'Зависніть над фінішним майданчиком'],
          [
            'Brake over the final pad and hold a gentle hover. Once your drift is small, prepare to descend.',
            'Загальмуйте над кінцевим майданчиком і спокійно зависніть. Коли дрейф зменшиться, підготуйтеся до спуску.',
          ],
          [
            'A stable position above the pad makes the final descent easier.',
            'Стабільне положення над майданчиком полегшує завершальний спуск.',
          ],
          'mixed',
          'hover',
          0.5,
          [
            'One last small correction is better than a rushed landing.',
            'Остання мала поправка краща за поспішну посадку.',
          ],
        ),
      ],
      schoolLand(14, -11),
    ],
  ),
  schoolLesson(
    12,
    {
      title: ['Acro: the tilt stays', 'Acro: нахил зберігається'],
      summary: [
        'Try the key Acro difference: tip a little, centre the stick, then actively level again.',
        'Спробуйте головну відмінність Acro: трохи нахиліть, центруйте стік і активно вирівняйтеся.',
      ],
      concept: [
        'In Acro, pitch and roll command rotation rate. Centring stops asking for rotation but does not level the drone. Opposite input changes the attitude back.',
        'У режимі Acro тангаж і крен задають швидкість обертання. Центрування припиняє команду обертатися, але не вирівнює дрон. Протилежний рух повертає його положення.',
      ],
      chapter: 'acro',
      mode: 'acro',
      duration: 5,
    },
    [
      schoolLift(4),
      [
        schoolHold(0, 4, 0, {
          ticks: 12,
          minTilt: 600,
          maxTilt: 1800,
          maxSpeed: 12000,
          centred: true,
          min: p(-12, 1, -12),
          max: p(12, 10, 12),
        }),
        schoolNote(
          ['Tip, then centre', 'Нахиліть і центруйте'],
          [
            'Give a very short forward pitch input, then centre pitch, roll and yaw. Keep throttle active. Notice the small tilt staying after you let go.',
            'Дуже коротко подайте тангаж уперед, тоді центруйте тангаж, крен і рискання. Продовжуйте керувати газом. Помітьте, як малий нахил лишається після відпускання.',
          ],
          [
            'This checkpoint needs a small 6–18° tilt with the rotation controls centred. Acro does not automatically return to the horizon.',
            'Ця перевірка потребує малого нахилу 6–18° із центрованими осями обертання. Acro не повертає до горизонту автоматично.',
          ],
          'pitch',
          'acro',
          0.12,
          [
            'Use a brief tap, not a held deflection. Keyboard: hold Shift for smaller input.',
            'Зробіть короткий рух, а не тримайте відхилення. На клавіатурі утримуйте Shift для меншого впливу.',
          ],
        ),
      ],
      [
        schoolHold(0, 4, 0, {
          ticks: 35,
          maxTilt: 600,
          maxSpeed: 12000,
          centred: true,
          min: p(-16, 1, -16),
          max: p(16, 12, 16),
        }),
        schoolNote(
          ['Actively return to level', 'Активно поверніться до горизонту'],
          [
            'Tap the opposite pitch direction to rotate back toward level. Centre the stick again when the drone is level; keep managing throttle.',
            'Коротко подайте протилежний тангаж, щоб повернутися до горизонту. Коли дрон вирівняється, знову центруйте стік і продовжуйте керувати газом.',
          ],
          [
            'Opposite input first changes the attitude. Becoming level still does not remove the drift you already built.',
            'Протилежний рух спершу змінює положення. Вирівнювання все ще не прибирає вже набраний дрейф.',
          ],
          'pitch',
          'acro',
          0.12,
          [
            'If you pass through level, gently correct back; avoid holding the opposite input too long.',
            'Якщо пройшли горизонт, плавно виправте назад; не тримайте протилежний рух надто довго.',
          ],
          -1,
        ),
      ],
      schoolLand(),
    ],
  ),
  schoolLesson(
    13,
    {
      title: ['Acro: your first line', 'Acro: ваша перша траєкторія'],
      summary: [
        'Use small Acro rotations to fly one wide gate, settle, and land.',
        'Малими обертаннями Acro пройдіть одні широкі ворота, зупиніться й сядьте.',
      ],
      concept: [
        'Acro needs deliberate tilt, levelling and braking. Learn one short line at a time; smooth control is a useful next step before harder courses.',
        'Acro потребує свідомого нахилу, вирівнювання та гальмування. Вивчайте по одному короткому відрізку; плавний контроль — корисний крок перед складнішими курсами.',
      ],
      chapter: 'acro',
      mode: 'acro',
      camera: 'fpv',
      duration: 6,
    },
    [
      schoolLift(3),
      [
        schoolGate('z', -7, 0, -1, 3),
        schoolNote(
          ['Set a small forward tilt', 'Задайте малий нахил уперед'],
          [
            'Tap pitch forward to establish a small tilt, then centre. Keep enough throttle for height and guide the drone through the wide gate.',
            'Коротко подайте тангаж уперед для малого нахилу, тоді центруйте стік. Підтримуйте висоту газом і спрямуйте дрон крізь широкі ворота.',
          ],
          [
            'Unlike self-level, the centred stick leaves the attitude you set. Keep watching the horizon so the tilt does not grow unnoticed.',
            'На відміну від самовирівнювання, центрований стік залишає заданий нахил. Стежте за горизонтом, щоб нахил не зростав непомітно.',
          ],
          'pitch',
          'acro',
          0.12,
          [
            'Tiny corrections are enough. Release the rotation control after each adjustment.',
            'Достатньо малих поправок. Відпускайте керування обертанням після кожної зміни.',
          ],
        ),
      ],
      [
        schoolHold(0, 3, -12, { ticks: 75, maxSpeed: 1400, maxTilt: 1400 }),
        schoolNote(
          ['Counter-rotate and brake', 'Поверніть нахил і загальмуйте'],
          [
            'Use opposite pitch to level and then add a small backward tilt to brake. As speed falls, rotate back to level and centre the controls.',
            'Протилежним тангажем вирівняйтеся, а потім задайте малий нахил назад для гальмування. Коли швидкість спаде, поверніться до горизонту й центруйте керування.',
          ],
          [
            'Levelling and braking are two different actions. One changes attitude; the other creates force against your drift.',
            'Вирівнювання та гальмування — різні дії. Перша змінює положення, друга створює силу проти дрейфу.',
          ],
          'pitch',
          'brake',
          0.12,
          [
            'There is no need for a flip or sharp bank. Calm control completes this lesson.',
            'Перевороти чи різкі нахили не потрібні. Урок завершується спокійним керуванням.',
          ],
          -1,
        ),
      ],
      schoolLand(0, -12),
    ],
  ),
]);
// Keep the original fourteen course bytes and pack identity available forever:
// old playlists, progress and recordings must survive this additive curriculum.
const BEGINNER_IDENTITY = `fpv-beginner:${dataIdentity(ORIGINAL_BEGINNER_LESSONS.map((lesson) => lesson.course))}`;
const acroNote = (
  title,
  instruction,
  why,
  axis = 'mixed',
  motion = 'acro',
  direction = 1,
  target = axis === 'throttle' ? 0.54 : 0.12,
  lateralDirection,
) =>
  schoolNote(
    title,
    instruction,
    why,
    axis,
    motion,
    target,
    [
      'Make a brief, small correction, centre the rotation controls, and check the horizon and drift before correcting again. Shift makes keyboard input gentler.',
      'Зробіть коротку малу поправку, центруйте осі обертання й перевірте горизонт та дрейф перед наступною поправкою. Shift пом’якшує керування клавіатурою.',
    ],
    direction,
    lateralDirection,
  );
const acroStage = (
  objective,
  title,
  instruction,
  why,
  axis,
  motion,
  direction,
  target,
  lateralDirection,
) => [
  objective,
  acroNote(title, instruction, why, axis, motion, direction, target, lateralDirection),
];
const acroLesson = (index, title, summary, concept, stages, duration = 5) =>
  schoolLesson(
    index,
    { title, summary, concept, chapter: 'acro', mode: 'acro', camera: 'fpv', duration },
    stages,
  );
const NEW_ACRO_LESSONS = Object.freeze([
  acroLesson(
    14,
    ['Your first Acro takeoff', 'Ваш перший зліт в Acro'],
    [
      'Meet all four controls, arm deliberately and make a small lift.',
      'Познайомтеся з чотирма осями, свідомо увімкніть мотори й трохи підніміться.',
    ],
    [
      'Throttle sets thrust. Pitch, roll and yaw set rotation rate. Centred sticks stop commanding rotation; they do not return you to level.',
      'Газ задає тягу. Тангаж, крен і рискання задають швидкість обертання. Центровані стіки припиняють команду обертатися, але не вирівнюють дрон.',
    ],
    [
      acroStage(
        schoolHold(0, 0, 0, { ticks: 40, maxSpeed: 500, maxTilt: 1000, centred: true }),
        ['Ground check', 'Перевірка на землі'],
        [
          'Set throttle fully down, centre the other axes and arm. Keep the drone still on the pad before adding power.',
          'Приберіть газ, центруйте решту осей і увімкніть мотори. Потримайте дрон нерухомо на майданчику перед додаванням тяги.',
        ],
        [
          'Arming and adding throttle are separate actions. Cyan dots show your live input; amber dots show recorded example input. The hollow guide and short trail help you follow the movement.',
          'Увімкнення моторів і додавання газу — різні дії. Блакитні крапки показують ваш сигнал, жовті — записаний приклад. Порожня підказка й короткий слід допомагають простежити рух.',
        ],
        'throttle',
        'hover',
        1,
        0,
      ),
      schoolLift(1.4),
      schoolLand(),
    ],
    4,
  ),
  acroLesson(
    15,
    ['Thrust, climb and descent', 'Тяга, підйом і спуск'],
    [
      'Visit a low target, climb to the high target and descend under control.',
      'Відвідайте низьку ціль, підніміться до високої та керовано спустіться.',
    ],
    [
      'Height is the result of thrust and momentum, not the position of the throttle stick. Reduce thrust before reaching your chosen height.',
      'Висота залежить від тяги та інерції, а не від положення стіка газу. Зменшуйте тягу до досягнення потрібної висоти.',
    ],
    [
      schoolLift(1.8),
      acroStage(
        schoolHold(0, 4.5, 0, { ticks: 60, maxSpeed: 1200, maxTilt: 1500 }),
        ['Climb, then ease off', 'Підніміться й зменште газ'],
        [
          'Keep the horizon level. Add a little throttle to climb toward 4.5 m, then ease it back and settle inside the target.',
          'Тримайте горизонт рівним. Трохи додайте газ до 4,5 м, потім зменште й зупиніться всередині цілі.',
        ],
        [
          'At hover thrust, an existing climb takes time to slow down. Anticipate rather than chase the height marker.',
          'На тязі зависання вже набраний підйом сповільнюється не одразу. Передбачайте рух замість погоні за позначкою.',
        ],
        'throttle',
        'lift',
      ),
      acroStage(
        schoolHold(0, 2, 0, { ticks: 70, maxSpeed: 1000, maxTilt: 1500 }),
        ['Catch the descent', 'Зупиніть спуск'],
        [
          'Lower thrust slightly, watch your downward speed, and add a little back before reaching 2 m.',
          'Трохи зменште тягу, стежте за швидкістю спуску й знову додайте її до досягнення 2 м.',
        ],
        [
          'Cutting throttle is a fall. A controlled descent needs enough thrust to slow down before the ground.',
          'Прибрати газ означає падати. Керований спуск потребує тяги для гальмування до землі.',
        ],
        'throttle',
        'land',
        -1,
      ),
      schoolLand(),
    ],
  ),
  acroLesson(
    16,
    ['Level, then find your hover', 'Вирівняйтеся й знайдіть зависання'],
    [
      'Practise an intentional tilt, active levelling and a calm hover.',
      'Відпрацюйте навмисний нахил, активне вирівнювання та спокійне зависання.',
    ],
    [
      'A level horizon is attitude; staying over a marker is position. First level, then counter any remaining drift.',
      'Рівний горизонт — це орієнтація; утримання над позначкою — це позиція. Спершу вирівняйтеся, потім погасіть решту дрейфу.',
    ],
    [
      schoolLift(4),
      acroStage(
        schoolHold(0, 4, 0, {
          ticks: 12,
          minTilt: 600,
          maxTilt: 1400,
          maxSpeed: 9000,
          centred: true,
          min: p(-10, 1, -10),
          max: p(10, 9, 10),
        }),
        ['Set a small tilt and release', 'Задайте малий нахил і відпустіть'],
        [
          'Tap pitch forward briefly. Centre all rotation controls and observe the 6–14° tilt staying.',
          'Коротко подайте тангаж уперед. Центруйте осі обертання й помітьте збереження нахилу 6–14°.',
        ],
        [
          'The stick controls rotation speed, not a target angle. Release early to avoid an excessive tilt.',
          'Стік керує швидкістю обертання, а не потрібним кутом. Відпускайте завчасно, щоб уникнути надмірного нахилу.',
        ],
        'pitch',
      ),
      acroStage(
        schoolHold(0, 4, 0, { ticks: 100, maxTilt: 800, maxSpeed: 800 }),
        ['Level and stop the drift', 'Вирівняйтеся й зупиніть дрейф'],
        [
          'Tap opposite pitch back toward level. If you are still moving, briefly lean against that drift, then level again and hold over the pad.',
          'Протилежним тангажем поверніться до горизонту. Якщо рух триває, коротко нахиліться проти дрейфу, знову вирівняйтеся й утримуйте позицію над майданчиком.',
        ],
        [
          'The checkpoint needs a low tilt and low speed together. Centring alone cannot satisfy both after a drift.',
          'Перевірка потребує водночас малого нахилу й малої швидкості. Після дрейфу самого центрування недостатньо.',
        ],
        'pitch',
        'brake',
        -1,
      ),
      schoolLand(),
    ],
  ),
  acroLesson(
    17,
    ['Roll and lateral braking', 'Крен і бічне гальмування'],
    [
      'Move right, brake, then cross left without turning the nose.',
      'Рухайтеся праворуч, загальмуйте й перейдіть ліворуч без повороту носа.',
    ],
    [
      'Roll tilts the thrust sideways. Opposite roll first levels you, then creates a braking tilt; yaw changes heading instead.',
      'Крен нахиляє тягу вбік. Протилежний крен спершу вирівнює, а потім створює гальмівний нахил; рискання натомість змінює курс.',
    ],
    [
      schoolLift(3),
      ...[
        [6, 1],
        [-6, -1],
      ].map(([x, direction]) =>
        acroStage(
          schoolHold(x, 3, 0, { ticks: 70, heading: 0, maxSpeed: 1000, maxTilt: 1200 }),
          [
            direction > 0 ? 'Slide right and brake' : 'Slide left and brake',
            direction > 0 ? 'Праворуч і гальмування' : 'Ліворуч і гальмування',
          ],
          [
            direction > 0
              ? 'Tap roll right and centre. Counter-roll before the right target, level as speed falls, and keep the nose facing north.'
              : 'Tap roll left and centre. Brake before the left target with a brief right tilt, then level.',
            direction > 0
              ? 'Коротко подайте крен праворуч і центруйте. До правої цілі задайте протилежний крен, вирівняйтеся при сповільненні й тримайте ніс на північ.'
              : 'Коротко подайте крен ліворуч і центруйте. До лівої цілі загальмуйте малим правим нахилом, потім вирівняйтеся.',
          ],
          [
            'A stopped sideways drift needs force in the opposite direction; pointing the nose somewhere else does not brake it.',
            'Для зупинки бічного дрейфу потрібна сила у протилежному напрямку; поворот носа його не гальмує.',
          ],
          'roll',
          'roll',
          direction,
        ),
      ),
      schoolLand(-6, 0),
    ],
  ),
  acroLesson(
    18,
    ['Yaw: heading is not travel', 'Рискання: курс — не рух'],
    [
      'Turn on the spot, then travel toward the new heading.',
      'Поверніться на місці, потім рушайте за новим курсом.',
    ],
    [
      'Yaw rotates the nose around the vertical axis. Travel follows tilted thrust and existing momentum, not the new heading by itself.',
      'Рискання обертає ніс навколо вертикальної осі. Рух визначають нахилена тяга та інерція, а не новий курс сам собою.',
    ],
    [
      schoolLift(3),
      ...[9000, -9000, 0].map((heading) =>
        acroStage(
          schoolHold(0, 3, 0, { ticks: 55, heading, maxSpeed: 1300, maxTilt: 1500 }),
          [
            heading === 9000 ? 'Face east' : heading === -9000 ? 'Face west' : 'Face north again',
            heading === 9000
              ? 'Поверніться на схід'
              : heading === -9000
                ? 'Поверніться на захід'
                : 'Знову на північ',
          ],
          [
            `Keep hovering above the pad. Yaw gently toward ${heading === 9000 ? 'east' : heading === -9000 ? 'west' : 'north'} and centre before overshooting.`,
            `Утримуйте зависання над майданчиком. Плавно поверніть ніс ${heading === 9000 ? 'на схід' : heading === -9000 ? 'на захід' : 'на північ'} й завчасно центруйте стік.`,
          ],
          [
            'Watch the compass and the ground marker separately: heading can change while your position stays the same.',
            'Стежте окремо за компасом і наземною позначкою: курс може змінюватися без зміни позиції.',
          ],
          'yaw',
          'yaw',
          heading < 0 ? -1 : 1,
        ),
      ),
      acroStage(
        schoolHold(0, 3, -7, { maxSpeed: 1100, heading: 0 }),
        ['Now travel north', 'Тепер рушайте на північ'],
        [
          'Set a small forward pitch and travel to the northern target. Brake and level before landing.',
          'Задайте малий тангаж уперед і рушайте до північної цілі. Загальмуйте й вирівняйтеся перед посадкою.',
        ],
        [
          'Pitch supplies the horizontal thrust that yaw alone did not provide.',
          'Тангаж дає горизонтальну тягу, якої не давало саме рискання.',
        ],
        'pitch',
      ),
      schoolLand(0, -7),
    ],
  ),
  acroLesson(
    19,
    ['Keep height while tilted', 'Тримайте висоту в нахилі'],
    [
      'Cross two gates at different heights and settle on the far pad.',
      'Пройдіть двоє воріт на різній висоті й сядьте на дальній майданчик.',
    ],
    [
      'When tilted, some thrust points sideways. Add only the extra thrust needed for height, then reduce it as you level.',
      'У нахилі частина тяги спрямована вбік. Додайте лише потрібну для висоти тягу й зменште її під час вирівнювання.',
    ],
    [
      schoolLift(3),
      ...[
        [-7, 4],
        [-15, 2.5],
      ].map(([z, y]) =>
        acroStage(
          schoolGate('z', z, 0, -1, y),
          [
            y === 4 ? 'Climb while moving' : 'Descend while moving',
            y === 4 ? 'Наберіть висоту в русі' : 'Знизьтеся в русі',
          ],
          [
            `Use a small forward tilt. Adjust thrust to approach the ${y} m gate with a calm horizon and modest speed.`,
            `Використайте малий нахил уперед. Скоригуйте тягу для підходу до воріт на ${y} м зі спокійним горизонтом і помірною швидкістю.`,
          ],
          [
            'Changing thrust changes acceleration. Watch the target and vertical speed together, and make one small correction at a time.',
            'Зміна тяги змінює прискорення. Стежте водночас за ціллю та вертикальною швидкістю й робіть по одній малій поправці.',
          ],
          'mixed',
          'lift',
          y === 4 ? 1 : -1,
        ),
      ),
      acroStage(
        schoolHold(0, 2.5, -20, { maxSpeed: 1100 }),
        ['Settle after the gates', 'Зупиніться після воріт'],
        [
          'Brake over the pad and return to level. Ease off the extra turning throttle as the drone levels.',
          'Загальмуйте над майданчиком і вирівняйтеся. Під час вирівнювання зменште додатковий газ.',
        ],
        [
          'Level thrust points upward again. Leaving the extra throttle in place starts an unwanted climb.',
          'Після вирівнювання тяга знову спрямована вгору. Зайвий газ почне небажаний підйом.',
        ],
        'pitch',
        'brake',
        -1,
      ),
      schoolLand(0, -20),
    ],
  ),
  acroLesson(
    20,
    ['Coordinated left and right turns', 'Узгоджені ліві та праві повороти'],
    [
      'Fly a wide right corner and a wide left corner with the nose following your path.',
      'Пройдіть широкий правий і широкий лівий повороти, спрямовуючи ніс за маршрутом.',
    ],
    [
      'A gentle bank bends the path; yaw points the camera along it; throttle supports the tilted drone. Reduce the bank to exit the turn.',
      'Малий крен вигинає траєкторію; рискання спрямовує камеру вздовж неї; газ підтримує нахилений дрон. Зменшуйте крен на виході.',
    ],
    [
      schoolLift(3),
      ...[
        [0, -7, 0],
        [8, -10, 9000],
        [14, -17, 0],
      ].map(([x, z, heading], i) =>
        acroStage(
          schoolHold(x, 3, z, { ticks: 35, heading, maxSpeed: 2500, maxTilt: 2500 }),
          [
            ['Approach the corner', 'Enter the right turn', 'Exit through a left turn'][i],
            ['Підхід до повороту', 'Правий поворот', 'Вихід лівим поворотом'][i],
          ],
          [
            [
              'Approach the first marker slowly, looking north.',
              'Bank gently right and yaw toward east. Keep height with small throttle changes; relax the bank as you reach the target.',
              'Bank gently left and yaw back north. Straighten the horizon as the new line opens.',
            ][i],
            [
              'Повільно підійдіть до першої позначки, дивлячись на північ.',
              'Плавно нахиліться праворуч і поверніть ніс на схід. Підтримуйте висоту малими змінами газу; зменшуйте крен біля цілі.',
              'Плавно нахиліться ліворуч і поверніть ніс на північ. Вирівняйте горизонт, коли відкриється новий відрізок.',
            ][i],
          ],
          [
            'The checkpoint checks heading as well as position. Nose direction and path direction must be managed together.',
            'Перевірка оцінює курс разом із позицією. Напрям носа й траєкторію потрібно узгоджувати.',
          ],
          i === 0 ? 'pitch' : 'mixed',
          i === 0 ? 'pitch' : 'turn',
          i === 2 ? -1 : 1,
        ),
      ),
      schoolLand(14, -17),
    ],
    6,
  ),
  acroLesson(
    21,
    ['A gentle figure eight', 'Плавна вісімка'],
    [
      'Join two wide loops, changing turn direction through the centre.',
      'Поєднайте дві широкі петлі, змінивши напрям повороту в центрі.',
    ],
    [
      'Look toward the next marker. Relax one bank before beginning the opposite one, and keep space to correct.',
      'Дивіться на наступну позначку. Послабте один крен перед протилежним і залишайте простір для поправок.',
    ],
    [
      schoolLift(3.5),
      ...[
        [-7, -7, -9000],
        [-14, 0, -18000],
        [-7, 7, 9000],
        [0, 0, 0],
        [7, -7, 9000],
        [14, 0, -18000],
        [7, 7, -9000],
        [0, 0, 0],
      ].map(([x, z, heading], i) =>
        acroStage(
          schoolHold(x, 3.5, z, { ticks: 15, heading, maxSpeed: 3500, maxTilt: 3000 }),
          [`Loop marker ${i + 1} of 8`, `Позначка петлі ${i + 1} з 8`],
          [
            i === 7
              ? 'Return through the centre, level and face north. Slow the drift before descending onto the landing pad.'
              : i === 3
                ? 'Return through the centre, level briefly and face north. Prepare the opposite bank only after releasing this turn.'
                : `Follow the ${i < 4 ? 'left' : 'right'} loop to the lit marker. Keep the nose following the curve and leave room to slow down.`,
            i === 7
              ? 'Поверніться через центр, вирівняйтеся й поверніть ніс на північ. Погасіть дрейф перед спуском на посадковий майданчик.'
              : i === 3
                ? 'Поверніться через центр, коротко вирівняйтеся й поверніть ніс на північ. Починайте протилежний крен після завершення цього повороту.'
                : `Прямуйте ${i < 4 ? 'лівою' : 'правою'} петлею до підсвіченої позначки. Спрямовуйте ніс уздовж кривої й залишайте місце для гальмування.`,
          ],
          [
            'A figure eight combines both turning directions. Smooth direction changes matter more than speed.',
            'Вісімка поєднує обидва напрями поворотів. Плавна зміна напрямку важливіша за швидкість.',
          ],
          'mixed',
          'turn',
          i < 4 ? -1 : 1,
        ),
      ),
      schoolLand(),
    ],
    7,
  ),
  acroLesson(
    22,
    ['Read the FPV horizon', 'Читайте горизонт у FPV'],
    [
      'Use the horizon, compass and two landmarks to judge attitude and movement.',
      'За горизонтом, компасом і двома орієнтирами оцініть положення й рух.',
    ],
    [
      'Camera tilt changes the view but not the drone attitude. The horizon shows lean; ground motion shows travel. Use the small drone guide when unsure.',
      'Нахил камери змінює вигляд, але не положення дрона. Горизонт показує нахил; рух землі — переміщення. За сумніву погляньте на малу схему дрона.',
    ],
    [
      schoolLift(3),
      ...[
        [0, -8, 0],
        [6, -8, 0],
        [6, -14, 0],
      ].map(([x, z, heading], i) =>
        acroStage(
          schoolHold(x, 3, z, { ticks: 60, heading, maxSpeed: 1200, maxTilt: 1400 }),
          [
            [
              'Approach the northern marker',
              'Move sideways with the same view',
              'Keep the horizon calm',
            ][i],
            ['Підхід до північної позначки', 'Рух убік із тим самим курсом', 'Спокійний горизонт'][
              i
            ],
          ],
          [
            [
              'Use a short forward pitch, then watch the ground move below you. Brake as the marker grows in the view.',
              'Keep facing north. Use roll to move right, then counter-roll to brake over the second marker.',
              'Move toward the far marker and settle. Compare the level horizon with the remaining ground drift before landing.',
            ][i],
            [
              'Коротко подайте тангаж уперед і спостерігайте за рухом землі. Гальмуйте, коли позначка збільшується у кадрі.',
              'Дивіться на північ. Креном рушайте праворуч, потім протилежним креном загальмуйте над другою позначкою.',
              'Рушайте до дальньої позначки й зупиніться. Порівняйте рівний горизонт із рештою дрейфу землі перед посадкою.',
            ][i],
          ],
          [
            'A level-looking view is not proof of zero speed. Read the ground motion and the speed indicator as well.',
            'Рівний вигляд не доводить нульову швидкість. Також читайте рух землі та показник швидкості.',
          ],
          i === 1 ? 'roll' : 'pitch',
          i === 1 ? 'roll' : 'pitch',
        ),
      ),
      schoolLand(6, -14),
    ],
  ),
  acroLesson(
    23,
    ['Three gates, one smooth line', 'Троє воріт, одна плавна траєкторія'],
    [
      'Fly ordered gates with small lateral and height corrections.',
      'Пройдіть ворота по порядку з малими бічними та висотними поправками.',
    ],
    [
      'Prepare for the next gate before crossing the current one. Aim through the opening, not at its frame, and leave room to brake.',
      'Готуйтеся до наступних воріт перед проходженням поточних. Цільтеся у отвір, а не раму, і залишайте місце для гальмування.',
    ],
    [
      schoolLift(3),
      ...[
        [-6, 0, 3],
        [-13, 3, 3.5],
        [-21, -2, 2.5],
      ].map(([z, x, y], i) =>
        acroStage(
          schoolGate('z', z, x, -1, y),
          [`Gate ${i + 1}: look through the opening`, `Ворота ${i + 1}: дивіться крізь отвір`],
          [
            `Fly through the highlighted gate ${i + 1} toward north. Use small roll corrections for alignment and watch the next gate after crossing.`,
            `Пройдіть підсвічені ворота ${i + 1} на північ. Малими поправками крену вирівнюйте траєкторію та шукайте наступні ворота після проходу.`,
          ],
          [
            'Only a crossing in the indicated direction counts. Being near the gate or flying around its frame does not count.',
            'Зараховується лише прохід у зазначеному напрямку. Наближення чи обліт рами не зараховуються.',
          ],
          'mixed',
          'pitch',
          1,
          undefined,
          [0, 1, -1][i],
        ),
      ),
      schoolLand(-2, -25),
    ],
    6,
  ),
  acroLesson(
    24,
    ['Recover and land precisely', 'Відновіть контроль і точно сядьте'],
    [
      'Practise a small upset, recover your horizon and settle onto a smaller target.',
      'Відпрацюйте малий нахил, відновіть горизонт і сядьте на меншу ціль.',
    ],
    [
      'Recovery means stop adding rotation, return to level, then control drift and descent. It does not require a flip or an abrupt throttle cut.',
      'Відновлення означає припинити нарощувати обертання, вирівнятися, а потім керувати дрейфом і спуском. Переворот чи різке вимкнення газу не потрібні.',
    ],
    [
      schoolLift(4.5),
      acroStage(
        schoolHold(0, 4.5, 0, {
          ticks: 12,
          minTilt: 1000,
          maxTilt: 2000,
          maxSpeed: 10000,
          centred: true,
          min: p(-12, 1, -12),
          max: p(12, 10, 12),
        }),
        ['Create a small, recoverable tilt', 'Задайте малий керований нахил'],
        [
          'Briefly roll right to a 10–20° bank, then centre. Keep altitude and avoid increasing the bank.',
          'Коротко подайте крен праворуч до 10–20°, тоді центруйте. Зберігайте висоту й не збільшуйте нахил.',
        ],
        [
          'This deliberate small upset gives you space to practise recovery without a surprise or a forced crash.',
          'Цей навмисний малий нахил залишає простір для відновлення без несподіванки чи примусової аварії.',
        ],
        'roll',
        'roll',
      ),
      acroStage(
        schoolHold(0, 3, 0, {
          ticks: 80,
          maxSpeed: 700,
          maxTilt: 700,
          min: p(-1.2, 2.2, -1.2),
          max: p(1.2, 3.8, 1.2),
        }),
        ['Level, brake, return', 'Вирівняйтеся, загальмуйте, поверніться'],
        [
          'Counter-roll to level, brake the drift and return above the pad. Settle inside the smaller target before descending.',
          'Протилежним креном вирівняйтеся, загальмуйте дрейф і поверніться над майданчиком. Зупиніться всередині меншої цілі перед спуском.',
        ],
        [
          'The tighter target checks position, speed and attitude together. Take as long as needed to settle.',
          'Вужча ціль одночасно перевіряє позицію, швидкість і положення. Не поспішайте зі стабілізацією.',
        ],
        'roll',
        'brake',
        -1,
      ),
      [
        {
          ...schoolLanding(0, 0),
          min: p(-1, 0, -1),
          max: p(1, 0.8, 1),
          maxSpeed: 800,
          maxTilt: 1000,
        },
        schoolLand()[1],
      ],
    ],
    6,
  ),
  acroLesson(
    25,
    ['Your first solo Acro route', 'Ваш перший самостійний маршрут Acro'],
    [
      'Combine takeoff, gates, both turning directions, braking and a soft landing.',
      'Поєднайте зліт, ворота, обидва напрями поворотів, гальмування й м’яку посадку.',
    ],
    [
      'Use the skills you already practised. Read each next target, make a small input, observe the response and correct calmly.',
      'Використайте вже відпрацьовані навички. Читайте наступну ціль, робіть малий рух, спостерігайте за реакцією й спокійно виправляйте.',
    ],
    [
      schoolLift(3),
      acroStage(
        schoolGate('z', -7, 0, -1, 3),
        ['The opening straight', 'Початкова пряма'],
        [
          'Pass north through the first gate at a comfortable pace.',
          'У комфортному темпі пройдіть перші ворота на північ.',
        ],
        [
          'Starting calmly leaves time to prepare for the turn.',
          'Спокійний початок залишає час підготувати поворот.',
        ],
        'pitch',
      ),
      acroStage(
        schoolHold(0, 3, -13, { ticks: 35, heading: 9000, maxSpeed: 2000 }),
        ['Right toward the next gate', 'Праворуч до наступних воріт'],
        [
          'Slow down, bank gently right and point the nose east.',
          'Сповільніться, плавно нахиліться праворуч і поверніть ніс на схід.',
        ],
        [
          'Brake before a tight direction change, then rebuild speed.',
          'Гальмуйте перед різкою зміною напрямку, потім знову набирайте швидкість.',
        ],
        'mixed',
        'turn',
      ),
      acroStage(
        schoolGate('x', 8, -13, 1, 3),
        ['Cross the eastern gate', 'Пройдіть східні ворота'],
        [
          'Fly east through the second gate with a small forward tilt.',
          'Пройдіть другі ворота на схід із малим нахилом уперед.',
        ],
        [
          'Your pitch direction follows the nose after yawing.',
          'Після рискання напрям тангажу слідує за носом.',
        ],
        'pitch',
      ),
      acroStage(
        schoolHold(14, 3, -13, { ticks: 35, heading: 0, maxSpeed: 1800 }),
        ['Left onto the final line', 'Ліворуч на фінальну пряму'],
        [
          'Brake, turn gently left and face north again.',
          'Загальмуйте, плавно поверніть ліворуч і знову дивіться на північ.',
        ],
        [
          'Unwind the bank as the final path opens.',
          'Прибирайте крен, коли відкриється фінальна траєкторія.',
        ],
        'mixed',
        'turn',
        -1,
      ),
      acroStage(
        schoolGate('z', -21, 14, -1, 3),
        ['The final gate', 'Фінальні ворота'],
        [
          'Cross the last gate and begin braking toward the far pad.',
          'Пройдіть останні ворота й почніть гальмувати до дальнього майданчика.',
        ],
        [
          'A clean finish includes slowing down after the gate.',
          'Акуратний фініш включає гальмування після воріт.',
        ],
        'mixed',
        'pitch',
      ),
      acroStage(
        schoolHold(14, 2.5, -26, { ticks: 75, maxSpeed: 1000, maxTilt: 1200 }),
        ['Hold over home', 'Зависніть над фінішем'],
        [
          'Stop the drift, level the horizon and settle above the landing pad.',
          'Зупиніть дрейф, вирівняйте горизонт і стабілізуйтеся над майданчиком.',
        ],
        [
          'The landing is the last skill, not an afterthought.',
          'Посадка — остання навичка маршруту, а не формальність.',
        ],
        'mixed',
        'hover',
      ),
      schoolLand(14, -26),
    ],
    8,
  ),
]);
// Additional precision and navigation lessons. Existing course definitions above
// remain byte-identical; these lessons have their own compiled content identity.
const masteryHold = (x, y, z, options = {}) => ({
  ...hold(x, y, z, 50, 1800),
  maxSpeed: 1800,
  maxTilt: 2000,
  ...options,
});
const masteryStage = (
  objective,
  title,
  instruction,
  axis = 'mixed',
  motion = 'hover',
  direction = 1,
) =>
  acroStage(
    objective,
    title,
    instruction,
    objective.type === 'gate'
      ? [
          'Read the next opening before turning. A level horizon does not remove existing drift; leave room to brake after the crossing.',
          'Помічайте наступний отвір до повороту. Рівний горизонт не прибирає набраний рух; залишайте місце для гальмування після воріт.',
        ]
      : [
          'Settle inside the highlighted space. Position, speed and orientation are separate: correct the drift, then level before making the next small adjustment.',
          'Стабілізуйтеся в підсвіченій зоні. Позиція, швидкість та орієнтація різні: погасіть дрейф, потім вирівняйтеся перед наступною малою поправкою.',
        ],
    axis,
    motion,
    direction,
  );
const masteryGate = (axis, at, side, direction, y, title, instruction, width = 5) =>
  masteryStage(
    Object.fromEntries(
      Object.entries(gate(axis, at, side, direction, y, width)).map(([key, value]) => [
        key,
        typeof value === 'number' ? Math.round(value) : value,
      ]),
    ),
    title,
    instruction,
    'mixed',
    'route',
    1,
  );
const masterySettle = (x, y, z, title, instruction, options = {}) =>
  masteryStage(masteryHold(x, y, z, options), title, instruction);
const masteryLift = (x, y, z, title = ['Lift into clear space', 'Підніміться у вільний простір']) =>
  masteryStage(
    masteryHold(x, y, z),
    title,
    [
      `With rotation controls centred, raise thrust gently toward ${y} m. Reduce the climb before the marked height and settle above the pad.`,
      `Утримуючи стіки обертання по центру, плавно додайте тягу до ${y} м. Сповільніть підйом до позначеної висоти й стабілізуйтеся над майданчиком.`,
    ],
    'throttle',
    'lift',
  );
const masteryLand = (
  x,
  z,
  y = 0,
  surface = '$floor',
  title = ['Finish with a soft landing', 'Завершіть м’якою посадкою'],
) => [
  { ...masteryHold(x, y, z, { ticks: 30, maxSpeed: 1200, maxTilt: 1500 }), type: 'land', surface },
  schoolNote(
    title,
    [
      `Brake above the marked ${y > 0 ? 'raised platform' : 'pad'}, level the drone, and descend gently. Bring throttle fully down after contact.`,
      `Загальмуйте над позначен${y > 0 ? 'ою піднятою платформою' : 'им майданчиком'}, вирівняйте дрон і плавно спустіться. Після торкання повністю приберіть газ.`,
    ],
    [
      'The checkpoint checks the actual support surface and the touchdown speed and tilt. Passing above the pad is not a landing.',
      'Перевірка враховує опорну поверхню, швидкість і нахил під час торкання. Проліт над майданчиком не є посадкою.',
    ],
    'throttle',
    'land',
    0.44,
    [
      'If you arrive too quickly, climb into clear space and make another approach. Stop the drift before descending.',
      'Якщо наблизилися надто швидко, підніміться у вільний простір і зайдіть ще раз. Погасіть дрейф до спуску.',
    ],
    -1,
  ),
];
const masteryLesson = (
  index,
  {
    title,
    summary,
    concept,
    environment,
    tier,
    tags,
    duration = 6,
    obstacles = [],
    spawn = p(0, 0, 0),
  },
  stages,
) => {
  const lesson = schoolLesson(
    index,
    { title, summary, concept, chapter: tier, mode: 'acro', camera: 'fpv', duration },
    stages,
  );
  const world = FLIGHT_WORLDS.find((entry) => entry.id === environment);
  return Object.freeze({
    ...lesson,
    tier,
    skillTags: tags,
    recommendedPrerequisites: [
      index === 26 ? 'beginner-26' : `beginner-${String(index).padStart(2, '0')}`,
    ],
    course: {
      ...lesson.course,
      environment,
      spawn,
      bounds: { min: p(-44, 0, -44), max: p(44, 20, 44) },
      world: { id: world.id, theme: world.theme, style: world.style },
      obstacles: [...worldObstacles(environment), ...obstacles],
    },
  });
};
const MASTERY_LESSONS = Object.freeze([
  masteryLesson(
    26,
    {
      title: ['Braking marks', 'Орієнтири гальмування'],
      environment: 'field',
      tier: 'experienced',
      tags: ['braking', 'momentum', 'precision'],
      summary: [
        'Choose where to brake on northbound and eastbound approaches, then land.',
        'Виберіть момент гальмування на підходах на північ і схід, потім виконайте посадку.',
      ],
      concept: [
        'Counter-tilt slows your motion. Centring the stick stops commanding rotation; it does not erase momentum.',
        'Зворотний нахил сповільнює рух. Центрування стіка припиняє команду обертатися, але не прибирає інерцію.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'z',
        -8,
        0,
        -1,
        3,
        ['First approach', 'Перший підхід'],
        [
          'Fly north through the gate and prepare to brake toward the box beyond it.',
          'Летіть на північ крізь ворота й готуйтеся гальмувати до зони за ними.',
        ],
      ),
      masterySettle(
        0,
        3,
        -14,
        ['Brake before the box', 'Гальмуйте до зони'],
        [
          'Tilt back briefly, then level as speed falls. Settle inside the outlined box.',
          'Коротко нахиліться назад, потім вирівняйтеся зі зменшенням швидкості. Стабілізуйтеся в позначеній зоні.',
        ],
      ),
      masteryGate(
        'x',
        8,
        -14,
        1,
        3,
        ['Turn into the second approach', 'Поверніть на другий підхід'],
        [
          'Turn east and pass the gate. The next stop is close, so start braking early.',
          'Поверніть на схід і пройдіть ворота. Наступна зупинка близько, тому гальмуйте завчасно.',
        ],
      ),
      masterySettle(
        14,
        3,
        -14,
        ['Catch the second stop', 'Зупиніться вдруге'],
        [
          'Stop over the second marker without chasing it back and forth.',
          'Зупиніться над другою позначкою без постійного переліту вперед і назад.',
        ],
      ),
      masteryGate(
        'z',
        -6,
        14,
        1,
        3,
        ['Return toward the pad', 'Поверніться до майданчика'],
        [
          'Face south, cross the return gate and leave room to stop.',
          'Спрямуйте ніс на південь, пройдіть зворотні ворота й залиште місце для зупинки.',
        ],
      ),
      masteryLand(14, 0),
    ],
  ),
  masteryLesson(
    27,
    {
      title: ['Altitude staircase', 'Сходинки висоти'],
      environment: 'gym',
      tier: 'experienced',
      tags: ['throttle', 'height', 'precision'],
      summary: [
        'Visit four offset height stations while controlling climb and descent.',
        'Відвідайте чотири зміщені висотні цілі, контролюючи підйом і спуск.',
      ],
      concept: [
        'Throttle changes thrust, not height directly. Begin slowing each climb or descent before its target.',
        'Газ змінює тягу, а не висоту безпосередньо. Сповільнюйте кожен підйом чи спуск до цільової висоти.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masterySettle(
        0,
        6,
        -8,
        ['Rise to the second step', 'Підніміться на другу сходинку'],
        [
          'Move north and climb to 6 m. Ease thrust before reaching the upper target.',
          'Рухайтеся на північ і підніміться до 6 м. Зменште тягу до верхньої цілі.',
        ],
        { ticks: 40, maxSpeed: 2000 },
      ),
      masterySettle(
        8,
        4,
        -8,
        ['Descend while crossing', 'Спускайтеся під час переходу'],
        [
          'Move right toward the 4 m target. Catch the downward motion before settling.',
          'Рухайтеся праворуч до цілі 4 м. Зупиніть спуск перед стабілізацією.',
        ],
        { ticks: 40, maxSpeed: 2000 },
      ),
      masterySettle(
        8,
        2,
        0,
        ['Low final step', 'Низька остання сходинка'],
        [
          'Return south and settle at 2 m with room above the ground.',
          'Поверніться на південь і стабілізуйтеся на 2 м із запасом над землею.',
        ],
        { ticks: 40, maxSpeed: 2000 },
      ),
      masteryLand(8, 0),
    ],
  ),
  masteryLesson(
    28,
    {
      title: ['Compass cross', 'Хрест за орієнтирами'],
      environment: 'field',
      tier: 'experienced',
      tags: ['heading', 'lateral', 'precision'],
      summary: [
        'Visit four stations while pointing north, then turn south and land.',
        'Відвідайте чотири цілі з носом на північ, потім поверніть на південь і виконайте посадку.',
      ],
      concept: [
        'Heading and travel are different. Pitch and roll move the drone relative to its current nose direction.',
        'Курс і напрям руху різні. Тангаж і крен переміщують дрон відносно поточного напрямку носа.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      ...[
        [
          8,
          0,
          ['East station', 'Східна ціль'],
          [
            'Slide right while keeping the nose north. Brake before the marker.',
            'Змістіться праворуч, тримаючи ніс на північ. Загальмуйте до позначки.',
          ],
        ],
        [
          0,
          -8,
          ['North station', 'Північна ціль'],
          [
            'Move toward the northern target and settle without changing heading.',
            'Перейдіть до північної цілі й зупиніться без зміни курсу.',
          ],
        ],
        [
          -8,
          0,
          ['West station', 'Західна ціль'],
          [
            'Move left toward the western target; keep watching the north heading marker.',
            'Перейдіть ліворуч до західної цілі; стежте за позначкою північного курсу.',
          ],
        ],
        [
          0,
          8,
          ['South station', 'Південна ціль'],
          [
            'Translate backward toward the southern target while still facing north.',
            'Перемістіться назад до південної цілі, залишаючи ніс на північ.',
          ],
        ],
      ].map(([x, z, title, instruction]) =>
        masterySettle(x, 3, z, title, instruction, { heading: 0 }),
      ),
      masterySettle(
        0,
        3,
        8,
        ['Now turn the nose', 'Тепер поверніть ніс'],
        [
          'Turn to face south without leaving the target. Compare the heading arrow with the drift arrow.',
          'Поверніть ніс на південь, не виходячи з цілі. Порівняйте стрілки курсу й дрейфу.',
        ],
        { heading: 18000 },
      ),
      masteryLand(0, 8),
    ],
  ),
  masteryLesson(
    29,
    {
      title: ['Backward return', 'Повернення заднім ходом'],
      environment: 'field',
      tier: 'experienced',
      tags: ['heading', 'backward', 'braking'],
      summary: [
        'Fly out, stop, then return backward with the nose still facing outward.',
        'Відлетіть, зупиніться й поверніться заднім ходом із носом у початковому напрямку.',
      ],
      concept: [
        'A backward translation comes from thrust and attitude. It is not the same as turning the nose around.',
        'Рух назад виникає через тягу й нахил. Це не те саме, що розвернути ніс.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'z',
        -9,
        0,
        -1,
        3,
        ['Outbound marker', 'Позначка відльоту'],
        [
          'Fly north through the gate and reduce your forward speed.',
          'Пролетіть на північ крізь ворота та зменште швидкість.',
        ],
      ),
      masterySettle(
        0,
        3,
        -14,
        ['Stop facing outward', 'Зупиніться носом назовні'],
        [
          'Keep facing north and stop at the far station.',
          'Залиште ніс на північ і зупиніться біля дальньої цілі.',
        ],
        { heading: 0 },
      ),
      masterySettle(
        4,
        3,
        -7,
        ['Back and slightly right', 'Назад і трохи праворуч'],
        [
          'Use a small nose-up tilt to start moving backward, with a little right roll toward the offset target. Keep facing north.',
          'Малим нахилом носа вгору почніть рух назад і додайте трохи правого крену до зміщеної цілі. Тримайте ніс на північ.',
        ],
        { heading: 0 },
      ),
      masterySettle(
        0,
        3,
        0,
        ['Backward home', 'Заднім ходом додому'],
        [
          'Return over the home pad without a yaw turnaround, then brake the backward drift.',
          'Поверніться над стартовим майданчиком без розвороту за курсом, потім погасіть рух назад.',
        ],
        { heading: 0 },
      ),
      masteryLand(0, 0),
    ],
  ),
  masteryLesson(
    30,
    {
      title: ['S-turn handover', 'Зміна повороту на S-маршруті'],
      environment: 'woodland',
      tier: 'experienced',
      tags: ['turning', 'look-ahead', 'route'],
      summary: [
        'Link bends of different spacing through a woodland clearing.',
        'З’єднайте повороти з різними проміжками на лісовій галявині.',
      ],
      concept: [
        'Unwind the old bank as the new direction opens. Look ahead before adding the opposite roll and yaw.',
        'Прибирайте попередній крен, коли відкривається новий напрямок. Дивіться вперед перед протилежними креном і поворотом.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'z',
        -7,
        0,
        -1,
        3,
        ['Enter the clearing', 'Увійдіть на галявину'],
        [
          'Cross the first opening and look toward the gate on your right.',
          'Пройдіть перший отвір і подивіться на ворота праворуч.',
        ],
      ),
      masteryGate(
        'x',
        8,
        -12,
        1,
        3,
        ['Open the right bend', 'Розкрийте правий поворот'],
        [
          'Turn right smoothly into the eastern gate; begin unwinding as it comes into line.',
          'Плавно поверніть праворуч у східні ворота; прибирайте крен під час вирівнювання.',
        ],
      ),
      masteryGate(
        'z',
        -20,
        12,
        -1,
        3,
        ['Change to a left bend', 'Перейдіть у лівий поворот'],
        [
          'Change direction toward the northern opening with a small opposite bank.',
          'Змініть напрямок до північного отвору з малим протилежним креном.',
        ],
      ),
      masteryGate(
        'x',
        3,
        -25,
        -1,
        3,
        ['Return across the clearing', 'Поверніться через галявину'],
        [
          'Turn left across the clearing and leave room beyond the gate.',
          'Поверніть ліворуч через галявину й залиште простір за воротами.',
        ],
      ),
      masteryGate(
        'z',
        -17,
        -7,
        1,
        3,
        ['Southern exit', 'Південний вихід'],
        [
          'Round the last bend toward the south-facing gate, clear of the trees.',
          'Обігніть останній поворот до південних воріт, оминаючи дерева.',
        ],
      ),
      masterySettle(
        -7,
        3,
        -10,
        ['Calm exit', 'Спокійний вихід'],
        [
          'Brake into the final box before descending.',
          'Загальмуйте в останній зоні перед спуском.',
        ],
      ),
      masteryLand(-7, -10),
    ],
  ),
  masteryLesson(
    31,
    {
      title: ['Wide corner, tight exit', 'Широкий поворот, вузький вихід'],
      environment: 'stadium',
      tier: 'experienced',
      tags: ['cornering', 'alignment', 'race'],
      summary: [
        'Use a broad first corner to line up a narrow second exit.',
        'Використайте широкий перший поворот, щоб вирівнятися перед вузьким виходом.',
      ],
      concept: [
        'The useful line is the one that prepares the next opening. Turn early enough to finish alignment before a narrow gate.',
        'Корисна траєкторія готує наступний отвір. Починайте поворот так, щоб вирівнятися до вузьких воріт.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'z',
        -8,
        0,
        -1,
        3,
        ['Approach the corner', 'Підійдіть до повороту'],
        [
          'Pass the approach gate with space to begin turning right.',
          'Пройдіть початкові ворота із запасом для правого повороту.',
        ],
      ),
      masteryGate(
        'x',
        7,
        -16,
        1,
        3,
        ['Broad right entry', 'Широкий правий вхід'],
        [
          'Sweep right through the wide gate while looking toward its exit.',
          'Пройдіть широкий правий поворот, дивлячись на вихід.',
        ],
        7,
      ),
      masteryGate(
        'x',
        17,
        -18,
        1,
        3,
        ['Finish the wide corner', 'Завершіть широкий поворот'],
        [
          'Reduce the bank as the second eastern gate lines up.',
          'Зменште крен, коли вирівняється другий східний отвір.',
        ],
        6,
      ),
      masteryGate(
        'z',
        -11,
        20,
        1,
        3,
        ['Short change of direction', 'Коротка зміна напрямку'],
        [
          'Turn south before reaching the next gate. Avoid carrying too much speed into the short turn.',
          'Поверніть на південь до наступних воріт. Не входьте в короткий поворот надто швидко.',
        ],
      ),
      masteryGate(
        'x',
        12,
        -5,
        -1,
        3,
        ['Line up the exit', 'Вирівняйтеся на вихід'],
        [
          'Turn west and establish the line to the small opening.',
          'Поверніть на захід і займіть траєкторію до малого отвору.',
        ],
        4,
      ),
      masteryGate(
        'x',
        4,
        -5,
        -1,
        3,
        ['Narrow final gate', 'Вузькі останні ворота'],
        [
          'Make only small corrections through the narrow exit, then brake.',
          'Робіть лише малі поправки у вузькому виході, потім гальмуйте.',
        ],
        3,
      ),
      masteryLand(-3, -5),
    ],
  ),
  masteryLesson(
    32,
    {
      title: ['Three landing approaches', 'Три заходи на посадку'],
      environment: 'courtyard',
      tier: 'experienced',
      tags: ['landing', 'braking', 'heading'],
      summary: [
        'Land at three pads using a straight, sideways and diagonal approach.',
        'Сядьте на три майданчики з прямого, бічного та діагонального заходів.',
      ],
      concept: [
        'A soft landing begins before the pad. Remove horizontal drift first, then control the descent.',
        'М’яка посадка починається до майданчика. Спершу погасіть горизонтальний рух, потім керуйте спуском.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'z',
        -7,
        0,
        -1,
        3,
        ['Straight approach', 'Прямий захід'],
        [
          'Cross the northern gate and brake above the first pad.',
          'Пройдіть північні ворота й загальмуйте над першим майданчиком.',
        ],
      ),
      masteryLand(0, -12, 0, '$floor', ['First touchdown', 'Перше торкання']),
      masteryLift(0, 3, -12, ['Lift for the side approach', 'Злетіть для бічного заходу']),
      masterySettle(
        10,
        3,
        -12,
        ['Side approach, same heading', 'Бічний захід із тим самим курсом'],
        [
          'Keep the nose north while moving right to the second pad. Brake and settle before landing.',
          'Тримайте ніс на північ і рухайтеся праворуч до другого майданчика. Загальмуйте й стабілізуйтеся до посадки.',
        ],
        { heading: 0 },
      ),
      masteryLand(10, -12, 0, '$floor', ['Second touchdown', 'Друге торкання']),
      masteryLift(10, 3, -12, ['Lift for the diagonal', 'Злетіть для діагоналі']),
      masterySettle(
        0,
        3,
        0,
        ['Diagonal return', 'Діагональне повернення'],
        [
          'Return diagonally toward the first launch pad and settle before the last descent.',
          'Поверніться по діагоналі до стартового майданчика й стабілізуйтеся перед останнім спуском.',
        ],
      ),
      masteryLand(0, 0),
    ],
  ),
  masteryLesson(
    33,
    {
      title: ['Landmark rally', 'Маршрут за орієнтирами'],
      environment: 'woodland',
      tier: 'experienced',
      tags: ['navigation', 'heading', 'capstone'],
      duration: 8,
      summary: [
        'Fly a complete clearing route with two deliberate heading checks.',
        'Пройдіть повний маршрут галявиною з двома свідомими перевірками курсу.',
      ],
      concept: [
        'Choose a visible reference for each leg. Check the next direction while the drone is settled, then resume.',
        'Вибирайте видимий орієнтир для кожної ділянки. Перевіряйте наступний напрямок після стабілізації, потім продовжуйте.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'z',
        -8,
        0,
        -1,
        3,
        ['Northern clearing', 'Північна галявина'],
        ['Pass the first gate toward the clearing.', 'Пройдіть перші ворота до галявини.'],
      ),
      masteryGate(
        'x',
        8,
        -16,
        1,
        3,
        ['Eastern link', 'Східний перехід'],
        [
          'Turn east into the opening between the landmarks.',
          'Поверніть на схід в отвір між орієнтирами.',
        ],
      ),
      masterySettle(
        15,
        3,
        -16,
        ['Look south before leaving', 'Подивіться на південь перед відльотом'],
        [
          'Settle and point south to identify your next route.',
          'Стабілізуйтеся й поверніть ніс на південь, щоб визначити наступну ділянку.',
        ],
        { heading: 18000 },
      ),
      masteryGate(
        'z',
        -5,
        12,
        1,
        3,
        ['Along the tree line', 'Уздовж дерев'],
        [
          'Fly south through the gate, keeping clear of the tree to the east.',
          'Пролетіть на південь крізь ворота, не наближаючись до дерева на сході.',
        ],
      ),
      masteryGate(
        'x',
        4,
        6,
        -1,
        3,
        ['Western link', 'Західний перехід'],
        [
          'Turn west across the open southern edge.',
          'Поверніть на захід уздовж відкритого південного краю.',
        ],
      ),
      masterySettle(
        -8,
        3,
        6,
        ['Find north again', 'Знову знайдіть північ'],
        [
          'Stop and face north before the final part.',
          'Зупиніться й поверніть ніс на північ перед останньою частиною.',
        ],
        { heading: 0 },
      ),
      masteryGate(
        'z',
        -3,
        -8,
        -1,
        3,
        ['Return toward home', 'Поверніться до старту'],
        [
          'Cross the northern gate on the last short leg.',
          'Пройдіть північні ворота на останній короткій ділянці.',
        ],
      ),
      masteryGate(
        'x',
        -1,
        -10,
        1,
        3,
        ['Final crosswise line', 'Остання поперечна лінія'],
        [
          'Turn east through the last gate and prepare the final landing.',
          'Поверніть на схід крізь останні ворота й підготуйте останню посадку.',
        ],
      ),
      masteryLand(7, -10),
    ],
  ),
  masteryLesson(
    34,
    {
      title: ['Slalom rhythm', 'Ритм слалому'],
      environment: 'stadium',
      tier: 'advanced',
      tags: ['slalom', 'look-ahead', 'race'],
      summary: [
        'Weave through five openings with uneven spacing, then stop in the braking bay.',
        'Пройдіть п’ять нерівномірно розташованих отворів і зупиніться в зоні гальмування.',
      ],
      concept: [
        'Look one gate ahead and vary the turn with the spacing. A rhythm is useful; identical stick timing is not always correct.',
        'Дивіться на одні ворота вперед і змінюйте поворот відповідно до відстані. Ритм корисний, але однаковий час роботи стіками підходить не завжди.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      ...[
        [-6, -4],
        [-11, 4],
        [-17, -4],
        [-23, 4],
        [-28, 0],
      ].map(([z, x], index) =>
        masteryGate(
          'z',
          z,
          x,
          -1,
          3,
          [`Slalom gate ${index + 1}`, `Ворота слалому ${index + 1}`],
          [
            index === 4
              ? 'Aim for the central opening and look ahead to the braking bay beyond it.'
              : `Aim for the ${x > 0 ? 'right' : x < 0 ? 'left' : 'central'} opening and start reading the following gap before this crossing.`,
            index === 4
              ? 'Спрямуйтеся до центрального отвору й заздалегідь знайдіть зону гальмування за ним.'
              : `Спрямуйтеся до ${x > 0 ? 'правого' : x < 0 ? 'лівого' : 'центрального'} отвору й помічайте наступний до проходження цього.`,
          ],
          4,
        ),
      ),
      masterySettle(
        0,
        3,
        -31.5,
        ['Brake beyond the slalom', 'Загальмуйте після слалому'],
        [
          'Straighten the route and settle beyond the last gate.',
          'Вирівняйте траєкторію й стабілізуйтеся за останніми воротами.',
        ],
      ),
      masteryLand(0, -31.5),
    ],
  ),
  masteryLesson(
    35,
    {
      title: ['High–low ribbon', 'Висока й низька траєкторія'],
      environment: 'warehouse',
      tier: 'advanced',
      tags: ['height', 'clearance', 'route'],
      summary: [
        'Climb over a stack, descend under a beam and leave through a side opening.',
        'Підніміться над стосом, спустіться під балку й вийдіть крізь бічний отвір.',
      ],
      concept: [
        'Read overhead and lower clearance together. Plan the height change before arriving at an obstacle.',
        'Оцінюйте просвіт зверху й знизу разом. Плануйте зміну висоти до перешкоди.',
      ],
      obstacles: [
        box('school-low-stack', 0, -10, 7, 2, 2.5),
        { id: 'school-overhead-beam', min: p(-5, 5, -21), max: p(5, 7, -19) },
      ],
    },
    [
      masteryLift(0, 4, 0),
      masteryGate(
        'z',
        -6,
        0,
        -1,
        6,
        ['Climb before the stack', 'Наберіть висоту до стосу'],
        [
          'Climb into the high gate before reaching the low stack.',
          'Підніміться у високі ворота до наближення до низького стосу.',
        ],
      ),
      masteryGate(
        'z',
        -13,
        0,
        -1,
        6,
        ['Clear the stack', 'Пройдіть над стосом'],
        [
          'Stay above the stack until the second high gate is crossed.',
          'Залишайтеся над стосом до проходження других високих воріт.',
        ],
      ),
      masterySettle(
        0,
        3,
        -16,
        ['Prepare the low opening', 'Підготуйтеся до низького отвору'],
        [
          'Descend and settle before the overhead beam.',
          'Спустіться й стабілізуйтеся перед верхньою балкою.',
        ],
      ),
      masteryGate(
        'z',
        -23,
        0,
        -1,
        2.5,
        ['Under the beam', 'Під балкою'],
        [
          'Pass beneath the beam without climbing early.',
          'Пройдіть під балкою без передчасного підйому.',
        ],
      ),
      masteryGate(
        'x',
        8,
        -27,
        1,
        3,
        ['Side exit', 'Бічний вихід'],
        ['Turn east toward the open side exit.', 'Поверніть на схід до вільного бічного виходу.'],
      ),
      masteryGate(
        'z',
        -18,
        13,
        1,
        5,
        ['Rise on the return', 'Підніміться на поверненні'],
        [
          'Climb gently while returning south outside the beam.',
          'Плавно наберіть висоту, повертаючись на південь збоку від балки.',
        ],
      ),
      masteryGate(
        'z',
        -8,
        13,
        1,
        3,
        ['Lower toward the finish', 'Знизьтеся до фінішу'],
        [
          'Descend toward the last gate with room to brake.',
          'Спустіться до останніх воріт із запасом для гальмування.',
        ],
      ),
      masteryLand(13, 0),
    ],
  ),
  masteryLesson(
    36,
    {
      title: ['Platform approach', 'Захід на платформу'],
      environment: 'container-yard',
      tier: 'advanced',
      tags: ['landing', 'height', 'platform'],
      summary: [
        'Land on two physical platforms, then return to the ground.',
        'Сядьте на дві фізичні платформи, потім поверніться на землю.',
      ],
      concept: [
        'A raised pad has an edge and a real support surface. Arrive above it, remove horizontal drift, then descend.',
        'Піднятий майданчик має край і справжню опорну поверхню. Станьте над ним, погасіть горизонтальний рух, потім спускайтеся.',
      ],
      obstacles: [
        box('school-platform-low', 0, -10, 7, 7, 2),
        box('school-platform-high', 12, -20, 7, 7, 4),
      ],
    },
    [
      masteryLift(0, 5, 0),
      masterySettle(
        0,
        4,
        -10,
        ['Settle above the low platform', 'Стабілізуйтеся над низькою платформою'],
        [
          'Approach above the low platform and stop before descending.',
          'Підійдіть над низькою платформою й зупиніться до спуску.',
        ],
      ),
      masteryLand(0, -10, 2, 'school-platform-low', [
        'Land on the low platform',
        'Сядьте на низьку платформу',
      ]),
      masteryLift(0, 7, -10, ['Climb clear of the edge', 'Підніміться над краєм']),
      masterySettle(
        12,
        6,
        -20,
        ['Prepare the high platform', 'Підготуйтеся до високої платформи'],
        [
          'Cross above the higher platform, brake and keep clear of its edges.',
          'Перейдіть над вищою платформою, загальмуйте й тримайтеся подалі від країв.',
        ],
      ),
      masteryLand(12, -20, 4, 'school-platform-high', [
        'Land on the high platform',
        'Сядьте на високу платформу',
      ]),
      masteryLift(12, 7, -20, ['Lift before returning', 'Злетіть перед поверненням']),
      masterySettle(
        12,
        3,
        -4,
        ['Ground approach', 'Захід до землі'],
        [
          'Move beyond both platforms before descending toward the ground pad.',
          'Відійдіть від обох платформ перед спуском до наземного майданчика.',
        ],
      ),
      masteryLand(12, -4),
    ],
  ),
  masteryLesson(
    37,
    {
      title: ['Corridor turnaround', 'Розворот у коридорі'],
      environment: 'warehouse',
      tier: 'advanced',
      tags: ['heading', 'clearance', 'braking'],
      summary: [
        'Fly an outbound aisle, turn in the wider bay and return through a neighbouring aisle.',
        'Пройдіть коридор, розверніться в широкій зоні та поверніться сусіднім проходом.',
      ],
      concept: [
        'Use the wide bay to slow and turn. A yaw turnaround changes the nose, not the momentum from the previous leg.',
        'У широкій зоні сповільніться й поверніться. Розворот за курсом змінює ніс, а не рух попередньої ділянки.',
      ],
      obstacles: [box('school-aisle-divider', 6, -13, 2, 20, 5)],
    },
    [
      masteryLift(0, 3, 0),
      ...[-7, -15, -24].map((z, i) =>
        masteryGate(
          'z',
          z,
          0,
          -1,
          3,
          [`Outbound aisle ${i + 1}`, `Прямий прохід ${i + 1}`],
          [
            'Keep a small tilt through the aisle and leave room for the far turning bay.',
            'Тримайте малий нахил у проході й залишайте запас для дальньої зони розвороту.',
          ],
          4,
        ),
      ),
      masterySettle(
        12,
        3,
        -29,
        ['Turn in the open bay', 'Розверніться у відкритій зоні'],
        [
          'Move around the end of the divider, stop in the wide bay and face south.',
          'Обійдіть кінець перегородки, зупиніться в широкій зоні й поверніть ніс на південь.',
        ],
        { heading: 18000 },
      ),
      ...[-22, -13, -5].map((z, i) =>
        masteryGate(
          'z',
          z,
          12,
          1,
          3,
          [`Return aisle ${i + 1}`, `Зворотний прохід ${i + 1}`],
          [
            'Return south through the next gate while keeping away from the divider.',
            'Повертайтеся на південь крізь наступні ворота, тримаючись подалі від перегородки.',
          ],
          4,
        ),
      ),
      masteryLand(12, 2),
    ],
  ),
  masteryLesson(
    38,
    {
      title: ['Over, around, under', 'Зверху, навколо, знизу'],
      environment: 'courtyard',
      tier: 'advanced',
      tags: ['route-planning', 'height', 'clearance'],
      summary: [
        'Cross a low wall, round its end and return beneath a broad arch.',
        'Перетніть низьку стіну, обігніть її край і поверніться під широкою аркою.',
      ],
      concept: [
        'Inspect the shape of an obstacle, not just the next marker. A route can ask for different clearances on its outward and return legs.',
        'Оцінюйте форму перешкоди, а не лише наступну позначку. На прямій і зворотній ділянках можуть бути різні просвіти.',
      ],
      obstacles: [
        box('school-cross-wall', 0, -10, 12, 2, 3),
        box('school-end-wall', 7, -16, 2, 12, 3),
        { id: 'school-arch', min: p(9, 5, -9), max: p(17, 7, -7) },
      ],
    },
    [
      masteryLift(0, 5.5, 0),
      masteryGate(
        'z',
        -6,
        0,
        -1,
        5.5,
        ['Approach above the wall', 'Підійдіть над стіною'],
        ['Gain clearance before the first wall.', 'Наберіть запас висоти до першої стіни.'],
      ),
      masteryGate(
        'z',
        -14,
        0,
        -1,
        5.5,
        ['Cross over', 'Пройдіть зверху'],
        [
          'Keep enough height until the wall is behind you.',
          'Тримайте достатню висоту, доки стіна не залишиться позаду.',
        ],
      ),
      masteryGate(
        'z',
        -25,
        0,
        -1,
        4,
        ['Reach the open end', 'Досягніть відкритого краю'],
        [
          'Follow the inside of the route toward the open end.',
          'Рухайтеся внутрішньою частиною маршруту до відкритого краю.',
        ],
      ),
      masteryGate(
        'x',
        11,
        -27,
        1,
        4,
        ['Go around', 'Обійдіть збоку'],
        [
          'Round the far end toward the eastern lane.',
          'Обігніть дальній край до східного проходу.',
        ],
      ),
      masteryGate(
        'z',
        -18,
        13,
        1,
        3,
        ['Return on the other side', 'Поверніться іншим боком'],
        [
          'Fly south outside the wall and prepare to slow before the arch.',
          'Летіть на південь із зовнішнього боку стіни й готуйтеся сповільнитися до арки.',
        ],
      ),
      masterySettle(
        13,
        2.5,
        -13,
        ['Prepare to go under', 'Підготуйтеся пройти знизу'],
        [
          'Settle below the arch height before moving forward again.',
          'Стабілізуйтеся нижче арки перед подальшим рухом.',
        ],
      ),
      masteryGate(
        'z',
        -5,
        13,
        1,
        2.5,
        ['Pass under the arch', 'Пройдіть під аркою'],
        [
          'Pass below the beam and stay low until it is behind you.',
          'Пройдіть під балкою й залишайтеся низько, доки вона не буде позаду.',
        ],
      ),
      masteryGate(
        'x',
        6,
        0,
        -1,
        3,
        ['Final return', 'Останнє повернення'],
        [
          'Turn west toward the landing pad after leaving the arch.',
          'Після арки поверніть на захід до посадкового майданчика.',
        ],
      ),
      masteryLand(0, 0),
    ],
  ),
  masteryLesson(
    39,
    {
      title: ['Read the landmarks', 'Читайте орієнтири'],
      environment: 'woodland',
      tier: 'advanced',
      tags: ['navigation', 'observation', 'heading'],
      summary: [
        'Use distinct tree groups and open spaces to choose each next route leg.',
        'Використовуйте різні групи дерев і відкриті місця для вибору наступної ділянки.',
      ],
      concept: [
        'A landmark gives context to a gate. Pause to recognize the next opening rather than following an arrow without reading the scene.',
        'Орієнтир допомагає зрозуміти ворота. Зупиніться, щоб упізнати наступний отвір, замість сліпого руху за стрілкою.',
      ],
    },
    [
      masteryLift(0, 3, 0),
      masterySettle(
        0,
        3,
        0,
        ['Find the eastern clearing', 'Знайдіть східну галявину'],
        [
          'Face east and identify the first gate before moving.',
          'Поверніть ніс на схід і знайдіть перші ворота до початку руху.',
        ],
        { heading: 9000 },
      ),
      masteryGate(
        'x',
        9,
        0,
        1,
        3,
        ['Eastern landmark', 'Східний орієнтир'],
        [
          'Cross east into the open space beside the tree line.',
          'Пройдіть на схід у відкритий простір біля дерев.',
        ],
      ),
      masteryGate(
        'z',
        -12,
        10,
        -1,
        3,
        ['Open northern lane', 'Відкритий північний прохід'],
        [
          'Turn north through the gap west of the tall eastern tree.',
          'Поверніть на північ в отвір із західного боку високого східного дерева.',
        ],
      ),
      masterySettle(
        10,
        3,
        -20,
        ['Read the western opening', 'Оцініть західний отвір'],
        [
          'Stop, face west and identify the clear route between tree groups.',
          'Зупиніться, поверніть ніс на захід і знайдіть вільний шлях між групами дерев.',
        ],
        { heading: -9000 },
      ),
      masteryGate(
        'x',
        0,
        -20,
        -1,
        3,
        ['Cross the open middle', 'Перетніть відкриту середину'],
        [
          'Fly west through the central opening without cutting toward the northern tree.',
          'Летіть на захід крізь центральний отвір, не зрізаючи до північного дерева.',
        ],
      ),
      masteryGate(
        'z',
        -8,
        -8,
        1,
        3,
        ['Southern clearing', 'Південна галявина'],
        [
          'Turn south inside the western trees and cross the next gate.',
          'Поверніть на південь із внутрішнього боку західних дерев і пройдіть наступні ворота.',
        ],
      ),
      masteryGate(
        'x',
        -1,
        0,
        1,
        3,
        ['Recognize home', 'Упізнайте фініш'],
        [
          'Find the last eastern opening and brake toward the home pad.',
          'Знайдіть останній східний отвір і загальмуйте до фінішного майданчика.',
        ],
      ),
      masteryLand(6, 0),
    ],
  ),
  masteryLesson(
    40,
    {
      title: ['Between floors', 'Між поверхами'],
      environment: 'garage',
      tier: 'advanced',
      tags: ['multi-level', 'landing', 'clearance'],
      duration: 8,
      summary: [
        'Use a clear opening to reach a deck, land on it, then return through another route.',
        'Підніміться на перекриття через вільний отвір, сядьте й поверніться іншим шляхом.',
      ],
      concept: [
        'Height alone does not identify a floor. Read the support surface, open edge and overhead clearance together.',
        'Самої висоти недостатньо для визначення поверху. Оцінюйте опорну поверхню, відкритий край і верхній просвіт разом.',
      ],
      obstacles: [{ id: 'school-upper-deck', min: p(-7, 4.7, -22), max: p(7, 5, -10) }],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'x',
        10,
        -4,
        1,
        3,
        ['Go around the deck edge', 'Обійдіть край перекриття'],
        [
          'Move east beside the deck before climbing; do not rise beneath the slab.',
          'Перейдіть на схід збоку від перекриття до підйому; не піднімайтеся під плитою.',
        ],
      ),
      masterySettle(
        12,
        7,
        -10,
        ['Climb outside the slab', 'Підніміться збоку від плити'],
        [
          'Climb in open air beside the deck and settle above its top.',
          'Підніміться у вільному просторі збоку від перекриття й стабілізуйтеся вище нього.',
        ],
      ),
      masteryGate(
        'x',
        7,
        -16,
        -1,
        7,
        ['Enter the upper floor', 'Увійдіть на верхній поверх'],
        [
          'Move west above the deck edge toward its landing area.',
          'Перейдіть на захід над краєм перекриття до посадкової зони.',
        ],
      ),
      masteryLand(0, -16, 5, 'school-upper-deck', [
        'Land on the upper deck',
        'Сядьте на верхнє перекриття',
      ]),
      masteryLift(0, 8, -16, ['Lift above the upper floor', 'Злетіть над верхнім поверхом']),
      masteryGate(
        'x',
        -10,
        -16,
        -1,
        8,
        ['Leave through the other side', 'Вийдіть іншим боком'],
        [
          'Move west clear of the deck before descending.',
          'Відійдіть на захід від перекриття до спуску.',
        ],
      ),
      masterySettle(
        -12,
        3,
        -16,
        ['Descend beside the slab', 'Спустіться збоку від плити'],
        [
          'Descend in the open western lane, clear of the upper floor.',
          'Спустіться у відкритому західному проході, подалі від верхнього поверху.',
        ],
      ),
      masteryGate(
        'z',
        -7,
        -12,
        1,
        3,
        ['Lower return lane', 'Нижній зворотний прохід'],
        ['Fly south along the lower lane.', 'Летіть на південь нижнім проходом.'],
      ),
      masteryGate(
        'x',
        -5,
        2,
        1,
        3,
        ['Finish across the open floor', 'Завершіть через відкриту підлогу'],
        [
          'Turn east across the open ground floor and prepare to land.',
          'Поверніть на схід через відкритий нижній поверх і готуйтеся до посадки.',
        ],
      ),
      masteryLand(2, 2),
    ],
  ),
  masteryLesson(
    41,
    {
      title: ['Precision pilot route', 'Маршрут точного пілотування'],
      environment: 'stadium',
      tier: 'advanced',
      tags: ['capstone', 'slalom', 'height', 'landing'],
      duration: 9,
      summary: [
        'Link a slalom, changing heights, a stop box and a raised landing in one flight.',
        'З’єднайте слалом, зміну висоти, зону зупинки й підняту посадку в одному польоті.',
      ],
      concept: [
        'Good precision comes from preparing the next task. Finish each movement with enough space and speed control for the following one.',
        'Точність залежить від підготовки наступного завдання. Завершуйте кожен маневр із запасом простору й контрольованою швидкістю.',
      ],
      obstacles: [box('school-finish-platform', 15, 7, 7, 7, 2)],
    },
    [
      masteryLift(0, 3, 0),
      masteryGate(
        'z',
        -7,
        -4,
        -1,
        3,
        ['First slalom opening', 'Перший отвір слалому'],
        [
          'Move left toward the first opening and read the next gate.',
          'Змістіться ліворуч до першого отвору й помічайте наступні ворота.',
        ],
        4,
      ),
      masteryGate(
        'z',
        -14,
        4,
        -1,
        3,
        ['Second slalom opening', 'Другий отвір слалому'],
        [
          'Change the bank and cross toward the right opening.',
          'Змініть крен і перейдіть до правого отвору.',
        ],
        4,
      ),
      masteryGate(
        'z',
        -22,
        -3,
        -1,
        3,
        ['Third slalom opening', 'Третій отвір слалому'],
        [
          'Unwind the previous turn and reach the third gate.',
          'Приберіть попередній крен і досягніть третіх воріт.',
        ],
        4,
      ),
      masterySettle(
        -3,
        3,
        -28,
        ['Stop before the high section', 'Зупиніться до високої ділянки'],
        [
          'Brake into the box and prepare the climbing turn.',
          'Загальмуйте в зоні й підготуйте поворот із набором висоти.',
        ],
      ),
      masteryGate(
        'x',
        6,
        -28,
        1,
        6,
        ['High crossing', 'Високий прохід'],
        [
          'Turn east and climb through the high gate.',
          'Поверніть на схід і підніміться крізь високі ворота.',
        ],
      ),
      masteryGate(
        'x',
        16,
        -28,
        1,
        4,
        ['Controlled lowering', 'Контрольоване зниження'],
        [
          'Begin descending before the next opening; keep room to level.',
          'Почніть спуск до наступного отвору; залиште місце для вирівнювання.',
        ],
      ),
      masteryGate(
        'z',
        -17,
        20,
        1,
        3,
        ['Southbound line', 'Лінія на південь'],
        [
          'Turn south into the lower gate and reduce the bank.',
          'Поверніть на південь у нижні ворота й зменште крен.',
        ],
      ),
      masteryGate(
        'z',
        -7,
        20,
        1,
        3,
        ['Straight return', 'Пряме повернення'],
        [
          'Keep a readable straight line through the return gate.',
          'Тримайте чітку пряму траєкторію крізь зворотні ворота.',
        ],
      ),
      masteryGate(
        'x',
        15,
        0,
        -1,
        4,
        ['Platform alignment', 'Вирівнювання на платформу'],
        [
          'Turn toward the platform approach and begin braking.',
          'Поверніть на захід у ворота заходу до платформи й почніть гальмувати.',
        ],
      ),
      masterySettle(
        15,
        4,
        7,
        ['Settle over the finish', 'Стабілізуйтеся над фінішем'],
        [
          'Move above the final platform and remove all drift before descending.',
          'Перейдіть над останньою платформою й погасіть дрейф перед спуском.',
        ],
      ),
      masteryLand(15, 7, 2, 'school-finish-platform'),
    ],
  ),
]);

// Separately identified skill courses keep earlier school revisions executable.
const SKILL_LESSONS = (() => {
  function hold(x, y, z, heading = null) {
    return {
      type: 'hold',
      min: p(x - 2, Math.max(0, y - 0.8), z - 2),
      max: p(x + 2, y + 0.8, z + 2),
      ticks: 50,
      maxSpeed: 1200,
      maxTilt: 1800,
      minTilt: 0,
      centred: false,
      heading,
    };
  }
  function land(x = 0, z = 0, y = 0, surface = '$floor') {
    return { ...hold(x, y, z), type: 'land', surface, ticks: 30, maxSpeed: 1200, maxTilt: 1500 };
  }
  function rotation(axis, direction, angle = 36000, entryUp = 'upright', zone = {}) {
    return {
      type: 'rotation-v1',
      min: p(-35, 4, -35),
      max: p(35, 75, 35),
      maxTicks: 1500,
      axis,
      direction,
      angle,
      maxReverse: 1500,
      maxOther: 6000,
      tolerance: 1500,
      entryUp,
      settleTicks: 8,
      maxAngular: 1200,
      ...zone,
    };
  }
  function attitude(up) {
    return {
      type: 'attitude-v1',
      min: p(-35, 4, -35),
      max: p(35, 75, 35),
      maxTicks: 500,
      up,
      tolerance: 1500,
      ticks: 8,
      maxAngular: 1200,
      maxSpeed: 60000,
    };
  }
  function course(id, steps, overrides = {}) {
    const base = structuredClone(MASTERY_LESSONS[0].course);
    return {
      ...base,
      id,
      environment: 'field',
      world: { id: 'field', theme: 'academy', style: 'meadow' },
      spawn: p(0, 0, 0),
      bounds: { min: p(-75, 0, -75), max: p(75, 80, 75) },
      obstacles: [],
      steps: { 'self-level': structuredClone(steps), acro: steps },
      ...overrides,
    };
  }
  function path(plane, center, direction = 1, sweep = 36000, options = {}) {
    return {
      type: 'path-v1',
      min: p(-70, 3, -70),
      max: p(70, 76, 70),
      maxTicks: 3000,
      plane,
      center,
      entryUp: plane === 'yz' && direction < 0 ? 'inverted' : 'upright',
      entryBearing: plane === 'yz' ? (direction < 0 ? 0 : 18000) : plane === 'xy' ? -9000 : null,
      entryTolerance: plane === 'yz' && direction < 0 ? 2000 : 1800,
      maxAngular: 2000,
      radiusMin: 6000,
      radiusMax: 14000,
      direction,
      sweep,
      maxReverse: 2000,
      noseToward: false,
      headingTolerance: 4500,
      axialMin: 0,
      axialMax: 0,
      axialTolerance: 1500,
      coupled: null,
      ...options,
    };
  }
  function crossing(axis, at, direction, minSpeed = 1000, forwardTolerance = 1500, options = {}) {
    return {
      type: 'crossing-v1',
      min: p(-50, 3, -50),
      max: p(50, 76, 50),
      maxTicks: 1000,
      axis,
      at: at * 1000,
      direction,
      minA: -30000,
      maxA: 30000,
      minB: -30000,
      maxB: 30000,
      minSpeed,
      forwardTolerance,
      ...options,
    };
  }

  const p = (x, y, z) => ({ x: x * 1000, y: y * 1000, z: z * 1000 }),
    txt = (en, uk) => ({ en, uk });
  const note = (target, title, instruction, why) => ({
    target,
    note: {
      title: txt(...title),
      instruction: txt(...instruction),
      why: txt(
        ...(why ?? [
          'Follow the actual drone and its path. Small inputs control the rotation rate; centring the sticks does not automatically level or stop it.',
          'Стежте за справжньою орієнтацією та траєкторією дрона. Малі рухи стіків керують швидкістю обертання; центрування не вирівнює й не зупиняє дрон автоматично.',
        ]),
      ),
      axis:
        target.type === 'rotation-v1' ? target.axis : target.type === 'land' ? 'throttle' : 'mixed',
      motion:
        target.type === 'rotation-v1' ? target.axis : target.type === 'land' ? 'land' : 'route',
      direction: target.type === 'rotation-v1' ? target.direction : 1,
      target: target.type === 'land' ? 0.44 : 0.12,
      tip: txt(
        'Watch the example slowly if the sequence is unclear. Keep enough height to recover; pause whenever you need to inspect the diagram.',
        'Якщо послідовність незрозуміла, перегляньте приклад повільно. Залишайте висоту для відновлення; робіть паузу, щоб розглянути схему.',
      ),
    },
  });
  const stop = (
    x,
    y,
    z,
    title = ['Settle before the next movement', 'Стабілізуйтеся до наступного маневру'],
    heading = null,
  ) =>
    note(hold(x, y, z, heading), title, [
      `Brake into the marked area at ${y} m. Level the drone, stop the drift and check the next target.`,
      `Загальмуйте в позначеній зоні на ${y} м. Вирівняйте дрон, погасіть дрейф і перевірте наступну ціль.`,
    ]);
  const lift = (x, y, z) =>
    stop(x, y, z, ['Climb to the recovery height', 'Підніміться на висоту із запасом']);
  const finish = (x = 0, z = 0, y = 0, surface = '$floor') =>
    note(
      land(x, z, y, surface),
      ['Finish with a soft landing', 'Завершіть м’якою посадкою'],
      [
        'Approach the marked pad, stop the drift and descend gently. Reduce throttle fully after the drone touches the physical surface.',
        'Підійдіть до позначеного майданчика, погасіть дрейф і плавно спускайтеся. Повністю приберіть газ після торкання опорної поверхні.',
      ],
    );
  const rot = (axis, direction, angle, entryUp, title, instruction, zone = {}) =>
    note(rotation(axis, direction, angle, entryUp, zone), title, instruction, [
      'The checkpoint follows the full signed rotation and its intermediate attitudes. A matching final view alone does not qualify.',
      'Перевірка враховує повний оберт у потрібний бік і проміжні положення. Самого схожого вигляду наприкінці недостатньо.',
    ]);
  const gate = (axis, at, side, direction, y, width = 5) => ({
    type: 'gate',
    axis,
    at: at * 1000,
    direction,
    minSide: (side - width / 2) * 1000,
    maxSide: (side + width / 2) * 1000,
    minY: Math.round((y - 1.6) * 1000),
    maxY: Math.round((y + 1.6) * 1000),
  });
  const gateNote = (target, title, instruction) => note(target, title, instruction);
  const loopEntry = {
    type: 'gate',
    axis: 'z',
    at: 0,
    direction: -1,
    minSide: -2000,
    maxSide: 2000,
    minY: 18000,
    maxY: 22000,
  };
  const splitEntry = {
    type: 'gate',
    axis: 'z',
    at: 0,
    direction: -1,
    minSide: -2000,
    maxSide: 2000,
    minY: 15000,
    maxY: 75000,
  };
  const coupling = (axis, direction, angle = 36000, tolerance = 1500) => ({
    axis,
    direction,
    angle,
    maxReverse: 3000,
    maxOther: 6000,
    tolerance,
    phaseTolerance: 9000,
  });
  const fullLoop = () =>
    path('yz', p(0, 36, 0), 1, 36000, {
      min: p(-6, 3, -70),
      max: p(6, 76, 70),
      radiusMin: 11000,
      radiusMax: 23000,
      coupled: coupling('pitch', -1),
    });
  const climbLoop = () =>
    path('yz', p(0, 36, 0), 1, 18000, {
      min: p(-6, 3, -70),
      max: p(6, 76, 70),
      radiusMin: 11000,
      radiusMax: 23000,
      coupled: coupling('pitch', -1, 18000),
    });
  const splitLoop = () =>
    path('yz', p(0, 70.3, -21.5), -1, 18000, {
      radiusMin: 5000,
      radiusMax: 11000,
      min: p(-8, 3, -70),
      max: p(8, 95, 70),
      coupled: coupling('pitch', -1, 18000, 2000),
    });
  const orbit = (center = p(0, 25, 0), direction = 1) =>
    path('xz', center, direction, 36000, {
      min: { x: center.x - 16000, y: center.y - 2000, z: center.z - 16000 },
      max: { x: center.x + 16000, y: center.y + 2000, z: center.z + 16000 },
      noseToward: true,
    });
  const beam = (id, y, z) => [
    { id, min: p(-8, y - 1, z - 1), max: p(8, y + 1, z + 1) },
    { id: id + '-left', min: p(-9, 0, z - 1), max: p(-8, y + 1, z + 1) },
    { id: id + '-right', min: p(8, 0, z - 1), max: p(9, y + 1, z + 1) },
  ];
  const powerStages = () => [
    lift(0, 20, 30),
    gateNote(
      loopEntry,
      ['Build a clear entry line', 'Підготуйте вільну лінію входу'],
      [
        'Fly north through the entry gate with room to pitch back into the loop.',
        'Пройдіть на північ крізь вхідні ворота із запасом для петлі тангажем назад.',
      ],
    ),
    note(
      fullLoop(),
      ['Loop around the beam', 'Виконайте петлю навколо балки'],
      [
        'Pitch back through a complete loop over and beneath the beam. Follow the broad path and recover into the exit below it.',
        'Тангажем назад виконайте повну петлю над балкою й під нею. Дотримуйтеся широкої траєкторії та вийдіть із петлі знизу.',
      ],
      [
        'Both your pitch rotation and your path around the beam must complete together. A flip in place or a simple overflight does not qualify.',
        'Оберт за тангажем і траєкторія навколо балки мають завершитися разом. Сальто на місці чи простий проліт зверху не зараховуються.',
      ],
    ),
  ];
  const splitStages = () => [
    lift(0, 5, 60),
    gateNote(
      splitEntry,
      ['Build forward and upward momentum', 'Наберіть рух уперед і вгору'],
      [
        'Climb on the northbound approach before the entry gate. The following half-roll needs height and a continuing forward path.',
        'Набирайте висоту на північному заході до вхідних воріт. Наступна півбочка потребує висоти й продовження руху вперед.',
      ],
    ),
    rot(
      'roll',
      1,
      18000,
      'upright',
      ['Roll inverted first', 'Спершу переверніться креном'],
      [
        'Make a controlled right half-roll and stop inverted. Keep the forward path; the pitch phase follows next.',
        'Виконайте керовану праву півбочку й зупиніть обертання догори дном. Збережіть рух уперед; далі йде фаза тангажу.',
      ],
      { max: p(35, 95, 35), tolerance: 2000 },
    ),
    note(
      splitLoop(),
      ['Pull through the descending half-loop', 'Пройдіть низхідну півпетлю'],
      [
        'From inverted, pitch back through the lower half of the route and leave in the opposite direction below the entry.',
        'Із перевернутого положення тангажем назад пройдіть нижню частину маршруту й вийдіть у протилежному напрямку нижче входу.',
      ],
      [
        'The ordered half-roll, descending pitch path and reversed exit distinguish Split-S from a flat yaw turn.',
        'Послідовні півбочка, низхідна траєкторія тангажу й зворотний вихід відрізняють Split-S від плоского повороту за курсом.',
      ],
    ),
  ];
  const diveStages = (x = 0, z = 0) => [
    lift(x, 65, z),
    rot(
      'pitch',
      1,
      9000,
      'upright',
      ['Point the nose down', 'Спрямуйте ніс униз'],
      [
        'Rotate forward toward a nose-down attitude. Preserve the marked recovery height below you.',
        'Поверніть ніс уперед і вниз. Залишайте позначений запас висоти для виходу.',
      ],
      { min: p(x - 25, 4, z - 32), max: p(x + 25, 75, z + 32) },
    ),
    note(
      crossing('y', 55, -1, 2000, 2000, {
        minA: (x - 10) * 1000,
        maxA: (x + 10) * 1000,
        minB: (z - 10) * 1000,
        maxB: (z + 10) * 1000,
      }),
      ['Cross the dive marker', 'Перетніть позначку пікірування'],
      [
        'Descend nose-first through the marked height. Begin the recovery sequence as soon as this checkpoint confirms.',
        'Пройдіть носом униз крізь позначену висоту. Починайте послідовність виходу одразу після підтвердження.',
      ],
      [
        'The check uses actual downward travel and nose direction. Falling upright does not demonstrate a dive.',
        'Перевірка враховує справжній рух униз і напрямок носа. Падіння в рівному положенні не є пікіруванням.',
      ],
    ),
    rot(
      'pitch',
      -1,
      9000,
      'any',
      ['Recover before the lower boundary', 'Вийдіть до нижньої межі'],
      [
        'Pitch back toward level, then add thrust to stop the downward speed. Do not wait for the ground to fill the view.',
        'Тангажем назад поверніться до горизонту, потім додайте тягу для зупинки спуску. Не чекайте, доки земля заповнить кадр.',
      ],
      { min: p(x - 25, 4, z - 32), max: p(x + 25, 75, z + 32) },
    ),
  ];
  const lessons = [];
  function add(
    title,
    summary,
    environment,
    tier,
    tags,
    stages,
    { spawn = p(0, 0, 0), obstacles = [], duration = 7, concept } = {},
  ) {
    const index = 42 + lessons.length,
      id = `beginner-${index + 1}`,
      world = FLIGHT_WORLDS.find((w) => w.id === environment);
    const description = concept ?? [
      'Practise this sequence at a comfortable pace. The course checks actual attitude and travel together, then a controlled recovery.',
      'Відпрацьовуйте послідовність у зручному темпі. Урок перевіряє справжню орієнтацію й рух разом, а потім кероване відновлення польоту.',
    ];
    const c = course(
      id,
      stages.map((s) => s.target),
      {
        environment,
        world: { id: world.id, theme: world.theme, style: world.style },
        spawn,
        bounds: { min: p(-75, 0, -75), max: p(75, 100, 75) },
        obstacles: [...worldObstacles(environment), ...obstacles],
        locales: {
          en: { title: title[0], brief: summary[0], lesson: description[0] },
          uk: { title: title[1], brief: summary[1], lesson: description[1] },
        },
      },
    );
    lessons.push({
      id,
      index,
      title: txt(...title),
      summary: txt(...summary),
      concept: txt(...description),
      duration,
      chapter: tier,
      tier,
      skillTags: tags,
      mode: 'acro',
      requiresMode: 'acro',
      camera: 'fpv',
      recommendedPrerequisites: [`beginner-${index}`],
      course: c,
      steps: stages.map((s) => s.note),
    });
  }
  add(
    ['Roll and recover', 'Бочка та відновлення'],
    [
      'Complete a full roll each way and recover between them.',
      'Виконайте повну бочку в обидва боки з відновленням між ними.',
    ],
    'field',
    'pro',
    ['roll', 'rotation', 'recovery'],
    [
      lift(0, 35, 0),
      rot(
        'roll',
        1,
        36000,
        'upright',
        ['Full right roll', 'Повна бочка праворуч'],
        [
          'Roll all the way around to the right, then stop the rotation and recover.',
          'Виконайте повний оберт праворуч, потім зупиніть обертання й відновіть політ.',
        ],
      ),
      stop(0, 35, 0),
      rot(
        'roll',
        -1,
        36000,
        'upright',
        ['Full left roll', 'Повна бочка ліворуч'],
        [
          'Complete a full left roll. Use the horizon and the drone diagram to judge the upright recovery.',
          'Виконайте повну бочку ліворуч. За горизонтом і схемою дрона визначайте повернення до рівного польоту.',
        ],
      ),
      stop(0, 30, 0),
      finish(),
    ],
  );
  add(
    ['Forward and backward flip', 'Сальто вперед і назад'],
    [
      'Learn full pitch rotations in both directions, with a calm recovery.',
      'Навчіться повних обертів за тангажем в обидва боки зі спокійним відновленням.',
    ],
    'field',
    'pro',
    ['pitch', 'rotation', 'recovery'],
    [
      lift(0, 35, 0),
      rot(
        'pitch',
        1,
        36000,
        'upright',
        ['Forward flip', 'Сальто вперед'],
        [
          'Rotate the nose forward through a complete flip and stop when upright again.',
          'Поверніть ніс уперед через повне сальто й зупиніть обертання після вирівнювання.',
        ],
      ),
      stop(0, 35, 0),
      rot(
        'pitch',
        -1,
        36000,
        'upright',
        ['Backward flip', 'Сальто назад'],
        [
          'Rotate the nose backward through a complete flip, then recover into the marked space.',
          'Поверніть ніс назад через повне сальто й відновіть політ у позначеній зоні.',
        ],
      ),
      stop(0, 30, 0),
      finish(),
    ],
  );
  add(
    ['Yaw through 360 degrees', 'Повний оберт за курсом'],
    [
      'Turn the heading around each way while keeping a restrained position.',
      'Поверніть курс навколо в обидва боки, зберігаючи обмежений простір руху.',
    ],
    'stadium',
    'pro',
    ['yaw', 'heading', 'precision'],
    [
      lift(0, 15, 0),
      rot(
        'yaw',
        1,
        36000,
        'upright',
        ['Full right yaw', 'Повний поворот носа праворуч'],
        [
          'Turn the nose around to the right while staying upright inside the marked column.',
          'Поверніть ніс навколо праворуч, залишаючись рівно в позначеному стовпі.',
        ],
        { min: p(-4, 12, -4), max: p(4, 18, 4) },
      ),
      stop(0, 15, 0),
      rot(
        'yaw',
        -1,
        36000,
        'upright',
        ['Full left yaw', 'Повний поворот носа ліворуч'],
        [
          'Turn fully left while keeping height and drift under control.',
          'Виконайте повний поворот ліворуч, контролюючи висоту та дрейф.',
        ],
        { min: p(-4, 12, -4), max: p(4, 18, 4) },
      ),
      stop(0, 15, 0),
      finish(),
    ],
  );
  add(
    ['Recognize inverted, recover', 'Впізнайте переворот і відновіть політ'],
    [
      'Pause the rotation upside down briefly, then recover through the instructed side.',
      'Коротко зупиніть обертання догори дном, потім відновіть політ через вказаний бік.',
    ],
    'field',
    'pro',
    ['inversion', 'roll', 'recovery'],
    [
      lift(0, 40, 0),
      rot(
        'roll',
        1,
        18000,
        'upright',
        ['Half-roll into inversion', 'Півбочка до перевороту'],
        [
          'Roll halfway to the right and stop rotating upside down.',
          'Виконайте півбочку праворуч і зупиніть обертання догори дном.',
        ],
      ),
      note(
        attitude('inverted'),
        ['Recognize the inverted view', 'Упізнайте перевернутий вигляд'],
        [
          'Centre the rotation controls briefly and observe the inverted body. This is a short falling phase, not inverted hover.',
          'Коротко центруйте осі обертання й помітьте перевернутий корпус. Це коротка фаза падіння, а не зависання догори дном.',
        ],
      ),
      rot(
        'roll',
        1,
        18000,
        'inverted',
        ['Finish the right-side recovery', 'Завершіть відновлення праворуч'],
        [
          'Continue rolling right to upright, then recover the downward motion.',
          'Продовжіть крен праворуч до рівного положення, потім зупиніть спуск.',
        ],
      ),
      stop(0, 30, 0),
      finish(),
    ],
  );
  add(
    ['Split-S return', 'Розворот Split-S'],
    [
      'Roll inverted, descend through a half-loop and leave in the opposite direction.',
      'Переверніться креном, пройдіть низхідну півпетлю й вийдіть у протилежному напрямку.',
    ],
    'field',
    'pro',
    ['split-s', 'rotation', 'trajectory'],
    [
      ...splitStages(),
      stop(
        0,
        30,
        -18.5,
        ['Settle after the reverse exit', 'Стабілізуйтеся після зворотного виходу'],
        18000,
      ),
      finish(0, -18.5),
    ],
    { spawn: p(0, 0, 60), obstacles: beam('split-reference', 70.3, -21.5), duration: 9 },
  );
  add(
    ['Immelmann climb-out', 'Набір висоти з розворотом Іммельмана'],
    [
      'Climb through a half-loop, then roll upright into the reversed exit.',
      'Підніміться півпетлею, потім вирівняйтеся креном на зворотному виході.',
    ],
    'field',
    'pro',
    ['immelmann', 'climb', 'trajectory'],
    [
      lift(0, 20, 30),
      gateNote(
        loopEntry,
        ['Enter below the beam', 'Увійдіть нижче балки'],
        [
          'Establish the northbound entry line below the reference beam.',
          'Займіть північну лінію входу нижче опорної балки.',
        ],
      ),
      note(
        climbLoop(),
        ['Climbing half-loop first', 'Спершу висхідна півпетля'],
        [
          'Pitch back into a climbing half-loop and finish inverted above the beam.',
          'Тангажем назад увійдіть у висхідну півпетлю й завершіть її догори дном над балкою.',
        ],
      ),
      rot(
        'roll',
        1,
        18000,
        'inverted',
        ['Roll upright at the top', 'Вирівняйтеся креном угорі'],
        [
          'Roll right halfway to upright while continuing the reversed exit.',
          'Виконайте півбочку праворуч до рівного положення, продовжуючи зворотний вихід.',
        ],
      ),
      stop(0, 30, 20, ['Recover clear of the beam', 'Відновіть політ подалі від балки'], 18000),
      finish(0, 20),
    ],
    { spawn: p(0, 0, 30), obstacles: beam('climb-reference', 36, 0), duration: 8 },
  );
  add(
    ['Dive, judge, pull out', 'Пікірування й вихід'],
    [
      'Use a clear dive marker, then recover with height still available.',
      'Пройдіть чітку позначку пікірування й відновіть політ із запасом висоти.',
    ],
    'field',
    'pro',
    ['dive', 'pitch', 'recovery'],
    [...diveStages(), stop(0, 30, 0), finish()],
    { duration: 8 },
  );
  add(
    ['First power loop', 'Перша силова петля'],
    [
      'Complete a real loop around a broad beam and recover below it.',
      'Виконайте справжню петлю навколо широкої балки й відновіть політ під нею.',
    ],
    'field',
    'pro',
    ['power-loop', 'pitch', 'trajectory'],
    [...powerStages(), stop(0, 20, 0), finish()],
    { spawn: p(0, 0, 30), obstacles: beam('loop-reference', 36, 0), duration: 8 },
  );
  const barrel = path('xy', p(0, 36, 0), 1, 36000, {
    radiusMin: 11000,
    radiusMax: 23000,
    axialMin: -40000,
    axialMax: -18000,
    axialTolerance: 5000,
    coupled: coupling('roll', -1, 36000, 1800),
  });
  add(
    ['Barrel path', 'Спіральна бочка'],
    [
      'Combine a full roll with a spatial spiral and continuing forward travel.',
      'Поєднайте повну бочку з просторовою спіраллю та рухом уперед.',
    ],
    'field',
    'master',
    ['barrel', 'trajectory', 'momentum'],
    [
      lift(-60, 20, 20),
      gateNote(
        {
          type: 'gate',
          axis: 'x',
          at: 0,
          direction: 1,
          minSide: -6000,
          maxSide: 6000,
          minY: 18000,
          maxY: 22000,
        },
        ['Diagonal moving entry', 'Діагональний рухомий вхід'],
        [
          'Build rightward and forward travel into the broad entry, leaving room for the rising spiral.',
          'Наберіть рух праворуч і вперед до широкого входу, залишаючи місце для висхідної спіралі.',
        ],
      ),
      note(
        barrel,
        ['Roll around the lane', 'Виконайте бочку навколо лінії'],
        [
          'Follow the rising circular path while rolling left and travelling forward along the lane. Recover after one complete spiral.',
          'Рухайтеся висхідною круговою траєкторією, виконуючи бочку ліворуч і продовжуючи рух уперед. Відновіть політ після одного повного витка.',
        ],
        [
          'Body rotation, spatial winding and forward progress are checked together. Rolling in place does not satisfy this route.',
          'Оберт корпусу, просторова спіраль і рух уперед перевіряються разом. Бочка на місці не виконує цей маршрут.',
        ],
      ),
      stop(0, 20, -20),
      finish(0, -20),
    ],
    { spawn: p(-60, 0, 20), duration: 9 },
  );
  add(
    ['Orbit the landmark', 'Орбіта навколо орієнтира'],
    [
      'Circle a landmark in both directions while keeping the nose generally toward it.',
      'Облетіть орієнтир в обидва боки, тримаючи ніс переважно до нього.',
    ],
    'courtyard',
    'master',
    ['orbit', 'heading', 'trajectory'],
    [
      lift(10, 25, 0),
      stop(10, 25, 0, ['Face the landmark', 'Спрямуйте ніс до орієнтира'], -9000),
      note(
        orbit(),
        ['Complete the first orbit', 'Завершіть першу орбіту'],
        [
          'Circle the central landmark through all four sectors, keeping the marked distance and height.',
          'Облетіть центральний орієнтир через усі чотири сектори, зберігаючи позначену відстань і висоту.',
        ],
      ),
      stop(10, 25, 0, ['Settle before reversing', 'Стабілізуйтеся до зміни напрямку'], -9000),
      note(
        orbit(p(0, 25, 0), -1),
        ['Orbit in the other direction', 'Орбіта у протилежному напрямку'],
        [
          'Reverse the orbit direction and keep pointing generally toward the central landmark.',
          'Змініть напрямок обльоту й продовжуйте тримати ніс переважно до центрального орієнтира.',
        ],
      ),
      stop(10, 10, 0),
      finish(10, 0),
    ],
    {
      spawn: p(10, 0, 0),
      obstacles: [{ id: 'orbit-landmark', min: p(-1, 0, -1), max: p(1, 28, 1) }],
      duration: 9,
    },
  );
  add(
    ['Climbing corkscrew', 'Висхідна спіраль'],
    [
      'Make two full circuits around the training tower while steadily gaining height.',
      'Виконайте два повні обльоти навчальної вежі з поступовим набором висоти.',
    ],
    'field',
    'master',
    ['spiral', 'height', 'trajectory'],
    [
      lift(10, 20, 0),
      stop(10, 20, 0, ['Face the tower', 'Спрямуйте ніс до вежі'], -9000),
      note(
        path('xz', p(0, 20, 0), 1, 72000, {
          min: p(-16, 18, -16),
          max: p(16, 32, 16),
          noseToward: true,
          axialMin: 8000,
          axialMax: 10000,
          axialTolerance: 2000,
        }),
        ['Climb through two turns', 'Наберіть висоту за два оберти'],
        [
          'Circle twice while climbing along the marked spiral. Keep the tower ahead and stay inside the distance band.',
          'Виконайте два обльоти з набором висоти по позначеній спіралі. Тримайте вежу попереду й залишайтеся в межах заданої відстані.',
        ],
        [
          'Height gain must develop along the winding path. Two flat circles followed by a separate climb do not count.',
          'Висота має зростати вздовж спіральної траєкторії. Два горизонтальні кола з окремим підйомом потім не зараховуються.',
        ],
      ),
      stop(10, 30, 0),
      finish(10, 0),
    ],
    {
      spawn: p(10, 0, 0),
      obstacles: [{ id: 'spiral-tower', min: p(-1, 0, -1), max: p(1, 34, 1) }],
      duration: 9,
    },
  );
  add(
    ['Inverted turn and exit', 'Розворот у перевернутому положенні'],
    [
      'Use upward momentum, then link a half-roll, inverted yaw and controlled recovery.',
      'Використайте рух угору, потім поєднайте півбочку, поворот носа догори дном і кероване відновлення.',
    ],
    'field',
    'master',
    ['inverted-yaw', 'combination', 'recovery'],
    [
      lift(0, 15, 0),
      note(
        crossing('y', 50, 1, 15000, 9000, { minA: -4000, maxA: 4000, minB: -4000, maxB: 4000 }),
        ['Build the upward reserve', 'Наберіть запас руху вгору'],
        [
          'Climb firmly through the upper marker before beginning the inverted sequence. Keep the drone upright and centred over the entry.',
          'Упевнено наберіть висоту крізь верхню позначку до початку перевернутої послідовності. Тримайте дрон рівно над входом.',
        ],
      ),
      rot(
        'roll',
        1,
        18000,
        'upright',
        ['First half-roll', 'Перша півбочка'],
        [
          'Roll right to inverted and centre the rotation controls.',
          'Виконайте півбочку праворуч до перевернутого положення й центруйте осі обертання.',
        ],
      ),
      rot(
        'yaw',
        1,
        18000,
        'inverted',
        ['Yaw while inverted', 'Поверніть ніс догори дном'],
        [
          'Turn through a half yaw rotation while inverted. Watch the ground reference: body-axis yaw now has a different world-view effect.',
          'Виконайте півоберта за курсом у перевернутому положенні. Стежте за землею: оберт навколо осі корпусу тепер інакше змінює світ у кадрі.',
        ],
      ),
      rot(
        'roll',
        1,
        18000,
        'inverted',
        ['Recover through the final half-roll', 'Відновіть політ останньою півбочкою'],
        [
          'Continue through the instructed roll to upright, then stop the remaining descent.',
          'Виконайте вказану півбочку до рівного положення, потім зупиніть залишковий спуск.',
        ],
      ),
      stop(0, 20, 0, ['Finish facing the reverse heading', 'Завершіть на зворотному курсі'], 18000),
      finish(),
    ],
    { duration: 9 },
  );
  add(
    ['Loop into a roll', 'Петля з переходом у бочку'],
    [
      'Join a power loop to a separate roll zone without resetting the flight.',
      'З’єднайте силову петлю з окремою зоною бочки без скидання польоту.',
    ],
    'field',
    'master',
    ['combination', 'power-loop', 'roll'],
    [
      ...powerStages(),
      stop(15, 35, -10, ['Prepare the second manoeuvre', 'Підготуйте другий маневр']),
      rot(
        'roll',
        -1,
        36000,
        'upright',
        ['Roll through the exit zone', 'Виконайте бочку в зоні виходу'],
        [
          'Perform a full left roll in the open exit zone, then regain a steady flight.',
          'Виконайте повну бочку ліворуч у відкритій зоні виходу, потім відновіть стабільний політ.',
        ],
        { min: p(5, 8, -25), max: p(30, 70, 5) },
      ),
      stop(15, 15, -10),
      finish(15, -10),
    ],
    { spawn: p(0, 0, 30), obstacles: beam('linked-loop-reference', 36, 0), duration: 10 },
  );
  add(
    ['Split-S into an orbit', 'Split-S з переходом на орбіту'],
    [
      'Use the descending reverse exit to prepare a full landmark orbit.',
      'Використайте низхідний зворотний вихід для підготовки повного обльоту орієнтира.',
    ],
    'field',
    'master',
    ['combination', 'split-s', 'orbit'],
    [
      ...splitStages(),
      stop(10, 30, -18.5, ['Join the orbit entry', 'Увійдіть на орбіту'], -9000),
      note(
        orbit(p(0, 30, -18.5)),
        ['Continue around the landmark', 'Продовжіть навколо орієнтира'],
        [
          'Complete one full orbit with the landmark ahead, then leave toward the landing area.',
          'Виконайте один повний обліт з орієнтиром попереду, потім вийдіть до посадкової зони.',
        ],
      ),
      stop(10, 10, -18.5),
      finish(10, -18.5),
    ],
    {
      spawn: p(0, 0, 60),
      obstacles: [
        ...beam('linked-split-reference', 70.3, -21.5),
        { id: 'linked-orbit-marker', min: p(-1, 0, -19.5), max: p(1, 33, -17.5) },
      ],
      duration: 11,
    },
  );
  add(
    ['Race line with trick zones', 'Гоночна траєкторія з зонами трюків'],
    [
      'Fly a slalom, a marked roll zone and a controlled dive before the return gates.',
      'Пройдіть слалом, позначену зону бочки й кероване пікірування перед зворотними воротами.',
    ],
    'stadium',
    'master',
    ['race', 'roll', 'dive', 'combination'],
    [
      lift(0, 35, 0),
      gateNote(
        gate('z', -8, -4, -1, 35),
        ['First race gate', 'Перші гоночні ворота'],
        [
          'Move left through the first opening while reading the next gate.',
          'Пройдіть ліворуч крізь перший отвір, помічаючи наступні ворота.',
        ],
      ),
      gateNote(
        gate('z', -16, 4, -1, 35),
        ['Second race gate', 'Другі гоночні ворота'],
        [
          'Change the bank and align with the offset opening.',
          'Змініть крен і вирівняйтеся зі зміщеним отвором.',
        ],
      ),
      stop(0, 35, -24, ['Prepare the roll zone', 'Підготуйте зону бочки']),
      rot(
        'roll',
        1,
        36000,
        'upright',
        ['Roll inside the marked zone', 'Бочка в позначеній зоні'],
        [
          'Complete one full right roll inside the open zone and regain control before moving on.',
          'Виконайте повну бочку праворуч у відкритій зоні й відновіть керування перед продовженням.',
        ],
        { min: p(-15, 10, -35), max: p(15, 70, -10) },
      ),
      ...diveStages(12, -24),
      gateNote(
        gate('x', 4, -24, -1, 30),
        ['Return toward the race line', 'Поверніться до гоночної лінії'],
        [
          'After recovering, turn west through the high return gate.',
          'Після відновлення поверніть на захід крізь високі зворотні ворота.',
        ],
      ),
      gateNote(
        gate('z', -5, 0, 1, 3),
        ['Final descent and gate', 'Останній спуск і ворота'],
        [
          'Descend into the final southern gate, then brake toward the finish.',
          'Спустіться в останні південні ворота, потім загальмуйте до фінішу.',
        ],
      ),
      finish(),
    ],
    { duration: 11 },
  );
  add(
    ['Master flight', 'Майстерний політ'],
    [
      'Combine an Immelmann, high slalom, Split-S, power loop and physical platform landing.',
      'Поєднайте Іммельман, висотний слалом, Split-S, силову петлю й посадку на фізичну платформу.',
    ],
    'field',
    'master',
    ['capstone', 'combination', 'precision'],
    [
      lift(0, 20, 30),
      gateNote(
        loopEntry,
        ['Climb-out entry', 'Вхід у набір висоти'],
        [
          'Use the lower northbound line to begin the climbing half-loop.',
          'Використайте нижню північну лінію для початку висхідної півпетлі.',
        ],
      ),
      note(
        climbLoop(),
        ['Climb through the half-loop', 'Підніміться півпетлею'],
        [
          'Complete the climbing half-loop above the beam.',
          'Завершіть висхідну півпетлю над балкою.',
        ],
      ),
      rot(
        'roll',
        1,
        18000,
        'inverted',
        ['Recover upright at the top', 'Вирівняйтеся угорі'],
        [
          'Half-roll right to upright and read the high slalom beyond the beam.',
          'Виконайте півбочку праворуч до горизонту й знайдіть висотний слалом за балкою.',
        ],
      ),
      stop(0, 25, 15, ['Prepare the high slalom', 'Підготуйте висотний слалом'], 18000),
      gateNote(
        gate('z', 22, 5, 1, 25),
        ['First high slalom gate', 'Перші високі ворота слалому'],
        [
          'Fly south through the offset gate and prepare the opposite bank.',
          'Летіть на південь крізь зміщені ворота й підготуйте протилежний крен.',
        ],
      ),
      gateNote(
        gate('z', 30, -5, 1, 25),
        ['Second high slalom gate', 'Другі високі ворота слалому'],
        [
          'Change direction smoothly through the second opening.',
          'Плавно змініть напрямок крізь другий отвір.',
        ],
      ),
      ...splitStages(),
      stop(20, 40, 0, ['Reposition clear of the structures', 'Перейдіть подалі від конструкцій']),
      ...powerStages(),
      stop(15, 5, 7, ['Prepare the raised finish', 'Підготуйте піднятий фініш']),
      finish(15, 7, 3, 'master-finish-platform'),
    ],
    {
      spawn: p(0, 0, 30),
      obstacles: [
        ...beam('master-loop-reference', 36, 0),
        ...beam('master-split-reference', 70.3, -21.5),
        { id: 'master-finish-platform', min: p(11, 0, 3), max: p(19, 3, 11) },
      ],
      duration: 12,
    },
  );
  return Object.freeze(lessons);
})();

export const BEGINNER_LESSONS = Object.freeze([
  ...ORIGINAL_BEGINNER_LESSONS,
  ...NEW_ACRO_LESSONS,
  ...MASTERY_LESSONS,
  ...SKILL_LESSONS,
]);
export const ACRO_LESSON_ORDER = Object.freeze(
  [15, 16, 13, 17, 14, 18, 19, 20, 21, 22, 23, 24, 25, 26].map(
    (n) => `beginner-${String(n).padStart(2, '0')}`,
  ),
);
export const SELF_LEVEL_LESSON_ORDER = Object.freeze(
  ORIGINAL_BEGINNER_LESSONS.slice(0, 12).map((lesson) => lesson.id),
);
export const EXPERIENCED_LESSON_ORDER = Object.freeze(
  MASTERY_LESSONS.filter((lesson) => lesson.tier === 'experienced').map((lesson) => lesson.id),
);
export const ADVANCED_LESSON_ORDER = Object.freeze(
  MASTERY_LESSONS.filter((lesson) => lesson.tier === 'advanced').map((lesson) => lesson.id),
);
export const PRO_LESSON_ORDER = Object.freeze(
  SKILL_LESSONS.filter((lesson) => lesson.tier === 'pro').map((lesson) => lesson.id),
);
export const MASTER_LESSON_ORDER = Object.freeze(
  SKILL_LESSONS.filter((lesson) => lesson.tier === 'master').map((lesson) => lesson.id),
);
export const PRIMARY_LESSON_ORDER = Object.freeze([
  ...ACRO_LESSON_ORDER,
  ...EXPERIENCED_LESSON_ORDER,
  ...ADVANCED_LESSON_ORDER,
  ...PRO_LESSON_ORDER,
  ...MASTER_LESSON_ORDER,
]);
const SKILL_IDENTITY = `fpv-skills-school:${dataIdentity(SKILL_LESSONS.map((lesson) => lesson.course))}`;
const MASTERY_IDENTITY = `fpv-navigation-school:${dataIdentity(MASTERY_LESSONS.map((lesson) => lesson.course))}`;
const ACRO_IDENTITY = `fpv-acro-school:${dataIdentity(NEW_ACRO_LESSONS.map((lesson) => lesson.course))}`;
export const BEGINNER_CATALOGUE = Object.freeze(
  BEGINNER_LESSONS.map((lesson) => ({
    id: lesson.id,
    beginner: lesson.id,
    course: lesson.course,
    world: lesson.course.environment,
    theme: lesson.course.world.theme,
    activity: 'academy',
    difficulty: ['advanced', 'pro', 'master'].includes(lesson.tier)
      ? 'advanced'
      : lesson.tier === 'experienced'
        ? 'intermediate'
        : 'beginner',
    ...(lesson.tier ? { tier: lesson.tier, skillTags: lesson.skillTags } : {}),
    ...(lesson.requiresMode ? { requiresMode: lesson.requiresMode } : {}),
    duration: lesson.duration,
    packIdentity:
      lesson.index < 14
        ? BEGINNER_IDENTITY
        : lesson.index < 26
          ? ACRO_IDENTITY
          : lesson.index < 42
            ? MASTERY_IDENTITY
            : SKILL_IDENTITY,
    legacy: false,
  })),
);
