/** Twelve authored flight courses using native ground-patrol paths. These are
 * not grid AI aliases: interception uses fixed-point flight and finite targets. */
export const EXPRESSIVE_HUNT_CHAPTERS = Object.freeze([
  {
    id: 'ground-routes',
    title: { en: 'Snake Hunt · Ground Routes', uk: 'Змійка-полювання · Наземні маршрути' },
  },
  {
    id: 'approach-windows',
    title: { en: 'Snake Hunt · Approach Windows', uk: 'Змійка-полювання · Вікна підходу' },
  },
]);
const point = ([x, z, y = 0]) => ({
  x: Math.round(x * 1000),
  y: Math.round(y * 1000),
  z: Math.round(z * 1000),
});
const obstacle = ([x, z, width, depth, height, base = 0], index) => ({
  id: `structure-${index + 1}`,
  min: point([x - width / 2, z - depth / 2, base]),
  max: point([x + width / 2, z + depth / 2, base + height]),
});
const rows = [
  [
    'low-pass-depot',
    'Low Pass Depot',
    'Депо низьких прольотів',
    'warehouse',
    3,
    520,
    1,
    'Meet a slow perimeter patrol at a low crate crossing. Cut across the depot instead of following the loop.',
    'Перехопіть повільний патруль біля низьких ящиків. Перетніть депо навпростець замість руху по колу.',
    [
      [
        [-15, 13],
        [-15, -12],
        [15, -12],
        [15, 13],
      ],
    ],
    [
      [-6, 0, 4, 12, 1.2],
      [6, 0, 4, 12, 1.2],
    ],
  ],
  [
    'split-yard-return',
    'Split Yard Return',
    'Повернення розділеним двором',
    'warehouse',
    4,
    600,
    2,
    'Two independent patrol loops flank a divider. Return around its end or rise over it to change sides.',
    'Два окремі патрулі обходять перегородку. Оминайте її торець або перелітайте згори, щоб змінити бік.',
    [
      [
        [-25, 15],
        [-25, -19],
        [-7, -19],
        [-7, 15],
      ],
      [
        [7, 15],
        [7, -19],
        [25, -19],
        [25, 15],
      ],
    ],
    [[0, -2, 4, 30, 4]],
  ],
  [
    'crossing-arrivals',
    'Crossing Arrivals',
    'Зустрічні маршрути',
    'stadium',
    4,
    640,
    2,
    'Long and short patrol rectangles share two crossings. Choose an arrival to intercept rather than chase the closest body.',
    'Довгий і короткий патрульні прямокутники мають два перетини. Обирайте момент зустрічі, а не найближчу ціль.',
    [
      [
        [-26, -5],
        [26, -5],
        [26, 5],
        [-26, 5],
      ],
      [
        [-5, -25],
        [5, -25],
        [5, 23],
        [-5, 23],
      ],
    ],
    [
      [-17, -16, 8, 7, 3],
      [17, 15, 8, 7, 2],
    ],
  ],
  [
    'shelter-arc',
    'Shelter Arc',
    'Дуга біля укриття',
    'warehouse',
    5,
    680,
    2,
    'A horseshoe route passes through a broad sheltered lane. Wait at its open return or fly over the low shelter.',
    'Підковоподібний маршрут проходить широким захищеним коридором. Чекайте на відкритому поверненні або перелітайте укриття.',
    [
      [
        [-24, 18],
        [-24, -20],
        [24, -20],
        [24, 18],
        [12, 18],
        [12, -7],
        [-12, -7],
        [-12, 18],
      ],
    ],
    [
      [-18, 2, 4, 25, 3],
      [18, 2, 4, 25, 3],
      [0, -14, 32, 3, 2],
    ],
  ],
  [
    'freight-slalom',
    'Freight Slalom',
    'Вантажний слалом',
    'warehouse',
    5,
    720,
    3,
    'Patrols weave through three long aisles. Cross over a low freight row to gain an interception without threading every turn.',
    'Патрулі проходять три довгі проходи. Перелітайте низький ряд вантажів, щоб перехопити ціль без кожного повороту.',
    [
      [
        [-26, 18],
        [-26, -22],
        [-10, -22],
        [-10, 14],
        [8, 14],
        [8, -22],
        [26, -22],
        [26, 23],
        [-26, 23],
      ],
    ],
    [
      [-18, -3, 5, 29, 2.2],
      [-1, -6, 5, 29, 3.4],
      [17, -3, 5, 29, 2.2],
    ],
  ],
  [
    'forked-depot',
    'Forked Depot',
    'Розгалужене депо',
    'stadium',
    6,
    800,
    3,
    'Two loops use a shared approach but different return distances. Alternate wings to leave your growing echo behind.',
    'Дві петлі мають спільний підхід, але різну довжину повернення. Чергуйте крила, залишаючи твердий слід позаду.',
    [
      [
        [-4, 16],
        [-29, 16],
        [-29, -18],
        [-4, -18],
      ],
      [
        [4, 16],
        [28, 16],
        [28, -27],
        [4, -27],
      ],
    ],
    [
      [-16, -1, 10, 14, 3],
      [16, -7, 10, 22, 5],
    ],
  ],
  [
    'low-roof-window',
    'Low Roof Window',
    'Вікно під низьким дахом',
    'warehouse',
    4,
    580,
    2,
    'A broad canopy leaves a low approach underneath and an open aerial bypass. Settle your altitude before the patrol arrives.',
    'Широкий навіс залишає низький підхід знизу та відкритий обліт згори. Встановіть висоту до появи патруля.',
    [
      [
        [-20, 14],
        [-20, -14],
        [20, -14],
        [20, 14],
      ],
    ],
    [
      [0, 14, 22, 8, 1, 3.5],
      [-12, 9, 2, 2, 3.5],
      [12, 9, 2, 2, 3.5],
    ],
  ],
  [
    'roofline-exchange',
    'Roofline Exchange',
    'Обмін між дахами',
    'warehouse',
    4,
    620,
    2,
    'Patrols occupy two separate raised platforms. Gain height in the open centre, then descend toward each marked torso.',
    'Патрулі ходять двома окремими піднятими платформами. Набирайте висоту в центрі, потім знижуйтеся до позначених тулубів.',
    [
      [
        [-26, 10, 2],
        [-26, -10, 2],
        [-10, -10, 2],
        [-10, 10, 2],
      ],
      [
        [10, 10, 4],
        [10, -10, 4],
        [26, -10, 4],
        [26, 10, 4],
      ],
    ],
    [
      [-18, 0, 22, 26, 2],
      [18, 0, 22, 26, 4],
    ],
  ],
  [
    'return-slot',
    'Return Slot',
    'Щілина повернення',
    'stadium',
    5,
    700,
    3,
    'A long wall has one wide ground-level slot. Intercept there or spend height to take the outer return.',
    'Довга стіна має один широкий прохід унизу. Перехоплюйте там або набирайте висоту для зовнішнього повернення.',
    [
      [
        [-24, 10],
        [-24, 4],
        [-2, 4],
        [-2, -10],
        [24, -10],
        [24, -4],
        [2, -4],
        [2, 10],
      ],
    ],
    [
      [-18, 0, 26, 3, 4],
      [18, 0, 26, 3, 4],
    ],
  ],
  [
    'staggered-roofs',
    'Staggered Roofs',
    'Дахи різної висоти',
    'warehouse',
    5,
    720,
    3,
    'A perimeter patrol surrounds three unequal roofs. Choose the low crossing or a wider, flatter approach.',
    'Патруль оточує три дахи різної висоти. Обирайте низький перетин або ширший рівний підхід.',
    [
      [
        [-28, 19],
        [-28, -22],
        [28, -22],
        [28, 19],
      ],
    ],
    [
      [-16, -1, 8, 25, 2],
      [0, -7, 8, 22, 5],
      [16, 4, 8, 25, 3],
    ],
  ],
  [
    'window-chain',
    'Window Chain',
    'Ланцюжок вікон',
    'warehouse',
    6,
    820,
    4,
    'Two low canopies interrupt opposite patrol straights. Clear each approach before committing and keep the echo out of your return.',
    'Два низькі навіси перекривають протилежні прямі патруля. Вирівнюйте підхід і не залишайте слід на шляху повернення.',
    [
      [
        [-25, 16],
        [-25, -16],
        [25, -16],
        [25, 16],
      ],
    ],
    [
      [-25, 0, 8, 20, 1, 3.5],
      [25, 0, 8, 20, 1, 4],
      [0, 0, 14, 16, 2.5],
    ],
  ],
  [
    'three-yard-finale',
    'Three-yard Finale',
    'Фінал трьох дворів',
    'stadium',
    8,
    900,
    4,
    'Three courtyards offer low passages and aerial shortcuts. Plan a sweep that leaves space for eight catches and a long echo.',
    'Три двори дають низькі проходи та повітряні скорочення. Сплануйте обхід для восьми перехоплень і довгого сліду.',
    [
      [
        [-29, 21],
        [-29, -24],
        [-10, -24],
        [-10, 21],
      ],
      [
        [0, 21],
        [0, -24],
        [28, -24],
        [28, 21],
      ],
    ],
    [
      [-20, -1, 9, 30, 3],
      [14, -11, 16, 12, 5],
      [14, 11, 16, 8, 2],
    ],
  ],
];

function makeCourse(row, index) {
  const [slug, en, uk, environment, count, speed, growth, enBrief, ukBrief, routes, structures] =
    row;
  const actors = Array.from({ length: count }, (_, actorIndex) => {
    const routeIndex = actorIndex % routes.length;
    const route = routes[routeIndex];
    const population = Math.ceil((count - routeIndex) / routes.length);
    const progress = (Math.floor(actorIndex / routes.length) * route.length) / population;
    const segment = Math.floor(progress);
    const fraction = progress - segment;
    const start = point(route[segment]);
    const next = point(route[(segment + 1) % route.length]);
    const position = Object.fromEntries(
      ['x', 'y', 'z'].map((axis) => [
        axis,
        Math.round(start[axis] + (next[axis] - start[axis]) * fraction),
      ]),
    );
    const offset = (segment + 1) % route.length;
    const path = [...route.slice(offset), ...route.slice(0, offset)].map(point);
    return {
      id: `patroller-${String(actorIndex + 1).padStart(2, '0')}`,
      type: 'patrol',
      role: 'hostile',
      position,
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
    id: `snake-hunt-${EXPRESSIVE_HUNT_CHAPTERS[Math.floor(index / 6)].id}-${slug}`,
    revision: 'r1',
    environment,
    locales: {
      en: {
        title: en,
        brief: enBrief,
        lesson: `Catch all ${count} unarmed patrol targets by physical contact, in any order. Patrols follow fixed routes and wait at blocked geometry; they do not flee or use armor. Each catch adds ${growth} solid echo links. Use native manual flight controls and aim for the marked torso about one metre above its surface.`,
      },
      uk: {
        title: uk,
        brief: ukBrief,
        lesson: `Спіймайте всі ${count} неозброєні патрульні цілі дотиком у довільному порядку. Патрулі рухаються фіксованими маршрутами та зупиняються перед перешкодами; вони не тікають і не мають броні. Кожен дотик додає ${growth} ланок твердого сліду. Керуйте звичайною ручною тягою та цільтеся в позначений тулуб приблизно за метр над поверхнею.`,
      },
    },
    spawn: point([0, 33]),
    bounds: { min: point([-38, -36]), max: point([38, 38, 20]) },
    obstacles: structures.map(obstacle),
    actors,
    steps: { 'self-level': [criterion], acro: [structuredClone(criterion)] },
    world: { id: environment, theme: 'pixel', style: environment },
    rules: { seed: 9601 + index, maxTicks: 36000, collisionDamage: 0 },
    conditions: { profile: 'clear', revision: 'r1' },
  };
}
export const EXPRESSIVE_HUNT_COURSES = Object.freeze(rows.map(makeCourse));
