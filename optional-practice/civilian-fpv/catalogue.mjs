import { validateFlightCourse } from './model.mjs';
const hold = (
  x,
  y,
  z,
  {
    size = 1100,
    ticks = 40,
    maxSpeed = 2200,
    maxTilt = 4500,
    minTilt = 0,
    centred = false,
    heading = null,
  } = {},
) => ({
  type: 'hold',
  min: { x: x - size, y: Math.max(0, y - 600), z: z - size },
  max: { x: x + size, y: y + 600, z: z + size },
  ticks,
  maxSpeed,
  maxTilt,
  minTilt,
  centred,
  heading,
});
const land = (x, z) => ({
  ...hold(x, 0, z, { size: 1400, ticks: 20, maxSpeed: 1100, maxTilt: 2000 }),
  type: 'land',
});
const gate = (axis, at, side, direction, y = 2200) => ({
  type: 'gate',
  axis,
  at,
  direction,
  minSide: side - 1800,
  maxSide: side + 1800,
  minY: y - 1400,
  maxY: y + 1400,
});
const titles = [
  [
    'Lift and land',
    'Підйом і посадка',
    'Use manual throttle to climb into the volume, settle, then return gently to the launch pad.',
    'Підніміться газом у заданий об’єм, стабілізуйте висоту та м’яко сядьте на стартовий майданчик.',
    'Throttle changes upward force. Self-level does not hold altitude; Acro does not level the aircraft.',
    'Газ змінює підйомну силу. Самовирівнювання не тримає висоту; Acro не вирівнює апарат.',
  ],
  [
    'Hold a volume',
    'Утримання в об’ємі',
    'Stay inside the volume for three consecutive seconds, then land. Small corrections help.',
    'Залишайтесь усередині об’єму три секунди поспіль, потім сядьте. Допомагають невеликі корекції.',
    'A position is held by balancing forces and correcting drift, not by centring the sticks alone.',
    'Положення утримують балансом сил і корекцією дрейфу, а не лише центруванням стіків.',
  ],
  [
    'Forward and brake',
    'Уперед і гальмування',
    'Build forward motion, then counter the drift to settle in the far volume and land.',
    'Наберіть швидкість уперед, потім погасіть дрейф, зупиніться в дальньому об’ємі та сядьте.',
    'Tilting produces horizontal acceleration. Opposite tilt brakes motion; a neutral stick does not instantly stop it.',
    'Нахил створює горизонтальне прискорення. Протилежний нахил гальмує; нейтральний стік не зупиняє миттєво.',
  ],
  [
    'Sideways and brake',
    'Убік і гальмування',
    'Move right while keeping your heading, brake into the volume, then land.',
    'Рухайтесь праворуч, зберігаючи курс, загальмуйте в об’ємі та сядьте.',
    'Roll changes sideways acceleration. The aircraft can travel sideways without turning its nose.',
    'Крен змінює бічне прискорення. Апарат може рухатися боком без повороту носа.',
  ],
  [
    'Turn and travel',
    'Поворот і рух',
    'Turn right toward the field marker, pass its gate, settle and land.',
    'Поверніть праворуч до орієнтира поля, пройдіть ворота, зупиніться та сядьте.',
    'Yaw changes heading. Existing velocity persists while the nose turns.',
    'Рискання змінює курс. Попередня швидкість зберігається під час повороту носа.',
  ],
  [
    'Fly a square',
    'Політ квадратом',
    'Visit each corner in order. Control height and braking before the next leg.',
    'Відвідайте кути по черзі. Контролюйте висоту та гальмування перед наступним відрізком.',
    'Heading, tilt and existing momentum combine to produce the path.',
    'Курс, нахил і наявний імпульс разом визначають траєкторію.',
  ],
  [
    'Tilt, centre and drift',
    'Нахил, центр і дрейф',
    'Tilt briefly, then centre pitch and roll. Observe the mode-specific response before landing.',
    'Коротко нахиліть апарат і відцентруйте тангаж та крен. Спостерігайте реакцію режиму, потім сядьте.',
    'Self-level returns toward level; Acro retains tilt. Neither mode cancels translation when the sticks centre.',
    'Самовирівнювання повертає до горизонту; Acro зберігає нахил. Жоден режим не скасовує поступальний рух центруванням.',
  ],
  [
    'Approach a gate',
    'Підхід до воріт',
    'Cross the opening from the marked approach side, brake and land beyond it.',
    'Пройдіть отвір з позначеного боку підходу, загальмуйте та сядьте за ним.',
    'A gate is an opening and a direction. Passing behind it or touching its edge is not a valid crossing.',
    'Ворота мають отвір і напрямок. Політ з іншого боку чи дотик до краю не є правильним проходженням.',
  ],
  [
    'Linked turns',
    'Поєднані повороти',
    'Connect two perpendicular gate approaches with a controlled turn.',
    'Поєднайте два перпендикулярні підходи до воріт контрольованим поворотом.',
    'Start changing the force direction before momentum carries you beyond the turn.',
    'Починайте змінювати напрямок сили до того, як імпульс винесе за поворот.',
  ],
  [
    'Slalom',
    'Слалом',
    'Alternate your lateral path through three ordered openings at a steady height.',
    'Змінюйте бічну траєкторію через три послідовні отвори, зберігаючи висоту.',
    'Look toward the next opening while keeping the current approach controlled.',
    'Дивіться на наступний отвір, контролюючи поточний підхід.',
  ],
  [
    'Figure eight',
    'Вісімка',
    'Follow the ordered gates around both lobes and return to the centre to land.',
    'Пройдіть ворота обох петель по черзі та поверніться в центр для посадки.',
    'Repeated changes of turn direction combine yaw, roll, pitch and throttle.',
    'Повторні зміни напрямку повороту поєднують рискання, крен, тангаж і газ.',
  ],
  [
    'Final circuit',
    'Підсумкове коло',
    'Combine height changes, turns, directional gates and a controlled landing.',
    'Поєднайте зміну висоти, повороти, спрямовані ворота та контрольовану посадку.',
    'A complete attempt coordinates acceleration, braking, heading and altitude. This fictional model is not a qualification for real aircraft.',
    'Повна спроба поєднує прискорення, гальмування, курс і висоту. Ця вигадана модель не засвідчує готовності керувати реальним апаратом.',
  ],
];
const patterns = [
  [hold(0, 1800, 0), land(0, 0)],
  [hold(0, 2200, 0, { ticks: 150, maxSpeed: 1000 }), land(0, 0)],
  [
    hold(0, 1800, 0),
    gate('z', -4000, 0, -1),
    hold(0, 1800, -6500, { maxSpeed: 900 }),
    land(0, -6500),
  ],
  [
    hold(0, 1800, 0),
    gate('x', 4000, 0, 1),
    hold(6500, 1800, 0, { maxSpeed: 900, heading: 0 }),
    land(6500, 0),
  ],
  [
    hold(0, 1800, 0, { heading: 9000 }),
    gate('x', 5000, 0, 1),
    hold(7500, 1800, 0, { heading: 9000 }),
    land(7500, 0),
  ],
  [
    hold(0, 2200, 0),
    gate('z', -6000, 0, -1),
    gate('x', 6000, -6000, 1),
    gate('z', 0, 6000, 1),
    gate('x', 0, 0, -1),
    land(0, 0),
  ],
  [
    hold(0, 2200, 0),
    hold(0, 2200, -2000, { size: 5000, ticks: 10, minTilt: 1000, maxTilt: 3500, maxSpeed: 7000 }),
    hold(0, 2200, -4000, { size: 10000, ticks: 10, centred: true, maxTilt: 1000, maxSpeed: 15000 }),
    land(0, -7000),
  ],
  [
    hold(0, 2200, 0),
    gate('z', -6000, 0, -1),
    hold(0, 2000, -9000, { maxSpeed: 1200 }),
    land(0, -9000),
  ],
  [
    hold(0, 2200, 0),
    gate('z', -6000, 0, -1),
    gate('x', 7000, -8000, 1),
    hold(9500, 2200, -8000),
    land(9500, -8000),
  ],
  [
    hold(0, 2200, 0),
    gate('z', -4000, -2500, -1),
    gate('z', -9000, 2500, -1),
    gate('z', -14000, -2500, -1),
    land(-2500, -16000),
  ],
  [
    hold(0, 2200, 0),
    gate('z', -6000, -5000, -1),
    gate('x', 0, -10000, 1),
    gate('z', -6000, 5000, 1),
    gate('z', 6000, -5000, 1),
    gate('x', 0, 10000, 1),
    gate('z', 6000, 5000, -1),
    land(0, 0),
  ],
  [
    hold(0, 2200, 0),
    gate('z', -6000, 0, -1, 2200),
    gate('x', 8000, -9000, 1, 4500),
    gate('z', 0, 10000, 1, 3000),
    gate('x', 0, 4000, -1, 1800),
    hold(0, 1600, 0, { maxSpeed: 1000 }),
    land(0, 0),
  ],
];
export const FLIGHT_COURSES = Object.freeze(
  titles.map((copy, index) => {
    const steps = structuredClone(patterns[index]),
      acro = structuredClone(steps);
    if (index === 6) {
      acro[2].minTilt = 1000;
      acro[2].maxTilt = 4000;
    }
    return Object.freeze(
      validateFlightCourse({
        format: 'FlightCourse.v1',
        id: `flight-${String(index + 1).padStart(2, '0')}`,
        revision: 'r1',
        environment: index < 4 ? 'gym' : 'field',
        locales: {
          en: { title: copy[0], brief: copy[2], lesson: copy[4] },
          uk: { title: copy[1], brief: copy[3], lesson: copy[5] },
        },
        spawn: { x: 0, y: 0, z: 0 },
        bounds: { min: { x: -22000, y: 0, z: -22000 }, max: { x: 22000, y: 10000, z: 22000 } },
        obstacles: [],
        steps: { 'self-level': steps, acro },
      }),
    );
  }),
);
export const FLIGHT_CAMPAIGN = Object.freeze({
  id: 'civilian-flight-learning',
  revision: 'r1',
  drills: FLIGHT_COURSES.map((course) => course.id),
  modes: ['self-level', 'acro'],
});
