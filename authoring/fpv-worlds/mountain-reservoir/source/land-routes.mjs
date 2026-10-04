// Four land-side route candidates over the exact accepted r4 shared geometry.
// Local route criteria deliberately have no shared source-anchor binding.
const mm = (values) =>
  Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, Math.round(values[i] * 1000)]));
function volume(type, centre, size, surface) {
  return {
    type,
    min: mm(centre.map((v, i) => v - size[i] / 2)),
    max: mm(centre.map((v, i) => v + size[i] / 2)),
    ticks: 45,
    maxSpeed: type === 'land' ? 700 : 900,
    maxTilt: 2500,
    minTilt: 0,
    centred: false,
    heading: null,
    ...(surface ? { surface } : {}),
  };
}
const hold = (point, size = [2.4, 1.4, 2.4]) => volume('hold', point, size);
const land = (point, surface, size = [3.2, 1.1, 3.2]) => volume('land', point, size, surface);
function gate(axis, at, direction, side, y, width = 2.4, height = 1.6) {
  return {
    type: 'gate',
    axis,
    at: Math.round(at * 1000),
    direction,
    minSide: Math.round((side - width / 2) * 1000),
    maxSide: Math.round((side + width / 2) * 1000),
    minY: Math.round((y - height / 2) * 1000),
    maxY: Math.round((y + height / 2) * 1000),
  };
}
const shoreLanding = () => land([-30, 0.9, 26], 'platform-shore-pad', [5, 1.1, 5]);
const commonCrest = () => [hold([-10, 5, 15]), hold([-10, 7, -12]), hold([-10, 12, -22])];

export function landRouteCandidates(base) {
  const data = [
    {
      suffix: '02',
      en: {
        title: 'Western dam crest',
        brief:
          'Climb above the solid dam before turning onto its western crest. Cross the two alignment windows, brake and land on the crest cap. This short route stays on the land-side section, not the full dam length.',
        lesson:
          'Gain clearance before moving over concrete. The dam is solid and has no tunnel; the final objective requires actual support on its crest.',
      },
      uk: {
        title: 'Західний гребінь греблі',
        brief:
          'Наберіть висоту над суцільною греблею до повороту на її західний гребінь. Пройдіть два створи, загальмуйте й сядьте на верхню плиту. Короткий маршрут охоплює лише ділянку з боку суші, а не всю греблю.',
        lesson:
          'Створіть запас висоти перед польотом над бетоном. Гребля суцільна, без тунелю; завершення потребує справжньої опори на її гребені.',
      },
      steps: {
        'self-level': [
          ...commonCrest(),
          gate('x', -4, 1, -27.9, 11.5, 2.2),
          gate('x', 1, 1, -27.9, 11.5, 2.2),
          hold([3, 11.5, -27.9], [2, 1.2, 2]),
          land([1, 10.3, -27.9], 'platform-dam-crest', [2.6, 1.1, 2.2]),
        ],
        acro: [
          ...commonCrest(),
          gate('x', -5, 1, -27.9, 11.7, 2),
          gate('x', 0, 1, -27.9, 11.7, 2),
          hold([2.8, 11.7, -27.9], [2, 1.2, 2]),
          land([1, 10.3, -27.9], 'platform-dam-crest', [2.6, 1.1, 2.2]),
        ],
      },
    },
    {
      suffix: '05',
      en: {
        title: 'Exterior service passage',
        brief:
          'Enter the real gap west of the closed maintenance hut. Hold a low line through two route windows, clear the north end, then climb before returning to the shore pad.',
        lesson:
          'Judge the roof overhang and the varying rock edge together. The painted door and windows are closed; this route uses the outside passage only.',
      },
      uk: {
        title: 'Зовнішній службовий прохід',
        brief:
          'Увійдіть у справжній проміжок на захід від закритої службової будівлі. Пройдіть два створи на малій висоті, вийдіть із північного кінця й наберіть висоту перед поверненням на береговий майданчик.',
        lesson:
          'Оцінюйте звис даху разом із нерівним краєм скелі. Намальовані двері й вікна закриті; маршрут проходить лише зовні.',
      },
      steps: {
        'self-level': [
          hold([-28.4, 2.1, 17]),
          hold([-28.4, 1.65, -7.5], [2, 1.1, 2]),
          gate('z', -12, -1, -28.4, 1.65, 2.2, 1.3),
          gate('z', -18, -1, -28.4, 1.65, 2.2, 1.3),
          hold([-28.4, 1.65, -21], [2, 1.1, 2]),
          hold([-28.4, 7, -21]),
          hold([-12, 7, -8]),
          shoreLanding(),
        ],
        acro: [
          hold([-28.3, 2.3, 17]),
          hold([-28.3, 1.8, -7.5], [2, 1.1, 2]),
          gate('z', -12.5, -1, -28.3, 1.8, 2, 1.2),
          gate('z', -18.5, -1, -28.3, 1.8, 2, 1.2),
          hold([-28.3, 1.8, -21.5], [2, 1.1, 2]),
          hold([-28.3, 7.5, -21.5]),
          gate('x', -19, 1, -8, 7.5, 3, 1.6),
          shoreLanding(),
        ],
      },
    },
    {
      suffix: '06',
      en: {
        title: 'Rock terrace climb',
        brief:
          'Climb in stages over the lower, middle and upper rock shelves. Gain height before crossing each edge, then make a controlled landing on the upper terrace.',
        lesson:
          'A clear waypoint does not guarantee a clear approach. Rise outside each edge before moving inward, and reduce power after physical touchdown.',
      },
      uk: {
        title: 'Підйом кам’яними терасами',
        brief:
          'Поетапно підніміться над нижньою, середньою й верхньою кам’яними полицями. Набирайте висоту перед кожним краєм, а потім виконайте контрольовану посадку на верхній терасі.',
        lesson:
          'Вільна цільова точка не гарантує вільного підльоту. Піднімайтеся зовні кожного краю до руху вглиб і зменшуйте тягу після справжнього контакту.',
      },
      steps: {
        'self-level': [
          hold([-35, 4.4, 16]),
          hold([-35, 4.5, 7]),
          hold([-39, 7.2, 4]),
          hold([-39, 10.2, 4]),
          hold([-41, 10.2, -9]),
          land([-41, 8.95, -10], 'rock-west-upper', [2.4, 1.1, 2.4]),
        ],
        acro: [
          hold([-35, 4.6, 16]),
          gate('z', 10, -1, -35, 4.6, 3),
          hold([-35, 4.6, 7]),
          gate('z', 4, -1, -39, 7.3, 3),
          hold([-39, 10.3, 3.5]),
          gate('z', -7, -1, -41, 10.3, 2.6),
          land([-41, 8.95, -10], 'rock-west-upper', [2.4, 1.1, 2.4]),
        ],
      },
    },
    {
      suffix: '08',
      en: {
        title: 'Maintenance roof landing',
        brief:
          'Approach the closed hut from the eastern shore, pass the offset route window and stabilize over its roof. Descend onto the solid roof and reduce power after contact.',
        lesson:
          'Separate sideways alignment from descent. The roof is the landing surface; the door and windows are paint, not openings.',
      },
      uk: {
        title: 'Посадка на дах службової будівлі',
        brief:
          'Підійдіть до закритої будівлі зі східного берега, пройдіть зміщений створ і стабілізуйтеся над дахом. Опустіться на твердий дах і зменште тягу після контакту.',
        lesson:
          'Виконуйте бокове вирівнювання окремо від зниження. Сідайте на дах; двері й вікна намальовані та не є отворами.',
      },
      steps: {
        'self-level': [
          hold([-12, 6.2, 8]),
          gate('z', -7, -1, -12, 6.2, 3),
          hold([-12, 6.2, -15]),
          hold([-22, 6.4, -15]),
          land([-22, 4.9, -15], 'building-maintenance-roof', [3.2, 1.1, 3.2]),
        ],
        acro: [
          hold([-10, 6.5, 9]),
          gate('z', -6, -1, -10, 6.5, 2.8),
          hold([-12, 6.5, -15]),
          gate('x', -18, -1, -15, 6.5, 2.8),
          land([-22, 4.9, -15], 'building-maintenance-roof', [3.2, 1.1, 3.2]),
        ],
      },
    },
  ];
  return data.map(({ suffix, en, uk, steps }) => ({
    ...structuredClone(base),
    id: 'mountain-reservoir-' + suffix,
    // splitCourseDefinition uses the course revision for its shared World too.
    // Retain r4 geometry identity; the new five-course pack has project r5-land.
    revision: base.revision,
    locales: { en, uk },
    steps,
  }));
}

// Survey lines are conservative authoring seeds, not recorded flight paths.
// Grounded starts/landings are qualified separately from airborne extra margin.
export const landRouteSurveys = {
  'mountain-reservoir-02': [
    [-30, 2.7, 26],
    [-10, 5, 15],
    [-10, 7, -12],
    [-10, 12, -22],
    [-7, 11.7, -27.9],
    [3, 11.7, -27.9],
    [1, 11.7, -27.9],
  ],
  'mountain-reservoir-05': [
    [-30, 2.7, 26],
    [-28.4, 2.1, 17],
    [-28.4, 1.65, -7.5],
    [-28.4, 1.65, -21],
    [-28.4, 7.5, -21],
    [-12, 7.5, -8],
    [-30, 7.5, 26],
  ],
  'mountain-reservoir-06': [
    [-30, 2.7, 26],
    [-35, 4.4, 16],
    [-35, 4.5, 7],
    [-39, 7.2, 4],
    [-39, 10.3, 4],
    [-41, 10.3, -9],
    [-41, 10.3, -10],
  ],
  'mountain-reservoir-08': [
    [-30, 2.7, 26],
    [-12, 6.5, 8],
    [-12, 6.5, -15],
    [-22, 6.5, -15],
  ],
};
