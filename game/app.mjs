import { createRun, stepRun, getSummary, releaseInputs, CLASSES, FIXED_DT } from './core/index.mjs';
import { BoardPainter } from './ui/render.mjs';
import { attachInput } from './ui/input.mjs';
import { attachKeySettings } from './ui/key-settings.mjs';
import { actionForKey, bindingLabels, keyLabel, resolveKeyBindings } from './key-bindings.mjs';
import { Soundscape, DEFAULT_TRACKS } from './ui/audio.mjs';
import { attachLibraryPanel } from './ui/library-panel.mjs';
import {
  emptyLibrary,
  loadLibrary,
  saveLibrary,
  progressFor,
  recordLibraryCompletion,
  campaignKey,
  updatePreferences,
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
import { claimProfileWriter } from './profile-writer.mjs';
import { commitBackup, recoverBackupImport } from './backup-storage.mjs';
import { offlineAvailability, prepareOffline, checkOffline } from './offline.mjs';
import {
  emptyProgress,
  loadProgress,
  saveProgress,
  awardCompletion,
  achievements,
  unlockedBodies,
  canPlay,
} from './progress.mjs';
import { downloadJSON, recommendedBody } from './content.mjs';
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
  let buildVersion = '0.2.1',
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
  window.addEventListener('pagehide', () => writer.release(), { once: true });
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
    return { packs: prepared, profile };
  }
  try {
    const snapshot = navigator.locks?.request
      ? await navigator.locks.request(`${libraryKey}.backup-lock`, readSavedState)
      : await readSavedState();
    packs = snapshot.packs;
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
  let levelIndex = 0,
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
    practice = !!scenario,
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
    celebrationActive = false,
    sessionBusy = false,
    restoreController = null,
    themeOverride = false,
    musicOverride = false;
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
    if (!started)
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
  window.addEventListener('pagehide', () => keySettings.destroy(), { once: true });
  function clearInput() {
    pendingAction = false;
    pendingPickup = false;
    pendingSwitch = null;
    input.clear();
    if (run) {
      releaseInputs(run);
      if (recorder && !recordingStopped) recordRelease(recorder);
    }
    accumulator = 0;
  }
  function catalog() {
    const entries = [
      baseEntry,
      ...packs.packs.flatMap((p) => p.campaigns.map((c) => resolvePackCampaign(p, c.id))),
    ];
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
    practice = false;
    demo = false;
    activeEntry = entry;
    campaign = entry.campaign;
    classRegistry = entry.classRecipes;
    campaign.classRecipes = classRegistry;
    themesFile.themes = entry.themes;
    levelIndex = Math.max(
      0,
      campaign.levels.findIndex((l) => l.id === levelId),
    );
    progress = progressFor(library, campaign);
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
    pause(true);
    const controller = new AbortController();
    restoreController = controller;
    try {
      const restored = await restoreSession(candidate, {
        campaign: entry.campaign,
        campaignKey: campaignKey(entry.campaign),
        signal: controller.signal,
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
    clearInput();
    refreshKeyPrompts();
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
    setLibrary: (next) => {
      library = next;
      progress = progressFor(library, campaign);
      const saved = persistProfile({ mode: 'replace' });
      adoptPreferences();
      return saved;
    },
    applyBackup: async (prepared) => {
      if (!writer.writable) throw new Error(writer.reason);
      if (!persistenceReady) {
        const recovered = await recoverBackupImport(backupAdapters());
        if (!recovered.ok) throw new Error(recovered.warning);
      } else assertWriter();
      pause(true);
      cancelRestore();
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
      packs = prepared.packs;
      selectEntry(baseEntry);
      adoptPreferences();
      refreshCampaigns();
      return result;
    },
    setPacks: async (next) => {
      assertWriter();
      try {
        await writeAssetStore(packsKey, exportPackLibrary(next));
      } catch (e) {
        throw new Error(`Pack storage failed; previous installed packs are kept. ${e.message}`);
      }
      packs = next;
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
      !e.target.closest('input,textarea,select,button,a') &&
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
    $('settings-dialog').showModal();
  };
  let offlinePrepared = false;
  const offline = offlineAvailability();
  show('offline-button', offline.available);
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
  $('settings-dialog').addEventListener('close', () => sound.pause());
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
        (practice || unlockedBodies(progress).has(candidate))
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
    const allowed = unlockedBodies(progress);
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
  }
  function leavePractice() {
    scenario = null;
    practice = false;
    demo = false;
    theme = themesFile.themes.find((t) => t.id === theme.id) || themesFile.themes[0];
    if (!classRegistry.some((c) => c.id === classId)) classId = classRegistry[0].id;
    bodyId = unlockedBodies(progress).has(bodyId) ? bodyId : theme.player;
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
      b.className = `mission${index === levelIndex && !practice ? ' selected' : ''}`;
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
  function missionBrief() {
    const level = scenario?.level || campaign.levels[levelIndex],
      rules = level.rules || {};
    const notes = [
      campaign.briefs?.[levelIndex] ||
        level.metadata?.description ||
        `Reveal ${Math.round(level.goal.coverage * 100)}% and capture every marked ${theme.labels.objective.toLowerCase()}. Return to safe ground to secure each line.`,
    ];
    if (rules.timeLimitSeconds) notes.push(`Mission deadline: ${rules.timeLimitSeconds}s.`);
    if (rules.cutTimeLimitSeconds)
      notes.push(`Close each live line within ${rules.cutTimeLimitSeconds}s.`);
    if (rules.maxTrailCells) notes.push(`Cable budget: ${rules.maxTrailCells} cells per cut.`);
    if (level.signalZones?.length)
      notes.push(
        'Signal zones affect ordinary craft. Fiber bypasses interference; carrier fields can suppress emitters.',
      );
    return notes.join(' ');
  }
  function overlay(kind) {
    show('game-overlay', true);
    show('show-result', false);
    show('view-picture', kind === 'won');
    show('next-button', kind === 'won');
    show('retry-button', kind === 'won' || kind === 'lost');
    show('start-button', kind === 'ready' || kind === 'pause');
    show('result-medals', kind === 'won');
    $('overlay-eyebrow').textContent = practice
      ? 'PRACTICE / NO CAMPAIGN REWARDS'
      : `MISSION ${String(levelIndex + 1).padStart(2, '0')} / ${run.level.name.toUpperCase()}`;
    if (kind === 'ready') {
      $('overlay-title').innerHTML =
        levelIndex === 0 && !practice
          ? 'Clear a path.<br>Reveal a world.'
          : escapeHTML(run.level.name);
      $('overlay-copy').textContent = practice
        ? 'Test this authored configuration in the real game engine. Practice does not change your campaign collection.'
        : missionBrief();
      $('start-button').textContent = 'Start mission ↗';
      refreshKeyPrompts();
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
        : levelIndex === campaign.levels.length - 1
          ? 'Back to first signal →'
          : 'Next mission →';
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
  }
  function escapeHTML(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  }
  function prepare({ restoreAdoption = false } = {}) {
    if (!restoreAdoption) cancelRestore();
    completionWarning = '';
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
    paintMissions();
    overlay('ready');
    warning(
      practice
        ? 'Practice uses the same simulation; campaign awards are disabled.'
        : missionBrief(),
    );
    refreshHUD();
  }
  function resume() {
    cancelRestore();
    if (!run || ['won', 'lost'].includes(run.status)) return;
    clearInput();
    started = true;
    paused = false;
    (library.preferences.musicEnabled ? sound.enable?.() : sound.disable())?.catch?.(() => {});
    show('game-overlay', false);
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
    $('flight-state').textContent =
      run.status === 'won'
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
    $('hangar-button').disabled = ['won', 'lost'].includes(run.status);
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
      if (event.type === 'boss.warning')
        warning(`${theme.labels.boss}: the marked lane will activate shortly.`);
    }
    painter.effectsFor(events);
  }
  function update(elapsed) {
    const controls = input.poll();
    pendingAction = pendingAction || controls.action;
    pendingPickup = pendingPickup || controls.pickup;
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
          persistProfile();
          updateBodies();
          paintMissions();
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
  $('pause-button').onclick = () => pause();
  $('restart-button').onclick = () => {
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
    if (practice) {
      if (demo) {
        leavePractice();
        levelIndex = 0;
      }
    } else levelIndex = (levelIndex + 1) % campaign.levels.length;
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
    $('collection-note').textContent =
      'First clear unlocks Skyline FPV, Fixed-wing, Falcon, Vector and Auditor appearances. Four clears unlock Night signal FPV and Delta interceptor. Cosmetics do not change abilities.';
    libraryPanel.populateGallery();
    $('collection-dialog').showModal();
  };
  document
    .querySelectorAll('[data-close]')
    .forEach((b) => (b.onclick = () => $(b.dataset.close).close()));
  $('export-replay').onclick = () => {
    try {
      if (!recorder) throw new Error('Start a new attempt to record a replay.');
      pause(true);
      lastReplay = exportReplay(recorder, run);
      $('replay-json').value = JSON.stringify(lastReplay, null, 2);
      downloadJSON(lastReplay, `revealline-${run.levelId}-replay.json`);
      $('replay-dialog').showModal();
      warning('Replay exported with its exact rules, inputs and final state.');
    } catch (error) {
      warning(`Replay could not export: ${error.message}`);
    }
  };
  $('download-replay').onclick = () => {
    if (lastReplay)
      downloadJSON(lastReplay, `revealline-${lastReplay.summary.levelId}-replay.json`);
  };
  window.addEventListener('blur', () => {
    sound.pause();
    pause(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sound.pause();
      pause(true);
    }
  });
  setTheme();
  refreshCampaigns();
  prepare();
  refreshKeyPrompts();
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
