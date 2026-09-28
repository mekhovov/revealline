import { CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS } from './curriculum-textile-lighting.mjs';
import { CURRICULUM_MOTION_MAKERS_ASSET_IDS } from './curriculum-motion-makers.mjs';
import {
  CURRICULUM_LISTENING_CAMPAIGN,
  CURRICULUM_LISTENING_ASSET_IDS,
} from './curriculum-listening.mjs';
import { curriculumReferenceAssetIds } from './curriculum-reference-assets.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import {
  COMMUNITY_CAMPAIGNS,
  COMMUNITY_MISSION_ROWS,
  COMMUNITY_SOURCES,
  COMMUNITY_LOOKS,
} from './curriculum-community.mjs';
import {
  CULTURE_CAMPAIGNS,
  CULTURE_MISSION_ROWS,
  CULTURE_SOURCES,
  CULTURE_LOOKS,
} from './curriculum-culture.mjs';
import {
  CULTURE_JOURNEY_CAMPAIGNS,
  CULTURE_JOURNEY_MISSION_ROWS,
  CULTURE_JOURNEY_SOURCES,
  CULTURE_JOURNEY_LOOKS,
} from './curriculum-culture-journeys.mjs';

import { FPV_CAMPAIGNS, FPV_MISSION_ROWS, FPV_SOURCES, FPV_LOOKS } from './curriculum-fpv.mjs';

// Public-source facts and original prompts reviewed 2026-09-28. Source links do
// not license source imagery or imply community endorsement. Aircraft examples
// concern a fictional civilian trainer, never operational military instruction.
export const CURRICULUM_SOURCES = freezeDesign({
  ...COMMUNITY_SOURCES,
  ...CULTURE_SOURCES,
  ...CULTURE_JOURNEY_SOURCES,
  ...FPV_SOURCES,
  social: {
    title: 'Social Drone UA — public community and FAQ',
    url: 'https://www.socialdrone.com.ua/',
  },
  victory: { title: 'Victory Drones — public overview', url: 'https://victory-drones.com/' },
  shirt: {
    title: 'Ivan Honchar Museum — shirt НДФ-6482',
    url: 'https://honchar.org.ua/collections/detail/4181',
  },
  volyn: {
    title: 'Ivan Honchar Museum — shirt НДФ-7132',
    url: 'https://honchar.org.ua/collections/detail/4182',
  },
  rushnyk: {
    title: 'Ivan Honchar Museum — rushnyk КН-3081',
    url: 'https://honchar.org.ua/collections/detail/1591',
  },
  white: {
    title: 'Kremenchuk district administration — Reshetylivka white-on-white embroidery',
    url: 'https://kremenchukrda.gov.ua/news/holova-poltavskoyi-oda-prosuvayemo-vyshyvku-bilym-po-bilomu-do-nematerialnoyi-spadshchyny-yunesko',
  },
  museum: {
    title: 'Ivan Honchar Museum — clothing collection',
    url: 'https://honchar.org.ua/collections/view/odag?type=list',
  },
  nasa: {
    title: 'NASA — The Science Behind Quadcopters',
    url: 'https://www.nasa.gov/stem-content/the-science-behind-quadcopters/',
  },
  fc: {
    title: 'Betaflight — Getting started',
    url: 'https://betaflight.com/docs/wiki/getting-started',
  },
  esc: {
    title: 'Betaflight — ESC firmware',
    url: 'https://betaflight.com/docs/wiki/getting-started/hardware/esc-firmware',
  },
  vtx: {
    title: 'Betaflight — Video transmitters',
    url: 'https://betaflight.com/docs/wiki/getting-started/hardware/vtx',
  },
  safety: {
    title: 'Betaflight — Safety',
    url: 'https://betaflight.com/docs/wiki/guides/current/Safety',
  },
});

const campaigns = [
  [
    'social-drone-people-workshop',
    'social-drone-ua',
    'People Behind the Workshop',
    'Люди майстерні',
    'A Community in Six Connections',
    'Спільнота у шести зв’язках',
    'social',
    'mosaic',
    'Arrange the six discoveries into a welcome: purpose, roles, sources, questions, careful work and clear handoffs. Explain which details come from a public source and which belong to our fictional workshop. No arcade result certifies a practical skill.',
    'Складіть із шести відкриттів привітання: мета, ролі, джерела, запитання, уважна робота та зрозуміла передача справ. Поясніть, які деталі походять із публічного джерела, а які належать вигаданій майстерні. Результат гри не засвідчує практичних навичок.',
  ],
  [
    'victory-drones-knowledge-connects',
    'victory-drones',
    'Knowledge Connects',
    'Знання єднають',
    'Your Learning Compass',
    'Ваш навчальний компас',
    'victory',
    'route',
    'Plan a fictional civilian learning session with the six cards. Start with a question, choose a source, ask for an explanation, compare ideas, identify what remains unknown and agree on a next step. A confident answer needs clear evidence and limits.',
    'За шістьма картками сплануйте вигадане цивільне заняття. Почніть із запитання, оберіть джерело, попросіть пояснення, порівняйте ідеї, визначте невідоме й узгодьте наступний крок. Упевнена відповідь потребує зрозумілих доказів і меж.',
  ],
  [
    'ukraine-threads',
    'ukraine-culture',
    'Threads Across Ukraine',
    'Нитки України',
    'An Atlas of Cloth and Evidence',
    'Атлас тканини й свідчень',
    'museum',
    'gallery',
    'Curate an exhibition using the six discoveries. Give each historical object its museum reference, date, place and maker when known. Label original illustrations separately. Two documented garments show variation; they cannot represent every person or tradition in a region.',
    'Створіть виставку із шести відкриттів. Для історичної речі зазначте музейний запис, дату, місце й автора, якщо вони відомі. Окремо позначайте оригінальні ілюстрації. Дві документовані сорочки показують розмаїття, але не представляють усіх людей чи традицій регіону.',
  ],
  [
    'fpv-meet-aircraft',
    'fpv-learning',
    'Meet the Aircraft',
    'Знайомство з дроном',
    'The Whole Aircraft Atlas',
    'Атлас цілого дрона',
    'nasa',
    'gallery',
    'Follow three relationships through the six cards: structure supports parts, energy reaches motors, and information travels through control and video links. Explain each component’s role using the discoveries. This civilian role atlas is a conceptual illustration, not a wiring diagram or assembly procedure.',
    'Простежте три зв’язки на шести картках: конструкція тримає деталі, енергія надходить до двигунів, а інформація передається каналами керування та відео. За відкриттями поясніть роль кожного компонента. Цей цивільний атлас — концептуальна ілюстрація, а не електрична схема чи інструкція зі складання.',
  ],
];

const rows = {};
rows['fpv-meet-aircraft'] = [
  {
    names: ['The Frame', 'Рама'],
    briefs: [
      'Reveal the civilian model’s structure. Physical bench demonstrations require propellers removed.',
      'Відкрийте конструкцію цивільної моделі. Для фізичних перевірок на столі знімайте пропелери.',
    ],
    teasers: [
      'Discover what holds the aircraft’s parts in relation to each other.',
      'Дізнайтеся, що утримує деталі дрона одна відносно одної.',
    ],
    text: [
      [
        'A quadcopter frame is its supporting structure. It holds components in an arrangement; it does not itself sense motion or create motor commands.',
        'Find the arms and centre in the civilian model illustration. Compare a frame with a bookshelf: both support other things with their own jobs. The arcade map is a metaphor, not a wiring diagram.',
      ],
      [
        'Рама квадрокоптера — його опорна конструкція. Вона утримує компоненти в певному розташуванні, але сама не вимірює рух і не створює команд двигунам.',
        'Знайдіть промені та центр на ілюстрації цивільної моделі. Порівняйте раму з полицею: обидві тримають інші речі з власними функціями. Ігрова карта — метафора, а не електрична схема.',
      ],
    ],
    refs: ['nasa', 'safety'],
    routes: [
      'Take short returns to the central frame island or a wider capture around its open west side.',
      'Робіть короткі повернення до центрального острова рами або ширше захоплення його західного боку.',
    ],
    scene:
      'An original civilian learning workshop with an exploded carbon frame on a cyan display, no connected battery and no mounted props.',
  },
  {
    names: ['Motion Makers', 'Джерела руху'],
    briefs: [
      'Connect four stations. Motors and props have different roles; remove physical props for bench work.',
      'З’єднайте чотири станції. Двигуни й пропелери мають різні ролі; для роботи на столі пропелери знімають.',
    ],
    teasers: [
      'Discover the difference between rotation and moving air.',
      'Дізнайтеся про різницю між обертанням і рухом повітря.',
    ],
    text: [
      [
        'A motor produces rotation. A propeller uses rotation to move air and produce thrust. NASA’s quadcopter learning material connects rotor forces with movement and torque.',
        'Point to the part that turns and the separate part that pushes air. A motor alone and one with a propeller have different effects. An arcade win never authorizes a physical powered test.',
      ],
      [
        'Двигун створює обертання. Пропелер завдяки обертанню рухає повітря й створює тягу. Матеріал NASA пов’язує сили роторів із рухом і крутним моментом.',
        'Вкажіть деталь, що обертає, та окрему деталь, що рухає повітря. Двигун сам по собі й двигун із пропелером діють по-різному. Перемога в грі не дозволяє фізичного випробування під живленням.',
      ],
    ],
    refs: ['nasa', 'safety'],
    routes: [
      'Choose adjacent workstations for short cuts or opposing stations for a broader capture.',
      'Оберіть сусідні станції для коротких відсічень або протилежні для ширшого захоплення.',
    ],
    scene:
      'Four civilian display stations with separated motors and unmounted props, illustrative cyan airflow ribbons and orange accents.',
  },
  {
    names: ['The ESC', 'Регулятор ESC'],
    briefs: [
      'Link the electronics aisles. This role model is not a connection procedure.',
      'З’єднайте електронні ряди. Ця модель ролей не є процедурою підключення.',
    ],
    teasers: [
      'Discover how motor commands relate to electrical power.',
      'Дізнайтеся, як команди двигуна пов’язані з електричною енергією.',
    ],
    text: [
      [
        'ESC means electronic speed controller. It receives motor commands from the flight controller and controls electrical power delivered to a motor.',
        'Separate instruction from energy: a command describes the requested behaviour; the electrical supply provides energy. This conceptual illustration omits wiring, ratings and configuration, which depend on actual components.',
      ],
      [
        'ESC означає електронний регулятор швидкості. Він отримує команди від польотного контролера й керує електричною енергією, що надходить до двигуна.',
        'Відокремте вказівку від енергії: команда задає потрібну поведінку, а живлення забезпечує енергію. Концептуальна ілюстрація не показує проводку, номінали й налаштування, які залежать від конкретних деталей.',
      ],
    ],
    refs: ['esc'],
    routes: [
      'Use either offset electronics return before crossing the central power aisle.',
      'Скористайтеся будь-яким зміщеним поверненням електроніки перед перетином центрального проходу енергії.',
    ],
    scene:
      'An original civilian ESC exhibit separating conceptual command and energy ribbons, without pin labels or wiring instructions.',
  },
  {
    names: ['The Flight Controller', 'Польотний контролер'],
    briefs: [
      'Reveal a quieter nested court and distinguish sensing from commanding.',
      'Відкрийте спокійний вкладений двір і розрізніть вимірювання та команди.',
    ],
    teasers: [
      'Sense, interpret, command: discover the controller’s role.',
      'Виміряти, опрацювати, керувати: відкрийте роль контролера.',
    ],
    text: [
      [
        'A flight controller uses sensor information and control inputs to calculate motor commands. “Sense → interpret → command” describes information flow, not physical wiring.',
        'A sensor reading and requested movement are different inputs. Explain why the controller needs information about the aircraft as well as an operator’s request. This civilian example does not choose firmware settings.',
      ],
      [
        'Польотний контролер використовує дані датчиків і входи керування для обчислення команд двигунам. «Виміряти → опрацювати → керувати» описує потік інформації, а не фізичну проводку.',
        'Показ датчика й бажаний рух — різні входи. Поясніть, чому контролеру потрібні дані про дрон поряд із запитом оператора. Цей цивільний приклад не добирає налаштувань прошивки.',
      ],
    ],
    refs: ['fc'],
    routes: [
      'Build a return through the outer court before linking the smaller sensor gallery.',
      'Побудуйте повернення через зовнішній двір перед з’єднанням малої галереї датчиків.',
    ],
    scene:
      'An original cyan controller pavilion with sensor, interpretation and command display layers around a quiet nested court.',
  },
  {
    names: ['Two Different Links', 'Два різні канали'],
    briefs: [
      'Connect twin bays and separate control information from the camera view.',
      'З’єднайте два простори й відокремте інформацію керування від зображення камери.',
    ],
    teasers: [
      'Seeing a picture and receiving controls are different jobs.',
      'Зображення й приймання команд — різні завдання.',
    ],
    text: [
      [
        'RX names the control-link receiver. The camera captures a view, while VTX sends video toward the viewing system. Control and video links carry different information.',
        'In a fictional civilian comparison, the picture is visible but control input is unconfirmed. Does a picture prove both links work? No: evidence about one does not establish the other. This is a reasoning exercise, not field troubleshooting.',
      ],
      [
        'RX позначає приймач каналу керування. Камера отримує зображення, а VTX передає відео до системи перегляду. Канали керування та відео несуть різну інформацію.',
        'У вигаданому цивільному порівнянні зображення видно, але приймання команд не підтверджене. Чи доводить картинка роботу обох каналів? Ні: доказ про один не підтверджує інший. Це вправа на міркування, а не польова діагностика.',
      ],
    ],
    refs: ['fc', 'vtx'],
    routes: [
      'Secure the control bay or video bay first, using their crossing as a safe return.',
      'Спершу відкрийте простір керування або відео, використовуючи спільний перехід для безпечного повернення.',
    ],
    scene:
      'Twin civilian FPV exhibit bays, one with a handheld controller and RX concept, another with a camera and goggles, with separate information paths.',
  },
  {
    names: ['The Whole Aircraft', 'Цілий дрон'],
    briefs: [
      'Combine earlier returns. Physical bench work remains props-off and component-specific.',
      'Поєднайте попередні повернення. Фізична робота на столі потребує знятих пропелерів та інструкцій для конкретних деталей.',
    ],
    teasers: [
      'Complete an atlas of structure, energy and information.',
      'Завершіть атлас конструкції, енергії та інформації.',
    ],
    text: [
      [
        'A battery is an energy source, not a control command or a video link. Together with the earlier parts, it completes three different relationships: support, energy and information.',
        'Explain the civilian model through those relationships using your six discoveries. Real equipment requires its own instructions and safe battery handling; this conceptual atlas is not a wiring recipe or a practical qualification.',
      ],
      [
        'Акумулятор — джерело енергії, а не команда керування чи відеоканал. Разом із попередніми деталями він доповнює три різні зв’язки: опору, енергію та інформацію.',
        'За шістьма відкриттями поясніть цивільну модель через ці зв’язки. Реальне обладнання потребує власних інструкцій і безпечного поводження з акумулятором; концептуальний атлас не є схемою підключення чи практичною кваліфікацією.',
      ],
    ],
    refs: ['safety', 'fc', 'esc', 'vtx'],
    routes: [
      'Join the support hub first or link the energy and information islands before the final broad cut.',
      'Спершу з’єднайте опорний вузол або острови енергії та інформації перед широким фінальним відсіченням.',
    ],
    scene:
      'An original civilian aircraft component atlas with a disconnected battery, separately displayed props and distinct support, energy and information layers.',
  },
];
rows['ukraine-threads'] = [
  {
    names: ['Read the Cloth', 'Прочитайте тканину'],
    briefs: [
      'Reveal the exhibition square and read the record before interpreting its ornament.',
      'Відкрийте виставкову площу й прочитайте запис перед тлумаченням орнаменту.',
    ],
    teasers: [
      'A museum record anchors a garment’s story.',
      'Музейний запис допомагає розповісти історію одягу.',
    ],
    text: [
      [
        'Ivan Honchar Museum records men’s embroidered shirt НДФ-6482 as late nineteenth to early twentieth century, from Hadiach in the Poltava area. Its maker is unknown.',
        'Begin a label with the documented object, date, place and maker when known. “Unknown” is useful information; a motif is not permission to invent a personal story. This scene is an illustration, not that museum object.',
      ],
      [
        'Музей Івана Гончара датує чоловічу вишиту сорочку НДФ-6482 кінцем XIX — початком XX століття та пов’язує її з Гадячем на Полтавщині. Автор невідомий.',
        'Починайте підпис із документованих назви речі, дати, місця й автора, якщо він відомий. «Невідомо» — корисна інформація; мотив не дозволяє вигадувати особисту історію. Сцена є ілюстрацією, а не цим музейним предметом.',
      ],
    ],
    refs: ['shirt'],
    routes: [
      'Return through the exhibition plinth or open the wide label gallery first.',
      'Повертайтеся через виставковий п’єдестал або спершу відкрийте широку галерею підписів.',
    ],
    scene:
      'An original warm linen exhibition square with red-and-black textile studies and an open object plinth.',
  },
  {
    names: ['Stitch Paths', 'Шляхи стібків'],
    briefs: [
      'Connect offset sample aisles and compare a material with a technique.',
      'З’єднайте зміщені ряди зразків і порівняйте матеріал із технікою.',
    ],
    teasers: [
      'A thread and a stitch answer different questions.',
      'Нитка й стібок відповідають на різні запитання.',
    ],
    text: [
      [
        'The record for shirt НДФ-6482 lists cloth materials separately from decorative techniques, including cross-stitch and hemstitch. A material is what a maker uses; a technique describes how the work is made.',
        'Sort “linen” and “cross-stitch” into material and technique on a fictional label. Check the source rather than assuming all Ukrainian embroidery uses one stitch.',
      ],
      [
        'У записі сорочки НДФ-6482 матеріали тканини відокремлені від технік оздоблення, серед яких хрестик і мережка. Матеріал — те, що використовує майстер, а техніка описує спосіб роботи.',
        'На вигаданому підписі розподіліть «льон» і «хрестик» між матеріалом та технікою. Перевіряйте джерело, а не припускайте, що вся українська вишивка виконана одним швом.',
      ],
    ],
    refs: ['shirt'],
    routes: [
      'Choose the upper sample aisle or connect the two lower plinths before crossing between rows.',
      'Оберіть верхній ряд зразків або з’єднайте два нижні п’єдестали перед перетином між рядами.',
    ],
    scene:
      'An original textile sample gallery with magnified thread textures, offset linen aisles and red stitched paths.',
  },
  {
    names: ['White on White', 'Білим по білому'],
    briefs: [
      'Reveal nested galleries and notice texture as well as colour.',
      'Відкрийте вкладені галереї й помічайте фактуру поряд із кольором.',
    ],
    teasers: [
      'Pale thread can make a rich surface.',
      'Світла нитка може створювати багату поверхню.',
    ],
    text: [
      [
        'The Poltava regional source describes Reshetylivka’s white-on-white embroidery tradition. A pale palette carries detail through stitch, relief and openwork rather than strong colour contrast.',
        'Look for shadows around raised threads in our original illustration. Which detail would disappear in a flat white silhouette? This artistic study does not reproduce a particular historical garment.',
      ],
      [
        'Регіональне джерело Полтавщини описує решетилівську традицію вишивки білим по білому. Світла палітра передає деталі через стібки, рельєф і ажур, а не лише сильний кольоровий контраст.',
        'В оригінальній ілюстрації знайдіть тіні біля піднятих ниток. Яка деталь зникла б у пласкому білому силуеті? Художнє дослідження не відтворює конкретний історичний одяг.',
      ],
    ],
    refs: ['white'],
    routes: [
      'Use the outer textile ledge before moving into the small inner gallery.',
      'Скористайтеся зовнішнім текстильним виступом перед переходом до малої внутрішньої галереї.',
    ],
    scene:
      'Original ivory textile architecture with angled light revealing raised white threads, openwork and nested exhibition courts.',
  },
  {
    names: ['Many Local Voices', 'Розмаїття місцевих голосів'],
    briefs: [
      'Connect two exhibit branches without reducing them to one pattern.',
      'З’єднайте дві гілки виставки, не зводячи їх до одного візерунка.',
    ],
    teasers: [
      'Two documented garments invite a careful comparison.',
      'Дві документовані сорочки запрошують до уважного порівняння.',
    ],
    text: [
      [
        'The museum records Volyn shirt НДФ-7132 as made by Anastasiia Kravchuk in the first half of the twentieth century. Compare this named maker with the unknown maker in the earlier Poltava record.',
        'Both records describe specific objects. Their differences invite questions about maker, time, material and place; they do not establish a rule for every garment in either region.',
      ],
      [
        'Музей пов’язує волинську сорочку НДФ-7132 з Анастасією Кравчук і датує першою половиною XX століття. Порівняйте відоме ім’я майстрині з невідомим автором попереднього полтавського запису.',
        'Обидва записи описують конкретні речі. Відмінності спонукають запитувати про автора, час, матеріал і місце, але не встановлюють правила для всього одягу регіону.',
      ],
    ],
    refs: ['volyn', 'shirt'],
    routes: [
      'Explore either exhibit branch first, returning through the wide shared reading terrace.',
      'Спершу дослідіть будь-яку гілку виставки, повертаючись через широку спільну терасу читання.',
    ],
    scene:
      'An original Ukrainian textile museum garden with separate linen pavilions joined by a warm reading terrace.',
  },
  {
    names: ['A Rushnyk’s Story', 'Історія рушника'],
    briefs: [
      'Connect the long exhibition hall and its small provenance alcoves.',
      'З’єднайте довгу виставкову залу та малі ніші історії предмета.',
    ],
    teasers: [
      'A rushnyk’s record contains more than its ornament.',
      'Запис рушника містить більше, ніж опис орнаменту.',
    ],
    text: [
      [
        'The museum dates rushnyk КН-3081 to the first half of the nineteenth century, with a homespun linen ground and an unknown maker. Its record notes a donation by Petro Honchar in 2001.',
        'Separate an object’s creation from its later path into a collection. A donation date is not its making date. Ornament alone does not establish the exact ceremony in which it was used.',
      ],
      [
        'Музей датує рушник КН-3081 першою половиною XIX століття; основу описано як доморобне лляне полотно, автор невідомий. Запис зазначає дарунок Петра Гончара 2001 року.',
        'Відокремлюйте створення предмета від його подальшого шляху до колекції. Дата дарування не є датою виготовлення. Сам орнамент не визначає конкретного обряду використання.',
      ],
    ],
    refs: ['rushnyk'],
    routes: [
      'Use the hall’s side alcoves to shorten exposed crossings toward the far exhibit.',
      'Використайте бічні ніші зали для коротших відкритих перетинів до дальнього експоната.',
    ],
    scene:
      'An original linen exhibition hall with suspended rushnyk-inspired studies, archival alcoves and soft red accents.',
  },
  {
    names: ['Wear It Today', 'Носіть сьогодні'],
    briefs: [
      'Join the contemporary design plaza and complete the textile exhibit.',
      'З’єднайте площу сучасного дизайну й завершіть текстильну виставку.',
    ],
    teasers: [
      'Bring history, honest labels and new creativity into one gallery.',
      'Поєднайте історію, точні підписи й нову творчість в одній галереї.',
    ],
    text: [
      [
        'This scene’s designs were created for the game. They respond to colour, rhythm and texture without being presented as historical objects or universal Ukrainian symbols.',
        'Curate two labels: one for a documented museum object, another for an original contemporary illustration. Keep the source, maker and uncertainty visible. Creativity and careful attribution can share an exhibition.',
      ],
      [
        'Дизайни сцени створені для гри. Вони працюють із кольором, ритмом і фактурою, не видаючи себе за історичні предмети чи універсальні українські символи.',
        'Підготуйте два підписи: для документованого музейного предмета й оригінальної сучасної ілюстрації. Залиште видимими джерело, автора та невизначеність. Творчість і точна атрибуція можуть бути на одній виставці.',
      ],
    ],
    refs: ['museum'],
    routes: [
      'Connect the central festival platform or take three smaller design islands in sequence.',
      'З’єднайте центральну фестивальну платформу або послідовно пройдіть три менші дизайнерські острови.',
    ],
    scene:
      'An original contemporary textile plaza with linen banners, red-and-black graphic rhythms and an amber festival stage.',
  },
];
rows['victory-drones-knowledge-connects'] = [
  {
    names: ['A Learning Compass', 'Навчальний компас'],
    briefs: [
      'Reveal the compass court and begin with a clear learning question.',
      'Відкрийте двір компаса й почніть із чіткого навчального запитання.',
    ],
    teasers: [
      'Discover the public purpose behind a learning community.',
      'Дізнайтеся про публічну мету навчальної спільноти.',
    ],
    text: [
      [
        'Victory Drones describes a Ukrainian volunteer project for technology education, community support and advocacy. Its public activities include military and civilian audiences; this game’s practical examples remain civilian.',
        'Choose a question for our fictional science club: “What role does this part have?” gives a clearer destination than “Learn everything.” A useful question helps you choose a suitable source.',
      ],
      [
        'Victory Drones описує український волонтерський проєкт технологічної освіти, підтримки спільноти та адвокації. Його публічні напрями охоплюють військову й цивільну аудиторії; практичні приклади гри залишаються цивільними.',
        'Оберіть запитання для вигаданого гуртка: «Яка роль цієї деталі?» задає чіткішу мету, ніж «Вивчити все». Корисне запитання допомагає обрати доречне джерело.',
      ],
    ],
    refs: ['victory'],
    routes: [
      'Use the crescent-shaped pair of returns or capture the open court in a wider loop.',
      'Скористайтеся парою повернень у формі півмісяця або захопіть відкритий двір ширшою петлею.',
    ],
    scene:
      'An original steel-blue learning observatory with a yellow compass floor and open question stations.',
  },
  {
    names: ['Two Ways to Explain', 'Два способи пояснити'],
    briefs: [
      'Connect the diagram bay and story bay through their shared return.',
      'З’єднайте простори схем та історій через спільне повернення.',
    ],
    teasers: ['Compare an explanation with an example.', 'Порівняйте пояснення з прикладом.'],
    text: [
      [
        'Victory Drones’ public overview brings education and community into the same project. Our fictional gallery asks what a useful explanation can look like.',
        'A diagram shows a relationship; an example shows its application. Explain one everyday idea twice: describe how a bookshelf supports books, then sketch it. Neither format automatically proves a claim.',
      ],
      [
        'У публічному описі Victory Drones освіта й спільнота є частинами одного проєкту. Наша вигадана галерея запитує, яким буває корисне пояснення.',
        'Схема показує зв’язок, а приклад — його застосування. Двічі поясніть повсякденну думку: опишіть, як полиця тримає книжки, а потім намалюйте це. Жоден формат сам по собі не доводить твердження.',
      ],
    ],
    refs: ['victory'],
    routes: [
      'Choose the diagram bay or story bay first; the narrow middle return links both routes.',
      'Спершу оберіть простір схем або історій; вузьке центральне повернення з’єднує обидва маршрути.',
    ],
    scene:
      'Twin steel-blue pavilions connected by a yellow bridge, with diagram and original story displays.',
  },
  {
    names: ['Ask and Verify', 'Запитайте й перевірте'],
    briefs: [
      'Link three evidence stations while separating two moving threats.',
      'З’єднайте три станції доказів, розділяючи дві рухомі загрози.',
    ],
    teasers: [
      'A source and a limit make a claim easier to inspect.',
      'Джерело й межі допомагають перевірити твердження.',
    ],
    text: [
      [
        'A fictional club card says a demonstration worked. Ask what was demonstrated, where the record came from and what it does not establish before repeating that claim.',
        'The public project overview supports a statement about Victory Drones’ stated mission. It does not by itself prove that an invented game character completed a course or achieved a particular outcome.',
      ],
      [
        'Картка вигаданого гуртка каже, що демонстрація вдалася. Перш ніж повторювати це, з’ясуйте, що демонстрували, звідки запис і чого він не доводить.',
        'Публічний опис проєкту підтверджує заявлену місію Victory Drones. Сам по собі він не доводить, що вигаданий персонаж завершив курс або досяг певного результату.',
      ],
    ],
    refs: ['victory'],
    routes: [
      'Capture the near evidence island, then split or encircle the two distant stations.',
      'Захопіть ближній острів доказів, а потім розділіть або обійдіть дві дальні станції.',
    ],
    scene:
      'Three luminous source pedestals in an asymmetric blue research hall with yellow index ribbons.',
  },
  {
    names: ['Room for Questions', 'Місце для запитань'],
    briefs: [
      'Cross the spacious listening gallery through its sheltered inner court.',
      'Перетніть простору галерею слухання через захищений внутрішній двір.',
    ],
    teasers: [
      'Discover a calmer way to make an explanation useful.',
      'Дізнайтеся, як спокійно зробити пояснення кориснішим.',
    ],
    text: [
      [
        'This original scene imagines a learner pausing an explanation. A useful response asks what is unclear instead of turning reading speed into a score.',
        'Try “I can name the parts, but cannot explain their relationship yet.” That identifies a next step. Read every discovery at your own pace and revisit it in Collection.',
      ],
      [
        'Оригінальна сцена уявляє, як учасник зупиняє пояснення. Корисна відповідь уточнює незрозуміле, а не оцінює швидкість читання.',
        'Спробуйте: «Я можу назвати частини, але ще не пояснюю їхній зв’язок». Це визначає наступний крок. Читайте відкриття у власному темпі та повертайтеся до них у колекції.',
      ],
    ],
    refs: ['victory'],
    routes: [
      'Use the large quiet court to break a long crossing into two shorter decisions.',
      'Скористайтеся великим спокійним двором, щоб розділити довгий перетин на два коротші рішення.',
    ],
    scene:
      'A quiet blue open-air learning court with yellow seating islands and an illuminated question wall.',
  },
  {
    names: ['Compare Before Concluding', 'Порівняйте перед висновком'],
    briefs: [
      'Join the comparison shelves and preserve a route around the slow band.',
      'З’єднайте полиці порівняння та збережіть шлях навколо повільної смуги.',
    ],
    teasers: [
      'Two different examples can share a useful principle.',
      'Два різні приклади можуть мати спільний принцип.',
    ],
    text: [
      [
        'Compare a labelled diagram with an unlabelled photograph in this fictional exercise. The photograph looks realistic; the diagram may explain a selected relationship more clearly. Decide what question each can answer.',
        'A fair comparison asks both examples the same question and states what remains unknown. Attractive presentation and reliable evidence are different properties.',
      ],
      [
        'У вигаданій вправі порівняйте підписану схему та фотографію без підписів. Фото реалістичне, а схема може ясніше пояснювати обраний зв’язок. На яке запитання відповідає кожен приклад?',
        'Справедливе порівняння ставить обом прикладам те саме запитання й називає невідоме. Привабливе оформлення та надійні докази — різні властивості.',
      ],
    ],
    refs: ['victory'],
    routes: [
      'Connect the upper reference shelves before the longer lower route, or reverse the order.',
      'З’єднайте верхні довідкові полиці перед довшим нижнім маршрутом або змініть порядок.',
    ],
    scene:
      'A stepped blue comparison library with paired display frames and a yellow reading terrace.',
  },
  {
    names: ['Teach It Forward', 'Поясніть наступному'],
    briefs: [
      'Connect the learning network and reveal its shared explanation.',
      'З’єднайте навчальну мережу й відкрийте спільне пояснення.',
    ],
    teasers: [
      'Complete a learning compass for another subject.',
      'Завершіть навчальний компас для іншої теми.',
    ],
    text: [
      [
        'You collected questions, explanations, evidence, uncertainty and comparisons. Put them together by explaining a new everyday system, such as a bicycle, to an imaginary newcomer.',
        'State the question, explain one relationship, attach a source and name one limit. Invite a question in return. This transferable learning routine is not an official Victory Drones qualification.',
      ],
      [
        'Ви зібрали запитання, пояснення, докази, невизначеність і порівняння. Поєднайте їх, пояснюючи уявному новачку іншу повсякденну систему, наприклад велосипед.',
        'Сформулюйте запитання, поясніть один зв’язок, додайте джерело й назвіть обмеження. Запросіть запитання у відповідь. Цей спосіб навчання не є офіційною кваліфікацією Victory Drones.',
      ],
    ],
    refs: ['victory'],
    routes: [
      'Choose the shorter reference chain or broad outer gallery, returning through the central forum.',
      'Оберіть коротший ланцюг довідок або широку зовнішню галерею з поверненням через центральний форум.',
    ],
    scene:
      'A completed original learning network joining a compass, source hall and shared forum with yellow bridges.',
  },
];
rows['social-drone-people-workshop'] = [
  {
    names: ['Welcome to the Network', 'Вітаємо у спільноті'],
    briefs: [
      'Connect the welcome court and discover the community’s public purpose.',
      'З’єднайте вітальний двір і дізнайтеся про публічну мету спільноти.',
    ],
    teasers: [
      'A first connection reveals who this community supports.',
      'Перше з’єднання відкриє, кого підтримує ця спільнота.',
    ],
    text: [
      [
        'Social Drone UA describes a volunteer community supporting Ukraine’s military with drones. This fictional gallery presents its public purpose without depicting real participants or operations.',
        'Imagine welcoming someone to the illustrated workshop. Which sentence explains the purpose, and which detail makes the room feel welcoming? Keep factual claims and artistic atmosphere distinct.',
      ],
      [
        'Social Drone UA описує волонтерську спільноту, що підтримує українське військо дронами. Ця вигадана галерея представляє її публічну мету без зображення реальних учасників чи операцій.',
        'Уявіть, що вітаєте когось в ілюстрованій майстерні. Яке речення пояснює мету, а яка деталь створює гостинну атмосферу? Розрізняйте фактичні твердження та художній настрій.',
      ],
    ],
    refs: ['social'],
    routes: [
      'Use the wide welcome island for short returns, or capture the open west court first.',
      'Використайте широкий вітальний острів для коротких повернень або спершу відкрийте західний двір.',
    ],
    scene:
      'An original cobalt-blue welcome hall around a community table and civilian learning models.',
  },
  {
    names: ['Many Ways to Contribute', 'Різні способи долучитися'],
    briefs: [
      'Link two workspaces through their shared meeting point.',
      'З’єднайте два робочі простори через спільне місце зустрічі.',
    ],
    teasers: [
      'Discover how different contributions support one purpose.',
      'Дізнайтеся, як різні внески підтримують спільну мету.',
    ],
    text: [
      [
        'The public Social Drone page invites technical participants and donors. These are different ways to contribute, not a ranking of people’s worth.',
        'Our fictional room also needs clear labels and a useful welcome. Choose two contributions that depend on each other and explain their connection without assuming everyone has the same time or skills.',
      ],
      [
        'Публічна сторінка Social Drone запрошує технічних учасників і донорів. Це різні способи долучитися, а не оцінка цінності людей.',
        'Нашій вигаданій кімнаті також потрібні зрозумілі позначки й привітання. Оберіть два взаємозалежні внески та поясніть їхній зв’язок, не припускаючи, що всі мають однакові час і навички.',
      ],
    ],
    refs: ['social'],
    routes: [
      'Choose the upper meeting alcove or lower workbench as your first safe return.',
      'Оберіть верхню нішу для зустрічей або нижній робочий стіл для першого безпечного повернення.',
    ],
    scene: 'Two blue workshop bays with a central meeting alcove and distinct contribution boards.',
  },
  {
    names: ['Find the Source', 'Знайдіть джерело'],
    briefs: [
      'Connect the archive stations while keeping both drifting gaps in view.',
      'З’єднайте архівні станції, стежачи за обома рухомими перешкодами.',
    ],
    teasers: [
      'A useful story keeps its source attached.',
      'Корисна розповідь зберігає зв’язок із джерелом.',
    ],
    text: [
      [
        'An organization’s public page can support a claim about its stated purpose. An original game illustration cannot prove who attended a real workshop or what happened there.',
        'The fictional caption “A community learning room” describes this artwork. “A real workshop last Tuesday” would need separate evidence. Choose the caption the image can honestly support.',
      ],
      [
        'Публічна сторінка організації може підтвердити її заявлену мету. Оригінальна ілюстрація гри не доводить, хто був на справжньому занятті або що там відбулося.',
        'Вигаданий підпис «Навчальна кімната спільноти» описує ілюстрацію. «Справжнє заняття минулого вівторка» потребувало б окремих доказів. Оберіть підпис, який зображення справді підтверджує.',
      ],
    ],
    refs: ['social'],
    routes: [
      'Return through the offset archive islands before attempting the long east aisle.',
      'Повертайтеся через зміщені архівні острови перед перетином довгого східного проходу.',
    ],
    scene:
      'An original source library with open blank cards, connected cobalt shelves and a bright evidence desk.',
  },
  {
    names: ['Ask a Useful Question', 'Поставте корисне запитання'],
    briefs: [
      'Explore the quiet discussion court using its interior return.',
      'Дослідіть спокійний двір обговорень через внутрішнє повернення.',
    ],
    teasers: [
      'Turn uncertainty into a clear question.',
      'Перетворіть невпевненість на зрозуміле запитання.',
    ],
    text: [
      [
        'The Social Drone FAQ distinguishes assembly training from flight training. Check a provider’s stated scope before assuming one course covers every skill.',
        'At our fictional civilian model table, “I do not understand this label; what is its purpose?” identifies an uncertainty. This game offers no enrolment or practical qualification.',
      ],
      [
        'У FAQ Social Drone розрізняє навчання складання та навчання польотів. Перевіряйте заявлений обсяг курсу, перш ніж припускати, що він охоплює всі навички.',
        'За вигаданим столом цивільних моделей запитання «Я не розумію позначки; яке її призначення?» визначає невідоме. Гра не надає запису на курси чи практичної кваліфікації.',
      ],
    ],
    refs: ['social'],
    routes: [
      'Follow the wide inner bench while the patrol passes the exposed outer edge.',
      'Рухайтеся вздовж широкої внутрішньої лави, поки патруль проходить відкритим зовнішнім краєм.',
    ],
    scene:
      'A spacious blue discussion courtyard with a long bench, warm lamps and civilian model cases.',
  },
  {
    names: ['Care Before Certainty', 'Уважність перед упевненістю'],
    briefs: [
      'Connect the checking desks without mistaking a quick route for a careful result.',
      'З’єднайте столи перевірки, не плутаючи швидкий маршрут з уважним результатом.',
    ],
    teasers: [
      'Discover a habit that makes a fictional handoff clearer.',
      'Відкрийте звичку, що робить вигадану передачу справ зрозумілішою.',
    ],
    text: [
      [
        'In this fictional exercise, one card says “checked.” Another records “label compared with inventory; reviewer: Iryna; unresolved: one missing description.” The second explains what was examined.',
        'Name the evidence and remaining uncertainty before calling a task complete. This general teamwork example does not describe Social Drone’s internal process or certify any aircraft.',
      ],
      [
        'У вигаданій вправі одна картка каже «перевірено». Інша: «позначку звірено з переліком; перевіряла Ірина; невирішене: один відсутній опис». Другий запис пояснює, що саме перевірили.',
        'Перед завершенням справи назвіть докази й невідоме. Цей загальний приклад співпраці не описує внутрішній процес Social Drone й не засвідчує придатність дрона.',
      ],
    ],
    refs: ['social'],
    routes: [
      'Link the staggered desks using the lower return to avoid the slow aisle.',
      'З’єднайте зміщені столи через нижнє повернення, оминаючи повільний прохід.',
    ],
    scene:
      'A fictional evidence workshop with orderly inventory cards and three separated blue review benches.',
  },
  {
    names: ['The Community Mosaic', 'Мозаїка спільноти'],
    briefs: [
      'Join the welcome, archive and discussion spaces in one revealed picture.',
      'Об’єднайте вітальний, архівний і дискусійний простори в одному зображенні.',
    ],
    teasers: [
      'Complete a guide to clear community connections.',
      'Завершіть путівник зрозумілими зв’язками спільноти.',
    ],
    text: [
      [
        'The gallery’s learning thread is purpose, different contributions, sources, useful questions and clear handoffs. Its scenes are original illustrations, not records of real events.',
        'Apply those ideas to a new fictional task: preparing a library display. Who needs what information next, and which claim still needs a source? Community learning can travel to another setting.',
      ],
      [
        'Навчальна нитка галереї — мета, різні внески, джерела, корисні запитання та зрозуміла передача справ. Сцени є оригінальними ілюстраціями, а не записами реальних подій.',
        'Застосуйте ці думки до нової вигаданої справи: бібліотечної виставки. Кому яка інформація потрібна далі та якому твердженню бракує джерела? Досвід співпраці можна перенести в інше середовище.',
      ],
    ],
    refs: ['social'],
    routes: [
      'Join the central mosaic first or connect the small archive and welcome islands before the broad crossing.',
      'Спершу з’єднайте центральну мозаїку або малі архівний і вітальний острови перед широким перетином.',
    ],
    scene:
      'An original completed community mosaic joining the welcome hall, source shelves and discussion tables.',
  },
];

campaigns.push(
  ...COMMUNITY_CAMPAIGNS,
  ...CULTURE_CAMPAIGNS,
  ...CULTURE_JOURNEY_CAMPAIGNS,
  ...FPV_CAMPAIGNS,
);
Object.assign(
  rows,
  COMMUNITY_MISSION_ROWS,
  CULTURE_MISSION_ROWS,
  CULTURE_JOURNEY_MISSION_ROWS,
  FPV_MISSION_ROWS,
);
const campaignLooks = {
  ...COMMUNITY_LOOKS,
  ...CULTURE_LOOKS,
  ...CULTURE_JOURNEY_LOOKS,
  ...FPV_LOOKS,
};

const languages = ['en', 'uk'];
export const CURRICULUM_CAMPAIGNS = freezeDesign(
  campaigns.map(
    ([
      id,
      brandId,
      name,
      ukName,
      title,
      ukTitle,
      link,
      exhibitLayout,
      text,
      ukText,
      progression,
    ]) => ({
      id,
      revision: '1',
      brandId,
      name,
      audience: 'Public educational discovery',
      publication: 'public',
      sourcePath: `game/content/company-campaigns/${id}.json`,
      assetIds: [],
      rewardAssetIds: [
        ...(id === CURRICULUM_LISTENING_CAMPAIGN ? CURRICULUM_LISTENING_ASSET_IDS : []),
        ...(id === 'ukraine-threads' ? CURRICULUM_TEXTILE_LIGHTING_ASSET_IDS : []),
        ...(id === 'fpv-meet-aircraft' ? CURRICULUM_MOTION_MAKERS_ASSET_IDS : []),
        ...(id === 'ukraine-threads' ? ['met-degas-ukrainian-dress-436157'] : []),
        ...curriculumReferenceAssetIds(id),
      ],
      modes: ['solo'],
      missionIds: rows[id].map((_, index) => `${id}-${String(index + 1).padStart(2, '0')}`),
      link,
      exhibitLayout,
      ...(progression ? { progression } : {}),
      ...(campaignLooks[id] ? { look: campaignLooks[id] } : {}),
      locales: {
        en: {
          name,
          title,
          teaser: 'Win all six distinct missions to complete this discovery exhibit.',
          paragraphs: [text],
        },
        uk: {
          name: ukName,
          title: ukTitle,
          teaser: 'Переможіть у всіх шести різних місіях, щоб завершити виставку відкриттів.',
          paragraphs: [ukText],
        },
      },
    }),
  ),
);
export const CURRICULUM_MISSIONS = freezeDesign(
  CURRICULUM_CAMPAIGNS.flatMap((campaign) =>
    rows[campaign.id].map((row, index) => ({
      id: campaign.missionIds[index],
      campaignId: campaign.id,
      brandId: campaign.brandId,
      ordinal: index + 1,
      name: row.names[0],
      brief: row.briefs[0],
      routeDecision: row.routes[0],
      scene: row.scene,
      refs: row.refs,
      locales: Object.fromEntries(
        languages.map((locale, languageIndex) => [
          locale,
          {
            name: row.names[languageIndex],
            title: row.names[languageIndex],
            brief: row.briefs[languageIndex],
            teaser: row.teasers[languageIndex],
            paragraphs: row.text[languageIndex],
            routeDecision: row.routes[languageIndex],
            alt:
              languageIndex === 0
                ? `${row.names[0]} — original mission illustration. Not a documentary photograph or technical plan.`
                : `${row.names[1]} — оригінальна ілюстрація місії. Не документальне фото й не технічна схема.`,
          },
        ]),
      ),
    })),
  ),
);
