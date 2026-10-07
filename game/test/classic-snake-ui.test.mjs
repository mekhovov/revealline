import { classicSnakeRatingForRecord } from '../snake/classic-ratings.mjs';
import {
  createEnemyStats,
  validateEnemyStatsSession,
  forkEnemyStatsSession,
} from '../enemy-stats.mjs';
import { mountEnemyStats } from '../ui/enemy-stats.mjs';
import * as replayHelpers from '../snake/classic-recent-replay.mjs';
import * as flowHelpers from '../ui/continuous-play.mjs';
import * as celebrationHelpers from '../ui/celebration.mjs';
import { createSignalReception } from '../ui/signal-reception.mjs';
import { mountGlobalSettingsTools } from '../ui/global-settings-tools.mjs';
import { menuPad } from './helpers/global-tools-fixture.mjs';
import { mountGlobalSettings } from '../ui/global-settings-view.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { parse as parseModule } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { boundedJSON, exactKeys, required } from '../data-json.mjs';
import * as core from '../snake/classic-core.mjs';
import { nextClassicHazardSeed } from '../snake/classic-attempt-seed.mjs';
import {
  CLASSIC_SNAKE_ARCHIVED_LEVELS,
  resolveClassicSnakeRecipeEntry,
} from '../snake/classic-catalogue-archive.mjs';
import { resolveClassicBoardScene, classicSceneBackdrop } from '../snake/classic-scenes.mjs';
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
import { mountModeSettings } from '../ui/mode-settings-view.mjs';
import {
  attachSettingsPanels,
  settingsPanelBack,
  settingsTabOwnsKey,
} from '../ui/settings-panels.mjs';
import { renderModeChoices } from '../ui/mode-choice-view.mjs';
import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import { attachMissionLibraryChooser } from '../ui/mission-library-chooser.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { createMissionLibrarySessionState } from '../mission-library/handoff.mjs';
import {
  classicSnakeLibrarySource,
  renderClassicSnakeLibraryPreview,
} from '../snake/classic-mission-library.mjs';
import { attachModalNavigation } from '../ui/modal-navigation.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { snakeStudioReturnHref } from '../ui/content-studio-navigation.mjs';
import { fpvWorldLaunchURL, appearanceLaunchURL, nativeArtReviewURL } from '../fpv-entry.mjs';
import { CLASSIC_COPY } from '../snake/classic-copy.mjs';
import { advanceClassicFlight } from '../snake/classic-flight-art.mjs';
import { t } from '../i18n/index.mjs';
import { mountEnemyAppearanceControls } from '../ui/enemy-appearance-controls.mjs';
import { attachTouchSteering } from '../ui/touch-steering.mjs';
import { createTouchPreferences, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';

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
const libraryCard = (state, id) =>
  [...state.$('journey-cards').children].find(
    (card) => JSON.parse(card.dataset.missionId)[3] === id,
  );
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
  sharedTools = false,
  focused = true,
  artReview = null,
  query = '',
  cosmetics = null,
  savedRound = null,
  catalogue = CLASSIC_SNAKE_LEVELS,
  touchControls = null,
} = {}) {
  const document = new Document();
  document.hasFocus = () => focused;
  const writerClaims = [];
  document.createElement = (tag) => {
    const node = new Element(document, tag);
    if (tag === 'canvas')
      node.getContext = () =>
        new Proxy(
          { canvas: node, clearRect() {} },
          { get: (object, key) => object[key] ?? (() => {}) },
        );
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
  const pads = [];
  let tools;
  const storage = new Map();
  if (savedRound) storage.set('revealline.classic-snake.round.v2', JSON.stringify(savedRound));
  if (cosmetics) storage.set('revealline.classic-snake.presentation.v1', JSON.stringify(cosmetics));
  if (touchControls) storage.set(TOUCH_PREFERENCES_KEY, JSON.stringify(touchControls));
  const created = [],
    touchCommands = [],
    drawings = [],
    celebrations = [],
    scheduledFrames = [],
    optionalEntries = [];
  const display = {
    textFace: 'pixel',
    textSize: 'standard',
    reducedEffects: false,
    effectiveReducedEffects: false,
  };
  const displayListeners = new Set();
  const location = {
    href: `https://example.test/game/snake/play.html?mode=${mode}&level=${entry.id}&activity=${activity}${artReview ? `&artReview=${encodeURIComponent(artReview)}` : ''}${query}`,
    origin: 'https://example.test',
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
  let enemyStyle = 'authored';
  const enemyListeners = new Set(),
    artworkSelections = [],
    appearanceActions = [];
  const context = createContext({
    resolveClassicBoardScene,
    classicSceneBackdrop,
    nextClassicHazardSeed,
    resolveClassicSnakeRecipeEntry,
    __appURL: appURL.href,
    claimProfileWriter: async () => {
      let writable = true;
      const lease = {
        get writable() {
          return writable;
        },
        release() {
          writable = false;
        },
      };
      writerClaims.push(lease);
      return lease;
    },
    createEnemyStats: (options) => {
      const service = createEnemyStats({
        ...options,
        indexedDB: null,
        storage: {
          getItem: (key) => storage.get(key),
          setItem: (key, value) => storage.set(key, value),
        },
      });
      return {
        ...service,
        observe: (attempt, event) => service.observe(attempt, structuredClone(event)),
      };
    },
    validateEnemyStatsSession,
    forkEnemyStatsSession,
    mountEnemyStats,
    createClassicSnakeRatings: () => ({ refresh: async () => {}, close() {} }),
    classicSnakeRatingForRecord,
    ...replayHelpers,
    ...flowHelpers,
    continuousPlayPreferences: () =>
      flowHelpers.continuousPlayPreferences({
        storage: {
          getItem: (key) => storage.get(key),
          setItem: (key, value) => storage.set(key, value),
        },
        window,
      }),
    ...celebrationHelpers,
    createCelebration: (options) => {
      celebrations.push(options);
      return celebrationHelpers.createCelebration(options);
    },
    createSignalReception,
    attachMissionLibraryChooser,
    createMissionLibrary,
    createMissionLibrarySessionState,
    classicSnakeLibrarySource,
    renderClassicSnakeLibraryPreview,
    mountModePlayShell(options) {
      shell = mountModePlayShell(options);
      return shell;
    },
    attachModalNavigation,
    mountGlobalSettings,
    attachThemeFamilyControls({ root }) {
      const group = document.createElement('section');
      group.setAttribute('data-theme-controls', '');
      root.append(group);
      return { dispose() {} };
    },
    mountGlobalSettingsTools: (options) =>
      (tools = sharedTools
        ? mountGlobalSettingsTools(options)
        : {
            controls: {},
            root: () => null,
            frameFocused: () => false,
            back: () => false,
            handleFrameCommand: () => false,
            dispose() {},
          }),
    attachMenuAudioSettings() {},
    getMenuAnimation: () => true,
    setMenuAnimation() {},
    subscribeMenuAnimation: () => () => {},
    mountModeSettings,
    attachSettingsPanels,
    settingsPanelBack,
    settingsTabOwnsKey,
    attachMenuScene: () => ({ dispose() {} }),
    attachFullscreen: () => () => {},
    attachControllerNavigation,
    setMenuIcon() {},
    snakeStudioReturnHref,
    fpvWorldLaunchURL,
    appearanceLaunchURL,
    nativeArtReviewURL,
    contextualAppearance: () => null,
    mountModeChoices(options) {
      renderModeChoices({ ...options, locale: 'en' });
      optionalEntries.push({
        packageId: 'fpv-worlds',
        preferDirect: true,
        bundledHref: fpvWorldLaunchURL(location.href, 'en'),
      });
      return { simulatorRoot: () => null, closeSimulator() {}, dispose() {} };
    },
    boardPlacement: () => ({ board: 'solo', pan: 0 }),
    createClassicAudio: () => ({ reset() {}, update() {}, prepare() {}, dispose() {} }),
    runtimeActorArtRevision: () =>
      artReview ?? (enemyStyle === 'military' ? 'industrial-roster-v3' : null),
    mountEnemyAppearanceControls(options) {
      return mountEnemyAppearanceControls({
        ...options,
        preferences: {
          snapshot: () => ({ style: enemyStyle, durable: true }),
          set({ style }) {
            enemyStyle = style;
            for (const listener of enemyListeners) listener();
          },
          subscribe(listener) {
            enemyListeners.add(listener);
            listener();
            return () => enemyListeners.delete(listener);
          },
        },
      });
    },
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
      result() {},
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
    removeEventListener: window.removeEventListener.bind(window),
    requestAnimationFrame(callback) {
      scheduledFrames.push(callback);
    },
    screen: { orientation: new Events() },
    navigator: { getGamepads: () => pads },
    setTimeout,
    getLocale: () => 'en',
    t,
    setLocale() {},
    onLocaleChange() {},
    createDestructionPreferences: () => preferences({ brutal: false, blood: true }),
    createEncounterDisplayPreferences: () => preferences({ showRemains: true }),
    createDisplayPreferences: () => ({
      snapshot: () => display,
      subscribe(listener) {
        displayListeners.add(listener);
        listener(display);
        return () => displayListeners.delete(listener);
      },
      set(patch) {
        Object.assign(display, patch);
        for (const listener of displayListeners) listener(display);
      },
    }),
    attachTouchSteering: (options) => attachTouchSteering({ ...options, window }),
    createTouchPreferences: (options) => {
      const service = createTouchPreferences({
        ...options,
        storage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, String(value)),
        },
        eventTarget: window,
      });
      return {
        ...service,
        // Production preferences and host share a realm; normalize the VM boundary only.
        set: (value, settings) => service.set(structuredClone(value), settings),
      };
    },
    createClassicPresentation: () => ({
      snapshot: () => null,
      setArtRevision: (revision) => artworkSelections.push(revision),
      theme: {
        applyComplete: (family) => appearanceActions.push(family),
        set: (value) => appearanceActions.push(value),
      },
    }),
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
    OFFICIAL_LEVELS: catalogue,
    CLASSIC_COPY,
    ...core,
    ...matches,
    queueClassicSnakeMatchTurn(match, player, direction) {
      touchCommands.push({ player, direction });
      return matches.queueClassicSnakeMatchTurn(match, player, direction);
    },
    createClassicSnake(...args) {
      return core.createClassicSnake(...args.map((argument) => structuredClone(argument)));
    },
    restoreClassicSnakeLegacyMatch(source, options) {
      // The legacy wrapper is assembled in the browser VM. Its production
      // validator shares that realm; normalize only the harness boundary here.
      return matches.restoreClassicSnakeLegacyMatch(structuredClone(source), {
        ...options,
        level: structuredClone(options.level),
      });
    },
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
    writerClaims,
    setFocused: (value) => {
      focused = value;
    },
    created,
    touchCommands,
    drawings,
    celebrations,
    artworkSelections,
    appearanceActions,
    display,
    window,
    storage,
    location,
    shell,
    optionalEntries,
    pads,
    disposeTools: () => tools.dispose(),
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
  test(`${mode} accepts a changed military preset on the first Start without replacing the recipe`, async () => {
    const state = await harness({ mode });
    const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
    state.shell.open('settings');
    const selector = state.document.querySelector('[data-enemy-appearance]');
    selector.value = 'military';
    selector.dispatchEvent({ type: 'change' });
    await flush();
    state.start();
    state.frame(0);
    assert.equal(state.artworkSelections.at(-1), 'industrial-roster-v3');
    assert.equal(state.drawings.at(-1).options.artRevision, 'industrial-roster-v3');
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
  });

  test(`${mode} military preset is available on an ordinary level and takes effect on Retry without changing its recipe`, async () => {
    const state = await harness({ mode });
    state.start();
    state.frame(0);
    state.shell.open('settings');
    const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
    const selector = state.document.querySelector('[data-enemy-appearance]');
    selector.value = 'military';
    selector.dispatchEvent({ type: 'change' });
    await flush();
    state.frame(50);
    assert.deepEqual(state.appearanceActions, ['military-field']);
    assert.equal(state.artworkSelections.at(-1), null, 'The current attempt retains its art.');
    assert.equal(state.drawings.at(-1).options.artRevision, null);
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    state.retry();
    state.frame(100);
    assert.equal(state.artworkSelections.at(-1), 'industrial-roster-v3');
    assert.equal(state.drawings.at(-1).options.artRevision, 'industrial-roster-v3');
    assert.deepEqual(
      state.created.slice(before.length).map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
  });

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

const pointer = (target, type, x, y, id = 11) =>
  target.emit(type, {
    pointerId: id,
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: y,
  });
const touchSettings = (mode = 'stick') => ({
  mode,
  side: 'right',
  size: 'regular',
  opacity: 0.55,
});
function touchSeat(state, player = 0) {
  const seat = state.$('pads').querySelector(`[data-player="${player}"]`);
  assert.ok(seat, `Player ${player + 1} has a separate touch seat.`);
  return seat;
}

for (const mode of ['stick', 'swipe']) {
  test(`Snake touch ${mode} turns during one captured gesture and release preserves its heading`, async () => {
    const state = await harness({ touchControls: touchSettings(mode) });
    const run = state.created[0],
      arena = state.$('boards').querySelector('canvas');
    state.frame(0);
    pointer(arena, 'pointerdown', 80, 80);
    pointer(arena, 'pointermove', 80, 40);
    assert.equal(run.history.at(-1)?.direction, 'up', 'Turning does not wait for pointerup.');
    pointer(arena, 'pointermove', 40, mode === 'swipe' ? 40 : 80);
    assert.deepEqual(
      run.history.map((turn) => turn.direction),
      ['up', 'left'],
    );
    assert.equal(arena.hasPointerCapture(11), true);
    pointer(arena, 'pointerup', 40, 80);
    assert.equal(arena.hasPointerCapture(11), false);
    state.frame(200);
    state.frame(400);
    const head = { ...run.snakes[0].body[0] };
    state.frame(600);
    assert.equal(run.snakes[0].direction, 'left');
    assert.equal(run.snakes[0].body[0].x, head.x - 1, 'Release does not stop continuous Snake.');
    assert.equal(state.touchCommands.length, 2, 'Release adds no additional turn.');
  });
}

test('Snake touch D-pad turns on press and slide once, with a separate assistive click path', async () => {
  const state = await harness({ touchControls: touchSettings('dpad') });
  const run = state.created[0],
    pad = touchSeat(state).querySelector('.direction-controls'),
    up = pad.querySelector('[data-direction="up"]'),
    left = pad.querySelector('[data-direction="left"]'),
    down = pad.querySelector('[data-direction="down"]');
  pad._rect = { x: 0, y: 0, width: 156, height: 156 };
  state.frame(0);
  pointer(up, 'pointerdown', 78, 10);
  assert.deepEqual(state.touchCommands, [{ player: 0, direction: 'up' }]);
  assert.equal(up.classList.contains('pressed'), true);
  pointer(pad, 'pointermove', 10, 78);
  assert.equal(up.classList.contains('pressed'), false);
  assert.equal(left.classList.contains('pressed'), true);
  pointer(pad, 'pointerup', 10, 78);
  assert.equal(pad.querySelector('.pressed'), null, 'Released fingers leave no held-button state.');
  left.emit('click', { detail: 1 });
  assert.deepEqual(state.touchCommands, [
    { player: 0, direction: 'up' },
    { player: 0, direction: 'left' },
  ]);
  state.frame(200);
  state.frame(400);
  down.emit('click', { detail: 0 });
  assert.equal(run.history.at(-1)?.direction, 'down');
  assert.equal(state.touchCommands.length, 3, 'Click-only assistive activation still turns.');
});

for (const mode of ['team', 'versus']) {
  test(`Snake touch ${mode} keeps simultaneous player gestures independent`, async () => {
    const state = await harness({ mode });
    const first = touchSeat(state, 0).querySelector('.touch-surface'),
      second = touchSeat(state, 1).querySelector('.touch-surface');
    pointer(first, 'pointerdown', 80, 80, 11);
    pointer(second, 'pointerdown', 80, 80, 22);
    pointer(first, 'pointermove', 80, 40, 11);
    pointer(second, 'pointermove', 80, 120, 22);
    pointer(first, 'pointerup', 80, 40, 11);
    assert.equal(
      second.hasPointerCapture(22),
      true,
      'Player one release cannot retire player two.',
    );
    pointer(second, 'pointermove', 120, 80, 22);
    assert.deepEqual(state.touchCommands, [
      { player: 0, direction: 'up' },
      { player: 1, direction: 'down' },
      { player: 1, direction: 'right' },
    ]);
    if (mode === 'team') {
      assert.deepEqual(
        state.created[0].history.map(({ playerId }) => playerId),
        [0, 1, 1],
      );
      const board = state.$('boards').querySelector('canvas');
      pointer(board, 'pointerdown', 80, 80, 33);
      pointer(board, 'pointermove', 40, 80, 33);
      assert.equal(
        board.hasPointerCapture(33),
        false,
        'The shared Team board has no ambiguous seat.',
      );
      assert.equal(state.touchCommands.length, 3);
    } else {
      assert.deepEqual(
        state.created.map((run) => run.history.length),
        [1, 2],
      );
    }
  });
}

test('Snake touch settings use shared mode preferences and preserve the exact chosen opacity', async () => {
  const state = await harness();
  state.shell.open('settings');
  const mode = state.$('snake-global-touch-mode');
  assert.equal(mode.value, 'stick');
  assert.deepEqual(
    mode.options.map((option) => option.value),
    ['stick', 'swipe', 'dpad'],
  );
  mode.value = 'swipe';
  mode.emit('change');
  const opacity = state.$('snake-global-touch-opacity');
  opacity.value = '0.25';
  opacity.emit('change');
  assert.deepEqual(JSON.parse(state.storage.get(TOUCH_PREFERENCES_KEY)), {
    ...touchSettings('swipe'),
    opacity: 0.25,
  });
  assert.equal(state.$('pads').style.getPropertyValue('--touch-opacity'), '0.25');
  state.shell.back();
  assert.equal(state.document.body.dataset.playing, 'false', 'Settings Back does not resume.');
});

for (const interruption of ['pause', 'resize', 'pointercancel']) {
  test(`Snake touch ${interruption} retires capture and requires a new gesture after Resume`, async () => {
    const state = await harness();
    const surface = touchSeat(state).querySelector('.touch-surface');
    pointer(surface, 'pointerdown', 80, 80);
    pointer(surface, 'pointermove', 80, 40);
    if (interruption === 'pause') state.shell.open('pause');
    else if (interruption === 'resize') state.window.emit('resize');
    else pointer(surface, 'pointercancel', 80, 40);
    assert.equal(surface.hasPointerCapture(11), false);
    assert.equal(state.document.body.dataset.playing, 'false');
    state.start();
    pointer(surface, 'pointermove', 40, 80);
    pointer(surface, 'pointerup', 40, 80);
    assert.equal(
      state.touchCommands.length,
      1,
      'An old captured finger cannot steer the resumed run.',
    );
    pointer(surface, 'pointerdown', 80, 80, 22);
    pointer(surface, 'pointermove', 40, 80, 22);
    assert.equal(state.created[0].history.at(-1)?.direction, 'left');
  });
}

test('Snake touch Retry retires old board listeners and the replacement accepts a fresh gesture', async () => {
  const state = await harness();
  const oldBoard = state.$('boards').querySelector('canvas');
  pointer(oldBoard, 'pointerdown', 80, 80);
  pointer(oldBoard, 'pointermove', 80, 40);
  state.retry();
  const replacement = state.created.at(-1);
  assert.equal(oldBoard.hasPointerCapture(11), false);
  pointer(oldBoard, 'pointermove', 40, 80);
  pointer(oldBoard, 'pointerup', 40, 80);
  pointer(oldBoard, 'pointerdown', 80, 80, 22);
  pointer(oldBoard, 'pointermove', 80, 40, 22);
  assert.equal(replacement.history.length, 0);
  const currentBoard = state.$('boards').querySelector('canvas');
  pointer(currentBoard, 'pointerdown', 80, 80, 33);
  pointer(currentBoard, 'pointermove', 80, 40, 33);
  assert.equal(replacement.history.at(-1)?.direction, 'up');
});

test('Snake touch can start a ready board only after preparation menus have closed', async () => {
  const state = await harness({ focused: false });
  state.setFocused(true);
  const board = state.$('boards').querySelector('canvas');
  for (const name of ['home', 'missions', 'settings']) {
    state.shell.open(name);
    pointer(board, 'pointerdown', 80, 80);
    pointer(board, 'pointermove', 80, 40);
    pointer(board, 'pointerup', 80, 40);
    assert.equal(state.document.body.dataset.playing, 'false');
    assert.equal(state.created[0].history.length, 0);
    assert.equal(board.hasPointerCapture(11), false);
    if (name === 'missions') state.$('journey-back').click();
  }
  state.shell.enterPlay();
  pointer(board, 'pointerdown', 80, 80, 22);
  pointer(board, 'pointermove', 80, 40, 22);
  assert.equal(state.document.body.dataset.playing, 'true');
  assert.equal(state.created[0].history.at(-1)?.direction, 'up');
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

function flyVerifiedRoute(state) {
  state.frame(0);
  const run = state.created[0];
  let cursor = 0,
    now = 0;
  for (let tick = 0; tick < clearedReplay.steps; tick++) {
    while (clearedReplay.turns[cursor]?.tick === tick) {
      const command = clearedReplay.turns[cursor++];
      const key = { up: 'w', right: 'd', down: 's', left: 'a' }[command.direction];
      state.document.emit('keydown', {
        target: state.document.querySelector('canvas'),
        key,
        code: `Key${key.toUpperCase()}`,
        repeat: false,
      });
    }
    now += core.classicSnakeSummary(run).stepMs;
    state.frame(now);
  }
  assert.equal(run.status, 'won', 'actual host keyboard input completes the verified route');
  return now;
}

test('Living Circuit links override cosmetics and changing paused scenes preserves the attempt', async () => {
  const state = await harness({
    query: '&board=living-circuit&scene=relay',
    cosmetics: { boardStyle: 'retro', boardScene: 'workshop' },
  });
  assert.equal(state.document.body.dataset.boardStyle, 'living-circuit');
  assert.equal(state.$('board-scene').value, 'relay');
  assert.equal(state.$('board-scene-field').hidden, false);
  const before = core.exportClassicSnakeReplay(state.created[0]);
  state.shell.open('settings');
  state.$('board-scene').value = 'orchard';
  state.$('board-scene').emit('change');
  state.frame(0);
  state.frame(500);
  assert.equal(state.created.length, 1);
  assert.deepEqual(core.exportClassicSnakeReplay(state.created[0]), before);
  assert.equal(state.drawings.at(-1).options.boardScene, 'orchard');
  assert.equal(new URL(state.location.href).searchParams.get('scene'), 'orchard');
  assert.equal(
    JSON.parse(state.storage.get('revealline.classic-snake.presentation.v1')).boardScene,
    'orchard',
  );
  assert.equal(state.document.body.dataset.playing, 'false');
});

test('saved Living Circuit cosmetics apply when no explicit scene is linked', async () => {
  const state = await harness({
    cosmetics: { boardStyle: 'living-circuit', boardScene: 'workshop' },
  });
  assert.equal(state.document.body.dataset.boardStyle, 'living-circuit');
  assert.equal(state.$('board-scene').value, 'workshop');
  state.frame(0);
  assert.equal(state.drawings.at(-1).options.boardScene, 'workshop');
});

for (const mode of ['solo', 'team', 'versus']) {
  test(`${mode} retries change only hazard timing while Continue preserves its accepted seed`, async () => {
    const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-field-signal-check');
    const state = await harness({ entry, mode });
    const initial = state.created[0];
    const seed = initial.hazardSeed;
    assert.equal(Number.isInteger(seed), true);
    if (mode === 'versus') assert.equal(state.created[1].hazardSeed, seed);
    state.shell.open('pause');
    state.$('continue').click();
    state.frame(0);
    assert.equal(state.drawings.at(-1).run.hazardSeed, seed);
    state.retry();
    const next = state.created.at(-1);
    assert.notEqual(next.hazardSeed, seed);
    assert.equal(next.seed, initial.seed);
    assert.deepEqual(next.level, initial.level);
    if (mode === 'versus') assert.equal(state.created.at(-2).hazardSeed, next.hazardSeed);
  });
}

test('new attempt seed remains fresh even if a random source repeats', () => {
  const random = {
    getRandomValues(bytes) {
      bytes[0] = 19;
    },
  };
  assert.equal(nextClassicHazardSeed(undefined, random), 19);
  assert.notEqual(nextClassicHazardSeed(19, random), 19);
});

test('Pause offers Skip and Random only when their current setup can launch another mission', async () => {
  for (const setup of [
    { mode: 'solo', activity: 'campaign', skip: true, random: true },
    { mode: 'team', activity: 'campaign', skip: true, random: true },
    { mode: 'versus', activity: 'campaign', skip: false, random: true },
    { mode: 'solo', activity: 'endless', skip: false, random: true },
    { mode: 'versus', activity: 'endless', query: '&duel=score', skip: false, random: true },
    { mode: 'versus', activity: 'endless', query: '&duel=survival', skip: false, random: false },
    {
      entry: CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-field-field-finale'),
      skip: false,
      random: true,
    },
  ]) {
    const state = await harness(setup);
    state.shell.open('pause');
    assert.equal(state.shell.elements.buttons['pause-skip'].hidden, !setup.skip);
    assert.equal(state.shell.elements.buttons['pause-random'].hidden, !setup.random);
    const before = state.created[0];
    if (setup.random) {
      state.shell.elements.buttons['pause-random'].click();
      const next = state.created.at(-1);
      assert.notEqual(next.level.id, before.level.id);
      assert.equal(next.seed, before.seed);
      assert.equal(next.level.objective ?? 'mission', before.level.objective ?? 'mission');
      assert.equal(state.document.body.dataset.playing, 'true');
      assert.equal(state.shell.topDialog(), null);
    }
  }
});

test('Choose mission card restarts the same completed mission directly', async () => {
  const state = await harness();
  await importSession(state.$, clearedSession());
  state.shell.open('missions');
  const previous = state.created.at(-1);
  libraryCard(state, previous.level.id).click();
  await flush();
  assert.notEqual(state.created.at(-1), previous);
  assert.deepEqual(state.created.at(-1).level, previous.level);
  assert.equal(state.created.at(-1).seed, previous.seed);
  assert.equal(state.document.body.dataset.playing, 'true');
  assert.equal(state.shell.topDialog(), null);
});

test('Choose mission card after a jammer crash launches a fresh schedule for the same setup', async () => {
  const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-field-signal-check');
  const state = await harness({ entry });
  state.frame(0);
  const previous = state.created[0];
  for (let now = 50; now < 10000 && previous.status === 'running'; now += 50) state.frame(now);
  assert.equal(previous.status, 'lost');
  state.shell.open('missions');
  libraryCard(state, entry.id).click();
  await flush();
  const next = state.created.at(-1);
  assert.notEqual(next.hazardSeed, previous.hazardSeed);
  assert.equal(next.seed, previous.seed);
  assert.deepEqual(next.level, previous.level);
  assert.equal(state.document.body.dataset.playing, 'true');
});

test('unfocused direct entry waits for the player and BFCache return reacquires saving ownership', async () => {
  const state = await harness({ focused: false });
  state.frame(0);
  state.frame(400);
  assert.equal(state.created[0].tick, 0);
  assert.equal(state.document.body.dataset.playing, 'false');
  state.setFocused(true);
  state.start();
  state.frame(450);
  state.frame(650);
  assert.equal(state.created[0].tick, 1);
  const firstWriter = state.writerClaims[0];
  state.window.emit('pagehide', { persisted: true });
  await flush();
  assert.equal(firstWriter.writable, false);
  const savedBefore = JSON.parse(state.storage.get('revealline.classic-snake.round.v2'));
  state.window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(state.writerClaims.length, 2);
  assert.equal(state.writerClaims[1].writable, true);
  const savedAfter = JSON.parse(state.storage.get('revealline.classic-snake.round.v2'));
  assert.notEqual(savedAfter.statistics.attemptId, savedBefore.statistics.attemptId);
  assert.deepEqual(savedAfter.statistics.counts, savedBefore.statistics.counts);
  assert.deepEqual(savedAfter.match, savedBefore.match, 'ownership recovery preserves the board');
  assert.equal(
    state.document.body.dataset.playing,
    'false',
    'reacquiring saving does not resume play',
  );
});

test('completed local Continue shows its verified grade while imported recordings never auto-advance', async () => {
  const state = await harness();
  flyVerifiedRoute(state);
  await flush();
  state.$('continue').click();
  assert.equal(state.$('snake-stars').textContent, '★★★');
  const imported = await harness();
  await importSession(imported.$, clearedSession());
  assert.match(imported.$('snake-stars').textContent, /no new awards/);
  for (let now = 0; now <= 12000; now += 50) imported.frame(now);
  assert.equal(imported.created.length, 1);
  assert.equal(imported.shell.topDialog(), imported.shell.elements.dialogs.results);
});

test('Enter on celebration actions retains the focused button action', async () => {
  const state = await harness();
  flyVerifiedRoute(state);
  const home = [...state.document.querySelector('.snake-continuation').children].find(
    (node) => node.textContent === 'Home',
  );
  home.focus();
  const press = home.emit('keydown', { key: 'Enter', code: 'Enter', repeat: false });
  assert.equal(press.defaultPrevented, false);
  assert.equal(state.created.length, 1, 'global Enter cannot turn Home into Next');
  home.click();
  assert.equal(state.shell.topDialog(), state.shell.elements.home);
});

test('direct entry needs no briefing and ordinary defeat replays then retries within three seconds', async (t) => {
  const state = await harness();
  assert.equal(state.shell.topDialog(), null);
  assert.equal(state.document.body.dataset.playing, 'true');
  state.frame(0);
  let now = 0;
  while (state.created[0].status === 'running') state.frame((now += 50));
  assert.equal(state.celebrations.length, 0, 'a loss never creates fireworks');
  const lostAt = now;
  assert.equal(state.shell.elements.root.dataset.transitionPhase, 'loss-effect');
  assert.equal(
    state.shell.elements.buttons.pause.disabled,
    false,
    'Pause can stop automatic recovery',
  );
  while (state.created.length === 1 && now < lostAt + 3200) state.frame((now += 50));
  assert.equal(state.created.length, 2);
  assert.ok(now - lostAt >= 2850 && now - lostAt <= 3050);
  t.diagnostic(
    `Measured default defeat-to-retry: ${now - lostAt} ms, 0 activations (50 ms host frame).`,
  );
  assert.equal(state.created[1].seed, state.created[0].seed);
  assert.deepEqual(state.created[1].level, state.created[0].level);
  assert.equal(state.document.body.dataset.playing, 'true');
});

test('victory keeps full celebration then countdown; Next during celebration launches in one activation', async () => {
  const celebrationMs = flowHelpers.VICTORY_CELEBRATION_MS;
  const state = await harness();
  let now = flyVerifiedRoute(state);
  assert.equal(state.celebrations.length, 1);
  assert.equal(state.shell.topDialog(), null);
  for (let elapsed = 50; elapsed < celebrationMs; elapsed += 50) state.frame(now + elapsed);
  assert.equal(state.shell.topDialog(), null, 'the full celebration remains visible');
  state.document.querySelector('.snake-continuation .primary').click();
  assert.equal(state.document.body.dataset.playing, 'true');
  assert.equal(state.shell.topDialog(), null);
  assert.equal(
    new URL(state.location.href).searchParams.get('level'),
    'classic-snake-two-landings',
  );

  const automatic = await harness();
  now = flyVerifiedRoute(automatic);
  for (let elapsed = 50; elapsed <= celebrationMs + 100; elapsed += 50)
    automatic.frame(now + elapsed);
  assert.equal(automatic.shell.topDialog(), automatic.shell.elements.dialogs.results);
  assert.equal(automatic.document.activeElement, automatic.$('next'));
  for (let elapsed = celebrationMs + 150; elapsed <= celebrationMs + 4900; elapsed += 50)
    automatic.frame(now + elapsed);
  assert.equal(automatic.created.length, 1, 'countdown follows rather than overlaps celebration');
  for (let elapsed = celebrationMs + 4950; elapsed <= celebrationMs + 5050; elapsed += 50)
    automatic.frame(now + elapsed);
  assert.equal(automatic.document.body.dataset.playing, 'true');
  assert.equal(
    new URL(automatic.location.href).searchParams.get('level'),
    'classic-snake-two-landings',
  );
});

test('Home and backgrounding permanently cancel automatic progression for the completed attempt', async () => {
  for (const action of ['home', 'background']) {
    const state = await harness();
    const now = flyVerifiedRoute(state);
    if (action === 'home') state.shell.openHome();
    else {
      state.document.hidden = true;
      state.document.emit('visibilitychange');
      state.document.hidden = false;
    }
    for (let elapsed = 50; elapsed <= 12000; elapsed += 50) state.frame(now + elapsed);
    assert.equal(state.created.length, 1, action);
    assert.equal(state.document.body.dataset.playing, 'false');
  }
});

test('selecting a new library mission launches directly while retaining the older Workshop save', async () => {
  const state = await harness();
  state.start();
  state.frame(0);
  state.frame(100);
  state.shell.open('missions');
  const priorSave = state.storage.get('revealline.classic-snake.round.v2');
  assert.equal(JSON.parse(priorSave).levelId, CLASSIC_SNAKE_LEVELS[0].id);
  const selected = CLASSIC_SNAKE_LEVELS[1];
  libraryCard(state, selected.id).click();
  await flush();
  assert.equal(state.shell.topDialog(), null);
  assert.equal(state.document.body.dataset.playing, 'true');
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

test('the Snake library shows all missions and filters without changing the paused attempt', async () => {
  const state = await harness();
  state.frame(0);
  state.frame(200);
  state.shell.open('missions');
  const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
  assert.equal(state.$('journey-cards').children.length, 144);
  assert.equal(state.$('journey-campaign-rail').children.length, 23);
  const first = libraryCard(state, CLASSIC_SNAKE_LEVELS[0].id);
  state.$('journey-search').value = 'Quiet Channel';
  state.$('journey-search').emit('input');
  assert.equal(state.$('journey-cards').children.length, 1);
  state.$('journey-mode').value = 'team';
  state.$('journey-mode').emit('change');
  state.frame(1200);
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    before,
  );
  assert.equal(new URL(state.location.href).searchParams.get('mode'), 'solo');
  state.$('journey-search').value = '';
  state.$('journey-search').emit('input');
  assert.equal(libraryCard(state, CLASSIC_SNAKE_LEVELS[0].id), first);
  state.$('journey-back').click();
  assert.equal(state.$('journey-chooser').open, false);
  assert.equal(state.document.body.dataset.playing, 'false');
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    before,
  );
});

test('Snake library mode selection launches the exact chosen Team mission with one activation', async () => {
  const state = await harness();
  state.shell.open('missions');
  state.$('journey-mode').value = 'team';
  state.$('journey-mode').emit('change');
  const selected = CLASSIC_SNAKE_LEVELS.at(-1);
  libraryCard(state, selected.id).click();
  await flush();
  assert.equal(state.created.at(-1).level.id, selected.id);
  assert.equal(state.created.at(-1).snakes.length, 2);
  assert.equal(new URL(state.location.href).searchParams.get('mode'), 'team');
  assert.equal(state.$('journey-chooser').open, false);
  assert.equal(state.shell.topDialog(), null);
  assert.equal(state.document.body.dataset.playing, 'true');
});

test('a mode change in Snake rules remains selected when returning to the existing library', async () => {
  const state = await harness();
  state.shell.open('missions');
  state.$('snake-library-rules').click();
  state.$('mode-tabs').querySelector('[data-mode="team"]').click();
  assert.equal(state.created.at(-1).snakes.length, 2);
  state.shell.back();
  assert.equal(state.$('journey-chooser').open, true);
  assert.equal(state.$('journey-mode').value, 'team');
  libraryCard(state, CLASSIC_SNAKE_LEVELS[1].id).click();
  await flush();
  assert.equal(state.created.at(-1).snakes.length, 2);
  assert.equal(new URL(state.location.href).searchParams.get('mode'), 'team');
  assert.equal(state.document.body.dataset.playing, 'true');
});

test('Snake mission information and copied links follow the browsed row without selecting an attempt', async () => {
  const state = await harness();
  state.shell.open('missions');
  const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
  const selected = CLASSIC_SNAKE_LEVELS.at(-1);
  libraryCard(state, selected.id).focus();
  state.$('snake-library-info').click();
  assert.equal(state.$('snake-library-info-title').textContent, selected.title.en);
  state.$('snake-library-info-dialog').querySelector('button').click();
  assert.equal(state.$('journey-chooser').open, true);
  state.$('snake-library-copy').click();
  await flush();
  assert.equal(
    new URL(state.$('snake-library-status').textContent).searchParams.get('level'),
    selected.id,
  );
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    before,
  );
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
  assert.ok(
    state.drawings.at(-1).run.tick >= visibleTick,
    'Leaving replay restores the completed board',
  );
  state.shell.elements.buttons['settings-back'].click();
  assert.equal(state.shell.topDialog(), state.shell.elements.home);
  assert.equal(state.shell.elements.buttons['home-results'].hidden, false);
  state.shell.elements.buttons['home-results'].click();
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.results);
  state.frame(3360);
  assert.ok(
    state.drawings.at(-1).run.tick >= visibleTick,
    'Leaving replay restores the completed board',
  );
  assert.equal(state.document.body.dataset.playing, 'false');
  state.$('review').click();
  for (let now = 3600; now <= 6000; now += 240) state.frame(now);
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.results);
  assert.equal(state.document.body.dataset.playing, 'false');
});

test('results replay the last eight moves automatically without hiding actions or changing the saved attempt', async () => {
  const state = await harness();
  await importSession(state.$, clearedSession());
  const footer = state.shell.elements.dialogs.results.querySelector('footer');
  assert.ok(footer.contains(state.$('next')));
  assert.ok(footer.contains(state.shell.elements.buttons.retry));
  assert.equal(state.$('review').getAttribute('aria-pressed'), 'true');
  const saved = state.storage.get('revealline.classic-snake.round.v2');
  const replay = () =>
    state.drawings.filter((item) => item.canvas.classList.contains('snake-result-board')).at(-1);
  state.frame(0);
  const firstTick = replay().run.tick;
  state.frame(240);
  assert.equal(replay().run.tick, firstTick + 1);
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.results);
  state.$('review').click();
  state.frame(480);
  const pausedTick = replay().run.tick;
  state.frame(720);
  assert.equal(replay().run.tick, pausedTick, 'Pause replay freezes only the preview');
  assert.equal(state.document.body.dataset.playing, 'false');
  assert.equal(state.storage.get('revealline.classic-snake.round.v2'), saved);
  state.shell.openHome();
  state.shell.elements.buttons['home-results'].click();
  assert.equal(
    state.document.activeElement,
    state.$('next'),
    'Next is preferred even in the fixed footer',
  );
});

test('Next retires the completed result and directly launches the ordered next mission', async () => {
  const state = await harness();
  await importSession(state.$, clearedSession());
  assert.equal(state.$('next').hidden, false);
  state.$('next').click();
  assert.equal(state.shell.elements.dialogs.results.open, false);
  assert.equal(state.shell.elements.root.dataset.phase, 'playing');
  assert.equal(state.shell.topDialog(), null);
  assert.notEqual(
    new URL(state.location.href).searchParams.get('level'),
    CLASSIC_SNAKE_LEVELS[0].id,
  );
  state.shell.open('pause');
  assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.pause);
  assert.equal(state.document.body.dataset.playing, 'false');
  const selected = new URL(state.location.href);
  const sim = new URL(state.optionalEntries.at(-1).bundledHref);
  assert.equal(new URL(sim.searchParams.get('game-return'), selected).href, selected.href);
});

test('legacy migration preserves a verified historical seed', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 71 });
  const state = await harness();
  await importSession(state.$, savedSession(run));
  assert.equal(state.$('save-status').textContent, CLASSIC_COPY.en.loaded);
  assert.equal(new URL(state.location.href).searchParams.get('seed'), '71');
  state.retry();
  assert.equal(state.created.at(-1).seed, 71);
});

function archivedSession({ tamper = false, profiled = false } = {}) {
  const entry = profiled
    ? CLASSIC_SNAKE_ARCHIVED_LEVELS.find((row) =>
        row.level.targets.required.some((target) => target.signalProfile === 'local-burst-v1'),
      )
    : CLASSIC_SNAKE_ARCHIVED_LEVELS[0];
  const level = prepareClassicSnakeLevel(entry, { pace: 'slow' });
  if (tamper) level.goal--;
  const match = matches.createClassicSnakeMatch(level, {
    seed: 71,
    ...(profiled ? { hazardSeed: 17 } : {}),
  });
  matches.advanceClassicSnakeMatchTo(match, level.stepMs * 2);
  return {
    format: 'revealline-classic-snake-session.v2',
    activity: 'campaign',
    levelId: entry.id,
    mode: 'solo',
    pace: 'slow',
    targetRules: 'authored',
    preset: 'classic',
    duel: 'score',
    seed: 71,
    style: 'cable',
    match: matches.exportClassicSnakeMatch(match),
  };
}

for (const action of ['Continue', 'Import'])
  for (const profiled of [false, true]) {
    test(`${action} admits exact archived ${profiled ? 'local-v1' : 'unprofiled'} jammer recipes and Retry preserves their setup`, async () => {
      const session = archivedSession({ profiled });
      const state = await harness({ savedRound: action === 'Continue' ? session : null });
      if (action === 'Continue') state.$('continue').click();
      else await importSession(state.$, session);
      assert.equal(state.$('save-status').textContent, CLASSIC_COPY.en.loaded);
      assert.equal(state.document.body.dataset.playing, 'true');
      state.frame(0);
      const restored = state.drawings.at(-1).run;
      assert.equal(restored.tick, 2);
      assert.equal(restored.seed, 71);
      assert.deepEqual(core.exportClassicSnakeReplay(restored), session.match.replays[0]);
      state.retry();
      const retry = state.created.at(-1);
      assert.deepEqual(retry.level, restored.level);
      if (profiled) {
        assert.equal(restored.hazardSeed, 17);
        assert.ok(Number.isSafeInteger(retry.hazardSeed));
        assert.ok(
          retry.level.targets.required.some((target) => target.signalProfile === 'local-burst-v1'),
        );
      } else assert.equal(retry.hazardSeed, undefined);
      assert.equal(retry.seed, 71);
      assert.equal(retry.tick, 0);
    });
  }

test('a self-consistent same-ID old recipe cannot bypass exact archived admission', async () => {
  const state = await harness();
  await importSession(state.$, archivedSession({ tamper: true }));
  assert.equal(state.$('save-status').textContent, CLASSIC_COPY.en.invalid);
  state.retry();
  assert.equal(state.created.at(-1).level.id, CLASSIC_SNAKE_LEVELS[0].id);
});

test('legacy migration rejects a tampered historical seed and keeps the current round', async () => {
  const session = clearedSession();
  session.replays[0].seed = 71;
  const state = await harness();
  await importSession(state.$, session);
  assert.equal(state.$('save-status').textContent, CLASSIC_COPY.en.invalid);
  assert.equal(new URL(state.location.href).searchParams.get('seed'), '17');
  state.retry();
  assert.equal(state.created.at(-1).seed, 17);
});

test('a scheduled terminal result cannot be restored with a later host clock', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 17 });
  while (run.status === 'running') core.stepClassicSnake(run);
  const { $, shell } = await harness();
  await importSession($, savedSession(run, run.elapsedMs + 0.5));
  assert.equal($('save-status').textContent, CLASSIC_COPY.en.invalid);
  assert.equal(shell.elements.root.dataset.phase, 'paused');
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

test('a V2 round saves its accepted timeline and Continue launches directly', async () => {
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
  assert.equal(saved.format, 'revealline-classic-snake-session.v3');
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
  assert.equal(resumed.shell.elements.root.dataset.phase, 'playing');
  assert.equal(resumed.document.body.dataset.playing, 'true');
  assert.equal(new URL(resumed.location.href).searchParams.get('level'), entry.id);
  resumed.frame(0);
  resumed.frame(500);
  assert.equal(resumed.document.body.dataset.playing, 'true');
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
  assert.equal(imported.shell.elements.root.dataset.phase, 'paused');
});

test('Classic flight animation follows play, pause and effective Reduced effects without stopping movement', async () => {
  const state = await harness();
  const latest = () => state.drawings.at(-1).options;
  state.shell.open('home');
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

test('Snake nested tools preserve iframe input and controller Back returns to the exact paused Settings owner', async (t) => {
  const h = await harness({ sharedTools: true });
  t.after(() => h.disposeTools());
  h.start();
  h.frame(0);
  h.frame(100);
  h.shell.elements.buttons.pause.click();
  const paused = h.created.map((run) => core.exportClassicSnakeReplay(run));
  h.shell.elements.buttons.settings.click();
  h.$('snake-menu-settings-tab-controls').click();
  const opener = h.$('snake-global-tools-controllerTools');
  opener.focus();
  opener.click();
  const dialog = h.$('snake-global-tools-tool-dialog'),
    frame = dialog.querySelector('iframe');
  assert.equal(dialog.open, true);
  frame.focus();
  const pad = menuPad();
  h.pads.push(pad);
  h.frame(120);
  pad.buttons[13] = { pressed: true, value: 1 };
  h.frame(140);
  pad.buttons[13] = { pressed: false, value: 0 };
  h.frame(160);
  assert.equal(h.document.activeElement, frame, 'D-pad input stays inside the tool frame.');
  assert.deepEqual(
    h.created.map((run) => core.exportClassicSnakeReplay(run)),
    paused,
  );
  pad.buttons[1] = { pressed: true, value: 1 };
  h.frame(180);
  pad.buttons[1] = { pressed: false, value: 0 };
  h.frame(200);
  assert.equal(dialog.open, false);
  assert.equal(h.shell.elements.dialogs.settings.open, true);
  assert.equal(h.document.activeElement, opener);
  assert.deepEqual(
    h.created.map((run) => core.exportClassicSnakeReplay(run)),
    paused,
  );
});

test('Snake reading controls update the shared display owner without replacing or advancing an attempt', async () => {
  const state = await harness({ mode: 'team' });
  const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
  state.shell.open('settings');
  state.$('snake-text-size').value = 'large';
  state.$('snake-text-size').emit('change');
  state.$('snake-text-face').value = 'plain';
  state.$('snake-text-face').emit('change');
  assert.equal(state.display.textSize, 'large');
  assert.equal(state.display.textFace, 'plain');
  assert.equal(state.document.body.dataset.textSize, 'large');
  assert.equal(state.document.body.dataset.textFace, 'plain');
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    before,
  );
  assert.equal(state.shell.blocksPlay(), true);
});

test('actual Snake links and optional SIM launch retain an explicit native review without changing recipes', async () => {
  for (const mode of ['solo', 'versus', 'team']) {
    const state = await harness({ mode, artReview: 'industrial-roster-v3' });
    const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
    for (const id of ['home-link', 'campaign-link', 'remix-link', 'studio-link']) {
      const url = new URL(state.$(id).href, state.location.href);
      assert.equal(url.searchParams.get('artReview'), 'industrial-roster-v3', id);
    }
    const links = state.$('snake-mode-links').querySelectorAll('a');
    assert.equal(links.length, 3);
    for (const link of links) {
      assert.equal(new URL(link.href).searchParams.get('artReview'), 'industrial-roster-v3');
      link.click();
      assert.equal(new URL(link.href).searchParams.get('artReview'), 'industrial-roster-v3');
    }
    const sim = new URL(state.optionalEntries.at(-1).bundledHref);
    assert.equal(sim.searchParams.get('artReview'), 'industrial-roster-v3');
    const back = new URL(sim.searchParams.get('game-return'), sim);
    assert.equal(
      back.searchParams.get('level'),
      new URL(state.location.href).searchParams.get('level'),
    );
    assert.equal(back.searchParams.get('artReview'), 'industrial-roster-v3');
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    const normal = await harness({ mode });
    assert.equal(
      new URL(normal.$('campaign-link').href, normal.location.href).searchParams.has('artReview'),
      false,
    );
  }
});

// These are host projection fixtures, not simulated playthroughs. Set accepted
// board positions/phase at an observation boundary and render without stepping;
// core coverage, scheduling and replay tests separately own those transitions.
function receptionFixtureBoard(run, { inside = false, phase = 'jamming', player = 0 } = {}) {
  const source = run.targets.find((target) => target.kind === 'jammer');
  assert.ok(source);
  source.phase = phase;
  for (const snake of run.snakes) snake.body[0] = { x: 3, y: 2 };
  if (inside) run.snakes[player].body[0] = { x: source.x - 1, y: source.y };
  return source;
}
function receptionEntry(profile) {
  return [...CLASSIC_SNAKE_LEVELS, ...CLASSIC_SNAKE_ARCHIVED_LEVELS].find(
    (item) =>
      item.id === 'classic-field-signal-check' &&
      item.level.targets.required.find((target) => target.kind === 'jammer')?.signalProfile ===
        profile,
  );
}
async function receptionHarness(profile, mode = 'solo') {
  const entry = receptionEntry(profile);
  assert.ok(entry, `${profile ?? 'unprofiled'} official recipe must remain available`);
  return harness({
    entry,
    mode,
    catalogue: CLASSIC_SNAKE_LEVELS.map((row) => (row.id === entry.id ? entry : row)),
  });
}
const receptionLabels = (state) => [...state.document.querySelectorAll('.snake-reception')];

for (const profile of ['local-burst-v1', 'local-burst-v2'])
  test(`${profile} host reception reflects actual coverage instead of a distant transmitter phase`, async () => {
    const state = await receptionHarness(profile);
    const run = state.created[0];
    receptionFixtureBoard(run);
    state.frame(0);
    const [label] = receptionLabels(state);
    assert.equal(label.hidden, false, 'the source remains discoverable outside its range');
    assert.equal(label.dataset.reception, 'signalClear');
    assert.match(label.textContent, /Clear reception/);
    assert.equal(
      run.targets[0].phase,
      'jamming',
      'host presentation does not edit historical phase',
    );
    receptionFixtureBoard(run, { inside: true });
    state.frame(1);
    assert.equal(label.dataset.reception, 'signalJammed');
    assert.match(label.textContent, /Interference/);
    assert.match(label.getAttribute('aria-label'), /Enemies keep moving unseen/);
    assert.match(label.getAttribute('aria-label'), /antenna beacon, leave its range, or use Pulse/);
    receptionFixtureBoard(run, { phase: 'warning' });
    state.frame(2);
    assert.equal(
      label.dataset.reception,
      'signalClear',
      'a warning beyond the radius is not a local warning',
    );
    receptionFixtureBoard(run, { inside: true, phase: 'warning' });
    state.frame(3);
    assert.equal(label.dataset.reception, 'signalWarning');
    run.pulseTicks = 3;
    state.frame(4);
    assert.equal(label.dataset.reception, 'signalStable');
    assert.equal(run.tick, 0, 'these host checks do not advance the fixture simulation');
  });

test('Versus reception belongs to each board rather than the most exposed opponent', async () => {
  const state = await receptionHarness('local-burst-v2', 'versus');
  const [left, right] = state.created;
  receptionFixtureBoard(left, { inside: true });
  receptionFixtureBoard(right);
  state.frame(0);
  assert.deepEqual(
    receptionLabels(state).map((label) => label.dataset.reception),
    ['signalJammed', 'signalClear'],
  );
  receptionFixtureBoard(left);
  receptionFixtureBoard(right, { inside: true, phase: 'warning' });
  state.frame(1);
  assert.deepEqual(
    receptionLabels(state).map((label) => label.dataset.reception),
    ['signalClear', 'signalWarning'],
  );
});

test('Team exposes one shared reception status when either living head enters local coverage', async () => {
  const state = await receptionHarness('local-burst-v2', 'team');
  const run = state.created[0];
  assert.equal(run.snakes.length, 2);
  receptionFixtureBoard(run);
  state.frame(0);
  const labels = receptionLabels(state);
  assert.equal(labels.length, 1);
  assert.equal(labels[0].dataset.reception, 'signalClear');
  receptionFixtureBoard(run, { inside: true, player: 1 });
  state.frame(1);
  assert.equal(labels[0].dataset.reception, 'signalJammed');
  receptionFixtureBoard(run);
  state.frame(2);
  assert.equal(labels[0].dataset.reception, 'signalClear');
});

test('original unprofiled jammer remains broadcast in the host instead of receiving invented range rules', async () => {
  const state = await receptionHarness(undefined);
  receptionFixtureBoard(state.created[0]);
  state.frame(0);
  const [label] = receptionLabels(state);
  assert.equal(label.dataset.reception, 'signalJammed');
  assert.match(label.getAttribute('aria-label'), /double antenna/);
});
