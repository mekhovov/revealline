import { createCampaignLocalization } from '../editions/localization.mjs';
import { required } from '../data-json.mjs';
import { CURRICULUM_MISSIONS } from './curriculum.mjs';
import { CURRICULUM_SCENES_UK } from './curriculum-scene-localization.mjs';

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
const detailPhrases = {
  ...suffixes,
  'Read the field drifter before leaving safety and return to an interior island when a broad cut becomes risky.':
    'Перш ніж залишити безпечну ділянку, простежте за мандрівним ворогом у полі; поверніться до внутрішнього острова, якщо широкий зріз стає ризикованим.',
  'Watch both the field drifter and perimeter patrol; use interior returns to shorten an exposed cut.':
    'Стежте за мандрівним ворогом у полі й патрулем периметра; використовуйте внутрішні шляхи повернення, щоб скоротити незахищену лінію.',
  'A dormant backlog knot wakes only after you reclaim its whole body; leave its warning area before using the new ground.':
    'Сплячий вузол прокидається лише після захоплення всього його тіла; залиште зону попередження, перш ніж користуватися новою територією.',
  'The marked lane warns before firing; close the whole exposed line before the pulse, not only the craft.':
    'Позначена смуга попереджає перед пострілом; до імпульсу замкніть усю незахищену лінію — недостатньо лише відвести персонажа.',
  'Arrows speed travel with the flow and slow opposite travel in unclaimed field. Capture neutralizes them.':
    'У незахопленому полі стрілки прискорюють рух за потоком і сповільнюють рух проти нього. Захоплення нейтралізує їх.',
  'A completed cut reveals the picture and connects the discovery point. It never certifies real skills or changes real equipment.':
    'Замкнена лінія відкриває картину й з’єднує точку відкриття. Це не засвідчує реальних навичок і не змінює справжнього обладнання.',
  'This fictional reveal never changes a business record or a real-world delivery.':
    'Це вигадане відкриття не змінює бізнес-записів чи справжньої доставки.',
  'A capture may wake a roamer and gives an eroder more reclaimed edge.':
    'Захоплення може пробудити блукача й відкрити руйнівнику більше краю захопленої території.',
  'The captured relay opens its matching return.':
    'Захоплене реле відкриває відповідний шлях повернення.',
  'Shield capture advances the shared core encounter; only its release secures the remaining picture.':
    'Захоплення щита просуває сутичку зі спільним ядром; лише його звільнення забезпечує решту картини.',
  'Connect the discovery and finish without losing a life; the untimed explanation remains separate from arcade score.':
    'З’єднайте точку відкриття й завершіть місію без втрати життя; пояснення без таймера залишається окремим від аркадного рахунку.',
  'Connect every required objective and complete the encounter without losing a life; optional learning remains separate from arcade progress.':
    'З’єднайте всі обов’язкові цілі й завершіть сутичку без втрати життя; необов’язкове навчання залишається окремим від аркадного прогресу.',
};
function translatedDetail(canonical) {
  const parts = [];
  let remaining = canonical;
  const phrases = Object.keys(detailPhrases).sort((a, b) => b.length - a.length);
  while (remaining) {
    const phrase = phrases.find(
      (value) => remaining === value || remaining.startsWith(`${value} `),
    );
    required(phrase, 'Curriculum mission detail needs an explicit Ukrainian translation.');
    parts.push(detailPhrases[phrase]);
    remaining = remaining.slice(phrase.length).trim();
  }
  return parts.join(' ');
}
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
      required(
        CURRICULUM_SCENES_UK[row.campaignId]?.[row.ordinal - 1],
        'Curriculum scene needs an explicit Ukrainian translation.',
      );
      return [
        mission.id,
        {
          ...row.locales,
          uk: {
            ...row.locales.uk,
            brief: translatedField(mission.design.lesson, row.locales, 'brief'),
            counterplay: translatedDetail(mission.design.counterplay),
            captureConsequence: translatedDetail(mission.design.captureConsequence),
            mastery: translatedDetail(mission.design.mastery),
            memorableMoment: CURRICULUM_SCENES_UK[row.campaignId]?.[row.ordinal - 1],
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
