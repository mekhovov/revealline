import { dataIdentity } from '../../game/data-json.mjs';

const point = (x, z) => ({ x: x * 1000, y: 0, z: z * 1000 });
const routes = [
  [
    'runner-court',
    'Runner Court',
    'Двір бігунів',
    ['runner'],
    [0],
    [2],
    'Approach from a crossing. The runner commits for half a second, then chooses a reachable escape.',
  ],
  [
    'burst-lanes',
    'Burst Lanes',
    'Смуги ривків',
    ['sprinter'],
    [1],
    [3],
    'Watch the crouch, let the straight burst pass, then intercept during recovery.',
  ],
  [
    'refuge-return',
    'Refuge Return',
    'Повернення до укриття',
    ['refuge-seeker', 'courier'],
    [0, 4],
    [2, 5],
    'Cover the refuge approach; the parcel courier is optional and remains until caught.',
  ],
  [
    'switchback-crossing',
    'Switchback Crossing',
    'Перехрестя зміни напрямку',
    ['switchback', 'patroller'],
    [1, 3],
    [4, 0],
    'Read the announced next exit instead of following the nearest body.',
  ],
  [
    'meeting-yard',
    'Meeting Yard',
    'Двір зустрічі',
    ['rendezvous-pair', 'rendezvous-pair'],
    [0, 2],
    [4, 4],
    'Two partners seek the same meeting point. Catch one and the survivor becomes a runner.',
  ],
  [
    'armor-windows',
    'Armor Windows',
    'Вікна броні',
    ['shield-bearer', 'brace-trooper'],
    [1, 3],
    [5, 4],
    'Shield front contact and a braced trooper damage the hull. Use the shield’s sides or rear and the trooper’s recovery.',
  ],
];
const positions = [
  point(-8, 6),
  point(-8, -6),
  point(8, -6),
  point(8, 6),
  point(0, -6),
  point(0, 6),
];
const nodes = positions.map((position, index) => ({ id: `node-${index + 1}`, position }));
const edges = [
  [0, 1],
  [1, 4],
  [4, 2],
  [2, 3],
  [3, 5],
  [5, 0],
  [4, 5],
].map(([a, b]) => ({ from: nodes[a].id, to: nodes[b].id }));
export const NATIVE_PURSUIT_COURSES = Object.freeze(
  routes.map(([slug, en, uk, families, starts, goals, brief], index) => {
    const actors = families.map((family, i) => ({
      id: `pursuit-${i + 1}`,
      type: 'patrol',
      role: 'hostile',
      position: { ...positions[starts[i]] },
      path: [],
      speed: 1500,
      radius: 350,
      height: 1800,
      health: 50,
      fireEveryTicks: 0,
      damage: 0,
    }));
    if (index < 5)
      actors.push({
        id: 'field-machine',
        type: 'vehicle',
        role: 'hostile',
        vehicleModel: [
          'field-utility',
          'cargo-truck',
          'armored-carrier',
          'field-tank',
          'relay-truck',
        ][index],
        position: point(-13, 0),
        path: [],
        speed: 0,
        radius: 1100,
        height: 2200,
        health: 50,
        fireEveryTicks: 0,
        damage: 0,
      });
    const target = {
      type: 'hunt-contact-v1',
      targets: actors
        .filter((actor, i) => families[i] && families[i] !== 'courier')
        .map((actor) => actor.id),
      ordered: false,
      tail: {
        linksPerCatch: index >= 3 ? 1 : 0,
        maxLinks: index >= 3 ? 32 : 0,
        neckDistance: 4500,
        radius: 350,
      },
    };
    return {
      format: 'FlightCourse.v3',
      id: `native-pursuit-${slug}`,
      revision: 'r1',
      environment: 'stadium',
      locales: {
        en: {
          title: en,
          brief,
          lesson:
            'Native pursuit. All required targets are finite. Use manual flight controls and touch the torso. Unarmed targets do not fire; armor has visible contact rules. Optional courier catches are recorded separately without quota credit.',
        },
        uk: {
          title: uk,
          brief:
            'Наземне переслідування з ручним керуванням польотом. Спостерігайте за намірами цілей та обирайте шлях перехоплення.',
          lesson:
            'Цілі скінченні й неозброєні. Торкайтеся тулуба. Бігун тікає, спринтер попереджає про ривок, пара шукає зустріч. Щит захищає спереду; боєць відкритий під час відновлення. Необов’язковий кур’єр обліковується окремо без заліку цілі.',
        },
      },
      spawn: point(0, 14),
      bounds: { min: point(-18, -16), max: { ...point(18, 18), y: 12000 } },
      obstacles: [
        {
          id: `court-island-${index + 1}`,
          min: { x: -6000, y: 0, z: -2000 },
          max: { x: -3000, y: ((index % 3) + 1) * 800, z: 2000 },
        },
      ],
      actors,
      steps: { 'self-level': [target], acro: [structuredClone(target)] },
      pursuit: {
        format: 'FlightPursuit.v1',
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
        actors: actors
          .filter((actor) => actor.id !== 'field-machine')
          .map((actor, i) => ({
            id: actor.id,
            family: families[i],
            start: nodes[starts[i]].id,
            goals:
              families[i] === 'rendezvous-pair'
                ? [nodes[goals[i]].id]
                : [nodes[goals[i]].id, nodes[starts[i]].id],
            pair: families[i] === 'rendezvous-pair' ? 'meeting-one' : null,
          })),
      },
      world: { id: 'stadium', theme: 'operations', style: 'stadium' },
      rules: { seed: 9801 + index, maxTicks: 36000, collisionDamage: 0 },
      conditions: { profile: 'clear', revision: 'r1' },
    };
  }),
);
export const NATIVE_PURSUIT_IDENTITY = `fpv-native-pursuit:${dataIdentity(NATIVE_PURSUIT_COURSES)}`;
export const NATIVE_PURSUIT_CATALOGUE = Object.freeze(
  NATIVE_PURSUIT_COURSES.map((course, index) => ({
    id: course.id,
    course,
    world: 'stadium',
    theme: 'snake-hunt',
    activity: 'hunt',
    difficulty: index < 2 ? 'beginner' : index < 5 ? 'intermediate' : 'advanced',
    duration: 4,
    packIdentity: NATIVE_PURSUIT_IDENTITY,
    legacy: false,
  })),
);
export const NATIVE_PURSUIT_PLAYLIST = Object.freeze({
  format: 'FPVPlaylist.v1',
  id: 'native-pursuit',
  revision: 'r1',
  title: { en: 'Native Pursuit · Ground intentions', uk: 'Наземне переслідування · Наміри цілей' },
  entries: NATIVE_PURSUIT_CATALOGUE.map((entry) => ({
    packIdentity: entry.packIdentity,
    levelId: entry.id,
  })),
});
