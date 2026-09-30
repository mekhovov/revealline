import { curriculumCosmeticPayload } from './curriculum-cosmetics.mjs';
import { required } from '../data-json.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';

const communityCampaigns = new Set([
  'social-drone-community-connections',
  'victory-drones-ideas-understanding',
]);
const campaignIds = new Set(['fpv-meet-aircraft', 'ukraine-threads', ...communityCampaigns]);

/** Additional rewards never replace a published six-win finale or its promise. */
export function createCurriculumApplicationRewards({ definition, requirements, lessons, assets }) {
  if (!campaignIds.has(definition.id)) return [];
  const lesson = lessons.find((entry) => entry.id === `${definition.id}-06-lesson`);
  required(lesson?.campaignId === definition.id, 'Application reward needs its exact lesson.');
  if (communityCampaigns.has(definition.id))
    return [createCommunityApplicationReward(definition, requirements, lesson)];
  const aircraft = definition.id === 'fpv-meet-aircraft';
  const locales = aircraft
    ? {
        en: {
          title: 'Aircraft atlas: annotated edition',
          teaser:
            'Optional: complete the six discoveries and repair the exhibit labels to earn a source-linked annotation card.',
          paragraphs: [
            'Your fictional exhibit now separates pilot control, video and motor commands. RX carries control information toward the flight controller; camera/VTX serves the video path; ESC receives motor commands and regulates motor power. Several functions can share a real device, so these are roles rather than a universal wiring layout.',
            'Carry the distinction into another exhibit: a visitor can see a camera view but has no control transmitter. Seeing the view alone does not issue a pilot command. Explain which information path the visitor is using before inferring any ability to control the aircraft.',
            'This annotation records the verified label exercise, not real-world assembly or flight competence. Revisit the complete aircraft atlas beside it in Collection.',
          ],
        },
        uk: {
          title: 'Атлас апарата: видання з примітками',
          teaser:
            'Додатково: завершіть шість відкриттів і виправте підписи експозиції, щоб отримати картку приміток із джерелами.',
          paragraphs: [
            'Ваша вигадана експозиція тепер розрізняє керування пілота, відео й команди двигуна. RX передає інформацію керування до польотного контролера; камера/VTX обслуговує відеошлях; ESC отримує команди двигуна й регулює його живлення. Реальний пристрій може поєднувати кілька функцій: це ролі, а не універсальна схема підключення.',
            'Перенесіть це розрізнення в іншу експозицію: відвідувач бачить зображення камери, але не має передавача керування. Сам перегляд не надсилає команду пілота. Поясніть, яким інформаційним шляхом користується відвідувач, перш ніж робити висновок про можливість керувати апаратом.',
            'Ця примітка фіксує перевірену вправу з підписами, а не навички реального складання чи польоту. Поверніться до повного атласу апарата поруч у Колекції.',
          ],
        },
      }
    : {
        en: {
          title: 'Textile atlas: curator annotations',
          teaser:
            'Optional: complete the six discoveries and curate the evidence labels to earn an annotated source card.',
          paragraphs: [
            'A museum record and an original illustration support different claims. A dated artwork can tell us about that particular work and its interpretation. A fictional festival scene can invite curiosity but cannot document a real historic garment.',
            'For a new object label, separate what the record states from what you infer. Keep the maker, medium, date and place tied to the specific source; write “not established by this source” when a detail is missing.',
            'These annotations recognise the verified evidence exercise. They do not score cultural identity or belonging. Return to the textile atlas in Collection to compare the individually attributed sources.',
          ],
        },
        uk: {
          title: 'Текстильний атлас: примітки куратора',
          teaser:
            'Додатково: завершіть шість відкриттів і впорядкуйте підписи доказів, щоб отримати картку джерел із примітками.',
          paragraphs: [
            'Музейний запис і оригінальна ілюстрація підтверджують різні твердження. Датований твір розповідає про конкретну роботу та її інтерпретацію. Вигадана фестивальна сцена може зацікавити, але не документує реальний історичний одяг.',
            'Для нового підпису предмета відокремлюйте дані запису від власних висновків. Пов’язуйте автора, матеріал, дату й місце з конкретним джерелом; якщо відомостей бракує, зазначайте: «Це джерело не встановлює цієї деталі».',
            'Ці примітки відзначають перевірену вправу з доказами. Вони не оцінюють культурну ідентичність чи належність. Поверніться до текстильного атласу в Колекції, щоб порівняти джерела з окремими атрибуціями.',
          ],
        },
      };
  return [
    {
      format: 'revealline-completion-reward.v1',
      id: `${definition.id}-application-discovery`,
      revision: '1',
      brandId: definition.brandId,
      campaignId: definition.id,
      scope: { kind: 'campaign', id: definition.id },
      locales: Object.fromEntries(
        Object.entries(locales).map(([key, value]) => [
          key,
          {
            title: value.title,
            teaser: value.teaser,
          },
        ]),
      ),
      requirements: {
        missions: structuredClone(requirements),
        learning: [completionLearningReference(lesson)],
        mastery: [],
      },
      payloads: [
        curriculumCosmeticPayload(definition.id, assets),
        {
          id: `${definition.id}-application-annotations`,
          type: 'knowledge',
          locales: Object.fromEntries(
            Object.entries(locales).map(([key, value]) => [
              key,
              {
                title: value.title,
                paragraphs: value.paragraphs,
                sources: structuredClone(lesson.sources),
              },
            ]),
          ),
        },
      ],
    },
  ];
}

function createCommunityApplicationReward(definition, requirements, lesson) {
  const community = definition.id === 'social-drone-community-connections';
  const locales = community
    ? {
        en: {
          title: 'The community board: checked edition',
          teaser:
            'Optional: win the six missions and publish an evidence-backed notice to collect the completed board and its handoff notes.',
          paragraphs: [
            'Your fictional board reports 10 booklets available and 2 not yet received. It replaces the old claim of 12 available. Marta has accepted the next check; no delivery date is invented.',
            'Use the same method with a new shared record: separate what was observed, what remains uncertain and who accepted the next action. A useful correction belongs where people encounter the old claim.',
          ],
        },
        uk: {
          title: 'Дошка спільноти: перевірене видання',
          teaser:
            'Додатково: виграйте шість місій і оприлюдніть підтверджене доказами оголошення, щоб отримати готову дошку й нотатки передачі справ.',
          paragraphs: [
            'Ваша вигадана дошка повідомляє про 10 наявних буклетів і 2 ще не отримані. Вона замінює старе твердження про 12 наявних. Марта погодилася на наступну перевірку; дату доставки не вигадано.',
            'Застосуйте той самий підхід до нового спільного запису: розділіть спостережене, невідоме й узгоджену наступну дію. Корисне виправлення має бути там, де люди бачать старе твердження.',
          ],
        },
      }
    : {
        en: {
          title: 'The comparison notebook',
          teaser:
            'Optional: win the six missions and choose a fair comparison to earn the completed notebook and its evidence limits.',
          paragraphs: [
            'Your classroom notebook keeps the cart and release conditions fixed while comparing two mats. The invented observations are 80–82 cm on A and 49–51 cm on B; the conclusion remains limited to that cart and those trials.',
            'For another investigation, identify the intended change, keep relevant conditions comparable, record repeated observations and state what was not tested. An attractive explanation does not replace that evidence.',
          ],
        },
        uk: {
          title: 'Зошит порівняння',
          teaser:
            'Додатково: виграйте шість місій і оберіть коректне порівняння, щоб отримати готовий зошит із межами доказів.',
          paragraphs: [
            'Ваш навчальний зошит зберігає візок і умови запуску сталими та порівнює два килимки. Вигадані спостереження: 80–82 см на A і 49–51 см на B; висновок стосується лише цього візка й цих дослідів.',
            'Для іншого дослідження визначте заплановану зміну, зберігайте суттєві умови порівнюваними, записуйте повторні спостереження й зазначайте, чого не перевіряли. Привабливе пояснення не замінює цих доказів.',
          ],
        },
      };
  return {
    format: 'revealline-completion-reward.v1',
    id: `${definition.id}-application-discovery`,
    revision: '1',
    brandId: definition.brandId,
    campaignId: definition.id,
    scope: { kind: 'campaign', id: definition.id },
    locales: Object.fromEntries(
      Object.entries(locales).map(([locale, copy]) => [
        locale,
        { title: copy.title, teaser: copy.teaser },
      ]),
    ),
    requirements: {
      missions: structuredClone(requirements),
      learning: [completionLearningReference(lesson)],
      mastery: [],
    },
    payloads: [
      {
        id: `${definition.id}-application-notebook`,
        type: 'knowledge',
        locales: Object.fromEntries(
          Object.entries(locales).map(([locale, copy]) => [
            locale,
            {
              title: copy.title,
              paragraphs: copy.paragraphs,
              sources: structuredClone(lesson.sources),
            },
          ]),
        ),
      },
    ],
  };
}
