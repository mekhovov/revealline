import { freezeDesign } from '../content-design/catalogs.mjs';
import { CURRICULUM_SHOWCASE_LESSONS } from './curriculum-showcase-lessons.mjs';

// Six distinct teaching beats accompany existing missions; no new simulation or
// completion authority. Later fixtures are available without passing earlier ones.
export const CURRICULUM_SHOWCASE_STEPS = freezeDesign({
  'social-drone-community-connections': [
    [
      'Example: a useful brief',
      'Приклад: корисний задум',
      '“Help on Saturday” leaves the result unclear. “Prepare three explanation cards for Saturday’s library visitors” names an audience and a result. Next, use a counted delivery to practise the same habit: write what the evidence actually establishes.',
      '«Допоможіть у суботу» не визначає результату. «Підготуйте три картки пояснень для суботніх відвідувачів бібліотеки» називає аудиторію й результат. Далі потренуйте цю звичку на підрахованій доставці: записуйте те, що справді підтверджено.',
    ],
    [
      'Try: update the count board',
      'Спробуйте: оновіть дошку обліку',
      'Open the optional workbench and use two counted boxes to update received, missing and public status. A wrong choice explains the mismatch; change it and commit again. The new quantities differ from the worked example.',
      'Відкрийте додаткову вправу й за двома перерахованими коробками оновіть отримане, відсутнє та публічний стан. Хибний вибір пояснить невідповідність; змініть його й підтвердьте знову. Кількості відрізняються від прикладу.',
    ],
    [
      'Combine: count and handoff',
      'Поєднайте: підрахунок і передачу справ',
      'A note can be numerically right but still leave nobody responsible for the next check. Keep three parts together: observed count, unresolved item and an accepted next action. “We suggested Taras” is not the same as “Taras agreed”.',
      'Числа можуть бути правильними, але наступну перевірку нікому виконати. Поєднайте три частини: фактичний підрахунок, невирішене питання й узгоджену наступну дію. «Ми запропонували Тараса» не означає «Тарас погодився».',
    ],
    [
      'Apply elsewhere: the invitation',
      'Застосуйте інакше: запрошення',
      'Use the optional workbench to prepare a different library invitation. A precise place and time help someone act; an unverified access promise should remain a question to resolve, not an invented facility.',
      'У додатковій вправі підготуйте інше бібліотечне запрошення. Точні місце й час допомагають діяти; неперевірений доступ має залишитися питанням для уточнення, а не вигаданою зручністю.',
    ],
    [
      'Explain: what the next reader needs',
      'Поясніть: що потрібно наступному читачеві',
      'Describe this fictional room for a visitor trying to reach the desk, then for someone studying its decorations. Different questions need different details. Keep the useful route information before decorative description.',
      'Опишіть вигадану кімнату для відвідувача, який шукає стійку, а потім для людини, яка вивчає оздоблення. Різні запитання потребують різних деталей. Корисні відомості про шлях поставте перед описом прикрас.',
    ],
    [
      'Resolve: publish the correction',
      'Завершіть: оприлюдніть виправлення',
      'The final optional workbench combines new delivery evidence with an accepted handoff and a public correction. Six wins still earn the standard finale; this separate verified application earns the checked noticeboard.',
      'Фінальна додаткова вправа поєднує нові дані доставки, узгоджену передачу справ і публічне виправлення. Шість перемог і далі відкривають звичайний фінал; окреме перевірене застосування дає перевірену дошку.',
    ],
  ],
  'victory-drones-ideas-understanding': [
    [
      'Example: observation before explanation',
      'Приклад: спостереження перед поясненням',
      '“The cart travelled farther on A” reports an observation. “A caused less resistance” proposes an explanation. Before accepting it, ask whether the cart, starting position or surface changed together. Keep the two sentences on separate evidence and explanation cards.',
      '«Візок проїхав далі на A» повідомляє спостереження. «A створила менший опір» пропонує пояснення. Перш ніж прийняти його, перевірте, чи не змінили разом візок, стартове положення й поверхню. Розмістіть речення на окремих картках доказу й пояснення.',
    ],
    [
      'Try: who acts on what?',
      'Спробуйте: хто на що діє?',
      'The optional workbench moves from a hand and cart to a foot and floor. Label the object receiving each force. The two members of an interaction pair act on different objects; two arrows on one object answer another question.',
      'Додаткова вправа переносить приклад із руки й візка на стопу й підлогу. Підпишіть тіло, що отримує кожну силу. Члени пари взаємодії діють на різні тіла; дві стрілки на одному тілі відповідають на інше запитання.',
    ],
    [
      'Combine: balance is not a speed reading',
      'Поєднайте: баланс не є виміром швидкості',
      'A cart at rest and a cart moving steadily can both have zero net force in a simplified model. To distinguish them you need motion observations, not just balanced force arrows. Name the missing observation before making a claim.',
      'І нерухомий візок, і візок у рівномірному русі можуть мати нульову рівнодійну в спрощеній моделі. Розрізнити їх допомагають спостереження руху, а не лише врівноважені стрілки сил. Назвіть відсутнє спостереження перед висновком.',
    ],
    [
      'Apply elsewhere: opposing directions',
      'Застосуйте інакше: протилежні напрямки',
      'In the optional workbench, combine eastward and westward forces on one cart. Separate net force, acceleration and unspecified current velocity. This fixture changes the numbers and the question instead of repeating the earlier labels.',
      'У додатковій вправі поєднайте сили на схід і захід на одному візку. Розрізніть рівнодійну, прискорення й незадану поточну швидкість. Цей приклад змінює числа та запитання, а не повторює попередні підписи.',
    ],
    [
      'Explain: keep the comparison fair',
      'Поясніть: збережіть коректність порівняння',
      'Compare “change only the mat” with “change the mat and cart together”. The second may produce a difference, but it cannot isolate the mat’s contribution. Predict which records would let another group repeat the comparison.',
      'Порівняйте «змінити лише килимок» і «змінити килимок та візок разом». Другий варіант може дати різницю, але не виокремлює внеску килимка. Передбачте, які записи дадуть іншій групі повторити порівняння.',
    ],
    [
      'Resolve: a new comparison notebook',
      'Завершіть: новий зошит порівняння',
      'Use the final optional workbench to select a comparison, read repeated measurements and limit the conclusion. The six-win finale stays separate; the verified application adds a notebook that records both the result and what was not tested.',
      'У фінальній додатковій вправі оберіть порівняння, прочитайте повторні вимірювання й обмежте висновок. Фінал за шість перемог залишається окремим; перевірене застосування додає зошит із результатом і тим, чого не перевіряли.',
    ],
  ],
  'ukraine-threads': [
    [
      'Example: three kinds of label',
      'Приклад: три типи підписів',
      'For the museum fragment, “small repeated motifs” is an observation; its date and listed materials come from the record; a precise maker remains unestablished here. Keep those three kinds of statement separate as you inspect the image.',
      'Для музейного фрагмента «дрібні повторювані мотиви» — спостереження; дата й матеріали походять із запису; конкретного майстра тут не встановлено. Розрізняйте ці три типи тверджень під час огляду.',
    ],
    [
      'Try: label only the evidence',
      'Спробуйте: підпишіть лише підтверджене',
      'The optional workbench asks which facts require the object record and which are visible. A similar-looking stitch is not enough to name a technique. Use an explicit unknown instead of filling a gap with a confident guess.',
      'Додаткова вправа питає, які факти потребують запису предмета, а які видно. Схожого стібка недостатньо, щоб назвати техніку. Позначте невідоме, а не заповнюйте прогалину впевненим здогадом.',
    ],
    [
      'Compare: light changes what stands out',
      'Порівняйте: світло змінює помітність',
      'Compare the three original illustrated white-thread studies. Shadows can make surface relief easier to notice. These are matched illustrations with small differences, not measured relighting of one historic textile; they cannot establish its real stitch structure.',
      'Порівняйте три оригінальні ілюстровані етюди білої вишивки. Тіні можуть зробити рельєф помітнішим. Це узгоджені ілюстрації з невеликими відмінностями, а не виміряне переосвітлення історичного текстилю; вони не встановлюють його справжньої будови стібка.',
    ],
    [
      'Apply elsewhere: a second fragment',
      'Застосуйте інакше: другий фрагмент',
      'Inspect the newly supplied Met object 2009.300.2713 and compare it with 2009.300.2715 in the optional workbench. Retain their separate identities even where the recorded date and materials agree. Two objects cannot stand for every regional tradition.',
      'Розгляньте новий предмет Метрополітен 2009.300.2713 й порівняйте його з 2009.300.2715 у додатковій вправі. Збережіть окрему ідентичність, навіть коли записані дата й матеріали збігаються. Два предмети не представляють усі регіональні традиції.',
    ],
    [
      'Explain: an object’s story needs a source',
      'Поясніть: історія предмета потребує джерела',
      'When a label describes how a textile was used, ask whether that comes from the individual record, a bearer’s account or a general comparison. Keep the source attached to the claim; appearance alone cannot identify every occasion or meaning.',
      'Коли підпис описує використання тканини, запитайте, чи це дані окремого запису, розповідь носія традиції або загальне порівняння. Пов’язуйте твердження з джерелом; вигляд сам по собі не визначає всіх нагод чи значень.',
    ],
    [
      'Resolve: curate two honest labels',
      'Завершіть: укладіть два чесні підписи',
      'The existing final workbench changes the evidence again: a dated artwork and an original game illustration. Classify them and choose a justified claim. Six wins still unlock the textile finale; the optional verified lesson retains its separate curator reward.',
      'Наявна фінальна вправа знову змінює докази: датований твір мистецтва й оригінальна ігрова ілюстрація. Класифікуйте їх та оберіть обґрунтоване твердження. Шість перемог і далі відкривають текстильний фінал; додаткова перевірена вправа зберігає окрему нагороду куратора.',
    ],
  ],
  'fpv-meet-aircraft': [
    [
      'Example: structure has a role',
      'Приклад: конструкція має роль',
      'Select a frame hotspot and connect its visible structure to support or spacing. That is a role explanation, not a complete assembly plan. In later discoveries, use the same question—what does this part do?—without assuming that a similar shape proves compatibility.',
      'Оберіть точку на рамі й пов’яжіть видиму конструкцію з опорою або відстанню між деталями. Це пояснення ролі, а не повний план складання. Далі ставте те саме запитання — що робить деталь? — не вважаючи схожу форму доказом сумісності.',
    ],
    [
      'Try: motor is not propeller',
      'Спробуйте: двигун — не пропелер',
      'Watch or read the motion study, then open the optional workbench. Match motor and propeller roles to different display cards. Its answer concerns component function, not a real mounting, rotation direction or powered test.',
      'Перегляньте або прочитайте етюд руху, а потім відкрийте додаткову вправу. Зіставте ролі двигуна й пропелера з різними картками. Відповідь стосується функції компонента, а не реального кріплення, напрямку обертання чи перевірки під живленням.',
    ],
    [
      'Combine: a command is not its energy supply',
      'Поєднайте: команда — не джерело енергії',
      'The ESC acts on motor commands and regulates motor power. Keep “information telling a component what to do” separate from “energy enabling it to work”. A functional explanation does not specify the wiring or ratings of a particular device.',
      'ESC виконує команди двигуна й регулює його живлення. Розрізняйте «інформацію про потрібну дію» та «енергію для роботи». Пояснення функції не задає проводки чи характеристик конкретного пристрою.',
    ],
    [
      'Apply elsewhere: three boxes',
      'Застосуйте інакше: три блоки',
      'The optional workbench uses a new diagram: one box calculates, one regulates motor power, one supplies energy. Explain the role before choosing the component label. Real products may combine roles even though this diagram separates them.',
      'Додаткова вправа містить нову схему: один блок обчислює, інший регулює живлення двигуна, третій надає енергію. Поясніть роль перед вибором назви. Реальні вироби можуть поєднувати ролі, хоча схема їх розділяє.',
    ],
    [
      'Explain: two information paths',
      'Поясніть: два інформаційні шляхи',
      'A spectator can receive a camera view without issuing a movement command. Compare the control path with the camera/video path and explain what information each carries. Seeing a picture alone does not establish control or a working radio link.',
      'Глядач може отримувати зображення камери, не надсилаючи команд руху. Порівняйте шлях керування з камерою та відеоканалом і поясніть інформацію кожного. Саме зображення не підтверджує керування чи справності радіоканалу.',
    ],
    [
      'Resolve: repair the exhibit labels',
      'Завершіть: виправте підписи експозиції',
      'Use the existing final workbench to separate pilot control, camera video and motor commands in new visitor observations. Six wins still earn the aircraft atlas; the optional verified label exercise retains its independent annotations and cosmetic.',
      'У наявній фінальній вправі розрізніть керування пілота, відео камери й команди двигуна в нових спостереженнях відвідувачів. Шість перемог і далі дають атлас апарата; додаткова перевірена вправа зберігає окремі примітки й вигляд персонажа.',
    ],
  ],
});

export function createCurriculumShowcaseContent(missionId) {
  const campaignId = missionId.replace(/-\d\d$/, '');
  const step = CURRICULUM_SHOWCASE_STEPS[campaignId]?.[Number(missionId.slice(-2)) - 1];
  if (!step) return [];
  const sources = [
    ...new Map(
      CURRICULUM_SHOWCASE_LESSONS.filter((lesson) => lesson.campaignId === campaignId)
        .flatMap((lesson) => lesson.sources)
        .map((source) => [source.url, source]),
    ).values(),
  ];
  return [
    {
      id: `${missionId}-learning-journey`,
      type: 'knowledge',
      locales: {
        en: { title: step[0], paragraphs: [step[2]], sources },
        uk: { title: step[1], paragraphs: [step[3]], sources },
      },
    },
  ];
}
