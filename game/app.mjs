import { onNativeInactive, nativePlatform } from './platform.mjs';
import { createRun, stepRun, getSummary, releaseInputs, CLASSES, FIXED_DT } from './core/index.mjs';
import { BoardPainter } from './ui/render.mjs';
import { encounterView } from './ui/encounter-view.mjs';
import { attachInput } from './ui/input.mjs';
import { createControllerRouter } from './ui/controller-router.mjs';
import { attachControllerNavigation } from './ui/controller-navigation.mjs';
import { attachControllerReading } from './ui/controller-reading.mjs';
import { attachControllerPreview } from './ui/controller-preview.mjs';
import { attachPracticeNavigation } from './ui/practice-navigation.mjs';
import { attachControllerSettings } from './ui/controller-settings.mjs';
import { controllerBindingLabels, controllerStickLabel } from './controller-bindings.mjs';
import { attachKeySettings } from './ui/key-settings.mjs';
import { actionForKey, bindingLabels, keyLabel, resolveKeyBindings } from './key-bindings.mjs';
import { Soundscape, DEFAULT_TRACKS } from './ui/audio.mjs';
import { attachLibraryPanel } from './ui/library-panel.mjs';
import { masteryFor, masteryText } from './ui/mastery-view.mjs';
import { createMasteryObserver, captureMasterySetup, captureMasteryFacts } from './mastery.mjs';
import { createMasteryAwards } from './mastery-awards.mjs';
import { createMasteryCatalog } from './mastery-catalog.mjs';
import { normalizedLevel } from './core/level.mjs';
import { canonicalJSON } from './data-json.mjs';
import {
  emptyLibrary,
  loadLibrary,
  saveLibrary,
  progressFor,
  recordLibraryCompletion,
  campaignKey,
  updatePreferences,
  withMasteryRecords,
} from './library.mjs';
import {
  emptyPackLibrary,
  importPackLibrary,
  exportPackLibrary,
  resolvePackCampaign,
} from './packs.mjs';
import { readAssetStore, writeAssetStore } from './storage.mjs';
import { suspendSession, restoreSession, saveSession } from './sessions.mjs';
import { challengeCampaign } from './challenges.mjs';
import { campaignContinuation, campaignSelection, savedFlightPreview } from './continuation.mjs';
import { missionBriefing } from './mission-brief.mjs';
import { claimProfileWriter } from './profile-writer.mjs';
import { commitBackup, recoverBackupImport } from './backup-storage.mjs';
import { offlineAvailability, prepareOffline, checkOffline } from './offline.mjs';
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  awardCompletion,
  achievements,
  appearanceMilestones,
  newAppearanceBodies,
  unlockedBodies,
  canPlay,
} from './progress.mjs';
import {
  downloadJSON,
  recommendedBody,
  MASTERY_SCENARIO_VERSION,
  ENCOUNTER_SCENARIO_VERSION,
  scenarioMasteryCampaign,
} from './content.mjs';
import { prepareScenario } from './imports.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  MAX_REPLAY_TICKS,
} from './replay.mjs';

const $ = (id) => document.getElementById(id),
  show = (id, on) => ($(id).hidden = !on);
const getJSON = async (path) => {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load ${path}`);
  return r.json();
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const timeLabel = (time) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

try {
  const [baseCampaign, themesFile, presets, baseClasses] = await Promise.all([
    getJSON('content/campaign.json'),
    getJSON('content/themes.json'),
    getJSON('../authoring/motion-lab/presets.json'),
    getJSON('content/classes.json'),
  ]);
  let campaign = baseCampaign,
    classRegistry = baseClasses;
  campaign.classRecipes = classRegistry;
  const baseEntry = {
    campaign,
    classRecipes: classRegistry,
    themes: themesFile.themes,
    visualOverrides: {},
    levelVisuals: [],
    music: [],
    sourcePackId: null,
  };
  let activeEntry = baseEntry,
    packs = emptyPackLibrary();
  let installedEntries = [baseEntry],
    masteryCatalog = createMasteryCatalog([{ campaign: baseEntry.campaign, sourcePackId: null }]);
  function prepareContentCatalog(nextPacks) {
    const entries = [
      baseEntry,
      ...nextPacks.packs.flatMap((pack) =>
        pack.campaigns.map((source) => resolvePackCampaign(pack, source.id)),
      ),
    ];
    const registrations = createMasteryCatalog(
      entries.map((entry) => ({
        campaign: entry.campaign,
        sourcePackId: entry.sourcePackId,
        ...(entry.sourcePackFormat
          ? { sourcePackFormat: entry.sourcePackFormat, masteries: entry.masteries }
          : {}),
      })),
    );
    return { packs: nextPacks, entries, registrations };
  }
  function adoptContentCatalog(content) {
    packs = content.packs;
    installedEntries = content.entries;
    masteryCatalog = content.registrations;
  }
  let buildVersion = '0.12.0',
    isRelease = false;
  try {
    buildVersion = (await getJSON('build-info.json')).version;
    isRelease = true;
  } catch {}
  if (isRelease) document.querySelectorAll('[data-source-only]').forEach((a) => (a.hidden = true));
  $('version').textContent =
    `${/^\d/.test(buildVersion) ? 'v' : ''}${buildVersion}${isRelease ? '' : ' / DEV'}`;
  const params = new URLSearchParams(location.search);
  let scenario = null;
  if (params.get('practice') === '1') {
    const raw = sessionStorage.getItem('revealline.playground.current');
    if (!raw)
      throw new Error(
        'This practice tab has no configuration. Open the Playground and choose Play configuration.',
      );
    const prepared = await prepareScenario(JSON.parse(raw), { classRecipes: classRegistry });
    scenario = prepared.scenario;
  }
  // Switching source maps inside an authored preview must not turn the same
  // session into an awarding game, even when the configured scenario is cleared.
  const practiceSession = !!scenario;
  const controllerPreviewRequested = practiceSession && params.get('controller-preview') === '1';
  if (
    window.parent !== window &&
    window.name === 'revealline-controller-practice' &&
    !controllerPreviewRequested
  )
    throw new Error('Return to Controller practice and choose Load practice to continue.');
  const controllerPreview = attachControllerPreview({ enabled: controllerPreviewRequested });
  const practiceNavigation = attachPracticeNavigation({
    enabled: practiceSession,
    onBlocked: () =>
      warning(
        controllerPreviewRequested
          ? 'Use the Controller practice page’s header links to leave practice.'
          : 'Use the Playground page’s header links to open the solo game. This preview stays in practice.',
      ),
  });
  // Each archived release keeps its own profile schema, packs and save slot.
  // A portable complete backup transfers progress without changing older versions.
  const channel = isRelease ? `release-${buildVersion}` : 'dev';
  const libraryKey = `revealline.library.${channel}.v1`;
  const packsKey = `revealline.packs.${channel}.v1`;
  const sessionKey = `revealline.suspended.${channel}.v1`;
  const writer = scenario
    ? {
        writable: false,
        reason:
          'Practice keeps its settings in this preview. Open the solo game to save campaign progress.',
        release() {},
      }
    : await claimProfileWriter(navigator.locks, `${libraryKey}.writer`);
  let persistenceReady = writer.writable;
  let handlePageHide = () => writer.release();
  window.addEventListener('pagehide', (event) => handlePageHide(event));
  const journalKey = `${libraryKey}.backup-journal`;
  const backupAdapters = () => ({
    storage: localStorage,
    readAsset: readAssetStore,
    writeAsset: writeAssetStore,
    profileKey: libraryKey,
    packsKey,
    sessionKey,
    journalKey,
    commitProfile: (next, options) => {
      // The import lock is held here. Startup may have stopped at unreadable packs
      // before it could inspect the profile that this explicit replacement repairs.
      const current = loadLibrary(localStorage, libraryKey, { campaigns: [campaign] });
      return saveLibrary(localStorage, libraryKey, next, current.recovery, {
        ...options,
        baseline: libraryBaseline,
        generation: libraryGeneration,
      });
    },
  });
  let packWarning = scenario ? '' : writer.reason || '';
  if (persistenceReady) {
    try {
      const result = await recoverBackupImport(backupAdapters());
      if (!result.ok) persistenceReady = false;
      if (result.warning) packWarning = result.warning;
    } catch (e) {
      persistenceReady = false;
      packWarning = `Storage recovery: ${e.message}`;
    }
  }

  let loaded = { library: emptyLibrary(), warning: '', recovery: null, generation: 'legacy' };
  let storedStateAdopted = false;
  async function readSavedState() {
    if (
      localStorage.getItem(`${libraryKey}.backup-lock`) !== null ||
      (await readAssetStore(journalKey)) !== null
    )
      throw new Error(
        'An interrupted backup needs recovery. Stored data is preserved; reload after recovery before saving.',
      );
    const rawPacks = await readAssetStore(packsKey);
    const prepared = rawPacks ? await importPackLibrary(rawPacks) : emptyPackLibrary();
    const profile = loadLibrary(localStorage, libraryKey, { campaigns: [campaign] });
    return { content: prepareContentCatalog(prepared), profile };
  }
  try {
    const snapshot = navigator.locks?.request
      ? await navigator.locks.request(`${libraryKey}.backup-lock`, readSavedState)
      : await readSavedState();
    adoptContentCatalog(snapshot.content);
    loaded = snapshot.profile;
    storedStateAdopted = loaded.recovery === null;
  } catch (error) {
    persistenceReady = false;
    loaded.warning = `Stored collection was not adopted: ${error.message} This session starts with base content; your stored bytes remain untouched.`;
  }
  let libraryBaseline = loaded.library,
    libraryGeneration = loaded.generation || 'legacy';
  let library = loaded.library,
    progress = progressFor(library, campaign),
    recovery = loaded.recovery;
  if (loaded.warning || packWarning) {
    $('save-warning').textContent = [loaded.warning, packWarning].filter(Boolean).join(' ');
    show('save-warning', true);
  }
  const initialSelection = campaignSelection(progress, campaign);
  let levelIndex = initialSelection.levelIndex,
    campaignOverview = !scenario && initialSelection.overview,
    theme = themesFile.themes[0],
    classId = 'scout',
    turnPolicy = 'immediate',
    seed = 1,
    bodyId = theme.player,
    run,
    runId,
    started = false,
    paused = true,
    demo = false,
    practice = practiceSession,
    accumulator = 0,
    handled = false,
    pendingAction = false,
    pendingPickup = false,
    pendingSwitch = null,
    saveSucceeded = true,
    recorder = null,
    recordingStopped = false,
    captionUntil = 0,
    bodyWarning = '',
    lastReplay = null,
    completionWarning = '',
    appearanceRewardIds = [],
    celebrationActive = false,
    sessionBusy = false,
    restoreController = null,
    themeOverride = false,
    musicOverride = false,
    masteryDefinition = null,
    masteryObserver = null,
    masteryAward = null;
  const masteryAwards = createMasteryAwards({
    getGeneration: () => libraryGeneration,
    commit: (record) => {
      library = withMasteryRecords(library, [record]);
      return persistProfile().ok;
    },
    onStatus: (status) => {
      if (['earned', 'session'].includes(status.status)) libraryPanel.refreshMasteries();
      if (status.runId !== runId) return;
      masteryAward = status;
      refreshMastery();
      if (['earned', 'session', 'unavailable'].includes(status.status))
        $('mastery-announcement').textContent = status.message;
    },
  });
  theme = themesFile.themes.find((t) => t.id === library.preferences.themeId) || theme;
  classId = classRegistry.some((c) => c.id === library.preferences.classId)
    ? library.preferences.classId
    : classId;
  turnPolicy = library.preferences.turnPolicy;
  bodyId = library.preferences.bodyId;
  if (scenario) {
    theme = scenario.theme;
    classId = scenario.settings.classId;
    turnPolicy = scenario.settings.turnPolicy;
    seed = scenario.settings.seed;
    bodyId = theme.player;
  }
  const sound = new Soundscape();
  const painter = new BoardPainter(presets, {
    onAsset: (message) => {
      const rig = visuals()?.player
        ? 'Custom player artwork keeps the selected body’s rotor anchors. Check alignment.'
        : '';
      const copy = [message, rig, bodyWarning].filter(Boolean).join(' ');
      $('asset-warning').textContent = copy;
      show('asset-warning', !!copy);
    },
  });
  const mediaReduce = matchMedia('(prefers-reduced-motion: reduce)');
  $('reduced-effects').checked = mediaReduce.matches || library.preferences.reducedEffects;
  $('tap-steering').checked =
    library.preferences.tapSteering ?? matchMedia('(pointer: coarse)').matches;
  $('music-select').value = library.preferences.musicGenre;
  $('master-volume').value = library.preferences.masterVolume;
  $('music-volume').value = library.preferences.musicVolume;
  $('sfx-volume').value = library.preferences.sfxVolume;
  $('terrain-select').value = library.preferences.style;
  $('settings-grid').checked = library.preferences.showGrid;
  $('match-class-appearance').checked = library.preferences.matchClassAppearance;
  sound.configure?.({
    style: library.preferences.musicGenre,
    master: library.preferences.masterVolume,
    music: library.preferences.musicVolume,
    sfx: library.preferences.sfxVolume,
  });
  if (scenario?.music) sound.setTrack(scenario.music);
  function warning(message) {
    $('run-message').textContent = message;
    captionUntil = (run?.time || 0) + 5;
  }
  function dialogOpen() {
    return !!document.querySelector('dialog[open]');
  }
  const controller = createControllerRouter({
    bindings: library.preferences.controllerBindings,
    ...(controllerPreview ? { readPads: controllerPreview.readPads } : {}),
  });
  let controllerLabels = controllerBindingLabels(library.preferences.controllerBindings);
  let controllerFrame = null,
    controllerNavigation = null,
    controllerReading = null,
    controllerStatus = '',
    controllerPreviousScope = '',
    controllerInactive = false;
  const controllerDialog = () => [...document.querySelectorAll('dialog[open]')].at(-1);
  function controllerMenuHint() {
    const b = controllerLabels.menu;
    return `Controller: direction controls move focus · ${b.confirm} confirms · ${b.back} goes back · ${b.menu} resumes a paused flight.`;
  }
  function controllerFlightHint() {
    const b = controllerLabels.flight;
    return `Controller: ${b.ability} ability · ${b.pickup} supply · ${b.boost} boost · ${b.hangar} hangar · ${b.stop} stop · ${b.pause} pause.`;
  }
  function refreshControllerPrompts() {
    controllerLabels = controllerBindingLabels(library.preferences.controllerBindings);
    const b = controllerLabels.flight;
    const directions = `Up ${b.up}, down ${b.down}, left ${b.left}, right ${b.right}; ${controllerStickLabel(library.preferences.controllerBindings, 'flight')}.`;
    $('controller-help').textContent =
      `Release all controls, then press a physical face button or Menu to join. Joining never starts a mission. ${directions} ${controllerFlightHint()} ${controllerMenuHint()} Confirm a select or slider to edit; confirm again to apply or go back to cancel. Change your layout in Settings → Controller controls.`;
    $('controller-ui-hint').textContent =
      controllerScope() === 'flight' ? controllerFlightHint() : controllerMenuHint();
    controllerReading?.refresh();
  }
  function controllerScope() {
    const dialog = controllerDialog();
    if (dialog) return `modal:${dialog.id}`;
    if (celebrationActive) return 'celebration';
    if (run?.status === 'won') return $('show-result').hidden ? 'won' : 'picture';
    if (run?.status === 'lost') return 'lost';
    if (campaignOverview) return `overview:${campaign.id}`;
    if (!started) return `ready:${campaign.id}:${run?.levelId}`;
    return paused ? 'paused' : 'flight';
  }
  function controllerFocus() {
    const dialog = controllerDialog();
    if (dialog) {
      if (dialog.id === 'hangar-dialog') return $('switch-class-select');
      if (dialog.id === 'collection-dialog')
        return $('gallery-grid').querySelector('button') || $('gallery-search');
      return dialog.querySelector('button:not(:disabled),select:not(:disabled),summary');
    }
    const scope = controllerScope();
    if (scope === 'celebration') return $('skip-celebration');
    if (scope === 'picture') return $('show-result');
    if (scope === 'won' || scope.startsWith('overview:')) return $('next-button');
    if (scope === 'lost') return $('retry-button');
    return $('start-button');
  }
  function controllerBack() {
    const dialog = controllerDialog();
    if (dialog) {
      const transferCancel = $('transfer-cancel');
      if (
        dialog.id === 'library-dialog' &&
        transferCancel &&
        !transferCancel.hidden &&
        !transferCancel.disabled
      ) {
        transferCancel.click();
        return;
      }
      if (dialog.id === 'settings-dialog' && !$('cancel-key-capture').hidden) {
        $('cancel-key-capture').click();
        return;
      }
      // Follow the same cancellable lifecycle as Escape. Library transactions
      // may prevent cancellation; picture close restores its collection focus.
      if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
      else
        $('controller-ui-hint').textContent =
          'This operation is still in progress. Use its Cancel action when available.';
      return;
    }
    const scope = controllerScope();
    if (scope === 'paused') resume();
    else if (scope === 'celebration') $('skip-celebration').click();
    else if (scope === 'picture') $('show-result').click();
    else controllerFocus()?.focus();
  }
  const input = attachInput({
    arena: $('game-canvas'),
    onPause: (force) => pause(force),
    onActivity: () => {
      if (started && paused && !dialogOpen()) resume();
    },
    tapMode: () => $('tap-steering').checked,
    active: () => started && !dialogOpen() && !['won', 'lost'].includes(run?.status),
    onGamepad: (message) => ($('input-status').textContent = message),
    getBindings: () => library.preferences.keyboardBindings,
    readControllerCommand: () => controllerFrame?.flight,
  });
  controllerNavigation = attachControllerNavigation({
    getScope: controllerScope,
    getRoot: () => controllerDialog() || document,
    getDefaultFocus: controllerFocus,
    getControlLabels: () => ({
      directions: 'Direction controls',
      confirm: controllerLabels.menu.confirm,
      back: controllerLabels.menu.back,
    }),
    accept: (element) =>
      !element.matches(
        '[data-move],#stop-button,#boost-button,#action-button,#pickup-button,#pause-button',
      ),
    onBack: controllerBack,
    onMenu: () => {
      if (!dialogOpen() && started && paused && !['won', 'lost'].includes(run?.status)) resume();
    },
    onHint: (message) => {
      $('controller-ui-hint').textContent = message;
      controllerReading?.hint(message);
    },
    onReadingChange: (state) => controllerReading?.changed(state),
  });
  controllerReading = attachControllerReading({
    getNavigation: () => controllerNavigation,
    getControlLabels: () => controllerLabels.menu,
    getScope: controllerScope,
    pause,
    onTransition: () => clearInput({ preserveNavigation: true }),
  });
  handlePageHide = (event) => {
    // Suspend while this tab still owns the writer. A history-cache return
    // keeps its memory available for export without reclaiming stale storage.
    pause(true);
    masteryAwards.cancelAll();
    cancelRestore();
    clearInput();
    sound.pause();
    writer.release();
    persistenceReady = false;
    controllerPreview?.clear();
    if (!event.persisted) {
      controllerReading.destroy();
      controllerNavigation.destroy();
      input.destroy();
      controller.destroy();
      controllerPreview?.destroy();
      practiceNavigation.destroy();
    }
  };
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    controller.invalidate();
    clearInput();
    pause(true);
    $('save-warning').textContent =
      'This tab returned from browser history in session-only mode. Export a complete backup to keep its current progress, then reload to open the latest saved profile.';
    show('save-warning', true);
  });
  function refreshKeyPrompts() {
    const bindings = resolveKeyBindings(library.preferences.keyboardBindings);
    const labels = bindingLabels(bindings);
    const description = `Up ${labels.up}; down ${labels.down}; left ${labels.left}; right ${labels.right}; ability ${labels.ability}; supply ${labels.pickup}; boost ${labels.boost}; change craft ${labels.hangar}; stop ${labels.stop}; pause ${labels.pause}.`;
    $('keyboard-help').textContent = description;
    $('game-canvas').setAttribute('aria-label', `Territory capture game. ${description}`);
    for (const [id, action] of [
      ['action-button', 'ability'],
      ['pickup-button', 'pickup'],
      ['boost-button', 'boost'],
    ]) {
      $(id).querySelector('kbd').textContent = keyLabel(bindings.bindings[action][0])
        .replace('Left ', 'L ')
        .replace('Right ', 'R ');
      $(id).querySelector('kbd').title = labels[action];
    }
    $('hangar-button').textContent = `Change craft · ${labels.hangar}`;
    $('stop-button').title = `Stop moving · ${labels.stop}`;
    for (const button of document.querySelectorAll('[data-move]'))
      button.title = `Move ${button.dataset.move} · ${labels[button.dataset.move]}`;
    if (!started && !campaignOverview)
      $('overlay-footnote').textContent =
        `Move with your configured keys · ${labels.ability} ability · ${labels.pickup} supply · touch controls below`;
  }
  const keySettings = attachKeySettings({
    getBindings: () => library.preferences.keyboardBindings,
    setBindings: (value) => {
      preferences({ keyboardBindings: value });
      return saveSucceeded && !practice
        ? { ok: true }
        : {
            ok: false,
            warning:
              'Keys changed for this session. Export your library to retain session-only preferences.',
          };
    },
    onChanged: () => {
      clearInput();
      refreshKeyPrompts();
    },
  });
  const controllerSettings = attachControllerSettings({
    container: $('controller-settings-root'),
    getBindings: () => library.preferences.controllerBindings,
    onBeforeEdit: () => keySettings.refresh(),
    onApply: (value) => {
      preferences({ controllerBindings: value });
      controller.setBindings(library.preferences.controllerBindings);
      clearInput();
      refreshControllerPrompts();
      return saveSucceeded && !practice
        ? { ok: true }
        : {
            ok: false,
            warning:
              'Controller controls changed for this session. Export your library to retain session-only preferences.',
          };
    },
  });
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      keySettings.destroy();
      controllerSettings.destroy();
    }
  });
  function clearInput({ preserveNavigation = false } = {}) {
    pendingAction = false;
    pendingPickup = false;
    pendingSwitch = null;
    controller.clear();
    controllerFrame = null;
    if (!preserveNavigation) controllerNavigation?.clear();
    input.clear();
    if (run) {
      releaseInputs(run);
      if (recorder && !recordingStopped) recordRelease(recorder);
    }
    accumulator = 0;
  }
  function catalog() {
    const entries = [...installedEntries];
    for (const key of Object.keys(library.campaigns)) {
      const id = key.split('/')[0],
        match = /^route-(\d{4}-\d\d-\d\d)-(daily|calm|expert)$/.exec(id);
      if (match) {
        try {
          const c = challengeCampaign(match[1], match[2], baseClasses);
          entries.push({ ...baseEntry, campaign: c });
        } catch {}
      }
    }
    if (!entries.some((e) => campaignKey(e.campaign) === campaignKey(activeEntry.campaign)))
      entries.push(activeEntry);
    return entries.filter(
      (e, i, all) =>
        all.findIndex((x) => campaignKey(x.campaign) === campaignKey(e.campaign)) === i,
    );
  }
  function refreshCampaigns() {
    $('campaign-select').replaceChildren(
      ...catalog().map(
        (e) =>
          new Option(e.campaign.title || e.campaign.name || e.campaign.id, campaignKey(e.campaign)),
      ),
    );
    $('campaign-select').value = campaignKey(campaign);
  }
  function persistProfile({ mode = 'merge' } = {}) {
    let saved;
    try {
      saved =
        persistenceReady && writer.writable
          ? saveLibrary(localStorage, libraryKey, library, recovery, {
              baseline: libraryBaseline,
              generation: libraryGeneration,
              mode,
            })
          : {
              ok: false,
              warning:
                writer.reason ||
                'Storage recovery must finish before saving. Export your session before reloading.',
            };
    } catch {
      saved = { ok: false, warning: 'Storage is unavailable. Export your player library.' };
    }
    saveSucceeded = saved.ok;
    if (saved.ok) {
      recovery = null;
      library = saved.library;
      libraryBaseline = library;
      libraryGeneration = saved.generation;
      progress = progressFor(library, campaign);
    } else {
      $('save-warning').textContent = saved.warning;
      show('save-warning', true);
    }
    return saved;
  }
  function preferences(patch) {
    library = updatePreferences(library, { ...library.preferences, ...patch });
    if (!practice) persistProfile();
  }
  function cancelRestore() {
    restoreController?.abort();
  }
  function selectEntry(
    entry,
    { levelId, themeId, seed: selectedSeed, restoreAdoption = false } = {},
  ) {
    if (!entry) throw new Error('This campaign is not installed.');
    if (selectedSeed !== undefined) {
      if (!Number.isInteger(selectedSeed) || selectedSeed < 0 || selectedSeed > 0xffffffff)
        throw new Error('Picture seed is invalid.');
      seed = selectedSeed;
    }
    if (!restoreAdoption) cancelRestore();
    themeOverride = !!themeId;
    musicOverride = false;
    scenario = null;
    practice = practiceSession;
    demo = false;
    activeEntry = entry;
    campaign = entry.campaign;
    classRegistry = entry.classRecipes;
    campaign.classRecipes = classRegistry;
    themesFile.themes = entry.themes;
    progress = progressFor(library, campaign);
    const selection = campaignSelection(progress, campaign, { levelId });
    levelIndex = selection.levelIndex;
    campaignOverview = !practice && selection.overview;
    if (!classRegistry.some((c) => c.id === classId)) classId = classRegistry[0].id;
    theme = entry.themes.find((t) => t.id === (themeId || campaign.themeId)) || entry.themes[0];
    bodyId = theme.player;
    $('theme-select').replaceChildren(...entry.themes.map((t) => new Option(t.name, t.id)));
    $('theme-select').value = theme.id;
    $('class-select').replaceChildren(...classRegistry.map((c) => new Option(c.label, c.id)));
    const track = entry.music?.find((m) => m.id === campaign.musicId) || entry.music?.[0];
    if (track) {
      sound.setTrack?.(track);
      $('music-select').value = track.genre;
    } else sound.configure?.({ style: library.preferences.musicGenre });
    refreshCampaigns();
    prepare({ restoreAdoption });
  }
  function savedAttempt() {
    try {
      const raw = localStorage.getItem(sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function refreshSavedFlight() {
    const preview = practice
      ? null
      : savedFlightPreview(
          savedAttempt(),
          catalog().map((entry) => ({
            key: campaignKey(entry.campaign),
            campaign: entry.campaign,
          })),
        );
    const atReady = !started && !practice;
    show('continue-saved', atReady && !!preview);
    show('continue-saved-note', atReady && !!preview);
    $('continue-saved').disabled = sessionBusy;
    $('continue-saved').textContent = sessionBusy
      ? 'Verifying saved flight…'
      : 'Load saved flight →';
    $('continue-saved-note').textContent = preview ? `${preview.title}. ${preview.note}` : '';
    $('continue-saved').title = preview?.title || 'Load saved flight';
  }
  function assertWriter() {
    if (!persistenceReady || !writer.writable)
      throw new Error(writer.reason || 'Storage recovery must finish before saving.');
    if (localStorage.getItem(`${libraryKey}.backup-lock`) !== null)
      throw new Error('A backup is being restored. Saving resumes when it finishes.');
  }
  function snapshotAttempt() {
    if (practice || !recorder || !started || ['won', 'lost'].includes(run.status))
      throw new Error('Start an unfinished campaign flight to save it.');
    return suspendSession({
      run,
      recorder,
      campaignKey: campaignKey(campaign),
      themeId: theme.id,
      bodyId,
      runId,
    });
  }
  function persistAttempt(notify = true) {
    assertWriter();
    const session = snapshotAttempt();
    let saved;
    try {
      saved = saveSession(localStorage, sessionKey, session);
    } catch {
      saved = { ok: false, warning: 'Storage is unavailable. Export this attempt.' };
    }
    if (notify)
      warning(
        saved.ok
          ? 'Flight saved. Load it from Library & saves whenever you return.'
          : saved.warning,
      );
    return session;
  }
  async function restoreAttempt(candidate) {
    if (sessionBusy) throw new Error('A flight is already being verified.');
    let entry = catalog().find((e) => campaignKey(e.campaign) === candidate?.campaignKey);
    if (!entry) {
      const match = /^route-(\d{4}-\d\d-\d\d)-(daily|calm|expert)\//.exec(
        candidate?.campaignKey || '',
      );
      if (match) {
        const c = challengeCampaign(match[1], match[2], baseClasses);
        const e = { ...baseEntry, campaign: c };
        if (campaignKey(c) === candidate.campaignKey) entry = e;
      }
    }
    if (!entry) throw new Error('Install the matching campaign pack before loading this flight.');
    sessionBusy = true;
    refreshSavedFlight();
    pause(true);
    const controller = new AbortController();
    restoreController = controller;
    try {
      const restored = await restoreSession(candidate, {
        campaign: entry.campaign,
        campaignKey: campaignKey(entry.campaign),
        signal: controller.signal,
        masteryDefinition:
          masteryFor(campaignKey(entry.campaign), candidate?.replay?.level?.id, masteryCatalog) ??
          undefined,
      });
      if (controller.signal.aborted)
        throw new Error('Loading was cancelled; your newer selection is kept.');
      selectEntry(entry, {
        levelId: restored.run.levelId,
        themeId: restored.session.themeId,
        restoreAdoption: true,
      });
      run = restored.run;
      recorder = restored.recorder;
      runId = restored.session.runId;
      masteryDefinition = masteryFor(campaignKey(campaign), run.levelId, masteryCatalog);
      masteryObserver = restored.masteryObserver ?? null;
      masteryAward = null;
      classId = run.classId;
      turnPolicy = run.turnPolicy;
      seed = run.seed;
      bodyId = presets.characters[restored.session.bodyId] ? restored.session.bodyId : theme.player;
      started = true;
      paused = true;
      handled = false;
      recordingStopped = false;
      clearInput();
      setTheme();
      painter.setLevel?.(run.level, { seed });
      updateLoadout();
      overlay('pause');
      refreshHUD();
      warning('Saved flight verified and restored. Press Resume to continue.');
    } finally {
      sessionBusy = false;
      if (restoreController === controller) restoreController = null;
      refreshSavedFlight();
    }
  }
  function adoptPreferences() {
    const p = library.preferences;
    turnPolicy = p.turnPolicy;
    classId = classRegistry.some((c) => c.id === p.classId) ? p.classId : classRegistry[0].id;
    theme = themesFile.themes.find((t) => t.id === p.themeId) || theme;
    bodyId = p.bodyId;
    $('theme-select').value = theme.id;
    $('music-select').value = p.musicGenre;
    $('master-volume').value = p.masterVolume;
    $('music-volume').value = p.musicVolume;
    $('sfx-volume').value = p.sfxVolume;
    $('terrain-select').value = p.style;
    $('settings-grid').checked = p.showGrid;
    $('match-class-appearance').checked = p.matchClassAppearance;
    $('reduced-effects').checked = p.reducedEffects;
    $('tap-steering').checked = p.tapSteering ?? matchMedia('(pointer: coarse)').matches;
    keySettings.refresh();
    controller.setBindings(p.controllerBindings);
    controllerSettings.refresh();
    clearInput();
    refreshKeyPrompts();
    refreshControllerPrompts();
    sound.configure?.({
      style: p.musicGenre,
      master: p.masterVolume,
      music: p.musicVolume,
      sfx: p.sfxVolume,
    });
    if (!p.musicEnabled) sound.disable();
    themeOverride = true;
    musicOverride = true;
    prepare();
  }
  const libraryPanel = attachLibraryPanel({
    focusMission,
    profileTransfer: isRelease
      ? {
          storage: localStorage,
          readAsset: readAssetStore,
          lockManager: navigator.locks,
          currentVersion: buildVersion,
        }
      : null,
    get: () => ({
      library,
      packs,
      campaign,
      theme,
      bodyId,
      run,
      recorder,
      runId,
      presets,
      sourcePackId: activeEntry.sourcePackId,
    }),
    base: () => baseEntry,
    catalog,
    getMasteryCatalog: () => masteryCatalog,
    select: selectEntry,
    pause: () => pause(true),
    saved: savedAttempt,
    suspend: () => {
      pause(true);
      return snapshotAttempt();
    },
    currentSession: () =>
      started && recorder && !practice && !['won', 'lost'].includes(run.status)
        ? snapshotAttempt()
        : savedAttempt(),
    canSnapshotBackup: () => storedStateAdopted,
    sessionNote: () =>
      [
        !storedStateAdopted
          ? 'This export contains the current session only. Unreadable stored data was not included; keep its original files.'
          : '',
        started && !recorder
          ? 'This flight no longer has a complete recording; the previous saved attempt is included when available.'
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    restore: restoreAttempt,
    beforeProfileReplacement: () => {
      cancelRestore();
      masteryAwards.cancelAll();
    },
    setLibrary: (next) => {
      masteryAwards.cancelAll();
      library = next;
      progress = progressFor(library, campaign);
      const saved = persistProfile({ mode: 'replace' });
      const selection = campaignSelection(progress, campaign);
      levelIndex = selection.levelIndex;
      campaignOverview = !practice && selection.overview;
      adoptPreferences();
      return saved;
    },
    applyBackup: async (prepared) => {
      const content = prepareContentCatalog(prepared.packs);
      if (!writer.writable) throw new Error(writer.reason);
      if (!persistenceReady) {
        const recovered = await recoverBackupImport(backupAdapters());
        if (!recovered.ok) throw new Error(recovered.warning);
      } else assertWriter();
      pause(true);
      cancelRestore();
      masteryAwards.cancelAll();
      const result = await commitBackup(prepared, backupAdapters());
      if (!result.ok) {
        if (result.recoveryRequired) persistenceReady = false;
        throw new Error(result.warning);
      }
      persistenceReady = true;
      storedStateAdopted = true;
      saveSucceeded = true;
      if (result.warning) {
        $('save-warning').textContent = result.warning;
        show('save-warning', true);
      } else show('save-warning', false);
      library = result.profile.library;
      libraryBaseline = library;
      libraryGeneration = result.profile.generation;
      recovery = null;
      adoptContentCatalog(content);
      selectEntry(baseEntry);
      adoptPreferences();
      refreshCampaigns();
      return result;
    },
    setPacks: async (next) => {
      assertWriter();
      const content = prepareContentCatalog(next);
      pause(true);
      cancelRestore();
      masteryAwards.cancelAll();
      try {
        await writeAssetStore(packsKey, exportPackLibrary(next));
      } catch (e) {
        throw new Error(`Pack storage failed; previous installed packs are kept. ${e.message}`);
      }
      adoptContentCatalog(content);
      if (activeEntry.sourcePackId && !packs.packs.some((p) => p.id === activeEntry.sourcePackId))
        selectEntry(baseEntry);
      else if (activeEntry.sourcePackId) {
        const p = packs.packs.find((p) => p.id === activeEntry.sourcePackId);
        selectEntry(
          resolvePackCampaign(
            p,
            p.campaigns.some((c) => c.id === campaign.id) ? campaign.id : p.campaigns[0].id,
          ),
        );
      }
      refreshCampaigns();
    },
  });
  $('library-dialog').addEventListener('close', cancelRestore);
  $('campaign-select').onchange = () =>
    selectEntry(catalog().find((e) => campaignKey(e.campaign) === $('campaign-select').value));
  $('save-attempt-button').onclick = () => {
    pause(true);
    try {
      persistAttempt();
    } catch (e) {
      warning(e.message);
    }
  };
  $('hangar-button').onclick = () => {
    pause(true);
    $('switch-class-select').replaceChildren(
      ...(scenario?.classRecipes || classRegistry).map((c) => new Option(c.label, c.id)),
    );
    $('switch-class-select').value = run.activeClassId || classId;
    $('switch-description').textContent = run.classRecipe.description;
    $('switch-status').textContent = 'Your flight is paused while choosing.';
    $('hangar-dialog').showModal();
  };
  $('switch-class-select').onchange = () => {
    $('switch-description').textContent =
      (scenario?.classRecipes || classRegistry).find((c) => c.id === $('switch-class-select').value)
        ?.description || '';
  };
  $('switch-class-button').onclick = () => {
    const next = $('switch-class-select').value;
    $('hangar-dialog').close();
    resume();
    pendingSwitch = next;
  };
  document.addEventListener('keydown', (e) => {
    if (
      actionForKey(resolveKeyBindings(library.preferences.keyboardBindings), e) === 'hangar' &&
      !e.repeat &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.target.closest(
        'input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[data-game-reading]',
      ) &&
      !dialogOpen()
    ) {
      e.preventDefault();
      $('hangar-button').click();
    }
  });
  $('skip-celebration').onclick = () => {
    painter.skipCelebration?.();
    celebrationActive = false;
    show('skip-celebration', false);
    show('game-overlay', false);
    show('show-result', true);
  };
  $('settings-button').onclick = () => {
    pause(true);
    controllerSettings.refresh();
    $('settings-dialog').showModal();
  };
  let offlinePrepared = false;
  const offline = offlineAvailability();
  show('offline-button', offline.available);
  show('native-diagnostics', nativePlatform() === 'ios');
  $('offline-status').textContent = offline.available
    ? 'Download this release for offline play on this device.'
    : offline.reason;
  $('offline-button').onclick = async () => {
    $('offline-button').disabled = true;
    try {
      const result = await (offlinePrepared ? checkOffline : prepareOffline)({
        onStatus: (s) => {
          $('offline-status').textContent = s.message || String(s);
        },
      });
      $('offline-status').textContent =
        `${result.message || result.status}${result.verified ? ` · ${result.verified} files verified` : ''}`;
      $('offline-details').textContent = JSON.stringify(result, null, 2);
      offlinePrepared = result.status === 'ready' || result.status === 'waiting';
      $('offline-button').textContent = offlinePrepared
        ? 'Verify offline files'
        : 'Prepare offline play';
    } catch (e) {
      $('offline-status').textContent = e.message;
    } finally {
      $('offline-button').disabled = false;
    }
  };
  function tuneMusic(event) {
    if (event?.target.id === 'music-select') {
      musicOverride = true;
      sound.setTrack(DEFAULT_TRACKS.find((t) => t.genre === $('music-select').value));
    }
    sound.configure?.({
      style: $('music-select').value,
      master: Number($('master-volume').value),
      music: Number($('music-volume').value),
      sfx: Number($('sfx-volume').value),
    });
    preferences({
      musicGenre: $('music-select').value,
      masterVolume: Number($('master-volume').value),
      musicVolume: Number($('music-volume').value),
      sfxVolume: Number($('sfx-volume').value),
    });
  }
  for (const id of ['music-select', 'master-volume', 'music-volume', 'sfx-volume'])
    $(id).onchange = tuneMusic;
  $('music-preview').onclick = async () => {
    try {
      const ok = await sound.preview({ seconds: 4 });
      $('music-preview').textContent = ok
        ? 'Playing a four-second preview ♫'
        : 'Audio is unavailable';
      if (ok) {
        preferences({ musicEnabled: true });
        $('sound-button').setAttribute('aria-pressed', 'true');
        $('sound-button').setAttribute('aria-label', 'Mute sound');
      }
    } catch (e) {
      warning(e.message);
    }
  };
  $('settings-dialog').addEventListener('close', () => {
    sound.pause();
    controllerSettings.refresh();
  });
  $('match-class-appearance').onchange = () => {
    preferences({ matchClassAppearance: $('match-class-appearance').checked });
    setTheme();
  };
  $('terrain-select').onchange = () => {
    preferences({ style: $('terrain-select').value });
    setTheme();
  };
  $('settings-grid').onchange = () => preferences({ showGrid: $('settings-grid').checked });
  $('reduced-effects').onchange = () =>
    preferences({ reducedEffects: $('reduced-effects').checked });
  function visuals() {
    return (
      scenario?.visualOverrides || {
        ...activeEntry.visualOverrides,
        ...activeEntry.levelVisuals?.find((v) => v.levelId === campaign.levels[levelIndex]?.id)
          ?.visualOverrides,
      }
    );
  }
  function setTheme() {
    if (library.preferences.matchClassAppearance) {
      const candidate = recommendedBody(theme, run?.activeClassId || classId, theme.player);
      bodyId =
        Object.hasOwn(presets.characters, candidate) &&
        (practice || unlockedBodies(progress, campaign).has(candidate))
          ? candidate
          : 'neutral-marker';
    }
    bodyWarning = '';
    if (!Object.hasOwn(presets.characters, bodyId)) {
      bodyWarning = `Body ${bodyId} is not registered. Using the neutral rig; choose a registered appearance to change its animation.`;
      bodyId = 'neutral-marker';
    }
    for (const [name, value] of Object.entries({
      paper: theme.palette.paper,
      ink: theme.palette.ink,
      accent: theme.palette.accent,
      safe: theme.palette.safe,
      danger: theme.palette.danger,
    }))
      document.documentElement.style.setProperty(`--${name}`, value);
    $('theme-caption').textContent =
      `${theme.name.toUpperCase()} / ${theme.subtitle.toUpperCase()}`;
    $('score-label').textContent = theme.labels.currency.toUpperCase();
    $('pickup-button').firstChild.textContent = theme.labels.supply + ' ';
    $('action-button').title = theme.labels.ability;
    $('world-legend').textContent =
      `${theme.labels.enemy} · ${theme.labels.boss} · ${theme.labels.supply}`;
    $('footer-note').textContent =
      theme.id === 'coupa'
        ? 'Fictional spend-management theme · original helper artwork'
        : 'Original worlds · make every line count';
    painter.style = scenario?.presentation?.style || library.preferences.style;
    updateBodies();
    painter.setLook(theme, bodyId, visuals());
  }
  function updateBodies() {
    const allowed = unlockedBodies(progress, campaign);
    $('body-select').replaceChildren();
    for (const [id, body] of Object.entries(presets.characters)) {
      const option = new Option(
        `${body.label}${allowed.has(id) || practice ? '' : ' · locked'}`,
        id,
      );
      option.disabled = !allowed.has(id) && !practice;
      $('body-select').append(option);
    }
    if (!allowed.has(bodyId) && !practice)
      bodyId =
        allowed.has(theme.player) && Object.hasOwn(presets.characters, theme.player)
          ? theme.player
          : 'neutral-marker';
    $('body-select').value = bodyId;
    const next = appearanceMilestones(progress, campaign).find((tier) => !tier.earned);
    $('appearance-hint').textContent = practice
      ? 'Preview access: all appearances are available. Practice grants no campaign rewards.'
      : next
        ? `${next.name}: ${next.count} / ${next.target} different missions in this campaign. See Collection for the appearances.`
        : 'All chapter appearances are available in this campaign. Cosmetics do not change abilities.';
  }
  const bodyLabels = (ids) => ids.map((id) => presets.characters[id]?.label || id);
  function paintAppearanceRewards() {
    const name = campaign.title || campaign.name || campaign.id;
    $('appearance-campaign').textContent = `Campaign appearances · ${name}`;
    $('appearance-rewards').replaceChildren();
    for (const tier of appearanceMilestones(progress, campaign)) {
      const row = document.createElement('article');
      row.className = `appearance-reward${tier.earned ? ' earned' : ''}`;
      const thumbnail = document.createElement('img');
      thumbnail.alt = '';
      thumbnail.width = thumbnail.height = 64;
      const body = presets.characters[tier.bodyIds[0]];
      if (body?.src)
        thumbnail.src = new URL(`../authoring/motion-lab/${body.src}`, import.meta.url).href;
      const copy = document.createElement('div');
      const title = document.createElement('h4');
      title.textContent = tier.name;
      const state = document.createElement('p');
      state.className = 'reward-progress';
      state.textContent = `${tier.earned ? 'Available' : 'Locked'} · ${Math.min(tier.count, tier.target)} / ${tier.target} different ${tier.target === 1 ? 'mission' : 'missions'}`;
      const names = document.createElement('p');
      names.textContent = bodyLabels(tier.bodyIds).join(' · ');
      const detail = document.createElement('p');
      detail.className = 'reward-detail';
      const remaining = tier.target - tier.count;
      detail.textContent = tier.earned
        ? 'Available in this campaign.'
        : `Finish ${remaining} more ${remaining === 1 ? 'mission' : 'missions'} in this campaign.`;
      copy.append(title, state, names, detail);
      row.append(thumbnail, copy);
      $('appearance-rewards').append(row);
    }
    $('collection-note').textContent = practice
      ? 'Practice previews every appearance without earning rewards. These rows show existing campaign progress. Cosmetics do not change abilities.'
      : 'Appearances belong to this campaign. A different campaign has its own progress. Cosmetics do not change abilities.';
  }
  function focusAppearance() {
    if ($('collection-dialog').open) $('collection-dialog').close();
    $('body-select').focus({ preventScroll: true });
    $('body-select').scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  function leavePractice() {
    scenario = null;
    practice = practiceSession;
    demo = false;
    campaignOverview = false;
    theme = themesFile.themes.find((t) => t.id === theme.id) || themesFile.themes[0];
    if (!classRegistry.some((c) => c.id === classId)) classId = classRegistry[0].id;
    bodyId = unlockedBodies(progress, campaign).has(bodyId) ? bodyId : theme.player;
    $('class-select').replaceChildren(...classRegistry.map((c) => new Option(c.label, c.id)));
    $('theme-select').replaceChildren(...themesFile.themes.map((t) => new Option(t.name, t.id)));
    $('theme-select').value = theme.id;
    setTheme();
  }
  function paintMissions() {
    $('missions').replaceChildren();
    campaign.levels.forEach((level, index) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mission${index === levelIndex && !practice && !campaignOverview ? ' selected' : ''}`;
      b.disabled = !canPlay(progress, campaign, index);
      b.dataset.level = String(index);
      b.setAttribute('aria-label', `${index + 1}. ${level.name}${b.disabled ? ' — locked' : ''}`);
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = level.name;
      const medal = document.createElement('span');
      medal.className = 'medal';
      medal.textContent = progress.clears[level.id]
        ? '★'.repeat(progress.clears[level.id].medals)
        : b.disabled
          ? '—'
          : '↗';
      b.append(number, name, medal);
      b.onclick = () => {
        leavePractice();
        levelIndex = index;
        prepare();
        focusMission();
      };
      $('missions').append(b);
    });
    $('campaign-progress').textContent =
      `${String(Object.keys(progress.clears).length).padStart(2, '0')} / ${String(campaign.levels.length).padStart(2, '0')}`;
  }
  function updateLoadout() {
    const recipe =
      run?.classRecipe || (scenario?.classRecipes || classRegistry).find((c) => c.id === classId);
    $('class-description').textContent = recipe.description;
    $('action-button').firstChild.textContent = `${recipe.label} `;
    $('class-select').value = classId;
    $('turn-select').value = turnPolicy;
  }
  function focusMission() {
    $('arena-shell').scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    (campaignOverview ? $('next-button') : $('start-button')).focus({ preventScroll: true });
  }
  function currentBriefing() {
    return missionBriefing(scenario?.level || campaign.levels[levelIndex], {
      brief: scenario ? undefined : campaign.briefs?.[levelIndex],
      objectiveLabel: theme.labels.objective,
      classes: scenario?.classRecipes || classRegistry,
      intro:
        !practice &&
        !activeEntry.sourcePackId &&
        campaign.id === baseCampaign.id &&
        levelIndex === 0,
    });
  }
  function refreshMissionBrief() {
    const brief = currentBriefing();
    $('mission-brief-title').textContent = brief.fullTitle;
    $('mission-brief-copy').textContent = brief.fullBrief;
    $('mission-brief-facts').textContent = brief.facts;
    refreshMastery();
    return brief;
  }
  function refreshMastery() {
    const visible = !!masteryDefinition && !campaignOverview;
    show('mastery-brief', visible);
    show('mastery-status', visible && $('game-overlay').hidden);
    const kind = $('game-overlay').dataset.kind;
    show('mastery-overlay', visible && ['ready', 'pause', 'won', 'lost'].includes(kind));
    if (!visible) return;
    const preview = masteryObserver?.snapshot();
    for (const id of ['mastery-status', 'mastery-overlay']) {
      const text = masteryText(masteryDefinition, preview, {
        practice,
        award: masteryAward,
        compact: id === 'mastery-status',
      });
      if ($(id).textContent !== text) $(id).textContent = text;
    }
    $('mastery-brief').textContent =
      `Optional seal · ${masteryDefinition.name}. ${masteryDefinition.description} Your picture and next mission never depend on this goal.`;
  }
  function overlay(kind) {
    $('game-overlay').dataset.kind = kind;
    $('game-overlay').dataset.intro = String(
      kind === 'ready' &&
        !practice &&
        !activeEntry.sourcePackId &&
        campaign.id === baseCampaign.id &&
        levelIndex === 0,
    );
    show('game-overlay', true);
    show('show-result', false);
    show('view-picture', kind === 'won');
    show('next-button', kind === 'won' || kind === 'campaign-complete');
    show('choose-mission', kind === 'campaign-complete');
    show('retry-button', kind === 'won' || kind === 'lost');
    show('start-button', kind === 'ready' || kind === 'pause');
    show('result-medals', kind === 'won');
    const newAppearance = kind === 'won' && !practice && appearanceRewardIds.length > 0;
    show('appearance-unlock', newAppearance);
    show('choose-appearance', newAppearance);
    $('appearance-unlock').textContent = newAppearance
      ? `New appearances for ${campaign.title || campaign.name || campaign.id}: ${bodyLabels(appearanceRewardIds).join(' · ')}.`
      : '';
    $('overlay-eyebrow').textContent = practice
      ? 'PRACTICE / NO CAMPAIGN REWARDS'
      : `MISSION ${String(levelIndex + 1).padStart(2, '0')} / ${run.level.name.toUpperCase()}`;
    if (kind === 'ready') {
      const brief = refreshMissionBrief();
      $('overlay-eyebrow').textContent = practice
        ? 'PRACTICE / NO CAMPAIGN REWARDS'
        : `MISSION ${String(levelIndex + 1).padStart(2, '0')}`;
      $('overlay-title').textContent =
        $('game-overlay').dataset.intro === 'true' ? 'Clear a path.\nReveal a world.' : brief.title;
      $('overlay-copy').textContent = brief.copy;
      $('start-button').textContent = 'Start mission ↗';
      if (
        !practice &&
        !Object.hasOwn(progress.clears, run.levelId) &&
        Object.keys(progress.clears).length
      )
        $('start-button').textContent = 'Continue campaign →';
      refreshKeyPrompts();
    }
    if (kind === 'campaign-complete') {
      const completion = campaignContinuation(progress, campaign);
      $('overlay-eyebrow').textContent = 'CAMPAIGN COMPLETE';
      $('overlay-title').textContent = 'Every mission revealed.';
      $('overlay-copy').textContent =
        `${campaign.title || campaign.name || campaign.id}: ${completion.completed} / ${completion.total} missions complete. Enjoy your collection, choose a mission to replay, or select another campaign in the flight deck.`;
      $('next-button').textContent = 'View collection →';
      $('overlay-footnote').textContent = 'Your earned pictures and best results are kept.';
    }
    if (kind === 'pause') {
      $('overlay-title').textContent = 'Take a breath.';
      $('overlay-copy').textContent =
        'Your line, enemies and clock are paused. Continue when you are ready.';
      $('start-button').textContent = 'Resume →';
      $('overlay-footnote').textContent = 'Focus loss pauses the game and releases held controls.';
    }
    if (kind === 'won') {
      $('overlay-title').textContent = 'A little more light.';
      $('overlay-copy').textContent =
        `${(run.coverage * 100).toFixed(1)}% captured · ${run.score.toLocaleString()} points · ${timeLabel(run.time)}. ${practice ? 'Practice complete.' : completionWarning || (saveSucceeded ? 'Full picture added to your collection.' : 'Picture collected for this session. Export your library to keep it.')}`;
      $('result-medals').textContent = '★'.repeat(
        run.medal === 'gold' ? 3 : run.medal === 'silver' ? 2 : 1,
      );
      $('next-button').textContent = practice
        ? 'Try it yourself →'
        : campaignContinuation(progress, campaign).complete
          ? 'Campaign complete →'
          : 'Next uncleared mission →';
      $('overlay-footnote').textContent = practice
        ? 'Demonstrations and imported maps do not grant unlocks.'
        : run.medal === 'gold'
          ? 'Gold: fast and no lives lost.'
          : 'Try another class, or return for a clean, faster route.';
    }
    if (kind === 'lost') {
      $('overlay-title').textContent = 'A new line awaits.';
      $('overlay-copy').textContent =
        `${run.failureCause === 'mission-timeout' ? 'The mission clock ran out. ' : run.failureCause === 'cut-timeout' ? 'Your live line stayed open too long. ' : run.failureCause === 'cable-limit' ? 'Your cable budget ran out. ' : ''}You revealed ${(run.coverage * 100).toFixed(1)}%. Watch the danger, choose your cut and try again.`;
      $('retry-button').textContent = 'Try again ↻';
      $('overlay-footnote').textContent =
        'Retries start immediately. Previous campaign progress is kept.';
    }
    refreshSavedFlight();
    refreshMastery();
  }
  function prepare({ restoreAdoption = false } = {}) {
    if (!restoreAdoption) cancelRestore();
    completionWarning = '';
    appearanceRewardIds = [];
    celebrationActive = false;
    sound.reset?.();
    painter.skipCelebration?.();
    show('skip-celebration', false);
    clearInput();
    run = createRun(scenario?.level || campaign.levels[levelIndex], {
      seed,
      turnPolicy,
      classId,
      classRecipes: scenario?.classRecipes || classRegistry,
    });
    runId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const explicitPractice = [MASTERY_SCENARIO_VERSION, ENCOUNTER_SCENARIO_VERSION].includes(
      scenario?.format,
    );
    const observedCampaign = explicitPractice
      ? scenario.masteryDefinition
        ? scenarioMasteryCampaign(scenario, run.classRecipes)
        : null
      : scenario
        ? catalog()
            .map((entry) => entry.campaign)
            .find((entry) => {
              if (!masteryFor(campaignKey(entry), run.levelId, masteryCatalog)) return false;
              const map = entry.levels.find((level) => level.id === run.levelId);
              return (
                map &&
                canonicalJSON(normalizedLevel(map)) === canonicalJSON(run.level) &&
                canonicalJSON(entry.classRecipes) === canonicalJSON(run.classRecipes)
              );
            })
        : campaign;
    masteryDefinition = explicitPractice
      ? scenario.masteryDefinition
      : observedCampaign
        ? masteryFor(campaignKey(observedCampaign), run.levelId, masteryCatalog)
        : null;
    masteryObserver = null;
    masteryAward = null;
    $('mastery-announcement').textContent = '';
    if (masteryDefinition)
      try {
        masteryObserver = createMasteryObserver({
          definition: masteryDefinition,
          setup: captureMasterySetup(run, {
            campaignId: observedCampaign.id,
            campaignKey: campaignKey(observedCampaign),
            runId,
            definition: masteryDefinition,
          }),
          initial: captureMasteryFacts(run, { runId, definition: masteryDefinition }),
        });
      } catch {
        masteryAward = {
          status: 'unavailable',
          message:
            'The optional goal is unavailable for this configuration. You can still reveal the picture.',
        };
      }
    const authoredLevel = scenario?.level || campaign.levels[levelIndex];
    if (!scenario && !themeOverride) {
      theme =
        themesFile.themes.find((t) => t.id === (authoredLevel.themeId || campaign.themeId)) ||
        themesFile.themes[0];
      bodyId = theme.player;
      $('theme-select').value = theme.id;
    }
    if (!scenario && !musicOverride) {
      const track = activeEntry.music?.find(
        (m) => m.id === (authoredLevel.musicId || campaign.musicId),
      );
      if (track) {
        sound.setTrack(track);
        $('music-select').value = track.genre;
      }
    }
    if (scenario?.music) sound.setTrack(scenario.music);
    painter.setLevel?.(run.level, { seed });
    setTheme();
    started = false;
    paused = true;
    handled = false;
    recordingStopped = false;
    recorder = createRecorder(
      run.level,
      { seed, turnPolicy, classId, classRecipes: scenario?.classRecipes || classRegistry },
      buildVersion,
    );
    $('export-replay').disabled = false;
    captionUntil = 0;
    $('mode-caption').textContent = practice
      ? 'PLAYGROUND / PRACTICE'
      : `${campaign.title || campaign.name || campaign.id} · ${String(levelIndex + 1).padStart(2, '0')} / ${campaign.levels.length}`;
    $('campaign-name').textContent = `CAMPAIGN / ${campaign.title || campaign.name || campaign.id}`;
    updateLoadout();
    refreshMissionBrief();
    paintMissions();
    overlay(campaignOverview && !practice ? 'campaign-complete' : 'ready');
    warning(
      practice
        ? 'Practice uses the same simulation; campaign awards are disabled.'
        : campaignOverview
          ? 'Campaign complete. View your collection or choose a mission to replay.'
          : currentBriefing().status,
    );
    refreshHUD();
  }
  function resume() {
    cancelRestore();
    if (!run || (campaignOverview && !practice) || ['won', 'lost'].includes(run.status)) return;
    clearInput();
    started = true;
    paused = false;
    (library.preferences.musicEnabled ? sound.enable?.() : sound.disable())?.catch?.(() => {});
    show('game-overlay', false);
    show('continue-saved-note', false);
    $('game-canvas').focus({ preventScroll: true });
    $('pause-button').textContent = 'Ⅱ';
  }
  function pause(force) {
    if (celebrationActive) {
      sound.pause?.();
      return;
    }
    if (!started || ['won', 'lost'].includes(run?.status)) return;
    if (force !== true && paused) {
      resume();
      return;
    }
    clearInput();
    paused = true;
    sound.pause?.();
    if (!practice && recorder && !sessionBusy) {
      try {
        persistAttempt(false);
      } catch {}
    }
    overlay('pause');
    $('pause-button').textContent = '▶';
  }
  function refreshHUD() {
    $('coverage').innerHTML = `${(run.coverage * 100).toFixed(1)}<small>%</small>`;
    $('coverage-bar').style.width = `${run.coverage * 100}%`;
    $('goal-marker').style.left = `${run.level.goal.coverage * 100}%`;
    $('target').textContent = `TARGET ${Math.round(run.level.goal.coverage * 100)}%`;
    $('lives').textContent = '◆ '.repeat(run.lives).trim() || '—';
    $('lives').setAttribute('aria-label', `${run.lives} lives`);
    $('time').textContent = timeLabel(run.time);
    $('score').textContent = String(run.score).padStart(5, '0');
    const required = run.objectives.filter((o) => o.required),
      done = required.filter((o) => o.captured);
    $('objective-state').textContent = required.length
      ? `${theme.labels.objective}: ${done.length} / ${required.length}`
      : 'Close a line to reveal the picture';
    $('flight-state').textContent = campaignOverview
      ? 'Campaign complete'
      : run.status === 'won'
        ? 'Mission complete'
        : run.status === 'lost'
          ? 'Flight ended'
          : run.status === 'respawning'
            ? 'Recovering…'
            : !started
              ? 'Ready for launch'
              : paused
                ? 'Paused'
                : run.player.cutting
                  ? 'LIVE LINE / EXPOSED'
                  : 'Safe ground';
    $('status-dot').style.background = run.player.cutting ? 'var(--danger)' : 'var(--safe)';
    const left = Math.max(0, run.ability.cooldownUntil - run.time);
    $('ability-state').textContent =
      `${left > 0 ? left.toFixed(1) + 's cooldown' : run.ability.capacity && run.ability.ammo === 0 ? 'Empty — refill at supply' : 'Ready'}${run.ability.capacity ? ' · ' + run.ability.ammo + '/' + run.ability.capacity + ' charges' : ''}`;
    $('hangar-button').disabled = campaignOverview || ['won', 'lost'].includes(run.status);
    $('restart-button').disabled = campaignOverview;
    $('pause-button').disabled = campaignOverview;
    $('save-attempt-button').disabled =
      !started || practice || ['won', 'lost'].includes(run.status);
    const near = run.hangars?.some(
      (h) => Math.hypot(h.x - run.player.x, h.y - run.player.y) <= h.radius,
    );
    $('hangar-state').textContent = run.signal?.zoneIds?.length
      ? run.signal.resistant
        ? 'Fiber link · signal zone bypassed; line remains vulnerable.'
        : 'Signal interference · slower movement or disabled equipment.'
      : `${run.classRecipe.label}${near && !run.player.cutting ? ' · Hangar in range' : ' · Return to a hangar to change craft'}`;
    if (run.rules.timeLimitSeconds)
      $('time').textContent = timeLabel(Math.max(0, run.rules.timeLimitSeconds - run.time));
    const encounter = encounterView(run);
    show('encounter-status', !!encounter && !campaignOverview);
    if (encounter) {
      $('encounter-title').textContent = encounter.title;
      $('encounter-instruction').textContent = encounter.instruction;
      $('encounter-status').dataset.phase = encounter.phase;
    }
    refreshMastery();
  }
  function eventFeedback(events) {
    for (const event of events) {
      sound.event(event);
      if (event.type === 'class.switched') {
        updateLoadout();
        setTheme();
        warning(`Now flying ${run.classRecipe.label}. Charges and cooldowns are preserved.`);
      }
      if (event.type === 'class.rejected')
        warning(`Cannot switch craft: ${event.reason}. Return to safe hangar ground.`);
      if (event.type === 'cells.claimed')
        warning(
          `Line secured. ${(run.coverage * 100).toFixed(1)}% revealed${event.indices?.length < 50 ? ' — both sides may still contain an enemy.' : '.'}`,
        );
      if (event.type === 'player.failed')
        warning(
          {
            'self-contact': 'Your line crossed itself. Choose a new route.',
            'mission-timeout': 'The mission clock ran out. Try a faster route.',
            'cut-timeout': 'Your live line stayed open too long. Make a shorter cut.',
            'cable-limit': 'Your cable budget ran out. Close a shorter line.',
          }[event.cause] || 'Your line was caught. The territory you revealed is kept.',
        );
      if (event.type === 'shield.absorbed')
        warning('Shield absorbed the hit. Your unfinished line is cancelled; no life lost.');
      if (event.type === 'ability.rejected')
        warning(
          {
            empty: 'No charges left. Return to a supply pad and press Supply.',
            cooldown: 'Ability is recharging. Watch the cooldown beside your controls.',
            'already-full': 'Your supplies are already full.',
            'out-of-range': 'Move onto a supply pad to pick up a charge.',
          }[event.reason] || 'Ability is unavailable right now.',
        );
      if (event.type === 'ability.used')
        warning(
          {
            scan: 'Hidden objectives marked. Short direction hints show where enemies are heading.',
            'stun-field': 'Stun field placed. Nearby moving field enemies are briefly held.',
            'slow-field': 'Slow field placed. Nearby field enemies move at quarter speed.',
            shield: 'Shield active. One enemy contact can cancel your line safely.',
          }[event.primitive] || `${theme.labels.ability} active.`,
        );
      if (event.type === 'pickup.collected')
        warning('Supplies ready. Choose your next opportunity.');
      if (
        event.type === 'encounter.stageChanged' ||
        event.type === 'encounter.phaseChanged' ||
        event.type === 'encounter.defeated'
      ) {
        const cue = encounterView(run);
        if (cue) warning(`${cue.title}. ${cue.instruction}`);
      }
      if (event.type === 'boss.warning')
        warning(`${theme.labels.boss}: the marked lane will activate shortly.`);
    }
    painter.effectsFor(events);
  }
  function update(elapsed) {
    if (document.hidden || !document.hasFocus()) {
      if (!controllerInactive) {
        controllerInactive = true;
        clearInput();
        pause(true);
      }
      return;
    }
    controllerInactive = false;
    const scope = controllerScope();
    controllerFrame = controller.sample({ scope, timeMs: performance.now() });
    const { status, assigned, disconnected } = controllerFrame;
    if (status.message !== controllerStatus) {
      controllerStatus = status.message;
      $('input-status').textContent =
        status.code === 'disconnected' || assigned
          ? status.message
          : `Keyboard / touch · ${status.message}`;
    }
    show('controller-ui-hint', !!assigned);
    if (scope !== controllerPreviousScope) {
      controllerPreviousScope = scope;
      $('controller-ui-hint').textContent =
        scope === 'flight' ? controllerFlightHint() : controllerMenuHint();
      if (assigned && scope !== 'flight') controllerNavigation.engage();
    }
    if (status.code === 'joined' && scope !== 'flight') controllerNavigation.engage();
    if (disconnected) {
      clearInput();
      pause(true);
      warning(
        'Controller disconnected. Your flight is paused. Release controls and press a face button to join again.',
      );
    } else {
      controllerNavigation.handle(controllerFrame.ui);
      if (controllerFrame?.flight.stop) {
        pendingAction = false;
        pendingPickup = false;
        pendingSwitch = null;
      }
      if (controllerFrame?.flight.hangar && !$('hangar-button').disabled) {
        $('hangar-button').click();
        clearInput();
      }
    }
    const controls = input.poll();
    pendingAction = pendingAction || controls.action;
    pendingPickup = pendingPickup || controls.pickup;
    const focus = document.activeElement;
    controllerPreview?.report({
      scope: controllerScope().slice(0, 160),
      focusedId: (focus?.id || '').slice(0, 160),
      focusedLabel: (
        focus?.getAttribute('aria-label') ||
        (focus?.matches('button,a,summary') ? focus.textContent : focus?.id) ||
        ''
      )
        .trim()
        .slice(0, 160),
      assigned: !!assigned,
      message: status.message.slice(0, 240),
    });
    if (!paused && started && !dialogOpen() && !['won', 'lost'].includes(run.status)) {
      if (elapsed > 0.25) {
        pause(true);
        warning('Paused after a long frame interruption. Resume to continue safely.');
        return;
      }
      accumulator += elapsed;
      while (accumulator + 1e-9 >= FIXED_DT && !['won', 'lost'].includes(run.status)) {
        const command = demo
          ? { direction: 'down', boost: false, action: false, pickup: false }
          : {
              direction: controls.direction,
              boost: controls.boost,
              action: pendingAction || controls.action,
              pickup: pendingPickup || controls.pickup,
              switchClass: pendingSwitch,
            };
        if (!recordingStopped && recorder.ticks >= MAX_REPLAY_TICKS) {
          recordingStopped = true;
          recorder = null;
          $('export-replay').disabled = true;
          warning(
            'The 30-minute replay budget is full. Recording was discarded; you can keep playing.',
          );
        }
        stepRun(run, command, FIXED_DT);
        if (masteryObserver)
          try {
            masteryObserver.observe(
              captureMasteryFacts(run, { runId, definition: masteryDefinition }),
            );
          } catch {
            masteryObserver = null;
            masteryAward = {
              status: 'unavailable',
              message: 'Live goal tracking is unavailable. Your picture progress is kept.',
            };
          }
        pendingAction = false;
        pendingPickup = false;
        pendingSwitch = null;
        accumulator -= FIXED_DT;
        if (!recordingStopped)
          try {
            recordInput(recorder, command);
          } catch {
            recordingStopped = true;
            recorder = null;
            $('export-replay').disabled = true;
            warning(
              'Replay recording stopped. You can keep playing; start a new attempt to record again.',
            );
          }
        eventFeedback(run.events);
      }
      if (!handled && ['won', 'lost'].includes(run.status)) {
        handled = true;
        paused = true;
        clearInput();
        if (run.status === 'won' && !practice) {
          const previousProgress = progress;
          try {
            library = recordLibraryCompletion(library, {
              campaign,
              result: getSummary(run),
              runId,
              themeId: theme.id,
              bodyId,
              sourcePackId: activeEntry.sourcePackId,
            });
          } catch (error) {
            completionWarning =
              'Your picture is open, but the collection could not be updated. Export this replay and your library before continuing.';
            $('save-warning').textContent = `${completionWarning} ${error.message}`;
            show('save-warning', true);
          }
          progress = progressFor(library, campaign);
          appearanceRewardIds = newAppearanceBodies(previousProgress, progress, campaign);
          persistProfile();
          updateBodies();
          paintMissions();
          if (masteryDefinition && recorder && !completionWarning)
            try {
              void masteryAwards.submit(
                {
                  replay: exportReplay(recorder, run),
                  campaign,
                  definition: masteryDefinition,
                  runId,
                  earnedAt: new Date().toISOString(),
                },
                { eligible: !practice },
              );
            } catch (error) {
              masteryAward = {
                status: 'unavailable',
                message: `Your picture is collected; the seal could not be checked. ${error.message}`,
              };
            }
          try {
            const old = JSON.parse(localStorage.getItem(sessionKey));
            if (!completionWarning && saveSucceeded && old?.runId === runId) {
              assertWriter();
              localStorage.removeItem(sessionKey);
            }
          } catch {}
        }
        if (run.status === 'won') {
          painter.startCelebration?.({
            levelId: run.levelId,
            seed,
            reduced: $('reduced-effects').checked,
          });
          celebrationActive = true;
          show('game-overlay', false);
          show('skip-celebration', true);
          show('show-result', false);
          warning('Picture unlocked. A whole world, from one brave line.');
        } else overlay('lost');
      }
    } else {
      pendingAction = false;
      pendingPickup = false;
    }
    if (celebrationActive && !painter.celebrationStatus?.active) {
      celebrationActive = false;
      show('skip-celebration', false);
      overlay('won');
    }
    sound.update(!paused && started, theme, run);
    if (!sound.previewActive && $('music-preview').textContent.startsWith('Playing'))
      $('music-preview').textContent = 'Preview music ♫';
    $('sound-button').setAttribute('aria-pressed', String(sound.enabled));
    $('sound-button').setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Enable sound');
    refreshHUD();
  }
  for (const t of themesFile.themes) $('theme-select').append(new Option(t.name, t.id));
  if (scenario && !themesFile.themes.some((t) => t.id === theme.id))
    $('theme-select').append(new Option(theme.name, theme.id));
  $('theme-select').value = theme.id;
  for (const c of scenario?.classRecipes || classRegistry)
    $('class-select').append(new Option(c.label, c.id));
  $('theme-select').onchange = () => {
    cancelRestore();
    themeOverride = true;
    theme =
      themesFile.themes.find((t) => t.id === $('theme-select').value) ||
      (scenario?.theme?.id === $('theme-select').value ? scenario.theme : themesFile.themes[0]);
    bodyId = theme.player;
    setTheme();
    refreshMissionBrief();
    if (!started && !campaignOverview) overlay('ready');
    preferences({ themeId: theme.id, bodyId });
  };
  $('body-select').onchange = () => {
    cancelRestore();
    bodyWarning = '';
    bodyId = $('body-select').value;
    painter.setLook(theme, bodyId, visuals());
    preferences({ bodyId, matchClassAppearance: false });
    $('match-class-appearance').checked = false;
  };
  $('class-select').onchange = () => {
    classId = $('class-select').value;
    demo = false;
    preferences({ classId });
    prepare();
  };
  $('turn-select').onchange = () => {
    turnPolicy = $('turn-select').value;
    demo = false;
    preferences({ turnPolicy });
    prepare();
  };
  $('start-button').onclick = () => resume();
  $('continue-saved').onclick = async () => {
    try {
      await restoreAttempt(savedAttempt());
      $('start-button').focus({ preventScroll: true });
    } catch (error) {
      warning(`Saved flight was not loaded: ${error.message}`);
      // A new selection may have cancelled verification. Preserve its focus;
      // only recover focus lost when the loading button was disabled.
      if (!$('continue-saved').hidden && document.activeElement === document.body)
        $('continue-saved').focus({ preventScroll: true });
    }
  };
  $('choose-mission').onclick = () => {
    const mission = $('missions').querySelector('button:not(:disabled)');
    mission?.focus();
    mission?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  };
  $('pause-button').onclick = () => pause();
  $('restart-button').onclick = () => {
    if (campaignOverview) return;
    demo = false;
    prepare();
    resume();
  };
  $('retry-button').onclick = () => {
    demo = false;
    prepare();
    resume();
  };
  $('view-picture').onclick = () => {
    if (run.status !== 'won') return;
    show('game-overlay', false);
    show('show-result', true);
    $('show-result').focus({ preventScroll: true });
  };
  $('show-result').onclick = () => {
    if (run.status === 'won') {
      overlay('won');
      $('view-picture').focus({ preventScroll: true });
    }
  };
  $('next-button').onclick = () => {
    if (campaignOverview && !practice) {
      $('collection-button').click();
      return;
    }
    if (practice) {
      if (demo) {
        leavePractice();
        levelIndex = 0;
      }
    } else {
      const selection = campaignSelection(progress, campaign);
      campaignOverview = selection.overview;
      if (campaignOverview) {
        clearInput();
        sound.pause();
        paintMissions();
        overlay('campaign-complete');
        refreshHUD();
        $('next-button').focus({ preventScroll: true });
        return;
      }
      levelIndex = selection.levelIndex;
    }
    prepare();
  };
  $('demo-button').onclick = () => {
    leavePractice();
    levelIndex = 0;
    practice = true;
    demo = true;
    prepare();
    resume();
    warning('Demonstration: this is a real simulated cut. It grants no rewards.');
  };
  $('sound-button').onclick = async () => {
    try {
      const on = await sound.toggle();
      $('sound-button').setAttribute('aria-pressed', String(on));
      $('sound-button').setAttribute('aria-label', on ? 'Mute sound' : 'Enable sound');
      preferences({ musicEnabled: on });
    } catch {
      warning('Audio could not start in this browser.');
    }
  };
  $('tap-steering').onchange = () => {
    clearInput();
    preferences({ tapSteering: $('tap-steering').checked });
  };
  $('help-button').onclick = () => {
    pause(true);
    $('help-dialog').showModal();
  };
  $('collection-button').onclick = () => {
    pause(true);
    $('achievement-campaign').textContent =
      `Campaign achievements · ${campaign.title || campaign.name || campaign.id}`;
    $('achievements').replaceChildren();
    for (const a of achievements(progress, campaign)) {
      const row = document.createElement('div');
      row.className = `achievement${a.earned ? ' earned' : ''}`;
      const title = document.createElement('strong');
      title.textContent = `${a.earned ? '◆' : '◇'} ${a.name}`;
      const copy = document.createElement('span');
      copy.textContent = a.description;
      row.append(title, copy);
      $('achievements').append(row);
    }
    paintAppearanceRewards();
    libraryPanel.populateGallery();
    $('collection-dialog').showModal();
  };
  $('choose-appearance').onclick = focusAppearance;
  $('collection-choose-appearance').onclick = focusAppearance;
  document
    .querySelectorAll('[data-close]')
    .forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
  $('export-replay').onclick = async () => {
    try {
      if (!recorder) throw new Error('Start a new attempt to record a replay.');
      pause(true);
      lastReplay = exportReplay(recorder, run);
      $('replay-json').value = JSON.stringify(lastReplay, null, 2);
      $('replay-dialog').showModal();
      const exported = await downloadJSON(lastReplay, `revealline-${run.levelId}-replay.json`);
      warning(`Replay prepared with its exact rules, inputs and final state. ${exported.message}`);
    } catch (error) {
      warning(`Replay could not export: ${error.message}`);
    }
  };
  $('download-replay').onclick = async () => {
    try {
      if (lastReplay)
        warning(
          (await downloadJSON(lastReplay, `revealline-${lastReplay.summary.levelId}-replay.json`))
            .message,
        );
    } catch (error) {
      warning(`Replay download: ${error.message}`);
    }
  };
  function suspendInteraction() {
    // Menu and result screens also need a neutral gate. Their pause() path
    // deliberately returns early, and a hidden renderer may not tick at all.
    controllerInactive = true;
    clearInput();
    controllerPreview?.clear();
    sound.pause();
    pause(true);
  }
  onNativeInactive(suspendInteraction).catch((error) =>
    warning(`App lifecycle adapter unavailable: ${error.message}`),
  );
  window.addEventListener('blur', suspendInteraction);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendInteraction();
  });
  setTheme();
  refreshCampaigns();
  prepare();
  refreshKeyPrompts();
  refreshControllerPrompts();
  class FieldScene extends Phaser.Scene {
    create() {
      this.boardTexture = this.textures.createCanvas('field', 768, 576);
      this.boardImage = this.add.image(0, 0, 'field').setOrigin(0);
      this.game.canvas.setAttribute('aria-hidden', 'true');
    }
    update(now, delta) {
      const dt = clamp(delta / 1000, 0, 1);
      update(dt);
      painter.draw(this.boardTexture.context, run, Math.min(dt, 0.1), {
        paused,
        reduced: $('reduced-effects').checked,
        fullReveal: run.status === 'won',
        showGrid: scenario?.presentation?.showGrid || library.preferences.showGrid,
        celebrationPaused: document.hidden || dialogOpen(),
      });
    }
  }
  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-canvas',
    width: 768,
    height: 576,
    backgroundColor: theme.palette.field,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    fps: { target: 60, forceSetTimeOut: false },
    scene: FieldScene,
    banner: false,
  });
} catch (error) {
  $('overlay-title').textContent = 'The game could not load.';
  $('overlay-copy').textContent = error.message;
  show('start-button', false);
  $('run-message').textContent =
    new URLSearchParams(location.search).get('practice') === '1'
      ? 'Open the Playground and choose Play configuration, or use REVEAL / LINE to return to campaign.'
      : 'Serve the project through HTTP and check the content files. Your saved progress is unchanged.';
  console.error(error);
} finally {
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  $('boot-status').hidden = true;
}
