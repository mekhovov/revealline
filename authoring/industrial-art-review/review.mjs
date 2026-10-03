import { createHuntDestruction, drawHuntRemains } from '../../game/hunt/destruction.mjs';
import { exportJSONFile } from '../../game/platform.mjs';
import { drawHuntActor, OVERHEAD_ACTOR_SAMPLES } from '../../game/hunt/actor-art.mjs';
import { actorDefinition, ACTOR_FAMILIES, ACTOR_CASTS } from '../../game/hunt/actor-catalog.mjs';
import {
  drawClassicDrone,
  drawClassicCable,
  advanceClassicFlight,
} from '../../game/snake/classic-flight-art.mjs';
import { militaryFieldPixels } from '../../game/presentation/military-field-art.mjs';
import {
  INDUSTRIAL_MATERIALS,
  drawIndustrialMaterialSpecimen,
} from '../../game/presentation/industrial-materials.mjs';
import {
  INDUSTRIAL_AUDIO_SAMPLES,
  createIndustrialAudioReview,
} from '../../game/ui/industrial-audio-review.mjs';
import { pageActorArtPool } from '../../game/presentation/actor-art-pool.mjs';
import { mountReviewMotionPreferences } from './motion-preferences.mjs';

const $ = (id) => document.getElementById(id);
const motion = mountReviewMotionPreferences({
  window,
  checkbox: $('reduced'),
  notice: $('motion-notice'),
  getLocale: () => $('language').value,
});
let paused = false,
  clock = 0,
  last = null,
  flight;
const rows = ACTOR_FAMILIES.map(({ id: family }) => {
  const row = document.createElement('article'),
    title = document.createElement('h2'),
    rules = document.createElement('p'),
    pair = document.createElement('div');
  pair.className = 'actor-pair';
  const panels = ['industrial-pilot-v1', 'industrial-overhead-v2'].map((revision) => {
    const panel = document.createElement('div'),
      label = document.createElement('h3'),
      canvas = document.createElement('canvas');
    panel.append(label, canvas);
    pair.append(panel);
    return { revision, label, canvas };
  });
  row.append(title, rules, pair);
  $('actors').append(row);
  return { family, title, rules, panels };
});
const copy = {
  en: {
    text: {
      'page-title': 'Industrial field kit',
      eyebrow: 'ORIGINAL ART · OVERHEAD REVIEW 03',
      'nav-studio': 'Asset Studio',
      'nav-motion': 'Motion Lab',
      'nav-guide': 'Enemy field guide',
      intro:
        'Directly overhead bodies: helmet crowns overlap shoulders, equipment sits on the back or sides, and short strides stay on the ground plane. Compare every family and direction before approving the new artwork.',
      sizes:
        'All 12 families, with three appearance kits. Previous → corrected overhead; actual 16 / 24 / 32 px, enlarged, and all eight headings. Comparison grounds are separate from the transparent sprites.',
      'hardware-title': 'Flight and machinery',
      'hardware-note':
        'Existing FPV rig and connected body; candidate surface detail on the utility car and tank. Vehicle shapes retain their current game rules.',
      'materials-title': 'Shared terrain materials',
      'materials-note':
        'Concrete, rutted earth and tread plate share original pixels with Military Field board tiles and supported native SIM material maps. Native hazard markers remain above these textures; physical material rules stay authored.',
      'audio-title': 'Equipment and movement sounds',
      'audio-note':
        'Play a short sample through the game mixer. Your mute and Effects settings apply. Nothing plays automatically.',
      'treatment-label': 'Treatment',
      'audio-stop': 'Stop sample',
      'effects-title': 'Defeat treatments',
      'play-title': 'Review in the native game',
      scope:
        'Board links use the corrected overhead rig for all twelve families, shared by Capture, Snake and Studio. Native SIM retains its separate 3D models. The preview does not change collision, speed, weapons or vulnerability.',
      'studio-title': 'Animation authoring in Studio',
      'studio-copy':
        'Import the review collection into a separate Studio workspace, select enemy.bouncer, then open Actor animation · advanced → Load current actor. The original transparent atlas contains twelve 32×32 poses (48 KiB decoded). Native movement, warning, recovery and blocked states select admitted clips. Notice and caught remain Studio previews for this actor. Export/import retains both the atlas and its original parent.',
      export: 'Download procedural soldier descriptors',
      'atlas-download': 'Download complete Studio collection',
      'atlas-guide': 'Import and review instructions',
      'atlas-provenance': 'Artwork provenance and exact sizes',
      'facing-label': 'Facing',
      'cast-label': 'Appearance kit',
      'state-label': 'State',
      'reduced-label': 'Reduced effects',
      'language-label': 'Language',
    },
    labels: {
      actors: 'Character comparison',
      hardware: 'Drone, body, utility car and tank preview',
      atlas: 'Transparent twelve-pose machinery atlas',
    },
    materials: ['Concrete barrier', 'Rutted earth', 'Steel tread plate'],
    treatments: ['Clean', 'Brutal without blood', 'Brutal with blood'],
    audio: {
      ready: 'Choose a sample.',
      playing: 'Starting sample…',
      played: 'Sample started. It stops after one second.',
      stopped: 'Sample stopped.',
      muted: 'Sound is muted. Unmute to listen.',
      unavailable: 'Audio is unavailable or Effects volume is zero.',
      cancelled: 'Sample stopped.',
      mute: 'Mute sound',
      unmute: 'Unmute sound',
    },
    headings: ['North', 'East', 'South', 'West'],
    states: ['Moving', 'Notice', 'Warning', 'Recovery', 'Blocked'],
    pause: 'Pause motion',
    resume: 'Resume motion',
    released: 'Previous · angled figure',
    candidate: 'Corrected · directly overhead',
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
      'page-title': 'Промисловий польовий набір',
      eyebrow: 'ОРИГІНАЛЬНІ РЕСУРСИ · ВИГЛЯД ЗГОРИ 03',
      'nav-studio': 'Студія ресурсів',
      'nav-motion': 'Лабораторія руху',
      'nav-guide': 'Довідник ворогів',
      intro:
        'Персонажі прямо згори: верх шолома перекриває плечі, спорядження розташоване на спині або збоку, короткі кроки йдуть площиною землі. Порівняйте всі родини й напрямки перед схваленням нового вигляду.',
      sizes:
        'Усі 12 родин у трьох комплектах спорядження. Попередній → виправлений вигляд згори; справжні 16 / 24 / 32 пікселі, збільшення та всі вісім напрямків. Порівняльні поверхні відокремлені від прозорих спрайтів.',
      'hardware-title': 'Політ і техніка',
      'hardware-note':
        'Наявний FPV-дрон і з’єднане тіло; пробна деталізація автомобіля й танка. Ігрові правила техніки не змінюються.',
      'materials-title': 'Спільні матеріали місцевості',
      'materials-note':
        'Бетон, ґрунтові колії та рифлена сталь використовують ті самі оригінальні пікселі на полі Military Field і в підтримуваних матеріалах SIM. Позначки небезпеки залишаються над текстурами; фізичні правила визначає рівень.',
      'audio-title': 'Звуки спорядження та руху',
      'audio-note':
        'Короткі зразки відтворюються через ігровий мікшер. Діють ваші налаштування звуку та гучності ефектів. Автоматичного відтворення немає.',
      'treatment-label': 'Варіант',
      'audio-stop': 'Зупинити зразок',
      'effects-title': 'Ефекти знищення',
      'play-title': 'Перегляд у грі',
      scope:
        'Посилання на поля вмикають виправлений вигляд згори всіх дванадцяти родин у Захопленні, Змійці та Студії. Нативний SIM зберігає окремі 3D-моделі. Перегляд не змінює зіткнення, швидкість, зброю чи вразливість.',
      'studio-title': 'Створення анімації у Студії',
      'studio-copy':
        'Імпортуйте пробну колекцію в окремий простір Студії, оберіть enemy.bouncer, відкрийте розширену анімацію та завантажте поточного персонажа. Оригінальний прозорий атлас містить дванадцять поз 32×32 (48 КіБ після декодування). Рух, попередження, відновлення та блокування обирають відповідні кліпи. Помічання та знищення тут доступні як перегляд у Студії. Експорт та імпорт зберігають атлас і оригінал.',
      export: 'Завантажити процедурні описи солдатів',
      'atlas-download': 'Завантажити повну колекцію Студії',
      'atlas-guide': 'Інструкції імпорту та перегляду',
      'atlas-provenance': 'Походження ресурсів і точні розміри',
      'facing-label': 'Напрямок',
      'cast-label': 'Комплект спорядження',
      'state-label': 'Стан',
      'reduced-label': 'Менше ефектів',
      'language-label': 'Мова',
    },
    labels: {
      actors: 'Порівняння персонажів',
      hardware: 'Перегляд дрона, тіла, автомобіля й танка',
      atlas: 'Прозорий атлас техніки з дванадцятьма позами',
    },
    materials: ['Бетонна перешкода', 'Ґрунтові колії', 'Рифлена сталь'],
    treatments: ['Без жорстокості', 'Жорстоко без крові', 'Жорстоко з кров’ю'],
    audio: {
      ready: 'Оберіть зразок.',
      playing: 'Підготовка зразка…',
      played: 'Зразок запущено. Він зупиниться за секунду.',
      stopped: 'Зразок зупинено.',
      muted: 'Звук вимкнено. Увімкніть його для прослуховування.',
      unavailable: 'Звук недоступний або гучність ефектів нульова.',
      cancelled: 'Зразок зупинено.',
      mute: 'Вимкнути звук',
      unmute: 'Увімкнути звук',
    },
    headings: ['Північ', 'Схід', 'Південь', 'Захід'],
    states: ['Рух', 'Помітив', 'Попередження', 'Відновлення', 'Заблокований'],
    pause: 'Зупинити рух',
    resume: 'Продовжити рух',
    released: 'Попередній · похила фігура',
    candidate: 'Виправлений · прямо згори',
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
const materials = INDUSTRIAL_MATERIALS.map((material) => {
  const card = document.createElement('div'),
    label = document.createElement('h3'),
    canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  drawIndustrialMaterialSpecimen(ctx, { material, x: 8, y: 8, width: 32, height: 32 });
  drawIndustrialMaterialSpecimen(ctx, { material, x: 64, y: 8, width: 96, height: 96 });
  ctx.fillStyle = '#b8c9c8';
  ctx.font = '12px sans-serif';
  ctx.fillText('32 px', 8, 62);
  ctx.fillText('3×', 64, 124);
  card.append(label, canvas);
  $('materials').append(card);
  return { label, canvas };
});
const sound = createIndustrialAudioReview({ window, document });
let audioResult = 'ready',
  audioTicket = 0;
const audioRows = INDUSTRIAL_AUDIO_SAMPLES.map((sample) => {
  const card = document.createElement('div'),
    button = document.createElement('button'),
    description = document.createElement('p');
  button.type = 'button';
  button.onclick = async () => {
    const ticket = ++audioTicket;
    audioResult = 'playing';
    updateAudio();
    try {
      const result = await sound.play(sample.id, { treatment: $('audio-treatment').value });
      if (ticket !== audioTicket) return;
      audioResult = result.played ? 'played' : result.reason;
    } catch {
      if (ticket !== audioTicket) return;
      audioResult = 'unavailable';
    }
    updateAudio();
  };
  card.append(button, description);
  $('audio-samples').append(card);
  return { sample, button, description };
});
function updateAudio() {
  const words = copy[$('language').value].audio;
  $('audio-mute').textContent = sound.snapshot().muted ? words.unmute : words.mute;
  $('audio-status').textContent = words[audioResult] ?? words.ready;
}
$('audio-stop').onclick = () => {
  audioTicket++;
  sound.release();
  audioResult = 'stopped';
  updateAudio();
};
$('audio-mute').onclick = () => {
  audioTicket++;
  const next = sound.setMuted(!sound.snapshot().muted);
  audioResult = next.muted ? 'muted' : 'ready';
  updateAudio();
};
window.addEventListener('pagehide', (event) => {
  audioTicket++;
  if (!event.persisted) {
    motion.dispose();
    for (const row of effects) row.painter.reset();
  }
});
function language() {
  const locale = $('language').value,
    words = copy[locale];
  document.documentElement.lang = locale;
  motion.refresh();
  for (const id of ['nav-studio', 'nav-motion', 'nav-guide']) {
    const url = new URL($(id).getAttribute('href'), location.href);
    url.searchParams.set('artReview', 'industrial-overhead-v2');
    url.searchParams.set('lang', locale);
    $(id).href = url.href;
  }
  $('actors').setAttribute('aria-label', words.labels.actors);
  $('hardware').setAttribute('aria-label', words.labels.hardware);
  document.querySelector('.atlas-sheet').alt = words.labels.atlas;
  for (const [id, value] of Object.entries(words.text)) $(id).textContent = value;
  materials.forEach((row, index) => {
    row.label.textContent = words.materials[index];
    row.canvas.setAttribute('aria-label', words.materials[index]);
  });
  audioRows.forEach(({ sample, button, description }) => {
    button.textContent = sample.label[locale];
    description.textContent = sample.description[locale];
  });
  [...$('audio-treatment').options].forEach((option, i) => {
    option.textContent = words.treatments[i];
  });
  updateAudio();
  [...$('cast').options].forEach((option) => {
    option.textContent = ACTOR_CASTS.find((entry) => entry.id === option.value).name[locale];
  });
  [...$('heading').options].forEach((option, i) => {
    option.textContent = words.headings[i];
  });
  [...$('state').options].forEach((option, i) => {
    option.textContent = words.states[i];
  });
  $('pause').textContent = paused ? words.resume : words.pause;
  for (const row of rows) {
    const definition = actorDefinition(row.family);
    row.title.textContent = definition?.name?.[locale] ?? row.family;
    const engines = Object.entries(definition.capabilities)
      .filter(([, value]) => value)
      .map(
        ([engine]) =>
          ({
            capture: locale === 'uk' ? 'Захоплення' : 'Capture',
            snake: locale === 'uk' ? 'Змійка' : 'Snake',
            flight: 'SIM (3D)',
          })[engine],
      );
    row.rules.textContent = `${engines.join(' · ')}. ${definition.guide[locale].counter}`;
    for (const panel of row.panels) {
      const label = panel.revision === 'industrial-pilot-v1' ? words.released : words.candidate;
      panel.label.textContent = label;
      panel.canvas.setAttribute(
        'aria-label',
        `${row.title.textContent} · ${label} · 16 / 24 / 32 px`,
      );
    }
  }
  document.title = words.text['page-title'];
  $('links').replaceChildren(
    ...paths.map((path, i) => {
      const link = document.createElement('a'),
        url = new URL(path, location.href);
      url.searchParams.set('artReview', i === 5 ? 'industrial-pilot-v1' : 'industrial-overhead-v2');
      url.searchParams.set('appearanceFamily', 'military-field');
      url.searchParams.set('appearanceRevision', 'r1');
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
  if (paused) {
    audioTicket++;
    sound.release();
    audioResult = 'stopped';
  }
  language();
};
$('export').onclick = () =>
  void exportJSONFile(OVERHEAD_ACTOR_SAMPLES, 'industrial-overhead-v2-animations.json');

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
  const options = () => ({ key: row, brutal, blood, reduced: motion.reducedEffects(), paused });
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
  const reduced = motion.reducedEffects(),
    elapsed = last === null ? 0 : Math.min(100, now - last);
  last = now;
  if (!paused && !reduced && !document.hidden) clock += elapsed;
  flight = advanceClassicFlight(flight, elapsed, !paused && !document.hidden, reduced);
  for (const row of rows) {
    for (const panel of row.panels) {
      const width = Math.max(160, Math.floor(panel.canvas.parentElement.clientWidth)),
        stacked = width < 380,
        height = stacked ? 390 : 320;
      if (panel.canvas.width !== width || panel.canvas.height !== height) {
        panel.canvas.width = width;
        panel.canvas.height = height;
      }
      const ctx = panel.canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;
      const specimens = [
        [16, 16, 16],
        [24, 70, 16],
        [32, 130, 16],
        [112, stacked ? Math.floor((width - 112) / 2) : width - 136, stacked ? 106 : 16],
      ];
      for (const [size, x, y] of specimens) {
        for (let strip = 0; strip < 4; strip++) {
          ctx.fillStyle =
            x === 16 || x === 130
              ? strip % 2
                ? '#1d3031'
                : '#0c1d21'
              : strip % 2
                ? '#a6b69d'
                : '#d0d9c0';
          ctx.fillRect(x - 6, y - 6 + (strip * (size + 12)) / 4, size + 12, (size + 12) / 4);
        }
        drawHuntActor(ctx, x, y, size, Math.floor(clock / 100), {
          family: row.family,
          cast: $('cast').value,
          artRevision: panel.revision,
          heading: $('heading').value,
          state: $('state').value,
          phase: $('state').value === 'warning' ? 'warning' : undefined,
          timeMs: clock,
          reducedEffects: reduced,
          armed: row.family === 'guard',
        });
        ctx.fillStyle = '#fff0cc';
        ctx.font = '12px sans-serif';
        ctx.fillText(`${size}px`, x, y + size + 22);
      }
      const compassY = stacked ? 276 : 204;
      ['up', 'right', 'down', 'left'].forEach((heading, index) => {
        const x = 16 + index * 64;
        drawHuntActor(ctx, x, compassY, 32, Math.floor(clock / 100), {
          family: row.family,
          cast: $('cast').value,
          artRevision: panel.revision,
          heading,
          state: $('state').value,
          phase: $('state').value === 'warning' ? 'warning' : undefined,
          timeMs: clock,
          reducedEffects: reduced,
          armed: row.family === 'guard',
        });
        ctx.fillStyle = '#b8c9c8';
        ctx.fillText(['↑', '→', '↓', '←'][index], x + 12, compassY - 8);
      });
      ['↗', '↘', '↙', '↖'].forEach((symbol, index) => {
        const x = 16 + index * 64;
        drawHuntActor(ctx, x, compassY + 56, 32, Math.floor(clock / 100), {
          family: row.family,
          cast: $('cast').value,
          artRevision: panel.revision,
          facingRadians: Math.PI / 4 + (index * Math.PI) / 2,
          state: $('state').value,
          phase: $('state').value === 'warning' ? 'warning' : undefined,
          timeMs: clock,
          reducedEffects: reduced,
          armed: row.family === 'guard',
        });
        ctx.fillStyle = '#b8c9c8';
        ctx.fillText(symbol, x + 12, compassY + 48);
      });
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
