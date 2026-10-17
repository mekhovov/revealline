import * as THREE from './vendor/three.module.js';
import { createAdvancedWorkerClient } from './advanced-worker-client.mjs';
import { createRateProfile, validateRateProfile } from './rates.mjs';
import {
  ADVANCED_RECORDING_BYTES,
  createAdvancedAircraftTune,
  validateAdvancedAircraft,
} from './advanced-simulation.mjs';
import { validateAdvancedTune } from './advanced-controller.mjs';
import { exportJSONFile, onNativeInactive } from '../../game/platform.mjs';

const COPY = {
  en: {
    title: 'Advanced reference practice',
    warning:
      'Experimental · unscored. The independent controller and reference aircraft are awaiting device, measurement and pilot qualification.',
    start: 'Start practice',
    pause: 'Pause',
    reset: 'Restart practice',
    close: 'Return to tuning',
    loading: 'Preparing the reference aircraft…',
    ready: 'Ready. Start explicitly when your controls are centred and throttle is low.',
    paused: 'Paused. Start explicitly to continue.',
    unavailable: 'Advanced practice is unavailable:',
    controls:
      'Arrow keys: pitch/roll · A/D: yaw · W/S: throttle · Escape: pause. Touch controls are below. The supplied radio calibration is used when a radio is connected.',
    roll: 'Roll',
    pitch: 'Pitch',
    yaw: 'Yaw',
    throttle: 'Throttle',
    aircraft: 'Aircraft template',
    freestyle: 'Freestyle',
    whoop: 'Whoop',
    racing: 'Racing',
    input: 'Input source',
    keyboard: 'Keyboard / touch',
    radio: 'Calibrated radio',
    height: 'Height',
    speed: 'Speed',
    requested: 'Requested',
    achieved: 'Achieved',
    age: 'Consumed sample age (simulation time)',
    browserAge: 'Browser poll sample age',
    polling: 'Observed browser polling',
    unknown: 'Device hardware cadence: unavailable',
    slow: 'The simulation is running slowly. Practice is paused; rendering quality does not change the physics frequency.',
    failure: 'Practice stopped:',
    durationLimit:
      'The flight reached its duration limit. Export or keep this practice as a reference, then restart for a new flight.',
    recordingLimit:
      'The recording reached its capacity limit. Export or keep this practice as a reference, then restart for a new flight.',
    low: 'Lower throttle before starting.',
    vertical: 'Camera FOV is vertical.',
    record: 'Export practice recording',
    tuning: 'Aircraft and controller tuning',
    tuningHelp:
      'Aircraft values use SI units. Controller gains belong to this SIM; they are not Betaflight PID numbers. Changes stay in the draft until you restart. Saving keeps them for the next flight.',
    saveConfiguration: 'Save aircraft for next flight',
    savedConfiguration:
      'Aircraft and controller saved for the next flight. This attempt is unchanged.',
    draftConfiguration: 'Draft changed. Restart practice to test it.',
    invalidConfiguration: 'Check the aircraft or controller values:',
    exportConfiguration: 'Export aircraft and controller',
    thrustRatio: 'Nominal maximum thrust / weight',
    graphicsLost: 'Graphics became unavailable. Practice is paused until rendering recovers.',
    graphicsRestored: 'Graphics recovered. Start explicitly to continue practice.',
    exportRequested: 'Download requested. Check your downloads or Save dialog.',
    exportShared: 'Shared with the selected app. Check the destination for your file.',
    exportCancelled: 'Sharing cancelled. No destination was confirmed.',
    exportFailed: 'Could not export:',
    comparison: 'Unscored comparison',
    comparisonHelp:
      'Import a reference-arena recording or keep this practice. Its complete replay is checked in a separate worker. Rotation rates may differ; aircraft, controller, throttle, timing and arena must match. The cyan ghost has no collisions or score.',
    importComparison: 'Import comparison recording',
    keepComparison: 'Keep this practice as reference',
    clearComparison: 'Clear reference',
    cancelComparison: 'Cancel verification',
    showComparison: 'Show verified ghost',
    checkingComparison: 'Checking the complete recording… Practice is paused.',
    comparisonReady: 'Verified reference ready. Restart practice for the same launch point.',
    comparisonFailed: 'Comparison unavailable:',
    comparisonEmpty: 'No reference selected.',
    comparisonCancelled: 'Verification cancelled. The previous reference is unchanged.',
    comparisonEnded: 'Reference finished; ghost holds its final position.',
    comparisonMismatch:
      'This aircraft setup uses a different comparison class. Restore the setup or choose another reference.',
    positionGap: 'Position gap at the same flight time',
    maneuver: 'Repeatable practice',
    maneuverHelp:
      'Choose a short exercise, then restart from the same launch point. Follow the cues manually; no controls or scores are automated. Keep a reference or export it before returning to edit rates.',
    free: 'Free practice',
    hover: 'Hover and land',
    turn: 'Turn and stop',
    pulse: 'Throttle pulse',
    completeManeuver:
      'Exercise finished. Pause to compare, keep this reference, or return to tuning to save or revert your draft.',
    revertConfiguration: 'Revert aircraft draft',
    revertedConfiguration:
      'Aircraft draft restored to its last saved values. Restart to test them.',
  },
  uk: {
    title: 'Практика з розширеною моделлю',
    warning:
      'Експериментально · без заліку. Незалежний контролер і еталонний дрон ще потребують перевірки на пристроях, вимірювань і оцінки пілотів.',
    start: 'Почати практику',
    pause: 'Пауза',
    reset: 'Почати заново',
    close: 'Повернутися до налаштувань',
    loading: 'Підготовка еталонного дрона…',
    ready: 'Готово. Почніть, коли стіки центровані, а газ знижено.',
    paused: 'Пауза. Натисніть «Почати», щоб продовжити.',
    unavailable: 'Розширена практика недоступна:',
    controls:
      'Стрілки: тангаж/крен · A/D: рискання · W/S: газ · Escape: пауза. Нижче — сенсорні елементи. Для підключеного пульта використовується його калібрування.',
    roll: 'Крен',
    pitch: 'Тангаж',
    yaw: 'Рискання',
    throttle: 'Газ',
    aircraft: 'Тип дрона',
    freestyle: 'Фристайл',
    whoop: 'Вуп',
    racing: 'Перегони',
    input: 'Джерело керування',
    keyboard: 'Клавіатура / дотик',
    radio: 'Калібрований пульт',
    height: 'Висота',
    speed: 'Швидкість',
    requested: 'Запитано',
    achieved: 'Досягнуто',
    age: 'Вік використаного зразка (час симуляції)',
    browserAge: 'Вік зразка опитування браузера',
    polling: 'Спостережена частота опитування браузера',
    unknown: 'Апаратна частота пульта: недоступна',
    slow: 'Симуляція працює повільно. Практику призупинено; якість зображення не змінює частоту фізики.',
    failure: 'Практику зупинено:',
    durationLimit:
      'Досягнуто обмеження тривалості польоту. Експортуйте або збережіть цю практику як орієнтир, потім почніть новий політ.',
    recordingLimit:
      'Досягнуто обмеження обсягу запису. Експортуйте або збережіть цю практику як орієнтир, потім почніть новий політ.',
    low: 'Знизьте газ перед стартом.',
    vertical: 'Кут огляду камери — вертикальний.',
    record: 'Експортувати запис практики',
    tuning: 'Налаштування дрона й контролера',
    tuningHelp:
      'Параметри дрона подано в одиницях SI. Коефіцієнти контролера належать цьому SIM, це не PID Betaflight. Зміни залишаються в чернетці до перезапуску. Збереження застосовує їх до наступного польоту.',
    saveConfiguration: 'Зберегти дрон для наступного польоту',
    savedConfiguration:
      'Дрон і контролер збережено для наступного польоту. Поточна спроба не змінена.',
    draftConfiguration: 'Чернетку змінено. Перезапустіть практику, щоб перевірити її.',
    invalidConfiguration: 'Перевірте параметри дрона або контролера:',
    exportConfiguration: 'Експортувати дрон і контролер',
    thrustRatio: 'Номінальна максимальна тяга / вага',
    graphicsLost: 'Зображення стало недоступним. Практику призупинено до відновлення графіки.',
    graphicsRestored: 'Графіку відновлено. Натисніть «Почати», щоб продовжити практику.',
    exportRequested: 'Завантаження запитано. Перевірте завантаження або вікно збереження.',
    exportShared: 'Передано вибраному застосунку. Перевірте файл у місці призначення.',
    exportCancelled: 'Поширення скасовано. Місце призначення не підтверджено.',
    exportFailed: 'Не вдалося експортувати:',
    comparison: 'Порівняння без заліку',
    comparisonHelp:
      'Імпортуйте запис еталонної арени або збережіть цю практику як орієнтир. Повне відтворення перевіряється в окремому воркері. Рейти обертання можуть відрізнятися; дрон, контролер, газ, частота та арена мають збігатися. Блакитна примара не має зіткнень чи оцінки.',
    importComparison: 'Імпортувати запис для порівняння',
    keepComparison: 'Залишити цю практику як орієнтир',
    clearComparison: 'Прибрати орієнтир',
    cancelComparison: 'Скасувати перевірку',
    showComparison: 'Показати перевірену примару',
    checkingComparison: 'Перевірка повного запису… Практику призупинено.',
    comparisonReady: 'Перевірений орієнтир готовий. Перезапустіть практику з тієї самої точки.',
    comparisonFailed: 'Порівняння недоступне:',
    comparisonEmpty: 'Орієнтир не вибрано.',
    comparisonCancelled: 'Перевірку скасовано. Попередній орієнтир не змінено.',
    comparisonEnded: 'Орієнтир завершено; примара залишається в кінцевій позиції.',
    comparisonMismatch:
      'Ці налаштування дрона належать до іншого класу порівняння. Відновіть налаштування або виберіть інший орієнтир.',
    positionGap: 'Відстань між позиціями в той самий час польоту',
    maneuver: 'Повторювана практика',
    maneuverHelp:
      'Виберіть коротку вправу й перезапустіть із тієї самої точки. Виконуйте підказки самостійно; автоматичного керування чи оцінки немає. Залиште орієнтир або експортуйте його перед поверненням до зміни рейтів.',
    free: 'Вільна практика',
    hover: 'Зависання й посадка',
    turn: 'Поворот і зупинка',
    pulse: 'Імпульс газу',
    completeManeuver:
      'Вправу завершено. Призупиніть для порівняння, залиште орієнтир або поверніться до налаштувань, щоб зберегти чи скасувати чернетку.',
    revertConfiguration: 'Скасувати чернетку дрона',
    revertedConfiguration:
      'Чернетку дрона відновлено до останніх збережених значень. Перезапустіть для перевірки.',
  },
};

/** A bounded reference arena for evaluating draft rates. It never creates a
 * mission proof or leaderboard record. The caller keeps its editor draft. */
export function mountAdvancedPractice({
  container,
  window: win = container.ownerDocument.defaultView,
  locale = 'en',
  profile = createRateProfile(),
  camera = {},
  configuration,
  onSaveConfiguration,
  getControls = () => null,
  onClose = () => {},
  onPause = () => {},
  Worker: WorkerClass = win.Worker,
  workerURL,
  rendererFactory = (options) => new THREE.WebGLRenderer(options),
  platformOptions = {},
}) {
  const copy = COPY[locale] ?? COPY.en,
    doc = container.ownerDocument;
  const frozenProfile = validateRateProfile(profile);
  let draftConfiguration = {
    aircraft: validateAdvancedAircraft(configuration?.aircraft ?? 'freestyle'),
    controller: validateAdvancedTune(
      configuration?.controller ??
        createAdvancedAircraftTune(configuration?.aircraft ?? 'freestyle'),
    ),
  };
  let savedConfiguration = structuredClone(draftConfiguration),
    activeOptions = null,
    activeComparison = null,
    comparison = null,
    verificationClient = null,
    verifying = false,
    verificationGeneration = 0;
  let disposed = false,
    client,
    renderer,
    frame,
    timer,
    running = false,
    busy = false,
    initialized = false,
    flightStopCode = null,
    graphicsLost = false,
    telemetry = null,
    sequence = 0,
    generation = 0,
    lastRender = 0,
    lastPollAt = null,
    lastConsumedPollAt = null,
    observedPollHz = null;
  let removeNativeInactive = null,
    exporting = false,
    savingConfiguration = false;
  const fileOptions = {
    locationRef: win.location,
    documentRef: doc,
    URLImpl: win.URL,
    BlobImpl: win.Blob,
    schedule: win.setTimeout?.bind(win),
    ...platformOptions,
  };
  const keys = new Set(),
    controls = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  const listeners = [];
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  };
  const el = (tag, text, parent = root) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  };
  const root = doc.createElement('section');
  root.className = 'fpv-advanced-practice';
  root.setAttribute('aria-label', copy.title);
  container.append(root);
  root.style.cssText =
    'display:grid;gap:12px;max-width:960px;margin:auto;padding:16px;background:#10202b;color:#edf5ff;border-radius:12px';
  el('h2', copy.title);
  el('p', copy.warning);
  el('p', `${copy.controls} ${copy.vertical}`);
  const status = el('p', copy.loading);
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const canvas = el('canvas');
  canvas.style.cssText = 'width:100%;height:min(50vh,460px);background:#0f1722;display:block';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', copy.title);
  const readouts = el('output');
  readouts.style.cssText = 'font:14px monospace;white-space:pre-wrap';
  const tools = el('div');
  tools.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const start = el('button', copy.start, tools),
    pauseButton = el('button', copy.pause, tools),
    reset = el('button', copy.reset, tools),
    close = el('button', copy.close, tools),
    download = el('button', copy.record, tools);
  for (const button of [start, pauseButton, reset, close, download]) button.type = 'button';
  start.disabled = true;
  pauseButton.disabled = true;
  reset.disabled = true;
  download.disabled = true;
  const settings = el('div');
  settings.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap';
  const aircraftLabel = el('label', `${copy.aircraft} `, settings),
    aircraft = el('select', '', aircraftLabel);
  for (const id of ['freestyle', 'whoop', 'racing']) {
    const option = el('option', copy[id], aircraft);
    option.value = id;
  }
  aircraft.value = ['freestyle', 'whoop', 'racing'].includes(draftConfiguration.aircraft.id)
    ? draftConfiguration.aircraft.id
    : 'freestyle';
  const inputLabel = el('label', `${copy.input} `, settings),
    input = el('select', '', inputLabel);
  for (const [id, label] of [
    ['keyboard', copy.keyboard],
    ['radio', copy.radio],
  ]) {
    const option = el('option', label, input);
    option.value = id;
  }
  const maneuverLabel = el('label', `${copy.maneuver} `, settings),
    maneuver = el('select', '', maneuverLabel);
  for (const id of ['free', 'hover', 'turn', 'pulse']) {
    const option = el('option', copy[id], maneuver);
    option.value = id;
  }
  maneuver.value = 'free';
  el('p', copy.maneuverHelp);
  const maneuverCue = el('output');
  maneuverCue.setAttribute('aria-label', copy.maneuver);
  const comparisonPanel = el('details');
  el('summary', copy.comparison, comparisonPanel);
  el('p', copy.comparisonHelp, comparisonPanel);
  const comparisonFileLabel = el('label', `${copy.importComparison} `, comparisonPanel),
    comparisonFile = el('input', '', comparisonFileLabel);
  comparisonFile.type = 'file';
  comparisonFile.disabled = true;
  comparisonFile.accept = '.json,application/json';
  comparisonFile.setAttribute('aria-label', copy.importComparison);
  const comparisonTools = el('div', '', comparisonPanel);
  comparisonTools.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const keepComparison = el('button', copy.keepComparison, comparisonTools),
    clearComparison = el('button', copy.clearComparison, comparisonTools),
    cancelComparison = el('button', copy.cancelComparison, comparisonTools);
  for (const button of [keepComparison, clearComparison, cancelComparison]) button.type = 'button';
  keepComparison.disabled = true;
  cancelComparison.hidden = true;
  const showComparisonLabel = el('label', `${copy.showComparison} `, comparisonPanel),
    showComparison = el('input', '', showComparisonLabel);
  showComparison.type = 'checkbox';
  showComparison.checked = true;
  showComparison.setAttribute('aria-label', copy.showComparison);
  const comparisonStatus = el('p', copy.comparisonEmpty, comparisonPanel);
  comparisonStatus.setAttribute('role', 'status');
  comparisonStatus.setAttribute('aria-live', 'polite');
  const comparisonInfo = el('output', '', comparisonPanel);
  const touch = el('div');
  const sliders = {};
  touch.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px';
  for (const axis of ['roll', 'pitch', 'yaw', 'throttle']) {
    const label = el('label', copy[axis], touch),
      slider = el('input', '', label);
    slider.type = 'range';
    slider.min = axis === 'throttle' ? '0' : '-1';
    slider.max = '1';
    slider.step = '0.01';
    slider.value = '0';
    slider.style.width = '100%';
    slider.setAttribute('aria-label', copy[axis]);
    sliders[axis] = slider;
    listen(slider, 'input', () => {
      controls[axis] = Number(slider.value);
    });
    if (axis !== 'throttle')
      listen(slider, 'change', () => {
        controls[axis] = 0;
        slider.value = '0';
      });
  }
  const tuning = el('details');
  el('summary', copy.tuning, tuning);
  el('p', copy.tuningHelp, tuning);
  const tunePreview = el('p', '', tuning);
  tunePreview.setAttribute('role', 'status');
  const tuneFields = el('div', '', tuning);
  tuneFields.style.cssText =
    'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px';
  const fieldInputs = [];
  const numericFields = [
    ['aircraft.mass', 'Mass (kg)', 'Маса (кг)', 0.01, 10],
    [
      'aircraft.armLength',
      'Motor distance from centre (m)',
      'Відстань мотора від центра (м)',
      0.01,
      1,
    ],
    ['aircraft.radius', 'Collision radius (m)', 'Радіус зіткнення (м)', 0.01, 1],
    [
      'aircraft.maxThrust',
      'Thrust per motor at nominal voltage (N)',
      'Тяга мотора за номінальної напруги (Н)',
      0.01,
      100,
    ],
    [
      'aircraft.reactionTorque',
      'Reaction torque / thrust (m)',
      'Реактивний момент / тяга (м)',
      0.001,
      1,
    ],
    ['aircraft.motorTimeConstant', 'Motor response time (s)', 'Час реакції мотора (с)', 0.001, 1],
    [
      'aircraft.motorOutputLimit',
      'Motor output limit (0–1)',
      'Обмеження потужності моторів (0–1)',
      0.1,
      1,
    ],
    ['aircraft.linearDrag', 'Linear drag (N·s/m)', 'Лінійний опір (Н·с/м)', 0, 10],
    ['aircraft.quadraticDrag', 'Quadratic drag (N·s²/m²)', 'Квадратичний опір (Н·с²/м²)', 0, 10],
    ['aircraft.angularDrag', 'Angular drag (N·m·s/rad)', 'Кутовий опір (Н·м·с/рад)', 0, 10],
    [
      'aircraft.sensorNoise',
      'Gyro noise amplitude (rad/s)',
      'Амплітуда шуму гіроскопа (рад/с)',
      0,
      5,
    ],
    [
      'aircraft.vibration',
      'Gyro vibration amplitude (rad/s)',
      'Амплітуда вібрації гіроскопа (рад/с)',
      0,
      5,
    ],
    [
      'aircraft.battery.nominalVoltage',
      'Nominal battery voltage (V)',
      'Номінальна напруга батареї (В)',
      1,
      100,
    ],
    [
      'aircraft.battery.fullVoltage',
      'Full battery voltage (V)',
      'Напруга зарядженої батареї (В)',
      1,
      100,
    ],
    [
      'aircraft.battery.emptyVoltage',
      'Empty battery voltage (V)',
      'Напруга розрядженої батареї (В)',
      1,
      100,
    ],
    ['aircraft.battery.resistance', 'Battery resistance (Ω)', 'Опір батареї (Ω)', 0, 10],
    [
      'aircraft.battery.fullCurrent',
      'Full motor current (A)',
      'Струм моторів на повній потужності (А)',
      0,
      1000,
    ],
    ['aircraft.battery.capacityAh', 'Battery capacity (Ah)', 'Ємність батареї (А·год)', 0.01, 100],
    [
      'controller.gyroFilterHz',
      'Gyro low-pass cutoff (Hz; 0 off)',
      'Частота фільтра гіроскопа (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.dTermFilterHz',
      'D-term low-pass cutoff (Hz; 0 off)',
      'Частота фільтра D (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.inputSmoothingHz',
      'Input smoothing cutoff (Hz; 0 off)',
      'Частота згладжування входу (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.feedforwardFilterHz',
      'Feedforward low-pass cutoff (Hz; 0 off)',
      'Частота фільтра випередження (Гц; 0 вимк.)',
      0,
      1000,
    ],
    [
      'controller.integralLimit',
      'Integral torque limit (N·m)',
      'Обмеження інтегрального моменту (Н·м)',
      0,
      1,
    ],
    [
      'controller.antiWindup',
      'Anti-windup recovery (1/s)',
      'Відновлення інтегратора (1/с)',
      0,
      100,
    ],
  ];
  for (const [axis, labelEn, labelUk] of [
    ['x', 'Pitch', 'Тангаж'],
    ['y', 'Yaw', 'Рискання'],
    ['z', 'Roll', 'Крен'],
  ])
    numericFields.push([
      `aircraft.inertia.${axis}`,
      `${labelEn} inertia (kg·m²)`,
      `Інерція: ${labelUk} (кг·м²)`,
      0.000001,
      10,
    ]);
  for (const axis of ['roll', 'pitch', 'yaw'])
    for (const [key, unit] of [
      ['p', 'N·m/(rad/s)'],
      ['i', 'N·m/rad'],
      ['d', 'N·m/(rad/s²)'],
      ['feedforward', 'N·m/(rad/s²)'],
    ])
      numericFields.push([
        `controller.gains.${axis}.${key}`,
        `${COPY.en[axis]} ${key.toUpperCase()} (${unit})`,
        `${COPY.uk[axis]} ${key.toUpperCase()} (${unit})`,
        0,
        1,
      ]);
  for (const [path, en, uk, min, max] of numericFields) {
    const label = el('label', locale === 'uk' ? uk : en, tuneFields),
      field = el('input', '', label);
    field.type = 'number';
    field.min = String(min);
    field.max = String(max);
    field.step = 'any';
    field.style.cssText = 'display:block;width:100%;box-sizing:border-box';
    fieldInputs.push({ path: path.split('.'), field });
    listen(field, 'input', () => {
      tunePreview.textContent = copy.draftConfiguration;
    });
  }
  function fillTuning() {
    for (const { path, field } of fieldInputs)
      field.value = String(path.reduce((value, part) => value[part], draftConfiguration));
    tunePreview.textContent = `${copy.thrustRatio}: ${((draftConfiguration.aircraft.maxThrust * 4) / (draftConfiguration.aircraft.mass * 9.81)).toFixed(2)} · ${copy.draftConfiguration}`;
  }
  function readTuning() {
    const next = structuredClone(draftConfiguration);
    for (const { path, field } of fieldInputs) {
      const parent = path.slice(0, -1).reduce((value, part) => value[part], next);
      parent[path.at(-1)] = field.value.trim() ? Number(field.value) : Number.NaN;
    }
    return {
      aircraft: validateAdvancedAircraft(next.aircraft),
      controller: validateAdvancedTune(next.controller),
    };
  }
  const tuneButtons = el('div', '', tuning);
  tuneButtons.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px';
  const saveTuning = el('button', copy.saveConfiguration, tuneButtons),
    revertTuning = el('button', copy.revertConfiguration, tuneButtons),
    exportTuning = el('button', copy.exportConfiguration, tuneButtons);
  saveTuning.type = 'button';
  revertTuning.type = 'button';
  exportTuning.type = 'button';
  exportTuning.disabled = true;
  saveTuning.hidden = typeof onSaveConfiguration !== 'function';
  listen(saveTuning, 'click', async () => {
    if (disposed || savingConfiguration) return;
    try {
      const next = readTuning();
      savingConfiguration = true;
      saveTuning.disabled = true;
      await onSaveConfiguration?.(structuredClone(next));
      if (!disposed) {
        savedConfiguration = structuredClone(next);
        let unchanged = false;
        try {
          unchanged = JSON.stringify(readTuning()) === JSON.stringify(next);
        } catch {
          // Incomplete edits remain a draft while the captured save completes.
        }
        if (unchanged) draftConfiguration = next;
        tunePreview.textContent = unchanged ? copy.savedConfiguration : copy.draftConfiguration;
      }
    } catch (error) {
      if (!disposed) tunePreview.textContent = `${copy.invalidConfiguration} ${error.message}`;
    } finally {
      savingConfiguration = false;
      if (!disposed) saveTuning.disabled = false;
    }
  });
  listen(revertTuning, 'click', () => {
    draftConfiguration = structuredClone(savedConfiguration);
    aircraft.value = draftConfiguration.aircraft.id;
    fillTuning();
    tunePreview.textContent = copy.revertedConfiguration;
  });
  async function exportData(value, name, output) {
    if (disposed || exporting || !initialized) return;
    exporting = true;
    download.disabled = true;
    exportTuning.disabled = true;
    pause();
    try {
      const data = typeof value === 'function' ? await value() : value;
      if (disposed) return;
      const result = await exportJSONFile(data, name, fileOptions);
      if (!disposed)
        output.textContent =
          result.status === 'shared'
            ? copy.exportShared
            : result.status === 'cancelled'
              ? copy.exportCancelled
              : copy.exportRequested;
    } catch (error) {
      if (!disposed) output.textContent = `${copy.exportFailed} ${error.message}`;
    } finally {
      exporting = false;
      if (!disposed) {
        exportTuning.disabled = false;
        download.disabled = !initialized;
      }
    }
  }
  listen(exportTuning, 'click', () => {
    try {
      void exportData(
        { format: 'AdvancedDroneConfiguration.v1', ...readTuning() },
        'advanced-drone-configuration.json',
        tunePreview,
      );
    } catch (error) {
      tunePreview.textContent = `${copy.invalidConfiguration} ${error.message}`;
    }
  });
  fillTuning();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x93bed2);
  scene.fog = new THREE.Fog(0x93bed2, 35, 130);
  const view = new THREE.PerspectiveCamera(
    Math.max(30, Math.min(150, Number(camera.fov) || 82)),
    1,
    0.02,
    180,
  );
  const geometry = [],
    materials = [];
  const obstacles = [];
  const mesh = (shape, material, position) => {
    geometry.push(shape);
    materials.push(material);
    const object = new THREE.Mesh(shape, material);
    object.position.set(...position);
    scene.add(object);
    return object;
  };
  mesh(
    new THREE.BoxGeometry(180, 0.1, 180),
    new THREE.MeshBasicMaterial({ color: 0x58784d }),
    [0, -0.05, 0],
  );
  const grid = new THREE.GridHelper(180, 90, 0x244e43, 0x7c9865);
  scene.add(grid);
  const ghost = new THREE.Group();
  ghost.name = 'advanced-comparison-ghost';
  ghost.visible = false;
  const ghostMaterial = new THREE.MeshBasicMaterial({
    color: 0x30e6ff,
    transparent: true,
    opacity: 0.65,
  });
  materials.push(ghostMaterial);
  for (const dimensions of [
    [0.6, 0.04, 0.06],
    [0.06, 0.04, 0.6],
  ]) {
    const shape = new THREE.BoxGeometry(...dimensions);
    geometry.push(shape);
    ghost.add(new THREE.Mesh(shape, ghostMaterial));
  }
  scene.add(ghost);
  for (let index = 0; index < 5; index++) {
    const z = -8 - index * 10;
    obstacles.push(
      {
        id: `gate-${index}-left`,
        min: { x: -2.075, y: 0, z: z - 0.075 },
        max: { x: -1.925, y: 4, z: z + 0.075 },
      },
      {
        id: `gate-${index}-right`,
        min: { x: 1.925, y: 0, z: z - 0.075 },
        max: { x: 2.075, y: 4, z: z + 0.075 },
      },
      {
        id: `gate-${index}-top`,
        min: { x: -2.075, y: 3.925, z: z - 0.075 },
        max: { x: 2.075, y: 4.075, z: z + 0.075 },
      },
    );
    mesh(new THREE.BoxGeometry(0.15, 4, 0.15), new THREE.MeshBasicMaterial({ color: 0xffd15c }), [
      -2,
      2,
      z,
    ]);
    mesh(new THREE.BoxGeometry(0.15, 4, 0.15), new THREE.MeshBasicMaterial({ color: 0xffd15c }), [
      2,
      2,
      z,
    ]);
    mesh(
      new THREE.BoxGeometry(4.15, 0.15, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xffd15c }),
      [0, 4, z],
    );
  }
  const tilt = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    (Math.max(-45, Math.min(85, Number(camera.tilt) || 0)) * Math.PI) / 180,
  );
  const maneuverSteps =
    locale === 'uk'
      ? {
          hover: [
            [5, 'Плавно підніміть газ і стабілізуйте висоту біля верхньої перекладини воріт.'],
            [10, 'Утримуйте висоту п’ять секунд малими корекціями.'],
            [15, 'Плавно знижуйте газ і приземліться.'],
          ],
          turn: [
            [5, 'Стабілізуйте зависання над точкою старту.'],
            [8, 'Виконайте один поворот за рисканням.'],
            [12, 'Центруйте рискання й спостерігайте за зупинкою обертання.'],
            [16, 'Стабілізуйте висоту й приземліться.'],
          ],
          pulse: [
            [5, 'Стабілізуйте зависання й запам’ятайте положення газу.'],
            [6, 'На одну секунду додайте приблизно 10% газу.'],
            [10, 'Поверніть газ у попереднє положення й спостерігайте за висотою.'],
            [15, 'Плавно знизьте газ і приземліться.'],
          ],
        }
      : {
          hover: [
            [5, 'Raise throttle gently and settle near the gate crossbar height.'],
            [10, 'Hold height for five seconds with small corrections.'],
            [15, 'Lower throttle gently and land.'],
          ],
          turn: [
            [5, 'Settle into a hover above the launch point.'],
            [8, 'Make one yaw turn.'],
            [12, 'Centre yaw and observe how rotation stops.'],
            [16, 'Settle the height and land.'],
          ],
          pulse: [
            [5, 'Settle into a hover and note the throttle position.'],
            [6, 'Add about 10% throttle for one second.'],
            [10, 'Return to the previous throttle position and observe the height.'],
            [15, 'Lower throttle gently and land.'],
          ],
        };
  function paintManeuver() {
    const steps = maneuverSteps[maneuver.value],
      seconds = telemetry?.seconds ?? 0;
    maneuverCue.textContent = steps
      ? `${seconds.toFixed(1)} s · ${steps.find(([end]) => seconds < end)?.[1] ?? copy.completeManeuver}`
      : '';
  }
  function paintComparison() {
    const compatible =
      comparison &&
      activeComparison &&
      comparison.comparison.comparisonClass === activeComparison.comparisonClass;
    ghost.visible = Boolean(compatible && showComparison.checked && telemetry);
    if (!comparison) {
      comparisonInfo.textContent = '';
      return;
    }
    if (!compatible) {
      comparisonInfo.textContent = copy.comparisonMismatch;
      return;
    }
    const point = comparison.path[Math.min(telemetry?.missionTick ?? 0, comparison.missionTicks)];
    ghost.position.set(point[1], point[2], point[3]);
    ghost.quaternion.set(point[4], point[5], point[6], point[7]);
    comparisonInfo.textContent =
      (telemetry?.missionTick ?? 0) > comparison.missionTicks
        ? copy.comparisonEnded
        : `${copy.positionGap}: ${Math.hypot((telemetry?.position.x ?? point[1]) - point[1], (telemetry?.position.y ?? point[2]) - point[2], (telemetry?.position.z ?? point[3]) - point[3]).toFixed(2)} m · ${((telemetry?.missionTick ?? 0) / 50).toFixed(2)} s`;
  }
  function cancelVerification() {
    verificationGeneration++;
    verificationClient?.dispose();
    verificationClient = null;
    verifying = false;
    cancelComparison.hidden = true;
    comparisonFile.disabled = !initialized;
    keepComparison.disabled = !initialized || !telemetry?.missionTick;
    start.disabled = !initialized || graphicsLost || Boolean(flightStopCode);
  }
  async function verifyReference(load) {
    if (disposed || !initialized || exporting) return;
    cancelVerification();
    const owner = verificationGeneration;
    const options = structuredClone(activeOptions);
    pause();
    verifying = true;
    start.disabled = true;
    keepComparison.disabled = true;
    comparisonFile.disabled = true;
    cancelComparison.hidden = false;
    comparisonStatus.textContent = copy.checkingComparison;
    try {
      const source = await load();
      if (disposed || owner !== verificationGeneration) return;
      verificationClient = createAdvancedWorkerClient({
        Worker: WorkerClass,
        url: workerURL,
      });
      await verificationClient.initialize(options);
      const checked = await verificationClient.verifyRecording(source);
      if (disposed || owner !== verificationGeneration) return;
      comparison = checked;
      comparisonStatus.textContent = copy.comparisonReady;
      paintComparison();
    } catch (error) {
      if (!disposed && owner === verificationGeneration)
        comparisonStatus.textContent = `${copy.comparisonFailed} ${error.message}`;
    } finally {
      if (!disposed && owner === verificationGeneration) cancelVerification();
    }
  }
  listen(comparisonFile, 'change', () => {
    const file = comparisonFile.files?.[0];
    if (!file) return;
    void verifyReference(async () => {
      if (!Number.isFinite(file.size) || file.size <= 0 || file.size > ADVANCED_RECORDING_BYTES)
        throw new Error('Recording exceeds the 8 MiB import limit.');
      const text = await file.text();
      if (new TextEncoder().encode(text).byteLength > ADVANCED_RECORDING_BYTES)
        throw new Error('Recording exceeds the 8 MiB import limit.');
      return text;
    });
    comparisonFile.value = '';
  });
  listen(keepComparison, 'click', () => {
    if (telemetry?.missionTick > 0) void verifyReference(() => client.recording());
  });
  listen(cancelComparison, 'click', () => {
    cancelVerification();
    comparisonStatus.textContent = copy.comparisonCancelled;
  });
  listen(clearComparison, 'click', () => {
    cancelVerification();
    comparison = null;
    comparisonStatus.textContent = copy.comparisonEmpty;
    paintComparison();
  });
  listen(showComparison, 'change', paintComparison);
  listen(maneuver, 'change', () => {
    pause();
    paintManeuver();
  });
  function pause(message = copy.paused) {
    if (disposed) return;
    running = false;
    win.clearTimeout(timer);
    keys.clear();
    for (const axis of ['roll', 'pitch', 'yaw']) {
      controls[axis] = 0;
      sliders[axis].value = '0';
    }
    lastPollAt = null;
    observedPollHz = null;
    pauseButton.disabled = true;
    start.disabled = !initialized || graphicsLost || verifying || Boolean(flightStopCode);
    aircraft.disabled = false;
    status.textContent =
      flightStopCode && initialized
        ? copy[flightStopCode === 'ADVANCED_DURATION_LIMIT' ? 'durationLimit' : 'recordingLimit']
        : message;
    onPause();
  }
  function failed(error) {
    initialized = false;
    pause(`${copy.failure} ${error.message}`);
    reset.disabled = true;
    download.disabled = true;
    exportTuning.disabled = true;
    keepComparison.disabled = true;
    comparisonFile.disabled = true;
  }
  function sampleControls() {
    if (input.value === 'radio') {
      const sample = getControls();
      if (
        !sample ||
        !['roll', 'pitch', 'yaw', 'throttle'].every((axis) => Number.isFinite(sample[axis]))
      )
        throw new Error(copy.unavailable);
      return {
        roll: Math.max(-1, Math.min(1, sample.roll)),
        pitch: Math.max(-1, Math.min(1, sample.pitch)),
        yaw: Math.max(-1, Math.min(1, sample.yaw)),
        throttle: Math.max(0, Math.min(1, sample.throttle)),
      };
    }
    controls.throttle = Math.max(
      0,
      Math.min(
        1,
        controls.throttle + (Number(keys.has('KeyW')) - Number(keys.has('KeyS'))) * 0.012,
      ),
    );
    return {
      roll:
        keys.has('ArrowRight') || keys.has('ArrowLeft')
          ? (Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'))) * 0.5
          : controls.roll,
      pitch:
        keys.has('ArrowUp') || keys.has('ArrowDown')
          ? (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * 0.5
          : controls.pitch,
      yaw:
        keys.has('KeyD') || keys.has('KeyA')
          ? (Number(keys.has('KeyD')) - Number(keys.has('KeyA'))) * 0.5
          : controls.yaw,
      throttle: controls.throttle,
    };
  }
  async function tick() {
    if (!running || disposed || busy) return;
    busy = true;
    const owner = generation,
      started = win.performance.now();
    try {
      if (lastPollAt !== null && started > lastPollAt)
        observedPollHz = 1000 / (started - lastPollAt);
      lastPollAt = started;
      const sample = {
        sequence: sequence++,
        timestampUs: Math.round((telemetry?.seconds ?? 0) * 1e6),
        controls: sampleControls(),
      };
      const result = await client.step(sample);
      if (disposed || owner !== generation) return;
      telemetry = result.telemetry;
      keepComparison.disabled = verifying || !telemetry.missionTick;
      if (telemetry.consumedSequence === sample.sequence) lastConsumedPollAt = started;
      const elapsed = win.performance.now() - started;
      if (elapsed > 250) pause(copy.slow);
      else if (running) timer = win.setTimeout(tick, Math.max(0, 20 - elapsed));
    } catch (error) {
      if (!disposed && owner === generation) {
        if (['ADVANCED_DURATION_LIMIT', 'ADVANCED_RECORDING_LIMIT'].includes(error.code)) {
          flightStopCode = error.code;
          pause();
        } else failed(error);
      }
    } finally {
      busy = false;
    }
  }
  async function initialize() {
    if (disposed || exporting) return;
    try {
      draftConfiguration = readTuning();
    } catch (error) {
      tunePreview.textContent = `${copy.invalidConfiguration} ${error.message}`;
      return;
    }
    cancelVerification();
    initialized = false;
    pause(copy.loading);
    start.disabled = true;
    reset.disabled = true;
    download.disabled = true;
    exportTuning.disabled = true;
    keepComparison.disabled = true;
    comparisonFile.disabled = true;
    generation++;
    const owner = generation;
    client?.dispose();
    sequence = 0;
    lastPollAt = null;
    lastConsumedPollAt = null;
    observedPollHz = null;
    for (const axis of ['roll', 'pitch', 'yaw', 'throttle']) {
      controls[axis] = 0;
      sliders[axis].value = '0';
    }
    try {
      client = createAdvancedWorkerClient({ Worker: WorkerClass, url: workerURL });
      const options = {
        aircraft: draftConfiguration.aircraft,
        controller: draftConfiguration.controller,
        rateProfile: frozenProfile,
        spawn: { x: 0, y: 1.5, z: 3 },
        obstacles,
      };
      const result = await client.initialize(options);
      if (disposed || owner !== generation) return;
      telemetry = result.telemetry;
      activeOptions = structuredClone(options);
      activeComparison = result.comparison;
      initialized = true;
      flightStopCode = null;
      status.textContent = copy.ready;
      start.disabled = graphicsLost;
      reset.disabled = false;
      download.disabled = false;
      exportTuning.disabled = false;
      comparisonFile.disabled = false;
      paintManeuver();
      paintComparison();
    } catch (error) {
      if (!disposed && owner === generation) failed(error);
    }
  }
  function draw(now) {
    if (disposed) return;
    const width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      view.aspect = width / height;
      view.updateProjectionMatrix();
    }
    if (telemetry) {
      view.position.copy(telemetry.position);
      view.quaternion.copy(telemetry.orientation).multiply(tilt);
      if (now - lastRender > 100) {
        const speed = Math.hypot(telemetry.velocity.x, telemetry.velocity.y, telemetry.velocity.z);
        readouts.textContent = `${copy.height}: ${telemetry.position.y.toFixed(1)} m · ${copy.speed}: ${speed.toFixed(1)} m/s · ${telemetry.voltage.toFixed(1)} V\n${copy.requested}: ${Object.values(
          telemetry.requestedRates,
        )
          .map((v) => v.toFixed(0))
          .join(' / ')} °/s · ${copy.achieved}: ${Object.values(telemetry.achievedRates)
          .map((v) => v.toFixed(0))
          .join(
            ' / ',
          )} °/s\n${copy.age}: ${telemetry.sampleAgeUs === null ? '—' : `${(telemetry.sampleAgeUs / 1000).toFixed(0)} ms`} · ${copy.browserAge}: ${lastConsumedPollAt === null ? '—' : `${Math.max(0, now - lastConsumedPollAt).toFixed(0)} ms`}\n${copy.polling}: ${observedPollHz === null ? '—' : `${observedPollHz.toFixed(1)} Hz`} · ${copy.unknown}`;
        lastRender = now;
      }
    }
    paintManeuver();
    paintComparison();
    renderer.render(scene, view);
    frame = win.requestAnimationFrame(draw);
  }
  listen(start, 'click', () => {
    if (!initialized || graphicsLost || disposed || exporting || verifying || flightStopCode)
      return;
    try {
      if (sampleControls().throttle > 0.1 && (telemetry?.missionTick ?? 0) === 0) {
        status.textContent = copy.low;
        return;
      }
      running = true;
      start.disabled = true;
      pauseButton.disabled = false;
      aircraft.disabled = true;
      status.textContent = copy.warning;
      canvas.focus();
      void tick();
    } catch (error) {
      failed(error);
    }
  });
  listen(pauseButton, 'click', () => pause());
  listen(reset, 'click', () => {
    void initialize();
  });
  listen(aircraft, 'change', () => {
    draftConfiguration = {
      aircraft: validateAdvancedAircraft(aircraft.value),
      controller: createAdvancedAircraftTune(aircraft.value),
    };
    fillTuning();
  });
  listen(input, 'change', () => pause());
  listen(close, 'click', () => {
    dispose();
    onClose();
  });
  listen(download, 'click', () => {
    if (disposed || exporting || !initialized) return;
    void exportData(() => client.recording(), 'advanced-practice.json', status);
  });
  listen(win, 'keydown', (event) => {
    if (event.code === 'Escape') {
      event.preventDefault();
      pause();
      return;
    }
    if (!running || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target?.tagName)) return;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(
        event.code,
      )
    ) {
      event.preventDefault();
      keys.add(event.code);
    }
  });
  listen(win, 'keyup', (event) => keys.delete(event.code));
  listen(win, 'blur', () => pause());
  listen(win, 'pagehide', () => pause());
  listen(canvas, 'webglcontextlost', (event) => {
    event.preventDefault();
    graphicsLost = true;
    pause(copy.graphicsLost);
  });
  listen(canvas, 'webglcontextrestored', () => {
    graphicsLost = false;
    pause(copy.graphicsRestored);
  });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) pause();
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    running = false;
    generation++;
    win.clearTimeout(timer);
    win.cancelAnimationFrame(frame);
    client?.dispose();
    verificationClient?.dispose();
    verificationClient = null;
    verificationGeneration++;
    if (removeNativeInactive) void Promise.resolve(removeNativeInactive()).catch(() => {});
    for (const cleanup of listeners) cleanup();
    for (const shape of geometry) shape.dispose();
    for (const material of materials) material.dispose();
    grid.geometry.dispose();
    if (Array.isArray(grid.material)) for (const material of grid.material) material.dispose();
    else grid.material.dispose();
    renderer?.dispose();
    root.remove();
  }
  try {
    renderer = rendererFactory({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    frame = win.requestAnimationFrame(draw);
    void onNativeInactive(() => pause(), fileOptions)
      .then((remove) => {
        if (disposed) return Promise.resolve(remove());
        removeNativeInactive = remove;
        return initialize();
      })
      .catch((error) => {
        if (!disposed) status.textContent = `${copy.unavailable} ${error.message}`;
      });
  } catch (error) {
    status.textContent = `${copy.unavailable} ${error.message}`;
  }
  return {
    dispose,
    pause,
    element: root,
    getTelemetry: () => (telemetry ? structuredClone(telemetry) : null),
    getComparison: () =>
      comparison
        ? {
            verified: comparison.verified,
            scored: false,
            comparisonClass: comparison.comparison.comparisonClass,
            missionTicks: comparison.missionTicks,
            samples: comparison.path.length,
            visible: ghost.visible,
            position: { x: ghost.position.x, y: ghost.position.y, z: ghost.position.z },
          }
        : null,
  };
}
