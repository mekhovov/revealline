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
  sharedTools = false,
  focused = true,
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
  const created = [],
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
  const location = {
    href: `https://example.test/game/snake/play.html?mode=${mode}&level=${entry.id}&activity=${activity}`,
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
  const context = createContext({
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
    createClassicSnake(...args) {
      return core.createClassicSnake(...args.map((argument) => structuredClone(argument)));
    },
    restoreClassicSnakeLegacyMatch(source, options) {
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
    drawings,
    celebrations,
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

test('legacy migration rejects a changed historical seed and keeps the current round', async () => {
  const run = core.createClassicSnake(CLASSIC_SNAKE_LEVELS[0].level, { seed: 71 });
  const state = await harness();
  await importSession(state.$, savedSession(run));
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
