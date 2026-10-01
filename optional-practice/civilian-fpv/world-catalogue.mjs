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
const schoolNote = (title, instruction, why, axis, motion, target, tip, direction = 1) => ({
  title: text(...title),
  instruction: text(...instruction),
  why: text(...why),
  axis,
  motion,
  direction,
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
export const BEGINNER_LESSONS = Object.freeze([
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
          'route',
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
          'throttle',
          'hover',
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
const BEGINNER_IDENTITY = `fpv-beginner:${dataIdentity(BEGINNER_LESSONS.map((lesson) => lesson.course))}`;
export const BEGINNER_CATALOGUE = Object.freeze(
  BEGINNER_LESSONS.map((lesson) => ({
    id: lesson.id,
    beginner: lesson.id,
    course: lesson.course,
    world: lesson.course.environment,
    theme: 'academy',
    activity: 'academy',
    difficulty: 'beginner',
    duration: lesson.duration,
    packIdentity: BEGINNER_IDENTITY,
    legacy: false,
  })),
);
