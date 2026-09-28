import { createCampaignLocalization } from '../editions/localization.mjs';
import { required } from '../data-json.mjs';
import { CURRICULUM_MISSIONS } from './curriculum.mjs';

const suffixes = {
  'Frontier patrols follow the changed boundary after capture; check the return edge before departing.':
    'Після захоплення патрулі рухаються вздовж зміненого кордону; перед виходом перевірте край, до якого повертатиметеся.',
  'Read the moving boundary before committing to the next connection.':
    'Перед наступним з’єднанням простежте за рухом на кордоні.',
  'Rework can erode reclaimed ground. Protect a second return and watch the dormant knot wake after capture.':
    'Повторна робота може руйнувати вже захоплену територію. Захистіть другий шлях повернення й стежте, як після захоплення прокидається сплячий вузол.',
  'Keep another return available when capture wakes a knot or rework erodes the edge.':
    'Залишайте запасний шлях повернення, коли захоплення пробуджує вузол або повторна робота руйнує край.',
  'The interceptor commits to one observed heading after its warning. Change your route after the lock and close on the nearer return.':
    'Після попередження перехоплювач обирає один помічений напрямок руху. Змініть маршрут після фіксації й замкніть лінію біля ближчого виходу.',
  'The pursuer commits to one observed point on the unfinished trail. Keep a short return ready and close before its finite approach reaches you.':
    'Переслідувач обирає одну помічену точку на незавершеній лінії. Тримайте напоготові короткий шлях повернення й замкніть лінію до його наближення.',
  'Keep a second return ready before the warning locks your trail or heading.':
    'Підготуйте другий шлях повернення до того, як попередження зафіксує вашу лінію або напрямок.',
  'Each numbered objective opens its matching connector. Closed connectors block a cut; open ones become safe returns without another fill.':
    'Кожна пронумерована ціль відкриває відповідний перехід. Закриті переходи блокують лінію; відкриті стають безпечними шляхами повернення без додаткового захоплення.',
  'Choose which numbered relay will open the most useful return connector first.':
    'Оберіть пронумероване реле, яке першим відкриє найкорисніший перехід для повернення.',
  'Plan a complete return around the lane warning before committing to the marked flow.':
    'Перш ніж увійти в позначений потік, сплануйте повний шлях повернення з урахуванням попередження про смугу.',
  'Capture every shield relay. After the vertical core attack, close eight fresh trail cells during CORE OPEN or isolate the core; release secures the remaining field.':
    'Захопіть усі реле щита. Після вертикальної атаки ядра замкніть вісім нових клітин лінії під час фази CORE OPEN або ізолюйте ядро; його звільнення забезпечить решту поля.',
  'Connect the shield relays before committing to the exposed shared core.':
    'З’єднайте реле щита, перш ніж наближатися до відкритого спільного ядра.',
  'Choose the flow direction that reaches a return before the next lane pulse.':
    'Оберіть напрямок потоку, що дозволить повернутися до наступного імпульсу смуги.',
};
function translatedField(canonical, local, field) {
  const original = local.en[field],
    translation = local.uk[field];
  required(
    canonical === original || canonical.startsWith(`${original} `),
    'Curriculum localization has stale canonical instructions.',
  );
  const suffix = canonical.slice(original.length).trim();
  required(
    !suffix || suffixes[suffix],
    'Curriculum mechanics guidance needs an explicit Ukrainian translation.',
  );
  return suffix ? `${translation} ${suffixes[suffix]}` : translation;
}

export function createCurriculumLocalization({ definition, source }) {
  const missionLocales = Object.fromEntries(
    source.missions.map((mission) => {
      const row = CURRICULUM_MISSIONS.find((item) => item.id === mission.id);
      required(row, 'Curriculum localization mission is missing.');
      return [
        mission.id,
        {
          ...row.locales,
          uk: {
            ...row.locales.uk,
            brief: translatedField(mission.design.lesson, row.locales, 'brief'),
            routeDecision: translatedField(
              mission.design.routeDecision,
              row.locales,
              'routeDecision',
            ),
          },
        },
      ];
    }),
  );
  return createCampaignLocalization({
    source,
    campaignId: definition.id,
    campaignLocales: definition.locales,
    missionLocales,
  });
}
