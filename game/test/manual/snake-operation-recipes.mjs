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
    walls,
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
export const OPERATION_PROTOTYPES = freeze([
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
