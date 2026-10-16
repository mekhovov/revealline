import { required } from '../data-json.mjs';
import { validateExplorationPayload } from '../rewards/exploration.mjs';
import { CURRICULUM_SOURCES } from './curriculum.mjs';

// Coordinates were inspected on this uncropped 960 × 640 original illustration.
// Changing the picture requires another visual review, not reusing these points.
const FRAME_IMAGE = Object.freeze({
  assetId: 'fpv-meet-aircraft-01-art-v1',
  sha256: '8b79d705bb064333eefece3c6acdd0f9f0a4a9079cab8ab2939401ae47689fe8',
});
const TEXTILE_IMAGE = Object.freeze({
  assetId: 'reference-ukraine-met-shirt-fragment',
  sha256: 'edb86aaaa16ec601d1816765940cdfa37d761e3e557b9e5c2ba37d642fbc216f',
});
const bilingual = (en, uk) => ({ en, uk });
const reviewedImage = (assets, image, label) => {
  const asset = assets.find((item) => item.id === image.assetId);
  required(
    asset?.approved === true && asset.publication === 'public' && asset.sha256 === image.sha256,
    `${label} exploration needs its exact reviewed image.`,
  );
};

/** Authored mission exploration, independent of the later six-card finale.
 * This changes only an earned presentation, never arcade or learning evidence. */
export function createCurriculumMissionExplorations(missionId, assets) {
  if (missionId === 'fpv-meet-aircraft-01') {
    reviewedImage(assets, FRAME_IMAGE, 'The Frame');
    return [createFrameExploration()];
  }
  if (missionId === 'ukraine-threads-01') {
    reviewedImage(assets, TEXTILE_IMAGE, 'The museum textile');
    return [createTextileExploration()];
  }
  return [];
}

function createFrameExploration() {
  return validateExplorationPayload({
    id: 'fpv-meet-aircraft-01-structure-exploration',
    type: 'exploration',
    locales: bilingual(
      {
        title: 'Explore the supporting frame',
        intro:
          'Choose a numbered point or a label to inspect the centre, an arm and an empty motor position. Compare two explanations and try the optional prediction. Nothing here needs a timer or changes your arcade result.',
      },
      {
        title: 'Дослідіть опорну раму',
        intro:
          'Виберіть пронумеровану точку або підпис, щоб розглянути центр, промінь і вільне місце двигуна. Порівняйте два пояснення та спробуйте необов’язковий прогноз. Тут немає таймера, і ваш аркадний результат не змінюється.',
      },
    ),
    recipe: {
      id: 'inspect-image-atlas',
      revision: 1,
      diagram: {
        asset: FRAME_IMAGE,
        locales: bilingual(
          {
            alt: 'Original illustrated bare X-shaped frame on a museum worktable. Point 1 marks the central plates, point 2 the near-left arm, and point 3 the empty near-right motor position. No motors, propellers or connected electronics are shown.',
            caption:
              'Fictional civilian display. The points describe structural roles in this illustration, not a product drawing, drilling template, assembly procedure or proof of real-world compatibility.',
          },
          {
            alt: 'Оригінальна ілюстрація порожньої X-подібної рами на музейному столі. Точка 1 позначає центральні пластини, точка 2 — ближній лівий промінь, точка 3 — вільне місце двигуна праворуч попереду. Двигунів, пропелерів і підключеної електроніки немає.',
            caption:
              'Вигадана цивільна експозиція. Точки пояснюють конструктивні ролі на ілюстрації, а не креслення виробу, шаблон свердління, порядок складання чи підтвердження сумісності реальних деталей.',
          },
        ),
        hotspots: [
          { cardId: 'centre', x: 0.484, y: 0.475 },
          { cardId: 'arm', x: 0.286, y: 0.571 },
          { cardId: 'motor-position', x: 0.737, y: 0.672 },
        ],
      },
      cards: [
        {
          id: 'centre',
          sourceIds: ['fc'],
          locales: bilingual(
            {
              title: 'Central plates · supporting space',
              body: 'The stacked plates form the centre of this illustrated frame. They provide structure around space that can carry other components. Supporting a component is different from doing its job: a separate flight controller interprets sensor information and calculates commands.',
              sourceNote:
                'The plate description is an observation of the original game illustration. Betaflight explains the separate flight-controller role; it does not document this fictional frame or its dimensions.',
            },
            {
              title: 'Центральні пластини · опорний простір',
              body: 'Пластини одна над одною утворюють центр зображеної рами. Вони формують конструкцію навколо простору для інших компонентів. Тримати компонент — не те саме, що виконувати його роботу: окремий польотний контролер опрацьовує дані датчиків і обчислює команди.',
              sourceNote:
                'Опис пластин — спостереження за оригінальною ігровою ілюстрацією. Betaflight пояснює окрему роль польотного контролера, але не описує цю вигадану раму чи її розміри.',
            },
          ),
        },
        {
          id: 'arm',
          sourceIds: ['nasa'],
          locales: bilingual(
            {
              title: 'Arm · reaching an outer position',
              body: 'Follow the near-left arm from the centre toward its outer end. In this X-shaped illustration, the four arms spread the four motor positions around the body. An arm is a support; the rotating propeller has the different role of producing aerodynamic force.',
              sourceNote:
                'This arm is identified from the illustration. NASA explains quadcopter rotary-flight forces; the artwork is not a measured NASA aircraft design.',
            },
            {
              title: 'Промінь · шлях до зовнішньої точки',
              body: 'Простежте ближній лівий промінь від центру до його зовнішнього кінця. На цій X-подібній ілюстрації чотири промені розносять місця двигунів навколо корпусу. Промінь є опорою; пропелер під час обертання виконує іншу роботу — створює аеродинамічну силу.',
              sourceNote:
                'Цей промінь визначено за ілюстрацією. NASA пояснює сили роторного польоту квадрокоптера; зображення не є кресленням апарата NASA з вимірами.',
            },
          ),
        },
        {
          id: 'motor-position',
          sourceIds: ['nasa'],
          locales: bilingual(
            {
              title: 'Empty motor position · support is not motion',
              body: 'The widened end of the near-right arm is drawn as a place to support a motor. It is empty: seeing a mount is not the same as seeing a motor or propeller. The decorative holes do not establish a usable pattern, screw size or compatibility with a real part.',
              sourceNote:
                'The mount label interprets this original illustration only. NASA supplies general quadcopter context, not mounting specifications for this depicted object.',
            },
            {
              title: 'Вільне місце двигуна · опора не є рухом',
              body: 'Розширений кінець ближнього правого променя зображено як місце для опори двигуна. Воно порожнє: бачити кріплення — не те саме, що бачити двигун або пропелер. Декоративні отвори не визначають придатної схеми, розміру гвинта чи сумісності з реальною деталлю.',
              sourceNote:
                'Підпис місця кріплення тлумачить лише цю оригінальну ілюстрацію. NASA надає загальний контекст про квадрокоптери, а не технічні вимоги до кріплення цього зображеного предмета.',
            },
          ),
        },
      ],
      predictions: [
        {
          id: 'support-or-command',
          cardIds: ['centre', 'arm'],
          expectedChoiceId: 'support',
          locales: bilingual(
            {
              prompt:
                'A new exhibit label says “keeps components in position relative to one another.” Does it describe the frame’s structural role or the flight controller’s information-processing role?',
              explanation:
                'Keeping parts in position describes structure. Reading sensor information and calculating commands describes the flight controller. One role cannot substitute for the other.',
            },
            {
              prompt:
                'Новий підпис каже: «утримує компоненти у певному положенні один відносно одного». Це конструктивна роль рами чи роль польотного контролера в опрацюванні інформації?',
              explanation:
                'Утримання деталей у певному положенні описує конструкцію. Читання даних датчиків і обчислення команд описує польотний контролер. Одна роль не замінює іншу.',
            },
          ),
          choices: [
            {
              id: 'support',
              locales: bilingual(
                {
                  label: 'Frame · structural support',
                  feedback: 'Yes. The label describes what the supporting frame does.',
                },
                {
                  label: 'Рама · конструктивна опора',
                  feedback: 'Так. Підпис описує роботу опорної рами.',
                },
              ),
            },
            {
              id: 'controller',
              locales: bilingual(
                {
                  label: 'Flight controller · information processing',
                  feedback:
                    'Compare the verbs. Processing sensor information is different from holding parts in position.',
                },
                {
                  label: 'Польотний контролер · опрацювання інформації',
                  feedback:
                    'Порівняйте дії. Опрацьовувати дані датчиків — не те саме, що утримувати деталі в певному положенні.',
                },
              ),
            },
          ],
        },
      ],
      sources: ['nasa', 'fc'].map((id) => ({ id, ...CURRICULUM_SOURCES[id] })),
    },
  });
}

// Points refer to the uncropped 1200 × 610 museum photograph, not the game's
// fictional textile artwork. Keeping the photograph whole preserves context.
function createTextileExploration() {
  return validateExplorationPayload({
    id: 'ukraine-threads-01-object-exploration',
    type: 'exploration',
    locales: bilingual(
      {
        title: 'Look closely · one documented textile',
        intro:
          'Choose a flower, a border or a fold in this museum photograph. Separate an observation you can make from the image from information supplied by the object record. These optional questions do not assess identity or change your arcade result.',
      },
      {
        title: 'Придивіться · один задокументований текстиль',
        intro:
          'Виберіть квітку, облямівку або складку на музейній фотографії. Відокремте спостереження за зображенням від відомостей у записі про предмет. Ці необов’язкові запитання не оцінюють ідентичність і не змінюють аркадний результат.',
      },
    ),
    recipe: {
      id: 'inspect-image-atlas',
      revision: 1,
      diagram: {
        asset: TEXTILE_IMAGE,
        locales: bilingual(
          {
            alt: 'A long embroidered shirt fragment on black. Curling green stems and multicoloured flowers cover the upper band; smaller repeated forms run along the lower border. The right end is folded. Points mark a left flower, the lower border and a right-hand fold.',
            caption:
              'Photograph of a real collection object, not a reconstruction: The Met, Fragment of a shirt, Ukrainian, fourth quarter 18th century, linen, silk and metal; object 2009.300.2715. Brooklyn Museum Costume Collection; gift of the Brooklyn Museum, 2009, following the 1931 gift from Mrs. Edward S. Harkness in memory of Elizabeth Greenman Stillman. Public-domain image.',
          },
          {
            alt: 'Довгий вишитий фрагмент сорочки на чорному тлі. У верхній смузі — вигнуті зелені стебла й різнокольорові квіти; внизу — дрібніші повторювані форми. Правий кінець складено. Точки позначають квітку ліворуч, нижню облямівку й складку праворуч.',
            caption:
              'Фотографія реального музейного предмета, не реконструкція: The Met, «Фрагмент сорочки», українська культура, остання чверть XVIII століття, льон, шовк і метал; номер 2009.300.2715. Колекція костюма Бруклінського музею; дар Бруклінського музею 2009 року, первісний дар пані Едвард С. Гаркнесс 1931 року на згадку про Елізабет Ґрінмен Стіллман. Зображення в суспільному надбанні.',
          },
        ),
        hotspots: [
          { cardId: 'flower', x: 0.196, y: 0.328 },
          { cardId: 'border', x: 0.261, y: 0.729 },
          { cardId: 'fold', x: 0.746, y: 0.482 },
        ],
      },
      cards: [
        {
          id: 'flower',
          sourceIds: ['met-object'],
          locales: bilingual(
            {
              title: 'Flower · visible form, open meaning',
              body: 'Look at the rounded centre and the surrounding coloured lobes. Calling this a flower-like form describes what the photograph shows. The record identifies this particular object as Ukrainian; it does not give this shape one universal meaning or identify its maker.',
              sourceNote:
                'The shape description is an observation of the museum photograph. Cultural attribution comes from The Met’s record for object 2009.300.2715. Neither source establishes a symbol shared by every Ukrainian region.',
            },
            {
              title: 'Квітка · видима форма, відкрите значення',
              body: 'Розгляньте округлу середину й кольорові пелюсткоподібні частини навколо. Назвати цю форму схожою на квітку — описати те, що видно на фотографії. Запис визначає саме цей предмет як український, але не надає формі єдиного універсального значення й не називає автора.',
              sourceNote:
                'Опис форми — спостереження за музейною фотографією. Культурна атрибуція походить із запису The Met про предмет 2009.300.2715. Жодне з цих джерел не встановлює символу, спільного для всіх регіонів України.',
            },
          ),
        },
        {
          id: 'border',
          sourceIds: ['met-object'],
          locales: bilingual(
            {
              title: 'Lower border · compare scale and spacing',
              body: 'Follow the smaller repeated forms beneath the long horizontal line, then compare them with the larger flowers above. Size, spacing and colour can be observed here. The listed materials—linen, silk and metal—come from the museum record, not from identifying fibres by colour on a screen.',
              sourceNote:
                'The Met lists the object’s materials and dates it to the fourth quarter of the eighteenth century. These are catalogue statements for this object, not facts that the photograph alone can prove.',
            },
            {
              title: 'Нижня облямівка · порівняйте масштаб та інтервали',
              body: 'Простежте дрібніші повторювані форми під довгою горизонтальною лінією й порівняйте їх із більшими квітами вгорі. Тут можна спостерігати розмір, інтервали та колір. Перелік матеріалів — льон, шовк і метал — походить із музейного запису, а не з визначення волокон за кольором на екрані.',
              sourceNote:
                'The Met наводить матеріали предмета й датує його останньою чвертю XVIII століття. Це твердження каталогу про цей предмет, а не факти, які сама фотографія здатна довести.',
            },
          ),
        },
        {
          id: 'fold',
          sourceIds: ['met-object', 'met-open-access'],
          locales: bilingual(
            {
              title: 'Right fold · notice what is hidden',
              body: 'The cloth turns into folds on the right; some decoration disappears behind the overlap. A photograph shows this arrangement and viewpoint, not every surface or a complete garment. Keep the object title “Fragment of a shirt” when sharing it, and follow the record before making a more specific claim.',
              sourceNote:
                'The public-domain photograph is provided through The Met’s Open Access programme. Credit the museum and object number even when reusing it freely; a reuse licence does not supply missing evidence about maker, region or meaning.',
            },
            {
              title: 'Складка праворуч · помітьте приховане',
              body: 'Праворуч тканина утворює складки, і частина оздоблення зникає за перекриттям. Фотографія показує це розташування з певного ракурсу, а не всі поверхні чи цілу сорочку. Поширюючи зображення, зберігайте назву «Фрагмент сорочки» й перевіряйте запис перед конкретнішим твердженням.',
              sourceNote:
                'Фотографія в суспільному надбанні доступна через програму Open Access музею The Met. Навіть за вільного використання зазначайте музей і номер предмета: дозвіл на повторне використання не додає відсутніх доказів про автора, регіон чи значення.',
            },
          ),
        },
      ],
      predictions: [
        {
          id: 'observation-or-record',
          cardIds: ['border', 'fold'],
          expectedChoiceId: 'record',
          locales: bilingual(
            {
              prompt:
                'A label dates this object to the fourth quarter of the eighteenth century. Where does that statement come from?',
              explanation:
                'The date is supplied by the museum’s object record. Looking at colour, flowers or folds alone does not establish the date. Keep that source attached to the label.',
            },
            {
              prompt:
                'Підпис датує цей предмет останньою чвертю XVIII століття. Звідки походить це твердження?',
              explanation:
                'Дату наводить музейний запис про предмет. Самі колір, квіти чи складки не встановлюють дату. Зберігайте посилання на це джерело поруч із підписом.',
            },
          ),
          choices: [
            {
              id: 'record',
              locales: bilingual(
                {
                  label: 'The museum record',
                  feedback:
                    'Yes. This is documented catalogue information about the particular object.',
                },
                {
                  label: 'Із музейного запису',
                  feedback: 'Так. Це задокументовані відомості каталогу про конкретний предмет.',
                },
              ),
            },
            {
              id: 'image-only',
              locales: bilingual(
                {
                  label: 'The colours in the photograph alone',
                  feedback:
                    'Colour is visible, but it does not establish this date. Compare the object record with what you can directly observe.',
                },
                {
                  label: 'Лише з кольорів на фотографії',
                  feedback:
                    'Колір видно, але він не встановлює цієї дати. Порівняйте запис про предмет із тим, що спостерігаєте безпосередньо.',
                },
              ),
            },
          ],
        },
      ],
      sources: [
        {
          id: 'met-object',
          title: 'The Met · Fragment of a shirt · object 2009.300.2715',
          url: 'https://www.metmuseum.org/art/collection/search/157573',
        },
        {
          id: 'met-open-access',
          title: 'The Met · Open Access',
          url: 'https://www.metmuseum.org/hubs/open-access',
        },
      ],
    },
  });
}
