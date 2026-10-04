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
  replayWorldFlight,
  recoverWorldFlight,
  validateWorldCourse,
  worldCourseRequiresAcro,
  WORLD_FLIGHT_MODEL,
} from './world-model.mjs';
import { WORLD_COLLISION_BACKEND } from './world-collision.mjs';
import { mountBeginnerCoach } from './beginner-coach.mjs';
import {
  createFlightInput,
  createFlightMenuNavigation,
  createFlightGamepad,
  keyboardFlightPreset,
  keyboardFlightHelp,
  KEYBOARD_PRESET_KEY,
} from './input.mjs';
import { createRadioRuntime } from './radio-runtime.mjs';
import { restoreVerifiedRadio } from './radio-session.mjs';
import { mountRadioSetup } from './radio-setup.mjs';
import {
  mountFlightFullscreen,
  mountSimPlayShell,
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
import { mountWorldLibrary } from './world-reaction-runtime.mjs';
import { dataIdentity } from '../../game/data-json.mjs';
import {
  THEME_PROFILES,
  resolveThemeExperience,
  resolveSimThemeProfile,
  snapshotSimThemeProfile,
  recordedSimAppearance,
  createSimAppearanceSession,
  playableSimAppearance,
} from './world-themes.mjs';
import { mountWorldEditor } from './world-editor.mjs';
import {
  mountSimPresentation,
  mountSimAppearanceControls,
  mountDroneResponse,
  mountSimAudioControls,
  paintStickDirections,
  mountStickTrace,
} from './sim-presentation.mjs';
import { createWorldAudio } from './world-reaction-runtime.mjs';
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
import { mountActorEditor } from './world-reaction-runtime.mjs';
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
  fire: 'Fire · Space',
  next: 'Next in playlist',
  exportProof: 'Export recording',
  tilt: 'Camera tilt',
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
  fire: 'Вогонь · Пробіл',
  next: 'Наступне завдання',
  exportProof: 'Експорт запису',
  tilt: 'Нахил камери',
  keys: keyboardFlightHelp('two-stick', 'uk', { combat: true }),
  themePreview: 'Авторська тема',
  snap: 'Прив’язка',
  resetView: 'Скинути огляд',
  editorHint:
    'Виберіть маркер і тягніть стрілки; тягніть порожнє місце для обертання, прокручуйте для масштабу.',
  chooseFolder: 'Вибрати папку сцени',
  inspectDrone: 'Оглянути дрон',
  hangarHelp:
    'Тягніть для обертання, прокручуйте для масштабу. Усі моделі мають однакові льотні властивості.',
  newWorld: 'Почати новий світ',
};
const clone = (value) => structuredClone(value);
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
        id: a.id,
        type: a.actorType ?? 'drone',
        position: mm(a.position),
        ...(a.settings ?? {}),
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
  for (const o of course.obstacles) {
    const x = o.min?.x ?? Math.min(...o.vertices.filter((_, i) => i % 3 === 0)),
      z = o.min?.z ?? Math.min(...o.vertices.filter((_, i) => i % 3 === 2));
    const mx = o.max?.x ?? Math.max(...o.vertices.filter((_, i) => i % 3 === 0)),
      mz = o.max?.z ?? Math.max(...o.vertices.filter((_, i) => i % 3 === 2));
    add('rect', {
      x: px(x),
      y: pz(z),
      width: Math.max(2, px(mx) - px(x)),
      height: Math.max(2, pz(mz) - pz(z)),
      fill: color(palette.wall, 0.65),
      stroke: color(palette.fog),
      'stroke-opacity': 0.3,
      rx: 2,
    });
  }
  const points = [course.spawn, ...course.steps['self-level'].map(criterionCentre).filter(Boolean)];
  add('path', {
    d: points.map((p, i) => `${i ? 'L' : 'M'} ${px(p.x)} ${pz(p.z)}`).join(' '),
    stroke: accent,
    'stroke-width': 2.5,
    fill: 'none',
    'stroke-dasharray': '5 4',
  });
  points.forEach((p, i) =>
    add('circle', {
      cx: px(p.x),
      cy: pz(p.z),
      r: i ? 3.5 : 5,
      fill: color(i ? palette.accent : palette.warm),
      stroke: color(palette.ground, 0.3),
      'stroke-width': 2,
    }),
  );
  return svg;
}

export function mountWorldApp({
  window: win = globalThis.window,
  document: doc = globalThis.document,
  rendererFactory = createFlightRenderer,
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
  let locale = 'en',
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
    playShell = null;
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
    actorEditor = null;
  let editorFields = '',
    courseScopeProject = null;
  const courseScopes = new Map();
  let renderer = null,
    flight = null,
    recorder = null,
    current = null,
    preview = false,
    checkpointRequest = null,
    checkpointSession = null,
    checkpointPreparation = null,
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
    response = { ...DEFAULT_RESPONSE },
    recovery = null,
    replayProof = null,
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
  const learningById = new Map(BEGINNER_LESSONS.map((lesson) => [lesson.id, lesson]));
  const learningEntries = new Map(BEGINNER_CATALOGUE.map((entry) => [entry.id, entry]));
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
    learningPreferences = null,
    learningResponse = null,
    lessonReturn = null,
    modePractice = false;
  const sectors = createSectorTracker();
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    /* Browser can deny local preference access. */
  }
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
    if (!saved['flight-source'] && win.matchMedia?.('(pointer: coarse)').matches)
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
    locale = $('world-language').value;
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
  const savePreferences = () => {
    try {
      storage?.setItem(
        'revealline.fpv.world-settings.v1',
        JSON.stringify(
          Object.fromEntries(
            preferenceIds.map((id) => [id, learningPreferences?.[id] ?? $(id).value]),
          ),
        ),
      );
    } catch (error) {
      reportError(error);
    }
  };
  const txt = (en, uk) => (locale === 'uk' ? uk : en);
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
    if (!entry) return null;
    entry = demonstrationEntry(entry);
    const cache = demonstrationCache.get(entry.course) ?? new Map(),
      cacheKey = `${entry.projectId ?? ''}:${entry.packIdentity}:${mode}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    if (!entry.legacy) {
      const sourceIdentity = dataIdentity(validateWorldCourse(entry.course));
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
              r.proof.format === 'FlightAttempt.v2' &&
              r.proof.model === WORLD_FLIGHT_MODEL &&
              r.proof.backend === WORLD_COLLISION_BACKEND &&
              r.proof.responseIdentity === responseIdentity(r.proof.response)
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
      // replayWorldFlight checks every v2 identity and final state before play.
      const match =
        ['FlightAttempt.v2', 'FlightAttempt.v3'].includes(proof?.format) &&
        proof.session === 'demonstration' &&
        proof.model === WORLD_FLIGHT_MODEL &&
        proof.backend === WORLD_COLLISION_BACKEND &&
        proof.responseIdentity === responseIdentity(proof.response) &&
        candidate.sourceIdentity === sourceIdentity
          ? proof
          : null;
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
    return startFlight(entry, { preview: true, replayProof: proof, demonstration: true });
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
    status(error.message ?? error);
    if ($('flight-dialog').open) $('flight-status').textContent = error.message ?? error;
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
      state: flight.snapshot(),
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
    if (playShell && surface !== 'missions')
      playShell.elements.content.home.append(lessonReturnButton);
    else $('school-lessons').before(lessonReturnButton);
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
  const audio = createWorldAudio({ window: win, storage });
  const presentation = mountSimPresentation({
    root: doc,
    window: win,
    enabled: audio.enabled(),
    audioHost: audio,
  });
  const appearanceSession = createSimAppearanceSession();
  let appearanceReady = false;
  const appearanceControls = mountSimAppearanceControls({
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
      if (!appearanceSession.select(appearance) || !current || replayProof || checkpointRequest)
        return;
      void startFlight(current, {
        preview,
        playlist: playingPlaylist,
        index: playlistIndex,
        preserveFocus: true,
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
      presentation.setVolume(levels.interface);
    },
  });
  const huntPresentationControls = mountSnakeHuntPresentationControls({
    document: doc,
    window: win,
    container: $('sim-flight-controls'),
    storage,
    locale: () => locale,
  });
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
    if (id === 'creator') ensureSpatialEditor();
  }
  function paintLanguage() {
    playShell?.setLocale(locale);
    shellModes.refresh?.();
    appearanceControls.refresh();
    doc.documentElement.lang = locale;
    for (const { node, key, fallback } of translatedNodes)
      node.textContent =
        key === 'keys'
          ? keyboardFlightHelp($('flight-keyboard-preset').value, locale, { combat: true })
          : ((locale === 'uk' ? COPY_UK[key] : COPY_EN[key]) ?? COPY_EN[key] ?? fallback);
    $('world-radio-title').textContent = txt('Radio setup', 'Налаштування пульта');
    immersive.refresh();
    updateSoundLabel();
    audioControls.refresh();
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
        course: editor,
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
    if (!spatialEditor || !editor) return;
    spatialEditor.setCourse(editor, editorMode());
    const profile = resolveSimThemeProfile(editor, appearanceControls.resolve().appearance);
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
        : null) ?? builtinWorldScene(editor);
    if (model) void spatialEditor.loadScene(model).catch(reportError);
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
  const input = createFlightInput({ window: win, document: doc, onPause: () => pauseFlight() });
  input.touchResponse($('flight-touch-response').value);
  input.keyboardPreset($('flight-keyboard-preset').value);
  const gamepad = createFlightGamepad({ window: win, document: doc });
  const flightMenuOpen = () => $('flight-dialog').dataset.flightMenuOpen === 'true';
  function setFlightMenu(open) {
    if (open && playShell) {
      pauseFlight();
      if (flight) updateHUD(flight.snapshot());
      playShell.openHome();
      return;
    }
    if (open) pauseFlight();
    $('flight-dialog').dataset.flightMenuOpen = String(open);
    if (!open) {
      $('flight-dialog').dataset.optionsOpen = 'false';
      $('flight-options').setAttribute('aria-expanded', 'false');
    }
    if (flight) updateHUD(flight.snapshot());
    (open ? $('world-flight-close-menu') : $('world-flight-resume')).focus({ preventScroll: true });
  }
  const gamepadHelp = () =>
    txt(
      'A / Cross: arm · Y / Triangle: reset · Menu / B: pause. Left stick: yaw and throttle adjustment; centre to hold throttle. Right stick / D-pad: tilt. LB/RB: yaw · LT/RT: less/more throttle · X/Square: fire. Steam Input: use a Gamepad layout.',
      'A / Cross: увімкнути · Y / Triangle: скинути · Menu / B: пауза. Лівий стік: поворот і зміна газу; центр утримує газ. Правий стік / D-pad: нахил. LB/RB: поворот · LT/RT: менше/більше газу · X/Square: вогонь. Steam Input: розкладка Gamepad.',
    );
  function gamepadScope() {
    if (
      !flight ||
      !$('flight-dialog').open ||
      replayProof ||
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
    if (flight.snapshot().status === 'active')
      return $('flight-source').value === 'controller' ? 'flight' : 'blocked';
    return ['paused', 'disarmed'].includes(flight.snapshot().status) &&
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
      } else if (action === 'pause' || action === 'back') setFlightMenu(true);
    }
  }
  input.bindStick($('world-left-stick'), 'left');
  input.bindStick($('world-right-stick'), 'right');
  const radio = createRadioRuntime({
    getGamepads: () => win.navigator.getGamepads?.() ?? [],
    onFreeze: () => {
      if (!replayProof && $('flight-source').value === 'radio') pauseFlight(false);
    },
    onReset: () => {
      if (current)
        void startFlight(current, {
          preview,
          playlist: playingPlaylist,
          index: playlistIndex,
          replayProof,
          checkpoint: checkpointRequest,
          demonstration: replayKind === 'demonstration',
        }).catch(reportError);
    },
  });
  let practiceOwnsFullscreen = false;
  const beginnerCoach = mountBeginnerCoach({
    root: $('beginner-coach'),
    window: win,
    locale: () => locale,
    onStart: () => {
      if (flight) updateHUD(flight.snapshot());
      $('world-arm').click();
    },
    onPause: () => pauseFlight(),
    onRetry: () => $('world-retry').click(),
    onNext: () => nextLearningFlight(),
    onExit: () => closeFlight(),
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
      replayProof ||
      $('world-radio-dialog').open ||
      ($('flight-source').value !== 'radio' &&
        !beginnerCoach.wantsRadioPreview?.() &&
        flight?.snapshot().status === 'active')
    )
      return;
    // Read the current saved profile: Setup and another simulator page may have
    // saved it through their own store instance since this page was mounted.
    restoreVerifiedRadio(radio, createFlightProfileStore({ storage }));
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
  const stickTraces = ['left', 'right'].map((side) =>
    mountStickTrace($(`world-${side}-stick`), { travel: 180 * 0.34 }),
  );
  let stickTraceLayout = '';
  const paintText = (id, text) => {
    const node = $(id);
    if (node.textContent !== text) node.textContent = text;
  };
  function paintInput(state) {
    const source = replayProof ? 'recording' : $('flight-source').value,
      touchActive = source === 'touch',
      display = $('flight-stick-display').value,
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
        $('sim-motion').value === 'reduced' ||
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
    // Read both current padding-box sizes before either stick writes its labels.
    const radii = ['left', 'right'].map((side) => $(`world-${side}-stick`).clientWidth * 0.34);
    for (const [index, side] of ['left', 'right'].entries()) {
      const node = $(`world-${side}-stick`),
        horizontal = layout[index * 2],
        vertical = layout[index * 2 + 1],
        x = controls[horizontal],
        y = vertical === 'throttle' ? controls[vertical] * 2 - 1 : controls[vertical],
        radius = radii[index];
      paintStickDirections(node, { horizontal, vertical, locale });
      node.querySelector('i').style.transform = `translate(${x * radius}px, ${-y * radius}px)`;
      stickTraces[index].update({
        x,
        y,
        now: traceTime,
        source,
        reducedMotion,
        available: !unavailable && !monitor.hidden && state?.status === 'active',
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
    const status = $('world-input-status');
    const text =
      source === 'radio'
        ? `${txt('USB radio', 'USB-пульт')} · ${radioHelp(radio.status().reason)}`
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
    const source = replayProof ? 'recording' : $('flight-source').value;
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
    if (current?.beginner && !checkpointSession)
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
          $('sim-motion').value === 'reduced' ||
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
      display: $('flight-drone-guide').value,
      scale: $('flight-guide-scale').value,
      mode: $('flight-mode').value,
      guideOpen: beginnerCoach.blocksArm(),
      reducedMotion:
        $('sim-motion').value === 'reduced' ||
        Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
    });
  }
  const droneResponse = mountDroneResponse({
    root: $('flight-drone-response'),
    window: win,
    onHide: () => {
      $('flight-drone-guide').value = 'off';
      savePreferences();
      paintInput(flight?.snapshot());
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
  function completedLearningModes(entry) {
    const modes = new Set(sessionLearningComplete.get(keyOf(entry)) ?? []);
    for (const record of records)
      if (
        record.packIdentity === entry.packIdentity &&
        record.course.id === entry.id &&
        record.status === 'verified' &&
        record.diagnostic === 'complete' &&
        record.proof.session === 'practice'
      )
        modes.add(record.proof.mode);
    return ['self-level', 'acro']
      .filter((mode) => modes.has(mode))
      .map((mode) => (mode === 'acro' ? 'Acro' : txt('Self-level', 'Самовирівнювання')))
      .join(' · ');
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
    const tierNames = {
      all: txt('All lessons', 'Усі уроки'),
      beginner: txt('Beginner', 'Початковий'),
      experienced: txt('Experienced', 'Для досвідчених'),
      advanced: txt('Advanced', 'Поглиблений'),
      pro: txt('Pro', 'Pro · Профі'),
      master: txt('Master', 'Master · Майстерність'),
      'self-level': txt('Optional self-level', 'Додаткове самовирівнювання'),
    };
    const tierCounts = {
      all: BEGINNER_LESSONS.length,
      beginner: ACRO_LESSON_ORDER.length,
      experienced: EXPERIENCED_LESSON_ORDER.length,
      advanced: ADVANCED_LESSON_ORDER.length,
      pro: PRO_LESSON_ORDER.length,
      master: MASTER_LESSON_ORDER.length,
      'self-level': SELF_LEVEL_LESSON_ORDER.length,
    };
    const selectedTier = $('school-tier').value;
    const optionalExpanded =
      $('school-lessons').querySelector('details[data-learning-tier="self-level"]')?.open ?? false;
    for (const option of $('school-tier').options)
      option.textContent = `${tierNames[option.value]} · ${tierCounts[option.value]}`;
    $('school-lessons').replaceChildren();
    const groups = [
      [
        ACRO_LESSON_ORDER.slice(0, 4),
        'Lift, understand tilt, find your hover.',
        'Зліт, розуміння нахилу, зависання.',
        'beginner',
      ],
      [
        ACRO_LESSON_ORDER.slice(4, 8),
        'Direct the drift. Control your height.',
        'Керуйте дрейфом і висотою.',
        'beginner',
      ],
      [
        ACRO_LESSON_ORDER.slice(8, 11),
        'Join the turns. Read the FPV view.',
        'Поєднуйте повороти. Читайте вигляд FPV.',
        'beginner',
      ],
      [
        ACRO_LESSON_ORDER.slice(11),
        'Gates, recovery and your solo route.',
        'Ворота, відновлення та самостійний маршрут.',
        'beginner',
      ],
      [
        EXPERIENCED_LESSON_ORDER,
        'Experienced · Make every movement deliberate.',
        'Для досвідчених · Кожен рух має мету.',
        'experienced',
      ],
      [
        ADVANCED_LESSON_ORDER,
        'Advanced · Find the line through complex spaces.',
        'Поглиблений · Знайдіть маршрут у складному просторі.',
        'advanced',
      ],
      [
        PRO_LESSON_ORDER,
        'Pro · Refine demanding flight techniques.',
        'Pro · Удосконалюйте складні прийоми пілотування.',
        'pro',
      ],
      [
        MASTER_LESSON_ORDER,
        'Master · Bring your skills together.',
        'Master · Поєднуйте всі свої навички.',
        'master',
      ],
      [
        SELF_LEVEL_LESSON_ORDER,
        'Optional: practise with self-level assistance',
        'Додатково: практика із самовирівнюванням',
        'self-level',
      ],
    ];
    for (const [ids, en, uk, tier] of groups) {
      if (selectedTier !== 'all' && selectedTier !== tier) continue;
      const optional = tier === 'self-level';
      const group = el(optional ? 'details' : 'section', undefined, 'school-chapter');
      group.dataset.learningTrack = optional ? 'self-level' : 'acro';
      group.dataset.learningTier = tier;
      if (optional) group.open = selectedTier === 'self-level' || optionalExpanded;
      const title = el(optional ? 'summary' : 'div', undefined, 'school-chapter-heading');
      title.append(
        el(
          'span',
          optional
            ? String(SELF_LEVEL_LESSON_ORDER.length)
            : `${String(PRIMARY_LESSON_ORDER.indexOf(ids[0]) + 1).padStart(2, '0')}—${String(PRIMARY_LESSON_ORDER.indexOf(ids.at(-1)) + 1).padStart(2, '0')}`,
        ),
        el('h2', txt(en, uk)),
      );
      if (optional)
        title.append(
          el(
            'small',
            txt(
              `${optionalDone}/${SELF_LEVEL_LESSON_ORDER.length} complete · open lessons`,
              `${optionalDone}/${SELF_LEVEL_LESSON_ORDER.length} виконано · відкрити уроки`,
            ),
          ),
        );
      group.append(title);
      const grid = el('div', undefined, 'school-lesson-grid');
      for (const id of ids) {
        const entry = learningEntries.get(id);
        const lesson = learningById.get(entry.id),
          index = learningSequence(entry).indexOf(entry.id);
        const card = el('article', undefined, 'school-lesson-card');
        card.dataset.lesson = entry.id;
        card.dataset.learningTier = tier;
        card.classList.toggle('is-complete', complete.has(keyOf(entry)));
        const head = el('div', undefined, 'school-card-head');
        head.append(
          el('span', String(index + 1).padStart(2, '0'), 'school-lesson-number'),
          el(
            'span',
            complete.has(keyOf(entry))
              ? `${txt('✓ Completed', '✓ Виконано')} · ${completedLearningModes(entry)}`
              : lesson.mode === 'acro'
                ? `ACRO · ${tierNames[tier]}`
                : txt('SELF-LEVEL', 'САМОВИРІВНЮВАННЯ'),
            'school-lesson-status',
          ),
        );
        card.append(head, el('h3', localized(lesson.title)), el('p', localized(lesson.summary)));
        const meta = el(
          'small',
          txt(
            `${lesson.steps.length} guided steps · about ${lesson.duration} min`,
            `${lesson.steps.length} кроків із підказками · близько ${lesson.duration} хв`,
          ),
        );
        const start = button(
          complete.has(keyOf(entry))
            ? txt('Fly it again', 'Повторити урок')
            : txt('Start lesson', 'Почати урок'),
          () => startFlight(entry),
          entry.id === next.id ? 'primary' : '',
        );
        start.dataset.simIcon = 'play';
        start.setAttribute('aria-label', `${start.textContent}: ${localized(lesson.title)}`);
        card.append(meta, start);
        if (demonstrationFor(entry, $('flight-mode').value)) {
          const watch = button(
            `${txt('Watch demonstration', 'Переглянути демонстрацію')} · ${$('flight-mode').selectedOptions[0].textContent}`,
            () => watchDemonstration(entry),
          );
          watch.dataset.simIcon = 'replay';
          watch.setAttribute('aria-label', `${watch.textContent}: ${localized(lesson.title)}`);
          card.append(watch);
        }
        grid.append(card);
      }
      group.append(grid);
      $('school-lessons').append(group);
    }
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
  function renderCatalogue() {
    renderSchool();
    const complete = completedKeys(),
      search = $('search').value.trim().toLocaleLowerCase(),
      activity = $('activity-filter').value,
      difficulty = $('difficulty-filter').value,
      progress = $('completion-filter').value;
    const filtered = catalogue.filter(
      (e) =>
        !e.archived &&
        (theme === 'all' || e.theme === theme) &&
        (activity === 'all' || e.activity === activity) &&
        (difficulty === 'all' || e.difficulty === difficulty) &&
        (progress === 'all' || complete.has(keyOf(e)) === (progress === 'complete')) &&
        `${label(e)} ${localized(FLIGHT_WORLDS.find((w) => w.id === e.world)?.title)} ${e.course.environment}`
          .toLocaleLowerCase()
          .includes(search),
    );
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
      group.forEach((entry, i) => {
        const row = el('div', undefined, 'challenge-row'),
          info = el('div', undefined, 'challenge-info');
        info.append(
          el('strong', `${complete.has(keyOf(entry)) ? '✓ ' : ''}${label(entry)}`),
          el(
            'small',
            `${localized(ACTIVITY_NAMES[entry.activity])} · ${COPY_UK[entry.difficulty] && locale === 'uk' ? COPY_UK[entry.difficulty] : entry.difficulty} · ${entry.duration ?? 3} ${txt('min', 'хв')}`,
          ),
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
          const course = clone(group[0].course);
          course.format = 'FlightCourse.v2';
          delete course.pursuit;
          course.id = unique('freeflight');
          course.world ??= {
            id: group[0].world,
            theme: group[0].theme,
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
              ...group[0],
              id: course.id,
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
    presentation.refresh();
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
  });
  function applyEdit(change, { nativePursuitAdmission = false } = {}) {
    if (!editor)
      throw new Error(txt('Create a challenge copy first.', 'Спочатку створіть копію завдання.'));
    const before = editorSnapshot(),
      next = clone(editor),
      bindings = clone(before.bindings);
    let valid;
    try {
      change(next, bindings);
      valid = validateWorldCourse(next);
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
    const c = clone(entry.course);
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
      activity: 'exploration',
      difficulty: 'intermediate',
      duration: 4,
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
  const worldLibrary = mountWorldLibrary({
    el,
    txt,
    parent: $('installed-packs'),
    begin: () => worldStore.generation(),
    install: (bytes, row, options) =>
      installExactPack(bytes, `fpv-pack:${row.sha256}`, { ...options, row }),
  });
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
      for (const b of dialog.querySelectorAll('button')) b.disabled = value;
      cancel.disabled = committing;
      confirm.disabled = value || !reviewed;
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
        button(txt('Edit', 'Редагувати'), async () => {
          const full = await worldStore.get(record.id);
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
    const pack = await preparePack(editingProject, { assets: projectAssets });
    await installPack(pack, {
      store: worldStore,
      expectedGeneration: projectGeneration ?? (await worldStore.generation()),
    });
    projectGeneration = await worldStore.generation();
    await refreshStorage();
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
    if (request !== importRequest) return;
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
    if (
      !recordStore ||
      preview ||
      !flight ||
      current?.legacy ||
      !recorder ||
      !recorder.ticks() ||
      terminal(flight.snapshot())
    )
      return;
    const saved = {
      course: current.course,
      proof: recorder.export(),
      packIdentity: current.packIdentity,
      preview,
      sectorReferenceId,
      ghostEnabled,
      ...(current.legacy ? { presentation: appearanceSession.current() } : {}),
    };
    await recordStore.saveSession(saved);
    recovery = saved;
  }
  function pauseFlight(freezeRadio = true) {
    if (pausing) return;
    pauseRevision++;
    pausing = true;
    gamepad.reset();
    stickTraces.forEach((trace) => trace.reset());
    beginnerCoach.pausePreview?.();
    if (fire) fireReleaseRequired = true;
    fire = false;
    huntReactions.suspend();
    audio.pause();
    presentation.resume();
    input.enable(false);
    input.clear();
    if (freezeRadio) radio.freeze('paused');
    if (flight) flight.pause();
    lastTime = null;
    lastExecutionTime = win.performance?.now?.() ?? null;
    accumulator = 0;
    pausing = false;
    if (current) {
      $('flight-status').textContent = txt(
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
      ended = shown && flight && flight.snapshot().ticks >= sectorReference.ticks;
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
    $('sector-panel').hidden = Boolean(checkpointSession) || modePractice;
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
          Object.entries(identity).every(([key, value]) => record.proof[key] === value) &&
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
  function updateHUD(state) {
    // Section/unfinished recordings may stop in a paused simulation state.
    // Their playback result must not offer an impossible Continue action.
    const playbackEnded = Boolean(replayProof && finished);
    $('flight-dialog').dataset.flightState = state.status;
    paintText('world-flight-identity', $('flight-title').textContent);
    playShell?.update({
      phase:
        terminal(state) || playbackEnded
          ? 'results'
          : state.status === 'active'
            ? 'playing'
            : state.status,
      missionName: $('flight-title').textContent,
      summary: $('flight-menu-brief').textContent,
      canResume: !playbackEnded && ['paused', 'disarmed'].includes(state.status),
      muted: !audio.enabled(),
    });
    updateSectorHUD();
    updateGhostHUD();
    const target = current.course.steps[$('flight-mode').value][state.step];
    paintText(
      'flight-instruments',
      `${(state.position.y / 1000).toFixed(1)} m · ${(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) / 1000) | 0} m/s · ${((state.ticks - (checkpointSession?.startTick ?? 0)) / 50).toFixed(1)} s${state.health !== undefined ? ` · ♥ ${state.health}` : ''}`,
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
    paintText('flight-objective', objective);
    $('world-arm').disabled =
      !sceneReady ||
      Boolean(ghostLookup) ||
      beginnerCoach.blocksArm() ||
      terminal(state) ||
      (Boolean(replayProof) && finished);
    paintText(
      'world-arm',
      replayProof
        ? txt('Resume playback', 'Продовжити перегляд')
        : txt('Arm / resume', 'Увімкнути / продовжити'),
    );
    paintText(
      'world-retry',
      replayProof ? txt('Restart playback', 'Переглянути спочатку') : txt('Retry', 'Ще раз'),
    );
    $('world-watch-demo').hidden =
      Boolean(replayProof) ||
      Boolean(checkpointSession) ||
      !demonstrationFor(current, $('flight-mode').value);
    $('export-flight').disabled = Boolean(checkpointSession) || modePractice;
    $('world-fire').hidden =
      Boolean(replayProof) ||
      current.legacy ||
      !current.course.actors.some(
        (a) => a.type !== 'hazard' && (a.role ?? 'hostile') === 'hostile',
      );
    $('world-flight-resume').disabled = $('world-arm').disabled;
    paintText('world-flight-resume', $('world-arm').textContent);
    $('world-flight-fire').hidden = $('world-fire').hidden || $('flight-source').value !== 'touch';
    $('world-next').disabled =
      Boolean(checkpointSession) ||
      modePractice ||
      !playingPlaylist ||
      playlistIndex + 1 >= playingPlaylist.entries.length;
  }
  async function finishFlight(token) {
    if (finished || token !== flightToken) return;
    if (replayProof) {
      finishPlayback();
      return;
    }
    finished = true;
    input.enable(false);
    fire = false;
    radio.freeze('finished');
    if (modePractice && !checkpointSession) {
      $('result-panel').hidden = false;
      $('result-panel').replaceChildren(
        el('h2', txt('Practice ended', 'Тренування завершено')),
        el('p', modePracticeNotice()),
        el(
          'p',
          txt(
            'No completion record, medal or recording was saved.',
            'Запис виконання, медаль і запис польоту не збережено.',
          ),
        ),
        button(txt('Practise again', 'Тренуватися ще раз'), () => startFlight(current), 'primary'),
        button(txt('Back to lobby', 'До меню'), () => closeFlight()),
      );
      $('flight-status').textContent = modePracticeNotice();
      return;
    }
    if (checkpointSession) {
      const state = flight.snapshot(),
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
      state = flight.snapshot(),
      isPreview = preview,
      completedReference = sectorReference,
      completedPlaylist = playingPlaylist,
      completedPlaylistIndex = playlistIndex,
      resultSummary = evaluateWorldResult(current.course, proof, state, {
        sectors: sectors.snapshot(),
      });
    $('result-panel').hidden = false;
    $('result-panel').replaceChildren(
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
      $('result-panel').replaceChildren(
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
      if (!entry.beginner)
        $('result-panel').append(
          el(
            'p',
            `${resultSummary.medal ? `${txt('Medal', 'Медаль')}: ${resultSummary.medal} · ` : ''}${txt('Score', 'Бали')}: ${resultSummary.score}${resultSummary.accuracy === null ? '' : ` · ${Math.round(resultSummary.accuracy * 100)}%`}`,
          ),
        );
      if (resultSummary.sectors.length)
        $('result-panel').append(splitSummary(resultSummary.sectors, completedReference));
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
        $('result-panel').append(suggestion);
      }
      if (!entry.legacy)
        $('result-panel').append(
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
      presentation.resume();
      $('result-panel').append(
        button(txt('Watch verified flight', 'Переглянути перевірений політ'), () =>
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
      button(
        txt('Fly this challenge', 'Виконати це завдання'),
        () => startFlight(current),
        'primary',
      ),
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
  function drawFlight(state) {
    return renderer?.draw?.(state, {
      cameraMode: $('flight-camera').value,
      cameraFov: Number($('world-fov').value),
      cameraTilt: Number($('world-tilt').value),
    });
  }
  function frame(now) {
    if (disposed) return;
    raf = win.requestAnimationFrame(frame);
    try {
      advanceFrame(now);
    } catch (error) {
      pauseFlight();
      reportError(error);
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
      pauseFlight();
      return;
    }
    pollGamepad(executedAt);
    pollMenu(executedAt);
    if (!flight || !$('flight-dialog').open) return;
    if (
      !replayProof &&
      ($('flight-source').value === 'radio' || beginnerCoach.wantsRadioPreview?.()) &&
      !radio.status().verified &&
      now - lastRadioDiscovery > 1000
    ) {
      lastRadioDiscovery = now;
      restoreRadio();
    }
    const elapsed = lastTime === null ? 0 : now - lastTime;
    lastTime = now;
    if (elapsed > 250) {
      pauseFlight();
      return;
    }
    // Observe a deliberate radio OFF→ON edge while paused as well as flying.
    // freeze() requires seeing OFF again after blur/setup; a held ON switch
    // therefore cannot resume a flight simply because the tab regained focus.
    if (
      sceneReady &&
      !ghostLookup &&
      !replayProof &&
      $('flight-source').value === 'radio' &&
      ['paused', 'disarmed'].includes(flight.snapshot().status) &&
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
        appearanceSession.arm(flight.snapshot().status);
        fire = false;
        accumulator = 0;
        $('flight-status').textContent = txt('Flight active.', 'Політ триває.');
      }
    }
    if (flight.snapshot().status === 'active') {
      audio.update(flight.snapshot(), { active: !replayProof });
      accumulator += elapsed * (replayProof ? replayRate : 1);
      while (accumulator >= 20 && flight.snapshot().status === 'active') {
        accumulator -= 20;
        let controls =
          !replayProof && $('flight-source').value === 'radio'
            ? radio.poll()
            : !replayProof && $('flight-source').value === 'controller'
              ? gamepad.sample(0.02)
              : input.sample(0.02);
        if (replayProof) {
          if (replayKind === 'section' && flight.snapshot().ticks >= checkpointSession.endTick) {
            pauseFlight(false);
            finishPlayback();
            break;
          }
          const row = replayProof.frames[flight.snapshot().ticks];
          if (!row) {
            pauseFlight(false);
            finishPlayback();
            break;
          }
          controls = Object.fromEntries(
            ['roll', 'pitch', 'yaw', 'throttle'].map((k, i) => [k, row[i] / 1000]),
          );
        }
        if (!replayProof && $('flight-source').value === 'radio' && !radio.status().active) {
          pauseFlight(false);
          break;
        }
        const before = flight.snapshot().ticks;
        flight.step(
          current.legacy
            ? controls
            : {
                ...controls,
                actions: replayProof
                  ? replayProof.frames[before][4]
                  : fire || ($('flight-source').value === 'controller' && gamepad.preview().fire)
                    ? 1
                    : 0,
              },
        );
        if (flight.snapshot().ticks > before) {
          renderer?.observePresentation?.(flight.snapshot());
          audio.update(flight.snapshot(), {
            active: !replayProof && flight.snapshot().status === 'active',
          });
          if (!replayProof && !current.legacy) huntReactions.consume(flight.snapshot());
          if (recorder) {
            if (current.legacy) recorder.record(controls);
            else recorder.record();
            sectors.consume(flight.snapshot());
          }
          if (flight.snapshot().ticks % 250 === 0) void saveRecovery().catch(reportError);
        }
        if (
          replayKind === 'section' &&
          replayProof &&
          flight.snapshot().ticks >= checkpointSession.endTick
        ) {
          finishPlayback();
          break;
        }
      }
    }
    const state = flight.snapshot();
    if (beginnerCoach.blocksArm() && state.status !== 'active') {
      // The opaque guide owns the screen. Keep controller/lifecycle sampling
      // current without rendering a covered WebGL scene and hidden flight HUD.
      paintCoach(state);
      return;
    }
    if (state.status === 'active') presentation.pause();
    audio.update(state, { active: !replayProof && state.status === 'active' });
    // Do not submit an intermediate scene while its assets or shaders are preparing.
    if (sceneReady) drawFlight(state);
    const aim = renderer?.aimScreen?.();
    if (aim) {
      $('aim-reticle').style.left = `${aim.x * 100}%`;
      $('aim-reticle').style.top = `${aim.y * 100}%`;
      $('aim-reticle').hidden = !aim.visible;
    }
    updateHUD(state);
    paintInput(state);
    if (terminal(state)) void finishFlight(flightToken).catch(reportError);
  }
  const modePracticeNotice = () =>
    txt(
      'Self-level practice · no score. Acro is needed for these manoeuvres.',
      'Практика із самовирівнюванням · без заліку. Для цих маневрів потрібен Acro.',
    );
  async function startFlight(entry, options = {}) {
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
    if (!options.preserveFocus) playShell?.enterPlay();
    if (playShell) $('flight-dialog').prepend(playShell.elements.header);
    const requestedMode =
      options.mode ??
      options.replayProof?.mode ??
      options.recover?.mode ??
      options.checkpoint?.mode ??
      $('flight-mode').value;
    const token = ++flightToken;
    checkpointPreparation?.abort();
    checkpointPreparation = null;
    if (!options.preserveFocus) $('flight-dialog').dataset.flightMenuOpen = 'false';
    qualityPreparing = false;
    scenePreparationGeneration++;
    abortSectorLookup();
    sceneReady = false;
    pauseFlight();
    radio.reset({ notify: false });
    const playbackPauseRevision = pauseRevision;
    await saveRecovery();
    await ready;
    if (disposed || token !== flightToken) return;
    const retained = Boolean(options.recover || options.replayProof || options.checkpoint?.proof);
    const sourceCourse = retained
      ? entry.course
      : entry.appearanceCourse === entry.course
        ? entry.sourceCourse
        : entry.course;
    const selectedAppearance = retained
      ? (options.presentation ?? entry.presentation ?? recordedSimAppearance(sourceCourse))
      : appearanceControls.resolve().appearance;
    const acceptedAppearance = appearanceSession.begin(selectedAppearance, { retained });
    const playableAppearance = playableSimAppearance(acceptedAppearance);
    if (!entry.legacy && !retained) {
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
    if (entry.legacy) entry.presentation = acceptedAppearance;
    // The guide creates its isolated lesson simulation before the flight view.
    if (!entry.legacy) await initWorldRuntime();
    if (disposed || token !== flightToken) return;
    flight?.dispose?.();
    flight = null;
    current = entry;
    recorder = null;
    checkpointRequest = options.checkpoint ?? null;
    checkpointSession = null;
    $('flight-mode').value = requestedMode;
    refreshEnemyGuide();
    const needsAcro = !entry.legacy && worldCourseRequiresAcro(entry.course);
    modePractice = needsAcro && requestedMode === 'self-level';
    const learning = !checkpointRequest && learningById.get(entry.beginner);
    if (learning) {
      learningPreferences ??= {
        'flight-camera': $('flight-camera').value,
      };
      learningResponse ??= { ...response };
      response = { ...DEFAULT_RESPONSE };
      $('flight-camera').value = requestedMode === 'acro' ? 'fpv' : learning.camera;
      beginnerCoach.open(learning, {
        mode: requestedMode,
        keyboardPreset: $('flight-keyboard-preset').value,
        modePractice,
        demonstration: demonstrationFor({ ...entry, course: learning.course }, requestedMode),
        practice: Boolean(options.recover),
        replay: Boolean(options.replayProof),
      });
    } else {
      beginnerCoach.close();
      restoreLearningPreferences();
    }
    $('flight-dialog').classList.toggle('learning-flight', Boolean(learning));
    preview =
      modePractice ||
      Boolean(checkpointRequest) ||
      Boolean(options.replayProof) ||
      (options.preview ?? false);
    playingPlaylist = checkpointRequest || modePractice ? null : (options.playlist ?? null);
    playlistIndex = options.index ?? 0;
    finished = false;
    sceneReady = false;
    $('world-arm').disabled = true;
    // Section preparation owns its bounded, verified proof. Do not separately
    // clone or replay the untrusted caller's frames before that preparation.
    replayProof = !checkpointRequest && options.replayProof ? clone(options.replayProof) : null;
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
        : modePractice
          ? txt('SELF-LEVEL PRACTICE · UNSCORED', 'ПРАКТИКА ІЗ САМОВИРІВНЮВАННЯМ · БЕЗ ЗАЛІКУ')
          : preview
            ? txt('AUTHORING PREVIEW', 'АВТОРСЬКИЙ ПЕРЕГЛЯД')
            : learning
              ? txt('FLIGHT SCHOOL', 'ЛЬОТНА ШКОЛА')
              : localized(WORLD_THEMES.find((t) => t.id === entry.theme)?.title) || entry.world;
    $('flight-brief').textContent = $('flight-menu-brief').textContent =
      `${modePractice ? `${modePracticeNotice()} ` : ''}${entry.course.locales[locale].brief}`;
    $('flight-status').textContent = txt('Preparing scene…', 'Підготовка сцени…');
    paintLoadout();
    if (!$('flight-dialog').open) $('flight-dialog').showModal();
    paintLessonReturn();
    if (!renderer)
      renderer = rendererFactory({
        canvas: $('world-canvas'),
        window: win,
        onContextLost: () => {
          sceneReady = false;
          qualityPreparing = false;
          pauseFlight();
          $('flight-status').textContent = txt(
            'Graphics context lost. Retry after graphics recover.',
            'Графічний контекст втрачено. Спробуйте знову після відновлення графіки.',
          );
        },
        reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
        createHuntPresentation: (options) =>
          createSnakeHuntPresentation({
            ...options,
            preferences: () => huntPresentationControls.preferences.snapshot(),
          }),
      });
    if (!renderer.available)
      throw new Error(
        txt('WebGL is unavailable in this browser.', 'WebGL недоступний у цьому браузері.'),
      );
    if (token !== flightToken) return;
    if (replayProof) {
      const proof = replayProof;
      $('flight-status').textContent = txt('Verifying recording…', 'Перевірка запису…');
      const checked = entry.legacy
        ? await replayFlightCooperatively(entry.course, proof)
        : await replayWorldFlight(entry.course, proof);
      if (token !== flightToken) return;
      if (
        replayKind === 'demonstration' &&
        (!demonstrationFor(entry, proof.mode) || checked.state.status !== 'complete')
      )
        throw new Error(
          txt(
            'The demonstration did not reproduce a completed challenge.',
            'Демонстрація не відтворила виконане завдання.',
          ),
        );
      $('flight-mode').value = proof.mode;
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
    } else if (options.recover) {
      const recovered = await recoverWorldFlight(entry.course, options.recover, {
        includeSectors: true,
      });
      if (token !== flightToken) {
        recovered.flight.dispose();
        return;
      }
      flight = recovered.flight;
      recorder = recovered.recorder;
      sectors.reset(recovered.sectors);
      radio.reset({
        notify: false,
        pickup: Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle'].map((k) => [
            k,
            (flight.snapshot().lastInput[k] ?? 0) / 1000,
          ]),
        ),
      });
      $('flight-mode').value = options.recover.mode;
    } else {
      flight = (entry.legacy ? createFlight : createWorldFlight)({
        course: entry.course,
        mode: $('flight-mode').value,
        response: replayProof?.response ?? response,
        unscoredPractice: modePractice,
      });
      recorder = modePractice
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
    renderer.setPresentation?.(playableAppearance.appearance);
    renderer.setCourse(entry.course, $('flight-mode').value);
    paintLoadout();
    audio.setCourse(entry.course);
    huntReactions.reset(entry.course, flight.snapshot(), {
      mode: $('flight-mode').value,
      attemptId: `fpv-world-${token}`,
      replay: Boolean(replayProof || entry.legacy),
    });
    renderer.setQuality($('flight-quality').value);
    renderer.setDrone(
      playableAppearance.fallbackReason && !entry.legacy
        ? resolveSimThemeProfile(entry.course, playableAppearance.appearance).drone
        : (acceptedAppearance.drone ??
            entry.course.world?.themeProfile?.drone ??
            $('drone-look').value),
    );
    let model = null;
    if (entry.projectId) {
      const pack =
        preview && entry.packIdentity === 'authoring' && editingProject?.id === entry.projectId
          ? { project: editingProject, assets: projectAssets }
          : await worldStore?.get(entry.projectId, {
              sha256: entry.packIdentity.replace('fpv-pack:', ''),
            });
      if (token !== flightToken) return;
      if (!pack) throw new Error(txt('The world pack is missing.', 'Пакунок світу відсутній.'));
      model = pack.project.world.modelAsset ? pack.assets.get(pack.project.world.modelAsset) : null;
      if (pack.project.world.modelAsset && !model)
        throw new Error(
          txt(
            'The installed model is missing. Reinstall its world pack.',
            'Модель відсутня. Перевстановіть пакунок світу.',
          ),
        );
    }
    model ??= builtinWorldScene(entry.course);
    if (model) await renderer.loadScene(model);
    if (token !== flightToken) return;
    if (sectorReferenceStatus === 'checking') {
      $('flight-status').textContent = txt('Checking saved best…', 'Перевірка найкращого запису…');
      await resolveSectorReference(
        entry,
        flight.identity,
        token,
        options.recover ? options.sectorReferenceId : undefined,
      );
    }
    if (disposed || token !== flightToken) return;
    // A preset can change while assets or shaders are loading. Prepare the latest
    // scene again when that renderer revision supersedes the pending compilation.
    for (let attempt = 0; attempt < 3; attempt++) {
      const prepared = await renderer.prepare?.();
      if (disposed || token !== flightToken || !renderer.available) return;
      if (prepared !== false) break;
      if (attempt === 2)
        throw new Error(
          txt(
            'Graphics changed during preparation. Retry the flight.',
            'Графіка змінилася під час підготовки. Повторіть політ.',
          ),
        );
    }
    if (disposed || token !== flightToken) return;
    if (ghostEnabled) await loadGhost();
    if (token !== flightToken || disposed) return;
    // Submit shadow programs and visible uploads before exposing readiness.
    if (drawFlight(flight.snapshot()) === false || disposed || token !== flightToken) return;
    sceneReady = true;
    if (options.returning === lessonReturn) {
      lessonReturn = null;
      paintLessonReturn();
    }
    $('flight-status').textContent = replayProof
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
    appearanceControls.refresh();
    input.select($('flight-source').value);
    restoreRadio();
    paintInput(flight.snapshot());
    updateHUD(flight.snapshot());
    if (!options.preserveFocus) {
      if (beginnerCoach.blocksArm()) beginnerCoach.focusPreview();
      else $('world-viewport').focus();
    }
    if (replayProof && !options.paused && pauseRevision === playbackPauseRevision) {
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
    enemyGuide.close();
    const token = ++flightToken;
    checkpointPreparation?.abort();
    checkpointPreparation = null;
    qualityPreparing = false;
    scenePreparationGeneration++;
    abortSectorLookup();
    sceneReady = false;
    pauseFlight();
    await saveRecovery();
    if (token !== flightToken || disposed) return;
    flight?.dispose?.();
    flight = null;
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
          example = saved.proof.session === 'demonstration';
        let verification = 'missing-dependency',
          diagnostic = txt('Exact world pack is missing.', 'Точний пакунок світу відсутній.');
        if (entry) {
          try {
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
              : await replayWorldFlight(entry.course, saved.proof, { signal: controller.signal });
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
  const applyAppearance = () => {
    doc.body.dataset.textFace = $('sim-text-face').value;
    doc.body.dataset.effects = $('sim-motion').value === 'reduced' ? 'reduced' : 'full';
  };
  applyAppearance();
  on($('sim-text-face'), 'change', applyAppearance);
  on($('sim-motion'), 'change', applyAppearance);
  on($('lobby-sound'), 'click', () => soundButton.click());
  on($('lobby-radio'), 'click', () => $('radio-setup-button').click());
  on($('begin-learning'), 'click', () => showTab('learn'));
  on($('school-tier'), 'change', renderSchool);
  on($('school-recover'), 'click', resumeInterruptedFlight);
  on($('school-radio'), 'click', () => $('radio-setup-button').click());
  on($('school-worlds'), 'click', () => {
    showTab('explore');
    $('world-picker-title').scrollIntoView({ block: 'start' });
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
  on($('hero-browse'), 'click', () => {
    $('world-picker-title').focus({ preventScroll: true });
    $('world-picker-title').scrollIntoView({ block: 'start' });
  });
  on(doc.querySelector('.wordmark'), 'click', (e) => {
    e.preventDefault();
    showTab('explore');
  });
  on(win, 'hashchange', () => showTab(win.location.hash.slice(1), false));
  on($('flight-options'), 'click', () => {
    pauseFlight();
    const open = $('flight-dialog').dataset.optionsOpen !== 'true';
    $('flight-dialog').dataset.optionsOpen = String(open);
    $('flight-options').setAttribute('aria-expanded', String(open));
  });
  function openSettings() {
    pauseFlight();
    $('sim-settings-controls').append(flightControls);
    if (!$('sim-settings').open) $('sim-settings').showModal();
  }
  on($('lobby-settings'), 'click', openSettings);
  function closeSettings() {
    $('world-replay-controls').before(flightControls);
    $('sim-settings').close();
    pauseFlight();
    (playShell?.topDialog()?.querySelector('h1') ?? $('lobby-settings')).focus();
  }
  on($('close-sim-settings'), 'click', closeSettings);
  on($('sim-settings'), 'cancel', (e) => {
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
    $('search').placeholder = txt('Find a world or challenge…', 'Знайти світ або завдання…');
    renderFilters();
    renderCatalogue();
    renderPlaylist();
    refreshEditor();
    renderPacks();
    paintLessonReturn();
    worldLibrary.refresh();
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
    applyEdit((c) => {
      const world = { ...c.world, theme: $('creator-theme').value };
      delete world.themeProfile;
      const resolved = resolveThemeExperience({ course: { ...c, world } });
      Object.assign(c, resolved.course);
    }),
  );
  on($('editor-snap'), 'change', () => spatialEditor?.setSnap(Number($('editor-snap').value)));
  on($('editor-reset-view'), 'click', () => spatialEditor?.resetView());
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
  on($('export-challenge'), 'click', () => {
    if (!editor) throw new Error('Create a challenge first.');
    download(editor, `${editor.id}.json`);
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
  const runtimeOffline = mountPracticeOfflineControls({
    prepareButton: $('prepare-runtime'),
    removeButton: $('remove-runtime'),
    document: doc,
    window: win,
    storage,
    packageId: 'fpv-worlds',
    onStatus(kind, error) {
      if (disposed) return;
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
      };
      $('runtime-offline-status').textContent = messages[kind]
        ? txt(...messages[kind])
        : String(error?.message ?? error);
    },
  });
  if (!runtimeOffline.available)
    $('runtime-offline-status').textContent = txt(
      'Offline installation needs a secure browser with service-worker support.',
      'Для автономного встановлення потрібен захищений браузер із підтримкою сервісних воркерів.',
    );
  on($('world-flight-menu'), 'click', () => setFlightMenu(true));
  on($('world-flight-close-menu'), 'click', () => setFlightMenu(false));
  on($('world-flight-resume'), 'click', () => $('world-arm').click());
  on($('world-arm'), 'click', () => {
    if (doc.querySelector('dialog[open]:not(#flight-dialog)')) return;
    if (beginnerCoach.blocksArm()) {
      beginnerCoach.showGuide();
      return;
    }
    $('flight-dialog').dataset.flightMenuOpen = 'false';
    $('flight-dialog').dataset.optionsOpen = 'false';
    $('flight-options').setAttribute('aria-expanded', 'false');
    immersive.closeControls();
    if (
      !sceneReady ||
      ghostLookup ||
      !flight ||
      terminal(flight.snapshot()) ||
      (replayProof && finished)
    )
      return;
    if (!replayProof && $('flight-source').value === 'radio') {
      restoreRadio();
      radio.poll();
      if (!radio.status().active && !radio.requestArm()) {
        paintInput(flight.snapshot());
        $('flight-status').textContent = radioHelp(radio.status().reason);
        return;
      }
    }
    if (!replayProof && $('flight-source').value === 'controller') {
      readGamepad(win.performance.now(), 'ready');
      if (!gamepad.status().canArm) {
        $('flight-status').textContent = txt(
          'Connect a controller, then centre the sticks and release all buttons.',
          'Під’єднайте контролер і відпустіть стіки та кнопки.',
        );
        return;
      }
    }
    input.enable(!replayProof);
    if (checkpointSession) {
      const throttle = flight.snapshot().lastInput.throttle / 1000;
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
    flight.arm();
    huntReactions.resume();
    appearanceSession.arm(flight.snapshot().status);
    $('flight-status').textContent = replayProof
      ? txt('Playback active · no rewards.', 'Відтворення триває · без нагород.')
      : checkpointSession
        ? txt(
            'Section practice active · no rewards or recording.',
            'Тренування ділянки триває · без нагород і запису.',
          )
        : preview
          ? txt('Preview: completion does not earn rewards.', 'Перегляд: виконання не дає нагород.')
          : txt('Flight active.', 'Політ триває.');
    $('world-viewport').focus();
  });
  const menuHint = doc.createElement('p');
  menuHint.className = 'sim-menu-hint';
  menuHint.id = 'sim-menu-hint';
  doc.querySelector('main').append(menuHint);
  function menuContext() {
    if (disposed) return null;
    if (enemyGuide.dialog.open) return { root: enemyGuide.dialog, key: enemyGuide.dialog.id };
    if (packRemovalReview?.dialog.open)
      return { root: packRemovalReview.dialog, key: 'pack-removal-review' };
    const secondary = ['world-radio-dialog', 'drone-hangar', 'sim-settings']
      .map($)
      .find((node) => node.open);
    if (secondary)
      return {
        root: secondary,
        key: secondary.id,
        blockRadio: secondary.id === 'world-radio-dialog',
        blockDevices: secondary.id === 'world-radio-dialog' && Boolean(radioSetup?.captureActive()),
      };
    if (playShell?.topDialog())
      return { root: playShell.topDialog(), key: playShell.topDialog().id };
    if ($('flight-dialog').open) {
      if (beginnerCoach.previewRunning()) return null;
      if (beginnerCoach.blocksArm()) return { root: $('beginner-coach'), key: 'coach' };
      if (flight?.snapshot().status === 'active') return null;
      return {
        root: $('flight-dialog'),
        key: `flight:${$('flight-dialog').dataset.optionsOpen}:${flightMenuOpen()}`,
        blockDevices: gamepadScope() !== 'blocked',
      };
    }
    return { root: doc.body, key: `lobby:${win.location.hash}` };
  }
  const menuNavigation = createFlightMenuNavigation({
    document: doc,
    window: win,
    locale: () => locale,
    getContext: menuContext,
    onHint(value) {
      const context = menuContext();
      // Blur suspends device ownership with an empty hint. Keep the current
      // shared menu's instructions in place: clearing and restoring them can
      // scroll the dialog between pointer press and release.
      if (!value && context?.root.dataset.modeSurface) return;
      if (!context) {
        menuHint.hidden = true;
        return;
      }
      const container = context.root === doc.body ? doc.querySelector('main') : context.root;
      if (menuHint.parentElement !== container) container.append(menuHint);
      menuHint.hidden = false;
      if (menuHint.textContent !== value) menuHint.textContent = value;
    },
    onBack() {
      if (enemyGuide.dialog.open) enemyGuide.close();
      else if (packRemovalReview?.dialog.open) $('pack-removal-cancel').click();
      else if ($('world-radio-dialog').open) closeRadio();
      else if ($('drone-hangar').open)
        $('drone-hangar').querySelector('[data-close-hangar]').click();
      else if ($('sim-settings').open) closeSettings();
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
    if (!menuContext()) {
      menuNavigation.poll({ now });
      return;
    }
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
    const observed = radio.preview();
    menuNavigation.poll({
      now,
      gamepads,
      radio: {
        key: radio.status().selected?.key,
        controls: observed.controls,
        verified: observed.verified,
        index: radio.status().selected?.index,
      },
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
  function retryFlight({ paused = false } = {}) {
    return startFlight(current, {
      preview,
      playlist: playingPlaylist,
      index: playlistIndex,
      replayProof,
      checkpoint: checkpointRequest,
      demonstration: replayKind === 'demonstration',
      paused,
    });
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
  on($('fly-after-replay'), 'click', () => current && startFlight(current));
  on($('world-replay-rate'), 'change', () => {
    const selected = Number($('world-replay-rate').value);
    if (![0.25, 0.5, 1].includes(selected)) return;
    replayRate = selected;
    lastTime = null;
    lastExecutionTime = win.performance?.now?.() ?? null;
    accumulator = 0;
  });
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
    else if (flight?.snapshot().status === 'active') setFlightMenu(true);
    else if (flightMenuOpen()) setFlightMenu(false);
    else if (immersive.active()) void immersive.exit();
    else void closeFlight().catch(reportError);
  });
  on($('export-flight'), 'click', async () => {
    if (recorder && current) {
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
    if (replayProof) return;
    pauseFlight();
    input.select($('flight-source').value);
    if (checkpointSession && $('flight-source').value === 'radio')
      radio.reset({
        notify: false,
        pickup: Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [
            key,
            flight.snapshot().lastInput[key] / 1000,
          ]),
        ),
      });
    restoreRadio();
    paintInput(flight?.snapshot());
  });
  on($('flight-mode'), 'change', () => {
    const selectedMode = $('flight-mode').value;
    renderCatalogue();
    if (checkpointRequest) {
      const hasSection = checkpointRequest.index < current.course.steps[selectedMode].length;
      const proof = hasSection ? demonstrationFor(current, selectedMode) : null;
      return startFlight(proof ? demonstrationEntry(current) : current, {
        paused: true,
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
        proof ? demonstrationEntry(current) : current,
        proof ? { preview: true, replayProof: proof, demonstration: true, paused: true } : {},
      );
    }
    if (current && $('flight-dialog').open)
      return startFlight(current, {
        preview: preview && !modePractice,
        playlist: playingPlaylist,
        index: playlistIndex,
      });
  });
  on($('flight-touch-response'), 'change', () => {
    pauseFlight();
    input.touchResponse($('flight-touch-response').value);
    try {
      storage?.setItem('revealline.fpv.touch-response.v1', $('flight-touch-response').value);
    } catch {
      /* Touch response remains usable if browser storage is unavailable. */
    }
    if (flight) paintInput(flight.snapshot());
  });
  on($('flight-keyboard-preset'), 'change', () => {
    pauseFlight();
    input.keyboardPreset($('flight-keyboard-preset').value);
    try {
      storage?.setItem(KEYBOARD_PRESET_KEY, $('flight-keyboard-preset').value);
    } catch {
      /* Session controls remain usable without storage. */
    }
    if (flight) paintInput(flight.snapshot());
  });
  on($('flight-stick-display'), 'change', () => paintInput(flight?.snapshot()));
  on($('flight-drone-guide'), 'change', () => paintInput(flight?.snapshot()));
  on($('flight-guide-scale'), 'change', () => paintInput(flight?.snapshot()));
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
    updateHUD(flight.snapshot());
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
      if (drawFlight(flight.snapshot()) === false) return;
      if (disposed || token !== flightToken || generation !== scenePreparationGeneration) return;
      qualityPreparing = false;
      sceneReady = true;
      updateHUD(flight.snapshot());
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
      if (!replayProof && flight?.snapshot().status === 'active') {
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
      if (flight?.snapshot().status === 'active') pauseFlight();
      else $('world-arm').click();
    } else if (e.code === preset.reset) {
      e.preventDefault();
      if (!e.repeat) return retryFlight({ paused: true });
    } else if (e.code === preset.fire) {
      e.preventDefault();
      if (
        !replayProof &&
        !e.repeat &&
        !fireReleaseRequired &&
        flight?.snapshot().status === 'active'
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
    if (replayProof) return;
    pauseFlight();
    radioSetup?.dispose();
    radioSetup = mountRadioSetup({
      container: $('world-radio-setup'),
      window: win,
      runtime: radio,
      locale,
      onDone() {
        if ($('flight-source').value !== 'radio') {
          $('flight-source').value = 'radio';
          $('flight-source').dispatchEvent(new win.Event('change', { bubbles: true }));
        }
        closeRadio();
      },
      onResponse: (rates) => {
        if (learningPreferences) learningResponse = { ...rates };
        response = learningPreferences ? { ...DEFAULT_RESPONSE } : rates;
        if (current && $('flight-dialog').open)
          void startFlight(current, {
            preview,
            playlist: playingPlaylist,
            index: playlistIndex,
            checkpoint: checkpointRequest,
          }).catch(reportError);
      },
    });
    $('world-radio-dialog').showModal();
  });
  function closeRadio() {
    radioSetup?.dispose();
    radioSetup = null;
    $('world-radio-dialog').close();
    pauseFlight();
    if ($('sim-settings').open) $('radio-setup-button').focus();
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
    if (!replayProof && $('flight-source').value === 'radio') radio.disconnect(e.gamepad.index);
  });
  on(win, 'focus', () => restoreRadio());
  on(win, 'pagehide', () => pauseFlight());
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
  const shellModes = createSimModeLinks({ document: doc, gameReturn, locale: () => locale });
  const shellStage = el('p', txt('Preparing flight…', 'Підготовка польоту…'), 'sim-shell-loading');
  shellStage.setAttribute('role', 'status');
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
  playShell = mountSimPlayShell({
    document: doc,
    mount: doc.body,
    idPrefix: 'worlds-shell',
    wordmarkURL: new URL(
      lobbyHeader.querySelector('.wordmark img').getAttribute('src'),
      win.location.href,
    ).href,
    modeName: () => (locale === 'uk' ? 'FPV SIM · Світи' : 'FPV SIM · Worlds'),
    locale,
    services: {
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
      continue: () =>
        current && flight
          ? $('world-arm').click()
          : void resumeInterruptedFlight().catch(reportError),
      resume: () =>
        current && flight
          ? $('world-arm').click()
          : void resumeInterruptedFlight().catch(reportError),
      retry: () => (current ? void retryFlight().catch(reportError) : $('hero-fly').click()),
      fullscreen: () => void immersive.toggle(),
      toggleSound: () => soundButton.click(),
      canResume: () =>
        Boolean(recovery && dependencyAvailable(recovery.packIdentity, recovery.course.id)),
      open(surface) {
        paintLessonReturn(surface);
        if (flight?.snapshot().status === 'active') pauseFlight();
        if (flight) updateHUD(flight.snapshot());
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
          showTab(shellTab, false);
          shellTab = 'explore';
        } else if (surface === 'workshop' || surface === 'help') {
          openCatalogueTab(surface === 'workshop' ? 'creator' : 'learn');
          return false;
        } else if (surface === 'settings' || surface === 'expert') {
          openSettings();
          return false;
        }
      },
    },
    initial: 'home',
    focusPlay: () => $('world-viewport').focus(),
  });
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
    pause: pauseFlight,
    snapshot: () => ({
      course: current?.id,
      appearance: {
        ...appearanceControls.resolve(),
        accepted: appearanceSession.current(),
        pending: appearanceSession.pending(),
      },
      state: flight?.snapshot(),
      replay: replayProof
        ? {
            kind: replayKind,
            mode: replayProof.mode,
            rate: replayRate,
            frames: replayProof.frames.length,
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
      closing = Promise.resolve().then(async () => {
        runtimeOffline.dispose();
        worldLibrary.dispose();
        proofImport?.abort();
        packRemovalReview?.close();
        restorePackIdentity = null;
        restorePackInput.remove();
        ++flightToken;
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
          menuHint.remove();
          input.dispose();
          gamepad.dispose();
          radioSetup?.dispose();
          flight?.dispose?.();
          flight = null;
          recorder = null;
          current = null;
          sectorReferenceProof = null;
          ghostEnabled = false;
          renderer?.dispose();
          hangar.dispose();
          appearanceControls.dispose();
          actorEditor?.dispose();
          audioControls.dispose();
          huntPresentationControls.dispose();
          huntReactions.dispose();
          enemyGuide.dispose();
          audio.dispose();
          presentation.dispose();
          droneResponse.dispose();
          stickTraces.forEach((trace) => trace.dispose());
          beginnerCoach.dispose();
          spatialEditor?.dispose();
          // Keep reparented controls available until their input, hints,
          // audio and editor owners have all retired.
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
