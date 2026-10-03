import { getLocale, setLocale, onLocaleChange } from '../i18n/index.mjs';
import { boundedJSON, exactKeys } from '../data-json.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { createEncounterDisplayPreferences } from '../encounter-display-preferences.mjs';
import { createHuntDestruction } from '../hunt/destruction.mjs';
import { CLASSIC_SNAKE_CHAPTERS, CLASSIC_SNAKE_LEVELS } from './classic-catalogue.mjs';
import { CLASSIC_COPY } from './classic-copy.mjs';
import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  classicSnakeSummary,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from './classic-core.mjs';
import { classicCatchMarks, drawClassicBoard, drawClassicTarget } from './classic-view.mjs';

const doc = globalThis.document;
const $ = (id) => doc.getElementById(id);
const params = new URL(globalThis.location.href).searchParams;
const MODES = ['solo', 'versus', 'team'];
const PACES = { slow: 1.4, normal: 1, fast: 0.75 };
const SAVE_KEY = 'revealline.classic-snake.round.v1';
const BEST_KEY = 'revealline.classic-snake.records.v1';
const SESSION_FORMAT = 'revealline-classic-snake-session.v1';
let locale = getLocale() === 'uk' ? 'uk' : 'en';
let mode = MODES.includes(params.get('mode')) ? params.get('mode') : 'solo';
let pace = 'normal';
let entry =
  CLASSIC_SNAKE_LEVELS.find(
    (item) => item.id === params.get('level') || item.id === `classic-${params.get('level')}`,
  ) ?? CLASSIC_SNAKE_LEVELS[0];
let runs = [],
  boards = [],
  ready = true,
  paused = true,
  elapsedMs = 0,
  importEpoch = 0,
  previousFrame = null;
let recordsWritable = true;
let savedRound = null,
  records = {},
  saveNotice = '',
  reduced = false;
const effects = [createHuntDestruction(), createHuntDestruction()];
const destruction = createDestructionPreferences();
const remains = createEncounterDisplayPreferences();
const media = globalThis.matchMedia('(prefers-reduced-motion: reduce)');
const isReduced = () => reduced || media.matches;
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
try {
  savedRound = globalThis.localStorage.getItem(SAVE_KEY);
} catch {
  saveNotice = 'storage';
  recordsWritable = false;
}
try {
  const raw = globalThis.localStorage.getItem(BEST_KEY);
  if (raw) {
    const source = boundedJSON(raw, { maxBytes: 64 * 1024, maxNodes: 2500, maxDepth: 2 });
    if (
      source &&
      typeof source === 'object' &&
      !Array.isArray(source) &&
      Object.values(source).every((n) => Number.isInteger(n) && n >= 0 && n <= 12800)
    )
      records = source;
    else throw new Error('Unsupported records');
  }
} catch {
  saveNotice = 'storage';
  recordsWritable = false;
}

function acceptedLevel(item = entry, speed = pace) {
  const source = structuredClone(item.level);
  source.stepMs = Math.min(300, Math.max(80, Math.round(source.stepMs * PACES[speed])));
  source.minStepMs = Math.min(
    source.stepMs,
    Math.max(60, Math.round(source.minStepMs * PACES[speed])),
  );
  return source;
}
function result() {
  if (!runs.length) return null;
  if (mode !== 'versus') return runs[0].status === 'running' ? null : runs[0].status;
  const [a, b] = runs.map((run) => run.status);
  if (a === 'running' && b === 'running') return null;
  if (a === b) return 'draw';
  if (a === 'won' || b === 'lost') return 'p1';
  return 'p2';
}
function session() {
  return {
    format: SESSION_FORMAT,
    levelId: entry.id,
    mode,
    pace,
    elapsedMs,
    replays: runs.map(exportClassicSnakeReplay),
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
function rememberScore() {
  for (const run of runs) {
    const id = `${mode}/${run.levelIdentity}`;
    records[id] = Math.max(records[id] ?? 0, run.score);
  }
  try {
    if (!recordsWritable) throw new Error('Unsupported saved records');
    globalThis.localStorage.setItem(BEST_KEY, JSON.stringify(records));
  } catch {
    saveNotice = 'storage';
  }
}
function pause() {
  if (ready || paused || result()) return;
  paused = true;
  save();
  refresh();
}
function start() {
  importEpoch++;
  if (result()) return;
  ready = false;
  paused = false;
  previousFrame = null;
  refresh();
  boards[0]?.canvas.focus({ preventScroll: true });
}
function turn(player, direction) {
  if (result()) return;
  if (ready) start();
  if (paused) return;
  const run = runs[mode === 'versus' ? player : 0];
  if (!run) return;
  if (queueClassicSnakeTurn(run, mode === 'team' ? player : 0, direction) && result()) {
    // The accepted-input bound can finish between scheduled moves. Preserve
    // this host clock position and finalize exactly as for a grid-step result.
    paused = true;
    rememberScore();
    save();
    refresh();
  }
}

function prepare() {
  importEpoch++;
  elapsedMs = 0;
  for (const fx of effects) fx.reset();
  const definition = acceptedLevel();
  runs = Array.from({ length: mode === 'versus' ? 2 : 1 }, () =>
    createClassicSnake(definition, { mode: mode === 'team' ? 'team' : 'solo', seed: 17 }),
  );
  ready = true;
  paused = true;
  previousFrame = null;
  buildBoards();
  renderCopy();
  refresh();
  updateURL();
}
function updateURL() {
  const url = new URL(globalThis.location.href);
  url.searchParams.set('mode', mode);
  url.searchParams.set('level', entry.id);
  url.searchParams.set('lang', locale);
  globalThis.history.replaceState(null, '', url);
}
function buildBoards() {
  $('boards').replaceChildren();
  boards = [];
  runs.forEach((run, index) => {
    const card = el('article', null, 'board-card'),
      stats = el('div', null, 'board-stats');
    const fields = {};
    for (const key of ['caught', 'length', 'score', 'best']) {
      const column = el('div'),
        label = el('span'),
        value = el('b');
      column.append(label, value);
      stats.append(column);
      fields[key] = { label, value };
    }
    const wrap = el('div', null, 'board-wrap'),
      canvas = el('canvas');
    canvas.tabIndex = 0;
    const message = el('div', null, 'board-message'),
      title = el('strong'),
      detail = el('small');
    message.append(title, detail);
    wrap.append(canvas, message);
    card.append(stats, wrap);
    if (mode === 'versus') {
      const label = el('p', null, 'player-label');
      label.textContent = text(index ? 'p2' : 'p1');
      card.prepend(label);
    }
    $('boards').append(card);
    boards.push({ canvas, fields, message, title, detail });
    let pointer = null;
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x,
        dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      turn(
        mode === 'versus' ? index : 0,
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
      );
    });
    canvas.addEventListener('pointercancel', () => {
      pointer = null;
    });
    effects[index].advance({ valid: true, eliminations: classicCatchMarks(run) }, 0, {
      key: run,
      ...destruction.snapshot(),
      paused: true,
      reduced: isReduced(),
    });
  });
  $('pads').replaceChildren();
  for (let player = 0; player < (mode === 'solo' ? 1 : 2); player++) {
    const group = el('div'),
      label = el('p', text(player ? 'p2' : 'p1'), 'pad-label'),
      pad = el('div', null, 'pad');
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', label.textContent);
    for (const [direction, symbol] of [
      ['up', '↑'],
      ['left', '←'],
      ['down', '↓'],
      ['right', '→'],
    ]) {
      const button = el('button', symbol);
      button.dataset.direction = direction;
      button.setAttribute('aria-label', `${label.textContent}: ${text(direction)}`);
      button.addEventListener('click', () => turn(player, direction));
      pad.append(button);
    }
    if (mode !== 'solo') group.append(label);
    group.append(pad);
    $('pads').append(group);
  }
}
function options(select, rows, value) {
  select.replaceChildren(
    ...rows.map(([id, title]) => {
      const option = el('option', title);
      option.value = id;
      return option;
    }),
  );
  select.value = value;
}
function renderCopy() {
  doc.documentElement.lang = locale;
  doc.title = `${text('title')} · FPV / LINE`;
  doc.body.dataset.mode = mode;
  for (const node of doc.querySelectorAll('[data-word]'))
    node.textContent = text(node.dataset.word);
  $('language').value = locale;
  for (const button of doc.querySelectorAll('#mode-tabs [data-mode]')) {
    button.textContent = text(button.dataset.mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  options(
    $('chapter'),
    CLASSIC_SNAKE_CHAPTERS.map((chapter) => [chapter.id, chapter.title[locale]]),
    entry.chapterId,
  );
  options(
    $('mission'),
    CLASSIC_SNAKE_LEVELS.filter((item) => item.chapterId === entry.chapterId).map((item, i) => [
      item.id,
      `${i + 1}. ${item.title[locale]}`,
    ]),
    entry.id,
  );
  for (const option of $('pace').options) option.textContent = text(option.value);
  $('pace').value = pace;
  $('mode-tabs').setAttribute('aria-label', text('mode'));
  $('level-title').textContent = entry.title[locale];
  $('boundary').textContent = text(entry.level.wrap ? 'wrap' : 'walls');
  $('level-description').textContent = entry.description[locale];
  $('target-style').textContent = text(
    entry.level.targetMovement === 'flee' ? 'fleeing' : 'stationary',
  );
  $('mode-help').textContent =
    mode === 'team' ? text('teamHelp') : mode === 'versus' ? text('vsHelp') : '';
  $('controls-help').textContent = text(mode === 'solo' ? 'controls' : 'twoControls');
  $('restart').textContent = text('restart');
  $('next').textContent = text('next');
  $('home-link').textContent = text('home');
  $('campaign-link').textContent = text('campaigns');
  $('campaign-link').href = `./?lang=${locale}`;
  $('remix-link').href =
    `${mode === 'solo' ? '../' : mode === 'versus' ? '../couch/' : '../couch/relay-rescue.html'}?journey=snake-hunt-v1&snake-style=capture&lang=${locale}`;
  $('save-status').textContent = saveNotice ? text(saveNotice) : '';
  $('continue').hidden = !savedRound;
  const icon = $('target-icon').getContext('2d');
  icon.clearRect(0, 0, 64, 64);
  drawClassicTarget(icon, 0, 0, 64);
  boards.forEach(({ canvas, fields }, i) => {
    canvas.setAttribute(
      'aria-label',
      `${text('title')}: ${entry.title[locale]}. ${mode === 'versus' ? text(i ? 'p2' : 'p1') + '. ' : ''}${text('readyHelp')} ${text(mode === 'solo' ? 'controls' : 'twoControls')}`,
    );
    for (const key of Object.keys(fields)) fields[key].label.textContent = text(key);
  });
}
function refresh() {
  const outcome = result();
  doc.body.dataset.playing = String(!ready && !paused);
  $('toggle').textContent = text(ready ? 'start' : paused ? 'resume' : 'pause');
  $('toggle').disabled = !!outcome;
  $('toggle').hidden = !!outcome;
  $('next').hidden = !(
    outcome === 'won' ||
    outcome === 'p1' ||
    outcome === 'p2' ||
    (outcome === 'draw' && runs.some((run) => run.status === 'won'))
  );
  $('speed-note').textContent = text('step', {
    ms: runs.map((run) => classicSnakeSummary(run).stepMs).join(' / '),
  });
  const title =
    outcome === 'p1' || outcome === 'p2'
      ? text('winner', { player: outcome === 'p1' ? 1 : 2 })
      : text(outcome ?? (ready ? 'ready' : 'paused'));
  $('announcement').textContent = outcome
    ? outcome === 'lost'
      ? text(
          ['step-limit', 'input-limit'].includes(runs[0].failure?.cause)
            ? 'limit'
            : runs[0].failure?.cause === 'wall'
              ? 'wallCrash'
              : 'bodyCrash',
        )
      : title
    : ready
      ? text('readyHelp')
      : paused
        ? text('paused')
        : '';
  boards.forEach((board, i) => {
    const run = runs[i],
      summary = classicSnakeSummary(run);
    board.fields.caught.value.textContent = `${summary.catches} / ${summary.goal}`;
    board.fields.length.value.textContent = summary.lengths.join(' + ');
    board.fields.score.value.textContent = String(summary.score);
    board.fields.best.value.textContent = String(records[`${mode}/${run.levelIdentity}`] ?? 0);
    board.message.hidden = !ready && !paused && !outcome;
    board.title.textContent = title;
    board.detail.textContent = outcome
      ? outcome === 'won' || run.status === 'won'
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
      maxBytes: 4 * 1024 * 1024,
      maxNodes: 170000,
      maxArray: 16384,
      maxDepth: 9,
    });
    exactKeys(
      source,
      ['format', 'levelId', 'mode', 'pace', 'elapsedMs', 'replays'],
      'Classic Snake session',
    );
    const item = CLASSIC_SNAKE_LEVELS.find((candidate) => candidate.id === source.levelId);
    if (
      source.format !== SESSION_FORMAT ||
      !item ||
      !MODES.includes(source.mode) ||
      !Object.hasOwn(PACES, source.pace) ||
      !Array.isArray(source.replays) ||
      source.replays.length !== (source.mode === 'versus' ? 2 : 1)
    )
      throw new Error('Unsupported round.');
    const restored = source.replays.map((record) =>
      restoreClassicSnakeReplay(record, { level: acceptedLevel(item, source.pace) }),
    );
    const terminal = restored.filter((run) => run.status !== 'running');
    const inputLimited = terminal.filter((run) => run.failure?.cause === 'input-limit');
    if (
      restored.some(
        (run) => run.seed !== 17 || run.mode !== (source.mode === 'team' ? 'team' : 'solo'),
      ) ||
      !Number.isFinite(source.elapsedMs) ||
      source.elapsedMs < Math.max(...restored.map((run) => run.elapsedMs)) ||
      source.elapsedMs >=
        Math.min(...restored.map((run) => run.elapsedMs + classicSnakeSummary(run).stepMs)) ||
      // Grid results occur at their exact scheduled time. An input-limit result
      // can occur between moves, but it ends the match immediately: no second
      // board may already have a result when that input is accepted.
      (inputLimited.length > 0 && terminal.length !== 1) ||
      (inputLimited.length === 0 &&
        terminal.length > 0 &&
        source.elapsedMs !== Math.min(...terminal.map((run) => run.elapsedMs)))
    )
      throw new Error('Inconsistent round.');
    // Finish validation before replacing any live state or saved data.
    for (const fx of effects) fx.reset();
    entry = item;
    mode = source.mode;
    pace = source.pace;
    runs = restored;
    elapsedMs = source.elapsedMs;
    ready = false;
    paused = true;
    previousFrame = null;
    buildBoards();
    renderCopy();
    refresh();
    updateURL();
    saveNotice = 'loaded';
    $('save-status').textContent = text('loaded');
    $(result() ? 'restart' : 'toggle').focus({ preventScroll: true });
  } catch {
    saveNotice = 'invalid';
    $('save-status').textContent = text('invalid');
  }
}
function effectSettings() {
  const choice = destruction.snapshot();
  $('brutal').checked = choice.brutal;
  $('blood').checked = choice.blood;
  $('blood').disabled = !choice.brutal;
  $('remains').checked = remains.snapshot().showRemains;
  // Clearing cosmetics is immediate, including while paused. Priming from the
  // retained catch list prevents restored/re-enabled gore from replaying bursts.
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
destruction.subscribe(effectSettings);
remains.subscribe(effectSettings);
$('brutal').addEventListener('change', () => destruction.set({ brutal: $('brutal').checked }));
$('blood').addEventListener('change', () => destruction.set({ blood: $('blood').checked }));
$('remains').addEventListener('change', () => remains.set($('remains').checked));
$('reduced').addEventListener('change', () => {
  reduced = $('reduced').checked;
  effectSettings();
});
media.addEventListener('change', effectSettings);
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
$('pace').addEventListener('change', () => {
  save();
  pace = $('pace').value;
  prepare();
});
$('toggle').addEventListener('click', () => {
  if (paused || ready) start();
  else pause();
});
$('restart').addEventListener('click', () => {
  prepare();
  $('toggle').focus();
});
$('next').addEventListener('click', () => {
  entry =
    CLASSIC_SNAKE_LEVELS[(CLASSIC_SNAKE_LEVELS.indexOf(entry) + 1) % CLASSIC_SNAKE_LEVELS.length];
  prepare();
});
$('continue').addEventListener('click', () => {
  if (savedRound) restore(savedRound);
});
$('export').addEventListener('click', () => {
  pause();
  const blob = new Blob([JSON.stringify(session(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob),
    link = el('a');
  link.href = url;
  link.download = `${entry.id}-${mode}.json`;
  doc.body.append(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').addEventListener('change', async () => {
  pause();
  const file = $('import').files[0];
  const ticket = ++importEpoch;
  try {
    if (!file || file.size > 4 * 1024 * 1024) throw new Error('Size');
    const raw = await file.text();
    if (ticket !== importEpoch) return;
    restore(raw);
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
    { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyP: 'p' }[event.code] ??
    event.key.toLowerCase();
  if ([' ', 'p', 'escape'].includes(key)) {
    // Let focused buttons keep their native Space activation.
    if (key === ' ' && event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    if (event.repeat) return;
    if (key === 'escape') pause();
    else if (ready || paused) start();
    else pause();
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
  if (event.repeat) return;
  turn(mode !== 'solo' && key.startsWith('arrow') ? 1 : 0, direction);
});
doc.querySelectorAll('aside details').forEach((details) =>
  details.addEventListener('toggle', () => {
    if (details.open) pause();
  }),
);
doc.addEventListener('visibilitychange', () => {
  if (doc.hidden) pause();
});
globalThis.addEventListener('blur', pause);
globalThis.addEventListener('pagehide', () => {
  importEpoch++;
  pause();
  save();
});

function frame(now) {
  const elapsed = previousFrame === null ? 0 : now - previousFrame;
  previousFrame = now;
  if (!ready && !paused && !result()) {
    if (elapsed > 1000 || doc.hidden) pause();
    else {
      const destinationTime = elapsedMs + Math.max(0, Math.min(250, elapsed));
      // Advance due events in chronological order, grouping exact-time ties.
      // Each board owns its recipe's speed; the opponent never accelerates it.
      let next = Math.min(...runs.map((run) => run.elapsedMs + classicSnakeSummary(run).stepMs));
      while (next <= destinationTime && !result()) {
        elapsedMs = next;
        const due = runs.filter((run) => run.elapsedMs + classicSnakeSummary(run).stepMs === next);
        for (const run of due) stepClassicSnake(run);
        const caught = due.some((run) =>
          run.events.some((event) => event.type === 'target.caught'),
        );
        if (caught || result()) {
          rememberScore();
          save();
        }
        if (result()) paused = true;
        refresh();
        next = Math.min(...runs.map((run) => run.elapsedMs + classicSnakeSummary(run).stepMs));
      }
      if (!result()) elapsedMs = destinationTime;
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
    drawClassicBoard(boards[i].canvas, run, {
      effects: effects[i],
      ...choice,
      showRemains: remains.snapshot().showRemains,
    });
  });
  globalThis.requestAnimationFrame(frame);
}
prepare();
$('boot-status').hidden = true;
$('game').hidden = false;
globalThis.RevealLineToolLaunch?.attached?.();
globalThis.requestAnimationFrame(frame);
