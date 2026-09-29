import { radioControlLabel, captureRadioSwitch } from './radio-controls.mjs';
import { canonicalJSON } from '../../game/data-json.mjs';
import {
  DEFAULT_RESPONSE,
  FLIGHT_CONTROLS,
  RADIO_FORMAT,
  STICK_LAYOUTS,
  createFlightProfileStore,
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
    captureSwitch: 'Identify switch / button',
    useSwitch: 'Use active switch / button',
    switchStart:
      'First leave the chosen switch OFF (or release the button). Click Identify, then move only that switch ON and leave it there (or hold the button). Click Use active switch / button. For arming, use a maintained switch; for reset, use a momentary button if available.',
    switchMove:
      'Move only the chosen switch to its active position and leave it there, then click Use active switch / button. No button change? Assign the switch to an EdgeTX USB joystick button channel.',
    switchAmbiguous:
      'No single button channel changed. Reset the switch, click Identify again, then operate only that switch. It must be exposed as a USB joystick button channel.',
    switchCaptured:
      'Switch captured. Return it to OFF/released. Verify and save the profile to apply.',
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
    captureSwitch: 'Визначити перемикач / кнопку',
    useSwitch: 'Використати активний перемикач / кнопку',
    switchStart:
      'Залиште перемикач вимкненим або відпустіть кнопку. Натисніть Визначити, увімкніть лише цей перемикач або утримуйте кнопку та підтвердьте активне положення. Для моторів використовуйте перемикач із фіксацією, для скидання — кнопку без фіксації.',
    switchMove:
      'Увімкніть лише вибраний перемикач або утримуйте кнопку й підтвердьте активне положення. Якщо канал не змінюється, призначте перемикач каналу кнопки USB-джойстика EdgeTX.',
    switchAmbiguous:
      'Не вдалося визначити один канал кнопки. Поверніть перемикач у вимкнене положення, почніть визначення знову та рухайте лише його.',
    switchCaptured:
      'Перемикач визначено. Вимкніть його або відпустіть кнопку. Перевірте та збережіть профіль.',
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
  let verified = false,
    recording = false,
    identifying = null,
    switchCapture = null,
    travel = null,
    frame = null,
    disposed = false,
    lastPaint = -Infinity;
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
  el('h2', copy.title);
  el('p', copy.intro);
  const deviceLabel = el('label', copy.device),
    select = el('select', undefined, deviceLabel);
  const refresh = () => {
    const previous = select.value,
      result = runtime.devices();
    select.replaceChildren();
    const empty = el(
      'option',
      result.status === 'unavailable' ? copy.unavailable : copy.none,
      select,
    );
    empty.value = '';
    for (const device of result.devices) {
      const option = el(
        'option',
        `${device.id} · ${device.axes} axes / ${device.buttons} buttons · ${device.mapping || 'unmapped'}`,
        select,
      );
      option.value = String(device.index);
    }
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  };
  button(copy.refresh, refresh);
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
  el('p', copy.sign);
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
          if (identifying) rows[identifying.control].identify.textContent = copy.identify;
          identifying = { control, min: [...pad.axes], max: [...pad.axes] };
          identify.textContent = copy.use;
        }
      },
      field,
    );
    rows[control] = { axis, min, center, max, invert, deadZone, identify, legend };
  }
  function invalidate() {
    verified = false;
    status.textContent = copy.incomplete;
  }
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
  button(copy.centre, () => {
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
  el('h3', copy.switches);
  el('p', copy.switchStart);
  for (const action of ['arm', 'pause', 'reset']) {
    const field = el('fieldset');
    field.setAttribute('data-radio-switch', action);
    el('legend', copy[action === 'reset' ? 'resetAction' : action], field);
    const node = label(copy.buttons, 'number', '', field);
    node.min = '0';
    node.max = '255';
    node.step = '1';
    const threshold = label(copy.threshold, 'number', '0.5', field);
    threshold.min = '0.1';
    threshold.max = '0.9';
    threshold.step = '0.05';
    const invert = label(copy.invert, 'checkbox', '', field);
    const identify = button(
      copy.captureSwitch,
      () => {
        const pad = runtime.raw();
        if (!pad) {
          status.textContent = copy.pick;
          return;
        }
        const identity = canonicalJSON(radioDeviceIdentity(pad));
        const values = pad.buttons.map((b) => b.value ?? b);
        if (switchCapture?.action === action) {
          const binding =
            switchCapture.identity === identity
              ? captureRadioSwitch(switchCapture.values, values)
              : null;
          switchCapture = null;
          identify.textContent = copy.captureSwitch;
          if (!binding) {
            status.textContent = copy.switchAmbiguous;
            return;
          }
          node.value = String(binding.button);
          threshold.value = String(binding.threshold);
          invert.checked = binding.invert;
          invalidate();
          status.textContent = copy.switchCaptured;
        } else {
          if (switchCapture)
            switchRows[switchCapture.action].identify.textContent = copy.captureSwitch;
          invalidate();
          switchCapture = { action, identity, values };
          identify.textContent = copy.useSwitch;
          status.textContent = copy.switchMove;
        }
      },
      field,
    );
    switchRows[action] = { button: node, threshold, invert, identify };
  }
  const sticks = el('div');
  sticks.className = 'radio-sticks';
  const stickNodes = ['left', 'right'].map((key) => {
    const node = el('div', undefined, sticks);
    node.className = 'radio-stick';
    node.setAttribute('aria-label', copy[key]);
    return { label: el('span', copy[key], node), dot: el('i', undefined, node) };
  });
  function readProfile(confirmed = verified) {
    const pad = runtime.raw();
    if (!pad) throw new Error(copy.pick);
    const numeric = (node) => (node.value.trim() === '' ? NaN : Number(node.value));
    return validateRadioProfile({
      format: RADIO_FORMAT,
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
            : {
                button: Number(row.button.value),
                threshold: numeric(row.threshold),
                invert: row.invert.checked,
              },
        ]),
      ),
    });
  }
  function loadProfile(p) {
    if (!p) return;
    switchCapture = null;
    for (const row of Object.values(switchRows)) row.identify.textContent = copy.captureSwitch;
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
      row.button.value = p.switches[key] ? String(p.switches[key].button) : '';
      row.threshold.value = String(p.switches[key]?.threshold ?? 0.5);
      row.invert.checked = p.switches[key]?.invert ?? false;
    }
    describeControls();
    invalidate();
  }
  button(copy.verify, () => {
    try {
      if (recording || switchCapture) throw new Error(copy.incomplete);
      readProfile(true);
      verified = true;
      status.textContent = copy.verified;
    } catch (e) {
      status.textContent = e.message;
    }
  });
  button(copy.save, () => {
    try {
      if (!verified || recording || switchCapture) throw new Error(copy.incomplete);
      const p = readProfile(true);
      runtime.setProfile(p);
      runtime.verify();
      const result = store.save({ ...store.snapshot(), radio: p });
      status.textContent = result.saved ? copy.saved : `${copy.session} ${result.error}`;
      onProfile(p);
    } catch (e) {
      status.textContent = e.message;
    }
  });
  listen(select, 'change', () => {
    if (select.value === '') {
      runtime.freeze('device-selected');
      invalidate();
      status.textContent = copy.pick;
      return;
    }
    const selected = runtime.select(Number(select.value)),
      pad = selected ? runtime.raw() : null;
    recording = false;
    identifying = null;
    switchCapture = null;
    for (const row of Object.values(switchRows)) row.identify.textContent = copy.captureSwitch;
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
    const p = store.snapshot().radio;
    if (p && canonicalJSON(p.device) === canonicalJSON(radioDeviceIdentity(pad))) loadProfile(p);
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

  el('h2', copy.response);
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
  button(copy.reset, () => loadResponse(DEFAULT_RESPONSE));
  button(copy.apply, () => {
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
  transfer.maxLength = 16384;
  button(copy.export, () => {
    transfer.value = store.export();
  });
  button(copy.import, () => {
    try {
      const result = store.import(transfer.value);
      loadProfile(store.snapshot().radio);
      loadResponse(store.snapshot().response);
      runtime.freeze('profile-changed');
      onResponse(store.snapshot().response);
      status.textContent = `${result.saved ? copy.saved : copy.session} ${copy.incomplete}`;
    } catch (e) {
      status.textContent = e.message;
    }
  });
  function describeControls() {
    for (const control of FLIGHT_CONTROLS)
      rows[control].legend.textContent = radioControlLabel(control, Number(mode.value), locale);
    throttleLabel.firstChild.textContent = radioControlLabel(
      'throttle',
      Number(mode.value),
      locale,
    );
  }
  listen(mode, 'change', describeControls);
  function paint(now) {
    if (disposed) return;
    if (now - lastPaint >= 100) {
      lastPaint = now;
      const pad = runtime.raw();
      if (pad) {
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
              `translate(${input[horizontal] * 34}px, ${-y * 34}px)`;
            stickNodes[i].label.textContent =
              `${radioControlLabel(horizontal, Number(mode.value), locale)} · ${radioControlLabel(vertical, Number(mode.value), locale)}`;
          }
        } catch {
          /* Incomplete mapping is expected until all endpoints are captured. */
        }
      } else
        raw.textContent = runtime.devices().status === 'unavailable' ? copy.unavailable : copy.none;
    }
    frame = win.requestAnimationFrame(paint);
  }
  refresh();
  loadResponse(store.snapshot().response);
  frame = win.requestAnimationFrame(paint);
  return {
    store,
    dispose() {
      disposed = true;
      if (frame !== null) win.cancelAnimationFrame(frame);
      for (const remove of listeners) remove();
      container.replaceChildren();
    },
  };
}
