import { freezeDesign } from '../content-design/catalogs.mjs';
import { CURRICULUM_SHOWCASE_LESSONS } from './curriculum-showcase-lessons.mjs';

/** Fictional untimed application fixtures; no live company systems or physical controls. */
export const CURRICULUM_LESSONS = freezeDesign([
  ...CURRICULUM_SHOWCASE_LESSONS,
  {
    format: 'revealline-learning-lesson.v1',
    id: 'fpv-meet-aircraft-06-lesson',
    revision: '1',
    fixtureRevision: '1',
    missionId: 'fpv-meet-aircraft-06',
    campaignId: 'fpv-meet-aircraft',
    kind: 'practice',
    title: 'Repair the exhibit labels',
    role: 'Workshop curator',
    brief:
      'A museum has mixed up three labels on its fictional civilian aircraft exhibit. Inspect the visitor observations and component roles, then choose the label for each information path.',
    notice:
      'An offline conceptual model. No aircraft, wiring, radio setup or flight certification. Correct labels explain roles; they do not prove that a real aircraft is safe.',
    sourceReviewedAt: '2026-09-28',
    sources: [
      {
        title: 'Betaflight — About the flight controller',
        url: 'https://betaflight.com/docs/wiki/getting-started',
      },
      {
        title: 'Betaflight — ESC firmware',
        url: 'https://betaflight.com/docs/wiki/getting-started/hardware/esc-firmware',
      },
      {
        title: 'Betaflight — Video transmitters',
        url: 'https://betaflight.com/docs/wiki/getting-started/hardware/vtx',
      },
    ],
    records: [
      {
        id: 'observations',
        title: 'Visitor observations',
        lines: [
          'Station A traces a pilot control message toward the flight controller. It carries a requested action, not a camera image.',
          'Station B traces a camera view toward the viewing system. Two visitors see the same view; neither display is issuing a pilot command in this fixture.',
          'Station C traces a computed motor command leaving the flight controller toward the component that regulates motor power.',
        ],
      },
      {
        id: 'roles',
        title: 'Component role cards',
        lines: [
          'RX is the control-link receiver in this simplified model. The camera and VTX provide the separate video path.',
          'The flight controller uses control inputs and sensor information to calculate commands. The ESC receives motor commands and regulates electrical power to the motor.',
          'These are functional roles. Actual products can integrate several roles in one unit; the exhibit is not a universal wiring diagram.',
        ],
      },
    ],
    fields: [
      {
        id: 'control',
        label: 'Station A label',
        expected: 'rx',
        explanation:
          'A camera view cannot stand in for the requested pilot action. Station A follows the RX control path toward the flight controller.',
        options: [
          {
            value: 'rx',
            label: 'RX · control information',
          },
          {
            value: 'video',
            label: 'Camera/VTX · video information',
          },
        ],
      },
      {
        id: 'view',
        label: 'Station B label',
        expected: 'video',
        explanation:
          'The two viewers receive the camera view in this fixture. Use the camera/VTX label; seeing an image does not itself send a pilot command.',
        options: [
          {
            value: 'rx',
            label: 'RX · control information',
          },
          {
            value: 'video',
            label: 'Camera/VTX · video information',
          },
        ],
      },
      {
        id: 'motor',
        label: 'Station C destination',
        expected: 'esc',
        explanation:
          'The flight controller has already calculated the motor command. The ESC uses it to regulate motor power; the VTX serves the video path.',
        options: [
          {
            value: 'vtx',
            label: 'VTX · video transmission',
          },
          {
            value: 'esc',
            label: 'ESC · motor power control',
          },
        ],
      },
    ],
    success:
      'The exhibit now separates pilot control, video and motor commands. The labels explain the fictional observations without treating a screen image as a control message.',
    locales: {
      uk: {
        title: 'Виправте підписи експозиції',
        role: 'Куратор майстерні',
        brief:
          'У музеї переплутали три підписи на вигаданій експозиції цивільного апарата. Перегляньте спостереження відвідувачів і ролі компонентів, а потім підберіть підпис до кожного інформаційного шляху.',
        notice:
          'Офлайн-модель понять. Жодного реального апарата, підключення дротів, налаштування радіо чи підтвердження льотної кваліфікації. Правильні підписи пояснюють ролі, але не доводять безпечність реального апарата.',
        records: [
          {
            id: 'observations',
            title: 'Спостереження відвідувачів',
            lines: [
              'Станція A показує шлях команди пілота до польотного контролера. Це запитана дія, а не зображення камери.',
              'Станція B показує шлях зображення камери до системи перегляду. Двоє відвідувачів бачать той самий вид; жоден екран у цьому прикладі не надсилає команду пілота.',
              'Станція C показує шлях розрахованої команди двигуна від польотного контролера до компонента, що регулює живлення двигуна.',
            ],
          },
          {
            id: 'roles',
            title: 'Картки ролей компонентів',
            lines: [
              'RX — приймач каналу керування в цій спрощеній моделі. Камера та VTX забезпечують окремий відеошлях.',
              'Польотний контролер використовує команди керування та дані датчиків для розрахунків. ESC отримує команди двигуна й регулює електричну потужність, що надходить до нього.',
              'Це функціональні ролі. Реальні вироби можуть поєднувати кілька ролей в одному пристрої; експозиція не є універсальною схемою підключення.',
            ],
          },
        ],
        fields: [
          {
            id: 'control',
            label: 'Підпис станції A',
            explanation:
              'Зображення камери не замінює запитану дію пілота. Станція A показує шлях керування через RX до польотного контролера.',
            options: [
              {
                value: 'rx',
                label: 'RX · інформація керування',
              },
              {
                value: 'video',
                label: 'Камера/VTX · відеоінформація',
              },
            ],
          },
          {
            id: 'view',
            label: 'Підпис станції B',
            explanation:
              'У цьому прикладі двоє глядачів отримують зображення камери. Виберіть підпис «Камера/VTX»: сам перегляд зображення не надсилає команду пілота.',
            options: [
              {
                value: 'rx',
                label: 'RX · інформація керування',
              },
              {
                value: 'video',
                label: 'Камера/VTX · відеоінформація',
              },
            ],
          },
          {
            id: 'motor',
            label: 'Призначення станції C',
            explanation:
              'Польотний контролер уже розрахував команду двигуна. ESC використовує її для регулювання живлення двигуна; VTX обслуговує відеошлях.',
            options: [
              {
                value: 'vtx',
                label: 'VTX · передавання відео',
              },
              {
                value: 'esc',
                label: 'ESC · керування живленням двигуна',
              },
            ],
          },
        ],
        success:
          'Експозиція тепер розрізняє керування пілота, відео та команди двигуна. Підписи пояснюють вигадані спостереження, не ототожнюючи зображення на екрані з командою керування.',
      },
    },
  },
  {
    format: 'revealline-learning-lesson.v1',
    id: 'ukraine-threads-06-lesson',
    revision: '1',
    fixtureRevision: '1',
    missionId: 'ukraine-threads-06',
    campaignId: 'ukraine-threads',
    kind: 'practice',
    title: 'Curate two honest labels',
    role: 'Exhibition curator',
    brief:
      'The fictional gallery has two images and a proposed regional claim. Inspect each source record, classify the images and choose what the evidence can support.',
    notice:
      'An untimed source-reading exercise. It checks evidence labels, not cultural identity or belonging. The game illustration is original generated artwork; neither image is a universal guide to Ukrainian dress.',
    sourceReviewedAt: '2026-09-28',
    sources: [
      {
        title: 'The Met — Dancer in Ukrainian Dress, object 436157',
        url: 'https://www.metmuseum.org/art/collection/search/436157',
      },
      {
        title: 'The Met — Open Access',
        url: 'https://www.metmuseum.org/hubs/open-access',
      },
    ],
    records: [
      {
        id: 'museum-record',
        title: 'Image A · museum artwork record',
        lines: [
          'The Metropolitan Museum of Art records Dancer in Ukrainian Dress by Edgar Degas, 1899, object 29.100.556. The medium is pastel over charcoal on tracing paper; the image is marked Public Domain.',
          'This record identifies an artwork. The exercise supplies no measured garment record, wearer interview or evidence establishing a rule for every region.',
        ],
      },
      {
        id: 'game-record',
        title: 'Image B · game production record',
        lines: [
          'The Wear It Today festival plaza was generated as an original illustration for this game. Its fictional banners and display spaces are contemporary creative scenery.',
          'It does not reproduce a documented historical garment, museum object or real festival. No historical maker, regional origin or universal symbolic meaning is claimed.',
        ],
      },
    ],
    fields: [
      {
        id: 'museum-label',
        label: 'Label for Image A',
        expected: 'artwork',
        explanation:
          'Keep the recorded artist, date and object number. A pastel is an artwork; calling it a photograph of a catalogued garment adds evidence the record does not contain.',
        options: [
          {
            value: 'artwork',
            label: 'Degas artwork · 1899 · Met object 29.100.556',
          },
          {
            value: 'garment-photo',
            label: 'Photograph of a garment documenting every regional detail',
          },
        ],
      },
      {
        id: 'game-label',
        label: 'Label for Image B',
        expected: 'original-illustration',
        explanation:
          'The production record identifies an original generated game illustration. A convincing texture does not turn it into a historical object or a photograph of an actual event.',
        options: [
          {
            value: 'historical-photo',
            label: 'Historical festival photograph with proven regional garments',
          },
          {
            value: 'original-illustration',
            label: 'Original generated game illustration · fictional festival plaza',
          },
        ],
      },
      {
        id: 'claim',
        label: 'Gallery conclusion supported by these records',
        expected: 'bounded',
        explanation:
          'These records support two different, attributed image types. They do not establish what everyone in a region wore or what every motif means. A more specific garment claim needs corresponding evidence.',
        options: [
          {
            value: 'universal',
            label: 'Both images prove a single dress tradition for every Ukrainian region',
          },
          {
            value: 'bounded',
            label: 'Compare artistic choices; keep source, purpose and unknowns visible',
          },
        ],
      },
    ],
    success:
      'Both labels now distinguish a documented artwork from an original game illustration. The gallery compares them without inventing a universal regional claim.',
    locales: {
      uk: {
        title: 'Підготуйте два точні підписи',
        role: 'Куратор виставки',
        brief:
          'У вигаданій галереї є два зображення й запропоноване твердження про регіони. Перегляньте записи джерел, визначте типи зображень і виберіть висновок, який підтверджують відомості.',
        notice:
          'Вправа з читання джерел без обмеження часу. Вона перевіряє підписи до свідчень, а не культурну ідентичність чи належність. Ігрова сцена — оригінальна згенерована ілюстрація; жодне зображення не є універсальним довідником українського вбрання.',
        records: [
          {
            id: 'museum-record',
            title: 'Зображення A · музейний запис твору',
            lines: [
              'Метрополітен-музей зазначає: «Танцівниця в українському вбранні», Едгар Дега, 1899 рік, предмет 29.100.556. Матеріал — пастель поверх вугілля на кальці; зображення позначене як суспільне надбання.',
              'Цей запис визначає твір мистецтва. У вправі немає обмірного опису одягу, інтерв’ю з носієм або свідчення про єдине правило для всіх регіонів.',
            ],
          },
          {
            id: 'game-record',
            title: 'Зображення B · запис створення гри',
            lines: [
              'Фестивальну площу рівня «Носіть сьогодні» згенеровано як оригінальну ілюстрацію для цієї гри. Її вигадані полотнища й виставкові простори — сучасна творча сцена.',
              'Вона не відтворює документований історичний одяг, музейний предмет чи реальний фестиваль. Для неї не заявлено історичного автора, регіонального походження або універсального значення символів.',
            ],
          },
        ],
        fields: [
          {
            id: 'museum-label',
            label: 'Підпис до зображення A',
            explanation:
              'Збережіть зазначені ім’я митця, дату й обліковий номер. Пастель — твір мистецтва; назвати її фотографією каталогізованого одягу означає додати свідчення, яких запис не містить.',
            options: [
              {
                value: 'artwork',
                label: 'Твір Дега · 1899 рік · предмет Метрополітен-музею 29.100.556',
              },
              {
                value: 'garment-photo',
                label: 'Фотографія одягу, що документує всі регіональні деталі',
              },
            ],
          },
          {
            id: 'game-label',
            label: 'Підпис до зображення B',
            explanation:
              'Запис створення визначає оригінальну згенеровану ігрову ілюстрацію. Переконлива фактура не робить її історичним предметом або фотографією справжньої події.',
            options: [
              {
                value: 'historical-photo',
                label: 'Історична фотографія фестивалю з підтвердженим регіональним одягом',
              },
              {
                value: 'original-illustration',
                label: 'Оригінальна згенерована ігрова ілюстрація · вигадана фестивальна площа',
              },
            ],
          },
          {
            id: 'claim',
            label: 'Висновок галереї, підтверджений цими записами',
            explanation:
              'Записи підтверджують два різні типи зображень із зазначеним походженням. Вони не доводять, що носили всі мешканці регіону чи що означає кожен мотив. Конкретніше твердження про одяг потребує відповідних свідчень.',
            options: [
              {
                value: 'universal',
                label:
                  'Обидва зображення доводять єдину традицію вбрання для всіх регіонів України',
              },
              {
                value: 'bounded',
                label: 'Порівняти творчі рішення; зберегти джерело, мету й невідомі відомості',
              },
            ],
          },
        ],
        success:
          'Обидва підписи тепер відрізняють документований твір мистецтва від оригінальної ігрової ілюстрації. Галерея порівнює їх, не вигадуючи універсального твердження про регіони.',
      },
    },
  },
]);
