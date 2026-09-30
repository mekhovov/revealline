import {
  WORLD_CATALOGUE,
  WORLD_THEMES,
  FLIGHT_WORLDS,
  ACTIVITY_NAMES,
  CURATED_PLAYLISTS,
} from './world-catalogue.mjs';
import { FLIGHT_COURSES } from './catalogue.mjs';
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
  WORLD_FLIGHT_MODEL,
} from './world-model.mjs';
import { WORLD_COLLISION_BACKEND } from './world-collision.mjs';
import { createFlightRenderer } from './renderer.mjs';
import { createFlightInput } from './input.mjs';
import { createRadioRuntime } from './radio-runtime.mjs';
import { restoreVerifiedRadio } from './radio-session.mjs';
import { mountRadioSetup } from './radio-setup.mjs';
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
  mergeReimport,
  preparePack,
  inspectPack,
  installPack,
  exportEditedProject,
} from './world-content.mjs';
import { importEditableZip } from './world-zip.mjs';
import { openWorldStore } from './world-store.mjs';
import { preparePracticeOffline } from './offline.mjs';
import { dataIdentity } from '../../game/data-json.mjs';
import { THEME_PROFILES, resolveThemeExperience } from './world-themes.mjs';
import { mountWorldEditor } from './world-editor.mjs';
import { createWorldAudio } from './world-audio.mjs';
import {
  evaluateWorldResult,
  createSectorTracker,
  compatibleGhost,
  checkpointPractice,
} from './world-progress.mjs';
import { splitCourseDefinition, compileContentProject } from './content-definitions.mjs';
import { builtinWorldScene } from './world-assets.mjs';
import { mountDroneHangar } from './world-hangar.mjs';
import { mountActorEditor } from './world-actor-editor.mjs';

const COPY_EN = {
  firstFlight: 'YOUR FIRST FLIGHT',
  firstFlightTitle: 'Watch a hover. Then try it yourself.',
  firstFlightHelp:
    'Start with the Academy: raise throttle gently, hold inside the marker, then land. Self-level helps you stay upright; Acro keeps the angle you set.',
  watchFirst: 'Watch first flight',
  tryFirst: 'Try first flight',
  demoCoverage:
    '56 recorded examples cover all 28 Academy, Woodland Park and Ukrainian Courtyard challenges in both modes. Examples for the remaining worlds are still in production.',
  watchDemo: 'Watch demonstration',
  playbackSpeed: 'Playback speed',
  flyThis: 'Fly this challenge',
  inspectDrone: 'Inspect drone',
  hangarHelp: 'Drag to rotate. Scroll to zoom. Every appearance uses the same flight handling.',
  explore: 'Explore',
  playlists: 'My playlists',
  creator: 'Create',
  packs: 'World packs',
  eyebrow: 'YOUR NEXT FLIGHT',
  heading: 'A world worth flying.',
  intro: 'Find your line. Build a playlist. Every challenge is open.',
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
  themePreview: 'Theme preview',
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
  restoreProofs: 'Restore flight records',
  prepareRuntime: 'Prepare simulator offline',
  keepOffline: 'Request persistent storage',
  close: 'Close',
  keyboard: 'Keyboard',
  touch: 'Touch',
  radio: 'USB radio',
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
  keys: 'W/S pitch · A/D roll · Q/E yaw · ↑/↓ throttle · P pause · Space fire',
};
const COPY_UK = {
  firstFlight: 'ВАШ ПЕРШИЙ ПОЛІТ',
  firstFlightTitle: 'Подивіться зависання. Потім спробуйте самі.',
  firstFlightHelp:
    'Почніть з Академії: плавно додайте газ, утримуйте дрон у маркері та сідайте. Самовирівнювання допомагає тримати горизонт; Acro зберігає заданий нахил.',
  watchFirst: 'Переглянути перший політ',
  tryFirst: 'Спробувати перший політ',
  demoCoverage:
    '56 записаних прикладів охоплюють усі 28 завдань Академії, Лісопарку та Українського подвір’я в обох режимах. Приклади для решти світів ще готуються.',
  watchDemo: 'Переглянути демонстрацію',
  playbackSpeed: 'Швидкість відтворення',
  flyThis: 'Виконати це завдання',
  explore: 'Дослідження',
  playlists: 'Мої добірки',
  creator: 'Створення',
  packs: 'Пакунки світів',
  eyebrow: 'ВАШ НАСТУПНИЙ ПОЛІТ',
  heading: 'Світ, вартий польоту.',
  intro: 'Знайдіть свій маршрут. Створіть добірку. Усі завдання відкриті.',
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
  restoreProofs: 'Відновити записи',
  keepOffline: 'Запросити постійне сховище',
  prepareRuntime: 'Підготувати автономний запуск',
  close: 'Закрити',
  keyboard: 'Клавіатура',
  touch: 'Дотик',
  radio: 'USB-пульт',
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
  keys: 'W/S тангаж · A/D крен · Q/E поворот · ↑/↓ газ · P пауза · Пробіл вогонь',
  themePreview: 'Тема оформлення',
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
function synchronizeDefinitions(project) {
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
  if (step?.min && step.max)
    return Object.fromEntries(
      coordinates.map((k) => [k, Math.round((step.min[k] + step.max[k]) / 2)]),
    );
  if (step?.type === 'gate')
    return {
      x: step.axis === 'x' ? step.at : Math.round((step.minSide + step.maxSide) / 2),
      y: Math.round((step.minY + step.maxY) / 2),
      z: step.axis === 'z' ? step.at : Math.round((step.minSide + step.maxSide) / 2),
    };
  return null;
}
export function moveCriterion(step, position) {
  const before = criterionCentre(step);
  if (!before) throw new Error('This objective has no position; edit its parameters in JSON.');
  if (!coordinates.every((k) => Number.isSafeInteger(position[k])))
    throw new Error('Coordinates must be finite millimetres.');
  const out = clone(step),
    delta = Object.fromEntries(coordinates.map((k) => [k, position[k] - before[k]]));
  if (out.min)
    for (const k of coordinates) {
      out.min[k] += delta[k];
      out.max[k] += delta[k];
    }
  else {
    out.at += delta[out.axis];
    out.minSide += delta[out.axis === 'x' ? 'z' : 'x'];
    out.maxSide += delta[out.axis === 'x' ? 'z' : 'x'];
    out.minY += delta.y;
    out.maxY += delta.y;
  }
  return out;
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

export function routeThumbnail(document, course, color = '#a2dfcf') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 190');
  svg.setAttribute('aria-hidden', 'true');
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
  for (let x = 20; x < 320; x += 25) add('path', { d: `M ${x} 0 V 190`, stroke: '#ffffff0d' });
  for (let z = 15; z < 190; z += 25) add('path', { d: `M 0 ${z} H 320`, stroke: '#ffffff0d' });
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
      fill: '#0e242c',
      stroke: '#ffffff25',
      rx: 2,
    });
  }
  const points = [course.spawn, ...course.steps['self-level'].map(criterionCentre).filter(Boolean)];
  add('path', {
    d: points.map((p, i) => `${i ? 'L' : 'M'} ${px(p.x)} ${pz(p.z)}`).join(' '),
    stroke: color,
    'stroke-width': 2.5,
    fill: 'none',
    'stroke-dasharray': '5 4',
  });
  points.forEach((p, i) =>
    add('circle', {
      cx: px(p.x),
      cy: pz(p.z),
      r: i ? 3.5 : 5,
      fill: i ? color : '#ffffff',
      stroke: '#193d38',
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
  doc.querySelectorAll('[data-i18n]').forEach((n) => {
    translatedNodes.push({ node: n, key: n.dataset.i18n, fallback: n.textContent });
    // The host's translator owns its own data-i18n namespace. Studio strings
    // use a local dictionary so importing the existing notebook cannot replace
    // them with unresolved translation keys.
    n.removeAttribute('data-i18n');
  });
  let locale = 'en',
    theme = 'all',
    catalogue = [...WORLD_CATALOGUE],
    installed = [],
    revisions = [],
    records = [],
    worldStore = null,
    recordStore = null,
    disposed = false;
  let entries = [],
    playlistId = unique('playlist'),
    playlistDraft = null,
    playingPlaylist = null,
    playlistIndex = 0;
  let editor = null,
    editorIndex = 0,
    editorSelection = null,
    undo = [],
    redo = [],
    editingProject = null,
    projectAssets = new Map(),
    projectGeneration = null,
    spatialEditor = null,
    actorEditor = null;
  let renderer = null,
    flight = null,
    recorder = null,
    current = null,
    preview = false,
    flightToken = 0,
    finished = false,
    sceneReady = false,
    fire = false,
    fireReleaseRequired = false,
    pausing = false,
    lastTime = null,
    accumulator = 0,
    raf = 0,
    radioSetup = null,
    response = { ...DEFAULT_RESPONSE },
    recovery = null,
    replayProof = null,
    replayKind = 'recording',
    replayRate = 1,
    sectorReference = null,
    sectorReferenceId = null,
    sectorReferenceStatus = 'none',
    sectorLookup = null;
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
    'flight-camera',
    'drone-look',
    'flight-quality',
    'flight-stick-display',
    'world-fov',
    'world-tilt',
  ];
  try {
    const saved = JSON.parse(storage?.getItem('revealline.fpv.world-settings.v1') ?? '{}');
    for (const id of preferenceIds)
      if (typeof saved[id] === 'string') {
        const node = $(id),
          valid =
            node.tagName === 'SELECT'
              ? [...node.options].some((o) => o.value === saved[id])
              : Number(saved[id]) >= Number(node.min) && Number(saved[id]) <= Number(node.max);
        if (valid) node.value = saved[id];
      }
    locale = $('world-language').value;
  } catch {
    /* Invalid preferences use the visible defaults. */
  }
  const savePreferences = () => {
    try {
      storage?.setItem(
        'revealline.fpv.world-settings.v1',
        JSON.stringify(Object.fromEntries(preferenceIds.map((id) => [id, $(id).value]))),
      );
    } catch (error) {
      reportError(error);
    }
  };
  const txt = (en, uk) => (locale === 'uk' ? uk : en);
  const localized = (value) =>
    typeof value === 'string' ? value : (value?.[locale] ?? value?.en ?? '');
  const label = (entry) => entry.course.locales[locale].title;
  const demonstrationCache = new WeakMap();
  function demonstrationFor(entry, mode) {
    if (!entry) return null;
    const cache = demonstrationCache.get(entry.course) ?? new Map();
    if (cache.has(mode)) return cache.get(mode);
    if (!entry.legacy) {
      const candidate = WORLD_DEMONSTRATIONS.find(
        (item) => item.proof.course === entry.id && item.proof.mode === mode,
      );
      const proof = candidate?.proof;
      // Catalogue availability must not initialize a physics world. The full
      // normalized source fingerprint binds this data to the exact revision;
      // replayWorldFlight checks every v2 identity and final state before play.
      const match =
        proof?.format === 'FlightAttempt.v2' &&
        proof.session === 'demonstration' &&
        proof.model === WORLD_FLIGHT_MODEL &&
        proof.backend === WORLD_COLLISION_BACKEND &&
        proof.responseIdentity === responseIdentity(proof.response) &&
        candidate.sourceIdentity === dataIdentity(validateWorldCourse(entry.course))
          ? proof
          : null;
      cache.set(mode, match);
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
    cache.set(mode, match);
    demonstrationCache.set(entry.course, cache);
    return match;
  }
  function watchDemonstration(entry, mode = $('flight-mode').value) {
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
    status(error.message ?? error);
    if ($('flight-dialog').open) $('flight-status').textContent = error.message ?? error;
  };
  const on = (node, event, callback) => {
    const fn = (...args) => {
      try {
        Promise.resolve(callback(...args)).catch(reportError);
      } catch (error) {
        reportError(error);
      }
    };
    node?.addEventListener(event, fn);
    listeners.push(() => node?.removeEventListener(event, fn));
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
  const audio = createWorldAudio({ window: win, storage });
  const soundButton = button('', async () => {
    await audio.setEnabled(!audio.enabled());
    updateSoundLabel();
  });
  soundButton.id = 'world-sound';
  doc.querySelector('.flight-controls').append(soundButton);
  function updateSoundLabel() {
    soundButton.textContent = audio.enabled()
      ? txt('Sound on', 'Звук увімкнено')
      : txt('Sound off', 'Звук вимкнено');
    soundButton.setAttribute('aria-pressed', String(audio.enabled()));
  }
  updateSoundLabel();
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
  on(folderInput, 'change', (e) => importScene(e.target.files));
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
  const ghostButton = button(txt('Show best line', 'Показати найкращий маршрут'), async () => {
    if (!flight) return;
    pauseFlight();
    const best = records
      .filter((r) => compatibleGhost(r, flight.identity))
      .sort((a, b) => a.proof.frames.length - b.proof.frames.length)[0];
    if (!best)
      throw new Error(
        txt('No compatible verified best flight yet.', 'Ще немає сумісного перевіреного польоту.'),
      );
    const token = flightToken,
      result = current.legacy
        ? await replayFlightCooperatively(current.course, best.proof, { sampleEvery: 5 })
        : await replayWorldFlight(current.course, best.proof, { sampleEvery: 5 });
    if (token === flightToken) renderer.setPath(result.path);
  });
  ghostButton.id = 'show-ghost';
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
  function showTab(id) {
    for (const panel of doc.querySelectorAll('.tab-panel')) panel.hidden = panel.id !== id;
    for (const b of doc.querySelectorAll('[data-tab]'))
      b.classList.toggle('selected', b.dataset.tab === id);
    if (id === 'creator') ensureSpatialEditor();
  }
  function paintLanguage() {
    doc.documentElement.lang = locale;
    for (const { node, key, fallback } of translatedNodes)
      node.textContent =
        (locale === 'uk' ? COPY_UK[key] : COPY_EN[key]) ?? COPY_EN[key] ?? fallback;
    updateSoundLabel();
    ghostButton.textContent = txt('Show best line', 'Показати найкращий маршрут');
  }
  function ensureSpatialEditor() {
    if (!editor || !$('world-editor-canvas')) return;
    if (!spatialEditor) {
      spatialEditor = mountWorldEditor({
        canvas: $('world-editor-canvas'),
        window: win,
        course: editor,
        mode: 'self-level',
        onError: reportError,
        onSelect(ref) {
          editorSelection = ref;
          if (ref?.kind === 'criterion') editorIndex = ref.index;
          if (ref?.kind === 'actor') actorEditor?.select(ref.id);
          refreshEditor(false);
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
    spatialEditor.setCourse(editor);
    spatialEditor.select(editorSelection ?? { kind: 'criterion', index: editorIndex });
    const model =
      (editingProject?.world.modelAsset
        ? projectAssets.get(editingProject.world.modelAsset)
        : null) ?? builtinWorldScene(editor);
    if (model) void spatialEditor.loadScene(model).catch(reportError);
  }
  function moveSelection(c, ref, position) {
    if (ref.kind === 'criterion') {
      for (const mode of ['self-level', 'acro'])
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
  const notebook = createFlightNotebook({
    courses: FLIGHT_COURSES,
    indexedDB: win.indexedDB,
    onStatus: (message) => {
      if (typeof message === 'string') status(message);
    },
  });
  const input = createFlightInput({ window: win, document: doc, onPause: () => pauseFlight() });
  input.bindStick($('world-left-stick'), 'left');
  input.bindStick($('world-right-stick'), 'right');
  const radio = createRadioRuntime({
    getGamepads: () => win.navigator.getGamepads?.() ?? [],
    onFreeze: () => pauseFlight(false),
    onReset: () => {
      if (current)
        void startFlight(current, {
          preview,
          playlist: playingPlaylist,
          index: playlistIndex,
          replayProof,
          demonstration: replayKind === 'demonstration',
        }).catch(reportError);
    },
  });
  function restoreRadio() {
    if (replayProof || $('flight-source').value !== 'radio' || $('world-radio-dialog').open) return;
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
  function paintInput(state) {
    const source = replayProof ? 'recording' : $('flight-source').value,
      touchActive = source === 'touch',
      display = $('flight-stick-display').value,
      monitor = $('world-touch'),
      radioPreview = source === 'radio' ? radio.preview() : null,
      unavailable = source === 'radio' && !radioPreview?.controls,
      controls =
        source === 'radio'
          ? (radioPreview?.controls ?? neutralFlightInput())
          : Object.fromEntries(
              ['roll', 'pitch', 'yaw', 'throttle'].map((k) => [
                k,
                (state?.lastInput?.[k] ?? 0) / 1000,
              ]),
            ),
      layout = STICK_LAYOUTS[radioPreview?.stickMode ?? 2];
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
    for (const [index, side] of ['left', 'right'].entries()) {
      const node = $(`world-${side}-stick`),
        horizontal = layout[index * 2],
        vertical = layout[index * 2 + 1],
        x = controls[horizontal],
        y = vertical === 'throttle' ? controls[vertical] * 2 - 1 : controls[vertical],
        radius = node.clientWidth * 0.34;
      node.querySelector('i').style.transform = `translate(${x * radius}px, ${-y * radius}px)`;
      node.setAttribute(
        'aria-label',
        `${controlName(horizontal)} ${Math.round(x * 100)}%, ${controlName(vertical)} ${Math.round(controls[vertical] * 100)}%`,
      );
      $(`world-${side}-label`).textContent =
        `${controlName(horizontal)} / ${controlName(vertical)}`;
    }
    const status = $('world-input-status');
    const text =
      source === 'radio'
        ? `${txt('USB radio', 'USB-пульт')} · ${radioHelp(radio.status().reason)}`
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
            : txt(
                'Keyboard · W/S pitch · A/D roll · Q/E yaw · ↑/↓ throttle.',
                'Клавіатура · W/S тангаж · A/D крен · Q/E рискання · ↑/↓ газ.',
              );
    if (status.textContent !== text) status.textContent = text;
    status.dataset.source = source;
    monitor.dataset.source = source;
    $('world-keys-hint').textContent =
      source === 'radio'
        ? txt(
            'Radio sticks control flight · P pauses · Space or Fire shoots.',
            'Стіки пульта керують польотом · P — пауза · Пробіл або «Вогонь» — постріл.',
          )
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
            : locale === 'uk'
              ? COPY_UK.keys
              : COPY_EN.keys;
    $('flight-stick-display').setAttribute(
      'aria-label',
      txt('Stick display', 'Відображення стіків'),
    );
  }
  const hangar = mountDroneHangar({
    button: $('inspect-drone'),
    dialog: $('drone-hangar'),
    canvas: $('drone-hangar-canvas'),
    selector: $('drone-look'),
    onOpen: () => pauseFlight(),
    window: win,
  });
  const actorContainer = el('section');
  actorContainer.id = 'world-actor-editor';
  $('creator-json').closest('details').before(actorContainer);
  actorEditor = mountActorEditor({
    container: actorContainer,
    getCourse: () => editor,
    onChange: (mutator) => applyEdit(mutator),
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
    for (const attempt of notebook.snapshot().attempts) {
      const entry = catalogue.find((e) => e.legacy && e.id === attempt.course);
      if (entry) complete.add(keyOf(entry));
    }
    return complete;
  }
  function renderFilters() {
    if ($('creator-theme'))
      for (const option of $('creator-theme').options)
        option.textContent =
          localized(THEME_PROFILES.find((t) => t.id === option.value)?.title) || option.value;
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
    for (const [id, group] of groups) {
      const world = FLIGHT_WORLDS.find((w) => w.id === id),
        card = el('article', undefined, 'world-card'),
        cover = el('div', undefined, 'world-cover'),
        color = WORLD_THEMES.find((t) => t.id === group[0].theme)?.color ?? '#c8eb93';
      cover.append(routeThumbnail(doc, group[0].course, color));
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
        if (demonstrationFor(entry, 'self-level') && demonstrationFor(entry, 'acro')) {
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
            { ...group[0], id: course.id, course: validateWorldCourse(course), legacy: false },
            { preview: true },
          );
        }),
      );
      $('world-grid').append(card);
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
    if (resumable && bookmark.nextIndex < resumable.entries.length)
      $('saved-playlists').append(
        button(
          `${txt('Continue', 'Продовжити')}: ${localized(resumable.title)} · ${bookmark.nextIndex + 1}/${resumable.entries.length}`,
          () => flySequence(resumable, bookmark.nextIndex),
        ),
      );
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
    if (!ref?.course)
      throw new Error(
        txt(
          'This pinned challenge is unavailable. Install its exact world pack to continue.',
          'Це завдання недоступне. Встановіть його точний пакунок світу.',
        ),
      );
    try {
      playlistStore.save(p);
      playlistStore.bookmark(p.id, p.revision, index);
    } catch (error) {
      reportError(error);
    }
    await startFlight(ref.course, { playlist: p, index });
  }

  function refreshEditor(updateScene = true) {
    $('undo-edit').disabled = !undo.length;
    $('redo-edit').disabled = !redo.length;
    if (!editor) return;
    $('creator-title').value = editor.locales[locale].title;
    $('creator-json').value = JSON.stringify(editor, null, 2);
    if ($('creator-theme')) $('creator-theme').value = editor.world.theme;
    $('criterion-list').replaceChildren();
    editor.steps['self-level'].forEach((step, i) =>
      $('criterion-list').append(
        new Option(
          `${i + 1}. ${stepName(step)}${step.targets ? ` · ${step.targets.length}` : ''}`,
          String(i),
        ),
      ),
    );
    editorIndex = Math.max(0, Math.min(editorIndex, editor.steps['self-level'].length - 1));
    for (const actor of editor.actors)
      $('criterion-list').append(
        new Option(`${txt('Actor', 'Персонаж')}: ${actor.id}`, `actor:${actor.id}`),
      );
    $('criterion-list').value = String(editorIndex);
    const actor =
      editorSelection?.kind === 'actor'
        ? editor.actors.find((a) => a.id === editorSelection.id)
        : null;
    if (actor) $('criterion-list').value = `actor:${actor.id}`;
    const p = actor?.position ?? criterionCentre(editor.steps['self-level'][editorIndex]);
    for (const k of coordinates) {
      $(`criterion-${k}`).value = p ? p[k] / 1000 : '';
      $(`criterion-${k}`).disabled = !p;
    }
    $('move-criterion').disabled = !p;
    $('criterion-y').max = String(editor.bounds.max.y / 1000);
    for (const id of ['duplicate-criterion', 'remove-criterion', 'criterion-up', 'criterion-down'])
      $(id).disabled = Boolean(actor);
    if (updateScene) refreshEditorScene();
    actorEditor?.refresh();
  }
  function syncProject(comparePositions = true, previousBindings = null) {
    if (editingProject && editor?.world.id === editingProject.id) {
      const previous = editingProject.courses.find((c) => c.id === editor.id),
        bindings = editingProject.routeBindings?.[editor.id]?.['self-level'];
      if (comparePositions && previous && bindings) {
        for (const [i, anchorId] of bindings.entries()) {
          const oldIndex = previousBindings ? previousBindings.indexOf(anchorId) : i;
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
      editingProject.title = editor.locales[locale].title;
      editingProject.courses = [
        clone(editor),
        ...editingProject.courses.filter((c) => c.id !== editor.id),
      ];
      synchronizeDefinitions(editingProject);
      editor = clone(editingProject.courses.find((c) => c.id === editor.id));
    }
  }
  const editorSnapshot = () => ({
    course: clone(editor),
    index: editorIndex,
    selection: clone(editorSelection),
    bindings: clone(editingProject?.routeBindings?.[editor.id] ?? null),
    overrides: clone(editingProject?.overrides ?? {}),
  });
  function applyEdit(change) {
    if (!editor)
      throw new Error(txt('Create a challenge copy first.', 'Спочатку створіть копію завдання.'));
    const before = editorSnapshot(),
      next = clone(editor),
      bindings = clone(before.bindings);
    let valid;
    try {
      change(next, bindings);
      valid = validateWorldCourse(next);
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
    syncProject(true, before.bindings?.['self-level']);
    refreshEditor();
  }
  function setEditor(course) {
    editor = validateWorldCourse(course);
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
    c.format = 'FlightCourse.v2';
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
      theme: editingProject?.id === course.world.id ? 'custom' : course.world.theme,
      activity: 'exploration',
      difficulty: 'intermediate',
      duration: 4,
      packIdentity: 'authoring',
      legacy: false,
      projectId: editingProject?.id === course.world.id ? editingProject.id : undefined,
    };
  }

  async function refreshStorage() {
    if (worldStore) {
      installed = await worldStore.list();
      revisions = await worldStore.list({ includeRevisions: true });
      catalogue = [...WORLD_CATALOGUE];
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
    renderFilters();
    renderCatalogue();
    renderPlaylist();
    renderPacks();
  }
  function renderPacks() {
    $('recovery-banner')?.remove();
    $('installed-packs').replaceChildren();
    for (const record of installed) {
      const row = el('div', undefined, 'proof-row');
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
        button(txt('Export pack', 'Експорт пакунка'), async () => {
          const full = await worldStore.get(record.id);
          download(await preparePack(full.project, { assets: full.assets }), `${record.id}.rlpack`);
        }),
        button(txt('Remove', 'Видалити'), async () => {
          await worldStore.remove(record.id, { expectedGeneration: await worldStore.generation() });
          await refreshStorage();
        }),
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
      const remove = button(txt('Remove', 'Видалити'), async () => {
        await recordStore.remove(record.id);
        await refreshStorage();
      });
      remove.disabled = Boolean(record.pinned);
      row.append(
        el('strong', record.course.locales?.[locale]?.title ?? record.course.id),
        el(
          'small',
          `${record.status} · ${record.diagnostic} · ${record.proof.frames?.length ?? 0} ${txt('ticks', 'тактів')}`,
        ),
        button(txt('Export', 'Експорт'), async () =>
          download((await exportProofParts([record]))[0], `${record.id}.json`),
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
      const b = button(txt('Resume interrupted flight', 'Відновити перерваний політ'), async () => {
        const entry = catalogue.find(
          (e) => e.id === recovery.course.id && e.packIdentity === recovery.packIdentity,
        );
        if (!entry)
          throw new Error(
            txt(
              'Install the exact world pack before recovering this flight.',
              'Для відновлення встановіть точний пакунок світу.',
            ),
          );
        await startFlight(entry, {
          preview: recovery.preview,
          recover: recovery.proof,
          sectorReferenceId: recovery.sectorReferenceId,
        });
      });
      b.id = 'resume-flight';
      $('proof-records').prepend(b);
    }
  }
  function updateImportControls() {
    for (const id of ['preview-world', 'export-project', 'export-pack', 'install-project'])
      $(id).disabled = !editingProject;
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
  async function importScene(files) {
    const list = Array.from(files),
      models = list.filter((f) => /\.(glb|gltf)$/i.test(f.name));
    if (models.length !== 1)
      throw new Error(
        txt(
          'Choose exactly one GLB or glTF and its resources.',
          'Виберіть один GLB або glTF та його ресурси.',
        ),
      );
    const prior = editingProject?.world.modelAsset ? editingProject : null,
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
      diagnostics = [...inspected.metadata.diagnostics];
    if (prior) {
      const merged = mergeReimport(prior, inspected);
      next = merged.project;
      diagnostics = merged.diagnostics;
      const oldWorld = compilePlayable(prior).world,
        newWorld = compilePlayable(next).world;
      const oldAnchors = new Map(oldWorld.anchors.map((a) => [a.id, a])),
        newAnchors = new Map(newWorld.anchors.map((a) => [a.id, a]));
      next.courses = next.courses.map((source) => {
        const c = clone(source);
        c.obstacles = newWorld.colliders.map(colliderFromAnchor);
        for (const mode of ['self-level', 'acro'])
          for (const [i, anchorId] of (next.routeBindings?.[c.id]?.[mode] ?? []).entries()) {
            const before = oldAnchors.get(anchorId),
              after = newAnchors.get(anchorId),
              centre = criterionCentre(c.steps[mode][i]);
            if (before && after && centre)
              c.steps[mode][i] = moveCriterion(
                c.steps[mode][i],
                Object.fromEntries(
                  coordinates.map((k) => [
                    k,
                    centre[k] + Math.round((after.position[k] - before.position[k]) * 1000),
                  ]),
                ),
              );
            else if (before && !after)
              diagnostics.push({
                severity: 'warning',
                message: `${anchorId}: source marker removed; authored objective retained for review.`,
              });
          }
        const before = oldWorld.anchors.find((a) => a.kind === 'spawn'),
          after = newWorld.anchors.find((a) => a.kind === 'spawn');
        if (before && after)
          for (const k of coordinates)
            c.spawn[k] += Math.round((after.position[k] - before.position[k]) * 1000);
        return validateWorldCourse(c);
      });
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
    editingProject = next;
    projectAssets = assets;
    setEditor(next.courses[0]);
    projectGeneration = worldStore ? await worldStore.generation() : null;
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
    };
    await recordStore.saveSession(saved);
    recovery = saved;
  }
  function pauseFlight(freezeRadio = true) {
    if (pausing) return;
    pausing = true;
    if (fire) fireReleaseRequired = true;
    fire = false;
    audio.pause();
    input.enable(false);
    input.clear();
    if (freezeRadio) radio.freeze('paused');
    if (flight) flight.pause();
    lastTime = null;
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
      void saveRecovery().catch(reportError);
    }
  }
  function abortSectorLookup() {
    sectorLookup?.abort();
    sectorLookup = null;
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
  function updateHUD(state) {
    updateSectorHUD();
    const target = current.course.steps[$('flight-mode').value][state.step];
    $('flight-instruments').textContent =
      `${(state.position.y / 1000).toFixed(1)} m · ${(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) / 1000) | 0} m/s · ${(state.ticks / 50).toFixed(1)} s${state.health !== undefined ? ` · ♥ ${state.health}` : ''}`;
    $('flight-objective').textContent = terminal(state)
      ? txt('Flight ended', 'Політ завершено')
      : `${Math.min(state.step + 1, state.total ?? current.course.steps[$('flight-mode').value].length)}/${current.course.steps[$('flight-mode').value].length} · ${target ? stepName(target) : state.status}${state.hold ? ` · ${state.hold}/${target?.ticks ?? 0}` : ''}`;
    $('world-arm').disabled = !sceneReady || terminal(state) || (Boolean(replayProof) && finished);
    $('world-arm').textContent = replayProof
      ? txt('Resume playback', 'Продовжити перегляд')
      : txt('Arm / resume', 'Увімкнути / продовжити');
    $('world-retry').textContent = replayProof
      ? txt('Restart playback', 'Переглянути спочатку')
      : txt('Retry', 'Ще раз');
    $('world-watch-demo').hidden =
      Boolean(replayProof) || !demonstrationFor(current, $('flight-mode').value);
    $('world-fire').hidden =
      Boolean(replayProof) ||
      current.legacy ||
      !current.course.actors.some(
        (a) => a.type !== 'hazard' && (a.role ?? 'hostile') === 'hostile',
      );
    $('world-next').disabled =
      !playingPlaylist || playlistIndex + 1 >= playingPlaylist.entries.length;
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
          ? txt('Challenge complete', 'Завдання виконано')
          : txt('Flight ended', 'Політ завершено'),
      ),
      el('p', txt('Checking recording…', 'Перевірка запису…')),
    );
    try {
      const verified = entry.legacy
        ? await replayFlightCooperatively(entry.course, proof)
        : await replayWorldFlight(entry.course, proof);
      if (verified.state.status !== state.status || verified.state.ticks !== state.ticks)
        throw new Error('Recording does not reproduce this result.');
      if (!isPreview && proof.session === 'practice' && entry.legacy && state.status === 'complete')
        await notebook.accept(proof);
      if (!isPreview && recordStore)
        await recordStore.put({
          course: entry.course,
          proof,
          status: 'verified',
          diagnostic: state.status,
          packIdentity: entry.packIdentity,
        });
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
      await refreshStorage();
      if (token !== flightToken) return;
      $('result-panel').replaceChildren(
        el(
          'h2',
          state.status === 'complete'
            ? txt('Challenge complete', 'Завдання виконано')
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
      if (!entry.legacy)
        $('result-panel').append(
          button(
            lostSector
              ? txt('Practise biggest time loss', 'Тренувати ділянку з найбільшою втратою часу')
              : txt('Practise longest section', 'Тренувати найдовшу ділянку'),
            () =>
              startFlight(
                {
                  ...entry,
                  course: checkpointPractice(
                    entry.course,
                    proof.mode,
                    lostSector?.index ?? resultSummary.weakest,
                  ),
                  legacy: false,
                },
                { preview: true },
              ),
          ),
        );
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
    finished = true;
    input.enable(false);
    fire = false;
    audio.pause();
    $('result-panel').hidden = false;
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
      button(txt('Fly this challenge', 'Виконати це завдання'), () => startFlight(current)),
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
    if (!flight || !$('flight-dialog').open) return;
    if (
      !replayProof &&
      $('flight-source').value === 'radio' &&
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
      !replayProof &&
      $('flight-source').value === 'radio' &&
      ['paused', 'disarmed'].includes(flight.snapshot().status) &&
      radio.status().verified &&
      doc.visibilityState !== 'hidden' &&
      (!doc.hasFocus || doc.hasFocus()) &&
      !doc.querySelector('dialog[open]:not(#flight-dialog)')
    ) {
      radio.poll();
      if (radio.status().active && flight) {
        input.enable(true);
        flight.arm();
        fire = false;
        accumulator = 0;
        $('flight-status').textContent = txt('Flight active.', 'Політ триває.');
      }
    }
    if (flight.snapshot().status === 'active') {
      accumulator += elapsed * (replayProof ? replayRate : 1);
      while (accumulator >= 20 && flight.snapshot().status === 'active') {
        accumulator -= 20;
        let controls =
          !replayProof && $('flight-source').value === 'radio' ? radio.poll() : input.sample(0.02);
        if (replayProof) {
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
            : { ...controls, actions: replayProof ? replayProof.frames[before][4] : fire ? 1 : 0 },
        );
        if (flight.snapshot().ticks > before) {
          if (current.legacy) recorder.record(controls);
          else recorder.record();
          sectors.consume(flight.snapshot());
          if (flight.snapshot().ticks % 250 === 0) void saveRecovery().catch(reportError);
        }
      }
    }
    const state = flight.snapshot();
    audio.update(state, { active: state.status === 'active' });
    renderer?.draw?.(state, {
      cameraMode: $('flight-camera').value,
      cameraFov: Number($('world-fov').value),
      cameraTilt: Number($('world-tilt').value),
    });
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
  async function startFlight(entry, options = {}) {
    if (disposed) return;
    const token = ++flightToken;
    abortSectorLookup();
    sceneReady = false;
    pauseFlight();
    await saveRecovery();
    await ready;
    if (disposed || token !== flightToken) return;
    radio.reset({ notify: false });
    flight?.dispose?.();
    flight = null;
    current = entry;
    preview = Boolean(options.replayProof) || (options.preview ?? false);
    playingPlaylist = options.playlist ?? null;
    playlistIndex = options.index ?? 0;
    finished = false;
    sceneReady = false;
    $('world-arm').disabled = true;
    replayProof = options.replayProof ? clone(options.replayProof) : null;
    replayKind = options.demonstration ? 'demonstration' : 'recording';
    $('world-replay-controls').hidden = !replayProof;
    $('world-replay-label').textContent =
      replayKind === 'demonstration'
        ? entry.legacy
          ? txt('ACADEMY DEMONSTRATION', 'ДЕМОНСТРАЦІЯ АКАДЕМІЇ')
          : txt('WORLD DEMONSTRATION', 'ДЕМОНСТРАЦІЯ СВІТУ')
        : txt('RECORDED FLIGHT', 'ЗАПИСАНИЙ ПОЛІТ');
    $('world-replay-rate').value = String(replayRate);
    $('flight-mode').disabled = Boolean(replayProof) && replayKind !== 'demonstration';
    $('flight-source').disabled = Boolean(replayProof);
    $('radio-setup-button').disabled = Boolean(replayProof);
    $('world-touch').hidden = Boolean(replayProof) || $('flight-source').value !== 'touch';
    sectors.reset();
    sectorReference = null;
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
    accumulator = 0;
    $('result-panel').hidden = true;
    $('flight-title').textContent = label(entry);
    $('flight-collection').textContent = replayProof
      ? $('world-replay-label').textContent
      : preview
        ? txt('AUTHORING PREVIEW', 'АВТОРСЬКИЙ ПЕРЕГЛЯД')
        : localized(WORLD_THEMES.find((t) => t.id === entry.theme)?.title) || entry.world;
    $('flight-brief').textContent = entry.course.locales[locale].brief;
    $('flight-status').textContent = txt('Preparing scene…', 'Підготовка сцени…');
    if (!$('flight-dialog').open) $('flight-dialog').showModal();
    if (!renderer)
      renderer = rendererFactory({
        canvas: $('world-canvas'),
        window: win,
        onContextLost: () => {
          sceneReady = false;
          pauseFlight();
          $('flight-status').textContent = txt(
            'Graphics context lost. Retry after graphics recover.',
            'Графічний контекст втрачено. Спробуйте знову після відновлення графіки.',
          );
        },
        reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      });
    if (!renderer.available)
      throw new Error(
        txt('WebGL is unavailable in this browser.', 'WebGL недоступний у цьому браузері.'),
      );
    if (!entry.legacy) await initWorldRuntime();
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
    if (options.recover) {
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
      });
      recorder = (entry.legacy ? createFlightRecorder : createWorldRecorder)(flight, {
        session: replayProof
          ? replayKind === 'demonstration'
            ? 'demonstration'
            : 'replay'
          : preview
            ? 'authoring'
            : 'practice',
      });
    }
    renderer.setCourse(entry.course, $('flight-mode').value);
    audio.setCourse(entry.course);
    renderer.setQuality($('flight-quality').value);
    renderer.setDrone($('drone-look').value);
    let model = null;
    if (entry.projectId) {
      const pack =
        preview && editingProject?.id === entry.projectId
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
    sceneReady = true;
    $('flight-status').textContent = txt(
      'Ready. Choose your controls, then arm.',
      'Готово. Виберіть керування та натисніть «Увімкнути».',
    );
    input.select($('flight-source').value);
    restoreRadio();
    paintInput(flight.snapshot());
    updateHUD(flight.snapshot());
    $('world-viewport').focus();
    if (replayProof) {
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
  }
  async function closeFlight() {
    const token = ++flightToken;
    abortSectorLookup();
    sceneReady = false;
    pauseFlight();
    await saveRecovery();
    if (token !== flightToken || disposed) return;
    flight?.dispose?.();
    flight = null;
    current = null;
    $('flight-dialog').close();
    renderPacks();
  }
  async function restoreProofs(file) {
    if (!recordStore) throw new Error('Flight storage is unavailable.');
    if (file.size > 32 * 1024 * 1024) throw new Error('Flight archive exceeds 32 MiB.');
    const restored = await importProofPart(await file.text());
    let verifiedCount = 0;
    for (const saved of restored) {
      const entry = catalogue.find(
        (e) => e.id === saved.course?.id && e.packIdentity === saved.packIdentity,
      );
      let verification = 'missing-dependency',
        diagnostic = txt('Exact world pack is missing.', 'Точний пакунок світу відсутній.');
      if (entry) {
        try {
          const result = entry.legacy
            ? await replayFlightCooperatively(entry.course, saved.proof)
            : await replayWorldFlight(entry.course, saved.proof);
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
      await recordStore.put({
        course: saved.course,
        proof: saved.proof,
        packIdentity: saved.packIdentity,
        status: verification,
        diagnostic,
        pinned: saved.pinned ?? false,
      });
    }
    await refreshStorage();
    status(
      txt(
        `Restored ${restored.length} records; ${verifiedCount} verified. Missing and invalid records remain available for export.`,
        `Відновлено ${restored.length} записів; перевірено ${verifiedCount}. Неперевірені записи збережено для експорту.`,
      ),
    );
  }

  for (const b of doc.querySelectorAll('[data-tab]')) on(b, 'click', () => showTab(b.dataset.tab));
  for (const id of ['search', 'activity-filter', 'difficulty-filter', 'completion-filter'])
    on($(id), id === 'search' ? 'input' : 'change', renderCatalogue);
  on($('world-language'), 'change', () => {
    const previousLocale = locale;
    locale = $('world-language').value;
    if (playlistDraft && $('playlist-title').value === playlistDraft.title[previousLocale])
      $('playlist-title').value = localized(playlistDraft.title);
    paintLanguage();
    $('search').placeholder = txt('Find a world or challenge…', 'Знайти світ або завдання…');
    renderFilters();
    renderCatalogue();
    renderPlaylist();
    refreshEditor();
    renderPacks();
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
      for (const mode of ['self-level', 'acro']) {
        c.steps[mode].splice(editorIndex + 1, 0, clone(c.steps[mode][editorIndex]));
        bindings?.[mode]?.splice(editorIndex + 1, 0, null);
      }
      editorIndex++;
      editorSelection = { kind: 'criterion', index: editorIndex };
    }),
  );
  on($('remove-criterion'), 'click', () =>
    applyEdit((c, bindings) => {
      for (const mode of ['self-level', 'acro']) {
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
        editorIndex + delta >= editor.steps['self-level'].length
      )
        return;
      applyEdit((c, bindings) => {
        for (const mode of ['self-level', 'acro']) {
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
    return startFlight(customEntry(editor), { preview: true });
  });
  on($('export-challenge'), 'click', () => {
    if (!editor) throw new Error('Create a challenge first.');
    download(editor, `${editor.id}.json`);
  });
  on($('import-world'), 'change', (e) => importScene(e.target.files));
  on($('preview-world'), 'click', () => {
    syncProject();
    return startFlight(customEntry(editingProject.courses[0]), { preview: true });
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
    const loaded = /\.zip$/i.test(file.name)
      ? await importEditableZip(file)
      : await inspectPack(file);
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
    if (parts.length === 1) download(parts[0], 'fpv-flights-1-of-1.json');
    else {
      const links = el('div', undefined, 'button-row');
      links.id = 'backup-parts';
      parts.forEach((part, i) =>
        links.append(
          button(`${txt('Download part', 'Завантажити частину')} ${i + 1}/${parts.length}`, () =>
            download(part, `fpv-flights-${i + 1}-of-${parts.length}.json`),
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
  on($('prepare-runtime'), 'click', async () => {
    const result = await preparePracticeOffline({
      navigator: win.navigator,
      location: win.location,
      storage,
      packageId: 'fpv-worlds',
    });
    status(
      typeof result === 'string'
        ? result
        : txt(
            'Offline runtime preparation completed.',
            'Підготовку автономного запуску завершено.',
          ),
    );
  });
  on($('world-arm'), 'click', () => {
    if (!sceneReady || !flight || terminal(flight.snapshot()) || (replayProof && finished)) return;
    if (!replayProof && $('flight-source').value === 'radio') {
      restoreRadio();
      radio.poll();
      if (!radio.status().active && !radio.requestArm()) {
        paintInput(flight.snapshot());
        $('flight-status').textContent = radioHelp(radio.status().reason);
        return;
      }
    }
    input.enable(!replayProof);
    void audio.resume().catch(reportError);
    fire = false;
    lastTime = null;
    flight.arm();
    $('flight-status').textContent = replayProof
      ? txt('Playback active · no rewards.', 'Відтворення триває · без нагород.')
      : preview
        ? txt('Preview: completion does not earn rewards.', 'Перегляд: виконання не дає нагород.')
        : txt('Flight active.', 'Політ триває.');
    $('world-viewport').focus();
  });
  on($('world-pause'), 'click', () => pauseFlight());
  on($('world-retry'), 'click', () =>
    startFlight(current, {
      preview,
      playlist: playingPlaylist,
      index: playlistIndex,
      replayProof,
      demonstration: replayKind === 'demonstration',
    }),
  );
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
    if (![0.5, 1].includes(selected)) return;
    replayRate = selected;
    lastTime = null;
    accumulator = 0;
  });
  on($('world-next'), 'click', () => {
    if (playingPlaylist) return flySequence(playingPlaylist, playlistIndex + 1);
  });
  on($('leave-flight'), 'click', closeFlight);
  on($('flight-dialog'), 'cancel', (e) => {
    e.preventDefault();
    void closeFlight().catch(reportError);
  });
  on($('export-flight'), 'click', async () => {
    if (recorder && current) {
      const data = { course: current.course, proof: replayProof ?? recorder.export() },
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
    restoreRadio();
    paintInput(flight?.snapshot());
  });
  on($('flight-mode'), 'change', () => {
    if (replayProof) {
      if (replayKind === 'demonstration') return watchDemonstration(current);
      $('flight-mode').value = replayProof.mode;
      return;
    }
    if (current)
      return startFlight(current, { preview, playlist: playingPlaylist, index: playlistIndex });
  });
  on($('flight-stick-display'), 'change', () => paintInput(flight?.snapshot()));
  on($('flight-quality'), 'change', () => renderer?.setQuality?.($('flight-quality').value));
  on($('drone-look'), 'change', () => renderer?.setDrone?.($('drone-look').value));
  on($('world-fire'), 'pointerdown', (e) => {
    e.preventDefault();
    if (!replayProof && flight?.snapshot().status === 'active') {
      fireReleaseRequired = false;
      fire = true;
      $('world-fire').setPointerCapture?.(e.pointerId);
    }
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
    on($('world-fire'), event, () => {
      fire = false;
      fireReleaseRequired = false;
    });
  on(win, 'keydown', (e) => {
    if (
      !$('flight-dialog').open ||
      $('world-radio-dialog').open ||
      /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)
    )
      return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (
        !replayProof &&
        !e.repeat &&
        !fireReleaseRequired &&
        flight?.snapshot().status === 'active'
      )
        fire = true;
    }
    if (e.code === 'KeyP') {
      e.preventDefault();
      pauseFlight();
    }
  });
  on(win, 'keyup', (e) => {
    if (e.code === 'Space') {
      fire = false;
      fireReleaseRequired = false;
    }
  });
  on($('radio-setup-button'), 'click', () => {
    if (replayProof) return;
    pauseFlight();
    radioSetup?.dispose();
    radioSetup = mountRadioSetup({
      container: $('world-radio-setup'),
      window: win,
      runtime: radio,
      locale,
      onResponse: (rates) => {
        response = rates;
        if (current)
          void startFlight(current, {
            preview,
            playlist: playingPlaylist,
            index: playlistIndex,
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
  }
  on($('close-radio'), 'click', closeRadio);
  on($('world-radio-dialog'), 'cancel', (e) => {
    e.preventDefault();
    closeRadio();
  });
  on(win, 'gamepadconnected', () => restoreRadio());
  on(win, 'gamepaddisconnected', (e) => radio.disconnect(e.gamepad.index));
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
  for (const id of preferenceIds) on($(id), 'change', savePreferences);
  paintLanguage();
  paintInput(null);
  renderFilters();
  renderCatalogue();
  renderPlaylist();
  void cloneChallenge(catalogue.find((e) => !e.legacy)).catch(reportError);
  raf = win.requestAnimationFrame(frame);
  return {
    ready,
    startFlight,
    pause: pauseFlight,
    snapshot: () => ({
      course: current?.id,
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
      records: clone(records),
      catalogue: catalogue.length,
      radio: radio.status(),
      inputDisplay: {
        source: $('world-touch').dataset.source,
        style: $('flight-stick-display').value,
      },
    }),
    async dispose() {
      if (disposed) return;
      disposed = true;
      ++flightToken;
      abortSectorLookup();
      pauseFlight();
      await saveRecovery();
      win.cancelAnimationFrame(raf);
      for (const remove of listeners) remove();
      input.dispose();
      radioSetup?.dispose();
      flight?.dispose?.();
      renderer?.dispose();
      hangar.dispose();
      actorEditor?.dispose();
      audio.dispose();
      spatialEditor?.dispose();
      await notebook.close();
      recordStore?.close();
      worldStore?.close();
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
