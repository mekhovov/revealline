import { curriculumCosmeticPayload } from './curriculum-cosmetics.mjs';
import { required } from '../data-json.mjs';
import { completionLearningReference } from '../rewards/learning.mjs';

const campaignIds = new Set(['fpv-meet-aircraft', 'ukraine-threads']);

/** Additional rewards never replace a published six-win finale or its promise. */
export function createCurriculumApplicationRewards({ definition, requirements, lessons, assets }) {
  if (!campaignIds.has(definition.id)) return [];
  const lesson = lessons.find((entry) => entry.id === `${definition.id}-06-lesson`);
  required(lesson?.campaignId === definition.id, 'Application reward needs its exact lesson.');
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
