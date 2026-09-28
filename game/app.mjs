import { contentText } from './i18n/content.mjs';
import { onLocaleChange, formatNumber, localizedText, t, localizedAttribute, localizedOption } from './i18n/index.mjs';
import { createCharacterPresentations } from './character-presentations.mjs';
import { loadExternalCatalog, prepareExternalDownload } from './external-chapter-catalog.mjs';
import { createExternalChapterHost } from './external-chapter-host.mjs';
import { createExternalChapterBackup } from './external-chapter-backup.mjs';
import {
  SOURCE_EXTERNAL_CHAPTER,
  SOURCE_EXTERNAL_CHAPTERS,
  SOURCE_EXTERNAL_EDITIONS,
  sourceExternalChapter,
  prepareSourceExternalChapter,
} from './external-chapter-source.mjs';
import { validateMediaLibrary } from './media-library.mjs';
import { createPresentationPins } from './presentation-pins.mjs';
import { createFlightPresentationPins } from './flight-media-pins.mjs';
import {
  loadOptionalCatalog,
  prepareOptionalDownload,
  verifyOptionalInstalled,
} from './optional-chapters.mjs';
import { attachOptionalChaptersPanel } from './ui/optional-chapters-panel.mjs';
import { arcadeActionCapabilities } from './core/arcade-actions.mjs';
import { nextInputModality, showScreenControls } from './input-presentation.mjs';
import { onNativeInactive, nativePlatform } from './platform.mjs';
import { createRun, stepRun, getSummary, CLASSES, FIXED_DT } from './core/index.mjs';
import { BoardPainter, boardPaintSizeForRun, boardPaintSizeForLevel } from './ui/render.mjs';
import { encounterView } from './ui/encounter-view.mjs';
import { classicView } from './ui/classic-view.mjs';
import { retryExplanation } from './ui/retry-view.mjs';
import {
  FIRST_FLIGHT_LESSONS,
  getFirstFlightLesson,
  resolveCourseRequest,
  createLessonScenario,
  captureLessonFacts,
  createLessonObserver,
} from './first-flight.mjs';
import { attachFirstFlightView } from './ui/first-flight-view.mjs';
import { retainFlightForFirstFlight } from './ui/first-flight-entry.mjs';
import { revealFirstFlightBoard } from './ui/first-flight-launch.mjs';
import { attachInput } from './ui/input.mjs';
import { resolveTouchControls } from './touch-controls.mjs';
import { attachFullscreen } from './ui/fullscreen.mjs';
import { attachGameShell } from './ui/game-shell.mjs';
import { attachDemoHost } from './ui/demo-host.mjs';
import { createDemoLibrary } from './demo-library.mjs';
import { loadDemoSources } from './demo-sources.mjs';
import { demoIdentity } from './demo-catalog.mjs';
import { attachMissionPicker } from './ui/mission-picker.mjs';
import { fetchBundledChapter } from './chapter-download.mjs';
import { attachModalNavigation } from './ui/modal-navigation.mjs';
import { createControllerRouter } from './ui/controller-router.mjs';
import {
  cancelControllerToggleBoost,
  controllerBoostAfterRecovery,
} from './ui/controller-boost-host.mjs';
import {
  attachControllerBoostSettings,
  renderControllerBoostCue,
} from './ui/controller-boost-settings.mjs';
import { attachControllerNavigation } from './ui/controller-navigation.mjs';
import { attachControllerReading } from './ui/controller-reading.mjs';
import { attachControllerPreview } from './ui/controller-preview.mjs';
import { attachPracticeNavigation } from './ui/practice-navigation.mjs';
import { attachEnemyWorkshopReturn } from './ui/enemy-workshop-return.mjs';
import { attachEnemyGuide } from './ui/enemy-guide.mjs';
import { attachControllerSettings } from './ui/controller-settings.mjs';
import { controllerBindingLabels, controllerStickLabel } from './controller-bindings.mjs';
import { attachKeySettings } from './ui/key-settings.mjs';
import { actionForKey, bindingLabels, keyLabel, resolveKeyBindings } from './key-bindings.mjs';
import { Soundscape, DEFAULT_TRACKS } from './ui/audio.mjs';
import { createSoundtrackStore } from './soundtrack-store.mjs';
import { createManagedMediaStore } from './managed-media-store.mjs';
import { createStillMediaStore } from './media-store.mjs';
import { createStoryMediaStore } from './story-media-store.mjs';
import { storyPinForTheme, validateFlightPresentationPinsForRun } from './flight-media-pins.mjs';
import { createStoryDialog } from './ui/story-dialog.mjs';
import { createFlightPictures } from './ui/flight-pictures.mjs';
import {
  createPictureIdentityCatalog,
  createBackupPictureIdentityResolver,
} from './ui/picture-identity.mjs';
import { createSoundtrackPlayer } from './ui/soundtrack-player.mjs';
import { attachSoundtrackPanel } from './ui/soundtrack-panel.mjs';
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
  withCinematicVolume,
  DEFAULT_CINEMATIC_VOLUME,
} from './library.mjs';
import {
  emptyPackLibrary,
  importPackLibrary,
  exportPackLibrary,
  preparePack,
  installPack,
  resolvePackCampaign,
} from './packs.mjs';
import {
  canAutoStartPackLaunch,
  canReconcilePackCommit,
  createPackCommitCoordinator,
  createPackLaunchGuard,
  preparePackCatalog,
  resolvePackLaunch,
} from './content-launch.mjs';
import { readAssetStore, writeAssetStore } from './storage.mjs';
import { suspendSession, restoreSession, saveSession } from './sessions.mjs';
import { createAttemptFilePreparer } from './attempt-file.mjs';
import { challengeCampaign } from './challenges.mjs';
import { savedFlightPreview } from './continuation.mjs';
import { createSelectionBookmark, resolveSelectionBookmark } from './selection-bookmark.mjs';
import { createExecutionCatalog } from './campaign-contexts.mjs';
import { resolveCampaignDifficulty } from './campaign-difficulty.mjs';
import {
  createDifficultyNavigation,
  difficultyCue,
  difficultyLabel,
  difficultyRuleComparison,
} from './difficulty-navigation.mjs';
import { missionBriefing } from './mission-brief.mjs';
import { claimProfileWriter } from './profile-writer.mjs';
import { commitBackup, recoverBackupImport } from './backup-storage.mjs';
import { offlineAvailability, prepareOffline, checkOffline } from './offline.mjs';
import { attachStorageRetention } from './ui/storage-retention.mjs';
import { emptyProgress, loadProgress, saveProgress, awardCompletion } from './progress.mjs';
import {
  downloadJSON,
  MASTERY_SCENARIO_VERSION,
  ENCOUNTER_SCENARIO_VERSION,
  scenarioMasteryCampaign,
} from './content.mjs';
import { prepareScenario } from './imports.mjs';
import { createRecorder, recordInput, exportReplay, MAX_REPLAY_TICKS } from './replay.mjs';

const $ = (id) => document.getElementById(id),
  show = (id, on) => ($(id).hidden = !on);
const getJSON = async (path) => {
  const r = await fetch(path);
  if (!r.ok) throw new Error(t("gameplay:couldNotLoad", { value1: path }));
  return r.json();
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const timeLabel = (time) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;

try {
  let attemptFiles = null;
  const [baseCampaign, themesFile, presets, baseClasses, packCatalogSource, archiveCatalogSource] =
    await Promise.all([
      getJSON('content/campaign.json'),
      getJSON('content/themes.json'),
      getJSON('../authoring/motion-lab/presets.json'),
      getJSON('content/classes.json'),
      getJSON('content/packs/catalog.json'),
      getJSON('content/packs/archive-catalog.json'),
    ]);
  const characterPresentations = createCharacterPresentations(presets);
  const packCatalog = preparePackCatalog({
    ...packCatalogSource,
    packs: [
      ...preparePackCatalog(packCatalogSource).packs,
      ...preparePackCatalog(archiveCatalogSource).packs,
    ],
  });
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
  let chapterSnapshot = null;
  let installedEntries = [baseEntry],
    executionCatalog = createExecutionCatalog(installedEntries),
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
    return {
      packs: nextPacks,
      entries,
      executions: createExecutionCatalog(entries),
      registrations,
    };
  }
  function adoptContentCatalog(content) {
    attemptFiles?.invalidate();
    packs = content.packs;
    chapterSnapshot = content.chapterSnapshot ?? null;
    installedEntries = content.entries;
    executionCatalog = content.executions;
    masteryCatalog = content.registrations;
  }
  let buildVersion = document.documentElement.dataset.buildVersion;
  if (!buildVersion || buildVersion === '__REVEALLINE_VERSION__') buildVersion = 'dev';
  let isRelease = false;
  try {
    buildVersion = (await getJSON('build-info.json')).version;
    isRelease = true;
  } catch {}
  if (isRelease) document.querySelectorAll('[data-source-only]').forEach((a) => (a.hidden = true));
  const versionLabel =
    buildVersion === 'dev' ? t("interface:dev") : `${/^\d/.test(buildVersion) ? 'v' : ''}${buildVersion}`;
  localizedText($('version'), () =>versionLabel);
  localizedText($('landing-version'), () =>t("gameplay:version", { value1: versionLabel }));
  const params = new URLSearchParams(location.search);
  let courseRequest = resolveCourseRequest(params);
  const courseSession = !!courseRequest;
  const courseEmbedded = window.parent !== window;
  const courseTheme = themesFile.themes.find((item) => item.id === 'fpv');
  let scenario = null;
  if (courseRequest) {
    scenario = createLessonScenario(courseRequest.lessonId, {
      turnPolicy: courseRequest.turnPolicy || 'immediate',
      theme: courseTheme,
    });
  } else if (params.get('practice') === '1') {
    const raw = sessionStorage.getItem('revealline.playground.current');
    if (!raw)
      throw new Error(
        t("interface:thisPracticeTabHasNoConfigurationOpenThePlaygroundAnd"),
      );
    const prepared = await prepareScenario(JSON.parse(raw), { classRecipes: classRegistry });
    scenario = prepared.scenario;
  }
  // Switching source maps inside an authored preview must not turn the same
  // session into an awarding game, even when the configured scenario is cleared.
  const practiceSession = !!scenario;
  $('creator-tools').hidden = practiceSession;
  let packLaunchRequest = null,
    packLaunchError = '';
  if (!practiceSession)
    try {
      packLaunchRequest = resolvePackLaunch(params, packCatalog);
    } catch (error) {
      packLaunchError = error.message;
    }
  const controllerPreviewRequested = practiceSession && params.get('controller-preview') === '1';
  if (
    window.parent !== window &&
    window.name === 'revealline-controller-practice' &&
    !controllerPreviewRequested
  )
    throw new Error(t("interface:returnToControllerPracticeAndChooseLoadPracticeToContinue"));
  const controllerPreview = attachControllerPreview({ enabled: controllerPreviewRequested });
  const practiceNavigation = attachPracticeNavigation({
    enabled: practiceSession,
    onBlocked: () =>
      warning(
        courseSession
          ? t("interface:useEndCourseOrReturnToTheGameToLeave")
          : controllerPreviewRequested
            ? t("interface:useTheControllerPracticePageSHeaderLinksToLeave")
            : t("interface:useThePlaygroundPageSHeaderLinksToOpenThe"),
      ),
  });
  // Each archived release keeps its own profile schema, packs and save slot.
  // A portable complete backup transfers progress without changing older versions.
  const channel = isRelease ? `release-${buildVersion}` : 'dev';
  const libraryKey = `revealline.library.${channel}.v1`;
  const packsKey = `revealline.packs.${channel}.v1`;
  const sessionKey = `revealline.suspended.${channel}.v1`;
  const packCommits = createPackCommitCoordinator({
    read: () => checkedChapters(),
    write: (value) => writeCheckedPacks(value),
    prepare: (snapshot) => contentFromChapters(snapshot),
    adopt: adoptContentCatalog,
    canAdopt: () =>
      canReconcilePackCommit({
        contentSwitchBusy,
        sessionBusy,
        backupBusy,
        persistenceReady,
        backupLocked: localStorage.getItem(`${libraryKey}.backup-lock`) !== null,
        hidden: document.hidden,
      }),
    onReconciled: () => {
      refreshCampaigns();
      libraryPanel.refresh();
      contentStatus(t("interface:packStorageUpdatedYourNewerPlaySelectionWasKept"));
    },
    onError: (error) => {
      const message = t("gameplay:aCommittedPackChangeNeedsAReloadBeforeItCan", { value1: error.message });
      contentStatus(message, true);
      warning(message);
    },
  });
  const writer = scenario
    ? {
        writable: false,
        get reason() { return t("interface:practiceKeepsItsSettingsInThisPreviewOpenTheSolo"); },
        release() {},
      }
    : await claimProfileWriter(navigator.locks, `${libraryKey}.writer`);
  let pictureManager = null;
  const getPictureManager = () =>
    (pictureManager ??= createManagedMediaStore({ storyMedia: true }));
  const externalChapters = navigator.locks?.request
    ? createExternalChapterHost({
        profileKey: libraryKey,
        packsKey,
        storage: localStorage,
        writer,
        getManagedStore: getPictureManager,
        registeredEntries: [baseEntry],
        knownDescriptors: SOURCE_EXTERNAL_CHAPTERS,
      })
    : null;
  const externalBackup = externalChapters
    ? createExternalChapterBackup({
        profileKey: libraryKey,
        packsKey,
        storage: localStorage,
        writer,
        getManagedStore: getPictureManager,
        registeredEntries: [baseEntry],
        knownDescriptors: SOURCE_EXTERNAL_CHAPTERS,
      })
    : null;
  async function inspectChapters({ signal } = {}) {
    if (externalChapters) return externalChapters.inspect({ signal });
    const values = await Promise.all([
      readAssetStore(`${libraryKey}.external-chapter-index.v1`),
      readAssetStore(`${libraryKey}.external-chapter-journal.v1`),
      readAssetStore(`${libraryKey}.backup-journal`),
    ]);
    if (values.some((value) => value !== null))
      throw new Error(t("interface:safeChapterRecoveryRequiresWebLocksStoredDataIsPreserved"));
    const raw = await readAssetStore(packsKey);
    return { status: 'checked', packs: raw ? await importPackLibrary(raw) : emptyPackLibrary() };
  }
  async function checkedChapters(options) {
    const snapshot = await inspectChapters(options);
    if (snapshot.status !== 'checked')
      throw new Error(
        t("gameplay:pendingRecoverTheExactFilesBeforeAdoptingStoredChaptersBoth", { value1: snapshot.reason }),
      );
    return snapshot;
  }
  function contentFromChapters(snapshot) {
    return { ...prepareContentCatalog(snapshot.packs), chapterSnapshot: snapshot };
  }
  async function writeCheckedPacks(value) {
    const snapshot = await checkedChapters();
    if (!externalChapters) return writeAssetStore(packsKey, value);
    const review = await externalChapters.prepareMutation(snapshot, value ?? emptyPackLibrary());
    return externalChapters.commitMutation(review);
  }
  async function assertExternalBackupSupported(options) {
    if (externalBackup) return externalBackup.assertSupported(options);
    const snapshot = await checkedChapters();
    if (snapshot.index?.chapters.length)
      throw new Error(
        t("interface:externalChapterBackupTransferIsNotSupportedInThisSource"),
      );
  }
  let persistenceReady = writer.writable;
  let handlePageHide = () => writer.release();
  window.addEventListener('pagehide', (event) => handlePageHide(event));
  const journalKey = `${libraryKey}.backup-journal`;
  async function writeLegacyBackupPacks(value) {
    // Legacy recovery owns this channel's writer and backup lock. V2 uses
    // the companion's native pack/index pair transaction, never this path.
    if (
      (await readAssetStore(`${libraryKey}.external-chapter-index.v1`)) !== null ||
      (await readAssetStore(`${libraryKey}.external-chapter-journal.v1`)) !== null
    )
      throw new Error(
        t("interface:externalChapterBackupRecoveryNeedsItsCompatibleAdapterStoredData"),
      );
    return writeAssetStore(packsKey, value);
  }
  const backupAdapters = () => ({
    externalBackup: externalBackup ?? undefined,
    storage: localStorage,
    readAsset: readAssetStore,
    writeAsset: (key, value) =>
      key === packsKey
        ? packCommits.commit(value, { writeValue: writeLegacyBackupPacks })
        : writeAssetStore(key, value),
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
      const chapters = await inspectChapters();
      if (chapters.status === 'recovery-required' && chapters.reason !== 'backup-recovery')
        throw new Error(
          t("gameplay:pendingUseTheExactPilotRecoveryFilesAmbiguousJournalsWere", { value1: chapters.reason }),
        );
      const result = await recoverBackupImport(backupAdapters());
      if (!result.ok) persistenceReady = false;
      if (result.warning) packWarning = result.warning;
    } catch (e) {
      persistenceReady = false;
      packWarning = t("gameplay:storageRecovery", { value1: e.message });
    }
  }

  let loaded = { library: emptyLibrary(), warning: '', recovery: null, generation: 'legacy' };
  let storedStateAdopted = false;
  async function readSavedState() {
    const chapters = await checkedChapters();
    const read = () => {
      const content = contentFromChapters(chapters);
      const profile = loadLibrary(localStorage, libraryKey, {
        campaigns: content.executions.entries.map((entry) => entry.campaign),
      });
      return { content, profile };
    };
    return externalChapters ? externalChapters.withCurrent(chapters, read) : read();
  }
  try {
    const snapshot = await readSavedState();
    adoptContentCatalog(snapshot.content);
    loaded = snapshot.profile;
    storedStateAdopted = loaded.recovery === null;
  } catch (error) {
    persistenceReady = false;
    loaded.warning = t("gameplay:storedCollectionWasNotAdoptedThisSessionStartsWithBase", { value1: error.message });
  }
  let libraryBaseline = loaded.library,
    libraryGeneration = loaded.generation || 'legacy';
  let library = loaded.library,
    progress = progressFor(library, campaign),
    recovery = loaded.recovery;
  const difficultyNavigation = createDifficultyNavigation();
  const selectionBookmark = createSelectionBookmark({
    storage: localStorage,
    key: `${libraryKey}.last-selection.v1`,
    canWrite: () =>
      !practiceSession &&
      !practice &&
      !scenario &&
      !courseSession &&
      !courseEntry &&
      persistenceReady &&
      storedStateAdopted &&
      writer.writable &&
      !backupBusy &&
      localStorage.getItem(`${libraryKey}.backup-lock`) === null,
  });
  const rememberedSelection =
    !practiceSession && !packLaunchRequest && !packLaunchError && storedStateAdopted
      ? resolveSelectionBookmark(selectionBookmark.read().selection, {
          select: (key) => executionCatalog.select(key, library.preferences.campaignDifficulty),
          playable: (entry, index) =>
            difficultyNavigation.playable(
              entry,
              library.campaigns,
              progressFor(library, entry.campaign),
              index,
            ),
        })
      : null;
  let difficultyDetailsFor = null;
  if (!practiceSession) {
    activeEntry = executionCatalog.select(
      campaignKey(baseEntry.campaign),
      library.preferences.campaignDifficulty,
    );
    if (rememberedSelection) activeEntry = rememberedSelection.entry;
    campaign = activeEntry.campaign;
    classRegistry = activeEntry.classRecipes;
    themesFile.themes = activeEntry.themes;
    progress = progressFor(library, campaign);
  }
  if (loaded.warning || packWarning) {
    localizedText($('save-warning'), () =>[loaded.warning, packWarning].filter(Boolean).join(' '));
    show('save-warning', true);
  }
  const initialSelection = difficultyNavigation.selection(
    activeEntry,
    library.campaigns,
    progress,
    { levelId: rememberedSelection?.levelId },
  );
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
    defeatActive = false,
    defeatPaused = false,
    defeatRemaining = 0,
    sessionBusy = false,
    restoreController = null,
    themeOverride = !!rememberedSelection?.themeId,
    musicOverride = false,
    masteryDefinition = null,
    masteryObserver = null,
    masteryAward = null,
    courseObserver = null,
    courseUnavailable = null,
    courseView = null,
    coursePhase = 'ready',
    courseEntry = null,
    courseEntryMessage = '',
    courseEntryHold = false,
    contentSwitchBusy = false,
    backupBusy = false;
  const packLaunchGuard = createPackLaunchGuard();
  let demoHost = null;
  const demoLibrary = createDemoLibrary();
  const courseVisit = Object.create(null);
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
        localizedText($('mastery-announcement'), () =>status.message);
    },
  });
  theme =
    themesFile.themes.find(
      (t) => t.id === (rememberedSelection?.themeId || library.preferences.themeId),
    ) || theme;
  classId = classRegistry.some((c) => c.id === library.preferences.classId)
    ? library.preferences.classId
    : classRegistry[0].id;
  turnPolicy = library.preferences.turnPolicy;
  bodyId = library.preferences.bodyId;
  if (courseRequest && !courseRequest.turnPolicy)
    scenario = createLessonScenario(courseRequest.lessonId, {
      turnPolicy: library.preferences.turnPolicy,
      theme: courseTheme,
    });
  if (scenario) {
    theme = scenario.theme;
    classId = scenario.settings.classId;
    turnPolicy = scenario.settings.turnPolicy;
    seed = scenario.settings.seed;
    bodyId = theme.player;
  }
  const sound = new Soundscape({ persistentMusic: true });
  let neutralResumeTick = false;
  let gameShell = null,
    missionPicker = null,
    enemyGuide = null,
    optionalWorlds = null;
  let guideMusicWasPlaying = false;
  let soundtrackPlayer = null,
    soundtrackPanel = null,
    soundtrackStore = null;
  let soundtrackAssets = new Map(),
    soundtrackSuspended = false;
  let authoredMusic = null,
    soundtrackGeneration = -1,
    soundtrackDisposed = false;
  const soundtrackLoad = new AbortController();
  // This edition explicitly adopts v4. All media adapters share its single ledger;
  // training keeps its existing legacy presentation and never creates picture pins.
  getPictureManager();
  const pictureStore = practice ? null : createStillMediaStore({ managedStore: pictureManager });
  const storyStore = practice ? null : createStoryMediaStore({ managedStore: pictureManager });
  let flightPictures = null,
    pictureResume = null,
    pictureThemePending = null,
    pictureGeneration = 0;
  const picturePreparingMessage =
    t("interface:preparingTheChosenPictureFlightStaysPausedUntilItIs");
  const storyDialog = createStoryDialog({
    readMedia: pictureMedia,
    settings: () => ({
      volume: library.cinematicVolume ?? DEFAULT_CINEMATIC_VOLUME,
      masterVolume: library.preferences.masterVolume,
      muted: !sound.enabled,
      reducedMotion: $('reduced-effects').checked,
    }),
    saveVolume(volume) {
      if (practice || courseEntry)
        throw new Error(t("interface:trainingDoesNotChangeCinematicPreferences"));
      library = withCinematicVolume(library, volume);
      const saved = persistProfile();
      if (!saved.ok) throw new Error(saved.warning);
    },
    musicDucker: {
      acquire(factor) {
        return soundtrackPlayer?.acquireGain({ factor }).release ?? (() => {});
      },
    },
    neutralize: () => clearInput(),
  });
  const victoryStoryButton = document.createElement('button');
  victoryStoryButton.id = 'view-victory-story';
  localizedText(victoryStoryButton, () =>t("interface:victoryStory"));
  victoryStoryButton.hidden = true;
  document.querySelector('.overlay-actions').append(victoryStoryButton);
  victoryStoryButton.onclick = () => {
    if (practice || run.status !== 'won' || completionWarning) return;
    try {
      const pins = validateFlightPresentationPinsForRun(flightPictures.pins(), {
        identityCatalog: flightPictures.identityCatalog,
        campaignKey: campaignKey(campaign),
        level: run.level,
        themeId: theme.id,
      });
      const pin = storyPinForTheme(pins, theme.id),
        backdrop = flightPictures.current();
      if (!pin || !backdrop || canonicalJSON(pin.picturePin) !== canonicalJSON(backdrop.pin))
        throw new Error(t("interface:thisAttemptSExactStoryPosterIsUnavailable"));
      const size = boardPaintSizeForLevel(run.level),
        args = { theme, level: run.level, seed, image: backdrop.image, fit: backdrop.fit, ...size };
      void storyDialog
        .open({
          pin,
          title: run.level.name,
          drawPoster(canvas) {
            canvas.width = size.width;
            canvas.height = size.height;
            new BoardPainter(presets).drawGallery(canvas.getContext('2d'), args);
          },
        })
        .catch((error) => warning(error.message));
    } catch (error) {
      warning(error.message);
    }
  };
  const legacyPictureButton = document.createElement('button');
  legacyPictureButton.id = 'picture-use-legacy';
  localizedText(legacyPictureButton, () =>t("interface:useOriginalPackArtwork"));
  legacyPictureButton.hidden = true;
  document.querySelector('.overlay-actions').append(legacyPictureButton);
  async function pictureMedia({ signal } = {}) {
    if (!pictureStore) throw new Error(t("interface:practiceUsesItsOriginalArtwork"));
    return {
      store: pictureStore,
      storyStore,
      ...(await pictureStore.readPresentationMetadata({ signal })),
    };
  }
  function pictureIdentity(metadata) {
    return createPictureIdentityCatalog({ entries: installedEntries, metadata });
  }
  function newFlightPictures({
    nextRun = run,
    nextRunId = runId,
    entry = activeEntry,
    nextThemeId = theme.id,
    pins,
    legacy = practice || entry.activity === 'challenge',
    explicitLegacy = false,
  } = {}) {
    return createFlightPictures({
      context: {
        runId: nextRunId,
        executionKey: campaignKey(entry.campaign),
        levelId: nextRun.levelId,
        levelRevision: nextRun.level.revision,
        themeId: nextThemeId,
      },
      level: nextRun.level,
      themeIds: entry.themes.map((item) => item.id),
      identityCatalog: legacy ? null : pictureIdentity(),
      readMedia: pictureMedia,
      pins,
      legacy,
      explicitLegacy,
      selectPins:
        !legacy && chapterSnapshot?.index?.chapters.some((d) => d.id === entry.sourcePackId)
          ? async ({ media, selection, explicitLegacy, signal }) => {
              const checked = await checkedChapters({ signal });
              const original = await externalChapters.authoredPicture(
                checked,
                {
                  executionKey: selection.executionKey,
                  levelId: selection.levelId,
                  levelRevision: selection.levelRevision,
                  themeId: nextThemeId,
                },
                { signal },
              );
              if (original.metadata.generation !== media.metadata.generation)
                throw new Error(
                  t("interface:pictureChoicesChangedDuringChapterReadinessRetryThePausedFlight"),
                );
              const current = createPresentationPins(selection);
              const fallback =
                explicitLegacy || current.choices.some((choice) => choice.kind === 'legacy');
              const library = fallback
                ? validateMediaLibrary(
                    {
                      ...media.metadata.document.library,
                      assignments: [
                        ...media.metadata.document.library.assignments.filter(
                          (assignment) =>
                            canonicalJSON(assignment.identity) !==
                            canonicalJSON(original.pin.identity),
                        ),
                        {
                          identity: original.pin.identity,
                          presentationId: original.pin.presentationId,
                          revision: original.pin.presentationRevision,
                        },
                      ],
                    },
                    { identityCatalog: selection.identityCatalog },
                  )
                : selection.library;
              return createFlightPresentationPins(
                {
                  ...selection,
                  library,
                  stillDocument: media.metadata.document,
                  storyDocument: media.story.document,
                },
                { signal },
              );
            }
          : undefined,
    });
  }
  function cancelPictureStart() {
    pictureGeneration++;
    if (pictureResume !== null) flightPictures?.cancel();
    pictureThemePending?.controller.abort();
    pictureResume = null;
    pictureThemePending = null;
  }
  function pictureFailure(error) {
    if (error?.name === 'AbortError') return;
    warning(
      t("gameplay:pictureUnavailableYourFlightRemainsPausedRetryAfterRestoringIts", { value1: error.message }),
    );
    legacyPictureButton.hidden = started || practice;
    if (!started) localizedText($('start-button'), () =>t("interface:retryPicture"));
  }
  function warmPicture() {
    const owner = flightPictures;
    if (!owner || owner.ready(theme.id)) return;
    void owner
      .ensure(theme.id)
      .then(() => {
        if (owner === flightPictures) refreshHUD();
      })
      .catch((error) => {
        if (owner === flightPictures) pictureFailure(error);
      });
  }
  legacyPictureButton.onclick = () => {
    if (started || practice || !flightPictures) return;
    cancelPictureStart();
    flightPictures.dispose();
    flightPictures = newFlightPictures({ explicitLegacy: true });
    legacyPictureButton.hidden = true;
    resume();
  };
  function soundtrackContext() {
    const edition = activeEntry.baseCampaignKey || campaignKey(campaign);
    const level = scenario?.level || (activeEntry.baseCampaign || campaign).levels[levelIndex];
    return {
      themeId: theme.id,
      campaignKey: edition,
      mapKey: JSON.stringify([edition, level.id, level.revision, theme.id]),
    };
  }
  function assignMusic(track, { atBoundary = true } = {}) {
    authoredMusic = track || null;
    if (soundtrackPlayer) soundtrackPlayer.setAuthoredTrack(authoredMusic);
    else if (track) sound.setTrack(track, { atBoundary });
  }
  function configureAudio(settings) {
    if (!soundtrackPlayer) return sound.configure(settings);
    const { style: _style, music, ...mix } = settings;
    sound.configure(mix);
    if (music !== undefined) soundtrackPlayer.setVolume(music);
  }
  async function activateAudio({ explicit = false } = {}) {
    if (!soundtrackPlayer) return sound.enable();
    if (soundtrackSuspended) {
      soundtrackSuspended = false;
      await soundtrackPlayer.resume();
    }
    if (explicit || !soundtrackPlayer.snapshot().track) return soundtrackPlayer.play();
    // Ordinary Resume enables effects but keeps an intentional music-only Pause.
    return sound.enable();
  }
  function muteAudio() {
    soundtrackPlayer?.pause();
    sound.disable();
  }
  function suspendAudio() {
    soundtrackSuspended = true;
    if (soundtrackPlayer) soundtrackPlayer.suspend();
    else sound.suspend();
  }
  function soundtrackStatus(message) {
    localizedText($('soundtrack-summary'), () =>message);
  }
  async function initializeSoundtrack() {
    try {
      const audioElement = document.createElement('audio');
      if (typeof audioElement.play !== 'function')
        throw new Error(
          t("interface:thisBrowserDoesNotProvideFileAudioPlaybackBuiltIn"),
        );
      soundtrackStore = createSoundtrackStore({ managedStore: pictureManager });
      soundtrackPlayer = createSoundtrackPlayer({
        soundscape: sound,
        audioElement,
        readAsset: async (hash) => {
          const blob = soundtrackAssets.get(hash);
          if (!blob)
            throw new Error(t("interface:thisSongIsMissingLocallyRestoreItsSoundtrackBackup"));
          return blob;
        },
        onChange: (state) => {
          soundtrackPanel?.update(state);
          soundtrackStatus(
            state.error ||
              state.notice ||
              (state.track
                ? `${contentText(state.track, 'title')} · ${state.status}`
                : t("interface:chooseAPlaylistOrImportMp3Songs")),
          );
        },
      });
      soundtrackPlayer.setAuthoredTrack(authoredMusic);
      soundtrackPlayer.setContext(soundtrackContext());
      if (soundtrackSuspended) soundtrackPlayer.suspend();
      soundtrackPanel = attachSoundtrackPanel({
        document,
        store: soundtrackStore,
        player: soundtrackPlayer,
        getContext: soundtrackContext,
        onLibrary: (_library, snapshot) => {
          if (soundtrackDisposed || snapshot.generation < soundtrackGeneration) return;
          soundtrackGeneration = snapshot.generation;
          soundtrackAssets = new Map(snapshot.assets.map(({ sha256, blob }) => [sha256, blob]));
        },
        onError: (error) => soundtrackStatus(error.message || String(error)),
        onOpen: () => {
          pause(true);
          clearInput();
          $('settings-dialog').close();
        },
        onClose: () => {
          clearInput();
          $('settings-dialog').showModal();
          void storageRetention.refresh();
          $('soundtrack-open').focus();
        },
        onVolume: (value) => {
          $('music-volume').value = value;
          preferences({ musicVolume: value });
        },
        onAudioEnabled: () => preferences({ musicEnabled: true }),
        beforeAudio: async () => {
          if (soundtrackSuspended) {
            soundtrackSuspended = false;
            await soundtrackPlayer.resume();
          }
        },
      });
      // The studio owns persisted playlist selection. Keep the legacy genre selector
      // only for browsers that cannot attach the file-audio transport.
      $('music-select').closest('label').hidden = true;
      localizedText($('music-preview'), () =>t("interface:playSelectedPlaylist"));
      $('soundtrack-open').disabled = false;
      $('soundtrack-open').onclick = () => soundtrackPanel.open();
      try {
        const snapshot = await soundtrackStore.read({ signal: soundtrackLoad.signal });
        if (!soundtrackDisposed && snapshot.generation >= soundtrackGeneration) {
          soundtrackGeneration = snapshot.generation;
          soundtrackAssets = new Map(snapshot.assets.map(({ sha256, blob }) => [sha256, blob]));
          soundtrackPlayer.setLibrary(snapshot.library);
        }
      } catch (error) {
        if (!soundtrackDisposed)
          soundtrackStatus(
            t("gameplay:customMusicStorageBuiltInPlaybackIsAvailableTheStudio", { value1: error.message }),
          );
      }
    } catch (error) {
      soundtrackPanel?.dispose();
      soundtrackPlayer?.dispose();
      soundtrackStore?.close();
      soundtrackPlayer = null;
      soundtrackPanel = null;
      sound.resumeMusic();
      $('soundtrack-open').disabled = true;
      $('music-select').closest('label').hidden = false;
      if (!soundtrackDisposed) soundtrackStatus(error.message || String(error));
    }
  }
  const painter = new BoardPainter(presets, {
    onAsset: (message) => {
      const rig = visuals()?.player
        ? t("interface:customPlayerArtworkKeepsTheSelectedBodySRotorAnchors")
        : '';
      const copy = [message, rig, bodyWarning].filter(Boolean).join(' ');
      localizedText($('asset-warning'), () =>copy);
      show('asset-warning', !!copy);
    },
  });
  const mediaReduce = matchMedia('(prefers-reduced-motion: reduce)');
  $('reduced-effects').checked = mediaReduce.matches || library.preferences.reducedEffects;
  $('tap-steering').checked =
    library.preferences.tapSteering ?? matchMedia('(pointer: coarse)').matches;
  syncAssistControls();
  refreshTextSize();
  $('music-select').value = library.preferences.musicGenre;
  $('master-volume').value = library.preferences.masterVolume;
  $('music-volume').value = library.preferences.musicVolume;
  $('sfx-volume').value = library.preferences.sfxVolume;
  $('terrain-select').value = library.preferences.style;
  $('settings-grid').checked = library.preferences.showGrid;
  $('match-class-appearance').checked = library.preferences.matchClassAppearance;
  configureAudio({
    style: library.preferences.musicGenre,
    master: library.preferences.masterVolume,
    music: library.preferences.musicVolume,
    sfx: library.preferences.sfxVolume,
  });
  if (scenario?.music) assignMusic(scenario.music);
  function warning(message) {
    localizedText($('run-message'), () =>message);
    captionUntil = (run?.time || 0) + 5;
  }
  function dialogOpen() {
    return !!document.querySelector('dialog[open]');
  }
  const controller = createControllerRouter({
    autoJoin: true,
    navigationAliases: true,
    bindings: library.preferences.controllerBindings,
    boostMode: library.preferences.controllerBoostMode,
    ...(controllerPreview ? { readPads: controllerPreview.readPads } : {}),
  });
  let controllerLabels = controllerBindingLabels(library.preferences.controllerBindings),
    controllerDeviceId = '';
  let controllerFrame = null,
    controllerNavigation = null,
    controllerReading = null,
    controllerBoostSettings = null,
    controllerStatus = '',
    controllerPreviousScope = '',
    controllerInactive = false;
  let lastControllerModality = '';
  document.body.dataset.inputMode =
    navigator.maxTouchPoints > 0 || globalThis.matchMedia?.('(any-pointer: coarse)').matches
      ? 'touch'
      : 'keyboard';
  const modalNavigation = attachModalNavigation();
  const controllerDialog = modalNavigation.topDialog;
  function controllerMenuHint() {
    const b = controllerLabels.menu;
    return t("gameplay:stickDPadNavigateConfirmBackResume", { value1: b.confirm, value2: b.back, value3: b.menu, value4: library.preferences.controllerBindings ? '' : ' Shoulders / triggers: previous / next · West: confirm · North: back.' });
  }
  function controllerFlightHint() {
    const b = controllerLabels.flight;
    const actions = arcadeActionCapabilities(run?.level);
    return t("gameplay:stickDPadSteerPausePauseLiftTheStickTo", { value1: b.ability, value2: actions.manualAbility ? 'ability' : 'pause', value3: b.pickup, value4: actions.manualPickup ? 'supply' : 'field guide', value5: b.hangar, value6: actions.manualAbility && run?.hangars?.length ? 'hangar' : 'missions', value7: b.stop, value8: actions.manualBoost ? t("gameplay:boost", { value1: b.boost }) : '', value9: b.pause });
  }
  function refreshControllerPrompts() {
    controllerDeviceId = controllerFrame?.assigned?.id ?? controllerDeviceId;
    controllerLabels = controllerBindingLabels(
      library.preferences.controllerBindings,
      controllerDeviceId,
    );
    const b = controllerLabels.flight;
    const directions = t("gameplay:upDownLeftRight", { value1: b.up, value2: b.down, value3: b.left, value4: b.right, value5: controllerStickLabel(library.preferences.controllerBindings, 'flight') });
    localizedText($('controller-help'), () =>t("gameplay:connectAControllerAndReleaseItsControlsOnceBothSticks", { value1: directions, value2: controllerFlightHint(), value3: controllerMenuHint() }));
    localizedText($('controller-ui-hint'), () =>controllerScope() === 'flight' ? controllerFlightHint() : controllerMenuHint());
    controllerReading?.refresh();
    refreshControllerBoostCue();
  }
  function refreshControllerBoostCue() {
    renderControllerBoostCue(
      $('controller-boost-cue'),
      controller.boostState(),
      controllerLabels.flight.boost,
      !!controllerFrame?.assigned &&
        controllerScope() === 'flight' &&
        run?.status === 'running' &&
        arcadeActionCapabilities(run?.level).manualBoost,
    );
  }
  function adoptControllerBoostMode({ force = false } = {}) {
    if (force || controller.boostState().mode !== library.preferences.controllerBoostMode) {
      controller.setBoostMode(library.preferences.controllerBoostMode);
      clearInput();
    }
    controllerBoostSettings?.refresh();
    refreshControllerBoostCue();
  }
  function controllerScope() {
    if (demoHost?.active) return demoHost.scope;
    const dialog = controllerDialog();
    if (dialog) return `modal:${dialog.id}`;
    if (courseBlocked()) return `course:${coursePhase}`;
    if (celebrationActive) return 'celebration';
    if (defeatActive) return 'defeat-presentation';
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
    if (scope === 'celebration' || scope === 'defeat-presentation') return $('skip-celebration');
    if (scope === 'picture') return $('show-result');
    if (scope.startsWith('course:')) return $('overlay-read');
    if (courseSession && scope === 'won')
      return !$('first-flight-next').hidden ? $('first-flight-next') : $('retry-button');
    if (scope === 'won' || scope.startsWith('overview:')) return $('next-button');
    if (scope === 'lost') return $('retry-button');
    return $('start-button');
  }
  function controllerMenuRegion() {
    const dialog = controllerDialog();
    if (dialog) return dialog;
    if (!$('game-overlay').hidden)
      return courseSession ? $('game-overlay').closest('.arena-panel') : $('game-overlay');
    if (defeatActive || celebrationActive || (run?.status === 'won' && !$('show-result').hidden))
      return $('arena-shell');
    return document;
  }
  let controllerCompositeRegion = null;
  const controllerShellBar = document.querySelector('.shell-bar');
  function controllerMenuRoot() {
    const region = controllerMenuRegion();
    // Nonmodal overlays share navigation with the visible shell bar. The
    // accept predicate confines it to the overlay, shell and active lesson panel.
    controllerCompositeRegion =
      region !== document && !controllerDialog() && !courseBlocked() ? region : null;
    return controllerCompositeRegion ? document.body : region;
  }
  function controllerMenuAccepts(element) {
    return (
      (!controllerCompositeRegion ||
        controllerCompositeRegion.contains(element) ||
        (courseSession && $('first-flight-panel').contains(element)) ||
        !!controllerShellBar?.contains(element)) &&
      (!courseSession ||
        $('game-overlay').hidden ||
        !!controllerDialog() ||
        (!courseBlocked() && !!controllerShellBar?.contains(element)) ||
        $('game-overlay').contains(element) ||
        $('first-flight-panel').contains(element)) &&
      !element.matches(
        '[data-move],#stop-button,#boost-button,#action-button,#pickup-button,#pause-button',
      )
    );
  }
  function controllerBack() {
    if (demoHost?.active) { demoHost.close(); return; }
    const dialog = controllerDialog();
    if (dialog) {
      if (dialog.id === 'enemy-guide-dialog') {
        enemyGuide.close();
        return;
      }
      if (dialog.id === 'library-dialog' && libraryPanel.cancelAttemptExport()) return;
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
        localizedText($('controller-ui-hint'), () =>t("interface:thisOperationIsStillInProgressUseItsCancelAction"));
      return;
    }
    const scope = controllerScope();
    if (courseBlocked()) return;
    if (scope === 'paused') resume();
    else if (scope === 'celebration' || scope === 'defeat-presentation')
      $('skip-celebration').click();
    else if (scope === 'picture') $('show-result').click();
    else controllerFocus()?.focus();
  }
  const input = attachInput({
    arena: $('game-canvas'),
    onPause: (force) => pause(force),
    continuousSteering: () => true,
    getTouchSettings: () => resolveTouchControls(library.preferences.touchControls),
    touchEnabled: () => library.preferences.screenControls !== 'off',
    tapMode: () => $('tap-steering').checked,
    active: () =>
      started &&
      !paused &&
      !courseBlocked() &&
      !courseEntryHold &&
      !dialogOpen() &&
      run?.status === 'running',
    onGamepad: (message) => (localizedText($('input-status'), () =>message)),
    getBindings: () => library.preferences.keyboardBindings,
    readControllerCommand: () => controllerFrame?.flight,
    onClear: () => {
      cancelControllerToggleBoost(controller, controllerFrame);
      refreshControllerBoostCue();
    },
  });
  function setInputModality(mode) {
    if (document.body.dataset.inputMode === mode) return;
    if (mode === 'controller') input.releaseLocalControls();
    else input.clearPhysical();
    document.body.dataset.inputMode = mode;
    refreshInputPresentation();
  }
  function refreshInputPresentation() {
    const visible = showScreenControls({
      preference: library.preferences.screenControls,
      modality: document.body.dataset.inputMode,
      scope: controllerScope(),
      running: run?.status === 'running',
    });
    const next = visible ? 'shown' : 'hidden';
    if (document.body.dataset.screenControls !== next) document.body.dataset.screenControls = next;
  }
  controllerNavigation = attachControllerNavigation({
    getScope: controllerScope,
    getRoot: controllerMenuRoot,
    keyboard: true,
    getDefaultFocus: controllerFocus,
    getControlLabels: () => ({
      directions: t("interface:directionControls"),
      confirm: controllerLabels.menu.confirm,
      back: controllerLabels.menu.back,
    }),
    accept: controllerMenuAccepts,
    onNativeInput: (event) => {
      setInputModality(nextInputModality(document.body.dataset.inputMode, event));
      if (controllerScope() !== 'flight') controller.clear();
    },
    onBack: controllerBack,
    onMenu: () => {
      if (
        !courseBlocked() &&
        !dialogOpen() &&
        started &&
        paused &&
        !['won', 'lost'].includes(run?.status)
      )
        resume();
    },
    onHint: (message) => {
      localizedText($('controller-ui-hint'), () =>message);
      controllerReading?.hint(message);
    },
    onReadingChange: (state) => controllerReading?.changed(state),
  });
  controllerReading = attachControllerReading({
    compactOverlay: !courseSession,
    additionalSurfaces: [
      ['help-reading', 'help-read', t("common:navigation.howToPlay"), 'help-reading-unit'],
      [
        'collection-reading',
        'collection-read',
        t("interface:achievementsAndAppearances"),
        'collection-reading-unit',
      ],
    ],
    getNavigation: () => controllerNavigation,
    getControlLabels: () => controllerLabels.menu,
    getScope: controllerScope,
    pause,
    onTransition: () => clearInput({ preserveNavigation: true }),
  });
  const enemyWorkshopReturn = attachEnemyWorkshopReturn({
    enabled: practiceSession && !courseSession && !controllerPreviewRequested,
    onReturn: () => pause(true),
  });
  enemyGuide = attachEnemyGuide({
    themes: themesFile.themes,
    getThemeId: () => theme.id,
    getTurnPolicy: () => turnPolicy,
    loadImpactScenario: () => getJSON('content/scenarios/line-impact-demo.json'),
    onPractice: () => {
      clearInput();
      guideMusicWasPlaying = soundtrackPlayer?.snapshot().desired ?? sound.enabled;
      suspendAudio();
    },
    onReturn: () => {
      clearInput();
      if (
        !soundtrackDisposed &&
        guideMusicWasPlaying &&
        library.preferences.musicEnabled &&
        !document.hidden &&
        document.hasFocus()
      )
        activateAudio().catch(() => {});
      guideMusicWasPlaying = false;
    },
    onClose: () => {
      clearInput();
      if (!controllerDialog()) controllerFocus()?.focus({ preventScroll: true });
    },
    onRead: (request) => controllerNavigation.beginReading(request),
  });
  $('shell-guide').onclick = () => {
    pause(true);
    if ($('shell-home').open) $('shell-home').close();
    enemyGuide.open();
  };
  handlePageHide = (event) => {
    const demoActive = demoHost?.active;
    demoHost?.suspend();
    // Suspend while this tab still owns the writer. A history-cache return
    // keeps its memory available for export without reclaiming stale storage.
    if (courseEntry) cancelCourseEntry();
    optionalWorlds?.close(false);
    invalidateContentSwitch();
    if (!demoActive) pause(true);
    masteryAwards.cancelAll();
    cancelRestore();
    cancelPictureStart();
    clearInput();
    suspendAudio();
    writer.release();
    persistenceReady = false;
    controllerPreview?.clear();
    if (!event.persisted) {
      demoHost?.destroy();
      demoLibrary.dispose();
      soundtrackDisposed = true;
      soundtrackLoad.abort();
      enemyGuide.dispose();
      optionalWorlds?.dispose();
      soundtrackPlayer?.dispose();
      soundtrackPanel?.dispose();
      soundtrackStore?.close();
      flightPictures?.dispose();
      pictureStore?.close();
      storyStore?.close();
      externalChapters?.close();
      externalBackup?.close();
      pictureManager?.close();
      controllerReading.destroy();
      controllerNavigation.destroy();
      gameShell?.destroy();
      missionPicker?.destroy();
      modalNavigation.destroy();
      input.destroy();
      controller.destroy();
      controllerPreview?.destroy();
      practiceNavigation.destroy();
      enemyWorkshopReturn.dispose();
      courseView?.destroy();
    }
  };
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    restoreListening();
    controller.invalidate();
    clearInput();
    pause(true);
    localizedText($('save-warning'), () =>'This tab returned from browser history in session-only mode. Export a complete backup to keep its current progress, then reload to open the latest saved profile.');
    show('save-warning', true);
    void packCommits.reconcile();
    if ($('settings-dialog').open) void storageRetention.refresh();
  });
  function refreshKeyPrompts() {
    const bindings = resolveKeyBindings(library.preferences.keyboardBindings);
    const labels = bindingLabels(bindings);
    const actions = arcadeActionCapabilities(run?.level);
    const description = t("gameplay:tapADirectionToFlyTapAnotherToTurnUp", { value1: labels.up, value2: labels.down, value3: labels.left, value4: labels.right, value5: actions.manualAbility ? t("gameplay:ability", { value1: labels.ability }) : '', value6: actions.manualPickup && run?.ability.capacity ? t("gameplay:supply2", { value1: labels.pickup }) : '', value7: actions.manualBoost ? t("gameplay:boost2", { value1: labels.boost }) : '', value8: run?.hangars?.length ? t("gameplay:changeCraft", { value1: labels.hangar }) : '', value9: labels.pause, value10: run?.rules.stopOnCapture ? (" " + t("interface:closingACutStopsYourCraftTapAFreshDirection") + "") : '' });
    localizedText($('keyboard-help'), () =>description);
    localizedAttribute($('game-canvas'), "aria-label", () => t("gameplay:territoryCaptureGame", { value1: description }));
    for (const [id, action] of [
      ['action-button', 'ability'],
      ['pickup-button', 'pickup'],
      ['boost-button', 'boost'],
    ]) {
      localizedText($(id).querySelector('kbd'), () =>keyLabel(bindings.bindings[action][0])
        .replace('Left ', 'L ')
        .replace('Right ', 'R '));
      localizedAttribute($(id).querySelector('kbd'), "title", () => labels[action]);
    }
    localizedText($('hangar-button'), () =>t("gameplay:changeCraft2", { value1: labels.hangar }));
    $('stop-button').hidden = true;
    for (const button of document.querySelectorAll('[data-move]'))
      localizedAttribute(button, "title", () => t("gameplay:move", { value1: button.dataset.move, value2: labels[button.dataset.move] }));
    if (!started && !campaignOverview)
      localizedText($('overlay-footnote'), () =>t("gameplay:tapADirectionToFlyPauses", { value1: actions.manualAbility ? t("interface:equipmentControlsAreInHowToPlay") : t("interface:bonusesActivateOnContact"), value2: labels.pause }));
  }
  const keySettings = attachKeySettings({
    continuousSteering: true,
    getBindings: () => library.preferences.keyboardBindings,
    setBindings: (value) => {
      preferences({ keyboardBindings: value });
      return saveSucceeded && !practice
        ? { ok: true }
        : {
            ok: false,
            warning:
              t("interface:keysChangedForThisSessionExportYourLibraryToRetain"),
          };
    },
    onChanged: () => {
      clearInput();
      refreshKeyPrompts();
    },
  });
  const controllerSettings = attachControllerSettings({
    continuousSteering: true,
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
              t("interface:controllerControlsChangedForThisSessionExportYourLibraryTo"),
          };
    },
  });
  const storageRetention = attachStorageRetention({
    button: $('storage-retention-button'),
    status: $('storage-retention-status'),
    isOpen: () => $('settings-dialog').open,
  });
  window.addEventListener('pagehide', (event) => {
    storageRetention.close();
    if (!event.persisted) {
      storageRetention.destroy();
      keySettings.destroy();
      controllerSettings.destroy();
      controllerBoostSettings.destroy();
    }
  });
  controllerBoostSettings = attachControllerBoostSettings({
    select: $('controller-boost-mode'),
    status: $('controller-boost-status'),
    getMode: () => library.preferences.controllerBoostMode,
    applyMode: (mode) => {
      pause(true);
      const saved = preferences({ controllerBoostMode: mode });
      adoptControllerBoostMode({ force: true });
      return saved;
    },
  });
  function clearInput({ preserveNavigation = false, resetDirection = false } = {}) {
    pendingAction = false;
    pendingPickup = false;
    pendingSwitch = null;
    controller.clear();
    controllerFrame = null;
    if (!preserveNavigation) controllerNavigation?.clear();
    if (resetDirection) input.clear();
    else input.clearPhysical();
    accumulator = 0;
  }
  function courseBlocked() {
    return (
      !!courseEntry || (courseSession && ['switching', 'leaving', 'ended'].includes(coursePhase))
    );
  }
  function refreshCourse() {
    if (!courseView) return;
    if (courseSession && !['switching', 'leaving', 'ended'].includes(coursePhase))
      coursePhase = !started
        ? 'ready'
        : ['won', 'lost'].includes(run?.status)
          ? 'review'
          : paused
            ? 'paused'
            : 'playing';
    const snapshot = courseSnapshot();
    if (courseSession && snapshot?.outcome === 'complete')
      courseVisit[courseRequest.lessonId] = 'complete';
    courseView.render({
      request: courseRequest,
      phase: coursePhase,
      snapshot,
      visit: courseVisit,
      error: snapshot?.error || '',
      embedded: courseEmbedded,
      entry: {
        available: !practice && !courseSession && !started && !courseEntry,
        helpAvailable: !practice && !courseSession,
        pending: !!courseEntry,
        message: courseEntryMessage,
      },
    });
    if (!courseSession) return;
    // Ended/transitioning embedded courses retain only their terminal reader.
    if (controllerShellBar) controllerShellBar.hidden = courseBlocked();
    const progressText = t("gameplay:lessonsThisVisit", { value1: Object.values(courseVisit).filter((value) => value === 'complete').length, value2: FIRST_FLIGHT_LESSONS.length });
    if ($('campaign-progress').textContent !== progressText)
      localizedText($('campaign-progress'), () =>progressText);
    const lesson = getFirstFlightLesson(courseRequest.lessonId);
    const task =
      coursePhase === 'ended'
        ? t("interface:courseEndedUseTheParentPageSGameLinkTo")
        : snapshot?.outcome === 'lost'
          ? t("interface:readTheLossExplanationThenRetryOrChooseAnotherLesson")
          : snapshot?.outcome === 'missed'
            ? t("interface:pictureRevealedRetryTheSuggestedExampleOrSkipIt")
            : snapshot?.outcome === 'complete'
              ? t("interface:lessonCompleteEnjoyThePictureOrChooseYourNextLesson")
              : snapshot?.available === false
                ? t("interface:guidanceIsUnavailableYouCanStillPlayRetrySkipOr")
                : lesson.steps.find((item) => item.id === snapshot?.stepId)?.instruction ||
                  lesson.summary;
    const text = `${task}${
      snapshot?.territoryKept && run?.status === 'respawning'
        ? (" " + t("interface:yourUnfinishedLineWasCancelledEarlierSecuredTerritoryIsKept") + "")
        : ''
    }`;
    if ($('first-flight-task').textContent !== text) localizedText($('first-flight-task'), () =>text);
  }
  function courseSnapshot() {
    if (courseObserver) return courseObserver.snapshot();
    if (!courseUnavailable) return null;
    return {
      ...courseUnavailable,
      outcome: run?.status === 'lost' ? 'lost' : run?.status === 'won' ? 'missed' : 'pending',
    };
  }
  function stopCourseGuidance() {
    courseUnavailable = {
      ...(courseObserver?.snapshot() || {
        lessonId: courseRequest.lessonId,
        steps: [],
      }),
      available: false,
      error: t("interface:guidanceIsUnavailableForThisAttemptYouCanStillPlay"),
    };
    courseObserver = null;
  }
  function cancelCourseEntry(message = t("interface:courseEntryCancelledYourFlightRemainsPaused")) {
    if (!courseEntry) return;
    courseEntry.controller.abort();
    courseEntry = null;
    courseEntryMessage = message;
    clearInput();
    refreshCourse();
  }
  async function enterFirstFlight() {
    if (practice || courseSession || courseEntry) return;
    attemptFiles?.invalidate();
    const ticket = {
      controller: new AbortController(),
      run,
      recorder,
      runId,
      generation: libraryGeneration,
      campaign,
    };
    courseEntry = ticket;
    courseEntryHold = true;
    cancelRestore();
    clearInput();
    paused = true;
    sound.pause();
    if (!$('help-dialog').open) $('help-dialog').showModal();
    courseEntryMessage = t("interface:preparingFirstFlightYourCurrentFlightStaysPaused");
    refreshCourse();
    $('first-flight-entry-cancel').focus({ preventScroll: true });
    const assertCurrent = () => {
      if (
        courseEntry !== ticket ||
        ticket.controller.signal.aborted ||
        run !== ticket.run ||
        recorder !== ticket.recorder ||
        runId !== ticket.runId ||
        campaign !== ticket.campaign ||
        libraryGeneration !== ticket.generation
      )
        throw new DOMException(t("interface:courseEntryWasCancelledByANewerChange"), 'AbortError');
    };
    try {
      if (started && ['running', 'respawning'].includes(run.status)) {
        await retainFlightForFirstFlight({
          run,
          recorder,
          campaign,
          campaignKey: campaignKey(campaign),
          themeId: theme.id,
          bodyId,
          runId,
          continuation: { direction: input.snapshotDirection() },
          presentationPins: flightPictures?.pins(),
          mediaIdentityCatalog: flightPictures?.identityCatalog,
          storage: localStorage,
          sessionKey,
          assertCurrent,
          assertWritable: async () => {
            assertWriter();
            if (
              !storedStateAdopted ||
              recovery !== null ||
              (await readAssetStore(journalKey)) !== null
            )
              throw new Error(t("interface:storedDataNeedsRecoveryBeforeThisFlightCanBeRetained"));
          },
          withStorageLock: (work) => {
            if (!navigator.locks?.request)
              throw new Error(t("interface:thisBrowserCannotRetainTheFlightSafelyBeforeNavigation"));
            return navigator.locks.request(
              `${libraryKey}.backup-lock`,
              { signal: ticket.controller.signal },
              work,
            );
          },
          signal: ticket.controller.signal,
          onProgress: ({ ticks, total }) => {
            if (courseEntry !== ticket) return;
            courseEntryMessage = t("gameplay:verifyingYourSavedFlightTicks", { value1: ticks, value2: total });
            refreshCourse();
          },
        });
      }
      assertCurrent();
      const target = new URL('./', location.href);
      target.searchParams.set('course', 'first-flight');
      target.searchParams.set('lesson', FIRST_FLIGHT_LESSONS[0].id);
      target.searchParams.set('turn-policy', turnPolicy);
      // Navigation lifecycle callbacks must not autosave again after the checked
      // handoff. Only an explicit resume/new attempt releases this save hold.
      location.assign(target.href);
    } catch (error) {
      if (courseEntry !== ticket) return;
      courseEntry = null;
      courseEntryHold = true;
      courseEntryMessage = t("gameplay:yourFlightRemainsPausedHereYouCanReturnToIt", { value1: error.message });
      clearInput();
      refreshCourse();
      $('first-flight-help-enter').focus({ preventScroll: true });
    }
  }
  function selectCourseLesson(lessonId) {
    if (!courseSession || ['switching', 'leaving', 'ended'].includes(coursePhase)) return;
    getFirstFlightLesson(lessonId);
    coursePhase = 'switching';
    clearInput();
    sound.pause();
    courseRequest = { course: 'first-flight', lessonId, turnPolicy };
    scenario = createLessonScenario(lessonId, { turnPolicy, theme: courseTheme });
    classId = scenario.settings.classId;
    seed = scenario.settings.seed;
    theme = scenario.theme;
    bodyId = theme.player;
    practice = true;
    demo = false;
    coursePhase = 'ready';
    setTheme();
    prepare();
    $('start-button').focus({ preventScroll: true });
  }
  function nextCourseLesson(skip = false) {
    if (!courseSession || courseBlocked()) return;
    const snapshot = courseSnapshot();
    if (!skip && snapshot?.outcome !== 'complete') return;
    if (skip && courseVisit[courseRequest.lessonId] !== 'complete')
      courseVisit[courseRequest.lessonId] = 'skipped';
    const index = FIRST_FLIGHT_LESSONS.findIndex((item) => item.id === courseRequest.lessonId);
    if (index + 1 < FIRST_FLIGHT_LESSONS.length)
      selectCourseLesson(FIRST_FLIGHT_LESSONS[index + 1].id);
    else leaveCourse();
  }
  function leaveCourse() {
    if (!courseSession || courseBlocked()) return;
    clearInput();
    paused = true;
    sound.pause();
    celebrationActive = false;
    defeatActive = false;
    defeatPaused = false;
    defeatRemaining = 0;
    painter.skipCelebration?.();
    show('skip-celebration', false);
    show('show-result', false);
    if (courseEmbedded) {
      coursePhase = 'ended';
      show('game-overlay', true);
      $('game-overlay').dataset.kind = 'course-ended';
      show('pause-label', false);
      show('overlay-reading', true);
      show('overlay-footnote', true);
      show('overlay-menu', false);
      localizedText($('overlay-title'), () =>t("interface:firstFlightEnded"));
      localizedText($('overlay-copy'), () =>t("interface:practiceAwardedNoProgressUseTheParentPageSGame"));
      localizedText($('overlay-footnote'), () =>'');
      for (const id of [
        'start-button',
        'retry-button',
        'next-button',
        'view-picture',
        'choose-mission',
        'result-medals',
        'retry-consequence',
      ])
        show(id, false);
      refreshCourse();
      controllerReading?.refresh();
      $('overlay-read').focus({ preventScroll: true });
    } else {
      coursePhase = 'leaving';
      refreshCourse();
      location.assign(new URL('./', location.href).href);
    }
  }
  function catalog() {
    const entries = [...installedEntries];
    for (const key of Object.keys(library.campaigns)) {
      const id = key.split('/')[0],
        match = /^route-(\d{4}-\d\d-\d\d)-(daily|calm|expert)$/.exec(id);
      if (match) {
        try {
          const c = challengeCampaign(match[1], match[2], baseClasses);
          entries.push({ ...baseEntry, campaign: c, activity: 'challenge' });
        } catch {}
      }
    }
    const selected = {
      ...activeEntry,
      campaign: activeEntry.baseCampaign || activeEntry.campaign,
    };
    if (!entries.some((e) => campaignKey(e.campaign) === campaignKey(selected.campaign)))
      entries.push(selected);
    return entries.filter(
      (e, i, all) =>
        all.findIndex((x) => campaignKey(x.campaign) === campaignKey(e.campaign)) === i,
    );
  }
  function executionEntries() {
    // Removed packs keep archived records but cannot resolve a saved flight.
    return [
      ...executionCatalog.entries,
      ...catalog().filter(
        (entry) =>
          !entry.sourcePackId &&
          !executionCatalog.find(campaignKey(entry.campaign)) &&
          /^route-\d{4}-\d\d-\d\d-(daily|calm|expert)$/.test(entry.campaign.id),
      ),
    ];
  }
  function currentSelection(options = {}) {
    return difficultyNavigation.selection(activeEntry, library.campaigns, progress, options);
  }
  function missionAvailable(index, entry = activeEntry) {
    const selected =
      executionCatalog.select(
        entry.baseCampaignKey || campaignKey(entry.campaign),
        library.preferences.campaignDifficulty,
      ) || entry;
    const shared = difficultyNavigation.access(selected, library.campaigns);
    if (shared) return shared.levels[index]?.playable === true;
    return difficultyNavigation.playable(
      selected,
      library.campaigns,
      progressFor(library, selected.campaign),
      index,
    );
  }
  function availableBodies() {
    return characterPresentations.availableBodies(
      difficultyNavigation.bodies(activeEntry, library.campaigns, progress),
    );
  }
  function currentAppearanceMilestones() {
    return difficultyNavigation.milestones(activeEntry, library.campaigns, progress);
  }
  function applyNextDifficulty(mode = library.preferences.campaignDifficulty) {
    if (scenario || practice || courseSession) return;
    const selected = executionCatalog.select(
      activeEntry.baseCampaignKey || campaignKey(activeEntry.campaign),
      mode,
    );
    if (!selected) return;
    activeEntry = selected;
    campaign = selected.campaign;
    classRegistry = selected.classRecipes;
    progress = progressFor(library, campaign);
  }
  function refreshDifficulty() {
    const cue = difficultyCue({
      entry: activeEntry,
      nextMode: library.preferences.campaignDifficulty,
      started,
      recovering: sessionBusy,
      practice,
    });
    $('difficulty-select').value = library.preferences.campaignDifficulty;
    $('difficulty-select').disabled =
      !cue.available || courseSession || !!courseEntry || contentSwitchBusy || backupBusy;
    localizedText($('difficulty-note'), () =>cue.copy);
    const standard = executionCatalog.select(activeEntry.baseCampaignKey, 'standard'),
      gentle = executionCatalog.select(activeEntry.baseCampaignKey, 'gentle');
    show('difficulty-details', cue.available && !!standard && !!gentle);
    if (
      cue.available &&
      standard &&
      gentle &&
      (difficultyDetailsFor?.campaign !== standard.campaign ||
        difficultyDetailsFor?.levelIndex !== levelIndex)
    ) {
      $('difficulty-rule-details').replaceChildren(
        ...difficultyRuleComparison(
          standard.campaign.levels[levelIndex],
          gentle.campaign.levels[levelIndex],
        ).map((copy) => {
          const row = document.createElement('li');
          localizedText(row, () =>copy);
          return row;
        }),
      );
      difficultyDetailsFor = { campaign: standard.campaign, levelIndex };
    }
    localizedText($('overlay-difficulty'), () =>cue.available
      ? t("gameplay:difficulty", { value1: cue.current, value2: cue.retry })
      : '');
    show('overlay-difficulty', cue.available);
  }
  function refreshCampaigns() {
    $('campaign-select').replaceChildren(
      ...catalog().map(
        (e) =>
          localizedOption(() => contentText(e.campaign, 'title') || contentText(e.campaign, 'name') || e.campaign.id, campaignKey(e.campaign)),
      ),
    );
    $('campaign-select').value = activeEntry.baseCampaignKey || campaignKey(campaign);
    refreshContentSelectors();
  }
  function contentStatus(message, error = false) {
    localizedText($('content-select-status'), () =>message);
    if (error) $('content-select-status').dataset.kind = 'error';
    else delete $('content-select-status').dataset.kind;
    const homeStatus = $('shell-featured-status');
    if (homeStatus) {
      localizedText(homeStatus, () =>message);
      homeStatus.hidden = !message;
      homeStatus.dataset.kind = error ? 'error' : 'status';
    }
  }
  function invalidateContentSwitch({ announce = false } = {}) {
    attemptFiles?.invalidate();
    const interrupted = contentSwitchBusy;
    packLaunchGuard.invalidate();
    contentSwitchBusy = false;
    $('pack-select').disabled = courseSession;
    $('level-select').disabled = courseSession;
    if (announce && interrupted)
      contentStatus(t("interface:pendingPackLaunchCancelledYourNewerPlayChoiceIsKept"));
    return interrupted;
  }
  function refreshContentSelectors() {
    const installedIds = new Set(packs.packs.map((pack) => pack.id));
    const options = [localizedOption(() => t("gameplay:baseGameLevels", { value1: baseCampaign.levels.length }), '')];
    for (const summary of packCatalog.packs) {
      const levels = summary.campaigns.reduce((total, item) => total + item.levels.length, 0);
      options.push(
        localizedOption(() => `${contentText(summary, 'name')} · ${t('common:counts.levels', { count: levels })} · ${installedIds.has(summary.id) ? t('common:status.installed') : t('common:status.installOnSelect')}`,
          summary.id,
        ),
      );
    }
    for (const pack of packs.packs) {
      if (packCatalog.packs.some((item) => item.id === pack.id)) continue;
      const levels = pack.campaigns.reduce((total, item) => total + item.levels.length, 0);
      options.push(
        localizedOption(() => t("gameplay:installed2", { value1: contentText(pack, 'name'), value2: levels, value3: levels === 1 ? 'level' : 'levels' }),
          pack.id,
        ),
      );
    }
    const baseKey = campaignKey(baseEntry.campaign);
    const currentKey = activeEntry.baseCampaignKey || campaignKey(campaign);
    let selectedPack = activeEntry.sourcePackId || '';
    if (!activeEntry.sourcePackId && currentKey !== baseKey) {
      selectedPack = `campaign:${currentKey}`;
      options.push(
        localizedOption(() => contentText(campaign, 'title') || contentText(campaign, 'name') || campaign.id, selectedPack, true, true),
      );
    }
    $('pack-select').replaceChildren(...options);
    $('pack-select').value = selectedPack;
    $('level-select').replaceChildren(
      ...campaign.levels.map((level, index) => {
        const available = missionAvailable(index);
        return localizedOption(() => `${String(index + 1).padStart(2, '0')} · ${contentText(level, 'name')}${available ? '' : ' · ' + t('common:status.locked')}`,
          level.id,
          false,
          index === levelIndex,
        );
      }),
    );
    for (const [index, option] of [...$('level-select').options].entries())
      option.disabled = !missionAvailable(index);
    $('level-select').value = campaign.levels[levelIndex].id;
    $('pack-select').disabled = courseSession || contentSwitchBusy;
    $('level-select').disabled = courseSession || contentSwitchBusy;
    refreshDifficulty();
  }
  function persistProfile({ mode = 'merge' } = {}) {
    if (courseSession || courseEntry)
      return { ok: false, warning: t("interface:trainingDoesNotSavePlayerLibraryChanges") };
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
                t("interface:storageRecoveryMustFinishBeforeSavingExportYourSessionBefore"),
            };
    } catch {
      saved = { ok: false, warning: t("interface:storageIsUnavailableExportYourPlayerLibrary") };
    }
    saveSucceeded = saved.ok;
    if (saved.ok) {
      recovery = null;
      library = saved.library;
      libraryBaseline = library;
      libraryGeneration = saved.generation;
      progress = progressFor(library, campaign);
      adoptControllerBoostMode();
    } else {
      localizedText($('save-warning'), () =>saved.warning);
      show('save-warning', true);
    }
    refreshDifficulty();
    refreshTextSize();
    return saved;
  }
  function preferences(patch) {
    if (courseEntry)
      return {
        ok: false,
        warning: t("interface:finishOrCancelTheCourseHandoffBeforeChangingSettings"),
      };
    library = updatePreferences(library, { ...library.preferences, ...patch });
    if (!practice) return persistProfile();
    refreshTextSize();
    return {
      ok: false,
      warning:
        t("interface:practicePreferencesStayInThisSessionExportYourPlayerLibrary"),
    };
  }
  function cancelRestore() {
    restoreController?.abort();
  }
  function rememberSelection() {
    return selectionBookmark.remember({
      campaignKey: activeEntry.baseCampaignKey || campaignKey(campaign),
      levelId: campaign.levels[levelIndex].id,
      themeId: theme.id,
    });
  }
  function selectEntry(
    entry,
    {
      levelId,
      themeId,
      seed: selectedSeed,
      restoreAdoption = false,
      contentSwitchTicket = null,
      difficulty,
    } = {},
  ) {
    if (courseSession || courseEntry)
      throw new Error(t("interface:endFirstFlightBeforeSelectingACampaign"));
    if (!entry) throw new Error(t("interface:thisCampaignIsNotInstalled"));
    if (difficulty !== undefined) resolveCampaignDifficulty(difficulty);
    if (selectedSeed !== undefined) {
      if (!Number.isInteger(selectedSeed) || selectedSeed < 0 || selectedSeed > 0xffffffff)
        throw new Error(t("interface:pictureSeedIsInvalid"));
      seed = selectedSeed;
    }
    if (contentSwitchTicket) packLaunchGuard.assert(contentSwitchTicket, packs);
    else invalidateContentSwitch({ announce: true });
    if (!restoreAdoption) cancelRestore();
    themeOverride = !!themeId;
    musicOverride = false;
    scenario = null;
    practice = practiceSession;
    demo = false;
    entry =
      executionCatalog.select(
        entry.baseCampaignKey || campaignKey(entry.campaign),
        difficulty ?? (practiceSession ? 'standard' : library.preferences.campaignDifficulty),
      ) || entry;
    activeEntry = entry;
    campaign = entry.campaign;
    classRegistry = entry.classRecipes;
    themesFile.themes = entry.themes;
    progress = progressFor(library, campaign);
    const selection = currentSelection({ levelId });
    levelIndex = selection.levelIndex;
    campaignOverview = !practice && selection.overview;
    if (!classRegistry.some((c) => c.id === classId)) classId = classRegistry[0].id;
    theme = entry.themes.find((t) => t.id === (themeId || campaign.themeId)) || entry.themes[0];
    bodyId = theme.player;
    $('theme-select').replaceChildren(...entry.themes.map((t) => localizedOption(() => contentText(t, 'name'), t.id)));
    $('theme-select').value = theme.id;
    $('class-select').replaceChildren(...classRegistry.map((c) => localizedOption(() => contentText(c, 'label'), c.id)));
    const track = entry.music?.find((m) => m.id === campaign.musicId) || entry.music?.[0];
    if (track) {
      assignMusic(track);
      $('music-select').value = track.genre;
    } else assignMusic(DEFAULT_TRACKS.find((t) => t.genre === library.preferences.musicGenre));
    refreshCampaigns();
    prepare({ restoreAdoption, contentSwitchTicket, difficulty });
    if (!restoreAdoption) rememberSelection();
  }
  async function replacePackLibrary(
    next,
    { contentSwitchTicket = null, preserveCurrentRun = false } = {},
  ) {
    if (courseEntry) throw new Error(t("interface:cancelTheCourseHandoffBeforeChangingPacks"));
    attemptFiles?.invalidate();
    const ownsOperation = !contentSwitchTicket;
    const operation = contentSwitchTicket || packLaunchGuard.begin(packs);
    if (ownsOperation) {
      packCommits.markIntent();
      contentSwitchBusy = true;
      refreshContentSelectors();
    }
    try {
      const before = packs;
      if (
        preserveCurrentRun &&
        before.packs.some(
          (old) =>
            JSON.stringify(next.packs.find((item) => item.id === old.id)) !== JSON.stringify(old),
        )
      )
        throw new Error(t("interface:installingAWorldMustPreserveEveryExistingPack"));
      packLaunchGuard.assert(operation, before);
      assertWriter();
      let content = prepareContentCatalog(next);
      if (!preserveCurrentRun || !paused) pause(true);
      cancelRestore();
      if (!preserveCurrentRun) masteryAwards.cancelAll();
      try {
        await packCommits.commit(exportPackLibrary(next), {
          beforeWrite: () => packLaunchGuard.assert(operation, packs),
        });
      } catch (error) {
        if (!packLaunchGuard.current(operation, packs)) throw error;
        throw new Error(t("gameplay:packStorageFailedPreviousInstalledPacksAreKept", { value1: error.message }));
      }
      if (!packLaunchGuard.current(operation, before)) {
        await packCommits.noteStaleCommit();
        packLaunchGuard.assert(operation, packs);
      }
      content = contentFromChapters(await checkedChapters());
      packLaunchGuard.assert(operation, before);
      adoptContentCatalog(content);
      packLaunchGuard.advance(operation, before, packs);
      packCommits.acceptCurrent();
      if (
        !preserveCurrentRun &&
        activeEntry.sourcePackId &&
        !packs.packs.some((pack) => pack.id === activeEntry.sourcePackId)
      )
        selectEntry(baseEntry, { contentSwitchTicket: operation });
      else if (!preserveCurrentRun && activeEntry.sourcePackId) {
        const pack = packs.packs.find((item) => item.id === activeEntry.sourcePackId);
        const authoredId = activeEntry.baseCampaign?.id || campaign.id;
        selectEntry(
          resolvePackCampaign(
            pack,
            pack.campaigns.some((source) => source.id === authoredId)
              ? authoredId
              : pack.campaigns[0].id,
          ),
          { contentSwitchTicket: operation },
        );
      }
      refreshCampaigns();
    } finally {
      if (ownsOperation && packLaunchGuard.current(operation, packs)) {
        contentSwitchBusy = false;
        refreshContentSelectors();
        await packCommits.reconcile();
      }
    }
  }
  async function ensureBundledPack(packId, operation) {
    const before = packs;
    packLaunchGuard.assert(operation, before);
    const installed = packs.packs.find((pack) => pack.id === packId);
    if (installed) return { pack: installed, installed: false };
    const summary = packCatalog.packs.find((pack) => pack.id === packId);
    if (!summary) throw new Error(t("interface:thisPackIsNotBundledWithTheCurrentBuild"));
    assertWriter();
    contentStatus(t("gameplay:installingOnThisDevice", { value1: contentText(summary, 'name') }));
    const source = await packLaunchGuard.run(
      operation,
      before,
      () => packs,
      () => fetchBundledChapter(summary),
    );
    const prepared = await packLaunchGuard.run(
      operation,
      before,
      () => packs,
      async () => {
        try {
          return await preparePack(source, { library: before });
        } catch (error) {
          if (error.message === 'JSON exceeds its byte budget.')
            throw new Error(
              t("interface:thisPackDoesNotFitTheInstalledLibraryS48"),
            );
          throw error;
        }
      },
    );
    await replacePackLibrary(installPack(before, prepared.pack), {
      contentSwitchTicket: operation,
    });
    return { pack: prepared.pack, installed: true };
  }
  async function installSourceChapter(chapterId, files, { signal, download = false } = {}) {
    const descriptor = sourceExternalChapter(chapterId);
    if (practiceSession || courseEntry || !writer.writable)
      throw new Error(t("interface:openTheWritableGameToInstallThisChapter"));
    const operation = packLaunchGuard.begin(packs),
      before = packs;
    packCommits.markIntent();
    contentSwitchBusy = true;
    refreshContentSelectors();
    const cancel = () => {
      if (packLaunchGuard.current(operation, packs)) invalidateContentSwitch();
    };
    signal?.addEventListener('abort', cancel, { once: true });
    let committed = false;
    try {
      const prepared = download
        ? await prepareExternalDownload(descriptor.id, {
            signal,
            baseURL: new URL('../', location.href),
          })
        : await prepareSourceExternalChapter(files, { chapterId: descriptor.id, signal });
      packLaunchGuard.assert(operation, before);
      const snapshot = await inspectChapters({ signal });
      if (snapshot.status !== 'checked' && snapshot.reason !== 'external-recovery')
        throw new Error(
          t("interface:backupAndMixedRecoveryMustBeResolvedBeforeThisChapter"),
        );
      await externalChapters[snapshot.reason === 'external-recovery' ? 'recover' : 'install'](
        prepared,
        { signal },
      );
      committed = true;
      const next = await checkedChapters({ signal });
      await externalChapters.readiness(next, descriptor.id, { signal });
      packLaunchGuard.assert(operation, before);
      adoptContentCatalog(contentFromChapters(next));
      packLaunchGuard.advance(operation, before, packs);
      packCommits.acceptCurrent();
      // Recovery never silently re-enables profile writes from an unreadable baseline.
      // A clean reload adopts the preserved profile and saved flight together.
      refreshCampaigns();
    } catch (error) {
      if (committed) {
        void packCommits.noteStaleCommit();
        throw new Error(
          t("gameplay:theChapterInstallationCommittedReloadRecheckBeforeChoosingIt", { value1: error.message }),
        );
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (packLaunchGuard.current(operation, packs)) {
        contentSwitchBusy = false;
        refreshContentSelectors();
        await packCommits.reconcile();
      }
    }
  }
  async function installOptionalChapter(summary, { signal } = {}) {
    if (courseEntry || courseSession || practice)
      throw new Error(t("interface:returnFromPracticeBeforeInstallingWorlds"));
    const old = packs.packs.find((item) => item.id === summary.id);
    if (old) return verifyOptionalInstalled(old, summary, { signal });
    if (signal?.aborted) throw new DOMException(t("interface:downloadCancelled"), 'AbortError');
    cancelRestore();
    const operation = packLaunchGuard.begin(packs),
      before = packs;
    packCommits.markIntent();
    contentSwitchBusy = true;
    refreshContentSelectors();
    const cancelled = () => {
      if (packLaunchGuard.current(operation, packs)) invalidateContentSwitch();
    };
    signal?.addEventListener('abort', cancelled, { once: true });
    try {
      const pack = await packLaunchGuard.run(
        operation,
        before,
        () => packs,
        () =>
          prepareOptionalDownload(summary, {
            library: before,
            signal,
            baseURL: new URL('../', location.href),
          }),
      );
      packLaunchGuard.assert(operation, packs);
      await replacePackLibrary(installPack(before, pack), {
        contentSwitchTicket: operation,
        preserveCurrentRun: true,
      });
      return pack;
    } finally {
      signal?.removeEventListener('abort', cancelled);
      if (packLaunchGuard.current(operation, packs)) {
        contentSwitchBusy = false;
        refreshContentSelectors();
        await packCommits.reconcile();
      }
    }
  }
  async function activatePack(packId, { campaignId, levelId, announce = true } = {}) {
    attemptFiles?.invalidate();
    cancelRestore();
    const operation = packLaunchGuard.begin(packs);
    packCommits.markIntent();
    contentSwitchBusy = true;
    refreshContentSelectors();
    try {
      if (!packId) {
        selectEntry(baseEntry, { levelId, contentSwitchTicket: operation });
        if (announce)
          contentStatus(t("gameplay:baseGameSelectedAndReady", { value1: contentText(campaign.levels[levelIndex], 'name') }));
        return operation;
      }
      const result = await ensureBundledPack(packId, operation);
      packLaunchGuard.assert(operation, packs);
      const source = campaignId
        ? result.pack.campaigns.find((item) => item.id === campaignId)
        : result.pack.campaigns[0];
      if (!source) throw new Error(t("interface:thisPackCampaignIsUnavailable"));
      const entry = installedEntries.find(
        (item) => item.sourcePackId === result.pack.id && item.campaign.id === source.id,
      );
      if (!entry) throw new Error(t("interface:theInstalledPackCampaignCouldNotBeSelected"));
      if (levelId) {
        const targetIndex = entry.campaign.levels.findIndex((level) => level.id === levelId);
        if (targetIndex < 0) throw new Error(t("interface:thisPackLevelIsUnavailable"));
        if (!missionAvailable(targetIndex, entry)) {
          selectEntry(entry, { contentSwitchTicket: operation });
          throw new Error(
            t("gameplay:isStillLockedTheNextAvailableLevelIsSelected", { value1: contentText(entry.campaign.levels[targetIndex], 'name') }),
          );
        }
      }
      selectEntry(entry, { levelId, contentSwitchTicket: operation });
      if (announce)
        contentStatus(
          t("gameplay:selectedAndReady", { value1: result.installed ? t("gameplay:installed3", { value1: contentText(result.pack, 'name') }) : '', value2: contentText(campaign.levels[levelIndex], 'name') }),
        );
      return operation;
    } catch (error) {
      if (!packLaunchGuard.current(operation, packs)) return false;
      contentStatus(error.message, true);
      warning(error.message);
      return false;
    } finally {
      if (packLaunchGuard.current(operation, packs)) {
        contentSwitchBusy = false;
        refreshContentSelectors();
        await packCommits.reconcile();
      }
    }
  }
  function selectLevel(levelId) {
    const index = campaign.levels.findIndex((level) => level.id === levelId);
    if (index < 0 || !missionAvailable(index)) {
      refreshContentSelectors();
      contentStatus(t("interface:thatLevelIsStillLockedCompleteTheEarlierMissionsFirst"), true);
      return false;
    }
    invalidateContentSwitch();
    leavePractice();
    campaignOverview = false;
    levelIndex = index;
    prepare();
    rememberSelection();
    contentStatus(t("gameplay:selectedAndReady2", { value1: contentText(campaign.levels[levelIndex], 'name') }));
    return true;
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
    const saved = savedAttempt();
    const savedMode = difficultyLabel(
      executionEntries().find((entry) => campaignKey(entry.campaign) === saved?.campaignKey),
    );
    const preview = practice
      ? null
      : savedFlightPreview(
          saved,
          executionEntries().map((entry) => ({
            key: campaignKey(entry.campaign),
            campaign: entry.campaign,
          })),
        );
    const atReady = !started && !practice;
    show('continue-saved', atReady && !!preview);
    show('continue-saved-note', atReady && !!preview);
    $('continue-saved').disabled = sessionBusy;
    localizedText($('continue-saved'), () =>sessionBusy
      ? t("interface:verifyingSavedFlight")
      : t("interface:loadSavedFlight"));
    localizedText($('continue-saved-note'), () =>preview
      ? `${contentText(preview, 'title')}${savedMode ? ` · ${savedMode}` : ''}. ${preview.note}`
      : '');
    localizedAttribute($('continue-saved'), "title", () => preview?.title || t("interface:loadSavedFlight2"));
  }
  function assertWriter() {
    if (courseSession) throw new Error(t("interface:trainingDoesNotWriteCampaignData"));
    if (!persistenceReady || !writer.writable)
      throw new Error(writer.reason || t("interface:storageRecoveryMustFinishBeforeSaving"));
    if (localStorage.getItem(`${libraryKey}.backup-lock`) !== null)
      throw new Error(t("interface:aBackupIsBeingRestoredSavingResumesWhenItFinishes"));
  }
  function snapshotAttempt(savedAt) {
    if (practice || !recorder || !started || ['won', 'lost'].includes(run.status))
      throw new Error(t("interface:startAnUnfinishedCampaignFlightToSaveIt"));
    return suspendSession({
      run,
      recorder,
      campaignKey: campaignKey(campaign),
      themeId: theme.id,
      bodyId,
      runId,
      savedAt,
      continuation: { direction: input.snapshotDirection() },
      presentationPins: flightPictures?.pins(),
    });
  }
  function currentBackupSession(savedAt) {
    return started && recorder && !practice && !['won', 'lost'].includes(run.status)
      ? snapshotAttempt(savedAt)
      : savedAttempt();
  }
  function snapshotCurrentBackup() {
    const savedAt = new Date().toISOString();
    return externalBackup.snapshot(() => {
      if (contentSwitchBusy || sessionBusy || backupBusy)
        throw new Error(t("interface:finishThePendingContentOrSaveOperationBeforeExporting"));
      if (started && !paused && !['won', 'lost'].includes(run.status))
        throw new Error(t("interface:pauseTheCurrentFlightBeforePreparingGameData"));
      // Capture time belongs to this export, while all actual host contents are
      // read again after waits so resumed/replaced state cannot pass as unchanged.
      return { library, packs, session: currentBackupSession(savedAt) };
    });
  }
  function persistAttempt(notify = true, { requireSuccess = false } = {}) {
    if (courseEntryHold)
      throw new Error(
        t("interface:theCourseHandoffKeepsThisFlightPausedResumeExplicitlyBefore"),
      );
    assertWriter();
    const session = snapshotAttempt();
    let saved;
    try {
      saved = saveSession(localStorage, sessionKey, session);
    } catch {
      saved = { ok: false, warning: t("interface:storageIsUnavailableExportThisAttempt") };
    }
    if (requireSuccess && !saved.ok) throw new Error(saved.warning);
    if (notify)
      warning(
        saved.ok
          ? t("interface:flightSavedLoadItFromLibrarySavesWheneverYouReturn")
          : saved.warning,
      );
    return session;
  }
  function findCampaignEntry(key) {
    let entry = executionEntries().find((e) => campaignKey(e.campaign) === key);
    if (!entry) {
      const match = /^route-(\d{4}-\d\d-\d\d)-(daily|calm|expert)\//.exec(key || '');
      if (match) {
        const c = challengeCampaign(match[1], match[2], baseClasses);
        const e = { ...baseEntry, campaign: c, activity: 'challenge' };
        if (campaignKey(c) === key) entry = e;
      }
    }
    return entry;
  }
  async function restoreAttempt(candidate) {
    if (courseSession || courseEntry)
      throw new Error(t("interface:endFirstFlightBeforeLoadingACampaignFlight"));
    if (sessionBusy) throw new Error(t("interface:aFlightIsAlreadyBeingVerified"));
    const entry = findCampaignEntry(candidate?.campaignKey);
    if (!entry) throw new Error(t("interface:installTheMatchingCampaignPackBeforeLoadingThisFlight"));
    invalidateContentSwitch();
    sessionBusy = true;
    refreshSavedFlight();
    cancelPictureStart();
    if (!paused) pause(true);
    clearInput();
    const controller = new AbortController();
    restoreController = controller;
    let stagedPictures = null;
    try {
      const restored = await restoreSession(candidate, {
        campaign: entry.campaign,
        campaignKey: campaignKey(entry.campaign),
        signal: controller.signal,
        mediaIdentityCatalog: candidate?.presentationPins ? pictureIdentity() : undefined,
        masteryDefinition:
          masteryFor(campaignKey(entry.campaign), candidate?.replay?.level?.id, masteryCatalog) ??
          undefined,
      });
      if (controller.signal.aborted)
        throw new Error(t("interface:loadingWasCancelledYourNewerSelectionIsKept"));
      stagedPictures = newFlightPictures({
        nextRun: restored.run,
        nextRunId: restored.session.runId,
        entry,
        nextThemeId: restored.session.themeId,
        pins: restored.session.presentationPins,
        legacy: !restored.session.presentationPins,
      });
      await stagedPictures.ensure(restored.session.themeId, { signal: controller.signal });
      if (controller.signal.aborted)
        throw new DOMException(t("interface:pictureRestoreCancelled"), 'AbortError');
      selectEntry(entry, {
        levelId: restored.run.levelId,
        themeId: restored.session.themeId,
        restoreAdoption: true,
        difficulty: entry.difficulty,
      });
      flightPictures?.dispose();
      flightPictures = stagedPictures;
      stagedPictures = null;
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
      localizedText($('pause-button'), () =>'▶');
      handled = false;
      recordingStopped = false;
      clearInput();
      input.restoreDirection(restored.session.continuation?.direction ?? null);
      setTheme();
      painter.setLevel?.(run.level, { seed });
      updateLoadout();
      overlay('pause');
      refreshHUD();
      warning(t("interface:savedFlightVerifiedAndRestoredPressResumeToContinue"));
    } finally {
      sessionBusy = false;
      stagedPictures?.dispose();
      if (restoreController === controller) restoreController = null;
      refreshSavedFlight();
      await packCommits.reconcile();
    }
  }
  function adoptPreferences() {
    const p = library.preferences;
    refreshTextSize();
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
    syncAssistControls();
    keySettings.refresh();
    controller.setBindings(p.controllerBindings);
    controller.setBoostMode(p.controllerBoostMode);
    controllerSettings.refresh();
    controllerBoostSettings.refresh();
    clearInput();
    refreshKeyPrompts();
    refreshControllerPrompts();
    configureAudio({
      style: p.musicGenre,
      master: p.masterVolume,
      music: p.musicVolume,
      sfx: p.sfxVolume,
    });
    if (!p.musicEnabled) muteAudio();
    themeOverride = true;
    musicOverride = true;
    prepare();
  }
  attemptFiles = createAttemptFilePreparer({
    getState: () => ({
      run,
      recorder,
      runId,
      library,
      packs,
      started,
      paused,
      practice,
      courseActive: courseSession,
      courseEntry: !!courseEntry,
      recordingStopped,
      contentBusy: contentSwitchBusy,
      sessionBusy,
      backupBusy,
      hidden: document.hidden,
      themeId: theme.id,
      bodyId,
    }),
    snapshotCurrent: () => {
      pause(true);
      return snapshotAttempt();
    },
    resolveCampaign: (key) => findCampaignEntry(key)?.campaign,
    resolveMediaIdentityCatalog: () => pictureIdentity(),
    readStored: () => localStorage.getItem(sessionKey),
    readBackupMarker: () => localStorage.getItem(`${libraryKey}.backup-lock`),
    readJournal: () => readAssetStore(journalKey),
    withStorageLock: (work, signal) =>
      navigator.locks?.request
        ? navigator.locks.request(`${libraryKey}.backup-lock`, { signal }, work)
        : work(),
  });
  const libraryPanel = attachLibraryPanel({
    focusMission,
    pictureMedia,
    assertExternalBackupSupported,
    backupPreparation: externalBackup
      ? { prepareExternalChapters: externalBackup.prepareExternalChapters }
      : undefined,
    backupSnapshot: externalBackup ? snapshotCurrentBackup : undefined,
    openStory: (request) => storyDialog.open(request),
    resolveMediaIdentityCatalog: (metadata) =>
      createBackupPictureIdentityResolver({
        baseEntries: [baseEntry],
        metadata,
      }),
    getReducedEffects: () => $('reduced-effects').checked,
    profileTransfer: isRelease
      ? {
          storage: localStorage,
          readAsset: readAssetStore,
          lockManager: navigator.locks,
          currentVersion: buildVersion,
          ...(externalBackup ? { readExternalSnapshot: externalBackup.readExternalSnapshot } : {}),
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
    executionCatalog: executionEntries,
    getMasteryCatalog: () => masteryCatalog,
    select: selectEntry,
    pause: () => pause(true),
    saved: savedAttempt,
    attemptExportSource: () => attemptFiles.source(),
    prepareAttemptFile: (options) => {
      // Do not clear an actual pending pack/restore/backup operation to make an
      // export eligible. An otherwise idle queued autoplay loses its ticket.
      if (contentSwitchBusy || sessionBusy || backupBusy)
        throw new Error(t("interface:finishThePendingContentOrSaveOperationBeforeExporting"));
      invalidateContentSwitch();
      return attemptFiles.prepare(options);
    },
    currentSession: () => currentBackupSession(),
    canSnapshotBackup: () => storedStateAdopted,
    sessionNote: () =>
      [
        !storedStateAdopted
          ? t("interface:thisExportContainsTheCurrentSessionOnlyUnreadableStoredData")
          : '',
        started && !recorder
          ? t("interface:thisFlightNoLongerHasACompleteRecordingThePrevious")
          : '',
      ]
        .filter(Boolean)
        .join(' '),
    restore: restoreAttempt,
    beforeProfileReplacement: () => {
      if (courseSession || courseEntry)
        throw new Error(t("interface:endFirstFlightBeforeReplacingPlayerData"));
      invalidateContentSwitch();
      cancelRestore();
      masteryAwards.cancelAll();
    },
    setLibrary: (next) => {
      if (courseSession || courseEntry)
        throw new Error(t("interface:endFirstFlightBeforeReplacingPlayerData"));
      invalidateContentSwitch();
      masteryAwards.cancelAll();
      library = next;
      progress = progressFor(library, campaign);
      const saved = persistProfile({ mode: 'replace' });
      const selection = currentSelection();
      levelIndex = selection.levelIndex;
      campaignOverview = !practice && selection.overview;
      adoptPreferences();
      return saved;
    },
    applyBackup: async (prepared) => {
      if (courseSession || courseEntry)
        throw new Error(t("interface:endFirstFlightBeforeImportingABackup"));
      await assertExternalBackupSupported({ kind: 'backup' });
      backupBusy = true;
      invalidateContentSwitch();
      packCommits.markIntent();
      contentSwitchBusy = true;
      let committed = false;
      try {
        refreshContentSelectors();
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
        committed = true;
        const checked = await checkedChapters();
        for (const descriptor of checked.index?.chapters ?? [])
          await externalChapters.readiness(checked, descriptor.id);
        const content = contentFromChapters(checked);
        persistenceReady = true;
        storedStateAdopted = true;
        saveSucceeded = true;
        if (result.warning) {
          localizedText($('save-warning'), () =>result.warning);
          show('save-warning', true);
        } else show('save-warning', false);
        library = result.profile.library;
        libraryBaseline = library;
        libraryGeneration = result.profile.generation;
        recovery = null;
        adoptContentCatalog(content);
        packCommits.acceptCurrent();
        selectEntry(baseEntry);
        adoptPreferences();
        refreshCampaigns();
        return result;
      } catch (error) {
        if (committed) {
          persistenceReady = false;
          storedStateAdopted = false;
          void packCommits.noteStaleCommit();
          throw new Error(
            t("gameplay:gameDataCommittedReloadAndRestoreItsExactOriginalsBefore", { value1: error.message }),
          );
        }
        throw error;
      } finally {
        backupBusy = false;
        contentSwitchBusy = false;
        refreshContentSelectors();
        await packCommits.reconcile();
      }
    },
    setPacks: replacePackLibrary,
  });
  courseView = attachFirstFlightView({
    onEnter: enterFirstFlight,
    onCancelEnter: () => cancelCourseEntry(),
    onNext: () => nextCourseLesson(),
    onSkip: () => nextCourseLesson(true),
    onSelect: selectCourseLesson,
    onExit: leaveCourse,
    getControlLabels: () => {
      const keys = bindingLabels(resolveKeyBindings(library.preferences.keyboardBindings));
      return {
        directions: t("gameplay:keysUpDownLeftRightTouchDirectionButtonsBelowThe", { value1: keys.up, value2: keys.down, value3: keys.left, value4: keys.right, value5: controllerStickLabel(library.preferences.controllerBindings, 'flight') }),
        stop: t("gameplay:stopVisibleStopController", { value1: keys.stop, value2: controllerLabels.flight.stop }),
        pause: t("gameplay:pauseVisiblePauseController", { value1: keys.pause, value2: controllerLabels.flight.pause }),
      };
    },
  });
  $('help-dialog').addEventListener('cancel', (event) => {
    if (!courseEntry) return;
    event.preventDefault();
    cancelCourseEntry();
  });
  $('help-dialog').addEventListener('close', () => {
    if (courseEntry) cancelCourseEntry();
  });
  if (courseSession) {
    document.body.classList.add('first-flight-session');
    for (const id of [
      'library-button',
      'collection-button',
      'demo-button',
      'pack-select',
      'level-select',
      'campaign-select',
      'difficulty-select',
      'class-select',
      'theme-select',
      'hangar-button',
      'shell-packs',
      'shell-collection',
    ]) {
      $(id).disabled = true;
      $(id).hidden = true;
    }
  }
  $('library-dialog').addEventListener('close', () => {
    cancelRestore();
    attemptFiles.invalidate();
  });
  $('pack-select').onchange = async () => {
    const packId = $('pack-select').value;
    if (packId.startsWith('campaign:')) return;
    await activatePack(packId);
  };
  $('level-select').onchange = () => selectLevel($('level-select').value);
  $('campaign-select').onchange = () => {
    selectEntry(catalog().find((e) => campaignKey(e.campaign) === $('campaign-select').value));
    contentStatus(t("gameplay:selectedAndReady2", { value1: contentText(campaign, 'title') || contentText(campaign, 'name') || campaign.id }));
  };
  $('difficulty-select').onchange = () => {
    if ($('difficulty-select').disabled) return;
    const mode = resolveCampaignDifficulty($('difficulty-select').value);
    clearInput();
    preferences({ campaignDifficulty: mode });
    // Saving may merge a newer preference from another writer; use the actual
    // adopted library. A setting-only change never touches the suspended slot.
    if (!started && !sessionBusy) prepare();
    else refreshDifficulty();
  };
  $('save-attempt-button').onclick = () => {
    pause(true);
    try {
      persistAttempt();
    } catch (e) {
      warning(e.message);
    }
  };
  $('hangar-button').onclick = () => {
    if (courseSession || courseEntry) return;
    pause(true);
    $('switch-class-select').replaceChildren(
      ...(scenario?.classRecipes || classRegistry).map((c) => localizedOption(() => contentText(c, 'label'), c.id)),
    );
    $('switch-class-select').value = run.activeClassId || classId;
    localizedText($('switch-description'), () =>contentText(run.classRecipe, 'description'));
    localizedText($('switch-status'), () =>t("interface:yourFlightIsPausedWhileChoosing"));
    $('hangar-dialog').showModal();
  };
  $('switch-class-select').onchange = () => {
    localizedText($('switch-description'), () =>(scenario?.classRecipes || classRegistry).find((c) => c.id === $('switch-class-select').value)
        ?.description || '');
  };
  $('switch-class-button').onclick = () => {
    if (courseSession || courseEntry) return;
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
    if (defeatActive) {
      finishDefeatPresentation();
      return;
    }
    painter.skipCelebration?.();
    celebrationActive = false;
    show('skip-celebration', false);
    show('game-overlay', false);
    show('show-result', true);
  };
  $('settings-button').onclick = () => {
    pause(true);
    syncAssistControls();
    controllerSettings.refresh();
    controllerBoostSettings.refresh();
    $('settings-dialog').showModal();
    void storageRetention.refresh();
  };
  let offlinePrepared = false;
  const offline = offlineAvailability();
  show('offline-button', offline.available);
  show('native-diagnostics', nativePlatform() === 'ios');
  localizedText($('offline-status'), () =>offline.available
    ? t("interface:downloadThisReleaseForOfflinePlayOnThisDevice")
    : offline.reason);
  $('offline-button').onclick = async () => {
    $('offline-button').disabled = true;
    try {
      const result = await (offlinePrepared ? checkOffline : prepareOffline)({
        onStatus: (s) => {
          localizedText($('offline-status'), () =>s.message || String(s));
        },
      });
      localizedText($('offline-status'), () =>`${result.message || result.status}${result.verified ? t("gameplay:filesVerified", { value1: result.verified }) : ''}`);
      localizedText($('offline-details'), () =>JSON.stringify(result, null, 2));
      offlinePrepared = result.status === 'ready' || result.status === 'waiting';
      localizedText($('offline-button'), () =>offlinePrepared
        ? t("interface:verifyOfflineFiles")
        : t("interface:prepareOfflinePlay"));
    } catch (e) {
      localizedText($('offline-status'), () =>e.message);
    } finally {
      $('offline-button').disabled = false;
    }
  };
  function tuneMusic(event) {
    if (event?.target.id === 'music-select' && !soundtrackPlayer) {
      musicOverride = true;
      assignMusic(
        DEFAULT_TRACKS.find((t) => t.genre === $('music-select').value),
        { atBoundary: false },
      );
    }
    configureAudio({
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
      const ok = soundtrackPlayer
        ? await activateAudio({ explicit: true })
        : await sound.preview({ seconds: 4 });
      localizedText($('music-preview'), () =>ok ? t("interface:soundtrackPlaying") : t("interface:audioIsUnavailable"));
      if (ok) {
        preferences({ musicEnabled: true });
        $('sound-button').setAttribute('aria-pressed', 'true');
        localizedAttribute($('sound-button'), "aria-label", () => t("interface:muteSound"));
      }
    } catch (e) {
      warning(e.message);
    }
  };
  $('settings-dialog').addEventListener('close', () => {
    if (!$('settings-dialog').open) storageRetention.close();
    sound.pause();
    controllerSettings.refresh();
    controllerBoostSettings.refresh();
  });
  $('match-class-appearance').onchange = () => {
    preferences({ matchClassAppearance: $('match-class-appearance').checked });
    setTheme();
  };
  $('terrain-select').onchange = () => {
    preferences({ style: $('terrain-select').value });
    setTheme();
  };
  $('screen-controls').onchange = () => {
    clearInput();
    preferences({ screenControls: $('screen-controls').value });
    syncAssistControls();
    refreshInputPresentation();
  };
  $('text-size').onchange = () => preferences({ textSize: $('text-size').value });
  for (const key of ['mode', 'side', 'size', 'opacity']) {
    $(`touch-${key}`).onchange = () => {
      clearInput();
      preferences({
        touchControls: {
          ...resolveTouchControls(library.preferences.touchControls),
          [key]: key === 'opacity' ? Number($(`touch-${key}`).value) : $(`touch-${key}`).value,
        },
      });
      syncAssistControls();
    };
  }
  function refreshTextSize() {
    const size = library.preferences.textSize;
    $('text-size').value = size;
    document.body.dataset.textSize = size;
  }
  $('settings-grid').onchange = () => preferences({ showGrid: $('settings-grid').checked });
  function syncAssistControls() {
    $('settings-reduced-effects').checked = $('reduced-effects').checked;
    $('settings-tap-steering').checked = $('tap-steering').checked;
    $('screen-controls').value = library.preferences.screenControls;
    const touch = resolveTouchControls(library.preferences.touchControls);
    for (const key of ['mode', 'side', 'size', 'opacity']) $(`touch-${key}`).value = touch[key];
    document.body.dataset.touchMode = touch.mode;
    document.body.dataset.touchSide = touch.side;
    document.body.dataset.touchSize = touch.size;
    document.body.style.setProperty('--touch-opacity', touch.opacity);
    localizedText($('touch-instruction'), () =>touch.mode === 'swipe' ? t("interface:swipeToTurn") : t("interface:dragToSteer"));
  }
  for (const id of ['reduced-effects', 'settings-reduced-effects']) {
    $(id).onchange = () => {
      preferences({ reducedEffects: $(id).checked });
      $('reduced-effects').checked = library.preferences.reducedEffects;
      syncAssistControls();
    };
  }
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
      const candidate = characterPresentations.recommendedBody(
        theme,
        run?.activeClassId || classId,
        theme.player,
      );
      bodyId =
        Object.hasOwn(presets.characters, candidate) &&
        (practice || availableBodies().has(candidate))
          ? candidate
          : 'neutral-marker';
    }
    bodyWarning = '';
    if (!Object.hasOwn(presets.characters, bodyId)) {
      bodyWarning = t("gameplay:bodyIsNotRegisteredUsingTheNeutralRigChooseA", { value1: bodyId });
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
    localizedText($('theme-caption'), () =>`${contentText(theme, 'name').toUpperCase()} / ${contentText(theme, 'subtitle').toUpperCase()}`);
    localizedText($('score-label'), () =>contentText(theme, 'labels.currency').toUpperCase());
    localizedText($('pickup-button').firstChild, () =>contentText(theme, 'labels.supply') + ' ');
    localizedAttribute($('action-button'), "title", () => contentText(theme, 'labels.ability'));
    localizedText($('world-legend'), () =>`${contentText(theme, 'labels.enemy')} · ${contentText(theme, 'labels.boss')} · ${contentText(theme, 'labels.supply')}`);
    localizedText($('footer-note'), () =>theme.id === 'coupa'
        ? t("interface:fictionalSpendManagementThemeOriginalHelperArtwork")
        : t("interface:originalWorldsMakeEveryLineCount"));
    painter.style = scenario?.presentation?.style || library.preferences.style;
    updateBodies();
    painter.setLook(theme, bodyId, visuals());
    soundtrackPlayer?.setContext(soundtrackContext());
  }
  function updateBodies() {
    const allowed = availableBodies();
    $('body-select').replaceChildren();
    for (const [id, body] of Object.entries(presets.characters)) {
      const option = localizedOption(() => `${contentText(body, 'label')}${allowed.has(id) || practice ? '' : ' · ' + t('common:status.locked')}`,
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
    const next = currentAppearanceMilestones().find((tier) => !tier.earned);
    localizedText($('appearance-hint'), () =>practice
      ? t("interface:previewAccessAllAppearancesAreAvailablePracticeGrantsNoCampaign")
      : next
        ? t("gameplay:differentMissionsInThisCampaignSeeCollectionForTheAppearances", { value1: contentText(next, 'name'), value2: next.count, value3: next.target })
        : t("interface:allChapterAppearancesAreAvailableInThisCampaignCosmeticsDo"));
  }
  const bodyLabels = (ids) => ids.map((id) => presets.characters[id]?.label || id);
  function paintAppearanceRewards(entry) {
    const selected = entry.campaign;
    const name = selected.title || selected.name || selected.id;
    localizedText($('appearance-campaign'), () =>t("gameplay:campaignAppearances", { value1: name }));
    $('appearance-rewards').replaceChildren();
    for (const tier of difficultyNavigation.milestones(
      entry,
      library.campaigns,
      progressFor(library, selected),
    )) {
      const row = document.createElement('article');
      row.className = `appearance-reward${tier.earned ? ' earned' : ''}`;
      const thumbnail = document.createElement('img');
      localizedAttribute(thumbnail, "alt", () => '');
      thumbnail.width = thumbnail.height = 64;
      const body = presets.characters[tier.bodyIds[0]];
      if (body?.src)
        thumbnail.src = new URL(`../authoring/motion-lab/${body.src}`, import.meta.url).href;
      const copy = document.createElement('div');
      const title = document.createElement('h4');
      localizedText(title, () =>contentText(tier, 'name'));
      const state = document.createElement('p');
      state.className = 'reward-progress';
      localizedText(state, () =>t("gameplay:different", { value1: tier.earned ? t("interface:available") : t("interface:locked"), value2: Math.min(tier.count, tier.target), value3: tier.target, value4: tier.target === 1 ? 'mission' : 'missions' }));
      const names = document.createElement('p');
      localizedText(names, () =>bodyLabels(tier.bodyIds).join(' · '));
      const detail = document.createElement('p');
      detail.className = 'reward-detail';
      const remaining = tier.target - tier.count;
      localizedText(detail, () =>tier.earned
        ? t("interface:availableInThisCampaign")
        : t("gameplay:finishMoreInThisCampaign", { value1: remaining, value2: remaining === 1 ? 'mission' : 'missions' }));
      copy.append(title, state, names, detail);
      row.append(thumbnail, copy);
      $('appearance-rewards').append(row);
    }
    localizedText($('collection-note'), () =>practice
      ? t("interface:practicePreviewsEveryAppearanceWithoutEarningRewardsTheseRowsShow")
      : t("gameplay:appearancesBelongToThisCampaignCosmeticsDoNotChangeAbilities", { value1: difficultyLabel(entry) ? (" " + t("interface:standardAndGentleShareMissionAndAppearanceUnlocks") + "") : '' }));
  }
  function focusAppearance() {
    if ($('collection-dialog').open) $('collection-dialog').close();
    gameShell?.openMissions();
    missionPicker?.revealSetup();
    $('body-select').focus({ preventScroll: true });
    $('body-select').scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  function leavePractice() {
    if (courseSession || courseEntry) return;
    scenario = null;
    practice = practiceSession;
    demo = false;
    campaignOverview = false;
    theme = themesFile.themes.find((t) => t.id === theme.id) || themesFile.themes[0];
    if (!classRegistry.some((c) => c.id === classId)) classId = classRegistry[0].id;
    bodyId = availableBodies().has(bodyId) ? bodyId : theme.player;
    $('class-select').replaceChildren(...classRegistry.map((c) => localizedOption(() => contentText(c, 'label'), c.id)));
    $('theme-select').replaceChildren(...themesFile.themes.map((t) => localizedOption(() => contentText(t, 'name'), t.id)));
    $('theme-select').value = theme.id;
    setTheme();
  }
  function paintMissions() {
    $('missions').replaceChildren();
    if (courseSession) {
      localizedText($('campaign-progress'), () =>t("gameplay:lessonsThisVisit", { value1: Object.values(courseVisit).filter((value) => value === 'complete').length, value2: FIRST_FLIGHT_LESSONS.length }));
      return;
    }
    campaign.levels.forEach((level, index) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mission${index === levelIndex && !practice && !campaignOverview ? ' selected' : ''}`;
      b.disabled = !missionAvailable(index);
      b.dataset.level = String(index);
      localizedAttribute(b, "aria-label", () => `${index + 1}. ${contentText(level, 'name')}${b.disabled ? ' — ' + t('common:status.locked') : ''}`);
      const number = document.createElement('span');
      number.className = 'number';
      localizedText(number, () =>String(index + 1).padStart(2, '0'));
      const name = document.createElement('span');
      name.className = 'name';
      localizedText(name, () =>contentText(level, 'name'));
      const medal = document.createElement('span');
      medal.className = 'medal';
      localizedText(medal, () =>progress.clears[level.id]
        ? '★'.repeat(progress.clears[level.id].medals)
        : difficultyNavigation.access(activeEntry, library.campaigns)?.levels[index]?.completed
          ? '✓'
          : b.disabled
            ? '—'
            : '↗');
      b.append(number, name, medal);
      b.onclick = () => {
        if (courseEntry) return;
        leavePractice();
        levelIndex = index;
        prepare();
        rememberSelection();
        focusMission();
      };
      $('missions').append(b);
    });
    localizedText($('campaign-progress'), () =>`${String(currentSelection().completed).padStart(2, '0')} / ${String(campaign.levels.length).padStart(2, '0')}${difficultyLabel(activeEntry) ? t("gameplay:medals", { value1: difficultyLabel(activeEntry) }) : ''}`);
    refreshContentSelectors();
  }
  function updateLoadout() {
    const recipe =
      run?.classRecipe || (scenario?.classRecipes || classRegistry).find((c) => c.id === classId);
    localizedText($('class-description'), () =>contentText(recipe, 'description'));
    const actions = arcadeActionCapabilities(run?.level);
    localizedText($('action-button').firstChild, () =>`${recipe.id === 'scout' ? t("interface:scan") : contentText(recipe, 'label')} `);
    show('action-button', actions.manualAbility);
    show(
      'pickup-button',
      actions.manualPickup && !!run?.ability.capacity && !!run?.supplies?.length,
    );
    show('boost-button', actions.manualBoost);
    show('screen-boost-setting', actions.manualBoost);
    show('controller-boost-setting', actions.manualBoost);
    show('ability-state', actions.manualAbility);
    localizedText($('equipment-help'), () =>actions.manualAbility
      ? t("interface:thisEditionUsesManualEquipmentScoutScanRevealsNearbyObjectives")
      : t("interface:arcadeSteerAndCloseLinesTheMapSetsYourCraft"));
    localizedText($('line-danger-help'), () =>run?.level.classic?.lineImpact
      ? t("interface:anEnemyStrikingYourUnfinishedLineSendsImpactsAlongIt")
      : t("interface:aFieldEnemyTouchingYourUnfinishedLineOrCrossingYour"));
    refreshKeyPrompts();
    refreshControllerPrompts();
    $('class-select').value = classId;
    $('turn-select').value = turnPolicy;
  }
  function focusMission() {
    $('arena-shell').scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    (campaignOverview ? $('next-button') : $('start-button')).focus({ preventScroll: true });
  }
  function currentBriefing() {
    if (courseSession) {
      const lesson = getFirstFlightLesson(courseRequest.lessonId);
      return {
        title: contentText(lesson, 'title'),
        copy: contentText(lesson, 'summary'),
        fullTitle: t("gameplay:firstFlight", { value1: contentText(lesson, 'title') }),
        fullBrief: [
          contentText(lesson, 'summary'),
          ...lesson.instructions.map((_, i) => contentText(lesson, `instructions.${i}`)),
          ...lesson.steps.map((step) => `${contentText(step, 'label')}: ${contentText(step, 'instruction')}`),
        ].join('\n\n'),
        facts:
          t("interface:optionalTrainingScoutThreeLivesNoMissionDeadlineNoCampaign"),
        status: contentText(lesson, 'instructions.0'),
      };
    }
    return missionBriefing(scenario?.level || campaign.levels[levelIndex], {
      brief: scenario ? undefined : contentText(campaign, `briefs.${levelIndex}`),
      objectiveLabel: contentText(theme, 'labels.objective'),
      classes: scenario?.classRecipes || classRegistry,
      intro:
        !practice &&
        !activeEntry.sourcePackId &&
        (activeEntry.baseCampaign || campaign).id === baseCampaign.id &&
        levelIndex === 0,
    });
  }
  function refreshMissionBrief() {
    const brief = currentBriefing();
    localizedText($('mission-brief-title'), () =>brief.fullTitle);
    localizedText($('mission-brief-copy'), () =>brief.fullBrief);
    localizedText($('mission-brief-facts'), () =>brief.facts);
    refreshMastery();
    return brief;
  }
  function refreshMastery() {
    const visible = !!masteryDefinition && !campaignOverview;
    show('mastery-brief', visible);
    show('mastery-status', visible && $('game-overlay').hidden);
    const kind = $('game-overlay').dataset.kind;
    show('mastery-overlay', visible && ['ready', 'won', 'lost'].includes(kind));
    if (!visible) return;
    const preview = masteryObserver?.snapshot();
    for (const id of ['mastery-status', 'mastery-overlay']) {
      const text = masteryText(masteryDefinition, preview, {
        practice,
        award: masteryAward,
        compact: id === 'mastery-status',
      });
      if ($(id).textContent !== text) localizedText($(id), () =>text);
    }
    localizedText($('mastery-brief'), () =>t("gameplay:optionalSealYourPictureAndNextMissionNeverDependOn", { value1: contentText(masteryDefinition, 'name'), value2: contentText(masteryDefinition, 'description') }));
  }
  function overlay(kind) {
    $('game-overlay').dataset.kind = kind;
    show('pause-label', kind === 'pause');
    show('overlay-reading', kind !== 'pause');
    show('overlay-footnote', kind !== 'pause');
    $('game-overlay').dataset.intro = String(
      kind === 'ready' &&
        !practice &&
        !activeEntry.sourcePackId &&
        (activeEntry.baseCampaign || campaign).id === baseCampaign.id &&
        levelIndex === 0,
    );
    show('game-overlay', true);
    show('show-result', false);
    show('view-picture', kind === 'won');
    victoryStoryButton.hidden =
      kind !== 'won' ||
      practice ||
      !!completionWarning ||
      !flightPictures?.pins() ||
      !storyPinForTheme(flightPictures.pins(), theme.id);
    show('next-button', kind === 'won' || kind === 'campaign-complete');
    show('choose-mission', kind === 'campaign-complete');
    show('retry-button', kind === 'won' || kind === 'lost');
    show('start-button', kind === 'ready' || kind === 'pause');
    show('overlay-restart', kind === 'pause');
    show('overlay-brief', !courseSession && (kind === 'ready' || kind === 'pause'));
    show('result-medals', kind === 'won');
    show('retry-consequence', false);
    localizedText($('retry-consequence'), () =>'');
    const newAppearance = kind === 'won' && !practice && appearanceRewardIds.length > 0;
    show('appearance-unlock', newAppearance);
    show('choose-appearance', newAppearance);
    localizedText($('appearance-unlock'), () =>newAppearance
      ? t("gameplay:newAppearancesFor", { value1: contentText(campaign, 'title') || contentText(campaign, 'name') || campaign.id, value2: bodyLabels(appearanceRewardIds).join(' · ') })
      : '');
    localizedText($('overlay-eyebrow'), () =>practice
      ? t("interface:practiceNoCampaignRewards")
      : t("gameplay:mission", { value1: String(levelIndex + 1).padStart(2, '0'), value2: contentText(run.level, 'name').toUpperCase() }));
    if (kind === 'ready') {
      const brief = refreshMissionBrief();
      localizedText($('overlay-eyebrow'), () =>practice
        ? t("interface:practiceNoCampaignRewards")
        : t("gameplay:mission2", { value1: String(levelIndex + 1).padStart(2, '0') }));
      localizedText($('overlay-title'), () =>$('game-overlay').dataset.intro === 'true' ? t("interface:clearAPathRevealAWorld2") : contentText(brief, 'title'));
      localizedText($('overlay-copy'), () =>brief.copy);
      localizedText($('start-button'), () =>t("interface:startMission2"));
      if (
        !practice &&
        !Object.hasOwn(progress.clears, run.levelId) &&
        Object.keys(progress.clears).length
      )
        localizedText($('start-button'), () =>t("interface:continueCampaign"));
      refreshKeyPrompts();
    }
    if (kind === 'campaign-complete') {
      const completion = currentSelection();
      localizedText($('overlay-eyebrow'), () =>t("interface:campaignComplete"));
      localizedText($('overlay-title'), () =>t("interface:everyMissionRevealed"));
      localizedText($('overlay-copy'), () =>t("gameplay:missionsCompleteEnjoyYourCollectionChooseAMissionToReplay", { value1: contentText(campaign, 'title') || contentText(campaign, 'name') || campaign.id, value2: completion.completed, value3: completion.total }));
      localizedText($('next-button'), () =>t("interface:viewCollection"));
      localizedText($('overlay-footnote'), () =>t("interface:yourEarnedPicturesAndBestResultsAreKept"));
    }
    if (kind === 'pause') {
      localizedText($('overlay-title'), () =>t("interface:paused"));
      localizedText($('overlay-copy'), () =>'');
      localizedText($('start-button'), () =>t("interface:resume"));
      localizedText($('overlay-footnote'), () =>'');
    }
    if (kind === 'won') {
      localizedText($('overlay-title'), () =>t("interface:aLittleMoreLight"));
      localizedText($('overlay-copy'), () =>t("gameplay:capturedPoints", { value1: formatNumber(run.coverage * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), value2: formatNumber(run.score), value3: timeLabel(run.time), value4: practice ? t("interface:practiceComplete") : completionWarning || (saveSucceeded ? t("interface:fullPictureAddedToYourCollection") : t("interface:pictureCollectedForThisSessionExportYourLibraryToKeep")) }));
      localizedText($('result-medals'), () =>'★'.repeat(
        run.medal === 'gold' ? 3 : run.medal === 'silver' ? 2 : 1,
      ));
      localizedText($('next-button'), () =>practice
        ? t("interface:tryItYourself")
        : currentSelection().complete
          ? t("interface:campaignComplete2")
          : t("interface:nextUnclearedMission"));
      localizedText($('overlay-footnote'), () =>practice
        ? t("interface:demonstrationsAndImportedMapsDoNotGrantUnlocks")
        : run.medal === 'gold'
          ? t("interface:goldFastAndNoLivesLost")
          : t("interface:tryAnotherClassOrReturnForACleanFasterRoute"));
    }
    if (kind === 'lost') {
      const explanation = retryExplanation(run, { practice });
      localizedText($('overlay-title'), () =>t("interface:aNewLineAwaits"));
      localizedText($('overlay-copy'), () =>[
        explanation?.reason,
        t("gameplay:youRevealed", { value1: formatNumber(run.coverage * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }),
        explanation?.tip,
      ]
        .filter(Boolean)
        .join(' '));
      localizedText($('retry-button'), () =>t("interface:tryAgain2"));
      localizedText($('retry-consequence'), () =>explanation?.footnote || '');
      show('retry-consequence', !!explanation);
      localizedText($('overlay-footnote'), () =>'');
    }
    if (courseSession) {
      const lesson = getFirstFlightLesson(courseRequest.lessonId);
      const snapshot = courseSnapshot();
      localizedText($('overlay-eyebrow'), () =>t("interface:firstFlightOptionalTraining"));
      show('next-button', false);
      show('result-medals', false);
      if (kind === 'ready') {
        localizedText($('overlay-title'), () =>contentText(lesson, 'title'));
        localizedText($('start-button'), () =>t("interface:startLesson"));
        localizedText($('overlay-footnote'), () =>t("interface:takeYourTimeTrainingGrantsNoCampaignRewardsYouCan"));
      } else if (kind === 'won') {
        localizedText($('overlay-title'), () =>snapshot?.outcome === 'complete' ? t("interface:lessonComplete") : t("interface:pictureRevealed"));
        localizedText($('overlay-copy'), () =>snapshot?.outcome === 'complete'
            ? t("interface:youDemonstratedThisLessonInTheRealGameEnjoyThe")
            : t("interface:youRevealedThePictureButThisRouteDidNotDemonstrate"));
        localizedText($('retry-button'), () =>t("interface:repeatLesson"));
        localizedText($('overlay-footnote'), () =>t("interface:trainingResultsStayInThisVisitNoCampaignScoresPictures"));
      }
    }
    refreshSavedFlight();
    refreshMastery();
    refreshCourse();
    refreshDifficulty();
    controllerReading?.refresh();
    if (!controllerDialog()) controllerFocus()?.focus({ preventScroll: true });
  }
  function prepare({ restoreAdoption = false, contentSwitchTicket = null, difficulty } = {}) {
    if (courseEntry || (courseSession && ['leaving', 'ended'].includes(coursePhase))) return;
    attemptFiles?.invalidate();
    if (contentSwitchTicket) packLaunchGuard.assert(contentSwitchTicket, packs);
    else invalidateContentSwitch({ announce: true });
    courseEntryHold = false;
    courseEntryMessage = '';
    if (courseSession) coursePhase = 'ready';
    if (!restoreAdoption) {
      cancelRestore();
      applyNextDifficulty(difficulty);
    }
    cancelPictureStart();
    storyDialog.close();
    if (!restoreAdoption) {
      flightPictures?.dispose();
      flightPictures = null;
    }
    legacyPictureButton.hidden = true;
    completionWarning = '';
    appearanceRewardIds = [];
    celebrationActive = false;
    defeatActive = false;
    defeatPaused = false;
    defeatRemaining = 0;
    localizedText($('skip-celebration'), () =>t("interface:keepPicture"));
    sound.reset?.();
    painter.skipCelebration?.();
    show('skip-celebration', false);
    clearInput({ resetDirection: true });
    run = createRun(scenario?.level || campaign.levels[levelIndex], {
      seed,
      turnPolicy,
      classId,
      classRecipes: scenario?.classRecipes || classRegistry,
    });
    runId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    courseObserver = null;
    courseUnavailable = null;
    if (courseSession)
      try {
        courseObserver = createLessonObserver({
          lessonId: courseRequest.lessonId,
          runId,
          initial: captureLessonFacts(run, { runId }),
        });
      } catch {
        stopCourseGuidance();
      }
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
    masteryDefinition = courseSession
      ? null
      : explicitPractice
        ? scenario.masteryDefinition
        : observedCampaign
          ? masteryFor(campaignKey(observedCampaign), run.levelId, masteryCatalog)
          : null;
    masteryObserver = null;
    masteryAward = null;
    localizedText($('mastery-announcement'), () =>'');
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
            t("interface:theOptionalGoalIsUnavailableForThisConfigurationYouCan"),
        };
      }
    const authoredLevel = scenario?.level || campaign.levels[levelIndex];
    if (!scenario && !themeOverride) {
      theme =
        themesFile.themes.find((t) => t.id === (authoredLevel.themeId || campaign.themeId)) ||
        themesFile.themes[0];
      if (
        library.preferences.matchClassAppearance ||
        !Object.hasOwn(presets.characters, bodyId) ||
        (!practice && !availableBodies().has(bodyId))
      )
        bodyId = theme.player;
      $('theme-select').value = theme.id;
    }
    if (!scenario && !musicOverride) {
      const track = activeEntry.music?.find(
        (m) => m.id === (authoredLevel.musicId || campaign.musicId),
      );
      if (track) {
        assignMusic(track);
        $('music-select').value = track.genre;
      }
    }
    if (scenario?.music) assignMusic(scenario.music);
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
    localizedText($('mode-caption'), () =>courseSession
      ? t("interface:firstFlightOptionalTraining")
      : practice
        ? t("interface:playgroundPractice")
        : `${contentText(campaign, 'title') || contentText(campaign, 'name') || campaign.id}${difficultyLabel(activeEntry) ? ` · ${difficultyLabel(activeEntry)}` : ''} · ${String(levelIndex + 1).padStart(2, '0')} / ${campaign.levels.length}`);
    localizedText($('campaign-name'), () =>courseSession
      ? t("interface:firstFlightLearnByPlaying")
      : t("gameplay:campaign", { value1: contentText(campaign, 'title') || contentText(campaign, 'name') || campaign.id }));
    updateLoadout();
    refreshMissionBrief();
    paintMissions();
    overlay(campaignOverview && !practice ? 'campaign-complete' : 'ready');
    warning(
      courseSession
        ? contentText(getFirstFlightLesson(courseRequest.lessonId), 'instructions.0')
        : practice
          ? t("interface:practiceUsesTheSameSimulationCampaignAwardsAreDisabled")
          : campaignOverview
            ? t("interface:campaignCompleteViewYourCollectionOrChooseAMissionTo")
            : currentBriefing().status,
    );
    if (!restoreAdoption) {
      flightPictures = newFlightPictures();
      warmPicture();
    }
    refreshHUD();
  }
  function resume({ alignCourseBoard = true, contentSwitchTicket = null } = {}) {
    if (courseBlocked()) return;
    if (!run || (campaignOverview && !practice) || ['won', 'lost'].includes(run.status)) return;
    attemptFiles?.invalidate();
    if (contentSwitchTicket) packLaunchGuard.assert(contentSwitchTicket, packs);
    else invalidateContentSwitch({ announce: true });
    cancelRestore();
    // Enable audio on the original gesture, before any storage/decode await.
    (library.preferences.musicEnabled ? activateAudio() : muteAudio())?.catch?.(() => {});
    if (!flightPictures?.ready(theme.id)) {
      if (pictureResume) return;
      const owner = flightPictures,
        ticket = ++pictureGeneration,
        selectedRun = run,
        selectedTheme = theme.id;
      pictureResume = ticket;
      paused = true;
      clearInput();
      warning(picturePreparingMessage);
      void owner
        .ensure(selectedTheme)
        .then(() => {
          if (
            pictureResume !== ticket ||
            pictureGeneration !== ticket ||
            owner !== flightPictures ||
            run !== selectedRun ||
            theme.id !== selectedTheme ||
            document.hidden ||
            !document.hasFocus() ||
            dialogOpen() ||
            courseBlocked()
          )
            return;
          pictureResume = null;
          resume({ alignCourseBoard, contentSwitchTicket });
        })
        .catch((error) => {
          if (pictureResume === ticket) pictureFailure(error);
        })
        .finally(() => {
          if (pictureResume === ticket) pictureResume = null;
        });
      return;
    }
    pictureResume = null;
    legacyPictureButton.hidden = true;
    clearInput();
    neutralResumeTick = true;
    courseEntryHold = false;
    courseEntryMessage = '';
    if (!started) rememberSelection();
    started = true;
    paused = false;
    if ($('run-message').textContent === picturePreparingMessage) warning(t("interface:pictureReady"));
    (library.preferences.musicEnabled ? activateAudio() : muteAudio())?.catch?.(() => {});
    show('game-overlay', false);
    show('continue-saved-note', false);
    $('game-canvas').focus({ preventScroll: true });
    localizedText($('pause-button'), () =>'Ⅱ');
    refreshCourse();
    refreshHUD();
    if (courseSession && alignCourseBoard) revealFirstFlightBoard($('arena-shell'));
  }
  function finishDefeatPresentation() {
    if (!defeatActive) return;
    defeatActive = false;
    defeatPaused = false;
    defeatRemaining = 0;
    clearInput();
    show('skip-celebration', false);
    overlay('lost');
    warning(t("interface:flightEndedReadTheDetailsOrTryAgain"));
  }
  function defeatEffectsRunning() {
    return (
      defeatActive && !defeatPaused && !document.hidden && document.hasFocus() && !dialogOpen()
    );
  }
  function advanceDefeatPresentation(dt) {
    if (!defeatEffectsRunning()) return;
    defeatRemaining = Math.max(0, defeatRemaining - Math.max(0, Math.min(0.1, dt)));
    if (defeatRemaining <= 1e-9) finishDefeatPresentation();
  }
  function pause(force) {
    cancelPictureStart();
    if (courseBlocked()) {
      clearInput();
      paused = true;
      sound.pause();
      return;
    }
    if (defeatActive) {
      defeatPaused = true;
      clearInput();
      warning(t("interface:defeatPresentationPausedChooseShowDefeatMenuWhenReady"));
      return;
    }
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
    if (!practice && !courseEntryHold && recorder && !sessionBusy) {
      try {
        persistAttempt(false);
      } catch {}
    }
    overlay('pause');
    localizedText($('pause-button'), () =>'▶');
    refreshHUD();
  }
  function refreshHUD() {
    show(
      'pause-button',
      started &&
        !paused &&
        !courseBlocked() &&
        !campaignOverview &&
        !celebrationActive &&
        !defeatActive &&
        !['won', 'lost'].includes(run.status),
    );
    localizedText($('shell-edition'), () =>courseSession
      ? t("interface:firstFlight2")
      : practice
        ? t("interface:practice")
        : !arcadeActionCapabilities(run?.level).manualAbility
          ? t("interface:arcadeEdition")
          : t("interface:tacticalEdition"));
    document.body.dataset.pictureState = flightPictures?.ready(theme.id) ? 'ready' : 'pending';
    document.body.dataset.flightState =
      defeatActive || celebrationActive || (run.status === 'won' && !$('show-result').hidden)
        ? 'picture'
        : campaignOverview || ['won', 'lost'].includes(run.status)
          ? 'result'
          : !started
            ? 'briefing'
            : paused
              ? 'paused'
              : 'running';
    localizedText($('coverage'), () => formatNumber(run.coverage * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%');
    $('coverage-bar').style.width = `${run.coverage * 100}%`;
    $('goal-marker').style.left = `${run.level.goal.coverage * 100}%`;
    localizedText($('target'), () =>t("gameplay:target", { value1: Math.round(run.level.goal.coverage * 100) }));
    localizedText($('lives'), () =>run.lives > 3 ? `◆ ×${run.lives}` : '◆ '.repeat(run.lives).trim() || '—');
    localizedAttribute($('lives'), "aria-label", () => t("gameplay:lives", { value1: run.lives }));
    localizedText($('time'), () =>timeLabel(run.time));
    localizedText($('score'), () =>String(run.score).padStart(5, '0'));
    const required = run.objectives.filter((o) => o.required),
      done = required.filter((o) => o.captured);
    localizedText($('objective-state'), () =>campaignOverview
      ? t("interface:chooseAMissionToReplay")
      : run.status === 'won'
        ? t("interface:targetReached")
        : run.status === 'lost'
          ? t("interface:retryWhenYouAreReady")
          : required.length
            ? `${contentText(theme, 'labels.objective')}: ${done.length} / ${required.length}`
            : t("interface:closeALineToRevealThePicture"));
    localizedText($('flight-state'), () =>campaignOverview
      ? t("interface:campaignComplete3")
      : run.status === 'won'
        ? t("interface:missionComplete")
        : run.status === 'lost'
          ? t("interface:flightEnded")
          : run.status === 'respawning'
            ? t("interface:recovering")
            : !started
              ? t("interface:readyForLaunch")
              : paused
                ? t("interface:paused")
                : run.player.cutting
                  ? run.player.speed === 0
                    ? t("interface:lineExposedChooseATurn")
                    : t("interface:liveLineExposed")
                  : t("interface:safeGround"));
    $('status-dot').style.background = run.player.cutting ? 'var(--danger)' : 'var(--safe)';
    const left = Math.max(0, run.ability.cooldownUntil - run.time);
    localizedText($('ability-state'), () =>`${left > 0 ? left.toFixed(1) + 's cooldown' : run.ability.capacity && run.ability.ammo === 0 ? t("interface:emptyRefillAtSupply") : t("common:status.ready")}${run.ability.capacity ? ' · ' + run.ability.ammo + '/' + run.ability.capacity + ' charges' : ''}`);
    $('hangar-button').disabled =
      courseSession || !!courseEntry || campaignOverview || ['won', 'lost'].includes(run.status);
    $('restart-button').disabled = defeatActive || courseBlocked() || campaignOverview;
    $('restart-button').hidden = !started || ['won', 'lost'].includes(run.status);
    refreshInputPresentation();
    $('pause-button').disabled = courseBlocked() || campaignOverview;
    $('save-attempt-button').disabled =
      !started || practice || ['won', 'lost'].includes(run.status);
    const near = run.hangars?.some(
      (h) => Math.hypot(h.x - run.player.x, h.y - run.player.y) <= h.radius,
    );
    localizedText($('hangar-state'), () =>courseSession
      ? t("interface:scoutFixedLessonCraftNoHangarsInTraining")
      : run.signal?.zoneIds?.length
        ? run.signal.resistant
          ? t("interface:fiberLinkSignalZoneBypassedLineRemainsVulnerable")
          : t("interface:signalInterferenceSlowerMovementOrDisabledEquipment")
        : `${contentText(run.classRecipe, 'label')}${near && !run.player.cutting ? ' · Hangar in range' : (" " + t("interface:returnToAHangarToChangeCraft") + "")}`);
    if (run.rules.timeLimitSeconds)
      localizedText($('time'), () =>timeLabel(Math.max(0, run.rules.timeLimitSeconds - run.time)));
    const encounter = encounterView(run),
      classic = classicView(run);
    show('encounter-status', !!(encounter || classic) && !campaignOverview);
    $('encounter-status').dataset.kind = encounter ? 'encounter' : 'classic';
    localizedText($('encounter-title'), () =>contentText(encounter, 'title') || t("interface:classicField"));
    localizedText($('encounter-instruction'), () =>contentText(encounter, 'instruction') || '');
    show('encounter-instruction', !!encounter);
    localizedText($('classic-summary'), () =>contentText(classic, 'summary') || '');
    show('classic-summary', !!classic);
    $('encounter-status').dataset.phase =
      encounter?.phase ||
      (classic?.enemies.some((enemy) => enemy.mode === 'warning') ? 'warning' : 'open');
    refreshMastery();
    refreshCourse();
  }
  function eventFeedback(events) {
    for (const event of events) {
      sound.event(event);
      if (event.type === 'class.switched') {
        updateLoadout();
        setTheme();
        warning(t("gameplay:nowFlyingChargesAndCooldownsArePreserved", { value1: contentText(run.classRecipe, 'label') }));
      }
      if (event.type === 'class.rejected')
        warning(t("gameplay:cannotSwitchCraftReturnToSafeHangarGround", { value1: event.reason }));
      if (event.type === 'cells.claimed')
        warning(
          t("gameplay:lineSecuredRevealed", { value1: formatNumber(run.coverage * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), value2: event.indices?.length < 50 ? (" " + t("interface:bothSidesMayStillContainAnEnemy") + "") : '.' }),
        );
      if (event.type === 'player.failed')
        warning(
          {
            'self-contact': t("interface:yourLineCrossedItselfChooseANewRoute"),
            'mission-timeout': t("interface:theMissionClockRanOutTryAFasterRoute"),
            'cut-timeout': t("interface:yourLiveLineStayedOpenTooLongMakeAShorter"),
            'cable-limit': t("interface:yourCableBudgetRanOutCloseAShorterLine"),
            'lethal-terrain': t("interface:aLethalFieldCaughtYourCraftEncloseItBeforeCrossing"),
          }[event.cause] || t("interface:yourLineWasCaughtTheTerritoryYouRevealedIsKept"),
        );
      if (event.type === 'lineImpact.seeded')
        warning(t("interface:lineStruckReachSafeGroundBeforeTheTravellingSparkCatches"));
      if (event.type === 'lineImpact.arrived')
        warning(t("interface:theTravellingImpactReachedYourCraftOneLifeLost"));
      if (event.type === 'shield.absorbed')
        warning(t("interface:shieldAbsorbedTheHitYourUnfinishedLineIsCancelledNo"));
      if (event.type === 'ability.rejected')
        warning(
          {
            empty: t("interface:noChargesLeftReturnToASupplyPadAndPress"),
            cooldown: t("interface:abilityIsRechargingWatchTheCooldownBesideYourControls"),
            'already-full': t("interface:yourSuppliesAreAlreadyFull"),
            'out-of-range': t("interface:moveOntoASupplyPadToPickUpACharge"),
          }[event.reason] || t("interface:abilityIsUnavailableRightNow"),
        );
      if (event.type === 'ability.used')
        warning(
          {
            scan: t("interface:hiddenObjectivesMarkedShortDirectionHintsShowWhereEnemiesAre"),
            'stun-field': t("interface:stunFieldPlacedNearbyMovingFieldEnemiesAreBrieflyHeld"),
            'slow-field': t("interface:slowFieldPlacedNearbyFieldEnemiesMoveAtQuarterSpeed"),
            shield: t("interface:shieldActiveOneEnemyContactCanCancelYourLineSafely"),
          }[event.primitive] || t("gameplay:active", { value1: contentText(theme, 'labels.ability') }),
        );
      if (event.type === 'pickup.collected')
        warning(t("interface:suppliesReadyChooseYourNextOpportunity"));
      if (event.type === 'capture.stopped')
        warning(
          t("gameplay:lineSecuredRevealedTapADirectionToFlyAgain", { value1: formatNumber(run.coverage * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }),
        );
      if (event.type === 'powerup.collected')
        warning(
          {
            'extra-life': event.gain
              ? t("interface:extraLifeCollected")
              : t("interface:lifePickupCollectedAlreadyAtTheNineLifeLimit"),
            'player-speed': t("interface:speedPickupFasterFlightForFiveSeconds"),
            'enemy-slow': t("interface:slowPickupEnemiesMoveAtHalfSpeedForSixSeconds"),
            'enemy-freeze':
              t("interface:freezePickupEnemiesAreHeldForThreeSecondsTerrainAnd"),
          }[event.kind] || t("interface:powerupCollected"),
        );
      if (event.type === 'rover.warning')
        warning(t("interface:claimedGroundRoverWakingInOneSecondWatchTheMarked"));
      if (event.type === 'rover.activated')
        warning(t("interface:claimedGroundRoverActiveYourSecuredGroundStillHasA"));
      if (event.type === 'erosion.warning')
        warning(t("interface:theMarkedCapturedCellIsAboutToReopenWatchThe"));
      if (event.type === 'cells.eroded')
        warning(t("interface:groundReopenedReclaimingItRestoresCoverageWithoutRepeatCapturePoints"));
      if (
        event.type === 'encounter.stageChanged' ||
        event.type === 'encounter.phaseChanged' ||
        event.type === 'encounter.defeated'
      ) {
        const cue = encounterView(run);
        if (cue) warning(`${contentText(cue, 'title')}. ${contentText(cue, 'instruction')}`);
      }
      if (event.type === 'boss.warning')
        warning(t("gameplay:theMarkedLaneWillActivateShortly", { value1: contentText(theme, 'labels.boss') }));
    }
    painter.effectsFor(events, run);
  }
  function update(elapsed) {
    if (document.hidden || !document.hasFocus()) {
      if (!controllerInactive) {
        controllerInactive = true;
        clearInput();
        if (demoHost?.active) demoHost.suspend();
        else pause(true);
      }
      return;
    }
    controllerInactive = false;
    // The isolated lesson owns its controller; the paused parent must not
    // sample the same pad or turn a child Confirm into a parent menu action.
    if (enemyGuide?.ownsPracticeFocus()) {
      clearInput();
      return;
    }
    enemyGuide?.update(elapsed, { reduced: $('reduced-effects').checked });
    refreshInputPresentation();
    const scope = controllerScope();
    controllerFrame = controller.sample({
      scope: demoHost?.practiceArmed ? 'flight' : scope,
      timeMs: performance.now(),
      toggleBoostEligible: demoHost?.active ? demoHost.toggleBoostEligible : run?.status === 'running',
    });
    refreshControllerBoostCue();
    const { status, assigned, disconnected } = controllerFrame;
    if (demoHost?.active) {
      demoHost.controller(controllerFrame);
      demoHost.update(elapsed);
      // Maintain the user's existing music transport without starting demo audio.
      if (soundtrackPlayer) soundtrackPlayer.update(false, theme, run);
      else sound.update(false, theme, run);
      return;
    }
    if (Object.values(controllerFrame.ui).some(Boolean)) demoHost?.activity();
    demoHost?.update(elapsed);
    if (demoHost?.active) return;
    const flightModality = JSON.stringify(controllerFrame.flight);
    if (
      status.code === 'joined' ||
      Object.values(controllerFrame.ui).some(Boolean) ||
      (flightModality !== lastControllerModality &&
        Object.values(controllerFrame.flight).some(Boolean))
    )
      setInputModality('controller');
    lastControllerModality = flightModality;
    if (status.message !== controllerStatus) {
      controllerStatus = status.message;
      localizedText($('input-status'), () =>status.code === 'disconnected' || assigned
          ? status.message
          : t("gameplay:keyboardTouch", { value1: status.message }));
    }
    if (status.code === 'joined') refreshControllerPrompts();
    const connectionHint = $('controller-connection-hint');
    const hintParent = controllerDialog() || document.body;
    if (connectionHint.parentElement !== hintParent) hintParent.append(connectionHint);
    connectionHint.hidden = !(
      assigned || ['waiting-neutral', 'unsupported', 'disconnected'].includes(status.code)
    );
    const connectionText =
      assigned && status.code !== 'waiting-neutral'
        ? scope === 'flight'
          ? controllerFlightHint()
          : controllerMenuHint()
        : status.message;
    if (connectionHint.textContent !== connectionText) localizedText(connectionHint, () =>connectionText);
    show('controller-ui-hint', !!assigned);
    if (scope !== controllerPreviousScope) {
      controllerPreviousScope = scope;
      localizedText($('controller-ui-hint'), () =>scope === 'flight' ? controllerFlightHint() : controllerMenuHint());
      if (assigned && scope !== 'flight') controllerNavigation.engage();
    }
    if (status.code === 'joined' && scope !== 'flight') controllerNavigation.engage();
    if (disconnected) {
      clearInput();
      pause(true);
      warning(
        t("interface:controllerDisconnectedYourFlightIsPausedReleaseControlsAndPress"),
      );
    } else {
      controllerNavigation.handle(controllerFrame.ui);
      const flight = controllerFrame?.flight ?? {};
      const capabilities = arcadeActionCapabilities(run?.level);
      if (scope === 'flight' && (flight.stop || (flight.action && !capabilities.manualAbility))) {
        pause(true);
        clearInput();
      } else if (scope === 'flight' && flight.pickup && !capabilities.manualPickup) {
        pause(true);
        $('shell-guide').click();
        clearInput();
      } else if (flight.hangar) {
        if (
          capabilities.manualAbility &&
          run?.hangars?.length &&
          !$('hangar-button').hidden &&
          !$('hangar-button').disabled
        )
          $('hangar-button').click();
        else {
          pause(true);
          $('shell-packs').click();
        }
        clearInput();
      }
    }
    let controls = input.poll();
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
    if (
      !courseBlocked() &&
      !paused &&
      started &&
      flightPictures?.ready(theme.id) &&
      !dialogOpen() &&
      !['won', 'lost'].includes(run.status)
    ) {
      if (elapsed > 0.25) {
        pause(true);
        warning(t("interface:pausedAfterALongFrameInterruptionResumeToContinueSafely"));
        return;
      }
      accumulator += elapsed;
      while (accumulator + 1e-9 >= FIXED_DT && !['won', 'lost'].includes(run.status)) {
        const command = {
              direction: controls.direction,
              boost: controls.boost,
              action: pendingAction || controls.action,
              pickup: pendingPickup || controls.pickup,
              switchClass: pendingSwitch,
            };
        const resuming = neutralResumeTick;
        if (resuming) {
          command.boost = false;
          command.action = false;
          command.pickup = false;
          command.switchClass = null;
          neutralResumeTick = false;
        }
        if (!recordingStopped && recorder.ticks >= MAX_REPLAY_TICKS) {
          recordingStopped = true;
          recorder = null;
          $('export-replay').disabled = true;
          warning(
            t("interface:the30MinuteReplayBudgetIsFullRecordingWasDiscarded"),
          );
        }
        const beforeStatus = run.status;
        if (beforeStatus === 'respawning') {
          command.direction = null;
          command.boost = false;
          command.action = false;
          command.pickup = false;
          command.switchClass = null;
        }
        let lessonBefore = null;
        if (courseObserver)
          try {
            lessonBefore = captureLessonFacts(run, { runId });
          } catch {
            stopCourseGuidance();
          }
        stepRun(run, command, FIXED_DT);
        controls = controllerBoostAfterRecovery({
          beforeStatus,
          run,
          controller,
          input,
          frame: controllerFrame,
          controls,
        });
        if (beforeStatus === 'respawning' || run.status === 'respawning') {
          input.clear();
          controller.clear();
          controls = { direction: null, boost: false, action: false, pickup: false };
        }
        if (run.events.some((event) => event.type === 'capture.stopped')) {
          // Record the closure tick unchanged; later substeps wait for a fresh gesture.
          input.clear();
          controller.clear();
          controllerFrame = null;
          controls = { direction: null, boost: false, action: false, pickup: false };
          pendingSwitch = null;
        }
        refreshControllerBoostCue();
        if (masteryObserver)
          try {
            masteryObserver.observe(
              captureMasteryFacts(run, { runId, definition: masteryDefinition }),
            );
          } catch {
            masteryObserver = null;
            masteryAward = {
              status: 'unavailable',
              message: t("interface:liveGoalTrackingIsUnavailableYourPictureProgressIsKept"),
            };
          }
        pendingAction = false;
        pendingPickup = false;
        if (!resuming) pendingSwitch = null;
        accumulator -= FIXED_DT;
        if (!recordingStopped)
          try {
            recordInput(recorder, command);
          } catch {
            recordingStopped = true;
            recorder = null;
            $('export-replay').disabled = true;
            warning(
              t("interface:replayRecordingStoppedYouCanKeepPlayingStartANew"),
            );
          }
        if (courseObserver)
          try {
            courseObserver.observe(lessonBefore, captureLessonFacts(run, { runId }));
          } catch {
            stopCourseGuidance();
          }
        eventFeedback(run.events);
      }
      if (!handled && ['won', 'lost'].includes(run.status)) {
        handled = true;
        paused = true;
        clearInput();
        refreshCourse();
        if (run.status === 'won' && !practice) {
          const previousBodies = availableBodies();
          try {
            library = recordLibraryCompletion(library, {
              campaign,
              result: getSummary(run),
              runId,
              themeId: theme.id,
              bodyId,
              sourcePackId: activeEntry.sourcePackId,
              presentationPins: flightPictures?.pins(),
              mediaIdentityCatalog: flightPictures?.identityCatalog,
            });
          } catch (error) {
            completionWarning = t("gameplay:yourPictureIsOpenButTheCollectionCouldNotBe", { value1: recorder ? t("interface:exportThisReplayAndYourLibrary") : t("interface:theReplayRecordingHasEndedExportYourLibrary") });
            localizedText($('save-warning'), () =>`${completionWarning} ${error.message}`);
            show('save-warning', true);
          }
          progress = progressFor(library, campaign);
          appearanceRewardIds = [...availableBodies()].filter((id) => !previousBodies.has(id));
          persistProfile();
          void retainDemoRun(false);
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
                message: t("gameplay:yourPictureIsCollectedTheSealCouldNotBeChecked", { value1: error.message }),
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
          warning(t("interface:pictureUnlockedAWholeWorldFromOneBraveLine"));
        } else {
          defeatActive = true;
          defeatPaused = false;
          defeatRemaining = 0.65;
          show('game-overlay', false);
          show('show-result', false);
          localizedText($('skip-celebration'), () =>t("interface:showDefeatMenu"));
          show('skip-celebration', true);
          $('skip-celebration').focus({ preventScroll: true });
          warning(t("interface:lifeLostShowingTheFinalImpactChooseShowDefeatMenu"));
        }
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
    storyDialog.syncSettings();
    if (soundtrackPlayer) soundtrackPlayer.update(!paused && started, theme, run);
    else sound.update(!paused && started, theme, run);
    if (!sound.previewActive && $('music-preview').textContent.startsWith('Playing'))
      localizedText($('music-preview'), () =>t("interface:previewMusic"));
    $('sound-button').setAttribute('aria-pressed', String(sound.enabled));
    localizedAttribute($('sound-button'), "aria-label", () => sound.enabled ? t("interface:muteSound") : t("interface:enableSound"));
    refreshHUD();
  }
  for (const t of themesFile.themes) $('theme-select').append(localizedOption(() => contentText(t, 'name'), t.id));
  if (scenario && !themesFile.themes.some((t) => t.id === theme.id))
    $('theme-select').append(localizedOption(() => contentText(theme, 'name'), theme.id));
  $('theme-select').value = theme.id;
  for (const c of scenario?.classRecipes || classRegistry)
    $('class-select').append(localizedOption(() => contentText(c, 'label'), c.id));
  $('theme-select').onchange = async () => {
    if (courseSession || courseEntry) return;
    cancelRestore();
    pause(true);
    const next =
      themesFile.themes.find((t) => t.id === $('theme-select').value) ||
      (scenario?.theme?.id === $('theme-select').value ? scenario.theme : themesFile.themes[0]);
    const owner = flightPictures,
      controller = new AbortController(),
      ticket = ++pictureGeneration;
    let candidate = newFlightPictures({
      nextThemeId: next.id,
      pins: owner.pins(),
      legacy: owner.legacy,
    });
    pictureThemePending = { ticket, controller };
    try {
      await candidate.ensure(next.id, { signal: controller.signal });
      if (owner !== flightPictures || ticket !== pictureGeneration || document.hidden) return;
      flightPictures = candidate;
      candidate = null;
      owner.dispose();
      themeOverride = true;
      theme = next;
      bodyId = theme.player;
      setTheme();
      refreshMissionBrief();
      if (!started && !campaignOverview) overlay('ready');
      preferences({ themeId: theme.id, bodyId });
      rememberSelection();
    } catch (error) {
      if (owner === flightPictures) pictureFailure(error);
    } finally {
      candidate?.dispose();
      if (pictureThemePending?.ticket === ticket) pictureThemePending = null;
      $('theme-select').value = theme.id;
    }
  };
  $('body-select').onchange = () => {
    if (courseEntry) return;
    cancelRestore();
    bodyWarning = '';
    bodyId = $('body-select').value;
    painter.setLook(theme, bodyId, visuals());
    soundtrackPlayer?.setContext(soundtrackContext());
    preferences({ bodyId, matchClassAppearance: false });
    $('match-class-appearance').checked = false;
  };
  $('class-select').onchange = () => {
    if (courseSession || courseEntry) return;
    classId = $('class-select').value;
    demo = false;
    preferences({ classId });
    prepare();
  };
  $('turn-select').onchange = () => {
    if (courseEntry || courseBlocked()) return;
    turnPolicy = $('turn-select').value;
    demo = false;
    preferences({ turnPolicy });
    if (courseSession) {
      selectCourseLesson(courseRequest.lessonId);
      return;
    }
    prepare();
  };
  $('start-button').onclick = () => resume();
  $('continue-saved').onclick = async () => {
    try {
      await restoreAttempt(savedAttempt());
      $('start-button').focus({ preventScroll: true });
    } catch (error) {
      warning(t("gameplay:savedFlightWasNotLoaded", { value1: error.message }));
      // A new selection may have cancelled verification. Preserve its focus;
      // only recover focus lost when the loading button was disabled.
      if (!$('continue-saved').hidden && document.activeElement === document.body)
        $('continue-saved').focus({ preventScroll: true });
    }
  };
  $('choose-mission').onclick = () => {
    gameShell?.openMissions();
    const mission = $('missions').querySelector('button:not(:disabled)');
    mission?.focus();
    mission?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  };
  $('pause-button').onclick = () => pause();
  const restartMission = () => {
    if (defeatActive || campaignOverview || courseBlocked()) return;
    if ($('restart-dialog').open) $('restart-dialog').close();
    if ($('shell-home').open) $('shell-home').close();
    demo = false;
    prepare();
    resume();
  };
  $('restart-button').onclick = restartMission;
  $('overlay-restart').onclick = () => {
    if (defeatActive || campaignOverview || courseBlocked()) return;
    $('restart-dialog').showModal();
    $('restart-cancel').focus({ preventScroll: true });
  };
  $('restart-dialog').addEventListener('close', () => {
    if (paused && $('game-overlay').dataset.kind === 'pause')
      $('overlay-restart').focus({ preventScroll: true });
  });
  $('restart-confirm').onclick = restartMission;
  $('retry-button').onclick = () => {
    if (defeatActive || courseBlocked()) return;
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
    if (courseBlocked()) return;
    if (courseSession) {
      nextCourseLesson();
      return;
    }
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
      const selection = currentSelection();
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
    rememberSelection();
  };
  $('demo-button').onclick = () => {
    void demoHost?.open();
  };
  $('sound-button').onclick = async () => {
    try {
      let on;
      if (sound.enabled) {
        muteAudio();
        on = false;
      } else on = await activateAudio({ explicit: true });
      $('sound-button').setAttribute('aria-pressed', String(on));
      localizedAttribute($('sound-button'), "aria-label", () => on ? t("interface:muteSound") : t("interface:enableSound"));
      preferences({ musicEnabled: on });
    } catch {
      warning(t("interface:audioCouldNotStartInThisBrowser"));
    }
  };
  for (const id of ['tap-steering', 'settings-tap-steering']) {
    $(id).onchange = () => {
      clearInput();
      preferences({ tapSteering: $(id).checked });
      $('tap-steering').checked =
        library.preferences.tapSteering ?? matchMedia('(pointer: coarse)').matches;
      syncAssistControls();
    };
  }
  $('help-button').onclick = () => {
    pause(true);
    $('help-dialog').showModal();
  };
  let collectionContextKey = null,
    collectionContexts = new Map();
  const collectionContextLabel = (entry) =>
    `${contentText(entry.campaign, 'title') || contentText(entry.campaign, 'name') || entry.campaign.id} · ${difficultyLabel(entry) || t("interface:challenge")}`;
  function paintCollectionProgress(entry) {
    localizedText($('achievement-campaign'), () =>t("gameplay:campaignAchievements", { value1: collectionContextLabel(entry) }));
    $('achievements').replaceChildren();
    for (const a of difficultyNavigation.achievements(
      entry,
      library.campaigns,
      progressFor(library, entry.campaign),
    )) {
      const row = document.createElement('div');
      row.className = `achievement${a.earned ? ' earned' : ''}`;
      const title = document.createElement('strong');
      localizedText(title, () =>`${a.earned ? '◆' : '◇'} ${contentText(a, 'name')}`);
      const copy = document.createElement('span');
      localizedText(copy, () =>`${contentText(a, 'description')}${a.scope === 'shared' ? (" " + t("interface:standardOrGentle") + "") : a.scope ? t("gameplay:results", { value1: difficultyLabel(entry) }) : ''}`);
      row.append(title, copy);
      $('achievements').append(row);
    }
    paintAppearanceRewards(entry);
  }
  function prepareCollectionProgress() {
    const currentKey = campaignKey(campaign);
    const keys = new Set([
      currentKey,
      ...Object.keys(library.campaigns),
      ...library.gallery.map((item) => item.campaignKey),
    ]);
    collectionContexts = new Map(
      [...executionEntries(), activeEntry]
        .map((entry) => [campaignKey(entry.campaign), entry])
        .filter(([key]) => keys.has(key)),
    );
    // This is a view choice only. Unknown historical contexts stay archived;
    // names and theme IDs never authorize a replacement campaign.
    if (!collectionContexts.has(collectionContextKey)) {
      collectionContextKey =
        [...library.gallery]
          .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
          .find((item) => collectionContexts.has(item.campaignKey))?.campaignKey ?? currentKey;
    }
    $('collection-context').replaceChildren(
      ...[...collectionContexts].map(
        ([key, entry]) => localizedOption(() => collectionContextLabel(entry), key),
      ),
    );
    $('collection-context').value = collectionContextKey;
    paintCollectionProgress(collectionContexts.get(collectionContextKey));
  }
  $('collection-context').onchange = () => {
    if (!$('collection-dialog').open) return;
    const entry = collectionContexts.get($('collection-context').value);
    if (!entry) {
      $('collection-context').value = collectionContextKey;
      return;
    }
    collectionContextKey = $('collection-context').value;
    paintCollectionProgress(entry);
  };
  $('collection-button').onclick = () => {
    if (courseSession || courseEntry) return;
    pause(true);
    prepareCollectionProgress();
    libraryPanel.populateGallery();
    $('collection-dialog').showModal();
  };
  $('choose-appearance').onclick = focusAppearance;
  $('collection-choose-appearance').onclick = focusAppearance;
  document.querySelectorAll('[data-close]').forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.close === 'help-dialog' && courseEntry) cancelCourseEntry();
        $(b.dataset.close).close();
      }),
  );
  $('export-replay').onclick = async () => {
    try {
      if (!recorder) throw new Error(t("interface:startANewAttemptToRecordAReplay"));
      pause(true);
      lastReplay = exportReplay(recorder, run);
      $('replay-json').value = JSON.stringify(lastReplay, null, 2);
      $('replay-dialog').showModal();
      const exported = await downloadJSON(lastReplay, `revealline-${run.levelId}-replay.json`);
      warning(t("gameplay:replayPreparedWithItsExactRulesInputsAndFinalState", { value1: exported.message }));
    } catch (error) {
      warning(t("gameplay:replayCouldNotExport", { value1: error.message }));
    }
  };
  $('download-replay').onclick = async () => {
    try {
      if (lastReplay)
        warning(
          (await downloadJSON(lastReplay, `revealline-${contentText(lastReplay, 'summary').levelId}-replay.json`))
            .message,
        );
    } catch (error) {
      warning(t("gameplay:replayDownload", { value1: error.message }));
    }
  };
  function suspendInteraction() {
    // Menu and result screens also need a neutral gate. Their pause() path
    // deliberately returns early, and a hidden renderer may not tick at all.
    controllerInactive = true;
    invalidateContentSwitch({ announce: true });
    if (courseEntry)
      cancelCourseEntry(t("interface:courseEntryCancelledWhenFocusChangedYourFlightRemainsPaused"));
    clearInput();
    controllerPreview?.clear();
    suspendAudio();
    if (demoHost?.active) demoHost.suspend();
    else pause(true);
  }
  onNativeInactive(suspendInteraction).catch((error) =>
    warning(t("gameplay:appLifecycleAdapterUnavailable", { value1: error.message })),
  );
  window.addEventListener('blur', suspendInteraction);
  function restoreListening() {
    if (
      document.hidden ||
      soundtrackDisposed ||
      !soundtrackPlayer ||
      !soundtrackSuspended ||
      enemyGuide?.practiceActive
    )
      return;
    soundtrackSuspended = false;
    void soundtrackPlayer.resume();
  }
  window.addEventListener('focus', restoreListening);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      optionalWorlds?.close(false);
      suspendInteraction();
    } else {
      void packCommits.reconcile();
      restoreListening();
    }
  });
  setTheme();
  refreshCampaigns();
  prepare();
  let autoplayPackLaunch = null;
  if (rememberedSelection)
    contentStatus(
      t("gameplay:selectedContinueASavedFlightSeparately", { value1: contentText(campaign, 'title') || contentText(campaign, 'name') || campaign.id, value2: contentText(campaign.levels[levelIndex], 'name') }),
    );
  if (packLaunchError) {
    contentStatus(packLaunchError, true);
    warning(packLaunchError);
  } else if (packLaunchRequest) {
    const selected = await activatePack(packLaunchRequest.packId, {
      campaignId: packLaunchRequest.campaignId,
      levelId: packLaunchRequest.levelId,
      announce: false,
    });
    if (selected) {
      if (packLaunchRequest.play)
        autoplayPackLaunch = {
          ticket: selected,
          run,
          entry: activeEntry,
          campaignKey: campaignKey(campaign),
          levelId: campaign.levels[levelIndex].id,
        };
      contentStatus(
        t("gameplay:selected", { value1: packLaunchRequest.packName, value2: packLaunchRequest.levelName, value3: autoplayPackLaunch ? ' · starting now…' : (" " + t("interface:andReady") + "") }),
      );
    }
  }
  onLocaleChange(() => {
    refreshKeyPrompts();
    refreshControllerPrompts();
    refreshMissionBrief();
    refreshHUD();
    refreshCourse();
    if (!$('game-overlay').hidden) overlay($('game-overlay').dataset.kind);
  });
  refreshKeyPrompts();
  refreshControllerPrompts();
  class FieldScene extends Phaser.Scene {
    create() {
      this.boardSize = boardPaintSizeForRun(run);
      const { width, height } = this.boardSize;
      this.boardTexture = this.textures.createCanvas('field', width, height);
      document.documentElement.style.setProperty('--board-ratio', `${width} / ${height}`);
      document.documentElement.style.setProperty('--board-aspect', String(width / height));
      this.boardImage = this.add.image(0, 0, 'field').setOrigin(0);
      this.game.canvas.setAttribute('aria-hidden', 'true');
    }
    update(now, delta) {
      if (globalThis.RevealLineBoot && document.documentElement.dataset.bootState !== 'ready')
        return;
      const dt = clamp(delta / 1000, 0, 1);
      update(dt);
      const { width, height } = boardPaintSizeForRun(run);
      if (width !== this.boardSize.width || height !== this.boardSize.height) {
        this.boardTexture.setSize(width, height);
        this.boardImage.setSizeToFrame();
        this.scale.resize(width, height);
        this.cameras.main.setSize(width, height);
        this.boardSize = { width, height };
        document.documentElement.style.setProperty('--board-ratio', `${width} / ${height}`);
        document.documentElement.style.setProperty('--board-aspect', String(width / height));
      }
      painter.draw(this.boardTexture.context, run, Math.min(dt, 0.1), {
        // The texture is detached; only the displayed Phaser canvas has a CSS size.
        displayCSSWidth: this.game.canvas.clientWidth,
        paused,
        reduced: $('reduced-effects').checked,
        fullReveal: run.status === 'won',
        showGrid: scenario?.presentation?.showGrid || library.preferences.showGrid,
        backdrop: flightPictures?.current(),
        celebrationPaused: document.hidden || dialogOpen(),
        defeatEffectsRunning: defeatEffectsRunning(),
      });
      advanceDefeatPresentation(Math.min(dt, 0.1));
    }
  }
  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: 'game-canvas',
    width: boardPaintSizeForRun(run).width,
    height: boardPaintSizeForRun(run).height,
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
  missionPicker = attachMissionPicker({
    archivedIds: preparePackCatalog(archiveCatalogSource).packs.map(({ id }) => id),
  });
  optionalWorlds = attachOptionalChaptersPanel({
    getLibrary: () => packs,
    getUsage: () => chapterSnapshot?.usage,
    sourceChapters: !practiceSession
      ? SOURCE_EXTERNAL_EDITIONS.map(({ descriptor, name, description, mode, levels }) => ({
          id: descriptor.id,
          controlId:
            descriptor.id === SOURCE_EXTERNAL_CHAPTER.id ? 'source' : `source-${descriptor.id}`,
          name,
          description,
          mode,
          themeId: descriptor.themeId,
          levels,
          sourceOnly: !isRelease,
          bytes: descriptor.pack.bytes + descriptor.media.bytes,
          download: isRelease
            ? (options) => installSourceChapter(descriptor.id, null, { ...options, download: true })
            : null,
          backupSupported: !!externalBackup,
          async inspect({ signal }) {
            const snapshot = await inspectChapters({ signal });
            if (snapshot.status !== 'checked') return { status: snapshot.reason };
            const installed = snapshot.index.chapters.some((d) => d.id === descriptor.id);
            if (installed) await externalChapters.readiness(snapshot, descriptor.id, { signal });
            return { status: installed ? 'installed' : 'absent' };
          },
          install: (files, options) => installSourceChapter(descriptor.id, files, options),
          async choose({ signal }) {
            if (!storedStateAdopted || !persistenceReady)
              throw new Error(
                t("interface:reloadAfterRecoveryToAdoptThePreservedProfileBeforeChoosing"),
              );
            const snapshot = await checkedChapters({ signal });
            await externalChapters.readiness(snapshot, descriptor.id, { signal });
            if (signal.aborted)
              throw new DOMException(t("interface:chapterSelectionCancelled"), 'AbortError');
            adoptContentCatalog(contentFromChapters(snapshot));
            const pack = packs.packs.find((p) => p.id === descriptor.id);
            selectEntry(resolvePackCampaign(pack, pack.campaigns[0].id));
          },
        }))
      : [],
    loadCatalog: async ({ signal }) => {
      const options = { signal, baseURL: new URL('../', location.href) };
      if (isRelease) await loadExternalCatalog(options);
      return loadOptionalCatalog(options);
    },
    install: installOptionalChapter,
    chooseInstalled: async (pack, { signal }) => {
      if (courseEntry || courseSession || practice || !storedStateAdopted || !persistenceReady)
        throw new Error(
          t("interface:returnToTheNormalGameAndResolveRecoveryBeforeChoosing"),
        );
      if (signal?.aborted) throw new DOMException(t("interface:worldSelectionCancelled"), 'AbortError');
      if (!packs.packs.includes(pack))
        throw new Error(t("interface:installedContentChangedRefreshTheChapterList"));
      // External originals always go through their descriptor/readiness card.
      if (SOURCE_EXTERNAL_EDITIONS.some(({ descriptor }) => descriptor.id === pack.id))
        throw new Error(t("interface:useThisChapterSExactOriginalPictureCard"));
      selectEntry(resolvePackCampaign(pack, pack.campaigns[0].id));
      return true;
    },
    choose: async (summary, { signal }) => {
      if (courseEntry || courseSession || practice)
        throw new Error(t("interface:returnFromPracticeBeforeChoosingAWorld"));
      const pack = packs.packs.find((item) => item.id === summary.id);
      if (!pack) throw new Error(t("interface:installThisWorldBeforeChoosingIt"));
      await verifyOptionalInstalled(pack, summary, { signal });
      if (signal?.aborted) throw new DOMException(t("interface:worldSelectionCancelled"), 'AbortError');
      if (packs.packs.find((item) => item.id === summary.id) !== pack)
        throw new Error(t("interface:installedContentChangedChooseThisWorldAgain"));
      selectEntry(resolvePackCampaign(pack, pack.campaigns[0].id));
      return true;
    },
    onOpen: () => {
      pause(true);
      clearInput();
    },
    onClose: () => {
      clearInput();
      gameShell?.openHome();
    },
    onChosen: () => {
      clearInput();
      controllerReading.refresh();
      controllerFocus()?.focus({ preventScroll: true });
    },
    onRead: (request) => controllerNavigation.beginReading(request),
    onManage: () => {
      clearInput();
      libraryPanel.open('packs');
    },
  });
  gameShell = attachGameShell({
    training: courseSession,
    focusBriefing: () => {
      clearInput();
      controllerReading.refresh();
      $('mission-brief-read').focus({ preventScroll: true });
      return true;
    },
    focusMissions: () => missionPicker?.focusSelectedChapter(),
    focusGame: () => controllerFocus()?.focus({ preventScroll: true }),
    pause,
    getTopDialog: controllerDialog,
    canContinue: () =>
      (started && !['won', 'lost'].includes(run?.status)) || !$('continue-saved').hidden,
    initial: !practice && !courseSession && !packLaunchRequest,
    onFeatured: () => activatePack('fpv-arcade-r5', { campaignId: 'fpv-pressure-lines' }),
    onWorlds: () => optionalWorlds.open(),
  });
  demoHost = attachDemoHost({
    presets,
    getContext: () => ({ entries: executionCatalog.entries, library,
      preferences: library.preferences, themeId: theme.id, reduced: $('reduced-effects').checked,
      controller: controllerFrame?.assigned }),
    loadSources: ({ signal }) => loadDemoSources({ entries: executionCatalog.entries,
      library: demoLibrary, turnPolicy, signal }),
    readMedia: pictureMedia,
    canOpen: () => !practiceSession && !courseSession && !courseEntry && !courseEntryHold &&
      !contentSwitchBusy && !sessionBusy && !backupBusy && !document.hidden,
    canAutoStart: () => $('shell-home').open && controllerDialog()?.id === 'shell-home' &&
      !started && !practiceSession && !courseSession && !courseEntry && !courseEntryHold &&
      !contentSwitchBusy && !sessionBusy && !backupBusy && storedStateAdopted &&
      recovery === null && !document.hidden && document.hasFocus(),
    onEnter: () => {
      // Watching is presentation-only: retain the ordinary run/recorder and save slot.
      clearInput(); paused = true;
      if (started && !['won', 'lost'].includes(run.status)) overlay('pause');
      if ($('shell-home').open) $('shell-home').close();
    },
    onExit: ({ handoff, origin }) => {
      clearInput();
      if (handoff) $('start-button').focus({ preventScroll: true });
      else {
        // openHome's ordinary pause hook autosaves; reopening this presentation
        // must instead leave the preserved save byte-for-byte unchanged.
        $('shell-continue').hidden = !(started && !['won', 'lost'].includes(run.status)) && $('continue-saved').hidden;
        if (!$('shell-home').open) $('shell-home').showModal();
        (origin?.closest?.('#shell-home') ? origin : $('shell-demo')).focus({ preventScroll: true });
      }
    },
    onFreshStart: async (source, current) => {
      const entry = executionCatalog.find(source.entry.executionKey || campaignKey(source.entry.campaign));
      const level = entry?.campaign.levels.find((item) => item.id === source.levelId);
      if (!level || demoIdentity(level, entry.classRecipes) !== source.identity)
        throw new Error('The demonstrated level is no longer installed.');
      const index = entry.campaign.levels.indexOf(level);
      if (!missionAvailable(index, entry)) return false;
      if (!current()) return false;
      if (started && !['won', 'lost'].includes(run.status) && recorder && !practice)
        persistAttempt(false, { requireSuccess: true });
      if (!current()) return false;
      selectEntry(entry, { levelId: level.id, difficulty: entry.difficulty || 'standard' });
      return true;
    },
    clearInput,
    menu: (commands) => controllerNavigation.handle(commands),
    canWrite: () => writer.writable && persistenceReady && !backupBusy,
    settingsKey: `revealline.demo.${channel}.v1`,
    setCollect: (enabled) => demoLibrary.setEnabled(enabled),
    clearRecordings: () => demoLibrary.clear(),
  });
  async function retainDemoRun(manual) {
    if (!recorder || practice || run.status !== 'won') {
      if (manual) $('demo-keep-status').textContent = t('demo:notKept');
      return;
    }
    try {
      const result = await demoLibrary.keep(exportReplay(recorder, run), { entry: activeEntry, practice: false, manual });
      if (manual) $('demo-keep-status').textContent = t(result.saved ? 'demo:kept' : 'demo:notKept');
    } catch { if (manual) $('demo-keep-status').textContent = t('demo:cacheError'); }
  }
  $('demo-keep').onclick = () => void retainDemoRun(true);
  $('shell-demo').hidden = practiceSession;
  $('demo-button').hidden = practiceSession;
  attachFullscreen($('shell-fullscreen'));
  void initializeSoundtrack();
  if (autoplayPackLaunch)
    requestAnimationFrame(() => {
      const currentLevelId = campaign.levels[levelIndex]?.id;
      if (
        canAutoStartPackLaunch({
          current: packLaunchGuard.current(autoplayPackLaunch.ticket, packs),
          blocked: dialogOpen() || contentSwitchBusy || sessionBusy || document.hidden,
          started,
          paused,
          overlayKind: $('game-overlay').dataset.kind,
          run,
          expectedRun: autoplayPackLaunch.run,
          entry: activeEntry,
          expectedEntry: autoplayPackLaunch.entry,
          campaignKey: campaignKey(campaign),
          expectedCampaignKey: autoplayPackLaunch.campaignKey,
          levelId: currentLevelId,
          expectedLevelId: autoplayPackLaunch.levelId,
        })
      )
        resume({ contentSwitchTicket: autoplayPackLaunch.ticket });
    });
  if (globalThis.RevealLineBoot) globalThis.RevealLineBoot.ready();
  else {
    document.querySelectorAll('[data-boot-inert]').forEach((element) => {
      element.inert = false;
      element.removeAttribute('aria-busy');
    });
    $('boot-status').hidden = true;
  }
  controllerReading?.refresh();
  controllerFocus()?.focus({ preventScroll: true });
} catch (error) {
  globalThis.RevealLineBoot?.fail(error);
  localizedText($('overlay-title'), () =>t("interface:theGameCouldNotLoad"));
  localizedText($('overlay-copy'), () =>error.message);
  show('start-button', false);
  localizedText($('run-message'), () =>new URLSearchParams(location.search).has('course')
    ? t("interface:thisCourseCouldNotOpenUseRevealLineToReturn")
    : new URLSearchParams(location.search).get('practice') === '1'
      ? t("interface:openThePlaygroundAndChoosePlayConfigurationOrUseReveal")
      : t("interface:serveTheProjectThroughHttpAndCheckTheContentFiles"));
  console.error(error);
}
