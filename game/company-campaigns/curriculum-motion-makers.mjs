import { required } from '../data-json.mjs';
import { validateCompletionRewardPayload } from '../rewards/model.mjs';

export const CURRICULUM_MOTION_MAKERS_MISSION = 'fpv-meet-aircraft-02';
export const MOTION_MAKERS_SOURCES = Object.freeze([
  Object.freeze({
    title: 'NASA Glenn — Propeller Propulsion',
    url: 'https://www.grc.nasa.gov/www/k-12/airplane/propeller.html',
  }),
  Object.freeze({
    title: 'NASA — Electric Machines',
    url: 'https://www.nasa.gov/eap-technology/electric-machines/',
  }),
]);

/** The role explanation, caption script and full static alternative share one
 * authored source. Artwork is original; NASA supplies science context only. */
export const MOTION_MAKERS_STORY = Object.freeze({
  en: Object.freeze({
    title: 'Motion Makers · two different roles',
    paragraphs: [
      'The motor supplies rotation. The propeller uses moving blades to interact with surrounding air and produce force. They work together, but they do different jobs. In this original schematic, amber marks the stationary stator and cyan markers identify the moving rotor. The separated propeller icon shares the rotor’s deliberately slow motion.',
      'Compare the two roles: which part supplies rotation, and which part moves through air? A motor turning without a propeller does not replace the propeller’s aerodynamic role. Watch, pause or use the static description; none of these choices affects your mission result.',
      'This silent 12-second illustration is a conceptual explanation, not a recording of hardware, an assembly procedure or a simulation of speed, thrust or flight. The positions, eight decorative stator shapes, blade silhouette and motion have no specification meaning. A typical FPV outrunner can have a rotating outer bell; do not interpret “stator” as meaning every outer housing stays fixed. No wiring or correct rotation direction is shown. Sources explain the general roles and do not endorse this fictional model.',
    ],
    cues: [
      [
        '00:00.000',
        '00:03.000',
        'Two roles: a motor supplies rotation.\nA propeller interacts with air.',
      ],
      [
        '00:03.000',
        '00:06.000',
        '1: stator stays still. 2: rotor turns.\nThis separated schematic is not a build plan.',
      ],
      [
        '00:06.000',
        '00:09.000',
        'The propeller turns; dots stand for air.\nMotion and dots are conceptual, not measured.',
      ],
      [
        '00:09.000',
        '00:12.000',
        'Rotation and aerodynamic force are different roles.\nPause, replay or read the static explanation.',
      ],
    ],
    description:
      'Silent original diagram with a dark blue background and two circular panels. Left: the motor is separated into eight amber stator shapes that remain still and a cyan outer rotor ring with moving markers. These shapes are schematic and do not specify a real motor. Right: a cyan two-blade propeller icon turns at the same illustrative rate. Pale dots appear below it as a symbol for air, not a measured flow field. A plus sign connects the two roles conceptually; it is not a wiring connection. Labels are in English and Ukrainian. The opening holds still, the middle shows slow motion, and the ending settles. The poster holds the same complete diagram with stator, rotor, propeller and air labels. No soundtrack, real speed, blade direction prescription, dimensions or performance data is included.',
  }),
  uk: Object.freeze({
    title: 'Джерела руху · дві різні ролі',
    paragraphs: [
      'Мотор забезпечує обертання. Пропелер своїми рухомими лопатями взаємодіє з навколишнім повітрям і створює силу. Вони працюють разом, але виконують різні завдання. На цій оригінальній схемі бурштиновим позначено нерухомий статор, а бірюзові мітки показують рухомий ротор. Окремий значок пропелера повторює навмисно повільний рух ротора.',
      'Порівняйте дві ролі: яка частина забезпечує обертання, а яка рухається крізь повітря? Обертання мотора без пропелера не замінює аеродинамічної ролі пропелера. Перегляньте відео, поставте його на паузу або прочитайте статичний опис: ці дії не впливають на результат місії.',
      'Ця беззвучна 12-секундна ілюстрація пояснює поняття, а не показує запис реального обладнання, порядок складання чи моделювання швидкості, тяги або польоту. Розташування, вісім умовних форм статора, контур лопатей і рух не задають технічних параметрів. У поширеного FPV-мотора із зовнішнім ротором зовнішній дзвін може обертатися; слово «статор» не означає, що будь-який зовнішній корпус нерухомий. Тут немає схеми проводів чи вказівки правильного напрямку обертання. Джерела пояснюють загальні ролі й не схвалюють цю вигадану модель.',
    ],
    cues: [
      [
        '00:00.000',
        '00:03.000',
        'Дві ролі: мотор забезпечує обертання.\nПропелер взаємодіє з повітрям.',
      ],
      [
        '00:03.000',
        '00:06.000',
        '1: статор нерухомий. 2: ротор обертається.\nЦя розділена схема не є планом складання.',
      ],
      [
        '00:06.000',
        '00:09.000',
        'Пропелер обертається; крапки позначають повітря.\nЦе умовний рух, а не виміряні дані.',
      ],
      [
        '00:09.000',
        '00:12.000',
        'Обертання й аеродинамічна сила — різні ролі.\nПоставте на паузу або прочитайте пояснення.',
      ],
    ],
    description:
      'Беззвучна оригінальна схема на темно-синьому тлі з двома круглими панелями. Ліворуч мотор поділено на вісім нерухомих бурштинових форм статора й зовнішнє бірюзове кільце ротора з рухомими мітками. Форми умовні й не задають конструкції реального мотора. Праворуч бірюзовий значок дволопатевого пропелера обертається з тією самою ілюстративною швидкістю. Світлі крапки під ним позначають повітря, а не виміряне поле потоку. Знак «плюс» поєднує дві ролі на рівні понять і не означає електричного з’єднання. Підписи англійською й українською. На початку зображення нерухоме, у середині рух повільний, наприкінці він зупиняється. Статичний постер зберігає повну схему з підписами статора, ротора, пропелера й повітря. Немає звукової доріжки, реальної швидкості, припису напрямку лопатей, розмірів чи даних про продуктивність.',
  }),
});

// Filled with exact produced originals, never discovered from a current URL.
export const CURRICULUM_MOTION_MAKERS_FILES = Object.freeze(
  [
    {
      id: 'fpv-motion-makers-video',
      path: 'game/editions/assets/discovery/motion-makers/motion-makers-v1.mp4',
      bytes: 188873,
      sha256: '2c6ab067612b4530f729e6c92b49c5ebeb278eb44b4020cd8b3ff34e8e90cc5b',
    },
    {
      id: 'fpv-motion-makers-poster',
      path: 'game/editions/assets/discovery/motion-makers/motion-makers-poster-v1.png',
      bytes: 42073,
      sha256: 'a78136eb42349fb9f8faeb17b96144bb82217354dc2b86f7a936134b3c753297',
    },
    {
      id: 'fpv-motion-makers-transcript-en',
      path: 'game/editions/assets/discovery/motion-makers/motion-makers-en-v1.txt',
      bytes: 2154,
      sha256: 'f9f4d52645201f655e24d3e47376d90df72ad4e180c33ac53c15bf24aedb9cda',
    },
    {
      id: 'fpv-motion-makers-transcript-uk',
      path: 'game/editions/assets/discovery/motion-makers/motion-makers-uk-v1.txt',
      bytes: 3846,
      sha256: 'afaad10bc2d870f3493ec1549b1a0cde87cb97b433e29f26ec6ca4b0550430f5',
    },
    {
      id: 'fpv-motion-makers-captions-en',
      path: 'game/editions/assets/discovery/motion-makers/motion-makers-en-v1.vtt',
      bytes: 455,
      sha256: '6f70bfd2bac0003663b660fdc83612a9439b4131f6cc167d1aa83619612e7193',
    },
    {
      id: 'fpv-motion-makers-captions-uk',
      path: 'game/editions/assets/discovery/motion-makers/motion-makers-uk-v1.vtt',
      bytes: 709,
      sha256: '8dfd9aeb10bfdcaa89faf19b66c68966b08be609b35e028b3db06bf7a6c070cf',
    },
  ].map(Object.freeze),
);
export const CURRICULUM_MOTION_MAKERS_ASSET_IDS = Object.freeze(
  CURRICULUM_MOTION_MAKERS_FILES.map((row) => row.id),
);

export function createCurriculumMotionMakersContent(missionId, assets) {
  if (missionId !== CURRICULUM_MOTION_MAKERS_MISSION) return [];
  required(
    CURRICULUM_MOTION_MAKERS_FILES.length === 6,
    'Motion Makers needs six exact admitted originals.',
  );
  for (const expected of CURRICULUM_MOTION_MAKERS_FILES) {
    const actual = assets.find((row) => row.id === expected.id);
    required(
      actual?.approved === true &&
        actual.publication === 'public' &&
        actual.path === expected.path &&
        actual.sha256 === expected.sha256 &&
        actual.bytes === expected.bytes,
      'Motion Makers needs its exact admitted video, poster, captions and descriptions.',
    );
  }
  const ref = (suffix) => {
    const row = CURRICULUM_MOTION_MAKERS_FILES.find(
      (asset) => asset.id === 'fpv-motion-makers-' + suffix,
    );
    return { assetId: row.id, sha256: row.sha256 };
  };
  return [
    validateCompletionRewardPayload({
      id: 'fpv-meet-aircraft-02-motion-guide',
      type: 'knowledge',
      locales: Object.fromEntries(
        ['en', 'uk'].map((locale) => [
          locale,
          {
            title: MOTION_MAKERS_STORY[locale].title,
            paragraphs: MOTION_MAKERS_STORY[locale].paragraphs,
            sources: MOTION_MAKERS_SOURCES,
          },
        ]),
      ),
    }),
    validateCompletionRewardPayload({
      id: 'fpv-meet-aircraft-02-motion-video',
      type: 'video',
      asset: ref('video'),
      poster: ref('poster'),
      transcript: Object.fromEntries(
        ['en', 'uk'].map((locale) => [locale, ref('transcript-' + locale)]),
      ),
      captions: Object.fromEntries(
        ['en', 'uk'].map((locale) => [locale, ref('captions-' + locale)]),
      ),
      locales: Object.fromEntries(
        ['en', 'uk'].map((locale) => [locale, { title: MOTION_MAKERS_STORY[locale].title }]),
      ),
    }),
  ];
}
