import { OPERATION_PROTOTYPES } from './snake-operation-recipes.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
} from '../../snake/classic-match.mjs';
import { drawClassicBoard } from '../../snake/classic-view.mjs';
import { mountTouchControlsView } from '../../ui/touch-controls-view.mjs';
import { attachTouchSteering } from '../../ui/touch-steering.mjs';
const { document, window } = globalThis;
const $ = (id) => document.getElementById(id);
let match,
  playing = false,
  lastTime = 0,
  cards = [],
  cleanup = [],
  route = null,
  routeCursor = 0,
  generation = 0;
const locale = () => $('language').value;
const copy = (en, uk) => (locale() === 'uk' ? uk : en);
const entry = () => OPERATION_PROTOTYPES[Number($('mission').value) || 0];
$('setup').open = $('help').open = !window.matchMedia('(max-width: 600px), (max-height: 400px)')
  .matches;
const settings = { mode: 'dpad', side: 'right', size: 'regular', opacity: 1 };
function direction(seat, value) {
  generation++;
  route = null;
  if (match.status === 'running') queueClassicSnakeMatchTurn(match, seat, value);
}
function paint() {
  cards.forEach(({ canvas, board }) =>
    drawClassicBoard(canvas, match.runs[board], {
      boardStyle: $('look').value,
      boardScene: entry().scene,
      reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      cssWidth: canvas.clientWidth,
      locale: locale(),
    }),
  );
  $('start').textContent = playing ? copy('Pause', 'Пауза') : copy('Play', 'Грати');
  $('start').disabled = match.status !== 'running';
  $('step').disabled = match.status !== 'running';
  $('status').textContent = match.runs
    .map((run, i) => {
      const op = run.operation,
        stage = run.level.operation.stages[op.stage];
      const prefix = match.options.mode === 'versus' ? `P${i + 1} · ` : '';
      if (!stage) return prefix + copy('Operation complete', 'Операцію завершено');
      return (
        prefix +
        copy(
          `Stage ${op.stage + 1}/${run.level.operation.stages.length}`,
          `Етап ${op.stage + 1}/${run.level.operation.stages.length}`,
        ) +
        (stage.catches
          ? copy(
              ` · Catches ${run.catches}/${stage.catches}`,
              ` · Цілі ${run.catches}/${stage.catches}`,
            )
          : '') +
        (stage.deliveries.length
          ? copy(
              ` · Delivered ${stage.deliveries.filter((id) => op.parcels.some((p) => p.id === id && p.state === 'delivered')).length}/${stage.deliveries.length}`,
              ` · Доставлено ${stage.deliveries.filter((id) => op.parcels.some((p) => p.id === id && p.state === 'delivered')).length}/${stage.deliveries.length}`,
            )
          : '') +
        (run.status === 'lost' ? copy(' · Crashed — Retry', ' · Зіткнення — Спробувати знову') : '')
      );
    })
    .join(' | ');
  if (match.status === 'finished' && match.options.mode === 'versus')
    $('status').textContent =
      copy('Mission Race: ', 'Перегони місії: ') +
      (match.result === 'draw'
        ? copy('Draw', 'Нічия')
        : copy(`${match.result.toUpperCase()} wins`, `${match.result.toUpperCase()} перемагає`));
}
function mount() {
  generation++;
  route = null;
  routeCursor = 0;
  playing = false;
  cleanup.forEach((fn) => fn());
  cleanup = [];
  match = createClassicSnakeMatch(entry().level, {
    mode: $('mode').value,
    policy: 'mission',
    seed: 17,
  });
  $('boards').replaceChildren();
  cards = [];
  match.runs.forEach((run, board) => {
    const article = document.createElement('article'),
      canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', entry().title[locale()]);
    article.append(canvas);
    $('boards').append(article);
    cards.push({ canvas, board });
    const seats = match.options.mode === 'team' ? [0, 1] : [board];
    for (const seat of seats) {
      const view = mountTouchControlsView({ mount: article, idPrefix: `operation-seat-${seat}` });
      view.apply(settings);
      for (const [key, button] of Object.entries(view.directionButtons)) {
        button.setAttribute('aria-label', `P${seat + 1} ${key}`);
        button.addEventListener('click', (event) => {
          if (event.detail === 0) direction(seat, key);
        });
      }
      const touch = attachTouchSteering({
        arena: canvas,
        pad: view.pad,
        surface: view.surface,
        indicator: view.indicator,
        getSettings: () => settings,
        active: () => match.status === 'running',
        onDirection: (value) => direction(seat, value),
      });
      cleanup.push(() => touch.destroy());
    }
  });
  translate();
}
function translate() {
  document.documentElement.lang = locale();
  const texts = {
    setupLabel: ['Lab setup', 'Налаштування'],
    title: ['Continuous operations', 'Безперервні операції'],
    notice: [
      'Four review prototypes. No progress, records or preferences are saved.',
      'Чотири прототипи для перевірки. Прогрес, рекорди та налаштування не зберігаються.',
    ],
    missionLabel: ['Mission', 'Місія'],
    modeLabel: ['Mode', 'Режим'],
    lookLabel: ['Look', 'Вигляд'],
    languageLabel: ['Language', 'Мова'],
    step: ['One move', 'Один хід'],
    retry: ['Retry', 'Спробувати знову'],
    proof: ['Watch verified route', 'Переглянути перевірений маршрут'],
    helpLabel: ['Mission information', 'Про місію'],
    keys: [
      'P1: arrows. P2: WASD. Space: pause. Touch: shared D-pad. Match parcel and dock letters. The extraction arrow lights when ready.',
      'P1: стрілки. P2: WASD. Пробіл: пауза. Дотик: спільна хрестовина. Поєднуйте літери посилок і доків. Стрілка евакуації світиться, коли все готово.',
    ],
  };
  for (const [id, values] of Object.entries(texts)) $(id).textContent = copy(...values);
  Array.from($('mission').options).forEach(
    (option, i) => (option.textContent = OPERATION_PROTOTYPES[i].title[locale()]),
  );
  const modeNames = {
    solo: ['Solo', 'Один гравець'],
    team: ['Team', 'Команда'],
    versus: ['Versus · Mission Race', 'Дуель · Перегони місії'],
  };
  const lookNames = {
    'living-circuit': ['Lively FPV', 'Жвавий FPV'],
    toybox: ['Toybox', 'Іграшковий світ'],
    'atmospheric-ruins': ['Atmospheric Ruins', 'Атмосферні руїни'],
    'night-arcade': ['Night Arcade', 'Нічна аркада'],
    theme: ['Game Theme', 'Тема гри'],
    retro: ['Retro Field', 'Ретрополе'],
  };
  for (const [select, names] of [
    ['mode', modeNames],
    ['look', lookNames],
  ])
    for (const option of $(select).options) option.textContent = copy(...names[option.value]);
  const directionNames = {
    up: ['up', 'вгору'],
    left: ['left', 'ліворуч'],
    down: ['down', 'вниз'],
    right: ['right', 'праворуч'],
  };
  for (const [seat, pad] of Array.from(document.querySelectorAll('.shared-touch-pad')).entries()) {
    pad.setAttribute(
      'aria-label',
      copy(`Pilot ${seat + 1} direction controls`, `Керування пілотом ${seat + 1}`),
    );
    for (const button of pad.querySelectorAll('[data-direction]'))
      button.setAttribute(
        'aria-label',
        `P${seat + 1} ${copy(...directionNames[button.dataset.direction])}`,
      );
  }
  for (const { canvas } of cards) canvas.setAttribute('aria-label', entry().title[locale()]);
  $('hint').textContent = entry().hint[locale()];
  paint();
}
for (const [i, prototype] of OPERATION_PROTOTYPES.entries()) {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = prototype.title.en;
  $('mission').append(option);
}
for (const id of ['mission', 'mode']) $(id).addEventListener('change', mount);
$('language').addEventListener('change', translate);
$('look').addEventListener('change', paint);
$('retry').addEventListener('click', mount);
$('start').addEventListener('click', () => {
  generation++;
  playing = !playing;
  lastTime = performance.now();
  paint();
});
function step() {
  if (match.status !== 'running') return;
  while (route?.turns[routeCursor]?.tick === match.runs[0].tick) {
    const turn = route.turns[routeCursor++];
    queueClassicSnakeMatchTurn(match, turn.playerId, turn.direction);
    if (match.options.mode === 'versus') queueClassicSnakeMatchTurn(match, 1, turn.direction);
  }
  advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
  if (match.status !== 'running') playing = false;
  paint();
}
$('proof').addEventListener('click', async () => {
  mount();
  const identity = generation;
  try {
    const data = await (await fetch('../fixtures/classic-snake-v5-prototype-proofs.json')).json();
    if (generation !== identity) return;
    route = data.proofs.find(
      (p) =>
        p.level.id === entry().level.id &&
        p.mode === (match.options.mode === 'team' ? 'team' : 'solo'),
    );
    if (!route) throw new Error('Missing qualification route');
    playing = true;
    lastTime = performance.now();
    paint();
  } catch (error) {
    if (generation === identity) $('status').textContent = error.message;
  }
});
$('step').addEventListener('click', () => {
  generation++;
  playing = false;
  step();
});
window.addEventListener('keydown', (event) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  const keys = {
    ArrowUp: [0, 'up'],
    ArrowDown: [0, 'down'],
    ArrowLeft: [0, 'left'],
    ArrowRight: [0, 'right'],
    w: [1, 'up'],
    s: [1, 'down'],
    a: [1, 'left'],
    d: [1, 'right'],
  };
  if (keys[event.key]) {
    event.preventDefault();
    direction(...keys[event.key]);
  }
  if (event.code === 'Space' && !['BUTTON', 'SUMMARY'].includes(event.target.tagName)) {
    event.preventDefault();
    generation++;
    playing = !playing && match.status === 'running';
    lastTime = performance.now();
    paint();
  }
});
document.addEventListener('visibilitychange', () => {
  generation++;
  playing = false;
  paint();
});
function frame(now) {
  if (playing && now - lastTime >= nextClassicSnakeMatchEventAt(match) - match.elapsedMs) {
    lastTime = now;
    step();
  }
  window.requestAnimationFrame(frame);
}
mount();
window.requestAnimationFrame(frame);
