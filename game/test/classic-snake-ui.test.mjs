import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { parse as parseModule } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import * as core from '../snake/classic-core.mjs';
import {
  CLASSIC_SNAKE_CHAPTERS,
  CLASSIC_SNAKE_LEVELS,
  CLASSIC_SNAKE_CAMPAIGNS,
  CLASSIC_SNAKE_FEATURED,
} from '../snake/classic-catalogue.mjs';
import * as matches from '../snake/classic-match.mjs';
import {
  prepareClassicSnakeLevel,
  classicSnakeSurvivalEntry,
  CLASSIC_PACES,
} from '../snake/classic-setup.mjs';
import { ACTOR_CASTS, actorFieldGuide } from '../hunt/actor-catalog.mjs';
import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { snakeStudioReturnHref } from '../ui/content-studio-navigation.mjs';
import { fpvWorldLaunchURL, appearanceLaunchURL } from '../fpv-entry.mjs';
import { CLASSIC_COPY } from '../snake/classic-copy.mjs';
import { advanceClassicFlight } from '../snake/classic-flight-art.mjs';

const appURL = new URL('../snake/classic-app.mjs', import.meta.url);
const source = await readFile(appURL, 'utf8');
const html = await readFile(new URL('./play.html', appURL), 'utf8');
const imports = parseModule(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.filter(
  (node) => node.type === 'ImportDeclaration',
);
const hostSource = imports.reduceRight(
  (text, node) => text.slice(0, node.start) + text.slice(node.end),
  source,
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const clearedReplay = JSON.parse(
  await readFile(
    new URL(
      '../../docs/verification/classic-snake/authored-open-loop.replay.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

// Execute actual host handlers, setup preparation and match/session admission.
// The real shared shell is mounted; canvas, networking, persistent records and
// preferences remain boundaries. This fixture makes no browser layout claim.
async function harness({
  entry = CLASSIC_SNAKE_LEVELS[0],
  mode = 'solo',
  activity = 'campaign',
} = {}) {
  const document = new Document();
  document.createElement = (tag) => {
    const node = new Element(document, tag);
    if (tag === 'canvas') node.getContext = () => ({ clearRect() {} });
    return node;
  };
  const mount = (node, parent) => {
    if (!node.tagName || ['html', 'body', 'head'].includes(node.tagName)) {
      for (const child of node.childNodes ?? []) mount(child, parent);
      return;
    }
    const element = document.createElement(node.tagName);
    for (const { name, value } of node.attrs) {
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'open'].includes(name)) element[name] = true;
    }
    parent.append(element);
    for (const child of node.childNodes ?? []) mount(child, element);
  };
  mount(parseHTML(html), document.body);
  const window = new Events();
  const storage = new Map();
  const created = [],
    drawings = [],
    scheduledFrames = [],
    optionalEntries = [];
  const display = { reducedEffects: false, effectiveReducedEffects: false };
  const location = {
    href: `https://example.test/game/snake/play.html?mode=${mode}&level=${entry.id}&activity=${activity}`,
  };
  const preferences = (snapshot) => ({
    snapshot: () => snapshot,
    subscribe(listener) {
      listener(snapshot);
      return () => {};
    },
    set() {},
  });
  let shell;
  const context = createContext({
    __appURL: appURL.href,
    mountModePlayShell(options) {
      shell = mountModePlayShell(options);
      return shell;
    },
    attachModalNavigation,
    attachFullscreen: () => () => {},
    attachControllerNavigation,
    setMenuIcon() {},
    snakeStudioReturnHref,
    fpvWorldLaunchURL,
    appearanceLaunchURL,
    contextualAppearance: () => null,
    mountOptionalPracticePanel(options) {
      optionalEntries.push(options);
      return { open() {}, root: () => null, close() {}, dispose() {} };
    },
    boardPlacement: () => ({ board: 'solo', pan: 0 }),
    createClassicAudio: () => ({ reset() {}, update() {} }),
    sharedActorAppearance: () => preferences({ cast: 'authored' }),
    ACTOR_CASTS,
    actorFieldGuide,
    renderEnemyFieldGuide() {},
    attachContextualReactions: () => ({
      reset() {},
      suspend() {},
      resume() {},
      prepare() {},
      events() {},
    }),
    document,
    URL,
    Blob,
    structuredClone,
    location,
    history: {
      replaceState(_state, _unused, url) {
        location.href = String(url);
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    matchMedia: () => Object.assign(new Events(), { matches: false }),
    addEventListener: window.addEventListener.bind(window),
    requestAnimationFrame(callback) {
      scheduledFrames.push(callback);
    },
    screen: { orientation: new Events() },
    navigator: { getGamepads: () => [] },
    setTimeout,
    getLocale: () => 'en',
    setLocale() {},
    onLocaleChange() {},
    createDestructionPreferences: () => preferences({ brutal: false, blood: true }),
    createEncounterDisplayPreferences: () => preferences({ showRemains: true }),
    createDisplayPreferences: () => preferences(display),
    createTouchPreferences: () => preferences({ size: 'normal', opacity: 1, side: 'right' }),
    createClassicPresentation: () => ({ snapshot: () => null }),
    createBoardFootprints: () => ({ refresh() {}, dispose() {}, width: () => 336 }),
    devicePixelRatio: 2,
    createAudioMaster: () => preferences({ muted: false, volume: 1 }),
    createAudioPreferences: () => ({ setMuted() {}, setVolume() {} }),
    Soundscape: class {
      settings = { sfx: 0.7 };
      voices = [];
      feedbackDirector = { play() {} };
      configure(value) {
        Object.assign(this.settings, value);
      }
      async enable() {}
      pause() {}
      suspend() {}
      encounter() {}
    },
    createClassicSnakeRecords: () => ({
      async read() {},
      async visit() {},
      async remember() {},
      chapter: () => 0,
      cleared: () => false,
      get: () => null,
      recent: () => null,
    }),
    createHuntDestruction: () => ({ reset() {}, advance() {}, draw() {} }),
    classicCatchMarks: () => [],
    drawClassicBoard(canvas, run, options) {
      drawings.push({ canvas, run, options: { ...options, flight: { ...options.flight } } });
    },
    drawClassicTarget() {},
    advanceClassicFlight,
    boundedJSON,
    exactKeys,
    required,
    CLASSIC_PACES,
    prepareClassicSnakeLevel,
    classicSnakeSurvivalEntry,
    OFFICIAL_CAMPAIGNS: CLASSIC_SNAKE_CAMPAIGNS,
    OFFICIAL_FEATURED: CLASSIC_SNAKE_FEATURED,
    OFFICIAL_CHAPTERS: CLASSIC_SNAKE_CHAPTERS,
    OFFICIAL_LEVELS: CLASSIC_SNAKE_LEVELS,
    CLASSIC_COPY,
    ...core,
    ...matches,
    createClassicSnakeMatch(...args) {
      // The VM models a browser realm; normalize only this harness crossing so
      // strict plain-data admission sees the same realm it would in production.
      const match = matches.createClassicSnakeMatch(
        ...args.map((argument) => structuredClone(argument)),
      );
      created.push(...match.runs);
      return match;
    },
  });
  await new Script(`(async () => {${hostSource.replaceAll('import.meta.url', '__appURL')}\n})()`, {
    filename: appURL.pathname,
  }).runInContext(context);
  return {
    document,
    created,
    drawings,
    display,
    window,
    storage,
    location,
    shell,
    optionalEntries,
    start() {
      shell.open('briefing');
      shell.elements.buttons.start.click();
    },
    retry() {
      shell.open('home');
      shell.elements.buttons['home-retry'].click();
    },
    frame(now) {
      scheduledFrames.shift()(now);
    },
    $: (id) => document.getElementById(id),
  };
}

for (const mode of ['solo', 'versus', 'team']) {
  test(`${mode} mission and settings menus cannot start or steer the prepared Snake boards`, async () => {
    const state = await harness({ mode });
    const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
    for (const surface of ['missions', 'settings', 'expert', 'briefing']) {
      state.shell.open(surface);
      state.document.emit('keydown', {
        target: state.shell.topDialog(),
        key: 'ArrowUp',
        code: 'ArrowUp',
        repeat: false,
      });
      state.document.emit('keydown', {
        target: state.shell.topDialog(),
        key: ' ',
        code: 'Space',
        repeat: false,
      });
      state.frame(0);
      state.frame(800);
      assert.equal(state.document.body.dataset.playing, 'false');
      assert.deepEqual(
        state.created.map((run) => core.exportClassicSnakeReplay(run)),
        before,
      );
    }
    const sim = state.optionalEntries.at(-1);
    assert.equal(sim.packageId, 'fpv-worlds');
    assert.equal(sim.preferDirect, true);
    assert.equal(new URL(sim.bundledHref).pathname, '/optional-practice/fpv-worlds/index.html');
  });

  test(`${mode} Back leaves a paused board frozen and explicit Start/Retry retain the accepted recipe`, async () => {
    const state = await harness({ mode });
    const initial = state.created.slice();
    state.start();
    assert.equal(state.created.length, initial.length, 'Start uses the prepared attempt once.');
    state.frame(0);
    state.frame(50);
    state.shell.open('settings');
    const paused = initial.map((run) => core.exportClassicSnakeReplay(run));
    state.shell.back();
    state.frame(250);
    state.frame(500);
    assert.equal(state.document.body.dataset.playing, 'false');
    assert.deepEqual(
      initial.map((run) => core.exportClassicSnakeReplay(run)),
      paused,
    );
    state.start();
    state.frame(550);
    state.frame(600);
    assert.equal(state.document.body.dataset.playing, 'true');
    state.retry();
    const replacement = state.created.slice(initial.length);
    assert.equal(replacement.length, initial.length);
    replacement.forEach((run, index) => {
      assert.notEqual(run, initial[index]);
      assert.deepEqual(run.level, initial[index].level);
      assert.equal(run.seed, initial[index].seed);
      assert.equal(run.tick, 0);
    });
    assert.equal(state.document.body.dataset.playing, 'true');
  });
}

test('Classic Snake accepts the physical WASD key with a Ukrainian keyboard layout', async () => {
  const { document, created, start } = await harness();
  start();
  const event = document.emit('keydown', {
    target: document.querySelector('canvas'),
    key: 'ц',
    code: 'KeyW',
    repeat: false,
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(created[0].history.length, 1);
  assert.equal(created[0].history[0].direction, 'up');
});

test('Escape pauses Classic Snake even when a settings checkbox has focus', async () => {
  const { document, $, shell, start } = await harness();
  start();
  assert.equal(shell.elements.root.dataset.phase, 'playing');
  const event = document.emit('keydown', {
    target: $('brutal'),
    key: 'Escape',
    code: 'Escape',
    repeat: false,
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(shell.elements.root.dataset.phase, 'paused');
  assert.equal(document.body.dataset.playing, 'false');
});

test('a delayed Classic Snake import cannot replace a subsequently selected Team round', async () => {
  const { document, created, $, shell } = await harness();
  const saved = JSON.stringify({
    format: 'revealline-classic-snake-session.v1',
    levelId: CLASSIC_SNAKE_LEVELS[0].id,
    mode: 'solo',
    pace: 'normal',
    elapsedMs: 0,
    replays: [core.exportClassicSnakeReplay(created[0])],
  });
  let finishRead;
  const read = new Promise((resolve) => {
    finishRead = resolve;
  });
  $('import').files = [{ size: saved.length, text: () => read }];
  $('import').emit('change');
  document.querySelector('[data-mode="team"]').emit('click');
  finishRead(saved);
  await flush();
  assert.equal(document.body.dataset.mode, 'team');
  assert.equal(shell.elements.root.dataset.phase, 'ready');
  assert.notEqual($('save-status').textContent, CLASSIC_COPY.en.loaded);
});

const savedSession = (run, elapsedMs = run.elapsedMs) => ({
  format: 'revealline-classic-snake-session.v1',
  levelId: CLASSIC_SNAKE_LEVELS[0].id,
  mode: 'solo',
  pace: 'normal',
  elapsedMs,
  replays: [core.exportClassicSnakeReplay(run)],
});
async function importSession($, value) {
  const raw = JSON.stringify(value);
  $('import').files = [{ size: Buffer.byteLength(raw), text: async () => raw }];
  $('import').emit('change');
  await flush();
}

const clearedSession = () => ({
  format: 'revealline-classic-snake-session.v1',
  levelId: CLASSIC_SNAKE_LEVELS[0].id,
  mode: 'solo',
  pace: 'normal',
  elapsedMs: 18600,
  replays: [structuredClone(clearedReplay)],
});

test('selecting a new mission keeps its Start authoritative while retaining the older Workshop save', async () => {
  const state = await harness();
  state.start();
  state.frame(0);
  state.frame(100);
  state.shell.open('missions');
  const priorSave = state.storage.get('revealline.classic-snake.round.v2');
  assert.equal(JSON.parse(priorSave).levelId, CLASSIC_SNAKE_LEVELS[0].id);
  const selected = CLASSIC_SNAKE_LEVELS[1];
  state.$('mission').value = selected.id;
  state.$('mission').emit('change');
  state.shell.openHome();
  assert.equal(state.shell.elements.buttons.primary.textContent, 'Start');
  state.shell.elements.buttons.primary.click();
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.briefing);
  assert.equal(state.document.body.dataset.playing, 'false');
  assert.equal(state.storage.get('revealline.classic-snake.round.v2'), priorSave);
  assert.equal(new URL(state.location.href).searchParams.get('level'), selected.id);
  state.shell.elements.buttons.start.click();
  assert.equal(state.document.body.dataset.playing, 'true');
  assert.equal(state.created.at(-1).level.id, selected.level.id);
  const sim = new URL(state.optionalEntries.at(-1).bundledHref);
  const back = new URL(sim.searchParams.get('game-return'), state.location.href);
  assert.equal(back.searchParams.get('level'), selected.id);
  assert.equal(
    back.searchParams.get('seed'),
    new URL(state.location.href).searchParams.get('seed'),
  );
});

test('the shared keyboard navigator moves menu focus without leaking directional input into Snake', async () => {
  const state = await harness();
  state.shell.openHome();
  const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
  const primary = state.shell.elements.buttons.primary;
  primary.focus();
  const event = primary.emit('keydown', { key: 'ArrowDown', code: 'ArrowDown', repeat: false });
  assert.equal(event.defaultPrevented, true);
  assert.equal(state.document.activeElement, state.shell.elements.buttons.missions);
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    before,
  );
  assert.equal(state.document.body.dataset.playing, 'false');
});

test('final-moves playback freezes behind a newer menu and only returns to Results while visible', async () => {
  const state = await harness();
  await importSession(state.$, clearedSession());
  assert.equal(state.shell.elements.root.dataset.phase, 'results');
  state.$('review').click();
  state.frame(0);
  state.frame(240);
  const visibleTick = state.drawings.at(-1).run.tick;
  state.shell.openHome();
  state.shell.open('settings');
  for (let now = 480; now <= 3120; now += 240) state.frame(now);
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.settings);
  assert.equal(state.drawings.at(-1).run.tick, visibleTick);
  state.shell.elements.buttons['settings-back'].click();
  assert.equal(state.shell.topDialog(), state.shell.elements.home);
  assert.equal(state.shell.elements.buttons['home-results'].hidden, false);
  state.shell.elements.buttons['home-results'].click();
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.results);
  state.frame(3360);
  assert.equal(state.drawings.at(-1).run.tick, visibleTick);
  assert.equal(state.document.body.dataset.playing, 'false');
  state.$('review').click();
  for (let now = 3600; now <= 6000; now += 240) state.frame(now);
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.results);
  assert.equal(state.document.body.dataset.playing, 'false');
});

test('Next retires the completed result before the new mission briefing and Back reaches selection', async () => {
  const state = await harness();
  await importSession(state.$, clearedSession());
  assert.equal(state.$('next').hidden, false);
  state.$('next').click();
  assert.equal(state.shell.elements.dialogs.results.open, false);
  assert.equal(state.shell.elements.root.dataset.phase, 'ready');
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.briefing);
  assert.notEqual(
    new URL(state.location.href).searchParams.get('level'),
    CLASSIC_SNAKE_LEVELS[0].id,
  );
  state.shell.back();
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.missions);
  assert.equal(state.document.body.dataset.playing, 'false');
  const selected = new URL(state.location.href);
  const sim = new URL(state.optionalEntries.at(-1).bundledHref);
  assert.equal(new URL(sim.searchParams.get('game-return'), selected).href, selected.href);
});

test('legacy Continue and Retry preserve the verified replay seed', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 71 });
  const state = await harness();
  await importSession(state.$, savedSession(run));
  assert.equal(new URL(state.location.href).searchParams.get('seed'), '71');
  state.retry();
  assert.equal(state.created.at(-1).seed, 71);
});

test('a scheduled terminal result cannot be restored with a later host clock', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 17 });
  while (run.status === 'running') core.stepClassicSnake(run);
  const { $, shell } = await harness();
  await importSession($, savedSession(run, run.elapsedMs + 0.5));
  assert.equal($('save-status').textContent, CLASSIC_COPY.en.invalid);
  assert.equal(shell.elements.root.dataset.phase, 'ready');
});

test('an input-limit result may restore between its final two scheduled grid times', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 17 });
  const head = run.snakes[0].body[0];
  // The empty opening board admits a four-cell loop that never catches its
  // stationary target. Every turn and move still goes through production APIs.
  const below = [
    { x: head.x, y: head.y + 1 },
    { x: head.x - 1, y: head.y + 1 },
  ];
  const directions = below.some((cell) => cell.x === run.target.x && cell.y === run.target.y)
    ? ['up', 'left', 'down', 'right']
    : ['down', 'left', 'up', 'right'];
  for (let index = 0; index < core.CLASSIC_SNAKE_MAX_TURNS; index++) {
    assert.equal(core.queueClassicSnakeTurn(run, 0, directions[index % 4]), true);
    if (run.status === 'running') core.stepClassicSnake(run);
  }
  assert.equal(run.failure.cause, 'input-limit');
  const { $, shell } = await harness();
  await importSession($, savedSession(run, run.elapsedMs + 0.5));
  assert.equal($('save-status').textContent, CLASSIC_COPY.en.loadedComplete);
  assert.equal(shell.elements.root.dataset.phase, 'results');
  assert.equal($('announcement').textContent, CLASSIC_COPY.en.limit);
});

test('a V2 round saves its accepted timeline and continues paused without advancing it', async () => {
  const entry = CLASSIC_SNAKE_LEVELS.find(
    (item) => item.level.version === 'classic-snake-level.v2',
  );
  const state = await harness({ entry });
  state.start();
  state.document.emit('keydown', {
    target: state.document.querySelector('canvas'),
    key: 'w',
    code: 'KeyW',
    repeat: false,
  });
  state.frame(0);
  state.frame(core.classicSnakeSummary(state.created[0]).stepMs);
  state.window.emit('blur');
  const saved = JSON.parse(state.storage.get('revealline.classic-snake.round.v2'));
  assert.equal(saved.format, 'revealline-classic-snake-session.v2');
  assert.equal(saved.match.turns.length, 1);
  assert.equal(saved.match.replays[0].steps, 1);
  assert.equal(saved.match.turns[0].direction, 'up');
  const accepted = matches.restoreClassicSnakeMatch(saved.match, {
    level: prepareClassicSnakeLevel(entry),
  });
  assert.deepEqual(matches.exportClassicSnakeMatch(accepted), saved.match);
  const resumed = await harness({ entry });
  await importSession(resumed.$, saved);
  assert.equal(resumed.$('save-status').textContent, CLASSIC_COPY.en.loaded);
  assert.equal(resumed.shell.elements.root.dataset.phase, 'paused');
  assert.equal(resumed.document.body.dataset.playing, 'false');
  assert.equal(new URL(resumed.location.href).searchParams.get('level'), entry.id);
  resumed.frame(0);
  resumed.frame(500);
  assert.equal(resumed.document.body.dataset.playing, 'false');
});

test('a valid match cannot be imported under a different host seat arrangement', async () => {
  const entry = CLASSIC_SNAKE_LEVELS.find(
    (item) => item.level.version === 'classic-snake-level.v2',
  );
  const state = await harness({ entry });
  state.start();
  state.window.emit('blur');
  const saved = JSON.parse(state.storage.get('revealline.classic-snake.round.v2'));
  saved.mode = 'team';
  const imported = await harness({ entry });
  await importSession(imported.$, saved);
  assert.equal(imported.$('save-status').textContent, CLASSIC_COPY.en.invalid);
  assert.equal(imported.document.body.dataset.mode, 'solo');
  assert.equal(imported.shell.elements.root.dataset.phase, 'ready');
});

test('Classic flight animation follows play, pause and effective Reduced effects without stopping movement', async () => {
  const state = await harness();
  const latest = () => state.drawings.at(-1).options;
  state.frame(0);
  state.frame(500);
  assert.equal(latest().flight.timeMs, 0);
  state.start();
  state.frame(600);
  state.frame(650);
  const moving = latest().flight;
  assert.ok(moving.timeMs > 0);
  assert.ok(moving.rotorPhase > 0);
  assert.equal(latest().cssWidth, 336);
  assert.equal(latest().pixelRatio, 2);

  state.window.emit('blur');
  state.frame(900);
  assert.deepEqual(latest().flight, moving);
  state.start();
  state.frame(1000);
  assert.deepEqual(latest().flight, moving, 'resume excludes the paused wall-clock gap');

  // A system motion preference is effective even when the explicit checkbox is off.
  state.display.effectiveReducedEffects = true;
  const tick = state.created[0].tick;
  state.frame(1200);
  assert.equal(latest().reduced, true);
  assert.deepEqual(latest().flight, moving);
  assert.ok(state.created[0].tick > tick, 'reduced motion must not alter simulation speed');
  state.display.effectiveReducedEffects = false;
  state.frame(1250);
  assert.ok(latest().flight.timeMs > moving.timeMs);

  state.retry();
  state.frame(1400);
  assert.equal(latest().flight.timeMs, 0, 'Retry owns a fresh presentation clock');
});

test('a failed Versus score board freezes its flight clock while the surviving board continues', async () => {
  const state = await harness({ mode: 'versus', activity: 'endless' });
  state.start();
  state.document.emit('keydown', {
    target: state.document.querySelector('canvas'),
    key: 'w',
    code: 'KeyW',
    repeat: false,
  });
  state.frame(0);
  const stepMs = core.classicSnakeSummary(state.created[0]).stepMs;
  for (let step = 1; step <= 3; step++) state.frame(step * stepMs);
  assert.equal(state.created[0].status, 'lost');
  assert.equal(state.created[1].status, 'running');
  const [failed, surviving] = state.drawings.slice(-2).map((row) => row.options.flight);
  state.frame(3 * stepMs + 50);
  const [nextFailed, nextSurviving] = state.drawings.slice(-2).map((row) => row.options.flight);
  assert.deepEqual(nextFailed, failed);
  assert.ok(nextSurviving.timeMs > surviving.timeMs);

  state.document.hidden = true;
  state.document.emit('visibilitychange');
  state.frame(3 * stepMs + 100);
  assert.deepEqual(
    state.drawings.slice(-2).map((row) => row.options.flight),
    [nextFailed, nextSurviving],
  );
});
