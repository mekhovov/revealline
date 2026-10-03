import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { createEncounterDisplayPreferences } from '../encounter-display-preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { createTouchPreferences } from '../touch-preferences.mjs';
import { createHuntDestruction } from '../hunt/destruction.mjs';
import { createBoardFootprints } from '../couch/board-footprint.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { Soundscape } from '../ui/audio.mjs';
import {
  CLASSIC_SNAKE_CHAPTERS,
  CLASSIC_SNAKE_LEVELS,
  CLASSIC_SNAKE_FEATURED,
  CLASSIC_SNAKE_CAMPAIGNS,
} from './classic-catalogue.mjs';
import { CLASSIC_COPY } from './classic-copy.mjs';
import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  classicSnakeSummary,
  exportClassicSnakeReplay,
} from './classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
  restoreClassicSnakeLegacyMatch,
} from './classic-match.mjs';
import { prepareClassicSnakeLevel, CLASSIC_PACES } from './classic-setup.mjs';
import { createClassicSnakeRecords } from './classic-records.mjs';
import { createClassicPresentation } from './classic-presentation.mjs';
import { classicCatchMarks, drawClassicBoard, drawClassicTarget } from './classic-view.mjs';

const doc = globalThis.document,
  $ = (id) => doc.getElementById(id);
const params = new URL(globalThis.location.href).searchParams;
const MODES = ['solo', 'versus', 'team'],
  PRESETS = ['classic', 'pursuit', 'tactical', 'arcade'];
const SAVE_KEY = 'revealline.classic-snake.round.v2',
  OLD_SAVE_KEY = 'revealline.classic-snake.round.v1';
const PREF_KEY = 'revealline.classic-snake.presentation.v1',
  SETUP_KEY = 'revealline.classic-snake.setup.v2';
const SESSION_FORMAT = 'revealline-classic-snake-session.v2';
const readLocal = (key) => {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const readObject = (key) => {
  try {
    return boundedJSON(readLocal(key) ?? '{}', { maxBytes: 2048, maxNodes: 40, maxDepth: 3 });
  } catch {
    return {};
  }
};
const selected = readObject(SETUP_KEY),
  cosmetic = readObject(PREF_KEY);
const choice = (values, value, fallback) => (values.includes(value) ? value : fallback);
let locale = getLocale() === 'uk' ? 'uk' : 'en';
let mode = choice(MODES, params.get('mode') ?? selected.mode, 'solo');
let pace = choice(Object.keys(CLASSIC_PACES), params.get('pace') ?? selected.pace, 'normal');
let format = choice(['campaign', 'endless'], params.get('activity') ?? selected.format, 'campaign');
let targetRules = choice(
  ['authored', 'moving'],
  params.get('targets') ?? selected.targetRules,
  'authored',
);
let preset = choice(PRESETS, params.get('preset') ?? selected.preset, 'classic');
let duel = choice(['score', 'survival'], params.get('duel') ?? selected.duel, 'score');
let style = choice(['cable', 'signal'], cosmetic.style, 'cable');
let steering = choice(['turns', 'dpad'], cosmetic.steering, 'turns');
let accent = typeof cosmetic.accent === 'string' ? cosmetic.accent : 'default';
let seed = Number(params.get('seed') ?? selected.seed ?? 17);
if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) seed = 17;
const requested = params.get('level') ?? selected.levelId;
let entry =
  CLASSIC_SNAKE_LEVELS.find(
    (item) => item.id === requested || item.id === `classic-${requested}`,
  ) ??
  CLASSIC_SNAKE_LEVELS[48] ??
  CLASSIC_SNAKE_LEVELS[0];
let match,
  runs = [],
  boards = [],
  footprint,
  ready = true,
  paused = true,
  previousFrame = null,
  importEpoch = 0;
let savedRound = readLocal(SAVE_KEY) ?? readLocal(OLD_SAVE_KEY),
  saveNotice = '',
  earlyFailures = 0;
let review = null,
  recordedMatch = null;
const gamepadState = new Map(),
  gamepadSeats = new Map();
const effects = [createHuntDestruction(), createHuntDestruction()];
const destruction = createDestructionPreferences(),
  remains = createEncounterDisplayPreferences();
const display = createDisplayPreferences();
const presentation = createClassicPresentation({ displayPreferences: display });
const audioMaster = createAudioMaster(),
  audioPreferences = createAudioPreferences({ audioMaster });
const sound = new Soundscape({ audioMaster });
sound.configure({
  master: 1,
  music: 0,
  sfx: Number.isFinite(cosmetic.sfx) ? Math.max(0, Math.min(1, cosmetic.sfx)) : 0.7,
});
const isReduced = () => display.snapshot().effectiveReducedEffects;
const text = (key, values = {}) =>
  Object.entries(values).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    CLASSIC_COPY[locale][key] ?? key,
  );
const el = (tag, value, className) => {
  const item = doc.createElement(tag);
  if (value) item.textContent = value;
  if (className) item.className = className;
  return item;
};
const options = (select, rows, value) => {
  select.replaceChildren(
    ...rows.map(([id, title]) => {
      const option = el('option', title);
      option.value = id;
      return option;
    }),
  );
  select.value = value;
};
const settings = () => ({ pace, format, targetRules, preset });
const acceptedLevel = () => prepareClassicSnakeLevel(entry, settings());
const result = () => match?.result ?? null;
const records = createClassicSnakeRecords({
  onChange: () => {
    if (match) {
      renderProgress();
      refresh();
    }
  },
  onWarning: (error) => {
    globalThis.console?.warn('Snake record storage:', error?.message ?? 'Unavailable');
    saveNotice = 'storage';
    $('save-status').textContent = text('storage');
  },
});
const touch = createTouchPreferences({ onChange: () => applyTouch() });
function applyTouch() {
  const prefs = touch.snapshot();
  $('pads').style.setProperty('--snake-pad-size', prefs.size === 'large' ? '64px' : '56px');
  $('pads').style.setProperty('--snake-pad-opacity', String(Math.max(0.75, prefs.opacity)));
  $('pads').dataset.side = prefs.side;
}
const campaignFor = (item) =>
  CLASSIC_SNAKE_CAMPAIGNS.find((campaign) =>
    (campaign.chapterIds ?? campaign.chapters ?? []).includes(item.chapterId),
  ) ?? CLASSIC_SNAKE_CAMPAIGNS[0];
const campaignChapters = (campaign) =>
  CLASSIC_SNAKE_CHAPTERS.filter((chapter) =>
    (campaign.chapterIds ?? campaign.chapters ?? []).includes(chapter.id),
  );
function storePresentation() {
  try {
    globalThis.localStorage.setItem(
      PREF_KEY,
      JSON.stringify({ style, steering, accent, sfx: sound.settings.sfx }),
    );
  } catch {
    saveNotice = 'storage';
  }
}
function updateURL() {
  const url = new URL(globalThis.location.href);
  for (const [key, value] of Object.entries({
    mode,
    level: entry.id,
    lang: locale,
    pace,
    activity: format,
    targets: targetRules,
    preset,
    duel,
    seed,
  }))
    url.searchParams.set(key, value);
  globalThis.history.replaceState(null, '', url);
  try {
    globalThis.localStorage.setItem(
      SETUP_KEY,
      JSON.stringify({ mode, levelId: entry.id, pace, format, targetRules, preset, duel, seed }),
    );
  } catch {
    /* Choices remain available through the link. */
  }
}
function session() {
  return {
    format: SESSION_FORMAT,
    activity: format,
    levelId: entry.id,
    mode,
    pace,
    targetRules,
    preset,
    duel,
    seed,
    style,
    match: exportClassicSnakeMatch(match),
  };
}
function save() {
  if (ready) return;
  try {
    const raw = JSON.stringify(session());
    globalThis.localStorage.setItem(SAVE_KEY, raw);
    savedRound = raw;
    saveNotice = 'saved';
  } catch {
    saveNotice = 'storage';
  }
  $('save-status').textContent = text(saveNotice);
  $('continue').hidden = !savedRound;
}
function remember() {
  if (!match || recordedMatch === match) return;
  if (result()) recordedMatch = match;
  try {
    const accepted = restoreClassicSnakeMatch(exportClassicSnakeMatch(match), {
      level: acceptedLevel(),
    });
    for (const run of accepted.runs)
      void records
        .remember(run, {
          mode,
          chapterId: entry.chapterId,
          level: acceptedLevel(),
          allowClear: format === 'campaign',
          policy: accepted.options.policy,
          match: exportClassicSnakeMatch(accepted),
        })
        .catch(() => {
          saveNotice = 'storage';
        });
  } catch {
    saveNotice = 'invalid';
  }
}
function pause() {
  if (ready || paused || result()) return;
  paused = true;
  sound.gameplayPaused = true;
  save();
  remember();
  refresh();
}
function start() {
  if (result()) return;
  if (ready) void records.visit(entry.id);
  importEpoch++;
  review = null;
  ready = false;
  paused = false;
  previousFrame = null;
  sound.gameplayPaused = false;
  void sound.enable();
  refresh();
  boards[0]?.canvas.focus({ preventScroll: true });
}
function finish() {
  paused = true;
  sound.gameplayPaused = true;
  earlyFailures = runs.every((run) => run.catches < 3) ? earlyFailures + 1 : 0;
  remember();
  save();
  refresh();
}
function turn(player, direction) {
  if (result() || review) return;
  if (ready) start();
  if (paused) return;
  queueClassicSnakeMatchTurn(match, player, direction);
  if (result()) finish();
  else refresh();
}
function relative(player, offset) {
  const run = runs[mode === 'versus' ? player : 0],
    snake = run?.snakes[mode === 'team' ? player : 0];
  if (!snake) return;
  const directions = ['up', 'right', 'down', 'left'],
    heading = snake.turns.at(-1) ?? snake.direction;
  turn(player, directions[(directions.indexOf(heading) + offset + 4) % 4]);
}
function prepare({ launch = false } = {}) {
  importEpoch++;
  review = null;
  recordedMatch = null;
  if (format === 'endless' && mode === 'versus' && duel === 'survival') {
    entry = CLASSIC_SNAKE_LEVELS[0];
    preset = 'classic';
    targetRules = 'authored';
  }
  for (const fx of effects) fx.reset();
  match = createClassicSnakeMatch(acceptedLevel(), {
    mode,
    seed,
    policy: format === 'campaign' ? 'mission' : mode === 'versus' ? duel : 'endless',
    durationMs: 180000,
    catchDeadlineMs: 30000,
  });
  runs = match.runs;
  ready = true;
  paused = true;
  previousFrame = null;
  buildBoards();
  renderCopy();
  refresh();
  updateURL();
  if (launch) start();
}
function buildBoards() {
  footprint?.dispose();
  $('boards').replaceChildren();
  boards = [];
  for (const [index, run] of runs.entries()) {
    const card = el('article', null, 'board-card'),
      stats = el('div', null, 'board-stats'),
      fields = {};
    for (const key of ['caught', 'length', 'score', 'best', 'clock', 'queued']) {
      const column = el('div'),
        label = el('span'),
        value = el('b');
      column.dataset.stat = key;
      column.append(label, value);
      stats.append(column);
      fields[key] = { label, value };
    }
    const wrap = el('div', null, 'board-wrap'),
      canvas = el('canvas');
    canvas.width = run.level.width * 28;
    canvas.height = run.level.height * 28;
    canvas.tabIndex = 0;
    const message = el('div', null, 'board-message'),
      title = el('strong'),
      detail = el('small');
    message.append(title, detail);
    wrap.append(canvas, message);
    card.append(stats, wrap);
    if (mode === 'versus') card.prepend(el('p', text(index ? 'p2' : 'p1'), 'player-label'));
    $('boards').append(card);
    boards.push({ canvas, fields, message, title, detail });
    let pointer = null;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || pointer) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12 || mode === 'team') return;
      turn(
        mode === 'versus' ? index : 0,
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
      );
    });
    for (const name of ['pointercancel', 'lostpointercapture'])
      canvas.addEventListener(name, () => {
        pointer = null;
      });
  }
  buildPads();
  footprint = createBoardFootprints(boards.map((board) => board.canvas));
  primeEffects();
}
function buildPads() {
  $('pads').replaceChildren();
  for (let player = 0; player < (mode === 'solo' ? 1 : 2); player++) {
    const group = el('div'),
      label = el('p', text(player ? 'p2' : 'p1'), 'pad-label'),
      pad = el('div', null, steering === 'turns' ? 'pad turn-pad' : 'pad');
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', label.textContent);
    const controls =
      steering === 'turns'
        ? [
            ['turnLeft', '↶'],
            ['turnRight', '↷'],
          ]
        : [
            ['up', '↑'],
            ['left', '←'],
            ['down', '↓'],
            ['right', '→'],
          ];
    for (const [direction, symbol] of controls) {
      const button = el('button', symbol);
      button.dataset.direction = direction;
      button.setAttribute('aria-label', `${label.textContent}: ${text(direction)}`);
      button.addEventListener('click', () =>
        steering === 'turns'
          ? relative(player, direction === 'turnLeft' ? -1 : 1)
          : turn(player, direction),
      );
      pad.append(button);
    }
    if (mode !== 'solo') group.append(label);
    group.append(pad);
    $('pads').append(group);
  }
  applyTouch();
  footprint?.refresh();
}
function renderProgress() {
  const chapterEntries = CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === entry.chapterId);
  for (const [index, item] of chapterEntries.entries()) {
    const option = $('mission').children[index];
    if (option?.value === item.id)
      option.textContent = `${records.cleared(item.id) ? '✓ ' : ''}${index + 1}. ${item.title[locale]}`;
  }
  $('progress-summary').textContent = text('progress', {
    done: records.chapter(chapterEntries),
    all: CLASSIC_SNAKE_LEVELS.filter((item) => records.cleared(item.id)).length,
  });
  const recent = CLASSIC_SNAKE_LEVELS.find((item) => item.id === records.recent()?.levelId);
  $('recent-level').hidden = !recent;
  $('recent-level').textContent = recent ? text('lastPlayed', { name: recent.title[locale] }) : '';
  const upcoming = nextUncleared();
  $('uncleared-level').hidden = !upcoming;
  $('uncleared-level').textContent = upcoming
    ? text('nextUncleared', { name: upcoming.title[locale] })
    : '';
  const unlocked = CLASSIC_SNAKE_CHAPTERS.filter(
    (chapter) =>
      records.chapter(CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === chapter.id)) === 6,
  );
  if (accent !== 'default' && !unlocked.some((chapter) => chapter.id === accent))
    accent = 'default';
  options(
    $('accent'),
    [
      ['default', text('defaultAccent')],
      ...unlocked.map((chapter) => [chapter.id, chapter.title[locale]]),
    ],
    accent,
  );
  const record = runs[0] && records.get(runs[0], mode, match.options.policy);
  $('record-summary').textContent = record
    ? text('recordDetail', {
        score: record.score,
        time: record.fastest
          ? text('seconds', { value: (record.fastest.value / 1000).toFixed(1) })
          : '—',
        moves: record.fewest?.value ?? '—',
      }) +
      (record.teamwork ? ` · ${text('teamwork')}` : '') +
      (record.noSupplies ? ` · ${text('noSupplies')}` : '')
    : text(format === 'endless' ? 'noEndlessRecord' : 'noRecord');
}
function nextUncleared() {
  return (
    CLASSIC_SNAKE_LEVELS.find(
      (item) => item.chapterId === entry.chapterId && !records.cleared(item.id),
    ) ?? CLASSIC_SNAKE_LEVELS.find((item) => !records.cleared(item.id))
  );
}
function renderCopy() {
  doc.documentElement.lang = locale;
  doc.title = `${text('title')} · FPV / LINE`;
  doc.body.dataset.mode = mode;
  for (const [selector, label] of [
    ['#mode-tabs', 'mode'],
    ['.setup:not(.variants):not(.progress-links)', 'setupLabel'],
    ['.variants', 'rulesLabel'],
    ['.progress-links', 'progressLabel'],
    ['.arena', 'arenaLabel'],
  ])
    doc.querySelector(selector)?.setAttribute('aria-label', text(label));
  for (const node of doc.querySelectorAll('[data-word]'))
    node.textContent = text(node.dataset.word);
  $('language').value = locale;
  for (const button of doc.querySelectorAll('#mode-tabs [data-mode]')) {
    button.textContent = text(button.dataset.mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  const campaign = campaignFor(entry);
  options(
    $('campaign'),
    CLASSIC_SNAKE_CAMPAIGNS.map((item) => [item.id, item.title[locale]]),
    campaign.id,
  );
  options(
    $('chapter'),
    campaignChapters(campaign).map((chapter) => [chapter.id, chapter.title[locale]]),
    entry.chapterId,
  );
  options(
    $('mission'),
    CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === entry.chapterId).map((item, i) => [
      item.id,
      `${records.cleared(item.id) ? '✓ ' : ''}${i + 1}. ${item.title[locale]}`,
    ]),
    entry.id,
  );
  for (const [id, value] of Object.entries({
    format,
    pace,
    'target-rules': targetRules,
    preset,
    duel,
    style,
    steering,
  })) {
    for (const option of $(id).options)
      option.textContent = text(
        id === 'duel' && option.value === 'score' ? 'scoreDuel' : option.value,
      );
    $(id).value = value;
  }
  $('preset-field').hidden = format !== 'endless';
  $('duel-field').hidden = format !== 'endless' || mode !== 'versus';
  const survival = format === 'endless' && mode === 'versus' && duel === 'survival';
  for (const id of ['mission', 'chapter', 'campaign', 'target-rules', 'preset'])
    $(id).disabled = survival;
  $('featured').hidden = format !== 'campaign';
  $('level-title').textContent = entry.title[locale];
  $('boundary').textContent = text(entry.level.wrap ? 'wrap' : 'walls');
  $('level-description').textContent = entry.description[locale];
  $('target-style').textContent = text(
    targetRules === 'moving'
      ? 'fleeing'
      : runs[0].level.version.endsWith('v2')
        ? 'modernTargets'
        : entry.level.targetMovement === 'flee'
          ? 'fleeing'
          : 'stationary',
  );
  $('mode-help').textContent =
    format === 'endless'
      ? text(
          mode === 'versus' ? (duel === 'survival' ? 'survivalHelp' : 'scoreHelp') : 'endlessHelp',
        )
      : mode === 'team'
        ? text('teamHelp')
        : mode === 'versus'
          ? text('vsHelp')
          : '';
  $('controls-help').textContent = text(mode === 'solo' ? 'controls' : 'twoControls');
  for (const id of ['restart', 'next']) $(id).textContent = text(id);
  $('home-link').textContent = text('home');
  $('campaign-link').textContent = text('campaigns');
  $('campaign-link').href = `./?lang=${locale}`;
  $('remix-link').href =
    `${mode === 'solo' ? '../' : mode === 'versus' ? '../couch/' : '../couch/relay-rescue.html'}?journey=snake-hunt-v1&snake-style=capture&lang=${locale}`;
  $('seed-label').textContent = text('seed', { seed });
  $('save-status').textContent = saveNotice ? text(saveNotice) : '';
  $('continue').hidden = !savedRound;
  const icon = $('target-icon').getContext('2d');
  icon.clearRect(0, 0, 64, 64);
  drawClassicTarget(icon, 0, 0, 64);
  boards.forEach(({ canvas, fields }, i) => {
    canvas.setAttribute(
      'aria-label',
      `${text('title')}: ${entry.title[locale]}. ${mode === 'versus' ? text(i ? 'p2' : 'p1') : ''} ${text('readyHelp')}`,
    );
    for (const key of Object.keys(fields)) fields[key].label.textContent = text(key);
  });
  renderProgress();
}
function failureText(run, boardResult) {
  const cause = boardResult?.cause ?? run.failure?.cause;
  const key = {
    wall: 'wallCrash',
    body: 'bodyCrash',
    'partner-body': 'partnerCrash',
    'head-on': 'headCrash',
    'head-swap': 'headCrash',
    'catch-deadline': 'catchDeadline',
    'step-limit': 'limit',
    'input-limit': 'limit',
  }[cause];
  if (!key) return '';
  const detail = text(key);
  if (mode !== 'team' || !run.failure?.players?.length) return detail;
  return run.failure.players
    .map(
      ({ playerId, cause: playerCause }) =>
        `${text(playerId ? 'p2' : 'p1')}: ${failureText({ failure: { cause: playerCause } }, null)}`,
    )
    .join(' ');
}
function refresh() {
  if (!match) return;
  const outcome = result();
  doc.body.dataset.playing = String(!ready && !paused);
  $('toggle').textContent = text(ready ? 'start' : paused ? 'resume' : 'pause');
  $('toggle').hidden = !!outcome;
  $('next').hidden = format !== 'campaign' || !runs.some((run) => run.status === 'won');
  $('review').hidden = !outcome || !runs.some((run) => run.tick > 0);
  $('slow-offer').hidden = !outcome || earlyFailures < 3 || pace === 'slow';
  $('speed-note').textContent = text('step', {
    ms: runs.map((run) => classicSnakeSummary(run).stepMs).join(' / '),
  });
  const title =
    outcome === 'p1' || outcome === 'p2'
      ? text('winner', { player: outcome === 'p1' ? 1 : 2 })
      : text(outcome ?? (ready ? 'ready' : 'paused'));
  $('announcement').textContent = review
    ? text('reviewPlaying')
    : outcome === 'lost'
      ? failureText(runs[0], match.boardResults[0]) || title
      : outcome
        ? title
        : ready
          ? text('readyHelp')
          : paused
            ? text('paused')
            : '';
  boards.forEach((board, i) => {
    const run = runs[i],
      summary = classicSnakeSummary(run),
      boardResult = match.boardResults[i];
    board.fields.caught.value.textContent =
      format === 'endless' ? String(summary.catches) : `${summary.catches} / ${summary.goal}`;
    board.fields.length.value.textContent = summary.lengths.join(' + ');
    board.fields.score.value.textContent = String(summary.score);
    board.fields.best.value.textContent = String(
      records.get(run, mode, match.options.policy)?.score ?? 0,
    );
    const clock =
      format === 'endless' && mode === 'versus'
        ? Math.max(
            0,
            duel === 'survival' && !boardResult
              ? match.lastCatchAt[i] + 30000 - match.elapsedMs
              : 180000 - match.elapsedMs,
          )
        : match.elapsedMs;
    board.fields.clock.value.textContent = `${Math.floor(clock / 60000)}:${String(Math.floor(clock / 1000) % 60).padStart(2, '0')}`;
    board.fields.queued.value.textContent = run.snakes
      .map(
        (snake) =>
          snake.turns
            .map((direction) => ({ up: '↑', down: '↓', left: '←', right: '→' })[direction])
            .join('') || '·',
      )
      .join(' / ');
    board.message.hidden = !!review || (!ready && !paused && !outcome && !boardResult);
    board.title.textContent = boardResult?.status === 'lost' && !outcome ? text('lost') : title;
    const reason = failureText(run, boardResult);
    board.detail.textContent = reason
      ? `${reason}${!outcome && boardResult ? ` ${text('otherPilotFlying')}` : ''}`
      : outcome
        ? run.status === 'won'
          ? text('winHelp')
          : text('restart')
        : ready
          ? text('start')
          : text('resume');
  });
}
function restore(raw) {
  importEpoch++;
  try {
    const source = boundedJSON(raw, {
      maxBytes: 8 * 1024 * 1024,
      maxNodes: 360000,
      maxArray: 32768,
      maxDepth: 14,
    });
    const item = CLASSIC_SNAKE_LEVELS.find((candidate) => candidate.id === source.levelId);
    required(
      item && MODES.includes(source.mode) && Object.hasOwn(CLASSIC_PACES, source.pace),
      'Unsupported round.',
    );
    let restored, next;
    if (source.format === 'revealline-classic-snake-session.v1') {
      exactKeys(
        source,
        ['format', 'levelId', 'mode', 'pace', 'elapsedMs', 'replays'],
        'Classic Snake legacy session',
      );
      next = {
        pace: source.pace,
        format: 'campaign',
        targetRules: 'authored',
        preset: 'classic',
        duel: 'score',
        seed: 17,
        style,
      };
      restored = restoreClassicSnakeLegacyMatch(
        { replays: source.replays, elapsedMs: source.elapsedMs, mode: source.mode },
        { level: prepareClassicSnakeLevel(item, next) },
      );
      next.seed = restored.options.seed;
    } else {
      exactKeys(
        source,
        [
          'format',
          'activity',
          'levelId',
          'mode',
          'pace',
          'targetRules',
          'preset',
          'duel',
          'seed',
          'style',
          'match',
        ],
        'Classic Snake session',
      );
      required(
        source.format === SESSION_FORMAT && ['campaign', 'endless'].includes(source.activity),
        'Unsupported session.',
      );
      next = {
        pace: source.pace,
        format: source.activity,
        targetRules: source.targetRules,
        preset: source.preset,
        duel: source.duel,
        seed: source.seed,
        style: source.style,
      };
      required(
        ['authored', 'moving'].includes(next.targetRules) &&
          PRESETS.includes(next.preset) &&
          ['score', 'survival'].includes(next.duel) &&
          ['cable', 'signal'].includes(next.style) &&
          Number.isSafeInteger(next.seed) &&
          next.seed >= 0 &&
          next.seed <= 0xffffffff,
        'Invalid setup.',
      );
      restored = restoreClassicSnakeMatch(source.match, {
        level: prepareClassicSnakeLevel(item, next),
      });
      const policy =
        next.format === 'campaign' ? 'mission' : source.mode === 'versus' ? next.duel : 'endless';
      required(
        restored.options.mode === source.mode &&
          restored.options.seed === next.seed &&
          restored.options.policy === policy,
        'Round ownership mismatch.',
      );
    }
    entry = item;
    mode = source.mode;
    ({ pace, format, targetRules, preset, duel, seed, style } = next);
    match = restored;
    runs = match.runs;
    ready = false;
    paused = true;
    previousFrame = null;
    review = null;
    recordedMatch = null;
    sound.gameplayPaused = true;
    for (const fx of effects) fx.reset();
    buildBoards();
    renderCopy();
    refresh();
    updateURL();
    saveNotice = result() ? 'loadedComplete' : 'loaded';
    $('save-status').textContent = text(saveNotice);
    if (result()) remember();
    $(result() ? 'restart' : 'toggle').focus({ preventScroll: true });
  } catch {
    saveNotice = 'invalid';
    $('save-status').textContent = text('invalid');
  }
}
function primeEffects() {
  const choice = destruction.snapshot();
  $('brutal').checked = choice.brutal;
  $('blood').checked = choice.blood;
  $('blood').disabled = !choice.brutal;
  $('remains').checked = remains.snapshot().showRemains;
  $('reduced').checked = display.snapshot().reducedEffects;
  effects.forEach((fx, i) => {
    fx.reset();
    if (runs[i])
      fx.advance({ valid: true, eliminations: classicCatchMarks(runs[i]) }, 0, {
        key: runs[i],
        ...choice,
        paused: true,
        reduced: isReduced(),
      });
  });
}
function watchReview() {
  const frames = runs.map((run) => {
    const replay = exportClassicSnakeReplay(run),
      copy = createClassicSnake(replay.level, { mode: replay.mode, seed: replay.seed });
    const snapshots = [];
    let cursor = 0;
    for (let tick = 0; tick <= replay.steps; tick++) {
      while (replay.turns[cursor]?.tick === tick) {
        const command = replay.turns[cursor++];
        queueClassicSnakeTurn(copy, command.playerId, command.direction);
      }
      if (tick >= Math.max(0, replay.steps - 8)) snapshots.push(structuredClone(copy));
      if (tick < replay.steps) stepClassicSnake(copy);
    }
    return snapshots;
  });
  review = { frames, time: 0 };
  refresh();
}

destruction.subscribe(primeEffects);
remains.subscribe(primeEffects);
display.subscribe(primeEffects);
$('brutal').addEventListener('change', () => destruction.set({ brutal: $('brutal').checked }));
$('blood').addEventListener('change', () => destruction.set({ blood: $('blood').checked }));
$('remains').addEventListener('change', () => remains.set($('remains').checked));
$('reduced').addEventListener('change', () =>
  display.set({ reducedEffects: $('reduced').checked }),
);
audioMaster.subscribe((state) => {
  $('muted').checked = state.muted;
  $('volume').value = state.volume;
});
$('effects-volume').value = sound.settings.sfx;
$('muted').addEventListener('change', () => {
  audioPreferences.setMuted($('muted').checked);
  if (!$('muted').checked) void sound.enable();
});
$('volume').addEventListener('input', () => audioPreferences.setVolume(Number($('volume').value)));
$('effects-volume').addEventListener('input', () => {
  sound.configure({ sfx: Number($('effects-volume').value) });
  storePresentation();
});
$('style').addEventListener('change', () => {
  style = $('style').value;
  storePresentation();
});
$('steering').addEventListener('change', () => {
  pause();
  steering = $('steering').value;
  storePresentation();
  buildPads();
});
$('accent').addEventListener('change', () => {
  accent = $('accent').value;
  storePresentation();
});
$('language').addEventListener('change', () => {
  pause();
  setLocale($('language').value);
});
onLocaleChange(() => {
  locale = getLocale() === 'uk' ? 'uk' : 'en';
  buildBoards();
  renderCopy();
  refresh();
  updateURL();
});
for (const button of doc.querySelectorAll('#mode-tabs [data-mode]'))
  button.addEventListener('click', () => {
    save();
    mode = button.dataset.mode;
    prepare();
  });
for (const id of ['format', 'pace', 'target-rules', 'preset', 'duel'])
  $(id).addEventListener('change', () => {
    save();
    format = $('format').value;
    pace = $('pace').value;
    targetRules = $('target-rules').value;
    preset = $('preset').value;
    duel = $('duel').value;
    prepare();
  });
$('campaign').addEventListener('change', () => {
  save();
  const campaign = CLASSIC_SNAKE_CAMPAIGNS.find((item) => item.id === $('campaign').value);
  entry = CLASSIC_SNAKE_LEVELS.find((item) =>
    (campaign.chapterIds ?? campaign.chapters).includes(item.chapterId),
  );
  prepare();
});
$('chapter').addEventListener('change', () => {
  save();
  entry = CLASSIC_SNAKE_LEVELS.find((item) => item.chapterId === $('chapter').value);
  prepare();
});
$('mission').addEventListener('change', () => {
  save();
  entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === $('mission').value);
  prepare();
});
$('toggle').addEventListener('click', () => (paused || ready ? start() : pause()));
$('restart').addEventListener('click', () => prepare({ launch: true }));
for (const id of ['recent-level', 'uncleared-level'])
  $(id).addEventListener('click', () => {
    const destination =
      id === 'uncleared-level'
        ? nextUncleared()
        : CLASSIC_SNAKE_LEVELS.find((item) => item.id === records.recent()?.levelId);
    if (!destination) return;
    save();
    entry = destination;
    format = 'campaign';
    prepare();
  });
$('next').addEventListener('click', () => {
  const same = CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === entry.chapterId);
  entry =
    same.find((item) => !records.cleared(item.id) && item.id !== entry.id) ??
    CLASSIC_SNAKE_LEVELS[(CLASSIC_SNAKE_LEVELS.indexOf(entry) + 1) % CLASSIC_SNAKE_LEVELS.length];
  prepare();
});
$('featured').addEventListener('click', () => {
  save();
  const sortie = CLASSIC_SNAKE_FEATURED.find((item) => item.chapterId === entry.chapterId);
  entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === sortie.levelId);
  seed = sortie.seed;
  targetRules = 'authored';
  prepare();
});
$('new-route').addEventListener('click', () => {
  save();
  seed = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  prepare();
});
$('slow-offer').addEventListener('click', () => {
  pace = 'slow';
  prepare({ launch: true });
});
$('review').addEventListener('click', watchReview);
$('continue').addEventListener('click', () => {
  if (savedRound) restore(savedRound);
});
$('export').addEventListener('click', () => {
  pause();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(session(), null, 2)], { type: 'application/json' }),
  );
  const link = el('a');
  link.href = url;
  link.download = `${entry.id}-${mode}.json`;
  doc.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').addEventListener('change', async () => {
  pause();
  const file = $('import').files[0],
    ticket = ++importEpoch;
  try {
    if (!file || file.size > 8 * 1024 * 1024) throw new Error('Size');
    const raw = await file.text();
    if (ticket === importEpoch) restore(raw);
  } catch {
    if (ticket === importEpoch) $('save-status').textContent = text('invalid');
  }
  $('import').value = '';
});
doc.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.repeat) {
    event.preventDefault();
    pause();
    return;
  }
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.isComposing ||
    event.target.closest?.('input,select,textarea,summary,a')
  )
    return;
  const key =
    { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyP: 'p', KeyR: 'r' }[event.code] ??
    event.key.toLowerCase();
  if ([' ', 'p', 'r'].includes(key)) {
    if (key === ' ' && event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    if (event.repeat) return;
    if (key === 'r' && result()) prepare({ launch: true });
    else if (key !== 'r') {
      if (ready || paused) start();
      else pause();
    }
    return;
  }
  const direction = {
    arrowup: 'up',
    arrowright: 'right',
    arrowdown: 'down',
    arrowleft: 'left',
    w: 'up',
    d: 'right',
    s: 'down',
    a: 'left',
  }[key];
  if (!direction) return;
  event.preventDefault();
  if (!event.repeat) turn(mode !== 'solo' && key.startsWith('arrow') ? 1 : 0, direction);
});
function pollGamepads() {
  const pads = Array.from(globalThis.navigator.getGamepads?.() ?? []).filter(Boolean),
    present = new Set();
  for (const pad of pads) {
    present.add(pad.index);
    if (!gamepadSeats.has(pad.index)) {
      const free = [0, ...(mode === 'solo' ? [] : [1])].find(
        (seat) => ![...gamepadSeats.values()].includes(seat),
      );
      if (free === undefined) continue;
      gamepadSeats.set(pad.index, free);
    }
    const seat = gamepadSeats.get(pad.index);
    if (mode === 'solo' && seat !== 0) continue;
    const buttons = [
      pad.buttons[12]?.pressed || pad.axes[1] < -0.55,
      pad.buttons[15]?.pressed || pad.axes[0] > 0.55,
      pad.buttons[13]?.pressed || pad.axes[1] > 0.55,
      pad.buttons[14]?.pressed || pad.axes[0] < -0.55,
      pad.buttons[9]?.pressed,
    ];
    const previous = gamepadState.get(pad.index);
    gamepadState.set(pad.index, buttons);
    if (!previous) continue;
    if (buttons[4] && !previous[4]) {
      if (ready || paused) start();
      else pause();
    }
    for (let i = 0; i < 4; i++)
      if (buttons[i] && !previous[i]) {
        turn(seat, ['up', 'right', 'down', 'left'][i]);
        break;
      }
  }
  for (const id of gamepadState.keys())
    if (!present.has(id)) {
      gamepadState.delete(id);
      gamepadSeats.delete(id);
      pause();
    }
}
doc.querySelectorAll('aside details').forEach((details) =>
  details.addEventListener('toggle', () => {
    if (details.open) pause();
  }),
);
doc.addEventListener('visibilitychange', () => {
  if (doc.hidden) pause();
});
globalThis.addEventListener('blur', pause);
globalThis.addEventListener('focus', () => {
  void records.read();
});
globalThis.screen.orientation?.addEventListener('change', () => {
  pause();
  footprint?.refresh();
});
// A resized window can change the touch layout without a device orientation event.
const landscapeControls = globalThis.matchMedia?.(
  '(max-height: 600px) and (orientation: landscape)',
);
landscapeControls?.addEventListener('change', () => {
  pause();
  footprint?.refresh();
});
globalThis.addEventListener('pagehide', () => {
  importEpoch++;
  pause();
  save();
});
globalThis.addEventListener('pageshow', () => footprint?.refresh());
function frame(now) {
  const elapsed = previousFrame === null ? 0 : Math.max(0, now - previousFrame);
  previousFrame = now;
  pollGamepads();
  if (!ready && !paused && !result()) {
    if (elapsed > 1000 || doc.hidden) pause();
    else {
      const before = runs.map((run) => run.catches + (run.bonusCatches ?? 0));
      advanceClassicSnakeMatchTo(match, match.elapsedMs + Math.min(250, elapsed));
      runs.forEach((run, i) => {
        if (run.catches + (run.bonusCatches ?? 0) > before[i])
          sound.feedbackDirector.play('pickup', {
            board: `snake-${i}`,
            pan: mode === 'versus' ? (i ? 0.5 : -0.5) : 0,
          });
      });
      if (result()) {
        sound.feedbackDirector.play(
          runs.some((run) => run.status === 'lost') ? 'contact-stone' : 'confirm',
        );
        finish();
      }
      refresh();
    }
  }
  if (review) {
    review.time += Math.min(elapsed, 250);
    if (review.time > 2200) {
      review = null;
      refresh();
    }
  }
  runs.forEach((run, i) => {
    const choice = destruction.snapshot();
    effects[i].advance(
      { valid: true, eliminations: classicCatchMarks(run) },
      Math.min(0.1, elapsed / 1000),
      {
        key: run,
        ...choice,
        paused: ready || (paused && !result()),
        reduced: isReduced(),
        sources: run.snakes.map((snake) => ({
          ...snake.body[0],
          id: snake.id,
          direction: snake.direction,
        })),
      },
    );
    const shown = review
      ? review.frames[i][Math.min(review.frames[i].length - 1, Math.floor(review.time / 240))]
      : run;
    drawClassicBoard(boards[i].canvas, shown, {
      effects: review ? null : effects[i],
      ...choice,
      showRemains: remains.snapshot().showRemains,
      style,
      presentation: presentation.snapshot(),
      accent,
      reduced: isReduced(),
    });
  });
  globalThis.requestAnimationFrame(frame);
}
prepare();
void records.read();
$('boot-status').hidden = true;
$('game').hidden = false;
footprint.refresh();
globalThis.RevealLineToolLaunch?.attached?.();
globalThis.requestAnimationFrame(frame);
