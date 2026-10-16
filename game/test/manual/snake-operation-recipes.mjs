// Review-only recipes: not registered as campaign content or awarded records.
const point = (x, y) => ({ x, y });
const rectangle = (x, y, w, h) =>
  Array.from({ length: w * h }, (_, i) => point(x + (i % w), y + Math.floor(i / w)));
const stage = (id, catches, deliveries = [], exit = null) => ({ id, catches, deliveries, exit });
const parcel = (id, x, y, dockId) => ({ id, at: point(x, y), dockId });
const dock = (id, x, y) => ({ id, at: point(x, y) });
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function recipe(id, name, walls, goal, operation, wrap = false) {
  return {
    version: 'classic-snake-level.v5',
    id: `prototype-${id}`,
    revision: 'prototype-1',
    name,
    width: 24,
    height: 18,
    walls: [...walls].sort((a, b) => a.y - b.y || a.x - b.x),
    spawns: [
      { x: 5, y: 2, direction: 'right' },
      { x: 18, y: 15, direction: 'left' },
    ],
    goal,
    stepMs: 200,
    minStepMs: 200,
    speedupEvery: 0,
    wrap,
    targetMovement: 'still',
    fleeEvery: 3,
    objective: 'mission',
    targets: { maxActive: 1, required: [{ kind: 'runner', every: 3 }], bonus: null },
    shutters: [],
    pickups: [],
    operation,
  };
}
const CARGO_PROTOTYPES = freeze([
  {
    title: { en: 'Two clearances', uk: 'Два дозволи' },
    scene: 'relay',
    hint: {
      en: 'Catch one runner and cross the first extraction pad. The second clearance continues on the same cable.',
      uk: 'Спіймайте бігуна та пройдіть перший майданчик евакуації. Другий етап триває з тим самим кабелем.',
    },
    level: recipe('two-clearances', 'Two clearances', [], 2, {
      stages: [
        stage('first-clearance', 1, [], point(19, 3)),
        stage('second-clearance', 2, [], point(4, 14)),
      ],
      parcels: [],
      docks: [],
    }),
  },
  {
    title: { en: 'Harbor handoff', uk: 'Передача в гавані' },
    scene: 'harbor',
    hint: {
      en: 'Catch, cross the harbor, then catch again. Wrapping edges give you a second approach to extraction.',
      uk: 'Спіймайте ціль, перетніть гавань і спіймайте ще одну. Переходи через край дають другий шлях до евакуації.',
    },
    level: recipe(
      'harbor-handoff',
      'Harbor handoff',
      [...rectangle(9, 5, 3, 4), ...rectangle(15, 10, 3, 3)],
      3,
      {
        stages: [
          stage('survey', 1),
          stage('crossing', 1, [], point(2, 9)),
          stage('return', 3, [], point(21, 9)),
        ],
        parcels: [],
        docks: [],
      },
      true,
    ),
  },
  {
    title: { en: 'Loaded loop', uk: 'Вантажна петля' },
    scene: 'orchard',
    hint: {
      en: 'Take both parcels to dock A. Each adds one temporary cable segment. Deliver to shorten, then catch two runners and extract.',
      uk: 'Доставте обидві посилки до доку A. Кожна тимчасово подовжує кабель на одну ланку. Розвантажтеся, спіймайте двох бігунів і вирушайте на евакуацію.',
    },
    level: recipe('loaded-loop', 'Loaded loop', rectangle(10, 7, 4, 3), 2, {
      stages: [
        stage('delivery', 0, ['parcel-a', 'parcel-b']),
        stage('pursuit', 2),
        stage('extraction', 2, [], point(5, 12)),
      ],
      parcels: [parcel('parcel-a', 9, 2, 'dock-a'), parcel('parcel-b', 18, 5, 'dock-a')],
      docks: [dock('dock-a', 18, 12)],
    }),
  },
  {
    title: { en: 'Freight partners', uk: 'Вантажні напарники' },
    scene: 'freight',
    hint: {
      en: 'Match four parcels to docks A and B. In Team, deliveries are shared and either pilot can finish extraction.',
      uk: 'Доставте чотири посилки до відповідних доків A та B. У команді доставки спільні, а завершити евакуацію може будь-який пілот.',
    },
    level: recipe(
      'freight-partners',
      'Freight partners',
      [...rectangle(10, 5, 2, 3), ...rectangle(12, 10, 2, 3)],
      2,
      {
        stages: [
          stage('freight', 1, ['parcel-a', 'parcel-b', 'parcel-c', 'parcel-d']),
          stage('rendezvous', 2, [], point(12, 3)),
        ],
        parcels: [
          parcel('parcel-a', 8, 3, 'dock-a'),
          parcel('parcel-b', 4, 9, 'dock-b'),
          parcel('parcel-c', 19, 8, 'dock-a'),
          parcel('parcel-d', 16, 14, 'dock-b'),
        ],
        docks: [dock('dock-a', 4, 14), dock('dock-b', 20, 3)],
      },
    ),
  },
]);

function loop(x, y, dx, dy, w = 4, h = 4) {
  const path = [point(x, y)];
  for (let i = 1; i <= w; i++) path.push(point(x + dx * i, y));
  for (let i = 1; i <= h; i++) path.push(point(x + dx * w, y + dy * i));
  for (let i = w - 1; i >= 0; i--) path.push(point(x + dx * i, y + dy * h));
  for (let i = h - 1; i > 0; i--) path.push(point(x, y + dy * i));
  return path;
}
function routed(id, name, walls, groups, stages, goal = 2) {
  const level = recipe(id, name, walls, goal, {
    stages,
    parcels: [],
    docks: [],
    switchyards: groups,
  });
  level.targets = {
    maxActive: groups.length,
    required: groups.map((g) => ({ kind: 'patroller', every: 4, path: g.routes[0] })),
    bonus: null,
  };
  return level;
}
const activation = (kind, id, count = 1) => ({ kind, id, count });
const activationStage = (id, catches, activations, exit = null) => ({
  ...stage(id, catches, [], exit),
  activations,
});
const junction = (id, policyIndex, x, y, switches, w = 4, h = 4) => ({
  id,
  policyIndex,
  switches,
  routes: [loop(x, y, -1, -1, w, h), loop(x, y, 1, 1, w, h)],
});
const ROUTING_PROTOTYPES = [
  {
    title: { en: 'Choose the branch', uk: 'Обери гілку' },
    scene: 'freight',
    hint: {
      en: 'Cross either linked switch to change the next branch at the diamond junction. Intercept the patrol on the selected loop; it never reverses mid-route.',
      uk: 'Перетніть один зі з’єднаних перемикачів, щоб змінити наступну гілку на розвилці. Перехопіть патруль на обраному колі: посеред маршруту він не розвертається.',
    },
    level: routed(
      'choose-branch',
      'Choose the branch',
      [...rectangle(9, 5, 2, 2), ...rectangle(14, 10, 2, 2)],
      [junction('freight', 0, 12, 8, [point(6, 8), point(19, 6)])],
      [activationStage('interception', 2, [activation('switchyard', 'freight')], point(20, 12))],
    ),
  },
  {
    title: { en: 'Two dispatchers', uk: 'Два диспетчери' },
    scene: 'freight',
    hint: {
      en: 'Two junctions, two patrols. Route each patrol separately, then find an interception lane that keeps your growing cable clear.',
      uk: 'Дві розвилки та два патрулі. Спрямуйте кожен окремо, а тоді знайдіть шлях перехоплення, не перекриваючи його кабелем.',
    },
    level: routed(
      'two-dispatchers',
      'Two dispatchers',
      [
        ...rectangle(6, 6, 1, 1),
        ...rectangle(10, 10, 1, 1),
        ...rectangle(15, 6, 1, 1),
        ...rectangle(19, 10, 1, 1),
      ],
      [
        junction('west', 0, 8, 8, [point(3, 8)], 3, 3),
        junction('east', 1, 17, 8, [point(21, 8)], 3, 3),
      ],
      [
        activationStage('dispatch', 1, [
          activation('switchyard', 'west'),
          activation('switchyard', 'east'),
        ]),
        stage('collection', 4, [], point(12, 14)),
      ],
      4,
    ),
  },
  {
    title: { en: 'Hold the shortcut', uk: 'Утримай короткий шлях' },
    scene: 'workshop',
    hint: {
      en: 'Your cable holds the striped plate down. Cross its open gate or take the outside bypass. After release, amber warns for at least 800 ms; the gate yields while occupied.',
      uk: 'Кабель утримує смугасту плиту. Пройдіть відкриті ворота або скористайтеся обходом. Після звільнення плити жовтий сигнал попереджає щонайменше 800 мс; зайняті ворота не зачиняються.',
    },
    level: recipe(
      'hold-shortcut',
      'Hold the shortcut',
      [...rectangle(10, 4, 1, 4), ...rectangle(10, 9, 1, 5)],
      1,
      {
        stages: [
          activationStage('crossing', 0, [activation('plate', 'copper')], point(14, 8)),
          stage('return', 1, [], point(4, 12)),
        ],
        parcels: [],
        docks: [],
        plates: [{ id: 'copper', pads: [point(7, 8)], gates: [point(10, 8)] }],
      },
    ),
  },
  {
    title: { en: 'Loaded pressure', uk: 'Вантаж під тиском' },
    scene: 'workshop',
    hint: {
      en: 'Load two parcels before crossing the pressure court. Extra cable keeps the shortcut open longer; unload on the far side and plan a lighter return.',
      uk: 'Візьміть дві посилки перед переходом через плиту. Довший кабель довше утримує короткий шлях відкритим. Розвантажтеся з іншого боку та сплануйте легше повернення.',
    },
    level: recipe(
      'loaded-pressure',
      'Loaded pressure',
      [...rectangle(13, 4, 2, 3), ...rectangle(13, 10, 2, 4)],
      1,
      {
        stages: [
          {
            ...stage('pressure-delivery', 0, ['parcel-a', 'parcel-b']),
            activations: [activation('plate', 'pressure')],
          },
          stage('extraction', 1, [], point(5, 13)),
        ],
        parcels: [parcel('parcel-a', 8, 3, 'east-dock'), parcel('parcel-b', 8, 12, 'east-dock')],
        docks: [dock('east-dock', 19, 8)],
        plates: [
          {
            id: 'pressure',
            pads: [point(10, 8)],
            gates: [
              point(13, 7),
              point(14, 7),
              point(13, 8),
              point(14, 8),
              point(13, 9),
              point(14, 9),
            ],
          },
        ],
      },
    ),
  },
];
export const OPERATION_PROTOTYPES = freeze([...CARGO_PROTOTYPES, ...ROUTING_PROTOTYPES]);
