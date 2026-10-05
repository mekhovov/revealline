/** Additive authored encounters. Historical level recipes remain byte-for-byte unchanged. */
const bilingual = (en, uk) => ({ en, uk });
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const cell = ([x, y]) => ({ x, y });
function rectanglePath(x, y, w, h) {
  const path = [];
  for (let dx = 0; dx < w; dx++) path.push({ x: x + dx, y });
  for (let dy = 1; dy < h; dy++) path.push({ x: x + w - 1, y: y + dy });
  for (let dx = w - 2; dx >= 0; dx--) path.push({ x: x + dx, y: y + h - 1 });
  for (let dy = h - 2; dy > 0; dy--) path.push({ x, y: y + dy });
  return path;
}
function wallsFor(rectangles) {
  const cells = new Map();
  for (const [x, y, w, h] of rectangles)
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) cells.set(`${x + dx},${y + dy}`, { x: x + dx, y: y + dy });
  return [...cells.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
const jammer = (at = [20, 8]) => ({ kind: 'jammer', every: 3, at: cell(at) });
const lane = (at = [5, 8]) => ({
  kind: 'lane',
  every: 3,
  at: cell(at),
  lane: { axis: 'x', from: 5, to: 18 },
});
const relay = (
  at = [12, 8],
  pads = [
    [6, 8],
    [18, 8],
  ],
) => ({ kind: 'relay', every: 3, at: cell(at), relays: pads.map(cell) });
const perimeter = () => ({ kind: 'perimeter', every: 4, path: rectanglePath(1, 1, 22, 16) });
const contour = () => ({ kind: 'contour', every: 4, path: rectanglePath(8, 5, 8, 8) });
const rover = () => ({ kind: 'rover', every: 3 });
const ricochet = () => ({ kind: 'ricochet', every: 3, heading: 'right' });
const eroder = () => ({ kind: 'eroder', every: 3, at: cell([11, 8]), breaks: [cell([12, 8])] });
const guard = (at = [6, 8], heading = 'right') => ({
  kind: 'guard',
  every: 3,
  at: cell(at),
  heading,
});
const runner = () => ({ kind: 'runner', every: 3 });
export const CLASSIC_SNAKE_V4_CHAPTERS = freeze([
  {
    id: 'classic-snake-signal-tactics',
    title: bilingual('Signal Tactics', 'Тактика сигналу'),
    description: bilingual(
      'Eight missions teach interference, warned lanes and linked relays.',
      'Вісім місій навчають перешкодам, попередженим смугам і пов’язаним ретрансляторам.',
    ),
  },
  {
    id: 'classic-snake-patrol-frontiers',
    title: bilingual('Patrol Frontiers', 'Межі патруля'),
    description: bilingual(
      'Six missions introduce perimeter patrols, contour routes and waking rovers.',
      'Шість місій знайомлять із патрулями периметра, контурними маршрутами та пробудженням роверів.',
    ),
  },
  {
    id: 'classic-snake-field-mastery',
    title: bilingual('Field Mastery', 'Майстерність поля'),
    description: bilingual(
      'Eight missions combine reflected routes, opening walls and warned projectiles.',
      'Вісім місій поєднують відбиті маршрути, відкриття стін і попереджені постріли.',
    ),
  },
]);
// Each introduction isolates its new idea. Mastery adds geometry before combining mechanics.
const first = [
  [
    'signal-check',
    'Signal Check',
    'Перевірка сигналу',
    [[10, 5, 3, 3]],
    [jammer(), jammer([3, 10])],
    4,
    'The antenna warns before four moves of signal loss. Memorize your route: the whole field disappears, but steering continues. Catch the jammer to restore reception.',
    'Антена попереджає перед чотирма ходами втрати сигналу. Запам’ятайте маршрут: усе поле зникне, але керування діє. Спіймайте глушник для відновлення прийому.',
  ],
  [
    'quiet-return',
    'Quiet Return',
    'Тихе повернення',
    [
      [8, 4, 2, 5],
      [14, 10, 3, 3],
    ],
    [jammer(), runner(), jammer([3, 10])],
    6,
    'Plan your return while reception is clear. During signal loss, steer from memory for four moves; enemies, walls and your cable are hidden.',
    'Плануйте повернення за чистого прийому. Під час втрати сигналу керуйте з пам’яті чотири ходи: вороги, стіни й кабель приховані.',
  ],
  [
    'lane-window',
    'Lane Window',
    'Вікно смуги',
    [[10, 4, 4, 2]],
    [lane(), lane([18, 8])],
    4,
    'Dashed marks warn before the lane turns solid. Cross during recovery, or use either permanent end bypass.',
    'Пунктир попереджає перед активацією смуги. Перетинайте її під час відновлення або обходьте з кінців.',
  ],
  [
    'two-returns',
    'Two Returns',
    'Два обходи',
    [
      [9, 4, 2, 3],
      [14, 10, 2, 4],
    ],
    [lane(), runner(), lane([18, 8])],
    6,
    'Only the head is vulnerable to the active lane. Your trailing cable can pass safely.',
    'Активна смуга небезпечна лише для голови. Кабель позаду проходить безпечно.',
  ],
  [
    'relay-key',
    'Relay Key',
    'Ключ ретранслятора',
    [
      [10, 4, 4, 2],
      [10, 11, 4, 2],
    ],
    [relay()],
    1,
    'Touch both diamond relays, then catch the opened sentinel. Relays do not grow your cable; the opening stays available.',
    'Торкніться обох ромбів, потім ловіть відкритого вартового. Ретранслятори не подовжують кабель; вікно не закривається.',
  ],
  [
    'linked-courts',
    'Linked Courts',
    'Пов’язані двори',
    [
      [8, 4, 2, 3],
      [14, 11, 2, 3],
      [4, 11, 2, 2],
    ],
    [
      relay(
        [12, 8],
        [
          [4, 5],
          [20, 12],
        ],
      ),
    ],
    1,
    'Visit the two courts before approaching the locked core. Leave a clear route back to the center.',
    'Відвідайте обидва двори перед наближенням до замкненого ядра. Залиште вільний шлях до центру.',
  ],
  [
    'signal-crossing',
    'Signal Crossing',
    'Сигнальний перехід',
    [
      [9, 4, 3, 3],
      [13, 11, 3, 3],
    ],
    [jammer(), lane()],
    6,
    'Memorize a safe crossing before the four-move blackout. The lane waits for reception to return, then gives a full new warning.',
    'Запам’ятайте безпечний перехід перед втратою сигналу на чотири ходи. Смуга чекає відновлення прийому й дає повне нове попередження.',
  ],
  [
    'relay-airfield',
    'Relay Airfield',
    'Аеродром ретрансляторів',
    [
      [8, 4, 2, 3],
      [14, 11, 3, 3],
    ],
    [
      jammer(),
      lane(),
      relay(
        [12, 8],
        [
          [3, 5],
          [20, 12],
        ],
      ),
    ],
    6,
    'Remember the relay positions before signal loss, then time the crossing and unlock the sentinel. No lane starts an attack during the blackout.',
    'Запам’ятайте ретранслятори перед втратою сигналу, потім оберіть момент переходу й відкрийте вартового. Під час втрати сигналу смуга не починає атаку.',
  ],
];
const patrols = [
  [
    'border-watch',
    'Border Watch',
    'Варта кордону',
    [[10, 6, 4, 5]],
    [perimeter()],
    6,
    'The patrol follows the outer circuit. Cut across the empty interior to intercept it.',
    'Патруль рухається зовнішнім колом. Перетинайте відкритий центр для перехоплення.',
  ],
  [
    'border-cutoff',
    'Border Cutoff',
    'Перехоплення на кордоні',
    [
      [7, 5, 3, 3],
      [14, 10, 3, 3],
    ],
    [perimeter(), runner()],
    8,
    'Alternate perimeter interceptions with open-field catches. Leave your outer return clear.',
    'Чергуйте перехоплення на периметрі з ловлею в полі. Залиште зовнішній обхід вільним.',
  ],
  [
    'contour-orbit',
    'Contour Orbit',
    'Контурна орбіта',
    [[9, 6, 6, 6]],
    [contour()],
    6,
    'The crawler circles the island. Wait at the next corner instead of following its heels.',
    'Повзун обходить острів. Чекайте за наступним кутом, замість бігти слідом.',
  ],
  [
    'contour-transfer',
    'Contour Transfer',
    'Контурний перехід',
    [
      [9, 6, 6, 6],
      [3, 5, 2, 3],
    ],
    [contour(), perimeter()],
    8,
    'Inner and outer circuits require different shortcuts. Both patrols yield when your cable blocks their next cell.',
    'Внутрішнє й зовнішнє кола потребують різних зрізів. Обидва патрулі чекають, якщо кабель перекриває наступну клітину.',
  ],
  [
    'wake-watch',
    'Wake Watch',
    'Пильне пробудження',
    [[10, 5, 3, 4]],
    [rover()],
    6,
    'The dormant rover warns when you approach, then follows your position. Its body is always safe to catch.',
    'Сплячий ровер попереджає про наближення, потім прямує до вас. Його завжди безпечно ловити.',
  ],
  [
    'wake-courtyard',
    'Wake Courtyard',
    'Двір пробудження',
    [
      [7, 5, 3, 5],
      [15, 8, 2, 5],
    ],
    [rover(), perimeter()],
    8,
    'Wake the rover from an open approach, then meet the outer patrol on a different return.',
    'Будіть ровер з відкритого боку, потім зустрічайте зовнішній патруль на іншому обході.',
  ],
];
const mastery = [
  [
    'ricochet-line',
    'Ricochet Line',
    'Лінія відбиття',
    [[9, 5, 2, 6]],
    [ricochet()],
    6,
    'This target reflects when blocked. Predict the return along its straight instead of chasing it.',
    'Ціль відбивається від перешкод. Передбачайте повернення вздовж прямої, замість переслідування.',
  ],
  [
    'ricochet-yard',
    'Ricochet Yard',
    'Двір відбиття',
    [
      [7, 5, 2, 5],
      [15, 9, 3, 3],
    ],
    [ricochet(), rover()],
    8,
    'Use island corners to intercept reflected routes while the rover announces its approach.',
    'Використовуйте кути островів для перехоплення, поки ровер оголошує наближення.',
  ],
  [
    'open-seam',
    'Open Seam',
    'Відкритий шов',
    [[12, 6, 2, 5]],
    [eroder(), runner()],
    4,
    'The marked wall opens after the eroder warns. No wall ever closes behind your cable.',
    'Позначена стіна відкриється після попередження руйнівника. Жодна стіна не закривається за кабелем.',
  ],
  [
    'seam-return',
    'Seam Return',
    'Обхід шва',
    [
      [12, 5, 3, 7],
      [5, 11, 3, 2],
    ],
    [eroder(), ricochet()],
    6,
    'Opening the marked edge creates a new turn pocket. Keep the permanent outer route as your fallback.',
    'Відкриття краю створює нову кишеню для повороту. Збережіть постійний зовнішній обхід.',
  ],
  [
    'guard-line',
    'Guard Line',
    'Лінія охоронця',
    [
      [10, 4, 3, 3],
      [10, 10, 3, 3],
    ],
    [guard(), guard([18, 8], 'left')],
    4,
    'The guard fixes its aim before firing. Dodge the marked next projectile cell; only your head can be hit.',
    'Охоронець фіксує приціл перед пострілом. Уникайте позначеної наступної клітини снаряда; небезпечний удар лише в голову.',
  ],
  [
    'guard-return',
    'Guard Return',
    'Обхід охоронця',
    [
      [10, 4, 4, 3],
      [8, 11, 3, 3],
    ],
    [guard(), rover(), guard([18, 8], 'left')],
    6,
    'Approach the guard from the side while its shot travels away. Catching it clears its remaining shots.',
    'Наближайтеся до охоронця збоку, поки постріл летить геть. Ловля прибирає його решту снарядів.',
  ],
  [
    'field-links',
    'Field Links',
    'Польові зв’язки',
    [
      [12, 6, 2, 5],
      [6, 5, 2, 2],
    ],
    [eroder(), jammer(), guard()],
    6,
    'Remember the marked wall and your next four turns before signal loss. New shots wait for the feed to return and a full warning.',
    'Запам’ятайте позначену стіну й наступні чотири повороти перед втратою сигналу. Нові постріли чекають відновлення прийому та повного попередження.',
  ],
  [
    'field-finale',
    'Field Finale',
    'Фінал поля',
    [
      [9, 5, 3, 2],
      [13, 11, 4, 3],
      [4, 11, 2, 2],
    ],
    [
      lane(),
      relay(
        [12, 8],
        [
          [3, 5],
          [20, 12],
        ],
      ),
      guard(),
      ricochet(),
    ],
    8,
    'Finish the circuit with clear warnings, permanent bypasses and a relay opening that stays unlocked.',
    'Завершіть коло з чіткими попередженнями, постійними обходами й незмінно відкритим ретранслятором.',
  ],
];
function entries(rows, chapter) {
  return rows.map(([slug, en, uk, rectangles, targets, goal, enBrief, ukBrief]) => {
    const id = `classic-field-${slug}`;
    return {
      id,
      chapterId: CLASSIC_SNAKE_V4_CHAPTERS[chapter].id,
      title: bilingual(en, uk),
      description: bilingual(enBrief, ukBrief),
      level: {
        version: 'classic-snake-level.v4',
        id,
        revision: '1',
        name: en,
        width: 24,
        height: 18,
        walls: wallsFor(rectangles),
        spawns: [
          { x: 5, y: 2, direction: 'right' },
          { x: 18, y: 15, direction: 'left' },
        ],
        goal,
        stepMs: 200,
        speedupEvery: 0,
        minStepMs: 200,
        wrap: false,
        targetMovement: 'still',
        fleeEvery: 3,
        objective: 'mission',
        targets: {
          maxActive: ['signal-crossing', 'relay-airfield', 'field-links', 'field-finale'].includes(
            slug,
          )
            ? 2
            : 1,
          required: targets,
          bonus: null,
        },
        shutters: [],
        pickups: [],
      },
    };
  });
}
export const CLASSIC_SNAKE_V4_INITIAL_LEVELS = freeze(entries(first, 0));
export const CLASSIC_SNAKE_V4_PATROL_LEVELS = freeze(entries(patrols, 1));
export const CLASSIC_SNAKE_V4_MASTERY_LEVELS = freeze(entries(mastery, 2));
export const CLASSIC_SNAKE_V4_LEVELS = freeze([
  ...CLASSIC_SNAKE_V4_INITIAL_LEVELS,
  ...CLASSIC_SNAKE_V4_PATROL_LEVELS,
  ...CLASSIC_SNAKE_V4_MASTERY_LEVELS,
]);
