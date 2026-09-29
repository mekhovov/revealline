// Original bilingual discovery fixtures. Source-specific facts remain attributed;
// linked museum and maker images are not imported or licensed by this module.
export const CULTURE_SOURCES = {
  petrykivka: {
    title: 'UNESCO — Petrykivka decorative painting, inscription decision 2013',
    url: 'https://ich.unesco.org/en/Decisions/8.COM/8.29',
  },
  pataPortrait: {
    title: 'Dnipro National Historical Museum — Fedir Panko, My Teacher, 1980',
    url: 'https://www.museum.dp.ua/uk/object_8-8/',
  },
  kosiv: {
    title: 'UNESCO — Tradition of Kosiv painted ceramics',
    url: 'https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456',
  },
  kosivObjects: {
    title: 'Ukrainian Museum of Canada, Ontario — Kosiv Bazaar objects and makers',
    url: 'https://www.umcontario.com/kosiv-bazaar',
  },
  pysanka: {
    title: 'UNESCO — Pysanka, Ukrainian tradition and art of decorating eggs',
    url: 'https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134',
  },
  pysankaCommunity: {
    title: 'Ukrainian Institute of America — Pysanka: A Symbol of Hope',
    url: 'https://pysanka.ukrainianinstitute.org/',
  },
  ornek: {
    title: 'UNESCO — Ornek, a Crimean Tatar ornament and knowledge about it, decision 2021',
    url: 'https://ich.unesco.org/en/decisions/16.COM/8.B.45',
  },
  ornekMakers: {
    title: 'UNESCO — Attributed Crimean Tatar Ornek works and makers',
    url: 'https://ich.unesco.org/en/8b-representative-list-01191?call=slideshow&id=01601&include=slideshow_inc.php&mode=scroll',
  },
  ornekMiras: {
    title: 'Alem / National Museum of the History of Ukraine — MIRAS: Ornek and its makers',
    url: 'https://www.ornek-crimea.com/stories-of-crimea-ua/stories-miras-ornek',
  },
  skybin: {
    title: 'Rustem Skybin — The artist on his practice and Quru Isar',
    url: 'https://www.rustemskybin.com/pages/about',
  },
  alem: {
    title: 'Alem — Crimean Tatar heritage organization',
    url: 'https://www.ornek-crimea.com/',
  },
};

export const CULTURE_CAMPAIGNS = [
  [
    'ukraine-colour-clay-spring',
    'ukraine-culture',
    'Colour, Clay and Spring',
    'Колір, глина і весна',
    'A Cabinet of Living Crafts',
    'Вітрина живих ремесел',
    'pysanka',
    'gallery',
    'Arrange six discoveries as three related but distinct traditions: Petrykivka painting, Kosiv ceramics and pysanka. Keep a maker, material and source beside each example. The collection is a starting point for looking and asking questions, not a universal dictionary of Ukrainian symbols or a certificate of craft skill.',
    'Розташуйте шість відкриттів як три споріднені, але окремі традиції: петриківський розпис, косівська кераміка та писанкарство. Залиште поруч із кожним прикладом автора, матеріал і джерело. Колекція допомагає спостерігати й ставити запитання, а не замінює всі значення українських символів чи засвідчує ремісничу майстерність.',
    { stage: 2, band: 3 },
  ],
  [
    'ukraine-crimea-ornek',
    'ukraine-culture',
    'Crimea: Ornament and Community',
    'Крим: орнамент і спільнота',
    'Örnek: Makers, Objects and Voices',
    'Орьнек: майстри, предмети й голоси',
    'alem',
    'mosaic',
    'Bring together the six Crimean Tatar discoveries: a named tradition, an artisan’s composition, an object record, a teaching relationship, contemporary authorship and community stewardship. Follow the sources to hear the makers themselves. This fictional exhibition acknowledges Crimean Tatar knowledge; its arcade artwork does not reproduce or authenticate an Ornek composition.',
    'Поєднайте шість відкриттів про кримських татар: названу традицію, композицію майстра, опис предмета, передачу знань, сучасне авторство та опіку спільноти. Перейдіть до джерел, щоб почути самих майстрів. Вигадана виставка визнає кримськотатарські знання; її ігрові ілюстрації не відтворюють і не засвідчують справжність композиції Орьнеку.',
    { stage: 3, band: 5 },
  ],
];

export const CULTURE_LOOKS = {
  'ukraine-colour-clay-spring': {
    field: '#382744',
    land: '#76523D',
    accent: '#F6D86D',
    recipe: 'paper-tangle',
    enemy: 'Mixed exhibit label',
    genre: 'ambient',
    tempo: 96,
    root: 62,
  },
  'ukraine-crimea-ornek': {
    field: '#132D3D',
    land: '#376D77',
    accent: '#EDCE82',
    recipe: 'stale-fragments',
    enemy: 'Lost context',
    genre: 'ambient',
    tempo: 88,
    root: 60,
  },
};

export const CULTURE_MISSION_ROWS = {
  'ukraine-colour-clay-spring': [
    {
      names: ['A Painted Home', 'Розписана оселя'],
      briefs: [
        'Open the painted courtyard and reveal where a living craft can appear.',
        'Відкрийте розписане подвір’я та дізнайтеся, де живе ремесло.',
      ],
      teasers: [
        'A flower-filled tradition reaches beyond a framed picture.',
        'Квіткова традиція виходить за межі картини в рамі.',
      ],
      text: [
        [
          'UNESCO’s Petrykivka record describes painting on homes, household belongings and musical instruments. Its imaginative floral forms draw on close observation of local plants and animals. The practice was inscribed in 2013.',
          'Imagine three exhibit labels: a painted wall, a decorated household object and a paper study. The support changes how an artwork is seen. Describe the surface before guessing a flower’s meaning; our illustrated courtyard is an original scene, not a copied historic home.',
        ],
        [
          'Запис ЮНЕСКО про петриківський розпис описує оздоблення осель, побутових речей і музичних інструментів. Уявні квіткові форми спираються на спостереження місцевих рослин і тварин. Традицію внесено до списку 2013 року.',
          'Уявіть три підписи: розписана стіна, оздоблена побутова річ і паперовий етюд. Основа впливає на сприйняття твору. Опишіть поверхню перед здогадками про значення квітки; наше подвір’я — оригінальна ілюстрація, а не копія історичної оселі.',
        ],
      ],
      refs: ['petrykivka'],
      routes: [
        'Close the shallow courtyard first or use the paired garden islands to cross into the long painted wing.',
        'Спершу замкніть неглибоке подвір’я або перейдіть до довгого розписаного крила через парні садові острови.',
      ],
      scene:
        'Original imaginative exhibition courtyard: a whitewashed wall, a wooden household object and paper studies occupy different planes; lively flower-like colour gestures, no facsimile of a named artist or claimed historic mural.',
    },
    {
      names: ['The Teacher in the Portrait', 'Учителька на портреті'],
      briefs: [
        'Connect the portrait alcove with the study tables and keep both artists’ names visible.',
        'З’єднайте портретну нішу зі столами етюдів і збережіть імена обох митців.',
      ],
      teasers: [
        'One museum record connects a teacher and her student.',
        'Один музейний запис поєднує вчительку та її учня.',
      ],
      text: [
        [
          'The Dnipro National Historical Museum records Fedir Panko’s 1980 portrait My Teacher, depicting the Petrykivka artist Tetyana Pata. The museum identifies Panko as her student.',
          'An accurate label distinguishes the person pictured from the person who made the picture: “Tetyana Pata, portrayed by Fedir Panko.” Try describing what this relationship adds to a craft’s story. The linked museum image is a reference; the game’s gallery is a new illustration.',
        ],
        [
          'Дніпропетровський національний історичний музей описує портрет Федора Панка «Вчителька моя» 1980 року, на якому зображена петриківська майстриня Тетяна Пата. Музей називає Панка її учнем.',
          'Точний підпис розрізняє зображену людину й автора твору: «Тетяна Пата на портреті Федора Панка». Спробуйте пояснити, що цей зв’язок додає до історії ремесла. Музейне зображення доступне за посиланням; ігрова галерея — нова ілюстрація.',
        ],
      ],
      refs: ['pataPortrait'],
      routes: [
        'Take the portrait alcove through its short return or secure the wide study hall before entering the narrow side gallery.',
        'Захопіть портретну нішу з коротким поверненням або закріпіть широку залу етюдів перед вузькою бічною галереєю.',
      ],
      scene:
        'Original art-school gallery with an empty labelled portrait frame and two generations of worktables; warm daylight and brushes, no fabricated portrait of Pata or Panko and no museum image reproduction.',
    },
    {
      names: ['Clay, Glaze and Place', 'Глина, полива і місце'],
      briefs: [
        'Link the three kiln-yard bays and discover the named tradition behind their colours.',
        'Поєднайте три двори біля печі та відкрийте традицію, пов’язану з їхніми кольорами.',
      ],
      teasers: [
        'Green, yellow and brown lead to Kosiv, but colour alone cannot attribute an object.',
        'Зелений, жовтий і коричневий ведуть до Косова, та самого кольору для атрибуції замало.',
      ],
      text: [
        [
          'The Ukrainian Museum of Canada describes Kosiv painted ceramics as Hutsul folk art, often using green, yellow and brown on a white ground. Its exhibition includes useful vessels as well as decorative works. UNESCO inscribed the tradition in 2019.',
          'Our fictional cabinet contains two similarly coloured objects with different labels. A palette is a clue, not proof of maker, date or origin. Compare the recorded place and material before grouping the objects together.',
        ],
        [
          'Український музей Канади описує косівську мальовану кераміку як гуцульське народне мистецтво, часто із зеленим, жовтим і коричневим на білому тлі. На виставці є ужитковий посуд і декоративні твори. ЮНЕСКО внесло традицію до списку 2019 року.',
          'У вигаданій вітрині два подібні за кольором предмети мають різні підписи. Палітра — підказка, а не доказ авторства, дати чи походження. Порівняйте зазначені місце та матеріал, перш ніж об’єднувати предмети.',
        ],
      ],
      refs: ['kosivObjects', 'kosiv'],
      routes: [
        'Secure the low kiln-yard bay for a short retreat or link the offset display islands to capture the upper gallery.',
        'Закріпіть нижній двір для короткого відступу або поєднайте зміщені острови вітрин, щоб захопити верхню галерею.',
      ],
      scene:
        'Original ceramics museum courtyard with three generous display bays, green yellow and brown accents against cream clay vessels; no copied potter motifs, working kiln instructions or invented archaeological attribution.',
    },
    {
      names: ['Two Objects, Two Makers', 'Два предмети — два автори'],
      briefs: [
        'Explore the spacious vase and plate galleries without merging their object records.',
        'Дослідіть просторі галереї вази й тарелі, не змішуючи описи предметів.',
      ],
      teasers: [
        'Meet a 1997 vase and a 2004 plate through their museum labels.',
        'Познайомтеся з вазою 1997 року та тарелею 2004 року через музейні підписи.',
      ],
      text: [
        [
          'Kosiv Bazaar labels a clay-and-glaze vase by Oleksandra Shvets, dated 1997, and a decorative plate by Oksana Verbivska-Kabyn, dated 2004. These specific records reveal individual makers within a shared ceramic tradition.',
          'Read each source image with its own label. Shape, maker and date are three separate observations: a plate does not become a vase because its colours are similar. Which detail would you keep if a tiny mobile card had room for only one identifying sentence?',
        ],
        [
          'Виставка Kosiv Bazaar підписує вазу з глини й поливи Олександри Швець 1997 року та декоративну таріль Оксани Вербівської-Кабин 2004 року. Конкретні записи показують окремих майстринь у спільній керамічній традиції.',
          'Читайте кожне зображення джерела разом із його підписом. Форма, автор і дата — три окремі спостереження: таріль не стає вазою через подібні кольори. Яку деталь ви збережете, якщо на малій мобільній картці є місце лише для одного речення?',
        ],
      ],
      refs: ['kosivObjects'],
      routes: [
        'Cross the open centre for a broad reveal or follow the outer alcoves to inspect each display separately.',
        'Перетніть відкритий центр для широкого відкриття або рухайтеся зовнішніми нішами, оглядаючи вітрини окремо.',
      ],
      scene:
        'Original spacious ceramics exhibition with one tall vessel silhouette and one circular plate display; large readable caption cards, spring window light; do not imitate the linked artists’ exact works.',
    },
    {
      names: ['What the Wax Keeps', 'Що зберігає віск'],
      briefs: [
        'Connect the layered colour stations and reveal the idea behind wax-resist decoration.',
        'З’єднайте станції шарів кольору та відкрийте принцип воскового резерву.',
      ],
      teasers: [
        'A covered part of the egg keeps its earlier colour.',
        'Вкрита воском частина яйця зберігає попередній колір.',
      ],
      text: [
        [
          'UNESCO describes pysanka as egg decoration using wax to reserve areas while dye colours the uncovered surface. Repeated layers build a design. This is a description of the craft principle, not instructions for using heated wax.',
          'In our paper-only comparison, imagine a white shape protected while its surroundings turn blue. Removing the imaginary cover reveals the earlier white. Predict which part stays unchanged before looking at the next card; no real wax, dye or heat is needed.',
        ],
        [
          'ЮНЕСКО описує писанкарство як оздоблення яєць воском, що захищає ділянки, поки барвник забарвлює відкриту поверхню. Повторні шари утворюють малюнок. Це пояснення принципу ремесла, а не інструкція роботи з гарячим воском.',
          'У нашому уявному паперовому порівнянні біла фігура захищена, поки тло стає синім. Коли уявний захист знято, залишається попередній білий колір. Перед наступною карткою передбачте, яка частина не зміниться; справжні віск, барвник чи нагрівання не потрібні.',
        ],
      ],
      refs: ['pysanka'],
      routes: [
        'Build two short colour-band captures or use the central foundation to close a larger layered reveal.',
        'Зробіть два короткі захоплення кольорових смуг або замкніть більше багатошарове відкриття через центральну основу.',
      ],
      scene:
        'Original paper teaching display of three egg-shaped silhouettes and protected white shapes against successive colours, visibly a conceptual diagram rather than an authentic regional pysanka or a heated workshop.',
    },
    {
      names: ['A Gift with a Story', 'Подарунок з історією'],
      briefs: [
        'Bring the painted-home, ceramic and spring galleries into one clearly attributed exhibition.',
        'Поєднайте розписану оселю, кераміку й весняну галерею у виставку з точними підписами.',
      ],
      teasers: [
        'A craft travels with its people, its maker and its message.',
        'Ремесло подорожує разом із людьми, автором і повідомленням.',
      ],
      text: [
        [
          'The 2024 UNESCO inscription for pysanka is shared by Estonia and Ukraine. The Ukrainian Institute of America’s Pysanka: A Symbol of Hope presents a collective installation curated by artist Sofika Zielyk.',
          'For our fictional exhibition gift, choose an honest message such as “I made this new design for you.” Record your name and inspiration. Do not assign a traditional meaning to an invented mark. Your six discoveries now form a cabinet of distinct practices and people, ready to revisit.',
        ],
        [
          'Внесення писанкарства до списку ЮНЕСКО 2024 року є спільним для Естонії та України. Проєкт Українського інституту Америки Pysanka: A Symbol of Hope представляє колективну інсталяцію, кураторкою якої є мисткиня Софійка Зелик.',
          'Для подарунка вигаданої виставки оберіть чесне повідомлення: «Я створив цей новий малюнок для тебе». Зазначте своє ім’я та натхнення. Не приписуйте традиційного значення вигаданому знаку. Шість відкриттів утворюють вітрину окремих практик і людей, до якої можна повернутися.',
        ],
      ],
      refs: ['pysanka', 'pysankaCommunity'],
      routes: [
        'Secure the three exhibition wings separately or connect the central islands before opening the finale court.',
        'Закріпіть три крила виставки окремо або поєднайте центральні острови перед відкриттям фінального двору.',
      ],
      scene:
        'Original spring museum gathering with three distinctly framed display zones for painted surfaces, ceramics and paper egg studies; blank personal gift card as focal point, no copied community installation or claimed traditional symbol.',
    },
  ],
  'ukraine-crimea-ornek': [
    {
      names: ['Name the Tradition', 'Назвіть традицію'],
      briefs: [
        'Open the Crimean Tatar exhibition court and keep the tradition’s name with its story.',
        'Відкрийте подвір’я кримськотатарської виставки та збережіть назву традиції поруч з історією.',
      ],
      teasers: [
        'Örnek includes knowledge, people and composition—not just decoration.',
        'Орьнек поєднує знання, людей і композицію, а не лише оздоблення.',
      ],
      text: [
        [
          'UNESCO inscribed Ornek, a Crimean Tatar ornament and knowledge about it, in 2021. Its record describes symbols arranged into meaningful compositions across several crafts, including embroidery, weaving and pottery.',
          'Our first label names the community and practice before describing colour. Keep “Crimean Tatar” and “Örnek” beside the source, rather than relabelling any attractive pattern as generic Ukrainian ornament. The fictional arcade court is an invitation to learn, not an authentic Ornek design.',
        ],
        [
          'ЮНЕСКО внесло «Орьнек — кримськотатарський орнамент та знання про нього» до списку 2021 року. Запис описує символи, поєднані у змістовні композиції в різних ремеслах, зокрема вишивці, ткацтві й гончарстві.',
          'Наш перший підпис називає спільноту та практику перед описом кольору. Збережіть слова «кримськотатарський» та «Орьнек» поруч із джерелом, не називаючи будь-який гарний візерунок узагальненим українським орнаментом. Вигадане ігрове подвір’я запрошує вчитися, а не представляє автентичний Орьнек.',
        ],
      ],
      refs: ['ornek'],
      routes: [
        'Connect the short introductory alcoves or preserve the central return while revealing the long context wall.',
        'Поєднайте короткі вступні ніші або збережіть центральне повернення, відкриваючи довгу стіну контексту.',
      ],
      scene:
        'Original Crimean Tatar heritage exhibition entrance with generous blank caption panels, warm gold light and turquoise architectural accents; no fabricated ethnic costume, historic building or pseudo-Ornek motif.',
    },
    {
      names: ['A Composition for Someone', 'Композиція для людини'],
      briefs: [
        'Link the maker’s desk and the visitor’s brief while preserving the meaning between them.',
        'Поєднайте стіл майстра та задум відвідувача, зберігаючи зміст між ними.',
      ],
      teasers: [
        'An attributed embroidered panel begins with a conversation.',
        'Вишитий твір із зазначеною авторкою починається з розмови.',
      ],
      text: [
        [
          'UNESCO’s nomination photographs identify an embroidered panel by Elvira Osmanova, commissioned for an interior. The caption explains that customers can ask an artisan for a composition carrying a particular meaning.',
          'In the MIRAS account, Esma Adzhiieva explains a tulip within a rose as marriage. Attribute that interpretation to its source; do not apply it to every floral picture. For our fictional visitor’s welcoming message, ask a knowledgeable maker how to express the request instead of selecting a random flower.',
        ],
        [
          'Фотографії номінації ЮНЕСКО називають Ельвіру Османову авторкою вишитого панно на замовлення для інтер’єру. Підпис пояснює, що замовники можуть просити майстра створити композицію з певним змістом.',
          'У розповіді MIRAS Есма Аджієва пояснює тюльпан усередині троянди як шлюб. Зазначте джерело цього тлумачення; не застосовуйте його до кожного квіткового малюнка. Щоб передати гостинність вигаданого відвідувача, запитайте обізнаного майстра, як висловити побажання, замість вибору випадкової квітки.',
        ],
      ],
      refs: ['ornekMakers', 'ornekMiras'],
      routes: [
        'Use the paired consultation bays for short closures or take the diagonal open space between the two workstations.',
        'Скористайтеся парними нішами розмови для коротких замикань або відкритим простором навскіс між двома станціями.',
      ],
      scene:
        'Original exhibition planning room with separate visitor and artisan desks, blank sketch paper and a captioned textile silhouette; no imitation of Elvira Osmanova’s panel and no invented translated symbol dictionary.',
    },
    {
      names: ['Read the Object Record', 'Прочитайте опис предмета'],
      briefs: [
        'Connect the garment, metalwork and woven-object bays without losing their labels.',
        'З’єднайте зали вбрання, металу й тканини, не втрачаючи підписи.',
      ],
      teasers: [
        'A named Crimean belt has a place, period and museum collection.',
        'Названий кримський пояс має місце, період і музейну колекцію.',
      ],
      text: [
        [
          'Alem and the National Museum of the History of Ukraine’s MIRAS account identifies a women’s qushaq belt from Crimea, dated to the late nineteenth or early twentieth century, in the museum’s Treasury collection.',
          'Separate the documented record from your own observation: “The label dates this belt” is different from “I notice repeated shapes.” Do not infer a wearer’s biography from ornament alone. Our display silhouette is illustrative; the linked record holds the actual object image and attribution.',
        ],
        [
          'Розповідь про MIRAS від «Алєм» і Національного музею історії України описує жіночий пояс кушак із Криму кінця XIX — початку XX століття зі збірки Скарбниці музею.',
          'Відокремте документований опис від власного спостереження: «Підпис датує пояс» — не те саме, що «Я бачу повторювані форми». Не виводьте біографію власниці лише з орнаменту. Силует у нашій вітрині ілюстративний; справжнє зображення та атрибуція містяться за посиланням.',
        ],
      ],
      refs: ['ornekMiras'],
      routes: [
        'Capture the three offset record bays in sequence or keep the lower foundation as a shared return for two larger loops.',
        'Захоплюйте три зміщені зали послідовно або збережіть нижню основу як спільне повернення для двох більших петель.',
      ],
      scene:
        'Original museum reading room with three separated media cabinets, an abstract belt silhouette and enlarged blank object-record card; no replica of a protected museum photograph or invented attribution.',
    },
    {
      names: ['Knowledge Has Teachers', 'У знань є вчителі'],
      briefs: [
        'Open the quieter learning courtyard and connect the teacher and apprentice tables.',
        'Відкрийте спокійніше навчальне подвір’я та з’єднайте столи вчителя й учня.',
      ],
      teasers: [
        'A jeweller’s skill continues through people who learn it.',
        'Майстерність ювеліра продовжується в людях, які її вивчають.',
      ],
      text: [
        [
          'The MIRAS account describes the Bakhchysarai jeweller Ayder Asanov teaching Crimean Tatar filigree to family members and other students. A finished object and the knowledge needed to make it are related parts of heritage.',
          'Imagine an exhibit with a tool, a finished work and a maker’s explanation. Which helps you see the result, and which helps you understand the practice? Looking at the tool alone does not teach the skill. Follow a named teacher’s account instead of treating a decorative image as a complete lesson.',
        ],
        [
          'Розповідь MIRAS описує, як бахчисарайський ювелір Айдер Асанов передавав кримськотатарську філігрань рідним та іншим учням. Готовий предмет і знання для його створення — пов’язані частини спадщини.',
          'Уявіть виставку з інструментом, готовим твором і поясненням майстра. Що показує результат, а що допомагає зрозуміти практику? Сам погляд на інструмент не навчає ремесла. Зверніться до розповіді названого вчителя, не сприймаючи декоративне зображення як повний урок.',
        ],
      ],
      refs: ['ornekMiras'],
      routes: [
        'Take the broad quiet courtyard first or use its sheltered side alcoves to make several short returns.',
        'Спершу відкрийте широке тихе подвір’я або скористайтеся захищеними бічними нішами для кількох коротких повернень.',
      ],
      scene:
        'Original luminous learning courtyard with two empty craft tables, tool silhouettes and three museum caption stands; no invented portrait or biographical scene of Ayder Asanov, no technical metalworking instructions.',
    },
    {
      names: ['A Living Author’s Voice', 'Голос сучасного автора'],
      briefs: [
        'Connect the research cabinet to the contemporary ceramics wing and retain both tradition and authorship.',
        'З’єднайте дослідницьку вітрину з крилом сучасної кераміки, зберігаючи традицію та авторство.',
      ],
      teasers: [
        'Rustem Skybin names a personal ceramic style rooted in research.',
        'Рустем Скибін називає власний керамічний стиль, що виріс із досліджень.',
      ],
      text: [
        [
          'Rustem Skybin’s own biography describes developing his Quru Isar ceramic style using materials collected and interpreted by artist and researcher Mamut Churlu. The account places an individual artistic practice alongside Crimean Tatar heritage.',
          'A careful label can name both: “a contemporary work by this artist” and “a practice informed by this tradition.” That is more useful than calling every new object ancient. Our fictional gallery celebrates authorship without copying Skybin’s designs or claiming his endorsement.',
        ],
        [
          'У власній біографії Рустем Скибін описує розвиток керамічного стилю Quru Isar на основі матеріалів, зібраних і осмислених художником та дослідником Мамутом Чурлу. Розповідь поєднує особисту творчу практику з кримськотатарською спадщиною.',
          'Уважний підпис називає обидва: «сучасний твір цього автора» та «практика, пов’язана з цією традицією». Це корисніше, ніж називати кожен новий предмет стародавнім. Наша вигадана галерея цінує авторство, не копіюючи дизайни Скибіна й не заявляючи про його підтримку гри.',
        ],
      ],
      refs: ['skybin'],
      routes: [
        'Preserve two short returns through the archive islands or capture the longer contemporary wing after checking the moving boundary.',
        'Збережіть два короткі повернення через архівні острови або захопіть довше сучасне крило після перевірки рухомої межі.',
      ],
      scene:
        'Original contemporary ceramics gallery with archive drawers, abstract unornamented clay forms and bright maker-label panels; no copying of Rustem Skybin’s Quru Isar works or implying his endorsement.',
    },
    {
      names: ['Keep the Voices Together', 'Збережіть голоси разом'],
      briefs: [
        'Complete the six-part exhibition while keeping community, maker, object and source connected.',
        'Завершіть виставку з шести частин, зберігаючи зв’язок спільноти, майстра, предмета та джерела.',
      ],
      teasers: [
        'The finale is a route back to living Crimean Tatar knowledge.',
        'Фінал повертає до живих кримськотатарських знань.',
      ],
      text: [
        [
          'Alem describes its work as safeguarding the intangible cultural heritage of Crimean Tatars, an Indigenous people of Ukraine. Its work brings culture bearers, practitioners and researchers together.',
          'Curate our six cards with four questions: who speaks, what object or practice is described, which source supports it, and what remains unknown? Keep the answers visible when sharing the collection. Completing an arcade campaign gives you a useful reading trail; community knowledge and individual image rights remain with their holders.',
        ],
        [
          '«Алєм» описує свою роботу як охорону нематеріальної культурної спадщини кримських татар, корінного народу України. Організація об’єднує носіїв культури, практиків і дослідників.',
          'Упорядкуйте шість карток за чотирма запитаннями: хто говорить, який предмет чи практику описано, яке джерело це підтверджує і що невідомо? Збережіть відповіді під час поширення колекції. Завершення гри відкриває корисний маршрут читання; знання спільноти та права на зображення залишаються за їхніми носіями.',
        ],
      ],
      refs: ['alem'],
      routes: [
        'Secure the small source alcoves before the large exhibit loop or connect the two central foundations to retain a shorter final return.',
        'Закріпіть малі ніші джерел перед великою петлею виставки або поєднайте дві центральні основи для коротшого фінального повернення.',
      ],
      scene:
        'Original six-part Crimean Tatar knowledge exhibition with connected caption stations and an inviting library exit; turquoise and warm brass ambience, visible source-card motif, no fabricated sacred imagery or community documentary scene.',
    },
  ],
};
