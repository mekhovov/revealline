import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { sharedEnemyArtwork } from './preferences.mjs';
import { ACTOR_FAMILIES } from './actor-catalog.mjs';
import { nativeArtReviewURL } from '../ui/art-review-navigation.mjs';
import { clearExplicitReviewPin } from '../ui/enemy-appearance-controls.mjs';
import {
  militaryCoreLevels,
  loadMilitaryFlightLevels,
  filterMilitaryLevels,
  militaryLevelURL,
} from './military-level-catalogue.mjs';

const COPY = {
  en: {
    title: 'Find soldiers and vehicles',
    back: 'Living Routes',
    language: 'Language',
    intro:
      'In game Settings, choose Enemy appearance preset → Military Field. Then start or restart a level. You can also apply that same preset here before opening a level.',
    apply: 'Apply Military Field',
    applied: 'Military Field selected. Open a level below and press Start.',
    saving:
      'The choice could not be saved for another page. Choose Military Field in the destination’s Settings.',
    failure: 'The appearance could not be prepared. Try Apply Military Field again.',
    population:
      'Running enemies is a separate setting: turn it On to add optional humanoids to an ordinary Capture level. Hunt missions already have targets. Snake has humanoid prey, not cars or tanks. Blood and remains only change effects.',
    ownership:
      'Custom creator artwork keeps its ownership. Vehicle looks preserve each enemy’s existing behavior. Choose uniforms under Character appearance; the military cast is called Field kit.',
    search: 'Find a level',
    placeholder: 'Name, chapter or level ID',
    mode: 'Mode',
    vehicles: 'Vehicles',
    all: 'All modes',
    solo: 'Solo',
    versus: 'Versus',
    team: 'Team',
    sim: 'FPV SIM',
    any: 'Any',
    yes: 'With vehicles',
    no: 'Without vehicles',
    featured: 'Start here',
    count: (visible, total) => `${visible} of ${total} matching entries`,
    empty: 'No matching levels. Clear the search or change a filter.',
    targets: 'Targets',
    optional: 'Optional runners: enable Running enemies, then Start or Restart.',
    vehicleArt: 'Vehicle artwork',
    noVehicles: 'No vehicle actors.',
    collection: 'Opens the collection. In Missions, select this exact level name, then Start.',
    exact: 'Opens this level’s briefing. Press Start.',
    flight:
      'Opens this flight course. Choose Self-level or Acro, then use the native Arm/Start controls.',
    parked:
      'The native pursuit vehicle is parked, unarmed and outside the required contact-hunt quota.',
    prototype: 'Preview campaign; full human/device qualification remains open.',
    loading: 'Loading optional flight courses…',
    unavailable:
      'Flight catalogue unavailable here. Use the simulator installation link below; Capture and Snake remain available.',
    more: 'Show more',
    scope:
      'Current default Capture campaigns, Hunt lessons, Pursuit chapters, all 96 Classic Snake layouts and available native Hunt courses. Historical revisions, installed community editions and Capture Snake remixes are not duplicated here.',
    flightHelp: 'FPV SIM installation and playlists',
  },
  uk: {
    title: 'Де знайти солдатів і техніку',
    back: 'Живі маршрути',
    language: 'Мова',
    intro:
      'У налаштуваннях гри оберіть «Набір оформлення ворогів → Військове поле». Потім почніть або перезапустіть рівень. Цей самий набір можна застосувати тут перед відкриттям рівня.',
    apply: 'Застосувати «Військове поле»',
    applied: '«Військове поле» вибрано. Відкрийте рівень нижче та натисніть «Почати».',
    saving:
      'Не вдалося зберегти вибір для іншої сторінки. Оберіть «Військове поле» в налаштуваннях відкритої гри.',
    failure: 'Не вдалося підготувати оформлення. Повторіть застосування «Військового поля».',
    population:
      '«Рухливі вороги» — окремий параметр: увімкніть його, щоб додати необов’язкових гуманоїдів у звичайний рівень Capture. Місії полювання вже мають цілі. У Snake є гуманоїди, а не машини чи танки. Кров і рештки змінюють лише ефекти.',
    ownership:
      'Власні зображення авторів зберігаються. Техніка дотримується початкової поведінки ворогів. Форму обирають у розділі «Вигляд персонажів»; військовий набір називається «Польове спорядження».',
    search: 'Знайти рівень',
    placeholder: 'Назва, розділ або ID рівня',
    mode: 'Режим',
    vehicles: 'Техніка',
    all: 'Усі режими',
    solo: 'Соло',
    versus: 'Поєдинок',
    team: 'Команда',
    sim: 'FPV SIM',
    any: 'Будь-яка',
    yes: 'З технікою',
    no: 'Без техніки',
    featured: 'Почніть тут',
    count: (visible, total) => `Показано ${visible} із ${total} відповідних записів`,
    empty: 'Відповідних рівнів немає. Очистьте пошук або змініть фільтр.',
    targets: 'Цілі',
    optional:
      'Необов’язкові бігуни: увімкніть «Рухливі вороги», потім почніть або перезапустіть рівень.',
    vehicleArt: 'Вигляд техніки',
    noVehicles: 'Рухомої техніки немає.',
    collection:
      'Відкривається добірка. У місіях оберіть рівень із цією назвою та натисніть «Почати».',
    exact: 'Відкривається інструктаж цього рівня. Натисніть «Почати».',
    flight:
      'Відкривається ця траса. Оберіть самовирівнювання або Acro, потім увімкніть мотори штатним керуванням.',
    parked:
      'Техніка на трасі наземного переслідування стоїть, не озброєна й не входить до обов’язкової квоти дотиків.',
    prototype: 'Попередня кампанія; повна перевірка людьми й на пристроях ще триває.',
    loading: 'Завантажуємо необов’язкові льотні траси…',
    unavailable:
      'Льотний каталог тут недоступний. Скористайтеся посиланням установлення симулятора нижче; Capture і Snake доступні.',
    more: 'Показати ще',
    scope:
      'Поточні основні кампанії Capture, уроки полювання, розділи переслідування, усі 96 полів класичної Snake та доступні льотні траси полювання. Історичні версії, встановлені видання спільноти й ремікси Capture Snake тут не дублюються.',
    flightHelp: 'Установлення FPV SIM і серії польотів',
  },
};
const VEHICLES = {
  'utility-car': ['Field utility car', 'Польовий позашляховик'],
  'cargo-truck': ['Cargo truck', 'Вантажівка'],
  'armored-carrier': ['Armored carrier', 'Бронетранспортер'],
  'scout-car': ['Scout car', 'Розвідувальна машина'],
  'tracked-tank': ['Tracked tank', 'Гусеничний танк'],
  'radar-truck': ['Radar truck', 'Радіолокаційна машина'],
};

export function mountMilitaryLevelDirectory({
  document: doc,
  href,
  location = doc.defaultView?.location ?? { href },
  history = doc.defaultView?.history,
  rows = militaryCoreLevels(),
  loadFlights = loadMilitaryFlightLevels,
  locale = () => 'en',
  applyMilitary,
  artwork,
}) {
  const $ = (id) => doc.getElementById(id);
  const listeners = [],
    staticLinks = [...doc.querySelectorAll('a[data-native-review-link]')].map((link) => [
      link,
      link.getAttribute('href'),
    ]);
  let entries = [...rows],
    limit = 36,
    disposed = false,
    flights = 'loading',
    applyStatus = '';
  const language = () => (locale() === 'uk' ? 'uk' : 'en');
  const node = (tag, text, className) => {
    const value = doc.createElement(tag);
    if (text) value.textContent = text;
    if (className) value.className = className;
    return value;
  };
  const listen = (element, event, callback) => {
    element.addEventListener(event, callback);
    listeners.push(() => element.removeEventListener(event, callback));
  };
  function render() {
    if (disposed) return;
    href = location.href;
    const lang = language(),
      words = COPY[lang];
    for (const [id, key] of Object.entries({
      title: 'title',
      back: 'back',
      'language-label': 'language',
      intro: 'intro',
      apply: 'apply',
      'population-help': 'population',
      'ownership-help': 'ownership',
      'search-label': 'search',
      'mode-label': 'mode',
      'vehicles-label': 'vehicles',
      'featured-label': 'featured',
      more: 'more',
      scope: 'scope',
      'flight-help': 'flightHelp',
    }))
      $(id).textContent = words[key];
    $('search').placeholder = words.placeholder;
    for (const option of $('mode').options) option.textContent = words[option.value];
    for (const option of $('vehicles').options)
      option.textContent = words[option.value === 'all' ? 'any' : option.value];
    $('apply-status').textContent = applyStatus ? words[applyStatus] : '';
    $('flight-status').textContent = flights === 'ready' ? '' : words[flights];
    const matches = filterMilitaryLevels(entries, {
      query: $('search').value,
      mode: $('mode').value,
      vehicles: $('vehicles').value,
      featured: $('featured').checked,
      locale: lang,
    });
    $('results-count').textContent = words.count(Math.min(limit, matches.length), matches.length);
    $('levels').replaceChildren(
      ...matches.slice(0, limit).map((row) => {
        const card = node('article');
        card.dataset.levelId = row.id;
        card.append(node('h2', row.title[lang] ?? row.title.en));
        card.append(
          node(
            'p',
            `${row.engine === 'sim' ? 'FPV SIM' : row.engine === 'snake' ? 'Snake' : 'Capture'} · ${row.chapter}`,
          ),
        );
        card.append(
          node(
            'p',
            row.families.length
              ? `${words.targets}: ${row.families.map((id) => ACTOR_FAMILIES.find((family) => family.id === id)?.name[lang] ?? id).join(' · ')}`
              : words.optional,
          ),
        );
        card.append(
          node(
            'p',
            row.vehicles.length
              ? `${words.vehicleArt}: ${row.vehicles.map((id) => VEHICLES[id]?.[lang === 'uk' ? 1 : 0] ?? id).join(' · ')}`
              : words.noVehicles,
          ),
        );
        card.append(
          node(
            'p',
            row.engine === 'sim' ? words.flight : row.exact ? words.exact : words.collection,
          ),
        );
        if (row.engine === 'sim' && row.id.startsWith('native-pursuit-') && row.vehicles.length)
          card.append(node('p', words.parked));
        if (row.prototype) card.append(node('p', words.prototype));
        const links = node('nav', '', 'links');
        links.setAttribute('aria-label', row.title[lang] ?? row.title.en);
        for (const mode of row.modes) {
          const link = node('a', words[mode]);
          link.href = militaryLevelURL(row, mode, href, lang);
          links.append(link);
        }
        card.append(links);
        return card;
      }),
    );
    if (!matches.length) $('levels').append(node('p', words.empty));
    $('more').hidden = matches.length <= limit;
    for (const [link, target] of staticLinks) {
      const url = new URL(target, href);
      url.searchParams.set('lang', lang);
      link.href = nativeArtReviewURL(url.href, href);
    }
  }
  const reset = () => {
    limit = 36;
    render();
  };
  listen($('search'), 'input', () => {
    if ($('search').value.trim()) $('featured').checked = false;
    reset();
  });
  for (const id of ['mode', 'vehicles', 'featured']) listen($(id), 'change', reset);
  listen($('filters'), 'submit', (event) => event.preventDefault());
  listen($('more'), 'click', () => {
    limit += 36;
    render();
  });
  listen($('apply'), 'click', async () => {
    if ($('apply').disabled) return;
    $('apply').disabled = true;
    try {
      clearExplicitReviewPin(location, history);
      artwork.set({ style: 'military' });
      await applyMilitary();
      applyStatus = artwork.snapshot().durable === false ? 'saving' : 'applied';
    } catch {
      applyStatus = 'failure';
    }
    if (!disposed) {
      $('apply').disabled = false;
      render();
    }
  });
  render();
  const ready = Promise.resolve()
    .then(loadFlights)
    .then(
      (flightRows) => {
        if (disposed) return;
        entries.push(...flightRows);
        flights = 'ready';
        render();
      },
      () => {
        if (disposed) return;
        flights = 'unavailable';
        render();
      },
    );
  return {
    ready,
    refresh: render,
    dispose() {
      disposed = true;
      for (const remove of listeners) remove();
    },
  };
}

if (globalThis.document?.getElementById('military-directory')) {
  const linked = new URL(location.href).searchParams.get('lang');
  if (['en', 'uk'].includes(linked)) setLocale(linked, { persist: false });
  const theme = installThemeHost(),
    artwork = sharedEnemyArtwork();
  const directory = mountMilitaryLevelDirectory({
    document,
    href: location.href,
    locale: getLocale,
    artwork,
    applyMilitary: () => theme.applyComplete('military-field'),
  });
  document.getElementById('language').value = getLocale();
  document
    .getElementById('language')
    .addEventListener('change', (event) => void setLocale(event.target.value));
  const unsubscribe = onLocaleChange(() => {
    document.documentElement.lang = getLocale();
    directory.refresh();
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    directory.dispose();
    unsubscribe();
  });
}
