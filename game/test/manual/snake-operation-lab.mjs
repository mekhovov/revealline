import { CLASSIC_SNAKE_OPERATION_LEVELS_B } from '../../snake/classic-catalogue-operations-b.mjs';
import { CLASSIC_SNAKE_OPERATION_LEVELS_A } from '../../snake/classic-catalogue-operations-a.mjs';
import { classicOperationStatus } from '../../snake/classic-operation-status.mjs';
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
import { CLASSIC_SNAKE_LEVELS } from '../../snake/classic-catalogue.mjs';
import { CLASSIC_REMASTER_PROTOTYPES } from '../../snake/classic-catalogue-remaster.mjs';
import { observeClassicWorldReactions } from '../../snake/classic-world-reactions.mjs';
import { Soundscape } from '../../ui/audio.mjs';
import { createClassicAudio } from '../../snake/classic-audio.mjs';
import { createAudioMaster } from '../../ui/audio-master.mjs';
import { classicSnakeSignalView } from '../../snake/classic-core-v4.mjs';
const { document, window } = globalThis;
const $ = (id) => document.getElementById(id);
const remaster = new URL(window.location.href).searchParams.get('review') === 'remaster';
const audioMaster = createAudioMaster();
const sound = new Soundscape({ audioMaster });
sound.configure({ music: 0, sfx: 0.65 });
const audio = createClassicAudio(sound, { getBoardStyle: () => $('look').value });
function playback(value) {
  playing = value && match?.status === 'running';
  sound.gameplayPaused = !playing;
  if (playing) void sound.enable().then(() => audio.prepare());
  else sound.pause();
}
let visualTime = 0,
  previousFrame = 0,
  lastPaint = 0;
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
const labEntries = remaster
  ? CLASSIC_REMASTER_PROTOTYPES.map((prototype) => {
      const row = CLASSIC_SNAKE_LEVELS.find((item) => item.id === prototype.levelId);
      return {
        ...row,
        hint: row.description,
        scene: row.composition?.scene ?? 'auto',
        prototypeMode: prototype.mode,
      };
    })
  : [
      ...OPERATION_PROTOTYPES,
      ...[...CLASSIC_SNAKE_OPERATION_LEVELS_A, ...CLASSIC_SNAKE_OPERATION_LEVELS_B].map((row) => ({
        ...row,
        hint: row.description,
        scene: row.composition.scene,
      })),
    ];
const entry = () => labEntries[Number($('mission').value) || 0];
$('setup').open = $('help').open = !window.matchMedia('(max-width: 600px), (max-height: 400px)')
  .matches;
const settings = { mode: 'dpad', side: 'right', size: 'regular', opacity: 1 };
function direction(seat, value) {
  generation++;
  route = null;
  if (match.status === 'running') queueClassicSnakeMatchTurn(match, seat, value);
}
function paint() {
  cards.forEach(({ canvas, board, look }) =>
    drawClassicBoard(canvas, match.runs[board], {
      boardStyle: look ?? $('look').value,
      boardScene: entry().scene,
      chapterId: entry().chapterId,
      flight: { timeMs: visualTime, active: playing },
      effectTimeMs: visualTime,
      attemptKey: match,
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
      const prefix = match.options.mode === 'versus' ? `P${i + 1} · ` : '';
      return (
        prefix +
        (classicOperationStatus(run, locale()) ||
          copy(
            `Caught ${run.catches}/${run.level.goal} · Move ${run.tick}`,
            `Спіймано ${run.catches}/${run.level.goal} · Хід ${run.tick}`,
          )) +
        (classicSnakeSignalView(run).active ? copy(' · Interference', ' · Перешкоди') : '') +
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
function mount({ retain = false } = {}) {
  if (!retain) {
    generation++;
    route = null;
    routeCursor = 0;
    playing = false;
    visualTime = 0;
    audio.reset();
    sound.gameplayPaused = true;
    match = createClassicSnakeMatch(entry().level, {
      mode: $('mode').value,
      policy: 'mission',
      seed: 17,
      ...(entry().level.targets?.required.some((p) => p.signalProfile) ? { hazardSeed: 17 } : {}),
    });
  }
  cleanup.forEach((fn) => fn());
  cleanup = [];
  $('boards').replaceChildren();
  cards = [];
  match.runs.forEach((run, board) => {
    const looks = $('look').value === 'comparison' ? ['living-circuit', 'toybox', 'theme'] : [null];
    for (const [lookIndex, look] of looks.entries()) {
      const article = document.createElement('article'),
        canvas = document.createElement('canvas');
      if (look) {
        const label = document.createElement('h2');
        label.textContent = {
          'living-circuit': 'Rich pixels · Lively FPV',
          toybox: 'Illustrated toy world',
          theme: 'Restrained field',
        }[look];
        label.style.fontSize = '1rem';
        article.append(label);
      }
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', entry().title[locale()]);
      article.append(canvas);
      $('boards').append(article);
      cards.push({ canvas, board, look, label: article.querySelector('h2') });
      observeClassicWorldReactions(canvas, run, match, visualTime);
      if (lookIndex > 0) continue;
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
      'Eight mechanic prototypes and 96 campaign missions. No progress, records or preferences are saved.',
      'Вісім прототипів механік і 96 місій кампаній. Прогрес, рекорди та налаштування не зберігаються.',
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
  if (remaster) {
    $('title').textContent = copy(
      'Snake remaster · playable comparison',
      'Оновлений Snake · ігрове порівняння',
    );
    $('notice').textContent = copy(
      'Six encounters, three presentations. All views share the same live simulation and seed. Compare artwork here; evaluate revised tactics separately in the campaign. No progress is saved.',
      'Шість зустрічей, три оформлення. Усі види мають спільну симуляцію та початкове число. Порівнюйте оформлення тут, а оновлену тактику — окремо в кампанії. Прогрес не зберігається.',
    );
    $('proof').hidden = true;
  }
  Array.from($('mission').options).forEach(
    (option, i) => (option.textContent = labEntries[i].title[locale()]),
  );
  const modeNames = {
    solo: ['Solo', 'Один гравець'],
    team: ['Team', 'Команда'],
    versus: ['Versus · Mission Race', 'Дуель · Перегони місії'],
  };
  const lookNames = {
    comparison: ['Compare three directions', 'Порівняти три напрями'],
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
  for (const { canvas, look, label } of cards) {
    canvas.setAttribute('aria-label', entry().title[locale()]);
    if (label)
      label.textContent = copy(
        ...{
          'living-circuit': ['Rich pixels · Lively FPV', 'Насичені пікселі · Жвавий FPV'],
          toybox: ['Illustrated toy world', 'Мальований іграшковий світ'],
          theme: ['Restrained field', 'Стримане поле'],
        }[look],
      );
  }
  $('sound').textContent = audioMaster.snapshot().muted
    ? copy('Sound off', 'Звук вимкнено')
    : copy('Sound on', 'Звук увімкнено');
  $('hint').textContent = entry().hint[locale()];
  paint();
}
for (const [i, prototype] of labEntries.entries()) {
  const option = document.createElement('option');
  option.value = String(i);
  option.textContent = prototype.title.en;
  $('mission').append(option);
}
$('mission').addEventListener('change', () => {
  if (remaster) $('mode').value = entry().prototypeMode;
  mount();
});
$('mode').addEventListener('change', mount);
$('language').addEventListener('change', translate);
$('look').addEventListener('change', () => mount({ retain: true }));
$('sound').addEventListener('click', () => {
  audioMaster.setMuted(!audioMaster.snapshot().muted);
  $('sound').setAttribute('aria-pressed', String(!audioMaster.snapshot().muted));
  if (!audioMaster.snapshot().muted) void sound.enable();
  translate();
});
$('retry').addEventListener('click', mount);
$('start').addEventListener('click', () => {
  generation++;
  playback(!playing);
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
  advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match), {
    onStep(event) {
      for (const card of cards)
        if (card.board === event.board)
          observeClassicWorldReactions(card.canvas, event.run, match, visualTime);
      audio.events(event.run, { board: `lab-${event.board}` });
      audio.update(event.run, { board: `lab-${event.board}`, mode: match.options.mode });
    },
  });
  if (match.status !== 'running') playing = false;
  paint();
}
$('proof').addEventListener('click', async () => {
  mount();
  const identity = generation;
  try {
    const draft = entry().level.id.startsWith('classic-operation-');
    const data = await (
      await fetch(
        draft
          ? CLASSIC_SNAKE_OPERATION_LEVELS_B.some((e) => e.id === entry().id)
            ? '../fixtures/classic-snake-operations-b-proofs.json'
            : '../fixtures/classic-snake-operations-a-proofs.json'
          : '../fixtures/classic-snake-v5-prototype-proofs.json',
      )
    ).json();
    if (generation !== identity) return;
    route = data.proofs
      .map((p) => p.replay ?? p)
      .find(
        (p) =>
          p.level.id === entry().level.id &&
          p.mode === (match.options.mode === 'team' ? 'team' : 'solo'),
      );
    if (!route) throw new Error('Missing qualification route');
    playback(true);
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
    playback(!playing);
    lastTime = performance.now();
    paint();
  }
});
document.addEventListener('visibilitychange', () => {
  generation++;
  playback(false);
  paint();
});
function frame(now) {
  if (playing) visualTime = (visualTime + Math.min(100, now - (previousFrame || now))) % 60000;
  previousFrame = now;
  if (playing && now - lastTime >= nextClassicSnakeMatchEventAt(match) - match.elapsedMs) {
    lastTime = now;
    step();
  }
  if (playing && now - lastPaint >= 33) {
    lastPaint = now;
    paint();
  }
  window.requestAnimationFrame(frame);
}
$('look').value = remaster ? 'comparison' : 'living-circuit';
mount();
window.requestAnimationFrame(frame);
