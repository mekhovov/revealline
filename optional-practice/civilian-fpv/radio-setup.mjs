import {
  radioControlLabel,
  createRadioSwitchCapture,
  createRadioBootstrap,
} from './radio-controls.mjs';
import { canonicalJSON } from '../../game/data-json.mjs';
import { restoreVerifiedRadio } from './radio-session.mjs';
import { mountRadioGuide } from './radio-guide.mjs';
import {
  DEFAULT_RESPONSE,
  FLIGHT_CONTROLS,
  RADIO_FORMAT,
  RADIO_LIBRARY_BYTES,
  radioProfileKey,
  radioSwitch,
  AXIS_RADIO_FORMAT,
  ACTION_RADIO_FORMAT,
  FIRE_RADIO_FORMAT,
  COMBAT_RADIO_FORMAT,
  RADIO_COMBAT_ACTIONS,
  RADIO_CONTROL_SWITCHES,
  RADIO_MODEL_CATALOGUE,
  RADIO_CHANNEL_PRESETS,
  radioDeviceRecommendation,
  loadRadioModelSelection,
  saveRadioModelSelection,
  createRadioControlLayout,
  validateRadioControlLayout,
  loadRadioControlLayout,
  saveRadioControlLayout,
  removeRadioControlLayout,
  STICK_LAYOUTS,
  createFlightProfileStore,
  defaultRadioProfile,
  normalizeRadioInput,
  radioDeviceIdentity,
  responseCurve,
  validateFlightResponse,
  validateRadioProfile,
} from './radio-profile.mjs';

const COPY = {
  en: {
    title: 'Radio setup',
    intro:
      'Connect a USB joystick radio, select joystick mode on the transmitter, then move a stick. This browser must receive an interaction before some devices appear. Check the live channels below before flying.',
    refresh: 'Find devices',
    none: 'No visible device — check USB joystick mode and interact with this page.',
    unavailable: 'Gamepad API unavailable or blocked in this browser.',
    device: 'Device',
    layout: 'Stick diagram (does not change channel assignments)',
    full: 'Radio: full travel, non-centring throttle',
    spring: 'Gamepad adaptation: centred throttle is 50%',
    raw: 'Live raw channels',
    control: 'Control',
    axis: 'Axis',
    minimum: 'Minimum',
    center: 'Centre',
    maximum: 'Maximum',
    invert: 'Reverse',
    deadZone: 'Dead zone',
    identify: 'Identify moving axis',
    use: 'Use moving axis',
    travel: 'Record full travel',
    stop: 'Finish travel',
    centre: 'Measure centre',
    verified: 'Stick channels are ready. Changes save automatically.',
    saved: 'Saved automatically on this device.',
    session: 'Session only — profile could not be saved.',
    response: 'Flight response — separate from calibration',
    curve: 'Simulator curve preview (input → output)',
    reset: 'Reset gentle response',
    apply: 'Apply response',
    export: 'Export profiles',
    import: 'Import profiles',
    profile: 'Profile JSON',
    rate: 'Maximum angular rate (degrees/second)',
    tilt: 'Self-level maximum tilt (degrees)',
    expo: 'Cubic blend (%)',
    ticks: 'Angular response (50 Hz steps)',
    sign: 'Positive: roll right, pitch forward, yaw right, throttle up. Radio-side mixes and curves still apply; use a simple simulator model on your radio.',
    incomplete: 'Finish assigning the sticks. Complete, valid changes save automatically.',
    ambiguous: 'Move only one control through at least one quarter of its travel, then try again.',
    switches: 'Radio switches and buttons (optional)',
    switchType: 'Switch input type',
    buttonChannel: 'Button channel',
    axisChannel: 'Axis channel',
    offPosition: 'OFF position',
    onPosition: 'ON position',
    captureSwitch: 'Identify switch / button',
    useSwitch: 'Cancel detection',
    switchStart:
      'Leave the switch OFF, start detection, then hold it ON and return OFF. Assignment finishes automatically. Use a maintained switch for Arm and a momentary button for Reset. For a three-position axis switch, use the opposite endpoint as ON.',
    switchMove:
      'Listening… leave OFF briefly, hold ON, then return OFF. Move only this switch. If nothing changes, assign it to a USB channel in your radio model.',
    switchReturn: 'ON detected. Return the switch OFF or release the button to finish.',
    switchAmbiguous:
      'Detection stopped. Keep this page focused, leave the switch OFF and try again. Flight stick axes cannot also be switches.',
    switchConflict:
      'This switch also operates another action. Choose a different switch or clear the previous assignment in advanced fields.',
    switchCaptured: 'Assigned and saved automatically. The live indicator follows your switch.',
    library: 'Saved radios',
    chooseSaved: 'Choose a saved calibration…',
    download: 'Download all radio profiles',
    share: 'Share this radio setup',
    file: 'Import a setup file',
    sharing:
      'Share the downloaded setup file with your radio model, firmware, USB mode and computer/browser. Shared mappings need a local direction and switch check. Files are never uploaded automatically.',
    imported:
      'Imported settings save automatically when valid. Check the live stick directions before flying.',
    responseUnchanged: 'Rates & throttle profiles remain unchanged.',
    responseIgnored:
      'Included flight response settings were not applied. Rates & throttle profiles remain unchanged.',
    threshold: 'Activation threshold',
    buttons: 'Buttons',
    arm: 'Arm/disarm — switch ON enables flight; OFF stops motors',
    pause: 'Pause — freeze flight until resumed',
    resetAction: 'Reset level — restart this drill at the launch pad',
    camera: 'View — switch ON, then OFF to cycle FPV / Chase / Overview',
    fire: 'Fire — release after arming, then hold to fire in combat',
    weapon: 'Switch weapon — release, then activate',
    reload: 'Reload — release, then activate',
    payload: 'Deploy / arm payload — release, then activate',
    detonate: 'Detonate — a separate fresh activation',
    roll: 'Roll',
    pitch: 'Pitch',
    yaw: 'Yaw',
    throttle: 'Throttle',
    saveResponse: 'Response applied. Changing response resets the attempt.',
    pick: 'Choose a device first.',
    mode: 'Mode',
    left: 'Left stick',
    right: 'Right stick',
  },
  uk: {
    title: 'Налаштування пульта',
    intro:
      'Підключіть USB-пульт, виберіть на ньому режим джойстика та поворушіть стік. Деякі браузери показують пристрій лише після взаємодії зі сторінкою. Перевірте канали наживо перед польотом.',
    refresh: 'Знайти пристрої',
    none: 'Пристрій не видно — перевірте режим USB-джойстика та взаємодійте зі сторінкою.',
    unavailable: 'Gamepad API недоступний або заблокований.',
    device: 'Пристрій',
    layout: 'Схема стіків (не змінює призначення каналів)',
    full: 'Пульт: повний хід газу без центрування',
    spring: 'Адаптація геймпада: центр газу — 50%',
    raw: 'Канали наживо',
    control: 'Керування',
    axis: 'Вісь',
    minimum: 'Мінімум',
    center: 'Центр',
    maximum: 'Максимум',
    invert: 'Інверсія',
    deadZone: 'Мертва зона',
    identify: 'Визначити рухому вісь',
    use: 'Використати рухому вісь',
    travel: 'Записати повний хід',
    stop: 'Завершити запис',
    centre: 'Виміряти центр',
    verified: 'Стіки готові. Зміни зберігаються автоматично.',
    saved: 'Автоматично збережено на пристрої.',
    session: 'Лише цей сеанс — профіль не вдалося зберегти.',
    response: 'Реакція польоту — окремо від калібрування',
    curve: 'Крива симулятора (вхід → вихід)',
    reset: 'Скинути до плавної реакції',
    apply: 'Застосувати реакцію',
    export: 'Експорт профілів',
    import: 'Імпорт профілів',
    profile: 'JSON профілів',
    rate: 'Максимальна кутова швидкість (градусів/с)',
    tilt: 'Максимальний нахил самовирівнювання (градуси)',
    expo: 'Частка кубічної кривої (%)',
    ticks: 'Кутова реакція (кроки по 50 Гц)',
    sign: 'Додатний напрямок: крен праворуч, тангаж уперед, рискання праворуч, газ угору. Мікси та криві пульта залишаються активними; використовуйте просту модель симулятора на пульті.',
    incomplete:
      'Призначення або калібрування не завершено. Запишіть повний хід і центри, потім перевірте керування.',
    ambiguous: 'Рухайте лише один орган керування щонайменше на чверть ходу та спробуйте ще раз.',
    switches: 'Перемикачі та кнопки пульта (необов’язково)',
    switchType: 'Тип каналу перемикача',
    buttonChannel: 'Канал кнопки',
    axisChannel: 'Канал осі',
    offPosition: 'Вимкнене положення',
    onPosition: 'Увімкнене положення',
    captureSwitch: 'Визначити перемикач / кнопку',
    useSwitch: 'Скасувати визначення',
    switchStart:
      'Залиште перемикач вимкненим, почніть визначення, утримайте увімкненим і вимкніть. Призначення завершиться автоматично. Для моторів — перемикач із фіксацією, для скидання — кнопка. Для осі з трьома положеннями використовуйте протилежне крайнє положення як УВІМК.',
    switchMove:
      'Очікування… ненадовго залиште вимкненим, утримайте увімкненим і вимкніть. Рухайте лише цей перемикач. Якщо сигналу немає, призначте USB-канал у моделі пульта.',
    switchReturn: 'Увімкнення визначено. Вимкніть перемикач або відпустіть кнопку.',
    switchAmbiguous:
      'Визначення зупинено. Поверніться на цю сторінку, вимкніть перемикач і спробуйте знову. Осі стіків не можуть бути перемикачами.',
    switchConflict:
      'Цей перемикач також керує іншою дією. Виберіть інший або очистьте попереднє призначення в додаткових полях.',
    switchCaptured: 'Призначено й збережено автоматично. Стежте за індикатором наживо.',
    library: 'Збережені пульти',
    chooseSaved: 'Виберіть збережене калібрування…',
    download: 'Завантажити всі профілі пультів',
    share: 'Поділитися налаштуванням пульта',
    file: 'Імпортувати файл налаштувань',
    sharing:
      'Поділіться файлом, указавши модель пульта, прошивку, режим USB та комп’ютер/браузер. Чужі призначення потребують місцевої перевірки напрямків і перемикачів. Файли не надсилаються автоматично.',
    imported:
      'Коректні імпортовані налаштування зберігаються автоматично. Перед польотом перевірте напрямки стіків наживо.',
    responseUnchanged: 'Профілі рейтів і газу залишилися без змін.',
    responseIgnored:
      'Параметри реакції польоту з файлу не застосовано. Профілі рейтів і газу залишилися без змін.',
    threshold: 'Поріг спрацьовування',
    buttons: 'Кнопки',
    arm: 'Мотори — увімкнений перемикач дозволяє політ, вимкнений зупиняє мотори',
    pause: 'Пауза — призупинити політ до відновлення',
    resetAction: 'Скинути рівень — почати цю вправу зі стартового майданчика',
    camera: 'Камера — увімкніть і вимкніть перемикач: FPV / За дроном / Огляд',
    fire: 'Вогонь — відпустіть після запуску, потім утримуйте для стрільби в бою',
    weapon: 'Змінити зброю — відпустіть і активуйте',
    reload: 'Перезарядити — відпустіть і активуйте',
    payload: 'Скинути / підготувати заряд',
    detonate: 'Підірвати — окрема нова активація',
    roll: 'Крен',
    pitch: 'Тангаж',
    yaw: 'Рискання',
    throttle: 'Газ',
    saveResponse: 'Реакцію застосовано. Зміна реакції починає нову спробу.',
    pick: 'Спочатку виберіть пристрій.',
    mode: 'Режим',
    left: 'Лівий стік',
    right: 'Правий стік',
  },
};

/** Local setup only. No Journey/reward API and no automatic control ownership. */
export function mountRadioSetup({
  container,
  window: win,
  runtime,
  locale = 'en',
  onProfile = () => {},
  onResponse = () => {},
  onDone = () => {},
  onOpenRates = null,
}) {
  const doc = container.ownerDocument,
    copy = COPY[locale] ?? COPY.en;
  const t = (en, uk) => (locale === 'uk' ? uk : en);
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    /* explicit session status below */
  }
  const store = createFlightProfileStore({ storage });
  const originalProfileKeys = new Set(store.radios().map((row) => row.key));
  let autoSavedEntryKey = null;
  runtime.beginSetup();
  let verified = false,
    recording = false,
    identifying = null,
    switchCapture = null,
    travel = null,
    frame = null,
    disposed = false,
    lastPaint = -Infinity,
    lastDiscovery = -Infinity,
    autoSavePending = false,
    autoSaveAfter = 0,
    savedProfileSignature = null,
    savedProfileResult = null,
    restoringFields = false,
    savedLayoutSignature = null,
    importRevision = 0;
  let guide = null;
  const bootstrap = createRadioBootstrap();
  let bootstrapEnabled = !runtime.status().verified,
    bootstrapFlow = false,
    bootstrapComplete = false,
    bootstrapDevice = null,
    layoutDraft = null,
    layoutCapture = null,
    layoutSequence = null,
    previousLayout = null,
    layoutDeviceKey = null,
    practice = false,
    practicePaused = true,
    practicePrevious = {},
    practiceSeen = new Set(),
    sixPanel = null,
    sixStatus = null,
    sixRows = {},
    modelControls = null,
    modelDeviceKey = null,
    proposalNeedsCheck = false;
  const listeners = [],
    rows = {},
    switchRows = {};
  const el = (tag, text, parent = container) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    parent.append(node);
    return node;
  };
  const listen = (node, type, fn) => {
    node.addEventListener(type, fn);
    listeners.push(() => node.removeEventListener(type, fn));
  };
  const button = (text, fn, parent = container) => {
    const node = el('button', text, parent);
    node.type = 'button';
    listen(node, 'click', fn);
    return node;
  };
  const label = (text, type, value, parent = container) => {
    const wrap = el('label', text, parent),
      node = el('input', undefined, wrap);
    node.type = type;
    node.value = value;
    return node;
  };
  const status = el('p');
  status.setAttribute('role', 'status');
  const heading = el('h2', copy.title);
  const intro = el('p', copy.intro);
  const deviceLabel = el('label', copy.device),
    select = el('select', undefined, deviceLabel);
  const refresh = () => {
    // Discovery may first expose a USB device after this user interaction.
    // A pristine setup can restore its verified mapping; edited fields stay owned
    // by the editor until their complete mapping is saved automatically.
    if (!runtime.status().profileDirty) {
      runtime.endSetup();
      restoreVerifiedRadio(runtime, store);
      runtime.beginSetup();
    }
    const previous = select.value,
      result = runtime.devices();
    select.replaceChildren();
    const empty = el(
      'option',
      result.status === 'unavailable'
        ? copy.unavailable
        : result.devices.length
          ? locale === 'uk'
            ? 'Виберіть пульт…'
            : 'Choose your radio…'
          : copy.none,
      select,
    );
    empty.value = '';
    for (const device of result.devices) {
      const option = el('option', device.id.replace(/\s*\(Vendor:.*\)$/i, ''), select);
      option.value = String(device.index);
    }
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
    const current = runtime.status();
    if (!current.profileDirty && current.selected && current.profile) {
      select.value = String(current.selected.index);
      loadProfile(JSON.parse(current.profile), { confirmed: current.verified });
    } else if (!current.selected && !current.profileDirty && result.devices.length === 1) {
      select.value = String(result.devices[0].index);
      select.dispatchEvent(new win.Event('change'));
    }
  };
  const refreshButton = button(copy.refresh, refresh);
  const raw = el('pre', copy.raw);
  raw.setAttribute('aria-label', copy.raw);
  const layoutLabel = el('label', copy.layout),
    mode = el('select', undefined, layoutLabel);
  for (let i = 1; i <= 4; i++) {
    const option = el('option', `${copy.mode} ${i}`, mode);
    option.value = String(i);
  }
  mode.value = '2';
  const throttleLabel = el('label', radioControlLabel('throttle', 2, locale)),
    throttle = el('select', undefined, throttleLabel);
  for (const [id, text] of [
    ['full-travel', copy.full],
    ['spring-centred', copy.spring],
  ]) {
    const option = el('option', text, throttle);
    option.value = id;
  }
  const sign = el(
    'p',
    t(
      'Map each movement below. Watch the dots and use Reverse if a direction is wrong. Changes save automatically.',
      'Призначте кожен рух нижче. Стежте за точками; якщо напрямок зворотний, увімкніть інверсію. Зміни зберігаються автоматично.',
    ),
  );
  const channels = el('div');
  channels.className = 'radio-channels';
  for (const control of FLIGHT_CONTROLS) {
    const field = el('fieldset', undefined, channels);
    const legend = el('legend', radioControlLabel(control, Number(mode.value), locale), field);
    field.dataset.radioControl = control;
    const hint = el('p', '', field);
    hint.className = 'radio-channel-hint';
    const reading = el('output', '', field);
    reading.className = 'radio-channel-reading';
    reading.setAttribute('aria-label', `${copy[control]} ${t('live movement', 'рух наживо')}`);
    const meter = el('div', undefined, field);
    meter.className = 'radio-channel-meter';
    meter.setAttribute('aria-hidden', 'true');
    const dot = el('i', undefined, meter);
    const advanced = el('details', undefined, field);
    el('summary', t('Channel & calibration details', 'Канал і параметри калібрування'), advanced);
    const axis = label(t('USB channel', 'USB-канал'), 'number', '', advanced);
    axis.min = '0';
    axis.max = '63';
    axis.step = '1';
    const min = label(copy.minimum, 'number', '', advanced),
      center = label(copy.center, 'number', '', advanced),
      max = label(copy.maximum, 'number', '', advanced);
    for (const node of [min, center, max]) {
      node.min = '-1';
      node.max = '1';
      node.step = '0.001';
    }
    const invert = label(copy.invert, 'checkbox', '', field),
      deadZone = label(copy.deadZone, 'number', control === 'throttle' ? '0' : '0.02', advanced);
    deadZone.min = '0';
    deadZone.max = '0.2';
    deadZone.step = '0.005';
    const identify = button(
      copy.identify,
      () => {
        const pad = runtime.raw();
        if (!pad) {
          status.textContent = copy.pick;
          return;
        }
        stopCaptures();
        invalidate();
        identifying = {
          control,
          min: [...pad.axes],
          max: [...pad.axes],
          baseline: [...pad.axes],
          identity: canonicalJSON(radioDeviceIdentity(pad)),
          index: pad.index,
          started: win.performance.now(),
          stage: 'positive',
          positive: null,
          held: null,
        };
        identify.textContent = t('Listening…', 'Очікування…');
        status.textContent = t(
          'Move only this control in the indicated direction and hold it.',
          'Рухайте лише цей орган керування у вказаному напрямку та утримуйте.',
        );
      },
      field,
    );
    rows[control] = {
      axis,
      min,
      center,
      max,
      invert,
      deadZone,
      identify,
      legend,
      field,
      hint,
      reading,
      dot,
    };
  }
  function invalidate(markRuntime = true) {
    importRevision++;
    verified = false;
    if (markRuntime) runtime.editProfile();
    saveEditorDraft();
    autoSavePending = true;
    autoSaveAfter = win.performance.now() + 250;
    status.textContent = copy.incomplete;
  }
  function stopCaptures() {
    identifying = null;
    recording = false;
    travel = null;
    switchCapture = null;
    travelButton.textContent = copy.travel;
    for (const row of Object.values(rows)) row.identify.textContent = copy.identify;
    for (const row of Object.values(switchRows)) {
      row.identify.textContent = copy.captureSwitch;
      row.setCaptureState('idle');
    }
  }
  listen(win, 'blur', () => {
    if (identifying) {
      stopCaptures();
      status.textContent = copy.ambiguous;
    }
    if (layoutCapture || practice) cancelSixCapture();
    if (!bootstrapComplete) bootstrap.reset('interrupted');
    if (!switchCapture) return;
    const row = switchRows[switchCapture.action];
    stopCaptures();
    row.setCaptureState('error');
    row.captureHint.textContent = status.textContent = copy.switchAmbiguous;
  });
  const travelButton = button(copy.travel, () => {
    const pad = runtime.raw();
    if (!pad) {
      status.textContent = copy.pick;
      return;
    }
    recording = !recording;
    travelButton.textContent = recording ? copy.stop : copy.travel;
    if (recording) travel = { min: [...pad.axes], max: [...pad.axes] };
    invalidate();
  });
  const centreButton = button(copy.centre, () => {
    const pad = runtime.raw();
    if (!pad) return;
    for (const control of FLIGHT_CONTROLS)
      if (control !== 'throttle' || throttle.value === 'spring-centred') {
        const row = rows[control];
        if (row.axis.value !== '' && Number.isFinite(pad.axes[Number(row.axis.value)]))
          row.center.value = pad.axes[Number(row.axis.value)].toFixed(3);
      }
    invalidate();
  });
  const switchHeading = el('h3', copy.switches);
  const switchIntro = el('p', copy.switchStart);
  const switchFields = [];
  for (const action of ['arm', 'pause', 'reset', 'camera', 'fire', ...RADIO_COMBAT_ACTIONS]) {
    const field = el('fieldset');
    switchFields.push(field);
    field.setAttribute('data-radio-switch', action);
    el('legend', copy[action === 'reset' ? 'resetAction' : action], field);
    const typeLabel = el('label', copy.switchType, field);
    const source = el('select', undefined, typeLabel);
    for (const [value, text] of [
      ['button', copy.buttonChannel],
      ['axis', copy.axisChannel],
    ]) {
      const option = el('option', text, source);
      option.value = value;
    }
    source.value = 'button';
    const node = label(copy.axis + ' / ' + copy.buttons, 'number', '', field);
    const off = label(copy.offPosition, 'number', '-1', field);
    const on = label(copy.onPosition, 'number', '1', field);
    for (const input of [off, on]) {
      input.min = '-1';
      input.max = '1';
      input.step = '0.001';
    }

    node.min = '0';
    node.max = '255';
    node.step = '1';
    const threshold = label(copy.threshold, 'number', '0.5', field);
    threshold.min = '0.1';
    threshold.max = '0.9';
    threshold.step = '0.05';
    const invert = label(copy.invert, 'checkbox', '', field);
    const captureHint = el('p', '', field);
    captureHint.setAttribute('role', 'status');
    const indicator = el('output', '', field);
    indicator.setAttribute('aria-label', locale === 'uk' ? 'Стан перемикача' : 'Switch state');
    let captureState = 'idle';
    function setCaptureState(value) {
      captureState = value;
      field.dataset.captureState = value;
      if (value === 'idle') captureHint.textContent = '';
    }
    function startCapture() {
      const pad = runtime.raw();
      if (!pad) {
        setCaptureState('error');
        status.textContent = copy.pick;
        return;
      }
      stopCaptures();
      invalidate();
      const flightAxes = Object.values(rows)
        .filter((row) => row.axis.value.trim() !== '')
        .map((row) => Number(row.axis.value));
      switchCapture = {
        action,
        identity: canonicalJSON(radioDeviceIdentity(pad)),
        index: pad.index,
        detector: createRadioSwitchCapture({ flightAxes, holdMs: action === 'arm' ? 220 : 50 }),
      };
      setCaptureState('listening');
      identify.textContent = copy.useSwitch;
      captureHint.textContent = status.textContent = copy.switchMove;
    }
    const identify = button(
      copy.captureSwitch,
      () => {
        if (switchCapture?.action === action) stopCaptures();
        else startCapture();
      },
      field,
    );
    if (action === 'camera' || action === 'fire' || RADIO_COMBAT_ACTIONS.includes(action))
      button(
        RADIO_COMBAT_ACTIONS.includes(action)
          ? locale === 'uk'
            ? 'Прибрати призначення'
            : 'Remove assignment'
          : action === 'fire'
            ? locale === 'uk'
              ? 'Не призначати перемикач вогню'
              : 'Remove Fire switch'
            : locale === 'uk'
              ? 'Не призначати перемикач камери'
              : 'Remove View switch',
        () => {
          stopCaptures();
          node.value = '';
          invalidate();
        },
        field,
      );
    function updateSwitchFields() {
      const axis = source.value === 'axis';
      off.parentNode.hidden = on.parentNode.hidden = !axis;
      threshold.parentNode.hidden = invert.parentNode.hidden = axis;
      node.max = axis ? '63' : '255';
    }
    listen(source, 'change', () => {
      updateSwitchFields();
      invalidate();
    });
    updateSwitchFields();
    const advanced = el('details', undefined, field);
    el('summary', locale === 'uk' ? 'Додаткові поля каналу' : 'Advanced channel fields', advanced);
    advanced.append(
      typeLabel,
      node.parentNode,
      off.parentNode,
      on.parentNode,
      threshold.parentNode,
      invert.parentNode,
    );
    switchRows[action] = {
      button: node,
      threshold,
      invert,
      identify,
      source,
      off,
      on,
      updateSwitchFields,
      startCapture,
      captureStatus: () => captureState,
      setCaptureState,
      captureHint,
      indicator,
    };
  }
  const sixNames = {
    arm: [
      t('Flight', 'Політ'),
      t(
        'ON: Arm / resume · OFF: pause and menu',
        'УВІМК.: запуск / продовження · ВИМК.: пауза й меню',
      ),
    ],
    fire: [
      t('Fire gun', 'Вогонь зі зброї'),
      t(
        'Flying: shoot the active gun · Paused: Select on release',
        'У польоті: стріляти з активної зброї · На паузі: вибір після відпускання',
      ),
    ],
    weapon: [
      t('Weapon', 'Зброя'),
      t(
        'Flying: next weapon · Paused: Back on release',
        'У польоті: наступна зброя · На паузі: назад після відпускання',
      ),
    ],
    reload: [
      t('Reload', 'Перезарядити'),
      t('Flying: reload · Paused: View', 'У польоті: перезарядження · На паузі: камера'),
    ],
    payload: [
      t('Deploy / arm', 'Скинути / підготувати'),
      t(
        'Flying: drop bomb / deploy payload · Paused: Retry with confirmation',
        'У польоті: заряд · На паузі: повтор із підтвердженням',
      ),
    ],
    detonate: [
      t('Detonate', 'Підірвати'),
      t(
        'Flying: separate detonation · Paused: Settings',
        'У польоті: окремий підрив · На паузі: налаштування',
      ),
    ],
  };
  function layoutProfile() {
    try {
      const current = runtime.status().profile;
      const profile = current ? JSON.parse(current) : readProfile(false);
      return canonicalJSON(profile.device) === canonicalJSON(radioDeviceIdentity(runtime.raw()))
        ? profile
        : null;
    } catch {
      return null;
    }
  }
  function ensureLayout() {
    const pad = runtime.raw();
    if (!pad) return null;
    const device = radioDeviceIdentity(pad),
      key = canonicalJSON(device);
    if (layoutDeviceKey === key && layoutDraft) return layoutDraft;
    layoutDeviceKey = key;
    layoutCapture = layoutSequence = null;
    practice = false;
    const profile = layoutProfile();
    previousLayout = runtime.controlLayout?.() ?? null;
    let saved = null;
    try {
      saved = loadRadioControlLayout({ storage, device });
    } catch {
      /* Session remains usable. */
    }
    layoutDraft = structuredClone(
      previousLayout ??
        saved ??
        (profile
          ? createRadioControlLayout(profile)
          : {
              format: 'RadioControlLayout.v1',
              device,
              layout: 'six-switch',
              switches: Object.fromEntries(RADIO_CONTROL_SWITCHES.map((action) => [action, null])),
            }),
    );
    if (bootstrapDevice && canonicalJSON(bootstrapDevice.device) === key)
      Object.assign(layoutDraft.switches, bootstrapDevice.switches);
    return layoutDraft;
  }
  function paintSix() {
    if (!sixPanel) return;
    const draft = ensureLayout(),
      profile = layoutProfile();
    paintModel();
    const pad = runtime.raw();
    for (const [action, row] of Object.entries(sixRows)) {
      const binding = draft?.switches[action];
      row.binding.textContent = binding
        ? Object.hasOwn(binding, 'axis')
          ? `${t('Channel', 'Канал')} ${binding.axis} · ${t('OFF', 'ВИМК')} ${binding.off.toFixed(2)} → ${t('ON', 'УВІМК')} ${binding.on.toFixed(2)}`
          : `${t('Button', 'Кнопка')} ${binding.button}${binding.invert ? ` · ${t('reversed', 'зворотна')}` : ''}`
        : ['arm', 'fire'].includes(action)
          ? t('Not assigned · required', 'Не призначено · обов’язково')
          : t('Available through the menu', 'Доступно через меню');
      let active = null;
      try {
        if (binding && pad) active = radioSwitch(draft, pad, action, row.active ?? false);
      } catch {
        /* A missing live sample does not change saved assignments. */
      }
      row.active = active;
      row.live.textContent =
        active === null
          ? t('No live input', 'Немає живого сигналу')
          : active
            ? t('ON', 'УВІМК.')
            : t('OFF', 'ВИМК.');
      row.live.setAttribute('aria-label', `${sixNames[action][0]}: ${row.live.textContent}`);
      row.node.dataset.switchActive = active === true ? 'true' : 'false';
      row.capture.disabled = !draft || Boolean(layoutCapture) || practice;
      row.node.dataset.captureState =
        layoutCapture?.action === action ? 'listening' : binding ? 'assigned' : 'empty';
    }
    const ready = Boolean(draft?.switches.arm && draft?.switches.fire);
    sixPanel.querySelector('[data-six-practice]').disabled = !ready || Boolean(layoutCapture);
    sixPanel.querySelector('[data-six-capture-all]').disabled =
      !draft || Boolean(layoutCapture) || practice;
    sixPanel.querySelector('[data-six-swap-fire-payload]').disabled =
      !draft?.switches.fire ||
      !draft?.switches.payload ||
      Boolean(layoutCapture) ||
      practice ||
      Boolean(guide?.captureActive());
  }
  function modelNotice(candidate) {
    const messages = {
      'surface-radio': t(
        'MT12 has a steering wheel and trigger. Use a flight radio with two sticks, or set up suitable controls manually.',
        'MT12 має кермо й курок. Використайте пульт із двома стіками або налаштуйте відповідні органи керування вручну.',
      ),
      'choose-receiver-firmware': t(
        'Choose your radio and the firmware installed on your receiver. The SIM cannot identify them through this connection.',
        'Виберіть свій пульт і прошивку, встановлену на приймачі. SIM не може визначити їх через це підключення.',
      ),
      'choose-channel-preset': t(
        'Choose a USB setup below, or assign your sticks and switches manually.',
        'Виберіть налаштування USB нижче або призначте стіки й перемикачі вручну.',
      ),
      'channel-count-mismatch': t(
        'This connection is missing channels needed by that suggestion. Choose the matching USB setup, or assign controls manually.',
        'У цьому підключенні немає потрібних каналів. Виберіть відповідне налаштування USB або призначте керування вручну.',
      ),
      'five-switch-radio': t(
        'Pocket has five switches and a knob. Use the knob for another action, or reach it from the pause menu. Watch the live preview to check your controls.',
        'Pocket має п’ять перемикачів і ручку. Використайте ручку для ще однієї дії або вибирайте її в меню паузи. Перевірте все керування перед збереженням.',
      ),
      'check-candidate': t(
        'These are suggested channels, not checked settings. Your radio may use different channels. Use the live preview and optional switch Practice.',
        'Це запропоновані канали, а не перевірені налаштування. Ваш пульт може використовувати інші канали. Перевірте кожен стік і перемикач перед збереженням.',
      ),
    };
    return messages[candidate.noticeCode] ?? candidate.notice;
  }
  function paintModel() {
    if (!modelControls) return;
    const pad = runtime.raw();
    if (!pad) {
      modelControls.apply.disabled = true;
      return;
    }
    const device = radioDeviceIdentity(pad),
      key = canonicalJSON(device);
    if (modelDeviceKey !== key) {
      modelDeviceKey = key;
      let choice = null;
      try {
        choice = loadRadioModelSelection({ storage, device });
      } catch {
        /* Manual choice remains available. */
      }
      const candidate = radioDeviceRecommendation(device, choice ?? {});
      modelControls.model.value = candidate.modelId;
      modelControls.transport.value = candidate.channelPreset ?? '';
      modelControls.message.textContent = modelNotice(candidate);
      proposalNeedsCheck = false;
    }
    const candidate = radioDeviceRecommendation(device, {
      modelId: modelControls.model.value || 'other-radio',
      channelPreset: modelControls.transport.value || null,
    });
    modelControls.apply.disabled =
      !candidate.profile || Boolean(layoutCapture) || practice || Boolean(guide?.captureActive());
  }
  function cancelSixCapture() {
    layoutCapture = layoutSequence = null;
    practice = false;
    stopCaptures();
    if (guide?.captureActive()) guide.cancel();
    if (!bootstrapComplete) {
      bootstrapEnabled = false;
      bootstrap.reset();
      runtime.setProvisionalMenu?.(null);
    }
    if (sixStatus)
      sixStatus.textContent = t(
        'Assignment cancelled. Your saved sticks and controls are unchanged.',
        'Призначення скасовано. Збережені налаштування стіків і керування не змінено.',
      );
    paintSix();
  }
  function startLayoutCapture(action, sequence = null) {
    const draft = ensureLayout(),
      pad = runtime.raw();
    if (!draft || !pad) return;
    bootstrapEnabled = false;
    stopCaptures();
    practice = false;
    layoutSequence = sequence;
    const profile = layoutProfile();
    const flightAxes = profile
      ? Object.values(profile.channels).map((channel) => channel.axis)
      : Object.values(rows)
          .filter((row) => row.axis.value !== '')
          .map((row) => Number(row.axis.value));
    layoutCapture = {
      action,
      index: pad.index,
      identity: canonicalJSON(radioDeviceIdentity(pad)),
      started: win.performance.now(),
      detector: createRadioSwitchCapture({ flightAxes, holdMs: action === 'arm' ? 220 : 80 }),
    };
    sixStatus.textContent = `${sixNames[action][0]}: ${copy.switchMove}`;
    paintSix();
  }
  function sampleLayoutCapture(pad, now) {
    if (!layoutCapture) return;
    const capture = layoutCapture;
    if (
      !pad ||
      doc.hidden ||
      (doc.hasFocus && !doc.hasFocus()) ||
      pad.index !== capture.index ||
      canonicalJSON(radioDeviceIdentity(pad)) !== capture.identity ||
      now - capture.started > 20000
    ) {
      cancelSixCapture();
      sixStatus.textContent = t(
        'Assignment interrupted or timed out. Your choices are still here; try again.',
        'Призначення перервано або час минув. Вибрані налаштування залишилися; спробуйте знову.',
      );
      return;
    }
    const result = capture.detector.sample(pad, now);
    if (result.state === 'return')
      sixStatus.textContent = `${sixNames[capture.action][0]}: ${copy.switchReturn}`;
    if (result.state !== 'done') return;
    const conflict = RADIO_CONTROL_SWITCHES.some(
      (action) =>
        action !== capture.action &&
        layoutDraft.switches[action] &&
        radioSwitch(layoutDraft, result.before, action) !==
          radioSwitch(layoutDraft, result.after, action),
    );
    if (conflict) {
      layoutCapture = layoutSequence = null;
      sixStatus.textContent = copy.switchConflict;
      paintSix();
      return;
    }
    layoutDraft.switches[capture.action] = result.binding;
    const next = layoutSequence;
    layoutCapture = null;
    persistSixLayout();
    if (next?.length) startLayoutCapture(next[0], next.slice(1));
    else {
      layoutSequence = null;
      paintSix();
    }
  }
  function samplePractice(pad) {
    if (!practice || !pad || !layoutDraft) return;
    const next = Object.fromEntries(
      RADIO_CONTROL_SWITCHES.map((action) => [action, radioSwitch(layoutDraft, pad, action)]),
    );
    for (const action of RADIO_CONTROL_SWITCHES) {
      if (next[action] === practicePrevious[action]) continue;
      practiceSeen.add(action);
      if (action === 'arm') practicePaused = !next.arm;
      const releaseAction = practicePaused && ['fire', 'weapon'].includes(action);
      if ((releaseAction && next[action]) || (!releaseAction && !next[action] && action !== 'arm'))
        continue;
      const feedback = practicePaused
        ? {
            arm: t('Paused menu', 'Меню паузи'),
            fire: t('Select', 'Вибрати'),
            weapon: t('Back', 'Назад'),
            reload: t('View', 'Камера'),
            payload: t('Retry — confirmation required', 'Повтор — потрібне підтвердження'),
            detonate: t('Settings', 'Налаштування'),
          }[action]
        : sixNames[action][0];
      sixStatus.textContent = `${t('Practice only', 'Лише тренування')}: ${feedback} · ${practiceSeen.size}/${RADIO_CONTROL_SWITCHES.filter((role) => layoutDraft.switches[role]).length}. ${t('No flight or weapon commands.', 'Без команд польоту або зброї.')}`;
    }
    practicePrevious = next;
  }
  function sampleBootstrap(now) {
    if (
      !bootstrapEnabled ||
      bootstrapComplete ||
      runtime.status().verified ||
      guide?.captureActive() ||
      layoutCapture ||
      !runtime.rawDevices
    )
      return;
    if (doc.hidden || (doc.hasFocus && !doc.hasFocus())) {
      bootstrap.reset('interrupted');
      return;
    }
    const result = bootstrap.sample(runtime.rawDevices(), now);
    if (sixStatus && !practice) {
      const instruction = {
        nominate: t(
          'Without a keyboard: move one control and return it to rest twice on the same radio.',
          'Без клавіатури: двічі перемістіть один орган керування та поверніть у спокій на тому самому пульті.',
        ),
        confirm: t(
          'Select / Fire: choose an unused switch. Hold ON, return OFF twice.',
          'Вибір / Вогонь: виберіть вільний перемикач. Двічі утримайте УВІМК. і поверніть ВИМК.',
        ),
        back: t(
          'Back / Weapon: choose a different switch. Hold ON, return OFF twice.',
          'Назад / Зброя: виберіть інший перемикач. Двічі утримайте УВІМК. і поверніть ВИМК.',
        ),
      }[result.phase];
      if (instruction)
        sixStatus.textContent = `${result.error ? t('Discovery restarted. Move only one radio. ', 'Пошук почато знову. Рухайте лише один пульт. ') : ''}${instruction} (${result.cycles}/2)`;
    }
    if (result.phase !== 'done') return;
    bootstrapComplete = bootstrapFlow = true;
    bootstrapDevice = result;
    runtime.select(result.index);
    select.value = String(result.index);
    runtime.setProvisionalMenu?.({
      device: result.device,
      index: result.index,
      switches: result.switches,
    });
    layoutDeviceKey = null;
    ensureLayout();
    guide.start();
    sixStatus.textContent = t(
      'Select and Back are ready. Follow the stick guide; completed calibration saves automatically.',
      'Вибір і Назад готові. Дотримуйтеся підказок налаштування стіків. Політ стане доступним після перевірки й збереження стіків.',
    );
    paintSix();
  }
  const libraryLabel = el('label', copy.library),
    librarySelect = el('select', undefined, libraryLabel);
  function refreshLibrary() {
    const selected = store.snapshot().radio;
    librarySelect.replaceChildren();
    el('option', copy.chooseSaved, librarySelect).value = '';
    store.radios().forEach(({ key, profile }, index) => {
      const option = el(
        'option',
        `${index + 1}. ${profile.name} · ${profile.verified ? (locale === 'uk' ? 'перевірено' : 'verified') : locale === 'uk' ? 'чернетка' : 'draft'}`,
        librarySelect,
      );
      option.value = key;
    });
    librarySelect.value = selected ? radioProfileKey(selected) : '';
    libraryLabel.hidden = !store.radios().length;
  }
  listen(librarySelect, 'change', () => {
    importRevision++;
    if (!librarySelect.value) return;
    try {
      const entry = store.radios().find(({ key }) => key === librarySelect.value);
      const matches = runtime
        .devices()
        .devices.filter(
          ({ index, ...device }) => canonicalJSON(device) === canonicalJSON(entry.profile.device),
        );
      if (matches.length !== 1)
        throw new Error(
          locale === 'uk'
            ? 'Підключіть лише цей пульт, щоб завантажити профіль.'
            : 'Connect exactly this radio to load its calibration.',
        );
      guide?.reset();
      stopCaptures();
      runtime.select(matches[0].index);
      select.value = String(matches[0].index);
      loadProfile(entry.profile, { confirmed: entry.profile.verified });
      runtime.setProfile(entry.profile);
      runtime.beginSetup();
      const result = store.selectRadio(entry.key);
      status.textContent = result.saved
        ? entry.profile.verified
          ? copy.verified
          : copy.incomplete
        : copy.session;
    } catch (error) {
      status.textContent = error.message;
    }
  });
  const sticks = el('div');
  sticks.className = 'radio-sticks';
  const stickNodes = ['left', 'right'].map((key) => {
    const node = el('div', undefined, sticks);
    node.className = 'radio-stick';
    node.setAttribute('aria-label', copy[key]);
    return { node, label: el('span', copy[key], node), dot: el('i', undefined, node) };
  });
  function readProfile(confirmed = verified) {
    const pad = runtime.raw();
    if (!pad) throw new Error(copy.pick);
    const numeric = (node) => (node.value.trim() === '' ? NaN : Number(node.value));
    const combatAssigned = RADIO_COMBAT_ACTIONS.some((key) => switchRows[key].button.value !== '');
    return validateRadioProfile({
      format: combatAssigned
        ? COMBAT_RADIO_FORMAT
        : switchRows.fire.button.value !== ''
          ? FIRE_RADIO_FORMAT
          : switchRows.camera.button.value !== ''
            ? ACTION_RADIO_FORMAT
            : Object.values(switchRows).some(
                  (row) => row.button.value !== '' && row.source.value === 'axis',
                )
              ? AXIS_RADIO_FORMAT
              : RADIO_FORMAT,
      id: 'usb-radio-v1',
      name: pad.id.slice(0, 120) || 'USB radio',
      device: radioDeviceIdentity(pad),
      stickMode: Number(mode.value),
      throttleStyle: throttle.value,
      verified: confirmed,
      channels: Object.fromEntries(
        FLIGHT_CONTROLS.map((control) => {
          const row = rows[control],
            full = control === 'throttle' && throttle.value === 'full-travel';
          return [
            control,
            {
              axis: numeric(row.axis),
              min: numeric(row.min),
              max: numeric(row.max),
              center: full ? null : numeric(row.center),
              invert: row.invert.checked,
              deadZone: full ? 0 : numeric(row.deadZone),
            },
          ];
        }),
      ),
      switches: Object.fromEntries(
        Object.entries(switchRows)
          .filter(([key, row]) =>
            combatAssigned
              ? true
              : RADIO_COMBAT_ACTIONS.includes(key)
                ? false
                : key === 'fire'
                  ? row.button.value !== ''
                  : key !== 'camera' ||
                    row.button.value !== '' ||
                    switchRows.fire.button.value !== '',
          )
          .map(([key, row]) => [
            key,
            row.button.value === ''
              ? null
              : row.source.value === 'axis'
                ? {
                    axis: Number(row.button.value),
                    off: numeric(row.off),
                    on: numeric(row.on),
                  }
                : {
                    button: Number(row.button.value),
                    threshold: numeric(row.threshold),
                    invert: row.invert.checked,
                  },
          ]),
      ),
    });
  }
  function loadProfile(p, { confirmed = false } = {}) {
    if (!p) return;
    importRevision++;
    switchCapture = null;
    for (const row of Object.values(switchRows)) {
      row.identify.textContent = copy.captureSwitch;
      row.setCaptureState('idle');
    }
    mode.value = String(p.stickMode);
    throttle.value = p.throttleStyle;
    for (const name of FLIGHT_CONTROLS) {
      const row = rows[name],
        channel = p.channels[name];
      for (const key of ['axis', 'min', 'max', 'center', 'deadZone'])
        row[key].value = channel[key] === null ? '' : String(channel[key]);
      row.invert.checked = channel.invert;
    }
    for (const [key, row] of Object.entries(switchRows)) {
      row.source.value =
        p.switches[key] && Object.hasOwn(p.switches[key], 'axis') ? 'axis' : 'button';
      row.button.value = p.switches[key]
        ? String(p.switches[key].axis ?? p.switches[key].button)
        : '';
      row.off.value = String(p.switches[key]?.off ?? -1);
      row.on.value = String(p.switches[key]?.on ?? 1);
      row.updateSwitchFields();
      row.threshold.value = String(p.switches[key]?.threshold ?? 0.5);
      row.invert.checked = p.switches[key]?.invert ?? false;
    }
    describeControls();
    if (confirmed) {
      verified = true;
      status.textContent = copy.verified;
    } else invalidate(false);
  }
  function verifyProfile() {
    try {
      if (recording || identifying || switchCapture) throw new Error(copy.incomplete);
      readProfile(true);
      verified = true;
      status.textContent = copy.verified;
      return true;
    } catch (e) {
      status.textContent = e.message;
      return false;
    }
  }
  function saveProfile() {
    importRevision++;
    try {
      if (!verified || recording || identifying || switchCapture) throw new Error(copy.incomplete);
      const p = readProfile(true);
      runtime.setProfile(p);
      if (!runtime.verify()) throw new Error(copy.incomplete);
      const result = store.save(
        { ...store.snapshot(), radio: p },
        { replaceKey: autoSavedEntryKey },
      );
      if (result.saved)
        autoSavedEntryKey = originalProfileKeys.has(radioProfileKey(p)) ? null : radioProfileKey(p);
      status.textContent = result.saved ? copy.saved : `${copy.session} ${result.error}`;
      refreshLibrary();
      onProfile(p);
      return result;
    } catch (e) {
      status.textContent = e.message;
      return null;
    }
  }
  function editorDraftKey(pad) {
    return `revealline.radio-setup-draft.v1:${encodeURIComponent(canonicalJSON(radioDeviceIdentity(pad)))}`;
  }
  function editorFields() {
    return [
      mode,
      throttle,
      ...[...Object.values(rows), ...Object.values(switchRows)].flatMap((row) =>
        Object.values(row).filter((node) => ['INPUT', 'SELECT'].includes(node?.tagName)),
      ),
    ];
  }
  function saveEditorDraft() {
    if (!guide || restoringFields) return;
    const pad = runtime.raw();
    if (!pad) return;
    try {
      storage?.setItem(
        editorDraftKey(pad),
        JSON.stringify(
          editorFields().map((node) => (node.type === 'checkbox' ? node.checked : node.value)),
        ),
      );
    } catch {
      /* The complete profile reports unavailable storage explicitly. */
    }
  }
  function restoreEditorDraft() {
    const pad = runtime.raw();
    if (!pad) return;
    try {
      const raw = storage?.getItem(editorDraftKey(pad));
      if (!raw || raw.length > 8192) return;
      const values = JSON.parse(raw),
        fields = editorFields();
      if (
        !Array.isArray(values) ||
        values.length !== fields.length ||
        !values.every((value, index) =>
          fields[index].type === 'checkbox'
            ? typeof value === 'boolean'
            : typeof value === 'string' && value.length <= 32,
        )
      )
        return;
      fields.forEach((node, index) => {
        if (node.type === 'checkbox') node.checked = values[index];
        else node.value = values[index];
      });
      for (const row of Object.values(switchRows)) row.updateSwitchFields();
      describeControls();
      invalidate();
    } catch {
      /* Malformed draft never replaces a usable saved profile. */
    }
  }
  function autoSaveProfile() {
    if (
      disposed ||
      recording ||
      identifying ||
      switchCapture ||
      layoutCapture ||
      practice ||
      guide?.captureActive()
    )
      return null;
    try {
      const candidate = readProfile(true);
      normalizeRadioInput(candidate, runtime.raw());
      const signature = canonicalJSON(candidate);
      if (signature === savedProfileSignature && runtime.status().verified) {
        autoSavePending = false;
        return savedProfileResult;
      }
      if (!verifyProfile()) return null;
      const result = saveProfile();
      if (result) {
        savedProfileSignature = signature;
        savedProfileResult = result;
        autoSavePending = false;
        if (result.saved) {
          try {
            storage?.removeItem(editorDraftKey(runtime.raw()));
          } catch {}
        }
        persistSixLayout({ announce: false });
      }
      return result;
    } catch (error) {
      status.textContent = `${t('Not saved yet:', 'Ще не збережено:')} ${error.message}`;
      return null;
    }
  }
  function persistSixLayout({ announce = true } = {}) {
    if (!layoutDraft || layoutCapture || practice) return false;
    try {
      let profile;
      try {
        profile = readProfile(true);
      } catch {
        /* A switch can be saved before the sticks are ready. */
      }
      const layout = validateRadioControlLayout(layoutDraft, { profile });
      const signature = canonicalJSON(layout);
      if (!Object.values(layout.switches).some(Boolean)) return true;
      if (
        profile &&
        runtime.status().verified &&
        layout.switches.arm &&
        canonicalJSON(runtime.controlLayout?.()) !== signature
      ) {
        runtime.setControlLayout(layout);
        runtime.setProvisionalMenu?.(null);
        bootstrapEnabled = false;
      }
      if (signature === savedLayoutSignature) return true;
      try {
        saveRadioControlLayout({ storage, layout });
        savedLayoutSignature = signature;
        if (announce && sixStatus)
          sixStatus.textContent = t(
            'Switches saved automatically. Practice is optional; close setup when ready.',
            'Перемикачі збережено автоматично. Тренування необов’язкове; закрийте налаштування, коли будете готові.',
          );
      } catch {
        if (sixStatus)
          sixStatus.textContent = t(
            'Switches work for this session. Browser storage is unavailable; export a backup to keep them.',
            'Перемикачі діють у цьому сеансі. Сховище недоступне; експортуйте резервну копію.',
          );
      }
      return true;
    } catch (error) {
      if (sixStatus)
        sixStatus.textContent = `${t('Not saved yet:', 'Ще не збережено:')} ${error.message}`;
      return false;
    }
  }
  listen(select, 'change', () => {
    restoringFields = true;
    guide?.reset();
    if (select.value === '') {
      runtime.select(null);
      invalidate();
      status.textContent = copy.pick;
      restoringFields = false;
      return;
    }
    const selected = runtime.select(Number(select.value)),
      pad = selected ? runtime.raw() : null;
    recording = false;
    identifying = null;
    switchCapture = null;
    for (const row of Object.values(switchRows)) {
      row.identify.textContent = copy.captureSwitch;
      row.button.value = '';
    }
    travelButton.textContent = copy.travel;
    for (const row of Object.values(rows)) {
      for (const key of ['axis', 'min', 'max', 'center']) row[key].value = '';
      row.identify.textContent = copy.identify;
    }
    invalidate();
    if (!selected || !pad) {
      status.textContent =
        runtime.devices().status === 'unavailable' ? copy.unavailable : copy.pick;
      restoringFields = false;
      return;
    }
    const matching = store
      .radios()
      .map(({ profile }) => profile)
      .filter((p) => canonicalJSON(p.device) === canonicalJSON(radioDeviceIdentity(pad)));
    const preferred = store.snapshot().radio;
    const p =
      matching.find((p) => preferred && radioProfileKey(p) === radioProfileKey(preferred)) ??
      (matching.length === 1 ? matching[0] : matching.length ? null : defaultRadioProfile());
    if (p && canonicalJSON(p.device) === canonicalJSON(radioDeviceIdentity(pad)))
      loadProfile(p, { confirmed: p.verified });
    restoringFields = false;
    restoreEditorDraft();
  });
  for (const node of [
    mode,
    throttle,
    ...Object.values(rows).flatMap((row) =>
      Object.values(row).filter((node) => node.tagName === 'INPUT'),
    ),
    ...Object.values(switchRows).flatMap((row) =>
      Object.values(row).filter((node) => node.tagName === 'INPUT'),
    ),
  ])
    for (const event of ['input', 'change']) listen(node, event, () => invalidate());

  const responseHeading = el('h2', copy.response);
  const responseNodes = {};
  for (const [key, text, min, max] of [
    ['maxRate', 'rate', 60, 720],
    ['maxTilt', 'tilt', 5, 60],
    ['expo', 'expo', 0, 80],
    ['responseTicks', 'ticks', 1, 30],
  ]) {
    const node = label(copy[text], 'number', DEFAULT_RESPONSE[key]);
    node.min = min;
    node.max = max;
    node.step = '1';
    responseNodes[key] = node;
  }
  const curve = el('pre');
  curve.setAttribute('aria-label', copy.curve);
  const readResponse = () =>
    validateFlightResponse({
      ...DEFAULT_RESPONSE,
      id: 'custom-v1',
      name: 'Custom',
      ...Object.fromEntries(
        Object.entries(responseNodes).map(([key, node]) => [key, Number(node.value)]),
      ),
    });
  const paintCurve = () => {
    try {
      const response = readResponse();
      curve.textContent = `${copy.curve}\n${[0, 250, 500, 750, 1000].map((x) => `${x / 10}% → ${responseCurve(x, response.expo) / 10}%`).join(' · ')}`;
    } catch (e) {
      curve.textContent = e.message;
    }
  };
  for (const node of Object.values(responseNodes)) listen(node, 'input', paintCurve);
  const loadResponse = (p) => {
    for (const [key, node] of Object.entries(responseNodes)) node.value = String(p[key]);
    paintCurve();
  };
  const resetResponse = button(copy.reset, () => loadResponse(DEFAULT_RESPONSE));
  const applyResponse = button(copy.apply, () => {
    try {
      const p = readResponse(),
        result = store.save({ ...store.snapshot(), response: p });
      onResponse(p);
      status.textContent = `${copy.saveResponse} ${result.saved ? copy.saved : copy.session}`;
    } catch (e) {
      status.textContent = e.message;
    }
  });
  const transferLabel = el('label', copy.profile),
    transfer = el('textarea', undefined, transferLabel);
  transfer.rows = 5;
  transfer.maxLength = RADIO_LIBRARY_BYTES;
  const exportButton = button(copy.export, () => {
    transfer.value = store.exportLibrary();
  });
  function importProfiles(text) {
    importRevision++;
    if (new TextEncoder().encode(text).length > RADIO_LIBRARY_BYTES)
      throw new Error('Profile file exceeds 64 KiB');
    const parsed = JSON.parse(text);
    const draft = (p) => (p ? { ...validateRadioProfile(p), verified: false } : null);
    let value;
    if (
      [
        RADIO_FORMAT,
        AXIS_RADIO_FORMAT,
        ACTION_RADIO_FORMAT,
        FIRE_RADIO_FORMAT,
        COMBAT_RADIO_FORMAT,
      ].includes(parsed.format)
    ) {
      value = {
        format: 'FlightProfiles.v1',
        radio: draft(parsed),
        response: store.snapshot().response,
      };
    } else {
      value = { ...parsed, radio: draft(parsed.radio) };
      if (Array.isArray(parsed.radios)) value.radios = parsed.radios.map(draft);
    }
    // An imported verified flag is not evidence of verification on this computer.
    const result = store.import(value, { preserveResponse: Boolean(onOpenRates) });
    guide?.reset();
    stopCaptures();
    const imported = value.radio;
    if (imported) loadProfile(imported);
    loadResponse(store.snapshot().response);
    runtime.editProfile();
    if (!onOpenRates) onResponse(store.snapshot().response);
    refreshLibrary();
    status.textContent = `${copy.imported} ${result.saved ? copy.saved : copy.session}${
      onOpenRates
        ? ` ${Object.hasOwn(parsed, 'response') ? copy.responseIgnored : copy.responseUnchanged}`
        : ''
    }`;
  }
  const importButton = button(copy.import, () => {
    try {
      importProfiles(transfer.value);
    } catch (e) {
      status.textContent = e.message;
    }
  });
  const removeProfile = button(
    locale === 'uk' ? 'Видалити вибране калібрування' : 'Remove selected calibration',
    () => {
      try {
        if (!librarySelect.value) return;
        importRevision++;
        const result = store.removeRadio(librarySelect.value);
        stopCaptures();
        runtime.editProfile();
        verified = false;
        refreshLibrary();
        status.textContent = result.saved
          ? locale === 'uk'
            ? 'Калібрування видалено. Інші пульти збережено.'
            : 'Calibration removed. Other radios are retained.'
          : copy.session;
      } catch (e) {
        status.textContent = e.message;
      }
    },
  );
  const sharing = el('p', copy.sharing);
  function download(text, name) {
    const url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json' }));
    const link = el('a');
    link.href = url;
    link.download = name;
    link.click();
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
  }
  const downloadButton = button(copy.download, () =>
    download(store.exportLibrary(), 'fpv-radio-profiles.json'),
  );
  const shareButton = button(copy.share, () => {
    try {
      download(canonicalJSON({ ...readProfile(false), verified: false }), 'fpv-radio-setup.json');
    } catch (e) {
      status.textContent = e.message;
    }
  });
  const fileLabel = el('label', copy.file),
    file = el('input', undefined, fileLabel);
  file.type = 'file';
  file.accept = '.json,application/json';
  listen(file, 'change', async () => {
    const revision = ++importRevision;
    try {
      const selected = file.files?.[0];
      if (!selected) return;
      if (selected.size > RADIO_LIBRARY_BYTES) throw new Error('Profile file exceeds 64 KiB');
      const text = await selected.text();
      if (!disposed && revision === importRevision) {
        file.value = '';
        importProfiles(text);
      }
    } catch (e) {
      if (!disposed && revision === importRevision) status.textContent = e.message;
    }
    if (revision === importRevision) file.value = '';
  });
  function sampleSwitchCapture(pad, now) {
    if (!switchCapture) return;
    const capture = switchCapture,
      row = switchRows[capture.action];
    if (
      !pad ||
      pad.index !== capture.index ||
      canonicalJSON(radioDeviceIdentity(pad)) !== capture.identity ||
      doc.hidden ||
      (doc.hasFocus && !doc.hasFocus())
    ) {
      stopCaptures();
      row.setCaptureState('error');
      row.captureHint.textContent = status.textContent = copy.switchAmbiguous;
      return;
    }
    const result = capture.detector.sample(pad, now);
    row.setCaptureState(result.state);
    if (result.state === 'return') row.captureHint.textContent = copy.switchReturn;
    if (result.state !== 'done') return;
    // Reject aliases as well as duplicate channel indices: another binding may
    // observe this same physical switch via a separate axis or position button.
    const conflict = Object.entries(switchRows).some(([action, other]) => {
      if (action === capture.action || other.button.value === '') return false;
      const binding =
        other.source.value === 'axis'
          ? {
              axis: Number(other.button.value),
              off: Number(other.off.value),
              on: Number(other.on.value),
            }
          : {
              button: Number(other.button.value),
              threshold: Number(other.threshold.value),
              invert: other.invert.checked,
            };
      const profile = { switches: { [action]: binding } };
      return (
        radioSwitch(profile, result.before, action) !== radioSwitch(profile, result.after, action)
      );
    });
    switchCapture = null;
    row.identify.textContent = copy.captureSwitch;
    if (conflict) {
      row.setCaptureState('error');
      row.captureHint.textContent = status.textContent = copy.switchConflict;
      return;
    }
    const binding = result.binding;
    row.source.value = Object.hasOwn(binding, 'axis') ? 'axis' : 'button';
    row.button.value = String(binding.axis ?? binding.button);
    if (row.source.value === 'axis') {
      row.off.value = String(binding.off);
      row.on.value = String(binding.on);
    } else {
      row.threshold.value = String(binding.threshold);
      row.invert.checked = binding.invert;
    }
    row.updateSwitchFields();
    invalidate();
    row.setCaptureState('done');
    row.captureHint.textContent = status.textContent = copy.switchCaptured;
    autoSaveProfile();
  }
  function describeControls() {
    for (const control of FLIGHT_CONTROLS)
      rows[control].legend.textContent = radioControlLabel(control, Number(mode.value), locale);
    throttleLabel.firstChild.textContent = locale === 'uk' ? 'Стік газу' : 'Throttle stick';
  }
  listen(mode, 'change', describeControls);
  function previewControl(control, pad) {
    const row = rows[control],
      full = control === 'throttle' && throttle.value === 'full-travel';
    if (!pad || [row.axis, row.min, row.max].some((node) => node.value === '')) return null;
    const raw = pad.axes[Number(row.axis.value)],
      min = Number(row.min.value),
      max = Number(row.max.value);
    if (!Number.isFinite(raw) || !(max > min)) return null;
    let value;
    if (full) value = (raw - min) / (max - min);
    else {
      if (row.center.value === '') return null;
      const center = Number(row.center.value);
      if (!(center > min && center < max)) return null;
      value = raw >= center ? (raw - center) / (max - center) : (raw - center) / (center - min);
    }
    value = Math.max(full ? 0 : -1, Math.min(1, value));
    if (row.invert.checked) value = full ? 1 - value : -value;
    if (!full) {
      const dead = Number(row.deadZone.value);
      if (Number.isFinite(dead) && dead >= 0 && dead <= 0.2)
        value = Math.sign(value) * Math.max(0, (Math.abs(value) - dead) / (1 - dead));
    }
    if (control === 'throttle' && !full) value = (value + 1) / 2;
    return value;
  }
  function sampleManualCapture(pad, now) {
    const capture = identifying;
    if (!capture) return;
    const row = rows[capture.control];
    if (
      !pad ||
      pad.index !== capture.index ||
      canonicalJSON(radioDeviceIdentity(pad)) !== capture.identity ||
      doc.hidden ||
      now - capture.started > 30000
    ) {
      stopCaptures();
      status.textContent = t(
        'Mapping stopped. Try again when the radio is connected.',
        'Призначення зупинено. Повторіть із під’єднаним пультом.',
      );
      return;
    }
    const movement = pad.axes
      .map((v, axis) => ({ axis, delta: v - capture.baseline[axis] }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    if (capture.stage === 'positive') {
      const candidate = movement[0];
      if (
        !candidate ||
        Math.abs(candidate.delta) < 0.25 ||
        Math.abs(candidate.delta) < Math.abs(movement[1]?.delta ?? 0) * 1.8
      ) {
        capture.held = null;
        return;
      }
      if (
        capture.held?.axis !== candidate.axis ||
        Math.abs(pad.axes[candidate.axis] - capture.held.value) > 0.02
      )
        capture.held = { axis: candidate.axis, value: pad.axes[candidate.axis], since: now };
      if (now - capture.held.since < 250) return;
      capture.positive = { axis: candidate.axis, value: pad.axes[candidate.axis] };
      capture.stage = 'opposite';
      capture.held = null;
      row.hint.textContent = t(
        'Now move the same control all the way in the opposite direction and hold.',
        'Тепер перемістіть цей орган керування до протилежного краю та утримуйте.',
      );
      return;
    }
    const { axis, value: positive } = capture.positive,
      current = pad.axes[axis];
    if ((current - positive) * (positive - capture.baseline[axis]) > 0) {
      capture.positive.value = current;
      capture.held = null;
      return;
    }
    if (
      Math.abs(current - positive) < 0.5 ||
      ((capture.control !== 'throttle' || throttle.value === 'spring-centred') &&
        (current - capture.baseline[axis]) * (positive - capture.baseline[axis]) >= 0)
    ) {
      capture.held = null;
      return;
    }
    if (!capture.held || Math.abs(current - capture.held.value) > 0.02)
      capture.held = { value: current, since: now };
    if (now - capture.held.since < 250) return;
    row.axis.value = String(axis);
    row.min.value = String(Math.min(positive, current));
    row.max.value = String(Math.max(positive, current));
    row.center.value = String((positive + current) / 2);
    row.invert.checked = positive < current;
    identifying = null;
    row.identify.textContent = copy.identify;
    invalidate();
    autoSaveProfile();
  }
  function clearSticks() {
    for (const stick of stickNodes) {
      stick.dot.style.transform = 'translate(0px, 0px)';
      stick.dot.hidden = true;
    }
  }
  function paint(now) {
    if (disposed) return;
    const capturePad = runtime.raw();
    guide?.sample(capturePad);
    try {
      sampleBootstrap(now);
      sampleLayoutCapture(runtime.raw(), now);
      samplePractice(runtime.raw());
      sampleSwitchCapture(capturePad, now);
      sampleManualCapture(runtime.raw(), now);
    } catch {
      const row = switchCapture ? switchRows[switchCapture.action] : null;
      stopCaptures();
      row?.setCaptureState('error');
      if (row) row.captureHint.textContent = copy.switchConflict;
      status.textContent = copy.switchConflict;
    }
    if (now - lastDiscovery >= 750) {
      lastDiscovery = now;
      if (!runtime.status().selected && !runtime.status().profileDirty && !guide?.captureActive())
        refresh();
    }
    if (now - lastPaint >= 100) {
      lastPaint = now;
      const pad = runtime.raw();
      guide?.update(pad);
      if (pad) {
        for (const [action, row] of Object.entries(switchRows)) {
          try {
            row.indicator.textContent =
              row.button.value === ''
                ? '—'
                : radioSwitch(readProfile(false), pad, action)
                  ? 'ON'
                  : 'OFF';
          } catch {
            row.indicator.textContent = '—';
          }
        }
        raw.textContent = `${copy.raw}\n${pad.axes.map((x, i) => `${i}: ${Number(x).toFixed(3)}`).join('  ')}\n${copy.buttons}: ${pad.buttons.map((b, i) => `${i}: ${Number(b.value ?? b).toFixed(2)}`).join('  ')}`;
        for (const capture of [identifying, recording ? travel : null])
          if (capture)
            for (let i = 0; i < pad.axes.length; i++) {
              capture.min[i] = Math.min(capture.min[i], pad.axes[i]);
              capture.max[i] = Math.max(capture.max[i], pad.axes[i]);
            }
        if (recording && travel)
          for (const row of Object.values(rows))
            if (row.axis.value !== '' && Number.isFinite(travel.min[Number(row.axis.value)])) {
              row.min.value = travel.min[Number(row.axis.value)].toFixed(3);
              row.max.value = travel.max[Number(row.axis.value)].toFixed(3);
            }
        try {
          const input = Object.fromEntries(
              FLIGHT_CONTROLS.map((control) => [control, previewControl(control, pad)]),
            ),
            livePreview = guide?.preview(pad);
          if (livePreview) Object.assign(input, livePreview);
          const layout = STICK_LAYOUTS[Number(mode.value)];
          for (const control of FLIGHT_CONTROLS) {
            const row = rows[control],
              value = input[control];
            const active = identifying?.control === control;
            row.field.classList.toggle('is-listening', active);
            row.reading.textContent =
              value === null
                ? t('Not mapped yet', 'Ще не призначено')
                : `${Math.round(value * 100)}% · ${t('channel', 'канал')} ${row.axis.value}`;
            const position =
              value === null ? 50 : control === 'throttle' ? value * 100 : (value + 1) * 50;
            row.dot.style.left = `${position}%`;
            if (!active || identifying.stage === 'positive') {
              const positionIndex = layout.indexOf(control),
                side = positionIndex < 2 ? copy.left : copy.right;
              const direction = positionIndex % 2 === 0 ? t('RIGHT', 'ПРАВОРУЧ') : t('UP', 'ВГОРУ');
              row.hint.textContent = t(
                `Move the ${side.toLowerCase()} ${direction}.`,
                `Перемістіть ${side.toLowerCase()} ${direction}.`,
              );
              row.identify.textContent = active
                ? t('Listening…', 'Очікування…')
                : t('Map this movement', 'Призначити цей рух');
            }
          }
          for (let i = 0; i < 2; i++) {
            const horizontal = layout[i * 2],
              vertical = layout[i * 2 + 1];
            const y =
              input[vertical] === null
                ? 0
                : vertical === 'throttle'
                  ? input.throttle * 2 - 1
                  : input[vertical];
            stickNodes[i].dot.style.transform =
              `translate(${(input[horizontal] ?? 0) * stickNodes[i].node.clientWidth * 0.34}px, ${-y * stickNodes[i].node.clientWidth * 0.34}px)`;
            stickNodes[i].dot.hidden = input[horizontal] === null && input[vertical] === null;
            stickNodes[i].label.textContent = `${copy[horizontal]} / ${copy[vertical]}`;
            stickNodes[i].node.setAttribute(
              'aria-label',
              `${copy[i === 0 ? 'left' : 'right']}: ${copy[horizontal]} ${Math.round((input[horizontal] ?? 0) * 100)}%, ${copy[vertical]} ${Math.round((input[vertical] ?? 0) * 100)}%`,
            );
          }
        } catch {
          clearSticks();
        }
      } else {
        raw.textContent = runtime.devices().status === 'unavailable' ? copy.unavailable : copy.none;
        clearSticks();
      }
      if (autoSavePending && now >= autoSaveAfter) autoSaveProfile();
      paintSix();
    }
    frame = win.requestAnimationFrame(paint);
  }
  refreshLibrary();
  refresh();
  loadResponse(store.snapshot().response);
  restoreEditorDraft();
  guide = mountRadioGuide({
    container,
    window: win,
    runtime,
    locale,
    select,
    refreshButton,
    layoutLabel,
    throttleLabel,
    mode,
    throttle,
    status,
    sticks,
    rows,
    switchRows,
    readProfile,
    loadProfile,
    invalidate,
    verifyProfile,
    saveProfile,
    autoSaveProfile,
    previewControl,
    stopCaptures,
    externalCaptureActive: () =>
      !!(recording || identifying || switchCapture || layoutCapture || practice),
    skipLegacySwitches: () => bootstrapFlow || Boolean(runtime.controlLayout?.()),
    onDone: () => {
      if (!bootstrapFlow) return onDone();
      bootstrapFlow = false;
      const missing = RADIO_CONTROL_SWITCHES.filter((action) => !ensureLayout()?.switches[action]);
      if (missing.length) startLayoutCapture(missing[0], missing.slice(1));
      else paintSix();
      sixStatus.textContent = t(
        'Sticks saved automatically. Assign Flight and Fire, plus any other switches you want. Each assignment saves automatically.',
        'Стіки збережено автоматично. Призначте Політ, Вогонь та інші перемикачі за бажанням.',
      );
    },
    groups: {
      manual: [sign, channels, travelButton, centreButton],
      switches: [switchIntro, ...switchFields],
      response: onOpenRates
        ? [button(locale === 'uk' ? 'Рейти й газ' : 'Rates & throttle', onOpenRates)]
        : [
            ...Object.values(responseNodes).map((node) => node.parentNode),
            curve,
            resetResponse,
            applyResponse,
          ],
      transfer: [
        libraryLabel,
        sharing,
        downloadButton,
        removeProfile,
        shareButton,
        fileLabel,
        transferLabel,
        exportButton,
        importButton,
      ],
      diagnostics: [raw],
    },
  });
  // Saved calibrations belong beside device selection, not inside JSON tools.
  deviceLabel.after(libraryLabel);
  heading.remove();
  intro.remove();
  switchHeading.remove();
  responseHeading.remove();
  if (onOpenRates) {
    for (const node of Object.values(responseNodes)) node.parentNode.remove();
    curve.remove();
    resetResponse.remove();
    applyResponse.remove();
  }
  sixPanel = el('section');
  sixPanel.className = 'radio-six-switch';
  sixPanel.dataset.radioSixSwitch = '';
  el('h3', t('Full radio · six switches', 'Повне керування · шість перемикачів'), sixPanel);
  el(
    'p',
    t(
      'Assign Flight and Fire first. Add other switches if you want; those actions are also available from the pause menu. Flight OFF opens the menu. Return to its main screen before switching Flight ON to resume.',
      'Спочатку призначте Політ і Вогонь. Інші перемикачі — за бажанням: ці дії доступні й у меню паузи. Політ ВИМК. відкриває меню. Щоб продовжити, поверніться на його головний екран і перемкніть Політ в УВІМК.',
    ),
    sixPanel,
  );
  sixStatus = el('p', '', sixPanel);
  sixStatus.setAttribute('role', 'status');
  sixStatus.dataset.sixStatus = '';
  for (const [index, action] of RADIO_CONTROL_SWITCHES.entries()) {
    const node = el('fieldset', undefined, sixPanel);
    node.dataset.sixRole = action;
    el('legend', `${index + 1} · ${sixNames[action][0]}`, node);
    el('p', sixNames[action][1], node);
    const binding = el('output', '', node);
    const live = el('output', '', node, 'radio-switch-live');
    const capture = button(
      t('Assign this switch', 'Призначити перемикач'),
      () => startLayoutCapture(action),
      node,
    );
    sixRows[action] = { node, binding, live, capture, active: null };
  }
  const modelPanel = el('details', undefined, sixPanel);
  modelPanel.dataset.radioModelPanel = '';
  el('summary', t('Radio model & connection', 'Модель пульта й підключення'), modelPanel);
  el(
    'p',
    t(
      'Choose your radio and how it connects. With a wireless receiver, choose its installed firmware too: the SIM cannot tell which radio is paired with it. Apply suggested channels to save valid assignments automatically, then watch the preview. Your saved stick settings stay unchanged.',
      'Виберіть пульт і спосіб підключення. Для бездротового приймача виберіть також установлену прошивку: SIM не може визначити, який пульт із ним з’єднано. Застосуйте запропоновані канали для автозбереження коректних призначень і стежте за переглядом. Збережені налаштування стіків не змінюються.',
    ),
    modelPanel,
  );
  const modelLabel = el('label', t('Radio model', 'Модель пульта'), modelPanel),
    modelSelect = el('select', undefined, modelLabel);
  modelSelect.dataset.radioModel = '';
  for (const item of RADIO_MODEL_CATALOGUE) el('option', item.name, modelSelect).value = item.id;
  const transportLabel = el(
      'label',
      t('USB setup / receiver firmware', 'Налаштування USB / прошивка приймача'),
      modelPanel,
    ),
    transportSelect = el('select', undefined, transportLabel);
  transportSelect.dataset.radioTransport = '';
  el('option', t('Choose / map manually', 'Вибрати / налаштувати вручну'), transportSelect).value =
    '';
  for (const item of RADIO_CHANNEL_PRESETS)
    el('option', item.name, transportSelect).value = item.id;
  const modelMessage = el('p', '', modelPanel);
  modelMessage.dataset.radioModelStatus = '';
  modelMessage.setAttribute('role', 'status');
  const candidateButton = button(
    t('Try suggested channels', 'Спробувати запропоновані канали'),
    () => {
      try {
        const device = radioDeviceIdentity(runtime.raw()),
          candidate = radioDeviceRecommendation(device, {
            modelId: modelSelect.value,
            channelPreset: transportSelect.value || null,
          });
        if (!candidate.profile || !candidate.layout) throw new Error(modelNotice(candidate));
        cancelSixCapture();
        ensureLayout();
        // Adopt neither a calibration nor a control layout by choosing a model.
        if (!runtime.status().verified) {
          loadProfile(candidate.profile);
          invalidate();
          guide.reset();
        }
        layoutDraft = structuredClone(candidate.layout);
        proposalNeedsCheck = false;
        autoSaveProfile();
        bootstrapEnabled = false;
        try {
          saveRadioModelSelection({
            storage,
            device,
            modelId: candidate.modelId,
            channelPreset: candidate.channelPreset,
          });
        } catch {
          /* Suggestion remains usable for this session. */
        }
        persistSixLayout();
      } catch (error) {
        modelMessage.textContent = error.message;
      }
      paintSix();
    },
    modelPanel,
  );
  candidateButton.dataset.radioModelApply = '';
  modelControls = {
    model: modelSelect,
    transport: transportSelect,
    message: modelMessage,
    apply: candidateButton,
  };
  for (const node of [modelSelect, transportSelect])
    listen(node, 'change', () => {
      try {
        const device = radioDeviceIdentity(runtime.raw());
        if (node === modelSelect)
          transportSelect.value =
            radioDeviceRecommendation(device, { modelId: modelSelect.value }).channelPreset ?? '';
        const candidate = radioDeviceRecommendation(device, {
          modelId: modelSelect.value,
          channelPreset: transportSelect.value || null,
        });
        modelMessage.textContent = modelNotice(candidate);
        saveRadioModelSelection({
          storage,
          device,
          modelId: candidate.modelId,
          channelPreset: candidate.channelPreset,
        });
      } catch (error) {
        modelMessage.textContent = error.message;
      }
      paintSix();
    });
  const captureAll = button(
    t('Guide all six switches', 'Пройти шість перемикачів'),
    () => {
      bootstrapEnabled = false;
      startLayoutCapture(RADIO_CONTROL_SWITCHES[0], RADIO_CONTROL_SWITCHES.slice(1));
    },
    sixPanel,
  );
  captureAll.dataset.sixCaptureAll = '';
  const swapFirePayload = button(
    t('Swap Fire gun ↔ Deploy payload', 'Поміняти Вогонь ↔ Застосування заряду'),
    () => {
      const draft = ensureLayout();
      if (
        !draft?.switches.fire ||
        !draft?.switches.payload ||
        layoutCapture ||
        practice ||
        guide?.captureActive()
      )
        return;
      const before = structuredClone(draft.switches);
      [draft.switches.fire, draft.switches.payload] = [draft.switches.payload, draft.switches.fire];
      if (!persistSixLayout()) draft.switches = before;
      paintSix();
    },
    sixPanel,
  );
  swapFirePayload.dataset.sixSwapFirePayload = '';
  swapFirePayload.title = t(
    'Use when your Fire switch drops the payload. Exchanges these two assignments only; keeps stick calibration and every other switch.',
    'Якщо перемикач вогню скидає заряд. Міняє лише ці дві дії; зберігає калібрування стіків та інші перемикачі.',
  );

  const undo = button(
    t('Restore previous controls', 'Повернути попереднє керування'),
    () => {
      try {
        cancelSixCapture();
        runtime.setControlLayout(previousLayout);
        if (previousLayout) saveRadioControlLayout({ storage, layout: previousLayout });
        else removeRadioControlLayout({ storage, device: radioDeviceIdentity(runtime.raw()) });
        sixStatus.textContent = t(
          'Previous controls restored. Your stick settings are unchanged.',
          'Попереднє керування повернуто. Налаштування стіків не змінено.',
        );
      } catch (error) {
        sixStatus.textContent = error.message;
      }
    },
    sixPanel,
  );
  undo.dataset.sixUndo = '';
  const practiceButton = button(
    t('Practice six switches', 'Перевірити шість перемикачів'),
    () => {
      const pad = runtime.raw();
      if (!pad || !ensureLayout()) return;
      practice = true;
      practiceSeen = new Set();
      practicePrevious = Object.fromEntries(
        RADIO_CONTROL_SWITCHES.map((action) => [action, radioSwitch(layoutDraft, pad, action)]),
      );
      practicePaused = !practicePrevious.arm;
      sixStatus.textContent = t(
        'Practice only: try Flight, Fire, Weapon, Reload, Deploy and Detonate. No flight or weapon commands. Back cancels.',
        'Лише тренування: перевірте Політ, Вогонь, Зброю, Перезарядження, Заряд і Підрив. Команди польоту й зброї заблоковані. Назад скасовує.',
      );
      paintSix();
    },
    sixPanel,
  );
  practiceButton.dataset.sixPractice = '';
  button(
    t('Cancel assignment / practice', 'Скасувати призначення / тренування'),
    cancelSixCapture,
    sixPanel,
  ).dataset.sixCancel = '';
  button(
    t('Start without keyboard', 'Почати без клавіатури'),
    () => {
      stopCaptures();
      guide.cancel();
      bootstrap.reset();
      bootstrapEnabled = true;
      bootstrapComplete = false;
      bootstrapFlow = false;
      runtime.setProvisionalMenu?.(null);
      sixStatus.textContent = t(
        'Move and rest one control twice on the intended radio. Other radios must stay still.',
        'Двічі перемістіть і поверніть один орган керування на потрібному пульті. Інші пульти мають бути нерухомі.',
      );
    },
    sixPanel,
  ).dataset.sixBootstrap = '';
  container.querySelector('.radio-workspace').after(sixPanel);
  container.querySelector('.radio-device-card').append(modelPanel);
  const legacySwitches = container.querySelector('.radio-extra-switches');
  legacySwitches.open = false;
  legacySwitches.querySelector('summary').textContent = t(
    'Previous controls / individual switches',
    'Попереднє керування / окремі перемикачі',
  );
  paintSix();
  frame = win.requestAnimationFrame(paint);
  return {
    store,
    captureActive: () =>
      !!(
        recording ||
        identifying ||
        switchCapture ||
        layoutCapture ||
        practice ||
        guide?.captureActive() ||
        (bootstrapEnabled &&
          !bootstrapComplete &&
          !runtime.status().verified &&
          bootstrap.snapshot().device)
      ),
    menuPreview: () => runtime.menuPreview?.() ?? runtime.preview(),
    cancelCapture: cancelSixCapture,
    captureRadioBack: () =>
      layoutCapture?.action !== 'weapon' &&
      switchCapture?.action !== 'weapon' &&
      !(bootstrapEnabled && !bootstrapComplete && bootstrap.snapshot().phase === 'back'),
    dispose() {
      const result = autoSaveProfile();
      // Keep unfinished edits as a draft; leaving the editor restores the last
      // usable calibration instead of leaving flight locked by a partial edit.
      if (!result && runtime.status().profileDirty) {
        const previous = store.snapshot().radio;
        try {
          if (
            previous?.verified &&
            canonicalJSON(previous.device) === canonicalJSON(radioDeviceIdentity(runtime.raw()))
          ) {
            runtime.setProfile(previous, { restoring: true });
            runtime.verify();
          }
        } catch {
          /* Disconnection keeps the existing reconnect/arming rules. */
        }
      }
      persistSixLayout({ announce: false });
      disposed = true;
      runtime.setProvisionalMenu?.(null);
      guide?.dispose();
      runtime.endSetup();
      if (frame !== null) win.cancelAnimationFrame(frame);
      for (const remove of listeners) remove();
      container.replaceChildren();
    },
  };
}
