import { createHuntDestruction, drawHuntRemains } from '../../game/hunt/destruction.mjs';
import { exportJSONFile } from '../../game/platform.mjs';
import { drawHuntActor, INDUSTRIAL_ACTOR_SAMPLES } from '../../game/hunt/actor-art.mjs';
import { actorDefinition } from '../../game/hunt/actor-catalog.mjs';
import {
  drawClassicDrone,
  drawClassicCable,
  advanceClassicFlight,
} from '../../game/snake/classic-flight-art.mjs';
import { militaryFieldPixels } from '../../game/presentation/military-field-art.mjs';
import { pageActorArtPool } from '../../game/presentation/actor-art-pool.mjs';

const $ = (id) => document.getElementById(id);
let paused = false,
  clock = 0,
  last = null,
  flight;
const rows = Object.keys(INDUSTRIAL_ACTOR_SAMPLES).map((family) => {
  const row = document.createElement('article'),
    title = document.createElement('h2'),
    canvas = document.createElement('canvas');
  canvas.width = 920;
  canvas.height = 180;
  row.append(title, canvas);
  $('actors').append(row);
  return { family, title, canvas };
});
const copy = {
  en: {
    text: {
      intro:
        'Transparent overhead silhouettes, readable equipment and stronger motion. This sample awaits artistic approval and does not replace saved appearances.',
      sizes:
        'Each row: released → candidate; actual 16 / 24 / 32 px and enlarged. Dark and light grounds are comparison surfaces, not sprite backgrounds.',
      'hardware-title': 'Flight and machinery',
      'hardware-note':
        'Existing FPV rig and connected body; candidate surface detail on the utility car and tank. Vehicle shapes retain their current game rules.',
      'effects-title': 'Defeat treatments',
      'play-title': 'Review in the native game',
      scope:
        'These links opt into the four overhead character samples only. Other families retain released artwork. Native SIM models and complete chapter adoption have separate review gates.',
      'studio-title': 'Animation authoring in Studio',
      'studio-copy':
        'Asset Studio → enemy image slot → Actor animation · advanced. Edit bounded atlas clips, compare at phone size, then stage and save/export a normal immutable collection. Generic actors currently select idle and move clips. Procedural soldier descriptors below are reference specimens, not image-atlas packages.',
      export: 'Download procedural sample descriptors',
      'facing-label': 'Facing',
      'state-label': 'State',
      'reduced-label': 'Reduced effects',
      'language-label': 'Language',
    },
    headings: ['North', 'East', 'South', 'West'],
    states: ['Moving', 'Notice', 'Warning', 'Recovery', 'Blocked'],
    pause: 'Pause motion',
    resume: 'Resume motion',
    released: 'Released',
    candidate: 'Candidate',
    links: [
      'Capture Solo',
      'Capture Versus',
      'Capture Team',
      'Snake · modern',
      'Snake · Retro',
      'Native SIM',
      'Asset Studio',
    ],
    budget: 'Shared actor-art ceiling',
    note: 'Decoded atlas usage is measured by the shared provider. Procedural specimens allocate no decoded atlas images.',
  },
  uk: {
    text: {
      intro:
        'Прозорі силуети згори, помітне спорядження та виразніший рух. Зразок очікує художнього схвалення й не замінює збережений вигляд.',
      sizes:
        'У кожному рядку: поточний → кандидат; справжні 16 / 24 / 32 пікселі та збільшення. Світлі й темні поверхні призначені для порівняння, це не тло спрайтів.',
      'hardware-title': 'Політ і техніка',
      'hardware-note':
        'Наявний FPV-дрон і з’єднане тіло; пробна деталізація автомобіля й танка. Ігрові правила техніки не змінюються.',
      'effects-title': 'Ефекти знищення',
      'play-title': 'Перегляд у грі',
      scope:
        'Посилання вмикають лише чотири пробні персонажі згори. Інші родини зберігають поточний вигляд. Моделі SIM і цілі розділи мають окреме схвалення.',
      'studio-title': 'Створення анімації у Студії',
      'studio-copy':
        'Студія ресурсів → зображення ворога → розширена анімація. Редагуйте обмежені кліпи атласу, порівнюйте розміри, зберігайте й експортуйте незмінну колекцію. Звичайні персонажі наразі використовують кліпи спокою та руху. Процедурні описи солдатів нижче є прикладами, а не пакетами атласів.',
      export: 'Завантажити процедурні описи',
      'facing-label': 'Напрямок',
      'state-label': 'Стан',
      'reduced-label': 'Менше ефектів',
      'language-label': 'Мова',
    },
    headings: ['Північ', 'Схід', 'Південь', 'Захід'],
    states: ['Рух', 'Помітив', 'Попередження', 'Відновлення', 'Заблокований'],
    pause: 'Зупинити рух',
    resume: 'Продовжити рух',
    released: 'Поточний',
    candidate: 'Кандидат',
    links: [
      'Захоплення соло',
      'Захоплення проти',
      'Захоплення в команді',
      'Змійка · сучасна',
      'Змійка · ретро',
      'Нативний SIM',
      'Студія ресурсів',
    ],
    budget: 'Спільна межа ресурсів персонажів',
    note: 'Спільний постачальник вимірює декодовані атласи. Процедурні зразки не створюють декодованих атласів.',
  },
};
const paths = [
  '../../game/?journey=pursuit-pilots-v1',
  '../../game/couch/?journey=pursuit-pilots-v1',
  '../../game/couch/relay-rescue.html?journey=pursuit-pilots-v1',
  '../../game/snake/play.html?mode=solo&level=classic-living-cable-cutoff',
  '../../game/snake/play.html?mode=team&level=classic-living-shield-window&board=retro',
  '../../optional-practice/fpv-worlds/index.html',
  '../asset-studio/',
];
function language() {
  const locale = $('language').value,
    words = copy[locale];
  document.documentElement.lang = locale;
  for (const [id, value] of Object.entries(words.text)) $(id).textContent = value;
  [...$('heading').options].forEach((option, i) => {
    option.textContent = words.headings[i];
  });
  [...$('state').options].forEach((option, i) => {
    option.textContent = words.states[i];
  });
  $('pause').textContent = paused ? words.resume : words.pause;
  for (const row of rows)
    row.title.textContent = actorDefinition(row.family)?.name?.[locale] ?? row.family;
  $('links').replaceChildren(
    ...paths.map((path, i) => {
      const link = document.createElement('a'),
        url = new URL(path, location.href);
      url.searchParams.set('artReview', 'industrial-pilot-v1');
      url.searchParams.set('lang', locale);
      link.href = url.href;
      link.textContent = words.links[i];
      return link;
    }),
  );
  const stats = pageActorArtPool(document).stats();
  $('budget').textContent = `${words.budget}: ${stats.limit / 1048576} MiB · ${words.note}`;
}
$('language').value = new URL(location.href).searchParams.get('lang') === 'uk' ? 'uk' : 'en';
$('language').onchange = language;
$('pause').onclick = () => {
  paused = !paused;
  language();
};
$('export').onclick = () =>
  void exportJSONFile(INDUSTRIAL_ACTOR_SAMPLES, 'industrial-pilot-animations.json');

const vehicles = ['enemy.bouncer', 'enemy.eroder'].map((slot) => {
  const pixels = militaryFieldPixels({ width: 32, height: 32 }, slot, {
    revision: 'industrial-pilot-v1',
  });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  canvas.getContext('2d').putImageData(new ImageData(pixels.rgba, 32, 32), 0, 0);
  return canvas;
});
const effects = [
  ['Clean impact', 'Чистий удар', false, false],
  ['Brutal · no blood', 'Жорстоко · без крові', true, false],
  ['Brutal · blood', 'Жорстоко · кров', true, true],
].map(([en, uk, brutal, blood]) => {
  const wrapper = document.createElement('div'),
    button = document.createElement('button'),
    canvas = document.createElement('canvas');
  button.type = 'button';
  button.textContent = en;
  canvas.width = 260;
  canvas.height = 140;
  wrapper.append(button, canvas);
  $('effects').append(wrapper);
  const painter = createHuntDestruction({ preview: true });
  const row = {
    en,
    uk,
    button,
    canvas,
    painter,
    brutal,
    blood,
    view: { valid: true, eliminations: [] },
    age: 0,
    serial: 0,
  };
  const options = () => ({ key: row, brutal, blood, reduced: $('reduced').checked, paused });
  painter.advance(row.view, 0, options());
  button.onclick = () => {
    row.serial++;
    row.age = 0;
    row.view.eliminations = [
      {
        id: `review-${row.serial}`,
        tick: row.serial,
        x: 8,
        y: 4,
        kind: 'courier',
        family: 'courier',
        cast: 'tactical',
        cause: 'ram',
      },
    ];
    painter.advance(row.view, 0, options());
  };
  return row;
});
function draw(now) {
  const reduced = $('reduced').checked,
    elapsed = last === null ? 0 : Math.min(100, now - last);
  last = now;
  if (!paused && !reduced && !document.hidden) clock += elapsed;
  flight = advanceClassicFlight(flight, elapsed, !paused && !document.hidden, reduced);
  const words = copy[$('language').value];
  for (const row of rows) {
    const ctx = row.canvas.getContext('2d');
    ctx.clearRect(0, 0, 920, 180);
    for (const [revision, offset, label] of [
      ['released', 0, words.released],
      ['industrial-pilot-v1', 460, words.candidate],
    ]) {
      ctx.fillStyle = '#b8c9c8';
      ctx.font = '14px sans-serif';
      ctx.fillText(label, offset + 12, 19);
      for (const [size, x] of [
        [16, 20],
        [24, 80],
        [32, 145],
        [112, 235],
      ]) {
        for (let y = 0; y < 4; y++) {
          ctx.fillStyle =
            x === 20 || x === 145 ? (y % 2 ? '#1d3031' : '#0c1d21') : y % 2 ? '#a6b69d' : '#d0d9c0';
          ctx.fillRect(offset + x - 6, 28 + y * 32, size + 12, 32);
        }
        drawHuntActor(ctx, offset + x, 36, size, Math.floor(clock / 100), {
          family: row.family,
          cast: 'tactical',
          artRevision: revision,
          heading: $('heading').value,
          state: $('state').value,
          phase: $('state').value === 'warning' ? 'warning' : undefined,
          timeMs: clock,
          reducedEffects: reduced,
          armed: row.family === 'guard',
        });
        ctx.fillStyle = '#fff0cc';
        ctx.fillText(`${size}px`, offset + x, 175);
      }
    }
  }
  const ctx = $('hardware').getContext('2d');
  ctx.clearRect(0, 0, 960, 190);
  ctx.imageSmoothingEnabled = false;
  const snake = {
    id: 0,
    direction: 'right',
    body: [
      { x: 5, y: 2 },
      { x: 4, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
    ],
  };
  const ink = { edge: '#79986d', body: '#23563a', band: '#b0d184' };
  ctx.save();
  ctx.scale(2, 2);
  drawClassicCable(
    ctx,
    snake,
    ink,
    { width: 24, height: 18 },
    { style: 'segmented', ...flight, reduced },
  );
  drawClassicDrone(ctx, snake, ink, { ...flight, reduced });
  ctx.restore();
  vehicles.forEach((image, i) => {
    ctx.drawImage(image, 480 + i * 190, 30, 128, 128);
  });
  for (const row of effects) {
    row.button.textContent = $('language').value === 'uk' ? row.uk : row.en;
    row.painter.advance(row.view, elapsed / 1000, {
      key: row,
      brutal: row.brutal,
      blood: row.blood,
      reduced,
      paused: paused || document.hidden,
    });
    if (!paused && !document.hidden) row.age += elapsed / 1000;
    const effectCtx = row.canvas.getContext('2d');
    effectCtx.clearRect(0, 0, 260, 140);
    if (row.view.eliminations.length && (row.age >= 0.85 || reduced))
      drawHuntRemains(effectCtx, row.view.eliminations[0], {
        brutal: row.brutal,
        blood: row.blood,
        unit: 2,
      });
    row.painter.draw(effectCtx, { unit: 2 });
  }
  requestAnimationFrame(draw);
}
language();
requestAnimationFrame(draw);
