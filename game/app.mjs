import { attachMusicCredit } from './ui/music-credit.mjs';
import { createTouchPreferences } from './touch-preferences.mjs';
import { createCharacterPresentations } from './character-presentations.mjs';
import { journeyFromPackCatalog, journeyMissionId } from './journey/catalog.mjs';
import { createJourneyAuthority } from './journey/authority.mjs';
import { createJourneyProfileStore } from './journey/profile.mjs';
import { attachJourneySaveNotice } from './ui/journey-save-notice.mjs';
import { createJourneyPreferences } from './journey/preferences.mjs';
import { loadAuthoredJourneyRoute } from './content-design/route-loader.mjs';
import { resolveJourneyRequest } from './content-design/default-entry.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from './content-design/mode-href.mjs';
import { attachJourneyReactions } from './ui/journey-reactions.mjs';
import { createCandidateSoloHost } from './content-design/solo-host.mjs';
import { journeyActorThemeCandidates } from './presentation/journey-actor-materials.mjs';
import { journeyDifficultyCatalog, journeyPreset } from './content-design/catalogs.mjs';
import { createCandidateFlightPictures } from './ui/candidate-flight-pictures.mjs';
import { attachJourneyChooser } from './ui/journey-chooser.mjs';
import {
  resolveInstalledMissionTarget,
  installedMissionExecutionIndex,
  resolveCampaignMissionTarget,
} from './mission-library/installed-target.mjs';
import { createInstalledMissionLibrary } from './mission-library/installed-library.mjs';
import { journeyLibrarySource } from './mission-library/journey-source.mjs';
import { trackMissionLibraryOpening } from './mission-library/opening-intent.mjs';
import {
  journeyMissionDetails,
  authoredJourneyMissionTags,
} from './mission-library/journey-presentation.mjs';
import {
  createMissionLibrarySessionState,
  missionLibraryHref,
  readMissionLibraryHandoff,
} from './mission-library/handoff.mjs';
import { createDuel } from './multiplayer.mjs';
import { createPresentationHost } from './presentation/host.mjs';
import {
  createReleasePictureDefaults,
  ReleasePictureWriteRequiredError,
} from './presentation/release-pictures.mjs';
import { createMissionPictureThumbnails } from './ui/mission-thumbnails.mjs';
import { drawResultPicture } from './ui/result-picture.mjs';
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
import { createFlightPresentationPins, retryFlightPresentationPins } from './flight-media-pins.mjs';
import {
  loadOptionalCatalog,
  prepareOptionalDownload,
  verifyOptionalInstalled,
} from './optional-chapters.mjs';
import { attachOptionalChaptersPanel } from './ui/optional-chapters-panel.mjs';
import { arcadeActionCapabilities } from './core/arcade-actions.mjs';
import {
  nextInputModality,
  showScreenControls,
  hasCompactArcadeArena,
  hasFieldWarningBand,
} from './input-presentation.mjs';
import { onNativeInactive, nativePlatform } from './platform.mjs';
import { createRun, stepRun, getSummary, CLASSES, FIXED_DT } from './core/index.mjs';
import { inspectCaptureSnapshot } from './core/capture-regions.mjs';
import { BoardPainter, boardPaintSizeForRun, boardPaintSizeForLevel } from './ui/render.mjs';
import { encounterView } from './ui/encounter-view.mjs';
import { foundationCompatibleView as classicView } from './ui/foundation-view.mjs';
import { terrainTransitionCaption } from './ui/terrain-feedback.mjs';
import { foundationReturnCaption } from './ui/foundation-feedback.mjs';
import { laneWarningCaption } from './ui/lane-presentation.mjs';
import { attachFlightInformation } from './ui/flight-information-host.mjs';
import { attachFlightDetails } from './ui/flight-information-details.mjs';
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
import { authoredModeDestinations } from './ui/authored-mode-routes.mjs';
import {
  mountWorkshopLinks,
  readWorkshopReturn,
  clearWorkshopReturn,
} from './ui/workshop-return.mjs';
import { attachFocusClearance } from './ui/focus-clearance.mjs';
import { createOperationStatus } from './ui/operation-status.mjs';
import { attachMissionPicker } from './ui/mission-picker.mjs';
import { fetchBundledChapter } from './chapter-download.mjs';
import { attachModalNavigation } from './ui/modal-navigation.mjs';
import { attachProfileRecoveryDialog } from './ui/profile-recovery-dialog.mjs';
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
import { requestControllerPracticeExit } from './ui/controller-practice-exit.mjs';
import { playgroundTabBoundary } from './ui/playground-tab-boundary.mjs';
import { attachEnemyWorkshopReturn } from './ui/enemy-workshop-return.mjs';
import { attachEnemyGuide } from './ui/enemy-guide.mjs';
import { attachControllerSettings } from './ui/controller-settings.mjs';
import { controllerBindingLabels, controllerStickLabel } from './controller-bindings.mjs';
import { attachKeySettings } from './ui/key-settings.mjs';
import { actionForKey, bindingLabels, keyLabel, resolveKeyBindings } from './key-bindings.mjs';
import { Soundscape, DEFAULT_TRACKS } from './ui/audio.mjs';
import { createAudioMaster } from './ui/audio-master.mjs';
import { createAudioPreferences } from './audio-preferences.mjs';
import { createDisplayPreferences } from './display-preferences.mjs';
import { attachMenuStyleControls } from './ui/menu-style-controls.mjs';
import { attachPreferenceRestoration } from './ui/preference-restoration.mjs';
import { settingsTabOwnsKey } from './ui/settings-panels.mjs';
import { attachPublishedAudio } from './ui/published-audio.mjs';
import { createSoundtrackStore } from './soundtrack-store.mjs';
import { upgradeSoundtrackLibrary, setCatalogueTracks } from './soundtrack.mjs';
import { createSoundtrackSource } from './soundtrack-source.mjs';
import { SOUNDTRACK_CATALOGUE, SOUNDTRACK_ARCHIVES } from './content/soundtrack-catalogue.mjs';
import { createManagedMediaStore } from './managed-media-store.mjs';
import { createStillMediaStore } from './media-store.mjs';
import { createStoryMediaStore } from './story-media-store.mjs';
import { storyPinForTheme, validateFlightPresentationPinsForRun } from './flight-media-pins.mjs';
import { createStoryDialog } from './ui/story-dialog.mjs';
import { createFlightPictures } from './ui/flight-pictures.mjs';
import { acquireAuthoredPicture, acquirePresentationImage } from './ui/presentation-image.mjs';
import { createSessionReleasePictures } from './presentation/session-release-pictures.mjs';
import { createSessionPictureView } from './presentation/session-picture-view.mjs';
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
import { canonicalJSON, dataIdentity } from './data-json.mjs';
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
import { suspendSession, restoreSession, saveSession, SESSION_STORAGE_BYTES } from './sessions.mjs';
import { createAttemptFilePreparer } from './attempt-file.mjs';
import { challengeCampaign } from './challenges.mjs';
import { createGalleryDifficultyResolver } from './gallery-difficulty.mjs';
import { savedFlightPreview } from './continuation.mjs';
import { createSelectionBookmark, resolveSelectionBookmark } from './selection-bookmark.mjs';
import { createModeReturn } from './mode-return.mjs';
import { createModeReturnV2 } from './mode-return-v2.mjs';
import { createExecutionCatalog } from './campaign-contexts.mjs';
import { resolveCampaignDifficulty } from './campaign-difficulty.mjs';
import {
  createDifficultyNavigation,
  difficultyCue,
  difficultyLabel as legacyDifficultyLabel,
  difficultyRuleComparison,
} from './difficulty-navigation.mjs';
import { missionBriefing } from './mission-brief.mjs';
import { claimProfileWriter } from './profile-writer.mjs';
import { commitBackup, recoverBackupImport } from './backup-storage.mjs';
import { attachOfflinePanel } from './ui/offline-panel.mjs';
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
  if (!r.ok) throw new Error(`Could not load ${path}`);
  return r.json();
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const timeLabel = (time) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
function preparationStatus(observer, message, stage, isCurrent = () => true) {
  if (!isCurrent()) return;
  try {
    observer?.({ status: 'preparing', message, stage, progress: null });
  } catch {
    // A status observer cannot alter content verification or a durable commit.
  }
}

try {
  globalThis.RevealLineBoot?.progress?.('Loading missions and flight equipment…');
  const contentFeedback = ['content-select-status', 'shell-featured-status']
    .map((id) => $(id))
    .filter(Boolean)
    .map((target) => ({ target, presenter: createOperationStatus(target), lease: null }));
  let attemptFiles = null,
    profileRecovery = null;
  const [baseCampaign, themesFile, presets, baseClasses, packCatalogSource, archiveCatalogSource] =
    await Promise.all([
      getJSON('content/campaign.json'),
      getJSON('content/themes.json'),
      getJSON('../authoring/motion-lab/presets.json'),
      getJSON('content/classes.json'),
      getJSON('content/packs/catalog.json'),
      getJSON('content/packs/archive-catalog.json'),
    ]);
  // Guide lessons keep the canonical catalog when a selected pack narrows flight themes.
  const guideThemes = themesFile.themes;
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
  let buildSourceRevision = null;
  if (!buildVersion || buildVersion === '__REVEALLINE_VERSION__') buildVersion = 'dev';
  let isRelease = false;
  try {
    const info = await getJSON('build-info.json');
    buildVersion = info.version;
    if (typeof info.sourceRevision === 'string' && /^[0-9a-f]{40,64}$/.test(info.sourceRevision))
      buildSourceRevision = info.sourceRevision;
    isRelease = true;
  } catch {}
  if (isRelease) document.querySelectorAll('[data-source-only]').forEach((a) => (a.hidden = true));
  const versionLabel =
    buildVersion === 'dev' ? 'DEV' : `${/^\d/.test(buildVersion) ? 'v' : ''}${buildVersion}`;
  $('version').textContent = versionLabel;
  $('landing-version').textContent = `Version ${versionLabel}`;
  const params = new URLSearchParams(location.search);
  const libraryHandoff = readMissionLibraryHandoff(params);
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
        'This practice tab has no configuration. Open the Playground and choose Play configuration.',
      );
    const prepared = await prepareScenario(JSON.parse(raw), { classRecipes: classRegistry });
    scenario = prepared.scenario;
  }
  // Switching source maps inside an authored preview must not turn the same
  // session into an awarding game, even when the configured scenario is cleared.
  const practiceSession = !!scenario;
  const journeyRequest = resolveJourneyRequest(params, {
    mode: 'solo',
    auxiliary: practiceSession,
  });
  const authoredRoute = !practiceSession && (await loadAuthoredJourneyRoute(journeyRequest));
  const authoredJourney = !!authoredRoute;
  const candidateHost = authoredJourney
    ? createCandidateSoloHost(authoredRoute.source, {
        themes: authoredJourneyUsesActorMaterials(authoredRoute.id)
          ? journeyActorThemeCandidates((await getJSON('content-design/themes.json')).themes, {
              includeOriginals: authoredRoute.preserveOriginalThemes === true,
            })
          : (await getJSON('content-design/themes.json')).themes,
        buildVersion,
        corePackIds: authoredRoute.corePackIds,
        optionalCampaignIds: authoredRoute.optionalCampaignIds,
      })
    : null;
  const journeyPreferences = authoredJourney ? createJourneyPreferences({ window }) : null;
  function difficultyLabel(entry) {
    return candidateHost?.owns(entry)
      ? entry.difficulty[0].toUpperCase() + entry.difficulty.slice(1)
      : legacyDifficultyLabel(entry);
  }
  const journeyEnabled = (params.get('journey') === '1' || authoredJourney) && !practiceSession;
  const journeySaveNotice = journeyEnabled ? attachJourneySaveNotice({ document }) : null;
  const journeyAuthority =
    journeyEnabled && !authoredJourney
      ? createJourneyAuthority({
          baseCampaign,
          pins: await getJSON('content/journey-campaign-pins.json'),
        })
      : null;
  const journeyCatalog =
    candidateHost?.catalog ??
    journeyFromPackCatalog(baseCampaign, preparePackCatalog(packCatalogSource));
  const journeyProfile = journeyEnabled
    ? createJourneyProfileStore({
        profileKey: authoredRoute?.profileKey,
        onStatus: (status) => journeySaveNotice.update(status),
      })
    : null;
  if (journeyProfile) await journeyProfile.load();
  let journeyChooser = null,
    unifiedLibrary = null,
    unifiedLibraryLoading = null,
    unifiedChooser = null,
    disposeUnifiedPreview = null,
    cancelUnifiedOpening = null,
    retiredJourneyChooser = null,
    unifiedOpenRevision = 0,
    unifiedLaunchRevision = 0,
    unifiedDisposed = false,
    journeySkipArmed = null,
    journeyLaunch = null;
  $('creator-tools').hidden = practiceSession;
  let packLaunchRequest = null,
    packLaunchError = '';
  if (!practiceSession && !authoredJourney && !libraryHandoff)
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
    throw new Error('Return to Controller practice and choose Load practice to continue.');
  const controllerPreview = attachControllerPreview({ enabled: controllerPreviewRequested });
  const practiceNavigation = attachPracticeNavigation({
    enabled: practiceSession,
    onBlocked: () =>
      warning(
        courseSession
          ? 'Use End course or Return to the game to leave First Flight. Practice grants no rewards.'
          : controllerPreviewRequested
            ? 'Use the Controller practice page’s header links to leave practice.'
            : 'Use the Playground page’s header links to open the solo game. This preview stays in practice.',
      ),
  });
  // Each archived release keeps its own profile schema, packs and save slot.
  // A portable complete backup transfers progress without changing older versions.
  const channel = isRelease ? `release-${buildVersion}` : 'dev';
  const libraryKey = `revealline.library.${channel}.v1`;
  const packsKey = `revealline.packs.${channel}.v1`;
  // Candidate saves are revision-pinned and independent of Legacy/release slots.
  const sessionKey = authoredJourney
    ? authoredRoute.sessionKey
    : `revealline.suspended.${channel}.v1`;
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
      contentStatus('Pack storage updated; your newer play selection was kept.');
    },
    onError: (error) => {
      const message = `A committed pack change needs a reload before it can appear: ${error.message}`;
      contentStatus(message, true);
      // Persistent storage reconciliation is a system notice, not a flight event.
      warning(message, null, 'host.storage');
    },
  });
  globalThis.RevealLineBoot?.progress?.('Reading your saved flight and installed chapters…');
  const writer = scenario
    ? {
        writable: false,
        reason:
          'Practice keeps its settings in this preview. Open the solo game to save campaign progress.',
        release() {},
      }
    : await claimProfileWriter(navigator.locks, `${libraryKey}.writer`);
  let pictureManager = null;
  const getPictureManager = () =>
    (pictureManager ??= createManagedMediaStore({ storyMedia: true, soundtrackCatalogue: true }));
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
      throw new Error('Safe chapter recovery requires Web Locks. Stored data is preserved.');
    const raw = await readAssetStore(packsKey);
    return { status: 'checked', packs: raw ? await importPackLibrary(raw) : emptyPackLibrary() };
  }
  async function checkedChapters(options) {
    const snapshot = await inspectChapters(options);
    if (snapshot.status !== 'checked')
      throw new Error(
        `Pending ${snapshot.reason}: recover the exact files before adopting stored chapters. Both journals are preserved when ambiguous.`,
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
    if (candidateHost)
      throw new Error(
        'Use the ordinary game for Legacy game-data backups. Authored test progress and attempts have separate exports.',
      );
    if (externalBackup) return externalBackup.assertSupported(options);
    const snapshot = await checkedChapters();
    if (snapshot.index?.chapters.length)
      throw new Error(
        'External chapter backup/transfer is not supported in this source pilot yet. Keep the exact descriptor, gameplay and originals files. No stored data was changed.',
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
        'External chapter backup recovery needs its compatible adapter. Stored data is preserved.',
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
    sessionKey: authoredJourney ? `revealline.suspended.${channel}.v1` : sessionKey,
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
          `Pending ${chapters.reason}; use the exact pilot recovery files. Ambiguous journals were left untouched.`,
        );
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
    loaded.warning = `Stored collection was not adopted: ${error.message} This session starts with base content; your stored bytes remain untouched.`;
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
  let returnStorage;
  try {
    returnStorage = sessionStorage;
  } catch {
    /* Team remains reachable without this hint. */
  }
  const modeReturn = createModeReturn({
    storage: returnStorage,
    baseURL: location.href,
    authority: { channel, version: buildVersion, sourceRevision: buildSourceRevision },
  });
  const modeReturnV2 = createModeReturnV2({
    storage: returnStorage,
    baseURL: location.href,
    authority: { channel, version: buildVersion, sourceRevision: buildSourceRevision },
  });
  const returnContext =
    !practiceSession &&
    !courseSession &&
    !packLaunchRequest &&
    !libraryHandoff &&
    storedStateAdopted
      ? new URLSearchParams(location.search).has('mode-return-v2')
        ? modeReturnV2.consume(location.search)
        : (() => {
            const selection = modeReturn.consume(location.search);
            return selection ? { selection, focus: 'team' } : null;
          })()
      : null;
  const returnedSelection = returnContext?.selection ?? null;
  const returnedMission = returnedSelection
    ? resolveSelectionBookmark(
        { ...returnedSelection, format: 'revealline-selection.v1' },
        {
          select: (key) => executionCatalog.select(key, library.preferences.campaignDifficulty),
          playable: (entry, index) =>
            difficultyNavigation.playable(
              entry,
              library.campaigns,
              progressFor(library, entry.campaign),
              index,
            ),
        },
      )
    : null;
  const exactReturn =
    returnedMission?.levelId === returnedSelection?.levelId &&
    returnedMission?.themeId === returnedSelection?.themeId &&
    !!returnedMission;
  const rememberedSelection = exactReturn
    ? returnedMission
    : !practiceSession &&
        !packLaunchRequest &&
        !libraryHandoff &&
        !packLaunchError &&
        storedStateAdopted
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
    if (candidateHost)
      activeEntry = candidateHost.select(
        journeyCatalog.missions[0],
        journeyPreferences.snapshot().difficulty,
      );
    campaign = activeEntry.campaign;
    classRegistry = activeEntry.classRecipes;
    themesFile.themes = activeEntry.themes;
    progress = progressFor(library, campaign);
  }
  if (loaded.warning || packWarning) {
    $('save-warning').textContent = [loaded.warning, packWarning].filter(Boolean).join(' ');
    show('save-warning', true);
  }
  const initialSelection = candidateHost
    ? { levelIndex: 0, overview: false }
    : difficultyNavigation.selection(activeEntry, library.campaigns, progress, {
        levelId: rememberedSelection?.levelId,
      });
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
    runMessageCue = null,
    bodyWarning = '',
    lastReplay = null,
    replayFeedback = null,
    replayFocusClearance = null,
    missionReplacementFocusClearance = null,
    replayDownload = null,
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
    modeDeparture = null,
    missionReplacement = null,
    restartRequest = null,
    resultAttempt = null,
    resultAttemptEpoch = 0,
    worldAttempt = null,
    worldPlayEpoch = 0,
    modeDepartureHold = false,
    titleFlightHold = false,
    lastOwnedAttempt = null,
    contentSwitchBusy = false,
    backupBusy = false,
    flightDetails = null;
  const worldPlayIntents = new WeakMap();
  const journeyReactions = attachJourneyReactions();
  const flightInformation = attachFlightInformation({
    element: $('run-message'),
    getState: () => ({ started, paused }),
    writeWarning(message, cue) {
      runMessageCue = cue;
      $('run-message').dataset.cue = cue || '';
      $('run-message').textContent = message;
      captionUntil = (run?.time || 0) + 5;
      return { fullText: message, cue, expiresAt: captionUntil };
    },
  });
  const packLaunchGuard = createPackLaunchGuard();
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
        $('mastery-announcement').textContent = status.message;
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
  if (candidateHost) {
    classId = 'scout';
    bodyId = theme.player;
  }
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
  const audioMaster = createAudioMaster();
  const audioPreferences = createAudioPreferences({
    audioMaster,
    window,
    getStorage: () => localStorage,
    fallback: {
      muted: !library.preferences.musicEnabled,
      volume: library.preferences.masterVolume,
    },
    writable: () =>
      !practice && !courseSession && !courseEntry && persistenceReady && writer.writable,
    onWarning: (message) => {
      if (message) warning(message);
    },
  });
  const displayPreferences = createDisplayPreferences({
    window,
    matchMedia,
    getStorage: () => localStorage,
    legacyPreferences: library.preferences,
    writable: () =>
      !practice && !courseSession && !courseEntry && persistenceReady && writer.writable,
    onWarning: (message) => {
      $('display-preferences-status').textContent = message;
    },
  });
  const stopDisplayView = displayPreferences.subscribe(applyDisplayPreferences);
  const displayRestoration = attachPreferenceRestoration({
    window,
    getSnapshot: () => displayPreferences.snapshot(),
    render: applyDisplayPreferences,
  });
  const menuStyle = attachMenuStyleControls({
    document,
    window,
    getStorage: () => localStorage,
    writable: () =>
      !practice && !courseSession && !courseEntry && persistenceReady && writer.writable,
  });
  const sound = new Soundscape({ persistentMusic: true, audioMaster });
  // The shared authority owns master attenuation; local music and effects keep their faders.
  sound.configure({ master: 1 });
  const compactCredit = attachMusicCredit({
    document,
    root: $('settings-panel-audio'),
    pauseButton: $('pause-button'),
    prefix: 'solo',
  });
  let musicPreviewState = null,
    musicPreviewRequest = 0;
  function renderMusicPreview() {
    if (!musicPreviewState) return;
    const track = musicPreviewState.track;
    compactCredit.render(musicPreviewState, audioMaster.snapshot());
    const audible =
      musicPreviewState.playing &&
      !audioMaster.snapshot().muted &&
      audioMaster.snapshot().volume > 0 &&
      musicPreviewState.volume > 0;
    let source;
    try {
      source = new URL(track?.websites?.[0]?.url ?? track?.rights?.source);
    } catch {}
    for (const prefix of ['game-now-playing', 'shell-now-playing']) {
      const playing = $(prefix);
      playing.hidden = !audible || !track || track.kind === 'synth';
      $(`${prefix}-title`).textContent = track
        ? `♫ ${track.title}${track.artist ? ` · ${track.artist}` : ''}`
        : '';
      playing.title = track?.fileName ? `Original file: ${track.fileName}` : '';
      const website = $(`${prefix}-source`);
      website.hidden =
        !source ||
        !['https:', 'http:'].includes(source.protocol) ||
        !!source.username ||
        !!source.password;
      if (!website.hidden) website.href = source.href;
      else website.removeAttribute('href');
    }
    $('music-preview').textContent = ['blocked', 'error'].includes(musicPreviewState.status)
      ? 'Audio is unavailable'
      : musicPreviewState.playing
        ? audioMaster.snapshot().muted
          ? 'Playlist playing · master sound muted'
          : 'Soundtrack playing ♫'
        : 'Play selected playlist ♫';
  }
  const renderMasterPreferences = ({ muted, volume }) => {
    $('master-volume').value = volume;
    $('sound-button').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    $('settings-master-mute').textContent = muted ? 'Unmute sound' : 'Mute sound';
    $('shell-sound').textContent = muted ? 'Sound: off' : 'Sound: on';
    $('shell-sound').setAttribute('aria-pressed', String(!muted));
    renderMusicPreview();
  };
  const stopMasterView = audioMaster.subscribe(renderMasterPreferences);
  const audioRestoration = attachPreferenceRestoration({
    window,
    getSnapshot: () => audioMaster.snapshot(),
    render: renderMasterPreferences,
  });
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
    soundtrackSuspended = false,
    soundtrackLibrary = null,
    soundtrackMenuGesture = false,
    soundtrackLastScene = null,
    soundtrackScene = 'menu';
  let authoredMusic = null,
    soundtrackGeneration = -1,
    soundtrackDisposed = false;
  const soundtrackLoad = new AbortController();
  // This edition explicitly adopts v4. All media adapters share its single ledger;
  // training keeps its existing legacy presentation and never creates picture pins.
  getPictureManager();
  const pictureStore = practice ? null : createStillMediaStore({ managedStore: pictureManager });
  const storyStore = practice ? null : createStoryMediaStore({ managedStore: pictureManager });
  const sessionPictures = createSessionReleasePictures();
  const protectSessionOriginals = (event) => {
    if (!sessionPictures.status().originals) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', protectSessionOriginals);
  let flightPictures = null,
    picturePrewarm = null,
    pictureResume = null,
    pictureThemePending = null,
    pictureGeneration = 0;
  const picturePreparingMessage =
    'Preparing the chosen picture. Flight stays paused until it is ready.';
  const savedFlightRestoredMessage =
    'Saved flight verified and restored. Press Resume to continue.';
  const preparationFeedback = createOperationStatus($('flight-preparation-status'));
  const themeFeedback = createOperationStatus($('theme-preparation-status'));
  let preparationOperation = null;
  function clearPreparation() {
    preparationOperation = null;
    preparationFeedback.clear();
    $('flight-preparation-cancel').hidden = true;
  }
  function beginPreparation(message, cancel, stage = 'preparing', result = false) {
    const operation = { status: preparationFeedback.begin({ message, stage }), cancel, result };
    preparationOperation = operation;
    $('flight-preparation-cancel').hidden = !cancel;
    return {
      update(status) {
        if (preparationOperation !== operation || status.status !== 'preparing') return;
        operation.status.update({
          message: status.message,
          stage: status.stage,
          progress: status.progress ?? null,
        });
      },
      finish(message = '', state = 'ready') {
        if (preparationOperation !== operation) return;
        operation.status.finish({ message, state });
        preparationOperation = null;
        $('flight-preparation-cancel').hidden = true;
      },
    };
  }
  $('flight-preparation-cancel').onclick = () => {
    const operation = preparationOperation;
    if (!operation) return;
    const restoreFocus = document.activeElement === $('flight-preparation-cancel');
    if (operation.result) {
      operation.cancel({ restoreFocus });
      return;
    }
    operation.cancel();
    clearPreparation();
    preparationFeedback.begin({ message: '' }).finish({
      state: 'cancelled',
      message: 'Preparation cancelled. Your flight remains paused.',
    });
    if (restoreFocus) $('start-button').focus({ preventScroll: true });
  };
  const storyDialog = createStoryDialog({
    audioMaster,
    readMedia: pictureMedia,
    settings: () => ({
      volume: library.cinematicVolume ?? DEFAULT_CINEMATIC_VOLUME,
      masterVolume: audioMaster.snapshot().volume,
      muted: audioMaster.snapshot().muted,
      reducedMotion: displayPreferences.snapshot().effectiveReducedEffects,
    }),
    saveVolume(volume) {
      if (practice || courseEntry)
        throw new Error('Training does not change cinematic preferences.');
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
  victoryStoryButton.textContent = 'Victory story';
  victoryStoryButton.hidden = true;
  document.querySelector('.overlay-actions').append(victoryStoryButton);
  victoryStoryButton.onclick = () => {
    if (practice || run.status !== 'won' || completionWarning) return;
    cancelResultAttempt();
    const notify = flightInformation.captureWarning('host.story', { allowTerminal: true });
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
        throw new Error('This attempt’s exact story poster is unavailable.');
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
        .catch((error) => notify(error.message));
    } catch (error) {
      notify(error.message);
    }
  };
  const legacyPictureButton = document.createElement('button');
  legacyPictureButton.id = 'picture-use-legacy';
  legacyPictureButton.textContent = 'Use original pack artwork';
  legacyPictureButton.hidden = true;
  document.querySelector('.overlay-actions').append(legacyPictureButton);
  let pictureRecovery = null;
  const pictureRecoveryButtons = [
    ['picture-export-data', 'Export game data', () => libraryPanel.open('saves')],
    ['picture-reload', 'Reload saved profile', () => window.location.reload()],
  ].map(([id, label, action]) => {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'button secondary';
    button.textContent = label;
    button.hidden = true;
    button.onclick = action;
    document.querySelector('.overlay-actions').append(button);
    return button;
  });
  function clearPictureRecovery() {
    pictureRecovery = null;
    for (const button of pictureRecoveryButtons) button.hidden = true;
  }
  async function pictureMedia({ signal } = {}) {
    if (!pictureStore) throw new Error('Practice uses its original artwork.');
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
    candidatePicture = null,
  } = {}) {
    if (candidateHost?.owns(entry)) {
      const manifest = entry.manifests.find((item) => item.level.id === nextRun.levelId);
      return createCandidateFlightPictures({
        context: {
          runId: nextRunId,
          executionKey: campaignKey(entry.campaign),
          levelId: nextRun.levelId,
          levelRevision: nextRun.level.revision,
          themeId: manifest.presentation.themeId,
        },
        asset: manifest.background,
        picture: candidatePicture,
      });
    }
    const authoredBackground =
      entry.levelVisuals?.find((item) => item.levelId === nextRun.level.id)?.visualOverrides
        ?.background ??
      entry.visualOverrides?.background ??
      null;
    return createFlightPictures({
      ...(authoredBackground
        ? {
            acquireLegacy: (_choice, options) =>
              acquireAuthoredPicture(authoredBackground, options),
          }
        : {}),
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
      acquire: (request, options) =>
        sessionPictures.has(request.pin)
          ? sessionPictures.acquire(request.pin, options)
          : acquirePresentationImage(request, options),
      pins,
      legacy,
      explicitLegacy,
      prepareSelection: !legacy
        ? (options) =>
            releasePictures.prepareSelection({
              ...options,
              authoredBackground:
                entry.levelVisuals?.find((row) => row.levelId === nextRun.level.id)?.visualOverrides
                  ?.background ??
                entry.visualOverrides?.background ??
                null,
            })
        : undefined,
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
                  'Picture choices changed during chapter readiness. Retry the paused flight.',
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
  function cancelPictureStart({
    retirePrewarm = false,
    preserveRecovery = false,
    preserveResult = false,
    preserveWorld = false,
  } = {}) {
    if (!preserveWorld) {
      // A newer navigation intent also retires an activation still downloading.
      ++worldPlayEpoch;
      cancelWorldAttempt();
    }
    if (!preserveResult) {
      cancelResultAttempt();
      journeyLaunch?.cancel?.();
    }
    // Opening a secondary dialog must not dismiss a settled recovery path.
    // A retry, new context or page retirement still cancels it unconditionally.
    const keepRecovery =
      preserveRecovery &&
      !retirePrewarm &&
      !preparationOperation &&
      !pictureThemePending &&
      pictureRecovery?.owner === flightPictures &&
      pictureRecovery?.run === run &&
      pictureRecovery?.themeId === theme.id;
    if (!keepRecovery) {
      clearPreparation();
      clearPictureRecovery();
      themeFeedback.clear();
    }
    $('theme-preparation-cancel').hidden = true;
    pictureGeneration++;
    if (pictureResume !== null || retirePrewarm) {
      flightPictures?.cancel();
      picturePrewarm = null;
    } else if (picturePrewarm) picturePrewarm.observe = null;
    pictureThemePending?.controller.abort();
    pictureResume = null;
    pictureThemePending = null;
  }
  function pictureFailure(error, notify) {
    if (error?.name === 'AbortError') return;
    const needsWriter = error instanceof ReleasePictureWriteRequiredError;
    pictureRecovery = needsWriter ? { owner: flightPictures, run, themeId: theme.id } : null;
    const message = needsWriter
      ? error.message
      : `Picture unavailable: ${error.message} Your flight remains paused. Retry after restoring its original media.`;
    notify(message);
    // An unjoined prewarm has no launch lease to publish its terminal feedback.
    // Keep other preparation owners in charge of their existing presenter.
    if (pictureResume === null && !preparationOperation && !pictureThemePending)
      preparationFeedback.begin({ message }).finish({ message, state: 'error' });
    for (const button of pictureRecoveryButtons) button.hidden = !needsWriter;
    legacyPictureButton.hidden = !!candidateHost || needsWriter || started || practice;
    if (!started)
      $('start-button').textContent = needsWriter ? 'Check picture →' : 'Retry picture →';
  }
  function warmPicture() {
    const owner = flightPictures;
    if (!owner || owner.ready(theme.id)) return;
    const notify = flightInformation.captureWarning('host.picture');
    const prewarm = { owner, themeId: theme.id, observe: null, latest: null, promise: null };
    picturePrewarm = prewarm;
    prewarm.promise = owner.ensure(theme.id, {
      onStatus(status) {
        if (picturePrewarm !== prewarm || owner !== flightPictures) return;
        prewarm.latest = status;
        prewarm.observe?.(status);
      },
    });
    void prewarm.promise
      .then(() => {
        if (picturePrewarm === prewarm && owner === flightPictures) refreshHUD();
      })
      .catch((error) => {
        if (picturePrewarm !== prewarm || owner !== flightPictures) return;
        picturePrewarm = null;
        pictureFailure(error, notify);
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
    if (
      $('shell-home').open ||
      ($('shell-missions').open && $('shell-missions').dataset.view !== 'brief')
    )
      soundtrackScene = 'menu';
    else if (started && !paused) soundtrackScene = 'gameplay';
    return {
      scene: soundtrackScene,
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
    const { master: _master, ...local } = settings;
    if (!soundtrackPlayer) return sound.configure({ ...local, master: 1 });
    const { style: _style, music, ...mix } = local;
    sound.configure(mix);
    if (music !== undefined) soundtrackPlayer.setVolume(music);
  }
  async function activateAudio({ explicit = false } = {}) {
    if (!soundtrackPlayer) return sound.enable();
    if (soundtrackSuspended) {
      soundtrackSuspended = false;
      // Keep this synchronous with the tap/click that resumed the game. Safari
      // rejects a media play request if a lifecycle resume has crossed an await.
      const wasListening = soundtrackPlayer.snapshot().desired;
      const resumed = soundtrackPlayer.resume();
      if (wasListening) return resumed;
    }
    if (explicit || !soundtrackPlayer.snapshot().track) return soundtrackPlayer.play();
    // Ordinary Resume enables effects but keeps an intentional music-only Pause.
    return sound.enable();
  }
  function setMasterMuted(muted) {
    audioPreferences.setMuted(muted);
    // Only explicit player actions mirror the legacy preference. Playback promises never do.
    const saved = preferences({ musicEnabled: !audioMaster.snapshot().muted });
    const warning = audioPreferences.getWarning() || saved.warning || '';
    return { ok: !warning, warning };
  }
  function setMasterVolume(volume) {
    audioPreferences.setVolume(volume);
    const saved = preferences({ masterVolume: audioMaster.snapshot().volume });
    const warning = audioPreferences.getWarning() || saved.warning || '';
    return { ok: !warning, warning };
  }
  function suspendAudio() {
    soundtrackSuspended = true;
    if (soundtrackPlayer) soundtrackPlayer.suspend();
    else sound.suspend();
  }
  const soundtrackFeedback = createOperationStatus($('soundtrack-summary'));
  let soundtrackLoading = true,
    soundtrackOperation = soundtrackFeedback.begin({
      message: 'Loading music library…',
      stage: 'reading',
    });
  function soundtrackStatus(message, preparation = null) {
    if (preparation) {
      if (!soundtrackOperation) soundtrackOperation = soundtrackFeedback.begin(preparation);
      else soundtrackOperation.update(preparation);
    } else {
      (soundtrackOperation ?? soundtrackFeedback.begin({ message })).finish({ message });
      soundtrackOperation = null;
    }
  }
  async function initializeSoundtrack() {
    try {
      const catalogue = SOUNDTRACK_CATALOGUE;
      if (soundtrackDisposed) return;
      const source = createSoundtrackSource({
        catalogue,
        archives: SOUNDTRACK_ARCHIVES,
        readLocal: (hash) => soundtrackAssets.get(hash),
        installedOnly: () => soundtrackLibrary?.listening?.installedOnly ?? false,
      });
      const audioElement = document.createElement('audio');
      if (typeof audioElement.play !== 'function')
        throw new Error(
          'This browser does not provide file-audio playback. Built-in sound remains available.',
        );
      soundtrackStore = createSoundtrackStore({ managedStore: pictureManager });
      soundtrackPlayer = createSoundtrackPlayer({
        catalogue,
        audioMaster,
        soundscape: sound,
        audioElement,
        readAsset: source.readAsset,
        onChange: (state) => {
          soundtrackPanel?.update(state);
          musicPreviewState = state;
          renderMusicPreview();
          if (soundtrackLoading) return;
          soundtrackStatus(
            state.error ||
              state.notice ||
              state.preparation?.message ||
              (state.track
                ? `${state.track.title} · ${state.status}`
                : 'Choose a playlist or import MP3 songs.'),
            state.preparation,
          );
        },
      });
      soundtrackPlayer.setAuthoredTrack(authoredMusic);
      soundtrackPlayer.setContext(soundtrackContext());
      publishedAudio.setPlayer(soundtrackPlayer);
      if (soundtrackSuspended) soundtrackPlayer.suspend();
      soundtrackPanel = attachSoundtrackPanel({
        audioMaster,
        onMasterMuted: setMasterMuted,
        onMasterVolume: setMasterVolume,
        document,
        store: soundtrackStore,
        player: soundtrackPlayer,
        catalogue,
        readAsset: source.readAsset,
        getContext: soundtrackContext,
        onLibrary: (_library, snapshot) => {
          if (soundtrackDisposed || snapshot.generation < soundtrackGeneration) return;
          soundtrackGeneration = snapshot.generation;
          soundtrackLibrary = _library;
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
        onPlayback: () => {
          soundtrackMenuGesture = true;
        },
        beforeAudio: () => {
          if (soundtrackSuspended) {
            soundtrackSuspended = false;
            return soundtrackPlayer.wake();
          }
        },
      });
      // The studio owns persisted playlist selection. Keep the legacy genre selector
      // only for browsers that cannot attach the file-audio transport.
      $('music-select').closest('label').hidden = true;
      $('music-preview').textContent = 'Play selected playlist ♫';
      $('soundtrack-open').disabled = false;
      $('soundtrack-open').onclick = () => soundtrackPanel.open();
      try {
        const snapshot = await soundtrackStore.read({ signal: soundtrackLoad.signal });
        soundtrackLoading = false;
        if (!soundtrackDisposed && snapshot.generation >= soundtrackGeneration) {
          soundtrackGeneration = snapshot.generation;
          soundtrackAssets = new Map(snapshot.assets.map(({ sha256, blob }) => [sha256, blob]));
          soundtrackLibrary = setCatalogueTracks(
            upgradeSoundtrackLibrary(snapshot.library),
            catalogue.tracks,
          );
          soundtrackPlayer.setLibrary(soundtrackLibrary);
          // This does not play audio. It only makes a selected local MP3 ready
          // before the player taps Start or Play, which iOS requires.
          void soundtrackPlayer.prepare({ allowNetwork: false });
        } else if (!soundtrackDisposed) {
          const state = soundtrackPlayer.snapshot();
          soundtrackStatus(
            state.preparation?.message || state.error || 'Music library ready.',
            state.preparation,
          );
        }
      } catch (error) {
        soundtrackLoading = false;
        if (!soundtrackDisposed)
          soundtrackStatus(
            `Custom music storage: ${error.message}. Built-in playback is available; the studio can retry.`,
          );
      }
    } catch (error) {
      soundtrackLoading = false;
      soundtrackPanel?.dispose();
      soundtrackPlayer?.dispose();
      soundtrackStore?.close();
      soundtrackPlayer = null;
      publishedAudio.setPlayer(null);
      soundtrackPanel = null;
      sound.resumeMusic();
      $('soundtrack-open').disabled = true;
      $('music-select').closest('label').hidden = false;
      if (!soundtrackDisposed) soundtrackStatus(error.message || String(error));
    }
  }
  function cosmeticFeedback(id) {
    const presenter = createOperationStatus($(id));
    let operation = null;
    return {
      dispose: () => presenter.dispose(),
      update(status) {
        if (status.status === 'preparing') {
          if (!operation) operation = presenter.begin(status);
          else operation.update(status);
        } else {
          operation?.finish({
            message: status.status === 'error' ? status.message : '',
            state: status.status === 'error' ? 'error' : 'ready',
          });
          operation = null;
        }
      },
    };
  }
  const craftFeedback = cosmeticFeedback('craft-preparation-status');
  const presentationFeedback = cosmeticFeedback('presentation-preparation-status');
  let compiledPresentationWarning = '';
  function startRememberedMenuMusic(event) {
    if (
      !event.isTrusted ||
      soundtrackMenuGesture ||
      !soundtrackPlayer ||
      document.hidden ||
      audioMaster.snapshot().muted ||
      guideMusicWasPlaying ||
      soundtrackContext().scene !== 'menu'
    )
      return;
    if (
      event.target?.closest?.(
        '#soundtrack-dialog, #sound-button, #music-preview, #soundtrack-open, #shell-music',
      )
    )
      return;
    if (
      event.type === 'keydown' &&
      !['Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
    )
      return;
    soundtrackMenuGesture = true;
    void activateAudio({ explicit: true }).then(
      (ok) => {
        if (!ok) soundtrackMenuGesture = false;
      },
      () => {
        soundtrackMenuGesture = false;
      },
    );
  }
  document.addEventListener('pointerdown', startRememberedMenuMusic);
  document.addEventListener('keydown', startRememberedMenuMusic);
  const painter = new BoardPainter(presets, {
    onAssetStatus: craftFeedback.update,
    onAsset: (message) => {
      const rig = visuals()?.player
        ? 'Custom player artwork keeps the selected body’s rotor anchors. Check alignment.'
        : '';
      const copy = [message, rig, bodyWarning, compiledPresentationWarning]
        .filter(Boolean)
        .join(' ');
      $('asset-warning').textContent = copy;
      show('asset-warning', !!copy);
    },
  });
  // Published presentation is a separate cosmetic release. Loading it never
  // opens the local Asset Studio database or changes a flight's picture pins.
  let presentationHost = null,
    presentationSnapshot = null,
    presentationReady = Promise.resolve(null);
  try {
    presentationHost = createPresentationHost({
      baseURL: new URL('presentation/compiled/', location.href),
    });
    presentationReady = presentationHost
      .load({ onStatus: presentationFeedback.update })
      .then((snapshot) => {
        presentationHost.apply(document.documentElement);
        painter.setPresentation(snapshot);
        presentationSnapshot = snapshot;
        menuStyle.setPresentation(snapshot);
        enemyGuide?.refreshPresentation();
        document.documentElement.dataset.presentationTheme = snapshot.resolved.theme.id;
        return snapshot;
      })
      .catch((error) => {
        if (error.name === 'AbortError') return null;
        compiledPresentationWarning = 'Release artwork is unavailable; source artwork is shown.';
        painter.onAsset('');
        return null;
      });
  } catch {
    compiledPresentationWarning = 'Release artwork is unavailable; source artwork is shown.';
  }
  const publishedAudio = attachPublishedAudio({
    sound,
    ready: presentationReady,
    getHost: () => presentationHost,
    allowMusic: () =>
      (theme.id === 'fpv' || theme.family === 'fpv') && !scenario?.music && !musicOverride,
  });
  const releasePictures = createReleasePictureDefaults({
    getHost: () => presentationHost,
    ready: () => presentationReady,
    executionCatalog: () => executionCatalog,
    readMedia: pictureMedia,
    sessionPictures,
    sessionOnly: () => !writer.writable,
    assertWritable() {
      if (!writer.writable) throw new ReleasePictureWriteRequiredError();
    },
    async commit(store, prepared, options) {
      if (!writer.writable) throw new ReleasePictureWriteRequiredError();
      const snapshot = await checkedChapters({ signal: options.signal });
      const write = () => {
        if (!writer.writable) throw new ReleasePictureWriteRequiredError();
        return store.commit(prepared, options);
      };
      return externalChapters
        ? externalChapters.withCurrent(snapshot, write, { signal: options.signal })
        : write();
    },
  });
  const missionThumbnails = createMissionPictureThumbnails({
    readMedia: pictureMedia,
    onUpdate: () => missionPicker?.sync(),
    render(picture, backdrop) {
      if (!backdrop && picture.visualOverrides?.background?.dataUrl)
        return picture.visualOverrides.background.dataUrl;
      const original = boardPaintSizeForLevel(picture.level),
        scale = Math.min(320 / original.width, 180 / original.height),
        canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(original.width * scale));
      canvas.height = Math.max(1, Math.round(original.height * scale));
      try {
        painter.drawGallery(canvas.getContext('2d'), {
          theme: picture.theme,
          level: picture.level,
          seed: picture.item.seed ?? 1,
          width: canvas.width,
          height: canvas.height,
          ...(backdrop ? { image: backdrop.image, fit: backdrop.fit } : {}),
        });
        return canvas.toDataURL('image/png');
      } finally {
        canvas.width = canvas.height = 0;
      }
    },
  });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    painter.setPresentation(null);
    publishedAudio.close();
    presentationHost?.close();
  });
  applyDisplayPreferences(displayPreferences.snapshot());
  $('tap-steering').checked =
    library.preferences.tapSteering ?? matchMedia('(pointer: coarse)').matches;
  const touchPreferences = createTouchPreferences({
    legacy: library.preferences.touchControls,
    onChange: () => {
      clearInput();
      syncAssistControls();
    },
  });
  syncAssistControls();
  refreshTextSize();
  $('music-select').value = library.preferences.musicGenre;
  $('master-volume').value = audioMaster.snapshot().volume;
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
  function warning(message, cue = null, role = 'host.unknown') {
    return flightInformation.warning(message, cue, role);
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
  const modalNavigation = attachModalNavigation({
    getFallbackFocus: ({ dialog, top }) =>
      dialog.id === 'settings-dialog' && !top ? $('shell-menu') : null,
  });
  const controllerDialog = modalNavigation.topDialog;
  function controllerMenuHint() {
    const b = controllerLabels.menu;
    return `Stick / D-pad: navigate · ${b.confirm}: confirm · ${b.back}: back · ${b.menu}: resume.${library.preferences.controllerBindings ? '' : ' Shoulders / triggers: previous / next · West: confirm · North: back.'}`;
  }
  function manualSupplyAvailable() {
    return (
      arcadeActionCapabilities(run?.level).manualPickup &&
      !!run?.ability.capacity &&
      !!run?.supplies?.length
    );
  }
  function craftSwitchAvailable() {
    return (
      !courseSession &&
      !courseEntry &&
      !campaignOverview &&
      !!run &&
      !['won', 'lost'].includes(run.status) &&
      run.classRecipes.length > 1 &&
      run.hangars.length > 0
    );
  }
  function controllerFlightHint() {
    const b = controllerLabels.flight;
    const actions = arcadeActionCapabilities(run?.level);
    return `Stick / D-pad: steer · ${b.ability}: ${actions.manualAbility ? 'ability' : 'pause'} · ${actions.manualPickup ? (manualSupplyAvailable() ? `${b.pickup}: supply · ` : '') : `${b.pickup}: field guide · `}${b.hangar}: ${craftSwitchAvailable() ? 'hangar' : 'missions'} · ${b.stop}: pause · ${actions.manualBoost ? `${b.boost}: boost · ` : ''}${b.pause}: pause. Lift the stick to keep flying.`;
  }
  function refreshControllerPrompts() {
    controllerDeviceId = controllerFrame?.assigned?.id ?? controllerDeviceId;
    controllerLabels = controllerBindingLabels(
      library.preferences.controllerBindings,
      controllerDeviceId,
    );
    const b = controllerLabels.flight;
    const directions = `Up ${b.up}, down ${b.down}, left ${b.left}, right ${b.right}; ${controllerStickLabel(library.preferences.controllerBindings, 'flight')}.`;
    $('controller-help').textContent =
      `Connect a controller and release its controls once. Both sticks work with the default layout. ${directions} ${controllerFlightHint()} ${controllerMenuHint()} Confirm a select or slider to edit; confirm again to apply or go back to cancel. Change your layout in Settings → Controller controls. Steam Deck: use a Gamepad layout for your browser in Steam Input. The system/Home button belongs to your device.`;
    $('controller-ui-hint').textContent =
      controllerScope() === 'flight' ? controllerFlightHint() : controllerMenuHint();
    controllerReading?.refresh();
    controllerNavigation?.refreshReadingHint();
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
  const availableFocusTarget = (element) =>
    !!element?.isConnected &&
    !element.disabled &&
    !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
    element.getClientRects().length > 0 &&
    document.defaultView?.getComputedStyle(element).visibility !== 'hidden';
  function controllerFocus() {
    const dialog = controllerDialog();
    if (dialog) {
      if (dialog.id === 'hangar-dialog') return $('switch-class-select');
      if (dialog.id === 'collection-dialog')
        return $('gallery-grid').querySelector('button') || $('gallery-search');
      return [...dialog.querySelectorAll('button,select,summary')].find(availableFocusTarget);
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
    const dialog = controllerDialog();
    if (dialog) {
      if (dialog.id === 'profile-recovery-dialog') {
        void profileRecovery.close();
        return;
      }
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
      else if (dialog.open)
        $('controller-ui-hint').textContent =
          'This operation is still in progress. Use its Cancel action when available.';
      return;
    }
    const scope = controllerScope();
    if (courseBlocked()) return;
    if (resultAttempt) {
      cancelResultAttempt({ restoreFocus: true });
      return;
    }
    if (journeyLaunch && preparationOperation?.result) {
      $('flight-preparation-cancel').click();
      controllerFocus()?.focus({ preventScroll: true });
      return;
    }
    if (pictureResume !== null && preparationOperation?.cancel === cancelPictureStart) {
      // Back cancels only this launch owner, after any native modal has handled it.
      $('flight-preparation-cancel').click();
      $('start-button').focus({ preventScroll: true });
      return;
    }
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
    getTouchSettings: () => touchPreferences.snapshot(),
    touchEnabled: () => library.preferences.screenControls !== 'off',
    tapMode: () => $('tap-steering').checked,
    active: () =>
      started &&
      !paused &&
      !courseBlocked() &&
      !courseEntryHold &&
      !dialogOpen() &&
      run?.status === 'running',
    onGamepad: (message) => ($('input-status').textContent = message),
    getBindings: () => library.preferences.keyboardBindings,
    readControllerCommand: () => controllerFrame?.flight,
    onClear: () => {
      cancelControllerToggleBoost(controller, controllerFrame);
      refreshControllerBoostCue();
    },
  });
  function readingPrompt({ scrollable }) {
    const mode = document.body.dataset.inputMode;
    const scroll = !scrollable
      ? 'All text is visible'
      : mode === 'controller' || mode === 'keyboard'
        ? 'Up/Down scroll'
        : 'Scroll to read';
    const exit =
      mode === 'controller'
        ? `${controllerLabels.menu.confirm} or ${controllerLabels.menu.back}`
        : mode === 'keyboard'
          ? 'Enter, Space or Escape'
          : 'Done reading';
    return `${scroll} · ${exit} returns`;
  }
  function setInputModality(mode) {
    if (document.body.dataset.inputMode === mode) return;
    if (mode === 'controller') input.releaseLocalControls();
    else input.clearPhysical();
    document.body.dataset.inputMode = mode;
    refreshInputPresentation();
    controllerNavigation?.refreshReadingHint();
  }
  function refreshInputPresentation() {
    const chrome = hasCompactArcadeArena(run?.level) ? 'compact' : 'full';
    if (document.body.dataset.arenaChrome !== chrome) document.body.dataset.arenaChrome = chrome;
    const captions = hasFieldWarningBand(run?.level) ? 'warnings' : 'notices';
    if (document.body.dataset.fieldCaptions !== captions)
      document.body.dataset.fieldCaptions = captions;
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
    ownsKeyboardEvent: (event) => {
      const dialog = $('settings-dialog'),
        cancel = $('cancel-key-capture');
      return (
        controllerDialog() === dialog &&
        (settingsTabOwnsKey(event, dialog) ||
          (!cancel.hidden && !cancel.disabled && dialog.contains(event.target)))
      );
    },
    onTabBoundary: ({ backward }) => {
      if (!controllerPreview || window.name !== 'revealline-controller-practice')
        return !controllerPreviewRequested
          ? playgroundTabBoundary({ window, suspend: suspendInteraction })
          : false;
      requestControllerPracticeExit({
        window,
        session: params.get('controller-session'),
        backward,
        beforeExit: suspendInteraction,
      });
      // A rejected or retired embedded handoff must not wrap focus back into a
      // stale child. The next deliberate boundary key may try the current lab.
      return true;
    },
    getDefaultFocus: controllerFocus,
    getReadingPrompt: readingPrompt,
    getControlLabels: () => ({
      directions: 'Direction controls',
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
      $('controller-ui-hint').textContent = message;
      controllerReading?.hint(message);
    },
    onReadingChange: (state) => controllerReading?.changed(state),
  });
  controllerReading = attachControllerReading({
    compactOverlay: !courseSession,
    additionalSurfaces: [
      ['help-reading', 'help-read', 'How to play', 'help-reading-unit'],
      ['flight-details-reading', 'flight-details-read', 'Field details', 'flight-details-unit'],
      [
        'collection-reading',
        'collection-read',
        'Achievements and appearances',
        'collection-reading-unit',
      ],
    ],
    getNavigation: () => controllerNavigation,
    getControlLabels: () => controllerLabels.menu,
    getReadingPrompt: readingPrompt,
    getScope: controllerScope,
    pause,
    onTransition: () => clearInput({ preserveNavigation: true }),
  });
  flightDetails = attachFlightDetails({
    read: flightInformation.read,
    pause,
    clearInput,
    topDialog: controllerDialog,
    canOpen: () =>
      started &&
      paused &&
      !courseBlocked() &&
      !campaignOverview &&
      !['won', 'lost'].includes(run?.status),
    onReadingChange: () => controllerReading.refresh(),
    getContext: () => {
      const capabilities = arcadeActionCapabilities(run.level),
        actions = [],
        labels = bindingLabels(resolveKeyBindings(library.preferences.keyboardBindings)),
        buttons = controllerLabels.flight;
      if (capabilities.manualAbility)
        actions.push({
          label: theme.labels.ability,
          detail: `${labels.ability} / ${buttons.ability}. ${Math.max(0, run.ability.cooldownUntil - run.time).toFixed(1)}s cooldown remaining${run.ability.capacity ? `; ${run.ability.ammo}/${run.ability.capacity} charges` : ''}.`,
        });
      if (manualSupplyAvailable())
        actions.push({
          label: 'Supply',
          detail: `${labels.pickup} / ${buttons.pickup}. Collect a nearby supply for this craft.`,
        });
      if (capabilities.manualBoost)
        actions.push({
          label: 'Boost',
          detail: `${labels.boost} / ${buttons.boost}. Uses the configured Hold/Toggle control.`,
        });
      if (craftSwitchAvailable())
        actions.push({
          label: 'Change craft',
          detail: `${labels.hangar} / ${buttons.hangar}. Return to a hangar on safe ground.`,
        });
      const roles = new Map();
      for (const enemy of run.enemies) roles.set(enemy.type, (roles.get(enemy.type) || 0) + 1);
      return {
        mission: run.level.name,
        goal: `Reveal ${(run.level.goal.coverage * 100).toFixed(1)}% of the picture.`,
        steering: `Release a direction to keep flying.${run.rules.stopOnCapture ? ' Closing a cut stops your craft; choose a fresh direction.' : ''}`,
        objectiveLabel: theme.labels.objective,
        actorRoles: [...roles].map(([type, count]) => ({ type, count })),
        actions,
      };
    },
  });
  const enemyWorkshopReturn = attachEnemyWorkshopReturn({
    enabled: practiceSession && !courseSession && !controllerPreviewRequested,
    onReturn: () => pause(true),
  });
  enemyGuide = attachEnemyGuide({
    themes: guideThemes,
    getPresentation: () => presentationSnapshot,
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
      if (!soundtrackDisposed && guideMusicWasPlaying && !document.hidden && document.hasFocus())
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
    enemyGuide.open();
  };
  handlePageHide = (event) => {
    cancelUnifiedOpening?.();
    ++unifiedOpenRevision;
    ++unifiedLaunchRevision;
    // Suspend while this tab still owns the writer. A history-cache return
    // keeps its memory available for export without reclaiming stale storage.
    if (courseEntry) cancelCourseEntry();
    cancelModeDeparture({ close: true });
    cancelMissionReplacement();
    invalidateRestart('Restart cancelled when leaving this page.');
    optionalWorlds?.close(false);
    invalidateContentSwitch();
    pause(true);
    masteryAwards.cancelAll();
    cancelRestore();
    cancelPictureStart({ retirePrewarm: true });
    missionThumbnails.cancel();
    clearInput();
    if (replayDownload) replayDownload.observed = false;
    replayFeedback?.clear();
    suspendAudio();
    writer.release();
    flightDetails.suspend();
    flightInformation.suspend();
    persistenceReady = false;
    controllerPreview?.clear();
    if (!event.persisted) {
      touchPreferences.destroy();
      flightDetails.dispose();
      flightInformation.dispose();
      document.removeEventListener('pointerdown', startRememberedMenuMusic);
      document.removeEventListener('keydown', startRememberedMenuMusic);
      journeyReactions.dispose();
      soundtrackDisposed = true;
      soundtrackLoad.abort();
      enemyGuide.dispose();
      optionalWorlds?.dispose();
      soundtrackPlayer?.dispose();
      soundtrackPanel?.dispose();
      stopMasterView();
      stopDisplayView();
      compactCredit.dispose();
      audioRestoration.dispose();
      displayRestoration.dispose();
      displayPreferences.dispose();
      menuStyle.dispose();
      audioPreferences.dispose();
      audioMaster.dispose();
      soundtrackStore?.close();
      flightPictures?.dispose();
      candidateHost?.preparer.dispose();
      unifiedDisposed = true;
      unifiedChooser?.destroy();
      unifiedLibrary?.library.dispose();
      disposeUnifiedPreview?.();
      journeyPreferences?.dispose();
      missionThumbnails.close();
      libraryPanel.dispose();
      window.removeEventListener('beforeunload', protectSessionOriginals);
      sessionPictures.dispose();
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
      for (const feedback of contentFeedback) feedback.presenter.dispose();
      preparationFeedback.dispose();
      themeFeedback.dispose();
      soundtrackFeedback.dispose();
      craftFeedback.dispose();
      presentationFeedback.dispose();
      replayFeedback?.dispose();
      replayFocusClearance?.destroy();
      missionReplacementFocusClearance?.destroy();
    }
  };
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    flightInformation.resume();
    restoreListening();
    controller.invalidate();
    clearInput();
    pause(true);
    $('save-warning').textContent =
      'This tab returned from browser history in session-only mode. Export game data and any session originals from Game data before leaving this tab. Reload opens the latest saved profile; it does not keep session-only progress.';
    show('save-warning', true);
    void packCommits.reconcile();
    if ($('settings-dialog').open) void storageRetention.refresh();
  });
  function refreshKeyPrompts() {
    const bindings = resolveKeyBindings(library.preferences.keyboardBindings);
    const labels = bindingLabels(bindings);
    const actions = arcadeActionCapabilities(run?.level);
    const description = `Tap a direction to fly. Tap another to turn. Up ${labels.up}; down ${labels.down}; left ${labels.left}; right ${labels.right}; ${actions.manualAbility ? `ability ${labels.ability}; ` : ''}${manualSupplyAvailable() ? `supply ${labels.pickup}; ` : ''}${actions.manualBoost ? `boost ${labels.boost}; ` : ''}${craftSwitchAvailable() ? `change craft ${labels.hangar}; ` : ''}pause ${labels.pause}. Releasing a direction keeps you moving.${run?.rules.stopOnCapture ? ' Closing a cut stops your craft; tap a fresh direction to fly again.' : ''}`;
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
    $('stop-button').hidden = true;
    for (const button of document.querySelectorAll('[data-move]'))
      button.title = `Move ${button.dataset.move} · ${labels[button.dataset.move]}`;
    if (!started && !campaignOverview)
      $('overlay-footnote').textContent =
        `Tap a direction to fly. ${actions.manualAbility ? 'Equipment controls are in How to play.' : 'Bonuses activate on contact.'} ${labels.pause} pauses.`;
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
              'Keys changed for this session. Export your library to retain session-only preferences.',
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
              'Controller controls changed for this session. Export your library to retain session-only preferences.',
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
    const progressText = `${Object.values(courseVisit).filter((value) => value === 'complete').length} / ${FIRST_FLIGHT_LESSONS.length} lessons this visit`;
    if ($('campaign-progress').textContent !== progressText)
      $('campaign-progress').textContent = progressText;
    const lesson = getFirstFlightLesson(courseRequest.lessonId);
    const task =
      coursePhase === 'ended'
        ? 'Course ended. Use the parent page’s game link to return.'
        : snapshot?.outcome === 'lost'
          ? 'Read the loss explanation, then retry or choose another lesson.'
          : snapshot?.outcome === 'missed'
            ? 'Picture revealed. Retry the suggested example or skip it.'
            : snapshot?.outcome === 'complete'
              ? 'Lesson complete. Enjoy the picture or choose your next lesson.'
              : snapshot?.available === false
                ? 'Guidance is unavailable. You can still play, retry, skip or leave.'
                : lesson.steps.find((item) => item.id === snapshot?.stepId)?.instruction ||
                  lesson.summary;
    const text = `${task}${
      snapshot?.territoryKept && run?.status === 'respawning'
        ? ' Your unfinished line was cancelled; earlier secured territory is kept.'
        : ''
    }`;
    if ($('first-flight-task').textContent !== text) $('first-flight-task').textContent = text;
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
      error: 'Guidance is unavailable for this attempt. You can still play, retry, skip or leave.',
    };
    courseObserver = null;
  }
  function cancelCourseEntry(message = 'Course entry cancelled. Your flight remains paused.') {
    if (!courseEntry) return;
    courseEntry.controller.abort();
    courseEntry = null;
    courseEntryMessage = message;
    clearInput();
    refreshCourse();
  }
  async function enterFirstFlight() {
    if (
      practice ||
      courseSession ||
      courseEntry ||
      modeDeparture ||
      missionReplacement ||
      restartRequest
    )
      return;
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
    courseEntryMessage = 'Preparing First Flight. Your current flight stays paused.';
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
        throw new DOMException('Course entry was cancelled by a newer change.', 'AbortError');
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
              throw new Error('Stored data needs recovery before this flight can be retained.');
          },
          withStorageLock: (work) => {
            if (!navigator.locks?.request)
              throw new Error('This browser cannot retain the flight safely before navigation.');
            return navigator.locks.request(
              `${libraryKey}.backup-lock`,
              { signal: ticket.controller.signal },
              work,
            );
          },
          signal: ticket.controller.signal,
          onProgress: ({ ticks, total }) => {
            if (courseEntry !== ticket) return;
            courseEntryMessage = `Verifying your saved flight: ${ticks} / ${total} ticks.`;
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
      courseEntryMessage = `${error.message} Your flight remains paused here. You can return to it or use its export controls.`;
      clearInput();
      refreshCourse();
      $('first-flight-help-enter').focus({ preventScroll: true });
    }
  }
  const catalogueHref = authoredRoute ? './?journey=legacy' : './';
  const catalogueLabel = authoredRoute ? 'Legacy missions' : 'New Journey';
  const modeDestinations = Object.freeze({
    ...(authoredModeDestinations('solo', authoredRoute?.id ?? 'legacy') ?? {
      team: 'couch/relay-rescue.html?journey=legacy&return=solo',
      versus: 'couch/?journey=legacy&return=solo',
    }),
    catalogue: catalogueHref,
    library: './',
  });
  for (const kind of ['versus', 'team'])
    for (const id of [`shell-title-${kind}`, `shell-${kind}`])
      $(id)?.setAttribute('href', modeDestinations[kind]);
  if (authoredRoute) {
    $('shell-team').textContent =
      authoredRoute.id === 'whole-spatial-v5'
        ? '12 Team missions · 2 players'
        : 'Separate Team arenas · 2 players';
  }
  const modeLabel = (kind) =>
    kind === 'library'
      ? 'selected mission'
      : kind === 'catalogue'
        ? catalogueLabel
        : kind === 'versus'
          ? 'Versus'
          : 'Team';
  const currentAuthoredModeRoute = () =>
    candidateHost?.owns(activeEntry) ? authoredRoute.id : null;
  const modeDestination = (ticket) =>
    ticket.libraryHref ||
    authoredJourneyModeHref(ticket.journeyRouteId, ticket.kind) ||
    modeDestinations[ticket.kind];
  function syncAuthoredModeLinks() {
    const href =
      authoredJourneyModeHref(currentAuthoredModeRoute(), 'versus') || modeDestinations.versus;
    for (const id of ['shell-versus', 'shell-title-versus']) $(id).setAttribute('href', href);
  }
  function prepareModeHint(ticket) {
    if (ticket.kind === 'library') return { token: null, href: ticket.libraryHref };
    if (ticket.kind === 'catalogue')
      return { token: null, href: new URL(catalogueHref, location.href).href };
    // Authored progress and suspended attempts already have their own route.
    // Do not write a Legacy selection bookmark for a candidate execution.
    if (ticket.journeyRouteId)
      return { token: null, href: new URL(modeDestination(ticket), location.href).href };
    return ticket.kind === 'versus'
      ? modeReturnV2.prepare({
          origin: 'solo-missions',
          destination: 'versus',
          selection: ticket.selection,
        })
      : modeReturn.prepare(ticket.selection);
  }
  function clearModeHint(ticket) {
    if (ticket.token) (ticket.kind === 'versus' ? modeReturnV2 : modeReturn).clear(ticket.token);
  }
  function cancelModeDeparture({ close = false, restore = false, clearHint = false } = {}) {
    const ticket = modeDeparture;
    if (!ticket) return;
    ticket.controller.abort();
    modeDeparture = null;
    if (clearHint) clearModeHint(ticket);
    if (close && $('mode-leave-dialog').open) $('mode-leave-dialog').close();
    if (
      restore &&
      ticket.kind === 'library' &&
      !document.hidden &&
      document.hasFocus?.() !== false
    ) {
      unifiedChooser?.restore();
      return;
    }
    if (
      restore &&
      (ticket.origin !== 'solo-title' || ticket.isCurrent()) &&
      !document.hidden &&
      document.hasFocus?.() !== false &&
      availableFocusTarget(ticket.opener)
    )
      ticket.opener.focus({ preventScroll: true });
    // As with First Flight, only explicit Resume/new attempt releases the save hold.
  }
  function modeSelection() {
    return {
      campaignKey: activeEntry.baseCampaignKey || campaignKey(campaign),
      levelId: campaign.levels[levelIndex].id,
      themeId: theme.id,
    };
  }
  function modeDepartureCurrent(ticket) {
    if (
      document.hidden ||
      document.hasFocus?.() === false ||
      modeDeparture !== ticket ||
      ticket.controller.signal.aborted ||
      (ticket.origin === 'solo-title' && !ticket.isCurrent()) ||
      (ticket.libraryTarget &&
        unifiedLibrary?.library.find(ticket.libraryTarget.id) !== ticket.libraryTarget) ||
      run !== ticket.run ||
      recorder !== ticket.recorder ||
      runId !== ticket.runId ||
      campaign !== ticket.campaign ||
      currentAuthoredModeRoute() !== ticket.journeyRouteId ||
      libraryGeneration !== ticket.generation ||
      canonicalJSON(modeSelection()) !== canonicalJSON(ticket.selection)
    )
      throw new Error(
        `The flight, selected mission or foreground changed. Stay here and choose ${modeLabel(ticket.kind)} again.`,
      );
  }
  function modeDepartureMessage(ticket) {
    const flight = !ticket.unfinished
      ? 'No unfinished flight is being replaced.'
      : ticket.savedRaw
        ? 'Your paused flight was saved and verified. Continue can restore it after returning.'
        : 'This current flight is session-only: it remains paused in this tab. Leaving may lose this attempt. This flight was not verified as safely saved.';
    $('mode-leave-status').textContent = `${flight} ${
      ticket.kind === 'library'
        ? `This opens ${ticket.libraryTarget.name} directly. Its original rules and progression remain separate.`
        : ticket.kind === 'catalogue'
          ? `This opens ${catalogueLabel}. Its missions and progress stay separate. Returning does not resume a flight automatically.`
          : ticket.journeyRouteId
            ? `This opens ${ticket.kind === 'team' ? 'the separate Team arenas' : 'Versus with its own Journey progress'}. Returning opens this Solo Journey title; Continue stays explicit.`
            : ticket.origin === 'solo-title'
              ? `Back from ${modeLabel(ticket.kind)} opens Solo’s title; it does not resume a flight.`
              : ticket.fallback
                ? `Return context is unavailable. Back from ${modeLabel(ticket.kind)} will open Solo’s title.`
                : `Back from ${modeLabel(ticket.kind)} returns to this Missions selection; it does not resume a flight.`
    }`;
  }
  function unfinishedFlight() {
    return started && ['running', 'respawning'].includes(run?.status);
  }
  async function retainNavigationFlight(ticket, assertCurrent, onProgress) {
    const retained = await retainFlightForFirstFlight({
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
      signal: ticket.controller.signal,
      assertCurrent,
      assertWritable: async () => {
        assertWriter();
        const currentSaved = localStorage.getItem(sessionKey);
        if (currentSaved !== null && currentSaved !== lastOwnedAttempt)
          throw new Error(
            'The saved flight is not this tab’s last verified save. Its bytes were kept.',
          );
        if (!storedStateAdopted || recovery !== null || (await readAssetStore(journalKey)) !== null)
          throw new Error('Stored data needs recovery before this flight can be retained.');
      },
      withStorageLock: (work) => {
        if (!navigator.locks?.request)
          throw new Error('Checked saving is unavailable in this browser.');
        return navigator.locks.request(
          `${libraryKey}.backup-lock`,
          { signal: ticket.controller.signal },
          work,
        );
      },
      onProgress,
    });
    assertCurrent();
    const raw = localStorage.getItem(sessionKey);
    if (!attemptReadbackMatches(raw, retained.session))
      throw new Error('The checked saved flight changed before departure was ready.');
    ticket.savedRaw = raw;
    lastOwnedAttempt = raw;
  }
  async function requestModeDeparture(
    kind,
    event,
    opener,
    { origin = 'solo-missions', isCurrent = null, libraryTarget = null, libraryMode = 'solo' } = {},
  ) {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      (event.button !== undefined && event.button !== 0)
    )
      return;
    event.preventDefault();
    if (!Object.hasOwn(modeDestinations, kind)) return;
    if (
      kind === 'library' &&
      (unifiedLibrary?.library.find(libraryTarget?.id) !== libraryTarget ||
        !libraryTarget?.modes.includes(libraryMode))
    )
      throw new Error('This mission selection changed. Refresh the library.');
    if (
      !['solo-title', 'solo-missions'].includes(origin) ||
      (origin === 'solo-title' && (typeof isCurrent !== 'function' || !isCurrent()))
    )
      return;
    if (
      document.hidden ||
      document.hasFocus?.() === false ||
      modeDeparture ||
      missionReplacement ||
      restartRequest ||
      courseSession ||
      courseEntry ||
      practice ||
      sessionBusy ||
      contentSwitchBusy ||
      pictureThemePending ||
      backupBusy
    ) {
      warning(`Finish the current operation before choosing ${modeLabel(kind)}.`);
      return false;
    }
    const ticket = {
      kind,
      origin,
      isCurrent,
      opener,
      dialogShown: false,
      controller: new AbortController(),
      run,
      recorder,
      runId,
      campaign,
      generation: libraryGeneration,
      selection: modeSelection(),
      journeyRouteId: currentAuthoredModeRoute(),
      libraryTarget,
      libraryHref:
        kind === 'library'
          ? missionLibraryHref({
              baseURL: location.href,
              currentMode: 'solo',
              mode: libraryMode,
              journey: libraryTarget.collection === 'Journey' ? libraryTarget.editionId : 'legacy',
              missionId: libraryTarget.id,
            })
          : null,
      unfinished: unfinishedFlight(),
      savedRaw: null,
      fallback: false,
      pending: true,
    };
    modeDeparture = ticket;
    if (origin === 'solo-title' && !ticket.unfinished) {
      try {
        modeDepartureCurrent(ticket);
        location.href = new URL(modeDestination(ticket), location.href).href;
      } catch (error) {
        cancelModeDeparture({ restore: true });
        warning(`${modeLabel(kind)} could not open. Your flight remains here. ${error.message}`);
      }
      return;
    }
    if (!ticket.unfinished) {
      let prepared;
      try {
        prepared = prepareModeHint(ticket);
        ticket.token = prepared.token;
        modeDepartureCurrent(ticket);
        location.href = prepared.href;
        return;
      } catch {
        if (prepared) clearModeHint(ticket);
        if (modeDeparture !== ticket || ticket.controller.signal.aborted) return;
        ticket.fallback = true;
      }
    }
    if (ticket.unfinished) modeDepartureHold = true;
    pause(true);
    clearInput();
    $('mode-leave-confirm').disabled = true;
    $('mode-leave-status').textContent = ticket.unfinished
      ? 'Checking the saved flight before leaving. Your current flight stays paused. You can Stay now.'
      : 'Checking the return to Missions…';
    $('mode-leave-title').textContent = `Open ${modeLabel(kind)}?`;
    $('mode-leave-confirm').textContent = `Leave for ${modeLabel(kind)}`;
    ticket.dialogShown = true;
    try {
      $('mode-leave-dialog').showModal();
      $('mode-leave-stay').focus({ preventScroll: true });
    } catch (error) {
      cancelModeDeparture({ close: true, restore: true, clearHint: true });
      warning(`The departure could not open. Your flight remains here. ${error.message}`);
      return;
    }
    try {
      if (ticket.unfinished) {
        await retainNavigationFlight(
          ticket,
          () => modeDepartureCurrent(ticket),
          ({ ticks, total }) => {
            if (modeDeparture === ticket)
              $('mode-leave-status').textContent =
                `Verifying your saved flight: ${ticks} / ${total} ticks. Stay cancels waiting.`;
          },
        );
      }
      modeDepartureCurrent(ticket);
    } catch (error) {
      if (modeDeparture !== ticket || ticket.controller.signal.aborted) return;
      ticket.savedRaw = null;
      ticket.failure = error.message;
    }
    if (modeDeparture !== ticket) return;
    ticket.pending = false;
    $('mode-leave-confirm').disabled = false;
    modeDepartureMessage(ticket);
    if (ticket.failure)
      $('mode-leave-status').textContent += ` Saving was not verified: ${ticket.failure}`;
  }
  $('shell-team').onclick = (event) => requestModeDeparture('team', event, $('shell-team'));
  $('shell-versus').onclick = (event) => requestModeDeparture('versus', event, $('shell-versus'));
  $('mode-leave-dialog').addEventListener('close', () => {
    if ($('mode-leave-dialog').open || !modeDeparture?.dialogShown) return;
    cancelModeDeparture({ restore: true, clearHint: true });
  });
  $('mode-leave-confirm').onclick = () => {
    const ticket = modeDeparture;
    if (!ticket || ticket.pending) return;
    if (document.hidden || document.hasFocus?.() === false) {
      cancelModeDeparture({ close: true, clearHint: true });
      return;
    }
    try {
      modeDepartureCurrent(ticket);
      if (ticket.savedRaw) {
        try {
          assertWriter();
          if (localStorage.getItem(sessionKey) !== ticket.savedRaw)
            throw new Error('Saved flight changed.');
        } catch {
          ticket.savedRaw = null;
          modeDepartureMessage(ticket);
          $('mode-leave-status').textContent +=
            ' The saved flight changed or saving became unavailable. Review this warning before choosing Leave again.';
          return;
        }
      }
      let destination = new URL(modeDestination(ticket), location.href).href;
      if (ticket.origin === 'solo-missions' && !ticket.fallback) {
        try {
          const prepared = prepareModeHint(ticket);
          ticket.token = prepared.token;
          destination = prepared.href;
        } catch {
          ticket.fallback = true;
          modeDepartureMessage(ticket);
          return;
        }
      }
      modeDepartureCurrent(ticket);
      location.href = destination;
    } catch (error) {
      clearModeHint(ticket);
      $('mode-leave-status').textContent = `${error.message} Your flight remains paused here.`;
    }
  };
  function cancelMissionReplacement() {
    const ticket = missionReplacement;
    if (!ticket) return;
    ticket.controller.abort();
    missionReplacement = null;
    if (ticket.installing) invalidateContentSwitch();
    // Keep the checked-save hold until explicit Resume or a new attempt.
  }
  function missionReplacementCurrent(ticket, { installed = false } = {}) {
    if (
      missionReplacement !== ticket ||
      ticket.controller.signal.aborted ||
      run !== ticket.run ||
      recorder !== ticket.recorder ||
      runId !== ticket.runId ||
      campaign !== ticket.campaign ||
      activeEntry !== ticket.entry ||
      libraryGeneration !== ticket.generation ||
      (!installed && packs !== ticket.packs) ||
      classId !== ticket.classId ||
      turnPolicy !== ticket.turnPolicy ||
      scenario !== ticket.scenario ||
      classRegistry !== ticket.classRegistry ||
      courseRequest?.lessonId !== ticket.lessonId ||
      courseBlocked() ||
      (ticket.launch &&
        (!ticket.launch.isCurrent() ||
          canonicalJSON(resolveMissionRequest(ticket.request).identity) !==
            ticket.targetIdentity)) ||
      canonicalJSON(modeSelection()) !== canonicalJSON(ticket.selection)
    )
      throw new Error('The flight or available missions changed. Stay here and choose again.');
  }
  const libraryLaunchKinds = new Set(['library-installed', 'library-challenge', 'library-picture']);
  const isLibraryRequest = (request) => libraryLaunchKinds.has(request.kind);
  function requestLibraryLaunch(descriptor, launch) {
    if (
      !descriptor ||
      !libraryLaunchKinds.has(descriptor.kind) ||
      typeof descriptor.id !== 'string' ||
      descriptor.id.length > 512 ||
      !launch ||
      typeof launch.isCurrent !== 'function' ||
      typeof launch.onSelected !== 'function'
    )
      return Promise.reject(new Error('This Library launch is unavailable.'));
    const request = { kind: descriptor.kind, id: descriptor.id };
    if (request.kind === 'library-picture') {
      if (typeof descriptor.recordIdentity !== 'string' || descriptor.recordIdentity.length > 8192)
        return Promise.reject(new Error('This earned picture identity is unavailable.'));
      request.recordIdentity = descriptor.recordIdentity;
    }
    if (!launch.isCurrent() || !availableFocusTarget(launch.opener)) return Promise.resolve(false);
    return requestMissionReplacement(request, launch.opener, launch);
  }
  function captureWorldPlay({ launch, signal }) {
    if (practice || courseSession || courseEntry || !storedStateAdopted || !persistenceReady)
      throw new Error('Return to the normal game and resolve recovery before playing a chapter.');
    if (!launch?.isCurrent() || signal?.aborted)
      throw new DOMException('Chapter launch cancelled.', 'AbortError');
    const previous = worldAttempt,
      epoch = worldPlayEpoch;
    cancelWorldAttempt();
    if (worldAttempt || worldPlayEpoch !== epoch + (previous ? 1 : 0))
      throw new DOMException('Chapter launch superseded.', 'AbortError');
    const intent = {
      epoch: ++worldPlayEpoch,
      launch,
      signal,
      consumed: false,
      committed: null,
      run,
      recorder,
      runId,
      owner: flightPictures,
      entry: activeEntry,
      campaign,
      levelIndex,
      theme,
      themeOverride,
      seed,
      classId,
      turnPolicy,
      scenario,
      practice,
      started,
      generation: libraryGeneration,
      difficulty: library.preferences.campaignDifficulty,
      writable: writer.writable,
      persistenceReady,
      storedStateAdopted,
    };
    worldPlayIntents.set(launch, intent);
    // Keep the audio gesture before the download/readiness awaits.
    activateAudio().catch(() => {});
  }
  function assertWorldPlay(launch) {
    const intent = worldPlayIntents.get(launch);
    if (
      !intent ||
      intent.consumed ||
      intent.epoch !== worldPlayEpoch ||
      intent.signal?.aborted ||
      !launch.isCurrent() ||
      document.hidden ||
      !document.hasFocus() ||
      run !== intent.run ||
      recorder !== intent.recorder ||
      runId !== intent.runId ||
      flightPictures !== intent.owner ||
      activeEntry !== intent.entry ||
      campaign !== intent.campaign ||
      levelIndex !== intent.levelIndex ||
      theme !== intent.theme ||
      themeOverride !== intent.themeOverride ||
      seed !== intent.seed ||
      classId !== intent.classId ||
      turnPolicy !== intent.turnPolicy ||
      scenario !== intent.scenario ||
      practice !== intent.practice ||
      started !== intent.started ||
      libraryGeneration !== intent.generation ||
      library.preferences.campaignDifficulty !== intent.difficulty ||
      writer.writable !== intent.writable ||
      persistenceReady !== intent.persistenceReady ||
      storedStateAdopted !== intent.storedStateAdopted ||
      courseBlocked() ||
      courseEntry ||
      modeDeparture ||
      restartRequest ||
      contentSwitchBusy ||
      backupBusy ||
      sessionBusy ||
      pictureThemePending
    )
      throw new DOMException(
        'Chapter launch cancelled. Your current flight is kept.',
        'AbortError',
      );
    return intent;
  }
  async function requestWorldPlay(
    pack,
    { signal, launch, onStatus, campaignId, levelId, levelRevision },
  ) {
    assertWorldPlay(launch);
    if (signal?.aborted || (pack !== null && !packs.packs.includes(pack)))
      throw new Error('Installed content changed. Choose Play again.');
    const entry =
      pack === null ? baseEntry : resolvePackCampaign(pack, campaignId ?? pack.campaigns[0].id);
    const request = {
      kind: 'world-play',
      id: campaignKey(entry.campaign),
      sourcePackId: pack?.id ?? null,
      pack,
      ...(pack === null ? { baseEntry } : {}),
      launch,
      signal,
      onStatus,
      ...(levelId !== undefined ? { levelId } : {}),
      ...(levelRevision !== undefined ? { levelRevision } : {}),
    };
    const selected = await requestMissionReplacement(request, launch.opener, launch);
    if (!selected && launch.isCurrent()) {
      if (resolveMissionRequest(request).same)
        preparationStatus(
          onStatus,
          'This chapter is already active. Your current flight is kept paused. Return to the main menu and choose Continue.',
          'ready',
          launch.isCurrent,
        );
      else if (missionReplacement?.launch === launch)
        preparationStatus(
          onStatus,
          'Review Replace & play. Stay keeps your current flight paused.',
          'ready',
          launch.isCurrent,
        );
    }
    return selected;
  }
  function cancelWorldAttempt() {
    const ticket = worldAttempt;
    if (!ticket) return;
    worldAttempt = null;
    ++worldPlayEpoch;
    ticket.controller.abort();
    const pictures = ticket.pictures;
    ticket.pictures = null;
    pictures?.dispose();
  }
  function worldAttemptCurrent(ticket) {
    if (worldAttempt !== ticket || ticket.controller.signal.aborted) return false;
    try {
      if (assertWorldPlay(ticket.request.launch) !== ticket.intent) return false;
      if (ticket.replacement) missionReplacementCurrent(ticket.replacement);
      else if (missionReplacement) return false;
      const backupLock = localStorage.getItem(`${libraryKey}.backup-lock`);
      const savedRaw = localStorage.getItem(sessionKey);
      return (
        worldAttempt === ticket &&
        !ticket.controller.signal.aborted &&
        packs === ticket.packs &&
        (ticket.request.pack === null
          ? ticket.request.baseEntry === baseEntry
          : packs.packs.includes(ticket.request.pack)) &&
        backupLock === ticket.backupLock &&
        savedRaw === ticket.savedRaw &&
        assertWorldPlay(ticket.request.launch) === ticket.intent
      );
    } catch {
      return false;
    }
  }
  function assertWorldArtworkOwner(entry) {
    const key = campaignKey(entry.campaign);
    const presentation = (candidate, themeId) => ({
      theme: candidate.themes.find((item) => item.id === themeId),
      backgrounds: candidate.campaign.levels.map((level) => ({
        id: level.id,
        background:
          candidate.levelVisuals?.find((item) => item.levelId === level.id)?.visualOverrides
            ?.background ??
          candidate.visualOverrides?.background ??
          null,
      })),
      external:
        chapterSnapshot?.index?.chapters.find((item) => item.id === candidate.sourcePackId)?.id ??
        null,
    });
    for (const other of installedEntries) {
      if (other.sourcePackId === entry.sourcePackId || campaignKey(other.campaign) !== key)
        continue;
      for (const theme of entry.themes) {
        if (!other.themes.some((item) => item.id === theme.id)) continue;
        if (
          canonicalJSON(presentation(entry, theme.id)) !==
          canonicalJSON(presentation(other, theme.id))
        )
          throw new Error(
            'These installed editions share a campaign identity but have different artwork. Resolve the conflicting edition in Manage packs before playing. Your current flight is kept.',
          );
      }
    }
  }
  async function prepareWorldAttempt(request, replacement = null) {
    const intent = assertWorldPlay(request.launch);
    if (worldAttempt) return false;
    const target = resolveMissionRequest(request);
    assertWorldArtworkOwner(target.entry);
    const entry = createExecutionCatalog([target.entry]).select(request.id, intent.difficulty);
    if (!entry) throw new Error('This chapter does not support the selected difficulty.');
    const selection = difficultyNavigation.selection(
      entry,
      library.campaigns,
      progressFor(library, entry.campaign),
    );
    const destinationIndex = installedMissionExecutionIndex(target, entry, selection.levelIndex);
    const level = entry.campaign.levels[destinationIndex];
    const nextTheme =
      entry.themes.find((item) => item.id === (level.themeId || entry.campaign.themeId)) ||
      entry.themes[0];
    const nextClassId = entry.classRecipes.some((item) => item.id === classId)
      ? classId
      : entry.classRecipes[0].id;
    const options = { seed, turnPolicy, classId: nextClassId, classRecipes: entry.classRecipes };
    const ticket = {
      request,
      intent,
      replacement,
      packs,
      controller: new AbortController(),
      pictures: null,
      savedRaw: null,
      backupLock: null,
    };
    worldAttempt = ticket;
    const cancel = () => {
      if (worldAttempt === ticket) cancelWorldAttempt();
    };
    const signals = [request.signal, replacement?.controller.signal].filter(Boolean);
    for (const signal of signals) signal.addEventListener('abort', cancel, { once: true });
    const assertCurrent = () => {
      if (!worldAttemptCurrent(ticket))
        throw new DOMException(
          'Chapter launch cancelled. Your current flight is kept.',
          'AbortError',
        );
    };
    try {
      const assertOwner = () => {
        if (
          worldAttempt !== ticket ||
          ticket.controller.signal.aborted ||
          assertWorldPlay(request.launch) !== intent
        )
          throw new DOMException('Chapter launch superseded.', 'AbortError');
      };
      assertOwner();
      ticket.backupLock = localStorage.getItem(`${libraryKey}.backup-lock`);
      assertOwner();
      ticket.savedRaw = localStorage.getItem(sessionKey);
      assertOwner();
      assertCurrent();
      preparationStatus(request.onStatus, `Preparing ${level.name}…`, 'preparing', () =>
        worldAttemptCurrent(ticket),
      );
      assertCurrent();
      const nextRun = createRun(level, options);
      const nextRunId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const nextRecorder = createRecorder(nextRun.level, options, buildVersion);
      ticket.pictures = newFlightPictures({
        nextRun,
        nextRunId,
        entry,
        nextThemeId: nextTheme.id,
        legacy: false,
      });
      await ticket.pictures.ensure(nextTheme.id, {
        signal: ticket.controller.signal,
        onStatus: (status) =>
          preparationStatus(
            request.onStatus,
            `${level.name}: ${status.message}`,
            status.stage,
            () => worldAttemptCurrent(ticket),
          ),
      });
      assertCurrent();
      const preparedAttempt = {
        kind: 'world-play',
        ticket,
        entry,
        levelIndex: destinationIndex,
        theme: nextTheme,
        classId: nextClassId,
        run: nextRun,
        runId: nextRunId,
        recorder: nextRecorder,
        pictures: ticket.pictures,
      };
      const adopted = prepare({ preparedAttempt });
      if (!adopted)
        throw new DOMException(
          'Chapter launch cancelled. Your current flight is kept.',
          'AbortError',
        );
      return true;
    } catch (error) {
      if (intent.consumed) {
        contentStatus(
          'The chapter was prepared but could not start. Review the field before pressing Start.',
          true,
        );
        throw new Error(
          `The field changed during preparation; the previous attempt was not restored. ${error.message}`,
        );
      }
      throw error;
    } finally {
      for (const signal of signals) signal.removeEventListener('abort', cancel);
      if (worldAttempt === ticket) worldAttempt = null;
      const pictures = ticket.pictures;
      ticket.pictures = null;
      pictures?.dispose();
    }
  }
  function finishWorldPlay(request) {
    const intent = worldPlayIntents.get(request.launch);
    const prepared = intent?.committed;
    if (!prepared) return false;
    const current = () =>
      worldPlayEpoch === prepared.ticket.adoptionEpoch &&
      run === prepared.run &&
      runId === prepared.runId &&
      recorder === prepared.recorder &&
      flightPictures === prepared.pictures &&
      activeEntry === prepared.entry &&
      campaign === prepared.entry.campaign &&
      levelIndex === prepared.levelIndex &&
      theme === prepared.theme &&
      classId === prepared.classId &&
      !themeOverride &&
      seed === intent.seed &&
      turnPolicy === intent.turnPolicy &&
      packs === prepared.ticket.packs &&
      libraryGeneration === intent.generation &&
      library.preferences.campaignDifficulty === intent.difficulty &&
      writer.writable === intent.writable &&
      persistenceReady === intent.persistenceReady &&
      storedStateAdopted === intent.storedStateAdopted &&
      !started &&
      paused &&
      $('game-overlay').dataset.kind === 'ready' &&
      !practice &&
      !scenario &&
      !courseBlocked() &&
      !courseEntry &&
      !modeDeparture &&
      !missionReplacement &&
      !restartRequest &&
      !contentSwitchBusy &&
      !backupBusy &&
      !sessionBusy &&
      !pictureThemePending &&
      !document.hidden &&
      document.hasFocus();
    if (!current() || !request.launch.isCurrent()) return false;
    // The accepted attempt owns its decoded pictures before closing aborts the
    // panel's operation signal. Closing alone never authorizes a newer attempt.
    request.launch.onStarted();
    if (current() && !dialogOpen()) resume();
    return started && run === prepared.run;
  }
  async function requestWorldLaunch(entry, launch, onStatus) {
    if (
      !entry ||
      !launch ||
      typeof launch.isCurrent !== 'function' ||
      typeof launch.onSelected !== 'function' ||
      !launch.isCurrent()
    )
      return Promise.resolve(false);
    // More worlds owns a temporarily disabled Choose during verification. Its
    // persistent launch lease, not Library's available-opener check, owns this
    // handoff. The same checked replacement gate retains the current flight.
    const request = { kind: 'library-installed', id: campaignKey(entry.campaign) };
    const selected = await requestMissionReplacement(request, launch.opener, launch);
    if (!selected && launch.isCurrent()) {
      const target = resolveMissionRequest(request);
      if (target.same)
        preparationStatus(
          onStatus,
          `${target.title} is already selected. Your current flight is kept.`,
          'ready',
          launch.isCurrent,
        );
      else if (missionReplacement?.launch === launch)
        preparationStatus(
          onStatus,
          'Review the chapter choice. Stay keeps your current flight paused.',
          'ready',
          launch.isCurrent,
        );
    }
    return selected;
  }
  function isSetupRequest(request) {
    return ['class', 'steering', 'lesson'].includes(request.kind);
  }
  function restoreReplacementSelectors() {
    refreshContentSelectors();
    $('campaign-select').value = modeSelection().campaignKey;
    $('class-select').value = classId;
    $('turn-select').value = turnPolicy;
    if (courseSession) $('first-flight-select').value = courseRequest.lessonId;
  }
  function resolveMissionRequest(request) {
    if (request.kind === 'world-play') {
      const selection = {
        packs,
        pack: request.pack,
        sourcePackId: request.sourcePackId,
        campaignIdentity: request.id,
        levelId: request.levelId,
        levelRevision: request.levelRevision,
      };
      if (request.pack === null && request.baseEntry !== baseEntry)
        throw new Error('This Base mission changed. Choose Play again.');
      const target =
        request.pack === null
          ? resolveCampaignMissionTarget({ ...selection, entry: baseEntry })
          : resolveInstalledMissionTarget(selection);
      return {
        ...target,
        same:
          unfinishedFlight() &&
          activeEntry.sourcePackId === request.sourcePackId &&
          modeSelection().campaignKey === campaignKey(target.entry.campaign) &&
          (target.levelIndex === null || levelIndex === target.levelIndex),
      };
    }
    if (request.kind === 'library-installed') {
      const entry = installedEntries.find(
        (item) => item.sourcePackId && campaignKey(item.campaign) === request.id,
      );
      if (!entry) throw new Error('That exact installed campaign is no longer available.');
      return {
        same:
          (entry.baseCampaignKey || campaignKey(entry.campaign)) === modeSelection().campaignKey,
        title: entry.campaign.title || entry.campaign.name || entry.campaign.id,
        entry,
        identity: {
          kind: request.kind,
          campaignKey: campaignKey(entry.campaign),
          sourcePackId: entry.sourcePackId,
        },
      };
    }
    if (request.kind === 'library-challenge') {
      const match = /^route-(\d{4}-\d\d-\d\d)-(daily|calm|expert)$/.exec(request.id);
      if (!match) throw new Error('That challenge is unavailable.');
      const next = challengeCampaign(match[1], match[2], baseEntry.classRecipes);
      return {
        same: campaignKey(next) === modeSelection().campaignKey,
        title: next.name,
        entry: { ...baseEntry, campaign: next, activity: 'challenge' },
        identity: { kind: request.kind, campaignKey: campaignKey(next) },
      };
    }
    if (request.kind === 'library-picture') {
      const item = library.gallery.find((row) => row.key === request.id);
      if (!item || canonicalJSON(item) !== request.recordIdentity)
        throw new Error('That earned picture changed. Reopen it before replaying.');
      const picture = createGalleryDifficultyResolver(executionEntries()).picture(item);
      if (!picture) throw new Error('Reinstall this picture’s exact campaign before replaying.');
      const options = {
        levelId: item.levelId,
        themeId: item.themeId,
        seed: item.seed ?? 1,
        ...(picture.difficulty ? { difficulty: picture.difficulty } : {}),
      };
      return {
        same: false,
        title: `Replay ${picture.level.name}`,
        entry: picture.entry,
        options,
        identity: {
          kind: request.kind,
          recordIdentity: request.recordIdentity,
          campaignKey: campaignKey(picture.entry.campaign),
          ...options,
        },
      };
    }
    if (request.kind === 'lesson') {
      if (!courseSession) throw new Error('First Flight is not active.');
      const lesson = getFirstFlightLesson(request.id);
      return { same: courseRequest.lessonId === lesson.id, title: lesson.title };
    }
    if (request.kind === 'class') {
      const recipe = (scenario?.classRecipes || classRegistry).find(
        (item) => item.id === request.id,
      );
      if (courseSession || !recipe) throw new Error('That starting class is unavailable.');
      return { same: classId === request.id, title: `Starting class: ${recipe.label}` };
    }
    if (request.kind === 'steering') {
      if (!['immediate', 'grid-center'].includes(request.id))
        throw new Error('That steering policy is unavailable.');
      return {
        same: turnPolicy === request.id,
        title: `Steering: ${request.id === 'immediate' ? 'Immediate' : 'Grid + buffer'}`,
      };
    }
    if (request.kind === 'level' || request.kind === 'card') {
      const index = campaign.levels.findIndex((level) => level.id === request.id);
      if (index < 0 || !missionAvailable(index))
        throw new Error('That mission is unavailable or still locked.');
      return {
        same: campaign.levels[levelIndex].id === request.id,
        title: campaign.levels[index].name,
      };
    }
    if (request.kind === 'campaign') {
      const entry = catalog().find((item) => campaignKey(item.campaign) === request.id);
      if (!entry) throw new Error('This campaign is not installed.');
      return {
        same:
          (entry.baseCampaignKey || campaignKey(entry.campaign)) === modeSelection().campaignKey,
        title: entry.campaign.title || entry.campaign.name || entry.campaign.id,
        entry,
      };
    }
    if (request.kind === 'pack') {
      const pack = request.id
        ? packs.packs.find((item) => item.id === request.id) ||
          packCatalog.packs.find((item) => item.id === request.id)
        : null;
      if (request.id && !pack) throw new Error('This chapter is unavailable.');
      return {
        same: request.id
          ? activeEntry.sourcePackId === request.id
          : modeSelection().campaignKey === campaignKey(baseEntry.campaign),
        title:
          pack?.name ||
          baseEntry.campaign.title ||
          baseEntry.campaign.name ||
          baseEntry.campaign.id,
      };
    }
    throw new Error('Unknown mission action.');
  }
  async function applyMissionRequest(request, ticket = null) {
    const target = resolveMissionRequest(request);
    if (request.kind === 'world-play') return prepareWorldAttempt(request, ticket);
    if (isLibraryRequest(request)) {
      if (ticket) {
        missionReplacementCurrent(ticket);
        ticket.adopting = true;
      }
      selectEntry(target.entry, target.options);
      contentStatus(`${campaign.levels[levelIndex].name} selected. Deploy when ready.`);
      return true;
    }
    if (request.kind === 'lesson') {
      selectCourseLesson(request.id);
      return true;
    }
    if (isSetupRequest(request)) {
      if (request.kind === 'class') classId = request.id;
      else turnPolicy = request.id;
      demo = false;
      preferences(request.kind === 'class' ? { classId } : { turnPolicy });
      if (courseSession) selectCourseLesson(courseRequest.lessonId);
      else prepare();
      return true;
    }
    if (request.kind === 'pack') {
      if (ticket) ticket.installing = true;
      return activatePack(request.id, {
        preserveCurrentRun: !!ticket,
        beforeSelect: ticket
          ? () => missionReplacementCurrent(ticket, { installed: true })
          : undefined,
      });
    }
    if (request.kind === 'campaign') {
      selectEntry(target.entry);
      contentStatus(`${target.title} selected and ready.`);
    } else if (request.kind === 'level') return selectLevel(request.id);
    else {
      leavePractice();
      levelIndex = campaign.levels.findIndex((level) => level.id === request.id);
      prepare();
      rememberSelection();
      contentStatus(`${campaign.levels[levelIndex].name} selected. Deploy when ready.`);
      if (!ticket) focusMission();
    }
    return true;
  }
  function missionReplacementMessage(ticket) {
    const play = ticket.request.kind === 'world-play';
    const action = isSetupRequest(ticket.request)
      ? courseSession
        ? 'Prepare fresh lesson'
        : 'Prepare fresh attempt'
      : play
        ? 'Replace & play'
        : 'Replace';
    $('mission-replace-status').textContent = ticket.sessionOnly
      ? `This ${courseSession ? 'lesson' : 'practice attempt'} is session-only and is not saved to campaign progress. Stay keeps it paused; ${action} deliberately discards this attempt ${play ? 'and starts the selected chapter when it is ready' : 'without starting the next one'}.`
      : ticket.savedRaw
        ? `Your current flight was saved and verified. ${action} ${play ? 'starts the selected chapter once its picture is ready' : isSetupRequest(ticket.request) ? 'uses the requested starting setup without starting it' : 'selects the new mission without starting it'}. Stay keeps this flight paused.`
        : `This flight was not verified as safely saved. Replacing it may lose this attempt. Stay keeps it paused in this tab; ${action} deliberately discards it.`;
    if (ticket.failure) $('mission-replace-status').textContent += ` ${ticket.failure}`;
  }
  async function requestMissionReplacement(request, opener, launch = null) {
    if (candidateHost && request.kind !== 'steering') {
      contentStatus(
        'Use Find missions for this authored test route. Its Scout and mission theme stay consistent; Legacy content remains in the ordinary game.',
        true,
      );
      refreshContentSelectors();
      return false;
    }
    // Only explicit player launch/selection adapters call this gate. Restore,
    // internal adoption and authored Hangar actions keep their contracts.
    const setup = isSetupRequest(request);
    if (
      missionReplacement ||
      modeDeparture ||
      restartRequest ||
      (courseSession && !setup) ||
      courseBlocked() ||
      sessionBusy ||
      contentSwitchBusy ||
      pictureThemePending ||
      backupBusy
    ) {
      restoreReplacementSelectors();
      return false;
    }
    let target;
    try {
      if (launch && !launch.isCurrent()) return false;
      target = resolveMissionRequest(request);
    } catch (error) {
      restoreReplacementSelectors();
      if (launch) throw error;
      contentStatus(error.message, true);
      return false;
    }
    if (setup && target.same) {
      restoreReplacementSelectors();
      return false;
    }
    if (!unfinishedFlight()) {
      if (launch && target.same) return false;
      const selected = await applyMissionRequest(request);
      if (selected && request.kind === 'world-play') finishWorldPlay(request);
      else if (selected && launch?.isCurrent()) launch.onSelected();
      return selected;
    }
    restoreReplacementSelectors();
    if (target.same) return false;
    // Practice retains its existing non-advertised selection behavior.
    if (practice && !setup && !launch) return applyMissionRequest(request);
    const ticket = {
      request:
        request.kind === 'world-play'
          ? request
          : {
              kind: request.kind,
              id: request.id,
              ...(request.kind === 'library-picture'
                ? { recordIdentity: request.recordIdentity }
                : {}),
            },
      opener,
      launch,
      targetIdentity: launch ? canonicalJSON(target.identity) : null,
      adopting: false,
      controller: new AbortController(),
      run,
      recorder,
      runId,
      campaign,
      entry: activeEntry,
      generation: libraryGeneration,
      packs,
      classId,
      turnPolicy,
      scenario,
      classRegistry,
      lessonId: courseRequest?.lessonId,
      sessionOnly: (setup || !!launch) && practice,
      selection: modeSelection(),
      savedRaw: null,
      pending: true,
      installing: false,
    };
    missionReplacement = ticket;
    modeDepartureHold = true;
    pause(true, { preserveWorld: request.kind === 'world-play' });
    clearInput();
    $('mission-replace-title').textContent = setup
      ? courseSession
        ? 'Prepare a fresh lesson?'
        : 'Prepare a fresh attempt?'
      : 'Replace this flight?';
    $('mission-replace-confirm').textContent = setup
      ? courseSession
        ? 'Prepare fresh lesson'
        : 'Prepare fresh attempt'
      : request.kind === 'world-play'
        ? 'Replace & play'
        : 'Replace';
    $('mission-replace-target').textContent =
      `${scenario?.level.name || campaign.levels[levelIndex].name} → ${target.title}`;
    $('mission-replace-status').textContent =
      'Checking the saved flight. Your current flight stays paused. Stay cancels waiting.';
    $('mission-replace-confirm').disabled = true;
    $('mission-replace-dialog').showModal();
    $('mission-replace-stay').focus({ preventScroll: true });
    try {
      if (!ticket.sessionOnly)
        await retainNavigationFlight(
          ticket,
          () => missionReplacementCurrent(ticket),
          ({ ticks, total }) => {
            if (missionReplacement === ticket)
              $('mission-replace-status').textContent =
                `Verifying your saved flight: ${ticks} / ${total} ticks. Stay cancels waiting.`;
          },
        );
    } catch (error) {
      if (missionReplacement !== ticket || ticket.controller.signal.aborted) return false;
      ticket.savedRaw = null;
      ticket.failure = error.message;
    }
    if (missionReplacement !== ticket) return false;
    ticket.pending = false;
    $('mission-replace-confirm').disabled = false;
    missionReplacementMessage(ticket);
    return false;
  }
  missionReplacementFocusClearance = attachFocusClearance({
    container: $('mission-replace-dialog'),
    document,
  });
  $('mission-replace-dialog').addEventListener('close', () => {
    if ($('mission-replace-dialog').open) return;
    const ticket = missionReplacement;
    cancelMissionReplacement();
    if (ticket?.launch?.onCancelled?.({ dialog: $('mission-replace-dialog') }) === true) return;
    if ((!ticket?.launch || ticket.launch.isCurrent()) && availableFocusTarget(ticket?.opener))
      ticket.opener.focus({ preventScroll: true });
  });
  $('mission-replace-confirm').onclick = async () => {
    const ticket = missionReplacement;
    if (!ticket || ticket.pending) return;
    try {
      missionReplacementCurrent(ticket);
      resolveMissionRequest(ticket.request);
      if (ticket.savedRaw) {
        try {
          assertWriter();
          if (localStorage.getItem(sessionKey) !== ticket.savedRaw)
            throw new Error('Saved flight changed.');
        } catch {
          ticket.savedRaw = null;
          ticket.failure = `The saved flight changed or saving became unavailable. Review this warning before choosing ${isSetupRequest(ticket.request) ? 'Prepare' : 'Replace'} again.`;
          missionReplacementMessage(ticket);
          return;
        }
      }
      ticket.pending = true;
      // Keep the live escape action focused before disabling its opener.
      // Do not reclaim focus after a pointer choice or browser focus change.
      if (
        !document.hidden &&
        document.hasFocus() &&
        document.activeElement === $('mission-replace-confirm')
      )
        $('mission-replace-stay').focus({ preventScroll: true });
      $('mission-replace-confirm').disabled = true;
      $('mission-replace-status').textContent = isSetupRequest(ticket.request)
        ? 'Preparing the requested fresh attempt without starting it.'
        : 'Preparing the selected mission. Your current flight stays paused until it is ready. Stay cancels waiting.';
      const selected = await applyMissionRequest(ticket.request, ticket);
      if (missionReplacement !== ticket) return;
      missionReplacement = null;
      ticket.controller.abort();
      $('mission-replace-dialog').close();
      if (!selected) {
        if (availableFocusTarget(ticket.opener)) ticket.opener.focus({ preventScroll: true });
        return;
      }
      if (ticket.request.kind === 'world-play') finishWorldPlay(ticket.request);
      else if (ticket.launch) {
        if (ticket.launch.isCurrent()) ticket.launch.onSelected();
      } else if (ticket.request.kind === 'card') {
        // Missions remains the active parent, as for ordinary gallery selection.
        if ($('shell-missions').open)
          $('missions').querySelector('.selected')?.focus({ preventScroll: true });
        else focusMission();
      } else if (ticket.request.kind === 'lesson') $('start-button').focus({ preventScroll: true });
      else if (availableFocusTarget(ticket.opener)) ticket.opener.focus({ preventScroll: true });
    } catch (error) {
      if (missionReplacement !== ticket) return;
      ticket.pending = false;
      if (ticket.launch && ticket.adopting) {
        $('mission-replace-confirm').disabled = true;
        $('mission-replace-status').textContent =
          `Selection did not finish: ${error.message} The field may have changed; the previous attempt was not restored. Stay returns to your menu.`;
      } else {
        ticket.failure = `${error.message} Your flight remains paused here.`;
        $('mission-replace-confirm').disabled = false;
        missionReplacementMessage(ticket);
      }
    }
  };
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
    if (!courseSession || courseBlocked() || missionReplacement) return;
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
    if (!courseSession || courseBlocked() || missionReplacement) return;
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
      $('overlay-title').textContent = 'First Flight ended.';
      $('overlay-copy').textContent =
        'Practice awarded no progress. Use the parent page’s game link to return to ordinary play.';
      $('overlay-footnote').textContent = '';
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
      ...(candidateHost?.entries ?? []),
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
    if (candidateHost?.owns(activeEntry)) {
      const clears = journeyProfile.snapshot().clears.solo;
      const completed = campaign.levels.filter(
        (_, index) => clears[journeyMission(activeEntry, index)?.id],
      ).length;
      const index = campaign.levels.findIndex((level) => level.id === options.levelId);
      return {
        levelIndex: index < 0 ? 0 : index,
        overview: false,
        complete: completed === campaign.levels.length,
        completed,
        total: campaign.levels.length,
      };
    }
    return difficultyNavigation.selection(activeEntry, library.campaigns, progress, options);
  }
  function missionAvailable(index, entry = activeEntry) {
    if (journeyEnabled && journeyMission(entry, index)) return true;
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
    if (candidateHost?.owns(activeEntry))
      return new Set(activeEntry.themes.map((item) => item.player));
    return characterPresentations.availableBodies(
      difficultyNavigation.bodies(activeEntry, library.campaigns, progress),
    );
  }
  function currentAppearanceMilestones() {
    return difficultyNavigation.milestones(activeEntry, library.campaigns, progress);
  }
  function executionForEntry(entry, mode) {
    // Candidate editions are owned by their shared compiler, not the installed
    // Legacy pack catalog. Preserve that authority when restoring a saved preset.
    if (candidateHost?.owns(entry))
      return candidateHost.select(candidateHost.mission(entry, 0), mode);
    const baseKey = entry.baseCampaignKey || campaignKey(entry.campaign);
    if (!entry.sourcePackId) return executionCatalog.select(baseKey, mode) || entry;
    const authored = installedEntries.find(
      (candidate) =>
        candidate.sourcePackId === entry.sourcePackId &&
        campaignKey(candidate.campaign) === baseKey,
    );
    if (!authored)
      throw new Error('This exact chapter is no longer installed. Choose an available chapter.');
    // Equal simulation identities may belong to different packs with distinct
    // presentation metadata. A difficulty projection must retain this owner.
    const shared = executionCatalog.select(baseKey, mode);
    if (shared?.sourcePackId === entry.sourcePackId) return shared;
    return createExecutionCatalog([authored]).select(baseKey, mode);
  }
  function applyNextDifficulty(mode = library.preferences.campaignDifficulty) {
    if (scenario || practice || courseSession) return;
    if (candidateHost?.owns(activeEntry)) {
      activeEntry = candidateHost.select(
        journeyMission(),
        journeyPreferences.snapshot().difficulty,
      );
      campaign = activeEntry.campaign;
      classRegistry = activeEntry.classRecipes;
      classId = 'scout';
      progress = progressFor(library, campaign);
      return;
    }
    const selected = executionForEntry(activeEntry, mode);
    if (!selected) return;
    activeEntry = selected;
    campaign = selected.campaign;
    classRegistry = selected.classRecipes;
    progress = progressFor(library, campaign);
  }
  function refreshDifficulty() {
    if (candidateHost?.owns(activeEntry)) {
      const next = journeyPreferences.snapshot();
      const catalogId = authoredRoute.source.difficultyCatalogId;
      $('difficulty-select').replaceChildren(
        ...Object.keys(journeyDifficultyCatalog(catalogId).presets).map(
          (id) => new Option(id[0].toUpperCase() + id.slice(1), id),
        ),
      );
      $('difficulty-select').value = next.difficulty;
      $('difficulty-select').disabled = contentSwitchBusy || backupBusy || sessionBusy;
      $('difficulty-note').textContent =
        `This flight: ${activeEntry.difficulty}. Next fresh attempt: ${next.difficulty}. ${journeyPreset(next.difficulty, catalogId).description} Resume and Load preserve this flight. ${next.error}`;
      show('difficulty-details', false);
      $('overlay-difficulty').textContent =
        `Journey ${activeEntry.difficulty}. ${journeyPreset(activeEntry.difficulty, catalogId).description}`;
      show('overlay-difficulty', true);
      return;
    }
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
    $('difficulty-note').textContent = cue.copy;
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
          row.textContent = copy;
          return row;
        }),
      );
      difficultyDetailsFor = { campaign: standard.campaign, levelIndex };
    }
    $('overlay-difficulty').textContent = cue.available
      ? `${cue.current} difficulty. ${cue.retry}`
      : '';
    show('overlay-difficulty', cue.available);
  }
  function refreshCampaigns() {
    $('campaign-select').replaceChildren(
      ...catalog().map(
        (e) =>
          new Option(e.campaign.title || e.campaign.name || e.campaign.id, campaignKey(e.campaign)),
      ),
    );
    $('campaign-select').value = activeEntry.baseCampaignKey || campaignKey(campaign);
    refreshContentSelectors();
  }
  function contentStatus(message, error = false, { busy = false, stage = 'preparing' } = {}) {
    for (const feedback of contentFeedback) {
      const options = { message, stage };
      if (busy && feedback.target.dataset.state === 'busy') feedback.lease.update(options);
      else {
        feedback.lease = feedback.presenter.begin(options);
        if (!busy) feedback.lease.finish({ message, state: error ? 'error' : 'ready' });
      }
      feedback.target.dataset.kind = error ? 'error' : 'status';
    }
  }
  function invalidateContentSwitch({ announce = false } = {}) {
    attemptFiles?.invalidate();
    const interrupted = contentSwitchBusy;
    packLaunchGuard.invalidate();
    contentSwitchBusy = false;
    $('pack-select').disabled = courseSession;
    $('level-select').disabled = courseSession;
    // Backup adoption shares this busy flag; it is not a pending pack launch.
    if (announce && interrupted && !backupBusy)
      contentStatus('Pending pack launch cancelled; your newer play choice is kept.');
    else if (interrupted)
      for (const feedback of contentFeedback)
        if (feedback.target.dataset.state === 'busy') feedback.presenter.clear();
    return interrupted;
  }
  function refreshContentSelectors() {
    const installedIds = new Set(packs.packs.map((pack) => pack.id));
    const options = [new Option(`Base game · ${baseCampaign.levels.length} levels`, '')];
    for (const summary of packCatalog.packs) {
      const levels = summary.campaigns.reduce((total, item) => total + item.levels.length, 0);
      options.push(
        new Option(
          `${summary.name} · ${levels} ${levels === 1 ? 'level' : 'levels'} · ${installedIds.has(summary.id) ? 'installed' : 'install on select'}`,
          summary.id,
        ),
      );
    }
    for (const pack of packs.packs) {
      if (packCatalog.packs.some((item) => item.id === pack.id)) continue;
      const levels = pack.campaigns.reduce((total, item) => total + item.levels.length, 0);
      options.push(
        new Option(
          `${pack.name} · ${levels} ${levels === 1 ? 'level' : 'levels'} · installed`,
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
        new Option(campaign.title || campaign.name || campaign.id, selectedPack, true, true),
      );
    }
    $('pack-select').replaceChildren(...options);
    $('pack-select').value = selectedPack;
    $('level-select').replaceChildren(
      ...campaign.levels.map((level, index) => {
        const available = missionAvailable(index);
        return new Option(
          `${String(index + 1).padStart(2, '0')} · ${level.name}${available ? '' : ' · locked'}`,
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
      return { ok: false, warning: 'Training does not save player-library changes.' };
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
      adoptControllerBoostMode();
    } else {
      $('save-warning').textContent = saved.warning;
      show('save-warning', true);
    }
    refreshDifficulty();
    refreshTextSize();
    refreshScreenSteeringHand();
    return saved;
  }
  function preferences(patch) {
    if (courseEntry)
      return {
        ok: false,
        warning: 'Finish or cancel the course handoff before changing settings.',
      };
    library = updatePreferences(library, { ...library.preferences, ...patch });
    if (!practice) return persistProfile();
    refreshTextSize();
    refreshScreenSteeringHand();
    return {
      ok: false,
      warning:
        'Practice preferences stay in this session. Export your player library to keep them.',
    };
  }
  function cancelRestore() {
    if (restoreController) {
      restoreController.abort();
      clearPreparation();
    }
  }
  function rememberSelection() {
    const mission = journeyEnabled && journeyMission();
    if (mission && !practice && !scenario)
      journeyProfile.record({ type: 'select', mode: 'solo', missionId: mission.id });
    if (candidateHost?.owns(activeEntry)) return;
    return selectionBookmark.remember({
      campaignKey: activeEntry.baseCampaignKey || campaignKey(campaign),
      levelId: campaign.levels[levelIndex].id,
      themeId: theme.id,
    });
  }
  function journeyMission(entry = activeEntry, index = levelIndex) {
    if (candidateHost) return candidateHost.mission(entry, index);
    if (!journeyAuthority?.matches(entry)) return null;
    const authored = entry.baseCampaign || entry.campaign;
    const level = authored.levels[index];
    if (!level) return null;
    return journeyCatalog.find(
      journeyMissionId({
        packId: entry.sourcePackId ?? null,
        campaignId: authored.id,
        levelId: level.id,
      }),
    );
  }
  function journeyDestination() {
    const state = journeyProfile?.snapshot();
    const current = state && journeyCatalog.find(state.cursors.solo);
    return current && Object.hasOwn(state.clears.solo, current.id)
      ? nextJourneyMission(current.id) || current
      : current || (candidateHost ? journeyCatalog.missions[0] : null);
  }
  function journeySkipMission() {
    return journeyEnabled && !practice && !scenario && !courseSession && !campaignOverview
      ? journeyMission()
      : null;
  }
  function refreshJourneySkip() {
    const mission = journeySkipMission();
    show('journey-skip', !!mission);
    if (!mission) journeySkipArmed = null;
    if (journeySkipArmed === null)
      $('journey-skip').textContent =
        mission && !nextJourneyMission(mission.id) ? 'Find missions' : 'Skip mission';
  }
  function nextJourneyMission(id) {
    return candidateHost ? candidateHost.next(id) : journeyCatalog.next(id);
  }
  async function launchJourneyMission(mission, { kind = 'choose', skipped = null } = {}) {
    if (
      !journeyEnabled ||
      !mission ||
      journeyLaunch ||
      courseBlocked() ||
      backupBusy ||
      sessionBusy
    )
      return false;
    pause(true);
    clearInput();
    if (candidateHost) {
      const entry = candidateHost.select(mission, journeyPreferences.snapshot().difficulty);
      if (!entry) return false;
      const adopted = await prepareResultAttempt(kind, mission.levelIndex, entry);
      if (adopted && skipped)
        journeyProfile.record({ type: 'skip', mode: 'solo', missionId: skipped.id });
      return adopted;
    }
    const owner = { run, runId, mission, feedback: null, cancel: null };
    journeyLaunch = owner;
    const operation = packLaunchGuard.begin(packs);
    packCommits.markIntent();
    contentSwitchBusy = true;
    refreshContentSelectors();
    try {
      owner.cancel = ({ restoreFocus = false } = {}) => {
        if (journeyLaunch !== owner) return;
        journeyLaunch = null;
        invalidateContentSwitch();
        owner.feedback?.finish('Preparation cancelled. Your current flight is kept.', 'cancelled');
        if (restoreFocus) controllerFocus()?.focus({ preventScroll: true });
      };
      owner.feedback = beginPreparation(
        `Preparing ${mission.name}… Your current flight is kept.`,
        owner.cancel,
        'preparing',
        true,
      );
      if (mission.packId)
        await ensureBundledPack(mission.packId, operation, { preserveCurrentRun: true });
      packLaunchGuard.assert(operation, packs);
      if (
        journeyLaunch !== owner ||
        run !== owner.run ||
        runId !== owner.runId ||
        document.hidden ||
        dialogOpen()
      )
        return false;
      const authored = installedEntries.find(
        (entry) =>
          entry.sourcePackId === mission.packId && entry.campaign.id === mission.campaignId,
      );
      if (!authored) throw new Error('This mission is unavailable in the current edition.');
      if (!journeyAuthority.matches(authored))
        throw new Error(
          'The installed campaign differs from this Journey edition. Your imported content is kept. Manage it in Library or choose another mission.',
        );
      const entry = executionForEntry(authored, library.preferences.campaignDifficulty);
      const index = entry.campaign.levels.findIndex((level) => level.id === mission.levelId);
      if (index < 0) throw new Error('This mission is unavailable in the current edition.');
      contentSwitchBusy = false;
      refreshContentSelectors();
      owner.feedback.finish();
      // The exact picture/result ticket now owns cancellation. Later pause,
      // navigation or lifecycle work must not revive the preceding pack owner.
      owner.cancel = null;
      if (journeyLaunch === owner) journeyLaunch = null;
      const adopted = await prepareResultAttempt(kind, index, entry);
      if (adopted && skipped)
        journeyProfile.record({ type: 'skip', mode: 'solo', missionId: skipped.id });
      return adopted;
    } catch (error) {
      if (
        journeyLaunch === owner &&
        packLaunchGuard.current(operation, packs) &&
        run === owner.run &&
        runId === owner.runId
      ) {
        owner.feedback?.finish(
          `Could not prepare ${mission.name}. Try again; your current flight is kept.`,
          'error',
        );
        warning(`Could not open the next mission. Your current flight is kept. ${error.message}`);
      }
      return false;
    } finally {
      owner.feedback?.finish();
      if (journeyLaunch === owner) journeyLaunch = null;
      if (packLaunchGuard.current(operation, packs)) {
        contentSwitchBusy = false;
        refreshContentSelectors();
        await packCommits.reconcile();
      }
    }
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
      throw new Error('End First Flight before selecting a campaign.');
    if (!entry) throw new Error('This campaign is not installed.');
    if (difficulty !== undefined) {
      if (candidateHost?.owns(entry))
        journeyPreset(difficulty, authoredRoute.source.difficultyCatalogId);
      else resolveCampaignDifficulty(difficulty);
    }
    if (selectedSeed !== undefined) {
      if (!Number.isInteger(selectedSeed) || selectedSeed < 0 || selectedSeed > 0xffffffff)
        throw new Error('Picture seed is invalid.');
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
    entry = executionForEntry(
      entry,
      difficulty ?? (practiceSession ? 'standard' : library.preferences.campaignDifficulty),
    );
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
    $('theme-select').replaceChildren(...entry.themes.map((t) => new Option(t.name, t.id)));
    $('theme-select').value = theme.id;
    $('class-select').replaceChildren(...classRegistry.map((c) => new Option(c.label, c.id)));
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
    if (courseEntry) throw new Error('Cancel the course handoff before changing packs.');
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
        throw new Error('Installing a world must preserve every existing pack.');
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
        throw new Error(`Pack storage failed; previous installed packs are kept. ${error.message}`);
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
  async function ensureBundledPack(packId, operation, { preserveCurrentRun = false } = {}) {
    const before = packs;
    packLaunchGuard.assert(operation, before);
    const installed = packs.packs.find((pack) => pack.id === packId);
    if (installed) return { pack: installed, installed: false };
    const summary = packCatalog.packs.find((pack) => pack.id === packId);
    if (!summary) throw new Error('This pack is not bundled with the current build.');
    assertWriter();
    contentStatus(`Installing ${summary.name} on this device…`, false, {
      busy: true,
      stage: 'downloading',
    });
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
          contentStatus(`Checking ${summary.name} and preparing its artwork…`, false, {
            busy: true,
            stage: 'verifying',
          });
          return await preparePack(source, { library: before });
        } catch (error) {
          if (error.message === 'JSON exceeds its byte budget.')
            throw new Error(
              'This pack does not fit the installed library’s 48 MiB limit. Export a complete backup in Library, then explicitly remove an older pack and try again. No installed packs were removed.',
            );
          throw error;
        }
      },
    );
    packLaunchGuard.assert(operation, packs);
    contentStatus(`Saving ${summary.name} on this device…`, false, { busy: true, stage: 'saving' });
    await replacePackLibrary(installPack(before, prepared.pack), {
      contentSwitchTicket: operation,
      preserveCurrentRun,
    });
    return { pack: prepared.pack, installed: true };
  }
  async function installSourceChapter(
    chapterId,
    files,
    { signal, download = false, onStatus, pictureReview } = {},
  ) {
    const notify = flightInformation.captureWarning('host.chapter', { allowTerminal: true });
    const descriptor = sourceExternalChapter(chapterId);
    if (practiceSession || courseEntry || !writer.writable)
      throw new Error('Open the writable game to install this chapter.');
    const operation = packLaunchGuard.begin(packs),
      before = packs;
    packCommits.markIntent();
    contentSwitchBusy = true;
    refreshContentSelectors();
    const cancel = () => {
      if (packLaunchGuard.current(operation, packs)) invalidateContentSwitch();
    };
    signal?.addEventListener('abort', cancel, { once: true });
    const report = (message, stage) =>
      preparationStatus(
        onStatus,
        message,
        stage,
        () => !signal?.aborted && packLaunchGuard.current(operation, packs),
      );
    let committed = false;
    try {
      report(
        download
          ? 'Downloading and verifying chapter originals…'
          : 'Reading and verifying chapter files…',
        download ? 'downloading' : 'verifying',
      );
      const prepared = download
        ? await prepareExternalDownload(descriptor.id, {
            signal,
            baseURL: new URL('../', location.href),
          })
        : await prepareSourceExternalChapter(files, { chapterId: descriptor.id, signal });
      packLaunchGuard.assert(operation, before);
      report('Checking installed chapters before saving…', 'verifying');
      const snapshot = await inspectChapters({ signal });
      if (snapshot.status !== 'checked' && snapshot.reason !== 'external-recovery')
        throw new Error(
          'Backup and mixed recovery must be resolved before this chapter can install.',
        );
      report('Saving the verified chapter and originals…', 'saving');
      const installed = await externalChapters[
        snapshot.reason === 'external-recovery' ? 'recover' : 'install'
      ](prepared, { signal, pictureReview });
      committed = true;
      report('Verifying the saved chapter is ready to play…', 'verifying');
      const next = await checkedChapters({ signal });
      await externalChapters.readiness(next, descriptor.id, { signal });
      packLaunchGuard.assert(operation, before);
      adoptContentCatalog(contentFromChapters(next));
      packLaunchGuard.advance(operation, before, packs);
      packCommits.acceptCurrent();
      if (snapshot.reason !== 'external-recovery' && !pictureReview) {
        try {
          await releasePictures.assignFreshChapter({
            descriptor: installed.descriptor,
            mediaGeneration: installed.mediaGeneration,
            identityCatalog: pictureIdentity(),
            signal,
            onStatus: (status) => report(status.message, status.stage),
          });
        } catch (error) {
          if (error.name !== 'AbortError')
            notify(
              `Chapter installed with its source originals. Field Kit defaults could not be saved: ${error.message}`,
            );
        }
      }
      // Recovery never silently re-enables profile writes from an unreadable baseline.
      // A clean reload adopts the preserved profile and saved flight together.
      refreshCampaigns();
    } catch (error) {
      if (committed) {
        void packCommits.noteStaleCommit();
        throw new Error(
          `The chapter installation committed. Reload/recheck before choosing it. ${error.message}`,
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
  async function installOptionalChapter(summary, { signal, onStatus } = {}) {
    if (courseEntry || courseSession || practice)
      throw new Error('Return from practice before installing worlds.');
    const old = packs.packs.find((item) => item.id === summary.id);
    if (old) return verifyOptionalInstalled(old, summary, { signal });
    if (signal?.aborted) throw new DOMException('Download cancelled.', 'AbortError');
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
      preparationStatus(
        onStatus,
        `Downloading and verifying ${summary.name}…`,
        'downloading',
        () => !signal?.aborted && packLaunchGuard.current(operation, packs),
      );
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
      preparationStatus(
        onStatus,
        `Saving ${summary.name}…`,
        'saving',
        () => !signal?.aborted && packLaunchGuard.current(operation, packs),
      );
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
  async function activatePack(
    packId,
    { campaignId, levelId, announce = true, preserveCurrentRun = false, beforeSelect } = {},
  ) {
    let notify = flightInformation.captureWarning('host.chapter', { allowTerminal: true });
    attemptFiles?.invalidate();
    cancelRestore();
    const operation = packLaunchGuard.begin(packs);
    packCommits.markIntent();
    contentSwitchBusy = true;
    refreshContentSelectors();
    contentStatus('Preparing your selected chapter…', false, { busy: true });
    try {
      if (!packId) {
        beforeSelect?.();
        selectEntry(baseEntry, { levelId, contentSwitchTicket: operation });
        if (announce)
          contentStatus(`Base game · ${campaign.levels[levelIndex].name} selected and ready.`);
        else contentStatus('');
        return operation;
      }
      const result = await ensureBundledPack(packId, operation, { preserveCurrentRun });
      packLaunchGuard.assert(operation, packs);
      const source = campaignId
        ? result.pack.campaigns.find((item) => item.id === campaignId)
        : result.pack.campaigns[0];
      if (!source) throw new Error('This pack campaign is unavailable.');
      const entry = installedEntries.find(
        (item) => item.sourcePackId === result.pack.id && item.campaign.id === source.id,
      );
      if (!entry) throw new Error('The installed pack campaign could not be selected.');
      beforeSelect?.();
      if (levelId) {
        const targetIndex = entry.campaign.levels.findIndex((level) => level.id === levelId);
        if (targetIndex < 0) throw new Error('This pack level is unavailable.');
        if (!missionAvailable(targetIndex, entry)) {
          if (!preserveCurrentRun) {
            selectEntry(entry, { contentSwitchTicket: operation });
            // This fallback deliberately accepted a different mission. Its immediate
            // locked-target explanation belongs to that new presentation owner.
            notify = flightInformation.captureWarning('host.chapter', { allowTerminal: true });
          }
          throw new Error(
            `${entry.campaign.levels[targetIndex].name} is still locked. The next available level is selected.`,
          );
        }
      }
      selectEntry(entry, { levelId, contentSwitchTicket: operation });
      if (announce)
        contentStatus(
          `${result.installed ? `${result.pack.name} installed · ` : ''}${campaign.levels[levelIndex].name} selected and ready.`,
        );
      else contentStatus('');
      return operation;
    } catch (error) {
      if (!packLaunchGuard.current(operation, packs)) return false;
      contentStatus(error.message, true);
      notify(error.message);
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
      contentStatus('That level is still locked. Complete the earlier missions first.', true);
      return false;
    }
    invalidateContentSwitch();
    leavePractice();
    campaignOverview = false;
    levelIndex = index;
    prepare();
    rememberSelection();
    contentStatus(`${campaign.levels[levelIndex].name} selected and ready.`);
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
    $('continue-saved').textContent = sessionBusy
      ? 'Verifying saved flight…'
      : 'Load saved flight →';
    $('continue-saved-note').textContent = preview
      ? `${preview.title}${savedMode ? ` · ${savedMode}` : ''}. ${preview.note}`
      : '';
    $('continue-saved').title = preview?.title || 'Load saved flight';
  }
  function assertWriter() {
    if (courseSession) throw new Error('Training does not write campaign data.');
    if (!persistenceReady || !writer.writable)
      throw new Error(writer.reason || 'Storage recovery must finish before saving.');
    if (localStorage.getItem(`${libraryKey}.backup-lock`) !== null)
      throw new Error('A backup is being restored. Saving resumes when it finishes.');
  }
  function snapshotAttempt(savedAt) {
    if (practice || !recorder || !started || ['won', 'lost'].includes(run.status))
      throw new Error('Start an unfinished campaign flight to save it.');
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
    if (candidateHost)
      throw new Error(
        'Authored test flights use separate storage. Export this attempt or Journey progress; Legacy game-data backups do not include candidate flights.',
      );
    return started && recorder && !practice && !['won', 'lost'].includes(run.status)
      ? snapshotAttempt(savedAt)
      : savedAttempt();
  }
  function snapshotCurrentBackup(savedAt = new Date().toISOString()) {
    return externalBackup.snapshot(() => {
      if (contentSwitchBusy || sessionBusy || backupBusy)
        throw new Error('Finish the pending content or save operation before exporting.');
      if (started && !paused && !['won', 'lost'].includes(run.status))
        throw new Error('Pause the current flight before preparing game data.');
      // Capture time belongs to this export, while all actual host contents are
      // read again after waits so resumed/replaced state cannot pass as unchanged.
      return { library, packs, session: currentBackupSession(savedAt) };
    });
  }
  function attemptReadbackMatches(raw, session) {
    return (
      typeof raw === 'string' &&
      raw.length <= SESSION_STORAGE_BYTES &&
      new TextEncoder().encode(raw).length <= SESSION_STORAGE_BYTES &&
      canonicalJSON(JSON.parse(raw)) === canonicalJSON(session)
    );
  }
  function persistAttempt(notify = true) {
    if (titleFlightHold)
      throw new Error('Explicitly Resume the verified flight before saving again.');
    if (modeDepartureHold)
      throw new Error('Return to the flight and explicitly Resume before saving again.');
    if (courseEntryHold)
      throw new Error(
        'The course handoff keeps this flight paused. Resume explicitly before saving again.',
      );
    assertWriter();
    const session = snapshotAttempt();
    let saved;
    try {
      saved = saveSession(localStorage, sessionKey, session);
    } catch {
      saved = { ok: false, warning: 'Storage is unavailable. Export this attempt.' };
    }
    if (saved.ok) {
      try {
        const raw = localStorage.getItem(sessionKey);
        if (attemptReadbackMatches(raw, session)) lastOwnedAttempt = raw;
      } catch {
        /* A successful write result alone is not readback authority. */
      }
    }
    if (notify)
      warning(
        saved.ok
          ? 'Flight saved. Load it from Library & saves whenever you return.'
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
  async function restoreAttempt(candidate, { beforeAdopt, onAdopted, onStatus, signal } = {}) {
    if (courseSession || courseEntry)
      throw new Error('End First Flight before loading a campaign flight.');
    if (sessionBusy) throw new Error('A flight is already being verified.');
    if (signal?.aborted) throw new DOMException('Title launch cancelled.', 'AbortError');
    const entry = findCampaignEntry(candidate?.campaignKey);
    if (!entry)
      throw new Error(
        candidateHost
          ? 'This authored flight needs its original test edition. Its saved bytes are unchanged. Export the saved attempt from Library & saves before choosing a current mission.'
          : 'Install the matching campaign pack before loading this flight.',
      );
    if (candidateHost && !candidateHost.owns(entry))
      throw new Error(
        'Open this Legacy flight in the ordinary game. This route restores only its exact authored editions.',
      );
    invalidateContentSwitch();
    sessionBusy = true;
    refreshSavedFlight();
    cancelPictureStart();
    if (!paused) pause(true);
    clearInput();
    const controller = new AbortController();
    restoreController = controller;
    let feedback,
      stagedPictures = null;
    const abort = () => {
      controller.abort();
      // Title cancellation owns this field status too. Settle it immediately;
      // a pending decoder may finish later, after another action owns the UI.
      feedback?.finish('Preparation cancelled. Your flight remains paused.', 'cancelled');
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      feedback = beginPreparation('Verifying your saved flight…', cancelRestore, 'verifying');
      onStatus?.({
        status: 'preparing',
        message: 'Verifying your saved flight…',
        stage: 'verifying',
      });
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
        throw new DOMException(
          'Loading was cancelled; your newer selection is kept.',
          'AbortError',
        );
      stagedPictures = newFlightPictures({
        nextRun: restored.run,
        nextRunId: restored.session.runId,
        entry,
        nextThemeId: restored.session.themeId,
        pins: restored.session.presentationPins,
        legacy: !restored.session.presentationPins,
      });
      await stagedPictures.ensure(restored.session.themeId, {
        signal: controller.signal,
        onStatus: (status) => {
          feedback.update(status);
          onStatus?.(status);
        },
      });
      if (controller.signal.aborted)
        throw new DOMException('Picture restore cancelled.', 'AbortError');
      beforeAdopt?.();
      feedback.finish(savedFlightRestoredMessage);
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
      const informationOwner = flightInformation.adopt(run, runId);
      masteryDefinition = masteryFor(campaignKey(campaign), run.levelId, masteryCatalog);
      masteryObserver = restored.masteryObserver ?? null;
      masteryAward = null;
      classId = run.classId;
      turnPolicy = run.turnPolicy;
      seed = run.seed;
      bodyId = presets.characters[restored.session.bodyId] ? restored.session.bodyId : theme.player;
      started = true;
      paused = true;
      $('pause-button').textContent = '▶';
      handled = false;
      recordingStopped = false;
      clearInput();
      input.restoreDirection(restored.session.continuation?.direction ?? null);
      setTheme();
      painter.setLevel?.(run.level, { seed });
      updateLoadout();
      overlay('pause');
      refreshHUD();
      flightInformation.commitWarning(
        informationOwner,
        savedFlightRestoredMessage,
        'restored',
        'host.restored',
      );
      const adopted = {
        run,
        recorder,
        runId,
        entry: activeEntry,
        campaign,
        theme,
        libraryGeneration,
      };
      onAdopted?.(adopted);
      return adopted;
    } catch (error) {
      if (controller.signal.aborted)
        throw new DOMException(
          'Loading was cancelled; your newer selection is kept.',
          'AbortError',
        );
      feedback?.finish(`Saved flight unavailable: ${error.message}`, 'error');
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
      sessionBusy = false;
      stagedPictures?.dispose();
      if (restoreController === controller) restoreController = null;
      refreshSavedFlight();
      await packCommits.reconcile();
    }
  }
  let titleFlight = null;
  const titleFeedback = createOperationStatus($('shell-flight-status'));
  function cancelTitleFlight() {
    const ticket = titleFlight;
    if (!ticket) return;
    titleFlight = null;
    ticket.controller.abort();
    if (ticket.prewarm?.observe === ticket.observe) ticket.prewarm.observe = null;
    ticket.feedback.finish({
      state: 'cancelled',
      message: 'Preparation cancelled. Your flight remains paused.',
    });
    $('shell-flight-cancel').hidden = true;
  }
  function titleFlightCurrent(ticket, expected = ticket) {
    return (
      titleFlight === ticket &&
      !ticket.controller.signal.aborted &&
      ticket.isCurrent() &&
      !document.hidden &&
      document.hasFocus() !== false &&
      !courseBlocked() &&
      !courseEntry &&
      !modeDeparture &&
      !missionReplacement &&
      !restartRequest &&
      !contentSwitchBusy &&
      !backupBusy &&
      !pictureThemePending &&
      run === expected.run &&
      recorder === expected.recorder &&
      runId === expected.runId &&
      activeEntry === expected.entry &&
      campaign === expected.campaign &&
      theme === expected.theme &&
      libraryGeneration === expected.libraryGeneration &&
      packs === ticket.packs &&
      writer.writable === ticket.writable &&
      persistenceReady === ticket.persistenceReady &&
      localStorage.getItem(`${libraryKey}.backup-lock`) === ticket.backupLock &&
      localStorage.getItem(sessionKey) === ticket.savedRaw
    );
  }
  async function launchTitleFlight(kind, { isCurrent, leave }) {
    if (
      !isCurrent() ||
      titleFlight ||
      sessionBusy ||
      contentSwitchBusy ||
      backupBusy ||
      courseSession ||
      practice ||
      courseEntry ||
      modeDeparture ||
      missionReplacement ||
      restartRequest ||
      pictureThemePending ||
      !run
    )
      return;
    const feedback = titleFeedback.begin({ message: 'Preparing your flight…', stage: 'preparing' });
    const ticket = {
      controller: new AbortController(),
      feedback,
      isCurrent,
      run,
      recorder,
      runId,
      entry: activeEntry,
      campaign,
      theme,
      libraryGeneration,
      packs,
      savedRaw: null,
    };
    titleFlight = ticket;
    $('shell-flight-cancel').hidden = false;
    // The original activation unlocks audio; the persisted master gate is unchanged.
    void activateAudio().catch(() => {});
    try {
      ticket.savedRaw = localStorage.getItem(sessionKey);
      ticket.writable = writer.writable;
      ticket.persistenceReady = persistenceReady;
      ticket.backupLock = localStorage.getItem(`${libraryKey}.backup-lock`);
      if (ticket.backupLock !== null)
        throw new Error('Finish game-data recovery before continuing.');
      const assertCurrent = () => {
        if (!titleFlightCurrent(ticket))
          throw new DOMException('Title launch changed. Your flight stays paused.', 'AbortError');
      };
      assertCurrent();
      let expected = ticket;
      ticket.observe = (status) => {
        if (titleFlightCurrent(ticket) && status.status === 'preparing') feedback.update(status);
      };
      const continuing = started && !['won', 'lost'].includes(run.status);
      if (!continuing && kind === 'continue') {
        if (!ticket.savedRaw)
          throw new Error('The saved flight is unavailable. Open Library & saves to review it.');
        let candidate;
        try {
          candidate = JSON.parse(ticket.savedRaw);
        } catch {
          throw new Error(
            'The saved flight needs recovery. Open Library & saves; its bytes are unchanged.',
          );
        }
        expected = await restoreAttempt(candidate, {
          beforeAdopt: assertCurrent,
          onAdopted: () => {
            titleFlightHold = true;
          },
          onStatus: ticket.observe,
          signal: ticket.controller.signal,
        });
      } else {
        if (!continuing && ticket.savedRaw !== null)
          throw new Error(
            'A saved flight is present. Choose Continue or review Library & saves before starting another.',
          );
        if (campaignOverview || ['won', 'lost'].includes(run.status)) {
          // The named Start is an explicit fresh attempt after a completed result.
          campaignOverview = false;
          prepare();
          Object.assign(ticket, {
            run,
            recorder,
            runId,
            entry: activeEntry,
            campaign,
            theme,
            libraryGeneration,
          });
        }
        const owner = flightPictures;
        if (!owner)
          throw new Error('The mission picture is unavailable. Choose the mission again.');
        ticket.prewarm =
          picturePrewarm?.owner === owner && picturePrewarm.themeId === theme.id
            ? picturePrewarm
            : null;
        if (ticket.prewarm) {
          ticket.prewarm.observe = ticket.observe;
          if (ticket.prewarm.latest) ticket.observe(ticket.prewarm.latest);
        }
        const pending =
          ticket.prewarm?.promise ??
          owner.ensure(theme.id, {
            signal: ticket.controller.signal,
            onStatus: ticket.observe,
          });
        const signal = ticket.controller.signal;
        let abort;
        try {
          await Promise.race([
            pending,
            new Promise((resolve, reject) => {
              abort = () => reject(new DOMException('Title launch cancelled.', 'AbortError'));
              signal.addEventListener('abort', abort, { once: true });
              if (signal.aborted) abort();
            }),
          ]);
        } finally {
          signal.removeEventListener('abort', abort);
        }
        if (owner !== flightPictures)
          throw new DOMException('The chosen picture changed.', 'AbortError');
      }
      if (!titleFlightCurrent(ticket, expected) || !flightPictures?.ready(theme.id))
        throw new DOMException('Title launch changed. Your flight stays paused.', 'AbortError');
      feedback.finish({ message: '' });
      titleFlight = null;
      $('shell-flight-cancel').hidden = true;
      leave();
      resume();
    } catch (error) {
      if (titleFlight === ticket)
        feedback.finish({
          state: error.name === 'AbortError' ? 'cancelled' : 'error',
          message:
            error.name === 'AbortError'
              ? 'Preparation cancelled. Your flight remains paused.'
              : `Flight unavailable: ${error.message}`,
        });
    } finally {
      if (ticket.prewarm?.observe === ticket.observe) ticket.prewarm.observe = null;
      if (titleFlight === ticket) {
        titleFlight = null;
        $('shell-flight-cancel').hidden = true;
      }
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
    $('master-volume').value = audioMaster.snapshot().volume;
    $('music-volume').value = p.musicVolume;
    $('sfx-volume').value = p.sfxVolume;
    $('terrain-select').value = p.style;
    $('settings-grid').checked = p.showGrid;
    $('match-class-appearance').checked = p.matchClassAppearance;
    applyDisplayPreferences(displayPreferences.snapshot());
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
    prepareCollectionProgress,
    focusMission,
    pictureMedia: async (options) =>
      createSessionPictureView(await pictureMedia(options), sessionPictures),
    sessionPictures,
    assertExternalBackupSupported,
    backupPreparation: externalBackup
      ? { prepareExternalChapters: externalBackup.prepareExternalChapters }
      : undefined,
    backupSnapshot: externalBackup ? snapshotCurrentBackup : undefined,
    backupSet: practice
      ? null
      : {
          edition: { version: buildVersion, channel, sourceRevision: buildSourceRevision },
          gameIdentity: () => {
            assertWriter();
            if (courseSession || courseEntry || contentSwitchBusy || sessionBusy || backupBusy)
              throw new Error(
                'Finish training or the pending content/save operation before preparing a backup set.',
              );
            if (!storedStateAdopted || !persistenceReady || !writer.writable)
              throw new Error(
                'Resolve storage recovery before preparing all inventories. Individual game-data export remains available.',
              );
            if (started && !paused && !['won', 'lost'].includes(run.status))
              throw new Error('Pause the flight before preparing a backup set.');
            return JSON.stringify({
              library,
              packs,
              session: currentBackupSession('2000-01-01T00:00:00.000Z'),
              runId,
              backupMarker: localStorage.getItem(`${libraryKey}.backup-lock`),
            });
          },
          readContents: ({ savedAt }) =>
            externalBackup
              ? snapshotCurrentBackup(savedAt)
              : { library, packs, session: currentBackupSession(savedAt) },
          readMetadata: async (options) => (await pictureManager.usage(options)).generations,
          readStill: (options) => pictureStore.read(options),
          readStory: (options) => storyStore.exportInventory(options),
          // Byte recovery is available even when the audio player cannot initialize.
          catalogue: SOUNDTRACK_CATALOGUE,
          readAudioAsset: (hash, options) =>
            createSoundtrackSource({
              catalogue: SOUNDTRACK_CATALOGUE,
              archives: SOUNDTRACK_ARCHIVES,
            }).readAsset(hash, { ...options, purpose: 'export' }),
          readAudio: (options) => pictureManager.readDomain('audio', options),
        },
    openStory: (request) => storyDialog.open(request),
    resolveMediaIdentityCatalog: (metadata) =>
      createBackupPictureIdentityResolver({
        baseEntries: [baseEntry],
        metadata,
      }),
    getReducedEffects: () => displayPreferences.snapshot().effectiveReducedEffects,
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
    requestLaunch: requestLibraryLaunch,
    pause: () => pause(true),
    saved: savedAttempt,
    attemptExportSource: () => attemptFiles.source(),
    prepareAttemptFile: (options) => {
      // Do not clear an actual pending pack/restore/backup operation to make an
      // export eligible. An otherwise idle queued autoplay loses its ticket.
      if (contentSwitchBusy || sessionBusy || backupBusy)
        throw new Error('Finish the pending content or save operation before exporting.');
      invalidateContentSwitch();
      return attemptFiles.prepare(options);
    },
    currentSession: () => currentBackupSession(),
    canSnapshotBackup: () => storedStateAdopted,
    sessionNote: () =>
      [
        sessionPictures.status().originals
          ? 'Session-only picture originals are not included in this JSON. Prepare and download session originals (.rlmedia) from Game data before leaving this tab; restore them before the JSON.'
          : '',
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
      if (courseSession || courseEntry)
        throw new Error('End First Flight before replacing player data.');
      invalidateContentSwitch();
      cancelRestore();
      masteryAwards.cancelAll();
    },
    setLibrary: (next) => {
      if (courseSession || courseEntry)
        throw new Error('End First Flight before replacing player data.');
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
        throw new Error('End First Flight before importing a backup.');
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
          $('save-warning').textContent = result.warning;
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
            `Game data committed. Reload and restore its exact originals before continuing. ${error.message}`,
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
    onSelect: (id) => requestMissionReplacement({ kind: 'lesson', id }, $('first-flight-select')),
    onExit: leaveCourse,
    getControlLabels: () => {
      const keys = bindingLabels(resolveKeyBindings(library.preferences.keyboardBindings));
      return {
        directions: `Keys: up ${keys.up}, down ${keys.down}, left ${keys.left}, right ${keys.right}. Touch: direction buttons below the board. Controller: ${controllerStickLabel(library.preferences.controllerBindings, 'flight')} or configured direction buttons`,
        stop: `Stop: ${keys.stop} / visible Stop / controller ${controllerLabels.flight.stop}`,
        pause: `Pause: ${keys.pause} / visible Pause / controller ${controllerLabels.flight.pause}`,
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
    const opener =
      availableFocusTarget(document.activeElement) &&
      $('shell-missions').contains(document.activeElement)
        ? document.activeElement
        : $('pack-select');
    return requestMissionReplacement({ kind: 'pack', id: packId }, opener);
  };
  $('level-select').onchange = () =>
    requestMissionReplacement({ kind: 'level', id: $('level-select').value }, $('level-select'));
  $('campaign-select').onchange = () =>
    requestMissionReplacement(
      { kind: 'campaign', id: $('campaign-select').value },
      $('campaign-select'),
    );
  $('difficulty-select').onchange = () => {
    if ($('difficulty-select').disabled) return;
    if (candidateHost?.owns(activeEntry)) {
      journeyPreferences.choose($('difficulty-select').value);
      cancelResultAttempt();
      clearInput();
      if (!started && !sessionBusy) prepare();
      else refreshDifficulty();
      return;
    }
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
    if (!craftSwitchAvailable()) return;
    pause(true);
    $('switch-class-select').replaceChildren(
      ...run.classRecipes.map((c) => new Option(c.label, c.id)),
    );
    $('switch-class-select').value = run.activeClassId || classId;
    $('switch-description').textContent = run.classRecipe.description;
    $('switch-status').textContent = 'Your flight is paused while choosing.';
    $('hangar-dialog').showModal();
  };
  $('switch-class-select').onchange = () => {
    $('switch-description').textContent =
      run.classRecipes.find((c) => c.id === $('switch-class-select').value)?.description || '';
  };
  $('switch-class-button').onclick = () => {
    if (!craftSwitchAvailable()) return;
    const next = $('switch-class-select').value;
    $('hangar-dialog').close();
    resume();
    pendingSwitch = next;
  };
  document.addEventListener('keydown', (e) => {
    if (
      actionForKey(resolveKeyBindings(library.preferences.keyboardBindings), e) === 'hangar' &&
      craftSwitchAvailable() &&
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
    profileRecovery.refresh();
    void storageRetention.refresh();
  };
  profileRecovery = attachProfileRecoveryDialog({
    currentVersion: buildVersion,
    packaged: isRelease,
    resolveSourceVersion: async () => (await getJSON('build-config.json')).version,
    onOpen: () => clearInput(),
    unavailable: () => {
      if (practiceSession || courseEntry || courseEntryHold)
        return 'Stored profile recovery is available from ordinary solo Settings.';
      if (contentSwitchBusy || sessionBusy || backupBusy)
        return 'Finish the pending content or save operation before opening recovery.';
      if (
        [...document.querySelectorAll('dialog[open]')].some(
          (dialog) =>
            !['settings-dialog', 'shell-home', 'profile-recovery-dialog'].includes(dialog.id),
        )
      )
        return 'Close the other tool before opening recovery.';
      return '';
    },
  });
  const offlinePanel = attachOfflinePanel();
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) offlinePanel.destroy();
  });
  show('native-diagnostics', nativePlatform() === 'ios');
  function tuneMusic(event) {
    if (Number($('master-volume').value) !== audioMaster.snapshot().volume)
      setMasterVolume(Number($('master-volume').value));
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
    const notify = flightInformation.captureWarning('host.music', { allowTerminal: true });
    const player = soundtrackPlayer,
      request = ++musicPreviewRequest;
    try {
      const ok = player
        ? await activateAudio({ explicit: true })
        : await sound.preview({ seconds: 4 });
      // The current player's notifications own its label, including cancellation
      // or a newer Pause/Play. A late gesture result must not overwrite them.
      if (player || soundtrackPlayer || request !== musicPreviewRequest) return;
      musicPreviewState = { playing: ok, status: ok ? 'playing' : 'error' };
      renderMusicPreview();
    } catch (e) {
      if (request === musicPreviewRequest) notify(e.message);
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
  $('touch-side').onchange = () => {
    clearInput();
    const requested = $('touch-side').value,
      saved = preferences({
        screenSteeringHand: requested,
        touchControls: {
          ...touchPreferences.snapshot(),
          side: requested,
        },
      });
    touchPreferences.set(
      { ...touchPreferences.snapshot(), side: requested },
      { persist: !practice && !courseEntry },
    );
    syncAssistControls();
    const status = $('screen-steering-status');
    status.textContent =
      touchPreferences.warning() ||
      (saved.ok
        ? 'Steering hand saved.'
        : resolveTouchControls(library.preferences.touchControls).side === requested
          ? `Steering hand selected for this session. ${saved.warning}`
          : `Steering hand unchanged. ${saved.warning}`);
    status.hidden = false;
  };
  function refreshScreenSteeringHand() {
    touchPreferences.adoptLegacy(library.preferences.touchControls);
    const hand = touchPreferences.snapshot().side;
    $('touch-side').value = hand;
    document.body.dataset.screenSteeringHand = hand;
    document.body.dataset.touchSide = hand;
    const strip = document.querySelector('.play-controls'),
      steering = [
        strip.querySelector('#touch-surface'),
        strip.querySelector('.direction-controls'),
      ],
      actions = strip.querySelector('.ability-buttons'),
      ordered = hand === 'right' ? [actions, ...steering] : [...steering, actions];
    if (ordered.some((group, index) => strip.children[index] !== group)) {
      const focused = document.activeElement;
      // Match keyboard focus order to the visible side; reuse every existing control.
      strip.append(...ordered);
      if (ordered.some((group) => group.contains(focused))) focused.focus({ preventScroll: true });
    }
    $('screen-steering-status').textContent = '';
    $('screen-steering-status').hidden = true;
  }
  $('text-size').onchange = () => changeDisplay({ textSize: $('text-size').value });
  for (const key of ['mode', 'size', 'opacity']) {
    $(`touch-${key}`).onchange = () => {
      clearInput();
      const next = {
        ...touchPreferences.snapshot(),
        [key]: key === 'opacity' ? Number($(`touch-${key}`).value) : $(`touch-${key}`).value,
      };
      preferences({ touchControls: next, screenSteeringHand: next.side });
      touchPreferences.set(next, { persist: !practice && !courseEntry });
      syncAssistControls();
      if (touchPreferences.warning()) {
        $('screen-steering-status').textContent = touchPreferences.warning();
        $('screen-steering-status').hidden = false;
      }
    };
  }
  $('text-face').onchange = () => changeDisplay({ textFace: $('text-face').value });
  function applyDisplayPreferences(state) {
    $('text-size').value = state.textSize;
    document.body.dataset.textSize = state.textSize;
    $('text-face').value = state.textFace;
    document.body.dataset.textFace = state.textFace;
    $('reduced-effects').checked = state.reducedEffects;
    $('settings-reduced-effects').checked = state.reducedEffects;
    document.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
    $('display-system-reduction').textContent =
      state.effectiveReducedEffects && !state.reducedEffects
        ? 'System reduced motion is active. Your saved Reduced effects choice is unchanged.'
        : '';
  }
  function refreshTextSize() {
    // Current validated profile is a fallback only; shared/explicit intent wins.
    displayPreferences.adoptLegacy(library.preferences, {
      expectedRevision: displayPreferences.snapshot().revision,
    });
    applyDisplayPreferences(displayPreferences.snapshot());
  }
  function changeDisplay(patch) {
    const state = displayPreferences.set(patch);
    // Explicit Solo actions alone mirror the legacy profile through its writer.
    const saved = preferences({
      textFace: state.textFace,
      textSize: state.textSize,
      reducedEffects: state.reducedEffects,
    });
    $('display-preferences-status').textContent =
      displayPreferences.getWarning() || saved.warning || '';
  }
  $('settings-grid').onchange = () => preferences({ showGrid: $('settings-grid').checked });
  function syncAssistControls() {
    refreshScreenSteeringHand();
    $('settings-reduced-effects').checked = $('reduced-effects').checked;
    $('settings-tap-steering').checked = $('tap-steering').checked;
    $('screen-controls').value = library.preferences.screenControls;
    const touch = touchPreferences.snapshot();
    for (const key of ['mode', 'size', 'opacity']) $(`touch-${key}`).value = touch[key];
    document.body.dataset.touchMode = touch.mode;
    document.body.dataset.touchSide = touch.side;
    document.body.dataset.touchSize = touch.size;
    document.body.style.setProperty('--touch-opacity', touch.opacity);
    $('touch-instruction').textContent = touch.mode === 'swipe' ? 'Swipe to turn' : 'Drag to steer';
  }
  for (const id of ['reduced-effects', 'settings-reduced-effects']) {
    $(id).onchange = () => {
      changeDisplay({ reducedEffects: $(id).checked });
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
  function painterVisuals() {
    const overrides = { ...visuals() };
    // The flight owns this already-decoded original. Do not load a second,
    // asynchronously replaceable copy through the renderer's fallback path.
    if (flightPictures?.current()?.image) delete overrides.background;
    return overrides;
  }
  function setTheme() {
    syncAuthoredModeLinks();
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
    painter.setLook(theme, bodyId, painterVisuals());
    soundtrackPlayer?.setContext(soundtrackContext());
  }
  function updateBodies() {
    const allowed = availableBodies();
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
    const next = currentAppearanceMilestones().find((tier) => !tier.earned);
    $('appearance-hint').textContent = practice
      ? 'Preview access: all appearances are available. Practice grants no campaign rewards.'
      : next
        ? `${next.name}: ${next.count} / ${next.target} different missions in this campaign. See Collection for the appearances.`
        : 'All chapter appearances are available in this campaign. Cosmetics do not change abilities.';
  }
  const bodyLabels = (ids) => ids.map((id) => presets.characters[id]?.label || id);
  function paintAppearanceRewards(entry) {
    const selected = entry.campaign;
    const name = selected.title || selected.name || selected.id;
    $('appearance-campaign').textContent = `Campaign appearances · ${name}`;
    $('appearance-rewards').replaceChildren();
    for (const tier of difficultyNavigation.milestones(
      entry,
      library.campaigns,
      progressFor(library, selected),
    )) {
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
      : `Appearances belong to this campaign.${difficultyLabel(entry) ? ' Standard and Gentle share mission and appearance unlocks.' : ''} Cosmetics do not change abilities.`;
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
    $('class-select').replaceChildren(...classRegistry.map((c) => new Option(c.label, c.id)));
    $('theme-select').replaceChildren(...themesFile.themes.map((t) => new Option(t.name, t.id)));
    $('theme-select').value = theme.id;
    setTheme();
  }
  function paintMissions() {
    missionThumbnails.cancel();
    $('missions').replaceChildren();
    if (courseSession) {
      $('campaign-progress').textContent =
        `${Object.values(courseVisit).filter((value) => value === 'complete').length} / ${FIRST_FLIGHT_LESSONS.length} lessons this visit`;
      return;
    }
    const thumbnailTargets = [];
    campaign.levels.forEach((level, index) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `mission${index === levelIndex && !practice && !campaignOverview ? ' selected' : ''}`;
      b.disabled = !missionAvailable(index);
      b.dataset.level = String(index);
      // A gallery preview is earned with the picture. Unfinished missions use
      // a decorative concealed tile rather than publishing the hidden original.
      const earnedPicture =
        !!progress.clears[level.id] ||
        !!difficultyNavigation.access(activeEntry, library.campaigns)?.levels[index]?.completed;
      b.dataset.pictureState = earnedPicture ? 'unavailable' : 'concealed';
      thumbnailTargets.push({ button: b, level, earned: earnedPicture });
      b.setAttribute('aria-label', `${index + 1}. ${level.name}${b.disabled ? ' — locked' : ''}`);
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = level.name;
      const medal = document.createElement('span');
      medal.className = 'medal';
      const reward = { 1: 'bronze', 2: 'silver', 3: 'gold' }[progress.clears[level.id]?.medals];
      if (reward) medal.dataset.presentationReward = reward;
      medal.textContent = progress.clears[level.id]
        ? '★'.repeat(progress.clears[level.id].medals)
        : difficultyNavigation.access(activeEntry, library.campaigns)?.levels[index]?.completed
          ? '✓'
          : b.disabled
            ? '—'
            : '↗';
      b.append(number, name, medal);
      b.onclick = (event) => {
        const pending = requestMissionReplacement({ kind: 'card', id: level.id }, b);
        // The gallery's queued selection focus belongs to completed selection,
        // not the separate confirmation dialog that now owns input.
        if (missionReplacement) event.stopPropagation();
        return pending;
      };
      $('missions').append(b);
    });
    void missionThumbnails
      .refresh({
        library,
        entries: executionCatalog.entries,
        entry: activeEntry,
        themeId: theme.id,
        targets: thumbnailTargets,
      })
      .catch(() => {
        /* Preserve honest unavailable thumbnails. */
      });
    $('campaign-progress').textContent =
      `${String(currentSelection().completed).padStart(2, '0')} / ${String(campaign.levels.length).padStart(2, '0')}${difficultyLabel(activeEntry) ? ` · ${difficultyLabel(activeEntry)} medals` : ''}`;
    refreshContentSelectors();
  }
  function updateLoadout() {
    const recipe =
      run?.classRecipe || (scenario?.classRecipes || classRegistry).find((c) => c.id === classId);
    $('class-description').textContent = recipe.description;
    const actions = arcadeActionCapabilities(run?.level);
    $('action-button').firstChild.textContent = `${recipe.id === 'scout' ? 'Scan' : recipe.label} `;
    show('action-button', actions.manualAbility);
    show('pickup-button', manualSupplyAvailable());
    show('manual-equipment-help', actions.manualAbility);
    show('boost-button', actions.manualBoost);
    show('screen-boost-setting', actions.manualBoost);
    show('controller-boost-setting', actions.manualBoost);
    show('ability-state', actions.manualAbility);
    $('equipment-help').textContent = actions.manualAbility
      ? 'This edition uses manual equipment. Scout Scan reveals nearby objectives and briefly shows enemy direction hints. Supply refills charge-based craft at supply pads. Boost increases speed without making you invulnerable. Field bonuses activate on contact.'
      : 'Arcade: steer and close lines. The map sets your craft and flight speed; bonuses activate on contact. There is no manual Scan, Supply or Boost. Completing missions unlocks the next challenge and picture.';
    $('line-danger-help').textContent = run?.level.classic?.lineImpact
      ? 'An enemy striking your unfinished line sends impacts along it in both directions. Close the cut before an impact reaches your craft to escape. Direct collisions, lethal terrain and crossing your own line can still cost a life.'
      : 'A field enemy touching your unfinished line, or crossing your own line, costs a life. Border patrols can hit you on captured edges.';
    refreshKeyPrompts();
    refreshControllerPrompts();
    $('class-select').value = classId;
    $('turn-select').value = turnPolicy;
  }
  function focusMission() {
    // Explicit content selection leaves the retained menus; passive Back does not.
    if ($('settings-dialog').open) $('settings-dialog').close();
    if ($('shell-workshop-dialog').open) $('shell-workshop-dialog').close();
    if ($('shell-home').open) $('shell-home').close();
    $('arena-shell').scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    (campaignOverview ? $('next-button') : $('start-button')).focus({ preventScroll: true });
  }
  function currentBriefing() {
    if (courseSession) {
      const lesson = getFirstFlightLesson(courseRequest.lessonId);
      return {
        title: lesson.title,
        copy: lesson.summary,
        fullTitle: `First Flight · ${lesson.title}`,
        fullBrief: [
          lesson.summary,
          ...lesson.instructions,
          ...lesson.steps.map((step) => `${step.label}: ${step.instruction}`),
        ].join('\n\n'),
        facts:
          'Optional training · Scout · three lives · no mission deadline · no campaign rewards. Retry starts this lesson again. Skip and Exit are always available.',
        status: lesson.instructions[0],
      };
    }
    return missionBriefing(scenario?.level || campaign.levels[levelIndex], {
      brief: scenario ? undefined : campaign.briefs?.[levelIndex],
      objectiveLabel: theme.labels.objective,
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
    show('mastery-overlay', visible && ['ready', 'won', 'lost'].includes(kind));
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
  function overlay(kind, { preserveFocus = false } = {}) {
    // Repeated suspension may repaint Pause, but does not own a new focus
    // choice. An inactive child must not pull focus back from its parent.
    const preservePauseFocus =
      preserveFocus ||
      (kind === 'pause' && !$('game-overlay').hidden && $('game-overlay').dataset.kind === 'pause');
    drawResultPicture($('result-picture'), { kind, run, theme, seed, painter, flightPictures });
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
    show('overlay-field-details', kind === 'pause');
    show('overlay-brief', !courseSession && (kind === 'ready' || kind === 'pause'));
    show('result-medals', kind === 'won');
    show('retry-consequence', false);
    $('retry-consequence').textContent = '';
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
      const completion = currentSelection();
      $('overlay-eyebrow').textContent = 'CAMPAIGN COMPLETE';
      $('overlay-title').textContent = 'Every mission revealed.';
      $('overlay-copy').textContent =
        `${campaign.title || campaign.name || campaign.id}: ${completion.completed} / ${completion.total} missions complete. Enjoy your collection, choose a mission to replay, or select another campaign in the flight deck.`;
      $('next-button').textContent = 'View collection →';
      $('overlay-footnote').textContent = 'Your earned pictures and best results are kept.';
    }
    if (kind === 'pause') {
      $('overlay-title').textContent = 'Paused';
      $('overlay-copy').textContent = '';
      $('start-button').textContent = 'Resume →';
      $('overlay-footnote').textContent = '';
    }
    if (kind === 'won') {
      $('overlay-title').textContent = 'A little more light.';
      $('overlay-copy').textContent =
        `${(run.coverage * 100).toFixed(1)}% captured · ${run.score.toLocaleString()} points · ${timeLabel(run.time)}. ${practice ? 'Practice complete.' : candidateHost?.owns(activeEntry) ? (authoredRoute.id === 'whole-spatial-v5' ? 'Journey mission complete.' : 'Authored test clear recorded in Journey progress. No Legacy collection awards.') : completionWarning || (saveSucceeded ? 'Full picture added to your collection.' : sessionPictures.status().originals ? 'Picture collected for this session. Export game data and session originals from Settings → Game data → Saves & recovery to keep it.' : 'Picture collected for this session. Export your library to keep it.')}`;
      $('result-medals').textContent = '★'.repeat(
        run.medal === 'gold' ? 3 : run.medal === 'silver' ? 2 : 1,
      );
      $('next-button').textContent = practice
        ? 'Try it yourself →'
        : journeyEnabled && journeyMission()
          ? nextJourneyMission(journeyMission().id)
            ? 'Next mission →'
            : candidateHost?.isOptionalSequence(journeyMission().id)
              ? 'End of sequence · find missions'
              : 'Journey complete · replay or exit'
          : currentSelection().complete
            ? 'Campaign complete →'
            : 'Next uncleared mission →';
      $('overlay-footnote').textContent = practice
        ? 'Demonstrations and imported maps do not grant unlocks.'
        : run.medal === 'gold'
          ? 'Gold: fast and no lives lost.'
          : 'Try another class, or return for a clean, faster route.';
    }
    if (kind === 'lost') {
      const explanation = retryExplanation(run, { practice });
      $('overlay-title').textContent = 'A new line awaits.';
      $('overlay-copy').textContent = [
        explanation?.reason,
        `You revealed ${(run.coverage * 100).toFixed(1)}%.`,
        explanation?.tip,
      ]
        .filter(Boolean)
        .join(' ');
      $('retry-button').textContent = 'Try again ↻';
      $('retry-consequence').textContent = explanation?.footnote || '';
      show('retry-consequence', !!explanation);
      $('overlay-footnote').textContent = '';
    }
    if (courseSession) {
      const lesson = getFirstFlightLesson(courseRequest.lessonId);
      const snapshot = courseSnapshot();
      $('overlay-eyebrow').textContent = 'FIRST FLIGHT / OPTIONAL TRAINING';
      show('next-button', false);
      show('result-medals', false);
      if (kind === 'ready') {
        $('overlay-title').textContent = lesson.title;
        $('start-button').textContent = 'Start lesson ↗';
        $('overlay-footnote').textContent =
          'Take your time. Training grants no campaign rewards; you can retry, skip or leave.';
      } else if (kind === 'won') {
        $('overlay-title').textContent =
          snapshot?.outcome === 'complete' ? 'Lesson complete.' : 'Picture revealed.';
        $('overlay-copy').textContent =
          snapshot?.outcome === 'complete'
            ? 'You demonstrated this lesson in the real game. Enjoy the picture, repeat it, or choose your next lesson.'
            : 'You revealed the picture, but this route did not demonstrate every lesson step. Try again, skip or leave whenever you like.';
        $('retry-button').textContent = 'Repeat lesson ↻';
        $('overlay-footnote').textContent =
          'Training results stay in this visit. No campaign scores, pictures or unlocks are awarded.';
      }
    }
    refreshSavedFlight();
    refreshMastery();
    refreshCourse();
    refreshDifficulty();
    controllerReading?.refresh();
    if (!preservePauseFocus && !document.hidden && document.hasFocus() && !controllerDialog())
      controllerFocus()?.focus({ preventScroll: true });
  }
  function resultAttemptCurrent(ticket) {
    if (resultAttempt !== ticket || ticket.controller.signal.aborted) return false;
    // Storage adapters can reenter the host. Inspect ownership after those reads.
    const backupLock = localStorage.getItem(`${libraryKey}.backup-lock`),
      savedRaw = localStorage.getItem(sessionKey);
    return (
      resultAttempt === ticket &&
      !ticket.controller.signal.aborted &&
      !document.hidden &&
      document.hasFocus() &&
      !dialogOpen() &&
      !practice &&
      !scenario &&
      !courseSession &&
      !courseBlocked() &&
      !courseEntry &&
      !modeDeparture &&
      !missionReplacement &&
      !restartRequest &&
      !contentSwitchBusy &&
      !backupBusy &&
      !sessionBusy &&
      !pictureThemePending &&
      run === ticket.run &&
      recorder === ticket.recorder &&
      runId === ticket.runId &&
      flightPictures === ticket.owner &&
      activeEntry === ticket.entry &&
      campaign === ticket.campaign &&
      levelIndex === ticket.levelIndex &&
      theme === ticket.theme &&
      seed === ticket.seed &&
      turnPolicy === ticket.turnPolicy &&
      classId === ticket.classId &&
      themeOverride === ticket.themeOverride &&
      library.preferences.campaignDifficulty === ticket.difficulty &&
      journeyPreferences?.snapshot().revision === ticket.journeyRevision &&
      (ticket.kind !== 'next' || run.status === 'won') &&
      libraryGeneration === ticket.libraryGeneration &&
      packs === ticket.packs &&
      writer.writable === ticket.writable &&
      persistenceReady === ticket.persistenceReady &&
      backupLock === ticket.backupLock &&
      savedRaw === ticket.savedRaw
    );
  }
  function finishResultAttempt(ticket, message, state, restoreFocus = false) {
    if (resultAttempt !== ticket) return;
    resultAttempt = null;
    const epoch = ++resultAttemptEpoch;
    ticket.button.disabled = false;
    ticket.feedback?.finish(message, state);
    ticket.controller.abort();
    ticket.pictures?.dispose();
    if (
      restoreFocus &&
      resultAttemptEpoch === epoch &&
      !document.hidden &&
      document.hasFocus() &&
      !dialogOpen() &&
      run === ticket.run &&
      flightPictures === ticket.owner &&
      !ticket.button.hidden
    )
      ticket.button.focus({ preventScroll: true });
  }
  function cancelResultAttempt({ restoreFocus = false } = {}) {
    if (resultAttempt)
      finishResultAttempt(
        resultAttempt,
        'Preparation cancelled. Your result is kept.',
        'cancelled',
        restoreFocus,
      );
  }
  async function prepareResultAttempt(
    kind,
    destinationIndex = levelIndex,
    destinationEntry = null,
  ) {
    if (resultAttempt?.kind === kind) return;
    const previousEpoch = resultAttemptEpoch,
      previous = resultAttempt;
    cancelResultAttempt();
    // Abort/disposal callbacks can start or retire a newer deliberate operation.
    if (resultAttempt || resultAttemptEpoch !== previousEpoch + (previous ? 1 : 0)) return;
    if (
      practice ||
      scenario ||
      courseSession ||
      courseBlocked() ||
      dialogOpen() ||
      document.hidden ||
      !document.hasFocus() ||
      (kind !== 'choose' && !['won', 'lost'].includes(run?.status)) ||
      (kind === 'choose' && (!journeyEnabled || !run || !paused)) ||
      (kind === 'next' && run.status !== 'won')
    )
      return;
    const ticket = {
      kind,
      controller: new AbortController(),
      button: $(kind === 'next' ? 'next-button' : 'retry-button'),
      run,
      recorder,
      runId,
      owner: flightPictures,
      entry: activeEntry,
      campaign,
      levelIndex,
      theme,
      seed,
      turnPolicy,
      classId,
      themeOverride,
      difficulty: library.preferences.campaignDifficulty,
      journeyRevision: journeyPreferences?.snapshot().revision,
      libraryGeneration,
      packs,
      writable: writer.writable,
      persistenceReady,
      backupLock: null,
      savedRaw: null,
      pictures: null,
      feedback: null,
    };
    resultAttempt = ticket;
    const epoch = ++resultAttemptEpoch;
    try {
      ticket.feedback = beginPreparation(
        kind === 'next' ? 'Preparing the next mission…' : 'Preparing this mission again…',
        cancelResultAttempt,
        'preparing',
        true,
      );
      ticket.backupLock = localStorage.getItem(`${libraryKey}.backup-lock`);
      if (resultAttempt !== ticket || resultAttemptEpoch !== epoch) return;
      ticket.savedRaw = localStorage.getItem(sessionKey);
      if (resultAttempt !== ticket || resultAttemptEpoch !== epoch) return;
      if (!resultAttemptCurrent(ticket))
        throw new DOMException('Preparation cancelled.', 'AbortError');
      const entry =
          destinationEntry ||
          (candidateHost?.owns(activeEntry)
            ? candidateHost.select(journeyMission(), journeyPreferences.snapshot().difficulty)
            : null) ||
          executionForEntry(activeEntry, library.preferences.campaignDifficulty),
        level = entry.campaign.levels[destinationIndex],
        nextTheme =
          themeOverride && entry.themes.some((item) => item.id === theme.id)
            ? theme
            : entry.themes.find((item) => item.id === (level.themeId || entry.campaign.themeId)) ||
              entry.themes[0],
        nextClassId = candidateHost?.owns(entry)
          ? 'scout'
          : entry.classRecipes.some((item) => item.id === classId)
            ? classId
            : entry.classRecipes[0].id,
        options = { seed, turnPolicy, classId: nextClassId, classRecipes: entry.classRecipes };
      const ownedFocus = document.activeElement === ticket.button;
      ticket.feedback.update({
        status: 'preparing',
        stage: 'preparing',
        message: `Preparing ${level.name}…`,
      });
      ticket.button.disabled = true;
      if (ownedFocus) $('flight-preparation-cancel').focus({ preventScroll: true });
      if (!resultAttemptCurrent(ticket))
        throw new DOMException('Preparation cancelled.', 'AbortError');
      let candidateAttempt = null;
      if (candidateHost?.owns(entry)) {
        candidateAttempt = await candidateHost.preparer.prepare(
          {
            missionId: candidateHost.mission(entry, destinationIndex).id,
            difficulty: entry.difficulty,
            seed,
            turnPolicy,
          },
          { signal: ticket.controller.signal, onStatus: ticket.feedback.update },
        );
        if (!resultAttemptCurrent(ticket)) {
          if (candidateHost.preparer.current(candidateAttempt)) candidateHost.preparer.cancel();
          throw new DOMException('Preparation cancelled.', 'AbortError');
        }
        candidateHost.preparer.take(candidateAttempt);
        ticket.candidatePicture = candidateAttempt.picture;
      }
      const nextRun = candidateAttempt?.run ?? createRun(level, options),
        nextRunId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        nextRecorder =
          candidateAttempt?.recorder ?? createRecorder(nextRun.level, options, buildVersion);
      const pins =
        kind === 'retry' && !candidateAttempt && !ticket.owner.legacy
          ? retryFlightPresentationPins(ticket.owner.pins(), {
              identityCatalog: pictureIdentity(),
              campaignKey: campaignKey(entry.campaign),
              level: nextRun.level,
              themeId: nextTheme.id,
            })
          : undefined;
      ticket.pictures = newFlightPictures({
        nextRun,
        nextRunId,
        entry,
        nextThemeId: nextTheme.id,
        candidatePicture: candidateAttempt?.picture ?? null,
        ...(pins ? { pins } : {}),
        legacy: kind === 'retry' ? ticket.owner.legacy : undefined,
      });
      // Audio permission belongs to this explicit action, before storage or decoding.
      activateAudio().catch(() => {});
      await ticket.pictures.ensure(nextTheme.id, {
        signal: ticket.controller.signal,
        onStatus(status) {
          if (resultAttemptCurrent(ticket))
            ticket.feedback.update({ ...status, message: `${level.name}: ${status.message}` });
        },
      });
      if (!resultAttemptCurrent(ticket))
        throw new DOMException('Preparation cancelled.', 'AbortError');
      const preparedPictures = ticket.pictures;
      const adopted = prepare({
        preparedAttempt: {
          ticket,
          entry,
          levelIndex: destinationIndex,
          theme: nextTheme,
          classId: nextClassId,
          run: nextRun,
          runId: nextRunId,
          recorder: nextRecorder,
        },
      });
      // Disposal, renderer and focus callbacks may hand control to another surface.
      // A prepared flight does not authorize resuming that newer owner's attempt.
      if (
        adopted &&
        resultAttemptEpoch === ticket.adoptionEpoch &&
        run === nextRun &&
        runId === nextRunId &&
        recorder === nextRecorder &&
        flightPictures === preparedPictures &&
        activeEntry === entry &&
        campaign === entry.campaign &&
        levelIndex === destinationIndex &&
        theme === nextTheme &&
        seed === ticket.seed &&
        turnPolicy === ticket.turnPolicy &&
        classId === nextClassId &&
        themeOverride === ticket.themeOverride &&
        libraryGeneration === ticket.libraryGeneration &&
        library.preferences.campaignDifficulty === ticket.difficulty &&
        journeyPreferences?.snapshot().revision === ticket.journeyRevision &&
        packs === ticket.packs &&
        writer.writable === ticket.writable &&
        persistenceReady === ticket.persistenceReady &&
        !courseBlocked() &&
        !courseEntry &&
        !modeDeparture &&
        !missionReplacement &&
        !restartRequest &&
        !contentSwitchBusy &&
        !backupBusy &&
        !sessionBusy &&
        !pictureThemePending &&
        !document.hidden &&
        document.hasFocus() &&
        !dialogOpen()
      ) {
        resume();
        return started && !paused;
      }
    } catch (error) {
      if (resultAttempt === ticket) {
        const cancelled = error?.name === 'AbortError';
        if (!cancelled) {
          // Keep the original diagnostic local, outside player-facing feedback.
          try {
            console.warn('Mission preparation failed.', error);
          } catch {
            // Diagnostics must not interrupt recovery.
          }
        }
        // A diagnostic adapter can hand control to a newer deliberate action.
        if (resultAttempt !== ticket) return;
        const ownedFocus = document.activeElement === $('flight-preparation-cancel');
        finishResultAttempt(
          ticket,
          cancelled
            ? 'Preparation cancelled. Your result is kept.'
            : 'Could not prepare this mission. Your result is kept. Try again.',
          cancelled ? 'cancelled' : 'error',
          ownedFocus,
        );
      }
    } finally {
      if (resultAttempt === ticket) cancelResultAttempt();
      ticket.pictures?.dispose();
      if (!ticket.adoptionEpoch) ticket.candidatePicture?.release();
    }
  }
  function prepare({
    restoreAdoption = false,
    contentSwitchTicket = null,
    difficulty,
    preparedAttempt = null,
  } = {}) {
    if (courseEntry || (courseSession && ['leaving', 'ended'].includes(coursePhase))) return;
    if (preparedAttempt) {
      const current = () =>
        preparedAttempt.kind === 'world-play'
          ? worldAttemptCurrent(preparedAttempt.ticket)
          : resultAttemptCurrent(preparedAttempt.ticket);
      if (!current()) return false;
      invalidateContentSwitch({ announce: true });
      if (!current()) return false;
      cancelRestore();
      if (!current()) return false;
      storyDialog.close();
      if (!current()) return false;
      cancelPictureStart({ preserveResult: true, preserveWorld: true });
      if (!current()) return false;
      courseEntryHold = false;
      modeDepartureHold = false;
      titleFlightHold = false;
      courseEntryMessage = '';
      if (courseSession) coursePhase = 'ready';
    } else {
      attemptFiles?.invalidate();
      if (contentSwitchTicket) packLaunchGuard.assert(contentSwitchTicket, packs);
      else invalidateContentSwitch({ announce: true });
      courseEntryHold = false;
      modeDepartureHold = false;
      titleFlightHold = false;
      courseEntryMessage = '';
      if (courseSession) coursePhase = 'ready';
      if (!restoreAdoption) {
        cancelRestore();
        applyNextDifficulty(difficulty);
      }
      cancelPictureStart();
      storyDialog.close();
    }
    let previousPictures = null;
    if (preparedAttempt) {
      const ticket = preparedAttempt.ticket;
      if (preparedAttempt.kind === 'world-play') {
        worldAttempt = null;
        ticket.intent.consumed = true;
        ticket.adoptionEpoch = ++worldPlayEpoch;
        ticket.intent.committed = preparedAttempt;
        if (ticket.replacement) ticket.replacement.adopting = true;
        themeOverride = false;
        musicOverride = false;
        scenario = null;
        practice = practiceSession;
        demo = false;
        classId = preparedAttempt.classId;
        themesFile.themes = preparedAttempt.entry.themes;
        bodyId = preparedAttempt.theme.player;
      } else {
        resultAttempt = null;
        ticket.adoptionEpoch = ++resultAttemptEpoch;
        ticket.button.disabled = false;
      }
      previousPictures = flightPictures;
      flightPictures = ticket.pictures;
      ticket.pictures = null;
      activeEntry = preparedAttempt.entry;
      campaign = activeEntry.campaign;
      classRegistry = activeEntry.classRecipes;
      classId = preparedAttempt.classId;
      themesFile.themes = activeEntry.themes;
      $('theme-select').replaceChildren(...activeEntry.themes.map((t) => new Option(t.name, t.id)));
      $('class-select').replaceChildren(...classRegistry.map((c) => new Option(c.label, c.id)));
      progress = progressFor(library, campaign);
      levelIndex = preparedAttempt.levelIndex;
      campaignOverview = false;
      theme = preparedAttempt.theme;
      if (preparedAttempt.kind === 'world-play') {
        $('theme-select').replaceChildren(
          ...activeEntry.themes.map((item) => new Option(item.name, item.id)),
        );
        $('theme-select').value = theme.id;
        $('class-select').replaceChildren(
          ...classRegistry.map((item) => new Option(item.label, item.id)),
        );
        const track =
          activeEntry.music?.find((item) => item.id === campaign.musicId) || activeEntry.music?.[0];
        assignMusic(
          track || DEFAULT_TRACKS.find((item) => item.genre === library.preferences.musicGenre),
        );
        if (track) $('music-select').value = track.genre;
        refreshCampaigns();
      }
    } else if (!restoreAdoption) {
      flightPictures?.dispose();
      flightPictures = null;
    }
    legacyPictureButton.hidden = true;
    completionWarning = '';
    appearanceRewardIds = [];
    celebrationActive = false;
    journeySkipArmed = null;
    $('journey-skip').textContent = 'Skip mission';
    defeatActive = false;
    defeatPaused = false;
    defeatRemaining = 0;
    $('skip-celebration').textContent = 'Keep picture →';
    sound.reset?.();
    painter.skipCelebration?.();
    show('skip-celebration', false);
    clearInput({ resetDirection: true });
    run =
      preparedAttempt?.run ||
      createRun(scenario?.level || campaign.levels[levelIndex], {
        seed,
        turnPolicy,
        classId,
        classRecipes: scenario?.classRecipes || classRegistry,
      });
    runId = preparedAttempt?.runId || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const informationOwner = flightInformation.adopt(run, runId);
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
    recorder =
      preparedAttempt?.recorder ||
      createRecorder(
        run.level,
        { seed, turnPolicy, classId, classRecipes: scenario?.classRecipes || classRegistry },
        buildVersion,
      );
    $('export-replay').disabled = !!replayDownload;
    captionUntil = 0;
    $('mode-caption').textContent = courseSession
      ? 'FIRST FLIGHT / OPTIONAL TRAINING'
      : practice
        ? 'PLAYGROUND / PRACTICE'
        : `${campaign.title || campaign.name || campaign.id}${difficultyLabel(activeEntry) ? ` · ${difficultyLabel(activeEntry)}` : ''} · ${String(levelIndex + 1).padStart(2, '0')} / ${campaign.levels.length}`;
    $('campaign-name').textContent = courseSession
      ? 'FIRST FLIGHT / LEARN BY PLAYING'
      : `CAMPAIGN / ${campaign.title || campaign.name || campaign.id}`;
    updateLoadout();
    refreshMissionBrief();
    paintMissions();
    overlay(campaignOverview && !practice ? 'campaign-complete' : 'ready', {
      preserveFocus: !!preparedAttempt,
    });
    flightInformation.commitWarning(
      informationOwner,
      courseSession
        ? getFirstFlightLesson(courseRequest.lessonId).instructions[0]
        : practice
          ? 'Practice uses the same simulation; campaign awards are disabled.'
          : campaignOverview
            ? 'Campaign complete. View your collection or choose a mission to replay.'
            : currentBriefing().status,
      null,
      'host.ready',
    );
    if (!restoreAdoption && !preparedAttempt) {
      flightPictures = newFlightPictures();
      warmPicture();
    }
    previousPictures?.dispose();
    refreshHUD();
    return true;
  }
  function resume({ alignCourseBoard = true, contentSwitchTicket = null } = {}) {
    // A queued activation may arrive after blur even when the picture is cached.
    // Use actual foreground state: a fresh Resume need not wait for another frame.
    if (document.hidden || !document.hasFocus()) return;
    if (courseBlocked()) return;
    if (!run || (campaignOverview && !practice) || ['won', 'lost'].includes(run.status)) return;
    if (journeySkipArmed !== null) {
      journeySkipArmed = null;
      $('journey-skip').textContent = 'Skip mission';
      warning('Skip cancelled. Continue this mission.');
    }
    attemptFiles?.invalidate();
    if (contentSwitchTicket) packLaunchGuard.assert(contentSwitchTicket, packs);
    else invalidateContentSwitch({ announce: true });
    cancelRestore();
    // Enable audio on the original gesture, before any storage/decode await.
    // Master mute only gates output. It never discards a pending or paused playlist.
    activateAudio().catch(() => {});
    if (!flightPictures?.ready(theme.id)) {
      if (pictureResume) return;
      clearPictureRecovery();
      const owner = flightPictures,
        ticket = ++pictureGeneration,
        selectedRun = run,
        selectedTheme = theme.id;
      pictureResume = ticket;
      paused = true;
      clearInput();
      warning(picturePreparingMessage, null, 'host.picture');
      const notify = flightInformation.captureWarning('host.picture');
      const feedback = beginPreparation(picturePreparingMessage, cancelPictureStart);
      const prewarm =
        picturePrewarm?.owner === owner && picturePrewarm.themeId === selectedTheme
          ? picturePrewarm
          : null;
      if (prewarm) {
        prewarm.observe = feedback.update;
        if (prewarm.latest) feedback.update(prewarm.latest);
      }
      const prepared =
        prewarm?.promise ?? owner.ensure(selectedTheme, { onStatus: feedback.update });
      void prepared
        .then(() => {
          if (
            pictureResume === ticket &&
            pictureGeneration === ticket &&
            owner === flightPictures &&
            run === selectedRun &&
            theme.id === selectedTheme
          )
            feedback.finish('Picture ready. Press Resume to continue.');
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
          if (pictureResume === ticket) {
            feedback.finish(
              error instanceof ReleasePictureWriteRequiredError
                ? error.message
                : `Picture unavailable: ${error.message}`,
              'error',
            );
            pictureFailure(error, notify);
          }
        })
        .finally(() => {
          if (pictureResume === ticket) pictureResume = null;
        });
      return;
    }
    pictureResume = null;
    clearPictureRecovery();
    legacyPictureButton.hidden = true;
    clearInput();
    neutralResumeTick = true;
    courseEntryHold = false;
    modeDepartureHold = false;
    titleFlightHold = false;
    courseEntryMessage = '';
    if (!started) rememberSelection();
    started = true;
    paused = false;
    if (['restored', 'paused-resume'].includes(runMessageCue))
      warning(
        run.player.cutting
          ? 'Flight resumed. Your unfinished line is still exposed.'
          : 'Flight resumed.',
        'resumed',
        'host.resumed',
      );
    if ($('run-message').textContent === picturePreparingMessage) warning('Picture ready.');
    activateAudio().catch(() => {});
    show('game-overlay', false);
    show('continue-saved-note', false);
    $('game-canvas').focus({ preventScroll: true });
    $('pause-button').textContent = 'Ⅱ';
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
    warning('Flight ended. Read the details or try again.');
    if (journeyEnabled && journeyMission() && !practice && !scenario)
      void prepareResultAttempt('retry');
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
  function pause(force, { preserveWorld = false } = {}) {
    cancelPictureStart({ preserveRecovery: true, preserveWorld });
    if (courseBlocked()) {
      clearInput();
      paused = true;
      sound.pause();
      return;
    }
    if (defeatActive) {
      defeatPaused = true;
      clearInput();
      warning('Defeat presentation paused. Choose Show defeat menu when ready.');
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
    if (runMessageCue === 'resumed')
      warning(
        run.player.cutting
          ? 'Flight paused. Your unfinished line is kept. Press Resume to continue.'
          : 'Flight paused. Press Resume to continue.',
        'paused-resume',
        'host.paused',
      );
    if (
      !practice &&
      !courseEntryHold &&
      !modeDepartureHold &&
      !titleFlightHold &&
      recorder &&
      !sessionBusy
    ) {
      try {
        persistAttempt(false);
      } catch {}
    }
    overlay('pause');
    $('pause-button').textContent = '▶';
    refreshHUD();
  }
  function refreshHUD() {
    profileRecovery?.refresh();
    refreshJourneySkip();
    const reactionMission = journeySkipMission();
    journeyReactions.present({
      owned: !!reactionMission,
      mode: 'solo',
      outcome: run?.status,
      missionId: reactionMission?.id,
      encounter: !!run?.level.encounter,
      relays: !!run?.level.relayGates?.gates?.length,
    });
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
    $('shell-edition').textContent = courseSession
      ? 'FIRST FLIGHT'
      : practice
        ? 'PRACTICE'
        : !arcadeActionCapabilities(run?.level).manualAbility
          ? 'ARCADE EDITION'
          : 'TACTICAL EDITION';
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
    $('coverage').innerHTML = `${(run.coverage * 100).toFixed(1)}<small>%</small>`;
    $('coverage').setAttribute('aria-valuenow', (run.coverage * 100).toFixed(1));
    $('coverage').setAttribute(
      'aria-valuetext',
      `${(run.coverage * 100).toFixed(1)} percent revealed; target ${Math.round(run.level.goal.coverage * 100)} percent`,
    );
    $('coverage-bar').style.width = `${run.coverage * 100}%`;
    $('goal-marker').style.left = `${run.level.goal.coverage * 100}%`;
    $('target').textContent = `TARGET ${Math.round(run.level.goal.coverage * 100)}%`;
    $('coverage').dataset.target = Number.isFinite(run.level.goal.coverage)
      ? ` / ${Math.round(run.level.goal.coverage * 100)}%`
      : '';
    $('lives').textContent =
      run.lives > 3 ? `◆ ×${run.lives}` : '◆ '.repeat(run.lives).trim() || '—';
    $('lives').setAttribute('aria-label', `${run.lives} lives`);
    $('lives').dataset.compactValue = `♥ ${run.lives}`;
    $('time').textContent = timeLabel(run.time);
    $('score').textContent = String(run.score).padStart(5, '0');
    const required = run.objectives.filter((o) => o.required),
      done = required.filter((o) => o.captured);
    $('objective-state').textContent = campaignOverview
      ? 'Choose a mission to replay'
      : run.status === 'won'
        ? 'Target reached'
        : run.status === 'lost'
          ? 'Retry when you are ready'
          : required.length
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
                  ? run.player.speed === 0
                    ? 'LINE EXPOSED / CHOOSE A TURN'
                    : 'LIVE LINE / EXPOSED'
                  : ['xonix-core.v6', 'xonix-core.v7', 'xonix-core.v8', 'xonix-core.v9'].includes(
                        run.ruleset,
                      )
                    ? 'Reclaimed ground'
                    : 'Safe ground';
    $('status-dot').style.background = run.player.cutting ? 'var(--danger)' : 'var(--safe)';
    const left = Math.max(0, run.ability.cooldownUntil - run.time);
    $('ability-state').textContent =
      `${left > 0 ? left.toFixed(1) + 's cooldown' : run.ability.capacity && run.ability.ammo === 0 ? 'Empty — refill at supply' : 'Ready'}${run.ability.capacity ? ' · ' + run.ability.ammo + '/' + run.ability.capacity + ' charges' : ''}`;
    const canSwitchCraft = craftSwitchAvailable();
    $('hangar-button').disabled = !canSwitchCraft;
    show('hangar-button', canSwitchCraft);
    $('loadout-note').textContent =
      'Starting class changes begin a fresh attempt.' +
      (canSwitchCraft ? ' Use a hangar to switch during flight.' : '');
    $('restart-button').disabled = defeatActive || courseBlocked() || campaignOverview;
    $('restart-button').hidden = !started || ['won', 'lost'].includes(run.status);
    refreshInputPresentation();
    $('pause-button').disabled = courseBlocked() || campaignOverview;
    $('save-attempt-button').disabled =
      !started || practice || ['won', 'lost'].includes(run.status);
    const near = run.hangars?.some(
      (h) => Math.hypot(h.x - run.player.x, h.y - run.player.y) <= h.radius,
    );
    $('hangar-state').textContent = courseSession
      ? 'Scout · fixed lesson craft; no hangars in training.'
      : run.signal?.zoneIds?.length
        ? run.signal.resistant
          ? 'Fiber link · signal zone bypassed; line remains vulnerable.'
          : 'Signal interference · slower movement or disabled equipment.'
        : `${run.classRecipe.label}${canSwitchCraft ? (near && !run.player.cutting ? ' · Hangar in range' : ' · Return to a hangar to change craft') : ''}`;
    if (run.rules.timeLimitSeconds)
      $('time').textContent = timeLabel(Math.max(0, run.rules.timeLimitSeconds - run.time));
    const encounter = encounterView(run),
      classic = classicView(run);
    show('encounter-status', !!(encounter || classic) && !campaignOverview);
    $('encounter-status').dataset.kind = encounter ? 'encounter' : 'classic';
    $('encounter-title').textContent = encounter?.title || 'Classic field';
    $('encounter-instruction').textContent = encounter?.instruction || '';
    show('encounter-instruction', !!encounter);
    $('classic-summary').textContent = classic?.summary || '';
    show('classic-summary', !!classic);
    $('encounter-status').dataset.phase =
      encounter?.phase ||
      (classic?.enemies.some((enemy) => enemy.mode === 'warning') ? 'warning' : 'open');
    refreshMastery();
    refreshCourse();
    flightDetails?.reconcile();
  }
  function eventFeedback(events) {
    const ticket = flightInformation.begin(run, events);
    // capture.stopped follows cells.claimed in the same accepted closure. Keep
    // the rule explanation when adding the fresh-steering cue; do not replace it.
    const teachingCapture =
      journeyEnabled &&
      !practice &&
      (candidateHost ? activeEntry.campaignId === 'prologue' : levelIndex < 2);
    const captureTeaching = () => {
      const occupied = inspectCaptureSnapshot(run).components.filter((region) => region.retained);
      const anchors = occupied.flatMap((region) => region.enemyIds);
      return `Line secured. ${occupied.length} occupied region${occupied.length === 1 ? ' remains' : 's remain'}${anchors.length ? ` around ${anchors.slice(0, 3).join(', ')}${anchors.length > 3 ? ' and other field enemies' : ''}` : ''}. Empty regions fill; field enemies retain their regions.`;
    };
    const openedGates = events.filter((event) => event.type === 'relay.opened').length;
    const captureTerrain = [
      foundationReturnCaption(run, events),
      ...events
        .filter((event) => event.type === 'cells.claimed')
        .map((event) => terrainTransitionCaption(run, event)),
      openedGates
        ? `${openedGates} relay connector${openedGates === 1 ? '' : 's'} opened permanently. Reclaimed ground, not earned coverage.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    try {
      for (const [index, event] of events.entries()) {
        flightInformation.observeEvent(ticket, index, () => {
          sound.event(event);
          if (event.type === 'class.switched') {
            updateLoadout();
            setTheme();
            warning(`Now flying ${run.classRecipe.label}. Charges and cooldowns are preserved.`);
          }
          if (event.type === 'class.rejected')
            warning(`Cannot switch craft: ${event.reason}. Return to safe hangar ground.`);
          if (event.type === 'cells.claimed') {
            if (teachingCapture)
              warning([captureTeaching(), captureTerrain].filter(Boolean).join(' '), 'secured');
            else
              warning(
                [
                  `Line secured. ${(run.coverage * 100).toFixed(1)}% revealed${event.indices?.length < 50 ? ' — both sides may still contain an enemy.' : '.'}`,
                  captureTerrain,
                ]
                  .filter(Boolean)
                  .join(' '),
                'secured',
              );
          }
          if (
            event.type === 'cut.started' &&
            ['failure', 'secured', 'secured-stopped'].includes(runMessageCue) &&
            run.status === 'running' &&
            run.player.cutting
          )
            warning(
              `Live line exposed. Reach ${['xonix-core.v6', 'xonix-core.v7', 'xonix-core.v8', 'xonix-core.v9'].includes(run.ruleset) ? 'reclaimed' : 'safe'} ground to secure it.`,
            );
          if (event.type === 'player.failed')
            warning(
              {
                'self-contact': 'Your line crossed itself. Choose a new route.',
                'mission-timeout': 'The mission clock ran out. Try a faster route.',
                'cut-timeout': 'Your live line stayed open too long. Make a shorter cut.',
                'cable-limit': 'Your cable budget ran out. Close a shorter line.',
                'lethal-terrain': 'A lethal field caught your craft. Enclose it before crossing.',
              }[event.cause] || 'Your line was caught. The territory you revealed is kept.',
              'failure',
            );
          if (event.type === 'lineImpact.seeded')
            warning(
              `Line struck! Reach ${['xonix-core.v6', 'xonix-core.v7', 'xonix-core.v8', 'xonix-core.v9'].includes(run.ruleset) ? 'reclaimed' : 'safe'} ground before the travelling spark catches you.`,
            );
          if (event.type === 'lineImpact.arrived')
            warning('The travelling impact reached your craft. One life lost.');
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
          if (event.type === 'capture.stopped')
            warning(
              [
                teachingCapture
                  ? captureTeaching()
                  : `Line secured. ${(run.coverage * 100).toFixed(1)}% revealed.`,
                captureTerrain,
                'Tap a direction to fly again.',
              ]
                .filter(Boolean)
                .join(' '),
              'secured-stopped',
            );
          if (event.type === 'powerup.collected')
            warning(
              {
                'extra-life': event.gain
                  ? 'Extra life collected.'
                  : 'Life pickup collected. Already at the nine-life limit.',
                'player-speed': 'Speed pickup: faster flight for five seconds.',
                'enemy-slow': 'Slow pickup: enemies move at half speed for six seconds.',
                'enemy-freeze':
                  'Freeze pickup: enemies are held for three seconds. Terrain and the mission clock stay active.',
              }[event.kind] || 'Powerup collected.',
            );
          if (event.type === 'rover.warning')
            warning('Claimed-ground rover waking in one second. Watch the marked actor.');
          if (event.type === 'rover.activated')
            warning('Claimed-ground rover active. Your secured ground still has a moving threat.');
          if (event.type === 'erosion.warning')
            warning('The marked captured cell is about to reopen. Watch the edge timer.');
          if (event.type === 'cells.eroded')
            warning(
              [
                'Ground reopened. Reclaiming it restores coverage, without repeat capture points.',
                terrainTransitionCaption(run, event),
              ]
                .filter(Boolean)
                .join(' '),
            );
          if (
            event.type === 'encounter.stageChanged' ||
            event.type === 'encounter.phaseChanged' ||
            event.type === 'encounter.defeated'
          ) {
            const cue = encounterView(run);
            if (cue) warning(`${cue.title}. ${cue.instruction}`, 'encounter');
          }
          if (event.type === 'boss.warning')
            warning(laneWarningCaption(run, event, theme.labels.boss));
        });
      }
      painter.effectsFor(events, run);
      flightInformation.finish(ticket);
    } catch (error) {
      flightInformation.cancel(ticket);
      throw error;
    }
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
    // The isolated lesson owns its controller; the paused parent must not
    // sample the same pad or turn a child Confirm into a parent menu action.
    if (enemyGuide?.ownsPracticeFocus()) {
      clearInput();
      return;
    }
    enemyGuide?.update(elapsed, { reduced: displayPreferences.snapshot().effectiveReducedEffects });
    refreshInputPresentation();
    const scope = controllerScope();
    controllerFrame = controller.sample({
      scope,
      timeMs: performance.now(),
      toggleBoostEligible: run?.status === 'running',
    });
    refreshControllerBoostCue();
    const { status, assigned, disconnected } = controllerFrame;
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
      $('input-status').textContent =
        status.code === 'disconnected' || assigned
          ? status.message
          : `Keyboard / touch · ${status.message}`;
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
    if (connectionHint.textContent !== connectionText) connectionHint.textContent = connectionText;
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
        if (craftSwitchAvailable()) $('hangar-button').click();
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
            'The 30-minute replay budget is full. Recording was discarded; you can keep playing.',
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
        if (
          runMessageCue === 'secured-stopped' &&
          run.status === 'running' &&
          command.direction &&
          run.player.speed > 0
        )
          warning('Flight moving.', 'secured');
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
              message: 'Live goal tracking is unavailable. Your picture progress is kept.',
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
              'Replay recording stopped. You can keep playing; start a new attempt to record again.',
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
          const mission = journeyEnabled && !scenario && journeyMission();
          if (mission)
            journeyProfile.record({
              type: 'complete',
              mode: 'solo',
              missionId: mission.id,
              runId,
              gameplayId: dataIdentity({
                ruleset: run.ruleset,
                level: run.level,
                classes: run.classRecipes,
              }),
              difficulty: activeEntry.difficulty || 'standard',
            });
          if (!candidateHost?.owns(activeEntry)) {
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
              completionWarning = `Your picture is open, but the collection could not be updated. ${recorder ? 'Export this replay and your library' : 'The replay recording has ended; export your library'} before continuing.`;
              $('save-warning').textContent = `${completionWarning} ${error.message}`;
              show('save-warning', true);
            }
            progress = progressFor(library, campaign);
            appearanceRewardIds = [...availableBodies()].filter((id) => !previousBodies.has(id));
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
          } else {
            paintMissions();
            try {
              const old = JSON.parse(localStorage.getItem(sessionKey));
              if (old?.runId === runId) {
                assertWriter();
                localStorage.removeItem(sessionKey);
              }
            } catch {}
          }
        }
        if (run.status === 'won') {
          painter.startCelebration?.({
            levelId: run.levelId,
            seed,
            reduced: displayPreferences.snapshot().effectiveReducedEffects,
          });
          celebrationActive = true;
          show('game-overlay', false);
          show('skip-celebration', true);
          show('show-result', false);
          warning('Picture unlocked. A whole world, from one brave line.', null, 'host.won');
          if (journeyEnabled && journeyMission() && !practice) {
            celebrationActive = false;
            show('skip-celebration', false);
            overlay('won');
          }
        } else {
          defeatActive = true;
          defeatPaused = false;
          defeatRemaining = 0.65;
          show('game-overlay', false);
          show('show-result', false);
          $('skip-celebration').textContent = 'Show defeat menu';
          show('skip-celebration', true);
          $('skip-celebration').focus({ preventScroll: true });
          warning(
            'Life lost. Showing the final impact; choose Show defeat menu to continue.',
            null,
            'host.lost',
          );
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
    if (soundtrackPlayer) {
      const context = soundtrackContext();
      if (context.scene !== soundtrackLastScene) {
        soundtrackLastScene = context.scene;
        soundtrackPlayer.setContext(context);
      }
      soundtrackPlayer.update(!paused && started, theme, run);
    } else sound.update(!paused && started, theme, run);
    if (!sound.previewActive && $('music-preview').textContent.startsWith('Playing'))
      $('music-preview').textContent = 'Preview music ♫';
    refreshHUD();
  }
  for (const t of themesFile.themes) $('theme-select').append(new Option(t.name, t.id));
  if (scenario && !themesFile.themes.some((t) => t.id === theme.id))
    $('theme-select').append(new Option(theme.name, theme.id));
  $('theme-select').value = theme.id;
  $('theme-preparation-cancel').onclick = () => {
    const restoreFocus = document.activeElement === $('theme-preparation-cancel');
    cancelPictureStart();
    $('theme-select').value = theme.id;
    themeFeedback.begin({ message: '' }).finish({
      state: 'cancelled',
      message: 'World preparation cancelled. Your current picture is kept.',
    });
    if (restoreFocus) $('theme-select').focus({ preventScroll: true });
  };
  for (const c of scenario?.classRecipes || classRegistry)
    $('class-select').append(new Option(c.label, c.id));
  $('theme-select').onchange = async () => {
    if (courseSession || courseEntry) return;
    cancelRestore();
    cancelPictureStart();
    pause(true);
    const next =
      themesFile.themes.find((t) => t.id === $('theme-select').value) ||
      (scenario?.theme?.id === $('theme-select').value ? scenario.theme : themesFile.themes[0]);
    const notify = flightInformation.captureWarning('host.picture', { allowTerminal: true });
    const owner = flightPictures,
      controller = new AbortController(),
      ticket = ++pictureGeneration;
    let candidate = newFlightPictures({
      nextThemeId: next.id,
      pins: owner.pins(),
      legacy: owner.legacy,
    });
    pictureThemePending = { ticket, controller };
    const feedback = themeFeedback.begin({
      message: `Preparing ${next.name || next.id} artwork…`,
      isCurrent: () => pictureThemePending?.ticket === ticket && !controller.signal.aborted,
    });
    $('theme-preparation-cancel').hidden = false;
    try {
      await candidate.ensure(next.id, {
        signal: controller.signal,
        onStatus: (status) => {
          if (status.status === 'preparing') feedback.update(status);
        },
      });
      if (owner !== flightPictures || ticket !== pictureGeneration || document.hidden) return;
      flightPictures = candidate;
      candidate = null;
      owner.dispose();
      themeOverride = true;
      theme = next;
      bodyId = theme.player;
      setTheme();
      paintMissions();
      refreshMissionBrief();
      if (!started && !campaignOverview) overlay('ready');
      preferences({ themeId: theme.id, bodyId });
      rememberSelection();
      feedback.finish({ message: `${next.name || next.id} artwork ready.` });
    } catch (error) {
      if (owner === flightPictures && ticket === pictureGeneration && !controller.signal.aborted) {
        feedback.finish({
          message:
            error instanceof ReleasePictureWriteRequiredError
              ? error.message
              : `World artwork unavailable: ${error.message}`,
          state: 'error',
        });
        pictureFailure(error, notify);
      }
    } finally {
      candidate?.dispose();
      if (pictureThemePending?.ticket === ticket) {
        pictureThemePending = null;
        $('theme-preparation-cancel').hidden = true;
        $('theme-select').value = theme.id;
      }
    }
  };
  $('body-select').onchange = () => {
    if (courseEntry) return;
    cancelRestore();
    bodyWarning = '';
    bodyId = $('body-select').value;
    painter.setLook(theme, bodyId, painterVisuals());
    soundtrackPlayer?.setContext(soundtrackContext());
    preferences({ bodyId, matchClassAppearance: false });
    $('match-class-appearance').checked = false;
  };
  $('class-select').onchange = () =>
    requestMissionReplacement({ kind: 'class', id: $('class-select').value }, $('class-select'));
  $('turn-select').onchange = () =>
    requestMissionReplacement({ kind: 'steering', id: $('turn-select').value }, $('turn-select'));
  $('start-button').onclick = () => resume();
  $('continue-saved').onclick = async () => {
    const notify = flightInformation.captureWarning('host.restore', { allowTerminal: true });
    try {
      await restoreAttempt(savedAttempt());
      $('start-button').focus({ preventScroll: true });
    } catch (error) {
      if (error.name === 'AbortError') return;
      notify(`Saved flight was not loaded: ${error.message}`);
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
  const restartDialog = $('restart-dialog');
  const restartCopy = $('restart-dialog-copy').textContent;
  function restartAvailable() {
    return (
      unfinishedFlight() &&
      !defeatActive &&
      !campaignOverview &&
      !courseBlocked() &&
      !courseEntry &&
      !modeDeparture &&
      !missionReplacement &&
      !sessionBusy &&
      !contentSwitchBusy &&
      !pictureThemePending &&
      !backupBusy &&
      !document.hidden &&
      document.hasFocus() !== false
    );
  }
  function invalidateRestart(message) {
    if (!restartRequest) return;
    restartRequest.cancelled = true;
    $('restart-confirm').disabled = true;
    $('restart-dialog-copy').textContent =
      `${message} Keep this attempt, then choose Restart again when ready.`;
  }
  function requestRestart(opener) {
    const top = controllerDialog();
    if (
      restartRequest ||
      !restartAvailable() ||
      !availableFocusTarget(opener) ||
      (top && !top.contains(opener))
    )
      return;
    // The choice itself neither saves nor replaces the attempt. Retain the same
    // hold through cancellation/pagehide until explicit Resume or a fresh run.
    modeDepartureHold = true;
    pause(true);
    const ticket = {
      opener,
      run,
      recorder,
      runId,
      campaign,
      entry: activeEntry,
      scenario,
      classId,
      turnPolicy,
      levelIndex,
      generation: libraryGeneration,
      cancelled: false,
    };
    restartRequest = ticket;
    $('restart-dialog-copy').textContent = restartCopy;
    $('restart-confirm').disabled = false;
    try {
      restartDialog.showModal();
      $('restart-cancel').focus({ preventScroll: true });
    } catch (error) {
      restartRequest = null;
      warning(`Restart confirmation unavailable: ${error.message}. Your flight remains paused.`);
      if (availableFocusTarget(opener)) opener.focus({ preventScroll: true });
    }
  }
  $('restart-button').onclick = () => requestRestart($('restart-button'));
  $('overlay-restart').onclick = () => requestRestart($('overlay-restart'));
  restartDialog.addEventListener('close', () => {
    // A queued close from the preceding visit cannot cancel a reopened decision.
    if (restartDialog.open) return;
    const ticket = restartRequest;
    restartRequest = null;
    if (!ticket || document.hidden || document.hasFocus() === false) return;
    const top = controllerDialog();
    if (availableFocusTarget(ticket.opener) && (!top || top.contains(ticket.opener)))
      ticket.opener.focus({ preventScroll: true });
  });
  $('restart-confirm').onclick = () => {
    const ticket = restartRequest;
    if (!ticket || !restartDialog.open || ticket.cancelled) return;
    if (
      !restartAvailable() ||
      run !== ticket.run ||
      recorder !== ticket.recorder ||
      runId !== ticket.runId ||
      campaign !== ticket.campaign ||
      activeEntry !== ticket.entry ||
      scenario !== ticket.scenario ||
      classId !== ticket.classId ||
      turnPolicy !== ticket.turnPolicy ||
      levelIndex !== ticket.levelIndex ||
      libraryGeneration !== ticket.generation
    ) {
      invalidateRestart('The flight or available setup changed.');
      return;
    }
    // Only the explicitly confirmed handoff closes retained menu parents.
    restartRequest = null;
    restartDialog.close();
    if ($('shell-workshop-dialog').open) $('shell-workshop-dialog').close();
    if ($('shell-home').open) $('shell-home').close();
    demo = false;
    prepare();
    resume();
  };
  $('retry-button').onclick = () => {
    if (defeatActive || courseBlocked()) return;
    if (!practice && !scenario && !courseSession && ['won', 'lost'].includes(run?.status)) {
      void prepareResultAttempt('retry');
      return;
    }
    demo = false;
    prepare();
    resume();
  };
  $('view-picture').onclick = () => {
    if (run.status !== 'won') return;
    cancelResultAttempt();
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
    if (journeyEnabled && !practice && !scenario && run?.status === 'won' && journeyMission()) {
      const next = nextJourneyMission(journeyMission().id);
      if (next) void launchJourneyMission(next, { kind: 'next' });
      else journeyChooser.open($('next-button'));
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
      if (run?.status !== 'won') return;
      const selection = currentSelection();
      if (!selection.overview && !scenario && run?.status === 'won') {
        void prepareResultAttempt('next', selection.levelIndex);
        return;
      }
      cancelResultAttempt();
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
    if (courseSession || courseEntry) return;
    leavePractice();
    levelIndex = 0;
    practice = true;
    demo = true;
    prepare();
    resume();
    warning('Demonstration: this is a real simulated cut. It grants no rewards.');
  };
  $('sound-button').onclick = () => setMasterMuted(!audioMaster.snapshot().muted);
  $('settings-master-mute').onclick = () => setMasterMuted(!audioMaster.snapshot().muted);
  $('shell-sound').onclick = () => setMasterMuted(!audioMaster.snapshot().muted);
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
    `${entry.campaign.title || entry.campaign.name || entry.campaign.id} · ${difficultyLabel(entry) || 'Challenge'}`;
  function paintCollectionProgress(entry) {
    $('achievement-campaign').textContent =
      `Campaign achievements · ${collectionContextLabel(entry)}`;
    $('achievements').replaceChildren();
    for (const a of difficultyNavigation.achievements(
      entry,
      library.campaigns,
      progressFor(library, entry.campaign),
    )) {
      const row = document.createElement('div');
      row.className = `achievement${a.earned ? ' earned' : ''}`;
      const title = document.createElement('strong');
      title.textContent = `${a.earned ? '◆' : '◇'} ${a.name}`;
      const copy = document.createElement('span');
      copy.textContent = `${a.description}${a.scope === 'shared' ? ' Standard or Gentle.' : a.scope ? ` ${difficultyLabel(entry)} results.` : ''}`;
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
        ([key, entry]) => new Option(collectionContextLabel(entry), key),
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
    const opener = document.activeElement;
    pause(true);
    prepareCollectionProgress();
    libraryPanel.populateGallery();
    $('collection-back').textContent = $('shell-home').open
      ? 'Back to menu →'
      : $('shell-missions').open
        ? 'Back to Missions →'
        : 'Back to the field →';
    // Pausing may focus Resume; native return belongs to this entry control.
    if (
      opener?.isConnected &&
      !opener.disabled &&
      !opener.closest('[hidden],[inert],[aria-hidden="true"]')
    )
      opener.focus({ preventScroll: true });
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
  replayFeedback = createOperationStatus($('replay-operation-status'));
  replayFocusClearance = attachFocusClearance({
    container: $('replay-dialog'),
    heading: $('replay-operation-rail'),
    document,
  });
  async function downloadCurrentReplay(replay) {
    const notify = flightInformation.captureWarning('host.replay', { allowTerminal: true });
    if (replayDownload) return;
    const operation = {
      run,
      observed: true,
      status: replayFeedback.begin({
        message: 'Preparing replay download…',
        stage: 'downloading',
      }),
    };
    replayDownload = operation;
    $('export-replay').disabled = $('download-replay').disabled = true;
    try {
      const exported = await downloadJSON(
        replay,
        `revealline-${replay.summary.levelId}-replay.json`,
      );
      if (operation.observed && $('replay-dialog').open) {
        operation.status.finish({ message: exported.message });
        if (operation.run === run)
          notify(
            `Replay prepared with its exact rules, inputs and final state. ${exported.message}`,
          );
      }
    } catch (error) {
      if (operation.observed && $('replay-dialog').open)
        operation.status.finish({ message: `Replay download: ${error.message}`, state: 'error' });
    } finally {
      if (replayDownload === operation) {
        replayDownload = null;
        if (!soundtrackDisposed) {
          $('export-replay').disabled = !recorder;
          $('download-replay').disabled = !lastReplay;
        }
      }
    }
  }
  $('replay-dialog').addEventListener('close', () => {
    if ($('replay-dialog').open) return;
    if (replayDownload) replayDownload.observed = false;
    replayFeedback.clear();
  });
  $('export-replay').onclick = async () => {
    if (replayDownload) return;
    const notify = flightInformation.captureWarning('host.replay', { allowTerminal: true });
    try {
      if (!recorder) throw new Error('Start a new attempt to record a replay.');
      pause(true);
      lastReplay = exportReplay(recorder, run);
      $('replay-json').value = JSON.stringify(lastReplay, null, 2);
      $('replay-dialog').showModal();
      replayFocusClearance.refresh();
      await downloadCurrentReplay(lastReplay);
    } catch (error) {
      notify(`Replay could not export: ${error.message}`);
    }
  };
  $('download-replay').onclick = () => lastReplay && downloadCurrentReplay(lastReplay);
  function suspendInteraction() {
    cancelUnifiedOpening?.();
    // Returning to focus must not revive a picker or launch requested before
    // the interruption, even when its asynchronous work finishes afterward.
    ++unifiedOpenRevision;
    ++unifiedLaunchRevision;
    // Menu and result screens also need a neutral gate. Their pause() path
    // deliberately returns early, and a hidden renderer may not tick at all.
    controllerInactive = true;
    cancelModeDeparture({ close: true });
    cancelTitleFlight();
    invalidateRestart('Restart cancelled when focus changed.');
    invalidateContentSwitch({ announce: true });
    if (courseEntry)
      cancelCourseEntry('Course entry cancelled when focus changed. Your flight remains paused.');
    clearInput();
    controllerPreview?.clear();
    suspendAudio();
    pause(true);
  }
  onNativeInactive(suspendInteraction).catch((error) =>
    warning(`App lifecycle adapter unavailable: ${error.message}`, null, 'host.lifecycle'),
  );
  window.addEventListener('blur', suspendInteraction);
  function restoreListening() {
    if (document.hidden || soundtrackDisposed || enemyGuide?.practiceActive) return;
    if (!soundtrackPlayer) {
      // The procedural fallback is used when file-audio setup is unavailable.
      // It still needs a fresh resume after an iOS lifecycle interruption.
      if (sound.enabled && sound.context?.state !== 'running') void sound.resume();
      return;
    }
    if (!soundtrackSuspended) return;
    soundtrackSuspended = false;
    void soundtrackPlayer.resume();
  }
  const restoreAudioOnGesture = (event) => {
    if (
      document.hidden ||
      soundtrackDisposed ||
      enemyGuide?.practiceActive ||
      audioMaster.snapshot().muted
    )
      return;
    const listening = soundtrackPlayer?.snapshot();
    const blockedListening =
      event.isTrusted && listening?.desired && listening.status === 'blocked';
    if (soundtrackPlayer && (soundtrackSuspended || blockedListening))
      void activateAudio({ explicit: blockedListening });
    else if (!soundtrackPlayer && sound.enabled && sound.context?.state !== 'running')
      void sound.resume();
  };
  window.addEventListener('focus', restoreListening);
  document.addEventListener('pointerdown', restoreAudioOnGesture, { capture: true, passive: true });
  document.addEventListener('touchstart', restoreAudioOnGesture, { capture: true, passive: true });
  document.addEventListener('keydown', restoreAudioOnGesture, true);
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
      `${campaign.title || campaign.name || campaign.id} · ${campaign.levels[levelIndex].name} selected. Continue a saved flight separately.`,
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
        `${packLaunchRequest.packName} · ${packLaunchRequest.levelName} selected${autoplayPackLaunch ? ' · starting now…' : ' and ready.'}`,
      );
    }
  }
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
        textFace: displayPreferences.snapshot().textFace,
        // The texture is detached; only the displayed Phaser canvas has a CSS size.
        displayCSSWidth: this.game.canvas.clientWidth,
        paused,
        reduced: displayPreferences.snapshot().effectiveReducedEffects,
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
  async function prepareLibraryClassic(row, { signal }) {
    if (row.source === 'external')
      return installSourceChapter(row.packId, null, { signal, download: true });
    if (row.source === 'optional') {
      const catalog = await loadOptionalCatalog({ signal, baseURL: new URL('../', location.href) });
      const summary = catalog.packs.find((item) => item.id === row.packId);
      if (!summary) throw new Error('That optional chapter is unavailable in this release.');
      return installOptionalChapter(summary, { signal });
    }
    if (row.source === 'base') return;
    if (contentSwitchBusy || backupBusy || sessionBusy)
      throw new Error('Finish the current operation before downloading another chapter.');
    const operation = packLaunchGuard.begin(packs);
    packCommits.markIntent();
    contentSwitchBusy = true;
    const cancelled = () => {
      if (packLaunchGuard.current(operation, packs)) invalidateContentSwitch();
    };
    signal?.addEventListener('abort', cancelled, { once: true });
    try {
      if (signal?.aborted) throw new DOMException('Download cancelled.', 'AbortError');
      return await ensureBundledPack(row.packId, operation, { preserveCurrentRun: true });
    } finally {
      signal?.removeEventListener('abort', cancelled);
      if (packLaunchGuard.current(operation, packs)) {
        contentSwitchBusy = false;
        refreshContentSelectors();
        await packCommits.reconcile();
      }
    }
  }
  function departLibraryMission(context) {
    if (context.isCurrent?.() === false) return false;
    const target = unifiedLibrary.library.find(context.libraryMissionId);
    return requestModeDeparture('library', { preventDefault() {} }, $('shell-play'), {
      libraryTarget: target,
      libraryMode: context.mode,
    });
  }
  async function launchLibraryClassic(pack, selection, context) {
    if (context.isCurrent?.() === false) return false;
    if (journeyEnabled || context.mode !== 'solo') return departLibraryMission(context);
    if ($('shell-home').open) $('shell-home').close();
    const revision = unifiedLaunchRevision;
    const launch = {
      opener: $('shell-play'),
      isCurrent: () => revision === unifiedLaunchRevision && !document.hidden,
      onStarted: () => {
        unifiedChooser?.close();
      },
      onSelected: () => {},
      onCancelled: () => {
        if (!launch.isCurrent() || document.hasFocus?.() === false) return false;
        unifiedChooser?.restore();
        unifiedChooser?.reveal(context.libraryMissionId);
        return true;
      },
    };
    captureWorldPlay({ launch });
    const selected = await requestWorldPlay(pack, {
      launch,
      ...selection,
      onStatus: (status) => {
        if (launch.isCurrent())
          contentStatus(status.message, false, { busy: status.stage !== 'ready' });
      },
    });
    // An unfinished-flight replacement owns the pending action. Do not reopen
    // the library on top of its explicit Stay / Replace & play confirmation.
    return selected || missionReplacement?.launch === launch;
  }
  async function getUnifiedMissionLibrary() {
    if (unifiedLibrary) return unifiedLibrary;
    if (unifiedLibraryLoading) return unifiedLibraryLoading;
    unifiedLibraryLoading = (async () => {
      const index = await getJSON('content/mission-library-index.json');
      const route = authoredRoute || (await loadAuthoredJourneyRoute('whole-spatial-v5'));
      const host =
        candidateHost ||
        createCandidateSoloHost(route.source, {
          themes: journeyActorThemeCandidates(
            (await getJSON('content-design/themes.json')).themes,
            {
              includeOriginals: route.preserveOriginalThemes === true,
            },
          ),
          buildVersion,
          corePackIds: route.corePackIds,
          optionalCampaignIds: route.optionalCampaignIds,
        });
      const profile = candidateHost
        ? journeyProfile
        : createJourneyProfileStore({ profileKey: route.profileKey });
      if (!candidateHost) await profile.load();
      const manifestFor = (
        mission,
        difficulty = journeyPreferences?.snapshot().difficulty ?? 'standard',
      ) =>
        host
          .select(mission, difficulty)
          ?.manifests.find((manifest) => manifest.missionId === mission.levelId);
      const source = journeyLibrarySource({
        editionId: route.id,
        edition: route.id === 'whole-spatial-v5' ? 'New Journey' : route.label,
        catalog: host.catalog,
        profile,
        details: (mission) => journeyMissionDetails(manifestFor(mission)),
        tags: (mission) => authoredJourneyMissionTags(mission, manifestFor(mission, 'standard')),
        card: (mission) =>
          host.card(mission, journeyPreferences?.snapshot().difficulty ?? 'standard'),
        launch: (mission, context) => {
          if (context.isCurrent?.() === false) return false;
          if (!candidateHost || context.mode !== 'solo') return departLibraryMission(context);
          if ($('shell-home').open) $('shell-home').close();
          return launchJourneyMission(mission);
        },
      });
      const result = await createInstalledMissionLibrary({
        index,
        journeySources: [source],
        getPacks: () => packs,
        baseEntry,
        compatibility: ({ entry, level }) => {
          const supported = [];
          try {
            createRun(level, {
              classRecipes: entry.classRecipes,
              classId: entry.classRecipes[0].id,
            });
            supported.push('solo');
          } catch {}
          try {
            createDuel(level, {
              classRecipes: entry.classRecipes,
              classId: entry.classRecipes[0].id,
            });
            supported.push('versus');
          } catch {}
          return supported;
        },
        describe: ({ level }) => {
          const actual = normalizedLevel(level);
          return {
            rules: `${Math.round(actual.goal.coverage * 100)}% coverage · ${actual.rules.lives} lives · ${actual.rules.moveSpeed} cells/s · Authored rules`,
          };
        },
        prepareClassic: prepareLibraryClassic,
        availabilityExternal: (row, pack) => {
          if (!pack)
            return isRelease
              ? { state: 'download', bytes: row.download.bytes }
              : {
                  state: 'unavailable',
                  reason: 'Original-picture download is available in published builds.',
                };
          const present = chapterSnapshot?.index?.chapters.some(
            (chapter) => chapter.id === row.packId,
          );
          return present
            ? { state: 'ready' }
            : {
                state: 'unavailable',
                reason: 'Install this chapter with its original pictures in Worlds.',
              };
        },
        launchClassic: async (row, context) => {
          if (row.source === 'external') {
            const snapshot = await checkedChapters();
            await externalChapters.readiness(snapshot, row.packId);
            if (packs.packs.find((pack) => pack.id === row.packId) !== context.pack)
              throw new Error('Installed originals changed. Choose Play again.');
          }
          return launchLibraryClassic(context.pack, context.selection, context);
        },
        launchCustom: (binding, context) =>
          launchLibraryClassic(binding.pack, binding.selection, context),
        progressClassic: (row) =>
          library.campaigns[row.campaignKey]?.clears?.[row.levelId] ? 'Cleared' : '',
        progressCustom: (binding) =>
          library.campaigns[binding.selection.campaignKey]?.clears?.[binding.selection.levelId]
            ? 'Cleared'
            : '',
      });
      if (unifiedDisposed) {
        result.library.dispose();
        if (!candidateHost) host.preparer.dispose();
        throw new DOMException('Mission library closed.', 'AbortError');
      }
      disposeUnifiedPreview = () => {
        if (!candidateHost) host.preparer.dispose();
      };
      const state = createMissionLibrarySessionState({ mode: 'solo' });
      retiredJourneyChooser?.destroy();
      retiredJourneyChooser = null;
      unifiedChooser = attachJourneyChooser({
        library: result.library,
        profile,
        readState: state.read,
        writeState: state.write,
        launchContext: libraryActivationContext,
        onPause: () => {
          pause(true);
          clearInput();
          journeySkipArmed = null;
          $('journey-skip').textContent = 'Skip mission';
        },
        onReturn: (opener) => {
          clearInput();
          (availableFocusTarget(opener) ? opener : controllerFocus())?.focus({
            preventScroll: true,
          });
        },
      });
      unifiedLibrary = result;
      return result;
    })();
    try {
      return await unifiedLibraryLoading;
    } finally {
      unifiedLibraryLoading = null;
    }
  }
  function libraryActivationContext() {
    const revision = ++unifiedLaunchRevision;
    const snapshot = {
      run,
      recorder,
      runId,
      activeEntry,
      campaign,
      levelIndex,
      theme,
      classId,
      seed,
      turnPolicy,
      flightPictures,
      packs,
      libraryGeneration,
      difficulty: library.preferences.campaignDifficulty,
      journeyRevision: journeyPreferences?.snapshot().revision,
    };
    return {
      isCurrent: () =>
        revision === unifiedLaunchRevision &&
        !unifiedDisposed &&
        !document.hidden &&
        document.hasFocus?.() !== false &&
        paused &&
        snapshot.run === run &&
        snapshot.recorder === recorder &&
        snapshot.runId === runId &&
        snapshot.activeEntry === activeEntry &&
        snapshot.campaign === campaign &&
        snapshot.levelIndex === levelIndex &&
        snapshot.theme === theme &&
        snapshot.classId === classId &&
        snapshot.seed === seed &&
        snapshot.turnPolicy === turnPolicy &&
        snapshot.flightPictures === flightPictures &&
        snapshot.packs === packs &&
        snapshot.libraryGeneration === libraryGeneration &&
        snapshot.difficulty === library.preferences.campaignDifficulty &&
        snapshot.journeyRevision === journeyPreferences?.snapshot().revision,
    };
  }
  async function openUnifiedMissions(opener, options) {
    cancelUnifiedOpening?.();
    const revision = ++unifiedOpenRevision;
    // The picker may need its first metadata load. Retire post-adoption Next
    // intent immediately; a not-yet-mounted dialog cannot block its resume.
    ++resultAttemptEpoch;
    const parent = controllerDialog();
    const homeWasOpen = $('shell-home').open,
      oldRun = run,
      wasStarted = started;
    ++unifiedLaunchRevision;
    pause(true);
    clearInput();
    const feedback = document.createElement('span');
    feedback.id = 'mission-library-opening-status';
    feedback.className = 'micro-note';
    feedback.setAttribute('role', 'status');
    feedback.textContent = 'Preparing missions…';
    (opener?.isConnected ? opener : $('shell-play')).after(feedback);
    let failed = false;
    const cancel = () => {
      if (revision === unifiedOpenRevision) ++unifiedOpenRevision;
      opening.dispose();
      feedback.remove();
      if (cancelUnifiedOpening === cancel) cancelUnifiedOpening = null;
    };
    const opening = trackMissionLibraryOpening({
      onRetire: cancel,
    });
    cancelUnifiedOpening = cancel;
    try {
      const host = await getUnifiedMissionLibrary();
      await host.refreshInstalled();
      opening.dispose();
      if (
        revision !== unifiedOpenRevision ||
        !opening.current() ||
        unifiedDisposed ||
        document.hidden ||
        document.hasFocus?.() === false ||
        controllerDialog() !== parent ||
        $('shell-home').open !== homeWasOpen ||
        run !== oldRun ||
        started !== wasStarted ||
        !paused
      )
        return;
      unifiedChooser.open(opener, options);
    } catch (error) {
      if (revision === unifiedOpenRevision) {
        failed = true;
        feedback.textContent = 'Missions could not load. Choose Missions to retry.';
        warning(`Mission library could not open: ${error.message}`);
      }
    } finally {
      opening.dispose();
      if (!failed) {
        feedback.remove();
        if (cancelUnifiedOpening === cancel) cancelUnifiedOpening = null;
      }
    }
  }
  if (journeyEnabled) {
    document.body.classList.add('journey-preview');
    show('journey-artwork-availability', !!candidateHost);
    if (authoredRoute?.id === 'whole-spatial-v5')
      $('journey-artwork-availability').textContent =
        'Mission pictures need an internet connection. Preparing offline play does not yet include them; full game downloads do.';
    $('shell-title-edition').textContent = candidateHost
      ? authoredRoute.id === 'whole-spatial-v5'
        ? `NEW JOURNEY / ${journeyCatalog.missions.length} MISSIONS`
        : `${authoredRoute.label.toUpperCase()} / UNVALIDATED TEST BUILD`
      : 'JOURNEY / TECHNICAL TEST PREVIEW';
    journeyChooser = attachJourneyChooser({
      catalog: journeyCatalog,
      profile: journeyProfile,
      onChoose: (mission) => {
        // Browsing retains Home for Back. Only deliberate mission selection
        // leaves it before the staged preparation owns the next attempt.
        if ($('shell-home').open) $('shell-home').close();
        return launchJourneyMission(mission);
      },
      getCard: candidateHost
        ? (mission) => candidateHost.card(mission, journeyPreferences.snapshot().difficulty)
        : undefined,
      onPause: () => {
        pause(true);
        clearInput();
        journeySkipArmed = null;
        $('journey-skip').textContent = 'Skip mission';
      },
      onReturn: (opener) => {
        clearInput();
        (availableFocusTarget(opener) ? opener : controllerFocus())?.focus({ preventScroll: true });
      },
    });
    $('journey-chooser').querySelector('.journey-footer').append($('missions-catalogue'));
    refreshJourneySkip();
    $('journey-skip').onclick = () => {
      const mission = journeySkipMission();
      if (!mission) return;
      const next = nextJourneyMission(mission.id);
      if (!next) {
        journeyChooser.open($('journey-skip'));
        return;
      }
      if (journeySkipArmed !== runId) {
        pause(true);
        clearInput();
        journeySkipArmed = runId;
        $('journey-skip').textContent = 'Confirm skip';
        warning(
          `Skip to ${next.name}? No clear is awarded. You can return at any time. Activate Confirm skip to continue.`,
        );
        $('journey-skip').focus({ preventScroll: true });
        return;
      }
      journeySkipArmed = null;
      $('journey-skip').textContent = 'Skip mission';
      void launchJourneyMission(next, { skipped: mission });
    };
    $('journey-save-retry').onclick = () => void journeyProfile.flush();
    $('journey-save-export').onclick = async () => {
      try {
        await downloadJSON(JSON.parse(journeyProfile.export()), journeyProfile.backupFilename);
      } catch (error) {
        $('journey-save-message').textContent =
          `Export failed: ${error.message}. Your session progress is still here.`;
      }
    };
    window.addEventListener('online', () => void journeyProfile.flush());
  }
  if (journeyPreferences) {
    let preferenceRevision = journeyPreferences.snapshot().revision,
      exportSequence = 0;
    journeyPreferences.subscribe((snapshot) => {
      // Cross-tab intent updates the next attempt only. An old in-flight
      // preparation cannot adopt a now-stale preset after its pixels resolve.
      if (preferenceRevision !== snapshot.revision) {
        preferenceRevision = snapshot.revision;
        cancelResultAttempt();
      }
      exportSequence++;
      show('journey-preferences-recovery', !snapshot.durable);
      $('journey-preferences-message').textContent = snapshot.error;
      refreshDifficulty();
      journeyChooser?.refresh();
    });
    $('journey-preferences-retry').onclick = () => {
      const restoreFocus = document.activeElement === $('journey-preferences-retry');
      const snapshot = journeyPreferences.retry();
      if (snapshot.durable && restoreFocus && availableFocusTarget($('difficulty-select')))
        $('difficulty-select').focus({ preventScroll: true });
    };
    $('journey-preferences-export').onclick = async () => {
      const ticket = ++exportSequence;
      try {
        const result = await downloadJSON(
          JSON.parse(journeyPreferences.export()),
          'revealline-journey-difficulty.json',
        );
        if (ticket === exportSequence && !$('journey-preferences-recovery').hidden)
          $('journey-preferences-message').textContent =
            `${journeyPreferences.snapshot().error} ${result.message}`;
      } catch (error) {
        if (ticket === exportSequence && !$('journey-preferences-recovery').hidden)
          $('journey-preferences-message').textContent =
            `Export failed: ${error.message}. Your session difficulty choice is still here.`;
      }
    };
  }
  optionalWorlds = attachOptionalChaptersPanel({
    onPlayActivation: captureWorldPlay,
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
          async play({ signal, onStatus, launch }) {
            if (!storedStateAdopted || !persistenceReady)
              throw new Error('Reload after recovery before playing this chapter.');
            const snapshot = await checkedChapters({ signal });
            await externalChapters.readiness(snapshot, descriptor.id, { signal });
            assertWorldPlay(launch);
            adoptContentCatalog(contentFromChapters(snapshot));
            const pack = packs.packs.find((item) => item.id === descriptor.id);
            return requestWorldPlay(pack, { signal, launch, onStatus });
          },
          async choose({ signal, onStatus, launch }) {
            if (!storedStateAdopted || !persistenceReady)
              throw new Error(
                'Reload after recovery to adopt the preserved profile before choosing this chapter.',
              );
            preparationStatus(
              onStatus,
              'Checking installed chapter originals…',
              'verifying',
              () => !signal?.aborted,
            );
            const snapshot = await checkedChapters({ signal });
            await externalChapters.readiness(snapshot, descriptor.id, { signal });
            if (signal.aborted || !launch?.isCurrent())
              throw new DOMException('Chapter selection cancelled.', 'AbortError');
            // Reconcile only checked content; this does not replace the run.
            // The explicit selection below still requires Stay / Replace.
            adoptContentCatalog(contentFromChapters(snapshot));
            const pack = packs.packs.find((p) => p.id === descriptor.id);
            return requestWorldLaunch(
              resolvePackCampaign(pack, pack.campaigns[0].id),
              launch,
              onStatus,
            );
          },
        }))
      : [],
    loadCatalog: async ({ signal }) => {
      const options = { signal, baseURL: new URL('../', location.href) };
      if (isRelease) await loadExternalCatalog(options);
      return loadOptionalCatalog(options);
    },
    install: installOptionalChapter,
    playInstalled: (pack, options) => {
      if (SOURCE_EXTERNAL_EDITIONS.some(({ descriptor }) => descriptor.id === pack.id))
        throw new Error('Use this chapter’s exact original-picture card.');
      return requestWorldPlay(pack, options);
    },
    play: async (summary, options) => {
      const pack = packs.packs.find((item) => item.id === summary.id);
      if (!pack) throw new Error('Install this chapter before playing.');
      await verifyOptionalInstalled(pack, summary, { signal: options.signal });
      return requestWorldPlay(pack, options);
    },
    chooseInstalled: async (pack, { signal, launch, onStatus }) => {
      if (courseEntry || courseSession || practice || !storedStateAdopted || !persistenceReady)
        throw new Error(
          'Return to the normal game and resolve recovery before choosing a chapter.',
        );
      if (signal?.aborted) throw new DOMException('World selection cancelled.', 'AbortError');
      if (!packs.packs.includes(pack))
        throw new Error('Installed content changed; refresh the chapter list.');
      // External originals always go through their descriptor/readiness card.
      if (SOURCE_EXTERNAL_EDITIONS.some(({ descriptor }) => descriptor.id === pack.id))
        throw new Error('Use this chapter’s exact original-picture card.');
      return requestWorldLaunch(resolvePackCampaign(pack, pack.campaigns[0].id), launch, onStatus);
    },
    choose: async (summary, { signal, onStatus, launch }) => {
      if (courseEntry || courseSession || practice)
        throw new Error('Return from practice before choosing a world.');
      const pack = packs.packs.find((item) => item.id === summary.id);
      if (!pack) throw new Error('Install this world before choosing it.');
      preparationStatus(
        onStatus,
        `Verifying ${summary.name}…`,
        'verifying',
        () => !signal?.aborted,
      );
      await verifyOptionalInstalled(pack, summary, { signal });
      if (signal?.aborted) throw new DOMException('World selection cancelled.', 'AbortError');
      if (packs.packs.find((item) => item.id === summary.id) !== pack)
        throw new Error('Installed content changed; choose this world again.');
      return requestWorldLaunch(resolvePackCampaign(pack, pack.campaigns[0].id), launch, onStatus);
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
  if (!practiceSession) {
    retiredJourneyChooser = journeyChooser;
    journeyChooser = {
      open: openUnifiedMissions,
      refresh: () => unifiedChooser?.refresh(),
      close: () => unifiedChooser?.close(),
    };
  }
  gameShell = attachGameShell({
    training: courseSession,
    practiceReturn: $('enemy-workshop-return'),
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
      (started && !['won', 'lost'].includes(run?.status)) ||
      !$('continue-saved').hidden ||
      !!journeyCatalog.find(journeyProfile?.snapshot().cursors.solo),
    initial: !practice && !courseSession && !packLaunchRequest && !libraryHandoff,
    initialFocus: false, // The boot guard still hides the title until ready().
    titleDestination: () =>
      `Start · ${journeyDestination()?.name || campaign.levels[levelIndex].name}`,
    titleContinueDestination: () =>
      !started || ['won', 'lost'].includes(run?.status) ? journeyDestination()?.name : undefined,
    onTitleStart: (options) => {
      const destination = journeyDestination();
      if (destination && !started && $('continue-saved').hidden) {
        if (!options.isCurrent()) return;
        options.leave();
        return launchJourneyMission(destination);
      }
      return launchTitleFlight('start', options);
    },
    onTitleContinue: (options) => {
      const destination = journeyDestination();
      if (
        destination &&
        (!started || ['won', 'lost'].includes(run?.status)) &&
        $('continue-saved').hidden
      ) {
        if (!options.isCurrent()) return;
        options.leave();
        return launchJourneyMission(destination);
      }
      return launchTitleFlight('continue', options);
    },
    onTitleCancel: cancelTitleFlight,
    onModeDeparture: requestModeDeparture,
    separateTeam: !!authoredRoute,
    onWorlds: () => optionalWorlds.open(),
    onMissions: !practiceSession
      ? (opener) =>
          journeyChooser.open(opener, {
            returnLabel: $('shell-home').open ? 'Back to menu' : 'Back to game',
          })
      : undefined,
  });
  if (authoredRoute?.id === 'whole-spatial-v5')
    $('shell-title-team').querySelector('.game-mode-description').textContent = '12 Team missions';
  for (const id of ['shell-catalogue', 'missions-catalogue']) {
    const link = $(id);
    link.hidden = practiceSession;
    link.textContent = 'All missions';
    link.setAttribute('href', catalogueHref);
    link.onclick = (event) => {
      if (
        !practiceSession &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        void openUnifiedMissions(link, {
          returnLabel: $('shell-home').open ? 'Back to menu' : 'Back to brief',
        });
        return;
      }
      const parent = link.closest('dialog');
      void requestModeDeparture('catalogue', event, link, {
        origin: 'solo-title',
        isCurrent: () => parent?.open && parent.contains(link),
      });
    };
  }
  const workshopContext = new URL(location.href);
  workshopContext.searchParams.set(
    'journey',
    authoredRoute?.id ?? (journeyEnabled ? '1' : 'legacy'),
  );
  mountWorkshopLinks({ document, href: workshopContext.href });
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
  if (libraryHandoff && !practiceSession) {
    const revision = ++unifiedOpenRevision;
    const incomingRun = run,
      incomingStarted = started;
    void (async () => {
      try {
        const host = await getUnifiedMissionLibrary();
        if (
          revision !== unifiedOpenRevision ||
          run !== incomingRun ||
          started !== incomingStarted ||
          !paused ||
          document.hidden ||
          document.hasFocus?.() === false
        )
          return;
        const row = host.library.find(libraryHandoff);
        if (!row || !row.modes.includes('solo'))
          throw new Error(
            'This exact mission edition is not available in Solo. No different mission was started.',
          );
        if ((row.collection === 'Journey') !== !!candidateHost)
          throw new Error(
            'This mission belongs to a different gameplay host. Select it from the library.',
          );
        if (host.library.availability(row, 'solo').state !== 'ready') {
          unifiedChooser.open($('shell-missions'));
          unifiedChooser.reveal(row.id);
          return;
        }
        const selected = await host.library.launch(row, {
          mode: 'solo',
          ...libraryActivationContext(),
        });
        if (selected === false && revision === unifiedOpenRevision) {
          unifiedChooser.open($('shell-missions'));
          unifiedChooser.reveal(row.id);
        }
      } catch (error) {
        if (revision === unifiedOpenRevision)
          warning(`Requested mission could not open: ${error.message}`);
      }
    })();
  }
  if (
    exactReturn &&
    !document.hidden &&
    document.hasFocus?.() !== false &&
    (document.activeElement === document.body || !availableFocusTarget(document.activeElement))
  ) {
    gameShell.openMissions();
    $('shell-mode-choice').open = true;
    const returnFocus = $(returnContext.focus === 'versus' ? 'shell-versus' : 'shell-team');
    if (availableFocusTarget(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  const workshopReturn = readWorkshopReturn(location.search);
  if (
    !practice &&
    !courseSession &&
    !packLaunchRequest &&
    !libraryHandoff &&
    !exactReturn &&
    workshopReturn &&
    !document.hidden &&
    document.hasFocus?.() !== false &&
    (document.activeElement === document.body || !availableFocusTarget(document.activeElement)) &&
    gameShell?.openWorkshop({ tool: workshopReturn.id })
  )
    clearWorkshopReturn(window);
  controllerReading?.refresh();
  // Boot removes the visibility guard synchronously. Do not refocus a hidden
  // placeholder or replace a deliberate choice made during that handoff.
  if (
    !document.hidden &&
    document.hasFocus?.() !== false &&
    (document.activeElement === document.body || !availableFocusTarget(document.activeElement))
  ) {
    const target = controllerFocus();
    if (availableFocusTarget(target)) target.focus({ preventScroll: true });
  }
} catch (error) {
  globalThis.RevealLineBoot?.fail(error);
  $('overlay-title').textContent = 'The game could not load.';
  $('overlay-copy').textContent = error.message;
  show('start-button', false);
  $('run-message').textContent = new URLSearchParams(location.search).has('course')
    ? 'This course could not open. Use REVEAL / LINE to return to the normal game; no training progress was saved.'
    : new URLSearchParams(location.search).get('practice') === '1'
      ? 'Open the Playground and choose Play configuration, or use REVEAL / LINE to return to campaign.'
      : 'Serve the project through HTTP and check the content files. Your saved progress is unchanged.';
  console.error(error);
}
