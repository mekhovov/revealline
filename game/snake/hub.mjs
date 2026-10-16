import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import {
  CLASSIC_SNAKE_CAMPAIGNS,
  CLASSIC_SNAKE_CHAPTERS,
  CLASSIC_SNAKE_LEVELS,
} from './classic-catalogue.mjs';
import { mountOptionalPracticePanel } from '../ui/optional-practice-panel.mjs';
import { fpvWorldLaunchURL, appearanceLaunchURL, nativeArtReviewURL } from '../fpv-entry.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { classicAppearanceContext } from './classic-presentation.mjs';
for (const link of document.querySelectorAll('a[data-native-review-link]'))
  link.href = nativeArtReviewURL(link.getAttribute('href'), globalThis.location.href);
const linkedLocale = new URL(location.href).searchParams.get('lang');
if (['en', 'uk'].includes(linkedLocale)) setLocale(linkedLocale, { persist: false });

const copy = {
  en: {
    eyebrow: 'FPV Cable Snake · RevealLine',
    title: 'Catch. Grow.\nLeave room to turn.',
    intro:
      'Pilot a Ukrainian quadcopter on a clear grid. Catch moving humanoids, grow a dangerous cable, and leave yourself an exit. Two turn buttons are enough to play.',
    picker:
      'Choose Solo, matched-board Versus or shared-board Team. Pick a campaign and level, then press Start. Classic Snake has its own records and saved rounds.',
    diagram: 'The drone leads. Every occupied cable cell is a hazard.',
    rules: ['One catch. One more segment.', 'Keep moving. Leave an exit.', 'Choose your effects'],
    ruleBodies: [
      'Your drone moves automatically, one cell at a time. Two large touch buttons turn left or right. WASD, arrow keys, a controller or the optional direction pad choose your heading.',
      'Catch humanoids to grow your cable. Patrols follow readable routes; runners flee nearby drones; sprinters warn before a short dash. Later routes add yielding shutters, Stop Pulse and Cable Reel pickups.',
      'Clean catches work by default. Enable Brutal enemy destruction and optional blood in game Settings whenever you want the stronger effects.',
    ],
    campaigns: 'Five campaigns. Sixteen chapters.',
    count: '96 missions · Solo / Versus / Team',
    missions: 'Explore all six missions',
    chapter: 'Chapter',
    solo: 'Solo',
    versus: 'Versus',
    team: 'Team',
    sim: 'Simulator',
    simTitle: 'Take the hunt into 3D',
    simCount: '48 courses · 8 playlists · Self-level / Acro',
    simIntro:
      'Fly close enough to catch humanoids on ground routes and raised platforms. Eight playlists include twenty-four moving-patrol courses. After the introduction, catches grow an echo trail to avoid; some courses require numbered catches in order. This is a separate 3D variation using the simulator’s flight model.',
    simPlay: 'Open six-course playlist',
    simNote:
      'Prepare a course, then Arm when ready. The simulator has separate progress and flight controls. If it is not bundled here, the verified launcher helps you install or open it; select the named course there.',
    simLoading: 'Loading the optional flight-course catalogue… Classic Snake is ready above.',
    simUnavailable:
      'The optional simulator catalogue could not load. Classic Snake is ready above. Reconnect and reload this page to see the flight courses.',
    footer:
      'Classic Snake uses contact catches only. Team shares the catch goal; Versus races on matched boards. The earlier territory-capture version remains available as a Capture remix from the play page. Sim remains a separate 3D flight variation.',
    studio: 'Open Snake Studio · create and share your routes',
    language: 'Language',
    recommended: 'Start here · Pure Pursuit',
    startCampaign: 'Start campaign',
    campaignNote:
      'Pure Pursuit teaches interception first. Classic preserves all 48 original missions. Tactical Routes and Arcade Sorties build on the same two controls.',
    modeLabel: 'Play mode',
    rulesLabel: 'How to play',
  },
  uk: {
    eyebrow: 'FPV Змійка з кабелем · RevealLine',
    title: 'Лови. Рости.\nЗалиш місце для повороту.',
    intro:
      'Керуйте українським квадрокоптером на зрозумілій сітці. Ловіть рухомих гуманоїдів, подовжуйте небезпечний кабель і залишайте вихід. Для гри достатньо двох кнопок повороту.',
    picker:
      'Оберіть Соло, Поєдинок на однакових полях або Команду на спільному полі. Виберіть кампанію й рівень та починайте. У класичної Змійки окремі рекорди й збереження.',
    diagram: 'Дрон веде. Кожна зайнята кабелем клітинка небезпечна.',
    rules: ['Одна ціль — ще один сегмент', 'Рухайтесь і залишайте вихід', 'Обирайте ефекти'],
    ruleBodies: [
      'Дрон рухається автоматично, клітинка за клітинкою. Дві великі екранні кнопки повертають ліворуч і праворуч. WASD, стрілки, контролер або панель напрямків задають напрямок руху.',
      'Ловіть гуманоїдів, щоб подовжувати кабель. Патрулі йдуть помітними маршрутами, бігуни тікають від близького дрона, спринтери попереджають про ривок. Далі з’являються заслінки, імпульс зупинки й котушка кабелю.',
      'За замовчуванням дотики без крові. Для сильніших ефектів увімкніть жорстоке знищення ворогів і кров у налаштуваннях гри.',
    ],
    campaigns: 'П’ять кампаній. Шістнадцять розділів.',
    count: '96 місій · Соло / Поєдинок / Команда',
    missions: 'Переглянути всі шість місій',
    chapter: 'Розділ',
    solo: 'Соло',
    versus: 'Поєдинок',
    team: 'Команда',
    sim: 'Симулятор',
    simTitle: 'Перенесіть полювання у 3D',
    simCount: '48 трас · 8 серій · Самовирівнювання / Acro',
    simIntro:
      'Ловіть дотиком гуманоїдів на наземних маршрутах і піднятих платформах. Вісім серій містять двадцять чотири траси з рухомими патрулями. Після вступу цілі подовжують небезпечний слід; іноді потрібен порядок номерів. Це окремий 3D-варіант із моделлю польоту симулятора.',
    simPlay: 'Відкрити серію з шести трас',
    simNote:
      'Підготуйте трасу та ввімкніть мотори. У симулятора окремий прогрес і керування. Якщо його немає в цій збірці, перевірений запуск допоможе встановити чи відкрити його; там оберіть названу трасу.',
    simLoading: 'Завантажуємо необов’язковий каталог польотів… Класична Змійка вже доступна вище.',
    simUnavailable:
      'Не вдалося завантажити необов’язковий каталог симулятора. Класична Змійка вже доступна вище. Під’єднайтеся до мережі й оновіть сторінку, щоб побачити траси для польотів.',
    footer:
      'У класичній Змійці цілі ловлять лише дотиком. Команда має спільну мету; Поєдинок — однакові поля. Попередня версія доступна на сторінці гри як ремікс із захопленням території. Симулятор залишається окремим 3D-варіантом.',
    studio: 'Відкрити Snake Studio · створюйте та поширюйте маршрути',
    language: 'Мова',
    recommended: 'Почніть тут · Чисте переслідування',
    startCampaign: 'Почати кампанію',
    campaignNote:
      'Чисте переслідування навчає перехоплення. Класика зберігає всі 48 початкових місій. Тактичні маршрути й Аркадні вильоти розвивають ті самі два повороти.',
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
const theme = installThemeHost({ document: doc, ...classicAppearanceContext(globalThis.window) });
void theme.refresh();
let simPanel = null;
let simRequest = 0;
let simCatalogue = null;
let simUnavailable = false;
const launch = (label, href) => {
  const link = node('a', label);
  link.href = nativeArtReviewURL(href, globalThis.location.href);
  if (new URL(link.href).pathname.endsWith('/snake/play.html')) {
    link.href = appearanceLaunchURL(link.href, appearancePin(), { transfer: false });
    link.addEventListener('click', () => {
      link.href = appearanceLaunchURL(link.href, appearancePin());
    });
  }
  return link;
};
function appearancePin() {
  const snapshot = theme.snapshot();
  return snapshot
    ? {
        familyId: snapshot.familyId,
        revision: snapshot.familyRevision,
        appearanceThemes: classicAppearanceContext(globalThis.window).appearanceThemes,
      }
    : null;
}
function campaignURL(id, mode, locale) {
  const campaign = CLASSIC_SNAKE_CAMPAIGNS.find((row) => row.id === id);
  const first = CLASSIC_SNAKE_LEVELS.find((row) => campaign.chapterIds.includes(row.chapterId));
  return `./play.html?mode=${mode}&level=${first.id}&activity=campaign&targets=authored&lang=${locale}`;
}
function simLaunch(label, key, value) {
  const button = node('button', label);
  button.type = 'button';
  button.className = 'sim-launch';
  button.addEventListener('click', () => {
    simPanel?.dispose();
    const base = fpvWorldLaunchURL(globalThis.location.href, getLocale());
    if (!base) return;
    const url = new URL(base);
    url.searchParams.set(key, value);
    url.hash = '';
    const idPrefix = `snake-sim-${++simRequest}`;
    simPanel = mountOptionalPracticePanel({
      document: doc,
      container: $('sim-chapters'),
      opener: button,
      pause: () => {},
      href: globalThis.location.href,
      bundledHref: url.href,
      packageId: 'fpv-worlds',
      getAppearanceDefault: appearancePin,
      preferDirect: true,
      timeoutMs: 4000,
      idPrefix,
    });
    // Local source preview is clearly labelled by the shared launcher. It keeps
    // the selected course without certifying a published package's contents.
    for (const link of doc
      .getElementById(`${idPrefix}-dialog`)
      ?.querySelectorAll('[data-practice-source-preview="fpv-worlds"]') ?? []) {
      const target = new URL(link.href);
      target.searchParams.set(key, value);
      target.searchParams.set('lang', getLocale());
      link.href = nativeArtReviewURL(target.href, globalThis.location.href);
    }
    simPanel.open?.();
  });
  return button;
}
function render() {
  simPanel?.dispose();
  simPanel = null;
  const locale = getLocale() === 'uk' ? 'uk' : 'en',
    words = copy[locale];
  doc.documentElement.lang = locale;
  doc.title = `${locale === 'uk' ? 'FPV Змійка з кабелем' : 'FPV Cable Snake'} · FPV / LINE`;
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
    'campaign-note': 'campaignNote',
  };
  for (const [id, key] of Object.entries(fields)) $(id).textContent = words[key];
  $('title').style.whiteSpace = 'pre-line';
  $('diagram-title').textContent = words.diagram;
  $('modes').replaceChildren(
    ...['solo', 'versus', 'team'].map((mode) =>
      launch(words[mode], campaignURL('classic-pure-pursuit-v1', mode, locale)),
    ),
    launch(words.sim, '#sim-title'),
  );
  $('rules').replaceChildren(
    ...words.rules.map((heading, i) => {
      const item = node('article');
      item.append(node('h3', heading), node('p', words.ruleBodies[i]));
      return item;
    }),
  );
  $('campaigns').replaceChildren(
    ...[...CLASSIC_SNAKE_CAMPAIGNS]
      .sort(
        (a, b) =>
          Number(b.id === 'classic-pure-pursuit-v1') - Number(a.id === 'classic-pure-pursuit-v1'),
      )
      .map((campaign) => {
        const card = node('article', null, 'chapter');
        if (campaign.id === 'classic-pure-pursuit-v1')
          card.append(node('p', words.recommended, 'chapter-number'));
        card.append(node('h3', campaign.title[locale]), node('p', campaign.description[locale]));
        const actions = node('nav', null, 'actions');
        actions.setAttribute('aria-label', `${words.startCampaign}: ${campaign.title[locale]}`);
        for (const mode of ['solo', 'versus', 'team'])
          actions.append(launch(words[mode], campaignURL(campaign.id, mode, locale)));
        card.append(actions);
        return card;
      }),
  );
  $('chapters').replaceChildren(
    ...CLASSIC_SNAKE_CHAPTERS.map((chapter, index) => {
      const item = node('article', null, 'chapter');
      item.append(
        node(
          'span',
          `${words.chapter} ${String(index + 1).padStart(2, '0')} / ${CLASSIC_SNAKE_CHAPTERS.length}`,
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
          launch(
            stage.title[locale],
            `./play.html?mode=solo&activity=campaign&targets=authored&level=${stage.id}&lang=${locale}`,
          ),
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
          `${words.chapter} ${String(index + 1).padStart(2, '0')} / ${simCatalogue.SNAKE_HUNT_PLAYLISTS.length}`,
          'chapter-number',
        ),
        node('h3', playlist.title[locale]),
        node('p', words.simNote),
      );
      const chapter = playlist.id.replace('snake-hunt-', '');
      item.append(simLaunch(words.simPlay, 'snake-hunt', chapter));
      const details = node('details'),
        list = node('ol');
      details.append(node('summary', words.missions));
      for (const entry of playlist.entries) {
        const course = simCatalogue.SNAKE_HUNT_COURSES.find(
          (course) => course.id === entry.levelId,
        );
        const row = node('li');
        row.append(
          simLaunch(
            course?.locales?.[locale]?.title ?? entry.levelId,
            'snake-course',
            entry.levelId,
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
$('language').addEventListener('change', () => {
  const url = new URL(globalThis.location.href);
  url.searchParams.set('lang', $('language').value);
  globalThis.history.replaceState(null, '', url);
  setLocale($('language').value);
});
onLocaleChange(render);
render();
// Loading the flight catalogue must never hold up Classic chapters or links.
// The actual simulator entry is checked only after an explicit launch action.
void import('../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs')
  .then((catalogue) => {
    simCatalogue = catalogue;
    renderSim();
  })
  .catch(() => {
    simUnavailable = true;
    renderSim();
  });

globalThis.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    simPanel?.dispose();
    theme.dispose();
  }
});
