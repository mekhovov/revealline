import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import {
  SNAKE_HUNT_CHAPTERS,
  SNAKE_HUNT_STAGES,
} from '../content-design/snake-hunt-candidates.mjs';
import {
  SNAKE_HUNT_PLAYLISTS,
  SNAKE_HUNT_COURSES,
} from '../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';
import { createEncounterVariantPreferences } from '../hunt/preferences.mjs';
import { snakeText } from './copy.mjs';

const copy = {
  en: {
    eyebrow: 'A new way to hunt',
    title: 'Catch. Grow.\nLeave room to turn.',
    intro:
      'A growing tail turns every catch into a route-planning decision. Hunt familiar humanoids through open circuits, wide mazes and guard patrols.',
    picker:
      'Choose a mode, then pick any chapter or mission in its Journey library. Your existing Journey progress stays separate.',
    diagram: 'Leave an exit for the tail that follows you.',
    rules: ['Every catch changes your route', 'The whole board is a puzzle', 'Choose your effects'],
    ruleBodies: [
      snakeText('hint', {}, 'en'),
      snakeText('goal', {}, 'en'),
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
    footer:
      'Clear every target to finish. Chain and ordered-catch bonuses are optional in 2D. Shared Team targets count once; Versus uses matched boards. Blood and reduced effects never change the objective.',
    studio: 'Open Studio to create your own variants',
    language: 'Language',
    modeLabel: 'Play mode',
    rulesLabel: 'How to play',
  },
  uk: {
    eyebrow: 'Новий спосіб полювання',
    title: 'Лови. Рости.\nЗалиш місце для повороту.',
    intro:
      'Зростаючий хвіст перетворює кожну спійману ціль на рішення про маршрут. Полюйте на знайомих гуманоїдів на відкритих колах, у просторих лабіринтах і серед патрулів.',
    picker:
      'Оберіть режим, потім розділ або місію в його бібліотеці Подорожі. Прогрес попередніх Подорожей зберігається окремо.',
    diagram: 'Залишайте вихід хвосту, що рухається за вами.',
    rules: ['Кожна ціль змінює маршрут', 'Усе поле — головоломка', 'Обирайте ефекти'],
    ruleBodies: [
      snakeText('hint', {}, 'uk'),
      snakeText('goal', {}, 'uk'),
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
    footer:
      'Приберіть усі цілі для завершення. У 2D серії та порядок дотиків дають необов’язкові бонуси. Команда рахує кожну ціль лише раз; Поєдинок має однакові поля. Кров і зменшені ефекти не змінюють мету.',
    studio: 'Відкрити Студію та створити власні варіанти',
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
    ...SNAKE_HUNT_CHAPTERS.map((chapter, index) => {
      const item = node('article', null, 'chapter');
      item.append(
        node(
          'span',
          `${words.chapter} ${String(index + 1).padStart(2, '0')} / 08`,
          'chapter-number',
        ),
        node('h3', chapter.localizedName[locale]),
        node('p', chapter.localizedDescription[locale]),
      );
      const details = node('details'),
        list = node('ol');
      details.append(node('summary', words.missions));
      for (const stage of SNAKE_HUNT_STAGES.filter(
        (stage) => stage.campaignId === chapter.campaignId,
      )) {
        const row = node('li');
        row.append(
          node('strong', stage.localizedName[locale]),
          node('p', stage.localizedDescription[locale]),
        );
        list.append(row);
      }
      details.append(list);
      item.append(details);
      return item;
    }),
  );
  $('sim-chapters').replaceChildren(
    ...SNAKE_HUNT_PLAYLISTS.map((playlist, index) => {
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
        const course = SNAKE_HUNT_COURSES.find((course) => course.id === entry.levelId);
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
