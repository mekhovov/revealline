import { CURRICULUM_MISSIONS, CURRICULUM_SOURCES } from './curriculum.mjs';
import { validateExplorationPayload } from '../rewards/exploration.mjs';

const bilingual = (en, uk) => ({ en, uk });
const choice = (id, enLabel, ukLabel, enFeedback, ukFeedback) => ({
  id,
  locales: bilingual(
    { label: enLabel, feedback: enFeedback },
    { label: ukLabel, feedback: ukFeedback },
  ),
});
const card = (missionId, id, titles, notes) => {
  const mission = CURRICULUM_MISSIONS.find((entry) => entry.id === missionId);
  return {
    id,
    sourceIds: [...mission.refs],
    locales: Object.fromEntries(
      ['en', 'uk'].map((locale, index) => [
        locale,
        {
          title: titles[index],
          body: mission.locales[locale].paragraphs.join('\n\n'),
          sourceNote: notes[index],
        },
      ]),
    ),
  };
};
const recipe = (cards, predictions) => ({
  id: 'inspect-compare-atlas',
  revision: 1,
  cards,
  predictions,
  sources: [...new Set(cards.flatMap((entry) => entry.sourceIds))].map((id) => ({
    id,
    ...CURRICULUM_SOURCES[id],
  })),
});

function aircraftAtlas() {
  const notes = [
    'Simplified civilian role comparison. The source links describe concepts; this exhibit supplies no live wiring or configuration procedure.',
    'Спрощене порівняння ролей цивільної моделі. Джерела пояснюють поняття; виставка не містить підключення живлення чи процедур налаштування.',
  ];
  const cards = [
    ['frame', 'The supporting frame', 'Опорна рама'],
    ['motion', 'Motor and propeller', 'Двигун і пропелер'],
    ['esc', 'The electronic speed controller', 'Електронний регулятор швидкості'],
    ['controller', 'The flight controller', 'Польотний контролер'],
    ['links', 'Control and video links', 'Канали керування та відео'],
    ['energy', 'The battery and the whole model', 'Акумулятор і ціла модель'],
  ].map(([id, en, uk], index) => card(`fpv-meet-aircraft-0${index + 1}`, id, [en, uk], notes));
  return {
    id: 'fpv-meet-aircraft-interactive-atlas',
    type: 'exploration',
    locales: bilingual(
      {
        title: 'Inspect the aircraft atlas',
        intro:
          'Compare any two of your six discoveries, then try two untimed predictions about a fictional civilian classroom diagram. You can revise an answer or leave at any time; exploration does not change arcade progress or certify a practical skill.',
      },
      {
        title: 'Дослідіть атлас дрона',
        intro:
          'Порівняйте будь-які два з шести відкриттів, а потім спробуйте два прогнози без таймера для вигаданої цивільної навчальної схеми. Відповідь можна змінити, а перегляд — закрити; дослідження не змінює аркадного прогресу й не засвідчує практичних навичок.',
      },
    ),
    recipe: recipe(cards, [
      {
        id: 'information-and-energy',
        cardIds: ['controller', 'esc', 'energy'],
        expectedChoiceId: 'controller',
        locales: bilingual(
          {
            prompt:
              'A new classroom diagram needs a box labelled “use sensor readings and requested movement to calculate motor commands”. Which role belongs there?',
            explanation:
              'The flight controller calculates commands. The ESC acts on motor commands, while the battery supplies energy. These conceptual roles remain different even when real products combine parts.',
          },
          {
            prompt:
              'У новій навчальній схемі потрібен блок «використати покази датчиків і запитаний рух для обчислення команд двигунам». Яка роль йому відповідає?',
            explanation:
              'Польотний контролер обчислює команди. ESC виконує команди для двигуна, а акумулятор надає енергію. Ці ролі різні, навіть якщо реальний виріб поєднує компоненти.',
          },
        ),
        choices: [
          choice(
            'controller',
            'Flight controller',
            'Польотний контролер',
            'Yes. This box combines information to calculate commands; it is not the energy source.',
            'Так. Цей блок поєднує інформацію для обчислення команд, а не є джерелом енергії.',
          ),
          choice(
            'battery',
            'Battery',
            'Акумулятор',
            'The battery supplies energy. Compare its card with the controller card to find the information-processing role.',
            'Акумулятор надає енергію. Порівняйте його картку з контролером, щоб знайти роль опрацювання інформації.',
          ),
          choice(
            'esc',
            'ESC',
            'ESC',
            'The ESC receives motor commands. The requested box is the earlier step that calculates those commands.',
            'ESC отримує команди двигуна. Потрібний блок — попередній крок, що обчислює ці команди.',
          ),
        ],
      },
      {
        id: 'place-the-operator-input',
        cardIds: ['links', 'controller'],
        expectedChoiceId: 'control-branch',
        locales: bilingual(
          {
            prompt:
              'The diagram already has a camera → video-transmitter branch. Where should a separate arrow labelled “operator’s movement request” arrive?',
            explanation:
              'The request belongs to the control-information branch through the receiver. An image of the scene and an operator’s command are different information; this diagram does not test a real radio system.',
          },
          {
            prompt:
              'Схема вже має гілку «камера → відеопередавач». До якої гілки має надходити окрема стрілка «запит оператора на рух»?',
            explanation:
              'Запит належить до гілки інформації керування через приймач. Зображення сцени й команда оператора — різна інформація; схема не перевіряє реальну радіосистему.',
          },
        ),
        choices: [
          choice(
            'control-branch',
            'Control receiver branch',
            'Гілка приймача керування',
            'Yes. The receiver’s role concerns control information; keep it distinct from the camera/VTX branch.',
            'Так. Роль приймача стосується інформації керування; відокремлюйте її від гілки камери/VTX.',
          ),
          choice(
            'video-branch',
            'Camera/video branch',
            'Гілка камери та відео',
            'That branch carries the view of the scene. Inspect the two-links card again to separate a movement request from a picture.',
            'Ця гілка передає зображення сцени. Знову розгляньте картку двох каналів, щоб відокремити запит руху від картинки.',
          ),
        ],
      },
    ]),
  };
}

function textileAtlas() {
  const notes = [
    'This record describes one particular object. Follow the attached museum source for its full catalogue context and keep documented uncertainty visible.',
    'Цей запис описує конкретний предмет. Перейдіть до музейного джерела для повного контексту каталогу та збережіть документовану невизначеність.',
  ];
  const cards = [
    card(
      'ukraine-threads-01',
      'poltava-shirt',
      ['Shirt НДФ-6482: an unknown maker', 'Сорочка НДФ-6482: невідомий автор'],
      notes,
    ),
    card(
      'ukraine-threads-04',
      'volyn-shirt',
      ['Shirt НДФ-7132: a named maker', 'Сорочка НДФ-7132: відома майстриня'],
      notes,
    ),
    card(
      'ukraine-threads-05',
      'rushnyk-record',
      ['Rushnyk КН-3081: two different dates', 'Рушник КН-3081: дві різні дати'],
      notes,
    ),
  ];
  return {
    id: 'ukraine-threads-source-atlas',
    type: 'exploration',
    locales: bilingual(
      {
        title: 'Curate three documented objects',
        intro:
          'Compare the records and choose evidence-backed labels for a small exhibition. Try the optional, untimed questions about sources and uncertainty, and change an answer whenever a detail catches your attention.',
      },
      {
        title: 'Упорядкуйте три документовані предмети',
        intro:
          'Порівняйте записи та оберіть обґрунтовані підписи для малої виставки. Спробуйте необов’язкові запитання без таймера про джерела й невизначеність та змінюйте відповідь, коли помітите нову деталь.',
      },
    ),
    recipe: recipe(cards, [
      {
        id: 'name-what-is-known',
        cardIds: ['poltava-shirt', 'volyn-shirt'],
        expectedChoiceId: 'specific-records',
        locales: bilingual(
          {
            prompt: 'Which label preserves what these two shirt records actually establish?',
            explanation:
              'The records concern two specific garments. One names Anastasiia Kravchuk; the other records an unknown maker. Neither record supports a universal regional rule.',
          },
          {
            prompt: 'Який підпис зберігає те, що справді встановлюють записи двох сорочок?',
            explanation:
              'Записи стосуються двох конкретних речей. Один називає Анастасію Кравчук, а в іншому автор невідомий. Жоден не доводить універсального правила для регіону.',
          },
        ),
        choices: [
          choice(
            'specific-records',
            'Name the known maker; retain “unknown” for the other object',
            'Назвати відому майстриню; для іншої речі зберегти «невідомо»',
            'That keeps each claim attached to its own record without inventing a maker.',
            'Так кожне твердження пов’язане зі своїм записом без вигадування автора.',
          ),
          choice(
            'regional-rule',
            'Use the two makers as a rule for all regional garments',
            'Вважати двох авторів правилом для всього одягу регіонів',
            'Two records cannot establish that general rule. Compare the specific dates, places and maker fields instead.',
            'Два записи не встановлюють такого правила. Натомість порівняйте конкретні дати, місця й відомості про авторів.',
          ),
        ],
      },
      {
        id: 'separate-creation-and-donation',
        cardIds: ['rushnyk-record'],
        expectedChoiceId: 'donation',
        locales: bilingual(
          {
            prompt:
              'The rushnyk record includes 2001. Which event should your exhibition timeline attach to that date?',
            explanation:
              '2001 records Petro Honchar’s donation. The object is dated to the first half of the nineteenth century; its making date and later collection history are separate.',
          },
          {
            prompt:
              'Запис рушника містить 2001 рік. Яку подію слід пов’язати з цією датою на шкалі виставки?',
            explanation:
              '2001 рік стосується дарунка Петра Гончара. Сам предмет датовано першою половиною XIX століття; виготовлення й пізніша історія колекції — різні події.',
          },
        ),
        choices: [
          choice(
            'donation',
            'The recorded donation',
            'Зафіксоване дарування',
            'Yes. Keep the donation date beside the donor and the earlier creation period beside the object.',
            'Так. Залиште дату дарування поряд з ім’ям дарувальника, а давніший період створення — поряд із предметом.',
          ),
          choice(
            'creation',
            'The creation of the rushnyk',
            'Створення рушника',
            'That would replace the earlier object date with a later event. Inspect the record again and keep both events.',
            'Це замінило б давнішу дату предмета пізнішою подією. Перегляньте запис і збережіть обидві події.',
          ),
        ],
      },
    ]),
  };
}

export function createCurriculumAtlasPayloads(campaignId) {
  const payload =
    campaignId === 'fpv-meet-aircraft'
      ? aircraftAtlas()
      : campaignId === 'ukraine-threads'
        ? textileAtlas()
        : null;
  return payload ? [validateExplorationPayload(payload)] : [];
}
