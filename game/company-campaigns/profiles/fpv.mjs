// Optional, mission-specific bilingual exploration prompts; common facts and sources remain visible.
export const FPV_LEARNING_PROFILES = {
  'fpv-meet-aircraft-01': {
    families: {
      en: {
        title: 'Explore together: The Frame',
        paragraphs: [
          'Together, find what supports the model. Compare the frame with a shelf: what job belongs to the support, and what belongs to the things it holds?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Рама',
        paragraphs: [
          'Разом знайдіть опору моделі. Порівняйте раму з полицею: яке завдання має опора, а яке — речі на ній?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: The Frame',
        paragraphs: [
          'Point to an arm and the centre. Explain why holding a component is different from sensing movement or sending a command.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Рама',
        paragraphs: [
          'Покажіть промінь і центр. Поясніть, чому утримувати деталь — не те саме, що вимірювати рух чи передавати команду.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: The Frame',
        paragraphs: [
          'A second fictional display has a different frame outline. Which support-role claim transfers, and which dimensions or compatibility claims still need exact evidence?',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Рама',
        paragraphs: [
          'Інша вигадана модель має раму іншої форми. Який висновок про опору залишається чинним, а які розміри чи сумісність потребують точних даних?',
        ],
      },
    },
  },
  'fpv-meet-aircraft-02': {
    families: {
      en: {
        title: 'Explore together: Motion Makers',
        paragraphs: [
          'Take turns pointing to the motor and the separate propeller. Describe rotation and moving air without touching or powering equipment.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Джерела руху',
        paragraphs: [
          'По черзі покажіть двигун і окремий пропелер. Опишіть обертання та рух повітря, не торкаючись обладнання й не вмикаючи його.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Motion Makers',
        paragraphs: [
          'Complete two role sentences: the motor produces rotation; the propeller uses rotation to move air. Why are these separate roles?',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Джерела руху',
        paragraphs: [
          'Доповніть два описи: двигун створює обертання; пропелер використовує обертання для руху повітря. Чому це різні ролі?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Motion Makers',
        paragraphs: [
          'Compare two fictional motor cards with no ratings. Explain the shared role and identify why appearance cannot establish matching propellers or performance.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Джерела руху',
        paragraphs: [
          'Порівняйте дві вигадані картки двигунів без характеристик. Поясніть спільну роль і чому вигляд не доводить сумісності пропелерів чи продуктивності.',
        ],
      },
    },
  },
  'fpv-meet-aircraft-03': {
    families: {
      en: {
        title: 'Explore together: The ESC',
        paragraphs: [
          'One person names a request; another names an energy source. Which idea belongs to a command, and which belongs to the supply?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Регулятор ESC',
        paragraphs: [
          'Одна людина називає запит, інша — джерело енергії. Що належить до команди, а що — до живлення?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: The ESC',
        paragraphs: [
          'Trace the two conceptual ribbons in the exhibit. Explain why the ESC needs a command relationship and an energy relationship.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Регулятор ESC',
        paragraphs: [
          'Простежте дві умовні стрічки виставки. Поясніть, чому ESC має зв’язок із командами та зв’язок з енергією.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: The ESC',
        paragraphs: [
          'An unfamiliar civilian model labels only its motor command. Name the missing energy relationship without inventing connectors, electrical ratings or configuration.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Регулятор ESC',
        paragraphs: [
          'Незнайома цивільна модель позначає лише команду двигуна. Назвіть відсутній зв’язок з енергією, не вигадуючи роз’ємів, електричних параметрів чи налаштувань.',
        ],
      },
    },
  },
  'fpv-meet-aircraft-04': {
    families: {
      en: {
        title: 'Explore together: The Flight Controller',
        paragraphs: [
          'Together, separate something the model senses from something a person requests. Explain why these are not the same message.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Польотний контролер',
        paragraphs: [
          'Разом відокремте те, що модель вимірює, від того, чого просить людина. Поясніть, чому це різні повідомлення.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: The Flight Controller',
        paragraphs: [
          'Use the three words sense, interpret and command to tell the controller story. Keep information flow separate from physical connections.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Польотний контролер',
        paragraphs: [
          'Розкажіть про контролер словами «виміряти, опрацювати, керувати». Відокремте потік інформації від фізичних з’єднань.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: The Flight Controller',
        paragraphs: [
          'For a different fictional exhibit, classify a sensor observation and an operator request. What additional documentation would be needed to discuss real control behaviour?',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Польотний контролер',
        paragraphs: [
          'Для іншої вигаданої виставки розрізніть показ датчика й запит оператора. Які додаткові документи потрібні для розмови про реальну поведінку керування?',
        ],
      },
    },
  },
  'fpv-meet-aircraft-05': {
    families: {
      en: {
        title: 'Explore together: Two Different Links',
        paragraphs: [
          'One person describes the camera picture; another describes a control message. Decide together whether seeing one proves the other arrived.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Два різні канали',
        paragraphs: [
          'Одна людина описує зображення камери, інша — команду керування. Разом визначте, чи наявність одного доводить отримання іншого.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Two Different Links',
        paragraphs: [
          'Match RX to incoming control and camera/VTX to the picture pathway. State what remains unknown when only a picture is confirmed.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Два різні канали',
        paragraphs: [
          'Зіставте RX із прийманням команд, а камеру/VTX — зі шляхом зображення. Що лишається невідомим, якщо підтверджена лише картинка?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Two Different Links',
        paragraphs: [
          'A second fictional report confirms commands but says nothing about video. Write the narrow supported conclusion, without proposing field troubleshooting.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Два різні канали',
        paragraphs: [
          'Інший вигаданий звіт підтверджує команди, але нічого не каже про відео. Сформулюйте вузький доведений висновок без польової діагностики.',
        ],
      },
    },
  },
  'fpv-meet-aircraft-06': {
    families: {
      en: {
        title: 'Explore together: The Whole Aircraft',
        paragraphs: [
          'Sort the discoveries together into support, energy and information. Let one item connect two ideas and explain the choice.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Цілий дрон',
        paragraphs: [
          'Разом розподіліть відкриття між опорою, енергією та інформацією. Дозвольте одній деталі поєднати дві ідеї й поясніть вибір.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: The Whole Aircraft',
        paragraphs: [
          'Explain why a battery is not a command. Retell the component atlas using roles rather than a sequence of physical assembly steps.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Цілий дрон',
        paragraphs: [
          'Поясніть, чому акумулятор не є командою. Перекажіть атлас через ролі, а не послідовність фізичного складання.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: The Whole Aircraft',
        paragraphs: [
          'Apply the three-role model to a new fictional museum diagram. Mark unanswered component questions explicitly; the atlas alone cannot establish a build specification.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Цілий дрон',
        paragraphs: [
          'Застосуйте три ролі до нової вигаданої музейної схеми. Явно позначте питання про деталі: сам атлас не визначає специфікацію складання.',
        ],
      },
    },
  },
  'fpv-parts-bench-01': {
    families: {
      en: {
        title: 'Explore together: A Tray of Questions',
        paragraphs: [
          'Take turns sorting inert component cards by their jobs. Give the unknown connector its own question card rather than guessing together.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Лоток запитань',
        paragraphs: [
          'По черзі сортуйте картки неактивних деталей за ролями. Для невідомого роз’єму створіть окреме запитання замість спільного здогаду.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Tray of Questions',
        paragraphs: [
          'Choose structure, energy, sensing or communication for each known card. Explain why an unknown connector belongs under manual needed.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Лоток запитань',
        paragraphs: [
          'Оберіть конструкцію, енергію, вимірювання чи зв’язок для кожної відомої картки. Чому невідомий роз’єм потребує інструкції?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Tray of Questions',
        paragraphs: [
          'Another fictional kit includes an unfamiliar combined module. Separate known roles from missing identification; do not infer compatibility from the kit description.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Лоток запитань',
        paragraphs: [
          'В іншому вигаданому наборі є незнайомий комбінований модуль. Відокремте відомі ролі від відсутньої ідентифікації; опис набору не доводить сумісності.',
        ],
      },
    },
  },
  'fpv-parts-bench-02': {
    families: {
      en: {
        title: 'Explore together: Which Way Is Forward?',
        paragraphs: [
          'Turn a paper drawing together. Which marker turns with the model, and which page arrow stays where it was?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Де передня частина?',
        paragraphs: [
          'Разом поверніть паперовий малюнок. Яка позначка повертається з моделлю, а яка стрілка сторінки залишається на місці?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Which Way Is Forward?',
        paragraphs: [
          'Name the model’s blue nose before describing left or right. Keep page north separate from the aircraft’s forward direction.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Де передня частина?',
        paragraphs: [
          'Назвіть синій ніс моделі, перш ніж описувати ліворуч чи праворуч. Відокремте північ сторінки від переднього напрямку апарата.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Which Way Is Forward?',
        paragraphs: [
          'A different fictional controller drawing lacks an orientation mark. State what the illustration cannot establish and which exact documentation would be needed.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Де передня частина?',
        paragraphs: [
          'На іншому вигаданому зображенні контролера немає позначки орієнтації. Що не можна встановити за малюнком і яка точна документація потрібна?',
        ],
      },
    },
  },
  'fpv-parts-bench-03': {
    families: {
      en: {
        title: 'Explore together: Three Coloured Paths',
        paragraphs: [
          'Follow one ribbon each: support, energy or information. Find a card that belongs to more than one conversation.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Три кольорові шляхи',
        paragraphs: [
          'Простежте по одній стрічці: опору, енергію чи інформацію. Знайдіть картку, що стосується більш ніж однієї розмови.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Three Coloured Paths',
        paragraphs: [
          'Place frame, battery and receiver cards by their roles. Explain why the ESC connects the command story with the motor-energy story.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Три кольорові шляхи',
        paragraphs: [
          'Розмістіть картки рами, акумулятора й приймача за ролями. Чому ESC поєднує історію команд з історією енергії двигуна?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Three Coloured Paths',
        paragraphs: [
          'Redraw the same roles for an unfamiliar inert display. What can the ribbons explain, and why can they not establish physical wiring?',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Три кольорові шляхи',
        paragraphs: [
          'Перемалюйте ті самі ролі для незнайомого неактивного експоната. Що пояснюють стрічки й чому вони не визначають фізичну проводку?',
        ],
      },
    },
  },
  'fpv-parts-bench-04': {
    families: {
      en: {
        title: 'Explore together: Same Shape, Different Label',
        paragraphs: [
          'Two cards have the same outline but different names. Together, explain why looking alike is not enough to join them.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Схожа форма, інший напис',
        paragraphs: [
          'Дві картки мають однаковий контур, але різні назви. Разом поясніть, чому схожого вигляду недостатньо, щоб їх поєднати.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Same Shape, Different Label',
        paragraphs: [
          'Add the fictional board revision and connector label to a question card. Choose the exact manual instead of a visual match.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Схожа форма, інший напис',
        paragraphs: [
          'Додайте вигадану версію плати й назву роз’єму до картки запитання. Оберіть точну інструкцію замість візуального збігу.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Same Shape, Different Label',
        paragraphs: [
          'A second fixture offers two manuals for different revisions. Describe the evidence needed to select one, without copying either pinout into the model.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Схожа форма, інший напис',
        paragraphs: [
          'Інший приклад має дві інструкції для різних версій. Які дані потрібні для вибору, без перенесення розпіновки в модель?',
        ],
      },
    },
  },
  'fpv-parts-bench-05': {
    families: {
      en: {
        title: 'Explore together: Look Before the Next Step',
        paragraphs: [
          'Look together at the cardboard arm, label and identifier. Say only what is visible before suggesting who could help.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Огляд перед наступним кроком',
        paragraphs: [
          'Разом огляньте картонний промінь, етикетку й ідентифікатор. Спершу назвіть лише видиме, а тоді — хто може допомогти.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Look Before the Next Step',
        paragraphs: [
          'Separate a cracked display piece from an unreadable identifier. Which needs a display replacement, and which needs identification?',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Огляд перед наступним кроком',
        paragraphs: [
          'Відокремте тріснуту деталь експоната від нечитабельного ідентифікатора. Що потребує заміни в експонаті, а що — встановлення назви?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Look Before the Next Step',
        paragraphs: [
          'Compare a clear photograph with a blurred one of another inert model. Keep observation confidence separate from any claim about internal condition.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Огляд перед наступним кроком',
        paragraphs: [
          'Порівняйте чітке й розмите фото іншої неактивної моделі. Відокремте впевненість у спостереженні від висновків про внутрішній стан.',
        ],
      },
    },
  },
  'fpv-parts-bench-06': {
    families: {
      en: {
        title: 'Explore together: The Model Handoff',
        paragraphs: [
          'Tell another person what the model is for and one question still open. A careful handoff can include an honest unknown.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Передача моделі',
        paragraphs: [
          'Розкажіть іншій людині, для чого модель і яке питання відкрите. Уважна передача справ може містити чесне «невідомо».',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: The Model Handoff',
        paragraphs: [
          'Fill purpose, identified parts, open questions and next responsible person. Explain why display complete does not mean aircraft ready.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Передача моделі',
        paragraphs: [
          'Заповніть мету, визначені деталі, відкриті питання й відповідальну людину. Чому готовий експонат не означає готовий до польоту апарат?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: The Model Handoff',
        paragraphs: [
          'Review a new fictional handoff that hides an unreadable identifier. Rewrite it to preserve the uncertainty and assign a clear next contact.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Передача моделі',
        paragraphs: [
          'Перегляньте іншу вигадану передачу справ, де приховано нечитабельний ідентифікатор. Збережіть невизначеність і вкажіть чіткий наступний контакт.',
        ],
      },
    },
  },
  'fpv-soldering-workshop-01': {
    families: {
      en: {
        title: 'Explore together: A Place for the Iron',
        paragraphs: [
          'Together, find the cold-tool stand and the practice area in the drawing. Discuss why preparation comes before using any real hot tool.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Місце для паяльника',
        paragraphs: [
          'Разом знайдіть підставку холодного інструмента й навчальну зону на малюнку. Обговоріть, чому підготовка передує роботі справжнім гарячим інструментом.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Place for the Iron',
        paragraphs: [
          'Separate the stand, fume-control provision and hand path on the fictional workspace card. Keep this a cold, illustrated planning exercise.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Місце для паяльника',
        paragraphs: [
          'Розрізніть підставку, засіб контролю випарів і шлях рук на картці місця. Залишайте вправу плануванням за ілюстрацією без нагрівання.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Place for the Iron',
        paragraphs: [
          'Compare two fictional workspace drawings. Identify missing evidence about exposure control; a tidy picture does not establish an adequately controlled real workspace.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Місце для паяльника',
        paragraphs: [
          'Порівняйте два вигадані робочі місця. Визначте відсутні дані про контроль впливу випарів: охайний малюнок не доводить належної організації реального місця.',
        ],
      },
    },
  },
  'fpv-soldering-workshop-02': {
    families: {
      en: {
        title: 'Explore together: Read the Spool',
        paragraphs: [
          'Read the fictional material cards together. Put the unlabelled spool in the question group instead of guessing from its colour.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Прочитайте котушку',
        paragraphs: [
          'Разом прочитайте картки вигаданих матеріалів. Відкладіть котушку без етикетки до запитань, не вгадуючи за кольором.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Read the Spool',
        paragraphs: [
          'Find material name, supplier guidance and the unknown field. Explain why lead-free does not mean flux fumes need no control.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Прочитайте котушку',
        paragraphs: [
          'Знайдіть назву матеріалу, вказівки постачальника й невідоме поле. Чому безсвинцевий матеріал не скасовує потреби контролю випарів флюсу?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Read the Spool',
        paragraphs: [
          'A different fictional spool has a readable brand but no material identification. What claim remains unsupported, and whose guidance should resolve it?',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Прочитайте котушку',
        paragraphs: [
          'Інша вигадана котушка має читабельну марку, але не склад матеріалу. Який висновок не підтверджений і чиї вказівки потрібні?',
        ],
      },
    },
  },
  'fpv-soldering-workshop-03': {
    families: {
      en: {
        title: 'Explore together: Hold the Practice Piece',
        paragraphs: [
          'Compare a loose paper practice piece with one shown in a holder. Which drawing leaves the part easier to inspect together?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Зафіксуйте навчальну деталь',
        paragraphs: [
          'Порівняйте вільну паперову навчальну деталь із деталлю в тримачі. Який малюнок полегшує спільний огляд?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Hold the Practice Piece',
        paragraphs: [
          'Point to the pad, lead and holder in the inert fixture. Explain why stable placement and visibility are separate preparation questions.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Зафіксуйте навчальну деталь',
        paragraphs: [
          'Покажіть контактний майданчик, вивід і тримач у неактивному прикладі. Чому стійкість і видимість — окремі питання підготовки?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Hold the Practice Piece',
        paragraphs: [
          'A second practice drawing changes the holder and hides a contact surface. Describe the inspection information lost; do not invent tool settings.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Зафіксуйте навчальну деталь',
        paragraphs: [
          'Інший навчальний малюнок змінює тримач і приховує контактну поверхню. Опишіть втрачену інформацію для огляду, не вигадуючи налаштувань інструмента.',
        ],
      },
    },
  },
  'fpv-soldering-workshop-04': {
    families: {
      en: {
        title: 'Explore together: Where the Heat Goes',
        paragraphs: [
          'Together, find the two surfaces in the cutaway. Compare that drawing with a picture that shows only a lump.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Куди передається тепло',
        paragraphs: [
          'Разом знайдіть дві поверхні на розрізі. Порівняйте його з малюнком, що показує лише грудочку.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Where the Heat Goes',
        paragraphs: [
          'Explain which cutaway identifies both pad and lead. Name one part of the real process that a still drawing cannot demonstrate.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Куди передається тепло',
        paragraphs: [
          'Поясніть, який розріз позначає і майданчик, і вивід. Назвіть частину реального процесу, яку нерухомий малюнок не доводить.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Where the Heat Goes',
        paragraphs: [
          'Consider a different fictional joint type. Which relationship might still be discussed, and why must the through-hole example not become a universal procedure?',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Куди передається тепло',
        paragraphs: [
          'Розгляньте інший вигаданий тип з’єднання. Який зв’язок можна обговорити й чому приклад наскрізного монтажу не є універсальною процедурою?',
        ],
      },
    },
  },
  'fpv-soldering-workshop-05': {
    families: {
      en: {
        title: 'Explore together: An Inspection, Not a Guess',
        paragraphs: [
          'Point to the visible bridge or gap together. Keep what you see separate from a story about how it happened.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Огляд, а не здогад',
        paragraphs: [
          'Разом покажіть видиму перемичку чи проміжок. Відокремте спостереження від історії про те, як це сталося.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: An Inspection, Not a Guess',
        paragraphs: [
          'Describe each drawn sample without calling it electrically sound. Explain why shine alone cannot decide whether a real joint is acceptable.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Огляд, а не здогад',
        paragraphs: [
          'Опишіть кожен зразок, не оголошуючи його електрично справним. Чому сам блиск не визначає придатність справжнього з’єднання?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: An Inspection, Not a Guess',
        paragraphs: [
          'An unfamiliar sample looks smooth but its history is missing. Write a bounded observation and an instructor-review question instead of an acceptance verdict.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Огляд, а не здогад',
        paragraphs: [
          'Незнайомий зразок гладкий, але його історія відсутня. Запишіть обмежене спостереження й питання викладачеві замість висновку про придатність.',
        ],
      },
    },
  },
  'fpv-soldering-workshop-06': {
    families: {
      en: {
        title: 'Explore together: Know When to Pause',
        paragraphs: [
          'Read the uncertain result card together. Practise saying what is known and asking for help without needing to solve everything now.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Знайте, коли зупинитися',
        paragraphs: [
          'Разом прочитайте картку невизначеного результату. Скажіть, що відомо, й попросіть допомоги без потреби негайно все вирішити.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Know When to Pause',
        paragraphs: [
          'Keep intermittent indication separate from established cause. Explain why the illustrated next step is to pause and seek instructor guidance.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Знайте, коли зупинитися',
        paragraphs: [
          'Відокремте нестале показання від встановленої причини. Поясніть, чому наступний крок в ілюстрації — пауза й звернення до викладача.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Know When to Pause',
        paragraphs: [
          'A second fictional record reports one normal reading after an uncertain result. Explain why that observation alone cannot establish lasting reliability.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Знайте, коли зупинитися',
        paragraphs: [
          'Інший вигаданий запис містить одне нормальне показання після невизначеного результату. Чому воно саме не доводить тривалої надійності?',
        ],
      },
    },
  },
  'fpv-four-controls-01': {
    families: {
      en: {
        title: 'Explore together: Two Sticks, Four Names',
        paragraphs: [
          'Take turns naming the four controls on the labelled diagram. Compare a stick location with the name of a command.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Два стіки, чотири назви',
        paragraphs: [
          'По черзі назвіть чотири керування на підписаній схемі. Порівняйте положення стіка з назвою команди.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Two Sticks, Four Names',
        paragraphs: [
          'Use the displayed Mode 2 labels to match the axes. Explain why stick placement does not specify every aircraft’s response.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Два стіки, чотири назви',
        paragraphs: [
          'За показаними позначеннями Mode 2 зіставте осі. Чому розташування стіків не визначає реакцію кожного апарата?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Two Sticks, Four Names',
        paragraphs: [
          'Another fictional controller uses a different labelled mode. Compare placement without assuming the real mapping or flight mode from its appearance.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Два стіки, чотири назви',
        paragraphs: [
          'Інший вигаданий пульт має інший підписаний режим. Порівняйте розташування, не визначаючи реальне зіставлення чи режим польоту за виглядом.',
        ],
      },
    },
  },
  'fpv-four-controls-02': {
    families: {
      en: {
        title: 'Explore together: Pitch: Read the Nose',
        paragraphs: [
          'Point together to the model’s nose in the level and tilted views. Describe the change before guessing where it would move.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Тангаж: стежте за носом',
        paragraphs: [
          'Разом покажіть ніс моделі на рівному й нахиленому виглядах. Опишіть зміну, перш ніж вгадувати подальший рух.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Pitch: Read the Nose',
        paragraphs: [
          'Find the side-to-side rotation axis. Separate a pitch orientation change from a statement about position or travel.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Тангаж: стежте за носом',
        paragraphs: [
          'Знайдіть поперечну вісь обертання. Відокремте зміну орієнтації за тангажем від твердження про положення чи переміщення.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Pitch: Read the Nose',
        paragraphs: [
          'A different fictional response card requests tilt rather than travel. State its assumption and identify why the same input name does not prove identical dynamics.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Тангаж: стежте за носом',
        paragraphs: [
          'Інша вигадана картка реакції задає нахил, а не переміщення. Назвіть припущення: чому однакова назва входу не доводить однакової динаміки?',
        ],
      },
    },
  },
  'fpv-four-controls-03': {
    families: {
      en: {
        title: 'Explore together: Roll: One Wingtip Lower',
        paragraphs: [
          'Keep the model’s marked side in sight while comparing two views. Does the model’s left always appear on the screen’s left?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Крен: один бік нижче',
        paragraphs: [
          'Стежте за позначеним боком моделі, порівнюючи два види. Чи її лівий бік завжди ліворуч на екрані?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Roll: One Wingtip Lower',
        paragraphs: [
          'Name the front-to-back axis and the side that lowers. State the viewpoint before using left or right.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Крен: один бік нижче',
        paragraphs: [
          'Назвіть поздовжню вісь і бік, що опускається. Уточніть точку огляду перед словами «ліворуч» і «праворуч».',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Roll: One Wingtip Lower',
        paragraphs: [
          'A second fixture turns the camera around an unchanged tilted model. Explain which screen description changes and which aircraft-relative observation remains true.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Крен: один бік нижче',
        paragraphs: [
          'Інший приклад повертає камеру навколо незмінно нахиленої моделі. Який опис на екрані змінюється, а яке спостереження відносно апарата залишається?',
        ],
      },
    },
  },
  'fpv-four-controls-04': {
    families: {
      en: {
        title: 'Explore together: Yaw: Turn the Heading',
        paragraphs: [
          'Compare the two heading markers together. Find the shared centre and explain what the drawing changes around it.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Рискання: змініть курс',
        paragraphs: [
          'Разом порівняйте дві позначки напрямку. Знайдіть спільний центр і поясніть, що малюнок змінює навколо нього.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Yaw: Turn the Heading',
        paragraphs: [
          'Identify the vertical rotation axis. Keep a changed heading separate from a changed floor position in this static comparison.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Рискання: змініть курс',
        paragraphs: [
          'Визначте вертикальну вісь обертання. Відокремте змінений курс від зміненого положення над підлогою в цьому статичному порівнянні.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Yaw: Turn the Heading',
        paragraphs: [
          'Another fictional card describes rotation rate, not a selected compass heading. Explain the difference without assuming real position hold from the still illustration.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Рискання: змініть курс',
        paragraphs: [
          'Інша вигадана картка описує швидкість обертання, а не обраний компасний курс. Поясніть різницю, не виводячи утримання позиції з нерухомої ілюстрації.',
        ],
      },
    },
  },
  'fpv-four-controls-05': {
    families: {
      en: {
        title: 'Explore together: Throttle Needs a Model',
        paragraphs: [
          'Read the two model captions together. Which one describes this model, and which makes a claim about every aircraft?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Газ потребує пояснення моделі',
        paragraphs: [
          'Разом прочитайте два підписи моделей. Який описує цю модель, а який — усі апарати?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Throttle Needs a Model',
        paragraphs: [
          'Choose the bounded assisted-model statement. Explain why centred throttle cannot be treated as a universal promise of hovering.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Газ потребує пояснення моделі',
        paragraphs: [
          'Оберіть обмежене твердження про модель із допомогою. Чому середній газ не можна вважати універсальною обіцянкою зависання?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Throttle Needs a Model',
        paragraphs: [
          'A new fictional fixture specifies a different throttle interpretation. Identify the mode assumption that must accompany any prediction; no real settings are inferred.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Газ потребує пояснення моделі',
        paragraphs: [
          'Новий вигаданий приклад задає іншу інтерпретацію газу. Яке припущення про режим потрібне для прогнозу? Реальні налаштування не виводяться.',
        ],
      },
    },
  },
  'fpv-four-controls-06': {
    families: {
      en: {
        title: 'Explore together: Predict, Then Explain',
        paragraphs: [
          'Choose one labelled command together and explain the pictured change. Swap viewpoints and see which part of your explanation still works.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Спрогнозуйте й поясніть',
        paragraphs: [
          'Разом оберіть підписану команду й поясніть показану зміну. Поміняйте точки огляду й перевірте, яка частина пояснення збереглася.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Predict, Then Explain',
        paragraphs: [
          'Read the placement and response assumptions first. Make a prediction, then separate the command from the viewpoint used to describe it.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Спрогнозуйте й поясніть',
        paragraphs: [
          'Спершу прочитайте припущення про розташування й реакцію. Спрогнозуйте зміну, тоді відокремте команду від точки огляду для її опису.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Predict, Then Explain',
        paragraphs: [
          'Create a second fictional card that changes only viewpoint. Explain what transfers and what evidence would be needed before applying the idea to real equipment.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Спрогнозуйте й поясніть',
        paragraphs: [
          'Створіть іншу вигадану картку, змінивши лише точку огляду. Що переноситься, а які дані потрібні перед застосуванням до реального обладнання?',
        ],
      },
    },
  },
  'fpv-first-flight-01': {
    families: {
      en: {
        title: 'Explore together: Start with a Stop',
        paragraphs: [
          'Find pause and reset together before exploring the optional gym. Name one reason a model can help even when it omits real conditions.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Почніть із зупинки',
        paragraphs: [
          'Разом знайдіть паузу й скидання перед вивченням додаткової зали. Чим корисна модель, навіть коли не відтворює реальних умов?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Start with a Stop',
        paragraphs: [
          'Describe the optional gym’s stopping controls and one omitted physical effect. Keep arcade completion separate from a practice-drill result.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Почніть із зупинки',
        paragraphs: [
          'Опишіть зупинку в додатковій залі й один невідтворений фізичний ефект. Відокремте аркадну перемогу від результату практичної вправи.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Start with a Stop',
        paragraphs: [
          'Compare this assisted model with a second fictional model that lists different assumptions. Which observations could transfer, and which require separate validation?',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Почніть із зупинки',
        paragraphs: [
          'Порівняйте цю модель з іншою вигаданою моделлю з іншими припущеннями. Які спостереження переносяться, а які потребують окремої перевірки?',
        ],
      },
    },
  },
  'fpv-first-flight-02': {
    families: {
      en: {
        title: 'Explore together: Height Is a Separate Question',
        paragraphs: [
          'Look together at the shared floor tile and the two heights. Describe two things about position instead of using only one dot.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Висота — окреме питання',
        paragraphs: [
          'Разом подивіться на спільну плитку підлоги й дві висоти. Опишіть дві характеристики положення замість однієї точки.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Height Is a Separate Question',
        paragraphs: [
          'Identify overhead position and height separately. Predict which display changes in the fictional climb-only comparison.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Висота — окреме питання',
        paragraphs: [
          'Окремо визначте положення на вигляді згори й висоту. Яке відображення зміниться у вигаданому порівнянні лише підйому?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Height Is a Separate Question',
        paragraphs: [
          'A new fictional screenshot omits the height gauge. State the conclusion that can no longer be established, even if its overhead marker is clear.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Висота — окреме питання',
        paragraphs: [
          'На новому вигаданому знімку немає показника висоти. Який висновок уже неможливий, навіть коли позначка згори чітка?',
        ],
      },
    },
  },
  'fpv-first-flight-03': {
    families: {
      en: {
        title: 'Explore together: A Straight Path, Two Views',
        paragraphs: [
          'Follow the floor arrow with one finger and point to the nose with another. Tell each other what the two markers describe.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Прямий шлях, два види',
        paragraphs: [
          'Одним пальцем простежте стрілку підлоги, іншим покажіть ніс. Розкажіть одне одному, що описують ці позначки.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Straight Path, Two Views',
        paragraphs: [
          'Keep heading fixed while comparing the two straight segments. Explain how a path can be straight without matching the nose direction.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Прямий шлях, два види',
        paragraphs: [
          'Зберігайте курс незмінним, порівнюючи два прямі відрізки. Чому прямий шлях може не збігатися з напрямком носа?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Straight Path, Two Views',
        paragraphs: [
          'A second fictional route preserves its geometric line but changes heading. Separate the two records and avoid inferring real control commands from either.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Прямий шлях, два види',
        paragraphs: [
          'Інший вигаданий маршрут зберігає пряму лінію, але змінює курс. Розділіть записи, не виводячи з них реальних команд керування.',
        ],
      },
    },
  },
  'fpv-first-flight-04': {
    families: {
      en: {
        title: 'Explore together: Slide Past the Window',
        paragraphs: [
          'Compare the two window pictures together. Find a landmark that stays framed the same way while the model’s sideways position changes.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Рух убік повз вікно',
        paragraphs: [
          'Разом порівняйте два зображення вікна. Знайдіть орієнтир із незмінним кадруванням, коли бокове положення моделі змінюється.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Slide Past the Window',
        paragraphs: [
          'State the fictional viewpoint before describing left. Compare the camera-frame observation with the overhead sketch.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Рух убік повз вікно',
        paragraphs: [
          'Уточніть вигадану точку огляду перед словом «ліворуч». Порівняйте спостереження в кадрі зі схемою згори.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Slide Past the Window',
        paragraphs: [
          'A new fixture moves the viewpoint instead of the model. What extra record would distinguish these explanations for a changed image?',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Рух убік повз вікно',
        paragraphs: [
          'Новий приклад рухає точку огляду замість моделі. Який додатковий запис розрізнить ці пояснення зміненого зображення?',
        ],
      },
    },
  },
  'fpv-first-flight-05': {
    families: {
      en: {
        title: 'Explore together: A Turn and a Translation',
        paragraphs: [
          'Trace the square together, then point to the separate turning mark. Explain travelling somewhere and facing another way as different changes.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Поворот і переміщення',
        paragraphs: [
          'Разом обведіть квадрат, потім покажіть окрему позначку повороту. Поясніть переміщення й зміну напрямку як різні зміни.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Turn and a Translation',
        paragraphs: [
          'Compare the fixed-heading and changing-heading cards. Identify one shared checkpoint without assuming instant real stops at corners.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Поворот і переміщення',
        paragraphs: [
          'Порівняйте картки незмінного й змінного курсу. Знайдіть спільну точку, не припускаючи миттєвих реальних зупинок у кутах.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Turn and a Translation',
        paragraphs: [
          'Another fictional plan reaches the same points with a different heading record. Explain what matching paths prove and what they leave unresolved.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Поворот і переміщення',
        paragraphs: [
          'Інший вигаданий план проходить ті самі точки з іншим записом курсу. Що доводить збіг шляхів, а що лишається невизначеним?',
        ],
      },
    },
  },
  'fpv-first-flight-06': {
    families: {
      en: {
        title: 'Explore together: The Joined Practice Route',
        paragraphs: [
          'Choose a notebook card together and tell what it helped you notice. Pick a question worth revisiting whenever you want.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Спільний навчальний маршрут',
        paragraphs: [
          'Разом оберіть картку зошита й розкажіть, що вона допомогла помітити. Оберіть питання, до якого хочете повернутися згодом.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: The Joined Practice Route',
        paragraphs: [
          'Compare intended and observed results for one fictional segment. Keep the explanation separate from optional-package drill completion.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Спільний навчальний маршрут',
        paragraphs: [
          'Порівняйте задуманий і спостережений результат одного вигаданого відрізка. Відокремте пояснення від завершення вправи додаткового пакета.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: The Joined Practice Route',
        paragraphs: [
          'Write a narrow follow-up question for a new fictional attempt, changing one comparison at a time. No speed target or real-flight qualification follows.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Спільний навчальний маршрут',
        paragraphs: [
          'Запишіть вузьке питання для нової вигаданої спроби, змінюючи одне порівняння за раз. Це не встановлює вимог швидкості чи кваліфікації польоту.',
        ],
      },
    },
  },
  'fpv-drone-families-01': {
    families: {
      en: {
        title: 'Explore together: A View, Not a Shape',
        paragraphs: [
          'Together, point to the viewing equipment and then the aircraft shape. Can these describe different aspects of the same exhibit?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Спосіб бачити, а не форма',
        paragraphs: [
          'Разом покажіть обладнання перегляду, а тоді форму апарата. Чи описують вони різні сторони одного експоната?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A View, Not a Shape',
        paragraphs: [
          'Put the camera-view icon under viewing method and the rotor outline under airframe. Explain why FPV does not name one shape.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Спосіб бачити, а не форма',
        paragraphs: [
          'Помістіть значок виду камери до способу перегляду, а контур роторів — до конструкції. Чому FPV не називає одну форму?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A View, Not a Shape',
        paragraphs: [
          'A new fictional card says only FPV. List which airframe and assistance details remain unknown rather than inferring them from the viewing method.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Спосіб бачити, а не форма',
        paragraphs: [
          'Нова вигадана картка каже лише FPV. Які деталі конструкції й допомоги невідомі, замість виведення їх зі способу перегляду?',
        ],
      },
    },
  },
  'fpv-drone-families-02': {
    families: {
      en: {
        title: 'Explore together: More Than Four Rotors',
        paragraphs: [
          'Count the visible rotor positions together. Compare the family names without turning the count into a best-to-worst ranking.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Не лише чотири ротори',
        paragraphs: [
          'Разом порахуйте видимі місця роторів. Порівняйте назви родин без перетворення кількості на рейтинг від кращого до гіршого.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: More Than Four Rotors',
        paragraphs: [
          'Sort the four-, six- and eight-position silhouettes. Identify a performance claim that cannot be concluded from those counts alone.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Не лише чотири ротори',
        paragraphs: [
          'Розподіліть силуети з чотирма, шістьма й вісьмома позиціями. Який висновок про характеристики не випливає лише з кількості?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: More Than Four Rotors',
        paragraphs: [
          'Compare two fictional designs with different rotor counts but no documented limits. State the civilian question and evidence needed before judging suitability.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Не лише чотири ротори',
        paragraphs: [
          'Порівняйте дві вигадані конструкції з різною кількістю роторів без задокументованих меж. Назвіть цивільне завдання й потрібні дані для оцінки придатності.',
        ],
      },
    },
  },
  'fpv-drone-families-03': {
    families: {
      en: {
        title: 'Explore together: Wings Tell Another Story',
        paragraphs: [
          'Point together to a broad fixed wing and separate rotor discs. Describe the visible structure without guessing how far either craft travels.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Крила розповідають інакше',
        paragraphs: [
          'Разом покажіть широке нерухоме крило й окремі диски роторів. Опишіть конструкцію без здогадів про дальність польоту.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Wings Tell Another Story',
        paragraphs: [
          'Separate the fixed-wing and multicopter drawings by structure. Leave operating conditions blank when the exhibit provides no model-specific evidence.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Крила розповідають інакше',
        paragraphs: [
          'Розрізніть малюнки літака з нерухомим крилом і мультикоптера за конструкцією. Не заповнюйте умови роботи без даних конкретної моделі.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Wings Tell Another Story',
        paragraphs: [
          'A third fictional design combines features. Explain why one visible feature is insufficient to invent its transition behaviour or performance envelope.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Крила розповідають інакше',
        paragraphs: [
          'Третя вигадана конструкція поєднує ознаки. Чому однієї видимої ознаки недостатньо, щоб вигадати її переходи між режимами чи межі характеристик?',
        ],
      },
    },
  },
  'fpv-drone-families-04': {
    families: {
      en: {
        title: 'Explore together: A Sport Has a Setting',
        paragraphs: [
          'Compare two club posters together: one shows an organized setting, the other only speed. What helpful context would you add?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Спорт має свої умови',
        paragraphs: [
          'Разом порівняйте два клубні плакати: один має організовані умови, інший — лише швидкість. Який корисний контекст додати?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Sport Has a Setting',
        paragraphs: [
          'Find the route, viewing area and agreed pause idea in the fictional exhibition. Explain why a sport also needs shared arrangements.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Спорт має свої умови',
        paragraphs: [
          'Знайдіть маршрут, глядацьку зону й узгоджену паузу на вигаданій виставці. Чому спорту також потрібні спільні домовленості?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Sport Has a Setting',
        paragraphs: [
          'Another fictional event advertises an impressive track photograph. Identify which permission and organization claims the photograph does not establish.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Спорт має свої умови',
        paragraphs: [
          'Інша вигадана подія рекламує ефектне фото траси. Які твердження про дозвіл та організацію саме фото не підтверджує?',
        ],
      },
    },
  },
  'fpv-drone-families-05': {
    families: {
      en: {
        title: 'Explore together: Purpose Changes the Questions',
        paragraphs: [
          'Choose a classroom, photography or parcel-study card together. Ask what the person wants to learn before choosing a comparison.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Мета змінює запитання',
        paragraphs: [
          'Разом оберіть картку класу, фотографування чи дослідження доставки. Запитайте, що людина хоче дізнатися, перш ніж порівнювати.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Purpose Changes the Questions',
        paragraphs: [
          'Name one missing fact for each fictional brief: setting, approval or equipment. Explain why one power score would hide these differences.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Мета змінює запитання',
        paragraphs: [
          'Назвіть відсутній факт для кожного вигаданого завдання: умови, дозвіл чи обладнання. Чому один бал потужності приховає ці відмінності?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Purpose Changes the Questions',
        paragraphs: [
          'A different civilian brief changes its purpose but keeps the same aircraft silhouette. Revise the evidence questions without assuming the equipment became suitable.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Мета змінює запитання',
        paragraphs: [
          'Інше цивільне завдання змінює мету, зберігаючи силует апарата. Оновіть питання до доказів, не припускаючи, що обладнання стало придатним.',
        ],
      },
    },
  },
  'fpv-drone-families-06': {
    families: {
      en: {
        title: 'Explore together: Curate the Family Atlas',
        paragraphs: [
          'Fill the atlas together, leaving room for unknowns. Explain why an honest blank can be more useful than a confident guess.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Упорядкуйте атлас родин',
        paragraphs: [
          'Разом заповніть атлас, залишивши місце для невідомого. Чому чесне порожнє поле корисніше за впевнений здогад?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Curate the Family Atlas',
        paragraphs: [
          'Read camera-equipped hexacopter and sort what it tells you about airframe and viewing. Keep assistance and purpose separate.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Упорядкуйте атлас родин',
        paragraphs: [
          'Прочитайте «гексакоптер із камерою» й визначте, що це каже про конструкцію та перегляд. Допомогу керування й мету розглядайте окремо.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Curate the Family Atlas',
        paragraphs: [
          'Apply the four-field atlas to a new fictional description. Cite the words supporting each filled field and mark anything requiring another source.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Упорядкуйте атлас родин',
        paragraphs: [
          'Застосуйте атлас із чотирьох полів до нового вигаданого опису. Назвіть слова на підтвердження кожного поля й позначте потребу в іншому джерелі.',
        ],
      },
    },
  },
  'fpv-drones-ukraine-01': {
    families: {
      en: {
        title: 'Explore together: A Map for Recovery',
        paragraphs: [
          'Look at the invented hall pictures together. Find what is visible and ask who made the record and when.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Карта для відбудови',
        paragraphs: [
          'Разом розгляньте вигадані зображення зали. Назвіть видиме й запитайте, хто та коли зробив запис.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Map for Recovery',
        paragraphs: [
          'Add date, source and observation to the fictional archive card. Separate visible damage from a professional structural-safety judgment.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Карта для відбудови',
        paragraphs: [
          'Додайте дату, джерело й спостереження до вигаданої архівної картки. Відокремте видиме пошкодження від професійного висновку про безпечність конструкції.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Map for Recovery',
        paragraphs: [
          'A second fictional archive omits its date. Explain why the image cannot establish current condition or repair priorities without additional expert evidence.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Карта для відбудови',
        paragraphs: [
          'В іншому вигаданому архіві пропущена дата. Чому зображення без додаткових експертних даних не встановлює поточного стану чи пріоритетів ремонту?',
        ],
      },
    },
  },
  'fpv-drones-ukraine-02': {
    families: {
      en: {
        title: 'Explore together: Survey Is Not Clearance',
        paragraphs: [
          'Follow the document cards together from observation to expert review. Name who should own the next recorded decision.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Обстеження — не очищення',
        paragraphs: [
          'Разом простежте картки документів від спостереження до експертного розгляду. Назвіть відповідального за наступне зафіксоване рішення.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Survey Is Not Clearance',
        paragraphs: [
          'Explain the difference between a survey record and permission to enter land. Keep this exercise entirely within the fictional documents.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Обстеження — не очищення',
        paragraphs: [
          'Поясніть різницю між записом обстеження й дозволом заходити на землю. Залишайте вправу лише в межах вигаданих документів.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Survey Is Not Clearance',
        paragraphs: [
          'A new fictional caption confuses specialist observation with clearance. Rewrite the claim to preserve its evidence boundary and responsible review, without field methods.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Обстеження — не очищення',
        paragraphs: [
          'Новий вигаданий підпис плутає спеціалізоване спостереження з очищенням території. Збережіть межі доказів і відповідальний розгляд без польових методів.',
        ],
      },
    },
  },
  'fpv-drones-ukraine-03': {
    families: {
      en: {
        title: 'Explore together: A Pilot Study Has Limits',
        paragraphs: [
          'Compare tested here with works everywhere together. Which phrase leaves room to ask where the evidence came from?',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Пілотне дослідження має межі',
        paragraphs: [
          'Разом порівняйте «перевірено тут» і «працює скрізь». Який вислів залишає місце для питання про походження доказів?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Pilot Study Has Limits',
        paragraphs: [
          'Find the dataset and test-context questions missing from the broad caption. A research report does not make every setting equivalent.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Пілотне дослідження має межі',
        paragraphs: [
          'Знайдіть питання про набір даних і умови перевірки, відсутні в широкому підписі. Дослідницький звіт не прирівнює всі умови.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Pilot Study Has Limits',
        paragraphs: [
          'Another fictional study reports a promising result on different material. Identify the scope change and missing validation rather than extending its safety conclusion.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Пілотне дослідження має межі',
        paragraphs: [
          'Інше вигадане дослідження має перспективний результат на іншому матеріалі. Визначте зміну меж і відсутню перевірку замість розширення висновку про безпечність.',
        ],
      },
    },
  },
  'fpv-drones-ukraine-04': {
    families: {
      en: {
        title: 'Explore together: Learning Has Many Roles',
        paragraphs: [
          'Take turns choosing host, diagram maker, source checker or learner. Describe how each can help the next person in a fictional library session.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Навчання має багато ролей',
        paragraphs: [
          'По черзі оберіть ведучого, автора схеми, перевіряльника джерел чи учня. Як кожен допомагає наступній людині на вигаданому занятті в бібліотеці?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Learning Has Many Roles',
        paragraphs: [
          'Match each contribution to a useful handoff. Keep the civilian classroom story separate from claims about real community membership or certification.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Навчання має багато ролей',
        paragraphs: [
          'Зіставте внесок із корисною передачею справ. Відокремте цивільну навчальну історію від тверджень про реальне членство чи сертифікацію.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Learning Has Many Roles',
        paragraphs: [
          'A second fictional session uses a community name without a source. Revise the attribution so illustrative roles do not imply endorsement or a real event.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Навчання має багато ролей',
        paragraphs: [
          'Інше вигадане заняття використовує назву спільноти без джерела. Уточніть атрибуцію, щоб ілюстративні ролі не означали підтримки чи реальної події.',
        ],
      },
    },
  },
  'fpv-drones-ukraine-05': {
    families: {
      en: {
        title: 'Explore together: Read the Historical Caption',
        paragraphs: [
          'Find the date and issuer of the historical caption together. Explain why an old announcement and a current fact are different records.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Прочитайте історичний підпис',
        paragraphs: [
          'Разом знайдіть дату й автора історичного підпису. Чому давнє оголошення й поточний факт — різні записи?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Read the Historical Caption',
        paragraphs: [
          'Separate the programme’s stated historical purpose from an unsupported claim about today. Keep this an archive-reading task.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Прочитайте історичний підпис',
        paragraphs: [
          'Відокремте заявлену історичну мету програми від непідтвердженого твердження про сьогодення. Залишайте це вправою читання архіву.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Read the Historical Caption',
        paragraphs: [
          'Compare a dated announcement with an invented present-tense summary. Mark the unsupported time shift; do not infer current equipment, outcomes or operational methods.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Прочитайте історичний підпис',
        paragraphs: [
          'Порівняйте датоване оголошення з вигаданим викладом у теперішньому часі. Позначте недоведений часовий перехід без висновків про обладнання, результати чи методи.',
        ],
      },
    },
  },
  'fpv-drones-ukraine-06': {
    families: {
      en: {
        title: 'Explore together: An Exhibit with Boundaries',
        paragraphs: [
          'Choose an earlier archive card together and read its limits. Recall that suspicious objects should not be approached or touched.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Виставка з чіткими межами',
        paragraphs: [
          'Разом оберіть попередню архівну картку й прочитайте її межі. Пригадайте: до підозрілих предметів не наближаються й не торкаються їх.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: An Exhibit with Boundaries',
        paragraphs: [
          'Replace an overconfident safety caption with the actual evidence and responsible review. Essential safety information stays available before any win.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Виставка з чіткими межами',
        paragraphs: [
          'Замініть надмірно впевнений підпис про безпечність фактичними даними й відповідальним розглядом. Основна інформація безпеки доступна до перемоги.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: An Exhibit with Boundaries',
        paragraphs: [
          'Curate a new fictional exhibit using dates, source ownership and explicit uncertainty. Explain why collecting these cards never authorizes a real visit or inspection.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Виставка з чіткими межами',
        paragraphs: [
          'Упорядкуйте нову вигадану виставку з датами, авторами джерел і явною невизначеністю. Чому збирання карток не дозволяє реального відвідування чи огляду?',
        ],
      },
    },
  },
  'fpv-care-repair-01': {
    families: {
      en: {
        title: 'Explore together: Describe the Symptom',
        paragraphs: [
          'Read the moving-label story together. Take turns saying what happened without guessing why it happened.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Опишіть симптом',
        paragraphs: [
          'Разом прочитайте історію рухомої етикетки. По черзі назвіть те, що сталося, не вгадуючи причини.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Describe the Symptom',
        paragraphs: [
          'Separate the label moved from the adhesive failed. Add the observation time and identifier before asking a follow-up question.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Опишіть симптом',
        paragraphs: [
          'Відокремте «етикетка зрушила» від «клей не втримав». Додайте час спостереження й ідентифікатор перед наступним питанням.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Describe the Symptom',
        paragraphs: [
          'In a second inert display, the stand also moves. Propose the missing observation that would distinguish explanations without powering or opening anything.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Опишіть симптом',
        paragraphs: [
          'В іншому неактивному експонаті рухається також підставка. Яке спостереження розрізнить пояснення без увімкнення чи розкриття пристрою?',
        ],
      },
    },
  },
  'fpv-care-repair-02': {
    families: {
      en: {
        title: 'Explore together: An Unpowered Inspection',
        paragraphs: [
          'Compare the label, bracket and cover pictures together. Explain why looking intact is not the same as knowing everything inside.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Огляд без живлення',
        paragraphs: [
          'Разом порівняйте зображення етикетки, кронштейна й кришки. Чому цілий вигляд не означає знання всього всередині?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: An Unpowered Inspection',
        paragraphs: [
          'Choose record and ask for an unknown condition. Keep visible observations separate from any conclusion about electrical state.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Огляд без живлення',
        paragraphs: [
          'Оберіть «записати й запитати» для невідомого стану. Відокремте видимі спостереження від висновків про електричний стан.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: An Unpowered Inspection',
        paragraphs: [
          'A new fictional inspection lacks a readable part identifier. Explain how that limits manual selection and why a picture cannot replace device-specific guidance.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Огляд без живлення',
        paragraphs: [
          'Новий вигаданий огляд не має читабельного ідентифікатора деталі. Як це обмежує вибір інструкції й чому фото не замінює вказівок конкретного пристрою?',
        ],
      },
    },
  },
  'fpv-care-repair-03': {
    families: {
      en: {
        title: 'Explore together: Change One Question',
        paragraphs: [
          'Compare the same paper label under two drawn lamps. Together, name what stayed the same and what changed.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Змініть одне питання',
        paragraphs: [
          'Порівняйте ту саму паперову етикетку під двома намальованими лампами. Разом назвіть незмінне й змінене.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Change One Question',
        paragraphs: [
          'Contrast the one-change record with the record changing lamp, label and distance. Which supports a narrower readability explanation?',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Змініть одне питання',
        paragraphs: [
          'Порівняйте запис з однією зміною із записом, де змінено лампу, етикетку й відстань. Який краще пояснює читабельність?',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Change One Question',
        paragraphs: [
          'Design another fictional paper-label comparison that changes one factor. State the uncertainty left over; this is not an electrical diagnostic procedure.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Змініть одне питання',
        paragraphs: [
          'Створіть інше вигадане порівняння паперової етикетки зі зміною одного чинника. Назвіть залишкову невизначеність: це не електрична діагностика.',
        ],
      },
    },
  },
  'fpv-care-repair-04': {
    families: {
      en: {
        title: 'Explore together: A Battery Stop Card',
        paragraphs: [
          'Read the flat warning card together. Explain why pausing and asking a qualified person is a useful decision.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Картка зупинки через акумулятор',
        paragraphs: [
          'Разом прочитайте пласку попереджувальну картку. Чому пауза й звернення до фахівця — корисне рішення?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Battery Stop Card',
        paragraphs: [
          'Choose stop and qualified guidance for the fictional battery warning. A successful game result cannot change the item’s condition.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Картка зупинки через акумулятор',
        paragraphs: [
          'Оберіть зупинку й фахові вказівки для вигаданого попередження про акумулятор. Успіх у грі не змінює стану предмета.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Battery Stop Card',
        paragraphs: [
          'A second fictional record omits battery condition. Preserve that uncertainty and the stop boundary; do not invent handling, repair or transport instructions.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Картка зупинки через акумулятор',
        paragraphs: [
          'В іншому вигаданому записі відсутній стан акумулятора. Збережіть невизначеність і межу зупинки, не вигадуючи поводження, ремонту чи перевезення.',
        ],
      },
    },
  },
  'fpv-care-repair-05': {
    families: {
      en: {
        title: 'Explore together: Repair, Replace, Ask',
        paragraphs: [
          'Sort the paper label, unknown board and battery-warning card together. Explain why they need different kinds of next steps.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Ремонтувати, замінити, запитати',
        paragraphs: [
          'Разом розподіліть паперову етикетку, невідому плату й картку попередження про акумулятор. Чому наступні кроки мають бути різними?',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: Repair, Replace, Ask',
        paragraphs: [
          'Match a display-label replacement, an identification request and a stop decision. Avoid turning repair everything into one rule.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Ремонтувати, замінити, запитати',
        paragraphs: [
          'Зіставте заміну етикетки експоната, запит ідентифікації й рішення зупинитися. Не перетворюйте «полагодити все» на єдине правило.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: Repair, Replace, Ask',
        paragraphs: [
          'A new fictional item crosses from a paper display into unknown electronics. Explain which permission boundary changes before proposing any further action.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Ремонтувати, замінити, запитати',
        paragraphs: [
          'Новий вигаданий предмет переходить від паперового експоната до невідомої електроніки. Яка межа дозволених дій змінюється перед наступною пропозицією?',
        ],
      },
    },
  },
  'fpv-care-repair-06': {
    families: {
      en: {
        title: 'Explore together: A Responsible Last Step',
        paragraphs: [
          'Tell another person the item’s identifier, observation and next contact. Together, notice anything the handoff still does not know.',
        ],
      },
      uk: {
        title: 'Дослідіть разом: Відповідальний останній крок',
        paragraphs: [
          'Повідомте іншій людині ідентифікатор предмета, спостереження й наступний контакт. Разом помітьте, що ще невідомо в передачі справ.',
        ],
      },
    },
    beginners: {
      en: {
        title: 'Make the distinction: A Responsible Last Step',
        paragraphs: [
          'Keep the recorded decision separate from an invented disposal destination. Ask the local specialist service when the appropriate destination is unknown.',
        ],
      },
      uk: {
        title: 'Розрізніть поняття: Відповідальний останній крок',
        paragraphs: [
          'Відокремте зафіксоване рішення від вигаданого місця утилізації. Зверніться до місцевої спеціалізованої служби, якщо відповідний шлях невідомий.',
        ],
      },
    },
    hobbyists: {
      en: {
        title: 'Apply and question: A Responsible Last Step',
        paragraphs: [
          'A different fictional location has different collection arrangements. Retain the observation record while identifying which local guidance must be verified again.',
        ],
      },
      uk: {
        title: 'Застосуйте й запитайте: Відповідальний останній крок',
        paragraphs: [
          'В іншому вигаданому місці діють інші правила збирання. Збережіть запис спостереження й визначте, які місцеві вказівки треба перевірити заново.',
        ],
      },
    },
  },
};
