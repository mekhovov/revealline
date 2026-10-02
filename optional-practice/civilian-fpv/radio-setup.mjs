import { radioControlLabel, createRadioSwitchCapture } from './radio-controls.mjs';
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
    verify: 'I checked the animated sticks and their direction',
    save: 'Save verified profile',
    verified: 'Control verification complete. Save to keep this profile.',
    saved: 'Profile saved on this device.',
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
    incomplete:
      'Mapping/calibration incomplete. Record travel and centres, then verify all controls.',
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
    switchCaptured: 'Assigned and returned OFF. Check the live indicator, then save.',
    library: 'Saved radios',
    chooseSaved: 'Choose a saved calibration…',
    download: 'Download all radio profiles',
    share: 'Share this radio setup',
    file: 'Import a setup file',
    sharing:
      'Share the downloaded setup file with your radio model, firmware, USB mode and computer/browser. Shared mappings need a local direction and switch check. Files are never uploaded automatically.',
    imported:
      'Imported as a draft. Check directions and Arm/Reset, then verify and save before flying.',
    threshold: 'Activation threshold',
    buttons: 'Buttons',
    arm: 'Arm/disarm — switch ON enables flight; OFF stops motors',
    pause: 'Pause — freeze flight until resumed',
    resetAction: 'Reset level — restart this drill at the launch pad',
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
    verify: 'Я перевірив рух і напрямок анімованих стіків',
    save: 'Зберегти перевірений профіль',
    verified: 'Керування перевірено. Збережіть профіль.',
    saved: 'Профіль збережено на пристрої.',
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
    switchCaptured: 'Призначено й вимкнено. Перевірте індикатор наживо та збережіть.',
    library: 'Збережені пульти',
    chooseSaved: 'Виберіть збережене калібрування…',
    download: 'Завантажити всі профілі пультів',
    share: 'Поділитися налаштуванням пульта',
    file: 'Імпортувати файл налаштувань',
    sharing:
      'Поділіться файлом, указавши модель пульта, прошивку, режим USB та комп’ютер/браузер. Чужі призначення потребують місцевої перевірки напрямків і перемикачів. Файли не надсилаються автоматично.',
    imported:
      'Імпортовано як чернетку. Перевірте напрямки, мотори й скидання, підтвердьте та збережіть перед польотом.',
    threshold: 'Поріг спрацьовування',
    buttons: 'Кнопки',
    arm: 'Мотори — увімкнений перемикач дозволяє політ, вимкнений зупиняє мотори',
    pause: 'Пауза — призупинити політ до відновлення',
    resetAction: 'Скинути рівень — почати цю вправу зі стартового майданчика',
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
}) {
  const doc = container.ownerDocument,
    copy = COPY[locale] ?? COPY.en;
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    /* explicit session status below */
  }
  const store = createFlightProfileStore({ storage });
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
    importRevision = 0;
  let guide = null;
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
    // by the user until they explicitly verify and save them.
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
  const sign = el('p', copy.sign);
  const channels = el('div');
  channels.className = 'radio-channels';
  for (const control of FLIGHT_CONTROLS) {
    const field = el('fieldset', undefined, channels);
    const legend = el('legend', radioControlLabel(control, Number(mode.value), locale), field);
    const axis = label(copy.axis, 'number', '', field);
    axis.min = '0';
    axis.max = '63';
    axis.step = '1';
    const min = label(copy.minimum, 'number', '', field),
      center = label(copy.center, 'number', '', field),
      max = label(copy.maximum, 'number', '', field);
    for (const node of [min, center, max]) {
      node.min = '-1';
      node.max = '1';
      node.step = '0.001';
    }
    const invert = label(copy.invert, 'checkbox', '', field),
      deadZone = label(copy.deadZone, 'number', control === 'throttle' ? '0' : '0.02', field);
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
        if (identifying?.control === control) {
          const range = identifying.max
            .map((value, i) => ({ axis: i, range: value - identifying.min[i] }))
            .sort((a, b) => b.range - a.range);
          if (range[0]?.range >= 0.25 && range[0].range > (range[1]?.range ?? 0) * 1.5) {
            axis.value = String(range[0].axis);
            identifying = null;
            identify.textContent = copy.identify;
            invalidate();
          } else status.textContent = copy.ambiguous;
        } else {
          invalidate();
          if (identifying) rows[identifying.control].identify.textContent = copy.identify;
          identifying = { control, min: [...pad.axes], max: [...pad.axes] };
          identify.textContent = copy.use;
        }
      },
      field,
    );
    rows[control] = { axis, min, center, max, invert, deadZone, identify, legend };
  }
  function invalidate(markRuntime = true) {
    importRevision++;
    verified = false;
    if (markRuntime) runtime.editProfile();
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
  for (const action of ['arm', 'pause', 'reset']) {
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
    return validateRadioProfile({
      format: Object.values(switchRows).some(
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
        Object.entries(switchRows).map(([key, row]) => [
          key,
          row.button.value === ''
            ? null
            : row.source.value === 'axis'
              ? { axis: Number(row.button.value), off: numeric(row.off), on: numeric(row.on) }
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
  const verifyButton = button(copy.verify, verifyProfile);
  function saveProfile() {
    importRevision++;
    try {
      if (!verified || recording || identifying || switchCapture) throw new Error(copy.incomplete);
      const p = readProfile(true);
      runtime.setProfile(p);
      runtime.verify();
      const result = store.save({ ...store.snapshot(), radio: p });
      status.textContent = result.saved ? copy.saved : `${copy.session} ${result.error}`;
      refreshLibrary();
      onProfile(p);
      return result;
    } catch (e) {
      status.textContent = e.message;
      return null;
    }
  }
  const saveButton = button(copy.save, saveProfile);
  listen(select, 'change', () => {
    guide?.reset();
    if (select.value === '') {
      runtime.select(null);
      invalidate();
      status.textContent = copy.pick;
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
    listen(node, 'change', invalidate);

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
    if (parsed.format === RADIO_FORMAT || parsed.format === AXIS_RADIO_FORMAT) {
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
    const result = store.import(value);
    guide?.reset();
    stopCaptures();
    const imported = value.radio;
    if (imported) loadProfile(imported);
    loadResponse(store.snapshot().response);
    runtime.editProfile();
    onResponse(store.snapshot().response);
    refreshLibrary();
    status.textContent = `${copy.imported} ${result.saved ? copy.saved : copy.session}`;
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
  }
  function describeControls() {
    for (const control of FLIGHT_CONTROLS)
      rows[control].legend.textContent = radioControlLabel(control, Number(mode.value), locale);
    throttleLabel.firstChild.textContent = locale === 'uk' ? 'Стік газу' : 'Throttle stick';
  }
  listen(mode, 'change', describeControls);
  function clearSticks() {
    for (const stick of stickNodes) {
      stick.dot.style.transform = 'translate(0px, 0px)';
      stick.dot.hidden = true;
    }
  }
  function paint(now) {
    if (disposed) return;
    const capturePad = runtime.raw();
    try {
      sampleSwitchCapture(capturePad, now);
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
          const input = normalizeRadioInput(readProfile(), pad),
            layout = STICK_LAYOUTS[Number(mode.value)];
          for (let i = 0; i < 2; i++) {
            const horizontal = layout[i * 2],
              vertical = layout[i * 2 + 1],
              y = vertical === 'throttle' ? input.throttle * 2 - 1 : input[vertical];
            stickNodes[i].dot.style.transform =
              `translate(${input[horizontal] * stickNodes[i].node.clientWidth * 0.34}px, ${-y * stickNodes[i].node.clientWidth * 0.34}px)`;
            stickNodes[i].dot.hidden = false;
            stickNodes[i].label.textContent = `${copy[horizontal]} / ${copy[vertical]}`;
            stickNodes[i].node.setAttribute(
              'aria-label',
              `${copy[i === 0 ? 'left' : 'right']}: ${copy[horizontal]} ${Math.round(input[horizontal] * 100)}%, ${copy[vertical]} ${Math.round(input[vertical] * 100)}%`,
            );
          }
        } catch {
          clearSticks();
        }
      } else {
        raw.textContent = runtime.devices().status === 'unavailable' ? copy.unavailable : copy.none;
        clearSticks();
      }
      guide?.update(pad);
    }
    frame = win.requestAnimationFrame(paint);
  }
  refreshLibrary();
  refresh();
  loadResponse(store.snapshot().response);
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
    stopCaptures,
    externalCaptureActive: () => !!(recording || identifying || switchCapture),
    onDone,
    groups: {
      manual: [sign, channels, travelButton, centreButton, verifyButton, saveButton],
      switches: [switchIntro, ...switchFields],
      response: [
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
  frame = win.requestAnimationFrame(paint);
  return {
    store,
    captureActive: () => !!(recording || identifying || switchCapture || guide?.captureActive()),
    dispose() {
      disposed = true;
      guide?.dispose();
      runtime.endSetup();
      if (frame !== null) win.cancelAnimationFrame(frame);
      for (const remove of listeners) remove();
      container.replaceChildren();
    },
  };
}
