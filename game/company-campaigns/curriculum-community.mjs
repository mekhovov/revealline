// Second-campaign authoring batch. Organization facts are contextual references;
// the concrete fixtures below are original civilian community/science examples.
export const COMMUNITY_SOURCES = {
  accessibleWriting: {
    title: 'W3C WAI — Writing for Web Accessibility',
    url: 'https://www.w3.org/WAI/tips/writing/',
  },
  imageDescriptions: {
    title: 'W3C WAI — Informative images',
    url: 'https://www.w3.org/WAI/tutorials/images/informative/',
  },
  motion: {
    title: 'NASA Glenn — Newton’s Laws of Motion',
    url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/newtons-laws-of-motion/',
  },
  equilibrium: {
    title: 'NASA Glenn — Equilibrium',
    url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/equilibrium/',
  },
  vectors: {
    title: 'NASA Glenn — Vector components',
    url: 'https://www.grc.nasa.gov/WWW/K-12/BGP/vectpart.html',
  },
  experiment: {
    title: 'NASA Space Place — Steps in the scientific method',
    url: 'https://spaceplace.nasa.gov/review/science-fair/scientific-method.html',
  },
  models: {
    title: 'NASA Kennedy — Modeling and simulation FAQ',
    url: 'https://public.ksc.nasa.gov/mns/faq/',
  },
};
export const COMMUNITY_CAMPAIGNS = [
  [
    'social-drone-community-connections',
    'social-drone-ua',
    'Community Connections',
    'Зв’язки спільноти',
    'A Noticeboard Everyone Can Use',
    'Дошка оголошень для кожного',
    'social',
    'mosaic',
    'Combine the six cards into a fictional library science-day noticeboard: purpose, an accurate count, a useful handoff, understandable directions, image descriptions and a correction. Explain what changed for the next reader. This is an original community-learning exercise, not Social Drone’s internal procedure.',
    'Поєднайте шість карток у дошку оголошень вигаданого бібліотечного дня науки: мета, точний підрахунок, зрозуміла передача справ, вказівки, описи зображень і виправлення. Поясніть, що змінилося для наступного читача. Це оригінальна вправа спільного навчання, а не внутрішній процес Social Drone.',
    { stage: 2, band: 3 },
  ],
  [
    'victory-drones-ideas-understanding',
    'victory-drones',
    'Ideas into Understanding',
    'Від ідей до розуміння',
    'A Small Museum of Explanations',
    'Малий музей пояснень',
    'victory',
    'gallery',
    'Arrange your six civilian science cards as a small exhibit: observation, interacting forces, net force, direction, a fair comparison and a clear explanation. Keep the example’s assumptions visible. A physical model helps answer a specific question; it never turns an arcade route into a flight or engineering qualification.',
    'Розташуйте шість карток цивільної науки як малу виставку: спостереження, взаємодія сил, рівнодійна, напрямок, коректне порівняння та ясне пояснення. Залиште видимими припущення прикладу. Фізична модель допомагає відповісти на конкретне запитання, але ігровий маршрут не надає льотної чи інженерної кваліфікації.',
    { stage: 2, band: 3 },
  ],
];
export const COMMUNITY_LOOKS = {
  'social-drone-community-connections': {
    field: '#142F37',
    land: '#347E82',
    accent: '#FFD084',
    recipe: 'paper-tangle',
    enemy: 'Mixed message',
    genre: 'ambient',
    tempo: 92,
    root: 65,
  },
  'victory-drones-ideas-understanding': {
    field: '#212D43',
    land: '#365C88',
    accent: '#FFDC7C',
    recipe: 'missing-cloud',
    enemy: 'Unclear assumption',
    genre: 'chiptune',
    tempo: 108,
    root: 67,
  },
};
export const COMMUNITY_MISSION_ROWS = {
  'victory-drones-ideas-understanding': [
    {
      names: ['Observe Before Explaining', 'Спостерігайте перед поясненням'],
      briefs: [
        'Reveal the observation terrace and separate what happened from why it happened.',
        'Відкрийте терасу спостережень і розрізніть подію та її пояснення.',
      ],
      teasers: [
        'A rolling classroom cart starts a useful scientific question.',
        'Рух навчального візка починає корисне наукове запитання.',
      ],
      text: [
        [
          'Victory Drones publicly connects education with an expert community. Our separate civilian science exhibit begins with an invented observation: a small cart travelled farther on surface A than surface B.',
          '“The cart travelled farther” is an observation. “Surface A produced less resistance” is a possible explanation that needs a fair comparison. NASA’s learning guide distinguishes a testable idea from the observations used to examine it. What else might have differed?',
        ],
        [
          'Victory Drones публічно поєднує освіту з експертною спільнотою. Наша окрема цивільна виставка починається з вигаданого спостереження: малий візок проїхав далі поверхнею A, ніж B.',
          '«Візок проїхав далі» — спостереження. «Поверхня A створила менший опір» — можливе пояснення, яке потребує коректного порівняння. Посібник NASA розрізняє перевірювану ідею та спостереження для її дослідження. Що ще могло відрізнятися?',
        ],
      ],
      refs: ['victory', 'experiment'],
      routes: [
        'Use the small observation islands or capture the broad comparison terrace first.',
        'Скористайтеся малими островами спостережень або спершу захопіть широку терасу порівняння.',
      ],
      scene:
        'An original blue-and-gold civilian science gallery with two classroom cart illustrations and separate observation cards.',
    },
    {
      names: ['Forces Come in Pairs', 'Сили взаємодії'],
      briefs: [
        'Connect two interacting-object stations without merging their separate roles.',
        'З’єднайте станції двох взаємодіючих тіл, не змішуючи їхні окремі ролі.',
      ],
      teasers: [
        'Discover why an action–reaction pair acts on different objects.',
        'Дізнайтеся, чому пара сил взаємодії діє на різні тіла.',
      ],
      text: [
        [
          'Newton’s third law describes a pair of equal and opposite interaction forces on different objects. The two forces do not cancel on a single object because they act on different bodies.',
          'In our illustrated example, a hand pushes a wall and the wall pushes the hand. Draw one arrow on each object, then name the object each arrow belongs to. This everyday model explains a relationship without requiring a powered aircraft demonstration.',
        ],
        [
          'Третій закон Ньютона описує рівні й протилежні сили взаємодії, що діють на різні тіла. Вони не врівноважують одна одну на одному тілі, бо прикладені до різних тіл.',
          'В ілюстрованому прикладі рука тисне на стіну, а стіна — на руку. Намалюйте по стрілці на кожному тілі та назвіть, до якого тіла належить стрілка. Повсякденна модель пояснює зв’язок без демонстрації дрона під живленням.',
        ],
      ],
      refs: ['motion'],
      routes: [
        'Choose the hand-side return or wall-side return before crossing the interaction court.',
        'Оберіть повернення з боку руки або стіни перед перетином двору взаємодії.',
      ],
      scene:
        'An original civilian force-pair exhibit with two separate blue object plinths and clear opposing gold arrow sculptures.',
    },
    {
      names: ['The Net Force', 'Рівнодійна сил'],
      briefs: [
        'Join the balance stations and distinguish a force from the combined effect.',
        'З’єднайте станції рівноваги й розрізніть окрему силу та спільну дію.',
      ],
      teasers: [
        'Two arrows can tell a different story from one.',
        'Дві стрілки можуть розповісти іншу історію, ніж одна.',
      ],
      text: [
        [
          'The net force combines all forces acting on one object, including their directions. Zero net force means no change in velocity; it does not necessarily mean the object is stationary.',
          'Our fictional cart diagram shows equal left and right forces. A cart already moving straight can keep a constant velocity in this idealized model. Name the assumption before applying it: the diagram includes all relevant external forces, including any resistance.',
        ],
        [
          'Рівнодійна поєднує всі сили на одному тілі з урахуванням напрямків. Нульова рівнодійна означає відсутність зміни швидкості як вектора, але не обов’язково нерухомість.',
          'На вигаданій схемі візка показано рівні сили ліворуч і праворуч. Візок, що вже рухається прямо, може зберігати сталу швидкість в ідеалізованій моделі. Назвіть припущення: схема враховує всі суттєві зовнішні сили, зокрема можливий опір.',
        ],
      ],
      refs: ['equilibrium'],
      routes: [
        'Connect the two balance islands separately or encircle their central comparison space.',
        'З’єднайте два острови рівноваги окремо або обійдіть їхній центральний простір порівняння.',
      ],
      scene:
        'An original civilian mechanics hall with balanced arrow sculptures, a classroom cart model and two blue safe terraces.',
    },
    {
      names: ['Direction Matters', 'Напрямок має значення'],
      briefs: [
        'Explore the quiet arrow gallery and compare direction as well as size.',
        'Дослідіть спокійну галерею стрілок і порівняйте напрямок поряд із величиною.',
      ],
      teasers: [
        'An arrow tells you more than a number alone.',
        'Стрілка повідомляє більше, ніж саме число.',
      ],
      text: [
        [
          'A vector describes magnitude and direction. In a diagram, an arrow’s length can represent magnitude and its tip shows direction, provided the diagram states its scale.',
          'Two fictional arrows both represent a force of 2 newtons, but one points left and the other up. They have equal magnitudes and different directions. Explain why “both are 2” leaves out information. The arcade board’s directions are a metaphor, not a flight-control model.',
        ],
        [
          'Вектор описує величину й напрямок. На схемі довжина стрілки може передавати величину, а вістря — напрямок, якщо вказано масштаб.',
          'Дві вигадані стрілки позначають силу 2 ньютони, але одна спрямована ліворуч, інша — вгору. Величини рівні, напрямки різні. Поясніть, яку інформацію втрачає «обидві дорівнюють 2». Напрямки ігрового поля — метафора, а не модель керування польотом.',
        ],
      ],
      refs: ['vectors'],
      routes: [
        'Follow the broad arrow terrace, then choose the shorter vertical link or longer horizontal return.',
        'Пройдіть широкою терасою стрілок, потім оберіть коротший вертикальний зв’язок або довше горизонтальне повернення.',
      ],
      scene:
        'A spacious original vector sculpture garden with blue terraces, gold horizontal and vertical arrows and a quiet central forum.',
    },
    {
      names: ['A Fair Comparison', 'Коректне порівняння'],
      briefs: [
        'Link the paired experiment bays and keep track of what changed.',
        'З’єднайте парні простори досліду та простежте, що змінилося.',
      ],
      teasers: [
        'A classroom cart puzzle asks which difference you can explain.',
        'Загадка навчального візка запитує, яку відмінність можна пояснити.',
      ],
      text: [
        [
          'Return to the fictional cart. If both its starting push and surface change, a different distance does not identify which change mattered. NASA’s learning guide separates changing variables from conditions kept alike.',
          'Design the comparison on paper: keep the cart and starting conditions alike, change the surface, and record the result. Name a possible measurement uncertainty. These invented data are a reasoning exercise, not a claim that a real experiment occurred.',
        ],
        [
          'Поверніться до вигаданого візка. Якщо змінити і початковий поштовх, і поверхню, інша відстань не покаже, яка зміна вплинула. Посібник NASA розрізняє змінні величини й умови, що залишають однаковими.',
          'Сплануйте порівняння на папері: той самий візок та початкові умови, інша поверхня, запис результату. Назвіть можливу похибку вимірювання. Вигадані дані є вправою на міркування, а не твердженням про справжній дослід.',
        ],
      ],
      refs: ['experiment'],
      routes: [
        'Join the near experiment bay before the distant record shelf or take the outer comparison route.',
        'З’єднайте ближній простір досліду перед дальньою полицею записів або оберіть зовнішній маршрут порівняння.',
      ],
      scene:
        'An original blue science room with paired cart-display bays, an amber record shelf and a separate uncertainty board.',
    },
    {
      names: ['Explain the Model', 'Поясніть модель'],
      briefs: [
        'Connect the whole science exhibit and name what the model can and cannot show.',
        'З’єднайте всю наукову виставку й назвіть, що модель показує, а чого ні.',
      ],
      teasers: [
        'Complete a collection of explanations with visible assumptions.',
        'Завершіть колекцію пояснень із видимими припущеннями.',
      ],
      text: [
        [
          'NASA’s modeling guidance calls for a stated intended use, assumptions and limits. Our cart-and-arrow exhibit explains simple relationships; it does not reproduce an entire real vehicle.',
          'Explain one new example, such as a book resting on a table: identify the object, name the relevant forces and state the simplified conditions. Then label what is omitted. The six cards offer a civilian learning routine, not Victory Drones certification or operational instruction.',
        ],
        [
          'Настанови NASA щодо моделей передбачають визначені мету використання, припущення й межі. Виставка візків та стрілок пояснює прості зв’язки, а не відтворює весь справжній транспортний засіб.',
          'Поясніть новий приклад, як-от книжку на столі: визначте тіло, назвіть суттєві сили й спрощені умови. Потім позначте пропущене. Шість карток дають спосіб цивільного навчання, а не сертифікацію Victory Drones чи операційні вказівки.',
        ],
      ],
      refs: ['models', 'motion'],
      routes: [
        'Build a return through the central model court or connect the three explanation islands first.',
        'Побудуйте повернення через центральний двір моделі або спершу з’єднайте три острови пояснень.',
      ],
      scene:
        'A completed original blue-and-gold civilian science exhibit joining observation, force, vector and comparison displays around a model courtyard.',
    },
  ],
  'social-drone-community-connections': [
    {
      names: ['One Shared Brief', 'Спільний задум'],
      briefs: [
        'Link the welcome desk and purpose board before exploring the wider community hall.',
        'З’єднайте вітальний стіл і дошку мети перед дослідженням ширшої зали спільноти.',
      ],
      teasers: [
        'Turn “help with the event” into a brief someone can understand.',
        'Перетворіть «допоможіть із заходом» на зрозумілий задум.',
      ],
      text: [
        [
          'Social Drone’s public community page distinguishes contributors’ roles. Our separate fictional example is a civilian library science day: Olena welcomes visitors, Maksym prepares display labels, and nobody is assigned real equipment work.',
          'A useful brief says “Prepare a table explaining three everyday mechanisms for Saturday’s library visitors.” Compare it with “Do something technical.” The first identifies an audience, a purpose and a concrete result without guessing how much time someone can offer.',
        ],
        [
          'Публічна сторінка Social Drone розрізняє ролі учасників. Наш окремий вигаданий приклад — цивільний день науки в бібліотеці: Олена зустрічає відвідувачів, Максим готує підписи; ніхто не отримує роботи зі справжнім обладнанням.',
          'Зрозумілий задум: «Підготуйте стіл із поясненнями трьох повсякденних механізмів для суботніх відвідувачів бібліотеки». Порівняйте з «Зробіть щось технічне». Перший визначає аудиторію, мету й результат, не вгадуючи, скільки часу має учасник.',
        ],
      ],
      refs: ['social'],
      routes: [
        'Take the near briefing island first or build a return around the long welcome terrace.',
        'Спершу відкрийте ближній острів задуму або побудуйте повернення навколо довгої вітальної тераси.',
      ],
      scene:
        'An original community science-day hall with a teal welcome desk, a warm amber purpose board and civilian model displays.',
    },
    {
      names: ['Count What Is Here', 'Порахуйте наявне'],
      briefs: [
        'Connect the reading tables and distinguish an expected set from an actual count.',
        'З’єднайте столи читання й розрізніть очікуваний набір і фактичну кількість.',
      ],
      teasers: [
        'A fictional box of booklets makes a small record puzzle.',
        'Вигадана коробка буклетів створює невелику загадку обліку.',
      ],
      text: [
        [
          'The original library fixture expects 12 printed booklets, but the table holds 8. A clear note says “8 received; 4 still missing,” not “all ready.” Nothing in this example is a real donation record.',
          'Now imagine 2 more booklets arrive. Update the received count to 10 and the missing count to 2. Explain which observation justified the change. Accurate small records help the next volunteer avoid repeating a count or making an unsupported promise.',
        ],
        [
          'В оригінальному бібліотечному прикладі очікують 12 буклетів, але на столі лежать 8. Зрозумілий запис: «8 отримано; 4 ще бракує», а не «все готово». Це не запис про справжню пожертву.',
          'Уявіть, що надійшло ще 2 буклети. Оновіть отриману кількість до 10, а відсутню — до 2. Поясніть, яке спостереження підтверджує зміну. Точні малі записи допомагають наступному волонтеру не рахувати все повторно й не обіцяти непідтвердженого.',
        ],
      ],
      refs: ['social'],
      routes: [
        'Choose the upper booklet bay or the lower count desk, then join them through the middle shelf.',
        'Оберіть верхній простір буклетів або нижній стіл підрахунку, потім з’єднайте їх через середню полицю.',
      ],
      scene:
        'A fictional library preparation room with two booklet stacks, count cards and a central teal return shelf.',
    },
    {
      names: ['The Next Reader', 'Наступний читач'],
      briefs: [
        'Join the handoff alcoves and leave the next person a clear route.',
        'З’єднайте ніші передачі справ і залиште наступній людині зрозумілий маршрут.',
      ],
      teasers: [
        'Discover why “done” can leave a useful question unanswered.',
        'Дізнайтеся, чому «готово» може залишити корисне запитання без відповіді.',
      ],
      text: [
        [
          'Our fictional display has three labels. Two are checked; the third still needs a source. “Labels done” hides the remaining work. “Two checked; Taras will add the third source before display” preserves the useful distinction.',
          'W3C’s writing guidance recommends clear instructions. Apply that principle to this handoff: name the unfinished item and the next action, then ask whether the named person has actually accepted it. A proposed owner is not the same as an agreed handoff.',
        ],
        [
          'Вигадана виставка має три підписи. Два перевірено, третьому ще потрібне джерело. «Підписи готові» приховує роботу. «Два перевірено; Тарас додасть третє джерело до виставки» зберігає важливу різницю.',
          'Настанови W3C радять зрозумілі вказівки. Застосуйте принцип до передачі справ: назвіть незавершене й наступну дію та з’ясуйте, чи погодилася названа людина. Запропонований відповідальний — не те саме, що узгоджена передача справи.',
        ],
      ],
      refs: ['accessibleWriting'],
      routes: [
        'Join the small source alcove before crossing between the two larger handoff desks.',
        'З’єднайте малу нішу джерел перед перетином між двома більшими столами передачі справ.',
      ],
      scene:
        'An original teal handoff gallery with three display labels, a separate source alcove and a warm-lit shared table.',
    },
    {
      names: ['An Invitation That Helps', 'Корисне запрошення'],
      briefs: [
        'Explore the spacious invitation court and use its sheltered reading terrace.',
        'Дослідіть просторий двір запрошень через захищену терасу читання.',
      ],
      teasers: [
        'Make a fictional invitation useful without relying on colour alone.',
        'Зробіть вигадане запрошення корисним, не покладаючись лише на колір.',
      ],
      text: [
        [
          'Our library invitation says “Meet at the green door.” A visitor who cannot identify that colour still needs a way to find the room. Add “Reading room, ground floor, beside the main desk,” then keep the useful colour cue as extra information.',
          'W3C recommends meaningful headings, clear instructions and concise writing. Split the fictional invitation into “Where,” “When” and “What to expect.” An inviting poster should help someone act, not just look attractive.',
        ],
        [
          'Бібліотечне запрошення каже: «Зустрінемося біля зелених дверей». Людині, яка не визначає цей колір, теж потрібен шлях до кімнати. Додайте: «Читальна зала, перший поверх, біля головної стійки», а колір залиште додатковою підказкою.',
          'W3C радить змістовні заголовки, ясні вказівки й стислий текст. Розділіть вигадане запрошення на «Де», «Коли» та «Чого очікувати». Привітний плакат має допомагати діяти, а не лише гарно виглядати.',
        ],
      ],
      refs: ['accessibleWriting'],
      routes: [
        'Use the wide reading terrace to divide the invitation court into two manageable captures.',
        'Використайте широку терасу читання, щоб розділити двір запрошень на два посильні захоплення.',
      ],
      scene:
        'A spacious original community library courtyard with a teal reading terrace, amber signboards and multiple visible entrances.',
    },
    {
      names: ['Describe the Important Part', 'Опишіть важливе'],
      briefs: [
        'Connect the image and text galleries while watching the changed frontier.',
        'З’єднайте галереї зображення й тексту, стежачи за зміненим кордоном.',
      ],
      teasers: [
        'A picture description can carry the information someone needs.',
        'Опис зображення може передати потрібну інформацію.',
      ],
      text: [
        [
          'W3C’s informative-image guidance explains that a text alternative conveys the essential information of an image in its context. “Nice picture” does not explain our fictional room map.',
          'Try “The reading room is beside the main desk; the accessible entrance is on the east side.” Compare that useful description with an inventory of every decorative plant. Describe the information that answers the reader’s question, and do not invent facilities for a real place.',
        ],
        [
          'Настанови W3C для інформативних зображень пояснюють: текстова альтернатива передає суттєву інформацію в контексті. «Гарна картинка» не пояснює вигадану схему кімнати.',
          'Спробуйте: «Читальна зала біля головної стійки; доступний вхід — зі сходу». Порівняйте корисний опис із переліком кожної декоративної рослини. Описуйте те, що відповідає на запитання читача, й не вигадуйте зручностей справжнього місця.',
        ],
      ],
      refs: ['imageDescriptions'],
      routes: [
        'Connect the text island before the image bay or take the longer lower route around both.',
        'З’єднайте текстовий острів перед простором зображень або пройдіть довшим нижнім маршрутом навколо обох.',
      ],
      scene:
        'An original community communications room with paired image and text displays, teal islands and a long amber lower gallery.',
    },
    {
      names: ['Keep the Story Accurate', 'Збережіть точність історії'],
      briefs: [
        'Complete the community noticeboard and connect every remaining update point.',
        'Завершіть дошку спільноти й з’єднайте всі точки оновлення.',
      ],
      teasers: [
        'A clear correction can be part of a successful shared story.',
        'Зрозуміле виправлення може стати частиною успішної спільної історії.',
      ],
      text: [
        [
          'The fictional notice originally promised 12 booklets. Only 10 are ready. A correction says “10 available now; 2 expected later,” and replaces the old notice where readers will see it. The story becomes more useful by becoming more accurate.',
          'Review your six discoveries as a newcomer would: purpose, count, handoff, invitation, description and correction. Which detail lets someone participate with less guessing? This is a civilian communication exercise, not an account of a real Social Drone event.',
        ],
        [
          'Вигадане оголошення обіцяло 12 буклетів. Готові лише 10. Виправлення каже: «10 доступні зараз; 2 очікуємо пізніше» й замінює старе оголошення там, де його бачать читачі. Точніша історія стає кориснішою.',
          'Перегляньте шість відкриттів очима новачка: мету, підрахунок, передачу справ, запрошення, опис і виправлення. Яка деталь допомагає долучитися без здогадок? Це цивільна вправа комунікації, а не опис реального заходу Social Drone.',
        ],
      ],
      refs: ['accessibleWriting', 'social'],
      routes: [
        'Choose the central noticeboard first or connect the three update stations before the final crossing.',
        'Спершу оберіть центральну дошку або з’єднайте три станції оновлення перед фінальним перетином.',
      ],
      scene:
        'A completed original community noticeboard plaza joining six illustrated library-science-day contributions with teal and amber paths.',
    },
  ],
};
