// Original civilian educational fixtures. Sources were reviewed on 2026-09-28.
// Source links support the short factual introductions, not the fictional tasks,
// arcade routes, illustrations or a claim of manufacturer/organization endorsement.
export const FPV_SOURCES = {
  fpvAssembly: {
    title: 'PX4 — Assembling a Multicopter (manufacturer-specific examples)',
    url: 'https://docs.px4.io/main/en/assembly/',
  },
  fpvBoardGuide: {
    title: 'PX4 — Pixhawk 4 Wiring Quick Start (specific board only)',
    url: 'https://docs.px4.io/main/en/assembly/quick_start_pixhawk4',
  },
  fpvScience: {
    title: 'NASA — Science Behind Quadcopters, educator guide',
    url: 'https://www.nasa.gov/wp-content/uploads/2020/05/aam-science-behind-quadcopters-educator-guide_1.pdf',
  },
  fpvSolderTools: {
    title: 'Adafruit — Excellent Soldering: Tools',
    url: 'https://learn.adafruit.com/adafruit-guide-excellent-soldering',
  },
  fpvSolderPrep: {
    title: 'Adafruit — Excellent Soldering: Preparation',
    url: 'https://learn.adafruit.com/adafruit-guide-excellent-soldering/preparation',
  },
  fpvSolderJoint: {
    title: 'Adafruit — Making a good solder joint',
    url: 'https://learn.adafruit.com/adafruit-guide-excellent-soldering/making-a-good-solder-joint',
  },
  fpvSolderFaults: {
    title: 'Adafruit — Common soldering problems',
    url: 'https://learn.adafruit.com/adafruit-guide-excellent-soldering/common-problems',
  },
  fpvSolderEvidence: {
    title: 'Adafruit — Soldering FAQ',
    url: 'https://learn.adafruit.com/adafruit-guide-excellent-soldering/soldering-faq',
  },
  fpvFumes: {
    title: 'UK HSE — Electronics soldering: fume controls',
    url: 'https://www.hse.gov.uk/lung-disease/electronics-soldering.htm',
  },
  fpvStickModes: {
    title: 'ArduPilot — Radio control: Mode 1 and Mode 2',
    url: 'https://ardupilot.org/copter/docs/common-radio-control-calibration.html',
  },
  fpvManual: {
    title: 'PX4 — Manual/Stabilized multicopter mode',
    url: 'https://docs.px4.io/main/en/flight_modes_mc/manual_stabilized',
  },
  fpvPosition: {
    title: 'PX4 — Position multicopter mode',
    url: 'https://docs.px4.io/main/en/flight_modes_mc/position',
  },
  fpvSimulation: {
    title: 'NASA — Package Delivery Drone Simulation classroom activity',
    url: 'https://www.nasa.gov/stem-content/package-delivery-drone-simulation/',
  },
  fpvAirframes: {
    title: 'PX4 — Vehicle Types and Setup',
    url: 'https://docs.px4.io/main/en/airframes/',
  },
  fpvWings: {
    title: 'NASA Glenn — Airplane Parts and Function',
    url: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/airplane-parts-function/',
  },
  fpvView: {
    title: 'EASA — First Person View: goggles and drone racing',
    url: 'https://www.easa.europa.eu/en/light/topics/drone-racing-and-flying-drone-goggles-first-person-view-fpv',
  },
  fpvSport: {
    title: 'FAI — Drone Racing World Cup',
    url: 'https://www.fai.org/event/fai-drone-racing-world-cup',
  },
  fpvDelivery: {
    title: 'NASA — Drone package delivery research, 2024',
    url: 'https://www.nasa.gov/aeronautics/drones/delivering-closer-to-reality/',
  },
  fpvRecovery: {
    title: 'UNDP — Chernihiv reconstruction and image-based assessment, 2023',
    url: 'https://www.undp.org/ukraine/press-releases/latvia-targets-2-million-euro-reconstruction-efforts-chernihiv-oblast',
  },
  fpvHumanitarian: {
    title: 'UNDP — Aerial detection technology for SESU humanitarian teams, 2025',
    url: 'https://www.undp.org/ukraine/press-releases/undp-equips-sesu-cutting-edge-ukrainian-aerial-detection-technology-accelerate-humanitarian-demining-operations',
  },
  fpvImageResearch: {
    title: 'UNDP — AI Data Jam image-analysis research, 2025',
    url: 'https://www.undp.org/ukraine/press-releases/ai-demining-ukrainian-innovators-train-algorithms-detect-explosives-drone-images',
  },
  fpvHistory: {
    title: 'UNITED24 — Army of Drones programme announcement, 2022',
    url: 'https://u24.gov.ua/news/army_of_drones',
  },
  fpvMineAwareness: {
    title: 'UNICEF Ukraine — Safety education for children and youth, 2025',
    url: 'https://www.unicef.org/ukraine/en/stories/fostering-culture-safety-among-children-and-youth-making-mine-safety-rules-known-children',
  },
  fpvRepairSafety: {
    title: 'iFixit — Device Safety',
    url: 'https://www.ifixit.com/Info/Device_Safety',
  },
  fpvBattery: {
    title: 'iFixit — What to do with a swollen battery',
    url: 'https://www.ifixit.com/Wiki/What_to_do_with_a_swollen_battery',
  },
  fpvRecycling: {
    title: 'US EPA — Lithium-ion battery facts and disposal, 2023',
    url: 'https://www.epa.gov/system/files/documents/2023-09/Lithium-Ion-Batteries-Fact-Sheet-8-2023.pdf',
  },
};

export const FPV_CAMPAIGNS = [
  [
    'fpv-parts-bench',
    'fpv-learning',
    'From Parts to a Bench Model',
    'Від деталей до настільної моделі',
    'The Unpowered Workshop Atlas',
    'Атлас майстерні без живлення',
    'fpvAssembly',
    'gallery',
    'Arrange six evidence cards around an unpowered civilian display model: inventory, orientation, component roles, compatibility questions, inspection and handoff. The exhibit deliberately omits live wiring, firmware setup and flight authorization. Identify which answers require the exact manufacturer manual before any real workshop activity.',
    'Розмістіть шість карток довкола цивільної виставкової моделі без живлення: перелік деталей, орієнтація, ролі, питання сумісності, огляд і передача справ. Виставка навмисно не містить підключення живлення, налаштування прошивки чи дозволу на політ. Визначте, які відповіді потребують інструкції саме вашого виробника перед реальною роботою.',
    { stage: 2, band: 3 },
  ],
  [
    'fpv-soldering-workshop',
    'fpv-learning',
    'Soldering Workshop',
    'Майстерня паяння',
    'A Practice Board, Carefully Explained',
    'Навчальна плата з поясненнями',
    'fpvSolderJoint',
    'mosaic',
    'Build a practice-board exhibit from workspace preparation, material labels, stable parts, heat transfer, inspection and a repair decision. The fictional board has no battery or aircraft electronics. Explain one observation and one reason to stop and ask an instructor. A picture of a joint cannot certify electrical or mechanical reliability.',
    'Зберіть виставку навчальної плати: підготовка місця, позначення матеріалів, фіксація деталей, передавання тепла, огляд і рішення щодо ремонту. Вигадана плата не має акумулятора чи електроніки дрона. Поясніть одне спостереження й одну причину зупинитися та звернутися до наставника. Зображення з’єднання не підтверджує його електричну або механічну надійність.',
    { stage: 3, band: 4 },
  ],
  [
    'fpv-four-controls',
    'fpv-learning',
    'Understand the Four Controls',
    'Зрозумійте чотири органи керування',
    'The Control and Response Atlas',
    'Атлас керування та реакцій',
    'fpvStickModes',
    'gallery',
    'Complete a two-part control atlas: where a command is placed in the illustrated Mode 2 layout, and what the selected model does with it. Compare pitch, roll, yaw and throttle without treating a stick location as a universal aircraft response. Use the optional untimed control lab to explain a prediction, not to claim flight proficiency.',
    'Завершіть атлас із двох частин: де розміщено команду на ілюстрованому пульті Mode 2 і як на неї реагує обрана модель. Порівняйте тангаж, крен, рискання та газ, не ототожнюючи положення стіка з універсальною реакцією дрона. У необов’язковій лабораторії без таймера поясніть прогноз; це не підтвердження льотної майстерності.',
    { stage: 3, band: 4 },
  ],
  [
    'fpv-first-flight',
    'fpv-learning',
    'First Flight Patterns',
    'Перші схеми польоту',
    'The Civilian Practice Notebook',
    'Щоденник цивільних вправ',
    'fpvSimulation',
    'route',
    'Collect six planning cards for a fictional indoor gym: start and stop, height, straight travel, lateral travel, turns and a joined route. Each card states its simplified model assumptions. The optional practice package tracks its own exercises; arcade victories unlock this notebook, not real-flight qualifications or simulator completions.',
    'Зберіть шість карток планування для вигаданої зали: початок і зупинка, висота, рух прямо, рух убік, повороти та спільний маршрут. На кожній зазначено припущення спрощеної моделі. Необов’язковий пакет практики окремо обліковує вправи; аркадні перемоги відкривають цей щоденник, а не льотну кваліфікацію чи проходження симулятора.',
    { stage: 4, band: 6 },
  ],
  [
    'fpv-drone-families',
    'fpv-learning',
    'Drone Families',
    'Родини дронів',
    'An Atlas of Different Questions',
    'Атлас різних завдань',
    'fpvAirframes',
    'gallery',
    'Curate six comparison cards using separate columns for airframe, viewing method, control assistance and civilian purpose. A racing craft, survey aircraft and classroom model answer different questions. Keep uncertainty visible: appearance alone does not establish autonomy, capability or permission to operate.',
    'Упорядкуйте шість карток з окремими графами для конструкції, способу спостереження, допомоги керуванню та цивільної мети. Перегоновий дрон, апарат для знімання та навчальна модель розв’язують різні завдання. Залишайте невизначеність видимою: зовнішність не доводить автономність, можливості чи дозвіл на використання.',
    { stage: 4, band: 5 },
  ],
  [
    'fpv-drones-ukraine',
    'fpv-learning',
    'Drones in Ukraine',
    'Дрони в Україні',
    'A Source-Led Civilian Context Exhibit',
    'Виставка контексту з перевірними джерелами',
    'fpvRecovery',
    'mosaic',
    'Complete a dated exhibit about reconstruction, humanitarian research, public education and the historical defence context. Distinguish an organization’s report, a pilot study and your own interpretation. Use fictional locations and no operational details. Responsible understanding includes what an image cannot prove and which work belongs to qualified specialists.',
    'Завершіть датовану виставку про відбудову, гуманітарні дослідження, просвіту та історичний оборонний контекст. Розрізняйте повідомлення організації, пілотне дослідження й власний висновок. Використовуйте вигадані місця без оперативних подробиць. Відповідальне розуміння охоплює межі доказовості зображення та роботу, яку виконують лише фахівці.',
    { stage: 4, band: 6 },
  ],
  [
    'fpv-care-repair',
    'fpv-learning',
    'Care, Diagnosis and Repair Decisions',
    'Догляд, діагностика та рішення про ремонт',
    'The Evidence Before Action Notebook',
    'Щоденник доказів перед дією',
    'fpvRepairSafety',
    'route',
    'Build a handoff from an observation, an unpowered inspection, a bounded comparison, a battery stop decision, a repair boundary and a disposal question. Keep symptom, possible cause and confirmed finding separate. The fictional training model never becomes flight-ready because a card was collected; the next real action belongs to the appropriate manual and qualified person.',
    'Складіть передачу справ зі спостереження, огляду без живлення, обмеженого порівняння, рішення зупинитися через акумулятор, меж ремонту й питання утилізації. Розрізняйте симптом, можливу причину та підтверджений висновок. Збирання карток не робить навчальну модель готовою до польоту; наступну реальну дію визначають відповідна інструкція та фахівець.',
    { stage: 5, band: 7 },
  ],
];
export const FPV_LOOKS = {
  'fpv-parts-bench': {
    field: '#172A38',
    land: '#476879',
    accent: '#FFD284',
    recipe: 'stale-fragments',
    enemy: 'Unlabelled part',
    genre: 'ambient',
    tempo: 86,
    root: 60,
  },
  'fpv-soldering-workshop': {
    field: '#2C2432',
    land: '#6D566C',
    accent: '#FFD49E',
    recipe: 'missing-cloud',
    enemy: 'Unclear joint',
    genre: 'ambient',
    tempo: 88,
    root: 62,
  },
  'fpv-four-controls': {
    field: '#192C40',
    land: '#426F96',
    accent: '#8DE1E8',
    recipe: 'paper-tangle',
    enemy: 'Mixed command',
    genre: 'chiptune',
    tempo: 104,
    root: 64,
  },
  'fpv-first-flight': {
    field: '#172F39',
    land: '#417A80',
    accent: '#FFE196',
    recipe: 'stale-fragments',
    enemy: 'Drifting assumption',
    genre: 'chiptune',
    tempo: 112,
    root: 65,
  },
  'fpv-drone-families': {
    field: '#292C43',
    land: '#656A91',
    accent: '#D9C5FF',
    recipe: 'missing-cloud',
    enemy: 'Missing context',
    genre: 'ambient',
    tempo: 94,
    root: 67,
  },
  'fpv-drones-ukraine': {
    field: '#162E49',
    land: '#456A8D',
    accent: '#F7D568',
    recipe: 'paper-tangle',
    enemy: 'Unverified claim',
    genre: 'ambient',
    tempo: 82,
    root: 62,
  },
  'fpv-care-repair': {
    field: '#213735',
    land: '#547A6C',
    accent: '#CDEB9B',
    recipe: 'stale-fragments',
    enemy: 'Missing evidence',
    genre: 'ambient',
    tempo: 90,
    root: 60,
  },
};
const row = (names, briefs, teasers, en, uk, refs, routes, scene) => ({
  names,
  briefs,
  teasers,
  text: [en, uk],
  refs,
  routes,
  scene,
});
export const FPV_MISSION_ROWS = {
  'fpv-parts-bench': [
    row(
      ['A Tray of Questions', 'Лоток запитань'],
      [
        'Connect the inventory trays of an unpowered civilian display model.',
        'З’єднайте лотки деталей цивільної виставкової моделі без живлення.',
      ],
      [
        'A labelled parts tray turns guessing into useful questions.',
        'Підписаний лоток перетворює здогадки на корисні запитання.',
      ],
      [
        'PX4’s assembly guide presents components alongside board-specific examples. It is not a universal instruction sheet for every FPV kit.',
        'Our museum model uses inert component cards. Sort each into structure, energy, sensing or communication, then put an unknown connector card in “manual needed”. No batteries, soldering or spinning propellers are part of this exercise.',
      ],
      [
        'Посібник PX4 подає компоненти разом із прикладами для конкретних плат. Це не універсальна інструкція для кожного FPV-набору.',
        'У музейній моделі використано неактивні картки деталей. Розподіліть їх за структурою, енергією, вимірюванням і зв’язком; невідомий роз’єм відкладіть до «потрібна інструкція». Вправа не передбачає акумуляторів, паяння чи обертання пропелерів.',
      ],
      ['fpvAssembly'],
      [
        'Choose the long inventory shelf or the two short tray returns.',
        'Оберіть довгу полицю переліку або два короткі повернення до лотків.',
      ],
      'Original warm workshop illustration: exploded inert component cards on an oversized tray, magnified labels and a clear unpowered-model placard.',
    ),
    row(
      ['Which Way Is Forward?', 'Де передня частина?'],
      [
        'Join the orientation plinths and compare a model’s nose with its display arrow.',
        'З’єднайте стенди орієнтації та порівняйте ніс моделі зі стрілкою експозиції.',
      ],
      ['One small arrow changes how a diagram is read.', 'Одна мала стрілка змінює читання схеми.'],
      [
        'The Pixhawk 4 guide identifies an orientation mark on that particular controller. Real board mounting follows its own manufacturer documentation.',
        'Our cardboard model has a blue nose and a separate map-north arrow. Rotate the model card: the nose moves, but north on the page does not. Label both before describing a component’s position.',
      ],
      [
        'Посібник Pixhawk 4 позначає орієнтир саме цього контролера. Монтаж реальної плати визначає документація її виробника.',
        'Картонна модель має синій ніс і окрему стрілку півночі на карті. Поверніть картку моделі: ніс змінить напрямок, але північ сторінки — ні. Підпишіть обидва орієнтири перед описом розташування деталі.',
      ],
      ['fpvBoardGuide'],
      [
        'Secure the nose-side alcove or loop behind the orientation spine.',
        'Закріпіть нішу біля носа або обійдіть центральну вісь орієнтації.',
      ],
      'Original cutaway display model on a rotating plinth, blue nose marker and independent compass rose, no wiring pinouts.',
    ),
    row(
      ['Three Coloured Paths', 'Три кольорові шляхи'],
      [
        'Connect the role stations without treating the arcade route as wiring.',
        'З’єднайте станції ролей, не сприймаючи аркадний маршрут як проводку.',
      ],
      [
        'Follow structure, energy and information through one display.',
        'Простежте структуру, енергію та інформацію в одній експозиції.',
      ],
      [
        'Our original model uses three removable ribbons: grey for support, amber for energy and blue for information. These explain roles, not physical connectors or voltage compatibility.',
        'Place the frame under support, the battery card under stored energy and the receiver under incoming commands. Explain why an ESC card relates both to a command and to motor energy. The source guide is further reading for real component distinctions.',
      ],
      [
        'Оригінальна модель має три знімні стрічки: сіру для опори, бурштинову для енергії та синю для інформації. Вони пояснюють ролі, а не роз’єми чи сумісність напруг.',
        'Розмістіть раму біля опори, картку акумулятора біля запасеної енергії, а приймач — біля вхідних команд. Поясніть, чому ESC пов’язаний і з командою, і з енергією двигуна. Посібник є додатковим джерелом про реальні компоненти.',
      ],
      ['fpvAssembly'],
      [
        'Join the middle role island first or link the outer pair before crossing.',
        'Спершу приєднайте середній острів ролі або з’єднайте зовнішню пару перед перетином.',
      ],
      'Original museum role atlas with three fabric ribbons and inert frame, battery, receiver and ESC silhouettes; no connection instructions.',
    ),
    row(
      ['Same Shape, Different Label', 'Схожа форма, інший напис'],
      [
        'Open the comparison court and check the fictional labels before choosing.',
        'Відкрийте двір порівняння й перевірте вигадані написи перед вибором.',
      ],
      [
        'A matching outline is not the same as matching requirements.',
        'Однаковий контур не означає однакові вимоги.',
      ],
      [
        'In our invented display, two connectors share an outline but have different role labels. A visual match alone cannot answer the compatibility question.',
        'Choose “check the exact manual” rather than forcing a match. Add the board revision and connector label to the question card. The linked Pixhawk example illustrates why documentation is specific to hardware; its pinout is not copied into this model.',
      ],
      [
        'У вигаданій експозиції два роз’єми мають однаковий контур, але різні позначення ролей. Самої схожості недостатньо для висновку про сумісність.',
        'Оберіть «перевірити точну інструкцію», а не примусове поєднання. Додайте ревізію плати й напис на роз’ємі до картки запитання. Приклад Pixhawk пояснює прив’язку документації до обладнання; його розпіновку в модель не перенесено.',
      ],
      ['fpvBoardGuide'],
      [
        'Use the broad comparison terrace or the quiet label alcove first.',
        'Почніть із широкої тераси порівняння або спокійної ніші написів.',
      ],
      'Original spacious comparison table with two deliberately fictional connector cards and a large open manual, no real pin mappings.',
    ),
    row(
      ['Look Before the Next Step', 'Огляд перед наступним кроком'],
      [
        'Connect inspection windows around the stationary, unpowered model.',
        'З’єднайте вікна огляду довкола нерухомої моделі без живлення.',
      ],
      [
        'A careful observation is more useful than “looks fine”.',
        'Точне спостереження корисніше за «наче добре».',
      ],
      [
        'iFixit’s safety guidance says to follow device-specific instructions and seek help when unsure. Our display inspection is intentionally non-invasive.',
        'The fixture shows a cracked cardboard arm, a loose label and an unreadable part ID. Record the visible observation for each, then choose replace the display piece, relabel, or ask for identification. Do not infer that a real aircraft is safe from a picture.',
      ],
      [
        'Поради iFixit закликають дотримуватися інструкцій конкретного пристрою та звертатися по допомогу за невпевненості. Огляд експозиції навмисно не потребує втручання.',
        'На зображенні є тріснута картонна балка, відклеєний напис і нечитаний номер деталі. Зафіксуйте спостереження та оберіть заміну макета, новий напис або запит на ідентифікацію. Фото не доводить безпечність реального дрона.',
      ],
      ['fpvRepairSafety'],
      [
        'Reach the isolated inspection island or clear the paired windows first.',
        'Досягніть окремого острова огляду або спершу відкрийте парні вікна.',
      ],
      'Original inspection lightbox with magnified cardboard model details, readable observation cards and no powered tools.',
    ),
    row(
      ['The Model Handoff', 'Передача моделі'],
      [
        'Unite the workshop stations into a clear handoff for the next learner.',
        'Об’єднайте станції майстерні для зрозумілої передачі наступному учаснику.',
      ],
      [
        'Complete a display that says what is known and what is still missing.',
        'Завершіть експозицію, де видно відоме й невідоме.',
      ],
      [
        'Our final museum label has four fields: purpose, identified parts, open questions and next responsible person. “Display complete” is deliberately different from “aircraft ready”.',
        'Use earlier cards to explain the receiver’s role and the model’s forward direction. Leave one fictional unreadable identifier unresolved, with an explicit handoff to an instructor. Good documentation preserves uncertainty rather than hiding it.',
      ],
      [
        'Підсумковий музейний напис має чотири поля: мета, визначені деталі, відкриті запитання та наступна відповідальна особа. «Експозицію завершено» відрізняється від «дрон готовий».',
        'За попередніми картками поясніть роль приймача та напрямок передньої частини. Залиште один вигаданий нечитаний номер невизначеним із явною передачею наставнику. Добрий запис зберігає невизначеність, а не приховує її.',
      ],
      ['fpvAssembly'],
      [
        'Build a chain through the handoff islands or enclose the wide workshop bay.',
        'Побудуйте ланцюг островів передачі або охопіть широку зону майстерні.',
      ],
      'Original finished unpowered civilian museum model surrounded by six evidence cards and one intentionally unresolved question card.',
    ),
  ],
  'fpv-soldering-workshop': [
    row(
      ['A Place for the Iron', 'Місце для паяльника'],
      [
        'Connect the fictional practice stations; real hot-tool work needs trained supervision and fume control.',
        'З’єднайте навчальні станції; реальна робота гарячим інструментом потребує навченого нагляду й контролю випарів.',
      ],
      [
        'A good joint begins with a prepared workspace.',
        'Добре з’єднання починається з підготовленого місця.',
      ],
      [
        'HSE identifies rosin-based solder-flux fumes as an asthma hazard and recommends effective exposure control. Adafruit includes a secure iron stand in its basic toolkit.',
        'In this cold, illustrated exercise, place stand, extraction, eye protection and practice board on a workspace card. Keep the hand path separate from the hot-tool zone. No heating occurs in the game; supervised practice uses the workshop’s actual safety procedure.',
      ],
      [
        'HSE визначає випари каніфольного флюсу як чинник ризику астми й рекомендує дієвий контроль впливу. Adafruit включає стійку підставку паяльника до основного набору.',
        'У цій вправі без нагрівання розмістіть підставку, витяжку, захист очей і навчальну плату на картці місця. Відокремте рух рук від зони гарячого інструмента. Гра нічого не нагріває; реальна практика під наглядом дотримується правил майстерні.',
      ],
      ['fpvFumes', 'fpvSolderTools'],
      [
        'Join the stand-side island or capture the open preparation mat first.',
        'Спершу приєднайте острів підставки або захопіть відкритий килимок підготовки.',
      ],
      'Original copper-and-plum beginner workshop with cold iron in stand, extraction hood and eye-protection icon; no aircraft electronics.',
    ),
    row(
      ['Read the Spool', 'Прочитайте котушку'],
      [
        'Compare material labels in the twin supply bays before selecting a practice card.',
        'Порівняйте позначення матеріалів у двох зонах перед вибором навчальної картки.',
      ],
      ['The label matters more than the spool’s colour.', 'Напис важливіший за колір котушки.'],
      [
        'Solder and flux are materials with their own handling instructions. Lead-free solder does not remove the need to control flux fumes.',
        'Our fictional labels list material name, supplier guidance and an unknown field. Match only the complete label to the instructor’s practice specification. Put an unlabelled spool aside for identification instead of guessing its composition from appearance.',
      ],
      [
        'Припій і флюс мають власні правила поводження. Відсутність свинцю не усуває потреби контролювати випари флюсу.',
        'Вигадані написи містять назву матеріалу, вказівки постачальника й невідоме поле. Підберіть лише повний напис до навчальної специфікації наставника. Непідписану котушку відкладіть для визначення, не вгадуйте склад за зовнішністю.',
      ],
      ['fpvSolderTools', 'fpvFumes'],
      [
        'Choose the labelled supply bay or return through the question-card shelf.',
        'Оберіть зону підписаних матеріалів або повернення через полицю запитань.',
      ],
      'Original giant spool-label gallery with clearly fictional material cards, neutral symbols and a separate unidentified tray.',
    ),
    row(
      ['Hold the Practice Piece', 'Зафіксуйте навчальну деталь'],
      [
        'Connect the support points of a battery-free beginner practice board.',
        'З’єднайте точки опори навчальної плати без акумулятора.',
      ],
      [
        'Steady parts make the next observation easier to understand.',
        'Нерухомі деталі полегшують наступне спостереження.',
      ],
      [
        'Adafruit’s preparation guide describes cleaning and tinning the iron tip; its joint guidance also depends on stable work. Preparation and material choice affect the process.',
        'Arrange an illustrated practice pad and component lead in a holder, leaving room to inspect both. Explain why holding a part by hand is not our fixture’s plan. Temperature and timing are intentionally left to the actual tool, material and instructor guidance.',
      ],
      [
        'Підготовчий посібник Adafruit описує очищення й лудіння жала; поради щодо з’єднання також передбачають нерухому деталь. Підготовка та вибір матеріалу впливають на процес.',
        'Розташуйте навчальний контакт і вивід у зображеному тримачі, залишивши огляд обох. Поясніть, чому тримати деталь рукою — не план цієї вправи. Температуру й час визначають реальний інструмент, матеріал і наставник.',
      ],
      ['fpvSolderPrep'],
      [
        'Link both holder islands before the middle capture or work from one stable side.',
        'З’єднайте обидва острови тримача перед серединою або почніть з однієї стійкої сторони.',
      ],
      'Original magnified unpowered practice pad and wire lead in a bench holder; illustrated access space without numerical tool settings.',
    ),
    row(
      ['Where the Heat Goes', 'Куди передається тепло'],
      [
        'Reveal the quiet demonstration court and follow the joint’s two contact surfaces.',
        'Відкрийте спокійний двір демонстрації та простежте дві контактні поверхні з’єднання.',
      ],
      [
        'A cutaway explains a connection without hiding it under a blob.',
        'Розріз пояснює з’єднання, не ховаючи його під краплею.',
      ],
      [
        'Adafruit’s through-hole example heats the pad and lead together so solder can wet both. Its illustration describes that joint type, not every repair or material.',
        'Compare two original cutaways: one labels both contact surfaces, the other only a large lump. Choose which drawing explains the intended relationship, then identify what a static drawing cannot show about the real process.',
      ],
      [
        'У прикладі наскрізного монтажу Adafruit нагрівають контакт і вивід разом, щоб припій змочив обидва. Приклад описує цей тип з’єднання, а не будь-який ремонт чи матеріал.',
        'Порівняйте два оригінальні розрізи: один позначає обидві поверхні, інший — лише велику краплю. Оберіть зрозуміліше пояснення зв’язку й назвіть, чого статичний малюнок не показує про реальний процес.',
      ],
      ['fpvSolderJoint'],
      [
        'Open the broad heat-transfer terrace or use the narrow cutaway return.',
        'Відкрийте широку терасу теплопередачі або вузьке повернення розрізу.',
      ],
      'Original calm sectional illustration of a generic practice pad and lead, copper surfaces and amber heat-flow arrows, no branded copied diagram.',
    ),
    row(
      ['An Inspection, Not a Guess', 'Огляд, а не здогад'],
      [
        'Connect the inspection lenses and describe the visible evidence on practice cards.',
        'З’єднайте оглядові лінзи й опишіть видиме на навчальних картках.',
      ],
      [
        'Separate an unintended bridge from an unexplained rough surface.',
        'Відрізніть небажану перемичку від нерівної поверхні з невідомою причиною.',
      ],
      [
        'Adafruit distinguishes unintended solder bridges, incomplete wetting and movement during cooling. Similar-looking faults can have different causes.',
        'Our three drawn samples show a bridge, an exposed gap and an unclear surface. Record what you can actually see, then request instructor review. A shiny surface alone is not the acceptance rule, and the game never declares a real board electrically sound.',
      ],
      [
        'Adafruit розрізняє небажані перемички, неповне змочування та рух під час охолодження. Подібні на вигляд дефекти можуть мати різні причини.',
        'Три намальовані зразки показують перемичку, видимий проміжок і неясну поверхню. Запишіть лише видиме та попросіть огляд наставника. Сам блиск не є критерієм прийняття; гра не підтверджує справність реальної плати.',
      ],
      ['fpvSolderFaults'],
      [
        'Inspect the three small lenses separately or join the paired upper lenses first.',
        'Огляньте три малі лінзи окремо або спершу з’єднайте верхню пару.',
      ],
      'Original triptych of oversized fictional practice joints with distinct observation labels and a magnifying lens; no repair directions.',
    ),
    row(
      ['Know When to Pause', 'Знайте, коли зупинитися'],
      [
        'Bring the practice cards to the review desk before choosing the next supervised step.',
        'Зберіть навчальні картки на столі перевірки перед наступним кроком під наглядом.',
      ],
      [
        'Sometimes the best repair decision is a well-explained stop.',
        'Іноді найкраще рішення — обґрунтована зупинка.',
      ],
      [
        'Adafruit notes that a meter reading alone can miss a marginal connection. An observed result needs context rather than automatic acceptance.',
        'The fictional card says “intermittent indication; cause not established”. Choose stop, cool safely under workshop procedure and ask the instructor, then preserve the observation. Do not rehearse repeated heating or live diagnosis on an aircraft; this finale stays with beginner practice-board decisions.',
      ],
      [
        'Adafruit зазначає, що показ приладу сам собою може не виявити ненадійне з’єднання. Спостережуваний результат потребує контексту, а не автоматичного прийняття.',
        'Вигадана картка каже: «показ нестабільний; причина не встановлена». Оберіть зупинку, безпечне охолодження за правилами майстерні й звернення до наставника; збережіть спостереження. Фінал стосується навчальної плати, а не повторного нагрівання чи діагностики дрона під живленням.',
      ],
      ['fpvSolderEvidence'],
      [
        'Use the central review desk as a return or connect the outside evidence chain.',
        'Поверніться до центрального столу перевірки або з’єднайте зовнішній ланцюг доказів.',
      ],
      'Original finished practice-board exhibit with six inspection cards and a pause marker, soft copper light, tools resting safely.',
    ),
  ],
  'fpv-four-controls': [
    row(
      ['Two Sticks, Four Names', 'Два стіки, чотири назви'],
      [
        'Connect four command stations using the illustrated Mode 2 layout.',
        'З’єднайте чотири станції команд за ілюстрованим розташуванням Mode 2.',
      ],
      [
        'Learn a layout while keeping other layouts possible.',
        'Вивчіть одне розташування, пам’ятаючи про інші.',
      ],
      [
        'ArduPilot describes Mode 2 as left-stick throttle/yaw and right-stick pitch/roll. Other stick modes exist; a physical controller must be checked against its actual mapping.',
        'On our untimed diagram, match four name cards to the labelled axes. “Mode 2” describes placement here, not a flight mode or a promise about what centering a stick will do.',
      ],
      [
        'ArduPilot описує Mode 2 як газ і рискання на лівому стіку, тангаж і крен — на правому. Існують інші схеми; реальний пульт перевіряють за його фактичним призначенням.',
        'На схемі без таймера зіставте чотири назви з підписаними осями. «Mode 2» тут описує розташування, а не режим польоту чи гарантію реакції на центрування стіка.',
      ],
      ['fpvStickModes'],
      [
        'Link the left command pair first or establish a return at the right pair.',
        'Спершу з’єднайте ліву пару команд або підготуйте повернення біля правої.',
      ],
      'Original navy-and-cyan controller diagram, two generous stick wells and four readable command labels, no real radio switches.',
    ),
    row(
      ['Pitch: Read the Nose', 'Тангаж: стежте за носом'],
      [
        'Reveal the nose-and-tail comparison without confusing tilt with a map direction.',
        'Відкрийте порівняння носа й хвоста, не змішуючи нахил із напрямком карти.',
      ],
      [
        'A side view makes a hidden rotation easier to see.',
        'Вигляд збоку робить непомітне обертання зрозумілим.',
      ],
      [
        'Pitch is rotation about the aircraft’s side-to-side axis. In PX4 Manual/Stabilized mode, pitch input requests a tilt angle; different modes interpret input differently.',
        'Our card shows a nose-down and a level silhouette. Point to the rotation before predicting movement. The conceptual control lab displays this relationship; the optional assisted practice model instead labels its simplified travel commands explicitly.',
      ],
      [
        'Тангаж — обертання навколо поперечної осі апарата. У PX4 Manual/Stabilized команда тангажу задає кут нахилу; інші режими тлумачать команди інакше.',
        'Картка показує силует носом униз і горизонтальний силует. Спершу вкажіть обертання, потім прогнозуйте рух. Лабораторія пояснює цей зв’язок; необов’язкова практика окремо позначає спрощені команди переміщення.',
      ],
      ['fpvManual'],
      [
        'Choose the long side-view aisle or the short nose-marker alcove.',
        'Оберіть довгий прохід вигляду збоку або коротку нішу позначки носа.',
      ],
      'Original side-on civilian model silhouettes around a horizontal hinge sculpture, clear nose marker and large quiet comparison space.',
    ),
    row(
      ['Roll: One Wingtip Lower', 'Крен: один бік нижче'],
      [
        'Connect the left-right comparison stations around the model’s own axis.',
        'З’єднайте станції порівняння ліворуч і праворуч від власної осі моделі.',
      ],
      [
        'The aircraft’s left is not always the viewer’s left.',
        'Лівий бік апарата не завжди ліворуч для глядача.',
      ],
      [
        'Roll is rotation about the aircraft’s front-to-back axis. The name describes an orientation change, not a guarantee of sideways position hold.',
        'Turn our paper model to face the reader and keep its left side marked blue. Compare aircraft-left with screen-left, then predict which label moves when the viewpoint changes. Use the mode-specific source when moving beyond this static explanation.',
      ],
      [
        'Крен — обертання навколо поздовжньої осі апарата. Назва описує зміну орієнтації, а не гарантує утримання бокового положення.',
        'Поверніть паперову модель до читача, зберігши синю позначку її лівого боку. Порівняйте ліворуч для апарата й екрана та передбачте зміну написів зі зміною точки огляду. Для реальної поведінки звертайтеся до джерела конкретного режиму.',
      ],
      ['fpvScience'],
      [
        'Use the centre axis island to compare both sides or secure the far-side pair.',
        'Порівняйте боки від центрального острова осі або закріпіть дальню пару.',
      ],
      'Original front-facing inert quadcopter with a marked blue left arm, longitudinal axis and two distinct viewpoint cards.',
    ),
    row(
      ['Yaw: Turn the Heading', 'Рискання: змініть курс'],
      [
        'Open the heading court while keeping turn and travel separate.',
        'Відкрийте двір курсу, розділяючи поворот і переміщення.',
      ],
      [
        'A compass card turns while its centre stays in place.',
        'Компасна картка обертається, а її центр залишається на місці.',
      ],
      [
        'Yaw is rotation about the vertical axis. In the linked PX4 modes, yaw input controls rotation rate rather than selecting a compass heading directly.',
        'Our still diagrams put a model at the same point, first facing the window and then the door. Identify what changed and what did not. This picture isolates one idea; it is not a claim that a real aircraft automatically stays over that point.',
      ],
      [
        'Рискання — обертання навколо вертикальної осі. У наведених режимах PX4 команда рискання задає швидкість обертання, а не безпосередньо напрямок компаса.',
        'На статичних схемах модель стоїть у тій самій точці: спершу носом до вікна, потім до дверей. Визначте зміну й незмінне. Малюнок виділяє одну ідею, але не стверджує, що реальний апарат автоматично тримає цю точку.',
      ],
      ['fpvPosition'],
      [
        'Circle the heading island or take the wide quiet door-side capture.',
        'Обійдіть острів курсу або зробіть широке спокійне захоплення біля дверей.',
      ],
      'Original top-down compass pavilion with stationary centre dots, two aircraft headings and a large empty floor around the display.',
    ),
    row(
      ['Throttle Needs a Model', 'Газ потребує пояснення моделі'],
      [
        'Join the response cards and read their stated flight-mode assumptions.',
        'З’єднайте картки реакцій і прочитайте припущення щодо режиму польоту.',
      ],
      [
        'The same stick position can have different meanings.',
        'Однакове положення стіка може мати різний зміст.',
      ],
      [
        'PX4 Position mode interprets throttle as an ascent/descent command; Manual/Stabilized requires the pilot to manage throttle for altitude. Centering is therefore not a universal “hover” command.',
        'Choose between two fictional captions: “this assisted model holds height at neutral” and “every aircraft hovers at centre”. Keep the bounded first statement and explain what evidence the second would need. No real throttle settings are supplied.',
      ],
      [
        'PX4 Position тлумачить газ як команду набору або зниження висоти; у Manual/Stabilized пілот керує газом для підтримання висоти. Центр стіка не є універсальною командою зависання.',
        'Порівняйте підписи: «ця модель із допомогою тримає висоту в нейтралі» та «кожен апарат зависає в центрі». Залиште обмежене перше твердження й поясніть, чого бракує другому. Реальних налаштувань газу тут немає.',
      ],
      ['fpvPosition', 'fpvManual'],
      [
        'Collect the separate mode islands before crossing or group the paired response cards.',
        'Спершу зберіть окремі острови режимів або об’єднайте парні картки реакцій.',
      ],
      'Original paired response panels with identical stick silhouettes and deliberately different model captions, cyan altitude gauge and amber caveat card.',
    ),
    row(
      ['Predict, Then Explain', 'Спрогнозуйте й поясніть'],
      [
        'Complete the command atlas and separate stick layout from response rules.',
        'Завершіть атлас команд і відокремте схему стіків від правил реакції.',
      ],
      [
        'Four familiar controls become one explainable model.',
        'Чотири знайомі команди стають зрозумілою моделлю.',
      ],
      [
        'Our fictional control card states its assumptions first: Mode 2 placement, a visible nose marker and a separate response diagram. The optional lab can be explored without a reading timer.',
        'Predict the illustrated change for one command, then change only the viewpoint and explain what remains true. A correct diagram answer earns understanding in this exhibit, not aircraft certification or proof of a real controller’s mapping.',
      ],
      [
        'Вигадана картка спершу задає припущення: Mode 2, видима позначка носа й окрема схема реакції. Необов’язкову лабораторію можна досліджувати без таймера читання.',
        'Передбачте ілюстровану зміну для однієї команди, потім змініть лише точку огляду й поясніть незмінне. Правильна відповідь стосується цієї експозиції, а не сертифікації чи доказу призначень реального пульта.',
      ],
      ['fpvStickModes'],
      [
        'Join the four command islands through the centre or complete the outer atlas loop.',
        'З’єднайте чотири острови команд через центр або завершіть зовнішню петлю атласу.',
      ],
      'Original completed four-control atlas with side, front and top views around an illustrated Mode 2 controller, clean readable axes.',
    ),
  ],
  'fpv-first-flight': [
    row(
      ['Start with a Stop', 'Почніть із зупинки'],
      [
        'Connect the fictional gym’s start and pause stations; this arcade map is not a flight simulator.',
        'З’єднайте старт і паузу вигаданої зали; ця аркадна карта не є льотним симулятором.',
      ],
      [
        'A practice plan includes how to stop before it includes how to move.',
        'План вправи містить спосіб зупинки раніше за рух.',
      ],
      [
        'NASA’s classroom simulation activity uses a deliberately simplified digital drone task. A model is useful when its scope and assumptions are clear.',
        'Our optional assisted gym has pause and reset, neutral input and explicit checkpoints. Before any movement, find those controls and describe what the model omits: real wind, inertia, aircraft setup and flight authorization. Completing this arcade level does not complete a gym drill.',
      ],
      [
        'Навчальна вправа NASA використовує навмисно спрощене цифрове завдання з дроном. Модель корисна, коли зрозумілі її межі й припущення.',
        'Необов’язкова зала має паузу, скидання, нейтральне введення та явні контрольні точки. Перед рухом знайдіть ці команди й назвіть відсутнє: реальний вітер, інерцію, налаштування й дозвіл на політ. Аркадна перемога не завершує вправу зали.',
      ],
      ['fpvSimulation'],
      [
        'Establish the pause island early or connect the start terrace by a shorter return.',
        'Спершу закріпіть острів паузи або приєднайте стартову терасу коротшим поверненням.',
      ],
      'Original civilian gym entrance with oversized pause and reset markers, soft floor lines and a fictional model parked on a mat.',
    ),
    row(
      ['Height Is a Separate Question', 'Висота — окреме питання'],
      [
        'Connect the height markers without mistaking a top-down position for altitude.',
        'З’єднайте позначки висоти, не плутаючи положення зверху з висотою.',
      ],
      [
        'Two dots can share a map position and have different heights.',
        'Дві точки можуть збігатися на карті, але мати різну висоту.',
      ],
      [
        'In our assisted gym model, a separate height gauge accompanies the overhead view. Two screenshots can place the marker over the same tile while showing different heights.',
        'Compare the fictional screenshots, name both quantities and predict which gauge changes during a climb-only command. This is an exercise in reading the model, not a suggested real takeoff procedure.',
      ],
      [
        'У моделі зали окремий покажчик висоти доповнює вигляд зверху. На двох знімках маркер може бути над тією самою клітинкою, але на різній висоті.',
        'Порівняйте вигадані знімки, назвіть обидві величини та передбачте зміну покажчика за команди лише набору висоти. Це читання моделі, а не інструкція реального зльоту.',
      ],
      ['fpvSimulation'],
      [
        'Climb the arcade’s marker chain or capture the wider observation bay first.',
        'Пройдіть аркадний ланцюг позначок або спершу захопіть ширшу зону спостереження.',
      ],
      'Original paired top-down and side-view gym cards with a large height ruler, matching floor tile and two clearly different altitudes.',
    ),
    row(
      ['A Straight Path, Two Views', 'Прямий шлях, два види'],
      [
        'Join the straight-route stations and compare direction with heading.',
        'З’єднайте станції прямого маршруту й порівняйте напрямок руху з курсом.',
      ],
      [
        'A floor arrow and a nose marker answer different questions.',
        'Стрілка підлоги й позначка носа відповідають на різні питання.',
      ],
      [
        'Our original fixture shows a model facing the gym window and a separate arrow tracing its path. The arrow records travel; the nose marker records orientation.',
        'Compare a forward segment with a sideways segment while keeping the heading fixed. Explain why both can be straight paths in the assisted model. Real control response depends on the aircraft and mode; this diagram supplies neither setup nor operational commands.',
      ],
      [
        'Оригінальна вправа показує модель носом до вікна й окрему стрілку шляху. Стрілка позначає переміщення, а ніс — орієнтацію.',
        'Порівняйте рух уперед і вбік зі сталим курсом. Поясніть, чому обидва шляхи прямі в моделі з допомогою. Реальна реакція залежить від апарата й режиму; схема не містить налаштувань чи експлуатаційних команд.',
      ],
      ['fpvSimulation'],
      [
        'Use the long straight island as a return or connect the two viewpoint alcoves.',
        'Поверніться через довгий прямий острів або з’єднайте дві ніші огляду.',
      ],
      'Original indoor gym diagram with a long floor arrow and an independently marked aircraft nose; inset overhead and oblique views.',
    ),
    row(
      ['Slide Past the Window', 'Рух убік повз вікно'],
      [
        'Reveal a spacious lateral-travel scene with a fixed fictional viewpoint.',
        'Відкрийте простору сцену бокового руху зі сталою вигаданою точкою огляду.',
      ],
      [
        'A calm comparison makes a changing viewpoint easier to understand.',
        'Спокійне порівняння пояснює зміну точки огляду.',
      ],
      [
        'The window, blue mat and door are landmarks in our invented indoor gym. They provide a stable reference for a short sideways movement in the assisted model.',
        'Predict which landmark moves across a fictional camera frame, then compare with the overhead sketch. State the viewpoint before saying “left”. This is an untimed visual reasoning task, with no performance claim about real FPV flying.',
      ],
      [
        'Вікно, синій килимок і двері — орієнтири вигаданої зали. Вони задають сталу систему для короткого бокового переміщення в моделі з допомогою.',
        'Передбачте, який орієнтир зміститься у вигаданому кадрі, та порівняйте з виглядом зверху. Перед словом «ліворуч» назвіть точку огляду. Це візуальна вправа без таймера, а не доказ уміння літати FPV.',
      ],
      ['fpvSimulation'],
      [
        'Take the broad window terrace or make two short captures from the side mat.',
        'Оберіть широку терасу вікна або два короткі захоплення від бокового килимка.',
      ],
      'Original sunlit civilian gym with giant window, blue floor mat and paired camera-framing cards; generous negative space.',
    ),
    row(
      ['A Turn and a Translation', 'Поворот і переміщення'],
      [
        'Connect the corner markers while separating a heading change from travel.',
        'З’єднайте кутові позначки, відділяючи зміну курсу від переміщення.',
      ],
      [
        'A square route can be described in more than one way.',
        'Квадратний маршрут можна описати по-різному.',
      ],
      [
        'Our comparison cards draw two assisted-model routes around the same square: one keeps a fixed heading; the other changes heading between sides. These are different command plans for the same geometric path.',
        'Mark the moments when orientation changes, then name a shared checkpoint. Keep the example bounded to the gym model rather than assuming a real aircraft stops instantly at each corner.',
      ],
      [
        'Картки порівнюють два маршрути моделі навколо квадрата: зі сталим курсом і зі зміною курсу між сторонами. Це різні плани команд для однакового геометричного шляху.',
        'Позначте моменти зміни орієнтації й назвіть спільну контрольну точку. Залишайте приклад у межах моделі зали: реальний апарат не обов’язково миттєво зупиняється на куті.',
      ],
      ['fpvSimulation'],
      [
        'Secure opposite corner islands or follow neighbouring corners around the board.',
        'Закріпіть протилежні кутові острови або рухайтеся сусідніми кутами карти.',
      ],
      'Original square gym floor with two contrasting route ribbons, repeated nose markers and separate heading-change cards.',
    ),
    row(
      ['The Joined Practice Route', 'Спільний навчальний маршрут'],
      [
        'Connect the gym landmarks into a route with readable checkpoints and an explicit finish.',
        'Поєднайте орієнтири зали в маршрут зі зрозумілими точками й явним завершенням.',
      ],
      [
        'A good practice notebook explains the model and the next attempt.',
        'Добрий щоденник пояснює модель і наступну спробу.',
      ],
      [
        'Our final route combines a height check, a straight segment, a lateral segment and a heading comparison. The notebook records what was intended and what was observed, without a compulsory speed target.',
        'Pick one difference to investigate on a later attempt. The optional practice package verifies its own ordered checkpoints separately. This six-card exhibit can be completed and reread without installing that package or earning any practice completion automatically.',
      ],
      [
        'Підсумковий маршрут поєднує перевірку висоти, прямий і боковий відрізки та порівняння курсу. Щоденник фіксує задум і спостереження без обов’язкової швидкості.',
        'Оберіть одну відмінність для наступного дослідження. Необов’язковий пакет практики окремо перевіряє послідовність точок. Цю виставку із шести карток можна завершити й перечитувати без встановлення пакета та без автоматичного проходження вправ.',
      ],
      ['fpvSimulation'],
      [
        'Join the three landmark returns first or close the route’s outer envelope.',
        'Спершу приєднайте три повернення орієнтирів або замкніть зовнішній контур маршруту.',
      ],
      'Original finished civilian gym notebook spread with six route cards, separate height and heading markers and a clear resting finish mat.',
    ),
  ],
  'fpv-drone-families': [
    row(
      ['A View, Not a Shape', 'Спосіб бачити, а не форма'],
      [
        'Reveal the viewing gallery and separate FPV from airframe type.',
        'Відкрийте галерею спостереження й відокремте FPV від типу конструкції.',
      ],
      [
        'The same aircraft can be described along more than one axis.',
        'Один апарат можна описати за різними ознаками.',
      ],
      [
        'EASA explains FPV as viewing live images from an onboard camera on a display such as goggles. That describes a viewing method, not a single aircraft shape.',
        'Give our fictional museum card separate fields for view and airframe. A camera icon belongs under view; four-rotor geometry belongs under airframe. Do not infer range, autonomy or legal permission from either icon.',
      ],
      [
        'EASA пояснює FPV як перегляд живого зображення бортової камери на дисплеї, наприклад в окулярах. Це спосіб спостереження, а не єдина форма апарата.',
        'Створіть на музейній картці окремі поля для огляду й конструкції. Значок камери стосується огляду, чотири ротори — конструкції. Жоден значок не доводить дальність, автономність чи законність польоту.',
      ],
      ['fpvView'],
      [
        'Open the wide viewing bay or connect the camera and airframe alcoves separately.',
        'Відкрийте широку зону огляду або окремо з’єднайте ніші камери й конструкції.',
      ],
      'Original drone museum entrance with a large goggles silhouette and several distinct unarmed aircraft silhouettes, separated classification columns.',
    ),
    row(
      ['More Than Four Rotors', 'Не лише чотири ротори'],
      [
        'Connect the rotor-family plinths and count before comparing.',
        'З’єднайте стенди роторних родин і порахуйте перед порівнянням.',
      ],
      [
        'A family name describes a configuration, not a score.',
        'Назва родини описує конструкцію, а не оцінку.',
      ],
      [
        'PX4 lists multiple multicopter configurations, including quad-, hexa- and octocopters. Rotor count alone does not establish a particular aircraft’s payload, endurance or safety.',
        'Sort our original silhouettes by visible configuration, then move an unsupported “best” label to the question tray. To compare two real designs, first state the civilian task and find documented limits for each exact model.',
      ],
      [
        'PX4 перелічує різні мультикоптери, зокрема квадро-, гекса- й октокоптери. Саме число роторів не визначає вантажність, тривалість польоту чи безпечність конкретного апарата.',
        'Розподіліть оригінальні силуети за видимою конструкцією та відкладіть бездоказовий напис «найкращий». Для реального порівняння спершу сформулюйте цивільне завдання й знайдіть документовані обмеження точних моделей.',
      ],
      ['fpvAirframes'],
      [
        'Collect the small-count plinths first or reach the broad comparison island.',
        'Спершу зберіть менші стенди або досягніть широкого острова порівняння.',
      ],
      'Original overhead silhouettes of four-, six- and eight-rotor civilian display craft on differently shaped museum plinths.',
    ),
    row(
      ['Wings Tell Another Story', 'Крила розповідають інакше'],
      [
        'Join wing and rotor galleries without turning a silhouette into a performance claim.',
        'З’єднайте галереї крил і роторів без висновків про характеристики за силуетом.',
      ],
      [
        'Compare how two structures relate to lift.',
        'Порівняйте зв’язок двох конструкцій із підіймальною силою.',
      ],
      [
        'NASA describes wings as the airplane parts that generate most of its lift. PX4 also distinguishes fixed-wing aircraft from multicopters and VTOL configurations.',
        'Our museum comparison asks only a structural question: which drawing has a fixed wing and which has several lifting rotors? Leave range and operating conditions blank until model-specific evidence is available. The exhibit is not an aircraft selection or construction guide.',
      ],
      [
        'NASA описує крила як частини літака, що створюють основну підіймальну силу. PX4 також відрізняє літаки з нерухомим крилом, мультикоптери й конфігурації VTOL.',
        'Музейне порівняння ставить лише питання конструкції: де нерухоме крило, а де кілька підіймальних роторів? Дальність і умови лишаються невідомими без даних конкретної моделі. Це не посібник вибору чи будівництва апарата.',
      ],
      ['fpvWings', 'fpvAirframes'],
      [
        'Cross between the wing gallery and rotor terrace or secure both outer returns.',
        'Перейдіть між галереєю крила й терасою роторів або закріпіть зовнішні повернення.',
      ],
      'Original civilian fixed-wing and multicopter display sculptures with broad wing surface and distinct rotor discs, no performance specifications.',
    ),
    row(
      ['A Sport Has a Setting', 'Спорт має свої умови'],
      [
        'Open the spacious race exhibit and distinguish a public sport from unrestricted flying.',
        'Відкрийте простору спортивну експозицію та відрізніть змагання від необмеженого польоту.',
      ],
      ['A track is also a shared agreement.', 'Траса — це також спільна домовленість.'],
      [
        'FAI’s Drone Racing World Cup is a series of international events on different tracks. Its existence does not mean any location is an approved race venue.',
        'Our fictional club poster lists an organized setting, a published route and an agreed pause signal. Compare it with a poster that names only speed. Add the missing context without prescribing real regulations or a competition-ready aircraft setup.',
      ],
      [
        'Кубок світу FAI з дронових перегонів складається з міжнародних подій на різних трасах. Існування спорту не означає, що будь-яке місце дозволене для перегонів.',
        'Вигаданий клубний плакат містить організоване місце, опублікований маршрут і погоджений сигнал паузи. Порівняйте з плакатом, що називає лише швидкість. Додайте контекст без приписування реальних норм чи налаштувань перегонового апарата.',
      ],
      ['fpvSport'],
      [
        'Use the wide spectator-side return or capture the quiet course-map terrace.',
        'Оберіть широке повернення біля глядацької зони або тиху терасу плану траси.',
      ],
      'Original fictional civilian drone-sport exhibition with stylized gates, viewing gallery and a large pause emblem; no real event photography.',
    ),
    row(
      ['Purpose Changes the Questions', 'Мета змінює запитання'],
      [
        'Connect the civilian task cards and choose evidence before claiming a best design.',
        'З’єднайте картки цивільних завдань і оберіть докази перед оцінкою конструкції.',
      ],
      [
        'A useful comparison starts with what someone needs to learn or do.',
        'Корисне порівняння починається з потреби людини.',
      ],
      [
        'NASA reports research supporting coordinated commercial drone deliveries in approved areas. This is a specific use and operating context, not a capability shared by every FPV aircraft.',
        'Compare three fictional briefs: a classroom demonstration, a museum photograph and a parcel-service study. For each, ask what information is missing about setting, approval and equipment. Do not rank designs using an unsupported single “power” score.',
      ],
      [
        'NASA повідомляє про дослідження скоординованих доставок дронами у дозволених районах. Це конкретне застосування й умови, а не спільна можливість усіх FPV-апаратів.',
        'Порівняйте три вигадані завдання: навчальну демонстрацію, фото музею та дослідження доставки. Для кожного запитайте про місце, дозвіл і обладнання. Не ранжуйте конструкції за бездоказовим єдиним показником «потужності».',
      ],
      ['fpvDelivery'],
      [
        'Join the three purpose islands one at a time or capture the paired research bays.',
        'Приєднайте три острови мети по черзі або захопіть парні дослідницькі зони.',
      ],
      'Original triptych of classroom model, museum camera and fictional parcel-study station, with separate evidence labels and no technical delivery plan.',
    ),
    row(
      ['Curate the Family Atlas', 'Упорядкуйте атлас родин'],
      [
        'Complete the comparison hall using separate columns for view, structure and purpose.',
        'Завершіть зал порівняння з окремими графами огляду, конструкції та мети.',
      ],
      [
        'An honest “unknown” can make an atlas more useful.',
        'Чесне «невідомо» робить атлас кориснішим.',
      ],
      [
        'Our finished atlas keeps four independent fields: airframe, viewing method, assistance and intended civilian use. A silhouette may fill one field while leaving the others unknown.',
        'Review an invented “camera-equipped hexacopter” card. Identify which facts follow from that description, which need a manual and which need the operator’s declared purpose. Explain one revision to an earlier label before completing the exhibit.',
      ],
      [
        'Готовий атлас має чотири незалежні поля: конструкція, спосіб огляду, допомога й цивільне призначення. Силует може заповнити одне поле, залишивши інші невідомими.',
        'Перегляньте вигадану картку «гексакоптер із камерою». Визначте, що випливає з опису, що потребує інструкції, а що — заявленої мети користувача. Перед завершенням виставки поясніть одне виправлення попереднього напису.',
      ],
      ['fpvAirframes', 'fpvView'],
      [
        'Connect the four atlas columns through short returns or enclose the outer comparison court.',
        'Поєднайте чотири графи короткими поверненнями або охопіть зовнішній двір порівняння.',
      ],
      'Original completed classification atlas with aircraft silhouettes, camera icons, context cards and intentional unknown fields in a lavender museum hall.',
    ),
  ],
  'fpv-drones-ukraine': [
    row(
      ['A Map for Recovery', 'Карта для відбудови'],
      [
        'Connect the fictional archive rooms and distinguish a source image from a recovery decision.',
        'З’єднайте зали вигаданого архіву й відрізніть знімок від рішення про відбудову.',
      ],
      [
        'An aerial image can begin a question about a community’s needs.',
        'Знімок згори може започаткувати питання про потреби громади.',
      ],
      [
        'In September 2023, UNDP described using drone footage and satellite imagery in damage assessment across settlements in Chernihiv Oblast. This is a dated institutional report about reconstruction support.',
        'Our fictional archive card shows an empty community hall before and after a storm. Label date, source and what is visible. A picture alone does not certify structural safety or establish which repair should happen first.',
      ],
      [
        'У вересні 2023 року UNDP описала використання знімання дронами та супутникових зображень для оцінювання пошкоджень населених пунктів Чернігівщини. Це датоване повідомлення установи про підтримку відбудови.',
        'Вигадана архівна картка показує порожній громадський зал до й після бурі. Позначте дату, джерело та видиме. Сам знімок не підтверджує міцність будівлі й не визначає черговість ремонту.',
      ],
      ['fpvRecovery'],
      [
        'Capture the two archive wings separately or join the shared source desk first.',
        'Захопіть два крила архіву окремо або спершу приєднайте спільний стіл джерел.',
      ],
      'Original blue-and-gold civilian recovery archive with fictional community-hall before-and-after drawings, source/date cards, no real damaged site imagery.',
    ),
    row(
      ['Survey Is Not Clearance', 'Обстеження — не очищення'],
      [
        'Connect the humanitarian exhibit; never approach suspicious debris or attempt a real survey.',
        'З’єднайте гуманітарну експозицію; не наближайтеся до підозрілих уламків і не проводьте реальне обстеження.',
      ],
      [
        'A specialist’s observation and a safe-land decision are different things.',
        'Спостереження фахівця й висновок про безпечність землі — різні речі.',
      ],
      [
        'UNDP reported providing aerial detection technology to trained Ukrainian SESU humanitarian demining teams in 2025. Specialist survey work must not be confused with a public permission to enter or clear land.',
        'Our exhibit contains only a fictional document flow: observation, expert review and recorded decision. Identify who owns the next step. No hazardous objects, detection techniques, field routes or clearance procedures are taught.',
      ],
      [
        'У 2025 році UNDP повідомила про передання технології повітряного виявлення навченим командам гуманітарного розмінування ДСНС. Спеціалізоване обстеження не є дозволом людям заходити на територію чи очищати її.',
        'Експозиція містить лише вигаданий рух документів: спостереження, експертний розгляд і зафіксоване рішення. Визначте відповідального за наступний крок. Небезпечні предмети, методи виявлення, польові маршрути й процедури очищення не вивчаються.',
      ],
      ['fpvHumanitarian'],
      [
        'Use the expert-review island or the longer document-gallery return.',
        'Скористайтеся островом експертного розгляду або довшим поверненням галереї документів.',
      ],
      'Original humanitarian museum document exhibit with trained-specialist symbol and separate observation/review/decision cards, no minefield or detection equipment diagram.',
    ),
    row(
      ['A Pilot Study Has Limits', 'Пілотне дослідження має межі'],
      [
        'Connect the research panels and keep a reported experiment separate from a guaranteed result.',
        'З’єднайте дослідницькі панелі й відділіть повідомлений експеримент від гарантованого результату.',
      ],
      [
        'A promising result still needs a question mark in the right place.',
        'Перспективний результат усе ще потребує доречного знака питання.',
      ],
      [
        'UNDP’s July 2025 AI Data Jam report describes image-analysis research involving drone imagery and humanitarian experts. A reported research result is not proof that an automated system can declare any area safe.',
        'Compare invented captions: “tested on this dataset” and “works everywhere”. Keep the supported scope and add the missing test context. This card teaches evidence reading, with no real imagery, detection targets or operational methods.',
      ],
      [
        'Повідомлення UNDP про AI Data Jam у липні 2025 року описує аналіз зображень із дронів за участю гуманітарних експертів. Дослідницький результат не доводить, що автоматична система може визнати будь-яку територію безпечною.',
        'Порівняйте вигадані підписи: «перевірено на цьому наборі» й «працює всюди». Збережіть підтверджені межі та додайте контекст перевірки. Картка вчить читати докази без реальних знімків, об’єктів виявлення чи оперативних методів.',
      ],
      ['fpvImageResearch'],
      [
        'Compare the two evidence shelves through the centre or clear the separate question alcove.',
        'Порівняйте дві полиці доказів через центр або відкрийте окрему нішу запитань.',
      ],
      'Original research-gallery panels with abstract dataset tiles, bounded claim cards and clear question marks, no operational aerial imagery.',
    ),
    row(
      ['Learning Has Many Roles', 'Навчання має багато ролей'],
      [
        'Open the quiet community-library exhibit and connect complementary learning roles.',
        'Відкрийте спокійну бібліотечну експозицію й з’єднайте взаємодоповнювальні навчальні ролі.',
      ],
      [
        'A community includes people who explain, document and ask questions.',
        'До спільноти належать ті, хто пояснює, документує й запитує.',
      ],
      [
        'The public Social Drone UA and Victory Drones sources describe organized community and educational work in Ukraine. Their real missions are not replaced by the civilian classroom story used here.',
        'Our fictional library session has a host, a diagram maker, a source checker and a learner. Match each contribution to a useful handoff. No real members are depicted, and a game badge does not certify membership, training or endorsement.',
      ],
      [
        'Відкриті джерела Social Drone UA та Victory Drones описують організовану спільнотну й освітню діяльність в Україні. Цивільна історія класу тут не замінює їхні реальні місії.',
        'У вигаданій бібліотечній зустрічі є ведучий, автор схем, перевіряльник джерел і учасник. Поєднайте внески для корисної передачі знань. Реальних людей не зображено; ігрова відзнака не підтверджує членство, навчання чи схвалення.',
      ],
      ['social', 'victory'],
      [
        'Explore the broad reading terrace or link the two smaller contribution desks.',
        'Дослідіть широку терасу читання або з’єднайте два менші столи внесків.',
      ],
      'Original warm Ukrainian community library with fictional empty learning stations, diagram boards and open books; no employee or volunteer likenesses.',
    ),
    row(
      ['Read the Historical Caption', 'Прочитайте історичний підпис'],
      [
        'Connect dated public records without adding tactical details or turning them into instructions.',
        'З’єднайте датовані публічні записи без тактичних подробиць чи перетворення їх на інструкції.',
      ],
      [
        'A date, a speaker and a purpose make a claim more readable.',
        'Дата, автор і мета роблять твердження зрозумілішим.',
      ],
      [
        'UNITED24’s 2022 Army of Drones announcement describes a programme including procurement, maintenance and training in Ukraine’s defence context. It is a historical programme source, not a civilian flight manual.',
        'Our archive task labels the publication date, issuer and stated purpose. Separate these from an unsupported claim about today’s equipment or outcomes. The exhibit contains no targeting, combat flight, weapon adaptation or operational assistance.',
      ],
      [
        'Оголошення UNITED24 2022 року про «Армію дронів» описує програму із закупівлею, обслуговуванням і навчанням в оборонному контексті України. Це історичне джерело програми, а не цивільний льотний посібник.',
        'В архівній вправі позначте дату публікації, автора та заявлену мету. Відділіть їх від непідтверджених тверджень про нинішню техніку чи результати. Експозиція не містить цілевказання, бойового польоту, озброєння чи оперативної допомоги.',
      ],
      ['fpvHistory'],
      [
        'Join the date and issuer islands before the wide context capture.',
        'Поєднайте острови дати й автора перед широким захопленням контексту.',
      ],
      'Original sober historical reading room with dated document facsimile-style cards created from scratch, no weapons, unit locations or battlefield imagery.',
    ),
    row(
      ['An Exhibit with Boundaries', 'Виставка з чіткими межами'],
      [
        'Complete the exhibit. Do not approach or touch suspicious debris; in Ukraine contact SESU on 101 from safety.',
        'Завершіть виставку. Не наближайтеся й не торкайтеся підозрілих уламків; в Україні повідомляйте ДСНС за 101 із безпечного місця.',
      ],
      [
        'The final label explains both what is known and what must remain a specialist’s task.',
        'Фінальний напис пояснює відоме й те, що залишається роботою фахівців.',
      ],
      [
        'UNICEF Ukraine’s safety education emphasizes not approaching or touching suspicious objects and contacting emergency services; in Ukraine the SESU number is 101. That information is available before winning too.',
        'Curate the five earlier cards with dates and bounded claims. Replace “the drone proved it safe” with a statement of the actual evidence and responsible expert review. Our illustrations use invented places and never invite a real visit or inspection.',
      ],
      [
        'Просвіта UNICEF Ukraine наголошує: не наближайтеся й не торкайтеся підозрілих предметів, повідомляйте екстрені служби; номер ДСНС в Україні — 101. Ці відомості доступні й до перемоги.',
        'Упорядкуйте п’ять попередніх карток із датами та межами тверджень. Замініть «дрон довів безпечність» точним описом доказів і відповідального експертного розгляду. Ілюстрації показують вигадані місця й не запрошують відвідувати чи оглядати реальні об’єкти.',
      ],
      ['fpvMineAwareness', 'fpvRecovery'],
      [
        'Connect the six exhibit plinths by safe interior returns or close the archive’s outer court.',
        'З’єднайте шість стендів через внутрішні повернення або замкніть зовнішній двір архіву.',
      ],
      'Original completed blue-and-gold civilian evidence museum with dated cards, source bookshelf and visible safety information, no dangerous objects depicted.',
    ),
  ],
  'fpv-care-repair': [
    row(
      ['Describe the Symptom', 'Опишіть симптом'],
      [
        'Connect the observation cards before proposing a cause for the unpowered model.',
        'З’єднайте картки спостережень перед припущенням про причину в моделі без живлення.',
      ],
      [
        '“What happened?” is a different question from “Why?”',
        '«Що сталося?» відрізняється від «Чому?».',
      ],
      [
        'Our fictional training model has a label that moves when the display stand is touched. “The label moved” is an observation; “the adhesive failed” is only one possible explanation.',
        'Write the observation without powering anything or opening a device. Add the time and the part identifier, then ask what evidence would distinguish a loose label from a moving stand. NASA’s scientific-method resource provides further reading on testable explanations.',
      ],
      [
        'На вигаданій навчальній моделі напис рухається від дотику до стенда. «Напис зрушив» — спостереження; «клей не тримає» — лише одне можливе пояснення.',
        'Запишіть спостереження без живлення чи відкривання пристрою. Додайте час і позначення деталі та запитайте, які докази відрізнять відклеєний напис від рухомого стенда. Ресурс NASA пояснює перевірювані припущення.',
      ],
      ['experiment'],
      [
        'Capture the observation shelf before the cause shelf or connect both through the central return.',
        'Захопіть полицю спостережень перед полицею причин або з’єднайте їх через центр.',
      ],
      'Original repair-notebook scene with a loose paper label on an inert classroom model and separate observation/hypothesis cards.',
    ),
    row(
      ['An Unpowered Inspection', 'Огляд без живлення'],
      [
        'Open inspection alcoves; do not connect a battery or spin propellers to answer the fixture.',
        'Відкрийте ніші огляду; не підключайте акумулятор і не обертайте пропелери для відповіді.',
      ],
      [
        'A clear description can travel safely to the next person.',
        'Точний опис можна безпечно передати іншій людині.',
      ],
      [
        'The fictional inspection photographs show an unreadable label, an obviously broken display bracket and an intact-looking cover. None is proof of internal electrical condition.',
        'Choose “record and ask” for an unknown condition rather than “power it to find out”. iFixit’s safety guidance supports using the actual manual and seeking help when unsure. Our exercise stays with visual records and an inert museum model.',
      ],
      [
        'Вигадані знімки огляду показують нечитаний напис, зламаний кронштейн макета й зовні цілу кришку. Жоден не доводить внутрішній електричний стан.',
        'Для невідомого стану оберіть «записати й запитати», а не «увімкнути, щоб дізнатися». Поради iFixit підтримують використання точної інструкції та допомогу за невпевненості. Вправа обмежена записами огляду й неактивним музейним макетом.',
      ],
      ['fpvRepairSafety'],
      [
        'Use each small inspection alcove or reach the long well-lit return first.',
        'Скористайтеся малими нішами огляду або спершу досягніть довгого освітленого повернення.',
      ],
      'Original magnified inert display bracket, unreadable ID card and intact cover with distinct observation fields, no energized electronics.',
    ),
    row(
      ['Change One Question', 'Змініть одне питання'],
      [
        'Join the comparison benches and keep the fictional test bounded to a paper model.',
        'З’єднайте столи порівняння й обмежте вигадану перевірку паперовою моделлю.',
      ],
      ['A useful comparison says what stayed the same.', 'Корисне порівняння називає незмінне.'],
      [
        'In our paper-model fixture, the same label is viewed under two lamps. The viewing distance and label stay the same; only illumination changes. This helps examine a readability question, not an electrical fault.',
        'Compare that record with one that changes lamp, label and distance at once. Explain which comparison supports a narrower conclusion. No actual aircraft diagnostic or live-circuit procedure is performed.',
      ],
      [
        'У вправі той самий напис паперової моделі розглядають під двома лампами. Відстань і напис незмінні; змінюється лише освітлення. Це питання читабельності, а не електричної несправності.',
        'Порівняйте запис із випадком, де одночасно змінено лампу, напис і відстань. Поясніть, який підтримує точніший висновок. Реальної діагностики апарата чи процедури під живленням немає.',
      ],
      ['experiment'],
      [
        'Join adjacent comparison islands or cross to the unchanged-reference island first.',
        'Поєднайте сусідні острови порівняння або спершу перейдіть до незмінного зразка.',
      ],
      'Original controlled-comparison desk with two lamps over identical paper labels, labelled unchanged distance and one changed variable.',
    ),
    row(
      ['A Battery Stop Card', 'Картка зупинки через акумулятор'],
      [
        'Reveal the safety desk; a damaged or swollen battery is not a beginner repair exercise.',
        'Відкрийте стіл безпеки; пошкоджений чи здутий акумулятор не є вправою ремонту для початківця.',
      ],
      ['Recognizing a boundary is a useful skill.', 'Розпізнавання межі — корисна навичка.'],
      [
        'iFixit advises stopping use of a swollen lithium-ion battery and seeking professional help when uncertain. Damaged batteries must not be punctured or treated as ordinary practice parts.',
        'Our illustration is a flat warning card, not a real battery. Select “stop and follow qualified guidance”, then explain why a successful game route cannot make the item safe. Actual handling follows the manufacturer and local specialist guidance.',
      ],
      [
        'iFixit радить припинити використання здутого літій-іонного акумулятора й звернутися до фахівця за невпевненості. Пошкоджені акумулятори не проколюють і не використовують як звичайні навчальні деталі.',
        'Ілюстрація — пласка картка попередження, а не реальний акумулятор. Оберіть «зупинитися й діяти за фаховими вказівками» та поясніть, чому ігровий маршрут не робить предмет безпечним. Реальне поводження визначають виробник і місцеві фахівці.',
      ],
      ['fpvBattery', 'fpvRepairSafety'],
      [
        'Take the broad quiet safety terrace or connect the small guidance desk first.',
        'Оберіть широку спокійну терасу безпеки або спершу приєднайте малий стіл вказівок.',
      ],
      'Original calm safety-reference desk with a flat battery warning pictogram, stop marker and professional-help card, no handling demonstration.',
    ),
    row(
      ['Repair, Replace, Ask', 'Ремонтувати, замінити, запитати'],
      [
        'Connect the decision stations and preserve the evidence behind each fictional choice.',
        'З’єднайте станції рішень і збережіть підстави кожного вигаданого вибору.',
      ],
      [
        'The same symptom does not always justify the same action.',
        'Однаковий симптом не завжди обґрунтовує однакову дію.',
      ],
      [
        'Our fixture offers three civilian display cases: a torn paper label, an unidentified electronic board and a damaged battery warning card. These belong to different decision boundaries.',
        'Replace the paper label within the display task, request identification for the board, and stop use for the battery case. Explain why “repair everything” is not a sensible single rule. No component-level repair, battery repair or powered testing is taught.',
      ],
      [
        'Вправа має три випадки цивільної експозиції: порваний напис, невизначену електронну плату й картку пошкодженого акумулятора. Межі рішень для них різні.',
        'Замініть паперовий напис у межах макета, запросіть визначення плати й припиніть використання в ситуації з акумулятором. Поясніть, чому «ремонтувати все» — погане єдине правило. Ремонт електроніки, акумуляторів і перевірки під живленням не вивчаються.',
      ],
      ['fpvBattery'],
      [
        'Compare the three decision bays using interior returns or join the evidence spine first.',
        'Порівняйте три зони рішень через внутрішні повернення або спершу з’єднайте вісь доказів.',
      ],
      'Original three-way decision exhibit with paper label, generic board silhouette and warning card, clear replace/ask/stop symbols.',
    ),
    row(
      ['A Responsible Last Step', 'Відповідальний останній крок'],
      [
        'Complete the care notebook with a handoff and an appropriate disposal question.',
        'Завершіть щоденник догляду передачею справ і питанням належної утилізації.',
      ],
      [
        'An item’s story continues after the last repair decision.',
        'Історія предмета триває після останнього рішення про ремонт.',
      ],
      [
        'The US EPA advises keeping lithium-ion batteries out of ordinary trash and municipal recycling, using appropriate collection services instead. Damaged items require specific guidance; local arrangements differ.',
        'Our fictional handoff records the item ID, observation, decision and responsible next contact. Choose “ask the local specialist service” when the destination is unknown. Never invent a shipping or disposal procedure from the game’s museum map.',
      ],
      [
        'Агентство EPA США радить не класти літій-іонні акумулятори до звичайного сміття чи комунальної вторсировини, а користуватися належними службами збору. Пошкоджені предмети потребують окремих вказівок; місцеві умови різняться.',
        'Вигадана передача містить номер предмета, спостереження, рішення та наступний відповідальний контакт. За невідомого місця призначення оберіть «запитати місцеву спеціалізовану службу». Не вигадуйте процедуру пересилання чи утилізації за музейною картою гри.',
      ],
      ['fpvRecycling'],
      [
        'Complete the handoff chain from the centre or join the final two collection desks first.',
        'Завершіть ланцюг передачі від центру або спершу приєднайте останні два столи збору.',
      ],
      'Original completed care notebook with six evidence tabs, local-specialist contact placeholder and separate collection-service symbol, no real shipping labels.',
    ),
  ],
};
