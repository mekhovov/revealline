import { effectiveTextSize } from '../text-size.mjs';
import { renderTextSizeControl } from '../ui/text-size-control.mjs';
import { CLASSIC_SNAKE_CAMPAIGN_REVISION } from '../snake/classic-campaign.mjs';
const SAVE_KEY = `revealline.classic-snake.round.${CLASSIC_SNAKE_CAMPAIGN_REVISION}`;
import { classicOperationStatus } from '../snake/classic-operation-status.mjs';
import { OPERATION_PROTOTYPES } from './manual/snake-operation-recipes.mjs';
import { classicBoardPreferences, isClassicWorldStyle } from '../snake/classic-worlds.mjs';
import { nextInputModality, showScreenControls } from '../input-presentation.mjs';
import { createTouchPreferences } from '../touch-preferences.mjs';
import { attachTouchSteering } from '../ui/touch-steering.mjs';
import {
  mountTouchControlsView,
  mountTouchPresentationSettings,
} from '../ui/touch-controls-view.mjs';
import {
  classicSnakeRatingForRecord,
  classicSnakeRatingCriteriaText,
  classicSnakeRatingResultText,
} from '../snake/classic-ratings.mjs';
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
import { attachLocalSupportSummary } from '../ui/local-support-summary.mjs';
import { collectSupportSummary } from '../local-support-summary.mjs';
import { offlineAvailability } from '../offline.mjs';
import { nativePlatform } from '../platform.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { attachInstallOfflinePanel } from '../ui/install-offline-panel.mjs';
import { menuPad } from './helpers/global-tools-fixture.mjs';
import { mountGlobalSettings } from '../ui/global-settings-view.mjs';
import { menuAnimationBinding, MENU_ANIMATION_KEY } from '../ui/menu-animation-preferences.mjs';
import { mountComfortPresets } from '../ui/comfort-presets.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { mountBattlefieldGroundControls } from '../ui/battlefield-ground-controls.mjs';
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
  classicSnakeMissionSettings,
  classicSnakeSurvivalEntry,
  CLASSIC_PACES,
} from '../snake/classic-setup.mjs';
import { ACTOR_CASTS, actorFieldGuide } from '../hunt/actor-catalog.mjs';
import { mountModeSettings } from '../ui/mode-settings-view.mjs';
import { attachDefeatSoundControls } from '../ui/defeat-sound-controls.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
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
import {
  advanceClassicReactionTime,
  observeClassicWorldReactions,
} from '../snake/classic-world-reactions.mjs';
import { t, getLocale as summaryLocale, setLocale as setSummaryLocale } from '../i18n/index.mjs';
import { getLocale as getSharedLocale, setLocale as setSharedLocale } from '../i18n/index.mjs';
import {
  createCouchKeyboardPreferences,
  SNAKE_KEYBOARD_KEY,
  COUCH_KEYBOARD_KEY,
  TEAM_KEYBOARD_KEY,
} from '../couch/keyboard-preferences.mjs';
import { mountCouchKeyboardSettings } from '../couch/keyboard-settings.mjs';
import {
  couchKeyMap,
  couchDirectionLabel,
  resolveCouchKeyboard,
  replaceCouchKey,
} from '../couch/keyboard-bindings.mjs';
import { keyCodeForEvent } from '../key-bindings.mjs';
import { KeyboardLocks, keyboardTurn } from './helpers/keyboard-locks.mjs';
import { mountEnemyAppearanceControls } from '../ui/enemy-appearance-controls.mjs';
import { prepareClassicEnvironments } from '../snake/classic-environment.mjs';
import { selectedArcadeCollection } from '../presentation/industrial-arcade.mjs';
import {
  acceptAttemptAppearance,
  restoreAttemptAppearance,
  snapshotAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';

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
  locale,
  keyboardStorageMode = { value: 'working' },
  keyboardLocks = new KeyboardLocks(),
  activity = 'campaign',
  sharedTools = false,
  liveLocale = false,
  realDisplay = false,
  directEntry = true,
  focused = true,
  artReview = null,
  query = '',
  cosmetics = null,
  savedRound = null,
  legacySavedRound = null,
  recordReceipt = { verified: true, saved: true },
  recordBest = null,
  catalogue = CLASSIC_SNAKE_LEVELS,
  language = 'en',
  initialTextSize = 'standard',
  supportCollect = null,
  supportExport = null,
  sharedToolOptions = {},
  touchStorage = null,
} = {}) {
  const document = new Document();
  let harnessLocale = locale ?? language;
  const localeListeners = new Set();
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
  // Browser key capture travels through Window before the document and focused control.
  document.parentNode = window;
  const pads = [];
  const supportExports = [];
  let supportUI = null;
  let supportNow = 0,
    padReads = 0;
  let tools, offlinePanel, offlineOptions;
  const storage = new Map();
  if (savedRound) storage.set(SAVE_KEY, JSON.stringify(savedRound));
  if (legacySavedRound)
    storage.set('revealline.classic-snake.round.v2', JSON.stringify(legacySavedRound));
  if (cosmetics) storage.set('revealline.classic-snake.presentation.v1', JSON.stringify(cosmetics));
  const created = [],
    drawings = [],
    previewDrawings = [],
    celebrations = [],
    resultReactions = [],
    scheduledFrames = [],
    optionalEntries = [];
  const display = {
    textFace: 'pixel',
    textSize: initialTextSize,
    effectiveTextSize: effectiveTextSize(initialTextSize),
    reducedEffects: false,
    effectiveReducedEffects: false,
    revision: 0,
  };
  const displayListeners = new Set();
  let displayOwner,
    displayStorageFails = false;
  const displayStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem(key, value) {
      if (displayStorageFails) throw new Error('Storage unavailable');
      storage.set(key, value);
    },
  };
  if (realDisplay)
    storage.set(
      DISPLAY_PREFERENCES_KEY,
      JSON.stringify({
        textFace: 'pixel',
        textSize: initialTextSize,
        reducedEffects: false,
      }),
    );
  const location = {
    href: `https://example.test/game/snake/play.html?mode=${mode}${directEntry ? `&level=${entry.id}` : ''}&activity=${activity}${artReview ? `&artReview=${encodeURIComponent(artReview)}` : ''}${query}`,
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
    appearanceActions = [],
    acceptedAppearances = [];
  const context = createContext({
    CLASSIC_SNAKE_CAMPAIGN_REVISION,
    createCouchKeyboardPreferences,
    mountCouchKeyboardSettings,
    couchKeyMap,
    couchDirectionLabel,
    keyCodeForEvent,
    classicBoardPreferences,
    isClassicWorldStyle,
    resolveClassicBoardScene,
    classicSceneBackdrop,
    nextClassicHazardSeed,
    resolveClassicSnakeRecipeEntry,
    __appURL: appURL.href,
    prepareClassicEnvironments,
    selectedArcadeCollection,
    acceptAttemptAppearance: (candidate, options) =>
      acceptAttemptAppearance(candidate, structuredClone(options)),
    restoreAttemptAppearance,
    snapshotAttemptAppearance,
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
    classicSnakeRatingCriteriaText,
    classicSnakeRatingResultText,
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
    renderClassicSnakeLibraryPreview(options) {
      previewDrawings.push({ ...options.appearance });
      return renderClassicSnakeLibraryPreview(options);
    },
    mountModePlayShell(options) {
      shell = mountModePlayShell(options);
      return shell;
    },
    attachModalNavigation,
    mountGlobalSettings,
    mountBattlefieldGroundControls,
    attachThemeFamilyControls({ root, mountEnemyAppearance }) {
      const group = document.createElement('section');
      group.setAttribute('data-theme-controls', '');
      root.append(group);
      const enemies = mountEnemyAppearance({
        document,
        container: group,
        locale: () => harnessLocale,
      });
      return { dispose: enemies.dispose };
    },
    mountGlobalSettingsTools: (options) =>
      (tools = sharedTools
        ? mountGlobalSettingsTools({ ...options, ...sharedToolOptions })
        : {
            controls: {},
            root: () => null,
            frameFocused: () => false,
            back: () => false,
            handleFrameCommand: () => false,
            dispose() {},
          }),
    attachLocalSupportSummary: (options) =>
      (supportUI = attachLocalSupportSummary({
        ...options,
        collect: (options) => {
          const collect = () => collectSupportSummary({ ...options, env: context });
          return supportCollect ? supportCollect({ collect, options }) : collect();
        },
        exportFile: async (value) => {
          supportExports.push(structuredClone(value));
          return supportExport ? supportExport(value) : { status: 'requested' };
        },
      })),
    offlineAvailability: () =>
      offlineAvailability({
        documentRef: document,
        locationRef: location,
        navigatorRef: context.navigator,
        secure: true,
      }),
    nativePlatform: () => nativePlatform(location),
    attachInstallOfflinePanel: (options) => {
      offlineOptions = options;
      offlinePanel = attachInstallOfflinePanel({
        ...options,
        // The source module executes from a file URL in this harness; the
        // browser serves it beneath this same-origin game directory.
        downloadsURL: new URL('../downloads.html', location.href),
      });
      return offlinePanel;
    },
    attachMenuAudioSettings() {},
    attachDefeatSoundControls,
    menuAnimationBinding,
    mountComfortPresets,
    mountModeSettings,
    attachSettingsPanels,
    settingsPanelBack,
    settingsTabOwnsKey,
    attachMenuScene: () => ({ dispose() {} }),
    attachFullscreen: () => () => {},
    attachControllerNavigation,
    attachCouchMusicHost: () => ({
      player: { acquireGain: () => () => {} },
      root: () => null,
      primary: () => null,
      async start() {},
      suspend() {},
      async resume() {},
      update() {},
      back() {},
      dispose() {},
    }),
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
      result(context) {
        resultReactions.push(context);
      },
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
      setItem: (key, value) => {
        if (key === SNAKE_KEYBOARD_KEY && keyboardStorageMode.value === 'full')
          throw Object.assign(new Error('Full'), { name: 'QuotaExceededError' });
        if (key !== SNAKE_KEYBOARD_KEY || keyboardStorageMode.value !== 'silent')
          storage.set(key, String(value));
      },
    },
    matchMedia: () => Object.assign(new Events(), { matches: false }),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    dispatchEvent: window.dispatchEvent.bind(window),
    CustomEvent,
    requestAnimationFrame(callback) {
      scheduledFrames.push(callback);
    },
    screen: { orientation: new Events() },
    navigator: { getGamepads: () => (++padReads, pads), locks: keyboardLocks },
    performance: { now: () => supportNow },
    setTimeout,
    getLocale: () => harnessLocale,
    t,
    setLocale(value) {
      harnessLocale = value;
      if (liveLocale) for (const listener of localeListeners) listener(value);
    },
    onLocaleChange(listener) {
      if (liveLocale) localeListeners.add(listener);
      return () => localeListeners.delete(listener);
    },
    createDestructionPreferences: () =>
      createDestructionPreferences({
        window,
        getStorage: () => ({
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
        }),
      }),
    createEncounterDisplayPreferences: () => preferences({ showRemains: true }),
    createDisplayPreferences: (options = {}) => {
      if (realDisplay) {
        displayOwner = createDisplayPreferences({
          ...options,
          window,
          getStorage: () => displayStorage,
        });
        displayOwner.subscribe((value) => Object.assign(display, value));
        return {
          ...displayOwner,
          // The host runs in a VM realm; transfer ordinary patches to the
          // canonical owner just as same-realm browser calls would.
          set: (patch) => displayOwner.set(structuredClone(patch)),
        };
      }
      display.effectiveTextSize = effectiveTextSize(display.textSize, options);
      return {
        snapshot: () => display,
        getWarning: () => '',
        getWarningKey: () => '',
        subscribe(listener) {
          displayListeners.add(listener);
          listener(display);
          return () => displayListeners.delete(listener);
        },
        set(patch) {
          Object.assign(display, patch);
          display.effectiveTextSize = effectiveTextSize(display.textSize, options);
          display.revision++;
          for (const listener of displayListeners) listener(display);
        },
      };
    },
    renderTextSizeControl,
    nextInputModality,
    showScreenControls,
    attachTouchSteering,
    mountTouchControlsView,
    mountTouchPresentationSettings,
    createTouchPreferences: (options) =>
      createTouchPreferences({
        ...options,
        storage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => {
            if (touchStorage?.mode !== 'silent') storage.set(key, value);
          },
        },
        eventTarget: window,
      }),
    createClassicPresentation: () => ({
      snapshot: () => null,
      previewSnapshot: () => null,
      setArtRevision: (revision) => artworkSelections.push(revision),
      setAttemptAppearance(value) {
        acceptedAppearances.push(value);
        artworkSelections.push(value?.artRevision ?? null);
      },
      theme: {
        effectivePreferences: () =>
          enemyStyle === 'military'
            ? {
                arcadeArt: 'follow-game',
                arcadeCollection: { id: 'military-field', revision: 'r1' },
              }
            : { arcadeArt: 'authored' },
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
      async remember() {
        return recordReceipt;
      },
      chapter: () => 0,
      cleared: () => false,
      get: () => recordBest,
      recent: () => null,
    }),
    createHuntDestruction: () => ({ reset() {}, advance() {}, draw() {} }),
    classicCatchMarks: () => [],
    drawClassicBoard(canvas, run, options) {
      drawings.push({ canvas, run, options: { ...options, flight: { ...options.flight } } });
    },
    drawClassicTarget() {},
    advanceClassicFlight,
    advanceClassicReactionTime,
    observeClassicWorldReactions,
    boundedJSON,
    exactKeys,
    required,
    CLASSIC_PACES,
    prepareClassicSnakeLevel,
    classicSnakeMissionSettings,
    classicOperationStatus,
    classicSnakeSurvivalEntry,
    OFFICIAL_CAMPAIGNS: CLASSIC_SNAKE_CAMPAIGNS,
    OFFICIAL_FEATURED: CLASSIC_SNAKE_FEATURED,
    OFFICIAL_CHAPTERS: CLASSIC_SNAKE_CHAPTERS,
    OFFICIAL_LEVELS: catalogue,
    CLASSIC_COPY,
    ...core,
    ...matches,
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
    drawings,
    previewDrawings,
    celebrations,
    resultReactions,
    artworkSelections,
    acceptedAppearances,
    appearanceActions,
    display,
    displayStorage,
    setDisplayStorageFails: (value) => {
      displayStorageFails = value;
    },
    window,
    storage,
    location,
    shell,
    optionalEntries,
    pads,
    supportExports,
    supportUI,
    setFocused: (value) => (focused = value),
    get padReads() {
      return padReads;
    },
    removeGamepadAPI: () => delete context.navigator.getGamepads,
    offlinePanel,
    canActivateOffline: () => offlineOptions.canActivate(),
    disposeTools: () => {
      displayOwner?.dispose();
      tools.dispose();
      offlinePanel.dispose();
    },
    start() {
      shell.open('briefing');
      shell.elements.buttons.start.click();
    },
    retry() {
      shell.open('home');
      shell.elements.buttons['home-retry'].click();
    },
    frame(now) {
      supportNow = now;
      scheduledFrames.shift()(now);
    },
    $: (id) => document.getElementById(id),
  };
}

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode} Snake support reuses observed controllers and preserves paused play and storage`, async (t) => {
    const oldLocale = summaryLocale();
    setSummaryLocale('en', { persist: false });
    t.after(() => setSummaryLocale(oldLocale, { persist: false }));
    const state = await harness({ mode, directEntry: false });
    t.after(() => state.window.emit('pagehide', { persisted: false }));
    state.start();
    state.frame(0);
    state.frame(100);
    state.shell.open('settings');
    state.$('snake-menu-settings-tab-data').click();
    const pad = menuPad();
    pad.id = 'private-snake-device';
    state.pads.push(pad);
    state.frame(110);
    const paused = state.created.map((run) => core.exportClassicSnakeReplay(run)),
      stored = [...state.storage],
      polls = state.padReads;
    const prepare = state.$('support-summary-prepare');
    prepare.focus();
    prepare.click();
    await waitFor(() => !state.$('support-summary-download').disabled);
    const report = JSON.parse(state.$('support-summary-json').textContent);
    assert.equal(report.scope, 'snake-game-shell');
    assert.equal(report.game.host, `snake-${mode}`);
    assert.equal(report.game.state, 'paused');
    assert.equal(report.game.saving.writable, true);
    assert.equal(report.controller.status, 'observed');
    assert.equal(report.controller.assigned, true);
    assert.equal(report.controller.freshness, 'recent');
    assert.equal(report.controller.neutral, null);
    assert.equal(report.controller.confirmBlocked, null);
    assert.equal(report.controller.confirmReason, 'unavailable');
    assert.match(state.$('support-summary-controller').textContent, /not reported/);
    assert.doesNotMatch(JSON.stringify(report), /private-snake-device|axes|buttons|https:/);
    assert.equal(state.padReads, polls, 'Preparing a summary must not poll controllers.');
    assert.equal(state.document.activeElement, prepare);
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      paused,
    );
    assert.deepEqual([...state.storage], stored);
    state.$('support-summary-download').click();
    await waitFor(() => state.supportExports.length === 1);
    assert.deepEqual(state.supportExports[0], report);
    state.pads.length = 0;
    state.frame(120);
    prepare.click();
    await waitFor(() => !state.$('support-summary-download').disabled);
    assert.equal(
      JSON.parse(state.$('support-summary-json').textContent).controller.status,
      'disconnected',
    );
    state.shell.elements.dialogs.settings.close();
    assert.equal(state.$('support-summary-json').textContent, '');
    assert.equal(state.$('support-summary-download').disabled, true);
  });

test('Snake support exposes unknown APIs and released writer honestly, with Ukrainian copy and lifecycle reset', async (t) => {
  const oldLocale = summaryLocale();
  setSummaryLocale('uk', { persist: false });
  t.after(() => setSummaryLocale(oldLocale, { persist: false }));
  const state = await harness({ directEntry: false, language: 'uk' });
  t.after(() => state.window.emit('pagehide', { persisted: false }));
  state.shell.open('settings');
  state.$('snake-menu-settings-tab-data').click();
  state.removeGamepadAPI();
  state.writerClaims.at(-1).release();
  state.frame(100);
  state.$('support-summary-prepare').click();
  await waitFor(() => !state.$('support-summary-download').disabled);
  const report = JSON.parse(state.$('support-summary-json').textContent);
  assert.equal(report.game.state, 'idle');
  assert.equal(report.game.locale, 'uk');
  assert.equal(report.game.saving.writable, false);
  assert.equal(report.game.saving.reason, 'unavailable');
  assert.equal(report.controller.status, 'unavailable');
  assert.equal(report.controller.assigned, null);
  assert.equal(report.storage.retention, 'unavailable');
  assert.equal(report.build.version, null);
  assert.equal(report.offline.files, 'not-verified-here');
  assert.match(state.$('support-summary-title').textContent, /Локальний звіт/);
  assert.doesNotMatch(
    state.$('support-summary-root').textContent,
    /interface:|supportSummary\.|\{\{/,
  );
  state.window.emit('pagehide', { persisted: true });
  assert.equal(state.$('support-summary-download').disabled, true);
  assert.equal(state.$('support-summary-json').textContent, '');
});

for (const mode of ['solo', 'versus', 'team']) {
  test(`${mode} Snake can finish offline setup from Ready but defers during a paused flight`, async (t) => {
    const state = await harness({ mode, sharedTools: true, directEntry: false });
    t.after(() => state.disposeTools());
    assert.equal(state.canActivateOffline(), true);
    state.shell.open('settings');
    state.$('snake-menu-settings-tab-content').click();
    const opener = state.$('snake-global-tools-offlineTools');
    opener.focus();
    opener.click();
    assert.equal(state.offlinePanel.isOpen(), true);
    assert.equal(state.canActivateOffline(), true);
    assert.equal(
      state.offlinePanel.root().querySelector('iframe').src,
      'https://example.test/game/downloads.html?embedded=1',
    );
    state.offlinePanel.close();
    assert.equal(state.document.activeElement, opener);
    assert.equal(state.document.body.dataset.playing, 'false');
    state.start();
    state.frame(0);
    state.frame(100);
    state.shell.open('settings');
    assert.equal(state.canActivateOffline(), false);
    const paused = state.created.map((run) => core.exportClassicSnakeReplay(run));
    state.offlinePanel.open();
    state.offlinePanel.close();
    state.frame(800);
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      paused,
    );
    assert.equal(state.document.body.dataset.playing, 'false');
  });
  test(`${mode} Snake sound choice persists without enabling gore or advancing the paused round`, async () => {
    const state = await harness({ mode });
    state.shell.open('settings');
    const selector = state.$('snake-defeat-sounds');
    const ticks = state.created.map((run) => run.tick);
    assert.equal(selector.value, 'reactions');
    selector.value = 'classic';
    selector.dispatchEvent({ type: 'change' });
    assert.equal(JSON.parse(state.storage.get('revealline.destruction.v1')).vocals, false);
    selector.value = 'reactions';
    selector.dispatchEvent({ type: 'change' });
    const preference = JSON.parse(state.storage.get('revealline.destruction.v1'));
    assert.equal(preference.vocals, true);
    assert.equal(preference.brutal, false);
    assert.deepEqual(
      state.created.map((run) => run.tick),
      ticks,
    );
  });
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

  test(`${mode} Retry retains accepted artwork; a new mission Start accepts the chosen military preset`, async () => {
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
    assert.equal(state.artworkSelections.at(-1), null);
    assert.equal(state.drawings.at(-1).options.artRevision, null);
    assert.deepEqual(
      state.created.slice(before.length).map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    state.shell.open('missions');
    libraryCard(state, CLASSIC_SNAKE_LEVELS[1].id).click();
    await flush();
    state.frame(200);
    assert.equal(state.artworkSelections.at(-1), 'industrial-roster-v3');
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

test('Snake offline activation accepts completed runs and refuses imports, lost ownership and departures', async (t) => {
  const state = await harness({ directEntry: false });
  t.after(() => state.disposeTools());
  assert.equal(state.canActivateOffline(), true);
  let finishImport;
  state.$('import').files = [
    {
      size: 2,
      text: () =>
        new Promise((resolve) => {
          finishImport = resolve;
        }),
    },
  ];
  state.$('import').emit('change');
  assert.equal(state.canActivateOffline(), false, 'unresolved session import owns the board');
  finishImport('{}');
  await flush();
  assert.equal(state.canActivateOffline(), true, 'rejected import releases its operation');
  state.setFocused(false);
  assert.equal(state.canActivateOffline(), false);
  state.setFocused(true);
  state.start();
  flyVerifiedRoute(state);
  assert.equal(state.canActivateOffline(), true, 'finished run may select a verified installation');
  state.offlinePanel.open();
  state.window.emit('pagehide', { persisted: true });
  assert.equal(state.offlinePanel.isOpen(), false);
  assert.equal(state.canActivateOffline(), false);
  await flush();
  state.window.emit('pageshow', { persisted: true });
  assert.equal(state.canActivateOffline(), false, 'restoration waits for its saving lease');
  await flush();
  assert.equal(state.canActivateOffline(), true);
  state.writerClaims.at(-1).release();
  assert.equal(state.canActivateOffline(), false, 'read-only round cannot activate a new edition');
  state.window.emit('pagehide', { persisted: false });
  assert.equal(state.document.getElementById('install-offline-dialog'), null);
});

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

test('Snake settings have one canonical enemy appearance selector inside shared appearance controls', async () => {
  const state = await harness();
  state.shell.open('settings');
  const selectors = state.document.querySelectorAll('[data-enemy-appearance]');
  assert.equal(selectors.length, 1);
  assert.ok(selectors[0].closest('[data-theme-controls]'));
  assert.equal(state.$('snake-enemy-appearance'), null);
});

test('Battlefield appearance refreshes reopened mission previews and result replay without replacing the attempt', async () => {
  const state = await harness({
    query: '&board=fpv-battlefield&scene=freight',
    cosmetics: { boardStyle: 'retro', boardScene: 'orchard' },
  });
  assert.equal(state.document.body.dataset.boardStyle, 'fpv-battlefield');
  state.shell.open('missions');
  assert.ok(state.previewDrawings.length > 0);
  assert.ok(state.previewDrawings.every((options) => options.boardStyle === 'fpv-battlefield'));
  assert.ok(state.previewDrawings.every((options) => options.boardScene === 'freight'));
  state.$('journey-back').click();
  state.shell.open('settings');
  state.$('board-style').value = 'night-arcade';
  state.$('board-style').emit('change');
  state.$('board-scene').value = 'relay';
  state.$('board-scene').emit('change');
  const previousPreviews = state.previewDrawings.length;
  state.shell.open('missions');
  assert.ok(state.previewDrawings.length > previousPreviews);
  assert.ok(
    state.previewDrawings
      .slice(previousPreviews)
      .every((options) => options.boardStyle === 'night-arcade' && options.boardScene === 'relay'),
    'reopened cached mission cards use the newly selected appearance',
  );
  state.$('journey-back').click();
  await importSession(state.$, clearedSession());
  const before = core.exportClassicSnakeReplay(state.created.at(-1));
  state.shell.openHome();
  state.shell.open('settings');
  state.$('board-style').value = 'fpv-battlefield';
  state.$('board-style').emit('change');
  state.$('board-scene').value = 'harbor';
  state.$('board-scene').emit('change');
  state.shell.openHome();
  state.shell.elements.buttons['home-results'].click();
  state.frame(0);
  state.frame(240);
  const preview = state.drawings
    .filter((item) => item.canvas.classList.contains('snake-result-board'))
    .at(-1);
  assert.equal(preview.options.boardStyle, 'fpv-battlefield');
  assert.equal(preview.options.boardScene, 'harbor');
  assert.deepEqual(core.exportClassicSnakeReplay(state.created.at(-1)), before);
  assert.equal(state.document.body.dataset.playing, 'false');
  const saved = JSON.parse(state.storage.get('revealline.classic-snake.presentation.v1'));
  const restored = await harness({ cosmetics: saved });
  restored.frame(0);
  assert.equal(restored.drawings.at(-1).options.boardStyle, 'fpv-battlefield');
  assert.equal(restored.drawings.at(-1).options.boardScene, 'harbor');
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
  const savedBefore = JSON.parse(state.storage.get(SAVE_KEY));
  state.window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(state.writerClaims.length, 2);
  assert.equal(state.writerClaims[1].writable, true);
  const savedAfter = JSON.parse(state.storage.get(SAVE_KEY));
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
  assert.equal(state.resultReactions.length, 1);
  assert.equal(state.resultReactions[0].presentation, 'snake');
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

for (const input of ['dpad', 'stick']) {
  test(`${input} navigation during celebration cancels the later countdown without rearming it`, async () => {
    const state = await harness();
    let now = flyVerifiedRoute(state);
    const pad = menuPad();
    state.pads.push(pad);
    state.frame((now += 50));
    assert.equal(state.shell.elements.root.dataset.transitionPhase, 'celebration');
    if (input === 'dpad') pad.buttons[13] = { pressed: true, value: 1 };
    else pad.axes[1] = 0.8;
    state.frame((now += 50));
    pad.buttons[13] = { pressed: false, value: 0 };
    pad.axes[1] = 0;
    assert.equal(state.shell.elements.root.dataset.transitionPhase, 'cancelled');
    assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.results);
    const cancelledAt = now;
    while (now < cancelledAt + 11000) state.frame((now += 50));
    assert.equal(
      state.created.length,
      1,
      'returning the controller to neutral does not rearm Next',
    );
    assert.equal(state.shell.elements.root.dataset.transitionPhase, 'cancelled');
  });
}

for (const phase of ['celebration', 'replay']) {
  test(`controller Menu during ${phase} stops automatic progression and opens results`, async () => {
    const state = await harness();
    let now = 0;
    if (phase === 'celebration') now = flyVerifiedRoute(state);
    else {
      state.frame(0);
      while (state.shell.elements.root.dataset.transitionPhase !== 'replay' && now < 10000)
        state.frame((now += 50));
    }
    const pad = menuPad();
    state.pads.push(pad);
    state.frame((now += 50));
    assert.equal(state.shell.elements.root.dataset.transitionPhase, phase);
    pad.buttons[9] = { pressed: true, value: 1 };
    state.frame((now += 50));
    assert.equal(state.shell.elements.root.dataset.transitionPhase, 'cancelled');
    assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.results);
    pad.buttons[9] = { pressed: false, value: 0 };
    const stoppedAt = now;
    while (now < stoppedAt + 11000) state.frame((now += 50));
    assert.equal(state.created.length, 1, 'releasing Menu cannot rearm automatic Next or Retry');
    assert.equal(state.document.body.dataset.playing, 'false');
  });
}

test('controller steering during live play still moves immediately and Confirm launches Next during celebration', async () => {
  const playing = await harness();
  const pad = menuPad();
  playing.pads.push(pad);
  playing.frame(0);
  pad.buttons[13] = { pressed: true, value: 1 };
  playing.frame(50);
  assert.equal(playing.created[0].snakes[0].turns.at(-1), 'down');
  playing.frame(200);
  assert.equal(playing.created[0].snakes[0].direction, 'down');
  assert.equal(playing.document.body.dataset.playing, 'true');
  pad.buttons[9] = { pressed: true, value: 1 };
  playing.frame(250);
  assert.equal(playing.shell.topDialog(), playing.shell.elements.dialogs.pause);
  assert.equal(playing.document.body.dataset.playing, 'false');
  const pausedTick = playing.created[0].tick;
  playing.frame(500);
  assert.equal(playing.created[0].tick, pausedTick, 'Menu still pauses a live attempt');

  const completed = await harness();
  const now = flyVerifiedRoute(completed);
  const confirm = menuPad();
  completed.pads.push(confirm);
  completed.frame(now + 50);
  confirm.buttons[0] = { pressed: true, value: 1 };
  completed.frame(now + 100);
  assert.equal(
    new URL(completed.location.href).searchParams.get('level'),
    'classic-snake-two-landings',
  );
  assert.equal(completed.document.body.dataset.playing, 'true');
});

test('selecting a new library mission launches directly while retaining the older Workshop save', async () => {
  const state = await harness();
  state.start();
  state.frame(0);
  state.frame(100);
  state.shell.open('missions');
  const priorSave = state.storage.get(SAVE_KEY);
  assert.equal(JSON.parse(priorSave).levelId, CLASSIC_SNAKE_LEVELS[0].id);
  const selected = CLASSIC_SNAKE_LEVELS[1];
  libraryCard(state, selected.id).click();
  await flush();
  assert.equal(state.shell.topDialog(), null);
  assert.equal(state.document.body.dataset.playing, 'true');
  assert.equal(state.storage.get(SAVE_KEY), priorSave);
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

for (const [mode, activity, query, expected] of [
  ['solo', 'campaign', '', 'SNAKE · Solo · Campaign'],
  ['team', 'campaign', '', 'SNAKE · Team · Campaign'],
  ['versus', 'campaign', '', 'SNAKE · Duel · Campaign'],
  ['solo', 'endless', '', 'SNAKE · Solo · Endless'],
  ['versus', 'endless', '&duel=score', 'SNAKE · Duel · Endless · Score duel · 3 min'],
  ['versus', 'endless', '&duel=survival', 'SNAKE · Duel · Endless · Survival duel'],
]) {
  test(`Snake Home identifies the accepted ${mode}/${activity}${query} round without starting it`, async () => {
    const state = await harness({
      mode,
      activity,
      query,
      directEntry: false,
      liveLocale: mode === 'versus',
    });
    const context = state.$('snake-navigation-context');
    assert.equal(context.hidden, false);
    assert.equal(context.textContent, expected);
    assert.equal(state.shell.elements.modes.getAttribute('aria-describedby'), context.id);
    assert.equal(state.shell.topDialog(), state.shell.elements.home);
    const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
    if (mode === 'versus') {
      state.$('language').value = 'uk';
      state.$('language').emit('change');
      assert.match(context.textContent, /^ЗМІЙКА · Дуель · /);
    }
    state.frame(0);
    state.frame(2000);
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    assert.equal(state.document.body.dataset.playing, 'false');
  });
}

test('the Snake library shows all missions and filters without changing the paused attempt', async () => {
  const state = await harness();
  state.frame(0);
  state.frame(200);
  state.shell.open('missions');
  const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
  assert.equal(state.$('journey-cards').children.length, 240);
  assert.equal(state.$('journey-campaign-rail').children.length, 35);
  const first = libraryCard(state, CLASSIC_SNAKE_LEVELS[0].id);
  state.$('journey-search').value = 'Quiet Channel';
  state.$('journey-search').emit('input');
  assert.equal(state.$('journey-cards').children.length, 1);
  state.$('journey-mode').value = 'team';
  state.$('journey-mode').emit('change');
  state.$('journey-filter-details').open = false;
  assert.match(
    state.$('journey-chooser-status').textContent,
    /Browsing Team · from SNAKE · Solo · Campaign/,
  );
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

for (const mode of ['solo', 'versus', 'team']) {
  test(`${mode} Snake mission recovery preserves the paused native attempt and its accepted host`, async () => {
    const state = await harness({ mode });
    state.frame(0);
    state.frame(200);
    state.shell.open('missions');
    const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
    const location = state.location.href;
    state.$('journey-lifecycle').value = 'archive';
    state.$('journey-lifecycle').emit('change');
    assert.equal(state.$('journey-lifecycle').value, 'archive');
    state.$('journey-mode').value = mode === 'team' ? 'solo' : 'team';
    state.$('journey-mode').emit('change');
    state.$('journey-search').value = 'No such mission here';
    state.$('journey-search').emit('input');
    state.$('journey-filters-reset').focus();
    state.$('journey-filters-reset').click();
    assert.equal(state.$('journey-mode').value, mode);
    assert.equal(state.$('journey-lifecycle').value, 'current');
    assert.equal(state.$('journey-search').value, 'No such mission here');
    assert.equal(state.$('journey-cards').children.length, 0);
    assert.equal(state.document.activeElement, state.$('journey-search'));
    state.frame(2000);
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    assert.equal(state.location.href, location);
    assert.equal(state.document.body.dataset.playing, 'false');
    state.$('journey-search-clear').focus();
    state.$('journey-search-clear').click();
    assert.ok(state.$('journey-cards').children.length > 0);
    state.$('journey-back').click();
    assert.equal(state.$('journey-chooser').open, false);
    assert.equal(state.document.body.dataset.playing, 'false');
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
  });
}

test('Snake library mode selection launches the exact chosen Team mission with one activation', async () => {
  const state = await harness();
  state.shell.open('missions');
  state.$('journey-mode').value = 'team';
  state.$('journey-mode').emit('change');
  const selected = CLASSIC_SNAKE_LEVELS.at(-1);
  const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
  libraryCard(state, selected.id).focus();
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    before,
  );
  libraryCard(state, selected.id).click();
  await flush();
  assert.equal(state.created.at(-1).level.id, selected.id);
  assert.equal(state.created.at(-1).snakes.length, 2);
  assert.equal(new URL(state.location.href).searchParams.get('mode'), 'team');
  assert.equal(state.$('journey-chooser').open, false);
  assert.equal(state.shell.topDialog(), null);
  assert.equal(state.document.body.dataset.playing, 'true');
  state.shell.openHome();
  state.shell.open('missions');
  const accepted = state.created.map((run) => core.exportClassicSnakeReplay(run));
  state.$('journey-mode').value = 'solo';
  state.$('journey-mode').emit('change');
  state.$('journey-filters-reset').focus();
  state.$('journey-filters-reset').click();
  assert.equal(
    state.$('journey-mode').value,
    'team',
    'The reused chooser follows the accepted Team owner.',
  );
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    accepted,
  );
  assert.equal(state.document.body.dataset.playing, 'false');
  state.$('journey-back').click();
  assert.equal(state.$('snake-navigation-context').textContent, 'SNAKE · Team · Campaign');
  assert.equal(
    state.shell.elements.home.querySelector('.mode-play-mission').textContent,
    selected.title.en,
  );
});

for (const [browsedMode, label, translatedLabel] of [
  ['team', 'Team', 'Команда'],
  ['versus', 'Duel', 'Дуель'],
])
  test(`Snake ${browsedMode} navigation context localizes without changing the paused owner or selected library mode`, async () => {
    const state = await harness({ liveLocale: true });
    state.frame(0);
    state.frame(200);
    state.shell.openHome();
    state.shell.open('missions');
    state.$('journey-mode').value = browsedMode;
    state.$('journey-mode').emit('change');
    assert.ok(
      state
        .$('journey-chooser-status')
        .textContent.includes(`Browsing ${label} · from SNAKE · Solo · Campaign`),
    );
    assert.equal(
      [...state.$('journey-mode').children].find((option) => option.value === browsedMode)
        .textContent,
      label,
    );
    const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
    const selected = libraryCard(state, CLASSIC_SNAKE_LEVELS[1].id);
    selected.focus();
    state.$('language').value = 'uk';
    state.$('language').emit('change');
    assert.equal(state.document.activeElement, selected);
    assert.equal(state.$('snake-navigation-context').textContent, 'ЗМІЙКА · Соло · Кампанія');
    assert.ok(
      state
        .$('journey-chooser-status')
        .textContent.includes(
          `Перегляд: ${translatedLabel} · поточна гра: ЗМІЙКА · Соло · Кампанія`,
        ),
    );
    state.$('journey-back').click();
    assert.equal(state.shell.topDialog(), state.shell.elements.home);
    assert.equal(state.document.body.dataset.playing, 'false');
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    state.shell.open('missions');
    assert.equal(state.$('journey-mode').value, browsedMode);
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
  const saved = state.storage.get(SAVE_KEY);
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
  assert.equal(state.storage.get(SAVE_KEY), saved);
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
    test(`${action} rejects retired ${profiled ? 'local-v1' : 'unprofiled'} recipes in the fresh campaign`, async () => {
      const session = archivedSession({ profiled });
      const state = await harness({ savedRound: action === 'Continue' ? session : null });
      if (action === 'Continue') state.$('continue').click();
      else await importSession(state.$, session);
      assert.equal(state.$('save-status').textContent, CLASSIC_COPY.en.invalid);
      state.retry();
      assert.equal(state.created.at(-1).level.id, CLASSIC_SNAKE_LEVELS[0].id);
      assert.notDeepEqual(state.created.at(-1).level, session.match.replays[0].level);
    });
  }

test('fresh campaign ignores the old Continue channel and preserves its original bytes', async () => {
  const session = archivedSession();
  const state = await harness({ legacySavedRound: session });
  const oldKey = 'revealline.classic-snake.round.v2';
  const before = state.storage.get(oldKey);
  assert.equal(state.$('continue').hidden, true);
  state.start();
  state.frame(0);
  assert.equal(state.storage.get(oldKey), before);
  assert.ok(state.storage.has(SAVE_KEY));
});

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
  const saved = JSON.parse(state.storage.get(SAVE_KEY));
  assert.equal(saved.format, 'revealline-classic-snake-session.v3');
  assert.equal(saved.appearance.environmentPin, null);
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
  const saved = JSON.parse(state.storage.get(SAVE_KEY));
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

test('Snake About returns to its visible panel after a compact resize without advancing the paused attempt', async (t) => {
  const h = await harness({ sharedTools: true });
  t.after(() => h.disposeTools());
  h.document.defaultView.innerWidth = 1280;
  h.start();
  h.frame(0);
  h.frame(100);
  h.shell.elements.buttons.pause.click();
  const paused = h.created.map((run) => core.exportClassicSnakeReplay(run));
  h.shell.elements.buttons.settings.click();
  h.$('snake-menu-settings-tab-extras').click();
  const settings = h.shell.elements.dialogs.settings,
    opener = h.$('snake-global-tools-about'),
    rects = opener.getClientRects.bind(opener),
    focus = opener.focus.bind(opener),
    stored = [...h.storage];
  // Model only the existing compact CSS/native focus boundary; the real
  // Settings/tool owners, host handlers and accepted simulation run below.
  opener.getClientRects = () =>
    h.document.defaultView.innerWidth <= 700 && settings.dataset.settingsView === 'categories'
      ? []
      : rects();
  opener.focus = (...args) => {
    if (opener.getClientRects().length) focus(...args);
  };
  opener.focus();
  opener.click();
  const dialog = h.$('snake-global-tools-tool-dialog'),
    frame = dialog.querySelector('iframe');
  frame.focus();
  h.document.defaultView.innerWidth = 316;
  h.document.defaultView.emit('resize');
  h.window.emit('resize');
  assert.equal(settings.dataset.settingsView, 'categories');
  assert.equal(opener.getClientRects().length, 0);
  h.$('snake-global-tools-tool-back').click();
  assert.equal(dialog.open, false);
  assert.equal(settings.open, true);
  assert.equal(settings.dataset.settingsView, 'panel');
  assert.equal(h.document.activeElement, opener);
  assert.ok(opener.getClientRects().length);
  assert.equal(frame.getAttribute('src'), null);
  h.frame(200);
  h.frame(1200);
  assert.deepEqual(
    h.created.map((run) => core.exportClassicSnakeReplay(run)),
    paused,
  );
  assert.deepEqual([...h.storage], stored);
  assert.equal(h.shell.blocksPlay(), true);
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

for (const mode of ['solo', 'versus', 'team']) {
  test(`${mode} keeps accepted chapter materials through Retry, export and Continue after preferences change`, async () => {
    const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-living-cable-cutoff');
    const state = await harness({ entry, mode });
    const select = state.document.querySelector('[data-enemy-appearance]');
    select.value = 'military';
    select.emit('change');
    await flush();
    state.start();
    state.window.emit('blur');
    const key = SAVE_KEY;
    const saved = JSON.parse(state.storage.get(key));
    assert.equal(saved.format, 'revealline-classic-snake-session.v3');
    assert.ok(saved.appearance.environmentPin);
    const accepted = state.acceptedAppearances.at(-1);
    select.value = 'authored';
    select.emit('change');
    await flush();
    state.retry();
    assert.equal(state.acceptedAppearances.at(-1), accepted, 'Retry retains the accepted owner');
    state.window.emit('blur');
    assert.deepEqual(JSON.parse(state.storage.get(key)).appearance, saved.appearance);
    const restored = await harness({ entry, mode });
    await importSession(restored.$, saved);
    assert.equal(restored.$('save-status').textContent, CLASSIC_COPY.en.loaded);
    assert.deepEqual(
      snapshotAttemptAppearance(restored.acceptedAppearances.at(-1)),
      saved.appearance,
    );
    restored.frame(0);
    assert.equal(restored.drawings.at(-1).options.artRevision, 'industrial-roster-v3');
  });
}

for (const action of ['automatic', 'keyboard', 'controller', 'continuation-button']) {
  test(`${action} defeat retry retains accepted artwork while renewing only the hazard schedule`, async () => {
    const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-field-signal-check');
    const state = await harness({ entry });
    const select = state.document.querySelector('[data-enemy-appearance]');
    select.value = 'military';
    select.emit('change');
    await flush();
    state.start();
    const accepted = state.acceptedAppearances.at(-1);
    select.value = 'authored';
    select.emit('change');
    await flush();
    const previous = state.created[0];
    state.frame(0);
    let now = 0;
    while (previous.status === 'running' && now < 10000) state.frame((now += 50));
    assert.equal(previous.status, 'lost');
    if (action === 'automatic') {
      const lostAt = now;
      while (state.created.length === 1 && now < lostAt + 3200) state.frame((now += 50));
    } else if (action === 'keyboard') {
      state.document.emit('keydown', {
        target: state.document.querySelector('canvas'),
        key: 'Enter',
        code: 'Enter',
        repeat: false,
      });
    } else if (action === 'controller') {
      const pad = menuPad();
      state.pads.push(pad);
      state.frame((now += 50));
      pad.buttons[0] = { pressed: true, value: 1 };
      state.frame((now += 50));
    } else {
      [...state.document.querySelector('.snake-continuation').children]
        .find((node) => node.textContent === 'Try again')
        .click();
    }
    assert.equal(state.created.length, 2);
    assert.equal(state.acceptedAppearances.at(-1), accepted);
    const next = state.created.at(-1);
    assert.notEqual(next.hazardSeed, previous.hazardSeed);
    assert.equal(next.seed, previous.seed);
    assert.deepEqual(next.level, previous.level);
    assert.equal(state.document.body.dataset.playing, 'true');
  });
}

test('celebration Retry retains accepted artwork and launches the same mission immediately', async () => {
  const state = await harness();
  const accepted = state.acceptedAppearances.at(-1);
  flyVerifiedRoute(state);
  const select = state.document.querySelector('[data-enemy-appearance]');
  select.value = 'military';
  select.emit('change');
  await flush();
  [...state.document.querySelector('.snake-continuation').children]
    .find((node) => node.textContent === 'Try again')
    .click();
  assert.equal(state.created.length, 2);
  assert.equal(state.acceptedAppearances.at(-1), accepted);
  assert.deepEqual(state.created[1].level, state.created[0].level);
  assert.equal(state.document.body.dataset.playing, 'true');
});

test('a forged chapter pin is rejected before replacing the active mission or save', async () => {
  const entry = CLASSIC_SNAKE_LEVELS.find((item) => item.id === 'classic-living-cable-cutoff');
  const state = await harness({ entry });
  const select = state.document.querySelector('[data-enemy-appearance]');
  select.value = 'military';
  select.emit('change');
  await flush();
  state.start();
  state.window.emit('blur');
  const key = SAVE_KEY;
  const prior = state.storage.get(key),
    saved = JSON.parse(prior);
  saved.appearance.environmentPin.appearanceSha256 = '0'.repeat(64);
  const before = state.created.map((run) => core.exportClassicSnakeReplay(run));
  await importSession(state.$, saved);
  assert.equal(state.$('save-status').textContent, CLASSIC_COPY.en.invalid);
  assert.equal(state.storage.get(key), prior);
  assert.deepEqual(
    state.created.map((run) => core.exportClassicSnakeReplay(run)),
    before,
  );
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

test('reception live status writes only changed text and accessible labels', async () => {
  const state = await receptionHarness('local-burst-v2');
  const run = state.created[0];
  receptionFixtureBoard(run);
  state.frame(0);
  const [label] = receptionLabels(state);
  const text = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
  const setAttribute = label.setAttribute;
  let textWrites = 0;
  let labelWrites = 0;
  Object.defineProperty(label, 'textContent', {
    get() {
      return text.get.call(this);
    },
    set(value) {
      textWrites++;
      text.set.call(this, value);
    },
  });
  label.setAttribute = function (name, value) {
    if (name === 'aria-label') labelWrites++;
    return setAttribute.call(this, name, value);
  };
  for (let now = 1; now <= 5; now++) state.frame(now);
  assert.deepEqual([textWrites, labelWrites], [0, 0], 'unchanged reception stays quiet');
  receptionFixtureBoard(run, { inside: true, phase: 'warning' });
  state.frame(6);
  assert.deepEqual([textWrites, labelWrites], [1, 1]);
  assert.match(label.textContent, /warning/i);
  state.frame(7);
  assert.deepEqual([textWrites, labelWrites], [1, 1], 'a warning is not rewritten every frame');
  receptionFixtureBoard(run, { inside: true });
  state.frame(8);
  assert.deepEqual([textWrites, labelWrites], [2, 2]);
  assert.match(label.getAttribute('aria-label'), /Enemies keep moving unseen/);
  receptionFixtureBoard(run);
  state.frame(9);
  assert.deepEqual([textWrites, labelWrites], [3, 3]);
  assert.match(label.textContent, /Clear reception/);
  assert.equal(run.tick, 0, 'presentation checks do not change the accepted simulation');
});

// Observe writes in the lightweight DOM fixture; this does not model an actual
// screen reader's announcement queue.
function observeLiveStatusWrites(node) {
  const text = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
  const setAttribute = node.setAttribute;
  const writes = { text: 0, label: 0 };
  Object.defineProperty(node, 'textContent', {
    get() {
      return text.get.call(this);
    },
    set(value) {
      writes.text++;
      text.set.call(this, value);
    },
  });
  node.setAttribute = function (name, value) {
    if (name === 'aria-label') writes.label++;
    return setAttribute.call(this, name, value);
  };
  return writes;
}

for (const locale of ['en', 'uk']) {
  test(`${locale} pause announcements update only when their message changes`, async () => {
    const state = await harness({ query: `&lang=${locale}` });
    state.window.emit('blur');
    const announcement = state.$('announcement');
    assert.equal(announcement.getAttribute('role'), 'status');
    assert.equal(announcement.textContent, CLASSIC_COPY[locale].paused);
    const writes = observeLiveStatusWrites(announcement);
    for (let now = 0; now < 5; now++) state.frame(now);
    assert.equal(writes.text, 0, 'unchanged pause status stays quiet');
    state.start();
    assert.equal(announcement.textContent, '');
    assert.equal(writes.text, 1, 'resume clears the old pause announcement once');
    state.window.emit('blur');
    assert.equal(announcement.textContent, CLASSIC_COPY[locale].paused);
    assert.equal(writes.text, 2, 'a new pause is still announced');
    for (let now = 5; now < 10; now++) state.frame(now);
    assert.equal(writes.text, 2);
  });

  test(`${locale} completed grade and session-only saving status stay quiet between changes`, async () => {
    const state = await harness({
      query: `&lang=${locale}`,
      recordReceipt: { verified: true, saved: false },
    });
    const now = flyVerifiedRoute(state);
    await flush();
    const stars = state.$('snake-stars');
    const notice = state.$('result-save-notice');
    assert.equal(stars.textContent, '★★★');
    assert.equal(notice.textContent, CLASSIC_COPY[locale].verifiedNotSaved);
    const starsWrites = observeLiveStatusWrites(stars);
    const noticeWrites = observeLiveStatusWrites(notice);
    const outcomeWrites = observeLiveStatusWrites(state.$('announcement'));
    state.window.emit('blur');
    for (let offset = 1; offset <= 6; offset++) state.frame(now + offset * 1000);
    assert.deepEqual(starsWrites, { text: 0, label: 0 });
    assert.equal(noticeWrites.text, 0);
    assert.equal(outcomeWrites.text, 0);
    state.shell.elements.buttons.retry.click();
    assert.equal(notice.hidden, true);
    assert.equal(notice.textContent, '');
    assert.equal(noticeWrites.text, 1, 'retry clears the previous save failure once');
  });
}

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

for (const mode of ['solo', 'team', 'versus']) {
  test(`${mode} Snake uses shared touch settings and turns on pointermove before release`, async () => {
    const state = await harness({ mode });
    state.start();
    const playerCount = mode === 'solo' ? 1 : 2;
    for (let player = 0; player < playerCount; player++) {
      const surface = state.$(`snake-touch-${player}-surface`);
      surface.emit('pointerdown', {
        pointerId: 10 + player,
        pointerType: 'touch',
        button: 0,
        clientX: 80,
        clientY: 100,
      });
      surface.emit('pointermove', {
        pointerId: 10 + player,
        pointerType: 'touch',
        clientX: 80,
        clientY: 65,
      });
      const run = state.created[mode === 'versus' ? player : 0];
      assert.equal(run.history.at(-1).direction, 'up');
      assert.equal(surface.hasPointerCapture(10 + player), true);
      assert.equal(state.$(`snake-touch-${player}-indicator`).hidden, false);
      surface.emit('pointerup', { pointerId: 10 + player });
      assert.equal(state.$(`snake-touch-${player}-indicator`).hidden, true);
    }
    state.shell.open('settings');
    for (const [field, value] of [
      ['mode', 'dpad'],
      ['side', 'left'],
      ['size', 'large'],
      ['opacity', '0.2'],
    ]) {
      const input = state.$(`snake-global-touch-${field}`);
      input.value = value;
      input.emit('change');
    }
    assert.deepEqual(JSON.parse(state.storage.get('revealline.touch.v1')), {
      mode: 'dpad',
      side: 'left',
      size: 'large',
      opacity: 0.2,
    });
    for (let player = 0; player < playerCount; player++) {
      const root = state.$(`snake-touch-${player}-controls`);
      assert.equal(root.dataset.touchMode, 'dpad');
      assert.equal(root.dataset.touchSize, 'large');
      assert.equal(root.style.getPropertyValue('--touch-opacity'), '0.2');
      assert.equal(state.$(`snake-touch-${player}-surface`).hidden, true);
      assert.equal(state.$(`snake-touch-${player}-pad`).hidden, false);
    }
  });
}

test('Snake releases gestures when paused, resized and rebuilt; retired surfaces cannot steer', async () => {
  const state = await harness();
  state.start();
  const surface = state.$('snake-touch-0-surface');
  const down = (id) =>
    surface.emit('pointerdown', {
      pointerId: id,
      pointerType: 'touch',
      button: 0,
      clientX: 80,
      clientY: 100,
    });
  down(4);
  state.shell.open('settings');
  assert.equal(surface.hasPointerCapture(4), false);
  const count = state.created[0].history.length;
  surface.emit('pointermove', { pointerId: 4, clientX: 80, clientY: 60 });
  assert.equal(state.created[0].history.length, count);
  state.start();
  down(5);
  state.window.emit('resize');
  assert.equal(surface.hasPointerCapture(5), false);
  assert.equal(state.document.body.dataset.playing, 'false');
  state.retry();
  assert.notEqual(state.$('snake-touch-0-surface'), surface);
  down(6);
  surface.emit('pointermove', { pointerId: 6, clientX: 80, clientY: 60 });
  assert.equal(surface.hasPointerCapture(6), false);
  assert.equal(state.created.at(-1).history.length, 0);
});

test('Snake board gestures obey stick/swipe preferences and Team preserves separate steering seats', async () => {
  const state = await harness();
  state.shell.open('settings');
  const selector = state.$('snake-global-touch-mode');
  selector.value = 'swipe';
  selector.emit('change');
  state.start();
  const canvas = state.document.querySelector('canvas');
  canvas.emit('pointerdown', {
    pointerId: 4,
    pointerType: 'touch',
    button: 0,
    clientX: 80,
    clientY: 100,
  });
  canvas.emit('pointermove', { pointerId: 4, clientX: 80, clientY: 60 });
  assert.equal(state.created[0].history.at(-1).direction, 'up');
  canvas.emit('pointerup', { pointerId: 4 });
  const team = await harness({ mode: 'team' });
  team.start();
  const teamCanvas = team.document.querySelector('canvas');
  teamCanvas.emit('pointerdown', {
    pointerId: 4,
    pointerType: 'touch',
    button: 0,
    clientX: 80,
    clientY: 100,
  });
  teamCanvas.emit('pointermove', { pointerId: 4, clientX: 80, clientY: 60 });
  assert.equal(
    team.created[0].history.length,
    0,
    'Shared team board does not guess which pilot touched it.',
  );
});

test('Snake D-pad steers on press and slide without duplicating its compatibility click', async () => {
  const state = await harness();
  const selector = state.$('snake-global-touch-mode');
  selector.value = 'dpad';
  selector.emit('change');
  state.start();
  const pad = state.$('snake-touch-0-pad');
  pad.emit('pointerdown', {
    pointerId: 8,
    pointerType: 'touch',
    button: 0,
    clientX: 50,
    clientY: 0,
  });
  assert.equal(state.created[0].history.at(-1).direction, 'up');
  pad.emit('pointermove', { pointerId: 8, clientX: 0, clientY: 22 });
  assert.equal(state.created[0].history.at(-1).direction, 'left');
  const count = state.created[0].history.length;
  pad.emit('pointerup', { pointerId: 8 });
  pad.querySelector('[data-direction="up"]').emit('click', { detail: 1 });
  assert.equal(state.created[0].history.length, count);
  assert.equal(state.$('snake-touch-0-indicator').hidden, true);
});

test('Snake reveals shared controls for real touch on hybrid devices and hides them for keyboard or pause', async () => {
  const state = await harness();
  state.start();
  assert.equal(
    state.$('pads').hidden,
    true,
    'A fine pointer does not force thumb controls on desktop.',
  );
  state.document.body.emit('pointerdown', { pointerId: 30, pointerType: 'touch', button: 0 });
  assert.equal(
    state.$('pads').hidden,
    false,
    'Actual touch is authoritative even without a coarse primary pointer.',
  );
  state.document.emit('keydown', { key: 'Shift', code: 'ShiftLeft' });
  assert.equal(state.$('pads').hidden, false, 'Modifier keys do not change the steering modality.');
  state.document.emit('keydown', { key: 'w', code: 'KeyW' });
  assert.equal(state.$('pads').hidden, true);
  state.document.body.emit('pointerdown', { pointerId: 31, pointerType: 'touch', button: 0 });
  assert.equal(state.$('pads').hidden, false);
  state.shell.open('settings');
  assert.equal(
    state.$('pads').hidden,
    true,
    'Paused gameplay never leaves live controls behind a menu.',
  );
});

for (const worldStyle of ['toybox', 'atmospheric-ruins', 'night-arcade', 'fpv-battlefield']) {
  test(`${worldStyle} changes paused scenery without a new attempt`, async () => {
    const state = await harness({ query: `&board=${worldStyle}&scene=harbor` });
    state.shell.open('settings');
    const before = core.exportClassicSnakeReplay(state.created[0]);
    assert.equal(state.$('board-scene-field').hidden, false);
    state.$('board-scene').value = 'quarry';
    state.$('board-scene').emit('change');
    state.frame(0);
    state.frame(500);
    assert.equal(state.created.length, 1);
    assert.deepEqual(core.exportClassicSnakeReplay(state.created[0]), before);
    assert.equal(state.drawings.at(-1).options.boardStyle, worldStyle);
    assert.equal(state.drawings.at(-1).options.boardScene, 'quarry');
    assert.equal(new URL(state.location.href).searchParams.get('board'), worldStyle);
  });
}

for (const mode of ['solo', 'team', 'versus']) {
  test(`${mode} operation entry admits authored Mission Race and retains objectives through retry`, async () => {
    const entry = {
      ...CLASSIC_SNAKE_LEVELS[0],
      title: OPERATION_PROTOTYPES[7].title,
      description: OPERATION_PROTOTYPES[7].hint,
      level: { ...OPERATION_PROTOTYPES[7].level, id: CLASSIC_SNAKE_LEVELS[0].id },
    };
    const state = await harness({
      entry,
      mode,
      activity: 'endless',
      query: '&targets=varied&duel=score',
      catalogue: CLASSIC_SNAKE_LEVELS.map((row) => (row.id === entry.id ? entry : row)),
    });
    const first = state.created[0];
    assert.deepEqual(first.level.operation, entry.level.operation);
    assert.equal(state.$('format').value, 'campaign');
    assert.equal(state.$('format').disabled, true);
    assert.equal(state.$('target-rules').value, 'authored');
    assert.equal(state.$('target-rules').disabled, true);
    assert.equal(state.document.body.dataset.playing, 'true');
    assert.match(
      state.document.querySelector('[data-stat="operation"]').textContent,
      /Stage 1\/2.*Delivered 0\/2.*Plate 0\/1/,
    );
    state.shell.open('pause');
    state.$('continue').click();
    state.frame(0);
    assert.deepEqual(state.drawings.at(-1).run.operation, first.operation);
    state.retry();
    assert.deepEqual(state.created.at(-1).operation, first.operation);
    assert.deepEqual(state.created.at(-1).level.operation, entry.level.operation);
  });
}

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode} restores accepted chapter artwork with an exact current campaign recipe`, async () => {
    const old = CLASSIC_SNAKE_LEVELS.find((e) => e.id === 'classic-living-cable-cutoff');
    const original = await harness({ entry: old, mode, catalogue: [old] });
    const select = original.document.querySelector('[data-enemy-appearance]');
    select.value = 'military';
    select.emit('change');
    await flush();
    original.start();
    original.window.emit('blur');
    const saved = JSON.parse(original.storage.get(SAVE_KEY));
    assert.ok(saved.appearance.environmentPin);
    assert.equal(saved.match.replays[0].level.revision, old.level.revision);
    const restored = await harness({
      entry: CLASSIC_SNAKE_LEVELS.find((e) => e.id === old.id),
      mode,
    });
    await importSession(restored.$, saved);
    assert.equal(restored.$('save-status').textContent, CLASSIC_COPY.en.loaded);
    assert.deepEqual(
      snapshotAttemptAppearance(restored.acceptedAppearances.at(-1)),
      saved.appearance,
    );
    restored.window.emit('blur');
    assert.equal(
      JSON.parse(restored.storage.get(SAVE_KEY)).match.replays[0].level.revision,
      old.level.revision,
    );
  });

test('a verified session-only clear keeps its stars and localized visible saving notice without blocking Retry', async () => {
  for (const locale of ['en', 'uk']) {
    const state = await harness({
      query: `&lang=${locale}`,
      recordReceipt: { verified: true, saved: false },
    });
    flyVerifiedRoute(state);
    await flush();
    assert.equal(state.$('snake-stars').textContent, '★★★');
    assert.equal(state.$('result-save-notice').hidden, false);
    assert.equal(state.$('result-save-notice').textContent, CLASSIC_COPY[locale].verifiedNotSaved);
    state.shell.elements.buttons.retry.click();
    assert.equal(state.created.length, 2);
    assert.equal(state.$('result-save-notice').hidden, true);
  }
});

for (const locale of ['en', 'uk'])
  for (const mode of ['solo', 'team', 'versus'])
    test(`${locale}/${mode} an older optional courier never replaces the required-target HUD after a catch`, async () => {
      const { proofs } = JSON.parse(
        await readFile(
          new URL(
            '../../docs/verification/snake-remaster/outlier-alternative-proofs.json',
            import.meta.url,
          ),
          'utf8',
        ),
      );
      const proof = proofs.find(
        (p) =>
          p.levelId === 'classic-expedition-courier-overpass' &&
          p.mode === (mode === 'team' ? 'team' : 'solo') &&
          p.pace === 'normal',
      );
      const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === proof.levelId);
      const state = await harness({ entry, mode, query: `&lang=${locale}` });
      const run = state.created[0];
      let cursor = 0;
      while (run.status === 'running' && !(run.catches > 4 && run.targets[0]?.role === 'bonus')) {
        while (proof.replay.turns[cursor]?.tick === run.tick) {
          const turn = proof.replay.turns[cursor++];
          assert.ok(core.queueClassicSnakeTurn(run, turn.playerId, turn.direction));
        }
        core.stepClassicSnake(run);
      }
      assert.equal(run.status, 'running');
      assert.equal(
        run.targets[0].role,
        'bonus',
        'an earlier courier survives the required interception',
      );
      assert.equal(run.targets[0].kind, 'courier');
      const requiredTarget = run.targets.find((actor) => actor.role === 'required');
      assert.ok(requiredTarget, 'ordinary mission progress remains available');
      const before = core.exportClassicSnakeReplay(run);
      state.frame(0);
      assert.equal(
        state.$('target-style').textContent,
        actorFieldGuide(requiredTarget.kind, locale).name,
      );
      const cue = state.document.querySelector('.snake-operation-status');
      assert.equal(cue.hidden, false);
      assert.equal(cue.textContent, CLASSIC_COPY[locale].courierOptional);
      assert.equal(
        cue.parentElement.dataset.operation,
        'false',
        'a courier does not convert a catch-quota mission into a staged operation',
      );
      const quota = cue.parentElement.querySelector('[data-stat="caught"]');
      assert.equal(quota.hidden, false);
      assert.equal(quota.querySelector('b').textContent, `${run.catches} / ${run.level.goal}`);
      assert.equal(
        cue.parentElement.dataset.status,
        'true',
        'the existing full-width wrapping row is enabled',
      );
      if (mode === 'versus')
        assert.equal(
          state.document.querySelectorAll('.snake-operation-status')[1].hidden,
          true,
          'the opponent has no courier cue',
        );
      assert.deepEqual(
        core.exportClassicSnakeReplay(run),
        before,
        'the objective cue does not alter the attempt',
      );
      // Finish this accepted recording without chasing its bonus; the cue retires
      // with the actor and cannot leave a stale objective on the result board.
      while (run.status === 'running') {
        while (proof.replay.turns[cursor]?.tick === run.tick) {
          const turn = proof.replay.turns[cursor++];
          assert.ok(core.queueClassicSnakeTurn(run, turn.playerId, turn.direction));
        }
        core.stepClassicSnake(run);
      }
      assert.equal(run.status, 'won');
      if (mode !== 'team') assert.equal(run.bonusCatches, 0);
      state.shell.open('pause');
      assert.equal(cue.hidden, true);
    });

for (const locale of ['en', 'uk'])
  test(`${locale} the opening turn cue applies to touch and controller without requiring a keyboard`, async () => {
    const state = await harness({ query: `&lang=${locale}` });
    state.frame(0);
    const cue = state.$('snake-onboarding');
    assert.equal(cue.hidden, false);
    assert.equal(cue.textContent, CLASSIC_COPY[locale].firstTurnHelp);
    assert.doesNotMatch(cue.textContent, /WASD|Arrows/);
    assert.equal(state.created[0].tick, 0);
  });

test('transient status wrapping never inherits the operation-only rule that hides the catch quota', async () => {
  const css = await readFile(new URL('../snake/classic.css', import.meta.url), 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1],
    body: match[2],
  }));
  const statusRules = rules.filter((rule) => rule.selector.includes("[data-status='true']"));
  assert.equal(statusRules.length, 1);
  assert.match(statusRules[0].body, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(statusRules[0].body, /display:\s*none/);
  assert.ok(
    rules.some(
      (rule) =>
        rule.selector.includes("[data-operation='true'] [data-stat='caught']") &&
        /display:\s*none/.test(rule.body),
    ),
  );
  assert.ok(
    !rules.some(
      (rule) =>
        rule.selector.includes('data-status') && rule.selector.includes("[data-stat='caught']"),
    ),
    'only staged operation objectives replace the ordinary quota',
  );
});

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode}: qualified Snake text controls preserve paused play across size, storage and locale changes`, async (t) => {
    const h = await harness({ mode, initialTextSize: 'extra-large', realDisplay: true });
    t.after(() => h.disposeTools());
    h.shell.open('settings');
    const before = h.created.map((run) => core.exportClassicSnakeReplay(run));
    const beforeStorage = new Map(h.storage);
    const control = h.$('snake-global-textSize');
    assert.equal(control.value, 'extra-large');
    assert.equal(control.querySelector('[data-text-size-retained]').disabled, false);
    assert.equal(h.document.body.dataset.textSize, 'extra-large');
    assert.equal(h.$('snake-text-size').querySelector('[data-text-size-retained]').disabled, false);
    h.$('language').value = 'uk';
    h.$('language').emit('change');
    assert.equal(control.value, 'extra-large');
    assert.equal(
      h.storage.get(DISPLAY_PREFERENCES_KEY),
      beforeStorage.get(DISPLAY_PREFERENCES_KEY),
    );
    h.$('snake-text-face').value = 'plain';
    h.$('snake-text-face').emit('change');
    assert.equal(JSON.parse(h.storage.get(DISPLAY_PREFERENCES_KEY)).textSize, 'extra-large');
    control.value = 'large';
    control.emit('change');
    assert.equal(h.document.body.dataset.textSize, 'large');
    assert.equal(h.$('snake-text-size').value, 'large');
    const fromOtherTab = JSON.stringify({
      textFace: 'plain',
      textSize: 'standard',
      reducedEffects: false,
    });
    h.storage.set(DISPLAY_PREFERENCES_KEY, fromOtherTab);
    h.window.emit('storage', {
      key: DISPLAY_PREFERENCES_KEY,
      storageArea: h.displayStorage,
      newValue: fromOtherTab,
    });
    assert.equal(control.value, 'standard');
    assert.equal(h.document.body.dataset.textSize, 'standard');
    control.focus();
    h.setDisplayStorageFails(true);
    control.value = 'extra-large';
    control.emit('change');
    assert.equal(h.document.body.dataset.textSize, 'extra-large');
    assert.equal(h.storage.get(DISPLAY_PREFERENCES_KEY), fromOtherTab);
    assert.ok(h.$('snake-display-status').textContent);
    assert.equal(h.document.activeElement, control);
    assert.deepEqual(
      h.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    assert.equal(h.shell.blocksPlay(), true);
    assert.deepEqual(
      [...h.storage].filter(
        ([key]) => key !== DISPLAY_PREFERENCES_KEY && key !== 'revealline.locale',
      ),
      [...beforeStorage].filter(
        ([key]) => key !== DISPLAY_PREFERENCES_KEY && key !== 'revealline.locale',
      ),
    );
  });

test('Snake live language refresh translates every stats view without changing the paused attempt', async (t) => {
  const state = await harness({ liveLocale: true });
  t.after(() => state.disposeTools());
  const run = state.created[0];
  state.frame(0);
  let cursor = 0;
  let now = 0;
  for (let tick = 0; tick < clearedReplay.steps && run.catches === 0; tick++) {
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
  await flush();
  assert.equal(run.status, 'running');
  assert.equal(run.catches, 1, 'legal host input catches one enemy before the locale change');
  state.shell.elements.buttons.pause.click();
  const views = [...state.document.querySelectorAll('.enemy-stats')];
  assert.equal(views.length, 3, 'HUD, Pause and Results share the current locale');
  const pauseView = state.shell.elements.content.pause.querySelector('.enemy-stats');
  const disclosure = pauseView.querySelector('details');
  const summary = disclosure.querySelector('summary');
  disclosure.open = true;
  disclosure.emit('toggle');
  summary.focus();
  const counts = () =>
    views.map((view) => [...view.querySelectorAll('strong')].map((node) => node.textContent));
  const expectedCounts = counts();
  assert.deepEqual(expectedCounts, [
    ['1', '1'],
    ['1', '1'],
    ['1', '1'],
  ]);
  state.shell.elements.buttons.settings.click();
  state.$('snake-menu-settings-tab-accessibility').click();
  const language = state.$('language');
  const paused = state.created.map((value) => core.exportClassicSnakeReplay(value));
  const saved = [...state.storage];
  for (const [locale, copy] of [
    ['uk', ['Ця спроба', 'За весь час', 'Види ворогів', 'Переможені вороги']],
    ['en', ['This run', 'Lifetime', 'Enemy details', 'Enemies defeated']],
  ]) {
    language.focus();
    language.value = locale;
    language.emit('change');
    assert.equal(state.document.activeElement, language, 'locale refresh never steals focus');
    assert.equal(disclosure.open, true);
    assert.equal(
      disclosure.querySelector('summary'),
      summary,
      'the open disclosure retains its summary',
    );
    for (const view of views) {
      assert.equal(view.getAttribute('aria-label'), copy[3]);
      assert.equal(view.querySelector('.enemy-stats-run span').textContent, copy[0]);
      assert.equal(view.querySelector('.enemy-stats-caption').textContent, copy[1]);
      if (view.dataset.variant === 'panel') {
        assert.equal(view.querySelector('.enemy-stats-disclosure-label').textContent, copy[2]);
        assert.equal(view.querySelector('.enemy-stats-grid').getAttribute('aria-label'), copy[2]);
      }
    }
    assert.match(
      pauseView.querySelector('.enemy-stats-row-count').getAttribute('aria-label'),
      new RegExp(`^${copy[0]}: 1`),
    );
    assert.deepEqual(counts(), expectedCounts);
    state.frame((now += 1000));
    assert.deepEqual(
      state.created.map((value) => core.exportClassicSnakeReplay(value)),
      paused,
    );
    assert.deepEqual(
      [...state.storage],
      saved,
      'stats refresh does not write gameplay or stats records',
    );
    assert.equal(state.document.body.dataset.playing, 'false');
    assert.equal(state.shell.elements.root.dataset.phase, 'paused');
    assert.equal(state.shell.topDialog(), state.shell.elements.dialogs.settings);
  }
});

test('actual Snake settings keep an unsaved menu animation choice and Retry the same checkbox', async () => {
  const h = await harness(),
    write = h.storage.set.bind(h.storage);
  let working = false;
  h.storage.set = (key, value) => {
    if (key === MENU_ANIMATION_KEY && !working)
      throw new DOMException('Modeled blocked storage', 'SecurityError');
    return write(key, value);
  };
  h.shell.open('settings');
  const input = h.$('snake-global-menuAnimation');
  input.checked = false;
  input.emit('change');
  const status = h.$(`${input.id}-status`),
    retry = status.parentNode.querySelector('.global-settings-save-retry');
  assert.equal(input.checked, false);
  assert.match(status.textContent, /Session only.*blocked/);
  retry.focus();
  working = true;
  retry.click();
  assert.equal(h.storage.get(MENU_ANIMATION_KEY), 'off');
  assert.equal(status.textContent, 'Saved');
  assert.equal(h.document.activeElement, input);
  assert.equal(retry.hidden, true);
});

// Legal detours before the archived opening route preserve the same seed,
// recipe and targets while producing independently earned lower ratings.
function flyRatingRoute(state, circuits) {
  const run = state.created[0];
  let now = 0;
  state.frame(now);
  const turn = (direction) => {
    const key = { up: 'w', right: 'd', down: 's', left: 'a' }[direction];
    state.document.emit('keydown', {
      target: state.document.querySelector('canvas'),
      key,
      code: `Key${key.toUpperCase()}`,
      repeat: false,
    });
  };
  const step = () => {
    now += core.classicSnakeSummary(run).stepMs;
    state.frame(now);
  };
  for (let circuit = 0; circuit < circuits; circuit++)
    for (const direction of ['down', 'left', 'up', 'right']) {
      turn(direction);
      for (let move = 0; move < 3; move++) step();
    }
  let cursor = 0;
  for (let tick = 0; tick < clearedReplay.steps; tick++) {
    while (clearedReplay.turns[cursor]?.tick === tick)
      turn(clearedReplay.turns[cursor++].direction);
    step();
  }
  assert.equal(run.status, 'won');
  assert.equal(run.tick, 93 + circuits * 12);
  return now;
}

for (const [circuits, stars, expected] of [
  [0, 3, /This attempt: 93 moves.*3 stars earned.*highest rating/],
  [3, 2, /This attempt: 129 moves.*3 stars.*117 moves.*12 fewer moves/],
  [7, 1, /This attempt: 177 moves.*2 stars.*163 moves.*14 fewer moves/],
])
  test(`Snake earned ${stars}-star result explains this attempt without substituting its historical best`, async (t) => {
    const state = await harness({
      liveLocale: true,
      recordBest: { score: 800, fastest: { value: 18600 }, fewest: { value: 93 } },
    });
    t.after(() => state.disposeTools());
    assert.equal(state.$('snake-rating-goal').hidden, true);
    const now = flyRatingRoute(state, circuits);
    await flush();
    state.shell.open('results');
    const goal = state.$('snake-rating-goal');
    assert.equal(goal.hidden, false);
    assert.equal(goal.parentNode.className, 'snake-result-summary');
    assert.match(goal.textContent, expected);
    assert.equal(state.$('snake-stars').textContent, '★'.repeat(stars) + '☆'.repeat(3 - stars));
    const run = state.created[0],
      replay = core.exportClassicSnakeReplay(run);
    const saved = state.storage.get(SAVE_KEY);
    const retry = state.shell.elements.buttons.retry;
    retry.focus();
    for (const locale of ['uk', 'en']) {
      state.$('language').value = locale;
      state.$('language').emit('change');
      assert.match(goal.textContent, locale === 'uk' ? /Ця спроба:.*ход/ : expected);
      assert.equal(state.document.activeElement, retry);
      assert.equal(state.created[0], run);
      assert.deepEqual(core.exportClassicSnakeReplay(run), replay);
      assert.equal(state.storage.get(SAVE_KEY), saved);
    }
    const writes = observeLiveStatusWrites(goal);
    for (let i = 1; i <= 4; i++) state.frame(now + i * 50);
    assert.equal(
      writes.text,
      0,
      'unchanged frames do not repeatedly replace the result explanation',
    );
    retry.click();
    assert.equal(state.$('snake-rating-goal').hidden, true);
    assert.equal(state.$('snake-rating-goal').textContent, '');
    assert.equal(state.created.at(-1).levelIdentity, run.levelIdentity);
    assert.equal(state.created.at(-1).tick, 0);
  });

test('Snake result waits for accepted completion and never advertises new star goals for imported recordings', async (t) => {
  let accept;
  const pending = new Promise((resolve) => {
    accept = resolve;
  });
  const state = await harness({ recordReceipt: pending });
  t.after(() => state.disposeTools());
  flyRatingRoute(state, 3);
  assert.equal(state.$('snake-rating-goal').hidden, true);
  assert.equal(state.$('snake-rating-goal').textContent, '');
  accept({ verified: true, saved: false });
  await flush();
  assert.match(state.$('snake-rating-goal').textContent, /12 fewer moves/);
  assert.equal(state.$('result-save-notice').hidden, false);
  await importSession(state.$, clearedSession());
  assert.match(state.$('snake-stars').textContent, /no new awards/);
  assert.equal(state.$('snake-rating-goal').hidden, true);
  assert.equal(state.$('snake-rating-goal').textContent, '');
});

// Use actual native host/menu owners and the public summary API promise as the
// completion fence. No private generation, run state or controller sample is set.
async function pausedSnakeSupportVisit(mode = 'solo', options = {}) {
  const h = await harness({ mode, directEntry: false, ...options });
  h.document.defaultView.innerWidth = 1000;
  h.start();
  h.frame(0);
  h.frame(100);
  h.shell.open('settings');
  h.$('snake-menu-settings-tab-data').click();
  assert.equal(h.shell.topDialog() === h.shell.elements.dialogs.settings, true);
  assert.equal(h.document.body.dataset.playing, 'false');
  return h;
}
function heldSnakeObservation() {
  let release;
  return {
    collect: async ({ collect }) => {
      const report = await collect();
      return new Promise((resolve) => {
        release = () => resolve(report);
      });
    },
    ready: () => typeof release === 'function',
    release: () => release(),
  };
}
for (const mode of ['solo', 'versus', 'team'])
  for (const phase of ['pending', 'prepared'])
    test(`${mode} Snake ${phase} support retires on native category away/back without changing its paused round`, async (t) => {
      const held = heldSnakeObservation();
      const h = await pausedSnakeSupportVisit(mode, {
        supportCollect: phase === 'pending' ? held.collect : null,
      });
      t.after(() => h.window.emit('pagehide', { persisted: false }));
      const paused = h.created.map((run) => core.exportClassicSnakeReplay(run));
      const stored = [...h.storage],
        polls = h.padReads;
      const older = h.supportUI.refresh();
      if (phase === 'pending') await waitFor(held.ready);
      else await older;
      h.$('snake-menu-settings-tab-display').click();
      assert.equal(h.$('support-summary-json').textContent, '');
      assert.equal(h.$('support-summary-download').disabled, true);
      h.$('snake-menu-settings-tab-data').click();
      const writes = observeLiveStatusWrites(h.$('support-summary-json'));
      const focus = h.document.activeElement;
      if (phase === 'pending') held.release();
      await older;
      assert.equal(
        writes.text,
        0,
        'The retired visit cannot write even an identical JSON document.',
      );
      assert.equal(h.$('support-summary-json').textContent, '');
      assert.equal(h.$('support-summary-download').disabled, true);
      assert.equal(h.document.activeElement === focus, true);
      assert.equal(h.padReads, polls, 'UI retirement and late completion add no controller polls.');
      assert.deepEqual(
        h.created.map((run) => core.exportClassicSnakeReplay(run)),
        paused,
      );
      assert.deepEqual([...h.storage], stored);
    });

test('Snake support modal away/back cannot admit a late Data observation', async (t) => {
  const held = heldSnakeObservation();
  const h = await pausedSnakeSupportVisit('solo', { supportCollect: held.collect });
  t.after(() => h.window.emit('pagehide', { persisted: false }));
  const paused = h.created.map((run) => core.exportClassicSnakeReplay(run)),
    stored = [...h.storage];
  const older = h.supportUI.refresh();
  await waitFor(held.ready);
  h.shell.open('help');
  assert.equal(h.shell.topDialog() === h.shell.elements.dialogs.help, true);
  assert.equal(h.$('support-summary-json').textContent, '');
  assert.equal(h.$('support-summary-download').disabled, true);
  h.shell.back();
  assert.equal(h.shell.topDialog() === h.shell.elements.dialogs.settings, true);
  const focus = h.document.activeElement;
  held.release();
  await older;
  assert.equal(h.$('support-summary-json').textContent, '');
  assert.equal(h.$('support-summary-download').disabled, true);
  assert.equal(h.document.activeElement === focus, true);
  assert.deepEqual(
    h.created.map((run) => core.exportClassicSnakeReplay(run)),
    paused,
  );
  assert.deepEqual([...h.storage], stored);
});

for (const phase of ['pending', 'prepared'])
  for (const focusOwner of ['tab', 'outside'])
    test(`Snake ${phase} support retires on a CSS breakpoint round trip with ${focusOwner} focus`, async (t) => {
      const held = heldSnakeObservation();
      const h = await pausedSnakeSupportVisit('solo', {
        supportCollect: phase === 'pending' ? held.collect : null,
      });
      t.after(() => h.window.emit('pagehide', { persisted: false }));
      const settings = h.shell.elements.dialogs.settings;
      const older = h.supportUI.refresh();
      if (phase === 'pending') await waitFor(held.ready);
      else await older;
      // Desktop Data is visible while the committed compact view is categories.
      assert.equal(settings.dataset.settingsView, 'categories');
      if (focusOwner === 'tab') h.$('snake-menu-settings-tab-data').focus();
      else h.document.body.focus();
      const focus = h.document.activeElement;
      for (const width of [320, 1000]) {
        h.document.defaultView.innerWidth = width;
        h.document.defaultView.emit('resize');
        assert.equal(settings.dataset.settingsView, 'categories');
      }
      if (phase === 'pending') held.release();
      await older;
      assert.equal(h.$('support-summary-json').textContent, '');
      assert.equal(h.$('support-summary-download').disabled, true);
      assert.equal(h.document.activeElement === focus, true);
    });

test('ordinary paused Snake frames and same-side resizes retain a prepared report', async (t) => {
  const h = await pausedSnakeSupportVisit();
  t.after(() => h.window.emit('pagehide', { persisted: false }));
  const polls = h.padReads;
  await h.supportUI.refresh();
  assert.equal(h.padReads, polls);
  const exact = h.$('support-summary-json').textContent;
  assert.ok(exact);
  const paused = h.created.map((run) => core.exportClassicSnakeReplay(run));
  h.$('support-summary-prepare').focus();
  const focus = h.document.activeElement;
  for (const width of [1000, 900, 701]) {
    h.document.defaultView.innerWidth = width;
    h.document.defaultView.emit('resize');
  }
  h.frame(150);
  h.frame(200);
  assert.equal(h.$('support-summary-json').textContent, exact);
  assert.equal(h.$('support-summary-download').disabled, false);
  assert.equal(h.document.activeElement === focus, true);
  assert.deepEqual(
    h.created.map((run) => core.exportClassicSnakeReplay(run)),
    paused,
  );
});

test('Snake old export retains single ownership across category retirement and cannot label a newer report', async (t) => {
  let finishExport;
  const held = new Promise((resolve) => {
    finishExport = resolve;
  });
  const h = await pausedSnakeSupportVisit('team', { supportExport: () => held });
  t.after(() => h.window.emit('pagehide', { persisted: false }));
  await h.supportUI.refresh();
  const exported = JSON.parse(h.$('support-summary-json').textContent);
  const older = h.supportUI.download();
  await waitFor(() => h.supportExports.length === 1);
  assert.deepEqual(h.supportExports[0], exported);
  const paused = h.created.map((run) => core.exportClassicSnakeReplay(run)),
    stored = [...h.storage];
  h.$('snake-menu-settings-tab-display').click();
  h.$('snake-menu-settings-tab-data').click();
  await h.supportUI.refresh();
  const newer = h.$('support-summary-json').textContent;
  assert.equal(h.$('support-summary-download').disabled, true);
  assert.equal(await h.supportUI.download(), false);
  assert.equal(h.supportExports.length, 1);
  h.$('support-summary-prepare').focus();
  finishExport({ status: 'shared' });
  await older;
  assert.equal(h.$('support-summary-json').textContent, newer);
  assert.equal(h.$('support-summary-download').disabled, false);
  assert.doesNotMatch(h.$('support-summary-status').textContent, /Shared with/);
  assert.equal(h.document.activeElement === h.$('support-summary-prepare'), true);
  assert.deepEqual(
    h.created.map((run) => core.exportClassicSnakeReplay(run)),
    paused,
  );
  assert.deepEqual([...h.storage], stored);
});

test('Snake blur/focus retires a pending summary without reviving its old visit', async (t) => {
  const held = heldSnakeObservation();
  const h = await pausedSnakeSupportVisit('solo', { supportCollect: held.collect });
  t.after(() => h.window.emit('pagehide', { persisted: false }));
  const older = h.supportUI.refresh();
  await waitFor(held.ready);
  h.setFocused(false);
  h.window.emit('blur');
  h.setFocused(true);
  h.window.emit('focus');
  const focus = h.document.activeElement;
  held.release();
  await older;
  assert.equal(h.$('support-summary-json').textContent, '');
  assert.equal(h.$('support-summary-download').disabled, true);
  assert.equal(h.document.activeElement === focus, true);
});

function snakeRecoveryRuntime() {
  return {
    createReader: () => ({ close: async () => {} }),
    attachView: () => ({ cancel() {}, close: async () => {}, dispose() {} }),
  };
}
for (const phase of ['pending', 'prepared'])
  test(`Snake ${phase} Data support retires through actual Recovery open and native Back`, async (t) => {
    const held = heldSnakeObservation();
    const h = await pausedSnakeSupportVisit('team', {
      sharedTools: true,
      sharedToolOptions: {
        resolveSourceVersion: async () => 'v0.142.4',
        loadRecovery: async () => snakeRecoveryRuntime(),
      },
      supportCollect: phase === 'pending' ? held.collect : null,
    });
    t.after(() => h.disposeTools());
    const paused = h.created.map((run) => core.exportClassicSnakeReplay(run));
    const stored = [...h.storage],
      polls = h.padReads;
    const older = h.supportUI.refresh();
    if (phase === 'pending') await waitFor(held.ready);
    else await older;
    const opener = h.$('profile-recovery-open');
    assert.equal(opener.closest('[hidden],[inert]'), null);
    opener.focus();
    const opened = opener.onclick();
    assert.equal(h.$('profile-recovery-dialog').open, true);
    assert.equal(h.$('support-summary-json').textContent, '');
    assert.equal(h.$('support-summary-download').disabled, true);
    await opened;
    await h.$('profile-recovery-back').onclick();
    assert.equal(h.$('profile-recovery-dialog').open, false);
    assert.equal(h.document.activeElement === opener, true);
    const writes = observeLiveStatusWrites(h.$('support-summary-json'));
    if (phase === 'pending') held.release();
    await older;
    assert.equal(writes.text, 0);
    assert.equal(h.$('support-summary-json').textContent, '');
    assert.equal(h.$('support-summary-download').disabled, true);
    assert.equal(h.document.activeElement === opener, true);
    assert.equal(h.padReads, polls);
    assert.deepEqual(
      h.created.map((run) => core.exportClassicSnakeReplay(run)),
      paused,
    );
    assert.deepEqual([...h.storage], stored);
  });

test('Snake Recovery away/back keeps an old export single-owned without relabeling a newer report', async (t) => {
  let finish;
  const held = new Promise((resolve) => {
    finish = resolve;
  });
  const h = await pausedSnakeSupportVisit('solo', {
    sharedTools: true,
    sharedToolOptions: {
      resolveSourceVersion: async () => 'v0.142.4',
      loadRecovery: async () => snakeRecoveryRuntime(),
    },
    supportExport: () => held,
  });
  t.after(() => h.disposeTools());
  await h.supportUI.refresh();
  const original = JSON.parse(h.$('support-summary-json').textContent);
  const older = h.supportUI.download();
  await waitFor(() => h.supportExports.length === 1);
  const paused = h.created.map((run) => core.exportClassicSnakeReplay(run)),
    stored = [...h.storage];
  await h.$('profile-recovery-open').onclick();
  await h.$('profile-recovery-back').onclick();
  await h.supportUI.refresh();
  const newer = h.$('support-summary-json').textContent;
  assert.equal(await h.supportUI.download(), false);
  assert.deepEqual(h.supportExports, [original]);
  h.$('support-summary-prepare').focus();
  finish({ status: 'shared' });
  await older;
  assert.equal(h.$('support-summary-json').textContent, newer);
  assert.doesNotMatch(h.$('support-summary-status').textContent, /Shared with/);
  assert.equal(h.$('support-summary-download').disabled, false);
  assert.equal(h.document.activeElement === h.$('support-summary-prepare'), true);
  assert.deepEqual(
    h.created.map((run) => core.exportClassicSnakeReplay(run)),
    paused,
  );
  assert.deepEqual([...h.storage], stored);
});

test('Snake compact native Settings Back retires Data before re-entering the same panel', async (t) => {
  const held = heldSnakeObservation();
  const h = await pausedSnakeSupportVisit('solo', { supportCollect: held.collect });
  t.after(() => h.window.emit('pagehide', { persisted: false }));
  h.document.defaultView.innerWidth = 320;
  h.document.defaultView.emit('resize');
  h.$('snake-menu-settings-tab-data').click();
  assert.equal(h.shell.elements.dialogs.settings.dataset.settingsView, 'panel');
  const older = h.supportUI.refresh();
  await waitFor(held.ready);
  h.shell.back();
  assert.equal(h.shell.elements.dialogs.settings.open, true);
  assert.equal(h.shell.elements.dialogs.settings.dataset.settingsView, 'categories');
  assert.equal(h.$('support-summary-json').textContent, '');
  h.$('snake-menu-settings-tab-data').click();
  const focus = h.document.activeElement;
  held.release();
  await older;
  assert.equal(h.$('support-summary-json').textContent, '');
  assert.equal(h.$('support-summary-download').disabled, true);
  assert.equal(h.document.activeElement === focus, true);
});

for (const mode of ['solo', 'team', 'versus'])
  test(`${mode} Snake comfort preview, Apply and Undo preserve the paused boards with real preference owners`, async () => {
    const h = await harness({ mode, realDisplay: true });
    h.start();
    h.frame(0);
    h.frame(100);
    h.shell.open('settings');
    h.$('snake-menu-settings-tab-accessibility').click();
    const before = h.created.map((run) => core.exportClassicSnakeReplay(run)),
      prefix = 'snake-menu-settings-panel-accessibility-comfort-';
    h.$(`${prefix}choice`).value = 'comfort';
    h.$(`${prefix}choice`).emit('change');
    assert.equal(h.storage.has(DISPLAY_PREFERENCES_KEY), false);
    assert.equal(h.storage.has(MENU_ANIMATION_KEY), false);
    h.$(`${prefix}apply`).click();
    assert.deepEqual(JSON.parse(h.storage.get(DISPLAY_PREFERENCES_KEY)), {
      textFace: 'plain',
      textSize: 'large',
      reducedEffects: true,
    });
    assert.equal(h.storage.get(MENU_ANIMATION_KEY), 'off');
    h.frame(800);
    assert.deepEqual(
      h.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    h.$(`${prefix}undo`).focus();
    h.$(`${prefix}undo`).click();
    assert.deepEqual(JSON.parse(h.storage.get(DISPLAY_PREFERENCES_KEY)), {
      textFace: 'pixel',
      textSize: 'standard',
      reducedEffects: false,
    });
    assert.equal(h.storage.get(MENU_ANIMATION_KEY), 'on');
    assert.equal(h.document.activeElement, h.$(`${prefix}apply`));
    h.frame(1600);
    assert.deepEqual(
      h.created.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    assert.equal(h.shell.elements.dialogs.settings.open, true);
  });

test('Snake comfort retries failed shared saves without replacing its original Undo target', async () => {
  const h = await harness({ realDisplay: true }),
    write = h.storage.set.bind(h.storage),
    prefix = 'snake-menu-settings-panel-accessibility-comfort-';
  let working = false;
  h.storage.set = (key, value) => {
    if (!working && [DISPLAY_PREFERENCES_KEY, MENU_ANIMATION_KEY].includes(key))
      throw new DOMException('Modeled full storage', 'QuotaExceededError');
    return write(key, value);
  };
  h.shell.open('settings');
  h.$('snake-menu-settings-tab-accessibility').click();
  h.$(`${prefix}apply`).click();
  assert.equal(h.display.textFace, 'plain');
  assert.equal(h.$('snake-global-menuAnimation').checked, false);
  assert.match(h.$(`${prefix}status`).textContent, /could not be saved/);
  working = true;
  h.$(`${prefix}apply`).click();
  assert.equal(h.storage.get(MENU_ANIMATION_KEY), 'off');
  h.$(`${prefix}undo`).click();
  assert.equal(h.display.textFace, 'pixel');
  assert.equal(h.display.textSize, 'standard');
  assert.equal(h.storage.get(MENU_ANIMATION_KEY), 'on');
});

for (const mode of ['solo', 'versus', 'team']) {
  test(`${mode} Snake touch save Retry preserves the paused replay, other storage and input focus`, async (t) => {
    const touchStorage = { mode: 'silent' };
    const state = await harness({ mode, touchStorage });
    t.after(() => state.disposeTools());
    state.start();
    const surface = state.$('snake-touch-0-surface');
    surface.emit('pointerdown', {
      pointerId: 41,
      pointerType: 'touch',
      button: 0,
      clientX: 80,
      clientY: 100,
    });
    surface.emit('pointermove', { pointerId: 41, pointerType: 'touch', clientX: 80, clientY: 65 });
    assert.equal(state.created[0].history.at(-1).direction, 'up');
    state.frame(0);
    state.frame(100);
    state.shell.elements.buttons.pause.click();
    state.shell.elements.buttons.settings.click();
    const paused = state.created.map((run) => core.exportClassicSnakeReplay(run));
    const unrelated = () => [...state.storage].filter(([key]) => key !== 'revealline.touch.v1');
    const saved = unrelated();
    const field = state.$('snake-global-touch-mode');
    const status = state.$('snake-global-touch-save-status');
    const retry = state.$('snake-global-touch-save-retry');
    field.focus();
    field.value = 'dpad';
    field.emit('change');
    assert.match(status.textContent, /Session only.*did not confirm/);
    state.window.emit('pageshow', { persisted: true });
    assert.equal(field.value, 'dpad');
    assert.equal(surface.hasPointerCapture(41), false);
    touchStorage.mode = 'working';
    retry.focus();
    retry.click();
    assert.equal(state.document.activeElement, field);
    assert.equal(retry.hidden, true);
    assert.equal(JSON.parse(state.storage.get('revealline.touch.v1')).mode, 'dpad');
    state.frame(1000);
    assert.deepEqual(
      state.created.map((run) => core.exportClassicSnakeReplay(run)),
      paused,
    );
    assert.deepEqual(unrelated(), saved);
    assert.equal(state.document.body.dataset.playing, 'false');
    assert.equal(state.shell.elements.root.dataset.phase, 'paused');
  });
}

function snakeKeyboardSettings(state) {
  state.shell.open('settings');
  state.$('snake-menu-settings-tab-controls').click();
}
async function snakeAssign(state, seat, action, code) {
  const button = state.$(`snake-key-${seat}-${action}`);
  button.focus();
  button.click();
  button.emit('keydown', { code, key: code, repeat: false });
  button.emit('keyup', { code, key: code });
  await keyboardTurn();
}
function snakeKey(state, code) {
  state.document.emit('keydown', {
    code,
    key: code,
    repeat: false,
    target: state.$('board') ?? state.document.body,
  });
}
for (const [mode, locale] of [
  ['versus', 'en'],
  ['team', 'uk'],
])
  test(`Snake ${mode} ${locale} owns four keys per seat and preserves paused replay through save recovery`, async (t) => {
    const previous = getSharedLocale();
    setSharedLocale(locale, { persist: false });
    t.after(() => setSharedLocale(previous, { persist: false }));
    const keyboardStorageMode = { value: 'working' },
      state = await harness({ mode, locale, keyboardStorageMode });
    t.after(() => state.window.emit('pagehide', { persisted: false }));
    const duelRaw = JSON.stringify(replaceCouchKey(null, 0, 'up', 'KeyU')),
      teamRaw = JSON.stringify(replaceCouchKey(null, 0, 'up', 'KeyT', 'team'));
    state.storage.set(COUCH_KEYBOARD_KEY, duelRaw);
    state.storage.set(TEAM_KEYBOARD_KEY, teamRaw);
    snakeKeyboardSettings(state);
    assert.equal(state.document.querySelectorAll('.couch-keyboard-row').length, 8);
    assert.equal(state.$('snake-key-0-action'), null);
    assert.equal(state.$('snake-key-0-boost'), null);
    await snakeAssign(state, 0, 'down', 'KeyK');
    await snakeAssign(state, 1, 'down', 'KeyJ');
    assert.match(state.$('controls-help').textContent, /K/);
    assert.match(state.$('controls-help').textContent, /J/);
    state.shell.back();
    state.start();
    state.frame(0);
    snakeKey(state, 'KeyK');
    snakeKey(state, 'KeyJ');
    state.frame(300);
    const current = state.created.slice(-(mode === 'team' ? 1 : 2));
    assert.equal(current[0].snakes[0].direction, 'down');
    assert.equal((mode === 'team' ? current[0].snakes[1] : current[1].snakes[0]).direction, 'down');
    snakeKeyboardSettings(state);
    const before = current.map((run) => core.exportClassicSnakeReplay(run));
    keyboardStorageMode.value = 'full';
    await snakeAssign(state, 0, 'up', 'KeyI');
    assert.match(
      state.$('snake-key-save-status').textContent,
      locale === 'en' ? /Session only/ : /Лише в цьому сеансі/,
    );
    assert.equal(JSON.parse(state.storage.get(SNAKE_KEYBOARD_KEY)).seats[0].up, 'KeyW');
    keyboardStorageMode.value = 'working';
    state.$('snake-key-retry').focus();
    state.$('snake-key-retry').click();
    await keyboardTurn();
    assert.equal(state.document.activeElement.id, 'snake-key-0-up');
    assert.equal(JSON.parse(state.storage.get(SNAKE_KEYBOARD_KEY)).seats[0].up, 'KeyI');
    assert.deepEqual(
      current.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
    state.$('snake-key-reset').click();
    await keyboardTurn();
    assert.deepEqual(
      JSON.parse(state.storage.get(SNAKE_KEYBOARD_KEY)),
      resolveCouchKeyboard(null, 'snake'),
    );
    assert.equal(state.storage.get(COUCH_KEYBOARD_KEY), duelRaw);
    assert.equal(state.storage.get(TEAM_KEYBOARD_KEY), teamRaw);
    state.shell.back();
    assert.deepEqual(
      current.map((run) => core.exportClassicSnakeReplay(run)),
      before,
    );
  });

test('Snake Solo retains both steering aliases and reserved R/menu keys despite a saved two-player layout', async (t) => {
  const state = await harness({ mode: 'solo' });
  t.after(() => state.window.emit('pagehide', { persisted: false }));
  snakeKeyboardSettings(state);
  await snakeAssign(state, 0, 'down', 'KeyK');
  const saved = state.storage.get(SNAKE_KEYBOARD_KEY);
  await snakeAssign(state, 1, 'up', 'KeyK');
  assert.match(state.$('snake-key-capture-status').textContent, /Player 1/);
  state.$('snake-key-1-up').emit('keydown', { code: 'Escape', key: 'Escape', repeat: false });
  assert.equal(state.shell.topDialog().dataset.modeSurface, 'settings');
  await snakeAssign(state, 0, 'up', 'KeyR');
  assert.match(state.$('snake-key-capture-status').textContent, /reserved/);
  assert.equal(state.storage.get(SNAKE_KEYBOARD_KEY), saved);
  state.shell.back();
  state.start();
  state.frame(0);
  snakeKey(state, 'KeyS');
  state.frame(300);
  assert.equal(state.created.at(-1).snakes[0].direction, 'down');
  snakeKey(state, 'ArrowLeft');
  state.frame(600);
  assert.equal(state.created.at(-1).snakes[0].direction, 'left');
  assert.doesNotMatch(state.$('controls-help').textContent, /P2|Г2/);
});

test('Snake leaving Settings retires delayed save admission and adopts other-tab keys only at the next explicit entry', async (t) => {
  const locks = new KeyboardLocks();
  let delayed = false,
    admit;
  const keyboardLocks = {
    request(key, options, callback) {
      if (key === `${SNAKE_KEYBOARD_KEY}:writer` && delayed)
        return new Promise((resolve) => {
          admit = () => resolve(locks.request(key, options, callback));
        });
      return locks.request(key, options, callback);
    },
  };
  const state = await harness({ mode: 'team', keyboardLocks });
  t.after(() => state.window.emit('pagehide', { persisted: false }));
  state.start();
  state.frame(0);
  snakeKey(state, 'KeyS');
  state.frame(300);
  snakeKeyboardSettings(state);
  const run = state.created.at(-1),
    before = core.exportClassicSnakeReplay(run);
  delayed = true;
  await snakeAssign(state, 0, 'right', 'KeyL');
  const newer = replaceCouchKey(null, 1, 'down', 'KeyK', 'snake'),
    raw = JSON.stringify(newer);
  state.storage.set(SNAKE_KEYBOARD_KEY, raw);
  state.shell.back();
  admit();
  await keyboardTurn();
  assert.equal(state.storage.get(SNAKE_KEYBOARD_KEY), raw);
  assert.match(state.$('snake-key-1-down').textContent, /↓/);
  assert.deepEqual(core.exportClassicSnakeReplay(run), before);
  snakeKeyboardSettings(state);
  assert.match(state.$('snake-key-save-status').textContent, /Session only/);
  delayed = false;
  state.$('snake-key-retry').focus();
  state.$('snake-key-retry').click();
  await keyboardTurn();
  const saved = JSON.parse(state.storage.get(SNAKE_KEYBOARD_KEY));
  assert.equal(saved.seats[0].right, 'KeyL');
  assert.equal(saved.seats[1].down, 'KeyK');
  assert.equal(state.document.activeElement.id, 'snake-key-0-right');
  state.shell.back();
  state.storage.set(
    SNAKE_KEYBOARD_KEY,
    JSON.stringify(replaceCouchKey(saved, 1, 'down', 'KeyU', 'snake')),
  );
  state.window.emit('storage', { key: SNAKE_KEYBOARD_KEY });
  assert.match(state.$('snake-key-1-down').textContent, /K/);
  snakeKeyboardSettings(state);
  assert.match(state.$('snake-key-1-down').textContent, /U/);
  assert.match(state.$('controls-help').textContent, /U/);
  assert.match(state.$('snake-key-save-status').textContent, /another tab/);
  assert.deepEqual(core.exportClassicSnakeReplay(run), before);
  assert.ok(locks.calls.every(({ key }) => key === `${SNAKE_KEYBOARD_KEY}:writer`));
});
