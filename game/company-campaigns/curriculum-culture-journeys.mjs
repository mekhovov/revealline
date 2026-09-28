// Original learning prompts use the named public records below. Linked songs,
// photographs and museum works are references, not admitted runtime media.
export const CULTURE_JOURNEY_SOURCES = {
  kobza: {
    title: 'UNESCO — Safeguarding programme of kobza and wheel lyre tradition',
    url: 'https://ich.unesco.org/en/BSP/safeguarding-programme-of-kobza-and-wheel-lyre-tradition-02136',
  },
  cossackSongs: {
    title: 'UNESCO — Cossack’s songs of Dnipropetrovsk Region',
    url: 'https://ich.unesco.org/en/USL/cossacks-songs-of-dnipropetrovsk-region-01194',
  },
  shchedryk: {
    title: 'Ukrainian Institute — Shchedryk at Carnegie Hall',
    url: 'https://ui.org.ua/en/sectors-en/carol-of-the-bells-at-carnegie-hall/',
  },
  polyphony: {
    title: 'Polyphony Project — Ukrainian village song archive',
    url: 'https://www.polyphonyproject.com/en',
  },
  polyphonyMuseum: {
    title: 'Ivan Honchar Museum — Polyphony Project',
    url: 'https://honchar.org.ua/en/projects/polyphony-project-i68',
  },
  kyivHeritage: {
    title: 'UNESCO — Kyiv: Saint-Sophia and Kyiv-Pechersk Lavra',
    url: 'https://whc.unesco.org/en/list/527/',
  },
  lvivHeritage: {
    title: 'UNESCO — Lviv: the Ensemble of the Historic Centre',
    url: 'https://whc.unesco.org/en/list/865/',
  },
  odesaHeritage: {
    title: 'UNESCO — The Historic Centre of Odesa',
    url: 'https://whc.unesco.org/en/list/1703/',
  },
  constitutionSymbols: {
    title: 'Constitution of Ukraine — Chapter I, Article 20',
    url: 'https://www.president.gov.ua/documents/constitution/konstituciya-ukrayini-rozdil-i',
  },
  trident: {
    title: 'Verkhovna Rada — State coat of arms resolution, 19 February 1992',
    url: 'https://zakon.rada.gov.ua/laws/show/2137-12',
  },
  ukraineHeritage: {
    title: 'UNESCO World Heritage — Ukraine',
    url: 'https://whc.unesco.org/en/statesparties/ua/',
  },
  greetings: {
    title: 'Ukraine.ua — Ukrainian greeting and thanks phrases',
    url: 'https://promote.ukraine.ua/wp-content/uploads/2021/07/Instruktsiya-z-realizatsii-kampanii-Visit-Urkaine-in-Summer-kopiya.pdf',
  },
  alphabet: {
    title: 'Ukrainian Institute — Ukrainian alphabet and pronunciation guide',
    url: 'https://ui.org.ua/wp-content/uploads/2025/07/decolonisation-in-museums_part-1.pdf',
  },
  borscht: {
    title: 'UNESCO — Culture of Ukrainian borscht cooking',
    url: 'https://ich.unesco.org/en/USL/culture-of-ukrainian-borscht-cooking-01852',
  },
  makitra: {
    title: 'Museum Fund of Ukraine — Makitra, Novoarkhanhelsk museum',
    url: 'https://museum.mincult.gov.ua/collections/279349',
  },
};

export const CULTURE_JOURNEY_CAMPAIGNS = [
  [
    'ukraine-voices-travel',
    'ukraine-culture',
    'Voices That Travel',
    'Голоси, що мандрують',
    'A Listening Trail with Names',
    'Маршрут слухання з іменами',
    'polyphony',
    'route',
    'Follow the six cards from a musical practice to its bearers, from a travelling composition to documented village recordings. Keep performer, place, source and recording context together. The finale is a source-linked listening trail: choose an external recording when you want to explore, with no automatic audio playback.',
    'Пройдіть шість карток від музичної практики до її носіїв, від мандрівного твору до документованих сільських записів. Зберігайте разом виконавця, місце, джерело й обставини запису. Фінал — маршрут слухання з посиланнями: обирайте зовнішній запис для дослідження без автоматичного відтворення.',
    { stage: 4, band: 7 },
  ],
  [
    'ukraine-cities-symbols-time',
    'ukraine-culture',
    'Cities, Symbols and Time',
    'Міста, символи і час',
    'A Map of Places and Evidence',
    'Мапа місць і свідчень',
    'ukraineHeritage',
    'gallery',
    'Build an annotated imaginary exhibition map with Kyiv, Lviv and Odesa, then add the trident and flag records on a separate timeline. A place, a date and a source help explain each connection. This collection is a cultural reading map; the arcade geometry is not a map for navigating real streets.',
    'Створіть мапу уявної виставки з Києвом, Львовом та Одесою, а записи про тризуб і прапор додайте на окрему часову шкалу. Місце, дата та джерело пояснюють кожен зв’язок. Колекція — культурний маршрут читання; ігрова геометрія не є мапою справжніх вулиць.',
    { stage: 5, band: 9 },
  ],
  [
    'ukraine-everyday-culture',
    'ukraine-culture',
    'Words, Tables and Everyday Culture',
    'Слова, стіл і повсякденна культура',
    'A Welcome Book of Everyday Stories',
    'Книга привітань і щоденних історій',
    'alphabet',
    'mosaic',
    'Combine a greeting, a carefully read letter, a cooking tradition, a documented vessel, a recipe’s context and an invitation into a small welcome book. Name your examples and leave room for other people’s experiences. Everyday culture changes through use; no six cards can stand for every household.',
    'Поєднайте привітання, уважно прочитану літеру, кулінарну традицію, опис посудини, контекст рецепта та запрошення в малу книгу гостинності. Називайте свої приклади й залишайте місце для досвіду інших. Повсякденна культура змінюється в користуванні; шість карток не можуть представляти кожну родину.',
    { stage: 6, band: 11 },
  ],
];

export const CULTURE_JOURNEY_LOOKS = {
  'ukraine-voices-travel': {
    field: '#22283F',
    land: '#634F87',
    accent: '#F0C986',
    recipe: 'backlog-knot',
    enemy: 'Mixed-up echo',
    genre: 'ambient',
    tempo: 94,
    root: 64,
  },
  'ukraine-cities-symbols-time': {
    field: '#1B304E',
    land: '#48728A',
    accent: '#F3D36A',
    recipe: 'stale-fragments',
    enemy: 'Lost sign',
    genre: 'chiptune',
    tempo: 102,
    root: 65,
  },
  'ukraine-everyday-culture': {
    field: '#382C3A',
    land: '#845754',
    accent: '#F2D595',
    recipe: 'paper-tangle',
    enemy: 'Mixed story card',
    genre: 'ambient',
    tempo: 98,
    root: 62,
  },
};

export const CULTURE_JOURNEY_MISSION_ROWS = {
  'ukraine-voices-travel': [
    {
      names: ['An Instrument and a Voice', 'Інструмент і голос'],
      briefs: [
        'Connect the instrument room to the listening court and discover the people behind the sound.',
        'З’єднайте інструментальну залу з подвір’ям слухання та відкрийте людей за звучанням.',
      ],
      teasers: [
        'Kobza and wheel-lyre traditions include voices and a shared practice.',
        'Кобзарська та лірницька традиції поєднують голоси й спільну практику.',
      ],
      text: [
        [
          'UNESCO’s kobza and wheel-lyre record describes travelling singers and instrumentalists, historically including people with visual impairments. A safeguarding programme for this tradition entered the Register of Good Safeguarding Practices in 2024.',
          'Our exhibit has an instrument card and a performer card. Keep them connected: the shape of an instrument does not tell the whole story of a person’s practice. When opening the source, look for who is speaking and how the knowledge is learned.',
        ],
        [
          'Запис ЮНЕСКО про кобзарську та лірницьку традицію описує мандрівних співців та інструменталістів, історично зокрема людей із порушеннями зору. Програму охорони традиції внесено до Реєстру належних практик охорони 2024 року.',
          'У нашій виставці є картка інструмента й картка виконавця. Збережіть їхній зв’язок: форма інструмента не розповідає всього про практику людини. Відкриваючи джерело, зверніть увагу, хто говорить і як передаються знання.',
        ],
      ],
      refs: ['kobza'],
      routes: [
        'Secure the instrument alcove first or connect two listening islands before taking the long audience court.',
        'Спершу закріпіть інструментальну нішу або поєднайте два острови слухання перед довгим подвір’ям глядачів.',
      ],
      scene:
        'Original evening music exhibition with unlabelled instrument silhouettes, separate performer cards and violet listening alcoves; no invented portrait of a tradition bearer or copied recording imagery.',
    },
    {
      names: ['A Practice Kept Together', 'Практика, яку бережуть разом'],
      briefs: [
        'Link the teaching rooms and keep a return open between learning and sharing.',
        'Поєднайте навчальні кімнати та збережіть повернення між навчанням і передачею знань.',
      ],
      teasers: [
        'A musical guild is also a way people support a tradition.',
        'Музичний цех також допомагає людям підтримувати традицію.',
      ],
      text: [
        [
          'UNESCO describes kobzar guilds, or tsekhs, as organizations that regulated practice and protected performers’ rights. Its safeguarding account also describes present-day work with people with visual impairments.',
          'In a fictional learning room, place “people,” “skills” and “opportunities to perform” on three cards. Removing any one changes the picture. A museum can keep an instrument, while a community also needs ways to keep using and teaching the practice.',
        ],
        [
          'ЮНЕСКО описує кобзарські цехи як об’єднання, що впорядковували практику та захищали права виконавців. Розповідь про охорону також описує сучасну роботу з людьми з порушеннями зору.',
          'У вигаданій навчальній кімнаті розмістіть три картки: «люди», «навички» й «можливості виступати». Вилучення будь-якої змінює картину. Музей може зберегти інструмент, а спільноті також потрібні способи продовжувати практику та навчати її.',
        ],
      ],
      refs: ['kobza'],
      routes: [
        'Join the nearby teaching tables for short captures or use the outer gallery to connect all three rooms.',
        'Поєднайте сусідні навчальні столи короткими захопленнями або з’єднайте всі три кімнати зовнішньою галереєю.',
      ],
      scene:
        'Original inclusive rehearsal-library with three well-spaced teaching rooms and accessible caption stands; represent learning through objects and empty seating, not invented documentary people.',
    },
    {
      names: ['A Region Has Many Voices', 'Регіон має багато голосів'],
      briefs: [
        'Reveal the regional song gallery while keeping each group’s record distinct.',
        'Відкрийте галерею регіональної пісні, зберігаючи окремий запис кожного гурту.',
      ],
      teasers: [
        'A regional inscription is precise about the community it describes.',
        'Регіональний запис точно називає спільноту, про яку йдеться.',
      ],
      text: [
        [
          'Cossack’s songs of Dnipropetrovsk Region entered UNESCO’s Urgent Safeguarding List in 2016. The record concerns singing communities in that region, with songs that include personal relationships and the tragedy of war.',
          'Give our fictional archive card the region’s name instead of labelling it “every Ukrainian song.” Place and performance context help a listener understand a recording. A specific tradition can be important without representing every singer or every part of the country.',
        ],
        [
          'Козацькі пісні Дніпропетровщини внесено до Списку ЮНЕСКО, що потребує термінової охорони, 2016 року. Запис стосується співочих спільнот регіону; серед тем пісень — особисті стосунки й трагедія війни.',
          'Зазначте на вигаданій архівній картці регіон замість підпису «вся українська пісня». Місце й обставини виконання допомагають зрозуміти запис. Конкретна традиція може бути важливою, не представляючи всіх співаків чи всі частини країни.',
        ],
      ],
      refs: ['cossackSongs'],
      routes: [
        'Read the warning from the narrow source aisle or cross the wider regional court with a nearer return prepared.',
        'Стежте за попередженням із вузького архівного проходу або перетніть ширше регіональне подвір’я з підготовленим близьким поверненням.',
      ],
      scene:
        'Original regional song archive with separate group caption cards, abstract sound ribbons and a generous central courtyard; no combat scene, lyrics, or fabricated map boundary.',
    },
    {
      names: ['Shchedryk Crosses an Ocean', '«Щедрик» перетинає океан'],
      briefs: [
        'Open the broad concert foyer and connect the composition to its documented journey.',
        'Відкрийте широке концертне фоє та пов’яжіть твір із його документованою подорожжю.',
      ],
      teasers: [
        'A 1922 concert gives a familiar melody a named journey.',
        'Концерт 1922 року додає знайомій мелодії конкретну історію подорожі.',
      ],
      text: [
        [
          'The Ukrainian Institute records a Carnegie Hall performance of Mykola Leontovych’s Shchedryk on 5 October 1922, during the Ukrainian Republic Capella’s tour conducted by Oleksandr Koshyts.',
          'Arrange three labels: composition, performers and concert. A work can travel while each performance has its own people and date. Explore the linked concert history, then explain which label names the work and which names a particular event. No song lyrics are needed for this comparison.',
        ],
        [
          'Український інститут описує виконання «Щедрика» Миколи Леонтовича в Карнеґі-холі 5 жовтня 1922 року під час гастролей Української республіканської капели під керівництвом Олександра Кошиця.',
          'Розташуйте три підписи: твір, виконавці та концерт. Твір подорожує, а кожне виконання має своїх людей і дату. Дослідіть історію концерту за посиланням і поясніть, який підпис називає твір, а який — конкретну подію. Для порівняння текст пісні не потрібен.',
        ],
      ],
      refs: ['shchedryk'],
      routes: [
        'Take the open foyer in a wide loop or reveal the two programme alcoves before approaching the marked lane.',
        'Захопіть відкрите фоє широкою петлею або відкрийте дві ніші програмок перед наближенням до позначеної смуги.',
      ],
      scene:
        'Original spacious concert foyer with an ocean-blue window, blank programme cards and warm lights; no recreation of the 1922 performers, protected programme facsimile or unlicensed musical score.',
    },
    {
      names: ['One Voice, Then the Group', 'Один голос, потім гурт'],
      briefs: [
        'Connect the listening stations and discover how an archive can let you hear parts of a whole.',
        'З’єднайте станції слухання та дізнайтеся, як архів відкриває частини цілого.',
      ],
      teasers: [
        'The Polyphony archive gives separate voices their own channels.',
        'Архів «Поліфонія» надає окремим голосам власні канали.',
      ],
      text: [
        [
          'The Polyphony Project records Ukrainian village singing with separate microphones and offers a multitrack player. Its archive also keeps descriptions of performers, places and performance contexts.',
          'If you choose to open a recording, listen to one available part and then the group at a comfortable volume. What becomes easier to notice? Describe an observation, not a ranking of whose voice matters most. The game’s text remains available without opening or playing external media.',
        ],
        [
          'Проєкт «Поліфонія» записує український сільський спів окремими мікрофонами та пропонує багатоканальний програвач. Архів також зберігає описи виконавців, місць та обставин виконання.',
          'Якщо вирішите відкрити запис, послухайте доступну окрему партію, а потім гурт на комфортній гучності. Що легше помітити? Опишіть спостереження, не визначаючи, чий голос важливіший. Ігровий текст доступний без відкриття чи відтворення зовнішніх медіа.',
        ],
      ],
      refs: ['polyphony', 'polyphonyMuseum'],
      routes: [
        'Secure the lower listening station for a quick return or connect the upper pair around the warning lane.',
        'Закріпіть нижню станцію слухання для швидкого повернення або з’єднайте верхню пару навколо смуги попередження.',
      ],
      scene:
        'Original modern listening exhibit with separated illuminated voice-channel ribbons, accessible text panels and headphones on stands; no copied Polyphony user interface, audio or performer photography.',
    },
    {
      names: ['Carry the Context', 'Передайте контекст'],
      briefs: [
        'Complete the listening trail and preserve the source with every discovery.',
        'Завершіть маршрут слухання та збережіть джерело кожного відкриття.',
      ],
      teasers: [
        'A recording becomes more useful when its context travels too.',
        'Запис стає кориснішим, коли його контекст подорожує разом із ним.',
      ],
      text: [
        [
          'The Polyphony archive groups related song variants and provides song descriptions and text. Different recorded versions can be compared without declaring one performance the only valid form.',
          'Prepare a fictional listening recommendation with a title, performer or group, place, source link and one question to explore. Keep the recording’s own rights and attribution attached. Your six-card finale now offers a route back to the people and records behind the discoveries.',
        ],
        [
          'Архів «Поліфонія» поєднує споріднені варіанти пісень і подає описи та тексти. Різні записи можна порівнювати, не оголошуючи одне виконання єдиною правильною формою.',
          'Підготуйте вигадану рекомендацію для слухання: назва, виконавець або гурт, місце, посилання та одне запитання для дослідження. Збережіть права й атрибуцію самого запису. Фінал із шести карток повертає до людей і записів, що стоять за відкриттями.',
        ],
      ],
      refs: ['polyphony'],
      routes: [
        'Open the numbered source connector first or secure the wide archive wing before returning to the final listening island.',
        'Спершу відкрийте нумерований прохід джерел або закріпіть широке архівне крило перед поверненням до фінального острова слухання.',
      ],
      scene:
        'Original six-card listening-library finale with a bright source index and connected violet-gold galleries; abstract sound shapes only, no lyrics, unlicensed recordings or invented performer portraits.',
    },
  ],
};

CULTURE_JOURNEY_MISSION_ROWS['ukraine-cities-symbols-time'] = [
  {
    names: ['Kyiv in Layers', 'Київ шарами'],
    briefs: [
      'Connect the mosaic gallery and monastery court while keeping their histories distinct.',
      'З’єднайте галерею мозаїк і монастирське подвір’я, зберігаючи їхні окремі історії.',
    ],
    teasers: [
      'A heritage record can connect several places without making them the same building.',
      'Опис спадщини поєднує кілька місць, не перетворюючи їх на одну будівлю.',
    ],
    text: [
      [
        'UNESCO’s Kyiv property brings Saint-Sophia Cathedral and related monastic buildings together with Kyiv-Pechersk Lavra. Its description discusses architectural and artistic layers, including Saint-Sophia’s mosaics and frescoes.',
        'Our imaginary exhibition uses separate cards for building, artwork and wider complex. Connect the cards without collapsing them into one date or place. The game’s courts are an arcade interpretation; consult the official record for the actual sites and their boundaries.',
      ],
      [
        'Об’єкт ЮНЕСКО в Києві поєднує Софійський собор із прилеглими монастирськими спорудами та Києво-Печерську лавру. Опис розглядає архітектурні й мистецькі шари, зокрема софійські мозаїки та фрески.',
        'В уявній виставці є окремі картки будівлі, твору та ширшого комплексу. Поєднайте їх, не зводячи до однієї дати чи місця. Ігрові подвір’я — аркадна інтерпретація; справжні об’єкти та їхні межі описані в офіційному записі.',
      ],
    ],
    refs: ['kyivHeritage'],
    routes: [
      'Open the short numbered return into the mosaic wing or take the outer court first while keeping two retreat choices.',
      'Відкрийте коротке нумероване повернення до мозаїчного крила або спершу захопіть зовнішнє подвір’я, зберігаючи два відступи.',
    ],
    scene:
      'Original architectural exhibition with separate mosaic-colour panels and monastery model plinths, blue shadows and warm gold light; no copied sacred fresco, reconstructed historic interior or real navigation map.',
  },
  {
    names: ['Lviv: Streets and Encounters', 'Львів: вулиці й зустрічі'],
    briefs: [
      'Connect the market and side galleries to discover more than one architectural influence.',
      'З’єднайте ринкову й бічні галереї, щоб відкрити кілька архітектурних впливів.',
    ],
    teasers: [
      'An urban ensemble holds relationships between buildings and communities.',
      'Міський ансамбль зберігає зв’язки між будівлями та спільнотами.',
    ],
    text: [
      [
        'UNESCO describes Lviv’s historic centre as an ensemble shaped by different cultural and religious communities and by exchanges among architectural traditions. The record treats the urban setting as part of its significance.',
        'Compare a fictional isolated façade card with a wider street-scene card. What becomes visible only when neighbouring buildings appear? Record an observation about relationships, rather than assuming every building has the same origin or that one photograph explains the entire city.',
      ],
      [
        'ЮНЕСКО описує історичний центр Львова як ансамбль, сформований різними культурними й релігійними спільнотами та обміном архітектурних традицій. Міське середовище є частиною його значення.',
        'Порівняйте вигадану картку окремого фасаду з ширшим видом вулиці. Що стає видимим лише поряд із сусідніми будівлями? Опишіть зв’язки, не припускаючи однакового походження всіх споруд чи того, що одна світлина пояснює ціле місто.',
      ],
    ],
    refs: ['lvivHeritage'],
    routes: [
      'Secure the nearby market islands or activate the connector that opens a longer safe route behind the side galleries.',
      'Закріпіть близькі ринкові острови або активуйте прохід, що відкриває довший безпечний шлях за бічними галереями.',
    ],
    scene:
      'Original Lviv-inspired urban-study gallery with model streets and varied generic façade silhouettes, clearly a fictional exhibition rather than an exact city view or single-style historical claim.',
  },
  {
    names: ['Odesa: A Port City Record', 'Одеса: опис портового міста'],
    briefs: [
      'Link the harbour-model bays and follow the relationship between a city and its wider setting.',
      'З’єднайте зали моделі гавані та простежте зв’язок міста з його середовищем.',
    ],
    teasers: [
      'A historic centre’s story includes exchange and urban design.',
      'Історія центру міста поєднує обмін і міське планування.',
    ],
    text: [
      [
        'The Historic Centre of Odesa entered the World Heritage List in 2023. UNESCO’s account describes a port city whose architecture and urban development reflect exchanges among diverse communities.',
        'In our fictional model, the harbour, public square and street grid have separate labels. Ask what each can show and what remains outside the model. A heritage designation identifies a particular property; it does not mean every building across a modern city belongs to that property.',
      ],
      [
        'Історичний центр Одеси внесено до Списку всесвітньої спадщини 2023 року. ЮНЕСКО описує портове місто, архітектура й розвиток якого відображають обмін між різними спільнотами.',
        'У вигаданій моделі гавань, громадська площа й мережа вулиць мають окремі підписи. Запитайте, що вони показують і що лишається поза моделлю. Статус спадщини визначає конкретний об’єкт, а не всі будівлі сучасного міста.',
      ],
    ],
    refs: ['odesaHeritage'],
    routes: [
      'Take the lower harbour bay for a short closure or connect the upper squares through the numbered return.',
      'Захопіть нижню гавань коротким замиканням або поєднайте верхні площі через нумероване повернення.',
    ],
    scene:
      'Original blue-gold port-city exhibition with harbour model, separate street-grid panel and generous square; no exact Odesa street plan, wartime scene or recreated documentary view.',
  },
  {
    names: ['The Trident and a Date', 'Тризуб і дата'],
    briefs: [
      'Open the spacious symbol gallery and match the modern state record to its date.',
      'Відкрийте простору галерею символів і пов’яжіть державний документ із його датою.',
    ],
    teasers: [
      'A primary document anchors one part of a symbol’s history.',
      'Первинний документ закріплює одну частину історії символу.',
    ],
    text: [
      [
        'The Verkhovna Rada’s resolution of 19 February 1992 approved the trident as Ukraine’s small coat of arms. Article 20 of the Constitution connects the small coat of arms with the sign of Volodymyr the Great’s princely state.',
        'Keep two timeline labels: a historical association and a modern legal adoption. They answer different questions. Our exhibit asks you to distinguish those claims rather than invent a single undisputed meaning for every line of the symbol.',
      ],
      [
        'Постанова Верховної Ради від 19 лютого 1992 року затвердила тризуб як малий герб України. Стаття 20 Конституції пов’язує малий герб зі знаком княжої держави Володимира Великого.',
        'Збережіть два підписи часової шкали: історичний зв’язок і сучасне юридичне затвердження. Вони відповідають на різні запитання. Виставка пропонує розрізнити ці твердження, а не вигадувати єдине беззаперечне значення кожної лінії символу.',
      ],
    ],
    refs: ['trident', 'constitutionSymbols'],
    routes: [
      'Use the broad central foundation for a calmer approach or unlock the side return before entering the marked lane.',
      'Скористайтеся широкою центральною основою для спокійнішого підходу або відкрийте бічне повернення перед позначеною смугою.',
    ],
    scene:
      'Original civic-history gallery with two clear timeline stands and a placeholder for an accurately sourced upright state emblem; no distorted trident, speculative symbol decoding or fabricated legal document facsimile.',
  },
  {
    names: ['Blue and Yellow, Clearly Seen', 'Синій і жовтий: бачити чітко'],
    briefs: [
      'Connect the two colour halls and keep the symbol readable at every scale.',
      'З’єднайте дві кольорові зали та збережіть читабельність символу в кожному масштабі.',
    ],
    teasers: [
      'The flag’s description is precise about two equal horizontal bands.',
      'Опис прапора точно називає дві рівновеликі горизонтальні смуги.',
    ],
    text: [
      [
        'Article 20 of Ukraine’s Constitution describes the state flag as two equal horizontal bands of blue and yellow. The same article names the flag, coat of arms and anthem as state symbols.',
        'Our design comparison shows a clear labelled flag card beside an abstract blue-and-yellow artwork. The artwork may use the colours freely, but a caption should identify which image presents the flag. Keep labels readable without relying on colour alone.',
      ],
      [
        'Стаття 20 Конституції України описує державний прапор як дві рівновеликі горизонтальні смуги синього й жовтого кольорів. Та сама стаття називає прапор, герб і гімн державними символами.',
        'Наше порівняння ставить чітко підписану картку прапора поруч з абстрактним синьо-жовтим твором. Твір може вільно використовувати кольори, але підпис має визначати, де саме представлено прапор. Зробіть підписи читабельними без покладання лише на колір.',
      ],
    ],
    refs: ['constitutionSymbols'],
    routes: [
      'Open the nearest numbered connection first or secure both colour islands before crossing the warning lane.',
      'Спершу відкрийте найближчий нумерований прохід або закріпіть обидва кольорові острови перед смугою попередження.',
    ],
    scene:
      'Original accessible design exhibit with blue and yellow panels, separate blank labels and a correctly proportioned two-band flag card; quiet cream surround, no colour-only essential information.',
  },
  {
    names: ['A Map with More Than One Story', 'Мапа з багатьма історіями'],
    briefs: [
      'Connect the city records and symbol timeline into a clearly sourced final exhibition.',
      'Поєднайте описи міст і часову шкалу символів у фінальну виставку з джерелами.',
    ],
    teasers: [
      'Places, dates and sources turn a collage into an explainable map.',
      'Місця, дати й джерела перетворюють колаж на зрозумілу мапу.',
    ],
    text: [
      [
        'UNESCO’s Ukraine page lists separate World Heritage properties with their own records and inscription years. Looking at the national list and then an individual record answers different levels of questions.',
        'Curate our six discoveries with one sentence each: name the place or symbol, the specific fact and its source. Keep missing details visible. The finished map connects several stories without ranking cities, treating an inscription as a measure of cultural worth, or replacing real geographical maps.',
      ],
      [
        'Сторінка ЮНЕСКО про Україну перелічує окремі об’єкти всесвітньої спадщини з власними описами й роками внесення. Національний перелік та окремий запис відповідають на запитання різного масштабу.',
        'Підпишіть шість відкриттів одним реченням кожне: назвіть місце чи символ, конкретний факт і джерело. Залиште невідомі деталі видимими. Мапа поєднує історії без рейтингу міст, оцінювання культурної цінності за статусом чи заміни справжніх географічних карт.',
      ],
    ],
    refs: ['ukraineHeritage'],
    routes: [
      'Activate the two source returns before following the directional fields or take a longer loop around the flow.',
      'Активуйте два повернення джерел перед рухом напрямленими полями або оберіть довшу петлю навколо потоку.',
    ],
    scene:
      'Original museum map room with three distinct city model tables, a separate civic-symbol timeline and generous source-card wall; an exhibition diagram, not a real navigation map or exhaustive account of Ukraine.',
  },
];

CULTURE_JOURNEY_MISSION_ROWS['ukraine-everyday-culture'] = [
  {
    names: ['A Door Opens with Words', 'Двері відчиняються словами'],
    briefs: [
      'Connect the welcome desk to the reading tables and discover two useful Ukrainian expressions.',
      'З’єднайте стіл привітань із читальними столами та відкрийте два корисні українські вислови.',
    ],
    teasers: [
      'Добрий день and дякую can start a small exchange.',
      '«Добрий день» і «дякую» можуть почати коротку розмову.',
    ],
    text: [
      [
        'Ukraine.ua’s phrase guide gives добрий день as a greeting and дякую as thanks. These small expressions offer a starting point for an exchange in Ukrainian.',
        'In our fictional library, greet the host, receive a book and thank them. Read the Cyrillic words at your own pace. A written transliteration can help a beginner get started, while listening to a speaker remains useful for learning pronunciation.',
      ],
      [
        'Порадник висловів Ukraine.ua подає «добрий день» як привітання, а «дякую» — як подяку. Ці короткі вислови допомагають почати розмову українською.',
        'У вигаданій бібліотеці привітайте господаря, отримайте книжку та подякуйте. Читайте слова кирилицею у власному темпі. Транслітерація може допомогти початківцю, а слухання мовця лишається корисним для вивчення вимови.',
      ],
    ],
    refs: ['greetings'],
    routes: [
      'Take the welcome alcove first or use the marked flow only when it leads to your prepared reading-room return.',
      'Спершу захопіть нішу привітань або використайте позначений потік лише тоді, коли він веде до підготовленого повернення в читальню.',
    ],
    scene:
      'Original welcoming Ukrainian library with two editable greeting caption panels, warm coral lamps and cream reading tables; language labels rendered by the localized interface, not baked into decorative art.',
  },
  {
    names: ['Look Closely at Ї', 'Придивіться до Ї'],
    briefs: [
      'Reveal the letter-study stations and keep small visual differences readable.',
      'Відкрийте станції дослідження літер і збережіть помітність малих відмінностей.',
    ],
    teasers: [
      'A pair of dots is part of a distinct Ukrainian letter.',
      'Дві крапки є частиною окремої української літери.',
    ],
    text: [
      [
        'The Ukrainian Institute’s alphabet guide lists І and Ї as distinct letters. Its pronunciation guide associates Ї with a “yi” sound rather than treating it as a decorated І.',
        'Compare the word Україна with a version that has lost the two dots. A small graphic change can change a letter. In our fictional caption workshop, preserve the actual characters, increase text size when needed and keep decorative patterns away from the words.',
      ],
      [
        'Абетковий посібник Українського інституту подає І та Ї як різні літери. Пояснення вимови пов’язує Ї зі сполученням звуків «йі», а не з оздобленою І.',
        'Порівняйте слово «Україна» з версією, у якій зникли дві крапки. Мала графічна зміна може змінити літеру. У вигаданій майстерні підписів зберігайте справжні символи, за потреби збільшуйте текст і тримайте декоративні візерунки подалі від слів.',
      ],
    ],
    refs: ['alphabet'],
    routes: [
      'Connect the near letter islands for shorter closures or cross the vertical flow after checking its return lane.',
      'Поєднайте ближні острови літер короткими замиканнями або перетніть вертикальний потік після перевірки смуги повернення.',
    ],
    scene:
      'Original typographic reading room with oversized native-text placeholders for І, Ї and Україна, clear high-contrast cards and quiet fabric textures; preserve real glyphs through the interface.',
  },
  {
    names: ['A Dish and Its People', 'Страва та її люди'],
    briefs: [
      'Connect the kitchen-story tables and discover why a cooking practice includes more than ingredients.',
      'З’єднайте столи кухонних історій і дізнайтеся, чому кулінарна практика ширша за інгредієнти.',
    ],
    teasers: [
      'The borscht record includes cooking, sharing and passing knowledge on.',
      'Запис про борщ поєднує приготування, частування та передачу знань.',
    ],
    text: [
      [
        'UNESCO inscribed the culture of Ukrainian borscht cooking on the Urgent Safeguarding List in 2022. The record describes a cooking and social practice passed on in families and communities.',
        'Our fictional recipe card has room for ingredients, who shared the recipe and when the dish is made. Which of those details would disappear from an ingredient-only list? Keep the person’s own account instead of assuming all households cook or serve a dish in the same way.',
      ],
      [
        'ЮНЕСКО внесло культуру приготування українського борщу до Списку термінової охорони 2022 року. Запис описує кулінарну й соціальну практику, яку передають у родинах та спільнотах.',
        'У вигаданій картці рецепта є місце для складників, імені того, хто поділився рецептом, та нагоди приготування. Що зникне зі списку лише інгредієнтів? Збережіть власну розповідь людини, не припускаючи, що всі родини готують або подають страву однаково.',
      ],
    ],
    refs: ['borscht'],
    routes: [
      'Secure the shorter kitchen-story bay or use the flow to reach the far table while keeping a complete return outside the warning lane.',
      'Закріпіть коротшу залу кухонних історій або скористайтеся потоком до дальнього столу, зберігаючи повне повернення поза смугою попередження.',
    ],
    scene:
      'Original civilian kitchen-story exhibition with ingredient silhouettes, a steaming illustrated bowl and blank family-recipe cards; no single claimed authentic recipe or documentary family photograph.',
  },
  {
    names: ['A Bowl with a Record', 'Миска з описом'],
    briefs: [
      'Open the quieter vessel court and connect its labels before revealing the central cabinet.',
      'Відкрийте спокійніше подвір’я посуду та поєднайте підписи перед центральною вітриною.',
    ],
    teasers: [
      'An everyday ceramic vessel can become a carefully recorded museum object.',
      'Повсякденна керамічна посудина може стати ретельно описаним музейним предметом.',
    ],
    text: [
      [
        'The Museum Fund of Ukraine records a twentieth-century makitra in Novoarkhanhelsk’s local-history museum. Its entry names pottery ceramic, firing, dimensions and a hand-made vessel with coloured decoration.',
        'Our fictional object card separates recorded measurements from imagined use. Look at a bowl-like silhouette and ask what its label actually establishes. A museum record can leave a maker unknown; an attractive story should not fill that gap with an invented person.',
      ],
      [
        'Музейний фонд України описує макітру XX століття з Новоархангельського краєзнавчого музею. Запис називає гончарну кераміку, випал, розміри та ручне виготовлення посудини з кольоровим оздобленням.',
        'Вигадана картка предмета відокремлює записані розміри від уявного використання. Подивіться на силует миски та запитайте, що саме підтверджує підпис. Музейний запис може не називати автора; цікава історія не має заповнювати прогалину вигаданою людиною.',
      ],
    ],
    refs: ['makitra'],
    routes: [
      'Connect the source objective from the broad display foundation or take the outer alcove before approaching the central encounter.',
      'З’єднайте ціль джерела з широкої виставкової основи або захопіть зовнішню нішу перед наближенням до центральної зустрічі.',
    ],
    scene:
      'Original spacious ceramics reading room with a generic bowl silhouette, measurement lines and enlarged source card; no facsimile of the Novoarkhanhelsk photograph or invented maker portrait.',
  },
  {
    names: ['Two Recipe Cards', 'Дві картки рецептів'],
    briefs: [
      'Connect two recipe-story stations and compare their contexts without choosing a single winning household.',
      'З’єднайте дві станції рецептів і порівняйте контексти без вибору єдиної правильної родини.',
    ],
    teasers: [
      'Variation can be part of a shared cooking tradition.',
      'Відмінності можуть бути частиною спільної кулінарної традиції.',
    ],
    text: [
      [
        'UNESCO’s borscht account describes a practice with varied ingredients and ways of preparation. Its significance includes hospitality, family and community settings, not only one fixed recipe.',
        'Compare two invented cards: one says “our weekday version,” the other “our celebration version.” Ask their authors what changes and why. Preserve those explanations as examples. The task rewards an explainable comparison; it does not rank someone’s belonging by what they eat.',
      ],
      [
        'Розповідь ЮНЕСКО про борщ описує практику з різними складниками та способами приготування. Її значення охоплює гостинність, родинні й громадські обставини, а не лише один сталий рецепт.',
        'Порівняйте дві вигадані картки: «наш буденний варіант» і «наш святковий варіант». Запитайте авторів, що змінюється й чому. Збережіть пояснення як приклади. Вправа заохочує зрозуміле порівняння, а не оцінює належність людини за її їжею.',
      ],
    ],
    refs: ['borscht'],
    routes: [
      'Open the numbered recipe return before the second station or connect both source objectives from separate safe islands.',
      'Відкрийте нумероване повернення рецепта перед другою станцією або поєднайте обидві цілі джерел з окремих безпечних островів.',
    ],
    scene:
      'Original two-table recipe exhibit with contrasting weekday and celebration settings, coral and cream cards and clear source labels; original fictional examples, no documentary family claim or prescriptive authentic recipe.',
  },
  {
    names: ['Make Room for Another Story', 'Залиште місце для ще однієї історії'],
    briefs: [
      'Complete the welcome book and leave space for the next person’s voice.',
      'Завершіть книгу гостинності та залиште місце для голосу наступної людини.',
    ],
    teasers: [
      'A useful cultural collection can invite questions instead of closing them.',
      'Корисна культурна колекція запрошує запитання, а не закриває їх.',
    ],
    text: [
      [
        'Your discoveries now connect everyday words, readable letters, cooking practices and a documented household object. The linked Ukrainian Institute guide offers a route for continuing to read names and words with care.',
        'Finish our fictional welcome book with one new question and an empty contribution card. Explain which details came from a source and which you invented for the scene. Sharing the collection can open a conversation; completing it does not give anyone authority to speak for every Ukrainian.',
      ],
      [
        'Ваші відкриття поєднують щоденні слова, читабельні літери, кулінарні практики та документований побутовий предмет. Посібник Українського інституту за посиланням допомагає продовжувати уважно читати імена й слова.',
        'Завершіть вигадану книгу гостинності новим запитанням і порожньою карткою для внеску. Поясніть, що взято з джерела, а що ви вигадали для сцени. Поширення колекції починає розмову; її завершення не надає права говорити від імені всіх українців.',
      ],
    ],
    refs: ['alphabet'],
    routes: [
      'Open both numbered returns and follow a safe flow to the final source or keep the longer outer circuit for the closing encounter.',
      'Відкрийте обидва нумеровані повернення та скористайтеся безпечним потоком до останнього джерела або збережіть довший зовнішній обхід для фінальної зустрічі.',
    ],
    scene:
      'Original welcoming six-section cultural reading room with an open blank contribution card and a completed source-linked book; warm coral light, spacious tables, no claim to represent all Ukrainian homes.',
  },
];
