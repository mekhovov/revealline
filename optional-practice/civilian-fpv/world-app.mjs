import { getLocale, setLocale } from '../../game/i18n/index.mjs';
import { exportJSONFile, onNativeInactive } from '../../game/platform.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_LESSONS,
  BEGINNER_CATALOGUE,
  ACRO_LESSON_ORDER,
  EXPERIENCED_LESSON_ORDER,
  ADVANCED_LESSON_ORDER,
  PRO_LESSON_ORDER,
  MASTER_LESSON_ORDER,
  PRIMARY_LESSON_ORDER,
  SELF_LEVEL_LESSON_ORDER,
  WORLD_THEMES,
  FLIGHT_WORLDS,
  ACTIVITY_NAMES,
  CURATED_PLAYLISTS,
  canonicalFreeFlightEntry,
} from './world-catalogue.mjs';
import { FLIGHT_COURSES } from './catalogue.mjs';
import {
  createSnakeHuntPresentation,
  mountSnakeHuntPresentationControls,
} from './snake-hunt-presentation.mjs';
import { FLIGHT_DEMONSTRATIONS } from './demonstrations.mjs';
import { WORLD_DEMONSTRATIONS } from './world-demonstrations.mjs';
import { createFlight, createFlightRecorder, replayFlightCooperatively } from './model.mjs';
import {
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  createWorldContinuationRecorder,
  replayWorldFlight,
  recoverWorldFlight,
  prepareWorldContinuationReplay,
  LIVE_ACTOR_RULES,
  migrateWorldFlightToLive,
  validateWorldCourse,
  worldCourseRequiresAcro,
  worldFlightIdentity,
} from './world-model.mjs';
import { mountBeginnerCoach, learningObjectiveFeedback } from './beginner-coach.mjs';
import {
  createFlightInput,
  createFlightInputDiagnostics,
  createFlightMenuNavigation,
  createFlightGamepad,
  keyboardFlightPreset,
  keyboardFlightHelp,
  KEYBOARD_PRESET_KEY,
} from './input.mjs';
import { createRadioRuntime } from './radio-runtime.mjs';
import { restoreVerifiedRadio } from './radio-session.mjs';
import { mountRadioSetup } from './radio-setup.mjs';
import { createTuningLibraryStore } from './tuning-library.mjs';
import { mountFlightTuning } from './tuning-ui.mjs';
import { TUNED_RESPONSE_FORMAT } from './flight-response.mjs';
import { mountAdvancedPractice } from './advanced-practice.mjs';
import { createAdvancedRegionalSession } from './advanced-regional.mjs';
import { createAircraftCourseSession } from './aircraft-course-session.mjs';

import { mountAircraftPracticeControls } from './aircraft-practice-controls.mjs';
import { prepareAircraftChallenge, withAircraftChallenge } from './aircraft-challenge.mjs';
import { mountAircraftChallengeControls } from './aircraft-challenge-ui.mjs';
import { aircraftCourseAdvice, mountAircraftCourseFilter } from './aircraft-course-advice.mjs';
import {
  createAdvancedWorkerClient,
  ADVANCED_VERIFICATION_WATCHDOG_MS,
} from './advanced-worker-client.mjs';
import { ADVANCED_REGIONAL_RECOVERY_BYTES } from './advanced-simulation.mjs';
import {
  mountFlightFullscreen,
  mountFlightCameraControls,
  mountFlightSetup,
  mountFlightComfort,
  restoreFlightComfortCamera,
  mountFlightPractice,
  attachSimMissionLibraryChooser,
  createSimMissionLibrary,
  createSimContinuousPlayController,
  createSimEnemyStatsHost,
  mountSimEnemyStats,
  mountSimContinuousPlayControls,
  mountSimContinuousCelebration,
  mountSimPlayShell,
  mountSimModeSettings,
  mountSimGlobalSettings,
  attachSimMenuAudioSettings,
  readSimRadioAudio,
  SIM_RADIO_AUDIO_KEY,
  createSimDisplayPreferences,
  attachSimThemeFamilyControls,
  simMenuAnimationBinding,
  subscribeSimMenuAnimation,
  simAttachSettingsPanels,
  simSettingsPanelBack,
  simSettingsTabOwnsKey,
  createSimModeLinks,
} from './flight-fullscreen.mjs';
import {
  DEFAULT_RESPONSE,
  createFlightProfileStore,
  responseIdentity,
  STICK_LAYOUTS,
  neutralFlightInput,
} from './radio-profile.mjs';
import { createFlightNotebook } from './notebook.mjs';
import {
  createPlaylistStore,
  validatePlaylist,
  exportPlaylist,
  resolvePlaylist,
} from './playlists.mjs';
import { openWorldRecords, exportProofParts, importProofPart } from './world-records.mjs';
import {
  inspectImport,
  projectFromImport,
  compilePlayable,
  admitWorldRouteGuides,
  selectWorldRouteGuide,
  previewReimport,
  canonicalWorldJSON,
  preparePack,
  inspectPack,
  worldSHA256,
  installPack,
  exportEditedProject,
} from './world-content.mjs';
import { importEditableZip } from './world-zip.mjs';
import { openWorldStore } from './world-store.mjs';
import { mountPracticeOfflineControls } from './offline.mjs';
import {
  mountWorldLibrary,
  worldImportErrorCopy,
  WORLD_LIBRARY_CATALOGUE,
} from './world-reaction-runtime.mjs';
import { mountRegionalLibrary, regionalPresentationOptions } from './regional-library.mjs';
import { dataIdentity } from '../../game/data-json.mjs';
import { runtimeActorArtRevision } from '../../game/hunt/preferences.mjs';
import {
  prepareNativeIndustrialAttempt,
  restoreNativeIndustrialCourse,
  detachNativeIndustrialCourse,
  validateNativeIndustrialCourses,
  assertNativeIndustrialEdit,
} from './industrial-environment.mjs';
import {
  THEME_PROFILES,
  resolveThemeExperience,
  resolveSimThemeProfile,
  snapshotSimThemeProfile,
  recordedSimAppearance,
  createSimAppearanceSession,
  playableSimAppearance,
  validateSimAppearance,
} from './world-themes.mjs';
import { mountWorldEditor, mountWorldRouteGuideEditor } from './world-editor.mjs';
import {
  mountRadioMenuControls,
  radioFlightHelp,
  createRadioStagedAction,
  mountSimPresentation,
  mountSimGlobalTools,
  mountSimAppearanceControls,
  mountDroneResponse,
  mountSimAudioControls,
  paintStickDirections,
  mountStickTrace,
  mountFlightHud,
  mountFlightInstruments,
  flightGoalFeedback,
} from './sim-presentation.mjs';
import { createWorldAudio } from './world-reaction-runtime.mjs';
import {
  loadRegionalReview,
  regionalReviewEntry,
  regionalLibraryEntry,
  regionalStartingPoint,
  regionalLocationIdentity,
  regionalSavedLocation,
  regionalNavigationTarget,
  regionalNavigationFeedback,
  createRegionalSession,
  regionalPreparationFeedback,
} from './regional-session.mjs';
import { openRegionalLocations, validateRegionalLocationStart } from './regional-locations.mjs';
import { mountWorldHuntReactions } from './world-reaction-runtime.mjs';
import { mountWorldEnemyGuide, worldEnemyGuide } from './world-reaction-runtime.mjs';
import {
  evaluateWorldResult,
  createSectorTracker,
  compatibleGhost,
  prepareCheckpointPractice,
  prepareSectionReplay,
} from './world-reaction-runtime.mjs';
import {
  splitCourseDefinition,
  compileContentProject,
  criterionPosition,
  translateCriterion,
} from './content-definitions.mjs';
import { builtinWorldScene, createFlightRenderer } from './world-assets.mjs';
import { mountDroneHangar } from './world-reaction-runtime.mjs';
import {
  mountActorEditor,
  inspectEncounterRecovery,
  prepareEncounterDefinition,
  createEncounterRuntime,
  createNativeEncounterGeometry,
  encounterPhysicsCourse,
  createEncounterSession,
  createEncounterPlayback,
  createEncounterArchive,
  createEncounterArchiveStore,
  inspectEncounterArchive,
  ENCOUNTER_ARCHIVE_FORMAT,
  createEncounterPreferences,
  mountEncounterControls,
  mountCombatVitals,
  ENCOUNTER_WEAPONS,
  encounterActivityLabel,
  createRegionalEncounterGeometry,
  createCombatPresentationPreferences,
  mountEncounterEditor,
  validateEncounterStudioBundle,
  createCombatPresentation,
  createCombatActorPresentation,
  prepareCombatAppearanceModels,
  cloneCombatSkeleton,
  createCombatAppearanceChoice,
  openCombatAppearanceStore,
  COMBAT_APPEARANCE_DOWNLOAD,
} from './world-reaction-runtime.mjs';
import { fpvWorldReturnURL } from '../../game/fpv-entry.mjs';

const COPY_EN = {
  backToGame: 'Back to FPV / LINE',
  learn: 'Learn to fly',
  beginLearning: 'Start Flight School',
  schoolEyebrow: 'ACRO FLIGHT SCHOOL · BUILD YOUR MASTERY',
  schoolTitle: 'Every pilot starts here.',
  schoolIntro: `Build your skills through ${PRIMARY_LESSON_ORDER.length} guided Acro lessons across Beginner, Experienced, Advanced, Pro and Master tiers. Watch the complete route, take control and practise each real objective. ${SELF_LEVEL_LESSON_ORDER.length} optional self-level lessons are also open.`,
  schoolFilterLabel: 'Choose a learning tier',
  schoolReassurance:
    'Choose Self-level or Acro. Your mode choice is kept; your usual camera and response settings return when you leave. All lessons are open.',
  schoolLift: '01 · Lift',
  schoolControl: '02 · Control',
  schoolExplore: '03 · Explore',
  schoolSee: 'See the control',
  schoolUnderstand: 'Watch the response',
  schoolTry: 'Fly it yourself',
  schoolAfterTitle: 'Your next adventure is waiting.',
  schoolAfterHelp: 'Use what you learned in Academy drills, open exploration and your first races.',

  settings: 'Settings',
  startFlying: 'Start flying',
  chooseWorld: 'Choose a world',
  connectRadio: 'Set up your radio',
  simEdition: 'SIMULATOR EDITION',
  allOpen: 'All open. Your pace.',
  flightDestinations: 'FLIGHT DESTINATIONS',
  chooseWorldHelp: 'Explore, race or test your precision.',
  filterChallenges: 'Search & filters',
  installedWorlds: 'Installed worlds',
  recordedFlights: 'Recorded flights & recovery',
  flightOptions: 'Flight options',
  backToLobby: 'Back to lobby',
  flightMode: 'Flight mode',
  controlSource: 'Controls',
  touchResponse: 'Touch response',
  keyboardPreset: 'Keyboard layout',
  keyboardTwoStick: 'Two-stick · WASD + arrows',
  keyboardClassic: 'Classic · W/S pitch',
  touchPrecise: 'Precise — small corrections',
  touchDirect: 'Direct — linear response',
  cameraLabel: 'Camera',
  aircraftLabel: 'Aircraft',
  graphicsLabel: 'Graphics',
  sticksLabel: 'Live sticks',
  droneGuideLabel: 'Drone response',
  droneGuideOn: 'Compact',
  droneGuideLearning: 'Learning',
  guideScale: 'Guide text',
  guideStandard: 'Standard',
  guideLarge: 'Large',
  droneGuideOff: 'Off',
  radioSetup: 'Radio setup',
  makeItYours: 'MAKE IT YOURS',
  settingsHelp: 'Your controls and flight preferences carry across worlds and playlists.',
  audioMixHelp:
    'Adjust sound without changing your master mute. Interface & feedback includes gate, impact and combat cues. Your mix is shared across simulator views.',
  textStyle: 'Text style',
  gameType: 'Game typography',
  plainType: 'Plain text',
  menuMotion: 'Menu motion',
  systemMotion: 'Follow device preference',
  reducedMotion: 'Reduced motion',
  settingsPaused: 'Changing settings keeps your flight paused. Resume when you are ready.',
  firstFlight: 'YOUR FIRST FLIGHT',
  firstFlightTitle: 'Never flown before? Start right here.',
  firstFlightHelp: `Start with ${ACRO_LESSON_ORDER.length} beginner Acro lessons and clear live control diagrams. Continue into precision, navigation and raised landings when you are ready. Every lesson is open.`,
  watchFirst: 'Watch first flight',
  tryFirst: 'Try first flight',
  demoCoverage:
    '104 recorded examples cover all 52 Academy, Woodland Park, Ukrainian Courtyard, Warehouse, Racing Stadium and Container Yard challenges in both modes. Parking Garage examples are still in production.',
  watchDemo: 'Watch demonstration',
  playbackSpeed: 'Playback speed',
  flyThis: 'Fly this challenge',
  inspectDrone: 'Inspect drone',
  hangarHelp: 'Drag to rotate. Scroll to zoom. Every appearance uses the same flight handling.',
  explore: 'Fly',
  playlists: 'My playlists',
  creator: 'Workshop',
  packs: 'Library',
  eyebrow: 'THE WORLD IS YOUR FLIGHT LINE',
  heading: 'Find your line.',
  intro: 'From your first hover to your next perfect lap. Pick a world and make it yours.',
  challenges: 'challenges',
  worlds: 'worlds',
  allDifficulty: 'All difficulties',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  allProgress: 'All progress',
  completed: 'Completed',
  notFlown: 'Not completed',
  empty: 'No challenges match these filters.',
  yourSequence: 'YOUR FLIGHT SEQUENCE',
  playlistHelp: 'Mix worlds and activities. Repeat a challenge as often as you like.',
  collections: 'Collections & saved playlists',
  importPlaylist: 'Import playlist',
  playlistTitle: 'Playlist title',
  playlistEmpty: 'Use + on any challenge to add it here.',
  flyPlaylist: 'Fly playlist',
  save: 'Save',
  export: 'Export',
  clear: 'Clear',
  buildYourLine: 'BUILD YOUR LINE',
  creatorTitle: 'From an idea to a flight.',
  creatorHelp:
    'Start with a challenge, change its route, then test your own version. Import a GLB world\n          to go further.',
  themePreview: 'Authored theme',
  snap: 'Snap',
  resetView: 'Reset view',
  orbitLeft: 'View left',
  orbitRight: 'View right',
  orbitUp: 'View up',
  orbitDown: 'View down',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  editorHint: 'Select a route marker, drag its arrows; drag empty space to orbit, scroll to zoom.',
  challengeEditor: 'Challenge editor',
  template: 'Starting challenge',
  clone: 'Create a copy',
  undo: 'Undo',
  redo: 'Redo',
  challengeTitle: 'Challenge title',
  criteria: 'Route & objectives',
  missionBriefing: 'Mission briefing',
  applyPosition: 'Apply position',
  duplicate: 'Duplicate',
  remove: 'Remove',
  sourceJson: 'Challenge JSON',
  applyJson: 'Validate & apply JSON',
  testFlight: 'Test flight',
  exportChallenge: 'Export challenge',
  worldGuideTitle: 'How to import your first world',
  worldGuideIntro:
    'Want a ready-to-fly world? Use Library. This importer is for scenery you want to turn into your own course.',
  worldGuideGet:
    'Download and unzip one scene. Prefer a self-contained GLB. A kit with many models must first be assembled into one scene in Blender.',
  worldGuideConvert:
    'Have a .blend, FBX or OBJ? Open or import it in Blender, then File → Export → glTF 2.0 → glTF Binary (.glb). Use PNG/JPEG textures and leave Draco compression off. Export custom properties if you authored gameplay markers.',
  worldGuideCredit:
    'Fill in Asset author, the original Source URL and the actual License before choosing files. CC0 is not a substitute for an unknown license. Keep credits and note your changes when sharing CC BY work.',
  worldGuideSelect:
    'Choose scene files: select exactly one .glb, or one .gltf together with its .bin and PNG/JPEG files. For nested texture folders use Choose scene folder and preserve the directory structure. Select the scene subfolder, not an entire asset kit.',
  worldGuidePlayable:
    'Read the import report and Preview world. Scenery is visual only: add simplified collision markers, a safe spawn and route objectives. Check the flight bounds and use Test flight in both modes. The automatic starter route is not a finished level.',
  worldGuideSave:
    'Export editable project for a backup, then Install pack to keep it in this browser. Export world pack to share; recipients import it in Library. Export again after edits. Before importing a different scene, back up your draft and choose Start a new world.',
  worldGuideLimits:
    'Current scene limit: 16 MiB after packing, up to 128 supplied files. PNG/JPEG only. A download being free does not guarantee compatibility; large scenes need texture reduction and geometry cleanup before import.',
  worldGuideTrouble:
    'Missing resource? Keep file names and folders unchanged, or re-export a self-contained GLB. Unsupported extension? Re-export without geometry compression and with PNG/JPEG textures. Missing spawn/colliders? Follow the authoring guide below; these are gameplay data, not texture errors.',
  worldGuideLinks: 'Export and authoring help',
  worldGuideAuthoring: 'SIM markers, collisions and export preset',
  worldResourcesTitle: 'Find free scenes & scenery — 23 candidates',
  worldResourcesIntro:
    'These are source resources for review, not installed or verified SIM levels. Links open a new tab and need internet. The guide itself stays with the simulator.',
  worldResourcesScenes: 'Assembled scenes — convert and prepare',
  worldResourcesSceneHelp:
    'Start with the small construction site. Poly Haven scenes offer richer detail but need Blender export and substantial optimization for the 16 MiB limit. Choose the Blender scene, not an Unreal project or an HDRI alone.',
  worldResourcesKits: 'Build your own world — assemble these kits',
  worldResourcesKitHelp:
    'Kenney kits contain reusable pieces, not authored flight courses. Combine a small selection in Blender and export one scene. Smuggler’s Cove is also a source collection; its Unreal project is not directly importable.',
  worldResourcesLicense:
    'Listed sources advertise CC0; check and keep the license supplied with your chosen download. Asset license and import compatibility are separate checks.',
  worldImport: 'Import a world',
  importHelp:
    'Choose a GLB, or a glTF and all its local textures/buffers. Blender and Crocotile\n              export these formats.',
  chooseFiles: 'Choose scene files',
  author: 'Asset author',
  source: 'Source URL / original work',
  license: 'License',
  previewWorld: 'Preview world',
  exportProject: 'Export editable project',
  exportPack: 'Export world pack',
  installPack: 'Install pack',
  sourceOwnership:
    'Keep source IDs when re-exporting. Existing objective overrides are preserved and\n              conflicts are reported.',
  takeItWithYou: 'TAKE IT WITH YOU',
  packsHelp: 'Install portable worlds and back up your recorded flights.',
  importPack: 'Import .rlpack / editable project',
  backupProofs: 'Back up flight records',
  restoreProofs: 'Import recordings / examples',
  prepareRuntime: 'Prepare simulator offline',
  removeRuntime: 'Remove offline simulator files',
  runtimeOfflineHelp:
    'Removal keeps your installed worlds and flight records. Download again before playing offline.',
  keepOffline: 'Request persistent storage',
  close: 'Close',
  keyboard: 'Keyboard',
  touch: 'Touch',
  radio: 'USB radio',
  controller: 'Controller / Steam Deck',
  flightMenu: 'Menu',
  returnToFlight: 'Back to flight',
  setup: 'Setup',
  chase: 'Chase',
  overview: 'Overview',
  racer: 'Racer',
  pixel: 'Pixel',
  utility: 'Utility',
  balanced: 'Balanced',
  performance: 'Performance',
  quality: 'Quality',
  compactSticks: 'Compact sticks',
  expandedSticks: 'Expanded sticks',
  setupSticks: 'Sticks in setup only',
  arm: 'Arm / resume',
  pause: 'Pause',
  retry: 'Retry',
  fire: 'Fire',
  next: 'Next in playlist',
  exportProof: 'Export recording',
  tilt: 'Camera tilt',
  verticalFov: 'Vertical field of view (°)',
  keys: keyboardFlightHelp('two-stick', 'en', { combat: true }),
};
const COPY_UK = {
  backToGame: 'Повернутися до FPV / LINE',
  learn: 'Навчитися літати',
  beginLearning: 'Почати льотну школу',
  schoolEyebrow: 'ШКОЛА ACRO · РОЗВИВАЙТЕ МАЙСТЕРНІСТЬ',
  schoolTitle: 'Тут починається ваш політ.',
  schoolIntro: `Розвивайте навички у ${PRIMARY_LESSON_ORDER.length} уроках Acro: від початкових до рівнів Pro та Master. Перегляньте весь маршрут, перехопіть керування й виконайте справжні цілі. Також відкрито ${SELF_LEVEL_LESSON_ORDER.length} додаткових уроків самовирівнювання.`,
  schoolFilterLabel: 'Виберіть рівень навчання',
  schoolReassurance:
    'Оберіть самовирівнювання або Acro. Вибраний режим зберігається; після виходу відновлюються ваші звичні камера та чутливість. Усі уроки відкриті.',
  schoolLift: '01 · Зліт',
  schoolControl: '02 · Керування',
  schoolExplore: '03 · Відкриття',
  schoolSee: 'Роздивіться керування',
  schoolUnderstand: 'Зрозумійте реакцію',
  schoolTry: 'Спробуйте в польоті',
  schoolAfterTitle: 'Наступна пригода вже чекає.',
  schoolAfterHelp:
    'Використайте нові навички у вправах академії, дослідженні світів і перших перегонах.',

  settings: 'Налаштування',
  startFlying: 'Почати політ',
  chooseWorld: 'Виберіть світ',
  connectRadio: 'Налаштувати пульт',
  simEdition: 'ЛЬОТНИЙ СИМУЛЯТОР',
  allOpen: 'Усе відкрито. Ваш темп.',
  flightDestinations: 'НАПРЯМКИ ПОЛЬОТУ',
  chooseWorldHelp: 'Досліджуйте, змагайтеся й удосконалюйте точність.',
  filterChallenges: 'Пошук і фільтри',
  installedWorlds: 'Установлені світи',
  recordedFlights: 'Записи польотів і відновлення',
  flightOptions: 'Параметри польоту',
  backToLobby: 'До меню',
  flightMode: 'Режим польоту',
  controlSource: 'Керування',
  touchResponse: 'Чутливість дотику',
  keyboardPreset: 'Розкладка клавіатури',
  keyboardTwoStick: 'Два стіки · WASD + стрілки',
  keyboardClassic: 'Класична · W/S — тангаж',
  touchPrecise: 'Точна — малі корекції',
  touchDirect: 'Пряма — лінійна реакція',
  cameraLabel: 'Камера',
  aircraftLabel: 'Квадрокоптер',
  graphicsLabel: 'Графіка',
  sticksLabel: 'Відображення стіків',
  droneGuideLabel: 'Реакція дрона',
  droneGuideOn: 'Компактна',
  droneGuideLearning: 'Навчальна',
  guideScale: 'Текст схеми',
  guideStandard: 'Стандартний',
  guideLarge: 'Збільшений',
  droneGuideOff: 'Вимкнено',
  radioSetup: 'Налаштувати пульт',
  makeItYours: 'НАЛАШТУЙТЕ ПІД СЕБЕ',
  audioMixHelp:
    'Змінюйте гучність незалежно від загального вимкнення звуку. Інтерфейс і сигнали включають ворота, удари та бойові ефекти. Рівні гучності спільні для режимів симулятора.',
  settingsHelp: 'Керування й параметри польоту зберігаються для всіх світів і добірок.',
  textStyle: 'Стиль тексту',
  gameType: 'Ігровий шрифт',
  plainType: 'Звичайний шрифт',
  menuMotion: 'Анімація меню',
  systemMotion: 'За налаштуванням пристрою',
  reducedMotion: 'Менше руху',
  settingsPaused: 'Зміна налаштувань залишає політ на паузі. Продовжте, коли будете готові.',
  firstFlight: 'ВАШ ПЕРШИЙ ПОЛІТ',
  firstFlightTitle: 'Ще не літали? Почніть тут.',
  firstFlightHelp: `Почніть із ${ACRO_LESSON_ORDER.length} початкових уроків Acro та наочних схем керування. Далі переходьте до точності, навігації й посадок на висоті, коли будете готові. Усі уроки відкриті.`,
  watchFirst: 'Переглянути перший політ',
  tryFirst: 'Спробувати перший політ',
  demoCoverage:
    '104 записані приклади охоплюють усі 52 завдання Академії, Лісопарку, Українського подвір’я, Складу, Перегонового стадіону та Контейнерного двору в обох режимах. Приклади для Паркінгу ще готуються.',
  watchDemo: 'Переглянути демонстрацію',
  playbackSpeed: 'Швидкість відтворення',
  flyThis: 'Виконати це завдання',
  explore: 'Політ',
  playlists: 'Мої добірки',
  creator: 'Майстерня',
  packs: 'Бібліотека',
  eyebrow: 'СВІТ — ВАШ ЛЬОТНИЙ МАЙДАНЧИК',
  heading: 'Знайдіть свій маршрут.',
  intro: 'Від першого зависання до ідеального кола. Виберіть світ і летіть у своєму темпі.',
  challenges: 'завдань',
  worlds: 'світів',
  allDifficulty: 'Будь-яка складність',
  beginner: 'Початківець',
  intermediate: 'Середній',
  advanced: 'Досвідчений',
  allProgress: 'Увесь прогрес',
  completed: 'Виконано',
  notFlown: 'Не виконано',
  empty: 'Немає завдань за цими фільтрами.',
  yourSequence: 'ВАША ПОСЛІДОВНІСТЬ ПОЛЬОТІВ',
  playlistHelp: 'Поєднуйте світи та вправи. Повторюйте завдання скільки завгодно.',
  collections: 'Колекції та збережені добірки',
  importPlaylist: 'Імпортувати добірку',
  playlistTitle: 'Назва добірки',
  playlistEmpty: 'Натисніть + біля завдання, щоб додати його сюди.',
  flyPlaylist: 'Почати добірку',
  save: 'Зберегти',
  export: 'Експорт',
  clear: 'Очистити',
  buildYourLine: 'СТВОРІТЬ СВІЙ МАРШРУТ',
  creatorTitle: 'Від ідеї до польоту.',
  creatorHelp:
    'Створіть копію завдання, змініть маршрут і випробуйте його. Імпортуйте GLB для власного світу.',
  challengeEditor: 'Редактор завдань',
  template: 'Початкове завдання',
  clone: 'Створити копію',
  undo: 'Скасувати',
  redo: 'Повторити',
  challengeTitle: 'Назва завдання',
  criteria: 'Маршрут та цілі',
  missionBriefing: 'Опис завдання',
  applyPosition: 'Застосувати координати',
  duplicate: 'Дублювати',
  remove: 'Видалити',
  sourceJson: 'JSON завдання',
  applyJson: 'Перевірити та застосувати JSON',
  testFlight: 'Пробний політ',
  exportChallenge: 'Експорт завдання',
  worldGuideTitle: 'Як імпортувати свій перший світ',
  worldGuideIntro:
    'Хочете готовий до польоту світ? Відкрийте бібліотеку. Цей імпорт призначений для сцен, з яких ви створите власну трасу.',
  worldGuideGet:
    'Завантажте й розпакуйте одну сцену. Найпростіше — GLB з усіма ресурсами всередині. Набір окремих моделей спочатку зберіть в одну сцену у Blender.',
  worldGuideConvert:
    'Маєте .blend, FBX або OBJ? Відкрийте чи імпортуйте його у Blender: File → Export → glTF 2.0 → glTF Binary (.glb). Використовуйте PNG/JPEG без стиснення Draco. Експортуйте власні властивості, якщо створювали ігрові маркери.',
  worldGuideCredit:
    'Перед вибором файлів укажіть автора, оригінальне посилання та справжню ліцензію. CC0 не замінює невідому ліцензію. Для CC BY збережіть авторство й опишіть свої зміни під час поширення.',
  worldGuideSelect:
    'У «Вибрати файли сцени» виберіть рівно один .glb або один .gltf разом із .bin та PNG/JPEG. Для вкладених текстур скористайтеся «Вибрати папку сцени», зберігши структуру папок. Вибирайте папку однієї сцени, а не всього набору.',
  worldGuidePlayable:
    'Прочитайте звіт і відкрийте «Перегляд світу». Видима геометрія сама не створює зіткнень: додайте спрощені колайдери, безпечний старт і цілі маршруту. Перевірте межі та «Тестовий політ» в обох режимах. Автоматичний початковий маршрут — ще не готовий рівень.',
  worldGuideSave:
    'Збережіть резервну копію через «Експорт редагованого проєкту», а «Встановити пакунок» збереже його в цьому браузері. Для поширення експортуйте пакунок світу; отримувач імпортує його в бібліотеці. Повторюйте експорт після змін. Перед іншою сценою збережіть чернетку й натисніть «Почати новий світ».',
  worldGuideLimits:
    'Поточна межа сцени: 16 МіБ після пакування, до 128 вхідних файлів. Лише PNG/JPEG. Безкоштовне завантаження не гарантує сумісності: великі сцени потребують зменшення текстур і спрощення геометрії.',
  worldGuideTrouble:
    'Немає ресурсу? Збережіть назви й папки або повторно експортуйте самодостатній GLB. Непідтримуване розширення? Експортуйте без стиснення геометрії, з PNG/JPEG. Немає старту чи колайдерів? Відкрийте посібник автора нижче — це ігрові дані, а не помилка текстур.',
  worldGuideLinks: 'Допомога з експорту та створення світів',
  worldGuideAuthoring: 'Маркери SIM, зіткнення та налаштування експорту',
  worldResourcesTitle: 'Безкоштовні сцени й моделі — 23 кандидати',
  worldResourcesIntro:
    'Це вихідні ресурси для огляду, а не встановлені чи перевірені рівні SIM. Посилання відкривають нову вкладку й потребують інтернету. Сам посібник залишається в симуляторі.',
  worldResourcesScenes: 'Зібрані сцени — конвертація та підготовка',
  worldResourcesSceneHelp:
    'Почніть із невеликого будмайданчика. Сцени Poly Haven детальніші, але потребують експорту з Blender і суттєвої оптимізації до 16 МіБ. Вибирайте сцену Blender, а не проєкт Unreal чи лише HDRI.',
  worldResourcesKits: 'Створіть власний світ — зберіть ці набори',
  worldResourcesKitHelp:
    'Набори Kenney містять окремі деталі, а не готові траси. Зберіть невелику добірку у Blender й експортуйте одну сцену. Smuggler’s Cove — також колекція ресурсів; її проєкт Unreal не імпортується напряму.',
  worldResourcesLicense:
    'Наведені джерела вказують CC0; перевірте й збережіть ліцензію саме свого завантаження. Ліцензія ресурсу та сумісність імпорту — окремі перевірки.',
  worldImport: 'Імпорт світу',
  importHelp:
    'Виберіть GLB або glTF з усіма локальними текстурами й буферами. Blender і Crocotile експортують ці формати.',
  chooseFiles: 'Вибрати файли сцени',
  author: 'Автор матеріалів',
  source: 'Посилання / власна робота',
  license: 'Ліцензія',
  previewWorld: 'Переглянути світ',
  exportProject: 'Експорт редагованого проєкту',
  exportPack: 'Експорт пакунка',
  installPack: 'Встановити пакунок',
  sourceOwnership:
    'Зберігайте ID об’єктів при повторному експорті. Власні зміни зберігаються, конфлікти відображаються.',
  takeItWithYou: 'ВІЗЬМІТЬ ІЗ СОБОЮ',
  packsHelp: 'Встановлюйте світи та створюйте резервні копії польотів.',
  importPack: 'Імпорт .rlpack / проєкту',
  backupProofs: 'Резервна копія польотів',
  restoreProofs: 'Імпорт записів / прикладів',
  keepOffline: 'Запросити постійне сховище',
  prepareRuntime: 'Підготувати автономний запуск',
  removeRuntime: 'Прибрати автономні файли симулятора',
  runtimeOfflineHelp:
    'Встановлені світи й записи польотів залишаться. Перед автономною грою завантажте файли знову.',
  close: 'Закрити',
  keyboard: 'Клавіатура',
  touch: 'Дотик',
  radio: 'USB-пульт',
  controller: 'Контролер / Steam Deck',
  flightMenu: 'Меню',
  returnToFlight: 'До польоту',
  setup: 'Налаштування',
  chase: 'За дроном',
  overview: 'Огляд',
  racer: 'Гоночний',
  pixel: 'Піксельний',
  utility: 'Робочий',
  balanced: 'Збалансовано',
  performance: 'Швидкодія',
  quality: 'Якість',
  compactSticks: 'Компактні стіки',
  expandedSticks: 'Великі стіки',
  setupSticks: 'Стіки лише в налаштуваннях',
  arm: 'Увімкнути / продовжити',
  pause: 'Пауза',
  retry: 'Ще раз',
  fire: 'Вогонь',
  next: 'Наступне завдання',
  exportProof: 'Експорт запису',
  tilt: 'Нахил камери',
  verticalFov: 'Вертикальне поле зору (°)',
  keys: keyboardFlightHelp('two-stick', 'uk', { combat: true }),
  themePreview: 'Авторська тема',
  snap: 'Прив’язка',
  resetView: 'Скинути огляд',
  orbitLeft: 'Огляд ліворуч',
  orbitRight: 'Огляд праворуч',
  orbitUp: 'Огляд угору',
  orbitDown: 'Огляд униз',
  zoomIn: 'Наблизити',
  zoomOut: 'Віддалити',
  editorHint:
    'Виберіть маркер і тягніть стрілки; тягніть порожнє місце для обертання, прокручуйте для масштабу.',
  chooseFolder: 'Вибрати папку сцени',
  inspectDrone: 'Оглянути дрон',
  hangarHelp:
    'Тягніть для обертання, прокручуйте для масштабу. Усі моделі мають однакові льотні властивості.',
  newWorld: 'Почати новий світ',
};
const clone = (value) => structuredClone(value);
const recordingMetadata = (proof) =>
  proof?.format === 'FlightPracticeContinuation.v1' ? proof.boundaryProof : proof;
const keyOf = (entry) => `${entry.packIdentity}:${entry.id}`;
const unique = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const terminal = (state) => ['complete', 'expired', 'failed', 'destroyed'].includes(state.status);
const coordinates = ['x', 'y', 'z'];
export function synchronizeDefinitions(project) {
  const definitions = project.definitions ?? {
    worlds: [],
    layouts: [],
    challenges: [],
    themes: project.themes ?? [],
  };
  const upsert = (rows, item) => {
    const at = rows.findIndex((r) => r.id === item.id);
    if (at < 0) rows.push(item);
    else rows[at] = item;
  };
  for (const course of project.courses) {
    const existing = definitions.challenges.find((c) => c.id === course.id),
      split = splitCourseDefinition(course, { layoutId: existing?.layoutId });
    split.layout.spawn = clone(course.spawn);
    const bindings = project.routeBindings?.[course.id];
    for (const mode of ['self-level', 'acro'])
      for (const [i, anchorId] of (bindings?.[mode] ?? []).entries())
        if (anchorId) {
          const before = split.layout.orders[mode][i],
            objective = split.layout.objectives.find((o) => o.id === before);
          if (!objective) continue;
          const id = `source-${dataIdentity({ anchorId, mode }).replace(/[^a-zA-Z0-9._-]/g, '-')}`;
          objective.id = id;
          split.layout.orders[mode][i] = id;
          split.layout.bindings[id] = anchorId;
        }
    upsert(definitions.worlds, split.world);
    upsert(definitions.layouts, split.layout);
    upsert(definitions.challenges, split.challenge);
  }
  project.definitions = definitions;
  project.courses = compileContentProject(definitions).map((result) => result.course);
  return project;
}

export function criterionCentre(step) {
  return criterionPosition(step);
}
export function moveCriterion(step, position) {
  const before = criterionCentre(step);
  if (!before) throw new Error('This objective has no position; edit its parameters in JSON.');
  if (!coordinates.every((k) => Number.isSafeInteger(position[k])))
    throw new Error('Coordinates must be finite millimetres.');
  return translateCriterion(
    step,
    Object.fromEntries(coordinates.map((k) => [k, position[k] - before[k]])),
  );
}

/** Bake all eight transformed corners, retaining nested rotation and nonuniform scale. */
export function colliderFromAnchor(anchor) {
  const vertices = [],
    m = anchor.matrix,
    s = anchor.size;
  if (!Array.isArray(m) || m.length !== 16 || !Array.isArray(s) || s.length !== 3)
    throw new Error('A collider needs its source matrix and local XYZ size.');
  for (let z = 0; z < 2; z++)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const p = [(x - 0.5) * s[0], (y - 0.5) * s[1], (z - 0.5) * s[2]];
        vertices.push(
          ...[0, 1, 2].map((r) =>
            Math.round((m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]) * 1000),
          ),
        );
      }
  return {
    id: anchor.id,
    type: 'trimesh',
    vertices,
    indices: [
      0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1,
      3, 5, 3, 7, 5,
    ],
  };
}
const holdAt = (p, type = 'hold') => ({
  type,
  min: { x: p.x - 1500, y: Math.max(0, p.y - 750), z: p.z - 1500 },
  max: { x: p.x + 1500, y: p.y + 750, z: p.z + 1500 },
  ticks: 30,
  maxSpeed: type === 'land' ? 1300 : 2500,
  maxTilt: 4000,
  minTilt: 0,
  centred: false,
  heading: null,
});

export function courseFromProject(project) {
  const { world } = compilePlayable(project),
    spawnAnchor = world.anchors.find((a) => a.kind === 'spawn');
  const mm = (p) => Object.fromEntries(coordinates.map((k) => [k, Math.round(p[k] * 1000)]));
  const spawn = spawnAnchor ? mm(spawnAnchor.position) : { x: 0, y: 0, z: 12000 };
  const route = world.anchors
    .filter((a) => ['gate', 'checkpoint', 'landmark', 'landing'].includes(a.kind))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const steps = route.map((a) => {
    const p = mm(a.position);
    if (a.kind === 'gate') {
      const normal = [a.matrix[8], a.matrix[10]],
        axis = Math.abs(normal[0]) > Math.abs(normal[1]) ? 'x' : 'z';
      const side = axis === 'x' ? p.z : p.x,
        half = Math.round((a.width ?? 4) * 500 * Math.hypot(a.matrix[0], a.matrix[1], a.matrix[2])),
        height = Math.round(
          (a.height ?? 3) * 500 * Math.hypot(a.matrix[4], a.matrix[5], a.matrix[6]),
        );
      if (
        Math.min(...normal.map(Math.abs)) > 0.01 ||
        Math.abs(a.matrix[9]) > 0.01 ||
        Math.abs(a.matrix[1]) > 0.01 ||
        Math.abs(a.matrix[4]) + Math.abs(a.matrix[6]) > 0.01
      )
        throw new Error(
          `Gate ${a.id} is rotated off the X/Z axes. Align it, or use a checkpoint marker.`,
        );
      return {
        type: 'gate',
        axis,
        at: p[axis],
        direction: (a.direction === -1 ? -1 : 1) * (Math.sign(normal[axis === 'x' ? 0 : 1]) || 1),
        minSide: side - half,
        maxSide: side + half,
        minY: Math.max(0, p.y - height),
        maxY: p.y + height,
      };
    }
    return holdAt(p, a.kind === 'landing' ? 'land' : 'hold');
  });
  if (!steps.length) steps.push(holdAt({ ...spawn, y: Math.max(3000, spawn.y + 3000) }));
  if (steps.at(-1).type !== 'land') steps.push(holdAt({ ...spawn, y: 0 }, 'land'));
  const title = String(project.title || project.id).slice(0, 120);
  return validateWorldCourse({
    format: 'FlightCourse.v2',
    id: `${project.id.slice(0, 60)}-route`,
    revision: 'r1',
    environment: project.id,
    world: { id: project.id, theme: 'academy', style: 'warehouse' },
    locales: {
      en: {
        title,
        brief: 'Fly the authored markers, then land at the final pad.',
        lesson: 'Imported scene. Only authored collider markers create collisions.',
      },
      uk: {
        title,
        brief: 'Пролетіть через маркери та сядьте на останній майданчик.',
        lesson: 'Імпортована сцена. Зіткнення створюють лише маркери колайдерів.',
      },
    },
    spawn,
    bounds: { min: { x: -90000, y: 0, z: -90000 }, max: { x: 90000, y: 90000, z: 90000 } },
    obstacles: world.colliders.map(colliderFromAnchor),
    steps: { 'self-level': steps, acro: clone(steps) },
    actors: world.anchors
      .filter((a) => a.kind === 'actor')
      .map((a) => ({
        ...(a.settings ?? {}),
        id: a.id,
        type: a.actorType ?? 'drone',
        position: mm(a.position),
      })),
    rules: { seed: 1, maxTicks: 36000 },
    conditions: { profile: 'clear', revision: 'r1' },
  });
}

export function routeThumbnail(document, course, presentation = {}) {
  const profile = resolveSimThemeProfile(course, presentation),
    palette = profile.palette,
    color = (value, shade = 1) =>
      `#${[16, 8, 0]
        .map((shift) =>
          Math.round(((value >> shift) & 255) * shade)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')}`,
    accent = color(palette.accent);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 190');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-flight-mode', presentation.flightMode ?? 'self-level');
  svg.setAttribute('data-sim-profile', profile.id);
  svg.setAttribute('data-sim-revision', profile.revision);
  svg.style.backgroundColor = color(palette.ground, 0.3);
  const add = (tag, attrs) => {
    const n = document.createElementNS(svg.namespaceURI, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    svg.append(n);
    return n;
  };
  const min = course.bounds.min,
    max = course.bounds.max,
    px = (x) => 18 + ((x - min.x) / (max.x - min.x)) * 284,
    pz = (z) => 15 + ((z - min.z) / (max.z - min.z)) * 145;
  add('rect', { width: 320, height: 190, fill: color(palette.ground, 0.3) });
  const grid = { stroke: color(palette.fog), 'stroke-opacity': 0.12 };
  for (let x = 20; x < 320; x += 25) add('path', { d: `M ${x} 0 V 190`, ...grid });
  for (let z = 15; z < 190; z += 25) add('path', { d: `M 0 ${z} H 320`, ...grid });
  // Schemes use accepted collision geometry and objective identities, never
  // presentation scenery or a guessed safe path through an unordered hunt.
  add('rect', {
    x: 18,
    y: 15,
    width: 284,
    height: 145,
    fill: 'none',
    stroke: '#9bbfc7',
    'stroke-width': 1.5,
    'data-preview-bounds': '',
  });
  const hull = (points) => {
    const sorted = points.sort((a, b) => a.x - b.x || a.z - b.z);
    const cross = (a, b, c) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    const half = (values) => {
      const result = [];
      for (const point of values) {
        while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
        result.push(point);
      }
      return result;
    };
    return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
  };
  for (const obstacle of course.obstacles) {
    let paths;
    if (obstacle.type === 'trimesh') {
      paths = [];
      for (let index = 0; index < obstacle.indices.length; index += 3)
        paths.push(
          obstacle.indices.slice(index, index + 3).map((vertex) => ({
            x: obstacle.vertices[vertex * 3],
            z: obstacle.vertices[vertex * 3 + 2],
          })),
        );
    } else {
      const centre = Object.fromEntries(
        ['x', 'y', 'z'].map((axis) => [axis, (obstacle.min[axis] + obstacle.max[axis]) / 2]),
      );
      const [qx, qy, qz, qw] = obstacle.rotation ?? [0, 0, 0, 1];
      const corners = [];
      for (const x of [obstacle.min.x, obstacle.max.x])
        for (const y of [obstacle.min.y, obstacle.max.y])
          for (const z of [obstacle.min.z, obstacle.max.z]) {
            const dx = x - centre.x,
              dy = y - centre.y,
              dz = z - centre.z;
            const tx = 2 * (qy * dz - qz * dy),
              ty = 2 * (qz * dx - qx * dz),
              tz = 2 * (qx * dy - qy * dx);
            corners.push({
              x: centre.x + dx + qw * tx + qy * tz - qz * ty,
              z: centre.z + dz + qw * tz + qx * ty - qy * tx,
            });
          }
      paths = [hull(corners)];
    }
    add('path', {
      d: paths
        .map((points) => {
          const area = points.reduce((sum, point, index) => {
            const next = points[(index + 1) % points.length];
            return sum + point.x * next.z - next.x * point.z;
          }, 0);
          return area < 0 ? [...points].reverse() : points;
        })
        .map(
          (points) =>
            points
              .map((point, index) => `${index ? 'L' : 'M'} ${px(point.x)} ${pz(point.z)}`)
              .join(' ') + ' Z',
        )
        .join(' '),
      fill: color(palette.wall),
      stroke: '#8ca2a8',
      'stroke-width': 1,
      'fill-opacity': 0.8,
      'data-preview-obstacle': obstacle.id,
    });
  }
  const steps = course.steps[presentation.flightMode ?? 'self-level'];
  const actors = new Map((course.actors ?? []).map((actor) => [actor.id, actor]));
  const targetIds = new Set(
    steps.flatMap((step) => step.targets ?? (step.actorId ? [step.actorId] : [])),
  );
  const points = [course.spawn];
  for (const step of steps) {
    const centre = criterionCentre(step);
    if (centre) points.push(centre);
    if (step.ordered)
      for (const id of step.targets ?? []) if (actors.has(id)) points.push(actors.get(id).position);
    if (step.type === 'gate') {
      const a =
        step.axis === 'x' ? { x: step.at, z: step.minSide } : { x: step.minSide, z: step.at };
      const b =
        step.axis === 'x' ? { x: step.at, z: step.maxSide } : { x: step.maxSide, z: step.at };
      add('path', {
        d: `M ${px(a.x)} ${pz(a.z)} L ${px(b.x)} ${pz(b.z)}`,
        stroke: '#a9e5b1',
        'stroke-width': 5,
        'data-preview-gate': '',
      });
    }
  }
  add('path', {
    d: points.map((point, index) => `${index ? 'L' : 'M'} ${px(point.x)} ${pz(point.z)}`).join(' '),
    stroke: accent,
    'stroke-width': 2.5,
    fill: 'none',
    'stroke-dasharray': '5 4',
    'data-preview-route': '',
  });
  for (const actor of actors.values()) {
    const position = actor.position;
    const target = targetIds.has(actor.id);
    if (actor.path?.length)
      add('path', {
        d: [position, ...actor.path]
          .map((point, index) => `${index ? 'L' : 'M'} ${px(point.x)} ${pz(point.z)}`)
          .join(' '),
        fill: 'none',
        stroke: target ? '#f59c83' : '#92a6b2',
        'stroke-width': 2,
        'stroke-dasharray': '3 3',
        'data-preview-patrol': actor.id,
      });
    const x = px(position.x),
      z = pz(position.z);
    add('path', {
      d: `M ${x} ${z - 5} L ${x + 5} ${z} L ${x} ${z + 5} L ${x - 5} ${z} Z`,
      fill: target ? '#f77958' : '#8ca6b5',
      stroke: '#fff4d8',
      'stroke-width': 1.5,
      'data-preview-actor': actor.id,
      ...(target ? { 'data-preview-target': '' } : {}),
    });
    const order = steps
      .find((step) => step.ordered && step.targets?.includes(actor.id))
      ?.targets.indexOf(actor.id);
    if (order !== undefined)
      add('text', {
        x: x + 7,
        y: z - 5,
        fill: '#fff4d8',
        'font-size': 11,
        'font-weight': 'bold',
      }).textContent = String(order + 1);
  }
  points.forEach((point, index) =>
    add('circle', {
      cx: px(point.x),
      cy: pz(point.z),
      r: index ? 3.5 : 5.5,
      fill: index ? accent : '#9ce5fa',
      stroke: '#071820',
      'stroke-width': 2,
      ...(!index ? { 'data-preview-spawn': '' } : {}),
    }),
  );
  const copy = getLocale() === 'uk';
  const count = targetIds.size;
  const ordered = steps.some((step) => step.ordered);
  const label = count
    ? `${count} ${copy ? 'цілі' : 'targets'} · ${ordered ? (copy ? 'за порядком' : 'in order') : copy ? 'вибір маршруту' : 'choose your route'}`
    : `${steps.length} ${copy ? 'цілі польоту' : 'flight objectives'}`;
  add('text', {
    x: 18,
    y: 181,
    fill: '#e7f2ef',
    'font-size': 11,
    'font-weight': 'bold',
    'data-preview-legend': '',
  }).textContent = label;

  return svg;
}

// Keep one complete recovery separately from command archives. Large cosmetic
// records exceed localStorage's quota long before the recording archive is full.
export function createCombatAutosaveStore({
  indexedDB,
  storage,
  validate = inspectEncounterRecovery,
  now = Date.now,
} = {}) {
  const key = 'revealline.fpv.combat-recovery.v1';
  const format = 'FPVCombatAutosave.v1',
    pointer = 'FPVCombatAutosavePointer.v1';
  let opening,
    database,
    latestRequest = 0,
    timestamp = 0,
    writes = Promise.resolve(),
    closed = false;
  function open() {
    if (closed) return Promise.reject(new Error('Combat recovery storage is closed'));
    if (!opening) {
      const attempt = new Promise((resolve, reject) => {
        if (!indexedDB) return reject(new Error('Combat recovery browser storage is unavailable'));
        const request = indexedDB.open('revealline.fpv.combat-autosave.v1', 1);
        let abandoned = false;
        const fail = (error) => {
          abandoned = true;
          reject(error);
        };
        request.onupgradeneeded = () => request.result.createObjectStore('recovery');
        request.onblocked = () => fail(new Error('Combat recovery browser storage is blocked'));
        request.onerror = () => fail(request.error);
        request.onsuccess = () => {
          const connection = request.result;
          if (closed || abandoned) {
            connection.close();
            fail(new Error('Combat recovery storage is closed'));
            return;
          }
          database = connection;
          connection.onversionchange = () => {
            connection.close();
            if (database === connection) {
              database = null;
              opening = null;
            }
          };
          resolve(connection);
        };
      });
      opening = attempt;
      attempt.catch(() => {
        if (opening === attempt) opening = null;
      });
    }
    return opening;
  }
  async function transaction(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('recovery', mode);
      let value, failure;
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () =>
        reject(failure ?? tx.error ?? new Error('Combat recovery storage failed'));
      try {
        const request = action(tx.objectStore('recovery'));
        request.onsuccess = () => {
          value = request.result;
        };
      } catch (error) {
        failure = error;
        tx.abort();
      }
    });
  }
  function candidate(value) {
    if (!value || value.format === pointer) return null;
    if (value.format === format) {
      if (
        !Number.isSafeInteger(value.savedAt) ||
        value.savedAt < 0 ||
        value.savedAt > now() + 86_400_000
      )
        throw new Error('Invalid combat autosave timestamp');
      return value;
    }
    return { format, savedAt: 0, recovery: value };
  }
  async function candidates() {
    const values = [],
      errors = [];
    try {
      if (!storage) throw new Error('Local recovery storage is unavailable');
      const raw = storage.getItem(key);
      if (raw) values.push(candidate(JSON.parse(raw)));
    } catch (error) {
      errors.push(error);
    }
    try {
      values.push(candidate(await transaction('readonly', (store) => store.get('latest'))));
    } catch (error) {
      errors.push(error);
    }
    const valid = [];
    for (const value of values) {
      if (!value) continue;
      try {
        validate(value.recovery);
        timestamp = Math.max(timestamp, value.savedAt);
        valid.push(value);
      } catch (error) {
        errors.push(error);
      }
    }
    return { values: valid, errors };
  }
  return {
    reserve: () => ++latestRequest,
    save(recovery, request = ++latestRequest) {
      const operation = writes
        .catch(() => {})
        .then(async () => {
          if (closed) throw new Error('Combat recovery storage is closed');
          if (request !== latestRequest) return { skipped: true };
          validate(recovery);
          await candidates();
          if (request !== latestRequest) return { skipped: true };
          timestamp = Math.max(timestamp + 1, now());
          if (!Number.isSafeInteger(timestamp) || timestamp < 0)
            throw new Error('Combat recovery save time is invalid');
          const record = { format, savedAt: timestamp, recovery };
          const raw = JSON.stringify(record);
          if (new TextEncoder().encode(raw).byteLength > 48 * 1024 * 1024)
            throw new Error('Combat recovery exceeds its storage budget; export a recovery file');
          try {
            if (!storage) throw new Error('Local recovery storage is unavailable');
            storage.setItem(key, raw);
            return { backend: 'localStorage', savedAt: timestamp };
          } catch {
            // Completion, rather than request success, confirms the full record
            // committed. A failed transaction leaves the previous recovery intact.
            await transaction('readwrite', (store) => store.put(record, 'latest'));
            try {
              storage?.setItem(key, JSON.stringify({ format: pointer, savedAt: timestamp }));
            } catch {
              /* Continue also discovers IndexedDB without a local pointer. */
            }
            return { backend: 'indexedDB', savedAt: timestamp };
          }
        });
      writes = operation;
      return operation;
    },
    async read() {
      await writes.catch(() => {});
      const { values, errors } = await candidates();
      if (values.length) return values.sort((a, b) => b.savedAt - a.savedAt)[0].recovery;
      if (errors.length) throw errors.at(-1);
      return null;
    },
    async close() {
      await writes.catch(() => {});
      closed = true;
      await opening?.catch(() => {});
      database?.close();
    },
  };
}

export function mountWorldApp({
  window: win = globalThis.window,
  document: doc = globalThis.document,
  rendererFactory = createFlightRenderer,
  globalToolsFactory = mountSimGlobalTools,
} = {}) {
  const $ = (id) => doc.getElementById(id),
    listeners = [],
    translatedNodes = [];
  const gameReturn = fpvWorldReturnURL(win.location.href);
  for (const id of ['sim-game-return', 'flight-game-return']) {
    const link = $(id);
    if (!link) continue;
    link.hidden = !gameReturn;
    if (gameReturn) link.href = gameReturn;
  }
  doc.querySelectorAll('[data-i18n]').forEach((n) => {
    translatedNodes.push({ node: n, key: n.dataset.i18n, fallback: n.textContent });
    // The host's translator owns its own data-i18n namespace. Studio strings
    // use a local dictionary so importing the existing notebook cannot replace
    // them with unresolved translation keys.
    n.removeAttribute('data-i18n');
  });
  let locale = getLocale() === 'uk' ? 'uk' : 'en',
    theme = 'all',
    catalogue = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE],
    installed = [],
    revisions = [],
    records = [],
    worldStore = null,
    recordStore = null,
    proofImport = null,
    packRemovalReview = null,
    restorePackIdentity = null,
    disposed = false,
    closing = null,
    playShell = null,
    cameraControls = null,
    flightSetup = null,
    flightComfort = null,
    practiceFlow = null,
    modeSettingsView = null,
    globalSettingsView = null,
    globalTools = null,
    missionChooser = null,
    missionLibrary = null,
    missionLaunchGeneration = 0,
    randomContext = 'flight',
    randomLevelChoice = 'auto',
    randomLevelControl = null,
    runtimeOfflineFeedback = null,
    regionalRecoveryControls = null,
    regionalStartControls = null,
    regionalAdvancedControls = null,
    regionalNativeLifecycle = null,
    removeRegionalNativeInactive = null,
    regionalLocationControls = null,
    regionalLocationsStore = null,
    regionalNavigation = null;
  let entries = [],
    playlistId = unique('playlist'),
    playlistDraft = null,
    playingPlaylist = null,
    playlistIndex = 0;
  let editor = null,
    editorScope = 'both',
    editorIndex = 0,
    editorSelection = null,
    undo = [],
    redo = [],
    editingProject = null,
    projectAssets = new Map(),
    projectGeneration = null,
    spatialEditor = null,
    actorEditor = null,
    routeGuideEditor = null,
    editorEnvironmentRequest = 0,
    editorEnvironmentPreparation = null;
  let editorFields = '',
    courseScopeProject = null;
  const courseScopes = new Map();
  let renderer = null,
    flight = null,
    recorder = null,
    admittedRouteGuides = null,
    routeGuideProblem = '',
    current = null,
    preview = false,
    checkpointRequest = null,
    checkpointSession = null,
    checkpointPreparation = null,
    industrialPreparation = null,
    flightToken = 0,
    finished = false,
    sceneReady = false,
    scenePreparationGeneration = 0,
    qualityPreparing = false,
    fire = false,
    fireReleaseRequired = false,
    keyboardFireKey = null,
    pausing = false,
    pauseRevision = 0,
    lastTime = null,
    lastExecutionTime = null,
    accumulator = 0,
    raf = 0,
    radioSetup = null,
    tuning = null,
    tuningCalibrationReturn = null,
    aircraftControls = null,
    aircraftChallengeControls = null,
    aircraftAttemptConfiguration = null,
    workbenchAttemptConfiguration = null,
    activeTuningDraft = null,
    aircraftAdvice = null,
    aircraftAdviceText = null,
    courseClassFilter = null,
    tuningReturnEntry = null,
    advancedPractice = null,
    response = { ...DEFAULT_RESPONSE },
    recovery = null,
    replayProof = null,
    replayStartTick = 0,
    practiceContinuation = false,
    continuationRecordingNotice = null,
    combatPlayback = null,
    combatReplaySource = null,
    combatReplayPreparation = null,
    replayKind = 'recording',
    replayRate = 1,
    sectorReference = null,
    sectorReferenceProof = null,
    ghostEnabled = false,
    ghostLookup = null,
    ghostError = false,
    sectorReferenceId = null,
    sectorReferenceStatus = 'none',
    sectorLookup = null,
    lastRadioDiscovery = -Infinity;
  const continuousPlay = createSimContinuousPlayController({
    isCurrent: (identity) =>
      identity === flight && !disposed && finished && !replayProof && !combatReplaySource,
    isActive: () =>
      !doc.hidden &&
      (doc.hasFocus?.() ?? true) &&
      $('flight-dialog').open &&
      !doc.querySelector('dialog[open]:not(#flight-dialog)'),
    onNext: () => (current?.beginner ? nextLearningFlight() : $('world-next').click()),
    onRetry: () => {
      void retryFlight().catch(reportError);
    },
  });
  let flowControls = null,
    flowCelebration = null;
  const learningById = new Map(BEGINNER_LESSONS.map((lesson) => [lesson.id, lesson]));
  const learningEntries = new Map(BEGINNER_CATALOGUE.map((entry) => [entry.id, entry]));
  const learningMissionKeys = new Set(BEGINNER_CATALOGUE.map(keyOf));
  const randomLevelsKey = 'revealline.sim.worlds.random-levels.v1';
  const primaryLearning = PRIMARY_LESSON_ORDER.map((id) => learningEntries.get(id));
  const learningSequence = (entry) =>
    learningById.get(entry?.id)?.mode === 'acro' ? PRIMARY_LESSON_ORDER : SELF_LEVEL_LESSON_ORDER;
  const nextLearningEntry = (entry) => {
    const sequence = learningSequence(entry),
      index = sequence.indexOf(entry?.id);
    return index < 0 ? null : learningEntries.get(sequence[index + 1]);
  };
  const sessionLearningComplete = new Map();
  let selectedWorld = null,
    lastCatalogueFlightKey = null,
    learningPreferences = null,
    learningResponse = null,
    lessonReturn = null,
    learningDemoReturn = null,
    modePractice = false;
  const sectors = createSectorTracker();
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    /* Browser can deny local preference access. */
  }
  try {
    if (storage?.getItem(randomLevelsKey) === 'mixed') randomLevelChoice = 'mixed';
  } catch {
    /* Random still follows the current activity without storage. */
  }
  const enemyStatistics = createSimEnemyStatsHost({ gameType: 'worlds', storage });
  void enemyStatistics.stats.read();
  const enemyStatsViews = [
    mountSimEnemyStats({
      document: doc,
      container: $('flight-instruments').parentElement,
      stats: enemyStatistics.stats,
      gameType: 'worlds',
      getAttempt: enemyStatistics.getAttempt,
      variant: 'hud',
      locale: () => locale,
      spritePortraits: false,
    }),
  ];
  enemyStatsViews.push(
    mountSimEnemyStats({
      document: doc,
      container: $('playlists'),
      stats: enemyStatistics.stats,
      gameType: 'worlds',
      getAttempt: enemyStatistics.getAttempt,
      variant: 'collection',
      locale: () => locale,
      spritePortraits: false,
    }),
  );
  const resultEnemyStatsView = mountSimEnemyStats({
    document: doc,
    container: $('result-panel'),
    stats: enemyStatistics.stats,
    gameType: 'worlds',
    getAttempt: enemyStatistics.getAttempt,
    variant: 'panel',
    locale: () => locale,
    spritePortraits: false,
  });
  enemyStatsViews.push(resultEnemyStatsView);
  const statsRecoveryKey = 'revealline.world-enemy-stats-recovery.v1';
  let enemyStatsRunId = null;
  const playlistStore = createPlaylistStore(storage);
  const profileStore = createFlightProfileStore({ storage });
  response = profileStore.snapshot().response;
  const preferenceIds = [
    'world-language',
    'flight-mode',
    'flight-source',
    'flight-touch-response',
    'flight-camera',
    'drone-look',
    'flight-quality',
    'flight-stick-display',
    'flight-drone-guide',
    'flight-guide-scale',
    'world-fov',
    'world-tilt',
    'sim-text-face',
    'sim-motion',
  ];
  try {
    const saved = JSON.parse(storage?.getItem('revealline.fpv.world-settings.v1') ?? '{}');
    if (!saved['flight-source'] && profileStore.snapshot().radio?.verified)
      $('flight-source').value = 'radio';
    else if (!saved['flight-source'] && win.matchMedia?.('(pointer: coarse)').matches)
      $('flight-source').value = 'touch';
    if (saved['flight-drone-guide'] === 'on') saved['flight-drone-guide'] = 'compact';
    for (const id of preferenceIds)
      if (typeof saved[id] === 'string') {
        const node = $(id),
          valid =
            node.tagName === 'SELECT'
              ? [...node.options].some((o) => o.value === saved[id])
              : Number(saved[id]) >= Number(node.min) && Number(saved[id]) <= Number(node.max);
        if (valid) node.value = saved[id];
      }
    const touchResponse = storage?.getItem('revealline.fpv.touch-response.v1');
    if (['precise', 'direct'].includes(touchResponse))
      $('flight-touch-response').value = touchResponse;
    $('flight-keyboard-preset').value = keyboardFlightPreset(
      storage?.getItem(KEYBOARD_PRESET_KEY),
    ).id;
    $('world-language').value = locale;
  } catch {
    /* Invalid preferences use the visible defaults. */
  }
  try {
    const requestedLocale = new URL(win.location.href).searchParams.get('lang');
    if (['en', 'uk'].includes(requestedLocale)) {
      $('world-language').value = requestedLocale;
      locale = requestedLocale;
    }
  } catch {
    /* Embedded previews without a normal URL retain their saved locale. */
  }
  setLocale(locale, { persist: false });
  restoreFlightComfortCamera({
    window: win,
    host: 'worlds',
    fov: $('world-fov'),
    tilt: $('world-tilt'),
  });
  const tuningStore = createTuningLibraryStore({
    storage,
    locks: win.navigator?.locks,
    response,
    camera: { tilt: Number($('world-tilt').value), verticalFov: Number($('world-fov').value) },
  });
  const savePreferences = () => {
    try {
      const preferences = Object.fromEntries(
        preferenceIds
          .filter((id) => !['world-language', 'sim-text-face', 'sim-motion'].includes(id))
          .map((id) => [id, learningPreferences?.[id] ?? $(id).value]),
      );
      if (activeTuningDraft) {
        let saved;
        try {
          saved = JSON.parse(storage?.getItem('revealline.fpv.world-settings.v1') ?? '{}');
        } catch {
          /* Invalid saved camera preferences stay absent. */
        }
        for (const id of ['world-fov', 'world-tilt']) {
          if (typeof saved?.[id] === 'string') preferences[id] = saved[id];
          else delete preferences[id];
        }
      }
      storage?.setItem('revealline.fpv.world-settings.v1', JSON.stringify(preferences));
    } catch (error) {
      reportError(error);
    }
  };
  const txt = (en, uk) => (locale === 'uk' ? uk : en);
  const navigationContext = () => txt('FPV SIM · Worlds', 'FPV SIM · Світи');
  const localized = (value) =>
    typeof value === 'string' ? value : (value?.[locale] ?? value?.en ?? '');
  // Creator labels may use the current theme name; exact authored/recorded
  // profile documents keep their historical title and proof identity.
  const creatorThemeLabel = (profile) => {
    const workshop = THEME_PROFILES.find((entry) => entry.id === 'industrial-workshop');
    return profile?.id === workshop.id && dataIdentity(profile) === dataIdentity(workshop)
      ? txt('Flight Deck', 'Польотна палуба')
      : localized(profile?.title);
  };
  const label = (entry) => entry.course.locales[locale].title;
  let demonstrationCache = new WeakMap();
  function demonstrationEntry(entry) {
    const course =
      entry.appearanceCourse === entry.course ? (entry.sourceCourse ?? entry.course) : entry.course;
    return {
      ...entry,
      course,
      sourceCourse: course,
      appearanceCourse: course,
      presentation: undefined,
    };
  }
  function demonstrationFor(entry, mode) {
    if (!entry || entry.regional) return null;
    entry = demonstrationEntry(entry);
    const cache = demonstrationCache.get(entry.course) ?? new Map(),
      cacheKey = `${entry.projectId ?? ''}:${entry.packIdentity}:${mode}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    if (!entry.legacy) {
      const source = validateWorldCourse(entry.course),
        sourceIdentity = dataIdentity(source);
      const matchesRuntime = (proof) => {
        try {
          return (
            proof?.format ===
              (source.format === 'FlightCourse.v3' ? 'FlightAttempt.v3' : 'FlightAttempt.v2') &&
            proof.session === 'demonstration' &&
            proof.responseIdentity === responseIdentity(proof.response) &&
            Object.entries(
              worldFlightIdentity({ course: source, mode, response: proof.response }),
            ).every(([key, value]) => proof[key] === value)
          );
        } catch {
          return false;
        }
      };
      let candidate =
        !entry.projectId &&
        WORLD_DEMONSTRATIONS.find(
          (item) =>
            item.proof.course === entry.id &&
            item.proof.mode === mode &&
            item.sourceIdentity === sourceIdentity,
        );
      if (!candidate && (!entry.projectId || /^fpv-pack:[a-f0-9]{64}$/.test(entry.packIdentity))) {
        const saved = records.find((r) => {
          if (
            r.status !== 'verified' ||
            r.diagnostic !== 'complete' ||
            r.packIdentity !== entry.packIdentity ||
            r.proof.course !== entry.id ||
            r.proof.mode !== mode ||
            r.proof.session !== 'demonstration'
          )
            return false;
          try {
            return (
              dataIdentity(validateWorldCourse(r.course)) === sourceIdentity &&
              matchesRuntime(r.proof)
            );
          } catch {
            return false;
          }
        });
        if (saved) candidate = { sourceIdentity, proof: saved.proof };
      }
      const proof = candidate?.proof;
      // Catalogue availability must not initialize a physics world. The full
      // normalized source fingerprint binds this data to the exact revision;
      // the shared resolver checks the exact runtime contract without physics;
      // replayWorldFlight verifies the final state before play.
      const match =
        matchesRuntime(proof) && candidate.sourceIdentity === sourceIdentity ? proof : null;
      cache.set(cacheKey, match);
      demonstrationCache.set(entry.course, cache);
      return match;
    }
    const proof = FLIGHT_DEMONSTRATIONS.find(
      (candidate) => candidate.course === entry.id && candidate.mode === mode,
    );
    if (!proof || proof.format !== 'FlightAttempt.v1' || proof.session !== 'demonstration')
      return null;
    const { identity } = createFlight({ course: entry.course, mode, response: proof.response });
    const match = Object.entries(identity).every(([key, value]) => proof[key] === value)
      ? proof
      : null;
    cache.set(cacheKey, match);
    demonstrationCache.set(entry.course, cache);
    return match;
  }
  function watchDemonstration(entry, mode = $('flight-mode').value) {
    entry = demonstrationEntry(entry);
    const proof = demonstrationFor(entry, mode);
    if (!proof)
      throw new Error(
        txt(
          'No demonstration matches this challenge revision.',
          'Немає демонстрації для цієї версії завдання.',
        ),
      );
    return startFlight(entry, {
      preview: true,
      replayProof: proof,
      demonstration: true,
      lessonCamera: current?.id === entry.id ? $('flight-camera').value : undefined,
    });
  }
  const stepName = (step) => {
    const names = {
      hold: ['Hold position', 'Утримуйте позицію'],
      gate: ['Cross gate', 'Пройдіть ворота'],
      land: ['Land', 'Сідайте'],
      eliminate: ['Disable targets', 'Вимкніть мішені'],
      survive: ['Stay airborne', 'Тримайтеся в повітрі'],
      'hunt-contact-v1': ['Catch the marked humanoids', 'Спіймайте позначених гуманоїдів'],
      'actor-track-v1':
        step?.minTargetTravel > 0
          ? ['Follow the marked subject', 'Супроводжуйте позначений об’єкт']
          : ['Observe the marked subject', 'Спостерігайте за позначеним об’єктом'],
      'rotation-v1': ['Complete the rotation', 'Виконайте повний поворот'],
      'attitude-v1': ['Hold the required attitude', 'Утримуйте потрібне положення'],
      'path-v1': ['Follow the manoeuvre path', 'Виконайте траєкторію маневру'],
      'crossing-v1': [
        'Cross with the nose aligned',
        'Перетніть площину з правильним напрямком носа',
      ],
    };
    return txt(...(names[step?.type] ?? [step?.type ?? '', step?.type ?? '']));
  };
  const el = (tag, text, className) => {
    const n = doc.createElement(tag);
    if (text !== undefined) n.textContent = String(text);
    if (className) n.className = className;
    return n;
  };
  const status = (message) => {
    $('studio-status').textContent = String(message);
  };
  const reportError = (error) => {
    if (disposed) return;
    const copy = worldImportErrorCopy(error),
      message = copy ? txt(...copy) : (error.message ?? error);
    status(message);
    if ($('flight-dialog').open) $('flight-status').textContent = message;
    if ($('sim-settings').open) {
      const feedback = doc.querySelector('[data-combat-action-status]');
      if (feedback) {
        feedback.textContent = message;
        feedback.hidden = false;
      }
    }
  };
  const on = (node, event, callback, options) => {
    const fn = (...args) => {
      try {
        Promise.resolve(callback(...args)).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    };
    node?.addEventListener(event, fn, options);
    listeners.push(() => node?.removeEventListener(event, fn, options));
  };
  const cancelFlow = () => continuousPlay.cancel('interaction');
  on(doc, 'pointerdown', cancelFlow);
  on(doc, 'keydown', cancelFlow);
  on(win, 'blur', cancelFlow);
  on(win, 'gamepaddisconnected', cancelFlow);
  on(win, 'blur', () => {
    missionLaunchGeneration++;
  });
  on(win, 'gamepaddisconnected', () => {
    missionLaunchGeneration++;
  });
  on(doc, 'visibilitychange', () => {
    if (doc.hidden) missionLaunchGeneration++;
  });
  const button = (text, action, className) => {
    const b = el('button', text, className);
    b.type = 'button';
    // Dynamic card rows are garbage collected after each render. Do not retain
    // their DOM nodes in the static event-disposal list.
    b.addEventListener('click', (...args) => {
      try {
        Promise.resolve(action(...args)).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    });
    return b;
  };
  const enemyGuide = mountWorldEnemyGuide({
    document: doc,
    locale: () => locale,
    onPause: () => pauseFlight(),
  });
  const guideButtons = [];
  function currentEnemyGuide(trigger) {
    if (!current || !flight) return;
    enemyGuide.open(current.course, {
      mode: $('flight-mode').value,
      state: readFlightState(),
      trigger,
    });
  }
  function makeGuideButton(id) {
    const control = button('', (event) => currentEnemyGuide(event.currentTarget));
    control.id = id;
    control.hidden = true;
    control.setAttribute('aria-controls', enemyGuide.dialog.id);
    guideButtons.push(control);
    return control;
  }
  function refreshEnemyGuide() {
    const available = Boolean(
      current &&
        worldEnemyGuide(current.course, {
          mode: $('flight-mode').value,
        }).rows.length,
    );
    for (const control of guideButtons) {
      control.textContent = txt('Enemy field guide', 'Довідник ворогів');
      control.hidden = !available;
    }
    enemyGuide.refresh();
  }
  $('flight-options').before(makeGuideButton('world-flight-enemy-guide'));
  const lessonReturnButton = button('', () => returnFromLesson());
  const lessonReturnError = el('p');
  lessonReturnError.id = 'world-return-status';
  lessonReturnError.setAttribute('role', 'status');
  lessonReturnButton.id = 'world-return-challenge';
  lessonReturnButton.hidden = true;
  listeners.push(() => {
    lessonReturn = null;
    lessonReturnButton.remove();
    lessonReturnError.remove();
  });
  $('school-lessons').before(lessonReturnButton);
  function paintLessonReturn(surface = playShell?.topDialog()?.dataset.modeSurface) {
    lessonReturnButton.hidden = !lessonReturn;
    lessonReturnError.hidden = !lessonReturn;
    if (!lessonReturn) {
      lessonReturnError.textContent = '';
      return;
    }
    lessonReturnButton.textContent = `${txt('Return to', 'Повернутися до')} ${localized(lessonReturn.title)}`;
    if (playShell && surface !== 'missions') {
      if (modeSettingsView?.panels.extras)
        modeSettingsView.panels.extras.append(lessonReturnButton);
      else $('sim-settings-controls').before(lessonReturnButton);
    } else $('school-lessons').before(lessonReturnButton);
    lessonReturnButton.after(lessonReturnError);
  }
  async function lessonOrigin(context) {
    const entry = catalogue.find((item) => keyOf(item) === context.key),
      pack = entry?.projectId
        ? await worldStore?.get(entry.projectId, { sha256: entry.packIdentity.slice(9) })
        : null,
      saved = context.playlist
        ? playlistStore
            .snapshot()
            .playlists.find(
              (item) =>
                item.id === context.playlist.id && item.revision === context.playlist.revision,
            )
        : null;
    if (
      !entry ||
      (entry.projectId && !pack) ||
      dataIdentity(validateWorldCourse(entry.course)) !== context.identity ||
      (context.playlist && (!saved || dataIdentity(saved) !== dataIdentity(context.playlist)))
    )
      throw Error(
        txt(
          'The original challenge or playlist is unavailable. Restore its exact revision to return.',
          'Початкове завдання або добірка недоступні. Відновіть їхню точну версію, щоб повернутися.',
        ),
      );
    return { ...entry, course: context.course };
  }
  async function returnFromLesson() {
    const context = lessonReturn;
    if (!context) return;
    let token = flightToken;
    const owned = () => !disposed && token === flightToken && lessonReturn === context;
    lessonReturnError.textContent = '';
    try {
      await lessonOrigin(context);
      if (!owned()) return;
      token++;
      await closeFlight();
      if (!owned()) return;
      const entry = await lessonOrigin(context);
      if (!owned()) return;
      $('flight-mode').value = context.mode;
      $('flight-source').value = context.source;
      $('flight-camera').value = context.camera;
      response = { ...context.response };
      input.select(context.source);
      savePreferences();
      token++;
      await startFlight(entry, {
        mode: context.mode,
        playlist: context.playlist,
        index: context.index,
        returning: context,
      });
    } catch (error) {
      if (owned()) {
        lessonReturnError.textContent = error.message;
        throw error;
      }
    }
  }
  const audio = createWorldAudio({
    window: win,
    storage,
    getDestruction: () => huntPresentationControls.preferences.snapshot(),
  });
  const presentation = mountSimPresentation({
    root: doc,
    window: win,
    enabled: audio.enabled(),
    audioHost: audio,
  });
  const displayPreferences = createSimDisplayPreferences({
    window: win,
    getStorage: () => win.localStorage,
    legacyPreferences: {
      textFace: $('sim-text-face').value,
      textSize: 'standard',
      reducedEffects: $('sim-motion').value === 'reduced',
    },
  });
  listeners.push(
    displayPreferences.subscribe((state) => {
      doc.body.dataset.textFace = state.textFace;
      doc.body.dataset.textSize = state.textSize;
      doc.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
      $('sim-text-face').value = state.textFace;
      $('sim-motion').value = state.reducedEffects ? 'reduced' : 'system';
    }),
  );
  listeners.push(
    subscribeSimMenuAnimation((enabled) => {
      doc.documentElement.dataset.menuAnimation = enabled ? 'on' : 'off';
    }, win),
  );
  const appearanceSession = createSimAppearanceSession();
  let appearanceReady = false;
  const appearanceControls = mountSimAppearanceControls({
    displayPreferences,
    document: doc,
    window: win,
    container: $('sim-flight-controls'),
    locale: () => locale,
    drone: () => $('drone-look').value,
    pending: () => appearanceSession.pending(),
    accepted: () => appearanceSession.current(),
    onChange(appearance) {
      if (appearanceReady) {
        renderCatalogue();
        refreshEditorScene();
      }
      if (
        !appearanceSession.select(appearance) ||
        !current ||
        replayProof ||
        combatReplaySource ||
        checkpointRequest
      )
        return;
      void startFlight(current, {
        ...retainedDraftOptions(),
        preview,
        playlist: playingPlaylist,
        index: playlistIndex,
        preserveFocus: true,
        paused: true,
      }).catch(reportError);
    },
  });
  appearanceReady = true;
  const audioControls = mountSimAudioControls({
    root: $('sim-audio-mix'),
    window: win,
    locale: () => locale,
    onChange(levels) {
      audio.setVolumes(levels);
    },
  });
  const huntPresentationControls = mountSnakeHuntPresentationControls({
    document: doc,
    window: win,
    container: $('sim-flight-controls'),
    soundContainer: $('sim-audio-mix'),
    storage,
    locale: () => locale,
  });
  const encounterPreferences = createEncounterPreferences(storage);
  const combatPresentationPreferences = createCombatPresentationPreferences({
    window: win,
    storage,
  });
  let encounterSelection = encounterPreferences.select(),
    encounterUnavailable = '',
    encounterBusy = false,
    combatActionBusy = false;
  const combatSaves = new WeakMap();
  const combatAutosaves = createCombatAutosaveStore({ indexedDB: win.indexedDB, storage });
  const combatArchiveFinals = new WeakMap();
  let combatArchiveStore = null,
    combatArchive = null,
    combatArchiveOwner = null,
    combatArchivePoll = -1,
    combatArchiveRows = [],
    combatArchiveWorking = false,
    combatArchiveError = null,
    combatArchiveListError = '',
    combatArchiveLoading = false,
    combatArchiveListed = false,
    combatArchiveListRequest = 0,
    combatArchiveResume = null;
  const encounterControls = mountEncounterControls({
    document: doc,
    container: $('sim-flight-controls'),
    locale: () => locale,
    onChange: (selection) => {
      if (encounterBusy) return;
      encounterPreferences.update(
        selection,
        Boolean(current && (current.beginner || learningEntries.has(current.id))),
      );
      if (!current) {
        encounterSelection = encounterPreferences.select();
        encounterControls.update({ selection: encounterSelection });
        return;
      }
      // Preparation can repaint the paused HUD before the new flight is adopted.
      // Keep subsequent edits attached to the player's latest visible choices.
      encounterSelection = { ...selection };
      encounterControls.update({ selection: encounterSelection });
      void startFlight(current, {
        ...retainedDraftOptions(),
        encounter: { ...selection, seed: freshEncounterSeed() },
        paused: true,
      }).catch(reportError);
    },
    onRetry: () => retryFlight({ paused: true }),
    onNewRun: () =>
      current &&
      startFlight(current, {
        ...retainedDraftOptions(),
        encounter: { ...encounterSelection, seed: freshEncounterSeed() },
        paused: true,
      }).catch(reportError),
    onNextWave: () => {
      flight?.nextWave?.();
      updateHUD(readFlightState());
    },
    onReturn: () => {
      flight?.returnToEncounter?.();
      if (flight?.encounterDestination)
        regionalNavigation = {
          packIdentity: current.packIdentity,
          kind: 'encounter',
          id: 'active-encounter',
          label: txt('Current encounter', 'Поточний бій'),
          position: flight.encounterDestination(),
        };
      updateHUD(readFlightState());
    },
    onRestart: () => {
      if (!current) return;
      const state = readFlightState();
      const entry =
        current.regional && state
          ? {
              ...current,
              configuration: {
                ...current.configuration,
                savedStart: {
                  position: state.position,
                  heading: ((Math.round(state.attitude.yaw) % 36000) + 36000) % 36000,
                },
              },
            }
          : current;
      void startFlight(entry, {
        ...retainedDraftOptions(),
        encounter: { ...encounterSelection, seed: freshEncounterSeed() },
        paused: true,
      }).catch(reportError);
    },
    onSave: () =>
      runCombatAction(
        txt('Preparing combat session download…', 'Підготовка завантаження бойової сесії…'),
        async () => {
          await saveCombatSession(true);
          setCombatActionStatus(txt('Combat session exported.', 'Бойову сесію експортовано.'));
        },
      ),
    onLoad: () => {
      if (combatActionBusy) return;
      setCombatActionStatus(txt('Choose a combat session file.', 'Виберіть файл бойової сесії.'));
      combatRecoveryInput.click();
    },
  });
  encounterControls.update({ selection: encounterSelection });
  const combatActionStatus = el('p');
  combatActionStatus.dataset.combatActionStatus = '';
  combatActionStatus.setAttribute('role', 'status');
  combatActionStatus.setAttribute('aria-live', 'polite');
  encounterControls.root.append(combatActionStatus);
  function setCombatActionStatus(message) {
    const node = doc.querySelector('[data-combat-action-status]');
    if (node) node.textContent = String(message ?? '');
  }
  function invalidCombatFile(error) {
    return new Error(
      txt(
        'This is not a valid combat session or recording. Choose a file exported by the SIM.',
        'Це не дійсна бойова сесія або запис. Виберіть файл, експортований із симулятора.',
      ),
      { cause: error },
    );
  }
  async function readCombatFile(file) {
    try {
      return JSON.parse(await file.text());
    } catch (error) {
      throw invalidCombatFile(error);
    }
  }
  function combatActionStillCurrent(selectedFlight, token) {
    if (disposed) return false;
    if (selectedFlight === flight && token === flightToken) return true;
    setCombatActionStatus(
      txt(
        'Action cancelled because the active flight changed. Try again.',
        'Дію скасовано, оскільки активний політ змінився. Спробуйте ще раз.',
      ),
    );
    return false;
  }
  async function runCombatAction(message, action) {
    if (disposed || combatActionBusy) return;
    combatActionBusy = true;
    setCombatActionStatus(message);
    paintCombatActionControls();
    try {
      return await action();
    } catch (error) {
      setCombatActionStatus(error.message ?? error);
      reportError(error);
    } finally {
      combatActionBusy = false;
      if (!disposed) paintCombatActionControls();
    }
  }
  setCombatActionStatus(
    txt(
      'Start a combat attempt to watch it here. Saved sessions and files can open their exact installed map.',
      'Почніть бойову спробу, щоб переглянути її тут. Збережені сесії та файли можуть відкрити свою точну встановлену мапу.',
    ),
  );
  const combatRecoveryInput = doc.createElement('input');
  combatRecoveryInput.type = 'file';
  combatRecoveryInput.accept = 'application/json,.json';
  combatRecoveryInput.hidden = true;
  combatRecoveryInput.dataset.combatRecoveryFile = '';
  encounterControls.root.append(combatRecoveryInput);
  combatRecoveryInput.addEventListener('change', async () => {
    const file = combatRecoveryInput.files?.[0];
    combatRecoveryInput.value = '';
    if (!file) return;
    const selectedFlight = flight,
      token = flightToken;
    await runCombatAction(txt('Reading combat session…', 'Читання бойової сесії…'), async () => {
      if (file.size > 48 * 1024 * 1024)
        throw new Error(txt('Combat session is too large.', 'Бойова сесія завелика.'));
      const packet = await readCombatFile(file);
      if (!combatActionStillCurrent(selectedFlight, token)) return;
      await continueCombatRecovery(packet);
    });
  });
  const continueCombatButton = button(
    txt('Continue saved combat', 'Продовжити збережений бій'),
    () =>
      runCombatAction(
        txt('Finding saved combat session…', 'Пошук збереженої бойової сесії…'),
        async () => {
          const selectedFlight = flight,
            token = flightToken;
          await combatSaves.get(selectedFlight);
          if (!combatActionStillCurrent(selectedFlight, token)) return;
          const saved = await combatAutosaves.read();
          if (!combatActionStillCurrent(selectedFlight, token)) return;
          if (!saved)
            throw new Error(
              txt(
                'There is no saved combat session on this device yet.',
                'На цьому пристрої ще немає збереженої бойової сесії.',
              ),
            );
          await continueCombatRecovery(saved);
        },
      ),
  );
  continueCombatButton.dataset.combatContinue = '';
  encounterControls.root.append(continueCombatButton);
  const watchCombatButton = button(txt('Watch current attempt', 'Переглянути поточну спробу'), () =>
    runCombatAction(txt('Preparing combat playback…', 'Підготовка перегляду бою…'), async () => {
      if (combatReplaySource) return watchCombatSession(combatReplaySource);
      if (!flight?.exportCombatRecovery)
        throw new Error(
          txt(
            'Start a combat attempt before watching the current attempt.',
            'Почніть бойову спробу перед переглядом поточної спроби.',
          ),
        );
      const selected = flight,
        token = flightToken;
      pauseFlight();
      const archive = combatArchiveOwner === selected ? combatArchive : null;
      const saved =
        archive?.snapshot().state === 'recording'
          ? await archive.export()
          : archive?.snapshot().state === 'ended'
            ? await combatArchives().exportPackage(archive.snapshot().id)
            : await (combatSaves.get(selected) ?? selected.exportCombatRecovery());
      if (!combatActionStillCurrent(selected, token)) return;
      await watchCombatSession(
        saved.format === ENCOUNTER_ARCHIVE_FORMAT
          ? saved
          : { ...saved, launch: combatLaunchMetadata() },
      );
    }),
  );
  watchCombatButton.dataset.combatWatch = '';
  watchCombatButton.disabled = true;
  const watchCombatFileButton = button(txt('Watch combat file', 'Переглянути файл бою'), () => {
    if (combatActionBusy) return;
    setCombatActionStatus(txt('Choose a combat recording file.', 'Виберіть файл запису бою.'));
    combatReplayInput.click();
  });
  watchCombatFileButton.dataset.combatWatchFile = '';
  const combatReplayInput = doc.createElement('input');
  combatReplayInput.type = 'file';
  combatReplayInput.accept = 'application/json,.json';
  combatReplayInput.hidden = true;
  combatReplayInput.dataset.combatReplayFile = '';
  combatReplayInput.addEventListener('change', async () => {
    const file = combatReplayInput.files?.[0];
    combatReplayInput.value = '';
    if (!file) return;
    const selectedFlight = flight,
      token = flightToken;
    await runCombatAction(txt('Reading combat recording…', 'Читання запису бою…'), async () => {
      if (file.size > 48 * 1024 * 1024)
        throw new Error(txt('Combat file is too large.', 'Файл бою завеликий.'));
      const packet = await readCombatFile(file);
      if (!combatActionStillCurrent(selectedFlight, token)) return;
      await watchCombatSession(packet);
    });
  });
  encounterControls.root.append(watchCombatButton, watchCombatFileButton, combatReplayInput);
  for (const input of [combatRecoveryInput, combatReplayInput])
    on(input, 'cancel', () => setCombatActionStatus(txt('No file selected.', 'Файл не вибрано.')));
  const combatArchivePanel = el('details'),
    combatArchiveHeading = el('summary'),
    combatArchiveStatus = el('p'),
    combatArchiveHelp = el('p'),
    combatArchiveSelect = el('select');
  combatArchivePanel.dataset.combatArchives = '';
  combatArchiveStatus.setAttribute('role', 'status');
  combatArchivePanel.append(combatArchiveHeading, combatArchiveStatus, combatArchiveHelp);
  const exportCombatArchiveButton = button('', () =>
    runCombatAction(txt('Exporting current recording…', 'Експорт поточного запису…'), async () => {
      if (!combatArchive || combatArchiveWorking) return;
      const selected = combatArchive,
        filename = `fpv-combat-archive-${current.id}.json`;
      pauseFlight();
      combatArchiveWorking = true;
      try {
        await exportJSONFile(await selected.export(), filename);
        setCombatActionStatus(txt('Combat recording exported.', 'Запис бою експортовано.'));
      } finally {
        combatArchiveWorking = false;
        paintCombatArchive();
      }
    }),
  );
  const refreshCombatArchiveButton = button('', () =>
    runCombatAction(
      txt('Loading saved recordings…', 'Завантаження збережених записів…'),
      async () => {
        await refreshCombatArchives();
        setCombatActionStatus(
          combatArchiveRows.length
            ? txt('Saved recordings updated.', 'Збережені записи оновлено.')
            : txt(
                'No saved combat recordings on this device yet.',
                'На цьому пристрої ще немає збережених записів бою.',
              ),
        );
      },
    ),
  );
  const watchSavedCombatArchiveButton = button('', () =>
    runCombatAction(
      txt('Preparing selected recording…', 'Підготовка вибраного запису…'),
      async () => {
        const row = combatArchiveRows.find((item) => item.id === combatArchiveSelect.value);
        if (!row || row.state !== 'ended' || combatArchiveWorking) return;
        combatArchiveWorking = true;
        const selectedFlight = flight,
          token = flightToken;
        pauseFlight();
        try {
          const packet = await combatArchives().exportPackage(row.id);
          if (!combatActionStillCurrent(selectedFlight, token)) return;
          await watchCombatSession(packet);
        } finally {
          combatArchiveWorking = false;
          paintCombatArchive();
        }
      },
    ),
  );
  const exportSavedCombatArchiveButton = button('', () =>
    runCombatAction(txt('Exporting selected recording…', 'Експорт вибраного запису…'), async () => {
      const row = combatArchiveRows.find((item) => item.id === combatArchiveSelect.value);
      if (!row || combatArchiveWorking) return;
      combatArchiveWorking = true;
      pauseFlight();
      try {
        const packet =
          row.id === combatArchive?.snapshot().id
            ? await combatArchive.export()
            : await combatArchives().exportPackage(row.id);
        await exportJSONFile(packet, `fpv-combat-archive-${row.id}.json`);
        setCombatActionStatus(txt('Combat recording exported.', 'Запис бою експортовано.'));
      } finally {
        combatArchiveWorking = false;
        paintCombatArchive();
      }
    }),
  );
  const deleteCombatArchiveButton = button('', () =>
    runCombatAction(
      txt('Removing selected recording…', 'Видалення вибраного запису…'),
      async () => {
        const row = combatArchiveRows.find((item) => item.id === combatArchiveSelect.value);
        if (!row || row.id === combatArchive?.snapshot().id || combatArchiveWorking) return;
        combatArchiveWorking = true;
        try {
          await combatArchives().delete(row.id, { expectedRevision: row.revision });
          await refreshCombatArchives();
          setCombatActionStatus(txt('Selected recording removed.', 'Вибраний запис видалено.'));
        } finally {
          combatArchiveWorking = false;
          paintCombatArchive();
        }
      },
    ),
  );
  combatArchivePanel.append(
    exportCombatArchiveButton,
    refreshCombatArchiveButton,
    combatArchiveSelect,
    watchSavedCombatArchiveButton,
    exportSavedCombatArchiveButton,
    deleteCombatArchiveButton,
  );
  encounterControls.root.append(combatArchivePanel);
  combatArchiveSelect.addEventListener('change', () => paintCombatArchive());
  combatArchivePanel.addEventListener('toggle', () => {
    if (combatArchivePanel.open)
      void runCombatAction(
        txt('Loading saved recordings…', 'Завантаження збережених записів…'),
        async () => {
          await refreshCombatArchives();
          setCombatActionStatus(
            combatArchiveRows.length
              ? txt('Choose a saved recording below.', 'Виберіть збережений запис нижче.')
              : txt(
                  'No saved combat recordings on this device yet.',
                  'На цьому пристрої ще немає збережених записів бою.',
                ),
          );
        },
      );
  });
  function combatArchives() {
    return (combatArchiveStore ??= createEncounterArchiveStore({ indexedDB: win.indexedDB }));
  }
  async function refreshCombatArchives() {
    const request = ++combatArchiveListRequest;
    combatArchiveLoading = true;
    combatArchiveListError = '';
    paintCombatArchive();
    try {
      const rows = await combatArchives().list();
      if (disposed || request !== combatArchiveListRequest) return;
      const previous = combatArchiveSelect.value;
      combatArchiveRows = rows;
      combatArchiveListed = true;
      combatArchiveSelect.replaceChildren();
      for (const row of rows) {
        const option = el('option');
        option.value = row.id;
        option.textContent = `${row.name} · ${(row.endTick / 3000).toFixed(1)} min · ${row.state === 'ended' ? txt('saved', 'збережено') : txt('incomplete', 'неповний')}`;
        combatArchiveSelect.append(option);
      }
      combatArchiveSelect.value = rows.some((row) => row.id === previous)
        ? previous
        : (rows.find((row) => row.state === 'ended')?.id ?? rows[0]?.id ?? '');
    } catch (error) {
      if (disposed || request !== combatArchiveListRequest) return;
      combatArchiveListError = String(error.message ?? error);
      throw error;
    } finally {
      if (request === combatArchiveListRequest) {
        combatArchiveLoading = false;
        if (!disposed) paintCombatArchive();
      }
    }
  }
  function paintCombatArchive() {
    const saved = combatArchive?.snapshot(),
      selected = combatArchiveRows.find((row) => row.id === combatArchiveSelect.value);
    combatArchiveHeading.textContent = txt('Combat recordings', 'Записи боїв');
    combatArchiveHelp.textContent = txt(
      'Records save each minute on this device, up to 32 MiB each, 128 MiB total and 16 attempts. Export includes the current minute. Nothing is deleted automatically. Interrupted archives without a saved ending cannot be replayed; use a recovery file to continue.',
      'Записи зберігаються щохвилини на пристрої: до 32 МіБ кожен, 128 МіБ загалом і 16 спроб. Експорт містить поточну хвилину. Автоматичного видалення немає. Перерваний архів без збереженого завершення не можна відтворити; для продовження потрібен файл відновлення.',
    );
    const error = saved?.error ?? combatArchiveError;
    const status = error
      ? `${txt('Archiving stopped; flight continues.', 'Архівування зупинено; політ триває.')} ${error}`
      : saved
        ? `${txt('Saved through', 'Збережено до')} ${(saved.durableTo / 50).toFixed(0)} s · ${saved.state === 'ended' ? txt('finished', 'завершено') : txt('recording', 'запис триває')}`
        : txt(
            'A new combat attempt starts a local recording.',
            'Нова бойова спроба починає локальний запис.',
          );
    const listStatus = combatArchiveLoading
      ? txt('Loading saved recordings…', 'Завантаження збережених записів…')
      : combatArchiveListError
        ? `${txt('Saved recordings could not be loaded.', 'Не вдалося завантажити збережені записи.')} ${combatArchiveListError}`
        : combatArchiveListed && !combatArchiveRows.length
          ? txt(
              'No saved combat recordings on this device yet.',
              'На цьому пристрої ще немає збережених записів бою.',
            )
          : selected && selected.state !== 'ended'
            ? txt(
                'This recording has no saved ending and cannot be watched. Choose a saved recording, or load a recovery file to continue.',
                'Цей запис не має збереженого завершення, тому його не можна переглянути. Виберіть завершений запис або відкрийте файл відновлення для продовження.',
              )
            : '';
    const visibleStatus = [status, listStatus].filter(Boolean).join(' ');
    if (combatArchiveStatus.textContent !== visibleStatus)
      combatArchiveStatus.textContent = visibleStatus;
    exportCombatArchiveButton.textContent = txt(
      'Export current recording',
      'Експортувати поточний запис',
    );
    refreshCombatArchiveButton.textContent = txt(
      'Refresh saved recordings',
      'Оновити збережені записи',
    );
    watchSavedCombatArchiveButton.textContent = txt(
      'Watch selected recording',
      'Переглянути вибраний запис',
    );
    exportSavedCombatArchiveButton.textContent = txt(
      'Export selected recording',
      'Експортувати вибраний запис',
    );
    deleteCombatArchiveButton.textContent = txt(
      'Delete selected local recording',
      'Видалити вибраний локальний запис',
    );
    combatArchiveSelect.setAttribute(
      'aria-label',
      txt('Saved combat recording', 'Збережений запис бою'),
    );
    exportCombatArchiveButton.disabled =
      combatArchiveWorking ||
      combatActionBusy ||
      saved?.state !== 'recording' ||
      combatArchiveFinals.has(combatArchive);
    refreshCombatArchiveButton.disabled =
      combatArchiveWorking || combatActionBusy || combatArchiveLoading;
    watchSavedCombatArchiveButton.disabled =
      combatArchiveWorking ||
      combatActionBusy ||
      combatArchiveLoading ||
      selected?.state !== 'ended';
    exportSavedCombatArchiveButton.disabled =
      combatArchiveWorking || combatActionBusy || combatArchiveLoading || !selected;
    deleteCombatArchiveButton.disabled =
      combatArchiveWorking ||
      combatActionBusy ||
      combatArchiveLoading ||
      !selected ||
      selected.id === saved?.id;
    combatArchiveSelect.disabled = combatArchiveWorking || combatActionBusy || combatArchiveLoading;
  }
  function updateCombatArchive(state) {
    if (
      combatReplaySource ||
      !state.encounter ||
      flight?.identity?.format !== 'FPVEncounterSession.v2'
    )
      return;
    const tick = state.combatRecording?.retainedTo ?? 0;
    if (!tick) return;
    if (combatArchiveOwner !== flight) {
      void combatArchive?.dispose().catch(reportError);
      combatArchiveOwner = flight;
      combatArchivePoll = -1;
      combatArchiveError = null;
      combatArchive = null;
      try {
        combatArchive = createEncounterArchive({
          session: flight,
          store: combatArchives(),
          name: `${label(current)} · ${new Date().toISOString()}`.slice(0, 120),
          launch: combatLaunchMetadata(),
          resumeFrom: combatArchiveResume,
        });
      } catch (error) {
        combatArchiveError = String(error.message ?? error);
        paintCombatArchive();
      } finally {
        combatArchiveResume = null;
      }
    }
    if (!combatArchive) return;
    if (Math.floor(tick / 50) === combatArchivePoll) return;
    combatArchivePoll = Math.floor(tick / 50);
    void combatArchive
      .capture()
      .then(() => {
        if (!disposed) paintCombatArchive();
      })
      .catch(reportError);
  }
  async function retireCombatArchive() {
    const selected = combatArchive;
    combatArchive = combatArchiveOwner = null;
    combatArchivePoll = -1;
    if (!selected) return;
    try {
      await finishCombatArchive(selected);
    } catch (error) {
      if (!disposed)
        combatArchiveStatus.textContent = `${txt('Recording could not be finished.', 'Не вдалося завершити запис.')} ${error.message}`;
    } finally {
      await selected.dispose();
    }
    if (!disposed && combatArchivePanel.open) await refreshCombatArchives().catch(reportError);
  }
  async function finishCombatArchive(selected = combatArchive) {
    if (!selected) return;
    let job = combatArchiveFinals.get(selected);
    if (!job && selected.snapshot().state === 'recording') {
      job = selected.finish();
      combatArchiveFinals.set(selected, job);
      job
        .finally(() => {
          combatArchiveFinals.delete(selected);
          if (!disposed) {
            paintCombatArchive();
            if (combatArchivePanel.open) void refreshCombatArchives().catch(reportError);
          }
        })
        .catch(() => {});
    }
    return job;
  }
  paintCombatArchive();
  function paintCombatActionControls(state = readFlightState()) {
    const blocked = combatActionBusy || encounterBusy || Boolean(combatReplayPreparation);
    const archived =
      combatArchiveOwner === flight &&
      ['recording', 'ended'].includes(combatArchive?.snapshot().state);
    watchCombatButton.disabled =
      blocked ||
      combatArchiveFinals.has(combatArchive) ||
      !sceneReady ||
      !flight?.exportCombatRecovery ||
      Boolean(combatPlayback?.pending) ||
      ((state?.combatRecording?.retainedFrom ?? 0) > 0 && !archived);
    watchCombatButton.title = !flight?.exportCombatRecovery
      ? txt(
          'Start a combat attempt before watching the current attempt.',
          'Почніть бойову спробу перед переглядом поточної спроби.',
        )
      : (state?.combatRecording?.retainedFrom ?? 0) > 0 && !archived
        ? txt(
            'The beginning is no longer retained. Save this session to continue playing.',
            'Початок більше не збережено. Збережіть сесію, щоб продовжити гру.',
          )
        : '';
    continueCombatButton.disabled = blocked;
    watchCombatFileButton.disabled = blocked;
    const encounterBlocked =
      blocked || Boolean(replayProof || combatReplaySource || checkpointSession);
    for (const control of Object.values(encounterControls.buttons))
      control.disabled = encounterBlocked;
    paintCombatArchive();
  }
  paintCombatActionControls();
  function combatBaseIdentity(entry) {
    return entry.regional
      ? dataIdentity({
          terrain: dataIdentity(entry.configuration.manifest),
          scenery: entry.configuration.scenery?.manifest
            ? dataIdentity(entry.configuration.scenery.manifest)
            : null,
        })
      : dataIdentity(entry.sourceCourse ?? entry.course);
  }
  async function resolveCombatEntry(definition, saved, owns = () => !disposed) {
    const matches = (entry) => {
      if (!entry) return false;
      try {
        return combatBaseIdentity(entry) === definition.baseIdentity;
      } catch {
        return false;
      }
    };
    const findNative = () =>
      [current, ...catalogue, ...worldLibrary.missions().map(downloadedEntry)].find(matches);
    let entry = findNative();
    if (entry) return entry;
    // Installed revisions populate the catalogue during startup. Only their
    // verified source identity can satisfy a recording, never a matching title.
    await ready;
    if (!owns()) return null;
    entry = findNative();
    if (entry) return entry;
    const base = saved?.gameplay?.identity?.base;
    if (
      saved?.launch?.regional ||
      base?.format === 'FPVRegionalEncounterBase.v1' ||
      base?.model?.startsWith('regional-')
    ) {
      await regionalLibrary.refreshMissions();
      if (!owns()) return null;
      for (const row of regionalLibrary.missions()) {
        if (!regionalLibrary.isInstalled(row)) continue;
        try {
          const { configuration, record } = await regionalLibrary.loadMission(row);
          if (!owns()) return null;
          const candidate = regionalLibraryEntry(configuration, {
            sha256: record.sha256,
            descriptor: record.descriptor,
          });
          if (matches(candidate)) return candidate;
        } catch (error) {
          if (!owns()) return null;
          // Another installed revision may still be the exact required map.
          if (error?.name === 'AbortError') throw error;
        }
      }
    }
    throw new Error(
      txt(
        'The exact map revision for this combat file is not available. Install its original world or region in Content & Offline, or open the original authoring map, then try again.',
        'Точна версія мапи для цього файлу бою недоступна. Установіть початковий світ або регіон у розділі «Вміст і офлайн» чи відкрийте початкову авторську мапу та спробуйте ще раз.',
      ),
    );
  }
  function inspectCombatFile(value) {
    try {
      if (value?.format === ENCOUNTER_ARCHIVE_FORMAT) {
        const archive = inspectEncounterArchive(value);
        return { saved: archive.recovery, definition: archive.definition, archive };
      }
      return inspectEncounterRecovery(value);
    } catch (error) {
      throw invalidCombatFile(error);
    }
  }
  const combatRecoveryOf = (options) =>
    options.combatReplayRecovery ?? options.combatReplaySource ?? options.combatRecovery;
  async function continueCombatRecovery(value) {
    const selectedFlight = flight,
      token = flightToken;
    const { saved, definition, archive } = inspectCombatFile(value);
    const entry = await resolveCombatEntry(definition, saved, () =>
      combatActionStillCurrent(selectedFlight, token),
    );
    if (!entry || !combatActionStillCurrent(selectedFlight, token)) return;
    const mode = saved.launch?.mode ?? saved.gameplay.identity.base?.mode;
    if ($('sim-settings').open) closeSettings({ force: true });
    await startFlight(combatLaunchEntry(entry, saved.launch, saved.gameplay.identity.base), {
      ...retainedDraftOptions(),
      ...(mode ? { mode } : {}),
      ...(saved.launch ? { combatPlaybackConfiguration: saved.launch.configuration } : {}),
      encounter: definition,
      combatRecovery: saved,
      combatArchiveResume: archive?.packet ?? null,
      paused: true,
    });
    setCombatActionStatus(
      txt(
        'Combat session restored. Arm deliberately to continue.',
        'Бойову сесію відновлено. Натисніть «Увімкнути», щоб продовжити.',
      ),
    );
  }
  async function watchCombatSession(value, { paused = false } = {}) {
    const selectedFlight = flight,
      token = flightToken;
    const { saved, definition, archive } = inspectCombatFile(value);
    if (
      definition.format !== 'FPVEncounterDefinition.v2' ||
      saved.gameplay.format !== 'FPVCombatRecovery.v2'
    )
      throw new Error(
        txt(
          'This older combat file supports Continue saved combat. New combat attempts support verified playback.',
          'Старий файл бою можна продовжити. Нові бойові спроби підтримують перевірений перегляд.',
        ),
      );
    if (!archive && saved.gameplay.recording.retainedFrom !== 0)
      throw new Error(
        txt(
          'The beginning of this recording is no longer retained. Use Continue saved combat; complete playback verification is unavailable.',
          'Початок запису більше не збережено. Скористайтеся продовженням бою; перевірений перегляд повного запису недоступний.',
        ),
      );
    const entry = await resolveCombatEntry(definition, saved, () =>
      combatActionStillCurrent(selectedFlight, token),
    );
    if (!entry || !combatActionStillCurrent(selectedFlight, token)) return;
    if ($('sim-settings').open) closeSettings({ force: true });
    await startFlight(combatLaunchEntry(entry, saved.launch, saved.gameplay.identity.base), {
      ...retainedDraftOptions(),
      mode: saved.launch?.mode ?? saved.gameplay.identity.base?.mode ?? $('flight-mode').value,
      encounter: definition,
      combatReplaySource: archive?.packet ?? saved,
      combatReplayRecovery: saved,
      combatPlaybackConfiguration:
        saved.launch?.configuration ??
        (workbenchAttemptConfiguration ? clone(workbenchAttemptConfiguration) : undefined),
      combatPlaybackPaused: paused,
      paused: true,
    });
    setCombatActionStatus(txt('Combat playback opened.', 'Перегляд бою відкрито.'));
  }
  function configureReplayRates() {
    const select = $('world-replay-rate'),
      combat = Boolean(combatReplaySource);
    $('flight-dialog').classList.toggle('combat-playback', combat);
    if (combat)
      for (const rate of [2, 4])
        if (![...select.options].some((option) => Number(option.value) === rate)) {
          const option = el('option', `${rate}×`);
          option.value = String(rate);
          select.append(option);
        }
    for (const option of select.options)
      if (Number(option.value) > 1) option.hidden = option.disabled = !combat;
    if (!combat && replayRate > 1) replayRate = 1;
    select.value = String(replayRate);
  }
  async function stopCombatPlayback() {
    combatReplayPreparation?.abort();
    combatReplayPreparation = null;
    const selected = combatPlayback;
    combatPlayback = null;
    combatReplaySource = null;
    configureReplayRates();
    if (!selected) return;
    selected.playing = false;
    selected.controller.abort();
    try {
      await selected.pending;
    } catch {
      /* The cancelled owner cannot update the new scene. */
    }
    await selected.job.dispose();
    if (flight === selected.session) flight = null;
  }
  async function prepareCombatPlayback(saved, ownsAttempt, paused = false) {
    const selectedFlight = flight;
    const revision = pauseRevision;
    const controller = new AbortController();
    combatReplayPreparation = controller;
    combatReplaySource = saved;
    input.enable(false);
    radio.freeze('playback');
    gamepad.reset();
    let job;
    try {
      job = await createEncounterPlayback(saved, {
        createSession: async () => selectedFlight,
        signal: controller.signal,
      });
      if (!ownsAttempt() || flight !== selectedFlight || controller.signal.aborted) {
        await job.dispose();
        return false;
      }
    } catch (error) {
      if (!ownsAttempt() || controller.signal.aborted) return false;
      sceneReady = false;
      throw new Error(
        txt(
          `Combat playback needs the exact original physics backend, aircraft, response and starting point. ${error.message}`,
          `Для перегляду потрібні початкова фізика, дрон, реакція керування та місце старту. ${error.message}`,
        ),
      );
    } finally {
      if (combatReplayPreparation === controller) combatReplayPreparation = null;
    }
    paused ||= pauseRevision !== revision;
    combatPlayback = {
      job,
      session: selectedFlight,
      source: saved,
      controller,
      playing: !paused,
      pending: null,
      verification: null,
      error: null,
    };
    preview = true;
    recorder = null;
    $('world-replay-controls').hidden = false;
    $('world-replay-label').textContent = txt(
      'COMBAT PLAYBACK · NO REWARDS',
      'ПЕРЕГЛЯД БОЮ · БЕЗ НАГОРОД',
    );
    $('flight-collection').textContent = $('world-replay-label').textContent;
    configureReplayRates();
    $('flight-mode').disabled =
      $('flight-source').disabled =
      $('radio-setup-button').disabled =
        true;
    $('world-touch').hidden = true;
    lastTime = null;
    accumulator = 0;
    lastExecutionTime = win.performance?.now?.() ?? null;
    if (!paused) {
      selectedFlight.arm();
      void audio.resume().catch(reportError);
    }
    $('flight-status').textContent = paused
      ? txt(
          'Combat playback paused. Resume to watch.',
          'Перегляд бою призупинено. Натисніть «Продовжити».',
        )
      : txt(
          'Playing recorded combat. Verification runs when playback finishes.',
          'Відтворюється запис бою. Перевірка відбудеться після перегляду.',
        );
    updateHUD(selectedFlight.snapshot());
    return true;
  }
  function advanceCombatPlayback(elapsed) {
    const selected = combatPlayback;
    if (
      !selected ||
      !selected.playing ||
      finished ||
      !sceneReady ||
      doc.visibilityState === 'hidden' ||
      (doc.hasFocus && !doc.hasFocus()) ||
      doc.querySelector('dialog[open]:not(#flight-dialog)') ||
      flightMenuOpen() ||
      $('flight-dialog').dataset.optionsOpen === 'true' ||
      $('flight-dialog').dataset.immersiveControls === 'true'
    )
      return;
    accumulator = Math.min(100, accumulator + elapsed * replayRate);
    if (selected.pending || (accumulator < 20 && !selected.job.snapshot().done)) return;
    const owns = () =>
      !disposed &&
      combatPlayback === selected &&
      flight === selected.session &&
      !selected.controller.signal.aborted;
    const pending = (async () => {
      while (owns() && selected.playing && accumulator >= 20 && !selected.job.snapshot().done) {
        const result = await selected.job.step();
        if (!owns()) return;
        if (!result.accepted) {
          accumulator = Math.min(accumulator, 20);
          break;
        }
        accumulator -= 20;
        observeCombat(result.state);
        if (!selected.playing) selected.session.pause();
      }
      if (!owns()) return;
      if (selected.job.snapshot().done) await finishCombatPlayback(selected);
    })();
    selected.pending = pending;
    void pending
      .catch((error) => {
        if (!owns()) return;
        selected.error = error.message;
        selected.playing = false;
        pauseFlight();
        $('flight-status').textContent = txt(
          `Combat playback could not be verified: ${error.message}`,
          `Не вдалося перевірити запис бою: ${error.message}`,
        );
        reportError(error);
      })
      .finally(() => {
        if (selected.pending === pending) selected.pending = null;
      });
  }
  async function finishCombatPlayback(selected = combatPlayback) {
    if (!selected || selected.verification || selected.error) return;
    const verification = await selected.job.finish();
    if (disposed || combatPlayback !== selected || flight !== selected.session) return;
    selected.verification = verification;
    selected.playing = false;
    selected.session.pause();
    finished = true;
    input.enable(false);
    radio.freeze('playback-ended');
    audio.pause();
    $('result-panel').hidden = false;
    $('result-panel').replaceChildren(
      el('h2', txt('Combat playback verified', 'Запис бою перевірено')),
      el(
        'p',
        txt(
          'Recorded controls reproduced the combat and flight result. Watching earns no rewards.',
          'Записане керування відтворило результат бою й польоту. Перегляд не дає нагород.',
        ),
      ),
      button(txt('Watch again', 'Переглянути ще раз'), () => watchCombatSession(selected.source)),
      button(txt('Fly this encounter', 'Зіграти цей бій'), () =>
        startFlight(current, { encounter: clone(encounterSelection), paused: true }),
      ),
      button(txt('Back to lobby', 'До меню'), () => closeFlight()),
    );
    $('flight-status').textContent = txt(
      'Combat playback verified · no rewards.',
      'Запис бою перевірено · без нагород.',
    );
    updateHUD(selected.session.snapshot());
  }
  const detailLabel = doc.createElement('label'),
    detailCaption = doc.createElement('span'),
    detailSelect = doc.createElement('select');
  detailSelect.dataset.combatDetail = '';
  detailCaption.textContent = txt('Destruction detail', 'Деталізація руйнувань');
  for (const [value, en, uk] of [
    ['auto', 'Auto', 'Авто'],
    ['high', 'High', 'Висока'],
    ['ultra', 'Ultra', 'Ультра'],
  ]) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = txt(en, uk);
    detailSelect.append(option);
  }
  detailSelect.value = combatPresentationPreferences.snapshot().detail;
  detailSelect.addEventListener('change', () =>
    combatPresentationPreferences.set({ detail: detailSelect.value }),
  );
  detailLabel.append(detailCaption, detailSelect);
  encounterControls.root.append(detailLabel);
  const combatArtControls = el('fieldset'),
    combatArtLegend = el('legend'),
    combatArtLabel = el('label'),
    combatArtCaption = el('span'),
    combatArtSelect = el('select'),
    combatArtStatus = el('p');
  combatArtControls.dataset.combatArt = '';
  combatArtSelect.dataset.combatArtSelect = '';
  combatArtControls.hidden = !COMBAT_APPEARANCE_DOWNLOAD;
  for (const value of ['current', 'realistic']) {
    const option = el('option');
    option.value = value;
    combatArtSelect.append(option);
  }
  const combatArtDownload = button('', async () => {
    pauseFlight();
    if (await combatArtChoice.download()) await changeFlightVisuals(() => {});
  });
  const combatArtCancel = button('', () => combatArtChoice.cancel());
  const combatArtRetry = button('', () => changeFlightVisuals(() => {}));
  combatArtStatus.setAttribute('role', 'status');
  combatArtLabel.append(combatArtCaption, combatArtSelect);
  combatArtControls.append(
    combatArtLegend,
    combatArtLabel,
    combatArtDownload,
    combatArtCancel,
    combatArtRetry,
    combatArtStatus,
  );
  encounterControls.root.append(combatArtControls);
  let combatArtError = false;
  const combatArtChoice = createCombatAppearanceChoice({
    storage,
    openStore: () => openCombatAppearanceStore({ indexedDB: win.indexedDB }),
    descriptor: COMBAT_APPEARANCE_DOWNLOAD
      ? {
          ...COMBAT_APPEARANCE_DOWNLOAD,
          url: new URL(COMBAT_APPEARANCE_DOWNLOAD.url, import.meta.url).href,
        }
      : null,
    onChange: refreshCombatArt,
  });
  function refreshCombatArt() {
    const state = combatArtChoice.snapshot();
    combatArtLegend.textContent = txt('Combat character art', 'Оформлення бойових персонажів');
    combatArtCaption.textContent = txt('Character style', 'Стиль персонажів');
    combatArtSelect.value = state.selection;
    combatArtSelect.options[0].textContent = txt('Current', 'Поточний');
    combatArtSelect.options[1].textContent = txt('Realistic', 'Реалістичний');
    combatArtDownload.textContent =
      txt('Download realistic characters', 'Завантажити реалістичних персонажів') +
      (COMBAT_APPEARANCE_DOWNLOAD
        ? ` · ${(COMBAT_APPEARANCE_DOWNLOAD.bytes / 1048576).toFixed(1)} MiB`
        : '');
    combatArtDownload.hidden = state.installed;
    combatArtDownload.disabled = state.pending;
    combatArtCancel.textContent = txt('Cancel download', 'Скасувати завантаження');
    combatArtCancel.hidden = !state.pending;
    combatArtRetry.textContent = txt('Retry realistic art', 'Повторити підготовку оформлення');
    combatArtRetry.hidden = !combatArtError || state.selection !== 'realistic' || state.pending;
    combatArtStatus.textContent = state.pending
      ? txt(
          'Downloading and checking characters. Current art stays available.',
          'Завантаження та перевірка персонажів. Поточне оформлення залишається доступним.',
        )
      : ['download', 'invalid-cache'].includes(state.issue)
        ? txt(
            'Download could not be verified. Current art is available; retry the download.',
            'Не вдалося перевірити завантаження. Поточне оформлення доступне; повторіть спробу.',
          )
        : combatArtError
          ? txt(
              'Realistic art could not be prepared. Using Current; retry or lower graphics quality.',
              'Не вдалося підготувати реалістичне оформлення. Використано поточне; повторіть спробу або знизьте якість графіки.',
            )
          : state.issue === 'missing'
            ? txt(
                'Download the optional character pack to use Realistic. Current art is active.',
                'Завантажте додатковий пакунок для реалістичного оформлення. Зараз активне поточне.',
              )
            : txt(
                'Used in combat activities and Studio previews. Independent of Blood, Brutal and Remains; flight and damage rules stay the same.',
                'Для бойових режимів і перегляду в Студії. Незалежне від крові, жорстоких ефектів і решток; правила польоту та шкоди незмінні.',
              );
    if (state.storageIssue)
      combatArtStatus.textContent +=
        ' ' +
        txt(
          'Browser storage is unavailable; downloaded art lasts for this session.',
          'Сховище браузера недоступне; завантажене оформлення діє протягом цієї сесії.',
        );
  }
  async function applyCombatArt(target, owns = () => !disposed) {
    await combatArtChoice.ready;
    if (!owns()) return false;
    if (!target?.setCombatAppearance) return true;
    target.configureCombatPresentation({
      createPresentation: createCombatPresentation,
      createActors: createCombatActorPresentation,
      createAppearanceModels: prepareCombatAppearanceModels,
      cloneSkeleton: cloneCombatSkeleton,
    });
    const pack = combatArtChoice.pack(),
      status = target.resources?.().combatAppearance;
    if (pack && status?.state === 'ready' && status.sha256 === pack.sha256) return true;
    if (!pack && status?.state === 'current') return true;
    const accepted = await target.setCombatAppearance(pack);
    if (!owns()) return false;
    combatArtError = !accepted && Boolean(pack);
    refreshCombatArt();
    return true; // Renderer atomically falls back to Current when optional art fails.
  }
  on(combatArtSelect, 'change', () => {
    combatArtError = false;
    void changeFlightVisuals(() => combatArtChoice.select(combatArtSelect.value)).catch(
      reportError,
    );
  });
  refreshCombatArt();
  const combatFeedbackKey = 'revealline.fpv.combat-feedback.v1';
  let combatFeedback = {
      shake: 0.2,
      screen: 0.25,
      fullscreenBlood: false,
      hud: true,
      vitals: true,
      playerHealth: 'always',
      enemyHealth: 'aimed',
      combatDpad: false,
    },
    lastCombatHit = -100,
    lastCombatDamage = -100,
    combatFeedbackRun = null;
  try {
    const saved = JSON.parse(storage?.getItem(combatFeedbackKey) ?? 'null');
    for (const key of ['shake', 'screen'])
      if (Number.isFinite(saved?.[key]) && saved[key] >= 0 && saved[key] <= 1)
        combatFeedback[key] = saved[key];
    for (const key of ['fullscreenBlood', 'hud', 'vitals', 'combatDpad'])
      if (typeof saved?.[key] === 'boolean') combatFeedback[key] = saved[key];
    if (['off', 'damaged', 'always'].includes(saved?.playerHealth))
      combatFeedback.playerHealth = saved.playerHealth;
    if (['off', 'aimed', 'all'].includes(saved?.enemyHealth))
      combatFeedback.enemyHealth = saved.enemyHealth;
  } catch {
    /* Keep comfortable defaults when optional preferences are unavailable. */
  }
  const combatHUD = el('div'),
    combatHit = el('span'),
    combatScreen = el('div'),
    combatOverlay = el('div');
  combatOverlay.style.cssText =
    'position:absolute;left:16px;top:58px;z-index:4;display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-width:min(65vw,440px);pointer-events:none';
  combatOverlay.dataset.combatOverlay = '';
  const combatSummary = el('div');
  combatSummary.dataset.combatSummary = '';
  combatSummary.hidden = true;
  combatOverlay.append(combatSummary);
  combatHUD.dataset.combatHud = '';
  combatHit.dataset.combatHit = '';
  combatScreen.dataset.combatScreen = '';
  combatHUD.style.cssText =
    'padding:8px 12px;background:#171f28d9;border-radius:8px;color:#fff;font:600 14px/1.5 system-ui;pointer-events:none;white-space:pre-line';
  combatHit.style.cssText =
    'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:3;color:#ffe1a0;font:700 26px system-ui;text-shadow:0 1px 4px #000;pointer-events:none';
  combatScreen.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;opacity:0';
  combatHUD.hidden = combatHit.hidden = combatScreen.hidden = true;
  combatOverlay.append(combatHUD);
  $('world-viewport').append(combatScreen, combatOverlay, combatHit);
  const combatVitals = mountCombatVitals({
    document: doc,
    parent: $('world-viewport'),
    weaponRules: ENCOUNTER_WEAPONS,
  });
  const combatFeedbackDefinitions = new WeakMap();
  function combatFeedbackDefinition() {
    if (!flight?.combatDefinition) return encounterSelection;
    // Definitions are immutable per session. Read the accessor once, rather
    // than cloning the complete encounter on every HUD frame.
    if (!combatFeedbackDefinitions.has(flight)) {
      const definition = flight.combatDefinition();
      combatFeedbackDefinitions.set(flight, {
        payload: definition.payload,
        ammoPreset: definition.ammoPreset,
        playerDamage: definition.playerDamage,
      });
    }
    return combatFeedbackDefinitions.get(flight);
  }
  const combatActions = el('div');
  combatActions.dataset.combatActions = '';
  combatActions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;pointer-events:auto';
  const combatActionButtons = {};
  for (const key of ['next', 'return', 'restart']) {
    const control = button('', () => encounterControls.buttons[key].click());
    control.style.cssText = 'min-height:40px;padding:8px 12px;font-size:14px';
    control.dataset.combatAction = key;
    combatActionButtons[key] = control;
    combatActions.append(control);
  }
  combatActions.hidden = true;
  combatOverlay.append(combatActions);
  const weaponActions = el('details');
  weaponActions.className = 'combat-weapon-drawer';
  const weaponSummary = el('summary');
  weaponSummary.dataset.combatWeaponSummary = '';
  weaponActions.append(weaponSummary);
  weaponActions.dataset.combatWeaponActions = '';
  weaponActions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;pointer-events:auto';
  const weaponActionButtons = [];
  let combatNavigation = 'target';
  const stagedRadioAction = createRadioStagedAction({
    execute: (action) => {
      const accepted = combatCommand(action);
      if (!accepted)
        $('flight-status').textContent = txt(
          'Action unavailable here. Return to the encounter, then release and activate Fire to try again.',
          'Дія тут недоступна. Поверніться до бою, потім відпустіть і ввімкніть Fire, щоб повторити.',
        );
      return accepted;
    },
  });
  let stagedRadioProfile = null,
    stagedRadioLayout = null;
  on(win, 'blur', () => stagedRadioAction.clear());
  on(win, 'gamepaddisconnected', () => stagedRadioAction.clear());
  on(doc, 'visibilitychange', () => {
    if (doc.visibilityState === 'hidden') stagedRadioAction.clear();
  });
  function combatCommand(action) {
    const state = readFlightState();
    if (
      replayProof ||
      combatReplaySource ||
      !state?.encounter ||
      state.status !== 'active' ||
      flightMenuOpen() ||
      state.encounter.outsideArea ||
      state.encounter.geometryWaiting ||
      doc.visibilityState === 'hidden'
    )
      return false;
    stagedRadioAction.direct();
    const command =
      action === 'weapon'
        ? { switchWeapon: 1 - (state.encounter.weaponIndex ?? 0) }
        : action === 'weaponA'
          ? { switchWeapon: 0 }
          : action === 'weaponB'
            ? { switchWeapon: 1 }
            : { [action]: true };
    return flight.queueCombatCommand?.(command) ?? false;
  }
  for (const [action, en, uk] of [
    ['weapon', 'Switch · C', 'Зброя · C'],
    ['reload', 'Reload · L', 'Перезарядити · L'],
    ['payload', 'Payload · G', 'Заряд · G'],
    ['detonate', 'Detonate · H', 'Підірвати · H'],
  ]) {
    const control = button(txt(en, uk), () => combatCommand(action));
    control.dataset.combatWeaponAction = action;
    weaponActions.append(control);
    weaponActionButtons.push({ action, control, en, uk });
  }
  on(weaponActions, 'click', (event) => {
    if (
      $('world-viewport').dataset.hudDensity === 'compact' &&
      event.target?.closest?.('button') &&
      !event.target.disabled
    )
      weaponActions.open = false;
  });
  const servicePadButton = button(txt('Service pad', 'Майданчик поповнення'), () => {
    combatNavigation = combatNavigation === 'service' ? 'target' : 'service';
  });
  weaponActions.append(servicePadButton);
  combatOverlay.append(weaponActions);
  weaponActions.hidden = true;
  const combatGoreGroup = el('fieldset'),
    combatGoreLegend = el('legend'),
    combatGoreStatus = el('p'),
    combatGoreFields = {};
  combatGoreGroup.dataset.combatGore = '';
  combatGoreStatus.dataset.combatGoreStatus = '';
  combatGoreStatus.setAttribute('role', 'status');
  combatGoreStatus.setAttribute('aria-live', 'polite');
  const fullGoreButton = button('', () => {
    huntPresentationControls.preferences.set({ blood: true, brutal: true, showRemains: true });
    refreshCombatGore();
  });
  fullGoreButton.dataset.combatFullGore = '';
  combatGoreGroup.append(combatGoreLegend, fullGoreButton);
  for (const key of ['blood', 'brutal', 'showRemains']) {
    const label = el('label'),
      input = el('input'),
      caption = el('span');
    input.type = 'checkbox';
    input.dataset.combatGoreChoice = key;
    on(input, 'change', () => huntPresentationControls.preferences.set({ [key]: input.checked }));
    label.append(input, caption);
    combatGoreGroup.append(label);
    combatGoreFields[key] = { input, caption };
  }
  const combatGoreDetailButton = button('', () => openSettings({ category: 'display' }));
  combatGoreGroup.append(combatGoreStatus, combatGoreDetailButton);
  encounterControls.root.append(combatGoreGroup);
  function refreshCombatGore() {
    const state = huntPresentationControls.preferences.snapshot(),
      all = state.blood && state.brutal && state.showRemains;
    combatGoreLegend.textContent = txt('Destruction effects', 'Ефекти знищення');
    fullGoreButton.textContent = all
      ? txt('Full gore enabled', 'Повні криваві ефекти увімкнено')
      : txt('Full gore', 'Повні криваві ефекти');
    fullGoreButton.setAttribute('aria-pressed', String(all));
    const captions = {
      blood: txt('Blood', 'Кров'),
      brutal: txt('Dismemberment', 'Розчленування'),
      showRemains: txt('Persistent remains', 'Залишати рештки'),
    };
    for (const [key, { input, caption }] of Object.entries(combatGoreFields)) {
      input.checked = state[key];
      caption.textContent = captions[key];
    }
    combatGoreStatus.textContent =
      (all
        ? txt(
            'Full gore is on: blood, dismemberment and persistent remains. Changes apply immediately to combat and existing remains.',
            'Повні криваві ефекти увімкнено: кров, розчленування та рештки. Зміни одразу діють у бою та для наявних решток.',
          )
        : txt(
            'Custom effects. Full gore turns on all three options. Changes apply immediately.',
            'Власні ефекти. Повні криваві ефекти вмикають усі три параметри. Зміни діють одразу.',
          )) +
      (state.durable
        ? txt(' Saved on this device.', ' Збережено на цьому пристрої.')
        : txt(
            ' Active for this session; saving is unavailable.',
            ' Діє в цьому сеансі; збереження недоступне.',
          ));
    combatGoreDetailButton.textContent = txt(
      'Destruction detail & character style',
      'Деталізація знищення та стиль персонажів',
    );
  }
  listeners.push(huntPresentationControls.preferences.subscribe(refreshCombatGore));
  const combatHealthFields = [];
  for (const [key, en, uk, values] of [
    [
      'playerHealth',
      'Player health display',
      'Здоров’я гравця',
      [
        ['off', 'Off', 'Вимкнено'],
        ['damaged', 'When damaged', 'Після пошкоджень'],
        ['always', 'Always', 'Завжди'],
      ],
    ],
    [
      'enemyHealth',
      'Enemy health display',
      'Здоров’я ворогів',
      [
        ['off', 'Off', 'Вимкнено'],
        ['aimed', 'Aimed / recently hit', 'У прицілі / після влучання'],
        ['all', 'All', 'Усі'],
      ],
    ],
  ]) {
    const label = el('label'),
      select = el('select');
    const caption = el('span', txt(en, uk));
    label.append(caption, select);
    select.dataset.combatFeedback = key;
    for (const [value, a, b] of values) {
      const option = el('option', txt(a, b));
      option.value = value;
      select.append(option);
    }
    select.value = combatFeedback[key];
    select.addEventListener('change', () => {
      combatFeedback[key] = select.value;
      try {
        storage?.setItem(combatFeedbackKey, JSON.stringify(combatFeedback));
      } catch {
        /* Session only. */
      }
    });
    encounterControls.root.append(label);
    combatHealthFields.push({ caption, select, en, uk, values });
  }
  const combatFeedbackFields = [];
  for (const [key, en, uk] of [
    ['shake', 'Combat camera shake', 'Тремтіння камери в бою'],
    ['screen', 'Combat screen effects', 'Екранні ефекти бою'],
    ['fullscreenBlood', 'Fullscreen blood effects', 'Криваві ефекти на екрані'],
    [
      'combatDpad',
      'Combat D-pad: left/right weapons, up reload, down payload; L3 detonate',
      'Бойова хрестовина: зброя, перезарядка, заряд; L3 — підрив',
    ],
    ['hud', 'Combat status widget', 'Віджет стану бою'],
    ['vitals', 'Health & ammo indicators', 'Індикатори здоров’я та боєприпасів'],
  ]) {
    const label = el('label'),
      caption = el('span', txt(en, uk)),
      control = doc.createElement('input');
    control.type = ['shake', 'screen'].includes(key) ? 'range' : 'checkbox';
    if (control.type === 'range') {
      control.min = '0';
      control.max = '1';
      control.step = '0.05';
      control.value = String(combatFeedback[key]);
    } else control.checked = combatFeedback[key];
    control.addEventListener('input', () => {
      combatFeedback[key] = control.type === 'range' ? Number(control.value) : control.checked;
      try {
        storage?.setItem(combatFeedbackKey, JSON.stringify(combatFeedback));
      } catch {
        /* Session preference remains active. */
      }
    });
    control.dataset.combatFeedback = key;
    label.append(caption, control);
    encounterControls.root.append(label);
    combatFeedbackFields.push({ label, caption, en, uk });
  }
  function combatWeaponName(id) {
    return (
      {
        autocannon: txt('Autocannon', 'Автогармата'),
        scatter: txt('Scatter', 'Картеч'),
        precision: txt('Precision', 'Точна зброя'),
        rocket: txt('Rockets', 'Ракети'),
      }[id] ?? txt('Weapon', 'Зброя')
    );
  }
  function combatActionHint(action) {
    const source = $('flight-source').value;
    if (source === 'radio') {
      const binding = radio.controlLayout()?.switches[action];
      return binding
        ? Object.hasOwn(binding, 'axis')
          ? `${txt('Channel', 'Канал')} ${binding.axis}`
          : `${txt('Button', 'Кнопка')} ${binding.button}`
        : txt('Radio menu', 'Меню пульта');
    }
    if (source === 'keyboard')
      return { weapon: 'C', reload: 'L', payload: 'G', detonate: 'H' }[action] ?? '';
    if (source === 'controller' && combatFeedback.combatDpad)
      return { weapon: '← / →', reload: '↑', payload: '↓', detonate: 'L3' }[action] ?? '';
    return '';
  }
  function combatPayloadControls(encounter, payload, ammoPreset = 'balanced') {
    const remote = encounter?.ordnance?.find((item) => item.kind === 'remote');
    const armed = payload === 'drone' && encounter?.payloadArmed;
    return {
      label:
        payload === 'remote'
          ? txt('Deploy charge · G', 'Встановити заряд · G')
          : payload === 'drone'
            ? txt('Arm drone charge · G', 'Звести заряд дрона · G')
            : txt('Drop bomb · G', 'Скинути бомбу · G'),
      state: armed
        ? txt(
            'Drone charge armed · Detonate to trigger',
            'Заряд дрона зведено · натисніть «Підірвати»',
          )
        : remote
          ? remote.settled
            ? txt(
                'Remote charge ready · Detonate to trigger',
                'Дистанційний заряд готовий · натисніть «Підірвати»',
              )
            : txt('Remote charge falling · wait for contact', 'Заряд падає · зачекайте приземлення')
          : encounter?.payloadAmmo > 0
            ? txt('Payload ready', 'Заряд готовий')
            : ammoPreset === 'tactical'
              ? txt(
                  'Payload empty · replenish at the service pad',
                  'Зарядів немає · поповніть їх на майданчику',
                )
              : ammoPreset === 'arcade'
                ? txt(
                    'Payload empty · release Fire for 11 s to recharge',
                    'Зарядів немає · відпустіть «Вогонь» на 11 с для поповнення',
                  )
                : encounter?.servicePad
                  ? txt(
                      'Payload empty · replenish at supplies or the service pad',
                      'Зарядів немає · зберіть припаси або відвідайте майданчик',
                    )
                  : txt(
                      'Payload empty · collect supplies to replenish',
                      'Зарядів немає · зберіть припаси для поповнення',
                    ),
      canDeploy: Boolean(
        encounter?.payloadAmmo > 0 && !armed && !remote && (encounter?.ordnance?.length ?? 0) < 16,
      ),
      canDetonate: Boolean(armed || (payload === 'remote' && remote?.settled)),
    };
  }
  function flightHealthText(state, { damagedOnly = false } = {}) {
    if (!Number.isFinite(state.health)) return '';
    const preference = state.encounter
      ? combatFeedback.playerHealth
      : damagedOnly
        ? 'damaged'
        : 'always';
    return preference === 'off' ||
      (preference === 'damaged' && state.health >= (state.encounter?.maxHealth ?? 100))
      ? ''
      : `♥ ${state.health}`;
  }
  function paintCombatHUD(state, visible) {
    const c = state.encounter,
      tick = c?.ticks ?? 0,
      feedbackDefinition = combatFeedbackDefinition(),
      healthText = combatFeedback.vitals ? '' : flightHealthText(state);
    combatVitals.update({
      state,
      definition: feedbackDefinition,
      preferences: combatFeedback,
      locale,
      visible,
    });
    if (c?.runId !== combatFeedbackRun) {
      combatFeedbackRun = c?.runId ?? null;
      lastCombatHit = lastCombatDamage = -100;
      combatNavigation = 'target';
    }
    if (c)
      for (const event of c.events) {
        if (event.type === 'impact' && event.damage > 0) lastCombatHit = event.tick;
        if (event.type === 'player-damage') lastCombatDamage = event.tick;
      }
    combatHUD.hidden = !c || !visible || !combatFeedback.hud;
    combatSummary.hidden = combatHUD.hidden;
    if (c) {
      const remaining =
        c.activity === 'hunting'
          ? 9000 - c.ticks
          : c.activity === 'survival' && c.survival?.mode !== 'endless'
            ? 18000 - c.ticks
            : c.ticks;
      const seconds = Math.max(0, Math.floor(remaining / 50));
      combatSummary.textContent = `${encounterActivityLabel(c.activity, locale)}${c.activity === 'continuous' ? ` · ${c.wave}` : ''} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}\n${c.kills} ${txt('defeats', 'знищено')} · ${c.actors.filter((actor) => actor.status === 'active').length} ${txt('active', 'активних')}${c.outsideArea ? ` · ${txt('Targets waiting', 'Цілі чекають')}` : c.geometryWaiting ? ` · ${txt('Loading terrain', 'Завантаження місцевості')}` : c.phase === 'intermission' ? ` · ${txt('Next wave', 'Наступна хвиля')}` : ''}`;
    }
    weaponSummary.textContent = c?.weapons
      ? `${txt('Weapons', 'Зброя')} · ${combatWeaponName(c.weapons[c.weaponIndex]?.id)}`
      : txt('Weapons', 'Зброя');
    weaponActions.hidden = !c?.weapons || !visible || Boolean(combatReplaySource);
    servicePadButton.textContent =
      combatNavigation === 'service'
        ? txt('Track target', 'Стежити за ціллю')
        : txt('Service pad', 'Майданчик поповнення');
    const payloadControls = combatPayloadControls(
      c,
      feedbackDefinition.payload,
      feedbackDefinition.ammoPreset,
    );
    servicePadButton.hidden = !c?.servicePad;
    if (!c?.servicePad && combatNavigation === 'service') combatNavigation = 'target';
    for (const item of weaponActionButtons) {
      const actionLabel =
        item.action === 'weapon'
          ? `${txt('Switch to', 'Змінити на')} ${combatWeaponName(c?.weapons?.[1 - (c.weaponIndex ?? 0)]?.id)}`
          : (item.action === 'payload' ? payloadControls.label : txt(item.en, item.uk)).split(
              ' · ',
            )[0];
      const hint = combatActionHint(item.action);
      item.control.textContent = `${actionLabel}${hint ? ` · ${hint}` : ''}`;
      item.control.setAttribute('aria-label', item.control.textContent);
      item.control.title =
        item.action === 'weapon'
          ? `${txt('Active gun', 'Активна зброя')}: ${combatWeaponName(c?.weapons?.[c.weaponIndex]?.id)}. ${txt('Switching guns does not change the payload.', 'Перемикання зброї не змінює заряд.')}`
          : item.action === 'payload'
            ? txt(
                'Deploy the separate payload. Fire shoots the active gun.',
                'Застосувати окремий заряд. Вогонь стріляє з активної зброї.',
              )
            : actionLabel;
      item.control.disabled =
        state.status !== 'active' ||
        c?.outsideArea ||
        c?.geometryWaiting ||
        Boolean(combatReplaySource) ||
        (item.action === 'payload' && !payloadControls.canDeploy) ||
        (item.action === 'detonate' && !payloadControls.canDetonate);
    }
    combatHit.hidden =
      !c || !visible || c.outsideArea || c.geometryWaiting || tick - lastCombatHit > 8;
    combatHit.textContent = '×';
    combatHit.style.left = $('aim-reticle').style.left || '50%';
    combatHit.style.top = $('aim-reticle').style.top || '50%';
    combatScreen.hidden = !c || !visible;
    combatActions.hidden = !c || !visible || Boolean(combatReplaySource);
    for (const [key, control] of Object.entries(combatActionButtons)) {
      control.textContent = encounterControls.buttons[key].textContent;
      control.hidden = encounterControls.buttons[key].hidden;
      control.disabled = encounterControls.buttons[key].disabled;
    }
    if (c)
      combatHUD.textContent = `${encounterActivityLabel(c.activity, locale)}${c.activity === 'continuous' ? ` · ${txt('Wave', 'Хвиля')} ${c.wave}` : ''}\n${c.kills} ${txt('defeats', 'знищено')} · ${c.actors.filter((actor) => actor.status === 'active').length} ${txt('active', 'активних')} · ${c.activity === 'hunting' ? Math.max(0, Math.ceil((9000 - c.ticks) / 50)) : Math.floor(c.ticks / 50)} s${healthText ? ` · ${healthText}` : ''}\n${c.shots} ${txt('shots', 'пострілів')} · ${c.hits} ${txt('hits', 'влучань')}${c.waitingForClearSpawn ? `\n${txt('Move away from the target spawn area', 'Відійдіть від місця появи цілей')}` : c.phase === 'intermission' ? `\n${txt('Next wave', 'Наступна хвиля')}: ${Math.max(0, Math.ceil((c.nextWaveTick - c.ticks) / 50))} s` : ''}`;
    if (c?.outsideArea)
      combatHUD.textContent += `\n${txt('Targets waiting · combat resumes on return', 'Цілі чекають · бій продовжиться після повернення')}`;
    else if (c?.geometryWaiting)
      combatHUD.textContent += `\n${txt('Loading combat terrain · flight stays available', 'Завантаження місцевості для бою · політ доступний')}`;
    if (c?.weapons) {
      const weapon = c.weapons[c.weaponIndex];
      const weaponName =
        {
          autocannon: txt('Autocannon', 'Автогармата'),
          scatter: txt('Scatter', 'Дробовик'),
          precision: txt('Precision', 'Точна зброя'),
          rocket: txt('Rockets', 'Ракети'),
        }[weapon.id] ?? weapon.id;
      if (!combatFeedback.vitals) {
        combatHUD.textContent += `\n${weaponName} · ${weapon.ammo} · ${weapon.reserve < 0 ? '∞' : weapon.reserve} ${txt('reserve', 'запас')}${weapon.reloadTicks ? ` · ${txt('Reloading', 'Перезарядка')} ${(weapon.reloadTicks / 50).toFixed(1)} s` : ''} · ${txt('Payload', 'Заряд')} ${c.payloadAmmo}`;
        combatHUD.textContent += `\n${payloadControls.state}`;
      }
      if (c.activity === 'survival')
        combatHUD.textContent += `\n${c.survival?.mode === 'endless' ? txt('Endless', 'Нескінченно') : `${Math.max(0, Math.ceil((18000 - c.ticks) / 50))} s`} · ${c.phase}`;
      if (c.activity === 'strike' && c.phase === 'aftermath')
        combatHUD.textContent += `\n${txt('Ordnance resolving after crash', 'Очікування влучання після аварії')}`;
      const required = c.actors.filter((a) => a.status === 'active' && a.type !== 'prop');
      const target =
        c.objectiveTarget ??
        required.reduce(
          (best, a) =>
            !best ||
            Math.hypot(
              a.position.x - state.position.x,
              a.position.y - state.position.y,
              a.position.z - state.position.z,
            ) <
              Math.hypot(
                best.position.x - state.position.x,
                best.position.y - state.position.y,
                best.position.z - state.position.z,
              )
              ? a
              : best,
          null,
        );
      const service = combatNavigation === 'service';
      const destination = service ? c.servicePad : target?.position;
      if (destination) {
        const dx = destination.x - state.position.x,
          dy = destination.y - state.position.y,
          dz = destination.z - state.position.z;
        const q = state.orientation.map((value) => value / 1000000),
          heading = {
            x: -2 * (q[0] * q[2] + q[3] * q[1]),
            z: -(1 - 2 * (q[0] * q[0] + q[1] * q[1])),
          };
        const degrees =
          ((((Math.atan2(dx, -dz) - Math.atan2(heading.x, -heading.z)) * 180) / Math.PI + 540) %
            360) -
          180;
        const turn =
          Math.abs(degrees) < 15
            ? txt('Ahead', 'Попереду')
            : degrees < 0
              ? txt('Left', 'Ліворуч')
              : txt('Right', 'Праворуч');
        combatHUD.textContent += `\n${service ? txt('Service pad', 'Поповнення') : txt('Target', 'Ціль')} · ${turn} ${Math.abs(Math.round(degrees))}° · ${(Math.hypot(dx, dy, dz) / 1000).toFixed(0)} m${Math.abs(dy) > 1500 ? ` · ${dy > 0 ? '↑' : '↓'}${Math.abs(dy / 1000).toFixed(0)} m` : ''}`;
      }
      if (service || c.serviceTicks > 0)
        combatHUD.textContent += `\n${txt('Hold low throttle, slow down and release weapons', 'Малий газ, знизьте швидкість і відпустіть зброю')} · ${Math.min(5, (c.serviceTicks ?? 0) / 50).toFixed(1)}/5 s`;
      if (c.challenge && !c.challenge.complete && c.ticks < 1500) {
        const names = {
          'disable-component': txt('Disable a component', 'Виведіть з ладу компонент'),
          'interrupt-attack': txt('Interrupt a prepared attack', 'Зірвіть підготовлену атаку'),
          'interceptor-group': txt('Clear the interceptors', 'Знищіть перехоплювачі'),
          'multi-target-blast': txt(
            'Hit multiple targets with one blast',
            'Кілька цілей одним вибухом',
          ),
        };
        combatHUD.textContent += `\n${txt('Challenge', 'Завдання')}: ${names[c.challenge.type] ?? c.challenge.type} ${c.challenge.progress}/${c.challenge.goal}`;
      }
      if (
        c.activity === 'survival' &&
        c.ticks >= 18000 &&
        !c.survival?.finalDefeated &&
        c.survival?.mode === 'timed'
      )
        combatHUD.textContent += `\n${txt('Overtime · defeat the final enemy', 'Додатковий час · знищіть останнього ворога')}`;
    }
    const fade =
      c && visible && !c.outsideArea && !c.geometryWaiting
        ? Math.max(0, 1 - (tick - lastCombatDamage) / 15)
        : 0;
    const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const shake = reduced ? 0 : fade * combatFeedback.shake * 5;
    $('world-canvas').style.transform = shake
      ? `translate(${Math.sin(tick * 2.7) * shake}px, ${Math.cos(tick * 3.1) * shake}px)`
      : '';
    const destruction = huntPresentationControls.preferences.snapshot();
    combatScreen.style.background =
      combatFeedback.fullscreenBlood && destruction.blood
        ? 'radial-gradient(ellipse,transparent 35%,#870e16 100%)'
        : 'radial-gradient(ellipse,transparent 60%,#e9a541 100%)';
    combatScreen.style.opacity = String(fade * combatFeedback.screen);
  }
  function freshEncounterSeed() {
    return (
      (win.crypto?.getRandomValues(new Uint32Array(1))[0] ??
        Math.floor(Math.random() * 0xffffffff)) ||
      1
    );
  }
  function selectEncounter(entry, options) {
    encounterUnavailable = '';
    // Preview also means unscored public free flight; authoring is identified
    // by its source so ordinary maps retain the player's activity choice.
    const authoringPreview = entry.packIdentity === 'authoring' || entry.regionalReview;
    return encounterPreferences.select({
      learning: Boolean(entry.beginner || learningEntries.has(entry.id)),
      original: Boolean(
        options.replayProof ||
          options.lessonDemo ||
          options.demonstration ||
          options.checkpoint ||
          options.recover ||
          ((options.tuningDraft || authoringPreview) && !options.encounter) ||
          options.challenge,
      ),
      override: options.encounter ?? { seed: freshEncounterSeed() },
    });
  }
  function readFlightState(selected = flight) {
    return selected?.frameSnapshot?.() ?? selected?.snapshot?.();
  }
  function observeCombat(state) {
    if (!state?.encounter && !state?.actorLives) return;
    if (state.encounter) updateCombatArchive(state);
    const context = {
      runId: state.encounter?.runId ?? `course-${flightToken}`,
      tick: state.encounter?.ticks ?? state.ticks,
      originMm: state.originMm,
    };
    renderer?.configureCombatPresentation?.({
      createPresentation: createCombatPresentation,
      createActors: createCombatActorPresentation,
      createAppearanceModels: prepareCombatAppearanceModels,
      cloneSkeleton: cloneCombatSkeleton,
      preferences: () => ({
        ...huntPresentationControls.preferences.snapshot(),
        enemyHealthDisplay: combatFeedback.enemyHealth,
      }),
      detail: () => combatPresentationPreferences.snapshot().detail,
    });
    if (state.encounter) renderer?.setCombatActors?.(state.encounter.actors, context);
    const facts =
      state.encounter?.events ??
      state.events.map((event, index) => ({
        ...event,
        tick: state.ticks,
        eventId:
          event.eventId ?? `${event.spawnId ?? event.actor}:${state.ticks}:${event.type}:${index}`,
      }));
    renderer?.observeCombat?.(facts, context);
  }
  function restoreCoursePresentation(state, cosmetics = null, proof = null) {
    if (!state?.actorLives) return;
    observeCombat({ ...state, events: [] });
    const runId = `course-${flightToken}`;
    const reconstructed = {
      format: 'FpvCombatPresentationV2',
      runId,
      tick: state.ticks,
      records: flight.defeatHistory?.() ?? [],
      impactRecords: [],
    };
    try {
      const saved =
        cosmetics?.proofIdentity === dataIdentity(proof) ? cosmetics.presentation : null;
      renderer?.restoreCombatPresentation?.(saved ? { ...saved, runId } : reconstructed, {
        runId,
        tick: state.ticks,
      });
    } catch {
      renderer?.restoreCombatPresentation?.(reconstructed, { runId, tick: state.ticks });
    }
  }
  async function restoreCombat(saved, ownsAttempt = () => true) {
    if (!saved || !flight?.restoreCombatRecovery) return ownsAttempt();
    const selectedFlight = flight,
      selectedRenderer = renderer;
    let result;
    try {
      result = await selectedFlight.restoreCombatRecovery(saved);
    } catch (error) {
      if (!ownsAttempt() || flight !== selectedFlight || renderer !== selectedRenderer)
        return false;
      throw error;
    }
    if (!ownsAttempt() || flight !== selectedFlight || renderer !== selectedRenderer) return false;
    const reconstructed = () => ({
      format: 'FpvCombatPresentationV2',
      runId: result.state.encounter.runId,
      tick: result.state.encounter.ticks,
      records: selectedFlight.combatDefeats(),
      impactRecords: selectedFlight.combatImpacts?.() ?? [],
    });
    try {
      selectedRenderer.restoreCombatPresentation(result.presentation ?? reconstructed(), {
        runId: result.state.encounter.runId,
        tick: result.state.encounter.ticks,
      });
    } catch {
      selectedRenderer.restoreCombatPresentation(reconstructed(), {
        runId: result.state.encounter.runId,
        tick: result.state.encounter.ticks,
      });
    }
    observeCombat(result.state);
    return true;
  }
  function combatLaunchMetadata() {
    if (!workbenchAttemptConfiguration) return null;
    return {
      format: 'FPVCombatLaunch.v1',
      configuration: clone(workbenchAttemptConfiguration),
      mode: $('flight-mode').value,
      ...(current?.regional
        ? {
            regional: Object.fromEntries(
              ['spawnId', 'savedStart', 'initialHeading', 'continuous', 'geometryProfile']
                .filter((key) => current.configuration[key] !== undefined)
                .map((key) => [key, clone(current.configuration[key])]),
            ),
          }
        : {}),
    };
  }
  function combatLaunchEntry(entry, launch, baseIdentity = null) {
    if (!entry.regional) return entry;
    const regionalAdvanced = baseIdentity?.model?.startsWith('regional-')
      ? true
      : baseIdentity?.format === 'FPVRegionalEncounterBase.v1'
        ? false
        : Boolean(entry.regionalAdvanced);
    if (!launch?.regional) return { ...entry, regionalAdvanced };
    const configuration = { ...entry.configuration };
    for (const key of [
      'spawnId',
      'savedStart',
      'initialHeading',
      'continuous',
      'geometryProfile',
    ]) {
      delete configuration[key];
      if (launch.regional[key] !== undefined) configuration[key] = clone(launch.regional[key]);
    }
    return { ...entry, regionalAdvanced, configuration };
  }
  async function saveCombatSession(download = false) {
    if (combatReplaySource || !flight?.exportCombatRecovery) return;
    const selectedFlight = flight,
      selectedEntry = current,
      selectedToken = flightToken,
      launch = combatLaunchMetadata();
    const autosaveRequest = download ? null : combatAutosaves.reserve();
    if (download) pauseFlight();
    let operation = combatSaves.get(selectedFlight);
    if (!operation) {
      operation = selectedFlight.exportCombatRecovery(
        renderer?.exportCombatPresentation?.() ?? null,
      );
      combatSaves.set(selectedFlight, operation);
      operation
        .finally(() => {
          if (combatSaves.get(selectedFlight) === operation) combatSaves.delete(selectedFlight);
        })
        .catch(() => {});
    }
    const saved = { ...(await operation), launch };
    if (download) await exportJSONFile(saved, `fpv-combat-${selectedEntry.id}.json`);
    else {
      if (selectedToken !== flightToken) return;
      try {
        await combatAutosaves.save(saved, autosaveRequest);
      } catch (error) {
        if (selectedToken !== flightToken || disposed) return;
        const archiveHealthy =
          combatArchiveOwner === selectedFlight &&
          ['recording', 'ended'].includes(combatArchive?.snapshot().state);
        $('flight-status').textContent =
          txt(
            'Automatic recovery could not be saved on this device. Use Save combat session to keep the complete recovery file.',
            'Не вдалося автоматично зберегти відновлення на пристрої. Збережіть бойову сесію, щоб отримати повний файл відновлення.',
          ) +
          (archiveHealthy
            ? txt(
                ' Your combat recording is still being saved separately.',
                ' Запис бою продовжує зберігатися окремо.',
              )
            : '') +
          ` ${error.message}`;
      }
    }
  }
  const huntReactions = mountWorldHuntReactions({
    sound: audio,
    container: doc.querySelector('#world-viewport .flight-coaching'),
    settingsContainer: $('sim-flight-controls'),
    document: doc,
    window: win,
    storage,
    locale: () => locale,
  });
  const soundButton = button('', async () => {
    const enabled = !audio.enabled();
    await Promise.all([audio.setEnabled(enabled), presentation.setSoundEnabled(enabled)]);
    if (enabled) huntReactions.prepare();
    updateSoundLabel();
  });
  soundButton.id = 'world-sound';
  doc.querySelector('.flight-controls').append(soundButton);
  function updateSoundLabel() {
    playShell?.update({ muted: !audio.enabled() });
    soundButton.textContent = audio.enabled()
      ? txt('Sound on', 'Звук увімкнено')
      : txt('Sound off', 'Звук вимкнено');
    soundButton.setAttribute('aria-pressed', String(audio.enabled()));
    soundButton.dataset.simIcon = audio.enabled() ? 'sound' : 'mute';
    $('lobby-sound').textContent = soundButton.textContent;
    $('lobby-sound').setAttribute('aria-label', soundButton.textContent);
    $('lobby-sound').setAttribute('aria-pressed', String(audio.enabled()));
    $('lobby-sound').dataset.simIcon = soundButton.dataset.simIcon;
    presentation.refresh();
  }
  updateSoundLabel();
  listeners.push(
    audio.subscribe(() => {
      updateSoundLabel();
      // Synchronize mute without unlocking or resuming audio from a storage event.
      presentation.setSoundPreference(audio.enabled());
    }),
  );
  const folderLabel = el('label', undefined, 'file-button'),
    folderText = el('span', txt('Choose scene folder', 'Вибрати папку сцени')),
    folderInput = el('input');
  folderInput.id = 'import-world-folder';
  folderInput.type = 'file';
  folderInput.multiple = true;
  folderInput.setAttribute('webkitdirectory', '');
  folderLabel.append(folderText, folderInput);
  $('import-world').closest('label').after(folderLabel);
  translatedNodes.push({ node: folderText, key: 'chooseFolder', fallback: 'Choose scene folder' });
  on(folderInput, 'change', async (e) => {
    try {
      await importScene(e.target.files);
    } finally {
      e.target.value = '';
    }
  });
  const newWorldButton = button(txt('Start a new world', 'Почати новий світ'), () => {
    editingProject = null;
    projectAssets = new Map();
    projectGeneration = null;
    updateImportControls();
    $('import-report').textContent = txt(
      'Choose a GLB or scene folder to start a new world.',
      'Виберіть GLB або папку сцени, щоб почати новий світ.',
    );
  });
  folderLabel.after(newWorldButton);
  translatedNodes.push({ node: newWorldButton, key: 'newWorld', fallback: 'Start a new world' });
  const ghostButton = button('', async () => {
    if (!flight || preview || replayProof || !sectorReference) return;
    ghostEnabled = !ghostEnabled;
    if (ghostEnabled) {
      pauseFlight();
      await loadGhost();
    } else clearGhost();
    updateGhostHUD();
    await saveRecovery();
  });
  ghostButton.id = 'show-ghost';
  ghostButton.setAttribute('aria-describedby', 'sector-reference ghost-status');
  doc.querySelector('.flight-controls').append(ghostButton);
  function download(data, name, type = 'application/json') {
    const blob =
        data instanceof Blob
          ? data
          : new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type }),
      url = win.URL.createObjectURL(blob),
      a = el('a');
    a.href = url;
    a.download = name;
    doc.body.append(a);
    a.click();
    a.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 30000);
  }
  function showTab(id, focus = true) {
    if (!['explore', 'learn', 'playlists', 'creator', 'packs'].includes(id)) return;
    if (missionChooser && ['explore', 'learn'].includes(id) && focus) {
      openMissionChooser(id);
      return;
    }
    for (const panel of doc.querySelectorAll('.tab-panel')) panel.hidden = panel.id !== id;
    for (const b of doc.querySelectorAll('[data-tab]')) {
      b.classList.toggle('selected', b.dataset.tab === id);
      if (b.dataset.tab === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    if (focus && win.location.hash !== `#${id}`) win.history.replaceState(null, '', `#${id}`);
    if (focus) {
      const heading = $(id).querySelector('h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
      win.scrollTo(0, 0);
    }
    worldLibrary.deactivate();
    regionalLibrary.deactivate();
    if (id === 'packs') {
      worldLibrary.open();
      regionalLibrary.open();
    }
    if (id === 'creator') ensureSpatialEditor();
  }
  function paintRuntimeOfflineStatus() {
    const messages = {
      preparing: [
        'Preparing simulator files for offline use…',
        'Підготовка файлів для автономного запуску…',
      ],
      removing: ['Removing offline simulator files…', 'Прибирання автономних файлів симулятора…'],
      ready: [
        'Offline runtime preparation completed.',
        'Підготовку автономного запуску завершено.',
      ],
      removed: [
        'Offline simulator files removed. Installed worlds and flight records are kept.',
        'Автономні файли симулятора прибрано. Встановлені світи й записи польотів збережено.',
      ],
      cancelled: ['Offline download cancelled.', 'Автономне завантаження скасовано.'],
      error: [
        'Offline preparation failed. Keep this tab open and try again with a packaged simulator.',
        'Не вдалося підготувати автономний запуск. Залиште цю вкладку відкритою та повторіть спробу в пакунку симулятора.',
      ],
      removeFailed: [
        'Could not remove offline simulator files. Please try again.',
        'Не вдалося прибрати автономні файли симулятора. Спробуйте ще раз.',
      ],
      unavailable: [
        'Offline installation needs a secure browser with service-worker support.',
        'Для автономного встановлення потрібен захищений браузер із підтримкою сервісних воркерів.',
      ],
    };
    const text = !runtimeOfflineFeedback
      ? ''
      : messages[runtimeOfflineFeedback.kind]
        ? txt(...messages[runtimeOfflineFeedback.kind])
        : txt(...messages.error);
    // Both panels report the same completed operation; button presence is not readiness evidence.
    for (const id of ['runtime-offline-status', 'settings-runtime-offline-status']) {
      const node = $(id);
      if (!node) continue;
      if (node.textContent !== text) node.textContent = text;
      node.hidden = !text;
    }
  }
  function paintLanguage() {
    encounterControls.refresh();
    encounterEditor?.refresh();
    refreshCombatArt();
    detailCaption.textContent = txt('Destruction detail', 'Деталізація руйнувань');
    for (const option of detailSelect.options)
      option.textContent = {
        auto: txt('Auto', 'Авто'),
        high: txt('High', 'Висока'),
        ultra: txt('Ultra', 'Ультра'),
      }[option.value];
    for (const { caption, en, uk } of combatFeedbackFields) caption.textContent = txt(en, uk);
    refreshCombatGore();
    for (const { caption, select, en, uk, values } of combatHealthFields) {
      caption.textContent = txt(en, uk);
      for (const option of select.options) {
        const row = values.find(([value]) => value === option.value);
        option.textContent = txt(row[1], row[2]);
      }
    }
    continueCombatButton.textContent = txt('Continue saved combat', 'Продовжити збережений бій');
    watchCombatButton.textContent = txt('Watch current attempt', 'Переглянути поточну спробу');
    watchCombatFileButton.textContent = txt('Watch combat file', 'Переглянути файл бою');
    courseClassFilter?.refresh();
    paintRuntimeOfflineStatus();
    paintRegionalStarts();
    enemyStatsViews.forEach((view) => view.refresh());
    const toolNames = {
      learn: txt('Flight School', 'Льотна школа'),
      playlists: txt('Playlists', 'Добірки'),
      creator: txt('Workshop', 'Майстерня'),
      packs: txt('World library', 'Бібліотека світів'),
    };
    for (const tool of doc.querySelectorAll('[data-sim-mission-tool]'))
      tool.textContent = toolNames[tool.dataset.simMissionTool];
    for (const action of doc.querySelectorAll('[data-random-flight="catalogue"]'))
      action.textContent = txt('Random flight', 'Випадковий політ');
    const toolsSummary = doc.querySelector('[data-sim-mission-tools] > summary');
    if (toolsSummary) toolsSummary.textContent = txt('SIM tools', 'Інструменти SIM');
    playShell?.setLocale(locale);
    modeSettingsView?.refresh(locale);
    flightComfort?.refresh();
    globalSettingsView?.refresh(locale);
    globalTools?.refresh();
    shellModes.refresh?.();
    appearanceControls.refresh();
    doc.documentElement.lang = locale;
    for (const { node, key, fallback } of translatedNodes)
      node.textContent =
        key === 'keys'
          ? keyboardFlightHelp($('flight-keyboard-preset').value, locale, { combat: true })
          : ((locale === 'uk' ? COPY_UK[key] : COPY_EN[key]) ?? COPY_EN[key] ?? fallback);
    $('world-radio-title').textContent = txt('Radio setup', 'Налаштування пульта');
    $('close-sim-settings').textContent = txt('Back', 'Назад');
    immersive.refresh();
    updateSoundLabel();
    audioControls.refresh();
    hudPreferences.refresh?.();
    huntPresentationControls.refresh();
    huntReactions.refresh();
    refreshEnemyGuide();
    updateGhostHUD();
    for (const id of ['flight-mode', 'first-flight-mode']) {
      $(id).options[0].textContent = txt('Self-level', 'Самовирівнювання');
      $(id).options[1].textContent = 'Acro';
    }
    presentation.refresh();
    paintLoadout();
  }
  function ensureSpatialEditor() {
    if (!editor || !$('world-editor-canvas')) return;
    if (!spatialEditor) {
      spatialEditor = mountWorldEditor({
        canvas: $('world-editor-canvas'),
        window: win,
        course: editor.world?.themeProfile?.format === 'ThemeProfile.v3' ? null : editor,
        mode: editorMode(),
        getPresentation: () => appearanceControls.resolve().appearance,
        onError: reportError,
        onSelect(ref) {
          editorSelection = ref;
          if (ref?.kind === 'criterion') editorIndex = ref.index;
          if (ref?.kind === 'actor') actorEditor?.select(ref.id);
          refreshEditor(false);
          if (ref?.kind === 'criterion') actorEditor?.selectObjective(editorMode(), ref.index);
        },
        onPreview(ref) {
          if (ref?.position)
            for (const k of coordinates) $(`criterion-${k}`).value = ref.position[k] / 1000;
        },
        onChange(ref) {
          applyEdit((c) => moveSelection(c, ref, ref.position));
        },
      });
      void spatialEditor.ready
        .then(() => {
          spatialEditor.setSnap(Number($('editor-snap').value));
          refreshEditorScene();
        })
        .catch(reportError);
    }
    spatialEditor.refresh();
  }
  function refreshEditorScene() {
    const request = ++editorEnvironmentRequest;
    editorEnvironmentPreparation?.abort();
    editorEnvironmentPreparation = null;
    if (!spatialEditor || !editor) return;
    const source = editor,
      selectedMode = editorMode();
    const active = () => !disposed && request === editorEnvironmentRequest && source === editor;
    const apply = (accepted) => {
      if (!active()) return;
      const appearance = accepted
        ? recordedSimAppearance(source)
        : appearanceControls.resolve().appearance;
      const options = accepted
        ? {
            presentation: appearance,
            industrialEnvironment: accepted.pin,
            artRevision: accepted.artRevision,
          }
        : {};
      if (accepted && editorScope !== accepted.mode) {
        editorScope = accepted.mode;
        refreshEditor(false);
      }
      spatialEditor.setCourse(source, accepted?.mode ?? selectedMode, options);
      const profile = resolveSimThemeProfile(source, appearance);
      let status = $('editor-appearance-status');
      if (!status) {
        status = el('p', undefined, 'hint');
        status.id = 'editor-appearance-status';
        status.setAttribute('role', 'status');
        $('world-editor-canvas').after(status);
      }
      status.textContent = `${txt('Preview appearance', 'Оформлення перегляду')}: ${creatorThemeLabel(profile)}.`;
      $('creator-theme').title = txt(
        'Used when World appearance is set to Authored appearance in Settings.',
        'Використовується, коли в налаштуваннях оформлення світу вибрано «Авторське оформлення».',
      );
      spatialEditor.select(editorSelection ?? { kind: 'criterion', index: editorIndex });
      const model =
        (editingProject?.world.modelAsset
          ? projectAssets.get(editingProject.world.modelAsset)
          : null) ?? builtinWorldScene(source);
      if (model)
        void spatialEditor.loadScene(model).catch((error) => {
          if (active()) reportError(error);
        });
    };
    if (source.world?.themeProfile?.format !== 'ThemeProfile.v3') return apply(null);
    const controller = new AbortController();
    editorEnvironmentPreparation = controller;
    void restoreNativeIndustrialCourse(source, { signal: controller.signal })
      .then(apply)
      .catch((error) => {
        if (active() && !controller.signal.aborted) reportError(error);
      });
  }
  function moveSelection(c, ref, position) {
    if (ref.kind === 'criterion') {
      for (const mode of routeEditModes(c))
        if (c.steps[mode][ref.index])
          c.steps[mode][ref.index] = moveCriterion(c.steps[mode][ref.index], position);
    } else if (ref.kind === 'actor') {
      const actor = c.actors.find((a) => a.id === ref.id);
      if (!actor) throw new Error('Actor is unavailable.');
      const delta = Object.fromEntries(
        coordinates.map((k) => [k, position[k] - actor.position[k]]),
      );
      actor.position = position;
      actor.path = actor.path.map((p) =>
        Object.fromEntries(coordinates.map((k) => [k, p[k] + delta[k]])),
      );
    }
  }
  function editorMode() {
    return editorScope === 'acro' ? 'acro' : 'self-level';
  }
  function matchingRoutes(course) {
    return canonicalWorldJSON(course.steps['self-level']) === canonicalWorldJSON(course.steps.acro);
  }
  function routeEditModes(course) {
    return editorScope === 'both' && matchingRoutes(course)
      ? ['self-level', 'acro']
      : [editorMode()];
  }
  const notebook = createFlightNotebook({
    courses: FLIGHT_COURSES,
    indexedDB: win.indexedDB,
    onStatus: (message) => {
      if (typeof message === 'string') status(message);
    },
  });
  const input = createFlightInput({
    window: win,
    document: doc,
    onPause: (reason) => {
      if (advancedPractice) {
        advancedPractice.pause();
        return;
      }
      pauseFlight(true, reason);
    },
  });
  const inputDiagnostics = createFlightInputDiagnostics({ now: () => win.performance.now() });
  input.touchResponse($('flight-touch-response').value);
  input.keyboardPreset($('flight-keyboard-preset').value);
  const gamepad = createFlightGamepad({
    window: win,
    document: doc,
    combatLayout: () => combatFeedback.combatDpad && Boolean(readFlightState()?.encounter),
  });
  const flightMenuOpen = () => $('flight-dialog').dataset.flightMenuOpen === 'true';
  function setFlightMenu(open) {
    if (open && playShell) {
      pauseFlight();
      if (flight) updateHUD(readFlightState());
      playShell.open('pause');
      return;
    }
    if (open) pauseFlight();
    $('flight-dialog').dataset.flightMenuOpen = String(open);
    if (!open) {
      $('flight-dialog').dataset.optionsOpen = 'false';
      $('flight-options').setAttribute('aria-expanded', 'false');
    }
    if (flight) updateHUD(readFlightState());
    (open ? $('world-flight-close-menu') : $('world-flight-resume')).focus({ preventScroll: true });
  }
  const gamepadHelp = () =>
    txt(
      'A / Cross: arm · Y / Triangle: reset · Menu / B: pause · R3: camera. Left stick: yaw and throttle adjustment; centre to hold throttle. Right stick / D-pad: tilt. LB/RB: yaw · LT/RT: less/more throttle · X/Square: fire. Steam Input: use a Gamepad layout.',
      'A / Cross: увімкнути · Y / Triangle: скинути · Menu / B: пауза · R3: камера. Лівий стік: поворот і зміна газу; центр утримує газ. Правий стік / D-pad: нахил. LB/RB: поворот · LT/RT: менше/більше газу · X/Square: вогонь. Steam Input: розкладка Gamepad.',
    );
  function gamepadScope() {
    if (
      !flight ||
      !$('flight-dialog').open ||
      replayProof ||
      combatReplaySource ||
      !sceneReady ||
      beginnerCoach.blocksArm() ||
      doc.visibilityState === 'hidden' ||
      (doc.hasFocus && !doc.hasFocus()) ||
      doc.querySelector('dialog[open]:not(#flight-dialog)') ||
      flightMenuOpen() ||
      $('flight-dialog').dataset.optionsOpen === 'true' ||
      $('flight-dialog').dataset.immersiveControls === 'true'
    )
      return 'blocked';
    if (readFlightState()?.status === 'active')
      return $('flight-source').value === 'controller' ? 'flight' : 'blocked';
    return ['paused', 'disarmed'].includes(readFlightState()?.status) &&
      ($('flight-source').value !== 'radio' || !radio.status().verified)
      ? 'ready'
      : 'blocked';
  }
  function readGamepad(now, scope = gamepadScope()) {
    let pads = [];
    try {
      pads = win.navigator.getGamepads?.() ?? [];
    } catch {
      /* Other controls remain usable. */
    }
    return gamepad.poll({
      gamepads: pads,
      now,
      scope,
      excludeIndex: radio.status().verified ? radio.status().selected?.index : null,
    });
  }
  function pollGamepad(now) {
    const sampled = readGamepad(now);
    for (const action of sampled.actions) {
      if (action === 'arm') {
        if ($('flight-source').value !== 'controller') {
          $('flight-source').value = 'controller';
          input.select('controller');
          savePreferences();
          paintLoadout();
        }
        $('world-arm').click();
      } else if (action === 'reset') {
        setFlightMenu(false);
        $('world-retry').click();
      } else if (['weaponA', 'weaponB', 'reload', 'payload', 'detonate'].includes(action))
        combatCommand(action);
      else if (action === 'camera') cameraControls?.cycle();
      else if (action === 'pause' || action === 'back') setFlightMenu(true);
    }
  }
  input.bindStick($('world-left-stick'), 'left');
  input.bindStick($('world-right-stick'), 'right');
  const radio = createRadioRuntime({
    now: () => win.performance.now(),
    getGamepads: () => win.navigator.getGamepads?.() ?? [],
    onCamera: () => cameraControls?.cycle(),
    onCombatAction: (action) => {
      if (!advancedPractice) combatCommand(action);
    },
    onFreeze: (reason) => {
      if (advancedPractice) {
        advancedPractice.pause(undefined, { notify: false });
        return;
      }
      if (reason === 'menu') setFlightMenu(true);
      else if (!replayProof && !combatReplaySource && $('flight-source').value === 'radio')
        pauseFlight(false);
    },
    onReset: () => {
      if (advancedPractice) {
        void advancedPractice.restart();
        return;
      }
      if (combatReplaySource) return;
      if (current)
        void startFlight(current, {
          ...retainedDraftOptions(),
          preview,
          playlist: playingPlaylist,
          index: playlistIndex,
          replayProof,
          checkpoint: checkpointRequest,
          demonstration: replayKind === 'demonstration',
        }).catch(reportError);
    },
  });
  const returnToLesson = button(txt('Return to practice', 'Повернутися до практики'), () => {
    const context = learningDemoReturn;
    if (context)
      return startFlight(context.entry, {
        mode: context.mode,
        recover: context.recover,
        lessonCamera: context.camera,
      });
  });
  returnToLesson.hidden = true;
  $('world-replay-controls').append(returnToLesson);
  $('world-viewport').dataset.simHudHost = 'worlds';
  const flightInstruments = mountFlightInstruments({
    container: $('world-viewport'),
    locale: () => locale,
  });
  const flightHud = mountFlightHud({
    container: $('world-viewport'),
    storage,
    locale: () => locale,
    onExplain() {
      pauseFlight();
      flightHud.openDetails();
      if (flight) updateHUD(readFlightState());
    },
    onLesson() {
      if (current?.beginner) beginnerCoach.showGuide();
    },
    onPreferencesChange() {
      if (flight) updateHUD(readFlightState());
    },
  });
  const hudPreferences = flightHud.preferenceControls($('sim-flight-controls'));
  const huntCaption = doc.querySelector('#world-viewport .reaction-live-caption');
  if (huntCaption) $('world-viewport').append(huntCaption);
  let practiceOwnsFullscreen = false;
  const beginnerCoach = mountBeginnerCoach({
    root: $('beginner-coach'),
    liveDisplay: false,
    window: win,
    locale: () => locale,
    onStart: () => {
      if (flight) updateHUD(readFlightState());
      $('world-arm').click();
    },
    onLessonMode: async (mode) => {
      if (!current?.beginner || !['self-level', 'acro'].includes(mode)) return;
      try {
        await changeFlightMode(mode);
      } catch (error) {
        reportError(error);
        throw error;
      }
    },
    onPause: () => pauseFlight(),
    onRetry: () => $('world-retry').click(),
    onNext: () => nextLearningFlight(),
    onExit: () => closeFlight(),
    onWatchDemonstration: ({ mode, step }) => {
      if (!current?.beginner) return;
      const entry = demonstrationEntry(current),
        proof = demonstrationFor(entry, mode);
      if (!proof) return;
      learningDemoReturn ??= {
        entry: current,
        mode: $('flight-mode').value,
        camera: $('flight-camera').value,
        recover:
          !preview && !replayProof && recorder?.ticks() && !terminal(readFlightState())
            ? recorder.export()
            : undefined,
      };
      const options = Number.isInteger(step)
        ? { checkpoint: { mode, index: step, proof, watch: true } }
        : { preview: true, replayProof: proof, demonstration: true };
      void startFlight(entry, { ...options, lessonDemo: true }).catch(reportError);
    },
    onRadio: () => $('radio-setup-button').click(),
    readRadioPreview: () => ({ ...radio.preview(), index: radio.status().selected?.index }),
    createLessonPreview: (lesson, mode, proof) =>
      createWorldFlight({
        course: lesson.course,
        mode,
        response: proof.response,
        unscoredPractice: true,
      }),
    onFullscreen: () => immersive.toggle(),
    onPracticeView: async (enabled) => {
      if (enabled) {
        practiceOwnsFullscreen = !immersive.active();
        if (practiceOwnsFullscreen) await immersive.enter();
      } else if (practiceOwnsFullscreen) {
        practiceOwnsFullscreen = false;
        await immersive.exit({ focus: false });
      }
    },
  });
  function nextLearningFlight() {
    const next = nextLearningEntry(current);
    if (next) return startFlight(next);
    return closeFlight();
  }
  function restoreLearningPreferences() {
    if (!learningPreferences) return;
    for (const [id, value] of Object.entries(learningPreferences)) $(id).value = value;
    if (learningResponse) response = learningResponse;
    learningResponse = null;
    learningPreferences = null;
    paintLoadout();
  }
  function restoreRadio() {
    if (
      $('world-radio-dialog').open ||
      ($('flight-source').value !== 'radio' &&
        !beginnerCoach.wantsRadioPreview?.() &&
        readFlightState()?.status === 'active')
    )
      return;
    // Read the current saved profile: Setup and another simulator page may have
    // saved it through their own store instance since this page was mounted.
    restoreVerifiedRadio(radio, createFlightProfileStore({ storage }), { storage });
  }
  function radioHelp(reason) {
    const messages = {
      unavailable: [
        'This browser cannot read USB gamepads. Try a browser with Gamepad support.',
        'Цей браузер не читає USB-пульти. Спробуйте браузер із підтримкою Gamepad.',
      ],
      'select-device': [
        'Move a radio stick to detect it, or open Setup to select a device.',
        'Рухніть стік пульта для виявлення або виберіть пристрій у налаштуваннях.',
      ],
      'mapping-incomplete': [
        'Open Setup to map and verify this radio.',
        'Відкрийте налаштування, призначте та перевірте канали пульта.',
      ],
      'verify-controls': [
        'Finish verifying the controls in Setup.',
        'Завершіть перевірку керування в налаштуваннях.',
      ],
      'device-lost': [
        'Radio disconnected. Reconnect, then deliberately arm again.',
        'Пульт від’єднано. Під’єднайте його та свідомо увімкніть знову.',
      ],
      'invalid-sample': [
        'Radio input is invalid. Check the device and calibration in Setup.',
        'Некоректний сигнал пульта. Перевірте пристрій і калібрування в налаштуваннях.',
      ],
      'arm-switch-off': [
        'Move the arm switch ON to start.',
        'Перемкніть озброєння в УВІМК, щоб почати.',
      ],
      'arm-off-first': [
        'Move the arm switch OFF, then ON.',
        'Перемкніть озброєння у ВИМК, а потім в УВІМК.',
      ],
      'throttle-high': ['Lower throttle before arming.', 'Перед увімкненням опустіть газ.'],
      'centre-controls': [
        'Centre roll, pitch and yaw before arming.',
        'Перед увімкненням центруйте крен, тангаж і рискання.',
      ],
      'pickup-controls': [
        'Match the paused stick positions, then arm again.',
        'Поверніть стіки в положення на момент паузи, потім увімкніть знову.',
      ],
      ready: [
        'Ready. Use the arm switch, or Arm / resume if no switch is assigned.',
        'Готово. Використайте перемикач або кнопку «Увімкнути», якщо перемикач не призначено.',
      ],
      active: ['Radio active.', 'Пульт керує польотом.'],
    };
    return txt(...(messages[reason] ?? messages.ready));
  }
  const radioFlightNotice = el('p', undefined, 'sim-radio-flight-notice');
  radioFlightNotice.setAttribute('role', 'status');
  radioFlightNotice.setAttribute('aria-live', 'polite');
  radioFlightNotice.hidden = true;
  $('world-viewport').append(radioFlightNotice);
  const radioFireHelp = el('p');
  radioFireHelp.dataset.radioFireHelp = '';
  radioFireHelp.setAttribute('role', 'status');
  radioFireHelp.hidden = true;
  const stickTraces = ['left', 'right'].map((side) =>
    mountStickTrace($(`world-${side}-stick`), { travel: 180 * 0.34 }),
  );
  const stickViews = ['left', 'right'].map((side) => ({
    node: $(`world-${side}-stick`),
    knob: $(`world-${side}-stick`).querySelector('i'),
    radius: 0,
    x: 0,
    y: 0,
  }));
  const positionStick = (view) => {
    view.knob.style.transform = `translate(${view.x * view.radius}px, ${-view.y * view.radius}px)`;
  };
  const measureSticks = () => {
    // Preserve native padding-box rounding; batch reads before either knob writes.
    const radii = stickViews.map((view) => view.node.clientWidth * 0.34);
    stickViews.forEach((view, index) => (view.radius = radii[index]));
  };
  const resizeSticks = () => {
    if (disposed) return;
    measureSticks();
    stickViews.forEach(positionStick);
  };
  const stickResize =
    typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(resizeSticks) : null;
  if (stickResize) {
    stickViews.forEach((view) => stickResize.observe(view.node));
    listeners.push(() => stickResize.disconnect());
  }
  let stickTraceLayout = '',
    stickSizeLayout = '';
  const paintText = (id, text) => {
    const node = $(id);
    if (node.textContent !== text) node.textContent = text;
  };
  function canFire(state) {
    return (
      !replayProof &&
      !combatReplaySource &&
      !state?.encounter?.outsideArea &&
      !state?.encounter?.geometryWaiting &&
      Boolean(
        state?.encounter ||
          (current &&
            !current.legacy &&
            !current.regional &&
            current.course?.actors?.some(
              (actor) => actor.type !== 'hazard' && (actor.role ?? 'hostile') === 'hostile',
            )),
      )
    );
  }
  function paintInput(state) {
    const source = replayProof || combatReplaySource ? 'recording' : $('flight-source').value,
      touchActive = source === 'touch',
      display =
        $('world-viewport').dataset.hudSettingSticks === 'on' &&
        $('flight-stick-display').value === 'setup'
          ? 'compact'
          : $('flight-stick-display').value,
      monitor = $('world-touch'),
      radioPreview =
        source === 'radio' || beginnerCoach.wantsRadioPreview?.() ? radio.preview() : null,
      unavailable = source === 'radio' && !radioPreview?.controls,
      controls =
        source === 'radio'
          ? (radioPreview?.controls ?? neutralFlightInput())
          : source === 'controller'
            ? gamepad.preview().controls
            : source === 'touch' && state?.status !== 'active'
              ? input.sample(0)
              : Object.fromEntries(
                  ['roll', 'pitch', 'yaw', 'throttle'].map((k) => [
                    k,
                    (state?.lastInput?.[k] ?? 0) / 1000,
                  ]),
                ),
      layout = STICK_LAYOUTS[source === 'radio' ? (radioPreview?.stickMode ?? 2) : 2],
      traceLayout = `${flightToken}:${source}:${layout.join(':')}`,
      reducedMotion =
        displayPreferences.snapshot().effectiveReducedEffects ||
        Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
      traceTime = win.performance.now();
    if (stickTraceLayout !== traceLayout) stickTraces.forEach((trace) => trace.reset());
    stickTraceLayout = traceLayout;
    monitor.hidden = display === 'setup' && !touchActive;
    monitor.classList.toggle('touch-active', touchActive);
    monitor.classList.toggle('compact-sticks', display === 'compact' && !touchActive);
    monitor.classList.toggle('input-unavailable', unavailable);
    const controlName = (key) =>
      ({
        roll: txt('Roll', 'Крен'),
        pitch: txt('Pitch', 'Тангаж'),
        yaw: txt('Yaw', 'Рискання'),
        throttle: txt('Throttle', 'Газ'),
      })[key];
    const sizeLayout = `${display}:${touchActive}`;
    if (!stickResize || stickSizeLayout !== sizeLayout) measureSticks();
    stickSizeLayout = sizeLayout;
    for (const [index, side] of ['left', 'right'].entries()) {
      const view = stickViews[index],
        node = view.node,
        horizontal = layout[index * 2],
        vertical = layout[index * 2 + 1],
        x = controls[horizontal],
        y = vertical === 'throttle' ? controls[vertical] * 2 - 1 : controls[vertical];
      paintStickDirections(node, { horizontal, vertical, locale });
      view.x = x;
      view.y = y;
      positionStick(view);
      stickTraces[index].update({
        x,
        y,
        now: traceTime,
        source,
        reducedMotion,
        available:
          !unavailable && !monitor.hidden && (state?.status === 'active' || source === 'radio'),
      });
      node.setAttribute(
        'aria-label',
        `${controlName(horizontal)} ${Math.round(x * 100)}%, ${controlName(vertical)} ${Math.round(controls[vertical] * 100)}%`,
      );
      paintText(`world-${side}-label`, `${controlName(horizontal)} / ${controlName(vertical)}`);
    }
    paintText(
      'world-touch-throttle',
      `${Math.round(controls.throttle * 100)}%${touchActive && $('world-left-stick').dataset.touchActive !== 'true' ? ` · ${txt('held', 'утримується')}` : ''}`,
    );
    const outsideEncounter = state?.encounter?.outsideArea;
    radioFlightNotice.hidden =
      source !== 'radio' || state?.status === 'active' || !sceneReady || beginnerCoach.blocksArm();
    const radioNotice = radioHelp(radio.status().reason);
    if (radioFlightNotice.textContent !== radioNotice) radioFlightNotice.textContent = radioNotice;
    const fireKey =
      keyboardFlightPreset($('flight-keyboard-preset').value).fire === 'Space'
        ? txt('Space', 'Пробіл')
        : 'F';
    const radioFireStatus = outsideEncounter
      ? txt(
          'Outside the combat area. Targets wait; weapons resume when you return.',
          'За межами бою. Цілі чекають; зброя запрацює після повернення.',
        )
      : state?.encounter?.geometryWaiting
        ? txt(
            'Combat terrain is loading. Weapons resume automatically when ready.',
            'Місцевість для бою завантажується. Зброя запрацює автоматично після підготовки.',
          )
        : !canFire(state)
          ? txt(
              'Choose a combat activity in Gameplay to use Fire against moving targets.',
              'Виберіть бойовий режим у вкладці «Гра», щоб стріляти по рухомих цілях.',
            )
          : !radio.status().fireBound
            ? txt(
                `Radio Fire is not assigned. Open Radio setup → Fire and assign an unused switch, then Save & return. You can also fire with ${fireKey}.`,
                `Вогонь на пульті не призначено. Відкрийте «Налаштування пульта» → «Вогонь», призначте вільний перемикач і збережіть. Також можна стріляти клавішею ${fireKey}.`,
              )
            : radio.status().fireReady
              ? txt(
                  'Fire is ready. Hold the assigned switch ON to shoot.',
                  'Вогонь готовий. Утримуйте призначений перемикач увімкненим, щоб стріляти.',
                )
              : txt(
                  'Fire is assigned. After arming or resuming, release Fire to OFF, then hold it ON to shoot.',
                  'Вогонь призначено. Після запуску або продовження відпустіть перемикач у положення OFF, потім утримуйте ON для стрільби.',
                );
    radioFireHelp.hidden = source !== 'radio';
    if (radioFireHelp.textContent !== radioFireStatus) radioFireHelp.textContent = radioFireStatus;
    paintText('world-fire', `${txt('Fire', 'Вогонь')} · ${fireKey}`);
    const status = $('world-input-status');
    const text =
      source === 'radio'
        ? `${txt('USB radio', 'USB-пульт')} · ${radioHelp(radio.status().reason)}${state?.encounter || canFire(state) ? ` · ${radioFireStatus}` : ''}`
        : source === 'controller'
          ? gamepadHelp()
          : source === 'recording'
            ? txt(
                'Recorded controls · live input does not affect playback.',
                'Записане керування · живий сигнал не змінює відтворення.',
              )
            : source === 'touch'
              ? txt(
                  'Touch controls · left: yaw/throttle, right: roll/pitch.',
                  'Сенсорне керування · ліворуч: рискання/газ, праворуч: крен/тангаж.',
                )
              : keyboardFlightHelp($('flight-keyboard-preset').value, locale, { actions: false });
    const pickup =
      source === 'radio' && checkpointSession && state?.status === 'paused'
        ? radio.status().pickup
        : null;
    const detail = pickup
      ? `${text} · ${txt('Match recorded controls', 'Сумістіть із записаним керуванням')}: ${['roll', 'pitch', 'yaw', 'throttle'].map((key) => `${controlName(key)} ${Math.round(pickup[key] * 100)}%`).join(' · ')}`
      : text;
    if (status.textContent !== detail) status.textContent = detail;
    status.dataset.source = source;
    monitor.dataset.source = source;
    paintDroneResponse(state, controls, { source, unavailable });
    paintCoach(state, radioPreview);
    paintText(
      'world-keys-hint',
      source === 'radio'
        ? txt(
            `Radio sticks control flight · P pauses · ${keyboardFlightPreset($('flight-keyboard-preset').value).fire === 'Space' ? 'Space' : 'F'} or Fire shoots.`,
            `Стіки пульта керують польотом · P — пауза · ${keyboardFlightPreset($('flight-keyboard-preset').value).fire === 'Space' ? 'Пробіл' : 'F'} або «Вогонь» — постріл.`,
          )
        : source === 'controller'
          ? gamepadHelp()
          : source === 'touch'
            ? txt(
                'Drag the sticks to fly · use Pause and Fire below.',
                'Рухайте стіки для польоту · кнопки «Пауза» та «Вогонь» — нижче.',
              )
            : source === 'recording'
              ? txt(
                  'The sticks show recorded commands. Pause, slow down or switch views to study them.',
                  'Стіки показують записані команди. Зупиняйте, сповільнюйте або змінюйте камеру, щоб їх роздивитися.',
                )
              : keyboardFlightHelp($('flight-keyboard-preset').value, locale, { combat: true }),
    );
    $('flight-stick-display').setAttribute(
      'aria-label',
      txt('Stick display', 'Відображення стіків'),
    );
  }
  function paintCoach(state, radioPreview = radio.preview()) {
    const guide = beginnerCoach.blocksArm();
    $('world-viewport').dataset.simHudGuide = String(guide);
    if (guide) $('flight-dialog').dataset.simHudActive = 'false';
    const source = replayProof || combatReplaySource ? 'recording' : $('flight-source').value;
    const unavailable = source === 'radio' && !radioPreview?.controls;
    const controls =
      source === 'radio'
        ? radioPreview?.controls
        : Object.fromEntries(
            ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [
              key,
              (state?.lastInput?.[key] ?? 0) / 1000,
            ]),
          );
    if (current?.beginner && (!checkpointSession || checkpointRequest?.watch))
      beginnerCoach.update({
        state,
        source,
        stickMode: radioPreview?.stickMode ?? 2,
        monitor: source === 'radio' && unavailable ? neutralFlightInput() : controls,
        monitorAvailable: !(source === 'radio' && unavailable),
        radioMonitor: radioPreview?.controls,
        radioAvailable: Boolean(radioPreview?.verified),
        radioIndex: radio.status().selected?.index,
        radioStickMode: radioPreview?.stickMode ?? 2,
        mode: $('flight-mode').value,
        touchResponse: $('flight-touch-response').value,
        keyboardPreset: $('flight-keyboard-preset').value,
        modePractice,
        reducedMotion:
          displayPreferences.snapshot().effectiveReducedEffects ||
          Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
      });
  }
  function paintDroneResponse(state, controls, { source, unavailable }) {
    droneResponse.update({
      state,
      controls,
      source,
      unavailable,
      locale,
      display:
        $('world-viewport').dataset.hudSettingDrone === 'on' &&
        $('flight-drone-guide').value === 'off'
          ? 'compact'
          : $('flight-drone-guide').value,
      scale: $('flight-guide-scale').value,
      mode: $('flight-mode').value,
      guideOpen: beginnerCoach.blocksArm(),
      reducedMotion:
        displayPreferences.snapshot().effectiveReducedEffects ||
        Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    });
  }
  const droneResponse = mountDroneResponse({
    root: $('flight-drone-response'),
    window: win,
    onHide: () => {
      $('flight-drone-guide').value = 'off';
      savePreferences();
      paintInput(readFlightState());
    },
  });
  const hangar = mountDroneHangar({
    button: $('inspect-drone'),
    dialog: $('drone-hangar'),
    canvas: $('drone-hangar-canvas'),
    selector: $('drone-look'),
    onOpen: () => pauseFlight(),
    window: win,
    getPresentation: () => appearanceControls.resolve().appearance,
    getCourse: () => current?.sourceCourse ?? current?.course ?? {},
    getQuality: () => $('flight-quality').value,
  });
  const actorContainer = el('section');
  actorContainer.id = 'world-actor-editor';
  $('creator-json').closest('details').before(actorContainer);
  actorEditor = mountActorEditor({
    container: actorContainer,
    getCourse: () => editor,
    onChange: async (mutator) => {
      const source = editor;
      await initWorldRuntime();
      if (editor !== source)
        throw new Error(
          txt(
            'The editor changed. Review the current challenge before applying.',
            'Редактор змінився. Перегляньте поточне завдання перед застосуванням.',
          ),
        );
      return applyEdit(mutator, { nativePursuitAdmission: true });
    },
    locale: () => locale,
  });

  const routeGuideContainer = el('section');
  actorContainer.after(routeGuideContainer);
  routeGuideEditor = mountWorldRouteGuideEditor({
    document: doc,
    container: routeGuideContainer,
    locale: () => locale,
    idFactory: unique,
    onError: reportError,
    onPreview(route) {
      ensureSpatialEditor();
      spatialEditor?.setRouteGuide(route);
    },
    onChange(bundle) {
      if (!editingProject || !projectOwnsCourse(editor))
        throw new Error(
          txt(
            'Create a project copy before authoring a route.',
            'Створіть копію проєкту перед редагуванням маршруту.',
          ),
        );
      undo.push(editorSnapshot());
      if (undo.length > 40) undo.shift();
      redo = [];
      editingProject.routeGuides = [
        ...(editingProject.routeGuides ?? []).filter((entry) => entry.courseId !== bundle.courseId),
        clone(bundle),
      ];
      syncProject(false);
      // Keep this editor's accepted draft and preview intact while updating export/undo controls.
      $('undo-edit').disabled = !undo.length;
      $('redo-edit').disabled = true;
    },
  });

  const encounterEditorContainer = el('section');
  encounterEditorContainer.id = 'world-encounter-editor';
  actorContainer.after(encounterEditorContainer);
  let encounterEditor = null,
    encounterEditorIdentity = null,
    encounterEditorSource = null,
    encounterEditorReady = false;
  function savedEncounterBundle(identity) {
    try {
      const raw = storage?.getItem(`revealline.fpv.encounter-studio.v1:${identity}`);
      return raw
        ? validateEncounterStudioBundle(JSON.parse(raw), { baseIdentity: identity })
        : null;
    } catch {
      return null;
    }
  }
  function refreshEncounterEditor() {
    if (!editor || !encounterEditorReady) return;
    const identity = dataIdentity(editor);
    if (encounterEditor && encounterEditorIdentity === identity) return encounterEditor.refresh();
    const source = `${editingProject?.id ?? 'standalone'}:${editor.id}`;
    let retainedBundle = null;
    if (encounterEditor && encounterEditorSource === source) {
      try {
        retainedBundle = encounterEditor.exportBundle();
      } catch {
        /* A map without an admitted companion has no edits to carry. */
      }
    }
    encounterEditor?.dispose();
    encounterEditorIdentity = identity;
    encounterEditorSource = source;
    const geometry = createNativeEncounterGeometry(editor);
    encounterEditor = mountEncounterEditor({
      container: encounterEditorContainer,
      getCourse: () => editor,
      getBaseIdentity: () => dataIdentity(editor),
      bundle: savedEncounterBundle(identity) ?? retainedBundle,
      locale: () => locale,
      admitActor: geometry.admitActor,
      admitServicePad: geometry.admitServicePad,
      onChange: () => {
        queueMicrotask(() => {
          try {
            if (encounterEditorIdentity === identity)
              storage?.setItem(
                `revealline.fpv.encounter-studio.v1:${identity}`,
                JSON.stringify(encounterEditor.exportBundle()),
              );
          } catch {
            encounterEditorContainer.append(
              el(
                'p',
                txt(
                  'Storage unavailable. Export the companion to keep your edits.',
                  'Сховище недоступне. Експортуйте сценарій, щоб зберегти зміни.',
                ),
              ),
            );
          }
        });
      },
      onPreview: async ({
        definition,
        actorId,
        destruction,
        weapon = 'autocannon',
        outcome = 'localized',
      }) => {
        const actor = definition.actors.find((value) => value.id === actorId);
        if (!actor) return;
        const dialog = el('dialog'),
          canvas = el('canvas');
        canvas.width = 900;
        canvas.height = 540;
        canvas.style.cssText = 'width:min(80vw,900px);height:60vh;display:block';
        const previewBody = el('div'),
          previewToolbar = el('div'),
          previewInfo = el('p'),
          timeline = el('input'),
          contacts = el('input');
        previewBody.style.cssText = 'position:relative';
        const contactOverlay = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        contactOverlay.setAttribute('viewBox', '0 0 900 540');
        contactOverlay.setAttribute('preserveAspectRatio', 'none');
        contactOverlay.style.cssText =
          'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
        previewBody.append(canvas, contactOverlay);
        timeline.type = 'range';
        timeline.min = '0';
        timeline.max = '12';
        timeline.step = '0.02';
        timeline.value = '0';
        timeline.setAttribute(
          'aria-label',
          txt('Effect timeline in seconds', 'Час ефекту в секундах'),
        );
        contacts.type = 'checkbox';
        const contactLabel = el('label');
        contactLabel.append(contacts, el('span', txt('Show contacts', 'Показати контакти')));
        const playButton = button(txt('Pause', 'Пауза'), () => {
          playing = !playing;
          playButton.textContent = playing ? txt('Pause', 'Пауза') : txt('Play', 'Відтворити');
        });
        const restartButton = button(txt('Restart', 'Почати спочатку'), () => seek(0));
        previewToolbar.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap';
        previewToolbar.append(playButton, restartButton, timeline, contactLabel);
        dialog.append(
          el('h2', txt('Destruction preview', 'Перегляд руйнування')),
          previewBody,
          previewToolbar,
          previewInfo,
          button(txt('Close', 'Закрити'), () => dialog.close()),
        );
        doc.body.append(dialog);
        dialog.showModal();
        let view = null,
          animation = null,
          tick = 0,
          closed = false,
          playing = true,
          timeSeconds = 0,
          lastFrame = null;
        let seek = () => {};
        const closePreview = () => {
          if (closed) return;
          closed = true;
          if (animation !== null) win.cancelAnimationFrame(animation);
          view?.dispose();
          dialog.remove();
        };
        dialog.addEventListener('close', closePreview, { once: true });
        const runId = 'studio-preview';
        try {
          view = rendererFactory({ canvas, window: win });
          view.setCourse(encounterPhysicsCourse(editor), 'self-level');
          view.configureCombatPresentation({
            createPresentation: createCombatPresentation,
            createActors: createCombatActorPresentation,
            preferences: () => ({
              ...huntPresentationControls.preferences.snapshot(),
              ...destruction,
            }),
            detail: 'ultra',
          });
          view.setCombatActors([], { runId, tick: 0 });
          view.observeCombat(
            [
              {
                eventId: 'preview-1',
                type: 'defeat',
                weapon,
                outcome,
                severity: outcome === 'explosive' ? 1.6 : outcome === 'breakup' ? 0.9 : 0.25,
                sourceId: actorId,
                spawnId: 'preview-1',
                actor: actorId,
                position: actor.position,
                normal: { x: 0, y: 1, z: 0 },
                velocity: { x: 1800, y: 1200, z: 500 },
                tick: 0,
                material: actor.material,
                radius: actor.radius,
                height: actor.height,
                appearance: { ...actor.appearance, family: actor.family, type: actor.type },
              },
            ],
            { runId, tick: 0 },
          );
          await applyCombatArt(view, () => !closed && !disposed);
          if (closed || disposed) {
            closePreview();
            return;
          }
          await view.prepare();
          if (closed || disposed) {
            closePreview();
            return;
          }
          const previewFact = view.exportCombatPresentation().records[0];
          seek = (seconds) => {
            timeSeconds = Math.max(0, Math.min(12, seconds));
            view.resetCombatPresentation(runId, { preserveAppearance: true });
            view.observeCombat([{ ...previewFact, type: 'defeat', presentation: null }], {
              runId,
              tick: 0,
            });
            lastFrame = null;
          };
          timeline.addEventListener('input', () => {
            playing = false;
            playButton.textContent = txt('Play', 'Відтворити');
            seek(Number(timeline.value));
          });
          const render = () => {
            if (closed || disposed) {
              closePreview();
              return;
            }
            const now = win.performance.now();
            if (playing && lastFrame !== null)
              timeSeconds = Math.min(12, timeSeconds + Math.min(0.1, (now - lastFrame) / 1000));
            lastFrame = now;
            tick = Math.floor(timeSeconds * 50);
            timeline.value = String(timeSeconds);
            if (timeSeconds >= 12) {
              playing = false;
              playButton.textContent = txt('Play', 'Відтворити');
            }
            view.setCombatActors([], { runId, tick });
            view.draw(
              {
                position: {
                  ...actor.position,
                  y: actor.position.y + 800,
                  z: actor.position.z + 4500,
                },
                orientation: [0, 0, 0, 1000000],
                velocity: { x: 0, y: 0, z: 0 },
                actors: [],
                projectiles: [],
                status: 'active',
                ticks: tick,
                step: 0,
              },
              { cameraMode: 'fpv', cameraFov: 65, cameraTilt: 0 },
            );
            const resources = view.resources().combat;
            previewInfo.textContent = `${weapon} · ${outcome} · ${timeSeconds.toFixed(2)} s · ${resources?.moving ?? 0} ${txt('moving', 'рухаються')} · ${resources?.settled ?? 0} ${txt('settled', 'осіли')} · ${resources?.pendingFragments ?? 0} ${txt('waiting for surface', 'очікують поверхню')}`;
            contactOverlay.replaceChildren();
            if (contacts.checked)
              for (const record of view.exportCombatPresentation()?.records ?? []) {
                for (const piece of Object.values(record.presentation?.pieces ?? {}))
                  if (piece.surface) {
                    const surface = piece.surface,
                      p = view.projectCombatPoint(surface.position),
                      q = view.projectCombatPoint({
                        x: surface.position.x + surface.normal.x * 500,
                        y: surface.position.y + surface.normal.y * 500,
                        z: surface.position.z + surface.normal.z * 500,
                      });
                    if (!p || !q) continue;
                    const line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
                    for (const [key, value] of Object.entries({
                      x1: p.x * 900,
                      y1: p.y * 540,
                      x2: q.x * 900,
                      y2: q.y * 540,
                      stroke: '#64ffe3',
                      'stroke-width': 3,
                    }))
                      line.setAttribute(key, String(value));
                    contactOverlay.append(line);
                  }
              }
            animation = win.requestAnimationFrame(render);
          };
          render();
        } catch (error) {
          const wasClosed = closed;
          closePreview();
          if (!wasClosed && !disposed) throw error;
        }
      },
    });
    const priorDispose = encounterEditor.dispose;
    encounterEditor.dispose = () => {
      priorDispose();
      geometry.dispose();
    };
  }
  void initWorldRuntime()
    .then(() => {
      encounterEditorReady = true;
      refreshEncounterEditor();
    })
    .catch(reportError);
  function completedKeys() {
    const complete = new Set(
      records
        .filter(
          (r) =>
            r.status === 'verified' &&
            r.diagnostic === 'complete' &&
            r.proof.session === 'practice',
        )
        .map((r) => `${r.packIdentity}:${r.course.id}`),
    );
    for (const key of sessionLearningComplete.keys()) complete.add(key);
    for (const attempt of notebook.snapshot().attempts) {
      const entry = catalogue.find((e) => e.legacy && e.id === attempt.course);
      if (entry) complete.add(keyOf(entry));
    }
    return complete;
  }
  function renderSchool() {
    const complete = completedKeys();
    const done = primaryLearning.filter((entry) => complete.has(keyOf(entry)));
    const optionalDone = SELF_LEVEL_LESSON_ORDER.filter((id) =>
      complete.has(keyOf(learningEntries.get(id))),
    ).length;
    $('school-progress-title').textContent = txt(
      `${done.length} of ${primaryLearning.length} Acro lessons complete`,
      `Виконано ${done.length} із ${primaryLearning.length} уроків Acro`,
    );
    $('school-progress-copy').textContent = txt(
      `Acro is your main course · ${optionalDone}/${SELF_LEVEL_LESSON_ORDER.length} optional self-level lessons complete`,
      `Acro — ваш основний курс · виконано ${optionalDone}/${SELF_LEVEL_LESSON_ORDER.length} додаткових уроків самовирівнювання`,
    );
    $('school-progress').max = primaryLearning.length;
    $('school-progress').value = done.length;
    $('school-progress').setAttribute(
      'aria-label',
      txt('Flight School progress', 'Поступ у льотній школі'),
    );
    const next = primaryLearning.find((entry) => !complete.has(keyOf(entry))) ?? primaryLearning[0];
    $('school-continue').textContent =
      done.length === 0
        ? txt('Begin lesson 01', 'Почати урок 01')
        : done.length === primaryLearning.length
          ? txt('Fly the course again', 'Пройти курс знову')
          : txt(`Continue · ${label(next)}`, `Продовжити · ${label(next)}`);
    $('school-lessons').replaceChildren();
    presentation.refresh($('learn'));
  }
  function renderFilters() {
    if ($('creator-theme'))
      for (const option of $('creator-theme').options)
        option.textContent =
          creatorThemeLabel(THEME_PROFILES.find((t) => t.id === option.value)) || option.value;
    $('theme-tabs').replaceChildren();
    for (const item of [
      { id: 'all', title: { en: 'All worlds', uk: 'Усі світи' } },
      ...WORLD_THEMES,
      ...(installed.length ? [{ id: 'custom', title: { en: 'My worlds', uk: 'Мої світи' } }] : []),
    ]) {
      const b = button(localized(item.title), () => {
        theme = item.id;
        renderFilters();
        renderCatalogue();
      });
      b.classList.toggle('selected', theme === item.id);
      $('theme-tabs').append(b);
    }
    const selected = $('activity-filter').value || 'all';
    $('activity-filter').replaceChildren(new Option(txt('All activities', 'Усі вправи'), 'all'));
    for (const [id, name] of Object.entries(ACTIVITY_NAMES))
      $('activity-filter').append(new Option(localized(name), id));
    $('activity-filter').value = selected;
    const template = $('creator-template').value;
    $('creator-template').replaceChildren();
    for (const entry of catalogue.filter((e) => !e.archived))
      $('creator-template').append(new Option(label(entry), keyOf(entry)));
    if (template) $('creator-template').value = template;
  }
  function catalogueActivity(entry) {
    if (entry.activity) return entry.activity;
    let activity = null;
    for (const step of entry.course.steps[$('flight-mode').value]) {
      if (step.type === 'hold' || step.type === 'land') continue;
      if (step.type !== 'actor-track-v1') return null;
      const kind = step.minTargetTravel > 0 ? 'follow' : 'observe';
      if (activity && activity !== kind) return null;
      activity = kind;
    }
    return activity;
  }
  function catalogueDetails(entry) {
    const name =
      localized(ACTIVITY_NAMES[catalogueActivity(entry)]) ||
      txt('Authored challenge', 'Авторське завдання');
    return entry.activity
      ? `${name} · ${COPY_UK[entry.difficulty] && locale === 'uk' ? COPY_UK[entry.difficulty] : entry.difficulty} · ${entry.duration ?? 3} ${txt('min', 'хв')}`
      : name;
  }
  function filteredCatalogue(complete = completedKeys()) {
    const search = $('search').value.trim().toLocaleLowerCase(),
      activity = $('activity-filter').value,
      difficulty = $('difficulty-filter').value,
      progress = $('completion-filter').value;
    return catalogue.filter(
      (e) =>
        !e.archived &&
        (!courseClassFilter || courseClassFilter.matches(e.course)) &&
        (theme === 'all' || e.theme === theme) &&
        (activity === 'all' || catalogueActivity(e) === activity) &&
        (difficulty === 'all' || e.difficulty === difficulty) &&
        (progress === 'all' || complete.has(keyOf(e)) === (progress === 'complete')) &&
        `${label(e)} ${localized(FLIGHT_WORLDS.find((w) => w.id === e.world)?.title)} ${e.course.environment}`
          .toLocaleLowerCase()
          .includes(search),
    );
  }
  function includesRandomLevel(isLearning, context = randomContext) {
    return randomLevelChoice === 'mixed' || isLearning === (context === 'learning');
  }
  function paintRandomLevels() {
    if (!randomLevelControl) return;
    const { label, select, automatic, mixed } = randomLevelControl;
    label.textContent = txt('Random levels', 'Випадкові рівні');
    automatic.textContent =
      randomContext === 'learning'
        ? txt('Learning levels only', 'Лише навчальні рівні')
        : txt('Flight levels only', 'Лише рівні польоту');
    mixed.textContent = txt('Learning + flight levels', 'Навчання + польоти');
    select.value = randomLevelChoice;
  }
  function randomFlightCandidates(worldId) {
    return filteredCatalogue().filter(
      (entry) =>
        (!worldId || entry.world === worldId) &&
        includesRandomLevel(Boolean(entry.beginner), current?.beginner ? 'learning' : 'flight'),
    );
  }
  async function startRandomFlight(worldId) {
    await ready;
    if (!worldId && missionChooser) {
      openMissionChooser(current?.beginner ? 'learn' : 'explore');
      return missionChooser.playRandom();
    }
    if (disposed) return;
    const candidates = randomFlightCandidates(worldId),
      alternatives = candidates.filter((entry) => keyOf(entry) !== lastCatalogueFlightKey),
      pool = alternatives.length ? alternatives : candidates;
    if (!pool.length) {
      status(txt('No challenges match these filters.', 'Немає завдань за цими фільтрами.'));
      return;
    }
    const entry = pool[Math.floor(Math.random() * pool.length)];
    lastCatalogueFlightKey = keyOf(entry);
    // Selection never supplies a simulation seed or bypasses scene preparation/arming.
    return startFlight(entry, { mode: $('flight-mode').value });
  }
  function randomFlightControl(worldId, next = false) {
    const candidates = randomFlightCandidates(worldId),
      entry = candidates[0] ?? catalogue.find((item) => !item.archived && item.world === worldId),
      title =
        localized(FLIGHT_WORLDS.find((world) => world.id === worldId)?.title) ||
        installed.find((pack) => pack.id === entry?.projectId)?.project.title ||
        worldId,
      row = el('div', undefined, next ? 'button-row' : 'challenge-row'),
      info = el('div', undefined, 'challenge-info'),
      action = button(
        next
          ? txt('Random next flight', 'Випадковий наступний політ')
          : txt('Random flight', 'Випадковий політ'),
        () => startRandomFlight(worldId),
        'primary',
      );
    action.dataset.randomFlight = next ? 'next' : 'catalogue';
    action.disabled = candidates.length === 0;
    if (title) action.setAttribute('aria-label', `${action.textContent}: ${title}`);
    info.append(
      el(
        'strong',
        title
          ? `${txt('This world', 'Цей світ')}: ${title}`
          : txt('No matching world', 'Немає відповідного світу'),
      ),
      el(
        'small',
        candidates.length === 0
          ? txt(
              'No matching flights. Change your filters.',
              'Немає відповідних польотів. Змініть фільтри.',
            )
          : candidates.length === 1
            ? txt(
                'Only one flight matches your filters.',
                'Лише один політ відповідає вашим фільтрам.',
              )
            : txt(
                `${candidates.length} filtered flights. No immediate repeats.`,
                `Польотів за фільтрами: ${candidates.length}. Без повторення поспіль.`,
              ),
      ),
    );
    row.append(info, action);
    return row;
  }
  function missionCampaign(entry) {
    const lesson = learningById.get(entry.id);
    if (lesson) {
      const tier = [
        ['beginner', ACRO_LESSON_ORDER],
        ['experienced', EXPERIENCED_LESSON_ORDER],
        ['advanced', ADVANCED_LESSON_ORDER],
        ['pro', PRO_LESSON_ORDER],
        ['master', MASTER_LESSON_ORDER],
        ['self-level', SELF_LEVEL_LESSON_ORDER],
      ].find(([, ids]) => ids.includes(entry.id));
      const names = {
        beginner: txt('Beginner', 'Початковий'),
        experienced: txt('Experienced', 'Для досвідчених'),
        advanced: txt('Advanced', 'Поглиблений'),
        pro: 'Pro',
        master: 'Master',
        'self-level': txt('Optional self-level', 'Додаткове самовирівнювання'),
      };
      return {
        key: `school:${tier[0]}`,
        title: `${txt('Flight School', 'Льотна школа')} · ${names[tier[0]]}`,
      };
    }
    const world = FLIGHT_WORLDS.find((world) => world.id === entry.world);
    return {
      key: entry.world,
      title: world
        ? localized(world.title)
        : (installed.find((pack) => pack.id === entry.projectId)?.project.title ?? entry.world),
    };
  }
  // Kept as the pre-unification renderer for the no-library bootstrap path.
  // Once the shared chooser exists, renderCatalogue below owns the one live
  // mission surface rather than leaving duplicate world and school cards.
  function renderLegacyCatalogue() {
    renderSchool();
    const complete = completedKeys(),
      filtered = filteredCatalogue(complete);
    $('world-grid').replaceChildren();
    $('level-count').textContent = catalogue.filter((e) => !e.archived).length;
    const worldCount = doc.querySelectorAll('.catalogue-stats strong')[1];
    if (worldCount)
      worldCount.textContent = new Set(
        catalogue.filter((e) => !e.archived).map((e) => e.world),
      ).size;
    $('empty-library').hidden = filtered.length > 0;
    const groups = new Map();
    for (const entry of filtered) {
      if (!groups.has(entry.world)) groups.set(entry.world, []);
      groups.get(entry.world).push(entry);
    }
    const shelf = el('div', undefined, 'world-shelf');
    shelf.setAttribute('aria-label', txt('Choose a world', 'Виберіть світ'));
    if (!groups.has(selectedWorld)) selectedWorld = groups.keys().next().value ?? null;
    for (const [id, group] of groups) {
      const world = FLIGHT_WORLDS.find((w) => w.id === id);
      const choice = button(
        '',
        () => {
          selectedWorld = id;
          renderCatalogue();
          const restored = [...$('world-grid').querySelectorAll('[data-world]')].find(
            (n) => n.dataset.world === id,
          );
          restored?.focus({ preventScroll: true });
          if (win.innerWidth < 900)
            $('world-grid').querySelector('.world-card')?.scrollIntoView({ block: 'start' });
        },
        'world-choice',
      );
      choice.dataset.world = id;
      choice.setAttribute('aria-pressed', String(id === selectedWorld));
      choice.setAttribute('aria-controls', 'selected-world-challenges');
      const map = el('div', undefined, 'world-mini-map');
      map.setAttribute('aria-hidden', 'true');
      const thumbnail = routeThumbnail(
        doc,
        group[0].course,
        appearanceControls.resolve().appearance,
      );
      map.style.background = thumbnail.style.backgroundColor;
      map.append(thumbnail);
      const copy = el('span', undefined, 'world-choice-copy');
      copy.append(
        el(
          'strong',
          world
            ? localized(world.title)
            : (installed.find((p) => p.id === group[0].projectId)?.project.title ?? id),
        ),
        el(
          'small',
          `${group.length} ${txt('flights', 'польотів')} · ${group.filter((e) => complete.has(keyOf(e))).length} ✓`,
        ),
      );
      choice.append(map, copy);
      shelf.append(choice);
    }
    $('world-grid').append(shelf);
    if (!groups.size) $('world-grid').append(randomFlightControl(null));
    for (const [id, group] of groups) {
      if (id !== selectedWorld) continue;

      const world = FLIGHT_WORLDS.find((w) => w.id === id),
        card = el('article', undefined, 'world-card'),
        cover = el('div', undefined, 'world-cover');
      card.id = 'selected-world-challenges';
      const thumbnail = routeThumbnail(
        doc,
        group[0].course,
        appearanceControls.resolve().appearance,
      );
      cover.style.background = thumbnail.style.backgroundColor;
      cover.append(thumbnail);
      const title = el('div', undefined, 'cover-title');
      title.append(
        el(
          'strong',
          world
            ? localized(world.title)
            : (installed.find((p) => p.id === group[0].projectId)?.project.title ?? id),
        ),
        el(
          'span',
          world ? localized(world.subtitle) : txt('Your authored world', 'Ваш власний світ'),
        ),
      );
      cover.append(
        title,
        el(
          'span',
          localized(WORLD_THEMES.find((t) => t.id === group[0].theme)?.title) ||
            txt('Custom world', 'Власний світ'),
          'world-tag',
        ),
      );
      card.append(cover);
      const rows = el('div', undefined, 'challenge-list');
      rows.append(randomFlightControl(id));
      group.forEach((entry, i) => {
        const row = el('div', undefined, 'challenge-row'),
          info = el('div', undefined, 'challenge-info');
        info.append(
          el('strong', `${complete.has(keyOf(entry)) ? '✓ ' : ''}${label(entry)}`),
          el('small', catalogueDetails(entry)),
        );
        if (demonstrationFor(entry, $('flight-mode').value)) {
          const watch = button(
            txt('Watch example', 'Переглянути приклад'),
            () => watchDemonstration(entry),
            'watch-example',
          );
          watch.setAttribute(
            'aria-label',
            `${txt('Watch demonstration', 'Переглянути демонстрацію')}: ${label(entry)}`,
          );
          info.append(watch);
        }
        if (worldEnemyGuide(entry.course, { mode: $('flight-mode').value }).rows.length) {
          const inspect = button(txt('Preview targets', 'Переглянути цілі'), (event) =>
            enemyGuide.open(entry.course, {
              mode: $('flight-mode').value,
              trigger: event.currentTarget,
            }),
          );
          inspect.dataset.enemyGuideCourse = entry.id;
          inspect.setAttribute('aria-controls', enemyGuide.dialog.id);
          inspect.setAttribute(
            'aria-label',
            `${txt('Preview targets', 'Переглянути цілі')}: ${label(entry)}`,
          );
          info.append(inspect);
        }
        const fly = button(txt('Fly', 'Летіти'), () => startFlight(entry));
        fly.setAttribute('aria-label', `${txt('Fly', 'Летіти')}: ${label(entry)}`);
        const add = button(
          '+',
          () => {
            if (entries.length >= 128)
              throw new Error(
                txt('A playlist supports up to 128 entries.', 'Добірка підтримує до 128 завдань.'),
              );
            entries.push({ packIdentity: entry.packIdentity, levelId: entry.id });
            renderPlaylist();
            status(txt('Added to your playlist.', 'Додано до добірки.'));
          },
          'add-challenge',
        );
        add.setAttribute(
          'aria-label',
          `${txt('Add to playlist', 'Додати до добірки')}: ${label(entry)}`,
        );
        row.append(el('span', String(i + 1).padStart(2, '0'), 'challenge-no'), info, fly, add);
        rows.append(row);
      });
      card.append(rows);
      card.append(
        button(txt('Free flight', 'Вільний політ'), () => {
          const source = canonicalFreeFlightEntry(catalogue, id);
          if (!source) return;
          const course = clone(source.course);
          course.format = 'FlightCourse.v2';
          delete course.pursuit;
          course.id = unique('freeflight');
          for (const language of ['en', 'uk'])
            course.locales[language].title =
              `${language === 'uk' ? 'Вільний політ' : 'Free flight'} · ${world?.title?.[language] ?? source.world}`;
          course.world ??= {
            id: source.world,
            theme: source.theme,
            style: world?.style ?? 'hangar',
          };
          course.actors = [];
          course.rules = { ...course.rules, maxTicks: 36000 };
          course.conditions ??= { profile: 'clear', revision: 'r1' };
          course.steps = {
            'self-level': [{ type: 'survive', ticks: 36000 }],
            acro: [{ type: 'survive', ticks: 36000 }],
          };
          return startFlight(
            {
              ...source,
              id: course.id,
              freeFlight: true,
              course: validateWorldCourse(course),
              legacy: false,
              beginner: undefined,
            },
            { preview: true },
          );
        }),
      );
      $('world-grid').append(card);
    }
    if (missionLibrary) {
      const libraryGroups = new Map();
      for (const entry of catalogue.filter(
        (entry) =>
          !entry.archived &&
          !downloadedCourseOffered(entry) &&
          (!courseClassFilter || courseClassFilter.matches(entry.course)),
      )) {
        const id = entry.projectId ? `worlds:${entry.packIdentity}` : 'worlds:builtin';
        if (!libraryGroups.has(id)) libraryGroups.set(id, []);
        libraryGroups.get(id).push(entry);
      }
      for (const old of new Set(missionLibrary.missions.map((row) => row.ownerId)))
        if (
          (old === 'worlds:builtin' || old.startsWith('worlds:fpv-pack:')) &&
          !libraryGroups.has(old)
        )
          missionLibrary.remove(old);
      const complete = completedKeys();
      for (const [id, missions] of libraryGroups) {
        const positions = new Map(),
          sizes = new Map();
        for (const entry of missions) {
          const key = missionCampaign(entry).key;
          positions.set(entry, sizes.get(key) ?? 0);
          sizes.set(key, (sizes.get(key) ?? 0) + 1);
        }
        missionLibrary.register({
          id,
          editionId: id,
          edition: 'FPV SIM · Worlds',
          collection: id === 'worlds:builtin' ? 'Classic' : 'Custom',
          entries: missions,
          describe: (entry) => ({
            id: keyOf(entry),
            revision: entry.course.revision ?? '',
            campaignKey: missionCampaign(entry).key,
            campaignTitle: missionCampaign(entry).title,
            name: label(entry),
            levelIndex: positions.get(entry),
            ...(!entry.projectId
              ? {
                  canonicalLevelKey: `sim-worlds:${keyOf(entry)}`,
                  globalLevelNumber:
                    [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].findIndex(
                      (candidate) => keyOf(candidate) === keyOf(entry),
                    ) + 1,
                }
              : {}),
            campaignLevelCount: sizes.get(missionCampaign(entry).key),
            modes: ['solo'],
            tags: ['FPV', 'Practice'],
            hook: entry.course.locales[locale]?.brief ?? entry.course.locales.en.brief,
            rules: catalogueDetails(entry),
          }),
          availability: () => ({ state: 'ready' }),
          card: (entry) => entry.course,
          progressState: (entry) => ({
            state: complete.has(keyOf(entry)) ? 'completed' : 'new',
            bestStars: null,
          }),
          launch: (entry, { isCurrent }) => startFlight(entry, { isCurrent }),
        });
      }
      missionChooser?.refresh();
    }
    presentation.refresh();
  }
  function renderCatalogue() {
    paintRandomLevels();
    renderSchool();
    $('world-grid').replaceChildren();
    $('level-count').textContent = catalogue.filter((entry) => !entry.archived).length;
    const count = doc.querySelectorAll('.catalogue-stats strong')[1];
    if (count)
      count.textContent = new Set(
        catalogue.filter((entry) => !entry.archived).map((entry) => entry.world),
      ).size;
    if (!missionLibrary) return renderLegacyCatalogue();

    const groups = new Map();
    for (const entry of catalogue.filter(
      (entry) =>
        !entry.archived &&
        !downloadedCourseOffered(entry) &&
        (!courseClassFilter || courseClassFilter.matches(entry.course)),
    )) {
      const id = entry.projectId ? `worlds:${entry.packIdentity}` : 'worlds:builtin';
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(entry);
    }
    for (const old of new Set(missionLibrary.missions.map((row) => row.ownerId)))
      if ((old === 'worlds:builtin' || old.startsWith('worlds:fpv-pack:')) && !groups.has(old))
        missionLibrary.remove(old);
    const complete = completedKeys();
    for (const [id, missions] of groups) {
      const positions = new Map(),
        sizes = new Map();
      for (const entry of missions) {
        const key = missionCampaign(entry).key;
        positions.set(entry, sizes.get(key) ?? 0);
        sizes.set(key, (sizes.get(key) ?? 0) + 1);
      }
      missionLibrary.register({
        id,
        editionId: id,
        edition: 'FPV SIM · Worlds',
        collection: id === 'worlds:builtin' ? 'Classic' : 'Custom',
        entries: missions,
        describe: (entry) => ({
          id: keyOf(entry),
          revision: entry.course.revision ?? '',
          campaignKey: missionCampaign(entry).key,
          campaignTitle: missionCampaign(entry).title,
          name: label(entry),
          levelIndex: positions.get(entry),
          ...(!entry.projectId
            ? {
                canonicalLevelKey: `sim-worlds:${keyOf(entry)}`,
                globalLevelNumber:
                  [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].findIndex(
                    (candidate) => keyOf(candidate) === keyOf(entry),
                  ) + 1,
              }
            : {}),
          campaignLevelCount: sizes.get(missionCampaign(entry).key),
          modes: ['solo'],
          tags: ['FPV', 'Practice'],
          hook: entry.course.locales[locale]?.brief ?? entry.course.locales.en.brief,
          rules: catalogueDetails(entry),
        }),
        availability: () => ({ state: 'ready' }),
        card: (entry) => entry.course,
        progressState: (entry) => ({
          state: complete.has(keyOf(entry)) ? 'completed' : 'new',
          bestStars: null,
        }),
        launch: (entry, { isCurrent }) => startFlight(entry, { isCurrent }),
      });
    }
    missionChooser.refresh();
    presentation.refresh();
  }
  function openMissionChooser(section = 'explore') {
    if (!missionChooser) return;
    randomContext = section === 'learn' ? 'learning' : 'flight';
    paintRandomLevels();
    missionLaunchGeneration++;
    pauseFlight();
    missionChooser.open();
    worldLibrary.deactivate();
    regionalLibrary.deactivate();
    worldCatalogueHost.hidden = true;
    // One chooser owns selection; download browsers remain in Content & Offline.
    void regionalLibrary.refreshMissions().catch(() => {});
    void worldLibrary.refreshMissions().catch(() => {});
    syncDownloadMissions();
    if (section === 'learn') {
      const complete = completedKeys();
      const next =
        primaryLearning.find((entry) => !complete.has(keyOf(entry))) ?? primaryLearning[0];
      const row = missionLibrary.missions.find((row) => row.runtimeId === keyOf(next));
      if (row) missionChooser.reveal(row.id);
    }
  }
  function playlistValue() {
    const title = $('playlist-title').value.trim();
    if (
      playlistDraft &&
      localized(playlistDraft.title) === title &&
      JSON.stringify(playlistDraft.entries) === JSON.stringify(entries)
    )
      return clone(playlistDraft);
    playlistDraft = validatePlaylist({
      format: 'FPVPlaylist.v1',
      id: playlistId,
      revision: unique('r'),
      title: playlistDraft ? { ...playlistDraft.title, [locale]: title } : { en: title, uk: title },
      entries: clone(entries),
    });
    return clone(playlistDraft);
  }
  function loadPlaylist(p) {
    entries = clone(p.entries);
    playlistId = p.id;
    playlistDraft = clone(p);
    $('playlist-title').value = localized(p.title);
    renderPlaylist();
    showTab('playlists');
  }
  function renderPlaylist() {
    $('playlist-entries').replaceChildren();
    $('playlist-empty').hidden = entries.length > 0;
    $('play-playlist').disabled = !entries.length;
    entries.forEach((ref, i) => {
      const entry = catalogue.find(
          (e) => e.id === ref.levelId && e.packIdentity === ref.packIdentity,
        ),
        row = el('li', undefined, 'playlist-item');
      row.append(
        el(
          'span',
          entry
            ? label(entry)
            : `${txt('Missing pack', 'Відсутній пакунок')}: ${ref.levelId} (${ref.packIdentity})`,
        ),
      );
      if (!entry) row.append(dependencyGuidance(ref.packIdentity));
      for (const [text, delta] of [
        ['↑', -1],
        ['↓', 1],
      ]) {
        const b = button(text, () => {
          [entries[i], entries[i + delta]] = [entries[i + delta], entries[i]];
          renderPlaylist();
        });
        b.disabled = i + delta < 0 || i + delta >= entries.length;
        b.setAttribute('aria-label', txt('Move challenge', 'Перемістити завдання'));
        row.append(b);
      }
      row.append(
        button('×', () => {
          entries.splice(i, 1);
          renderPlaylist();
        }),
      );
      $('playlist-entries').append(row);
    });
    $('saved-playlists').replaceChildren();
    let saved = [],
      bookmark = null;
    try {
      const snapshot = playlistStore.snapshot();
      saved = snapshot.playlists;
      bookmark = snapshot.bookmark;
    } catch (error) {
      reportError(error);
    }
    const resumable = bookmark
      ? [...saved, ...CURATED_PLAYLISTS].find(
          (p) => p.id === bookmark.id && p.revision === bookmark.revision,
        )
      : null;
    if (resumable && bookmark.nextIndex < resumable.entries.length) {
      const next = resumable.entries[bookmark.nextIndex],
        resume = button(
          `${txt('Continue', 'Продовжити')}: ${localized(resumable.title)} · ${bookmark.nextIndex + 1}/${resumable.entries.length}`,
          () => flySequence(resumable, bookmark.nextIndex),
        );
      resume.disabled = !dependencyAvailable(next.packIdentity, next.levelId);
      $('saved-playlists').append(resume);
      if (resume.disabled) $('saved-playlists').append(dependencyGuidance(next.packIdentity));
    }
    for (const p of [...CURATED_PLAYLISTS, ...saved]) {
      const tile = el('div', undefined, 'playlist-tile'),
        name = el('div', localized(p.title));
      name.append(
        el('small', `${p.entries.length} ${txt('challenges', 'завдань')} · ${p.revision}`),
      );
      tile.append(
        name,
        button(txt('Open', 'Відкрити'), () => loadPlaylist(p)),
      );
      const missing = p.entries.filter(
        (ref) => !dependencyAvailable(ref.packIdentity, ref.levelId),
      );
      if (missing.length)
        tile.append(
          el(
            'small',
            txt(
              `${missing.length} entries need exact packs. Open this playlist to restore them.`,
              `${missing.length} завдань потребують точних пакунків. Відкрийте добірку, щоб відновити їх.`,
            ),
          ),
        );
      if (saved.includes(p))
        tile.append(
          button('×', () => {
            playlistStore.remove(p.id, p.revision);
            renderPlaylist();
          }),
        );
      $('saved-playlists').append(tile);
    }
  }
  async function flySequence(p, index = 0) {
    const list = resolvePlaylist(p, catalogue),
      ref = list[index];
    if (!ref?.course) {
      loadPlaylist(p);
      status(
        txt(
          'This pinned challenge is unavailable. Install its exact world pack to continue.',
          'Це завдання недоступне. Встановіть його точний пакунок світу.',
        ),
      );
      return;
    }
    try {
      playlistStore.save(p);
      playlistStore.bookmark(p.id, p.revision, index);
    } catch (error) {
      reportError(error);
    }
    await startFlight(ref.course, { playlist: p, index });
  }

  const editorFieldValues = () =>
    JSON.stringify(
      [
        'creator-title',
        'creator-json',
        'creator-theme',
        ...coordinates.map((k) => `criterion-${k}`),
      ].map((id) => $(id)?.value),
    );
  const projectOwnsCourse = (course) =>
    editingProject &&
    (editingProject.courses.some((c) => c.id === course.id && c.world.id === course.world.id) ||
      (!editingProject.courses.length && course.world.id === editingProject.world.id));
  function paintCoursePicker() {
    let row = $('editor-project-course-row');
    if (!row) {
      row = el('div');
      row.id = 'editor-project-course-row';
      const label = el('label'),
        choice = el('select'),
        reset = button('', () => {
          actorEditor?.discardPendingChanges();
          refreshEditor();
        });
      choice.id = 'editor-project-course';
      reset.id = 'editor-reset-fields';
      label.append(el('span'), choice);
      row.append(label, reset);
      $('creator-title').closest('label').before(row);
      listeners.push(() => row.remove());
      on(choice, 'change', () => {
        const id = choice.value;
        choice.value = editor?.id ?? '';
        if (id === editor?.id) return;
        if (editorFieldValues() !== editorFields || actorEditor?.hasPendingChanges()) {
          status(
            txt(
              'Apply your pending fields or reset them before changing challenge. Your edits are kept.',
              'Застосуйте або скиньте незастосовані поля перед зміною завдання. Ваші зміни збережено.',
            ),
          );
          return;
        }
        const target = editingProject?.courses.find((c) => c.id === id);
        if (!target) throw new Error(txt('Challenge unavailable.', 'Завдання недоступне.'));
        const next = validateWorldCourse(target);
        courseScopes.set(editor.id, editorScope);
        setEditor(next, { scope: courseScopes.get(id) });
        actorEditor?.select(null);
        status(
          txt(
            'Applied edits are kept. Switching challenge starts a new Undo history.',
            'Застосовані зміни збережено. Після зміни завдання починається нова історія скасування.',
          ),
        );
      });
    }
    if (courseScopeProject !== editingProject) {
      courseScopeProject = editingProject;
      courseScopes.clear();
    }
    row.hidden = !editingProject || editingProject.courses.length < 2;
    const choice = $('editor-project-course');
    choice.previousElementSibling.textContent = txt('Project challenge', 'Завдання проєкту');
    choice.replaceChildren(
      ...(editingProject?.courses ?? []).map(
        (course) => new Option(`${course.locales[locale].title} · ${course.id}`, course.id),
      ),
    );
    choice.value = editor?.id ?? '';
    $('editor-reset-fields').textContent = txt(
      'Reset unapplied fields',
      'Скинути незастосовані поля',
    );
  }
  function refreshEditor(updateScene = true) {
    $('undo-edit').disabled = !undo.length;
    $('redo-edit').disabled = !redo.length;
    if (!editor) return;
    const matching = matchingRoutes(editor);
    if (editorScope === 'both' && !matching) editorScope = 'self-level';
    let choice = $('editor-route-mode');
    if (!choice) {
      const label = el('label');
      choice = el('select');
      choice.id = 'editor-route-mode';
      label.append(el('span'), choice);
      $('criterion-list').closest('label').before(label);
      listeners.push(() => label.remove());
      on(choice, 'change', () => {
        editorScope = choice.value;
        editorIndex = 0;
        editorSelection = { kind: 'criterion', index: 0 };
        refreshEditor();
        actorEditor?.selectObjective(editorMode(), editorIndex);
      });
    }
    choice.previousElementSibling.textContent = txt('Route mode', 'Режим маршруту');
    choice.replaceChildren(
      new Option(txt('Both matching modes', 'Обидва однакові режими'), 'both'),
      new Option(txt('Self-level', 'Самовирівнювання'), 'self-level'),
      new Option('Acro', 'acro'),
    );
    choice.options[0].disabled = !matching;
    choice.disabled = editor.world.themeProfile?.format === 'ThemeProfile.v3';
    choice.title = choice.disabled
      ? txt(
          'This retained appearance belongs to its recorded flight mode. Choose a creator theme or create a copy to edit either route.',
          'Це збережене оформлення належить записаному режиму польоту. Виберіть авторську тему або створіть копію, щоб редагувати будь-який маршрут.',
        )
      : '';
    choice.value = editorScope;
    const mode = editorMode();
    $('creator-title').value = editor.locales[locale].title;
    $('creator-json').value = JSON.stringify(editor, null, 2);
    if ($('creator-theme')) $('creator-theme').value = editor.world.theme;
    $('criterion-list').replaceChildren();
    editor.steps[mode].forEach((step, i) =>
      $('criterion-list').append(
        new Option(
          `${i + 1}. ${stepName(step)}${step.targets ? ` · ${step.targets.length}` : ''}`,
          String(i),
        ),
      ),
    );
    editorIndex = Math.max(0, Math.min(editorIndex, editor.steps[mode].length - 1));
    for (const actor of editor.actors)
      $('criterion-list').append(
        new Option(`${txt('Actor', 'Персонаж')}: ${actor.id}`, `actor:${actor.id}`),
      );
    $('criterion-list').value = String(editorIndex);
    let scope = $('criterion-mode-scope');
    if (!scope) {
      scope = el('p', undefined, 'hint');
      scope.id = 'criterion-mode-scope';
      $('criterion-list').closest('label').after(scope);
    }
    scope.textContent =
      routeEditModes(editor).length === 2
        ? txt('Route edits: both matching modes', 'Зміни маршруту: обидва однакові режими')
        : txt(
            `Route edits: ${mode === 'acro' ? 'Acro' : 'Self-level'} only. Shared source anchors stay unchanged.`,
            `Зміни маршруту: лише ${mode === 'acro' ? 'Acro' : 'самовирівнювання'}. Спільні маркери джерела не змінюються.`,
          );
    const actor =
      editorSelection?.kind === 'actor'
        ? editor.actors.find((a) => a.id === editorSelection.id)
        : null;
    if (actor) $('criterion-list').value = `actor:${actor.id}`;
    const p = actor?.position ?? criterionCentre(editor.steps[mode][editorIndex]);
    for (const k of coordinates) {
      $(`criterion-${k}`).value = p ? p[k] / 1000 : '';
      $(`criterion-${k}`).disabled = !p;
    }
    $('move-criterion').disabled = !p;
    $('criterion-y').max = String(editor.bounds.max.y / 1000);
    for (const id of ['duplicate-criterion', 'remove-criterion', 'criterion-up', 'criterion-down'])
      $(id).disabled =
        Boolean(actor) ||
        ['actor-track-v1', 'hunt-contact-v1'].includes(editor.steps[mode][editorIndex]?.type);
    if (!actor && editor.steps[mode][editorIndex]?.type === 'actor-track-v1')
      scope.textContent += txt(
        '. Edit this objective in Follow & observe below.',
        '. Редагуйте це завдання нижче в розділі «Супровід і спостереження».',
      );
    if (!actor && editor.steps[mode][editorIndex]?.type === 'hunt-contact-v1')
      scope.textContent += txt(
        '. Edit this objective in Contact Hunt below.',
        '. Редагуйте це завдання нижче в розділі «Контактне полювання».',
      );
    if (updateScene) refreshEditorScene();
    actorEditor?.refresh();
    refreshEncounterEditor();
    routeGuideEditor?.update({
      course: editor,
      guides: editingProject?.routeGuides?.find((bundle) => bundle.courseId === editor.id) ?? null,
      mode: editorMode(),
      objectiveIndex: editorIndex,
    });
    editorFields = editorFieldValues();
    paintCoursePicker();
  }
  function syncProject(comparePositions = true, previousBindings = null) {
    if (editor && projectOwnsCourse(editor)) {
      const previous = editingProject.courses.find((c) => c.id === editor.id),
        routes = editingProject.routeBindings?.[editor.id],
        bindings = routes?.['self-level'];
      // One source anchor cannot encode two independent mode positions. Keep
      // single-mode changes local; shared edits need matching anchor identities.
      if (
        comparePositions &&
        previous &&
        bindings &&
        routeEditModes(editor).length === 2 &&
        matchingRoutes(previous)
      ) {
        for (const [i, anchorId] of bindings.entries()) {
          const oldIndex = previousBindings?.['self-level']
              ? previousBindings['self-level'].indexOf(anchorId)
              : i,
            oldAcroIndex = previousBindings?.acro ? previousBindings.acro.indexOf(anchorId) : i;
          if (!anchorId || routes.acro?.[i] !== anchorId || oldAcroIndex !== oldIndex) continue;
          const before = criterionCentre(previous.steps['self-level'][oldIndex]),
            after = criterionCentre(editor.steps['self-level'][i]),
            source = editingProject.source.anchors.find((a) => a.id === anchorId);
          if (!source || !before || !after || coordinates.every((k) => before[k] === after[k]))
            continue;
          const old = editingProject.overrides[anchorId]?.position ?? source.position,
            position = Object.fromEntries(
              coordinates.map((k) => [k, old[k] + (after[k] - before[k]) / 1000]),
            );
          if (coordinates.every((k) => Math.abs(position[k] - source.position[k]) < 0.00001)) {
            if (editingProject.overrides[anchorId])
              delete editingProject.overrides[anchorId].position;
            if (!Object.keys(editingProject.overrides[anchorId] ?? {}).length)
              delete editingProject.overrides[anchorId];
          } else
            editingProject.overrides[anchorId] = {
              ...editingProject.overrides[anchorId],
              position,
            };
        }
      }
      if (editingProject.courses.length < 2) editingProject.title = editor.locales[locale].title;
      const index = editingProject.courses.findIndex((c) => c.id === editor.id);
      if (index < 0) editingProject.courses.push(clone(editor));
      else editingProject.courses[index] = clone(editor);
      synchronizeDefinitions(editingProject);
      editor = clone(editingProject.courses.find((c) => c.id === editor.id));
    }
  }
  const editorSnapshot = () => ({
    course: clone(editor),
    scope: editorScope,
    index: editorIndex,
    selection: clone(editorSelection),
    bindings: clone(editingProject?.routeBindings?.[editor.id] ?? null),
    overrides: clone(editingProject?.overrides ?? {}),
    routeGuides: clone(editingProject?.routeGuides ?? []),
  });
  function applyEdit(change, { nativePursuitAdmission = false, detachIndustrial = false } = {}) {
    if (!editor)
      throw new Error(txt('Create a challenge copy first.', 'Спочатку створіть копію завдання.'));
    const before = editorSnapshot(),
      next = clone(editor),
      bindings = clone(before.bindings);
    let valid;
    try {
      change(next, bindings);
      valid = validateWorldCourse(next);
      assertNativeIndustrialEdit(before.course, valid, { detach: detachIndustrial });
      if (nativePursuitAdmission && valid.pursuit) {
        const admitted = createWorldFlight({ course: valid, mode: 'acro' });
        admitted.dispose();
      }
      if (valid.id !== editor.id || valid.world.id !== editor.world.id)
        throw new Error(
          txt(
            'Keep the challenge and world IDs stable. Use Create a copy for a new identity.',
            'Зберігайте ID завдання та світу. Для нової версії використайте «Створити копію».',
          ),
        );
    } catch (error) {
      editorIndex = before.index;
      editorSelection = before.selection;
      throw error;
    }
    undo.push(before);
    if (undo.length > 40) undo.shift();
    redo = [];
    editor = valid;
    if (editingProject && bindings) editingProject.routeBindings[editor.id] = bindings;
    syncProject(true, before.bindings);
    refreshEditor();
  }
  function setEditor(course, { scope } = {}) {
    editor = validateWorldCourse(course);
    editorScope = scope ?? (matchingRoutes(editor) ? 'both' : 'self-level');
    editorIndex = 0;
    editorSelection = null;
    undo = [];
    redo = [];
    refreshEditor();
  }
  async function cloneChallenge(entry) {
    $('creator-template').value = keyOf(entry);
    const full = entry.projectId
      ? await worldStore?.get(entry.projectId, {
          sha256: entry.packIdentity.replace('fpv-pack:', ''),
        })
      : null;
    const c = detachNativeIndustrialCourse(entry.course);
    c.format = c.pursuit ? 'FlightCourse.v3' : 'FlightCourse.v2';
    c.id = unique('custom');
    c.revision = 'r1';
    c.world ??= {
      id: entry.world,
      theme: entry.theme,
      style: FLIGHT_WORLDS.find((w) => w.id === entry.world)?.style ?? 'hangar',
    };
    c.actors ??= [];
    c.rules ??= {};
    c.conditions ??= { profile: 'clear', revision: 'r1' };
    const projectId = unique('studio');
    c.world.id = projectId;
    editingProject = {
      format: 'FPVWorldProject.v1',
      id: projectId,
      title: c.locales[locale].title,
      world: { id: projectId, title: c.locales[locale].title },
      source: { hash: null, anchors: [], colliders: [] },
      overrides: {},
      courses: [],
      themes: [],
      campaigns: [],
      playlists: [],
      provenance: [],
    };
    projectAssets = new Map();
    projectGeneration = null;
    if (full) {
      if (full.project.world.modelAsset)
        editingProject.world.modelAsset = full.project.world.modelAsset;
      editingProject.source = clone(full.project.source);
      editingProject.overrides = clone(full.project.overrides);
      editingProject.provenance = clone(full.project.provenance);
      projectAssets = new Map(full.assets);
      const copiedRoutes = full.project.routeGuides?.find((bundle) => bundle.courseId === entry.id);
      if (copiedRoutes) editingProject.routeGuides = [{ ...clone(copiedRoutes), courseId: c.id }];
      if (full.project.routeBindings?.[entry.id])
        editingProject.routeBindings = { [c.id]: clone(full.project.routeBindings[entry.id]) };
    }
    for (const l of ['en', 'uk']) c.locales[l].title += l === 'uk' ? ' — копія' : ' — copy';
    setEditor(c);
    syncProject();
    updateImportControls();
  }
  function customEntry(course) {
    return {
      id: course.id,
      course,
      world: course.world.id,
      theme: projectOwnsCourse(course) ? 'custom' : course.world.theme,
      packIdentity: 'authoring',
      legacy: false,
      projectId: projectOwnsCourse(course) ? editingProject.id : undefined,
    };
  }

  async function refreshStorage() {
    if (disposed) return;
    if (worldStore) {
      installed = await worldStore.list();
      if (disposed) return;
      revisions = await worldStore.list({ includeRevisions: true });
      if (disposed) return;
      catalogue = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE];
      for (const record of revisions) {
        try {
          for (const source of record.project.courses) {
            const course = validateWorldCourse(source);
            catalogue.push({
              ...customEntry(course),
              theme: 'custom',
              archived: record.active === false,
              projectId: record.id,
              packIdentity: `fpv-pack:${record.sha256}`,
            });
          }
        } catch (error) {
          reportError(new Error(`${record.id}: ${error.message}`));
        }
      }
    }
    if (recordStore) records = await recordStore.list();
    if (disposed) return;
    demonstrationCache = new WeakMap();
    let recoveryError = null;
    if (recordStore) {
      try {
        recovery = await recordStore.session();
      } catch (error) {
        recoveryError = error;
      }
    }
    if (disposed) return;
    worldLibrary.refresh(revisions);
    renderFilters();
    renderCatalogue();
    renderPlaylist();
    renderPacks();
    if (recoveryError) throw recoveryError;
  }
  function dependencyAvailable(packIdentity, courseId) {
    return catalogue.some((entry) => entry.packIdentity === packIdentity && entry.id === courseId);
  }
  function dependencyGuidance(packIdentity) {
    const group = el('div', undefined, 'proof-row');
    group.dataset.requiredPack = packIdentity;
    group.style.overflowWrap = 'anywhere';
    group.append(
      el('small', txt(`Required revision: ${packIdentity}`, `Потрібна версія: ${packIdentity}`)),
    );
    if (/^fpv-pack:[a-f0-9]{64}$/.test(packIdentity)) {
      const restore = button(txt('Install required pack', 'Встановити потрібний пакунок'), () => {
        restorePackIdentity = packIdentity;
        restorePackInput.value = '';
        restorePackInput.click();
      });
      restore.dataset.restorePack = packIdentity;
      restore.disabled = !worldStore;
      group.append(restore);
    } else {
      group.append(
        el(
          'small',
          txt(
            'This built-in content needs a compatible simulator version. Keep the recording and its full dependency identity.',
            'Для цього вбудованого вмісту потрібна сумісна версія симулятора. Збережіть запис і повний ідентифікатор залежності.',
          ),
        ),
      );
    }
    return group;
  }
  const restorePackInput = el('input');
  restorePackInput.id = 'restore-pack-input';
  restorePackInput.type = 'file';
  restorePackInput.accept = '.rlpack';
  restorePackInput.hidden = true;
  doc.body.append(restorePackInput);
  async function installExactPack(file, requiredIdentity = null, download = null) {
    if (!worldStore)
      throw new Error(txt('World storage is unavailable.', 'Сховище світів недоступне.'));
    const generation = download ? download.generation : await worldStore.generation(),
      loaded = await inspectPack(file);
    for (const course of loaded.project.courses) validateWorldCourse(course);
    await validateNativeIndustrialCourses(loaded.project.courses, { signal: download?.signal });
    if (
      (requiredIdentity && requiredIdentity !== `fpv-pack:${loaded.sha256}`) ||
      (download &&
        (loaded.project.id !== download.row.id ||
          loaded.project.courses.length !== download.row.courses))
    )
      throw new Error(
        txt(
          `This is a different revision. Nothing was installed. Required: ${requiredIdentity}`,
          `Це інша версія. Нічого не встановлено. Потрібна: ${requiredIdentity}`,
        ),
      );
    if (disposed || !restorePackInput.isConnected) return;
    download?.signal.throwIfAborted();
    download?.commit();
    // Install the inspected bytes' identity. Repacking through Creator can change
    // source metadata and silently break references to the original revision.
    await worldStore.install({ ...loaded, expectedGeneration: generation });
    download?.saved();
    if (disposed || !restorePackInput.isConnected) return;
    await refreshStorage();
    status(
      txt(
        'Exact pack installed. Your draft is unchanged. Resume, verify a record, or continue a playlist when ready.',
        'Точний пакунок встановлено. Чернетка не змінилася. Можна відновити політ, перевірити запис або продовжити добірку.',
      ),
    );
  }
  async function flyInstalledWorld(record) {
    // Launch the verified installed revision, never a same-name replacement.
    const entry = catalogue.find(
      (candidate) =>
        candidate.projectId === record.id && candidate.packIdentity === `fpv-pack:${record.sha256}`,
    );
    if (!entry)
      throw new Error(
        txt(
          'This world is no longer installed. Refresh the Library.',
          'Цей світ більше не встановлено. Оновіть бібліотеку.',
        ),
      );
    await startFlight(entry, { paused: true });
  }
  const worldLibrary = mountWorldLibrary({
    el,
    txt,
    parent: $('installed-packs'),
    initialRows: WORLD_LIBRARY_CATALOGUE,
    onChange: () => syncDownloadMissions(),
    begin: () => {
      if (!worldStore)
        throw new Error(txt('Device storage is unavailable.', 'Сховище пристрою недоступне.'));
      return worldStore.generation();
    },
    fly: flyInstalledWorld,
    install: (bytes, row, options) =>
      installExactPack(bytes, `fpv-pack:${row.sha256}`, { ...options, row }),
  });
  const regionalLibrary = mountRegionalLibrary({
    onChange: () => syncDownloadMissions(),
    el,
    txt,
    parent: $('installed-packs'),
    window: win,
    fly: (configuration, record, { isCurrent }) => {
      const generation = ++missionLaunchGeneration;
      return startRegionalFlight(
        regionalLibraryEntry(configuration, {
          sha256: record.sha256,
          descriptor: record.descriptor,
        }),
        {
          canAdopt: isCurrent,
          isCurrent: () => !doc.hidden && generation === missionLaunchGeneration,
        },
      );
    },
  });
  let downloadMissionSignature = '';
  const downloadedEntry = ({ row, index, level }) =>
    catalogue.find(
      (entry) =>
        entry.packIdentity === `fpv-pack:${row.sha256}` &&
        (level
          ? entry.id === level.id
          : entry.id ===
            revisions.find((pack) => pack.sha256 === row.sha256)?.project.courses[index]?.id),
    );
  function downloadedCourseOffered(entry) {
    return (
      entry.projectId &&
      worldLibrary
        .missions()
        .some(
          (mission) =>
            entry.packIdentity === `fpv-pack:${mission.row.sha256}` &&
            (!mission.level || mission.level.id === entry.id),
        )
    );
  }
  function syncDownloadMissions() {
    if (!missionLibrary || disposed) return;
    const worlds = worldLibrary.missions(),
      regions = regionalLibrary.missions();
    const hashOf = (row) => row.saved?.sha256 ?? row.pin.sha256;
    const signature = JSON.stringify([
      worlds.map(({ row, index }) => [row.sha256, index]),
      regions.map((row) => [row.id, hashOf(row)]),
      locale,
    ]);
    // Do not replace an owner while its exact download is being prepared.
    if (signature === downloadMissionSignature) {
      missionChooser?.refresh();
      return;
    }
    downloadMissionSignature = signature;
    const packTitle = (row) => row.title[locale === 'uk' ? 1 : 0];
    const worldName = (mission) => {
      const installed = downloadedEntry(mission);
      return installed
        ? label(installed)
        : (mission.level?.title[locale === 'uk' ? 1 : 0] ??
            `${packTitle(mission.row)} · ${txt('Level', 'Рівень')} ${mission.index + 1}`);
    };
    missionLibrary.register({
      id: 'worlds:downloads',
      editionId: 'worlds:downloads',
      edition: 'FPV SIM · Worlds',
      collection: 'Custom',
      entries: worlds,
      describe: (mission) => ({
        id: `${mission.row.sha256}:${mission.index}`,
        campaignKey: mission.row.id,
        campaignTitle: packTitle(mission.row),
        name: worldName(mission),
        revision: mission.row.revision,
        levelIndex: mission.index,
        campaignLevelCount: mission.row.courses,
        modes: ['solo'],
        tags: ['FPV', 'Practice'],
        hook: txt(
          'Download once and fly this route. Starts disarmed.',
          'Завантажте один раз і літайте маршрутом. Старт із вимкненими двигунами.',
        ),
      }),
      presentation: (mission) => ({
        name: worldName(mission),
        campaignTitle: packTitle(mission.row),
      }),
      availability: (mission) =>
        downloadedEntry(mission)
          ? { state: 'ready' }
          : { state: 'download', bytes: mission.row.bytes },
      prepare: (mission, options) => worldLibrary.prepareMission(mission.row, options),
      card: (mission) => downloadedEntry(mission)?.course ?? null,
      progressState: (mission) => ({
        state: completedKeys().has(downloadedEntry(mission) && keyOf(downloadedEntry(mission)))
          ? 'completed'
          : 'new',
        bestStars: null,
      }),
      launch: (mission, { isCurrent }) => {
        const entry = downloadedEntry(mission);
        if (!entry)
          throw new Error(
            txt('This route is no longer installed.', 'Цей маршрут більше не встановлено.'),
          );
        return startFlight(entry, { isCurrent });
      },
    });
    missionLibrary.register({
      id: 'worlds:regions',
      editionId: 'worlds:regions',
      edition: 'FPV SIM · Maps',
      collection: 'Custom',
      entries: regions,
      describe: (row) => ({
        id: `${row.id}:${hashOf(row)}`,
        campaignKey: row.familyKey,
        campaignTitle: localized(row.familyTitle),
        name: localized(row.title),
        revision: hashOf(row),
        levelIndex: regions.filter((other) => other.familyKey === row.familyKey).indexOf(row),
        campaignLevelCount: regions.filter((other) => other.familyKey === row.familyKey).length,
        modes: ['solo'],
        tags: ['FPV', 'Practice'],
        hook:
          localized(row.description) ||
          txt('Regional free flight · unscored', 'Вільний політ у регіоні · без заліку'),
      }),
      presentation: (row) => ({
        name: localized(row.title),
        campaignTitle: localized(row.familyTitle),
        hook:
          localized(row.description) ||
          txt('Regional free flight · unscored', 'Вільний політ у регіоні · без заліку'),
      }),
      availability: (row) =>
        regionalLibrary.isInstalled(row)
          ? { state: 'ready' }
          : row.pin
            ? { state: 'download', bytes: row.bytes }
            : {
                state: 'unavailable',
                reason: txt(
                  'Saved scenery could not be verified. Open Content & Offline to manage this version.',
                  'Не вдалося перевірити збережену місцевість. Відкрийте «Вміст і офлайн» для керування цією версією.',
                ),
              },
      prepare: (row, options) => regionalLibrary.prepareMission(row, options),
      card: () => null,
      async launch(row, { isCurrent = () => true }) {
        const generation = missionLaunchGeneration;
        const { configuration, record } = await regionalLibrary.loadMission(row);
        if (disposed || !isCurrent() || generation !== missionLaunchGeneration) return;
        return startRegionalFlight(
          regionalLibraryEntry(configuration, {
            sha256: record.sha256,
            descriptor: record.descriptor,
          }),
          {
            canAdopt: isCurrent,
            isCurrent: () => !disposed && !doc.hidden && generation === missionLaunchGeneration,
          },
        );
      },
    });
    missionChooser?.refresh();
  }
  on(restorePackInput, 'change', async (event) => {
    const file = event.target.files[0],
      required = restorePackIdentity;
    restorePackIdentity = null;
    try {
      if (file && required) await installExactPack(file, required);
    } finally {
      event.target.value = '';
    }
  });
  async function exportPackRevision(
    id,
    sha256,
    isCurrent = () => !disposed && restorePackInput.isConnected,
  ) {
    const full = await worldStore.get(id, { sha256 });
    if (!full || full.sha256 !== sha256)
      throw new Error(
        txt('This exact revision is no longer installed.', 'Цю точну версію вже вилучено.'),
      );
    const pack = await preparePack(full.project, { assets: full.assets });
    if ((await worldSHA256(pack)) !== sha256)
      throw new Error(
        txt(
          'This exporter cannot reproduce the original pack identity. Keep the original .rlpack before removing it.',
          'Цей експортер не відтворює початковий ідентифікатор пакунка. Перед вилученням збережіть оригінальний .rlpack.',
        ),
      );
    if (isCurrent()) download(pack, `${id}-${sha256.slice(0, 12)}.rlpack`);
  }
  async function reviewPackRemoval(id) {
    packRemovalReview?.close();
    const previousFocus = doc.activeElement,
      dialog = el('dialog'),
      heading = el('h2', txt('Review pack removal', 'Перегляд вилучення пакунка')),
      header = el('div', undefined, 'button-row'),
      summary = el('div'),
      message = el('p'),
      actions = el('div', undefined, 'button-row');
    let closed = false,
      busy = false,
      committing = false,
      reviewed = null;
    const alive = () => !closed && !disposed,
      close = () => {
        if (closed) return;
        closed = true;
        if (packRemovalReview?.dialog === dialog) packRemovalReview = null;
        dialog.close();
        dialog.remove();
        if (!disposed && previousFocus?.isConnected) previousFocus.focus();
      },
      cancel = button(txt('Cancel', 'Скасувати'), () => {
        if (!committing) close();
      }),
      confirm = button(
        txt('Remove pack and retained revisions', 'Вилучити пакунок і збережені версії'),
        async () => {
          if (!alive() || busy || !reviewed) return;
          const removed = reviewed;
          const identities = new Set(removed.revisions.map((r) => `fpv-pack:${r.sha256}`));
          if (current && $('flight-dialog').open && identities.has(current.packIdentity)) {
            pauseFlight();
            message.textContent = txt(
              'Close this pack’s flight before removing it. Its saved recovery remains on this device.',
              'Перед вилученням закрийте політ цього пакунка. Збережені дані відновлення залишаться на пристрої.',
            );
            return;
          }
          committing = true;
          setBusy(true);
          try {
            await worldStore.remove(id, { expectedGeneration: removed.generation });
          } catch (error) {
            committing = false;
            if (!alive()) return;
            if (error.code === 'generation-conflict') {
              try {
                await loadReview();
              } catch (refreshError) {
                reviewed = null;
                if (alive()) message.textContent = refreshError.message ?? String(refreshError);
                return;
              }
              if (alive()) {
                message.textContent = txt(
                  'The library changed. Nothing was removed. Review the updated impact and confirm again if you still want to remove it.',
                  'Бібліотека змінилася. Нічого не вилучено. Перегляньте оновлені наслідки та підтвердьте вилучення ще раз.',
                );
                cancel.focus();
              }
            } else message.textContent = error.message ?? String(error);
            return;
          } finally {
            committing = false;
            if (alive()) setBusy(false);
          }
          if (!alive()) return;
          close();
          // Deletion has committed. Reflect that fact before reading independent
          // stores, whose failure must never make a removed revision look installed.
          installed = installed.filter((record) => record.id !== id);
          revisions = revisions.filter((record) => record.id !== id);
          catalogue = catalogue.filter((entry) => entry.projectId !== id);
          for (const row of $('installed-packs').querySelectorAll('[data-pack-id]'))
            if (row.dataset.packId === id) row.remove();
          try {
            renderFilters();
            renderCatalogue();
            renderPlaylist();
            renderPacks();
            await refreshStorage();
            if (!disposed)
              status(
                txt(
                  'Pack and retained revisions removed. Recordings, pins, playlists, the saved flight and the open draft were kept. Reinstall each required exact .rlpack to use them again.',
                  'Пакунок і збережені версії вилучено. Записи, закріплення, добірки, збережений політ і відкриту чернетку залишено. Для відновлення встановіть кожен потрібний точний .rlpack.',
                ),
              );
          } catch (error) {
            if (!disposed)
              status(
                txt(
                  `Pack removal succeeded. Refreshing storage failed; reload to check the latest records and recovery state. No recordings or playlists were deleted. ${error.message ?? error}`,
                  `Пакунок успішно вилучено. Не вдалося оновити сховище; перезавантажте сторінку, щоб перевірити записи та відновлення. Записи й добірки не видалено. ${error.message ?? error}`,
                ),
              );
          }
        },
      );
    function setBusy(value) {
      busy = value;
      // Keep Cancel focused while loading/exporting: even briefly disabling a
      // focused native button blurs it before the final enabled state is applied.
      for (const b of dialog.querySelectorAll('button')) {
        b.disabled = b === cancel ? committing : b === confirm ? value || !reviewed : value;
      }
      dialog.setAttribute('aria-busy', String(value));
    }
    async function runExport(action) {
      if (!alive() || busy) return;
      setBusy(true);
      try {
        await action();
        if (alive())
          message.textContent = txt(
            'Download prepared. Check your browser’s downloads and keep every part. Nothing has been removed.',
            'Завантаження підготовлено. Перевірте завантаження браузера та збережіть усі частини. Нічого не вилучено.',
          );
      } catch (error) {
        if (alive()) message.textContent = error.message ?? String(error);
      } finally {
        if (alive()) setBusy(false);
      }
    }
    async function loadReview() {
      reviewed = null;
      setBusy(true);
      const snapshot = await worldStore.removalSnapshot(id);
      const dependentData = await Promise.allSettled([
        recordStore ? recordStore.list() : Promise.reject(new Error('unavailable')),
        recordStore ? recordStore.session() : Promise.reject(new Error('unavailable')),
      ]);
      if (!alive()) return;
      summary.replaceChildren();
      if (!snapshot) {
        summary.append(
          el('p', txt('This pack is no longer installed.', 'Цей пакунок уже вилучено.')),
        );
        setBusy(false);
        return;
      }
      reviewed = snapshot;
      dialog.dataset.generation = String(snapshot.generation);
      const identities = new Set(snapshot.revisions.map((r) => `fpv-pack:${r.sha256}`)),
        affected =
          dependentData[0].status === 'fulfilled'
            ? dependentData[0].value.filter((r) => identities.has(r.packIdentity))
            : null,
        savedFlight = dependentData[1].status === 'fulfilled' ? dependentData[1].value : null,
        revisionCount = snapshot.revisions.length,
        challengeCount = new Set(snapshot.revisions.flatMap((r) => r.courseIds)).size;
      summary.append(
        el('strong', snapshot.title),
        el(
          'p',
          txt(
            `${revisionCount} ${revisionCount === 1 ? 'revision' : 'revisions'} · ${challengeCount} ${challengeCount === 1 ? 'challenge' : 'challenges'}. All listed revisions and their scenery will be removed from this device.`,
            `${revisionCount} версій · ${challengeCount} завдань. Усі перелічені версії та їхні сцени буде вилучено з пристрою.`,
          ),
        ),
      );
      const revisionList = el('ul');
      for (const revision of snapshot.revisions) {
        const row = el('li');
        row.dataset.revision = revision.sha256;
        const exportRevision = button(txt('Export this revision', 'Експортувати цю версію'), () =>
          runExport(() => exportPackRevision(id, revision.sha256, alive)),
        );
        exportRevision.dataset.exportRevision = revision.sha256;
        row.append(
          el(
            'small',
            `${revision.active ? txt('Active', 'Активна') : txt('Retained', 'Збережена')} · fpv-pack:${revision.sha256}`,
          ),
          exportRevision,
        );
        revisionList.append(row);
      }
      summary.append(revisionList);
      summary.append(
        el(
          'p',
          affected
            ? txt(
                `${affected.length} recordings (${affected.filter((r) => r.pinned).length} pinned) will need these packs. Recording bytes and past verification are kept.`,
                `${affected.length} записів (${affected.filter((r) => r.pinned).length} закріплено) потребуватимуть цих пакунків. Дані записів і результати попередньої перевірки зберігаються.`,
              )
            : txt(
                'Recording impact is unavailable; removal does not delete the independent recording store.',
                'Наслідки для записів недоступні; вилучення не видаляє окреме сховище записів.',
              ),
        ),
      );
      if (affected?.length) {
        const names = el('ul');
        for (const record of affected.slice(0, 8))
          names.append(el('li', record.course.locales?.[locale]?.title ?? record.course.id));
        if (affected.length > 8)
          names.append(
            el('li', txt(`And ${affected.length - 8} more.`, `І ще ${affected.length - 8}.`)),
          );
        const exports = el('div', undefined, 'button-row'),
          exportRecords = button(txt('Prepare recording backup', 'Підготувати копію записів'), () =>
            runExport(async () => {
              const parts = await exportProofParts(affected);
              if (!alive()) return;
              exports.replaceChildren();
              parts.forEach((part, index) => {
                const b = button(
                  txt(
                    `Download part ${index + 1}/${parts.length}`,
                    `Завантажити частину ${index + 1}/${parts.length}`,
                  ),
                  () => {
                    if (alive())
                      download(
                        JSON.stringify(part),
                        `fpv-records-${index + 1}-of-${parts.length}.json`,
                      );
                  },
                );
                b.dataset.exportProofPart = String(index + 1);
                exports.append(b);
              });
            }),
          );
        exportRecords.id = 'pack-removal-export-records';
        summary.append(names, exportRecords, exports);
      }
      try {
        if (!storage) throw new Error('unavailable');
        const saved = playlistStore.snapshot(),
          lists = saved.playlists.filter((p) =>
            p.entries.some((r) => identities.has(r.packIdentity)),
          ),
          references = lists.reduce(
            (n, p) => n + p.entries.filter((r) => identities.has(r.packIdentity)).length,
            0,
          ),
          bookmarked =
            saved.bookmark &&
            [...saved.playlists, ...CURATED_PLAYLISTS].find(
              (p) => p.id === saved.bookmark.id && p.revision === saved.bookmark.revision,
            ),
          nextAffected =
            bookmarked &&
            identities.has(bookmarked.entries[saved.bookmark.nextIndex]?.packIdentity),
          draftReferences = entries.filter((r) => identities.has(r.packIdentity)).length;
        summary.append(
          el(
            'p',
            txt(
              `${lists.length} saved ${lists.length === 1 ? 'playlist' : 'playlists'} · ${references} affected entries · ${draftReferences} entries in the open playlist. Order and bookmarks are kept.`,
              `${lists.length} збережених добірок · ${references} пов’язаних завдань · ${draftReferences} у відкритій добірці. Порядок і закладки зберігаються.`,
            ),
          ),
        );
        if (nextAffected)
          summary.append(
            el(
              'p',
              txt(
                'The next bookmarked challenge will need its exact pack.',
                'Для наступного завдання за закладкою знадобиться його точний пакунок.',
              ),
            ),
          );
        for (const p of lists.slice(0, 8)) summary.append(el('small', localized(p.title)));
      } catch {
        summary.append(
          el(
            'p',
            txt(
              'Playlist impact is unavailable. Saved playlists and bookmarks are not removed.',
              'Наслідки для добірок недоступні. Збережені добірки та закладки не вилучаються.',
            ),
          ),
        );
      }
      if (dependentData[1].status === 'rejected')
        summary.append(
          el(
            'p',
            txt(
              'Saved-flight impact is unavailable.',
              'Наслідки для збереженого польоту недоступні.',
            ),
          ),
        );
      else if (savedFlight && identities.has(savedFlight.packIdentity))
        summary.append(
          el(
            'p',
            txt(
              `The interrupted flight is kept locally and needs ${savedFlight.packIdentity} to resume.`,
              `Перерваний політ зберігається локально; для відновлення потрібен ${savedFlight.packIdentity}.`,
            ),
          ),
        );
      summary.append(
        el(
          'p',
          txt(
            'Recording backups do not include the interrupted flight. Keep original pack files and check downloads before removal.',
            'Копії записів не містять перерваного польоту. Перед вилученням збережіть оригінальні файли пакунків і перевірте завантаження.',
          ),
        ),
      );
      if (editingProject?.id === id)
        summary.append(
          el(
            'p',
            txt(
              'Your open Creator draft stays in memory. Export it before leaving; removal does not save the draft.',
              'Відкрита чернетка редактора залишиться в пам’яті. Експортуйте її перед виходом; вилучення не зберігає чернетку.',
            ),
          ),
        );
      setBusy(false);
    }
    dialog.id = 'pack-removal-review';
    heading.id = 'pack-removal-title';
    summary.id = 'pack-removal-impact';
    message.id = 'pack-removal-status';
    message.setAttribute('role', 'status');
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.style.width = 'min(44rem, calc(100vw - 2rem))';
    dialog.style.maxHeight = 'calc(100dvh - 2rem)';
    dialog.style.overflow = 'auto';
    dialog.style.overflowWrap = 'anywhere';
    cancel.id = 'pack-removal-cancel';
    cancel.autofocus = true;
    confirm.id = 'pack-removal-confirm';
    header.append(heading, cancel);
    actions.append(confirm);
    dialog.append(header, summary, message, actions);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (!committing) close();
    });
    packRemovalReview = { dialog, close };
    doc.body.append(dialog);
    setBusy(true);
    dialog.showModal();
    cancel.focus();
    try {
      await loadReview();
    } catch (error) {
      if (alive()) {
        reviewed = null;
        message.textContent = error.message ?? String(error);
        setBusy(false);
      }
    }
  }
  async function resumeInterruptedFlight() {
    if (!recovery) return;
    const entry = catalogue.find(
      (e) => e.id === recovery.course.id && e.packIdentity === recovery.packIdentity,
    );
    if (!entry) {
      showTab('packs');
      status(
        txt(
          'Install the exact world pack before recovering this flight.',
          'Для відновлення встановіть точний пакунок світу.',
        ),
      );
      return;
    }
    await startFlight(
      { ...entry, course: recovery.course },
      {
        preview: recovery.preview,
        recover: recovery.proof,
        cosmetics: recovery.cosmetics,
        sectorReferenceId: recovery.sectorReferenceId,
        ghostEnabled: recovery.ghostEnabled,
        presentation: recovery.presentation,
      },
    );
  }
  function renderPacks() {
    if (!flight) {
      const titleCourse =
        recovery?.course ??
        (
          catalogue.find((entry) => entry.legacy && !completedKeys().has(keyOf(entry))) ??
          catalogue.find((entry) => entry.legacy)
        )?.course;
      playShell?.update({
        canResume: Boolean(
          recovery && dependencyAvailable(recovery.packIdentity, recovery.course.id),
        ),
        muted: !audio.enabled(),
        transitionActive: !['idle', 'cancelled'].includes(continuousPlay.snapshot().phase),
        navigationContext,
        missionName: titleCourse?.locales?.[locale]?.title ?? '',
        summary: titleCourse?.locales?.[locale]?.brief ?? '',
        phase: 'ready',
      });
    }
    $('recovery-banner')?.remove();
    const savedLesson = recovery && learningById.get(recovery.course.id);
    $('school-recover').hidden = !savedLesson;
    $('school-recover').textContent = savedLesson
      ? txt(
          `Resume saved lesson · ${localized(savedLesson.title)}`,
          `Відновити урок · ${localized(savedLesson.title)}`,
        )
      : '';
    $('installed-packs').replaceChildren();
    for (const record of installed) {
      const row = el('div', undefined, 'proof-row');
      row.dataset.packId = record.id;
      const removePack = button(txt('Remove', 'Видалити'), () => reviewPackRemoval(record.id));
      removePack.dataset.removePack = record.id;
      row.append(
        el('strong', record.project.title),
        el(
          'small',
          `${record.project.courses.length} ${txt('challenges', 'завдань')} · ${record.sha256.slice(0, 12)}`,
        ),
        button(txt('Fly', 'Летіти'), () => flyInstalledWorld(record)),
        button(txt('Edit', 'Редагувати'), async () => {
          const full = await worldStore.get(record.id);
          await validateNativeIndustrialCourses(full.project.courses);
          if (disposed) return;
          editingProject = full.project;
          projectAssets = full.assets;
          projectGeneration = await worldStore.generation();
          setEditor(full.project.courses[0] ?? courseFromProject(full.project));
          updateImportControls();
          $('import-report').textContent = txt(
            'Installed project loaded. Export or install to keep subsequent changes.',
            'Проєкт завантажено. Експортуйте або встановіть його, щоб зберегти зміни.',
          );
          showTab('creator');
        }),
        button(txt('Export pack', 'Експорт пакунка'), () =>
          exportPackRevision(record.id, record.sha256),
        ),
        removePack,
      );
      $('installed-packs').append(row);
      for (const prior of revisions.filter((r) => r.id === record.id && r.active === false))
        row.append(
          button(
            `${txt('Restore revision', 'Повернути версію')} ${prior.sha256.slice(0, 12)}`,
            async () => {
              await worldStore.activate(prior.id, prior.sha256, {
                expectedGeneration: await worldStore.generation(),
              });
              await refreshStorage();
            },
          ),
        );
    }
    $('proof-records').replaceChildren();
    for (const record of records.slice().sort((a, b) => b.savedAt - a.savedAt)) {
      const row = el('div', undefined, 'proof-row');
      const available = dependencyAvailable(record.packIdentity, record.course.id);
      row.dataset.recordId = record.id;
      row.dataset.dependency = available ? 'available' : 'missing';
      const remove = button(txt('Remove', 'Видалити'), async () => {
        await recordStore.remove(record.id);
        await refreshStorage();
      });
      remove.disabled = Boolean(record.pinned);
      row.append(
        el('strong', record.course.locales?.[locale]?.title ?? record.course.id),
        el(
          'small',
          `${record.proof.session === 'demonstration' ? txt('Example · ', 'Приклад · ') : ''}${record.status === 'verified' ? txt('Previously verified', 'Раніше перевірено') : record.status === 'invalid' ? txt('Invalid recording', 'Недійсний запис') : txt('Verification pending', 'Очікує перевірки')} · ${available ? txt('Required content available', 'Потрібний вміст доступний') : txt('Required pack missing', 'Потрібний пакунок відсутній')} · ${record.diagnostic} · ${record.proof.frames?.length ?? 0} ${txt('ticks', 'тактів')}`,
        ),
        button(txt('Export', 'Експорт'), async () =>
          download(JSON.stringify((await exportProofParts([record]))[0]), `${record.id}.json`),
        ),
        remove,
        button(record.pinned ? txt('Unpin', 'Відкріпити') : txt('Pin', 'Закріпити'), async () => {
          await recordStore.pin(record.id, !record.pinned);
          await refreshStorage();
        }),
        button(txt('Verify again', 'Перевірити знову'), async () =>
          restoreProofs(
            new Blob([JSON.stringify((await exportProofParts([record]))[0])], {
              type: 'application/json',
            }),
          ),
        ),
      );
      if (!available) row.append(dependencyGuidance(record.packIdentity));
      $('proof-records').append(row);
    }
    if (recovery) {
      const banner = button(
        txt(
          'An interrupted flight is saved. Open recovery.',
          'Збережено перерваний політ. Відкрити відновлення.',
        ),
        () => showTab('packs'),
      );
      banner.id = 'recovery-banner';
      $('explore').prepend(banner);
      const b = button(
        txt('Resume interrupted flight', 'Відновити перерваний політ'),
        resumeInterruptedFlight,
      );
      b.id = 'resume-flight';
      b.disabled = !dependencyAvailable(recovery.packIdentity, recovery.course.id);
      $('proof-records').prepend(b);
      if (b.disabled) b.after(dependencyGuidance(recovery.packIdentity));
    }
  }
  function updateImportControls() {
    for (const id of ['preview-world', 'export-project', 'export-pack', 'install-project'])
      $(id).disabled = !editingProject;
    paintCoursePicker();
  }
  function reviewReimport({ changes, diagnostics }) {
    return new Promise((resolve) => {
      const previousFocus = doc.activeElement,
        dialog = el('dialog'),
        heading = el('h2', txt('Review world update', 'Перегляньте оновлення світу')),
        summary = el(
          'p',
          txt(
            'Your draft is unchanged until you apply. Local edits and removed source items are retained when they need review.',
            'Чернетка не зміниться до застосування. Локальні зміни та вилучені об’єкти джерела зберігаються для перевірки.',
          ),
        ),
        list = el('ul'),
        actions = el('div', undefined, 'button-row');
      dialog.id = 'reimport-review';
      heading.id = 'reimport-review-title';
      dialog.setAttribute('aria-labelledby', heading.id);
      dialog.style.width = 'min(44rem, calc(100vw - 2rem))';
      dialog.style.overflowWrap = 'anywhere';
      const actionNames = {
        added: txt('Added', 'Додано'),
        changed: txt('Changed', 'Змінено'),
        removed: txt('Removed from source', 'Вилучено з джерела'),
      };
      for (const change of changes)
        list.append(el('li', `${actionNames[change.action]} · ${change.kind} · ${change.id}`));
      if (!changes.length)
        list.append(
          el('li', txt('No semantic source changes.', 'Семантичних змін у джерелі немає.')),
        );
      const diagnosticCopy = {
        'local-conflict': 'Джерело й локальні дані змінено; збережено локальний варіант.',
        'local-id-conflict':
          'Новий ID джерела збігається з локальним об’єктом; збережено локальний варіант.',
        'removed-source-retained':
          'Джерело вилучило об’єкт; його авторську версію збережено для перевірки.',
        'local-deletion-preserved': 'Збережено локальне вилучення об’єкта.',
        'missing-spawn-binding':
          'Вибраний стартовий маркер відсутній або змінив тип; збережено авторську позицію старту.',
        'missing-route-binding':
          'Маркер маршруту відсутній або змінив тип; збережено авторське завдання.',
        'unplaced-marker': 'Доступний новий маркер; порядок поточного маршруту збережено.',
        'orphan-override': 'Джерело вилучило маркер; його локальні зміни збережено для перевірки.',
        'override-preserved': 'Джерело змінилося; локальні зміни залишаються чинними.',
      };
      for (const diagnostic of diagnostics)
        list.append(
          el(
            'li',
            locale === 'uk' && diagnosticCopy[diagnostic.code]
              ? `${diagnostic.id}: ${diagnosticCopy[diagnostic.code]}`
              : `${diagnostic.severity}: ${diagnostic.message}`,
          ),
        );
      const finish = (accepted) => {
        dialog.close();
        dialog.remove();
        previousFocus?.focus?.();
        resolve(accepted);
      };
      const cancel = button(txt('Keep current draft', 'Залишити поточну чернетку'), () =>
          finish(false),
        ),
        apply = button(txt('Apply reviewed update', 'Застосувати перевірене оновлення'), () =>
          finish(true),
        );
      cancel.autofocus = true;
      actions.append(cancel, apply);
      dialog.append(heading, summary, list, actions);
      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        finish(false);
      });
      doc.body.append(dialog);
      dialog.showModal();
      cancel.focus();
    });
  }
  async function installProject() {
    if (!worldStore)
      throw new Error(
        txt(
          'Persistent storage is unavailable. Export the pack instead.',
          'Постійне сховище недоступне. Експортуйте пакунок.',
        ),
      );
    syncProject();
    for (const c of editingProject.courses) validateWorldCourse(c);
    await validateNativeIndustrialCourses(editingProject.courses);
    const pack = await preparePack(editingProject, { assets: projectAssets });
    const installed = await installPack(pack, {
      store: worldStore,
      expectedGeneration: projectGeneration ?? (await worldStore.generation()),
    });
    projectGeneration = installed.generation;
    try {
      await refreshStorage();
    } catch {
      status(
        txt(
          'World pack saved. Reload the page to refresh the Library.',
          'Пакунок світу збережено. Перезавантажте сторінку, щоб оновити бібліотеку.',
        ),
      );
      return;
    }
    status(txt('World pack is ready to fly.', 'Пакунок світу готовий до польоту.'));
  }
  let importRequest = 0;
  async function importScene(files) {
    const request = ++importRequest;
    const list = Array.from(files),
      models = list.filter((f) => /\.(glb|gltf)$/i.test(f.name));
    if (models.length !== 1)
      throw new Error(
        txt(
          'Choose exactly one GLB or glTF and its resources.',
          'Виберіть один GLB або glTF та його ресурси.',
        ),
      );
    syncProject();
    const draft = editingProject,
      draftIdentity = draft ? canonicalWorldJSON(draft) : null,
      prior = draft?.world.modelAsset ? clone(draft) : null,
      name = models[0].name,
      id = prior?.id ?? unique('world');
    const inspected = await inspectImport({
      files: new Map(list.map((f) => [f.webkitRelativePath || f.name, f])),
      entry: models[0].webkitRelativePath || name,
      id,
      title: prior?.title ?? name.replace(/\.(glb|gltf)$/i, ''),
      license: {
        id: $('asset-license').value,
        author: $('asset-author').value.trim(),
        source: $('asset-source').value.trim(),
      },
    });
    let next,
      review = null,
      diagnostics = [...inspected.metadata.diagnostics];
    if (prior) {
      review = previewReimport(prior, inspected, {
        createCourse: courseFromProject,
        createCollider: colliderFromAnchor,
        validateCourse: validateWorldCourse,
      });
      next = review.project;
      diagnostics = review.diagnostics;
    } else {
      next = projectFromImport(inspected);
      next.courses = [courseFromProject(next)];
      const ids = compilePlayable(next)
        .world.anchors.filter((a) => ['gate', 'checkpoint', 'landmark', 'landing'].includes(a.kind))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((a) => a.id);
      next.routeBindings = {
        [next.courses[0].id]: {
          'self-level': next.courses[0].steps['self-level'].map((_, i) => ids[i] ?? null),
          acro: next.courses[0].steps.acro.map((_, i) => ids[i] ?? null),
        },
      };
      const spawnId = compilePlayable(next).world.anchors.find((a) => a.kind === 'spawn')?.id;
      if (spawnId) next.spawnBindings = { [next.courses[0].id]: spawnId };
    }
    // Commit the editor state only after the entire source and every playable
    // challenge validates; a rejected reimport leaves the previous draft intact.
    const assets = prior ? new Map(projectAssets) : new Map();
    assets.set(next.world.modelAsset, inspected.modelBlob);
    next.provenance = [
      ...next.provenance.filter((row) => row.asset !== next.world.modelAsset),
      { asset: next.world.modelAsset, license: inspected.license },
    ];
    synchronizeDefinitions(next);
    await validateNativeIndustrialCourses(next.courses);
    if (request !== importRequest || disposed) return;
    if (review && !(await reviewReimport(review))) {
      $('import-report').textContent = txt(
        'Update cancelled. Your draft is unchanged.',
        'Оновлення скасовано. Чернетка не змінилася.',
      );
      return;
    }
    const generation = worldStore ? await worldStore.generation() : null;
    if (
      request !== importRequest ||
      editingProject !== draft ||
      (draft && canonicalWorldJSON(draft) !== draftIdentity)
    )
      throw new Error(
        txt(
          'The draft changed while this import was prepared. Import again to review against the latest draft.',
          'Чернетка змінилася під час підготовки імпорту. Повторіть імпорт для перевірки останньої версії.',
        ),
      );
    editingProject = next;
    projectAssets = assets;
    setEditor(next.courses.find((course) => course.id === editor?.id) ?? next.courses[0], {
      scope: editorScope,
    });
    projectGeneration = generation;
    updateImportControls();
    $('import-report').textContent = [
      `${name}: ${(inspected.modelBlob.size / 1024).toFixed(1)} KiB`,
      `${inspected.metadata.anchors.length} ${txt('markers', 'маркерів')}, ${inspected.metadata.colliders.length} ${txt('colliders', 'колайдерів')}`,
      ...diagnostics.map((d) => `${d.severity}: ${d.message}`),
    ].join('\n');
  }

  async function saveRecovery() {
    if (combatReplaySource) return;
    if (flight?.exportCombatRecovery) {
      if (readFlightState()?.status !== 'active') await saveCombatSession();
      return;
    }
    if (
      !recordStore ||
      preview ||
      !flight ||
      current?.legacy ||
      !recorder ||
      !recorder.ticks() ||
      terminal(readFlightState())
    )
      return;
    const savedStatsRun = enemyStatsRunId,
      savedFlightToken = flightToken;
    const saved = {
      course: current.course,
      proof: recorder.export(),
      packIdentity: current.packIdentity,
      preview,
      sectorReferenceId,
      ghostEnabled,
      ...(current.legacy ? { presentation: appearanceSession.current() } : {}),
    };
    const recording = recorder.recordingStatus?.(),
      atRecordedBoundary =
        !recording?.exhausted || readFlightState().ticks <= recording.retainedTick,
      presentation = atRecordedBoundary ? renderer?.exportCombatPresentation?.() : null;
    if (readFlightState()?.actorLives && presentation)
      saved.cosmetics = { proofIdentity: dataIdentity(saved.proof), presentation };
    try {
      await recordStore.saveSession(saved);
    } catch (error) {
      // Cosmetic storage cannot prevent a valid gameplay checkpoint from being saved.
      if (!saved.cosmetics) throw error;
      delete saved.cosmetics;
      await recordStore.saveSession(saved);
    }
    try {
      storage?.setItem(
        statsRecoveryKey,
        JSON.stringify({ proof: dataIdentity(saved.proof), run: savedStatsRun }),
      );
    } catch {
      /* Session counters remain available. */
    }
    if (savedFlightToken === flightToken) recovery = saved;
  }
  // Background checkpoint reads must not consume a deliberate Arm click.
  const pendingFlightSteps = new WeakSet();
  function pauseFlight(freezeRadio = true, reason = 'paused') {
    continuousPlay.cancel('paused');
    regionalManifestRequest?.abort();
    if (pausing) return;
    pauseRevision++;
    if (combatPlayback) combatPlayback.playing = false;
    pausing = true;
    gamepad.reset();
    stickTraces.forEach((trace) => trace.reset());
    beginnerCoach.pausePreview?.();
    if (fire) fireReleaseRequired = true;
    fire = false;
    huntReactions.suspend();
    audio.pause();
    presentation.resume();
    if (reason === 'paused' && !replayProof && !combatReplaySource)
      input.pause({
        session: flight,
        retainKeyboardThrottle: readFlightState()?.status === 'active',
      });
    else input.enable(false);
    if (freezeRadio) radio.freeze('paused');
    if (regionalPreparing && current?.regional) flight?.cancelPreparation();
    if (flight) flight.pause();
    lastTime = null;
    lastExecutionTime = win.performance?.now?.() ?? null;
    accumulator = 0;
    pausing = false;
    if (current) {
      $('flight-status').textContent = combatReplaySource
        ? txt(
            'Combat playback paused. Resume to watch.',
            'Перегляд бою призупинено. Натисніть «Продовжити».',
          )
        : current.regional
          ? regionalStopFeedback(readFlightState()) ||
            txt('Unscored · Paused', 'Без заліку · Пауза')
          : txt(
              replayProof
                ? 'Playback paused. Resume to continue.'
                : 'Paused. Arm deliberately to continue.',
              replayProof
                ? 'Відтворення на паузі. Натисніть «Продовжити».'
                : 'Пауза. Натисніть «Увімкнути», щоб продовжити.',
            );
      if (!disposed) void saveRecovery().catch(reportError);
    }
  }
  function abortSectorLookup() {
    sectorLookup?.abort();
    sectorLookup = null;
    clearGhost();
  }
  function clearGhost() {
    ghostLookup?.abort();
    ghostLookup = null;
    ghostError = false;
    renderer?.setGhost?.([]);
    // Also clear any older static route when replacing a course.
    renderer?.setPath?.([]);
  }
  function updateGhostHUD() {
    const loading = Boolean(ghostLookup),
      available = Boolean(sectorReference && !preview && !replayProof),
      shown = ghostEnabled && available,
      ended = shown && flight && readFlightState()?.ticks >= sectorReference.ticks;
    ghostButton.disabled = !available || (!sceneReady && !loading);
    ghostButton.textContent = loading
      ? txt('Cancel ghost loading', 'Скасувати завантаження примари')
      : shown
        ? txt('Hide personal best', 'Сховати особистий рекорд')
        : txt('Show personal best', 'Показати особистий рекорд');
    ghostButton.setAttribute('aria-pressed', String(shown));
    const description = loading
      ? txt('Loading personal best… Flight paused.', 'Завантаження рекорду… Політ на паузі.')
      : ghostError
        ? txt(
            'Ghost unavailable. Sector timing still works.',
            'Примара недоступна. Час ділянок працює.',
          )
        : shown
          ? ended
            ? txt(
                'Personal best finished · ghost holds its final position.',
                'Рекорд завершено · примара залишається на фініші.',
              )
            : txt(
                'Cyan ghost · same personal best as sector timing. No collision.',
                'Блакитна примара · той самий рекорд, що й для ділянок. Без зіткнень.',
              )
          : '';
    $('ghost-status').hidden = !description;
    if ($('ghost-status').textContent !== description) $('ghost-status').textContent = description;
  }
  async function loadGhost() {
    if (!ghostEnabled || !sectorReferenceProof || !sectorReference || preview || replayProof)
      return;
    clearGhost();
    const controller = new AbortController(),
      token = flightToken,
      reference = sectorReference,
      entry = current,
      proof = sectorReferenceProof;
    ghostLookup = controller;
    const isCurrent = () =>
      !disposed && token === flightToken && ghostLookup === controller && ghostEnabled;
    updateGhostHUD();
    try {
      const checked = await (entry.legacy ? replayFlightCooperatively : replayWorldFlight)(
        entry.course,
        proof,
        { sampleEvery: 5, signal: controller.signal },
      );
      if (!isCurrent()) return;
      if (checked.state.status !== 'complete' || checked.state.ticks !== reference.ticks)
        throw new Error('Personal best no longer reproduces its completed flight');
      renderer.setGhost([
        { tick: 0, position: entry.course.spawn, orientation: [0, 0, 0, 1000000] },
        ...checked.path,
      ]);
    } catch {
      if (isCurrent()) {
        ghostEnabled = false;
        ghostError = true;
      }
    } finally {
      if (isCurrent() || ghostLookup === controller) {
        ghostLookup = null;
        updateGhostHUD();
      }
    }
  }
  const seconds = (ticks) => `${(ticks / 50).toFixed(2)} ${txt('s', 'с')}`;
  const deltaSeconds = (ticks) =>
    ticks === null ? '—' : `${ticks < 0 ? '−' : ticks > 0 ? '+' : ''}${seconds(Math.abs(ticks))}`;
  function paintDelta(node, label, value) {
    const text = `${label} ${deltaSeconds(value)}`;
    if (node.textContent !== text) node.textContent = text;
    node.classList.toggle('sector-ahead', value !== null && value < 0);
    node.classList.toggle('sector-behind', value !== null && value > 0);
  }
  function updateSectorHUD() {
    $('sector-panel').hidden =
      Boolean(checkpointSession) || modePractice || Boolean(current?.freeFlight);
    const latest = sectors.latest(sectorReference?.sectors),
      title = latest
        ? `${txt('Sector', 'Ділянка')} ${latest.index + 1} · ${seconds(latest.ticks)}`
        : txt('Sector timing · no split yet', 'Час ділянок · ще немає відміток'),
      description = replayProof
        ? txt('Playback · timing only', 'Перегляд · лише час')
        : preview || sectorReferenceStatus === 'unscored'
          ? txt('Unscored practice · timing only', 'Тренування без заліку · лише час')
          : sectorReferenceStatus === 'checking'
            ? txt('Checking saved best…', 'Перевірка найкращого запису…')
            : sectorReference
              ? `${txt('Personal best', 'Особистий рекорд')} · ${seconds(sectorReference.ticks)}`
              : sectorReferenceStatus === 'unavailable'
                ? txt('Saved comparison unavailable.', 'Збережене порівняння недоступне.')
                : txt(
                    'No verified personal best for these settings.',
                    'Для цих налаштувань ще немає перевіреного рекорду.',
                  );
    if ($('sector-latest').textContent !== title) $('sector-latest').textContent = title;
    if ($('sector-reference').textContent !== description)
      $('sector-reference').textContent = description;
    paintDelta($('sector-delta'), txt('Split', 'Ділянка'), latest?.sectorDelta ?? null);
    paintDelta($('sector-total-delta'), txt('Total', 'Разом'), latest?.cumulativeDelta ?? null);
    $('sector-panel').setAttribute('aria-label', txt('Sector timing', 'Час ділянок'));
  }
  async function resolveSectorReference(entry, identity, token, requestedId) {
    const controller = new AbortController();
    sectorLookup = controller;
    const isCurrent = () => !disposed && token === flightToken && sectorLookup === controller;
    // Saved summaries are only a shortlist. Every selected reference must reproduce
    // a complete flight against this attempt's exact dependencies and controls.
    const candidates = records
      .filter(
        (record) =>
          record?.proof &&
          typeof record.id === 'string' &&
          Array.isArray(record.proof.frames) &&
          Number.isSafeInteger(record.proof.frames.length) &&
          record.proof.frames.length > 0 &&
          record.proof.frames.length <= 36000 &&
          record.packIdentity === entry.packIdentity &&
          record.proof.course === entry.course.id &&
          compatibleGhost(record, identity) &&
          (requestedId === undefined || record.id === requestedId),
      )
      .map((record) => ({ id: record.id, proof: clone(record.proof) }))
      .sort((a, b) => a.proof.frames.length - b.proof.frames.length || a.id.localeCompare(b.id));
    try {
      for (const candidate of candidates) {
        try {
          const checked = await (entry.legacy ? replayFlightCooperatively : replayWorldFlight)(
            entry.course,
            candidate.proof,
            { includeSectors: true, signal: controller.signal },
          );
          if (!isCurrent()) return;
          if (
            checked.state.status !== 'complete' ||
            checked.state.ticks !== candidate.proof.frames.length ||
            checked.state.step !== entry.course.steps[identity.mode].length ||
            checked.sectors.length !== checked.state.step ||
            checked.sectors.at(-1)?.endTick !== checked.state.ticks
          )
            continue;
          sectorReference = {
            id: candidate.id,
            ticks: checked.state.ticks,
            sectors: checked.sectors,
          };
          sectorReferenceProof = candidate.proof;
          sectorReferenceId = candidate.id;
          sectorReferenceStatus = 'ready';
          return;
        } catch {
          if (!isCurrent() || controller.signal.aborted) return;
          // Imported metadata can claim verification; try the next genuine proof.
        }
      }
      if (isCurrent()) sectorReferenceStatus = requestedId === undefined ? 'none' : 'unavailable';
    } finally {
      if (isCurrent()) {
        sectorLookup = null;
        updateSectorHUD();
      }
    }
  }
  function splitSummary(rows, reference) {
    const details = el('details', undefined, 'sector-summary');
    details.append(el('summary', txt('Completed sector times', 'Час пройдених ділянок')));
    const table = el('table'),
      heading = el('tr');
    for (const title of [
      txt('Sector', 'Ділянка'),
      txt('Time', 'Час'),
      txt('Split Δ', 'Δ ділянки'),
      txt('Total Δ', 'Δ разом'),
    ]) {
      const th = el('th', title);
      th.scope = 'col';
      heading.append(th);
    }
    const head = el('thead'),
      body = el('tbody');
    head.append(heading);
    for (const sector of rows) {
      const row = el('tr'),
        baseline = reference?.sectors[sector.index];
      row.append(el('td', String(sector.index + 1)), el('td', seconds(sector.ticks)));
      for (const value of [
        baseline ? sector.ticks - baseline.ticks : null,
        baseline ? sector.endTick - baseline.endTick : null,
      ]) {
        const cell = el('td');
        paintDelta(cell, '', value);
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    details.append(table);
    return details;
  }
  function paintLoadout() {
    $('flight-loadout').textContent = ['flight-mode', 'flight-source', 'flight-camera']
      .map((id) => $(id).selectedOptions[0]?.textContent ?? '')
      .join(' · ');
  }
  function regionalNavigationLabel() {
    if (!regionalNavigation) return '';
    if (['saved', 'encounter'].includes(regionalNavigation.kind)) return regionalNavigation.label;
    return (
      [...(regionalStartControls?.select.options ?? [])]
        .find((option) => option.value === regionalNavigation.id)
        ?.textContent.replace(/^\d+ · /, '') ?? regionalNavigation.id.replace(/-/g, ' ')
    );
  }
  function guideRegionalSelection(kind) {
    if (!current?.regional || regionalPreparing || readFlightState()?.status !== 'paused') return;
    try {
      regionalNavigation = regionalNavigationTarget(
        current,
        kind === 'saved'
          ? {
              location: regionalLocationControls.locations.find(
                (place) => place.id === regionalLocationControls.select.value,
              ),
            }
          : { spawnId: regionalStartControls.select.value },
      );
      updateHUD(readFlightState());
    } catch {
      regionalNavigation = null;
      paintRegionalStarts();
    }
  }
  function navigationPresentation(state) {
    // Temporary encounter guidance must not replace a player's selected waypoint.
    const encounterGuide =
      !regionalNavigation && state.encounter?.outsideArea && flight?.encounterDestination
        ? {
            packIdentity: current.packIdentity,
            kind: 'encounter',
            position: flight.encounterDestination(),
          }
        : null;
    const target = regionalNavigation ?? encounterGuide;
    const feedback = regionalNavigationFeedback(current, target, state);
    if (!feedback) return null;
    const metres = feedback.horizontalMm / 1000,
      distance =
        metres >= 1000
          ? `${(metres / 1000).toFixed(1)} ${txt('km', 'км')}`
          : `${metres < 1 ? '<1' : metres < 100 ? Math.round(metres) : Math.round(metres / 5) * 5} ${txt('m', 'м')}`,
      arrow =
        feedback.sector === null
          ? '·'
          : ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][feedback.sector],
      direction = !feedback.headingValid
        ? txt('Heading unavailable', 'Курс невідомий')
        : feedback.horizontalMm < 1000
          ? txt('At this position', 'У цій позиції')
          : `${txt('Nose', 'Від носа')} ${arrow}`,
      height =
        feedback.height === 'above'
          ? txt('Higher', 'Вище')
          : feedback.height === 'below'
            ? txt('Lower', 'Нижче')
            : txt('Same height', 'Та сама висота');
    return {
      action: `${direction} · ${distance}`,
      label: encounterGuide ? txt('Current encounter', 'Поточний бій') : regionalNavigationLabel(),
      hint:
        target.kind === 'encounter' && state.encounter?.outsideArea
          ? txt('Combat resumes on return', 'Бій продовжиться після повернення')
          : `${height} · ${txt('no route', 'не маршрут')}`,
      detail: txt(
        'Direction from the drone nose, not the camera. A straight bearing does not check obstacles or provide a safe route.',
        'Напрямок від носа дрона, а не камери. Прямий напрямок не перевіряє перешкоди та не є безпечним маршрутом.',
      ),
    };
  }
  function paintRegionalStarts(state = null) {
    if (!current?.regional || regionalNavigation?.packIdentity !== current.packIdentity)
      regionalNavigation = null;
    paintRegionalLocations(state);
    const controls = regionalStartControls;
    if (!controls) return;
    paintRegionalAdvanced(state);
    controls.root.hidden = !current?.regional;
    if (!current?.regional) {
      controls.owner = null;
      return;
    }
    const signature = `${locale}:${current.configuration.spawnId ?? ''}`;
    if (controls.owner !== current || controls.signature !== signature) {
      controls.owner = current;
      controls.signature = signature;
      controls.label.textContent = txt('Starting point', 'Місце старту');
      controls.restart.textContent = txt('Restart here', 'Почати звідси');
      controls.guide.textContent = txt('Guide me there', 'Показувати напрямок');
      controls.off.textContent = txt('Turn guidance off', 'Вимкнути напрямок');
      controls.help.textContent = txt(
        'Restart moves to the selected start and stays disarmed. Guide me there only shows direction from the drone nose; obstacles and a safe route are not checked. Resume flight explicitly when ready.',
        'Перезапуск переносить до вибраного старту без озброєння. Напрямок показується від носа дрона; перешкоди й безпечний маршрут не перевіряються. Продовжуйте політ явно, коли будете готові.',
      );
      controls.select.replaceChildren();
      const names = {
        'mare-apron': ['Survey shelter', 'Дослідницьке укриття'],
        'ejecta-fan': ['Split rocks', 'Розколоті скелі'],
        'sinuous-rille': ['Winding channel', 'Звивисте русло'],
        'terraced-crater': ['Crater rim', 'Край кратера'],
        'fractured-highland': ['Fractured highland', 'Розколоте нагір’я'],
        'observatory-ridge': ['Survey dish', 'Дослідницька антена'],
        'arrival-gardens': ['Arrival gardens', 'Вхідні сади'],
        'loop-meadow': ['Loop meadow', 'Луг із петлею'],
        'ridge-station': ['Ridge station', 'Станція на пагорбі'],
        'service-courts': ['Service courts', 'Службові двори'],
        'woodland-promenade': ['Woodland promenade', 'Лісова алея'],
        'river-gardens': ['River gardens', 'Прибережні сади'],
        'mill-court': ['Mill court', 'Двір млина'],
        'tower-court': ['Tower court', 'Двір вежі'],
        'freight-hall': ['Freight hall', 'Вантажний цех'],
        'viaduct-river-gap': ['Viaduct opening', 'Прохід під віадуком'],
        'quarry-under-conveyor': ['Quarry conveyor', 'Конвеєр кар’єру'],
        'station-canopy': ['Station canopy', 'Навіс станції'],
        'foundry-gantries': ['Foundry gantries', 'Портали ливарні'],
        'timber-crane-line': ['Timber cranes', 'Крани лісового складу'],
        'lower-square': ['Lower square', 'Нижня площа'],
        'middle-courtyard': ['Middle courtyard', 'Середнє подвір’я'],
        'upper-terrace': ['Upper terrace', 'Верхня тераса'],
        'elevated-pad': ['Elevated pad', 'Піднятий майданчик'],
        'covered-harbour': ['Covered harbour', 'Крита гавань'],
        'lagoon-piers': ['Lagoon piers', 'Пірси лагуни'],
        'reef-rocks': ['Reef rocks', 'Прибережні скелі'],
        'palm-valley': ['Palm valley', 'Пальмова долина'],
        'hillside-huts': ['Hillside huts', 'Хатини на схилі'],
        'bamboo-grove': ['Bamboo grove', 'Бамбуковий гай'],
        'north-arch': ['Masonry arch', 'Кам’яна арка'],
        'warehouse-passage': ['Warehouse passage', 'Прохід через склади'],
        highwalk: ['High pedestrian bridge', 'Високий пішохідний міст'],
        'lock-bend': ['Lock crossing', 'Перехід біля шлюзу'],
        courtyard: ['Courtyard', 'Подвір’я'],
        'turning-basin': ['Turning basin', 'Розворотний басейн'],
        'crescent-dunes': ['Crescent dunes', 'Серпоподібні дюни'],
        'dry-wash': ['Dry wash', 'Сухе русло'],
        'salt-basin': ['Salt basin', 'Солона улоговина'],
        'sunrise-escarpment': ['Sunrise escarpment', 'Світанковий уступ'],
        'mesa-corridor': ['Mesa corridor', 'Коридор плато'],
        'rocky-plain': ['Rocky plain', 'Кам’яниста рівнина'],
        'glacial-valley': ['Glacial valley', 'Льодовикова долина'],
        'switchback-pass': ['Switchback pass', 'Перевал із серпантином'],
        'snow-saddle': ['Snow saddle', 'Снігова сідловина'],
        'summit-station': ['Summit station', 'Верхня станція'],
        'viaduct-gorge': ['Viaduct gorge', 'Ущелина з віадуком'],
        'reservoir-dam': ['Reservoir dam', 'Гребля водосховища'],
        'braided-basin': ['Braided basin', 'Розгалужена улоговина'],
        'high-mesa': ['High mesa', 'Високе плато'],
        'red-escarpment': ['Red escarpment', 'Червоний уступ'],
        confluence: ['Confluence', 'Злиття русел'],
        'hoodoo-flats': ['Hoodoo flats', 'Рівнина кам’яних стовпів'],
        amphitheatre: ['Amphitheatre', 'Амфітеатр'],
        basin: ['Basin', 'Улоговина'],
        mesa: ['Mesa', 'Плато'],
        gorge: ['Gorge', 'Ущелина'],
        buttes: ['Rock towers', 'Скельні вежі'],
        fork: ['Fork junction', 'Розгалуження'],
        shelf: ['Rock shelf', 'Скельний уступ'],
      };
      for (const [index, spawn] of current.configuration.manifest.spawns.entries()) {
        const option = el(
          'option',
          `${index + 1} · ${names[spawn.id] ? txt(...names[spawn.id]) : spawn.id.replace(/-/g, ' ')}`,
        );
        option.value = spawn.id;
        controls.select.append(option);
      }
      controls.select.value =
        current.configuration.spawnId ?? current.configuration.manifest.spawns[0].id;
    }
    const active = (state ?? readFlightState())?.status === 'active';
    controls.restart.disabled = controls.select.disabled = Boolean(controls.busy || active);
    controls.guide.disabled = Boolean(
      controls.busy || regionalPreparing || (state ?? readFlightState())?.status !== 'paused',
    );
    controls.off.disabled = !regionalNavigation;
    const status = regionalNavigation
      ? `${txt('Guiding to', 'Напрямок до')}: ${regionalNavigationLabel()}`
      : txt('Direction guidance is off.', 'Показ напрямку вимкнено.');
    if (controls.status.textContent !== status) controls.status.textContent = status;
  }
  function paintRegionalAdvanced(state = null) {
    const controls = regionalAdvancedControls;
    if (!controls) return;
    // Aircraft sessions use the shared continuous-practice controls. The retained
    // panel below is only for the historical bounded Advanced backend.
    const aircraft = Boolean((state ?? readFlightState())?.aircraftRadiusMm);
    controls.root.hidden = !current?.regional || aircraft;
    if (!current?.regional || aircraft) return;
    const advanced = Boolean(current.regionalAdvanced);
    const unavailable = typeof win.Worker !== 'function';
    controls.button.textContent = advanced
      ? txt('Use Legacy flight · restart', 'Політ Legacy · перезапустити')
      : txt('Try Advanced here · restart', 'Спробувати Advanced тут · перезапустити');
    controls.button.disabled = Boolean(
      controls.busy || regionalPreparing || (!advanced && unavailable),
    );
    for (const control of [controls.exportRecording, controls.exportRecovery, controls.restore]) {
      control.hidden = !advanced;
      control.disabled = Boolean(
        controls.busy ||
          regionalPreparing ||
          !readFlightState()?.advanced ||
          readFlightState()?.reason === 'worker-error',
      );
    }
    controls.exportRecording.textContent = txt(
      'Export Advanced recording',
      'Експорт запису Advanced',
    );
    controls.exportRecovery.textContent = txt('Export recovery', 'Експорт відновлення');
    controls.restore.textContent = txt('Restore recovery file', 'Відновити з файлу');
    controls.cancelRecovery.textContent = txt(
      'Cancel recovery verification',
      'Скасувати перевірку відновлення',
    );
    controls.cancelRecovery.hidden = !advanced || !controls.recovery;
    controls.help.textContent =
      unavailable && !advanced
        ? txt(
            'Advanced is unavailable: this platform cannot start a simulation worker.',
            'Advanced недоступний: платформа не підтримує окремий потік симуляції.',
          )
        : txt(
            'Experimental Acro · unscored · air start 2 m above the selected point. Landings and collisions use the verified terrain. Uses portable rates, or Actual defaults for Legacy feel.',
            'Експериментальний Acro · без заліку · старт у повітрі на 2 м вище вибраної точки. Посадки та зіткнення використовують перевірену геометрію місцевості. Використовуються переносні рейти або типові Actual для Legacy feel.',
          );
  }
  function regionalStopFeedback(state) {
    if (!current?.regional || !state || state.status === 'active') return '';
    if (regionalPreparationIssue && !regionalPreparing)
      return txt(regionalPreparationIssue.en, regionalPreparationIssue.uk);
    const messages = {
      'region-edge': [
        'Region boundary reached. Restart to return to the launch point.',
        'Межу регіону досягнуто. Перезапустіть, щоб повернутися до старту.',
      ],
      'worker-error': [
        'Advanced worker interrupted. Restart to fly again.',
        'Потік Advanced перервано. Перезапустіть політ.',
      ],
      'terrain-error': [
        'Terrain could not be prepared. Retry to load the area again.',
        'Не вдалося підготувати місцевість. Повторіть спробу, щоб знову завантажити ділянку.',
      ],
      'terrain-required': [
        'Terrain is not ready. Retry to load the area again.',
        'Місцевість ще не готова. Повторіть спробу, щоб знову завантажити ділянку.',
      ],
      'preparing-terrain': [
        'Unscored · Loading area… Wait until the area is ready to resume.',
        'Без заліку · Завантаження… Дочекайтеся готовності місцевості, щоб продовжити.',
      ],
      'duration-limit': [
        'Flight duration limit reached. Export your recording, then restart for a new flight.',
        'Досягнуто межі тривалості польоту. Експортуйте запис і перезапустіть для нового польоту.',
      ],
      'recording-limit': [
        'Recording capacity reached. Export your recording, then restart for a new flight.',
        'Досягнуто межі обсягу запису. Експортуйте запис і перезапустіть для нового польоту.',
      ],
    };
    const message = messages[state.reason];
    return message ? txt(...message) : '';
  }
  function savedLocationError(error) {
    if (error?.code === 'regional-location-outside' || error?.code === 'regional-location-revision')
      return txt(
        'This saved place is unavailable. Choose a clear starting point. The place is kept.',
        'Це збережене місце недоступне. Виберіть вільне місце старту. Запис збережено.',
      );
    if (error?.code === 'generation-conflict')
      return txt(
        'Saved places changed in another tab. Refresh and choose again.',
        'Збережені місця змінилися в іншій вкладці. Оновіть і виберіть знову.',
      );
    if (error?.code === 'regional-location-full')
      return txt(
        'Saved places are full. Remove a place you no longer need.',
        'Сховище місць заповнене. Видаліть місце, яке більше не потрібне.',
      );
    if (error?.code === 'regional-location-label')
      return txt('Enter a name of 1–64 characters.', 'Введіть назву від 1 до 64 символів.');
    return txt(
      'Saved places are unavailable. Existing places are retained.',
      'Збережені місця недоступні. Наявні місця збережено.',
    );
  }
  function regionalPlacesHelp() {
    return regionalLocationControls?.restoreUnavailable
      ? txt(
          'This saved place cannot be verified. Choose a clear starting point above. The place is kept.',
          'Це збережене місце неможливо перевірити. Виберіть вільне місце старту вище. Запис збережено.',
        )
      : txt(
          'Places belong to this world version. Restore levelled and disarmed; mode and view stay the same.',
          'Місця належать цій версії світу. Відновлення вирівнює й не озброює дрон; режим і вигляд зберігаються.',
        );
  }
  function locationStore() {
    regionalLocationsStore ??= openRegionalLocations({ indexedDB: win.indexedDB }).catch(
      (error) => {
        regionalLocationsStore = null;
        throw error;
      },
    );
    return regionalLocationsStore;
  }
  async function refreshRegionalLocations(owner = current) {
    const controls = regionalLocationControls;
    if (!controls || controls.owner !== owner || !owner?.regional || owner.regionalReview) return;
    const request = ++controls.request;
    controls.loading = true;
    controls.review.hidden = true;
    try {
      const saved = await (await locationStore()).list(regionalLocationIdentity(owner));
      if (disposed || current !== owner || request !== controls.request) return;
      controls.generation = saved.generation;
      controls.locations = saved.locations;
      const selected = controls.select.value;
      controls.select.replaceChildren();
      for (const place of saved.locations) {
        const option = el('option', place.label);
        option.value = place.id;
        controls.select.append(option);
      }
      if (saved.locations.some((place) => place.id === selected)) controls.select.value = selected;
      if (!controls.label.value)
        controls.label.value = txt(
          `Place ${saved.locations.length + 1}`,
          `Місце ${saved.locations.length + 1}`,
        );
      controls.help.textContent = regionalPlacesHelp();
    } catch (error) {
      if (current === owner && request === controls.request) {
        controls.generation = null;
        controls.help.textContent = savedLocationError(error);
      }
    } finally {
      if (request === controls.request) {
        controls.loading = false;
        paintRegionalLocations();
      }
    }
  }
  function paintRegionalLocations(state = null) {
    const c = regionalLocationControls;
    if (!c) return;
    c.root.hidden = !current?.regional || current.regionalReview;
    if (c.root.hidden) {
      if (c.owner) c.request++;
      c.owner = null;
      return;
    }
    if (c.owner !== current) {
      c.owner = current;
      c.generation = null;
      c.locations = [];
      c.restoreUnavailable = false;
      c.label.value = '';
      c.select.replaceChildren();
      c.help.textContent = txt('Loading saved places…', 'Завантаження місць…');
      void refreshRegionalLocations(current);
    }
    if (c.locale !== locale) {
      const changedLocale = c.locale !== null;
      c.locale = locale;
      c.title.textContent = txt('Saved places', 'Збережені місця');
      c.labelText.textContent = txt('Name this place', 'Назва цього місця');
      c.selectText.textContent = txt('Choose a saved place', 'Виберіть збережене місце');
      c.save.textContent = txt('Save current place', 'Зберегти поточне місце');
      c.restore.textContent = txt('Restore here', 'Відновити тут');
      c.guide.textContent = txt('Guide me there', 'Показувати напрямок');
      c.remove.textContent = txt('Remove…', 'Видалити…');
      c.refresh.textContent = txt('Refresh places', 'Оновити місця');
      c.confirm.textContent = txt('Remove this place', 'Видалити це місце');
      c.keep.textContent = txt('Keep', 'Залишити');
      c.review.hidden = true;
      if (changedLocale && c.generation !== null) c.help.textContent = regionalPlacesHelp();
    }
    const paused = (state ?? readFlightState())?.status === 'paused';
    const unavailable =
      c.busy || c.loading || !paused || regionalPreparing || c.generation === null;
    c.save.disabled = c.label.disabled = Boolean(unavailable || !sceneReady);
    c.guide.disabled =
      c.restore.disabled =
      c.select.disabled =
      c.remove.disabled =
        Boolean(unavailable || !c.locations.length);
    c.confirm.disabled = Boolean(unavailable);
    c.refresh.disabled = Boolean(c.busy || c.loading);
  }
  async function saveRegionalLocation() {
    const c = regionalLocationControls,
      owner = current,
      selected = flight;
    if (
      !c ||
      c.save.disabled ||
      c.owner !== owner ||
      !sceneReady ||
      selected?.snapshot().status !== 'paused'
    )
      return;
    const state = selected.snapshot();
    c.busy = true;
    paintRegionalLocations(state);
    try {
      const pose = validateRegionalLocationStart(
        { position: state.position, heading: ((state.attitude.yaw % 36000) + 36000) % 36000 },
        owner.configuration.manifest,
      );
      const store = await locationStore();
      if (
        disposed ||
        current !== owner ||
        flight !== selected ||
        selected.snapshot().status !== 'paused'
      )
        return;
      const saved = await store.add(
        regionalLocationIdentity(owner),
        { label: c.label.value, pose },
        { expectedGeneration: c.generation },
      );
      if (current === owner) {
        c.label.value = '';
        await refreshRegionalLocations(owner);
        if (current === owner) {
          c.select.value = saved.location.id;
          c.help.textContent = txt(
            'Place saved on this device.',
            'Місце збережено на цьому пристрої.',
          );
        }
      }
    } catch (error) {
      if (current === owner) c.help.textContent = savedLocationError(error);
    } finally {
      c.busy = false;
      paintRegionalLocations();
    }
  }
  async function restoreRegionalLocation() {
    const c = regionalLocationControls,
      owner = current;
    if (!c || c.restore.disabled || c.owner !== owner || readFlightState()?.status !== 'paused')
      return;
    const selectedId = c.select.value,
      expected = c.generation,
      launchGeneration = missionLaunchGeneration,
      selectedFlight = flight,
      selectedToken = flightToken;
    c.busy = true;
    paintRegionalLocations();
    try {
      const saved = await (await locationStore()).list(regionalLocationIdentity(owner));
      if (
        disposed ||
        current !== owner ||
        doc.hidden ||
        launchGeneration !== missionLaunchGeneration ||
        selectedFlight !== flight ||
        selectedToken !== flightToken ||
        readFlightState()?.status !== 'paused'
      )
        return;
      if (saved.generation !== expected)
        throw Object.assign(new Error('Changed saved places'), { code: 'generation-conflict' });
      const entry = regionalSavedLocation(
        owner,
        saved.locations.find((place) => place.id === selectedId),
      );
      const generation = ++missionLaunchGeneration;
      await startRegionalFlight(entry, {
        mode: $('flight-mode').value,
        lessonCamera: $('flight-camera').value,
        isCurrent: () => !doc.hidden && generation === missionLaunchGeneration,
      });
    } catch (error) {
      if (current === owner) c.help.textContent = savedLocationError(error);
    } finally {
      c.busy = false;
      paintRegionalLocations();
    }
  }
  async function removeRegionalLocation() {
    const c = regionalLocationControls,
      owner = current,
      review = c.removal;
    if (!c || c.confirm.disabled || c.owner !== owner || !review || c.review.hidden) return;
    c.busy = true;
    paintRegionalLocations();
    try {
      await (
        await locationStore()
      ).remove(regionalLocationIdentity(owner), review.id, {
        expectedGeneration: review.generation,
      });
      if (current === owner) await refreshRegionalLocations(owner);
    } catch (error) {
      if (current === owner) c.help.textContent = savedLocationError(error);
    } finally {
      c.busy = false;
      c.review.hidden = true;
      c.removal = null;
      paintRegionalLocations();
    }
  }
  async function restartRegionalAtSelection() {
    const controls = regionalStartControls;
    if (!controls || controls.busy || controls.owner !== current || !current?.regional) return;
    let entry;
    try {
      entry = regionalStartingPoint(current, controls.select.value);
    } catch {
      controls.help.textContent = txt(
        'Choose a starting point from this region.',
        'Виберіть місце старту з цього регіону.',
      );
      return;
    }
    const mode = $('flight-mode').value,
      camera = $('flight-camera').value;
    controls.busy = true;
    pauseFlight();
    paintRegionalStarts();
    if ($('sim-settings').open) closeSettings({ force: true });
    const generation = ++missionLaunchGeneration;
    try {
      await startRegionalFlight(entry, {
        mode,
        lessonCamera: camera,
        isCurrent: () => !doc.hidden && generation === missionLaunchGeneration,
      });
    } finally {
      controls.busy = false;
      paintRegionalStarts();
    }
  }
  function updateHUD(state) {
    const healthText = flightHealthText(state);
    encounterControls.update({
      selection: encounterSelection,
      encounter: state.encounter ? { ...state.encounter, recording: state.combatRecording } : null,
      unavailable: encounterUnavailable,
      busy:
        combatActionBusy ||
        encounterBusy ||
        Boolean(replayProof || combatReplaySource || checkpointSession),
    });
    paintCombatActionControls(state);
    if (combatPlayback) {
      const progress = combatPlayback.job.snapshot();
      paintText(
        'world-replay-label',
        `${txt('COMBAT PLAYBACK · NO REWARDS', 'ПЕРЕГЛЯД БОЮ · БЕЗ НАГОРОД')} · ${(progress.cursor / 50).toFixed(1)} / ${(progress.total / 50).toFixed(1)} s`,
      );
    }
    aircraftControls?.update(state);
    aircraftChallengeControls?.update(state);
    if (aircraftAdviceText) {
      aircraftAdviceText.hidden = !aircraftAdvice;
      aircraftAdviceText.textContent = aircraftAdvice?.advisories[locale] ?? '';
    }
    paintRegionalStarts(state);
    for (const view of enemyStatsViews)
      if (view.root.dataset.variant !== 'collection') view.root.hidden = Boolean(current?.regional);
    // Section/unfinished recordings may stop in a paused simulation state.
    // Their playback result must not offer an impossible Continue action.
    const playbackEnded = Boolean((replayProof || combatReplaySource) && finished);
    $('flight-dialog').dataset.flightState = state.status;
    paintText('world-flight-identity', $('flight-title').textContent);
    paintRegionalPreparation();
    const resumeUnavailableReason = combatReplaySource ? '' : regionalStopFeedback(state);
    if (resumeUnavailableReason) paintText('flight-status', resumeUnavailableReason);
    playShell?.update({
      phase:
        playbackEnded || (!combatReplaySource && terminal(state))
          ? 'results'
          : combatReplaySource
            ? combatPlayback?.playing
              ? 'playing'
              : 'paused'
            : state.status === 'active'
              ? 'playing'
              : state.status,
      pauseOpensMenu: Boolean(
        !combatReplaySource &&
          current?.regional &&
          state.status !== 'active' &&
          state.reason !== 'prepared',
      ),
      navigationContext,
      missionName: $('flight-title').textContent,
      summary: $('flight-menu-brief').textContent,
      canResume:
        !playbackEnded &&
        (combatReplaySource
          ? Boolean(combatPlayback && !combatPlayback.playing && !combatPlayback.error)
          : ['paused', 'disarmed'].includes(state.status) &&
            (!current.regional || state.reason === 'prepared')),
      pauseResumeDisabled: Boolean(
        !sceneReady ||
          Boolean(combatReplaySource && (!combatPlayback || combatPlayback.error)) ||
          (!combatReplaySource &&
            current.regional &&
            (!sceneReady ||
              (current.regionalAdvanced && regionalAdvancedControls?.busy) ||
              (state.reason !== 'prepared' && state.status !== 'active'))),
      ),
      resumeUnavailableReason,
      muted: !audio.enabled(),
    });
    updateSectorHUD();
    updateGhostHUD();
    const target = current.course.steps[$('flight-mode').value][state.step];
    const guidance = flightGoalFeedback({
      course: current.course,
      mode: $('flight-mode').value,
      state,
      legacy: Boolean(current.legacy),
      legacyFacts: current.legacy ? flight.objectiveFeedback?.() : null,
      locale,
      freeFlight: Boolean(current.freeFlight),
    });
    const navigation = current.regional ? navigationPresentation(state) : null;
    if (current.regional) {
      guidance.action =
        navigation?.action ?? txt('Regional review · unscored', 'Перевірка регіону · без заліку');
      guidance.label = '';
      guidance.gauge = null;
      guidance.earned = null;
      guidance.checks = [];
    }
    if (state.encounter) {
      const encounter = state.encounter;
      guidance.action = encounter.outsideArea
        ? (navigation?.action ??
          txt('Fly back to resume combat', 'Поверніться, щоб продовжити бій'))
        : encounter.phase === 'intermission'
          ? txt(
              `Next wave in ${Math.max(0, Math.ceil((encounter.nextWaveTick - encounter.ticks) / 50))} s`,
              `Наступна хвиля за ${Math.max(0, Math.ceil((encounter.nextWaveTick - encounter.ticks) / 50))} с`,
            )
          : `${encounterActivityLabel(encounter.activity, locale)} · ${txt('Wave', 'Хвиля')} ${encounter.wave} · ${encounter.kills} ${txt('defeats', 'знищено')}`;
      guidance.label = '';
      guidance.gauge = null;
      guidance.earned = null;
      guidance.checks = [];
    }
    const numeric =
      !state.encounter && flightHud.detailsRoot()?.open
        ? learningObjectiveFeedback(target, current.legacy ? null : state, {
            locale,
            mode: $('flight-mode').value,
          })
        : null;
    const hudVisible =
      !finished &&
      !terminal(state) &&
      !beginnerCoach.blocksArm() &&
      !playShell?.blocksPlay() &&
      !flightMenuOpen() &&
      $('flight-dialog').dataset.optionsOpen !== 'true' &&
      $('flight-dialog').dataset.immersiveControls !== 'true' &&
      !doc.querySelector('dialog[open]:not(#flight-dialog)');
    const activeHud = hudVisible && state.status === 'active';
    paintCombatHUD(state, hudVisible);
    // Ready and paused regional flight keep the same unobstructed viewport.
    // This is presentation state only; arming and HUD progress remain unchanged.
    $('flight-dialog').dataset.simFlightCompact = String(Boolean(current.regional && hudVisible));
    $('world-viewport').dataset.simFlightCompact = $('flight-dialog').dataset.simFlightCompact;
    $('flight-dialog').dataset.simHudActive = String(activeHud);
    $('world-viewport').dataset.simHudActive = String(activeHud);
    $('world-viewport').dataset.simHudGuide = String(beginnerCoach.blocksArm());
    flightInstruments.update(state, {
      visible: hudVisible,
      preferences: cameraControls?.presentationOptions(),
      routeUnavailable: routeGuideFeedback(state),
    });
    flightHud.update(guidance, {
      explain: !current.regional && !state.encounter,
      statusOnly: Boolean(current.regional),
      navigation: activeHud ? navigation : null,
      visible: hudVisible && (!state.encounter || state.encounter.outsideArea),
      active: activeHud,
      paused: state.status !== 'active',
      replay: Boolean(replayProof || combatReplaySource),
      lesson: Boolean(current.beginner),
      telemetry:
        current.beginner || current.freeFlight
          ? flightHealthText(state, { damagedOnly: true })
          : [
              healthText,
              `${((state.ticks - (checkpointSession?.startTick ?? 0)) / 50).toFixed(1)} s`,
            ]
              .filter(Boolean)
              .join(' · '),
      notice: activeHud ? '' : $('flight-status').textContent,
      details: !numeric
        ? undefined
        : [
            numeric.objective,
            ...numeric.checks.map(
              (check) =>
                `${check.label}: ${current.legacy ? '' : `${check.value} · `}${check.required}`,
            ),
            numeric.detail,
            numeric.hint,
          ]
            .filter(Boolean)
            .join('\n'),
    });
    paintText(
      'flight-instruments',
      `${(state.position.y / 1000).toFixed(1)} m · ${(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) / 1000) | 0} m/s · ${((state.ticks - (checkpointSession?.startTick ?? 0)) / 50).toFixed(1)} s${healthText ? ` · ${healthText}` : ''}`,
    );
    let objective = terminal(state)
      ? txt('Flight ended', 'Політ завершено')
      : `${Math.min(state.step + 1, state.total ?? current.course.steps[$('flight-mode').value].length)}/${current.course.steps[$('flight-mode').value].length} · ${target ? stepName(target) : state.status}${state.hold ? ` · ${target?.type === 'actor-track-v1' ? `${(state.hold / 50).toFixed(1)}/${(target.ticks / 50).toFixed(1)} s` : `${state.hold}/${target?.ticks ?? 0}`}` : ''}`;
    if (checkpointSession && !terminal(state))
      objective = `${replayKind === 'section' && replayProof ? txt('Recorded section', 'Записана ділянка') : txt('Unscored practice', 'Тренування без заліку')} · ${checkpointSession.kind !== 'full-attempt' ? `${txt('Section', 'Ділянка')} ${checkpointSession.index + 1} · ` : ''}${target ? stepName(target) : state.status}${state.hold ? ` · ${state.hold}/${target?.ticks ?? 0}` : ''}`;
    if (target?.type === 'actor-track-v1' && !terminal(state)) {
      const hints = {
        'acquire-subject': ['Find the marked subject', 'Знайдіть позначений об’єкт'],
        'subject-unavailable': ['Subject unavailable — retry', 'Об’єкт недоступний — повторіть'],
        'airborne-clearance': ['Lift off first', 'Спершу злетіть'],
        'subject-range': [
          `Keep ${target.minDistance / 1000}–${target.maxDistance / 1000} m away`,
          `Тримайте ${target.minDistance / 1000}–${target.maxDistance / 1000} м`,
        ],
        'relative-speed': ['Match the subject’s movement', 'Повторюйте рух об’єкта'],
        'airframe-tilt': ['Reduce the bank angle', 'Зменште нахил'],
        'nose-alignment': ['Point the nose toward the subject', 'Спрямуйте ніс на об’єкт'],
        'subject-occluded': ['Find a clear sight line', 'Знайдіть пряму видимість'],
        'subject-travel': ['Continue with the moving subject', 'Продовжуйте рух за об’єктом'],
      };
      const hint = hints[state.actorTrack?.reason];
      if (hint) objective += ` · ${txt(...hint)}`;
    }
    if (state.hunt) {
      const criterion = current.course.steps[$('flight-mode').value].find(
        (step) => step.type === 'hunt-contact-v1',
      );
      const count = state.hunt.caught.length;
      objective += ` · ${txt('Caught', 'Спіймано')} ${count}/${criterion.targets.length} · ${txt('Echo tail', 'Хвіст')} ${state.hunt.tail.length}`;
      if (!terminal(state) && criterion.ordered)
        objective += ` · ${txt('Next', 'Далі')} ${String(count + 1).padStart(2, '0')}`;
      if (state.hunt.failure)
        objective += ` · ${txt('Touched your echo tail', 'Зіткнення зі своїм хвостом')}`;
    }
    if (modePractice) objective = `${modePracticeNotice()} · ${objective}`;
    if (current.freeFlight) objective = freeFlightNotice();
    if (state.encounter) objective = guidance.action;
    paintText('flight-objective', objective);
    $('world-arm').disabled =
      !sceneReady ||
      Boolean(current.regionalAdvanced && regionalAdvancedControls?.busy) ||
      (!combatReplaySource &&
        current.regional &&
        state.reason !== 'prepared' &&
        state.status !== 'active') ||
      Boolean(combatReplaySource && (!combatPlayback || combatPlayback.error)) ||
      Boolean(ghostLookup) ||
      beginnerCoach.blocksArm() ||
      (!combatReplaySource && terminal(state)) ||
      (Boolean(replayProof || combatReplaySource) && finished);
    paintText(
      'world-arm',
      replayProof || combatReplaySource
        ? txt('Resume playback', 'Продовжити перегляд')
        : txt('Arm / resume', 'Увімкнути / продовжити'),
    );
    paintText(
      'world-retry',
      replayProof || combatReplaySource
        ? txt('Restart playback', 'Переглянути спочатку')
        : txt('Retry', 'Ще раз'),
    );
    $('world-watch-demo').hidden =
      Boolean(replayProof || combatReplaySource) ||
      Boolean(checkpointSession) ||
      !demonstrationFor(current, $('flight-mode').value);
    $('export-flight').disabled =
      Boolean(combatReplaySource) ||
      (!(flight?.aircraft && !current.regional) &&
        (Boolean(checkpointSession) ||
          (modePractice && !practiceContinuation) ||
          Boolean(current.freeFlight)));
    paintContinuationRecordingNotice();
    $('world-fire').hidden = !canFire(state);
    $('world-flight-resume').disabled = $('world-arm').disabled;
    paintText('world-flight-resume', $('world-arm').textContent);
    $('world-flight-fire').hidden = $('world-fire').hidden || $('flight-source').value !== 'touch';
    $('world-next').disabled =
      Boolean(checkpointSession) ||
      modePractice ||
      !playingPlaylist ||
      playlistIndex + 1 >= playingPlaylist.entries.length;
  }
  function combatResultSettings(configuration) {
    const labels = {
      autocannon: txt('Autocannon', 'Автогармата'),
      scatter: txt('Scatter', 'Картеч'),
      precision: txt('Precision', 'Точна зброя'),
      rocket: txt('Rockets', 'Ракети'),
      bomb: txt('Drop bomb', 'Скидання бомби'),
      remote: txt('Remote charge', 'Дистанційний заряд'),
      drone: txt('Drone charge', 'Заряд дрона'),
      balanced: txt('Balanced', 'Збалансовано'),
      arcade: txt('Arcade', 'Аркада'),
      tactical: txt('Tactical', 'Тактичний'),
      normal: txt('Normal', 'Звичайно'),
      invulnerable: txt('Invulnerable · assisted', 'Невразливість · допомога'),
      'one-hit': txt('One hit · assisted', 'Одне влучання · допомога'),
    };
    return [
      configuration.loadout?.length
        ? `${txt('Loadout', 'Озброєння')}: ${configuration.loadout.map((id) => labels[id]).join(' / ')}`
        : '',
      configuration.payload ? `${txt('Payload', 'Заряд')}: ${labels[configuration.payload]}` : '',
      configuration.ammoPreset
        ? `${txt('Ammunition', 'Боєприпаси')}: ${labels[configuration.ammoPreset]}`
        : '',
      configuration.playerDamage
        ? `${txt('Player damage', 'Пошкодження гравця')}: ${labels[configuration.playerDamage]}`
        : '',
      configuration.enemyDamage
        ? `${txt('Enemy damage', 'Пошкодження ворогів')}: ${labels[configuration.enemyDamage]}`
        : '',
    ].filter(Boolean);
  }
  async function finishFlight(token) {
    if (finished || token !== flightToken) return;
    if (combatReplaySource) return;
    if (replayProof) {
      finishPlayback();
      return;
    }
    finished = true;
    enemyStatistics.finish();
    input.enable(false);
    fire = false;
    radio.freeze('finished');
    if (flight.combatDefinition) {
      void finishCombatArchive().catch((error) => {
        if (!disposed) combatArchiveStatus.textContent = error.message;
      });
      const state = readFlightState(),
        encounter = state.encounter;
      const summary = {
        format:
          flight.combatDefinition().format === 'FPVEncounterDefinition.v2'
            ? 'FPVCombatResult.v2'
            : 'FPVCombatResult.v1',
        content: flight.combatDefinition().baseIdentity,
        definition: clone(flight.identity.encounter),
        configuration: Object.fromEntries(
          [
            'seed',
            'loadout',
            'payload',
            'ammoPreset',
            'playerDamage',
            'enemyDamage',
            'survivalMode',
          ]
            .filter((key) => flight.combatDefinition()[key] !== undefined)
            .map((key) => [key, flight.combatDefinition()[key]]),
        ),
        recording: clone(state.combatRecording),
        activity: encounter.activity,
        difficulty: encounter.difficulty,
        population: encounter.population,
        backend: flight.identity.base?.model ?? (state.advanced ? 'advanced-practice' : 'native'),
        waves: encounter.wave,
        defeats: encounter.kills,
        shots: encounter.shots,
        hits: encounter.hits,
        impacts: encounter.successfulImpacts ?? 0,
        ticks: encounter.ticks,
        status: encounter.status,
        practiceOnly: true,
        bestStreak: encounter.bestStreak,
      };
      try {
        const saved = JSON.parse(storage?.getItem('revealline.fpv.combat-results.v1') ?? '[]');
        storage?.setItem(
          'revealline.fpv.combat-results.v1',
          JSON.stringify([summary, ...(Array.isArray(saved) ? saved : [])].slice(0, 100)),
        );
      } catch {
        /* Results remain visible when local storage is unavailable. */
      }
      $('result-panel').hidden = false;
      $('result-panel').replaceChildren(
        el(
          'h2',
          encounter.status === 'complete'
            ? txt('Encounter complete', 'Бій завершено')
            : txt('Drone defeated', 'Дрон знищено'),
        ),
        el(
          'p',
          `${encounterActivityLabel(encounter.activity, locale)} · ${encounter.difficulty} · ${encounter.actors.length}/${encounter.population} · ${state.advanced ? txt('Advanced physics · practice', 'Advanced · тренування') : txt('Standard physics', 'Стандартна фізика')}`,
        ),
        el(
          'p',
          `${txt('Wave', 'Хвиля')} ${encounter.wave} · ${encounter.kills} ${txt('defeats', 'знищено')} · ${txt('Accuracy', 'Точність')} ${encounter.shots ? Math.round((encounter.hits / encounter.shots) * 100) : 0}% · ${summary.impacts} ${txt('impacts', 'зіткнень')} · ${(encounter.ticks / 50).toFixed(1)} s`,
        ),
        el('p', `${txt('Best streak', 'Найкраща серія')}: ${summary.bestStreak}`),
        ...combatResultSettings(summary.configuration).map((text) => el('p', text)),
        el(
          'p',
          txt(
            'Local practice result. Original course medals are recorded separately.',
            'Локальний результат тренування. Медалі початкового маршруту записуються окремо.',
          ),
        ),
        button(txt('Retry same run', 'Повторити цю спробу'), () => retryFlight(), 'primary'),
        button(txt('New run', 'Нова спроба'), () => encounterControls.buttons.newRun.click()),
        button(txt('Save combat session', 'Зберегти бойову сесію'), () => saveCombatSession(true)),
        button(txt('Watch current attempt', 'Переглянути поточну спробу'), () =>
          watchCombatButton.click(),
        ),
        button(txt('Back to lobby', 'До меню'), () => closeFlight()),
      );
      return;
    }
    if ((modePractice || current.freeFlight) && !checkpointSession) {
      $('result-panel').hidden = false;
      $('result-panel').replaceChildren(
        el('h2', txt('Practice ended', 'Тренування завершено')),
        el('p', current.freeFlight ? freeFlightNotice() : modePracticeNotice()),
        el(
          'p',
          txt(
            'No completion record, medal or recording was saved.',
            'Запис виконання, медаль і запис польоту не збережено.',
          ),
        ),
        button(
          txt('Practise again', 'Тренуватися ще раз'),
          () => startFlight(current, retainedDraftOptions()),
          'primary',
        ),
        button(txt('Back to lobby', 'До меню'), () => closeFlight()),
      );
      $('flight-status').textContent = current.freeFlight
        ? freeFlightNotice()
        : modePracticeNotice();
      return;
    }
    if (checkpointSession) {
      const state = readFlightState(),
        entry = current,
        request = checkpointRequest,
        section = checkpointSession.kind === 'checkpoint';
      $('result-panel').hidden = false;
      $('result-panel').replaceChildren(
        el(
          'h2',
          state.status === 'complete'
            ? section
              ? txt('Section complete', 'Ділянку виконано')
              : txt('Practice complete', 'Тренування завершено')
            : txt('Practice ended', 'Тренування завершено'),
        ),
        el(
          'p',
          txt(
            'Unscored practice. Completion records, medals and playlists are unchanged.',
            'Тренування без заліку. Записи виконання, медалі та списки польотів не змінюються.',
          ),
        ),
        el(
          'p',
          `${((state.ticks - checkpointSession.startTick) / 50).toFixed(2)} ${txt('s', 'с')}`,
        ),
        button(
          txt('Practise again', 'Тренуватися ще раз'),
          () => startFlight(entry, { checkpoint: request }),
          'primary',
        ),
        button(txt('Fly full challenge', 'Летіти повне завдання'), () => startFlight(entry)),
        button(txt('Back to lobby', 'До меню'), () => closeFlight()),
      );
      if (section && request.proof)
        $('result-panel').append(
          button(txt('Watch this section', 'Переглянути цю ділянку'), () =>
            startFlight(entry, { checkpoint: { ...request, watch: true } }),
          ),
        );
      $('flight-status').textContent = txt(
        'Practice finished · no rewards or recording.',
        'Тренування завершено · без нагород і запису.',
      );
      return;
    }
    const entry = current,
      proof = recorder.export(),
      state = readFlightState(),
      isPreview = preview,
      completedReference = sectorReference,
      completedPlaylist = playingPlaylist,
      completedPlaylistIndex = playlistIndex,
      resultSummary = evaluateWorldResult(current.course, proof, state, {
        sectors: sectors.snapshot(),
      });
    $('result-panel').hidden = false;
    const resultDetails = el('div');
    // One host-owned view keeps live totals and the optional family breakdown
    // inside the result card without replacing or expanding its primary actions.
    resultEnemyStatsView.root.querySelector('details').open = false;
    resultEnemyStatsView.refresh();
    $('result-panel').replaceChildren(resultDetails, resultEnemyStatsView.root);
    resultDetails.replaceChildren(
      el(
        'h2',
        state.status === 'complete'
          ? entry.beginner
            ? txt('Lesson complete', 'Урок виконано')
            : txt('Challenge complete', 'Завдання виконано')
          : txt('Flight ended', 'Політ завершено'),
      ),
      el('p', txt('Checking recording…', 'Перевірка запису…')),
    );
    const resultActions = el('div', undefined, 'button-row continuous-result-actions');
    const retryAction = button(
      txt('Fly again', 'Летіти ще раз'),
      () => $('world-retry').click(),
      'primary',
    );
    resultActions.append(retryAction);
    if (!$('world-next').disabled)
      resultActions.append(
        button(txt('Next flight', 'Наступний політ'), () => $('world-next').click(), 'primary'),
      );
    if (entry.beginner && state.status === 'complete' && !isPreview)
      resultActions.append(
        button(
          !nextLearningEntry(entry)
            ? txt('Return to your course', 'Повернутися до курсу')
            : txt('Next lesson', 'Наступний урок'),
          () => nextLearningFlight(),
          'primary',
        ),
      );
    if (entry.beginner && state.status === 'complete' && !nextLearningEntry(entry))
      resultActions.append(
        button(
          txt('Explore more worlds', 'Досліджувати інші світи'),
          async () => {
            await closeFlight();
            showTab('explore');
          },
          'primary',
        ),
      );
    resultActions.append(
      button(
        entry.beginner
          ? txt('Back to Flight School', 'До льотної школи')
          : txt('Back to lobby', 'До меню'),
        async () => {
          await closeFlight();
          if (entry.beginner) showTab('learn');
        },
      ),
    );
    resultActions.append(
      button(txt('Random level', 'Випадковий рівень'), () => playShell.activate('random')),
      button(txt('Choose mission', 'Вибрати місію'), () => {
        continuousPlay.cancel('mission-choice');
        openCatalogueTab('explore');
      }),
      button(txt('Home', 'Додому'), async () => {
        continuousPlay.cancel('home');
        await closeFlight();
        playShell.openHome();
      }),
    );
    $('result-panel').append(resultActions);
    flowControls?.dispose();
    flowCelebration?.dispose();
    const nextAction = [...resultActions.querySelectorAll('button')].find(
      (node) =>
        node.textContent === txt('Next flight', 'Наступний політ') ||
        node.textContent === txt('Next lesson', 'Наступний урок'),
    );
    const primaryResultAction =
      state.status === 'complete' ? (nextAction ?? retryAction) : retryAction;
    flowControls = mountSimContinuousPlayControls({
      document: doc,
      parent: resultActions,
      primaryAction: primaryResultAction,
      controller: continuousPlay,
      locale: () => locale,
    });
    flowCelebration = mountSimContinuousCelebration({
      document: doc,
      controller: continuousPlay,
      reduced: () => displayPreferences.snapshot().effectiveReducedEffects,
    });
    if (!isPreview)
      continuousPlay.begin({
        identity: flight,
        outcome: state.status === 'complete' ? 'won' : 'lost',
        canAdvance:
          state.status === 'complete' &&
          (entry.beginner ? !!nextLearningEntry(entry) : !$('world-next').disabled),
        replayMs: 0,
        readyMs: 400,
      });
    primaryResultAction.focus();

    try {
      const verified = entry.legacy
        ? await replayFlightCooperatively(entry.course, proof)
        : await replayWorldFlight(entry.course, proof);
      if (disposed) return;
      if (verified.state.status !== state.status || verified.state.ticks !== state.ticks)
        throw new Error('Recording does not reproduce this result.');
      if (!isPreview && proof.session === 'practice' && entry.legacy && state.status === 'complete')
        await notebook.accept(proof, { presentation: entry.presentation });
      if (disposed) return;
      if (!isPreview && recordStore)
        await recordStore.put({
          course: entry.course,
          proof,
          status: 'verified',
          diagnostic: state.status,
          packIdentity: entry.packIdentity,
          ...(entry.legacy ? { presentation: entry.presentation } : {}),
        });
      if (disposed) return;
      if (!isPreview && state.status === 'complete' && completedPlaylist) {
        try {
          playlistStore.bookmark(
            completedPlaylist.id,
            completedPlaylist.revision,
            completedPlaylistIndex + 1,
          );
        } catch (error) {
          reportError(error);
        }
      }
      if (recordStore && token === flightToken && !isPreview) {
        await recordStore.saveSession(null);
        recovery = null;
      }
      if (disposed) return;
      if (
        !isPreview &&
        entry.beginner &&
        state.status === 'complete' &&
        proof.session === 'practice'
      ) {
        const modes = sessionLearningComplete.get(keyOf(entry)) ?? new Set();
        modes.add(proof.mode);
        sessionLearningComplete.set(keyOf(entry), modes);
      }
      await refreshStorage();
      if (token !== flightToken) return;
      if (entry.beginner)
        beginnerCoach.complete({
          verified: !isPreview && state.status === 'complete',
          nextAvailable: Boolean(nextLearningEntry(entry)),
        });
      // Keep the action row connected while asynchronous verification updates
      // only its sibling details; keyboard/controller focus must stay usable.
      resultDetails.replaceChildren(
        el(
          'h2',
          state.status === 'complete'
            ? entry.beginner
              ? txt('Lesson complete', 'Урок виконано')
              : txt('Challenge complete', 'Завдання виконано')
            : txt('Flight ended', 'Політ завершено'),
        ),
        el(
          'p',
          isPreview
            ? txt(
                'Authoring preview · no rewards or completion earned.',
                'Авторський перегляд · без нагород і зарахування.',
              )
            : txt('Recording verified.', 'Запис перевірено.'),
        ),
        el(
          'small',
          `${(state.ticks / 50).toFixed(2)} s · ${state.contacts ?? 0} ${txt('contacts', 'контактів')}`,
        ),
      );
      if (
        !isPreview &&
        state.status === 'complete' &&
        ['gold', 'silver', 'bronze'].includes(resultSummary.medal)
      ) {
        const stars = { gold: 3, silver: 2, bronze: 1 }[resultSummary.medal];
        const rating = el('p', '★'.repeat(stars), 'result-stars');
        rating.setAttribute('aria-label', txt(`${stars} of 3 stars`, `${stars} з 3 зірок`));
        resultDetails.append(rating);
      }
      if (!entry.beginner)
        resultDetails.append(
          el(
            'p',
            `${resultSummary.medal ? `${txt('Medal', 'Медаль')}: ${resultSummary.medal} · ` : ''}${txt('Score', 'Бали')}: ${resultSummary.score}${resultSummary.accuracy === null ? '' : ` · ${Math.round(resultSummary.accuracy * 100)}%`}`,
          ),
        );
      if (resultSummary.sectors.length)
        resultDetails.append(splitSummary(resultSummary.sectors, completedReference));
      const lostSector = completedReference
        ? resultSummary.sectors
            .map((sector) => ({
              index: sector.index,
              loss: sector.ticks - completedReference.sectors[sector.index].ticks,
            }))
            .filter((sector) => sector.loss > 0)
            .sort((a, b) => b.loss - a.loss)[0]
        : null;
      const measured = resultSummary.sectors.find(
        (sector) => sector.index === (lostSector?.index ?? resultSummary.weakest),
      );
      if (
        !isPreview &&
        !entry.legacy &&
        !entry.beginner &&
        proof.session === 'practice' &&
        measured &&
        entry.course.steps[proof.mode][measured.index]?.type === 'gate'
      ) {
        const lesson = learningEntries.get('beginner-24'),
          suggestion = el('div');
        suggestion.dataset.coachLesson = lesson.id;
        suggestion.append(
          el(
            'p',
            `${txt('Section', 'Ділянка')} ${measured.index + 1}: ${seconds(measured.ticks)}. ${
              lostSector
                ? txt(
                    `${seconds(lostSector.loss)} longer than the same section in your best flight with these settings.`,
                    `На ${seconds(lostSector.loss)} довше за ту саму ділянку у вашому найкращому польоті з цими налаштуваннями.`,
                  )
                : txt('Your longest completed section.', 'Ваша найдовша пройдена ділянка.')
            }`,
          ),
          button(
            `${txt('Optional gate-sequence lesson', 'Необов’язковий урок проходження воріт')}: ${label(lesson)}`,
            () => {
              if (disposed || token !== flightToken || current !== entry) return;
              const original = demonstrationEntry(entry),
                installed = catalogue.find((item) => keyOf(item) === keyOf(original));
              if (!installed) return;
              lessonReturn = {
                key: keyOf(original),
                identity: dataIdentity(validateWorldCourse(installed.course)),
                course: original.course,
                title: Object.fromEntries(
                  ['en', 'uk'].map((language) => [
                    language,
                    original.course.locales[language].title,
                  ]),
                ),
                mode: proof.mode,
                source: $('flight-source').value,
                camera: $('flight-camera').value,
                response: { ...response },
                playlist: completedPlaylist ? clone(completedPlaylist) : null,
                index: completedPlaylistIndex,
              };
              paintLessonReturn();
              return startFlight(lesson, { mode: proof.mode });
            },
          ),
        );
        resultDetails.append(suggestion);
      }
      const practiceActions = el('section', undefined, 'sim-flight-practice');
      practiceActions.append(
        el('h3', txt('Watch → Try → Repeat', 'Дивіться → спробуйте → повторіть')),
      );
      if (!entry.legacy)
        practiceActions.append(
          button(txt('Watch this section', 'Переглянути цю ділянку'), () =>
            startFlight(entry, {
              checkpoint: {
                mode: proof.mode,
                index: lostSector?.index ?? resultSummary.weakest,
                proof,
                watch: true,
              },
            }),
          ),
          button(
            lostSector
              ? txt('Practise biggest time loss', 'Тренувати ділянку з найбільшою втратою часу')
              : txt('Practise longest section', 'Тренувати найдовшу ділянку'),
            () =>
              startFlight(entry, {
                checkpoint: {
                  mode: proof.mode,
                  index: lostSector?.index ?? resultSummary.weakest,
                  proof,
                },
              }),
          ),
        );
      if (demonstrationFor(entry, proof.mode))
        practiceActions.append(
          button(txt('Watch example', 'Переглянути приклад'), () =>
            watchDemonstration(entry, proof.mode),
          ),
        );
      $('result-panel').append(practiceActions);
      const resultActions = el('div', undefined, 'button-row');
      resultActions.append(
        button(txt('Fly again', 'Летіти ще раз'), () => $('world-retry').click(), 'primary'),
      );
      if (!$('world-next').disabled)
        resultActions.append(
          button(txt('Next flight', 'Наступний політ'), () => $('world-next').click(), 'primary'),
        );
      if (entry.beginner && state.status === 'complete' && !isPreview)
        resultActions.append(
          button(
            !nextLearningEntry(entry)
              ? txt('Return to your course', 'Повернутися до курсу')
              : txt('Next lesson', 'Наступний урок'),
            () => nextLearningFlight(),
            'primary',
          ),
        );
      if (entry.beginner && state.status === 'complete' && !nextLearningEntry(entry))
        resultActions.append(
          button(
            txt('Explore more worlds', 'Досліджувати інші світи'),
            async () => {
              await closeFlight();
              showTab('explore');
            },
            'primary',
          ),
        );
      resultActions.append(
        button(
          entry.beginner
            ? txt('Back to Flight School', 'До льотної школи')
            : txt('Back to lobby', 'До меню'),
          async () => {
            await closeFlight();
            if (entry.beginner) showTab('learn');
          },
        ),
      );
      $('result-panel').append(resultActions);
      if (!isPreview && !entry.beginner && !completedPlaylist)
        $('result-panel').append(randomFlightControl(entry.world, true));
      presentation.resume();
      practiceActions.append(
        button(txt('Watch your flight', 'Переглянути свій політ'), () =>
          startFlight(entry, { preview: true, replayProof: proof }),
        ),
      );
    } catch (error) {
      if (token === flightToken) $('result-panel').append(el('p', error.message));
      throw error;
    }
  }
  function finishPlayback() {
    if (finished) return;
    flight?.pause();
    presentation.resume();
    finished = true;
    input.enable(false);
    fire = false;
    audio.pause();
    $('result-panel').hidden = false;
    if (replayKind === 'section' && checkpointSession) {
      const entry = current,
        request = checkpointRequest,
        complete = checkpointSession.sectionComplete;
      $('result-panel').replaceChildren(
        el(
          'h2',
          complete
            ? txt('Section replay complete', 'Перегляд ділянки завершено')
            : txt('Unfinished section recording', 'Запис незавершеної ділянки'),
        ),
        el(
          'p',
          complete
            ? txt(
                'The recording reaches this objective. Practise from its exact recorded entry state.',
                'Запис досягає цієї цілі. Тренуйтеся з точного записаного стану входу.',
              )
            : txt(
                'This attempt ended before the objective was completed. Only its recorded commands were shown.',
                'Ця спроба закінчилася до виконання цілі. Показано лише наявні записані команди.',
              ),
        ),
        el(
          'small',
          `${txt('Section', 'Ділянка')} ${checkpointSession.index + 1} · ${((checkpointSession.endTick - checkpointSession.startTick) / 50).toFixed(2)} s · ${txt('No records, medals or playlist progress change.', 'Записи, медалі та поступ у добірці не змінюються.')}`,
        ),
        button(
          txt('Practise this section', 'Тренувати цю ділянку'),
          () => startFlight(entry, { checkpoint: { ...request, watch: false } }),
          'primary',
        ),
        button(txt('Watch again', 'Переглянути ще раз'), () =>
          startFlight(entry, { checkpoint: request }),
        ),
        button(txt('Fly full challenge', 'Виконати повне завдання'), () => startFlight(entry)),
      );
      $('flight-status').textContent = complete
        ? txt(
            'Section replay complete. Practise when you are ready.',
            'Перегляд ділянки завершено. Почніть тренування, коли будете готові.',
          )
        : txt(
            'The available recording ends here; this section was not completed.',
            'Наявний запис закінчується тут; цю ділянку не завершено.',
          );
      return;
    }
    $('result-panel').replaceChildren(
      el(
        'h2',
        replayKind === 'demonstration'
          ? txt('Demonstration complete', 'Демонстрацію завершено')
          : txt('Playback ended', 'Відтворення завершено'),
      ),
      el(
        'p',
        txt(
          'Watching does not change your completion, medals or playlist progress.',
          'Перегляд не змінює ваші результати, медалі чи поступ у добірці.',
        ),
      ),
      button(txt('Try it yourself', 'Спробувати самому'), () => practiceAction('try'), 'primary'),
      button(txt('Watch again', 'Переглянути ще раз'), () =>
        startFlight(current, {
          preview: true,
          replayProof,
          demonstration: replayKind === 'demonstration',
        }),
      ),
    );
    $('flight-status').textContent = txt(
      'Playback ended. Fly the challenge when you are ready.',
      'Відтворення завершено. Спробуйте завдання, коли будете готові.',
    );
  }
  function refreshFlightMenus() {
    paintRegionalPreparation();
    cameraControls?.refresh();
    flightSetup?.refresh();
    flightComfort?.refresh();
    practiceFlow?.refresh();
  }
  function currentRouteGuide(state) {
    if (state?.encounter || current?.regional) return null;
    return selectWorldRouteGuide(admittedRouteGuides, {
      mode: $('flight-mode').value,
      step: state?.step,
      aircraftRadiusMm: Math.ceil(
        state?.aircraftRadiusMm ?? current?.course.rules?.droneRadius ?? 220,
      ),
    });
  }
  function routeGuideFeedback(state) {
    if (currentRouteGuide(state)) return '';
    return (
      routeGuideProblem ||
      txt(
        'No checked route trail here. Follow objective markers.',
        'Тут немає перевіреного маршруту. Орієнтуйтеся на маркери цілей.',
      )
    );
  }
  function drawFlight(state) {
    refreshFlightMenus();
    return renderer?.draw?.(state, {
      cameraMode: $('flight-camera').value,
      cameraFov: Number($('world-fov').value),
      cameraTilt: Number($('world-tilt').value),
      ...cameraControls?.presentationOptions(),
      routeGuide: currentRouteGuide(state),
      presentationPaused:
        !sceneReady ||
        doc.visibilityState === 'hidden' ||
        flightMenuOpen() ||
        Boolean(doc.querySelector('dialog[open]:not(#flight-dialog)')),
    });
  }
  function frame(now) {
    if (disposed) return;
    raf = win.requestAnimationFrame(frame);
    try {
      advanceFrame(now);
    } catch (error) {
      pauseFlight(true, 'error');
      reportError(error);
    }
  }
  function pumpFlightSteps() {
    if (
      disposed ||
      combatReplaySource ||
      !flight ||
      !sceneReady ||
      !$('flight-dialog').open ||
      doc.visibilityState === 'hidden' ||
      (doc.hasFocus && !doc.hasFocus()) ||
      doc.querySelector('dialog[open]:not(#flight-dialog)') ||
      flightMenuOpen() ||
      $('flight-dialog').dataset.optionsOpen === 'true' ||
      $('flight-dialog').dataset.immersiveControls === 'true' ||
      beginnerCoach.blocksArm()
    )
      return;
    const executedAt = win.performance?.now?.() ?? lastExecutionTime;
    if (lastExecutionTime !== null && executedAt - lastExecutionTime > 250) {
      pauseFlight(true, 'focus-lost');
      return;
    }
    while (accumulator >= 20) {
      const beforeState = readFlightState();
      if (beforeState.status !== 'active') break;
      if (flight.stepPending?.()) {
        // Retain five waiting intervals while the single worker owns this interval.
        accumulator = Math.min(accumulator, 100);
        break;
      }
      accumulator -= 20;
      let controls =
        !replayProof && !combatReplaySource && $('flight-source').value === 'radio'
          ? radio.poll()
          : !replayProof && !combatReplaySource && $('flight-source').value === 'controller'
            ? gamepad.sample(0.02)
            : input.sample(0.02);
      if (replayProof) {
        if (replayKind === 'section' && beforeState.ticks >= checkpointSession.endTick) {
          pauseFlight(false);
          finishPlayback();
          break;
        }
        const row = replayProof.frames[beforeState.ticks - replayStartTick];
        if (!row) {
          pauseFlight(false);
          finishPlayback();
          break;
        }
        controls = Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle'].map((k, i) => [k, row[i] / 1000]),
        );
      }
      if (
        !replayProof &&
        !combatReplaySource &&
        $('flight-source').value === 'radio' &&
        !radio.status().active
      ) {
        pauseFlight(false);
        break;
      }
      const before = beforeState.ticks;
      const beforeCombat = beforeState.encounter?.ticks ?? -1;
      const selectedFlight = flight,
        selectedToken = flightToken,
        selectedPause = pauseRevision;
      const inputSource =
        replayProof || combatReplaySource ? 'recording' : $('flight-source').value;
      const sampledDiagnostics =
        inputSource === 'radio'
          ? radio.diagnostics({ refresh: false })
          : inputSource === 'controller'
            ? gamepad.diagnostics()
            : input.diagnostics();
      const result = (flight.stepFrame ?? flight.step).call(
        flight,
        current.legacy && !flight.combatDefinition
          ? controls
          : {
              ...controls,
              actions: replayProof
                ? replayProof.frames[before - replayStartTick][4]
                : fire ||
                    ($('flight-source').value === 'radio' &&
                      stagedRadioAction.fire(radio.fireHeld(), flight)) ||
                    ($('flight-source').value === 'controller' && gamepad.preview().fire)
                  ? 1
                  : 0,
            },
      );
      if (result && typeof result.then === 'function') {
        accumulator = Math.min(accumulator, 100);
        let acceptedStep = false;
        pendingFlightSteps.add(selectedFlight);
        // Render the committed state while the worker owns a mission interval.
        void result
          .then((state) => {
            if (disposed || flight !== selectedFlight) return;
            if (state.ticks > before || (state.encounter?.ticks ?? -1) > beforeCombat) {
              acceptedStep = true;
              inputDiagnostics.record(
                selectedFlight,
                inputSource,
                controls,
                sampledDiagnostics,
                state,
              );
              observeCombat(state);
              renderer?.observePresentation?.(state);
              audio.update(state, { active: state.status === 'active' });
              if (!state.encounter && !current.legacy && !current.regional)
                huntReactions.consume(state);
            }
            if (state.encounter && state.status === 'paused' && state.reason !== 'terrain-required')
              pauseFlight();
            if (state.reason === 'terrain-required')
              void prepareRegionalFlight().catch(reportError);
            else if (
              ['region-edge', 'worker-error', 'duration-limit', 'recording-limit'].includes(
                state.reason,
              )
            )
              pauseFlight(true, state.reason);
            updateHUD(state);
          })
          .catch((error) => {
            if (disposed || flight !== selectedFlight) return;
            pauseFlight(true, 'error');
            updateHUD(selectedFlight.snapshot());
            reportError(error);
          })
          .finally(() => {
            pendingFlightSteps.delete(selectedFlight);
            if (
              !acceptedStep ||
              disposed ||
              flight !== selectedFlight ||
              flightToken !== selectedToken ||
              pauseRevision !== selectedPause
            )
              return;
            try {
              pumpFlightSteps();
            } catch (error) {
              pauseFlight(true, 'error');
              reportError(error);
            }
          });
        break;
      }
      // Snapshot once at the accepted boundary. Every observer sees the same
      // committed interval without cloning the complete crowd for each field.
      const afterState = readFlightState();
      if (
        flight.combatDefinition &&
        afterState.status === 'paused' &&
        afterState.reason !== 'terrain-required'
      )
        pauseFlight();
      if (current.regional && afterState.reason === 'terrain-required') {
        void prepareRegionalFlight().catch(reportError);
        break;
      }
      if (current.regional && afterState.reason === 'region-edge') {
        pauseFlight();
        $('flight-status').textContent = txt(
          'Region boundary reached. Reset to return to the launch point.',
          'Межу регіону досягнуто. Перезапустіть, щоб повернутися до старту.',
        );
        break;
      }
      if (afterState.ticks > before || (afterState.encounter?.ticks ?? -1) > beforeCombat) {
        if (!replayProof)
          inputDiagnostics.record(flight, inputSource, controls, sampledDiagnostics, afterState);
        observeCombat(afterState);
        renderer?.observePresentation?.(afterState);
        audio.update(afterState, {
          active: !replayProof && afterState.status === 'active',
        });
        if (!flight.combatDefinition && !replayProof && !current.legacy && !current.regional) {
          const snapshot = afterState;
          huntReactions.consume(snapshot);
          const defeats = snapshot.events
            .filter((event) => ['catch', 'defeat'].includes(event.type))
            .map((event) => {
              const actor = current.course.actors?.find((row) => row.id === event.actor);
              return {
                family:
                  event.type === 'catch'
                    ? actor?.speed > 0
                      ? 'patroller'
                      : 'lookout'
                    : ({
                        sentry: 'guard',
                        patrol: 'patroller',
                        drone: 'drone',
                        vehicle: 'vehicle',
                      }[actor?.type] ??
                      actor?.type ??
                      'lookout'),
              };
            });
          if (defeats.length) void enemyStatistics.observe({ sequence: snapshot.ticks, defeats });
        }
        if (recorder) {
          if (current.legacy) recorder.record(controls);
          else recorder.record();
          if (!practiceContinuation) sectors.consume(afterState);
        }
        const recoveryTick = afterState.combatRecording?.retainedTo ?? afterState.ticks;
        if (recoveryTick % 250 === 0) void saveRecovery().catch(reportError);
      }
      if (
        replayKind === 'section' &&
        replayProof &&
        afterState.ticks >= checkpointSession.endTick
      ) {
        finishPlayback();
        break;
      }
    }
  }
  function advanceFrame(now) {
    const executedAt = win.performance?.now?.() ?? now,
      executionDelta = lastExecutionTime === null ? 0 : executedAt - lastExecutionTime;
    lastExecutionTime = executedAt;
    // A queued rAF may retain a pre-stall timestamp. Freeze before polling
    // device actions or advancing flight, actors and projectiles in that callback.
    if (
      flight &&
      $('flight-dialog').open &&
      (executionDelta > 250 || (lastTime !== null && now - lastTime > 250))
    ) {
      // A paused flight cannot consume elapsed time. Checkpoint/terrain work
      // may delay this callback; pausing again would cancel its recovery.
      // Explicit pause, blur and context-loss handlers still clear ownership.
      if (['paused', 'disarmed'].includes(readFlightState()?.status)) {
        lastTime = null;
        accumulator = 0;
        return;
      }
      pauseFlight(true, 'focus-lost');
      return;
    }
    pollGamepad(executedAt);
    pollMenu(executedAt);
    if (!flight || !$('flight-dialog').open) return;
    if (
      !replayProof &&
      !combatReplaySource &&
      ($('flight-source').value === 'radio' || beginnerCoach.wantsRadioPreview?.()) &&
      !radio.status().verified &&
      now - lastRadioDiscovery > 1000
    ) {
      lastRadioDiscovery = now;
      restoreRadio();
    }
    const elapsed = lastTime === null ? 0 : now - lastTime;
    continuousPlay.advance(elapsed);
    lastTime = now;
    if (elapsed > 250) {
      pauseFlight(true, 'focus-lost');
      return;
    }
    // Observe a deliberate radio OFF→ON edge while paused as well as flying.
    // freeze() requires seeing OFF again after blur/setup; a held ON switch
    // therefore cannot resume a flight simply because the tab regained focus.
    if (
      sceneReady &&
      !(current?.regionalAdvanced && regionalAdvancedControls?.busy) &&
      (!current.regional || readFlightState()?.reason === 'prepared') &&
      !ghostLookup &&
      !pendingFlightSteps.has(flight) &&
      !replayProof &&
      !combatReplaySource &&
      $('flight-source').value === 'radio' &&
      ['paused', 'disarmed'].includes(readFlightState()?.status) &&
      radio.status().verified &&
      doc.visibilityState !== 'hidden' &&
      (!doc.hasFocus || doc.hasFocus()) &&
      !doc.querySelector('dialog[open]:not(#flight-dialog)') &&
      !flightMenuOpen() &&
      $('flight-dialog').dataset.optionsOpen !== 'true' &&
      $('flight-dialog').dataset.immersiveControls !== 'true' &&
      !beginnerCoach.blocksArm()
    ) {
      radio.poll();
      if (radio.status().active && flight) {
        input.enable(true);
        flight.arm();
        huntReactions.resume();
        void audio
          .resume()
          .then(() => huntReactions.prepare())
          .catch(reportError);
        appearanceSession.arm(readFlightState()?.status);
        fire = false;
        accumulator = 0;
        $('flight-status').textContent = txt('Flight active.', 'Політ триває.');
      }
    }
    if (combatReplaySource) {
      advanceCombatPlayback(elapsed);
    } else if (readFlightState()?.status === 'active') {
      audio.update(readFlightState(), { active: !replayProof });
      accumulator += elapsed * (replayProof ? replayRate : 1);
      pumpFlightSteps();
    }
    const state = readFlightState();
    if (beginnerCoach.blocksArm() && state.status !== 'active') {
      // The opaque guide owns the screen. Keep controller/lifecycle sampling
      // current without rendering a covered WebGL scene and hidden flight HUD.
      paintCoach(state);
      return;
    }
    if (state.status === 'active') presentation.pause();
    audio.update(state, {
      active: !replayProof && (combatPlayback ? combatPlayback.playing : state.status === 'active'),
    });
    if (
      sceneReady &&
      ['paused', 'disarmed'].includes(state.status) &&
      !terminal(state) &&
      (missionChooser?.elements.dialog.open || $('sim-settings').open)
    ) {
      // These opaque dialogs cover the retained flight. Device/menu polling,
      // audio and asynchronous source/graphics preparation keep their ownership;
      // only covered scene/HUD observers wait until the dialog closes.
      return;
    }
    // Do not submit an intermediate scene while its assets or shaders are preparing.
    if (sceneReady) drawFlight(state);
    const cue =
      sceneReady && ['fpv', 'chase'].includes($('flight-camera').value)
        ? renderer?.objectiveScreen?.(state)
        : null;
    flightHud.setWorldCue(
      !cue || current?.freeFlight || beginnerCoach.blocksArm()
        ? null
        : {
            ...cue,
            label: cue.approach
              ? txt('Return to entry side', 'Поверніться на захід')
              : cue.heightOnly
                ? cue.vertical > 0
                  ? txt('Climb gently', 'Плавно вгору')
                  : txt('Descend gently', 'Плавно вниз')
                : cue.occluded
                  ? txt('Find a clear view', 'Знайдіть пряму видимість')
                  : cue.type === 'gate' || cue.type === 'crossing-v1'
                    ? txt('Through here', 'Пролетіть тут')
                    : cue.type === 'land'
                      ? txt('Landing pad', 'Майданчик')
                      : cue.type === 'hunt-contact-v1'
                        ? txt('Touch', 'Торкніться')
                        : cue.type === 'eliminate'
                          ? txt('Fire', 'Вогонь')
                          : cue.type === 'actor-track-v1'
                            ? txt('Follow / observe', 'Стежте')
                            : txt('Target zone', 'Цільова зона'),
          },
    );
    const aim = renderer?.aimScreen?.();
    flightHud.setAim(aim);
    if (aim) {
      $('aim-reticle').style.left = `${aim.x * 100}%`;
      $('aim-reticle').style.top = `${aim.y * 100}%`;
      $('aim-reticle').hidden = !aim.visible;
    }
    updateHUD(state);
    paintInput(state);
    if (terminal(state) && !combatReplaySource) void finishFlight(flightToken).catch(reportError);
  }
  const freeFlightNotice = () =>
    txt(
      'Free flight · no time limit · unscored',
      'Вільний політ · без обмеження часу · без заліку',
    );
  const modePracticeNotice = () =>
    practiceContinuation
      ? txt(
          recorder?.recordingStatus?.().exhausted
            ? 'Practice continuation · unscored · recording full'
            : 'Practice continuation · unscored · original recording preserved',
          recorder?.recordingStatus?.().exhausted
            ? 'Продовження практики · без заліку · запис заповнений'
            : 'Продовження практики · без заліку · початковий запис збережено',
        )
      : txt(
          'Self-level practice · no score. Acro is needed for these manoeuvres.',
          'Практика із самовирівнюванням · без заліку. Для цих маневрів потрібен Acro.',
        );
  function paintContinuationRecordingNotice() {
    const recording = recorder?.recordingStatus?.(),
      exhausted = Boolean(practiceContinuation && recording?.exhausted),
      control = $('export-flight');
    if (!exhausted) {
      if (continuationRecordingNotice) continuationRecordingNotice.hidden = true;
      if (control.getAttribute('aria-describedby') === 'world-recording-limit')
        control.removeAttribute('aria-describedby');
      return;
    }
    if (!continuationRecordingNotice) {
      continuationRecordingNotice = el('small', undefined, 'hint');
      continuationRecordingNotice.id = 'world-recording-limit';
      continuationRecordingNotice.setAttribute('role', 'status');
    }
    if (continuationRecordingNotice.parentElement !== control.parentElement)
      control.after(continuationRecordingNotice);
    continuationRecordingNotice.hidden = false;
    control.setAttribute('aria-describedby', continuationRecordingNotice.id);
    const seconds = (recording.retainedTick / 50).toFixed(1);
    const text = txt(
      `Recording full. Flight continues. Export and saved Continue retain the attempt at ${seconds} s; later flight is not recorded.`,
      `Запис заповнений. Політ триває. Експорт і збережене продовження залишають спробу на ${seconds} с; подальший політ не записується.`,
    );
    if (continuationRecordingNotice.textContent !== text)
      continuationRecordingNotice.textContent = text;
  }
  let regionalPreparing = null;
  let regionalPreparationStage = 'source';
  let regionalPreparationIssue = null;
  let regionalManifestRequest = null;
  function handleGraphicsContextLoss() {
    regionalPreparationIssue = regionalPreparationFeedback({ contextLost: true });
    sceneReady = false;
    qualityPreparing = false;
    pauseFlight(true, 'context-lost');
    $('flight-status').textContent = txt(
      'Graphics interrupted. Open Menu and Retry after graphics recover.',
      'Графіку перервано. Відкрийте меню й повторіть політ після її відновлення.',
    );
    if (flight && !disposed) updateHUD(readFlightState());
  }
  function paintRegionalPreparation() {
    const controls = regionalRecoveryControls;
    if (!controls) return;
    const issue = current?.regional ? regionalPreparationIssue : null;
    controls.root.hidden = !issue;
    if (!issue) return;
    const message = txt(issue.en, issue.uk);
    if (controls.message.textContent !== message) controls.message.textContent = message;
    const label = txt('Restart with Performance graphics', 'Перезапустити з графікою «Швидкодія»');
    if (controls.restart.textContent !== label) controls.restart.textContent = label;
    controls.restart.hidden = !['graphics-timeout', 'graphics-failed'].includes(issue.kind);
    controls.restart.disabled = Boolean(regionalPreparing || controls.busy);
  }
  async function prepareRegionalFlight() {
    if (regionalPreparing || !current?.regional || !flight) return regionalPreparing;
    pauseFlight();
    sceneReady = false;
    const selected = flight,
      token = flightToken;
    regionalPreparationStage = 'source';
    regionalPreparationIssue = null;
    let timedOut = false;
    const preparationDeadline = new AbortController();
    // The deadline also bounds the final shader wait, not only source staging.
    const wait = (promise) =>
      new Promise((resolve, reject) => {
        const abort = () => reject(preparationDeadline.signal.reason);
        preparationDeadline.signal.addEventListener('abort', abort, { once: true });
        if (preparationDeadline.signal.aborted) abort();
        Promise.resolve(promise)
          .then(resolve, reject)
          .finally(() => preparationDeadline.signal.removeEventListener('abort', abort));
      });
    const timeout = win.setTimeout(() => {
      timedOut = true;
      preparationDeadline.abort(new DOMException('Regional preparation timed out', 'TimeoutError'));
      if (owns()) selected.cancelPreparation();
    }, 30000);
    $('flight-status').textContent = txt('Unscored · Loading area…', 'Без заліку · Завантаження…');
    const owns = () => !disposed && flight === selected && token === flightToken;
    const operation = (async () => {
      try {
        await wait(selected.prepare());
        if (!owns()) return;
        if (['duration-limit', 'recording-limit'].includes(selected.snapshot().reason)) return;
        regionalPreparationStage = 'graphics';
        const graphicsReady = await wait(renderer.prepare({ signal: preparationDeadline.signal }));
        if (!owns()) return;
        if (graphicsReady === false)
          throw new DOMException('Regional graphics preparation replaced', 'AbortError');
        if (selected.combatDefinition && !(await applyCombatArt(renderer, owns))) return;
        if (selected.snapshot().reason !== 'prepared')
          throw new DOMException('Regional preparation cancelled', 'AbortError');
        if (drawFlight(selected.snapshot()) === false)
          throw new Error('Regional scene could not be displayed');
        sceneReady = true;
        $('flight-status').textContent = txt(
          'Unscored · Ready to arm',
          'Без заліку · Готово до польоту',
        );
      } catch (error) {
        if (owns()) {
          sceneReady = false;
          regionalPreparationIssue = regionalPreparationFeedback({
            stage: regionalPreparationStage,
            timedOut,
            error,
            savedStart: Boolean(current.configuration.savedStart),
            contextLost: renderer.resources?.().renderer?.contextLost === true,
          });
          if (
            regionalPreparationIssue.restoreUnavailable &&
            regionalLocationControls?.owner === current
          ) {
            regionalLocationControls.restoreUnavailable = true;
            regionalLocationControls.help.textContent = regionalPlacesHelp();
          }
          $('flight-status').textContent = txt(
            regionalPreparationIssue.en,
            regionalPreparationIssue.uk,
          );
        }
      } finally {
        win.clearTimeout(timeout);
        if (regionalPreparing === operation) regionalPreparing = null;
        if (owns()) updateHUD(selected.snapshot());
      }
    })();
    regionalPreparing = operation;
    updateHUD(selected.snapshot());
    return operation;
  }
  async function startRegionalFlight(entry, options = {}) {
    if (!options.tuningDraft) {
      tuning?.endDraftTest();
      activeTuningDraft = null;
    }
    encounterSelection = selectEncounter(entry, options);
    const token = ++flightToken;
    const ownsLaunch = () => !disposed && token === flightToken && options.isCurrent?.() !== false;
    const canAdopt = () => ownsLaunch() && options.canAdopt?.() !== false;
    industrialPreparation?.abort();
    checkpointPreparation?.abort();
    abortSectorLookup();
    pauseFlight();
    const playbackPauseRevision = pauseRevision;
    await ready;
    if (!canAdopt()) return;
    await initWorldRuntime();
    if (!canAdopt()) return;
    // Validate paired sources before releasing a usable previous flight.
    tuningStore.refresh();
    const baselineConfiguration =
      options.combatPlaybackConfiguration ?? options.tuningDraft ?? tuningStore.effective();
    const tuningConfiguration =
      baselineConfiguration.advanced?.aircraft?.format === 'AdvancedAircraft.v2'
        ? prepareAircraftChallenge(baselineConfiguration, options.challenge)
        : baselineConfiguration;
    const physicalAircraft =
      tuningConfiguration.advanced?.aircraft?.format === 'AdvancedAircraft.v2';
    const regionalAdvanced = Boolean(entry.regionalAdvanced || physicalAircraft);
    if (physicalAircraft) entry = { ...entry, regionalAdvanced: true };
    if (regionalAdvanced && typeof win.Worker !== 'function')
      throw new Error(
        txt('Advanced is unavailable on this platform.', 'Advanced недоступний на цій платформі.'),
      );
    if (regionalAdvanced) {
      regionalNativeLifecycle ??= onNativeInactive(() => pauseFlight(true, 'focus-lost'), {
        locationRef: win.location,
      }).then((remove) => {
        if (disposed) return Promise.resolve(remove());
        removeRegionalNativeInactive = remove;
      });
      await regionalNativeLifecycle;
      if (!canAdopt()) return;
    }
    response = clone(tuningConfiguration.response);
    $('world-fov').value = String(tuningConfiguration.camera.verticalFov);
    $('world-tilt').value = String(tuningConfiguration.camera.tilt);
    input.ratesApplied(
      (regionalAdvanced && !physicalAircraft) || response.format === TUNED_RESPONSE_FORMAT,
    );
    const sessionConfiguration = {
      ...regionalPresentationOptions(entry.configuration, $('flight-quality').value),
      mode:
        regionalAdvanced && !physicalAircraft ? 'acro' : (options.mode ?? $('flight-mode').value),
      response,
      ...(regionalAdvanced
        ? { advanced: tuningConfiguration.advanced, rateProfile: response.rates }
        : {}),
      ...(tuningConfiguration.challenge ? { challenge: tuningConfiguration.challenge } : {}),
      prepareFrame: async (group, options) => {
        if (flight === nextFlight) regionalPreparationStage = 'graphics';
        await renderer.prepareRegionalFrame(group, options);
        if (flight === nextFlight) regionalPreparationStage = 'source';
      },
    };
    let nextFlight = regionalAdvanced
      ? createAdvancedRegionalSession(sessionConfiguration, {
          createClient: () =>
            createAdvancedWorkerClient({
              Worker: win.Worker,
              url: new URL('../fpv-worlds/advanced-worker.mjs', import.meta.url),
            }),
        })
      : createRegionalSession(sessionConfiguration);
    if (physicalAircraft)
      nextFlight = withAircraftChallenge(nextFlight, {
        rules: tuningConfiguration.challenge,
        capacityAh: tuningConfiguration.advanced.aircraft.battery.capacityAh,
      });
    const previousFlight = flight;
    try {
      await retireCombatArchive();
      if (!canAdopt()) {
        await nextFlight.dispose();
        return;
      }
      await stopCombatPlayback();
      if (!canAdopt()) {
        await nextFlight.dispose();
        return;
      }
      if (flight === previousFlight) await previousFlight?.dispose?.();
    } catch (error) {
      await nextFlight.dispose();
      throw error;
    }
    if (!canAdopt()) {
      await nextFlight.dispose();
      return;
    }
    regionalPreparing = null;
    flight = nextFlight;
    combatReplaySource = options.combatReplaySource ?? null;
    combatArchiveResume = options.combatArchiveResume ?? null;
    aircraftAttemptConfiguration = physicalAircraft ? clone(baselineConfiguration) : null;
    workbenchAttemptConfiguration = clone(baselineConfiguration);
    activeTuningDraft = options.tuningDraft ? clone(tuningConfiguration) : null;
    current = entry;
    if (!options.tuningDraft) tuningReturnEntry = null;
    recorder = null;
    checkpointRequest = checkpointSession = replayProof = playingPlaylist = null;
    replayStartTick = 0;
    practiceContinuation = false;
    learningDemoReturn = lessonReturn = null;
    returnToLesson.hidden = true;
    modePractice = false;
    preview = true;
    finished = false;
    sceneReady = false;
    qualityPreparing = false;
    scenePreparationGeneration++;
    beginnerCoach.close();
    restoreLearningPreferences();
    $('flight-mode').value = sessionConfiguration.mode;
    if (options.lessonCamera) $('flight-camera').value = options.lessonCamera;
    $('flight-dialog').classList.remove('learning-flight', 'learning-replay');
    $('flight-dialog').dataset.flightMenuOpen = 'false';
    $('flight-dialog').dataset.optionsOpen = 'false';
    $('world-replay-controls').hidden = true;
    $('result-panel').hidden = true;
    $('flight-mode').disabled =
      $('flight-source').disabled =
      $('radio-setup-button').disabled =
        false;
    $('flight-mode').disabled = regionalAdvanced && !physicalAircraft;
    $('world-touch').hidden = $('flight-source').value !== 'touch';
    sectors.reset();
    sectorReference = sectorReferenceProof = sectorReferenceId = null;
    sectorReferenceStatus = 'unscored';
    ghostEnabled = false;
    fire = false;
    lastTime = null;
    accumulator = 0;
    $('flight-title').textContent = label(entry);
    $('flight-collection').textContent = regionalAdvanced
      ? txt(
          'REGIONAL ADVANCED · EXPERIMENTAL · UNSCORED',
          'РЕГІОН ADVANCED · ЕКСПЕРИМЕНТАЛЬНИЙ · БЕЗ ЗАЛІКУ',
        )
      : entry.regionalReview
        ? txt('REGIONAL REVIEW · UNSCORED', 'ПЕРЕВІРКА РЕГІОНУ · БЕЗ ЗАЛІКУ')
        : [
            txt('REGIONAL FREE FLIGHT · UNSCORED', 'ВІЛЬНИЙ ПОЛІТ У РЕГІОНІ · БЕЗ ЗАЛІКУ'),
            entry.installedRevision,
          ]
            .filter(Boolean)
            .join(' · ');
    $('flight-brief').textContent = $('flight-menu-brief').textContent =
      entry.course.locales[locale].brief;
    $('flight-status').textContent = txt('Preparing region…', 'Підготовка регіону…');
    if (missionChooser?.elements.dialog.open) missionChooser.close();
    playShell?.enterPlay();
    if (playShell) $('flight-dialog').prepend(playShell.elements.header);
    if (!$('flight-dialog').open) $('flight-dialog').showModal();
    renderer ??= rendererFactory({
      canvas: $('world-canvas'),
      window: win,
      onContextLost: handleGraphicsContextLoss,
      reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      createHuntPresentation: (options) =>
        createSnakeHuntPresentation({
          ...options,
          preferences: () => ({
            ...huntPresentationControls.preferences.snapshot(),
            enemyHealthDisplay: combatFeedback.enemyHealth,
          }),
        }),
    });
    if (!renderer.available || !renderer.setRegional)
      throw new Error('Regional rendering is unavailable');
    renderer.resetCombatPresentation?.();
    renderer.setCombatActors?.(null);
    renderer.setRegional(flight, entry.configuration.manifest);
    renderer.setQuality($('flight-quality').value);
    renderer.setDrone($('drone-look').value);
    renderer.setAircraft?.(physicalAircraft ? tuningConfiguration.advanced.aircraft : null);
    aircraftAdvice = physicalAircraft
      ? aircraftCourseAdvice(entry.course, tuningConfiguration.advanced.aircraft)
      : null;
    audio.setCourse(entry.course);
    huntReactions.suspend();
    paintLoadout();
    refreshEnemyGuide();
    paintLessonReturn();
    input.select($('flight-source').value);
    restoreRadio();
    await prepareRegionalFlight();
    if (!ownsLaunch()) return;
    if (sceneReady && encounterSelection.activity !== 'original') {
      const savedDefinition =
        (options.combatReplaySource ?? options.combatRecovery)
          ? inspectEncounterRecovery(combatRecoveryOf(options)).definition
          : null;
      const spawn = Object.fromEntries(
        ['x', 'y', 'z'].map((axis) => [axis, Math.round(readFlightState()?.position[axis])]),
      );
      const geometry = createRegionalEncounterGeometry(flight.encounterGeometry(), {
        bounds: entry.course.bounds,
        player: savedDefinition?.spawn ?? spawn,
      });
      const regionalBase = flight;
      let encounterFlight = null;
      try {
        const course = { ...entry.course, bounds: geometry.area, spawn },
          baseIdentity = combatBaseIdentity(entry);
        const authored = ['FPVEncounterDefinition.v1', 'FPVEncounterDefinition.v2'].includes(
          options.encounter?.format,
        )
          ? options.encounter
          : savedEncounterBundle(baseIdentity);
        const definition = prepareEncounterDefinition({
          course,
          baseIdentity,
          selection: encounterSelection,
          authored,
          recovery: combatRecoveryOf(options),
          admitActor: geometry.admitActor,
          admitServicePad: geometry.admitServicePad,
        });
        encounterFlight = await createEncounterSession(regionalBase, {
          definition,
          geometry,
          regional: true,
          runId: combatRecoveryOf(options)?.gameplay?.encounter?.state?.runId,
        });
        if (!ownsLaunch() || flight !== regionalBase) {
          await encounterFlight.dispose();
          return;
        }
        flight = encounterFlight;
        renderer.setRegional(encounterFlight, entry.configuration.manifest);
        observeCombat(encounterFlight.snapshot());
        if (!(await restoreCombat(options.combatRecovery, ownsLaunch)) || !ownsLaunch()) return;
        await renderer.prepare();
        if (!(await applyCombatArt(renderer, ownsLaunch))) return;
        if (!ownsLaunch() || flight !== encounterFlight) return;
      } catch (error) {
        if (!ownsLaunch()) {
          if (encounterFlight && flight !== encounterFlight) await encounterFlight.dispose();
          else if (!encounterFlight) geometry.dispose?.();
          return;
        }
        if (encounterFlight) {
          pauseFlight();
          throw error;
        }
        geometry.dispose?.();
        if (options.combatRecovery || options.combatReplaySource) {
          pauseFlight();
          throw new Error(
            txt(
              `The saved combat session could not be continued: ${error.message}. Open the same map, starting point and flight settings, then try again.`,
              `Не вдалося продовжити збережений бій: ${error.message}. Відкрийте ту саму мапу, початкову точку й налаштування польоту та повторіть спробу.`,
            ),
          );
        }
        encounterUnavailable = txt(
          `Combat is unavailable here: ${error.message}. Choose another start or author an encounter in Studio.`,
          `Бій тут недоступний: ${error.message}. Оберіть інший старт або створіть бій у Студії.`,
        );
        encounterSelection = { ...encounterSelection, activity: 'original' };
      }
    }
    if (
      options.combatReplaySource &&
      !(await prepareCombatPlayback(
        options.combatReplaySource,
        ownsLaunch,
        options.combatPlaybackPaused || pauseRevision !== playbackPauseRevision,
      ))
    )
      return;
    paintInput(readFlightState());
    updateHUD(readFlightState());
    $('world-viewport').focus();
    // Review launch, reset and mode changes always await deliberate arming.
  }
  async function reviewRegion(options) {
    regionalManifestRequest?.abort();
    pauseFlight();
    const request = new AbortController();
    regionalManifestRequest = request;
    const timeout = win.setTimeout(() => request.abort(), 30000);
    try {
      const configuration = await loadRegionalReview({
        ...options,
        pageURL: win.location.href,
        signal: request.signal,
      });
      if (!disposed && regionalManifestRequest === request)
        await startRegionalFlight(regionalReviewEntry(configuration));
    } finally {
      win.clearTimeout(timeout);
      if (regionalManifestRequest === request) regionalManifestRequest = null;
    }
  }
  async function startFlight(entry, options = {}) {
    if (!options.tuningDraft) {
      tuning?.endDraftTest();
      activeTuningDraft = null;
    }
    if (entry.regional) return startRegionalFlight(entry, options);
    regionalManifestRequest?.abort();
    const requestedCamera =
      options.lessonCamera ??
      (options.checkpoint && current?.id === entry.id ? $('flight-camera').value : null);
    enemyGuide.close();
    if (disposed) return;
    if (
      lessonReturn &&
      options.returning !== lessonReturn &&
      keyOf(entry) !== keyOf(learningEntries.get('beginner-24'))
    ) {
      lessonReturn = null;
      paintLessonReturn();
    }
    // Refreshing the unarmed world's appearance is not a new navigation step.
    // Keep its settings/menu and keyboard focus where the player left them.
    if (!options.preserveFocus) {
      if (missionChooser?.elements.dialog.open) missionChooser.close();
      playShell?.enterPlay();
    }
    if (playShell) $('flight-dialog').prepend(playShell.elements.header);
    if (
      learningDemoReturn &&
      !options.lessonDemo &&
      !options.replayProof &&
      !options.checkpoint?.watch
    ) {
      if (options.mode === undefined) options = { ...options, mode: learningDemoReturn.mode };
      learningDemoReturn = null;
    }
    returnToLesson.hidden = !learningDemoReturn;
    $('flight-dialog').classList.toggle('learning-replay', Boolean(learningDemoReturn));
    returnToLesson.textContent = txt('Return to practice', 'Повернутися до практики');
    const requestedMode =
      options.mode ??
      recordingMetadata(options.replayProof)?.mode ??
      recordingMetadata(options.recover)?.mode ??
      options.checkpoint?.mode ??
      $('flight-mode').value;
    const token = ++flightToken,
      priorSceneReady = sceneReady;
    industrialPreparation?.abort();
    industrialPreparation = null;
    checkpointPreparation?.abort();
    checkpointPreparation = null;
    if (!options.preserveFocus) $('flight-dialog').dataset.flightMenuOpen = 'false';
    qualityPreparing = false;
    scenePreparationGeneration++;
    abortSectorLookup();
    pauseFlight();
    radio.reset({ notify: false });
    const playbackPauseRevision = pauseRevision;
    // After adoption, finish preparation while paused so Continue stays usable;
    // only this launch lease may reopen the scene, focus it or arm it.
    const ownsAttempt = () => !disposed && token === flightToken;
    const ownsLaunch = () => ownsAttempt() && options.isCurrent?.() !== false;
    await saveRecovery();
    if (!ownsLaunch()) return;
    await retireCombatArchive();
    if (!ownsLaunch()) return;
    await stopCombatPlayback();
    if (!ownsLaunch()) return;
    await ready;
    if (!ownsLaunch()) return;
    // Admit the native runtime before replacing an accepted attempt. A later
    // Home action keeps the old scene ready to Continue.
    if (!entry.legacy) await initWorldRuntime();
    if (!ownsLaunch()) return;
    const retained = Boolean(
      options.recover ||
        options.replayProof ||
        options.checkpoint?.proof ||
        entry.course.world?.themeProfile?.format === 'ThemeProfile.v3',
    );
    const sourceCourse = retained
      ? entry.course
      : entry.appearanceCourse === entry.course
        ? entry.sourceCourse
        : entry.course;
    const selectedAppearance = retained
      ? (options.presentation ?? entry.presentation ?? recordedSimAppearance(sourceCourse))
      : appearanceControls.resolve().appearance;
    const acceptedAppearance = validateSimAppearance(selectedAppearance);
    const playableAppearance = playableSimAppearance(acceptedAppearance);
    let acceptedEnvironment = null;
    if (!entry.legacy) {
      const controller = new AbortController();
      industrialPreparation = controller;
      try {
        acceptedEnvironment = await prepareNativeIndustrialAttempt({
          entry: { ...entry, course: sourceCourse },
          mode: requestedMode,
          presentation: acceptedAppearance,
          artRevision: runtimeActorArtRevision(win.location),
          retained,
          signal: controller.signal,
        });
      } catch (error) {
        if (disposed || token !== flightToken || controller.signal.aborted) return;
        sceneReady = priorSceneReady;
        if (flight) updateHUD(readFlightState());
        throw error;
      } finally {
        if (industrialPreparation === controller) industrialPreparation = null;
      }
      if (disposed || token !== flightToken) return;
    }
    if (acceptedEnvironment) {
      entry = {
        ...entry,
        sourceCourse: acceptedEnvironment.sourceCourse,
        course: acceptedEnvironment.course,
        appearanceCourse: acceptedEnvironment.course,
      };
    } else if (!entry.legacy && !retained) {
      const themeProfile = snapshotSimThemeProfile(sourceCourse, playableAppearance.appearance);
      if (acceptedAppearance.drone) themeProfile.drone = acceptedAppearance.drone;
      const preparedCourse = {
        ...sourceCourse,
        world: { ...sourceCourse.world, themeProfile, theme: themeProfile.id },
      };
      entry = {
        ...entry,
        sourceCourse,
        course: preparedCourse,
        appearanceCourse: preparedCourse,
      };
    } else
      entry = {
        ...entry,
        sourceCourse: options.checkpoint ? (entry.sourceCourse ?? sourceCourse) : sourceCourse,
        appearanceCourse: entry.course,
      };
    appearanceSession.begin(acceptedAppearance, {
      retained: retained || Boolean(acceptedEnvironment),
    });
    if (entry.legacy) entry.presentation = acceptedAppearance;
    await flight?.dispose?.();
    if (!ownsAttempt()) return;
    flight = null;
    combatReplaySource = options.combatReplaySource ?? null;
    combatArchiveResume = options.combatArchiveResume ?? null;
    current = entry;
    if (!options.tuningDraft) tuningReturnEntry = null;
    if (!options.replayProof && !options.preview && !options.checkpoint && !entry.freeFlight)
      lastCatalogueFlightKey = keyOf(entry);
    recorder = null;
    checkpointRequest = options.checkpoint ?? null;
    checkpointSession = null;
    $('flight-mode').value = requestedMode;
    refreshEnemyGuide();
    encounterSelection = selectEncounter(entry, options);
    const needsAcro =
      encounterSelection.activity === 'original' &&
      !entry.legacy &&
      worldCourseRequiresAcro(entry.course);
    modePractice = needsAcro && requestedMode === 'self-level';
    const learning =
      encounterSelection.activity === 'original' &&
      !options.tuningDraft &&
      (!checkpointRequest || checkpointRequest.watch) &&
      learningById.get(entry.beginner);
    if (learning) {
      tuningStore.refresh();
      const selectedLibrary = tuningStore.snapshot();
      const selectedSetup = selectedLibrary.setups.find(
        (setup) => setup.id === selectedLibrary.selectedSetupId,
      );
      learningPreferences ??= {
        'flight-camera': $('flight-camera').value,
      };
      learningResponse ??= { ...response };
      response = { ...DEFAULT_RESPONSE };
      $('flight-camera').value =
        requestedCamera ?? (requestedMode === 'acro' ? 'fpv' : learning.camera);
      beginnerCoach.open(learning, {
        mode: requestedMode,
        keyboardPreset: $('flight-keyboard-preset').value,
        modePractice,
        demonstration: demonstrationFor({ ...entry, course: learning.course }, requestedMode),
        recommendedDemonstration: demonstrationFor(
          { ...entry, course: learning.course },
          learning.mode,
        ),
        practice: Boolean(options.recover),
        replay: Boolean(options.replayProof || checkpointRequest?.watch),
        practiceAircraftName:
          !options.replayProof &&
          !checkpointRequest &&
          selectedSetup?.advanced?.aircraft?.format === 'AdvancedAircraft.v2'
            ? selectedSetup.name
            : null,
      });
    } else {
      beginnerCoach.close();
      restoreLearningPreferences();
    }
    if (['fpv', 'chase', 'overview'].includes(requestedCamera))
      $('flight-camera').value = requestedCamera;
    $('flight-dialog').classList.toggle('learning-flight', Boolean(learning));
    preview =
      Boolean(entry.freeFlight) ||
      modePractice ||
      Boolean(checkpointRequest) ||
      Boolean(options.replayProof || options.combatReplaySource) ||
      (options.preview ?? false);
    playingPlaylist =
      checkpointRequest || modePractice || entry.freeFlight ? null : (options.playlist ?? null);
    playlistIndex = options.index ?? 0;
    finished = false;
    sceneReady = false;
    $('world-arm').disabled = true;
    // Section preparation owns its bounded, verified proof. Do not separately
    // clone or replay the untrusted caller's frames before that preparation.
    replayProof = !checkpointRequest && options.replayProof ? clone(options.replayProof) : null;
    replayStartTick = 0;
    practiceContinuation = false;
    paintContinuationRecordingNotice();
    replayKind = options.demonstration ? 'demonstration' : 'recording';
    if (learning && options.demonstration) replayRate = options.playbackRate ?? 0.5;
    $('world-replay-controls').hidden = !replayProof;
    $('world-replay-label').textContent =
      replayKind === 'demonstration'
        ? learning
          ? txt(
              'LESSON DEMONSTRATION · RECORDED CONTROLS',
              'ДЕМОНСТРАЦІЯ УРОКУ · ЗАПИСАНЕ КЕРУВАННЯ',
            )
          : entry.legacy
            ? txt('ACADEMY DEMONSTRATION', 'ДЕМОНСТРАЦІЯ АКАДЕМІЇ')
            : txt('WORLD DEMONSTRATION', 'ДЕМОНСТРАЦІЯ СВІТУ')
        : txt('RECORDED FLIGHT', 'ЗАПИСАНИЙ ПОЛІТ');
    $('world-replay-rate').value = String(replayRate);
    $('flight-mode').disabled = false;
    $('flight-source').disabled = Boolean(replayProof);
    $('radio-setup-button').disabled = Boolean(replayProof);
    $('world-touch').hidden = Boolean(replayProof) || $('flight-source').value !== 'touch';
    sectors.reset();
    sectorReference = null;
    sectorReferenceProof = null;
    ghostEnabled = !preview && (options.recover ? options.ghostEnabled === true : ghostEnabled);
    sectorReferenceId = options.recover ? (options.sectorReferenceId ?? null) : null;
    sectorReferenceStatus =
      preview || (options.recover && options.recover.session !== 'practice')
        ? 'unscored'
        : options.recover && options.sectorReferenceId === null
          ? 'none'
          : 'checking';
    updateSectorHUD();
    fire = false;
    lastTime = null;
    lastExecutionTime = win.performance?.now?.() ?? null;
    accumulator = 0;
    $('result-panel').hidden = true;
    $('flight-title').textContent = label(entry);
    $('flight-collection').textContent = replayProof
      ? $('world-replay-label').textContent
      : checkpointRequest
        ? txt('SECTION PRACTICE · UNSCORED', 'ТРЕНУВАННЯ ДІЛЯНКИ · БЕЗ ЗАЛІКУ')
        : entry.freeFlight
          ? txt('FREE FLIGHT · UNSCORED', 'ВІЛЬНИЙ ПОЛІТ · БЕЗ ЗАЛІКУ')
          : modePractice
            ? txt('SELF-LEVEL PRACTICE · UNSCORED', 'ПРАКТИКА ІЗ САМОВИРІВНЮВАННЯМ · БЕЗ ЗАЛІКУ')
            : preview
              ? txt('AUTHORING PREVIEW', 'АВТОРСЬКИЙ ПЕРЕГЛЯД')
              : learning
                ? txt('FLIGHT SCHOOL', 'ЛЬОТНА ШКОЛА')
                : localized(WORLD_THEMES.find((t) => t.id === entry.theme)?.title) || entry.world;
    $('flight-brief').textContent = $('flight-menu-brief').textContent = entry.freeFlight
      ? txt(
          'Explore the world for as long as you like. Pause to change flight mode, view or controls. No score or recording is saved.',
          'Досліджуйте світ скільки завгодно. На паузі змінюйте режим польоту, камеру чи керування. Результат і запис польоту не зберігаються.',
        )
      : `${modePractice ? `${modePracticeNotice()} ` : ''}${entry.course.locales[locale].brief}`;
    $('flight-status').textContent = txt('Preparing scene…', 'Підготовка сцени…');
    paintLoadout();
    if (ownsLaunch() && !$('flight-dialog').open) $('flight-dialog').showModal();
    paintLessonReturn();
    if (!renderer)
      renderer = rendererFactory({
        canvas: $('world-canvas'),
        window: win,
        onContextLost: handleGraphicsContextLoss,
        reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        createHuntPresentation: (options) =>
          createSnakeHuntPresentation({
            ...options,
            preferences: () => ({
              ...huntPresentationControls.preferences.snapshot(),
              enemyHealthDisplay: combatFeedback.enemyHealth,
            }),
          }),
      });
    if (!renderer.available)
      throw new Error(
        txt('WebGL is unavailable in this browser.', 'WebGL недоступний у цьому браузері.'),
      );
    if (!ownsAttempt()) return;
    if (replayProof) {
      const proof = replayProof;
      $('flight-status').textContent = txt('Verifying recording…', 'Перевірка запису…');
      const checked = entry.legacy
        ? await replayFlightCooperatively(entry.course, proof)
        : await replayWorldFlight(entry.course, proof);
      if (!ownsAttempt()) return;
      if (
        replayKind === 'demonstration' &&
        (!demonstrationFor(entry, recordingMetadata(proof).mode) ||
          checked.state.status !== 'complete')
      )
        throw new Error(
          txt(
            'The demonstration did not reproduce a completed challenge.',
            'Демонстрація не відтворила виконане завдання.',
          ),
        );
      $('flight-mode').value = recordingMetadata(proof).mode;
    }
    if (checkpointRequest) {
      const controller = new AbortController();
      checkpointPreparation = controller;
      $('flight-status').textContent = txt(
        'Restoring recorded section…',
        'Відновлення записаної ділянки…',
      );
      let prepared;
      try {
        prepared = await (
          checkpointRequest.watch ? prepareSectionReplay : prepareCheckpointPractice
        )(entry.course, checkpointRequest.mode, checkpointRequest.index, {
          proof: checkpointRequest.proof,
          response,
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        throw error;
      } finally {
        if (checkpointPreparation === controller) checkpointPreparation = null;
      }
      if (disposed || token !== flightToken) {
        prepared.flight.dispose();
        return;
      }
      const { proof: sectionProof, ...session } = prepared;
      ({ flight, ...checkpointSession } = session);
      if (prepared.kind === 'section-replay') {
        replayProof = sectionProof;
        replayKind = 'section';
        checkpointRequest = { ...checkpointRequest, proof: sectionProof };
        $('world-replay-controls').hidden = false;
        $('world-replay-label').textContent = txt('RECORDED SECTION', 'ЗАПИСАНА ДІЛЯНКА');
        $('flight-collection').textContent = $('world-replay-label').textContent;
        $('flight-source').disabled = $('radio-setup-button').disabled = true;
        $('world-touch').hidden = true;
      } else if (checkpointRequest.watch) {
        // A failed watch request is ordinary, paused practice. Do not retain
        // invalid frames or pretend a later retry can play this missing section.
        checkpointRequest = { ...checkpointRequest, proof: null, watch: false };
      }
      if (prepared.kind !== 'section-replay' && flight.identity.actorRules !== LIVE_ACTOR_RULES) {
        const historical = flight;
        flight = migrateWorldFlightToLive(historical);
        historical.dispose();
      }
      if (prepared.kind !== 'section-replay')
        radio.reset({ notify: false, pickup: prepared.pickup });
      const selected = entry.course.steps[prepared.mode][prepared.index];
      $('flight-brief').textContent = $('flight-menu-brief').textContent =
        prepared.kind === 'section-replay'
          ? `${txt('Watch this objective', 'Перегляньте цю ціль')}: ${stepName(selected)}. ${prepared.sectionComplete ? txt('Playback stops when the objective is completed.', 'Перегляд зупиняється після виконання цілі.') : txt('This recording ends before the objective is completed.', 'Цей запис закінчується до виконання цілі.')}`
          : prepared.kind === 'checkpoint'
            ? `${txt('Practise only this objective', 'Тренуйте лише цю ціль')}: ${stepName(selected)}. ${txt('The recorded orientation, momentum, response settings and world state are restored.', 'Відновлено записані орієнтацію, імпульс, параметри чутливості та стан світу.')}`
            : txt(
                'A verified entry recording is unavailable. Practise the complete route from its original launch point, without rewards.',
                'Немає перевіреного запису входу. Тренуйте весь маршрут із початкового місця без нагород.',
              );
      if (prepared.kind === 'full-attempt')
        $('flight-collection').textContent = txt(
          'FULL ROUTE PRACTICE · UNSCORED',
          'ТРЕНУВАННЯ ПОВНОГО МАРШРУТУ · БЕЗ ЗАЛІКУ',
        );
    } else if (replayProof?.format === 'FlightPracticeContinuation.v1') {
      const prepared = await prepareWorldContinuationReplay(entry.course, replayProof);
      if (!ownsAttempt()) {
        prepared.flight.dispose();
        return;
      }
      flight = prepared.flight;
      replayStartTick = prepared.boundaryTicks;
      replayProof.frames = prepared.frames;
      modePractice = true;
      practiceContinuation = true;
      recorder = null;
      $('flight-mode').value = prepared.mode;
    } else if (options.recover) {
      const recovered = await recoverWorldFlight(entry.course, options.recover, {
        includeSectors: true,
      });
      if (!ownsAttempt()) {
        recovered.flight.dispose();
        return;
      }
      if (recovered.flight.identity.actorRules !== LIVE_ACTOR_RULES) {
        let continuation = null;
        try {
          // Preserve the verified historical stream before starting independent practice inputs.
          if (recordStore)
            await recordStore.put({
              course: entry.course,
              proof: options.recover,
              packIdentity: entry.packIdentity,
              status: 'verified',
              diagnostic: 'Historical boundary preserved before practice continuation',
              pinned: true,
            });
          if (!ownsAttempt()) return;
          continuation = migrateWorldFlightToLive(recovered.flight);
          const continuationRecorder = createWorldContinuationRecorder(continuation, {
            boundaryProof: options.recover,
          });
          flight = continuation;
          recorder = continuationRecorder;
          continuation = null;
          modePractice = true;
          practiceContinuation = true;
        } finally {
          continuation?.dispose();
          recovered.flight.dispose();
        }
      } else {
        flight = recovered.flight;
        recorder = recovered.recorder;
        if (options.recover.format === 'FlightPracticeContinuation.v1') {
          modePractice = true;
          practiceContinuation = true;
        }
      }
      sectors.reset(recovered.sectors);
      radio.reset({
        notify: false,
        pickup: Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle'].map((k) => [
            k,
            (readFlightState()?.lastInput[k] ?? 0) / 1000,
          ]),
        ),
      });
      $('flight-mode').value = recordingMetadata(options.recover).mode;
    } else {
      tuningStore.refresh();
      const baselineConfiguration =
        options.combatPlaybackConfiguration ?? options.tuningDraft ?? tuningStore.effective();
      const tuningConfiguration =
        !replayProof && baselineConfiguration.advanced?.aircraft?.format === 'AdvancedAircraft.v2'
          ? prepareAircraftChallenge(baselineConfiguration, options.challenge)
          : baselineConfiguration;
      const physicalAircraft =
        !replayProof && tuningConfiguration.advanced?.aircraft?.format === 'AdvancedAircraft.v2';
      if ((!learning || physicalAircraft) && !replayProof) {
        response = clone(tuningConfiguration.response);
        $('world-fov').value = String(tuningConfiguration.camera.verticalFov);
        $('world-tilt').value = String(tuningConfiguration.camera.tilt);
      }
      let combatContext = null;
      if (encounterSelection.activity !== 'original') {
        await initWorldRuntime();
        if (!ownsLaunch()) return;
        const combatCourse = entry.sourceCourse ?? entry.course,
          baseIdentity = combatBaseIdentity(entry);
        const geometry = createNativeEncounterGeometry(combatCourse);
        try {
          const authored = ['FPVEncounterDefinition.v1', 'FPVEncounterDefinition.v2'].includes(
            options.encounter?.format,
          )
            ? options.encounter
            : savedEncounterBundle(baseIdentity);
          const definition = prepareEncounterDefinition({
            course: combatCourse,
            baseIdentity,
            selection: encounterSelection,
            authored,
            recovery: combatRecoveryOf(options),
            admitActor: geometry.admitActor,
            admitServicePad: geometry.admitServicePad,
          });
          const runtime = createEncounterRuntime(definition, {
            geometry,
            runId: combatRecoveryOf(options)?.gameplay?.encounter?.state?.runId,
          });
          combatContext = { definition, geometry, runtime, course: combatCourse };
        } catch (error) {
          geometry.dispose();
          if (options.combatRecovery || options.combatReplaySource)
            throw new Error(
              txt(
                `The saved combat session could not be continued: ${error.message}`,
                `Не вдалося продовжити збережений бій: ${error.message}`,
              ),
            );
          encounterUnavailable = txt(
            `Combat is unavailable here: ${error.message}. Use Studio to author a supported encounter.`,
            `Бій тут недоступний: ${error.message}. Створіть відповідний бій у Студії.`,
          );
          throw new Error(encounterUnavailable);
        }
      }
      const physicsCourse = combatContext
        ? encounterPhysicsCourse(combatContext.course)
        : entry.course;
      let candidateFlight = physicalAircraft
        ? createAircraftCourseSession(
            {
              course: physicsCourse,
              mode: $('flight-mode').value,
              configuration: tuningConfiguration,
              legacy: combatContext ? false : entry.legacy,
              encounterActors: combatContext?.runtime.snapshot().actors ?? null,
              actorRules: !entry.legacy && !combatContext ? LIVE_ACTOR_RULES : null,
            },
            {
              createMission: entry.legacy && !combatContext ? createFlight : createWorldFlight,
              createClient: () =>
                createAdvancedWorkerClient({
                  Worker: win.Worker,
                  url: new URL('../fpv-worlds/advanced-worker.mjs', import.meta.url),
                }),
            },
          )
        : (entry.legacy && !combatContext ? createFlight : createWorldFlight)({
            course: physicsCourse,
            mode: $('flight-mode').value,
            response: replayProof?.response ?? response,
            unscoredPractice: Boolean(combatContext) || modePractice || Boolean(entry.freeFlight),
            encounterPhysicsOnly: Boolean(combatContext),
            actorRules:
              combatContext || entry.legacy
                ? null
                : replayProof
                  ? (replayProof.actorRules ?? null)
                  : LIVE_ACTOR_RULES,
          });
      if (physicalAircraft)
        candidateFlight = withAircraftChallenge(candidateFlight, {
          rules: tuningConfiguration.challenge,
          capacityAh: tuningConfiguration.advanced.aircraft.battery.capacityAh,
        });
      try {
        if (combatContext)
          candidateFlight = await createEncounterSession(candidateFlight, combatContext);
        if (!ownsLaunch()) {
          await candidateFlight.dispose?.();
          return;
        }
        flight = candidateFlight;
      } catch (error) {
        await candidateFlight.dispose?.();
        combatContext?.geometry.dispose?.();
        if (!ownsLaunch()) return;
        throw error;
      }
      aircraftAttemptConfiguration = physicalAircraft ? clone(baselineConfiguration) : null;
      workbenchAttemptConfiguration = clone(baselineConfiguration);
      activeTuningDraft = options.tuningDraft ? clone(tuningConfiguration) : null;
      recorder =
        combatContext || physicalAircraft || modePractice || entry.freeFlight
          ? null
          : (entry.legacy ? createFlightRecorder : createWorldRecorder)(flight, {
              session: replayProof
                ? replayKind === 'demonstration'
                  ? 'demonstration'
                  : 'replay'
                : preview
                  ? 'authoring'
                  : 'practice',
            });
    }
    if (practiceContinuation) {
      ghostEnabled = false;
      sectorReferenceStatus = 'unscored';
      $('flight-collection').textContent = replayProof
        ? txt(
            'RECORDED PRACTICE CONTINUATION · UNSCORED',
            'ЗАПИС ПРОДОВЖЕННЯ ПРАКТИКИ · БЕЗ ЗАЛІКУ',
          )
        : txt('PRACTICE CONTINUATION · UNSCORED', 'ПРОДОВЖЕННЯ ПРАКТИКИ · БЕЗ ЗАЛІКУ');
    }
    input.ratesApplied(flight.response().format === TUNED_RESPONSE_FORMAT);
    if (flight.aircraft) {
      modePractice = true;
      preview = true;
      ghostEnabled = false;
      sectorReferenceStatus = 'unscored';
      $('flight-collection').textContent = txt(
        'AIRCRAFT PRACTICE · UNSCORED',
        'ТРЕНУВАННЯ НА ДРОНІ · БЕЗ ЗАЛІКУ',
      );
      await flight.prepare();
      if (!ownsAttempt()) return;
    }
    enemyStatsRunId = win.crypto?.randomUUID?.() ?? globalThis.crypto.randomUUID();
    if (options.recover) {
      try {
        const savedStats = JSON.parse(storage?.getItem(statsRecoveryKey) ?? 'null');
        if (
          savedStats?.proof === dataIdentity(options.recover) &&
          typeof savedStats.run === 'string'
        )
          enemyStatsRunId = savedStats.run;
      } catch {
        /* A missing counter cursor never blocks recovery. */
      }
    }
    enemyStatistics.begin(enemyStatsRunId, {
      provenance:
        replayProof || combatReplaySource
          ? 'replay'
          : preview || checkpointSession || modePractice || entry.legacy
            ? 'preview'
            : options.recover
              ? 'continue'
              : 'live',
    });
    renderer.resetCombatPresentation?.();
    renderer.setCombatActors?.(null);
    renderer.setPresentation?.(playableAppearance.appearance);
    renderer.setCourse(
      flight.combatDefinition ? encounterPhysicsCourse(entry.course) : entry.course,
      $('flight-mode').value,
      {
        actorSourceIds: (entry.course.actors ?? []).map((actor) => actor.id),
        ...(acceptedEnvironment
          ? {
              industrialEnvironment: acceptedEnvironment.pin,
              artRevision: acceptedEnvironment.artRevision,
            }
          : {}),
      },
    );
    if (readFlightState()?.actorLives)
      restoreCoursePresentation(readFlightState(), options.cosmetics, options.recover);
    else observeCombat(readFlightState());
    if (!(await restoreCombat(options.combatRecovery, ownsAttempt)) || !ownsAttempt()) return;
    paintLoadout();
    audio.setCourse(entry.course);
    huntReactions.reset(entry.course, readFlightState(), {
      mode: $('flight-mode').value,
      attemptId: `fpv-world-${token}`,
      replay: Boolean(replayProof || combatReplaySource || entry.legacy),
    });
    renderer.setQuality($('flight-quality').value);
    renderer.setDrone(
      playableAppearance.fallbackReason && !entry.legacy
        ? resolveSimThemeProfile(entry.course, playableAppearance.appearance).drone
        : (acceptedAppearance.drone ??
            entry.course.world?.themeProfile?.drone ??
            $('drone-look').value),
    );
    renderer.setAircraft?.(flight.aircraft?.() ?? null);
    aircraftAdvice = flight.aircraft ? aircraftCourseAdvice(entry.course, flight.aircraft()) : null;
    let model = null,
      routeBundle = null;
    admittedRouteGuides = null;
    routeGuideProblem = '';
    if (entry.projectId) {
      const pack =
        preview && entry.packIdentity === 'authoring' && editingProject?.id === entry.projectId
          ? { project: editingProject, assets: projectAssets }
          : await worldStore?.get(entry.projectId, {
              sha256: entry.packIdentity.replace('fpv-pack:', ''),
            });
      if (!ownsAttempt()) return;
      if (!pack) throw new Error(txt('The world pack is missing.', 'Пакунок світу відсутній.'));
      routeBundle =
        pack.project.routeGuides?.find((bundle) => bundle.courseId === entry.course.id) ?? null;
      model = pack.project.world.modelAsset ? pack.assets.get(pack.project.world.modelAsset) : null;
      if (pack.project.world.modelAsset && !model)
        throw new Error(
          txt(
            'The installed model is missing. Reinstall its world pack.',
            'Модель відсутня. Перевстановіть пакунок світу.',
          ),
        );
    }
    if (routeBundle && !flight.combatDefinition) {
      try {
        const admitted = await admitWorldRouteGuides(routeBundle, entry.course);
        if (!ownsAttempt()) return;
        admittedRouteGuides = admitted;
      } catch {
        if (!ownsAttempt()) return;
        routeGuideProblem = txt(
          'Route needs author review. Objective guidance remains available.',
          'Маршрут потребує перевірки автора. Підказки цілей доступні.',
        );
      }
    }
    model ??= builtinWorldScene(entry.course);
    if (model) await renderer.loadScene(model);
    if (!ownsAttempt()) return;
    if (sectorReferenceStatus === 'checking') {
      $('flight-status').textContent = txt('Checking saved best…', 'Перевірка найкращого запису…');
      await resolveSectorReference(
        entry,
        flight.identity,
        token,
        options.recover ? options.sectorReferenceId : undefined,
      );
    }
    if (!ownsAttempt()) return;
    // A preset can change while assets or shaders are loading. Prepare the latest
    // scene again when that renderer revision supersedes the pending compilation.
    for (let attempt = 0; attempt < 3; attempt++) {
      const prepared = await renderer.prepare?.();
      if (!ownsAttempt() || !renderer.available) return;
      if (prepared !== false) break;
      if (attempt === 2)
        throw new Error(
          txt(
            'Graphics changed during preparation. Retry the flight.',
            'Графіка змінилася під час підготовки. Повторіть політ.',
          ),
        );
    }
    if (!ownsAttempt()) return;
    if (ghostEnabled) await loadGhost();
    if (!ownsAttempt()) return;
    if (!(await applyCombatArt(renderer, ownsAttempt))) return;
    // Submit shadow programs and visible uploads before exposing readiness.
    if (drawFlight(readFlightState()) === false || !ownsAttempt()) return;
    sceneReady = true;
    if (options.returning === lessonReturn) {
      lessonReturn = null;
      paintLessonReturn();
    }
    $('flight-status').textContent = flight?.combatDefinition
      ? `${encounterActivityLabel(encounterSelection.activity, locale)} · ${txt('Ready. Arm when ready.', 'Готово. Увімкніть, коли будете готові.')}`
      : replayProof
        ? txt(
            'Playback paused. Resume when you are ready.',
            'Перегляд на паузі. Продовжіть, коли будете готові.',
          )
        : checkpointSession
          ? txt(
              'Practice paused. Arm to take over. Keyboard, touch and controller retain the recorded throttle; radio requires matching the recorded sticks.',
              'Тренування на паузі. Увімкніть, щоб перебрати керування. Клавіатура, дотик і контролер зберігають записаний газ; на пульті сумістіть стіки із записаним положенням.',
            )
          : txt(
              'Ready. Choose your controls, then arm.',
              'Готово. Виберіть керування та натисніть «Увімкнути».',
            );
    if (options.recover && modePractice)
      $('flight-status').textContent = txt(
        'Continued as unscored practice. Original recording preserved; arm when ready.',
        'Продовжено як практику без заліку. Початковий запис збережено; увімкніть, коли готові.',
      );
    appearanceControls.refresh();
    input.select($('flight-source').value);
    restoreRadio();
    paintInput(readFlightState());
    updateHUD(readFlightState());
    if (!options.preserveFocus && ownsLaunch()) {
      if (beginnerCoach.blocksArm()) beginnerCoach.focusPreview();
      else $('world-viewport').focus();
    }
    if (
      options.combatReplaySource &&
      !(await prepareCombatPlayback(
        options.combatReplaySource,
        ownsLaunch,
        options.combatPlaybackPaused || pauseRevision !== playbackPauseRevision,
      ))
    )
      return;
    if (replayProof && !options.paused && ownsLaunch() && pauseRevision === playbackPauseRevision) {
      input.enable(false);
      flight.arm();
      $('flight-status').textContent = txt(
        replayKind === 'demonstration'
          ? 'Follow the route, turns and landing. Pause or slow playback to study the flight.'
          : 'Playing verified recording · no rewards.',
        replayKind === 'demonstration'
          ? 'Стежте за маршрутом, поворотами та посадкою. Зупиніть або сповільніть перегляд, щоб роздивитися політ.'
          : 'Відтворення перевіреного запису · без нагород.',
      );
    }
    if (
      !replayProof &&
      !options.combatReplaySource &&
      ownsLaunch() &&
      !options.paused &&
      !options.preview &&
      // Recovery restores a recorded command prefix; wait for deliberate pickup.
      !options.recover &&
      pauseRevision === playbackPauseRevision &&
      !doc.hidden &&
      (doc.hasFocus?.() ?? true)
    )
      $('world-arm').click();
    if (playableAppearance.fallbackReason)
      $('flight-status').textContent += ` ${txt(
        entry.course.world?.themeProfile?.authoredFallback
          ? 'Recorded appearance unavailable. Using the saved authored appearance; the flight proof is unchanged.'
          : 'Recorded appearance unavailable. Using the authored environment appearance; the flight proof is unchanged.',
        entry.course.world?.themeProfile?.authoredFallback
          ? 'Оформлення запису недоступне. Використано збережене авторське оформлення; запис польоту не змінено.'
          : 'Оформлення запису недоступне. Використано авторське оформлення середовища; запис польоту не змінено.',
      )}`;
  }
  async function closeFlight() {
    flightHud.closeDetails();
    enemyGuide.close();
    const token = ++flightToken;
    industrialPreparation?.abort();
    industrialPreparation = null;
    checkpointPreparation?.abort();
    checkpointPreparation = null;
    qualityPreparing = false;
    scenePreparationGeneration++;
    abortSectorLookup();
    sceneReady = false;
    pauseFlight();
    await saveRecovery();
    if (token !== flightToken || disposed) return;
    regionalManifestRequest?.abort();
    const previousFlight = flight;
    await retireCombatArchive();
    if (token !== flightToken || disposed) return;
    await stopCombatPlayback();
    if (token !== flightToken || disposed) return;
    if (flight === previousFlight) await previousFlight?.dispose?.();
    if (token !== flightToken || disposed) return;
    flight = null;
    if (activeTuningDraft) {
      tuningStore.refresh();
      const camera = tuningStore.effective().camera;
      $('world-fov').value = String(camera.verticalFov);
      $('world-tilt').value = String(camera.tilt);
      activeTuningDraft = null;
      tuningReturnEntry = null;
      tuning?.endDraftTest();
    }
    if (learningDemoReturn) $('flight-mode').value = learningDemoReturn.mode;
    learningDemoReturn = null;
    returnToLesson.hidden = true;
    $('flight-dialog').classList.remove('learning-replay');
    flightHud.setWorldCue(null);
    $('flight-dialog').dataset.simHudActive = 'false';
    $('flight-dialog').dataset.simFlightCompact = 'false';
    $('world-viewport').dataset.simFlightCompact = 'false';
    const closedLesson = current?.beginner;
    current = null;
    refreshEnemyGuide();
    recorder = null;
    checkpointSession = null;
    checkpointRequest = null;
    modePractice = false;
    beginnerCoach.close();
    restoreLearningPreferences();
    $('flight-dialog').classList.remove('learning-flight');
    sectorReferenceProof = null;
    if (playShell) playShell.elements.root.prepend(playShell.elements.header);
    $('flight-dialog').close();
    playShell?.open('missions');
    replayProof = null;
    replayStartTick = 0;
    practiceContinuation = false;
    paintContinuationRecordingNotice();
    $('flight-mode').disabled =
      $('flight-source').disabled =
      $('radio-setup-button').disabled =
        false;
    presentation.resume();
    renderCatalogue();
    if (closedLesson) {
      showTab('learn');
      (
        $('school-lessons').querySelector(`[data-lesson="${closedLesson}"] button`) ??
        $('school-continue')
      ).focus({ preventScroll: true });
    } else $('world-grid').querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    renderPacks();
    paintLessonReturn();
  }
  async function restoreProofs(file) {
    if (!recordStore) throw new Error('Flight storage is unavailable.');
    if (file.size > 32 * 1024 * 1024) throw new Error('Flight archive exceeds 32 MiB.');
    pauseFlight();
    proofImport?.abort();
    const controller = (proofImport = new AbortController()),
      active = () => !disposed && !controller.signal.aborted,
      restored = await importProofPart(await file.text());
    if (!active()) return;
    const existing = new Map((await recordStore.list()).map((r) => [r.id, r]));
    let verifiedCount = 0,
      imported = 0,
      failure = null;
    try {
      for (const saved of restored) {
        if (!active()) return;
        status(
          txt(
            `Verifying ${imported + 1}/${restored.length}…`,
            `Перевірка ${imported + 1}/${restored.length}…`,
          ),
        );
        const entry = catalogue.find(
            (e) => e.id === saved.course?.id && e.packIdentity === saved.packIdentity,
          ),
          example =
            saved.proof.format !== 'FlightPracticeContinuation.v1' &&
            recordingMetadata(saved.proof).session === 'demonstration';
        let verification = 'missing-dependency',
          diagnostic = txt('Exact world pack is missing.', 'Точний пакунок світу відсутній.');
        if (entry) {
          try {
            if (!entry.legacy)
              await restoreNativeIndustrialCourse(saved.course, {
                mode: recordingMetadata(saved.proof).mode,
                signal: controller.signal,
              });
            if (
              example &&
              !entry.legacy &&
              dataIdentity(validateWorldCourse(saved.course)) !==
                dataIdentity(validateWorldCourse(entry.course))
            )
              throw new Error(
                txt(
                  'Example course differs from the installed course.',
                  'Курс прикладу відрізняється від встановленого.',
                ),
              );
            const result = entry.legacy
              ? await replayFlightCooperatively(entry.course, saved.proof, {
                  signal: controller.signal,
                })
              : await replayWorldFlight(saved.course, saved.proof, { signal: controller.signal });
            if (!active()) return;
            verification = 'verified';
            diagnostic = result.state.status;
            verifiedCount++;
            if (
              entry.legacy &&
              result.state.status === 'complete' &&
              saved.proof.session === 'practice'
            )
              await notebook.accept(saved.proof);
          } catch (error) {
            verification = 'invalid';
            diagnostic = error.message;
          }
        }
        if (!active()) return;
        const prior = existing.get(saved.id);
        if (
          !(
            example &&
            verification === 'verified' &&
            prior?.status === 'verified' &&
            prior.diagnostic === diagnostic &&
            prior.packIdentity === saved.packIdentity
          )
        )
          await recordStore.put({
            course: saved.course,
            proof: saved.proof,
            packIdentity: saved.packIdentity,
            status: verification,
            diagnostic,
            pinned: prior || example ? undefined : (saved.pinned ?? false),
            ...(saved.presentation ? { presentation: saved.presentation } : {}),
          });
        imported++;
      }
    } catch (error) {
      failure = error;
    } finally {
      if (active()) {
        try {
          await refreshStorage();
        } catch (error) {
          failure ??= error;
        }
        if (active())
          status(
            txt(
              `Imported ${imported}/${restored.length} records or examples; ${verifiedCount} verified.`,
              `Імпортовано ${imported}/${restored.length} записів або прикладів; перевірено ${verifiedCount}.`,
            ) + (failure ? ` ${failure.message}` : ''),
          );
      }
    }
  }

  const flightControls = $('sim-flight-controls');
  on($('sim-text-face'), 'change', () =>
    displayPreferences.set({ textFace: $('sim-text-face').value }),
  );
  on($('sim-motion'), 'change', () =>
    displayPreferences.set({ reducedEffects: $('sim-motion').value === 'reduced' }),
  );
  on($('lobby-sound'), 'click', () => soundButton.click());
  on($('lobby-radio'), 'click', () => $('radio-setup-button').click());
  on($('begin-learning'), 'click', () => showTab('learn'));
  on($('school-tier'), 'change', renderSchool);
  on($('school-recover'), 'click', resumeInterruptedFlight);
  on($('school-radio'), 'click', () => $('radio-setup-button').click());
  on($('school-worlds'), 'click', () => {
    showTab('explore');
  });
  on($('school-continue'), 'click', () => {
    const complete = completedKeys();
    return startFlight(
      primaryLearning.find((entry) => !complete.has(keyOf(entry))) ?? primaryLearning[0],
    );
  });
  on($('hero-fly'), 'click', () => {
    const complete = completedKeys();
    const entry =
      catalogue.find((e) => e.legacy && !complete.has(keyOf(e))) ?? catalogue.find((e) => e.legacy);
    if (entry) return startFlight(entry);
  });
  on($('hero-browse'), 'click', () => openMissionChooser());
  on(doc.querySelector('.wordmark'), 'click', (e) => {
    e.preventDefault();
    showTab('explore');
  });
  on(win, 'hashchange', () => showTab(win.location.hash.slice(1)));
  on($('flight-options'), 'click', () => openSettings());
  let settingsReturnFocus = null;
  function openSettings({ category } = {}) {
    void globalTools?.ensure();
    if (!$('sim-settings').open) settingsReturnFocus = doc.activeElement;
    pauseFlight();
    paintCombatActionControls();
    if (!$('sim-settings').open) $('sim-settings').showModal();
    const view = modeSettingsView,
      tab = category && view?.tabs[category];
    if (tab && view.navigation.select(tab.id)) {
      if (!view.navigation.focusPanel()) view.navigation.focusCategories();
    } else view?.navigation.focusCategories();
  }
  on($('lobby-settings'), 'click', openSettings);
  on($('library-flight-records'), 'click', () => openSettings({ category: 'data' }));
  function closeSettings({ force = false } = {}) {
    if (!force && modeSettingsView?.navigation.back()) return;
    $('sim-settings').close();
    pauseFlight();
    (settingsReturnFocus?.isConnected && !settingsReturnFocus.closest('[hidden],[inert]')
      ? settingsReturnFocus
      : (playShell?.topDialog()?.querySelector('h1') ?? $('lobby-settings'))
    ).focus();
  }
  $('close-sim-settings').dataset.settingsBack = '';
  on($('close-sim-settings'), 'click', closeSettings);
  on($('sim-settings'), 'cancel', (e) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    closeSettings();
  });
  for (const id of ['flight-mode', 'flight-source', 'flight-camera'])
    on($(id), 'change', paintLoadout);

  for (const b of doc.querySelectorAll('[data-tab]')) on(b, 'click', () => showTab(b.dataset.tab));
  for (const id of ['search', 'activity-filter', 'difficulty-filter', 'completion-filter'])
    on($(id), id === 'search' ? 'input' : 'change', renderCatalogue);
  on($('world-language'), 'change', () => {
    const previousLocale = locale;
    locale = $('world-language').value;
    setLocale(locale);
    try {
      const location = new URL(win.location.href);
      if (location.searchParams.has('lang')) {
        location.searchParams.set('lang', locale);
        win.history.replaceState(null, '', location.href);
      }
    } catch {
      /* Language selection also works in isolated previews. */
    }
    if (playlistDraft && $('playlist-title').value === playlistDraft.title[previousLocale])
      $('playlist-title').value = localized(playlistDraft.title);
    paintLanguage();
    tuning?.refresh();
    $('search').placeholder = txt('Find a world or challenge…', 'Знайти світ або завдання…');
    renderFilters();
    renderCatalogue();
    renderPlaylist();
    refreshEditor();
    renderPacks();
    paintLessonReturn();
    worldLibrary.refresh();
    regionalLibrary.refresh();
    missionChooser?.refresh();
  });
  on($('play-playlist'), 'click', () => flySequence(playlistValue()));
  on($('save-playlist'), 'click', () => {
    playlistStore.save(playlistValue());
    renderPlaylist();
    status(txt('Playlist saved.', 'Добірку збережено.'));
  });
  on($('export-playlist'), 'click', () =>
    download(exportPlaylist(playlistValue()), 'fpv-playlist.json'),
  );
  on($('clear-playlist'), 'click', () => {
    entries = [];
    playlistId = unique('playlist');
    playlistDraft = null;
    renderPlaylist();
  });
  on($('import-playlist'), 'change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 65536) throw new Error('Playlist exceeds 64 KiB.');
    loadPlaylist(validatePlaylist(await file.text()));
    e.target.value = '';
  });
  on($('clone-challenge'), 'click', () => {
    const entry = catalogue.find((e) => keyOf(e) === $('creator-template').value);
    if (entry) return cloneChallenge(entry);
  });
  on($('creator-theme'), 'change', () =>
    applyEdit(
      (c) => {
        const world = { ...c.world, theme: $('creator-theme').value };
        delete world.themeProfile;
        const resolved = resolveThemeExperience({ course: { ...c, world } });
        Object.assign(c, resolved.course);
      },
      { detachIndustrial: true },
    ),
  );
  on($('editor-snap'), 'change', () => spatialEditor?.setSnap(Number($('editor-snap').value)));
  on($('editor-reset-view'), 'click', () => spatialEditor?.resetView());
  const studioViewControls = el('div');
  studioViewControls.className = 'studio-view-controls';
  studioViewControls.setAttribute('role', 'group');
  studioViewControls.setAttribute('aria-label', txt('Studio camera', 'Камера редактора'));
  for (const [label, move] of [
    ['orbitLeft', () => spatialEditor?.orbitView(-40, 0)],
    ['orbitRight', () => spatialEditor?.orbitView(40, 0)],
    ['orbitUp', () => spatialEditor?.orbitView(0, -30)],
    ['orbitDown', () => spatialEditor?.orbitView(0, 30)],
    ['zoomIn', () => spatialEditor?.zoomView(-120)],
    ['zoomOut', () => spatialEditor?.zoomView(120)],
  ]) {
    const control = button('', move);
    control.dataset.i18n = label;
    control.dataset.studioView = label;
    studioViewControls.append(control);
  }
  $('editor-reset-view').after(studioViewControls);
  on($('creator-title'), 'change', () =>
    applyEdit((c) => {
      c.locales[locale].title = $('creator-title').value.trim();
    }),
  );
  on($('criterion-list'), 'change', () => {
    const value = $('criterion-list').value;
    if (value.startsWith('actor:')) editorSelection = { kind: 'actor', id: value.slice(6) };
    else {
      editorIndex = Number(value);
      editorSelection = { kind: 'criterion', index: editorIndex };
    }
    refreshEditor(false);
    spatialEditor?.select(editorSelection);
    if (editorSelection.kind === 'actor') actorEditor?.select(editorSelection.id);
    else actorEditor?.selectObjective(editorMode(), editorIndex, { focus: true });
  });
  on($('move-criterion'), 'click', () => {
    const position = Object.fromEntries(
      coordinates.map((k) => [k, Math.round(Number($(`criterion-${k}`).value) * 1000)]),
    );
    applyEdit((c) =>
      moveSelection(c, editorSelection ?? { kind: 'criterion', index: editorIndex }, position),
    );
  });
  on($('duplicate-criterion'), 'click', () =>
    applyEdit((c, bindings) => {
      for (const mode of routeEditModes(c)) {
        c.steps[mode].splice(editorIndex + 1, 0, clone(c.steps[mode][editorIndex]));
        bindings?.[mode]?.splice(editorIndex + 1, 0, null);
      }
      editorIndex++;
      editorSelection = { kind: 'criterion', index: editorIndex };
    }),
  );
  on($('remove-criterion'), 'click', () =>
    applyEdit((c, bindings) => {
      for (const mode of routeEditModes(c)) {
        c.steps[mode].splice(editorIndex, 1);
        bindings?.[mode]?.splice(editorIndex, 1);
      }
      editorSelection = null;
    }),
  );
  for (const [id, delta] of [
    ['criterion-up', -1],
    ['criterion-down', 1],
  ])
    on($(id), 'click', () => {
      if (
        !editor ||
        editorIndex + delta < 0 ||
        editorIndex + delta >= editor.steps[editorMode()].length
      )
        return;
      applyEdit((c, bindings) => {
        for (const mode of routeEditModes(c)) {
          [c.steps[mode][editorIndex], c.steps[mode][editorIndex + delta]] = [
            c.steps[mode][editorIndex + delta],
            c.steps[mode][editorIndex],
          ];
          if (bindings?.[mode])
            [bindings[mode][editorIndex], bindings[mode][editorIndex + delta]] = [
              bindings[mode][editorIndex + delta],
              bindings[mode][editorIndex],
            ];
        }
        editorIndex += delta;
        editorSelection = { kind: 'criterion', index: editorIndex };
      });
    });
  for (const id of ['undo-edit', 'redo-edit']) {
    on($(id), 'click', () => {
      const source = id === 'undo-edit' ? undo : redo,
        target = id === 'undo-edit' ? redo : undo;
      if (!source.length) return;
      target.push(editorSnapshot());
      const snapshot = source.pop();
      editor = snapshot.course;
      editorScope = snapshot.scope;
      editorIndex = snapshot.index;
      editorSelection = snapshot.selection;
      if (editingProject) {
        editingProject.overrides = snapshot.overrides;
        editingProject.routeGuides = snapshot.routeGuides ?? [];
        if (snapshot.bindings) {
          editingProject.routeBindings ??= {};
          editingProject.routeBindings[editor.id] = snapshot.bindings;
        }
      }
      syncProject(false);
      refreshEditor();
    });
  }
  on($('apply-json'), 'click', () => {
    const valid = validateWorldCourse($('creator-json').value);
    applyEdit((c, bindings) => {
      for (const k of Object.keys(c)) delete c[k];
      Object.assign(c, valid);
      if (bindings)
        for (const mode of ['self-level', 'acro'])
          if (bindings[mode].length !== c.steps[mode].length)
            bindings[mode] = c.steps[mode].map(() => null);
    });
  });
  on($('preview-challenge'), 'click', () => {
    if (!editor) throw new Error('Create a challenge first.');
    return startFlight(customEntry(editor), {
      preview: true,
      mode: editorScope === 'both' ? undefined : editorMode(),
    });
  });
  on($('export-challenge'), 'click', async () => {
    if (!editor) throw new Error('Create a challenge first.');
    const accepted = editor;
    await validateNativeIndustrialCourses([accepted]);
    download(accepted, `${editor.id}.json`);
  });
  on($('import-world'), 'change', async (e) => {
    try {
      await importScene(e.target.files);
    } finally {
      e.target.value = '';
    }
  });
  on($('preview-world'), 'click', () => {
    syncProject();
    return startFlight(customEntry(editor), {
      preview: true,
      mode: editorScope === 'both' ? undefined : editorMode(),
    });
  });
  on($('export-project'), 'click', async () => {
    syncProject();
    download(
      await exportEditedProject(editingProject, { assets: projectAssets }),
      `${editingProject.id}.zip`,
    );
  });
  on($('export-pack'), 'click', async () => {
    syncProject();
    download(
      await preparePack(editingProject, { assets: projectAssets }),
      `${editingProject.id}.rlpack`,
    );
  });
  on($('install-project'), 'click', installProject);
  on($('import-pack'), 'change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      try {
        await installExactPack(file);
      } finally {
        e.target.value = '';
      }
      return;
    }
    const loaded = await importEditableZip(file);
    if (loaded.project.definitions)
      loaded.project.courses = compileContentProject(loaded.project.definitions).map(
        (r) => r.course,
      );
    for (const c of loaded.project.courses) validateWorldCourse(c);
    await validateNativeIndustrialCourses(loaded.project.courses);
    editingProject = loaded.project;
    projectAssets = loaded.assets;
    projectGeneration = worldStore ? await worldStore.generation() : null;
    setEditor(editingProject.courses[0] ?? courseFromProject(editingProject));
    syncProject();
    updateImportControls();
    await installProject();
    e.target.value = '';
  });
  on($('backup-proofs'), 'click', async () => {
    const parts = await exportProofParts(records);
    $('backup-parts')?.remove();
    if (parts.length === 1) download(JSON.stringify(parts[0]), 'fpv-flights-1-of-1.json');
    else {
      const links = el('div', undefined, 'button-row');
      links.id = 'backup-parts';
      parts.forEach((part, i) =>
        links.append(
          button(`${txt('Download part', 'Завантажити частину')} ${i + 1}/${parts.length}`, () =>
            download(JSON.stringify(part), `fpv-flights-${i + 1}-of-${parts.length}.json`),
          ),
        ),
      );
      $('storage-status').after(links);
    }
    status(
      txt(
        `Backup ready: ${parts.length} part(s). Keep every part.`,
        `Резервна копія готова: ${parts.length} частин. Збережіть усі частини.`,
      ),
    );
  });
  on($('import-proofs'), 'change', async (e) => {
    if (e.target.files[0]) await restoreProofs(e.target.files[0]);
    e.target.value = '';
  });
  on($('persistent-storage'), 'click', async () => {
    const granted = await win.navigator.storage?.persist?.();
    $('storage-status').textContent = granted
      ? txt(
          'Persistent storage granted. Keep an exported backup too.',
          'Постійне сховище надано. Зберігайте також експортовану копію.',
        )
      : txt(
          'Persistent storage was not granted. Export packs and recordings as backups.',
          'Постійне сховище не надано. Експортуйте пакунки та записи.',
        );
  });
  const settingsRuntimeOfflineStatus = doc.createElement('p');
  settingsRuntimeOfflineStatus.id = 'settings-runtime-offline-status';
  settingsRuntimeOfflineStatus.setAttribute('role', 'status');
  settingsRuntimeOfflineStatus.setAttribute('aria-live', 'polite');
  settingsRuntimeOfflineStatus.hidden = true;
  const runtimeOffline = mountPracticeOfflineControls({
    prepareButton: $('prepare-runtime'),
    removeButton: $('remove-runtime'),
    document: doc,
    window: win,
    storage,
    packageId: 'fpv-worlds',
    onStatus(kind) {
      if (disposed) return;
      const failure = runtimeOfflineFeedback?.kind === 'removing' ? 'removeFailed' : 'error';
      runtimeOfflineFeedback = { kind: kind === 'error' ? failure : kind };
      paintRuntimeOfflineStatus();
    },
  });
  if (!runtimeOffline.available) {
    runtimeOfflineFeedback = { kind: 'unavailable' };
    paintRuntimeOfflineStatus();
  }
  on($('world-flight-menu'), 'click', () => setFlightMenu(true));
  on($('world-flight-close-menu'), 'click', () => setFlightMenu(false));
  on($('world-flight-resume'), 'click', () => $('world-arm').click());
  on($('world-arm'), 'click', async () => {
    if (doc.querySelector('dialog[open]:not(#flight-dialog)')) return;
    if (beginnerCoach.blocksArm()) {
      beginnerCoach.showGuide();
      return;
    }
    $('flight-dialog').dataset.flightMenuOpen = 'false';
    $('flight-dialog').dataset.optionsOpen = 'false';
    $('flight-options').setAttribute('aria-expanded', 'false');
    immersive.closeControls();
    if (combatReplaySource) {
      const selected = combatPlayback;
      if (!selected || selected.error || finished || !sceneReady) return;
      selected.playing = true;
      input.enable(false);
      radio.freeze('playback');
      selected.session.arm();
      lastTime = null;
      accumulator = 0;
      lastExecutionTime = win.performance?.now?.() ?? null;
      void audio.resume().catch(reportError);
      $('flight-status').textContent = txt(
        'Playing recorded combat · no rewards.',
        'Відтворюється запис бою · без нагород.',
      );
      updateHUD(selected.session.snapshot());
      $('world-viewport').focus();
      return;
    }
    if (
      !sceneReady ||
      (current?.regionalAdvanced && regionalAdvancedControls?.busy) ||
      ghostLookup ||
      !flight ||
      (current?.regional &&
        readFlightState()?.reason !== 'prepared' &&
        readFlightState()?.status !== 'active') ||
      terminal(readFlightState()) ||
      (replayProof && finished)
    )
      return;
    if (flight.combatCheckpointPending?.()) {
      const selectedFlight = flight,
        revision = pauseRevision;
      try {
        await combatSaves.get(selectedFlight);
      } catch (error) {
        reportError(error);
      }
      if (
        disposed ||
        flight !== selectedFlight ||
        revision !== pauseRevision ||
        doc.visibilityState === 'hidden'
      )
        return;
    }
    if (pendingFlightSteps.has(flight)) {
      $('flight-status').textContent = txt(
        'Finishing the current flight step. Press Resume again when ready.',
        'Завершується поточний крок польоту. Після цього натисніть «Продовжити» ще раз.',
      );
      return;
    }
    if (!replayProof && !combatReplaySource && $('flight-source').value === 'radio') {
      restoreRadio();
      radio.poll();
      if (!radio.status().active && !radio.requestArm()) {
        paintInput(readFlightState());
        $('flight-status').textContent = radioHelp(radio.status().reason);
        return;
      }
    }
    if (!replayProof && !combatReplaySource && $('flight-source').value === 'controller') {
      readGamepad(win.performance.now(), 'ready');
      if (!gamepad.status().canArm) {
        $('flight-status').textContent = txt(
          'Connect a controller, then centre the sticks and release all buttons.',
          'Під’єднайте контролер і відпустіть стіки та кнопки.',
        );
        return;
      }
    }
    flight.arm();
    if (readFlightState()?.status !== 'active') return;
    if (replayProof) input.enable(false);
    else input.resume(flight, readFlightState()?.lastInput.throttle / 1000);
    if (checkpointSession) {
      const throttle = readFlightState()?.lastInput.throttle / 1000;
      input.seedThrottle(throttle);
      gamepad.seedThrottle(throttle);
    }
    void audio
      .resume()
      .then(() => huntReactions.prepare())
      .catch(reportError);
    fire = false;
    lastTime = null;
    lastExecutionTime = win.performance?.now?.() ?? null;
    huntReactions.resume();
    appearanceSession.arm(readFlightState()?.status);
    $('flight-status').textContent = flight?.combatDefinition
      ? `${encounterActivityLabel(encounterSelection.activity, locale)} · ${txt('Active · local practice', 'Триває · локальне тренування')}`
      : replayProof
        ? txt('Playback active · no rewards.', 'Відтворення триває · без нагород.')
        : checkpointSession
          ? txt(
              'Section practice active · no rewards or recording.',
              'Тренування ділянки триває · без нагород і запису.',
            )
          : preview
            ? current?.freeFlight
              ? freeFlightNotice()
              : txt(
                  'Preview: completion does not earn rewards.',
                  'Перегляд: виконання не дає нагород.',
                )
            : txt('Flight active.', 'Політ триває.');
    $('world-viewport').focus();
  });
  const menuHint = doc.createElement('p');
  menuHint.className = 'sim-menu-hint';
  menuHint.id = 'sim-menu-hint';
  doc.querySelector('main').append(menuHint);
  const radioMenus = mountRadioMenuControls({
    document: doc,
    window: win,
    runtime: radio,
    locale: () => locale,
    onError: reportError,
    onResume: () => {
      if (advancedPractice) return advancedPractice.start();
      playShell?.enterPlay();
      $('world-arm').click();
    },
    onCamera: () =>
      advancedPractice ? advancedPractice.showView() : cameraControls?.cycle({ menu: true }),
    onRetry: () => {
      if (advancedPractice) return advancedPractice.restart();
      playShell?.enterPlay();
      void retryFlight({ paused: true }).catch(reportError);
    },
    onSettings: () => (advancedPractice ? advancedPractice.openSettings() : openSettings()),
  });
  const radioActionPanel = el('section'),
    radioActionHeading = el('h3'),
    radioActionHint = el('p'),
    radioActionChoices = el('div'),
    radioActionBadge = el('p');
  radioActionPanel.className = 'sim-radio-actions';
  radioActionPanel.dataset.radioActions = '';
  radioActionChoices.className = 'sim-radio-actions__choices';
  radioActionBadge.className = 'sim-radio-action-pending';
  radioActionBadge.setAttribute('role', 'status');
  radioActionPanel.append(radioActionHeading, radioActionHint, radioActionChoices);
  $('world-viewport').append(radioActionBadge);
  const radioActionNames = {
    weapon: ['Switch weapon', 'Змінити зброю'],
    reload: ['Reload', 'Перезарядити'],
    payload: ['Deploy payload', 'Застосувати заряд'],
    detonate: ['Detonate', 'Підірвати'],
  };
  const radioActionChoicesList = Object.entries(radioActionNames).map(([action, names]) => {
    const control = button(txt(...names), () => {
      const state = readFlightState();
      if (
        !state?.encounter ||
        terminal(state) ||
        replayProof ||
        combatReplaySource ||
        !radio.controlLayout()?.switches.fire ||
        !radio.status().verified
      )
        return;
      stagedRadioProfile = radio.status().profile;
      stagedRadioLayout = JSON.stringify(radio.controlLayout());
      stagedRadioAction.stage(action, flight);
      refreshRadioActions(state);
    });
    control.dataset.radioStage = action;
    radioActionChoices.append(control);
    return { action, names, control };
  });
  const cancelRadioAction = button('', () => {
    stagedRadioAction.clear();
    refreshRadioActions(readFlightState());
  });
  const radioServiceGuidance = button('', () => {
    const state = readFlightState();
    if (!state?.encounter || terminal(state) || replayProof || combatReplaySource) return;
    combatNavigation = combatNavigation === 'service' ? 'target' : 'service';
    refreshRadioActions(state);
  });
  radioServiceGuidance.dataset.radioService = '';
  radioActionChoices.append(cancelRadioAction, radioServiceGuidance);
  let radioActionsPaintKey = '';
  function refreshRadioActions(state) {
    stagedRadioAction.validate(flight);
    if (
      $('flight-source').value !== 'radio' ||
      !radio.status().verified ||
      radio.status().profile !== stagedRadioProfile ||
      replayProof ||
      combatReplaySource ||
      (stagedRadioAction.pending() &&
        JSON.stringify(radio.controlLayout()) !== stagedRadioLayout) ||
      terminal(state ?? {})
    )
      stagedRadioAction.clear();
    const hidden =
      !state?.encounter ||
      !radio.controlLayout() ||
      $('flight-source').value !== 'radio' ||
      Boolean(replayProof || combatReplaySource);
    const pending = stagedRadioAction.pending(),
      fireBound = Boolean(radio.controlLayout()?.switches.fire);
    const paintKey = `${locale}:${hidden}:${pending}:${fireBound}:${combatNavigation}:${terminal(state ?? {})}`;
    if (paintKey === radioActionsPaintKey) return;
    radioActionsPaintKey = paintKey;
    radioActionPanel.hidden = hidden;
    radioActionHeading.textContent = txt('Radio actions', 'Дії пульта');
    radioActionHint.textContent = !fireBound
      ? txt(
          'Assign a Fire switch in Radio setup to use these actions.',
          'Призначте Fire у налаштуванні пульта для цих дій.',
        )
      : pending
        ? txt(
            'Resume, release Fire, then activate Fire once to execute. Release again to shoot.',
            'Продовжте, відпустіть Fire й увімкніть його один раз для дії. Відпустіть знову, щоб стріляти.',
          )
        : txt(
            'Missing a switch? Choose one action here. It waits for your next Fire activation after resuming.',
            'Бракує перемикача? Оберіть дію. Вона чекатиме наступного натискання Fire після продовження.',
          );
    radioActionChoicesList.forEach(({ action, names, control }) => {
      control.textContent = txt(...names);
      control.disabled = !fireBound;
      control.setAttribute('aria-pressed', String(action === pending));
    });
    cancelRadioAction.textContent = txt('Cancel selected action', 'Скасувати обрану дію');
    cancelRadioAction.hidden = !pending;
    radioServiceGuidance.disabled = terminal(state ?? {});
    radioServiceGuidance.setAttribute('aria-pressed', String(combatNavigation === 'service'));
    radioServiceGuidance.textContent =
      combatNavigation === 'service'
        ? txt('Track target', 'Стежити за ціллю')
        : txt('Guide me to a service pad', 'Показати шлях до майданчика поповнення');
    radioActionBadge.hidden = !pending;
    radioActionBadge.textContent = pending
      ? txt(
          `Next Fire: ${txt(...radioActionNames[pending])} · release, then activate`,
          `Наступний Fire: ${txt(...radioActionNames[pending])} · відпустіть, потім увімкніть`,
        )
      : '';
  }
  function menuContext() {
    if (disposed) return null;
    if (radioMenus.context()) return radioMenus.context();
    // Keep flight keys in the reference arena and radio samples in the rate preview.
    if (advancedPractice) return advancedPractice.menuContext();
    if (tuning?.root.open)
      return {
        root: tuning.root,
        key: 'fpv-tuning',
        blockRadio: tuning.captureActive(),
        blockDevices: tuning.captureActive(),
        captureControllerIndex: gamepad.status().index,
        onCaptureBack: () => tuning.releaseCapture(),
      };
    const globalToolRoot = globalTools?.root();
    if (globalToolRoot)
      return {
        root: globalToolRoot,
        key: `global-tools:${globalToolRoot.id}`,
        frameFocused: globalTools.frameFocused(),
        handleFrameCommand: globalTools.handleFrameCommand,
      };
    if (enemyGuide.dialog.open) return { root: enemyGuide.dialog, key: enemyGuide.dialog.id };
    if (packRemovalReview?.dialog.open)
      return { root: packRemovalReview.dialog, key: 'pack-removal-review' };
    const secondary = [
      'world-radio-dialog',
      'drone-hangar',
      'sim-settings',
      'sim-flight-hud-details',
    ]
      .map($)
      .find((node) => node.open);
    if (secondary)
      return {
        root: secondary,
        key: secondary.id,
        radioSetup: secondary.id === 'world-radio-dialog',
        blockRadio: secondary.id === 'world-radio-dialog' && Boolean(radioSetup?.captureActive()),
        blockDevices: secondary.id === 'world-radio-dialog' && Boolean(radioSetup?.captureActive()),
        captureRadioBack: radioSetup?.captureRadioBack?.() !== false,
        onCaptureBack: () => radioSetup?.cancelCapture?.(),
      };
    if (missionChooser?.elements.dialog.open)
      return { root: missionChooser.elements.dialog, key: 'worlds-mission-library' };
    if (playShell?.topDialog())
      return { root: playShell.topDialog(), key: playShell.topDialog().id };
    if ($('flight-dialog').open) {
      if (beginnerCoach.previewRunning()) return null;
      if (beginnerCoach.blocksArm()) return { root: $('beginner-coach'), key: 'coach' };
      if (readFlightState()?.status === 'active') return null;
      return {
        root: $('flight-dialog'),
        key: `flight:${$('flight-dialog').dataset.optionsOpen}:${flightMenuOpen()}`,
        blockDevices: gamepadScope() !== 'blocked',
      };
    }
    return { root: doc.body, key: `lobby:${win.location.hash}` };
  }
  const menuNavigation = createFlightMenuNavigation({
    onRadioShortcut: (action, context) => radioMenus.shortcut(action, context),
    onAction: () => continuousPlay.cancel('controller'),
    document: doc,
    window: win,
    locale: () => locale,
    getContext: menuContext,
    ownsKeyboardEvent: (event) => simSettingsTabOwnsKey(event, menuContext()?.root),
    onHint(value) {
      const context = menuContext();
      if (context?.root === missionChooser?.elements.dialog) {
        menuHint.hidden = true;
        return;
      }
      // Blur suspends device ownership with an empty hint. Keep instructions
      // in open menus and native dialogs: clearing and restoring them can
      // move the clicked control between pointer press and release.
      if (!value && context) return;
      if (!context) {
        menuHint.hidden = true;
        return;
      }
      const container =
        context.root === $('sim-settings')
          ? (modeSettingsView?.panels.extras ?? context.root)
          : context.root === doc.body
            ? doc.querySelector('main')
            : context.root;
      if (menuHint.parentElement !== container) container.append(menuHint);
      if (context.root.dataset.modeSurface)
        context.root.setAttribute('aria-describedby', menuHint.id);
      menuHint.hidden = false;
      if (menuHint.textContent !== value) menuHint.textContent = value;
    },
    onBack() {
      if (radioMenus.back()) return;
      if (advancedPractice) {
        advancedPractice.back();
        return;
      }
      if (tuning?.root.open) {
        tuning.close();
        return;
      }
      if ($('sim-flight-hud-details')?.open) flightHud.closeDetails();
      else if (enemyGuide.dialog.open) enemyGuide.close();
      else if (packRemovalReview?.dialog.open) $('pack-removal-cancel').click();
      else if ($('world-radio-dialog').open) closeRadio();
      else if ($('drone-hangar').open)
        $('drone-hangar').querySelector('[data-close-hangar]').click();
      else if (globalTools?.back()) {
      } else if ($('sim-settings').open) closeSettings();
      else if (missionChooser?.elements.dialog.open) missionChooser.close();
      else if (playShell?.topDialog()) playShell.back();
      else if ($('flight-dialog').open) {
        if (flightMenuOpen()) setFlightMenu(false);
        else if ($('flight-dialog').dataset.optionsOpen === 'true') $('flight-options').click();
        else void closeFlight().catch(reportError);
      } else if (immersive.active()) void immersive.exit();
      else playShell?.openHome();
    },
  });
  function pollMenu(now) {
    let gamepads = [];
    try {
      gamepads = win.navigator.getGamepads?.() ?? [];
    } catch {
      /* Menus remain usable without device access. */
    }
    if (now - lastRadioDiscovery > 1000 && !$('world-radio-dialog').open) {
      lastRadioDiscovery = now;
      restoreRadio();
    }
    const context = menuContext(),
      state = readFlightState();
    refreshRadioActions(state);
    const pauseRoot = context?.root === playShell?.elements.dialogs.pause;
    const viewportRoot =
      context?.root === $('flight-dialog') &&
      $('flight-dialog').dataset.optionsOpen !== 'true' &&
      $('flight-dialog').dataset.immersiveControls !== 'true' &&
      !beginnerCoach.blocksArm();
    const playback = Boolean(replayProof || combatReplaySource);
    const available = Boolean(
      flight &&
        sceneReady &&
        !finished &&
        !terminal(state) &&
        !ghostLookup &&
        !(current?.regionalAdvanced && regionalAdvancedControls?.busy),
    );
    const arena = advancedPractice?.menuState();
    const observed = radioMenus.sync(
      arena
        ? {
            context,
            flightActive: arena.active,
            flightAvailable: arena.available,
            playback: false,
            canResume:
              arena.available &&
              arena.resumeReady &&
              !menuNavigation.snapshot().editing &&
              context?.root === advancedPractice.element,
            enabled: arena.radio,
          }
        : {
            context,
            flightActive: combatReplaySource
              ? Boolean(combatPlayback?.playing)
              : state?.status === 'active',
            flightAvailable: available,
            playback,
            canResume:
              available &&
              !menuNavigation.snapshot().editing &&
              !pendingFlightSteps.has(flight) &&
              (pauseRoot || viewportRoot) &&
              (!current?.regional || state?.reason === 'prepared' || playback) &&
              (combatReplaySource || ['paused', 'disarmed'].includes(state?.status)),
            enabled: $('flight-source').value === 'radio' || playback,
          },
    );
    menuNavigation.poll({
      now,
      gamepads,
      radio: radioSetup?.menuPreview?.() ?? observed,
    });
  }
  const fullscreenButtons = [];
  for (const parent of [
    doc.querySelector('.sim-utilities'),
    ...doc.querySelectorAll('dialog > header'),
  ]) {
    if (parent.querySelector('#world-fullscreen')) continue;
    const full = doc.createElement('button');
    full.type = 'button';
    full.dataset.simIcon = 'fullscreen';
    full.className = 'sim-screen-fullscreen';
    parent.append(full);
    fullscreenButtons.push(full);
  }
  const immersive = mountFlightFullscreen({
    document: doc,
    window: win,
    surface: $('flight-dialog'),
    viewport: $('world-viewport'),
    button: $('world-fullscreen'),
    buttons: fullscreenButtons,
    scope: 'application',
    getFocusTarget: () => doc.activeElement,
    setupButton: $('radio-setup-button'),
    kind: 'worlds',
    locale: () => locale,
    onPause: () => pauseFlight(),
    secondaryDialogOpen: () => !!doc.querySelector('dialog[open]:not(#flight-dialog)'),
  });
  on($('world-pause'), 'click', () => pauseFlight());
  // Restarting the current trial retains its aircraft, controller, rates and
  // camera. Explicit new flights omit this option and use saved preferences.
  function retainedDraftOptions() {
    return activeTuningDraft && !replayProof && !checkpointRequest
      ? { tuningDraft: clone(activeTuningDraft) }
      : {};
  }
  function retryFlight({ paused = false } = {}) {
    continuousPlay.cancel('retry');
    if (combatReplaySource) return watchCombatSession(combatReplaySource, { paused });
    if (current?.regional && !sceneReady && flight) {
      renderer.setRegional(flight, current.configuration.manifest);
      return prepareRegionalFlight();
    }
    return startFlight(current, {
      ...retainedDraftOptions(),
      encounter: clone(encounterSelection),
      preview,
      playlist: playingPlaylist,
      index: playlistIndex,
      replayProof,
      checkpoint: checkpointRequest,
      demonstration: replayKind === 'demonstration',
      lessonCamera: $('flight-camera').value,
      paused,
    });
  }
  function practiceState() {
    const state = readFlightState(),
      mode = $('flight-mode').value,
      demonstration = current && demonstrationFor(current, mode),
      canPractise = Boolean(
        current &&
          !flight?.combatDefinition &&
          !current.legacy &&
          !current.freeFlight &&
          !modePractice,
      );
    // A live recorder has not been verified yet. Only accepted replay/checkpoint
    // state or a matching authored example can advertise a recorded section.
    const recordedEntry = checkpointSession
      ? ['checkpoint', 'section-replay'].includes(checkpointSession.kind) &&
        checkpointRequest?.proof
      : replayProof || demonstration;
    const section =
      canPractise && recordedEntry
        ? Math.min((checkpointSession?.index ?? state.step) + 1, current.course.steps[mode].length)
        : null;
    return {
      available: Boolean(current && flight && (sceneReady || current.regional)),
      regional: Boolean(current?.regional),
      course: current?.course,
      mode,
      title: current ? label(current) : '',
      replay: Boolean(replayProof || combatReplaySource),
      rate: replayRate,
      rates: combatReplaySource ? [0.25, 0.5, 1, 2, 4] : [0.25, 0.5, 1],
      section,
      fullPractice: canPractise && !section,
      checkpoint: Boolean(section && checkpointSession),
      watch: Boolean(demonstration),
    };
  }
  async function practiceAction(action) {
    if (current?.regional && action === 'retry') return retryFlight({ paused: true });
    if (!sceneReady || !current || !flight) return;
    const selected = practiceState(),
      entry = current,
      camera = $('flight-camera').value;
    const options = { ...retainedDraftOptions(), lessonCamera: camera, paused: true };
    if (action === 'practice' || (action === 'try' && checkpointSession)) {
      if (!selected.section && !selected.fullPractice) return;
      const proof = selected.section
        ? (checkpointRequest?.proof ?? replayProof ?? demonstrationFor(entry, selected.mode))
        : null;
      options.checkpoint = {
        mode: selected.mode,
        index: selected.section ? selected.section - 1 : 0,
        proof,
        watch: false,
      };
    }
    playShell.enterPlay();
    if (action === 'retry') return retryFlight({ paused: true });
    if (action === 'repeat') return retryFlight();
    if (action === 'watch') return watchDemonstration(entry);
    return startFlight(entry, options);
  }
  on($('world-retry'), 'click', () => retryFlight());
  on($('world-watch-demo'), 'click', () => current && watchDemonstration(current));
  on($('watch-first-flight'), 'click', () =>
    watchDemonstration(
      catalogue.find((entry) => entry.legacy && entry.id === 'flight-01'),
      $('first-flight-mode').value,
    ),
  );
  on($('try-first-flight'), 'click', () => {
    $('flight-mode').value = $('first-flight-mode').value;
    savePreferences();
    return startFlight(catalogue.find((entry) => entry.legacy && entry.id === 'flight-01'));
  });
  on(
    $('fly-after-replay'),
    'click',
    () =>
      current &&
      (combatReplaySource
        ? startFlight(current, { encounter: clone(encounterSelection), paused: true })
        : practiceAction('try')),
  );
  function changeReplayRate() {
    const selected = Number($('world-replay-rate').value);
    const allowed = combatReplaySource ? [0.25, 0.5, 1, 2, 4] : [0.25, 0.5, 1];
    if (!allowed.includes(selected)) {
      $('world-replay-rate').value = String(replayRate);
      return;
    }
    replayRate = selected;
    lastTime = null;
    lastExecutionTime = win.performance?.now?.() ?? null;
    accumulator = 0;
  }
  on($('world-replay-rate'), 'change', changeReplayRate);
  on($('world-next'), 'click', () => {
    if (playingPlaylist) return flySequence(playingPlaylist, playlistIndex + 1);
  });
  on($('leave-flight'), 'click', closeFlight);
  for (const id of ['sim-game-return', 'flight-game-return']) {
    if (!$(id) || !gameReturn) continue;
    on($(id), 'click', async (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const token = flightToken;
      pauseFlight();
      await saveRecovery();
      if (!disposed && token === flightToken) win.location.assign(gameReturn);
    });
  }
  on($('flight-dialog'), 'cancel', (e) => {
    e.preventDefault();
    if (playShell?.topDialog()) playShell.back();
    else if (readFlightState()?.status === 'active') setFlightMenu(true);
    else if (flightMenuOpen()) setFlightMenu(false);
    else if (immersive.active()) void immersive.exit();
    else void closeFlight().catch(reportError);
  });
  on($('export-flight'), 'click', async () => {
    if (combatReplaySource) return;
    if (flight?.recording && !replayProof) {
      pauseFlight();
      try {
        download(await flight.recording(), 'aircraft-practice-clip.json');
      } catch (error) {
        reportError(error);
      }
      return;
    }
    if ((recorder || replayProof) && current) {
      const data = {
          course: current.course,
          proof: replayProof ?? recorder.export(),
          ...(current.legacy ? { presentation: appearanceSession.current() } : {}),
        },
        record = {
          id: dataIdentity(data),
          ...data,
          packIdentity: current.packIdentity,
          status: 'missing-dependency',
          diagnostic: 'Exported live recording',
          savedAt: Date.now(),
        };
      download((await exportProofParts([record]))[0], `${data.course.id}-flight.json`);
    }
  });
  on($('flight-source'), 'change', () => {
    if (replayProof || combatReplaySource) return;
    pauseFlight();
    input.select($('flight-source').value);
    if (checkpointSession && $('flight-source').value === 'radio')
      radio.reset({
        notify: false,
        pickup: Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [
            key,
            readFlightState()?.lastInput[key] / 1000,
          ]),
        ),
      });
    restoreRadio();
    paintInput(readFlightState());
  });
  function changeFlightMode(requestedMode) {
    if (combatReplaySource) return;
    const selectedMode = typeof requestedMode === 'string' ? requestedMode : $('flight-mode').value;
    const preserveFocus = Boolean(playShell?.elements.dialogs.pause.open);
    // Selecting another flight mode starts a new attempt. Only this explicit
    // action releases the mode-specific overlay; Retry keeps its accepted pin.
    // An explicit player choice ends the temporary demonstration-mode override.
    // Never restore the previous mode over the choice they just made.
    learningDemoReturn = null;
    const modeEntry =
      current?.course.world?.themeProfile?.format === 'ThemeProfile.v3'
        ? { ...current, course: current.sourceCourse, appearanceCourse: undefined }
        : current;
    renderCatalogue();
    if (checkpointRequest) {
      const hasSection = checkpointRequest.index < current.course.steps[selectedMode].length;
      const proof = hasSection ? demonstrationFor(current, selectedMode) : null;
      return startFlight(proof ? demonstrationEntry(modeEntry) : modeEntry, {
        mode: selectedMode,
        paused: true,
        preserveFocus,
        checkpoint: {
          ...checkpointRequest,
          mode: selectedMode,
          index: hasSection ? checkpointRequest.index : 0,
          proof,
        },
      });
    }
    if (replayProof) {
      const proof = replayKind === 'demonstration' ? demonstrationFor(current, selectedMode) : null;
      return startFlight(
        proof ? demonstrationEntry(modeEntry) : modeEntry,
        proof
          ? {
              mode: selectedMode,
              preview: true,
              replayProof: proof,
              demonstration: true,
              paused: true,
              preserveFocus,
            }
          : { mode: selectedMode, paused: true, preserveFocus },
      );
    }
    if (current && $('flight-dialog').open)
      return startFlight(modeEntry, {
        ...retainedDraftOptions(),
        mode: selectedMode,
        preview: preview && !modePractice,
        paused: true,
        preserveFocus,
        playlist: playingPlaylist,
        index: playlistIndex,
      });
  }
  on($('flight-mode'), 'change', changeFlightMode);
  on($('flight-touch-response'), 'change', () => {
    pauseFlight();
    input.touchResponse($('flight-touch-response').value);
    try {
      storage?.setItem('revealline.fpv.touch-response.v1', $('flight-touch-response').value);
    } catch {
      /* Touch response remains usable if browser storage is unavailable. */
    }
    if (flight) paintInput(readFlightState());
  });
  on($('flight-keyboard-preset'), 'change', () => {
    pauseFlight();
    input.keyboardPreset($('flight-keyboard-preset').value);
    try {
      storage?.setItem(KEYBOARD_PRESET_KEY, $('flight-keyboard-preset').value);
    } catch {
      /* Session controls remain usable without storage. */
    }
    if (flight) paintInput(readFlightState());
  });
  on($('flight-stick-display'), 'change', () => paintInput(readFlightState()));
  on($('flight-drone-guide'), 'change', () => paintInput(readFlightState()));
  on($('flight-guide-scale'), 'change', () => paintInput(readFlightState()));
  async function changeFlightVisuals(update) {
    const ready = sceneReady || qualityPreparing;
    pauseFlight();
    update();
    // A loading course prepares its final assets before enabling the arm control.
    if (!ready || !renderer || !flight) return;
    qualityPreparing = true;
    sceneReady = false;
    const token = flightToken,
      generation = ++scenePreparationGeneration;
    updateHUD(readFlightState());
    $('flight-status').textContent = txt('Preparing graphics…', 'Підготовка графіки…');
    try {
      let prepared = false;
      for (let attempt = 0; attempt < 3 && !prepared; attempt++) {
        prepared = (await renderer.prepare?.()) !== false;
        if (disposed || token !== flightToken || generation !== scenePreparationGeneration) return;
      }
      if (!prepared)
        throw new Error(
          txt(
            'Graphics changed during preparation. Retry the flight.',
            'Графіка змінилася під час підготовки. Повторіть політ.',
          ),
        );
      if (
        !(await applyCombatArt(
          renderer,
          () => !disposed && token === flightToken && generation === scenePreparationGeneration,
        ))
      )
        return;
      if (drawFlight(readFlightState()) === false) return;
      if (disposed || token !== flightToken || generation !== scenePreparationGeneration) return;
      qualityPreparing = false;
      sceneReady = true;
      updateHUD(readFlightState());
      $('flight-status').textContent = txt(
        'Graphics ready. Arm / resume when ready.',
        'Графіка готова. Увімкніть або продовжте політ, коли будете готові.',
      );
    } catch (error) {
      if (!disposed && token === flightToken && generation === scenePreparationGeneration) {
        qualityPreparing = false;
        reportError(error);
      }
    }
  }
  on($('flight-quality'), 'change', () =>
    changeFlightVisuals(() => renderer?.setQuality?.($('flight-quality').value)),
  );
  on($('drone-look'), 'change', () => appearanceControls.changed());
  for (const fireButton of [$('world-fire'), $('world-flight-fire')]) {
    on(fireButton, 'pointerdown', (e) => {
      e.preventDefault();
      if (!replayProof && !combatReplaySource && readFlightState()?.status === 'active') {
        fireReleaseRequired = false;
        fire = true;
        fireButton.setPointerCapture?.(e.pointerId);
      }
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      on(fireButton, event, () => {
        fire = false;
        fireReleaseRequired = false;
      });
  }
  on(win, 'keydown', (e) => {
    if (
      e.defaultPrevented ||
      disposed ||
      doc.visibilityState === 'hidden' ||
      (doc.hasFocus && !doc.hasFocus()) ||
      e.isComposing ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      beginnerCoach.blocksArm() ||
      !$('flight-dialog').open ||
      doc.querySelector('dialog[open]:not(#flight-dialog)') ||
      /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName) ||
      e.target?.isContentEditable
    )
      return;
    if (e.code === 'KeyP') {
      e.preventDefault();
      if (!e.repeat) setFlightMenu(true);
      return;
    }
    // Native buttons, links and summaries retain Space/keyboard activation.
    // Menus never own flight actions, even when a viewport still has focus.
    if (
      /^(BUTTON|A|SUMMARY)$/.test(e.target?.tagName) ||
      flightMenuOpen() ||
      $('flight-dialog').dataset.optionsOpen === 'true' ||
      immersive.snapshot().toolsOpen
    )
      return;
    const preset = keyboardFlightPreset($('flight-keyboard-preset').value);
    if (
      [preset.arm, preset.reset].includes(e.code) &&
      (!$('world-viewport').contains(e.target) || !$('world-viewport').contains(doc.activeElement))
    )
      return;
    if (e.code === preset.arm) {
      e.preventDefault();
      if (e.repeat) return;
      if (readFlightState()?.status === 'active') pauseFlight();
      else $('world-arm').click();
    } else if (e.code === preset.reset) {
      e.preventDefault();
      if (!e.repeat) return retryFlight({ paused: true });
    } else if (readFlightState()?.encounter && ['KeyC', 'KeyL', 'KeyG', 'KeyH'].includes(e.code)) {
      e.preventDefault();
      if (!e.repeat)
        combatCommand(
          { KeyC: 'weapon', KeyL: 'reload', KeyG: 'payload', KeyH: 'detonate' }[e.code],
        );
    } else if (e.code === preset.fire) {
      e.preventDefault();
      if (
        !replayProof &&
        !combatReplaySource &&
        !e.repeat &&
        !fireReleaseRequired &&
        readFlightState()?.status === 'active'
      ) {
        keyboardFireKey = e.code;
        fire = true;
      }
    }
  });
  // Menu navigation suppresses the release of keys held across its boundary.
  // Observe our own release first; this only relinquishes input, never fires.
  on(
    win,
    'keyup',
    (e) => {
      if (e.code === keyboardFireKey) {
        keyboardFireKey = null;
        fire = false;
        fireReleaseRequired = false;
      }
    },
    true,
  );
  on($('radio-setup-button'), 'click', () => {
    if (replayProof || combatReplaySource) return;
    pauseFlight();
    radioSetup?.dispose();
    radioSetup = mountRadioSetup({
      container: $('world-radio-setup'),
      window: win,
      runtime: radio,
      locale,
      onOpenRates() {
        closeRadio();
        tuning.open();
      },
      onDone() {
        if ($('flight-source').value !== 'radio') {
          $('flight-source').value = 'radio';
          $('flight-source').dispatchEvent(new win.Event('change', { bubbles: true }));
        }
        closeRadio();
      },
      onResponse: (rates) => {
        void tuningStore
          .saveProfile(tuningStore.snapshot().defaultProfileId, { response: rates })
          .then(() => {
            if (learningPreferences) learningResponse = clone(rates);
            response = learningPreferences ? { ...DEFAULT_RESPONSE } : rates;
            if (current && $('flight-dialog').open)
              return startFlight(current, {
                ...retainedDraftOptions(),
                preview,
                playlist: playingPlaylist,
                index: playlistIndex,
                checkpoint: checkpointRequest,
                paused: true,
              });
          })
          .catch(reportError);
      },
    });
    $('world-radio-dialog').showModal();
  });
  function closeRadio() {
    radioSetup?.dispose();
    radioSetup = null;
    $('world-radio-dialog').close();
    pauseFlight();
    if (tuningCalibrationReturn) {
      const done = tuningCalibrationReturn;
      tuningCalibrationReturn = null;
      done();
      return;
    }
    if (playShell?.elements.dialogs.pause.open)
      playShell.elements.content.pause.querySelector('[data-flight-setup="radio"]')?.focus();
    else if ($('sim-settings').open) $('radio-setup-button').focus();
    else if ($('flight-dialog').open) $('world-viewport').focus();
    else $('lobby-radio').focus();
  }
  on($('close-radio'), 'click', closeRadio);
  on($('world-radio-dialog'), 'cancel', (e) => {
    e.preventDefault();
    closeRadio();
  });
  on(win, 'gamepadconnected', () => restoreRadio());
  on(win, 'gamepaddisconnected', (e) => {
    if (!replayProof && !combatReplaySource && $('flight-source').value === 'radio')
      radio.disconnect(e.gamepad.index);
  });
  on(win, 'focus', () => restoreRadio());
  on(win, 'pagehide', () => pauseFlight(true, 'focus-lost'));
  const ready = (async () => {
    const results = await Promise.allSettled([
      openWorldStore({ indexedDB: win.indexedDB }),
      openWorldRecords(win.indexedDB),
      notebook.ready,
    ]);
    if (disposed) {
      for (const r of results) if (r.status === 'fulfilled') r.value?.close?.();
      return;
    }
    if (results[0].status === 'fulfilled') worldStore = results[0].value;
    else reportError(results[0].reason);
    if (results[1].status === 'fulfilled') {
      recordStore = results[1].value;
      recovery = await recordStore.session();
    } else reportError(results[1].reason);
    if (results[2].status === 'rejected') reportError(results[2].reason);
    await refreshStorage();
    appearanceControls.preferences.adoptExisting(
      Boolean(records.length || installed.length || notebook.snapshot().attempts.length),
    );
    $('storage-status').textContent =
      worldStore && recordStore
        ? txt(
            'Worlds and recordings are saved on this device. Export backups before clearing browser data.',
            'Світи та записи збережено на цьому пристрої. Експортуйте копії перед очищенням даних браузера.',
          )
        : txt(
            'Durable storage is unavailable. Export your work before leaving.',
            'Постійне сховище недоступне. Експортуйте роботу перед виходом.',
          );
  })();
  const shellMissions = el('section', undefined, 'sim-shell-missions');
  const lobbyHeader = doc.querySelector('.studio-header');
  const lobbyMain = doc.querySelector('main');
  shellMissions.append(lobbyHeader, lobbyMain);
  const shellModes = createSimModeLinks({
    document: doc,
    gameReturn,
    locale: () => locale,
    setMenuIcon(node, name) {
      node.dataset.simIcon = name;
      presentation.refresh(node);
    },
  });
  // The actual flight dialog owns loading/readiness announcements.
  const shellStage = el('div', undefined, 'sim-shell-loading');
  shellStage.hidden = true;
  const shellBriefing = el('section');
  const help = el(
    'p',
    txt(
      'Choose your controls in Settings. Your aircraft starts disarmed; Arm when you are ready.',
      'Оберіть керування в налаштуваннях. Дрон починає з вимкненими двигунами — увімкніть їх, коли будете готові.',
    ),
  );
  shellBriefing.append(help);
  shellBriefing.append(makeGuideButton('world-briefing-enemy-guide'));
  let shellTab = 'explore';
  const openCatalogueTab = (id) => {
    shellTab = id;
    playShell.open('missions');
  };
  missionLibrary = createSimMissionLibrary();
  syncDownloadMissions();
  void regionalLibrary.refreshMissions().catch(() => {});
  const missionTools = el('div', undefined, 'dialog-actions');
  const selectedTools = el('div', undefined, 'dialog-actions');
  const worldCatalogueHost = el('section', undefined, 'world-catalogue-host');
  const randomMission = button(txt('Random flight', 'Випадковий політ'), () =>
    missionChooser.playRandom(),
  );
  randomMission.dataset.randomFlight = 'catalogue';
  missionTools.append(randomMission);
  for (const [tab, en, uk] of [
    ['learn', 'Flight School', 'Льотна школа'],
    ['playlists', 'Playlists', 'Добірки'],
    ['creator', 'Workshop', 'Майстерня'],
    ['packs', 'World library', 'Бібліотека світів'],
  ]) {
    const tool = button(txt(en, uk), () => {
      missionChooser.close();
      openCatalogueTab(tab);
    });
    tool.dataset.simMissionTool = tab;
    missionTools.append(tool);
  }
  missionChooser = attachSimMissionLibraryChooser({
    document: doc,
    library: missionLibrary,
    supportedModes: ['solo'],
    randomDownloadable: true,
    randomFilter: (row) =>
      includesRandomLevel(
        row.ownerId === 'worlds:builtin' && learningMissionKeys.has(row.runtimeId),
      ),
    browsingContext: ({ label }) => `${navigationContext()} · ${label}`,
    description: () =>
      txt(
        'Every world and school lesson in one list. Choose a route; your flight settings and lesson coach stay with it.',
        'Усі світи й уроки в одному списку. Виберіть маршрут — налаштування польоту та навчальні підказки збережуться.',
      ),
    availableCollectionsOnly: true,
    launchContext: () => {
      const generation = ++missionLaunchGeneration;
      return {
        isCurrent: () => !disposed && !doc.hidden && generation === missionLaunchGeneration,
      };
    },
    goalPreferenceOptions: { editionId: 'sim-worlds', getStorage: () => storage },
    onPause: pauseFlight,
    getCurrentId: () => {
      // Leaving a flight clears current; Random still avoids its last catalogue level.
      const entry = current ?? catalogue.find((row) => keyOf(row) === lastCatalogueFlightKey);
      return (
        entry &&
        missionLibrary.missions.find(
          (row) =>
            row.runtimeId === keyOf(entry) ||
            (entry.regional &&
              row.ownerId === 'worlds:regions' &&
              row.runtimeId === `${entry.course.id}:${entry.packIdentity.slice(19)}`) ||
            (row.ownerId === 'worlds:downloads' &&
              row.runtimeId ===
                `${entry.packIdentity.slice(9)}:${revisions.find((pack) => `fpv-pack:${pack.sha256}` === entry.packIdentity)?.project.courses.findIndex((course) => course.id === entry.id)}`),
        )?.id
      );
    },
    readState: () => {
      try {
        return JSON.parse(storage?.getItem('revealline.sim.worlds.mission-browser.v1') ?? 'null');
      } catch {
        return null;
      }
    },
    writeState: (state) => {
      try {
        storage?.setItem('revealline.sim.worlds.mission-browser.v1', JSON.stringify(state));
      } catch {
        /* Selection remains available for this session. */
      }
    },
    renderPreview({ container, diagram: course, document }) {
      if (!course) return;
      const svg = routeThumbnail(document, course, {
        ...appearanceControls.resolve().appearance,
        flightMode: $('flight-mode').value,
      });
      svg.classList.add('journey-card-map');
      container.append(svg);
    },
    onSelection(row) {
      selectedTools.replaceChildren();
      const downloaded =
        row?.ownerId === 'worlds:downloads' &&
        worldLibrary
          .missions()
          .find((mission) => `${mission.row.sha256}:${mission.index}` === row.runtimeId);
      const entry = downloaded
        ? downloadedEntry(downloaded)
        : catalogue.find((entry) => keyOf(entry) === row?.runtimeId);
      if (!entry) return;
      const tool = (text, action) =>
        button(text, (...args) => {
          if (
            !disposed &&
            missionChooser.elements.dialog.open &&
            missionLibrary.find(row.id) === row
          )
            return action(...args);
        });
      if (demonstrationFor(entry, $('flight-mode').value))
        selectedTools.append(
          tool(txt('Watch example', 'Переглянути приклад'), () => {
            missionChooser.close();
            return watchDemonstration(entry);
          }),
        );
      if (worldEnemyGuide(entry.course, { mode: $('flight-mode').value }).rows.length) {
        const inspect = tool(txt('Preview targets', 'Переглянути цілі'), (event) =>
          enemyGuide.open(entry.course, {
            mode: $('flight-mode').value,
            trigger: event.currentTarget,
          }),
        );
        inspect.dataset.enemyGuideCourse = entry.id;
        selectedTools.append(inspect);
      }
      selectedTools.append(
        tool(txt('Add to playlist', 'Додати до добірки'), () => {
          if (entries.length >= 128)
            throw new Error(
              txt('A playlist supports up to 128 entries.', 'Добірка підтримує до 128 завдань.'),
            );
          entries.push({ packIdentity: entry.packIdentity, levelId: entry.id });
          renderPlaylist();
          status(txt('Added to your playlist.', 'Додано до добірки.'));
        }),
      );
      selectedTools.append(
        tool(txt('Free flight', 'Вільний політ'), () => {
          const course = clone(entry.course);
          course.format = 'FlightCourse.v2';
          delete course.pursuit;
          course.id = unique('freeflight');
          course.world ??= {
            id: entry.world,
            theme: entry.theme,
            style: FLIGHT_WORLDS.find((world) => world.id === entry.world)?.style ?? 'hangar',
          };
          course.actors = [];
          course.rules = { ...course.rules, maxTicks: 36000 };
          course.conditions ??= { profile: 'clear', revision: 'r1' };
          course.steps = {
            'self-level': [{ type: 'survive', ticks: 36000 }],
            acro: [{ type: 'survive', ticks: 36000 }],
          };
          missionChooser.close();
          return startFlight(
            {
              ...entry,
              id: course.id,
              freeFlight: true,
              course: validateWorldCourse(course),
              legacy: false,
              beginner: undefined,
            },
            { preview: true },
          );
        }),
      );
    },
  });
  const randomLevelsField = el('label', undefined, 'sim-random-levels');
  const randomLevelsCaption = el('span');
  const randomLevelsSelect = el('select');
  randomLevelsSelect.id = 'world-random-levels';
  const randomAutomatic = el('option'),
    randomMixed = el('option');
  randomAutomatic.value = 'auto';
  randomMixed.value = 'mixed';
  randomLevelsSelect.append(randomAutomatic, randomMixed);
  randomLevelsField.append(randomLevelsCaption, randomLevelsSelect);
  randomLevelControl = {
    label: randomLevelsCaption,
    select: randomLevelsSelect,
    automatic: randomAutomatic,
    mixed: randomMixed,
  };
  paintRandomLevels();
  missionChooser.elements.footer.querySelector('#journey-random-level').before(randomLevelsField);
  on(randomLevelsSelect, 'change', () => {
    randomLevelChoice = randomLevelsSelect.value === 'mixed' ? 'mixed' : 'auto';
    try {
      storage?.setItem(randomLevelsKey, randomLevelChoice);
    } catch {
      /* Keep this session's choice. */
    }
    paintRandomLevels();
    missionChooser.refresh();
  });
  // Keep both catalogues inside the chooser's one allocated scrolling row.
  // An unassigned grid child would create an implicit row beneath the action dock.
  courseClassFilter = mountAircraftCourseFilter({
    document: doc,
    locale: () => locale,
    onChange: renderCatalogue,
  });
  const worldBrowser = el('div', undefined, 'world-catalogue-browser');
  missionChooser.elements.list.before(worldBrowser);
  (
    missionChooser.elements.filters.querySelector('.journey-filter-options') ??
    missionChooser.elements.filters
  ).append(courseClassFilter.root);
  worldBrowser.append(worldCatalogueHost, missionChooser.elements.list);
  on(missionChooser.elements.dialog, 'close', () => {
    worldLibrary.deactivate(worldCatalogueHost);
    regionalLibrary.deactivate(worldCatalogueHost);
  });
  const shellWordmarkURL = new URL(
    lobbyHeader.querySelector('.wordmark img').getAttribute('src'),
    win.location.href,
  ).href;
  function resumeFromShell() {
    if (current?.regional && $('world-arm').disabled) {
      setFlightMenu(true);
      return;
    }
    if (current && flight) $('world-arm').click();
    else void resumeInterruptedFlight().catch(reportError);
  }
  playShell = mountSimPlayShell({
    document: doc,
    mount: doc.body,
    idPrefix: 'worlds-shell',
    homeLabels: {
      start: { en: 'Fly now', uk: 'Летіти' },
      missions: { en: 'Explore worlds', uk: 'Дослідити світи' },
    },
    homeAction: {
      label: { en: 'Learn to fly', uk: 'Навчитися літати' },
      activate: () => openCatalogueTab('learn'),
    },
    wordmarkURL: shellWordmarkURL,
    // The arcade return can be outside a standalone package's offline scope.
    artworkURL: new URL('../../menu-scenes/fpv.webp', shellWordmarkURL).href,
    modeName: navigationContext,
    locale,
    services: {
      settingsPanelBack: simSettingsPanelBack,
      setMenuIcon(node, name) {
        node.dataset.simIcon = name;
        presentation.refresh(node);
      },
    },
    slots: {
      brand: (() => {
        const image = el('img');
        image.src = lobbyHeader.querySelector('.wordmark img').getAttribute('src');
        image.alt = 'FPV / LINE';
        return image;
      })(),
      modes: shellModes,
      missions: shellMissions,
      briefing: shellBriefing,
      play: shellStage,
    },
    actions: {
      pause: () => pauseFlight(),
      start: () => $('hero-fly').click(),
      continue: resumeFromShell,
      resume: resumeFromShell,
      pauseFocus: () =>
        playShell.elements.content.pause.querySelector('[data-practice-action="retry"]'),
      retry: () => (current ? void retryFlight().catch(reportError) : $('hero-fly').click()),
      skip: () => {
        const index = Math.max(0, catalogue.indexOf(current));
        const entry = catalogue[(index + 1) % catalogue.length];
        if (entry) void startFlight(entry).catch(reportError);
      },
      random: () => void startRandomFlight().catch(reportError),
      fullscreen: () => void immersive.toggle(),
      toggleSound: () => soundButton.click(),
      canResume: () =>
        Boolean(recovery && dependencyAvailable(recovery.packIdentity, recovery.course.id)),
      open(surface) {
        missionLaunchGeneration++;
        paintLessonReturn(surface);
        if (readFlightState()?.status === 'active') pauseFlight();
        if (flight) updateHUD(readFlightState());
        if (surface !== 'missions') {
          missionChooser.close();
          worldLibrary.deactivate();
          regionalLibrary.deactivate();
        }
        if (surface === 'results') {
          // Keep the native result actions and async verification in place.
          playShell.enterPlay();
          setFlightMenu(false);
          const target = $('result-panel').hidden ? $('flight-status') : $('result-panel');
          target.setAttribute('tabindex', '-1');
          target.focus();
          return false;
        }
        if (surface === 'missions') {
          renderCatalogue();
          const tab = shellTab;
          shellTab = 'explore';
          if (['explore', 'learn'].includes(tab)) {
            openMissionChooser(tab);
            return false;
          }
          showTab(tab, false);
        } else if (surface === 'workshop' || surface === 'help') {
          missionChooser.close();
          openCatalogueTab(surface === 'workshop' ? 'creator' : 'learn');
          return false;
        } else if (surface === 'settings' || surface === 'expert') {
          missionChooser.close();
          openSettings();
          return false;
        }
      },
    },
    initial: 'home',
    // Recovery menus must render even when a lost graphics context stops drawing.
    onSurfaceChange: refreshFlightMenus,
    focusPlay: () => $('world-viewport').focus(),
  });
  playShell.elements.content.pause.append(radioActionPanel);
  cameraControls = mountFlightCameraControls({
    document: doc,
    window: win,
    shell: playShell,
    select: $('flight-camera'),
    viewport: $('world-viewport'),
    locale: () => locale,
    available: () => Boolean(sceneReady && flight && !finished && !terminal(readFlightState())),
    canShortcut: () =>
      !playShell.blocksPlay() &&
      $('flight-dialog').open &&
      !beginnerCoach.blocksArm() &&
      !flightMenuOpen() &&
      !doc.querySelector('dialog[open]:not(#flight-dialog)') &&
      !immersive.snapshot().toolsOpen,
  });

  flightSetup = mountFlightSetup({
    document: doc,
    window: win,
    shell: playShell,
    mode: $('flight-mode'),
    source: $('flight-source'),
    radioButton: $('radio-setup-button'),
    camera: cameraControls,
    locale: () => locale,
    available: () => Boolean(flight && sceneReady),
    inputRestarts: false,
    inputHint: () => {
      const source = $('flight-source').value;
      if (source === 'controller') return gamepadHelp();
      if (source === 'keyboard')
        return (
          keyboardFlightHelp($('flight-keyboard-preset').value, locale) +
          ' · V / R3: ' +
          (locale === 'uk' ? 'камера' : 'camera')
        );
      if (source === 'radio') return radioFlightHelp(radio.controlLayout(), locale);
      return locale === 'uk'
        ? 'Лівий стік: рискання/газ. Правий: крен/тангаж. Газ зберігається після відпускання. Для ввімкнення натисніть «Продовжити»; камера та пауза — у кутку екрана.'
        : 'Left stick: yaw/throttle. Right: roll/pitch. Throttle stays where you release it. Use Resume to arm; View and Pause stay in the screen corner.';
    },
  });

  practiceFlow = mountFlightPractice({
    document: doc,
    container: playShell.elements.content.pause,
    locale: () => locale,
    visible: () => playShell.elements.dialogs.pause.open,
    read: practiceState,
    rates: [0.25, 0.5, 1, 2, 4],
    act: (action) => practiceAction(action).catch(reportError),
    setRate(value) {
      $('world-replay-rate').value = String(value);
      $('world-replay-rate').dispatchEvent(new win.Event('change', { bubbles: true }));
    },
  });

  const regionalRecoveryRoot = el('section'),
    regionalRecoveryMessage = el('p'),
    regionalPerformanceRestart = el('button');
  regionalRecoveryRoot.hidden = true;
  regionalRecoveryRoot.dataset.regionalRecovery = '';
  regionalRecoveryMessage.setAttribute('role', 'status');
  regionalPerformanceRestart.type = 'button';
  regionalRecoveryRoot.append(regionalRecoveryMessage, regionalPerformanceRestart);
  playShell.elements.content.pause.prepend(regionalRecoveryRoot);
  regionalRecoveryControls = {
    root: regionalRecoveryRoot,
    message: regionalRecoveryMessage,
    restart: regionalPerformanceRestart,
    busy: false,
  };
  on(regionalPerformanceRestart, 'click', async () => {
    if (
      !current?.regional ||
      regionalPreparing ||
      regionalPerformanceRestart.disabled ||
      !['graphics-timeout', 'graphics-failed'].includes(regionalPreparationIssue?.kind)
    )
      return;
    regionalRecoveryControls.busy = true;
    paintRegionalPreparation();
    $('flight-quality').value = 'low';
    savePreferences();
    try {
      await startRegionalFlight(current, {
        ...retainedDraftOptions(),
        mode: $('flight-mode').value,
        lessonCamera: $('flight-camera').value,
        paused: true,
      });
    } catch (error) {
      reportError(error);
    } finally {
      regionalRecoveryControls.busy = false;
      paintRegionalPreparation();
    }
  });

  const extraTools = el('details', undefined, 'mission-library-setup');
  extraTools.dataset.simMissionTools = '';
  extraTools.append(
    el('summary', txt('SIM tools', 'Інструменти SIM')),
    selectedTools,
    missionTools,
    $('school-progress').closest('.school-progress-bar'),
    $('school-continue'),
  );
  missionChooser.elements.footer.append(extraTools);
  enemyStatsViews.push(
    mountSimEnemyStats({
      document: doc,
      container: playShell.elements.content.pause,
      stats: enemyStatistics.stats,
      gameType: 'worlds',
      getAttempt: enemyStatistics.getAttempt,
      variant: 'panel',
      locale: () => locale,
      spritePortraits: false,
    }),
  );
  const settingsDestinations = el('nav', undefined, 'sim-settings-destinations');
  settingsDestinations.setAttribute(
    'aria-label',
    txt('Guides and tools', 'Посібники та інструменти'),
  );
  for (const tab of ['learn', 'creator', 'packs']) {
    const destination = doc.querySelector(`[data-tab="${tab}"]`);
    if (!destination) continue;
    settingsDestinations.append(destination);
    on(destination, 'click', () => {
      closeSettings({ force: true });
      openCatalogueTab(tab);
    });
  }
  $('sim-settings-controls').after(settingsDestinations);
  const settingLabel = (id) => $(id)?.closest('label');
  const settingsContent = el('div');
  for (const child of [...$('sim-settings').children])
    if (child.tagName !== 'HEADER') settingsContent.append(child);
  $('sim-settings').append(settingsContent);
  const regionalStartRoot = el('section'),
    regionalStartLabel = el('label'),
    regionalStartText = el('span'),
    regionalStartSelect = el('select'),
    regionalStartRestart = el('button'),
    regionalStartGuide = el('button'),
    regionalNavigationOff = el('button'),
    regionalNavigationStatus = el('p'),
    regionalStartHelp = el('p');
  regionalStartRoot.hidden = true;
  regionalStartSelect.id = 'regional-starting-point';
  regionalStartLabel.htmlFor = regionalStartSelect.id;
  regionalStartHelp.id = 'regional-starting-point-help';
  regionalStartSelect.setAttribute('aria-describedby', regionalStartHelp.id);
  for (const button of [regionalStartRestart, regionalStartGuide, regionalNavigationOff])
    button.type = 'button';
  regionalStartGuide.dataset.regionalGuide = 'start';
  regionalNavigationOff.dataset.regionalGuide = 'off';
  regionalNavigationStatus.setAttribute('role', 'status');
  regionalStartLabel.append(regionalStartText, regionalStartSelect);
  regionalStartRoot.append(
    regionalStartLabel,
    regionalStartGuide,
    regionalStartRestart,
    regionalNavigationOff,
    regionalNavigationStatus,
    regionalStartHelp,
  );
  regionalStartControls = {
    root: regionalStartRoot,
    label: regionalStartText,
    select: regionalStartSelect,
    restart: regionalStartRestart,
    guide: regionalStartGuide,
    off: regionalNavigationOff,
    status: regionalNavigationStatus,
    help: regionalStartHelp,
    owner: null,
    signature: null,
    busy: false,
  };
  on(regionalStartRestart, 'click', restartRegionalAtSelection);
  on(regionalStartGuide, 'click', () => guideRegionalSelection('start'));
  on(regionalNavigationOff, 'click', () => {
    regionalNavigation = null;
    if (flight) updateHUD(readFlightState());
  });
  playShell.elements.content.pause.querySelector('.sim-flight-practice').append(regionalStartRoot);
  const regionalAdvancedRoot = el('section'),
    regionalAdvancedButton = el('button'),
    regionalAdvancedHelp = el('p'),
    regionalAdvancedExport = el('button'),
    regionalAdvancedRecoveryExport = el('button'),
    regionalAdvancedRestore = el('button'),
    regionalAdvancedCancelRecovery = el('button'),
    regionalAdvancedRecoveryFile = el('input'),
    regionalAdvancedMessage = el('p');
  regionalAdvancedRoot.hidden = true;
  regionalAdvancedButton.type = 'button';
  regionalAdvancedButton.dataset.regionalAdvanced = 'toggle';
  regionalAdvancedHelp.id = 'regional-advanced-help';
  regionalAdvancedButton.setAttribute('aria-describedby', regionalAdvancedHelp.id);
  for (const control of [
    regionalAdvancedExport,
    regionalAdvancedRecoveryExport,
    regionalAdvancedRestore,
    regionalAdvancedCancelRecovery,
  ])
    control.type = 'button';
  regionalAdvancedCancelRecovery.hidden = true;
  regionalAdvancedRecoveryFile.type = 'file';
  regionalAdvancedRecoveryFile.accept = '.json,application/json';
  regionalAdvancedRecoveryFile.hidden = true;
  regionalAdvancedMessage.setAttribute('role', 'status');
  regionalAdvancedRoot.append(
    regionalAdvancedButton,
    regionalAdvancedHelp,
    regionalAdvancedExport,
    regionalAdvancedRecoveryExport,
    regionalAdvancedRestore,
    regionalAdvancedCancelRecovery,
    regionalAdvancedRecoveryFile,
    regionalAdvancedMessage,
  );
  regionalAdvancedControls = {
    root: regionalAdvancedRoot,
    button: regionalAdvancedButton,
    help: regionalAdvancedHelp,
    exportRecording: regionalAdvancedExport,
    exportRecovery: regionalAdvancedRecoveryExport,
    restore: regionalAdvancedRestore,
    cancelRecovery: regionalAdvancedCancelRecovery,
    recovery: null,
    busy: false,
  };
  regionalStartRoot.after(regionalAdvancedRoot);
  on(regionalAdvancedButton, 'click', async () => {
    if (!current?.regional || regionalAdvancedControls.busy || regionalAdvancedButton.disabled)
      return;
    const selected = { ...current, regionalAdvanced: !current.regionalAdvanced };
    regionalAdvancedControls.busy = true;
    paintRegionalAdvanced();
    try {
      await startRegionalFlight(selected, {
        mode: selected.regionalAdvanced ? 'acro' : $('flight-mode').value,
      });
    } catch (error) {
      reportError(error);
    } finally {
      regionalAdvancedControls.busy = false;
      if (!disposed && flight) updateHUD(readFlightState());
    }
  });
  async function exportRegionalAdvanced(recoveryFile) {
    if (!current?.regionalAdvanced || regionalAdvancedControls.busy || !flight?.recording) return;
    pauseFlight();
    const selected = flight;
    regionalAdvancedControls.busy = true;
    paintRegionalAdvanced();
    try {
      const value = await (recoveryFile ? selected.captureRecovery() : selected.recording());
      if (disposed || flight !== selected) return;
      const outcome = await exportJSONFile(
        value,
        recoveryFile ? 'regional-advanced-recovery.json' : 'regional-advanced-recording.json',
        {
          locationRef: win.location,
          documentRef: doc,
          URLImpl: win.URL ?? globalThis.URL,
          BlobImpl: win.Blob ?? globalThis.Blob,
          schedule: win.setTimeout.bind(win),
        },
      );
      if (disposed || flight !== selected) return;
      regionalAdvancedMessage.textContent =
        outcome.status === 'shared'
          ? txt('File shared.', 'Файл надіслано.')
          : outcome.status === 'cancelled'
            ? txt('Export cancelled.', 'Експорт скасовано.')
            : txt(
                'Download requested. Check your downloads or Save dialog.',
                'Завантаження запитано. Перевірте завантаження або вікно збереження.',
              );
    } catch (error) {
      if (!disposed && flight === selected)
        regionalAdvancedMessage.textContent = txt(
          `Export failed: ${error.message}`,
          `Не вдалося експортувати: ${error.message}`,
        );
    } finally {
      regionalAdvancedControls.busy = false;
      if (!disposed && flight) updateHUD(readFlightState());
    }
  }
  on(regionalAdvancedExport, 'click', () => exportRegionalAdvanced(false));
  on(regionalAdvancedRecoveryExport, 'click', () => exportRegionalAdvanced(true));
  on(regionalAdvancedRestore, 'click', () => {
    if (regionalAdvancedRestore.disabled) return;
    pauseFlight();
    regionalAdvancedRecoveryFile.value = '';
    regionalAdvancedRecoveryFile.click();
  });
  on(regionalAdvancedCancelRecovery, 'click', () => regionalAdvancedControls.recovery?.cancel());
  on(regionalAdvancedRecoveryFile, 'change', async () => {
    const file = regionalAdvancedRecoveryFile.files?.[0],
      selected = flight;
    if (
      !file ||
      !current?.regionalAdvanced ||
      !selected?.restoreRecovery ||
      regionalAdvancedControls.busy
    )
      return;
    regionalAdvancedControls.busy = true;
    pauseFlight();
    let rejectCancellation;
    const cancelled = new Promise((_, reject) => {
      rejectCancellation = reject;
    });
    const owner = {
      restoreStarted: false,
      cancel() {
        if (owner.restoreStarted) selected.cancelPreparation();
        rejectCancellation(new DOMException('Recovery verification cancelled', 'AbortError'));
      },
    };
    regionalAdvancedControls.recovery = owner;
    paintRegionalAdvanced();
    regionalAdvancedMessage.textContent = txt(
      'Verifying recovery. Flight stays paused; you can cancel.',
      'Перевірка відновлення. Політ залишається на паузі; перевірку можна скасувати.',
    );
    let recoveryTimeout = null;
    try {
      if (file.size > ADVANCED_REGIONAL_RECOVERY_BYTES)
        throw new Error(txt('Recovery file is too large.', 'Файл відновлення завеликий.'));
      const value = JSON.parse(await Promise.race([file.text(), cancelled]));
      if (disposed || flight !== selected) return;
      owner.restoreStarted = true;
      await Promise.race([
        selected.restoreRecovery(value),
        cancelled,
        new Promise((_, reject) => {
          recoveryTimeout = win.setTimeout(() => {
            if (!disposed && flight === selected) selected.cancelPreparation();
            reject(new DOMException('Regional recovery preparation timed out', 'TimeoutError'));
          }, ADVANCED_VERIFICATION_WATCHDOG_MS);
        }),
      ]);
      win.clearTimeout(recoveryTimeout);
      regionalAdvancedControls.recovery = null;
      paintRegionalAdvanced();
      if (disposed || flight !== selected) return;
      sceneReady = false;
      await prepareRegionalFlight();
      regionalAdvancedMessage.textContent = ['duration-limit', 'recording-limit'].includes(
        selected.snapshot().reason,
      )
        ? txt(
            'Recovery restored at the flight limit. Export your recording or restart.',
            'Політ відновлено на межі запису. Експортуйте запис або перезапустіть.',
          )
        : txt(
            'Recovery restored. Flight stays paused; arm when ready.',
            'Політ відновлено на паузі; увімкніть, коли будете готові.',
          );
    } catch (error) {
      if (!disposed && flight === selected)
        regionalAdvancedMessage.textContent =
          error.name === 'AbortError'
            ? txt(
                'Recovery verification cancelled. The current flight is unchanged.',
                'Перевірку відновлення скасовано. Поточний політ не змінено.',
              )
            : txt(`Recovery failed: ${error.message}`, `Не вдалося відновити: ${error.message}`);
    } finally {
      win.clearTimeout(recoveryTimeout);
      if (regionalAdvancedControls.recovery === owner) regionalAdvancedControls.recovery = null;
      regionalAdvancedControls.busy = false;
      if (!disposed && flight) updateHUD(readFlightState());
    }
  });
  const placesRoot = el('section'),
    placesTitle = el('h3'),
    placeNameLabel = el('label'),
    placeNameText = el('span'),
    placeName = el('input'),
    placeSelectLabel = el('label'),
    placeSelectText = el('span'),
    placeSelect = el('select'),
    placeSave = el('button'),
    placeRestore = el('button'),
    placeGuide = el('button'),
    placeRemove = el('button'),
    placeRefresh = el('button'),
    placeHelp = el('p'),
    placeReview = el('div'),
    placeReviewText = el('p'),
    placeConfirm = el('button'),
    placeKeep = el('button');
  placesRoot.hidden = placeReview.hidden = true;
  placeName.id = 'regional-place-name';
  placeName.type = 'text';
  placeName.maxLength = 64;
  placeName.autocomplete = 'off';
  placeNameLabel.htmlFor = placeName.id;
  placeNameLabel.append(placeNameText, placeName);
  placeSelect.id = 'regional-saved-place';
  placeSelectLabel.htmlFor = placeSelect.id;
  placeSelectLabel.append(placeSelectText, placeSelect);
  placeHelp.id = 'regional-places-help';
  placeHelp.setAttribute('role', 'status');
  placeSelect.setAttribute('aria-describedby', placeHelp.id);
  placeName.setAttribute('aria-describedby', placeHelp.id);
  for (const button of [
    placeSave,
    placeRestore,
    placeGuide,
    placeRemove,
    placeRefresh,
    placeConfirm,
    placeKeep,
  ])
    button.type = 'button';
  placeReview.append(placeReviewText, placeConfirm, placeKeep);
  placesRoot.append(
    placesTitle,
    placeNameLabel,
    placeSave,
    placeSelectLabel,
    placeGuide,
    placeRestore,
    placeRemove,
    placeRefresh,
    placeReview,
    placeHelp,
  );
  regionalLocationControls = {
    root: placesRoot,
    title: placesTitle,
    label: placeName,
    labelText: placeNameText,
    select: placeSelect,
    selectText: placeSelectText,
    save: placeSave,
    restore: placeRestore,
    guide: placeGuide,
    remove: placeRemove,
    refresh: placeRefresh,
    help: placeHelp,
    review: placeReview,
    confirm: placeConfirm,
    keep: placeKeep,
    owner: null,
    locale: null,
    request: 0,
    locations: [],
    generation: null,
    loading: false,
    busy: false,
    removal: null,
    restoreUnavailable: false,
  };
  on(placeSave, 'click', saveRegionalLocation);
  on(placeRestore, 'click', restoreRegionalLocation);
  placeGuide.dataset.regionalGuide = 'saved';
  on(placeGuide, 'click', () => guideRegionalSelection('saved'));
  on(placeRefresh, 'click', () => void refreshRegionalLocations());
  on(placeRemove, 'click', () => {
    const c = regionalLocationControls;
    if (c.remove.disabled || c.owner !== current) return;
    const place = c.locations.find((item) => item.id === c.select.value);
    if (!place) return;
    c.removal = { id: place.id, generation: c.generation };
    placeReviewText.textContent = txt(
      `Remove “${place.label}” from this device?`,
      `Видалити «${place.label}» з цього пристрою?`,
    );
    placeReview.hidden = false;
    placeKeep.focus();
  });
  on(placeKeep, 'click', () => {
    placeReview.hidden = true;
    regionalLocationControls.removal = null;
  });
  on(placeConfirm, 'click', removeRegionalLocation);
  regionalStartRoot.after(placesRoot);
  tuning = mountFlightTuning({
    document: doc,
    window: win,
    store: tuningStore,
    locale: () => locale,
    onOpen: () => pauseFlight(),
    getFlightConfiguration: () => workbenchAttemptConfiguration,
    responseBenchWorkerURL: new URL('../fpv-worlds/response-bench-worker.mjs', import.meta.url),
    getPracticeConditions: () => {
      const entry =
        tuningReturnEntry ?? current ?? catalogue.find((item) => !item.beginner && !item.legacy);
      if (!entry) return null;
      return {
        host: entry.regional ? 'Regional' : 'World',
        courseId: entry.id,
        mode: $('flight-mode').value,
        courseIdentity: dataIdentity(entry.regional ? entry.configuration : entry.course),
        label: `${entry.regional ? 'Regional' : 'World'} · ${entry.id} · ${$('flight-mode').value}`,
        input: {
          source: $('flight-source').value,
          keyboard: $('flight-keyboard-preset').value,
          touch: $('flight-touch-response').value,
          radio: radio.status().profile,
          radioDevice: radio.status().selected?.key ?? null,
          controller: { id: gamepad.status().id, index: gamepad.status().index },
        },
      };
    },
    canCalibrate: () => !$('radio-setup-button').disabled,
    onCalibration(done) {
      tuningCalibrationReturn = done;
      $('radio-setup-button').click();
    },
    onApply() {
      if ($('sim-settings').open) closeSettings({ force: true });
      const entry =
        tuningReturnEntry ?? current ?? catalogue.find((item) => !item.beginner && !item.legacy);
      tuningReturnEntry = null;
      if (entry) void startFlight(entry, { paused: true }).catch(reportError);
    },
    onTest(configuration) {
      if ($('sim-settings').open) closeSettings({ force: true });
      const entry =
        tuningReturnEntry ?? current ?? catalogue.find((item) => !item.beginner && !item.legacy);
      if (!entry) return;
      tuningReturnEntry = entry;
      void startFlight(
        { ...entry, freeFlight: true },
        { preview: true, tuningDraft: configuration },
      ).catch(reportError);
    },
    getDiagnostics: () =>
      inputDiagnostics.read(
        flight,
        replayProof || combatReplaySource ? 'recording' : $('flight-source').value,
        !replayProof && !combatReplaySource && $('flight-source').value === 'radio'
          ? radio.diagnostics()
          : !replayProof && !combatReplaySource && $('flight-source').value === 'controller'
            ? gamepad.previewDiagnostics()
            : null,
      ),
    onAdvanced(configuration) {
      pauseFlight();
      const container = doc.createElement('dialog');
      container.className = 'fpv-advanced-dialog';
      doc.body.append(container);
      container.showModal();
      const session = mountAdvancedPractice({
        workerURL: new URL('../fpv-worlds/advanced-worker.mjs', import.meta.url),
        container,
        window: win,
        locale,
        configuration: configuration.advanced,
        components: configuration.components,
        response: configuration.response,
        profile: configuration.response.rates,
        camera: { tilt: configuration.camera.tilt, fov: configuration.camera.verticalFov },
        inputSource: radio.status().verified ? 'radio' : 'keyboard',
        requestRadioStart: () => radio.status().active || radio.requestArm(),
        getControls: () => {
          const sample = radio.preview();
          return sample.verified ? sample.controls : null;
        },
        onPause: () => {
          if (radio.status().active) radio.freeze('paused');
        },
        async onSaveConfiguration(advanced, metadata = {}) {
          await tuning.savePracticeDraft(advanced, metadata);
        },
        onClose() {
          advancedPractice?.dispose();
          advancedPractice = null;
          container.close();
          container.remove();
          tuning.open({ keepDraft: true });
        },
      });
      advancedPractice = {
        ...session,
        dispose() {
          session.dispose();
          container.close();
          container.remove();
        },
      };
      container.addEventListener('cancel', (event) => {
        event.preventDefault();
        advancedPractice?.dispose();
        advancedPractice = null;
        tuning.open({ keepDraft: true });
      });
    },
  });
  tuning.button(playShell.elements.content.pause);
  tuning.button($('drone-hangar'));
  tuning.button(shellBriefing);
  aircraftAdviceText = doc.createElement('p');
  aircraftAdviceText.hidden = true;
  shellBriefing.append(aircraftAdviceText);
  aircraftControls = mountAircraftPracticeControls({
    parent: playShell.elements.content.pause,
    window: win,
    workerURL: new URL('../fpv-worlds/advanced-worker.mjs', import.meta.url),
    key: 'world',
    locale: () => locale,
    getSession: () => (replayProof || combatReplaySource ? null : flight),
    onPause: () => pauseFlight(),
  });
  aircraftChallengeControls = mountAircraftChallengeControls({
    parents: [shellBriefing, playShell.elements.content.pause],
    statusParent: $('world-viewport'),
    locale: () => locale,
    getSession: () => (replayProof || combatReplaySource ? null : flight),
    async onRestart(rules) {
      if (!aircraftAttemptConfiguration || !current) return;
      await startFlight(current, {
        preview: true,
        mode: $('flight-mode').value,
        tuningDraft: aircraftAttemptConfiguration,
        challenge: rules,
      });
    },
  });
  $('world-viewport').append(tuning.returnButton);
  for (const cameraId of ['world-fov', 'world-tilt'])
    on($(cameraId), 'change', () => {
      if (activeTuningDraft) return;
      tuningStore.refresh();
      const library = tuningStore.snapshot(),
        setup = library.setups.find((item) => item.id === library.selectedSetupId);
      void tuningStore
        .saveSetup(
          {
            ...setup,
            camera: {
              tilt: Number($('world-tilt').value),
              verticalFov: Number($('world-fov').value),
            },
          },
          library.revision,
        )
        .catch(reportError);
    });
  modeSettingsView = mountSimModeSettings({
    root: $('sim-settings'),
    content: settingsContent,
    prefix: 'worlds-settings',
    locale,
    attachPanels: simAttachSettingsPanels,
    setMenuIcon(node, name) {
      node.dataset.simIcon = name;
      presentation.refresh(node);
    },
    groups: {
      gameplay: [settingLabel('flight-mode'), encounterControls.root],
      controls: [
        tuning.button(),
        settingLabel('flight-source'),
        $('radio-setup-button'),
        radioFireHelp,
        settingLabel('flight-touch-response'),
        settingLabel('flight-keyboard-preset'),
      ],
      audio: [$('sim-audio-mix'), settingsContent.querySelector('[data-i18n="audioMixHelp"]')],
      display: [
        settingLabel('world-language'),
        $('sim-settings').querySelector('.sim-screen-fullscreen'),
        settingLabel('flight-camera'),
        settingLabel('drone-look'),
        $('inspect-drone'),
        settingLabel('flight-quality'),
        settingLabel('world-fov'),
        settingLabel('world-tilt'),
        flightControls.querySelector('.sim-appearance-controls'),
        flightControls.querySelector('[data-hunt-presentation]')?.closest('fieldset'),
        detailLabel,
        combatArtControls,
      ],
      accessibility: [
        ...combatFeedbackFields.map(({ label }) => label),
        flightControls.querySelector('[data-sim-hud-preferences]'),
        settingLabel('sim-text-face'),
        settingLabel('sim-motion'),
        settingLabel('flight-stick-display'),
        settingLabel('flight-drone-guide'),
        settingLabel('flight-guide-scale'),
      ],
      data: [
        $('backup-proofs'),
        settingLabel('import-proofs'),
        $('storage-status'),
        $('proof-records').closest('details'),
      ],
      content: [
        doc.querySelector('[data-tab="creator"]'),
        doc.querySelector('[data-tab="packs"]'),
        $('prepare-runtime'),
        settingsRuntimeOfflineStatus,
        $('persistent-storage'),
      ],
      extras: [
        doc.querySelector('[data-tab="learn"]'),
        lessonReturnButton,
        lessonReturnError,
        settingsContent.querySelector('[data-i18n="settingsHelp"]'),
        settingsContent.querySelector('[data-i18n="settingsPaused"]'),
      ],
    },
  });
  flightComfort = mountFlightComfort({
    document: doc,
    window: win,
    panels: modeSettingsView.panels,
    viewport: $('world-viewport'),
    fov: $('world-fov'),
    tilt: $('world-tilt'),
    host: 'worlds',
    locale: () => locale,
    canChange: () => !flight || readFlightState()?.status !== 'active' || playShell.blocksPlay(),
    canPersistCamera: () => !activeTuningDraft,
    comparison: {
      root: playShell.elements.content.pause,
      button: ghostButton,
      visible: () => !current?.regional,
      status: () => $('sector-reference').textContent,
    },
  });
  const globalThemeControls = attachSimThemeFamilyControls({
    document: doc,
    root: modeSettingsView.panels.display,
    host: appearanceControls.host,
    prefix: 'worlds-global-',
  });
  const displayBinding = (key) => ({
    get: () => displayPreferences.snapshot()[key],
    set: (value) => displayPreferences.set({ [key]: value }),
    subscribe: (listener) => displayPreferences.subscribe(listener),
  });
  globalSettingsView = mountSimGlobalSettings({
    document: doc,
    root: $('sim-settings'),
    panels: modeSettingsView.panels,
    prefix: 'worlds-global',
    locale,
    controls: {
      language: settingLabel('world-language'),
      appearance: modeSettingsView.panels.display.querySelector('[data-theme-controls]'),
      textFace: settingLabel('sim-text-face'),
    },
    bindings: {
      textFace: displayBinding('textFace'),
      textSize: displayBinding('textSize'),
      reducedEffects: displayBinding('reducedEffects'),
      menuAnimation: simMenuAnimationBinding(win),
      masterMuted: {
        get: () => audio.masterSnapshot().muted,
        set: (value) => audio.setEnabled(!value),
        subscribe: (listener) => audio.subscribeMaster(listener),
      },
      masterVolume: {
        get: () => audio.masterSnapshot().volume,
        set: (value) => audio.setMasterVolume(value),
        subscribe: (listener) => audio.subscribeMaster(listener),
      },
    },
    duplicates: { reducedEffects: [settingLabel('sim-motion')] },
  });
  const sharedAudioCues = doc.createElement('section');
  let radioCueStorage;
  try {
    radioCueStorage = win.localStorage;
  } catch {
    /* Preferences still work for this visit. */
  }
  let sharedRadioCues = readSimRadioAudio(radioCueStorage);
  const restoreRadioCues = () => {
    if (radioCueStorage) sharedRadioCues = readSimRadioAudio(radioCueStorage);
  };
  on(win, 'pageshow', restoreRadioCues);
  on(win, 'storage', (event) => {
    if (event.key === SIM_RADIO_AUDIO_KEY || event.key === null) restoreRadioCues();
  });

  const cueSettings = {
    gameplayOutput: audio.gameplayOutput,
    // This preference is global; the 3D engine has no separate radio bus.
    // The canonical Soundscape consumes the same record in supported modes.
    get radioSettings() {
      return sharedRadioCues;
    },
    set radioSettings(value) {
      sharedRadioCues = value;
    },
    get menuSettings() {
      return presentation.menuSettings;
    },
    set menuSettings(value) {
      presentation.menuSettings = value;
    },
    get movementSettings() {
      return audio.movementSettings;
    },
    set movementSettings(value) {
      audio.movementSettings = value;
    },
    applyVolumes() {
      presentation.applyVolumes();
      audio.applyVolumes();
    },
  };
  listeners.push(
    attachSimMenuAudioSettings(cueSettings, doc, {
      target: sharedAudioCues,
      window: win,
      getStorage: () => win.localStorage,
      idPrefix: 'sim-global',
    }),
  );
  globalSettingsView.update({ controls: { audioCues: sharedAudioCues } });
  globalTools = globalToolsFactory({
    document: doc,
    window: win,
    gameReturn: gameReturn,
    settingsRoot: $('sim-settings'),
    panels: modeSettingsView.panels,
    locale: () => locale,
    onOpen: () => pauseFlight(),
    onControls: (controls) => globalSettingsView.update({ controls }),
  });
  // Keep the old wrappers as inert restoration homes for the real controls.
  for (const child of [...settingsContent.children])
    if (!child.classList.contains('mode-settings-layout')) child.hidden = true;

  playShell.elements.content.home.append(makeGuideButton('world-menu-enemy-guide'));
  on(doc.querySelector('.wordmark'), 'click', () => playShell.openHome());
  for (const id of ['lobby-sound', 'world-sound'])
    if ($(id)) on($(id), 'click', () => playShell.update({ muted: !audio.enabled() }));
  for (const id of preferenceIds) on($(id), 'change', savePreferences);
  paintLanguage();
  paintInput(null);
  renderFilters();
  renderCatalogue();
  showTab(win.location.hash.slice(1) || 'explore', false);
  if (['explore', 'learn', 'playlists', 'creator', 'packs'].includes(win.location.hash.slice(1)))
    openCatalogueTab(win.location.hash.slice(1));
  renderPlaylist();
  const requested = new URL(win.location.href).searchParams;
  if (requested.has('regionalReview'))
    void ready
      .then(() =>
        disposed
          ? null
          : reviewRegion({
              manifestURL: requested.get('regionalReview'),
              sceneryURL: requested.get('regionalScenery'),
            }),
      )
      .catch(reportError);
  const requestedWorld = requested.get('community-world'),
    requestedRevision = requested.get('community-revision');
  if (
    requestedWorld &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(requestedWorld) &&
    /^[a-f0-9]{64}$/.test(requestedRevision ?? '')
  )
    void ready
      .then(() => {
        if (disposed) return;
        const entry = catalogue.find(
          (candidate) =>
            candidate.projectId === requestedWorld &&
            candidate.packIdentity === `fpv-pack:${requestedRevision}`,
        );
        if (!entry)
          throw new Error(
            txt(
              'This exact community world is not installed. Reinstall its package.',
              'Цей точний світ спільноти не встановлено. Перевстановіть пакунок.',
            ),
          );
        return startFlight(entry);
      })
      .catch(reportError);
  const requestedChapter = requested.get('snake-hunt');
  const huntPlaylist = CURATED_PLAYLISTS.find(
    (playlist) => playlist.id === `snake-hunt-${requestedChapter}`,
  );
  if (huntPlaylist) loadPlaylist(huntPlaylist);
  const requestedCourse = requested.get('snake-course');
  const huntEntry = catalogue.find(
    (entry) => entry.activity === 'hunt' && entry.id === requestedCourse,
  );
  if (huntEntry)
    void ready
      .then(() => {
        if (!disposed) return startFlight(huntEntry);
      })
      .catch(reportError);
  void cloneChallenge(catalogue.find((e) => !e.legacy)).catch(reportError);
  raf = win.requestAnimationFrame(frame);
  return {
    ready,
    startFlight,
    reviewRegion,
    pause: pauseFlight,
    snapshot: () => ({
      course: current?.id,
      combatArt: {
        ...combatArtChoice.snapshot(),
        active:
          renderer?.resources?.().combatAppearance?.state === 'ready' ? 'realistic' : 'current',
        renderer: renderer?.resources?.().combatAppearance ?? null,
      },
      appearance: {
        ...appearanceControls.resolve(),
        accepted: appearanceSession.current(),
        pending: appearanceSession.pending(),
      },
      state: flight?.snapshot(),
      combatArchive: combatArchive?.snapshot() ?? null,
      combatPlayback: combatPlayback
        ? {
            ...combatPlayback.job.snapshot(),
            state: undefined,
            playing: combatPlayback.playing,
            rate: replayRate,
            error: combatPlayback.error,
            verification: combatPlayback.verification,
          }
        : null,
      replay: replayProof
        ? {
            kind: replayKind,
            mode: recordingMetadata(replayProof).mode,
            rate: replayRate,
            frames: replayProof.frames.length,
            startTick: replayStartTick,
            finished,
          }
        : null,
      sectorTiming: {
        status: sectorReferenceStatus,
        reference: clone(sectorReference),
        referenceId: sectorReferenceId,
        sectors: sectors.snapshot(),
        latest: sectors.latest(sectorReference?.sectors),
      },
      ghost: {
        enabled: ghostEnabled,
        loading: Boolean(ghostLookup),
        referenceId: ghostEnabled ? (sectorReference?.id ?? null) : null,
        presentation: renderer?.ghostSnapshot?.() ?? null,
        resources: renderer?.resources?.() ?? null,
      },
      editorPresentation: spatialEditor?.resources?.().presentation ?? null,
      checkpointPractice: checkpointSession ? clone(checkpointSession) : null,
      sectionReplay:
        replayKind === 'section' && checkpointSession
          ? {
              index: checkpointSession.index,
              startTick: checkpointSession.startTick,
              endTick: checkpointSession.endTick,
              sectionComplete: checkpointSession.sectionComplete,
              recordedStatus: checkpointSession.recordedStatus,
              finished,
            }
          : null,
      modePractice,
      recording: recorder?.recordingStatus?.() ?? null,
      records: clone(records),
      catalogue: catalogue.length,
      learning: current?.beginner
        ? { lesson: current.beginner, guideOpen: beginnerCoach.blocksArm() }
        : null,
      radio: radio.status(),
      immersive: immersive.snapshot(),
      inputDisplay: {
        source: $('world-touch').dataset.source,
        style: $('flight-stick-display').value,
      },
    }),
    dispose() {
      if (closing) return closing;
      disposed = true;
      regionalManifestRequest?.abort();
      closing = Promise.resolve().then(async () => {
        courseClassFilter?.dispose();
        missionChooser.destroy();
        missionLibrary.dispose();
        runtimeOffline.dispose();
        worldLibrary.dispose();
        regionalLibrary.dispose();
        proofImport?.abort();
        packRemovalReview?.close();
        restorePackIdentity = null;
        restorePackInput.remove();
        ++flightToken;
        industrialPreparation?.abort();
        industrialPreparation = null;
        editorEnvironmentPreparation?.abort();
        editorEnvironmentPreparation = null;
        editorEnvironmentRequest++;
        checkpointPreparation?.abort();
        checkpointPreparation = null;
        abortSectorLookup();
        pauseFlight();
        immersive.dispose();
        const notebookClosing = Promise.resolve().then(() => notebook.close());
        void notebookClosing.catch(() => {});
        let saveError;
        try {
          // Hydration may own pending storage requests and still need the DOM.
          await Promise.allSettled([ready]);
          await saveRecovery();
        } catch (error) {
          saveError = error;
        }
        try {
          win.cancelAnimationFrame(raf);
          for (const remove of listeners) remove();
          if (playShell) playShell.elements.root.prepend(playShell.elements.header);
          menuNavigation.dispose();
          radioMenus.dispose();
          globalTools?.dispose();
          globalSettingsView?.destroy();
          globalThemeControls?.dispose();
          displayPreferences.dispose();
          modeSettingsView?.destroy();
          menuHint.remove();
          input.dispose();
          gamepad.dispose();
          radioSetup?.dispose();
          await removeRegionalNativeInactive?.();
          void regionalLocationsStore?.then((store) => store.close()).catch(() => {});
          await retireCombatArchive();
          combatArchiveStore?.close();
          await combatAutosaves.close();
          await stopCombatPlayback();
          await flight?.dispose?.();
          flight = null;
          recorder = null;
          current = null;
          sectorReferenceProof = null;
          ghostEnabled = false;
          renderer?.dispose();
          hangar.dispose();
          appearanceControls.dispose();
          combatArtChoice.dispose();
          combatArtControls.remove();
          actorEditor?.dispose();
          audioControls.dispose();
          encounterEditor?.dispose();
          encounterControls.dispose();
          combatVitals.dispose();
          combatOverlay.remove();
          combatHit.remove();
          combatScreen.remove();
          radioFlightNotice.remove();
          radioFireHelp.remove();
          combatPresentationPreferences.dispose();
          huntPresentationControls.dispose();
          huntReactions.dispose();
          enemyStatsViews.forEach((view) => view.dispose());
          await enemyStatistics.stats.flush();
          enemyStatistics.close();
          flowControls?.dispose();
          flowCelebration?.dispose();
          continuousPlay.dispose();
          enemyGuide.dispose();
          audio.dispose();
          presentation.dispose();
          droneResponse.dispose();
          stickTraces.forEach((trace) => trace.dispose());
          beginnerCoach.dispose();
          flightHud.destroy();
          spatialEditor?.dispose();
          routeGuideEditor?.dispose();
          // Keep reparented controls available until their input, hints,
          // audio and editor owners have all retired.
          flightComfort?.dispose();
          flightSetup?.dispose();
          practiceFlow?.dispose();
          tuning?.dispose();
          aircraftControls?.dispose();
          aircraftChallengeControls?.dispose();
          advancedPractice?.dispose();
          cameraControls?.dispose();
          flightInstruments.destroy();
          playShell?.dispose();
        } finally {
          try {
            await notebookClosing;
          } finally {
            recordStore?.close();
            worldStore?.close();
            if (saveError) throw saveError;
          }
        }
      });
      return closing;
    },
  };
}

if (globalThis.document?.documentElement?.dataset.fpvWorlds === 'true') {
  const app = mountWorldApp();
  globalThis.fpvWorldStudio = app;
  void app.ready.catch((error) => {
    document.getElementById('studio-status').textContent = error.message;
  });
}
