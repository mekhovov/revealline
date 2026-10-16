import { required } from '../data-json.mjs';
import { COMPANY_MISSIONS } from './catalog.mjs';

// Public-source summaries and original fictional reflections. These are authored
// discoveries, not product certification, workshop instruction or real records.
// Sources were checked on 2026-09-28. Existing exact mission artwork is reused.
const sources = {
  culture: {
    title: 'Coupa — Life at Coupa',
    url: 'https://careers.coupa.com/en/life-at-coupa/',
  },
  orders: {
    title: 'Coupa Documentation — About Purchase Orders',
    url: 'https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/purchase-orders/about-purchase-orders',
  },
  invoices: {
    title: 'Coupa Documentation — FAQ About Invoicing for Suppliers',
    url: 'https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/invoices/faq-about-invoicing-for-suppliers',
  },
  workshop: {
    title: 'DroneAid Netherlands — Public mission and workshops',
    url: 'https://drone-aid.nl/en',
  },
  reports: {
    title: 'DroneAid Netherlands — Public reports',
    url: 'https://drone-aid.nl/en/reports',
  },
};

const discoveries = {
  'coupa-spend-in-motion': [
    {
      en: {
        title: 'A connection needs a purpose',
        teaser: 'Discover what makes this village more than a collection of buildings.',
        paragraphs: [
          'Coupa’s public culture connects success with customers, partners and employees. The village is our fictional picture of that shared effort.',
          'Look at the bridge you revealed: name the two places it connects, then imagine what each needs from the other. A useful connection carries a clear purpose.',
        ],
        alt: 'An illustrated blue city with ribbon bridges, collaboration halls and sunlit gardens.',
      },
      uk: {
        title: 'Кожен зв’язок має мету',
        teaser: 'Дізнайтеся, що перетворює окремі будівлі на спільне містечко.',
        paragraphs: [
          'У публічному описі культури Coupa успіх пов’язаний із клієнтами, партнерами та працівниками. Це вигадане містечко зображує їхню спільну роботу.',
          'Погляньте на відкритий міст: назвіть два місця, які він з’єднує, та уявіть, що їм потрібно одне від одного. Корисний зв’язок має зрозумілу мету.',
        ],
        alt: 'Ілюстроване синє місто зі стрічковими мостами, залами для співпраці та сонячними садами.',
      },
      refs: ['culture'],
    },
    {
      en: {
        title: 'Two sides of the same order',
        teaser: 'Open a supplier-square picture and discover why shared references matter.',
        paragraphs: [
          'Coupa documents several ways for suppliers to receive purchase orders: the Supplier Portal, email and cXML. A route is a way to exchange a record, not a different supplier’s value.',
          'In this fictional square, both stalls refer to order VILLAGE-24. Matching that reference lets the buyer and supplier discuss the same request instead of guessing from a picture.',
        ],
        alt: 'Blue supplier arcades around two white market courts separated by a planted colonnade.',
      },
      uk: {
        title: 'Дві сторони одного замовлення',
        teaser:
          'Відкрийте площу постачальників і дізнайтеся, навіщо потрібні спільні номери документів.',
        paragraphs: [
          'Документація Coupa описує кілька способів отримання замовлень постачальниками: портал, електронна пошта та cXML. Це способи обміну документами, а не оцінка постачальника.',
          'На цій вигаданій площі обидві крамниці посилаються на замовлення VILLAGE-24. Спільний номер допомагає покупцеві й постачальнику говорити про той самий запис, а не здогадуватися за зображенням.',
        ],
        alt: 'Сині галереї постачальників навколо двох білих дворів, розділених озелененою колонадою.',
      },
      refs: ['orders'],
    },
    {
      en: {
        title: 'Similar is not the same',
        teaser: 'Collect the paper arcade and inspect a tiny fictional record puzzle.',
        paragraphs: [
          'Two fictional cards show the same amount: 40 credits. One belongs to order VILLAGE-24 and the other to VILLAGE-25. Equal totals alone do not make them duplicates.',
          'Coupa’s invoicing options depend on the customer’s configuration. In real work, use the stated process and check the underlying references; this paper puzzle is not a universal Coupa policy.',
        ],
        alt: 'Folded blank-paper architecture forms a blue arcade around a clear central court.',
      },
      uk: {
        title: 'Схоже не означає однакове',
        teaser: 'Зберіть паперову галерею та розгляньте невелику загадку з вигаданими записами.',
        paragraphs: [
          'На двох вигаданих картках однакова сума: 40 кредитів. Одна стосується VILLAGE-24, інша — VILLAGE-25. Однакові підсумки ще не означають дублювання.',
          'Способи виставлення рахунків у Coupa залежать від налаштувань клієнта. У роботі дотримуйтеся визначеного процесу та перевіряйте посилання на записи; ця загадка не є універсальним правилом Coupa.',
        ],
        alt: 'Архітектура зі складених чистих аркушів утворює синю галерею навколо відкритого двору.',
      },
      refs: ['invoices'],
    },
    {
      en: {
        title: 'Leave a useful next step',
        teaser: 'Reveal the harbour and turn a vague handoff into a clear one.',
        paragraphs: [
          'Coupa’s culture emphasizes collaboration and accountability. Our illustrated bridge turns those ideas into a fictional handoff.',
          'Compare “Please handle this” with “Mira will check delivery VILLAGE-24 against the arrival note, then update the workshop.” The second gives an owner, evidence and next action. What would you still ask?',
        ],
        alt: 'A long blue harbour dock connects to a workshop landing through white bridges and planted terraces.',
      },
      uk: {
        title: 'Залиште зрозумілий наступний крок',
        teaser: 'Відкрийте гавань і перетворіть нечітку передачу справи на зрозумілу.',
        paragraphs: [
          'Культура Coupa підкреслює співпрацю та відповідальність. Ілюстрований міст перетворює ці ідеї на вигаданий приклад передачі справи.',
          'Порівняйте «Займіться цим» і «Міра звірить доставку VILLAGE-24 із записом про прибуття та повідомить майстерню». Другий варіант називає відповідальну особу, дані й наступну дію. Що ще ви запитали б?',
        ],
        alt: 'Довгий синій причал з’єднаний із майстернею білими мостами та озелененими терасами.',
      },
      refs: ['culture'],
    },
    {
      en: {
        title: 'A status is a useful clue',
        teaser: 'Find a calm district and discover why a record needs context.',
        paragraphs: [
          'An invoice status and a payment record answer different questions. Coupa’s supplier FAQ notes that customers do not always update every payment detail in the portal.',
          'In this fictional district, a lamp marked “reviewed” does not tell you when a payment arrived. Ask which event the lamp represents and where its supporting record lives.',
        ],
        alt: 'A blue village glows after rain, with sheltered courts and a quiet central promenade.',
      },
      uk: {
        title: 'Статус — це підказка',
        teaser: 'Знайдіть тихий район і дізнайтеся, чому запис потребує контексту.',
        paragraphs: [
          'Статус рахунку та запис про оплату відповідають на різні запитання. У довідці Coupa для постачальників зазначено, що клієнти не завжди оновлюють усі платіжні відомості на порталі.',
          'У цьому вигаданому районі лампа «перевірено» не показує, коли надійшла оплата. Запитайте, яку саме подію вона позначає та де зберігається відповідний запис.',
        ],
        alt: 'Синє містечко світиться після дощу; затишні двори оточують тиху центральну алею.',
      },
      refs: ['invoices'],
    },
    {
      en: {
        title: 'Make room for another contribution',
        teaser: 'Complete the village celebration and reflect on what made the routes work.',
        paragraphs: [
          'Coupa names belonging and building together among its public values. This celebration is an original illustration, not a photograph of a company event.',
          'You connected six different places. Choose one bridge, one clear reference and one useful handoff from your discoveries. Explain how each helped the fictional village work together.',
        ],
        alt: 'A completed blue village celebrates around illuminated gardens, plazas and connected buildings.',
      },
      uk: {
        title: 'Місце для нового внеску',
        teaser: 'Завершіть свято містечка та поміркуйте, що допомогло з’єднати його маршрути.',
        paragraphs: [
          'Серед публічних цінностей Coupa — відчуття належності та спільне творення. Це свято є оригінальною ілюстрацією, а не фотографією корпоративної події.',
          'Ви з’єднали шість різних місць. Оберіть один міст, один зрозумілий номер запису та один корисний приклад передачі справи. Поясніть, як кожен допоміг вигаданому містечку працювати разом.',
        ],
        alt: 'Завершене синє містечко святкує серед освітлених садів, площ і з’єднаних будівель.',
      },
      refs: ['culture'],
    },
  ],
  'droneaid-nl-workshop-lights': [
    {
      en: {
        title: 'A workshop is also a community',
        teaser: 'Open the workshop picture and meet its real-world inspiration.',
        paragraphs: [
          'DroneAid Netherlands describes teaching electronics, soldering and drone building to veterans and civilians while supporting Ukraine. This room is a fictional illustration inspired by that public mission.',
          'Find the shared table in the picture. Imagine a newcomer asking one question and an experienced participant explaining one unfamiliar word. Both are contributions to learning together.',
        ],
        alt: 'An illustrated Dutch workshop with a carbon-frame FPV quad, goggles and a donation case.',
      },
      uk: {
        title: 'Майстерня — це також спільнота',
        teaser: 'Відкрийте майстерню та дізнайтеся про її реальне джерело натхнення.',
        paragraphs: [
          'DroneAid Netherlands розповідає про навчання ветеранів і цивільних електроніці, паянню та складанню дронів, а також про підтримку України. Ця кімната — вигадана ілюстрація, натхнена публічною місією організації.',
          'Знайдіть спільний стіл. Уявіть запитання новачка та пояснення незнайомого слова від досвідченого учасника. Обидва роблять внесок у спільне навчання.',
        ],
        alt: 'Ілюстрована нідерландська майстерня з FPV-квадрокоптером на карбоновій рамі, окулярами та кейсом.',
      },
      refs: ['workshop'],
    },
    {
      en: {
        title: 'A place to ask and a place to try',
        teaser: 'Discover two different spaces for one shared learning goal.',
        paragraphs: [
          'This fictional room includes a shared bench and a quieter preparation table. They show two ways to participate; neither is a measure of someone’s ability.',
          'Choose where you would first observe a demonstration, then where you would explain it back in your own words. The public DroneAid workshop description is the inspiration, not a report about a particular session.',
        ],
        alt: 'Two FPV workbenches with violet drawers and yellow task lamps provide separate preparation spaces.',
      },
      uk: {
        title: 'Місце для запитань і спроб',
        teaser: 'Відкрийте два різні простори для однієї спільної навчальної мети.',
        paragraphs: [
          'У цій вигаданій кімнаті є спільний верстак і тихіший стіл для підготовки. Це два способи участі, а не оцінка чиїхось здібностей.',
          'Оберіть, де ви спершу спостерігали б за демонстрацією, а де пояснили б її своїми словами. Публічний опис майстерень DroneAid є джерелом натхнення, а не звітом про конкретне заняття.',
        ],
        alt: 'Два FPV-верстаки з фіолетовими шухлядами та жовтими лампами створюють окремі місця для підготовки.',
      },
      refs: ['workshop'],
    },
    {
      en: {
        title: 'Tools have a home',
        teaser: 'Collect the tool-library illustration and solve a shared-workspace puzzle.',
        paragraphs: [
          'DroneAid’s public site identifies tools as one way to support its workshops. A tool’s usefulness also depends on people knowing where to find and return it.',
          'In this fictional library, imagine a labelled place for the driver, a place for inspected tools and a place for an item needing attention. Clear labels help the next person avoid guessing; the illustration is not a tool-use lesson.',
        ],
        alt: 'Precision drivers, soldering stations and motor trays surround a completed quad in an illustrated workshop.',
      },
      uk: {
        title: 'Кожен інструмент має місце',
        teaser:
          'Зберіть ілюстрацію бібліотеки інструментів і розв’яжіть загадку спільного простору.',
        paragraphs: [
          'На публічному сайті DroneAid інструменти названо одним зі способів підтримки майстерень. Їхня користь залежить і від того, чи знають учасники, де їх знайти та куди повернути.',
          'У цій вигаданій бібліотеці уявіть підписані місця для викрутки, перевірених інструментів і речей, що потребують уваги. Зрозумілі позначки допомагають наступній людині; ілюстрація не є інструкцією з використання інструментів.',
        ],
        alt: 'Точні викрутки, паяльні станції та лотки з моторами оточують готовий квадрокоптер у вигаданій майстерні.',
      },
      refs: ['workshop'],
    },
    {
      en: {
        title: 'Connect people before assumptions',
        teaser: 'Reveal three benches and practise a useful question.',
        paragraphs: [
          'The three benches in this original scene represent preparation, explanation and shared reflection. They are not a wiring diagram or a documented DroneAid workflow.',
          'Imagine passing a practice object to another participant. “What have you already checked, and what is still unknown?” makes the next conversation more useful than assuming the object is finished.',
        ],
        alt: 'Three practical workshop benches share a tool station, intact quad and goggles case.',
      },
      uk: {
        title: 'Спершу розмова, потім припущення',
        teaser: 'Відкрийте три столи та сформулюйте корисне запитання.',
        paragraphs: [
          'Три столи в цій оригінальній сцені уособлюють підготовку, пояснення та спільне осмислення. Це не схема з’єднань і не опис робочого процесу DroneAid.',
          'Уявіть, що передаєте навчальний предмет іншому учаснику. Запитання «Що вже перевірено, а що поки невідомо?» корисніше за припущення, що предмет уже готовий.',
        ],
        alt: 'Три робочі столи майстерні мають спільні інструменти, цілий квадрокоптер і кейс для окулярів.',
      },
      refs: ['workshop'],
    },
    {
      en: {
        title: 'Many contributions, one table',
        teaser: 'Discover contributions that do not all look alike.',
        paragraphs: [
          'DroneAid’s public invitation describes different roles, including instructors, fundraisers and designers. Community participation is broader than handling a tool.',
          'In this fictional room, one person might explain a label while another makes a clear illustration. Choose two different contributions and explain how they help the same group. No personal value is scored.',
        ],
        alt: 'Several finished quads and sorted motor trays share a long timber worktable.',
      },
      uk: {
        title: 'Різні внески за спільним столом',
        teaser: 'Дізнайтеся про внески, які не обов’язково схожі між собою.',
        paragraphs: [
          'У публічному запрошенні DroneAid згадано різні ролі, зокрема інструкторів, фандрейзерів і дизайнерів. Участь у спільноті не обмежується роботою з інструментами.',
          'У цій вигаданій кімнаті хтось пояснює позначку, а хтось створює зрозумілу ілюстрацію. Оберіть два різні внески та поясніть, як вони допомагають одній групі. Особисті якості не оцінюються балами.',
        ],
        alt: 'Кілька готових квадрокоптерів і впорядковані лотки з моторами стоять на довгому дерев’яному столі.',
      },
      refs: ['workshop'],
    },
    {
      en: {
        title: 'A complete picture is not a report',
        teaser: 'Light the whole room and discover where real-world evidence belongs.',
        paragraphs: [
          'DroneAid Netherlands publishes public reporting on donations and expenses. The numbers belong to dated reports; this illustration and your game score are not evidence of real-world impact.',
          'Describe one thing the picture shows and one thing it cannot prove. A useful community story can celebrate contribution while linking readers to the actual source.',
        ],
        alt: 'Warm lights reveal completed quads and protected cases in a fictional Ukraine-support workshop.',
      },
      uk: {
        title: 'Завершена картина — ще не звіт',
        teaser: 'Освітіть усю кімнату та дізнайтеся, де шукати докази реальних результатів.',
        paragraphs: [
          'DroneAid Netherlands публікує звітність про пожертви та витрати. Числа належать до датованих звітів; ця ілюстрація й ваш ігровий рахунок не доводять реального впливу.',
          'Назвіть одну річ, яку показує картина, й одну, якої вона не може довести. Корисна розповідь про спільноту може відзначати внесок людей і водночас посилатися на справжнє джерело.',
        ],
        alt: 'Теплі лампи освітлюють готові квадрокоптери й захисні кейси у вигаданій майстерні підтримки України.',
      },
      refs: ['reports'],
    },
  ],
};

const finales = {
  'coupa-spend-in-motion': {
    en: {
      title: 'The Connected Village',
      teaser:
        'Win all six missions to collect the complete village gallery and its connection guide.',
      paragraphs: [
        'Six places, one collection: purpose, shared references, careful comparison, useful handoffs, meaningful status and room for another contribution.',
        'Try a new fictional situation: a library needs replacement lamps. Who needs to agree on the requirement? Which reference connects the conversation? What evidence would the next person need? Use your six discoveries to explain a clear next step.',
        'This is an illustrative adventure. It does not certify product knowledge or represent a universal customer policy. The public sources remain available below and on each discovery.',
      ],
      linkTitle: 'Explore Coupa’s public culture',
    },
    uk: {
      title: 'З’єднане містечко',
      teaser:
        'Переможіть у всіх шести місіях, щоб зібрати галерею містечка та довідник корисних зв’язків.',
      paragraphs: [
        'Шість місць, одна колекція: мета, спільні номери записів, уважне порівняння, зрозуміла передача справи, значення статусу та місце для нового внеску.',
        'Розгляньте нову вигадану ситуацію: бібліотеці потрібні нові лампи. Хто має узгодити потребу? Який номер запису об’єднає розмову? Які дані потрібні наступній людині? Використайте шість відкриттів, щоб пояснити зрозумілий наступний крок.',
        'Це ілюстрована пригода. Вона не підтверджує кваліфікацію з продукту й не встановлює універсальних правил клієнтів. Публічні джерела доступні нижче та в кожному відкритті.',
      ],
      linkTitle: 'Дізнатися про культуру Coupa',
    },
    refs: ['culture', 'orders', 'invoices'],
    link: 'culture',
  },
  'droneaid-nl-workshop-lights': {
    en: {
      title: 'A Workshop Built Together',
      teaser:
        'Win all six missions to unlock the full workshop gallery and community reflection guide.',
      paragraphs: [
        'Your six discoveries form a fictional community workshop: welcome, different learning spaces, shared tools, useful questions, varied contributions and evidence-backed stories.',
        'Imagine explaining this gallery to a newcomer. Choose one welcoming detail, one question that prevents an assumption and one link that supports a real claim. A picture can invite curiosity; the source provides the factual context.',
        'DroneAid Netherlands publicly describes supporting Ukraine through technical learning and donated drones, including support for the Ukrainian Armed Forces. These scenes do not depict actual workshops, certify assembly skills or show deployment outcomes.',
      ],
      linkTitle: 'Read DroneAid Netherlands’ public mission',
    },
    uk: {
      title: 'Майстерня, створена разом',
      teaser:
        'Переможіть у всіх шести місіях, щоб відкрити повну галерею майстерні та запитання про спільноту.',
      paragraphs: [
        'Шість відкриттів утворюють вигадану майстерню: гостинність, різні навчальні простори, спільні інструменти, корисні запитання, різноманітні внески та розповіді з джерелами.',
        'Уявіть, що пояснюєте галерею новому учаснику. Оберіть одну гостинну деталь, одне запитання, що запобігає припущенню, та одне посилання на підтвердження факту. Картина пробуджує цікавість, а джерело дає фактичний контекст.',
        'DroneAid Netherlands публічно описує підтримку України через технічне навчання й передавання дронів, зокрема підтримку Збройних сил України. Сцени не показують реальних занять, не підтверджують навичок складання та не відображають результатів застосування.',
      ],
      linkTitle: 'Прочитати про місію DroneAid Netherlands',
    },
    refs: ['workshop', 'reports'],
    link: 'workshop',
  },
};

export const COMPANY_REWARD_CAMPAIGN_IDS = Object.freeze(Object.keys(discoveries));

const localized = (row, select) =>
  Object.fromEntries(['en', 'uk'].map((locale) => [locale, select(row[locale])]));

/** Authoring-only factory. It never changes mission geometry, presentation
 * revisions or completion authority. The compiler supplies checked bindings. */
export function createCompanyRewards({ definition, source, assets, missionBindings }) {
  const rows = discoveries[definition.id];
  if (!rows) return [];
  required(rows.length === definition.missionIds.length, 'Reward pilot must cover every mission.');
  const requirements = definition.missionIds.map((id) => {
    const binding = missionBindings.find((entry) => entry.levelId === id);
    required(binding && binding.campaignId === definition.id, `Missing reward binding: ${id}.`);
    return { missionId: id, bindings: structuredClone(binding.bindings) };
  });
  const imageFor = (index) => {
    const id = definition.missionIds[index];
    const mission = source.missions.find((entry) => entry.id === id);
    const picture = source.assets.find(
      (entry) => entry.id === mission?.presentation.backgroundAssetId,
    );
    const descriptor =
      picture &&
      assets.find(
        (entry) =>
          entry.path === `game/${picture.path}` &&
          entry.sha256 === picture.sha256 &&
          entry.bytes === picture.bytes,
      );
    required(descriptor, `Reward picture needs an exact public asset: ${id}.`);
    return {
      id: `${id}-image`,
      type: 'image',
      asset: { assetId: descriptor.id, sha256: descriptor.sha256 },
      locales: localized(rows[index], ({ title, alt }) => ({ title, alt })),
    };
  };
  const knowledge = (id, row) => ({
    id,
    type: 'knowledge',
    locales: localized(row, ({ title, paragraphs }) => ({
      title,
      paragraphs,
      sources: row.refs.map((ref) => ({ ...sources[ref] })),
    })),
  });
  const base = (id, scope, row, missionRequirements, payloads) => ({
    format: 'revealline-completion-reward.v1',
    id,
    revision: '1',
    brandId: definition.brandId,
    campaignId: definition.id,
    scope,
    locales: localized(row, ({ title, teaser }) => ({ title, teaser })),
    requirements: { missions: missionRequirements, learning: [], mastery: [] },
    payloads,
  });
  const missionRewards = rows.map((row, index) => {
    const missionId = definition.missionIds[index];
    required(
      COMPANY_MISSIONS.some((entry) => entry.id === missionId),
      'Unknown reward mission.',
    );
    return base(
      `${missionId}-discovery`,
      { kind: 'mission', id: missionId },
      row,
      [requirements[index]],
      [imageFor(index), knowledge(`${missionId}-knowledge`, row)],
    );
  });
  const finale = finales[definition.id];
  return [
    ...missionRewards,
    base(`${definition.id}-finale`, { kind: 'campaign', id: definition.id }, finale, requirements, [
      knowledge(`${definition.id}-guide`, finale),
      ...rows.map((_, index) => imageFor(index)),
      {
        id: `${definition.id}-official-source`,
        type: 'url',
        url: sources[finale.link].url,
        locales: localized(finale, ({ linkTitle }) => ({ title: linkTitle })),
      },
    ]),
  ];
}
