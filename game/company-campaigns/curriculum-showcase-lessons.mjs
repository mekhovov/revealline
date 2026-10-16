import { validateCompanyLessons } from './learning.mjs';

const writing = {
  title: 'W3C WAI — Writing for Web Accessibility',
  url: 'https://www.w3.org/WAI/tips/writing/',
};
const motion = {
  title: 'NASA Glenn — Newton’s Laws of Motion',
  url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/newtons-laws-of-motion/',
};
const experiment = {
  title: 'NASA Space Place — Scientific method',
  url: 'https://spaceplace.nasa.gov/review/science-fair/scientific-method.html',
};
const textile = (id) => ({
  title: `The Met — Ukrainian shirt fragment, object ${id}`,
  url: `https://www.metmuseum.org/art/collection/search/${id}`,
});
const controller = {
  title: 'Betaflight — Flight-controller roles',
  url: 'https://betaflight.com/docs/wiki/getting-started',
};
const propeller = {
  title: 'NASA Glenn — Propeller propulsion',
  url: 'https://www.grc.nasa.gov/www/k-12/airplane/propeller.html',
};
const esc = {
  title: 'Betaflight — ESC firmware',
  url: 'https://betaflight.com/docs/wiki/getting-started/hardware/esc-firmware',
};

// These fixtures are original civilian examples. Source records support the
// concepts, not a claim that the fictional event or device actually existed.
const record = (id, title, ...lines) => ({ id, title, lines });
const field = (id, label, expected, explanation, ...options) => ({
  id,
  label,
  expected,
  explanation,
  options,
});
function lesson(campaignId, number, title, brief, records, fields, success, sources) {
  const project = (language) => ({
    title: title[language],
    role: ['Exhibit participant', 'Учасник виставки'][language],
    brief: brief[language],
    notice: [
      'An original untimed learning fixture. Sources explain the concepts; this is not an account of a real community event or a practical qualification.',
      'Оригінальна навчальна вправа без таймера. Джерела пояснюють поняття; це не звіт про справжній захід спільноти й не підтвердження практичної кваліфікації.',
    ][language],
    records: records.map((item) => ({
      id: item.id,
      title: item.title[language],
      lines: item.lines.map((line) => line[language]),
    })),
    fields: fields.map((item) => ({
      id: item.id,
      label: item.label[language],
      explanation: item.explanation[language],
      ...(language === 0 ? { expected: item.expected } : {}),
      options: item.options.map(([value, ...labels]) => ({ value, label: labels[language] })),
    })),
    success: success[language],
  });
  return {
    format: 'revealline-learning-lesson.v1',
    id: `${campaignId}-0${number}-lesson`,
    revision: '1',
    fixtureRevision: '1',
    campaignId,
    missionId: `${campaignId}-0${number}`,
    kind: 'practice',
    sourceReviewedAt: '2026-09-28',
    sources,
    ...project(0),
    locales: { uk: project(1) },
  };
}

export const CURRICULUM_SHOWCASE_LESSONS = validateCompanyLessons([
  lesson(
    'social-drone-community-connections',
    2,
    ['Update the count board', 'Оновіть дошку обліку'],
    [
      'Use the worked example, then reconcile a different fictional booklet delivery. Commit a board that tells the next volunteer what is actually here.',
      'Розгляньте приклад, а потім звірте іншу вигадану доставку буклетів. Підтвердьте дошку, яка показує наступному волонтеру фактичну наявність.',
    ],
    [
      record(
        'example',
        ['Worked example', 'Розібраний приклад'],
        [
          'Expected 12; counted 8. The board reads “8 received; 4 missing”, because 12 − 8 = 4.',
          'Очікували 12, нарахували 8. Дошка повідомляє: «8 отримано; 4 бракує», бо 12 − 8 = 4.',
        ],
      ),
      record(
        'delivery',
        ['Your new delivery', 'Нова доставка'],
        [
          'This table expects 20 booklets. Box A contains 7 and box B contains 5. Both have been counted; no other box has arrived.',
          'Для цього столу очікують 20 буклетів. У коробці A — 7, у B — 5. Обидві перераховано; інших коробок не доставлено.',
        ],
      ),
    ],
    [
      field(
        'received',
        ['Received', 'Отримано'],
        '12',
        [
          'Count the two observed boxes: 7 + 5 = 12. An expected quantity is not a receipt.',
          'Порахуйте дві наявні коробки: 7 + 5 = 12. Очікувана кількість не є отриманою.',
        ],
        ['20', '20', '20'],
        ['12', '12', '12'],
        ['7', '7', '7'],
      ),
      field(
        'missing',
        ['Still missing', 'Ще бракує'],
        '8',
        [
          'Subtract the observed 12 from the expected 20. Eight remain unreceived.',
          'Від очікуваних 20 відніміть наявні 12. Вісім ще не отримано.',
        ],
        ['8', '8', '8'],
        ['0', '0', '0'],
        ['15', '15', '15'],
      ),
      field(
        'status',
        ['Public board status', 'Стан на дошці'],
        'partial',
        [
          'The board should preserve the difference between received and expected so the next person does not promise unavailable copies.',
          'Дошка має розрізняти отримане й очікуване, щоб наступна людина не обіцяла відсутні примірники.',
        ],
        ['ready', 'All 20 ready', 'Усі 20 готові'],
        ['partial', '12 received; 8 still expected', '12 отримано; ще 8 очікуємо'],
      ),
    ],
    [
      'Board updated: 12 received, 8 missing. The next volunteer can act on an observed count rather than an assumed delivery.',
      'Дошку оновлено: 12 отримано, 8 бракує. Наступний волонтер бачить фактичний підрахунок, а не припущення про доставку.',
    ],
    [writing],
  ),
  lesson(
    'social-drone-community-connections',
    4,
    ['Make the invitation usable', 'Зробіть запрошення зрозумілим'],
    [
      'Transfer the earlier idea of an accurate handoff to a new library invitation. Choose only directions and arrangements confirmed in the record.',
      'Перенесіть ідею точної передачі відомостей у нове бібліотечне запрошення. Оберіть лише підтверджені в записі вказівки й домовленості.',
    ],
    [
      record(
        'example',
        ['Earlier example', 'Попередній приклад'],
        [
          '“At the green door” relies on one colour cue. A room name and nearby landmark make that instruction more useful.',
          '«Біля зелених дверей» залежить від кольору. Назва кімнати й орієнтир роблять вказівку кориснішою.',
        ],
      ),
      record(
        'event',
        ['Confirmed arrangements', 'Підтверджені домовленості'],
        [
          'The fictional event is Saturday at 14:00, Reading Room, ground floor beside the main desk. Visitors may watch or ask questions. No step-free access information has been supplied.',
          'Вигаданий захід: субота, 14:00, читальна зала на першому поверсі біля головної стійки. Можна спостерігати або ставити запитання. Відомостей про безсходинковий доступ немає.',
        ],
      ),
    ],
    [
      field(
        'where',
        ['Where', 'Де'],
        'landmark',
        [
          'Use the confirmed room and landmark; keep colour only as an additional cue if verified.',
          'Використайте підтверджені назву й орієнтир; колір може бути лише додатковою перевіреною підказкою.',
        ],
        ['colour', 'Find the green door', 'Знайдіть зелені двері'],
        [
          'landmark',
          'Reading Room, ground floor, beside the main desk',
          'Читальна зала, перший поверх, біля головної стійки',
        ],
      ),
      field(
        'when',
        ['When', 'Коли'],
        'confirmed',
        [
          'The supplied record confirms Saturday at 14:00. Do not replace it with a vague time.',
          'Запис підтверджує суботу, 14:00. Не замінюйте це нечітким часом.',
        ],
        ['vague', 'Sometime this weekend', 'Якось на вихідних'],
        ['confirmed', 'Saturday, 14:00', 'Субота, 14:00'],
      ),
      field(
        'access',
        ['Access information', 'Відомості про доступ'],
        'ask',
        [
          'An inviting message must not invent facilities. Mark the missing information and seek confirmation.',
          'Привітне повідомлення не має вигадувати зручності. Позначте прогалину й попросіть підтвердження.',
        ],
        ['promise', 'Step-free access guaranteed', 'Безсходинковий доступ гарантовано'],
        [
          'ask',
          'Access details need confirmation from the venue',
          'Деталі доступу треба уточнити в закладу',
        ],
      ),
    ],
    [
      'Invitation prepared with a precise place and time, and an honest gap for access information. The unresolved item is visible instead of becoming a false promise.',
      'Запрошення містить точні місце й час та чесно позначену прогалину щодо доступу. Невирішене питання видно, а не перетворено на хибну обіцянку.',
    ],
    [writing],
  ),
  lesson(
    'social-drone-community-connections',
    6,
    ['Publish an honest update', 'Оприлюдніть точне оновлення'],
    [
      'Combine counting, correction and handoff in a new fictional noticeboard. The old board is already visible; prepare its replacement from the evidence.',
      'Поєднайте підрахунок, виправлення й передачу справ у новій вигаданій дошці. Старе оголошення вже висить; підготуйте заміну за доказами.',
    ],
    [
      record(
        'count',
        ['Delivery log', 'Запис доставки'],
        [
          'The old notice says “12 available”. Eight arrived first, then two more were counted. Two promised copies have not arrived.',
          'Старе оголошення каже: «12 у наявності». Спочатку надійшло вісім, потім нарахували ще два. Два обіцяні примірники ще не прибули.',
        ],
      ),
      record(
        'handoff',
        ['Accepted next action', 'Узгоджена наступна дія'],
        [
          'Marta agreed to check the remaining delivery tomorrow and update this same board. Taras was suggested as an owner but has not agreed. Nothing confirms a delivery date.',
          'Марта погодилася завтра перевірити решту доставки й оновити цю саму дошку. Тараса запропонували відповідальним, але він не погоджувався. Дату доставки не підтверджено.',
        ],
      ),
    ],
    [
      field(
        'notice',
        ['Replacement notice', 'Нове оголошення'],
        'accurate',
        [
          'Eight plus two is ten. The unreceived two must remain separate; a check tomorrow is not a delivery promise.',
          'Вісім плюс два — десять. Ще не отримані два лишаються окремо; завтрашня перевірка не є обіцянкою доставки.',
        ],
        ['all', '12 available now', '12 уже в наявності'],
        [
          'accurate',
          '10 available; 2 still expected, date unconfirmed',
          '10 у наявності; ще 2 очікуємо, дату не підтверджено',
        ],
      ),
      field(
        'owner',
        ['Next action', 'Наступна дія'],
        'accepted',
        [
          'An agreed owner and a concrete check make the handoff actionable. A suggested name is not acceptance.',
          'Узгоджений відповідальний і конкретна перевірка роблять передачу дієвою. Запропоноване ім’я не означає згоди.',
        ],
        ['proposed', 'Taras will deliver tomorrow', 'Тарас доставить завтра'],
        [
          'accepted',
          'Marta checks tomorrow and updates this board',
          'Марта перевіряє завтра й оновлює цю дошку',
        ],
      ),
      field(
        'publish',
        ['Where to correct', 'Де виправити'],
        'replace',
        [
          'Replace the inaccurate notice where readers encounter it. A private note leaves the public claim wrong.',
          'Замініть неточне оголошення там, де його читають. Приватна нотатка не виправить публічного твердження.',
        ],
        [
          'private',
          'Keep the old board; save a private note',
          'Лишити стару дошку; зберегти приватну нотатку',
        ],
        [
          'replace',
          'Replace the old public notice with this update',
          'Замінити старе публічне оголошення цим оновленням',
        ],
      ),
    ],
    [
      'The board now reports 10 available and 2 unreceived. Marta’s agreed check is visible, and the inaccurate notice has a clear replacement.',
      'Дошка повідомляє про 10 наявних і 2 неотримані примірники. Видно узгоджену перевірку Марти й чітку заміну неточного оголошення.',
    ],
    [writing],
  ),
  lesson(
    'victory-drones-ideas-understanding',
    2,
    ['Put each force on its object', 'Віднесіть кожну силу до її тіла'],
    [
      'Inspect the worked cart example, then label a new foot-and-floor interaction. Keep interaction pairs separate from a force balance on one object.',
      'Розгляньте приклад із візком, а потім підпишіть нову взаємодію стопи й підлоги. Не плутайте пару взаємодії з балансом сил на одному тілі.',
    ],
    [
      record(
        'example',
        ['Worked interaction', 'Розібрана взаємодія'],
        [
          'A hand pushes a cart; the cart pushes the hand in the opposite direction. The pair acts on two different objects.',
          'Рука штовхає візок; візок штовхає руку в протилежний бік. Пара діє на два різні тіла.',
        ],
      ),
      record(
        'fixture',
        ['New classroom scene', 'Нова навчальна сцена'],
        [
          'A foot presses down on the floor; the floor pushes up on the foot. Separately, Earth pulls a book down while the table supports the book upward.',
          'Стопа тисне на підлогу вниз; підлога штовхає стопу вгору. Окремо Земля притягує книжку вниз, а стіл підтримує її вгору.',
        ],
      ),
    ],
    [
      field(
        'target',
        ['The floor’s upward force acts on…', 'Сила підлоги вгору діє на…'],
        'foot',
        [
          'Name the object receiving this force. The other member of the interaction acts on the floor.',
          'Назвіть тіло, на яке діє ця сила. Інший член пари діє на підлогу.',
        ],
        ['floor', 'The floor', 'Підлогу'],
        ['foot', 'The foot', 'Стопу'],
      ),
      field(
        'pair',
        ['Interaction pair', 'Пара взаємодії'],
        'different',
        [
          'The foot-on-floor and floor-on-foot forces act on different objects. Weight and support both act on the book, so they are not that interaction pair.',
          'Сили стопи на підлогу й підлоги на стопу діють на різні тіла. Вага й опора діють на книжку, тому це не така пара взаємодії.',
        ],
        ['same', 'Earth and table both acting on the book', 'Земля й стіл, що діють на книжку'],
        ['different', 'Foot on floor; floor on foot', 'Стопа на підлогу; підлога на стопу'],
      ),
    ],
    [
      'The arrows now name both actor and recipient. Interaction pairs and forces acting on one object answer different questions.',
      'Стрілки тепер указують і джерело, і одержувача сили. Пари взаємодії та сили на одному тілі відповідають на різні запитання.',
    ],
    [motion],
  ),
  lesson(
    'victory-drones-ideas-understanding',
    4,
    ['Read the direction, not just the number', 'Читайте напрямок, а не лише число'],
    [
      'Apply the earlier force distinction to a new one-dimensional cart record. The diagram gives forces, not the cart’s current velocity.',
      'Застосуйте попереднє розрізнення сил до нового одновимірного запису про візок. Схема задає сили, а не поточну швидкість.',
    ],
    [
      record(
        'example',
        ['Worked balance', 'Розібраний баланс'],
        [
          'Two opposing forces of 2 N on one cart give a zero net force. That alone does not tell us whether the cart is stationary or moving steadily.',
          'Дві протилежні сили по 2 Н на одному візку дають нульову рівнодійну. Це саме по собі не показує, чи він стоїть, чи рухається рівномірно.',
        ],
      ),
      record(
        'new-cart',
        ['Your cart', 'Ваш візок'],
        [
          'In this idealised horizontal model, 5 N acts east and 2 N acts west on the same constant-mass cart. No other horizontal force is included; initial velocity is not given.',
          'В ідеалізованій горизонтальній моделі на той самий візок сталої маси діють 5 Н на схід і 2 Н на захід. Інших горизонтальних сил не враховано; початкову швидкість не задано.',
        ],
      ),
    ],
    [
      field(
        'net',
        ['Net horizontal force', 'Горизонтальна рівнодійна'],
        'east-three',
        [
          'Opposing arrows subtract: 5 − 2 = 3 N toward the larger eastward force.',
          'Протилежні стрілки віднімаються: 5 − 2 = 3 Н у бік більшої сили на схід.',
        ],
        ['east-seven', '7 N east', '7 Н на схід'],
        ['east-three', '3 N east', '3 Н на схід'],
      ),
      field(
        'claim',
        ['What follows?', 'Який висновок?'],
        'acceleration',
        [
          'The force determines acceleration in this model. Without initial velocity, it does not establish the current direction of travel.',
          'Сила визначає прискорення в цій моделі. Без початкової швидкості вона не встановлює поточного напрямку руху.',
        ],
        ['velocity', 'It must already be travelling east', 'Він обов’язково вже рухається на схід'],
        [
          'acceleration',
          'Its acceleration is eastward; its current travel direction is unspecified',
          'Прискорення спрямоване на схід; поточний напрямок руху не задано',
        ],
      ),
    ],
    [
      'The display separates a 3 N eastward force from an unknown current velocity. It reports the model’s result without adding an unsupported motion claim.',
      'Екран розрізняє силу 3 Н на схід і невідому поточну швидкість. Він показує результат моделі без непідтвердженого твердження про рух.',
    ],
    [motion],
  ),
  lesson(
    'victory-drones-ideas-understanding',
    6,
    ['Choose an informative comparison', 'Оберіть змістовне порівняння'],
    [
      'A new classroom team asks whether its two mats change a cart’s travel. Configure a comparison and a conclusion that respect the supplied evidence.',
      'Нова навчальна команда питає, чи два килимки змінюють рух візка. Налаштуйте порівняння й висновок відповідно до наданих доказів.',
    ],
    [
      record(
        'plan',
        ['Two proposed trials', 'Два запропоновані досліди'],
        [
          'Plan A changes the cart, release height and mat together. Plan B keeps the same cart, mass, ramp, release point and measurement method, changing only the mat.',
          'План A одночасно змінює візок, висоту запуску й килимок. План B зберігає візок, масу, похилу площину, місце відпускання й метод вимірювання та змінює лише килимок.',
        ],
      ),
      record(
        'results',
        ['Invented observations', 'Вигадані спостереження'],
        [
          'For this fixture, three matched releases travel 80, 82 and 81 cm on mat A, and 49, 51 and 50 cm on mat B. No other cart, surface or release condition was tested.',
          'У цьому прикладі три однакові запуски дали 80, 82 і 81 см на килимку A та 49, 51 і 50 см на B. Інших візків, поверхонь чи умов запуску не досліджували.',
        ],
      ),
    ],
    [
      field(
        'trial',
        ['Choose the plan', 'Оберіть план'],
        'b',
        [
          'Changing one intended factor makes the comparison interpretable; changing three prevents attributing the difference to the mat alone.',
          'Зміна одного потрібного чинника дає змогу тлумачити порівняння; зміна трьох не дозволяє пов’язати різницю лише з килимком.',
        ],
        ['a', 'Plan A: change cart, height and mat', 'План A: змінити візок, висоту й килимок'],
        [
          'b',
          'Plan B: keep the setup; change the mat',
          'План B: зберегти установку; змінити килимок',
        ],
      ),
      field(
        'conclusion',
        ['Supported conclusion', 'Підтверджений висновок'],
        'bounded',
        [
          'Keep the conclusion tied to these repeated observations and conditions. They do not establish a rule for every vehicle and surface.',
          'Пов’яжіть висновок із цими повторними спостереженнями й умовами. Вони не встановлюють правила для кожного транспортного засобу й поверхні.',
        ],
        [
          'universal',
          'All vehicles always travel farther on every mat like A',
          'Усі транспортні засоби завжди їдуть далі на будь-якому килимку типу A',
        ],
        [
          'bounded',
          'This cart travelled farther on A in these matched trials',
          'Цей візок проїхав далі на A в цих однакових дослідах',
        ],
      ),
      field(
        'next',
        ['A useful next check', 'Корисна наступна перевірка'],
        'repeat',
        [
          'Repeating the same protocol checks consistency. Altering several conditions at once answers a different, confounded question.',
          'Повторення того самого протоколу перевіряє сталість. Одночасна зміна кількох умов створює інше, неоднозначне запитання.',
        ],
        [
          'change-all',
          'Change every condition and call it confirmation',
          'Змінити всі умови й назвати це підтвердженням',
        ],
        [
          'repeat',
          'Repeat matched releases and record the spread',
          'Повторити однакові запуски й записати розкид',
        ],
      ),
    ],
    [
      'The exhibit now shows a controlled comparison, its observed range and a limited conclusion. It keeps explanation separate from evidence and leaves a useful next test.',
      'Виставка показує контрольоване порівняння, спостережений діапазон і обмежений висновок. Пояснення відокремлено від доказів і визначено корисну наступну перевірку.',
    ],
    [experiment, motion],
  ),
  lesson(
    'ukraine-threads',
    2,
    ['Separate seeing from knowing', 'Відокремте побачене від відомого'],
    [
      'Read an example label, then decide which statements can come from a photograph and which need the museum record.',
      'Прочитайте приклад підпису, а потім визначте, які твердження походять із фотографії, а які потребують музейного запису.',
    ],
    [
      record(
        'example',
        ['Label example', 'Приклад підпису'],
        [
          'For Met object 157573, “a row of small motifs” describes a visible feature. Its eighteenth-century date and linen/silk/metal materials come from the museum record.',
          'Для предмета Метрополітен 157573 «ряд дрібних мотивів» описує видиму рису. Датування XVIII століттям і матеріали — льон, шовк, метал — походять із музейного запису.',
        ],
      ),
      record(
        'limits',
        ['What this record does not establish', 'Чого цей запис не встановлює'],
        [
          'This fixture supplies no named maker, precise locality or verified stitch-technique identification. Similar-looking marks in a photograph do not supply those missing facts.',
          'У цьому прикладі немає імені майстра, точної місцевості чи перевіреного визначення техніки стібка. Подібні на вигляд деталі фотографії не додають відсутніх фактів.',
        ],
      ),
    ],
    [
      field(
        'date',
        ['Evidence for the date', 'Доказ датування'],
        'record',
        [
          'The date belongs to the catalogue attribution. A photograph alone does not measure the object’s age.',
          'Дата належить до каталожної атрибуції. Сама фотографія не вимірює віку предмета.',
        ],
        ['look', 'The colours look old', 'Кольори виглядають старими'],
        ['record', 'The museum’s individual object record', 'Окремий музейний запис предмета'],
      ),
      field(
        'technique',
        ['Technique label', 'Підпис техніки'],
        'uncertain',
        [
          'Do not upgrade a resemblance into an identification. The supplied record does not establish the exact technique.',
          'Не перетворюйте схожість на визначення. Наданий запис не встановлює точної техніки.',
        ],
        [
          'certain',
          'Name a precise stitch from resemblance alone',
          'Назвати точний стібок лише за схожістю',
        ],
        [
          'uncertain',
          'Exact technique not established by this fixture',
          'Точної техніки цей приклад не встановлює',
        ],
      ),
    ],
    [
      'The label now distinguishes observation, catalogue attribution and missing information. A useful label can keep uncertainty visible.',
      'Підпис розрізняє спостереження, каталожну атрибуцію й відсутні відомості. Корисний підпис може відкрито зберігати невизначеність.',
    ],
    [textile(157573)],
  ),
  lesson(
    'ukraine-threads',
    4,
    ['Compare two individual objects', 'Порівняйте два окремі предмети'],
    [
      'Use the newly revealed second museum fragment. Compare the two exact records without turning either object into a rule for all Ukrainian clothing.',
      'Використайте щойно відкритий другий музейний фрагмент. Порівняйте два точні записи, не перетворюючи жоден предмет на правило для всього українського вбрання.',
    ],
    [
      record(
        'first',
        ['Earlier object · 2009.300.2715', 'Попередній предмет · 2009.300.2715'],
        [
          'Met object 157573 is a Ukrainian shirt fragment, dated to the fourth quarter of the eighteenth century, with linen, silk and metal recorded as materials.',
          'Предмет Метрополітен 157573 — фрагмент української сорочки останньої чверті XVIII століття; записані матеріали — льон, шовк і метал.',
        ],
      ),
      record(
        'second',
        ['New object · 2009.300.2713', 'Новий предмет · 2009.300.2713'],
        [
          'Met object 157571 is another Ukrainian shirt fragment. Its record gives the same date range and silk, linen and metal. The photograph shows red branching floral forms and repeated small border motifs; this is a separate accession.',
          'Предмет Метрополітен 157571 — інший фрагмент української сорочки. Запис містить той самий період та шовк, льон і метал. На фото видно червоні розгалужені квіткові форми й повторювані дрібні мотиви облямівки; це окремий обліковий номер.',
        ],
      ),
    ],
    [
      field(
        'identity',
        ['Collection identity', 'Ідентичність у колекції'],
        'two',
        [
          'Separate accession numbers identify two records. A shared date range does not make their photographs interchangeable.',
          'Окремі облікові номери позначають два записи. Спільний період не робить фотографії взаємозамінними.',
        ],
        ['one', 'Two views of the same accession', 'Два види того самого предмета'],
        ['two', 'Two separately recorded fragments', 'Два окремо обліковані фрагменти'],
      ),
      field(
        'shared',
        ['Supported shared detail', 'Підтверджена спільна деталь'],
        'materials',
        [
          'Both records name silk, linen and metal. The order of that list is not a claim about quantity.',
          'Обидва записи називають шовк, льон і метал. Порядок переліку не визначає їхньої кількості.',
        ],
        ['maker', 'The same named maker', 'Той самий відомий майстер'],
        ['materials', 'The same listed material types', 'Ті самі названі типи матеріалів'],
      ),
      field(
        'scope',
        ['Exhibition conclusion', 'Висновок виставки'],
        'individual',
        [
          'These individual records support a comparison of these objects. They do not establish one maker, a precise shared locality or a universal meaning for the motifs.',
          'Окремі записи дають підставу порівняти ці предмети. Вони не встановлюють одного майстра, точної спільної місцевості чи універсального значення мотивів.',
        ],
        [
          'universal',
          'Every region used these motifs with one meaning',
          'Кожен регіон використовував ці мотиви з одним значенням',
        ],
        [
          'individual',
          'Compare these two objects; keep unrecorded details open',
          'Порівнювати ці два предмети; не домислювати незаписане',
        ],
      ),
    ],
    [
      'The comparison keeps both accession numbers and their shared recorded materials, while leaving origin details and symbolic meanings unclaimed.',
      'Порівняння зберігає обидва облікові номери й спільні записані матеріали, не вигадуючи деталей походження чи символічних значень.',
    ],
    [textile(157573), textile(157571)],
  ),
  lesson(
    'fpv-meet-aircraft',
    2,
    ['Distinguish the motor and the propeller', 'Розрізніть двигун і пропелер'],
    [
      'Use the motion illustration and component photograph, then repair two role cards for an unpowered civilian display model.',
      'Скористайтеся ілюстрацією руху й фото компонента, а потім виправте дві картки ролей для знеструмленої цивільної виставкової моделі.',
    ],
    [
      record(
        'example',
        ['Worked role pair', 'Розібрана пара ролей'],
        [
          'The motor converts supplied electrical energy into mechanical rotation. A driven propeller interacts with air. A motor photograph is not a photograph of both parts together.',
          'Двигун перетворює подану електричну енергію на механічне обертання. Пропелер, який він приводить у рух, взаємодіє з повітрям. Фото двигуна не є фото обох деталей разом.',
        ],
      ),
      record(
        'display',
        ['Your display cards', 'Картки вашої експозиції'],
        [
          'Card A describes a component with windings and a rotating assembly. Card B describes blades connected to a hub. Neither card supplies mounting, rotation-direction or electrical-connection instructions.',
          'Картка A описує компонент з обмотками й обертовим вузлом. Картка B описує лопаті, з’єднані з втулкою. Жодна не задає кріплення, напрямку обертання чи електричного підключення.',
        ],
      ),
    ],
    [
      field(
        'a',
        ['Card A', 'Картка A'],
        'motor',
        [
          'Windings and a rotating motor assembly belong to the motor role, not the separate blades.',
          'Обмотки й обертовий вузол належать до двигуна, а не до окремих лопатей.',
        ],
        ['propeller', 'Propeller', 'Пропелер'],
        ['motor', 'Motor', 'Двигун'],
      ),
      field(
        'b',
        ['Card B', 'Картка B'],
        'propeller',
        [
          'The blades and hub identify the propeller. Its interaction with air differs from the motor’s conversion to rotation.',
          'Лопаті й втулка визначають пропелер. Його взаємодія з повітрям відрізняється від перетворення енергії на обертання у двигуні.',
        ],
        ['propeller', 'Propeller', 'Пропелер'],
        ['motor', 'Motor', 'Двигун'],
      ),
      field(
        'limit',
        ['What can the display establish?', 'Що доводить експозиція?'],
        'roles',
        [
          'These cards identify roles only. A generic illustration cannot establish a safe real assembly or its rotation direction.',
          'Картки визначають лише ролі. Загальна ілюстрація не підтверджує безпечності реального складання чи напрямку обертання.',
        ],
        [
          'setup',
          'A verified real mounting and rotation direction',
          'Перевірене реальне кріплення й напрямок обертання',
        ],
        ['roles', 'Two different component roles', 'Дві різні ролі компонентів'],
      ),
    ],
    [
      'The display now names the motor and propeller separately, and its label keeps practical setup outside the evidence supplied.',
      'Експозиція окремо називає двигун і пропелер; підпис не робить висновків про практичне налаштування без доказів.',
    ],
    [propeller, controller],
  ),
  lesson(
    'fpv-meet-aircraft',
    4,
    ['Follow information and energy', 'Простежте інформацію й енергію'],
    [
      'Apply the component roles to a different fictional classroom diagram. Name the role that calculates a command, the role that regulates motor power and the source of energy.',
      'Застосуйте ролі компонентів до іншої вигаданої навчальної схеми. Назвіть роль обчислення команди, роль регулювання живлення двигуна та джерело енергії.',
    ],
    [
      record(
        'example',
        ['Earlier example', 'Попередній приклад'],
        [
          'A motor turns and a propeller interacts with air. That role pair does not tell us which component decides the motor command.',
          'Двигун обертається, а пропелер взаємодіє з повітрям. Ця пара ролей не визначає, який компонент обчислює команду двигуна.',
        ],
      ),
      record(
        'diagram',
        ['Three labelled boxes', 'Три підписані блоки'],
        [
          'Box A uses sensor information and requested movement to calculate commands. Box B receives those commands and regulates electrical power to the motor. Box C supplies stored electrical energy. Actual products may combine roles.',
          'Блок A використовує дані датчиків і запитаний рух для обчислення команд. Блок B отримує команди й регулює електричну потужність двигуна. Блок C надає запасену електричну енергію. Реальні вироби можуть поєднувати ролі.',
        ],
      ),
    ],
    [
      field(
        'calculate',
        ['Box A', 'Блок A'],
        'fc',
        [
          'Calculating commands from inputs is the flight-controller role. The battery supplies energy rather than performing this computation.',
          'Обчислення команд за вхідними даними — роль польотного контролера. Акумулятор надає енергію, а не виконує це обчислення.',
        ],
        ['battery', 'Battery', 'Акумулятор'],
        ['fc', 'Flight controller', 'Польотний контролер'],
      ),
      field(
        'regulate',
        ['Box B', 'Блок B'],
        'esc',
        [
          'The ESC acts on motor commands to regulate motor power; the camera records a view.',
          'ESC виконує команди двигуна й регулює його живлення; камера формує зображення.',
        ],
        ['esc', 'ESC', 'ESC'],
        ['camera', 'Camera', 'Камера'],
      ),
      field(
        'energy',
        ['Box C', 'Блок C'],
        'battery',
        [
          'Stored electrical energy is the battery’s role in this model. A frame supports components rather than supplying power.',
          'Запас електричної енергії — роль акумулятора в цій моделі. Рама підтримує компоненти, а не живить їх.',
        ],
        ['frame', 'Frame', 'Рама'],
        ['battery', 'Battery', 'Акумулятор'],
      ),
    ],
    [
      'The diagram now separates calculation, motor-power regulation and energy supply. These are conceptual labels, not physical wiring instructions.',
      'Схема розрізняє обчислення, регулювання живлення двигуна й джерело енергії. Це підписи понять, а не інструкція фізичного підключення.',
    ],
    [controller, esc],
  ),
]);
