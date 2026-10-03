import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import { CLASSIC_SNAKE_CHAPTERS, CLASSIC_SNAKE_LEVELS } from './classic-catalogue.mjs';
import { createEncounterVariantPreferences } from '../hunt/preferences.mjs';
import { snakeText } from './copy.mjs';

const copy = {
  en: {
    eyebrow: 'Classic Snake · RevealLine characters',
    title: 'Catch. Grow.\nLeave room to turn.',
    intro:
      'A real grid, a visible snake and one humanoid to catch at a time. Keep moving, grow with every catch, and avoid walls and your own body.',
    picker:
      'Choose Solo, matched-board Versus or shared-board Team. Pick a campaign and level, then press Start. Classic Snake has its own records and saved rounds.',
    diagram: 'Leave an exit for the tail that follows you.',
    rules: ['One catch. One more segment.', 'Keep moving. Leave an exit.', 'Choose your effects'],
    ruleBodies: [
      'Your four-segment snake moves automatically, one cell at a time. Arrow keys, WASD or the direction pad steer it.',
      'Catch the humanoid to grow. A wall or body collision ends the round. Later chapters add mazes, fleeing targets and wrapping edges.',
      'Clean catches work by default. Enable Brutal enemy destruction and optional blood in game Settings whenever you want the stronger effects.',
    ],
    campaigns: 'Eight chapters. Forty-eight routes.',
    count: '48 layouts · Solo / Versus / Team',
    missions: 'Explore all six missions',
    chapter: 'Chapter',
    solo: 'Solo',
    versus: 'Versus',
    team: 'Team',
    sim: 'Simulator',
    simTitle: 'Take the hunt into 3D',
    simCount: '24 courses · Self-level / Acro',
    simIntro:
      'Fly close enough to catch humanoids on the ground and raised platforms. After the introduction, catches grow a physical echo trail to avoid. Some courses require numbered catches in order; leave other targets for later. These courses use the simulator’s own flight model.',
    simPlay: 'Open six-course playlist',
    simNote:
      'Prepare a course, then Arm when ready. The simulator has separate progress and flight controls.',
    simLoading: 'Loading the optional flight-course catalogue… Classic Snake is ready above.',
    simUnavailable:
      'The optional simulator catalogue could not load. Classic Snake is ready above. Reconnect and reload this page to see the flight courses.',
    footer:
      'Classic Snake uses contact catches only. Team shares the catch goal; Versus races on matched boards. The earlier territory-capture version remains available as a Capture remix from the play page. Sim remains a separate 3D flight variation.',
    studio: 'Open Studio for capture-remix authoring',
    language: 'Language',
    modeLabel: 'Play mode',
    rulesLabel: 'How to play',
  },
  uk: {
    eyebrow: 'Класична Змійка · персонажі RevealLine',
    title: 'Лови. Рости.\nЗалиш місце для повороту.',
    intro:
      'Справжня сітка, помітна змійка й одна ціль-гуманоїд за раз. Рухайтеся, ростіть після кожного дотику та уникайте стін і власного тіла.',
    picker:
      'Оберіть Соло, Поєдинок на однакових полях або Команду на спільному полі. Виберіть кампанію й рівень та починайте. У класичної Змійки окремі рекорди й збереження.',
    diagram: 'Залишайте вихід хвосту, що рухається за вами.',
    rules: ['Одна ціль — ще один сегмент', 'Рухайтесь і залишайте вихід', 'Обирайте ефекти'],
    ruleBodies: [
      'Змійка з чотирьох сегментів рухається автоматично, клітинка за клітинкою. Керуйте стрілками, WASD або панеллю напрямків.',
      'Ловіть гуманоїда, щоб рости. Стіна чи власне тіло завершують раунд. Далі з’являються лабіринти, втікачі та переходи через край.',
      'За замовчуванням дотики без крові. Для сильніших ефектів увімкніть жорстоке знищення ворогів і кров у налаштуваннях гри.',
    ],
    campaigns: 'Вісім розділів. Сорок вісім маршрутів.',
    count: '48 полів · Соло / Поєдинок / Команда',
    missions: 'Переглянути всі шість місій',
    chapter: 'Розділ',
    solo: 'Соло',
    versus: 'Поєдинок',
    team: 'Команда',
    sim: 'Симулятор',
    simTitle: 'Перенесіть полювання у 3D',
    simCount: '24 траси · Самовирівнювання / Acro',
    simIntro:
      'Ловіть дотиком гуманоїдів на землі й піднятих платформах. Після вступної вправи спіймані цілі подовжують небезпечний слід. На деяких трасах потрібен порядок номерів: залишайте інші цілі на потім. Ці траси використовують власну модель польоту симулятора.',
    simPlay: 'Відкрити серію з шести трас',
    simNote:
      'Підготуйте трасу та ввімкніть мотори, коли будете готові. У симулятора окремий прогрес і керування.',
    simLoading: 'Завантажуємо необов’язковий каталог польотів… Класична Змійка вже доступна вище.',
    simUnavailable:
      'Не вдалося завантажити необов’язковий каталог симулятора. Класична Змійка вже доступна вище. Під’єднайтеся до мережі й оновіть сторінку, щоб побачити траси для польотів.',
    footer:
      'У класичній Змійці цілі ловлять лише дотиком. Команда має спільну мету; Поєдинок — однакові поля. Попередня версія доступна на сторінці гри як ремікс із захопленням території. Симулятор залишається окремим 3D-варіантом.',
    studio: 'Відкрити Студію реміксів із захопленням',
    language: 'Мова',
    modeLabel: 'Режим гри',
    rulesLabel: 'Як грати',
  },
};
const doc = globalThis.document;
const $ = (id) => doc.getElementById(id);
const node = (tag, text, className) => {
  const value = doc.createElement(tag);
  if (text) value.textContent = text;
  if (className) value.className = className;
  return value;
};
const preferences = createEncounterVariantPreferences();
let simCatalogue = null;
let simUnavailable = false;
const launch = (label, href, reset = false) => {
  const link = node('a', label);
  link.href = href;
  if (reset) link.addEventListener('click', () => preferences.set({ variant: 'authored' }));
  return link;
};
function render() {
  const locale = getLocale() === 'uk' ? 'uk' : 'en',
    words = copy[locale];
  doc.documentElement.lang = locale;
  doc.title = `${snakeText('title')} · FPV / LINE`;
  $('language').value = locale;
  $('modes').setAttribute('aria-label', words.modeLabel);
  $('rules').setAttribute('aria-label', words.rulesLabel);
  const fields = {
    eyebrow: 'eyebrow',
    title: 'title',
    intro: 'intro',
    'picker-note': 'picker',
    'diagram-caption': 'diagram',
    'campaign-title': 'campaigns',
    'campaign-count': 'count',
    'sim-title': 'simTitle',
    'sim-count': 'simCount',
    'sim-intro': 'simIntro',
    'footer-note': 'footer',
    'studio-link': 'studio',
    'language-label': 'language',
  };
  for (const [id, key] of Object.entries(fields)) $(id).textContent = words[key];
  $('title').style.whiteSpace = 'pre-line';
  $('diagram-title').textContent = words.diagram;
  $('modes').replaceChildren(
    launch(words.solo, `../?journey=snake-hunt-v1&lang=${locale}`, true),
    launch(words.versus, `../couch/?journey=snake-hunt-v1&lang=${locale}`, true),
    launch(words.team, `../couch/relay-rescue.html?journey=snake-hunt-v1&lang=${locale}`, true),
    launch(words.sim, '#sim-title'),
  );
  $('rules').replaceChildren(
    ...words.rules.map((heading, i) => {
      const item = node('article');
      item.append(node('h3', heading), node('p', words.ruleBodies[i]));
      return item;
    }),
  );
  $('chapters').replaceChildren(
    ...CLASSIC_SNAKE_CHAPTERS.map((chapter, index) => {
      const item = node('article', null, 'chapter');
      item.append(
        node(
          'span',
          `${words.chapter} ${String(index + 1).padStart(2, '0')} / 08`,
          'chapter-number',
        ),
        node('h3', chapter.title[locale]),
        node('p', chapter.description[locale]),
      );
      const details = node('details'),
        list = node('ol');
      details.append(node('summary', words.missions));
      for (const stage of CLASSIC_SNAKE_LEVELS.filter((stage) => stage.chapterId === chapter.id)) {
        const row = node('li');
        row.append(
          launch(stage.title[locale], `./play.html?mode=solo&level=${stage.id}&lang=${locale}`),
          node('p', stage.description[locale]),
        );
        list.append(row);
      }
      details.append(list);
      item.append(details);
      return item;
    }),
  );
  renderSim();
}
function renderSim() {
  const locale = getLocale() === 'uk' ? 'uk' : 'en',
    words = copy[locale];
  if (!simCatalogue) {
    const status = node('p', words[simUnavailable ? 'simUnavailable' : 'simLoading']);
    status.setAttribute('role', 'status');
    $('sim-chapters').replaceChildren(status);
    return;
  }
  $('sim-chapters').replaceChildren(
    ...simCatalogue.SNAKE_HUNT_PLAYLISTS.map((playlist, index) => {
      const item = node('article', null, 'chapter');
      item.append(
        node(
          'span',
          `${words.chapter} ${String(index + 1).padStart(2, '0')} / 04`,
          'chapter-number',
        ),
        node('h3', playlist.title[locale]),
        node('p', words.simNote),
      );
      const chapter = playlist.id.replace('snake-hunt-', '');
      item.append(
        launch(
          words.simPlay,
          `../../optional-practice/fpv-worlds/index.html?snake-hunt=${chapter}&lang=${locale}`,
        ),
      );
      const details = node('details'),
        list = node('ol');
      details.append(node('summary', words.missions));
      for (const entry of playlist.entries) {
        const course = simCatalogue.SNAKE_HUNT_COURSES.find(
          (course) => course.id === entry.levelId,
        );
        const row = node('li');
        row.append(
          launch(
            course?.locales?.[locale]?.title ?? entry.levelId,
            `../../optional-practice/fpv-worlds/index.html?snake-course=${entry.levelId}&lang=${locale}`,
          ),
        );
        list.append(row);
      }
      details.append(list);
      item.append(details);
      return item;
    }),
  );
}
$('language').addEventListener('change', () => setLocale($('language').value));
onLocaleChange(render);
render();
// Optional flight courses are excluded from the core offline cache. Their
// availability must never hold up the classic chapters or mode links.
void import('../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs')
  .then((catalogue) => {
    simCatalogue = catalogue;
    renderSim();
  })
  .catch(() => {
    simUnavailable = true;
    renderSim();
  });
