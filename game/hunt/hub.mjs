import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import { ACTOR_FAMILIES } from './actor-catalog.mjs';
import { drawHuntActor } from './actor-art.mjs';
import {
  sharedActorAppearance,
  sharedEnemyArtwork,
  runtimeActorArtRevision,
} from './preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { mountRunningEnemyControls } from '../ui/running-enemy-controls.mjs';
import { attachDestructionControls } from '../ui/destruction-controls.mjs';
import { renderEnemyFieldGuide } from '../ui/enemy-field-guide.mjs';
import { militaryFieldPixels } from '../presentation/military-field-art.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { nativeArtReviewURL } from '../ui/art-review-navigation.mjs';
import { clearExplicitReviewPin } from '../ui/enemy-appearance-controls.mjs';
const staticNativeLinks = [...document.querySelectorAll('a[data-native-review-link]')].map(
    (link) => [link, link.getAttribute('href')],
  ),
  nativeTargets = new Map();
function setNativeLink(link, target) {
  nativeTargets.set(link, target);
  link.href = nativeArtReviewURL(target, location.href);
}
const linkedLocale = new URL(location.href).searchParams.get('lang');
if (['en', 'uk'].includes(linkedLocale)) setLocale(linkedLocale, { persist: false });
const $ = (id) => document.getElementById(id),
  appearance = sharedActorAppearance(),
  enemyArtwork = sharedEnemyArtwork(),
  display = createDisplayPreferences(),
  theme = installThemeHost({ displayPreferences: display });
const words = {
  en: {
    eyebrow: 'Living Routes · pursuit expansion',
    title: 'Read the tell. Take the shortcut.',
    intro:
      'New opponents make familiar ground a different chase. Learn their intentions, cut off an escape, and leave your partner a useful route. Every ordinary humanoid is caught by contact; marked specialists have their own openings.',
    'start-title': 'Choose your playground',
    'military-title': 'Military Field',
    'military-help':
      'Russian field vehicles, concrete checkpoints and rutted ground. Vehicles keep their existing enemy rules and remain dangerous; soldiers are contact prey unless marked as specialists. Snake uses the same soldiers and concrete walls. Choose Military Field in the game appearance settings, or apply it and open a mode below.',
    'military-apply': 'Apply Military Field',
    'military-directory': 'Find levels with soldiers and vehicles',
    qualification:
      'Preview chapters: structural admission is complete; human completion routes, phone/controller play and release qualification are still being recorded. Existing campaigns and saved attempts keep their original rules.',
    'settings-title': 'Add running enemies to your next Capture attempt',
    'guide-title': 'Enemy field guide',
    'guide-help':
      'Goal · Tell · Counter. Families share an identity across modes, but each engine admits its own supported policies. Armed guards and relay wardens belong to Capture. Specialist missions are explicit choices.',
    'community-link': 'Community campaigns',
    'online-link': 'Private rooms preview',
    capture: 'Capture routes',
    captureBody:
      '24 new Solo / Versus missions across four chapters. Learn patrols, refuge goals and warning windows on familiar territory.',
    team: 'Pursuit partners',
    teamBody:
      '36 new Team missions across six chapters, with complementary routes, material choices and cooperative objectives.',
    snake: 'Living Routes · Snake',
    snakeBody:
      '12 new layouts for Solo, Versus and Team. Use your growing cable to separate pairs and approach an exposed specialist.',
    sim: 'Ground Routes · FPV SIM',
    simBody:
      '12 new native flight courses. Intercept unarmed ground patrols and choose your approach through real 3D terrain.',
    pilot: 'Open the six-level pilot',
    solo: 'Solo',
    versus: 'Versus',
    coop: 'Team',
    flight: 'Flight playlists',
    lesson: 'Start with the pilot',
  },
  uk: {
    eyebrow: 'Живі маршрути · нові переслідування',
    title: 'Помічайте сигнал. Скорочуйте шлях.',
    intro:
      'Нові суперники змінюють погоню на знайомих полях. Розпізнавайте наміри, перекривайте втечу й залишайте партнеру корисний маршрут. Звичайних гуманоїдів ловлять дотиком; позначені спеціалісти мають власні вразливі вікна.',
    'start-title': 'Оберіть поле гри',
    'military-title': 'Військове поле',
    'military-help':
      'Російська польова техніка, бетонні блокпости й колії. Техніка зберігає правила відповідних ворогів і залишається небезпечною; солдатів ловлять дотиком, окрім позначених спеціалістів. Змійка використовує тих самих солдатів і бетонні стіни. Оберіть «Військове поле» в налаштуваннях вигляду або застосуйте його й відкрийте режим нижче.',
    'military-apply': 'Застосувати «Військове поле»',
    'military-directory': 'Знайти рівні із солдатами й технікою',
    qualification:
      'Попередні розділи: структурну перевірку пройдено; маршрути проходження людьми, телефони, контролери та придатність до випуску ще перевіряються. Наявні кампанії та спроби зберігають початкові правила.',
    'settings-title': 'Додайте рухливих ворогів до наступної спроби Capture',
    'guide-title': 'Довідник ворогів',
    'guide-help':
      'Мета · Сигнал · Протидія. Образи спільні для режимів, але кожен рушій приймає власні підтримувані правила. Озброєні вартові й вартові ретрансляторів належать Capture. Місії зі спеціалістами обирають окремо.',
    'community-link': 'Кампанії спільноти',
    'online-link': 'Приватні кімнати',
    capture: 'Маршрути Capture',
    captureBody:
      '24 нові місії Соло / Поєдинку в чотирьох розділах. Вивчайте патрулі, схованки й попередження на полях захоплення.',
    team: 'Партнери переслідування',
    teamBody:
      '36 нових командних місій у шести розділах: взаємодоповнювальні маршрути, матеріали й спільні завдання.',
    snake: 'Живі маршрути · Snake',
    snakeBody:
      '12 нових полів для Соло, Поєдинку й Команди. Розділяйте пари кабелем і заходьте до спеціалістів із вразливого боку.',
    sim: 'Наземні маршрути · FPV SIM',
    simBody:
      '12 нових льотних трас. Перехоплюйте неозброєні патрулі та обирайте підхід у справжньому 3D-середовищі.',
    pilot: 'Відкрити пілот із шести рівнів',
    solo: 'Соло',
    versus: 'Поєдинок',
    coop: 'Команда',
    flight: 'Серії польотів',
    lesson: 'Почніть із пілоту',
  },
};
const node = (tag, text) => {
  const value = document.createElement(tag);
  if (text) value.textContent = text;
  return value;
};
const cards = [
  {
    id: 'capture',
    links: [
      ['solo', '../?journey=pursuit-campaigns-v1'],
      ['versus', '../couch/?journey=pursuit-campaigns-v1'],
    ],
    pilot: '../?journey=pursuit-pilots-v1',
  },
  {
    id: 'team',
    links: [['coop', '../couch/relay-rescue.html?journey=pursuit-campaigns-v1']],
    pilot: '../couch/relay-rescue.html?journey=pursuit-pilots-v1',
  },
  {
    id: 'snake',
    links: ['solo', 'versus', 'team'].map((mode) => [
      mode === 'team' ? 'coop' : mode,
      `../snake/play.html?mode=${mode}&level=classic-living-cable-cutoff&targets=authored&board=retro`,
    ]),
    pilot:
      '../snake/play.html?mode=solo&level=classic-living-shield-window&targets=authored&board=retro',
  },
  { id: 'sim', links: [['flight', '../snake/#sim-title']] },
];
function render() {
  nativeTargets.clear();
  for (const [link, target] of staticNativeLinks) setNativeLink(link, target);
  const locale = getLocale() === 'uk' ? 'uk' : 'en',
    copy = words[locale];
  $('language').value = locale;
  const directory = new URL('military-levels.html', location.href);
  directory.searchParams.set('lang', locale);
  setNativeLink($('military-directory'), directory.href);
  for (const [id, text] of Object.entries(copy)) if ($(id)) $(id).textContent = text;
  $('campaigns').replaceChildren(
    ...cards.map((card) => {
      const article = node('article'),
        links = node('div');
      links.className = 'launches';
      for (const [label, href] of card.links) {
        const anchor = node('a', copy[label]),
          url = new URL(href, location.href);
        url.searchParams.set('lang', locale);
        setNativeLink(anchor, url.href);
        links.append(anchor);
      }
      article.append(node('h3', copy[card.id]), node('p', copy[`${card.id}Body`]), links);
      if (card.pilot) {
        const link = node('a', copy.lesson),
          url = new URL(card.pilot, location.href);
        url.searchParams.set('lang', locale);
        setNativeLink(link, url.href);
        const p = node('p');
        p.append(link);
        article.append(p);
      }
      return article;
    }),
  );
  const cast = appearance.snapshot().cast;
  const vehicles = [
    ['enemy.bouncer', 'Field utility car', 'Польовий позашляховик'],
    ['enemy.claimed-rover', 'Cargo truck', 'Вантажівка'],
    ['enemy.border-patrol', 'Armored carrier', 'Бронетранспортер'],
    ['enemy.contour-patrol', 'Scout car', 'Розвідувальна машина'],
    ['enemy.eroder', 'Tracked tank', 'Гусеничний танк'],
    ['enemy.relay-sentinel', 'Radar truck', 'Радіолокаційна машина'],
  ];
  $('military-strip').replaceChildren(
    ...vehicles.map(([slot, en, uk]) => {
      const item = node('figure'),
        canvas = node('canvas');
      canvas.width = canvas.height = 64;
      canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(64, 64);
      image.data.set(
        militaryFieldPixels({ width: 64, height: 64 }, slot, {
          revision: runtimeActorArtRevision(),
        }).rgba,
      );
      ctx.putImageData(image, 0, 0);
      item.append(canvas, node('figcaption', locale === 'uk' ? uk : en));
      return item;
    }),
  );
  $('military-launches').replaceChildren(
    ...[
      [copy.solo, '../?journey=pursuit-pilots-v1'],
      [copy.versus, '../couch/?journey=pursuit-pilots-v1'],
      [copy.coop, '../couch/relay-rescue.html?journey=pursuit-pilots-v1'],
      ['Snake', '../snake/play.html?mode=solo&level=classic-living-cable-cutoff&board=theme'],
    ].map(([label, path]) => {
      const link = node('a', `${copy['military-apply']} · ${label}`),
        url = new URL(path, location.href);
      url.searchParams.set('appearanceFamily', 'military-field');
      url.searchParams.set('appearanceRevision', 'r1');
      url.searchParams.set('lang', locale);
      setNativeLink(link, url.href);
      const apply = (event) => {
        if (event.type === 'auxclick' && event.button !== 1) return;
        // The URL is a context default; existing personal/author-art choices
        // take precedence. This clearly labeled action explicitly selects the
        // complete shared appearance before opening the selected playground.
        clearExplicitReviewPin(location, history);
        // Refresh only owned URLs without replacing the activated anchor, so
        // modified and middle clicks retain the browser's native behavior.
        for (const [owned, target] of nativeTargets)
          owned.href = nativeArtReviewURL(target, location.href);
        enemyArtwork.set({ style: 'military' });
        const accepted = theme.applyComplete('military-field');
        if (
          event.button === 0 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          void accepted.then(() => location.assign(link.href));
        }
        // applyComplete persists synchronously, so modified/middle clicks can
        // retain native new-tab behavior with the same selected appearance.
      };
      link.addEventListener('click', apply);
      link.addEventListener('auxclick', apply);
      return link;
    }),
  );
  renderEnemyFieldGuide(
    $('guide'),
    ACTOR_FAMILIES.map((actor) => actor.id),
    { locale, cast: cast === 'authored' ? 'rivals' : cast },
  );
}
const canvases = ACTOR_FAMILIES.map(() => {
  const canvas = node('canvas');
  canvas.width = canvas.height = 96;
  return canvas;
});
$('cast-strip').append(...canvases);
mountRunningEnemyControls({ container: $('settings') });
attachDestructionControls({ container: $('destruction') });
$('language').addEventListener('change', () => void setLocale($('language').value));
appearance.subscribe(render);
onLocaleChange(render);
let previous = null,
  time = 0;
function frame(now) {
  const reduced = display.snapshot().effectiveReducedEffects;
  if (!document.hidden && !reduced && previous !== null) time += Math.min(100, now - previous);
  previous = now;
  const cast = appearance.snapshot().cast;
  canvases.forEach((canvas, index) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 96, 96);
    drawHuntActor(ctx, 8, 8, 80, Math.floor(time / 170) % 4, {
      family: ACTOR_FAMILIES[index].id,
      cast: cast === 'authored' ? 'rivals' : cast,
      direction: ['up', 'right', 'down', 'left'][(index + Math.floor(time / 2400)) % 4],
      state: 'walk',
      armed: ACTOR_FAMILIES[index].id === 'guard',
      timeMs: time,
      reducedEffects: reduced,
      token: false,
    });
  });
  requestAnimationFrame(frame);
}
render();
requestAnimationFrame(frame);
